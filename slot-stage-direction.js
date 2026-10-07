/* Observation-only stage direction for the independent Arena, Guild and Stadium cabinets. */
(function (root) {
  "use strict";

  const document = root.document;
  if (!document) return;

  const THEMES = Object.freeze({
    arena: Object.freeze({
      bodyClass: "arena-page",
      stageSelector: ".arena-theater",
      ownerSelector: "#arenaCinema:not([hidden]), #arenaCutin:not([hidden]), #arenaReward:not([hidden]), #arenaCommand:not([hidden]), dialog[open]"
    }),
    guild: Object.freeze({
      bodyClass: "guild-page",
      stageSelector: ".guild-stage",
      ownerSelector: "#guildFeature:not([hidden]), #guildCommand:not([hidden]), dialog[open]"
    }),
    stadium: Object.freeze({
      bodyClass: "stadium-page",
      stageSelector: ".stadium-theater",
      ownerSelector: "#stadiumFeature:not([hidden]), #stadiumCommand:not([hidden]), #stadiumVictory:not([hidden]), dialog[open]"
    })
  });

  const RESULT_HOLD_MS = Object.freeze({ win: 860, hit: 820, replay: 720, miss: 620 });
  const RELEASE_MS = 560;
  const MAX_DPR = 2;
  const TAU = Math.PI * 2;
  const noop = function () {};

  function now() {
    return root.performance && typeof root.performance.now === "function"
      ? root.performance.now()
      : Date.now();
  }

  function clamp(value, low, high) {
    return Math.max(low, Math.min(high, value));
  }

  function selectTheme() {
    const body = document.body;
    if (!body) return null;
    for (const [machine, theme] of Object.entries(THEMES)) {
      if (body.classList.contains(theme.bodyClass)) return { machine, theme };
    }
    return null;
  }

  function isShown(node) {
    return Boolean(node && !node.hidden && node.getAttribute("aria-hidden") !== "true");
  }

  function createDirection(machine, theme, stage) {
    const cabinet = stage.closest("main") || stage;
    const canvas = document.createElement("canvas");
    canvas.className = "slot-stage-direction";
    canvas.dataset.stageDirectionMachine = machine;
    canvas.setAttribute("aria-hidden", "true");
    canvas.style.pointerEvents = "none";
    canvas.inert = true;
    stage.append(canvas);

    const context = canvas.getContext("2d", { alpha: true, desynchronized: true });
    const reducedQuery = root.matchMedia?.("(prefers-reduced-motion: reduce)") || null;
    const acceptedReels = new Set();
    const listeners = [];
    let transactionCount = 0;
    let transactionId = "";
    let previousTransactionId = "";
    let phase = "waiting";
    let result = "none";
    let resultKind = "";
    let variant = 0;
    let stopCount = 0;
    let ownerActive = false;
    let focused = true;
    let motionPausedAt = null;
    let motionPausedMs = 0;
    const motionStartedAt = now();
    let releasePending = false;
    let phaseStartedAt = now();
    let resultTimer = 0;
    let releaseTimer = 0;
    let drawFrame = 0;
    let fallbackFrame = 0;
    let width = 0;
    let height = 0;
    let dpr = 1;
    let music = Object.freeze({
      origin: "semantic-fallback",
      audioSynced: false,
      reason: "music-motion-unavailable",
      sequence: 0,
      pulseValue: 0,
      path: null,
      position: 0
    });

    function listen(target, type, handler, options) {
      target.addEventListener(type, handler, options);
      listeners.push(() => target.removeEventListener(type, handler, options));
    }

    function clearTimers() {
      if (resultTimer) root.clearTimeout(resultTimer);
      if (releaseTimer) root.clearTimeout(releaseTimer);
      resultTimer = 0;
      releaseTimer = 0;
    }

    function reducedMotion() {
      return Boolean(
        reducedQuery?.matches
        || root.MimiAudio?.reduced
        || cabinet.dataset.motion === "reduced"
        || cabinet.classList.contains("reduced-motion")
        || stage.closest(".reduced-motion")
      );
    }

    function suspended() {
      return document.hidden || !focused || ownerActive;
    }

    function suspensionReason() {
      if (document.hidden) return "hidden";
      if (!focused) return "blurred";
      if (ownerActive) return "feature";
      return "none";
    }

    function syncSuspension() {
      const paused = suspended();
      if (paused && motionPausedAt === null) motionPausedAt = now();
      else if (!paused && motionPausedAt !== null) {
        motionPausedMs += Math.max(0, now() - motionPausedAt);
        motionPausedAt = null;
      }
      canvas.hidden = paused;
      if (paused) {
        if (drawFrame) root.cancelAnimationFrame(drawFrame);
        if (fallbackFrame) root.clearTimeout(fallbackFrame);
        drawFrame = 0;
        fallbackFrame = 0;
      } else requestDraw(true);
      updateDataset();
    }

    function motionTime(timestamp) {
      const endpoint = motionPausedAt === null ? timestamp : motionPausedAt;
      return Math.max(0, (endpoint - motionStartedAt - motionPausedMs) / 1000);
    }

    function updateDataset() {
      canvas.dataset.stageDirectionPhase = phase;
      canvas.dataset.stageDirectionResult = result;
      canvas.dataset.stageDirectionResultKind = resultKind || "none";
      canvas.dataset.stageDirectionVariant = String(variant);
      canvas.dataset.stageDirectionTransaction = transactionId;
      canvas.dataset.stageDirectionTransactionCount = String(transactionCount);
      canvas.dataset.stageDirectionStopCount = String(stopCount);
      canvas.dataset.stageDirectionOwner = ownerActive ? "feature" : "stage";
      canvas.dataset.stageDirectionFocus = focused ? "focused" : "blurred";
      canvas.dataset.stageDirectionSuspended = suspensionReason();
      canvas.dataset.stageDirectionMotion = reducedMotion() ? "reduced" : "full";
      canvas.dataset.stageDirectionMusic = music.origin;
      canvas.dataset.stageDirectionMusicSynced = String(music.audioSynced === true);
      canvas.dataset.stageDirectionMusicReason = music.reason || "none";
    }

    function snapshot() {
      return Object.freeze({
        machine,
        phase,
        result,
        resultKind: resultKind || null,
        variant,
        transactionId: transactionId || null,
        transactionCount,
        stopCount,
        owner: ownerActive ? "feature" : "stage",
        focused,
        suspended: suspensionReason(),
        reduced: reducedMotion(),
        music: Object.freeze({ ...music })
      });
    }

    const api = Object.freeze({
      get machine() { return machine; },
      get active() { return canvas.isConnected; },
      snapshot
    });

    function requestDraw(immediate = false) {
      if (immediate && fallbackFrame) {
        root.clearTimeout(fallbackFrame);
        fallbackFrame = 0;
      }
      if (!context || suspended() || !canvas.isConnected || drawFrame) return;
      drawFrame = root.requestAnimationFrame(draw);
    }

    function continueDrawing() {
      if (suspended() || reducedMotion() || drawFrame || fallbackFrame) return;
      fallbackFrame = root.setTimeout(() => {
        fallbackFrame = 0;
        requestDraw();
      }, 1000 / 30);
    }

    function setPhase(next) {
      if (phase !== next) {
        phase = next;
        phaseStartedAt = now();
      }
      updateDataset();
      requestDraw(true);
    }

    function toWaiting() {
      releaseTimer = 0;
      if (phase !== "release") return;
      result = "none";
      resultKind = "";
      transactionId = "";
      stopCount = 0;
      acceptedReels.clear();
      setPhase("waiting");
    }

    function enterRelease() {
      resultTimer = 0;
      if (ownerActive) {
        releasePending = true;
        return;
      }
      releasePending = false;
      setPhase("release");
      if (releaseTimer) root.clearTimeout(releaseTimer);
      releaseTimer = root.setTimeout(toWaiting, RELEASE_MS);
    }

    function beginResultHold() {
      if (resultTimer) root.clearTimeout(resultTimer);
      resultTimer = root.setTimeout(enterRelease, RESULT_HOLD_MS[result] || RESULT_HOLD_MS.miss);
    }

    function ownerIsActive() {
      for (const node of document.querySelectorAll(theme.ownerSelector)) {
        if (isShown(node)) return true;
      }
      return false;
    }

    function syncOwner() {
      const next = ownerIsActive();
      if (next === ownerActive) {
        updateDataset();
        requestDraw(true);
        return;
      }
      ownerActive = next;
      syncSuspension();
      if (!ownerActive) {
        if (releasePending || phase === "result") enterRelease();
      }
    }

    function matchingDetail(event) {
      const detail = event?.detail;
      return detail && detail.machineId === machine ? detail : null;
    }

    function onCabinetInput(event) {
      const detail = matchingDetail(event);
      if (!detail) return;
      const id = String(detail.transactionId ?? "");
      if (detail.type === "spin-start") {
        if (!id || id === previousTransactionId) return;
        clearTimers();
        previousTransactionId = id;
        transactionId = id;
        transactionCount += 1;
        variant = (transactionCount - 1) % 3;
        result = "none";
        resultKind = "";
        stopCount = 0;
        releasePending = false;
        acceptedReels.clear();
        setPhase("spin");
        return;
      }
      if (detail.type !== "stop-accepted" || !id || id !== transactionId) return;
      const reelIndex = Number(detail.reelIndex);
      if (!Number.isInteger(reelIndex) || reelIndex < 0 || reelIndex > 2 || acceptedReels.has(reelIndex)) return;
      acceptedReels.add(reelIndex);
      stopCount = acceptedReels.size;
      setPhase("stop-" + stopCount);
    }

    function onCabinetResult(event) {
      const detail = matchingDetail(event);
      if (!detail) return;
      const id = String(detail.transactionId ?? "");
      if (!id || id !== transactionId) return;
      const stadiumHit = machine === "stadium" && isShown(document.getElementById("stadiumCinema"));
      result = detail.replay === true ? "replay" : Number(detail.payout) > 0 ? "win" : stadiumHit ? "hit" : "miss";
      resultKind = stadiumHit ? "hit" : "";
      stopCount = 3;
      setPhase("result");
      beginResultHold();
    }

    function onSettled(event) {
      if (!event?.detail || phase !== "result") return;
      if (machine === "arena" && event.type === "mimi:arena-settled") resultKind = String(event.detail.kind || "");
      else if (machine === "guild" && event.type === "mimi:guild-settled") resultKind = String(event.detail.kind || "");
      else if (machine === "stadium" && event.type === "mimi:stadium-settled") resultKind = Number(event.detail.payout) > 0 ? "hit" : result;
      else return;
      updateDataset();
      requestDraw(true);
    }

    function onMusic(next) {
      if (!next || typeof next !== "object") return;
      const actual = next.origin === "actual-music" && next.audioSynced === true;
      music = Object.freeze({
        origin: actual ? "actual-music" : "semantic-fallback",
        audioSynced: actual,
        reason: actual ? null : String(next.reason || "music-muted-or-blocked"),
        sequence: actual && Number.isFinite(Number(next.sequence)) ? Number(next.sequence) : 0,
        pulseValue: actual ? clamp(Number(next.pulseValue) || 0, 0, 1) : 0,
        path: actual && typeof next.path === "string" ? next.path : null,
        position: Number.isFinite(Number(next.position)) ? Math.max(0, Number(next.position)) : 0
      });
      updateDataset();
      requestDraw();
    }

    function resize() {
      const rect = stage.getBoundingClientRect();
      const nextWidth = Math.max(1, Math.round(rect.width));
      const nextHeight = Math.max(1, Math.round(rect.height));
      const nextDpr = clamp(Number(root.devicePixelRatio) || 1, 1, MAX_DPR);
      if (nextWidth === width && nextHeight === height && nextDpr === dpr) return;
      width = nextWidth;
      height = nextHeight;
      dpr = nextDpr;
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      requestDraw(true);
    }

    function phasePower() {
      if (phase === "spin") return 0.2;
      if (phase === "stop-1") return 0.36;
      if (phase === "stop-2") return 0.54;
      if (phase === "stop-3") return 0.72;
      if (phase === "result") {
        if (result === "win") return 1;
        if (result === "hit" || ["hit", "victory", "liberation", "guard"].includes(resultKind)) return 0.9;
        if (["explore", "trial", "bonus", "recruit"].includes(resultKind)) return 0.7;
        return result === "replay" ? 0.72 : 0.48;
      }
      if (phase === "release") return 0.26;
      return 0.12;
    }

    function ambientValue(time) {
      if (reducedMotion()) return 0.45;
      return 0.5 + Math.sin(time * 0.72 + variant * 1.7) * 0.12;
    }

    function actualPulse() {
      return music.audioSynced ? music.pulseValue : 0;
    }

    function radial(ctx, x, y, radius, inner, outer) {
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
      gradient.addColorStop(0, inner);
      gradient.addColorStop(1, outer);
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, TAU);
      ctx.fill();
    }

    function strokePath(ctx, points, color, lineWidth, dash) {
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
      ctx.setLineDash(dash || []);
      ctx.beginPath();
      points(ctx);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    function drawArena(ctx, time, power, ambient, pulse) {
      const doorX = width * (0.79 + variant * 0.012);
      const doorY = height * 0.43;
      const crystalX = width * (0.555 + variant * 0.014);
      const crystalY = height * (0.39 - variant * 0.015);
      const lift = clamp(power + pulse * 0.7, 0, 1.4);
      const doorWeight = [1, 0.72, 0.84][variant];
      const crystalWeight = [0.72, 1, 0.8][variant];
      const trailWeight = [0.72, 0.78, 1][variant];

      ctx.globalCompositeOperation = "screen";
      radial(ctx, doorX, doorY, height * (0.19 + lift * 0.035), `rgba(255,222,142,${(0.07 + lift * 0.12) * doorWeight})`, "rgba(255,190,90,0)");
      radial(ctx, crystalX, crystalY, height * (0.105 + pulse * 0.018), `rgba(117,235,255,${(0.12 + lift * 0.2) * crystalWeight})`, "rgba(56,156,255,0)");

      ctx.save();
      ctx.translate(crystalX, crystalY);
      ctx.rotate(Math.PI / 4);
      ctx.strokeStyle = `rgba(150,244,255,${0.24 + lift * 0.34})`;
      ctx.lineWidth = Math.max(1, height * 0.003);
      ctx.strokeRect(-height * 0.035, -height * 0.035, height * 0.07, height * 0.07);
      ctx.restore();

      const motionalTime = reducedMotion() ? 0 : time;
      for (let index = 0; index < 5; index += 1) {
        const travel = (motionalTime * (0.045 + variant * 0.004) + index * 0.22 + variant * 0.11) % 1;
        const x = crystalX + (doorX - crystalX) * travel;
        const y = crystalY + Math.sin(travel * Math.PI) * height * (-0.055 - index * 0.004);
        radial(ctx, x, y, Math.max(1.5, height * 0.008), `rgba(185,248,255,${(0.08 + lift * 0.12) * trailWeight})`, "rgba(100,210,255,0)");
      }

      const rays = 1 + stopCount;
      for (let index = 0; index < rays; index += 1) {
        const offset = (index - (rays - 1) / 2) * height * 0.055;
        strokePath(ctx, line => {
          line.moveTo(crystalX, crystalY + offset * 0.2);
          line.quadraticCurveTo(width * 0.68, crystalY - height * (0.045 + index * 0.009), doorX, doorY + offset);
        }, `rgba(135,228,255,${0.08 + power * 0.18})`, Math.max(1, height * 0.0025));
      }
      ctx.globalCompositeOperation = "source-over";
    }

    function drawGuild(ctx, time, power, ambient, pulse) {
      const motionalTime = reducedMotion() ? 0 : time;
      const candleWeight = [1, 0.68, 0.76][variant];
      const tableWeight = [0.7, 1, 0.78][variant];
      const crowdWeight = [0.68, 0.76, 1][variant];
      const candlePositions = [
        [0.075, 0.18], [0.105, 0.28], [0.43, 0.29], [0.49, 0.22], [0.88, 0.24], [0.94, 0.34]
      ];
      ctx.globalCompositeOperation = "screen";
      candlePositions.forEach(([x, y], index) => {
        const flicker = 0.78 + Math.sin(motionalTime * (2.1 + index * 0.08) + index * 1.31 + variant) * 0.12;
        radial(ctx, width * x, height * y, height * (0.045 + pulse * 0.008), `rgba(255,187,92,${(0.06 + power * 0.08) * flicker * candleWeight})`, "rgba(255,124,40,0)");
      });

      const tableY = height * 0.735;
      const tableGlow = (0.08 + power * 0.2 + pulse * 0.13) * tableWeight;
      strokePath(ctx, line => {
        line.moveTo(width * 0.055, tableY);
        line.bezierCurveTo(width * 0.28, tableY - height * 0.018, width * 0.59, tableY + height * 0.012, width * 0.93, tableY - height * 0.006);
      }, `rgba(255,196,111,${tableGlow})`, Math.max(1, height * 0.004));

      const marks = Math.max(1, stopCount);
      for (let index = 0; index < marks; index += 1) {
        const x = width * (0.46 + index * 0.075 + variant * 0.012);
        ctx.save();
        ctx.translate(x, tableY - height * 0.033);
        ctx.rotate((-0.04 + index * 0.04) * (variant === 1 ? -1 : 1));
        ctx.strokeStyle = `rgba(255,220,151,${0.08 + power * 0.16})`;
        ctx.lineWidth = Math.max(1, height * 0.002);
        ctx.strokeRect(-height * 0.018, -height * 0.028, height * 0.036, height * 0.056);
        ctx.restore();
      }

      for (let index = 0; index < 11; index += 1) {
        const x = width * (0.39 + index * 0.047);
        const y = height * (0.54 + ((index + variant) % 3) * 0.018);
        const visible = index < 4 + stopCount * 2 || phase === "result";
        if (!visible) continue;
        radial(ctx, x, y, Math.max(1.2, height * 0.005), `rgba(255,205,126,${(0.04 + power * 0.09 + ambient * 0.025) * crowdWeight})`, "rgba(255,170,80,0)");
      }
      ctx.globalCompositeOperation = "source-over";
    }

    function drawStadium(ctx, time, power, ambient, pulse) {
      const homeX = width * 0.51;
      const homeY = height * 0.79;
      const moundX = width * 0.48;
      const moundY = height * 0.54;
      const lift = clamp(power + pulse * 0.65, 0, 1.4);
      const lightWeight = [1, 0.7, 0.82][variant];
      const pitchWeight = [0.76, 1, 0.8][variant];
      const sweepWeight = [0.7, 0.78, 1][variant];
      ctx.globalCompositeOperation = "screen";

      [[0.16, 0.25], [0.34, 0.2], [0.66, 0.2], [0.84, 0.25]].forEach(([x, y], index) => {
        radial(ctx, width * x, height * y, height * (0.075 + pulse * 0.014), `rgba(236,244,255,${(0.045 + lift * 0.075 + index % 2 * 0.012) * lightWeight})`, "rgba(178,211,255,0)");
      });

      const segmentCount = phase === "result" ? 12 : Math.max(3, 3 + stopCount * 3);
      let targetX = homeX;
      let targetY = homeY;
      let controlX = width * (0.47 + variant * 0.018);
      let controlY = height * (0.64 - variant * 0.012);
      if (phase === "result" && (result === "win" || result === "hit")) {
        targetX = width * (0.37 + variant * 0.13);
        targetY = height * 0.23;
        controlX = width * (0.58 - variant * 0.08);
        controlY = height * 0.4;
      } else if (phase === "result" && result === "replay") {
        targetX = width * 0.76;
        targetY = height * 0.42;
        controlX = width * 0.64;
        controlY = height * 0.52;
      }

      for (let index = 0; index < segmentCount; index += 1) {
        const amount = segmentCount <= 1 ? 1 : index / (segmentCount - 1);
        const inverse = 1 - amount;
        const x = inverse * inverse * moundX + 2 * inverse * amount * controlX + amount * amount * targetX;
        const y = inverse * inverse * moundY + 2 * inverse * amount * controlY + amount * amount * targetY;
        const alpha = (0.035 + lift * 0.075 + (index / segmentCount) * 0.045) * pitchWeight;
        radial(ctx, x, y, Math.max(1.3, height * (0.004 + amount * 0.002)), `rgba(255,242,194,${alpha})`, "rgba(255,193,90,0)");
      }

      const sweep = reducedMotion() ? 0.5 : (time * 0.09 + variant * 0.27) % 1;
      strokePath(ctx, line => {
        line.moveTo(width * (0.08 + sweep * 0.2), height * 0.13);
        line.lineTo(width * (0.34 + sweep * 0.25), height * 0.86);
      }, `rgba(205,228,255,${(0.025 + ambient * 0.035 + pulse * 0.08) * sweepWeight})`, width * 0.055);
      ctx.globalCompositeOperation = "source-over";
    }

    function draw(timestamp) {
      drawFrame = 0;
      if (!context || suspended() || !canvas.isConnected) return;
      resize();
      const time = motionTime(timestamp);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      context.clearRect(0, 0, width, height);
      const releaseFade = phase === "release" ? 1 - clamp((timestamp - phaseStartedAt) / RELEASE_MS, 0, 1) : 1;
      const power = phasePower() * releaseFade;
      const ambient = ambientValue(time);
      const pulse = actualPulse();
      if (machine === "arena") drawArena(context, time, power, ambient, pulse);
      else if (machine === "guild") drawGuild(context, time, power, ambient, pulse);
      else drawStadium(context, time, power, ambient, pulse);
      continueDrawing();
    }

    const ownerObserver = new MutationObserver(syncOwner);
    ownerObserver.observe(cabinet, { subtree: true, attributes: true, attributeFilter: ["hidden", "open", "aria-hidden", "class", "data-motion"] });

    const resizeObserver = typeof ResizeObserver === "function" ? new ResizeObserver(resize) : null;
    resizeObserver?.observe(stage);
    if (!resizeObserver) listen(root, "resize", resize);

    listen(root, "mimi:cabinet-input", onCabinetInput);
    listen(root, "mimi:cabinet-result", onCabinetResult);
    listen(root, "mimi:arena-settled", onSettled);
    listen(root, "mimi:guild-settled", onSettled);
    listen(root, "mimi:stadium-settled", onSettled);
    listen(root, "blur", () => { focused = false; syncSuspension(); });
    listen(root, "focus", () => { focused = true; syncSuspension(); });
    listen(document, "visibilitychange", syncSuspension);
    if (reducedQuery?.addEventListener) listen(reducedQuery, "change", () => { updateDataset(); requestDraw(true); });

    let unsubscribeMusic = noop;
    try {
      if (root.MimiMusicMotion && typeof root.MimiMusicMotion.subscribe === "function") {
        unsubscribeMusic = root.MimiMusicMotion.subscribe(onMusic);
      }
    } catch (_) {
      unsubscribeMusic = noop;
    }

    syncOwner();
    syncSuspension();
    resize();
    updateDataset();
    requestDraw();

    return Object.freeze({
      api,
      destroy() {
        clearTimers();
        if (drawFrame) root.cancelAnimationFrame(drawFrame);
        if (fallbackFrame) root.clearTimeout(fallbackFrame);
        unsubscribeMusic();
        ownerObserver.disconnect();
        resizeObserver?.disconnect();
        listeners.splice(0).forEach(remove => remove());
        canvas.remove();
      }
    });
  }

  function boot() {
    if (!root.matchMedia?.("(min-width: 900px)").matches) return;
    const selected = selectTheme();
    if (!selected) return;
    const stage = document.querySelector(selected.theme.stageSelector);
    if (!stage || stage.querySelector(":scope > .slot-stage-direction")) return;
    const direction = createDirection(selected.machine, selected.theme, stage);
    root.MimiSlotStageDirection = direction.api;
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
}(typeof globalThis !== "undefined" ? globalThis : this));
