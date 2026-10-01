/*
 * machine-presentation-blueprint.js - reusable slot presentation contract.
 *
 * A machine supplies concept data; the controller and renderer remain shared.
 * This module validates coverage only. It never rolls a flag, changes payout,
 * advances progression, or schedules animation time.
 */
(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.MimiMachinePresentationBlueprint = api;
}(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const SCHEMA_VERSION = 1;
  const SPIN_SEQUENCE = Object.freeze(["spin", "stop1", "stop2", "stop3", "settled"]);
  const REQUIRED_PHASES = Object.freeze(["normal", "trial", "bonus", "boss", "reward"]);
  const READINESS_KEYS = Object.freeze(["logic", "stopSequence", "normalMotion", "normalArt", "bossMotion", "audio"]);
  const READINESS_STATES = Object.freeze(["ready", "shared", "missing", "deferred"]);

  function deepFreeze(value) {
    if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
    Object.getOwnPropertyNames(value).forEach(function (key) { deepFreeze(value[key]); });
    return Object.freeze(value);
  }

  function clone(value) {
    if (Array.isArray(value)) return value.map(clone);
    if (!value || typeof value !== "object") return value;
    return Object.fromEntries(Object.entries(value).map(function (entry) {
      return [entry[0], clone(entry[1])];
    }));
  }

  function requireText(value, path) {
    if (typeof value !== "string" || !value.trim()) throw new Error(`${path} must be a non-empty string`);
  }

  function requireSceneList(value, path) {
    if (!Array.isArray(value) || value.length === 0) throw new Error(`${path} must contain at least one semantic scene`);
    value.forEach(function (sceneId, index) { requireText(sceneId, `${path}[${index}]`); });
  }

  function validateFlag(flagId, row) {
    requireText(flagId, "flag id");
    if (!row || typeof row !== "object") throw new Error(`flags.${flagId} is required`);
    if (!Number.isInteger(row.heat) || row.heat < 1 || row.heat > 5) throw new Error(`flags.${flagId}.heat must be 1..5`);
    if (!row.trigger || typeof row.trigger !== "object") throw new Error(`flags.${flagId}.trigger is required`);
    if (!row.poker || typeof row.poker !== "object") throw new Error(`flags.${flagId}.poker is required`);
    if (!row.normal || typeof row.normal !== "object") throw new Error(`flags.${flagId}.normal is required`);
    if (!row.boss || typeof row.boss !== "object") throw new Error(`flags.${flagId}.boss is required`);
    requireText(row.normal.anticipationFamily, `flags.${flagId}.normal.anticipationFamily`);
    requireText(row.normal.resultFamily, `flags.${flagId}.normal.resultFamily`);
    requireText(row.normal.scenePolicy, `flags.${flagId}.normal.scenePolicy`);
    requireText(row.boss.route, `flags.${flagId}.boss.route`);
    requireText(row.boss.actorId, `flags.${flagId}.boss.actorId`);
    requireText(row.boss.speaker, `flags.${flagId}.boss.speaker`);
    requireText(row.boss.technique, `flags.${flagId}.boss.technique`);
    if (!row.readiness || typeof row.readiness !== "object") throw new Error(`flags.${flagId}.readiness is required`);
    READINESS_KEYS.forEach(function (key) {
      if (!READINESS_STATES.includes(row.readiness[key])) {
        throw new Error(`flags.${flagId}.readiness.${key} must be ${READINESS_STATES.join("/")}`);
      }
    });
  }

  function defineMachine(input) {
    if (!input || typeof input !== "object") throw new Error("machine presentation blueprint is required");
    requireText(input.machineId, "machineId");
    requireText(input.conceptId, "conceptId");
    if (!input.direction || typeof input.direction !== "object") throw new Error("direction is required");
    ["player", "opponent", "progression"].forEach(function (key) { requireText(input.direction[key], `direction.${key}`); });
    const sequence = input.spinSequence || SPIN_SEQUENCE;
    if (!Array.isArray(sequence) || sequence.join("|") !== SPIN_SEQUENCE.join("|")) {
      throw new Error(`spinSequence must be ${SPIN_SEQUENCE.join(" -> ")}`);
    }
    if (!input.phases || typeof input.phases !== "object") throw new Error("phases are required");
    REQUIRED_PHASES.forEach(function (phase) { requireSceneList(input.phases[phase], `phases.${phase}`); });
    const flagOrder = Array.isArray(input.flagOrder) ? input.flagOrder.slice() : Object.keys(input.flags || {});
    if (flagOrder.length === 0 || new Set(flagOrder).size !== flagOrder.length) throw new Error("flagOrder must contain unique flags");
    flagOrder.forEach(function (flagId) { validateFlag(flagId, input.flags && input.flags[flagId]); });
    const extraFlags = Object.keys(input.flags || {}).filter(function (flagId) { return !flagOrder.includes(flagId); });
    if (extraFlags.length) throw new Error(`flags missing from flagOrder: ${extraFlags.join(", ")}`);

    const value = clone(input);
    value.schemaVersion = SCHEMA_VERSION;
    value.spinSequence = sequence.slice();
    value.flagOrder = flagOrder;
    return deepFreeze(value);
  }

  function flag(blueprint, flagId) {
    const fallbackId = blueprint && blueprint.flags && blueprint.flags.none ? "none" : blueprint.flagOrder[0];
    return blueprint.flags[Object.hasOwn(blueprint.flags, flagId) ? flagId : fallbackId];
  }

  function coverageRows(blueprint) {
    return deepFreeze(blueprint.flagOrder.map(function (flagId) {
      const row = blueprint.flags[flagId];
      return {
        flag: flagId,
        heat: row.heat,
        anticipationFamily: row.normal.anticipationFamily,
        resultFamily: row.normal.resultFamily,
        scenePolicy: row.normal.scenePolicy,
        bossRoute: row.boss.route,
        actorId: row.boss.actorId,
        readiness: Object.assign({}, row.readiness),
        nextUpgrade: row.nextUpgrade || "",
      };
    }));
  }

  function coverageSummary(blueprint) {
    const summary = Object.fromEntries(READINESS_KEYS.map(function (key) {
      return [key, Object.fromEntries(READINESS_STATES.map(function (state) { return [state, 0]; }))];
    }));
    coverageRows(blueprint).forEach(function (row) {
      READINESS_KEYS.forEach(function (key) { summary[key][row.readiness[key]] += 1; });
    });
    return deepFreeze(summary);
  }

  return deepFreeze({
    SCHEMA_VERSION,
    SPIN_SEQUENCE,
    REQUIRED_PHASES,
    READINESS_KEYS,
    READINESS_STATES,
    defineMachine,
    flag,
    coverageRows,
    coverageSummary,
  });
}));
