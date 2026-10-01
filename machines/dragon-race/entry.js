/* 通常配信の台選択へ戻る。回転の途中で払い出しを中断しない。 */
document.addEventListener("click", event => {
  const link = event.target.closest(".dragon-floor-return");
  if (!link) return;
  const state = window.__mimiSlotDebug?.state;
  if (state?.spinning || state?.transitioning || window.MimiDragonMachine?.snapshot().locked) {
    event.preventDefault();
    link.textContent = "決着後に戻れます";
    setTimeout(() => { link.textContent = "← 台選択"; }, 1600);
  }
});
