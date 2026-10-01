(function (root, factory) {
  "use strict";

  const api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  if (root) {
    root.MimiPresentationEffects = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function deepFreeze(value, seen) {
    if (
      value === null ||
      (typeof value !== "object" && typeof value !== "function")
    ) {
      return value;
    }

    const visited = seen || new WeakSet();
    if (visited.has(value)) return value;
    visited.add(value);

    Reflect.ownKeys(value).forEach(function (key) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor) return;
      if (Object.prototype.hasOwnProperty.call(descriptor, "value")) {
        deepFreeze(descriptor.value, visited);
      }
      if (descriptor.get) deepFreeze(descriptor.get, visited);
      if (descriptor.set) deepFreeze(descriptor.set, visited);
    });

    return Object.freeze(value);
  }

  function beat(config) {
    return {
      at: config.at,
      duration: config.duration,
      visual: config.visual,
      cue: config.cue,
      headline: config.headline,
      speaker: config.speaker,
      line: config.line,
      objective: config.objective,
      tone: config.tone,
      ariaText: config.ariaText,
    };
  }

  const IDS = [
    "notice",
    "chance",
    "hot",
    "goldenGate",
    "boss",
    "revive",
    "bonus",
    "jackpot",
  ];

  const PAYLOAD_DEFAULTS = {
    chance: {
      omenSource: "予兆の光",
      clueLabel: "手掛かり",
      clueCount: 2,
      nextAction: "PUSH",
    },
    goldenGate: {
      gateSpeaker: "ミミ",
    },
    boss: {
      bossName: "対立者",
      resistanceLabel: "抵抗",
    },
    bonus: {
      celebrationName: "リゾート祝祭",
      collectible: "祝祭の光",
      freeGameCount: 20,
    },
  };

  const definitions = {
    notice: {
      id: "notice",
      priority: 10,
      totalDuration: 1800,
      beats: [
        beat({
          at: 0,
          duration: 550,
          visual: "notice-glint",
          cue: "notice.arrival",
          headline: "NOTICE",
          speaker: "ミミ",
          line: "画面の端に予告灯がともった。\n次の変化へ目を向けて。",
          objective: "中央LCDの変化を確認する",
          tone: "informative",
          ariaText:
            "ミミ。NOTICE。画面の端に予告灯が点灯。次は中央LCDの変化を確認。",
        }),
        beat({
          at: 550,
          duration: 650,
          visual: "notice-message",
          cue: "notice.explain",
          headline: "予告を確認",
          speaker: "ミミ",
          line: "新しい合図を捕まえた。\n示された狙いを覚えて。",
          objective: "表示された狙いを確認する",
          tone: "focused",
          ariaText:
            "ミミ。予告を確認。新しい合図を捕捉。次は表示された狙いを確認。",
        }),
        beat({
          at: 1200,
          duration: 600,
          visual: "notice-focus",
          cue: "notice.ready",
          headline: "準備して",
          speaker: "ミミ",
          line: "予告が中央へ収束した。\n次の停止に備えて。",
          objective: "次のリール停止に備える",
          tone: "ready",
          ariaText:
            "ミミ。準備して。予告が中央へ収束。次のリール停止に備える。",
        }),
      ],
      reducedBeats: [
        beat({
          at: 0,
          duration: 700,
          visual: "notice-static",
          cue: "notice.reduced.arrival",
          headline: "NOTICE",
          speaker: "ミミ",
          line: "予告灯が点灯した。\n中央の合図を確認して。",
          objective: "中央LCDの合図を確認する",
          tone: "informative",
          ariaText:
            "ミミ。NOTICE。予告灯が点灯。次は中央LCDの合図を確認。",
        }),
        beat({
          at: 700,
          duration: 700,
          visual: "notice-focus-static",
          cue: "notice.reduced.ready",
          headline: "準備して",
          speaker: "ミミ",
          line: "予告の狙いが決まった。\n次の停止に備えて。",
          objective: "次のリール停止に備える",
          tone: "ready",
          ariaText:
            "ミミ。準備して。予告の狙いが確定。次のリール停止に備える。",
        }),
      ],
    },

    chance: {
      id: "chance",
      priority: 20,
      totalDuration: 3550,
      beats: [
        beat({
          at: 0,
          duration: 600,
          visual: "premonition",
          cue: "chance.premonition",
          headline: "{omenSource}",
          speaker: "ミミ",
          line: "{omenSource}が一点へ集まった。\n最初の{clueLabel}を追って。",
          objective: "最初の{clueLabel}を確認する",
          tone: "mysterious",
          ariaText:
            "ミミ。{omenSource}。光が集結。次は最初の{clueLabel}を確認。",
        }),
        beat({
          at: 600,
          duration: 650,
          visual: "key-1",
          cue: "chance.key-one",
          headline: "{clueLabel} 1",
          speaker: "ミミ",
          line: "最初の{clueLabel}を見つけた。\n次の合図を逃さないで。",
          objective: "次の{clueLabel}を確認する",
          tone: "hopeful",
          ariaText:
            "ミミ。{clueLabel}1。最初の{clueLabel}を確認。次は二つ目の{clueLabel}を確認。",
        }),
        beat({
          at: 1250,
          duration: 650,
          visual: "key-2",
          cue: "chance.key-two",
          headline: "{clueLabel} {clueCount}",
          speaker: "ミミ",
          line: "{clueCount}つの{clueLabel}がそろった。\n封印の完成を見届けて。",
          objective: "封印の完成を確認する",
          tone: "rising",
          ariaText:
            "ミミ。{clueLabel}{clueCount}。必要な{clueLabel}が接続。次は封印の完成を確認。",
        }),
        beat({
          at: 1900,
          duration: 750,
          visual: "chance-seal",
          cue: "chance.seal",
          headline: "CHANCE",
          speaker: "ミミ",
          line: "{clueCount}つの{clueLabel}が封印を開いた。\n{nextAction}の合図を待って。",
          objective: "{nextAction}の合図を確認する",
          tone: "charged",
          ariaText:
            "ミミ。CHANCE。{clueCount}つの{clueLabel}で封印を解放。次は{nextAction}の合図を確認。",
        }),
        beat({
          at: 2650,
          duration: 900,
          visual: "push",
          cue: "chance.push",
          headline: "{nextAction}",
          speaker: "ミミ",
          line: "{nextAction}の準備ができた。\n今すぐ結果を確かめて。",
          objective: "{nextAction}を実行する",
          tone: "command",
          ariaText:
            "ミミ。{nextAction}。操作の準備が完了。今すぐ{nextAction}を実行。",
        }),
      ],
      reducedBeats: [
        beat({
          at: 0,
          duration: 650,
          visual: "premonition-static",
          cue: "chance.reduced.premonition",
          headline: "{omenSource}",
          speaker: "ミミ",
          line: "{omenSource}が集まった。\n{clueCount}つの{clueLabel}を探して。",
          objective: "{clueLabel}を確認する",
          tone: "mysterious",
          ariaText:
            "ミミ。{omenSource}。光が集結。次は{clueCount}つの{clueLabel}を確認。",
        }),
        beat({
          at: 650,
          duration: 750,
          visual: "keys-static",
          cue: "chance.reduced.keys",
          headline: "{clueLabel} ×{clueCount}",
          speaker: "ミミ",
          line: "{clueCount}つの{clueLabel}がそろった。\nCHANCEの封印を見て。",
          objective: "CHANCEの封印を確認する",
          tone: "rising",
          ariaText:
            "ミミ。{clueLabel}が{clueCount}つ完成。次はCHANCEの封印を確認。",
        }),
        beat({
          at: 1400,
          duration: 850,
          visual: "push-static",
          cue: "chance.reduced.push",
          headline: "{nextAction}",
          speaker: "ミミ",
          line: "CHANCEが開き{nextAction}の準備が完了。\n今すぐ実行して。",
          objective: "{nextAction}を実行する",
          tone: "command",
          ariaText:
            "ミミ。{nextAction}。CHANCEが開き操作可能。今すぐ{nextAction}を実行。",
        }),
      ],
    },

    hot: {
      id: "hot",
      priority: 30,
      totalDuration: 2700,
      beats: [
        beat({
          at: 0,
          duration: 800,
          visual: "heat-red",
          cue: "hot.red",
          headline: "RED",
          speaker: "ミミ",
          line: "期待の火が赤く燃えた。\n次の昇格を待って。",
          objective: "金色への昇格を待つ",
          tone: "urgent",
          ariaText:
            "ミミ。RED。期待の火が赤く点灯。次は金色への昇格を待つ。",
        }),
        beat({
          at: 800,
          duration: 850,
          visual: "heat-gold",
          cue: "hot.gold",
          headline: "GOLD",
          speaker: "ミミ",
          line: "赤い火が金色へ昇格した。\n虹の決着を見届けて。",
          objective: "虹色への最終昇格を待つ",
          tone: "triumphant",
          ariaText:
            "ミミ。GOLD。赤い火が金色へ昇格。次は虹色への最終昇格を待つ。",
        }),
        beat({
          at: 1650,
          duration: 1050,
          visual: "heat-rainbow",
          cue: "hot.rainbow",
          headline: "RAINBOW HOT",
          speaker: "ミミ",
          line: "金の熱が虹色へ到達した。\nPUSHで決着をつけて。",
          objective: "PUSHを押して結果を確定する",
          tone: "maximum",
          ariaText:
            "ミミ。RAINBOW HOT。期待度が虹色へ到達。次はPUSHで結果を確定。",
        }),
      ],
      reducedBeats: [
        beat({
          at: 0,
          duration: 700,
          visual: "heat-step-static",
          cue: "hot.reduced.red-gold",
          headline: "RED → GOLD",
          speaker: "ミミ",
          line: "期待色が赤から金へ昇格した。\n虹色を待って。",
          objective: "虹色への昇格を待つ",
          tone: "triumphant",
          ariaText:
            "ミミ。REDからGOLD。期待色が金へ昇格。次は虹色を待つ。",
        }),
        beat({
          at: 700,
          duration: 900,
          visual: "heat-rainbow-static",
          cue: "hot.reduced.rainbow",
          headline: "RAINBOW HOT",
          speaker: "ミミ",
          line: "期待色が虹へ到達した。\nPUSHで決着をつけて。",
          objective: "PUSHを押して結果を確定する",
          tone: "maximum",
          ariaText:
            "ミミ。RAINBOW HOT。期待色が虹へ到達。次はPUSHで結果を確定。",
        }),
      ],
    },

    goldenGate: {
      id: "goldenGate",
      priority: 50,
      totalDuration: 3500,
      beats: [
        beat({
          at: 0,
          duration: 700,
          visual: "gate-lock-1",
          cue: "golden-gate.lock-one",
          headline: "LOCK 1 OPEN",
          speaker: "{gateSpeaker}",
          line: "第1錠が光を受けて開いた。\n第2錠へ力を送れ。",
          objective: "第2錠の解錠を待つ",
          tone: "ceremonial",
          ariaText:
            "{gateSpeaker}。LOCK 1 OPEN。第1錠を解錠。次は第2錠を待つ。",
        }),
        beat({
          at: 700,
          duration: 700,
          visual: "gate-lock-2",
          cue: "golden-gate.lock-two",
          headline: "LOCK 2 OPEN",
          speaker: "{gateSpeaker}",
          line: "第2錠も金色にほどけた。\n最後の錠へ進め。",
          objective: "第3錠の解錠を待つ",
          tone: "rising",
          ariaText:
            "{gateSpeaker}。LOCK 2 OPEN。第2錠を解錠。次は第3錠を待つ。",
        }),
        beat({
          at: 1400,
          duration: 750,
          visual: "gate-lock-3",
          cue: "golden-gate.lock-three",
          headline: "LOCK 3 OPEN",
          speaker: "{gateSpeaker}",
          line: "第3錠まで解錠した。\n黄金門の開放を見届けよ。",
          objective: "黄金門が開くまで中央を見る",
          tone: "charged",
          ariaText:
            "{gateSpeaker}。LOCK 3 OPEN。三つの錠を解錠。次は黄金門の開放を待つ。",
        }),
        beat({
          at: 2150,
          duration: 1350,
          visual: "gate-open",
          cue: "golden-gate.open",
          headline: "GOLDEN GATE",
          speaker: "{gateSpeaker}",
          line: "三つの錠が黄金門を開いた。\n門の先へ進んで。",
          objective: "開いた門から上位演出へ進む",
          tone: "triumphant",
          ariaText:
            "{gateSpeaker}。GOLDEN GATE。三つの錠で黄金門が開放。次は門の先へ進む。",
        }),
      ],
      reducedBeats: [
        beat({
          at: 0,
          duration: 850,
          visual: "gate-locks-static",
          cue: "golden-gate.reduced.locks",
          headline: "3 LOCKS OPEN",
          speaker: "{gateSpeaker}",
          line: "三つの錠を順に解錠した。\n黄金門を確認せよ。",
          objective: "黄金門の開放を確認する",
          tone: "ceremonial",
          ariaText:
            "{gateSpeaker}。3 LOCKS OPEN。三段階の解錠が完了。次は黄金門を確認。",
        }),
        beat({
          at: 850,
          duration: 900,
          visual: "gate-open-static",
          cue: "golden-gate.reduced.open",
          headline: "GOLDEN GATE",
          speaker: "{gateSpeaker}",
          line: "黄金門が完全に開いた。\n門の先へ進んで。",
          objective: "開いた門から上位演出へ進む",
          tone: "triumphant",
          ariaText:
            "{gateSpeaker}。GOLDEN GATE。黄金門が完全開放。次は門の先へ進む。",
        }),
      ],
    },

    boss: {
      id: "boss",
      priority: 40,
      totalDuration: 3200,
      beats: [
        beat({
          at: 0,
          duration: 700,
          visual: "boss-silhouette",
          cue: "boss.silhouette",
          headline: "UNKNOWN",
          speaker: "ミミ",
          line: "闇の向こうに巨影が現れた。\n正体の開示を待って。",
          objective: "ボスの正体が現れるまで中央を見る",
          tone: "ominous",
          ariaText:
            "ミミ。UNKNOWN。闇の向こうに巨影が出現。次はボスの正体を待つ。",
        }),
        beat({
          at: 700,
          duration: 800,
          visual: "boss-reveal",
          cue: "boss.reveal",
          headline: "BOSS APPEARS",
          speaker: "{bossName}",
          line: "{bossName}が姿を現した。\n{resistanceLabel}を確認して。",
          objective: "{resistanceLabel}の初期値を確認する",
          tone: "threatening",
          ariaText:
            "{bossName}。BOSS APPEARS。対立者が姿を現した。次は{resistanceLabel}を確認。",
        }),
        beat({
          at: 1500,
          duration: 650,
          visual: "boss-hp",
          cue: "boss.hp",
          headline: "{resistanceLabel} 100%",
          speaker: "システム",
          line: "{resistanceLabel}を100%で計測。\nWINラインで減らして。",
          objective: "WINラインで{resistanceLabel}を減らす",
          tone: "tactical",
          ariaText:
            "システム。{resistanceLabel}100%。抵抗の計測完了。次はWINラインで減らす。",
        }),
        beat({
          at: 2150,
          duration: 1050,
          visual: "boss-order",
          cue: "boss.order",
          headline: "BATTLE START",
          speaker: "ミミ",
          line: "対話の準備が整った。\nリールを回してWINを狙って。",
          objective: "SPINしてWINラインを作る",
          tone: "command",
          ariaText:
            "ミミ。BATTLE START。対話の準備が完了。次はSPINしてWINラインを作る。",
        }),
      ],
      reducedBeats: [
        beat({
          at: 0,
          duration: 800,
          visual: "boss-reveal-static",
          cue: "boss.reduced.reveal",
          headline: "BOSS APPEARS",
          speaker: "{bossName}",
          line: "巨影の正体、{bossName}が現れた。\n{resistanceLabel}を確認して。",
          objective: "{resistanceLabel}を確認する",
          tone: "threatening",
          ariaText:
            "{bossName}。BOSS APPEARS。巨影の正体が出現。次は{resistanceLabel}を確認。",
        }),
        beat({
          at: 800,
          duration: 700,
          visual: "boss-hp-static",
          cue: "boss.reduced.hp",
          headline: "{resistanceLabel} 100%",
          speaker: "システム",
          line: "{resistanceLabel}は100%。\nWINラインで減らして。",
          objective: "WINラインで{resistanceLabel}を減らす",
          tone: "tactical",
          ariaText:
            "システム。{resistanceLabel}100%。抵抗表示が確定。次はWINラインで減らす。",
        }),
        beat({
          at: 1500,
          duration: 850,
          visual: "boss-order-static",
          cue: "boss.reduced.order",
          headline: "BATTLE START",
          speaker: "ミミ",
          line: "対話の準備が完了した。\nSPINしてWINを狙って。",
          objective: "SPINしてWINラインを作る",
          tone: "command",
          ariaText:
            "ミミ。BATTLE START。対話の準備が完了。次はSPINしてWINラインを作る。",
        }),
      ],
    },

    revive: {
      id: "revive",
      priority: 45,
      totalDuration: 2600,
      beats: [
        beat({
          at: 0,
          duration: 650,
          visual: "miss-freeze",
          cue: "revive.miss",
          headline: "MISS...",
          speaker: "ミミ",
          line: "リールが外れ目で止まった。\nまだ画面から目を離さないで。",
          objective: "復活の合図を待つ",
          tone: "suspended",
          ariaText:
            "ミミ。MISS。リールが外れ目で停止。まだ終了せず復活の合図を待つ。",
        }),
        beat({
          at: 650,
          duration: 850,
          visual: "revive-heart",
          cue: "revive.heart",
          headline: "REVIVE",
          speaker: "ミミ",
          line: "消えた光が心音で戻った。\n復活するリールを見て。",
          objective: "リールが復帰するまで中央を見る",
          tone: "hopeful",
          ariaText:
            "ミミ。REVIVE。消えた光が心音で復活。次はリールの復帰を確認。",
        }),
        beat({
          at: 1500,
          duration: 1100,
          visual: "reel-return",
          cue: "revive.return",
          headline: "ONE MORE",
          speaker: "ミミ",
          line: "外れ目が巻き戻り再始動した。\nもう一度停止を決めて。",
          objective: "復活リールをもう一度停止する",
          tone: "command",
          ariaText:
            "ミミ。ONE MORE。外れ目が巻き戻り再始動。次は復活リールを停止。",
        }),
      ],
      reducedBeats: [
        beat({
          at: 0,
          duration: 750,
          visual: "revive-heart-static",
          cue: "revive.reduced.heart",
          headline: "REVIVE",
          speaker: "ミミ",
          line: "外れ目に復活の光が戻った。\nリールを確認して。",
          objective: "復活したリールを確認する",
          tone: "hopeful",
          ariaText:
            "ミミ。REVIVE。外れ目に復活の光が点灯。次はリールを確認。",
        }),
        beat({
          at: 750,
          duration: 950,
          visual: "reel-return-static",
          cue: "revive.reduced.return",
          headline: "ONE MORE",
          speaker: "ミミ",
          line: "リールが再始動した。\nもう一度停止を決めて。",
          objective: "復活リールをもう一度停止する",
          tone: "command",
          ariaText:
            "ミミ。ONE MORE。リールが再始動。次は復活リールをもう一度停止。",
        }),
      ],
    },

    bonus: {
      id: "bonus",
      priority: 60,
      totalDuration: 3200,
      beats: [
        beat({
          at: 0,
          duration: 700,
          visual: "bonus-entry",
          cue: "bonus.entry",
          headline: "BONUS FOUND",
          speaker: "ミミ",
          line: "{celebrationName}への扉が開いた。\n{collectible}の出現を待って。",
          objective: "{collectible}の出現を確認する",
          tone: "celebratory",
          ariaText:
            "ミミ。BONUS FOUND。{celebrationName}への扉が開放。次は{collectible}を確認。",
        }),
        beat({
          at: 700,
          duration: 700,
          visual: "card-fan",
          cue: "bonus.cards",
          headline: "CELEBRATION",
          speaker: "ミミ",
          line: "{collectible}が会場に広がった。\n獲得回数の公開を待って。",
          objective: "{freeGameCount}回の公開を待つ",
          tone: "playful",
          ariaText:
            "ミミ。CELEBRATION。{collectible}が会場に展開。次は{freeGameCount}回の公開を待つ。",
        }),
        beat({
          at: 1400,
          duration: 800,
          visual: "free-games",
          cue: "bonus.free-games",
          headline: "FREE ×{freeGameCount}",
          speaker: "システム",
          line: "FREE GAMEを{freeGameCount}回獲得した。\n開始の合図に備えて。",
          objective: "BONUS STARTの点灯を待つ",
          tone: "reward",
          ariaText:
            "システム。{freeGameCount} FREE GAMES。無料ゲームを{freeGameCount}回獲得。次はBONUS STARTを待つ。",
        }),
        beat({
          at: 2200,
          duration: 1000,
          visual: "bonus-start",
          cue: "bonus.start",
          headline: "BONUS START",
          speaker: "ミミ",
          line: "今から{celebrationName}を開始。\nSPINしてリールを止めて。",
          objective: "SPINして最初のFREE GAMEを始める",
          tone: "command",
          ariaText:
            "ミミ。BONUS START。{freeGameCount}回の{celebrationName}が開始。次はSPINして最初のゲームを始める。",
        }),
      ],
      reducedBeats: [
        beat({
          at: 0,
          duration: 700,
          visual: "bonus-entry-static",
          cue: "bonus.reduced.entry",
          headline: "BONUS FOUND",
          speaker: "ミミ",
          line: "{celebrationName}への扉が開いた。\n{collectible}と回数を確認して。",
          objective: "{collectible}と獲得回数を確認する",
          tone: "celebratory",
          ariaText:
            "ミミ。BONUS FOUND。{celebrationName}への扉が開放。次は{collectible}と回数を確認。",
        }),
        beat({
          at: 700,
          duration: 800,
          visual: "free-games-static",
          cue: "bonus.reduced.free-games",
          headline: "FREE ×{freeGameCount}",
          speaker: "システム",
          line: "FREE GAMEを{freeGameCount}回獲得した。\n開始の合図を待って。",
          objective: "BONUS STARTを確認する",
          tone: "reward",
          ariaText:
            "システム。{freeGameCount} FREE GAMES。無料ゲームを{freeGameCount}回獲得。次はBONUS STARTを確認。",
        }),
        beat({
          at: 1500,
          duration: 700,
          visual: "bonus-start-static",
          cue: "bonus.reduced.start",
          headline: "BONUS START",
          speaker: "ミミ",
          line: "今から{celebrationName}を開始。\nSPINして最初のゲームへ。",
          objective: "SPINして最初のFREE GAMEを始める",
          tone: "command",
          ariaText:
            "ミミ。BONUS START。{freeGameCount}回の{celebrationName}が開始。次はSPINして最初のゲームを始める。",
        }),
      ],
    },

    jackpot: {
      id: "jackpot",
      priority: 100,
      totalDuration: 5000,
      beats: [
        beat({
          at: 0,
          duration: 500,
          visual: "jackpot-silence",
          cue: "jackpot.silence",
          headline: "SILENCE",
          speaker: "ミミ",
          line: "すべての音と光が静止した。\n歴代ミミの到着を待って。",
          objective: "歴代シリーズの点灯を見届ける",
          tone: "suspended",
          ariaText:
            "ミミ。SILENCE。すべての音と光が静止。次は歴代ミミの到着を待つ。",
        }),
        beat({
          at: 500,
          duration: 450,
          visual: "series-poker",
          cue: "jackpot.series-poker",
          headline: "POKER MIMI",
          speaker: "ポーカー・ミミ",
          line: "ポーカーの切り札が集結した。\n次の仲間を呼んで。",
          objective: "レース・ミミの合流を待つ",
          tone: "legacy",
          ariaText:
            "ポーカー・ミミ。POKER MIMI。切り札が集結。次はレース・ミミを待つ。",
        }),
        beat({
          at: 950,
          duration: 450,
          visual: "series-race",
          cue: "jackpot.series-race",
          headline: "RACE MIMI",
          speaker: "レース・ミミ",
          line: "最速のマシンで合流した。\nギルドの旗を待って。",
          objective: "ギルド・ミミの合流を待つ",
          tone: "legacy",
          ariaText:
            "レース・ミミ。RACE MIMI。最速マシンで合流。次はギルド・ミミを待つ。",
        }),
        beat({
          at: 1400,
          duration: 450,
          visual: "series-guild",
          cue: "jackpot.series-guild",
          headline: "GUILD MIMI",
          speaker: "ギルド・ミミ",
          line: "冒険者の旗を掲げて合流した。\nスタジアムの声を待って。",
          objective: "スタジアム・ミミの合流を待つ",
          tone: "legacy",
          ariaText:
            "ギルド・ミミ。GUILD MIMI。冒険者の旗で合流。次はスタジアム・ミミを待つ。",
        }),
        beat({
          at: 1850,
          duration: 450,
          visual: "series-stadium",
          cue: "jackpot.series-stadium",
          headline: "STADIUM MIMI",
          speaker: "スタジアム・ミミ",
          line: "満員の歓声を連れて合流した。\nアリーナの光を待って。",
          objective: "アリーナ・ミミの合流を待つ",
          tone: "legacy",
          ariaText:
            "スタジアム・ミミ。STADIUM MIMI。歓声と合流。次はアリーナ・ミミを待つ。",
        }),
        beat({
          at: 2300,
          duration: 450,
          visual: "series-arena",
          cue: "jackpot.series-arena",
          headline: "ARENA MIMI",
          speaker: "アリーナ・ミミ",
          line: "王者のスポットライトで合流した。\n全員の収束を見て。",
          objective: "歴代ミミの光が収束するまで待つ",
          tone: "legacy",
          ariaText:
            "アリーナ・ミミ。ARENA MIMI。王者の光で合流。次は歴代ミミの収束を待つ。",
        }),
        beat({
          at: 2750,
          duration: 750,
          visual: "series-converge",
          cue: "jackpot.series-converge",
          headline: "ALL MIMI",
          speaker: "ミミ・オールスターズ",
          line: "歴代シリーズの光が一つになった。\n未来のミミを呼び出して。",
          objective: "未来のミミの登場を待つ",
          tone: "convergence",
          ariaText:
            "ミミ・オールスターズ。ALL MIMI。歴代の光が収束。次は未来のミミを待つ。",
        }),
        beat({
          at: 3500,
          duration: 700,
          visual: "future-mimi",
          cue: "jackpot.future-mimi",
          headline: "FUTURE MIMI",
          speaker: "未来のミミ",
          line: "未来の私が光の中心に到着した。\n最高配当の確定を見て。",
          objective: "JACKPOT配当の確定を待つ",
          tone: "transcendent",
          ariaText:
            "未来のミミ。FUTURE MIMI。未来のミミが到着。次はJACKPOT配当を待つ。",
        }),
        beat({
          at: 4200,
          duration: 800,
          visual: "jackpot-award",
          cue: "jackpot.award",
          headline: "JACKPOT",
          speaker: "未来のミミ",
          line: "配当と空欄のNEXT ATTRACTIONが確定。\n共同制作権を受け取って。",
          objective: "配当と共同制作権を受け取る",
          tone: "maximum",
          ariaText:
            "未来のミミ。JACKPOT。配当と空欄のNEXT ATTRACTIONが確定。共同制作権を受け取る。",
        }),
      ],
      reducedBeats: [
        beat({
          at: 0,
          duration: 800,
          visual: "series-converge-static",
          cue: "jackpot.reduced.converge",
          headline: "ALL MIMI",
          speaker: "ミミ・オールスターズ",
          line: "歴代シリーズが一画面に集結した。\n未来のミミを待って。",
          objective: "未来のミミの登場を確認する",
          tone: "convergence",
          ariaText:
            "ミミ・オールスターズ。ALL MIMI。歴代シリーズが集結。次は未来のミミを確認。",
        }),
        beat({
          at: 800,
          duration: 650,
          visual: "future-mimi-static",
          cue: "jackpot.reduced.future-mimi",
          headline: "FUTURE MIMI",
          speaker: "未来のミミ",
          line: "未来の私が中心へ到着した。\n最高配当を確認して。",
          objective: "JACKPOT配当の確定を確認する",
          tone: "transcendent",
          ariaText:
            "未来のミミ。FUTURE MIMI。未来のミミが到着。次はJACKPOT配当を確認。",
        }),
        beat({
          at: 1450,
          duration: 950,
          visual: "jackpot-award-static",
          cue: "jackpot.reduced.award",
          headline: "JACKPOT",
          speaker: "未来のミミ",
          line: "配当と空欄のNEXT ATTRACTIONが確定。\n共同制作権を受け取って。",
          objective: "配当と共同制作権を受け取る",
          tone: "maximum",
          ariaText:
            "未来のミミ。JACKPOT。配当と空欄のNEXT ATTRACTIONが確定。共同制作権を受け取る。",
        }),
      ],
    },
  };

  function get(id) {
    return Object.prototype.hasOwnProperty.call(definitions, id)
      ? definitions[id]
      : null;
  }

  function durationFor(id, reduced) {
    const definition = get(id);
    if (!definition) return 0;
    if (!reduced) return definition.totalDuration;

    const finalBeat = definition.reducedBeats[definition.reducedBeats.length - 1];
    return finalBeat ? finalBeat.at + finalBeat.duration : 0;
  }

  function resolveBeat(id, sourceBeat, payload) {
    if (!sourceBeat || typeof sourceBeat !== "object") return null;
    const values = Object.assign({}, PAYLOAD_DEFAULTS[id] || {}, payload || {});
    const resolved = {};

    Object.entries(sourceBeat).forEach(function (entry) {
      const key = entry[0];
      const value = entry[1];
      resolved[key] = typeof value === "string"
        ? value.replace(/\{([A-Za-z][A-Za-z0-9_]*)\}/g, function (_match, token) {
          return Object.prototype.hasOwnProperty.call(values, token)
            ? String(values[token])
            : "";
        })
        : value;
    });

    return Object.freeze(resolved);
  }

  return deepFreeze({
    IDS: IDS,
    definitions: definitions,
    PAYLOAD_DEFAULTS: PAYLOAD_DEFAULTS,
    get: get,
    durationFor: durationFor,
    resolveBeat: resolveBeat,
  });
});
