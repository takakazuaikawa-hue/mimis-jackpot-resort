/*
 * collection-economy.js - persistent COINS rewards, independent from CREDIT.
 *
 * All functions mutate the supplied profile draft. Persistence stays with
 * profile-store.js so one resolved reel game can be saved and rendered once.
 */
(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.MimiCollectionEconomy = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const CONFIG = Object.freeze({
    VERSION: 1,
    MAX_COINS: 999999999,
    DAILY_COINS: 300,
    PAID_SPINS_PER_MILESTONE: 50,
    MILESTONE_COINS: 250,
    MILESTONE_DAILY_LIMIT: 4,
    GRANT_ID_LIMIT: 256,
    PAID_SPIN_ID_LIMIT: 256,
    RECEIPT_LIMIT: 20,
    BOSS_REWARDS: Object.freeze({
      treasure: 1000,
      poker: 1500,
      race: 2000,
      wonderland: 2500,
      raid: 3000
    })
  });

  const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

  function int(value, fallback = 0, min = 0, max = Number.MAX_SAFE_INTEGER) {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.max(min, Math.min(max, Math.floor(number)));
  }

  function text(value, fallback = "") {
    return typeof value === "string" ? value : fallback;
  }

  function validDay(value) {
    if (typeof value !== "string" || !DAY_PATTERN.test(value)) return "";
    const parsed = Date.parse(`${value}T00:00:00.000Z`);
    return Number.isFinite(parsed) && new Date(parsed).toISOString().slice(0, 10) === value ? value : "";
  }

  function boundedStrings(value, limit) {
    if (!Array.isArray(value)) return [];
    const unique = [];
    const seen = new Set();
    value.forEach(entry => {
      if (typeof entry !== "string" || !entry || seen.has(entry)) return;
      seen.add(entry);
      unique.push(entry);
    });
    return unique.slice(-limit);
  }

  function normaliseReceipt(raw) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    const id = text(raw.id);
    const source = text(raw.source);
    if (!id || !source) return null;
    const requested = int(raw.requested, 0, 0, CONFIG.MAX_COINS);
    const amount = int(raw.amount, 0, 0, requested);
    return {
      id,
      source,
      requested,
      amount,
      discarded: int(raw.discarded, requested - amount, 0, requested),
      balance: int(raw.balance, 0, 0, CONFIG.MAX_COINS),
      at: text(raw.at),
      metadata: raw.metadata && typeof raw.metadata === "object" && !Array.isArray(raw.metadata)
        ? Object.assign({}, raw.metadata)
        : {}
    };
  }

  function createCollection() {
    return {
      version: CONFIG.VERSION,
      lifetimeEarned: 0,
      daily: { lastClaimDay: "", streak: 0 },
      paidSpin: { lifetime: 0, awarded: 0, pending: 0, countedIds: [] },
      milestone: { claimsDay: "", claimsToday: 0 },
      bossClaimed: [],
      grantIds: [],
      receipts: []
    };
  }

  function normaliseCollection(raw) {
    raw = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
    const collection = createCollection();
    collection.lifetimeEarned = int(raw.lifetimeEarned, 0);
    collection.daily.lastClaimDay = validDay(raw.daily?.lastClaimDay);
    collection.daily.streak = int(raw.daily?.streak, 0);

    collection.paidSpin.lifetime = int(raw.paidSpin?.lifetime, 0);
    const entitlement = Math.floor(collection.paidSpin.lifetime / CONFIG.PAID_SPINS_PER_MILESTONE);
    collection.paidSpin.awarded = int(raw.paidSpin?.awarded, 0, 0, entitlement);
    // Pending is stored for UI/readback, but entitlement minus awarded is the
    // canonical value so malformed saves cannot mint extra milestones.
    collection.paidSpin.pending = entitlement - collection.paidSpin.awarded;
    collection.paidSpin.countedIds = boundedStrings(raw.paidSpin?.countedIds, CONFIG.PAID_SPIN_ID_LIMIT);

    collection.milestone.claimsDay = validDay(raw.milestone?.claimsDay);
    collection.milestone.claimsToday = int(
      raw.milestone?.claimsToday,
      0,
      0,
      CONFIG.MILESTONE_DAILY_LIMIT
    );
    collection.bossClaimed = boundedStrings(raw.bossClaimed, CONFIG.GRANT_ID_LIMIT)
      .filter(id => Object.prototype.hasOwnProperty.call(CONFIG.BOSS_REWARDS, id))
      .slice(-Object.keys(CONFIG.BOSS_REWARDS).length);
    collection.grantIds = boundedStrings(raw.grantIds, CONFIG.GRANT_ID_LIMIT);
    collection.receipts = (Array.isArray(raw.receipts) ? raw.receipts : [])
      .map(normaliseReceipt)
      .filter(Boolean)
      .slice(0, CONFIG.RECEIPT_LIMIT);
    return collection;
  }

  function serialiseCollection(raw) {
    const collection = normaliseCollection(raw);
    return {
      version: CONFIG.VERSION,
      lifetimeEarned: collection.lifetimeEarned,
      daily: Object.assign({}, collection.daily),
      paidSpin: {
        lifetime: collection.paidSpin.lifetime,
        awarded: collection.paidSpin.awarded,
        pending: collection.paidSpin.pending,
        countedIds: collection.paidSpin.countedIds.slice()
      },
      milestone: Object.assign({}, collection.milestone),
      bossClaimed: collection.bossClaimed.slice(),
      grantIds: collection.grantIds.slice(),
      receipts: collection.receipts.map(receipt => Object.assign({}, receipt, {
        metadata: Object.assign({}, receipt.metadata)
      }))
    };
  }

  function ensureProfile(profile) {
    if (!profile || typeof profile !== "object" || Array.isArray(profile)) {
      throw new TypeError("profile must be an object");
    }
    profile.coins = int(profile.coins, 0, 0, CONFIG.MAX_COINS);
    const collection = profile.collection && typeof profile.collection === "object" && !Array.isArray(profile.collection)
      ? profile.collection
      : {};
    const normalised = normaliseCollection(collection);
    Object.keys(collection).forEach(key => { delete collection[key]; });
    Object.assign(collection, normalised);
    profile.collection = collection;
    return collection;
  }

  function timestamp(now) {
    const date = now instanceof Date ? new Date(now.getTime()) : new Date(now ?? Date.now());
    return Number.isFinite(date.getTime()) ? date.toISOString() : new Date().toISOString();
  }

  function jstDayKey(now = Date.now()) {
    const date = now instanceof Date ? new Date(now.getTime()) : new Date(now);
    const time = Number.isFinite(date.getTime()) ? date.getTime() : Date.now();
    return new Date(time + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
  }

  function pushBounded(list, value, limit) {
    list.push(value);
    if (list.length > limit) list.splice(0, list.length - limit);
  }

  function grantCoins(profile, options = {}) {
    const collection = ensureProfile(profile);
    const id = text(options.grantId || options.eventId).trim();
    const source = text(options.source).trim();
    const rawAmount = Number(options.amount ?? options.requestedAmount);
    const requested = Number.isFinite(rawAmount) && rawAmount >= 0
      ? int(rawAmount, 0, 0, CONFIG.MAX_COINS)
      : -1;
    const before = profile.coins;
    if (!id || !source || requested < 0) {
      return { accepted: false, duplicate: false, before, requested: 0, amount: 0, discarded: 0, after: before, receipt: null };
    }
    if (collection.grantIds.includes(id)) {
      return { accepted: false, duplicate: true, before, requested, amount: 0, discarded: 0, after: before, receipt: null };
    }

    const amount = Math.min(requested, CONFIG.MAX_COINS - before);
    const after = before + amount;
    const receipt = {
      id,
      source,
      requested,
      amount,
      discarded: requested - amount,
      balance: after,
      at: timestamp(options.now),
      metadata: options.metadata && typeof options.metadata === "object" && !Array.isArray(options.metadata)
        ? Object.assign({}, options.metadata)
        : {}
    };
    profile.coins = after;
    collection.lifetimeEarned = Math.min(Number.MAX_SAFE_INTEGER, collection.lifetimeEarned + amount);
    pushBounded(collection.grantIds, id, CONFIG.GRANT_ID_LIMIT);
    collection.receipts.unshift(receipt);
    if (collection.receipts.length > CONFIG.RECEIPT_LIMIT) collection.receipts.length = CONFIG.RECEIPT_LIMIT;
    return { accepted: true, duplicate: false, before, requested, amount, discarded: requested - amount, after, receipt };
  }

  function dailyStatus(profile, now = Date.now()) {
    const collection = ensureProfile(profile);
    const day = jstDayKey(now);
    const last = collection.daily.lastClaimDay;
    return {
      day,
      lastClaimDay: last,
      // A stored future day remains closed: moving the device clock backwards
      // must not reopen a day that may already have been claimed.
      canClaim: !last || day > last,
      amount: CONFIG.DAILY_COINS,
      streak: collection.daily.streak
    };
  }

  function dayBefore(day) {
    if (!validDay(day)) return "";
    const noonUtc = Date.parse(`${day}T03:00:00.000Z`);
    return Number.isFinite(noonUtc) ? jstDayKey(noonUtc - 24 * 60 * 60 * 1000) : "";
  }

  function claimDaily(profile, options = {}) {
    const status = dailyStatus(profile, options.now);
    if (!status.canClaim) {
      return Object.assign({}, status, { accepted: false, duplicate: true, amount: 0, receipt: null });
    }
    const collection = profile.collection;
    const result = grantCoins(profile, {
      grantId: `daily:${status.day}`,
      source: "daily",
      amount: CONFIG.DAILY_COINS,
      now: options.now,
      metadata: { day: status.day }
    });
    if (result.accepted || result.duplicate) {
      collection.daily.streak = collection.daily.lastClaimDay === dayBefore(status.day)
        ? collection.daily.streak + 1
        : 1;
      collection.daily.lastClaimDay = status.day;
    }
    return Object.assign({}, status, result, { streak: collection.daily.streak });
  }

  function resetMilestoneDay(collection, day) {
    const stored = collection.milestone.claimsDay;
    // As with daily claims, a backwards clock does not reset the daily cap.
    if (!stored || day > stored) {
      collection.milestone.claimsDay = day;
      collection.milestone.claimsToday = 0;
    }
  }

  function recordPaidSpin(profile, options = {}) {
    const collection = ensureProfile(profile);
    const spinId = text(options.spinId || options.transactionId).trim();
    const debit = int(options.debit, 0);
    const day = jstDayKey(options.now);
    if (debit <= 0) {
      return {
        accepted: false,
        duplicate: false,
        paid: false,
        lifetime: collection.paidSpin.lifetime,
        pending: collection.paidSpin.pending,
        claimsToday: collection.milestone.claimsToday,
        receipts: [],
        amount: 0
      };
    }
    if (!spinId) throw new TypeError("paid spin requires a stable spinId");
    if (collection.paidSpin.countedIds.includes(spinId)) {
      return {
        accepted: false,
        duplicate: true,
        paid: true,
        lifetime: collection.paidSpin.lifetime,
        pending: collection.paidSpin.pending,
        claimsToday: collection.milestone.claimsToday,
        receipts: [],
        amount: 0
      };
    }

    pushBounded(collection.paidSpin.countedIds, spinId, CONFIG.PAID_SPIN_ID_LIMIT);
    collection.paidSpin.lifetime += 1;
    if (collection.paidSpin.lifetime % CONFIG.PAID_SPINS_PER_MILESTONE === 0) {
      collection.paidSpin.pending += 1;
    }
    resetMilestoneDay(collection, day);

    const available = Math.min(
      collection.paidSpin.pending,
      CONFIG.MILESTONE_DAILY_LIMIT - collection.milestone.claimsToday
    );
    const receipts = [];
    let amount = 0;
    for (let offset = 0; offset < available; offset += 1) {
      const milestoneIndex = collection.paidSpin.awarded + 1;
      const grant = grantCoins(profile, {
        grantId: `paid-spin:${milestoneIndex}`,
        source: "paid-spin-milestone",
        amount: CONFIG.MILESTONE_COINS,
        now: options.now,
        metadata: { milestoneIndex, paidSpins: collection.paidSpin.lifetime }
      });
      if (!grant.accepted && !grant.duplicate) break;
      collection.paidSpin.awarded += 1;
      collection.paidSpin.pending = Math.max(0, collection.paidSpin.pending - 1);
      collection.milestone.claimsToday += 1;
      if (grant.receipt) {
        receipts.push(grant.receipt);
        amount += grant.amount;
      }
    }
    return {
      accepted: true,
      duplicate: false,
      paid: true,
      lifetime: collection.paidSpin.lifetime,
      progress: collection.paidSpin.lifetime % CONFIG.PAID_SPINS_PER_MILESTONE,
      pending: collection.paidSpin.pending,
      claimsToday: collection.milestone.claimsToday,
      receipts,
      amount
    };
  }

  function grantBossFirst(profile, options = {}) {
    const collection = ensureProfile(profile);
    const stageId = text(options.stageId).trim();
    const amount = CONFIG.BOSS_REWARDS[stageId];
    if (!amount) {
      return { accepted: false, duplicate: false, stageId, amount: 0, receipt: null };
    }
    if (collection.bossClaimed.includes(stageId)) {
      return { accepted: false, duplicate: true, stageId, amount: 0, receipt: null };
    }
    const result = grantCoins(profile, {
      grantId: `boss-first:${stageId}`,
      source: "boss-first",
      amount,
      now: options.now,
      metadata: { stageId }
    });
    if (result.accepted || result.duplicate) collection.bossClaimed.push(stageId);
    return Object.assign({ stageId }, result);
  }

  function grantWin(profile, options = {}) {
    const transaction = options.transaction && typeof options.transaction === "object"
      ? options.transaction
      : {};
    const creditedAward = int(options.creditedAward, 0);
    const eligible = int(transaction.debit, 0) > 0 && creditedAward > 0 && !options.bonusAssist;
    if (!eligible) {
      return { accepted: false, duplicate: false, eligible: false, amount: 0, receipt: null };
    }
    const amount = Math.max(1, Math.floor(creditedAward * 0.1));
    const result = grantCoins(profile, {
      grantId: text(options.grantId || `win:${transaction.id}`).trim(),
      source: "paid-win",
      amount,
      now: options.now,
      metadata: { transactionId: transaction.id, creditedAward }
    });
    return Object.assign({ eligible: true }, result);
  }

  function routeStatus(profile, now = Date.now()) {
    const collection = ensureProfile(profile);
    const daily = dailyStatus(profile, now);
    const day = jstDayKey(now);
    const claimsToday = !collection.milestone.claimsDay || day > collection.milestone.claimsDay
      ? 0
      : collection.milestone.claimsToday;
    const bossRemaining = Object.keys(CONFIG.BOSS_REWARDS).filter(id => !collection.bossClaimed.includes(id));
    return {
      daily,
      paidSpin: {
        lifetime: collection.paidSpin.lifetime,
        progress: collection.paidSpin.lifetime % CONFIG.PAID_SPINS_PER_MILESTONE,
        pending: collection.paidSpin.pending,
        claimsToday,
        dailyLimit: CONFIG.MILESTONE_DAILY_LIMIT,
        spinsPerMilestone: CONFIG.PAID_SPINS_PER_MILESTONE,
        amount: CONFIG.MILESTONE_COINS
      },
      boss: {
        claimed: collection.bossClaimed.slice(),
        remaining: bossRemaining,
        rewards: Object.assign({}, CONFIG.BOSS_REWARDS)
      },
      latestReceipt: collection.receipts[0] || null
    };
  }

  return Object.freeze({
    CONFIG,
    createCollection,
    normaliseCollection,
    serialiseCollection,
    jstDayKey,
    grantCoins,
    dailyStatus,
    claimDaily,
    recordPaidSpin,
    grantBossFirst,
    grantWin,
    routeStatus
  });
});
