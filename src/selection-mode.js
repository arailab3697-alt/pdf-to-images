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

function findOverlayByElement(el) {
  return state.overlays.find((overlay) => overlay.el === el);
}

function touchOverlay(overlay) {
  if (!overlay) return;
  overlay.version += 1;

  const prev = state.overlayMeta.get(overlay.id) || {};
  state.overlayMeta.set(overlay.id, {
    ...prev,
    lastTouchedAt: Date.now(),
    version: overlay.version,
    status: 'idle'
  });

  state.overlayCompressionCache.delete(overlay.id);
  enqueueSpeculativeCompression(overlay.id);
}

function enqueueSpeculativeCompression(overlayId) {
  if (!overlayId) return;
  if (!state.speculativeCompressionQueue.includes(overlayId)) {
    state.speculativeCompressionQueue.push(overlayId);
  }
  scheduleSpeculativeCompression();
}

function scheduleSpeculativeCompression() {
  if (state.speculativeCompressionRunning || state.speculativeCompressionHandle) return;

  const runner = async () => {
    state.speculativeCompressionHandle = null;
    await runSpeculativeCompressionLoop();
  };

  if (typeof requestIdleCallback === 'function') {
    state.speculativeCompressionHandle = requestIdleCallback(runner, { timeout: 500 });
  } else {
    state.speculativeCompressionHandle = setTimeout(runner, 120);
  }
}

async function runSpeculativeCompressionLoop() {
  if (state.speculativeCompressionRunning) return;
  state.speculativeCompressionRunning = true;

  try {
    while (state.speculativeCompressionQueue.length > 0) {
      const sortedQueue = state.speculativeCompressionQueue
        .map((id) => ({ id, meta: state.overlayMeta.get(id) }))
        .filter((item) => item.meta && item.meta.status !== 'running')
        .sort((a, b) => (a.meta.lastTouchedAt || 0) - (b.meta.lastTouchedAt || 0));

      if (sortedQueue.length === 0) break;

      const targetId = sortedQueue[0].id;
      state.speculativeCompressionQueue = state.speculativeCompressionQueue.filter((id) => id !== targetId);
      await compressOverlayAndCache(targetId);
    }
  } finally {
    state.speculativeCompressionRunning = false;
    if (state.speculativeCompressionQueue.length > 0) {
      scheduleSpeculativeCompression();
    }
  }
}

function removeOverlayArtifacts(overlayId) {
  state.speculativeCompressionQueue = state.speculativeCompressionQueue.filter((id) => id !== overlayId);
  state.overlayCompressionCache.delete(overlayId);
  state.overlayMeta.delete(overlayId);
}

function getOverlayCanvas(overlay) {
  const page = state.pages.find((p) => p.wrapper === overlay.wrapper);
  if (!page) return null;

  const { scaleX, scaleY } = getCanvasScale(page);
  const width = overlay.el.offsetWidth;
  const height = overlay.el.offsetHeight;
  if (width <= 0 || height <= 0) return null;

  const out = document.createElement('canvas');
  out.width = Math.max(1, Math.round(width * scaleX));
  out.height = Math.max(1, Math.round(height * scaleY));

  out.getContext('2d').drawImage(
    page.canvas,
    overlay.el.offsetLeft * scaleX,
    overlay.el.offsetTop * scaleY,
    width * scaleX,
    height * scaleY,
    0,
    0,
    out.width,
    out.height
  );

  return { out, page };
}

