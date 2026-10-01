/*
 * content/cast.js — キャラクター・台選択・カットイン・物語の断片
 *
 * 設定の根拠は STORYLINE.md。ここは「誰が出るか」「どの台が並ぶか」
 * 「どのカットインがあるか」を並べるだけで、演出のタイミングは game.js。
 *
 * 画像はパスではなく content/assets.js の ID で書く。
 */
(function (root) {
  "use strict";

  /**
   * 出演者。hidden: true は普段は隠れていて、
   * JACKPOT など特定の場面でだけ顔を出す。
   */
  const cast = [
    { id: "mimi", name: "Mimi", role: "Host", portrait: "char.mimi" },
    { id: "futureMimi", name: "Future Mimi", role: "Secret Producer", portrait: "char.futureMimi", hidden: true },
    { id: "velvet", name: "Velvet", role: "Dealer", portrait: "char.velvet" }
  ];

  /** 台選択画面に並ぶ筐体。playable: false は「開発予定」の札が付く。 */
  const machines = [
    { id: "jackpot", title: "ミミのジャックポットリゾート", subtitle: "3リール・5ライン", cover: "stage.plaza", playable: true },
    { id: "poker", title: "ミミの変身ポーカーバトル", subtitle: "心理戦ポーカー / 開発予定", cover: "stage.harbor", playable: false },
    { id: "wonderland", title: "ミミのすごろくワンダーランド", subtitle: "盤上大冒険 / 開発予定", cover: "stage.gateway", playable: false }
  ];

  /** 全画面カットイン。id は game.js の showCutin(id) に渡す。 */
  const cutins = {
    chance: { text: "CHANCE", image: "cutin.chance" },
    bonus: { text: "BONUS", image: "cutin.bonus" },
    premium: { text: "SUPER WIN", image: "cutin.premium" },
    burst: { text: "ORB BURST", image: "cutin.burst" },
    revive: { text: "REVIVE", image: "cutin.revive" }
  };

  /** ORB ゲージの色。0 個目から MAX まで 6 段階。 */
  const orbColors = ["#aeb4bf", "#42a5ff", "#7ce66d", "#ffd14d", "#ff8a3d", "#ff4ea7"];

  /**
   * CHANCE の下段に出る短い物語の断片。
   * STORYLINE.md の方針どおり、説明しすぎず匂わせる濃度に留める。
   */
  const storyBeats = [
    { chapter: "OPEN", text: "未来ミミのリゾート台が点灯。次の停止に小さな幸運が混ざる。" },
    { chapter: "CHANCE", text: "カジノの照明が一段明るくなる。そろそろ当たりの足音。" },
    { chapter: "PANYU", text: "外れたはずのリールに《ぱにゅぱにゅ》の余韻。復活か、昇格か。" },
    { chapter: "BATTLE", text: "リゾートの名物モンスターが乱入。ライン成立でショーは続く。" },
    { chapter: "JACKPOT", text: "黄金のベルが鳴りかける。後の物語の断片が一瞬だけきらめく。" },
    { chapter: "RESORT", text: "説明しすぎない夢の残像。気づいた人だけが少し得をする。" }
  ];

  root.MimiContent = root.MimiContent || {};
  root.MimiContent.cast = cast;
  root.MimiContent.machines = machines;
  root.MimiContent.cutins = cutins;
  root.MimiContent.orbColors = orbColors;
  root.MimiContent.storyBeats = storyBeats;
}(typeof globalThis !== "undefined" ? globalThis : this));
