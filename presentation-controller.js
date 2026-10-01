/*
 * presentation-controller.js - one-channel presentation timeline.
 *
 * Definitions use this shape:
 *   {
 *     chance: {
 *       priority: 40,
 *       beats: [{ id: "enter", duration: 240 }, { id: "hold", duration: 900 }],
 *       reducedBeats: [{ id: "reduced", duration: 1 }]
 *     }
 *   }
 *
 * `elapsed` and `duration` sent to render() are whole-effect milliseconds.
 * The current beat keeps its own duration and any caller-defined metadata.
 *
 * Lifecycle subscribers receive stable run IDs plus named events. Beat/Cue
 * events fire once on natural playback entry only; pause, resume, seek,
 * speed changes, and reduced-motion remapping never replay a Cue.
 */
(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.MimiPresentation = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const EPSILON = 0.0001;

  function defaultNow() {
    return typeof performance !== "undefined" && typeof performance.now === "function"
      ? performance.now()
      : Date.now();
  }

  function normalizeBeats(effectId, name, beats) {
    if (!Array.isArray(beats) || beats.length === 0) {
      throw new TypeError(`${effectId}.${name} must be a non-empty array`);
    }
    let cursor = 0;
    const entries = beats.map((source, index) => {
      const raw = typeof source === "number" ? { duration: source } : source;
      if (!raw || typeof raw !== "object") {
        throw new TypeError(`${effectId}.${name}[${index}] must be an object or duration number`);
      }
      const duration = Number(raw.duration);
      if (!Number.isFinite(duration) || duration <= 0) {
        throw new RangeError(`${effectId}.${name}[${index}].duration must be > 0`);
      }
      const beat = Object.freeze(Object.assign({}, raw, { duration }));
      const entry = Object.freeze({ beat, start: cursor, end: cursor + duration });
      cursor += duration;
      return entry;
    });
    return Object.freeze({ entries: Object.freeze(entries), duration: cursor });
  }

  function normalizeDefinitions(definitions) {
    if (!definitions || typeof definitions !== "object") {
      throw new TypeError("definitions must be an object");
    }
    const normalized = Object.create(null);
    Object.entries(definitions).forEach(([effectId, source]) => {
      if (!source || typeof source !== "object") {
        throw new TypeError(`${effectId} definition must be an object`);
      }
      const priority = Number(source.priority ?? 0);
      if (!Number.isFinite(priority)) throw new RangeError(`${effectId}.priority must be finite`);
      const normal = normalizeBeats(effectId, "beats", source.beats);
      const reduced = source.reducedBeats
        ? normalizeBeats(effectId, "reducedBeats", source.reducedBeats)
        : normal;
      normalized[effectId] = Object.freeze({ effectId, priority, normal, reduced });
    });
    return Object.freeze(normalized);
  }

  function createPresentationController(options) {
    if (!options || typeof options !== "object") throw new TypeError("options are required");
    const definitions = normalizeDefinitions(options.definitions);
    const render = options.render;
    if (typeof render !== "function") throw new TypeError("render must be a function");
    if (options.onEvent != null && typeof options.onEvent !== "function") {
      throw new TypeError("onEvent must be a function");
    }

    const readNow = typeof options.now === "function" ? options.now : defaultNow;
    const schedule = typeof options.schedule === "function"
      ? options.schedule
      : (callback, delay) => setTimeout(callback, delay);
    const cancelSchedule = typeof options.cancelSchedule === "function"
      ? options.cancelSchedule
      : handle => clearTimeout(handle);

    let active = null;
    let queued = null;
    let timerHandle = null;
    let epoch = 0;
    let speed = 1;
    let reducedMotion = false;
    let destroyed = false;
    let lastReason = null;
    let runSequence = 0;
    const listeners = new Set();
    if (typeof options.onEvent === "function") listeners.add(options.onEvent);

    function subscribe(listener) {
      if (typeof listener !== "function") throw new TypeError("listener must be a function");
      if (destroyed) return function () { return false; };
      listeners.add(listener);
      let subscribed = true;
      return function unsubscribe() {
        if (!subscribed) return false;
        subscribed = false;
        return listeners.delete(listener);
      };
    }

    function publish(type, output, detail) {
      const event = Object.freeze(Object.assign({
        type: type,
        runId: output && output.runId != null ? output.runId : null,
        frame: output,
      }, detail || {}));
      Array.from(listeners).forEach(function (listener) {
        try { listener(event); } catch (_error) { /* subscribers cannot break playback */ }
      });
      return event;
    }

    function publishBeat(output) {
      return publish("beat", output, {
        cue: output && output.beat && output.beat.cue != null
          ? String(output.beat.cue)
          : null,
      });
    }

    function now() {
      const value = Number(readNow());
      if (!Number.isFinite(value)) throw new RangeError("now() must return a finite number");
      return value;
    }

    function timelineFor(source) {
      return reducedMotion ? source.reduced : source.normal;
    }

    function timelineOverride(effectId, name, base, source) {
      if (source == null) return base;
      if (!Array.isArray(source) || source.length !== base.entries.length) {
        throw new RangeError(`${effectId}.${name} must contain ${base.entries.length} beats`);
      }
      const beats = source.map(function (override, index) {
        const baseBeat = base.entries[index].beat;
        return typeof override === "number"
          ? Object.assign({}, baseBeat, { duration: override })
          : Object.assign({}, baseBeat, override || {});
      });
      return normalizeBeats(effectId, name, beats);
    }

    function playbackFor(effectId, definition, options) {
      const source = options && typeof options === "object" ? options : {};
      return Object.freeze({
        normal: timelineOverride(effectId, "playback.beats", definition.normal, source.beats),
        reduced: timelineOverride(effectId, "playback.reducedBeats", definition.reduced, source.reducedBeats),
      });
    }

    function clearTimer() {
      if (timerHandle === null) return;
      cancelSchedule(timerHandle);
      timerHandle = null;
    }

    function invalidateTimer() {
      clearTimer();
      epoch += 1;
      return epoch;
    }

    function elapsedAt(at = now()) {
      if (!active) return 0;
      if (active.status === "paused") return active.elapsedBase;
      const realDelta = Math.max(0, at - active.anchorTime);
      return Math.min(active.timeline.duration, active.elapsedBase + realDelta * speed);
    }

    function beatIndexAt(timeline, elapsed) {
      if (elapsed >= timeline.duration - EPSILON) return timeline.entries.length - 1;
      const index = timeline.entries.findIndex(entry => elapsed < entry.end - EPSILON);
      return index < 0 ? timeline.entries.length - 1 : index;
    }

    function frame(status = active?.status || "idle", elapsed = active ? elapsedAt() : 0, reason = null) {
      if (!active) {
        return {
          effectId: null,
          runId: null,
          beatIndex: -1,
          beat: null,
          elapsed: 0,
          duration: 0,
          status,
          payload: null,
          epoch,
          reason
        };
      }
      const clamped = Math.max(0, Math.min(active.timeline.duration, elapsed));
      const beatIndex = beatIndexAt(active.timeline, clamped);
      active.beatIndex = beatIndex;
      return {
        effectId: active.effectId,
        runId: active.runId,
        beatIndex,
        beat: active.timeline.entries[beatIndex].beat,
        elapsed: clamped,
        duration: active.timeline.duration,
        status,
        payload: active.payload,
        epoch,
        reason
      };
    }

    function emit(status, elapsed, reason = null) {
      const output = frame(status, elapsed, reason);
      render(output);
      return output;
    }

    function scheduleBoundary() {
      clearTimer();
      if (!active || active.status !== "playing" || destroyed) return;
      const elapsed = elapsedAt();
      if (elapsed >= active.timeline.duration - EPSILON) {
        completeActive();
        return;
      }
      const beatIndex = beatIndexAt(active.timeline, elapsed);
      const boundary = active.timeline.entries[beatIndex].end;
      const delay = Math.max(0, (boundary - elapsed) / speed);
      const token = epoch;
      timerHandle = schedule(() => {
        timerHandle = null;
        if (destroyed || !active || token !== epoch || active.status !== "playing") return;
        const current = elapsedAt();
        if (current >= active.timeline.duration - EPSILON) {
          completeActive();
          return;
        }
        active.elapsedBase = Math.max(current, boundary);
        active.anchorTime = now();
        invalidateTimer();
        const output = emit("playing", active.elapsedBase);
        publishBeat(output);
        scheduleBoundary();
      }, delay);
    }

    function startRequest(request) {
      const definition = definitions[request.effectId];
      invalidateTimer();
      active = {
        effectId: request.effectId,
        runId: ++runSequence,
        definition,
        playback: request.playback,
        timeline: timelineFor(request.playback),
        payload: request.payload,
        elapsedBase: 0,
        anchorTime: now(),
        beatIndex: 0,
        status: "playing"
      };
      lastReason = null;
      const output = emit("playing", 0);
      publish("start", output);
      publishBeat(output);
      scheduleBoundary();
    }

    function startQueuedIfPresent() {
      if (!queued || destroyed) return;
      const next = queued;
      queued = null;
      startRequest(next);
    }

    function completeActive() {
      if (!active) return;
      const duration = active.timeline.duration;
      invalidateTimer();
      active.elapsedBase = duration;
      active.status = "completed";
      const output = emit("completed", duration);
      publish("complete", output);
      active = null;
      startQueuedIfPresent();
    }

    function play(effectId, payload, playbackOptions) {
      if (destroyed) return false;
      const definition = definitions[effectId];
      if (!definition) throw new RangeError(`unknown presentation effect: ${effectId}`);
      const request = {
        effectId,
        payload,
        priority: definition.priority,
        playback: playbackFor(effectId, definition, playbackOptions),
      };
      if (!active) {
        startRequest(request);
        return true;
      }

      if (definition.priority > active.definition.priority) {
        const interruptedElapsed = elapsedAt();
        invalidateTimer();
        active.elapsedBase = interruptedElapsed;
        active.status = "cancelled";
        const output = emit("cancelled", interruptedElapsed, "preempted");
        publish("cancel", output, { reason: "preempted" });
        active = null;
        startRequest(request);
        return true;
      }

      if (!queued || request.priority >= queued.priority) {
        queued = request;
        return true;
      }
      return false;
    }

    function cancel(reason = "cancelled") {
      if (destroyed) return false;
      const hadWork = Boolean(active || queued);
      queued = null;
      if (!active) {
        invalidateTimer();
        lastReason = reason;
        return hadWork;
      }
      const elapsed = elapsedAt();
      invalidateTimer();
      active.elapsedBase = elapsed;
      active.status = "cancelled";
      lastReason = reason;
      const output = emit("cancelled", elapsed, reason);
      publish("cancel", output, { reason: reason });
      active = null;
      return true;
    }

    function pause() {
      if (destroyed || !active || active.status !== "playing") return false;
      const elapsed = elapsedAt();
      invalidateTimer();
      active.elapsedBase = elapsed;
      active.status = "paused";
      const output = emit("paused", elapsed);
      publish("pause", output);
      return true;
    }

    function resume() {
      if (destroyed || !active || active.status !== "paused") return false;
      invalidateTimer();
      active.anchorTime = now();
      active.status = "playing";
      const output = emit("playing", active.elapsedBase);
      publish("resume", output);
      scheduleBoundary();
      return true;
    }

    function seek(milliseconds) {
      if (destroyed || !active) return false;
      const target = Number(milliseconds);
      if (!Number.isFinite(target)) throw new RangeError("seek milliseconds must be finite");
      const elapsed = Math.max(0, Math.min(active.timeline.duration, target));
      const wasPaused = active.status === "paused";
      invalidateTimer();
      active.elapsedBase = elapsed;
      active.anchorTime = now();
      active.status = wasPaused ? "paused" : "playing";
      if (elapsed >= active.timeline.duration - EPSILON) {
        completeActive();
      } else {
        const output = emit(active.status, elapsed);
        publish("seek", output, { target: elapsed });
        if (!wasPaused) scheduleBoundary();
      }
      return true;
    }

    function stepBeat(direction = 1) {
      if (destroyed || !active) return false;
      const entries = active.timeline.entries;
      const currentIndex = beatIndexAt(active.timeline, elapsedAt());
      const offset = Number(direction) < 0 ? -1 : 1;
      const targetIndex = Math.max(0, Math.min(entries.length - 1, currentIndex + offset));
      if (active.status !== "paused") pause();
      seek(entries[targetIndex].start);
      return frame("paused", entries[targetIndex].start, "developer-step");
    }

    function setSpeed(multiplier) {
      if (destroyed) return false;
      const next = Number(multiplier);
      if (!Number.isFinite(next) || next <= 0) throw new RangeError("speed multiplier must be > 0");
      if (next === speed) return true;
      const elapsed = active ? elapsedAt() : 0;
      invalidateTimer();
      speed = next;
      if (active) {
        active.elapsedBase = elapsed;
        active.anchorTime = now();
        const output = emit(active.status, elapsed);
        publish("speed", output, { speed: speed });
        if (active.status === "playing") scheduleBoundary();
      }
      return true;
    }

    function setReducedMotion(value) {
      if (destroyed) return false;
      const next = Boolean(value);
      if (next === reducedMotion) return true;
      const elapsed = active ? elapsedAt() : 0;
      const oldDuration = active?.timeline.duration || 0;
      invalidateTimer();
      reducedMotion = next;
      if (active) {
        const progress = oldDuration > 0 ? elapsed / oldDuration : 0;
        active.timeline = timelineFor(active.playback);
        active.elapsedBase = Math.min(active.timeline.duration, progress * active.timeline.duration);
        active.anchorTime = now();
        if (active.elapsedBase >= active.timeline.duration - EPSILON) completeActive();
        else {
          const output = emit(active.status, active.elapsedBase);
          publish("reduced-motion", output, { reducedMotion: reducedMotion });
          if (active.status === "playing") scheduleBoundary();
        }
      }
      return true;
    }

    function snapshot() {
      const elapsed = active ? elapsedAt() : 0;
      const base = frame(destroyed ? "destroyed" : active?.status || "idle", elapsed, lastReason);
      return Object.assign({}, base, {
        speed,
        reducedMotion,
        queued: queued
          ? { effectId: queued.effectId, payload: queued.payload, priority: queued.priority }
          : null,
        destroyed
      });
    }

    function destroy() {
      if (destroyed) return false;
      queued = null;
      if (active) {
        const elapsed = elapsedAt();
        invalidateTimer();
        active.elapsedBase = elapsed;
        active.status = "destroyed";
        lastReason = "destroyed";
        const output = emit("destroyed", elapsed, "destroyed");
        publish("destroy", output, { reason: "destroyed" });
        active = null;
      } else {
        invalidateTimer();
        lastReason = "destroyed";
      }
      destroyed = true;
      listeners.clear();
      return true;
    }

    return Object.freeze({
      play,
      subscribe,
      cancel,
      pause,
      resume,
      seek,
      stepBeat,
      setSpeed,
      setReducedMotion,
      snapshot,
      destroy
    });
  }

  return Object.freeze({ createPresentationController });
});
