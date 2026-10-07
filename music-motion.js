/* Observation-only music transport for character motion. */
(function (root) {
  "use strict";

  const document = root.document;
  const FRAME_MS = 1000 / 30;
  const PULSE_DECAY_MS = 120;
  const FETCH_TIMEOUT_MS = 5000;
  const registeredMedia = new Map();
  const listeners = new Set();
  const tracks = new Map();
  let metadataState = "loading";
  let frameTimer = 0;
  let focused = true;
  let sequence = 0;
  let pulseAt = -Infinity;
  let pulseStrength = 0;
  let semanticStartedAt = now();
  let observer = freshObserver();

  function now() {
    return root.performance && typeof root.performance.now === "function" ? root.performance.now() : Date.now();
  }

  function freshObserver() {
    return { path: null, time: null, wall: null, onsetIndex: -1, baseline: true };
  }

  function immutableSnapshot(values) {
    return Object.freeze(values);
  }

  let current = immutableSnapshot({
    ready: false,
    state: metadataState,
    origin: "semantic-fallback",
    audioSynced: false,
    reason: "metadata-loading",
    track: null,
    path: null,
    currentTime: null,
    position: 0,
    latestOnsetIndex: -1,
    latestOnsetStrength: 0,
    latestOnsetPosition: null,
    pulseValue: 0,
    sequence: 0
  });

  function semanticSnapshot(reason, transport) {
    observer = freshObserver();
    pulseAt = -Infinity;
    pulseStrength = 0;
    return immutableSnapshot({
      ready: metadataState !== "loading",
      state: metadataState,
      origin: "semantic-fallback",
      audioSynced: false,
      reason,
      track: transport?.track || null,
      path: transport?.path || null,
      currentTime: null,
      position: Math.max(0, (now() - semanticStartedAt) / 1000),
      latestOnsetIndex: -1,
      latestOnsetStrength: 0,
      latestOnsetPosition: null,
      pulseValue: 0,
      sequence
    });
  }

  function stripQuery(value) {
    return String(value || "").split(/[?#]/, 1)[0].replace(/\\/g, "/");
  }

  function decodedPath(value) {
    try { return decodeURIComponent(stripQuery(value)); }
    catch (_) { return stripQuery(value); }
  }

  function matchTrackPath(raw) {
    if (!raw || !tracks.size) return null;
    let candidate = decodedPath(raw).replace(/^\.\//, "");
    if (tracks.has(candidate)) return candidate;
    if (candidate === "Velvet Jackpot.mp3" || candidate === "Jackpot.mp3") {
      candidate = "assets/" + candidate;
      if (tracks.has(candidate)) return candidate;
    }
    try {
      candidate = decodedPath(new URL(raw, document.baseURI).pathname).replace(/^\/+/, "");
    } catch (_) { /* A malformed source remains unmatched. */ }
    for (const path of tracks.keys()) {
      if (candidate === path || candidate.endsWith("/" + path)) return path;
    }
    return null;
  }

  function mediaIsPlaying(media) {
    if (!media || media.paused !== false || media.ended === true || media.muted === true || media.seeking === true) return false;
    if (Number.isFinite(media.volume) && media.volume <= 0) return false;
    if (Number.isFinite(media.readyState) && media.readyState < 2) return false;
    return Number.isFinite(Number(media.currentTime));
  }

  function mediaTransport(media) {
    const track = media?.dataset?.musicMotionPath || media?.currentSrc || media?.src || media?.getAttribute?.("src") || media?.dataset?.stadiumMusic || media?.dataset?.guildMusic || null;
    return {
      track,
      path: matchTrackPath(track),
      currentTime: Number(media.currentTime),
      playbackRate: Number.isFinite(Number(media.playbackRate)) ? Number(media.playbackRate) : 1
    };
  }

  function registeredTransport() {
    for (const media of registeredMedia.keys()) if (mediaIsPlaying(media)) return mediaTransport(media);
    return null;
  }

  function discoveredTransport() {
    const nodes = document.querySelectorAll?.("audio[data-stadium-music], audio[data-guild-music], #stadiumMusic, #guildMusic") || [];
    for (const media of nodes) if (mediaIsPlaying(media)) return mediaTransport(media);
    return null;
  }

  function sharedAudioTransport() {
    const audio = root.MimiAudio;
    if (!audio || audio.enabled !== true) return null;
    let state;
    try { state = audio.musicState; }
    catch (_) { return null; }
    if (!state || state.failed === true || !Number.isFinite(Number(state.position))) return null;
    if (state.kind === "procedural") {
      const bpm = Number(state.bpm);
      if (state.clockPlaying !== true || !(bpm > 0)) return null;
      const path = "procedural:" + String(state.mood || "unknown");
      return {
        track: path,
        path,
        currentTime: Number(state.position),
        playbackRate: 1,
        bpm,
        procedural: true
      };
    }
    if (state.clockPlaying === false || !(Number(state.playing) > 0)) return null;
    if (!state.track) return null;
    return {
      track: state.track,
      path: matchTrackPath(state.track),
      currentTime: Number(state.position),
      playbackRate: 1
    };
  }

  function transport() {
    return registeredTransport() || discoveredTransport() || sharedAudioTransport();
  }

  function upperBound(values, target) {
    let low = 0, high = values.length;
    while (low < high) {
      const middle = (low + high) >>> 1;
      if (values[middle] <= target) low = middle + 1;
      else high = middle;
    }
    return low;
  }

  function actualSnapshot(activeTransport) {
    const track = tracks.get(activeTransport.path);
    const wall = now();
    const time = Math.max(0, Number(activeTransport.currentTime));
    const onsetIndex = upperBound(track.onsetSeconds, time) - 1;
    const elapsedWall = observer.wall === null ? 0 : Math.max(0, (wall - observer.wall) / 1000);
    const elapsedTrack = observer.time === null ? 0 : time - observer.time;
    const expected = elapsedWall * Math.max(0, activeTransport.playbackRate || 1);
    const discontinuity = observer.baseline || observer.path !== activeTransport.path || elapsedWall > 0.25 || elapsedTrack < -0.05 || Math.abs(elapsedTrack - expected) > 0.18;

    if (discontinuity) {
      pulseAt = -Infinity;
      pulseStrength = 0;
    } else if (onsetIndex > observer.onsetIndex) {
      // A frame may cross several transients. Publish the latest one once and
      // never replay the intervening backlog.
      sequence += 1;
      pulseAt = wall;
      pulseStrength = Number(track.onsetConfidence?.[onsetIndex] || track.confidence || 0);
    }

    observer = { path: activeTransport.path, time, wall, onsetIndex, baseline: false };
    const age = wall - pulseAt;
    const pulseValue = age >= 0 && age < PULSE_DECAY_MS ? pulseStrength * (1 - age / PULSE_DECAY_MS) : 0;
    return immutableSnapshot({
      ready: true,
      state: metadataState,
      origin: "actual-music",
      audioSynced: true,
      reason: null,
      track: activeTransport.track,
      path: activeTransport.path,
      currentTime: time,
      position: time,
      latestOnsetIndex: onsetIndex,
      latestOnsetStrength: onsetIndex >= 0 ? Number(track.onsetConfidence?.[onsetIndex] || track.confidence || 0) : 0,
      latestOnsetPosition: onsetIndex >= 0 ? track.onsetSeconds[onsetIndex] : null,
      pulseValue: Number(pulseValue.toFixed(4)),
      sequence
    });
  }

  function proceduralSnapshot(activeTransport) {
    const wall = now();
    const time = Math.max(0, Number(activeTransport.currentTime));
    const bpm = Number(activeTransport.bpm);
    const secondsPerPulse = 60 / bpm;
    const onsetIndex = Math.floor(time / secondsPerPulse);
    const elapsedWall = observer.wall === null ? 0 : Math.max(0, (wall - observer.wall) / 1000);
    const elapsedTrack = observer.time === null ? 0 : time - observer.time;
    const expected = elapsedWall * Math.max(0, activeTransport.playbackRate || 1);
    const discontinuity = observer.baseline || observer.path !== activeTransport.path || elapsedWall > 0.25 || elapsedTrack < -0.05 || Math.abs(elapsedTrack - expected) > 0.18;

    if (discontinuity) {
      pulseAt = -Infinity;
      pulseStrength = 0;
    } else if (onsetIndex > observer.onsetIndex) {
      sequence += 1;
      pulseAt = wall;
      pulseStrength = 1;
    }

    observer = { path: activeTransport.path, time, wall, onsetIndex, baseline: false };
    const age = wall - pulseAt;
    const pulseValue = age >= 0 && age < PULSE_DECAY_MS ? 1 - age / PULSE_DECAY_MS : 0;
    return immutableSnapshot({
      ready: metadataState !== "loading",
      state: metadataState,
      origin: "actual-music",
      audioSynced: true,
      reason: null,
      track: activeTransport.track,
      path: activeTransport.path,
      currentTime: time,
      position: time,
      latestOnsetIndex: onsetIndex,
      latestOnsetStrength: 1,
      latestOnsetPosition: Number((onsetIndex * secondsPerPulse).toFixed(6)),
      pulseValue: Number(pulseValue.toFixed(4)),
      sequence
    });
  }

  function activeSurfaceVisible() {
    const nativeDialog = document.querySelector?.("dialog[open]");
    const customDialog = [...(document.querySelectorAll?.("[role=\"dialog\"]") || [])].find(node => !node.closest?.("[hidden]") && node.getAttribute?.("aria-hidden") !== "true");
    if (document.hidden || !focused || nativeDialog || customDialog) return false;
    const views = document.querySelectorAll?.(".app-view") || [];
    if (!views.length) return true;
    const active = document.querySelector?.(".app-view.is-active");
    return Boolean(active && !active.hidden && active.getAttribute?.("aria-hidden") !== "true");
  }

  function observe() {
    if (!activeSurfaceVisible()) {
      current = semanticSnapshot("surface-suspended");
      return current;
    }
    const activeTransport = transport();
    if (!activeTransport) {
      current = semanticSnapshot(metadataState === "fallback" ? "metadata-unavailable" : "music-muted-or-blocked");
      return current;
    }
    if (activeTransport.procedural) {
      current = proceduralSnapshot(activeTransport);
      return current;
    }
    if (metadataState !== "ready") {
      current = semanticSnapshot(metadataState === "loading" ? "metadata-loading" : "metadata-unavailable", activeTransport);
      return current;
    }
    if (!activeTransport.path || !tracks.has(activeTransport.path)) {
      current = semanticSnapshot("track-unmapped", activeTransport);
      return current;
    }
    current = actualSnapshot(activeTransport);
    return current;
  }

  function schedule() {
    if (frameTimer || !listeners.size || !activeSurfaceVisible()) return;
    frameTimer = root.setTimeout(frame, FRAME_MS);
  }

  function frame() {
    frameTimer = 0;
    if (!listeners.size || !activeSurfaceVisible()) {
      observer = freshObserver();
      pulseAt = -Infinity;
      return;
    }
    const next = observe();
    for (const listener of [...listeners]) {
      try { listener(next); }
      catch (error) { root.console?.error?.(error); }
    }
    schedule();
  }

  function wake() {
    observer = freshObserver();
    pulseAt = -Infinity;
    if (!listeners.size) return;
    current = observe();
    for (const listener of [...listeners]) {
      try { listener(current); }
      catch (error) { root.console?.error?.(error); }
    }
    schedule();
  }

  function registerMedia(media) {
    if (!media || typeof media !== "object") return function unregisterInvalidMedia() {};
    registeredMedia.set(media, (registeredMedia.get(media) || 0) + 1);
    wake();
    let active = true;
    return function unregister() {
      if (!active) return;
      active = false;
      const count = registeredMedia.get(media) || 0;
      if (count <= 1) registeredMedia.delete(media);
      else registeredMedia.set(media, count - 1);
      wake();
    };
  }

  function snapshot() {
    if (!listeners.size && activeSurfaceVisible()) observe();
    if (current.origin !== "actual-music") return current;
    const age = now() - pulseAt;
    if (!(age >= 0 && age < PULSE_DECAY_MS)) {
      if (current.pulseValue === 0) return current;
      current = immutableSnapshot({ ...current, pulseValue: 0 });
      return current;
    }
    const value = Number((pulseStrength * (1 - age / PULSE_DECAY_MS)).toFixed(4));
    if (value === current.pulseValue) return current;
    current = immutableSnapshot({ ...current, pulseValue: value });
    return current;
  }

  function subscribe(listener) {
    if (typeof listener !== "function") return function unsubscribeInvalidListener() {};
    listeners.add(listener);
    if (listeners.size === 1) wake();
    else listener(snapshot());
    let active = true;
    return function unsubscribe() {
      if (!active) return;
      active = false;
      listeners.delete(listener);
      if (!listeners.size && frameTimer) { root.clearTimeout(frameTimer); frameTimer = 0; observer = freshObserver(); pulseAt = -Infinity; }
    };
  }

  const api = Object.freeze({
    registerMedia,
    snapshot,
    subscribe,
    get ready() { return metadataState !== "loading"; },
    get state() { return metadataState; }
  });
  root.MimiMusicMotion = api;

  root.addEventListener?.("blur", () => { focused = false; if (frameTimer) { root.clearTimeout(frameTimer); frameTimer = 0; } observer = freshObserver(); pulseAt = -Infinity; current = semanticSnapshot("surface-suspended"); });
  root.addEventListener?.("focus", () => { focused = true; wake(); });
  document.addEventListener?.("visibilitychange", () => { if (document.hidden) { if (frameTimer) { root.clearTimeout(frameTimer); frameTimer = 0; } observer = freshObserver(); pulseAt = -Infinity; current = semanticSnapshot("surface-suspended"); } else wake(); });
  document.addEventListener?.("click", () => { root.setTimeout(wake, 0); }, true);

  (async function loadMetadata() {
    const controller = typeof AbortController === "function" ? new AbortController() : null;
    let timeout = 0;
    try {
      const url = new URL("assets/audio/music-pulse-v1.json", document.baseURI).href;
      const boundedFailure = new Promise((_, reject) => {
        timeout = root.setTimeout(() => { controller?.abort(); reject(new Error("music pulse metadata timeout")); }, FETCH_TIMEOUT_MS);
      });
      const response = await Promise.race([root.fetch(url, { cache: "force-cache", signal: controller?.signal }), boundedFailure]);
      if (!response.ok) throw new Error("music pulse metadata HTTP " + response.status);
      const payload = await response.json();
      if (payload?.schemaVersion !== 1 || !Array.isArray(payload.tracks) || !payload.tracks.length) throw new Error("invalid music pulse metadata");
      for (const track of payload.tracks) {
        if (typeof track.path !== "string" || !Array.isArray(track.onsetSeconds) || !track.onsetSeconds.every(Number.isFinite)) throw new Error("invalid music pulse track");
        tracks.set(track.path, Object.freeze(track));
      }
      metadataState = "ready";
    } catch (_) {
      tracks.clear();
      metadataState = "fallback";
    } finally {
      root.clearTimeout(timeout);
      current = semanticSnapshot(metadataState === "ready" ? "music-muted-or-blocked" : "metadata-unavailable");
      wake();
    }
  }());
}(typeof globalThis !== "undefined" ? globalThis : this));
