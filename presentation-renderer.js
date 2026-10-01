(function (root, factory) {
  "use strict";

  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.MimiPresentationRenderer = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const TERMINAL_CLEAR_STATUSES = new Set(["cancelled", "destroyed", "error"]);
  const NARRATIVE_FIELDS = Object.freeze(["speaker", "headline", "line", "nextAction"]);
  const ART_MODES = Object.freeze(["procedural", "candidate", "hybrid"]);

  function finiteNumber(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function setStyleProperty(element, name, value) {
    if (element && element.style && typeof element.style.setProperty === "function") {
      const next = String(value);
      if (element.style.getPropertyValue(name) !== next) element.style.setProperty(name, next);
    }
  }

  function setText(element, value) {
    if (!element) return;
    const next = String(value == null ? "" : value);
    if (element.textContent !== next) element.textContent = next;
  }

  function clearElement(element) {
    if (!element) return;
    if (typeof element.replaceChildren === "function") element.replaceChildren();
    else while (element.firstChild) element.removeChild(element.firstChild);
  }

  function appendDecorativeStructure(documentRef, element, role) {
    function child(className) {
      const node = documentRef.createElement("i");
      node.className = className;
      node.setAttribute("aria-hidden", "true");
      element.appendChild(node);
      return node;
    }

    if (role === "backdrop") {
      child("pr-world pr-world-one");
      child("pr-world pr-world-two");
      child("pr-world pr-world-three");
      child("pr-world pr-world-four");
      child("pr-world pr-world-five");
    } else if (role === "veil") {
      child("pr-veil-sweep");
    } else if (role === "emblem") {
      child("pr-emblem-core");
      for (let index = 1; index <= 5; index += 1) child("pr-emblem-mark pr-emblem-mark-" + index);
    } else if (role === "actorL" || role === "actorR") {
      child("pr-figure-body");
      child("pr-figure-head");
      child("pr-figure-arm pr-figure-arm-one");
      child("pr-figure-arm pr-figure-arm-two");
      child("pr-figure-aura");
    } else if (role === "foreground") {
      const primary = documentRef.createElement("div");
      primary.className = "pr-primary-overlay";
      primary.setAttribute("aria-hidden", "true");
      element.appendChild(primary);
      child("pr-shock-line pr-shock-line-one");
      child("pr-shock-line pr-shock-line-two");
      child("pr-shock-line pr-shock-line-three");
      child("pr-future-blank-card");

      // Chapter 1 trial/CZ is a persistent code-native three-step panyu stage. The
      // bridge updates only semantic score/aura state; no reel input lives here.
      const trial = documentRef.createElement("div");
      trial.className = "treasure-trial-stage";
      trial.setAttribute("aria-hidden", "true");
      const trialHero = documentRef.createElement("img");
      trialHero.className = "treasure-trial-hero";
      trialHero.src = "./assets/character-animation-v8/unified-cast-v1/mimi.png";
      trialHero.alt = "";
      trialHero.decoding = "async";
      trialHero.loading = "eager";
      trialHero.fetchPriority = "high";
      trialHero.draggable = false;
      const trialStatus = documentRef.createElement("div");
      trialStatus.className = "treasure-feature-status";
      trialStatus.innerHTML = "<small>3G CHANCE</small><strong></strong><span></span>";
      trial.appendChild(trialStatus);
      const trialPot = documentRef.createElement("img");
      trialPot.className = "treasure-trial-pot";
      trialPot.src = "./assets/chapter1-motifs/chapter1-royal-pot-v1.png";
      trialPot.alt = "";
      trialPot.decoding = "async";
      trialPot.loading = "eager";
      trialPot.fetchPriority = "high";
      trialPot.draggable = false;
      const trialTable = documentRef.createElement("div");
      trialTable.className = "treasure-trial-table";
      const trialSockets = documentRef.createElement("div");
      trialSockets.className = "treasure-trial-sockets";
      for (let index = 1; index <= 3; index += 1) {
        const socket = documentRef.createElement("i");
        socket.dataset.socketIndex = String(index);
        trialSockets.appendChild(socket);
      }
      const trialCount = documentRef.createElement("div");
      trialCount.className = "treasure-trial-count";
      const trialCountValue = documentRef.createElement("strong");
      trialCountValue.textContent = "0";
      const trialCountTotal = documentRef.createElement("small");
      trialCountTotal.textContent = "/3";
      trialCount.append(trialCountValue, trialCountTotal);
      trialTable.append(trialSockets, trialCount);
      const trialAura = documentRef.createElement("div");
      trialAura.className = "treasure-trial-aura";
      const trialKeys = documentRef.createElement("div");
      trialKeys.className = "treasure-trial-keys";
      trialKeys.dataset.motif = "panyu-gauge";
      const charmMarks = ["", "", ""];
      const charmMoods = ["cheerful", "cheerful", "cheerful"];
      for (let index = 1; index <= 3; index += 1) {
        const key = documentRef.createElement("div");
        key.className = `treasure-trial-key treasure-trial-key-${index}`;
        key.dataset.keyIndex = String(index);
        key.dataset.charmMood = charmMoods[index - 1];
        const charm = documentRef.createElement("div");
        charm.className = "treasure-trial-charm";
        const earLeft = documentRef.createElement("i");
        earLeft.className = "treasure-trial-ear treasure-trial-ear-left";
        const earRight = documentRef.createElement("i");
        earRight.className = "treasure-trial-ear treasure-trial-ear-right";
        const face = documentRef.createElement("span");
        face.className = "treasure-trial-face";
        const eyeLeft = documentRef.createElement("i");
        eyeLeft.className = "treasure-trial-eye treasure-trial-eye-left";
        const eyeRight = documentRef.createElement("i");
        eyeRight.className = "treasure-trial-eye treasure-trial-eye-right";
        const mouth = documentRef.createElement("i");
        mouth.className = "treasure-trial-mouth";
        const mark = documentRef.createElement("b");
        mark.className = "treasure-trial-mark";
        mark.textContent = charmMarks[index - 1];
        face.append(eyeLeft, eyeRight, mouth, mark);
        const shaft = documentRef.createElement("span");
        shaft.className = "treasure-trial-shaft";
        const tail = documentRef.createElement("span");
        tail.className = "treasure-trial-tail";
        charm.append(earLeft, earRight, face, shaft, tail);
        key.appendChild(charm);
        trialKeys.appendChild(key);
      }
      const trialGauge = documentRef.createElement("div");
      trialGauge.className = "treasure-trial-gauge";
      const trialGaugeLabel = documentRef.createElement("span");
      trialGaugeLabel.textContent = "ぱにゅ";
      trialGauge.appendChild(trialGaugeLabel);
      for (let index = 1; index <= 3; index += 1) {
        const segment = documentRef.createElement("i");
        segment.dataset.scoreIndex = String(index);
        trialGauge.appendChild(segment);
      }
      trial.append(trialHero, trialPot, trialTable, trialAura, trialKeys, trialGauge);
      element.appendChild(trial);

      // Chapter 1 BONUS keeps the approved indoor resort-casino world and the
      // same unified cast. It owns the upper LCD between spins; reel results
      // remain on the lower machine UI.
      const bonusStage = documentRef.createElement("div");
      bonusStage.className = "treasure-bonus-stage";
      bonusStage.setAttribute("aria-hidden", "true");
      const bonusHero = documentRef.createElement("img");
      bonusHero.className = "treasure-bonus-hero";
      bonusHero.src = "./assets/character-animation-v8/unified-cast-v1/mimi.png";
      bonusHero.alt = "";
      bonusHero.decoding = "async";
      bonusHero.loading = "eager";
      bonusHero.fetchPriority = "high";
      bonusHero.draggable = false;
      const bonusStatus = documentRef.createElement("div");
      bonusStatus.className = "treasure-feature-status";
      bonusStatus.innerHTML = "<small>BETなし・毎ゲーム払い出し</small><strong></strong><span></span>";
      bonusStage.appendChild(bonusStatus);
      const bonusRival = documentRef.createElement("img");
      bonusRival.className = "treasure-bonus-rival";
      bonusRival.src = "./assets/character-animation-v8/unified-cast-v1/velvet.png";
      bonusRival.alt = "";
      bonusRival.decoding = "async";
      bonusRival.loading = "eager";
      bonusRival.fetchPriority = "high";
      bonusRival.draggable = false;
      const bonusPot = documentRef.createElement("img");
      bonusPot.className = "treasure-bonus-pot";
      bonusPot.src = "./assets/chapter1-motifs/chapter1-royal-pot-v1.png";
      bonusPot.alt = "";
      bonusPot.decoding = "async";
      bonusPot.loading = "eager";
      bonusPot.fetchPriority = "high";
      bonusPot.draggable = false;
      const bonusPanyu = documentRef.createElement("img");
      bonusPanyu.className = "treasure-bonus-panyu";
      bonusPanyu.src = "./assets/chapter1-motifs/panyu-ball.png";
      bonusPanyu.alt = "";
      bonusPanyu.decoding = "async";
      bonusPanyu.loading = "eager";
      bonusPanyu.fetchPriority = "high";
      bonusPanyu.draggable = false;
      const bonusCounter = documentRef.createElement("div");
      bonusCounter.className = "treasure-bonus-counter";
      const bonusCounterValue = documentRef.createElement("strong");
      bonusCounterValue.textContent = "10";
      const bonusCounterUnit = documentRef.createElement("small");
      bonusCounterUnit.textContent = "G";
      bonusCounter.append(bonusCounterValue, bonusCounterUnit);
      const bonusRoute = documentRef.createElement("div");
      bonusRoute.className = "treasure-bonus-route";
      bonusRoute.textContent = "対戦卓へ戻る";
      const bonusOrderAward = documentRef.createElement("div");
      bonusOrderAward.className = "treasure-bonus-order-award";
      const bonusOrderSeal = documentRef.createElement("div");
      bonusOrderSeal.className = "treasure-bonus-order-seal";
      const bonusOrderSealLabel = documentRef.createElement("small");
      bonusOrderSealLabel.textContent = "ROYAL";
      const bonusOrderSealValue = documentRef.createElement("b");
      bonusOrderSealValue.textContent = "I";
      bonusOrderSeal.append(bonusOrderSealLabel, bonusOrderSealValue);
      const bonusOrderCopy = documentRef.createElement("div");
      bonusOrderCopy.className = "treasure-bonus-order-copy";
      const bonusOrderArchive = documentRef.createElement("small");
      bonusOrderArchive.textContent = "CROWN ARCHIVE";
      const bonusOrderHeadline = documentRef.createElement("strong");
      bonusOrderHeadline.textContent = "NEW CREST";
      const bonusOrderTitle = documentRef.createElement("span");
      bonusOrderTitle.textContent = "TEAM ROYAL";
      const bonusOrderProgress = documentRef.createElement("em");
      bonusOrderProgress.textContent = "";
      bonusOrderCopy.append(bonusOrderArchive, bonusOrderHeadline, bonusOrderTitle, bonusOrderProgress);
      bonusOrderAward.append(bonusOrderSeal, bonusOrderCopy);
      const bonusProgress = documentRef.createElement("div");
      bonusProgress.className = "treasure-bonus-progress";
      for (let index = 1; index <= 10; index += 1) {
        const step = documentRef.createElement("i");
        step.dataset.bonusStep = String(index);
        bonusProgress.appendChild(step);
      }
      bonusStage.append(bonusHero, bonusRival, bonusPot, bonusPanyu, bonusCounter, bonusRoute, bonusOrderAward, bonusProgress);
      element.appendChild(bonusStage);

      // Treasure Chapter 1 turns the already-settled slot result into a
      // five-card royal-flush chase. The cards are presentation only: they
      // never decide stopping, payout, damage, or the next state.
      const showdown = documentRef.createElement("div");
      showdown.className = "treasure-poker-stage";
      showdown.setAttribute("aria-hidden", "true");

      const camera = documentRef.createElement("div");
      camera.className = "treasure-poker-camera";

      const arena = documentRef.createElement("div");
      arena.className = "treasure-poker-arena";

      const duel = documentRef.createElement("div");
      duel.className = "treasure-poker-duel";

      const velvet = documentRef.createElement("img");
      velvet.className = "treasure-poker-duelist treasure-poker-duelist-velvet";
      velvet.dataset.duelist = "velvet";
      velvet.src = "./assets/character-animation-v8/unified-cast-boss-v1/velvet-production.png";
      velvet.alt = "ヴェルベット";
      velvet.decoding = "async";
      velvet.loading = "eager";
      velvet.fetchPriority = "high";
      velvet.draggable = false;

      const velvetRole = documentRef.createElement("div");
      velvetRole.className = "treasure-poker-role treasure-poker-role-velvet";
      velvetRole.innerHTML = "<span></span><strong>VELVET</strong><small></small>";

      const mimiRole = documentRef.createElement("div");
      mimiRole.className = "treasure-poker-role treasure-poker-role-mimi";
      mimiRole.innerHTML = "<span></span><strong>MIMI</strong><small></small>";

      const rule = documentRef.createElement("div");
      rule.className = "treasure-poker-rule";
      const ruleLabel = documentRef.createElement("span");
      ruleLabel.textContent = "";
      const ruleText = documentRef.createElement("strong");
      ruleText.className = "treasure-poker-rule-text";
      ruleText.textContent = "";
      const ruleHint = documentRef.createElement("small");
      ruleHint.textContent = "";
      rule.append(ruleLabel, ruleText, ruleHint);

      duel.append(velvet, velvetRole, mimiRole, rule);

      const actionFrame = documentRef.createElement("div");
      actionFrame.className = "treasure-poker-action-frame";
      [
        ["mimi", "./assets/character-animation-v8/cutins-v4-original/mimi-ace-original-v2.png"],
        ["polka", "./assets/character-animation-v8/cutins-v4-original/rico-read-original-v1.png"],
        ["rico", "./assets/character-animation-v8/cutins-v4-original/polka-raise-original-v2.png"],
        ["selina", "./assets/character-animation-v8/cutins-v4-original/selina-warning-original-v1.png"],
        ["grano", "./assets/character-animation-v8/cutins-v4-original/grano-appraise-original-v1.png"],
        ["velvet", "./assets/character-animation-v8/cutins-v4-original/velvet-boss-original-v1.png"],
      ].forEach(function (entry) {
        const cutin = documentRef.createElement("img");
        cutin.className = `treasure-poker-premium-cutin treasure-poker-premium-cutin-${entry[0]}`;
        cutin.dataset.cutin = entry[0];
        cutin.src = entry[1];
        cutin.alt = "";
        cutin.decoding = "async";
        cutin.loading = "eager";
        cutin.fetchPriority = "high";
        cutin.draggable = false;
        actionFrame.appendChild(cutin);
      });

      const expectation = documentRef.createElement("div");
      expectation.className = "treasure-poker-expectation";
      const expectationLabel = documentRef.createElement("span");
      expectationLabel.textContent = "";
      expectation.appendChild(expectationLabel);
      for (let index = 1; index <= 5; index += 1) {
        const segment = documentRef.createElement("i");
        segment.style.setProperty("--signal-index", String(index));
        expectation.appendChild(segment);
      }

      const stakes = documentRef.createElement("div");
      stakes.className = "treasure-poker-stakes";
      const stakesLabel = documentRef.createElement("span");
      stakesLabel.className = "treasure-poker-stakes-label";
      stakesLabel.textContent = "STACK";
      const stakesValue = documentRef.createElement("strong");
      stakesValue.className = "treasure-poker-stakes-value";
      stakesValue.textContent = "100";
      stakes.append(stakesLabel, stakesValue);

      const teamMeter = documentRef.createElement("div");
      teamMeter.className = "treasure-poker-team-meter";
      const teamLabel = documentRef.createElement("span");
      teamLabel.textContent = "TEAM POWER";
      const teamPips = documentRef.createElement("div");
      teamPips.className = "treasure-poker-team-pips";
      [
        ["rico", "./assets/character-animation-v8/unified-cast-v1/polka.png"],
        ["polka", "./assets/character-animation-v8/unified-cast-v1/rico.png"],
        ["selina", "./assets/character-animation-v8/unified-cast-v1/selina.png"],
        ["grano", "./assets/character-animation-v8/unified-cast-v1/grano.png"],
      ].forEach(function (entry) {
        const pip = documentRef.createElement("i");
        pip.dataset.ally = entry[0];
        pip.dataset.ready = "false";
        const portrait = documentRef.createElement("img");
        portrait.src = entry[1];
        portrait.alt = "";
        portrait.decoding = "async";
        portrait.loading = "eager";
        pip.appendChild(portrait);
        teamPips.appendChild(pip);
      });
      const teamValue = documentRef.createElement("strong");
      teamValue.className = "treasure-poker-team-value";
      teamValue.textContent = "0/4";
      const resolveValue = documentRef.createElement("small");
      resolveValue.className = "treasure-poker-resolve-value";
      resolveValue.textContent = "FIRST TRY";
      teamMeter.append(teamLabel, teamPips, teamValue, resolveValue);

      const board = documentRef.createElement("div");
      board.className = "treasure-poker-board";
      for (let index = 1; index <= 5; index += 1) {
        const card = documentRef.createElement("i");
        card.className = "treasure-poker-card treasure-poker-card-" + index;
        card.dataset.revealed = "false";
        const cardBack = documentRef.createElement("span");
        cardBack.className = "treasure-poker-card-back";
        const cardFront = documentRef.createElement("span");
        cardFront.className = "treasure-poker-card-front";
        const value = documentRef.createElement("b");
        value.className = "treasure-poker-card-value";
        value.textContent = "";
        const suit = documentRef.createElement("small");
        suit.className = "treasure-poker-card-suit";
        suit.textContent = "";
        cardFront.append(value, suit);
        card.append(cardBack, cardFront);
        board.appendChild(card);
      }

      const royalPot = documentRef.createElement("img");
      royalPot.className = "treasure-poker-royal-pot";
      royalPot.src = "./assets/chapter1-motifs/chapter1-royal-pot-v1.png";
      royalPot.alt = "";
      royalPot.decoding = "async";
      royalPot.loading = "eager";
      royalPot.fetchPriority = "high";
      royalPot.draggable = false;

      const roleEmblem = documentRef.createElement("img");
      roleEmblem.className = "treasure-poker-role-emblem";
      roleEmblem.src = "./assets/generated/v3/symbols/dist/bell.png";
      roleEmblem.alt = "";
      roleEmblem.decoding = "async";
      roleEmblem.loading = "eager";
      roleEmblem.fetchPriority = "high";
      roleEmblem.draggable = false;

      const showdownLabel = documentRef.createElement("div");
      showdownLabel.className = "treasure-poker-showdown-label";
      showdownLabel.textContent = "";

      const bossCharms = trialKeys.cloneNode(true);
      // Keep the trial motif class so the poker-stage copy inherits the
      // approved round Panyu silhouette instead of falling back to the old
      // key/charm shaft geometry.
      bossCharms.className = "treasure-trial-keys treasure-poker-charms treasure-poker-panyu";
      bossCharms.querySelectorAll(".treasure-trial-key").forEach(function (charm, index) {
        if (index > 0) {
          charm.remove();
          return;
        }
        charm.dataset.locked = "true";
      });
      const panyuCount = documentRef.createElement("strong");
      panyuCount.className = "treasure-poker-panyu-count";
      panyuCount.textContent = "MAX";
      bossCharms.appendChild(panyuCount);

      const cast = documentRef.createElement("div");
      cast.className = "treasure-poker-cast";
      [
        ["mimi", "./assets/character-animation-v8/unified-cast-action-v1/mimi.png"],
        ["polka", "./assets/character-animation-v8/unified-cast-action-v1/rico.png"],
        ["rico", "./assets/character-animation-v8/unified-cast-action-v1/polka.png"],
        ["selina", "./assets/character-animation-v8/unified-cast-action-v1/selina.png"],
        ["grano", "./assets/character-animation-v8/unified-cast-action-v1/grano.png"],
      ].forEach(function (entry) {
        const actor = documentRef.createElement("img");
        actor.className = "treasure-poker-actor treasure-poker-actor-" + entry[0];
        actor.dataset.cast = entry[0];
        actor.src = entry[1];
        actor.alt = "";
        actor.decoding = "async";
        actor.loading = "lazy";
        actor.fetchPriority = "low";
        actor.draggable = false;
        cast.appendChild(actor);
      });

      const chipTrail = documentRef.createElement("div");
      chipTrail.className = "treasure-poker-chip-trail";
      for (let index = 1; index <= 7; index += 1) {
        const chip = documentRef.createElement("i");
        chip.className = "treasure-poker-chip treasure-poker-chip-" + index;
        chip.style.setProperty("--chip-index", String(index));
        chipTrail.appendChild(chip);
      }

      const impact = documentRef.createElement("div");
      impact.className = "treasure-poker-impact";
      const impactWord = documentRef.createElement("strong");
      impactWord.className = "treasure-poker-impact-word";
      impact.appendChild(impactWord);

      const tension = documentRef.createElement("div");
      tension.className = "treasure-poker-tension";
      const tensionWord = documentRef.createElement("strong");
      tensionWord.className = "treasure-poker-tension-word";
      tension.appendChild(tensionWord);

      const lampRails = ["left", "right"].map(function (side) {
        const rail = documentRef.createElement("div");
        rail.className = "treasure-poker-lamps treasure-poker-lamps-" + side;
        for (let index = 1; index <= 9; index += 1) {
          const lamp = documentRef.createElement("i");
          lamp.style.setProperty("--lamp-index", String(index));
          rail.appendChild(lamp);
        }
        return rail;
      });

      camera.append(arena, duel, actionFrame, expectation, stakes, teamMeter, board, royalPot, roleEmblem, showdownLabel, bossCharms, cast, chipTrail);
      showdown.append(camera, lampRails[0], lampRails[1], tension, impact);
      element.appendChild(showdown);
    }
  }

  function deterministicParticleStyle(element, index) {
    const lane = (index * 37 + 11) % 101;
    const rise = 35 + ((index * 29) % 66);
    const size = 2 + ((index * 17) % 7);
    const drift = ((index * 23) % 31) - 15;
    setStyleProperty(element, "--particle-index", String(index));
    setStyleProperty(element, "--particle-x", lane + "%");
    setStyleProperty(element, "--particle-rise", rise + "%");
    setStyleProperty(element, "--particle-size", size + "px");
    setStyleProperty(element, "--particle-drift", drift + "%");
  }

  function resolveTrackTargets(layerMap, target) {
    if (typeof target !== "string" || target.length === 0) return [];
    const separator = target.indexOf(" ");
    const role = separator < 0 ? target : target.slice(0, separator);
    const layer = layerMap[role];
    if (!layer) return [];
    if (separator < 0) return [layer];
    if (typeof layer.querySelector !== "function") return [];
    const selector = target.slice(separator + 1);
    const primary = layer.querySelector(selector);
    const targets = primary ? [primary] : [];
    return targets;
  }

  function localElapsedFor(frame) {
    const elapsed = Math.max(0, finiteNumber(frame && frame.elapsed, 0));
    const beatAt = Math.max(0, finiteNumber(frame && frame.beat && frame.beat.at, 0));
    const beatDuration = Math.max(1, finiteNumber(frame && frame.beat && frame.beat.duration, 1));
    return clamp(elapsed - beatAt, 0, beatDuration);
  }

  function particleCountFor(descriptor, reducedMotion) {
    if (!descriptor || reducedMotion || descriptor.reducedMotion) return 0;
    const requested = finiteNumber(descriptor.layers && descriptor.layers.particles && descriptor.layers.particles.count, 0);
    return Math.round(clamp(requested, 0, 60));
  }

  function createPresentationRenderer(options) {
    if (!options || typeof options !== "object") throw new TypeError("renderer options are required");
    const host = options.host;
    const choreography = options.choreography;
    const narrative = options.narrative || {};
    const artAssets = options.artAssets && typeof options.artAssets === "object"
      ? options.artAssets
      : {};
    const resolveArtAsset = typeof options.resolveArtAsset === "function"
      ? options.resolveArtAsset
      : function (family) { return artAssets[family]; };
    const onArtStatus = typeof options.onArtStatus === "function"
      ? options.onArtStatus
      : function () {};
    const externalSignal = options.signal || null;
    const gsapApi = options.gsap || (typeof globalThis !== "undefined" ? globalThis.gsap : null);
    if (!host || typeof host.appendChild !== "function") throw new TypeError("renderer host is required");
    if (!choreography || typeof choreography.get !== "function") throw new TypeError("choreography.get is required");

    const documentRef = host.ownerDocument || (typeof document !== "undefined" ? document : null);
    if (!documentRef || typeof documentRef.createElement !== "function") {
      throw new TypeError("renderer host must belong to a document");
    }

    let destroyed = false;
    let aborted = false;
    let renderToken = 0;
    let renderedEpoch = null;
    let renderedVisual = null;
    let abortController = null;
    let activeAnimations = [];
    let layerMap = Object.create(null);
    let removeExternalAbort = null;
    let artMode = ART_MODES.includes(options.artMode) ? options.artMode : "procedural";

    function reportArtStatus(status, family, source) {
      host.dataset.artLoad = status;
      onArtStatus(Object.freeze({
        status: status,
        family: family || null,
        source: source || null,
        mode: artMode,
      }));
    }

    function cancelAnimations() {
      if (abortController) abortController.abort();
      abortController = null;
      activeAnimations.forEach(function (animation) {
        if (animation && typeof animation.cancel === "function") animation.cancel();
        else if (animation && typeof animation.kill === "function") animation.kill();
      });
      activeAnimations = [];
    }

    function clearVisuals() {
      cancelAnimations();
      clearElement(host);
      layerMap = Object.create(null);
      renderedVisual = null;
      host.removeAttribute("data-effect");
      host.removeAttribute("data-visual");
      host.removeAttribute("data-family");
      host.removeAttribute("data-variant");
      host.removeAttribute("data-art-load");
      host.dataset.status = "cleared";
      host.dataset.particleCount = "0";
    }

    function updateNarrative(frame, descriptor) {
      const beat = frame.beat || {};
      const speaker = String(beat.speaker || "").trim();
      const headline = String(beat.headline || "").trim();
      const line = String(beat.line || "").trim();
      const objective = String(beat.objective || "").trim();
      setText(narrative.speaker, speaker);
      setText(narrative.headline, headline);
      setText(narrative.line, line);
      setText(narrative.nextAction, objective);
      if (!narrative.root) return;
      const empty = speaker || headline || line || objective ? "false" : "true";
      if (narrative.root.dataset.empty !== empty) narrative.root.dataset.empty = empty;
      if (narrative.root.dataset.copySafe !== "choreography") narrative.root.dataset.copySafe = "choreography";
      const fields = NARRATIVE_FIELDS.join(" ");
      if (narrative.root.dataset.narrativeFields !== fields) narrative.root.dataset.narrativeFields = fields;
      const copySafe = descriptor.copySafe;
      setStyleProperty(narrative.root, "--copy-left", copySafe.left + "%");
      setStyleProperty(narrative.root, "--copy-bottom", copySafe.bottom + "%");
      setStyleProperty(narrative.root, "--copy-width", copySafe.width + "%");
      setStyleProperty(narrative.root, "--copy-height", copySafe.height + "%");
    }

    function buildComposition(descriptor, reducedMotion) {
      // Generic effect visuals are rebuilt at every controller beat. Preserve
      // the Treasure scene roots across those rebuilds so scene state stays
      // continuous and authored stages do not inherit generic foreground fades.
      const preservedTreasureStage = typeof host.querySelector === "function"
        ? host.querySelector(".treasure-poker-stage")
        : null;
      const preservedTrialStage = typeof host.querySelector === "function"
        ? host.querySelector(".treasure-trial-stage")
        : null;
      const preservedBonusStage = typeof host.querySelector === "function"
        ? host.querySelector(".treasure-bonus-stage")
        : null;
      const preservedEmotionStage = typeof host.querySelector === "function"
        ? host.querySelector(".character-emotion-stage")
        : null;
      if (preservedTreasureStage && typeof preservedTreasureStage.remove === "function") {
        preservedTreasureStage.remove();
      }
      if (preservedTrialStage && typeof preservedTrialStage.remove === "function") {
        preservedTrialStage.remove();
      }
      if (preservedBonusStage && typeof preservedBonusStage.remove === "function") {
        preservedBonusStage.remove();
      }
      if (preservedEmotionStage && typeof preservedEmotionStage.remove === "function") {
        preservedEmotionStage.remove();
      }
      clearElement(host);
      layerMap = Object.create(null);
      const fragment = typeof documentRef.createDocumentFragment === "function"
        ? documentRef.createDocumentFragment()
        : host;
      const particleCount = particleCountFor(descriptor, reducedMotion);
      const order = Array.isArray(choreography.LAYER_ORDER)
        ? choreography.LAYER_ORDER
        : ["backdrop", "veil", "emblem", "actorL", "actorR", "foreground", "particles"];

      order.forEach(function (role) {
        const specification = descriptor.layers[role];
        if (!specification) return;
        const element = documentRef.createElement("div");
        element.className = "pr-layer pr-layer-" + role;
        element.dataset.role = role;
        element.dataset.kind = specification.kind;
        element.dataset.variant = specification.variant;
        element.dataset.visible = String(Boolean(specification.visible));
        element.setAttribute("aria-hidden", "true");
        appendDecorativeStructure(documentRef, element, role);
        if (role === "emblem") {
          const artSource = resolveArtAsset(descriptor.family, descriptor);
          if (typeof artSource === "string" && artSource.length > 0) {
            const art = documentRef.createElement("img");
            art.className = "pr-emblem-art";
            art.setAttribute("alt", "");
            art.setAttribute("aria-hidden", "true");
            art.setAttribute("draggable", "false");
            art.setAttribute("decoding", "async");
            art.dataset.family = descriptor.family;
            art.onload = function () {
              art.dataset.load = "ready";
              reportArtStatus("ready", descriptor.family, artSource);
            };
            art.onerror = function () {
              art.dataset.load = "error";
              art.hidden = true;
              reportArtStatus("error", descriptor.family, artSource);
            };
            art.dataset.load = "loading";
            art.src = artSource;
            element.appendChild(art);
            reportArtStatus("loading", descriptor.family, artSource);
          } else {
            reportArtStatus("unavailable", descriptor.family, null);
          }
        }
        if (role === "particles") {
          for (let index = 0; index < particleCount; index += 1) {
            const particle = documentRef.createElement("i");
            particle.className = "pr-particle pr-particle-" + (index % 4);
            particle.setAttribute("aria-hidden", "true");
            deterministicParticleStyle(particle, index);
            element.appendChild(particle);
          }
        }
        layerMap[role] = element;
        fragment.appendChild(element);
      });
      if (fragment !== host) host.appendChild(fragment);
      host.dataset.particleCount = String(particleCount);
      if (preservedEmotionStage) host.appendChild(preservedEmotionStage);

      if (typeof host.querySelector === "function") {
        const generatedTreasureStage = host.querySelector(".treasure-poker-stage");
        const activeTreasureStage = preservedTreasureStage || generatedTreasureStage;
        if (generatedTreasureStage && generatedTreasureStage !== activeTreasureStage) {
          generatedTreasureStage.remove();
        }
        // The authored stage must not inherit the generic foreground track.
        // That track intentionally fades and shakes ordinary effects, but it
        // made the entire poker table pulse between 24% and 86% opacity.
        if (activeTreasureStage && activeTreasureStage.parentNode !== host) {
          host.appendChild(activeTreasureStage);
        }
        const generatedTrialStage = host.querySelector(".treasure-trial-stage");
        const activeTrialStage = preservedTrialStage || generatedTrialStage;
        if (generatedTrialStage && generatedTrialStage !== activeTrialStage) {
          generatedTrialStage.remove();
        }
        if (activeTrialStage && activeTrialStage.parentNode !== host) {
          host.appendChild(activeTrialStage);
        }
        const generatedBonusStage = host.querySelector(".treasure-bonus-stage");
        const activeBonusStage = preservedBonusStage || generatedBonusStage;
        if (generatedBonusStage && generatedBonusStage !== activeBonusStage) {
          generatedBonusStage.remove();
        }
        if (activeBonusStage && activeBonusStage.parentNode !== host) {
          host.appendChild(activeBonusStage);
        }
      }

      if (typeof host.querySelectorAll === "function") {
        const overlays = host.querySelectorAll(".pr-primary-overlay");
        for (let index = 1; index < overlays.length; index += 1) overlays[index].remove();
      }
    }

    function gsapFrame(frame) {
      const result = {};
      Object.entries(frame || {}).forEach(function (entry) {
        if (entry[0] !== "offset" && entry[0] !== "easing") result[entry[0]] = entry[1];
      });
      return result;
    }

    function createGsapTimeline(descriptor, localElapsed, speed, playing) {
      if (!gsapApi || typeof gsapApi.timeline !== "function") return null;
      const master = gsapApi.timeline({ paused: true });
      ["enter", "hold", "exit"].forEach(function (phase) {
        const tracks = descriptor.tracks[phase] || [];
        tracks.forEach(function (track) {
          resolveTrackTargets(layerMap, track.target).forEach(function (target) {
            const frames = Array.isArray(track.keyframes) ? track.keyframes : [];
            if (!target || frames.length === 0) return;
            const duration = Math.max(1, finiteNumber(track.duration, 1)) / 1000;
            const repeat = track.iterations === Infinity
              ? -1
              : Math.max(0, Math.floor(finiteNumber(track.iterations, 1)) - 1);
            const child = gsapApi.timeline({ repeat: repeat });
            const denominator = Math.max(1, frames.length - 1);
            const offsets = frames.map(function (keyframe, index) {
              return clamp(finiteNumber(keyframe && keyframe.offset, index / denominator), 0, 1);
            });
            child.set(target, gsapFrame(frames[0]), 0);
            for (let index = 1; index < frames.length; index += 1) {
              const start = offsets[index - 1] * duration;
              const segmentDuration = Math.max(0.0001, (offsets[index] - offsets[index - 1]) * duration);
              child.to(target, Object.assign(gsapFrame(frames[index]), {
                duration: segmentDuration,
                ease: frames[index].easing || track.easing || "none",
              }), start);
            }
            master.add(child, Math.max(0, finiteNumber(track.delay, 0)) / 1000);
          });
        });
      });
      master.timeScale(speed);
      master.seek(localElapsed / 1000, true);
      if (playing) master.play();
      return master;
    }

    function createAnimations(descriptor, frame, token) {
      cancelAnimations();
      abortController = typeof AbortController === "function" ? new AbortController() : null;
      const reducedMotion = Boolean(frame.reducedMotion || descriptor.reducedMotion);
      const localElapsed = localElapsedFor(frame);
      const speed = Math.max(0.05, finiteNumber(frame.speed, 1));
      const playing = frame.status === "playing";
      let waapiAvailable = false;

      if (!reducedMotion) {
        const gsapTimeline = createGsapTimeline(descriptor, localElapsed, speed, playing);
        if (gsapTimeline) {
          activeAnimations.push(gsapTimeline);
          host.dataset.motionEngine = "gsap";
          host.dataset.status = frame.status || "idle";
          host.dataset.reduced = "false";
          setStyleProperty(host, "--beat-duration", descriptor.duration + "ms");
          setStyleProperty(host, "--playback-rate", String(speed));
          setStyleProperty(host, "--local-progress", String(clamp(localElapsed / descriptor.duration, 0, 1)));
          return;
        }
      }

      ["enter", "hold", "exit"].forEach(function (phase) {
        const tracks = descriptor.tracks[phase] || [];
        tracks.forEach(function (track) {
          resolveTrackTargets(layerMap, track.target).forEach(function (target) {
            if (!target || typeof target.animate !== "function") return;
            waapiAvailable = true;
            const animation = target.animate(track.keyframes, {
              delay: track.delay,
              duration: track.duration,
              easing: track.easing,
              fill: track.fill,
              iterations: track.iterations,
            });
            if (typeof animation.pause === "function") animation.pause();
            animation.playbackRate = speed;
            try { animation.currentTime = localElapsed; } catch { /* detached mocks may reject currentTime */ }
            if (
              playing &&
              localElapsed < track.delay + track.duration &&
              typeof animation.play === "function"
            ) {
              animation.play();
            }
            if (animation.finished && typeof animation.finished.then === "function") {
              animation.finished.then(function () {
                if (token !== renderToken && typeof animation.cancel === "function") animation.cancel();
              }).catch(function () { /* cancel() rejects finished in browsers */ });
            }
            activeAnimations.push(animation);
          });
        });
      });

      host.dataset.motionEngine = waapiAvailable && !reducedMotion ? "waapi" : "css";
      host.dataset.status = frame.status || "idle";
      host.dataset.reduced = String(reducedMotion);
      setStyleProperty(host, "--beat-duration", descriptor.duration + "ms");
      setStyleProperty(host, "--fallback-duration", (descriptor.duration / speed) + "ms");
      setStyleProperty(host, "--fallback-delay", (-localElapsed / speed) + "ms");
      setStyleProperty(host, "--fallback-play-state", playing ? "running" : "paused");
      setStyleProperty(host, "--playback-rate", String(speed));
      setStyleProperty(host, "--local-progress", String(clamp(localElapsed / descriptor.duration, 0, 1)));
    }

    function render(frame) {
      if (destroyed || aborted) return false;
      if (!frame || typeof frame !== "object") throw new TypeError("renderer frame is required");
      if (TERMINAL_CLEAR_STATUSES.has(frame.status)) {
        renderToken += 1;
        renderedEpoch = frame.epoch;
        clearVisuals();
        return true;
      }

      const beat = frame.beat;
      const visual = beat && beat.visual;
      const descriptor = choreography.get(visual);
      if (!descriptor) {
        renderToken += 1;
        clearVisuals();
        host.dataset.status = "unmapped";
        return false;
      }

      const epoch = finiteNumber(frame.epoch, 0);
      const epochChanged = renderedEpoch !== epoch;
      const visualChanged = renderedVisual !== visual;
      if (epochChanged || visualChanged || host.childNodes.length === 0) {
        renderToken += 1;
        cancelAnimations();
        buildComposition(descriptor, Boolean(frame.reducedMotion));
      }

      renderedEpoch = epoch;
      renderedVisual = visual;
      host.dataset.effect = frame.effectId || descriptor.family;
      host.dataset.visual = visual;
      host.dataset.family = descriptor.family;
      host.dataset.variant = descriptor.variant;
      host.dataset.epoch = String(epoch);
      host.dataset.artStatus = descriptor.artStatus;
      host.dataset.artMode = artMode;
      host.dataset.shapeCue = descriptor.shapeCue.name;
      updateNarrative(frame, descriptor);
      createAnimations(descriptor, frame, renderToken);
      return true;
    }

    function cancel(reason) {
      if (destroyed) return false;
      renderToken += 1;
      clearVisuals();
      host.dataset.cancelReason = String(reason || "cancelled");
      return true;
    }

    function setArtMode(nextMode) {
      if (!ART_MODES.includes(nextMode)) {
        throw new RangeError("unknown presentation art mode: " + String(nextMode));
      }
      artMode = nextMode;
      host.dataset.artMode = artMode;
      const art = typeof host.querySelector === "function"
        ? host.querySelector(".pr-emblem-art")
        : null;
      reportArtStatus(
        art ? (art.dataset.load || "loading") : "unavailable",
        host.dataset.family || null,
        art ? art.src : null,
      );
      return artMode;
    }

    function abort(reason) {
      if (destroyed || aborted) return false;
      const result = cancel("abort:" + String(reason || "signal"));
      aborted = true;
      host.dataset.status = "aborted";
      return result;
    }

    function snapshot() {
      return Object.freeze({
        destroyed: destroyed,
        aborted: aborted,
        epoch: renderedEpoch,
        visual: renderedVisual,
        animationCount: activeAnimations.length,
        particleCount: Number(host.dataset.particleCount || 0),
        childCount: host.childNodes.length,
        token: renderToken,
        artMode: artMode,
        artLoad: host.dataset.artLoad || "unavailable",
      });
    }

    function destroy() {
      if (destroyed) return false;
      cancel("destroyed");
      if (removeExternalAbort) removeExternalAbort();
      removeExternalAbort = null;
      destroyed = true;
      host.dataset.status = "destroyed";
      return true;
    }

    if (externalSignal && typeof externalSignal.addEventListener === "function") {
      const handleExternalAbort = function () { abort(externalSignal.reason || "external-signal"); };
      externalSignal.addEventListener("abort", handleExternalAbort, { once: true });
      removeExternalAbort = function () {
        if (typeof externalSignal.removeEventListener === "function") {
          externalSignal.removeEventListener("abort", handleExternalAbort);
        }
      };
      if (externalSignal.aborted) handleExternalAbort();
    }

    return Object.freeze({
      render: render,
      setArtMode: setArtMode,
      cancel: cancel,
      abort: abort,
      snapshot: snapshot,
      destroy: destroy,
    });
  }

  return Object.freeze({
    createPresentationRenderer: createPresentationRenderer,
    localElapsedFor: localElapsedFor,
    particleCountFor: particleCountFor,
    MAX_PARTICLES: 60,
    NARRATIVE_FIELDS: NARRATIVE_FIELDS,
    ART_MODES: ART_MODES,
  });
});
