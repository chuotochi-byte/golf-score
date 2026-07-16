/**
 * 05c-calc-vegas.js
 * ------------------------------------------------------------
 * ラスベガス戦の自動計算ロジック。
 * 2人1組チーム（前ホールの好成績順で2人ずつペア再編成）の合計打数を
 * 2桁の数として比較し（小さい打数が十の位）、バーディー/イーグルで
 * 数字の桁を入れ替える「ラスベガス」特有のルールを実装する。
 * 手入力による上書き（vegasOverride）にも対応。
 *
 * 末尾に sumOlympicRange() を含む（オリンピック戦の合計計算。
 * 元のソースでの並び順をそのまま踏襲）。
 *
 * 依存: 01-state.js, 05a-calc-core.js（getScore）, 03-setup.js（ensureBoolObj）
 * 公開するもの:
 *   - swapDigits(num) / roundVegasDiff(d) / sanitizeOrderNum(v)
 *   - getInitialOrderPlayers(forIN)
 *   - isPlayOrderAnyFilled()
 *   - calcVegasPoints(order)
 *   - sumOlympicRange(p, fromHole, toHole)
 * ------------------------------------------------------------
 */

  function swapDigits(num){
    const tens = Math.floor(num/10);
    const ones = num % 10;
    return ones*10 + tens;
  }

  function roundVegasDiff(d){
    if(d<=0) return 0;
    if(d<=5) return 5;
    return Math.ceil(d/5)*5;
  }

  function sanitizeOrderNum(v){
    v = (v ?? "").toString().replace(/[^\d]/g,"");
    const n = parseInt(v,10);
    return Number.isFinite(n) ? n : null;
  }

  function getInitialOrderPlayers(forIN){
    // forIN=true のときIN用、falseのときOUT用の打順を参照
    const po = forIN ? state.playOrderIN : state.playOrderOUT;
    const nums = (Array.isArray(po) && po.length === 4)
      ? po.map(sanitizeOrderNum)
      : [null,null,null,null];

    const ok = nums.every(v => v != null) && (new Set(nums)).size === 4 && nums.every(v => v>=1 && v<=4);
    if(!ok) return null;

    const players = [0,1,2,3].map(p => ({p, n: nums[p]}));
    players.sort((a,b)=>a.n-b.n);
    return players.map(x=>x.p);
  }

  function isPlayOrderAnyFilled(){
    const po = state.viewHalf === "IN" ? state.playOrderIN : state.playOrderOUT;
    return Array.isArray(po) && po.some(v => v !== null && v !== "" && v !== undefined);
  }

  function calcVegasPoints(order){
    // returns pointsByHole[hole][p] = signed points, totals per player,
    // and orderNumsByHole[hole][p] = そのホールで使った打順番号(1〜4)
    const pointsByHole = {};
    const totals = [0,0,0,0];
    const orderNumsByHole = {}; const multByHole = {};

    // 最初のホールがIN(10-18)かどうかで初期打順を決める
    const firstHole = order[0] || 1;
    const forIN = firstHole >= 10;
    let prevOrderPlayers = getInitialOrderPlayers(forIN) || [0,1,2,3];
    let pushStreak = 0;

    for(let idx=0; idx<order.length; idx++){
      const hole = order[idx];

      // 打順決定（前ホールの良い順、同点は前の順のまま）
      if(idx>0){
        const prevHole = order[idx-1];
        const prevScores = prevOrderPlayers.map(p => ({p, s: getScore(prevHole,p)}));
        // 未入力があれば打順は維持
        if(prevScores.every(x => x.s!==null)){
          prevScores.sort((a,b)=>{
            if(a.s !== b.s) return a.s - b.s;
            return prevOrderPlayers.indexOf(a.p) - prevOrderPlayers.indexOf(b.p);
          });
          prevOrderPlayers = prevScores.map(x=>x.p);
        }
      }

      orderNumsByHole[hole] = ["", "", "", ""];
      for(let ord=0; ord<prevOrderPlayers.length; ord++){
        const playerIdx = prevOrderPlayers[ord];
        orderNumsByHole[hole][playerIdx] = ord + 1;
      }

      const aIdx = [prevOrderPlayers[0], prevOrderPlayers[3]];
      const bIdx = [prevOrderPlayers[1], prevOrderPlayers[2]];

      const aS = aIdx.map(p=>getScore(hole,p));
      const bS = bIdx.map(p=>getScore(hole,p));

      pointsByHole[hole] = [ "", "", "", "" ];

      if([...aS, ...bS].some(x=>x===null)){
        // 未入力 → 表示空
        continue;
      }

      // 数字（各人10打以上は9扱い。小さい方が10の位）
      const cap9 = (n)=> Math.min(n, 9);
      const aC = aS.map(cap9);
      const bC = bS.map(cap9);
      let numA = Math.min(aC[0],aC[1])*10 + Math.max(aC[0],aC[1]);
      let numB = Math.min(bC[0],bC[1])*10 + Math.max(bC[0],bC[1]);

      // 特例：9扱いで同点になる場合、いずれかのチームに2桁スコアがいれば
      // その2桁スコアの小さい方のチームを勝ちとする（プッシュにしない）
      if(numA === numB){
        const a2digit = aS.find(s => s >= 10);  // Aチームの2桁スコア（なければundefined）
        const b2digit = bS.find(s => s >= 10);  // Bチームの2桁スコア
        if(a2digit !== undefined || b2digit !== undefined){
          const aMin2 = a2digit !== undefined ? a2digit : 0;
          const bMin2 = b2digit !== undefined ? b2digit : 0;
          if(aMin2 < bMin2)       numA = numB - 1; // Aが勝ち
          else if(bMin2 < aMin2)  numB = numA - 1; // Bが勝ち
          // 2桁スコアが同じなら真のプッシュ（何もしない）
        }
      }

      const bArr = ensureBoolObj(state.birdie, hole);
      const eArr = ensureBoolObj(state.eagle, hole);
      const isBonus = (p)=> !!bArr[p] || !!eArr[p];

      const aBirdies = aIdx.map(p=>isBonus(p));
      const bBirdies = bIdx.map(p=>isBonus(p));

      const aAny = aBirdies.some(Boolean);
      const bAny = bBirdies.some(Boolean);

      // バーディー：片側のみ→相手数字を逆転 / 両チーム→双方「自分の数字」を逆転
      if(aAny && bAny){
        numA = swapDigits(numA);
        numB = swapDigits(numB);
      }else{
        if(aAny) numB = swapDigits(numB);
        if(bAny) numA = swapDigits(numA);
      }

      // 勝敗
      if(numA === numB){
        pushStreak += 1;
        // プッシュは0点（次ホール倍率）
        continue;
      }

      const winner = (numA < numB) ? "A" : "B";
      const base = roundVegasDiff(Math.abs(numA - numB));
      const mult = (pushStreak + 1); multByHole[hole] = mult;

      // 同チーム2人バーディー（またはイーグル扱い） → 勝った点を2倍
      const aDouble = aBirdies.filter(Boolean).length >= 2;
      const bDouble = bBirdies.filter(Boolean).length >= 2;
      let winBonus = 1;
      if(winner==="A" && aDouble) winBonus = 2;
      if(winner==="B" && bDouble) winBonus = 2;

      const pts = base * mult * winBonus;

      pushStreak = 0;

      // 付与：勝ちチーム +pts / 負けチーム -pts
      if(winner==="A"){
        for(const p of aIdx){ pointsByHole[hole][p] = +pts; totals[p]+=pts; }
        for(const p of bIdx){ pointsByHole[hole][p] = -pts; totals[p]-=pts; }
      }else{
        for(const p of bIdx){ pointsByHole[hole][p] = +pts; totals[p]+=pts; }
        for(const p of aIdx){ pointsByHole[hole][p] = -pts; totals[p]-=pts; }
      }
    }

    // 手入力上書き（空欄以外はその値を採用）
    for(let h=1; h<=18; h++){
      const o = state.games.vegasOverride?.[h];
      if(!o) continue;
      for(let p=0;p<4;p++){
        const raw = o[p];
        if(raw===undefined || raw===null) continue;
        const s = (raw ?? "").toString().trim();
        if(s==="") continue; // 空欄は自動
        const x = parseInt(s,10);
        pointsByHole[h] = pointsByHole[h] || ["","","",""];
        pointsByHole[h][p] = Number.isFinite(x) ? x : "";
      }
    }

    // totals を再計算（上書きを反映）
    const totals2 = [0,0,0,0];
    for(const hStr in pointsByHole){
      const row = pointsByHole[hStr];
      if(!row) continue;
      for(let p=0;p<4;p++){
        const v = row[p];
        if(v!=="" && v!==null && v!==undefined){
          const x = parseInt(v,10);
          if(Number.isFinite(x)) totals2[p] += x;
        }
      }
    }

    return { pointsByHole, totals: totals2, orderNumsByHole, multByHole };
  }

  function sumOlympicRange(p, fromHole, toHole){
    let s = 0;
    let any = false;
    for(let h=fromHole; h<=toHole; h++){
      const row = state.games.olympic[h];
      if(!row) continue;
      const v = row[p];
      if(v === "" || v === null || v === undefined) continue;
      const x = parseInt(v,10);
      if(Number.isFinite(x)){ s += x; any = true; }
    }
    return any ? s : "";
  }
