/**
 * 05a-calc-core.js
 * ------------------------------------------------------------
 * スコア集計の基礎となる共通ヘルパー群。
 * 「マッチ戦（増 vs 幸）」「チーム戦（増+牛 vs 幸+M）」の勝敗記号、
 * および各種合計（個人合計・OUT/IN小計）を計算する。
 *
 * 依存: 01-state.js
 * 公開するもの:
 *   - symWin / symLose / symTie  … 勝敗記号定数（〇 / × / —）
 *   - n(v)                        … 文字列→整数 or null への変換
 *   - getScore(hole, p)
 *   - setCellText(id, text) / setResultCell(id, text)
 *   - matchSymbol(hole)
 *   - teamSymbolsByOrder(order)
 *   - sumPlayerTotal()
 *   - sumRangeForPlayer(p, fromHole, toHole)
 *   - sumOutInForPlayer(p)
 *   - matchTeamSumsByRange(order, range)
 *   - calcSettlement(totals, unitPrice)
 *   - calcMatchSettlement(matchNet, winAmount) / calcTeamSettlement(teamNet, holePrice)
 *   - formatYen(v)
 * ------------------------------------------------------------
 */

const symWin = "〇";
const symLose = "×";
const symTie = "—";

/** 文字列/空値を整数に変換する。空・null・NaNは null を返す */
function n(v) {
  if (v === "" || v === null || v === undefined) return null;
  const x = parseInt(v, 10);
  return Number.isFinite(x) ? x : null;
}

/** 指定ホール・プレイヤーのスコア（打数）を取得する。未入力は null */
function getScore(hole, p) {
  const row = state.scores[hole];
  if (!row) return null;
  return n(row[p]);
}

function setCellText(id, text) {
  const node = el(id);
  if (node) node.textContent = (text === 0 ? "0" : (text || ""));
}

/** 勝敗記号セルにテキストと色分けクラス（resWin/resLose/resTie）を設定する */
function setResultCell(id, text) {
  const node = el(id);
  if (!node) return;
  node.textContent = (text === 0 ? "0" : (text || ""));
  node.classList.remove("resWin", "resLose", "resTie");
  if (text === symWin) node.classList.add("resWin");
  else if (text === symLose) node.classList.add("resLose");
  else if (text === symTie) node.classList.add("resTie");
}

/** マッチ戦（増 vs 幸）の勝敗記号を返す。スコアが小さい方が勝ち（〇） */
function matchSymbol(hole) {
  const a = getScore(hole, 0);
  const b = getScore(hole, 1);
  if (a === null || b === null) return "";
  if (a < b) return symWin;
  if (a > b) return symLose;
  return symTie;
}

/**
 * チーム戦（増+牛 vs 幸+M）の勝敗記号をホール単位で返す。
 * teamHandicap[hole] が true のとき、幸+M側の合計から -1 する。
 * 同点（—）が連続した場合、次に決着がついたホールの結果を
 * 同点だった全ホールに遡って適用する（プレッシャー方式）。
 * @returns {Object<number,string>} hole -> symWin/symLose/symTie/""
 */
function teamSymbolsByOrder(order) {
  const out = {};
  let pending = [];
  for (const hole of order) {
    const a1 = getScore(hole, 0), a2 = getScore(hole, 2);
    const b1 = getScore(hole, 1), b2 = getScore(hole, 3);
    if ([a1, a2, b1, b2].some(x => x === null)) {
      out[hole] = "";
      continue;
    }
    const A = a1 + a2;
    let B = b1 + b2;
    if (state.teamHandicap && state.teamHandicap[hole]) B = B - 1;
    if (A === B) {
      out[hole] = symTie;
      pending.push(hole);
    } else {
      const res = (A < B) ? symWin : symLose;
      out[hole] = res;
      if (pending.length) {
        for (const ph of pending) out[ph] = res;
        pending = [];
      }
    }
  }
  return out;
}

/** 全18ホールの個人合計（4人分）を返す。1つも入力が無ければ [0,0,0,0] */
function sumPlayerTotal() {
  const totals = [0, 0, 0, 0];
  let any = false;
  for (let h = 1; h <= 18; h++) {
    for (let p = 0; p < 4; p++) {
      const v = getScore(h, p);
      if (v !== null) {
        totals[p] += v;
        any = true;
      }
    }
  }
  return any ? totals : [0, 0, 0, 0];
}

