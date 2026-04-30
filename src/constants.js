export const DPI_SCALE = 3;
export const MIN_DIST = 20;
export const OXIPNG_MAX_LEVEL = 6;
export const PNGQUANT_SPEED = 1;
export const PNGQUANT_MAX_COLORS = 16;
export const A4_WIDTH_PT = 595;
export const A4_HEIGHT_PT = 842;

export const FILE_NAMES = {
  SELECTIONS_ZIP: 'selections.zip',
  EDITED_PDF: 'edited.pdf'
};

export const MIME_TYPES = {
  ZIP: 'application/zip',
  PDF: 'application/pdf'
};

export const FILE_DESCRIPTIONS = {
  ZIP: 'ZIP file',
  PDF: 'PDF file'
};

export const UI_MESSAGES = {
  fileAlreadySelected: 'すでにファイルが選択されています。新しいファイルを選ぶと最初のモード（範囲選択）に戻ります。',
  noSelectionForExport: '画像化する範囲が選択されていません。先に赤枠で範囲を選択してください。',
  noSelectionForPdfMode: '先に範囲選択を作成してください。',
  busyExportZip: '画像を圧縮して書き出し中です。完了までお待ちください…',
  busyToPdfMode: '画像を圧縮してPDF編集画面へ移行中です。しばらくお待ちください…',
  saveCanceledOrError: '保存キャンセルまたはエラー:'
};
