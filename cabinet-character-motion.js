/* Visual-only character video direction. Reel state and outcomes remain owned by each cabinet runtime. */
(function (root) {
  "use strict";

  const document = root.document;
  if (!document) return;

  const CONFIGS = Object.freeze({
    stadium: Object.freeze({
      actorId: "player08",
      machineId: "stadium",
      classSuffix: "stadium",
      bodyClass: "stadium-page",
      stageSelector: ".stadium-theater",
      stillSelector: "#stadiumBatter",
      expectedStillPath: "assets/stadium/player_08.png",
      normalPhase: "normal",
      placement: "existing-character-zone",
      ownerSelector: "#stadiumCinema:not([hidden]), #stadiumFeature:not([hidden]), #stadiumSurgeryArt:not([hidden]), #stadiumVictory:not([hidden]), #stadiumCommand:not([hidden]), dialog[open]",
      sources: Object.freeze([
        Object.freeze({ src: "./assets/stadium/motion/player08-ready-practice-v1.webm", type: "video/webm; codecs=\"vp9\"" }),
        Object.freeze({ src: "./assets/stadium/motion/player08-ready-practice-v1-vp8.webm", type: "video/webm; codecs=\"vp8\"" })
      ]),
      frameRate: 24,
      frameCount: 121,
      quiet: Object.freeze({ start: 0.04, end: 2.54, reducedPose: 0.8 }),
      practice: Object.freeze({ start: 2.6, end: 4.96, reducedPose: 3.2, resultPose: 4.0 }),
      pendingJobId: null
    }),
    stadiumDoctor: Object.freeze({
      actorId: "doctor",
      machineId: "stadium",
      classSuffix: "stadium-doctor",
      bodyClass: "stadium-page",
      stageSelector: ".stadium-theater",
      stillSelector: ".stadium-mimi",
      expectedStillPath: "assets/stadium/mimi_doctor.png",
      normalPhase: "normal",
      placement: "existing-character-zone",
      ownerSelector: "#stadiumCinema:not([hidden]), #stadiumFeature:not([hidden]), #stadiumSurgeryArt:not([hidden]), #stadiumVictory:not([hidden]), #stadiumCommand:not([hidden]), dialog[open]",
      sources: Object.freeze([
        Object.freeze({ src: "./assets/stadium/motion/doctor-ready-idle-v1.webm", type: "video/webm; codecs=\"vp9\"" }),
        Object.freeze({ src: "./assets/stadium/motion/doctor-ready-idle-v1-vp8.webm", type: "video/webm; codecs=\"vp8\"" })
      ]),
      frameRate: 24,
      frameCount: 121,
      quiet: Object.freeze({ start: 0.04, end: 4.96, reducedPose: 0.8 }),
      practice: Object.freeze({ start: 2.6, end: 4.96, reducedPose: 3.2, resultPose: 4.0 }),
      pendingJobId: null
    }),
    arena: Object.freeze({
      actorId: "exploration",
      machineId: "arena",
      classSuffix: "arena",
      bodyClass: "arena-page",
      stageSelector: ".arena-theater",
      stillSelector: "#arenaJourneyArt",
      expectedStillPath: "assets/arena/exploration-arcade-v1.png",
      normalPhase: "normal",
      placement: "full-scene",
      hideStill: false,
      requireStillVisible: true,
      ownerSelector: "#arenaCinema:not([hidden]), #arenaCutin:not([hidden]), #arenaReward:not([hidden]), #arenaCommand:not([hidden]), dialog[open]",
      sources: Object.freeze([
        Object.freeze({ src: "./assets/arena/motion/exploration-idle-v1.mp4", type: "video/mp4" })
      ]),
      frameRate: 24,
      frameCount: 115,
      quiet: Object.freeze({ start: 0.04, end: 4.75, reducedPose: 1.2 }),
      practice: Object.freeze({ start: 1.2, end: 4.75, reducedPose: 2.4, resultPose: 3.6 }),
      attentionPoints: Object.freeze([0.04, 1.2, 2.4, 3.6]),
      attentionDuration: 0.8,
      resultGesture: false,
      pendingJobId: null
    }),
    guild: Object.freeze({
      actorId: "tabletop",
      machineId: "guild",
      classSuffix: "guild",
      bodyClass: "guild-page",
      stageSelector: ".guild-stage",
      stillSelector: "#guildScene",
      expectedStillPath: "assets/guild/mimi-opening-v2.png",
      expectedTextSelector: "#guildTown",
      expectedText: "第1幕　欠け鐘区",
      normalPhase: "normal",
      placement: "full-scene",
      hideStill: false,
      requireStillVisible: true,
      ownerSelector: "#guildFeature:not([hidden]), #guildCommand:not([hidden]), dialog[open]",
      sources: Object.freeze([
        Object.freeze({ src: "./assets/guild/motion/tabletop-idle-v1.mp4", type: "video/mp4" })
      ]),
      frameRate: 24,
      frameCount: 115,
      quiet: Object.freeze({ start: 0.04, end: 4.75, reducedPose: 1.2 }),
      practice: Object.freeze({ start: 1.2, end: 4.75, reducedPose: 2.4, resultPose: 3.6 }),
      attentionPoints: Object.freeze([0.04, 1.2, 2.4, 3.6]),
      attentionDuration: 0.8,
      resultGesture: false,
      pendingJobId: null
    }),
    guildHost: Object.freeze({
      actorId: "guildHost",
      machineId: "guild",
      classSuffix: "guild-host",
      bodyClass: "guild-page",
      stageSelector: ".guild-stage",
      stillSelector: "#guildScene",
      expectedStillPaths: Object.freeze([
        "assets/guild/hero-plaza-arrival-v1.png",
        "assets/guild/merchant-market-arrival-v1.png"
      ]),
      normalPhase: "normal",
      placement: "existing-character-zone",
      hideStill: false,
      requireStillVisible: true,
      ownerSelector: "#guildFeature:not([hidden]), #guildCommand:not([hidden]), dialog[open]",
      sources: Object.freeze([
        Object.freeze({ src: "./assets/guild/motion/mimi-host-idle-v1.webm", type: "video/webm; codecs=\"vp9\"" }),
        Object.freeze({ src: "./assets/guild/motion/mimi-host-idle-v1-vp8.webm", type: "video/webm; codecs=\"vp8\"" })
      ]),
      frameRate: 24,
      frameCount: 121,
      quiet: Object.freeze({ start: 0.04, end: 4.96, reducedPose: 0.8 }),
      practice: Object.freeze({ start: 1.2, end: 4.96, reducedPose: 2.4, resultPose: 3.6 }),
      attentionPoints: Object.freeze([0.04, 1.2, 2.4, 3.6]),
      attentionDuration: 0.8,
      resultGesture: false,
      pendingJobId: null
    })
  });

  const noop = function () {};
  const desktopQuery = root.matchMedia?.("(min-width: 900px)") || Object.freeze({ matches: true });
  let runningDirectors = [];

  function now() {
    return root.performance && typeof root.performance.now === "function" ? root.performance.now() : Date.now();
  }

  function selectConfigs() {
    const body = document.body;
    if (!body) return [];
    return Object.entries(CONFIGS)
      .filter(([, config]) => body.classList.contains(config.bodyClass) && config.sources.length)
      .map(([key, config]) => ({ key, config }));
  }

  function isShown(node) {
    return Boolean(node && !node.hidden && node.getAttribute("aria-hidden") !== "true");
  }

  function currentPath(node) {
    // The authored src attribute changes synchronously with the runtime scene.
    // currentSrc may retain the previous decoded image until its replacement loads.
    const raw = node?.getAttribute?.("src") || node?.currentSrc || node?.src || "";
    try { return decodeURIComponent(new URL(raw, document.baseURI).pathname).replace(/^\/+/, ""); }
    catch (_) { return String(raw).split(/[?#]/, 1)[0].replace(/^\.\//, "").replace(/\\/g, "/"); }
  }

  function createDirector(key, config, stage, still) {
    const machine = config.machineId || key;
    const actorId = config.actorId || key;
    const cabinet = stage.closest("main") || stage;
    const reducedQuery = root.matchMedia?.("(prefers-reduced-motion: reduce)") || null;
    const listeners = [];
    const acceptedStops = new Set();
    const originalStillHidden = still.hidden;
    const hideStill = config.hideStill !== false;
    const video = document.createElement("video");
    video.className = `cabinet-character-motion cabinet-character-motion--${config.classSuffix || key}`;
    video.dataset.characterMotionMachine = machine;
    video.dataset.characterMotionActor = actorId;
    video.setAttribute("aria-hidden", "true");
    video.setAttribute("playsinline", "");
    video.setAttribute("disablepictureinpicture", "");
    video.tabIndex = -1;
    video.controls = false;
    video.loop = false;
    video.autoplay = false;
    video.preload = "auto";
    video.defaultMuted = true;
    video.muted = true;
    video.volume = 0;
    video.playsInline = true;
    video.disablePictureInPicture = true;
    video.style.pointerEvents = "none";
    video.inert = true;
    video.hidden = true;
    still.insertAdjacentElement("afterend", video);

    let ready = false;
    let failed = false;
    let failReason = "";
    let focused = true;
    let ownerActive = false;
    let transactionId = "";
    let stopCount = 0;
    let mode = "loading";
    let trigger = "boot";
    let currentFrame = 0;
    let presentedFrames = 0;
    let monitorFrame = 0;
    let monitorKind = "";
    let lastTriggerAt = -Infinity;
    let lastMusicSequence = -1;
    let objectUrl = "";
    let loadedSource = "";
    let loadingSource = false;
    let sourceCursor = 0;
    let segmentEnd = config.quiet.end;
    let music = Object.freeze({ origin: "semantic-fallback", audioSynced: false, reason: "music-motion-unavailable", sequence: 0, pulseValue: 0, path: null, position: 0 });
    let loadTimer = root.setTimeout(() => fail("load-timeout"), 20000);

    function listen(target, type, handler, options) {
      target.addEventListener(type, handler, options);
      listeners.push(() => target.removeEventListener(type, handler, options));
    }

    async function loadMedia() {
      if (failed || loadingSource) return;
      loadingSource = true;
      const playable = config.sources.filter(source => !source.type || video.canPlayType(source.type));
      while (sourceCursor < playable.length) {
        const source = playable[sourceCursor++];
        try {
          const response = await root.fetch(new URL(source.src, document.baseURI).href, {
            credentials: "same-origin",
            cache: "default"
          });
          if (!response.ok) continue;
          const bytes = await response.arrayBuffer();
          const declaredType = String(source.type || response.headers.get("content-type") || "application/octet-stream").split(";", 1)[0];
          const blob = new Blob([bytes], { type: declaredType });
          if (failed || !video.isConnected) return;
          if (objectUrl) URL.revokeObjectURL(objectUrl);
          objectUrl = URL.createObjectURL(blob);
          loadedSource = new URL(source.src, document.baseURI).href;
          video.src = objectUrl;
          video.load();
          loadingSource = false;
          return;
        } catch (_) { /* Try the next declared codec. */ }
      }
      loadingSource = false;
      fail("media-unavailable");
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

    function actorMatches() {
      if (config.normalPhase && cabinet.dataset.phase && cabinet.dataset.phase !== config.normalPhase) return false;
      if (config.requireStillVisible && still.hidden) return false;
      if (config.expectedTextSelector) {
        const expectedNode = document.querySelector(config.expectedTextSelector);
        if (!expectedNode || expectedNode.textContent.trim() !== config.expectedText) return false;
      }
      const path = currentPath(still);
      const expectedPaths = config.expectedStillPaths || (config.expectedStillPath ? [config.expectedStillPath] : []);
      if (!expectedPaths.length) return true;
      return expectedPaths.some(expected => path === expected || path.endsWith("/" + expected));
    }

    function ownerIsActive() {
      for (const node of document.querySelectorAll(config.ownerSelector)) if (isShown(node)) return true;
      return false;
    }

    function suspensionReason() {
      if (document.hidden) return "hidden";
      if (!focused) return "blurred";
      if (ownerActive) return "feature-owner";
      if (!actorMatches()) return "different-actor";
      return "none";
    }

    function suspended() {
      return suspensionReason() !== "none";
    }

    function updateFrame() {
      const time = Number(video.currentTime) || 0;
      currentFrame = Math.max(0, Math.min(config.frameCount - 1, Math.floor(time * config.frameRate + 0.0001)));
    }

    function updateDataset() {
      updateFrame();
      const state = failed ? "failed" : !ready ? "loading" : suspended() ? "suspended" : reducedMotion() ? "reduced" : mode;
      video.dataset.characterMotionState = state;
      video.dataset.characterMotionMode = mode;
      video.dataset.characterMotionTrigger = trigger;
      video.dataset.characterMotionFrame = String(currentFrame);
      video.dataset.characterMotionFrameCount = String(config.frameCount);
      video.dataset.characterMotionPresentedFrames = String(presentedFrames);
      video.dataset.characterMotionStopCount = String(stopCount);
      video.dataset.characterMotionTransaction = transactionId;
      video.dataset.characterMotionOwner = ownerActive ? "feature" : "character";
      video.dataset.characterMotionSuspended = suspensionReason();
      video.dataset.characterMotionReduced = String(reducedMotion());
      video.dataset.characterMotionMusic = music.origin;
      video.dataset.characterMotionMusicSynced = String(music.audioSynced === true);
      video.dataset.characterMotionMusicSequence = String(music.sequence || 0);
      cabinet.dataset.characterMotion = state;
      cabinet.dataset.characterMotionFrame = String(currentFrame);
    }

    function stopMonitor() {
      if (!monitorFrame) return;
      if (monitorKind === "video" && typeof video.cancelVideoFrameCallback === "function") video.cancelVideoFrameCallback(monitorFrame);
      else root.cancelAnimationFrame(monitorFrame);
      monitorFrame = 0;
      monitorKind = "";
    }

    function playSafely() {
      let attempt;
      try { attempt = video.play(); }
      catch (_) { fail("play-threw"); return; }
      if (attempt && typeof attempt.catch === "function") {
        attempt.catch(error => {
          if (error?.name === "AbortError" || suspended() || reducedMotion() || video.paused === false) return;
          fail("play-rejected");
        });
      }
    }

    function monitor(_, metadata) {
      monitorFrame = 0;
      monitorKind = "";
      if (!ready || failed || suspended() || reducedMotion()) { updateDataset(); return; }
      if (metadata && Number.isFinite(metadata.presentedFrames)) presentedFrames = metadata.presentedFrames;
      const time = Number(metadata?.mediaTime ?? video.currentTime) || 0;
      if (mode === "practice" && time >= segmentEnd) enterQuiet(true, "practice-complete");
      else if (mode === "quiet" && time >= config.quiet.end) enterQuiet(true, "quiet-loop");
      updateDataset();
      startMonitor();
    }

    function startMonitor() {
      if (monitorFrame || !ready || failed || suspended() || reducedMotion()) return;
      if (typeof video.requestVideoFrameCallback === "function") {
        monitorKind = "video";
        monitorFrame = video.requestVideoFrameCallback(monitor);
      } else {
        monitorKind = "animation";
        monitorFrame = root.requestAnimationFrame(monitor);
      }
    }

    function seek(time) {
      try { video.currentTime = time; }
      catch (_) { /* Metadata may still be completing; loadeddata retries the state. */ }
      updateFrame();
    }

    function enterQuiet(reset, reason) {
      mode = "quiet";
      trigger = reason || "quiet";
      segmentEnd = config.quiet.end;
      if (reset || video.currentTime < config.quiet.start || video.currentTime >= config.quiet.end) seek(reducedMotion() ? config.quiet.reducedPose : config.quiet.start);
      syncPlayback();
    }

    function reducedPose(kind) {
      mode = "reduced";
      trigger = kind;
      video.pause();
      stopMonitor();
      seek(kind === "neutral-result" ? config.practice.resultPose : kind.startsWith("stop-") ? config.practice.reducedPose : config.quiet.reducedPose);
      syncPresence();
      updateDataset();
    }

    function startPractice(reason, startOverride) {
      if (!ready || failed || suspended()) return false;
      if (reducedMotion()) { reducedPose(reason); return true; }
      const hasOverride = Number.isFinite(Number(startOverride));
      if (mode === "practice" && !hasOverride) return false;
      const start = hasOverride ? Math.max(config.quiet.start, Math.min(config.quiet.end, Number(startOverride))) : config.practice.start;
      mode = "practice";
      trigger = reason;
      lastTriggerAt = now();
      segmentEnd = config.attentionDuration
        ? Math.min(config.quiet.end, start + config.attentionDuration)
        : config.practice.end;
      seek(start);
      syncPlayback();
      return true;
    }

    function syncPresence() {
      const hide = (node, value) => { if (node.hidden !== value) node.hidden = value; };
      if (failed) {
        hide(video, true);
        if (hideStill) hide(still, originalStillHidden);
        return;
      }
      if (!ready) {
        hide(video, true);
        if (hideStill) hide(still, originalStillHidden);
        return;
      }
      if (ownerActive) {
        hide(video, true);
        if (hideStill) hide(still, true);
        return;
      }
      if (!actorMatches()) {
        hide(video, true);
        if (hideStill) hide(still, originalStillHidden);
        return;
      }
      hide(video, false);
      if (hideStill) hide(still, true);
    }

    function syncPlayback() {
      syncPresence();
      if (!ready || failed || suspended()) {
        video.pause();
        stopMonitor();
        updateDataset();
        return;
      }
      if (reducedMotion()) {
        video.pause();
        stopMonitor();
        if (mode !== "reduced") reducedPose("ready-pose");
        else updateDataset();
        return;
      }
      if (mode === "reduced" || mode === "loading") {
        mode = "quiet";
        trigger = "motion-resumed";
        seek(config.quiet.start);
      }
      playSafely();
      startMonitor();
      updateDataset();
    }

    function fail(reason) {
      if (failed) return;
      failed = true;
      ready = false;
      failReason = reason;
      if (loadTimer) root.clearTimeout(loadTimer);
      loadTimer = 0;
      video.pause();
      stopMonitor();
      syncPresence();
      updateDataset();
    }

    function syncOwner() {
      const next = ownerIsActive();
      if (next && !ownerActive) {
        ownerActive = true;
        mode = "quiet";
        trigger = "feature-owner";
        seek(config.quiet.start);
      } else ownerActive = next;
      syncPlayback();
    }

    function onLoaded() {
      if (failed) return;
      if (loadTimer) root.clearTimeout(loadTimer);
      loadTimer = 0;
      ready = true;
      failReason = "";
      enterQuiet(true, "media-ready");
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
        if (!id || id === transactionId) return;
        transactionId = id;
        acceptedStops.clear();
        stopCount = 0;
        enterQuiet(true, "spin-start");
        return;
      }
      if (detail.type !== "stop-accepted" || !id || id !== transactionId) return;
      const reel = Number(detail.reelIndex);
      if (!Number.isInteger(reel) || reel < 0 || reel > 2 || acceptedStops.has(reel)) return;
      acceptedStops.add(reel);
      stopCount = acceptedStops.size;
      startPractice("stop-" + stopCount, config.attentionPoints?.[stopCount]);
      updateDataset();
    }

    function onCabinetResult(event) {
      const detail = matchingDetail(event);
      if (!detail) return;
      const id = String(detail.transactionId ?? "");
      if (!id || id !== transactionId) return;
      if (config.resultGesture === false) enterQuiet(true, "revealed-result");
      else if (Number(detail.payout) <= 0 && detail.replay !== true && !ownerIsActive()) startPractice("neutral-result");
      else enterQuiet(true, "revealed-result");
    }

    function onMusic(next) {
      if (!next || typeof next !== "object") return;
      const actual = next.origin === "actual-music" && next.audioSynced === true;
      music = Object.freeze({
        origin: actual ? "actual-music" : "semantic-fallback",
        audioSynced: actual,
        reason: actual ? null : String(next.reason || "music-muted-or-blocked"),
        sequence: actual && Number.isFinite(Number(next.sequence)) ? Number(next.sequence) : 0,
        pulseValue: actual ? Math.max(0, Math.min(1, Number(next.pulseValue) || 0)) : 0,
        path: actual && typeof next.path === "string" ? next.path : null,
        position: Number.isFinite(Number(next.position)) ? Math.max(0, Number(next.position)) : 0
      });
      const sequence = music.sequence;
      const waiting = cabinet.dataset.spinning !== "true" && !ownerIsActive();
      if (actual && music.pulseValue > 0 && sequence > lastMusicSequence) {
        lastMusicSequence = sequence;
        if (waiting && now() - lastTriggerAt >= ((config.attentionDuration || (config.practice.end - config.practice.start)) * 1000 + 320)) startPractice("music-pulse", config.attentionPoints?.[0]);
      }
      updateDataset();
    }

    function snapshot() {
      return Object.freeze({
        machine,
        actor: actorId,
        ready,
        failed,
        failReason: failReason || null,
        mode,
        trigger,
        currentFrame,
        frameCount: config.frameCount,
        presentedFrames,
        transactionId: transactionId || null,
        stopCount,
        suspended: suspensionReason(),
        reduced: reducedMotion(),
        owner: ownerActive ? "feature" : "character",
        actorMatches: actorMatches(),
        media: Object.freeze({ currentTime: Number((Number(video.currentTime) || 0).toFixed(3)), paused: video.paused, muted: video.muted, source: loadedSource || video.currentSrc || null }),
        music
      });
    }

    listen(video, "loadeddata", onLoaded, { once: true });
    listen(video, "error", () => {
      if (failed || ready) { fail("media-error"); return; }
      video.pause();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      objectUrl = "";
      loadedSource = "";
      loadingSource = false;
      video.removeAttribute("src");
      loadMedia();
    });
    listen(video, "seeking", updateDataset);
    listen(video, "seeked", updateDataset);
    listen(root, "mimi:cabinet-input", onCabinetInput);
    listen(root, "mimi:cabinet-result", onCabinetResult);
    listen(root, "blur", () => { focused = false; syncPlayback(); });
    listen(root, "focus", () => { focused = true; syncPlayback(); });
    listen(document, "visibilitychange", syncPlayback);
    if (reducedQuery?.addEventListener) listen(reducedQuery, "change", syncPlayback);

    const ownerObserver = new MutationObserver(syncOwner);
    ownerObserver.observe(cabinet, { subtree: true, attributes: true, attributeFilter: ["hidden", "open", "aria-hidden", "class", "src", "data-phase", "data-motion"] });

    let unsubscribeMusic = noop;
    try {
      if (root.MimiMusicMotion && typeof root.MimiMusicMotion.subscribe === "function") unsubscribeMusic = root.MimiMusicMotion.subscribe(onMusic);
    } catch (_) { unsubscribeMusic = noop; }

    updateDataset();
    loadMedia();

    const api = Object.freeze({
      get machine() { return machine; },
      get actor() { return actorId; },
      get active() { return video.isConnected && !failed; },
      snapshot
    });
    return Object.freeze({
      api,
      destroy() {
        if (loadTimer) root.clearTimeout(loadTimer);
        stopMonitor();
        unsubscribeMusic();
        ownerObserver.disconnect();
        listeners.splice(0).forEach(remove => remove());
        video.pause();
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        video.remove();
        if (hideStill) still.hidden = originalStillHidden;
        delete cabinet.dataset.characterMotion;
        delete cabinet.dataset.characterMotionFrame;
      }
    });
  }

  function boot() {
    if (!desktopQuery.matches || runningDirectors.length) return;
    const selected = selectConfigs();
    const directors = [];
    for (const { key, config } of selected) {
      const stage = document.querySelector(config.stageSelector);
      const still = document.querySelector(config.stillSelector);
      const actorId = config.actorId || key;
      if (!stage || !still || stage.querySelector(`[data-character-motion-actor="${actorId}"]`)) continue;
      directors.push(createDirector(key, config, stage, still));
    }
    if (!directors.length) return;
    runningDirectors = directors;
    const byActor = actor => directors.find(director => director.api.actor === actor);
    root.MimiCabinetCharacterMotion = Object.freeze({
      get machine() { return directors[0].api.machine; },
      get active() { return directors.some(director => director.api.active); },
      snapshot(actor) { return (actor ? byActor(actor) : directors[0])?.api.snapshot() || null; },
      snapshots() { return Object.freeze(directors.map(director => director.api.snapshot())); }
    });
  }

  function destroyDirectors() {
    runningDirectors.splice(0).forEach(director => director.destroy());
    try { delete root.MimiCabinetCharacterMotion; }
    catch (_) { root.MimiCabinetCharacterMotion = undefined; }
  }

  function syncDesktop(event) {
    if (event?.matches ?? desktopQuery.matches) boot();
    else destroyDirectors();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
  if (desktopQuery.addEventListener) desktopQuery.addEventListener("change", syncDesktop);
}(typeof globalThis !== "undefined" ? globalThis : this));
