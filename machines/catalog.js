/* 台選択の共通台帳。新台はここへ登録し、ゲーム固有のコードには入口を増設しない。 */
(function (root) {
  "use strict";
  const entries = [
    { id: "jackpot", title: "ミミのジャックポットリゾート", description: "仲間との勝負を巡る、物語のスロット。", tag: "物語と勝負", status: "available", image: "./assets/title-v5/mimi-jackpot-resort-original-keyart-v1.png", href: "./index-v5.html?machine=jackpot&view=slot", legacy: true },
    { id: "dragon-race", title: "ミミのドラゴンレース紀行", description: "島を巡り、竜の疾走と神眼レースへ。", tag: "レースと冒険", status: "available", image: "./dragon-source/images/title_bg2.webp", logo: "./dragon-source/images/title_logo2.webp", href: "./machines/dragon-race/player/index.html?machine=dragon-race&view=slot" },
    { id: "stadium", title: "ミミのマッドドクター・スタジアム", description: "白衣のミミと、改造球団の大勝負。", tag: "野球と改造", status: "available", image: "./assets/stadium/player_01_batting_drive_v1.png", href: "./index-stadium.html" },
    { id: "arena", title: "ミミのときめき裏ボス闘技場", description: "仲間と力を重ね、裏ボスへ挑む対決台。", tag: "仲間と対決", status: "available", image: "./assets/arena/mimi-victory-v1.png", href: "./index-arena.html" },
    { id: "guild", title: "ミミの嘘つきギャンブルギルド", description: "興行を育て、嘘と読み合いの大勝負へ。", tag: "興行と読み合い", status: "available", image: "./assets/guild/mimi-opening-v2.png", href: "./index-guild.html" },
  ];
  const ids = new Set();
  for (const entry of entries) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry.id) || ids.has(entry.id) || !entry.title || !entry.description || !entry.image || !entry.tag || !["available", "coming"].includes(entry.status)) throw Error("台の登録内容が不正です: " + entry.id);
    for (const value of [entry.image, entry.logo, entry.href].filter(Boolean)) {
      if (!value.startsWith("./") || value.includes("..", 2)) throw Error("台の素材・遷移先は同一サイト内にしてください: " + entry.id);
    }
    if (entry.status === "available" && !entry.href) throw Error("遊べる台には遷移先が必要です: " + entry.id);
    ids.add(entry.id); Object.freeze(entry);
  }
  const catalog = Object.freeze(entries);
  if (typeof module === "object" && module.exports) module.exports = catalog;
  else root.MimiMachineCatalog = catalog;
}(typeof window === "undefined" ? globalThis : window));
