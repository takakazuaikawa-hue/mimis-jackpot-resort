(function () {
  "use strict";

  // ------------------------------------------------------------------
  // コンテンツ層
  //
  // 図柄以外の「中身」は content/*.js にある。ステージ・ショップ・
  // キャラ・画像パスを足したり差し替えたりするときは、このファイルでは
  // なく content/ の該当ファイルを直す。手順は docs/CONTENT.md。
  //
  // ここでは content の ID をパスへ解決して、以降のコードが今までどおり
  // .image / .cover を読める形に整えているだけ。
  // ------------------------------------------------------------------
  const content = window.MimiContent;
  /** アセット ID をパスへ解決する。差し替えは content/assets.js。 */
  const asset = content.asset;
  const assetBase = content.SYMBOL_DIR;
  const loadingAssets = content.preloadIds.map(asset);
  const adventureLcdBackground = asset(content.lcdBackground);
  const adventureEventVisuals = content.eventVisuals;
  // 回胴のロジックは slot-core.js に分離してある（Node からも同じコードを実行できる）。
  const core = window.SlotCore;
  const economy = window.MimiEconomyRules;
  const economyRules = economy.CONFIG;
  const chapter1Flow = window.MimiChapter1Flow;
  const chapter1InitialState = chapter1Flow.initialState();
  const presentationHeat = window.MimiPresentationHeat;
  const collectionEconomy = window.MimiCollectionEconomy;
  const spinSession = window.MimiSpinSession;
  const profileStore = window.MimiProfileStore;
  const audio = window.MimiAudio;
  const symbols = core.SYMBOLS;
  const strips = core.STRIPS;
  const paylines = core.PAYLINES;

  // リールの物理パラメータ。速度・加速度の単位はコマ/秒。
  const SPIN_SPEED = 24;
  const SPIN_SPEED_TURBO = 34;
  const SPIN_SPEED_TENPAI = 9;
  const HOT_READY_SPEED = 4;
  const HOT_AIM_HOLD_SEC = 0.65;
  const HOT_AUTO_STOP_SEC = 30;
  const SPIN_ACCEL = 120;
  /** ウェイト。回り出してからこの時間は STOP を受け付けない（押下は予約される）。 */
  const MIN_SPIN_SEC = 0.42;
  /** 放置したときに自動停止するまでの時間。 */
  const AUTO_STOP_SEC = 12;
  /** 第3停止後、最後の場札を読ませてから勝敗へ切り替える。 */
  const CHAPTER1_RIVER_HOLD_MS = 1200;

  // ステージ本体は content/stages.js。画像 ID をパスへ解決してから配る。
  const adventureEvents = content.stages.map(stage => Object.assign({}, stage, {
    cover: asset(stage.cover),
    image: asset(stage.image)
  }));

  const stages = adventureEvents.map(event => ({ name: event.stageName, sub: event.series, image: event.image, color: event.color }));

  /** 場面（explore / omen / chain / boss / bonus）をステージ ID で引ける形に。 */
  const adventureSceneBlueprints = content.stages.reduce((acc, stage) => {
    acc[stage.id] = stage.scenes;
    return acc;
  }, {});

  const cast = content.cast.map(member => Object.assign({}, member, { image: asset(member.portrait) }));

  const shopItems = content.shopItems.map(item => Object.assign({}, item, {
    image: asset(item.icon),
    displayImage: item.portrait ? asset(item.portrait) : undefined,
    stageImage: item.stage ? asset(item.stage) : undefined
  }));

  const machines = content.machines.map(machine => Object.assign({}, machine, { image: asset(machine.cover) }));

  const cutins = Object.keys(content.cutins).reduce((acc, key) => {
    acc[key] = { text: content.cutins[key].text, image: asset(content.cutins[key].image) };
    return acc;
  }, {});

  const orbColors = content.orbColors;
  const storyBeats = content.storyBeats;

  const stageScripts = adventureEvents;
  const bossRoster = adventureEvents.map(event => event.boss);

  // Chapter 1 boss outcomes are an explicit trigger table. Reel/economy code
  // selects one row; the presentation bridge owns the authored beats inside it.
  const TREASURE_BOSS_TURN_TABLE = Object.freeze({
    miss: Object.freeze({ rank: "COUNTER", sceneId: "treasure.boss.attack", hot: false }),
    counterCritical: Object.freeze({ rank: "DANGER", sceneId: "treasure.boss.counterCritical", hot: true }),
    revive: Object.freeze({ rank: "REVIVE", sceneId: "treasure.boss.revive", hot: true }),
    guard: Object.freeze({ rank: "DODGE", sceneId: "treasure.boss.guard", hot: false }),
    hit: Object.freeze({ rank: "HIT", sceneId: "treasure.boss.hit", hot: false }),
    critical: Object.freeze({ rank: "CRITICAL", sceneId: "treasure.boss.critical", hot: true }),
    victory: Object.freeze({ rank: "WIN", sceneId: "treasure.boss.win", hot: true }),
    timeout: Object.freeze({ rank: "TIME UP", sceneId: "treasure.boss.timeout", hot: false }),
    retry: Object.freeze({ rank: "RETRY ROUTE", sceneId: "treasure.boss.retry", hot: false })
  });

  // Winning symbols select the acting character and technique. Damage remains
  // economy-owned; this table changes only the authored upper-LCD response.
  const TREASURE_VICTORY_FLOW = Object.freeze({
    id: "treasure-victory-flow",
    initial: "idle",
    states: Object.freeze({
      idle: Object.freeze({ on: Object.freeze({ START: "victory" }) }),
      victory: Object.freeze({ sceneId: "treasure.boss.win", onComplete: "reward", onCancel: "reward" }),
      reward: Object.freeze({ sceneId: "treasure.reward", onComplete: "complete", onCancel: "complete" }),
      complete: Object.freeze({ type: "final" })
    })
  });

  const TREASURE_DEFEAT_FLOW = Object.freeze({
    id: "treasure-defeat-flow",
    initial: "idle",
    states: Object.freeze({
      idle: Object.freeze({ on: Object.freeze({ START: "timeout" }) }),
      timeout: Object.freeze({ sceneId: "treasure.boss.timeout", onComplete: "retry", onCancel: "retry" }),
      retry: Object.freeze({ sceneId: "treasure.boss.retry", onComplete: "complete", onCancel: "complete" }),
      complete: Object.freeze({ type: "final" })
    })
  });

  function singleSceneFlow(id, sceneId) {
    return Object.freeze({
      id,
      initial: "idle",
      states: Object.freeze({
        idle: Object.freeze({ on: Object.freeze({ START: "scene" }) }),
        scene: Object.freeze({ sceneId, onComplete: "complete", onCancel: "complete" }),
        complete: Object.freeze({ type: "final" }),
      }),
    });
  }

  const TREASURE_TRIAL_FLOWS = Object.freeze({
    enter: singleSceneFlow("treasure-trial-enter-flow", "treasure.trial.enter"),
    progress: singleSceneFlow("treasure-trial-progress-flow", "treasure.trial.progress"),
    success: singleSceneFlow("treasure-trial-success-flow", "treasure.trial.success"),
    revive: singleSceneFlow("treasure-trial-revive-flow", "treasure.trial.revive"),
    fail: singleSceneFlow("treasure-trial-fail-flow", "treasure.trial.fail"),
  });

  const state = {
    credit: 1200,
    bet: 30,
    win: 0,
    jackpot: economyRules.jackpot.base,
    stage: 1,
    phase: "normal",
    sceneSpins: 0,
    orb: 0,
    spinning: false,
    auto: false,
    turbo: false,
    reelsStopped: [true, true, true],
    positions: [0, 3, 6],
    flag: "none",
    flagLanded: false,
    freeSpin: false,
    treasure: 0,
    chapter1TableIndex: chapter1InitialState.tableIndex,
    chapter1OpponentId: chapter1InitialState.opponentId,
    chapter1OpponentStack: chapter1InitialState.opponentStack,
    chapter1BetCoins: chapter1InitialState.betCoins,
    chapter1AllyFocus: 0,
    chapter1ReadStreak: 0,
    chapter1ReadReady: false,
    chapter1PreparedAllies: [],
    chapter1ResolveLevel: 0,
    chapter1BossAttempt: 0,
    chapter1LastBossAdvantage: null,
    chapter1ArrivalPending: false,
    chapter1RoyalOrderId: "",
    chapter1RunNormalSpins: 0,
    chapter1RunReadBreaks: 0,
    chapter1RunStrongLands: 0,
    chapter1RunOrderResolved: false,
    chapter1RunOrderComplete: false,
    chapter1RunCrestId: "",
    chapter1RunCrestFirst: false,
    chapter1RunCrestSetComplete: false,
    chapter1RunFinished: false,
    chapter1NormalChance: null,
    activeCast: 0,
    justStopped: -1,
    adventureStep: 0,
    enemiesToBonus: economyRules.adventure.enemiesToBossInitial,
    allies: economyRules.adventure.alliesInitial,
    training: 0,
    bossHp: economyRules.boss.initialHp,
    bossBattle: false,
    bossResolutionPending: false,
    bossTurns: 0,
    // Presentation-only snapshot. It must never feed reel odds, payout, boss
    // damage, turn count, or BONUS entry decisions.
    bossPartyCount: 0,
    currentBoss: 0,
    bossStageId: "",
    trialType: "",
    trialSpins: 0,
    trialScore: 0,
    bonusGames: 0,
    bonusTotalWin: 0,
    bonusOrigin: "",
    bonusStock: 0,
    panyuStreak: 0,
    storyIndex: 0,
    combo: 0,
    bestCombo: 0,
    nearMiss: 0,
    grid: [],
    sceneMode: "explore",
    transitioning: false
  };

  function currentChapter1Table() {
    return chapter1Flow.tableAt(state.chapter1TableIndex);
  }

  function chapter1ProgressSnapshot() {
    return {
      tableIndex: state.chapter1TableIndex,
      opponentId: state.chapter1OpponentId,
      opponentStack: state.chapter1OpponentStack,
      betCoins: state.chapter1BetCoins,
    };
  }

  function applyChapter1Progress(next) {
    state.chapter1TableIndex = next.tableIndex;
    state.chapter1OpponentId = next.opponentId;
    state.chapter1OpponentStack = next.opponentStack;
    state.chapter1BetCoins = next.betCoins;
    state.treasure = next.betCoins;
  }

  function resetChapter1Progress() {
    paintSpinReceipt({ type: "ready" });
    state.chapter1NormalChance = null;
    applyChapter1Progress(chapter1Flow.initialState());
    state.chapter1AllyFocus = 0;
    state.chapter1ReadStreak = 0;
    state.chapter1ReadReady = false;
    state.chapter1PreparedAllies = [];
    state.chapter1ResolveLevel = 0;
    state.chapter1BossAttempt = 0;
    state.chapter1LastBossAdvantage = null;
    state.chapter1ArrivalPending = false;
    state.chapter1RoyalOrderId = "";
    state.chapter1RunNormalSpins = 0;
    state.chapter1RunReadBreaks = 0;
    state.chapter1RunStrongLands = 0;
    state.chapter1RunOrderResolved = false;
    state.chapter1RunOrderComplete = false;
    state.chapter1RunCrestId = "";
    state.chapter1RunCrestFirst = false;
    state.chapter1RunCrestSetComplete = false;
    state.chapter1RunFinished = false;
    window.clearTimeout(royalOrderMilestoneTimer);
    royalOrderMilestoneTimer = 0;
    royalOrderMilestoneText = "";
    chapter1HotGuideMode = "";
    chapter1HotGuideHits = 0;
    delete els.shell?.dataset.chapter1ResolveLevel;
    delete els.shell?.dataset.chapter1BossAttempt;
    delete els.shell?.dataset.chapter1BossTurnLimit;
    delete els.shell?.dataset.chapter1BossDamage;
    delete els.shell?.dataset.chapter1BossBonus;
    delete els.shell?.dataset.chapter1BossSynergy;
    delete els.shell?.dataset.chapter1ArrivalPending;
    delete els.shell?.dataset.chapter1RoyalOrder;
    delete els.shell?.dataset.chapter1RoyalOrderProgress;
    delete els.shell?.dataset.chapter1RoyalOrderTitle;
    delete els.shell?.dataset.chapter1RoyalOrderResult;
    delete els.shell?.dataset.chapter1RoyalCrestAward;
    delete els.shell?.dataset.chapter1RoyalCrestCount;
    delete els.shell?.dataset.chapter1RoyalOrderMilestone;
    delete els.shell?.dataset.chapter1HotGuide;
    lastChapter1ArrivalId = "";
  }

  function chapter1RoyalOrderProgress(bossDefeated = false) {
    return chapter1Flow.royalReplayProgress(state.chapter1RoyalOrderId, {
      preparedCount: state.chapter1PreparedAllies.length,
      readBreaks: state.chapter1RunReadBreaks,
      strongLands: state.chapter1RunStrongLands,
      normalSpins: state.chapter1RunNormalSpins,
      bossAttempts: state.chapter1BossAttempt,
      bossDefeated: bossDefeated,
    });
  }

  function announceRoyalOrderMilestone(beforeProgress, afterProgress) {
    const milestone = chapter1Flow.royalReplayMilestone(beforeProgress, afterProgress);
    if (!milestone) return null;
    window.clearTimeout(royalOrderMilestoneTimer);
    royalOrderMilestoneText = milestone.text;
    delete els.shell.dataset.chapter1RoyalOrderMilestone;
    void els.featureName.offsetWidth;
    els.shell.dataset.chapter1RoyalOrderMilestone = milestone.kind;
    els.resultAnnouncer.textContent = milestone.text;
    addLog("ROYAL ORDER", milestone.text);
    audio.cue(["warning", "lost"].includes(milestone.kind) ? "orderWarning" : "orderProgress");
    updateHud();
    royalOrderMilestoneTimer = window.setTimeout(function () {
      royalOrderMilestoneTimer = 0;
      royalOrderMilestoneText = "";
      delete els.shell.dataset.chapter1RoyalOrderMilestone;
      updateHud();
    }, 1800);
    return milestone;
  }

  function chapter1ClearCount(sourceProfile = profile) {
    const recorded = Math.max(0, Number(sourceProfile?.stats?.chapter1Clears) || 0);
    const alreadyCleared = collectionEconomy.routeStatus(sourceProfile).boss.claimed.includes("treasure");
    return Math.max(recorded, alreadyCleared ? 1 : 0);
  }

  function restartChapter1FromGallery() {
    if (state.spinning || state.transitioning || state.bossResolutionPending) return false;
    // Capture the chosen goal before resetting the completed run. Selection
    // changes intent only; it cannot grant a crest, wallet value or better odds.
    const replayOrder = nextChapter1ReplayOrder();
    stopTreasureResolutionFlow();
    clearTimeout(autoTimer);
    state.auto = false;
    state.stage = 1;
    state.currentBoss = 0;
    state.phase = "normal";
    state.sceneMode = "explore";
    state.sceneSpins = 0;
    state.adventureStep = 0;
    state.orb = 0;
    state.freeSpin = false;
    state.bonusGames = 0;
    state.bonusOrigin = "";
    state.bonusStock = 0;
    state.bossBattle = false;
    state.bossResolutionPending = false;
    state.bossTurns = 0;
    state.bossPartyCount = 0;
    state.bossStageId = "";
    state.bossHp = economyRules.boss.initialHp;
    state.trialType = "";
    state.trialSpins = 0;
    state.trialScore = 0;
    state.training = 0;
    state.allies = economyRules.adventure.alliesInitial;
    state.enemiesToBonus = economyRules.adventure.enemiesToBossInitial;
    state.panyuStreak = 0;
    state.nearMiss = 0;
    state.combo = 0;
    resetChapter1Progress();
    const order = replayOrder;
    chapter1ReplayChoice = "";
    state.chapter1RoyalOrderId = order.id;
    els.shell.dataset.chapter1RoyalOrder = order.id;
    resetChapter1PokerTable();
    lastSceneSignature = "";
    window.MimiCasinoLoop?.goTo?.(0);
    window.MimiCasinoLoop?.resume?.();
    showView("slot");
    addLog("ROYAL REPLAY", "CHAPTER 1");
    return true;
  }

  function currentTreasureBossAdvantage(baseDamage = 0, attackActor = "mimi") {
    return chapter1Flow.bossAdvantage({
      preparedAllies: state.chapter1PreparedAllies,
      resolveLevel: state.chapter1ResolveLevel,
      baseDamage: baseDamage,
      attackActor: attackActor,
    });
  }

  function usesChapter1CommandSurface() {
    return document.body.hasAttribute("data-release-status");
  }

  function announceChapter1Opponent() {
    // The persistent Dragon Quest-style command window belongs to the V5
    // desktop shell. The preserved legacy entry shares this engine but does
    // not expose that visible input surface, so it must keep its original
    // immediate-SPIN behaviour.
    if (!usesChapter1CommandSurface()) return false;
    const query = new URLSearchParams(window.location.search);
    const loopback = ["localhost", "127.0.0.1", "[::1]", "::1"].includes(window.location.hostname);
    if (loopback && query.get("devtools") === "1") return false;
    if (currentView !== "slot"
      || currentStageScript().id !== "treasure"
      || state.phase !== "normal"
      || state.bossBattle
      || state.spinning
      || state.transitioning) return false;
    const opponent = currentChapter1Table();
    if (!opponent || opponent.id === lastChapter1ArrivalId) return false;
    const started = startChapter1Command(opponent);
    if (!started) return false;
    lastChapter1ArrivalId = opponent.id;
    return true;
  }

  function chapter1CommandSteps(opponent) {
    const royalCommand = chapter1Flow.royalReplayCommand(state.chapter1RoyalOrderId, opponent.id);
    return Object.freeze([
      Object.freeze({ speaker: "対戦", line: royalCommand?.encounterLine || `${opponent.name}が あらわれた！`, action: "▶ PUSH" }),
      Object.freeze({ speaker: opponent.name, line: opponent.arrivalLine, action: "▶ PUSH" }),
      Object.freeze({ speaker: "ミミ", line: royalCommand?.line || opponent.goalLine, action: "▶ SPIN" }),
    ]);
  }

  function renderChapter1Command() {
    if (!chapter1Command) return;
    const step = chapter1Command.steps[chapter1Command.index];
    els.chapterCommand.hidden = false;
    els.chapterCommand.setAttribute("aria-hidden", "false");
    els.chapterCommandSpeaker.textContent = step.speaker;
    els.chapterCommandLine.textContent = step.line;
    els.chapterCommandAction.textContent = step.action;
    els.shell.classList.add("chapter-command-active");
    els.shell.dataset.chapterCommandStep = String(chapter1Command.index + 1);
    updateButtons();
  }

  function startChapter1Command(opponent) {
    if (!opponent || chapter1Command) return false;
    stopTreasureResolutionFlow();
    clearTimeout(autoTimer);
    state.chapter1ArrivalPending = false;
    delete els.shell.dataset.chapter1ArrivalPending;
    delete els.shell.dataset.chapter1ClearedOpponent;
    updateHud();
    chapter1Command = {
      opponentId: opponent.id,
      index: 0,
      steps: chapter1CommandSteps(opponent),
    };
    state.transitioning = true;
    renderChapter1Command();
    if (state.chapter1RoyalOrderId) audio.royalOrderOpen?.(state.chapter1RoyalOrderId);
    else audio.cue("commandOpen");
    window.requestAnimationFrame(function () { els.push.focus(); });
    return true;
  }

  function advanceChapter1Command() {
    if (!chapter1Command) return false;
    if (chapter1Command.index >= chapter1Command.steps.length - 1) return false;
    chapter1Command.index += 1;
    renderChapter1Command();
    audio.cue(chapter1Command.index === chapter1Command.steps.length - 1 ? "commandReady" : "commandAdvance");
    if (chapter1Command.index === chapter1Command.steps.length - 1) {
      window.requestAnimationFrame(function () { els.spin.focus(); });
    }
    return true;
  }

  function clearChapter1Command() {
    if (!chapter1Command) return false;
    chapter1Command = null;
    els.chapterCommand.hidden = true;
    els.chapterCommand.setAttribute("aria-hidden", "true");
    els.chapterCommandSpeaker.textContent = "";
    els.chapterCommandLine.textContent = "";
    els.chapterCommandAction.textContent = "";
    els.shell.classList.remove("chapter-command-active");
    delete els.shell.dataset.chapterCommandStep;
    state.transitioning = false;
    updateButtons();
    return true;
  }

  function showChapter1OpponentVisual(opponent, mode = "base") {
    if (!opponent || !els.casinoOpponent) return;
    els.shell.dataset.chapter1DisplayOpponent = opponent.id;
    els.casinoOpponent.src = mode === "action" ? opponent.actionAsset : opponent.baseAsset;
    els.casinoOpponent.alt = opponent.name;
    els.casinoOpponent.hidden = false;
  }

  function stageChapter1TableResult(opponent, options = {}) {
    showChapter1OpponentVisual(opponent, "action");
    const damage = Math.max(0, Number(options.damage) || 0);
    els.shell.dataset.chapter1TableDamage = String(damage);
    els.shell.dataset.chapter1TableHeat = String(Math.max(1, Math.min(5, Number(options.heat) || 1)));
    els.shell.dataset.chapter1TableStack = String(Math.max(0, Number(options.stack) || 0));
    const damageValue = els.shell.querySelector?.(".casino-table-damage strong");
    if (damageValue) damageValue.textContent = `-${damage}`;
    paintChapter1PokerStackDelta(options);
    if (options.readBreak) {
      const playfield = els.shell.querySelector?.(".casino-table-playfield");
      const verdict = playfield?.querySelector(".casino-poker-result-verdict");
      if (verdict) verdict.textContent = "READ BREAK · WIN";
      if (playfield) {
        playfield.dataset.pokerOutcome = "mimi";
        playfield.dataset.pokerAction = "mimi-takes-pot";
      }
      els.shell.dataset.chapter1PokerOutcome = "mimi";
      els.shell.dataset.chapter1PokerAction = "mimi-takes-pot";
    }
    if (!options.cleared) return;
    els.shell.dataset.chapter1ClearedOpponent = opponent.id;
    const awardedPortrait = els.shell.querySelector?.(".casino-bet-coin-award img");
    if (awardedPortrait) awardedPortrait.src = opponent.baseAsset;
    const awardedSlot = els.treasureStock?.querySelector?.(`[data-opponent="${opponent.id}"]`);
    if (awardedSlot) awardedSlot.classList.add("awarding");
  }

  function pulseChapter1TableProgress(turn) {
    if (!turn || turn.damage <= 0) return;
    paintChapter1PokerStackDelta({ damage: turn.damage, stack: state.chapter1OpponentStack, readBonusDamage: turn.readBonusDamage });
    if (isMotionReduced()) return;
    const playfield = els.shell.querySelector?.(".casino-table-playfield");
    els.shell.dataset.chapter1TableHeat = String(Math.max(1, Math.min(5, Number(turn.heat) || 1)));
    els.casinoOpponent.classList.remove("is-poked");
    els.casinoTableHud.classList.remove("is-poked");
    playfield?.classList.remove("is-poked");
    void els.casinoTableHud.offsetWidth;
    els.casinoOpponent.classList.add("is-poked");
    els.casinoTableHud.classList.add("is-poked");
    playfield?.classList.add("is-poked");
    els.casinoTableHud.addEventListener("animationend", function clearTablePoke() {
      els.casinoOpponent.classList.remove("is-poked");
      els.casinoTableHud.classList.remove("is-poked");
      playfield?.classList.remove("is-poked");
      delete els.shell.dataset.chapter1TableHeat;
    }, { once: true });
  }

  function pulseChapter1ReadAssist(readAssist) {
    if (!readAssist?.triggered) return;
    const playfield = els.shell.querySelector?.(".casino-table-playfield");
    const vfx = els.shell.querySelector?.(".casino-table-vfx");
    const banner = vfx?.querySelector(".casino-read-ready-banner");
    const delta = playfield?.querySelector(".casino-poker-result-delta");
    if (delta) delta.textContent = "見切り READY · NEXT SPIN BREAK";
    message("見切り READY。相手の癖を見切った。次の決着SPINでSTACKを1削る。");
    addLog("READ READY", `${currentChapter1Table().name} / NEXT SPIN BREAK`);
    if (isMotionReduced()) return;
    els.casinoTableHud.classList.remove("is-read-ready");
    playfield?.classList.remove("is-read-ready");
    vfx?.classList.remove("is-read-ready");
    void els.casinoTableHud.offsetWidth;
    els.casinoTableHud.classList.add("is-read-ready");
    playfield?.classList.add("is-read-ready");
    vfx?.classList.add("is-read-ready");
    (banner || els.casinoTableHud).addEventListener("animationend", function clearReadReadyPulse() {
      els.casinoTableHud.classList.remove("is-read-ready");
      playfield?.classList.remove("is-read-ready");
      vfx?.classList.remove("is-read-ready");
    }, { once: true });
  }

  function presentationHeatContext(mode = flagMode(), flag = "none") {
    return {
      phase: state.phase,
      mode,
      flag,
      bossBattle: state.bossBattle,
      orb: state.orb,
      nearMiss: state.nearMiss,
      treasure: state.treasure,
      enemiesToBonus: state.enemiesToBonus,
      combo: state.combo,
      panyuStreak: state.panyuStreak,
      trialScore: state.trialScore,
      trialSuccessScore: economyRules.trial.successScore,
      bossPartyCount: state.bossPartyCount,
    };
  }

  function currentPresentationHeat(flag = "none", mode = flagMode()) {
    return presentationHeat.snapshot(presentationHeatContext(mode, flag));
  }

  function chapter1RoleSignature(flag = "none") {
    const machine = chapter1Flow.MACHINE_PRESENTATION_BLUEPRINT;
    const safeFlag = machine && Object.hasOwn(machine.flags, flag) ? flag : "none";
    return Object.freeze({
      flag: safeFlag,
      signature: machine?.flags?.[safeFlag]?.normal?.signature || machine?.flags?.none?.normal?.signature || {},
    });
  }

  const CHAPTER1_READ_TELL_COPY = Object.freeze({
    rico: Object.freeze([
      "リコ先輩の　視線を　おぼえた。",
      "リコ先輩が　札をそろえる間を　つかんだ。",
      "リコ先輩の　勝負前の癖が　見えてきた！",
    ]),
    polka: Object.freeze([
      "ポルカの　チップに触れる指を　見ている。",
      "ポルカの　強気な間を　つかんだ。",
      "ポルカの　ブラフの癖が　見えてきた！",
    ]),
    selina: Object.freeze([
      "セリナの　盤面を追う目を　見ている。",
      "セリナが　守りに入る間を　つかんだ。",
      "セリナの　罠の癖が　見えてきた！",
    ]),
    grano: Object.freeze([
      "グラーノの　チップを数える手を　見ている。",
      "グラーノが　賭けを決める間を　つかんだ。",
      "グラーノの　勝負勘の癖が　見えてきた！",
    ]),
  });

  // Character reactions consume the settled hand only; they never draw a flag
  // or ask the player to leave the cabinet controls.
  const CHAPTER1_RIVAL_REMARKS = Object.freeze({
    rico: ['急がなくていい。まずは私の目を見て。','札をそろえる間まで見ていたのね。','次の一手は、もう読まれているかしら。'],
    polka: ['そのチップ、まだ動かさないの？ 私は行くよ！','強気な顔も、勝負のうちでしょ？','そこまで見られたら、笑ってごまかせないね。'],
    selina: ['盤面は同じ。でも、見ている場所は違う。','守りに入る瞬間を、見つけたのね。','罠を読む相手との勝負は、退屈しない。'],
    grano: ['一枚ずつ数えましょう。急ぐ取引は高くつきます。','勘定の間まで、お見通しですかな。','見切った上で席に残る。いい判断ですな。'],
  });
  const CHAPTER1_RIVAL_HIT_REMARKS = Object.freeze({
    rico: ['今の一手は、あなたの勝ち。落ち着いて揃えたわね。','残る守りは一枚。最後まで、私の目を見て。'],
    polka: ['そこを押さえる？ ……やるじゃん！','あと一枚でも、ブラフは降りないよ！'],
    selina: ['今の一手で、守りを崩されたね。','残る守りは一枚。次は、どこを見る？'],
    grano: ['その一手は計算に入れませんでしたな。','最後の一枚です。高い取引になりますぞ。'],
  });
  function showChapter1RivalRemark(opponent, turn, readAssist) {
    const lines = CHAPTER1_RIVAL_REMARKS[opponent.id];
    if (!lines || turn.fullScene) return;
    // READ READY owns Mimi's promise, including when the last quiet reply
    // is still on the cabinet at this settlement boundary.
    if (turn.result === 'miss' && readAssist.ready) {
      clearChapter1ReelReaction();
      return;
    }
    const beat = Math.min(2, Math.max(0, (readAssist.streak || 1) - 1));
    const quote = turn.result === 'replay'
      ? ({rico:'同じ席で、もう一手。',polka:'もう一回？ いいよ、付き合う！',selina:'決着を急がず、盤面を覚えて。',grano:'次のお代は不要ですな。'}[opponent.id])
      : turn.damage > 0 ? CHAPTER1_RIVAL_HIT_REMARKS[opponent.id][state.chapter1OpponentStack === 1 ? 1 : 0]
      : lines[beat];
    const status = state.chapter1ReadReady ? 'READ READY · 次の非REPLAYで見切る'
      : turn.result === 'miss' ? `観察 ${readAssist.streak}/${chapter1Flow.READ_ASSIST.missThreshold} · ${CHAPTER1_READ_TELL_COPY[opponent.id][Math.max(0,beat)]}`
      : turn.result === 'replay' ? 'REPLAY · 次回BET 0' : `相手STACK −${turn.damage}`;
    const reaction = els.shell.querySelector('.casino-reel-reaction');
    if (reaction) {
      reaction.dataset.rivalReply = 'true';
      reaction.dataset.reply = quote;
      reaction.dataset.replySpeaker = opponent.name;
    }
    message(`「${quote}」 ${status}`, opponent.name);
  }

  function pulseChapter1ReadProgress(readAssist, turn, opponent) {
    if (!readAssist || turn?.result !== "miss" || readAssist.ready || readAssist.streak <= 0) return;
    const streak = Math.max(1, Math.min(chapter1Flow.READ_ASSIST.missThreshold - 1, Number(readAssist.streak) || 1));
    const tell = (CHAPTER1_READ_TELL_COPY[opponent?.id] || CHAPTER1_READ_TELL_COPY.rico)[streak - 1];
    const tierLabel = ["観察中", "癖を発見", "見切り寸前"][streak - 1];
    const playfield = els.shell.querySelector?.(".casino-table-playfield");
    const delta = playfield?.querySelector(".casino-poker-result-delta");
    if (delta) delta.textContent = `${tierLabel} · 観察 ${streak}/${chapter1Flow.READ_ASSIST.missThreshold}`;
    if (els.speaker) els.speaker.textContent = "ミミ";
    message(`ミミは　${tell}　観察 ${streak}/${chapter1Flow.READ_ASSIST.missThreshold}`);
    if (isMotionReduced()) return;
    els.shell.classList.remove("is-chapter1-read-building");
    els.casinoTableHud.classList.remove("is-read-building");
    playfield?.classList.remove("is-read-building");
    void els.casinoTableHud.offsetWidth;
    els.shell.classList.add("is-chapter1-read-building");
    els.casinoTableHud.classList.add("is-read-building");
    playfield?.classList.add("is-read-building");
    els.casinoTableHud.addEventListener("animationend", function clearReadBuildPulse(event) {
      if (event.target !== els.casinoTableHud) return;
      els.shell.classList.remove("is-chapter1-read-building");
      els.casinoTableHud.classList.remove("is-read-building");
      playfield?.classList.remove("is-read-building");
      els.casinoTableHud.removeEventListener("animationend", clearReadBuildPulse);
    });
  }

  function syncChapter1RoleSignature(flag = "none", stopCount = 0, outcome = "pending") {
    if (currentStageScript().id !== "treasure" || state.phase !== "normal") return;
    const role = chapter1RoleSignature(flag);
    const signature = role.signature;
    const vfx = els.shell.querySelector?.(".casino-table-vfx");
    const image = vfx?.querySelector?.(".casino-role-symbol");
    els.shell.dataset.chapter1RoleFlag = role.flag;
    els.shell.dataset.chapter1RoleMotion = String(signature.motion || "void-breathe");
    els.shell.dataset.chapter1RoleStop = String(Math.max(0, Math.min(3, Number(stopCount) || 0)));
    els.shell.dataset.chapter1RoleOutcome = String(outcome || "pending");
    els.shell.style.setProperty("--chapter1-role-accent", String(signature.accent || "#9ec8d5"));
    if (image && signature.asset && image.getAttribute("src") !== signature.asset) image.src = signature.asset;
  }

  function settleChapter1RoleSignature(outcome, landed) {
    if (currentStageScript().id !== "treasure" || state.phase !== "normal") return;
    const vfx = els.shell.querySelector?.(".casino-table-vfx");
    const signature = vfx?.querySelector?.(".casino-role-signature");
    const roleOutcome = outcome === "replay" ? "push" : landed ? "hit" : "miss";
    syncChapter1RoleSignature(currentSpin?.flag || state.flag || "none", 3, roleOutcome);
    if (!vfx || !signature || isMotionReduced()) return;
    vfx.classList.remove("is-role-result");
    void signature.offsetWidth;
    vfx.classList.add("is-role-result");
    signature.addEventListener("animationend", function clearRoleResult(event) {
      if (event.target !== signature) return;
      vfx.classList.remove("is-role-result");
      signature.removeEventListener("animationend", clearRoleResult);
    });
  }

  const CHAPTER1_POKER_STREETS = Object.freeze(["flop", "turn", "river"]);

  function clearChapter1StopDeals() {
    window.clearTimeout(chapter1DealTimer);
    chapter1DealTimer = 0;
    els.stopButtons.forEach(function (button) {
      button.classList.remove("is-dealt", "is-deal-resolving");
      delete button.dataset.dealStreet;
      const label = button.querySelector(".stop-deal-label");
      if (label) label.textContent = "";
    });
    const playfield = els.shell.querySelector?.(".casino-table-playfield");
    playfield?.classList.remove("is-deal-resolving");
    if (playfield) delete playfield.dataset.pokerDeal;
    els.shell.classList.remove("is-chapter1-deal-resolving");
    delete els.shell.dataset.chapter1PokerDeal;
  }

  function commitChapter1StopDeal(reelCol, stopCount) {
    if (currentStageScript().id !== "treasure" || state.phase !== "normal") return;
    const street = CHAPTER1_POKER_STREETS[Math.max(0, Math.min(2, Number(stopCount) - 1))];
    const button = els.stopButtons[reelCol];
    const playfield = els.shell.querySelector?.(".casino-table-playfield");
    if (!street || !button || !playfield) return;

    const label = button.querySelector(".stop-deal-label");
    button.dataset.dealStreet = street;
    if (label) label.textContent = street.toUpperCase();
    button.classList.add("is-dealt");
    button.classList.remove("is-deal-resolving");
    playfield.dataset.pokerDeal = street;
    playfield.classList.remove("is-deal-resolving");
    els.shell.dataset.chapter1PokerDeal = street;
    els.shell.classList.remove("is-chapter1-deal-resolving");
    if (!usesChapter1CommandSurface()) void playfield.offsetWidth;
    button.classList.add("is-deal-resolving");
    playfield.classList.add("is-deal-resolving");
    els.shell.classList.add("is-chapter1-deal-resolving");
    window.clearTimeout(chapter1DealTimer);
    chapter1DealTimer = window.setTimeout(function clearDealPulse() {
      chapter1DealTimer = 0;
      button.classList.remove("is-deal-resolving");
      playfield.classList.remove("is-deal-resolving");
      els.shell.classList.remove("is-chapter1-deal-resolving");
    }, 640);
  }

  function syncChapter1SpinHeat(snapshot) {
    if (!snapshot || currentStageScript().id !== "treasure" || snapshot.phase !== "normal") return;
    els.shell.dataset.chapter1SpinActive = "true";
    els.shell.dataset.gamePhase = snapshot.phase;
    els.shell.dataset.phaseHeat = String(snapshot.heat);
    els.shell.dataset.phaseCue = snapshot.cue;
    els.shell.dataset.phaseTone = snapshot.tone;
    els.shell.querySelector?.(".casino-table-vfx")?.classList.remove("is-role-result");
    syncChapter1RoleSignature(currentSpin?.flag || state.flag || "none", 0, "pending");
  }

  function paintChapter1PokerCard(element, card, faceUp) {
    if (!element) return;
    const rank = Array.isArray(card) ? String(card[0] || "") : "";
    const suit = Array.isArray(card) ? String(card[1] || "") : "";
    const signature = faceUp ? `${rank}${suit}` : "back";
    const changed = element.dataset.cardSignature !== signature;
    element.dataset.cardSignature = signature;
    element.classList.toggle("is-face-up", Boolean(faceUp && rank && suit));
    element.classList.toggle("is-red", faceUp && (suit === "♥" || suit === "♦"));
    const rankNode = element.querySelector(".rank");
    const suitNode = element.querySelector(".suit");
    if (rankNode) rankNode.textContent = faceUp ? rank : "";
    if (suitNode) suitNode.textContent = faceUp ? suit : "";
    if (!changed || isMotionReduced()) return;
    element.classList.remove("is-new");
    if (!usesChapter1CommandSurface()) void element.offsetWidth;
    element.classList.add("is-new");
  }

  function clearChapter1PokerResult(playfield) {
    if (!playfield) return;
    playfield.querySelectorAll(".casino-poker-result-trigger, .casino-poker-result-hand, .casino-poker-result-verdict, .casino-poker-result-delta")
      .forEach(function (element) { element.textContent = ""; });
    delete playfield.dataset.pokerOutcome;
    delete els.shell.dataset.chapter1PokerOutcome;
    els.shell.classList.remove("is-chapter1-showdown");
  }

  function paintChapter1PokerResult(playfield, preview, outcome, landed) {
    if (!playfield || !preview || outcome === "pending") return;
    const potOwner = outcome === "replay"
      ? "push"
      : outcome === "win" || outcome === "jackpot" ? "mimi" : "rival";
    const symbol = core.SYMBOL_BY_ID.get(preview.flag);
    const trigger = playfield.querySelector(".casino-poker-result-trigger");
    const hand = playfield.querySelector(".casino-poker-result-hand");
    const verdict = playfield.querySelector(".casino-poker-result-verdict");
    const delta = playfield.querySelector(".casino-poker-result-delta");
    if (trigger) trigger.textContent = outcome === "replay"
      ? "REEL · REPLAY"
      : landed
        ? `REEL · ${symbol?.name || "小役"} 成立`
        : potOwner === "mimi" ? "REEL · 別ライン配当" : "REEL · 配当なし";
    if (hand) hand.textContent = `HAND · ${preview.label}`;
    if (verdict) verdict.textContent = potOwner === "mimi"
      ? "ミミ WIN"
      : potOwner === "push" ? "PUSH" : "相手 WIN";
    if (delta) delta.textContent = potOwner === "mimi" ? "POT獲得" : "STACK ±0";
    playfield.dataset.pokerOutcome = potOwner;
    els.shell.dataset.chapter1PokerOutcome = potOwner;
  }

  function paintChapter1PokerStackDelta(options = {}) {
    const playfield = els.shell.querySelector?.(".casino-table-playfield");
    const delta = playfield?.querySelector(".casino-poker-result-delta");
    if (!delta) return;
    const damage = Math.max(0, Number(options.damage) || 0);
    const stack = Math.max(0, Number(options.stack) || 0);
    if (damage <= 0) {
      delta.textContent = "STACK ±0";
      return;
    }
    const readSuffix = Number(options.readBonusDamage) > 0 ? " · READ +1" : "";
    const potPrefix = playfield?.dataset.pokerOutcome === "mimi" ? "POT獲得 · " : "";
    delta.textContent = options.cleared
      ? `${potPrefix}STACK -${damage} → 0 · BET COIN${readSuffix}`
      : `${potPrefix}STACK -${damage} → ${stack}${readSuffix}`;
  }

  function syncChapter1PokerTable(stopCount, outcome = "pending", settledLanded = false) {
    if (currentStageScript().id !== "treasure" || state.phase !== "normal") return;
    const playfield = els.shell.querySelector?.(".casino-table-playfield");
    if (!playfield || typeof chapter1Flow.tablePokerPreview !== "function") return;
    const opponent = currentChapter1Table();
    const landed = stopCount >= 3 && Boolean(settledLanded);
    const preview = chapter1Flow.tablePokerPreview({
      flag: currentSpin?.flag || state.flag || "none",
      opponentId: opponent.id,
      stopCount: stopCount,
      landed: landed,
      outcome: outcome,
      variantKey: currentSpin?.id || 0,
    });
    const holeCards = Array.from(playfield.querySelectorAll(".casino-hole-card"));
    const boardCards = Array.from(playfield.querySelectorAll(".casino-board-card"));
    holeCards.forEach(function (element, index) {
      paintChapter1PokerCard(element, preview.hole[index], true);
    });
    boardCards.forEach(function (element, index) {
      paintChapter1PokerCard(element, preview.community[index], index < preview.community.length);
    });
    const role = playfield.querySelector(".casino-poker-role");
    if (role) {
      const streetLabel = {
        preflop: "HOLE",
        flop: "FLOP",
        turn: "TURN",
        river: "RIVER",
      }[preview.street] || "HAND";
      role.textContent = `${outcome === "pending" ? streetLabel : "SHOWDOWN"} · ${preview.label}`;
    }
    const action = playfield.querySelector(".casino-poker-action");
    if (action) {
      action.textContent = preview.actionLabel;
    }
    playfield.dataset.pokerStreet = preview.street;
    playfield.dataset.pokerTexture = preview.texture;
    playfield.dataset.pokerVariant = String(preview.variantIndex || 0);
    playfield.dataset.pokerPersonality = preview.personality;
    playfield.dataset.pokerAction = preview.action;
    els.shell.dataset.chapter1PokerStreet = preview.street;
    els.shell.dataset.chapter1PokerAction = preview.action;
    els.shell.dataset.chapter1PokerPersonality = preview.personality;
    if (stopCount <= 0) {
      clearChapter1PokerResult(playfield);
      clearChapter1StopDeals();
    }
    else if (stopCount >= 3) paintChapter1PokerResult(playfield, preview, outcome, landed);
    syncChapter1RoleSignature(currentSpin?.flag || state.flag || "none", stopCount, outcome);
    if (outcome === "pending") syncChapter1ReelReaction(stopCount);
    if (stopCount <= 0 || (stopCount >= 3 && outcome !== "pending") || isMotionReduced()) return;
    playfield.classList.remove("is-action-resolving");
    if (!usesChapter1CommandSurface()) void playfield.offsetWidth;
    playfield.classList.add("is-action-resolving");
    playfield.addEventListener("animationend", function clearPokerAction(event) {
      if (event.target !== playfield) return;
      playfield.classList.remove("is-action-resolving");
      playfield.removeEventListener("animationend", clearPokerAction);
    });
  }

  function resetChapter1PokerTable() {
    clearChapter1ReelReaction();
    const playfield = els.shell.querySelector?.(".casino-table-playfield");
    if (!playfield) return;
    playfield.querySelectorAll(".casino-poker-card").forEach(function (element) {
      paintChapter1PokerCard(element, null, false);
    });
    const role = playfield.querySelector(".casino-poker-role");
    const action = playfield.querySelector(".casino-poker-action");
    if (role) role.textContent = "";
    if (action) action.textContent = "";
    playfield.dataset.pokerStreet = "idle";
    playfield.dataset.pokerTexture = "dry";
    playfield.dataset.pokerAction = "idle";
    playfield.dataset.pokerPersonality = chapter1Flow.TABLE_POKER_PERSONALITIES[currentChapter1Table().id]?.id || "composed";
    clearChapter1PokerResult(playfield);
    clearChapter1StopDeals();
    playfield.classList.remove("is-action-resolving", "is-showdown-resolving", "is-tenpai", "is-tenpai-hot", "is-read-building");
    els.shell.classList.remove("is-chapter1-read-building");
    els.casinoTableHud.classList.remove("is-read-building");
    els.shell.dataset.chapter1PokerStreet = "idle";
    els.shell.dataset.chapter1PokerAction = "idle";
    els.shell.dataset.chapter1PokerPersonality = playfield.dataset.pokerPersonality;
  }

  function settleChapter1PokerTable(outcome, landed) {
    if (currentStageScript().id !== "treasure" || state.phase !== "normal") return;
    syncChapter1PokerTable(3, outcome, landed);
    const playfield = els.shell.querySelector?.(".casino-table-playfield");
    if (!playfield) return;
    const potOwner = outcome === "replay" ? "push" : outcome === "win" || outcome === "jackpot" ? "mimi" : "rival";
    playfield.dataset.pokerOutcome = potOwner;
    els.shell.dataset.chapter1PokerOutcome = potOwner;
    playfield.classList.remove("is-showdown-resolving");
    els.shell.classList.remove("is-chapter1-showdown");
    if (isMotionReduced()) return;
    void playfield.offsetWidth;
    playfield.classList.add("is-showdown-resolving");
    els.shell.classList.add("is-chapter1-showdown");
    const role = playfield.querySelector(".casino-poker-role");
    role?.addEventListener("animationend", function clearPokerShowdown(event) {
      if (event.target !== role) return;
      playfield.classList.remove("is-showdown-resolving");
      els.shell.classList.remove("is-chapter1-showdown");
      role.removeEventListener("animationend", clearPokerShowdown);
    });
  }

  // One reel-owned acting beat, not a new scene, wait, or lottery. A visible
  // two-symbol chance is only called out when the two settled reels really
  // align on a payline; an internal flag alone never promises a win.
  function clearChapter1ReelReaction() {
    const reaction = els.shell.querySelector(".casino-reel-reaction");
    if (!reaction) return;
    reaction.dataset.beat = "idle";
    reaction.dataset.focus = "false";
    delete reaction.dataset.rivalReply;
    delete reaction.dataset.reply;
    delete reaction.dataset.replySpeaker;
    reaction.querySelector('small').textContent = 'ミミ';
    reaction.querySelector("strong").textContent = "";
    delete els.shell.dataset.chapter1ReactionFocus;
  }

  function syncChapter1ReelReaction(stopCount, result = null) {
    if (currentStageScript().id !== "treasure" || state.phase !== "normal") return;
    const reaction = els.shell.querySelector(".casino-reel-reaction");
    if (!reaction) return;
    const flag = currentSpin?.flag || state.flag || "none";
    const symbol = core.SYMBOL_BY_ID.get(flag);
    const rare = ["grape", "watermelon", "bar", "seven_blue", "seven_red"].includes(flag);
    let beat = "quiet";
    let focus = false;
    let line = "";
    if (result) {
      if (result.replayHit) {
        beat = "replay";
        line = "もう一回！ 次はBETなしだよ。";
      } else if (result.payout > 0) {
        beat = "win";
        focus = true;
        line = result.rescuedSymbol
          ? `ぱにゅ！ 取り戻したよ！ ＋${result.payout}`
          : `やった！ ＋${result.payout} WIN！`;
      } else if (state.chapter1ReadReady) {
        beat = "read";
        focus = true;
        line = "癖がわかった！ 次の勝負で崩すよ！";
      } else if (els.shell.dataset.chapter1PokerOutcome === "mimi") {
        // READ BREAK can win a table exchange without a reel payout.
        beat = "win";
        focus = true;
        line = "見切った！ 相手の守りを崩したよ！";
      } else {
        beat = "miss";
        line = state.chapter1ReadStreak >= 2
          ? "……少しずつ、相手の癖が見えてきた。"
          : "ここは相手の勝ち。次、いこう！";
      }
    } else if (rare || flag === "cherry" || flag === "bell") {
      beat = `stop-${Math.max(0, Math.min(3, stopCount))}`;
      focus = rare;
      line = `${rare ? "……来た！ " : ""}${symbol?.name || "図柄"}を狙って！`;
      if (rare && stopCount === 1) line = "まだ、最後まで見届けよう！";
      if (rare && stopCount === 2) {
        const stopped = reels.filter(reel => reel.phase === "stopped").map(reel => reel.col);
        const hasChance = stopped.length === 2 && paylines.some(payline => (
          payline.cells.filter(([col]) => stopped.includes(col))
            .every(([col, row]) => state.grid[col][row].id === flag)
        ));
        line = hasChance ? "あとひとつ……お願い！" : "最後の一枚、どうなる……？";
      }
      if (stopCount === 3) line = "……勝負！";
    } else if (state.chapter1ReadReady) {
      beat = "read";
      focus = true;
      line = "この癖、見切ったよ！";
    } else if (state.chapter1NormalChance?.remaining > 0) {
      const approaching = state.chapter1NormalChance.remaining === 1;
      beat = approaching ? "chance-close" : "chance-notice";
      focus = approaching;
      line = approaching ? "……あの光、さっきより強い！" : "あれ……VIP卓から、合図？";
    }
    if (result && reaction.dataset.rivalReply === 'true') {
      line = '「'+reaction.dataset.reply+'」';
      focus = false;
    }
    reaction.querySelector('small').textContent = result && reaction.dataset.rivalReply === 'true' ? reaction.dataset.replySpeaker : 'ミミ';
    reaction.dataset.beat = beat;
    reaction.dataset.focus = String(focus);
    els.shell.dataset.chapter1ReactionFocus = String(focus);
    const text = reaction.querySelector("strong");
    if (text.textContent !== line) text.textContent = line;
  }

  function settleChapter1SpinHeat(outcome, landed = false, spinPhase = state.phase) {
    const wasActive = els.shell.dataset.chapter1SpinActive === "true";
    els.shell.dataset.chapter1SpinActive = "false";
    if (!wasActive || currentStageScript().id !== "treasure") return;
    settleChapter1RoleSignature(outcome, landed);
    // A Treasure boss result already receives the same settled role through
    // roleBoss(), followed by the authored HIT/ATTACK/DEFEAT cue. Replaying the
    // normal-table role result here made one boss settlement own two competing
    // semantic result signatures at the same instant.
    if (spinPhase !== "battle") {
      audio.roleResult?.(currentSpin?.flag || state.flag || "none", outcome, landed);
    }
    const playfield = els.shell.querySelector?.(".casino-table-playfield");
    playfield?.classList.remove("is-tenpai", "is-tenpai-hot");
    if (!playfield || (outcome !== "miss" && outcome !== "replay")) return;
    playfield.classList.remove("is-neutral-settling");
    void playfield.offsetWidth;
    playfield.classList.add("is-neutral-settling");
    playfield.addEventListener("animationend", function clearNeutralTableSettle(event) {
      if (event.target !== playfield) return;
      playfield.classList.remove("is-neutral-settling");
      playfield.removeEventListener("animationend", clearNeutralTableSettle);
    });
  }

  function stageChapter1TableTenpai(hot) {
    if (currentStageScript().id !== "treasure" || state.phase !== "normal") return false;
    // A two-reel tenpai belongs to the reel/table channel. Do not turn this
    // routine stop-control cue into a full upper-LCD narrative interruption.
    els.chanceOverlay.classList.remove("show", "hot");
    const playfield = els.shell.querySelector?.(".casino-table-playfield");
    if (!playfield) return true;
    playfield.classList.remove("is-tenpai", "is-tenpai-hot");
    void playfield.offsetWidth;
    playfield.classList.add("is-tenpai");
    if (hot) playfield.classList.add("is-tenpai-hot");
    return true;
  }
  const profileOptions = { items: shopItems, defaultOwned: content.defaultOwned };
  const profile = profileStore.load(profileOptions);
  let profileSavePending = false;
  const staySurface = document.querySelector("[data-resort-stay]");
  let stayUi = null;
  let staySessionStart = null;
  let savedProfileRaw = readStoredProfile();
  const collectionSessionId = window.crypto?.randomUUID?.()
    || `page-${Date.now().toString(36)}-${Math.floor(performance.timeOrigin || 0).toString(36)}`;
  const motionPreference = window.matchMedia?.("(prefers-reduced-motion: reduce)") || null;

  // ゲーム結果用の乱数を粒子・紙吹雪の Math.random() から分離する。
  // 演出量を変えても次ゲームの内部抽選が変わらず、seed付き回帰もできる。
  let gameRngState = (() => {
    const seed = new Uint32Array(1);
    window.crypto?.getRandomValues?.(seed);
    return seed[0] || 0x6d2b79f5;
  })();

  function setGameSeed(value) {
    gameRngState = (Number(value) >>> 0) || 0x6d2b79f5;
    return gameRngState;
  }

  function gameRandom() {
    let value = gameRngState;
    value ^= value << 13;
    value ^= value >>> 17;
    value ^= value << 5;
    gameRngState = value >>> 0;
    return gameRngState / 0x100000000;
  }

  function isMotionReduced() {
    return profile.settings.motion === "reduced" || Boolean(motionPreference?.matches);
  }

  const els = window.MimiDomContract.resolve(document);

  let safetyTimer = 0;
  let safetyAutoDraining = false;
  let settlementSafetyTimer = 0;
  let autoTimer = 0;
  let sceneNoticeTimer = 0;
  let adventureEventTimer = 0;
  let messageTimer = 0;
  let winCountFrame = 0;
  let lastSceneSignature = "";
  let currentView = "title";
  let chapter1ReplayChoice = "";
  let lastChapter1ArrivalId = "";
  let chapter1Command = null;
  let royalOrderMilestoneTimer = 0;
  let chapter1DealTimer = 0;
  let chapter1RiverHoldRemaining = 0;
  let royalOrderMilestoneText = "";
  let chapter1HotGuideMode = "";
  let chapter1HotGuideHits = 0;
  let creditRescueClaimed = false;
  let currentShopTab = "costume";
  let currentSpin = null;
  let bossVisualEpoch = 0;
  let treasureResolutionFlow = null;
  const bossImagePreloads = new Map();
  let debugSceneOverride = "";
  let helpReturnFocus = null;
  let shellModalSiblings = [];
  let reelsBuilt = false;

  function setSlotModalIsolation(open, modal) {
    const slotView = els.shell.closest('[data-view="slot"]');
    if (!slotView) return;
    if (open) {
      shellModalSiblings = Array.from(slotView.children).filter(node => node !== modal);
      shellModalSiblings.forEach(node => { node.inert = true; });
    } else {
      shellModalSiblings.forEach(node => { node.inert = false; });
      shellModalSiblings = [];
    }
  }

  function saveProfile(value = profile) {
    // Every shared-wallet write observes the same stale-tab boundary, including
    // cabinet grants. Otherwise an older tab could erase an island receipt.
    if (readStoredProfile() !== savedProfileRaw) return false;
    const saved = profileStore.save(value);
    if (saved) {
      profileSavePending = false;
      savedProfileRaw = readStoredProfile();
    }
    return saved;
  }

  function readStoredProfile() {
    try { return window.localStorage.getItem(profileStore.KEY); }
    catch (_) { return undefined; }
  }

  function transactStay(change) {
    if (readStoredProfile() !== savedProfileRaw) {
      return { ok: false, message: "別の画面で保存が更新されました。ページを読み込み直してください。" };
    }
    if (!flushPendingProfile()) return { ok: false, message: "遊技結果の保存を再試行してください。" };
    const draft = draftProfile();
    const message = change(draft);
    if (message) return { ok: false, message };
    if (!saveProfile(draft)) return { ok: false, message: "保存できませんでした。残高と品は変更していません。もう一度お試しください。" };
    commitProfile(draft);
    renderWallets();
    return { ok: true };
  }

  function draftProfile() {
    return profileStore.normalise(profileStore.serialise(profile), profileOptions);
  }

  function commitProfile(next) {
    profile.version = next.version;
    profile.coins = next.coins;
    profile.owned = next.owned;
    profile.equipped = next.equipped;
    profile.settings = next.settings;
    profile.stats = next.stats;
    profile.collection = next.collection;
    profile.stay = next.stay;
  }

  function flushPendingProfile() {
    if (!profileSavePending) return true;
    const saved = saveProfile(profile);
    if (!saved) toast("保存を再試行できません。空き容量とブラウザ設定を確認してください。");
    return saved;
  }

  function equippedItem(tab) {
    return shopItems.find(item => item.id === profile.equipped[tab]) || null;
  }

  function equippedEffect() {
    const item = equippedItem("effect");
    return item ? item.effect : "";
  }

  function currentStageScript() {
    return stageScripts[(state.stage - 1) % stageScripts.length];
  }

  function currentBossEntity() {
    return bossRoster[state.currentBoss % bossRoster.length];
  }

  function currentBossImage(visualState = "idle") {
    const boss = currentBossEntity();
    // 専用cutoutが無い章で背景全体を<img>へ押し込むと二重背景になる。
    // その場合は画像を空にし、ボス名・HP・場面絵だけで明示する。
    const imageId = boss.images?.[visualState] || boss.image;
    return imageId ? asset(imageId) : "";
  }

  function preloadBossImages(boss) {
    Object.values(boss?.images || {}).filter(Boolean).forEach(imageId => {
      const source = asset(imageId);
      if (!source || bossImagePreloads.has(source)) return;
      const image = new window.Image();
      image.decoding = "async";
      image.src = source;
      bossImagePreloads.set(source, image);
    });
  }

  function setBossVisualState(visualState = "idle") {
    const bossImage = currentBossImage(visualState);
    if (bossImage) els.bossSprite.src = bossImage;
    else els.bossSprite.removeAttribute("src");
    els.bossSprite.dataset.state = visualState;
  }

  function phaseLabel() {
    if (state.phase === "bonus") return `BONUS ${state.bonusGames}G`;
    if (state.phase === "trial") {
      if (currentStageScript().id === "treasure") return "VIP LAMP";
      return state.trialType === "merge" ? "合体CHALLENGE" : "特訓MODE";
    }
    if (state.phase === "battle") return "BOSS BATTLE";
    if (currentStageScript().id === "treasure") return state.auto ? "AUTO" : "NORMAL";
    if (state.orb >= economyRules.orb.releaseThreshold) return "ORB MAX";
    if (state.nearMiss > 0) return "CHANCE";
    return state.auto ? "AUTO" : "NORMAL";
  }

  function setAdventureScene(index, cue = "") {
    const next = ((index % adventureEvents.length) + adventureEvents.length) % adventureEvents.length;
    const nextStage = next + 1;
    if (state.stage !== nextStage) {
      state.stage = nextStage;
      state.currentBoss = next;
      state.adventureStep = 0;
      state.sceneSpins = 0;
      stageFlash();
      if (cue) addLog("LCD", cue);
    }
  }

  function activeCharacterImage(member) {
    const costume = equippedItem("costume");
    if (member.id === "mimi" && costume) return costume.displayImage || costume.image;
    return member.image;
  }

  function renderWallets() {
    els.wallets.forEach(wallet => {
      wallet.textContent = profile.coins.toLocaleString("ja-JP");
    });
  }

  function renderCollectionGuide(open = false) {
    if (!els.collectionGuide) return;
    const routes = collectionEconomy.routeStatus(profile);
    const paid = routes.paidSpin;
    const remainingBosses = routes.boss.remaining.length;
    els.dailyCoinClaim.disabled = !routes.daily.canClaim;
    els.dailyCoinClaim.textContent = routes.daily.canClaim
      ? `本日の${routes.daily.amount.toLocaleString("ja-JP")} COINSを受け取る`
      : "本日のデイリーは受取済み";
    els.dailyCoinStatus.textContent = routes.daily.canClaim
      ? "JSTで1日1回受け取れます。CREDITは変わりません。"
      : `${routes.daily.lastClaimDay} 受取済み。`;
    const pending = paid.pending > 0 ? ` 未受取${paid.pending}口は翌日以降の有料SPIN決着時に自動受取します。` : "";
    els.paidSpinRewardStatus.textContent = `有料SPIN ${paid.progress}/${paid.spinsPerMilestone}。50Gごとに${paid.amount} COINS（本日${paid.claimsToday}/${paid.dailyLimit}口）。${pending}`;
    els.bossRewardStatus.textContent = remainingBosses > 0
      ? `未受取 ${remainingBosses}/5章。各章の初回撃破で1,000〜3,000 COINS。`
      : "全5章の初回撃破報酬を受取済み。";
    const receipt = routes.latestReceipt;
    const receiptLabels = {
      daily: "デイリー",
      "paid-spin-milestone": "有料SPIN節目",
      "paid-win": "有料SPINのWIN",
      "boss-first": "章ボス初回"
    };
    els.collectionReceipt.textContent = receipt
      ? `直近の獲得: ${receiptLabels[receipt.source] || receipt.source} +${receipt.amount.toLocaleString("ja-JP")} COINS（残高 ${receipt.balance.toLocaleString("ja-JP")}）`
      : "COINSの獲得履歴はまだありません。";
    if (open) els.collectionGuide.open = true;
  }

  function showView(view, options = {}) {
    if (staySurface && view === "home" && options.resumeStay) view = window.MimiResortWorld.resumeView(profile.stay);
    if (!Array.from(els.views).some(panel => panel.dataset.view === view)) return;
    if (view === "slot" && state.chapter1RunFinished) view = "holdem-result";
    // The table introduction is a player-paced wait, not an unresolved spin.
    // Let the player step away, then replay the introduction on the next entry.
    if (view !== "slot" && chapter1Command && !state.spinning && !state.bossResolutionPending) {
      const opponentId = chapter1Command.opponentId;
      clearChapter1Command();
      if (lastChapter1ArrivalId === opponentId) lastChapter1ArrivalId = "";
    }
    if (view !== "slot" && (state.spinning || state.transitioning)) {
      toast("スピン決着後に移動できます");
      return;
    }
    if (staySurface && currentView === "slot" && view !== "slot" && staySessionStart) {
      const session = {
        games: Math.max(0, profile.stats.spins - staySessionStart.games),
        coins: Math.max(0, profile.coins - staySessionStart.coins),
        creditDelta: state.credit - staySessionStart.credit,
        endingCredit: state.credit
      };
      const saved = transactStay(draft => { draft.stay.lastSession = session; });
      if (!saved.ok) { toast(saved.message); return; }
      staySessionStart = null;
    }
    if (staySurface && view === "slot" && currentView !== "slot") {
      staySessionStart = { games: profile.stats.spins, coins: profile.coins, credit: state.credit };
    }
    if (staySurface) {
      stayUi ||= window.MimiResortStay.create({
        read: () => profile, transact: transactStay, navigate: showView,
        onMotionChange: () => { audio.setReduced(isMotionReduced()); updateHud(); },
      });
      const entry = stayUi.enter(view);
      if (!entry.ok) { toast(entry.message); return; }
    }
    currentView = view;
    els.views.forEach(panel => panel.classList.toggle("is-active", panel.dataset.view === view));
    if (view !== "slot") setHelpOpen(false);
    if (view !== "slot") {
      state.auto = false;
      clearTimeout(autoTimer);
    }
    if (view === "slot") {
      if (!reelsBuilt) {
        buildReels();
        reelsBuilt = true;
        syncGrid();
      }
      lastSceneSignature = "";
      /*
       * buildReels() はページ読込時に走るが、そのときスロット画面は
       * display:none なので高さが 0 で採寸に失敗する。
       * 結果、最初のスピンまで変形量 0 のまま放置され、
       * 窓と 3 コマが噛み合わずに図柄が切れたり小さく見えたりしていた。
       * 画面が見えたこの時点で必ず測り直す。
       */
      paintReels(true);
      audio.setMood(state.phase === "bonus" ? "bonus" : state.bossBattle ? "boss" : "resort");
    } else {
      audio.setMood("silent");
    }
    if (view === "shop") renderShop();
    if (view === "machines") renderMachines();
    if (view === "holdem-result") renderChapter1Result();
    updateHud();
    updateButtons();
    if (view === "slot" && !options.suppressOpponentAnnouncement) {
      window.requestAnimationFrame(announceChapter1Opponent);
    }
    if (staySurface && ["home", "shop", "room"].includes(view)) {
      document.querySelector(`[data-view="${view}"] [data-stay-heading]`)?.focus({ preventScroll: true });
    }
  }

  function setHelpOpen(open) {
    if (!els.helpOverlay) return;
    if (open && (state.spinning || state.transitioning)) {
      toast("スピン決着後にガイドを開けます");
      return;
    }
    if (open) {
      helpReturnFocus = document.activeElement;
      state.auto = false;
      clearTimeout(autoTimer);
      updateHud();
    }
    els.helpOverlay.hidden = !open;
    els.shell.classList.toggle("help-open", open);
    setSlotModalIsolation(open, els.helpOverlay);
    if (open) els.helpClose.focus();
    else if (helpReturnFocus && typeof helpReturnFocus.focus === "function") helpReturnFocus.focus();
  }

  function setSceneMode(key, cue = "") {
    state.sceneMode = key;
    state.adventureStep = key === "boss" || key === "bonus" ? 4 : state.adventureStep;
    if (cue) addLog("LCD", cue);
  }

  function setDebugScene(stageNumber, sceneKey = "explore") {
    const stageIndex = Math.max(0, Math.min(stageScripts.length - 1, Math.floor(Number(stageNumber) || 1) - 1));
    const allowed = new Set(["explore", "omen", "chain", "boss", "bonus"]);
    state.stage = stageIndex + 1;
    state.currentBoss = stageIndex;
    debugSceneOverride = allowed.has(sceneKey) ? sceneKey : "explore";
    state.sceneMode = debugSceneOverride;
    state.phase = debugSceneOverride === "bonus" ? "bonus" : debugSceneOverride === "boss" ? "battle" : debugSceneOverride === "chain" ? "trial" : "normal";
    state.bossBattle = state.sceneMode === "boss";
    // Debug scenes are visual probes and never qualify for a persistent boss reward.
    state.bossStageId = "";
    state.bonusGames = state.sceneMode === "bonus" ? Math.max(1, state.bonusGames || economyRules.bonus.length) : 0;
    lastSceneSignature = "";
    updateHud();
    return {
      stage: state.stage,
      scene: currentSceneKey(),
      asset: currentSceneBlueprint().image ? asset(currentSceneBlueprint().image) : ""
    };
  }

  function selectHelpPage(name) {
    els.helpTabs.forEach(tab => {
      const selected = tab.dataset.helpTab === name;
      const tabId = `help-tab-${tab.dataset.helpTab}`;
      const pageId = `help-page-${tab.dataset.helpTab}`;
      tab.id = tabId;
      tab.setAttribute("aria-controls", pageId);
      tab.classList.toggle("is-active", selected);
      tab.setAttribute("aria-selected", String(selected));
      tab.tabIndex = selected ? 0 : -1;
    });
    els.helpPages.forEach(page => {
      const selected = page.dataset.helpPage === name;
      page.id = `help-page-${page.dataset.helpPage}`;
      page.setAttribute("aria-labelledby", `help-tab-${page.dataset.helpPage}`);
      page.classList.toggle("is-active", selected);
      page.setAttribute("role", "tabpanel");
      page.setAttribute("aria-hidden", String(!selected));
      page.hidden = !selected;
    });
  }

  function renderShop() {
    const items = shopItems.filter(item => item.tab === currentShopTab);
    els.shopGrid.dataset.count = String(items.length);
    els.shopGrid.dataset.layout = items.length >= 4 ? "compact" : "showcase";
    els.shopGrid.innerHTML = items.map(item => {
      const owned = profile.owned.has(item.id);
      const equipped = profile.equipped[item.tab] === item.id;
      const action = equipped ? "装備中" : owned ? "装備する" : `${item.price.toLocaleString("ja-JP")} COINS`;
      const itemClass = [item.tab, `item-${item.id}`, equipped ? "equipped" : "", item.effect ? `effect-${item.effect}` : ""].filter(Boolean).join(" ");
      return `
        <article class="shop-item ${equipped ? "is-equipped" : ""}">
          <div class="shop-item-image ${itemClass}" style="background-image:url('${item.image}')"></div>
          <div class="shop-item-copy">
            <strong>${item.name}</strong>
            <span>${item.note}</span>
            <button class="${owned ? "owned" : ""} ${equipped ? "equipped" : ""}" data-shop-item="${item.id}" type="button">${action}</button>
          </div>
        </article>
      `;
    }).join("");
    els.shopTabs.forEach(tab => tab.classList.toggle("is-active", tab.dataset.shopTab === currentShopTab));
    els.shopGrid.querySelectorAll("[data-shop-item]").forEach(button => {
      button.addEventListener("click", () => buyOrEquip(button.dataset.shopItem));
    });
    renderCollectionGuide();
  }

  function claimDailyCoins() {
    const creditBefore = state.credit;
    const draft = draftProfile();
    const result = collectionEconomy.claimDaily(draft, { now: Date.now() });
    const saved = result.accepted ? saveProfile(draft) : true;
    if (result.accepted && saved) commitProfile(draft);
    renderWallets();
    renderCollectionGuide(true);
    if (!saved) {
      els.shopMessage.textContent = "デイリー報酬を保存できませんでした。ページを閉じずにもう一度お試しください。";
    } else if (result.duplicate) {
      els.shopMessage.textContent = "本日のデイリー300 COINSは受取済みです。";
    } else {
      els.shopMessage.textContent = result.amount > 0
        ? `デイリー報酬 ${result.amount.toLocaleString("ja-JP")} COINSを受け取りました。CREDITは変わりません。`
        : "COINSが上限のため、デイリー報酬の実付与は0でした。";
    }
    if (state.credit !== creditBefore) throw new Error("Collection reward changed CREDIT");
  }

  function buyOrEquip(id) {
    const item = shopItems.find(entry => entry.id === id);
    if (!item) return;
    const draft = draftProfile();
    let successMessage = "";
    if (draft.owned.has(id)) {
      draft.equipped[item.tab] = id;
      successMessage = `${item.name}を装備しました。${item.tab === "background" ? "演出背景" : item.tab === "effect" ? "CHANCEとWIN演出" : "ミミの表示"}に反映されます。`;
    } else if (draft.coins >= item.price) {
      draft.coins -= item.price;
      draft.owned.add(id);
      draft.equipped[item.tab] = id;
      successMessage = `${item.name}を購入して装備しました。台に戻るとすぐ反映されます。`;
    } else {
      const shortfall = item.price - draft.coins;
      els.shopMessage.textContent = `あと${shortfall.toLocaleString("ja-JP")} COINS必要です。デイリー、有料SPIN50G節目、有料SPINのWIN、章ボス初回の4経路から獲得できます。CREDITは使いません。`;
      renderCollectionGuide(true);
    }
    if (successMessage) {
      if (saveProfile(draft)) {
        commitProfile(draft);
        els.shopMessage.textContent = successMessage;
      } else {
        els.shopMessage.textContent = "購入・装備を保存できませんでした。残高と所持品は変更していません。";
      }
    }
    renderWallets();
    renderShop();
    updateHud();
  }

  function nextChapter1ReplayOrder() {
    const orders = chapter1Flow.ROYAL_REPLAY_ORDERS;
    const chosen = orders.find(order => order.id === chapter1ReplayChoice);
    if (chosen) return chosen;
    const next = chapter1Flow.royalReplayOrder(chapter1ClearCount(profile));
    if (!state.chapter1RunFinished) return next;
    const archive = chapter1Flow.royalReplayCrestState(profile.stats.chapter1RoyalOrderCrests);
    const missing = id => !archive.entries.find(crest => crest.id === id)?.earned;
    const retry = orders.find(order => order.id === state.chapter1RoyalOrderId);
    if (retry && !state.chapter1RunOrderComplete && missing(retry.id)) return retry;
    const start = orders.indexOf(next);
    return orders.slice(start).concat(orders.slice(0, start)).find(order => missing(order.id)) || next;
  }

  function renderChapter1ReplayChoice(panel) {
    const next = nextChapter1ReplayOrder();
    const archive = chapter1Flow.royalReplayCrestState(profile.stats.chapter1RoyalOrderCrests);
    const choices = panel.querySelector("[data-replay-order-choices]");
    const castFor = order => order.inviter === "velvet" ? chapter1Flow.BOSS_TABLE
      : chapter1Flow.TABLE_ORDER.find(actor => actor.id === order.inviter);
    if (!choices.children.length) {
      choices.innerHTML = chapter1Flow.ROYAL_REPLAY_ORDERS.map(order => `
        <button type="button" data-replay-order-choice="${order.id}" aria-pressed="false">
          <span class="holdem-inviter-portrait"><img src="${castFor(order).baseAsset}" alt=""></span>
          <b>${castFor(order).name}</b><em>${order.replayLabel}</em><small></small>
        </button>`).join("");
    }
    choices.querySelectorAll("[data-replay-order-choice]").forEach(button => {
      const crest = archive.entries.find(entry => entry.id === button.dataset.replayOrderChoice);
      button.setAttribute("aria-pressed", String(crest.id === next.id));
      button.dataset.earned = String(crest.earned);
      button.querySelector("small").textContent = crest.earned ? "達成済み" : "未達成";
    });
    const earned = archive.entries.find(crest => crest.id === next.id).earned;
    const inviter = castFor(next);
    const guest = panel.querySelector('[data-result="guest"]');
    guest.src = inviter.baseAsset;
    guest.alt = inviter.name;
    guest.dataset.character = inviter.id;
    panel.querySelector('[data-result="speaker"]').textContent = inviter.name;
    panel.querySelector('[data-result="invitation"]').textContent = next.invitation;
    panel.querySelector('[data-result="next"]').textContent = next.title;
    panel.querySelector('[data-result="goal"]').textContent = next.description;
    panel.querySelector('[data-result="approach"]').textContent = next.approach;
    panel.querySelector('[data-result="replay-reward"]').textContent = earned
      ? "達成済みの腕試し · 成功でCROWN STAMP +1"
      : "この条件で撃破すると、新しい紋章を獲得";
    panel.querySelector("[data-holdem-replay]").textContent = `${next.replayLabel}に挑戦`;
    panel.dataset.nextOrder = next.id;
  }

  function renderChapter1Result() {
    const panel = document.querySelector('[data-view="holdem-result"]');
    if (!panel) return;
    const order = chapter1RoyalOrderProgress(true);
    const archive = chapter1Flow.royalReplayCrestState(profile.stats.chapter1RoyalOrderCrests);
    const paint = (name, value) => { panel.querySelector(`[data-result="${name}"]`).textContent = value; };
    panel.dataset.orderResult = order ? state.chapter1RunOrderComplete ? "clear" : "miss" : "first";
    paint("award", !order ? "ロイヤルポットを手に入れた！"
      : !state.chapter1RunOrderComplete ? "ヴェルベットに勝利！"
      : state.chapter1RunCrestSetComplete ? "ROYAL CROWN COMPLETE"
      : `${state.chapter1RunCrestFirst ? "NEW CREST" : "CROWN STAMP"} · ${order.title}`);
    paint("detail", order && !state.chapter1RunOrderComplete
      ? `今回のお題：${order.title} · ${order.compact}（未達成）`
      : "ヴェルベットとの勝負に勝ち、10個のランプを灯した！");
    paint("games", `${state.chapter1RunNormalSpins} G`);
    paint("attempts", `${Math.max(1, state.chapter1BossAttempt)} 回`);
    paint("archive", `${archive.count} / ${archive.total}`);
    paint("credit", state.credit.toLocaleString("ja-JP"));
    renderChapter1ReplayChoice(panel);
    panel.querySelector("[data-holdem-replay]").focus({ preventScroll: true });
  }

  function renderMachines() {
    queueMicrotask(() => window.MimiMachineLobby?.render(els.machineCarousel));
    const chapter1Clears = chapter1ClearCount(profile);
    const chapter1Cleared = chapter1Clears > 0;
    const chapter1Order = chapter1Cleared ? nextChapter1ReplayOrder() : null;
    const crownStamps = Math.max(0, Number(profile.stats.chapter1RoyalOrdersCompleted) || 0);
    const crownArchive = chapter1Flow.royalReplayCrestState(profile.stats.chapter1RoyalOrderCrests);
    const chapter1OrderCrest = chapter1Order
      ? crownArchive.entries.find(crest => crest.id === chapter1Order.id)
      : null;
    els.machineCarousel.innerHTML = machines.map(machine => `
      <article class="machine-card${machine.playable && chapter1Order ? " has-replay-order" : ""}">
        <div class="machine-card-image ${machine.playable ? "is-playable" : "is-planned"}" style="background-image:url('${machine.image}')" role="img" aria-label="ミミのジャックポットリゾート キービジュアル">
          ${machine.playable ? `<span class="machine-live-badge">NOW PLAYING</span>` : `<span class="machine-plan-badge">CONCEPT / IN DEVELOPMENT</span>`}
        </div>
        <div class="machine-card-copy">
          <span class="machine-card-eyebrow">STORY SLOT / ONE CABINET</span>
          <strong>${machine.title.replace("ジャックポットリゾート", "ジャックポット<br>リゾート")}</strong>
          <p>${machine.subtitle}</p>
          <span class="machine-card-description">リゾートの台を巡り、仲間と勝負を重ねてジャックポットを目指す連続ストーリー。</span>
          <div class="machine-card-specs" aria-label="ゲーム仕様">
            <span>5 CHAPTERS</span><span>3 REELS</span><span>5 LINES</span>
          </div>
          ${chapter1Cleared ? `<span class="machine-clear-status">CHAPTER 1 CLEARED · ROYAL REPLAY OPEN</span>` : ""}
          ${machine.playable && chapter1Order ? `
            <div class="machine-replay-order" data-royal-order="${chapter1Order.id}">
              <span>ROYAL ORDER ${chapter1OrderCrest?.numeral || "--"} · REPLAY ${String(chapter1Clears).padStart(2, "0")}</span>
              <b>${chapter1Order.title}</b>
              <p>${chapter1Order.description}</p>
              <small>CROWN STAMP ${crownStamps}</small>
              <div class="machine-crown-archive${crownArchive.complete ? " is-complete" : ""}" aria-label="CROWN ARCHIVE ${crownArchive.count}/${crownArchive.total}">
                <div class="machine-crown-archive-head"><span>CROWN ARCHIVE</span><b>${crownArchive.complete ? "ROYAL CROWN COMPLETE" : `${crownArchive.count}/${crownArchive.total}`}</b></div>
                <div class="machine-crown-crests" role="list">
                  ${crownArchive.entries.map(crest => `<span class="machine-crown-crest${crest.earned ? " is-earned" : ""}" data-royal-crest="${crest.id}" role="listitem" aria-label="${crest.title} ${crest.earned ? "獲得済み" : "未獲得"}"><i>${crest.numeral}</i><em>${crest.title.replace(" ROYAL", "").replace(" CROWN", "")}</em></span>`).join("")}
                </div>
              </div>
            </div>
          ` : ""}
          <div class="machine-card-actions">
            <button data-machine="${machine.id}" type="button" ${machine.playable ? "" : "disabled"}>
              ${machine.playable ? (state.chapter1RunFinished ? "勝負の結果を見る" : chapter1Cleared ? "現在の物語へ" : "この物語を始める") : "COMING SOON"}
            </button>
            ${machine.playable && chapter1Cleared ? `<button class="machine-replay-button" data-machine-replay="treasure" type="button">第1章をもう一度</button>` : ""}
          </div>
        </div>
      </article>
    `).join("");
    els.machineCarousel.querySelectorAll("[data-machine]").forEach(button => {
      button.addEventListener("click", () => {
        if (button.dataset.machine === "jackpot") showView("slot");
      });
    });
    els.machineCarousel.querySelectorAll("[data-machine-replay]").forEach(button => {
      button.addEventListener("click", () => {
        if (button.dataset.machineReplay === "treasure") restartChapter1FromGallery();
      });
    });
  }

  function bindAppShell() {
    document.querySelector("[data-replay-order-choices]")?.addEventListener("click", event => {
      const button = event.target.closest("[data-replay-order-choice]");
      if (!button || currentView !== "holdem-result" || !state.chapter1RunFinished) return;
      const order = chapter1Flow.ROYAL_REPLAY_ORDERS.find(entry => entry.id === button.dataset.replayOrderChoice);
      if (!order) return;
      chapter1ReplayChoice = order.id;
      renderChapter1ReplayChoice(document.querySelector('[data-view="holdem-result"]'));
      audio.cue("press");
    });
    document.querySelector("[data-holdem-replay]")?.addEventListener("click", restartChapter1FromGallery);
    els.routes.forEach(button => {
      button.addEventListener("click", () => {
        // Start decoding on the first explicit player gesture so a SOUND ON
        // profile reaches its first command window with recorded foley ready.
        if (button.matches(".title-start, .title-route") && profile.settings.sound) audio.unlock();
        showView(button.dataset.route, { resumeStay: button.hasAttribute("data-resume-stay") });
      });
    });
    els.shopTabs.forEach(tab => {
      tab.addEventListener("click", () => {
        currentShopTab = tab.dataset.shopTab;
        renderShop();
      });
    });
    els.dailyCoinClaim?.addEventListener("click", claimDailyCoins);
    els.helpOpen.addEventListener("click", () => setHelpOpen(true));
    els.helpBackdrop.addEventListener("click", () => setHelpOpen(false));
    els.helpClose.addEventListener("click", () => setHelpOpen(false));
    els.helpTabs.forEach((tab, index) => {
      tab.addEventListener("click", () => selectHelpPage(tab.dataset.helpTab));
      tab.addEventListener("keydown", event => {
        const last = els.helpTabs.length - 1;
        let next = null;
        if (event.key === "ArrowRight") next = index === last ? 0 : index + 1;
        if (event.key === "ArrowLeft") next = index === 0 ? last : index - 1;
        if (event.key === "Home") next = 0;
        if (event.key === "End") next = last;
        if (next === null) return;
        event.preventDefault();
        selectHelpPage(els.helpTabs[next].dataset.helpTab);
        els.helpTabs[next].focus();
      });
    });
    selectHelpPage("play");
    renderWallets();
    renderShop();
    renderMachines();
  }

  /** 図柄の画像。assets/skin/symbol_<id>.png があれば優先（content/skin.js）。 */
  function symImage(sym) {
    const skin = content.symbolOverrides && content.symbolOverrides[sym.id];
    return skin || assetBase + sym.img;
  }

  /* ------------------------------------------------------------------ *
   * 回胴エンジン
   *
   * リールは「帯を 2 周分ぶら下げた縦長の DOM を translate3d で流す」方式。
   * pos は中段に来ている帯のインデックス（実数・未剰余）で、回転中は減り続ける。
   * pos が減ると図柄は上から下へ流れ、実機のドラムと同じ向きになる。
   * ------------------------------------------------------------------ */

  const reels = strips.map((strip, col) => ({
    col,
    strip,
    length: strip.length,
    pos: col * 7,
    speed: 0,
    delay: 0,
    phase: "stopped",     // stopped | accel | spin | brake
    index: col * 7,
    slip: 0,
    pulledIn: true,
    slowed: false,
    pendingStop: false,
    spinTime: 0,
    hotAimReady: false,
    hotAimHold: 0,
    hotAimLastNatural: null,
    brakeFrom: 0,
    brakeTo: 0,
    brakeT: 0,
    brakeDur: 0,
    blurred: false,
    node: null,
    band: null,
    cells: []
  }));
  const chapter1HotAimCache = new Map();

  function chapter1RoleLands(flag, stopped) {
    if (![0, 1, 2].every(col => Number.isInteger(stopped[col]))) return false;
    return paylines.some(line => line.cells.every(([col, row]) => (
      core.windowAt(col, stopped[col])[row].id === flag
    )));
  }

  function chapter1HotHandFlag(flag) {
    return ["grape", "watermelon", "bar", "seven_blue", "seven_red"].includes(flag);
  }

  function chapter1HotHandSettled(flag = state.flag, landed = state.flagLanded) {
    return Boolean(
      landed
      && chapter1HotHandFlag(flag)
      && els.stopButtons.every(button => button.classList.contains("is-hot-hit"))
    );
  }

  function chapter1HotHandSpinEligible() {
    return Boolean(
      (state.phase === "normal" || (state.phase === "battle" && state.bossBattle && state.bossStageId === "treasure"))
      && state.chapter1RoyalOrderId === "strong"
      && chapter1HotHandFlag(currentSpin?.flag)
    );
  }

  function syncChapter1HotGuide(mode = "", hits = 0) {
    const nextMode = ["ready", "aim"].includes(mode) ? mode : "";
    const nextHits = Math.max(0, Math.min(3, Number(hits) || 0));
    if (chapter1HotGuideMode === nextMode && chapter1HotGuideHits === nextHits) return;
    chapter1HotGuideMode = nextMode;
    chapter1HotGuideHits = nextHits;
    if (nextMode) els.shell.dataset.chapter1HotGuide = nextMode;
    else delete els.shell.dataset.chapter1HotGuide;
    const objective = currentObjectiveText();
    els.featureName.textContent = objective;
    els.objectiveLabel.textContent = objective;
  }

  function chapter1RoleCanFinish(col, natural, flag, stopped) {
    const wrappedNatural = core.mod(natural, reels[col].length);
    const stoppedKey = [0, 1, 2].map(index => Number.isInteger(stopped[index]) ? stopped[index] : "-").join(",");
    const key = `${currentSpin?.id || 0}:${flag}:${col}:${wrappedNatural}:${stoppedKey}`;
    if (chapter1HotAimCache.has(key)) return chapter1HotAimCache.get(key);
    const decision = core.chooseStop({ col, natural: wrappedNatural, flag, stopped });
    const nextStopped = Object.assign({}, stopped, { [col]: decision.index });
    let canFinish = false;
    if (col >= reels.length - 1) {
      canFinish = chapter1RoleLands(flag, nextStopped);
    } else {
      const nextCol = col + 1;
      for (let nextNatural = 0; nextNatural < reels[nextCol].length; nextNatural += 1) {
        if (!chapter1RoleCanFinish(nextCol, nextNatural, flag, nextStopped)) continue;
        canFinish = true;
        break;
      }
    }
    chapter1HotAimCache.set(key, canFinish);
    return canFinish;
  }

  function syncChapter1HotAim() {
    const hotSkillFlag = chapter1HotHandFlag(currentSpin?.flag);
    const eligible = Boolean(state.spinning && hotSkillFlag && chapter1HotHandSpinEligible());
    const nextCol = eligible ? reels.findIndex(reel => !state.reelsStopped[reel.col] && !reel.pendingStop) : -1;
    let active = false;
    let aimedCol = -1;
    if (nextCol >= 0) {
      const reel = reels[nextCol];
      const stopped = spinSession.knownStops(currentSpin, nextCol);
      const natural = Math.floor(reel.pos);
      active = Array.from({ length: reel.length }, (_, index) => index).some(candidate => (
        chapter1RoleCanFinish(nextCol, candidate, currentSpin.flag, stopped)
      ));
      reel.hotAimReady = active;
      if (active) reel.speed = Math.min(reel.speed, HOT_READY_SPEED);
      if (active && reel.spinTime >= MIN_SPIN_SEC && chapter1RoleCanFinish(nextCol, natural, currentSpin.flag, stopped)) {
        aimedCol = nextCol;
        const wrappedNatural = core.mod(natural, reel.length);
        if (reel.hotAimLastNatural !== wrappedNatural) {
          reel.hotAimLastNatural = wrappedNatural;
          reel.hotAimHold = HOT_AIM_HOLD_SEC;
          reel.speed = 0;
        }
      } else {
        reel.hotAimLastNatural = core.mod(natural, reel.length);
      }
    }
    reels.forEach(reel => {
      if (reel.col !== nextCol) reel.hotAimReady = false;
    });
    els.stopButtons.forEach((button, index) => {
      const isCurrentStop = active && index === nextCol && button.disabled === false;
      const aimed = isCurrentStop && index === aimedCol;
      const ready = isCurrentStop && !aimed;
      const wasHotPrompt = button.dataset.hotAim === "true" || button.dataset.hotReady === "true";
      button.classList.toggle("is-hot-aim", aimed);
      button.classList.toggle("is-hot-ready", ready);
      if (aimed) button.dataset.hotAim = "true";
      else delete button.dataset.hotAim;
      if (ready) button.dataset.hotReady = "true";
      else delete button.dataset.hotReady;
      if (aimed) button.setAttribute("aria-label", `${index + 1}番リール HOTタイミング・今！`);
      else if (ready) button.setAttribute("aria-label", `${index + 1}番リール HOTタイミング待機`);
      else if (wasHotPrompt && !button.classList.contains("is-hot-hit")) {
        button.setAttribute("aria-label", button.disabled ? `${index + 1}番リール停止` : `${index + 1}番リールを止める`);
      }
    });
    const hotHits = els.stopButtons.filter(button => button.classList.contains("is-hot-hit")).length;
    syncChapter1HotGuide(aimedCol >= 0 ? "aim" : active ? "ready" : "", hotHits);
    if (aimedCol >= 0) els.shell.dataset.chapter1HotAim = String(aimedCol + 1);
    else delete els.shell.dataset.chapter1HotAim;
  }

  function buildReels() {
    els.reels.innerHTML = "";
    reels.forEach(reel => {
      const node = document.createElement("div");
      node.className = "reel";
      const band = document.createElement("div");
      band.className = "strip";
      reel.cells = [];
      /*
       * 帯は 3 周分並べる。
       * 表示は常に真ん中の周を使う（q = wrapped + length）ので、
       * 上段用の q-1 と下段用の q+1 が必ず存在する。
       * 2 周分だと pos が最終コマ（length-1）のとき q+1 が範囲外になり、
       * 下段が 1 コマぶんずれていた。
       */
      for (let copy = 0; copy < 3; copy += 1) {
        reel.strip.forEach(sym => {
          const cell = document.createElement("div");
          cell.className = "reel-cell";
          // 積み上げに頼らず、番号から厳密な位置に絶対配置する（端数が溜まらない）
          cell.style.setProperty("--i", String(reel.cells.length));  // 帯の中の通し番号
          // 価値の格差を CSS 側に伝える。最高役だけ大きく・光らせるため。
          cell.dataset.tier = sym.tier || "small";
          const img = document.createElement("img");
          img.src = symImage(sym);
          img.alt = "";
          img.setAttribute("aria-hidden", "true");
          img.draggable = false;
          cell.appendChild(img);
          band.appendChild(cell);
          reel.cells.push(cell);
        });
      }
      node.appendChild(band);
      node.setAttribute("aria-hidden", "true");
      els.reels.appendChild(node);
      reel.node = node;
      reel.band = band;
    });
    paintReels(true);
    updateButtons();

  }

  /** 中段・上段・下段に見えている 3 つのセル要素。 */
  function windowCellsOf(reel) {
    const total = reel.cells.length;
    const centre = core.mod(Math.round(reel.pos), reel.length) + reel.length;
    return [centre - 1, centre, centre + 1].map(i => reel.cells[core.mod(i, total)]);
  }

  let markedCells = [];
  let windowSignature = "";

  function markWindowCells() {
    markedCells.forEach(cell => cell.classList.remove("symbol", "win", "near"));
    markedCells = [];
    reels.forEach(reel => {
      windowCellsOf(reel).forEach(cell => {
        cell.classList.add("symbol");
        markedCells.push(cell);
      });
    });
  }

  /**
   * 1 コマの高さを実測して px で確定させる。
   *
   * 以前は帯の移動量を「自分の高さに対する %」で指定していたが、
   * それだと CSS 側の高さ計算とわずかにズレたときに窓と 3 コマが合わなくなる
   * （実際に 2 本のリールで 8px ずれて 4 コマ見えていた）。
   * コマの高さも移動量も同じ実測値から px で出すことで、原理的にズレなくする。
   */
  function paintReels(force) {
    let signature = "";
    reels.forEach(reel => {
      const wrapped = core.mod(reel.pos, reel.length);
      // 2 周目に載せておけば、上段用の 1 コマが必ず存在する。
      const q = wrapped + reel.length;
      // 位置は状態（何コマ目か）だけを渡し、実際の変形量は CSS に計算させる。
      // px を JS から流し込むとレイアウトを変えるたびに壊れるため。
      reel.band.style.setProperty("--q", String(q));
      signature += `${Math.round(wrapped)},`;
    });
    syncChapter1HotAim();
    if (!force && signature === windowSignature) return;
    windowSignature = signature;
    markWindowCells();
  }

  /** 停止済みの位置から 3x3 を作り直す。 */
  function syncGrid() {
    state.grid = reels.map(reel => core.windowAt(reel.col, core.mod(Math.round(reel.pos), reel.length)));
    state.positions = reels.map(reel => core.mod(Math.round(reel.pos), reel.length));
    return state.grid;
  }

  function highlightCells(keys, className) {
    if (!keys || !keys.size) return;
    reels.forEach(reel => {
      windowCellsOf(reel).forEach((cell, row) => {
        if (keys.has(`${reel.col}-${row}`)) cell.classList.add(className);
      });
    });
  }

  function clearHighlights() {
    markedCells.forEach(cell => cell.classList.remove("win", "near"));
  }

  function reelTargetSpeed(reel) {
    if (reel.hotAimHold > 0) return 0;
    if (reel.hotAimReady) return HOT_READY_SPEED;
    if (reel.slowed) return SPIN_SPEED_TENPAI;
    return state.turbo ? SPIN_SPEED_TURBO : SPIN_SPEED;
  }

  function setBlur(reel, on) {
    if (reel.blurred === on) return;
    reel.blurred = on;
    reel.node.classList.toggle("is-blur", on);
  }

  let frameHandle = 0;
  let lastFrame = 0;

  function requestFrame(resetClock = true) {
    if (frameHandle) return;
    if (resetClock) lastFrame = 0;
    frameHandle = window.requestAnimationFrame(tick);
  }

  function tick(now) {
    frameHandle = 0;
    // Keep reel time close to wall time on a busy 10-20fps consumer PC.
    // The former 50ms cap discarded most elapsed time during a slow frame,
    // stretching a 5.25s HOT READY rotation past the player's 11s read window.
    const dt = lastFrame ? Math.min(0.1, (now - lastFrame) / 1000) : 0.016;
    lastFrame = now;
    const active = advance(dt);
    if (active || reels.some(reel => reel.phase !== "stopped")) requestFrame(!usesChapter1CommandSurface());
  }

  /** 1 フレーム分すすめる。戻り値は「まだ動いているか」。 */
  function advance(dt) {
    const settled = [];
    let active = false;

    reels.forEach(reel => {
      if (reel.phase === "accel" || reel.phase === "spin") {
        reel.spinTime += dt;
        reel.hotAimHold = Math.max(0, reel.hotAimHold - dt);
        if (reel.delay > 0) {
          reel.delay -= dt;
        } else {
          const target = reelTargetSpeed(reel);
          if (reel.speed < target) reel.speed = Math.min(target, reel.speed + SPIN_ACCEL * dt);
          else if (reel.speed > target) reel.speed = Math.max(target, reel.speed - SPIN_ACCEL * dt);
          if (reel.phase === "accel" && reel.speed >= target) reel.phase = "spin";
          reel.pos -= reel.speed * dt;
        }
        setBlur(reel, reel.speed > SPIN_SPEED_TENPAI + 2);
        active = true;
      } else if (reel.phase === "brake") {
        reel.brakeT = usesChapter1CommandSurface()
          ? Math.max(0, (performance.now() - reel.brakeStartedAt) / 1000)
          : reel.brakeT + dt;
        const t = Math.min(1, reel.brakeT / reel.brakeDur);
        const eased = 1 - Math.pow(1 - t, 3);
        reel.pos = usesChapter1CommandSurface()
          ? core.mod(reel.brakeTo, reel.length)
          : reel.brakeFrom + (reel.brakeTo - reel.brakeFrom) * eased;
        setBlur(reel, false);
        if (t >= 1) {
          reel.pos = core.mod(reel.brakeTo, reel.length);
          reel.phase = "stopped";
          settled.push(reel);
        }
        active = true;
      }
    });

    let queuedCol = spinSession.takeReadyStop(currentSpin, col => {
      const reel = reels[col];
      return Boolean(reel && (reel.phase === "accel" || reel.phase === "spin") && reel.spinTime >= MIN_SPIN_SEC);
    });
    while (queuedCol !== null) {
      reels[queuedCol].pendingStop = false;
      engageStop(reels[queuedCol]);
      queuedCol = spinSession.takeReadyStop(currentSpin, col => {
        const reel = reels[col];
        return Boolean(reel && (reel.phase === "accel" || reel.phase === "spin") && reel.spinTime >= MIN_SPIN_SEC);
      });
    }

    paintReels(false);
    settled.forEach(onReelSettled);
    if (chapter1RiverHoldRemaining > 0 && state.spinning) {
      chapter1RiverHoldRemaining = Math.max(0, chapter1RiverHoldRemaining - dt);
      active = true;
      if (chapter1RiverHoldRemaining <= 0 && reels.every(reel => reel.phase === "stopped")) finishSpin();
    }
    return active;
  }

  function updateMachineHud() {
    els.credit.textContent = state.credit;
    els.bet.textContent = state.bet;
    els.win.textContent = state.win;
    els.jackpot.textContent = state.jackpot;
    els.orbFill.style.width = `${Math.min(100, (state.orb / economyRules.orb.releaseThreshold) * 100)}%`;
    els.orbText.textContent = `ORB ${state.orb}/${economyRules.orb.releaseThreshold}`;
    els.push.classList.toggle("ready", !state.spinning || state.reelsStopped.some(stopped => !stopped));
    els.auto.classList.toggle("on", state.auto);
    els.turbo.classList.toggle("on", state.turbo);
    els.auto.setAttribute("aria-pressed", String(state.auto));
    els.turbo.setAttribute("aria-pressed", String(state.turbo));
    els.sound.classList.toggle("on", profile.settings.sound);
    const reducedMotion = isMotionReduced();
    els.motion.classList.toggle("on", reducedMotion);
    els.sound.setAttribute("aria-pressed", String(profile.settings.sound));
    els.motion.setAttribute("aria-pressed", String(reducedMotion));
    els.sound.setAttribute("aria-label", profile.settings.sound ? "Sound on" : "Sound off");
    els.motion.setAttribute("aria-label", reducedMotion ? "Reduced motion" : "Full motion");
    els.shell.classList.toggle("reduced-motion", reducedMotion);
    renderOrbGems();
    renderTreasure();
    renderCabinetMechanisms();
  }

  function renderCabinetMechanisms() {
    const panel = els.shell.querySelector(".cabinet-mechanisms");
    if (!panel) return; // Legacy and the separately exported Dragon player.
    const snapshot = [currentStageScript().id, state.phase, state.chapter1BetCoins, state.chapter1ReadReady, state.chapter1ReadStreak, state.trialScore, state.trialSpins, state.bonusGames, state.chapter1PreparedAllies.length].join(":");
    if (panel.dataset.snapshot === snapshot) return;
    panel.dataset.snapshot = snapshot;
    panel.hidden = currentStageScript().id !== "treasure";
    if (panel.hidden) return;
    const normal = state.phase === "normal";
    const ready = normal && state.chapter1ReadReady;
    panel.dataset.ready = String(ready);
    panel.querySelector("[data-cabinet-coins]").textContent = `${state.chapter1BetCoins} / ${chapter1Flow.BOSS_TABLE.requiredBetCoins}`;
    panel.querySelector("[data-cabinet-destination]").textContent = state.chapter1BetCoins >= chapter1Flow.BOSS_TABLE.requiredBetCoins ? "ロイヤルポット挑戦権" : "卓を突破して集める";
    const label = panel.querySelector("[data-cabinet-read-label]");
    const value = panel.querySelector("[data-cabinet-read]");
    const rule = panel.querySelector("[data-cabinet-read-rule]");
    label.textContent = normal ? "見切り" : state.phase === "trial" ? "VIP CHANCE" : state.phase === "bonus" ? "BONUS" : "TEAM LINK";
    value.textContent = normal ? ready ? "READY" : `${state.chapter1ReadStreak} / ${chapter1Flow.READ_ASSIST.missThreshold}` : state.phase === "trial" ? `${state.trialScore} / ${economyRules.trial.successScore}` : state.phase === "bonus" ? `残り ${state.bonusGames}G` : `${state.chapter1PreparedAllies.length}人 READY`;
    rule.textContent = normal ? ready ? "次の非REPLAYで STACK −1" : "不発4回 → 次の非REPLAYで−1" : state.phase === "trial" ? `残り ${Math.max(0, economyRules.trial.length - state.trialSpins)}G · 規定ポイントへ` : state.phase === "bonus" ? "小役保証のボーナス区間" : "準備した仲間が対決を強化";
    panel.querySelector(".cabinet-read-lamps").hidden = !normal;
    panel.querySelectorAll(".cabinet-read-lamps i").forEach((lamp, i) => lamp.classList.toggle("is-lit", i < state.chapter1ReadStreak || ready));
  }

  function updatePresentationHud() {
    const stage = stages[(state.stage - 1) % stages.length];
    const activeCast = cast[state.activeCast % cast.length];
    const script = currentStageScript();
    const chapter1Table = currentChapter1Table();
    const background = equippedItem("background");
    const effect = equippedEffect() || "none";
    const scene = currentSceneBlueprint();
    const sceneImage = scene.image ? asset(scene.image) : "";
    const stageImage = sceneImage || background?.stageImage || stage.image || adventureLcdBackground;
    els.stage.textContent = state.phase === "bonus" ? `BONUS ${state.bonusGames}/${economyRules.bonus.length}` : phaseLabel();
    els.mode.textContent = phaseLabel();
    const objective = currentObjectiveText();
    const presentation = currentPresentationStatus();
    els.featureName.textContent = objective;
    els.objectiveLabel.textContent = objective;
    els.timeLabel.textContent = presentation.time;
    els.expectationStars.textContent = `${"★".repeat(presentation.level)}${"☆".repeat(5 - presentation.level)}`;
    els.expectationStars.dataset.level = String(presentation.level);
    els.shell.dataset.gamePhase = presentation.phase;
    els.shell.dataset.phaseHeat = String(presentation.heat);
    els.shell.dataset.phaseCue = presentation.cue;
    els.shell.dataset.phaseTone = presentation.tone;
    const royalOrder = chapter1RoyalOrderProgress();
    if (royalOrder) {
      els.shell.dataset.chapter1RoyalOrder = royalOrder.id;
      els.shell.dataset.chapter1RoyalOrderProgress = royalOrder.compact;
      els.shell.dataset.chapter1RoyalOrderTitle = royalOrder.title;
      els.shell.dataset.chapter1RoyalOrderResult = state.chapter1RunOrderResolved
        ? state.chapter1RunOrderComplete ? "clear" : "miss"
        : "active";
      if (state.chapter1RunOrderResolved) {
        const crownArchive = chapter1Flow.royalReplayCrestState(profile.stats.chapter1RoyalOrderCrests);
        els.shell.dataset.chapter1RoyalCrestAward = state.chapter1RunOrderComplete
          ? state.chapter1RunCrestSetComplete
            ? "complete"
            : state.chapter1RunCrestFirst ? "new" : "stamp"
          : "miss";
        els.shell.dataset.chapter1RoyalCrestCount = String(crownArchive.count);
      } else {
        delete els.shell.dataset.chapter1RoyalCrestAward;
        delete els.shell.dataset.chapter1RoyalCrestCount;
      }
    } else {
      delete els.shell.dataset.chapter1RoyalOrder;
      delete els.shell.dataset.chapter1RoyalOrderProgress;
      delete els.shell.dataset.chapter1RoyalOrderTitle;
      delete els.shell.dataset.chapter1RoyalOrderResult;
      delete els.shell.dataset.chapter1RoyalCrestAward;
      delete els.shell.dataset.chapter1RoyalCrestCount;
    }
    els.shell.dataset.premonition = String(state.panyuStreak);
    els.shell.dataset.effect = effect;
    els.shell.dataset.scene = scene.key;
    els.shell.dataset.episode = script.id;
    if (script.id === "treasure" && !state.bossBattle) {
      // A table clear commits the next opponent before its payout scene plays.
      // Keep the defeated rival on-screen until that locked scene completes;
      // otherwise the next rival appears under the previous rival's dialogue.
      const preservingClearedOpponent = (state.transitioning || state.chapter1ArrivalPending)
        && Boolean(els.shell.dataset.chapter1ClearedOpponent);
      const displayTable = preservingClearedOpponent
        ? chapter1Flow.TABLE_ORDER.find(function (table) { return table.id === els.shell.dataset.chapter1ClearedOpponent; }) || chapter1Table
        : chapter1Table;
      const displayStack = preservingClearedOpponent ? 0 : state.chapter1OpponentStack;
      els.shell.dataset.chapter1Opponent = chapter1Table.id;
      els.shell.dataset.chapter1OpponentStack = String(state.chapter1OpponentStack);
      els.shell.dataset.chapter1BetCoins = String(state.chapter1BetCoins);
      els.shell.dataset.chapter1AllyFocus = String(state.chapter1AllyFocus);
      els.shell.dataset.chapter1ReadyCount = String(state.chapter1PreparedAllies.length);
      els.shell.dataset.chapter1ReadStreak = String(state.chapter1ReadStreak);
      els.shell.dataset.chapter1ReadReady = String(state.chapter1ReadReady);
      if (!preservingClearedOpponent) {
        els.shell.dataset.chapter1DisplayOpponent = chapter1Table.id;
        delete els.shell.dataset.chapter1ClearedOpponent;
        delete els.shell.dataset.chapter1TableDamage;
        delete els.shell.dataset.chapter1TableHeat;
        delete els.shell.dataset.chapter1TableStack;
        els.casinoOpponent.classList.remove("is-poked");
        els.casinoTableHud.classList.remove("is-poked");
        els.casinoOpponent.src = chapter1Table.baseAsset;
        els.casinoOpponent.alt = chapter1Table.name;
      }
      els.casinoOpponent.hidden = false;
      const forecasts = [];
      if (state.chapter1AllyFocus > 0) forecasts.push("ALLY READY");
      if (state.chapter1ReadReady) forecasts.push("見切り READY");
      else if (state.chapter1ReadStreak > 0) forecasts.push(`観察 ${state.chapter1ReadStreak}/${chapter1Flow.READ_ASSIST.missThreshold}`);
      const forecast = forecasts.length > 0 ? ` · ${forecasts.join(" · ")}` : "";
      const clearedTables = Math.min(chapter1Flow.TABLE_ORDER.length, state.chapter1BetCoins);
      const route = chapter1Flow.TABLE_ORDER.map((table, index) => {
        const status = index < clearedTables ? "clear" : table.id === displayTable.id ? "current" : "next";
        return `<li data-table-route="${status}" ${status === "current" ? 'aria-current="step"' : ""}><b>${status === "clear" ? "✓" : index + 1}</b><span>${table.name.replace("先輩", "")}</span><small>${status === "clear" ? "突破" : status === "current" ? "対戦中" : "次の卓"}</small></li>`;
      }).join("");
      const stackMeter = Array.from({length:displayTable.stack}, (_, index) => `<b data-stack-filled="${index < displayStack}" aria-hidden="true"></b>`).join("");
      const nextConsequence = displayStack === 0 ? "BET COINを獲得 · 次の卓へ"
        : state.chapter1ReadReady ? "見切り READY · 次の非REPLAYで STACK −1"
        : `STACKを0にして、次の卓へ${forecast}`;
      const runRoute=els.shell.querySelector("#casinoRunRoute");
      if(runRoute){runRoute.hidden=state.phase!=="normal";runRoute.innerHTML=`<p>4人の卓を突破して、ロイヤルポットへ</p><ol class="casino-table-route" aria-label="4人の卓の進行">${route}</ol>`;}
      els.casinoTableHud.innerHTML = document.body.dataset.cabinetLayout === "desktop-v5"
        ? `<div class="casino-table-status"><strong>${displayTable.name}</strong><span>STACK ${displayStack}</span></div><div class="casino-stack-meter" aria-label="相手の残りSTACK ${displayStack} / ${displayTable.stack}">${stackMeter}</div><i>BET COIN ${state.chapter1BetCoins}/${chapter1Flow.BOSS_TABLE.requiredBetCoins}</i><p class="casino-table-next">${nextConsequence}</p>`
        : `<strong>${displayTable.name}</strong><span>STACK ${displayStack}</span><i>BET COIN ${state.chapter1BetCoins}/${chapter1Flow.BOSS_TABLE.requiredBetCoins}${forecast}</i>`;
      els.casinoTableHud.hidden = false;
    } else {
      delete els.shell.dataset.chapter1Opponent;
      delete els.shell.dataset.chapter1DisplayOpponent;
      delete els.shell.dataset.chapter1ClearedOpponent;
      delete els.shell.dataset.chapter1AllyFocus;
      delete els.shell.dataset.chapter1ReadyCount;
      delete els.shell.dataset.chapter1ReadStreak;
      delete els.shell.dataset.chapter1ReadReady;
      delete els.shell.dataset.chapter1TableDamage;
      delete els.shell.dataset.chapter1TableHeat;
      delete els.shell.dataset.chapter1TableStack;
      els.casinoOpponent.hidden = true;
      els.casinoTableHud.hidden = true;
      const runRoute=els.shell.querySelector("#casinoRunRoute");if(runRoute)runRoute.hidden=true;
    }
    els.shell.dataset.step = String(state.adventureStep);
    const treasureOwnsChapterCopy = script.id === "treasure";
    els.episodeLabel.textContent = treasureOwnsChapterCopy ? "" : `EPISODE ${String(script.number).padStart(2, "0")} / ${script.series}`;
    els.sequenceLabel.textContent = treasureOwnsChapterCopy ? "" : scene.label;
    els.sequenceTitle.textContent = treasureOwnsChapterCopy ? "" : scene.title;
    els.sequenceObjective.textContent = treasureOwnsChapterCopy ? "" : scene.objective;
    if (!treasureOwnsChapterCopy) presentSceneNotice(scene, script);
    els.sceneEnemy.classList.toggle("show", scene.key === "boss");
    els.enemyTitle.textContent = script.boss.name;
    if (scene.key === "boss" || state.bossBattle) {
      const bossState = els.bossSprite.dataset.state || "idle";
      const bossImage = currentBossImage(bossState);
      if (bossImage && els.bossSprite.getAttribute("src") !== bossImage) els.bossSprite.src = bossImage;
      if (!bossImage) els.bossSprite.removeAttribute("src");
      els.bossSprite.alt = script.boss.name;
    }
    els.shell.classList.toggle("bonus-mode", state.phase === "bonus" || state.orb >= economyRules.adventure.raidSceneOrbThreshold);
    els.stageName.textContent = treasureOwnsChapterCopy ? "" : state.phase === "trial" ? phaseLabel() : state.phase === "bonus" ? "RESORT BONUS" : stage.name;
    els.stageSub.textContent = treasureOwnsChapterCopy ? "" : state.bossBattle ? `${currentBossEntity().name}との決戦` : state.phase === "bonus" ? `${economyRules.bonus.length}ゲーム・毎ゲーム小役保証` : script.intro || stage.sub;
    els.stageBg.style.setProperty("--stage-image", `url("${stageImage}")`);
    els.stageBg.style.setProperty("--equipped-background", background?.stageImage ? `url("${background.stageImage}")` : "none");
    els.stageBg.style.filter = `saturate(1.16) contrast(1.06) drop-shadow(0 0 18px ${stage.color}33)`;
    const sceneActorImage = scene.actorImage ? asset(scene.actorImage) : "";
    const equippedCostume = equippedItem("costume");
    // `rookie` is the profile fallback, not an explicit story-direction choice.
    // Let chapter acting poses win over it; paid/user-selected costumes still win.
    const hasEquippedMimiCostume = activeCast.id === "mimi" && Boolean(equippedCostume && equippedCostume.id !== "rookie");
    const fallbackCharacterImage = activeCharacterImage(activeCast);
    // Treasure owns its visible cast through the V8 casino/poker layers. Do not
    // start a hidden legacy dialogue-pose request that the next semantic scene
    // will immediately abort when #characterArt is not part of the composition.
    const treasureOwnsActorLayer = currentStageScript().id === "treasure";
    const preferredCharacterImage = activeCast.id === "mimi" && sceneActorImage && !hasEquippedMimiCostume && !treasureOwnsActorLayer
      ? sceneActorImage
      : fallbackCharacterImage;
    els.characterArt.onerror = function () {
      if (!fallbackCharacterImage || els.characterArt.getAttribute("src") === fallbackCharacterImage) return;
      els.characterArt.onerror = null;
      els.characterArt.src = fallbackCharacterImage;
    };
    els.characterArt.src = preferredCharacterImage;
    els.characterArt.alt = activeCast.name;
    els.speaker.textContent = els.characterDialog.dataset.messageSpeaker || (activeCast.name === "Mimi" ? "MIMI" : activeCast.name.toUpperCase());
    renderBattleStatus();
  }

  function updateHud() {
    updateMachineHud();
    updatePresentationHud();
  }

  function presentSceneNotice(scene, script) {
    const signature = `${script.id}:${scene.key}:${state.phase}`;
    if (currentView !== "slot" || signature === lastSceneSignature) return;
    lastSceneSignature = signature;
    clearTimeout(sceneNoticeTimer);
    els.sequence.classList.remove("show");
    void els.sequence.offsetWidth;
    els.sequence.classList.add("show");
    sceneNoticeTimer = window.setTimeout(() => els.sequence.classList.remove("show"), 2100);
  }

  function currentObjectiveText() {
    const royalOrder = chapter1RoyalOrderProgress();
    if (state.chapter1RunOrderResolved && royalOrder) {
      const orderResult = state.chapter1RunOrderComplete
        ? state.chapter1RunCrestSetComplete
          ? "ROYAL CROWN COMPLETE"
          : state.chapter1RunCrestFirst ? `NEW CREST · ${royalOrder.title}` : `CROWN STAMP · ${royalOrder.title}`
        : `ORDER MISSED · ${royalOrder.title} · ${royalOrder.compact}`;
      if (state.phase === "bonus") return `${orderResult} · BONUS 残り${state.bonusGames}G`;
      return orderResult;
    }
    if (royalOrderMilestoneText && royalOrder) return royalOrderMilestoneText;
    if (royalOrder?.id === "strong" && chapter1HotGuideMode === "aim") {
      return `HOT HAND · AIM！ ${chapter1HotGuideHits + 1}つ目のSTOPを今押す`;
    }
    if (royalOrder?.id === "strong" && chapter1HotGuideMode === "ready") {
      return chapter1HotGuideHits > 0
        ? `HOT HAND · HIT ${chapter1HotGuideHits}/3 · 次のAIMを待つ`
        : "HOT HAND · READYでは押さない → AIMでSTOP";
    }
    if (state.phase === "bonus") return `BONUS 残り${state.bonusGames}G`;
    if (state.phase === "trial") return `${phaseLabel()} ${state.trialSpins}/${economyRules.trial.length}G`;
    const royalSuffix = royalOrder ? ` · ORDER ${royalOrder.compact}` : "";
    if (state.bossBattle) return `${currentBossEntity().name}撃破${royalSuffix}`;
    if (currentStageScript().id === "treasure") return `${currentChapter1Table().name}に勝つ${royalSuffix}`;
    if (state.orb >= economyRules.orb.releaseThreshold) return "ORB BURST発動";
    if (state.nearMiss > 0) return "テンパイ追撃";
    if (state.panyuStreak > 0) return `ぱにゅ期待 Lv.${Math.min(5, state.panyuStreak + 1)}`;
    if (state.treasure >= 3) return "宝箱BONUS接近";
    if (state.enemiesToBonus <= 2) return "BOSS接近";
    return "JACKPOT探索";
  }

  function currentPresentationStatus() {
    const snapshot = currentPresentationHeat();
    const labels = {
      day: "DAY / 昼",
      dusk: "DUSK / 夕暮れ",
      night: "NIGHT / 夜",
      trial: "AURA / 特訓",
      bonus: "BONUS / 祝祭",
      battle: "TELL / 決戦",
    };
    return Object.assign({ time: labels[snapshot.field] || "DAY / 昼", level: snapshot.heat }, snapshot);
  }

  function currentSceneKey() {
    if (debugSceneOverride) return debugSceneOverride;
    if (state.sceneMode === "bonus" && state.phase === "bonus") return "bonus";
    if (state.sceneMode === "boss" && (state.bossBattle || state.phase === "battle")) return "boss";
    if (state.phase === "bonus") return "bonus";
    if (state.bossBattle || state.phase === "battle") return "boss";
    if (state.phase === "trial") return "chain";
    if (["explore", "omen", "chain"].includes(state.sceneMode)) return state.sceneMode;
    if (state.panyuStreak > 0 || state.nearMiss > 0 || state.orb >= 4 || state.enemiesToBonus <= 2 || state.adventureStep >= 3) return "omen";
    return "explore";
  }

  function currentSceneBlueprint() {
    const script = currentStageScript();
    const sceneKey = currentSceneKey();
    const scenes = adventureSceneBlueprints[script.id] || adventureSceneBlueprints.treasure;
    return { ...scenes[sceneKey], key: sceneKey };
  }

  function renderBattleStatus() {
    // Legacy road/party nodes remain only for the exact DOM contract. They no
    // longer animate or select actors; semantic presentation owns all acting.
    els.battleCounter.textContent = currentStageScript().id === "treasure"
      ? ""
      : state.bossBattle
      ? `${currentBossEntity().name} HP ${state.bossHp}% / ${Math.max(0, (currentStageScript().id === "treasure" ? currentTreasureBossAdvantage().turnLimit : economyRules.boss.turnLimit) - state.bossTurns)}T`
      : state.phase === "bonus"
        ? `BONUS 残り ${state.bonusGames}G`
        : state.phase === "trial"
          ? `${phaseLabel()} ${state.trialScore}ポイント`
          : `BOSS前兆まで ${state.enemiesToBonus}体`;
    els.bossHp.classList.toggle("show", state.bossBattle);
    els.bossSprite.classList.toggle("show", state.bossBattle);
    els.bossHpFill.style.width = `${Math.max(0, state.bossHp)}%`;
  }

  function renderOrbGems() {
    els.orbGems.innerHTML = orbColors.map((color, index) => {
      const filled = index < state.orb ? " filled" : "";
      const label = index === orbColors.length - 1 ? "MAX" : String(index + 1);
      return `<div class="orb-gem${filled}" style="--gem-color:${color}">${label}</div>`;
    }).join("");
  }

  function renderTreasure() {
    if (currentStageScript().id === "treasure") {
      els.treasureStock.innerHTML = chapter1Flow.TABLE_ORDER.map((table, index) => {
        const filled = index < state.chapter1BetCoins ? " filled" : "";
        const prepared = state.chapter1PreparedAllies.includes(table.id);
        const ready = prepared ? " ready" : "";
        const awarding = els.shell.dataset.chapter1ClearedOpponent === table.id ? " awarding" : "";
        const label = filled
          ? `${table.name}のBETコイン${prepared ? "、連携READY" : ""}`
          : `${table.name}のBETコイン`;
        return `<div class="treasure-slot bet-coin${filled}${ready}${awarding}" data-opponent="${table.id}" data-ready="${prepared}" data-mark="${table.name.slice(0, 1)}" title="${label}"><img src="${table.baseAsset}" alt="${label}"></div>`;
      }).join("");
      return;
    }
    // Later chapters retain this legacy stock until their own authored table
    // replaces it.
    const chest = core.SYMBOL_BY_ID.get(core.JACKPOT_SYMBOL);
    els.treasureStock.innerHTML = Array.from({ length: 4 }).map((_, index) => {
      const filled = index < state.treasure ? " filled" : "";
      return `<div class="treasure-slot${filled}"><img src="${symImage(chest)}" alt=""></div>`;
    }).join("");
  }

  function updateButtons() {
    const resolving = state.spinning && state.reelsStopped.every(Boolean);
    els.spin.textContent = resolving ? "判定中" : state.spinning ? "STOP" : "SPIN";
    els.spin.setAttribute("aria-label", resolving ? "リール決着待ち" : state.spinning ? "次のリールを止める" : "スピン");
    // 始動ボタンは指定書の絵を貼っているので、状態を class でも出す。
    // 文字は読み上げ用に残し、見た目は絵の差し替えで伝える。
    els.spin.classList.toggle("is-stopping", state.spinning);
    els.spin.classList.toggle("is-resolving", resolving);
    const chapterCommandCanSpin = Boolean(chapter1Command && chapter1Command.index === chapter1Command.steps.length - 1);
    const spinDisabled = resolving || (state.transitioning && !chapterCommandCanSpin) || state.chapter1ArrivalPending || state.bossResolutionPending || currentView !== "slot";
    const tactileControls = usesChapter1CommandSurface() && currentView === "slot";
    els.spin.dataset.inputReady = String(!spinDisabled);
    els.spin.classList.toggle("is-disabled", spinDisabled && !tactileControls);
    els.spin.disabled = spinDisabled && !tactileControls;
    els.spin.setAttribute("aria-disabled", String(spinDisabled && !tactileControls));
    const wagerDisabled = state.spinning || state.transitioning || state.bossResolutionPending;
    els.betDown.classList.toggle("is-disabled", wagerDisabled);
    els.betUp.classList.toggle("is-disabled", wagerDisabled);
    els.betDown.disabled = wagerDisabled;
    els.betUp.disabled = wagerDisabled;
    els.betDown.setAttribute("aria-disabled", String(wagerDisabled));
    els.betUp.setAttribute("aria-disabled", String(wagerDisabled));
    els.stopButtons.forEach((button, index) => {
      const pending = Boolean(reels[index]?.pendingStop);
      const active = state.spinning && !state.reelsStopped[index] && !pending;
      button.classList.toggle("is-pending", pending);
      button.dataset.inputReady = String(active);
      button.classList.toggle("is-disabled", !active && !tactileControls);
      button.disabled = !active && !tactileControls;
      button.setAttribute("aria-disabled", String(!active && !tactileControls));
      button.setAttribute("aria-label", pending
        ? `${index + 1}番リール停止予約済み`
        : active ? `${index + 1}番リールを止める` : `${index + 1}番リール停止`);
    });
    const chapterCommandCanPush = Boolean(chapter1Command && chapter1Command.index < chapter1Command.steps.length - 1);
    els.push.hidden = !chapterCommandCanPush;
    els.push.disabled = !chapterCommandCanPush;
    els.push.setAttribute("aria-hidden", String(!chapterCommandCanPush));
    els.push.setAttribute("aria-disabled", String(!chapterCommandCanPush));
    els.push.setAttribute("aria-label", chapterCommandCanPush ? "メッセージを次へ進める" : "PUSH");
  }

  /**
   * RESULTへ渡す直前に、下リールを一枚の静止画として確定する。
   * STOP後の着地バウンドや速度ブラーを上部の勝敗表示と重ねない。
   */
  function settleReelVisuals() {
    reels.forEach(reel => {
      setBlur(reel, false);
      reel.node.classList.remove("is-landing", "is-slipped");
      reel.node.dataset.reelPhase = "stopped";
    });
    if (els.reelFrame) {
      els.reelFrame.dataset.reelState = "settled";
      els.reelFrame.setAttribute("aria-busy", "false");
    }
    els.shell.dataset.reelState = "settled";
    paintReels(true);
  }

  function stopNextReel() {
    const next = reels.find(reel => (reel.phase === "accel" || reel.phase === "spin") && !reel.pendingStop && !currentSpin?.stops[reel.col]);
    if (next) stopReel(next.col);
  }

  function armSafetyStop() {
    clearTimeout(safetyTimer);
    const autoStopSeconds = chapter1HotHandSpinEligible() ? HOT_AUTO_STOP_SEC : AUTO_STOP_SEC;
    safetyTimer = window.setTimeout(function autoStop() {
      if (!state.spinning) return;
      safetyAutoDraining = true;
      stopNextReel();
      safetyAutoDraining = false;
      if (state.spinning) safetyTimer = window.setTimeout(autoStop, state.turbo ? 200 : 320);
    }, (state.turbo ? autoStopSeconds * 0.45 : autoStopSeconds) * 1000);
  }

  // Once all three physical STOP inputs have been accepted, normal settlement
  // is driven by requestAnimationFrame. Browsers may suspend that callback
  // while a player is inspecting or switching the page, so keep a wall-clock
  // escape hatch that advances the exact same brake/river-hold state machine.
  // The delay is longer than the normal visible sequence and therefore does
  // not alter ordinary play, stop decisions, or RNG consumption.
  function armSettlementSafety() {
    clearTimeout(settlementSafetyTimer);
    settlementSafetyTimer = window.setTimeout(() => {
      settlementSafetyTimer = 0;
      if (!state.spinning || !state.reelsStopped.every(Boolean)) return;
      for (let guard = 0; guard < 250 && state.spinning; guard += 1) {
        advance(0.016);
      }
    }, 3000);
  }

  /** 現在のゲーム性に応じた内部抽選テーブル。 */
  function flagMode() {
    if (state.phase === "bonus") return "bonus";
    if (state.phase === "trial" || state.phase === "battle" || state.bossBattle) return "hot";
    return "normal";
  }

  // The reel machine publishes its own channel. Upper-LCD presentation code
  // must not infer these inputs from button classes or consume them as scenes.
  function publishReelEvent(eventName, payload) {
    const detail = Object.freeze(Object.assign({}, payload || {}));
    paintSpinReceipt(detail);
    if (els.reelFrame) {
      els.reelFrame.dataset.reelEvent = String(detail.type || eventName || "");
      els.reelFrame.dataset.reelTransaction = String(detail.transactionId || "");
      els.reelFrame.dataset.reelStopCount = String(Number(detail.stoppedCount) || 0);
    }
    if (typeof window.CustomEvent !== "function") return false;
    window.dispatchEvent(new window.CustomEvent(eventName, { detail }));
    return true;
  }

  // This is a receipt for the existing transaction, never a second wallet or
  // a prediction from the internal flag. The accepted STOP count is public;
  // payout and net change appear only after the one-way settlement boundary.
  function paintSpinReceipt(detail) {
    const receipt = els.shell?.querySelector("#spinReceipt");
    if (!receipt) return;
    const label = receipt.querySelector("span");
    const value = receipt.querySelector("strong");
    const note = receipt.querySelector("small");
    if (detail.type === "ready") {
      receipt.classList.remove("is-awarded");
      receipt.dataset.outcome = "ready";
      ["transaction", "payout", "reelPayout", "extra", "debit", "net", "tier"].forEach(key => delete receipt.dataset[key]);
      label.textContent = "READY";
      value.textContent = "勝負を始める";
      note.textContent = "3つのSTOPで決着";
      return;
    }
    if (!currentSpin) return;
    const treasureNormal = stageScripts[currentSpin.stageAtStart - 1]?.id === "treasure" && currentSpin.phaseAtStart === "normal";
    const debit = Math.max(0, Number(currentSpin.debit) || 0);
    const stake = debit > 0 ? `BET ${debit}` : currentSpin.isBonusFree ? "BONUS · BETなし" : "REPLAY · BETなし";
    receipt.classList.remove("is-awarded");
    if (detail.type === "spin-start" || detail.type === "stop-accepted") {
      if (detail.type === "spin-start") {
        ["transaction", "payout", "reelPayout", "extra", "debit", "net", "tier"].forEach(key => delete receipt.dataset[key]);
      }
      const stopped = Math.max(0, Math.min(3, Number(detail.stoppedCount) || 0));
      receipt.dataset.outcome = "spinning";
      label.textContent = stake;
      value.textContent = stopped === 3 ? "勝敗を判定中" : `STOP ${stopped} / 3`;
      note.textContent = stopped === 3 ? "最後の一枚を見届けよう" : stopped === 2 ? "最終STOPで決着" : "好きな順番で止めよう";
      return;
    }
    if (detail.type !== "settled") return;
    const reelPayout = Math.max(0, Number(detail.payout) || 0);
    // WIN also includes an existing synchronous refund/ORB release. Those
    // credits belong to this settlement without changing the reel event.
    const payout = Math.max(0, Number(state.win) || 0);
    const extra = Math.max(0, payout - reelPayout);
    const net = payout - debit;
    const netText = `差引 ${net > 0 ? "+" : net < 0 ? "−" : ""}${Math.abs(net)}`;
    receipt.dataset.outcome = detail.outcome;
    receipt.dataset.transaction = String(detail.transactionId);
    receipt.dataset.payout = String(payout);
    receipt.dataset.reelPayout = String(reelPayout);
    receipt.dataset.extra = String(extra);
    receipt.dataset.debit = String(debit);
    receipt.dataset.net = String(net);
    if (detail.outcome === "replay" && payout === 0) {
      label.textContent = "REPLAY";
      value.textContent = "次はBETなし";
      note.textContent = "SPINで無料のもう一回";
    } else if (payout > 0) {
      receipt.dataset.outcome = detail.outcome === "jackpot" ? "jackpot" : "win";
      label.textContent = detail.outcome === "replay" ? "REPLAY + CREDIT" : currentSpin.isBonusFree ? "BONUS WIN" : extra > 0 ? "獲得CREDIT · 合計" : "WIN · CREDIT";
      value.textContent = `+${payout.toLocaleString("ja-JP")}`;
      note.textContent = detail.outcome === "replay" ? `次はBETなし · ${netText}` : `${stake} · ${netText}`;
      if (extra > 0) note.textContent += `\n配当 ${reelPayout} + 追加 ${extra}`;
      receipt.dataset.tier = detail.outcome === "jackpot" || payout >= currentSpin.bet * 10 ? "big" : "small";
      if (!isMotionReduced()) {
        void receipt.offsetWidth;
        receipt.classList.add("is-awarded");
      }
    } else if (els.shell.dataset.chapter1PokerOutcome === "mimi" && treasureNormal) {
      receipt.dataset.outcome = "read-break";
      label.textContent = "見切り成功";
      value.textContent = "STACK −1";
      note.textContent = "配当 0 · 相手の守りを崩した";
    } else if (state.chapter1ReadReady && treasureNormal) {
      receipt.dataset.outcome = "read-ready";
      label.textContent = "見切り READY";
      value.textContent = "次で崩す";
      note.textContent = "配当 0 · 次の決着でSTACK −1";
    } else {
      label.textContent = "配当なし";
      value.textContent = treasureNormal && state.chapter1ReadStreak > 0 ? `癖を読む ${state.chapter1ReadStreak} / ${chapter1Flow.READ_ASSIST.missThreshold}` : "次の勝負へ";
      note.textContent = `${stake} · ${netText}`;
    }
  }

  function startSpin() {
    if (currentView !== "slot" || state.chapter1ArrivalPending || state.bossResolutionPending) return;
    if (state.spinning && state.reelsStopped.every(Boolean)) return;
    if (els.helpOverlay.hidden === false || els.creditRescue.hidden === false) return;
    if (chapter1Command) {
      if (chapter1Command.index < chapter1Command.steps.length - 1) return;
      clearChapter1Command();
    }
    if (state.transitioning) return;
    if (!flushPendingProfile()) return;
    if (state.spinning) {
      if (reels.some(reel => reel.phase !== "stopped")) {
        stopNextReel();
        return;
      }
      // リールは全部止まっているのに spinning が残っている状態。
      // 決着させてから、この呼び出しを新しいゲームとして続行する。
      finishSpin();
      state.spinning = false;
    }
    if (currentSpin && !currentSpin.resolved) return;
    debugSceneOverride = "";
    const isBonusGame = state.phase === "bonus";
    const isFree = state.freeSpin;
    if (!isBonusGame && !isFree && state.credit < state.bet) {
      openCreditRescue();
      return;
    }
    clearTimeout(autoTimer);
    clearTimeout(safetyTimer);
    clearTimeout(settlementSafetyTimer);
    cancelAnimationFrame(winCountFrame);
    winCountFrame = 0;
    audio.unlock();
    audio.setEnabled(profile.settings.sound);
    if (!isBonusGame && !isFree) state.credit -= state.bet;
    state.freeSpin = false;
    state.win = 0;
    if (!isBonusGame && !isFree) state.jackpot += economy.jackpotContribution(state.bet);
    state.spinning = true;
    state.justStopped = -1;
    state.reelsStopped = [false, false, false];
    state.nearMiss = 0;
    const mode = flagMode();
    // 内部抽選。ここで決まったフラグを、各リールの停止制御が引き込みに行く。
    state.flag = core.rollFlag(mode, gameRandom);
    state.flagLanded = false;
    if (els.reelFrame) {
      els.reelFrame.dataset.reelState = "spinning";
      els.reelFrame.setAttribute("aria-busy", "true");
    }
    els.shell.dataset.reelState = "spinning";
    currentSpin = spinSession.create({
      phase: state.phase,
      stage: state.stage,
      bet: state.bet,
      debit: !isBonusGame && !isFree ? state.bet : 0,
      isReplayFree: isFree,
      isBonusFree: isBonusGame,
      flagMode: mode,
      flag: state.flag,
      effect: equippedEffect()
    });
    chapter1HotAimCache.clear();
    els.stopButtons.forEach(button => {
      button.classList.remove("is-hot-ready", "is-hot-aim", "is-hot-hit");
      delete button.dataset.hotReady;
      delete button.dataset.hotAim;
      delete button.dataset.hotHit;
    });
    delete els.shell.dataset.chapter1HotAim;
    currentSpin.presentation = currentPresentationHeat(state.flag, mode);
    currentSpin.presentationHeat = currentSpin.presentation.heat;
    syncChapter1SpinHeat(currentSpin.presentation);
    syncChapter1PokerTable(0, "pending");
    clearHighlights();
    if(window.MimiReelLines)window.MimiReelLines.clear(els.paylineLayer);else els.paylineLayer.innerHTML='';
    els.reelFlare.classList.remove("show");
    els.reelFrame.classList.remove("anticipation");
    els.shell.querySelector?.(".casino-table-playfield")?.classList.remove("is-tenpai", "is-tenpai-hot");
    if (isFree) toast("REPLAY - BET不要");
    const chapterOneTreasure = currentStageScript().id === "treasure";
    if (state.phase === "bonus") {
      const destination = state.bonusOrigin === "boss-victory" ? "終了後は次の章へ。" : "終了後はボス戦へ。";
      if (!chapterOneTreasure) message(`RESORT BONUS 残り${state.bonusGames}G。毎ゲーム小役が成立し、${destination}`);
      addLog("BONUS", `${state.bonusGames}G`);
    } else if (state.phase === "trial") {
      if (!chapterOneTreasure) message(`${phaseLabel()} ${state.trialSpins + 1}/${economyRules.trial.length}G。小役・テンパイで成功期待度を上げよう。`);
      addLog("TRIAL", `${state.trialSpins + 1}/${economyRules.trial.length}G`);
    } else if (state.phase === "battle") {
      if (!chapterOneTreasure) message(`${currentBossEntity().name}との決戦。${economyRules.boss.turnLimit}ターン以内にWINを重ねて撃破しよう。`);
      addLog("BATTLE", `${state.bossTurns + 1}/${economyRules.boss.turnLimit}T`);
      if (state.bossStageId === "treasure") {
        showPresentationScene("treasure.boss.tell", {
          bossName: currentBossEntity().name,
          hp: state.bossHp,
          heat: currentSpin.presentationHeat,
          partyCount: state.bossPartyCount,
        });
      }
    } else {
      if (!chapterOneTreasure) message(`${currentStageScript().intro} 上部液晶の冒険はリール結果に合わせて進行する。`);
      if (!chapterOneTreasure) addLog("AIM", "小役 → CHANCE → 連続演出 → BONUS");
    }
    maybeChanceCue("start");
    audio.spinStart();
    if (currentStageScript().id === "treasure") audio.roleAnticipation?.(state.flag, currentSpin.presentationHeat);
    publishReelEvent("mimi:reel-input", {
      type: "spin-start",
      transactionId: currentSpin.id,
      stoppedCount: 0,
    });
    updateMachineHud();

    reels.forEach((reel, col) => {
      reel.phase = "accel";
      reel.node.dataset.reelPhase = "spinning";
      reel.speed = 0;
      reel.delay = col * 0.05;
      reel.slowed = false;
      reel.pendingStop = false;
      reel.spinTime = 0;
      reel.hotAimReady = false;
      reel.hotAimHold = 0;
      reel.hotAimLastNatural = null;
    });
    // 回し始めた時点でボタンの表示を更新する。これが無いと
    // 最初のリールが止まるまで始動ボタンが「SPIN」のままだった。
    updateButtons();
    requestFrame();

    // 放置されたら順番に自動停止する。物理STOPを受け付けるたび、
    // 残ったリールには新しい入力猶予を与える。
    armSafetyStop();
  }

  /**
   * STOP 押下。ウェイト中なら予約だけして、明けたリールから順に engageStop へ回す。
   */
  function stopReel(col) {
    const reel = reels[col];
    if (!state.spinning || !reel) return;
    if (reel.phase !== "accel" && reel.phase !== "spin") return;
    if (reel.pendingStop) return;
    if (!usesChapter1CommandSurface() && reel.spinTime < MIN_SPIN_SEC) {
      reel.pendingStop = true;
      spinSession.queueStop(currentSpin, col);
      updateButtons();
      requestFrame();
      return;
    }
    engageStop(reel);
  }

  /**
   * 実際の停止制御。押した瞬間の位置から 0〜4 コマだけ滑らせて、
   * 成立フラグを引き込む（ハズレなら役を蹴飛ばす）。
   */
  function engageStop(reel) {
    const stopButton = els.stopButtons[reel.col];
    const chapter1HotHit = Boolean(stopButton?.classList.contains("is-hot-aim"));
    const stopped = spinSession.knownStops(currentSpin, reel.col);

    const natural = Math.floor(reel.pos);
    const decision = core.chooseStop({
      col: reel.col,
      natural,
      flag: currentSpin.flag,
      stopped,
      // ハズレのときは、ときどきわざとテンパイ目を作ってから外す。
      tease: currentSpin.flag === "none" && gameRandom() < economyRules.stopControl.teaseChance
    });

    reel.index = decision.index;
    reel.slip = decision.slip;
    reel.pulledIn = decision.pulledIn;
    reel.brakeFrom = reel.pos;
    reel.brakeTo = natural - decision.slip;
    reel.brakeT = 0;
    reel.brakeStartedAt = performance.now();
    reel.brakeDur = usesChapter1CommandSurface() ? 0.05 : Math.max(0.09, 0.06 + (reel.pos - reel.brakeTo) * 0.05);
    reel.phase = "brake";
    if (usesChapter1CommandSurface()) {
      // Like the independent cabinets, latch the selected symbols in this
      // input task. Decorative braking/settlement must not delay their paint.
      reel.pos = core.mod(reel.brakeTo, reel.length);
      reel.band.style.setProperty("--q", String(reel.pos + reel.length));
      markWindowCells();
      setBlur(reel, false);
      reel.node.dataset.reelPhase = "brake";
    }
    spinSession.recordStop(currentSpin, reel.col, {
      natural,
      index: decision.index,
      slip: decision.slip,
      pulledIn: decision.pulledIn
    });
    state.reelsStopped[reel.col] = true;
    if (state.reelsStopped.every(Boolean)) {
      if (els.reelFrame) {
        els.reelFrame.dataset.reelState = "resolving";
        els.reelFrame.setAttribute("aria-busy", "true");
      }
      els.shell.dataset.reelState = "resolving";
    }
    audio.reelStop(reel.col, decision.slip);
    if (usesChapter1CommandSurface() && currentStageScript().id === "treasure") {
      audio.roleStop?.(currentSpin?.flag || state.flag || "none", state.reelsStopped.filter(Boolean).length, reel.col, { immediate: true });
    }
    publishReelEvent("mimi:reel-input", {
      type: "stop-accepted",
      transactionId: currentSpin.id,
      reelIndex: reel.col,
      stoppedCount: state.reelsStopped.filter(Boolean).length,
    });
    updateButtons();
    if (state.reelsStopped.every(Boolean)) {
      clearTimeout(safetyTimer);
      armSettlementSafety();
    } else if (!safetyAutoDraining) {
      armSafetyStop();
    }
    if (chapter1HotHit && stopButton) {
      stopButton.classList.remove("is-hot-ready", "is-hot-aim");
      delete stopButton.dataset.hotReady;
      stopButton.classList.add("is-hot-hit");
      stopButton.dataset.hotHit = "true";
      stopButton.setAttribute("aria-label", `${reel.col + 1}番リール HOTタイミング成功`);
    }
    requestFrame();
  }

  function onReelSettled(reel) {
    spinSession.markSettled(currentSpin, reel.col);
    state.justStopped = reel.col;
    syncGrid();
    impact(reel.col);
    reel.node.classList.remove("is-landing");
    if (!usesChapter1CommandSurface()) void reel.node.offsetWidth;
    reel.node.classList.add("is-landing");
    reel.node.dataset.reelPhase = "stopped";
    window.setTimeout(() => reel.node.classList.remove("is-landing"), 420);

    if (reel.slip >= 3) {
      // 大きく滑った = 制御が働いた合図。実機の「スベリ」演出。
      reel.node.classList.add("is-slipped");
      window.setTimeout(() => reel.node.classList.remove("is-slipped"), 620);
      if (!usesChapter1CommandSurface()) audio.cue("notice");
    }

    const roleStopCount = Math.min(3, currentSpin?.stops?.filter(stop => stop?.settled).length || 0);
    if (!usesChapter1CommandSurface() && currentStageScript().id === "treasure") audio.roleStop?.(currentSpin?.flag || state.flag || "none", roleStopCount, reel.col);
    commitChapter1StopDeal(reel.col, roleStopCount);
    syncChapter1PokerTable(roleStopCount, "pending");

    teaseAfterStop(reel.col);
    if (reel.col === 1 && gameRandom() < economyRules.stopControl.middleCueChance) maybeChanceCue("middle");
    if (reels.every(other => other.phase === "stopped")) {
      const holdRiver = currentStageScript().id === "treasure"
        && state.phase === "normal"
        && !isMotionReduced();
      if (!holdRiver) {
        finishSpin();
        return;
      }
      chapter1RiverHoldRemaining = CHAPTER1_RIVER_HOLD_MS / 1000;
      requestFrame();
    }
  }

  function stoppedColumns() {
    return reels.filter(reel => reel.phase === "stopped").map(reel => reel.col);
  }

  function findNearLine() {
    const stopped = new Set(stoppedColumns());
    let bestMatch = null;
    paylines.forEach(line => {
      const visibleCells = line.cells.filter(([col]) => stopped.has(col));
      if (visibleCells.length < 2 || visibleCells.length >= 3) return;
      const ids = visibleCells.map(([col, row]) => state.grid[col][row].id);
      if (ids[0] !== ids[1]) return;
      const sym = symbols.find(item => item.id === ids[0]);
      // Fruit pairs are common noise across five paylines. Only BAR and 7s
      // become a player-facing tenpai signal.
      if (!sym || sym.id === "replay" || sym.tier === "small") return;
      if (!bestMatch || sym.pay > bestMatch.sym.pay) {
        bestMatch = { line, sym, cells: visibleCells };
      }
    });
    return bestMatch;
  }

  function teaseAfterStop(col) {
    const stoppedCount = stoppedColumns().length;
    if (stoppedCount !== 2) return;
    const match = findNearLine();
    if (!match) return;
    state.nearMiss += 1;
    // テンパイしたら残りのリールを減速させる（実機のテンパイ時スロー回転）。
    reels.forEach(reel => {
      if (reel.phase === "accel" || reel.phase === "spin") reel.slowed = true;
    });
    els.reelFrame.classList.remove("anticipation");
    void els.reelFrame.offsetWidth;
    els.reelFrame.classList.add("anticipation");
    const hot = match.sym.pay >= 24 || state.orb >= 4;
    const tableOwnsTenpai = stageChapter1TableTenpai(hot);
    if (!tableOwnsTenpai) {
      showChance("", `ミミ「${match.sym.name}、あとひとつ！」`, "\u00a0", hot);
      burst(hot ? 18 : 10, hot ? "#ffd36a" : "#ff5fb7");
    }
    vibrate(hot ? [18, 28, 18] : 14);
    audio.tenpai(hot ? 1 : Math.min(0.68, 0.36 + match.sym.pay / 100));
    addLog("CHANCE", `${match.sym.name} テンパイ`);
    updateHud();
  }

  function finishSpin() {
    if (!state.spinning && state.reelsStopped.every(Boolean)) {
      updateButtons();
      return;
    }
    chapter1RiverHoldRemaining = 0;
    state.spinning = false;
    clearTimeout(safetyTimer);
    clearTimeout(settlementSafetyTimer);
    settleReelVisuals();
    updateButtons();
    const transaction = currentSpin;
    if (!transaction || transaction.resolved) return;
    // Claim the one-way settlement boundary before any persistent reward.
    // Re-entrant finish calls cannot count or grant this transaction twice.
    if (!spinSession.resolve(transaction)) return;
    const spinPhase = transaction.phaseAtStart;
    const result = evaluate();
    result.presentationHeat = Math.max(1, Math.min(5, Number(transaction.presentationHeat) || 1));
    result.presentationCue = transaction.presentation?.cue || "tell-quiet";
    applyFlagOutcome(result);
    const creditedAward = result.payout;
    if (spinPhase === "bonus" && result.payout <= 0) {
      const minimumAward = economy.scaleCredits(
        transaction.bet * economyRules.bonus.minimumAwardBetMultiplier,
        economyRules.payoutScale.bonusMinimum
      );
      result.payout = minimumAward;
      result.orbGain = Math.max(economyRules.bonus.minimumOrbGain, result.orbGain);
      result.bonusAssist = true;
    }
    state.win = result.payout;
    state.credit += result.payout;
    if (result.payout > 0) {
      state.orb = Math.min(economyRules.orb.max, state.orb + result.orbGain);
      if (currentStageScript().id !== "treasure") {
        state.treasure = Math.min(
          economyRules.adventure.treasureMax,
          state.treasure + Math.max(economyRules.orb.winTreasureMinimum, Math.floor(result.orbGain / economyRules.orb.winTreasureDivisor))
        );
      }
      state.panyuStreak = 0;
      state.combo += 1;
      state.bestCombo = Math.max(state.bestCombo, state.combo);
      showWin(result, spinPhase);
    } else if (!result.replayHit) {
      const rescued = resolvePanyuMiss(result);
      if (!rescued) {
        highlightCells(result.nearCells, "near");
        state.orb = Math.max(0, state.orb - economyRules.orb.failedMissLoss);
        state.panyuStreak = Math.min(economyRules.panyu.missStreakMax, state.panyuStreak + 1);
        state.combo = 0;
        const nearText = result.nearMiss > 0 ? `惜しいライン ${result.nearMiss}本。` : "";
        if (currentStageScript().id === "treasure") {
          message(nearText ? `MISS。${nearText}` : "MISS。次のSPINへ。");
          addLog("MISS", nearText || "次のSPINへ");
        } else {
          message(`MISS... ${nearText}${currentStageScript().miss} 《ぱにゅぱにゅ》期待度が上がった。`);
          addLog("MISS", `${nearText}ぱにゅ期待度 ${state.panyuStreak + 1}`);
        }
        vibrate(result.nearMiss > 0 ? [20, 45, 20] : 18);
        characterHit();
      }
    }
    // リプレイ成立。次ゲームは BET 不要。
    state.freeSpin = Boolean(result.replayHit);
    if (result.replayHit) {
      highlightCells(result.winCells, "win");
      result.litLines.forEach(drawPayline);
      message("REPLAY。次のゲームはBETなしで回せる。");
      addLog("REPLAY", "次ゲーム無料");
      audio.cue("notice");
    }
    const settledOutcome = result.jackpot ? "jackpot" : result.replayHit ? "replay" : result.payout > 0 ? "win" : "miss";
    settleChapter1PokerTable(settledOutcome, Boolean(state.flagLanded));
    settleChapter1SpinHeat(settledOutcome, Boolean(state.flagLanded), spinPhase);
    els.reelFrame.classList.remove("anticipation");
    advanceAdventure(result, spinPhase, transaction.id, transaction.bet);
    if (spinPhase === "normal") maybeEnterChapter1NormalChance();
    if (spinPhase === "normal") syncChapter1ReelReaction(3, result);
    let bossVictory = null;
    if (spinPhase === "trial") resolveTrialSpin(result);
    else if (spinPhase === "bonus") resolveBonusSpin(result);
    else if (spinPhase === "battle") bossVictory = resolveBossTurn(result, transaction.bet);
    else if (transaction.stageAtStart !== "treasure" && state.orb >= economyRules.orb.releaseThreshold) triggerBonus(transaction.stageAtStart);

    const persistentDraft = draftProfile();
    persistentDraft.stats.spins += 1;
    let royalOrderResult = null;
    if (bossVictory?.stageId === "treasure") {
      persistentDraft.stats.chapter1Clears = chapter1ClearCount(persistentDraft) + 1;
      royalOrderResult = chapter1RoyalOrderProgress(true);
      state.chapter1RunOrderResolved = Boolean(royalOrderResult);
      if (royalOrderResult?.complete) {
        persistentDraft.stats.chapter1RoyalOrdersCompleted += 1;
        const crestAward = chapter1Flow.awardRoyalReplayCrest(
          persistentDraft.stats.chapter1RoyalOrderCrests,
          royalOrderResult.id
        );
        persistentDraft.stats.chapter1RoyalOrderCrests = crestAward.state.mask;
        state.chapter1RunOrderComplete = true;
        state.chapter1RunCrestId = crestAward.id;
        state.chapter1RunCrestFirst = crestAward.first;
        state.chapter1RunCrestSetComplete = crestAward.setCompleted;
      }
    }
    // Keep the existing lifetime WIN-stat definition separate from collection
    // eligibility. Only persistent COINS require a paid transaction.
    const trackedStatWin = creditedAward > 0 && !result.bonusAssist && !transaction.isBonusFree;
    if (trackedStatWin) {
      persistentDraft.stats.wins += 1;
      persistentDraft.stats.bestWin = Math.max(persistentDraft.stats.bestWin, creditedAward);
      if (result.jackpot) persistentDraft.stats.jackpots += 1;
    }

    const rewardNow = Date.now();
    const spinId = `${collectionSessionId}:${transaction.id}`;
    const collectionReceipts = [];
    if (bossVictory) {
      const bossReward = collectionEconomy.grantBossFirst(persistentDraft, {
        stageId: bossVictory.stageId,
        now: rewardNow
      });
      if (bossReward.receipt) collectionReceipts.push(bossReward.receipt);
    }
    const winReward = collectionEconomy.grantWin(persistentDraft, {
      transaction,
      creditedAward,
      bonusAssist: result.bonusAssist,
      grantId: `win:${spinId}`,
      now: rewardNow
    });
    if (winReward.receipt) collectionReceipts.push(winReward.receipt);
    const milestoneReward = collectionEconomy.recordPaidSpin(persistentDraft, {
      spinId: `spin:${spinId}`,
      debit: transaction.debit,
      now: rewardNow
    });
    collectionReceipts.push(...milestoneReward.receipts);

    const profileSaved = saveProfile(persistentDraft);
    commitProfile(persistentDraft);
    if (!profileSaved) profileSavePending = true;
    renderWallets();
    const grantedCoins = collectionReceipts.reduce((sum, receipt) => sum + receipt.amount, 0);
    if (profileSaved && collectionReceipts.length > 0) {
      addLog("COINS", `+${grantedCoins} / ${collectionReceipts.map(receipt => receipt.source).join(" + ")}`);
    } else if (!profileSaved) {
      addLog("SAVE", "COINSと累計記録は次の操作前に再保存します");
      toast("SAVE RETRY REQUIRED");
    }
    if (royalOrderResult?.complete) {
      const crownMessage = state.chapter1RunCrestSetComplete
        ? "ROYAL CROWN COMPLETE · 5/5"
        : state.chapter1RunCrestFirst
          ? `NEW CREST · ${royalOrderResult.title}`
          : `CROWN STAMP · ${royalOrderResult.title}`;
      toast(crownMessage);
      addLog(state.chapter1RunCrestFirst ? "NEW CREST" : "CROWN STAMP", royalOrderResult.title);
    } else if (royalOrderResult) {
      toast(`ORDER MISSED · ${royalOrderResult.title} · ${royalOrderResult.compact}`);
      addLog("ORDER MISSED", `${royalOrderResult.title} · ${royalOrderResult.compact}`);
    }
    announceResult(result, spinPhase);
    publishReelEvent("mimi:reel-result", {
      type: "settled",
      transactionId: transaction.id,
      stoppedCount: 3,
      outcome: settledOutcome,
      payout: result.payout,
    });
    updateHud();
    animateWinCount(state.win, transaction.id);

    if (state.auto) {
      autoTimer = window.setTimeout(startSpin, state.turbo ? 420 : 900);
    }
  }

  function forceFinishSpin() {
    audio.reelLoop.stop();
    reels.forEach(reel => {
      if (reel.phase === "stopped") return;
      reel.pos = core.mod(Math.round(reel.pos), reel.length);
      reel.index = reel.pos;
      reel.slip = 0;
      reel.phase = "stopped";
      setBlur(reel, false);
    });
    state.reelsStopped = [true, true, true];
    state.spinning = false;
    clearTimeout(safetyTimer);
    clearTimeout(settlementSafetyTimer);
    paintReels(true);
    syncGrid();
    updateButtons();
    message("リール停止。もう一度SPINできます。");
  }

  /** 停止した 3x3 の判定。純ロジックは slot-core.js 側。 */
  function evaluate() {
    const result = core.evaluateGrid(state.grid, { bet: currentSpin?.bet || state.bet });
    result.payout = economy.scaleCredits(result.payout, economy.modePayoutScale(currentSpin?.flagMode || flagMode()));
    result.jackpot = result.jackpotHit;
    if (result.jackpotHit) {
      result.payout += state.jackpot;
      state.jackpot = economyRules.jackpot.base;
    }
    return result;
  }

  /**
   * 内部抽選フラグと、実際に止まった目のすり合わせ。
   *
   * レア役は 1 リール 1 コマしか無いので 4 コマ滑りでは基本揃わない。
   * 揃わなかったぶんは《ぱにゅぱにゅ》復活として払い出し、
   * 出玉率が抽選テーブルどおりになるようにしている。
   * 小役の取りこぼしは実機同様そのままハズレ。
   */
  function applyFlagOutcome(result) {
    const flag = currentSpin?.flag || state.flag;
    state.flagLanded = result.litLines.some(line => {
      const [col, row] = line.cells[0];
      return state.grid[col][row].id === flag;
    });
    if (flag === "none" || state.flagLanded || !core.isRescueFlag(flag)) return;

    const sym = core.SYMBOL_BY_ID.get(flag);
    const pay = economy.scaleCredits(
      core.linePayout(flag, currentSpin?.bet || state.bet),
      economy.rareRescueScale(currentSpin?.flagMode || flagMode())
    );
    result.payout += pay;
    result.orbGain += economyRules.orb.rareRescueGain;
    result.premium = result.premium || sym.pay >= economyRules.orb.rareRescuePremiumPayThreshold;
    result.rescuedSymbol = sym;
    showCutin("revive");
    showChance(sym.pay >= economyRules.orb.rareRescuePremiumPayThreshold ? "激アツ" : "CHANCE", `${sym.name} 復活`,
      `${sym.name}のフラグは成立していた。リールでは止まりきらなかったが、《ぱにゅぱにゅ》が配当を引き戻す。`, sym.pay >= economyRules.orb.rareRescuePremiumPayThreshold);
    addLog("RESCUE", `${sym.name} 取りこぼし救済 +${pay}`);
  }

  function showWin(result, spinPhase = state.phase) {
    highlightCells(result.winCells, "win");
    const effect = equippedEffect();
    els.reelFrame.classList.remove("flash");
    els.reelFlare.classList.remove("show");
    void els.reelFrame.offsetWidth;
    els.reelFrame.classList.add("flash");
    els.reelFlare.classList.add("show");
    result.litLines.forEach(drawPayline);
    showWinLabel(result.payout);
    burst(28 + (effect === "sparkle" ? 16 : 0), result.premium ? "#ffd36a" : "#63e3ff");
    coinBurst(result.premium ? 32 : 14);
    slashBurst(result.premium ? 5 : 2);
    if (result.jackpot) {
      audio.jackpot();
      audio.payout(result.payout, currentSpin?.bet || state.bet);
    }
    // The boss transaction keeps its physical STOP sounds, then roleBoss() and
    // one authored boss-result cue own the resolution. The generic payout
    // jingle belongs to normal/BONUS play and otherwise stacked as many as four
    // extra recorded transients on the exact boss impact frame.
    else if (!(spinPhase === "battle" && currentStageScript().id === "treasure")) {
      audio.win(result.payout, currentSpin?.bet || state.bet);
    }
    vibrate(result.jackpot ? [30, 40, 30, 40, 60] : result.premium ? [24, 35, 24] : 20);
    if (result.premium || effect === "premium") showCutin(result.payout >= (currentSpin?.bet || state.bet) * 20 || effect === "premium" ? "premium" : "bonus");
    if (result.jackpot) {
      showChance("JACKPOT", "5つの勝利が未来へ接続", "鍵、ブラフブレイク、写真判定、黒星、本塁打。ミミシリーズの勝利がリゾートへ集結する。", true);
      els.shell.dataset.motif = "jackpot";
      state.activeCast = 1;
      window.setTimeout(() => {
        state.activeCast = 0;
        updateHud();
      }, 2400);
    }
    message(result.bonusAssist
      ? `BONUS小役成立。${result.payout} WIN、残り${Math.max(0, state.bonusGames - 1)}G。`
      : result.jackpot
        ? `JACKPOT！ ${result.payout} WIN。ゲートが開いた。`
        : result.premium
          ? `大チャンス！ ${result.payout} WIN。${currentStageScript().win}`
          : `${result.payout} WIN。${currentStageScript().win} COMBO ${state.combo}`);
    addLog("WIN", `${result.payout} credit / COMBO ${state.combo}`);
    els.characterWrap.classList.remove("excite");
    void els.characterWrap.offsetWidth;
    els.characterWrap.classList.add("excite");
  }

  function resolvePanyuMiss(result) {
    const chance = economy.panyuChance({
      orb: state.orb,
      streak: state.panyuStreak,
      training: state.training,
      nearMiss: result?.nearMiss || state.nearMiss || 0
    });
    if (gameRandom() > chance) return false;
    if (currentStageScript().id === "treasure") {
      state.panyuStreak = 0;
      audio.revive();
      burst(18, "#ff74c6");
      message("ミミ「ぱにゅ！ もう一回！」");
      addLog("PANYU", "もう一回！");
      return true;
    }
    const roll = gameRandom();
    state.panyuStreak = 0;
    showCutin("revive");
    audio.revive();
    burst(equippedEffect() === "panyu" ? 42 : 26, "#ff74c6");
    if (roll < economyRules.panyu.refundUpperBound) {
      const spinBet = currentSpin?.bet || state.bet;
      const refund = economy.scaleCredits(
        spinBet * economyRules.panyu.refundBetMultiplier,
        economyRules.payoutScale.panyuRefund
      );
      state.credit += refund;
      state.win = refund;
      message(`《ぱにゅぱにゅ》復活！ ${refund} CREDITが戻った。次停止へ希望が残る。`);
      addLog("REVIVE", `${refund} credit`);
      showChance("REVIVE", "外れから復活", `${currentStageScript().chance} 消えかけたラインにハートの光が戻り、今回のBETが返還された。`, true);
    } else if (roll < economyRules.panyu.upgradeUpperBound) {
      state.orb = Math.min(economyRules.orb.max, state.orb + economyRules.panyu.upgradeOrbGain);
      state.training += 1;
      message(`《ぱにゅぱにゅ》昇格！ オーブ+${economyRules.panyu.upgradeOrbGain}、次のバトルが強化。`);
      addLog("UPGRADE", `ORB +${economyRules.panyu.upgradeOrbGain}`);
      showChance("CHANCE UP", "オーブ昇格", `${currentStageScript().chance} 外れの余韻が次の停止へつながり、期待度が一段上がった。`, true);
    } else {
      state.treasure = Math.min(economyRules.adventure.treasureMax, state.treasure + economyRules.panyu.continueTreasureGain);
      state.enemiesToBonus = Math.max(economyRules.panyu.continueEnemyMinimum, state.enemiesToBonus - 1);
      message("《ぱにゅぱにゅ》継続！ 宝箱とBOSSルートが近づいた。");
      addLog("CONTINUE", "宝箱 +1");
      showChance("CONTINUE", "冒険ルート継続", `${currentStageScript().miss} 外れは終わりではない。宝箱の光が次の冒険マスを照らす。`, true);
    }
    return true;
  }

  function triggerBonus(stageAtSpinStart = state.stage) {
    state.orb = 0;
    // advanceAdventure() may move the LCD to stage 5 immediately before this
    // award.  The payout belongs to the chapter in which the spin started,
    // not to the presentation scene selected after the result.
    const bonus = economy.orbReleaseAward(stageAtSpinStart);
    state.credit += bonus;
    state.win += bonus;
    showCutin("burst");
    els.shell.dataset.motif = "golden-gate";
    stageFlash();
    burst(60, "#ff5fb7");
    audio.cue("gate");
    message("ミミ「扉がひらく！」");
    addLog("扉がひらく", `${bonus} credit`);
  }

  function resumeAutoAfterPresentation() {
    if (!state.auto || state.spinning || state.transitioning || state.bossResolutionPending) return;
    clearTimeout(autoTimer);
    autoTimer = window.setTimeout(startSpin, state.turbo ? 420 : 900);
  }

  function maybeEnterChapter1NormalChance() {
    if (currentStageScript().id !== "treasure" || state.phase !== "normal"
      || state.transitioning || state.bossResolutionPending || state.chapter1ArrivalPending
      || state.chapter1RunFinished || !state.chapter1NormalChance?.ready) return false;
    state.chapter1NormalChance = { used: true, remaining: 0, ready: false };
    clearChapter1ReelReaction();
    startTrial("training");
    return true;
  }

  function startTreasureTrialPresentation(kind, payload, onComplete) {
    const definition = TREASURE_TRIAL_FLOWS[kind];
    return startTreasurePresentationFlow(definition, payload, onComplete, {
      trialType: state.trialType || "training",
      spins: state.trialSpins,
      score: state.trialScore,
    });
  }

  function startTreasureLockedScene(sceneId, payload, onComplete) {
    const safeSceneId = String(sceneId || "");
    if (!safeSceneId) return null;
    return startTreasurePresentationFlow(
      singleSceneFlow(`treasure-locked-${safeSceneId.replace(/[^a-z0-9]+/giu, "-")}`, safeSceneId),
      payload,
      onComplete,
    );
  }

  function startTreasurePresentationFlow(definition, payload, onComplete, defaults) {
    const flowApi = window.MimiPresentationFlow;
    if (!definition || !flowApi || typeof flowApi.createSceneFlow !== "function") {
      const fallbackSceneId = definition?.states?.scene?.sceneId || "";
      if (fallbackSceneId) showPresentationScene(fallbackSceneId, payload);
      if (typeof onComplete === "function") onComplete();
      return null;
    }
    stopTreasureResolutionFlow();
    state.transitioning = true;
    updateButtons();
    let flow = null;
    try {
      flow = flowApi.createSceneFlow({
        definition,
        xstate: window.XState,
        onEnter(step) {
          if (treasureResolutionFlow !== flow || step.stateId !== "complete") return;
          treasureResolutionFlow = null;
          state.transitioning = false;
          if (typeof onComplete === "function") onComplete();
          maybeEnterChapter1NormalChance();
          updateHud();
          updateButtons();
          resumeAutoAfterPresentation();
        },
        onScene(step) {
          if (treasureResolutionFlow !== flow) return;
          if (!showPresentationScene(step.sceneId, step.payload)) {
            flow.handlePresentationLifecycle({
              type: "cancel",
              sceneId: step.sceneId,
              runId: null,
              reason: "presentation-bridge-rejected",
            });
          }
        },
      });
    } catch (_error) {
      state.transitioning = false;
      updateHud();
      updateButtons();
      if (typeof onComplete === "function") onComplete();
      return null;
    }
    treasureResolutionFlow = flow;
    flow.start(Object.assign({}, defaults || {}, payload || {}));
    return flow;
  }

  function returnFromTrial() {
    state.phase = "normal";
    state.trialType = "";
    state.trialSpins = 0;
    state.trialScore = 0;
    state.allies = economyRules.adventure.alliesInitial;
    state.training = 0;
    setSceneMode("explore", "通常探索へ");
    if (currentStageScript().id !== "treasure") message("通常探索へ戻る。");
    addLog("RETURN", "通常時へ");
  }

  function startTrial(type) {
    if (state.phase !== "normal") return;
    state.phase = "trial";
    state.trialType = type;
    state.trialSpins = 0;
    state.trialScore = 0;
    // A trial is an act inside the current chapter, not a jump to another
    // chapter.  Keep the current boss/story identity stable through entry.
    const isTreasureTrial = currentStageScript().id === "treasure";
    setSceneMode("chain", isTreasureTrial ? "VIPランプCHANCE" : type === "merge" ? "章内・合体連続演出" : "章内・特訓連続演出");
    const title = isTreasureTrial ? "VIP LAMP" : type === "merge" ? "合体CHALLENGE" : "特訓MODE";
    if (isTreasureTrial) {
      const heat = currentPresentationHeat("none", "hot");
      startTreasureTrialPresentation("enter", {
        heat: heat.heat,
        aura: heat.cue,
      });
    } else {
      showChance("CHANCE", title, `${economyRules.trial.length}ゲームの連続演出。小役成立やテンパイで成功期待度が上がり、成功すればBONUSへ。`, true);
    }
    if (!isTreasureTrial) message(`${title}。成功を狙う。`);
    addLog("TRIAL", title);
    updateHud();
  }

  function resolveTrialSpin(result) {
    state.trialSpins += 1;
    if (result.payout > 0) state.trialScore += result.premium ? economyRules.trial.premiumWinScore : economyRules.trial.regularWinScore;
    else if (result.nearMiss > 0) state.trialScore += economyRules.trial.nearMissScore;
    const isTreasureTrial = currentStageScript().id === "treasure";
    const heat = {
      heat: Math.max(1, Math.min(5, Number(result.presentationHeat) || 1)),
      cue: result.presentationCue || "tell-quiet",
    };
    const trialPayload = {
      score: state.trialScore,
      spins: state.trialSpins,
      heat: heat.heat,
      aura: heat.cue,
      result: result.payout > 0 ? "win" : result.nearMiss > 0 ? "near" : "miss",
    };
    if (state.trialScore >= economyRules.trial.successScore) {
      const reason = "VIPランプが3つ点いた";
      if (isTreasureTrial) startTreasureTrialPresentation("success", trialPayload, function () { enterBonus(reason); });
      else enterBonus(reason);
      return;
    }
    if (state.trialSpins < economyRules.trial.length) {
      if (isTreasureTrial) startTreasureTrialPresentation("progress", trialPayload);
      else showChance("NEXT", `${phaseLabel()} ${state.trialScore}/${economyRules.trial.successScore}`, "まだ終わらない。次の停止で小役かテンパイを狙おう。", false);
      return;
    }
    const revive = gameRandom() < economy.trialReviveChance(state.panyuStreak);
    if (revive) {
      if (isTreasureTrial) startTreasureTrialPresentation("revive", trialPayload, function () { enterBonus("VIPランプが3つ点いた"); });
      else {
        showCutin("revive");
        enterBonus("ぱにゅぱにゅ復活");
      }
      return;
    }
    if (isTreasureTrial) startTreasureTrialPresentation("fail", trialPayload, returnFromTrial);
    else returnFromTrial();
  }

  function enterBonus(reason, playEntryCue = true, origin = "feature") {
    if (origin !== "boss-victory") {
      state.bossPartyCount = Math.max(
        economyRules.adventure.alliesInitial,
        Math.min(economyRules.adventure.alliesMax, Number(state.allies) || 0)
      );
    }
    state.phase = "bonus";
    state.bossBattle = false;
    state.bossResolutionPending = false;
    state.bonusGames = economyRules.bonus.length;
    state.bonusTotalWin = 0;
    state.bonusOrigin = origin;
    state.trialType = "";
    state.trialSpins = 0;
    state.trialScore = 0;
    state.allies = economyRules.adventure.alliesInitial;
    state.training = 0;
    setSceneMode("bonus", currentStageScript().id === "treasure" ? "10G VIP BONUS" : "JACKPOT RAID BONUS");
    els.shell.dataset.motif = "bonus";
    coinBurst(30);
    burst(40, "#ffd36a");
    addLog("BONUS", `${reason} / ${economyRules.bonus.length}G`);
    audio.setMood("bonus");
    if (playEntryCue) audio.cue("bonus");
    // A Royal Order is visually awarded on this boss-victory BONUS entrance,
    // not on the preceding boss impact. Keep its clear/miss signature aligned
    // with that authored award and out of the boss DEFEAT transient cluster.
    if (origin === "boss-victory" && currentStageScript().id === "treasure" && state.chapter1RunOrderResolved) {
      audio.cue(state.chapter1RunOrderComplete
        ? state.chapter1RunCrestSetComplete ? "crownComplete" : "orderClear"
        : "orderMiss");
    }
    updateHud();
    const bonusHeat = currentPresentationHeat(state.flag, "bonus");
    if (currentStageScript().id === "treasure") {
      startTreasureLockedScene("treasure.bonus.enter", {
        games: state.bonusGames,
        totalWin: state.bonusTotalWin,
        origin: state.bonusOrigin,
        heat: bonusHeat.heat,
        cue: bonusHeat.cue,
      });
    }
  }

  /**
   * CREDITや永続統計はfinishSpin内で同期確定し、WIN表示だけを数え上げる。
   * 次ゲーム開始・別transaction・軽減モーションでは即座に最終値へ戻す。
   */
  function animateWinCount(amount, transactionId) {
    cancelAnimationFrame(winCountFrame);
    winCountFrame = 0;
    const target = Math.max(0, Math.floor(Number(amount) || 0));
    if (target <= 0 || isMotionReduced()) {
      els.win.textContent = String(target);
      return;
    }
    const duration = state.turbo ? 320 : Math.min(1100, 520 + Math.log10(target + 1) * 180);
    const startedAt = performance.now();
    els.win.textContent = "0";
    const tick = now => {
      if (currentSpin?.id !== transactionId || state.win !== target) {
        els.win.textContent = String(state.win);
        winCountFrame = 0;
        return;
      }
      const progress = Math.min(1, (now - startedAt) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      els.win.textContent = String(Math.round(target * eased));
      if (progress < 1) winCountFrame = requestAnimationFrame(tick);
      else winCountFrame = 0;
    };
    winCountFrame = requestAnimationFrame(tick);
  }

  function resolveBonusSpin(result) {
    state.bonusTotalWin += Math.max(0, Number(result?.payout) || 0);
    state.bonusGames = Math.max(0, state.bonusGames - 1);
    const completedOrigin = state.bonusOrigin;
    const bonusHeat = result?.presentationHeat || currentPresentationHeat(state.flag, "bonus").heat;
    if (state.bonusGames > 0) {
      if (currentStageScript().id === "treasure") {
        startTreasureLockedScene("treasure.bonus.progress", {
          games: state.bonusGames,
          totalWin: state.bonusTotalWin,
          origin: completedOrigin,
          heat: bonusHeat,
        });
      }
      return;
    }
    state.freeSpin = false;
    state.bonusOrigin = "";
    if (currentStageScript().id === "treasure") {
      startTreasureLockedScene("treasure.bonus.exit", {
        games: 0,
        totalWin: state.bonusTotalWin,
        origin: completedOrigin,
        opponentId: currentChapter1Table().id,
        opponentName: currentChapter1Table().name,
        heat: Math.max(4, Number(bonusHeat) || 4),
      }, function () { finishBonus(completedOrigin); });
      return;
    }
    finishBonus(completedOrigin);
  }

  function finishBonus(completedOrigin) {
    if (completedOrigin === "boss-victory" && currentStageScript().id === "treasure"
      && document.querySelector('[data-view="holdem-result"]')) {
      // V5's playable Hold'em cabinet ends here. Keep the earned run intact
      // until an explicit replay; the legacy five-chapter entry still advances.
      state.chapter1RunFinished = true;
      state.phase = "normal";
      state.bossBattle = false;
      state.bossResolutionPending = false;
      state.auto = false;
      state.freeSpin = false;
      clearTimeout(autoTimer);
      clearChapter1Command();
      window.MimiCasinoLoop?.pause?.();
      showView("holdem-result");
      addLog("HOLD'EM CLEAR", "ROYAL POT WON");
      return;
    }
    if (completedOrigin === "boss-victory") {
      state.phase = "normal";
      state.sceneMode = "explore";
      state.sceneSpins = 0;
      state.adventureStep = 0;
      state.orb = 0;
      state.treasure = 0;
      state.allies = economyRules.adventure.alliesInitial;
      state.bossPartyCount = 0;
      state.training = 0;
      state.enemiesToBonus = economyRules.adventure.enemiesToBossInitial;
      if (currentStageScript().id === "treasure") resetChapter1Progress();
      if (state.stage < stageScripts.length) {
        setAdventureScene(state.stage, "NEXT EPISODE");
        const next = currentStageScript();
        showChance("NEXT", `${next.title} 開幕`, next.intro, true);
        message(`BOSS撃破BONUS終了。第${state.stage}章 ${next.title}へ。`);
        addLog("CHAPTER CLEAR", `NEXT ${next.id}`);
      } else {
        showChance("FIRST LIGHT", "五つの約束がつながった", "通常エンディング到達。JACKPOTは追加エピローグとして残る。", true);
        message("最終章クリア。FIRST LIGHT通常エンディング到達。");
        addLog("STORY CLEAR", "FIRST LIGHT");
      }
      audio.setMood("resort");
      updateHud();
      return;
    }
    if (currentStageScript().id === "treasure") {
      state.phase = "normal";
      state.bossBattle = false;
      state.bossResolutionPending = false;
      state.bossPartyCount = 0;
      setSceneMode("explore", `${currentChapter1Table().name}の卓へ戻る`);
      addLog("BONUS END", `RETURN ${currentChapter1Table().name}`);
      audio.setMood("resort");
      updateHud();
      updateButtons();
      return;
    }
    addLog("BONUS END", "BOSS BATTLE");
    startBossBattle();
  }

  function advanceAdventure(result, spinPhase = state.phase, transactionId = currentSpin?.id, spinBet = state.bet) {
    state.sceneSpins += 1;
    state.adventureStep = (state.adventureStep + 1) % 5;
    if (currentStageScript().id === "treasure" && spinPhase === "normal") {
      advanceChapter1Table(result);
      return;
    }
    const event = chooseAdventureEvent(result, spinPhase, spinBet);
    const eventStageId = currentStageScript().id;
    const treasureNormalOutcome = Object.freeze({
      enemyCleared: event === "enemy"
        && spinPhase === "normal"
        && (result.payout > 0 || state.training > 0),
      chestCollected: event === "chest"
        && spinPhase === "normal"
        && (
          state.treasure < economyRules.adventure.treasureMax
          || state.orb < economyRules.orb.max
        ),
    });
    selectAdventureScene(event, result, spinPhase);
    // State commits now.  The delayed callback below only reveals presentation,
    // so it cannot mutate the next spin.
    resolveAdventureEvent(event, result, spinPhase, eventStageId);
    if (eventStageId === "treasure" && spinPhase === "normal" && state.phase === "normal") {
      presentTreasureNormalEvent(event, result, treasureNormalOutcome);
    }
    window.setTimeout(() => {
      if (currentSpin?.id !== transactionId) return;
      // Boss entry and battle turns own the upper LCD through semantic scenes.
      // A delayed adventure card must not replace that scene 420ms later.
      if (
        event === "boss"
        || spinPhase === "battle"
        || spinPhase === "bonus"
        || (eventStageId === "treasure" && state.phase === "trial")
      ) return;
      if (eventStageId === "treasure") return;
      presentAdventureEvent(event, result, spinPhase);
    }, 420);
    renderBattleStatus();
  }

  function selectAdventureScene(event, result, spinPhase) {
    if (spinPhase === "bonus") {
      setSceneMode("bonus", "BONUS液晶");
      return;
    }
    if (spinPhase === "battle") {
      setSceneMode("boss", "BOSS液晶");
      return;
    }
    if (spinPhase === "trial") return;
    if (event === "boss") setSceneMode("boss", "章内・BOSS前兆");
    else if (result.premium || state.orb >= economyRules.adventure.raidSceneOrbThreshold || event === "freeze") setSceneMode("omen", "章内・強前兆");
    else if (state.combo >= economyRules.adventure.comboSceneThreshold) setSceneMode("chain", "章内・連続演出");
    else if (result.nearMiss > 0 || state.nearMiss > 0) setSceneMode("omen", "章内・予兆");
    else if (event === "merge" || event === "training") setSceneMode("chain", "章内・挑戦イベント");
    else if (state.sceneSpins >= economyRules.adventure.sceneRotationSpins) {
      const chapterActs = ["explore", "omen", "chain"];
      setSceneMode(chapterActs[Math.floor(state.sceneSpins / economyRules.adventure.sceneRotationSpins) % chapterActs.length], "章内・冒険演出更新");
    } else if (event === "pot" || event === "chest") setSceneMode("explore", "章内・探索演出");
  }

  function advanceChapter1Table(result) {
    const opponent = currentChapter1Table();
    const royalOrderBefore = chapter1RoyalOrderProgress();
    state.chapter1RunNormalSpins += 1;
    const turn = chapter1Flow.resolveTableTurn({
      flag: state.flag,
      payout: result.payout,
      replayHit: result.replayHit,
      readReady: state.chapter1ReadReady,
    });
    if (turn.readBreak) state.chapter1RunReadBreaks += 1;
    if (chapter1HotHandSettled()) state.chapter1RunStrongLands += 1;
    const readAssist = chapter1Flow.settleReadAssist({
      streak: state.chapter1ReadStreak,
      ready: state.chapter1ReadReady,
      turn: turn,
    });
    const next = chapter1Flow.settleOpponent(chapter1ProgressSnapshot(), turn);
    state.chapter1NormalChance = chapter1Flow.settleNormalChance(state.chapter1NormalChance, {
      flag: state.flag, payout: result.payout, bossReady: next.bossReady,
    });
    const preparation = chapter1Flow.settlePreparation({
      focus: state.chapter1AllyFocus,
      preparedAllies: state.chapter1PreparedAllies,
      opponentId: opponent.id,
      turn: turn,
      cleared: next.cleared,
    });
    state.chapter1AllyFocus = preparation.focus;
    state.chapter1PreparedAllies = preparation.preparedAllies.slice();
    state.chapter1ReadStreak = readAssist.streak;
    state.chapter1ReadReady = readAssist.ready;
    applyChapter1Progress(next);
    announceRoyalOrderMilestone(royalOrderBefore, chapter1RoyalOrderProgress());

    if (next.cleared) {
      if (!next.bossReady && usesChapter1CommandSurface()) {
        state.chapter1ArrivalPending = true;
        els.shell.dataset.chapter1ArrivalPending = "true";
      }
      stageChapter1TableResult(opponent, {
        cleared: true,
        damage: turn.damage,
        readBonusDamage: turn.readBonusDamage,
        readBreak: turn.readBreak,
        heat: Math.max(4, turn.heat),
        stack: 0,
      });
      state.chapter1ReadStreak = 0;
      state.chapter1ReadReady = false;
      updateHud();
      startTreasureLockedScene("treasure.table.clear", {
        opponentId: opponent.id,
        opponentName: opponent.name,
        clearLine: opponent.clearLine,
        betCoins: next.betCoins,
        prepared: preparation.prepared,
        newlyPrepared: preparation.newlyPrepared,
        readyCount: preparation.readyCount,
        preparedAllies: preparation.preparedAllies.slice(),
        heat: Math.max(4, turn.heat),
      }, function () {
        resetChapter1PokerTable();
        if (next.bossReady) startBossBattle("treasure");
      });
      return;
    }

    updateHud();

    if (!turn.fullScene) {
      pulseChapter1TableProgress(turn);
      pulseChapter1ReadProgress(readAssist, turn, opponent);
      pulseChapter1ReadAssist(readAssist);
      showChapter1RivalRemark(opponent, turn, readAssist);
      return;
    }
    const symbol = core.SYMBOL_BY_ID.get(state.flag);
    stageChapter1TableResult(opponent, {
      damage: turn.damage,
      readBonusDamage: turn.readBonusDamage,
      readBreak: turn.readBreak,
      heat: turn.heat,
      stack: next.opponentStack,
    });
    startTreasureLockedScene("treasure.table.hit", {
      opponentId: opponent.id,
      opponentName: opponent.name,
      symbolName: turn.readBreak ? "READ BREAK" : symbol?.name || "小役",
      damage: turn.damage,
      stack: next.opponentStack,
      heat: turn.heat,
      readBonusDamage: turn.readBonusDamage,
      headline: turn.readConsumed
        ? `READ成功！ ${opponent.name}のスタックを${turn.damage}削った！`
        : `${opponent.name}のスタックを${turn.damage}削った！`,
    });
  }

  function chooseAdventureEvent(result, spinPhase, spinBet = state.bet) {
    if (spinPhase === "bonus") return result.premium ? "freeze" : result.payout >= spinBet * economyRules.adventure.bonusChestBetMultiple ? "chest" : "pot";
    if (spinPhase === "trial") return state.trialType === "merge" ? "merge" : "training";
    if (spinPhase === "battle") return result.payout > 0 ? "enemy" : "training";
    if (result.premium && gameRandom() < economyRules.adventure.premiumFreezeChance) return "freeze";
    if (result.payout >= spinBet * economyRules.adventure.premiumChestBetMultiple) return "chest";
    if (state.enemiesToBonus <= economyRules.adventure.enemiesToBossTrigger) return "boss";
    const roll = gameRandom();
    if (roll < economyRules.adventure.eventThresholds.pot) return "pot";
    if (roll < economyRules.adventure.eventThresholds.enemy) return "enemy";
    if (roll < economyRules.adventure.eventThresholds.chest) return "chest";
    if (roll < economyRules.adventure.eventThresholds.merge) return "merge";
    return "training";
  }

  function presentTreasureNormalEvent(event, result, outcome = {}) {
    // Reel payout is already readable below the LCD. Only interrupt the casino
    // loop when this event changes the chapter's visible progression state.
    if (
      event === "pot"
      || (event === "enemy" && !outcome.enemyCleared)
      || (event === "chest" && !outcome.chestCollected)
    ) return;
    const copy = {
      enemy: {
        actor: "mimi",
        speaker: "ミミ",
        headline: "見張りを突破した！",
        line: "",
      },
      chest: { actor: "grano", speaker: "グラーノ", headline: "宝箱をひとつ確保だよ！", line: "" },
      merge: { actor: "polka", speaker: "ポルカ", headline: "一緒に行くよ、ミミ！", line: "" },
      training: { actor: "rico", speaker: "リコ先輩", headline: "特訓はこれで完了よ！", line: "" },
    }[event];
    if (!copy) return;
    startTreasureLockedScene("treasure.normal.event", Object.assign({}, copy, {
      event,
      heat: result.presentationHeat || currentPresentationHeat(state.flag, "normal").heat,
    }));
  }

  function presentAdventureEvent(event, result, spinPhase) {
    const script = currentStageScript();
    const boss = currentBossEntity();
    const visual = adventureEventVisuals[event] || adventureEventVisuals.pot;
    const messages = {
      pot: ["ラッキーポット！", result.payout > 0 ? `${script.win} 小さなリゾートチップを発見。` : "からっぽ...でも《ぱにゅぱにゅ》の気配。"],
      enemy: ["ショーモンスター乱入！", `${boss.weakness} ライン成立で撃退。倒すほどBOSSに近づく。`],
      chest: ["リゾート宝箱！", "期待度の高いチップが中で輝いている。宝箱が満ちるほどBONUSが近い。"],
      merge: ["ぱにゅぱにゅCHANCE！", "外れの気配を復活・昇格・継続へ変える、ミミ専用の見せ場。"],
      training: ["快進撃チャージ", `${script.chance} 次のバトルやCHANCEが少しだけ強くなる。`],
      boss: [`${boss.name} 出現！`, `${boss.hint} リールのヒットでHPを削り切ればBONUS。`],
      freeze: ["リゾート消灯...", "ロングフリーズ級の大チャンス。次の光で流れが一気に変わる。"]
    };
    const [title, text] = messages[event];
    els.shell.dataset.adventureEvent = visual.tone;
    els.adventureTitle.textContent = title;
    els.adventureText.textContent = text;
    els.adventureEvent.dataset.tone = visual.tone;
    els.adventureEvent.innerHTML = `<strong>${title}</strong><span>${text}</span><i aria-hidden="true">${visual.icon}</i>`;
    els.adventureEvent.classList.remove("pop");
    void els.adventureEvent.offsetWidth;
    els.adventureEvent.classList.add("pop");
    clearTimeout(adventureEventTimer);
    adventureEventTimer = window.setTimeout(() => els.adventureEvent.classList.remove("pop"), 2300);

    if (event === "enemy" || event === "boss") {
      slashBurst(event === "boss" ? 4 : 2);
      if (spinPhase === "normal" && (result.payout > 0 || state.training > 0)) burst(14, "#72f0a4");
    }
    if (event === "chest" && spinPhase !== "battle") coinBurst(10);

    if (event === "merge") burst(18, "#63e3ff");

    if (event === "training") {
      burst(12, "#ffd36a");
    }

    if (event === "freeze") {
      longFreeze();
    }

    updateHud();
  }

  function resolveAdventureEvent(event, result, spinPhase, eventStageId = currentStageScript().id) {
    if ((event === "enemy" || event === "boss") && spinPhase === "normal" && (result.payout > 0 || state.training > 0)) {
      state.enemiesToBonus = Math.max(0, state.enemiesToBonus - 1);
      state.training = Math.max(0, state.training - 1);
    }
    if (event === "boss" && spinPhase === "normal") startBossBattle(eventStageId);
    if (event === "chest" && spinPhase !== "battle") {
      state.treasure = Math.min(economyRules.adventure.treasureMax, state.treasure + 1);
      state.orb = Math.min(economyRules.orb.max, state.orb + economyRules.orb.chestGain);
    }
    if (event === "merge" && spinPhase === "normal") {
      state.allies = Math.min(economyRules.adventure.alliesMax, state.allies + 1);
      if (state.allies >= economyRules.trial.mergeAlliesRequired) startTrial("merge");
    }
    if (event === "training" && spinPhase === "normal") {
      state.training += 1;
      if (state.training >= economyRules.trial.trainingRequired) startTrial("training");
    }
    if (event === "freeze" && spinPhase === "normal") enterBonus("ロングフリーズ");
  }

  function longFreeze() {
    els.shell.classList.remove("freeze-warning");
    void els.shell.offsetWidth;
    els.shell.classList.add("freeze-warning");
    showCutin("burst");
    window.setTimeout(() => els.shell.classList.remove("freeze-warning"), 1900);
  }

  function stopTreasureResolutionFlow() {
    if (treasureResolutionFlow && typeof treasureResolutionFlow.stop === "function") treasureResolutionFlow.stop();
    treasureResolutionFlow = null;
    state.transitioning = false;
  }

  function startTreasureVictoryFlow(boss, visualEpoch, attackProfile = {}) {
    stopTreasureResolutionFlow();
    const flowApi = window.MimiPresentationFlow;
    if (!flowApi || typeof flowApi.createSceneFlow !== "function") {
      completeTreasureVictoryReward();
      return null;
    }
    try {
      treasureResolutionFlow = flowApi.createSceneFlow({
      definition: TREASURE_VICTORY_FLOW,
      xstate: window.XState,
      onEnter(step) {
        if (visualEpoch !== bossVisualEpoch || !state.bossResolutionPending) return;
        if (step.stateId === "reward") {
          els.bossSprite.classList.remove("defeat");
          setBossVisualState("reward");
          els.bossSprite.classList.add("reward");
          audio.cue("treasureReward");
        } else if (step.stateId === "complete") {
          completeTreasureVictoryReward();
        }
      },
      onScene(step) {
        if (visualEpoch !== bossVisualEpoch || !state.bossResolutionPending) return;
        if (!showPresentationScene(step.sceneId, step.payload)) {
          treasureResolutionFlow.handlePresentationLifecycle({ type: "cancel", sceneId: step.sceneId, runId: null, reason: "presentation-bridge-rejected" });
        }
      }
      });
    } catch (_error) {
      treasureResolutionFlow = null;
      completeTreasureVictoryReward();
      return null;
    }
    treasureResolutionFlow.start({
      bossName: boss.name,
      games: economyRules.bonus.length,
      partyCount: state.bossPartyCount,
      readyCount: state.chapter1PreparedAllies.length,
      preparedAllies: state.chapter1PreparedAllies.slice(),
      resolveLevel: state.chapter1ResolveLevel,
      attempt: state.chapter1BossAttempt,
      symbolId: attackProfile.symbolId || "bell",
      symbolName: attackProfile.symbolName || "WIN",
      attackActor: attackProfile.actorId || "mimi",
      attackSpeaker: attackProfile.speaker || "ミミ",
      technique: attackProfile.technique || "オールイン！",
      visualEpoch: visualEpoch
    });
    return treasureResolutionFlow;
  }

  function startTreasureDefeatFlow(boss, visualEpoch, remainingHp, expiredTurnLimit) {
    stopTreasureResolutionFlow();
    const flowApi = window.MimiPresentationFlow;
    if (!flowApi || typeof flowApi.createSceneFlow !== "function") {
      completeTreasureDefeatReturn();
      return null;
    }
    try {
      treasureResolutionFlow = flowApi.createSceneFlow({
      definition: TREASURE_DEFEAT_FLOW,
      xstate: window.XState,
      onEnter(step) {
        if (visualEpoch !== bossVisualEpoch || !state.bossResolutionPending) return;
        if (step.stateId === "timeout") {
          els.bossSprite.classList.remove("hit", "defeat", "reward");
          setBossVisualState("attack");
          els.bossSprite.classList.add("attack");
        } else if (step.stateId === "retry") {
          els.bossSprite.classList.remove("attack", "hit", "defeat", "reward");
          setBossVisualState("idle");
          audio.cue("notice");
        } else if (step.stateId === "complete") {
          completeTreasureDefeatReturn();
        }
      },
      onScene(step) {
        if (visualEpoch !== bossVisualEpoch || !state.bossResolutionPending) return;
        if (!showPresentationScene(step.sceneId, step.payload)) {
          treasureResolutionFlow.handlePresentationLifecycle({ type: "cancel", sceneId: step.sceneId, runId: null, reason: "presentation-bridge-rejected" });
        }
      }
      });
    } catch (_error) {
      treasureResolutionFlow = null;
      completeTreasureDefeatReturn();
      return null;
    }
    treasureResolutionFlow.start({
      bossName: boss.name,
      hp: Math.max(0, Number(remainingHp) || 0),
      turnLimit: Math.max(1, Number(expiredTurnLimit) || economyRules.boss.turnLimit),
      nextTurnLimit: currentTreasureBossAdvantage().turnLimit,
      orb: state.orb,
      treasure: state.treasure,
      partyCount: state.bossPartyCount,
      readyCount: state.chapter1PreparedAllies.length,
      preparedAllies: state.chapter1PreparedAllies.slice(),
      resolveLevel: state.chapter1ResolveLevel,
      attempt: state.chapter1BossAttempt,
      visualEpoch: visualEpoch
    });
    return treasureResolutionFlow;
  }

  function handlePresentationLifecycle(event) {
    if (!treasureResolutionFlow || !event || !event.detail) return;
    treasureResolutionFlow.handlePresentationLifecycle(event.detail);
  }

  function completeTreasureVictoryReward() {
    state.bossHp = economyRules.boss.initialHp;
    state.bossStageId = "";
    els.bossSprite.classList.remove("defeat", "reward", "show");
    els.shell.classList.remove("presentation-active");
    setBossVisualState("idle");
    enterBonus("BOSS撃破・章クリアBONUS", false, "boss-victory");
  }

  function completeTreasureDefeatReturn() {
    state.bossBattle = false;
    state.bossResolutionPending = false;
    state.bossStageId = "";
    state.phase = "normal";
    state.bossHp = economyRules.boss.initialHp;
    state.bossTurns = 0;
    state.bossPartyCount = state.chapter1BetCoins;
    els.bossSprite.classList.remove("attack", "hit", "defeat", "reward", "show");
    els.shell.classList.remove("presentation-active");
    setBossVisualState("idle");
    setSceneMode("boss", "ヴェルベットに再挑戦");
    message(`仲間${state.chapter1PreparedAllies.length}人と再戦POWER Lv.${state.chapter1ResolveLevel}で、ヴェルベットに再挑戦！`);
    audio.setMood("resort");
    addLog("BOSS RETRY", `READY ${state.chapter1PreparedAllies.length}/4 · POWER Lv.${state.chapter1ResolveLevel}`);
    updateHud();
    updateButtons();
    window.requestAnimationFrame(function () { startBossBattle("treasure"); });
  }

  function startBossBattle(stageId = currentStageScript().id) {
    if (state.bossBattle || state.bossResolutionPending) return;
    stopTreasureResolutionFlow();
    bossVisualEpoch += 1;
    const boss = currentBossEntity();
    const isTreasureBoss = stageId === "treasure";
    const royalOrderBefore = isTreasureBoss ? chapter1RoyalOrderProgress() : null;
    state.phase = "battle";
    state.bossBattle = true;
    state.bossResolutionPending = false;
    state.bossStageId = stageId;
    state.bossHp = economyRules.boss.initialHp;
    state.bossTurns = 0;
    if (isTreasureBoss) {
      state.bossPartyCount = state.chapter1BetCoins;
      state.chapter1BossAttempt += 1;
      state.chapter1LastBossAdvantage = currentTreasureBossAdvantage();
      els.shell.dataset.chapter1ReadyCount = String(state.chapter1PreparedAllies.length);
      els.shell.dataset.chapter1ResolveLevel = String(state.chapter1ResolveLevel);
      els.shell.dataset.chapter1BossAttempt = String(state.chapter1BossAttempt);
      els.shell.dataset.chapter1BossTurnLimit = String(state.chapter1LastBossAdvantage.turnLimit);
      announceRoyalOrderMilestone(royalOrderBefore, chapter1RoyalOrderProgress());
    }
    if (state.bossPartyCount <= 0) {
      state.bossPartyCount = Math.max(
        economyRules.adventure.alliesInitial,
        Math.min(economyRules.adventure.alliesMax, Number(state.allies) || 0)
      );
    }
    // BOSS is a scene inside the current episode.  Keep the episode and its
    // boss stable instead of silently switching to the final raid roster.
    preloadBossImages(boss);
    setSceneMode("boss", "BOSS BATTLE");
    els.bossSprite.classList.remove("defeat", "hit", "attack");
    setBossVisualState("idle");
    els.bossSprite.alt = boss.name;
    if (isTreasureBoss) {
      const royalBossGoal = chapter1Flow.royalReplayBossGoal(
        state.chapter1RoyalOrderId,
        chapter1RoyalOrderProgress(),
      );
      startTreasureLockedScene("treasure.boss.enter", {
        bossTitle: boss.title,
        bossName: boss.name,
        opponentLine: chapter1Flow.BOSS_TABLE.arrivalLine,
        goalLine: royalBossGoal?.line || chapter1Flow.BOSS_TABLE.goalLine,
        royalOrderId: royalBossGoal?.id || "",
        royalOrderProgress: royalBossGoal?.compact || "",
        royalOrderQualified: Boolean(royalBossGoal?.qualified),
        hp: state.bossHp,
        partyCount: state.bossPartyCount,
        readyCount: state.chapter1PreparedAllies.length,
        preparedAllies: state.chapter1PreparedAllies.slice(),
        resolveLevel: state.chapter1ResolveLevel,
        attempt: state.chapter1BossAttempt,
        turnLimit: currentTreasureBossAdvantage().turnLimit,
      });
    } else {
      showChance("BOSS", `${boss.name} 出現`, `${boss.hint} ${boss.weakness}`, true);
    }
    els.shell.dataset.motif = "boss";
    els.bossSprite.classList.add("show");
    if (!isTreasureBoss) message(`${boss.name}が乱入。WINでHPを削り、撃破でBONUS確定。`);
    audio.setMood("boss");
    audio.cue("boss");
    updateHud();
  }

  function treasureBossAttackProfile(result) {
    const explicitId = String(result?.winningSymbolId || result?.rescuedSymbol?.id || "");
    const settledSymbols = Array.from(result?.litLines || []).map(line => {
      const firstCell = line?.cells?.[0];
      if (!firstCell) return null;
      return state.grid?.[firstCell[0]]?.[firstCell[1]] || null;
    }).filter(Boolean);
    const symbol = explicitId
      ? core.SYMBOL_BY_ID.get(explicitId)
      : settledSymbols.sort((a, b) => Number(b.pay) - Number(a.pay))[0];
    const symbolId = symbol?.id || (result?.replayHit ? core.REPLAY_SYMBOL : "default");
    const route = chapter1Flow.BOSS_ATTACK_TABLE[symbolId] || chapter1Flow.BOSS_ATTACK_TABLE.default;
    return Object.freeze(Object.assign({}, route, {
      symbolId: symbolId,
      symbolName: symbol?.name || (result?.replayHit ? "リプレイ" : "WIN")
    }));
  }

  function treasureBossRescueProfile() {
    const partyCount = Math.max(
      economyRules.adventure.alliesInitial,
      Math.min(economyRules.adventure.alliesMax, Number(state.bossPartyCount) || 0)
    );
    // Velvet unlocks with all four BET COINs, so the production rescue must
    // resolve to a real visible ally rather than the unsupported `finale`
    // placeholder. Polka owns the rally beat; smaller debug snapshots retain
    // deterministic fallbacks without English implementation labels.
    if (partyCount >= 4) return Object.freeze({ actorId: "polka", speaker: "ポルカ", technique: "ラッキーハンド！" });
    if (partyCount === 3) return Object.freeze({ actorId: "rico", speaker: "リコ先輩", technique: "オッズバックアップ！" });
    if (partyCount === 2) return Object.freeze({ actorId: "polka", speaker: "ポルカ", technique: "ラッキーハンド！" });
    return Object.freeze({ actorId: "mimi", speaker: "ミミ", technique: "ラビットリカバー！" });
  }

  function resolveBossTurn(result, spinBet = state.bet) {
    if (!state.bossBattle || state.bossResolutionPending) return null;
    const boss = currentBossEntity();
    const rewardStageId = state.bossStageId;
    const isTreasureBoss = rewardStageId === "treasure";
    const royalOrderBefore = isTreasureBoss ? chapter1RoyalOrderProgress() : null;
    if (isTreasureBoss && chapter1HotHandSettled()) {
      state.chapter1RunStrongLands += 1;
      announceRoyalOrderMilestone(royalOrderBefore, chapter1RoyalOrderProgress());
    }
    state.bossTurns += 1;
    const attackProfile = treasureBossAttackProfile(result);
    const baseDamage = economy.bossDamage(result.payout, spinBet);
    const advantage = isTreasureBoss
      ? currentTreasureBossAdvantage(baseDamage, attackProfile.actorId)
      : Object.freeze({
        baseDamage: baseDamage,
        totalDamage: baseDamage,
        teamDamage: 0,
        synergyDamage: 0,
        resolveDamage: 0,
        synergyActive: false,
        readyCount: 0,
        resolveLevel: 0,
        turnLimit: economyRules.boss.turnLimit,
      });
    const damage = advantage.totalDamage;
    if (isTreasureBoss) {
      state.chapter1LastBossAdvantage = advantage;
      els.shell.dataset.chapter1BossDamage = String(damage);
      els.shell.dataset.chapter1BossBonus = String(damage - baseDamage);
      els.shell.dataset.chapter1BossSynergy = String(advantage.synergyActive);
    }
    state.bossHp = Math.max(0, state.bossHp - damage);
    const defeated = state.bossHp <= 0;
    const timedOut = !defeated && state.bossTurns >= advantage.turnLimit;
    let treasureOutcome = defeated
      ? "victory"
      : attackProfile.kind === "guard"
        ? "guard"
      : !(result.payout > 0)
        ? "miss"
        : result.premium || damage >= 40
          ? "critical"
          : "hit";
    // These branches only select the authored response to an already-settled
    // MISS. They do not add a turn, restore STACK, award credit, or alter odds.
    if (treasureOutcome === "miss" && result.presentationHeat >= 4 && state.bossPartyCount > 1) {
      treasureOutcome = "revive";
    } else if (treasureOutcome === "miss" && result.presentationHeat >= 3) {
      treasureOutcome = "counterCritical";
    }
    if (isTreasureBoss) audio.roleBoss?.(attackProfile.symbolId, treasureOutcome);
    els.bossSprite.classList.remove("attack", "hit", "defeat");
    void els.bossSprite.offsetWidth;
    // A killing result owns the WIN scene outright. Starting HIT first would
    // create and immediately cancel a second upper-LCD timeline in one turn.
    if (!defeated && !(isTreasureBoss && timedOut)) {
      const bossVisualState = result.payout > 0 ? "hit" : "attack";
      setBossVisualState(bossVisualState);
      els.bossSprite.classList.add(bossVisualState);
      if (result.payout > 0) {
        slashBurst(4);
        burst(20, "#ff5a66");
        if (isTreasureBoss) {
          const route = TREASURE_BOSS_TURN_TABLE[treasureOutcome];
          startTreasureLockedScene(route.sceneId, {
            bossName: boss.name,
            damage: damage,
            hp: state.bossHp,
            turn: state.bossTurns,
            symbolId: attackProfile.symbolId,
            symbolName: attackProfile.symbolName,
            attackActor: attackProfile.actorId,
            attackSpeaker: attackProfile.speaker,
            technique: attackProfile.technique,
            partyCount: state.bossPartyCount,
            readyCount: advantage.readyCount,
            preparedAllies: advantage.preparedAllies,
            resolveLevel: advantage.resolveLevel,
            attempt: state.chapter1BossAttempt,
            turnLimit: advantage.turnLimit,
            baseDamage: advantage.baseDamage,
            teamDamage: advantage.teamDamage,
            synergyDamage: advantage.synergyDamage,
            resolveDamage: advantage.resolveDamage,
            synergyActive: advantage.synergyActive,
            heat: result.presentationHeat,
          });
        } else {
          showChance("HIT", `${boss.name}に ${damage} DAMAGE`, "ライトが弾け、ボスショーのゲージが大きく削れる。", damage >= 40);
        }
      } else if (isTreasureBoss && treasureOutcome === "guard") {
        const route = TREASURE_BOSS_TURN_TABLE.guard;
        startTreasureLockedScene(route.sceneId, {
          bossName: boss.name,
          hp: state.bossHp,
          turn: state.bossTurns,
          symbolId: attackProfile.symbolId,
          symbolName: attackProfile.symbolName,
          attackActor: attackProfile.actorId,
          attackSpeaker: attackProfile.speaker,
          technique: attackProfile.technique,
          partyCount: state.bossPartyCount,
          readyCount: advantage.readyCount,
          preparedAllies: advantage.preparedAllies,
          resolveLevel: advantage.resolveLevel,
          attempt: state.chapter1BossAttempt,
          turnLimit: advantage.turnLimit,
          heat: result.presentationHeat,
        });
      } else {
        if (isTreasureBoss) {
          const route = TREASURE_BOSS_TURN_TABLE[treasureOutcome];
          const rescue = treasureBossRescueProfile();
          startTreasureLockedScene(route.sceneId, {
            bossName: boss.name,
            hp: state.bossHp,
            turn: state.bossTurns,
            symbolId: attackProfile.symbolId,
            symbolName: attackProfile.symbolName,
            partyCount: state.bossPartyCount,
            rescueActor: rescue.actorId,
            rescueSpeaker: rescue.speaker,
            rescueTechnique: rescue.technique,
            readyCount: advantage.readyCount,
            preparedAllies: advantage.preparedAllies,
            resolveLevel: advantage.resolveLevel,
            attempt: state.chapter1BossAttempt,
            turnLimit: advantage.turnLimit,
            heat: result.presentationHeat,
          });
        } else {
          showChance("DANGER", `${boss.name}の反撃`, "外れのあとに何かが残る。復活か、継続か、次停止に注目。", false);
        }
      }
    }
    if (defeated) {
      const victoryVisualEpoch = ++bossVisualEpoch;
      state.bossResolutionPending = true;
      state.enemiesToBonus = economyRules.adventure.enemiesToBossInitial;
      audio.cue("bossDefeat");
      els.bossSprite.classList.remove("hit", "attack");
      setBossVisualState("defeat");
      els.bossSprite.classList.add("defeat");
      if (isTreasureBoss) {
      } else {
        showChance("VICTORY", `${boss.name}撃破`, "リゾートショー成功。BONUSルートが開く。", true);
      }
      showCutin("bonus");
      coinBurst(28);
      updateButtons();
      if (isTreasureBoss) {
        startTreasureVictoryFlow(boss, victoryVisualEpoch, attackProfile);
      } else {
        window.setTimeout(() => {
          if (victoryVisualEpoch !== bossVisualEpoch || !state.bossResolutionPending) return;
          els.bossSprite.classList.remove("defeat");
          setBossVisualState("reward");
          els.bossSprite.classList.add("reward");
          audio.cue("treasureReward");
        }, 4200);
        window.setTimeout(() => {
          if (victoryVisualEpoch !== bossVisualEpoch || !state.bossResolutionPending) return;
          state.bossHp = economyRules.boss.initialHp;
          state.bossStageId = "";
          els.bossSprite.classList.remove("defeat", "reward", "show");
          els.shell.classList.remove("presentation-active");
          setBossVisualState("idle");
          enterBonus("BOSS撃破・章クリアBONUS", false, "boss-victory");
        }, 8600);
      }
      return rewardStageId ? { stageId: rewardStageId, bossName: boss.name } : null;
    } else if (timedOut) {
      audio.cue(result.payout > 0 ? "bossHit" : "bossAttack");
      if (isTreasureBoss) {
        const timeoutVisualEpoch = ++bossVisualEpoch;
        const expiredTurnLimit = advantage.turnLimit;
        state.chapter1ResolveLevel = chapter1Flow.nextResolveLevel(state.chapter1ResolveLevel);
        state.chapter1LastBossAdvantage = currentTreasureBossAdvantage();
        els.shell.dataset.chapter1ResolveLevel = String(state.chapter1ResolveLevel);
        els.shell.dataset.chapter1BossTurnLimit = String(state.chapter1LastBossAdvantage.turnLimit);
        state.bossResolutionPending = true;
        updateButtons();
        startTreasureDefeatFlow(boss, timeoutVisualEpoch, state.bossHp, expiredTurnLimit);
      } else {
        state.bossBattle = false;
        state.bossResolutionPending = false;
        state.bossStageId = "";
        state.phase = "normal";
        state.sceneMode = "explore";
        state.bossHp = economyRules.boss.initialHp;
        state.enemiesToBonus = economyRules.adventure.enemiesToBossInitial;
        els.bossSprite.classList.remove("hit", "attack", "show");
        setBossVisualState("idle");
        setSceneMode("explore", "同じ章の通常液晶へ復帰");
        showChance("BATTLE END", `${boss.name}を取り逃がした`, "通常時へ戻る。集めたオーブと宝箱は残り、次のCHANCEを待つ。", false);
        message("ボス戦敗北。通常時へ戻り、上部液晶の冒険が再開する。");
        audio.setMood("resort");
        addLog("BATTLE END", "通常時へ");
      }
    } else {
      audio.cue(result.payout > 0 ? "bossHit" : "bossAttack");
    }
    return null;
  }

  // This is a real normal-adventure progression event, not a decorative flash.
  // Resolution owns RNG and the optional ORB gain; presentation receives the
  // immutable result and cannot feed back into economy or reel settlement.
  function resolveNormalChanceCue(phase) {
    if (state.phase !== "normal") return;
    if (currentStageScript().id === "treasure") return;
    const chance = phase === "start"
      ? economyRules.chanceCue.startBaseChance + state.orb * economyRules.chanceCue.startChancePerOrb
      : economyRules.chanceCue.middleBaseChance + state.orb * economyRules.chanceCue.middleChancePerOrb;
    if (gameRandom() > chance) return;
    const hot = gameRandom() < economyRules.chanceCue.hotBaseChance + state.orb * economyRules.chanceCue.hotChancePerOrb;
    const cue = Object.freeze({
      phase,
      hot,
      orbGain: hot ? economyRules.orb.chanceCueGain : 0,
      presentationHeat: currentSpin?.presentationHeat || currentPresentationHeat().heat,
      presentationCue: currentSpin?.presentation?.cue || currentPresentationHeat().cue,
    });
    if (hot) {
      state.orb = Math.min(economyRules.orb.max, state.orb + economyRules.orb.chanceCueGain);
    }
    if (currentSpin) {
      if (!Array.isArray(currentSpin.progressionCues)) currentSpin.progressionCues = [];
      currentSpin.progressionCues.push(cue);
    }
    return cue;
  }

  function presentNormalChanceCue(cue) {
    if (!cue) return false;
    if (currentStageScript().id === "treasure") {
      audio.cue(cue.hot ? "hot" : "notice");
      if (cue.hot) burst(16, "#ffd36a");
      return true;
    }
    const heat = Math.max(cue.presentationHeat, cue.hot ? 4 : 1);
    const rank = heat >= 4 ? "激アツ" : heat >= 3 ? "CHANCE" : cue.phase === "start" ? "NOTICE" : "CHANCE";
    showStoryChance(rank, cue.hot ? "ぱにゅ！" : currentStageScript().chance, cue.hot);
    audio.cue(cue.hot ? "hot" : "notice");
    if (cue.hot) burst(16, "#ffd36a");
    return true;
  }

  function maybeChanceCue(phase) {
    return presentNormalChanceCue(resolveNormalChanceCue(phase));
  }

  function showStoryChance(rank, text, hot) {
    const beat = storyBeats[state.storyIndex % storyBeats.length];
    if (hot) state.storyIndex = (state.storyIndex + 1) % storyBeats.length;
    showChance(rank, `${beat.chapter}: ${text}`, beat.text, hot);
  }

  function showPresentationScene(sceneId, payload) {
    const bridge = window.__mimiPresentationGameBridge;
    if (!bridge || bridge.ready !== true || typeof bridge.playScene !== "function") return false;
    return Boolean(bridge.playScene(String(sceneId || ""), Object.freeze(Object.assign({}, payload || {})), "game-flow"));
  }

  function showChance(rank, text, story, hot) {
    const motifId = rank === "JACKPOT" ? "jackpot"
      : rank === "NOTICE" ? "notice"
      : rank === "BONUS" || rank === "VICTORY" ? "bonus"
        : rank === "BOSS" || rank === "DANGER" ? "boss"
          : rank === "REVIVE" ? "revive"
            : hot ? "hot" : "chance";
    const motif = content.effectMotifs?.[motifId] || content.effectMotifs?.chance;
    els.shell.dataset.motif = motif?.id || motifId;
    els.chanceOverlay.dataset.heat = String(motif?.heat || (hot ? 3 : 2));
    els.chanceOverlay.dataset.motif = motif?.id || motifId;
    els.chanceRank.textContent = rank;
    els.chanceText.textContent = text;
    els.chanceStory.textContent = story || storyBeats[state.storyIndex % storyBeats.length].text;
    els.chanceOverlay.classList.toggle("hot", Boolean(hot));
    els.chanceOverlay.classList.remove("show");
    void els.chanceOverlay.offsetWidth;
    els.chanceOverlay.classList.add("show");
    if (motifId === "hot") els.push.classList.add("motif-pulse");
    if (motifId === "boss") els.bossSprite.classList.add("motif-arrive");
    if (motifId === "bonus") coinBurst(18);
    if (motifId === "jackpot") els.shell.classList.add("motif-series-chain");
    window.setTimeout(() => {
      els.push.classList.remove("motif-pulse");
      els.bossSprite.classList.remove("motif-arrive");
      els.shell.classList.remove("motif-series-chain");
    }, motifId === "jackpot" ? 3200 : 1800);
  }

  function drawPayline(line) {
    if(window.MimiReelLines){window.MimiReelLines.draw(els.paylineLayer,els.reels,line,state.grid[line.cells[0][0]][line.cells[0][1]].id==='replay');return;}
    const el = document.createElement("div");
    el.className = `payline ${line.className}`;
    els.paylineLayer.appendChild(el);
    window.setTimeout(() => el.remove(), 1300);
  }

  function showWinLabel(payout) {
    const current = els.reelFrame.querySelector(".win-burst-label");
    if (current) current.remove();
    const label = document.createElement("div");
    label.className = "win-burst-label";
    label.textContent = `WIN ${payout}`;
    els.reelFrame.appendChild(label);
    window.setTimeout(() => label.remove(), 1200);
  }

  function showCutin(id) {
    const cutin = cutins[id] || { text: id, image: cutins.chance.image };
    els.cutinText.textContent = cutin.text;
    els.cutinImage.src = cutin.image;
    els.cutin.dataset.kind = id;
    els.cutin.classList.remove("show");
    void els.cutin.offsetWidth;
    els.cutin.classList.add("show");
  }

  function burst(count, color) {
    if (isMotionReduced()) return;
    for (let i = 0; i < count; i += 1) {
      const spark = document.createElement("i");
      spark.className = "spark";
      spark.style.left = `${45 + Math.random() * 16}%`;
      spark.style.top = `${42 + Math.random() * 18}%`;
      spark.style.color = color;
      spark.style.background = color;
      spark.style.setProperty("--dx", `${(Math.random() - 0.5) * 420}px`);
      spark.style.setProperty("--dy", `${(Math.random() - 0.75) * 360}px`);
      els.particles.appendChild(spark);
      window.setTimeout(() => spark.remove(), 950);
    }
  }

  function impact(col) {
    if (isMotionReduced()) return;
    els.reelFrame.classList.remove("shake");
    if (!usesChapter1CommandSurface()) void els.reelFrame.offsetWidth;
    els.reelFrame.classList.add("shake");
    const x = 24 + col * 26;
    for (let i = 0; i < 8; i += 1) {
      const spark = document.createElement("i");
      spark.className = "spark";
      spark.style.left = `${x + Math.random() * 12}%`;
      spark.style.top = `${30 + Math.random() * 42}%`;
      spark.style.color = "#63e3ff";
      spark.style.background = "#63e3ff";
      spark.style.setProperty("--dx", `${(Math.random() - 0.5) * 160}px`);
      spark.style.setProperty("--dy", `${(Math.random() - 0.65) * 160}px`);
      els.particles.appendChild(spark);
      window.setTimeout(() => spark.remove(), 950);
    }
    vibrate(10);
  }

  function coinBurst(count) {
    if (isMotionReduced()) return;
    for (let i = 0; i < count; i += 1) {
      const coin = document.createElement("i");
      coin.className = "coin";
      coin.style.left = `${48 + Math.random() * 8}%`;
      coin.style.top = `${48 + Math.random() * 8}%`;
      coin.style.setProperty("--dx", `${(Math.random() - 0.5) * 520}px`);
      coin.style.setProperty("--dy", `${-120 - Math.random() * 300}px`);
      els.particles.appendChild(coin);
      window.setTimeout(() => coin.remove(), 1050);
    }
  }

  function slashBurst(count) {
    if (isMotionReduced()) return;
    for (let i = 0; i < count; i += 1) {
      const slash = document.createElement("i");
      slash.className = "slash";
      slash.style.left = `${26 + Math.random() * 42}%`;
      slash.style.top = `${26 + Math.random() * 42}%`;
      slash.style.setProperty("--rot", `${-28 + Math.random() * 56}deg`);
      slash.style.animationDelay = `${i * 70}ms`;
      els.particles.appendChild(slash);
      window.setTimeout(() => slash.remove(), 900 + i * 70);
    }
  }

  function characterHit() {
    els.characterWrap.style.animation = "characterDamage 420ms ease-out";
    window.setTimeout(() => {
      els.characterWrap.style.animation = "";
    }, 460);
  }

  function stageFlash() {
    els.stageFlash.classList.remove("show");
    void els.stageFlash.offsetWidth;
    els.stageFlash.classList.add("show");
  }

  function message(text, speakerName = "") {
    els.characterDialog.dataset.messageSpeaker = speakerName;
    if (speakerName) els.speaker.textContent = speakerName;
    els.message.textContent = text;
    clearTimeout(messageTimer);
    els.characterDialog.classList.remove("show");
    void els.characterDialog.offsetWidth;
    els.characterDialog.classList.add("show");
    messageTimer = window.setTimeout(() => els.characterDialog.classList.remove("show"), 2200);
  }

  function addLog(kind, text) {
    const p = document.createElement("p");
    p.innerHTML = `<strong>${kind}</strong> ${text}`;
    els.log.prepend(p);
    while (els.log.children.length > 12) els.log.lastChild.remove();
  }

  function toast(text) {
    els.toast.textContent = text;
    els.toast.classList.add("show");
    window.setTimeout(() => els.toast.classList.remove("show"), 1200);
  }

  function announceResult(result, spinPhase) {
    if (!els.resultAnnouncer) return;
    const ids = state.grid.map(column => column.map(sym => sym.name).join("、")).join(" / ");
    const outcome = result.jackpot
      ? `ジャックポット、${result.payout}クレジット`
      : result.replayHit
        ? "リプレイ、次ゲーム無料"
        : result.payout > 0
          ? `${result.payout}クレジット獲得`
          : "はずれ";
    els.resultAnnouncer.textContent = `${spinPhase}。${outcome}。表示図柄 ${ids}。残りクレジット ${state.credit}。`;
  }

  function openCreditRescue() {
    if (!els.creditRescue) return;
    creditRescueClaimed = false;
    els.creditRescue.hidden = false;
    setSlotModalIsolation(true, els.creditRescue);
    els.creditRescueButton.focus();
    audio.cue("notice");
  }

  function closeCreditRescue() {
    els.creditRescue.hidden = true;
    setSlotModalIsolation(false, els.creditRescue);
    els.spin.focus();
  }

  function vibrate(pattern) {
    if (isMotionReduced()) return;
    if (!navigator.vibrate) return;
    try {
      navigator.vibrate(pattern);
    } catch (_) {
      // Desktop browsers often expose the API but ignore the request.
    }
  }

  function renderPayouts() {
    // 配当の高い順に並べる。リプレイは払い出しが無いので別扱いで最後に置く。
    const paying = symbols.filter(sym => sym.pay > 0).slice().sort((a, b) => b.pay - a.pay);
    const rows = paying.map(sym =>
      `<div class="payout-row" data-tier="${sym.tier}"><img src="${symImage(sym)}" alt=""><span>${sym.name}</span><strong>x${sym.pay}</strong></div>`);
    const replay = core.SYMBOL_BY_ID.get(core.REPLAY_SYMBOL);
    rows.push(`<div class="payout-row" data-tier="small"><img src="${symImage(replay)}" alt=""><span>${replay.name}</span><strong>再遊技</strong></div>`);
    els.payoutList.innerHTML = rows.join("");
  }

  function changeBet(delta) {
    if (state.spinning) return;
    const bets = [10, 20, 30, 50, 100];
    const index = bets.indexOf(state.bet);
    const next = Math.max(0, Math.min(bets.length - 1, index + delta));
    state.bet = bets[next];
    updateHud();
  }

  function bind() {
    window.addEventListener("mimi:presentation-lifecycle", handlePresentationLifecycle);
    window.addEventListener("mimi:casino-arrival", announceChapter1Opponent);
    const onPress = (el, fn, instant = false) => {
      let pointerHandled = false;
      const pressOnDown = instant && usesChapter1CommandSurface();
      el.addEventListener(pressOnDown ? 'pointerdown' : 'pointerup', event => {
        if (event.button !== 0 || event.isPrimary === false) return;
        event.preventDefault();
        pointerHandled = true;
        fn();
        if (!pressOnDown) window.setTimeout(() => { pointerHandled = false; }, 350);
      });
      el.addEventListener('click', event => {
        if (pointerHandled) { event.preventDefault(); pointerHandled = false; return; }
        fn();
      });
      el.addEventListener('pointercancel', () => { pointerHandled = false; });
      if (pressOnDown) el.addEventListener('keydown', event => {
        if (!['Space', 'Enter'].includes(event.code)) return;
        event.preventDefault();
        if (event.repeat) return;
        pointerHandled = false; fn();
      });
    };

    let lastContactSoundAt = -Infinity;
    const cabinetPress = (button, action) => {
      if (button.dataset.inputReady === "false") {
        // A physical press still answers while the result/arrival owns play.
        // No queued bet, stop, or presentation skip is created by this touch.
        if (currentView === "slot" && profile.settings.sound) {
          const now = performance.now();
          if (now - lastContactSoundAt >= 55) {
            lastContactSoundAt = now;
            audio.unlock();
            audio.cue("press");
          }
        }
        return;
      }
      action();
    };
    onPress(els.spin, () => cabinetPress(els.spin, startSpin), true);
    onPress(els.push, () => {
      if (advanceChapter1Command()) return;
      if (!state.spinning) {
        startSpin();
        return;
      }
      stopNextReel();
    }, true);
    onPress(els.betDown, () => changeBet(-1));
    onPress(els.betUp, () => changeBet(1));
    onPress(els.auto, () => {
      state.auto = !state.auto;
      if (!state.auto) clearTimeout(autoTimer);
      updateHud();
      toast(state.auto ? "AUTO ON" : "AUTO OFF");
      if (state.auto && !state.spinning) startSpin();
    });
    onPress(els.turbo, () => {
      state.turbo = !state.turbo;
      updateHud();
      toast(state.turbo ? "TURBO ON" : "TURBO OFF");
    });
    onPress(els.sound, () => {
      profile.settings.sound = !profile.settings.sound;
      audio.unlock();
      audio.setEnabled(profile.settings.sound);
      if (profile.settings.sound && currentView === "slot") audio.setMood(state.phase === "bonus" ? "bonus" : state.bossBattle ? "boss" : "resort");
      saveProfile();
      updateHud();
      toast(profile.settings.sound ? "SOUND ON" : "SOUND OFF");
    });
    onPress(els.motion, () => {
      profile.settings.motion = profile.settings.motion === "reduced" ? "full" : "reduced";
      audio.setReduced(isMotionReduced());
      saveProfile();
      updateHud();
      toast(isMotionReduced() ? (motionPreference?.matches ? "FX LIGHT (SYSTEM)" : "FX LIGHT") : "FX FULL");
    });
    onPress(els.creditRescueButton, () => {
      // Pointer and synthetic click delivery can be separated by more than
      // the generic de-duplication window. One opened offer owns one claim.
      if (creditRescueClaimed) return;
      creditRescueClaimed = true;
      const grant = 300;
      state.credit += grant;
      state.bet = Math.min(state.bet, state.credit);
      profile.stats.resortPasses += 1;
      saveProfile();
      closeCreditRescue();
      updateHud();
      announceResult({ payout: 0, replayHit: false, jackpot: false }, "RESORT SERVICE");
      toast("300 CREDIT GRANTED");
      startSpin();
    });
    els.stopButtons.forEach(button => {
      onPress(button, () => cabinetPress(button, () => stopReel(Number(button.dataset.stop))), true);
    });
    window.addEventListener("keydown", event => {
      if (!els.helpOverlay.hidden) {
        if (event.code === "Escape") setHelpOpen(false);
        if (event.code === "Tab") {
          const focusable = Array.from(els.helpOverlay.querySelectorAll('button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'));
          const first = focusable[0];
          const last = focusable[focusable.length - 1];
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
          }
        }
        return;
      }
      if (els.creditRescue.hidden === false) {
        if (event.code === "Tab") {
          event.preventDefault();
          els.creditRescueButton.focus();
        }
        return;
      }
      if (currentView !== "slot" || event.repeat) return;
      const target = event.target;
      if (target instanceof HTMLElement && (target.matches("button, input, select, textarea, a, [contenteditable]") || target.closest("button, a"))) return;
      if (event.code === "Space") {
        event.preventDefault();
        startSpin();
      }
      if (/Digit[1-3]/.test(event.code)) stopReel(Number(event.code.slice(-1)) - 1);
    });
  }

  /**
   * 1280x720 のデザインキャンバスを、画面に収まる最大倍率で拡大縮小する。
   * これで PC でもスマホ横持ちでも同じ 16:9 の絵がそのまま出る。
   */
  function fitDesignCanvas() {
    const styles = getComputedStyle(document.documentElement);
    const width = parseFloat(styles.getPropertyValue("--design-w")) || 1280;
    const height = parseFloat(styles.getPropertyValue("--design-h")) || 720;
    const scale = Math.min(window.innerWidth / width, window.innerHeight / height);
    document.documentElement.style.setProperty("--app-scale", String(scale));
  }

  fitDesignCanvas();
  window.addEventListener("resize", fitDesignCanvas);
  window.addEventListener("orientationchange", fitDesignCanvas);
  if (window.visualViewport) window.visualViewport.addEventListener("resize", fitDesignCanvas);

  window.MimiMachineLobby?.mount();
  bindAppShell();
  audio.setEnabled(profile.settings.sound);
  audio.setReduced(isMotionReduced());
  motionPreference?.addEventListener?.("change", () => {
    audio.setReduced(isMotionReduced());
    updateHud();
  });
  els.shell.classList.add("preload");
  renderPayouts();
  bind();
  updateHud();
  addLog("READY", "SPINで開始");
  window.__mimiSlotDebug = {
    state,
    symbols,
    strips,
    paylines,
    core,
    reels,
    setGrid(ids) {
      state.grid = ids.map(column => column.map(id => core.SYMBOL_BY_ID.get(id)));
      return evaluate();
    },
    /** 目押しテスト用。col 番リールの中段を index に合わせて止める。 */
    forceStop(col, index) {
      const reel = reels[col];
      reel.pos = core.mod(index, reel.length);
      reel.index = reel.pos;
      reel.phase = "stopped";
      state.reelsStopped[col] = true;
      paintReels(true);
      syncGrid();
      return state.grid.map(column => column.map(sym => sym.id));
    },
    rollFlag: () => core.rollFlag(flagMode(), gameRandom),
    getPresentationHeat(flag = "none") {
      return currentPresentationHeat(flag, flagMode());
    },
    setSeed: setGameSeed,
    setScene: setDebugScene,
    showChance(rank = "CHANCE", title = "ぱにゅの予告", story = "集めた光がVIP卓への道を示す。", hot = false) {
      showChance(rank, title, story, hot);
      return { rank, title, story, hot: Boolean(hot) };
    },
    /**
     * requestAnimationFrame に頼らずリールを進める（自動テスト用）。
     * 非表示タブでは rAF が止まるので、検証はこちらを使う。
     */
    step(ms = 16) {
      return advance(ms / 1000);
    },
    startSpin,
    stopReel,
    cancelAutoStop() {
      window.clearTimeout(safetyTimer);
      safetyTimer = 0;
      return true;
    },
    getTransaction() {
      return currentSpin ? JSON.parse(JSON.stringify(currentSpin)) : null;
    },
    grantCredit(amount = 1200) {
      state.credit = Math.max(state.credit, Math.floor(amount));
      updateHud();
      return state.credit;
    },
    startBoss() {
      startBossBattle();
      return {
        hp: state.bossHp,
        attempt: state.chapter1BossAttempt,
        readyCount: state.chapter1PreparedAllies.length,
        resolveLevel: state.chapter1ResolveLevel,
        turnLimit: currentTreasureBossAdvantage().turnLimit,
      };
    },
    configureChapter1BossLoop(options = {}) {
      if (state.spinning || state.bossResolutionPending) return null;
      const configured = chapter1Flow.bossAdvantage({
        preparedAllies: options.preparedAllies,
        resolveLevel: options.resolveLevel,
      });
      state.chapter1BetCoins = chapter1Flow.BOSS_TABLE.requiredBetCoins;
      state.treasure = state.chapter1BetCoins;
      state.chapter1PreparedAllies = configured.preparedAllies.slice();
      state.chapter1ResolveLevel = configured.resolveLevel;
      state.chapter1BossAttempt = Math.max(0, Math.floor(Number(options.attempt) || 0));
      state.chapter1LastBossAdvantage = configured;
      state.bossBattle = false;
      state.bossResolutionPending = false;
      state.bossStageId = "";
      state.phase = "normal";
      state.bossHp = economyRules.boss.initialHp;
      state.bossTurns = 0;
      updateHud();
      return {
        betCoins: state.chapter1BetCoins,
        preparedAllies: state.chapter1PreparedAllies.slice(),
        readyCount: configured.readyCount,
        resolveLevel: configured.resolveLevel,
        turnLimit: configured.turnLimit,
      };
    },
    resolveBoss(payout, options = {}) {
      resolveBossTurn({
        payout,
        premium: Boolean(options.premium),
        replayHit: Boolean(options.replayHit),
        winningSymbolId: options.symbolId || "",
        presentationHeat: Number.isFinite(Number(options.presentationHeat))
          ? Math.max(1, Math.min(5, Number(options.presentationHeat)))
          : 1
      });
      return {
        active: state.bossBattle,
        hp: state.bossHp,
        pending: state.bossResolutionPending,
        turn: state.bossTurns,
        advantage: state.chapter1LastBossAdvantage,
      };
    },
    timeoutBossAttempt(options = {}) {
      if (!state.bossBattle || state.bossResolutionPending) return null;
      state.bossTurns = Math.max(0, currentTreasureBossAdvantage().turnLimit - 1);
      return this.resolveBoss(0, {
        symbolId: options.symbolId || "none",
        presentationHeat: Number.isFinite(Number(options.presentationHeat)) ? Number(options.presentationHeat) : 4,
      });
    },
    beginTrial(type = "training") {
      startTrial(type);
      return { phase: state.phase, spins: state.trialSpins, score: state.trialScore };
    },
    enterBonus(cue = "DEBUG BONUS") {
      enterBonus(cue);
      return { phase: state.phase, games: state.bonusGames };
    },
    resolveBonus(payout = 1) {
      resolveBonusSpin({ payout });
      return { phase: state.phase, games: state.bonusGames };
    },
    showView
  };
  preloadAssets();
  function preloadAssets() {
    const urls = Array.from(new Set([
      ...loadingAssets
    ]));
    let done = 0;
    const update = () => {
      const percent = Math.round((done / urls.length) * 100);
      els.loadingFill.style.width = `${percent}%`;
      els.loadingText.textContent = `リゾートを準備中... ${percent}%`;
    };
    update();
    return Promise.all(urls.map(url => new Promise(resolve => {
      const img = new Image();
      const timeout = window.setTimeout(() => finish(), 5000);
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeout);
        done += 1;
        update();
        resolve();
      };
      img.onload = finish;
      img.onerror = finish;
      img.src = url;
    }))).then(() => new Promise(resolve => {
      window.setTimeout(() => {
        els.loading.classList.add("hide");
        els.shell.classList.remove("preload");
        const requestedView = new URLSearchParams(window.location.search).get("view");
        // A saved cabinet exit returns to the island through the same guarded
        // entry/receipt transaction as the title's island button. Other deep
        // links must not bypass the normal title or open a cabinet automatically.
        showView(requestedView === "machines" ? "machines" : staySurface && requestedView === "home" ? "home" : "title");
        els.loading.setAttribute("aria-busy", "false");
        els.shell.dataset.runtimeReady = "true";
        resolve();
      }, 260);
    }));
  }
}());
