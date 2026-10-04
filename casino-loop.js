(function initCasinoLoop(windowRef, documentRef) {
  "use strict";

  const ZONES = Object.freeze([
    Object.freeze({ id: "arrival", mimiPose: "tray" }),
    Object.freeze({ id: "main-floor", mimiPose: "greet" }),
    Object.freeze({ id: "vip-salon", mimiPose: "bow" }),
    Object.freeze({ id: "jewel-exchange", mimiPose: "tray" })
  ]);
  const WALK_SECONDS = 5.041667;
  const RESET_FADE_SECONDS = 0.16;
  /* Panels meet at the viewport edge. Each incoming panel owns a permanent
     architectural threshold, so the boundary moves through the world and is
     never created or removed by animation state. */
  const OVERLAP_RATIO = 0;

  const shell = documentRef.getElementById("gameShell");
  const root = documentRef.querySelector(".casino-loop");
  const track = documentRef.querySelector(".casino-loop-track");
  const mimi = documentRef.querySelector(".casino-mimi");
  const gsap = windowRef.gsap;

  if (!shell || !root || !track || !mimi) return;

  let timeline = null;
  let travelFrame = 0;
  let travelActive = false;
  let travelTrackIndex = 0;
  let travelNextZone = 0;
  let currentZone = 0;
  let queuedAdvance = false;
  let lastNormalRunId = null;
  let manualPaused = false;
  let destroyed = false;
  let travelEpoch = 0;
  let travelLastProgress = 0;
  let travelLastProgressAt = 0;
  let travelVideoUnavailable = false;
  const motionPreference = windowRef.matchMedia("(prefers-reduced-motion: reduce)");

  function zoneStep() {
    return root.clientWidth * (1 - OVERLAP_RATIO);
  }

  function placeTrack(x) {
    if (gsap) gsap.set(track, { x, force3D: true });
    else track.style.transform = `translateX(${x}px)`;
  }

  function setZone(index) {
    currentZone = index % ZONES.length;
    const zone = ZONES[currentZone];
    root.dataset.zone = zone.id;
    shell.dataset.casinoZone = zone.id;
    root.classList.remove("is-travelling");
  }

  function setMimiIdleFrame() {
    if (destroyed) return;
    mimi.pause();
    mimi.classList.remove("is-walking");
    mimi.classList.add("is-idle");
    if (Number.isFinite(mimi.duration) && mimi.duration > 0) {
      const idleTime = Math.max(0, mimi.duration - (1 / 24));
      if (Math.abs(mimi.currentTime - idleTime) > 0.08) mimi.currentTime = idleTime;
    }
  }

  function playMimiWalk() {
    if (destroyed) return;
    const epoch = travelEpoch;
    mimi.pause();
    mimi.playbackRate = 1;
    mimi.currentTime = 0;
    mimi.classList.remove("is-idle");
    mimi.classList.add("is-walking");
    try {
      const playback = mimi.play();
      if (playback && typeof playback.catch === "function") playback.catch(function () {
        if (travelActive && travelEpoch === epoch) travelVideoUnavailable = true;
      });
    } catch (_error) { travelVideoUnavailable = true; }
    tickTravel();
  }

  function blocksAmbientForPresentation() {
    if (!shell.classList.contains("presentation-active")) return false;
    return shell.dataset.presentationScene !== "treasure.normal.event";
  }

  function reducedMotion() {
    return shell.classList.contains("reduced-motion") || motionPreference.matches;
  }

  function blocksTravel() {
    return manualPaused
      || shell.dataset.episode !== "treasure"
      || blocksAmbientForPresentation();
  }

  function shouldPause() {
    return blocksTravel() || reducedMotion();
  }

  function syncPlayback() {
    const paused = shouldPause();
    if (timeline) {
      if (paused) timeline.pause();
      else timeline.resume();
    }
    if (paused) mimi.pause();
    else if (root.classList.contains("is-travelling") && mimi.classList.contains("is-walking")) {
      const playback = mimi.play();
      if (playback && typeof playback.catch === "function") playback.catch(function () {});
    }
    root.classList.toggle("is-suspended", paused);
    // Motion preference may suppress the walk, never the next opponent's
    // command. Retry requests made while the clear scene still owned the LCD.
    if (!blocksTravel()) {
      if (travelActive && reducedMotion()) finishTravel(travelNextZone);
      else if (queuedAdvance && !travelActive && !timeline) {
        queuedAdvance = false;
        advanceOneZone();
      }
    }
  }

  function travelProgress() {
    const duration = Number.isFinite(mimi.duration) && mimi.duration > 0 ? mimi.duration : WALK_SECONDS;
    return Math.max(0, Math.min(1, mimi.currentTime / duration));
  }

  function tickTravel() {
    if (!travelActive || destroyed) return;
    windowRef.cancelAnimationFrame(travelFrame);
    const progress = travelProgress();
    const now = windowRef.performance.now();
    if (shouldPause() || progress > travelLastProgress + 0.001) {
      travelLastProgress = progress;
      travelLastProgressAt = now;
    }
    // A rejected/stalled decorative video must not strand the paid result.
    if (!blocksTravel() && (travelVideoUnavailable || mimi.error
      || now - travelLastProgressAt > (WALK_SECONDS + 1) * 1000)) {
      finishTravel(travelNextZone);
      return;
    }
    const eased = progress * progress * (3 - (2 * progress));
    const startX = -zoneStep() * currentZone;
    const endX = -zoneStep() * travelTrackIndex;
    gsap.set(track, { x: startX + ((endX - startX) * eased), force3D: true });
    if (mimi.ended || progress >= 0.999) {
      finishTravel(travelNextZone);
      return;
    }
    travelFrame = windowRef.requestAnimationFrame(tickTravel);
  }

  function finishTravel(nextZone) {
    travelActive = false;
    travelEpoch += 1;
    windowRef.cancelAnimationFrame(travelFrame);
    travelFrame = 0;
    mimi.pause();
    mimi.classList.remove("is-walking");
    mimi.classList.add("is-idle");
    mimi.style.opacity = "1";
    if (currentZone === ZONES.length - 1) {
      placeTrack(0);
      setZone(0);
    } else {
      placeTrack(-zoneStep() * nextZone);
      setZone(nextZone);
    }
    if (timeline) timeline.kill();
    timeline = null;
    const epoch = travelEpoch;
    windowRef.requestAnimationFrame(function () {
      if (destroyed || epoch !== travelEpoch || shell.dataset.episode !== "treasure") return;
      windowRef.dispatchEvent(new windowRef.CustomEvent("mimi:casino-arrival", {
        detail: Object.freeze({ zone: ZONES[currentZone].id, zoneIndex: currentZone })
      }));
      syncPlayback();
    });
  }

  function advanceOneZone() {
    if (destroyed) return false;
    if (blocksTravel()) {
      queuedAdvance = true;
      return false;
    }
    if (travelActive || timeline) {
      queuedAdvance = true;
      return false;
    }

    const nextZone = (currentZone + 1) % ZONES.length;
    if (!gsap || reducedMotion()) {
      finishTravel(nextZone);
      setMimiIdleFrame();
      return true;
    }
    const trackIndex = currentZone + 1;
    travelActive = true;
    travelEpoch += 1;
    travelLastProgress = 0;
    travelLastProgressAt = windowRef.performance.now();
    travelVideoUnavailable = false;
    travelTrackIndex = trackIndex;
    travelNextZone = nextZone;
    root.classList.add("is-travelling");

    timeline = gsap.timeline({
      paused: true
    });
    timeline.to(mimi, {
      opacity: 0,
      duration: RESET_FADE_SECONDS,
      ease: "power1.out"
    });
    timeline.call(playMimiWalk);
    timeline.to(mimi, {
      opacity: 1,
      duration: RESET_FADE_SECONDS,
      ease: "power1.in"
    }, ">");
    timeline.play();
    return true;
  }

  function onPresentationLifecycle(event) {
    const detail = event && event.detail || {};
    const normalStart = detail.sceneId === "treasure.normal.event" && detail.type === "start";
    const clearCancelledAfterCommit = detail.type === "cancel"
      && shell.dataset.chapter1ArrivalPending === "true"
      && shell.dataset.gamePhase === "normal";
    const tableClearComplete = detail.sceneId === "treasure.table.clear"
      && (detail.type === "complete" || clearCancelledAfterCommit);
    if (!normalStart && !tableClearComplete) return;
    // Four BET COINs open Velvet's table immediately. The fourth clear must
    // not wrap the ambient casino track behind the boss transition.
    if (tableClearComplete && Number(shell.dataset.chapter1BetCoins || 0) >= 4) return;
    if (detail.runId != null && detail.runId === lastNormalRunId) return;
    lastNormalRunId = detail.runId;
    advanceOneZone();
  }

  function preload() {
    const images = Array.from(root.querySelectorAll("img"));
    const imagePromises = images.map(function (image) {
      if (image.complete && image.naturalWidth > 0) return Promise.resolve();
      if (typeof image.decode === "function") return image.decode();
      return new Promise(function (resolve, reject) {
        image.addEventListener("load", resolve, { once: true });
        image.addEventListener("error", reject, { once: true });
      });
    });
    return Promise.allSettled(imagePromises);
  }

  function start() {
    if (destroyed) return;
    setZone(0);
    shell.classList.add("casino-loop-ready");
    root.dataset.engine = gsap ? "gsap" : "static";
    if (gsap) gsap.set(track, { x: 0, force3D: true });
    if (mimi.readyState >= 1) setMimiIdleFrame();
    else mimi.addEventListener("loadedmetadata", setMimiIdleFrame, { once: true });
  }

  function onResize() {
    if (!gsap) return;
    if (travelActive) {
      tickTravel();
      return;
    }
    gsap.set(track, { x: -zoneStep() * currentZone, force3D: true });
  }

  const shellObserver = new MutationObserver(syncPlayback);
  shellObserver.observe(shell, { attributes: true, attributeFilter: ["class", "data-episode"] });
  windowRef.addEventListener("mimi:presentation-lifecycle", onPresentationLifecycle);
  windowRef.addEventListener("resize", onResize, { passive: true });
  motionPreference.addEventListener?.("change", syncPlayback);

  windowRef.MimiCasinoLoop = Object.freeze({
    pause: function () { manualPaused = true; syncPlayback(); },
    resume: function () { manualPaused = false; syncPlayback(); },
    goTo: function (zoneIndex) {
      const safeIndex = Math.max(0, Math.min(ZONES.length - 1, Number(zoneIndex) || 0));
      if (timeline) timeline.pause(0);
      windowRef.cancelAnimationFrame(travelFrame);
      travelFrame = 0;
      travelActive = false;
      travelEpoch += 1;
      timeline = null;
      queuedAdvance = false;
      gsap && gsap.set(track, { x: -zoneStep() * safeIndex, force3D: true });
      setZone(safeIndex);
      setMimiIdleFrame();
      manualPaused = true;
      syncPlayback();
    },
    getState: function () {
      return Object.freeze({
        zone: ZONES[currentZone].id,
        zoneIndex: currentZone,
        paused: Boolean(timeline && timeline.paused()),
        travelling: root.classList.contains("is-travelling"),
        movement: root.classList.contains("is-travelling") ? "advance" : "idle"
      });
    },
    destroy: function () {
      destroyed = true;
      mimi.pause();
      windowRef.cancelAnimationFrame(travelFrame);
      travelFrame = 0;
      travelActive = false;
      travelEpoch += 1;
      if (timeline) timeline.kill();
      timeline = null;
      shellObserver.disconnect();
      windowRef.removeEventListener("mimi:presentation-lifecycle", onPresentationLifecycle);
      windowRef.removeEventListener("resize", onResize);
      motionPreference.removeEventListener?.("change", syncPlayback);
      shell.classList.remove("casino-loop-ready");
    }
  });

  preload().then(start);
})(window, document);
