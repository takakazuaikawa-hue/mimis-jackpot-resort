/* Cabinet-only light choreography. Reads accepted reel events and visible
 * phase/receipt state; never reads a lottery flag or writes game/save state. */
(function () {
  "use strict";
  const shell = document.querySelector("#gameShell");
  const lamps = shell?.querySelector(".cabinet-lights");
  if (!lamps) return;
  const receipt = shell.querySelector("#spinReceipt");
  const motionButton = document.querySelector("#motionBtn");
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  let transaction = 0, burstTimer = 0, burst = "", suspended = document.hidden;
  function phase() {
    const label = shell.querySelector("#stageLabel")?.textContent || "";
    const current = shell.dataset.gamePhase;
    if (/JACKPOT/.test(label)) return "jackpot";
    if (current === "bonus" || /BONUS/.test(label)) return "bonus";
    if (current === "battle" || /BOSS|BATTLE/.test(label)) return "boss";
    if (current === "trial" || /CHANCE|TRIAL|VIP LAMP/.test(label)) return "chance";
    return "idle";
  }
  function paint() {
    const visible = shell.closest('[data-view="slot"]')?.classList.contains("is-active");
    if (!visible && burst) {
      clearTimeout(burstTimer);burstTimer = 0;burst = "";
      lamps.removeAttribute("data-stop-reel");
    }
    const reduced = media.matches || motionButton?.getAttribute("aria-pressed") === "true";
    lamps.dataset.suspended = String(suspended || !visible);
    lamps.dataset.reduced = String(reduced);
    lamps.dataset.phase = phase();
    lamps.dataset.mode = burst || (shell.dataset.reelState === "spinning" ? "spin" : phase());
    const currentCount = Number(shell.querySelector("#reelFrame")?.dataset.reelStopCount || 0);
    lamps.dataset.stopCount = String(Math.max(0, Math.min(3, currentCount)));
  }
  function clearBurst() {
    clearTimeout(burstTimer);burstTimer = 0;burst = "";
    lamps.removeAttribute("data-stop-reel");paint();
  }
  function showBurst(name, duration) {
    clearTimeout(burstTimer);burst = name;paint();
    const owner = transaction;
    burstTimer = window.setTimeout(() => {if(owner === transaction)clearBurst();}, duration);
  }
  window.addEventListener("mimi:reel-input", event => {
    const detail = event.detail || {}, id = Number(detail.transactionId);
    if (!Number.isSafeInteger(id) || id < 1) return;
    if (detail.type === "spin-start") {transaction = id;clearBurst();paint();return;}
    if (detail.type !== "stop-accepted" || id !== transaction) return;
    const reel = Number(detail.reelIndex);
    if (!Number.isInteger(reel) || reel < 0 || reel > 2) return;
    lamps.dataset.stopReel = String(reel);showBurst("stop", 420);
  });
  window.addEventListener("mimi:reel-result", event => {
    const detail = event.detail || {};
    if (detail.type !== "settled" || Number(detail.transactionId) !== transaction) return;
    lamps.removeAttribute("data-stop-reel");
    const credited = Number(receipt?.dataset.payout || detail.payout || 0);
    if (detail.outcome === "jackpot") showBurst("jackpot", 2600);
    else if (credited > 0) showBurst("win", 1800);
    else if (detail.outcome === "replay") showBurst("replay", 1000);
    else if (/^read-/.test(receipt?.dataset.outcome || "")) showBurst("read", 1100);
    else clearBurst();
  });
  const observer = new MutationObserver(paint);
  observer.observe(shell, {attributes:true,attributeFilter:["data-reel-state","data-presentation-scene","data-phase-cue","data-game-phase"]});
  const label = shell.querySelector("#stageLabel");
  if(label)observer.observe(label,{childList:true,subtree:true,characterData:true});
  if(motionButton)observer.observe(motionButton,{attributes:true,attributeFilter:["aria-pressed"]});
  const view = shell.closest('[data-view="slot"]');
  if(view)observer.observe(view,{attributes:true,attributeFilter:["class"]});
  function suspend() {suspended = true;clearBurst();}
  function resume() {suspended = document.hidden;paint();}
  window.addEventListener("blur",suspend);window.addEventListener("focus",resume);
  document.addEventListener("visibilitychange",()=>document.hidden?suspend():resume());
  window.addEventListener("pagehide",suspend);window.addEventListener("pageshow",resume);
  media.addEventListener("change",paint);paint();
})();
