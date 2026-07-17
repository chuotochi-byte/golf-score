/**
 * 01-state.js
 * ------------------------------------------------------------
 * アプリ全体の状態（state）と localStorage への保存/読込を担当。
 * 他の全 js ファイルはこのファイルの後に読み込まれる前提で、
 * グローバルスコープに公開された `state` / `el` / `save` / `load` などを使う。
 *
 * 依存: なし（最初に読み込むファイル）
 * 公開するもの:
 *   - el(id)               : document.getElementById の短縮形
 *   - state                : アプリの状態オブジェクト（直接書き換える）
 *   - orderOUT              : [1..18] の固定配列（ホール巡回順の基準）
 *   - holeLabel(h)
 *   - save() / load()
 *   - resetAll()
 *   - COURSE_PARS           : コース名 → 18ホール分PAR配列 の対応表
 *   - getParForHole(hole)   : Hole1-9はstate.courseOUT、Hole10-18はstate.courseINのPARを返す（未設定はnull）
 *   - parDiffText(score, hole) : スコアとPARの差分表記（ー / (+1) / (+2) / (-1) 等）を返す
 *   - circledPar(par)      : PARの丸数字表記（③④⑤等）を返す
 *   - getParSumForPlayedHoles(p, fromHole, toHole) : 実際にスコア入力済みのホールだけのPAR合計
 *   - totalDiffText(p, total, fromHole, toHole)
 *   - formatTotalWithDiff(p, total, fromHole, toHole) : 合計/小計セルに表示するHTML（数値+PAR差分）を返す
 * ------------------------------------------------------------
 */

// localStorageキー（2種類: 新キー優先、旧キーは後方互換のため読み込み時に参照）
const LS_KEY = "golf_roster_v4";
const SAVE_KEY = "golf_score_app_state_v1";

const el = (id) => document.getElementById(id);

/**
 * saveLocal() / loadLocal() は現状どこからも呼ばれていない未使用関数
 * （実際の保存/読込は save() / load() が担う）。元実装のまま保持。
 */
function saveLocal() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  } catch (e) { }
}

function loadLocal() {
  try {
    const s = localStorage.getItem(SAVE_KEY);
    if (!s) return;
    const obj = JSON.parse(s);
    if (obj && typeof obj === "object") {
      Object.assign(state, obj);
    }
  } catch (e) { }
}

/**
 * アプリの状態。1ラウンド分のスコア・打順・各種ゲーム設定を保持する。
 * scores[hole][playerIndex] のように 0-3 の4人固定で管理する。
 */
const state = {
  date: "",
  course: "",
  viewHalf: "OUT",
  names: ["増", "幸", "牛", "M"],
  playOrder: [null, null, null, null],    // 後方互換用（未使用）
  playOrderOUT: [null, null, null, null], // OUT用打順
  playOrderIN: [null, null, null, null],  // IN用打順
  scores: {},            // scores[hole][p] = "5"
  games: { olympic: {}, vegasOverride: {}, olyCb: {} }, // olympic[hole][p]="-15" 等, vegasOverride[hole][p]="+5" 等
  birdie: {},             // birdie[hole][p] = true/false
  eagle: {},              // eagle[hole][p] = true/false
  teamHandicap: {},       // teamHandicap[hole] = true  (幸&M -1)
  inSwitched: false,      // OUT→IN切替が一度でも行われたか
  activeOlyHole: null,    // 最後にオリンピックタブへジャンプしたHole番号
  courseNineOut: null,    // 27Hコース用：OUTで使うナイン名（例: "南"）
  courseNineIn: null,     // 27Hコース用：INで使うナイン名（例: "西"）
  olympicUnitPrice: "400", // オリンピック戦 1点あたりの金額（円）
  vegasUnitPrice: "50",    // ラスベガス戦 1点あたりの金額（円）
  matchWinAmount: "2000",  // マッチ戦 勝者の精算金額（円、負けた方はマイナス）
  teamHolePrice: "1000",   // チーム戦 1ホールあたりの精算単価（円）
  gamesEnabled: { olympic: true, vegas: true, match: true }, // ゲーム選択（false=タブ非表示）
};

// OUT基準のホール巡回順: Hole1..18固定
const orderOUT = Array.from({ length: 18 }, (_, i) => i + 1);

function holeLabel(h) {
  return String(h);
}

