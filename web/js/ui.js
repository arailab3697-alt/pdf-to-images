import { dom } from './dom.js';
import { state } from './state.js';

function setControlsDisabled(disabled) {
  const controls = [
    dom.fileInput,
    dom.exportBtn,
    dom.toPdfModeBtn,
    dom.backToSelectBtn,
    dom.exportPdfBtn,
    dom.zoomRange,
    dom.addPageBtn,
    dom.prevPageBtn,
    dom.nextPageBtn
  ];

  controls.forEach((el) => {
    if (el) el.disabled = disabled;
  });
}

export function showBusy(message = '圧縮中です。しばらくお待ちください…') {
  state.busyCount += 1;
  dom.busyMessage.textContent = message;
  dom.busyOverlay.classList.add('active');
  dom.busyOverlay.setAttribute('aria-busy', 'true');
  document.body.style.overflow = 'hidden';
  setControlsDisabled(true);
}

export function hideBusy() {
  state.busyCount = Math.max(0, state.busyCount - 1);
  if (state.busyCount > 0) return;
  dom.busyOverlay.classList.remove('active');
  dom.busyOverlay.setAttribute('aria-busy', 'false');
  document.body.style.overflow = '';
  setControlsDisabled(false);
}

export function setSelectModeUI() {
  dom.viewer.style.display = 'block';
  dom.editorRoot.style.display = 'none';
  dom.exportBtn.style.display = 'inline-block';
  dom.toPdfModeBtn.style.display = 'inline-block';
  dom.backToSelectBtn.style.display = 'none';
  dom.exportPdfBtn.style.display = 'none';
}

export function setPdfEditModeUI() {
  dom.viewer.style.display = 'none';
  dom.editorRoot.style.display = 'flex';
  dom.exportBtn.style.display = 'none';
  dom.toPdfModeBtn.style.display = 'none';
  dom.backToSelectBtn.style.display = 'inline-block';
  dom.exportPdfBtn.style.display = 'inline-block';
}
