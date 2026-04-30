export const state = {
  files: [], // { name, numPages }
  activeFileIndex: 0,
  pages: [],
  overlays: [],
  extractedSelections: [],
  editorPages: [],
  placedOverlays: [],
  availableSelectionIds: new Set(),
  placedOverlaySeq: 0,
  placedOverlayZSeq: 0,
  duplicatedSelectionSeq: 0,
  mode: 'draw',
  selectedOverlay: null,
  drawing: false,
  start: null,
  current: null,
  activeWrapper: null,
  busyCount: 0
};

export function resetSelectionState() {
  state.overlays = [];
  state.mode = 'draw';
  state.selectedOverlay = null;
  state.drawing = false;
  state.start = null;
  state.current = null;
  state.activeWrapper = null;
}

export function resetEditorState() {
  state.extractedSelections = [];
  state.editorPages = [];
  state.placedOverlays = [];
  state.availableSelectionIds = new Set();
  state.placedOverlaySeq = 0;
  state.placedOverlayZSeq = 0;
  state.duplicatedSelectionSeq = 0;
}

export function resetDocumentState() {
  state.files = [];
  state.activeFileIndex = 0;
  state.pages = [];
  resetSelectionState();
  resetEditorState();
}