// コース名 → PAR情報
// 18Hコース: { out:[9値], in:[9値] }
// 27Hコース: { is27H:true, nines:{ "コース名":[9値], ... } }
const COURSE_PARS = {
  // ===== 18Hコース =====
  "やさと":            { out:[4,4,4,3,5,3,4,4,5], in:[4,5,4,3,4,4,3,4,5] },
  "江戸崎東":          { out:[5,3,4,4,4,3,4,5,4], in:[5,4,4,3,4,4,3,4,5] },
  "江戸崎南":          { out:[5,3,4,4,4,4,5,3,4], in:[3,4,4,5,4,3,4,5,4] },
  "グレンオークス":     { out:[4,4,4,5,3,4,4,3,5], in:[4,5,4,3,4,4,4,3,5] },
  "笠間カントリー":     { out:[4,3,5,4,3,4,4,5,4], in:[4,4,4,3,5,4,3,4,5] },
  "出島":              { out:[4,4,3,5,4,3,4,4,5], in:[5,4,3,4,5,4,3,4,4] },
  "オークヒルズ":       { out:[4,4,5,3,4,4,5,3,4], in:[5,3,4,4,3,4,5,4,4] },
  "阿見":              { out:[4,3,5,4,5,4,4,3,4], in:[4,3,4,5,4,4,3,4,5] },
  "ワンウェイ":         { out:[4,5,3,4,4,4,5,3,4], in:[4,4,4,3,5,4,4,3,5] },
  "サミット":           { out:[5,3,4,4,4,3,4,4,5], in:[4,3,5,4,4,4,3,4,5] },
  "霞台筑波":           { out:[4,4,4,4,5,3,5,3,4], in:[5,4,4,4,4,3,4,3,5] },
  "霞台霞":            { out:[4,4,3,4,4,5,4,3,5], in:[4,3,4,4,5,3,4,4,5] },
  "石岡ウエスト":       { out:[4,3,4,4,5,3,4,4,5], in:[5,3,4,4,4,4,4,3,5] },
  "オールドオーチャード": { out:[5,3,4,4,4,3,5,4,4], in:[4,4,3,4,4,5,4,3,5] },
  "おかだいら":         { out:[4,4,3,5,4,3,4,4,5], in:[4,5,4,3,5,4,4,3,4] },
  "イーグルレイク":     { out:[4,3,4,4,5,4,3,4,5], in:[4,4,3,4,4,5,4,3,5] },
  "成田ヒルズ":         { out:[4,5,4,3,4,4,4,3,5], in:[4,3,5,4,5,4,4,3,4] },
  "石岡":              { out:[4,5,4,3,5,4,4,3,4], in:[4,5,4,3,4,4,5,3,4] },
  "茨城ゴルフ": { is27H: true, nines: { "東":[5,3,4,4,4,3,4,4,5], "西":[4,4,4,3,4,5,4,3,5] } },
  "成田東":            { out:[4,4,5,3,4,4,5,4,3], in:[4,4,3,5,3,4,4,4,5] },
  "豊里":              { out:[4,4,4,3,4,3,5,4,5], in:[4,5,3,4,3,4,4,5,4] },
  "長太郎":            { out:[4,5,3,4,4,3,4,4,5], in:[5,4,3,4,4,3,4,4,5] },
  "マリア":            { out:[4,3,5,4,4,3,5,4,4], in:[5,3,4,4,5,4,4,3,4] },
  "サンヒルズ": { is27H: true, nines: { "イースト":[4,5,4,3,4,5,3,4,4], "ウエスト":[4,4,3,5,4,3,5,4,4] } },
  "南総": { is27H: true, nines: { "東前": [4,5,4,3,4,4,4,3,5], "東後": [4,5,4,3,4,4,5,3,4], "西前": [5,4,5,4,4,3,4,3,4], "西後": [5,4,3,4,4,5,3,4,4] } },
  "金乃台":            null,
  "京カントリー":       null,
  // ===== 27Hコース =====
  "土浦カントリー": {
    is27H: true,
    nines: {
      "西": [4,4,5,3,4,3,4,4,5],
      "東": [5,4,3,4,3,5,4,4,4],
      "南": [4,4,5,3,4,4,5,3,4],
    }
  },
  "富士カントリー笠間": {
    is27H: true,
    nines: {
      "西": [4,4,5,4,5,3,4,3,4],
      "南": [5,3,4,4,4,5,3,4,4],
      "東": [5,4,3,4,4,5,4,3,4],
    }
  },
  "笠間": {
    is27H: true,
    nines: {
      "東": [4,4,5,4,3,4,3,5,4],
      "南": [4,4,5,4,4,3,5,3,4],
      "西": [4,4,5,3,4,4,5,3,4],
    }
  },
  "東筑波": {
    is27H: true,
    nines: {
      "北": [4,4,3,4,5,4,3,4,5],
      "中": [4,5,4,3,4,4,5,3,4],
      "南": [4,4,5,4,3,4,3,4,5],
    }
  },
};

/** コース名からPAR情報を返す（未設定はnull） */
function getCoursePars(courseName) {
  return COURSE_PARS[courseName] || null;
}

/** 指定ホールのPARを返す。
 *  18Hコース: state.course の out/in 配列を参照
 *  27Hコース: state.courseNineOut / courseNineIn のナイン配列を参照 */
