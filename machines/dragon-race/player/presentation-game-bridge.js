(function (root, factory) {
  "use strict";

  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.MimiPresentationGameBridge = api;

  if (root && root.document && new URLSearchParams(root.location.search).get("machine") !== "dragon-race") {
    const mount = function () {
      if (root.__mimiPresentationGameBridge) return;
      root.__mimiPresentationGameBridge = api.createGamePresentationBridge({
        window: root,
        document: root.document,
      });
    };
    if (root.document.readyState === "loading") {
      root.document.addEventListener("DOMContentLoaded", mount, { once: true });
    } else {
      mount();
    }
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const EFFECT_IDS = Object.freeze([
    "notice",
    "chance",
    "hot",
    "goldenGate",
    "boss",
    "revive",
    "bonus",
    "jackpot",
  ]);
  const PRESENTATION_LIFECYCLE_EVENT = "mimi:presentation-lifecycle";

  const EFFECT_PRIORITY = Object.freeze({
    notice: 10,
    chance: 20,
    hot: 30,
    boss: 40,
    revive: 45,
    goldenGate: 50,
    bonus: 60,
    jackpot: 100,
  });

  const ART_ASSETS = Object.freeze({
    notice: "./assets/effects/v5-candidates/notice.png",
    chance: "./assets/effects/v5-candidates/chance_treasure_v2.png",
    hot: "./assets/effects/v5-candidates/hot.png",
    goldenGate: "./assets/effects/v5-candidates/golden_gate.png",
    boss: "./assets/effects/v5-candidates/boss.png",
    revive: "./assets/effects/v5-candidates/revive.png",
    bonus: "./assets/effects/v5-candidates/bonus_treasure_v2.png",
    chancePoker: "./assets/characters/boss-states-v5-candidates/card_shark/final/cardFan.png",
    bonusPoker: "./assets/characters/boss-states-v5-candidates/card_shark/final/cardFan.png",
    chanceRace: "./assets/characters/boss-states-v5-candidates/tears_storm/final/stormRing.png",
    bonusRace: "./assets/characters/boss-states-v5-candidates/tears_storm/final/stormRing.png",
    jackpot: "./assets/effects/v5-candidates/jackpot.png",
  });

  const TREASURE_ROLE_ASSETS = Object.freeze({
    none: "./assets/chapter1-motifs/mimi-poker-card-back-source.png",
    replay: "./assets/generated/v3/symbols/dist/replay.png",
    cherry: "./assets/generated/v3/symbols/dist/cherry.png",
    bell: "./assets/generated/v3/symbols/dist/bell.png",
    grape: "./assets/generated/v3/symbols/dist/grape.png",
    watermelon: "./assets/generated/v3/symbols/dist/watermelon.png",
    bar: "./assets/generated/v3/symbols/dist/bar.png",
    seven_blue: "./assets/generated/v3/symbols/dist/seven_blue.png",
    seven_red: "./assets/generated/v3/symbols/dist/seven_red.png",
  });

  const TREASURE_TABLE_HIT_TIMELINES = Object.freeze({
    3: Object.freeze({ beats: Object.freeze([260, 360, 420, 520, 700]), reducedBeats: Object.freeze([420, 560, 700]) }),
    4: Object.freeze({ beats: Object.freeze([360, 480, 620, 720, 900]), reducedBeats: Object.freeze([520, 720, 900]) }),
    5: Object.freeze({ beats: Object.freeze([480, 620, 760, 900, 1200]), reducedBeats: Object.freeze([620, 900, 1200]) }),
  });

  function treasureTableHitTimeline(payload) {
    const heat = Math.max(3, Math.min(5, Number(payload && payload.heat) || 3));
    return TREASURE_TABLE_HIT_TIMELINES[heat];
  }

  const TREASURE_BOSS_ENTRY_TIMELINES = Object.freeze({
    first: Object.freeze({ beats: Object.freeze([900, 1300, 1500, 2000]), reducedBeats: Object.freeze([900, 1200, 1000]) }),
    retry: Object.freeze({ beats: Object.freeze([400, 600, 800, 1000]), reducedBeats: Object.freeze([500, 650, 750]) }),
  });

  function isTreasureBossRetry(payload) {
    return Number(payload && payload.attempt) > 1;
  }

  function treasureBossEntryTimeline(payload) {
    return isTreasureBossRetry(payload)
      ? TREASURE_BOSS_ENTRY_TIMELINES.retry
      : TREASURE_BOSS_ENTRY_TIMELINES.first;
  }

  function treasureBossEntryHeadline(payload) {
    return isTreasureBossRetry(payload)
      ? "ヴェルベットと 再戦！"
      : "ヴェルベットが あらわれた！";
  }

  const TREASURE_BOSS_ATTACK_TIMELINES = Object.freeze({
    first: Object.freeze({ beats: Object.freeze([700, 1000, 1500, 1500]), reducedBeats: Object.freeze([700, 1100, 900]) }),
    repeat: Object.freeze({ beats: Object.freeze([350, 550, 900, 1000]), reducedBeats: Object.freeze([500, 650, 750]) }),
  });

  function isRepeatedTreasureBossAttack(payload) {
    return Number(payload && payload.attempt) > 1 || Number(payload && payload.turn) > 1;
  }

  function treasureBossAttackTimeline(payload) {
    return isRepeatedTreasureBossAttack(payload)
      ? TREASURE_BOSS_ATTACK_TIMELINES.repeat
      : TREASURE_BOSS_ATTACK_TIMELINES.first;
  }

  const TREASURE_BOSS_ATTACK_WARNINGS = Object.freeze([
    Object.freeze({ cast: "selina", speaker: "セリナ", headline: "反撃が来るよ！" }),
    Object.freeze({ cast: "rico", speaker: "リコ先輩", headline: "レイズを読んで！" }),
    Object.freeze({ cast: "polka", speaker: "ポルカ", headline: "まだ降りないよ！" }),
    Object.freeze({ cast: "grano", speaker: "グラーノ", headline: "ここは耐えて。" }),
  ]);

  function treasureBossAttackWarning(payload) {
    const turn = Math.max(1, Math.floor(Number(payload && payload.turn) || 1));
    return TREASURE_BOSS_ATTACK_WARNINGS[(turn - 1) % TREASURE_BOSS_ATTACK_WARNINGS.length];
  }

  const TREASURE_BONUS_PROGRESS_TIMELINES = Object.freeze({
    routine: Object.freeze({ beats: Object.freeze([160, 200, 250, 290]), reducedBeats: Object.freeze([200, 250, 300]) }),
    first: Object.freeze({ beats: Object.freeze([250, 300, 400, 450]), reducedBeats: Object.freeze([250, 300, 350]) }),
    half: Object.freeze({ beats: Object.freeze([250, 350, 450, 550]), reducedBeats: Object.freeze([300, 350, 400]) }),
    final: Object.freeze({ beats: Object.freeze([300, 400, 500, 600]), reducedBeats: Object.freeze([350, 400, 450]) }),
  });

  function treasureBonusProgressMilestone(payload) {
    const games = Math.max(0, Number(payload && payload.games) || 0);
    if (games === 9) return "first";
    if (games === 5) return "half";
    if (games === 1) return "final";
    return "routine";
  }

  function treasureBonusProgressTimeline(payload) {
    return TREASURE_BONUS_PROGRESS_TIMELINES[treasureBonusProgressMilestone(payload)];
  }

  function treasureBonusProgressHeadline(payload) {
    const games = Math.max(0, Number(payload && payload.games) || 0);
    const milestone = treasureBonusProgressMilestone(payload);
    if (milestone === "first") return "1灯目！ 残り9G";
    if (milestone === "half") return "5灯！ 折り返し";
    if (milestone === "final") return "あと1灯！";
    return `残り${games}G`;
  }

  function treasureBonusProgressLine(payload) {
    const milestone = treasureBonusProgressMilestone(payload);
    if (milestone === "half") return "ロイヤルポットが輝く！";
    if (milestone === "final") return "最後のランプへ！";
    const heat = Math.max(1, Math.min(5, Number(payload && payload.heat) || 1));
    return heat >= 5 ? "大きな光……！" : heat >= 4 ? "熱くなってきた！" : "";
  }

  // Chapter 1 presentation is authored as discrete scenes. The game runtime
  // only emits a scene id and values; copy, effect family, and the next action
  // live here so reel/economy code never becomes the presentation script.
  const TREASURE_SCENE_DEFINITIONS = Object.freeze({
    "treasure.normal.event": Object.freeze({
      effectId: "notice",
      timeline: Object.freeze({ beats: Object.freeze([360, 620, 900]), reducedBeats: Object.freeze([520, 900]) }),
      speaker: function (payload) { return payload.speaker || "ミミ"; },
      headline: function (payload) { return payload.headline || ""; },
      line: function (payload) { return payload.line || ""; },
      nextAction: "SPIN",
    }),
    "treasure.table.enter": Object.freeze({
      effectId: "notice",
      timeline: Object.freeze({ beats: Object.freeze([520, 900, 1200]), reducedBeats: Object.freeze([620, 1000]) }),
      speaker: "対戦",
      headline: function (payload) { return `${payload.opponentName || "対戦相手"}が あらわれた！`; },
      line: "",
      nextAction: "SPIN",
    }),
    "treasure.table.hit": Object.freeze({
      effectId: "chance",
      timeline: treasureTableHitTimeline,
      speaker: "ミミ",
      headline: function (payload) {
        const heat = Math.max(3, Math.min(5, Number(payload.heat) || 3));
        return heat >= 5 ? "激熱！" : heat >= 4 ? "大チャンス！" : "好機！";
      },
      line: "",
      nextAction: "SPIN",
    }),
    "treasure.table.clear": Object.freeze({
      effectId: "bonus",
      timeline: Object.freeze({ beats: Object.freeze([360, 720, 980, 1500]), reducedBeats: Object.freeze([620, 980, 1100]) }),
      speaker: function (payload) { return payload.opponentName || "対戦相手"; },
      headline: function (payload) { return payload.newlyPrepared ? `${payload.opponentName || "仲間"} 連携READY！` : payload.clearLine || "勝負あり！"; },
      line: "",
      nextAction: "",
    }),
    "treasure.character.emotion": Object.freeze({
      effectId: "chance",
      timeline: Object.freeze({ beats: Object.freeze([220, 320, 620, 980, 1280]), reducedBeats: Object.freeze([620, 980, 1280]) }),
      speaker: function (payload) { return String(payload.characterId || "mimi").toUpperCase(); },
      headline: function (payload) { return String(payload.emotionId || "smug").toUpperCase(); },
      line: "",
      nextAction: "",
    }),
    "treasure.trial.enter": Object.freeze({
      effectId: "chance",
      timeline: Object.freeze({ beats: Object.freeze([650, 720, 780, 900, 1150]), reducedBeats: Object.freeze([720, 900, 1050]) }),
      speaker: "ミミ",
      headline: "3つ灯せば BONUS！",
      line: "",
      nextAction: "SPIN",
    }),
    "treasure.trial.progress": Object.freeze({
      effectId: "chance",
      timeline: Object.freeze({ beats: Object.freeze([520, 650, 720, 850, 1050]), reducedBeats: Object.freeze([650, 850, 950]) }),
      speaker: "ミミ",
      headline: function (payload) {
        const score = Math.max(0, Number(payload.score) || 0);
        return score >= 2 ? "あと1つ！" : score >= 1 ? "1つ点灯！" : "ランプを狙え！";
      },
      line: "",
      nextAction: "SPIN",
    }),
    "treasure.trial.success": Object.freeze({
      effectId: "bonus",
      timeline: Object.freeze({ beats: Object.freeze([700, 950, 1250, 1550]), reducedBeats: Object.freeze([700, 900, 850]) }),
      speaker: "ミミ",
      headline: "VIP卓 開放！",
      line: "",
      nextAction: "BONUS",
    }),
    "treasure.trial.revive": Object.freeze({
      effectId: "revive",
      timeline: Object.freeze({ beats: Object.freeze([720, 1050, 1450]), reducedBeats: Object.freeze([900, 1300]) }),
      speaker: "ミミ",
      headline: "逆転！ VIP卓 開放！",
      line: "",
      nextAction: "BONUS",
    }),
    "treasure.trial.fail": Object.freeze({
      effectId: "notice",
      timeline: Object.freeze({ beats: Object.freeze([680, 900, 1300]), reducedBeats: Object.freeze([820, 1200]) }),
      speaker: "ミミ",
      headline: "次の勝負へ！",
      line: "",
      nextAction: "SPIN",
    }),
    "treasure.bonus.enter": Object.freeze({
      effectId: "bonus",
      timeline: Object.freeze({ beats: Object.freeze([600, 750, 900, 1050]), reducedBeats: Object.freeze([600, 700, 700]) }),
      speaker: "ミミ",
      headline: function (payload) { return payload.origin === "boss-victory" ? "ロイヤルポット獲得！" : "10G、スタート！"; },
      line: "",
      nextAction: function (payload) { return payload.origin === "boss-victory" ? "" : "SPIN"; },
    }),
    "treasure.bonus.progress": Object.freeze({
      effectId: "bonus",
      timeline: treasureBonusProgressTimeline,
      speaker: "ミミ",
      headline: treasureBonusProgressHeadline,
      line: treasureBonusProgressLine,
      nextAction: "SPIN",
    }),
    "treasure.bonus.exit": Object.freeze({
      effectId: "bonus",
      timeline: Object.freeze({ beats: Object.freeze([550, 700, 850, 950]), reducedBeats: Object.freeze([550, 650, 650]) }),
      speaker: "ミミ",
      headline: function (payload) { return payload.origin === "boss-victory" ? "ロイヤルポット獲得！" : `${payload.opponentName ? `${payload.opponentName}の卓` : "対戦卓"}へ戻ろう！`; },
      line: "",
      nextAction: "",
    }),
    "treasure.boss.tell": Object.freeze({
      effectId: "boss",
      timeline: Object.freeze({ beats: Object.freeze([550, 800, 1100, 1500]), reducedBeats: Object.freeze([550, 850, 800]) }),
      speaker: "ミミ",
      headline: function (payload) {
        return ["", "Aを引けば勝ち！", "好機！ Aを引け！", "チャンス！ Aを引け！", "大チャンス！ Aを引け！", "激熱！ Aで決めろ！"][Math.max(1, Math.min(5, Number(payload.heat) || 1))];
      },
      line: "",
      nextAction: "STOP",
    }),
    "treasure.boss.enter": Object.freeze({
      effectId: "boss",
      timeline: treasureBossEntryTimeline,
      speaker: "対戦",
      headline: treasureBossEntryHeadline,
      line: "",
      nextAction: "",
    }),
    "treasure.boss.attack": Object.freeze({
      effectId: "boss",
      timeline: treasureBossAttackTimeline,
      speaker: "ヴェルベット",
      headline: "ヴェルベットの反撃！",
      line: "",
      nextAction: "",
    }),
    "treasure.boss.counterCritical": Object.freeze({
      effectId: "boss",
      timeline: Object.freeze({ beats: Object.freeze([650, 950, 1500, 1500]), reducedBeats: Object.freeze([650, 1000, 900]) }),
      speaker: "ヴェルベット",
      headline: "大ピンチ！",
      line: "",
      nextAction: "",
    }),
    "treasure.boss.revive": Object.freeze({
      effectId: "revive",
      timeline: Object.freeze({ beats: Object.freeze([700, 1400, 1500]), reducedBeats: Object.freeze([1000, 1300]) }),
      speaker: function (payload) { return payload.rescueSpeaker || "ポルカ"; },
      headline: "ミミ、まだいける！",
      line: "",
      nextAction: "",
    }),
    "treasure.boss.guard": Object.freeze({
      effectId: "boss",
      timeline: Object.freeze({ beats: Object.freeze([650, 900, 1200, 1400]), reducedBeats: Object.freeze([650, 950, 850]) }),
      speaker: "ミミ",
      headline: "よける！",
      line: "",
      nextAction: "",
    }),
    "treasure.boss.hit": Object.freeze({
      effectId: "boss",
      timeline: Object.freeze({ beats: Object.freeze([700, 1000, 1500, 1500]), reducedBeats: Object.freeze([700, 1100, 900]) }),
      speaker: function (payload) { return payload.attackSpeaker || "ミミ"; },
      headline: function (payload) { return payload.technique || "チップを削る！"; },
      line: "",
      nextAction: "",
    }),
    "treasure.boss.critical": Object.freeze({
      effectId: "boss",
      timeline: Object.freeze({ beats: Object.freeze([700, 1100, 1600, 1600]), reducedBeats: Object.freeze([700, 1200, 900]) }),
      speaker: function (payload) { return payload.attackSpeaker || "ミミ"; },
      headline: function (payload) { return payload.technique || "会心の一撃！"; },
      line: "",
      nextAction: "",
    }),
    "treasure.boss.timeout": Object.freeze({
      effectId: "boss",
      timeline: Object.freeze({ beats: Object.freeze([800, 1100, 1500, 1800]), reducedBeats: Object.freeze([800, 1100, 900]) }),
      speaker: "ヴェルベット",
      headline: "Aを引くまで、勝負！",
      line: "",
      nextAction: "",
    }),
    "treasure.boss.retry": Object.freeze({
      effectId: "boss",
      timeline: Object.freeze({ beats: Object.freeze([700, 1000, 1300, 1700]), reducedBeats: Object.freeze([700, 1000, 900]) }),
      speaker: "ポルカ",
      headline: function (payload) { return Number(payload.resolveLevel) > 0 ? `再戦POWER Lv.${Math.min(3, Number(payload.resolveLevel))}！` : "次こそAを引こう！"; },
      line: "",
      nextAction: "",
    }),
    "treasure.boss.win": Object.freeze({
      effectId: "bonus",
      timeline: Object.freeze({
        beats: Object.freeze([900, 1200, 1600, 2200]),
        reducedBeats: Object.freeze([900, 1300, 1100]),
      }),
      speaker: "ミミ",
      headline: "ロイヤルストレートフラッシュ！",
      line: "",
      nextAction: "",
    }),
    "treasure.reward": Object.freeze({
      effectId: "bonus",
      timeline: Object.freeze({
        beats: Object.freeze([800, 1100, 1500, 2200]),
        reducedBeats: Object.freeze([800, 1200, 1000]),
      }),
      speaker: "グラーノ",
      headline: "BONUS 10G 獲得！",
      line: "",
      nextAction: "",
    }),
  });

  // Semantic scenes are not single pictures. Each controller beat resolves to
  // one cumulative snapshot so pause, seek, reduced motion, and verification
  // all reproduce the same authored moment without another timer or rAF loop.
  const TREASURE_SCENE_BEAT_PLANS = Object.freeze({
    "treasure.normal.event": Object.freeze([
      Object.freeze({ id: "camera", focus: "wide", cast: function (payload) { return payload.actor || "mimi"; }, impact: "none", level: function (payload) { return payload.heat || 2; }, phase: "anticipation", call: "" }),
      Object.freeze({ id: "resolve", focus: "wide", cast: function (payload) { return payload.actor || "mimi"; }, impact: function (payload) { return payload.event || "notice"; }, level: function (payload) { return payload.heat || 2; }, phase: "resolve", call: "", copy: Object.freeze({ speaker: function (payload) { return payload.speaker || "ミミ"; }, headline: function (payload) { return payload.headline || ""; }, line: function (payload) { return payload.line || ""; }, nextAction: "SPIN" }) }),
      Object.freeze({ id: "hold", focus: "wide", cast: function (payload) { return payload.actor || "mimi"; }, impact: "ready", level: function (payload) { return payload.heat || 2; }, phase: "hold", call: "" }),
    ]),
    "treasure.table.enter": Object.freeze([
      Object.freeze({ id: "camera", focus: "wide", cast: "mimi", impact: "silence", level: 2, phase: "freeze", call: "対戦！", copy: Object.freeze({ speaker: "対戦", headline: function (payload) { return `${payload.opponentName || "対戦相手"}が あらわれた！`; }, line: "", nextAction: "" }) }),
      Object.freeze({ id: "reveal", focus: "right", cast: function (payload) { return payload.opponentId || "rico"; }, impact: "deal", level: 3, phase: "reveal", call: "", copy: Object.freeze({ speaker: function (payload) { return payload.opponentName || "対戦相手"; }, headline: function (payload) { return payload.opponentLine || "勝負を始めましょう"; }, line: "", nextAction: "" }) }),
      Object.freeze({ id: "hold", focus: "wide", cast: "mimi", impact: "ready", level: 3, phase: "hold", call: "勝負！", copy: Object.freeze({ speaker: "ミミ", headline: function (payload) { return payload.goalLine || `${payload.opponentName || "対戦相手"}に勝とう！`; }, line: "", nextAction: "SPIN" }) }),
    ]),
    "treasure.table.hit": Object.freeze([
      Object.freeze({ id: "camera", focus: "wide", cast: "mimi", impact: "none", level: function (payload) { return payload.heat || 3; }, phase: "anticipation", call: function (payload) { const heat = Number(payload.heat) || 3; return heat >= 5 ? "激熱！" : heat >= 4 ? "大チャンス！" : "好機！"; } }),
      Object.freeze({ id: "impact", focus: "right", cast: "mimi", impact: "call", level: function (payload) { return payload.heat || 3; }, phase: "action", call: function (payload) { return `STACK -${Math.max(1, Number(payload.damage) || 1)}`; }, copy: Object.freeze({ speaker: "ミミ", headline: function (payload) { const heat = Number(payload.heat) || 3; return heat >= 5 ? "激熱！" : heat >= 4 ? "大チャンス！" : "好機！"; }, line: "", nextAction: "SPIN" }) }),
      Object.freeze({ id: "hold", focus: "wide", cast: "mimi", impact: "ready", level: function (payload) { return payload.heat || 3; }, phase: "hold", call: "" }),
    ]),
    "treasure.table.clear": Object.freeze([
      Object.freeze({ id: "camera", focus: "right", cast: function (payload) { return payload.opponentId || "rico"; }, impact: "silence", level: 3, phase: "freeze", call: "勝負あり！" }),
      Object.freeze({ id: "plead", focus: "right", cast: function (payload) { return payload.opponentId || "rico"; }, impact: "silence", level: 4, phase: "reveal", call: "WAIT..." }),
      Object.freeze({ id: "tantrum", focus: "right", cast: function (payload) { return payload.opponentId || "rico"; }, impact: "critical", level: 5, phase: "action", call: "NOOO!" }),
      Object.freeze({ id: "coin", focus: "wide", cast: function (payload) { return payload.opponentId || "rico"; }, impact: "payout", level: 4, phase: "resolve", call: function (payload) { return payload.newlyPrepared ? "BET COIN · 連携READY！" : "BET COIN 獲得！"; }, copy: Object.freeze({ speaker: function (payload) { return payload.opponentName || "対戦相手"; }, headline: function (payload) { return payload.newlyPrepared ? "ボス戦の連携が強くなった！" : payload.clearLine || "勝負あり！"; }, line: "", nextAction: "" }) }),
    ]),
    "treasure.character.emotion": Object.freeze([
      Object.freeze({ id: "snap", focus: "wide", cast: function (payload) { return payload.characterId || "mimi"; }, impact: "silence", level: 3, phase: "freeze", call: "" }),
      Object.freeze({ id: "blank", focus: "right", cast: function (payload) { return payload.characterId || "mimi"; }, impact: "silence", level: 4, phase: "freeze", call: "" }),
      Object.freeze({ id: "face", focus: "right", cast: function (payload) { return payload.characterId || "mimi"; }, impact: "call", level: 4, phase: "reveal", call: function (payload) { return String(payload.emotionId || "smug").toUpperCase(); } }),
      Object.freeze({ id: "body", focus: "wide", cast: function (payload) { return payload.characterId || "mimi"; }, impact: "critical", level: 5, phase: "action", call: "" }),
      Object.freeze({ id: "hold", focus: "wide", cast: function (payload) { return payload.characterId || "mimi"; }, impact: "ready", level: 4, phase: "hold", call: "" }),
    ]),
    "treasure.trial.enter": Object.freeze([
      Object.freeze({ id: "camera", focus: "keys", reveal: 0, cast: "mimi", impact: "none", level: function (payload) { return payload.heat || 2; }, phase: "anticipation", call: "チャンス！", copy: Object.freeze({ speaker: "ミミ", headline: "3つ灯せば BONUS！", line: "", nextAction: "" }) }),
      Object.freeze({ id: "scatter", focus: "keys", reveal: 0, cast: "mimi", impact: "scatter", level: function (payload) { return payload.heat || 2; }, phase: "warning", call: "3 LIGHTS", copy: Object.freeze({ speaker: "ミミ", headline: "ランプを狙え！", line: "", nextAction: "" }) }),
      Object.freeze({ id: "glow", focus: "keys", reveal: 0, cast: "mimi", impact: "charge", level: function (payload) { return payload.heat || 2; }, phase: "reveal", call: "勝負！", copy: Object.freeze({ speaker: "ミミ", headline: "1つ目を狙え！", line: "", nextAction: "" }) }),
      Object.freeze({ id: "ready", focus: "keys", reveal: 0, cast: "mimi", impact: "ready", level: function (payload) { return payload.heat || 2; }, phase: "resolve", call: "SPIN！", copy: Object.freeze({ speaker: "ミミ", headline: "勝負！", line: "", nextAction: "SPIN" }) }),
      Object.freeze({ id: "hold", focus: "wide", reveal: 0, cast: "mimi", impact: "ready", level: function (payload) { return payload.heat || 2; }, phase: "hold", call: "SPIN" }),
    ]),
    "treasure.trial.progress": Object.freeze([
      Object.freeze({ id: "camera", focus: "keys", reveal: function (payload) { return payload.score || 0; }, cast: "mimi", impact: "none", level: function (payload) { return payload.heat || 2; }, phase: "anticipation", call: "LIGHT" }),
      Object.freeze({ id: "charge", focus: "keys", reveal: function (payload) { return payload.score || 0; }, cast: "mimi", impact: "charge", level: function (payload) { return payload.heat || 2; }, phase: "reveal", call: "+1", copy: Object.freeze({ speaker: "ミミ", headline: function (payload) { return Number(payload.score) >= 2 ? "あと1つ！" : Number(payload.score) >= 1 ? "1つ点灯！" : "次を狙え！"; }, line: "", nextAction: "" }) }),
      Object.freeze({ id: "spark", focus: "keys", reveal: function (payload) { return payload.score || 0; }, cast: "mimi", impact: "charge", level: function (payload) { return payload.heat || 2; }, phase: "reveal", call: "", copy: Object.freeze({ speaker: "ミミ", headline: function (payload) { return Number(payload.score) >= 2 ? "あと1つ！" : "次のランプへ！"; }, line: "", nextAction: "" }) }),
      Object.freeze({ id: "lock", focus: "keys", reveal: function (payload) { return payload.score || 0; }, cast: "mimi", impact: "lock", level: function (payload) { return payload.heat || 2; }, phase: "resolve", call: "", copy: Object.freeze({ speaker: "ミミ", headline: function (payload) { return Number(payload.score) >= 2 ? "あとひとつ！" : "次こそ！"; }, line: "", nextAction: "SPIN" }) }),
      Object.freeze({ id: "hold", focus: "wide", reveal: function (payload) { return payload.score || 0; }, cast: "mimi", impact: "ready", level: function (payload) { return payload.heat || 2; }, phase: "hold", call: "SPIN" }),
    ]),
    "treasure.trial.success": Object.freeze([
      Object.freeze({ id: "camera", focus: "keys", reveal: 3, cast: "mimi", impact: "silence", level: 4, phase: "freeze", call: "3/3", copy: Object.freeze({ speaker: "ミミ", headline: "全部点いた…！", line: "", nextAction: "" }) }),
      Object.freeze({ id: "align", focus: "keys", reveal: 3, cast: "mimi", impact: "lock", level: 5, phase: "reveal", call: "ALL LIGHTS", copy: Object.freeze({ speaker: "ミミ", headline: "VIP OPEN！", line: "", nextAction: "" }) }),
      Object.freeze({ id: "gate", focus: "gate", reveal: 3, cast: "mimi", impact: "win", level: 5, phase: "resolve", call: "VIP OPEN！", copy: Object.freeze({ speaker: "ミミ", headline: "VIP卓 開放！", line: "", nextAction: "" }) }),
      Object.freeze({ id: "hold", focus: "wide", reveal: 3, cast: "mimi", impact: "win", level: 5, phase: "celebrate", call: "BONUS" }),
    ]),
    "treasure.trial.revive": Object.freeze([
      Object.freeze({ id: "camera", focus: "keys", reveal: 2, cast: "mimi", impact: "silence", level: 2, phase: "freeze", call: "あと1つ", copy: Object.freeze({ speaker: "ミミ", headline: "光が足りない…", line: "", nextAction: "" }) }),
      Object.freeze({ id: "align", focus: "keys", reveal: 3, cast: "mimi", impact: "lock", level: 5, phase: "resolve", call: "逆転！", copy: Object.freeze({ speaker: "ミミ", headline: "VIP卓 開放！", line: "", nextAction: "" }) }),
      Object.freeze({ id: "hold", focus: "wide", reveal: 3, cast: "mimi", impact: "win", level: 5, phase: "celebrate", call: "REVIVE BONUS" }),
    ]),
    "treasure.trial.fail": Object.freeze([
      Object.freeze({ id: "camera", focus: "keys", reveal: function (payload) { return payload.score || 0; }, cast: "mimi", impact: "silence", level: 2, phase: "freeze", call: function (payload) { return `${Math.max(0, Number(payload.score) || 0)}/3`; }, copy: Object.freeze({ speaker: "ミミ", headline: "届かなかった…", line: "", nextAction: "" }) }),
      Object.freeze({ id: "dim", focus: "keys", reveal: function (payload) { return payload.score || 0; }, cast: "mimi", impact: "dim", level: 1, phase: "warning", call: "", copy: Object.freeze({ speaker: "ミミ", headline: "今回はここまで", line: "", nextAction: "" }) }),
      Object.freeze({ id: "hold", focus: "wide", reveal: function (payload) { return payload.score || 0; }, cast: "mimi", impact: "ready", level: 2, phase: "hold", call: "NEXT", copy: Object.freeze({ speaker: "ミミ", headline: "次の勝負へ！", line: "", nextAction: "SPIN" }) }),
    ]),
    "treasure.bonus.enter": Object.freeze([
      Object.freeze({ id: "camera", focus: "wide", cast: "mimi", impact: "none", level: function (payload) { return payload.heat || 3; }, phase: "anticipation", call: "" }),
      Object.freeze({ id: "reveal", focus: "pot", cast: "mimi", impact: function (payload) { return payload.origin === "boss-victory" ? "ready" : "payout"; }, level: function (payload) { return payload.heat || 4; }, phase: "reveal", call: function (payload) { return payload.origin === "boss-victory" ? "ROYAL POT" : "10G"; }, copy: Object.freeze({ speaker: "ミミ", headline: function (payload) { return payload.origin === "boss-victory" ? "ロイヤルポット獲得！" : "10G、スタート！"; }, line: "", nextAction: "" }) }),
      Object.freeze({ id: "resolve", focus: "right", cast: "mimi", impact: "ready", level: function (payload) { return payload.heat || 4; }, phase: "resolve", call: "", copy: Object.freeze({ speaker: "ミミ", headline: "ランプを全部灯そう！", line: "", nextAction: function (payload) { return payload.origin === "boss-victory" ? "" : "SPIN"; } }) }),
      Object.freeze({ id: "hold", focus: "wide", cast: "mimi", impact: "ready", level: function (payload) { return payload.heat || 4; }, phase: "hold", call: "" }),
    ]),
    "treasure.bonus.progress": Object.freeze([
      Object.freeze({ id: "camera", focus: "wide", cast: "mimi", impact: "none", level: function (payload) { return payload.heat || 2; }, phase: "anticipation", call: "" }),
      Object.freeze({ id: "reveal", focus: "pot", cast: "mimi", impact: "count", level: function (payload) { return payload.heat || 2; }, phase: "reveal", call: "" }),
      Object.freeze({ id: "resolve", focus: "wide", cast: "mimi", impact: "ready", level: function (payload) { return payload.heat || 2; }, phase: "resolve", call: "", copy: Object.freeze({ speaker: "ミミ", headline: treasureBonusProgressHeadline, line: treasureBonusProgressLine, nextAction: "SPIN" }) }),
      Object.freeze({ id: "hold", focus: "wide", cast: "mimi", impact: "ready", level: function (payload) { return payload.heat || 2; }, phase: "hold", call: "" }),
    ]),
    "treasure.bonus.exit": Object.freeze([
      Object.freeze({ id: "camera", focus: "wide", cast: "mimi", impact: "silence", level: 3, phase: "freeze", call: "" }),
      Object.freeze({ id: "reveal", focus: "right", cast: "mimi", impact: "win", level: 4, phase: "reveal", call: "" }),
      Object.freeze({ id: "resolve", focus: "right", cast: "mimi", impact: "win", level: 5, phase: "resolve", call: "", copy: Object.freeze({ speaker: "ミミ", headline: function (payload) { return payload.origin === "boss-victory" ? "ロイヤルポット獲得！" : `${payload.opponentName ? `${payload.opponentName}の卓` : "対戦卓"}へ戻ろう！`; }, line: "", nextAction: "" }) }),
      Object.freeze({ id: "hold", focus: "wide", cast: "mimi", impact: "win", level: 5, phase: "hold", call: "" }),
    ]),
    "treasure.boss.tell": Object.freeze([
      Object.freeze({ id: "camera", focus: "wide", reveal: 0, cast: "mimi", impact: "none", level: function (payload) { return payload.heat || 1; }, phase: "anticipation", call: "勝負！", copy: Object.freeze({ speaker: "ミミ", headline: "Aを引けば勝ち！", line: "", nextAction: "" }) }),
      Object.freeze({ id: "read", focus: "board", reveal: 4, cast: function (payload) { return Number(payload.heat) >= 3 ? "rico" : "mimi"; }, impact: "read", entering: 4, level: function (payload) { return payload.heat || 1; }, phase: "reveal", call: function (payload) { const heat = Number(payload.heat) || 1; return heat >= 5 ? "激熱！" : heat >= 4 ? "大チャンス！" : heat >= 3 ? "チャンス！" : "好機！"; }, copy: Object.freeze({ speaker: function (payload) { return Number(payload.heat) >= 3 ? "リコ先輩" : "ミミ"; }, headline: function (payload) { const heat = Number(payload.heat) || 1; return heat >= 5 ? "激熱！ Aが来る！" : heat >= 4 ? "大チャンス！ Aを引け！" : heat >= 3 ? "チャンス！ Aを引け！" : heat >= 2 ? "好機！ Aを引け！" : "Aを引けば勝ち！"; }, line: "", nextAction: "" }) }),
      Object.freeze({ id: "resolve", focus: "board", reveal: 4, cast: "mimi", impact: "none", level: function (payload) { return payload.heat || 1; }, phase: "resolve", call: "", copy: Object.freeze({ speaker: "ミミ", headline: "Aを引く！", line: "", nextAction: "STOP" }) }),
      Object.freeze({ id: "hold", focus: "wide", reveal: 4, cast: "mimi", impact: "ready", level: function (payload) { return payload.heat || 1; }, phase: "hold", call: "STOP" }),
    ]),
    "treasure.boss.enter": Object.freeze([
      Object.freeze({ id: "camera", focus: "wide", reveal: 0, cast: "mimi", impact: "none", level: 0, phase: "freeze", call: treasureBossEntryHeadline, copy: Object.freeze({ speaker: "対戦", headline: treasureBossEntryHeadline, line: "", nextAction: "" }) }),
      Object.freeze({ id: "reveal", focus: "velvet", reveal: 0, cast: "mimi", impact: "deal", level: 1, phase: "reveal", call: function (payload) { return isTreasureBossRetry(payload) ? "REMATCH" : "ROYAL POT"; }, copy: Object.freeze({ speaker: "ヴェルベット", headline: function (payload) { return isTreasureBossRetry(payload) ? "再戦を受けるわ" : payload.opponentLine || "ロイヤルポットを賭けるわ"; }, line: "", nextAction: "" }) }),
      Object.freeze({ id: "resolve", focus: "board", reveal: 4, cast: "mimi", impact: "none", entering: 4, level: 1, phase: "resolve", call: "勝負！", copy: Object.freeze({ speaker: "ミミ", headline: function (payload) { return payload.goalLine || "Aを引いて、ロイヤルを完成させよう！"; }, line: "", nextAction: "" }) }),
      Object.freeze({ id: "hold", focus: "wide", reveal: 4, cast: "mimi", impact: "ready", level: 1, phase: "hold", call: "SPIN", copy: Object.freeze({ speaker: "ミミ", headline: function (payload) { return payload.goalLine || "Aを引いて、ロイヤルを完成させよう！"; }, line: "", nextAction: "SPIN" }) }),
    ]),
    "treasure.boss.attack": Object.freeze([
      Object.freeze({ id: "camera", focus: "board", reveal: 4, cast: "mimi", impact: "none", entering: 4, level: 1, phase: "anticipation", call: "あと1枚", copy: Object.freeze({ speaker: "ミミ", headline: "Aじゃない…！", line: "", nextAction: "" }) }),
      Object.freeze({ id: "warning", focus: "mimi", reveal: 4, cast: function (payload) { return treasureBossAttackWarning(payload).cast; }, impact: "warning", level: 3, phase: "warning", call: "反撃！", copy: Object.freeze({ speaker: function (payload) { return treasureBossAttackWarning(payload).speaker; }, headline: function (payload) { return treasureBossAttackWarning(payload).headline; }, line: "", nextAction: "" }) }),
      Object.freeze({ id: "impact", focus: "velvet", reveal: 4, cast: function (payload) { return treasureBossAttackWarning(payload).cast; }, impact: "raise", level: 4, phase: "action", call: "ALL IN！", copy: Object.freeze({ speaker: "ヴェルベット", headline: "受けなさい！", line: "", nextAction: "" }) }),
      Object.freeze({ id: "hold", focus: "wide", reveal: 4, cast: "mimi", impact: "none", level: 3, phase: "hold", call: "SPIN" }),
    ]),
    "treasure.boss.counterCritical": Object.freeze([
      Object.freeze({ id: "camera", focus: "board", reveal: 4, cast: "mimi", impact: "none", entering: 4, level: 3, phase: "anticipation", call: "大ピンチ！", copy: Object.freeze({ speaker: "ミミ", headline: "最後の一枚が…！", line: "", nextAction: "" }) }),
      Object.freeze({ id: "read", focus: "rico", reveal: 4, cast: "rico", impact: "read", level: 4, phase: "warning", call: "DANGER！", copy: Object.freeze({ speaker: "リコ先輩", headline: "ヴェルベットが来る！", line: "", nextAction: "" }) }),
      Object.freeze({ id: "impact", focus: "velvet", reveal: 4, cast: "mimi", impact: "raise", level: 5, phase: "action", call: "ALL IN！", copy: Object.freeze({ speaker: "ヴェルベット", headline: "ここまでね", line: "", nextAction: "" }) }),
      Object.freeze({ id: "hold", focus: "mimi", reveal: 4, cast: "mimi", impact: "none", level: 4, phase: "hold", call: "SPIN" }),
    ]),
    "treasure.boss.revive": Object.freeze([
      Object.freeze({ id: "camera", focus: "board", reveal: 4, cast: "mimi", impact: "silence", entering: 4, level: 2, phase: "freeze", call: "あと1枚", copy: Object.freeze({ speaker: "ミミ", headline: "まだ…！", line: "", nextAction: "" }) }),
      Object.freeze({ id: "rescue", focus: "mimi", reveal: 4, cast: function (payload) { return payload.rescueActor || "polka"; }, impact: "revive", level: 5, phase: "action", call: "もう一度", copy: Object.freeze({ speaker: function (payload) { return payload.rescueSpeaker || "ポルカ"; }, headline: "ミミ、まだいける！", line: "", nextAction: "" }) }),
      Object.freeze({ id: "hold", focus: "wide", reveal: 4, cast: "mimi", impact: "ready", level: 4, phase: "hold", call: "SPIN" }),
    ]),
    "treasure.boss.guard": Object.freeze([
      Object.freeze({ id: "camera", focus: "board", reveal: 4, cast: "mimi", impact: "none", entering: 4, level: 2, phase: "anticipation", call: "あと1枚", copy: Object.freeze({ speaker: "ヴェルベット", headline: "もらったわ", line: "", nextAction: "" }) }),
      Object.freeze({ id: "warning", focus: "mimi", reveal: 4, cast: "selina", impact: "warning", level: 3, phase: "warning", call: "REPLAY", copy: Object.freeze({ speaker: "セリナ", headline: "リプレイでかわせる！", line: "", nextAction: "" }) }),
      Object.freeze({ id: "impact", focus: "mimi", reveal: 4, cast: "mimi", impact: "dodge", level: 4, phase: "action", call: "ラビットステップ", copy: Object.freeze({ speaker: "ミミ", headline: "よける！", line: "", nextAction: "" }) }),
      Object.freeze({ id: "hold", focus: "wide", reveal: 4, cast: "mimi", impact: "ready", level: 3, phase: "hold", call: "SPIN" }),
    ]),
    "treasure.boss.hit": Object.freeze([
      Object.freeze({ id: "camera", focus: "board", reveal: 4, cast: "mimi", impact: "none", entering: 4, level: 2, phase: "anticipation", call: "勝負！", copy: Object.freeze({ speaker: "ミミ", headline: "Aを引く！", line: "", nextAction: "" }) }),
      Object.freeze({ id: "impact", focus: "velvet", reveal: 4, cast: function (payload) { return payload.attackActor || "mimi"; }, impact: "call", level: 4, phase: "action", call: function (payload) { return payload.technique || "HIT"; }, copy: Object.freeze({ speaker: function (payload) { return payload.attackSpeaker || "ミミ"; }, headline: function (payload) { return payload.technique || "いける！"; }, line: "", nextAction: "" }) }),
      Object.freeze({ id: "damage", focus: "velvet", reveal: 4, cast: function (payload) { return payload.attackActor || "mimi"; }, impact: "damage", level: 4, phase: "resolve", call: function (payload) { const bonus = Math.max(0, Number(payload.teamDamage) || 0) + Math.max(0, Number(payload.synergyDamage) || 0) + Math.max(0, Number(payload.resolveDamage) || 0); return bonus > 0 ? `TEAM +${bonus} · -${Math.max(0, Number(payload.damage) || 0)}` : `DAMAGE -${Math.max(0, Number(payload.damage) || 0)}`; }, copy: Object.freeze({ speaker: function (payload) { return Number(payload.damage) > Number(payload.baseDamage) ? "TEAM" : "ヴェルベット"; }, headline: function (payload) { return Number(payload.damage) > Number(payload.baseDamage) ? `連携で ${Math.max(0, Number(payload.damage) || 0)} DAMAGE！` : "まだ終わらないわ"; }, line: "", nextAction: "" }) }),
      Object.freeze({ id: "hold", focus: "wide", reveal: 4, cast: "mimi", impact: "none", level: 3, phase: "hold", call: "SPIN" }),
    ]),
    "treasure.boss.critical": Object.freeze([
      Object.freeze({ id: "camera", focus: "board", reveal: 4, cast: "mimi", impact: "none", entering: 4, level: 3, phase: "anticipation", call: "ロイヤルチャンス" }),
      Object.freeze({ id: "read", focus: "mimi", reveal: 4, cast: function (payload) { return payload.attackActor || "mimi"; }, impact: "none", level: 4, phase: "reveal", call: "大チャンス！", copy: Object.freeze({ speaker: function (payload) { return payload.attackSpeaker || "ミミ"; }, headline: function (payload) { return payload.technique || "ここで決める！"; }, line: "", nextAction: "" }) }),
      Object.freeze({ id: "impact", focus: "velvet", reveal: 4, cast: function (payload) { return payload.attackActor || "mimi"; }, impact: "critical", level: 5, phase: "action", call: "CRITICAL", copy: Object.freeze({ speaker: function (payload) { return payload.attackSpeaker || "ミミ"; }, headline: "会心！", line: "", nextAction: "" }) }),
      Object.freeze({ id: "hold", focus: "wide", reveal: 4, cast: "mimi", impact: "stun", level: 5, phase: "hold", call: "SPIN" }),
    ]),
    "treasure.boss.timeout": Object.freeze([
      Object.freeze({ id: "camera", focus: "board", reveal: 4, cast: "mimi", impact: "silence", entering: 4, level: 2, phase: "freeze", call: "あと1枚", copy: Object.freeze({ speaker: "ミミ", headline: "Aに届かなかった…", line: "", nextAction: "" }) }),
      Object.freeze({ id: "warning", focus: "velvet", reveal: 4, cast: "selina", impact: "lock", level: 4, phase: "warning", call: "TIME UP", copy: Object.freeze({ speaker: "セリナ", headline: "ロイヤルは、まだ終わらない！", line: "", nextAction: "" }) }),
      Object.freeze({ id: "resolve", focus: "velvet", reveal: 4, cast: "selina", impact: "raise", level: 4, phase: "action", call: "RETRY！", copy: Object.freeze({ speaker: "ヴェルベット", headline: "Aを引くまで、勝負！", line: "", nextAction: "" }) }),
      Object.freeze({ id: "hold", focus: "wide", reveal: 4, cast: "mimi", impact: "none", level: 2, phase: "hold", call: "再挑戦" }),
    ]),
    "treasure.boss.retry": Object.freeze([
      Object.freeze({ id: "camera", focus: "mimi", reveal: 4, cast: "mimi", impact: "none", level: 1, phase: "anticipation", call: "もう一度", copy: Object.freeze({ speaker: "ミミ", headline: "次こそ、Aを引く！", line: "", nextAction: "" }) }),
      Object.freeze({ id: "read", focus: "rico", reveal: 4, cast: "rico", impact: "read", entering: 4, level: 2, phase: "reveal", call: "10・J・Q・K", copy: Object.freeze({ speaker: "リコ先輩", headline: "10からKはそろってる", line: "", nextAction: "" }) }),
      Object.freeze({ id: "resolve", focus: "mimi", reveal: 4, cast: "polka", impact: "revive", level: 3, phase: "resolve", call: function (payload) { return Number(payload.resolveLevel) > 0 ? `POWER UP Lv.${Math.min(3, Number(payload.resolveLevel))}` : "Aを引こう！"; }, copy: Object.freeze({ speaker: "ポルカ", headline: function (payload) { return Number(payload.resolveLevel) > 0 ? `再戦POWER Lv.${Math.min(3, Number(payload.resolveLevel))}！` : "次こそAを引こう！"; }, line: "", nextAction: "" }) }),
      Object.freeze({ id: "hold", focus: "wide", reveal: 4, cast: "mimi", impact: "ready", level: 2, phase: "hold", call: function (payload) { return Number(payload.resolveLevel) > 0 ? `NEXT ${Math.max(5, Number(payload.nextTurnLimit) || 5)}T` : "SPIN"; } }),
    ]),
    "treasure.boss.win": Object.freeze([
      Object.freeze({ id: "camera", focus: "board", reveal: 4, cast: "mimi", impact: "silence", entering: 4, level: 4, phase: "freeze", call: "最後の一枚！", copy: Object.freeze({ speaker: "ミミ", headline: "Aを引け！", line: "", nextAction: "" }) }),
      Object.freeze({ id: "reveal", focus: "board", reveal: 5, cast: "mimi", impact: "critical", entering: 5, level: 5, phase: "reveal", call: "A♥！", copy: Object.freeze({ speaker: "ミミ", headline: "ロイヤルストレートフラッシュ！", line: "", nextAction: "" }) }),
      Object.freeze({ id: "resolve", focus: "velvet", reveal: 5, cast: "rico", impact: "lock", level: 5, phase: "resolve", call: "残りチップ 0", copy: Object.freeze({ speaker: "ヴェルベット", headline: "私の負けね", line: "", nextAction: "" }) }),
      Object.freeze({ id: "hold", focus: "wide", reveal: 5, cast: "mimi", impact: "win", level: 5, phase: "celebrate", call: "大勝利！" }),
    ]),
    "treasure.reward": Object.freeze([
      Object.freeze({ id: "camera", focus: "pot", reveal: 5, cast: "mimi", impact: "none", level: 2, phase: "anticipation", call: "ロイヤルポット" }),
      Object.freeze({ id: "reveal", focus: "grano", reveal: 5, cast: "grano", impact: "count", level: 3, phase: "reveal", call: "BONUS 10G！", copy: Object.freeze({ speaker: "グラーノ", headline: "BONUS 10G 獲得！", line: "", nextAction: "" }) }),
      Object.freeze({ id: "resolve", focus: "pot", reveal: 5, cast: "mimi", impact: "payout", level: 5, phase: "resolve", call: "BONUS 10G", copy: Object.freeze({ speaker: "ミミ", headline: "やったね、みんな！", line: "", nextAction: "" }) }),
      Object.freeze({ id: "hold", focus: "wide", reveal: 5, cast: "finale", impact: "celebrate", level: 5, phase: "celebrate", call: "ロイヤルポット獲得！" }),
    ]),
  });

  const TREASURE_VELVET_POSES = Object.freeze({
    dealer: "./assets/character-animation-v8/unified-cast-boss-v1/velvet-production.png",
    raise: "./assets/character-animation-v8/unified-cast-boss-v1/velvet-production.png",
    hit: "./assets/character-animation-v8/unified-cast-boss-v1/velvet-production.png",
    concede: "./assets/character-animation-v8/unified-cast-boss-v1/velvet-production.png",
  });

  const TREASURE_MIMI_POSES = Object.freeze({
    neutral: "./assets/character-animation-v8/unified-cast-action-v1/mimi.png",
    surprised: "./assets/character-animation-v8/unified-cast-action-v1/mimi.png",
    concerned: "./assets/character-animation-v8/unified-cast-action-v1/mimi.png",
    determined: "./assets/character-animation-v8/unified-cast-action-v1/mimi.png",
    relief: "./assets/character-animation-v8/unified-cast-action-v1/mimi.png",
    reassure: "./assets/character-animation-v8/unified-cast-action-v1/mimi.png",
  });

  const TREASURE_TABLE_ACTORS = Object.freeze({
    rico: "./assets/character-animation-v8/unified-cast-v1/rico.png",
    polka: "./assets/character-animation-v8/unified-cast-v1/polka.png",
    selina: "./assets/character-animation-v8/unified-cast-v1/selina.png",
    grano: "./assets/character-animation-v8/unified-cast-v1/grano.png",
  });
  const TREASURE_TABLE_ACTOR_NAMES = Object.freeze({
    rico: "リコ先輩",
    polka: "ポルカ",
    selina: "セリナ",
    grano: "グラーノ",
  });
  const TREASURE_ROYAL_ORDER_CRESTS = Object.freeze({
    team: "I",
    read: "II",
    strong: "III",
    speed: "IV",
    first: "V",
  });

  const CHAPTER1_EMOTION_IDS = Object.freeze(["smug", "panic", "caught", "plead", "tantrum"]);
  const CHAPTER1_EMOTION_CAST = Object.freeze(["mimi", "rico", "polka", "velvet", "grano", "selina"]);
  const CHAPTER1_EMOTION_ASSETS = Object.freeze(Object.fromEntries(CHAPTER1_EMOTION_CAST.map(function (characterId) {
    return [characterId, Object.freeze(Object.fromEntries(CHAPTER1_EMOTION_IDS.map(function (emotionId) {
      return [emotionId, `./assets/character-emotions-v2/${emotionId}/${characterId}.png`];
    })))];
  })));
  const CHAPTER1_EMOTION_BODY_ASSETS = Object.freeze({
    mimi: TREASURE_MIMI_POSES.neutral,
    // The V8 base sheet exported Rico and Polka under each other's filenames.
    // Keep the semantic cast IDs aligned with the accepted V2 closeups.
    rico: TREASURE_TABLE_ACTORS.polka,
    polka: TREASURE_TABLE_ACTORS.rico,
    velvet: TREASURE_VELVET_POSES.dealer,
    grano: TREASURE_TABLE_ACTORS.grano,
    selina: TREASURE_TABLE_ACTORS.selina,
  });
  const CHAPTER1_EMOTION_PERSONALITIES = Object.freeze({
    mimi: Object.freeze({ id: "earnest-heroine", acting: "fluster-forward" }),
    rico: Object.freeze({ id: "disciplined-senior", acting: "composure-first" }),
    polka: Object.freeze({ id: "showboat-bluffer", acting: "loud-rebound" }),
    velvet: Object.freeze({ id: "brat-queen", acting: "taunt-until-crack" }),
    grano: Object.freeze({ id: "measured-appraiser", acting: "micro-expression" }),
    selina: Object.freeze({ id: "reserved-empath", acting: "quiet-tear-build" }),
  });
  const CHAPTER1_EMOTION_INTENSITY = Object.freeze({
    smug: 2,
    panic: 3,
    caught: 4,
    plead: 4,
    tantrum: 5,
  });
  const CHAPTER1_EMOTION_CONTROL = Object.freeze({
    smug: "mask",
    panic: "crack",
    caught: "exposed",
    plead: "bargain",
    tantrum: "collapse",
  });
  const CHAPTER1_EMOTION_ANIMATION_ASSETS = Object.freeze({
    "mimi:panic": "./assets/character-emotion-animation-v1/mimi-panic/strip.png",
    "mimi:tantrum": "./assets/character-emotion-animation-v1/mimi-tantrum/strip.png",
    "rico:smug": "./assets/character-emotion-animation-v1/rico-senior-read/strip.png",
    "rico:caught": "./assets/character-emotion-animation-v1/rico-composure-crack/strip.png",
    "rico:tantrum": "./assets/character-emotion-animation-v1/rico-tantrum/strip.png",
    "polka:smug": "./assets/character-emotion-animation-v1/polka-showboat/strip.png",
    "polka:caught": "./assets/character-emotion-animation-v1/polka-bluff-exposed/strip.png",
    "polka:tantrum": "./assets/character-emotion-animation-v1/polka-tantrum/strip.png",
    "grano:smug": "./assets/character-emotion-animation-v1/grano-value-read/strip.png",
    "grano:caught": "./assets/character-emotion-animation-v1/grano-calculation-collapse/strip.png",
    "grano:tantrum": "./assets/character-emotion-animation-v1/grano-tantrum/strip.png",
    "selina:caught": "./assets/character-emotion-animation-v1/selina-quiet-exposed/strip.png",
    "selina:plead": "./assets/character-emotion-animation-v1/selina-plead/strip.png",
    "selina:tantrum": "./assets/character-emotion-animation-v1/selina-tantrum/strip.png",
    "velvet:smug": "./assets/character-emotion-animation-v1/velvet-queen-taunt/strip.png",
    "velvet:tantrum": "./assets/character-emotion-animation-v1/velvet-tantrum/strip.png",
  });
  const CHAPTER1_EMOTION_SIGNATURES = Object.freeze({
    "mimi:panic": "earnest-overload",
    "mimi:tantrum": "heroine-meltdown",
    "rico:smug": "senior-read",
    "rico:caught": "composure-crack",
    "rico:tantrum": "senior-meltdown",
    "polka:smug": "showboat-bluff",
    "polka:caught": "bluff-exposed",
    "polka:tantrum": "theatrical-meltdown",
    "grano:smug": "value-read",
    "grano:caught": "calculation-collapse",
    "grano:tantrum": "calculation-meltdown",
    "selina:caught": "quiet-exposed",
    "selina:plead": "quiet-implosion",
    "selina:tantrum": "quiet-meltdown",
    "velvet:smug": "queen-taunt",
    "velvet:panic": "queen-crack",
    "velvet:caught": "queen-exposed",
    "velvet:plead": "queen-bargain",
    "velvet:tantrum": "queen-meltdown",
  });

  function actingProfileForEmotion(reaction, frame) {
    const payload = frame && frame.payload || {};
    const personality = CHAPTER1_EMOTION_PERSONALITIES[reaction.characterId];
    const heat = Math.max(1, Math.min(5, Number(payload.heat || payload.presentationHeat) || 1));
    const intensity = Math.min(5, CHAPTER1_EMOTION_INTENSITY[reaction.emotionId] + (heat >= 4 ? 1 : 0));
    const signatureKey = `${reaction.characterId}:${reaction.emotionId}`;
    const signature = CHAPTER1_EMOTION_SIGNATURES[signatureKey]
      || `${reaction.characterId}-${reaction.emotionId}`;
    return {
      personalityId: personality.id,
      actingId: personality.acting,
      controlId: CHAPTER1_EMOTION_CONTROL[reaction.emotionId],
      intensity,
      signature,
    };
  }

  function text(value) {
    return String(value == null ? "" : value).replace(/\s+/gu, " ").trim();
  }

  function setDatasetValue(element, key, value) {
    if (!element || !element.dataset) return false;
    const next = String(value == null ? "" : value);
    if (element.dataset[key] === next) return false;
    element.dataset[key] = next;
    return true;
  }

  function narrative(speaker, headline, line, nextAction) {
    return Object.freeze({
      speaker: text(speaker),
      headline: text(headline),
      line: text(line),
      nextAction: text(nextAction),
    });
  }

  function signal(effectId, source, copy, payload, behavior) {
    if (!EFFECT_IDS.includes(effectId)) return null;
    return Object.freeze({
      effectId: effectId,
      source: source,
      replace: Boolean(behavior && behavior.replace),
      timeline: behavior && behavior.timeline || null,
      payload: Object.freeze(Object.assign({}, payload || {}, {
        narrativeOverride: copy,
      })),
    });
  }

  function treasureSceneSignal(sceneId, values, source = "scene-event") {
    const definition = TREASURE_SCENE_DEFINITIONS[sceneId];
    if (!definition) return null;
    const payload = Object.assign({}, values || {}, { sceneId: sceneId });
    const resolve = function (value) {
      return typeof value === "function" ? value(payload) : value;
    };
    return signal(
      definition.effectId,
      source,
      narrative(
        resolve(definition.speaker),
        resolve(definition.headline),
        resolve(definition.line),
        resolve(definition.nextAction),
      ),
      payload,
      { replace: true, timeline: resolve(definition.timeline) || null },
    );
  }

  function treasureSceneFromChance(rank, title, story) {
    if (rank === "BOSS BATTLE") {
      const parts = title.split(/\s+/u);
      return treasureSceneSignal("treasure.boss.enter", {
        bossTitle: parts.slice(0, -1).join(" ") || "ロイヤル卓のディーラー",
        bossName: parts.at(-1) || "ヴェルベット",
      }, "chance-overlay");
    }
    if (rank === "COUNTER") {
      return treasureSceneSignal("treasure.boss.attack", {
        bossName: title.replace(/\s*反撃$/u, "") || "ヴェルベット",
      }, "chance-overlay");
    }
    if (rank === "HIT" && /^(?:装甲|スタック)\s*-/u.test(title)) {
      return treasureSceneSignal("treasure.boss.hit", {
        damage: Number(title.match(/-(\d+)/u)?.[1]) || 0,
        hp: Number(story.match(/(\d+)%/u)?.[1]) || 0,
      }, "chance-overlay");
    }
    if (rank === "CRITICAL" && /^ALL IN\s*-/u.test(title)) {
      return treasureSceneSignal("treasure.boss.critical", {
        bossName: "ヴェルベット",
        damage: Number(title.match(/-(\d+)/u)?.[1]) || 0,
        hp: Number(story.match(/(\d+)%/u)?.[1]) || 0,
      }, "chance-overlay");
    }
    if (rank === "WIN") {
      return treasureSceneSignal("treasure.boss.win", {
        bossName: title.replace(/\s*(?:撃破|勝負成立)$/u, "") || "ヴェルベット",
      }, "chance-overlay");
    }
    if (rank === "TREASURE BONUS") {
      return treasureSceneSignal("treasure.reward", {
        games: Number(title.match(/(\d+)G/u)?.[1]) || 10,
      }, "chance-overlay");
    }
    return null;
  }

  function classifyChance(input) {
    const state = input || {};
    const rank = text(state.rank);
    const title = text(state.title);
    const story = text(state.story);
    const combined = [rank, title, story].filter(Boolean).join(" ");
    const treasureSignal = treasureSceneFromChance(rank, title, story);
    if (treasureSignal) return treasureSignal;
    let effectId = "chance";
    let nextAction = "";
    let speaker = "ミミ";

    if (/JACKPOT|ジャックポット/iu.test(combined)) {
      effectId = "jackpot";
      nextAction = "JACKPOT配当を確認する";
    } else if (/BONUS|VICTORY|ボーナス|撃破/iu.test(combined)) {
      effectId = "bonus";
      nextAction = "BONUS開始を確認する";
    } else if (/BOSS|DANGER|BATTLE|ボス|反撃/iu.test(combined)) {
      effectId = "boss";
      nextAction = "WINラインでボスに挑む";
    } else if (/REVIVE|復活/iu.test(combined)) {
      effectId = "revive";
      nextAction = "復活後のリールを確認する";
    } else if (/GOLDEN\s*GATE|ORB\s*MAX|ゲート|解放/iu.test(combined)) {
      effectId = "goldenGate";
      nextAction = "解放されたルートを確認する";
    } else if (Boolean(state.hot) || /激アツ|CHANCE\s*UP|HIT|大チャンス/iu.test(combined)) {
      effectId = "hot";
      nextAction = "次のSTOPでWINを狙う";
    }

    return signal(
      effectId,
      "chance-overlay",
      narrative(speaker, rank || effectId.toUpperCase(), [title, story].filter(Boolean).join("。"), nextAction),
      {
        nextAction: nextAction,
        bossName: title.replace(/\s*(?:出現|に\s*\d+\s*DAMAGE).*$/u, "") || "対立者",
        celebrationName: title || "リゾート祝祭",
      },
      { replace: true },
    );
  }

  function classifyResult(value) {
    const resultText = text(value);
    if (!resultText) return null;

    if (/JACKPOT|ジャックポット/iu.test(resultText)) {
      return signal(
        "jackpot",
        "result",
        narrative("未来のミミ", "JACKPOT", resultText, "配当を確認し、SPINで次へ進む"),
        null,
        { replace: true },
      );
    }
    if (/クレジット獲得|\bWIN\b/iu.test(resultText)) {
      return signal(
        "hot",
        "result",
        narrative("ミミ", "WIN", resultText, "配当を確認し、次のSPINへ進む"),
        null,
        { replace: true },
      );
    }
    if (/はずれ|MISS/iu.test(resultText)) {
      return signal(
        "notice",
        "result",
        narrative("ミミ", "MISS", resultText, "蓄積を保ったまま次のSPINへ進む"),
        null,
        { replace: true },
      );
    }
    if (/REPLAY|リプレイ/iu.test(resultText)) {
      return signal(
        "notice",
        "result",
        narrative("ミミ", "REPLAY", resultText, "BETなしで次のSPINへ進む"),
        null,
        { replace: true },
      );
    }
    return null;
  }

  function goldenGateSignal() {
    return signal(
      "goldenGate",
      "shell-motif",
      narrative("ミミ", "扉がひらく！", "", ""),
      { gateSpeaker: "ミミ" },
      { replace: true },
    );
  }

  function strongestSignal(signals) {
    return (signals || []).reduce(function (winner, candidate) {
      if (!candidate) return winner;
      if (!winner) return candidate;
      return EFFECT_PRIORITY[candidate.effectId] >= EFFECT_PRIORITY[winner.effectId]
        ? candidate
        : winner;
    }, null);
  }

  function signalSignature(candidate) {
    if (!candidate) return "";
    const payload = candidate.payload || {};
    const copy = payload.narrativeOverride || {};
    return [
      candidate.effectId,
      candidate.source,
      payload.sceneId,
      copy.speaker,
      copy.headline,
      copy.line,
      copy.nextAction,
    ].map(text).join("\u001f");
  }

  function inertBridge(reason) {
    return Object.freeze({
      ready: false,
      reason: String(reason || "unavailable"),
      play: function () { return false; },
      playScene: function () { return false; },
      cancel: function () { return false; },
      pause: function () { return false; },
      resume: function () { return false; },
      seek: function () { return false; },
      stepBeat: function () { return false; },
      setSpeed: function () { return false; },
      snapshot: function () { return Object.freeze({ ready: false, reason: String(reason || "unavailable") }); },
      destroy: function () { return false; },
    });
  }

  function createGamePresentationBridge(options) {
    const settings = options || {};
    const windowRef = settings.window;
    const documentRef = settings.document;
    if (!windowRef || !documentRef || typeof documentRef.getElementById !== "function") {
      return inertBridge("document-unavailable");
    }

    const effects = settings.effects || windowRef.MimiPresentationEffects;
    const choreography = settings.choreography || windowRef.MimiPresentationChoreography;
    const presentation = settings.presentation || windowRef.MimiPresentation;
    const rendererApi = settings.renderer || windowRef.MimiPresentationRenderer;
    const MutationObserverRef = settings.MutationObserver || windowRef.MutationObserver;
    const requiredApis = Boolean(
      effects && effects.definitions && typeof effects.resolveBeat === "function"
      && choreography && typeof choreography.get === "function"
      && presentation && typeof presentation.createPresentationController === "function"
      && rendererApi && typeof rendererApi.createPresentationRenderer === "function"
      && typeof MutationObserverRef === "function"
    );

    const elements = {
      shell: documentRef.getElementById("gameShell"),
      host: documentRef.getElementById("presentationHost"),
      narrativeRoot: documentRef.getElementById("presentationNarrative"),
      speaker: documentRef.getElementById("presentationSpeaker"),
      headline: documentRef.getElementById("presentationHeadline"),
      line: documentRef.getElementById("presentationBody"),
      nextAction: documentRef.getElementById("presentationNextAction"),
      motion: documentRef.getElementById("motionBtn"),
      chance: documentRef.getElementById("chanceOverlay"),
      chanceRank: documentRef.getElementById("chanceRank"),
      chanceTitle: documentRef.getElementById("chanceText"),
      chanceStory: documentRef.getElementById("chanceStory"),
      result: documentRef.getElementById("resultAnnouncer"),
      cutin: documentRef.getElementById("cutin"),
      adventureEvent: documentRef.getElementById("adventureEvent"),
      sequence: documentRef.querySelector(".scene-sequence"),
      characterDialog: documentRef.getElementById("characterDialog"),
      bossSprite: documentRef.getElementById("bossSprite"),
    };
    const missingElement = Object.entries(elements).find(function (entry) { return !entry[1]; });
    if (!requiredApis || missingElement) {
      if (elements.host && elements.host.dataset) elements.host.dataset.bridgeStatus = "unavailable";
      return inertBridge(!requiredApis
        ? "dependency-unavailable"
        : missingElement
          ? "missing-" + missingElement[0]
          : "missing-element");
    }
    const observationRoot = typeof elements.shell.closest === "function"
      ? elements.shell.closest('[data-view="slot"]')
      : null;
    if (!observationRoot) {
      elements.host.dataset.bridgeStatus = "unavailable";
      return inertBridge("missing-slot-view");
    }

    let controller = null;
    let renderer = null;
    let observer = null;
    let unsubscribeControllerLifecycle = null;
    let activeTreasurePokerSignal = null;
    let visibleChanceSignalKey = "";
    let visibleResultSignalKey = "";
    let destroyed = false;
    let reducedMotion = false;
    const media = typeof windowRef.matchMedia === "function"
      ? windowRef.matchMedia("(prefers-reduced-motion: reduce)")
      : null;

    function readReducedMotion() {
      return Boolean(
        media && media.matches
        || elements.motion.getAttribute("aria-pressed") === "true"
        || elements.shell.classList.contains("reduced-motion")
      );
    }

    function treasurePlanForFrame(frame) {
      const sceneId = text(frame && frame.payload && frame.payload.sceneId);
      const plan = TREASURE_SCENE_BEAT_PLANS[sceneId];
      if (!plan || plan.length === 0) return null;
      const rawIndex = Math.max(0, Number(frame && frame.beatIndex) || 0);
      const definition = effects.definitions && effects.definitions[frame.effectId];
      const reducedCount = definition && Array.isArray(definition.reducedBeats)
        ? definition.reducedBeats.length
        : plan.length;
      const offset = frame && frame.reducedMotion
        ? Math.max(0, plan.length - reducedCount)
        : 0;
      const index = Math.min(plan.length - 1, rawIndex + offset);
      const payload = frame && frame.payload || {};
      const rawBeat = plan[index];
      const resolveValue = function (value) {
        return typeof value === "function" ? value(payload) : value;
      };
      const rawCopy = rawBeat.copy;
      const resolvedCopy = rawCopy ? Object.freeze({
        speaker: resolveValue(rawCopy.speaker),
        headline: resolveValue(rawCopy.headline),
        line: resolveValue(rawCopy.line),
        nextAction: resolveValue(rawCopy.nextAction),
      }) : null;
      const beat = Object.freeze(Object.assign({}, rawBeat, {
        cast: resolveValue(rawBeat.cast),
        focus: resolveValue(rawBeat.focus),
        reveal: resolveValue(rawBeat.reveal),
        impact: resolveValue(rawBeat.impact),
        phase: resolveValue(rawBeat.phase),
        call: resolveValue(rawBeat.call),
        level: resolveValue(rawBeat.level),
        copy: resolvedCopy,
      }));
      return Object.freeze({
        sceneId: sceneId,
        stateId: sceneId === "treasure.reward" ? "reward" : sceneId.split(".").pop(),
        index: index,
        beat: beat,
      });
    }

    function resolvedFrame(frame) {
      const snapshot = controller && typeof controller.snapshot === "function"
        ? controller.snapshot()
        : null;
      const merged = Object.assign({}, snapshot || {}, frame || {});
      const resolvedBeat = effects.resolveBeat(merged.effectId, merged.beat, merged.payload || {});
      const override = merged.payload && merged.payload.narrativeOverride;
      const treasurePlan = treasurePlanForFrame(merged);
      const authoredCopy = treasurePlan && treasurePlan.beat.copy;
      if (resolvedBeat && treasurePlan) {
        const copy = authoredCopy || { speaker: "", headline: "", line: "", nextAction: "" };
        merged.beat = Object.freeze(Object.assign({}, resolvedBeat, {
          id: treasurePlan.beat.id,
          cue: `${treasurePlan.sceneId}.${treasurePlan.beat.id}`,
          speaker: copy.speaker,
          headline: copy.headline,
          line: copy.line,
          objective: copy.nextAction,
          ariaText: [copy.speaker, copy.headline, copy.line, copy.nextAction].filter(Boolean).join("。"),
        }));
      } else if (resolvedBeat && override) {
        merged.beat = Object.freeze(Object.assign({}, resolvedBeat, {
          speaker: override.speaker,
          headline: override.headline,
          line: override.line,
          objective: override.nextAction,
          ariaText: [override.speaker, override.headline, override.line, override.nextAction].join("。"),
        }));
      } else {
        merged.beat = resolvedBeat || merged.beat;
      }
      merged.reducedMotion = reducedMotion;
      return merged;
    }

    function emotionForTreasureFrame(frame, plan) {
      const payload = frame && frame.payload || {};
      const sceneId = text(payload.sceneId);
      const beatId = text(plan && plan.beat && plan.beat.id);
      const index = Math.max(0, Number(plan && plan.index) || 0);
      const opponent = CHAPTER1_EMOTION_CAST.includes(text(payload.opponentId)) ? text(payload.opponentId) : "rico";
      if (sceneId === "treasure.character.emotion") {
        return {
          characterId: CHAPTER1_EMOTION_CAST.includes(text(payload.characterId)) ? text(payload.characterId) : "mimi",
          emotionId: CHAPTER1_EMOTION_IDS.includes(text(payload.emotionId)) ? text(payload.emotionId) : "smug",
        };
      }
      if (sceneId === "treasure.table.enter" && beatId === "reveal") return { characterId: opponent, emotionId: "smug" };
      if (sceneId === "treasure.table.hit" && beatId === "impact") return { characterId: opponent, emotionId: "panic" };
      if (sceneId === "treasure.table.clear") {
        if (index === 0) return { characterId: opponent, emotionId: "caught" };
        if (index === 1) return { characterId: opponent, emotionId: "plead" };
        if (index === 2) return { characterId: opponent, emotionId: "tantrum" };
      }
      if (["treasure.boss.tell", "treasure.boss.enter"].includes(sceneId)) return { characterId: "velvet", emotionId: "smug" };
      if (sceneId === "treasure.boss.attack") return index < 2
        ? { characterId: "velvet", emotionId: "smug" }
        : { characterId: "mimi", emotionId: "panic" };
      if (["treasure.boss.counterCritical", "treasure.boss.revive"].includes(sceneId)) return { characterId: "mimi", emotionId: "panic" };
      if (sceneId === "treasure.boss.guard") return { characterId: "mimi", emotionId: index < 2 ? "panic" : "smug" };
      if (["treasure.boss.hit", "treasure.boss.critical"].includes(sceneId)) return { characterId: "velvet", emotionId: index < 2 ? "panic" : "caught" };
      if (sceneId === "treasure.boss.timeout") return { characterId: "mimi", emotionId: ["panic", "plead", "tantrum", "plead"][Math.min(3, index)] };
      if (sceneId === "treasure.boss.retry") return { characterId: "mimi", emotionId: ["caught", "plead", "smug", "smug"][Math.min(3, index)] };
      if (sceneId === "treasure.boss.win") return { characterId: "velvet", emotionId: ["caught", "plead", "tantrum", "tantrum"][Math.min(3, index)] };
      return null;
    }

    function ensureCharacterEmotionStage() {
      let stage = elements.host.querySelector(".character-emotion-stage");
      if (stage) return stage;
      stage = documentRef.createElement("div");
      stage.className = "character-emotion-stage";
      stage.hidden = true;
      stage.setAttribute("aria-live", "polite");
      stage.innerHTML = [
        '<div class="character-emotion-burst" aria-hidden="true"></div>',
        '<div class="character-emotion-ghost" aria-hidden="true"></div>',
        '<img class="character-emotion-actor" alt="">',
        '<div class="character-emotion-closeup" aria-hidden="true"><img alt=""><img class="character-emotion-motion" alt="" hidden></div>',
        '<div class="character-emotion-sweat" aria-hidden="true"></div>',
        '<div class="character-emotion-tears" aria-hidden="true"><i></i><i></i></div>',
        '<div class="character-emotion-caption" aria-hidden="true"></div>',
      ].join("");
      elements.host.appendChild(stage);
      return stage;
    }

    function syncCharacterEmotionFrame(frame) {
      const plan = treasurePlanForFrame(frame);
      const reaction = plan && emotionForTreasureFrame(frame, plan);
      const stage = ensureCharacterEmotionStage();
      if (!reaction) {
        stage.hidden = true;
        stage.dataset.active = "false";
        stage.dataset.animationMode = "still";
        stage.dataset.motionReady = "false";
        delete stage.dataset.personality;
        delete stage.dataset.acting;
        delete stage.dataset.control;
        delete stage.dataset.intensity;
        delete stage.dataset.signature;
        elements.host.removeAttribute("data-character-emotion");
        elements.host.removeAttribute("data-character-emotion-cast");
        elements.shell.removeAttribute("data-character-emotion");
        elements.shell.removeAttribute("data-character-emotion-cast");
        return;
      }
      const asset = CHAPTER1_EMOTION_ASSETS[reaction.characterId][reaction.emotionId];
      const bodyAsset = CHAPTER1_EMOTION_BODY_ASSETS[reaction.characterId];
      const acting = actingProfileForEmotion(reaction, frame);
      const animationAsset = CHAPTER1_EMOTION_ANIMATION_ASSETS[`${reaction.characterId}:${reaction.emotionId}`] || "";
      const actor = stage.querySelector(".character-emotion-actor");
      const closeup = stage.querySelector(".character-emotion-closeup > img:not(.character-emotion-motion)");
      const motion = stage.querySelector(".character-emotion-motion");
      if (actor.getAttribute("src") !== bodyAsset) actor.src = bodyAsset;
      if (closeup.getAttribute("src") !== asset) closeup.src = asset;
      if (animationAsset) {
        motion.hidden = false;
        if (motion.getAttribute("src") !== animationAsset) {
          motion.dataset.loaded = "false";
          stage.dataset.motionReady = "false";
          motion.onload = function () {
            motion.dataset.loaded = "true";
            stage.dataset.motionReady = "true";
          };
          motion.onerror = function () {
            motion.dataset.loaded = "false";
            stage.dataset.motionReady = "false";
          };
          motion.src = animationAsset;
        } else if (motion.complete && motion.naturalWidth > 0) {
          motion.dataset.loaded = "true";
          stage.dataset.motionReady = "true";
        }
        stage.dataset.animationMode = "eight-frame";
      } else {
        motion.hidden = true;
        motion.removeAttribute("src");
        motion.dataset.loaded = "false";
        stage.dataset.animationMode = "still";
        stage.dataset.motionReady = "false";
      }
      actor.alt = `${reaction.characterId} ${reaction.emotionId}`;
      stage.hidden = false;
      stage.dataset.active = "true";
      stage.dataset.character = reaction.characterId;
      stage.dataset.emotion = reaction.emotionId;
      stage.dataset.personality = acting.personalityId;
      stage.dataset.acting = acting.actingId;
      stage.dataset.control = acting.controlId;
      stage.dataset.intensity = String(acting.intensity);
      stage.dataset.signature = acting.signature;
      stage.dataset.beat = text(plan.beat.id);
      stage.querySelector(".character-emotion-caption").textContent = reaction.emotionId.toUpperCase();
      setDatasetValue(elements.host, "characterEmotion", reaction.emotionId);
      setDatasetValue(elements.host, "characterEmotionCast", reaction.characterId);
      setDatasetValue(elements.shell, "characterEmotion", reaction.emotionId);
      setDatasetValue(elements.shell, "characterEmotionCast", reaction.characterId);
      const token = `${String(frame && frame.epoch || 0)}:${reaction.characterId}:${reaction.emotionId}`;
      if (stage.dataset.animationToken !== token) {
        stage.dataset.animationToken = token;
        stage.classList.remove("is-playing");
        void stage.offsetWidth;
        stage.classList.add("is-playing");
      }
    }

    function syncTreasurePokerFrame(frame) {
      const payload = frame && frame.payload || {};
      const sceneId = text(payload.sceneId);
      if (!sceneId.startsWith("treasure.boss.") && sceneId !== "treasure.reward") return;
      const plan = treasurePlanForFrame(frame);
      if (!plan) return;
      const stage = elements.host.querySelector(".treasure-poker-stage");
      if (!stage) return;
      const requestedSymbolId = text(payload.symbolId || payload.flag || "none");
      const symbolId = Object.hasOwn(TREASURE_ROLE_ASSETS, requestedSymbolId) ? requestedSymbolId : "none";
      const roleEmblem = stage.querySelector(".treasure-poker-role-emblem");
      if (roleEmblem && roleEmblem.getAttribute("src") !== TREASURE_ROLE_ASSETS[symbolId]) {
        roleEmblem.src = TREASURE_ROLE_ASSETS[symbolId];
      }
      const label = stage.querySelector(".treasure-poker-stakes-label");
      const value = stage.querySelector(".treasure-poker-stakes-value");
      const showdownLabel = stage.querySelector(".treasure-poker-showdown-label");
      const impactWord = stage.querySelector(".treasure-poker-impact-word");
      const ruleText = stage.querySelector(".treasure-poker-rule-text");
      const cards = Array.from(stage.querySelectorAll(".treasure-poker-card"));
      const stateId = plan.stateId;
      const preparedAllies = Array.isArray(payload.preparedAllies)
        ? payload.preparedAllies.filter(function (allyId) { return ["rico", "polka", "selina", "grano"].includes(allyId); })
        : [];
      const readyCount = Math.max(0, Math.min(4, Number(payload.readyCount) || preparedAllies.length));
      const resolveLevel = Math.max(0, Math.min(3, Number(payload.resolveLevel) || 0));
      const turnLimit = Math.max(1, Number(payload.nextTurnLimit || payload.turnLimit) || 5);
      const teamValue = stage.querySelector(".treasure-poker-team-value");
      const resolveValue = stage.querySelector(".treasure-poker-resolve-value");
      stage.querySelectorAll(".treasure-poker-team-pips [data-ally]").forEach(function (pip) {
        pip.dataset.ready = String(preparedAllies.includes(pip.dataset.ally));
        pip.dataset.synergy = String(Boolean(payload.synergyActive) && pip.dataset.ally === text(payload.attackActor));
      });
      if (teamValue) teamValue.textContent = `${readyCount}/4`;
      if (resolveValue) resolveValue.textContent = resolveLevel > 0
        ? `RESOLVE Lv.${resolveLevel} · ${turnLimit}T`
        : `FIRST TRY · ${turnLimit}T`;
      setDatasetValue(stage, "readyCount", readyCount);
      setDatasetValue(stage, "resolveLevel", resolveLevel);
      setDatasetValue(stage, "synergy", Boolean(payload.synergyActive));
      const bossSprite = elements.shell.querySelector("#bossSprite");
      const velvetActor = stage.querySelector(".treasure-poker-duelist-velvet");
      const mimiActor = stage.querySelector(".treasure-poker-actor-mimi");
      const velvetPose = stateId === "tell"
        ? "dealer"
        : stateId === "attack"
        ? (["impact", "hold"].includes(plan.beat.id) ? "raise" : "dealer")
        : stateId === "guard"
          ? (["camera", "warning"].includes(plan.beat.id) ? "raise" : "dealer")
        : stateId === "counterCritical"
          ? (["impact", "hold"].includes(plan.beat.id) ? "raise" : "dealer")
        : stateId === "revive"
          ? (["camera", "warning"].includes(plan.beat.id) ? "raise" : "dealer")
        : stateId === "hit"
          ? (plan.beat.impact === "raise" ? "raise" : plan.beat.impact === "call" ? "hit" : "dealer")
          : stateId === "critical"
            ? (["impact", "hold"].includes(plan.beat.id) ? "hit" : "dealer")
          : stateId === "timeout"
            ? (["warning", "resolve", "hold"].includes(plan.beat.id) ? "raise" : "dealer")
          : stateId === "win"
            ? (plan.beat.id === "camera" ? "hit" : "concede")
            : stateId === "reward" ? "concede" : "dealer";
      if (bossSprite) {
        if (bossSprite.getAttribute("src") !== TREASURE_VELVET_POSES[velvetPose]) bossSprite.src = TREASURE_VELVET_POSES[velvetPose];
        bossSprite.dataset.treasurePose = velvetPose;
      }
      if (velvetActor) {
        if (velvetActor.getAttribute("src") !== TREASURE_VELVET_POSES[velvetPose]) velvetActor.src = TREASURE_VELVET_POSES[velvetPose];
        velvetActor.dataset.pose = velvetPose;
      }
      const mimiPose = stateId === "tell"
        ? "determined"
        : stateId === "enter"
        ? (["camera", "reveal"].includes(plan.beat.id) ? "surprised" : "determined")
        : stateId === "guard"
          ? (plan.beat.id === "warning" ? "concerned" : "determined")
        : stateId === "attack"
          ? (["camera", "warning", "impact"].includes(plan.beat.id) ? "concerned" : "determined")
        : stateId === "counterCritical"
          ? (plan.beat.id === "hold" ? "determined" : "concerned")
        : stateId === "revive"
          ? (["impact", "hold"].includes(plan.beat.id) ? "relief" : "concerned")
          : stateId === "hit"
            ? (plan.beat.id === "counter" ? "concerned" : "determined")
          : stateId === "critical" ? "determined"
            : stateId === "timeout" ? (plan.beat.id === "hold" ? "determined" : "concerned")
              : stateId === "retry" ? (plan.beat.id === "camera" ? "concerned" : "determined")
            : stateId === "win"
              ? (["camera", "reveal"].includes(plan.beat.id) ? "surprised" : "relief")
              : stateId === "reward" ? (plan.beat.id === "camera" ? "relief" : "reassure") : "neutral";
      if (mimiActor) {
        if (mimiActor.getAttribute("src") !== TREASURE_MIMI_POSES[mimiPose]) mimiActor.src = TREASURE_MIMI_POSES[mimiPose];
        mimiActor.dataset.pose = mimiPose;
      }
      if (stateId === "enter" && plan.index === 0) {
        stage.querySelectorAll(".treasure-poker-actor, .treasure-poker-action-art, .treasure-poker-premium-cutin").forEach(function (actor) {
          actor.loading = "eager";
          if (typeof actor.decode === "function") actor.decode().catch(function () {});
        });
      }
      const hp = Math.max(0, Number(payload.hp) || (stateId === "win" || stateId === "reward" ? 0 : 100));
      const damage = Math.max(0, Number(payload.damage) || 0);
      const games = Math.max(1, Number(payload.games) || 10);
      const heat = Math.max(1, Math.min(5, Number(payload.heat) || Number(plan.beat.level) || 1));
      // The fifth card is the battle result, not a generic hit flourish.
      // Keeping A face-down through HIT/CRITICAL preserves the contract that
      // ROYAL completion and VICTORY mean the same settled outcome.
      const royalComplete = ["win", "reward"].includes(stateId) && Number(plan.beat.reveal) >= 5;
      const royalMiss = ["attack", "counterCritical", "revive", "guard", "timeout"].includes(stateId) && Number(plan.beat.reveal) >= 4;
      const royalState = royalComplete ? "complete" : royalMiss ? "miss" : "pending";
      const next = Object.freeze({
        label: stateId === "reward" ? "BONUS" : "残りチップ",
        value: stateId === "reward" ? `${games}G` : stateId === "win" ? "0" : String(Math.max(0, Number(payload.hp ?? 100))),
        faces: ["10", "J", "Q", "K", "A"],
        suits: ["♥", "♥", "♥", "♥", "♥"],
      });
      setDatasetValue(elements.host, "treasurePokerState", stateId);
      setDatasetValue(elements.host, "treasureScene", sceneId);
      setDatasetValue(elements.host, "treasureBeat", plan.beat.id);
      setDatasetValue(elements.host, "treasureBeatIndex", plan.index);
      setDatasetValue(elements.host, "treasureFocus", plan.beat.focus || "wide");
      setDatasetValue(elements.host, "treasureCast", plan.beat.cast || "none");
      setDatasetValue(elements.host, "treasureImpact", plan.beat.impact || "none");
      setDatasetValue(elements.host, "treasureLevel", plan.beat.level || 0);
      setDatasetValue(elements.host, "treasureHeat", heat);
      setDatasetValue(elements.host, "treasureSymbol", symbolId);
      setDatasetValue(elements.host, "treasurePhase", plan.beat.phase || "hold");
      setDatasetValue(elements.host, "treasureRevealCount", plan.beat.reveal || 0);
      setDatasetValue(elements.host, "treasureRoyalState", royalState);
      setDatasetValue(elements.host, "treasureReadyCount", readyCount);
      setDatasetValue(elements.host, "treasureResolveLevel", resolveLevel);
      setDatasetValue(elements.host, "treasureSynergy", Boolean(payload.synergyActive));
      setDatasetValue(elements.shell, "treasureBeat", plan.beat.id);
      setDatasetValue(elements.shell, "treasureFocus", plan.beat.focus || "wide");
      setDatasetValue(elements.shell, "treasureCast", plan.beat.cast || "none");
      setDatasetValue(elements.shell, "treasureImpact", plan.beat.impact || "none");
      setDatasetValue(elements.shell, "treasureLevel", plan.beat.level || 0);
      setDatasetValue(elements.shell, "treasureHeat", heat);
      setDatasetValue(elements.shell, "treasureSymbol", symbolId);
      setDatasetValue(elements.shell, "treasurePhase", plan.beat.phase || "hold");
      setDatasetValue(elements.shell, "treasureReadyCount", readyCount);
      setDatasetValue(elements.shell, "treasureResolveLevel", resolveLevel);
      setDatasetValue(elements.shell, "treasureSynergy", Boolean(payload.synergyActive));
      const tensionWord = stage.querySelector(".treasure-poker-tension-word");
      if (tensionWord) tensionWord.textContent = "";
      if (label) label.textContent = next.label;
      if (value) value.textContent = next.value;
      if (showdownLabel) {
        const showdownText = stateId === "reward"
          ? "ROYAL POT WON!"
          : royalComplete ? "ROYAL STRAIGHT FLUSH" : "";
        if (showdownLabel.textContent !== showdownText) showdownLabel.textContent = showdownText;
        const revealToken = `${String(frame.epoch ?? 0)}:${sceneId}`;
        if (royalComplete) {
          if (stage.dataset.royalRevealToken !== revealToken) {
            stage.dataset.royalRevealToken = revealToken;
            showdownLabel.classList.remove("is-royal-revealing");
            void showdownLabel.offsetWidth;
            showdownLabel.classList.add("is-royal-revealing");
          }
        } else {
          delete stage.dataset.royalRevealToken;
          showdownLabel.classList.remove("is-royal-revealing");
        }
      }
      if (ruleText) ruleText.textContent = "";
      const technique = text(payload.technique || "");
      if (impactWord) impactWord.textContent = royalComplete ? "ROYAL STRAIGHT FLUSH" : stateId === "hit" && plan.beat.id === "impact"
        ? technique || "HIT"
        : stateId === "critical" && plan.beat.id === "impact"
          ? "CRITICAL"
          : ({
        raise: "RAISE",
        call: "CALL",
        dodge: "DODGE",
        critical: "CRITICAL",
        damage: damage ? `-${damage}` : "HIT",
        lock: "",
        win: "WIN",
        payout: `${games}G`,
        celebrate: "POT WON",
        revive: "BACK IN",
      })[plan.beat.impact] || "";
      cards.forEach(function (card, index) {
        card.dataset.revealed = index < plan.beat.reveal ? "true" : "false";
        card.dataset.entering = index + 1 === Number(plan.beat.entering) ? "true" : "false";
        const cardValue = card.querySelector(".treasure-poker-card-value");
        const cardSuit = card.querySelector(".treasure-poker-card-suit");
        if (cardValue) cardValue.textContent = next.faces[index] || "";
        if (cardSuit) cardSuit.textContent = next.suits[index] || "";
      });
    }

    function syncTreasureTrialFrame(frame) {
      const payload = frame && frame.payload || {};
      const sceneId = text(payload.sceneId);
      if (!sceneId.startsWith("treasure.trial.")) return;
      const plan = treasurePlanForFrame(frame);
      if (!plan) return;
      const stage = elements.host.querySelector(".treasure-trial-stage");
      if (!stage) return;
      const score = Math.max(0, Math.min(3, Number(payload.score) || 0));
      const status = stage.querySelector(".treasure-feature-status");
      if (status) {
        const remaining = Math.max(0, 3 - (Number(payload.spins) || 0));
        const success = /\.(success|revive)$/.test(sceneId);
        status.querySelector("strong").textContent = success ? "やった！ 10G BONUS！" : sceneId.endsWith(".fail") ? "次のチャンスをつかもう！" : `残り ${remaining}G · ランプ ${score}/3`;
        status.querySelector("span").textContent = success ? "ミミ「いっぱい持って帰ろう！」" : "小役やテンパイで点灯 · 3つ点けばBONUS";
      }
      const reveal = Math.max(score, Math.min(3, Number(plan.beat.reveal) || 0));
      const displayScore = plan.stateId === "revive" ? reveal : score;
      const heat = Math.max(1, Math.min(5, Number(payload.heat) || Number(plan.beat.level) || 2));
      const aura = text(payload.aura || payload.presentationCue || `aura-${heat}`);
      const stateId = plan.stateId;
      setDatasetValue(elements.host, "trialState", stateId);
      setDatasetValue(elements.host, "trialScene", sceneId);
      setDatasetValue(elements.host, "trialBeat", plan.beat.id);
      setDatasetValue(elements.host, "trialHeat", heat);
      setDatasetValue(elements.host, "trialAura", aura);
      setDatasetValue(elements.host, "trialScore", displayScore);
      setDatasetValue(elements.host, "trialType", text(payload.trialType || "training"));
      setDatasetValue(elements.shell, "trialState", stateId);
      setDatasetValue(elements.shell, "trialBeat", plan.beat.id);
      setDatasetValue(elements.shell, "trialHeat", heat);
      setDatasetValue(elements.shell, "trialAura", aura);
      setDatasetValue(elements.shell, "trialScore", displayScore);
      stage.querySelectorAll(".treasure-trial-key").forEach(function (key, index) {
        key.dataset.locked = index < reveal ? "true" : "false";
        key.dataset.entering = index + 1 === reveal && ["charge", "lock", "align"].includes(plan.beat.id) ? "true" : "false";
      });
      stage.querySelectorAll(".treasure-trial-gauge i").forEach(function (segment, index) {
        segment.dataset.active = index < displayScore ? "true" : "false";
      });
      stage.querySelectorAll(".treasure-trial-sockets i").forEach(function (socket, index) {
        socket.dataset.filled = index < reveal ? "true" : "false";
      });
      const count = stage.querySelector(".treasure-trial-count strong");
      if (count) count.textContent = String(displayScore);
    }

    function syncTreasureNormalFrame(frame) {
      const payload = frame && frame.payload || {};
      const sceneId = text(payload.sceneId);
      if (sceneId !== "treasure.normal.event" && !sceneId.startsWith("treasure.table.")) return;
      const plan = treasurePlanForFrame(frame);
      if (!plan) return;
      const eventId = text(payload.event || sceneId.replace("treasure.", ""));
      const heat = Math.max(1, Math.min(5, Number(payload.heat) || Number(plan.beat.level) || 2));
      setDatasetValue(elements.host, "normalEvent", eventId);
      setDatasetValue(elements.host, "normalBeat", plan.beat.id);
      setDatasetValue(elements.host, "normalPhase", text(plan.beat.phase || "hold"));
      setDatasetValue(elements.host, "normalHeat", heat);
      setDatasetValue(elements.shell, "normalEvent", eventId);
      setDatasetValue(elements.shell, "normalBeat", plan.beat.id);
      setDatasetValue(elements.shell, "normalPhase", text(plan.beat.phase || "hold"));
      setDatasetValue(elements.shell, "normalHeat", heat);
      if (sceneId === "treasure.normal.event") {
        const actorId = text(payload.actor);
        const rival = elements.shell.querySelector("#casinoOpponent");
        if (rival && actorId !== "mimi" && TREASURE_TABLE_ACTORS[actorId]) {
          if (rival.getAttribute("src") !== TREASURE_TABLE_ACTORS[actorId]) rival.src = TREASURE_TABLE_ACTORS[actorId];
          rival.dataset.eventActor = actorId;
          rival.alt = text(payload.speaker || TREASURE_TABLE_ACTOR_NAMES[actorId]);
        }
      }
    }

    function syncTreasureBonusFrame(frame) {
      const payload = frame && frame.payload || {};
      const sceneId = text(payload.sceneId);
      if (!sceneId.startsWith("treasure.bonus.")) return;
      const plan = treasurePlanForFrame(frame);
      if (!plan) return;
      const stage = elements.host.querySelector(".treasure-bonus-stage");
      if (!stage) return;
      const games = Math.max(0, Number(payload.games) || 0);
      const heat = Math.max(1, Math.min(5, Number(payload.heat) || Number(plan.beat.level) || 3));
      const origin = text(payload.origin || "feature");
      const milestone = sceneId === "treasure.bonus.progress"
        ? treasureBonusProgressMilestone(payload)
        : "";
      const shellData = elements.shell && elements.shell.dataset || {};
      const orderId = text(shellData.chapter1RoyalOrder);
      const orderTitle = text(shellData.chapter1RoyalOrderTitle);
      const orderProgress = text(shellData.chapter1RoyalOrderProgress);
      const rawAwardKind = text(shellData.chapter1RoyalCrestAward);
      const crestCount = Math.max(0, Math.min(5, Number(shellData.chapter1RoyalCrestCount) || 0));
      const awardKind = origin === "boss-victory"
        && Object.hasOwn(TREASURE_ROYAL_ORDER_CRESTS, orderId)
        && ["new", "stamp", "complete", "miss"].includes(rawAwardKind)
        ? rawAwardKind
        : "";
      setDatasetValue(elements.host, "bonusState", plan.stateId);
      setDatasetValue(elements.host, "bonusScene", sceneId);
      setDatasetValue(elements.host, "bonusBeat", plan.beat.id);
      setDatasetValue(elements.host, "bonusPhase", text(plan.beat.phase || "hold"));
      setDatasetValue(elements.host, "bonusHeat", heat);
      setDatasetValue(elements.host, "bonusGames", games);
      setDatasetValue(elements.host, "bonusOrigin", origin);
      setDatasetValue(elements.host, "bonusOpponent", text(payload.opponentId || ""));
      if (milestone && milestone !== "routine") setDatasetValue(elements.host, "bonusMilestone", milestone);
      else delete elements.host.dataset.bonusMilestone;
      if (awardKind) {
        setDatasetValue(elements.host, "bonusOrder", orderId);
        setDatasetValue(elements.host, "bonusOrderAward", awardKind);
      } else {
        delete elements.host.dataset.bonusOrder;
        delete elements.host.dataset.bonusOrderAward;
      }
      setDatasetValue(elements.shell, "bonusState", plan.stateId);
      setDatasetValue(elements.shell, "bonusBeat", plan.beat.id);
      setDatasetValue(elements.shell, "bonusPhase", text(plan.beat.phase || "hold"));
      setDatasetValue(elements.shell, "bonusHeat", heat);
      setDatasetValue(elements.shell, "bonusGames", games);
      setDatasetValue(elements.shell, "bonusOrigin", origin);
      setDatasetValue(elements.shell, "bonusOpponent", text(payload.opponentId || ""));
      if (milestone && milestone !== "routine") setDatasetValue(elements.shell, "bonusMilestone", milestone);
      else delete elements.shell.dataset.bonusMilestone;
      const rival = stage.querySelector(".treasure-bonus-rival");
      const opponentId = text(payload.opponentId || "");
      if (rival && origin !== "boss-victory" && TREASURE_TABLE_ACTORS[opponentId]) {
        if (rival.getAttribute("src") !== TREASURE_TABLE_ACTORS[opponentId]) rival.src = TREASURE_TABLE_ACTORS[opponentId];
        rival.dataset.opponent = opponentId;
      }
      const counter = stage.querySelector(".treasure-bonus-counter strong");
      if (counter) counter.textContent = String(games);
      const status = stage.querySelector(".treasure-feature-status");
      if (status) {
        status.querySelector("strong").textContent = `今回のBONUS ＋${Math.max(0, Number(payload.totalWin) || 0)} WIN`;
        status.querySelector("span").textContent = games > 0 ? "ミミ「まだまだ、いくよ！」" : origin === "boss-victory" ? "ミミ「みんなで勝ち取ったね！」" : "ミミ「この勢いで、続きをいこう！」";
      }
      const orderAward = stage.querySelector(".treasure-bonus-order-award");
      if (orderAward) {
        orderAward.dataset.kind = awardKind;
        orderAward.dataset.order = orderId;
        const seal = orderAward.querySelector(".treasure-bonus-order-seal b");
        const headline = orderAward.querySelector(".treasure-bonus-order-copy strong");
        const title = orderAward.querySelector(".treasure-bonus-order-copy span");
        const progress = orderAward.querySelector(".treasure-bonus-order-copy em");
        if (seal) seal.textContent = TREASURE_ROYAL_ORDER_CRESTS[orderId] || "";
        if (headline) headline.textContent = awardKind === "new"
          ? "NEW CREST"
          : awardKind === "stamp"
            ? "CROWN STAMP"
            : awardKind === "complete" ? "ROYAL CROWN COMPLETE" : awardKind === "miss" ? "ORDER MISSED" : "";
        if (title) title.textContent = orderTitle;
        if (progress) progress.textContent = awardKind === "miss"
          ? orderProgress
          : awardKind === "complete"
            ? "CROWN ARCHIVE 5/5"
            : awardKind === "stamp"
              ? `STAMP +1 · ARCHIVE ${crestCount}/5`
              : awardKind === "new" ? `ARCHIVE ${crestCount}/5` : "";
      }
      const completedGames = Math.max(0, Math.min(10, 10 - games));
      stage.querySelectorAll(".treasure-bonus-progress i").forEach(function (step, index) {
        step.dataset.active = index < completedGames ? "true" : "false";
      });
      const route = stage.querySelector(".treasure-bonus-route");
      if (route) route.textContent = origin === "boss-victory" ? "勝利のポット" : "対戦卓へ戻る";
    }

    function clearTreasurePokerState() {
      [
        "data-treasure-poker-state",
        "data-treasure-scene",
        "data-treasure-beat",
        "data-treasure-beat-index",
        "data-treasure-focus",
        "data-treasure-cast",
        "data-treasure-impact",
        "data-treasure-reveal-count",
        "data-treasure-level",
        "data-treasure-heat",
        "data-treasure-symbol",
        "data-treasure-phase",
      ].forEach(function (attribute) { elements.host.removeAttribute(attribute); });
      [
        "data-treasure-beat",
        "data-treasure-focus",
        "data-treasure-cast",
        "data-treasure-impact",
        "data-treasure-level",
        "data-treasure-heat",
        "data-treasure-symbol",
        "data-treasure-phase",
      ].forEach(function (attribute) { elements.shell.removeAttribute(attribute); });
    }

    function clearTreasureTrialState() {
      [
        "data-trial-state",
        "data-trial-scene",
        "data-trial-beat",
        "data-trial-heat",
        "data-trial-aura",
        "data-trial-score",
        "data-trial-type",
      ].forEach(function (attribute) { elements.host.removeAttribute(attribute); });
      [
        "data-trial-state",
        "data-trial-beat",
        "data-trial-heat",
        "data-trial-aura",
        "data-trial-score",
      ].forEach(function (attribute) { elements.shell.removeAttribute(attribute); });
    }

    function clearTreasureBonusState() {
      [
        "data-bonus-state",
        "data-bonus-scene",
        "data-bonus-beat",
        "data-bonus-phase",
        "data-bonus-heat",
        "data-bonus-games",
        "data-bonus-origin",
        "data-bonus-opponent",
        "data-bonus-milestone",
        "data-bonus-order",
        "data-bonus-order-award",
      ].forEach(function (attribute) { elements.host.removeAttribute(attribute); });
      [
        "data-bonus-state",
        "data-bonus-beat",
        "data-bonus-phase",
        "data-bonus-heat",
        "data-bonus-games",
        "data-bonus-origin",
        "data-bonus-opponent",
        "data-bonus-milestone",
      ].forEach(function (attribute) { elements.shell.removeAttribute(attribute); });
    }

    function clearTreasureNormalState() {
      ["data-normal-event", "data-normal-beat", "data-normal-phase", "data-normal-heat"]
        .forEach(function (attribute) { elements.host.removeAttribute(attribute); });
      ["data-normal-event", "data-normal-beat", "data-normal-phase", "data-normal-heat"]
        .forEach(function (attribute) { elements.shell.removeAttribute(attribute); });
    }

    function play(nextSignal) {
      if (destroyed || !nextSignal || !EFFECT_IDS.includes(nextSignal.effectId)) return false;
      try {
        const previousTreasurePokerSignal = activeTreasurePokerSignal;
        const requestedSceneId = text(nextSignal.payload && nextSignal.payload.sceneId);
        const requestedTrialScene = requestedSceneId.startsWith("treasure.trial.");
        if (requestedSceneId === "treasure.normal.event" || requestedSceneId === "treasure.character.emotion" || requestedSceneId.startsWith("treasure.table.")) {
          activeTreasurePokerSignal = null;
          clearTreasurePokerState();
          clearTreasureTrialState();
          clearTreasureBonusState();
        } else if (requestedTrialScene) {
          activeTreasurePokerSignal = null;
          clearTreasurePokerState();
          clearTreasureBonusState();
          clearTreasureNormalState();
        } else if (requestedSceneId.startsWith("treasure.bonus.")) {
          activeTreasurePokerSignal = null;
          clearTreasurePokerState();
          clearTreasureTrialState();
          clearTreasureNormalState();
        } else if (requestedSceneId.startsWith("treasure.boss.") || requestedSceneId === "treasure.reward") {
          activeTreasurePokerSignal = nextSignal;
          clearTreasureTrialState();
          clearTreasureBonusState();
          clearTreasureNormalState();
        } else if (nextSignal.effectId === "bonus") {
          activeTreasurePokerSignal = null;
          clearTreasurePokerState();
          clearTreasureTrialState();
          clearTreasureBonusState();
          clearTreasureNormalState();
        }
        const previousSceneId = text(elements.shell.dataset.presentationScene);
        if (requestedSceneId) elements.shell.dataset.presentationScene = requestedSceneId;
        else if (nextSignal.effectId === "bonus") elements.shell.removeAttribute("data-presentation-scene");
        const before = controller.snapshot();
        if (nextSignal.replace && (before.effectId || before.queued)) {
          controller.cancel("game-phase-transition");
        }
        const accepted = controller.play(nextSignal.effectId, nextSignal.payload || {}, nextSignal.timeline || null);
        if (accepted) {
          elements.host.dataset.bridgeStatus = "ready";
          delete elements.host.dataset.bridgeError;
          elements.host.dataset.bridgeSource = nextSignal.source || "direct";
          elements.host.dataset.bridgeEffect = nextSignal.effectId;
          const sceneId = text(nextSignal.payload && nextSignal.payload.sceneId);
          if (sceneId) elements.shell.dataset.presentationScene = sceneId;
          else if (nextSignal.effectId === "bonus") {
            elements.shell.removeAttribute("data-presentation-scene");
            clearTreasurePokerState();
            clearTreasureTrialState();
            clearTreasureBonusState();
          } else if (previousSceneId.startsWith("treasure.trial.")) {
            elements.shell.removeAttribute("data-presentation-scene");
            clearTreasureTrialState();
          }
        }
        if (!accepted) {
          activeTreasurePokerSignal = previousTreasurePokerSignal;
          if (previousSceneId) elements.shell.dataset.presentationScene = previousSceneId;
          else elements.shell.removeAttribute("data-presentation-scene");
        }
        return accepted;
      } catch (_error) {
        elements.host.dataset.bridgeStatus = "fail-soft";
        elements.host.dataset.bridgeError = _error && _error.message
          ? String(_error.message).slice(0, 160)
          : "scene-playback-error";
        return false;
      }
    }

    function syncReducedMotion() {
      const next = readReducedMotion();
      if (next === reducedMotion) return;
      reducedMotion = next;
      try { controller.setReducedMotion(next); } catch (_error) { /* fail-soft */ }
    }

    function touches(record, element) {
      return record.target === element
        || (typeof element.contains === "function" && element.contains(record.target));
    }

    function setLegacyHidden(hidden) {
      [elements.characterDialog, elements.adventureEvent, elements.chance, elements.cutin, elements.sequence]
        .forEach(function (element) {
          if (hidden) element.setAttribute("aria-hidden", "true");
          else element.removeAttribute("aria-hidden");
        });
    }

    function clearStaleLegacy() {
      visibleChanceSignalKey = "";
      visibleResultSignalKey = "";
      elements.characterDialog.classList.remove("show");
      elements.adventureEvent.classList.remove("pop");
      elements.chance.classList.remove("show", "hot");
      elements.cutin.classList.remove("show");
      elements.sequence.classList.remove("show");
    }

    function syncPresentationState(frame) {
      const active = frame && (frame.status === "playing" || frame.status === "paused");
      const sceneId = text(elements.shell.dataset.presentationScene);
      const gamePhase = text(elements.shell.dataset.gamePhase);
      const treasureTrialHold = gamePhase === "trial" && sceneId.startsWith("treasure.trial.");
      const treasureBonusHold = gamePhase === "bonus" && sceneId.startsWith("treasure.bonus.");
      const treasureBossHold = Boolean(
        elements.bossSprite.classList.contains("show")
        && (sceneId.startsWith("treasure.boss.") || sceneId === "treasure.reward")
      );
      const visible = Boolean(active || treasureTrialHold || treasureBonusHold || treasureBossHold);
      if (elements.shell.classList.contains("presentation-active") !== visible) {
        elements.shell.classList.toggle("presentation-active", visible);
      }
      setDatasetValue(elements.shell, "presentationStatus", frame?.status || "idle");
      setLegacyHidden(visible);
      if (!visible && frame && ["completed", "cancelled", "destroyed", "error"].includes(frame.status)) {
        clearStaleLegacy();
      }
    }

    function onControllerLifecycle(event) {
      if (destroyed || !event || !event.frame || typeof windowRef.CustomEvent !== "function") return;
      const resolved = resolvedFrame(event.frame);
      const beat = resolved && resolved.beat || {};
      const payload = resolved && resolved.payload || {};
      const sceneId = text(payload.sceneId || elements.shell.dataset.presentationScene);
      const beatId = text(beat.id || `beat-${Math.max(0, Number(resolved.beatIndex) || 0)}`);
      const cueId = sceneId && beatId
        ? `${sceneId}.${beatId}`
        : text(event.cue || beat.cue);
      if (sceneId === "treasure.normal.event" && ["completed", "cancelled", "error", "destroyed"].includes(text(resolved.status))) {
        const rival = elements.shell.querySelector("#casinoOpponent");
        const opponentId = text(elements.shell.dataset.chapter1DisplayOpponent);
        if (rival && TREASURE_TABLE_ACTORS[opponentId]) {
          if (rival.getAttribute("src") !== TREASURE_TABLE_ACTORS[opponentId]) rival.src = TREASURE_TABLE_ACTORS[opponentId];
          delete rival.dataset.eventActor;
          rival.alt = TREASURE_TABLE_ACTOR_NAMES[opponentId];
        }
      }
      windowRef.dispatchEvent(new windowRef.CustomEvent(PRESENTATION_LIFECYCLE_EVENT, {
        detail: Object.freeze({
          type: text(event.type),
          runId: event.runId == null ? null : Number(event.runId),
          effectId: text(resolved.effectId),
          sceneId: sceneId,
          beatIndex: Number(resolved.beatIndex),
          beatId: beatId,
          cueId: cueId,
          effectCue: text(event.cue || beat.cue),
          status: text(resolved.status),
          elapsed: Number(resolved.elapsed) || 0,
          duration: Number(resolved.duration) || 0,
          reason: text(event.reason || resolved.reason),
          payload: payload,
        }),
      }));
    }

    function onMutations(records) {
      if (destroyed) return;
      const signals = [];

      const bossVisibilityTouched = records.some(function (record) {
        return touches(record, elements.bossSprite) && record.attributeName === "class";
      });
      if (
        bossVisibilityTouched
        && activeTreasurePokerSignal
        && !elements.bossSprite.classList.contains("show")
        && elements.bossSprite.dataset.state === "idle"
      ) {
        activeTreasurePokerSignal = null;
        elements.shell.removeAttribute("data-presentation-scene");
        clearTreasurePokerState();
        controller.cancel("treasure-boss-reset");
      }

      const motionTouched = records.some(function (record) {
        return touches(record, elements.motion)
          || (record.target === elements.shell && record.attributeName === "class");
      });
      if (motionTouched) syncReducedMotion();

      const gamePhaseTouched = records.some(function (record) {
        return record.target === elements.shell && record.attributeName === "data-game-phase";
      });
      if (gamePhaseTouched) syncPresentationState(controller.snapshot());

      const motifTouched = records.some(function (record) {
        return record.target === elements.shell && record.attributeName === "data-motif";
      });
      if (motifTouched && elements.shell.dataset.motif === "golden-gate") {
        signals.push(goldenGateSignal());
      }

      const chanceTouched = records.some(function (record) { return touches(record, elements.chance); });
      const treasureChapter = text(elements.shell.dataset.episode) === "treasure";
      const semanticTreasureSceneId = text(activeTreasurePokerSignal && activeTreasurePokerSignal.payload && activeTreasurePokerSignal.payload.sceneId);
      const activeSceneId = text(elements.shell.dataset.presentationScene);
      const treasureSceneOwnsChance = Boolean(
        (
          semanticTreasureSceneId
          && (semanticTreasureSceneId.startsWith("treasure.boss.") || semanticTreasureSceneId === "treasure.reward")
        )
        || (activeSceneId.startsWith("treasure.trial.") && elements.shell.classList.contains("presentation-active"))
        || (activeSceneId.startsWith("treasure.bonus.") && elements.shell.classList.contains("presentation-active"))
      );
      if (chanceTouched && elements.chance.classList.contains("show") && !treasureSceneOwnsChance && !treasureChapter) {
        const candidate = classifyChance({
          rank: elements.chanceRank.textContent,
          title: elements.chanceTitle.textContent,
          story: elements.chanceStory.textContent,
          hot: elements.chance.classList.contains("hot"),
        });
        const key = signalSignature(candidate);
        if (key && key !== visibleChanceSignalKey) {
          visibleChanceSignalKey = key;
          signals.push(candidate);
        }
      } else if (chanceTouched && !elements.chance.classList.contains("show")) {
        visibleChanceSignalKey = "";
      }

      const resultTouched = records.some(function (record) { return touches(record, elements.result); });
      const treasureBossOwnsUpperLcd = activeSceneId.startsWith("treasure.boss.")
        && documentRef.getElementById("bossSprite")?.classList.contains("show");
      const treasureTrialOwnsUpperLcd = activeSceneId.startsWith("treasure.trial.")
        && elements.shell.classList.contains("presentation-active");
      const treasureBonusOwnsUpperLcd = activeSceneId.startsWith("treasure.bonus.")
        && elements.shell.classList.contains("presentation-active");
      if (resultTouched && !treasureBossOwnsUpperLcd && !treasureTrialOwnsUpperLcd && !treasureBonusOwnsUpperLcd && !treasureChapter) {
        const candidate = classifyResult(elements.result.textContent);
        const key = signalSignature(candidate);
        if (!key) visibleResultSignalKey = "";
        else if (key !== visibleResultSignalKey) {
          visibleResultSignalKey = key;
          signals.push(candidate);
        }
      }

      play(strongestSignal(signals));
    }

    function onPresentationEvent(event) {
      const detail = event && event.detail;
      if (!detail || !EFFECT_IDS.includes(detail.effectId)) return;
      const copy = detail.narrative
        ? narrative(
          detail.narrative.speaker,
          detail.narrative.headline,
          detail.narrative.line || detail.narrative.body,
          detail.narrative.nextAction,
        )
        : null;
      play(signal(detail.effectId, "custom-event", copy, detail.payload, { replace: Boolean(detail.replace) }));
    }

    function playScene(sceneId, payload, source = "direct-scene") {
      const safeSceneId = text(sceneId);
      if (!TREASURE_SCENE_DEFINITIONS[safeSceneId]) return false;
      return play(treasureSceneSignal(safeSceneId, payload, source));
    }

    function onSceneEvent(event) {
      const detail = event && event.detail;
      if (!detail || !TREASURE_SCENE_DEFINITIONS[detail.sceneId]) return;
      playScene(detail.sceneId, detail.payload, "scene-event");
    }

    function onMediaChange() {
      syncReducedMotion();
    }

    try {
      renderer = rendererApi.createPresentationRenderer({
        host: elements.host,
        choreography: choreography,
        narrative: {
          root: elements.narrativeRoot,
          speaker: elements.speaker,
          headline: elements.headline,
          line: elements.line,
          nextAction: elements.nextAction,
        },
        artAssets: ART_ASSETS,
        resolveArtAsset: function (family) {
          const episode = text(elements.shell?.dataset?.episode);
          const semanticSceneId = text(elements.shell?.dataset?.presentationScene);
          const treasureOwnsItsStage = episode === "treasure"
            && semanticSceneId.startsWith("treasure.");
          // Every current Chapter 1 semantic scene is carried by its casino,
          // table, VIP/CZ/BONUS, or poker stage. Loading a superseded generic
          // emblem behind it is both invisible and capable of producing an
          // avoidable 404.
          if (treasureOwnsItsStage) return "";
          if (episode === "poker" && family === "chance") return ART_ASSETS.chancePoker;
          if (episode === "poker" && family === "bonus") return ART_ASSETS.bonusPoker;
          if (episode === "race" && family === "chance") return ART_ASSETS.chanceRace;
          if (episode === "race" && family === "bonus") return ART_ASSETS.bonusRace;
          return ART_ASSETS[family];
        },
        artMode: "hybrid",
      });
      controller = presentation.createPresentationController({
        definitions: effects.definitions,
        render: function (frame) {
          const resolved = resolvedFrame(frame);
          syncPresentationState(resolved);
          renderer.render(resolved);
          if (activeTreasurePokerSignal) syncTreasurePokerFrame(resolved);
          syncTreasureNormalFrame(resolved);
          syncTreasureTrialFrame(resolved);
          syncTreasureBonusFrame(resolved);
          syncCharacterEmotionFrame(resolved);
        },
      });
      unsubscribeControllerLifecycle = controller.subscribe(onControllerLifecycle);
      reducedMotion = readReducedMotion();
      controller.setReducedMotion(reducedMotion);
      observer = new MutationObserverRef(onMutations);
      // #resultAnnouncer is a sibling of #gameShell inside the SLOT view, so
      // one observer intentionally covers their nearest shared runtime scope.
      observer.observe(observationRoot, {
        subtree: true,
        childList: true,
        characterData: true,
        attributes: true,
        attributeFilter: ["class", "aria-pressed", "data-motif", "data-game-phase"],
      });
      windowRef.addEventListener("mimi:presentation", onPresentationEvent);
      windowRef.addEventListener("mimi:scene", onSceneEvent);
      windowRef.addEventListener("pagehide", destroy, { once: true });
      if (media && typeof media.addEventListener === "function") media.addEventListener("change", onMediaChange);
      else if (media && typeof media.addListener === "function") media.addListener(onMediaChange);
      elements.host.dataset.bridgeStatus = "ready";
      elements.narrativeRoot.dataset.presentationBridge = "ready";
      elements.shell.classList.add("presentation-bridge-ready");
    } catch (_error) {
      if (observer) observer.disconnect();
      if (renderer && typeof renderer.destroy === "function") renderer.destroy();
      elements.host.dataset.bridgeStatus = "fail-soft";
      return inertBridge("initialization-failed");
    }

    function destroy() {
      if (destroyed) return false;
      destroyed = true;
      if (observer) observer.disconnect();
      windowRef.removeEventListener("mimi:presentation", onPresentationEvent);
      windowRef.removeEventListener("mimi:scene", onSceneEvent);
      windowRef.removeEventListener("pagehide", destroy);
      if (media && typeof media.removeEventListener === "function") media.removeEventListener("change", onMediaChange);
      else if (media && typeof media.removeListener === "function") media.removeListener(onMediaChange);
      if (unsubscribeControllerLifecycle) unsubscribeControllerLifecycle();
      unsubscribeControllerLifecycle = null;
      if (controller && typeof controller.destroy === "function") controller.destroy();
      if (renderer && typeof renderer.destroy === "function") renderer.destroy();
      elements.shell.classList.remove("presentation-active", "presentation-bridge-ready");
      elements.shell.removeAttribute("data-presentation-status");
      elements.shell.removeAttribute("data-presentation-scene");
      clearTreasurePokerState();
      clearTreasureTrialState();
      setLegacyHidden(false);
      elements.host.dataset.bridgeStatus = "destroyed";
      return true;
    }

    return Object.freeze({
      ready: true,
      play: play,
      playScene: playScene,
      cancel: function (reason) { return !destroyed && controller.cancel(reason || "developer-cancel"); },
      pause: function () { return !destroyed && controller.pause(); },
      resume: function () { return !destroyed && controller.resume(); },
      seek: function (milliseconds) { return !destroyed && controller.seek(milliseconds); },
      stepBeat: function (direction) { return !destroyed && controller.stepBeat(direction); },
      setSpeed: function (multiplier) { return !destroyed && controller.setSpeed(multiplier); },
      snapshot: function () {
        return Object.freeze({
          ready: !destroyed,
          reducedMotion: reducedMotion,
          controller: controller.snapshot(),
          renderer: renderer.snapshot(),
        });
      },
      destroy: destroy,
    });
  }

  return Object.freeze({
    EFFECT_IDS: EFFECT_IDS,
    PRESENTATION_LIFECYCLE_EVENT: PRESENTATION_LIFECYCLE_EVENT,
    EFFECT_PRIORITY: EFFECT_PRIORITY,
    ART_ASSETS: ART_ASSETS,
    TREASURE_SCENE_DEFINITIONS: TREASURE_SCENE_DEFINITIONS,
    TREASURE_SCENE_BEAT_PLANS: TREASURE_SCENE_BEAT_PLANS,
    classifyChance: classifyChance,
    treasureSceneSignal: treasureSceneSignal,
    classifyResult: classifyResult,
    goldenGateSignal: goldenGateSignal,
    strongestSignal: strongestSignal,
    createGamePresentationBridge: createGamePresentationBridge,
  });
});
