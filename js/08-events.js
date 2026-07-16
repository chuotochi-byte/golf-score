/**
 * 08-events.js
 * ------------------------------------------------------------
 * イベントリスナーの登録、および起動時の初期化処理。
 * このファイルは全関数定義が完了した最後に読み込まれる前提。
 *
 * 含まれる主なイベント:
 *   - 打順入力欄（ord1〜4）: 入力制限・自動フォーカス移動
 *   - 初期設定完了ボタン (#finishSetup)
 *   - OUT/IN切替ボタン (#toggleHalf)
 *   - 全リセットボタン (#resetAll)
 *   - 入力クリアボタン (#btnClear)
 *   - 初期設定へ戻るボタン (#btnSetup)
 *   - PDF保存ボタン (#btnPdf)
 *
 * 末尾で load() → 各種再描画 → restoreTab() という起動シーケンスを実行する。
 *
 * 依存: 01〜07 の全ファイル
 * 公開するもの:
 *   - readOrderFromInputs()
 *   - clearInHalfForSecondNine()
 *   - calcNextHoleOrderWithTiebreak(holeOrder)
 *       … 現状どこからも呼ばれていない未使用関数（元実装のまま保持）
 * ------------------------------------------------------------
 */

  // ===== イベント =====
    function readOrderFromInputs(){
    const vals = [el("ord1").value, el("ord2").value, el("ord3").value, el("ord4").value].map(v => (v ?? "").toString().replace(/[^\d]/g,""));
    const nums = vals.map(v => {
      const n = parseInt(v,10);
      return Number.isFinite(n) ? n : null;
    });
    // OUT/IN別々に保存
    if(state.viewHalf === "IN"){
      state.playOrderIN = nums;
    } else {
      state.playOrderOUT = nums;
    }
    state.playOrder = nums; // 後方互換
    save();
  }

  const ordIds = ["ord1","ord2","ord3","ord4"];
  ordIds.forEach((id, idx)=>{
    el(id).addEventListener("input", ()=>{
      // 入力は数字のみ、1〜4に制限
      let v = (el(id).value ?? "").toString().replace(/[^\d]/g,"");
      const n = parseInt(v, 10);
      if(v !== "" && (n < 1 || n > 4)) v = "";
      el(id).value = v;
      readOrderFromInputs();
      recalcAll(); // ラスベガスの初回チーム分けに反映
      // 1〜4が入力されたら次の人の欄へ
      if(v !== "" && n >= 1 && n <= 4){
        const nextId = ordIds[idx + 1];
        if(nextId){ el(nextId).focus(); el(nextId).select(); }
      }
    });
    el(id).addEventListener("focus", ()=> setActiveHoleForBirdie(null));
  });

  el("finishSetup").addEventListener("click", () => {
    readSetupFromInputs();
    updateMeta();
    buildTables();
    recalcAll();
    applyHalfVisibility(); applyDormie();
    setSetupVisible(false);
  });

  function clearInHalfForSecondNine(){
  // 初回のOUT→IN切替時のみIN側データをクリアする
  // 2回目以降（既にinSwitched=trueの場合）はデータを保持する
  if(state.inSwitched) return;
  state.inSwitched = true;
  for(let h=10; h<=18; h++){
    // scores は保持する（OUT/IN切替しても消さない）
    // birdie / eagle
    if(state.birdie && state.birdie[h]) state.birdie[h] = [false,false,false,false];
    if(state.eagle  && state.eagle[h])  state.eagle[h]  = [false,false,false,false];
    // olympic / vegas override
    if(state.games?.olympic && state.games.olympic[h]) state.games.olympic[h] = ["","","",""];
    if(state.games?.vegasOverride && state.games.vegasOverride[h]) state.games.vegasOverride[h] = ["","","",""];
    // team handicap checkbox
    if(state.teamHandicap && state.teamHandicap[h]) delete state.teamHandicap[h];
  }
  // 打順は切替時も保持する（消さない）
}

el("toggleHalf").addEventListener("click", () => {
  const next = (state.viewHalf === "OUT") ? "IN" : "OUT";

  if(state.viewHalf === "OUT" && next === "IN"){
    clearInHalfForSecondNine();
  }

  state.viewHalf = next;
  save();
  updateMeta();
  buildTables();
  recalcAll();
  applyHalfVisibility(); applyDormie();
});

