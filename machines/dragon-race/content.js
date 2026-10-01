/* 原作の人物と場面を、独立したスロット台の演出へ対応させるデータ。 */
(function (root, factory) {
  "use strict";
  const common = typeof module === "object" && module.exports
    ? require("./presentation-contract.js") : root.MimiMachinePresentationBlueprint;
  const api = factory(common);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.MimiDragonRaceContent = api;
}(typeof globalThis !== "undefined" ? globalThis : this, function (common) {
  "use strict";

  function freeze(value) {
    if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
    Object.values(value).forEach(freeze);
    return Object.freeze(value);
  }

  const CAST = freeze({
    mimi: { name: "ミミ", role: "予想家・実況", source: "images/cast/mimi/mimi_buniqro_default.webp", rule: "竜に騎乗せず、観察と驚きと応援を担う" },
    sake: { name: "サケ", role: "竜王女", source: "images/cast/stand/sake.webp", rule: "息・脚・気配を短く断定する。ミミの敵にしない" },
    mizu: { name: "ミズ", role: "エコノミスト", source: "images/cast/stand/mizu.webp", rule: "人気と実力の違いを読む。表示用の架空オッズを配当にしない" },
    sumika: { name: "スミカ", role: "行政秘書", source: "images/cast/stand/sumika.webp", rule: "丁寧語で記録と暮らしを支える。ミミ様と呼ぶ" },
    makura: { name: "マクラ", role: "配信者", source: "images/cast/stand/makura.webp", rule: "推し竜と観客を盛り上げる。一人称はおれ" },
    celestia: { name: "セレスティア", role: "世界の天井", source: "images/cast/stand/celestia.webp", rule: "神眼は最後まで正確。予想を外す悪役・騎手に改変しない" },
  });

  // 原作の顔・衣装を参照した専用芝居。登場そのものを当選確定の合図にはしない。
  const CHARACTER_ART = freeze({
    sake: { image: "./machines/dragon-race/assets/characters-v1/sake-race-v1.png", line: "最後の脚を\n見とけ。", accent: "#ecbd72" },
    mizu: { image: "./machines/dragon-race/assets/characters-v1/mizu-race-v1.png", line: "見落とされて\nいるだけよ。", accent: "#75cbe7" },
    sumika: { image: "./machines/dragon-race/assets/characters-v1/sumika-race-v1.png", line: "ミミ様、\nここからです。", accent: "#92d0a8" },
    makura: { image: "./machines/dragon-race/assets/characters-v1/makura-race-v1.png", line: "おれたちの声、\n届け！", accent: "#d1a4f8" },
  });

  // 同行順は原作の登場順。STACKやBET COINを名前だけ替えて流用しない。
  const JOURNEY = freeze([
    { id: "sake", sourceChapter: "1", theme: "竜の走りを知る", line: "息を見ろ。", goal: "どの竜が伸びるか、見てみます！" },
    { id: "mizu", sourceChapter: "2", theme: "人気と実力を読む", line: "人気と実力は、同じではないわ。", goal: "みんなが見落とした竜を探します！" },
    { id: "sumika", sourceChapter: "3", theme: "記録と暮らし", line: "ミミ様、今日の一戦も記録に残しましょう。", goal: "外れた理由も、覚えておきます！" },
    { id: "makura", sourceChapter: "4", theme: "推し竜と配信", line: "ここが見せ場だよ！　推しの名前叫べ！", goal: "最後の直線まで、応援します！" },
  ]);

  // 原作 data_dragons.js の名前。配当ではなく、応援対象を見失わないための表示。
  const DRAGONS = freeze({ rubel: "ルベル", seram: "セラム", miruka: "ミルカ",
    rosso: "ロッソ", gando: "ガンド", phenix: "フェニックス", goka: "ゴウカ", glaze: "グレイズ" });
  // 原作data_dragons.jsの実数。順は速度・スタミナ・旋回・翼・火力・気性。
  // 途中の走りと観察図鑑に使用。スロットの抽選・最終着順・配当は変えない。
  const DRAGON_FORM = freeze({
    rubel: { style: "front", trait: "逃げ", specialty: "出足", stats: [88,82,55,70,78,65] },
    seram: { style: "chase", trait: "差し", specialty: "追い風", stats: [72,78,68,90,40,72] },
    miruka: { style: "chase", trait: "差し", specialty: "霧", stats: [70,68,75,55,35,88] },
    rosso: { style: "chase", trait: "差し", specialty: "旋回", stats: [74,70,92,58,55,70] },
    gando: { style: "duel", trait: "先行", specialty: "持久力", stats: [60,92,62,50,65,78] },
    phenix: { style: "duel", trait: "先行", specialty: "炎と翼", stats: [90,85,70,88,90,75] },
    glaze: { style: "duel", trait: "先行", specialty: "耐久", stats: [70,92,80,65,45,90] },
    // 神眼専用の別数理。通常能力値を捏造して共用しない。
    goka: { style: "duel", trait: "業火の癇癪", specialty: "抜かれると奮起", stats: null },
  });
  // data_courses.js / data_races.jsの区間・能力重み。
  const TRACK_SECTIONS = freeze({
    start: { label: "発走", weights: [.35,.10,.10,.10,.15,.20] },
    narrow: { label: "狭路", weights: [.15,.10,.25,.10,.10,.30] },
    wind: { label: "上空風路", weights: [.10,.15,.10,.40,.05,.20] },
    turns: { label: "小回り", weights: [.15,.15,.40,.05,.05,.20] },
    rolling: { label: "起伏地帯", weights: [.15,.35,.15,.05,.10,.20] },
    straight: { label: "最終直線", weights: [.30,.25,.05,.25,.05,.10] },
    tailwind: { label: "追い風", weights: [.25,.20,.05,.35,.05,.10] },
    turn: { label: "最終旋回", weights: [.10,.20,.35,.10,.05,.20] },
  });
  const TRACKS = freeze([
    { id: "race_lapan_festival", name: "ラパン", weather: "clear", sections: ["start","wind","straight"] },
    { id: "race_vento_1", name: "ヴェント", weather: "strong_wind", sections: ["start","wind","tailwind"] },
    { id: "race_ringrosso_1", name: "リングロッソ", weather: "clear", sections: ["narrow","turns","turn"] },
    { id: "race_lapan_shinto_grand", name: "大競走場", weather: "clear", sections: ["start","rolling","tailwind"] },
  ]);
  // 観戦の展開差。位置は画面内の先端位置の比率で、確率・着順抽選ではない。
  const RACE_STYLES = freeze([
    { id: "front", label: "先行勝負", calls: ["先手を取った！", "後ろが迫る！", "このまま逃げ切れ！", "ゴール判定"],
      fronts: [[.43,.61,.26],[.56,.65,.39],[.69,.74,.55],[.81,.83,.78]] },
    { id: "chase", label: "追い込み勝負", calls: ["後方から脚をためる", "外へ持ち出した！", "前を捉えろ！", "ゴール判定"],
      fronts: [[.65,.27,.46],[.63,.46,.57],[.71,.68,.59],[.82,.81,.79]] },
    { id: "duel", label: "競り合い勝負", calls: ["三頭が並んで発走", "先頭を奪い合う！", "最後のひと伸び！", "ゴール判定"],
      fronts: [[.52,.49,.56],[.59,.62,.55],[.71,.70,.67],[.81,.82,.80]] },
  ]);
  const INTRO = freeze({
    sake: ["ミミ、まずはこの競走を見ろ。注目竜の好走が、リールのチャンスだ。", "竜は私の応援相手。３つのSTOPで走りを見届けます！"],
    mizu: ["次は私と観戦しましょう。人気の陰に、伸びる竜がいるわ。", "注目竜が追い上げたら、リールにも注目です！"],
    sumika: ["ミミ様、当たった走りを記録しましょう。記録が次の会場への道になります。", "配当と一緒に観察を進めて、大レースを目指します！"],
    makura: ["次はおれと応援だ！　最後の直線で抜き返す瞬間、見逃すなよ！", "最後の直線まで、みんなを応援します！"],
  });

  const FINALE = freeze({
    id: "shingan", sourceChapter: "5", opponentId: "celestia",
    // rosterは原作資料。ユーザー指示でこの台の表示からポロを除外した。
    roster: ["goka", "raiou", "souten", "yomi", "phenix", "fugaku", "glaze", "poro"],
    displayRoster: ["goka", "phenix", "glaze"],
    sourceTieToleranceSeconds: 0.10,
    conclusion: "三頭同着", predictionRemainsCorrect: true,
    // 原作の0.10秒パズルをスロットの抽選・数値へ輸入しない。
    slotTranslation: "共通ゲーム側の確定した最終勝利を、隕石を竜の疾走で突き破る比喩として表現。原作の結末は画面で説明しない",
    source: "js/shingan_race.js",
  });

  const PHASES = freeze({
    normal: ["dragon.normal.enter", "dragon.normal.hit", "dragon.normal.miss", "dragon.normal.replay"],
    trial: ["dragon.trial.enter", "dragon.trial.progress", "dragon.trial.success", "dragon.trial.fail", "dragon.trial.revive"],
    bonus: ["dragon.bonus.enter", "dragon.bonus.progress", "dragon.bonus.exit"],
    boss: ["dragon.boss.enter", "dragon.boss.tell", "dragon.boss.hit", "dragon.boss.critical", "dragon.boss.guard", "dragon.boss.miss", "dragon.boss.retry", "dragon.boss.win"],
    reward: ["dragon.reward.enter", "dragon.reward.complete"],
  });

  // 小役の数値はここに複製しない。9役との対応だけを持つ。
  // 各行のモチーフはスロット化の制作案であり、原作の固有技名ではない。
  const ROLE_ROWS = [
    ["none", 1, "sake", "seram", "quiet-paddock", "course-read", "走りを観察", "dragon.boss.miss"],
    ["replay", 2, "mimi", "seram", "return-wind", "steady-return", "もう一度応援", "dragon.boss.guard"],
    ["cherry", 2, "mimi", "rosso", "turn-step", "inside-turn", "旋回の一歩", "dragon.boss.hit"],
    ["bell", 2, "sake", "rubel", "starting-bell", "front-run", "出足を読む", "dragon.boss.hit"],
    ["grape", 3, "mizu", "miruka", "mist-read", "hidden-contender", "人気の陰を読む", "dragon.boss.hit"],
    ["watermelon", 3, "sumika", "rosso", "turn-line", "inside-turn", "旋回を記録", "dragon.boss.hit"],
    ["bar", 4, "makura", "gando", "grandstand-roar", "crowd-spurt", "推し竜の見せ場", "dragon.boss.critical"],
    ["seven_blue", 4, "mimi", "seram", "blue-tailwind", "wing-spurt", "追い風の直線", "dragon.boss.critical"],
    ["seven_red", 5, "mimi", "phenix", "dawn-wings", "finish-flash", "夜明けの大歓声", "dragon.boss.critical"],
  ];

  const MACHINE = common.defineMachine({
    machineId: "dragon-race", conceptId: "mimi-dragon-race-journey",
    title: "ミミのドラゴンレース紀行",
    direction: { player: "left", opponent: "right", progression: "left-to-right" },
    spinSequence: common.SPIN_SEQUENCE,
    phases: PHASES,
    flagOrder: ROLE_ROWS.map(function (row) { return row[0]; }),
    flags: Object.fromEntries(ROLE_ROWS.map(function (row) {
      const [id, heat, actorId, dragonId, anticipationFamily, resultFamily, technique, route] = row;
      return [id, {
        heat, trigger: { source: "slot-core.FLAG_TABLES", flagId: id, secondRoll: false },
        motif: { kind: "race", dragonId, stages: ["paddock", "start", "final-turn", "photo-finish", "verdict"] },
        normal: { anticipationFamily, resultFamily, scenePolicy: heat < 3 ? "reel-local" : "settled-semantic" },
        boss: { route, actorId, speaker: CAST[actorId].name, technique },
        readiness: { logic: "shared", stopSequence: "ready", normalMotion: "shared", normalArt: "deferred", bossMotion: "shared", audio: "shared" },
        nextUpgrade: "現行V5の回胴イベントに接続し、原作素材で停止別の表示を検証する",
      }];
    })),
  });

  function validateCore(core) {
    if (!core || !core.FLAG_TABLES || !Array.isArray(core.FLAG_TABLES.normal)) throw new Error("SlotCore.FLAG_TABLES.normal が必要です");
    const ids = core.FLAG_TABLES.normal.map(function (row) { return row[0]; });
    if (ids.length !== MACHINE.flagOrder.length || new Set(ids).size !== ids.length || ids.some(function (id) { return !Object.hasOwn(MACHINE.flags, id); })) {
      throw new Error("回胴とドラゴンレース台の内部役が一致しません");
    }
    return true;
  }

  return freeze({ CAST, CHARACTER_ART, JOURNEY, DRAGONS, DRAGON_FORM, TRACKS, TRACK_SECTIONS, RACE_STYLES, INTRO, FINALE, PHASES, MACHINE, validateCore, coverage: common.coverageSummary(MACHINE) });
}));
