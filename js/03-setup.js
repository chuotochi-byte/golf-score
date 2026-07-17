/**
 * 03-setup.js
 * ------------------------------------------------------------
 * 初期設定セクション（日付・ゴルフ場・プレイヤー名）の入出力、
 * 上部メタ情報表示の更新、入力データの全クリア処理。
 *
 * 依存: 01-state.js, 02-modal.js
 * 公開するもの:
 *   - applySetupToInputs() / readSetupFromInputs()
 *   - applyCourseOtherVisibility() … ゴルフ場「その他」選択時のみ自由入力欄を表示
 *   - setSetupVisible(visible)
 *   - updateMeta()
 *   - clearEnteredData()
 *   - ensureHoleObj(obj, hole) / ensureBoolObj(obj, hole)
 *   - sanitizeSignedInt(s) / sanitizeDigits(s)
 * 依存先で参照される関数（後続ファイルで定義、呼び出しのみここに存在）:
 *   - buildTables(), recalcAll(), applyHalfVisibility(), applyDormie(),
 *     setActiveHoleForBirdie()
 * ------------------------------------------------------------
 */

/** 入力データのみを初期化する（日付・ゴルフ場・名前は保持） */
function clearEnteredData() {
  modalConfirm("入力データをクリアします。\nよろしいですか？", () => {
    state.viewHalf = "OUT";
    state.playOrder = [null, null, null, null];
    state.playOrderOUT = [null, null, null, null];
    state.playOrderIN = [null, null, null, null];
    state.scores = {};
    state.games = { olympic: {}, vegasOverride: {}, olyCb: {} };
    state.birdie = {};
    state.eagle = {};
    state.teamHandicap = {};
    state.inSwitched = false;
    save();
    updateMeta();
    buildTables();
    recalcAll();
    applyHalfVisibility(); applyDormie();
    setActiveHoleForBirdie(null);
    modalAlert("入力データをクリアしました。\n日付・ゴルフ場・名前は残しています。");
  });
}

// COURSE_PARS に登録されているコース名（01-state.js で定義）
const KNOWN_COURSES = Object.keys(COURSE_PARS);

const courseSelect     = el("courseSelect");
const nineSelectWrap   = el("nineSelectWrap");
const nineOutSelect    = el("courseNineOut");
const nineInSelect     = el("courseNineIn");
const courseOtherWrap  = el("courseOtherWrap");
const courseOtherInput = el("courseOther");

/** 27Hコース選択時にナイン選択UIを更新・表示する */
function applyNineSelectVisibility() {
  const cname = courseSelect.value;
  const info  = COURSE_PARS[cname];
  if (info && info.is27H) {
    const names = Object.keys(info.nines);
    // 選択肢を生成
    nineOutSelect.innerHTML = names.map(n => `<option value="${n}">${n}コース</option>`).join("");
    nineInSelect.innerHTML  = names.map(n => `<option value="${n}">${n}コース</option>`).join("");
    // 保存済みの選択を復元（なければ先頭/2番目をデフォルト）
    nineOutSelect.value = (state.courseNineOut && names.includes(state.courseNineOut))
      ? state.courseNineOut : names[0];
    nineInSelect.value  = (state.courseNineIn  && names.includes(state.courseNineIn))
      ? state.courseNineIn  : (names[1] || names[0]);
    state.courseNineOut = nineOutSelect.value;
    state.courseNineIn  = nineInSelect.value;
    nineSelectWrap.style.display = "";
  } else {
    nineSelectWrap.style.display = "none";
    state.courseNineOut = null;
    state.courseNineIn  = null;
  }
}

/** ゴルフ場の自由入力欄を、選択中が「その他」のときだけ表示する */
function applyCourseOtherVisibility() {
  const isOther = courseSelect.value === "";
  courseOtherWrap.style.display = isOther ? "" : "none";
  applyNineSelectVisibility();
}
courseSelect.addEventListener("change", applyCourseOtherVisibility);

// ナイン変更時に state へ即反映してテーブルを再描画
nineOutSelect.addEventListener("change", () => {
  state.courseNineOut = nineOutSelect.value;
  save();
  buildTables();
  recalcAll();
});
nineInSelect.addEventListener("change", () => {
  state.courseNineIn = nineInSelect.value;
  save();
  buildTables();
  recalcAll();
});

/** state の値を初期設定フォームの入力欄へ反映する */
function applySetupToInputs() {
  el("date").value = state.date || "";
  if (KNOWN_COURSES.includes(state.course)) {
    courseSelect.value = state.course;
    courseOtherInput.value = "";
  } else {
    courseSelect.value = "";
    courseOtherInput.value = state.course || "";
  }
  applyCourseOtherVisibility();   // ナイン選択 / その他 入力欄の表示も更新
  el("n1").value = state.names[0] || "増";
  el("n2").value = state.names[1] || "幸";
  el("n3").value = state.names[2] || "牛";
  el("n4").value = state.names[3] || "M";
  const ge = state.gamesEnabled || {};
  el("gameOly").checked   = ge.olympic !== false;
  el("gameVegas").checked = ge.vegas   !== false;
  el("gameMatch").checked = ge.match   !== false;
}

