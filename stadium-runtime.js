/* 新台の入力・描画・保存。出目は共有 SlotCore だけが決める。 */
(() => {
  "use strict";
  const flow = window.StadiumFlow, core = window.SlotCore, audio = window.MimiAudio;
  const sessions = window.MimiSpinSession;
  const KEY = "mimi.stadium.slot.v1", BET = 30;
  const $ = id => document.getElementById(`stadium${id}`);
  const stops = [...document.querySelectorAll("[data-stadium-stop]")];
  let state = flow.create(), spin = null, saved = null, sound = false, frame = 0, last = 0;
  let resultActor = null, resultText = "いちばん上まで、改造していこう。", resultHeadline = "";
  let auto = false, turbo = false, nextQueued = false, controlTimer = 0, controlEpoch = 0;
  let settledAt = 0, commandToken = "", commandSince = 0;
  const ART = "./assets/stadium/generated-v1/";
  const MODS = {
    walk: { title: "確実な出塁", promise: "不発でも、一塁へ。", rule: "REPLAYなら持ち越し", effect: "次の非REPLAYで出塁", art: ART + "augment-walk.png", call: "加速、解放！" },
    power: { title: "一発の改造", promise: "ヒットをホームランに！", rule: "不発・REPLAYでも改造継続", effect: "次のヒットがHR", art: ART + "augment-power.png", call: "剛腕、解放！" }
  };
  let feature = null, resultDetail = null;
  let musicTrack = "";
  const music = $("Music"); music.dataset.stadiumMusic = "nine-prologue";
  const musicPlayers = new Map([["nine-prologue", music]]);
  function pauseMusic() { musicPlayers.forEach(player => player.pause()); }
  const positions = [0, 7, 14];
  const symbolPath = "./assets/generated/v3/symbols/dist/";
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  let storageHealthy = true;
  // The same per-game boundary used by both existing cabinets owns STOP order
  // and exactly-once resolution. The saved index format remains compatible.
  function attachSession(transaction) {
    transaction.session = sessions.create({ phase: state.phase, stage: state.team, bet: BET, flag: transaction.flag });
    transaction.stopped.forEach((index, col) => { if (index !== null) { sessions.recordStop(transaction.session, col, { index }); sessions.markSettled(transaction.session, col); } });
    transaction.pendingStops.forEach(col => sessions.queueStop(transaction.session, col));
    transaction.pendingStops = transaction.session.pendingStopQueue;
  }
  try {
    saved = JSON.parse(localStorage.getItem(KEY));
    if (flow.valid(saved?.state)) {
      state = { ...flow.create(), ...saved.state };
      turbo = saved.settings?.turbo === true;
      if (saved.spin && ["none", ...core.SYMBOLS.map(s => s.id)].includes(saved.spin.flag)
        && Array.isArray(saved.spin.stopped) && saved.spin.stopped.length === 3
        && saved.spin.stopped.every((n, c) => n === null || (Number.isInteger(n) && n >= 0 && n < core.stripLength(c)))) {
        spin = { isFree: saved.spin.isFree !== false, flag: saved.spin.flag, stopped: saved.spin.stopped, started: performance.now(), braking: [false, false, false], pendingStops: [], lastStopAt: 0 };
        spin.pendingStops = [...new Set(Array.isArray(saved.spin.pendingStops) ? saved.spin.pendingStops : [])].filter(c => Number.isInteger(c) && c >= 0 && c < 3 && spin.stopped[c] === null);
        attachSession(spin);
        spin.stopped.forEach((n, c) => { if (n !== null) positions[c] = n; });
        resultText = "続きの打席だよ。残りのリールを止めよう！";
      }
    }
  } catch { storageHealthy = false; }
  let islandWriter = null;
  try { islandWriter = window.MimiResortRewards.createWriter("stadium"); } catch (_) { /* Preserve unreadable source data. */ }
  function save() {
    try {
      if (!islandWriter) throw new Error("保存停止・元データを保護中");
      islandWriter.save({ state, settings: { turbo }, spin: spin ? { isFree: spin.isFree, flag: spin.flag, stopped: spin.stopped, pendingStops: spin.pendingStops } : null });
      storageHealthy = true;
    } catch { storageHealthy = false; }
    $("Save").textContent = storageHealthy ? "新台専用・自動保存" : "保存できません・この画面で継続可";
  }
  function resize() {
    const scale = Math.min(innerWidth / 1280, innerHeight / 720);
    $("Cabinet").style.transform = `translate(-50%, -50%) scale(${scale})`;
  }
  const preloaded = new Set();
  function preload(src) { if(preloaded.has(src))return;preloaded.add(src);const img = new Image();img.fetchPriority="low";img.src = src; }
  function imageSource(node, src) { if (node.getAttribute("src") !== src) node.src = src; }
  function paintReel(col) {
    const cells = $("Reels").children[col].children;
    core.windowAt(col, Math.floor(positions[col])).forEach((symbol, row) => {
      imageSource(cells[row].firstElementChild, symbolPath + symbol.img);
      cells[row].firstElementChild.alt = symbol.name;
      cells[row].dataset.symbol = symbol.id;
    });
  }
  $("Reels").innerHTML = [0, 1, 2].map(c => `<div class="stadium-reel" aria-label="リール${c + 1}">${[0, 1, 2].map(() => '<div class="stadium-symbol"><img alt=""></div>').join("")}</div>`).join("");
  function showCommand(label, title, text, choices) {
    $("Command").hidden = false;
    $("CommandLabel").textContent = label;
    $("CommandTitle").textContent = title;
    $("CommandText").textContent = text;
    $("Choices").replaceChildren();
    choices.forEach(([labelText, action, mod]) => {
      const button = document.createElement("button"); button.type = "button"; button.textContent = labelText;
      if (mod) {
        button.className = "stadium-mod-choice"; button.dataset.mod = mod; button.setAttribute("aria-label", labelText);
        const art = document.createElement("img"); art.src = MODS[mod].art; art.alt = "";
        const label = document.createElement("strong"); label.textContent = labelText;
        const detail = document.createElement("small"); detail.id = `stadiumModEffect-${mod}`; detail.textContent = MODS[mod].promise;
        const rule = document.createElement("span"); rule.className = "stadium-mod-rule"; rule.id = `stadiumModRule-${mod}`; rule.textContent = MODS[mod].rule;
        button.setAttribute("aria-describedby", `${detail.id} ${rule.id}`);
        button.replaceChildren(art, label, detail, rule);
      }
      button.addEventListener("click", () => { if (!button.isConnected) return; nextQueued = false; action(); save(); render(); });
      $("Choices").append(button);
    });
  }
  function renderCommand() {
    $("Command").hidden = true;
    if (spin) return;
    const team = flow.TEAMS[state.team];
    if (state.pending === "intro") showCommand(`第${state.team + 1}戦 / 4`, team.name,
      `目標${team.target}点。成立役で走者を進めて、勝利の10Gをつかもう。`, [["PLAY BALL", () => { state.pending = ""; resultText = "さあ、一球目。打ち抜こう！"; }]]);
    else if (state.pending === "surgery") showCommand("ミミの改造チャンス", "次の打席、どう変える？",
      `あと${Math.max(0, team.target - state.runs)}点で勝利 · 次の打者：${flow.PLAYERS[state.batter].name} · リール配当は変わりません`, [
        ["確実な出塁", () => augment("walk"), "walk"], ["一発の改造", () => augment("power"), "power"]
      ]);
    else if (state.pending === "reward") showCommand("試合突破", `${state.runs}点！ 勝利！`, "ナインと走ろう。10Gの無料ウイニングラン！",
      [["BONUSへ", () => { state.pending = ""; state.phase = "bonus"; state.bonus = 10; state.bonusWin = 0; state.bonusRecorded = 0; state.lastWin = 0; resultActor = null; resultHeadline = ""; resultText = "勝利の一周、いこう！"; }]]);
    else if (state.pending === "next") showCommand("ウイニングラン完走", "次の球場へ。", `${flow.TEAMS[state.team + 1].name}が待っている。`, [["次の試合へ", () => {
      state.team++; resetMatch(); state.pending = "intro"; resultActor = null; resultHeadline = "";
    }]]);
    else if (state.pending === "champion") showCommand("全4球団突破", "私たちの野球を、証明した。", `固定ナインと${state.totalRuns}得点。ミミの改造野球、頂点へ！`, [["優勝を記録", () => {
      state.pending = ""; state.phase = "complete"; state.championships++;
    }]]);
    else if (state.phase === "complete") showCommand("CHAMPIONS", "ミミとナインの勝利！", `通算優勝 ${state.championships}回。CREDIT ${state.credit.toLocaleString("ja-JP")}`, [["もう一度、頂点へ", () => {
      state.team = 0; resetMatch(); state.totalRuns = 0; state.pending = "intro"; resultActor = null; resultHeadline = "";
    }]]);
    else if (state.credit < BET && !state.replay && state.phase !== "bonus") showCommand("リゾートサービス", "次の打席へ。", "300 CREDITを受け取って、この試合を続けられます。", [["300 CREDITを受け取る", () => { state.credit += 300; }]]);
  }
  function resetMatch() {
    resultDetail = null;
    state.phase = "normal"; state.runs = 0; state.outs = 0; state.bases = [false, false, false];
    state.dry = 0; state.augment = ""; state.bonus = 0; state.bonusWin = 0; state.bonusRecorded = 0; state.replay = false;
  }
  function augment(kind) {
    state.augment = kind; state.pending = ""; state.dry = 0;
    resultHeadline = ""; resultActor = null;
    resultText = kind === "walk" ? "次の一球で出塁させるよ！" : "次のヒットを、ホームランに変えよう！";
    presentFeature("install", kind, null, null);
    if (sound) audio.cue("revive");
  }
  function dismissFeature() { feature = null; }
  function presentFeature(kind, mod, actor, payout) {
    dismissFeature();
    feature = { kind, mod, actor, payout, runs: kind === "activate" ? resultDetail?.runs || 0 : 0, remaining: Math.max(0, flow.TEAMS[state.team].target - state.runs), until: performance.now() + (reduced.matches ? 600 : turbo ? 1100 : 2200) };
    if (!reduced.matches) {
      $("Feature").getAnimations().forEach(a => a.cancel());
      $("Feature").animate([{ opacity: 0, transform: "scale(1.08)" }, { opacity: 1, transform: "scale(1)" }], { duration: turbo ? 220 : 450, easing: "cubic-bezier(.16,1,.3,1)" });
    }
  }
  function renderFeature() {
    $("Feature").hidden = !feature;
    $("Cabinet").dataset.feature = feature?.kind || "";
    $("SurgeryArt").hidden = state.pending !== "surgery";
    if (!feature) return;
    const mod = MODS[feature.mod], install = feature.kind === "install";
    imageSource($("FeatureBackdrop"), install ? ART + "surgery-stage.png" : ART + "activation-stage.png");
    imageSource($("FeatureArt"), mod.art); $("FeatureArt").alt = mod.title;
    $("FeatureLabel").textContent = install ? "ミミの改造手術" : "改造発動";
    $("FeatureTitle").textContent = install ? "改造完了！" : mod.call;
    $("FeatureText").textContent = install ? mod.effect : `${feature.actor.name} · ${resultHeadline}`;
    $("FeatureRule").hidden = !install;
    $("FeatureRule").textContent = mod.rule;
    $("FeatureOutcome").hidden = install;
    $("FeatureRuns").textContent = feature.runs ? `+${feature.runs} 得点` : "出塁成功";
    $("FeatureGoal").textContent = feature.remaining ? `勝利まで あと${feature.remaining}点` : "目標達成！ 10Gへ";
    $("FeaturePayout").textContent = install ? "さあ、次の打席へ。" : feature.payout > 0 ? `リール配当 +${feature.payout} CREDIT` : "出塁成功 · リール配当なし";
  }
  $("VictoryRounds").innerHTML = flow.TEAMS.map((team, index) => '<li title="' + team.name + '">' + String(index + 1).padStart(2, "0") + '</li>').join("");
  $("BonusTrack").innerHTML = Array.from({ length: 10 }, () => "<i></i>").join("");
  function renderVictory() {
    const mode = state.phase === "complete" ? "complete" : state.pending === "reward" ? "reward" : state.phase === "bonus" ? state.pending || "bonus" : "";
    $("Victory").hidden = !mode;
    $("Cabinet").dataset.victory = mode;
    if (!mode) return;
    const reward = mode === "reward", running = mode === "bonus", champion = ["champion", "complete"].includes(mode);
    const consumed = reward ? 0 : 10 - state.bonus;
    const fullRecord = state.bonusRecorded === consumed;
    $("VictoryLabel").textContent = champion ? "全4球団 突破" : '第' + (state.team + 1) + '戦 突破';
    [...$("VictoryRounds").children].forEach((pip, index) => {
      pip.classList.toggle("is-cleared", index <= state.team);
      pip.setAttribute("aria-label", flow.TEAMS[index].name + (index <= state.team ? " 突破" : " 未挑戦"));
    });
    $("VictoryTitle").textContent = champion ? "CHAMPIONS" : reward ? "VICTORY" : running ? "WINNING RUN" : "RUN COMPLETE";
    $("VictorySubtitle").textContent = champion ? "ミミと固定ナイン、頂点へ。" : reward ? flow.TEAMS[state.team].name + 'を撃破！' : running ? "勝利の10G・無料ボーナス" : '第' + (state.team + 1) + '戦のウイニングラン完走';
    $("VictoryCountLabel").textContent = champion ? "大会得点" : reward ? "勝利スコア" : running ? "残り" : "完走";
    $("VictoryCount").textContent = champion ? state.totalRuns : reward ? state.runs : running ? state.bonus : 10;
    $("VictoryCountUnit").textContent = champion || reward ? "点" : "G";
    $("VictoryWinLabel").textContent = reward ? "無料ボーナス" : !fullRecord ? "再開後の配当" : champion ? "最終ボーナス配当" : "獲得配当";
    $("VictoryWin").textContent = reward ? "10" : '+' + state.bonusWin.toLocaleString("ja-JP");
    $("VictoryWinUnit").textContent = reward ? "G" : "CREDIT";
    $("BonusTrack").setAttribute("aria-valuenow", String(consumed));
    $("BonusTrack").setAttribute("aria-valuetext", consumed + ' / 10G 消化' + (spin ? '・回転中' : ''));
    [...$("BonusTrack").children].forEach((pip, index) => {
      pip.classList.toggle("is-complete", index < consumed);
      pip.classList.toggle("is-current", running && index === consumed);
    });
    $("BonusMessage").textContent = reward ? "ナインの一打で、勝利をつかんだ。" : mode === "complete" ? '通算優勝 ' + state.championships + '回 · 私たちの野球を、証明した。' : mode === "champion" ? "全試合、完走。ナインとつかんだ優勝を記録しよう。" : mode === "next" ? '次戦：' + flow.TEAMS[state.team + 1].name : spin ? '第' + (consumed + 1) + 'G · リールを止めよう！' : consumed === 0 ? "さあ、勝利の一周へ。" : state.lastWin > 0 ? '+' + state.lastWin.toLocaleString("ja-JP") + ' CREDIT 獲得！' : '第' + consumed + 'G 終了 · 今回の配当なし';
    $("Victory").dataset.paid = String(running && !spin && consumed > 0 && state.lastWin > 0);
  }
  function renderMusic() {
    if (!sound || document.hidden || $("Guide").open) { pauseMusic(); return; }
    const track = state.pending === "surgery" || feature?.kind === "install" ? "surgery-principles" : state.phase === "bonus" || state.phase === "complete" || ["reward", "champion"].includes(state.pending) ? "victory" : "nine-prologue";
    if (track !== musicTrack) { pauseMusic(); musicTrack = track; }
    let player = musicPlayers.get(track);
    if (!player) { player = document.createElement("audio"); player.preload = "none"; player.dataset.stadiumMusic = track; music.after(player); musicPlayers.set(track, player); }
    if (!player.getAttribute("src")) { player.src = `./assets/stadium/audio/${track}.mp3`; player.loop = true; player.volume = .22; }
    if (player.paused) player.play().catch(() => { /* Playback failure must not interrupt the reel game. */ });
  }
  function canAdvanceCommand() { return ["intro", "reward", "next", "champion"].includes(state.pending); }
  function nextReel() { return spin ? spin.stopped.findIndex((n, c) => n === null && !spin.pendingStops.includes(c)) : -1; }
  function pause() { auto = false; nextQueued = false; clearTimeout(controlTimer); controlEpoch++; }
  // One scheduler owns deferred input and AUTO; rerenders replace, never stack, its job.
  function scheduleControls() {
    clearTimeout(controlTimer);
    const epoch = ++controlEpoch, transaction = spin, now = performance.now();
    if (document.hidden || $("Guide").open) return;
    const later = (due, action) => {
      controlTimer = setTimeout(() => { if (epoch === controlEpoch && spin === transaction && !document.hidden && !$("Guide").open) action(); }, Math.max(0, due - now));
    };
    if (feature) {
      if (auto || nextQueued) later(feature.until, () => { dismissFeature(); render(); });
      return;
    }
    if (spin) {
      if (spin.pendingStops.length) later(spin.started + 420, () => commitStop(sessions.takeReadyStop(spin.session, () => true)));
      else if (auto && nextReel() >= 0) later(spin.lastStopAt ? spin.lastStopAt + (turbo ? 200 : 320) : spin.started + (turbo ? 420 : 900), () => stop(nextReel()));
    } else if (!$("Command").hidden) {
      if (auto && canAdvanceCommand()) later(commandSince + (turbo ? 600 : 1200), () => $("Choices").firstElementChild.click());
    } else if (auto || nextQueued) {
      later(settledAt + (nextQueued ? (turbo ? 140 : 300) : (turbo ? 420 : 900)), start);
    }
  }
  function primary() {
    if (!window.MimiCabinetArt.ready) { if (window.MimiCabinetArt.failed) window.MimiCabinetArt.retry(); render(); return; }
    if (document.hidden || $("Guide").open) return;
    if (feature) { dismissFeature(); render(); return; }
    if (!$("Command").hidden) { if (canAdvanceCommand()) $("Choices").firstElementChild.click(); return; }
    if (!spin) {
      if (performance.now() < settledAt + (turbo ? 140 : 300)) { nextQueued = true; render(); }
      else start();
      return;
    }
    const col = nextReel();
    if (col >= 0) stop(col);
    else { nextQueued = true; render(); }
  }
  // Cue only actual stopped symbols on a shared payline; never infer a win from the flag.
  function renderReelCue() {
    $("ReelCue").hidden = true;
    document.querySelectorAll(".stadium-symbol.is-chance").forEach(cell => cell.classList.remove("is-chance"));
    if (!spin || state.phase !== "normal" || state.pending || feature || $("Guide").open) return;
    const symbol = core.SYMBOL_BY_ID.get(spin.flag);
    if (!symbol?.pay || spin.stopped.filter(n => n !== null).length !== 2 || spin.braking.some(Boolean)) return;
    const lines = core.PAYLINES.filter(line => line.cells.every(([col, row]) => spin.stopped[col] === null || core.windowAt(col, spin.stopped[col])[row].id === spin.flag));
    if (!lines.length) return;
    $("ReelCue").hidden = false;
    imageSource($("CueSymbol"), symbolPath + symbol.img);
    $("CueText").textContent = symbol.name + 'を狙え';
    lines.forEach(line => line.cells.forEach(([col, row]) => {
      if (spin.stopped[col] !== null) $("Reels").children[col].children[row].classList.add("is-chance");
    }));
  }
  function renderBattingResult() {
    const active = !$("Cinema").hidden && Boolean(resultDetail);
    $("Cabinet").dataset.battingResult = String(active);
    if (!active) return;
    const symbol = core.SYMBOL_BY_ID.get(resultDetail.symbol);
    $("HitActor").textContent = '背番号' + resultActor.number + ' · ' + resultActor.name;
    $("HitRole").textContent = resultDetail.payout ? (symbol?.name || "図柄") + '成立' : "改造による出塁";
    $("HitRuns").textContent = resultDetail.runs ? '+' + resultDetail.runs + ' 得点' : "走者が出塁！";
    $("HitPayout").textContent = resultDetail.payout ? 'リール配当 +' + resultDetail.payout.toLocaleString("ja-JP") + ' CREDIT' : "リール配当なし";
    $("HitNext").textContent = 'NEXT  #' + flow.PLAYERS[state.batter].number + ' ' + flow.PLAYERS[state.batter].name;
    $("Cinema").dataset.scored = String(resultDetail.runs > 0);
    $("Cinema").dataset.assisted = String(resultDetail.payout === 0);
  }
  function render() {
    const team = flow.TEAMS[state.team], player = resultActor || flow.PLAYERS[state.batter];
    $("Cabinet").dataset.phase = state.phase;
    $("Cabinet").dataset.spinning = String(Boolean(spin));
    $("Cabinet").dataset.surgery = String(state.pending === "surgery");
    $("Cabinet").dataset.charge = String(state.dry);
    $("Cabinet").dataset.augment = state.augment;
    imageSource($("Field"), team.image);
    imageSource($("Batter"), player.image); $("Batter").alt = player.name;
    $("Name").textContent = player.name; $("Position").textContent = `${resultDetail && !resultActor && !resultDetail.replay ? "次の打者 · " : ""}背番号${player.number} · ${player.position}`;
    $("Opponent").textContent = team.name; $("Style").textContent = team.style;
    $("Round").textContent = state.phase === "bonus" ? `WINNING RUN · 残り ${state.bonus} G` : `第${state.team + 1}戦 / 4`;
    $("Runs").textContent = state.runs; $("Target").textContent = team.target; $("Outs").textContent = `${state.outs} OUT`;
    $("Remaining").textContent = state.runs >= team.target ? "目標達成！" : `勝利の10Gまで あと${team.target - state.runs}点`;
    document.querySelectorAll("[data-base]").forEach(node => { const occupied = state.bases[Number(node.dataset.base) - 1]; node.classList.toggle("occupied", occupied); node.setAttribute("aria-label", `${node.textContent}${occupied ? " 走者あり" : " 走者なし"}`); });
    $("Credit").textContent = state.credit.toLocaleString("ja-JP"); $("Win").textContent = state.lastWin.toLocaleString("ja-JP");
    $("Bet").textContent = state.replay || state.phase === "bonus" ? "FREE" : BET;
    $("PrepLabel").textContent = state.augment ? "改造スタンバイ" : state.dry === 3 ? "次の不発で" : "改造のひらめき";
    $("Prep").textContent = state.augment ? (state.augment === "power" ? "次のヒット → HR" : "次の一球 → 出塁") : state.dry === 3 ? "改造チャンス" : `${state.dry} / 4`;
    $("Charge").setAttribute("aria-valuenow", String(state.dry));
    [...$("Charge").children].forEach((lamp, index) => lamp.classList.toggle("is-lit", index < state.dry || Boolean(state.augment)));
    $("Armed").hidden = !state.augment || Boolean(state.pending) || Boolean(resultActor);
    if (state.augment) { imageSource($("ArmedArt"), MODS[state.augment].art); $("ArmedText").textContent = MODS[state.augment].effect; }
    $("Charge").hidden = state.phase === "bonus" || state.phase === "complete";
    if (state.phase === "bonus") {
      $("PrepLabel").textContent = "勝利のウイニングラン";
      $("Prep").textContent = state.bonus ? '残り ' + state.bonus + ' G · BET FREE' : "10 G 完走";
    } else if (state.phase === "complete") { $("PrepLabel").textContent = "全4球団突破"; $("Prep").textContent = "CHAMPIONS"; }
    $("Games").textContent = `${state.games} G`;
    $("Progress").textContent = state.phase === "complete" ? "全4球団突破 · ミミと固定ナインの勝利" : state.phase === "bonus" ? state.bonus ? "10Gの無料ボーナス · 配当は今回のボーナス分を表示" : "10G完走 · 獲得配当を記録しました" : "成立役で出塁・長打。4球団を打ち抜こう。";
    $("Line").textContent = resultText; $("Speaker").textContent = resultHeadline || "ミミ";
    $("Cinema").hidden = !resultActor || !resultHeadline || Boolean(state.pending) || state.phase === "complete" || state.phase === "bonus";
    if (resultActor && resultHeadline) { imageSource($("BattingArt"), resultActor.batting); $("BattingArt").alt = `${resultActor.name}の打撃`; $("Hit").textContent = resultHeadline; }
    [0, 1, 2].forEach(c => {
      paintReel(c);
      const moving = Boolean(spin && spin.stopped[c] === null);
      $("Reels").children[c].classList.toggle("is-spinning", moving);
      const queued = Boolean(spin?.pendingStops.includes(c));
      stops[c].disabled = !window.MimiCabinetArt.ready || !moving || queued || $("Guide").open;
      stops[c].textContent = queued ? `STOP ${c + 1} 予約` : spin?.stopped[c] !== null && spin ? `STOP ${c + 1} ✓` : `STOP ${c + 1}`;
    });
    renderBattingResult();
    renderReelCue();
    renderCommand();
    renderFeature();
    renderVictory();
    const command = !$("Command").hidden;
    const token = command ? `${state.pending}:${state.phase}:${state.team}` : "";
    if (token !== commandToken) { commandToken = token; commandSince = performance.now(); }
    if (command) nextQueued = false;
    if (state.phase === "complete") auto = false;
    $("Spin").disabled = (command && !canAdvanceCommand() && !feature) || $("Guide").open;
    $("Spin").textContent = feature || command ? "PUSH" : nextQueued ? "予約済み" : spin ? (nextReel() < 0 ? "次ゲーム予約" : `STOP ${nextReel() + 1}`) : state.phase === "bonus" || state.replay ? "FREE SPIN" : "SPIN";
    if (!window.MimiCabinetArt.ready) { $("Spin").disabled = !window.MimiCabinetArt.failed; $("Spin").textContent = window.MimiCabinetArt.failed ? "図柄を再読込" : "図柄読込中"; }
    $("Cabinet").dataset.input = spin && nextReel() < 0 || nextQueued ? "queued" : "ready";
    $("Cabinet").dataset.auto = String(auto); $("Cabinet").dataset.turbo = String(turbo);
    $("Auto").setAttribute("aria-pressed", String(auto)); $("Turbo").setAttribute("aria-pressed", String(turbo));
    $("Auto").textContent = auto ? command && !canAdvanceCommand() ? "AUTO 待機" : "AUTO ON" : "AUTO OFF";
    $("Turbo").textContent = turbo ? "TURBO ON" : "TURBO OFF";
    $("Home").setAttribute("aria-disabled", String(Boolean(spin)));
    $("InputHint").textContent = feature ? "PUSH / SPACEで次へ" : nextQueued ? "判定後に1ゲーム開始" : command && !canAdvanceCommand() ? "画面の選択肢を選んでね" : "ボタン / SPACE 連打で進む";
    if(window.MimiCabinetArt.ready){preload(flow.PLAYERS[state.batter].batting);preload(flow.PLAYERS[(state.batter+1)%flow.PLAYERS.length].image);}
    if (spin && !frame) { last = performance.now(); frame = requestAnimationFrame(tick); }
    scheduleControls();
    renderMusic();
    window.MimiCabinetCommands.render();
  }
  function start() {
    if (!window.MimiCabinetArt.ready) return;
    if (spin || feature || !$("Command").hidden || $("Guide").open || document.hidden || state.phase === "complete") return;
    const free = state.replay || state.phase === "bonus";
    if (!free && state.credit < BET) return;
    state.credit -= free ? 0 : BET; state.replay = false; state.lastWin = 0;
    const flag = core.rollFlag(state.phase === "bonus" ? "bonus" : state.team === 3 ? "hot" : "normal");
    nextQueued = false;
    spin = { isFree: free, flag, stopped: [null, null, null], started: performance.now(), braking: [false, false, false], pendingStops: [], lastStopAt: 0 };
    attachSession(spin);
    resultActor = null; resultHeadline = ""; resultDetail = null;
    resultText = ["bar", "seven_blue", "seven_red"].includes(flag) ? "大きいの、狙えるよ！" : ["grape", "watermelon"].includes(flag) ? "いい球！ 打ち抜こう！" : "一球、集中。";
    $("Cabinet").dataset.heat = ["bar", "seven_blue", "seven_red"].includes(flag) ? "strong" : "normal";
    document.querySelectorAll(".stadium-symbol.is-win").forEach(n => n.classList.remove("is-win"));
    if (sound) audio.spinStart(); save(); render();
    window.dispatchEvent(new CustomEvent('mimi:cabinet-input', {detail:{machineId:'stadium',type:'spin-start',transactionId:spin.session.id}}));
  }
  function stop(col) {
    if (!window.MimiCabinetArt.ready || !spin || !Number.isInteger(col) || col < 0 || col > 2 || spin.stopped[col] !== null || spin.pendingStops.includes(col) || $("Guide").open || document.hidden) return;
    if (sessions.queueStop(spin.session, col)) { save(); render(); }
  }
  function commitStop(col) {
    if (!spin || col === null || spin.stopped[col] !== null) return;
    const known = sessions.knownStops(spin.session);
    const decision = core.chooseStop({ col, flag: spin.flag, stopped: known, natural: positions[col] });
    if (!sessions.recordStop(spin.session, col, decision)) return;
    spin.pendingStops = spin.session.pendingStopQueue;
    spin.stopped[col] = decision.index; spin.braking[col] = true; spin.lastStopAt = performance.now(); positions[col] = decision.index;
    if (sound) audio.reelStop(col, decision.slip); save(); render();
    window.dispatchEvent(new CustomEvent('mimi:cabinet-input', {detail:{machineId:'stadium',type:'stop-accepted',transactionId:spin.session.id,reelIndex:col}}));
    const transaction = spin;
    const node = $("Reels").children[col];
    node.animate(reduced.matches ? [] : [{ transform: "translateY(-9px)" }, { transform: "translateY(2px)" }, { transform: "translateY(0)" }], { duration: reduced.matches ? 0 : turbo ? 70 : 180 });
    setTimeout(() => {
      if (spin !== transaction) return;
      spin.braking[col] = false;
      sessions.markSettled(spin.session, col);
      if (spin.stopped.every(n => n !== null) && !spin.braking.some(Boolean)) settle();
      else render();
    }, reduced.matches ? 0 : turbo ? 80 : 200);
  }
  function settle() {
    if (!spin || !sessions.resolve(spin.session)) return;
    const transactionId = spin.session.id;
    const grid = spin.stopped.map((n, c) => core.windowAt(c, n));
    const result = core.evaluateGrid(grid, { bet: BET });
    const paidSymbols = result.litLines.map(line => grid[line.cells[0][0]][line.cells[0][1]].id).filter(id => id !== "replay");
    const symbol = paidSymbols.sort((a, b) => core.SYMBOL_BY_ID.get(b).pay - core.SYMBOL_BY_ID.get(a).pay)[0] || "none";
    const armed = state.augment, previousDry = state.dry, previousRuns = state.runs, previousOuts = state.outs;
    const settled = flow.settle(state, { payout: result.payout, replay: result.replayHit, symbol });
    islandWriter?.record({ paid: spin.isFree === false, payout: result.payout });
    state = settled.state; spin = null; settledAt = performance.now();
    resultActor = settled.hit ? settled.actor : null;
    resultText = settled.line; resultHeadline = settled.headline;
    resultDetail = state.phase === "normal" ? { runs: state.runs - previousRuns, payout: result.payout, symbol, replay: result.replayHit } : null;
    if (state.phase === "normal" && state.augment && !settled.hit && !result.replayHit) {
      resultText = (previousOuts === 2 ? "3アウトで走者をリセット。" : "この打席は不発。") + " 改造は継続、次のヒットがホームラン！";
    }
    if (armed && !state.augment && settled.hit) {
      presentFeature("activate", armed, settled.actor, result.payout);
      if (sound) audio.cue("revive");
    } else if (state.pending === "surgery" && previousDry < 4 && sound) audio.cue("commandOpen");
    else if (state.dry === 3 && previousDry < 3 && sound) audio.cue("notice");
    $("Cabinet").dataset.heat = "normal";
    audio.reelLoop.stop(); if (sound && result.payout) audio.win(result.payout, BET);
    save(); render();
    result.winCells.forEach(key => { const [c, r] = key.split("-").map(Number); $("Reels").children[c].children[r].classList.add("is-win"); });
    if (state.phase === "bonus" && result.payout > 0 && !reduced.matches) {
      $("VictoryWin").getAnimations().forEach(a => a.cancel());
      $("VictoryWin").animate([{ color: "#ffffff", transform: "translateY(-5px)" }, { color: "#ffdb87", transform: "translateY(0)" }], { duration: turbo ? 200 : 500, easing: "ease-out" });
    }
    if (settled.hit && state.phase !== "bonus" && !state.pending) $("Cinema").animate(reduced.matches ? [] : [{ opacity: 0, transform: "translateX(35px)" }, { opacity: 1, transform: "translateX(0)" }], { duration: reduced.matches ? 0 : 400, easing: "ease-out" });
    window.dispatchEvent(new CustomEvent('mimi:cabinet-result', {detail:{machineId:'stadium',type:'revealed',transactionId,payout:result.payout,replay:Boolean(result.replayHit)}}));
    window.dispatchEvent(new CustomEvent("mimi:stadium-settled", { detail: { games: state.games, payout: result.payout } }));
  }
  function tick(now) {
    frame = 0;
    if (!spin) return;
    const dt = Math.min((now - last) / 1000, .1); last = now;
    [0, 1, 2].forEach(c => { if (spin.stopped[c] === null) { positions[c] = core.mod(positions[c] - dt * (turbo ? 34 : 24), core.stripLength(c)); paintReel(c); } });
    frame = requestAnimationFrame(tick);
  }
  window.addEventListener("mimi:cabinet-art", render);
  $("Spin").addEventListener("click", primary);
  $("FeatureContinue").addEventListener("click", primary);
  $("Auto").addEventListener("click", () => { if (auto) pause(); else auto = true; render(); });
  $("Turbo").addEventListener("click", () => { turbo = !turbo; save(); render(); });
  stops.forEach((button, c) => button.addEventListener("click", () => stop(c)));
  $("Home").addEventListener("click", event => { if (spin) event.preventDefault(); else { pause(); save(); pauseMusic(); audio.setEnabled(false); } });
  $("Help").addEventListener("click", () => { pause(); audio.setEnabled(false); $("Guide").showModal(); render(); });
  $("GuideClose").addEventListener("click", () => $("Guide").close());
  $("Guide").addEventListener("close", () => { audio.setEnabled(sound && !document.hidden); render(); });
  $("Sound").addEventListener("click", () => {
    sound = !sound; audio.unlock(); audio.setEnabled(sound);
    $("Sound").setAttribute("aria-pressed", String(sound)); $("Sound").textContent = `SOUND ${sound ? "ON" : "OFF"}`;
    if (sound) audio.cue("commandOpen");
    renderMusic();
  });
  window.addEventListener("keydown", event => {
    if (event.repeat || event.altKey || event.ctrlKey || event.metaKey || $("Guide").open) return;
    if (event.code === "Space" && (event.target === document.body || event.target === $("Spin") || stops.includes(event.target))) { event.preventDefault(); primary(); }
    if (["Digit1", "Digit2", "Digit3"].includes(event.code)) { event.preventDefault(); stop(Number(event.code.slice(-1)) - 1); }
  });
  window.addEventListener("resize", resize);
  document.addEventListener("visibilitychange", () => { if (document.hidden) pause(); audio.setEnabled(sound && !document.hidden); render(); });
  window.addEventListener("pagehide", () => { pause(); save(); pauseMusic(); audio.setEnabled(false); });
  audio.setEnabled(false); resize(); save(); render();
  if (spin?.stopped.every(n => n !== null)) settle();
})();
