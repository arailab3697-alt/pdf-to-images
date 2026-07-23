# 現行機能を固めるための安定化アーキテクチャ実装案

## 1. 前提とゴール

本ドキュメントは、現行の `pdf-to-images` が提供している次の機能セットを大きく増やさず、バグを混入させにくい構造へ段階的に移行するための実装案です。

- 複数 PDF の読み込みとページ表示
- PDF ページ上での切り出し範囲作成・編集・削除
- 選択範囲の PNG 圧縮と ZIP 書き出し
- 切り出し画像の A4 ページ配置、移動、リサイズ、複製、重なり順調整
- 配置済み画像の縁取り生成と PDF 書き出し

ゴールは「新機能の追加」ではなく、以下を優先します。

1. DOM とアプリケーション状態の二重管理を減らす。
2. PDF 座標、画面座標、画像ピクセル座標の変換を一箇所に集約する。
3. 非同期処理（PDF 読み込み、圧縮、保存、Worker 通信）の失敗経路を明示する。
4. テスト対象を UI 操作から切り離し、純粋関数・ユースケース単位で検証できるようにする。

## 2. 現状でバグが入りやすい箇所

### 2.1 DOM が事実上のデータストアになっている

現行実装では、選択範囲や配置画像の `left` / `top` / `width` / `height` / `dataset` / `zIndex` を DOM から読み直す処理が複数箇所にあります。これは表示と状態がずれたときに検知しにくく、エクスポート結果だけが壊れるタイプの不具合につながります。

### 2.2 座標系の責務が分散している

PDF レンダリングキャンバス、表示サイズ、切り出しキャンバス、A4 ページ座標、PDF 座標への変換が各関数に分散しています。特にズームやページ表示サイズの変更が絡むと、修正箇所の漏れが起きやすくなります。

### 2.3 状態更新の入口が多い

`state` を各モジュールが直接変更しているため、例えば「配置画像を削除したら未配置リストへ戻す」「範囲を編集したら圧縮キャッシュを破棄する」といった副作用の漏れが起こりやすい構造です。

### 2.4 非同期ジョブの寿命管理が暗黙的

圧縮キャッシュには `version` による古い結果の破棄がありますが、PDF 読み込み中のファイル切り替えや、画面遷移時のキャンセル境界はまだ明文化されていません。

## 3. 推奨アーキテクチャ

小規模なブラウザ専用ツールとしては、フレームワークを大きく入れ替えるよりも、まず **TypeScript + 明示的なドメイン層 + reducer 形式の状態更新** に寄せる構成が最も費用対効果が高いです。

```text
src/
  app/
    store.ts              # 単一の状態更新入口。dispatch(action) のみ公開
    actions.ts            # ユーザー操作・非同期完了イベントの型
    selectors.ts          # UI 描画・エクスポートが参照する派生データ
  domain/
    document.ts           # PDF ファイル、ページ、選択範囲の型
    layout.ts             # A4 ページ、配置画像、z-order の型
    geometry.ts           # Rect、Point、座標変換、clamp、union outline
    export-plan.ts        # ZIP/PDF 書き出し前の純粋な計画データ生成
  services/
    pdf-renderer.ts       # pdf.js の薄いラッパー
    image-compressor.ts   # Worker 圧縮 API
    file-save.ts          # 保存 API
  ui/
    selection-view.ts     # 選択モードの DOM 描画・イベント接続
    editor-view.ts        # 編集モードの DOM 描画・イベント接続
    dom.ts                # DOM 参照
  workers/
    compression-worker.ts
    compression-core.ts
```

ポイントは、React などを必須にせず、現行 Vite 構成のまま段階的に移行できることです。UI は引き続き素の DOM 操作でも構いませんが、DOM は「状態を表示するための投影先」に限定します。

## 4. 技術スタック案

### 4.1 最小変更で安定化する推奨スタック

