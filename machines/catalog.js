/* 台選択の共通台帳。新台はここへ登録し、ゲーム固有のコードには入口を増設しない。 */
(function (root) {
  "use strict";
  const entries = [
    { id: "jackpot", title: "ミミのジャックポットリゾート", description: "4人の卓でBET COINを集める。見切りでSTACKを削り、ロイヤルポットへ。", tag: "BET COINと見切り", status: "available", image: "./assets/title-v5/mimi-jackpot-resort-original-keyart-v1.png", href: "./index-v5.html?machine=jackpot&view=slot", legacy: true },
    { id: "dragon-race", title: "ミミのドラゴンレース紀行", description: "神眼突破から無料10Gへ。応援点とストックを持ち込み、継続レースに挑む。", tag: "応援と継続ストック", status: "available", image: "./dragon-source/images/title_bg2.webp", logo: "./dragon-source/images/title_logo2.webp", href: "./machines/dragon-race/player/index.html?machine=dragon-race&view=slot" },
    { id: "stadium", title: "ミミのマッドドクター・スタジアム", description: "成立役で走者を進める。4連続不発の改造で、出塁かホームランを狙う。", tag: "出塁とホームラン改造", status: "available", image: "./assets/stadium/player_01_batting_drive_v1.png", href: "./index-stadium.html" },
    { id: "arena", title: "ミミのときめき裏ボス闘技場", description: "探索6点から3Gの試練へ。12人の仲間と黒星・隔壁の指示で裏ボスに挑む。", tag: "仲間の指示と試練", status: "available", image: "./assets/arena/mimi-victory-v1.png", href: "./index-arena.html" },
    { id: "guild", title: "ミミの嘘つきギャンブルギルド", description: "客寄せと拍手で興行を育てる。噂とお茶の助けで大物に勝ち、仲間との祝宴へ。", tag: "拍手と仲間の助け", status: "available", image: "./assets/guild/mimi-opening-v2.png", href: "./index-guild.html" },
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
