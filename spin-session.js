/* spin-session.js - the immutable boundary of one paid/free reel game. */
(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.MimiSpinSession = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  let sequence = 0;

  function create(options) {
    return {
      id: ++sequence,
      phaseAtStart: options.phase,
      stageAtStart: options.stage,
      bet: options.bet,
      debit: options.debit,
      isReplayFree: Boolean(options.isReplayFree),
      isBonusFree: Boolean(options.isBonusFree),
      flagMode: options.flagMode,
      flag: options.flag,
      effectAtStart: options.effect || "",
      pendingStopQueue: [],
      stops: [null, null, null],
      resolved: false
    };
  }

  function queueStop(session, col) {
    if (!session || session.resolved || session.stops[col]) return false;
    if (session.pendingStopQueue.includes(col)) return false;
    session.pendingStopQueue.push(col);
    return true;
  }

  function takeReadyStop(session, ready) {
    if (!session || session.resolved) return null;
    const index = session.pendingStopQueue.findIndex(col => ready(col));
    if (index < 0) return null;
    return session.pendingStopQueue.splice(index, 1)[0];
  }

  function recordStop(session, col, stop) {
    if (!session || session.resolved || session.stops[col]) return false;
    session.stops[col] = Object.assign({ order: session.stops.filter(Boolean).length, settled: false }, stop);
    session.pendingStopQueue = session.pendingStopQueue.filter(item => item !== col);
    return true;
  }

  function knownStops(session, excludeCol = -1) {
    const known = {};
    if (!session) return known;
    session.stops.forEach((stop, col) => {
      if (col !== excludeCol && stop && Number.isInteger(stop.index)) known[col] = stop.index;
    });
    return known;
  }

  function markSettled(session, col) {
    if (session?.stops[col]) session.stops[col].settled = true;
  }

  function resolve(session) {
    if (!session || session.resolved) return false;
    session.resolved = true;
    session.pendingStopQueue.length = 0;
    return true;
  }

  return { create, queueStop, takeReadyStop, recordStop, knownStops, markSettled, resolve };
});