- **言語**: JavaScript から TypeScript へ段階移行
- **ビルド**: Vite 継続
- **テスト**: Vitest 継続、`jsdom` 追加を検討
- **状態管理**: 外部ライブラリなしの reducer + action
- **スキーマ検証**: `zod` などは保存形式や将来の永続化が必要になるまで保留
- **UI**: 現行 DOM 実装を維持し、描画関数を `render(state)` へ寄せる

この構成なら、依存を増やしすぎず、型・純粋関数・状態遷移テストでバグを抑えられます。

### 4.2 将来的に UI が複雑化する場合の候補

画像配置、キーボードショートカット、Undo/Redo、ページテンプレートなどを増やすなら、以下を検討します。

- **Preact + Signals**: 軽量で Vite と相性がよく、DOM 再描画の事故を減らせる。
- **Svelte**: 状態と UI の対応が読みやすく、小規模アプリに向く。

ただし、現行機能で固める前提なら、まずはフレームワーク移行よりドメイン層分離を優先します。

## 5. 実装方針

### 5.1 状態を正規化する

DOM 要素参照を主データにせず、アプリ状態は ID と数値データで保持します。

```ts
type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type SelectionOverlay = {
  id: string;
  fileId: string;
  pageId: string;
  rectInViewPx: Rect;
  version: number;
};

type PlacedImage = {
  id: string;
  selectionId: string;
  editorPageId: string;
  rectInPagePx: Rect;
  zIndex: number;
  outlineExcluded: boolean;
};
```

DOM には `data-id` のみ持たせ、位置・サイズの真実は store 側に置きます。interact.js の drag/resize イベントは action を dispatch し、render が DOM を更新します。

### 5.2 状態更新を action に集約する

状態変更は直接代入ではなく、次のような action に閉じ込めます。

```ts
type AppAction =
  | { type: 'documents/loaded'; documents: LoadedDocument[] }
  | { type: 'selection/created'; pageId: string; rect: Rect }
  | { type: 'selection/updated'; id: string; rect: Rect }
  | { type: 'selection/deleted'; id: string }
  | { type: 'selection/compressed'; id: string; version: number; result: CompressedImage }
  | { type: 'editor/entered' }
  | { type: 'layout/placed'; selectionId: string; pageId: string; rect: Rect }
  | { type: 'layout/moved'; placedId: string; rect: Rect }
  | { type: 'layout/removed'; placedId: string }
  | { type: 'layout/outlineToggled'; placedId: string };
```

これにより、「選択範囲更新時は version を進めて圧縮キャッシュを無効化する」「配置削除時は選択画像を未配置リストへ戻す」といったルールを reducer で一元化できます。

### 5.3 座標変換を `domain/geometry.ts` に集約する

PDF 表示、切り出し、A4 配置、PDF 出力の変換をすべて関数化します。

```ts
export function viewRectToCanvasRect(rect: Rect, scale: Scale): Rect;
export function pagePxRectToPdfPtRect(rect: Rect, pageSizePx: Size, pageSizePt: Size): Rect;
export function clampRectToBounds(rect: Rect, bounds: Size): Rect;
export function normalizeDragRect(start: Point, current: Point): Rect;
```

UI イベント内では計算せず、イベント座標を `Point` として渡して domain 関数で正規化します。これにより、負方向ドラッグ、ゼロ幅、ページ外にはみ出す配置、ズーム倍率変更時の不具合を単体テストで捕捉できます。

### 5.4 ユースケース層を作る

UI の click handler から直接 ZIP/PDF を作らず、以下のようなユースケース関数に分けます。

```ts
export async function exportSelectionsUseCase(state: AppState, deps: ExportDeps): Promise<Blob>;
export async function enterEditorModeUseCase(state: AppState, deps: ExtractDeps): Promise<AppAction[]>;
export async function exportEditedPdfUseCase(state: AppState, deps: PdfExportDeps): Promise<Blob>;
```

handler は「入力検証」「Busy 表示」「use case 呼び出し」「結果保存」だけにします。これで UI なしのテストが書けます。

