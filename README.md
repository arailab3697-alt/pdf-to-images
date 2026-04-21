# pdf-to-images

ブラウザ上でPDFを読み込み、範囲選択した領域をPNG画像としてまとめてZIP保存できるシンプルなツールです。

## 主な機能

- PDFファイルをブラウザで表示
- ドラッグで切り抜き範囲（矩形）を作成
- 右クリックで範囲を選択し、移動・リサイズ
- `Delete`キーで選択中の範囲を削除
- すべての選択範囲をPNGとしてZIP出力
- PNG出力時にWASM版pngquant（16色）→ oxipng の順で圧縮
- ツールバーは画面上部にスティッキー表示

## 使い方

1. `index.html` をブラウザで開きます。
2. 画面上部のファイル選択からPDFを読み込みます。
3. PDF上でドラッグして範囲を作成します。
4. 範囲上で右クリックすると編集モードになり、移動やサイズ変更ができます。
5. 不要な範囲は選択後に `Delete` キーで削除します。
6. 「すべて画像化」ボタンでZIPファイルとして保存します。

## 動作要件

- モダンブラウザ（Chrome / Edge など）
- インターネット接続（CDNから以下ライブラリを読み込むため）
  - pdf.js
  - JSZip
  - interact.js

## 注意事項

- PDFのページは高解像度化のため内部的に拡大レンダリングされます。
- `showSaveFilePicker` が利用できないブラウザでは、ダウンロードリンク方式で保存します。
- このプロジェクトは単一HTMLファイル構成のため、ローカルで手軽に動かせます。

## CI / デプロイ

- `.github/workflows/deploy-oxipng-binary.yml` で `oxipng-wasm@0.1.0` のJS/WASMバイナリを取得し、
  - Actions Artifact (`oxipng-wasm-binary`)
  - GitHub Pages
  にデプロイできます。
