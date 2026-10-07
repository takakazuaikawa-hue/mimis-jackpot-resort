/* Character acting from the existing authored frames and revealed table events.
 * This director owns no input, lottery, payout, progression or scene clock. */
(function (root, document) {
  "use strict";
  const desktop = root.matchMedia("(min-width: 900px)");
  if (!desktop.matches) return;
  const shell = document.getElementById("gameShell");
  const stage = shell?.querySelector(".casino-loop");
  const rival = document.getElementById("casinoOpponent");
  const ambientMimi = stage?.querySelector(".casino-mimi");
  const reaction = shell?.querySelector(".casino-reel-reaction");
  if (!stage || !rival || !ambientMimi || new URLSearchParams(location.search).get("machine") === "dragon-race") return;

  const strips = Object.freeze({
    rico: {
      read: "./assets/character-emotion-animation-v1/rico-senior-read/strip.png",
      caught: "./assets/character-emotion-animation-v1/rico-composure-crack/strip.png"
    },
    polka: {
      read: "./assets/character-emotion-animation-v1/polka-showboat/strip.png",
      caught: "./assets/character-emotion-animation-v1/polka-bluff-exposed/strip.png"
    },
    grano: {
      read: "./assets/character-emotion-animation-v1/grano-value-read/strip.png",
      caught: "./assets/character-emotion-animation-v1/grano-calculation-collapse/strip.png"
    },
    selina: { read: null, caught: "./assets/character-emotion-animation-v1/selina-quiet-exposed/strip.png" }
  });
  const layer = document.createElement("div");
  layer.className = "chapter1-table-acting chapter1-table-rival-acting";
  layer.hidden = true;
  layer.inert = true;
  layer.setAttribute("aria-hidden", "true");
  const image = document.createElement("img");
  image.alt = "";
  image.decoding = "async";
  layer.append(image);
  stage.append(layer);

  const mimiPath = "./assets/character-emotion-animation-v1/mimi-service-idle-v1/strip.png";
  const mimiLayer = document.createElement("div");
  mimiLayer.className = "chapter1-table-mimi-acting";
  mimiLayer.hidden = true;
  mimiLayer.inert = true;
  mimiLayer.setAttribute("aria-hidden", "true");
  const mimiImage = document.createElement("img");
  mimiImage.alt = "";
  mimiImage.decoding = "async";
  mimiLayer.append(mimiImage);
  stage.append(mimiLayer);

  const media = root.matchMedia("(prefers-reduced-motion: reduce)");
  const loaded = new Map();
  const callbacks = [];
  let token = 0, raf = 0, fallbackTimer = 0, active = null;
  let mimiToken = 0, mimiRaf = 0, activeMimi = null;
  let lastGesture = -Infinity, lastMimiGesture = -Infinity, lastSequence = 0, focused = true;
  let music = { origin: "semantic-fallback", audioSynced: false };

  const mimiSequences = Object.freeze({
    idle: Object.freeze({ frames: [0, 1, 2, 3, 2, 1, 0], step: 170, tail: 170 }),
    spin: Object.freeze({ frames: [4, 5, 6, 7], step: 135, tail: 180 }),
    stop1: Object.freeze({ frames: [1, 2, 1], step: 140, tail: 150 }),
    stop2: Object.freeze({ frames: [2, 3, 2], step: 140, tail: 150 }),
    stop3: Object.freeze({ frames: [4, 5, 4], step: 140, tail: 150 }),
    result: Object.freeze({ frames: [4, 5, 6, 7, 6, 5, 4], step: 145, tail: 210 })
  });

  function listen(target, type, callback) {
    target.addEventListener(type, callback);
    callbacks.push(() => target.removeEventListener(type, callback));
  }

  function baseEligible() {
    const view = shell.closest("[data-view='slot']");
    return desktop.matches && focused && !document.hidden && (!view || view.classList.contains("is-active"))
      && shell.dataset.episode === "treasure" && shell.dataset.gamePhase === "normal"
      && !shell.classList.contains("presentation-active")
      && document.getElementById("helpOverlay")?.hidden !== false
      && !document.querySelector("dialog[open]");
  }

  function eligible() {
    return baseEligible() && !rival.hidden
      && shell.dataset.characterEmotionReady !== "true";
  }

  function resolvedPath(value) {
    try { return new URL(value || "", document.baseURI).pathname.replace(/\\/g, "/"); }
    catch (_error) { return ""; }
  }

  function actualMimiSrc() {
    return resolvedPath(ambientMimi.poster || ambientMimi.getAttribute("poster"));
  }

  function reactionOwnsMimi() {
    // Ordinary stop beats update copy without displaying the legacy Mimi
    // reaction actor. Yield only when that actor actually owns focus; the
    // bridge's stronger chapter1ReactionFocus flag is checked separately.
    return reaction?.dataset.focus === "true";
  }

  function storyOwnsMimi(node) {
    if (!node?.classList.contains("show") || node.hidden) return false;
    const style = root.getComputedStyle(node);
    return style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity || 1) > 0;
  }

  function mimiEligible() {
    const storyDialog = shell.querySelector(".character-dialog.show");
    const commandStep = shell.dataset.chapterCommandStep || "";
    return baseEligible()
      && actualMimiSrc().endsWith("/assets/character-animation-v8/unified-cast-v1/mimi.png")
      && ambientMimi.classList.contains("is-idle")
      && !ambientMimi.classList.contains("is-walking")
      && !stage.classList.contains("is-travelling")
      // Arrival PUSH dialogue owns the cast. The final step is the actionable
      // SPIN-ready hold spoken by Mimi herself, so her neutral service idle may
      // accompany it beneath the command HUD.
      && (!commandStep || commandStep === "3")
      && shell.dataset.chapter1ReactionFocus !== "true"
      && shell.dataset.characterEmotionReady !== "true"
      && !reactionOwnsMimi() && !storyOwnsMimi(storyDialog);
  }

  function reduced() { return media.matches || shell.classList.contains("reduced-motion"); }

  function clear() {
    token += 1;
    root.cancelAnimationFrame(raf);
    raf = 0;
    active = null;
    layer.hidden = true;
    delete rival.dataset.tableActing;
    layer.dataset.motion = "idle";
  }

  function clearMimi() {
    mimiToken += 1;
    root.cancelAnimationFrame(mimiRaf);
    mimiRaf = 0;
    activeMimi = null;
    mimiLayer.hidden = true;
    delete ambientMimi.dataset.tableMimiActing;
    mimiLayer.dataset.motion = "idle";
  }

  function holdMimi() {
    root.cancelAnimationFrame(mimiRaf);
    mimiRaf = 0;
    activeMimi = null;
    if (!mimiEligible() || !mimiImage.src) { clearMimi(); return false; }
    mimiImage.style.transform = "translate3d(0,0,0)";
    mimiLayer.dataset.kind = "hold";
    mimiLayer.dataset.source = "decoded-neutral";
    mimiLayer.dataset.frame = "0";
    mimiLayer.dataset.motion = "holding";
    mimiLayer.dataset.actualMimiSrc = actualMimiSrc();
    mimiLayer.hidden = false;
    ambientMimi.dataset.tableMimiActing = "true";
    return true;
  }

  async function ensureMimiHold() {
    if (!mimiEligible()) { clearMimi(); return false; }
    if (activeMimi || !mimiLayer.hidden) return true;
    const owner = ++mimiToken;
    const asset = await preload(mimiPath);
    if (!asset || owner !== mimiToken || !mimiEligible()) return false;
    if (asset.naturalWidth / asset.naturalHeight < 4) return false;
    mimiImage.src = mimiPath;
    return holdMimi();
  }

  function clearAll() {
    clear();
    clearMimi();
  }

  function stopFallback() {
    root.clearTimeout(fallbackTimer);
    fallbackTimer = 0;
  }

  function preload(path) {
    if (!loaded.has(path)) {
      const asset = new Image();
      asset.src = path;
      loaded.set(path, asset.decode().then(() => asset).catch(() => null));
    }
    return loaded.get(path);
  }

  function paint(now) {
    raf = 0;
    if (!active || !eligible()) { clear(); return; }
    const elapsed = Math.max(0, now - active.started);
    const frame = reduced() ? 7 : Math.min(7, Math.floor(elapsed / 160));
    image.style.transform = `translate3d(${-frame * 12.5}%,0,0)`;
    layer.dataset.frame = String(frame);
    layer.dataset.motion = reduced() ? "reduced" : "playing";
    if (elapsed >= (reduced() ? 520 : 1460)) { clear(); return; }
    raf = root.requestAnimationFrame(paint);
  }

  function paintMimi(now) {
    mimiRaf = 0;
    if (!activeMimi || !mimiEligible()) { clearMimi(); return; }
    const elapsed = Math.max(0, now - activeMimi.started);
    const sequence = activeMimi.sequence;
    const sequenceIndex = reduced()
      ? sequence.frames.length - 1
      : Math.min(sequence.frames.length - 1, Math.floor(elapsed / sequence.step));
    const frame = sequence.frames[sequenceIndex];
    mimiImage.style.transform = `translate3d(${-frame * 12.5}%,0,0)`;
    mimiLayer.dataset.frame = String(frame);
    mimiLayer.dataset.motion = reduced() ? "reduced" : "playing";
    const duration = reduced() ? 520 : (sequence.frames.length * sequence.step) + sequence.tail;
    if (elapsed >= duration) { holdMimi(); return; }
    mimiRaf = root.requestAnimationFrame(paintMimi);
  }

  async function gesture(kind, source) {
    if (!eligible()) return false;
    const cast = shell.dataset.chapter1DisplayOpponent;
    const name = strips[cast]?.[kind];
    if (!name) return false;
    const now = root.performance.now();
    // Fast STOPs continue the already-readable acting beat instead of
    // restarting its first frame for every control edge.
    if (active && active.cast === cast && active.kind === kind && now - active.started < 650) return false;
    const owner = ++token;
    const path = name;
    const asset = await preload(path);
    if (!asset || owner !== token || !eligible() || shell.dataset.chapter1DisplayOpponent !== cast) return false;
    if (asset.naturalWidth / asset.naturalHeight < 5) return false;
    image.src = path;
    image.style.transform = "translate3d(0,0,0)";
    layer.dataset.cast = cast;
    layer.dataset.kind = kind;
    layer.dataset.source = source;
    layer.dataset.music = music.origin;
    layer.dataset.frame = "0";
    layer.hidden = false;
    rival.dataset.tableActing = "true";
    active = { cast, kind, started: root.performance.now(), source };
    lastGesture = active.started;
    root.cancelAnimationFrame(raf);
    raf = root.requestAnimationFrame(paint);
    return true;
  }

  async function mimiGesture(kind, source) {
    if (!mimiEligible()) return false;
    const sequence = mimiSequences[kind];
    if (!sequence) return false;
    const now = root.performance.now();
    // A rapid accepted STOP may advance the semantic pose, but never queues a
    // missed gesture or replays work after another layer takes ownership.
    if (activeMimi && activeMimi.kind === kind && now - activeMimi.started < 220) return false;
    const owner = ++mimiToken;
    const asset = await preload(mimiPath);
    if (!asset || owner !== mimiToken || !mimiEligible()) return false;
    if (asset.naturalWidth / asset.naturalHeight < 4) return false;
    mimiImage.src = mimiPath;
    mimiImage.style.transform = "translate3d(0,0,0)";
    mimiLayer.dataset.kind = kind;
    mimiLayer.dataset.source = source;
    mimiLayer.dataset.music = music.origin;
    mimiLayer.dataset.frame = "0";
    mimiLayer.dataset.actualMimiSrc = actualMimiSrc();
    mimiLayer.hidden = false;
    ambientMimi.dataset.tableMimiActing = "true";
    activeMimi = { kind, source, sequence, started: root.performance.now() };
    lastMimiGesture = activeMimi.started;
    root.cancelAnimationFrame(mimiRaf);
    mimiRaf = root.requestAnimationFrame(paintMimi);
    return true;
  }

  function onInput(event) {
    const detail = event.detail || {};
    if (detail.type === "spin-start") {
      gesture("read", "accepted-spin");
      mimiGesture("spin", "accepted-spin");
    } else if (detail.type === "stop-accepted") {
      const stopped = Math.max(1, Math.min(3, Number(detail.stoppedCount) || 1));
      if (stopped < 3) gesture("read", "accepted-stop");
      mimiGesture(`stop${stopped}`, `accepted-stop-${stopped}`);
    }
  }

  function onResult(event) {
    const detail = event.detail || {};
    if (detail.type !== "settled") return;
    gesture(Number(detail.payout) > 0 ? "caught" : "read", "revealed-result");
    // This neutral service response starts only on the public settled event;
    // it deliberately does not branch on a hidden flag or inferred outcome.
    mimiGesture("result", "revealed-result");
  }

  function onMusic(snapshot) {
    music = snapshot;
    if (!eligible() && active) clear();
    if (!mimiEligible() && activeMimi) clearMimi();
    if (!eligible() && !mimiEligible()) return;
    if (snapshot.sequence === lastSequence) return;
    lastSequence = snapshot.sequence;
    // These are measured transients, not invented musical bars or a hint
    // about the hidden outcome. The rival is simply reading the table.
    if (snapshot.audioSynced && snapshot.pulseValue > 0) {
      if (root.performance.now() - lastGesture > 6200) gesture("read", "music-pulse");
      if (root.performance.now() - lastMimiGesture > 5200) mimiGesture("idle", "music-pulse");
    }
  }

  function fallback() {
    fallbackTimer = 0;
    if (!eligible() && !mimiEligible()) return;
    if (!music.audioSynced) {
      if (eligible() && root.performance.now() - lastGesture > 7200) gesture("read", "semantic-idle");
      if (mimiEligible() && root.performance.now() - lastMimiGesture > 6800) mimiGesture("idle", "semantic-idle");
    }
    fallbackTimer = root.setTimeout(fallback, 600);
  }

  const observer = new MutationObserver(() => {
    if (!eligible()) clear();
    if (!mimiEligible()) clearMimi();
    else ensureMimiHold();
    if (!eligible() && !mimiEligible()) stopFallback();
    else if (!fallbackTimer) fallback();
    const cast = shell.dataset.chapter1DisplayOpponent;
    const name = strips[cast]?.read;
    if (name && eligible()) preload(name);
  });
  observer.observe(shell, { attributes: true, attributeFilter: [
    "class", "data-episode", "data-game-phase", "data-chapter1-display-opponent",
    "data-chapter-command-step", "data-chapter1-reaction-focus", "data-character-emotion-ready"
  ] });
  const view = shell.closest("[data-view='slot']");
  if (view) observer.observe(view, { attributes: true, attributeFilter: ["class"] });
  const help = document.getElementById("helpOverlay");
  if (help) observer.observe(help, { attributes: true, attributeFilter: ["hidden"] });
  const storyDialog = shell.querySelector(".character-dialog");
  if (storyDialog) observer.observe(storyDialog, { attributes: true, attributeFilter: ["class"] });
  observer.observe(stage, { attributes: true, attributeFilter: ["class"] });
  observer.observe(ambientMimi, { attributes: true, attributeFilter: ["class", "poster", "src"] });
  if (reaction) observer.observe(reaction, { attributes: true, attributeFilter: ["data-beat", "data-focus"] });
  mimiImage.addEventListener("error", clearMimi);
  preload(mimiPath).then(() => ensureMimiHold());
  listen(root, "mimi:reel-input", onInput);
  listen(root, "mimi:reel-result", onResult);
  listen(root, "blur", () => { focused = false; clearAll(); stopFallback(); });
  listen(root, "focus", () => { focused = true; lastGesture = root.performance.now(); ensureMimiHold(); if (!fallbackTimer) fallback(); });
  listen(document, "visibilitychange", () => {
    if (document.hidden) { clearAll(); stopFallback(); }
    else { lastGesture = root.performance.now(); ensureMimiHold(); if (!fallbackTimer) fallback(); }
  });
  listen(desktop, "change", () => {
    if (!desktop.matches) { clearAll(); stopFallback(); }
    else { lastGesture = lastMimiGesture = root.performance.now(); ensureMimiHold(); if (!fallbackTimer) fallback(); }
  });
  const unsubscribe = root.MimiMusicMotion?.subscribe(onMusic);
  fallback();

  root.MimiTableActing = Object.freeze({
    snapshot() {
      return Object.freeze({ active: !layer.hidden, cast: active?.cast || null, kind: active?.kind || null,
        frame: Number(layer.dataset.frame || 0), source: active?.source || null, music: music.origin,
        mimi: Object.freeze({ active: Boolean(activeMimi), holding: !mimiLayer.hidden && !activeMimi,
          kind: activeMimi?.kind || (!mimiLayer.hidden ? "hold" : null),
          frame: Number(mimiLayer.dataset.frame || 0), source: activeMimi?.source || null,
          actualMimiSrc: actualMimiSrc(), currentCast: document.getElementById("characterArt")?.alt || null }) });
    }
  });
  listen(root, "pagehide", () => {
    clearAll();
    root.clearTimeout(fallbackTimer);
    observer.disconnect();
    unsubscribe?.();
    callbacks.forEach(callback => callback());
  });
}(window, document));
