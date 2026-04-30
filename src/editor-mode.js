import { A4_HEIGHT_PT, A4_WIDTH_PT } from './constants.js';
import { dom } from './dom.js';
import { state } from './state.js';

function enablePlacedInteract(el) {
  interact(el)
    .draggable({
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
      edges: { left: true, right: true, top: true, bottom: true },
      modifiers: [interact.modifiers.aspectRatio({ ratio: 'preserve' })],
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

export function renderSelectionPanel() {
  dom.selectionPanel.innerHTML = '';

  // 1. Render Tabs
  const tabsContainer = document.createElement('div');
  tabsContainer.className = 'selection-tabs';
  state.files.forEach((file, index) => {
    const tab = document.createElement('button');
    tab.className = `selection-tab ${state.activeFileIndex === index ? 'active' : ''}`;
    tab.textContent = file.name;
    tab.title = file.name;
    tab.addEventListener('click', () => {
      state.activeFileIndex = index;
      renderSelectionPanel();
    });
    tabsContainer.appendChild(tab);
  });
  dom.selectionPanel.appendChild(tabsContainer);

  // 2. Render Selections for active file
  const selectionsContainer = document.createElement('div');
  selectionsContainer.className = 'selection-list';

  const availableSelections = state.extractedSelections.filter(
    (selection) => state.availableSelectionIds.has(selection.id) && selection.fileIndex === state.activeFileIndex
  );

  if (availableSelections.length === 0) {
    const emptyMsg = document.createElement('div');
    emptyMsg.className = 'selection-empty-msg';
    emptyMsg.textContent = '未配置の画像はありません。';
    selectionsContainer.appendChild(emptyMsg);
  } else {
    availableSelections.forEach((selection) => {
      const item = document.createElement('div');
      item.className = 'selection-item';
      item.draggable = true;
      item.dataset.selectionId = selection.id;
      item.innerHTML = `
        <div class="selection-item-head">
          <div class="selection-item-name">${selection.name}</div>
          <button class="duplicate-btn" type="button" title="複製">+</button>
        </div>
        <img src="${selection.url}" alt="selection" />
      `;

      item.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/selection-id', selection.id);
      });

      item.querySelector('.duplicate-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        duplicateSelection(selection.id);
      });

      selectionsContainer.appendChild(item);
    });
  }
  dom.selectionPanel.appendChild(selectionsContainer);
}

function duplicateSelection(selectionId) {
  const source = state.extractedSelections.find((selection) => selection.id === selectionId);
  if (!source || !state.availableSelectionIds.has(source.id)) return;

  if (source.variantNo == null) {
    source.variantNo = 1;
    source.name = `${source.baseName}-1`;
  }

  const siblings = state.extractedSelections.filter((selection) => selection.baseName === source.baseName && selection.variantNo != null);
  const nextVariantNo = siblings.reduce((max, selection) => Math.max(max, selection.variantNo), 0) + 1;
  const duplicated = {
    id: `dup_${state.duplicatedSelectionSeq++}`,
    name: `${source.baseName}-${nextVariantNo}`,
    baseName: source.baseName,
    bytes: source.bytes,
    url: source.url,
    width: source.width,
    height: source.height,
    variantNo: nextVariantNo,
    fileIndex: source.fileIndex
  };

  const sourceIndex = state.extractedSelections.findIndex((selection) => selection.id === source.id);
  state.extractedSelections.splice(sourceIndex + 1, 0, duplicated);
  state.availableSelectionIds.add(duplicated.id);
  renderSelectionPanel();
}

function placeSelectionOnPage(selection, pageNo, x, y) {
  const el = document.createElement('div');
  el.className = 'placed-overlay';

  const initW = Math.max(60, Math.round(selection.width * 0.2));
  const initH = Math.max(40, Math.round(selection.height * 0.2));

  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  el.style.width = `${initW}px`;
  el.style.height = `${initH}px`;

  const placedId = `placed_${state.placedOverlaySeq++}`;
  const zIndex = ++state.placedOverlayZSeq;
  el.dataset.placedId = placedId;
  el.dataset.selectionId = selection.id;
  el.dataset.pageNo = String(pageNo);
  el.dataset.zIndex = String(zIndex);
  el.style.zIndex = String(zIndex);

  const img = document.createElement('img');
  img.src = selection.url;
  img.alt = 'overlay';
  el.appendChild(img);

  enablePlacedInteract(el);

  const item = { id: placedId, el, pageNo, selectionId: selection.id };
  state.placedOverlays.push(item);

  el.addEventListener('pointerdown', () => {
    const nextZ = ++state.placedOverlayZSeq;
    el.dataset.zIndex = String(nextZ);
    el.style.zIndex = String(nextZ);
  });

  el.addEventListener('dblclick', () => {
    el.remove();
    state.placedOverlays = state.placedOverlays.filter((overlay) => overlay !== item);
    state.availableSelectionIds.add(item.selectionId);
    renderSelectionPanel();
  });

  return item;
}

