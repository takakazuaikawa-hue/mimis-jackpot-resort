/*
 * chapter1-flow.js - Chapter 1 production trigger table.
 *
 * Reel odds stay in slot-core.js. This module translates the already-settled
 * flag/result into one visible table-duel response and owns the fixed route:
 * Rico -> Polka -> Selina -> Grano -> Velvet.
 */
(function (root, factory) {
  "use strict";
  const core = typeof module === "object" && module.exports
    ? require("./slot-core.js")
    : root && root.SlotCore;
  const economy = typeof module === "object" && module.exports
    ? require("./economy-rules.js")
    : root && root.MimiEconomyRules;
  const blueprint = typeof module === "object" && module.exports
    ? require("./machine-presentation-blueprint.js")
    : root && root.MimiMachinePresentationBlueprint;
  const api = factory(core, economy, blueprint);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.MimiChapter1Flow = api;
}(typeof globalThis !== "undefined" ? globalThis : this, function (core, economy, blueprint) {
  "use strict";

  if (!core || !core.FLAG_TABLES || !Array.isArray(core.FLAG_TABLES.normal)) {
    throw new Error("MimiChapter1Flow requires SlotCore.FLAG_TABLES.normal");
  }
  if (!economy || !economy.CONFIG || !economy.CONFIG.panyu) {
    throw new Error("MimiChapter1Flow requires MimiEconomyRules.CONFIG.panyu");
  }
  if (!blueprint || typeof blueprint.defineMachine !== "function") {
    throw new Error("MimiChapter1Flow requires MimiMachinePresentationBlueprint");
  }

  function deepFreeze(value) {
    if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
    Object.getOwnPropertyNames(value).forEach(function (key) { deepFreeze(value[key]); });
    return Object.freeze(value);
  }

  const TABLE_ORDER = deepFreeze([
    {
      id: "rico",
      name: "リコ先輩",
      theme: "基本の勝負",
      arrivalLine: "まずは基本の勝負よ",
      goalLine: "リコ先輩に勝とう！",
      stack: 2,
      rewardBetCoins: 1,
      clearLine: "合格よ！",
      // The generated V8 sheet exported Rico and Polka under each other's
      // filenames. Keep the semantic table identity correct at the runtime
      // boundary: Rico is the blonde bunny host.
      baseAsset: "./assets/character-animation-v8/unified-cast-v1/polka.png",
      actionAsset: "./assets/character-animation-v8/unified-cast-action-v1/polka.png",
    },
    {
      id: "polka",
      name: "ポルカ",
      theme: "強気なブラフ",
      arrivalLine: "全力でブラフをかけるよ！",
      goalLine: "ブラフを見破ろう！",
      stack: 3,
      rewardBetCoins: 1,
      clearLine: "やるね、ミミ！",
      // Polka is the black-haired player with red/teal highlights.
      baseAsset: "./assets/character-animation-v8/unified-cast-v1/rico.png",
      actionAsset: "./assets/character-animation-v8/unified-cast-action-v1/rico.png",
    },
    {
      id: "selina",
      name: "セリナ",
      theme: "危険な流れ",
      arrivalLine: "危ない場札ほど、面白いよ",
      goalLine: "危険な流れを読もう！",
      stack: 4,
      rewardBetCoins: 1,
      clearLine: "勝負ありね！",
      baseAsset: "./assets/character-animation-v8/unified-cast-v1/selina.png",
      actionAsset: "./assets/character-animation-v8/unified-cast-action-v1/selina.png",
    },
    {
      id: "grano",
      name: "グラーノ",
      theme: "ポットの読み合い",
      arrivalLine: "最後のコイン、賭けるよ",
      goalLine: "最後のBET COINを取ろう！",
      stack: 5,
      rewardBetCoins: 1,
      clearLine: "最後の一枚だよ！",
      baseAsset: "./assets/character-animation-v8/unified-cast-v1/grano.png",
      actionAsset: "./assets/character-animation-v8/unified-cast-action-v1/grano.png",
    },
  ]);

  const BOSS_TABLE = deepFreeze({
    id: "velvet",
    name: "ヴェルベット",
    theme: "ロイヤルポット",
    arrivalLine: "ロイヤルポットを賭けるわ",
    goalLine: "Aを引いて、ロイヤルを完成させよう！",
    requiredBetCoins: TABLE_ORDER.reduce(function (total, table) { return total + table.rewardBetCoins; }, 0),
    boss: true,
    baseAsset: "./assets/character-animation-v8/unified-cast-boss-v1/velvet-production.png",
    actionAsset: "./assets/character-animation-v8/unified-cast-boss-v1/velvet-production.png",
  });

  // Chapter 1 repeat-loop contract. A normal-table strong hit can prepare the
  // rival who joins Mimi, and that exact actor then improves the real boss
  // calculation. A failed boss attempt raises RESOLVE for the next attempt.
  // All values are explicit and capped so the UI can tell the complete truth.
  const REPLAY_LOOP = deepFreeze({
    preparationHeat: 3,
    maxResolveLevel: 3,
    teamDamagePerReady: 2,
    synergyDamage: 5,
    resolveDamagePerLevel: 4,
    extraTurnsPerResolve: 1,
    allyIds: TABLE_ORDER.map(function (table) { return table.id; }),
  });

  // A losing run must still teach the player something. Four consecutive
  // non-REPLAY misses expose the current rival's tell; the next paying table
  // hit gets one extra STACK damage. This never changes reel odds, CREDIT,
  // payout, or persistent COINS.
  const READ_ASSIST = deepFreeze({
    missThreshold: 4,
    stackBonus: 1,
  });

  // One mid-route invitation at most. Existing reel results own entry; the
  // presentation must neither draw a second lottery nor award credits.
  const NORMAL_CHANCE = deepFreeze({
    flags: ["bar", "seven_blue", "seven_red"],
    followupGames: 2,
  });

  function settleNormalChance(previous, outcome) {
    const value = previous || { used: false, remaining: 0, ready: false };
    if (outcome.bossReady) return deepFreeze({ used: true, remaining: 0, ready: false });
    if (value.ready) return value;
    if (value.remaining > 0) {
      const remaining = value.remaining - 1;
      return deepFreeze({ used: true, remaining, ready: remaining === 0 });
    }
    if (!value.used && outcome.payout > 0 && NORMAL_CHANCE.flags.includes(outcome.flag)) {
      return deepFreeze({ used: true, remaining: NORMAL_CHANCE.followupGames, ready: false });
    }
    return value;
  }

  // Post-clear replay goals give repeated Chapter 1 runs a different readable
  // intention without adding payout, damage, odds, CREDIT, or COINS. Every
  // condition is derived from state the player already sees on the cabinet.
  const ROYAL_REPLAY_ORDERS = deepFreeze([
    {
      id: "team", title: "TEAM ROYAL", description: "4人全員をREADYにしてヴェルベットへ", encounter: "仲間の試練を しかけた！", target: 4,
      replayLabel: "仲間の力", approach: "ブドウ以上の役とREAD BREAKで仲間をREADYに。4人の支援を集めて勝とう。",
      inviter: "rico", invitation: "お見事、ミミ！ 次はみんなの力を集めて勝ちましょう。",
      commandGoals: {
        rico: "ブドウ以上かREAD BREAKで、リコ先輩をREADYにしよう！",
        polka: "ブドウ以上かREAD BREAKで、ポルカをREADYにしよう！",
        selina: "ブドウ以上かREAD BREAKで、セリナをREADYにしよう！",
        grano: "ブドウ以上かREAD BREAKで、4人目をREADYにしよう！",
      },
    },
    {
      id: "read", title: "READ ROYAL", description: "READ BREAKを3回決める", encounter: "読み合いを しかけた！", target: 3,
      replayLabel: "読みの流れ", approach: "出目は選べない。4回連続で外した後のREAD READYを見届け、次のブレイクを力にしよう。",
      inviter: "selina", invitation: "よく見ていたね。次は流れが変わる瞬間を、一緒に待とう。",
      commandGoals: {
        rico: "リコ先輩の卓で4回外し、次の勝負でREAD BREAK！",
        polka: "ポルカの卓で4回外し、次の勝負でREAD BREAK！",
        selina: "セリナの卓で4回外し、次の勝負でREAD BREAK！",
        grano: "グラーノの卓で4回外し、次の勝負でREAD BREAK！",
      },
    },
    {
      id: "strong", title: "HOT HAND", description: "READYからAIMを2回決める", encounter: "熱戦を しかけた！", target: 2,
      replayLabel: "AIM勝負", approach: "READYでは待ち、AIMでSTOP！ 2回成功してからヴェルベットに勝とう。",
      inviter: "polka", invitation: "やるじゃん、ミミ！ 次は光った瞬間に、ピタッと決めてみなよ！",
      commandGoals: {
        rico: "STOPにREADYが出ても押さず、AIMに光った瞬間に押そう！",
        polka: "READYでは待つ。AIMに変わった瞬間だけSTOP！",
        selina: "茶色のREADYで待ち、桃色のAIMでSTOP！",
        grano: "最後の卓でも、READYでは待ってAIMで押そう！",
      },
    },
    {
      id: "speed", title: "QUICK DEAL", description: "40G以内にヴェルベットへ", encounter: "速攻勝負を しかけた！", target: 40,
      replayLabel: "速攻突破", approach: "秒数ではなく通常ゲーム数の勝負。40G以内に4人を突破し、ヴェルベットに勝とう。",
      inviter: "grano", invitation: "いい勝負だったね。今度は何ゲームで、ここまで来られるかな？",
      commandGoals: {
        rico: "リコ先輩を素早く突破しよう！",
        polka: "ブラフに迷わず、40G以内を守ろう！",
        selina: "危険な流れを素早く読もう！",
        grano: "グラーノを越え、40G以内にVIP卓へ！",
      },
    },
    {
      id: "first", title: "FIRST CROWN", description: "ヴェルベットを初回で撃破", encounter: "一発勝負を しかけた！", target: 1,
      replayLabel: "初戦撃破", approach: "仲間のREADYでボス戦の支援を集めよう。最初の挑戦で勝てば紋章を獲得。",
      inviter: "velvet", invitation: "今回はあなたの勝ちよ。次は一度の挑戦で、私に勝ってみせて。",
      commandGoals: {
        rico: "リコ先輩に勝ち、初戦撃破へ備えよう！",
        polka: "ブラフを見破り、初戦撃破へ備えよう！",
        selina: "危険な流れを読み、初戦撃破へ備えよう！",
        grano: "最後のBET COINを取り、初戦で決めよう！",
      },
    },
  ]);

  // Each rival uses the same Hold'em rules but owns a different readable
  // table manner. These are presentation keys only; CSS controls the motion
  // and no personality entry can alter the internal flag or payout.
  const TABLE_POKER_PERSONALITIES = deepFreeze({
    rico: {
      id: "composed",
      pace: "deliberate",
      flopAction: "read",
      turnActions: ["check", "check", "bet", "raise", "all-in"],
    },
    polka: {
      id: "bold",
      pace: "quick",
      flopAction: "probe",
      turnActions: ["bet", "bet", "raise", "raise", "all-in"],
    },
    selina: {
      id: "analyst",
      pace: "slow",
      flopAction: "scan",
      turnActions: ["trap", "trap", "protect", "raise", "all-in"],
    },
    grano: {
      id: "merchant",
      pace: "steady",
      flopAction: "count",
      turnActions: ["check", "call", "call", "bet", "raise"],
    },
  });

  const TABLE_POKER_ACTION_LABELS = deepFreeze({
    check: "CHECK",
    bet: "BET",
    raise: "RAISE",
    "all-in": "ALL IN",
    trap: "CHECK",
    protect: "BET 2/3",
    call: "CALL",
  });

  // No second random roll is allowed here. Heat, motion size, and table damage
  // all derive from the same internal flag that slot-core already settled.
  const FLAG_TRIGGER_TABLE = deepFreeze({
    none:       { heat: 1, cue: "quiet",       damage: 0, result: "miss",     tell: false, fullScene: false },
    replay:     { heat: 2, cue: "replay",      damage: 0, result: "replay",   tell: false, fullScene: false },
    cherry:     { heat: 2, cue: "small-role",  damage: 1, result: "hit",      tell: false, fullScene: false },
    bell:       { heat: 2, cue: "small-role",  damage: 1, result: "hit",      tell: false, fullScene: false },
    grape:      { heat: 3, cue: "chance",      damage: 1, result: "hit",      tell: true,  fullScene: true  },
    watermelon: { heat: 3, cue: "chance",      damage: 2, result: "hit",      tell: true,  fullScene: true  },
    bar:        { heat: 4, cue: "strong",      damage: 3, result: "hit",      tell: true,  fullScene: true  },
    seven_blue: { heat: 4, cue: "very-strong", damage: 4, result: "critical", tell: true,  fullScene: true  },
    seven_red:  { heat: 5, cue: "royal",       damage: 5, result: "critical", tell: true,  fullScene: true  },
  });

  // Presentation-only Texas Hold'em runouts. These recipes translate the
  // already-settled slot flag into one readable board texture; they never roll
  // RNG or decide payout/STACK damage. The river branches only after the real
  // reel result has settled, so a missed pull-in cannot display a made hand.
  const TABLE_POKER_RECIPES = deepFreeze({
    none: {
      hole: [["A", "♣"], ["8", "♦"]],
      flop: [["2", "♥"], ["7", "♣"], ["J", "♠"]],
      turn: ["4", "♦"], riverHit: ["A", "♦"], riverMiss: ["9", "♣"],
      labels: ["Aハイ", "Aハイ", "Aハイ", "Aハイ", "ワンペア"], texture: "dry",
    },
    replay: {
      hole: [["9", "♣"], ["9", "♦"]],
      flop: [["2", "♠"], ["5", "♥"], ["K", "♦"]],
      turn: ["7", "♣"], riverHit: ["Q", "♠"], riverMiss: ["Q", "♠"],
      labels: ["ワンペア", "ワンペア", "ワンペア", "ワンペア", "ワンペア"], texture: "pair",
    },
    cherry: {
      hole: [["A", "♠"], ["K", "♦"]],
      flop: [["A", "♦"], ["7", "♣"], ["2", "♥"]],
      turn: ["9", "♣"], riverHit: ["K", "♣"], riverMiss: ["4", "♠"],
      labels: ["Aハイ", "ワンペア", "ワンペア", "ワンペア", "ツーペア"], texture: "pair",
    },
    bell: {
      hole: [["9", "♣"], ["9", "♦"]],
      flop: [["2", "♠"], ["5", "♥"], ["K", "♦"]],
      turn: ["7", "♣"], riverHit: ["9", "♥"], riverMiss: ["Q", "♠"],
      labels: ["ワンペア", "ワンペア", "ワンペア", "ワンペア", "スリーカード"], texture: "pair",
    },
    grape: {
      hole: [["9", "♥"], ["10", "♥"]],
      flop: [["7", "♣"], ["Q", "♦"], ["2", "♥"]],
      turn: ["8", "♠"], riverHit: ["J", "♦"], riverMiss: ["K", "♣"],
      labels: ["コネクター", "ストレート待ち", "ストレート待ち", "Kハイ", "ストレート"], texture: "straight",
    },
    watermelon: {
      hole: [["Q", "♣"], ["Q", "♦"]],
      flop: [["7", "♣"], ["8", "♦"], ["K", "♥"]],
      turn: ["2", "♠"], riverHit: ["Q", "♥"], riverMiss: ["4", "♣"],
      labels: ["ワンペア", "ワンペア", "ワンペア", "ワンペア", "スリーカード"], texture: "set",
    },
    bar: {
      hole: [["A", "♥"], ["9", "♥"]],
      flop: [["2", "♥"], ["Q", "♥"], ["7", "♣"]],
      turn: ["K", "♠"], riverHit: ["J", "♥"], riverMiss: ["4", "♣"],
      labels: ["Aハイ", "フラッシュ待ち", "フラッシュ待ち", "Aハイ", "フラッシュ"], texture: "flush",
    },
    seven_blue: {
      hole: [["Q", "♥"], ["K", "♥"]],
      flop: [["10", "♥"], ["3", "♣"], ["6", "♦"]],
      turn: ["J", "♥"], riverHit: ["A", "♥"], riverMiss: ["4", "♦"],
      labels: ["ブロードウェイ", "ロイヤル待ち", "ロイヤル待ち", "Kハイ", "ロイヤルストレートフラッシュ"], texture: "royal",
    },
    seven_red: {
      hole: [["A", "♥"], ["K", "♥"]],
      flop: [["10", "♥"], ["J", "♥"], ["2", "♣"]],
      turn: ["7", "♦"], riverHit: ["Q", "♥"], riverMiss: ["4", "♣"],
      labels: ["プレミアム", "ロイヤル待ち", "ロイヤル待ち", "Aハイ", "ロイヤルストレートフラッシュ"], texture: "royal",
    },
  });

  // "none" owns more than half of normal-mode flag weight. Repeating one
  // identical A8 dry board for every miss makes the upper LCD feel exhausted
  // long before the route reaches its first feature. These variants change
  // presentation only: every riverMiss remains an unmade high-card hand, the
  // settled flag/payout/STACK result is untouched, and variantKey is supplied
  // by the already-created spin transaction rather than a second random roll.
  const NONE_POKER_VARIANTS = deepFreeze([
    TABLE_POKER_RECIPES.none,
    {
      hole: [["K", "♠"], ["6", "♦"]],
      flop: [["3", "♦"], ["9", "♣"], ["Q", "♥"]],
      turn: ["5", "♠"], riverHit: ["K", "♦"], riverMiss: ["J", "♦"],
      labels: ["Kハイ", "Kハイ", "Kハイ", "Kハイ", "ワンペア"], texture: "dry",
    },
    {
      hole: [["Q", "♠"], ["7", "♦"]],
      flop: [["A", "♣"], ["5", "♥"], ["10", "♦"]],
      turn: ["3", "♠"], riverHit: ["Q", "♥"], riverMiss: ["8", "♣"],
      labels: ["Qハイ", "Aハイ", "Aハイ", "Aハイ", "ワンペア"], texture: "dry",
    },
    {
      hole: [["J", "♣"], ["4", "♦"]],
      flop: [["K", "♥"], ["8", "♣"], ["2", "♠"]],
      turn: ["Q", "♦"], riverHit: ["J", "♥"], riverMiss: ["5", "♣"],
      labels: ["Jハイ", "Kハイ", "Kハイ", "Kハイ", "ワンペア"], texture: "dry",
    },
    {
      hole: [["10", "♣"], ["6", "♦"]],
      flop: [["3", "♥"], ["J", "♣"], ["A", "♠"]],
      turn: ["8", "♦"], riverHit: ["10", "♥"], riverMiss: ["K", "♣"],
      labels: ["10ハイ", "Aハイ", "Aハイ", "Aハイ", "ワンペア"], texture: "dry",
    },
    {
      hole: [["K", "♣"], ["2", "♦"]],
      flop: [["4", "♥"], ["9", "♣"], ["Q", "♠"]],
      turn: ["6", "♦"], riverHit: ["K", "♥"], riverMiss: ["J", "♣"],
      labels: ["Kハイ", "Kハイ", "Kハイ", "Kハイ", "ワンペア"], texture: "dry",
    },
    {
      hole: [["A", "♠"], ["5", "♦"]],
      flop: [["2", "♣"], ["8", "♥"], ["Q", "♦"]],
      turn: ["6", "♠"], riverHit: ["A", "♥"], riverMiss: ["J", "♣"],
      labels: ["Aハイ", "Aハイ", "Aハイ", "Aハイ", "ワンペア"], texture: "dry",
    },
    {
      hole: [["Q", "♣"], ["4", "♥"]],
      flop: [["A", "♦"], ["7", "♠"], ["9", "♥"]],
      turn: ["2", "♣"], riverHit: ["Q", "♦"], riverMiss: ["K", "♦"],
      labels: ["Qハイ", "Aハイ", "Aハイ", "Aハイ", "ワンペア"], texture: "dry",
    },
    {
      hole: [["J", "♦"], ["8", "♠"]],
      flop: [["K", "♣"], ["3", "♥"], ["6", "♦"]],
      turn: ["A", "♠"], riverHit: ["J", "♥"], riverMiss: ["5", "♣"],
      labels: ["Jハイ", "Kハイ", "Aハイ", "Aハイ", "ワンペア"], texture: "dry",
    },
    {
      hole: [["10", "♥"], ["3", "♠"]],
      flop: [["Q", "♣"], ["5", "♦"], ["8", "♥"]],
      turn: ["A", "♣"], riverHit: ["10", "♦"], riverMiss: ["6", "♠"],
      labels: ["10ハイ", "Qハイ", "Aハイ", "Aハイ", "ワンペア"], texture: "dry",
    },
    {
      hole: [["K", "♦"], ["7", "♥"]],
      flop: [["2", "♣"], ["9", "♠"], ["J", "♦"]],
      turn: ["4", "♥"], riverHit: ["K", "♠"], riverMiss: ["A", "♣"],
      labels: ["Kハイ", "Kハイ", "Kハイ", "Aハイ", "ワンペア"], texture: "dry",
    },
    {
      hole: [["Q", "♥"], ["6", "♠"]],
      flop: [["3", "♣"], ["8", "♦"], ["K", "♥"]],
      turn: ["5", "♠"], riverHit: ["Q", "♦"], riverMiss: ["10", "♣"],
      labels: ["Qハイ", "Kハイ", "Kハイ", "Kハイ", "ワンペア"], texture: "dry",
    },
  ]);

  // One authored row per internal flag. A different machine keeps this schema
  // and replaces only its concept data. "shared" is intentionally not called
  // complete: it means the logic works but still uses a common motion/art/sound
  // family and therefore remains visible production work.
  const FLAG_PRESENTATION_TABLE = deepFreeze({
    none: {
      normal: { anticipationFamily: "quiet-felt", resultFamily: "neutral-settle", scenePolicy: "micro", signature: { asset: "./assets/chapter1-motifs/mimi-poker-card-back-source.png", motion: "void-breathe", audio: "void", accent: "#9ec8d5" } },
      boss: { route: "counter", actorId: "velvet", speaker: "ヴェルベット", technique: "レイズ", kind: "counter" },
      readiness: { logic: "ready", stopSequence: "ready", normalMotion: "ready", normalArt: "ready", bossMotion: "ready", audio: "ready" },
      nextUpgrade: "無役専用の静かな読み合いとヴェルベットのレイズ返し",
    },
    replay: {
      normal: { anticipationFamily: "replay-edge", resultFamily: "replay-push", scenePolicy: "micro", signature: { asset: "./assets/generated/v3/symbols/dist/replay.png", motion: "orbit-return", audio: "replay", accent: "#57e9ff" } },
      boss: { route: "guard", actorId: "mimi", speaker: "ミミ", technique: "ラビットステップ", kind: "guard" },
      readiness: { logic: "ready", stopSequence: "ready", normalMotion: "ready", normalArt: "ready", bossMotion: "ready", audio: "ready" },
      nextUpgrade: "PUSHを一目で伝える専用カード戻しと短い音",
    },
    cherry: {
      normal: { anticipationFamily: "small-role", resultFamily: "small-role-poke", scenePolicy: "micro", signature: { asset: "./assets/generated/v3/symbols/dist/cherry.png", motion: "twin-pop", audio: "cherry", accent: "#ff5f8f" } },
      boss: { route: "result-driven", actorId: "mimi", speaker: "ミミ", technique: "チェリーステップ", kind: "attack" },
      readiness: { logic: "ready", stopSequence: "ready", normalMotion: "ready", normalArt: "ready", bossMotion: "ready", audio: "ready" },
      nextUpgrade: "チェリー専用のワンペア成立カットと小さな祝福音",
    },
    bell: {
      normal: { anticipationFamily: "small-role", resultFamily: "small-role-poke", scenePolicy: "micro", signature: { asset: "./assets/generated/v3/symbols/dist/bell.png", motion: "gold-swing", audio: "bell", accent: "#ffe36f" } },
      boss: { route: "result-driven", actorId: "polka", speaker: "ポルカ", technique: "ラッキーコール！", kind: "attack" },
      readiness: { logic: "ready", stopSequence: "ready", normalMotion: "ready", normalArt: "ready", bossMotion: "ready", audio: "ready" },
      nextUpgrade: "ベル専用のコール成立ポーズとチップ獲得音",
    },
    grape: {
      normal: { anticipationFamily: "chance", resultFamily: "chance-hit", scenePolicy: "locked", signature: { asset: "./assets/generated/v3/symbols/dist/grape.png", motion: "violet-chain", audio: "grape", accent: "#c98cff" } },
      boss: { route: "result-driven", actorId: "rico", speaker: "リコ先輩", technique: "オッズリード！", kind: "attack" },
      readiness: { logic: "ready", stopSequence: "ready", normalMotion: "ready", normalArt: "ready", bossMotion: "ready", audio: "ready" },
      nextUpgrade: "ストレート待ちが育つSTOP別の専用カット",
    },
    watermelon: {
      normal: { anticipationFamily: "chance", resultFamily: "chance-hit", scenePolicy: "locked", signature: { asset: "./assets/generated/v3/symbols/dist/watermelon.png", motion: "green-split", audio: "watermelon", accent: "#78f4a1" } },
      boss: { route: "result-driven", actorId: "selina", speaker: "セリナ", technique: "スプリットシグナル！", kind: "attack" },
      readiness: { logic: "ready", stopSequence: "ready", normalMotion: "ready", normalArt: "ready", bossMotion: "ready", audio: "ready" },
      nextUpgrade: "セット完成を強調するセリナ専用の場札解析カット",
    },
    bar: {
      normal: { anticipationFamily: "strong", resultFamily: "strong-cutin", scenePolicy: "locked", signature: { asset: "./assets/generated/v3/symbols/dist/bar.png", motion: "bar-shutter", audio: "bar", accent: "#ffb23f" } },
      boss: { route: "result-driven", actorId: "grano", speaker: "グラーノ", technique: "ポットカット！", kind: "attack" },
      readiness: { logic: "ready", stopSequence: "ready", normalMotion: "ready", normalArt: "ready", bossMotion: "ready", audio: "ready" },
      nextUpgrade: "フラッシュ完成へ加速する専用強カットと発光音",
    },
    seven_blue: {
      normal: { anticipationFamily: "very-strong", resultFamily: "strong-cutin", scenePolicy: "locked", signature: { asset: "./assets/generated/v3/symbols/dist/seven_blue.png", motion: "blue-prism", audio: "seven-blue", accent: "#6eeeff" } },
      boss: { route: "result-driven", actorId: "mimi", speaker: "ミミ", technique: "ブルーオールイン！", kind: "attack" },
      readiness: { logic: "ready", stopSequence: "ready", normalMotion: "ready", normalArt: "ready", bossMotion: "ready", audio: "ready" },
      nextUpgrade: "青いロイヤル待ち専用の主人公カットインと煽り音階",
    },
    seven_red: {
      normal: { anticipationFamily: "royal", resultFamily: "royal-takeover", scenePolicy: "locked", signature: { asset: "./assets/generated/v3/symbols/dist/seven_red.png", motion: "royal-crown", audio: "seven-red", accent: "#ff4f79" } },
      boss: { route: "result-driven", actorId: "finale", speaker: "みんな", technique: "ジャックポット・オールイン！", kind: "attack" },
      readiness: { logic: "ready", stopSequence: "ready", normalMotion: "ready", normalArt: "ready", bossMotion: "ready", audio: "ready" },
      nextUpgrade: "全員集合の最終攻撃モーションと専用決着音の完成",
    },
  });

  const MACHINE_PRESENTATION_BLUEPRINT = blueprint.defineMachine({
    machineId: "mimis-jackpot-resort",
    conceptId: "chapter1.royal-holdem",
    direction: { player: "left", opponent: "right", progression: "left-to-right" },
    messageContract: {
      arrival: ["opponent-appeared", "opponent-line", "player-goal"],
      result: ["made-hand", "winner", "next-action"],
      maxLinesPerBeat: 2,
    },
    inputContract: {
      push: "visible-only-when-authored-beat-requires-acknowledgement",
      stopButtons: "one-button-centered-under-each-reel",
    },
    phases: {
      normal: ["treasure.table.enter", "treasure.table.hit", "treasure.table.clear"],
      trial: ["treasure.trial.enter", "treasure.trial.progress", "treasure.trial.success", "treasure.trial.revive", "treasure.trial.fail"],
      bonus: ["treasure.bonus.enter", "treasure.bonus.progress", "treasure.bonus.exit"],
      boss: ["treasure.boss.tell", "treasure.boss.enter", "treasure.boss.attack", "treasure.boss.counterCritical", "treasure.boss.revive", "treasure.boss.guard", "treasure.boss.hit", "treasure.boss.critical", "treasure.boss.timeout", "treasure.boss.retry", "treasure.boss.win"],
      reward: ["treasure.reward"],
    },
    assetContract: {
      normal: ["environment-loop", "unified-cast", "stop-street-cards", "role-result-accent"],
      strong: ["high-proportion-cutin", "role-specific-transition", "heat-specific-vfx"],
      boss: ["player-left", "boss-right", "attack-cutins", "counter-cutins", "victory-finale"],
      audio: ["anticipation", "stop1", "stop2", "stop3", "made-hand", "miss", "critical", "victory"],
    },
    spinSequence: blueprint.SPIN_SEQUENCE,
    flagOrder: core.FLAG_TABLES.normal.map(function (entry) { return entry[0]; }),
    flags: Object.fromEntries(core.FLAG_TABLES.normal.map(function (entry) {
      const flagId = entry[0];
      const trigger = FLAG_TRIGGER_TABLE[flagId];
      const authored = FLAG_PRESENTATION_TABLE[flagId];
      return [flagId, {
        heat: trigger.heat,
        trigger: trigger,
        poker: TABLE_POKER_RECIPES[flagId],
        normal: authored.normal,
        boss: authored.boss,
        readiness: authored.readiness,
        nextUpgrade: authored.nextUpgrade,
      }];
    })),
  });

  const PRESENTATION_COVERAGE = blueprint.coverageRows(MACHINE_PRESENTATION_BLUEPRINT);
  const PRESENTATION_COVERAGE_SUMMARY = blueprint.coverageSummary(MACHINE_PRESENTATION_BLUEPRINT);
  const BOSS_ATTACK_TABLE = deepFreeze(Object.assign(
    Object.fromEntries(MACHINE_PRESENTATION_BLUEPRINT.flagOrder.map(function (flagId) {
      return [flagId, MACHINE_PRESENTATION_BLUEPRINT.flags[flagId].boss];
    })),
    { default: MACHINE_PRESENTATION_BLUEPRINT.flags.bell.boss }
  ));

  const PANYU_RESCUE_POLICY = deepFreeze({
    trigger: "miss-only",
    baseChance: economy.CONFIG.panyu.chanceBase,
    chancePerOrb: economy.CONFIG.panyu.chancePerOrb,
    chancePerMissStreak: economy.CONFIG.panyu.chancePerStreak,
    chancePerNearMissLine: economy.CONFIG.panyu.nearMissChance,
    nearMissBonusCap: economy.CONFIG.panyu.nearMissChanceCap,
    chanceCap: economy.CONFIG.panyu.chanceCap,
    outcome: "cancel-miss-penalty-only",
    stackDamage: 0,
    betCoins: 0,
  });

  const normalFlagTotal = core.FLAG_TABLES.normal.reduce(function (total, entry) {
    return total + Number(entry[1] || 0);
  }, 0);

  const NORMAL_FREQUENCY_TABLE = deepFreeze(core.FLAG_TABLES.normal.map(function (entry) {
    const flag = entry[0];
    const weight = Number(entry[1] || 0);
    const contract = blueprint.flag(MACHINE_PRESENTATION_BLUEPRINT, flag);
    const trigger = contract.trigger;
    return Object.assign({
      flag: flag,
      weight: weight,
      percent: Number(((weight / normalFlagTotal) * 100).toFixed(2)),
      anticipationFamily: contract.normal.anticipationFamily,
      resultFamily: contract.normal.resultFamily,
      scenePolicy: contract.normal.scenePolicy,
    }, trigger);
  }));

  function tableAt(index) {
    const safeIndex = Math.max(0, Math.min(TABLE_ORDER.length - 1, Math.floor(Number(index) || 0)));
    return TABLE_ORDER[safeIndex];
  }

  function tablePokerPreview(input) {
    const values = input || {};
    const flag = Object.hasOwn(MACHINE_PRESENTATION_BLUEPRINT.flags, values.flag) ? values.flag : "none";
    const contract = blueprint.flag(MACHINE_PRESENTATION_BLUEPRINT, flag);
    const variantKey = Math.abs(Math.floor(Number(values.variantKey) || 0));
    const variantIndex = flag === "none" ? variantKey % NONE_POKER_VARIANTS.length : 0;
    const recipe = flag === "none" ? NONE_POKER_VARIANTS[variantIndex] : contract.poker;
    const trigger = contract.trigger;
    const opponentId = Object.hasOwn(TABLE_POKER_PERSONALITIES, values.opponentId) ? values.opponentId : "rico";
    const personality = TABLE_POKER_PERSONALITIES[opponentId];
    const stopCount = Math.max(0, Math.min(3, Math.floor(Number(values.stopCount) || 0)));
    const landed = Boolean(values.landed);
    const outcome = values.outcome === "replay" ? "replay" : values.outcome === "win" || values.outcome === "jackpot" ? "win" : "miss";
    const community = stopCount >= 1 ? recipe.flop.slice() : [];
    if (stopCount >= 2) community.push(recipe.turn);
    if (stopCount >= 3) community.push(landed ? recipe.riverHit : recipe.riverMiss);
    const labelIndex = stopCount < 3 ? stopCount : landed ? 4 : 3;
    const action = stopCount === 0
      ? "deal"
      : stopCount === 1
        ? personality.flopAction
        : stopCount === 2
          ? personality.turnActions[trigger.heat - 1]
          : outcome === "replay" ? "push" : outcome === "win" ? "mimi-takes-pot" : "rival-takes-pot";
    return deepFreeze({
      flag: flag,
      opponentId: opponentId,
      personality: personality.id,
      pace: personality.pace,
      heat: trigger.heat,
      street: ["preflop", "flop", "turn", "river"][stopCount],
      stopCount: stopCount,
      hole: recipe.hole.slice(),
      community: community,
      label: recipe.labels[labelIndex],
      texture: recipe.texture,
      variantIndex: variantIndex,
      action: action,
      actionLabel: TABLE_POKER_ACTION_LABELS[action] || "",
      landed: landed,
    });
  }

  function initialState() {
    const first = tableAt(0);
    return deepFreeze({ tableIndex: 0, opponentId: first.id, opponentStack: first.stack, betCoins: 0 });
  }

  function normalisePreparedAllies(value) {
    const source = Array.isArray(value) ? value : [];
    return REPLAY_LOOP.allyIds.filter(function (allyId) { return source.includes(allyId); });
  }

  function preparationGain(turn) {
    const damage = Math.max(0, Number(turn && turn.damage) || 0);
    const heat = Math.max(1, Math.min(5, Number(turn && turn.heat) || 1));
    if (damage <= 0 || heat < REPLAY_LOOP.preparationHeat) return 0;
    return heat - REPLAY_LOOP.preparationHeat + 1;
  }

  function settlePreparation(input) {
    const values = input || {};
    const opponentId = REPLAY_LOOP.allyIds.includes(values.opponentId)
      ? values.opponentId
      : REPLAY_LOOP.allyIds[0];
    const preparedAllies = normalisePreparedAllies(values.preparedAllies);
    const gain = preparationGain(values.turn);
    const focus = Math.max(0, Number(values.focus) || 0) + gain;
    const cleared = Boolean(values.cleared);
    const newlyPrepared = cleared && focus > 0 && !preparedAllies.includes(opponentId);
    const nextPrepared = newlyPrepared ? preparedAllies.concat(opponentId) : preparedAllies;
    return deepFreeze({
      focus: cleared ? 0 : focus,
      gain: gain,
      prepared: nextPrepared.includes(opponentId),
      newlyPrepared: newlyPrepared,
      preparedAllies: normalisePreparedAllies(nextPrepared),
      readyCount: nextPrepared.length,
    });
  }

  function nextResolveLevel(value) {
    return Math.min(REPLAY_LOOP.maxResolveLevel, Math.max(0, Math.floor(Number(value) || 0)) + 1);
  }

  function bossAdvantage(input) {
    const values = input || {};
    const preparedAllies = normalisePreparedAllies(values.preparedAllies);
    const readyCount = preparedAllies.length;
    const resolveLevel = Math.max(0, Math.min(REPLAY_LOOP.maxResolveLevel, Math.floor(Number(values.resolveLevel) || 0)));
    const baseDamage = Math.max(0, Number(values.baseDamage) || 0);
    const attackActor = String(values.attackActor || "mimi");
    const teamAttack = attackActor === "finale" && readyCount === REPLAY_LOOP.allyIds.length;
    const synergyActive = baseDamage > 0 && (preparedAllies.includes(attackActor) || teamAttack);
    const teamDamage = baseDamage > 0 ? readyCount * REPLAY_LOOP.teamDamagePerReady : 0;
    const synergyDamage = synergyActive ? REPLAY_LOOP.synergyDamage : 0;
    const resolveDamage = baseDamage > 0 ? resolveLevel * REPLAY_LOOP.resolveDamagePerLevel : 0;
    return deepFreeze({
      preparedAllies: preparedAllies,
      readyCount: readyCount,
      resolveLevel: resolveLevel,
      attackActor: attackActor,
      synergyActive: synergyActive,
      baseDamage: baseDamage,
      teamDamage: teamDamage,
      synergyDamage: synergyDamage,
      resolveDamage: resolveDamage,
      totalDamage: baseDamage + teamDamage + synergyDamage + resolveDamage,
      turnLimit: economy.CONFIG.boss.turnLimit + resolveLevel * REPLAY_LOOP.extraTurnsPerResolve,
    });
  }

  function resolveTableTurn(input) {
    const values = input || {};
    const flag = Object.hasOwn(MACHINE_PRESENTATION_BLUEPRINT.flags, values.flag) ? values.flag : "none";
    const trigger = blueprint.flag(MACHINE_PRESENTATION_BLUEPRINT, flag).trigger;
    const payout = Math.max(0, Number(values.payout) || 0);
    const replayHit = Boolean(values.replayHit);
    const baseDamage = payout > 0 && !replayHit ? trigger.damage : 0;
    // READ READY is a bounded fail-forward promise, not another invitation to
    // wait for favorable reel RNG.  REPLAY keeps the promise armed; the next
    // settled non-REPLAY spin cashes it for one table-only STACK damage.  Reel
    // payout and CREDIT remain exactly as settled by slot-core.
    const readBonusDamage = !replayHit && Boolean(values.readReady) ? READ_ASSIST.stackBonus : 0;
    const settledDamage = baseDamage + readBonusDamage;
    const readBreak = readBonusDamage > 0 && baseDamage === 0;
    const settledHeat = readBreak ? Math.max(REPLAY_LOOP.preparationHeat, trigger.heat) : trigger.heat;
    return deepFreeze({
      flag: flag,
      heat: settledHeat,
      cue: trigger.cue,
      tell: trigger.tell,
      fullScene: settledDamage > 0 && (trigger.fullScene || readBreak),
      result: replayHit ? "replay" : readBreak ? "read-break" : settledDamage > 0 ? trigger.result : "miss",
      damage: settledDamage,
      baseDamage: baseDamage,
      readBonusDamage: readBonusDamage,
      readConsumed: readBonusDamage > 0,
      readBreak: readBreak,
    });
  }

  function settleReadAssist(input) {
    const values = input || {};
    const previousStreak = Math.max(0, Math.floor(Number(values.streak) || 0));
    const wasReady = Boolean(values.ready);
    const turn = values.turn || {};
    if (turn.result === "replay") {
      return deepFreeze({ streak: previousStreak, ready: wasReady, triggered: false, consumed: false });
    }
    if (Number(turn.damage) > 0) {
      return deepFreeze({ streak: 0, ready: false, triggered: false, consumed: Boolean(turn.readConsumed) });
    }
    if (wasReady) {
      return deepFreeze({ streak: previousStreak, ready: true, triggered: false, consumed: false });
    }
    const streak = Math.min(READ_ASSIST.missThreshold, previousStreak + 1);
    const ready = streak >= READ_ASSIST.missThreshold;
    return deepFreeze({ streak: streak, ready: ready, triggered: ready, consumed: false });
  }

  function settleOpponent(state, turn) {
    const current = state || initialState();
    const table = tableAt(current.tableIndex);
    const damage = Math.max(0, Number(turn && turn.damage) || 0);
    const opponentStack = Math.max(0, Number(current.opponentStack) - damage);
    if (opponentStack > 0 || damage === 0) {
      return deepFreeze(Object.assign({}, current, {
        opponentId: table.id,
        opponentStack: opponentStack,
        cleared: false,
        bossReady: false,
        damage: damage,
      }));
    }

    const betCoins = Math.min(BOSS_TABLE.requiredBetCoins, Number(current.betCoins) + table.rewardBetCoins);
    const bossReady = betCoins >= BOSS_TABLE.requiredBetCoins;
    if (bossReady) {
      return deepFreeze({
        tableIndex: current.tableIndex,
        opponentId: table.id,
        opponentStack: 0,
        betCoins: betCoins,
        cleared: true,
        bossReady: true,
        damage: damage,
      });
    }

    const nextIndex = Math.min(TABLE_ORDER.length - 1, Number(current.tableIndex) + 1);
    const next = tableAt(nextIndex);
    return deepFreeze({
      tableIndex: nextIndex,
      opponentId: next.id,
      opponentStack: next.stack,
      betCoins: betCoins,
      cleared: true,
      clearedOpponentId: table.id,
      bossReady: false,
      damage: damage,
    });
  }

  function frequencySummary() {
    const fullScenePercent = NORMAL_FREQUENCY_TABLE.reduce(function (total, row) {
      return total + (row.fullScene ? row.percent : 0);
    }, 0);
    const strongPercent = NORMAL_FREQUENCY_TABLE.reduce(function (total, row) {
      return total + (row.heat >= 4 ? row.percent : 0);
    }, 0);
    const idealDamagePerSpin = NORMAL_FREQUENCY_TABLE.reduce(function (total, row) {
      return total + ((row.percent / 100) * row.damage);
    }, 0);
    const routeStack = TABLE_ORDER.reduce(function (total, table) { return total + table.stack; }, 0);
    return deepFreeze({
      fullScenePercent: Number(fullScenePercent.toFixed(2)),
      strongPercent: Number(strongPercent.toFixed(2)),
      idealDamagePerSpin: Number(idealDamagePerSpin.toFixed(4)),
      idealRouteSpins: Number((routeStack / idealDamagePerSpin).toFixed(1)),
    });
  }

  function royalReplayOrder(clearCount) {
    const count = Math.max(1, Math.floor(Number(clearCount) || 1));
    return ROYAL_REPLAY_ORDERS[(count - 1) % ROYAL_REPLAY_ORDERS.length];
  }

  function royalReplayProgress(orderId, metrics) {
    const order = ROYAL_REPLAY_ORDERS.find(function (entry) { return entry.id === orderId; });
    if (!order) return null;
    const source = metrics && typeof metrics === "object" ? metrics : {};
    const prepared = Math.max(0, Math.min(4, Number(source.preparedCount) || 0));
    const reads = Math.max(0, Number(source.readBreaks) || 0);
    const strong = Math.max(0, Number(source.strongLands) || 0);
    const spins = Math.max(0, Number(source.normalSpins) || 0);
    const attempts = Math.max(0, Number(source.bossAttempts) || 0);
    const defeated = Boolean(source.bossDefeated);
    let value = 0;
    let compact = "";
    let complete = false;
    if (order.id === "team") {
      value = prepared;
      compact = `TEAM ${prepared}/4`;
      complete = defeated && prepared >= order.target;
    } else if (order.id === "read") {
      value = reads;
      compact = `READ ${Math.min(reads, order.target)}/${order.target}`;
      complete = defeated && reads >= order.target;
    } else if (order.id === "strong") {
      value = strong;
      compact = `HOT ${Math.min(strong, order.target)}/${order.target}`;
      complete = defeated && strong >= order.target;
    } else if (order.id === "speed") {
      value = spins;
      compact = spins > order.target ? `OVER ${spins}G` : `${spins}/${order.target}G`;
      complete = defeated && spins <= order.target;
    } else {
      value = attempts;
      compact = attempts === 0 ? "FIRST TRY READY" : attempts > order.target ? `TRY ${attempts}` : `TRY ${attempts}/1`;
      complete = defeated && attempts === order.target;
    }
    return deepFreeze({
      id: order.id,
      title: order.title,
      description: order.description,
      target: order.target,
      value: value,
      compact: compact,
      complete: complete,
    });
  }

  function royalReplayCommand(orderId, opponentId) {
    const order = ROYAL_REPLAY_ORDERS.find(function (entry) { return entry.id === orderId; });
    const opponent = TABLE_ORDER.find(function (entry) { return entry.id === opponentId; });
    if (!order || !opponent) return null;
    return deepFreeze({
      id: order.id,
      title: order.title,
      opponentId: opponent.id,
      encounterLine: `${opponent.name}が ${order.encounter}`,
      line: order.commandGoals[opponent.id],
    });
  }

  function royalReplayBossGoal(orderId, progress) {
    const order = ROYAL_REPLAY_ORDERS.find(function (entry) { return entry.id === orderId; });
    const current = progress && progress.id === orderId ? progress : null;
    if (!order || !current) return null;
    const qualified = order.id === "speed"
      ? current.value > 0 && current.value <= order.target
      : order.id === "first"
        ? current.value === order.target
        : current.value >= order.target;
    let line = `${current.compact}。最後はAを引いて勝とう！`;
    if (!qualified && order.id === "strong") line = `${current.compact}。READYを待ってAIMを決めよう！`;
    else if (qualified && order.id === "team") line = `${current.compact}。4人でAを引いて決めよう！`;
    else if (qualified && order.id === "read") line = `${current.compact}。読み切った。Aを引こう！`;
    else if (qualified && order.id === "strong") line = `${current.compact}。熱い流れをAで決めよう！`;
    else if (qualified && order.id === "speed") line = `${current.compact}。Aを引いて速攻を決めよう！`;
    else if (qualified && order.id === "first") line = `${current.compact}。この一戦でAを引いて決めよう！`;
    return deepFreeze({
      id: order.id,
      title: order.title,
      compact: current.compact,
      qualified: qualified,
      line: line,
    });
  }

  function royalReplayMilestone(beforeProgress, afterProgress) {
    const before = beforeProgress && typeof beforeProgress === "object" ? beforeProgress : null;
    const after = afterProgress && typeof afterProgress === "object" ? afterProgress : null;
    if (!before || !after || before.id !== after.id || after.value <= before.value) return null;

    let kind = "step";
    let text = "";
    if (after.id === "speed") {
      if (before.value <= after.target && after.value > after.target) {
        kind = "lost";
        text = `ORDER LIMIT OVER · OVER ${after.value}G`;
      } else {
        const checkpoint = [10, 20, 30, 40].find(function (value) {
          return before.value < value && after.value >= value;
        });
        if (!checkpoint) return null;
        kind = checkpoint === after.target ? "warning" : "step";
        text = checkpoint === after.target
          ? `FINAL WINDOW · ${checkpoint}/${after.target}G`
          : `QUICK DEAL · ${checkpoint}/${after.target}G`;
      }
    } else if (after.id === "first") {
      if (after.value === 1) {
        kind = "ready";
        text = "FIRST TRY ACTIVE · TRY 1/1";
      } else if (before.value <= 1 && after.value > 1) {
        kind = "lost";
        text = `ORDER LOST · TRY ${after.value}`;
      } else {
        return null;
      }
    } else {
      const beforeValue = Math.min(before.value, after.target);
      const afterValue = Math.min(after.value, after.target);
      if (afterValue <= beforeValue) return null;
      kind = afterValue >= after.target ? "ready" : "step";
      text = `${kind === "ready" ? "ORDER CONDITION MET" : "ORDER STEP"} · ${after.compact}`;
    }

    return deepFreeze({
      id: after.id,
      title: after.title,
      kind: kind,
      value: after.value,
      target: after.target,
      compact: after.compact,
      text: text,
    });
  }

  const ROYAL_REPLAY_ALL_CRESTS = (1 << ROYAL_REPLAY_ORDERS.length) - 1;

  function royalReplayCrestState(mask) {
    const normalisedMask = Math.max(0, Math.floor(Number(mask) || 0)) & ROYAL_REPLAY_ALL_CRESTS;
    const entries = ROYAL_REPLAY_ORDERS.map(function (order, index) {
      return {
        id: order.id,
        title: order.title,
        numeral: String(index + 1).padStart(2, "0"),
        earned: Boolean(normalisedMask & (1 << index)),
      };
    });
    const count = entries.reduce(function (total, entry) { return total + (entry.earned ? 1 : 0); }, 0);
    return deepFreeze({
      mask: normalisedMask,
      count: count,
      total: ROYAL_REPLAY_ORDERS.length,
      complete: normalisedMask === ROYAL_REPLAY_ALL_CRESTS,
      entries: entries,
    });
  }

  function awardRoyalReplayCrest(mask, orderId) {
    const index = ROYAL_REPLAY_ORDERS.findIndex(function (order) { return order.id === orderId; });
    if (index < 0) return null;
    const before = royalReplayCrestState(mask);
    const after = royalReplayCrestState(before.mask | (1 << index));
    return deepFreeze({
      id: orderId,
      first: before.mask !== after.mask,
      setCompleted: !before.complete && after.complete,
      state: after,
    });
  }

  return deepFreeze({
    TABLE_ORDER: TABLE_ORDER,
    BOSS_TABLE: BOSS_TABLE,
    FLAG_TRIGGER_TABLE: FLAG_TRIGGER_TABLE,
    TABLE_POKER_PERSONALITIES: TABLE_POKER_PERSONALITIES,
    TABLE_POKER_ACTION_LABELS: TABLE_POKER_ACTION_LABELS,
    TABLE_POKER_RECIPES: TABLE_POKER_RECIPES,
    NONE_POKER_VARIANTS: NONE_POKER_VARIANTS,
    FLAG_PRESENTATION_TABLE: FLAG_PRESENTATION_TABLE,
    MACHINE_PRESENTATION_BLUEPRINT: MACHINE_PRESENTATION_BLUEPRINT,
    PRESENTATION_COVERAGE: PRESENTATION_COVERAGE,
    PRESENTATION_COVERAGE_SUMMARY: PRESENTATION_COVERAGE_SUMMARY,
    BOSS_ATTACK_TABLE: BOSS_ATTACK_TABLE,
    REPLAY_LOOP: REPLAY_LOOP,
    READ_ASSIST: READ_ASSIST,
    NORMAL_CHANCE: NORMAL_CHANCE,
    settleNormalChance: settleNormalChance,
    ROYAL_REPLAY_ORDERS: ROYAL_REPLAY_ORDERS,
    PANYU_RESCUE_POLICY: PANYU_RESCUE_POLICY,
    NORMAL_FREQUENCY_TABLE: NORMAL_FREQUENCY_TABLE,
    tableAt: tableAt,
    tablePokerPreview: tablePokerPreview,
    initialState: initialState,
    preparationGain: preparationGain,
    settlePreparation: settlePreparation,
    nextResolveLevel: nextResolveLevel,
    bossAdvantage: bossAdvantage,
    resolveTableTurn: resolveTableTurn,
    settleReadAssist: settleReadAssist,
    settleOpponent: settleOpponent,
    frequencySummary: frequencySummary,
    royalReplayOrder: royalReplayOrder,
    royalReplayProgress: royalReplayProgress,
    royalReplayCommand: royalReplayCommand,
    royalReplayBossGoal: royalReplayBossGoal,
    royalReplayMilestone: royalReplayMilestone,
    royalReplayCrestState: royalReplayCrestState,
    awardRoyalReplayCrest: awardRoyalReplayCrest,
  });
}));
