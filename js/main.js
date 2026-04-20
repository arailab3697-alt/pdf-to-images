import { dom } from './dom.js';
import { state } from './state.js';
import { setPdfEditModeUI, setSelectModeUI, showBusy, hideBusy } from './ui.js';
import { buildSelectionsFromOverlays, exportSelectionsToZip, loadPdfFile, setupSelectionEvents } from './selection-mode.js';
import { applyZoom, exportEditedPdf, renderSelectionPanel, setupEditorEvents, setupInitialEditorPages } from './editor-mode.js';

pdfjsLib.GlobalWorkerOptions.workerSrc =
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

function downloadBlob(blob, filename) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
}

async function saveBlob(blob, suggestedName, mime, description) {
  if (window.showSaveFilePicker) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName,
        types: [{ description, accept: { [mime]: [`.${suggestedName.split('.').pop()}`] } }]
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return;
    } catch (err) {
      console.log('保存キャンセルまたはエラー:', err);
      return;
    }
  }

  downloadBlob(blob, suggestedName);
}

dom.fileInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  await loadPdfFile(file);
});

dom.fileInput.addEventListener('click', () => {
  if (state.pages.length > 0) {
    alert('すでにファイルが選択されています。新しいファイルを選ぶと最初のモード（範囲選択）に戻ります。');
  }
});

dom.exportBtn.addEventListener('click', async () => {
  if (state.overlays.length === 0) {
    alert('画像化する範囲が選択されていません。先に赤枠で範囲を選択してください。');
    return;
  }

  showBusy('画像を圧縮して書き出し中です。完了までお待ちください…');
  try {
    const blob = await exportSelectionsToZip();
    await saveBlob(blob, 'selections.zip', 'application/zip', 'ZIP file');
  } finally {
    hideBusy();
  }
});

dom.backToSelectBtn.addEventListener('click', () => {
  setSelectModeUI();
});

dom.toPdfModeBtn.addEventListener('click', async () => {
  if (state.overlays.length === 0) {
    alert('先に範囲選択を作成してください。');
    return;
  }

  showBusy('画像を圧縮してPDF編集画面へ移行中です。しばらくお待ちください…');
  try {
    await buildSelectionsFromOverlays();
    renderSelectionPanel();
    setupInitialEditorPages();
    applyZoom();
    setPdfEditModeUI();
  } finally {
    hideBusy();
  }
});

dom.exportPdfBtn.addEventListener('click', async () => {
  const blob = await exportEditedPdf();
  await saveBlob(blob, 'edited.pdf', 'application/pdf', 'PDF file');
});

setupSelectionEvents();
setupEditorEvents();
setSelectModeUI();