function createDummyPage() {
  const pageNo = state.editorPages.length + 1;
  const pageEl = document.createElement('div');
  pageEl.className = 'dummy-page';
  pageEl.dataset.pageNo = String(pageNo);
  pageEl.dataset.pageLabel = `ページ ${pageNo}`;

  const layer = document.createElement('div');
  layer.className = 'page-drop-layer';
  layer.addEventListener('dragover', (e) => e.preventDefault());
  layer.addEventListener('drop', (e) => {
    e.preventDefault();

    const selectionId = e.dataTransfer.getData('text/selection-id');
    if (!selectionId || !state.availableSelectionIds.has(selectionId)) return;

    const selection = state.extractedSelections.find((s) => s.id === selectionId);
    if (!selection) return;

    const rect = layer.getBoundingClientRect();
    const placed = placeSelectionOnPage(selection, pageNo, e.clientX - rect.left, e.clientY - rect.top);
    layer.appendChild(placed.el);
    state.availableSelectionIds.delete(selectionId);
    renderSelectionPanel();
  });

  pageEl.appendChild(layer);
  dom.dummyPdfInner.appendChild(pageEl);
  state.editorPages.push({ pageNo, el: pageEl, layer });
}

export function setupInitialEditorPages() {
  dom.dummyPdfInner.innerHTML = '';
  state.editorPages = [];
  state.placedOverlays = [];
  createDummyPage();
}

export function applyZoom() {
  const zoom = Number(dom.zoomRange.value) / 100;
  dom.dummyPdfInner.style.transform = `scale(${zoom})`;
}

function scrollToPage(delta) {
  if (state.editorPages.length === 0) return;

  const viewportRect = dom.dummyPdfViewport.getBoundingClientRect();
  const current = state.editorPages.find((page) => {
    const rect = page.el.getBoundingClientRect();
    return rect.top >= viewportRect.top - 20 && rect.top <= viewportRect.bottom;
  }) || state.editorPages[0];

  const targetNo = Math.max(1, Math.min(state.editorPages.length, current.pageNo + delta));
  const target = state.editorPages[targetNo - 1];
  if (target) {
    target.el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

export function setupEditorEvents() {
  const onZoomInput = () => applyZoom();
  const onAddPageClick = () => createDummyPage();
  const onPrevPageClick = () => scrollToPage(-1);
  const onNextPageClick = () => scrollToPage(1);

  dom.zoomRange.addEventListener('input', onZoomInput);
  dom.addPageBtn.addEventListener('click', onAddPageClick);
  dom.prevPageBtn.addEventListener('click', onPrevPageClick);
  dom.nextPageBtn.addEventListener('click', onNextPageClick);

  return () => {
    dom.zoomRange.removeEventListener('input', onZoomInput);
    dom.addPageBtn.removeEventListener('click', onAddPageClick);
    dom.prevPageBtn.removeEventListener('click', onPrevPageClick);
    dom.nextPageBtn.removeEventListener('click', onNextPageClick);
  };
}

export async function exportEditedPdf() {
  const pdfDoc = await PDFLib.PDFDocument.create();

  for (let i = 0; i < state.editorPages.length; i++) {
    pdfDoc.addPage([A4_WIDTH_PT, A4_HEIGHT_PT]);
  }

  const drawOrder = [...state.placedOverlays].sort((a, b) => {
    const az = Number(a.el.dataset.zIndex) || 0;
    const bz = Number(b.el.dataset.zIndex) || 0;
    return az - bz;
  });

  for (const item of drawOrder) {
    if (!item.el.isConnected) continue;

    const pageNo = Number(item.el.dataset.pageNo);
    const pageIndex = Math.max(0, pageNo - 1);
    const page = pdfDoc.getPage(pageIndex);
    const pageInfo = state.editorPages.find((editorPage) => editorPage.pageNo === pageNo);
    const selection = state.extractedSelections.find((s) => s.id === item.el.dataset.selectionId);
    if (!selection || !pageInfo) continue;

    const layerRect = pageInfo.layer.getBoundingClientRect();
    const xPx = parseFloat(item.el.style.left) || 0;
    const yPx = parseFloat(item.el.style.top) || 0;
    const wPx = parseFloat(item.el.style.width) || 0;
    const hPx = parseFloat(item.el.style.height) || 0;

    const scaleX = A4_WIDTH_PT / layerRect.width;
    const scaleY = A4_HEIGHT_PT / layerRect.height;

    const xPt = xPx * scaleX;
    const yPt = A4_HEIGHT_PT - (yPx * scaleY) - (hPx * scaleY);
    const wPt = wPx * scaleX;
    const hPt = hPx * scaleY;

    const image = await pdfDoc.embedPng(selection.bytes);
    page.drawImage(image, { x: xPt, y: yPt, width: wPt, height: hPt });
  }

  return new Blob([await pdfDoc.save()], { type: 'application/pdf' });
}
