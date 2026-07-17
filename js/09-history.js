/**
 * 09-history.js
 * ラウンド履歴の保存・一覧・統計・順位表を管理する。
 * データは localStorage キー "golf_history_v1" に JSON 配列で保存。
 * 各レコード: { id, date, course, nineOut, nineIn, names[4], out[4], in[4], total[4], tag }
 *
 * 依存: 01-state.js (state, el), 02-modal.js (modalConfirm, modalInput)
 * window.* として公開: setHistoryMode, onHistoryFilterChange, confirmDeleteRound
 */

const HIST_KEY  = "golf_history_v1";
let   _histMode = "list"; // "list" | "stats" | "rank"

// ===== データ読み書き =====

function loadHistory() {
  try {
    const raw = localStorage.getItem(HIST_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function _saveHistArr(arr) {
  try { localStorage.setItem(HIST_KEY, JSON.stringify(arr)); } catch {}
}

// 現在の state のスコアを合計して履歴に追加
function saveCurrentRound(tag) {
  const sum = (p, from, to) => {
    let s = 0;
    for (let h = from; h <= to; h++) {
      const v = parseInt((state.scores[h] || [])[p], 10);
      if (Number.isFinite(v)) s += v;
    }
    return s;
  };
  const outArr   = [0,1,2,3].map(p => sum(p, 1,  9));
  const inArr    = [0,1,2,3].map(p => sum(p, 10, 18));
  const totalArr = [0,1,2,3].map(p => outArr[p] + inArr[p]);

  const round = {
    id:      Date.now().toString(),
    date:    state.date    || "",
    course:  state.course  || "",
    nineOut: state.courseNineOut || null,
    nineIn:  state.courseNineIn  || null,
    names:   [...state.names],
    out:     outArr,
    in:      inArr,
    total:   totalArr,
    tag:     tag || "",
  };

  const hist = loadHistory();
  hist.unshift(round);
  if (hist.length > 300) hist.length = 300;
  _saveHistArr(hist);
  return round;
}

function deleteHistoryRound(id) {
  _saveHistArr(loadHistory().filter(r => r.id !== id));
  renderHistoryView();
}

// ===== UI 制御 =====

function setHistoryMode(mode) {
  _histMode = mode;
  ["list","stats","rank"].forEach(m => {
    const btn = el("hmBtn_" + m);
    if (btn) btn.classList.toggle("active", m === mode);
  });
  renderHistoryView();
}

function onHistoryFilterChange() {
  renderHistoryView();
}

// 履歴タブを開いたとき（switchTab から呼ばれる）
function initHistoryTab() {
  const hist    = loadHistory();
  const courses = [...new Set(hist.map(r => r.course).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "ja"));
  const filterEl = el("historyFilter");
  if (!filterEl) return;
  const cur = filterEl.value;
  filterEl.innerHTML =
    '<option value="">全コース</option>' +
    courses.map(c => `<option value="${c}"${c === cur ? " selected" : ""}>${c}</option>`).join("");
  renderHistoryView();
}

function renderHistoryView() {
  const filterEl = el("historyFilter");
  const filter   = filterEl ? filterEl.value : "";
  const hist     = loadHistory();
  const filtered = filter ? hist.filter(r => r.course === filter) : hist;

  if (_histMode === "stats") { _renderStats(filtered);  return; }
  if (_histMode === "rank")  { _renderRanking(filtered); return; }
  _renderList(filtered);
}

// ===== 一覧表示（自分＝player 0 のスコアのみ） =====

function _renderList(rounds) {
  const listEl = el("historyList");
  if (!listEl) return;
  if (rounds.length === 0) {
    listEl.innerHTML = '<div class="histEmpty">保存済みのラウンドがありません</div>';
    return;
  }
  listEl.innerHTML = rounds.map(r => {
    const label   = r.course + (r.nineOut ? `（${r.nineOut}/${r.nineIn}）` : "");
    const tagHtml = r.tag ? `<span class="histTag">${r.tag}</span>` : "";
    const myOut   = r.out[0]   || 0;
    const myIn    = r.in[0]    || 0;
    const myTotal = r.total[0] || 0;
    return `
<div class="histCard">
  <div class="histHead">
    <span class="histDate">${r.date}</span>
    <span class="histCourse">${label}</span>
    ${tagHtml}
    <button class="histDelBtn" onclick="confirmDeleteRound('${r.id}')">✕</button>
  </div>
  <div class="histMyScore">
    <span>OUT <b>${myOut || "—"}</b></span>
    <span>IN <b>${myIn || "—"}</b></span>
    <span>合計 <b>${myTotal || "—"}</b></span>
  </div>
</div>`;
  }).join("");
}

// ===== 統計表示（自分＝player 0 のみ） =====

function _renderStats(rounds) {
  const listEl = el("historyList");
  if (!listEl) return;
  if (rounds.length === 0) {
    listEl.innerHTML = '<div class="histEmpty">データがありません</div>';
    return;
  }
  const recent = rounds.slice(0, 10);

  const avg = (arr) => arr.length
    ? (arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1) : "—";
  const best = (arr) => arr.length ? Math.min(...arr) : "—";
  const filt = (arr) => arr.filter(v => v > 0);

  const rTots = filt(recent.map(r => r.total[0]));
  const rOuts = filt(recent.map(r => r.out[0]));
  const rIns  = filt(recent.map(r => r.in[0]));
  const aTots = filt(rounds.map(r => r.total[0]));
  const aOuts = filt(rounds.map(r => r.out[0]));
  const aIns  = filt(rounds.map(r => r.in[0]));

  listEl.innerHTML = `
<div class="histSubTitle">直近${recent.length}ラウンド平均 ／ 全${rounds.length}ラウンド（${aTots.length}回）</div>
<table class="histTable histWide">
  <thead><tr><th></th><th>平均</th><th>ベスト</th></tr></thead>
  <tbody>
    <tr><td>合計</td><td><b>${avg(rTots)}</b></td><td>${best(aTots)}</td></tr>
    <tr><td>OUT</td><td>${avg(rOuts)}</td><td>${best(aOuts)}</td></tr>
    <tr><td>IN</td><td>${avg(rIns)}</td><td>${best(aIns)}</td></tr>
  </tbody>
</table>`;
}

// ===== 順位表示 =====

function _renderRanking(rounds) {
  const listEl = el("historyList");
  if (!listEl) return;
  if (rounds.length === 0) {
    listEl.innerHTML = '<div class="histEmpty">データがありません</div>';
    return;
  }
  const names   = rounds[0].names;
  const players = [0,1,2,3]
    .map(p => {
      const tots = rounds.map(r => r.total[p]).filter(v => v > 0);
      const sum  = tots.reduce((a, b) => a + b, 0);
      const cnt  = tots.length;
      const avg  = cnt ? (sum / cnt).toFixed(1) : "—";
      return { name: names[p], sum, cnt, avg };
    })
    .filter(x => x.cnt > 0)
    .sort((a, b) => a.sum - b.sum);

  const rows = players.map((pl, i) =>
    `<tr><td style="text-align:center;font-weight:bold">${i + 1}</td>` +
    `<td>${pl.name}</td><td>${pl.sum}</td><td>${pl.avg}</td><td>${pl.cnt}</td></tr>`
  ).join("");
  listEl.innerHTML = `
<div class="histSubTitle">全${rounds.length}ラウンド累計成績</div>
<table class="histTable histWide">
  <thead><tr><th>順位</th><th>名前</th><th>合計</th><th>平均</th><th>回数</th></tr></thead>
  <tbody>${rows}</tbody>
</table>`;
}

// ===== グローバル公開 =====

function confirmDeleteRound(id) {
  modalConfirm("このラウンドを削除しますか？", () => deleteHistoryRound(id));
}

window.setHistoryMode        = setHistoryMode;
window.onHistoryFilterChange = onHistoryFilterChange;
window.confirmDeleteRound    = confirmDeleteRound;
