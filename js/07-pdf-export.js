/**
 * 07-pdf-export.js
 * ------------------------------------------------------------
 * PDF出力まわり。2通りの実装が含まれる:
 *
 *   1. buildPdfDom() … HTML要素として4ページ分（スコア/オリンピック/
 *      ラスベガス/マッチ・チーム）を組み立てる。#pdfStage（画面外）に
 *      挿入される。現状は savePdf() からは使われておらず、
 *      html2pdf.js 経由の旧フロー向けに残置されている可能性がある。
 *
 *   2. savePdf() … 実際にボタンから呼ばれるメインのPDF出力処理。
 *      jsPDF を動的ロードし、各ページを <canvas> に直接描画してから
 *      画像としてPDFに貼り付ける（日本語フォントを確実に出力するため）。
 *      5ページ構成（スコア/オリンピック/ラスベガス/マッチ・チーム/精算）。
 *      列幅はページ幅(PX_W)いっぱいに引き伸ばさず、必要最小限＋左右マージンに
 *      収める（以前は右端の列がマージン無しで用紙端に張り付き、印刷時に
 *      見切れていたための調整）。
 *      保存完了後、入力データをクリアするかどうかの確認モーダルを出す。
 *
 * 依存: 01-state.js, 03-setup.js, 05a/05c-calc-*.js, 06-render.js,
 *       jsPDF（https://cdnjs.cloudflare.com/.../jspdf.umd.min.js を動的ロード）
 * 公開するもの:
 *   - buildPdfDom()
 *   - formatDateForFilename(dateStr) : 日付を令和年.月.日（例:"8.7.5"）に変換
 *   - pdfFilename()
 *   - savePdf()  … #btnPdf のクリックイベントから呼ばれる（08-events.js側で登録）
 * ------------------------------------------------------------
 */

  function buildPdfDom(){
    const order = orderOUT;
    const stage = el("pdfStage");
    stage.innerHTML = "";

    const outStarted = [1,2,3,4,5,6,7,8,9].some(h => {
      const r = state.scores[h]; return r && r.some(v => (v ?? "") !== "");
    });
    const inStarted = [10,11,12,13,14,15,16,17,18].some(h => {
      const r = state.scores[h]; return r && r.some(v => (v ?? "") !== "");
    });
    const allOrder = (!outStarted && inStarted)
      ? [10,11,12,13,14,15,16,17,18,1,2,3,4,5,6,7,8,9]
      : [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18];
    const vegasOrder = (!outStarted && inStarted)
      ? [10,11,12,13,14,15,16,17,18,1,2,3,4,5,6,7,8,9]
      : orderOUT;

    const totals = sumPlayerTotal();
    const full   = matchTeamSumsByRange(order, {from:1,to:18});
    const mOut   = matchTeamSumsByRange(order, {from:1,to:9});
    const mIn    = matchTeamSumsByRange(order, {from:10,to:18});
    const vegas  = calcVegasPoints(vegasOrder);
    const teamMap= teamSymbolsByOrder(order);
    const fmt    = (v)=> (v===""||v===null||v===undefined) ? "" : (v>0?`+${v}`:`${v}`);
    const N      = state.names;

    // スマホ最適化：大きめフォント・余裕のある行高
    const PW  = 370;
    const FS  = "font-size:14px;";
    const RH  = "height:30px;line-height:30px;";
    const HFS = "font-size:13px;font-weight:900;";
    const TD  = `border:1px solid #444;padding:0 2px;text-align:center;${FS}${RH}`;
    const TH  = `border:1px solid #444;padding:0 2px;background:#d8d8d8;font-weight:800;text-align:center;${FS}${RH}`;
    const SUB = `border:1px solid #444;padding:0 2px;background:#bbb;font-weight:900;text-align:center;font-size:14px;height:30px;line-height:30px;`;
    const TOT = `border:1px solid #444;padding:0 2px;background:#111;color:#fff;font-weight:900;text-align:center;font-size:15px;height:34px;line-height:34px;`;
    const HDR = `font-size:16px;font-weight:900;margin:0 0 6px;border-bottom:2px solid #000;padding-bottom:3px;`;
    const FONT= `font-family:system-ui,-apple-system,'Hiragino Kaku Gothic ProN','Noto Sans JP',sans-serif;`;
    const PAGE= `${FONT}background:#fff;color:#000;padding:0;width:390px;box-sizing:border-box;page-break-after:always;`;
    const LAST= `${FONT}background:#fff;color:#000;padding:0;width:390px;box-sizing:border-box;`;
    // 勝者
    let matchLead=0, remaining=0;
    [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18].forEach(h=>{
      const a=getScore(h,0),b=getScore(h,1);
      if(a!==null&&b!==null){if(a<b)matchLead++;else if(a>b)matchLead--;}else remaining++;
    });
    const trophy1 = (matchLead>0&&Math.abs(matchLead)>remaining)?"🏆":"";
    const trophy2 = (matchLead<0&&Math.abs(matchLead)>remaining)?"🏆":"";

    function vegasHalfSum(from,to){
      const s=[0,0,0,0],a=[false,false,false,false];
      for(let h=from;h<=to;h++){const row=vegas.pointsByHole[h];if(!row)continue;for(let p=0;p<4;p++){if(row[p]!==""&&row[p]!==null&&row[p]!==undefined){s[p]+=row[p];a[p]=true;}}}
      return s.map((v,i)=>a[i]?(v===0?"0":String(v)):"");
    }

    // 列幅
    const hW = 28;
    const s4W = Math.floor((PW - hW) / 4);
    const m2W = 36;
    const m4W = Math.floor((PW - hW - m2W*2) / 4);

    const col4 = `<colgroup><col style="width:${hW}px">${[0,1,2,3].map(()=>`<col style="width:${s4W}px">`).join("")}</colgroup>`;
    const colM = `<colgroup><col style="width:${hW}px"><col style="width:${m2W}px"><col style="width:${m2W}px">${[0,1,2,3].map(()=>`<col style="width:${m4W}px">`).join("")}</colgroup>`;

    const head4= (n1,n2)=>`<tr><th style="${TH}">H</th><th style="${TH}">${n1}</th><th style="${TH}">${n2||N[1]}</th><th style="${TH}">${N[2]}</th><th style="${TH}">${N[3]}</th></tr>`;
    const headM= `<tr><th style="${TH}">H</th><th style="${TH}">M戦</th><th style="${TH}">T戦</th><th style="${TH}">${N[0]}</th><th style="${TH}">${N[1]}</th><th style="${TH}">${N[2]}</th><th style="${TH}">${N[3]}</th></tr>`;

    const hCell= (h)=>{const bg=h>=10?"background:#555;":"background:#222;";return`<td style="${bg}color:#fff;font-weight:900;${TD}${HFS}">${h}</td>`;};
    function sRow(h){return`<tr>${hCell(h)}<td style="${TD}">${state.scores[h]?.[0]??""}</td><td style="${TD}">${state.scores[h]?.[1]??""}</td><td style="${TD}">${state.scores[h]?.[2]??""}</td><td style="${TD}">${state.scores[h]?.[3]??""}</td></tr>`;}
    function oRow(h){return`<tr>${hCell(h)}<td style="${TD}">${state.games.olympic[h]?.[0]??""}</td><td style="${TD}">${state.games.olympic[h]?.[1]??""}</td><td style="${TD}">${state.games.olympic[h]?.[2]??""}</td><td style="${TD}">${state.games.olympic[h]?.[3]??""}</td></tr>`;}
    function vCell(v){if(v===""||v===null||v===undefined)return`<td style="${TD}"></td>`;const c=v>0?"color:#c00;font-weight:800":v<0?"color:#06c;font-weight:800":"";return`<td style="${TD}${c}">${fmt(v)}</td>`;}
    function vRow(h){const row=vegas.pointsByHole[h]||["","","",""];return`<tr>${hCell(h)}${[0,1,2,3].map(p=>vCell(row[p])).join("")}</tr>`;}
    function mRow(h){
      const ms=matchSymbol(h),ts=teamMap[h]??"";
      const msC=ms==="〇"?"color:#c00;font-weight:900":ms==="×"?"color:#06c;font-weight:900":"";
      const tsC=ts==="〇"?"color:#c00;font-weight:900":ts==="×"?"color:#06c;font-weight:900":"";
      return`<tr>${hCell(h)}<td style="${TD}${msC}">${ms}</td><td style="${TD}${tsC}">${ts}</td><td style="${TD}">${state.scores[h]?.[0]??""}</td><td style="${TD}">${state.scores[h]?.[1]??""}</td><td style="${TD}">${state.scores[h]?.[2]??""}</td><td style="${TD}">${state.scores[h]?.[3]??""}</td></tr>`;
    }
    function sub4(l,v0,v1,v2,v3){return`<tr><th style="${SUB}">${l}</th><td style="${SUB}">${v0}</td><td style="${SUB}">${v1}</td><td style="${SUB}">${v2}</td><td style="${SUB}">${v3}</td></tr>`;}
    function tot4(v0,v1,v2,v3){return`<tr><th style="${TOT}">合計</th><td style="${TOT}">${v0}</td><td style="${TOT}">${v1}</td><td style="${TOT}">${v2}</td><td style="${TOT}">${v3}</td></tr>`;}
    function subM(l,v0,v1,v2,v3,m,t){return`<tr><th style="${SUB}">${l}</th><td style="${SUB}">${m}</td><td style="${SUB}">${t}</td><td style="${SUB}">${v0}</td><td style="${SUB}">${v1}</td><td style="${SUB}">${v2}</td><td style="${SUB}">${v3}</td></tr>`;}
    function totM(v0,v1,v2,v3,m,t){return`<tr><th style="${TOT}">合計</th><td style="${TOT}">${m}</td><td style="${TOT}">${t}</td><td style="${TOT}">${v0}</td><td style="${TOT}">${v1}</td><td style="${TOT}">${v2}</td><td style="${TOT}">${v3}</td></tr>`;}
    function vSubRow(l,sums){const cells=[0,1,2,3].map(p=>{const v=sums[p];if(v===""||v===null||v===undefined)return`<td style="${SUB}"></td>`;const n=parseInt(v,10);const c=n>0?"color:#c00":n<0?"color:#06c":"";return`<td style="${SUB}${c}">${v}</td>`;}).join("");return`<tr><th style="${SUB}">${l}</th>${cells}</tr>`;}
    function vTotRow(){const cells=[0,1,2,3].map(p=>{const v=vegas.totals[p];const c=v>0?"color:#c00":v<0?"color:#06c":"";return`<td style="${TOT}${c}">${(v||v===0)?v:""}</td>`;}).join("");return`<tr><th style="${TOT}">合計</th>${cells}</tr>`;}

    let sRows="",oRows="",vRows="",mRows="";
    for(const h of allOrder){
      sRows+=sRow(h); oRows+=oRow(h); vRows+=vRow(h); mRows+=mRow(h);
      if(h===9){
        sRows+=sub4("OUT",sumRangeForPlayer(0,1,9)||"",sumRangeForPlayer(1,1,9)||"",sumRangeForPlayer(2,1,9)||"",sumRangeForPlayer(3,1,9)||"");
        oRows+=sub4("OUT",sumOlympicRange(0,1,9)||"",sumOlympicRange(1,1,9)||"",sumOlympicRange(2,1,9)||"",sumOlympicRange(3,1,9)||"");
        vRows+=vSubRow("OUT",vegasHalfSum(1,9));
        mRows+=subM("OUT",sumRangeForPlayer(0,1,9)||"",sumRangeForPlayer(1,1,9)||"",sumRangeForPlayer(2,1,9)||"",sumRangeForPlayer(3,1,9)||"",mOut.match,mOut.team);
      }
      if(h===18){
        sRows+=sub4("IN",sumRangeForPlayer(0,10,18)||"",sumRangeForPlayer(1,10,18)||"",sumRangeForPlayer(2,10,18)||"",sumRangeForPlayer(3,10,18)||"");
        oRows+=sub4("IN",sumOlympicRange(0,10,18)||"",sumOlympicRange(1,10,18)||"",sumOlympicRange(2,10,18)||"",sumOlympicRange(3,10,18)||"");
        vRows+=vSubRow("IN",vegasHalfSum(10,18));
        mRows+=subM("IN",sumRangeForPlayer(0,10,18)||"",sumRangeForPlayer(1,10,18)||"",sumRangeForPlayer(2,10,18)||"",sumRangeForPlayer(3,10,18)||"",mIn.match,mIn.team);
      }
    }

    const metaLine = `<div style="font-size:18px;font-weight:900;margin-bottom:3px;">⛳ ${state.course||"ゴルフスコア"}</div><div style="font-size:13px;color:#555;margin-bottom:10px;">${state.date||""}</div>`;

    const html =
      `<div class="pdf-page" style="${PAGE}">${metaLine}<div style="${HDR}">📋 スコア</div><table style="border-collapse:collapse;table-layout:fixed;width:100%;">${col4}<thead>${head4(trophy1+N[0], trophy2+N[1])}</thead><tbody>${sRows}</tbody><tfoot>${tot4(totals[0]||"",totals[1]||"",totals[2]||"",totals[3]||"")}</tfoot></table></div>` +
      `<div class="pdf-page" style="${PAGE}">${metaLine}<div style="${HDR}">🏅 オリンピック</div><table style="border-collapse:collapse;table-layout:fixed;width:100%;">${col4}<thead>${head4(N[0],N[1])}</thead><tbody>${oRows}</tbody><tfoot>${tot4(sumOlympicRange(0,1,18)||"",sumOlympicRange(1,1,18)||"",sumOlympicRange(2,1,18)||"",sumOlympicRange(3,1,18)||"")}</tfoot></table></div>` +
      `<div class="pdf-page" style="${PAGE}">${metaLine}<div style="${HDR}">🎰 ラスベガス</div><table style="border-collapse:collapse;table-layout:fixed;width:100%;">${col4}<thead>${head4(N[0],N[1])}</thead><tbody>${vRows}</tbody><tfoot>${vTotRow()}</tfoot></table></div>` +
      `<div class="pdf-page" style="${LAST}">${metaLine}<div style="${HDR}">⚔️ マッチ / チーム戦</div><table style="border-collapse:collapse;table-layout:fixed;width:100%;">${colM}<thead>${headM}</thead><tbody>${mRows}</tbody><tfoot>${totM(totals[0]||"",totals[1]||"",totals[2]||"",totals[3]||"",full.match,full.team)}</tfoot></table></div>`;

    const page = document.createElement("div");
    page.innerHTML = html;
    stage.appendChild(page);
    return stage;
  }

  /** 日付("YYYY-MM-DD")を令和年.月.日（先頭0埋め無し。例: 2026-07-05 → "8.7.5"）に変換する */
  function formatDateForFilename(dateStr){
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr || "");
    if(!m) return dateStr || "nodate";
    const [, y, mo, d] = m;
    const reiwaYear = parseInt(y, 10) - 2018;
    return `${reiwaYear}.${parseInt(mo,10)}.${parseInt(d,10)}`;
  }

  function pdfFilename(){
    const d = formatDateForFilename(state.date);
    const c = (state.course || "nocourse").replace(/[\\/:*?"<>|]/g,"_");
    const s = sumOutInForPlayer(0); // 増
    const out   = (s.out   || 0);
    const inn   = (s.inn   || 0);
    const total = out + inn;
    return `${d}_${c}_OUT${out}_IN${inn}_合計${total}.pdf`;
  }

  async function savePdf(){
    // jsPDF を動的ロード
    if(!window.jspdf){
      await new Promise((resolve, reject) => {
        const s = document.createElement("script");
        s.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
        s.onload = resolve; s.onerror = reject;
        document.head.appendChild(s);
      });
    }
    const { jsPDF } = window.jspdf;

    const order = orderOUT;
    const outStarted = [1,2,3,4,5,6,7,8,9].some(h => { const r=state.scores[h]; return r&&r.some(v=>(v??"")!==""); });
    const inStarted  = [10,11,12,13,14,15,16,17,18].some(h => { const r=state.scores[h]; return r&&r.some(v=>(v??"")!==""); });
    const allOrder   = (!outStarted&&inStarted)?[10,11,12,13,14,15,16,17,18,1,2,3,4,5,6,7,8,9]:[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18];
    const vegasOrder = (!outStarted&&inStarted)?[10,11,12,13,14,15,16,17,18,1,2,3,4,5,6,7,8,9]:orderOUT;
    const totals  = sumPlayerTotal();
    const full    = matchTeamSumsByRange(order,{from:1,to:18});
    const mOut    = matchTeamSumsByRange(order,{from:1,to:9});
    const mIn     = matchTeamSumsByRange(order,{from:10,to:18});
    const vegas   = calcVegasPoints(vegasOrder);
    const teamMap = teamSymbolsByOrder(order);
    const N       = state.names;
    const fmt     = (v)=>(v===""||v===null||v===undefined)?"":(v>0?`+${v}`:`${v}`);

    let matchLead=0,remaining=0;
    [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18].forEach(h=>{
      const a=getScore(h,0),b=getScore(h,1);
      if(a!==null&&b!==null){if(a<b)matchLead++;else if(a>b)matchLead--;}else remaining++;
    });
    const trophy1=(matchLead>0&&Math.abs(matchLead)>remaining)?"★":"";
    const trophy2=(matchLead<0&&Math.abs(matchLead)>remaining)?"★":"";

    function vegasHalfSum(from,to){
      const s=[0,0,0,0],a=[false,false,false,false];
      for(let h=from;h<=to;h++){const row=vegas.pointsByHole[h];if(!row)continue;for(let p=0;p<4;p++){if(row[p]!==""&&row[p]!==null&&row[p]!==undefined){s[p]+=row[p];a[p]=true;}}}
      return s.map((v,i)=>a[i]?(v===0?"0":String(v)):"");
    }

    // === Canvas描画でページ画像を生成してPDFに貼る（日本語フォント対応）===
    // 列幅は必要な分だけに抑え、両端に余白を残す（以前は794px幅いっぱいに引き伸ばしていたため
    // 右端の列が余白ゼロで用紙の端に張り付き、印刷時に見切れる原因になっていた）。
    const SCALE = 2;
    const PX_W  = 500;
    const JFONT = `"Hiragino Kaku Gothic ProN","Noto Sans JP","Yu Gothic",sans-serif`;
    const ROW_H = 28;
    const SUB_H = 28;
    const TOT_H = 32;
    const TITLE_H = 56;
    const MARGIN = 20;
    const CW = PX_W - MARGIN*2;
    const HOLE_W = 40;
    const COL4_W = (CW - HOLE_W) / 4;
    const MATCH_W = 40;
    const COL4M_W = (CW - HOLE_W - MATCH_W*2) / 4;
    const SETTLE_LABEL_W = 115;
    const COL4S_W = (CW - SETTLE_LABEL_W) / 4;

    function makeCanvas(height){
      const cv = document.createElement("canvas");
      cv.width  = PX_W * SCALE;
      cv.height = height * SCALE;
      const ctx = cv.getContext("2d");
      ctx.scale(SCALE, SCALE);
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, PX_W, height);
      return {cv, ctx};
    }

    function drawCell(ctx, x, y, w, h, text, opts={}){
      const bg   = opts.bg   || null;
      const fg   = opts.fg   || "#000";
      const bold = opts.bold || false;
      const fs   = opts.fs   || 14;
      if(bg){
        ctx.fillStyle = bg;
        ctx.fillRect(x, y, w, h);
      }
      ctx.strokeStyle = "#777";
      ctx.lineWidth = 0.5;
      ctx.strokeRect(x+0.25, y+0.25, w-0.5, h-0.5);
      if(text !== "" && text !== null && text !== undefined){
        ctx.fillStyle = fg;
        ctx.font = `${bold?"700":"400"} ${fs}px ${JFONT}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(String(text), x+w/2, y+h/2);
      }
    }

    function drawMeta(ctx, y, sectionTitle){
      ctx.fillStyle = "#000";
      ctx.font = `700 22px ${JFONT}`;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText("⛳ " + (state.course||"Golf Score"), MARGIN, y+16);
      ctx.font = `400 13px ${JFONT}`;
      ctx.fillStyle = "#555";
      ctx.textAlign = "right";
      ctx.fillText(state.date||"", PX_W-MARGIN, y+16);
      ctx.fillStyle = "#000";
      ctx.font = `700 17px ${JFONT}`;
      ctx.textAlign = "left";
      ctx.fillText(sectionTitle, MARGIN, y+40);
      ctx.strokeStyle = "#000";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(MARGIN, y+50);
      ctx.lineTo(PX_W-MARGIN, y+50);
      ctx.stroke();
    }

    function draw4Head(ctx, y, cols){
      let x=MARGIN;
      drawCell(ctx,x,y,HOLE_W,ROW_H,"H",{bg:"#222",fg:"#fff",bold:true,fs:13}); x+=HOLE_W;
      cols.forEach(n=>{ drawCell(ctx,x,y,COL4_W,ROW_H,n,{bg:"#ccc",bold:true,fs:13}); x+=COL4_W; });
      return y+ROW_H;
    }
    function draw4Row(ctx, y, h, vals){
      const isIN=h>=10;
      let x=MARGIN;
      drawCell(ctx,x,y,HOLE_W,ROW_H,h,{bg:isIN?"#555":"#222",fg:"#fff",bold:true,fs:14}); x+=HOLE_W;
      vals.forEach(v=>{ drawCell(ctx,x,y,COL4_W,ROW_H,v??"",{fs:14}); x+=COL4_W; });
      return y+ROW_H;
    }
    function draw4Sub(ctx, y, label, vals){
      let x=MARGIN;
      drawCell(ctx,x,y,HOLE_W,SUB_H,label,{bg:"#aaa",bold:true,fs:13}); x+=HOLE_W;
      vals.forEach(v=>{ drawCell(ctx,x,y,COL4_W,SUB_H,v??"",{bg:"#aaa",bold:true,fs:14}); x+=COL4_W; });
      return y+SUB_H;
    }
    function draw4Tot(ctx, y, vals){
      let x=MARGIN;
      drawCell(ctx,x,y,HOLE_W,TOT_H,"合計",{bg:"#111",fg:"#fff",bold:true,fs:13}); x+=HOLE_W;
      vals.forEach(v=>{ drawCell(ctx,x,y,COL4_W,TOT_H,v??"",{bg:"#111",fg:"#fff",bold:true,fs:16}); x+=COL4_W; });
      return y+TOT_H;
    }
    function draw4VRow(ctx, y, h, row){
      const isIN=h>=10;
      let x=MARGIN;
      drawCell(ctx,x,y,HOLE_W,ROW_H,h,{bg:isIN?"#555":"#222",fg:"#fff",bold:true,fs:14}); x+=HOLE_W;
      row.forEach(v=>{
        const fg=(v===""||v===null||v===undefined)?"#000":v>0?"#c00":"#06c";
        const bold=(v!==""&&v!==null&&v!==undefined);
        drawCell(ctx,x,y,COL4_W,ROW_H,v===""||v===null||v===undefined?"":fmt(v),{fg,bold,fs:14}); x+=COL4_W;
      });
      return y+ROW_H;
    }
    function draw4VSub(ctx, y, label, sums){
      let x=MARGIN;
      drawCell(ctx,x,y,HOLE_W,SUB_H,label,{bg:"#aaa",bold:true,fs:13}); x+=HOLE_W;
      sums.forEach(v=>{
        const n=parseInt(v,10);
        const fg=(v==="")?"#000":n>0?"#c00":n<0?"#06c":"#000";
        drawCell(ctx,x,y,COL4_W,SUB_H,v??"",{bg:"#aaa",fg,bold:true,fs:14}); x+=COL4_W;
      });
      return y+SUB_H;
    }
    function draw4VTot(ctx, y){
      let x=MARGIN;
      drawCell(ctx,x,y,HOLE_W,TOT_H,"合計",{bg:"#111",fg:"#fff",bold:true,fs:13}); x+=HOLE_W;
      [0,1,2,3].forEach(p=>{
        const v=vegas.totals[p];
        const fg=v>0?"#f88":v<0?"#88f":"#fff";
        drawCell(ctx,x,y,COL4_W,TOT_H,(v||v===0)?v:"",{bg:"#111",fg,bold:true,fs:16}); x+=COL4_W;
      });
      return y+TOT_H;
    }
    function drawMHead(ctx, y){
      let x=MARGIN;
      drawCell(ctx,x,y,HOLE_W,ROW_H,"H",{bg:"#222",fg:"#fff",bold:true,fs:13}); x+=HOLE_W;
      drawCell(ctx,x,y,MATCH_W,ROW_H,"M戦",{bg:"#ccc",bold:true,fs:13}); x+=MATCH_W;
      drawCell(ctx,x,y,MATCH_W,ROW_H,"T戦",{bg:"#ccc",bold:true,fs:13}); x+=MATCH_W;
      [N[0],N[1],N[2],N[3]].forEach(n=>{ drawCell(ctx,x,y,COL4M_W,ROW_H,n,{bg:"#ccc",bold:true,fs:13}); x+=COL4M_W; });
      return y+ROW_H;
    }
    function drawMRow(ctx, y, h){
      const isIN=h>=10;
      const ms=matchSymbol(h),ts=teamMap[h]??"";
      const msC=ms==="○"?"#c00":ms==="×"?"#06c":"#000";
      const tsC=ts==="○"?"#c00":ts==="×"?"#06c":"#000";
      let x=MARGIN;
      drawCell(ctx,x,y,HOLE_W,ROW_H,h,{bg:isIN?"#555":"#222",fg:"#fff",bold:true,fs:14}); x+=HOLE_W;
      drawCell(ctx,x,y,MATCH_W,ROW_H,ms,{fg:msC,bold:ms!=="",fs:14}); x+=MATCH_W;
      drawCell(ctx,x,y,MATCH_W,ROW_H,ts,{fg:tsC,bold:ts!=="",fs:14}); x+=MATCH_W;
      [0,1,2,3].forEach(p=>{ drawCell(ctx,x,y,COL4M_W,ROW_H,state.scores[h]?.[p]??"",{fs:14}); x+=COL4M_W; });
      return y+ROW_H;
    }
    function drawMSub(ctx, y, label, vals, m, t){
      let x=MARGIN;
      drawCell(ctx,x,y,HOLE_W,SUB_H,label,{bg:"#aaa",bold:true,fs:13}); x+=HOLE_W;
      drawCell(ctx,x,y,MATCH_W,SUB_H,m??"",{bg:"#aaa",bold:true,fs:14}); x+=MATCH_W;
      drawCell(ctx,x,y,MATCH_W,SUB_H,t??"",{bg:"#aaa",bold:true,fs:14}); x+=MATCH_W;
      vals.forEach(v=>{ drawCell(ctx,x,y,COL4M_W,SUB_H,v??"",{bg:"#aaa",bold:true,fs:14}); x+=COL4M_W; });
      return y+SUB_H;
    }
    function drawMTot(ctx, y, vals, m, t){
      let x=MARGIN;
      drawCell(ctx,x,y,HOLE_W,TOT_H,"合計",{bg:"#111",fg:"#fff",bold:true,fs:13}); x+=HOLE_W;
      drawCell(ctx,x,y,MATCH_W,TOT_H,m??"",{bg:"#111",fg:"#fff",bold:true,fs:16}); x+=MATCH_W;
      drawCell(ctx,x,y,MATCH_W,TOT_H,t??"",{bg:"#111",fg:"#fff",bold:true,fs:16}); x+=MATCH_W;
      vals.forEach(v=>{ drawCell(ctx,x,y,COL4M_W,TOT_H,v??"",{bg:"#111",fg:"#fff",bold:true,fs:16}); x+=COL4M_W; });
      return y+TOT_H;
    }

    function calcPageHeight(){
      return TITLE_H + ROW_H + allOrder.length*ROW_H + 2*SUB_H + TOT_H + 20;
    }

    // ===== 精算ページ用の描画関数 =====
    function drawSettleHead(ctx, y){
      let x=MARGIN;
      drawCell(ctx,x,y,SETTLE_LABEL_W,ROW_H,"精算",{bg:"#222",fg:"#fff",bold:true,fs:13}); x+=SETTLE_LABEL_W;
      [N[0],N[1],N[2],N[3]].forEach(n=>{ drawCell(ctx,x,y,COL4S_W,ROW_H,n,{bg:"#ccc",bold:true,fs:13}); x+=COL4S_W; });
      return y+ROW_H;
    }
    function drawSettleRow(ctx, y, label, vals, isTotal){
      let x=MARGIN;
      const bg = isTotal ? "#111" : "#eee";
      const labelFg = isTotal ? "#fff" : "#000";
      drawCell(ctx,x,y,SETTLE_LABEL_W,ROW_H,label,{bg,fg:labelFg,bold:true,fs:13}); x+=SETTLE_LABEL_W;
      vals.forEach(v=>{
        const n = parseInt(v,10);
        const fg = isTotal ? (n>0?"#f88":n<0?"#88f":"#fff") : (n>0?"#c00":n<0?"#06c":"#000");
        drawCell(ctx,x,y,COL4S_W,ROW_H,v,{bg,fg,bold:true,fs:14}); x+=COL4S_W;
      });
      return y+ROW_H;
    }

    const pH = calcPageHeight();

    // ===== ページ1: スコア =====
    const {cv:cv1, ctx:c1} = makeCanvas(pH);
    drawMeta(c1, 0, "📋 Score");
    let y1 = TITLE_H;
    y1 = draw4Head(c1, y1, [trophy1+N[0], trophy2+N[1], N[2], N[3]]);
    for(const h of allOrder){
      y1 = draw4Row(c1,y1,h,[state.scores[h]?.[0]??"",state.scores[h]?.[1]??"",state.scores[h]?.[2]??"",state.scores[h]?.[3]??""]);
      if(h===9) y1=draw4Sub(c1,y1,"OUT",[sumRangeForPlayer(0,1,9)||"",sumRangeForPlayer(1,1,9)||"",sumRangeForPlayer(2,1,9)||"",sumRangeForPlayer(3,1,9)||""]);
      if(h===18) y1=draw4Sub(c1,y1,"IN",[sumRangeForPlayer(0,10,18)||"",sumRangeForPlayer(1,10,18)||"",sumRangeForPlayer(2,10,18)||"",sumRangeForPlayer(3,10,18)||""]);
    }
    draw4Tot(c1,y1,[totals[0]||"",totals[1]||"",totals[2]||"",totals[3]||""]);

    // ===== ページ2: オリンピック =====
    const {cv:cv2, ctx:c2} = makeCanvas(pH);
    drawMeta(c2, 0, "🏅 Olympic");
    let y2 = TITLE_H;
    y2 = draw4Head(c2, y2, [N[0],N[1],N[2],N[3]]);
    for(const h of allOrder){
      y2 = draw4Row(c2,y2,h,[state.games.olympic[h]?.[0]??"",state.games.olympic[h]?.[1]??"",state.games.olympic[h]?.[2]??"",state.games.olympic[h]?.[3]??""]);
      if(h===9) y2=draw4Sub(c2,y2,"OUT",[sumOlympicRange(0,1,9)||"",sumOlympicRange(1,1,9)||"",sumOlympicRange(2,1,9)||"",sumOlympicRange(3,1,9)||""]);
      if(h===18) y2=draw4Sub(c2,y2,"IN",[sumOlympicRange(0,10,18)||"",sumOlympicRange(1,10,18)||"",sumOlympicRange(2,10,18)||"",sumOlympicRange(3,10,18)||""]);
    }
    draw4Tot(c2,y2,[sumOlympicRange(0,1,18)||"",sumOlympicRange(1,1,18)||"",sumOlympicRange(2,1,18)||"",sumOlympicRange(3,1,18)||""]);

    // ===== ページ3: ラスベガス =====
    const {cv:cv3, ctx:c3} = makeCanvas(pH);
    drawMeta(c3, 0, "🎰 Las Vegas");
    let y3 = TITLE_H;
    y3 = draw4Head(c3, y3, [N[0],N[1],N[2],N[3]]);
    for(const h of allOrder){
      y3 = draw4VRow(c3,y3,h,vegas.pointsByHole[h]||["","","",""]);
      if(h===9) y3=draw4VSub(c3,y3,"OUT",vegasHalfSum(1,9));
      if(h===18) y3=draw4VSub(c3,y3,"IN",vegasHalfSum(10,18));
    }
    draw4VTot(c3,y3);

    // ===== ページ4: マッチ/チーム =====
    const mH = TITLE_H + ROW_H + allOrder.length*ROW_H + 2*SUB_H + TOT_H + 20;
    const {cv:cv4, ctx:c4} = makeCanvas(mH);
    drawMeta(c4, 0, "⚔️ Match / Team");
    let y4 = TITLE_H;
    y4 = drawMHead(c4, y4);
    for(const h of allOrder){
      y4 = drawMRow(c4,y4,h);
      if(h===9) y4=drawMSub(c4,y4,"OUT",[sumRangeForPlayer(0,1,9)||"",sumRangeForPlayer(1,1,9)||"",sumRangeForPlayer(2,1,9)||"",sumRangeForPlayer(3,1,9)||""],mOut.match,mOut.team);
      if(h===18) y4=drawMSub(c4,y4,"IN",[sumRangeForPlayer(0,10,18)||"",sumRangeForPlayer(1,10,18)||"",sumRangeForPlayer(2,10,18)||"",sumRangeForPlayer(3,10,18)||""],mIn.match,mIn.team);
    }
    drawMTot(c4,y4,[totals[0]||"",totals[1]||"",totals[2]||"",totals[3]||""],full.match,full.team);

    // ===== ページ5: 精算 =====
    const ge = state.gamesEnabled || {};
    const doOly   = ge.olympic !== false;
    const doVegas = ge.vegas   !== false;
    const doMatch = ge.match   !== false;
    const settleRowCount = (doOly ? 1 : 0) + (doVegas ? 1 : 0) + (doMatch ? 2 : 0) + 1;
    const settleH = TITLE_H + ROW_H + settleRowCount * ROW_H + 50;
    const {cv:cv5, ctx:c5} = makeCanvas(settleH);
    drawMeta(c5, 0, "💰 Settlement");
    let y5 = TITLE_H;
    y5 = drawSettleHead(c5, y5);

    const oTotalsSettle = [0,1,2,3].map(p => sumOlympicRange(p,1,18));
    const oSettle     = calcSettlement(oTotalsSettle, n(state.olympicUnitPrice));
    const vSettle     = calcSettlement(vegas.totals, n(state.vegasUnitPrice));
    const matchSettle = calcMatchSettlement(full.match, n(state.matchWinAmount));
    const teamSettle  = calcTeamSettlement(full.team, n(state.teamHolePrice));
    const totalSettle = [0,1,2,3].map(p =>
      (doOly   ? (oSettle[p]||0)  : 0) +
      (doVegas ? (vSettle[p]||0)  : 0) +
      (doMatch ? matchSettle[p] + teamSettle[p] : 0)
    );

    if(doOly)   y5 = drawSettleRow(c5, y5, "オリンピック", oSettle.map(v=>formatYen(v)));
    if(doVegas) y5 = drawSettleRow(c5, y5, "ラスベガス",   vSettle.map(v=>formatYen(v)));
    if(doMatch) {
      y5 = drawSettleRow(c5, y5, "マッチ", matchSettle.map(v=>formatYen(v)));
      y5 = drawSettleRow(c5, y5, "チーム", teamSettle.map(v=>formatYen(v)));
    }
    y5 = drawSettleRow(c5, y5, "合計", totalSettle.map(v=>formatYen(v)), true);

    // === PDF組み立て ===
    const A4W = 210;
    function canvasToMm(cv){ return (cv.height/SCALE) * (A4W/(cv.width/SCALE)); }

    const doc = new jsPDF({ unit:'mm', format:[A4W, canvasToMm(cv1)], orientation:'portrait' });

    function addCanvasPage(cv, isFirst){
      const imgData = cv.toDataURL("image/jpeg", 0.92);
      const imgH = canvasToMm(cv);
      if(!isFirst) doc.addPage([A4W, imgH], 'portrait');
      doc.addImage(imgData, 'JPEG', 0, 0, A4W, imgH, '', 'FAST');
    }

    addCanvasPage(cv1, true);
    if(doOly)   addCanvasPage(cv2, false);
    if(doVegas) addCanvasPage(cv3, false);
    if(doMatch) addCanvasPage(cv4, false);
    addCanvasPage(cv5, false);

    doc.save(pdfFilename());

    modalConfirm("PDF保存が終わりました。\n入力データをクリアしますか？", () => {
      state.viewHalf = "OUT";
      state.playOrder = [null,null,null,null];
      state.playOrderOUT = [null,null,null,null];
      state.playOrderIN  = [null,null,null,null];
      state.scores = {};
      state.games = { olympic:{}, vegasOverride:{}, olyCb:{} };
      state.birdie = {};
      state.eagle = {};
      state.teamHandicap = {};
      save(); updateMeta(); buildTables(); recalcAll();
      applyHalfVisibility(); applyDormie();
      setActiveHoleForBirdie(null);
    });
  }

