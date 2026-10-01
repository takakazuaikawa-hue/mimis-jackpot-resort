/* 独立台の紀行進行。配当と回胴抽選は共通経済から受け取り、再計算しない。 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.MimiDragonProgression = api;
}(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const TARGETS = Object.freeze([3, 4, 5, 6]);
  const CONTINUATION_TARGET = 4;
  const ORDERS = Object.freeze([
    { id: "observe", title: "走りの観察", goal: "観察を2回完成させる", target: 2 },
    { id: "variety", title: "いろんな竜に会う", goal: "4種類の役を成立させる", target: 4 },
    { id: "cheer", title: "小さな的中を重ねる", goal: "配当のある的中を8回", target: 8 },
    { id: "aim", title: "走りを見切る", goal: "READYで待ち、AIMで3つ止める×2回", target: 2 },
  ]);
  function int(n, fallback, max) { return Number.isSafeInteger(n) && n >= 0 && n <= max ? n : fallback; }
  function normalize(raw = {}) {
    const r = raw && typeof raw === "object" ? raw : {};
    return {
      version: 1, journey: int(r.journey, 0, 1000000), spins: int(r.spins, 0, 100000000),
      section: int(r.section, 0, 3), points: int(r.points, 0, 6),
      phase: ["normal", "trial", "boss", "bonus"].includes(r.phase) ? r.phase : "normal",
      dry: int(r.dry, 0, 4), ready: r.ready === true,
      trialGames: int(r.trialGames, 0, 3), trialScore: int(r.trialScore, 0, 6), trialAttempts: int(r.trialAttempts, 0, 100),
      bossHp: int(r.bossHp, 75, 75), bossTurns: int(r.bossTurns, 0, 20), resolve: int(r.resolve, 0, 3),
      bonusLeft: int(r.bonusLeft, 10, 10), orderProgress: int(r.orderProgress, 0, 1000000),
      seen: Array.isArray(r.seen) ? [...new Set(r.seen.filter(x => ["cherry", "bell", "grape", "watermelon", "bar", "seven_blue", "seven_red", "replay"].includes(x)))] : [],
      album: Array.isArray(r.album) ? [...new Set(r.album.filter(x => typeof x === "string" && /^(cherry|bell|grape|watermelon|bar|seven_blue|seven_red|replay):[0-3]$/.test(x)))].slice(0, 32) : [],
      stamps: int(r.stamps, 0, 1000000),
      bonusTotal: int(r.bonusTotal, 0, 1e12), bestBonus: int(r.bestBonus, 0, 1e12),
      lastBonus: int(r.lastBonus, 0, 1e12), totalPayout: int(r.totalPayout, 0, 1e12),
      raceKind: r.raceKind === "encore" ? "encore" : "shingan",
      chainSets: Math.max(r.phase === "bonus" || r.raceKind === "encore" ? 1 : 0, int(r.chainSets, 0, 1000000)), bestChain: int(r.bestChain, 0, 1000000),
      stock: int(r.stock, 0, 2), cheers: int(r.cheers, 0, 2), continuationScore: int(r.continuationScore, 0, 10),
    };
  }
  function order(state) { return ORDERS[state.journey % ORDERS.length]; }
  function settle(previous, receipt, economy) {
    if (!receipt || typeof receipt.replay !== "boolean" || typeof receipt.flagLanded !== "boolean"
      || !Number.isSafeInteger(receipt.payout) || receipt.payout < 0 || !(receipt.bet > 0)) throw new Error("確定済み回胴結果が必要です");
    const next = normalize(previous), prior = normalize(previous), cfg = economy.CONFIG;
    next.spins++;
    next.totalPayout = Math.min(1e12, prior.totalPayout + receipt.payout);
    const paid = receipt.payout > 0;
    const strong = receipt.flagLanded && ["grape", "watermelon", "bar", "seven_blue", "seven_red"].includes(receipt.flag);
    const events = [];
    const currentOrder = order(next);
    function finishJourney() {
      next.lastBonus = next.bonusTotal;
      const completed = next.orderProgress >= currentOrder.target;
      next.stamps += completed ? 1 : 0;
      events.push(completed ? "order-clear" : "order-miss", "journey-clear");
      next.journey++; next.section = 0; next.points = 0; next.phase = "normal";
      next.dry = 0; next.ready = false; next.trialAttempts = 0; next.resolve = 0;
      next.orderProgress = 0; next.seen = []; next.raceKind = "shingan";
      next.stock = 0; next.cheers = 0; next.continuationScore = 0;
    }
    if (receipt.flagLanded && receipt.flag !== "none") {
      if (!next.seen.includes(receipt.flag)) next.seen.push(receipt.flag);
      const entry = receipt.flag + ":" + next.section;
      if (!next.album.includes(entry)) { next.album.push(entry); events.push("new-record"); }
    }
    if (currentOrder.id === "variety") next.orderProgress = next.seen.length;
    if (currentOrder.id === "cheer" && paid) next.orderProgress++;
    if (currentOrder.id === "aim" && strong && receipt.aimed === true) next.orderProgress++;
    if (prior.phase === "normal") {
      const learned = !receipt.replay && prior.ready;
      const progress = learned ? 1 : paid ? (strong ? 2 : 1) : 0;
      if (!receipt.replay) {
        next.dry = progress ? 0 : Math.min(4, prior.dry + 1);
        next.ready = next.dry === 4;
      }
      if (learned) { events.push("observation"); if (currentOrder.id === "observe") next.orderProgress++; }
      next.points = Math.min(TARGETS[next.section], prior.points + progress);
      if (next.points >= TARGETS[next.section]) {
        events.push("section-clear"); next.points = 0; next.dry = 0; next.ready = false;
        if (next.section < 3) next.section++;
        else { next.phase = "trial"; next.trialGames = 0; next.trialScore = 0; }
      }
    } else if (prior.phase === "trial") {
      next.trialGames++;
      next.trialScore += paid ? (strong ? cfg.trial.premiumWinScore : cfg.trial.regularWinScore) : 0;
      if (next.trialGames >= cfg.trial.length) {
        next.trialAttempts++;
        if (next.trialScore >= cfg.trial.successScore || next.trialAttempts >= 3) {
          next.phase = "boss"; next.bossHp = cfg.boss.initialHp; next.bossTurns = 0;
          events.push(next.trialScore >= cfg.trial.successScore ? "trial-success" : "trial-learned");
        } else { next.trialGames = 0; next.trialScore = 0; events.push("trial-retry"); }
      }
    } else if (prior.phase === "boss" && prior.raceKind === "encore") {
      next.bossTurns++;
      next.continuationScore = Math.min(10, prior.continuationScore + (paid ? strong ? 2 : 1 : 0));
      if (next.bossTurns >= cfg.trial.length) {
        if (next.continuationScore >= CONTINUATION_TARGET || next.stock > 0) {
          if (next.continuationScore < CONTINUATION_TARGET) { next.stock--; events.push("stock-used"); }
          next.phase = "bonus"; next.bonusLeft = cfg.bonus.length;
          next.chainSets++; next.bestChain = Math.max(next.bestChain, next.chainSets);
          next.cheers = 0; events.push("continuation-win");
        } else finishJourney();
      }
    } else if (prior.phase === "boss") {
      next.bossTurns++;
      const damage = economy.bossDamage(receipt.payout, receipt.bet) + (paid ? next.resolve * 4 : 0);
      next.bossHp = Math.max(0, prior.bossHp - damage);
      if (next.bossHp === 0) {
        next.phase = "bonus"; next.bonusLeft = cfg.bonus.length; next.bonusTotal = 0; events.push("boss-win");
        next.chainSets = 1; next.bestChain = Math.max(1, next.bestChain); next.stock = 0; next.cheers = 0;
      } else if (next.bossTurns >= cfg.boss.turnLimit + next.resolve) {
        // 読めた走りは失わない。再挑戦は縮めた着差を保持し、支援だけ増やす。
        next.resolve = Math.min(3, next.resolve + 1); next.bossTurns = 0;
        events.push("boss-retry");
      }
    } else {
      next.bonusTotal = Math.min(1e12, prior.bonusTotal + receipt.payout);
      next.bestBonus = Math.max(next.bestBonus, next.bonusTotal);
      next.bonusLeft = Math.max(0, prior.bonusLeft - 1);
      // 確定した強役だけが支援・継続権になる。別ライン配当や保証では増やさない。
      if (receipt.flagLanded && ["bar", "seven_blue", "seven_red"].includes(receipt.flag) && next.stock < 2) {
        next.stock++; events.push("stock-earned");
      } else if (strong && next.cheers < 2) { next.cheers++; events.push("cheer-earned"); }
      if (next.bonusLeft === 0) {
        next.phase = "boss"; next.raceKind = "encore"; next.bossTurns = 0;
        next.continuationScore = next.cheers; events.push("continuation-enter");
      }
    }
    if (next.journey === prior.journey && prior.orderProgress < currentOrder.target && next.orderProgress >= currentOrder.target) events.push("order-ready");
    return { prior, next, events, progress: next.section === prior.section ? next.points - prior.points : 0, order: currentOrder };
  }
  return Object.freeze({ TARGETS, CONTINUATION_TARGET, ORDERS, normalize, order, settle });
}));