/** 初期設定フォームの入力値を state へ反映して保存する */
function readSetupFromInputs() {
  state.date   = el("date").value || "";
  state.course = courseSelect.value || (courseOtherInput.value || "").trim();
  // 27Hコースのナイン選択を保存
  const info = COURSE_PARS[state.course];
  if (info && info.is27H) {
    state.courseNineOut = nineOutSelect.value;
    state.courseNineIn  = nineInSelect.value;
  } else {
    state.courseNineOut = null;
    state.courseNineIn  = null;
  }
  state.names = [
    (el("n1").value || "増").trim() || "増",
    (el("n2").value || "幸").trim() || "幸",
    (el("n3").value || "牛").trim() || "牛",
    (el("n4").value || "M").trim() || "M",
  ];
  state.gamesEnabled = {
    olympic: !!el("gameOly").checked,
    vegas:   !!el("gameVegas").checked,
    match:   !!el("gameMatch").checked,
  };
  save();
}

/** ゲーム選択に合わせてタブの表示/非表示を切り替える */
function applyGameTabVisibility() {
  const ge = state.gamesEnabled || {};
  const show = (id, vis) => { const n = el(id); if (n) n.style.display = vis ? "" : "none"; };
  show("tabOly",   ge.olympic !== false);
  show("tabVegas", ge.vegas   !== false);
  show("tabMatch", ge.match   !== false);
  // 現在アクティブなタブが非表示になった場合はスコアタブへ
  const t = state.activeTab;
  if ((t === "oly"   && ge.olympic === false) ||
      (t === "vegas" && ge.vegas   === false) ||
      (t === "match" && ge.match   === false)) {
    switchTab("score");
  }
}

const setupBox = el("setup");
const meta = el("meta");
const halfLabel = el("halfLabel");

/** 初期設定セクションの表示/非表示を切り替える */
function setSetupVisible(visible) {
  setupBox.style.display = visible ? "" : "none";
  if (visible) setupBox.classList.remove("small");
}

/** 上部メタ情報（日付・ゴルフ場・OUT/INラベル・各表のプレイヤー名・打順欄）を再描画する */
function updateMeta() {
  const info = COURSE_PARS[state.course];
  const courseLabel = state.course
    ? (info && info.is27H && state.courseNineOut && state.courseNineIn
        ? `${state.course}（${state.courseNineOut}/${state.courseNineIn}）`
        : state.course)
    : "ゴルフ場未入力";
  meta.innerHTML = `<div><strong>${state.date || "日付未入力"}</strong></div><div>${courseLabel}</div>`;
  halfLabel.textContent = state.viewHalf === "OUT" ? "OUT" : "IN";
  el("toggleHalf").textContent = state.viewHalf === "OUT" ? "INへ切替" : "OUTへ戻る";

  const sn = (id, v) => { const n = el(id); if (n) n.textContent = v; };
  sn("th1", state.names[0]); sn("th2", state.names[1]);
  sn("th3", state.names[2]); sn("th4", state.names[3]);
  sn("go1", state.names[0]); sn("go2", state.names[1]);
  sn("go3", state.names[2]); sn("go4", state.names[3]);
  sn("gv1", state.names[0]); sn("gv2", state.names[1]);
  sn("gv3", state.names[2]); sn("gv4", state.names[3]);
  // 打順：OUT/INそれぞれ独立して表示
  const po = state.viewHalf === "IN" ? state.playOrderIN : state.playOrderOUT;
  el("ord1").value = (po?.[0] == null ? "" : String(po[0]));
  el("ord2").value = (po?.[1] == null ? "" : String(po[1]));
  el("ord3").value = (po?.[2] == null ? "" : String(po[2]));
  el("ord4").value = (po?.[3] == null ? "" : String(po[3]));
}

/** state.scores などホールごとのオブジェクトに、未初期化なら空配列をセットして返す */
function ensureHoleObj(obj, hole) {
  if (!obj[hole]) obj[hole] = ["", "", "", ""];
  return obj[hole];
}

/** state.birdie / state.eagle 用の真偽値配列を未初期化なら作成して返す */
function ensureBoolObj(obj, hole) {
  if (!obj[hole]) obj[hole] = [false, false, false, false];
  return obj[hole];
}

/** テンキー入力のサニタイズ（符号付き整数。例: オリンピック戦の "-15"）。先頭の "-" のみ許可 */
function sanitizeSignedInt(s) {
  s = (s ?? "").toString();
  // 全角マイナス等を半角に寄せる
  s = s.replace(/[－—−]/g, "-");
  // 数字とマイナス以外除去
  s = s.replace(/[^\d-]/g, "");
  // マイナスは先頭1つだけ
  const neg = s.startsWith("-") ? "-" : "";
  s = s.replace(/-/g, "");
  return neg + s;
}

/** スコア（打数）入力のサニタイズ。数字のみ許可 */
function sanitizeDigits(s) {
  return (s ?? "").toString().replace(/[^\d]/g, "");
}
