/*
 * slot-core.js - 回胴（リール）の純ロジック。
 *
 * DOM も乱数の副作用も持たないので、ブラウザと Node の両方から同じコードを実行できる。
 * tools/simulate-slot.mjs はこのファイルを直接読み込んで出玉率を計測する。
 *
 * 実機のパチスロと同じ流れで 1 ゲームを処理する。
 *   1. rollFlag()    内部抽選で成立役（フラグ）を決める
 *   2. chooseStop()  各リールの停止時に 0〜4 コマの滑りでフラグを引き込む / ハズレを蹴飛ばす
 *   3. evaluateGrid() 停止した 3x3 を 5 ライン判定して払い出す
 */
(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.SlotCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const REEL_COUNT = 3;
  const REEL_ROWS = 3;
  /** 実機と同じ最大 4 コマ滑り。押した位置から 0〜4 コマだけ引き込める。 */
  const MAX_SLIP = 4;

  /*
   * tier は引き込みやすさの区分。
   *   small   小役。コマ数が多く、ほぼ引き込める。
   *   mid     中役。取りこぼしが起きる。
   *   premium 1 コマ figure。取りこぼしたらフラグを次ゲームへ持ち越す。
   */
  /*
   * 回胴の定番 8 図柄。見慣れないモチーフは認知コストが高く入り込みづらいので、
   * 実機と同じ並びに絞っている。
   *
   * pay は「1 ラインあたりの賭け金（BET / 5）」に対する倍率。
   * tier は表示の格差に使う（小役は小さく、最高役だけ大きく光らせる）。
   */
  const SYMBOLS = [
    { id: "replay", name: "リプレイ", img: "replay.png", tier: "small", pay: 0 },
    { id: "cherry", name: "チェリー", img: "cherry.png", tier: "small", pay: 6 },
    { id: "bell", name: "ベル", img: "bell.png", tier: "small", pay: 8 },
    { id: "grape", name: "ブドウ", img: "grape.png", tier: "small", pay: 10 },
    { id: "watermelon", name: "スイカ", img: "watermelon.png", tier: "small", pay: 14 },
    { id: "bar", name: "BAR", img: "bar.png", tier: "mid", pay: 40 },
    { id: "seven_blue", name: "青7", img: "seven_blue.png", tier: "premium", pay: 120 },
    { id: "seven_red", name: "赤7", img: "seven_red.png", tier: "premium", pay: 300 }
  ];

  /** 最高役。中段に 3 つ揃うと JACKPOT プールを総取りする。 */
  const JACKPOT_SYMBOL = "seven_red";
  /** 再遊技図柄。 */
  const REPLAY_SYMBOL = "replay";

  const SYMBOL_BY_ID = new Map(SYMBOLS.map(sym => [sym.id, sym]));

  /*
   * リール帯。1 リール 21 コマ（実機と同じ長さ）。
   * tools/design-strips.mjs が生成し、全押し位置 21^3 通りの総当たりで
   * 引き込み率を計測して決めた配置。
   *
   *   replay / bell            4 コマ  ライン成立率 95.2%（ほぼ完全引き込み）
   *   cherry / grape / melon   3 コマ  58.3%（取りこぼしあり = 目押しに意味が出る）
   *   bar                      2 コマ  15.5%
   *   seven_blue / seven_red   1 コマ  2.3%（狙って止めないと揃わない）
   *
   * 図柄を 8 種に絞ったことで密度が 19% まで上がり、実機と同じ profile になった。
   * 15 図柄だった頃はベルですら 71% しか引き込めなかった。
   */
  const STRIP_IDS = [
    [
      "replay", "cherry", "watermelon", "bar", "bell", "replay",
      "grape", "cherry", "bar", "bell", "watermelon", "replay",
      "grape", "seven_blue", "bell", "cherry", "replay", "watermelon",
      "seven_red", "bell", "grape"
    ],
    [
      "seven_red", "grape", "bell", "bar", "replay", "cherry",
      "watermelon", "bell", "grape", "replay", "seven_blue", "cherry",
      "bell", "watermelon", "replay", "grape", "bar", "cherry",
      "bell", "replay", "watermelon"
    ],
    [
      "bell", "cherry", "replay", "watermelon", "seven_red", "bell",
      "grape", "replay", "cherry", "watermelon", "bar", "bell",
      "replay", "grape", "cherry", "bar", "bell", "watermelon",
      "replay", "grape", "seven_blue"
    ]
  ];

  const STRIPS = STRIP_IDS.map(ids => ids.map(id => SYMBOL_BY_ID.get(id)));

  const PAYLINES = [
    { id: "middle", cells: [[0, 1], [1, 1], [2, 1]], className: "middle" },
    { id: "top", cells: [[0, 0], [1, 0], [2, 0]], className: "top" },
    { id: "bottom", cells: [[0, 2], [1, 2], [2, 2]], className: "bottom" },
    { id: "diagA", cells: [[0, 0], [1, 1], [2, 2]], className: "diag-a" },
    { id: "diagB", cells: [[0, 2], [1, 1], [2, 0]], className: "diag-b" }
  ];

  /**
   * 取りこぼしても配当を保証する役（tier が small 以外）。
   * リールに 1 コマしか無いレア図柄は 4 コマ滑りではまず揃わないので、
   * 揃わなかった場合はチャンス目を止めたうえで復活演出から払い出す。
   * small 役の取りこぼしは実機同様そのままハズレになる。
   */
  function isRescueFlag(id) {
    const sym = SYMBOL_BY_ID.get(id);
    return Boolean(sym) && sym.tier !== "small";
  }

  /**
   * 1 ライン分の配当。BET は 5 ライン分なので、1 ラインあたりの賭け金は bet/5。
   * 表示している x8 / x260 はこの 1 ライン賭け金に対する倍率。
   */
  function linePayout(symbolId, bet) {
    const sym = SYMBOL_BY_ID.get(symbolId);
    if (!sym || !sym.pay) return 0;
    return Math.round((bet / PAYLINES.length) * sym.pay);
  }

  /*
   * 内部抽選テーブル。記事の「0〜90 の乱数をしきい値で振り分ける」を
   * 重み付きテーブルに置き換えたもの。合計は 10000。
   *
   * small 役の重みは「狙いの成立率 ÷ 実測の引き込み率」で決めている。
   * 例）ベルを実際に 10% 成立させたい → 引き込み率 71% なので 0.10/0.71 = 14.08%。
   */
  const FLAG_TABLES = {
    normal: [
      ["none", 5218], ["cherry", 1180], ["bell", 1090], ["replay", 950], ["grape", 785],
      ["watermelon", 590], ["bar", 150], ["seven_blue", 28], ["seven_red", 9]
    ],
    // 高確中（TRIAL / BOSS BATTLE）。ハズレを削って上位役を厚くする。
    hot: [
      ["none", 3200], ["cherry", 1500], ["bell", 1600], ["replay", 1000], ["grape", 1200],
      ["watermelon", 950], ["bar", 450], ["seven_blue", 70], ["seven_red", 30]
    ],
    // BONUS 中は毎ゲーム必ず何かが成立する（ハズレ無し）。
    bonus: [
      ["bell", 3300], ["cherry", 2200], ["grape", 2000], ["watermelon", 1700],
      ["bar", 700], ["seven_blue", 80], ["seven_red", 20]
    ]
  };

  function mod(value, size) {
    return ((value % size) + size) % size;
  }

  function stripLength(col) {
    return STRIPS[col].length;
  }

  /** index を中段に置いたときの row 段目の図柄。row は 0=上段 / 1=中段 / 2=下段。 */
  function symbolAt(col, index, row) {
    const strip = STRIPS[col];
    return strip[mod(index + row - 1, strip.length)];
  }

  /** index を中段に置いたときの 3 コマ（上段・中段・下段）。 */
  function windowAt(col, index) {
    return [symbolAt(col, index, 0), symbolAt(col, index, 1), symbolAt(col, index, 2)];
  }

  function pickWeighted(table, rng) {
    const total = table.reduce((sum, entry) => sum + entry[1], 0);
    let roll = rng() * total;
    for (let i = 0; i < table.length; i += 1) {
      roll -= table[i][1];
      if (roll < 0) return table[i][0];
    }
    return table[table.length - 1][0];
  }

  /** 内部抽選。戻り値は成立役 id、または "none"（ハズレ）。 */
  function rollFlag(mode, rng) {
    const table = FLAG_TABLES[mode] || FLAG_TABLES.normal;
    return pickWeighted(table, rng || Math.random);
  }

  /**
   * まだ成立の可能性が残っているライン。
   * stopped は { col: 停止した中段 index } 形式。
   */
  function aliveLines(flagId, stopped) {
    return PAYLINES.filter(line => line.cells.every(([col, row]) => {
      const index = stopped[col];
      if (index === undefined || index === null) return true;
      return symbolAt(col, index, row).id === flagId;
    }));
  }

  function buildGridIds(stopped, col, index) {
    const grid = [];
    for (let c = 0; c < REEL_COUNT; c += 1) {
      const at = c === col ? index : stopped[c];
      grid.push(at === undefined || at === null ? null : windowAt(c, at).map(sym => sym.id));
    }
    return grid;
  }

  /** 3 リール全部が確定している前提で、成立しているラインの合計 pay を返す。 */
  function completedPay(grid) {
    let total = 0;
    PAYLINES.forEach(line => {
      const ids = line.cells.map(([col, row]) => grid[col] && grid[col][row]);
      if (ids.some(id => !id)) return;
      if (ids[0] !== ids[1] || ids[1] !== ids[2]) return;
      total += SYMBOL_BY_ID.get(ids[0]).pay + 1;
    });
    return total;
  }

  /**
   * 成立役より上位の役が揃ってしまっている分の pay。
   * 3 リールすべてが確定している場合だけ効く（途中の段階では 0）。
   * 実機では「フラグより上の役が事故で揃う」ことは無いので、制御でこれを潰す。
   */
  function overshootPay(grid, flagPay) {
    let over = 0;
    PAYLINES.forEach(line => {
      const ids = line.cells.map(([col, row]) => grid[col] && grid[col][row]);
      if (ids.some(id => !id)) return;
      if (ids[0] !== ids[1] || ids[1] !== ids[2]) return;
      const pay = SYMBOL_BY_ID.get(ids[0]).pay;
      if (pay > flagPay) over += pay - flagPay;
    });
    return over;
  }

  /** 2 コマ揃い（テンパイ）の最大 pay。演出用の煽り度に使う。 */
  function tensionScore(grid) {
    let best = 0;
    PAYLINES.forEach(line => {
      const ids = line.cells.map(([col, row]) => grid[col] && grid[col][row]);
      const known = ids.filter(Boolean);
      if (known.length !== 2 || known[0] !== known[1]) return;
      const sym = SYMBOL_BY_ID.get(known[0]);
      if (!sym || sym.id === REPLAY_SYMBOL) return;
      best = Math.max(best, sym.pay);
    });
    return best;
  }

  function offFlagPairRisk(grid, allowedFlag) {
    let risk = 0;
    PAYLINES.forEach(line => {
      const ids = line.cells.map(([col, row]) => grid[col]?.[row]).filter(Boolean);
      if (ids.length >= 2 && ids.every(id => id === ids[0]) && ids[0] !== allowedFlag) risk += 1;
    });
    return risk;
  }

  function completedOffFlag(grid, allowedFlag) {
    const jackpotMiddle = allowedFlag === JACKPOT_SYMBOL
      && [0, 1, 2].every(col => grid[col]?.[1] === JACKPOT_SYMBOL);
    return PAYLINES.some(line => {
      if (jackpotMiddle && line.id !== "middle") return false;
      const ids = line.cells.map(([col, row]) => grid[col]?.[row]).filter(Boolean);
      return ids.length === REEL_COUNT && ids.every(id => id === ids[0]) && ids[0] !== allowedFlag;
    });
  }

  function unavoidableOffCount(stopped, currentCol, currentIndex, allowedFlag) {
    const known = Object.keys(stopped).map(Number).filter(col => col !== currentCol);
    if (known.length !== 1) return 0;
    const partial = Object.assign({}, stopped, { [currentCol]: currentIndex });
    const remainingCol = [0, 1, 2].find(col => partial[col] === undefined);
    let unavoidable = 0;
    for (let natural = 0; natural < stripLength(remainingCol); natural += 1) {
      let escape = false;
      for (let slip = 0; slip <= MAX_SLIP; slip += 1) {
        const index = mod(natural - slip, stripLength(remainingCol));
        if (!completedOffFlag(buildGridIds(partial, remainingCol, index), allowedFlag)) {
          escape = true;
          break;
        }
      }
      if (!escape) unavoidable += 1;
    }
    return unavoidable;
  }

  /**
   * 停止制御。押された瞬間の natural（0 コマ滑りで止まる index）から
   * 0〜MAX_SLIP コマ滑らせた候補を評価して、実際に止める index を決める。
   *
   * @param {object} options
   * @param {number} options.col      リール番号
   * @param {number} options.natural  0 コマ滑りで止まる index（未剰余で可）
   * @param {string} options.flag     成立役 id、または "none"
   * @param {object} options.stopped  既に停止済みの { col: index }
   * @param {boolean} [options.tease] ハズレ時にテンパイを作りに行くか
   * @returns {{index:number, slip:number, pulledIn:boolean}}
   */
  function chooseStop(options) {
    const col = options.col;
    const flag = options.flag || "none";
    const stopped = options.stopped || {};
    const length = stripLength(col);
    const base = mod(Math.floor(options.natural), length);

    const candidates = [];
    for (let slip = 0; slip <= MAX_SLIP; slip += 1) {
      candidates.push({ slip, index: mod(base - slip, length) });
    }

    const wantWin = flag !== "none" && SYMBOL_BY_ID.has(flag);
    if (wantWin) {
      const alive = aliveLines(flag, stopped);
      // 既にラインが死んでいる（前のリールで取りこぼした）場合も、
      // 図柄自体は引き込んでおく。バラケ目＝チャンス目として演出に使う。
      const wantRows = alive.length
        ? new Set(alive.map(line => line.cells[col][1]))
        : new Set([1, 0, 2]);
      const flagPay = SYMBOL_BY_ID.get(flag).pay;
      let best = null;
      candidates.forEach(cand => {
        const grid = buildGridIds(stopped, col, cand.index);
        const hitRows = Array.from(wantRows).filter(row => symbolAt(col, cand.index, row).id === flag);
        if (!hitRows.length) return;
        // 成立役より上位の役が「事故」で揃うのは実機ではあり得ない。
        // 引き込める候補がこれしか無くても採用しない（小役を捨てて事故を防ぐ）。
        const jackpotGrid = flag === JACKPOT_SYMBOL
          && [0, 1, 2].every(reel => grid[reel]?.[1] === JACKPOT_SYMBOL);
        if (!jackpotGrid && overshootPay(grid, flagPay) > 0) return;
        if (completedOffFlag(grid, flag)) return;
        // 残った候補のうち、次以降のリールで残るライン数が多いものを優先する。
        const survives = alive.filter(line => hitRows.includes(line.cells[col][1])).length;
        const robustRisk = unavoidableOffCount(stopped, col, cand.index, flag);
        // The jackpot pool is paid only by the middle red-7 line. Without a
        // dedicated priority the generic "most surviving lines" score can
        // steer every reachable red-7 flag onto diagonals, making JP impossible.
        const jackpotMiddle = flag === JACKPOT_SYMBOL
          && hitRows.includes(1)
          && alive.some(line => line.id === "middle") ? 10000000000 : 0;
        const score = jackpotMiddle - robustRisk * 100000000 - offFlagPairRisk(grid, flag) * 1000000 + survives * 100 - cand.slip;
        if (!best || score > best.score) best = { cand, score };
      });
      if (best) return { index: best.cand.index, slip: best.cand.slip, pulledIn: true };
      // 引き込み範囲に図柄が無い = 取りこぼし。この 1 リールだけハズレ制御に落とす。
      // flagも渡し、別役やREPLAYの偶発成立を最優先で避ける。
      return Object.assign(chooseLosingStop(candidates, col, stopped, false, flag), { pulledIn: false });
    }

    return Object.assign(chooseLosingStop(candidates, col, stopped, options.tease === true, "none"), { pulledIn: false });
  }

  /** ハズレ制御。役が揃う目を蹴飛ばしつつ、必要ならテンパイ目を作る。 */
  function chooseLosingStop(candidates, col, stopped, tease, allowedFlag = "none") {
    const known = [0, 1, 2].filter(c => c !== col && stopped[c] !== undefined && stopped[c] !== null);
    const isLastReel = known.length === REEL_COUNT - 1;

    let best = null;
    candidates.forEach(cand => {
      const grid = buildGridIds(stopped, col, cand.index);
      const pay = isLastReel ? completedPay(grid) : 0;
      const completedIds = isLastReel ? PAYLINES.flatMap(line => {
        const ids = line.cells.map(([c, row]) => grid[c]?.[row]).filter(Boolean);
        return ids.length === REEL_COUNT && ids.every(id => id === ids[0]) ? [ids[0]] : [];
      }) : [];
      const offFlag = completedIds.some(id => id !== allowedFlag);
      const pairRisk = offFlagPairRisk(grid, allowedFlag);
      const robustRisk = unavoidableOffCount(stopped, col, cand.index, allowedFlag);
      const tension = tensionScore(grid);
      // flag外役（REPLAYを含む）は配当0でも最優先で回避する。
      const score = -(offFlag ? 1000000000000 : 0) - robustRisk * 100000000 - pairRisk * 1000000 - pay * 1000 + (tease ? tension * 10 : 0) - cand.slip;
      if (!best || score > best.score) best = { cand, score };
    });

    return { index: best.cand.index, slip: best.cand.slip };
  }

  /**
   * 停止した 3x3 の判定。grid は symbol オブジェクトの二次元配列 [col][row]。
   * jackpot の払い出し（プール取り崩し）は呼び出し側に任せる。
   */
  function evaluateGrid(grid, context) {
    const bet = (context && context.bet) || 0;
    const winCells = new Set();
    const nearCells = new Set();
    const litLines = [];
    let payout = 0;
    let orbGain = 0;
    let premium = false;
    let nearMiss = 0;
    let nearSymbol = null;
    let replayHit = false;
    const jackpotHit = grid.every(column => column[1].id === JACKPOT_SYMBOL);

    PAYLINES.forEach(line => {
      // JACKPOT is one atomic result. Incidental lines in the same physical
      // window are suppressed so the pool award cannot double-pay a fruit line.
      if (jackpotHit && line.id !== "middle") return;
      const lineSymbols = line.cells.map(([col, row]) => grid[col][row]);
      const counts = new Map();
      lineSymbols.forEach(sym => counts.set(sym.id, (counts.get(sym.id) || 0) + 1));
      const best = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0];
      const bestSym = SYMBOL_BY_ID.get(best[0]);

      if (best[1] >= REEL_COUNT) {
        litLines.push(line);
        line.cells.forEach(([col, row]) => winCells.add(`${col}-${row}`));
        if (bestSym.id === REPLAY_SYMBOL) {
          // リプレイは払い出し無しで次ゲームが無料になる。
          replayHit = true;
          return;
        }
        payout += linePayout(bestSym.id, bet);
        orbGain += bestSym.tier === "small" ? 1 : 2;
        premium = premium || bestSym.tier === "premium";
      } else if (best[1] === 2 && bestSym.id !== REPLAY_SYMBOL && bestSym.tier !== "small") {
        nearMiss += 1;
        if (!nearSymbol || bestSym.pay > nearSymbol.pay) nearSymbol = bestSym;
        line.cells.forEach(([col, row]) => {
          if (grid[col][row].id === best[0]) nearCells.add(`${col}-${row}`);
        });
      }
    });

    if (jackpotHit) {
      orbGain += 6;
      premium = true;
    }

    return { payout, orbGain, premium, jackpotHit, replayHit, winCells, litLines, nearMiss, nearCells, nearSymbol };
  }

  return {
    REEL_COUNT,
    REEL_ROWS,
    JACKPOT_SYMBOL,
    REPLAY_SYMBOL,
    MAX_SLIP,
    SYMBOLS,
    SYMBOL_BY_ID,
    STRIPS,
    PAYLINES,
    FLAG_TABLES,
    mod,
    stripLength,
    symbolAt,
    windowAt,
    isRescueFlag,
    linePayout,
    rollFlag,
    aliveLines,
    chooseStop,
    evaluateGrid
  };
});
