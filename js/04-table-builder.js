/**
 * 04-table-builder.js
 * ------------------------------------------------------------
 * 各タブ（スコア / オリンピック / ラスベガス）の <tbody> 行を
 * DOM要素として動的生成する。マッチ/チームタブの行生成は
 * syncMatchTable() 側（06-render.js）で行うためここには無い。
 *
 * 依存: 01-state.js, 03-setup.js
 *   - ensureHoleObj / ensureBoolObj / sanitizeSignedInt / sanitizeDigits
 * 依存（前方参照・後続ファイルで定義される関数を呼び出す）:
 *   - recalcAll(), applyHalfVisibility(), applyDormie()  … 06-render.js
 *   - calcVegasPoints()                                   … 05c-calc-vegas.js
 *   - applyOlyHighlight()                                 … このファイル内
 *
 * 公開するもの:
 *   - setActiveHoleForBirdie(hole)
 *   - makeScoreRow(hole) / makeGamesRow(hole) / makeOlyRow(hole) / makeVegasRow(hole)
 *   - applyOlyHighlight()
 *   - buildTables()
 *   - rebindGamesInputs()  … 現状は何もしない互換用の空関数
 *   - updateParDiffCell(hole, p) … スコア入力欄の隣にPAR差分表記を反映する（01-state.js の parDiffText() を使用）
 *
 * makeScoreRow() のスコア入力時、PARが分かるコース（やさと/江戸崎東/江戸崎南）なら
 * バーディー(PAR-1)/イーグル(PAR-2以下)のB/Eチェックを自動でON/OFFする
 * （ラスベガス戦の倍率計算はこのチェックを見て動くため、自動反映される）。
 * 対象コース以外では従来通り手動チェックのみ。
 *
 * makeOlyRow() のオリンピック点数入力も、スコア入力欄と同様に自動フォーカス移動する
 * （10の位は1以外あり得ないため、「1」以外の数字は1桁で即確定して次のプレイヤーへ、
 * 「1」で始まる場合のみ2桁目（例:15）を待って待機する）。
 * ------------------------------------------------------------
 */

const scoreBody = el("scoreBody");

let activeHoleForBirdie = null;

