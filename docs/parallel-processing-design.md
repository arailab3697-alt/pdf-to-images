# 並列処理設計（画像圧縮パイプライン）

## 1. 目的

本ドキュメントは、`pdf-to-images` における PNG 圧縮処理の並列化（メインスレッドと Web Worker の分離）について、実装仕様と拡張方針を明文化するものです。

現行実装では、以下を狙っています。

- UI スレッド（メインスレッド）のブロッキング抑制
- 圧縮失敗時の安全なフォールバック
- 画像圧縮処理の再利用しやすい責務分離

## 2. スコープ

対象モジュールは次の 3 つです。

- `src/compression.js`（メインスレッド側のオーケストレーション）
- `src/workers/compression-worker.js`（Worker 側エントリ）
- `src/workers/compression-core.js`（純粋圧縮ロジック）

本設計は「圧縮処理の並列化」のみを対象とし、PDF 読み込み・選択領域の抽出・ZIP 化フロー全体の並列度制御は対象外です。

## 3. アーキテクチャ概要

```text
Main Thread (UI)
  └─ getCompressedPngBytes(canvas)
      ├─ canvas -> PNG Blob
      ├─ canvas -> RGBA (ImageData)
      └─ postMessage(payload, transfer)

Compression Worker
  └─ onmessage({ id, payload })
      ├─ quantize (libimagequant wasm)
      ├─ optimise (oxipng wasm)
      └─ postMessage({ id, ok, output }, transfer)
```

### 3.1 責務分離

- **メインスレッド**: UI と入出力整形、要求/応答の関連付け、フォールバック方針。
- **Worker**: CPU コストの高い圧縮処理（量子化 + 最適化）。
- **Core**: テスト容易性を高めるための副作用の少ない圧縮関数。

## 4. 並列処理モデル

## 4.1 実行単位

1 リクエスト（1 canvas）を 1 つの圧縮ジョブとして扱います。ジョブは一意の `id` を持ち、メインスレッドで `Map` によって Promise と対応付けます。

## 4.2 Worker インスタンス戦略

現行は **シングルトン Worker 1 本**です。

- 初回リクエスト時に `getCompressionWorker()` で生成。
- 以降は同一 Worker を再利用。
- 要求は `postMessage` で投入され、Worker 側イベントループで逐次処理されます。

### 4.3 メッセージプロトコル

#### Request

```ts
{
  id: string,
  payload: {
    pngBytes: ArrayBuffer,
    rgbaBytes: ArrayBuffer,
    width: number,
    height: number,
    maxColors: number,
    speed: number,
    oxipngLevel: number
  }
}
```

#### Response (成功)

```ts
{
  id: string,
  ok: true,
  output: Uint8Array
}
```

#### Response (失敗)

```ts
{
  id: string,
  ok: false,
  error: string
}
```

## 4.4 転送最適化（Transferable）

`pngBytes` / `rgbaBytes` / `output` は Transferable として受け渡し、コピーコストを抑制します。

- メイン → Worker: `postMessage(..., [payload.pngBytes, payload.rgbaBytes])`
- Worker → メイン: `postMessage(..., [output.buffer])`

これにより、大きな画像データをクローンする場合より GC 圧・メモリ帯域コストを抑えられます。

## 5. 圧縮パイプライン詳細

1. `canvas.toBlob('image/png')` で PNG ソースを生成。
2. `getImageData` で RGBA 生データを取得。
3. Worker で以下を実施。
   - `libimagequant` による減色（失敗しても継続）
   - `oxipng` による最適化（失敗時は減色済み/元 PNG を返却）

圧縮パイプラインの失敗は「非致命」とし、最終的に「元 PNG を返す」ことで UX を優先します。

## 6. エラー処理方針

## 6.1 局所エラー（Worker 内）

- 減色失敗: 例外を握りつぶして次工程へ。
- `optimise` 失敗: その時点の bytes を返却。

## 6.2 通信/Worker 障害

- Worker 側で未捕捉例外 → `ok: false` で返却。
- Worker 自体の `error` イベント発生時:
  - 保留中 Promise をすべて reject
  - `workerRequests` を clear

## 6.3 呼び出し元フォールバック

`getCompressedPngBytes()` は Worker 呼び出し失敗時に警告ログを出し、`pngBuffer`（非圧縮ソース）を返します。

## 7. 競合・整合性

- `id` 単位でレスポンスを突合するため、完了順が前後しても取り違えない。
- 不明 `id` のレスポンスは無視（重複応答・レースの防御）。
- 逐次番号 `workerRequestSeq` により同一プロセス内で一意性を担保。

## 8. パフォーマンス特性

## 8.1 強み

- UI スレッドから CPU 負荷を隔離できる。
- Transferable によりコピーコストを低減。
- Worker 再利用で起動オーバーヘッドを抑制。

## 8.2 ボトルネック

- Worker 1 本のため、同時多発時は内部的に直列実行。
- `toBlob` / `getImageData` はメインスレッドで実行される。
- 入力解像度が高いほどメモリピークが上がる。

## 9. 将来拡張（設計案）

## 9.1 Worker プール化

高スループットが必要な場合、`navigator.hardwareConcurrency` を上限目安に複数 Worker を持つ。

- 例: `poolSize = clamp(2, floor(hardwareConcurrency / 2), 4)`
- キュー + 空き Worker へディスパッチ
- フェアネスのため FIFO を基本

## 9.2 キャンセル

- `AbortController` を API に導入
- 送信前はキューから除去
- 実行中は「結果破棄」方式（Worker terminate/restart も選択肢）

## 9.3 バックプレッシャ

- キュー長が閾値を超えたら UI 側で投入を間引く。
- 進捗表示（`completed / total`）を明示して体感待ち時間を改善。

## 9.4 観測性

- 圧縮前後サイズ、処理時間、失敗率を計測。
- `performance.now()` ベースで工程別メトリクスを記録。
- デバッグモードでのみ詳細ログを出力。

## 10. テスト戦略

- `compression-core` は依存注入済みの純粋関数として単体テスト。
- 失敗系（quantize 例外、optimise 例外）をそれぞれ検証。
- Worker 統合テストでは `id` 対応と失敗時フォールバックを重視。

## 11. 運用上の注意

- Worker スクリプトは外部依存（`esm.sh`）を含むため、ネットワーク制限環境では減色が失敗し得ます（現行はフォールバックあり）。
- 長時間運用でのメモリ安定性を観測し、必要に応じて Worker の定期再生成を検討します。

## 12. まとめ

現行の並列処理は「**UI 応答性を最優先しつつ、失敗時も確実に成果物を返す**」ことに最適化された設計です。今後、処理件数増加が課題化した場合は、Worker プール・キャンセル・バックプレッシャの 3 点を優先的に導入する方針が妥当です。
