/**
 * 00-bootstrap.js
 * ------------------------------------------------------------
 * 元々は <head> 内にインラインで置かれていた、最初期に必要な
 * グローバル関数・処理。他の js/*.js より先に <head> 内で読み込む。
 *
 *   - applyDormie()  : 06-render.js / 05b-calc-dormie.js 側で定義される
 *                       window.applyDormieInner への薄いラッパー。
 *                       本体側スクリプトの読み込み前に呼ばれても
 *                       エラーにならないよう存在チェックしている。
 *   - exportPDF()     : html2pdf.js を使った旧PDF出力関数。
 *                       現在のPDF保存ボタン（#btnPdf → savePdf）からは
 *                       呼ばれていない未使用関数だが、互換性のため残置。
 *                       使うには別途 html2pdf.js の読み込みが必要。
 *   - Service Worker登録 : ./sw.js をPWAとして登録する。
 *
 * 依存: なし（最も早く読み込まれる）
 * ------------------------------------------------------------
 */

// ==== Dormie 判定 ====
// js/05b-calc-dormie.js 内の applyDormieInner() に委譲（グローバルからも呼べるようにラップ）
function applyDormie() {
  if (window.applyDormieInner) window.applyDormieInner();
}

// ==== 旧PDF出力（html2pdf.js使用・現在未使用） ====
function exportPDF() {
  const element = document.body;
  const opt = {
    margin: 0.5,
    filename: 'golf_scorecard.pdf',
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2 },
    jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
  };
  html2pdf().set(opt).from(element).save();
}

// ==== Service Worker登録（PWA対応） ====
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('./sw.js'); });
}
