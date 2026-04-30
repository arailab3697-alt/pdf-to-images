import { setSelectModeUI } from './ui.js';
import { setupSelectionEvents } from './selection-mode.js';
import { setupEditorEvents } from './editor-mode.js';
import { registerSelectEvents } from './controllers/select-controller.js';
import { registerEditorEvents } from './controllers/editor-controller.js';

pdfjsLib.GlobalWorkerOptions.workerSrc =
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

function registerGlobalEvents() {
  registerSelectEvents();
  registerEditorEvents();
  setupSelectionEvents();
  setupEditorEvents();
}

registerGlobalEvents();
setSelectModeUI();
