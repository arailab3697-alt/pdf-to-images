export const state = {
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

export function resetDocumentState() {
  state.pages = [];
  state.overlays = [];
  state.extractedSelections = [];
  state.editorPages = [];
  state.placedOverlays = [];
  state.availableSelectionIds = new Set();
  state.placedOverlaySeq = 0;
  state.placedOverlayZSeq = 0;
  state.duplicatedSelectionSeq = 0;
  state.mode = 'draw';
  state.selectedOverlay = null;
  state.drawing = false;
  state.start = null;
  state.current = null;
  state.activeWrapper = null;
}
