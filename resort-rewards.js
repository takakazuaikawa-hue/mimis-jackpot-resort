/* Settled cabinet outcomes -> island COINS. Never reads a cabinet balance as
 * earnings, changes reel rules, or deletes the source after receiving it.
 * A source envelope is saved in the SAME write as its settled cabinet state.
 * Proposed rate v1: 1 per paid game + floor(actual payout / 10), free wins
 * included, free games never receive the paid-game point. Hold'em is excluded
 * because its existing collection economy already pays its island rewards. */
(function (root, factory) {
  "use strict";
  const api = factory(root);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.MimiResortRewards = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (root) {
  "use strict";
  const MACHINES = Object.freeze({
    dragon: Object.freeze({ key: "mimi-dragon-journey-v1", name: "ドラゴンレース紀行" }),
    stadium: Object.freeze({ key: "mimi.stadium.slot.v1", name: "スタジアム" }),
    arena: Object.freeze({ key: "mimi.arena.slot.v1", name: "裏ボス闘技場" }),
    guild: Object.freeze({ key: "mimi.guild.slot.v1", name: "ギャンブルギルド" })
  });
  const LIMIT = 1e12;
  const integer = value => Number.isSafeInteger(value) && value >= 0 && value <= LIMIT;
  const generation = value => typeof value === "string" && /^[a-zA-Z0-9_-]{8,96}$/.test(value);
  function envelope(value, machine) {
    if (!value || value.version !== 1 || value.machine !== machine || !MACHINES[machine]
      || !generation(value.generation) || ![value.seq, value.earned, value.paid, value.payout].every(integer)) return null;
    return { version: 1, machine, generation: value.generation, seq: value.seq, earned: value.earned, paid: value.paid, payout: value.payout };
  }
  function createEnvelope(machine, raw) {
    const existing = envelope(raw, machine);
    if (existing) return existing;
    if (raw != null) throw new Error("島への受領記録を読み込めません。元データを保護しています。");
    if (!MACHINES[machine]) throw new Error("Unknown cabinet");
    const id = root.crypto?.randomUUID?.();
    if (!id) throw new Error("保存IDを作成できません。ページを読み込み直してください。");
    return { version: 1, machine, generation: id, seq: 0, earned: 0, paid: 0, payout: 0 };
  }
  function record(current, outcome) {
    if (!envelope(current, current?.machine) || typeof outcome?.paid !== "boolean" || !integer(outcome.payout)) throw new Error("確定済みの結果が必要です");
    const amount = (outcome.paid ? 1 : 0) + Math.floor(outcome.payout / 10);
    if (current.seq === LIMIT || current.earned + amount > LIMIT || current.payout + outcome.payout > LIMIT) throw new Error("受領記録の上限です");
    current.seq++;
    current.earned += amount;
    current.paid += Number(outcome.paid);
    current.payout += outcome.payout;
    return amount;
  }
  function createWriter(machine, storage = root.localStorage) {
    const key = MACHINES[machine].key;
    let raw = storage.getItem(key);
    const value = raw ? JSON.parse(raw) : null;
    const journal = createEnvelope(machine, value?._islandRewards);
    return {
      record: outcome => record(journal, outcome),
      save(payload) {
        if (storage.getItem(key) !== raw) throw new Error("別の画面で保存が更新されました。読み込み直してください。");
        const next = JSON.stringify({ ...payload, _islandRewards: journal });
        storage.setItem(key, next);
        raw = next;
      }
    };
  }
  function normaliseLedger(raw) {
    const value = raw && typeof raw === "object" ? raw : {};
    const acknowledgements = [];
    for (const entry of Array.isArray(value.acknowledgements) ? value.acknowledgements : []) {
      if (!MACHINES[entry?.machine] || !generation(entry.generation) || ![entry.seq, entry.earned].every(integer)) continue;
      const previous = acknowledgements.find(item => item.machine === entry.machine && item.generation === entry.generation);
      if (previous) { if (entry.seq > previous.seq && entry.earned >= previous.earned) Object.assign(previous, {seq:entry.seq,earned:entry.earned}); }
      else acknowledgements.push({ machine: entry.machine, generation: entry.generation, seq: entry.seq, earned: entry.earned });
    }
    // Never evict acknowledged generations and make old results payable again.
    const recent = (Array.isArray(value.recent) ? value.recent : []).filter(item => MACHINES[item?.machine] && generation(item.generation)
      && [item.seq, item.games, item.amount, item.discarded].every(integer)).slice(0, 12).map(item => ({ machine:item.machine,generation:item.generation,seq:item.seq,games:item.games,amount:item.amount,discarded:item.discarded }));
    return { version: 1, lifetime: integer(value.lifetime) ? value.lifetime : 0, acknowledgements, recent };
  }
  function sources(storage = root.localStorage) {
    const result = [];
    for (const [machine, { key }] of Object.entries(MACHINES)) {
      try {
        const raw = storage.getItem(key), saved = raw ? JSON.parse(raw) : null;
        const item = envelope(saved?._islandRewards, machine);
        if (item) result.push(item);
      } catch (_) { /* Unreadable cabinet saves are left untouched, never reset. */ }
    }
    return result;
  }
  function pending(ledger, candidates) {
    return candidates.filter(item => {
      if (!envelope(item, item?.machine)) return false;
      const ack = ledger.acknowledgements.find(entry => entry.machine === item.machine && entry.generation === item.generation);
      return item.seq > (ack?.seq || 0) && item.earned >= (ack?.earned || 0);
    });
  }
  function receive(draft, candidates) {
    const economy = root.MimiCollectionEconomy || (typeof require === "function" ? require("./collection-economy.js") : null);
    const ledger = normaliseLedger(draft.stay.rewards);
    for (const item of pending(ledger, candidates)) {
      let ack = ledger.acknowledgements.find(entry => entry.machine === item.machine && entry.generation === item.generation);
      const earned = item.earned - (ack?.earned || 0), games = item.seq - (ack?.seq || 0);
      const award = economy.grantCoins(draft, { grantId: "island:" + item.machine + ":" + item.generation + ":" + item.seq, source: "cabinet-result", amount: earned,
        metadata: { machine: item.machine, generation: item.generation, event: item.seq, games } });
      if (!award.accepted && !award.duplicate) throw new Error("遊技結果を受け取れませんでした。");
      if (!ack) { ack = { machine: item.machine, generation: item.generation }; ledger.acknowledgements.push(ack); }
      Object.assign(ack, { seq: item.seq, earned: item.earned });
      if (award.accepted) {
        ledger.lifetime = Math.min(LIMIT, ledger.lifetime + award.amount);
        ledger.recent.unshift({ machine:item.machine,generation:item.generation,seq:item.seq,games,amount:award.amount,discarded:award.discarded });
        ledger.recent.length = Math.min(ledger.recent.length, 12);
      }
    }
    draft.stay.rewards = ledger;
  }
  return Object.freeze({ MACHINES, createEnvelope, envelope, record, createWriter, normaliseLedger, sources, pending, receive });
});
