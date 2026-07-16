/**
 * 02-modal.js
 * ------------------------------------------------------------
 * ブラウザ標準の alert()/confirm() の代わりに使うカスタムモーダル。
 * HTML側の #modalOverlay / #modalMsg / #modalBtns を操作する。
 *
 * 依存: 01-state.js（el は直接使わずDOM APIを直接呼んでいる点に注意。将来的にelへ統一可）
 * 公開するもの:
 *   - modalAlert(msg, cb)
 *   - modalConfirm(msg, onOk, onCancel)
 * ------------------------------------------------------------
 */

function modalAlert(msg, cb) {
  const overlay = document.getElementById("modalOverlay");
  const msgEl = document.getElementById("modalMsg");
  const btnsEl = document.getElementById("modalBtns");
  msgEl.textContent = msg;
  btnsEl.innerHTML = "";
  const ok = document.createElement("button");
  ok.className = "modal-ok";
  ok.textContent = "OK";
  ok.onclick = () => { overlay.classList.remove("show"); if (cb) cb(); };
  btnsEl.appendChild(ok);
  overlay.classList.add("show");
}

function modalConfirm(msg, onOk, onCancel) {
  const overlay = document.getElementById("modalOverlay");
  const msgEl = document.getElementById("modalMsg");
  const btnsEl = document.getElementById("modalBtns");
  msgEl.textContent = msg;
  btnsEl.innerHTML = "";
  const cancel = document.createElement("button");
  cancel.textContent = "キャンセル";
  cancel.onclick = () => { overlay.classList.remove("show"); if (onCancel) onCancel(); };
  const ok = document.createElement("button");
  ok.className = "modal-ok";
  ok.textContent = "OK";
  ok.onclick = () => { overlay.classList.remove("show"); if (onOk) onOk(); };
  btnsEl.appendChild(cancel);
  btnsEl.appendChild(ok);
  overlay.classList.add("show");
}

// テキスト入力付きモーダル（ラウンド保存時のタグ入力用）
function modalInput(msg, placeholder, onOk, onCancel) {
  const overlay = document.getElementById("modalOverlay");
  const msgEl   = document.getElementById("modalMsg");
  const btnsEl  = document.getElementById("modalBtns");

  msgEl.innerHTML = "";
  const txt = document.createElement("div");
  txt.textContent = msg;
  txt.style.cssText = "font-weight:600;line-height:1.5;color:#111;white-space:pre-wrap;margin-bottom:12px;";
  msgEl.appendChild(txt);

  const inp = document.createElement("input");
  inp.type = "text";
  inp.placeholder = placeholder || "";
  inp.style.cssText = "display:block;width:100%;height:36px;padding:0 8px;border:1px solid #999;border-radius:6px;font-size:16px;font-weight:400;";
  msgEl.appendChild(inp);
  setTimeout(() => inp.focus(), 50);

  btnsEl.innerHTML = "";
  const cancel = document.createElement("button");
  cancel.textContent = "キャンセル";
  cancel.onclick = () => { overlay.classList.remove("show"); if (onCancel) onCancel(); };

  const ok = document.createElement("button");
  ok.className = "modal-ok";
  ok.textContent = "保存";
  ok.onclick = () => { overlay.classList.remove("show"); if (onOk) onOk(inp.value.trim()); };

  inp.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); ok.click(); } });

  btnsEl.appendChild(cancel);
  btnsEl.appendChild(ok);
  overlay.classList.add("show");
}
