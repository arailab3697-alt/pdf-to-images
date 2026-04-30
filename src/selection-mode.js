import { DPI_SCALE, MIN_DIST } from './constants.js';
import { dom } from './dom.js';
import { state, resetDocumentState } from './state.js';
import { bytesToDataUrl, getCompressedPngBytes } from './compression.js';
import { setSelectModeUI } from './ui.js';

export function getCanvasScale(page) {
  return {
    scaleX: page.canvas.width / page.displayWidth,
    scaleY: page.canvas.height / page.displayHeight
  };
}

function enableInteract(el) {
  interact(el)
    .draggable({
      enabled: false,
      listeners: {
        move(event) {
          const x = (parseFloat(el.style.left) || 0) + event.dx;
          const y = (parseFloat(el.style.top) || 0) + event.dy;
          el.style.left = `${x}px`;
          el.style.top = `${y}px`;
        }
      }
    })
    .resizable({
      enabled: false,
      edges: { left: true, right: true, top: true, bottom: true },
      listeners: {
        move(event) {
          let x = parseFloat(el.style.left) || 0;
          let y = parseFloat(el.style.top) || 0;

          x += event.deltaRect.left;
          y += event.deltaRect.top;

          el.style.left = `${x}px`;
          el.style.top = `${y}px`;
          el.style.width = `${event.rect.width}px`;
          el.style.height = `${event.rect.height}px`;
        }
      }
    });
}

function createOverlay(wrapper, x, y) {
  const el = document.createElement('div');
  el.className = 'overlay';
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  el.style.width = '0px';
  el.style.height = '0px';

  wrapper.appendChild(el);
  const overlay = { el, wrapper };
  state.overlays.push(overlay);
  enableInteract(el);
  return el;
}

function setEditMode(target) {
  if (state.selectedOverlay === target) {
    state.selectedOverlay.el.classList.remove('selected');
    interact(state.selectedOverlay.el).draggable({ enabled: false });
    interact(state.selectedOverlay.el).resizable({ enabled: false });
    state.selectedOverlay = null;
    state.mode = 'draw';
    return;
  }

  if (state.selectedOverlay) {
    state.selectedOverlay.el.classList.remove('selected');
    interact(state.selectedOverlay.el).draggable({ enabled: false });
    interact(state.selectedOverlay.el).resizable({ enabled: false });
  }

  state.selectedOverlay = target;
  state.mode = 'edit';
  target.el.classList.add('selected');
  interact(target.el).draggable({ enabled: true });
  interact(target.el).resizable({ enabled: true });
}

export async function loadPdfFile(files) {
  if (!files || files.length === 0) return;

  if (state.pages.length > 0) {
    setSelectModeUI();
  }

  dom.viewer.innerHTML = '';
  dom.selectionPanel.innerHTML = '';
  dom.dummyPdfInner.innerHTML = '';
  dom.pdfList.innerHTML = '';
  resetDocumentState();

  for (let fIdx = 0; fIdx < files.length; fIdx++) {
    const file = files[fIdx];
    const buf = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buf }).promise;

    state.files.push({ name: file.name, numPages: pdf.numPages, startPageIndex: state.pages.length });

    // Render sidebar item
    const item = document.createElement('div');
    item.className = 'pdf-list-item';
    item.textContent = file.name;
    item.addEventListener('click', () => {
      const targetPage = state.pages.find(p => p.fileIndex === fIdx);
      if (targetPage) targetPage.wrapper.scrollIntoView({ behavior: 'smooth' });
    });
    dom.pdfList.appendChild(item);

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: DPI_SCALE });

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      canvas.style.width = `${viewport.width / DPI_SCALE}px`;
      canvas.style.height = `${viewport.height / DPI_SCALE}px`;

      await page.render({ canvasContext: ctx, viewport }).promise;

      const wrapper = document.createElement('div');
      wrapper.className = 'page';
      wrapper.style.width = canvas.style.width;
      wrapper.style.height = canvas.style.height;
      wrapper.appendChild(canvas);
      dom.viewer.appendChild(wrapper);

      state.pages.push({
        canvas,
        wrapper,
        displayWidth: viewport.width / DPI_SCALE,
        displayHeight: viewport.height / DPI_SCALE,
        fileIndex: fIdx
      });
    }
  }

  // Setup scroll listener to update active PDF (avoid duplicate registration)
  dom.viewer.removeEventListener('scroll', updateActivePdf);
  dom.viewer.addEventListener('scroll', updateActivePdf);

  setSelectModeUI();
}

function updateActivePdf() {
  const rects = state.pages.map(p => p.wrapper.getBoundingClientRect());
  const viewerRect = dom.viewer.getBoundingClientRect();
  const midPoint = viewerRect.top + viewerRect.height / 2;

  let activeIndex = 0;
  for (let i = 0; i < rects.length; i++) {
    if (rects[i].top <= midPoint && rects[i].bottom >= midPoint) {
      activeIndex = state.pages[i].fileIndex;
      break;
    }
  }

  const items = dom.pdfList.querySelectorAll('.pdf-list-item');
  items.forEach((el, i) => {
    el.classList.toggle('active', i === activeIndex);
  });
}

