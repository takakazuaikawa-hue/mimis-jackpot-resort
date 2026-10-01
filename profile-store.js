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
  const resortRewards = root?.MimiResortRewards || (typeof module === "object" && module.exports ? require("./resort-rewards.js") : null);
  const api = factory(collectionEconomy, resortRewards);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.MimiProfileStore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (collectionEconomy, resortRewards) {
  "use strict";

  if (!collectionEconomy) throw new Error("MimiCollectionEconomy is required before profile-store.js");

  const VERSION = 3;
  const KEY = "mimi-resort-profile-v3";
  const PREVIOUS_KEY = "mimi-resort-profile-v2";
  const DEFAULT_COINS = 12480;
  // Retain the old fallback for existing/legacy saves. Only genuinely empty
  // resort storage receives the proposed first-stay allowance.
  const NEW_GAME_COINS = 30;
  const MAX_COINS = collectionEconomy.CONFIG.MAX_COINS;
  const STAY_LOCATIONS = Object.freeze(["arrival", "plaza", "casino", "galleria", "shop", "promenade", "lookout", "hotel", "room", "pool", "harbor", "pier", "garden", "highland", "cove", "lounge", "town", "museum", "fishdiner", "homekitchen", "bakery"]);
  const STAY_TIMES = Object.freeze(["day", "sunset", "night"]);
  const STAY_ITEMS = Object.freeze(["postcard", "sea-glass", "lamp", "table-print"]);
  const DINING_PLACES = Object.freeze(["fishdiner", "homekitchen", "bakery"]);

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
      sound: raw.settings?.sound !== false,
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
      collection: collectionEconomy.normaliseCollection(raw.collection),
      stay: normaliseStay(raw.stay)
    };
  }

  // Additive V3 field: old cabinet equipment and reward receipts stay intact.
  // Keep first-slice souvenir fields while adding a bounded journey record.
  function normaliseStay(raw) {
    const value = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
    const souvenirs = [...new Set(Array.isArray(value.souvenirs) ? value.souvenirs.filter(id => STAY_ITEMS.includes(id)) : [])];
    if (value.ownedPostcard === true && !souvenirs.includes("postcard")) souvenirs.unshift("postcard");
    const ownedPostcard = souvenirs.includes("postcard");
    const placements = {};
    const used = new Set();
    for (const id of STAY_ITEMS) {
      const spot = id === "postcard" ? value.displaySpot : value.placements?.[id];
      if (souvenirs.includes(id) && ["left", "center", "right"].includes(spot) && !used.has(spot)) {
        placements[id] = spot;
        used.add(spot);
      }
    }
    const session = value.lastSession;
    return {
      version: 1,
      metLuana: value.metLuana === true,
      preference: ["sunlight", "sea"].includes(value.preference) ? value.preference : "",
      luanaStories: [...new Set(Array.isArray(value.luanaStories) ? value.luanaStories.filter(id => ["scenery", "table", "cruise", "reunion", "room", "stay"].includes(id)) : [])],
      relationships: normaliseRelationships(value.relationships),
      ownedPostcard,
      displaySpot: placements.postcard || "",
      souvenirs,
      placements,
      dining: normaliseDining(value.dining),
      cruise: normaliseCruise(value.cruise),
      episodes: { sharedTable: value.episodes?.sharedTable === true, islandLights: value.episodes?.islandLights === true },
      rewards: resortRewards.normaliseLedger(value.rewards),
      journey: normaliseJourney(value.journey, value.metLuana === true || ownedPostcard),
      lastSession: session && typeof session === "object" && !Array.isArray(session) ? {
        games: int(session.games, 0),
        coins: int(session.coins, 0, 0, MAX_COINS),
        creditDelta: int(session.creditDelta, 0, -Number.MAX_SAFE_INTEGER),
        endingCredit: int(session.endingCredit, 0)
      } : null
    };
  }

  function normaliseJourney(raw, returning = false) {
    const value = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
    const arrived = value.arrived === true || returning;
    const location = STAY_LOCATIONS.includes(value.location) ? value.location : arrived ? "plaza" : "arrival";
    const unique = (input, allowed) => Array.isArray(input) ? [...new Set(input.filter(id => allowed.includes(id)))] : [];
    const visited = unique(value.visited, STAY_LOCATIONS);
    if (!visited.includes(location)) visited.push(location);
    const meetingPlans = ["guide-lounge", "traveler-lookout"];
    const appointmentsKept = unique(value.appointmentsKept, meetingPlans);
    return {
      version: 1,
      arrived,
      location,
      time: STAY_TIMES.includes(value.time) ? value.time : "day",
      visited,
      discoveries: unique(value.discoveries, ["sea-light", "store-hours", "pool-view", "harbor-view", "pier-view", "garden-view", "highland-view", "cove-view", "lounge-view", "hotel-view", "town-view", "museum-boat", "museum-glass", "museum-table", "fishdiner-menu", "homekitchen-menu", "bakery-menu"]),
      encounters: unique(value.encounters, ["guide", "traveler", "vendor", "curator", "fishcook", "homecook", "baker", "elena", "marea", "noel", "ilias"]),
      // Older encounter flags do not tell us where someone was met.
      meetings: unique(value.meetings, ["guide:promenade", "guide:harbor", "guide:lounge", "traveler:highland", "traveler:lookout"]),
      appointment: meetingPlans.includes(value.appointment) && !appointmentsKept.includes(value.appointment) ? value.appointment : "",
      appointmentsKept,
      reflections: unique(value.reflections, ["first-walk", "familiar-island", "my-stay", "chapter-one"])
    };
  }

  function normaliseRelationships(raw) {
    const result = {};
    const schedules = {elena:{day:"pool",sunset:"lounge",night:"pool"},marea:{day:"garden",sunset:"highland",night:"cove"},noel:{day:"galleria",sunset:"galleria",night:"hotel"},ilias:{day:"harbor",sunset:"pier",night:"harbor"}};
    for (const id of ["luana", "guide", "traveler", "vendor", "curator", "fishcook", "homecook", "baker", ...Object.keys(schedules)]) {
      const entry = raw?.[id];
      if (!entry || typeof entry !== "object") continue;
      const required = schedules[id] ? 3 : 2;
      const moments = [...new Set(Array.isArray(entry.moments) ? entry.moments.filter(key => typeof key === "string" && STAY_LOCATIONS.includes(key.split(":")[0]) && STAY_TIMES.includes(key.split(":")[1]) && key.split(":").length === 2 && (!schedules[id] || schedules[id][key.split(":")[1]] === key.split(":")[0])) : [])].slice(0, required);
      const stage = ["afterglow", "complete"].includes(entry.stage) && moments.length === required ? entry.stage : "talk";
      result[id] = {moments, stage};
    }
    return result;
  }

  function normaliseDining(raw) {
    const value = raw && typeof raw === "object" ? raw : {};
    const sequence = int(value.sequence, 0, 0, Number.MAX_SAFE_INTEGER - 1);
    const entry = value.active;
    const active = sequence > 0 && entry && DINING_PLACES.includes(entry.id) && ["served", "tasted", "finished"].includes(entry.stage)
      ? { id: entry.id, stage: entry.stage, time: STAY_TIMES.includes(entry.time) ? entry.time : "day" } : null;
    const memories = {};
    for (const id of DINING_PLACES) {
      const memory = value.memories?.[id], count = int(memory?.count, 0, 0, 999);
      if (count) memories[id] = { count, time: STAY_TIMES.includes(memory.time) ? memory.time : "day" };
    }
    return { sequence, active, memories };
  }

  function normaliseCruise(raw) {
    const value = raw && typeof raw === "object" ? raw : {};
    const sequence = int(value.sequence, 0, 0, Number.MAX_SAFE_INTEGER - 1);
    const entry = value.active;
    const active = sequence > 0 && entry && ["sunset", "night"].includes(entry.slot) && ["reserved", "aboard", "coast"].includes(entry.stage)
      ? { slot: entry.slot, stage: entry.stage } : null;
    return { sequence, active, trips: int(value.trips, 0, 0, 999), lastSlot: ["sunset", "night"].includes(value.lastSlot) ? value.lastSlot : "" };
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
    const historyKeys = [KEY, PREVIOUS_KEY, "mimi-resort-coins", "mimi-resort-owned", "mimi-resort-equipped-slots", "mimi-resort-equipped"];
    const firstVisit = historyKeys.every(key => read(target, key) === null);
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
    return normalise(firstVisit ? { ...source, coins: NEW_GAME_COINS } : source || {}, options);
  }

  function serialise(profile) {
    return {
      version: VERSION,
      coins: int(profile.coins, DEFAULT_COINS, 0, MAX_COINS),
      owned: Array.from(profile.owned || []),
      equipped: Object.assign({}, profile.equipped),
      settings: Object.assign({}, profile.settings),
      stats: Object.assign({}, profile.stats),
      collection: collectionEconomy.serialiseCollection(profile.collection),
      stay: normaliseStay(profile.stay)
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

  return { VERSION, KEY, PREVIOUS_KEY, DEFAULT_COINS, NEW_GAME_COINS, MAX_COINS, STAY_LOCATIONS, STAY_TIMES, STAY_ITEMS, load, save, serialise, normalise, normaliseStay, normaliseJourney };
});
