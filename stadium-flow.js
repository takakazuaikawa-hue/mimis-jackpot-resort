/* 原作の人物・球団を使う新台専用の進行。既存台の経済・セーブとは独立。 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.StadiumFlow = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const ASSETS = "./assets/stadium/";
  const PLAYERS = [
    [8, "モチカネ・鈴木", "捕手・主将", "finish_v3"],
    [9, "タクロー・宮崎", "投手・左腕", "finish_v3"],
    [6, "ミキ・山本", "遊撃手", "drive_v3"],
    [5, "リョータ・荒木", "右翼手", "finish_v3"],
    [3, "カズキ・大沢", "三塁手", "finish_v3"],
    [2, "ユー・五十嵐", "二塁手", "drive_v3"],
    [1, "シュン・花城", "中堅手", "drive_v1"],
    [7, "ナオユキ・春野", "左翼手", "drive_v3"],
    [4, "ゴウ・高安", "一塁手", "drive_v2"]
  ].map(([number, name, position, art]) => Object.freeze({ number, name, position,
    image: `${ASSETS}player_0${number}.png`, batting: `${ASSETS}player_0${number}_batting_${art}.png` }));
  const TEAMS = [
    ["シロガネ城下ブレイバーズ", "堅守・継投", "shirogane", 3],
    ["カナヤマ・ツインドライブズ", "二刀流", "kanayama", 4],
    ["ヤマノベ・ロングランナーズ", "先発完投", "yamanobe", 5],
    ["インペリアル・クラウンズ", "完璧な二刀流", "imperial", 6]
  ].map(([name, style, field, target]) => Object.freeze({ name, style, target,
    image: `${ASSETS}bg_stadium_${field}.png` }));
  function create() {
    return { version: 1, credit: 1200, team: 0, batter: 0, runs: 0, outs: 0,
      bases: [false, false, false], dry: 0, augment: "", bonus: 0, games: 0,
      totalRuns: 0, championships: 0, bonusWin: 0, bonusRecorded: 0, replay: false, phase: "normal", pending: "intro", lastWin: 0 };
  }
  function valid(s) {
    return s?.version === 1 && [s.credit, s.team, s.batter, s.runs, s.outs, s.dry, s.bonus,
      s.games, s.totalRuns, s.championships, s.lastWin].every(n => Number.isSafeInteger(n) && n >= 0)
      && [s.bonusWin ?? 0, s.bonusRecorded ?? 0].every(n => Number.isSafeInteger(n) && n >= 0)
      && (s.bonusRecorded ?? 0) <= 10
      && s.team < 4 && s.batter < 9 && s.outs < 3 && s.dry <= 4 && s.bonus <= 10
      && Array.isArray(s.bases) && s.bases.length === 3 && s.bases.every(n => typeof n === "boolean")
      && typeof s.replay === "boolean" && ["normal", "bonus", "complete"].includes(s.phase)
      && ["", "intro", "surgery", "reward", "next", "champion"].includes(s.pending)
      && ["", "power", "walk"].includes(s.augment);
  }
  function advanceBases(s, distance) {
    let runs = 0;
    const next = [false, false, false];
    s.bases.forEach((occupied, index) => {
      if (!occupied) return;
      if (index + distance >= 3) runs++; else next[index + distance] = true;
    });
    if (distance === 4) runs++; else next[distance - 1] = true;
    s.bases = next;
    s.runs += runs;
    s.totalRuns += runs;
    return runs;
  }
  function settle(state, outcome) {
    const s = structuredClone(state);
    s.games++;
    s.lastWin = outcome.payout;
    s.credit += outcome.payout;
    s.replay = outcome.replay;
    const actor = PLAYERS[s.batter];
    if (s.phase === "bonus") {
      // Display accounting only; credit and payouts remain owned by the settlement above.
      s.bonusWin = (s.bonusWin ?? 0) + outcome.payout;
      s.bonusRecorded = (s.bonusRecorded ?? 0) + 1;
      s.bonus--;
      if (s.bonus === 0) s.pending = s.team === 3 ? "champion" : "next";
      return { state: s, headline: outcome.payout ? `WIN +${outcome.payout}` : "配当なし",
        line: s.bonus ? `勝利のウイニングラン、残り${s.bonus}G！` : "ウイニングラン完走！", actor, hit: outcome.payout > 0 };
    }
    if (outcome.replay) return { state: s, headline: "REPLAY", line: "ファウル！ 次の一球は無料だよ。", actor, hit: false };
    let distance = outcome.payout > 0 ? ({ cherry: 1, bell: 1, grape: 2, watermelon: 3, bar: 4, seven_blue: 4, seven_red: 4 }[outcome.symbol] || 1) : 0;
    let modified = false;
    if (s.augment === "walk") { distance = Math.max(1, distance); modified = true; s.augment = ""; }
    else if (distance && s.augment === "power") { distance = 4; modified = true; s.augment = ""; }
    let headline, line;
    if (distance) {
      const runs = advanceBases(s, distance);
      headline = ["", "ヒット！", "二塁打！", "三塁打！", "ホームラン！"][distance];
      if (modified && outcome.payout === 0) headline = "改造アシスト・出塁！";
      line = `${actor.name}、${runs ? `${runs}点を追加！` : "チャンスをつないだ！"}`;
      if (modified) line += " 改造発動！";
      s.dry = 0;
      if (s.runs >= TEAMS[s.team].target) s.pending = "reward";
    } else {
      s.outs++;
      s.dry = Math.min(4, s.dry + 1);
      headline = "アウト";
      line = ["", "球筋、見えてきた。", "次の打席に手を入れよう。", "あと少しで、改造の準備が整うよ。", "ひらめいた！ 私の出番だね。"][s.dry];
      if (s.outs === 3) { s.outs = 0; s.bases = [false, false, false]; line = "攻撃を仕切り直そう。得点はそのまま！"; }
      if (s.dry === 4 && !s.augment) s.pending = "surgery";
    }
    s.batter = (s.batter + 1) % PLAYERS.length;
    return { state: s, headline, line, actor, hit: distance > 0 };
  }
  return Object.freeze({ ASSETS, PLAYERS: Object.freeze(PLAYERS), TEAMS: Object.freeze(TEAMS), create, valid, settle });
});
