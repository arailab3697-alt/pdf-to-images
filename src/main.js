import { setSelectModeUI } from './ui.js';
import { setupSelectionEvents } from './selection-mode.js';
import { setupEditorEvents } from './editor-mode.js';
import { registerSelectEvents } from './controllers/select-controller.js';
import { registerEditorEvents } from './controllers/editor-controller.js';

pdfjsLib.GlobalWorkerOptions.workerSrc =
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

function registerGlobalEvents() {
  const disposers = [
    registerSelectEvents(),
    registerEditorEvents(),
    setupSelectionEvents(),
    setupEditorEvents()
  ].filter(Boolean);

  return () => {
    disposers.forEach((dispose) => dispose());
  };
}

window.__disposeGlobalEvents?.();
window.__disposeGlobalEvents = registerGlobalEvents();
setSelectModeUI();
