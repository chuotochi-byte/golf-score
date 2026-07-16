# ゴルフスコア（golf-score）

4人用ゴルフラウンドのスコア管理アプリ。スコア入力、マッチ戦/チーム戦/オリンピック戦/ラスベガス戦の自動集計、ドーミー判定、PDF出力（4ページ）を行う、ビルド不要の単一ページアプリ（PWA対応）。

`golf_score_v2.html`（単一HTMLファイル、約2,800行）を Claude Code で編集しやすいように、HTML / CSS / JS をファイル分割したもの。**機能は元のファイルと完全に同一**（jsdomによる自動テストで計算結果が一致することを確認済み）。

## 動かし方

ビルド不要。ローカルサーバーで `index.html` を開くだけ（`file://` だと `<script src>` の相対パス読み込みがブラウザによってはブロックされるため、簡易サーバー推奨）。

```bash
python3 -m http.server 8000
# → http://localhost:8000/index.html
```

`manifest.json` / `icon-192.png` / `sw.js`（PWA関連ファイル）はこのリポジトリには含まれていない。既存プロジェクトに存在するものをこのディレクトリ直下に置けば動く。無くてもアプリ自体は動作する（PWAインストール・アイコン表示・オフライン対応が効かないだけ）。

## ディレクトリ構成

```
index.html              … HTML構造のみ（DOM要素定義）。スタイル・ロジックは含まない
css/
  base.css               … 基本スタイル（レイアウト・テーブル・フォーム・モーダル等）
  responsive.css          … @media (max-width:480px) のスマホ最適化スタイル
js/
  00-bootstrap.js          … <head>内で最初に読まれる。applyDormie() のグローバルラッパー等
  01-state.js               … state定義、localStorage保存/読込
  02-modal.js                … カスタムalert/confirmモーダル
  03-setup.js                 … 初期設定フォーム、メタ情報表示、入力サニタイズ
  04-table-builder.js          … スコア/オリンピック/ラスベガス表の行をDOM生成
  05a-calc-core.js               … マッチ戦/チーム戦判定、合計計算の基礎
  05b-calc-dormie.js               … ドーミー/アップドーミー判定
  05c-calc-vegas.js                 … ラスベガス自動計算、オリンピック合計
  06-render.js                       … recalcAll()（再計算の中心）、タブ切替、画面再描画
  07-pdf-export.js                    … PDF生成（canvas描画 → jsPDFで画像貼付）
  08-events.js                         … イベントリスナー登録、起動シーケンス
```

`js/` は **01〜08 の番号順に `<script>` で読み込む前提**（`index.html` 内のコメント参照）。ES Modulesではなく、全ファイルがグローバルスコープに関数・変数を定義する素朴な方式（元の単一ファイル実装を踏襲）。番号を入れ替えたり一部だけ読み込んだりすると `ReferenceError` になる。

## 編集時の勘どころ

- **状態は `state` オブジェクト1つ**（`js/01-state.js`）。`scores[hole][playerIndex]` のように4人固定・ホール番号(1-18)キーで持つ。変更したら必ず `save()` を呼ぶこと（localStorageへ二重保存）。
- スコア入力のたびに呼ばれるのが `recalcAll()`（`js/06-render.js`）。新しい集計項目を追加する場合は基本ここに足す。
- マッチ戦は「増 vs 幸」固定、チーム戦は「増+牛 vs 幸+M」固定（`js/05a-calc-core.js` の `matchSymbol` / `teamSymbolsByOrder`）。プレイヤー数や組み合わせを可変にする場合はこの2関数と `state.names` 周りの書き換えが必要。
- ラスベガス戦の打順は「前ホール成績順に2人1組を再編成する」方式（`js/05c-calc-vegas.js` の `calcVegasPoints`）。打順の初期値は `state.playOrderOUT` / `state.playOrderIN`（OUT/IN別管理）。
- OUT(1-9)とIN(10-18)は `state.viewHalf` で表示が切り替わるが、データ自体は18ホール分が常に保持される。OUT→IN初回切替時のみ `clearInHalfForSecondNine()`（`js/08-events.js`）がIN側の付随データ（バーディー等）を掃除する。
- PDF出力（`js/07-pdf-export.js`）は **canvas描画方式が現行**（`savePdf()`）。`buildPdfDom()` はHTML組み立て方式の旧実装で、現在のボタンからは呼ばれていない（未使用、互換性のため残置）。
- `calcNextHoleOrderWithTiebreak`（`js/08-events.js`）、`saveLocal`/`loadLocal`（`js/01-state.js`）、`exportPDF`（`js/00-bootstrap.js`）は元実装の時点で未使用（呼び出し元なし）。削除して問題ないはずだが、念のため元のまま残してある。

## 既知の制約

- ビルドツール・パッケージマネージャ未使用。TypeScript化やモジュールバンドラ導入は別途相談。
- jsPDFは `js/07-pdf-export.js` の `savePdf()` 内で `https://cdnjs.cloudflare.com/...` から動的ロードされる（オフライン環境ではPDF出力不可）。