### 5.5 非同期ジョブにセッション ID を持たせる

PDF 読み込みや圧縮など、古い画面状態の結果があとから返る処理には `sessionId` を付けます。

```ts
type AsyncSession = {
  documentLoadId: number;
  compressionBatchId: number;
};
```

結果適用時に現在の `sessionId` と一致しない場合は破棄します。これにより、読み込み途中のファイル再選択やモード遷移後の圧縮完了による状態汚染を防げます。

## 6. 段階移行プラン

### Phase 1: テストしやすい純粋関数を切り出す

- `Rect` / `Point` / `Size` と座標変換関数を追加する。
- outline 計算と PDF 出力座標変換のテストを増やす。
- 既存 JavaScript のまま JSDoc 型を付け、後続の TypeScript 化に備える。

### Phase 2: store と reducer を導入する

- `state` 直接更新を reducer に移す。
- selection / editor の代表操作から action 化する。
- キャッシュ無効化、availableSelectionIds 更新、zIndex 更新を reducer 内の不変条件にする。

### Phase 3: DOM 依存を view 層に閉じ込める

- domain / app / services から `HTMLElement` 参照を排除する。
- DOM は `data-id` を介して state と対応付ける。
- render 関数は state の差分または全量から DOM を再構築する。

### Phase 4: TypeScript 化する

- `allowJs` で段階導入し、domain / app から `.ts` 化する。
- `strict` を最初から有効にし、UI 層だけ一時的に型緩和する。
- Worker メッセージの request / response 型を共有する。

### Phase 5: エクスポート境界を固める

- ZIP 書き出し前に `ExportSelection[]` を生成する。
- PDF 書き出し前に `PdfExportPlan` を生成する。
- Blob 生成処理は plan を入力にした deterministic な処理にする。

## 7. 優先して追加したいテスト

1. 負方向ドラッグが正規化されること。
2. 画面表示 px からキャンバス px への切り出し座標変換。
3. A4 ページ px から PDF pt への配置座標変換。
4. selection 更新時に version が進み、古い圧縮結果が採用されないこと。
5. 配置画像の削除で `availableSelectionIds` に戻ること。
6. zIndex 順に PDF へ描画されること。
7. outline 除外フラグが画面表示と PDF 出力の両方に反映されること。
8. Worker 圧縮失敗時に元 PNG へフォールバックすること。

## 8. 採用しないほうがよい選択肢

### 8.1 いきなり大きな SPA フレームワークへ移行する

現行機能の固定が目的なら、React などへの全面移行は差分が大きく、短期的にはバグの混入リスクが上がります。導入する場合も、domain / app 層の分離が終わってから UI 層だけ差し替えるべきです。

### 8.2 Canvas 上に全 UI を再実装する

ドラッグやリサイズの自由度は上がりますが、ヒットテスト、アクセシビリティ、テキスト、フォーカス、スクロール制御を自前実装する必要があり、現行規模では過剰です。

### 8.3 状態管理ライブラリを先に導入する

Redux や Zustand は有用ですが、まず必要なのは「状態更新ルールの集約」と「DOM を真実にしないこと」です。外部ライブラリは reducer の境界が明確になってからでも遅くありません。

## 9. 推奨結論

現行機能を固めるなら、最もバグりにくく移行コストも低い方針は次の組み合わせです。

1. **Vite は継続**する。
2. **TypeScript を段階導入**する。
3. **domain / app / services / ui / workers** に責務分離する。
4. **状態更新は reducer + action に集約**する。
5. **座標変換とエクスポート計画を純粋関数化**して Vitest で固める。
6. **DOM は state の投影先**にし、主要データは ID と数値で保持する。

この順序なら、現行の操作感や依存ライブラリを大きく変えずに、座標ずれ、キャッシュ不整合、非同期レース、DOM/state 不一致といった典型的な不具合を段階的に減らせます。
