/*
 * Visual Reset V5 runtime adapter.
 *
 * content/story.js is the only narrative source of truth.  This adapter builds
 * the legacy stage shape consumed by game.js and installs exact V5 candidate
 * asset IDs for the isolated production shell.  The current index does not
 * load this file until the V5 shell passes visual review.
 */
(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) {
    root.MimiGameContentV5 = api;
    if (root.MimiStory && root.MimiContent) api.install(root.MimiStory, root.MimiContent);
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const STATUS = "PRODUCTION UNAPPROVED";
  const SCENE_KINDS = Object.freeze(["explore", "omen", "chain", "boss", "bonus"]);
  const TREASURE_RUNTIME_SCENES = Object.freeze({
    explore: "./assets/casino-loop-v5/zone-01-arrival.png",
    omen: "./assets/casino-loop-v5/zone-02-main-floor.png",
    chain: "./assets/casino-loop-v5/zone-03-vip-salon.png",
    boss: "./assets/casino-loop-v5/zone-03-vip-salon.png",
    bonus: "./assets/casino-loop-v5/zone-04-jewel-exchange.png",
  });
  const TREASURE_ACTORS = Object.freeze({
    explore: "char.mimi.dialogue.neutral.v5",
    omen: "char.mimi.dialogue.concerned.v5",
    chain: "char.mimi.story.treasureKeyReceive.v5",
    boss: "char.mimi.dialogue.determined.v5",
    bonus: "char.mimi.dialogue.relief.v5"
  });
  const POKER_ACTORS = Object.freeze({
    explore: "char.mimi.dialogue.neutral.v5",
    omen: "char.mimi.dialogue.concerned.v5",
    chain: "char.mimi.story.pokerCompareCards.v5",
    boss: "char.mimi.dialogue.determined.v5",
    bonus: "char.mimi.dialogue.relief.v5"
  });
  const RACE_ACTORS = Object.freeze({
    explore: "char.mimi.dialogue.neutral.v5",
    omen: "char.mimi.dialogue.concerned.v5",
    chain: "char.mimi.story.raceRunTogether.v5",
    boss: "char.mimi.dialogue.determined.v5",
    bonus: "char.mimi.dialogue.relief.v5"
  });
  const TREASURE_BOSS = Object.freeze({
    idle: "boss.velvetTreasure.idle.v5",
    attack: "boss.velvetTreasure.attack.v5",
    hit: "boss.velvetTreasure.hit.v5",
    defeat: "boss.velvetTreasure.defeat.v5",
    reward: "boss.velvetTreasure.reward.v5"
  });
  const POKER_BOSS = Object.freeze({
    idle: "boss.cardShark.idle.v5",
    attack: "boss.cardShark.attack.v5",
    hit: "boss.cardShark.hit.v5",
    defeat: "boss.cardShark.defeat.v5",
    reward: "boss.cardShark.reward.v5"
  });
  const RACE_BOSS = Object.freeze({
    idle: "boss.tearsStorm.idle.v5",
    attack: "boss.tearsStorm.attack.v5",
    hit: "boss.tearsStorm.hit.v5",
    defeat: "boss.tearsStorm.defeat.v5",
    reward: "boss.tearsStorm.reward.v5"
  });
  const CHAPTER_META = Object.freeze({
    treasure: Object.freeze({
      stageName: "はじまりの広場", series: "JACKPOT RESORT / PROMISE", color: "#ffd36a",
      gaugeLabel: "GATE KEY", gaugeMax: 3, nodes: Object.freeze(["広場", "宝箱", "KEY", "黒金門", "BOSS"]),
      miss: "光は消えていない。次のSPINで、未完了の約束をもう一度追う。"
    }),
    poker: Object.freeze({
      stageName: "月夜のカードシアター", series: "POKER / TRUTH", color: "#c78aff",
      gaugeLabel: "BLUFF READ", gaugeMax: 3, nodes: Object.freeze(["DEAL", "READ", "BET", "SHOW", "BOSS"]),
      miss: "読みは外れても、成立結果は変わらない。次の手で演出と事実を分ける。"
    }),
    race: Object.freeze({
      stageName: "虹風のスカイコース", series: "DRAGON RACE / COURAGE", color: "#63e3ff",
      gaugeLabel: "COURSE", gaugeMax: 3, nodes: Object.freeze(["START", "並走", "嵐", "GOAL", "BOSS"]),
      miss: "速度を落としても脱落ではない。怖さを残したまま、次の風へ並走する。"
    }),
    wonderland: Object.freeze({
      stageName: "分岐盤ワンダーランド", series: "BOARD / CHOICE", color: "#72f0a4",
      gaugeLabel: "BRANCH", gaugeMax: 3, nodes: Object.freeze(["DICE", "分岐", "EVENT", "王冠", "BOSS"]),
      miss: "選ばなかった道は消えない。次回へ残し、いま選んだ一手を進める。"
    }),
    raid: Object.freeze({
      stageName: "五色の未来ゲート", series: "FINAL RAID / FIRST LIGHT", color: "#ff75bd",
      gaugeLabel: "RAINBOW ORB", gaugeMax: 6, nodes: Object.freeze(["ORB", "共鳴", "復活", "GATE", "BOSS"]),
      miss: "裁定はまだ終わらない。今日の選択を、次のSPINで持続できる形にする。"
    })
  });

  const ASSET_PATHS = (() => {
    const paths = {
      "route.entrance.v5": "./assets/casino-loop-v5/zone-01-arrival.png",
      "route.lobby.v5": "./assets/casino-loop-v5/zone-02-main-floor.png",
      "route.machines.v5": "./assets/title-v5/mimi-jackpot-resort-original-keyart-v1.png",
      "route.result.v5": "./assets/casino-loop-v5/zone-03-vip-salon.png",
      "route.shop.v5": "./assets/backgrounds/v5-candidates/galleria_lapin_clean_v1.png",
      "char.mimi.host.v5": "./assets/character-animation-v8/unified-cast-v1/mimi.png",
      "char.mimi.dialogue.neutral.v5": "./assets/characters/story-v5-candidates/mimi_dialogue/neutral.png",
      "char.mimi.dialogue.concerned.v5": "./assets/characters/story-v5-candidates/mimi_dialogue/concerned.png",
      "char.mimi.dialogue.determined.v5": "./assets/characters/story-v5-candidates/mimi_dialogue/determined.png",
      "char.mimi.dialogue.relief.v5": "./assets/characters/story-v5-candidates/mimi_dialogue/relief.png",
      "char.mimi.story.treasureKeyReceive.v5": "./assets/characters/story-v5-candidates/mimi_story/treasure_keyReceive.png",
      "char.mimi.story.pokerCompareCards.v5": "./assets/characters/story-v5-candidates/mimi_story/poker_compareCards.png",
      "char.mimi.story.raceRunTogether.v5": "./assets/characters/story-v5-candidates/mimi_story/race_runTogether.png",
      "boss.velvetTreasure.idle.v5": "./assets/characters/treasure-poker-v5/velvet_dealer.png",
      "boss.velvetTreasure.attack.v5": "./assets/characters/treasure-poker-v5/velvet_dealer.png",
      "boss.velvetTreasure.hit.v5": "./assets/characters/treasure-poker-v5/velvet_dealer.png",
      "boss.velvetTreasure.defeat.v5": "./assets/characters/treasure-poker-v5/velvet_concede.png",
      "boss.velvetTreasure.reward.v5": "./assets/characters/treasure-poker-v5/velvet_concede.png",
      "boss.cardShark.idle.v5": "./assets/characters/boss-states-v5-candidates/card_shark/final/attack.png",
      "boss.cardShark.attack.v5": "./assets/characters/boss-states-v5-candidates/card_shark/final/cardFan.png",
      "boss.cardShark.hit.v5": "./assets/characters/boss-states-v5-candidates/card_shark/final/hit.png",
      "boss.cardShark.defeat.v5": "./assets/characters/boss-states-v5-candidates/card_shark/final/defeated.png",
      "boss.cardShark.reward.v5": "./assets/characters/boss-states-v5-candidates/card_shark/final/returnPass.png",
      "boss.tearsStorm.idle.v5": "./assets/characters/boss-states-v5-candidates/tears_storm/final/child.png",
      "boss.tearsStorm.attack.v5": "./assets/characters/boss-states-v5-candidates/tears_storm/final/attack.png",
      "boss.tearsStorm.hit.v5": "./assets/characters/boss-states-v5-candidates/tears_storm/final/hit.png",
      "boss.tearsStorm.defeat.v5": "./assets/characters/boss-states-v5-candidates/tears_storm/final/defeated.png",
      "boss.tearsStorm.reward.v5": "./assets/characters/boss-states-v5-candidates/tears_storm/final/recoveredChild.png"
    };
    Object.keys(CHAPTER_META).forEach(chapterId => {
      const folder = `${String(Object.keys(CHAPTER_META).indexOf(chapterId) + 1).padStart(2, "0")}_${chapterId}`;
      SCENE_KINDS.forEach(kind => {
        paths[`scene.${chapterId}.${kind}.v5`] = chapterId === "treasure"
          ? TREASURE_RUNTIME_SCENES[kind]
          : `./assets/scenes-v5-candidates/${folder}/scene_${kind}.png`;
      });
    });
    return Object.freeze(paths);
  })();

  const LABELS = Object.freeze({
    explore: "ACT 1 / EXPLORE",
    omen: "ACT 2 / OMEN",
    chain: "ACT 3 / ACTION",
    boss: "FINAL / BOSS",
    bonus: "FIRST LIGHT / REWARD"
  });

  function deepFreeze(value) {
    if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
    Object.values(value).forEach(deepFreeze);
    return Object.freeze(value);
  }

  function validateStory(story) {
    if (!story || !Array.isArray(story.chapters) || !Array.isArray(story.scenes)) {
      throw new TypeError("MimiStory chapters and scenes are required");
    }
    if (story.chapters.length !== 5 || story.scenes.length !== 25) {
      throw new RangeError("V5 requires exactly 5 chapters and 25 scenes");
    }
  }

  function build(story) {
    validateStory(story);
    const stages = story.chapters.map(chapter => {
      const meta = CHAPTER_META[chapter.id];
      if (!meta) throw new Error(`Unknown V5 chapter: ${chapter.id}`);
      const chapterScenes = Object.create(null);
      SCENE_KINDS.forEach(kind => {
        const scene = story.getScene(`${chapter.id}.${kind}`);
        if (!scene) throw new Error(`Missing story scene: ${chapter.id}.${kind}`);
        chapterScenes[kind] = {
          label: LABELS[kind],
          title: scene.title,
          objective: scene.nextObjective,
          image: `scene.${chapter.id}.${kind}.v5`,
          plannedAsset: ASSET_PATHS[`scene.${chapter.id}.${kind}.v5`].replace("./assets/scenes-v5-candidates/", ""),
          actorImage: chapter.id === "treasure" ? TREASURE_ACTORS[kind] : chapter.id === "poker" ? POKER_ACTORS[kind] : chapter.id === "race" ? RACE_ACTORS[kind] : null
        };
      });
      const explore = story.getScene(`${chapter.id}.explore`);
      const omen = story.getScene(`${chapter.id}.omen`);
      const chain = story.getScene(`${chapter.id}.chain`);
      const boss = story.getBoss(chapter.id);
      return {
        id: chapter.id,
        number: chapter.order,
        title: chapter.title,
        stageName: meta.stageName,
        series: meta.series,
        cover: `scene.${chapter.id}.explore.v5`,
        image: `scene.${chapter.id}.explore.v5`,
        color: meta.color,
        gaugeLabel: meta.gaugeLabel,
        gaugeMax: meta.gaugeMax,
        nodes: [...meta.nodes],
        story: `${chapter.question} ${chapter.learning}を確かめる章。`,
        intro: `${explore.start} ${explore.action}`,
        chance: `${omen.incident} ${omen.nextObjective}`,
        win: chain.result,
        miss: meta.miss,
        boss: {
          name: boss.name,
          title: boss.title,
          resistanceLabel: boss.resistanceLabel,
          hint: boss.motive,
          weakness: `${boss.resistanceLabel}をWINと物語行動でほどく。`,
          resolution: boss.resolution,
          image: chapter.id === "treasure" ? TREASURE_BOSS.idle : chapter.id === "poker" ? POKER_BOSS.idle : chapter.id === "race" ? RACE_BOSS.idle : null,
          images: chapter.id === "treasure" ? TREASURE_BOSS : chapter.id === "poker" ? POKER_BOSS : chapter.id === "race" ? RACE_BOSS : null
        },
        scenes: chapterScenes
      };
    });
    return deepFreeze(stages);
  }

  function install(story, content) {
    validateStory(story);
    if (!content || !content.assetPaths || typeof content.assetPaths !== "object") {
      throw new TypeError("MimiContent.assetPaths is required before V5 installation");
    }
    Object.assign(content.assetPaths, ASSET_PATHS);
    content.stages = build(story);
    content.lcdBackground = "scene.treasure.explore.v5";
    content.preloadIds = ["route.entrance.v5"];
    content.eventVisuals = {
      pot: { icon: "◆", tone: "treasure" },
      enemy: { icon: "!", tone: "battle" },
      chest: { icon: "宝", tone: "treasure" },
      merge: { icon: "♥", tone: "chance" },
      training: { icon: "UP", tone: "charge" },
      boss: { icon: "BOSS", tone: "boss" },
      freeze: { icon: "MAX", tone: "premium" }
    };
    content.storyBeats = story.scenes.map(scene => ({
      chapter: story.getChapter(scene.chapter).title,
      text: scene.shortLine.replace(/\s+/g, " ")
    }));
    content.cast = [
      { id: "mimi", name: "ミミ", role: "リゾートホスト", portrait: "char.mimi.host.v5" },
      { id: "futureMimi", name: "未来ミミ", role: "シークレットプロデューサー", portrait: "char.futureMimi", hidden: true },
      { id: "velvet", name: "ヴェルベット", role: "カードディーラー", portrait: "char.velvet", hidden: true }
    ];
    content.machines = [{
      id: "jackpot",
      title: "ミミのジャックポットリゾート",
      subtitle: "単一筐体・5章連続ストーリー / 3リール・5ライン",
      cover: "route.machines.v5",
      playable: true
    }];
    return deepFreeze({ status: STATUS, stages: content.stages, assets: ASSET_PATHS });
  }

  return Object.freeze({ STATUS, SCENE_KINDS, CHAPTER_META, ASSET_PATHS, build, install });
});
