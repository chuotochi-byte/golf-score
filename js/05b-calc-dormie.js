/**
 * 05b-calc-dormie.js
 * ------------------------------------------------------------
 * 「ドーミー」「アップドーミー」判定（マッチ戦 増 vs 幸 専用）。
 * 最初の未入力ホールに到達した時点でのリード差と残りホール数を比較し、
 * 既に決着がついている（ドーミー＝赤）／あと1差で決着がつく
 * （アップドーミー＝青）状態をハイライトする。
 *
 * calcDormieResult() は前半→後半の単純判定（旧ロジック・現在は未使用、
 * 互換性のため残置）。
 * calcDormieResultFull() が実際に使われている統一ロジックで、
 * OUTスタート/INスタートの両方、かつOUT⇔IN切替後の18ホール通し判定に対応する。
 *
 * 依存: 01-state.js, 05a-calc-core.js（getScore）
 * 公開するもの:
 *   - calcDormieResult(order)      … 旧ロジック（未使用、互換性のため残置）
 *   - calcDormieResultFull(order)  … 実際に使われる統一ロジック
 *   - applyDormieInner()           … window.applyDormieInner として公開
 *                                     （head内のグローバル関数 applyDormie() から呼ばれる）
 *   - clearDormieMarks() / markDormieRow(result)
 * ------------------------------------------------------------
 */

  function calcDormieResult(order){
    const vh = state.viewHalf || "OUT";
    let scoreHoles, backHoles;
    if(vh === "IN"){
      scoreHoles = order.filter(h => h >= 10 && h <= 18);
      backHoles  = order.filter(h => h >= 1  && h <= 9);
    } else {
      scoreHoles = order.filter(h => h >= 1  && h <= 9);
      backHoles  = order.filter(h => h >= 10 && h <= 18);
    }

    // 前半9Hのスコアからリードを計算（増 vs 幸）
    let lead = 0;
    for(let i=0; i<scoreHoles.length; i++){
      const hole = scoreHoles[i];
      const a = getScore(hole,0);
      const b = getScore(hole,1);
      if(a===null || b===null) break;
      if(a<b) lead += 1;
      else if(a>b) lead -= 1;
    }

    // 後半9Hを順に見て入力済みのリードを更新し、最初の未入力ホールを判定
    for(let i=0; i<backHoles.length; i++){
      const hole = backHoles[i];
      const a = getScore(hole,0);
      const b = getScore(hole,1);
      if(a===null || b===null){
        // 未入力ホール：ドーミー or アップドーミー判定
        const remain = backHoles.length - i; // このホール含む残り
        if(lead !== 0){
          if(Math.abs(lead) === remain){
            return { hole, type:"dormie" };      // ドーミー（赤）
          } else if(Math.abs(lead) === remain - 1){
            return { hole, type:"up-dormie" };   // アップドーミー（青）
          }
        }
        break;
      }
      // 入力済みならリード更新
      if(a<b) lead += 1;
      else if(a>b) lead -= 1;
    }
    return null;
  }

  // グローバルのapplyDormieから呼ばれる統一関数
  function applyDormieInner(){
    clearDormieMarks();
    const result = calcDormieResultFull(orderOUT);
    markDormieRow(result);
  }
  window.applyDormieInner = applyDormieInner; // グローバルに公開

  // ドーミー判定
  // OUTスタート(viewHalf=OUT) : OUTの入力中にリアルタイム判定（9H残り基準）
  // INスタート(viewHalf=IN)   : INの入力中にリアルタイム判定（9H残り基準）
  // INスタートでOUTへ切替後   : INの全9Hリードを引き継ぎ、OUTの入力分を加算しながら
  //                             OUTの残りホールでドーミー判定（18H全体として判定）
  function calcDormieResultFull(order){
    const vh = state.viewHalf || "OUT";
    const inHoles  = order.filter(h => h >= 10 && h <= 18);
    const outHoles = order.filter(h => h >= 1  && h <= 9);

    // INの全9Hが入力済みかチェック（INスタートの判定に使用）
    const inAllFilled = inHoles.every(h => getScore(h,0)!==null && getScore(h,1)!==null);

    if(vh === "IN"){
      // IN表示中のドーミー判定
      // INスタート（OUTが未入力）：残り = IN残り + OUT9H全部
      // OUTスタートでINを後半にやっている場合：IN内だけで判定
      const outAnyFilled = outHoles.some(h => getScore(h,0)!==null && getScore(h,1)!==null);
      const outRemaining = outHoles.filter(h => getScore(h,0)===null || getScore(h,1)===null).length;

      let lead = 0;
      for(let i=0; i<inHoles.length; i++){
        const hole = inHoles[i];
        const a = getScore(hole,0), b = getScore(hole,1);
        if(a===null || b===null){
          const inRemain = inHoles.length - i;
          // INスタート（OUTが未入力）なら残りにOUT分を加算
          const remain = (!outAnyFilled) ? inRemain + outRemaining : inRemain;
          if(lead !== 0){
            if(Math.abs(lead) === remain)     return { hole, type:"dormie" };
            if(Math.abs(lead) === remain - 1) return { hole, type:"up-dormie" };
          }
          break;
        }
        if(a<b) lead += 1; else if(a>b) lead -= 1;
      }
      return null;
    }

    // OUT表示中
    if(inAllFilled){
      // INスタート：INの全9Hリードを計算してOUTに引き継ぐ
      let lead = 0;
      for(const h of inHoles){
        const a = getScore(h,0), b = getScore(h,1);
        if(a<b) lead += 1; else if(a>b) lead -= 1;
      }
      // OUTの入力分を加算しながら最初の未入力ホールでドーミー判定
      // 残りホール数はOUT内の残り（9H基準）
      for(let i=0; i<outHoles.length; i++){
        const hole = outHoles[i];
        const a = getScore(hole,0), b = getScore(hole,1);
        if(a===null || b===null){
          const remain = outHoles.length - i;
          if(lead !== 0){
            if(Math.abs(lead) === remain)     return { hole, type:"dormie" };
            if(Math.abs(lead) === remain - 1) return { hole, type:"up-dormie" };
          }
          break;
        }
        if(a<b) lead += 1; else if(a>b) lead -= 1;
      }
      return null;
    }

    // OUTスタート：OUTの入力中はIN9Hも残りに含めて全18H基準で判定
    let lead = 0;
    for(let i=0; i<outHoles.length; i++){
      const hole = outHoles[i];
      const a = getScore(hole,0), b = getScore(hole,1);
      if(a===null || b===null){
        // OUT残り + IN9H全部が残り
        const remain = (outHoles.length - i) + inHoles.length;
        if(lead !== 0){
          if(Math.abs(lead) === remain)     return { hole, type:"dormie" };
          if(Math.abs(lead) === remain - 1) return { hole, type:"up-dormie" };
        }
        break;
      }
      if(a<b) lead += 1; else if(a>b) lead -= 1;
    }
    return null;
  }

  function clearDormieMarks(){
    document.querySelectorAll("#scoreBody tr").forEach(tr => {
      tr.classList.remove("dormie");
      tr.classList.remove("up-dormie");
    });
  }
  function markDormieRow(result){
    if(!result) return;
    const { hole, type } = result;
    const tr = document.querySelector(`#scoreBody tr[data-hole="${hole}"]`);
    if(tr) tr.classList.add(type);
  }

