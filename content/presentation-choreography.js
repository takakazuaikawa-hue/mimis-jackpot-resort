(function (root, factory) {
  "use strict";

  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.MimiPresentationChoreography = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const LAYER_ORDER = Object.freeze([
    "backdrop",
    "veil",
    "emblem",
    "actorL",
    "actorR",
    "foreground",
    "particles",
  ]);

  const COPY_SAFE = Object.freeze({
    anchor: "bottom-left",
    left: 3.5,
    bottom: 5,
    width: 58,
    height: 39,
    maxHeadlineLines: 1,
    maxBodyLines: 2,
    preserveDuringMotion: true,
  });

  const REDUCED_MAP = Object.freeze({
    "notice-glint": "notice-static",
    "notice-message": "notice-static",
    "notice-focus": "notice-focus-static",
    "notice-static": "notice-static",
    "notice-focus-static": "notice-focus-static",
    premonition: "premonition-static",
    "key-1": "keys-static",
    "key-2": "keys-static",
    "chance-seal": "keys-static",
    push: "push-static",
    "premonition-static": "premonition-static",
    "keys-static": "keys-static",
    "push-static": "push-static",
    "heat-red": "heat-step-static",
    "heat-gold": "heat-step-static",
    "heat-rainbow": "heat-rainbow-static",
    "heat-step-static": "heat-step-static",
    "heat-rainbow-static": "heat-rainbow-static",
    "gate-lock-1": "gate-locks-static",
    "gate-lock-2": "gate-locks-static",
    "gate-lock-3": "gate-locks-static",
    "gate-open": "gate-open-static",
    "gate-locks-static": "gate-locks-static",
    "gate-open-static": "gate-open-static",
    "boss-silhouette": "boss-reveal-static",
    "boss-reveal": "boss-reveal-static",
    "boss-hp": "boss-hp-static",
    "boss-order": "boss-order-static",
    "boss-reveal-static": "boss-reveal-static",
    "boss-hp-static": "boss-hp-static",
    "boss-order-static": "boss-order-static",
    "miss-freeze": "revive-heart-static",
    "revive-heart": "revive-heart-static",
    "reel-return": "reel-return-static",
    "revive-heart-static": "revive-heart-static",
    "reel-return-static": "reel-return-static",
    "bonus-entry": "bonus-entry-static",
    "card-fan": "bonus-entry-static",
    "free-games": "free-games-static",
    "bonus-start": "bonus-start-static",
    "bonus-entry-static": "bonus-entry-static",
    "free-games-static": "free-games-static",
    "bonus-start-static": "bonus-start-static",
    "jackpot-silence": "series-converge-static",
    "series-poker": "series-converge-static",
    "series-race": "series-converge-static",
    "series-guild": "series-converge-static",
    "series-stadium": "series-converge-static",
    "series-arena": "series-converge-static",
    "series-converge": "series-converge-static",
    "future-mimi": "future-mimi-static",
    "jackpot-award": "jackpot-award-static",
    "series-converge-static": "series-converge-static",
    "future-mimi-static": "future-mimi-static",
    "jackpot-award-static": "jackpot-award-static",
  });

  const FAMILY_CONTRACTS = Object.freeze({
    notice: Object.freeze({
      cssKeyframe: "prVeilSweep",
      geometry: "offset-rectangle",
      linePattern: "single-leading-rule",
      direction: "left-to-right",
      actorL: "mimi-guide",
      actorR: "none",
    }),
    chance: Object.freeze({
      cssKeyframe: "prKeyTurn",
      geometry: "key-and-round-seal",
      linePattern: "double-notch",
      direction: "clockwise-inward",
      actorL: "mimi-guide",
      actorR: "key-pair",
    }),
    hot: Object.freeze({
      cssKeyframe: "prHeatRainbow",
      geometry: "circle-to-diamond-to-star",
      linePattern: "one-two-three-rings",
      direction: "radial-outward",
      actorL: "mimi-guide",
      actorR: "none",
    }),
    goldenGate: Object.freeze({
      cssKeyframe: "prGateLock",
      geometry: "three-vertical-locks",
      linePattern: "one-two-three-bars",
      direction: "bottom-to-top",
      actorL: "mimi-guide",
      actorR: "gate",
    }),
    boss: Object.freeze({
      cssKeyframe: "prBossImpact",
      geometry: "winged-silhouette-and-chevron",
      linePattern: "inward-impact-lines",
      direction: "right-to-left",
      actorL: "mimi-guard",
      actorR: "shahar-silhouette",
    }),
    revive: Object.freeze({
      cssKeyframe: "prRevivePrayer",
      geometry: "prayer-arc-and-return-line",
      linePattern: "broken-to-continuous",
      direction: "down-to-up",
      actorL: "mimi-prayer",
      actorR: "return-light",
    }),
    bonus: Object.freeze({
      cssKeyframe: "prBonusCardFan",
      geometry: "four-card-fan-and-burst",
      linePattern: "fan-ribs",
      direction: "center-to-corners",
      actorL: "mimi-celebrate",
      actorR: "card-fan",
    }),
    jackpot: Object.freeze({
      cssKeyframe: "prJackpotConverge",
      geometry: "five-world-pentagon-and-blank-card",
      linePattern: "five-converging-routes",
      direction: "five-edges-to-center",
      actorL: "five-worlds",
      actorR: "future-mimi",
    }),
  });

  const VISUAL_CONFIGS = Object.freeze([
    ["notice-glint", "notice", 550, "glint", 8],
    ["notice-message", "notice", 650, "message", 5],
    ["notice-focus", "notice", 600, "focus", 4],
    ["notice-static", "notice", 700, "message", 0, true],
    ["notice-focus-static", "notice", 700, "focus", 0, true],
    ["premonition", "chance", 600, "premonition", 12],
    ["key-1", "chance", 650, "key-one", 10],
    ["key-2", "chance", 650, "key-two", 16],
    ["chance-seal", "chance", 750, "seal", 18],
    ["push", "chance", 900, "push", 20],
    ["premonition-static", "chance", 650, "premonition", 0, true],
    ["keys-static", "chance", 750, "key-two", 0, true],
    ["push-static", "chance", 850, "push", 0, true],
    ["heat-red", "hot", 800, "red", 14],
    ["heat-gold", "hot", 850, "gold", 22],
    ["heat-rainbow", "hot", 1050, "rainbow", 36],
    ["heat-step-static", "hot", 700, "gold", 0, true],
    ["heat-rainbow-static", "hot", 900, "rainbow", 0, true],
    ["gate-lock-1", "goldenGate", 700, "lock-one", 10],
    ["gate-lock-2", "goldenGate", 700, "lock-two", 14],
    ["gate-lock-3", "goldenGate", 750, "lock-three", 20],
    ["gate-open", "goldenGate", 1350, "open", 32],
    ["gate-locks-static", "goldenGate", 850, "lock-three", 0, true],
    ["gate-open-static", "goldenGate", 900, "open", 0, true],
    ["boss-silhouette", "boss", 700, "silhouette", 8],
    ["boss-reveal", "boss", 800, "reveal", 18],
    ["boss-hp", "boss", 650, "hp", 10],
    ["boss-order", "boss", 1050, "impact", 30],
    ["boss-reveal-static", "boss", 800, "reveal", 0, true],
    ["boss-hp-static", "boss", 700, "hp", 0, true],
    ["boss-order-static", "boss", 850, "impact", 0, true],
    ["miss-freeze", "revive", 650, "freeze", 6],
    ["revive-heart", "revive", 850, "prayer", 18],
    ["reel-return", "revive", 1100, "return", 28],
    ["revive-heart-static", "revive", 750, "prayer", 0, true],
    ["reel-return-static", "revive", 950, "return", 0, true],
    ["bonus-entry", "bonus", 700, "entry", 18],
    ["card-fan", "bonus", 700, "cards", 22],
    ["free-games", "bonus", 800, "festival", 38],
    ["bonus-start", "bonus", 1000, "start", 48],
    ["bonus-entry-static", "bonus", 700, "entry", 0, true],
    ["free-games-static", "bonus", 800, "festival", 0, true],
    ["bonus-start-static", "bonus", 700, "start", 0, true],
    ["jackpot-silence", "jackpot", 500, "silence", 0],
    ["series-poker", "jackpot", 450, "world-one", 8],
    ["series-race", "jackpot", 450, "world-two", 12],
    ["series-guild", "jackpot", 450, "world-three", 16],
    ["series-stadium", "jackpot", 450, "world-four", 20],
    ["series-arena", "jackpot", 450, "world-five", 24],
    ["series-converge", "jackpot", 750, "converge", 48],
    ["future-mimi", "jackpot", 700, "future", 30],
    ["jackpot-award", "jackpot", 800, "award", 60],
    ["series-converge-static", "jackpot", 800, "converge", 0, true],
    ["future-mimi-static", "jackpot", 650, "future", 0, true],
    ["jackpot-award-static", "jackpot", 950, "award", 0, true],
  ]);

  function deepFreeze(value, seen) {
    if (!value || (typeof value !== "object" && typeof value !== "function")) return value;
    const visited = seen || new WeakSet();
    if (visited.has(value)) return value;
    visited.add(value);
    Reflect.ownKeys(value).forEach(function (key) { deepFreeze(value[key], visited); });
    return Object.freeze(value);
  }

  function layer(kind, variant, visible, primary) {
    return { kind: kind, variant: variant, visible: Boolean(visible), primary: Boolean(primary) };
  }

  function track(target, keyframes, delay, duration, easing) {
    return {
      target: target,
      keyframes: keyframes,
      delay: Math.round(delay),
      duration: Math.max(1, Math.round(duration)),
      easing: easing,
      fill: "both",
      iterations: 1,
    };
  }

  function addFamilyTracks(result, family, variant, enterDuration, holdAt, holdDuration) {
    if (family === "chance") {
      result.enter.push(track("emblem", [
        { opacity: 0, transform: "rotate(-38deg)" },
        { opacity: 1, transform: "rotate(8deg)" },
        { opacity: 1, transform: "rotate(0deg)" },
      ], 0, enterDuration, "cubic-bezier(0.16, 0.9, 0.18, 1.08)"));
    } else if (family === "hot") {
      result.hold.push(track("emblem .pr-emblem-core", [
        { filter: "brightness(0.86) hue-rotate(0deg)", rotate: "0deg" },
        { filter: variant === "rainbow" ? "brightness(1.5) hue-rotate(150deg)" : "brightness(1.35) hue-rotate(18deg)", rotate: "18deg" },
        { filter: variant === "rainbow" ? "brightness(1.25) hue-rotate(280deg)" : "brightness(1.1) hue-rotate(0deg)", rotate: variant === "gold" ? "45deg" : "0deg" },
      ], holdAt, holdDuration, "ease-in-out"));
    } else if (family === "goldenGate") {
      [1, 2, 3].forEach(function (lockNumber, index) {
        result.enter.push(track("emblem .pr-emblem-mark-" + lockNumber, [
          { opacity: 0, translate: "0 -42%", rotate: "-18deg" },
          { opacity: 1, translate: "0 8%", rotate: "8deg", offset: 0.72 },
          { opacity: 1, translate: "0 0", rotate: "0deg" },
        ], Math.round(index * enterDuration * 0.08), Math.max(1, Math.round(enterDuration * (1 - index * 0.08))), "cubic-bezier(0.16, 0.88, 0.18, 1)"));
      });
    } else if (family === "boss") {
      [1, 2, 3].forEach(function (lineNumber) {
        result.hold.push(track("foreground .pr-shock-line-" + ["one", "two", "three"][lineNumber - 1], [
          { opacity: 0, scale: "0.15 1", translate: "20% 0" },
          { opacity: variant === "impact" ? 1 : 0.38, scale: "1.2 1", translate: "-4% 0", offset: 0.52 },
          { opacity: variant === "impact" ? 0.42 : 0.18, scale: "1 1", translate: "0 0" },
        ], holdAt, holdDuration, "ease-out"));
      });
    } else if (family === "revive") {
      result.hold.push(track("actorL", [
        { translate: "0 5%", filter: "brightness(0.72)" },
        { translate: "0 -4%", filter: "brightness(1.35)", offset: 0.62 },
        { translate: "0 0", filter: "brightness(1.08)" },
      ], holdAt, holdDuration, "ease-in-out"));
      result.hold.push(track("foreground .pr-primary-overlay", [
        { opacity: 0.12, clipPath: "inset(82% 0 0)" },
        { opacity: variant === "return" ? 0.86 : 0.46, clipPath: "inset(0 0 0)" },
      ], holdAt, holdDuration, "ease-out"));
    } else if (family === "bonus") {
      [1, 2, 3, 4, 5].forEach(function (cardNumber, index) {
        result.enter.push(track("emblem .pr-emblem-mark-" + cardNumber, [
          { opacity: 0, translate: "0 28%", rotate: "0deg" },
          { opacity: 1, translate: "0 0", rotate: (index - 2) * 6 + "deg" },
        ], Math.round(index * enterDuration * 0.035), Math.max(1, Math.round(enterDuration * (1 - index * 0.035))), "cubic-bezier(0.18, 0.88, 0.2, 1)"));
      });
    } else if (family === "jackpot") {
      result.enter.push(track("emblem", [
        { opacity: variant === "silence" ? 0.08 : 0.28, transform: "translate(-50%, -50%) rotate(-28deg)" },
        { opacity: 1, transform: "translate(-50%, -50%) rotate(5deg)", offset: 0.72 },
        { opacity: 1, transform: "translate(-50%, -50%) rotate(0deg)" },
      ], 0, enterDuration, "cubic-bezier(0.18, 0.84, 0.2, 1)"));
      if (variant === "future" || variant === "award") {
        result.hold.push(track("foreground .pr-future-blank-card", [
          { opacity: 0, translate: "0 22%", rotate: "-16deg" },
          { opacity: 1, translate: "0 -4%", rotate: "4deg", offset: 0.66 },
          { opacity: 1, translate: "0 0", rotate: "-6deg" },
        ], holdAt, holdDuration, "ease-in-out"));
      }
    }
    return result;
  }

  function tracksFor(family, variant, duration, reduced) {
    const enterDuration = Math.max(1, Math.round(duration * (reduced ? 0.08 : 0.24)));
    const exitDuration = Math.max(1, Math.round(duration * (reduced ? 0.08 : 0.16)));
    const holdDuration = Math.max(1, duration - enterDuration - exitDuration);
    const holdAt = enterDuration;
    const exitAt = enterDuration + holdDuration;
    const contract = FAMILY_CONTRACTS[family];
    const stillFrames = [{ opacity: 1, transform: "translate3d(0,0,0)" }, { opacity: 1, transform: "translate3d(0,0,0)" }];
    if (reduced) {
      const reducedTracks = {
        enter: [track("foreground", stillFrames, 0, enterDuration, "linear")],
        hold: [track("emblem .pr-emblem-core", stillFrames, holdAt, holdDuration, "linear")],
        exit: [track("veil", stillFrames, exitAt, exitDuration, "linear")],
      };
      reducedTracks.hold.forEach(function (item) { item.fill = "forwards"; });
      reducedTracks.exit.forEach(function (item) { item.fill = "forwards"; });
      return reducedTracks;
    }
    const result = {
      enter: [
        track("veil", [
          { opacity: 0, transform: "translate3d(-18%,0,0) skewX(-8deg)" },
          { opacity: 0.72, transform: "translate3d(0,0,0) skewX(0deg)" },
        ], 0, enterDuration, "cubic-bezier(0.16, 0.84, 0.22, 1)"),
        track("emblem .pr-emblem-core", [
          { opacity: 0, transform: "translate3d(0,7%,0) rotate(-18deg) scale(0.62)" },
          { opacity: 1, transform: "translate3d(0,0,0) rotate(0deg) scale(1)" },
        ], 0, enterDuration, "cubic-bezier(0.16, 0.9, 0.18, 1.08)"),
        track("actorR", [
          { opacity: 0, transform: "translate3d(18%,0,0)" },
          { opacity: 1, transform: "translate3d(0,0,0)" },
        ], 0, enterDuration, "cubic-bezier(0.2, 0.82, 0.2, 1)"),
      ],
      hold: [
        track("emblem .pr-emblem-core", [
          { opacity: 1, transform: "translate3d(0,0,0) rotate(0deg) scale(1)" },
          { opacity: 1, transform: "translate3d(0,-1.5%,0) rotate(8deg) scale(1.06)" },
          { opacity: 1, transform: "translate3d(0,0,0) rotate(0deg) scale(1)" },
        ], holdAt, holdDuration, "ease-in-out"),
        track("foreground", [
          { opacity: 0.24, transform: "translate3d(-2%,0,0)" },
          { opacity: 0.86, transform: "translate3d(2%,0,0)" },
          { opacity: 0.32, transform: "translate3d(0,0,0)" },
        ], holdAt, holdDuration, "ease-in-out"),
        track("particles", [
          { opacity: 0.2, transform: "translate3d(0,5%,0)" },
          { opacity: 1, transform: "translate3d(0,-10%,0)" },
        ], holdAt, holdDuration, "linear"),
      ],
      exit: [
        track("veil", [
          { opacity: 0.72, transform: "translate3d(0,0,0)" },
          { opacity: 0, transform: "translate3d(18%,0,0)" },
        ], exitAt, exitDuration, "cubic-bezier(0.4, 0, 0.8, 0.2)"),
        track("emblem .pr-emblem-core", [
          { opacity: 1, transform: "translate3d(0,0,0) scale(1)" },
          { opacity: 0.3, transform: "translate3d(0,-4%,0) scale(1.08)" },
        ], exitAt, exitDuration, "ease-in"),
      ],
    };
    addFamilyTracks(result, family, variant, enterDuration, holdAt, holdDuration);
    result.hold.forEach(function (item) { item.fill = "forwards"; });
    result.exit.forEach(function (item) { item.fill = "forwards"; });
    return result;
  }

  function makeDescriptor(config) {
    const id = config[0];
    const family = config[1];
    const duration = config[2];
    const variant = config[3];
    const particleCount = config[4];
    const reducedMotion = Boolean(config[5]);
    const contract = FAMILY_CONTRACTS[family];
    return {
      id: id,
      family: family,
      variant: variant,
      duration: duration,
      easing: reducedMotion ? "linear" : "cubic-bezier(0.16, 0.84, 0.22, 1)",
      reducedMotion: reducedMotion,
      cssKeyframe: contract.cssKeyframe,
      layers: {
        backdrop: layer("procedural-gradient", family, true, false),
        veil: layer("directional-veil", variant, !reducedMotion, false),
        emblem: layer("geometric-emblem", variant, true, false),
        actorL: layer("procedural-actor", contract.actorL, contract.actorL !== "none", false),
        actorR: layer("procedural-actor", contract.actorR, contract.actorR !== "none", false),
        foreground: layer("primary-overlay", variant, true, true),
        particles: Object.assign(layer("bounded-particles", family, particleCount > 0 && !reducedMotion, false), {
          count: reducedMotion ? 0 : Math.min(60, Math.max(0, particleCount)),
        }),
      },
      tracks: tracksFor(family, variant, duration, reducedMotion),
      shapeCue: {
        name: family + "." + variant,
        geometry: contract.geometry,
        linePattern: contract.linePattern,
        direction: contract.direction,
        colorIndependent: true,
      },
      reduced: {
        visual: REDUCED_MAP[id],
        strategy: reducedMotion ? "already-static" : "shape-preserving-static-swap",
        particleCount: 0,
        preserveNarrative: true,
      },
      copySafe: Object.assign({}, COPY_SAFE),
      artStatus: "PROCEDURAL MOTION / ART PENDING",
    };
  }

  const descriptors = Object.create(null);
  VISUAL_CONFIGS.forEach(function (config) {
    descriptors[config[0]] = makeDescriptor(config);
  });

  const api = {
    LAYER_ORDER: LAYER_ORDER,
    MAX_PARTICLES: 60,
    COPY_SAFE: COPY_SAFE,
    visuals: Object.freeze(VISUAL_CONFIGS.map(function (config) { return config[0]; })),
    descriptors: descriptors,
    get: function (visual) { return descriptors[visual] || null; },
    reducedVisualFor: function (visual) { return REDUCED_MAP[visual] || null; },
  };

  return deepFreeze(api);
});
