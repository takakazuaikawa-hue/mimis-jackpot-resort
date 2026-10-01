/*
 * profile-store.js - versioned, defensive persistence for the resort shell.
 *
 * The reel credit is intentionally session-local.  Only collection coins,
 * unlocks, presentation settings and lifetime counters are persisted here.
 */
(function (root, factory) {
  "use strict";
  const collectionEconomy = root?.MimiCollectionEconomy
    || (typeof module === "object" && module.exports ? require("./collection-economy.js") : null);
  const api = factory(collectionEconomy);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.MimiProfileStore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (collectionEconomy) {
  "use strict";

  if (!collectionEconomy) throw new Error("MimiCollectionEconomy is required before profile-store.js");

  const VERSION = 3;
  const KEY = (typeof location !== "undefined" && new URLSearchParams(location.search).get("machine") === "dragon-race" ? "mimi-dragon-profile-v3" : "mimi-resort-profile-v3");
  const PREVIOUS_KEY = (typeof location !== "undefined" && new URLSearchParams(location.search).get("machine") === "dragon-race" ? "mimi-dragon-profile-v2" : "mimi-resort-profile-v2");
  const DEFAULT_COINS = 12480;
  const MAX_COINS = collectionEconomy.CONFIG.MAX_COINS;

  function storageOrNull(storage) {
    if (storage) return storage;
    try {
      return typeof localStorage !== "undefined" ? localStorage : null;
    } catch (_) {
      return null;
    }
  }

  function read(storage, key) {
    try {
      return storage ? storage.getItem(key) : null;
    } catch (_) {
      return null;
    }
  }

  function parse(raw, fallback) {
    if (!raw) return fallback;
    try {
      return JSON.parse(raw);
    } catch (_) {
      return fallback;
    }
  }

  function int(value, fallback, min = 0, max = Number.MAX_SAFE_INTEGER) {
    if (value === null || value === undefined || value === "") return fallback;
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.max(min, Math.min(max, Math.floor(number)));
  }

  function normalise(raw, options) {
    raw = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
    options = options && typeof options === "object" ? options : {};
    const items = Array.isArray(options.items) ? options.items : [];
    const defaults = Array.isArray(options.defaultOwned) ? options.defaultOwned : [];
    const byId = new Map(items.map(item => [item.id, item]));
    const owned = new Set(Array.isArray(raw.owned) ? raw.owned.filter(id => byId.has(id)) : []);
    defaults.forEach(id => {
      if (byId.has(id)) owned.add(id);
    });

    const fallbackCostume = defaults.find(id => byId.get(id)?.tab === "costume") || "";
    const equipped = Object.assign({ costume: fallbackCostume, effect: "", background: "" }, raw.equipped || {});
    ["costume", "effect", "background"].forEach(tab => {
      const item = byId.get(equipped[tab]);
      if (!item || item.tab !== tab || !owned.has(item.id)) equipped[tab] = tab === "costume" ? fallbackCostume : "";
    });

    const settings = {
      sound: new URLSearchParams(location.search).get("machine") === "dragon-race" ? raw.settings?.sound === true : raw.settings?.sound !== false,
      motion: raw.settings?.motion === "reduced" ? "reduced" : "full"
    };
    const stats = {
      spins: int(raw.stats?.spins, 0),
      wins: int(raw.stats?.wins, 0),
      bestWin: int(raw.stats?.bestWin, 0),
      jackpots: int(raw.stats?.jackpots, 0),
      resortPasses: int(raw.stats?.resortPasses, 0),
      chapter1Clears: int(raw.stats?.chapter1Clears, 0),
      chapter1RoyalOrdersCompleted: int(raw.stats?.chapter1RoyalOrdersCompleted, 0),
      chapter1RoyalOrderCrests: int(raw.stats?.chapter1RoyalOrderCrests, 0, 0, 31)
    };

    return {
      version: VERSION,
      coins: int(raw.coins, DEFAULT_COINS, 0, MAX_COINS),
      owned,
      equipped,
      settings,
      stats,
      collection: collectionEconomy.normaliseCollection(raw.collection)
    };
  }

  function legacy(storage, options) {
    const equipped = parse(read(storage, "mimi-resort-equipped-slots"), {});
    const legacyEquipped = read(storage, "mimi-resort-equipped") || "";
    const item = options.items.find(entry => entry.id === legacyEquipped);
    if (item && !equipped[item.tab]) equipped[item.tab] = item.id;
    return {
      coins: read(storage, "mimi-resort-coins"),
      owned: parse(read(storage, "mimi-resort-owned"), options.defaultOwned),
      equipped,
      settings: {},
      stats: {}
    };
  }

  function load(options = {}, storage) {
    const target = storageOrNull(storage);
    const current = parse(read(target, KEY), null);
    const previous = parse(read(target, PREVIOUS_KEY), null);
    const source = current && current.version === VERSION
      ? current
      : previous && previous.version === 2
        ? previous
        : legacy(target, {
          items: Array.isArray(options.items) ? options.items : [],
          defaultOwned: Array.isArray(options.defaultOwned) ? options.defaultOwned : []
        });
    return normalise(source || {}, options);
  }

  function serialise(profile) {
    return {
      version: VERSION,
      coins: int(profile.coins, DEFAULT_COINS, 0, MAX_COINS),
      owned: Array.from(profile.owned || []),
      equipped: Object.assign({}, profile.equipped),
      settings: Object.assign({}, profile.settings),
      stats: Object.assign({}, profile.stats),
      collection: collectionEconomy.serialiseCollection(profile.collection)
    };
  }

  function save(profile, storage) {
    const target = storageOrNull(storage);
    if (!target) return false;
    try {
      target.setItem(KEY, JSON.stringify(serialise(profile)));
      return true;
    } catch (_) {
      return false;
    }
  }

  return { VERSION, KEY, PREVIOUS_KEY, DEFAULT_COINS, MAX_COINS, load, save, serialise, normalise };
});
