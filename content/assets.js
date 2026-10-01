/*
 * content/assets.js — 画像パスの一覧（アセットマニフェスト）
 *
 * **画像の差し替えはこのファイルだけを直す。**
 *
 * ほかのコンテンツ（stages.js / shop.js / cast.js）は、パスではなく
 * ここの ID を書く。絵を別のものに替えたいときは、この表の右辺だけを
 * 書き換えればゲーム全体に反映される。ファイル名を探して game.js の
 * あちこちを直して回る必要はない。
 *
 * CSS 側（背景・筐体・ボタン）は JS からは触れないので、
 * slot.css 冒頭の「画像マニフェスト」ブロックが対になっている。
 * 両方まとめて `node tools/verify-content.mjs` が実在を検証する。
 *
 * 命名は `分類.名前`。分類は次のとおり:
 *   symbol   リール図柄の置き場（ディレクトリ）
 *   char     キャラクターの立ち絵
 *   stage    ステージ／背景
 *   cutin    カットイン
 *   icon     小さなアイコン（ショップの商品画像など）
 *   lcd      上部液晶で使う素材
 */
(function (root) {
  "use strict";

  /** リール図柄の置き場。tools/process-symbols.mjs が仕上げた版。 */
  const SYMBOL_DIR = "./assets/generated/v3/symbols/dist/";

  const paths = {
    // --- キャラクター ---
    "char.mimi": "./assets/derived/characters/mimi_home.png",
    "char.mimi.casino": "./assets/characters/mimi_default.png",
    "char.mimi.dealer": "./assets/characters/mimi_dealer_formal.png",
    "char.futureMimi": "./assets/characters/mimi_future_director.png",
    "char.mimi.treasure": "./assets/characters/costumes/mimi_treasure_explorer.png",
    "char.mimi.croupier": "./assets/characters/costumes/mimi_moonlight_croupier.png",
    "char.mimi.racer": "./assets/characters/costumes/mimi_sky_racer.png",
    "char.mimi.navigator": "./assets/characters/costumes/mimi_wonderland_navigator.png",
    "char.mimi.raid": "./assets/characters/costumes/mimi_raid_commander.png",
    "char.mimi.tropical": "./assets/characters/costumes/mimi_tropical_hostess.png",
    "char.mimi.gala": "./assets/characters/costumes/mimi_twilight_gala.png",
    "char.mimi.empress": "./assets/characters/costumes/mimi_jackpot_empress.png",
    "char.rico": "./assets/characters/rico_bunny.png",
    "char.velvet": "./assets/characters/velvet_default.png",
    "char.luana": "./assets/derived/characters/luana_shop.png",
    "char.boss.shahar": "./assets/characters/boss_shahar_crystal_dragon.png",

    // --- ステージ / 背景 ---
    "stage.casinoVip": "./assets/casino-loop-v5/zone-03-vip-salon.png",
    "stage.plaza": "./assets/imageboard/42_stage_resort-plaza-map.png",
    "stage.gateway": "./assets/imageboard/39_stage_resort-map-gateway.png",
    "stage.harbor": "./assets/imageboard/40_stage_harbor-sunset-map.png",
    "stage.jungle": "./assets/imageboard/41_stage_jungle-ruins-map.png",
    "stage.pool": "./assets/imageboard/43_stage_pool-resort-map.png",
    "stage.market": "./assets/imageboard/44_stage_market-harbor-map.png",
    "stage.coastal": "./assets/imageboard/45_stage_coastal-ruins-map.png",
    "stage.mall": "./assets/imageboard/05_stage_galleria-lapin-mall.png",
    "stage.lobby": "./assets/backgrounds/lobby.png",
    "stage.jade": "./assets/stages/stage_jade.png",
    "stage.canyon": "./assets/stages/stage_canyon.png",
    "stage.sanctum": "./assets/stages/stage_sanctum.png",
    "stage.observatory": "./assets/stages/stage_observatory.png",

    // --- 上部液晶: 第1章 宝探し ---
    "scene.treasure.explore": "./assets/casino-loop-v5/zone-01-arrival.png",
    "scene.treasure.omen": "./assets/casino-loop-v5/zone-02-main-floor.png",
    "scene.treasure.chain": "./assets/casino-loop-v5/zone-03-vip-salon.png",
    "scene.treasure.boss": "./assets/casino-loop-v5/zone-03-vip-salon.png",
    "scene.treasure.bonus": "./assets/casino-loop-v5/zone-04-jewel-exchange.png",

    // --- 上部液晶: 第2章 ポーカー ---
    "scene.poker.explore": "./assets/scenes/02_poker/scene_explore.webp",
    "scene.poker.omen": "./assets/scenes/02_poker/scene_omen.webp",
    "scene.poker.chain": "./assets/scenes/02_poker/scene_chain.webp",
    "scene.poker.boss": "./assets/scenes/02_poker/scene_boss.webp",
    "scene.poker.bonus": "./assets/scenes/02_poker/scene_bonus.webp",

    // --- 上部液晶: 第3章 ドラゴンレース ---
    "scene.race.explore": "./assets/scenes/03_race/scene_explore.webp",
    "scene.race.omen": "./assets/scenes/03_race/scene_omen.webp",
    "scene.race.chain": "./assets/scenes/03_race/scene_chain.webp",
    "scene.race.boss": "./assets/scenes/03_race/scene_boss.webp",
    "scene.race.bonus": "./assets/scenes/03_race/scene_bonus.webp",

    // --- 上部液晶: 第4章 ワンダーランド ---
    "scene.wonderland.explore": "./assets/scenes/04_wonderland/scene_explore.webp",
    "scene.wonderland.omen": "./assets/scenes/04_wonderland/scene_omen.webp",
    "scene.wonderland.chain": "./assets/scenes/04_wonderland/scene_chain.webp",
    "scene.wonderland.boss": "./assets/scenes/04_wonderland/scene_boss.webp",
    "scene.wonderland.bonus": "./assets/scenes/04_wonderland/scene_bonus.webp",

    // --- 上部液晶: 第5章 ファイナルレイド ---
    "scene.raid.explore": "./assets/scenes/05_raid/scene_explore.webp",
    "scene.raid.omen": "./assets/scenes/05_raid/scene_omen.webp",
    "scene.raid.chain": "./assets/scenes/05_raid/scene_chain.webp",
    "scene.raid.boss": "./assets/scenes/05_raid/scene_boss.webp",
    "scene.raid.bonus": "./assets/scenes/05_raid/scene_bonus.webp",

    // --- 企画コンセプト画（台選択・冒険カバー） ---
    "concept.poker": "./assets/imageboard/misc-reference/01_concept_mimi-poker-battle.png",
    "concept.board": "./assets/imageboard/misc-reference/03_concept_mimi-board-adventure.png",
    "concept.race": "./assets/imageboard/misc-reference/04_concept_mimi-monster-race.png",

    // --- カットイン ---
    "cutin.chance": "./assets/cutins/chance.png",
    "cutin.bonus": "./assets/cutins/bonus.png",
    "cutin.premium": "./assets/cutins/premium.png",
    "cutin.burst": "./assets/cutins/burst.png",
    "cutin.revive": "./assets/cutins/revive.png",

    // --- 上部液晶 ---
    "lcd.walkway": "./assets/generated/v2/lcd_resort_walkway.png",
    "lcd.walkResort": "./assets/generated/adventure/lcd_walk_resort.png",
    "lcd.chibiWalk": "./assets/generated/adventure/mimi_chibi_walk_sheet.png",
    "lcd.chibiSheet": "./assets/generated/v2/mimi_chibi_sprite_sheet_alpha.png",

    // --- 小アイコン ---
    "icon.bell": "./assets/symbols/01_bell.png",
    "icon.heart": "./assets/symbols/06_heart_red.png",
    "icon.orbMax": "./assets/symbols/13_orb_max.png",
    "icon.chest": "./assets/symbols/14_chest_normal.png",
    "icon.revive": "./assets/symbols/22_revive.png"
  };

  /**
   * ID からパスを引く。未登録の ID は開発中に気づけるよう警告を出し、
   * 画面は壊さずに空文字を返す。
   */
  function asset(id) {
    if (!id) return "";
    if (!Object.prototype.hasOwnProperty.call(paths, id)) {
      if (typeof console !== "undefined") console.warn(`[content] 未登録のアセット ID: ${id}`);
      return "";
    }
    return paths[id];
  }

  /** 起動時に先読みするもの。ここに無い絵は初回表示で一瞬遅れる。 */
  // Startup waits only for what the first title/home/slot frame needs.  Shop,
  // episode and concept art are decoded by the browser when their route/cue is
  // actually shown; blocking on the full imageboard previously transferred
  // roughly 84 MB before even the portrait rotate notice could appear.
  const preload = [
    "stage.gateway"
  ];

  root.MimiContent = root.MimiContent || {};
  root.MimiContent.SYMBOL_DIR = SYMBOL_DIR;
  root.MimiContent.assetPaths = paths;
  root.MimiContent.asset = asset;
  root.MimiContent.preloadIds = preload;
}(typeof globalThis !== "undefined" ? globalThis : this));