/** 指定範囲のホールにおける1人分の合計を返す。未入力のみなら空文字 */
function sumRangeForPlayer(p, fromHole, toHole) {
  let s = 0;
  let any = false;
  for (let h = fromHole; h <= toHole; h++) {
    const v = getScore(h, p);
    if (v !== null) { s += v; any = true; }
  }
  return any ? s : "";
}

/** 1人分のOUT/IN/合計をまとめて返す */
function sumOutInForPlayer(p) {
  const out = sumRangeForPlayer(p, 1, 9) || 0;
  const inn = sumRangeForPlayer(p, 10, 18) || 0;
  return { out, inn, total: out + inn };
}

/**
 * 指定範囲のホールにおけるマッチ戦・チーム戦の勝敗差（勝ち-負け）を計算する。
 * @param {number[]} order - ホール巡回順
 * @param {{from:number,to:number}} range - 集計するホール番号の範囲
 */
function matchTeamSumsByRange(order, range) {
  let mW = 0, mL = 0, tW = 0, tL = 0;
  const teamMap = teamSymbolsByOrder(order);
  for (const hole of order) {
    if (hole < range.from || hole > range.to) continue;
    const m = matchSymbol(hole);
    if (m === symWin) mW++;
    if (m === symLose) mL++;
    const t = teamMap[hole] || "";
    if (t === symWin) tW++;
    if (t === symLose) tL++;
  }
  return { match: (mW - mL), team: (tW - tL), teamMap };
}

/**
 * 得点配列（4人分）と1点あたり単価から精算金額を計算する。
 * 精算額 = (自分の得点 − 全員の平均得点) × 単価 なので、4人分の合計は必ず0になる。
 * 単価未設定、またはデータが1つも無ければ [null,null,null,null] を返す。
 */
function calcSettlement(totals, unitPrice) {
  const any = totals.some(v => v !== "" && v !== null && v !== undefined);
  if (!any || !unitPrice) return [null, null, null, null];
  const nums = totals.map(v => (v === "" || v === null || v === undefined) ? 0 : v);
  const avg = nums.reduce((a, b) => a + b, 0) / 4;
  return nums.map(v => Math.round((v - avg) * unitPrice));
}

/** 精算金額を "+1,500円" 等の表記にする（nullや空文字は空文字を返す） */
function formatYen(v) {
  if (v === null || v === undefined || v === "") return "";
  if (v === 0) return "0円";
  const sign = v > 0 ? "+" : "-";
  return `${sign}${Math.abs(v).toLocaleString("ja-JP")}円`;
}

/**
 * マッチ戦（増vs幸）の精算金額配列[4]を返す。勝った方に+winAmount、負けた方に-winAmount。
 * 牛・Mは対象外（常に0）。引き分け、または金額未設定なら全員0。
 */
function calcMatchSettlement(matchNet, winAmount) {
  const amt = [0, 0, 0, 0];
  if (!winAmount || matchNet === 0) return amt;
  const w = matchNet > 0 ? winAmount : -winAmount;
  amt[0] = w;
  amt[1] = -w;
  return amt;
}

/**
 * チーム戦（増+牛 vs 幸+M）の精算金額配列[4]を返す。
 * 勝ち越しホール数 × 1ホールあたり単価 を、勝ったチームの2人で山分けする
 * （例: 増+牛が2ホールUP、単価1000円 → 増+1000円・牛+1000円、幸-1000円・M-1000円）。
 * 単価未設定、または勝敗なし(0)なら全員0。
 */
function calcTeamSettlement(teamNet, holePrice) {
  const amt = [0, 0, 0, 0];
  if (!holePrice || teamNet === 0) return amt;
  const perPerson = Math.round(Math.abs(teamNet) * holePrice / 2);
  const sign = teamNet > 0 ? 1 : -1;
  amt[0] = sign * perPerson;  // 増
  amt[2] = sign * perPerson;  // 牛
  amt[1] = -sign * perPerson; // 幸
  amt[3] = -sign * perPerson; // M
  return amt;
}
