import { dom } from '../dom.js';
import { FILE_DESCRIPTIONS, FILE_NAMES, MIME_TYPES, UI_MESSAGES } from '../constants.js';
import { exportEditedPdf } from '../editor-mode.js';
import { saveBlob } from '../services/file-save.js';
import { setSelectModeUI } from '../ui.js';

export function registerEditorEvents() {
  const onBackToSelectClick = () => {
    setSelectModeUI();
  };

  const onExportPdfClick = async () => {
    const blob = await exportEditedPdf();
    await saveBlob(blob, FILE_NAMES.EDITED_PDF, MIME_TYPES.PDF, FILE_DESCRIPTIONS.PDF, UI_MESSAGES.saveCanceledOrError);
  };

  dom.backToSelectBtn.addEventListener('click', onBackToSelectClick);
  dom.exportPdfBtn.addEventListener('click', onExportPdfClick);

  return () => {
    dom.backToSelectBtn.removeEventListener('click', onBackToSelectClick);
    dom.exportPdfBtn.removeEventListener('click', onExportPdfClick);
  };
}
