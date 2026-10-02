/* 現行V5の物理回胴と共通演出controllerを使用する独立機種adapter。 */
(function () {
  "use strict";
  const active = new URLSearchParams(location.search).get("machine") === "dragon-race";
  const content = window.MimiDragonRaceContent, flow = window.MimiDragonRaceFlow;
  const progression = window.MimiDragonProgression;
  const experience = window.MimiDragonExperience;
  const source = "./dragon-source/";
  const saveKey = "mimi-dragon-journey-v1";
  let host, root, api, controller, tx, lastEvent, command = 0, locked = false, saveError = false;
  let loadedSave = null, saveConflict = false;
  let islandRewards = null;
  let displaySection = 0, displayPhase = "normal", round = null, paintedBeat = "";
  let mode = "intro", actors = "", actorTimer, motionRun;
  let rewardRun, scenePlan, albumTab = "records", previewOutfit = "buniqro";
  const characterCue = { frame: 0, elapsed: 0, last: 0, loading: 0 };
  let settingsPanel, settingsButton, pressRun, pressGlow, pressCount = 0;
  let settledGridResult, spectacle;
  // 疾走ボタンは既存の無料回転だけを駆動する。連射数で配当を増やさない。
  const drive = { node: null, timer: 0, held: false, pending: false, lastPress: -Infinity, started: 0, transaction: 0, engaged: false, exit: false, kick: 0 };
  let sceneGateTimer, resultReadTimer, resultReadableUntil = 0, resultPausedAt = null;
  const finish = { frame: 0, transaction: 0, elapsed: 0, last: 0, crossed: [] };
  let preferences = { outfit: "buniqro", musicVolume: .24 }, music, musicTrack = "", musicEpoch = 0;
  let musicBlocked = false, musicFailed = false, musicPending = false;
  const counter = { value: 0 };
  let progress;
  const sprites = new Map();
  const scenery = new Map();
  const racing = { frame: 0, last: 0, clock: 0, distance: 0, speed: 0, visible: false, reduced: false, background: "lapan", nodes: [] };
  const palette = ["#ecbd72", "#75cbe7", "#92d0a8", "#d1a4f8"];
  const courses = ["lapan", "vento", "ringrosso", "stadium"];
  const phrases = {
    sake: ["息を見ろ。脚より先に、そっちが崩れる。", "溜めてるな。最後の脚を見とけ。", "竜は嘘をつかねえ。"],
    mizu: ["人気と実力は、同じではないわ。", "まだ値段以上の走りよ。", "外れた理由にも、価値があるわ。"],
    sumika: ["ミミ様、本日の走りを記録いたします。", "前半で残した力が、ここで効きます。", "この一戦も、次の読みへつながります。"],
    makura: ["推しの名前、叫んでいこう！", "ここ！　ここが今日の見せ場だよ！", "今の走り、アーカイブに残すぞ！"],
  };
  const roadConversations = {
    sake: [
      ['ミミ','屋台の匂いで寄り道？ サケさん、竜はもう競走場へ向かっていますよ。'],
      ['サケ','腹も呼吸も、空っぽじゃ走れねえ。まずは落ち着いて見ろ。'],
      ['ミミ','さっきの息づかい、もう一度見ます。脚だけを追わないんですね。'],
    ],
    mizu: [
      ['ミミ','通りでは人気の竜の話ばかり。でも、実際の走りも見たいです。'],
      ['ミズ','看板の大きさで判断しないの。自分の目で見た一歩を持っていきましょう。'],
      ['ミミ','見落とした所も手帳に。外れた観察を、捨てなくていいんですね。'],
    ],
    sumika: [
      ['スミカ','ミミ様、休憩の時刻です。競走の記録と、お食事の記録は別冊にしました。'],
      ['ミミ','食事まで記録に？ ……今日の分は、あと一行だけ空けておいてください。'],
      ['スミカ','承知しました。走りの方も、最後まで記録を続けます。'],
    ],
    makura: [
      ['マクラ','通りの声も録っておこう。競走場へ近づく音がするだろ？'],
      ['ミミ','推しの名前を呼ぶ練習ですね。今のは、ちゃんと声が届きましたか？'],
      ['マクラ','届いた！ おれの記録にも残った。次は走りの見せ場を追うぞ！'],
    ],
  };
  function roadTalk(member, tour) {
    if (displayPhase !== 'normal' || command !== null || !['intro','quiet','result','race'].includes(mode)) return null;
    if (mode === 'race' && (!tour.town || (tx?.landed.length || 0) > 1)) return null;
    if (mode === 'result' && !tour.town) return null;
    if (tour.omen) return ['ミミ','あれ……歓声が近づいてきました。競走場へ戻りましょう！'];
    const step = (round?.prior.spins ?? progress.spins) + progress.journey;
    const beats = roadConversations[member.id];
    if (!beats) return null;
    return step % 4 === 3 ? [content.CAST[member.id].name, phrases[member.id][Math.floor(step / 4) % phrases[member.id].length]] : beats[step % 4];
  }
  function el(selector) { return root.querySelector(selector); }
  function text(selector, value) { const node = el(selector); if (node.textContent !== String(value)) node.textContent = value; }
  function attr(node, key, value) { if (node.dataset[key] !== String(value)) node.dataset[key] = value; }
  function loadPreferences() {
    try {
      const p = JSON.parse(localStorage.getItem("mimi-dragon-presentation-v1") || "{}");
      const outfit = experience.OUTFITS.find(o => o.id === p.outfit && experience.unlocked(progress, o));
      preferences = { outfit: outfit?.id || "buniqro", musicVolume: Number.isFinite(p.musicVolume) ? Math.max(0, Math.min(.6, p.musicVolume)) : .24 };
    } catch (_) { /* 壊れた表示設定は初期値で再開する。残高とは別保存。 */ }
  }
  function savePreferences() {
    try { localStorage.setItem("mimi-dragon-presentation-v1", JSON.stringify(preferences)); }
    catch (_) { saveError = true; }
  }
  function syncSound() {
    if (!active || !api || !root || !music) return;
    const visible = root.closest(".app-view")?.classList.contains("is-active") && !document.hidden;
    const enabled = api.audio.enabled && visible;
    if (!enabled) { music.pause(); return; }
    const phase = mode === "result" || mode === "quiet" ? progress.phase : displayPhase;
    const town = phase === "normal" && tourView().town;
    const track = town ? [0,3].includes(displaySection) ? "mallbgm/mall-day" : "homebgm/ホームカントリー"
      : "racebgm/" + (phase === "boss" ? "unlosable-battle" : phase === "bonus" ? "crown-of-thunder"
      : phase === "trial" ? "lets-do-this" : ["fanfare-days", "dragon-in-the-forest", "fog-cutting-flag", "sky-hero"][displaySection]);
    if (track !== musicTrack) {
      music.pause(); musicTrack = track; musicEpoch++; musicPending = false; musicFailed = false;
      music.src = source + `bgm/${track}.mp3`; music.load();
    }
    music.volume = preferences.musicVolume * (mode === "photo" ? .18 : modalOpen() ? .45 : 1);
    if (music.paused && !musicPending && !musicFailed) {
      const epoch = musicEpoch; musicPending = true;
      music.play().then(() => { if (epoch === musicEpoch) musicBlocked = false; })
        .catch(() => { if (epoch === musicEpoch) musicBlocked = true; })
        .finally(() => { if (epoch === musicEpoch) musicPending = false; });
    }
  }
  function finishReward() {
    rewardRun?.kill(); rewardRun = null;
    if (tx?.result?.receipt) {
      const receipt = tx.result.receipt;
      text(".dragon-award strong", receipt.payout ? `+${receipt.payout.toLocaleString("ja-JP")}枚` : receipt.replay ? "無料" : "なし");
      text(".dragon-award span", receipt.payout ? receipt.support === "bonus-minimum" ? "保証コイン" : "獲得コイン" : receipt.replay ? "次の1回" : "獲得コイン");
    }
  }
  function startReward() {
    finishReward();
    const payout = tx.result.receipt.payout;
    text(".dragon-award span", payout ? tx.result.receipt.support === "bonus-minimum" ? "保証コイン" : "獲得コイン" : tx.result.receipt.replay ? "次の1回" : "獲得コイン");
    text(".dragon-award strong", payout ? "0" : tx.result.receipt.replay ? "無料" : "なし");
    if (!payout) return;
    if (!window.gsap || reducedMotion()) { finishReward(); return; }
    counter.value = 0;
    text(".dragon-award span", tx.result.receipt.support === "bonus-minimum" ? "保証 獲得中" : "獲得中");
    rewardRun = gsap.to(counter, { value: payout, duration: Math.min(1.6, .4 + Math.log10(payout + 1) * .22), ease: "power2.out",
      onUpdate: () => text(".dragon-award strong", `+${Math.floor(counter.value).toLocaleString("ja-JP")}枚`), onComplete: finishReward });
  }
  function clearCharacterCue() {
    cancelAnimationFrame(characterCue.frame);
    characterCue.frame = 0; characterCue.last = 0; characterCue.elapsed = 0; characterCue.loading = 0;
    el(".dragon-cutin").style.opacity = "0";
    attr(root, "characterCue", "idle");
  }
  function cutIn() {
    clearCharacterCue();
    const id = content.JOURNEY[displaySection].id, art = content.CHARACTER_ART[id];
    const node = el(".dragon-cutin"), portrait = el(".dragon-cutin img");
    portrait.src = art.image; portrait.alt = `${content.CAST[id].name}の応援`;
    text(".dragon-cutin strong", content.CAST[id].name); text(".dragon-cutin span", art.line);
    node.dataset.actor = id; node.style.setProperty("--character-accent", art.accent);
    attr(root, "characterCue", "pending");
    // STARTを見せてから、その横で仲間が応援。両方が読めてからゴールへ進む。
    const tick = now => {
      const delta = characterCue.last ? Math.min(50, now - characterCue.last) : 0;
      characterCue.last = now;
      if (!document.hidden && !modalOpen() && root.closest(".app-view")?.classList.contains("is-active")) {
        if (portrait.complete && !portrait.naturalWidth) { clearCharacterCue(); return; }
        if (!portrait.complete) {
          characterCue.loading += delta;
          if (characterCue.loading > 2000) { clearCharacterCue(); return; }
        } else if (el(".dragon-launch").hidden || el(".dragon-launch").dataset.start === "true" && spectacle.readRemaining() <= 1700) {
          characterCue.elapsed += delta;
          const t = characterCue.elapsed, reduced = reducedMotion();
          attr(root, "characterCue", "visible");
          node.style.opacity = String(reduced ? 1 : Math.min(1, t / 180, (1660 - t) / 180));
          node.style.transform = reduced ? "none" : `translateX(${Math.max(0, 1 - t / 240) * 28}px)`;
          if (t >= 1660) { clearCharacterCue(); return; }
        }
      }
      characterCue.frame = requestAnimationFrame(tick);
    };
    characterCue.frame = requestAnimationFrame(tick);
  }
  function load() {
    // 初回の遊技用残高。無料補充を何度も挟まずに紀行を続けるための持ち分で、配当ではない。
    api.state.credit = 4800;
    try {
      loadedSave = localStorage.getItem(saveKey);
      const saved = JSON.parse(loadedSave || "{}");
      try { islandRewards = window.MimiResortRewards.createEnvelope("dragon", saved._islandRewards); }
      catch (_) { saveConflict = true; }
      const wallet = saved?._wallet;
      if (wallet && Number.isSafeInteger(wallet.credit) && wallet.credit >= 0 && wallet.credit <= 1e12
        && Number.isSafeInteger(wallet.jackpot) && wallet.jackpot >= 0 && wallet.jackpot <= 1e12) {
        api.state.credit = wallet.credit; api.state.jackpot = wallet.jackpot;
        api.state.freeSpin = wallet.freeSpin === true;
      }
      return progression.normalize(saved);
    }
    catch (_) { saveConflict = true; return progression.normalize(); }
  }
  function save(wallet = null) {
    try {
      if (saveConflict || localStorage.getItem(saveKey) !== loadedSave) { markSaveConflict(); return; }
      // 紀行と残高は同じ書込で保存。未決着の回転は直前のチェックポイントに戻る。
      const nextSave = JSON.stringify({ ...progress, _islandRewards: islandRewards, _wallet: wallet || {
        credit: api.state.credit, jackpot: api.state.jackpot, freeSpin: api.state.freeSpin,
      } });
      localStorage.setItem(saveKey, nextSave); loadedSave = nextSave; saveError = false;
    }
    catch (_) { saveError = true; }
  }
  function markSaveConflict() {
    if (saveConflict) return;
    saveConflict = true;
    cancelDrive(); api?.pauseAuto?.();
    if (root) { render(); controls(); }
  }
  function syncGame() {
    api.state.phase = progress.phase === "boss" ? "battle" : progress.phase;
    api.state.bossBattle = progress.phase === "boss";
    api.state.bossStageId = progress.phase === "boss" ? "dragon" : "";
    api.state.bossHp = progress.bossHp;
    api.state.bonusGames = progress.bonusLeft;
    api.state.bonusOrigin = "dragon";
  }
  function speaker(id, line) {
    text(".dragon-speaker", content.CAST[id]?.name || "ミミ");
    text(".dragon-line", line);
  }
  function picture(node, path) {
    const src = path.startsWith("images/cast/mimi/mimi_dragonrobe_")
      ? "./machines/dragon-race/assets/spectacle-v1/mimi-dragonrobe-stance-v4.png" : source + path;
    if (node.getAttribute("src") !== src) node.setAttribute("src", src);
  }
  function reducedMotion() {
    return matchMedia("(prefers-reduced-motion: reduce)").matches || host.classList.contains("reduced-motion");
  }
  function showActors(value, duration = 0) {
    clearTimeout(actorTimer);
    actors = value; attr(root, "actors", value);
    if (duration) actorTimer = setTimeout(() => showActors(""), duration);
  }
  function pickId() {
    if ((tx?.phase || displayPhase) === "bonus") return "seram";
    if ((tx?.phase || displayPhase) === "boss" && isEncore()) return "seram";
    return (tx?.phase || displayPhase) === "boss" && !isEncore() ? content.FINALE.displayRoster[1] : tx ? content.MACHINE.flags[tx.flagId].motif.dragonId : "seram";
  }
  function isEncore() { return (round && tx?.status === "settled" ? round.prior : progress).raceKind === "encore"; }
  function isObservation() { return scenePlan?.kind === "observation"; }
  function tourView() {
    return experience.sightseeing({ phase: displayPhase, section: displaySection, spins: round?.prior.spins ?? progress.spins,
      count: tx?.landed.length || 0, kind: scenePlan?.kind, mode, hasRace: Boolean(tx) && mode !== "intro" });
  }
  function raceView(forceReveal = false) {
    if (!tx) return null;
    if (tx.phase === "bonus") return { roster: ["rubel", "seram", "miruka"], winnerIds: [], fronts: [.61,.72,.48],
      kind: "reward-run", styleId: "cruise", headline: "", detail: "", call: "" };
    const reveal = forceReveal || ["result", "quiet"].includes(mode);
    return flow.racePresentation(tx, { reveal, section: displaySection, encore: tx.phase === "boss" && isEncore(),
      continuationResult: round?.events.includes("continuation-win") ? "win" : round?.events.includes("journey-clear") ? "loss" : "pending",
      bossWin: reveal && tx.phase === "boss" && round?.events.includes("boss-win") });
  }
  function pickName() { return content.DRAGONS[pickId()]; }
  function roleName() { return window.SlotCore.SYMBOL_BY_ID.get(tx?.flagId)?.name || ""; }
  function animateReveal() {
    motionRun?.kill();
    if (!window.gsap || reducedMotion()) return;
    const paid = tx.result.receipt.payout > 0;
    motionRun = gsap.timeline();
    motionRun.fromTo(el(".dragon-result"), { opacity: 0, y: paid ? 30 : -8, scale: paid ? 1.35 : 1 },
      { opacity: 1, y: 0, scale: 1, duration: paid ? .42 : .3, ease: paid ? "back.out(1.8)" : "power1.out" });
    if (paid) motionRun.fromTo(el(".dragon-impact"), { opacity: .65, scale: .6 }, { opacity: 0, scale: 1.5, duration: .65 }, 0);
    if (tx.heat >= 4 && paid) motionRun.fromTo(el(".dragon-course"), { y: 4 }, { y: 0, duration: .07, repeat: 3, yoyo: true }, 0);
  }
  function introduction() {
    mode = "intro";
    text(".dragon-result", "");
    const summary = experience.summary(progress);
    text(".dragon-intro-card h2", summary[0]); text(".dragon-intro-card .intro-goal", summary[1]);
    text(".dragon-intro-card .intro-help", summary[2]);
    const next = experience.OUTFITS.find(o => !experience.unlocked(progress, o));
    text(".dragon-intro-card .intro-reward", next ? `次の衣装：${next.name} · ${experience.condition(progress, next)}` : "12着の衣装を解放済み · 紀行の記録から着替えられます");
    text(".dragon-sound-choice", api.audio.enabled ? "音 ON · 原作レースBGM" : "音をONにして遊ぶ");
    showActors(command === 0 ? "advisor" : "mimi");
    if (progress.phase === "boss") {
      if (progress.raceKind === "encore") {
        showActors("mimi");
        speaker("mimi", `継続は3G勝負。小役で1点、強役で2点。${progress.stock ? "ストックがあるので継続確定です！" : "4点を集めれば、次のBONUSへ！"}`); return;
      }
      speaker(command === 0 ? "celestia" : "mimi", command === 0 ? "生命淘汰の神眼。その絶対の予測が、賭場を揺るがす。" : "配当で圧力を削って、竜たちの走りをつなぎます！"); return;
    }
    const member = content.JOURNEY[progress.section];
    const goal = progression.order(progress).id === "aim" ? "READYでは待つ。AIMに光ったら、STOPです！" : content.INTRO[member.id][1];
    speaker(command === 0 ? member.id : "mimi", command === 0 ? content.INTRO[member.id][0] : goal);
  }
  function scene(id, line, duration = 2100, after = null) {
    locked = true;
    lastEvent = { id, line, after };
    root.dataset.scene = id;
    mode = "photo";
    text(".dragon-result", ""); text(".dragon-call", isObservation() ? "結果確認" : "最後の直線！");
    speaker("mimi", isObservation() ? "今の走りは…" : "あと少し…！");
    showActors("");
    controller.setReducedMotion(matchMedia("(prefers-reduced-motion: reduce)").matches || host.classList.contains("reduced-motion"));
    const anticipation = scenePlan.suspense;
    const ordinary = ["small-hit", "replay", "miss"].includes(id) && scenePlan.tier === 1;
    const total = settledGridResult?.jackpot ? 6800 : id === "boss-win" ? 5200 : ordinary ? id === "miss" ? 650 : id === "replay" ? 750 : 1150 : duration;
    // 連打で三本が止まっても発走・神眼発動を読み飛ばさない。回胴停止自体は遅らせない。
    clearTimeout(sceneGateTimer);
    const play = () => {
      sceneGateTimer = null;
      const remaining = spectacle.readRemaining();
      if(remaining>0){sceneGateTimer=setTimeout(play,remaining+10);return;}
      if(characterCue.frame){sceneGateTimer=setTimeout(play,40);return;}
      const protectedResult = resultReadDuration() * (api.state.turbo ? 1.7 : 1);
      const reveal = () => controller.play("event", { id, line }, { beats: [{ duration: finish.transaction === tx.transactionId ? 1 : anticipation }, { duration: Math.max(200, protectedResult + 180, total - anticipation - 150) }, { duration: 150 }] });
      if (!finishRace(reveal)) reveal();
    };
    const remaining = spectacle.readRemaining();
    if (remaining > 0) sceneGateTimer = setTimeout(play, remaining);
    else play();
    api.redraw();
  }
  // 払出し確定後の映像だけを駆動する。先着→後続→結果の順で、抽選には介入しない。
  function finishRace(reveal) {
    const verdict = raceView(true);
    if (isObservation() || tx.phase === "bonus" || !["win", "loss"].includes(verdict?.kind)) return false;
    finish.transaction = tx.transactionId; finish.elapsed = 0; finish.last = 0; finish.crossed = [];
    attr(root, "finish", "running");
    const nodes = [...root.querySelectorAll(".dragon-runner")], course = el(".dragon-course");
    const line = el(".dragon-finish").offsetLeft + el(".dragon-finish").offsetWidth / 2;
    const order = [0,1,2].sort((a,b) => verdict.fronts[b] - verdict.fronts[a]);
    const reduced = reducedMotion();
    const entries = nodes.map((node, i) => {
      if (window.gsap) gsap.killTweensOf(node);
      const x = new DOMMatrixReadOnly(getComputedStyle(node).transform).m41;
      // canvasはobject-fit:contain。外箱の右端ではなく、192×144内の鼻先185を使う。
      const scale = Math.min(node.clientWidth / 192, node.clientHeight / 144);
      const nose = (node.clientWidth - 192 * scale) / 2 + 185 * scale;
      const rank = order.indexOf(i), crossAt = 600 + rank * 320;
      return { node, i, x, nose, rank, crossAt, crossX: Math.max(x + 8, line - nose + 3), endX: line - nose + 64 - rank * 20 };
    });
    text(".dragon-call", "最後の直線！");
    render();
    const tick = now => {
      finish.frame = 0;
      if (finish.transaction !== tx?.transactionId) return;
      const visible = !document.hidden && !modalOpen() && root.closest(".app-view")?.classList.contains("is-active");
      if (visible && finish.last) finish.elapsed += Math.min(50, now - finish.last) * (api.state.turbo ? 1.25 : 1);
      finish.last = now;
      // 先着の鼻先で短く留め、後続を順に通す。高速時も着順間隔を256ms確保する。
      const t = finish.elapsed <= 600 ? finish.elapsed : finish.elapsed <= 880 ? 600 : finish.elapsed - 280;
      entries.forEach(entry => {
        const crossed = t >= entry.crossAt;
        let x = t < entry.crossAt ? entry.x + (entry.crossX - entry.x) * Math.min(1, t / entry.crossAt)
          : entry.crossX + (entry.endX - entry.crossX) * Math.min(1, (t - entry.crossAt) / 340);
        if (reduced) x = crossed ? entry.endX : entry.x;
        entry.node.style.transform = `translateX(${x}px)`;
        if (crossed && !finish.crossed.includes(entry.i)) {
          finish.crossed.push(entry.i); entry.node.dataset.finishRank = String(entry.rank + 1);
          entry.node.querySelector("span").textContent = `${entry.rank + 1}着 · ${entry.i === 1 ? "あなたの竜 · " : ""}${content.DRAGONS[verdict.roster[entry.i]]}`;
          if (entry.rank === 0) {
            attr(root, "finish", "crossed"); text(".dragon-call", "GOAL!");
            entry.node.classList.add("is-winner");
            if (api.audio.enabled) api.audio.cue("notice");
          }
        }
      });
      if (t >= 1580) { attr(root, "finish", "done"); reveal(); return; }
      finish.frame = requestAnimationFrame(tick);
    };
    finish.frame = requestAnimationFrame(tick);
    return true;
  }
  function resultReadDuration() {
    if (tx?.phase === "bonus" && !["continuation-enter", "stock-earned", "cheer-earned"].includes(root.dataset.scene)) return 420;
    return root.dataset.scene === "boss-win" ? 2800 : settledGridResult?.jackpot ? 2400 : ["continuation-win","stock-earned"].includes(root.dataset.scene) ? 1700
      : scenePlan?.tier >= 3 ? 1000 : scenePlan?.kind === "race" ? 650 : 180;
  }
  function renderFrame(frame) {
    if (!root || !frame.payload) return;
    attr(root, "beat", frame.beat.id);
    // 負荷やバックグラウンド復帰でrevealの時刻を飛び越えても、確定結果は必ず1回表示する。
    if (["playing", "completed"].includes(frame.status) && ["reveal", "hold"].includes(frame.beat.id)) {
      root.classList.add("dragon-event-reveal");
      const beatKey = frame.runId + ":reveal";
      if (paintedBeat !== beatKey) {
        paintedBeat = beatKey;
        mode = "result";
        resultReadableUntil = performance.now() + resultReadDuration();
        resultPausedAt = presentationVisible() ? null : performance.now();
        clearTimeout(resultReadTimer);
        resultReadTimer = setTimeout(() => { controls(); api.redraw(); }, resultReadDuration() + 20);
        if (settledGridResult?.payout > 0) api.revealPayout?.(settledGridResult);
        const verdict = raceView();
        text(".dragon-result", verdict.headline);
        if (tx.result.receipt.support === 'bonus-minimum') text('.dragon-result',`${pickName()}は届かず`);
        text(".dragon-verdict", verdict.kind === "boss-progress" ? `${verdict.detail} · 神眼の圧力 ${progress.bossHp} · WIN ${tx.result.receipt.payout}` : verdict.detail);
        if (isObservation()) {
          const receipt = tx.result.receipt;
          text(".dragon-result", receipt.support === "bonus-minimum" ? "BONUS保証" : receipt.payout ? "的中！" : receipt.replay ? "REPLAY" : "静かなひととき");
          text(".dragon-verdict", receipt.support === "bonus-minimum" ? "図柄は不成立。保証配当を獲得" : receipt.payout ? "成立ラインの配当を獲得" : receipt.replay ? "次のBETは不要" : "今回は配当なし · 次の走りへ");
        }
        if (tx.phase === "bonus") {
          text(".dragon-result", tx.result.receipt.support === "bonus-minimum" ? "保証コイン" : "コイン獲得！");
          text(".dragon-verdict", ""); text(".dragon-call", "");
        }
        text(".dragon-call", root.dataset.scene === "boss-win" ? "この島のレースは続く" : "");
        speaker("mimi", lastEvent.line);
        showActors("");
        const gain = experience.newlyUnlocked(round.prior, progress);
        const learned = Object.keys(content.DRAGONS).find(id => experience.canStudy(id) && experience.familiarity(round.prior,id) < 2 && experience.familiarity(progress,id) >= 2);
        text(".dragon-new-reward", learned ? `${content.DRAGONS[learned]} · 見切り解放` : gain.length ? "新しい衣装を解放" : round.events.includes("new-record") ? "観察を記録" : "");
        attr(root, "milestone", ["boss-win", "journey-clear", "boss-enter", "section-clear", "continuation-enter", "continuation-win", "stock-earned"].includes(root.dataset.scene));
        const milestone = root.dataset.scene === "boss-win" ? ["神眼レース 突破", "BONUS 10G · BET不要"]
          : root.dataset.scene === "continuation-win" ? [`${progress.chainSets}セット目へ！`, `BONUS +10G · 累計 ${progress.bonusTotal} CREDIT`]
          : root.dataset.scene === "continuation-enter" ? ["継続レースへ", `3Gで4点 · 応援 ${progress.cheers}点 / ストック ${progress.stock}個`]
          : root.dataset.scene === "stock-earned" ? ["継続ストック獲得！", `保有 ${progress.stock}個 · 継続失敗時に1個消費して復活`]
          : root.dataset.scene === "journey-clear" ? ["紀行 完走", `BONUS累計 ${progress.lastBonus.toLocaleString("ja-JP")} CREDIT`]
          : root.dataset.scene === "boss-enter" ? ["神眼レースへ", "神眼の圧力を削れ · 突破でBONUS"]
          : [progress.phase === "trial" ? "CHANCEへ" : "次の会場へ", progress.phase === "trial" ? "3Gで予想3点を集めよう" : content.JOURNEY[progress.section].theme];
        text(".dragon-milestone strong", milestone[0]); text(".dragon-milestone span", milestone[1]);
        if (api.audio.enabled) {
          if (settledGridResult.jackpot) api.audio.jackpot();
          else if (round.prior.phase === "boss" && round.events.includes("boss-win")) api.audio.roleBoss(tx.flagId, "victory");
          else if (round.prior.phase === "boss" && progress.bossHp < round.prior.bossHp) api.audio.roleBoss(tx.flagId, "hit");
          else if (tx.result.receipt.payout > 0) api.audio.win(tx.result.receipt.payout, api.state.bet);
          else api.audio.roleResult(tx.flagId, tx.result.receipt.replay ? "replay" : "result", false);
        }
        render(); animateReveal(); startReward();
        window.dispatchEvent(new CustomEvent('mimi:cabinet-result', {detail:{machineId:'dragon-race',type:'revealed',transactionId:tx.transactionId,payout:tx.result.receipt.payout,replay:tx.result.receipt.replay,lineIds:settledGridResult.litLines.map(l=>l.id)}}));
        spectacle.celebrate({ jackpot: Boolean(settledGridResult.jackpot), bossWin: round.events.includes("boss-win"), payout: tx.result.receipt.payout });
        api.redraw();
      }
    }
  }
  function finishScene(event) {
    if (event.type !== "complete") return;
    const remaining = resultReadRemaining();
    if (remaining > 0 || !presentationVisible()) {
      clearTimeout(resultReadTimer);
      resultReadTimer = setTimeout(() => finishScene(event), presentationVisible() ? remaining + 10 : 250);
      return;
    }
    clearTimeout(resultReadTimer);
    locked = false;
    root.classList.remove("dragon-event-reveal");
    root.dataset.scene = "idle";
    mode = "quiet"; showActors("");
    spectacle.clear();
    finishReward();
    motionRun?.kill();
    if (window.gsap) {
      gsap.set(el(".dragon-course"), { y: 0 });
      gsap.set(el(".dragon-result"), { opacity: 1, y: 0, scale: 1 });
      gsap.set(el(".dragon-impact"), { opacity: 0 });
    }
    displaySection = progress.section; displayPhase = progress.phase;
    const after = lastEvent?.after; lastEvent = null;
    if (after) after();
    if (api.state.auto && command === 0 && !drive.exit) command = 1;
    render(); controls(); api.redraw();
    if (command !== 0 && el(".dragon-album").hidden) api.resumeAuto?.();
  }

  // 原作race_canvas.jsの四隅連結・色差34の背景キー処理を表示時だけ再利用。
  // 原画像は編集も保存もせず、体内の灰色は連結していない限り残す。
  function dragonSprite(id) {
    if (sprites.has(id)) return sprites.get(id);
    const entry = { ready: false }, image = new Image(); sprites.set(id, entry);
    image.onload = () => {
      const w = image.naturalWidth, h = image.naturalHeight;
      const canvas = document.createElement("canvas"); canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext("2d", { willReadFrequently: true }); ctx.drawImage(image, 0, 0);
      const pixels = ctx.getImageData(0, 0, w, h), d = pixels.data;
      if (d[3] > 200) {
        const cr = d[0], cg = d[1], cb = d[2], seen = new Uint8Array(w * h);
        const stack = [0, w - 1, (h - 1) * w, h * w - 1];
        while (stack.length) {
          const i = stack.pop(); if (seen[i]) continue; seen[i] = 1;
          const q = i * 4, dr = d[q] - cr, dg = d[q + 1] - cg, db = d[q + 2] - cb;
          if (!d[q + 3] || dr * dr + dg * dg + db * db > 34 * 34) continue;
          d[q + 3] = 0;
          if (i % w) stack.push(i - 1); if (i % w < w - 1) stack.push(i + 1);
          if (i >= w) stack.push(i - w); if (i < (h - 1) * w) stack.push(i + w);
        }
        ctx.putImageData(pixels, 0, 0);
      }
      let x0 = w, y0 = h, x1 = 0, y1 = 0;
      for (let y = 0; y < h; y += 2) for (let x = 0; x < w; x += 2) if (d[(y * w + x) * 4 + 3] > 24) {
        x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
      }
      Object.assign(entry, { ready: true, canvas, box: [x0, y0, Math.max(1, x1 - x0), Math.max(1, y1 - y0)] });
      entry.pose = document.createElement("canvas"); entry.pose.width = 192; entry.pose.height = 144;
      const [bx, by, bw, bh] = entry.box, scale = Math.min(180 / bw, 120 / bh);
      entry.pose.getContext("2d").drawImage(canvas, bx, by, bw, bh, (192 - bw * scale) / 2, (144 - bh * scale) / 2, bw * scale, bh * scale);
      // 2×2アトラスを原寸のまま保持し、表示用キャッシュだけを作る。
      // 鼻先を共通の座標へ合わせ、翼の上下で体やゴール位置が跳ねないようにする。
      entry.frames = [];
      const cw = w / 2, ch = h / 2, boxes = [];
      for (let f = 0; f < 4; f++) {
        const ox = f % 2 * cw, oy = Math.floor(f / 2) * ch;
        let left = cw, right = 0;
        for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) if (d[((oy + y) * w + ox + x) * 4 + 3] > 200) { left = Math.min(left, x); right = Math.max(right, x); }
        let sy = 0, n = 0;
        for (let y = 0; y < ch; y++) for (let x = Math.max(0, right - 8); x <= right; x++) if (d[((oy + y) * w + ox + x) * 4 + 3] > 200) { sy += y; n++; }
        boxes.push({ ox, oy, left, right, nose: n ? sy / n : ch / 2 });
      }
      const frameScale = Math.min(.25, 176 / Math.max(...boxes.map(b => b.right - b.left)));
      for (const box of boxes) {
        const pose = document.createElement("canvas"); pose.width = 192; pose.height = 144;
        pose.getContext("2d").drawImage(canvas, box.ox, box.oy, cw, ch, 185 - box.right * frameScale, 88 - box.nose * frameScale, cw * frameScale, ch * frameScale);
        entry.frames.push(pose);
      }
      entry.pose = entry.frames[1];
      paintDragons();
    };
    image.onerror = () => { entry.failed = true; root.dataset.assetError = id; };
    image.src = "./machines/dragon-race/assets/flight-v2/" + id + ".png";
    return entry;
  }
  function paintDragons() {
    if (!root) return;
    const selected = pickId();
    const view = raceView();
    const ids = view?.roster || (displayPhase === "boss" && !isEncore()
      ? content.FINALE.displayRoster : [selected === "rubel" ? "rosso" : "rubel", selected, selected === "seram" ? "miruka" : "seram"]);
    root.querySelectorAll(".dragon-runner canvas").forEach((canvas, i) => {
      const rank = canvas.parentElement.dataset.finishRank;
      canvas.parentElement.querySelector("span").textContent = `${rank ? rank + "着 · " : ""}${i === 1 ? "あなたの竜 · " : ""}${content.DRAGONS[ids[i]]}${!rank && view?.winnerIds.includes(ids[i]) ? " 1着" : ""}`;
      canvas.parentElement.classList.toggle("is-winner", rank ? rank === "1" : Boolean(view?.winnerIds.includes(ids[i])));
      const line = root.querySelectorAll(".dragon-lineup li")[i];
      line.textContent = `${i === 1 ? "★ 応援" : "ライバル"}　${content.DRAGONS[ids[i]]}`;
      const sprite = dragonSprite(ids[i]);
      if (!sprite.ready) return;
      if (canvas.dataset.dragon === ids[i]) return;
      canvas.dataset.dragon = ids[i];
      canvas.setAttribute("aria-label", content.DRAGONS[ids[i]]);
      const ctx = canvas.getContext("2d"); ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(sprite.pose, 0, 0);
    });
  }
  function runnerPositions() {
    if (tx && finish.transaction === tx.transactionId) return;
    const step = tx?.landed.length || 0, settled = ["result", "quiet"].includes(mode) && tx?.status === "settled";
    const view = raceView();
    root.querySelectorAll(".dragon-runner").forEach((node, i) => {
      const width = el(".dragon-course").clientWidth;
      // 体の大きさで順位が逆転しないよう、全ての位置を竜の先端で揃える。
      const target = width * (isObservation() ? [.12,.35,.61,.94][step] : view?.fronts[i] || [.5,.45,.4][i]) - node.clientWidth;
      if (node.dataset.target === String(target)) return;
      node.dataset.target = String(target);
      if (window.gsap) gsap.to(node, { x: target, duration: reducedMotion() ? 0 : mode === "race" && step === 0 ? .65 : settled ? .9 : 1.05, ease: settled ? "power2.out" : "sine.inOut", overwrite: true });
      else node.style.transform = `translateX(${target}px)`;
    });
  }
  function sceneryFor(name) {
    if (scenery.has(name)) return scenery.get(name);
    const entry = {};
    scenery.set(name, entry);
    for (const layer of ["L1", "L3"]) {
      const image = new Image(); entry[layer] = image;
      image.src = source + `images/racebg_v2/${name}_${layer}.webp`;
      image.onerror = () => { root.dataset.assetError = `${name}_${layer}`; };
    }
    return entry;
  }
  // 地平線と足元を別速度で流す。原作の描画原理のみ再利用し、レース乱数や距離判定は持ち込まない。
  function drawScenery() {
    const canvas = el(".dragon-racing-scenery"), ctx = canvas.getContext("2d");
    const w = canvas.width, h = canvas.height, images = sceneryFor(racing.background);
    ctx.clearRect(0, 0, w, h);
    function strip(image, distance, y, height, top) {
      if (!image.complete || !image.naturalWidth) return;
      const sh = top ? image.naturalHeight - top : Math.min(image.naturalHeight, image.naturalWidth * h / w);
      const sy = top || (image.naturalHeight - sh) * .55;
      const offset = distance % (2 * w);
      // 鏡像を交互に接続して端の切替を連続にする。ファイルへの加工はしない。
      for (let i = 0; i < 4; i++) {
        ctx.save(); ctx.translate(i * w - offset, y);
        if (i % 2) { ctx.translate(w, 0); ctx.scale(-1, 1); }
        // L3右端の納品時の継ぎ合わせ帯を使わず、連続している画角だけを鏡像接続する。
        ctx.drawImage(image, 0, sy, image.naturalWidth * (top ? .90 : 1), sh, 0, 0, w, height); ctx.restore();
      }
    }
    strip(images.L1, racing.distance * .12, 0, h, 0);
    // L3先頭約24%の不透明な納品帯を表示しない。
    strip(images.L3, racing.distance, h * .47, h * .53, images.L3.naturalHeight * .24);
    if (mode === "race" && (racing.speed > 300 || content.TRACKS[displaySection].weather === "strong_wind")) {
      ctx.strokeStyle = "rgba(237,238,228,.22)"; ctx.lineWidth = 1;
      for (let i = 0; i < 9; i++) {
        const x = w - ((racing.distance * 1.7 + i * 173) % (w + 140));
        const y = 90 + (i * 23) % 116;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 22 + racing.speed * .04, y - 1); ctx.stroke();
      }
    }
  }
  function drawRacingDragons() {
    racing.nodes.forEach((canvas, i) => {
      const sprite = sprites.get(canvas.dataset.dragon);
      if (!sprite?.ready) return;
      const ctx = canvas.getContext("2d"), t = racing.clock;
      ctx.clearRect(0, 0, 192, 144);
      // 4枚の異なる体形を高速切替すると鼻・腹・脚まで跳ねる。伸ばした翼での滑空を基準にする。
      // 順位を変える横移動はrunnerPositionsだけが所有し、ここでは鼻先を軸に呼吸する。
      ctx.drawImage(sprite.frames[1], 0, 0);
      const flight = Math.sin(t * 2.2 + i * 1.9);
      const lean = -Math.min(2.8, racing.speed / 380) + flight * .35;
      canvas.style.transform = `translateY(${(flight * 1.7).toFixed(2)}px) rotate(${lean.toFixed(2)}deg)`;
    });
  }
  function stopRacing() {
    cancelAnimationFrame(racing.frame); racing.frame = 0; racing.last = 0;
    racing.speed = 0;
    racing.nodes.forEach(canvas => {
      canvas.style.removeProperty("transform");
      const sprite = sprites.get(canvas.dataset.dragon);
      if (sprite?.ready) { const ctx = canvas.getContext("2d"); ctx.clearRect(0, 0, 192, 144); ctx.drawImage(sprite.pose, 0, 0); }
    });
  }
  function raceFrame(now) {
    racing.frame = 0;
    if (!racing.visible || racing.reduced || document.hidden || !root.closest(".app-view")?.classList.contains("is-active")
      || root.dataset.surface === "town" || root.dataset.surface === "boss"
      || modalOpen() || !["race", "photo", "result", "quiet"].includes(mode)) { stopRacing(); return; }
    const dt = Math.min(.05, racing.last ? (now - racing.last) / 1000 : 0);
    racing.last = now;
    const rush = displayPhase === "bonus";
    drive.kick *= Math.exp(-dt * 3);
    const finishing = finish.transaction === tx?.transactionId;
    const target = rush ? 540 + drive.kick * 450 : finishing ? root.dataset.finish === "done" ? 0 : finish.elapsed < 600 ? 660 : finish.elapsed < 880 ? 0 : 100 : mode === "photo" ? 660 : ["result", "quiet"].includes(mode) ? 0 : isObservation() ? 55 : [300, 540, 1000, 680][tx?.landed.length || 0];
    racing.speed += (target - racing.speed) * (1 - Math.exp(-dt * 3));
    if (finishing && finish.elapsed >= 600 && finish.elapsed <= 880) racing.speed = 0;
    racing.distance += racing.speed * dt; racing.clock += dt;
    drawScenery();
    if (!finishing) drawRacingDragons();
    else racing.nodes.forEach(canvas => { canvas.style.transform = "none"; });
    racing.frame = requestAnimationFrame(raceFrame);
  }
  function syncRacing(background) {
    racing.background = background;
    racing.reduced = reducedMotion();
    racing.visible = Boolean(root.closest(".app-view")?.classList.contains("is-active")) && document.getElementById("helpOverlay")?.hidden !== false;
    if (racing.reduced || !racing.visible || document.hidden || ["town","boss"].includes(root.dataset.surface) || !["race", "photo", "result", "quiet"].includes(mode)) stopRacing();
    else if (!racing.frame) { racing.last = 0; racing.frame = requestAnimationFrame(raceFrame); }
  }
  function render() {
    if (!active || !root || !api) return;
    if (locked && mode === "result") resultReadRemaining();
    host.dataset.activeMachine = "dragon-race"; host.dataset.episode = "dragon";
    attr(root, "phase", displayPhase); attr(root, "heat", tx?.heat || 1);
    attr(root, "spinning", Boolean(api.state.spinning));
    attr(root, "jackpot", tx?.status === "settled" && Boolean(settledGridResult?.jackpot));
    attr(root, "presentation", isObservation() ? "observation" : "race");
    attr(root, "mode", mode); attr(root, "stopCount", tx?.landed.length || 0);
    attr(root, "reduced", reducedMotion());
    attr(root, "outcome", tx?.result ? tx.result.receipt.payout > 0 ? "win" : tx.result.receipt.replay ? "replay" : "miss" : "pending");
    api.audio.setMood("silent"); syncSound();
    const member = content.JOURNEY[displaySection];
    const background = displayPhase === "boss" || displayPhase === "bonus" ? "stadium" : courses[displaySection];
    if (el(".dragon-sky").dataset.course !== background) {
      el(".dragon-sky").dataset.course = background;
      el(".dragon-sky").style.backgroundImage = `url("${source}images/racebg_v2/${background}_L1.webp")`;
    }
    root.style.setProperty("--dragon-accent", palette[displaySection]);
    const expression = root.dataset.scene === "boss-win" || root.dataset.scene === "strong-hit" ? "happy"
      : tx?.status === "settled" && (tx.result.receipt.payout > 0 || tx.result.receipt.replay) ? "smile" : "default";
    const tour = tourView(), outfit = experience.sceneOutfit(displayPhase, tour.town, preferences.outfit);
    attr(root, "outfit", outfit);
    picture(el(".dragon-mimi"), `images/cast/mimi/mimi_${outfit}_${expression}.webp`);
    picture(el(".dragon-advisor"), content.CAST[displayPhase === "boss" ? "celestia" : member.id].source);
    el(".dragon-advisor").alt = content.CAST[displayPhase === "boss" ? "celestia" : member.id].name;
    text(".dragon-section", displayPhase === "boss" ? isEncore() ? "継続レース" : "神眼レース" : displayPhase === "bonus" ? `BONUS ×${progress.chainSets || 1}` : displayPhase === "trial" ? "CHANCE" : content.TRACKS[displaySection].name);
    const machineTitle = document.querySelector(".machine-stage-label")?.parentElement.querySelector("strong");
    if (machineTitle && machineTitle.textContent !== "ミミのドラゴンレース紀行") machineTitle.textContent = "ミミのドラゴンレース紀行";
    document.querySelector(".machine-stage-label").textContent = displayPhase === "boss" ? isEncore() ? "継続レース" : "神眼レース" : displayPhase === "trial" ? "CHANCE" : displayPhase === "bonus" ? "BONUS" : "NORMAL";
    text(".dragon-journey", `紀行 ${progress.journey + 1}`);
    const nextOrder = progression.order(progress);
    text(".dragon-order", `${nextOrder.title}　${Math.min(progress.orderProgress, nextOrder.target)}/${nextOrder.target}${progress.orderProgress >= nextOrder.target ? " · 達成" : ""}`);
    text(".dragon-album-count", `${progress.album.length}/32`);
    let objective = progress.phase === "boss" ? `神眼の圧力 ${progress.bossHp}　残り ${5 + progress.resolve - progress.bossTurns}G`
      : progress.phase === "bonus" ? `BONUS　残り ${progress.bonusLeft}G`
      : progress.phase === "trial" ? `予想 ${progress.trialScore}/3　残り ${3 - progress.trialGames}G`
      : `観察 ${progress.points}/${progression.TARGETS[progress.section]}`;
    if (progress.ready && progress.phase === "normal") objective += "　次の非REPLAYで観察完成";
    else if (progress.dry && progress.phase === "normal") objective += `　手がかり ${progress.dry}/4`;
    text(".dragon-progress", objective);
    if (progress.phase === "boss" && progress.raceKind === "encore") text(".dragon-progress", `継続 ${progress.continuationScore}/4点 · 残り ${3 - progress.bossTurns}G · ストック ${progress.stock}個`);
    const visibleProgress = locked && mode === "photo" ? round.prior : progress;
    let hardware = document.querySelector('.dragon-hardware');
    if (!hardware) {
      hardware = document.createElement('div'); hardware.className = 'dragon-hardware';
      hardware.innerHTML = '<div><span>応援</span><strong data-dragon-cheers></strong><i></i><i></i></div><div><span>継続ストック</span><strong data-dragon-stock></strong><i></i><i></i></div>';
      document.querySelector('.machine-metrics').append(hardware);
    }
    hardware.querySelector('[data-dragon-cheers]').textContent = `${visibleProgress.cheers} / 2`;
    hardware.querySelector('[data-dragon-stock]').textContent = `${visibleProgress.stock} / 2`;
    [...hardware.children].forEach((group, index) => group.querySelectorAll('i').forEach((lamp, i) => lamp.classList.toggle('is-lit', i < (index ? visibleProgress.stock : visibleProgress.cheers))));
    hardware.title = 'BONUSの成立役で蓄積。応援は継続勝負の初期点、ストックは失敗時に1個消費して復活。';
    const ratio = displayPhase === "boss" ? isEncore() ? visibleProgress.continuationScore / 4 : 1 - visibleProgress.bossHp / 75 : displayPhase === "trial" ? visibleProgress.trialScore / 3
      : displayPhase === "bonus" ? visibleProgress.bonusLeft / 10 : visibleProgress.points / progression.TARGETS[visibleProgress.section];
    el(".dragon-progress-fill").style.transform = `scaleX(${Math.max(0, Math.min(1, ratio))})`;
    text(".dragon-phase-score", displayPhase === "bonus" ? `残り ${visibleProgress.bonusLeft}G　◆ ${visibleProgress.stock}　応援 ${visibleProgress.cheers}/2`
      : displayPhase === "boss" ? isEncore() ? `継続 ${visibleProgress.continuationScore}/4　残り ${3-visibleProgress.bossTurns}G　◆ ${visibleProgress.stock}` : `着差 ${visibleProgress.bossHp} → 0　残り ${5+visibleProgress.resolve-visibleProgress.bossTurns}G`
      : displayPhase === "trial" ? `予想 ${visibleProgress.trialScore}/3　残り ${3-visibleProgress.trialGames}G` : `観察 ${visibleProgress.points}/${progression.TARGETS[visibleProgress.section]}`);
    root.querySelectorAll(".dragon-route span").forEach((node, i) => {
      const stage = progress.phase === "normal" ? progress.section : progress.phase === "trial" ? 4 : progress.phase === "boss" ? 5 : 6;
      node.classList.toggle("is-current", i === stage); node.classList.toggle("is-done", i < stage);
    });
    root.querySelectorAll(".dragon-street").forEach((node, i) => {
      node.classList.toggle("is-done", (tx?.landed.length || 0) > i);
      node.classList.toggle("is-current", (tx?.landed.length || 0) === i + 1);
    });
    if (command !== null && !locked && !api.state.spinning) introduction();
    attr(root, "mode", mode);
    const view = raceView();
    attr(root, "raceStyle", view?.styleId || "duel");
    attr(root, "raceVerdict", view?.kind || "pending");
    attr(root, "hasRace", Boolean(tx));
    attr(root, "tier", scenePlan?.tier || 1);
    const reading = tx && (experience.canRead(round?.prior || progress, tx.flagId) || progression.order(progress).id === "aim") && ["normal","boss"].includes(tx.phase);
    text(".dragon-signal", mode === "race" && scenePlan?.tier >= 2 ? reading ? "見切り · AIMでSTOP" : scenePlan.label : "");
    text(".dragon-stakes", mode === "race" && tx ? `★ ${pickName()}を応援\n1着で配当` : "");
    text(".dragon-goal", "");
    attr(root,"reading",Boolean(reading));
    const count = tx?.landed.length || 0;
    const smallCall = tx ? ["", `${pickName()}が来た`, content.DRAGON_FORM[pickId()].specialty, ""][count] : "";
    const resultCalls = { "continuation-win": round?.events.includes("stock-used") ? "ストックで復活！" : "もう1セット！", "continuation-enter": "セラムで4点を狙え", "boss-win": "神眼突破！", "boss-enter": "神眼に挑め", "stock-earned": "継続ストック！", "cheer-earned": "次のレースへ応援を持越し" };
    text(".dragon-line", mode === "race" ? isObservation() ? smallCall : view?.call || "" : mode === "result" ? resultCalls[root.dataset.scene] || "" : "");
    if (mode === "photo") text(".dragon-call", finish.crossed.length ? "GOAL!" : "最後の直線！");
    if (displayPhase === "bonus") { text(".dragon-call", ""); text(".dragon-line", ""); text(".dragon-stakes", ""); }
    if (tour.town) {
      text(".dragon-section", tour.sight.name);
      text(".dragon-line", tour.omen ? "あれ…歓声が？" : ["intro","race"].includes(mode) ? tour.line : "");
      text(".dragon-stakes", "");
      if (mode === "photo") text(".dragon-call", "");
    } else if (displayPhase === "boss" && !isEncore()) {
      text(".dragon-stakes", mode === "race" ? "神眼の圧力を0へ → 突破" : "");
      if (mode === "race") text(".dragon-line", ["", "神眼を突き破れ！", "砕けるか…！", ""][count]);
      if (mode === "photo") text(".dragon-call", "突き破れ！");
    }
    const conversation = roadTalk(member, tour);
    attr(root,'travelTalk',Boolean(conversation));
    if (conversation) {
      const id = conversation[0] === 'ミミ' ? 'mimi' : member.id;
      speaker(id, conversation[1]);
      picture(el('.dragon-travel-portrait'), content.CAST[id].source);
      el('.dragon-travel-portrait').alt = content.CAST[id].name;
    }
    attr(root,"hasCall", Boolean(el(".dragon-line").textContent));
    text(".dragon-next", command === 0 ? "PUSH" : locked ? mode === "result" ? "PUSHで次へ" : "判定中" : api.state.spinning ? "STOP" : "SPIN");
    text(".dragon-save-error", saveConflict ? "別のタブで記録が更新されました。このタブは停止中です。再読み込みして続きを遊んでください。" : saveError ? "記録を保存できません。空き容量を確認してください。" : "");
    spectacle.update({ tour, mode, count, transaction: tx?.transactionId || 0, boss: displayPhase === "boss" && !isEncore(),
      phase: displayPhase, reduced: reducedMotion(), modal: modalOpen(), outfit, expression,
      progress: visibleProgress, prior: round?.prior, encore: isEncore(), pick: pickName(), observation: isObservation(),
      dragons: content.FINALE.displayRoster.map(id => sprites.get(id)?.frames),
      pickPose: dragonSprite(pickId()).pose, payout: tx?.status === "settled" ? tx.result.receipt.payout : 0,
      support: tx?.result?.receipt.support, bet: api.state.bet,
      journeyTarget: progression.TARGETS[visibleProgress.section],
      auto: api.state.auto, turbo: api.state.turbo, spinning: api.state.spinning });
    updateRetry(); paintDragons(); runnerPositions(); syncRacing(background);
  }
  function updateRetry() {
    const node = el(".dragon-retry");
    const lost = ["result", "quiet"].includes(mode) && tx?.status === "settled" && !tx.result.receipt.payout && !tx.result.receipt.replay;
    node.hidden = !lost || displayPhase === "bonus";
    if (node.hidden) return;
    let title = "", detail = "", filled = 0, slots = 0;
    if (round?.events.includes("trial-retry")) {
      title = "予想は届かず…"; detail = `試走 ${progress.trialAttempts}/3 を記録。3度の試走で神眼へ`;
      filled = progress.trialAttempts; slots = 3;
    } else if (round?.prior.phase === "boss" && round.prior.raceKind !== "encore") {
      title = progress.bossHp < 75 ? "亀裂は、そのまま残る" : "神眼は崩せず…"; detail = `残りの圧力 ${progress.bossHp}${round.events.includes("boss-retry") ? ` · 次は支援 Lv.${progress.resolve}` : ""}`;
    } else if (round?.events.includes("journey-clear")) {
      title = "継続ならず"; detail = `獲得した ${progress.lastBonus.toLocaleString("ja-JP")}枚と衣装は持ち帰る`;
    } else if (progress.phase === "normal") {
      title = progress.ready ? "走りの手がかりが揃った" : "走りを観察中";
      detail = progress.ready ? "次のREPLAY以外で、観察が1つ進む" : "外れても、走りの手がかりが残る";
      filled = progress.dry; slots = 4;
    } else if (progress.phase === "trial") {
      title = "予想は届かず…"; detail = `予想 ${progress.trialScore}/3 · あと${3-progress.trialGames}回`;
    } else { node.hidden = true; return; }
    node.querySelector("strong").textContent = title;
    node.querySelector("span").textContent = detail;
    const marks = node.querySelector("b");
    marks.hidden = !slots;
    [...marks.children].forEach((mark, i) => { mark.hidden = i >= slots; mark.classList.toggle("is-filled", i < filled); });
  }
  function syncAim(prompt) {
    if (!active || !api) return;
    const spin = document.getElementById("spinBtn");
    const cue = api.state.spinning && !locked && command !== 0 ? prompt : "";
    const previous = spin.dataset.dragonAim;
    spin.dataset.dragonAim = cue;
    if (cue) {
      spin.textContent = cue.toUpperCase();
      spin.setAttribute("aria-label", cue === "aim" ? "見切り・今！ 次のリールを止める" : "見切り待機・押すと次のリールを止める");
    } else if (previous) spin.textContent = api.state.spinning ? "STOP" : "SPIN";
  }
  function cancelDrive() {
    drive.held = false; drive.pending = false;
    drive.node?.classList.remove("is-held");
  }
  function driveVisible() {
    return drive.exit || displayPhase === "bonus";
  }
  function driveTick() {
    clearTimeout(drive.timer); drive.timer = 0;
    if (!drive.node || drive.node.hidden) return;
    const visible = !document.hidden && root.closest(".app-view")?.classList.contains("is-active");
    if (!visible || modalOpen()) { cancelDrive(); return; }
    if (drive.engaged && tx?.phase === "bonus" && api.state.spinning) {
      // 一押しで無料の一回を実行。既存STOPを順に押すため滑り・成立・精算は共通のまま。
      if (performance.now() - drive.started >= (api.state.turbo ? 360 : 540) + tx.accepted.length * 110) {
        const button = document.querySelectorAll(".stop-button")[tx.accepted.length];
        if (button && !button.disabled) button.click();
      }
    } else if (drive.engaged && locked && canAdvanceResult()) {
      controller.seek(controller.snapshot().duration);
    } else if (!locked && !api.state.spinning) {
      drive.engaged = false;
      if (!drive.exit && progress.phase === "bonus" && (drive.held || drive.pending)) {
        drive.pending = false;
        if (command === 0) push();
        const spin = document.getElementById("spinBtn");
        if (!spin.disabled) {
          drive.started = performance.now(); drive.engaged = true;
          spin.click();
          if (!api.state.spinning) drive.engaged = false;
        }
      }
    }
    drive.timer = setTimeout(driveTick, 60);
  }
  function drivePress() {
    if (saveConflict || modalOpen() || document.hidden || !root.closest(".app-view")?.classList.contains("is-active")) return;
    const now = performance.now(), rested = now - drive.lastPress > 500;
    drive.lastPress = now;
    drive.kick = 1;
    drive.node.getAnimations().forEach(a => a.cancel());
    if (!reducedMotion()) drive.node.animate([{ transform: "translateY(3px) scale(.94)" }, { transform: "translateY(0) scale(1)" }], { duration: 180 });
    if (drive.exit) {
      // BONUS終了時は連打を受け止める。手を離し、一呼吸後の新しい押下だけで継続勝負へ。
      if (rested && !drive.held && !locked && !api.state.spinning) {
        drive.exit = false; cancelDrive(); push(); controls();
      }
      return;
    }
    if (progress.phase !== "bonus") return;
    if (api.audio.enabled && now - (drive.soundAt || 0) > 160) { api.audio.cue("notice"); drive.soundAt = now; }
    // 待機中の最後の一押しは、無料区間内の次の一回として保持する。
    drive.pending = true;
    if (api.state.spinning && tx?.phase === "bonus") drive.engaged = true;
    driveTick();
  }
  function mountDrive() {
    const button = document.createElement("button"); drive.node = button;
    button.type = "button"; button.className = "dragon-drive"; button.hidden = true;
    button.innerHTML = '<img src="./machines/dragon-race/assets/spectacle-v1/rush-button-v4.png" alt=""><strong>疾走</strong><span>連打・長押し</span>';
    host.append(button);
    button.addEventListener("pointerdown", event => {
      if (event.button !== 0) return;
      event.preventDefault(); button.focus({ preventScroll: true });
      drivePress();
      if (!drive.exit && progress.phase === "bonus" && !modalOpen()) { drive.held = true; button.classList.add("is-held"); }
      button.setPointerCapture(event.pointerId);
    });
    const release = () => { drive.held = false; button.classList.remove("is-held"); };
    button.addEventListener("pointerup", release);
    button.addEventListener("pointercancel", cancelDrive);
    button.addEventListener("lostpointercapture", release);
    button.addEventListener("click", event => { if (event.detail === 0) drivePress(); });
    button.addEventListener("keydown", event => {
      if (![" ", "Enter"].includes(event.key)) return;
      event.preventDefault(); event.stopPropagation();
      if (!event.repeat) { drivePress(); if (!drive.exit && progress.phase === "bonus") drive.held = true; }
    });
    button.addEventListener("keyup", event => { if ([" ", "Enter"].includes(event.key)) { event.preventDefault(); event.stopPropagation(); release(); } });
    window.addEventListener("blur", cancelDrive);
    document.addEventListener("visibilitychange", () => { if (document.hidden) cancelDrive(); else driveTick(); });
  }
  function controls() {
    if (!active || !root) return;
    const spin = document.getElementById("spinBtn"), push = document.getElementById("pushBtn");
    if (locked || drive.exit || command === 0 || !el(".dragon-album").hidden) { spin.disabled = true; spin.setAttribute("aria-disabled", "true"); spin.classList.add("is-disabled"); }
    if (push) {
      // SPINと同じ場所のPUSHを、結果の確認にも使う。判定前の入力は予約しない。
      const visible = locked || command === 0;
      const enabled = !api.state.spinning && !modalOpen() && (locked ? canAdvanceResult() : command === 0);
      const cheering = locked && !modalOpen();
      push.hidden = !visible; push.disabled = !(enabled || cheering);
      push.querySelector("strong").textContent = locked ? mode === "result" ? enabled ? "次へ" : tx?.result?.receipt.payout ? "獲得！" : "結果" : "応援" : "PUSH";
      push.setAttribute("aria-label", locked ? enabled ? "結果を確認して次へ" : "押して応援。結果が見えてから次へ進めます" : "メッセージを次へ進める");
      push.setAttribute("aria-hidden", String(!visible)); push.setAttribute("aria-disabled", String(push.disabled));
      push.dataset.action = enabled ? "next" : cheering ? "cheer" : "wait";
      let hint = push.querySelector('span'); if (!hint) { hint=document.createElement('span');push.prepend(hint); }
      hint.textContent = enabled ? '次へ進む' : cheering ? '連打で声援！' : '演出を再生中';
    }
    const free = progress.phase === 'bonus' || displayPhase === 'bonus' && locked || api.state.freeSpin;
    spin.dataset.action = api.state.spinning ? 'stop' : free ? 'free' : 'spin';
    spin.dataset.hint = api.state.spinning ? 'リールを止める' : free ? '無料で回す' : '回す';
    const bet = document.getElementById('bet');
    if(bet){bet.parentElement.dataset.free=String(free);bet.textContent=free?'無料':String(api.state.bet);bet.parentElement.querySelector('span').textContent=free?'今回':'賭け金';}
    // 共通HUDが回転開始後に数値を描き直すので、その同一タスクの最後に無料表記を揃える。
    queueMicrotask(() => { if (bet && (progress.phase === 'bonus' || displayPhase === 'bonus' && locked || api.state.freeSpin)) bet.textContent = '無料'; });
    const metrics = document.querySelectorAll('.machine-status .metric');
    metrics[0]?.querySelector('span')?.replaceChildren(document.createTextNode('所持コイン'));
    metrics[1]?.querySelector('span')?.replaceChildren(document.createTextNode('今回の獲得'));
    document.querySelector('.machine-metrics .metric > span')?.replaceChildren(document.createTextNode('当たり線'));
    document.querySelector('.machine-marquee .jackpot > span')?.replaceChildren(document.createTextNode('大当たりで総取り'));
    el(".dragon-album-button").disabled = api.state.spinning || locked;
    for (const [id, name, enabled] of [["autoBtn", "AUTO", api.state.auto], ["turboBtn", "TURBO", api.state.turbo]]) {
      const button = document.getElementById(id);
      if (button) { button.textContent = name==='AUTO' ? `AUTO 自動${enabled ? 'ON' : 'OFF'}` : `TURBO ${enabled?'高速':'標準'}`; button.setAttribute("aria-pressed", String(enabled)); }
    }
    const sound=document.getElementById('soundBtn'),motion=document.getElementById('motionBtn');
    if(sound)sound.textContent=api.audio.enabled?'音 ON':'音 OFF';
    if(motion)motion.textContent=reducedMotion()?'動き 少なめ':'動き 標準';
    if(settingsButton) {
      settingsButton.querySelector("span").textContent = `${api.state.auto ? "自動" : "手動"}・${api.state.turbo ? "高速" : "標準"}`;
      settingsButton.disabled = Boolean(settingsPanel && !settingsPanel.hidden);
    }
    syncAim(document.querySelector(".stop-button.is-hot-aim") ? "aim" : document.querySelector(".stop-button.is-hot-ready") ? "ready" : "");
    if (drive.node) {
      drive.node.hidden = !driveVisible() || modalOpen();
      host.dataset.bonusDrive = String(!drive.node.hidden);
      drive.node.querySelector("strong").textContent = drive.exit ? "継続へ" : "疾走";
      drive.node.querySelector("span").textContent = drive.exit ? "一息ついて勝負！" : "連打・長押し";
      drive.node.setAttribute("aria-label", drive.exit ? "手を離してから、継続勝負へ進む" : "疾走。1回押すと無料1回、長押しで無料区間を連続実行");
      if (!drive.node.hidden && !drive.timer) drive.timer = setTimeout(driveTick, 60);
      if (drive.node.hidden) cancelDrive();
    }
  }
  function automationChanged() {
    if (!active || !api) return;
    if (api.state.auto && command === 0 && !locked && !modalOpen()) command = 1;
    controller?.setSpeed(api.state.turbo ? 1.7 : 1);
    if (api.state.spinning) api.rearmAuto?.();
    render();
  }
  function modalOpen() {
    return settingsPanel?.hidden === false || !el(".dragon-album").hidden || document.getElementById("helpOverlay")?.hidden === false
      || document.getElementById("creditRescue")?.hidden === false;
  }
  function canAdvanceResult() {
    return locked && mode === "result" && tx?.status === "settled" && !api.state.spinning && presentationVisible() && resultReadRemaining() <= 0;
  }
  function presentationVisible() {
    return !document.hidden && !modalOpen() && root.closest(".app-view")?.classList.contains("is-active");
  }
  function resultReadRemaining() {
    const now = performance.now();
    if (!presentationVisible() && resultPausedAt === null) resultPausedAt = now;
    else if (presentationVisible() && resultPausedAt !== null) {
      resultReadableUntil += now - resultPausedAt; resultPausedAt = null;
    }
    return Math.max(0, resultReadableUntil - (resultPausedAt ?? now));
  }
  function push() {
    if (saveConflict) return true;
    if (!active) return false;
    if (modalOpen()) return true;
    if (locked) {
      pressFeedback();
      // 確定済みの演出だけを正規complete経由で終える。次のBETは別の押下で開始する。
      if (canAdvanceResult()) controller.seek(controller.snapshot().duration);
      return true;
    }
    if (command !== 0 || api.state.spinning) return false;
    command = 1; api.audio.cue("notice"); api.redraw(); api.resumeAuto?.(); return true;
  }
  function pressFeedback() {
    const button = document.getElementById("pushBtn");
    host.dataset.cheerPress = String(++pressCount);
    pressRun?.cancel(); pressGlow?.cancel();
    pressRun = button.animate(reducedMotion() ? [{ filter: "brightness(1.4)" }, { filter: "brightness(1)" }]
      : [{ transform: "translateY(3px) scale(.95)", filter: "brightness(1.3)" }, { transform: "translateY(0) scale(1)", filter: "brightness(1)" }], { duration: 150 });
    const glow = el(".dragon-cheer-glow");
    pressGlow = glow.animate([{ opacity: reducedMotion() ? .25 : .65 }, { opacity: 0 }], { duration: 240 });
    if (api.audio.enabled && pressCount % 2) api.audio.cue("notice");
  }
  function mountSettings() {
    settingsButton = document.createElement("button"); settingsButton.className = "dragon-settings-open";
    settingsButton.type = "button"; settingsButton.innerHTML = "<strong>設定</strong><span>手動・標準</span>";
    settingsButton.setAttribute("aria-haspopup", "dialog");
    host.append(settingsButton);
    settingsPanel = document.createElement("section"); settingsPanel.className = "dragon-settings"; settingsPanel.hidden = true;
    settingsPanel.setAttribute("role", "dialog"); settingsPanel.setAttribute("aria-modal", "true"); settingsPanel.setAttribute("aria-label", "遊び方の設定");
    settingsPanel.innerHTML = '<h2>遊び方の設定</h2><p>AUTOは自動で回転・停止。TURBOは回転と勝負のテンポを速くします。</p><div class="dragon-settings-options"></div><button type="button" class="dragon-settings-close">ゲームに戻る</button>';
    const toggles = document.querySelector(".machine .mode-controls");
    settingsPanel.querySelector(".dragon-settings-options").append(toggles);
    host.append(settingsPanel);
    const close = () => {
      settingsPanel.hidden = true; root.inert = false; document.querySelector(".machine").inert = false;
      api.redraw(); settingsButton.focus(); syncSound(); api.resumeAuto?.();
    };
    settingsButton.onclick = () => {
      if (modalOpen()) return;
      const automatic = api.state.auto;
      cancelDrive(); api.pauseAuto?.(); settingsPanel.hidden = false; api.state.auto = automatic;
      root.inert = true; document.querySelector(".machine").inert = true;
      controls(); render(); settingsPanel.querySelector("button").focus();
    };
    settingsPanel.querySelector(".dragon-settings-close").onclick = close;
    settingsPanel.addEventListener("keydown", event => {
      event.stopPropagation();
      if (event.key === "Escape") { event.preventDefault(); close(); }
      if (event.key === "Tab") {
        const buttons = [...settingsPanel.querySelectorAll("button:not(:disabled)")], at = buttons.indexOf(document.activeElement);
        if (event.shiftKey && at <= 0) { event.preventDefault(); buttons.at(-1).focus(); }
        else if (!event.shiftKey && at === buttons.length - 1) { event.preventDefault(); buttons[0].focus(); }
      }
    });
  }
  function begin(transaction) {
    cancelAnimationFrame(finish.frame); finish.frame = 0; finish.transaction = 0; finish.crossed = [];
    delete root.dataset.finish;
    root.querySelectorAll(".dragon-runner").forEach(node => { delete node.dataset.finishRank; delete node.dataset.target; });
    command = null;
    round = null;
    spectacle.clear();
    if (progress.phase !== "bonus") { stopRacing(); racing.distance = 0; racing.clock = 0; racing.speed = 0; }
    motionRun?.kill();
    finishReward(); clearCharacterCue();
    attr(root, "milestone", false); text(".dragon-new-reward", "");
    el(".dragon-result").removeAttribute("style"); el(".dragon-impact").removeAttribute("style");
    text(".dragon-verdict", "");
    el(".dragon-album-button").classList.remove("is-new-record");
    // 補充直後の自動再開も含め、未決着なら投入前へ戻れるチェックポイントを先に保存する。
    save({ credit: api.state.credit + transaction.debit,
      jackpot: api.state.jackpot - (transaction.debit ? window.MimiEconomyRules.jackpotContribution(transaction.bet) : 0),
      freeSpin: transaction.isReplayFree === true });
    tx = flow.beginSpin({ transactionId: transaction.id, flagId: transaction.flag, phase: progress.phase, heat: transaction.presentationHeat });
    scenePlan = experience.plan(tx.flagId, tx.phase);
    if (tx.phase === "bonus") scenePlan = { ...scenePlan, kind: "rush", suspense: 50 };
    if (tx.phase === "boss" && isEncore()) scenePlan = { ...scenePlan, title: scenePlan.title || "セラムの継続レース", label: `${progress.continuationScore}/4点 · セラムを応援` };
    mode = "race";
    root.dataset.scene = "spin"; text(".dragon-result", "");
    text(".dragon-call", tx.heat >= 4 ? "ひときわ強い気配…！" : "スタート！");
    text(".dragon-stakes", progress.phase === "boss" ? `応援 ${pickName()} · 配当で圧力を削る` : `応援 ${pickName()}${roleName() ? ` · ${roleName()}に注目` : " · 走りを見届けよう"}`);
    showActors("");
    speaker("mimi", isObservation() ? ["次の会場への道で、竜の走りを観察しましょう。", "翼の音が聞こえます。どんな走りでしょう？", "今は静かですね。リールを回して見届けましょう。"][progress.spins % 3] : progress.phase === "boss" ? isEncore() ? `${pickName()}を応援！　3Gで4点、次のBONUSを目指します！` : `${pickName()}、ついていって！　当たった配当で着差を縮めます！` : `${pickName()}、スタート！　STOPで次の展開へ！`);
    render();
  }
  function accepted(id, reel) { tx = flow.acceptStop(tx, { transactionId: id, reel }); }
  function landed(id, reel) {
    tx = flow.landReel(tx, { transactionId: id, reel });
    const count = tx.landed.length;
    const front = flow.racePresentation(tx).styleId === "front";
    const observer = displayPhase === "boss" ? isEncore() ? "mimi" : "celestia" : content.JOURNEY[displaySection].id;
    const observation = displayPhase === "boss" && isEncore() ? `${pickName()}、最後まで！　継続4点を目指しましょう！` : displayPhase === "boss"
      ? ["流れが変わったわ。こういうのは、たいてい後から意味がつくの。", "上から見ていると、レースって、川の流れに似ているの。"][tx.transactionId % 2]
      : tx.heat >= 3 ? {
        sake: `${pickName()}、${front ? "先頭を譲るな！" : "ここで脚を使え！"}　最後の脚を見とけ！`,
        mizu: `${pickName()}、${front ? "先頭を守っているわ。" : "前との差が縮んだわ。"} 最後のSTOPよ。`,
        sumika: `ミミ様、${pickName()}が${front ? "先頭を守っています" : "追い上げています"}。最後のSTOPです。`,
        makura: `${pickName()}！　おれたちの声、届け！　最後のSTOPだ！`,
      }[observer] : `${pickName()}、${front ? "先頭を守り切れるか！" : "前の竜を追っています！"}`;
    text(".dragon-call", count === 1 ? "追走！" : count === 2 ? tx.heat >= 4 ? "ここから、まくれ！" : "全速・最後の直線！" : "最後の直線！");
    if (count === 2 && scenePlan.tier >= 2 && ["normal", "trial"].includes(displayPhase) && !isObservation()) cutIn();
    speaker(count === 2 && tx.heat >= 3 ? observer : "mimi", count === 1 ? `${pickName()}、前へ！　次のSTOPで直線へ！` : count === 2 ? observation : "あと少し…！");
    if (isObservation()) speaker("mimi", ["", "竜が近づいてきました。", "あとひとつSTOP。何が揃うかな？", "走りを見届けました。"][count]);
    render();
  }
  function settled(transaction, result, flagLanded) {
    settledGridResult = result;
    tx = flow.settle(tx, { transactionId: transaction.id, flagLanded, replay: Boolean(result.replayHit), payout: result.payout,
      support: result.bonusAssist ? "bonus-minimum" : result.rescuedSymbol ? "rare-rescue" : "lines" });
    const aimed = [...document.querySelectorAll(".stop-button")].every(button => button.classList.contains("is-hot-hit"));
    round = progression.settle(progress, { flag: transaction.flag, flagLanded, replay: Boolean(result.replayHit), payout: result.payout, bet: transaction.bet, aimed }, window.MimiEconomyRules);
    if (islandRewards) window.MimiResortRewards.record(islandRewards, { paid: transaction.debit > 0, payout: result.payout });
    progress = round.next; save(); syncGame();
    if (round.prior.phase === "bonus" && progress.phase !== "bonus") { drive.exit = true; cancelDrive(); }
    el(".dragon-album-button").classList.toggle("is-new-record", round.events.includes("new-record"));
    const events = round.events;
    if (events.includes("continuation-win")) {
      scene("continuation-win", events.includes("stock-used") ? "ストックを1個使って復活！　次のBONUSへ！" : "応援が届きました！　次のBONUS 10Gへ！", 3000);
    } else if (events.includes("continuation-enter")) {
      scene("continuation-enter", `ここから継続勝負！　応援 ${progress.cheers}点を持ち込んで、3Gで4点を目指します。`, 2700, () => { command = 0; tx = null; });
    } else if (events.includes("stock-earned")) {
      scene("stock-earned", "強役成立！　次の継続失敗を救うストックを獲得しました！", 2400);
    } else if (events.includes("cheer-earned")) {
      scene("cheer-earned", `応援が集まりました！　継続勝負の開始時に ${progress.cheers}点を持ち込めます。`, 1800);
    } else if (events.includes("boss-win")) {
      scene("boss-win", "大突破！　竜たちの疾走が、隕石を突き破った！", 4800);
    } else if (events.includes("journey-clear")) {
      scene("journey-clear", events.includes("order-clear") ? `紀行の目標達成！　記念印 ${progress.stamps}` : `この紀行は完走！　目標は ${round.prior.orderProgress}/${round.order.target}。次の旅へ。`, 3600, () => { command = 0; tx = null; });
    } else if (events.includes("section-clear")) {
      scene("section-clear", progress.phase === "trial" ? "みんなの見方が揃いました。大レースへ！" : "この走りを記録しました。次の人の話を聞きましょう！", 2300, () => { command = 0; tx = null; });
    } else if (events.includes("trial-success") || events.includes("trial-learned")) {
      scene("boss-enter", events.includes("trial-learned") ? "三度の試走で走りが見えました。セレスティアさんへ！" : "予想がまとまりました。セレスティアさんへ！", 3000, () => { command = 0; tx = null; });
    } else if (events.includes("boss-retry")) {
      scene("boss-retry", `削った圧力はそのまま！　次は支援 Lv.${progress.resolve}・${5 + progress.resolve}G`, 2300);
    } else if (events.includes("trial-retry")) {
      scene("trial-retry", `予想を見直します。試走 ${progress.trialAttempts}/3 を記録しました。`, 1600);
    } else if (round.prior.phase === "boss" && round.prior.raceKind === "encore") {
      scene("continuation-turn", `継続 ${progress.continuationScore}/4点。${progress.stock ? "ストックあり・継続確定！" : `残り ${3 - progress.bossTurns}G、最後まで応援しよう！`}`, 1600);
    } else if (round.prior.phase === "boss") {
      const gap = Math.max(0, round.prior.bossHp - progress.bossHp);
      scene(gap ? "boss-hit" : "boss-miss", gap ? "竜たちの足並みが、近づいてきました！" : result.replayHit ? "まだ走れます。次の流れを見ましょう！" : "いまの走りを覚えて、次の一手へ！", gap ? 1800 : 1100);
    } else if (events.includes("observation")) {
      scene("observation", events.includes("order-ready") ? "観察の目標を達成！　この紀行を完走すると記念印です！" : result.payout > 0 ? "的中と一緒に、走りの手がかりも揃いました！" : "配当はなくても、走りの手がかりが揃いました！", 1500);
    } else if (events.includes("order-ready")) {
      scene("order-ready", "紀行の目標を達成！　完走して記念印を受け取りましょう！", 2100);
    } else if (tx.result.receipt.support === "rare-rescue") {
      scene("revive", "図柄は揃わなかったけれど、復活配当！　応援を続けられます！", 2100);
    } else if (tx.result.receipt.support === "bonus-minimum") {
      scene("bonus-support", "図柄が揃わなくても、BONUSの保証配当を受け取れます！", 1600);
    } else if (tx.heat >= 4 && result.payout > 0) {
      scene("strong-hit", "この伸び！　最後まで見ていてよかった！", 2200);
    } else {
      scene(result.payout ? "small-hit" : result.replayHit ? "replay" : "miss",
        result.payout ? tx.result.predictionHit ? `${pickName()}、伸びました！　${result.payout} CREDIT獲得です！` : `注目した役とは別のラインで、${result.payout} CREDIT獲得です！`
          : result.replayHit ? "REPLAY！　次はBETなしで、もう一度応援できます！" : isObservation() ? "竜は空の向こうへ。今回は配当なし、次の走りへ進みましょう。" : `${pickName()}、あと一歩届かず…。今回は配当なしです。`,
        result.payout ? 1650 : result.replayHit ? 1450 : 1050);
    }
  }
  function gallery(carousel) {
    window.MimiMachineLobby?.render(carousel);
  }
  function configureGuide() {
    const pages = {
      play: '<h3>走りを読む、3つのSTOP</h3><ol><li>同行者の話をPUSHで進め、BETを決めてSPIN。竜が発走します。</li><li>右の大きなボタンだけでも、SPIN → STOP（左・中・右）と続けられます。リール下の3ボタンなら好きな順番でSTOPできます。実際に止まるたび、追走 → 全速の直線 → 写真判定へ。待っている間も走行は続きます。</li><li>判定中だけ少し待ち、結果が出たら同じ場所の「次へ」で演出を切り上げられます。次のSPINはもう一度押して開始。押していない次のBETは予約しません。速さの演出だけで当たりは確定しません。</li></ol><p>Space：SPIN／次のSTOP。1・2・3：各リールのSTOP。AIMが出る紀行ではREADYの間は待ち、光ったSTOPを狙ってください。</p><p>ガイドは決着後に開けます。このガイドと「紀行の記録」を開くとAUTOはOFFになります。</p>',
      adventure: '<h3>観察から勝負、BONUSから継続へ</h3><p>普段は島で竜の走りを観察します。強い気配で三頭の勝負レースへ。金色の名前が応援する竜です。小役レースは応援竜の1着で配当、REPLAYは次のBETが無料。保証配当は図柄の成立とは別に表示します。</p><p>サケ → ミズ → スミカ → マクラの4区間を巡り、CHANCEは3Gで3点。続く神眼レースは配当で神眼の圧力を削り、隕石を突き破るイメージ演出に挑みます。ここを突破するとBET不要のBONUS 10Gです。神眼の再挑戦は削った圧力を保持します。</p><p>BONUS中、ブドウ・スイカなどの強役成立で応援点（最大2点）、BAR・青7・赤7成立で継続ストック（最大2個）を獲得。取りこぼしの復活配当・保証では増えません。BONUS後の継続レースは3Gで4点、小役配当で1点、強役成立で2点。応援点は開始時に加算します。</p><p>4点ならBONUS +10G。届かないときだけストック1個を使って継続します。ストックもなければ獲得を残して次の紀行へ。自力成功時のストックは温存、応援点は次セットで集め直します。継続レースはセレスティアの神眼予想とは別競走です。</p><p>STOPは実際のリールを止める操作です。レース映像で追加の配当は抽選しません。先行・追い込み・速さだけで当選確定ではありません。4戦進展がなくても次の非REPLAYで観察が進み、CHANCEは3回の試走でも突破できます。</p>',
      paylines: '<h3>5ラインと紀行の報酬</h3><p>中央・上・下・V字・山型の5本。左から3つ並ぶと成立します。REPLAYと別ラインの配当が同時に成立する場合は両方有効です。</p><p>この台のCREDIT・紀行はホールデムと別に保存します。CREDITが不足したら300 CREDITを補充して続けられます。累計回転・走りの記録・紀行完走で原作の衣装12着が解放されます。「紀行の記録」の衣装タブで試着・着替えができます。衣装による配当や性能の違いはありません。</p><p>通常の観察 → 好走の気配 → BAR・青7の勝負 → 赤7「夜明けの翼」で演出の格が変わります。チャンス表示は成立の保証ではなく、実際に止まった5ラインで結果が決まります。</p>',
    };
    pages.play = '<h3>BONUSは右の「疾走」ボタン</h3><p>1押しで無料1回。連打・長押しで無料区間を続けられます。途中のSTOPは自動で進み、成立した図柄と保証に応じてコインを獲得します。連打の速さで配当が増えるわけではありません。終了したら手を離し、一息ついて「継続へ」。次の有料勝負に連打は持ち越しません。</p>' + pages.play;
    for (const [id, html] of Object.entries(pages)) document.querySelector(`[data-help-page="${id}"]`).innerHTML = html;
    document.querySelectorAll('[data-route="shop"]').forEach(button => { button.hidden = true; });
  }
  function renderAlbum() {
    root.querySelectorAll("[data-album-tab]").forEach(button => button.setAttribute("aria-selected", String(button.dataset.albumTab === albumTab)));
    root.querySelectorAll("[data-album-panel]").forEach(panel => { panel.hidden = panel.dataset.albumPanel !== albumTab; });
    if (albumTab === "records") {
      el(".dragon-records").innerHTML = content.MACHINE.flagOrder.filter(x => x !== "none").map(id => `<div><strong>${window.SlotCore.SYMBOL_BY_ID.get(id)?.name || id}</strong>${[0, 1, 2, 3].map(i => `<span class="${progress.album.includes(id + ':' + i) ? 'recorded' : ''}">${content.CAST[content.JOURNEY[i].id].name}</span>`).join("")}</div>`).join("");
    } else if (albumTab === "dragons") {
      el(".dragon-observations").innerHTML = Object.entries(content.DRAGON_FORM).filter(([id]) => !["goka","glaze"].includes(id)).map(([id,form]) => {
        const count = experience.familiarity(progress,id), readable = experience.canStudy(id);
        return `<div class="${readable && count >= 2 ? 'is-read' : ''}"><strong>${content.DRAGONS[id]}</strong><span>${form.trait} · ${form.specialty}</span><b>${!readable ? `ベルの竜 · 記録 ${count}/4` : count >= 2 ? '見切り解放' : `観察 ${count}/2会場`}</b></div>`;
      }).join("");
    } else if (albumTab === "outfits") {
      el(".dragon-outfit-list").innerHTML = experience.OUTFITS.map(o => `<button type="button" data-outfit="${o.id}" aria-pressed="${o.id === previewOutfit}" class="${experience.unlocked(progress, o) ? 'unlocked' : 'locked'}"><strong>${o.name}${preferences.outfit === o.id ? ' · 着用中' : ''}</strong><span>${experience.unlocked(progress, o) ? '解放済み' : experience.condition(progress, o)}</span></button>`).join("");
      const outfit = experience.OUTFITS.find(o => o.id === previewOutfit);
      picture(el(".dragon-outfit-preview img"), `images/cast/mimi/mimi_${outfit.id}_smile.webp`);
      text(".dragon-outfit-preview p", outfit.name);
      const equip = el(".dragon-equip");
      equip.disabled = !experience.unlocked(progress, outfit) || preferences.outfit === outfit.id;
      equip.textContent = preferences.outfit === outfit.id ? "着用中" : experience.unlocked(progress, outfit) ? "この衣装で応援する" : experience.condition(progress, outfit);
    } else {
      text(".dragon-ledger", `紀行完走 ${progress.journey}回　記念印 ${progress.stamps}個\nBONUS最高 ${progress.bestBonus.toLocaleString("ja-JP")} CREDIT\n前回BONUS ${progress.lastBonus.toLocaleString("ja-JP")} CREDIT\n累計回転 ${progress.spins}G　累計配当 ${progress.totalPayout.toLocaleString("ja-JP")} CREDIT`);
      el(".dragon-music-volume").value = String(Math.round(preferences.musicVolume * 100));
      text(".dragon-audio-status", !api.audio.enabled ? "音 OFF · 設定から切り替え" : musicFailed ? "BGMを読み込めません。STOP効果音は継続します。" : musicBlocked ? "ボタン操作でBGMを再開します" : "原作レースBGM再生中 · STOP効果音は共通音源");
    }
    text(".dragon-album .album-note", albumTab === "dragons" ? "強役の竜は2会場で見切り解放。通常・神眼・継続でREADY→AIMを狙う。" : `衣装 ${experience.OUTFITS.filter(o => experience.unlocked(progress, o)).length}/12 · 記録 ${progress.album.length}/32 · 衣装は見た目だけ。`);
  }
  function attach(injected) {
    api = injected;
    if (!active) return;
    content.validateCore(window.SlotCore);
    progress = load(); displaySection = progress.section; displayPhase = progress.phase;
    loadPreferences(); previewOutfit = preferences.outfit;
    host = document.getElementById("gameShell");
    if (!host) throw new Error("V5筐体が見つかりません");
    root = document.createElement("section"); root.className = "dragon-stage"; root.setAttribute("aria-label", "ミミのドラゴンレース紀行");
    root.innerHTML = `<div class="dragon-sky"></div><canvas class="dragon-racing-scenery" width="1182" height="304" aria-hidden="true"></canvas><div class="dragon-shade"></div>
      <header class="dragon-top"><span class="dragon-journey"></span><strong class="dragon-section"></strong><button class="dragon-album-button" type="button">記録 <b class="dragon-album-count"></b></button></header>
      <img class="dragon-mimi" alt="ミミ"><img class="dragon-advisor" alt="サケ">
      <div class="dragon-intro-card"><h2></h2><p class="intro-goal"></p><nav class="dragon-route" aria-label="大レースへの道">${["サケ", "ミズ", "スミカ", "マクラ", "CHANCE", "神眼", "BONUS"].map(name => `<span>${name}</span>`).join("")}</nav><p class="intro-help"></p><p class="intro-reward"></p><button type="button" class="dragon-sound-choice"></button></div>
      <div class="dragon-cutin" aria-hidden="true"><img alt=""><strong></strong><span></span></div><div class="dragon-cheer-glow" aria-hidden="true"></div>
      <div class="dragon-impact" aria-hidden="true"></div><div class="dragon-jackpot" role="status"><strong>JACKPOT</strong><span>夜明けの翼 · 特別配当獲得</span></div><div class="dragon-call"></div><div class="dragon-stakes"></div><div class="dragon-goal"></div>
      <ol class="dragon-lineup" aria-label="出走する竜"><li></li><li></li><li></li></ol>
      <div class="dragon-course"><div class="dragon-finish"></div>${[0, 1, 2].map(i => `<div class="dragon-runner runner-${i}"><canvas width="192" height="144" role="img"></canvas><span class="dragon-pick"></span></div>`).join("")}</div>
      <div class="dragon-streets"><span class="dragon-street">追走</span><span class="dragon-street">全速の直線</span><span class="dragon-street">写真判定</span></div>
      <div class="dragon-story"><span class="dragon-travel-face"><img class="dragon-travel-portrait" alt=""></span><span class="dragon-speaker"></span><p class="dragon-line"></p><b class="dragon-next"></b></div>
      <div class="dragon-result" role="status"></div><div class="dragon-award"><span>WIN</span><strong>0</strong></div><div class="dragon-verdict"></div>
      <div class="dragon-milestone"><strong></strong><span></span></div><div class="dragon-new-reward" role="status"></div>
      <div class="dragon-retry" hidden><strong></strong><b aria-hidden="true"><i></i><i></i><i></i><i></i></b><span></span></div>
      <div class="dragon-signal"></div><div class="dragon-phase-hud"><span class="dragon-phase-score"></span><div class="dragon-progress-track"><i class="dragon-progress-fill"></i></div></div>
      <div class="dragon-bottom"><span class="dragon-progress"></span><span class="dragon-order"></span></div>
      <div class="dragon-save-error" role="alert"></div><section class="dragon-album" hidden><button class="dragon-album-close" type="button">閉じる</button><h2>紀行の記録と衣装</h2>
      <div class="dragon-album-tabs" role="tablist" aria-label="記録の種類"><button type="button" role="tab" data-album-tab="records">走りの記録</button><button type="button" role="tab" data-album-tab="dragons">竜の観察</button><button type="button" role="tab" data-album-tab="outfits">衣装12着</button><button type="button" role="tab" data-album-tab="ledger">戦績・音楽</button></div>
      <div data-album-panel="records"><div class="dragon-records"></div></div>
      <div data-album-panel="dragons"><div class="dragon-observations"></div></div>
      <div data-album-panel="outfits" hidden><div class="dragon-outfit-list"></div><div class="dragon-outfit-preview"><img alt="衣装の試着"><p></p><button class="dragon-equip" type="button"></button></div></div>
      <div data-album-panel="ledger" hidden><p class="dragon-ledger"></p><label class="dragon-volume-label">BGM音量 <input class="dragon-music-volume" type="range" min="0" max="60" step="1"></label><p class="dragon-audio-status"></p></div>
      <p class="album-note"></p></section>`;
    document.querySelector(".theater").append(root);
    spectacle = window.MimiDragonSpectacle.create(host, root);
    mountDrive();
    mountSettings();
    music = new Audio(); music.loop = true; music.preload = "none";
    music.addEventListener("error", () => { musicFailed = true; });
    document.addEventListener("pointerup", () => { if (musicBlocked) syncSound(); });
    document.addEventListener("keydown", () => { if (musicBlocked) syncSound(); });
    el(".dragon-sound-choice").onclick = () => { document.getElementById("soundBtn").click(); render(); };
    racing.nodes = [...root.querySelectorAll(".dragon-runner canvas")];
    document.addEventListener("visibilitychange", () => { if (locked && mode === "result") resultReadRemaining(); if (document.hidden) stopRacing(); else syncRacing(racing.background); syncSound(); });
    window.addEventListener("storage", event => {
      if (event.storageArea === localStorage && (event.key === saveKey || event.key === null) && localStorage.getItem(saveKey) !== loadedSave) markSaveConflict();
    });
    window.addEventListener("pagehide", () => { stopRacing(); music.pause(); });
    matchMedia("(prefers-reduced-motion: reduce)").addEventListener("change", () => render());
    const visibilityObserver = new MutationObserver(() => { render(); });
    visibilityObserver.observe(document.getElementById("helpOverlay"), { attributes: true, attributeFilter: ["hidden"] });
    visibilityObserver.observe(root.closest(".app-view"), { attributes: true, attributeFilter: ["class"] });
    controller = window.MimiPresentation.createPresentationController({
      definitions: { event: { priority: 50, beats: [{ id: "anticipation", duration: 350 }, { id: "reveal", duration: 1400 }, { id: "hold", duration: 350 }] } },
      render: renderFrame,
    });
    controller.subscribe(finishScene);
    configureGuide();
    el(".dragon-album-button").onclick = () => {
      if (api.state.spinning || locked) return;
      api.state.auto = false;
      api.pauseAuto?.();
      el(".dragon-album").hidden = false;
      renderAlbum(); el(".dragon-album-close").focus(); controls(); render();
    };
    const closeAlbum = () => { el(".dragon-album").hidden = true; api.redraw(); el(".dragon-album-button").focus(); syncSound(); };
    el(".dragon-album-close").onclick = closeAlbum;
    el(".dragon-album").setAttribute("role", "dialog");
    el(".dragon-album").setAttribute("aria-label", "紀行の記録");
    el(".dragon-album").setAttribute("aria-modal", "true");
    el(".dragon-album").addEventListener("click", event => {
      const tab = event.target.closest("[data-album-tab]");
      if (tab) { albumTab = tab.dataset.albumTab; renderAlbum(); }
      const outfit = event.target.closest("button[data-outfit]");
      if (outfit && el(".dragon-album").contains(outfit)) { previewOutfit = outfit.dataset.outfit; renderAlbum(); el(`button[data-outfit="${previewOutfit}"]`).focus(); }
    });
    el(".dragon-equip").onclick = () => {
      const outfit = experience.OUTFITS.find(o => o.id === previewOutfit);
      if (!experience.unlocked(progress, outfit)) return;
      preferences.outfit = outfit.id; savePreferences(); renderAlbum(); render(); api.audio.cue("notice");
    };
    el(".dragon-music-volume").oninput = event => { preferences.musicVolume = Number(event.target.value) / 100; savePreferences(); syncSound(); };
    el(".dragon-album").addEventListener("keydown", event => {
      if (event.key === "Escape") { event.preventDefault(); closeAlbum(); }
      if (event.key === "Tab") {
        const buttons = [...el(".dragon-album").querySelectorAll("button:not(:disabled), input")].filter(node => node.getClientRects().length);
        const index = buttons.indexOf(document.activeElement);
        if (event.shiftKey && index <= 0) { event.preventDefault(); buttons.at(-1).focus(); }
        else if (!event.shiftKey && index === buttons.length - 1) { event.preventDefault(); buttons[0].focus(); }
      }
    });
    ["rubel", "seram", "miruka", "rosso", "gando", "phenix", "goka", "glaze"].forEach(dragonSprite);
    courses.forEach(sceneryFor);
    ["smile", "happy"].forEach(name => { const image = new Image(); image.src = source + `images/cast/mimi/mimi_buniqro_${name}.webp`; });
    Object.values(content.CAST).forEach(member => { const image = new Image(); image.src = source + member.source; });
    Object.values(content.CHARACTER_ART).forEach(art => { const image = new Image(); image.src = art.image; });
    syncGame();
    queueMicrotask(() => { render(); controls(); });
  }
  window.MimiDragonMachine = Object.freeze({ active, attach, gallery, begin, accepted, landed, settled, render, controls, push, syncSound, automationChanged,
    skillActive: flag => active && progress && (progression.order(progress).id === "aim" || experience.canRead(progress,flag)) && ["normal", "boss"].includes(progress.phase),
    syncAim,
    // 三本着地〜共通決着の境界も回転中。演出ロックが立つ前に次のBETを許可しない。
    blocked: () => saveConflict || locked || drive.exit || command === 0 || (api?.state.spinning && tx?.landed.length === 3) || (root && modalOpen()),
    snapshot: () => JSON.parse(JSON.stringify({ progress, tx, command, locked, displaySection, displayPhase, saveError, saveConflict, preferences, music: { track: musicTrack, playing: music ? !music.paused : false, failed: musicFailed, blocked: musicBlocked }, scene: root?.dataset.scene, controller: controller?.snapshot(), racing: { active: Boolean(racing.frame), speed: racing.speed, distance: racing.distance, clock: racing.clock } })),
  });
}());
