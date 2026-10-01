/*
 * Series-motif ledger.  These are choreography transfers, not silent copies of
 * unverified assets.  sourcePath is kept beside each cue so future artists can
 * audit why an effect looks and moves the way it does.
 */
(function (root) {
  "use strict";

  const motifs = {
    notice: {
      id: "notice", label: "NOTICE", heat: 1, sound: "notice",
      sourceProject: "mimi_gamble_guild", sourcePath: "src/playtest/CausalPlaytest.tsx; src/playtest/content.ts",
      transfer: "reference-regenerate", direction: "封印紋を1段だけ点灯し、因果線を短く走らせる"
    },
    chance: {
      id: "chance", label: "CHANCE", heat: 2, sound: "tenpai",
      sourceProject: "mimi", sourcePath: "game.js#ALL-IN; assets/ui/fx_flash_gold.png",
      transfer: "reference-regenerate", direction: "伏せ札の縁、カードファン、読み合いの間を通常CHANCEへ移植"
    },
    hot: {
      id: "hot", label: "激アツ", heat: 3, sound: "hot",
      sourceProject: "mimi_mad_doctor_stadium", sourcePath: "src/ui/components/match/expectTier.ts; docs/GAME_FEEL_ROADMAP.md",
      transfer: "reference-regenerate", direction: "赤→金→虹の昇格、最終段でPUSHを脈動"
    },
    goldenGate: {
      id: "golden-gate", label: "GOLDEN GATE", heat: 4, sound: "gate",
      sourceProject: "mimi_dragon_race_game", sourcePath: "js/shingan_race.js; images/story/shingan_clear.webp",
      transfer: "reference-regenerate", direction: "神眼クリア後の王冠光柱をゲート開放へ再構成"
    },
    bonus: {
      id: "bonus", label: "RESORT BONUS", heat: 4, sound: "bonus",
      sourceProject: "mimi", sourcePath: "game.js#ALL-IN; assets/characters/velvet_default.png",
      transfer: "reference-regenerate", direction: "ヴェルベットのディールとチップ祝祭を白金色で展開"
    },
    boss: {
      id: "boss", label: "BOSS SHOW", heat: 4, sound: "boss",
      sourceProject: "mimi_secret_boss_arena", sourcePath: "docs/GAME_DESIGN.md; docs/VISUAL_ASSET_LEDGER_V2.md",
      transfer: "direct-choreography", direction: "登場シルエット→HP点灯→ヒットストップの三拍子"
    },
    revive: {
      id: "revive", label: "ぱにゅぱにゅ", heat: 3, sound: "revive",
      sourceProject: "mimi_dragon_race_game", sourcePath: "js/paho_cutin.js",
      transfer: "reference-regenerate", direction: "祈り8コマの間を現行ミミのハート復活へ置換"
    },
    jackpot: {
      id: "jackpot", label: "JACKPOT", heat: 5, sound: "jackpot",
      sourceProject: "mimi-series", sourcePath: "docs/EFFECT_SOURCE_LEDGER.md",
      transfer: "new-composite", direction: "5作品の勝利色を連鎖し、最後にFuture Mimiを一瞬だけ見せる"
    }
  };

  root.MimiContent = root.MimiContent || {};
  root.MimiContent.effectMotifs = motifs;
}(typeof globalThis !== "undefined" ? globalThis : this));
