/* Decorative cabinet feedback for the four independent machines. Only
 * accepted input and publicly revealed receipts can drive a light burst. */
(() => {
  "use strict";
  const dragon = new URLSearchParams(location.search).get("machine") === "dragon-race";
  const shell = document.querySelector(dragon ? "#gameShell" : "#stadiumCabinet, #arenaCabinet, #guildCabinet");
  if (!shell) return;
  const machine = dragon ? "dragon-race" : shell.id.replace("Cabinet", "");
  function mount() {
  const theater = shell.querySelector(dragon ? ".dragon-stage" : `.${machine}-theater, .${machine}-stage`);
  const reels = shell.querySelector(dragon ? ".reel-frame" : `.${machine}-reel-block`);
  if (!theater || !reels) return false;
  shell.dataset.responseCabinet = machine;
  const frame = document.createElement("div");
  frame.className = "cabinet-response-frame"; frame.setAttribute("aria-hidden", "true");
  for (const side of ["left", "right"]) {
    const rail = document.createElement("div"); rail.className = `cabinet-response-rail ${side}`;
    for (let i = 0; i < 8; i++) { const lamp = document.createElement("i"); lamp.style.setProperty("--lamp-step", i); rail.append(lamp); }
    frame.append(rail);
  }
  theater.append(frame);
  const trail = document.createElement("div");
  trail.className = "cabinet-response-trail"; trail.setAttribute("aria-hidden", "true");
  const beams = Array.from({ length: 3 }, () => { const beam = document.createElement("i"); trail.append(beam); return beam; });
  reels.append(trail);
  const media = matchMedia("(prefers-reduced-motion: reduce)");
  let transaction = 0, timer = 0, burst = "", payout = 0, suspended = document.hidden, spinning = false;
  const stopped = new Set();
  function modalOpen() { return Boolean(shell.querySelector("dialog[open]")) || dragon && document.getElementById("helpOverlay")?.hidden === false; }
  function visible() { return !dragon || shell.closest('[data-view="slot"]')?.classList.contains("is-active"); }
  function reduced() {
    return media.matches || shell.dataset.motion === "reduced" || shell.querySelector(".dragon-stage")?.dataset.reduced === "true";
  }
  function phase() {
    const source = dragon ? shell.querySelector(".dragon-stage") : shell;
    const p = source?.dataset.phase;
    return p === "bonus" ? "bonus" : ["boss", "battle"].includes(p) ? "boss" : p === "trial" ? "chance" : "idle";
  }
  function paint() {
    const quiet = suspended || document.hidden || !visible() || modalOpen();
    if (quiet && burst) { clearTimeout(timer); timer = 0; burst = ""; delete shell.dataset.responseStopReel; }
    shell.dataset.responseSuspended = String(quiet);
    shell.dataset.responseReduced = String(reduced());
    shell.dataset.responsePhase = phase();
    shell.dataset.responseMode = burst || (spinning ? "spin" : phase());
    shell.dataset.responseTransaction = String(transaction);
    shell.dataset.responseStops = String(stopped.size);
    shell.dataset.responsePayout = String(payout);
    beams.forEach((beam, index) => beam.dataset.accepted = String(stopped.has(index)));
  }
  function clearBurst() { clearTimeout(timer); timer = 0; burst = ""; delete shell.dataset.responseStopReel; paint(); }
  function showBurst(mode, duration) {
    if (suspended || document.hidden || !visible() || modalOpen()) { clearBurst(); return; }
    clearTimeout(timer); burst = mode; paint();
    const owner = transaction;
    timer = setTimeout(() => { if (owner === transaction) clearBurst(); }, duration);
  }
  function input(event) {
    const d = event.detail || {}, id = Number(d.transactionId);
    if (!dragon && d.machineId !== machine || !Number.isSafeInteger(id) || id < 1) return;
    if (d.type === "spin-start") {
      transaction = id; spinning = true; payout = 0; stopped.clear(); clearBurst(); return;
    }
    if (d.type !== "stop-accepted") return;
    // A reloaded unfinished transaction starts with no historic light burst.
    if (!transaction && shell.dataset.spinning === "true") { transaction = id; spinning = true; }
    const reel = Number(d.reelIndex);
    if (id !== transaction || !spinning || !Number.isInteger(reel) || reel < 0 || reel > 2 || stopped.has(reel)) return;
    stopped.add(reel); shell.dataset.responseStopReel = String(reel); showBurst("stop", 420);
  }
  function result(event) {
    const d = event.detail || {};
    if (d.machineId !== machine || d.type !== "revealed" || Number(d.transactionId) !== transaction || !spinning) return;
    spinning = false; payout = Math.max(0, Number(d.payout) || 0);
    delete shell.dataset.responseStopReel;
    if (payout > 0) showBurst("win", 1800);
    else if (d.replay === true) showBurst("replay", 900);
    else clearBurst();
  }
  window.addEventListener(dragon ? "mimi:reel-input" : "mimi:cabinet-input", input);
  window.addEventListener("mimi:cabinet-result", result);
  const observer = new MutationObserver(paint);
  observer.observe(shell, {subtree:true, attributes:true, attributeFilter:["data-phase", "data-spinning", "data-mode", "data-reduced", "data-motion", "class", "hidden", "open"]});
  const view = shell.closest('[data-view="slot"]');
  if (view) observer.observe(view, {attributes:true, attributeFilter:["class"]});
  const help = dragon && document.getElementById("helpOverlay");
  if (help) observer.observe(help, {attributes:true, attributeFilter:["hidden"]});
  function suspend() { suspended = true; clearBurst(); }
  function resume() { suspended = document.hidden; paint(); }
  window.addEventListener("blur", suspend); window.addEventListener("focus", resume);
  window.addEventListener("pagehide", suspend); window.addEventListener("pageshow", resume);
  document.addEventListener("visibilitychange", () => document.hidden ? suspend() : resume());
  media.addEventListener("change", paint); paint(); return true;
  }
  if (!mount()) {
    // The Dragon adapter creates its visible stage during asynchronous boot.
    // Do not decorate the hidden legacy theater while that stage is pending.
    const pending = new MutationObserver(() => { if (mount()) pending.disconnect(); });
    pending.observe(shell, {childList:true, subtree:true});
  }
})();