// ユーザーが手動でロック解除したOlympicホール番号のSet（buildTables()でクリア）
const olyUserUnlocked = new Set();


  function setActiveHoleForBirdie(hole){
    activeHoleForBirdie = hole;
    document.querySelectorAll(".birdieWrap").forEach(w => {
      const h = parseInt(w.getAttribute("data-hole"), 10);
      w.style.display = (h === activeHoleForBirdie) ? "inline-flex" : "none";
    });
  }

  function enableBirdieWrapOnRetap(inp, hole){
    const showWrap = () => {
      if((inp.value ?? "") !== ""){
        setActiveHoleForBirdie(hole);
      }
    };
    inp.addEventListener("click", showWrap);
    inp.addEventListener("touchend", showWrap, {passive:true});
  }

  function makeScoreRow(hole){
    const tr = document.createElement("tr");
    tr.setAttribute("data-hole", String(hole));

    const th = document.createElement("th");
    th.className = "sticky holeCol";
    th.style.whiteSpace = "nowrap";

    // ☑Hc 番号 の順
    const hc = document.createElement("span");
    hc.className = "hcWrap";
    hc.style.display = "inline-flex";
    hc.style.alignItems = "center";
    hc.style.gap = "1px";
    hc.innerHTML = `<input type="checkbox" id="hc_${hole}">`;
    th.appendChild(hc);

    const holeNum = document.createElement("span");
    holeNum.textContent = " " + holeLabel(hole);
    th.appendChild(holeNum);

    // PAR（やさと/江戸崎東/江戸崎南のみ丸数字で表示）
    const par = getParForHole(hole);
    if(par){
      const parSpan = document.createElement("span");
      parSpan.textContent = " " + circledPar(par);
      th.appendChild(parSpan);
    }

    const hcInp = hc.querySelector("input");
    hcInp.checked = !!state.teamHandicap[hole];
    hcInp.addEventListener("change", () => {
      state.teamHandicap[hole] = !!hcInp.checked;
      save();
      recalcAll();
    });

    tr.appendChild(th);

    for(let p=0;p<4;p++){
      const td = document.createElement("td");
      td.className = "scoreCol";

      const cell = document.createElement("div");
      cell.className = "scoreCell";

      const inp = document.createElement("input");
      inp.className = "scoreInput";
      inp.id = `s_${hole}_${p}`;
      inp.type = "text";
      inp.inputMode = "numeric";
      inp.pattern = "[0-9]*";
      inp.autocomplete = "off";
      inp.value = (state.scores[hole] && state.scores[hole][p] !== undefined) ? state.scores[hole][p] : "";

      inp.addEventListener("focus", () => {
        // 入力移動時はB/Eを出さない。戻って再タップしたときだけ表示する。
        setActiveHoleForBirdie(null);
      });


inp.addEventListener("input", () => {
        const arr = ensureHoleObj(state.scores, hole);
        const v = sanitizeDigits(inp.value);
        inp.value = v;
        arr[p] = v;

        // PARが分かるコース（やさと/江戸崎東/江戸崎南）なら、スコアからバーディー/イーグルを自動判定する
        const parForAuto = getParForHole(hole);
        if(parForAuto != null){
          const scoreNum = parseInt(v, 10);
          const isEagle = Number.isFinite(scoreNum) && scoreNum <= parForAuto - 2;
          const isBirdie = Number.isFinite(scoreNum) && scoreNum === parForAuto - 1;
          ensureBoolObj(state.birdie, hole)[p] = isBirdie;
          ensureBoolObj(state.eagle, hole)[p] = isEagle;
          bInp.checked = isBirdie;
          eInp.checked = isEagle;
        }

        save();
        recalcAll();
        applyHalfVisibility(); applyDormie();
        updateParDiffCell(hole, p);

        // ===== 自動フォーカス（次のプレイヤー） =====
        // 2桁の可能性がある「1」で始まる入力は待機し、2桁入力か他の数字で即移動
        if(v !== ""){
          const num = parseInt(v, 10);
          // 1桁で「1」の場合は待機（10〜19の2桁を考慮）
          if(v.length === 1 && num === 1){
            // 待機：次の入力を待つ（自動移動しない）
            return;
          }
          // それ以外（2〜9 の1桁、または 10〜19 の2桁）は即移動
          const moveToNext = () => {
            const nextPlayer = p + 1;
            if(nextPlayer < 4){
              const next = document.querySelector(`#s_${hole}_${nextPlayer}`);
              if(next){ next.focus(); next.select(); }
            }else{
              // 全員入力完了 → 次のホールの先頭へ
              const viewHoles = state.viewHalf === "IN"
                ? [10,11,12,13,14,15,16,17,18]
                : [1,2,3,4,5,6,7,8,9];
              const hIdx = viewHoles.indexOf(hole);
              if(hIdx >= 0 && hIdx < viewHoles.length - 1){
                const nextHole = viewHoles[hIdx + 1];
                const nextInp = document.getElementById(`s_${nextHole}_0`);
                if(nextInp){
                  nextInp.scrollIntoView({behavior:"smooth", block:"center"});
                  setTimeout(()=>{ nextInp.focus(); nextInp.select(); }, 100);
                }
              }
            }
          };
          moveToNext();
        }
      });

      // 「1」で待機中、フォーカスが外れたら確定として次へ移動しない（blur時に保存済み）
      inp.addEventListener("keydown", (e) => {
        const v = sanitizeDigits(inp.value);
        // Enterキーで「1」入力を確定して次へ移動
        if(e.key === "Enter" && v !== ""){
          e.preventDefault();
          const nextPlayer = p + 1;
          if(nextPlayer < 4){
            const next = document.querySelector(`#s_${hole}_${nextPlayer}`);
            if(next){ next.focus(); next.select(); }
          }else{
            // 全員入力完了 → 次のホールの先頭へ
            const viewHoles = state.viewHalf === "IN"
              ? [10,11,12,13,14,15,16,17,18]
              : [1,2,3,4,5,6,7,8,9];
            const hIdx = viewHoles.indexOf(hole);
            if(hIdx >= 0 && hIdx < viewHoles.length - 1){
              const nextHole = viewHoles[hIdx + 1];
              const nextInp = document.getElementById(`s_${nextHole}_0`);
              if(nextInp){
                nextInp.scrollIntoView({behavior:"smooth", block:"center"});
                setTimeout(()=>{ nextInp.focus(); nextInp.select(); }, 100);
              }
            }
          }
        }
      });

      // バーディーチェック（PARが不明なコースのみ手動チェックを表示）
      const bw = document.createElement("label");
      bw.className = "birdieWrap";
      bw.setAttribute("data-hole", String(hole));
      bw.innerHTML = `<span>B</span><input type="checkbox" id="b_${hole}_${p}"><span>E</span><input type="checkbox" id="e_${hole}_${p}">`;
      const bInp = bw.querySelector(`#b_${hole}_${p}`);
      const eInp = bw.querySelector(`#e_${hole}_${p}`);

      const bArr = ensureBoolObj(state.birdie, hole);
      const eArr = ensureBoolObj(state.eagle, hole);

      bInp.checked = !!bArr[p];
      eInp.checked = !!eArr[p];

      // 手動チェックは PAR 不明コースのみ有効
      if (!par) {
        bInp.addEventListener("change", () => {
          const a = ensureBoolObj(state.birdie, hole);
          a[p] = !!bInp.checked;
          save();
          recalcAll();
        });

        eInp.addEventListener("change", () => {
          const a = ensureBoolObj(state.eagle, hole);
          a[p] = !!eInp.checked;
          save();
          recalcAll();
        });

        enableBirdieWrapOnRetap(inp, hole);
      }

      // PAR差分表記（やさと/江戸崎東/江戸崎南のみ）
      const pd = document.createElement("span");
      pd.className = "parDiffLabel";
      pd.id = `pd_${hole}_${p}`;

      cell.appendChild(inp);
      cell.appendChild(pd);
      if (!par) cell.appendChild(bw);
      td.appendChild(cell);
      tr.appendChild(td);

      updateParDiffCell(hole, p);
    }

    return tr;
  }

  /** スコア入力欄の隣にPAR差分（ー/(+1)/(+2)/(-1)等）を表示する。対象コース以外では非表示。 */
  function updateParDiffCell(hole, p){
    const span = document.getElementById(`pd_${hole}_${p}`);
    if(!span) return;
    const cell = span.closest(".scoreCell");
    const scoreVal = state.scores[hole]?.[p];
    const label = parDiffText(scoreVal, hole);
    span.textContent = label;
    if(cell) cell.classList.toggle("hasParDiff", label !== "");
  }

  function makeGamesRow(hole){
    const tr = document.createElement("tr");
    tr.setAttribute("data-hole", String(hole));

    const th = document.createElement("th");
    th.className = "sticky holeCol";
    th.textContent = holeLabel(hole);
    tr.appendChild(th);

    // Olympic: 手入力（-15などOK）
    for(let p=0;p<4;p++){
      const td = document.createElement("td");
      td.className = "scoreCol olyCol";

      const cell_o = document.createElement("div");
      cell_o.className = "scoreCell";

      const inp = document.createElement("input");
      inp.className = "scoreInput olyInput";
      inp.type = "text";
      inp.inputMode = "numeric";
      inp.pattern = "[-0-9]*";
      inp.autocomplete = "off";
      inp.value = (state.games.olympic[hole] && state.games.olympic[hole][p] !== undefined) ? state.games.olympic[hole][p] : "";

      inp.addEventListener("input", () => {
        const arr = ensureHoleObj(state.games.olympic, hole);
        const v = sanitizeSignedInt(inp.value);
        inp.value = v;
        arr[p] = v;
        save();
        recalcAll();
        applyHalfVisibility(); applyDormie();
      });

      inp.addEventListener("focus", () => {
        setActiveHoleForBirdie(hole);
        const o = state.games.vegasOverride?.[hole]?.[p];
        const hasOverride = (o ?? "").toString().trim() !== "";
        if(!hasOverride){
          inp.value = sanitizeSignedInt(inp.value);
        }
      });
      inp.addEventListener("blur", () => {
        recalcAll();
      });

      cell_o.appendChild(inp);
      td.appendChild(cell_o);
      tr.appendChild(td);
    }

    // Vegas: 既定は自動表示だが、手入力で上書き可能（空欄に戻すと自動に戻る）
    for(let p=0;p<4;p++){
      const td = document.createElement("td");
      td.className = "scoreCol vegasCol";

      const inp = document.createElement("input");
      inp.className = "scoreInput vegasInput";
      inp.type = "text";
      inp.inputMode = "numeric";
      inp.pattern = "[-0-9+]*";
      inp.autocomplete = "off";
      inp.id = `vegasInp_${hole}_${p}`;

      // 初期値はrecalcAll()で自動/上書きを反映してセットする
      inp.value = "";

      inp.addEventListener("input", () => {
        const arr = ensureHoleObj(state.games.vegasOverride, hole);
        const v = sanitizeSignedInt(inp.value);
        inp.value = v;
        arr[p] = v; // ""なら自動に戻る
        // 行が全部空なら掃除（任意）
        if(arr.every(x => (x ?? "") === "")) delete state.games.vegasOverride[hole];
        save();
        recalcAll();
        inp.value = v;
      });

      inp.addEventListener("focus", () => {
        setActiveHoleForBirdie(hole);
        const overrideRaw = state.games.vegasOverride?.[hole]?.[p];
        const hasOverride = (overrideRaw ?? "").toString().trim() !== "";
        if(hasOverride){
          inp.value = sanitizeSignedInt(String(overrideRaw));
        }else{
          const autoVegas = calcVegasPoints(typeof getVegasOrder === "function" ? getVegasOrder() : orderOUT);
          const autoVal = autoVegas.pointsByHole?.[hole]?.[p];
          inp.value = (autoVal === "" || autoVal === null || autoVal === undefined) ? "" : (autoVal > 0 ? `+${autoVal}` : `${autoVal}`);
        }
        setTimeout(() => { try{ inp.select(); }catch(e){} }, 0);
      });

      inp.addEventListener("blur", () => {
        const arr = ensureHoleObj(state.games.vegasOverride, hole);
        const v = sanitizeSignedInt(inp.value);
        arr[p] = v;
        if(arr.every(x => (x ?? "") === "")) delete state.games.vegasOverride[hole];
        save();
        recalcAll();
      });

      const cell_v = document.createElement("div");
      cell_v.className = "scoreCell";
      cell_v.appendChild(inp);
      td.appendChild(cell_v);
      tr.appendChild(td);
    }

    return tr;
  }

  function makeOlyRow(hole){
    const tr = document.createElement("tr");
    tr.setAttribute("data-hole", String(hole));
    const th = document.createElement("th");
    th.className = "sticky holeCol";
    th.style.whiteSpace = "nowrap";

    const numSpan = document.createElement("span");
    numSpan.textContent = holeLabel(hole);
    numSpan.style.verticalAlign = "middle";

    // ロック中のホールだけ表示される「修正」ボタン（押すとそのホールだけ入力可能になる）
    const fixBtn = document.createElement("button");
    fixBtn.type = "button";
    fixBtn.className = "olyFixBtn";
    fixBtn.textContent = "修正";
    fixBtn.style.display = "none";
    fixBtn.addEventListener("click", (e) => {
      e.preventDefault();
      olyUserUnlocked.add(hole);
      applyOlyLock();
    });

    th.appendChild(numSpan);
    th.appendChild(fixBtn);

    tr.appendChild(th);

    for(let p=0;p<4;p++){
      const td = document.createElement("td");
      td.className = "scoreCol olyCol";
      const inp = document.createElement("input");
      inp.className = "scoreInput olyInput";
      inp.id = `oly_${hole}_${p}`;
      inp.type = "text"; inp.inputMode = "numeric"; inp.pattern = "[-0-9]*";
      inp.autocomplete = "off";
      inp.value = (state.games.olympic[hole]?.[p] ?? "");

      const moveToNextOlyPlayer = () => {
        const nextPlayer = p + 1;
        if(nextPlayer < 4){
          const next = document.getElementById(`oly_${hole}_${nextPlayer}`);
          if(next){ next.focus(); next.select(); }
        } else {
          // 最後のプレイヤー → 次ホールの増（プレイヤー0）へ
          const nextHole = hole + 1;
          const nextInp = document.getElementById(`oly_${nextHole}_0`);
          if(nextInp){
            nextInp.scrollIntoView({behavior:"smooth", block:"center"});
            setTimeout(() => { nextInp.focus(); nextInp.select(); }, 150);
          }
        }
      };

      inp.addEventListener("input", () => {
        const arr = ensureHoleObj(state.games.olympic, hole);
        const v = sanitizeSignedInt(inp.value); inp.value = v; arr[p] = v;
        save(); recalcAll(); applyHalfVisibility(); applyDormie();
        applyOlyLock();

        // ===== 自動フォーカス（次のプレイヤー） =====
        // オリンピックの点数は10の位が1以外ありえないので、「1」以外の数字が
        // 入力された時点で（1桁で）確定とみなし即移動。「1」で始まる場合のみ
        // 2桁目（例:15）を待って待機する。
        const digits = v.replace("-", "");
        if(digits !== ""){
          if(digits.length === 1 && digits === "1"){
            return;
          }
          moveToNextOlyPlayer();
        }
      });
      inp.addEventListener("keydown", (e) => {
        const digits = sanitizeSignedInt(inp.value).replace("-", "");
        // 「1」で待機中でも、Enterキーで確定して次へ移動できるようにする
        if(e.key === "Enter" && digits !== ""){
          e.preventDefault();
          moveToNextOlyPlayer();
        }
      });
      inp.addEventListener("blur", () => recalcAll());
      td.appendChild(inp);
      tr.appendChild(td);
    }
    return tr;
  }

  function applyOlyHighlight(){
    const mode = state.viewHalf || "OUT";
    const holes = mode === "IN"
      ? [10,11,12,13,14,15,16,17,18]
      : [1,2,3,4,5,6,7,8,9];

    // 全行リセット
    holes.forEach(h => {
      const tr = document.querySelector(`#olyBody tr[data-hole="${h}"]`);
      if(!tr) return;
      tr.querySelectorAll("td").forEach(td => td.style.background = "");
      const th = tr.querySelector("th");
      if(th){ th.style.background = ""; th.style.color = ""; }
    });

    // チェック済みが1つ以上あれば、最初の未チェックホールを赤くする
    const hasSomeChecked = holes.some(h => state.games.olyCb?.[h]);
    if(!hasSomeChecked) return;

    const nextHole = holes.find(h => !state.games.olyCb?.[h]);
    if(!nextHole) return;

    const tr = document.querySelector(`#olyBody tr[data-hole="${nextHole}"]`);
    if(!tr) return;
    tr.querySelectorAll("td").forEach(td => td.style.background = "#f4b1b1");
    const th = tr.querySelector("th");
    if(th){ th.style.background = "#d40000"; th.style.color = "#fff"; }
  }

  function applyOlyLock(){
    const active = state.activeOlyHole;
    if(active == null) return;
    const holes = state.viewHalf === "IN"
      ? [10,11,12,13,14,15,16,17,18]
      : [1,2,3,4,5,6,7,8,9];
    holes.forEach(h => {
      const isBefore = h < active;
      const isFilledOly = [0,1,2,3].some(pi => (state.games.olympic[h]?.[pi] ?? "") !== "");
      // 入力済み（いずれかのプレイヤーにデータあり）のホールをロック
      const shouldLock = isBefore && isFilledOly && !olyUserUnlocked.has(h);
      for(let pi=0; pi<4; pi++){
        const inp = document.getElementById(`oly_${h}_${pi}`);
        if(!inp || document.activeElement === inp) continue;
        inp.readOnly = shouldLock;
        inp.style.opacity = shouldLock ? "0.5" : "";
        inp.style.cursor = shouldLock ? "not-allowed" : "";
        inp.title = shouldLock ? "「修正」ボタンを押すと入力できます" : "";
      }
      const fixBtn = document.querySelector(`#olyBody tr[data-hole="${h}"] .olyFixBtn`);
      if(fixBtn) fixBtn.style.display = shouldLock ? "inline-block" : "none";
    });
  }

  function makeVegasRow(hole){
    const tr = document.createElement("tr");
    tr.setAttribute("data-hole", String(hole));
    const th = document.createElement("th");
    th.className = "sticky holeCol";
    th.textContent = holeLabel(hole);
    tr.appendChild(th);
    for(let p=0;p<4;p++){
      const td = document.createElement("td");
      td.className = "scoreCol vegasCol";
      const cell = document.createElement("div");
      cell.className = "scoreCell";
      const inp = document.createElement("input");
      inp.className = "scoreInput vegasInput";
      inp.type = "text"; inp.inputMode = "numeric"; inp.pattern = "[-0-9]*";
      inp.autocomplete = "off"; inp.readOnly = true;
      inp.id = `vegasInp_${hole}_${p}`;
      inp.addEventListener("focus", () => {
        const ov = state.games.vegasOverride?.[hole]?.[p];
        if((ov ?? "") !== "") { inp.readOnly = false; }
      });
      inp.addEventListener("input", () => {
        inp.readOnly = false;
        const arr = ensureHoleObj(state.games.vegasOverride, hole);
        const v = sanitizeSignedInt(inp.value);
        if(v === ""){ arr[p] = ""; inp.value = ""; }
        else { inp.value = v; arr[p] = v; }
        save(); recalcAll(); applyHalfVisibility(); applyDormie();
      });
      inp.addEventListener("blur", () => { inp.readOnly = true; recalcAll(); });
      cell.appendChild(inp);
      td.appendChild(cell);
      tr.appendChild(td);
    }
    return tr;
  }

  function buildTables(){
    olyUserUnlocked.clear();
    scoreBody.innerHTML = "";
    const olyBody   = el("olyBody");
    const vegasBody = el("vegasBody");
    if(olyBody)   olyBody.innerHTML = "";
    if(vegasBody) vegasBody.innerHTML = "";
    const order = orderOUT;
    for(const h of order){
      scoreBody.appendChild(makeScoreRow(h));
      if(olyBody)   olyBody.appendChild(makeOlyRow(h));
      if(vegasBody) vegasBody.appendChild(makeVegasRow(h));
    }
    // makeScoreRow() 内で呼ぶ updateParDiffCell() は、行がまだ scoreBody に
    // 追加される前（document.getElementById が見つけられない状態）に実行されるため、
    // 保存済みデータを読み込んだ直後は反映されない。ここで全行が実DOMに入った後に
    // 改めて反映する（新規入力時は input イベント側で都度更新されるため問題ない）。
    for(const h of order){
      for(let p=0;p<4;p++) updateParDiffCell(h, p);
    }
    setActiveHoleForBirdie(null);
    applyHalfVisibility();
    applyOlyHighlight();
    applyOlyLock();
  }

  function rebindGamesInputs(){}
