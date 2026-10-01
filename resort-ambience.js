/* Quiet procedural water/air for the island only. No music, game RNG, rewards
 * or cabinet audio dependencies. Start only following a user gesture. */
(function (root) {
  "use strict";
  function create() {
    let context, output, filter, swell, active = false, enabled = true, location = "", time = "day";
    let lastSignature = "", animation, reduceMotion = false, view = "title";
    let focused = document.hasFocus(), pageAway = false, audioWork = Promise.resolve();
    const environment = root.MimiResortEnvironment?.create();
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    const foreground = () => focused && !pageAway && !document.hidden;
    const audible = () => active && enabled && foreground();
    function publishState() {
      for (const button of document.querySelectorAll("[data-stay-sound]")) {
        button.dataset.audioState = context?.state || "not-started";
        button.dataset.audioForeground = String(foreground());
      }
    }
    function initialise() {
      if (context) return;
      const Audio = root.AudioContext || root.webkitAudioContext;
      if (!Audio) return;
      context = new Audio();
      context.addEventListener("statechange", publishState);
      output = context.createGain(); output.gain.value = 0; output.connect(context.destination);
      filter = context.createBiquadFilter(); filter.type = "lowpass"; filter.Q.value = .25;
      const lowCut = context.createBiquadFilter(); lowCut.type = "highpass"; lowCut.frequency.value = 110;
      swell = context.createGain(); swell.gain.value = .65;
      // Deterministic local noise avoids consuming the cabinet's result RNG.
      const buffer = context.createBuffer(2, context.sampleRate * 8, context.sampleRate);
      let seed = 91731;
      for (let channel = 0; channel < 2; channel++) {
        const data = buffer.getChannelData(channel); let smooth = 0;
        for (let i = 0; i < data.length; i++) {
          seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
          smooth = (smooth + .04 * (seed / 2147483648 - 1)) / 1.04;
          data[i] = smooth * 3.6;
        }
        // Identical endpoint values prevent a click at the eight-second loop.
        const difference = data[data.length - 1] - data[0];
        for (let i = 0; i < 256; i++) data[data.length - 256 + i] -= difference * i / 255;
      }
      const noise = context.createBufferSource(); noise.buffer = buffer; noise.loop = true;
      noise.connect(lowCut); lowCut.connect(filter); filter.connect(swell); swell.connect(output); noise.start();
      const breath = context.createOscillator(), depth = context.createGain();
      breath.frequency.value = .115; depth.gain.value = .3;
      breath.connect(depth); depth.connect(swell.gain); breath.start();
    }
    function sync() {
      environment?.setScene(view, location, time, reduceMotion, foreground());
      publishState();
      if (!context) return;
      const sea = ["promenade", "lookout", "harbor", "pier", "cove", "pool"].includes(location), room = location === "room";
      const indoor = room || ["galleria", "shop", "hotel", "lounge", "museum", "fishdiner", "homekitchen", "bakery"].includes(location);
      const volume = (sea ? .38 : room ? .065 : indoor ? .10 : .23) * (time === "night" ? .75 : 1);
      output.gain.cancelScheduledValues(context.currentTime);
      if (audible()) output.gain.setTargetAtTime(volume, context.currentTime, .22);
      else output.gain.setValueAtTime(0, context.currentTime);
      filter.frequency.setTargetAtTime(sea ? 2100 : room ? 520 : indoor ? 950 : 3200, context.currentTime, .35);
      // Serialize browser promises and read the latest intent when they run.
      // A quick blur/focus or mute during resume must not leave stale audio on.
      audioWork = audioWork.catch(() => {}).then(async () => {
        if (!audible()) { if (context.state === "running") await context.suspend(); }
        else if (context.state === "suspended" && navigator.userActivation?.hasBeenActive) await context.resume();
      }).catch(() => {});
    }
    function unlock(event) {
      // Some embedded browsers resume focus through the first trusted gesture.
      if (event?.isTrusted && document.hasFocus() && !document.hidden) { focused = true; pageAway = false; }
      if (!active || !enabled || !foreground()) return;
      try { initialise(); sync(); } catch (_) { /* Audio failure never blocks walking or saving. */ }
    }
    document.addEventListener("pointerdown", unlock, { capture: true });
    document.addEventListener("keydown", unlock, { capture: true });
    document.addEventListener("visibilitychange", sync);
    root.addEventListener("blur", event => { if (event.target === root) { focused = false; sync(); } });
    root.addEventListener("focus", event => { if (event.target === root) { focused = true; sync(); } });
    root.addEventListener("pagehide", () => { pageAway = true; sync(); });
    root.addEventListener("pageshow", () => { pageAway = false; focused = document.hasFocus(); sync(); });
    document.addEventListener("freeze", () => { pageAway = true; sync(); });
    document.addEventListener("resume", () => { pageAway = false; focused = document.hasFocus(); sync(); });
    function setScene(nextView, journey, sound, motion = "full") {
      view = nextView;
      active = ["home", "shop", "room"].includes(view);
      reduceMotion = motion === "reduced";
      enabled = sound; location = view === "home" ? journey.location : view; time = journey.time;
      if (navigator.userActivation?.isActive) unlock();
      sync();
    }
    function reveal(node, signature) {
      if (lastSignature === signature) return;
      lastSignature = signature; animation?.cancel();
      if (reduceMotion || reduced.matches || !node) return;
      // Short, non-blocking arrival fade. Controls and keyboard focus stay live.
      animation = node.animate([{ opacity: .3 }, { opacity: 1 }], { duration: 440, easing: "ease-out" });
    }
    return { setScene, reveal, snapshot: () => ({ location, time, active, enabled, focused, pageAway, state: context?.state || "not-started" }) };
  }
  root.MimiResortAmbience = Object.freeze({ create });
})(window);
