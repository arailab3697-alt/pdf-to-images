import { dom } from '../dom.js';
import { state } from '../state.js';
import { FILE_DESCRIPTIONS, FILE_NAMES, MIME_TYPES, UI_MESSAGES } from '../constants.js';
import { buildSelectionsFromOverlays, exportSelectionsToZip, loadPdfFile } from '../selection-mode.js';
import { applyZoom, renderSelectionPanel, setupInitialEditorPages } from '../editor-mode.js';
import { saveBlob } from '../services/file-save.js';
import { withBusy } from '../services/busy.js';
import { notifyError } from '../services/error-handler.js';
import { setPdfEditModeUI } from '../ui.js';

export function registerSelectEvents() {
  dom.fileInput.addEventListener('change', async (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
      await loadPdfFile(files);
    }
  });

  dom.fileInput.addEventListener('click', () => {
    if (state.pages.length > 0) {
      notifyError(UI_MESSAGES.fileAlreadySelected);
    }
  });

  dom.exportBtn.addEventListener('click', async () => {
    if (state.overlays.length === 0) {
      notifyError(UI_MESSAGES.noSelectionForExport);
      return;
    }

    await withBusy(UI_MESSAGES.busyExportZip, async () => {
      const blob = await exportSelectionsToZip();
      await saveBlob(
        blob,
        FILE_NAMES.SELECTIONS_ZIP,
        MIME_TYPES.ZIP,
        FILE_DESCRIPTIONS.ZIP,
        UI_MESSAGES.saveCanceledOrError
      );
    });
  });

  dom.toPdfModeBtn.addEventListener('click', async () => {
    if (state.overlays.length === 0) {
      notifyError(UI_MESSAGES.noSelectionForPdfMode);
      return;
    }

    await withBusy(UI_MESSAGES.busyToPdfMode, async () => {
      await buildSelectionsFromOverlays();
      renderSelectionPanel();
      setupInitialEditorPages();
      applyZoom();
      setPdfEditModeUI();
    });
  });
}
