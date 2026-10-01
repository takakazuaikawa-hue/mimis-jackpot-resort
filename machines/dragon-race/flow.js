/*
 * 確定済み回胴イベントだけを演出へ変換する純粋な状態遷移。
 * DOM・タイマー・乱数・配当計算・セーブを書き換える処理を持たない。
 */
(function (root, factory) {
  "use strict";
  const content = typeof module === "object" && module.exports
    ? require("./content.js") : root.MimiDragonRaceContent;
  const api = factory(content);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.MimiDragonRaceFlow = api;
}(typeof globalThis !== "undefined" ? globalThis : this, function (content) {
  "use strict";
  const ownSnapshots = new WeakSet();

  function freeze(value) {
    if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
    Object.values(value).forEach(freeze);
    return Object.freeze(value);
  }
  function snapshot(value) { freeze(value); ownSnapshots.add(value); return value; }
  function validId(id) { return Number.isSafeInteger(id) && id > 0; }
  function requireState(state, event) {
    if (!ownSnapshots.has(state)) throw new Error("この演出処理が作成した状態が必要です");
    if (!event || event.transactionId !== state.transactionId) throw new Error("別回転のイベントです");
  }
  function requireReel(reel) {
    if (!Number.isInteger(reel) || reel < 0 || reel > 2) throw new Error("リールは0〜2です");
  }

  function beginSpin(input) {
    if (!input || !validId(input.transactionId)) throw new Error("正の安全な整数transactionIdが必要です");
    if (!Object.hasOwn(content.MACHINE.flags, input.flagId)) throw new Error("未定義の内部役です");
    const phase = input.phase === undefined ? "normal" : input.phase;
    if (!Object.hasOwn(content.PHASES, phase)) throw new Error("未定義のフェーズです");
    const row = content.MACHINE.flags[input.flagId];
    // 現行共通ヒートのスナップショットがあればその値を保つ。
    const heat = input.heat === undefined ? row.heat : input.heat;
    if (!Number.isInteger(heat) || heat < 1 || heat > 5) throw new Error("期待度は1〜5です");
    return snapshot({
      transactionId: input.transactionId, flagId: input.flagId, phase, heat,
      status: "spinning", accepted: [], landed: [], receipts: [],
      stage: "paddock", result: null,
    });
  }

  function acceptStop(state, event) {
    requireState(state, event); requireReel(event.reel);
    if (state.accepted.includes(event.reel)) return state;
    if (state.status !== "spinning") throw new Error("この回転は停止入力を受け付けません");
    return snapshot(Object.assign({}, state, { accepted: state.accepted.concat(event.reel) }));
  }

  function landReel(state, event) {
    requireState(state, event); requireReel(event.reel);
    if (!state.accepted.includes(event.reel)) throw new Error("STOPの受理が先です");
    if (state.landed.includes(event.reel)) return state;
    if (state.status !== "spinning") throw new Error("この回転は停止済みです");
    const step = state.landed.length + 1;
    const stage = content.MACHINE.flags[state.flagId].motif.stages[step];
    return snapshot(Object.assign({}, state, {
      landed: state.landed.concat(event.reel), stage,
      status: step === 3 ? "resolving" : "spinning",
      receipts: state.receipts.concat({ reel: event.reel, step, stage }),
    }));
  }

  function settle(state, event) {
    requireState(state, event);
    if (typeof event.flagLanded !== "boolean" || typeof event.replay !== "boolean"
      || !Number.isSafeInteger(event.payout) || event.payout < 0) throw new Error("確定済みの成立・REPLAY・配当が必要です");
    // 5ラインでは配当とREPLAYが別ラインに同時成立できる。片方を消さない。
    if (event.flagLanded && (state.flagId === "none" || (state.flagId === "replay" && !event.replay))) {
      throw new Error("内部役の成立と確定結果が矛盾しています");
    }
    const support = event.support === undefined ? "lines" : event.support;
    if (!["lines", "rare-rescue", "bonus-minimum"].includes(support)) throw new Error("未定義の配当理由です");
    const receipt = { flagLanded: event.flagLanded, replay: event.replay, payout: event.payout, support };
    if (state.status === "settled") {
      if (JSON.stringify(state.result.receipt) === JSON.stringify(receipt)) return state;
      throw new Error("同じ回転の決着を書き換えられません");
    }
    if (state.status !== "resolving" || state.landed.length !== 3) throw new Error("3本の停止完了前に決着できません");
    // 狙った内部役の成立と、別ラインの払い出しは別の事実。
    const outcome = event.payout > 0
      ? support === "rare-rescue" ? "rescued" : support === "bonus-minimum" ? "bonus-support"
        : (event.flagLanded && state.flagId !== "replay" ? "prediction-hit" : "other-line") : event.replay ? "replay" : "prediction-miss";
    const titles = { replay: "もう一度！", "prediction-hit": "的中！", "other-line": "別ラインで配当", "prediction-miss": "予想はずれ", rescued: "取りこぼし復活", "bonus-support": "BONUS保証配当" };
    return snapshot(Object.assign({}, state, {
      status: "settled", stage: "verdict",
      result: { receipt, outcome, title: titles[outcome] + (event.payout > 0 && event.replay ? " ＋ REPLAY" : ""), predictionHit: outcome === "prediction-hit" },
    }));
  }

  // 実際のボス進行を決めるのは共通ゲーム側。赤7だけで勝利を捏造しない。
  function bossVerdict(state, event) {
    requireState(state, event);
    if (state.phase !== "boss" || state.status !== "settled") throw new Error("ボス回転の決着が必要です");
    if (!["hit", "critical", "miss", "guard", "retry", "win"].includes(event.outcome)) throw new Error("未定義のボス結果です");
    const win = event.outcome === "win";
    return freeze({
      transactionId: state.transactionId, sceneId: "dragon.boss." + event.outcome,
      revealThreeWayTie: win, predictionRemainsCorrect: true,
      title: win ? "神眼突破！" : { hit: "隕石に亀裂！", critical: "大きな亀裂！", miss: "神眼の圧力は健在", guard: "走りを保った！", retry: "もう一度、走りを見よう！" }[event.outcome],
      // 表示上の同着は元ゲームの払い戻し計算を輸入しない。
      payout: state.result.receipt.payout,
    });
  }

  // 一着表示と配当の対応を一か所に固定する。未決着の勝者は絶対に返さない。
  function racePresentation(state, options = {}) {
    requireState(state, { transactionId: state?.transactionId });
    const shingan = state.phase === "boss" && !options.encore;
    const pickId = shingan ? content.FINALE.displayRoster[1] : options.encore ? "seram" : content.MACHINE.flags[state.flagId].motif.dragonId;
    const roster = shingan ? content.FINALE.displayRoster
      : [pickId === "rubel" ? "rosso" : "rubel", pickId, pickId === "seram" ? "miruka" : "seram"];
    const style = content.RACE_STYLES.find(s => s.id === (shingan ? "duel" : content.DRAGON_FORM[pickId].style));
    const step = state.landed.length;
    const track = content.TRACKS[Number.isInteger(options.section) && options.section >= 0 && options.section < 4 ? options.section : 0];
    function positions(at) {
      if (shingan || at === 3) return style.fronts[at];
      const section = content.TRACK_SECTIONS[track.sections[Math.min(at, 2)]];
      const fitness = roster.map(id => content.DRAGON_FORM[id].stats?.reduce((sum, value, i) => sum + value * section.weights[i], 0) || 70);
      const mean = fitness.reduce((a,b) => a+b,0) / 3;
      return style.fronts[at].map((front,i) => Math.max(.12, Math.min(.88, front + (fitness[i] - mean) * .01)));
    }
    const runningFronts = positions(step), ranksAt = values => values.map(x => 1 + values.filter(y => y > x).length);
    const ranksNow = ranksAt(runningFronts), ranksBefore = ranksAt(positions(Math.max(0, step - 1)));
    const sectionLabel = content.TRACK_SECTIONS[track.sections[Math.min(step, 2)]].label;
    // 原作race_beatsの優先順：抜き差し > 区間説明。文字と移動は同じ前後位置を見る。
    const call = step === 3 ? "写真判定" : step && ranksNow[1] < ranksBefore[1] ? `${content.DRAGONS[pickId]}、抜いた！`
      : step && ranksNow[1] > ranksBefore[1] ? `${content.DRAGONS[pickId]}、抜かれた！`
      : step ? `${sectionLabel}へ！` : `${content.DRAGON_FORM[pickId].trait}の構え`;
    const base = { roster, pickId, styleId: style.id, styleLabel: style.label, call, fronts: runningFronts, course: track.name, sectionLabel,
      winnerIds: [], ranks: ["", "応援", ""], headline: "", detail: "", kind: "pending" };
    if (options.bossWin && (state.phase !== "boss" || state.status !== "settled")) throw new Error("神眼の決着前に同着を表示できません");
    if (state.status !== "settled" || options.reveal === false) return freeze(base);
    const receipt = state.result.receipt;
    const name = id => content.DRAGONS[id];
    if (options.encore) {
      const ended = options.continuationResult === "win" || options.continuationResult === "loss";
      const won = options.continuationResult === "win";
      return freeze({ ...base, kind: ended ? won ? "win" : "loss" : "continuation-progress",
        winnerIds: ended ? [roster[won ? 1 : 0]] : [],
        fronts: ended ? won ? [.71,.95,.53] : [.95,.71,.53] : base.fronts,
        ranks: ended ? won ? ["2着", "1着 · 応援", "3着"] : ["1着", "2着 · 応援", "3着"] : base.ranks,
        headline: ended ? won ? "もう一度！ 無料10回" : "継続ならず" : receipt.payout ? "ゲート点灯！" : "点灯せず…",
        detail: ended ? won ? "次のセットもBET不要" : "獲得CREDITはそのまま。次の紀行へ" : "3Gで4点を集めれば継続。ストックがあれば継続確定" });
    }
    if (state.phase === "boss" && options.bossWin) return freeze({ ...base, kind: "tie", winnerIds: roster,
      fronts: [.95,.95,.95], ranks: ["同着1位", "同着1位", "同着1位"], headline: "神眼突破！ BONUS獲得", detail: roster.map(name).join("・") });
    if (state.phase === "boss") return freeze({ ...base, kind: "boss-progress",
      fronts: receipt.payout ? [.76,.84,.78] : [.86,.66,.81],
      headline: receipt.payout ? "命中！ 隕石に亀裂！" : "弾かれた…！",
      detail: "配当で神眼の圧力を削り、突破を目指す" });
    if (!receipt.payout && receipt.replay) return freeze({ ...base, kind: "replay", fronts: [.78,.76,.73],
      headline: "REPLAY · もう一度！", detail: "このレースは勝敗なし。次のBETは不要" });
    const won = receipt.payout > 0 && receipt.support !== "bonus-minimum";
    const rival = state.transactionId % 2 ? 0 : 2;
    const winner = won ? 1 : rival;
    // 外れを常に「惜しい2着」にしない。残る二頭の順は最終直線の位置を引き継ぐ。
    const beforeFinish = positions(2);
    const order = won ? [1,rival,2-rival] : [rival, ...[0,1,2].filter(i => i !== rival).sort((a,b) => beforeFinish[b] - beforeFinish[a])];
    const ranks = roster.map((_,i) => `${order.indexOf(i)+1}着${i===1 ? " · 応援" : ""}`);
    const fronts = roster.map((_,i) => [.95,.71,.53][order.indexOf(i)]);
    return freeze({ ...base, kind: won ? "win" : "loss", winnerIds: [roster[winner]], ranks, fronts,
      headline: `${name(roster[winner])} 1着！`,
      detail: won ? `${name(pickId)}の${receipt.support === "rare-rescue" ? "逆転勝利！ 復活配当" : state.result.outcome === "other-line" ? "勝利！ 別ライン配当" : "勝利！"} WIN ${receipt.payout}${receipt.replay ? " ＋ REPLAY" : ""}`
        : `${name(pickId)}は${order.indexOf(1)+1}着。${receipt.support === "bonus-minimum" ? `BONUS保証 WIN ${receipt.payout}` : "今回は配当なし"}` });
  }

  return freeze({ beginSpin, acceptStop, landReel, settle, bossVerdict, racePresentation });
}));
