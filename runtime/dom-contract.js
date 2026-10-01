/*
 * Shared DOM contract for the current game and the Visual Reset V5 shell.
 *
 * The runtime, replacement HTML and static verifier must depend on this single
 * map.  New presentation markup may wrap these nodes, but it must not invent a
 * second set of gameplay controls or duplicate IDs.
 */
(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.MimiDomContract = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const singles = Object.freeze({
    appRoot: "#appRoot",
    shopGrid: "#shopGrid",
    shopMessage: "#shopMessage",
    collectionGuide: "#collectionGuide",
    dailyCoinClaim: "#dailyCoinClaim",
    dailyCoinStatus: "#dailyCoinStatus",
    paidSpinRewardStatus: "#paidSpinRewardStatus",
    bossRewardStatus: "#bossRewardStatus",
    collectionReceipt: "#collectionReceipt",
    machineCarousel: "#machineCarousel",
    loading: "#loadingScreen",
    loadingFill: "#loadingFill",
    loadingText: "#loadingText",
    reels: "#reels",
    credit: "#credit",
    bet: "#bet",
    win: "#win",
    jackpot: "#jackpotValue",
    spin: "#spinBtn",
    betDown: "#betDown",
    betUp: "#betUp",
    auto: "#autoBtn",
    turbo: "#turboBtn",
    sound: "#soundBtn",
    motion: "#motionBtn",
    orbFill: "#orbFill",
    orbText: "#orbText",
    log: "#log",
    payoutList: "#payoutList",
    message: "#message",
    mode: "#modeLabel",
    stage: "#stageLabel",
    cutin: "#cutin",
    cutinImage: "#cutinImage",
    cutinText: "#cutinText",
    characterArt: "#characterArt",
    speaker: "#speaker",
    stageBg: "#stageBg",
    stageName: "#stageName",
    stageSub: "#stageSub",
    timeLabel: "#timeLabel",
    expectationStars: "#expectationStars",
    objectiveLabel: "#objectiveLabel",
    episodeLabel: "#episodeLabel",
    sequenceLabel: "#sequenceLabel",
    sequenceTitle: "#sequenceTitle",
    sequenceObjective: "#sequenceObjective",
    sceneEnemy: "#sceneEnemy",
    enemyTitle: "#enemyTitle",
    partyStrip: "#partyStrip",
    orbGems: "#orbGems",
    treasureStock: "#treasureStock",
    casinoOpponent: "#casinoOpponent",
    casinoTableHud: "#casinoTableHud",
    adventureRoad: "#adventureRoad",
    adventurer: "#adventurer",
    adventureTitle: "#adventureTitle",
    adventureText: "#adventureText",
    adventureEvent: "#adventureEvent",
    battleCounter: "#battleCounter",
    bossSprite: "#bossSprite",
    bossHp: "#bossHp",
    bossHpFill: "#bossHpFill",
    chanceOverlay: "#chanceOverlay",
    chanceRank: "#chanceRank",
    chanceText: "#chanceText",
    chanceStory: "#chanceStory",
    push: "#pushBtn",
    chapterCommand: "#chapterCommand",
    chapterCommandSpeaker: "#chapterCommandSpeaker",
    chapterCommandLine: "#chapterCommandLine",
    chapterCommandAction: "#chapterCommandAction",
    particles: "#particles",
    stageFlash: "#stageFlash",
    reelFlare: "#reelFlare",
    reelFrame: "#reelFrame",
    paylineLayer: "#paylineLayer",
    characterWrap: ".character-wrap",
    characterDialog: "#characterDialog",
    sequence: ".scene-sequence",
    helpOpen: "#helpOpen",
    helpOverlay: "#helpOverlay",
    helpBackdrop: "#helpBackdrop",
    helpClose: "#helpClose",
    shell: "#gameShell",
    featureName: "#featureName",
    toast: "#toast",
    resultAnnouncer: "#resultAnnouncer",
    creditRescue: "#creditRescue",
    creditRescueButton: "#creditRescueBtn"
  });

  const collections = Object.freeze({
    views: Object.freeze({ selector: "[data-view]", minimum: 5 }),
    routes: Object.freeze({ selector: "[data-route]", minimum: 7 }),
    wallets: Object.freeze({ selector: "[data-wallet]", minimum: 3 }),
    shopTabs: Object.freeze({ selector: "[data-shop-tab]", exact: 3 }),
    stopButtons: Object.freeze({ selector: "[data-stop]", exact: 3 }),
    helpTabs: Object.freeze({ selector: "[data-help-tab]", exact: 4 }),
    helpPages: Object.freeze({ selector: "[data-help-page]", exact: 4 })
  });

  function inspect(documentRef) {
    if (!documentRef || typeof documentRef.querySelector !== "function") {
      throw new TypeError("A DOM document is required");
    }
    const missing = [];
    const invalidCounts = [];
    const resolved = Object.create(null);

    Object.entries(singles).forEach(([key, selector]) => {
      const element = documentRef.querySelector(selector);
      if (!element) missing.push(Object.freeze({ key, selector }));
      resolved[key] = element || null;
    });

    Object.entries(collections).forEach(([key, rule]) => {
      const elements = Array.from(documentRef.querySelectorAll(rule.selector));
      const valid = Number.isInteger(rule.exact)
        ? elements.length === rule.exact
        : elements.length >= rule.minimum;
      if (!valid) {
        invalidCounts.push(Object.freeze({
          key,
          selector: rule.selector,
          actual: elements.length,
          expected: Number.isInteger(rule.exact) ? `exact ${rule.exact}` : `minimum ${rule.minimum}`
        }));
      }
      resolved[key] = Object.freeze(elements);
    });

    return Object.freeze({
      ok: missing.length === 0 && invalidCounts.length === 0,
      missing: Object.freeze(missing),
      invalidCounts: Object.freeze(invalidCounts),
      elements: Object.freeze(resolved)
    });
  }

  function resolve(documentRef) {
    const report = inspect(documentRef);
    if (!report.ok) {
      const details = report.missing.map(item => `${item.key}:${item.selector}`)
        .concat(report.invalidCounts.map(item => `${item.key}:${item.actual} (${item.expected})`));
      throw new Error(`Mimi DOM contract failed — ${details.join(", ")}`);
    }
    return report.elements;
  }

  return Object.freeze({ singles, collections, inspect, resolve });
});
