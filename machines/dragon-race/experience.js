/* 演出の格と、原作衣装の独立台向け解放条件。回胴の乱数には触れない。 */
(function (root, factory) {
  const api = factory(typeof module === "object" && module.exports ? require("./content.js") : root.MimiDragonRaceContent);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.MimiDragonExperience = api;
}(typeof globalThis !== "undefined" ? globalThis : this, function (content) {
  "use strict";
  const OUTFITS = Object.freeze([
    ["buniqro", "ブニクロ普段着", "spins", 0],
    ["dara", "きれいめコーデ", "spins", 10],
    ["maumau", "プレッピーカジュアル", "album", 4],
    ["gymlow", "スポーティMIX", "spins", 30],
    ["gymmiddle", "アクティブフィット", "album", 8],
    ["leonmall", "モールでお買い物", "journey", 1],
    ["darugi", "ゆるだぼルーム着", "spins", 80],
    ["mannel", "USANNEL", "album", 12],
    ["merine", "フランスブランド", "journey", 2],
    ["draspo", "ドラゴスポーティ", "spins", 180],
    ["doraqi", "ドラキー・ホーテ", "album", 20],
    ["drajela", "メゾン・ドラジェラ", "journey", 4],
  ].map(([id, name, field, target]) => Object.freeze({ id, name, field, target })));
  function amount(progress, field) { return field === "album" ? progress.album.length : progress[field]; }
  function unlocked(progress, outfit) { return amount(progress, outfit.field) >= outfit.target; }
  function condition(progress, outfit) {
    if (!outfit.target) return "最初の一着";
    const labels = { spins: "累計回転", album: "走りの記録", journey: "紀行完走" };
    return `${labels[outfit.field]} ${Math.min(amount(progress, outfit.field), outfit.target)}/${outfit.target}`;
  }
  function newlyUnlocked(prior, next) { return OUTFITS.filter(o => !unlocked(prior, o) && unlocked(next, o)); }
  // 異なる会場で同じ竜の走りを観察すると見切りが育つ。旧記録もそのまま使う。
  function familiarity(progress, dragonId) {
    const venues = new Set();
    for (const entry of progress.album || []) {
      const [flag, venue] = entry.split(":");
      if (content.MACHINE.flags[flag]?.motif.dragonId === dragonId && /^[0-3]$/.test(venue)) venues.add(venue);
    }
    return venues.size;
  }
  const READABLE_FLAGS = Object.freeze(["grape", "watermelon", "bar", "seven_blue", "seven_red"]);
  // 原作 konron_content.js の名所。観光の表示だけを選び、抽選・観察点は変更しない。
  const SIGHTS = Object.freeze([
    { id: "market", name: "霧待ち市場", lines: ["いい匂い！", "マンゴー、山盛り！", "もうひと口だけ…", "おいしかった！"] },
    { id: "wind", name: "ヴェント・帆の集落", lines: ["風が気持ちいい！", "帆がふくらんだ", "向こうにも集落！", "いい眺めだったね"] },
    { id: "clock", name: "グランドクロックの港", lines: ["船が帰ってきた", "大時計、見上げちゃう", "鐘が鳴りそう…", "港に響いたね"] },
    { id: "avenue", name: "大翼通り", lines: ["今日はどこへ？", "応援旗がいっぱい！", "スタジアムはあっち", "また寄り道しよう"] },
  ].map(s => Object.freeze({ ...s, lines: Object.freeze(s.lines) })));
  function sightseeing({ phase, section, spins, count = 0, kind, mode, hasRace }) {
    // 強役も最初は街。第1停止で勝負へ移るので、SPIN時点で決着を見せない。
    const town = phase === "normal" && (!hasRace || kind === "observation" || mode === "race" && count === 0);
    const sight = SIGHTS[((section || 0) + Math.floor(Math.max(0, spins || 0) / 3)) % SIGHTS.length];
    return { town, sight, omen: town && hasRace && kind === "race" && mode === "race",
      line: sight.lines[Math.max(0, Math.min(3, count))] };
  }
  function sceneOutfit(phase, town, preference = "buniqro") {
    // 戴冠衣は大レース専用。普段着の選択・解放条件はそのまま保持する。
    return phase === "boss" || phase === "bonus" ? "dragonrobe" : town ? preference : "jungle";
  }
  function canStudy(dragonId) { return READABLE_FLAGS.some(flag => content.MACHINE.flags[flag].motif.dragonId === dragonId); }
  function canRead(progress, flag) {
    const dragon = content.MACHINE.flags[flag]?.motif.dragonId;
    return READABLE_FLAGS.includes(flag) && familiarity(progress, dragon) >= 2;
  }
  function plan(flag, phase) {
    let tier = ["bar", "seven_blue"].includes(flag) ? 3 : flag === "seven_red" ? 4 : ["grape", "watermelon"].includes(flag) ? 2 : 1;
    if (phase === "boss") tier = Math.max(3, tier);
    const title = flag === "seven_red" ? "夜明けの翼" : flag === "seven_blue" ? "蒼き追い風" : flag === "bar" ? "大歓声の直線" : flag === "watermelon" ? "内へ切り込め" : flag === "grape" ? "霧の向こうの好走" : "";
    return Object.freeze({ tier, title, kind: ["normal", "bonus"].includes(phase) && tier === 1 ? "observation" : "race", suspense: tier === 4 ? 650 : tier === 3 ? 440 : tier === 2 ? 220 : 90,
      label: tier === 4 ? "赤7を狙え" : tier === 3 ? (flag === "bar" ? "BARに注目" : flag === "seven_blue" ? "青7に注目" : "圧力を削れ") : tier === 2 ? "好走の気配" : "走りを観察" });
  }
  function summary(progress) {
    return progress.phase === "boss" && progress.raceKind === "encore" ? ["継続レース", "4つのゲートを灯せば、もう一度無料10回", `最初から${progress.cheers}つ点灯 · 継続券${progress.stock}枚`]
      : progress.phase === "boss" ? ["神眼レース", "隕石を砕けばBONUS", "図柄が揃うと竜が攻撃。傷は再挑戦にも残る"]
      : progress.phase === "bonus" ? ["BONUS", "コインを使わず回せる！", `獲得合計${progress.bonusTotal}枚 · あと${progress.bonusLeft}回`]
      : progress.phase === "trial" ? ["CHANCE", "3回の勝負で、3つのゲートを灯せ", "当たりで1つ、強い役なら2つ点灯"]
      : ["島の名所を巡ろう", "強い気配で、勝負レースへ", "右の大きなボタンだけで SPIN → 3STOP"];
  }
  return Object.freeze({ OUTFITS, SIGHTS, sightseeing, sceneOutfit, unlocked, condition, newlyUnlocked, familiarity, canStudy, canRead, plan, summary });
}));