export function setupSelectionEvents() {
  const onContextMenu = (e) => {
    e.preventDefault();
    for (const overlay of state.overlays) {
      const rect = overlay.el.getBoundingClientRect();
      if (e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom) {
        setEditMode(overlay);
        return;
      }
    }
  };

  const onMouseDown = (e) => {
    if (state.mode !== 'draw' || e.button !== 0) return;

    for (const page of state.pages) {
      const rect = page.wrapper.getBoundingClientRect();
      if (e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom) {
        state.drawing = true;
        state.activeWrapper = page.wrapper;
        state.start = { x: e.clientX - rect.left, y: e.clientY - rect.top };
        state.current = createOverlay(state.activeWrapper, state.start.x, state.start.y);
        break;
      }
    }
  };

  const onMouseMove = (e) => {
    if (!state.drawing || !state.current) return;

    const rect = state.activeWrapper.getBoundingClientRect();
    const pos = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const dx = pos.x - state.start.x;
    const dy = pos.y - state.start.y;

    state.current.style.width = `${Math.abs(dx)}px`;
    state.current.style.height = `${Math.abs(dy)}px`;
    state.current.style.left = `${dx < 0 ? pos.x : state.start.x}px`;
    state.current.style.top = `${dy < 0 ? pos.y : state.start.y}px`;
  };

  const onMouseUp = (e) => {
    if (state.drawing && state.current) {
      const rect = state.activeWrapper.getBoundingClientRect();
      const end = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      const dx = Math.abs(end.x - state.start.x);
      const dy = Math.abs(end.y - state.start.y);

      if (dx + dy < MIN_DIST) {
        state.current.remove();
        state.overlays = state.overlays.filter((overlay) => overlay.el !== state.current);
      }
    }

    state.drawing = false;
    state.current = null;
  };

  const onKeyDown = (e) => {
    if (e.key === 'Delete' && state.mode === 'edit' && state.selectedOverlay) {
      state.selectedOverlay.el.remove();
      state.overlays = state.overlays.filter((overlay) => overlay !== state.selectedOverlay);
      state.selectedOverlay = null;
      state.mode = 'draw';
    }
  };

  dom.viewer.addEventListener('contextmenu', onContextMenu);
  dom.viewer.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);
  window.addEventListener('keydown', onKeyDown);

  return () => {
    dom.viewer.removeEventListener('contextmenu', onContextMenu);
    dom.viewer.removeEventListener('mousedown', onMouseDown);
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
    window.removeEventListener('keydown', onKeyDown);
  };
}

export async function exportSelectionsToZip() {
  const zip = new JSZip();

  for (const [i, overlay] of state.overlays.entries()) {
    const { el, wrapper } = overlay;
    const page = state.pages.find((p) => p.wrapper === wrapper);
    if (!page) continue;

    const { scaleX, scaleY } = getCanvasScale(page);
    const out = document.createElement('canvas');
    out.width = Math.max(1, Math.round(el.offsetWidth * scaleX));
    out.height = Math.max(1, Math.round(el.offsetHeight * scaleY));

    out.getContext('2d').drawImage(
      page.canvas,
      el.offsetLeft * scaleX,
      el.offsetTop * scaleY,
      el.offsetWidth * scaleX,
      el.offsetHeight * scaleY,
      0,
      0,
      out.width,
      out.height
    );

    const compressedPng = await getCompressedPngBytes(out);
    zip.file(`selection_${i}.png`, compressedPng);
  }

  return zip.generateAsync({ type: 'blob' });
}

export async function buildSelectionsFromOverlays() {
  state.extractedSelections = [];

  const tasks = state.overlays.map(async (overlay, idx) => {
    const page = state.pages.find((p) => p.wrapper === overlay.wrapper);
    if (!page) return null;

    const { scaleX, scaleY } = getCanvasScale(page);
    const w = overlay.el.offsetWidth;
    const h = overlay.el.offsetHeight;
    if (w <= 0 || h <= 0) return null;

    const out = document.createElement('canvas');
    out.width = Math.max(1, Math.round(w * scaleX));
    out.height = Math.max(1, Math.round(h * scaleY));

    out.getContext('2d').drawImage(
      page.canvas,
      overlay.el.offsetLeft * scaleX,
      overlay.el.offsetTop * scaleY,
      w * scaleX,
      h * scaleY,
      0,
      0,
      out.width,
      out.height
    );

    const compressedPng = await getCompressedPngBytes(out);
    return {
      id: `sel_${idx}`,
      name: `画像${idx + 1}`,
      baseName: `画像${idx + 1}`,
      bytes: compressedPng,
      url: bytesToDataUrl(compressedPng),
      width: out.width,
      height: out.height,
      variantNo: null,
      fileIndex: page.fileIndex
    };
  });

  state.extractedSelections = (await Promise.all(tasks)).filter(Boolean);


  state.availableSelectionIds = new Set(state.extractedSelections.map((selection) => selection.id));
}
