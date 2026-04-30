# pdf-to-images

PDF から任意範囲を切り出して PNG として一括書き出しし、必要に応じて A4 レイアウトの PDF に再配置して書き出せるブラウザツールです。

## 主な機能

- 複数 PDF の同時読み込み（サイドバーでファイル単位に移動）
- PDF 上でドラッグして赤枠の切り出し範囲を作成
- 右クリックで範囲編集モードに切り替え（移動・リサイズ、Delete で削除）
- 選択範囲を PNG 圧縮して ZIP で一括エクスポート
- 切り出し画像を A4 ダミーページへドラッグ＆ドロップ配置
- 配置画像の拡大縮小・移動・重なり順調整・複製
- 編集後 PDF の書き出し

## 動作環境

- Node.js 18 以上推奨
- モダンブラウザ（Chrome / Edge 推奨）
  - `showSaveFilePicker` が使える場合は保存ダイアログを利用
  - 非対応ブラウザでは通常ダウンロードにフォールバック

## セットアップ

```bash
npm install
```

## 開発サーバー起動

```bash
npm run dev
```

起動後、Vite が表示する URL（通常 `http://localhost:5173`）を開いて利用します。

## ビルド

```bash
npm run build
```

成果物は `dist/` に出力されます。

## 使い方

### 1. PDF を読み込む

1. 「ファイルを選択」から 1 つ以上の PDF を選びます。
2. 各ページがビューアへ展開され、左側に PDF ファイル一覧が表示されます。

### 2. 範囲を選択する

1. PDF ページ上をドラッグして赤枠を作成します。
2. 赤枠を右クリックすると編集モードになり、移動・リサイズできます。
3. 編集中に `Delete` キーで赤枠を削除できます。

### 3-A. 画像（ZIP）として書き出す

1. 「すべて画像化」をクリックします。
2. 選択範囲が PNG 圧縮され、`selections.zip` として保存されます。

### 3-B. PDF レイアウト編集へ進む

1. 「pdf化」をクリックします。
2. 切り出し画像一覧からページへドラッグ＆ドロップで配置します。
3. 画像をダブルクリックすると配置解除して一覧へ戻せます。
4. 「新しいページ」で A4 ページを追加できます。
5. 「書き出し」で `edited.pdf` を保存します。

## 操作メモ

- 範囲選択が 0 件の状態では書き出し処理は実行されません。
- 処理中は Busy Overlay が表示され、操作が一時的に無効化されます。
- PDF 編集モードではズームスライダーで表示倍率を変更できます（40〜200%）。

## 使用ライブラリ

- [Vite](https://vitejs.dev/)
- [pdf.js](https://mozilla.github.io/pdf.js/)
- [JSZip](https://stuk.github.io/jszip/)
- [interact.js](https://interactjs.io/)
- [pdf-lib](https://pdf-lib.js.org/)
- [@jsquash/oxipng](https://www.npmjs.com/package/@jsquash/oxipng)
- [@wasm-codecs/oxipng](https://www.npmjs.com/package/@wasm-codecs/oxipng)

## 補足

現状、UI 文言は日本語固定です。必要であれば i18n 化やショートカット一覧の整備を行ってください。
