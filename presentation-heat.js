/*
 * presentation-heat.js - phase-specific expectation snapshots.
 *
 * This module is deliberately pure. It reads already-committed game state and
 * the already-settled internal flag, then returns presentation semantics. It
 * must never roll RNG, mutate economy state, alter reel control, or award value.
 */
(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.MimiPresentationHeat = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function deepFreeze(value) {
    if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
    Object.values(value).forEach(deepFreeze);
    return Object.freeze(value);
  }

  function clampHeat(value) {
    return Math.max(1, Math.min(5, Math.floor(Number(value) || 1)));
  }

  const FLAG_HEAT = deepFreeze({
    none: 1,
    replay: 2,
    cherry: 2,
    bell: 2,
    grape: 3,
    watermelon: 3,
    bar: 4,
    seven_blue: 4,
    seven_red: 5,
  });

  const MODE_FLOOR = deepFreeze({ normal: 1, hot: 2, bonus: 3 });

  // Names are semantic authoring keys, not player-facing explanatory copy.
  // Each phase gets its own vocabulary so a boss TELL, training aura, and
  // BONUS backdrop cannot be flattened into one generic flashing meter.
  const PHASE_CUES = deepFreeze({
    normal: [
      null,
      { cue: "field-day", field: "day", tone: "quiet" },
      { cue: "field-dusk", field: "dusk", tone: "blue" },
      { cue: "field-night", field: "night", tone: "green" },
      { cue: "dracky-red", field: "night", tone: "red" },
      { cue: "dracky-gold", field: "night", tone: "gold" },
    ],
    trial: [
      null,
      { cue: "aura-none", field: "trial", tone: "quiet" },
      { cue: "aura-white", field: "trial", tone: "white" },
      { cue: "aura-blue", field: "trial", tone: "blue" },
      { cue: "aura-red", field: "trial", tone: "red" },
      { cue: "aura-rainbow", field: "trial", tone: "rainbow" },
    ],
    bonus: [
      null,
      { cue: "bonus-floor", field: "bonus", tone: "quiet" },
      { cue: "bonus-volcano", field: "bonus", tone: "blue" },
      { cue: "bonus-volcano", field: "bonus", tone: "green" },
      { cue: "bonus-castle", field: "bonus", tone: "red" },
      { cue: "bonus-royal", field: "bonus", tone: "gold" },
    ],
    battle: [
      null,
      { cue: "tell-quiet", field: "battle", tone: "quiet" },
      { cue: "tell-blue", field: "battle", tone: "blue" },
      { cue: "tell-red", field: "battle", tone: "red" },
      { cue: "tell-gold", field: "battle", tone: "gold" },
      { cue: "tell-royal", field: "battle", tone: "rainbow" },
    ],
  });

  function normalizePhase(context) {
    if (context.phase === "bonus") return "bonus";
    if (context.phase === "trial") return "trial";
    if (context.phase === "battle" || context.bossBattle) return "battle";
    return "normal";
  }

  function normalStateHeat(context) {
    let heat = 1;
    if (Number(context.orb) >= 5 || Number(context.enemiesToBonus) <= 0) heat = 4;
    else if (Number(context.nearMiss) > 0 || Number(context.treasure) >= 3 || Number(context.enemiesToBonus) <= 2) heat = 3;
    else if (Number(context.orb) >= 2 || Number(context.combo) >= 1) heat = 2;
    return Math.max(heat, clampHeat(Number(context.panyuStreak) + 1));
  }

  function trialStateHeat(context) {
    const score = Math.max(0, Number(context.trialScore) || 0);
    const success = Math.max(1, Number(context.trialSuccessScore) || 3);
    if (score >= success) return 5;
    if (score >= Math.max(1, success - 1)) return 4;
    if (score >= 1) return 3;
    return 2;
  }

  function bonusStateHeat(context) {
    const party = Math.max(1, Number(context.bossPartyCount) || 1);
    if (party >= 4) return 5;
    if (party >= 3) return 4;
    return 3;
  }

  function phaseStateHeat(phase, context) {
    if (phase === "trial") return trialStateHeat(context);
    if (phase === "bonus") return bonusStateHeat(context);
    if (phase === "battle") return 2;
    return normalStateHeat(context);
  }

  function snapshot(context = {}) {
    const phase = normalizePhase(context);
    const mode = Object.hasOwn(MODE_FLOOR, context.mode) ? context.mode : phase === "bonus" ? "bonus" : phase === "normal" ? "normal" : "hot";
    const flag = Object.hasOwn(FLAG_HEAT, context.flag) ? context.flag : "none";
    const stateHeat = clampHeat(phaseStateHeat(phase, context));
    const flagHeat = clampHeat(FLAG_HEAT[flag]);
    const heat = clampHeat(Math.max(stateHeat, flagHeat, MODE_FLOOR[mode]));
    const semantic = PHASE_CUES[phase][heat];
    return deepFreeze({
      phase,
      mode,
      flag,
      heat,
      stateHeat,
      flagHeat,
      cue: semantic.cue,
      field: semantic.field,
      tone: semantic.tone,
    });
  }

  return deepFreeze({ FLAG_HEAT, MODE_FLOOR, PHASE_CUES, snapshot });
});