// 最終ホール（同点時は前のホールに遡って）スコア順から打順配列を返す
function calcNextHoleOrderWithTiebreak(holeOrder){
  const forIN = holeOrder[0] >= 10;
  let lastIdx = -1;
  for(let i = holeOrder.length - 1; i >= 0; i--){
    const scores = [0,1,2,3].map(p => getScore(holeOrder[i], p));
    if(scores.every(s => s !== null)){ lastIdx = i; break; }
  }
  if(lastIdx < 0) return getInitialOrderPlayers(forIN);

  const players = [0,1,2,3];

  players.sort((a, b) => {
    for(let i = lastIdx; i >= 0; i--){
      const h = holeOrder[i];
      const sa = getScore(h, a);
      const sb = getScore(h, b);
      if(sa === null || sb === null) continue;
      if(sa !== sb) return sa - sb;
    }
    const cur = getInitialOrderPlayers(forIN) || [0,1,2,3];
    return cur.indexOf(a) - cur.indexOf(b);
  });

  return players;
}


  el("resetAll").addEventListener("click", () => {
    modalConfirm("全入力を削除します。\nよろしいですか？", () => { resetAll(); });
  });

  el("btnClear").addEventListener("click", clearEnteredData);

  el("btnSetup").addEventListener("click", () => {
    setupBox.style.display = "";
    setupBox.classList.add("small");
    applySetupToInputs();
  });

  el("btnPdf").addEventListener("click", savePdf);

  // ラウンド保存ボタン
  el("btnSaveRound").addEventListener("click", () => {
    if (!state.course || !state.date) {
      modalAlert("日付とゴルフ場を入力してから保存してください。");
      return;
    }
    const label = state.course + (state.courseNineOut ? `（${state.courseNineOut}/${state.courseNineIn}）` : "");
    modalInput(
      `${state.date}  ${label}\nタグを入力してください（省略可）`,
      "例: 月例競技、コンペ",
      (tag) => {
        saveCurrentRound(tag);
        modalAlert("ラウンドを保存しました。");
      }
    );
  });

  // ===== オリンピック/ラスベガス 1点あたり単価 =====
  el("olyUnitPrice").addEventListener("input", () => {
    state.olympicUnitPrice = sanitizeDigits(el("olyUnitPrice").value);
    el("olyUnitPrice").value = state.olympicUnitPrice;
    save();
    recalcAll();
  });
  el("vegasUnitPrice").addEventListener("input", () => {
    state.vegasUnitPrice = sanitizeDigits(el("vegasUnitPrice").value);
    el("vegasUnitPrice").value = state.vegasUnitPrice;
    save();
    recalcAll();
  });

  // ===== マッチ/チーム戦 精算単価 =====
  el("matchWinAmount").addEventListener("input", () => {
    state.matchWinAmount = sanitizeDigits(el("matchWinAmount").value);
    el("matchWinAmount").value = state.matchWinAmount;
    save();
    syncMatchTable();
  });
  el("teamHolePrice").addEventListener("input", () => {
    state.teamHolePrice = sanitizeDigits(el("teamHolePrice").value);
    el("teamHolePrice").value = state.teamHolePrice;
    save();
    syncMatchTable();
  });

  // ===== 起動 =====
  load();
  save(); // マイグレーション済みの値をlocalStorageへ即反映
  if(state.viewHalf !== "OUT" && state.viewHalf !== "IN"){ state.viewHalf = "OUT"; }
  applySetupToInputs();
  el("olyUnitPrice").value = state.olympicUnitPrice || "";
  el("vegasUnitPrice").value = state.vegasUnitPrice || "";
  el("matchWinAmount").value = state.matchWinAmount || "";
  el("teamHolePrice").value = state.teamHolePrice || "";
  updateMeta();
  buildTables();
  recalcAll();
  applyHalfVisibility(); applyDormie();
  restoreTab();

  if(state.date && state.course){
    setSetupVisible(false);
  }else{
    setSetupVisible(true);
  }
