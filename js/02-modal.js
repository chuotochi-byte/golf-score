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