async function compressOverlayAndCache(overlayId) {
  const overlay = state.overlays.find((item) => item.id === overlayId);
  const meta = state.overlayMeta.get(overlayId);
  if (!overlay || !meta) return null;

  state.overlayMeta.set(overlayId, { ...meta, status: 'running' });

  const versionAtStart = overlay.version;
  const render = getOverlayCanvas(overlay);
  if (!render) {
    state.overlayMeta.set(overlayId, { ...meta, status: 'failed' });
    return null;
  }

  const compressedPng = await getCompressedPngBytes(render.out);

  const latestOverlay = state.overlays.find((item) => item.id === overlayId);
  if (!latestOverlay || latestOverlay.version !== versionAtStart) {
    return null;
  }

  const cached = {
    bytes: compressedPng,
    version: versionAtStart,
    width: render.out.width,
    height: render.out.height
  };

  state.overlayCompressionCache.set(overlayId, cached);

  const latestMeta = state.overlayMeta.get(overlayId) || {};
  state.overlayMeta.set(overlayId, { ...latestMeta, status: 'done' });

  return cached;
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
        },
        end() {
          touchOverlay(findOverlayByElement(el));
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
        },
        end() {
          touchOverlay(findOverlayByElement(el));
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
  const overlay = {
    id: `ovl_${state.overlaySeq++}`,
    version: 0,
    el,
    wrapper
  };
  state.overlays.push(overlay);
  state.overlayMeta.set(overlay.id, {
    lastTouchedAt: Date.now(),
    version: overlay.version,
    status: 'idle'
  });
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

    const item = document.createElement('div');
    item.className = 'pdf-list-item';
    item.textContent = file.name;
    item.addEventListener('click', () => {
      const targetPage = state.pages.find((p) => p.fileIndex === fIdx);
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

  dom.viewer.removeEventListener('scroll', updateActivePdf);
  dom.viewer.addEventListener('scroll', updateActivePdf);

  setSelectModeUI();
}

function updateActivePdf() {
  const rects = state.pages.map((p) => p.wrapper.getBoundingClientRect());
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
      const currentOverlay = findOverlayByElement(state.current);

      if (dx + dy < MIN_DIST) {
        state.current.remove();
        state.overlays = state.overlays.filter((overlay) => overlay.el !== state.current);
        if (currentOverlay) removeOverlayArtifacts(currentOverlay.id);
      } else {
        touchOverlay(currentOverlay);
      }
    }

    state.drawing = false;
    state.current = null;
  };

  const onKeyDown = (e) => {
    if (e.key === 'Delete' && state.mode === 'edit' && state.selectedOverlay) {
      const deletingOverlayId = state.selectedOverlay.id;
      state.selectedOverlay.el.remove();
      state.overlays = state.overlays.filter((overlay) => overlay !== state.selectedOverlay);
      state.selectedOverlay = null;
      state.mode = 'draw';
      removeOverlayArtifacts(deletingOverlayId);
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
    const cache = state.overlayCompressionCache.get(overlay.id);
    let bytes = null;

    if (cache && cache.version === overlay.version) {
      bytes = cache.bytes;
    } else {
      const result = await compressOverlayAndCache(overlay.id);
      bytes = result?.bytes || null;
    }

    if (bytes) {
      zip.file(`selection_${i}.png`, bytes);
    }
  }

  return zip.generateAsync({ type: 'blob' });
}

export async function buildSelectionsFromOverlays() {
  state.extractedSelections = [];

  const tasks = state.overlays.map(async (overlay, idx) => {
    const page = state.pages.find((p) => p.wrapper === overlay.wrapper);
    if (!page) return null;

    const cache = state.overlayCompressionCache.get(overlay.id);
    let compressedPng;
    let width;
    let height;

    if (cache && cache.version === overlay.version) {
      compressedPng = cache.bytes;
      width = cache.width;
      height = cache.height;
    } else {
      const result = await compressOverlayAndCache(overlay.id);
      if (!result) return null;
      compressedPng = result.bytes;
      width = result.width;
      height = result.height;
    }

    return {
      id: `sel_${idx}`,
      name: `画像${idx + 1}`,
      baseName: `画像${idx + 1}`,
      bytes: compressedPng,
      url: bytesToDataUrl(compressedPng),
      width,
      height,
      variantNo: null,
      fileIndex: page.fileIndex
    };
  });

  state.extractedSelections = (await Promise.all(tasks)).filter(Boolean);
  state.availableSelectionIds = new Set(state.extractedSelections.map((selection) => selection.id));
}
