/* Decorative cabinet feedback for the four independent machines. Only
 * accepted input and publicly revealed receipts can drive a light burst. */
(() => {
  "use strict";
  const dragon = new URLSearchParams(location.search).get("machine") === "dragon-race";
  const shell = document.querySelector(dragon ? "#gameShell" : "#stadiumCabinet, #arenaCabinet, #guildCabinet");
  if (!shell) return;
  const machine = dragon ? "dragon-race" : shell.id.replace("Cabinet", "");
  if (!dragon) {
    const primary = document.getElementById(machine + "Spin");
    const stops = [...shell.querySelectorAll(`[data-${machine}-stop]`)];
    const panel = document.getElementById(machine + "Command");
    const choices = document.getElementById(machine + "Choices");
    const hint = document.getElementById(machine + "InputHint");
    choices.classList.add("cabinet-command-choices"); hint.classList.add("cabinet-command-hint");
    let commandToken = "", selected = 0, active = false;
    const available = () => window.MimiCabinetArt?.ready && !document.hidden && !shell.querySelector("dialog[open]");
    function renderCommands() {
      const buttons = [...choices.children];
      active = available() && !panel.hidden && Boolean(buttons.length)
        && !shell.querySelector(`.${machine}-feature:not([hidden]), .arena-cinema:not([hidden]), .arena-cutin:not([hidden])`);
      const token = active ? [shell.dataset.pending, shell.dataset.phase, shell.dataset.round || shell.dataset.team, buttons.map(b => b.textContent).join("|")].join(":") : "";
      if (token !== commandToken) { commandToken = token; selected = 0; }
      shell.dataset.commandDeck = active ? buttons.length > 1 ? "choice" : "continue" : "";
      if (!active) {
        stops.forEach(b => { b.removeAttribute("aria-pressed"); b.removeAttribute("aria-label"); });
        return;
      }
      primary.disabled = false; primary.textContent = "PUSH";
      primary.setAttribute("aria-describedby", hint.id);
      hint.textContent = buttons.length > 1 ? "STOP 1 / 2で選択 → PUSHで決定" : "PUSH · " + buttons[0].textContent;
      buttons.forEach((button, index) => { button.dataset.deckSelected = String(index === selected); });
      stops.forEach((button, index) => {
        const selectable = buttons.length > 1 && index < buttons.length;
        button.disabled = !selectable;
        button.textContent = selectable ? `選択 ${index + 1}` : `STOP ${index + 1}`;
        if (selectable) { button.setAttribute("aria-label", buttons[index].textContent + "を選択"); button.setAttribute("aria-pressed", String(index === selected)); }
        else { button.removeAttribute("aria-pressed"); button.removeAttribute("aria-label"); }
      });
    }
    function select(index) {
      if (!active || !available() || choices.children.length < 2 || !choices.children[index]) return false;
      selected = index; renderCommands(); return true;
    }
    function confirm() {
      if (!active || !available()) return false;
      const button = choices.children[selected];
      if (!button || button.disabled) return false;
      button.click(); return true;
    }
    primary.addEventListener("click", event => { if (active && available()) { event.stopImmediatePropagation(); confirm(); } }, true);
    stops.forEach((button, index) => button.addEventListener("click", event => { if (select(index)) event.stopImmediatePropagation(); }, true));
    window.addEventListener("keydown", event => {
      if (!active || !available() || event.repeat || event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.code === "Space" && (event.target === document.body || event.target === primary || stops.includes(event.target))) {
        event.preventDefault(); event.stopImmediatePropagation(); confirm();
      } else if (/^Digit[123]$/.test(event.code) && select(Number(event.code.slice(-1)) - 1)) {
        event.preventDefault(); event.stopImmediatePropagation();
      }
    }, true);
    window.MimiCabinetCommands = Object.freeze({ render: renderCommands });
  }
  if (!dragon) {
    let ready = false, failed = false, ticket = 0, images = [];
    function load() {
      if (!failed && ticket) return;
      const owner = ++ticket; ready = false; failed = false;
      shell.dataset.cabinetArt = "loading";
      images = [...new Set(window.SlotCore.SYMBOLS.map(symbol => symbol.img))].map(file => {
        const image = new Image(); image.fetchPriority = "high"; image.src = "./assets/generated/v3/symbols/dist/" + file; return image;
      });
      let timeout;
      Promise.race([Promise.all(images.map(image => image.decode())), new Promise((_, reject) => {
        timeout = setTimeout(() => reject(new Error("Reel texture timeout")), 30000);
      })]).then(() => {
        clearTimeout(timeout);
        if (owner !== ticket) return; ready = true; shell.dataset.cabinetArt = "ready";
        shell.querySelectorAll(`.${machine}-reels img`).forEach(image => {
          if (image.complete && !image.naturalWidth && image.getAttribute("src")) image.src = image.getAttribute("src");
        });
        window.dispatchEvent(new Event("mimi:cabinet-art"));
      }).catch(() => {
        clearTimeout(timeout);
        if (owner !== ticket) return; failed = true; shell.dataset.cabinetArt = "failed";
        window.dispatchEvent(new Event("mimi:cabinet-art"));
      });
    }
    window.MimiCabinetArt = Object.freeze({ get ready() { return ready; }, get failed() { return failed; }, retry: load });
    load();
  }
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
