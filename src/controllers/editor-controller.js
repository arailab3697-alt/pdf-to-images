import { dom } from '../dom.js';
import { FILE_DESCRIPTIONS, FILE_NAMES, MIME_TYPES, UI_MESSAGES } from '../constants.js';
import { exportEditedPdf } from '../editor-mode.js';
import { saveBlob } from '../services/file-save.js';
import { setSelectModeUI } from '../ui.js';

export function registerEditorEvents() {
  dom.backToSelectBtn.addEventListener('click', () => {
    setSelectModeUI();
  });

  dom.exportPdfBtn.addEventListener('click', async () => {
    const blob = await exportEditedPdf();
    await saveBlob(blob, FILE_NAMES.EDITED_PDF, MIME_TYPES.PDF, FILE_DESCRIPTIONS.PDF, UI_MESSAGES.saveCanceledOrError);
  });
}
