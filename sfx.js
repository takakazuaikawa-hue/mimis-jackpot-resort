/*
 * Hybrid Web Audio engine for Mimi's Jackpot Resort.
 *
 * Short physical sounds are decoded only after the first user gesture.  A
 * restrained procedural layer supplies the reel motor and offline fallback;
 * licensed recorded samples remain the primary impact layer. User-supplied
 * normal-play music streams separately through the same master limiter.
 */
(function (root) {
  "use strict";

  const AudioContextClass = root.AudioContext || root.webkitAudioContext;
  const SAMPLE_BASE = "assets/audio/kenney-casino/";
  function numberedFiles(idPrefix, filenamePrefix, count) {
    return Object.fromEntries(Array.from({ length: count }, (_, index) => {
      const number = index + 1;
      return [`${idPrefix}${number}`, `${filenamePrefix}-${number}.ogg`];
    }));
  }

  function numberedIds(idPrefix, count) {
    return Object.freeze(Array.from({ length: count }, (_, index) => `${idPrefix}${index + 1}`));
  }

  // Keep the complete official Kenney Casino Audio 1.1 recording bank. The
  // small families below rotate deterministically, giving repeated cabinet
  // actions physical variation without consuming or revealing gameplay RNG.
  const SAMPLE_FILES = Object.freeze({
    ...numberedFiles("cardFan", "card-fan", 2),
    ...numberedFiles("cardPlace", "card-place", 4),
    ...numberedFiles("cardShove", "card-shove", 4),
    cardShuffle: "card-shuffle.ogg",
    ...numberedFiles("cardSlide", "card-slide", 8),
    ...numberedFiles("packOpen", "cards-pack-open", 2),
    ...numberedFiles("packTakeOut", "cards-pack-take-out", 2),
    ...numberedFiles("chipLay", "chip-lay", 3),
    ...numberedFiles("chipsCollide", "chips-collide", 4),
    ...numberedFiles("chipsHandle", "chips-handle", 6),
    ...numberedFiles("chipsStack", "chips-stack", 6),
    ...numberedFiles("diceGrab", "dice-grab", 2),
    ...numberedFiles("diceShake", "dice-shake", 3),
    ...numberedFiles("diceThrow", "dice-throw", 3),
    ...numberedFiles("dieThrow", "die-throw", 4)
  });

  // Coin recordings: Little Robot Sound Factory, CC-BY 3.0. Rise03:
  // WobbleBoxx Workshop, CC0. Edits/credits: assets/audio/coin-payout-v1/ATTRIBUTION.md
  const PAYOUT_FILES = Object.freeze({
    payoutSmall: "assets/audio/coin-payout-v1/payout-small.wav",
    payoutMedium: "assets/audio/coin-payout-v1/payout-medium.wav",
    payoutLarge: "assets/audio/coin-payout-v1/payout-large.wav",
    payoutShower: "assets/audio/coin-payout-v1/payout-shower.wav",
    winRise03: "assets/audio/coin-payout-v1/win-rise03.wav"
  });

  const SAMPLE_FAMILIES = Object.freeze({
    cardFan: numberedIds("cardFan", 2),
    cardPlace: numberedIds("cardPlace", 4),
    cardShove: numberedIds("cardShove", 4),
    cardSlide: numberedIds("cardSlide", 8),
    cardSlideFirst: Object.freeze(["cardSlide1", "cardSlide2", "cardSlide3"]),
    cardSlideSecond: Object.freeze(["cardSlide4", "cardSlide5", "cardSlide6"]),
    cardSlideFinal: Object.freeze(["cardSlide7", "cardSlide8"]),
    packOpen: numberedIds("packOpen", 2),
    packTakeOut: numberedIds("packTakeOut", 2),
    chipLay: numberedIds("chipLay", 3),
    chipsCollide: numberedIds("chipsCollide", 4),
    chipsHandle: numberedIds("chipsHandle", 6),
    chipsStack: numberedIds("chipsStack", 6),
    diceGrab: numberedIds("diceGrab", 2),
    diceShake: numberedIds("diceShake", 3),
    diceThrow: numberedIds("diceThrow", 3),
    dieThrow: numberedIds("dieThrow", 4)
  });

  // Chromium-decoded RMS measurements showed up to 10.31 dB of level spread
  // inside one recorded family. Keep the natural transient differences, but
  // trim each rotating take by at most +/-1.5 dB around its family median so
  // repeated cabinet actions do not jump in loudness from take to take.
  const SAMPLE_GAIN_TRIMS = Object.freeze({
    "cardFan1": 0.840, "cardFan2": 1.190,
    "cardPlace1": 0.840, "cardPlace2": 1.155, "cardPlace3": 1.190, "cardPlace4": 0.865,
    "cardShove1": 1.168, "cardShove2": 1.190, "cardShove3": 0.856, "cardShove4": 0.840,
    "cardSlide1": 0.909, "cardSlide2": 0.840, "cardSlide3": 0.840, "cardSlide4": 0.909,
    "cardSlide5": 1.190, "cardSlide6": 1.100, "cardSlide7": 1.190, "cardSlide8": 1.118,
    "packOpen1": 0.971, "packOpen2": 1.029,
    "packTakeOut1": 0.840, "packTakeOut2": 1.190,
    "chipLay1": 0.890, "chipLay2": 1.190, "chipLay3": 1.000,
    "chipsCollide1": 0.933, "chipsCollide2": 0.993, "chipsCollide3": 1.007, "chipsCollide4": 1.190,
    "chipsHandle1": 1.190, "chipsHandle2": 1.190, "chipsHandle3": 0.887,
    "chipsHandle4": 1.127, "chipsHandle5": 0.840, "chipsHandle6": 0.840,
    "chipsStack1": 0.970, "chipsStack2": 1.031, "chipsStack3": 1.078,
    "chipsStack4": 0.840, "chipsStack5": 1.039, "chipsStack6": 0.871,
    "diceGrab1": 0.840, "diceGrab2": 1.190,
    "diceShake1": 1.190, "diceShake2": 0.971, "diceShake3": 1.000,
    "diceThrow1": 1.000, "diceThrow2": 1.106, "diceThrow3": 0.840,
    "dieThrow1": 1.121, "dieThrow2": 0.840, "dieThrow3": 1.190, "dieThrow4": 0.892
  });

  /* [sample id, gain, playback rate, delay seconds]. */
  const CUE_LAYERS = Object.freeze({
    press: [["chipLay", 0.28, 1.16, 0]],
    spin: [["diceShake", 0.17, 0.92, 0], ["cardShove", 0.1, 0.76, 0.025]],
    stop1: [["cardSlideFirst", 0.34, 0.88, 0, -0.42], ["chipLay", 0.18, 0.92, 0.01, -0.34]],
    stop2: [["cardSlideSecond", 0.36, 1.0, 0, 0], ["chipLay", 0.19, 1.03, 0.01, 0]],
    stop3: [["cardSlideFinal", 0.39, 1.12, 0, 0.42], ["chipLay", 0.22, 1.14, 0.01, 0.34]],
    commandOpen: [["packOpen", 0.22, 1.24, 0], ["cardPlace", 0.12, 1.18, 0.06]],
    commandAdvance: [["cardSlide", 0.24, 1.08, 0], ["chipLay", 0.14, 1.26, 0.045]],
    commandReady: [["cardFan", 0.27, 1.12, 0], ["chipsStack", 0.2, 1.18, 0.085]],
    notice: [["packTakeOut", 0.27, 1.08, 0]],
    tenpai: [["cardFan", 0.3, 0.96, 0], ["cardSlide", 0.13, 1.16, 0.075]],
    hot: [["cardFan", 0.34, 0.86, 0], ["dieThrow", 0.2, 0.78, 0.08]],
    win: [["chipsStack", 0.42, 1.03, 0], ["chipsHandle", 0.35, 1.13, 0.075]],
    premium: [["chipsCollide", 0.45, 0.92, 0], ["cardFan", 0.28, 1.08, 0.08]],
    revive: [["chipsHandle", 0.34, 0.9, 0], ["packOpen", 0.2, 1.18, 0.09]],
    gate: [["packOpen", 0.35, 0.75, 0], ["chipsCollide", 0.27, 0.86, 0.11]],
    bonus: [["cardFan", 0.38, 1.05, 0], ["chipsStack", 0.36, 1.08, 0.1]],
    boss: [["diceThrow", 0.4, 0.7, 0], ["diceShake", 0.16, 0.72, 0.04]],
    bossAttack: [["diceGrab", 0.38, 0.76, 0], ["cardShove", 0.2, 0.7, 0.05]],
    bossHit: [["chipsCollide", 0.42, 0.82, 0], ["cardPlace", 0.24, 1.22, 0.055]],
    bossDefeat: [["dieThrow", 0.32, 0.62, 0], ["packTakeOut", 0.3, 0.82, 0.12]],
    treasureReward: [["packTakeOut", 0.4, 1.08, 0], ["chipsCollide", 0.4, 1.0, 0.09], ["chipsStack", 0.32, 1.16, 0.18]],
    orderClear: [["chipsCollide", 0.34, 1.0, 0.05], ["chipsStack", 0.36, 1.1, 0.14], ["cardFan", 0.23, 1.18, 0.27]],
    orderMiss: [["cardShove", 0.25, 0.63, 0.04], ["diceThrow", 0.17, 0.66, 0.16]],
    orderProgress: [["chipLay", 0.2, 1.22, 0.02], ["chipsStack", 0.2, 1.14, 0.095]],
    orderWarning: [["cardShove", 0.2, 0.72, 0.02], ["diceThrow", 0.16, 0.68, 0.12]],
    crownComplete: [["chipsCollide", 0.46, 0.92, 0.04], ["chipsStack", 0.4, 1.08, 0.13], ["chipsHandle", 0.38, 1.22, 0.24], ["cardFan", 0.34, 1.2, 0.36]],
    jackpot: [["chipsCollide", 0.5, 0.88, 0], ["chipsStack", 0.42, 1.04, 0.09], ["chipsHandle", 0.4, 1.2, 0.19], ["cardFan", 0.32, 1.16, 0.28]],
    miss: [["cardShove", 0.22, 0.68, 0]]
  });

  // Each internal Chapter 1 role owns a restrained sonic fingerprint. These
  // accents layer under the physical reel sounds; they never replace STOP
  // feedback or reveal/change the settled result.
  const ROLE_CUE_PROFILES = Object.freeze({
    none: Object.freeze({ base: 146.83, sample: "cardShove", rates: [0.74, 0.68, 0.61], resolve: [146.83, 123.47] }),
    replay: Object.freeze({ base: 220.00, sample: "cardSlide", rates: [0.86, 1.02, 1.18], resolve: [293.66, 392.00, 293.66] }),
    cherry: Object.freeze({ base: 261.63, sample: "chipLay", rates: [1.06, 1.16, 1.28], resolve: [523.25, 659.25] }),
    bell: Object.freeze({ base: 329.63, sample: "chipsStack", rates: [0.94, 1.08, 1.22], resolve: [659.25, 783.99] }),
    grape: Object.freeze({ base: 196.00, sample: "cardFan", rates: [0.82, 0.96, 1.12], resolve: [392.00, 493.88, 587.33] }),
    watermelon: Object.freeze({ base: 174.61, sample: "cardPlace", rates: [0.78, 0.94, 1.16], resolve: [349.23, 440.00, 659.25] }),
    bar: Object.freeze({ base: 164.81, sample: "chipsCollide", rates: [0.72, 0.88, 1.08], resolve: [196.00, 392.00, 783.99] }),
    seven_blue: Object.freeze({ base: 246.94, sample: "packOpen", rates: [0.88, 1.08, 1.32], resolve: [369.99, 493.88, 739.99, 987.77] }),
    seven_red: Object.freeze({ base: 277.18, sample: "diceThrow", rates: [0.92, 1.16, 1.46], resolve: [415.30, 554.37, 830.61, 1108.73] })
  });

  // A Royal Order replay replaces the generic command-open flourish with one
  // concise signature. Each signature owns one recorded family and a small
  // tonal contour, so the five replay intentions are recognisable without
  // adding another layer to the long-session mix or touching gameplay RNG.
  const ROYAL_ORDER_OPEN_PROFILES = Object.freeze({
    team: Object.freeze({ sample: "cardFan", gain: 0.18, rate: 1.02, notes: Object.freeze([523.25, 659.25, 783.99]), step: 0.052 }),
    read: Object.freeze({ sample: "cardSlide", gain: 0.17, rate: 0.84, notes: Object.freeze([493.88, 369.99, 293.66]), step: 0.058 }),
    strong: Object.freeze({ sample: "chipsCollide", gain: 0.19, rate: 0.92, notes: Object.freeze([196.00, 392.00, 783.99]), step: 0.048 }),
    speed: Object.freeze({ sample: "diceThrow", gain: 0.17, rate: 1.26, notes: Object.freeze([392.00, 587.33, 783.99]), step: 0.034 }),
    first: Object.freeze({ sample: "packOpen", gain: 0.20, rate: 1.12, notes: Object.freeze([523.25, 659.25, 783.99, 1046.50]), step: 0.046 })
  });

  let context = null;
  let master = null;
  let sampleBus = null;
  let synthBus = null;
  let music = null;
  let musicVolume = 0.075;
  let renderedMusic = null;
  const renderedBuffers = new Map(), renderedLoads = new Map(), renderedPositions = new Map();
  const RENDERED_SCORES = Object.freeze({
    arenaExplore: { file: 'assets/arena/audio/explore-chamber-v1.ogg', gain: 2 },
    arenaTrial: { file: 'assets/arena/audio/trial-chamber-v1.ogg', gain: 2 },
    arenaBoss: { file: 'assets/arena/audio/boss-chamber-v1.ogg', gain: 2 },
    arenaTokimeki: { file: 'assets/arena/audio/tokimeki-chamber-v1.ogg', gain: 2 }
  });
  function musicLevel() { return musicVolume * (renderedMusic?.level || 1) / (reduced ? 3 : 1); }
  let enabled = true;
  let reduced = false;
  let mood = "silent";
  let padNodes = [];
  let musicTimer = null;
  // User-supplied Suno v5.5 instrumentals (permission confirmed 2026-09-06).
  // These are the two long normal-play takes, not boss music despite the title.
  // Stream through the existing master/limiter; do not decode minutes of PCM
  // into the short-effect bank or apply its pitch variation to music.
  const RESORT_TRACKS = Object.freeze([
    Object.freeze({ file: "Velvet Jackpot.mp3", gain: 0.18 }),
    Object.freeze({ file: "Jackpot.mp3", gain: 0.184 })
  ]);
  let recordedMusic = null;
  let recordedDecks = null;
  let recordedIndex = 0;
  let recordedEpoch = 0;
  let recordedFailed = false;

  // Original sixteen-bar phrases, using the existing four musical voices.
  // A/B sections, moving harmony and deliberate rests replace the held drone;
  // this is an interim arrangement, not a claim of mastered production music.
  const MUSIC_SCORES = Object.freeze({
    arenaExplore: { bpm: 80, chords: [[48,55,62,64],[45,55,60,64],[41,53,60,67],[43,55,59,62]] },
    arenaTrial: { bpm: 92, chords: [[50,57,64,65],[46,57,62,65],[43,55,62,67],[45,57,61,64]] },
    arenaTokimeki: { bpm: 72, chords: [[48,55,59,64],[45,55,60,64],[41,53,57,64],[43,55,59,62]] },
    resort: { bpm: 88, chords: [[48,59,64,67],[45,55,60,64],[41,57,60,67],[43,53,59,62],[48,59,64,67],[45,55,60,64],[50,57,60,65],[43,53,59,62]] },
    chance: { bpm: 100, chords: [[50,57,60,65],[46,57,62,65],[43,58,62,65],[45,55,61,64],[50,57,60,65],[53,57,60,64],[43,58,62,65],[45,55,61,64]] },
    bonus: { bpm: 112, chords: [[41,57,60,64],[43,58,62,65],[45,55,60,64],[48,58,62,67],[41,57,60,64],[50,57,60,65],[43,58,62,65],[48,58,62,67]] },
    boss: { bpm: 104, chords: [[40,55,59,62],[40,55,60,64],[36,55,59,64],[35,54,57,63],[40,55,59,62],[43,55,59,64],[45,57,60,64],[35,54,57,63]] }
  });
  const MUSIC_MELODY = Object.freeze([
    [2,null,3,2], [1,2,null,3], [3,null,2,1], [2,1,null,null],
    [2,3,null,2], [1,null,2,3], [3,2,1,null], [2,null,null,null],
    [3,2,3,null], [2,null,1,2], [3,2,null,3], [2,1,null,null],
    [3,null,2,1], [2,3,null,2], [1,2,3,null], [2,null,null,null]
  ]);
  let sampleState = "idle";
  let sampleLoadPromise = null;
  const sampleBuffers = new Map();
  const samplePlayCounts = new Map();
  const sampleFamilyCounts = new Map();
  let reelVoices = [];
  const effectVoices = new Set();
  const payoutVoices = new Map();
  function trackEffect(source) {
    effectVoices.add(source);
    source.onended = () => { effectVoices.delete(source); payoutVoices.delete(source); source.disconnect(); };
    return source;
  }
  function stopPayoutEffects() {
    payoutVoices.forEach((gain, source) => {
      if (context) {
        const now = context.currentTime;
        gain.gain.cancelScheduledValues(now);
        gain.gain.setTargetAtTime(0.0001, now, 0.008);
        try { source.stop(now + 0.035); } catch (_) { /* already ended */ }
      }
    });
    payoutVoices.clear();
  }
  // Opt-in cancellation for a cabinet scene boundary; does not stop its music
  // or reel motors. Other cabinets keep their existing cue lifetimes.
  function stopEffects() {
    effectVoices.forEach(source => { try { source.stop(); } catch (_) {} source.disconnect(); });
    effectVoices.clear();
    payoutVoices.clear();
  }

  // A one-hour session can trigger the same short physical recording hundreds
  // of times. Cycle a tiny deterministic playback-rate offset per sample so
  // repeated impacts do not sound copy-pasted. The pattern is intentionally
  // subtle and never depends on, predicts, or changes game RNG.
  const SAMPLE_RATE_VARIATION = Object.freeze([0.992, 1.008, 0.997, 1.013, 0.986, 1.004]);

  function variedSampleRate(id, playbackRate) {
    // Keep the selected musical interval and the natural coin tails intact.
    if (Object.hasOwn(PAYOUT_FILES, id)) return playbackRate;
    const count = samplePlayCounts.get(id) || 0;
    samplePlayCounts.set(id, count + 1);
    return playbackRate * SAMPLE_RATE_VARIATION[count % SAMPLE_RATE_VARIATION.length];
  }

  function resolveSampleId(id) {
    const family = SAMPLE_FAMILIES[id];
    if (!family) return id;
    const available = family.filter(sampleId => sampleBuffers.has(sampleId));
    if (!available.length) return id;
    const count = sampleFamilyCounts.get(id) || 0;
    sampleFamilyCounts.set(id, count + 1);
    return available[count % available.length];
  }

  function ensure() {
    if (!AudioContextClass) return null;
    if (!context) {
      context = new AudioContextClass();
      master = context.createGain();
      sampleBus = context.createGain();
      synthBus = context.createGain();
      const limiter = context.createDynamicsCompressor();
      limiter.threshold.value = -12;
      limiter.knee.value = 8;
      limiter.ratio.value = 8;
      limiter.attack.value = 0.004;
      limiter.release.value = 0.18;
      master.gain.value = enabled ? 0.72 : 0.0001;
      sampleBus.gain.value = 0.86;
      synthBus.gain.value = 0.72;
      sampleBus.connect(master);
      synthBus.connect(master);
      master.connect(limiter);
      limiter.connect(context.destination);
    }
    return context;
  }

  function decodeAudio(ctx, bytes) {
    return new Promise((resolve, reject) => {
      let settled = false;
      const done = value => {
        if (settled) return;
        settled = true;
        resolve(value);
      };
      const fail = error => {
        if (settled) return;
        settled = true;
        reject(error);
      };
      try {
        const result = ctx.decodeAudioData(bytes.slice(0), done, fail);
        if (result && typeof result.then === "function") result.then(done, fail);
      } catch (error) {
        fail(error);
      }
    });
  }

  function loadSamples() {
    const ctx = ensure();
    if (!ctx || typeof root.fetch !== "function") {
      sampleState = "unavailable";
      return Promise.resolve(sampleState);
    }
    if (sampleLoadPromise) return sampleLoadPromise;
    sampleState = "loading";
    sampleLoadPromise = Promise.allSettled(Object.entries({ ...SAMPLE_FILES, ...PAYOUT_FILES }).map(async ([id, file]) => {
      const response = await root.fetch(Object.hasOwn(PAYOUT_FILES, id) ? file : `${SAMPLE_BASE}${file}`, { credentials: "same-origin" });
      if (!response.ok) throw new Error(`Audio ${response.status}: ${file}`);
      const buffer = await decodeAudio(ctx, await response.arrayBuffer());
      sampleBuffers.set(id, buffer);
    })).then(results => {
      const failed = results.filter(result => result.status === "rejected").length;
      sampleState = sampleBuffers.size === 0 ? "failed" : failed ? "partial" : "ready";
      return sampleState;
    }).catch(() => {
      sampleState = "failed";
      return sampleState;
    });
    return sampleLoadPromise;
  }

  function unlock() {
    const ctx = ensure();
    if (ctx?.state === "suspended") void ctx.resume();
    if (ctx) void loadSamples();
    return ctx;
  }

  function stopReelLoop(fade = 0.055) {
    const ctx = context;
    reelVoices.forEach(voice => {
      if (!ctx) return;
      const now = ctx.currentTime;
      voice.gain.gain.cancelScheduledValues(now);
      voice.gain.gain.setValueAtTime(Math.max(0.0001, voice.gain.gain.value), now);
      voice.gain.gain.exponentialRampToValueAtTime(0.0001, now + fade);
      try { voice.source.stop(now + fade + 0.025); } catch (_) { /* already stopped */ }
    });
    reelVoices = [];
  }

  function setEnabled(value) {
    enabled = Boolean(value);
    const ctx = ensure();
    if (ctx && master) master.gain.setTargetAtTime(enabled ? 0.72 : 0.0001, ctx.currentTime, 0.025);
    if (!enabled) stopReelLoop();
    if (!enabled) stopPayoutEffects();
    if (!enabled) stopMusic();
    else if (!music && !recordedMusic && mood !== "silent") setMood(mood);
    return enabled;
  }

  // Short score accompaniment only; each cabinet may opt in without changing
  // the default mix used by existing cabinets or recorded resort tracks.
  function setMusicVolume(value) {
    if (!Number.isFinite(value)) return musicVolume;
    musicVolume = Math.max(0, Math.min(1, value));
    if (context && music) music.gain.setTargetAtTime(musicLevel(), context.currentTime, 0.06);
    return musicVolume;
  }

  function setReduced(value) {
    reduced = Boolean(value);
    if (reduced) stopReelLoop();
    if (reduced) stopPayoutEffects();
    if (context && music) music.gain.setTargetAtTime(musicLevel(), context.currentTime, 0.06);
    if (context && recordedMusic) recordedMusic.gain.gain.setTargetAtTime(reduced ? 0.36 : 1, context.currentTime, 0.06);
    return reduced;
  }

  function playSample(id, gainValue = 0.3, playbackRate = 1, delay = 0, pan = 0) {
    const ctx = ensure();
    const sampleId = resolveSampleId(id);
    const buffer = sampleBuffers.get(sampleId);
    if (!ctx || !buffer || !enabled) return false;
    const source = ctx.createBufferSource();
    const gain = ctx.createGain();
    source.buffer = buffer;
    source.playbackRate.value = Math.max(0.35, Math.min(2.4, variedSampleRate(sampleId, playbackRate)));
    const sampleTrim = SAMPLE_GAIN_TRIMS[sampleId] || 1;
    gain.gain.value = Math.max(0.0001, gainValue * sampleTrim * (reduced ? 0.68 : 1));
    source.connect(gain);
    if (typeof ctx.createStereoPanner === "function") {
      const panner = ctx.createStereoPanner();
      panner.pan.value = Math.max(-1, Math.min(1, Number(pan) || 0));
      gain.connect(panner);
      panner.connect(sampleBus);
    } else {
      gain.connect(sampleBus);
    }
    if (Object.hasOwn(PAYOUT_FILES, sampleId)) payoutVoices.set(source, gain);
    trackEffect(source).start(ctx.currentTime + Math.max(0, delay));
    return true;
  }

  function playSampleCue(id) {
    const layers = CUE_LAYERS[id] || CUE_LAYERS.press;
    const selected = reduced ? layers.slice(0, 1) : layers;
    return selected.reduce((played, layer) => playSample(...layer) || played, false);
  }

  function tone(frequency, duration = 0.08, type = "sine", gainValue = 0.04, delay = 0, destination = null) {
    const ctx = ensure();
    if (!ctx || !enabled) return;
    const start = ctx.currentTime + Math.max(0, delay);
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(Math.max(20, frequency), start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, gainValue * (reduced ? 0.65 : 1)), start + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain);
    gain.connect(destination || synthBus || master);
    trackEffect(oscillator).start(start);
    oscillator.stop(start + duration + 0.02);
  }

  function noise(duration = 0.08, gainValue = 0.025, delay = 0) {
    const ctx = ensure();
    if (!ctx || !enabled || reduced) return;
    const size = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, size, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < size; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / size);
    const source = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    filter.type = "bandpass";
    filter.frequency.value = 1600;
    filter.Q.value = 0.8;
    gain.gain.value = gainValue;
    source.buffer = buffer;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(synthBus || master);
    trackEffect(source).start(ctx.currentTime + delay);
  }

  function chord(notes, duration, gainValue = 0.025, delay = 0, type = "triangle") {
    notes.forEach((note, index) => tone(note, duration, type, gainValue / Math.sqrt(notes.length), delay + index * 0.012));
  }

  function startReelLoop() {
    const ctx = ensure();
    stopReelLoop(0.02);
    if (!ctx || !enabled || reduced) return 0;
    const size = Math.max(1, Math.floor(ctx.sampleRate * 0.34));
    const buffer = ctx.createBuffer(1, size, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < size; i += 1) {
      const mechanicalPulse = Math.sin((i / ctx.sampleRate) * Math.PI * 2 * 34) * 0.22;
      data[i] = (Math.random() * 2 - 1) * 0.54 + mechanicalPulse;
    }
    [
      { frequency: 230, rate: 0.91, gain: 0.015, pan: -0.46 },
      { frequency: 360, rate: 1.01, gain: 0.013, pan: 0 },
      { frequency: 540, rate: 1.12, gain: 0.011, pan: 0.46 }
    ].forEach((spec, col) => {
      const source = ctx.createBufferSource();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();
      source.buffer = buffer;
      source.loop = true;
      source.playbackRate.value = spec.rate;
      filter.type = "bandpass";
      filter.frequency.value = spec.frequency;
      filter.Q.value = 1.8;
      gain.gain.value = spec.gain;
      source.connect(filter);
      filter.connect(gain);
      if (typeof ctx.createStereoPanner === "function") {
        const panner = ctx.createStereoPanner();
        panner.pan.value = spec.pan;
        gain.connect(panner);
        panner.connect(synthBus || master);
      } else {
        gain.connect(synthBus || master);
      }
      source.start();
      reelVoices.push({ source, gain, col });
    });
    return reelVoices.length;
  }

  function stopOneReel(col = null) {
    const ctx = context;
    const requestedColumn = Number.isFinite(Number(col))
      ? Math.max(0, Math.min(2, Math.trunc(Number(col))))
      : null;
    let voiceIndex = requestedColumn === null
      ? reelVoices.length - 1
      : reelVoices.findIndex(voice => voice.col === requestedColumn);
    // Preserve the no-argument compatibility path and fail soft if a repeated
    // STOP asks for a motor voice that has already been removed.
    if (voiceIndex < 0) voiceIndex = reelVoices.length - 1;
    const [voice] = voiceIndex >= 0 ? reelVoices.splice(voiceIndex, 1) : [];
    if (!ctx || !voice) return reelVoices.length;
    const now = ctx.currentTime;
    voice.gain.gain.cancelScheduledValues(now);
    voice.gain.gain.setValueAtTime(Math.max(0.0001, voice.gain.gain.value), now);
    voice.gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.07);
    try { voice.source.stop(now + 0.095); } catch (_) { /* already stopped */ }
    return reelVoices.length;
  }

  function slowReelLoop(heat = 0.5) {
    const ctx = context;
    if (!ctx) return;
    const amount = Math.max(0, Math.min(1, Number(heat) || 0));
    reelVoices.forEach((voice, index) => {
      const target = [0.76, 0.84, 0.92][index] * (1 - amount * 0.12);
      voice.source.playbackRate.setTargetAtTime(target, ctx.currentTime, 0.055);
    });
  }

  function fallbackCue(id) {
    const cues = {
      press: () => { tone(180, 0.045, "square", 0.018); noise(0.025, 0.009); },
      spin: () => { tone(110, 0.12, "sawtooth", 0.025); tone(220, 0.09, "triangle", 0.018, 0.05); },
      stop1: () => { tone(165, 0.055, "square", 0.026); noise(0.035, 0.014); },
      stop2: () => { tone(220, 0.055, "square", 0.026); noise(0.035, 0.014); },
      stop3: () => { tone(294, 0.065, "square", 0.03); noise(0.045, 0.016); },
      commandOpen: () => { tone(392, 0.08, "sine", 0.022); tone(523, 0.12, "triangle", 0.02, 0.055); },
      commandAdvance: () => { tone(523, 0.07, "triangle", 0.023); tone(659, 0.1, "sine", 0.018, 0.045); },
      commandReady: () => [523, 659, 784].forEach((note, index) => tone(note, 0.12, "triangle", 0.025, index * 0.055)),
      notice: () => { tone(523, 0.09, "sine", 0.035); tone(659, 0.12, "sine", 0.025, 0.07); },
      tenpai: () => [392, 523, 659].forEach((note, index) => tone(note, 0.12, "triangle", 0.038, index * 0.065)),
      hot: () => { chord([220, 330, 440], 0.28, 0.06, 0, "sawtooth"); chord([330, 495, 660], 0.34, 0.055, 0.18); },
      win: () => [523, 659, 784, 1047].forEach((note, index) => tone(note, 0.18, "triangle", 0.04, index * 0.07)),
      premium: () => { chord([392, 494, 587, 784], 0.55, 0.075); noise(0.32, 0.02, 0.08); },
      revive: () => [330, 392, 494, 659, 784].forEach((note, index) => tone(note, 0.22, "sine", 0.043, index * 0.08)),
      gate: () => { chord([196, 294, 392], 0.7, 0.07); chord([262, 392, 523, 659], 0.9, 0.075, 0.28); },
      bonus: () => [262, 330, 392, 523, 659, 784].forEach((note, index) => tone(note, 0.28, index < 3 ? "triangle" : "sine", 0.05, index * 0.09)),
      boss: () => { chord([82, 123, 165], 0.6, 0.075, 0, "sawtooth"); noise(0.24, 0.035); },
      bossAttack: () => { tone(110, 0.2, "sawtooth", 0.045); noise(0.16, 0.025, 0.04); },
      bossHit: () => { noise(0.12, 0.04); tone(294, 0.16, "square", 0.032, 0.025); },
      bossDefeat: () => { tone(147, 0.35, "sawtooth", 0.04); tone(98, 0.5, "sine", 0.035, 0.12); },
      treasureReward: () => [392, 523, 659, 784].forEach((note, index) => tone(note, 0.26, "triangle", 0.045, index * 0.09)),
      orderClear: () => [392, 523, 659, 784].forEach((note, index) => tone(note, 0.22, "triangle", 0.036, 0.05 + index * 0.075)),
      orderMiss: () => { tone(220, 0.18, "triangle", 0.026, 0.04); tone(146.83, 0.32, "sine", 0.022, 0.15); },
      orderProgress: () => [523, 659].forEach((note, index) => tone(note, 0.14, "triangle", 0.026, 0.03 + index * 0.065)),
      orderWarning: () => { tone(293.66, 0.14, "triangle", 0.025, 0.03); tone(196, 0.26, "sine", 0.021, 0.13); },
      crownComplete: () => {
        [392, 523, 659, 784, 1047].forEach((note, index) => tone(note, 0.34, "triangle", 0.045, 0.04 + index * 0.08));
        chord([523, 659, 784, 1047], 0.85, 0.075, 0.5, "sine");
      },
      jackpot: () => {
        [262, 330, 392, 523, 659, 784, 1047, 1319].forEach((note, index) => tone(note, 0.42, "triangle", 0.06, index * 0.075));
        chord([523, 659, 784, 1047], 1.1, 0.11, 0.72, "sine");
      },
      miss: () => { tone(196, 0.14, "triangle", 0.024); tone(147, 0.22, "sine", 0.02, 0.09); }
    };
    (cues[id] || cues.press)();
  }

  function semanticAccent(id) {
    if (reduced) return;
    const accents = {
      notice: () => tone(659, 0.08, "sine", 0.012, 0.04),
      tenpai: () => tone(784, 0.12, "triangle", 0.014, 0.06),
      hot: () => chord([220, 330, 440], 0.2, 0.022, 0.05, "sawtooth"),
      premium: () => chord([392, 494, 587], 0.32, 0.025, 0.08),
      gate: () => chord([196, 294, 392], 0.42, 0.025, 0.06),
      bonus: () => chord([262, 330, 392, 523], 0.28, 0.024, 0.08),
      boss: () => tone(82, 0.42, "sawtooth", 0.025, 0.02),
      commandOpen: () => tone(659, 0.09, "sine", 0.012, 0.05),
      commandAdvance: () => tone(784, 0.09, "triangle", 0.012, 0.05),
      commandReady: () => chord([523, 659, 784], 0.22, 0.02, 0.06),
      orderClear: () => chord([392, 523, 659, 784], 0.42, 0.028, 0.12),
      orderMiss: () => tone(123.47, 0.32, "sine", 0.018, 0.08),
      orderProgress: () => chord([523, 659], 0.22, 0.019, 0.06),
      orderWarning: () => tone(146.83, 0.28, "sine", 0.017, 0.08),
      crownComplete: () => chord([523, 659, 784, 1047], 0.9, 0.05, 0.28, "sine"),
      jackpot: () => chord([523, 659, 784, 1047], 0.85, 0.045, 0.22, "sine")
    };
    accents[id]?.();
  }

  function playNamedCue(id) {
    unlock();
    if (!playSampleCue(id)) fallbackCue(id);
    else semanticAccent(id);
  }

  function royalOrderOpen(orderId = "") {
    const id = Object.hasOwn(ROYAL_ORDER_OPEN_PROFILES, orderId) ? orderId : "";
    if (!id) {
      playNamedCue("commandOpen");
      return Object.freeze({ id, sample: "commandOpen", recorded: false });
    }
    const profile = ROYAL_ORDER_OPEN_PROFILES[id];
    unlock();
    const recorded = playSample(profile.sample, profile.gain, profile.rate, 0);
    const notes = reduced ? profile.notes.slice(0, 2) : profile.notes;
    notes.forEach((frequency, index) => {
      tone(frequency, 0.095 + index * 0.012, index % 2 ? "sine" : "triangle", 0.013, 0.025 + index * profile.step);
    });
    return Object.freeze({ id, sample: profile.sample, recorded });
  }

  function roleCueProfile(flag) {
    return ROLE_CUE_PROFILES[flag] || ROLE_CUE_PROFILES.none;
  }

  function roleAnticipation(flag, heat = 1) {
    const profile = roleCueProfile(flag);
    const amount = Math.max(1, Math.min(5, Number(heat) || 1));
    unlock();
    tone(profile.base, 0.11 + amount * 0.012, "sine", 0.006 + amount * 0.0015, 0.035);
    if (amount >= 4) playSample(profile.sample, 0.045, profile.rates[0], 0.045);
    return Object.freeze({ flag: ROLE_CUE_PROFILES[flag] ? flag : "none", heat: amount });
  }

  function roleStop(flag, ordinal = 1, col = ordinal - 1) {
    const profile = roleCueProfile(flag);
    const stop = Math.max(1, Math.min(3, Math.trunc(Number(ordinal) || 1)));
    const column = Math.max(0, Math.min(2, Math.trunc(Number(col) || 0)));
    const rate = profile.rates[stop - 1];
    const recordedAccent = stop === 3;
    unlock();
    // STOP 1/2 already carry two physical recorded impacts each. Keep the
    // three-step role phrase in the restrained tonal layer, then place its
    // recorded timbre only on the river/STOP 3 decision. This preserves the
    // authored stop1 -> stop2 -> stop3 identity without stacking nine recorded
    // transients into every ordinary spin.
    if (recordedAccent) playSample(profile.sample, 0.079, rate, 0.018, [-0.42, 0, 0.42][column]);
    tone(profile.base * (1 + stop * 0.25), 0.085 + stop * 0.015, stop === 3 ? "triangle" : "sine", 0.008 + stop * 0.002, 0.028);
    return Object.freeze({ flag: ROLE_CUE_PROFILES[flag] ? flag : "none", stop, column, rate, recordedAccent });
  }

  function roleResult(flag, outcome = "miss", landed = false) {
    const profile = roleCueProfile(flag);
    const resolvedFlag = ROLE_CUE_PROFILES[flag] ? flag : "none";
    const kind = outcome === "replay" ? "push" : landed ? "hit" : "miss";
    unlock();
    if (kind === "hit") {
      playSample(profile.sample, 0.15, profile.rates[2], 0);
      profile.resolve.forEach((frequency, index) => tone(frequency, 0.18 + index * 0.025, index % 2 ? "sine" : "triangle", 0.018, index * 0.055));
    } else if (kind === "push") {
      [profile.resolve[0], profile.resolve.at(-1)].forEach((frequency, index) => tone(frequency, 0.15, "sine", 0.014, index * 0.07));
    } else {
      tone(profile.base * 0.75, 0.19, "sine", 0.012, 0.02);
    }
    return Object.freeze({ flag: resolvedFlag, kind });
  }

  function roleBoss(flag, outcome = "hit") {
    const profile = roleCueProfile(flag);
    const resolvedFlag = ROLE_CUE_PROFILES[flag] ? flag : "none";
    unlock();
    playSample(profile.sample, 0.13, profile.rates[2], 0.025);
    chord(profile.resolve.slice(0, 4), outcome === "critical" || outcome === "victory" ? 0.48 : 0.3, 0.04, 0.04, outcome === "counterCritical" ? "sawtooth" : "triangle");
    if (["critical", "victory", "counterCritical"].includes(outcome)) noise(0.14, 0.018, 0.04);
    return Object.freeze({ flag: resolvedFlag, outcome: String(outcome || "hit") });
  }

  function spinStart() {
    unlock();
    stopPayoutEffects();
    startReelLoop();
    if (!playSampleCue("spin")) fallbackCue("spin");
    return reelVoices.length;
  }

  function reelStop(col = 0, slip = 0) {
    unlock();
    const column = Math.max(0, Math.min(2, Math.trunc(Number(col) || 0)));
    const remaining = stopOneReel(column);
    const ordinal = Math.max(1, Math.min(3, 3 - remaining));
    const id = `stop${ordinal}`;
    const layers = CUE_LAYERS[id];
    const slipAmount = Math.max(0, Math.min(4, Math.trunc(Number(slip) || 0)));
    const rateScale = 0.96 + column * 0.025 - slipAmount * 0.035;
    const cabinetPan = [-0.42, 0, 0.42][column];
    const selected = reduced ? layers.slice(0, 1) : layers;
    const played = selected.reduce((didPlay, layer) => {
      const [sampleId, gainValue, playbackRate, delay] = layer;
      return playSample(sampleId, (gainValue + slipAmount * 0.018) * 0.7, playbackRate * rateScale, delay, cabinetPan) || didPlay;
    }, false);
    if (slipAmount >= 3) noise(0.045 + slipAmount * 0.012, (0.01 + slipAmount * 0.003) * 0.7);
    if (!played) fallbackCue(id);
    return remaining;
  }

  function tenpai(heat = 0.5) {
    const amount = Math.max(0, Math.min(1, Number(heat) || 0));
    unlock();
    slowReelLoop(amount);
    const id = amount >= 0.72 ? "hot" : "tenpai";
    if (!playSampleCue(id)) fallbackCue(id);
    else semanticAccent(id);
    return amount;
  }

  function win(payout = 0, bet = 1) {
    unlock();
    const safeBet = Number.isFinite(Number(bet)) ? Math.max(1, Number(bet) || 1) : 1;
    const ratio = Number.isFinite(Number(payout)) ? Math.max(0, Number(payout) || 0) / safeBet : 0;
    const tier = ratio >= 50 ? 3 : ratio >= 15 ? 2 : ratio >= 4 ? 1 : 0;
    const receipt = Object.freeze({ ratio, tier });
    if (ratio <= 0 || !enabled) return receipt;
    stopPayoutEffects();
    // Preserve the recorded clinks and natural settling tail at their original
    // pitch. Larger wins get a real pour, not a loop of one identical coin.
    const coin = reduced ? "payoutSmall" : ["payoutSmall", "payoutMedium", "payoutLarge", "payoutShower"][tier];
    if (playSample(coin, [0.48, 0.52, 0.55, 0.56][tier], 1, tier && !reduced ? 0.28 : 0.09)) {
      if (!reduced && tier >= 1) {
        if (!playSample("winRise03", 0.62, 1, 0.035)) semanticAccent("premium");
      } else if (!reduced) {
        [659.25, 783.99].forEach((note, index) => tone(note, 0.22 + index * 0.06, "sine", 0.055, 0.09 + index * 0.11));
      }
      return receipt;
    }
    // Keep the existing reward intact if the new recording cannot be loaded.
    const layers = [
      ["chipsStack2", 0.42, 0.96 + tier * 0.04, 0.04],
      ["chipsStack6", 0.36 + tier * 0.03, 1.04 + tier * 0.055, 0.14],
      ["chipsCollide", 0.34, 0.92 + tier * 0.04, 0.17],
      ["cardFan", 0.27, 1.05 + tier * 0.05, 0.28]
    ].slice(0, reduced ? 1 : tier + 1);
    const played = layers.reduce((didPlay, layer) => playSample(...layer) || didPlay, false);
    if (!played) fallbackCue(tier >= 2 ? "premium" : "win");
    else if (tier >= 2) semanticAccent("premium");
    else if (ratio > 0) {
      // Leave space after RIVER, then resolve upward. Even a small payout must
      // have a recognisable reward, not just another quiet physical STOP.
      const notes = tier === 0 ? [659.25, 783.99] : [523.25, 659.25, 1046.5];
      notes.forEach((note, index) => tone(note, 0.22 + index * 0.06, "sine", 0.055, 0.09 + index * 0.11));
    }
    return receipt;
  }

  function jackpot() {
    playNamedCue("jackpot");
  }

  function revive() {
    playNamedCue("revive");
  }

  function cue(id) {
    if (id === "spin") return spinStart();
    const stopMatch = /^stop([123])$/.exec(id);
    if (stopMatch) return reelStop(Number(stopMatch[1]) - 1, 0);
    if (id === "tenpai") return tenpai(0.5);
    if (id === "hot") return tenpai(1);
    if (id === "jackpot") return jackpot();
    if (id === "revive") return revive();
    return playNamedCue(id);
  }

  function stopMusic() {
    if (renderedMusic) {
      renderedPositions.set(renderedMusic.key, (renderedMusic.offset + context.currentTime - renderedMusic.started) % renderedMusic.source.buffer.duration);
      renderedMusic = null;
    }
    recordedEpoch += 1;
    if (recordedMusic) {
      root.clearInterval(recordedMusic.timer);
      recordedDecks.forEach(deck => {
        if (deck.stopTimer !== null) root.clearTimeout(deck.stopTimer);
        deck.gain.gain.cancelScheduledValues(context.currentTime);
        deck.gain.gain.setValueAtTime(deck.gain.gain.value, context.currentTime);
        deck.gain.gain.linearRampToValueAtTime(0, context.currentTime + 0.12);
        deck.stopTimer = root.setTimeout(() => {
          deck.media.pause();
          deck.stopTimer = null;
        }, 150);
      });
      recordedMusic = null;
    }
    if (musicTimer !== null) root.clearInterval(musicTimer);
    musicTimer = null;
    padNodes.forEach(node => {
      try { node.stop((context?.currentTime || 0) + 0.12); } catch (_) { /* already stopped */ }
    });
    padNodes = [];
    if (music && context) {
      music.gain.setTargetAtTime(0.0001, context.currentTime, 0.025);
      music = null;
    }
  }

  function startRecordedMusic(ctx) {
    if (recordedFailed || typeof root.Audio !== "function" || typeof ctx.createMediaElementSource !== "function") return false;
    try {
      if (!recordedDecks) {
        const bus = ctx.createGain();
        bus.connect(master);
        recordedDecks = RESORT_TRACKS.map(track => {
          const media = new root.Audio(`assets/${encodeURIComponent(track.file)}`);
          media.preload = "none";
          const gain = ctx.createGain();
          gain.gain.value = 0;
          const source = ctx.createMediaElementSource(media);
          source.connect(gain);
          gain.connect(bus);
          return { media, gain, track, bus, stopTimer: null };
        });
      }
      const epoch = recordedEpoch;
      const session = { gain: recordedDecks[0].bus, timer: null, pending: false, crossfade: false };
      session.gain.gain.value = reduced ? 0.36 : 1;
      recordedMusic = session;
      const isCurrent = () => recordedEpoch === epoch && recordedMusic === session && enabled && mood === "resort";
      function fallback() {
        if (!isCurrent()) return;
        recordedFailed = true;
        stopMusic();
        setMood(mood);
      }
      function play(index, restart, previous = null) {
        session.pending = true;
        const deck = recordedDecks[index];
        if (deck.stopTimer !== null) root.clearTimeout(deck.stopTimer);
        deck.stopTimer = null;
        if (restart || deck.media.ended) deck.media.currentTime = 0;
        deck.media.onerror = fallback;
        const promise = deck.media.play();
        Promise.resolve(promise).then(() => {
          if (!isCurrent()) return;
          session.pending = false;
          recordedIndex = index;
          const now = ctx.currentTime;
          deck.gain.gain.cancelScheduledValues(now);
          deck.gain.gain.setValueAtTime(0, now);
          deck.gain.gain.linearRampToValueAtTime(deck.track.gain, now + 1.4);
          if (previous !== null) {
            const outgoing = recordedDecks[previous];
            outgoing.gain.gain.cancelScheduledValues(now);
            outgoing.gain.gain.setValueAtTime(outgoing.track.gain, now);
            outgoing.gain.gain.linearRampToValueAtTime(0, now + 1.4);
            session.crossfade = true;
          }
        }).catch(fallback);
      }
      // Re-entering the normal tables resumes its musical position instead of
      // repeating the introduction after every BONUS or SOUND toggle.
      play(recordedIndex, false);
      session.timer = root.setInterval(() => {
        if (!isCurrent() || session.pending) return;
        const deck = recordedDecks[recordedIndex];
        const outgoing = recordedDecks[1 - recordedIndex];
        if (session.crossfade && (outgoing.media.ended || outgoing.gain.gain.value <= 0.0001)) {
          outgoing.media.pause();
          session.crossfade = false;
        }
        if (!session.crossfade && Number.isFinite(deck.media.duration)
          && deck.media.duration > 5
          && deck.media.currentTime >= deck.media.duration - 1.4) {
          play(1 - recordedIndex, true, recordedIndex);
        }
      }, 100);
      return true;
    } catch (_) {
      recordedFailed = true;
      stopMusic();
      return false;
    }
  }

  function startRenderedScore(ctx, key) {
    const score = RENDERED_SCORES[key];
    if (!score) return false;
    const buffer = renderedBuffers.get(key);
    if (!buffer) {
      if (!renderedLoads.has(key)) {
        // Cache even if the player leaves this scene during loading. Completion
        // may replace its fallback only when this mood is still audible.
        const load = root.fetch(score.file).then(response => {
          if (!response.ok) throw new Error('Score unavailable');
          return response.arrayBuffer();
        }).then(bytes => ctx.decodeAudioData(bytes)).then(decoded => {
          renderedBuffers.set(key, decoded);
          if (enabled && mood === key) { stopMusic(); setMood(key); }
          return true;
        }).catch(() => false);
        renderedLoads.set(key, load);
      }
      return false;
    }
    const source = ctx.createBufferSource(), gain = ctx.createGain();
    source.buffer = buffer; source.loop = true;
    const offset = (renderedPositions.get(key) || 0) % buffer.duration;
    renderedMusic = { key, source, level: score.gain, offset, started: ctx.currentTime };
    music = gain;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.setTargetAtTime(musicLevel(), ctx.currentTime, 0.08);
    source.connect(gain); gain.connect(master);
    source.onended = () => { source.disconnect(); gain.disconnect(); };
    padNodes.push(source);
    source.start(0, offset);
    return true;
  }

  function setMood(next) {
    // Cabinets with their own music (Guild) reaffirm "silent" during render.
    // Only a real shared-music scene exit should cut off a payout here.
    if (next === "silent" && mood !== "silent") stopPayoutEffects();
    // If a view changed while SOUND was off, the mood key may already match
    // even though its bed was never created. Re-enabling must rebuild it.
    if (mood === next && (next === "silent" || music || recordedMusic)) return;
    mood = next;
    const ctx = ensure();
    if (!ctx) return;
    stopMusic();
    if (next === "silent" || !enabled) return;
    if (next === "resort" && startRecordedMusic(ctx)) return;
    if (startRenderedScore(ctx, next)) return;
    music = ctx.createGain();
    music.gain.value = reduced ? musicVolume / 3 : musicVolume;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = { resort: 1600, chance: 1800, bonus: 2200, boss: 1100, arenaBoss: 1100 }[next] || 1600;
    filter.Q.value = 0.65;
    music.connect(filter);
    filter.connect(synthBus || master);
    const score = MUSIC_SCORES[next] || MUSIC_SCORES[next === 'arenaBoss' ? 'boss' : 'resort'];
    const beat = 60 / score.bpm;
    const voices = Array.from({ length: 4 }, (_, index) => {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = index === 0 ? "triangle" : "sine";
      gain.gain.value = 0.0001;
      oscillator.connect(gain);
      gain.connect(music);
      oscillator.start();
      padNodes.push(oscillator);
      return { oscillator, gain };
    });
    const origin = ctx.currentTime + 0.04;
    let cursor = 0;
    function note(index, midi, when, length, level) {
      const voice = voices[index];
      voice.oscillator.frequency.setValueAtTime(440 * 2 ** ((midi - 69) / 12), when);
      voice.gain.gain.setValueAtTime(0.0001, when);
      voice.gain.gain.exponentialRampToValueAtTime(level, when + 0.025);
      voice.gain.gain.exponentialRampToValueAtTime(level * 0.7, when + length * 0.55);
      voice.gain.gain.exponentialRampToValueAtTime(0.0001, when + length);
    }
    function schedule() {
      if (ctx.state !== "running") return;
      // Background throttling must skip missed beats, never replay a backlog.
      cursor = Math.max(cursor, Math.ceil((ctx.currentTime - origin) / beat));
      while (origin + cursor * beat < ctx.currentTime + 0.18) {
        const when = origin + cursor * beat;
        const bar = Math.floor(cursor / 4) % 16;
        const step = cursor % 4;
        const harmony = score.chords[bar % score.chords.length];
        if (step === 0 || step === 2) {
          note(0, harmony[0] + (step === 2 ? 7 : 0), when, beat * 0.85, 0.25);
          note(1, harmony[1], when + 0.035, beat * 1.45, 0.12);
          note(2, harmony[2], when + 0.035, beat * 1.45, 0.10);
        }
        const melody = MUSIC_MELODY[bar][step];
        if (melody !== null) note(3, harmony[melody] + (bar >= 8 ? 12 : 0), when + 0.065, beat * 0.72, 0.20);
        cursor += 1;
      }
    }
    schedule();
    musicTimer = root.setInterval(schedule, 100);
  }

  root.MimiAudio = Object.freeze({
    unlock,
    loadSamples,
    setEnabled,
    setReduced,
    setMood,
    setMusicVolume,
    stopEffects,
    tone,
    cue,
    royalOrderOpen,
    roleAnticipation,
    roleStop,
    roleResult,
    roleBoss,
    spinStart,
    reelStop,
    tenpai,
    win,
    jackpot,
    revive,
    reelLoop: Object.freeze({ start: startReelLoop, stop: stopReelLoop, stopOne: stopOneReel }),
    get enabled() { return enabled; },
    get reduced() { return reduced; },
    get sampleState() { return sampleState; },
    get loadedSampleCount() { return sampleBuffers.size; },
    get reelVoiceCount() { return reelVoices.length; },
    get effectVoiceCount() { return effectVoices.size; },
    get musicState() {
      return Object.freeze({
        mood, kind: recordedMusic ? "recorded" : renderedMusic ? "rendered" : music ? "procedural" : "silent",
        track: recordedMusic ? RESORT_TRACKS[recordedIndex].file : renderedMusic ? RENDERED_SCORES[renderedMusic.key].file : null,
        playing: renderedMusic ? 1 : recordedDecks?.filter(deck => !deck.media.paused && !deck.media.ended).length || 0,
        position: renderedMusic ? (renderedMusic.offset + context.currentTime - renderedMusic.started) % renderedMusic.source.buffer.duration : recordedDecks?.[recordedIndex].media.currentTime || 0,
        failed: recordedFailed
      });
    }
  });
}(typeof globalThis !== "undefined" ? globalThis : this));