function getParForHole(hole) {
  const info = COURSE_PARS[state.course];
  if (!info) return null;
  if (info.is27H) {
    if (hole >= 1 && hole <= 9) {
      const nine = info.nines[state.courseNineOut];
      return nine ? (nine[hole - 1] ?? null) : null;
    }
    if (hole >= 10 && hole <= 18) {
      const nine = info.nines[state.courseNineIn];
      return nine ? (nine[hole - 10] ?? null) : null;
    }
    return null;
  }
  if (hole >= 1 && hole <= 9)   return info.out ? (info.out[hole - 1]  ?? null) : null;
  if (hole >= 10 && hole <= 18) return info.in  ? (info.in[hole - 10] ?? null) : null;
  return null;
}

// PARの丸数字表記（③④⑤等）
const CIRCLED_DIGITS = ["", "①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧", "⑨"];
function circledPar(par) {
  return CIRCLED_DIGITS[par] || "";
}

/** 差分の数値を表記に変換する（0: "ー" / 正: "(+n)" / 負: "(-n)"） */
function diffLabelFromDiff(diff) {
  if (diff === 0) return "ー";
  return diff > 0 ? `(+${diff})` : `(${diff})`;
}

/** スコアとPARの差分表記を返す（パー: "ー" / ボギー: "(+1)" / ダブルボギー: "(+2)" / バーディー: "(-1)" 等） */
function parDiffText(score, hole) {
  const par = getParForHole(hole);
  if (par == null) return "";
  const s = parseInt(score, 10);
  if (!Number.isFinite(s)) return "";
  return diffLabelFromDiff(s - par);
}

/**
 * 指定ホール範囲のうち、実際にスコアが入力されているホールだけのPAR合計を返す。
 * ラウンド途中（例: 9ホール中5ホールだけ入力済み）でも、対PARの差分が
 * 「まだ回っていない残りホール分」まで含んだ不自然な値にならないようにするため。
 * 対象コースでない場合、または該当ホールが1つも無い場合は null。
 */
function getParSumForPlayedHoles(p, fromHole, toHole) {
  let sum = 0;
  let any = false;
  for (let h = fromHole; h <= toHole; h++) {
    const score = state.scores[h]?.[p];
    if (score === "" || score === null || score === undefined) continue;
    const par = getParForHole(h);
    if (par == null) continue;
    sum += par;
    any = true;
  }
  return any ? sum : null;
}

/** 合計/小計と、実際に入力済みのホール分のPAR合計との差分表記を返す（対象コースでない・データが無ければ空文字） */
function totalDiffText(p, total, fromHole, toHole) {
  const parSum = getParSumForPlayedHoles(p, fromHole, toHole);
  if (parSum == null) return "";
  const t = parseInt(total, 10);
  if (!Number.isFinite(t)) return "";
  return diffLabelFromDiff(t - parSum);
}

/**
 * 合計/小計セルに表示するHTMLを組み立てる（数値 + PAR差分）。totalが空/0なら空文字。
 * PAR差分は数値の表示位置に影響しないよう絶対配置バッジ（.totalDiff）にする
 * （呼び出し側の td には .totalCell クラスが必要）。
 */
function formatTotalWithDiff(p, total, fromHole, toHole) {
  if (total === "" || total === null || total === undefined || total === 0) return "";
  const diff = totalDiffText(p, total, fromHole, toHole);
  return diff ? `${total}<span class="totalDiff">${diff}</span>` : `${total}`;
}

/** state を2つのキーへ二重に保存する（新旧互換のため） */
function save() {
  localStorage.setItem(LS_KEY, JSON.stringify(state));
  localStorage.setItem(SAVE_KEY, JSON.stringify(state));
}

/**
 * localStorage から state を読み込む。
 * SAVE_KEY を優先し、無ければ LS_KEY（旧バージョン）を見る。
 * @returns {boolean} 読み込めたかどうか
 */
function load() {
  let raw = localStorage.getItem(SAVE_KEY);
  if (!raw) raw = localStorage.getItem(LS_KEY);
  if (!raw) return false;
  try {
    Object.assign(state, JSON.parse(raw));
    if (!Array.isArray(state.playOrderOUT)) state.playOrderOUT = [null, null, null, null];
    if (!Array.isArray(state.playOrderIN))  state.playOrderIN  = [null, null, null, null];
    if (state.courseNineOut === undefined)  state.courseNineOut = null;
    if (state.courseNineIn  === undefined)  state.courseNineIn  = null;
    // 単価未設定（空欄）のまま保存された古いデータを補完する
    // （オリンピック/ラスベガスの単価にデフォルト値を導入する前に保存されたデータ向け）
    if (state.olympicUnitPrice === "" || state.olympicUnitPrice === "100") state.olympicUnitPrice = "400";
    if (state.vegasUnitPrice === "") state.vegasUnitPrice = "50";
    return true;
  } catch {
    return false;
  }
}

/** 全データを削除してリロードする（初期設定も含めて完全初期化） */
function resetAll() {
  localStorage.removeItem(LS_KEY);
  localStorage.removeItem(SAVE_KEY);
  location.reload();
}
