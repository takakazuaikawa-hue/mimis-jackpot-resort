/* 街の環境アニメと神眼の大画面演出。結果・残高を一切変更しない表示専用層。 */
(function () {
  "use strict";
  const base = "./machines/dragon-race/assets/spectacle-v1/";
  function create(host, stage) {
    const town = document.createElement("div"); town.className = "dragon-town"; town.setAttribute("aria-hidden", "true");
    town.innerHTML = '<img class="dragon-town-art" alt=""><canvas width="1182" height="304"></canvas><div class="dragon-town-omen"></div>';
    const boss = document.createElement("div"); boss.className = "dragon-boss-cinema"; boss.setAttribute("aria-hidden", "true");
    boss.innerHTML = '<div class="dragon-boss-art"><div class="dragon-boss-damaged"></div></div><canvas width="1182" height="304"></canvas><div class="dragon-boss-eye"></div><svg class="meteor-integrity" viewBox="0 0 200 200"><circle class="integrity-track" cx="100" cy="100" r="90"/><circle class="integrity-value" cx="100" cy="100" r="90" pathLength="75"/></svg><img class="dragon-celestia" src="./dragon-source/images/cast/stand/celestia.webp" alt=""><div class="dragon-boss-strike"><i></i><i></i><i></i></div><div class="dragon-boss-names"><span>生命淘汰の神眼</span><span>絶対の予測が、賭場を呑み込む</span></div>';
    const wardrobe = document.createElement("div"); wardrobe.className = "dragon-costume";
    wardrobe.innerHTML = '<img alt=""><span></span>'; stage.prepend(town, boss, wardrobe);
    const launch = document.createElement("div"); launch.className = "dragon-launch"; launch.hidden = true;
    launch.setAttribute("role", "status"); launch.innerHTML = '<div class="start-lamps" aria-hidden="true"><i></i><i></i><i></i></div><small></small><strong></strong><span></span>';
    const objective = document.createElement("section"); objective.className = "dragon-objective"; objective.hidden = true;
    const backplates=document.createElement('div');backplates.className='hud-backplates';backplates.setAttribute('aria-hidden','true');backplates.innerHTML='<i></i><i></i>';stage.append(backplates);
    // 数字の種類ごとに置き場所と物体を固定。文章の羅列に戻さない。
    objective.innerHTML = `<div class="hud-turns hud-plaque"><span class="turns-label"></span><strong><em></em><small>回</small></strong><div class="turn-tickets" aria-hidden="true">${Array.from({length:10},()=>'<i class="hud-ticket"></i>').join('')}</div></div>
      <div class="hud-bank hud-plaque"><span>BONUS獲得</span><strong><em>0</em><small>枚</small></strong><i class="hud-coins" aria-hidden="true"></i><b class="bank-gain"></b></div>
      <div class="hud-reserve"><div class="hud-cheers"><span>次の継続レースへ</span><div class="cheer-flames" aria-hidden="true"><i class="hud-flame"></i><i class="hud-flame"></i></div><b></b></div><div class="hud-stock"><span>もう一度BONUS</span><div class="stock-tickets">${[0,1].map(()=>'<i class="hud-ticket"><b>+10回</b></i>').join('')}</div><small></small></div></div>
      <div class="hud-challenge"><span></span><div class="challenge-gates" aria-hidden="true">${[0,1,2,3].map(()=>'<i></i>').join('')}</div><strong></strong><b></b></div>`;
    const supporter = document.createElement("div"); supporter.className = "dragon-supporter";
    supporter.innerHTML = '<canvas width="192" height="144" aria-hidden="true"></canvas><span>あなたの竜</span><strong></strong><small>1着でコイン獲得</small>';
    const journey = document.createElement("div"); journey.className = "dragon-map-progress";
    journey.innerHTML = '<span>次の会場へ</span><div></div>';
    const transfers = document.createElement("div"); transfers.className = "dragon-transfers"; transfers.setAttribute("aria-hidden","true");
    host.append(transfers);
    const rewardCue=document.createElement('div');rewardCue.className='dragon-reward-cue';rewardCue.hidden=true;
    rewardCue.setAttribute('role','status');rewardCue.innerHTML='<strong></strong><span></span>';stage.append(rewardCue);
    const operation = document.createElement("div"); operation.className = "dragon-operation";
    stage.append(launch, objective, supporter, journey); host.append(operation);
    const finale = document.createElement("section"); finale.className = "dragon-finale"; finale.hidden = true;
    finale.setAttribute("role", "status"); finale.setAttribute("aria-label", "大レースの決着");
    finale.innerHTML = '<img class="dragon-finale-art" alt="竜たちが光へ突き進む"><div class="dragon-meteor-shell shell-left"></div><div class="dragon-meteor-shell shell-right"></div><canvas width="1210" height="370" aria-hidden="true"></canvas><img class="dragon-finale-mimi" alt="竜帝の戴冠衣のミミ"><div class="dragon-finale-type"><span class="finale-kicker"></span><strong class="finale-title"></strong><b class="finale-amount"></b><span class="finale-prize"></span></div>';
    host.append(finale);
    const images = new Map();
    function image(path) {
      if (!images.has(path)) { const img = new Image(); img.src = path; img.onload = wake; img.onerror = () => { stage.dataset.assetError = path; }; images.set(path,img); }
      return images.get(path);
    }
    for (const id of ["market","wind","clock","avenue","shingan-eye","shingan-meteor-v1","shingan-arena","jackpot-trinity"]) image(base + id + ".png");
    finale.querySelector("img").src = base + "jackpot-trinity.png";
    finale.querySelector(".dragon-finale-mimi").src = "./machines/dragon-race/assets/spectacle-v1/mimi-dragonrobe-stance-v4.png";
    const art = town.querySelector("img"), canvas = town.querySelector("canvas"), ctx = canvas.getContext("2d");
    const fx = finale.querySelector("canvas"), fctx = fx.getContext("2d");
    const bctx = boss.querySelector("canvas").getContext("2d");
    let state = {}, frame = 0, last = 0, clock = 0, timeline, bossRun, townRun, costumeRun, costumeKey = "", previousKey = "", previousCount = -1, finaleStart = 0, exactAmount = "", finalPrize = "", payoutTarget = 0, counterStarted = 0;
    let launchTimer, launchRun, launched = "", lastPhase = "", readableUntil = 0, bossEntryUntil = 0, launchPausedAt = null;
    let hudKey = "", shownTotal = -1, bankRun, transferRun, rewardTimer, rewardCueRun;
    function announce(kicker, title, detail, hold = 2000) {
      clearTimeout(launchTimer); launchRun?.kill(); launch.hidden = false;
      launchPausedAt = null;
      readableUntil = performance.now() + hold + (window.gsap && !state.reduced ? 250 : 0);
      stage.dataset.readingCue = "true";
      launch.querySelector("small").textContent = kicker;
      launch.querySelector("strong").textContent = title;
      launch.querySelector("span").textContent = detail;
      launch.dataset.start = String(title === "スタート！");
      if (window.gsap && !state.reduced) launchRun = gsap.fromTo(launch, { x: -70, opacity: 0, scale: 1.12 }, { x: 0, opacity: 1, scale: 1, duration: .22, ease: "power3.out", onComplete:()=>{readableUntil=Math.max(readableUntil,performance.now()+hold);if(title==='生命淘汰の神眼')bossEntryUntil=readableUntil;} });
      else { launch.style.opacity="1";launch.style.transform="none"; }
      launchTimer = setTimeout(dismissLaunch, hold);
      syncLaunchClock();
    }
    function syncLaunchClock() {
      if (launch.hidden) return;
      const now = performance.now();
      if (!visible() && launchPausedAt === null) {
        // 設定画面や別タブの裏で、STARTの読む時間を消費しない。
        launchPausedAt = now; launchRun?.pause(); clearTimeout(launchTimer);
      } else if (visible() && launchPausedAt !== null) {
        const paused = now - launchPausedAt;
        readableUntil += paused;
        if (bossEntryUntil >= launchPausedAt) bossEntryUntil += paused;
        launchPausedAt = null; launchRun?.resume();
        launchTimer = setTimeout(dismissLaunch, Math.max(0, readableUntil - now) + 10);
      }
    }
    function dismissLaunch() {
      syncLaunchClock();
      if (launchPausedAt !== null) return;
      const remaining = readableUntil - performance.now();
      if (remaining > 0) { launchTimer = setTimeout(dismissLaunch, remaining + 10); return; }
      // 入場待ちの祝福は読まれる前に消さない。回転・決着に入れば通常どおり畳む。
      stage.dataset.readingCue = "false";
      if (!(state.mode === "intro" && ["BONUS START", "継続レース"].includes(launch.querySelector("strong").textContent))) launch.hidden = true;
    }
    function updateObjective() {
      const p = state.progress;
      const bonus = state.phase === "bonus", encounter = state.phase === "boss", trial = state.phase === "trial";
      objective.hidden = !(bonus || encounter || trial);
      backplates.hidden=!(bonus||state.encore);backplates.dataset.encore=String(state.encore);
      objective.dataset.kind = bonus ? "bonus" : state.encore ? "encore" : trial ? "trial" : "boss";
      stage.dataset.bossHit = String(state.boss && state.prior && ['result','quiet'].includes(state.mode) && p.bossHp < state.prior.bossHp);
      boss.querySelector('.integrity-value').style.strokeDasharray=`${p.bossHp} 75`;
      boss.querySelector('.dragon-boss-damaged').style.opacity=p.bossHp<=38?'1':'0';
      if (!objective.hidden) {
        const turns = bonus ? p.bonusLeft : trial ? Math.max(0,3-p.trialGames) : Math.max(0,(state.encore?3:5+p.resolve)-p.bossTurns);
        const max = bonus ? 10 : trial || state.encore ? 3 : Math.min(10,5+p.resolve);
        objective.querySelector('.turns-label').textContent = bonus ? '無料 あと' : '勝負 あと';
        objective.querySelector('.hud-turns em').textContent = turns;
        objective.querySelectorAll('.turn-tickets i').forEach((node,i)=>{ node.hidden=i>=max; node.classList.toggle('is-lit',i<turns); });
        objective.querySelector('.hud-bank').hidden = !(bonus || state.encore);
        objective.querySelector('.hud-reserve').hidden = !(bonus || state.encore);
        objective.querySelector('.hud-cheers').hidden = !bonus;
        objective.querySelector('.hud-cheers b').textContent = `継続ゲート +${p.cheers}`;
        objective.querySelector('.hud-reserve').dataset.cheers=p.cheers||0;
        objective.querySelector('.hud-reserve').dataset.stock=p.stock||0;
        objective.querySelector('.hud-cheers').setAttribute('aria-label',`次の継続レースはゲート${p.cheers||0}個が点灯した状態から開始。ブドウ・スイカ成立で獲得`);
        objective.querySelectorAll('.cheer-flames i').forEach((node,i)=>node.classList.toggle('is-lit',i<p.cheers));
        objective.querySelectorAll('.stock-tickets i').forEach((node,i)=>{node.classList.toggle('is-lit',i<p.stock);node.querySelector('b').textContent=i<p.stock?'+10回':'未獲得';});
        objective.querySelector('.hud-stock small').textContent = p.stock ? '継続勝負に負けても使える' : 'BAR・7を揃えて獲得';
        objective.querySelector('.hud-stock').setAttribute('aria-label',`BONUS継続券 ${p.stock}枚。1枚で無料10回。継続勝負に失敗した時だけ消費`);
        const challenge = objective.querySelector('.hud-challenge'); challenge.hidden=bonus;
        const goal = trial ? 3 : 4, score=trial?p.trialScore:p.continuationScore;
        challenge.dataset.boss=String(encounter&&!state.encore);
        challenge.querySelector('span').textContent = trial ? '3つ点灯で神眼戦' : state.encore ? '4つ点灯でもう一度BONUS' : '隕石を砕け';
        challenge.querySelector('strong').textContent = encounter&&!state.encore ? '隕石を砕けば 無料10回' : `${Math.min(goal,score)} / ${goal}`;
        challenge.querySelector('b').textContent = encounter&&!state.encore ? (stage.dataset.bossHit==='true'?'命中！ 傷は次の勝負にも残る':'図柄が揃えば竜が攻撃') : '当たりで点灯 · 強い役なら2つ';
        challenge.querySelectorAll('i').forEach((node,i)=>{node.hidden=i>=goal;node.classList.toggle('is-lit',i<score);});
        const total = p.bonusTotal || 0, bank=objective.querySelector('.hud-bank em');
        objective.querySelector('.hud-bank').dataset.digits=String(total).length>8?'long':String(total).length>5?'medium':'short';
        if(shownTotal!==total){
          const from=shownTotal<0||shownTotal>total?total:shownTotal; shownTotal=total; bankRun?.kill();
          stage.dataset.bankSettled='false';
          if(window.gsap&&!state.reduced&&total>from){const counter={value:from};bankRun=gsap.to(counter,{value:total,delay:.65,duration:.6,onUpdate:()=>{bank.textContent=Math.floor(counter.value).toLocaleString('ja-JP');},onComplete:()=>{stage.dataset.bankSettled='true';}});}else {bank.textContent=total.toLocaleString('ja-JP');stage.dataset.bankSettled='true';}
        }
        objective.querySelector('.bank-gain').textContent = '';
        objective.setAttribute('aria-label',bonus?`無料回転 あと${turns}回。連続BONUSで獲得 ${total}枚。継続券${p.stock}枚。次の継続勝負は${p.cheers}点から開始`:`勝負はあと${turns}回。${challenge.innerText}`);
      }
      supporter.hidden=bonus||state.tour.town||state.boss||state.observation||state.mode==='intro';
      supporter.querySelector('strong').textContent=state.pick;
      supporter.querySelector('small').textContent=state.encore?'勝つと継続ゲート点灯':'1着でコイン獲得';
      if(state.pickPose){const c=supporter.querySelector('canvas');const ctx=c.getContext('2d');ctx.clearRect(0,0,192,144);ctx.drawImage(state.pickPose,0,0);}
      journey.hidden=!state.tour.town;
      const mapKey=`${p.section}:${p.points}:${state.journeyTarget}`;
      if(journey.dataset.key!==mapKey){journey.dataset.key=mapKey;journey.querySelector('div').innerHTML=Array.from({length:state.journeyTarget||3},(_,i)=>`<i class="${i<p.points?'is-lit':''}"></i>`).join('');}
      const nextKey=`${state.transaction}:${state.mode}`;
      if(nextKey!==hudKey){hudKey=nextKey;if(state.mode==='result')rewardTransfer();else if(!['result','quiet'].includes(state.mode)){clearTimeout(rewardTimer);rewardCueRun?.kill();rewardCue.hidden=true;stage.dataset.rewardFocus='false';}}
      // 最後の停止直前は、走者と回胴が主役。数値は消さず、視覚優先度だけ下げる。
      stage.dataset.raceFocus=String(!bonus&&!state.tour.town&&!state.observation&&((state.mode==='race'&&state.count>=2)||state.mode==='photo'));
      stage.dataset.rewardGrade=state.support==='bonus-minimum'?'guarantee':state.payout>=Math.max(1,state.bet)*5?'large':state.payout>0?'small':'none';
      operation.dataset.auto = String(state.auto);
      operation.textContent = bonus ? `疾走ボタン · 1押しで無料1回／長押しで連続${state.turbo ? " · 高速" : ""}` : state.auto ? `● AUTO ${state.spinning ? "自動停止中" : state.mode === "photo" || state.mode === "result" ? "決着を再生中" : "次の回転へ"}${state.turbo ? " · 高速" : ""}` : `手動 · 右ボタンで${state.spinning ? "STOP" : "SPIN／次へ"}${state.turbo ? " · TURBO ON" : ""}`;
      const phaseKey = `${state.phase}:${state.encore}:${p.chainSets || 0}`;
      if (phaseKey !== lastPhase && visible()) {
        lastPhase = phaseKey;
        if (bonus) announce("BONUS", "BONUS START", `コインを使わず ${p.bonusLeft}回まわせる！`);
        else if (encounter && state.encore) announce("もう一度BONUSへ", "継続レース", '4つのゲートを灯せ！');
        else if (encounter) {
          announce("セレスティア 発動", "生命淘汰の神眼", "絶対の予測が、賭場を呑み込む", 3200);
          bossEntryUntil = readableUntil;
        }
      }
      if (!bonus && !state.tour.town && !state.observation && state.mode === "race" && launched !== String(state.transaction)) {
        launched = String(state.transaction);
        if (!state.boss || performance.now() >= bossEntryUntil) announce(state.boss ? "神眼突破レース" : "", "スタート！", state.boss ? "隕石を砕けばBONUS！" : `${state.pick}が1着ならコイン獲得`);
      }
      if (launchPausedAt === null && ["photo","result"].includes(state.mode) && performance.now() >= readableUntil) { launch.hidden=true; stage.dataset.readingCue="false"; clearTimeout(launchTimer); }
    }
    function rewardTransfer(){
      transferRun?.kill();transfers.replaceChildren();
      const stock=state.prior&&state.progress.stock>state.prior.stock, cheer=state.prior&&state.progress.cheers>state.prior.cheers;
      if(stock||cheer){
        clearTimeout(rewardTimer);rewardCueRun?.kill();rewardCue.hidden=false;stage.dataset.rewardFocus='true';
        rewardCue.querySelector('strong').textContent=stock?'無料10回を確保！':'継続ゲート +1';
        rewardCue.querySelector('span').textContent=stock?'継続勝負に負けても、もう一度BONUS':'次の継続レースは、ゲートが1つ多く点灯';
        if(window.gsap&&!state.reduced)rewardCueRun=gsap.fromTo(rewardCue,{opacity:0,y:15,scale:.94},{opacity:1,y:0,scale:1,duration:.4,ease:'back.out(1.3)'});
        else{rewardCue.style.opacity='1';rewardCue.style.transform='none';}
        rewardTimer=setTimeout(()=>{rewardCue.hidden=true;stage.dataset.rewardFocus='false';},2400);
      }
      if(state.reduced||!window.gsap)return;
      const target=stock?'.hud-stock':cheer?'.hud-cheers':state.phase==='bonus'?'.hud-bank':'.machine-status';
      const dest=host.querySelector(target);if(!dest||dest.hidden||(!state.payout&&!stock&&!cheer))return;
      const h=host.getBoundingClientRect(),d=dest.getBoundingClientRect(),scale=h.width/1280;
      const x=(d.left+d.width/2-h.left)/scale,y=(d.top+d.height/2-h.top)/scale;
      const amount=stock||cheer?1:state.support==='bonus-minimum'?2:state.payout>=Math.max(1,state.bet)*5?9:4;
      const items=Array.from({length:amount},(_,i)=>{const n=document.createElement('i');n.className=stock?'hud-ticket':cheer?'hud-flame':'hud-coins';transfers.append(n);gsap.set(n,{x:620+i*13,y:440-i*8,scale:stock?1.4:1,opacity:0});return n;});
      transferRun=gsap.timeline().to(items,{opacity:1,duration:.12,stagger:.045}).to(items,{x:x-30,y:y-30,scale:.7,duration:.7,stagger:.045,ease:'power2.inOut'},.15).to(items,{opacity:0,duration:.2},.95).fromTo(dest,{filter:'brightness(1.6)'},{filter:'brightness(1)',duration:.45},.85);
    }
    const particles = Array.from({ length: 74 }, (_, i) => ({ x: (i * 167.3) % 1210, y: (i * 83.7) % 430, speed: 35 + i % 7 * 12, size: 3 + i % 5, phase: i * 1.7 }));
    function visible() { return !document.hidden && document.getElementById("loadingScreen")?.getAttribute("aria-busy") !== "true" && stage.closest(".app-view")?.classList.contains("is-active") && !state.modal; }
    function drawTown() {
      if (!state.tour?.town) return;
      ctx.clearRect(0,0,1182,304);
      // 街は名所と環境演出。ミニゲーム由来の低頭身歩行キャラは使用しない。
      const t = clock;
      if (state.reduced) return;
      // 湯気・風・灯り。名所ごとに速度と色を変え、街をレース速度で流さない。
      const market = state.tour?.sight.id === "market", wind = state.tour?.sight.id === "wind";
      for (let i = 0; i < 18; i++) {
        const phase = (t * (market ? .12 : .23) + i / 18) % 1;
        const x = market ? 845 + Math.sin(t + i) * 42 + i % 3 * 35 : (1182 - (t * (wind ? 110 : 26) + i * 97) % 1280);
        const y = market ? 285 - phase * 115 : 70 + i * 11 % 185 + Math.sin(t + i) * 9;
        ctx.fillStyle = market ? `rgba(255,240,213,${Math.sin(phase * Math.PI) * .045})` : "rgba(255,235,184,.30)";
        ctx.beginPath(); ctx.ellipse(x,y,market ? 13 + phase * 22 : wind ? 9 : 2,market ? 10 + phase * 13 : 1.2,wind ? -.15 : 0,0,Math.PI*2); ctx.fill();
      }
    }
    function drawFinale() {
      fctx.clearRect(0,0,1210,370);
      if (!finale.hidden && payoutTarget) {
        // GSAPの遅延補償とは分け、処理落ち後も実時間で正しい最終額に到達する。
        const fraction = state.reduced ? 1 : Math.max(0,Math.min(1,(performance.now()-counterStarted-500)/1800));
        finale.querySelector(".finale-amount").textContent = fraction >= 1 ? exactAmount : Math.floor(payoutTarget*(1-Math.pow(1-fraction,3))).toLocaleString("ja-JP");
        finale.querySelector(".finale-prize").textContent = fraction >= 1 ? finalPrize : "獲得中 · CREDIT";
      }
      if (state.reduced || finale.hidden) return;
      const t = Math.max(0, clock - finaleStart);
      for (const p of particles) {
        const y = (p.y + t * p.speed) % 450 - 60, x = p.x + Math.sin(t * 1.5 + p.phase) * 38;
        fctx.save(); fctx.translate(x,y); fctx.rotate(t * 1.8 + p.phase); fctx.fillStyle = p.size % 2 ? "#ffdf83" : "#fff5c8";
        fctx.globalAlpha = .75; fctx.fillRect(-p.size/2,-p.size,p.size,p.size*2); fctx.restore();
      }
      // 花火は緩やかな一方向の拡散。全面明滅は使わない。
      for (let n = 0; n < 3; n++) {
        const phase = (t * .44 + n / 3) % 1, radius = phase * 155;
        fctx.strokeStyle = `rgba(255,218,128,${(1-phase)*.7})`; fctx.lineWidth = 2;
        for (let i=0;i<24;i++) { const a=i*Math.PI/12; fctx.beginPath(); fctx.moveTo(200+n*400+Math.cos(a)*radius*.7,70+Math.sin(a)*radius*.7); fctx.lineTo(200+n*400+Math.cos(a)*radius,70+Math.sin(a)*radius); fctx.stroke(); }
      }
    }
    function drawBoss() {
      bctx.clearRect(0,0,1182,304);
      if (!state.boss || !["race","photo","result","quiet"].includes(state.mode)) return;
      const t = clock * (state.count >= 2 ? 1.5 : .7);
      for (let i=0;i<(state.reduced ? 0 : 48);i++) {
        const lane=i%3, travel=(t*.4+i/48)%1, x=lane*390+60+i*43%280+Math.sin(t+i)*30;
        const y=310-travel*240, size=1+travel*3;
        bctx.fillStyle = ["#ff984d","#ffe9a1","#8edcff"][lane]; bctx.globalAlpha=Math.sin(travel*Math.PI)*.55;
        bctx.beginPath(); bctx.ellipse(x,y,size,lane===2?size*.5:size*2,-.3,0,Math.PI*2); bctx.fill();
      }
      bctx.globalAlpha=1;
      // 順位・同着は描かず、神眼の圧力へ向かう突撃として既存の翼アニメを使う。
      if (state.count > 0) (state.dragons || []).forEach((poses,i) => {
        if (!poses) return;
        const impact=['result','quiet'].includes(state.mode)&&stage.dataset.bossHit==='true';
        const x = (impact?600:280 + state.count*80) + i*35 + (state.reduced ? 0 : Math.sin(clock*2+i)*14);
        const y = (impact?22:48)+i*27;
        bctx.save();bctx.globalAlpha=.95;bctx.shadowColor=["#ff9c53","#ffdf8d","#91dfff"][i];bctx.shadowBlur=16;
        bctx.drawImage(poses[state.reduced ? 1 : Math.floor(clock*10+i)%4],x,y,160,120);bctx.restore();
        if (!state.reduced) { bctx.strokeStyle=["#ff9c5366","#ffdf8d66","#91dfff66"][i];bctx.lineWidth=3;bctx.beginPath();bctx.moveTo(x-90,y+80);bctx.lineTo(x+70,y+80);bctx.stroke(); }
      });
    }
    function animating() { return state.tour?.town || !finale.hidden || state.boss && ["race","photo"].includes(state.mode); }
    function tick(now) {
      frame = 0;
      if (!visible()) { last = 0; return; }
      const dt = Math.min(.05,last ? (now-last)/1000 : 0); clock += dt; last = now;
      if (state.tour?.town) drawTown();
      if (state.boss) drawBoss();
      if (!finale.hidden) drawFinale();
      if (!state.reduced && animating()) frame = requestAnimationFrame(tick);
    }
    function wake() {
      if (!frame && visible()) { drawTown(); drawBoss(); drawFinale(); if (!state.reduced && animating()) frame = requestAnimationFrame(tick); }
    }
    function update(next) {
      state = next;
      syncLaunchClock();
      updateObjective();
      const surface = state.tour.town ? "town" : state.boss ? "boss" : "race";
      stage.dataset.surface = surface; stage.dataset.omen = String(state.tour.omen);
      host.dataset.spectacleReduced = String(state.reduced);
      if (state.reduced) {
        bossRun?.kill(); townRun?.kill(); timeline?.kill(); costumeRun?.kill();
        if (!finale.hidden) {
          finale.style.opacity = "1"; finale.querySelector(".finale-amount").textContent = exactAmount;
          if (window.gsap) gsap.set([finale.querySelector(".dragon-finale-type"),finale.querySelector(".dragon-finale-art")], { scale: 1, x: 0, y: 0, opacity: 1, filter: "none" });
        }
        boss.querySelector(".dragon-boss-eye").style.opacity = state.mode === "intro" ? "1" : "0";
        stage.dataset.costumeEnter = "false";
      }
      town.hidden = !state.tour.town; boss.hidden = !state.boss;
      const outfitKey = `${state.transaction}:${state.outfit}`;
      if (costumeKey !== outfitKey) {
        costumeKey = outfitKey; costumeRun?.kill();
        const special = ["jungle","dragonrobe"].includes(state.outfit);
        stage.dataset.costumeEnter = String(special && !state.reduced);
        wardrobe.hidden = !special;
        if (special) {
          wardrobe.querySelector("img").src = state.outfit === "dragonrobe" ? "./machines/dragon-race/assets/spectacle-v1/mimi-dragonrobe-stance-v4.png"
            : `./dragon-source/images/cast/mimi/mimi_${state.outfit}_${state.phase === "boss" ? "default" : "smile"}.webp`;
          const name = state.outfit === "jungle" ? "ジャングルバニー" : "竜帝の戴冠衣";
          wardrobe.querySelector("img").alt = name + "のミミ"; wardrobe.querySelector("span").textContent = name;
          if (window.gsap && !state.reduced) costumeRun = gsap.timeline().fromTo(wardrobe, { x: -50, opacity: 0 }, { x: 0, opacity: 1, duration: .32, ease: "power3.out" })
            .to(wardrobe, { opacity: 0, x: -25, duration: .4, delay: 1.1, onComplete: () => { stage.dataset.costumeEnter = "false"; } });
          else wardrobe.style.opacity = "1";
        }
      }
      if (state.reduced) wardrobe.hidden = !["jungle","dragonrobe"].includes(state.outfit) || state.mode !== "intro";
      const key = state.tour.sight.id;
      if (key !== previousKey) { previousKey = key; art.src = base + key + ".png"; art.onload = wake; }
      const beat = `${state.transaction}:${state.count}:${state.mode}`;
      if (beat !== previousCount) {
        previousCount = beat;
        townRun?.kill();
        if (window.gsap && !state.reduced && state.tour.town && state.mode === "race") {
          // 歩行中にカメラをSTOPごとに巻き戻さない。
          gsap.set(art, { x: 0, scale: 1 });
        }
        if (state.boss && window.gsap && !state.reduced) {
          bossRun?.kill();
          const impact = state.mode === "result" && stage.dataset.bossHit === "true";
          bossRun = gsap.timeline().to(boss.querySelector(".dragon-boss-art"), { scale: impact ? 1.05 : 1.02 + state.count*.065, x: -state.count*12, y: state.count*6, duration: state.mode === "photo" ? 1.2 : .7, ease: "power2.out" });
          if (impact) bossRun.fromTo(boss.querySelector(".dragon-celestia"), { x: -8, opacity: .7 }, { x: 0, opacity: 1, duration: .5 }, 0);
        } else if (state.boss) boss.querySelector(".dragon-boss-eye").style.opacity = state.mode === "intro" ? "1" : "0";
      }
      if (!visible() || state.reduced) { cancelAnimationFrame(frame); frame = 0; last = 0; }
      wake();
    }
    function clear() {
      timeline?.kill(); timeline = null; finale.hidden = true; host.dataset.dragonFinale = "";
      finale.querySelector(".finale-amount").textContent = exactAmount;
      finale.querySelector(".finale-prize").textContent = finalPrize;
      if (!state.tour?.town) { cancelAnimationFrame(frame); frame = 0; last = 0; }
    }
    function celebrate({ jackpot, bossWin, payout }) {
      if (!jackpot && !bossWin) return;
      clear();
      finale.hidden = false; finaleStart = clock;
      host.dataset.dragonFinale = jackpot ? "jackpot" : "boss";
      finale.dataset.breach = String(bossWin);
      const title = finale.querySelector(".finale-title"), amount = finale.querySelector(".finale-amount"), prize = finale.querySelector(".finale-prize"), type = finale.querySelector(".dragon-finale-type");
      finale.querySelector(".finale-kicker").textContent = bossWin ? "隕石を突き破れ — 竜たちの大突破！" : "夜明けの翼";
      title.textContent = jackpot ? "JACKPOT" : "神眼突破";
      amount.textContent = jackpot ? `${payout.toLocaleString("ja-JP")}枚` : "無料で10回！";
      exactAmount = amount.textContent;
      prize.textContent = jackpot ? `コイン獲得${bossWin ? " · BONUS 無料10回" : ""}` : `BONUS獲得 · コイン +${payout.toLocaleString("ja-JP")}枚`;
      finalPrize = prize.textContent; payoutTarget = jackpot ? payout : 0; counterStarted = performance.now();
      // 正確な金額を支援技術へ伝え、カウンターの各フレームは読み上げない。
      finale.setAttribute("aria-label", `${title.textContent} ${amount.textContent} ${prize.textContent}`);
      type.setAttribute("aria-hidden", "true");
      if (window.gsap && !state.reduced) {
        timeline = gsap.timeline()
          .fromTo(finale, { opacity: 0 }, { opacity: 1, duration: .16 })
          .fromTo(finale.querySelector("img"), { scale: 1.32, filter: "brightness(1.6)" }, { scale: 1, filter: "brightness(1)", duration: 1.4, ease: "power3.out" }, 0)
          .fromTo(type, { scale: 1.65, y: 30, opacity: 0 }, { scale: 1, y: 0, opacity: 1, duration: .65, ease: "back.out(1.5)" }, .18);
        if (bossWin) {
          timeline.fromTo(finale.querySelector(".shell-left"), { x: 0, opacity: 1 }, { x: -900, opacity: 0, duration: 1.05, ease: "power3.in" }, 0)
            .fromTo(finale.querySelector(".shell-right"), { x: 0, opacity: 1 }, { x: 900, opacity: 0, duration: 1.05, ease: "power3.in" }, 0)
            .fromTo(finale.querySelector(".dragon-finale-art"), { scale: .8 }, { scale: 1.1, duration: 1.4, ease: "power2.out" }, 0);
        }
      } else { finale.style.opacity = "1"; type.style.opacity = "1"; type.style.transform = "none"; }
      wake();
    }
    document.addEventListener("visibilitychange", () => { syncLaunchClock(); if (document.hidden) { cancelAnimationFrame(frame); frame = 0; last = 0; } else wake(); });
    const loading = document.getElementById("loadingScreen");
    if (loading) new MutationObserver(() => { if (state.progress && visible()) { updateObjective(); wake(); } }).observe(loading, { attributes: true, attributeFilter: ["aria-busy"] });
    return { update, celebrate, clear, readRemaining: () => { syncLaunchClock(); return Math.max(0,readableUntil-(launchPausedAt ?? performance.now())); } };
  }
  window.MimiDragonSpectacle = Object.freeze({ create });
}());
