/*
 * economy-rules.js - shared product economy and feature-transition settings.
 *
 * The browser game and the DOM-free product simulator both load this exact
 * object. Keep tuning values here so RTP work cannot silently fork the two
 * implementations. Each payout seam is tuned independently so feature
 * identity is preserved instead of applying one global pay cut.
 */
(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.MimiEconomyRules = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function deepFreeze(value) {
    if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
    Object.values(value).forEach(deepFreeze);
    return Object.freeze(value);
  }

  const CONFIG = deepFreeze({
    contractId: "mimi-economy-v2-rtp96",

    // Product target: about 96% gross RTP at BET 30 under the declared
    // deterministic simulation policy. Progressive seed subsidy and player
    // contribution liability are reported separately by the simulator.
    payoutScale: {
      mode: { normal: 1, hot: 0.8, bonus: 0.70 },
      rareRescue: { normal: 0.29, hot: 0.16, bonus: 0.07 },
      bonusMinimum: 0.55,
      orbRelease: 0.14,
      panyuRefund: 0.85
    },

    jackpot: {
      base: 10000,
      contributionRate: 0.1
    },

    orb: {
      max: 6,
      releaseThreshold: 6,
      releaseStageMin: 1,
      releaseStageMax: 5,
      releaseAwardBase: 300,
      releaseAwardPerStage: 80,
      rareRescueGain: 2,
      rareRescuePremiumPayThreshold: 70,
      winTreasureMinimum: 1,
      winTreasureDivisor: 2,
      failedMissLoss: 1,
      chanceCueGain: 1,
      chestGain: 1
    },

    panyu: {
      chanceBase: 0.05,
      chancePerOrb: 0.015,
      chancePerStreak: 0.05,
      chancePerTraining: 0.02,
      chanceCap: 0.3,
      nearMissChance: 0.02,
      nearMissChanceCap: 0.08,
      refundUpperBound: 0.3,
      upgradeUpperBound: 0.65,
      refundBetMultiplier: 1,
      upgradeOrbGain: 2,
      missStreakMax: 4,
      continueTreasureGain: 1,
      continueEnemyMinimum: 1
    },

    trial: {
      length: 3,
      successScore: 3,
      regularWinScore: 1,
      premiumWinScore: 2,
      nearMissScore: 1,
      reviveBaseChance: 0.1,
      reviveChancePerStreak: 0.03,
      mergeAlliesRequired: 4,
      trainingRequired: 4,
      mergeSceneIndex: 3,
      trainingSceneIndex: 1
    },

    bonus: {
      length: 10,
      minimumAwardBetMultiplier: 1,
      minimumOrbGain: 1
    },

    boss: {
      initialHp: 75,
      turnLimit: 5,
      damageBase: 12,
      damagePerBetMultiple: 6,
      damageCap: 55
    },

    adventure: {
      enemiesToBossInitial: 6,
      enemiesToBossTrigger: 0,
      alliesInitial: 1,
      alliesMax: 4,
      treasureMax: 4,
      premiumFreezeChance: 0.12,
      premiumChestBetMultiple: 8,
      bonusChestBetMultiple: 4,
      raidSceneOrbThreshold: 5,
      comboSceneThreshold: 2,
      sceneRotationSpins: 4,
      eventThresholds: {
        pot: 0.28,
        enemy: 0.58,
        chest: 0.72,
        merge: 0.88
      }
    },

    chanceCue: {
      startBaseChance: 0.14,
      startChancePerOrb: 0.025,
      middleBaseChance: 0.22,
      middleChancePerOrb: 0.03,
      hotBaseChance: 0.1,
      hotChancePerOrb: 0.02
    },

    stopControl: {
      teaseChance: 0.45,
      middleCueChance: 0.32
    }
  });

  function scaleCredits(amount, multiplier = 1) {
    return Math.max(0, Math.floor((Number(amount) || 0) * (Number(multiplier) || 0)));
  }

  function modePayoutScale(mode) {
    return CONFIG.payoutScale.mode[mode] ?? CONFIG.payoutScale.mode.normal;
  }

  function rareRescueScale(mode) {
    return CONFIG.payoutScale.rareRescue[mode] ?? CONFIG.payoutScale.rareRescue.normal;
  }

  function jackpotContribution(bet) {
    return Math.floor((Number(bet) || 0) * CONFIG.jackpot.contributionRate);
  }

  function orbReleaseAward(stage) {
    const value = Math.floor(Number(stage) || CONFIG.orb.releaseStageMin);
    const awardStage = Math.max(CONFIG.orb.releaseStageMin, Math.min(CONFIG.orb.releaseStageMax, value));
    const rawAward = CONFIG.orb.releaseAwardBase + awardStage * CONFIG.orb.releaseAwardPerStage;
    return scaleCredits(rawAward, CONFIG.payoutScale.orbRelease);
  }

  function panyuChance({ orb = 0, streak = 0, training = 0, nearMiss = 0 } = {}) {
    const nearBonus = Math.min(CONFIG.panyu.nearMissChanceCap, Math.max(0, nearMiss) * CONFIG.panyu.nearMissChance);
    return Math.min(
      CONFIG.panyu.chanceCap,
      CONFIG.panyu.chanceBase
        + orb * CONFIG.panyu.chancePerOrb
        + streak * CONFIG.panyu.chancePerStreak
        + training * CONFIG.panyu.chancePerTraining
        + nearBonus
    );
  }

  function trialReviveChance(streak) {
    return CONFIG.trial.reviveBaseChance + Math.max(0, streak) * CONFIG.trial.reviveChancePerStreak;
  }

  function bossDamage(payout, bet) {
    if (!(payout > 0)) return 0;
    return Math.min(
      CONFIG.boss.damageCap,
      CONFIG.boss.damageBase + Math.floor(payout / Math.max(1, bet)) * CONFIG.boss.damagePerBetMultiple
    );
  }

  return Object.freeze({
    CONFIG,
    scaleCredits,
    modePayoutScale,
    rareRescueScale,
    jackpotContribution,
    orbReleaseAward,
    panyuChance,
    trialReviveChance,
    bossDamage
  });
});
