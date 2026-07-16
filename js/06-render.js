/**
 * 06-render.js
 * ------------------------------------------------------------
 * 画面の再描画を担当する中心的なファイル。
 * recalcAll() が「マッチ/チーム/オリンピック/ラスベガス全ての再計算
 * ＋画面反映」を一括で行うメイン関数で、スコア入力のたびに呼ばれる。
 * その他、OUT/IN表示切替時の行の出し分け、タブ切替、
 * マッチ/チームタブの行同期もここに含む。
 *
 * 依存: 01-state.js, 03-setup.js, 05a/05b/05c-calc-*.js
 * 公開するもの:
 *   - recalcAll()
 *   - holeHasAnyScore(hole) / holeHasAnyOlympic(hole)
 *   - applyHalfVisibility()
 *   - applyTotalsOrder() … 合計/OUT小計/IN小計の表示順を現在のOUT/IN表示に合わせて入れ替える
 *   - switchTab(tab) … window.switchTab としても公開（onclick属性から呼ばれる）
 *   - restoreTab()
 *   - syncMatchTable()
 *   - getVegasOrder()  … ラスベガスの打順基準ホール順（IN先行開始時は10-18→1-9）
 *   - syncSettleTable() … 精算タブ（オリンピック/ラスベガスの精算金＋合計）の再描画
 * ------------------------------------------------------------
 */

  /** ラスベガス計算に使うホール巡回順。IN側から先に入力が始まっていればIN→OUTの順にする */
  function getVegasOrder(){
    const inStarted = [10,11,12,13,14,15,16,17,18].some(h => {
      const r = state.scores[h];
      return r && r.some(v => (v ?? "") !== "");
    });
    return inStarted
      ? [10,11,12,13,14,15,16,17,18,1,2,3,4,5,6,7,8,9]
      : orderOUT;
  }

  function recalcAll(){
    const vegasOrder = getVegasOrder();
    const order = orderOUT;

    // マッチ・チーム戦の各Hole
    for(const h of order){
      setResultCell(`match_${h}`, matchSymbol(h));
    }
    const teamMap = teamSymbolsByOrder(order);
    for(const h of order){
      setResultCell(`team_${h}`, teamMap[h] || "");
    }

    // totals row（数値の横にPAR差分も表記する。対象コース以外では従来通り数値のみ）
    const totals = sumPlayerTotal();
    el("tSum1").innerHTML = formatTotalWithDiff(0, totals[0], 1, 18);
    el("tSum2").innerHTML = formatTotalWithDiff(1, totals[1], 1, 18);
    el("tSum3").innerHTML = formatTotalWithDiff(2, totals[2], 1, 18);
    el("tSum4").innerHTML = formatTotalWithDiff(3, totals[3], 1, 18);

    // half
    el("tOut1").innerHTML = formatTotalWithDiff(0, sumRangeForPlayer(0,1,9), 1, 9);
    el("tOut2").innerHTML = formatTotalWithDiff(1, sumRangeForPlayer(1,1,9), 1, 9);
    el("tOut3").innerHTML = formatTotalWithDiff(2, sumRangeForPlayer(2,1,9), 1, 9);
    el("tOut4").innerHTML = formatTotalWithDiff(3, sumRangeForPlayer(3,1,9), 1, 9);
    el("tIn1").innerHTML = formatTotalWithDiff(0, sumRangeForPlayer(0,10,18), 10, 18);
    el("tIn2").innerHTML = formatTotalWithDiff(1, sumRangeForPlayer(1,10,18), 10, 18);
    el("tIn3").innerHTML = formatTotalWithDiff(2, sumRangeForPlayer(2,10,18), 10, 18);
    el("tIn4").innerHTML = formatTotalWithDiff(3, sumRangeForPlayer(3,10,18), 10, 18);

    // match/team合計はマッチ/チームタブ用に計算だけ保持
    const full = matchTeamSumsByRange(order, {from:1,to:18});
    const outS = matchTeamSumsByRange(order, {from:1,to:9});
    const inS  = matchTeamSumsByRange(order, {from:10,to:18});

    // ドーミー表示
    clearDormieMarks();
    const dormieResult = calcDormieResultFull(order);
    markDormieRow(dormieResult);

    // Olympic 合計 & half
    el("oSum1").textContent = sumOlympicRange(0,1,18);
    el("oSum2").textContent = sumOlympicRange(1,1,18);
    el("oSum3").textContent = sumOlympicRange(2,1,18);
    el("oSum4").textContent = sumOlympicRange(3,1,18);

    el("oOut1").textContent = sumOlympicRange(0,1,9);
    el("oOut2").textContent = sumOlympicRange(1,1,9);
    el("oOut3").textContent = sumOlympicRange(2,1,9);
    el("oOut4").textContent = sumOlympicRange(3,1,9);

    el("oIn1").textContent = sumOlympicRange(0,10,18);
    el("oIn2").textContent = sumOlympicRange(1,10,18);
    el("oIn3").textContent = sumOlympicRange(2,10,18);
    el("oIn4").textContent = sumOlympicRange(3,10,18);

    // Olympic 精算（(自分の得点-平均得点)×単価。4人合計は必ず0）
    {
      const oTotals = [0,1,2,3].map(p => sumOlympicRange(p,1,18));
      const oSettle = calcSettlement(oTotals, n(state.olympicUnitPrice));
      el("oSet1").textContent = formatYen(oSettle[0]);
      el("oSet2").textContent = formatYen(oSettle[1]);
      el("oSet3").textContent = formatYen(oSettle[2]);
      el("oSet4").textContent = formatYen(oSettle[3]);
    }

    // Vegas（自動計算 + 手入力上書き）
    const vegas = calcVegasPoints(vegasOrder);
    
const fmtV = (v, ord, mult)=> {
  const team = (ord===1||ord===4) ? "A" : (ord===2||ord===3) ? "B" : "";
  if(v === "" || v === null || v === undefined) {
    return team;
  }
  const base = (v>0 ? `+${v}` : `${v}`);
  const m = (mult && mult>1) ? `×${mult}` : "";
  return `${team}${base}(${ord})${m}`;
};


    for(const h of order){
      for(let p=0;p<4;p++){
        const inp = el(`vegasInp_${h}_${p}`);
        if(!inp) continue;

        // 上書きが入っていればそれを表示、空なら自動値を表示
        const o = state.games.vegasOverride?.[h]?.[p];
        const hasOverride = (o ?? "").toString().trim() !== "";
        const v = hasOverride ? parseInt(o,10) : vegas.pointsByHole[h]?.[p];
        const ord = vegas.orderNumsByHole?.[h]?.[p];

        inp.value = hasOverride ? (Number.isFinite(v) ? `${v}${ord?`(${ord})`:""}` : "") : fmtV(v, ord, vegas.multByHole?.[h]);
        inp.style.color = "";
      }
    }
    el("vSum1").textContent = vegas.totals[0] ? vegas.totals[0] : (vegas.totals[0]===0 ? "0":"");
    el("vSum2").textContent = vegas.totals[1] ? vegas.totals[1] : (vegas.totals[1]===0 ? "0":"");
    el("vSum3").textContent = vegas.totals[2] ? vegas.totals[2] : (vegas.totals[2]===0 ? "0":"");
    el("vSum4").textContent = vegas.totals[3] ? vegas.totals[3] : (vegas.totals[3]===0 ? "0":"");

    // Vegas 精算（(自分の得点-平均得点)×単価。4人合計は必ず0）
    {
      const vSettle = calcSettlement(vegas.totals, n(state.vegasUnitPrice));
      el("vSet1").textContent = formatYen(vSettle[0]);
      el("vSet2").textContent = formatYen(vSettle[1]);
      el("vSet3").textContent = formatYen(vSettle[2]);
      el("vSet4").textContent = formatYen(vSettle[3]);
    }

    // Vegas half totals（加算）
    const vHalf = [0,0,0,0], vHalfAny = [false,false,false,false];
    const vHalf2= [0,0,0,0], vHalf2Any= [false,false,false,false];
    for(let h=1;h<=9;h++){
      const row = vegas.pointsByHole[h];
      if(!row) continue;
      for(let p=0;p<4;p++){
        if(row[p]!=="" && row[p]!==null && row[p]!==undefined){
          vHalf[p] += row[p];
          vHalfAny[p] = true;
        }
      }
    }
    for(let h=10;h<=18;h++){
      const row = vegas.pointsByHole[h];
      if(!row) continue;
      for(let p=0;p<4;p++){
        if(row[p]!=="" && row[p]!==null && row[p]!==undefined){
          vHalf2[p] += row[p];
          vHalf2Any[p] = true;
        }
      }
    }
    const setHalf = (id, val, any) => { el(id).textContent = any ? (val===0 ? "0" : val) : ""; };
    setHalf("vOut1", vHalf[0], vHalfAny[0]);
    setHalf("vOut2", vHalf[1], vHalfAny[1]);
    setHalf("vOut3", vHalf[2], vHalfAny[2]);
    setHalf("vOut4", vHalf[3], vHalfAny[3]);
    setHalf("vIn1", vHalf2[0], vHalf2Any[0]);
    setHalf("vIn2", vHalf2[1], vHalf2Any[1]);
    setHalf("vIn3", vHalf2[2], vHalf2Any[2]);
    setHalf("vIn4", vHalf2[3], vHalf2Any[3]);

    // ===== マッチ勝者トロフィー =====
    {
      const th1 = el("th1"), th2 = el("th2");
      const tr1 = el("trophy1"), tr2 = el("trophy2");
      if(th1) th1.textContent = state.names[0];
      if(th2) th2.textContent = state.names[1];
      if(tr1) tr1.textContent = "";
      if(tr2) tr2.textContent = "";
      let matchLead = 0, remaining = 0;
      [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18].forEach(h => {
        const a = getScore(h,0), b = getScore(h,1);
        if(a !== null && b !== null){
          if(a < b) matchLead++; else if(a > b) matchLead--;
        } else { remaining++; }
      });
      if(matchLead !== 0 && Math.abs(matchLead) > remaining){
        if(matchLead > 0){ if(tr1) tr1.textContent = "🏆"; }
        else              { if(tr2) tr2.textContent = "🏆"; }
      }
    }
  }

  // ===== Hole1入力で10-18を隠す / Hole10入力で1-9を隠す（両方入力されたら全部表示） =====
  function holeHasAnyScore(hole){
    const r = state.scores[hole];
    if(r && r.some(v => (v ?? "") !== "")) return true;
    return false;
  }
  function holeHasAnyOlympic(hole){
    const r = state.games.olympic[hole];
    if(r && r.some(v => (v ?? "") !== "")) return true;
    return false;
  }
  function applyHalfVisibility(){
    const mode = state.viewHalf; // "OUT" or "IN"
    const setRow = (rootSelector) => {
      document.querySelectorAll(`${rootSelector} tr[data-hole]`).forEach(tr => {
        const h = parseInt(tr.getAttribute("data-hole"),10);
        let show = true;
        if(mode==="OUT") show = (h>=1 && h<=9);
        if(mode==="IN")  show = (h>=10 && h<=18);
        tr.style.display = show ? "" : "none";
      });
    };
    setRow("#scoreBody");
    setRow("#olyBody");
    setRow("#vegasBody");
    setRow("#matchBody");

    applyTotalsOrder();
  }

  /**
   * 合計/OUT小計/IN小計の並び順を、現在表示中のOUT/INに合わせて入れ替える。
   * 表示中の半面（例: Hole1-9を見ているならOUT小計）の小計を先頭に、
   * もう片方の小計、最後に合計の順にする（オリンピック/ラスベガスの「精算」行は常に最後）。
   */
  function applyTotalsOrder(){
    const isIn = state.viewHalf === "IN";
    document.querySelectorAll("tfoot").forEach(tfoot => {
      const rowSum = tfoot.querySelector(".rowSum");
      const rowOut = tfoot.querySelector(".rowOut");
      const rowIn  = tfoot.querySelector(".rowIn");
      if(!rowSum || !rowOut || !rowIn) return;
      const first  = isIn ? rowIn : rowOut;
      const second = isIn ? rowOut : rowIn;
      tfoot.appendChild(first);
      tfoot.appendChild(second);
      tfoot.appendChild(rowSum);
      const rowSettle = tfoot.querySelector(".rowSettle");
      if(rowSettle) tfoot.appendChild(rowSettle);
    });
  }

  // ===== タブ切替 =====
  function switchTab(tab){
    const score = el("viewScore");
    const oly   = el("viewOly");
    const vegas = el("viewVegas");
    const match = el("viewMatch");
    const settle = el("viewSettle");
    const tabScore = el("tabScore");
    const tabOly   = el("tabOly");
    const tabVegas = el("tabVegas");
    const tabMatch = el("tabMatch");
    const tabSettle = el("tabSettle");
    [tabScore, tabOly, tabVegas, tabMatch, tabSettle].forEach(t => t && t.classList.remove("active"));
    [score, oly, vegas, match, settle].forEach(s => s && (s.style.display = "none"));
    if(tab === "score"){
      tabScore.classList.add("active");
      if(score) score.style.display = "";
    } else if(tab === "oly"){
      tabOly.classList.add("active");
      if(oly) oly.style.display = "";
      recalcAll();
      applyOlyHighlight();
      applyOlyLock();
    } else if(tab === "vegas"){
      tabVegas.classList.add("active");
      if(vegas) vegas.style.display = "";
      recalcAll();
    } else if(tab === "match"){
      tabMatch.classList.add("active");
      if(match) match.style.display = "";
      syncMatchTable();
    } else if(tab === "settle"){
      tabSettle.classList.add("active");
      if(settle) settle.style.display = "";
      syncSettleTable();
    }
    state.activeTab = tab;
    save();
  }
  window.switchTab = switchTab;

  function restoreTab(){
    const t = state.activeTab;
    switchTab(["score","oly","vegas","match","settle"].includes(t) ? t : "score");
  }

  function syncMatchTable(){
    const order = orderOUT;
    const setT = (id, v) => { const n = el(id); if(n) n.textContent = v; };
    const outStarted = [1,2,3,4,5,6,7,8,9].some(h => {
      const r = state.scores[h]; return r && r.some(v => (v ?? "") !== "");
    });
    const inStarted = [10,11,12,13,14,15,16,17,18].some(h => {
      const r = state.scores[h]; return r && r.some(v => (v ?? "") !== "");
    });
    const allOrder = (!outStarted && inStarted)
      ? [10,11,12,13,14,15,16,17,18,1,2,3,4,5,6,7,8,9]
      : [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18];
    const teamMap = teamSymbolsByOrder(order);
    const symStyle = (s) => s==="〇"?"color:#c00;font-weight:900":s==="×"?"color:#06c;font-weight:900":"";
    const body = el("matchBody");
    body.innerHTML = "";
    for(const h of allOrder){
      const tr = document.createElement("tr");
      tr.setAttribute("data-hole", String(h));
      const ms = matchSymbol(h);
      const ts = teamMap[h] || "";
      const bg = h>=10 ? "background:#f5f5f5" : "";
      tr.innerHTML = `
        <th class="sticky holeCol" style="${bg}">${holeLabel(h)}</th>
        <td class="scoreCol" style="${symStyle(ms)};text-align:center">${ms}</td>
        <td class="scoreCol" style="${symStyle(ts)};text-align:center">${ts}</td>`;
      body.appendChild(tr);
    }
    applyHalfVisibility();
    const full = matchTeamSumsByRange(order, {from:1,to:18});
    const outS = matchTeamSumsByRange(order, {from:1,to:9});
    const inS  = matchTeamSumsByRange(order, {from:10,to:18});
    setT("mMatchSum", full.match||""); setT("mTeamSum", full.team||"");
    setT("mMatchOut", outS.match||""); setT("mTeamOut", outS.team||"");
    setT("mMatchIn",  inS.match||"");  setT("mTeamIn",  inS.team||"");
    const matchSet = calcMatchSettlement(full.match, n(state.matchWinAmount));
    const teamSet  = calcTeamSettlement(full.team, n(state.teamHolePrice));
    const s1El = el("mSet1"), s2El = el("mSet2");
    if(s1El) s1El.textContent = formatYen(matchSet[0]) + (formatYen(matchSet[1]) ? "\n" + formatYen(matchSet[1]) : "");
    if(s2El) s2El.textContent = formatYen(teamSet[0])  + (formatYen(teamSet[1])  ? "\n" + formatYen(teamSet[1])  : "");
  }

  /** 精算タブ：オリンピック/ラスベガス/マッチ/チームそれぞれの精算金と、その合計を再計算して表示する */
  function syncSettleTable(){
    const N = state.names;
    const setT = (id, v) => { const node = el(id); if(node) node.textContent = v; };
    setT("sth1", N[0]); setT("sth2", N[1]); setT("sth3", N[2]); setT("sth4", N[3]);

    const oTotals = [0,1,2,3].map(p => sumOlympicRange(p,1,18));
    const oSettle = calcSettlement(oTotals, n(state.olympicUnitPrice));

    const vegas = calcVegasPoints(getVegasOrder());
    const vSettle = calcSettlement(vegas.totals, n(state.vegasUnitPrice));

    const full = matchTeamSumsByRange(orderOUT, {from:1, to:18});
    const matchSettle = calcMatchSettlement(full.match, n(state.matchWinAmount));
    const teamSettle  = calcTeamSettlement(full.team, n(state.teamHolePrice));

    for(let p=0;p<4;p++){
      const oV = oSettle[p], vV = vSettle[p];
      const mV = matchSettle[p], tV = teamSettle[p];
      setT(`settleOly${p+1}`, formatYen(oV));
      setT(`settleVegas${p+1}`, formatYen(vV));
      setT(`settleMatch${p+1}`, formatYen(mV));
      setT(`settleTeam${p+1}`, formatYen(tV));
      const total = (oV||0) + (vV||0) + mV + tV;
      setT(`settleTotal${p+1}`, formatYen(total));
    }
  }

