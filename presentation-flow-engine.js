/*
 * presentation-flow-engine.js - declarative scene-flow orchestration.
 *
 * XState owns branching, event serialization, and inspectable snapshots.
 * MimiPresentation owns semantic beat time. Renderers (DOM/GSAP today,
 * Canvas/Rive later) stay below both layers and never decide game outcomes.
 */
(function (root, factory) {
  "use strict";
  const api = factory(root);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.MimiPresentationFlow = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (root) {
  "use strict";

  const LIFECYCLE_EVENT_TYPES = Object.freeze({
    start: "SCENE_STARTED",
    complete: "SCENE_COMPLETED",
    cancel: "SCENE_CANCELLED",
  });

  function text(value) {
    return String(value == null ? "" : value).trim();
  }

  function normalizeTransition(flowId, stateId, eventType, source, stateIds) {
    const raw = typeof source === "string" ? { target: source } : source;
    if (!raw || typeof raw !== "object") {
      throw new TypeError(`${flowId}.${stateId}.on.${eventType} must be a target or transition object`);
    }
    const target = text(raw.target);
    if (!target || !stateIds.has(target)) {
      throw new RangeError(`${flowId}.${stateId}.on.${eventType} has unknown target: ${target || "(empty)"}`);
    }
    return Object.freeze({ target: target });
  }

  function normalizeDefinition(source) {
    if (!source || typeof source !== "object") throw new TypeError("flow definition is required");
    const id = text(source.id);
    if (!id) throw new TypeError("flow definition id is required");
    if (!source.states || typeof source.states !== "object") throw new TypeError(`${id}.states is required`);
    const stateIds = new Set(Object.keys(source.states));
    const initial = text(source.initial);
    if (!stateIds.has(initial)) throw new RangeError(`${id}.initial has unknown state: ${initial}`);

    const states = Object.create(null);
    Object.entries(source.states).forEach(function (entry) {
      const stateId = entry[0];
      const raw = entry[1];
      if (!raw || typeof raw !== "object") throw new TypeError(`${id}.${stateId} must be an object`);
      const sceneId = text(raw.sceneId) || null;
      const transitions = Object.create(null);
      Object.entries(raw.on || {}).forEach(function (transition) {
        transitions[text(transition[0]).toUpperCase()] = normalizeTransition(
          id,
          stateId,
          text(transition[0]).toUpperCase(),
          transition[1],
          stateIds,
        );
      });
      if (raw.onComplete != null) {
        if (!sceneId) throw new TypeError(`${id}.${stateId}.onComplete requires sceneId`);
        transitions.SCENE_COMPLETED = normalizeTransition(id, stateId, "SCENE_COMPLETED", raw.onComplete, stateIds);
      }
      if (raw.onCancel != null) {
        if (!sceneId) throw new TypeError(`${id}.${stateId}.onCancel requires sceneId`);
        transitions.SCENE_CANCELLED = normalizeTransition(id, stateId, "SCENE_CANCELLED", raw.onCancel, stateIds);
      }
      states[stateId] = Object.freeze({
        id: stateId,
        sceneId: sceneId,
        type: raw.type === "final" ? "final" : "atomic",
        on: Object.freeze(transitions),
      });
    });

    return Object.freeze({ id: id, initial: initial, states: Object.freeze(states) });
  }

  function createSceneFlow(options) {
    const settings = options || {};
    const definition = normalizeDefinition(settings.definition);
    const xstate = settings.xstate || (root && root.XState);
    if (!xstate || typeof xstate.createMachine !== "function" || typeof xstate.createActor !== "function" || typeof xstate.assign !== "function") {
      throw new TypeError("XState 5 createMachine/createActor/assign are required");
    }
    const onEnter = typeof settings.onEnter === "function" ? settings.onEnter : function () {};
    const onScene = typeof settings.onScene === "function" ? settings.onScene : function () {};
    const inspect = typeof settings.inspect === "function" ? settings.inspect : undefined;
    const defer = typeof settings.defer === "function"
      ? settings.defer
      : typeof queueMicrotask === "function"
        ? queueMicrotask
        : function (callback) { Promise.resolve().then(callback); };
    let actor = null;

    const machineStates = Object.create(null);
    Object.entries(definition.states).forEach(function (entry) {
      const stateId = entry[0];
      const node = entry[1];
      const machineNode = { entry: [] };
      machineNode.entry.push(xstate.assign({
        activeSceneId: function () { return node.sceneId; },
        activeRunId: function () { return null; },
      }));
      machineNode.entry.push(function (scope) {
        onEnter(Object.freeze({
          flowId: definition.id,
          stateId: stateId,
          sceneId: node.sceneId,
          data: scope.context.data,
        }));
      });
      if (node.sceneId) {
        machineNode.entry.push(function (scope) {
          const payload = scope.context.data;
          defer(function () {
            const current = actor && actor.getSnapshot();
            if (!current || current.status !== "active" || current.value !== stateId) return;
            onScene(Object.freeze({
              flowId: definition.id,
              stateId: stateId,
              sceneId: node.sceneId,
              payload: payload,
            }));
          });
        });
      }

      if (node.type === "final") machineNode.type = "final";
      const eventMap = Object.create(null);
      Object.entries(node.on).forEach(function (transitionEntry) {
        const eventType = transitionEntry[0];
        const transition = transitionEntry[1];
        const machineTransition = { target: transition.target };
        if (eventType === "START") {
          machineTransition.actions = xstate.assign({
            data: function (scope) {
              const value = scope.event && scope.event.data;
              return value && typeof value === "object" ? value : Object.freeze({});
            },
          });
        }
        if (eventType === "SCENE_COMPLETED" || eventType === "SCENE_CANCELLED") {
          machineTransition.guard = function (scope) {
            const event = scope.event || {};
            return event.sceneId === node.sceneId
              && (scope.context.activeRunId == null || event.runId === scope.context.activeRunId);
          };
        }
        eventMap[eventType] = machineTransition;
      });
      if (node.sceneId) {
        eventMap.SCENE_STARTED = {
          guard: function (scope) { return scope.event.sceneId === node.sceneId; },
          actions: xstate.assign({
            activeRunId: function (scope) { return scope.event.runId; },
          }),
        };
      }
      if (Object.keys(eventMap).length > 0) machineNode.on = eventMap;
      machineStates[stateId] = machineNode;
    });

    const machine = xstate.createMachine({
      id: definition.id,
      initial: definition.initial,
      context: {
        data: Object.freeze({}),
        activeSceneId: null,
        activeRunId: null,
      },
      states: machineStates,
    });
    actor = xstate.createActor(machine, inspect ? { inspect: inspect } : undefined);
    actor.start();

    function send(event) {
      if (!event || typeof event !== "object") throw new TypeError("flow event object is required");
      actor.send(event);
      return snapshot();
    }

    function start(data) {
      const payload = data && typeof data === "object" ? Object.freeze(Object.assign({}, data)) : Object.freeze({});
      actor.send({ type: "START", data: payload });
      return snapshot();
    }

    function handlePresentationLifecycle(detail) {
      if (!detail || typeof detail !== "object") return false;
      const type = LIFECYCLE_EVENT_TYPES[text(detail.type).toLowerCase()];
      if (!type) return false;
      actor.send({
        type: type,
        sceneId: text(detail.sceneId),
        runId: detail.runId == null ? null : Number(detail.runId),
        reason: text(detail.reason),
      });
      return true;
    }

    function snapshot() {
      const value = actor.getSnapshot();
      return Object.freeze({
        flowId: definition.id,
        status: value.status,
        stateId: typeof value.value === "string" ? value.value : JSON.stringify(value.value),
        data: value.context.data,
        activeSceneId: value.context.activeSceneId,
        activeRunId: value.context.activeRunId,
      });
    }

    function subscribe(listener) {
      if (typeof listener !== "function") throw new TypeError("listener must be a function");
      const subscription = actor.subscribe(function () { listener(snapshot()); });
      return function unsubscribe() { subscription.unsubscribe(); };
    }

    function stop() {
      actor.stop();
      return true;
    }

    return Object.freeze({ start: start, send: send, handlePresentationLifecycle: handlePresentationLifecycle, subscribe: subscribe, snapshot: snapshot, stop: stop });
  }

  return Object.freeze({ createSceneFlow: createSceneFlow, normalizeDefinition: normalizeDefinition, LIFECYCLE_EVENT_TYPES: LIFECYCLE_EVENT_TYPES });
});
