/* Controls follow the existing Stadium cabinet; SlotCore and SpinSession own reels. */
(() => {
  'use strict';
  const flow = window.ArenaFlow, core = window.SlotCore, audio = window.MimiAudio, sessions = window.MimiSpinSession;
  const KEY = 'mimi.arena.slot.v1', BET = 30, $ = id => document.getElementById('arena' + id);
  const stops = [...document.querySelectorAll('[data-arena-stop]')];
  const positions = [0,7,14], symbolPath = './assets/generated/v3/symbols/dist/';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  audio.setMusicVolume(0.15);
  let castChoice = -1;
  let trialMotionFailed=false;
  function syncTrialMotion(){
    const video=$('TrialMotion'),enabled=state.phase==='trial'&&!state.pending&&!reduced.matches&&!trialMotionFailed;
    if(!video.getAttribute('src'))return;
    video.hidden=!enabled||video.readyState<2;
    if(enabled&&!state.pending&&!document.hidden&&!modalOpen()){
      if(video.paused)video.play().catch(()=>{video.hidden=true;});
    }else{
      video.pause();
      if(state.phase!=='trial'&&video.readyState&&video.currentTime!==0)video.currentTime=0;
    }
  }
  function modalOpen(){return $('Guide').open||$('CastPicker').open;}
  function audioEnabled(value){
    const wasEnabled=audio.enabled;
    if(!value)audio.stopEffects();audio.setEnabled(value);
    if(value&&!wasEnabled&&spin){audio.reelLoop.start();spin.stopped.forEach((position,col)=>{if(position!==null)audio.reelLoop.stopOne(col);});}
  }
  function syncAudio(){
    const active=sound&&!document.hidden&&!modalOpen();
    if(audio.enabled!==active)audioEnabled(active);
    if(!active)return;
    const mood=state.phase==='normal'?'arenaExplore':state.phase==='trial'?'arenaTrial':state.phase==='bonus'&&!state.pending?'arenaTokimeki':state.phase==='battle'&&!['reward','defeat'].includes(state.pending)?'arenaBoss':'silent';
    audio.setMood(mood);
  }
  function currentPerformer(){return flow.CAST[castChoice<0?state.games%flow.CAST.length:castChoice];}
  const cinematicArt = {liberation:'./assets/arena/blackstar-release-v1.png',guard:'./assets/arena/teirei-barrier-v1.png'};
  const blackstarShots=['./assets/arena/blackstar-gather-v2.png',cinematicArt.liberation,'./assets/arena/amara-blackstar-impact-v2.png'];
  const trialOutcomeArt={trialWin:'./assets/arena/trial-open-v1.png',trialFail:'./assets/arena/trial-recover-v1.png'};
  const bossScenes=[
    {art:{challenge:'./assets/arena/amara-challenge-v1.png',counter:'./assets/arena/amara-counter-v1.png',concedes:'./assets/arena/amara-concedes-v2.png'},alt:{challenge:'裁定の間で天秤を掲げ、挑戦を待つアマラ',counter:'黄金の天秤から反撃を放つアマラ',concedes:'天秤を下ろし、仲間の勝利を認めるアマラ'},concession:'……あなたたちの一手、確かに見届けたわ。さあ、胸を張って進みなさい。'},
    {art:{challenge:'./assets/arena/shahar-challenge-v1.png',counter:'./assets/arena/shahar-counter-v1.png',concedes:'./assets/arena/shahar-concedes-v1.png'},alt:{challenge:'雲上の闘技場で挑戦者を見定める古竜シャハル',counter:'結晶を乗せた息吹を放つシャハル',concedes:'息吹を収め、仲間へ敬意を示すシャハル'},concession:'小さき者たちよ。その一歩、確かに我へ届いた。誇りを持って、先へ進め。'},
    {art:{challenge:'./assets/arena/mumyo-challenge-v1.png',counter:'./assets/arena/mumyo-counter-v1.png',concedes:'./assets/arena/mumyo-concedes-v1.png'},alt:{challenge:'月下の広間で鏡に姿を映し、静かに待つ無銘の剣',counter:'鞘から抜かずに一閃を放つ無銘',concedes:'剣を休め、鏡の中から仲間の勝利を認める無銘'},concession:'……見事だ。その一手は、覚えておく。仲間と共に、勝利を受け取れ。'}
  ];
  const bossCounters=[
    {move:'天秤の反撃',lines:['その一手の重さ、量らせてもらうわ。','天秤は、まだ傾いていないわ。','次は、どんな一手を見せてくれる？']},
    {move:'結晶の息吹',lines:['小さき者よ、風を見極めよ。','まだ踏みとどまるか。その意気はよい。','雲の先へ進むなら、顔を上げよ。']},
    {move:'抜かない斬撃',lines:['……足を止めるな。','……次の一手で、応えろ。','……まだ、剣はここにある。']}
  ];
  function counterDialogue(){
    const line=bossCounters[state.round].lines[(state.games+state.round)%3];
    const status=state.pending==='orders'?'ミミの指示を選ぼう。':state.hp<=2?`残りHP ${state.hp}。一手ずつ、立て直そう。`:state.dry===3?'次も配当なしなら、ミミの指示へ。':`ときめき ${state.dry}/4。`;
    return `${line} HP −1。${status}`;
  }
  const tokimekiScenes={rinne:{name:'リンネ',image:'./assets/arena/tokimeki-rinne-v1.png',lines:['今だけは、君とゆっくり話したい。','その笑顔、もう少し近くで見てもいい？','言葉にしなくても、ここにいてくれたら嬉しい。','この時間は、大切な思い出になる。']},cassim:{name:'カシム・ベル',image:'./assets/arena/tokimeki-cassim-v1.png',lines:['こちらへ。君に見せたい景色がある。','……君となら、沈黙も悪くない。','この扉の先も、一緒に歩いてくれるか。','今夜のことは、忘れずに持っておこう。']}};
  function tokimekiScene(){return tokimekiScenes[castChoice===5?'cassim':castChoice===11?'rinne':state.round===1?'cassim':'rinne'];}
  function bonusFarewell(){return tokimekiScene().name==='リンネ'?'この時間は、忘れない。次の一歩も、見届けさせて。':'束の間でしたが、ご一緒できて光栄です。次の扉まで、お送りしましょう。';}
  function playRewardTransition(){
    animateScene($('Celebration'),[{transform:'scale(1.018)'},{transform:'scale(1)'}],1400);
    animateScene($('Reward'),[{opacity:.4,transform:'translateY(9px)'},{opacity:1,transform:'translateY(0)'}],550);
  }
  function cinematicLastStep(){return feature?.trialOutcome?2:3;}
  function cinematicDuration(step){return reduced.matches?(step===cinematicLastStep()?1200:0):(feature?.trialOutcome?[450,950,1800][step]:[650,750,850,1800][step])*(feature?.speed||1);}
  function cinematicStep(step){
    audio.stopEffects();clearSceneMotion();feature.step=step;feature.until=performance.now()+cinematicDuration(step);render();
    if(sound&&!document.hidden&&!modalOpen()){
      if(feature.trialOutcome){if(step===1)audio.cue(feature.trialOutcome==='trialWin'?'commandReady':'notice');}
      else{if(step===0)audio.cue('commandReady');if(step===2)audio.cue('bossHit');if(step===3&&state.enemy===0)audio.cue('bossDefeat');}
    }
    if(step<cinematicLastStep())animateScene($('CinemaArt'),[{transform:feature.trialOutcome?'scale(1.025)':step===2?'scale(1.07) translateX(-14px)':'scale(1.025)'},{transform:'scale(1) translateX(0)'}],feature.trialOutcome?1100:step===2?500:1000);
  }
  function freezeScene(){if(feature&&!Number.isFinite(feature.remaining))feature.remaining=Math.max(0,feature.until-performance.now());sceneAnimations.forEach(a=>{if(a.playState==='running')a.pause();});}
  function resumeScene(){if(document.hidden||modalOpen())return;if(feature&&Number.isFinite(feature.remaining)){feature.until=performance.now()+feature.remaining;delete feature.remaining;}sceneAnimations.forEach(a=>{if(a.playState==='paused')a.play();});}
  let sceneAnimations = [];
  function clearSceneMotion() { sceneAnimations.forEach(a=>a.cancel()); sceneAnimations=[]; }
  function animateScene(node,frames,duration,delay=0) { if(!reduced.matches) sceneAnimations.push(node.animate(frames,{duration:turbo?duration*.7:duration,delay:turbo?delay*.7:delay,easing:'cubic-bezier(.16,.8,.24,1)',fill:'backwards'})); }
  function playCastTrace(actor){
    const motions={droplet:['translateX(-95px) scale(.2)','translateX(140px) scale(1.6)',680],slash:['translate(-65px,55px) rotate(-24deg) scaleX(.1)','translate(160px,-40px) rotate(-24deg) scaleX(1.3)',340],scan:['translateY(-75px) scaleX(.2)','translateY(50px) scaleX(1.4)',540],dusk:['translateX(-80px) scale(.5)','translateX(150px) scale(1.8)',900],tap:['scale(.1)','scale(1.8)',410],key:['rotate(-70deg) scale(.3)','rotate(25deg) scale(1.3)',620],tide:['translate(-85px,35px) scaleY(.2)','translate(150px,-5px) scaleY(1.3)',820],prayer:['translateY(65px) scale(.4)','translateY(-45px) scale(1.5)',780],shadow:['translateX(145px) scaleX(.2)','translateX(-60px) scaleX(1.2)',320],claw:['translate(-70px,-55px) rotate(-35deg)','translate(120px,55px) rotate(-35deg)',370],door:['perspective(400px) rotateY(85deg) scale(.6)','perspective(400px) rotateY(0) scale(1.4)',740],coin:['translateX(-90px) rotateY(0) scale(.3)','translateX(140px) rotateY(540deg) scale(.8)',560]};
    const [from,to,duration]=motions[actor.effect];
    animateScene($('CastTrace'),[{opacity:0,transform:from},{opacity:.85,offset:.25},{opacity:0,transform:to}],duration);
    animateScene(actor.battleArt?$('AllyScene'):$('Ally'),[{transform:'translateX(0)'},{transform:`translateX(${['slash','claw','shadow'].includes(actor.effect)?22:6}px)`,offset:.35},{transform:'translateX(0)'}],duration);
  }
  function playResultScene() {
    clearSceneMotion();
    if(feature?.cinematic) {
      cinematicStep(reduced.matches?cinematicLastStep():0);
    } else if(['normal','trial'].includes(state.phase)) {
      animateScene($('JourneyArt'),[{transform:'scale(1.015)'},{transform:'scale(1)'}],state.pending==='trialWin'?1300:800);
      animateScene($('JourneyValue'),[{opacity:.45,transform:'translateY(7px)'},{opacity:1,transform:'translateY(0)'}],380);
    } else if(feature) {
      animateScene($('CutinArt'),[{opacity:0,transform:'translateX(-45px) scale(1.06)'},{opacity:1,transform:'translateX(0) scale(1)'}],700);
      animateScene($('CutinTitle'),[{opacity:0,transform:'translateX(38px)'},{opacity:1,transform:'translateX(0)'}],420,180);
      animateScene($('CutinText'),[{opacity:0,transform:'translateY(12px)'},{opacity:1,transform:'translateY(0)'}],350,380);
    } else if(state.pending==='reward') {
      animateScene(bossScenes[state.round]?$('BossScene'):$('Celebration'),[{opacity:.7,transform:'scale(1.025)'},{opacity:1,transform:'scale(1)'}],1100);
      animateScene($('Reward'),[{opacity:0,transform:'translateY(24px)'},{opacity:1,transform:'translateY(0)'}],600,180);
    } else if(state.phase==='bonus'&&state.pending) {
      playRewardTransition();
    } else if(state.phase==='battle'&&bossScenes[state.round]&&result?.kind==='miss') {
      const counterFrames=state.round===2?[{transform:'translateX(8px)'},{transform:'translateX(-3px)',offset:.2},{transform:'translateX(0)'}]:state.round===1?[{transform:'scale(1.03) translateX(10px)'},{transform:'scale(1) translateX(0)'}]:[{transform:'scale(1.018) translateX(5px)'},{transform:'scale(1) translateX(0)'}];
      animateScene($('BossScene'),counterFrames,state.round===2?280:state.round===1?650:480);
      const urgent=state.hp<=2||state.pending==='orders';
      animateScene($('Life').parentElement,urgent?[{transform:'translateX(0)'},{transform:'translateX(-6px)',offset:.3},{transform:'translateX(0)'}]:[{opacity:.65},{opacity:1}],300);
    } else if(result?.damage) {
      animateScene($('Impact'),[{opacity:0,transform:'scale(1.25)'},{opacity:1,transform:'scale(1)'}],420);
      if(result.kind==='hit')playCastTrace(result.performer);
      animateScene(bossScenes[state.round]?$('BossScene'):$('Boss'),[{transform:'translateX(0)'},{transform:'translateX(7px)',offset:.35},{transform:'translateX(0)'}],420);
    }
  }
  let state = flow.create(), spin = null, sound = false, auto = false, turbo = false, nextQueued = false;
  let frame = 0, last = 0, controlTimer = 0, controlEpoch = 0, settledAt = 0, commandToken = '', commandSince = 0;
  let feature = null, result = null, resultText = 'さあ、私たちの出番だよ！', resultHeadline = 'ミミ';
  function attachSession(t) {
    t.session = sessions.create({phase:state.phase,stage:state.round,bet:BET,flag:t.flag});
    t.stopped.forEach((index,col) => { if(index !== null) { sessions.recordStop(t.session,col,{index}); sessions.markSettled(t.session,col); } });
    t.pendingStops.forEach(col => sessions.queueStop(t.session,col)); t.pendingStops = t.session.pendingStopQueue;
  }
  try {
    const saved = JSON.parse(localStorage.getItem(KEY));
    const restored=flow.migrate(saved?.state);
    if (restored) {
      state = restored; turbo = saved.settings?.turbo === true;
      if(Number.isInteger(saved.settings?.castChoice)&&saved.settings.castChoice>=-1&&saved.settings.castChoice<flow.CAST.length)castChoice=saved.settings.castChoice;
      if (saved.spin && !state.pending && state.phase !== 'complete' && ['none',...core.SYMBOLS.map(s=>s.id)].includes(saved.spin.flag)
        && Array.isArray(saved.spin.stopped) && saved.spin.stopped.length === 3
        && saved.spin.stopped.every((n,c)=>n === null || Number.isInteger(n) && n >= 0 && n < core.stripLength(c))) {
        spin = {isFree:saved.spin.isFree !== false,flag:saved.spin.flag,stopped:saved.spin.stopped,started:performance.now(),braking:[false,false,false],pendingStops:[],lastStopAt:0};
        spin.pendingStops = [...new Set(Array.isArray(saved.spin.pendingStops) ? saved.spin.pendingStops : [])].filter(c=>Number.isInteger(c) && c>=0 && c<3 && spin.stopped[c]===null);
        attachSession(spin); spin.stopped.forEach((n,c)=>{if(n!==null) positions[c]=n;}); resultText = '続きの対決だよ。残りのリールを止めよう！';
      }
    }
  } catch { /* Fresh isolated save if malformed or unavailable. */ }
  if(!spin) {
    if(state.phase==='complete') resultText='みんなでつかんだ、大勝利！ また一緒に挑もうね。';
    else if(state.phase==='normal') resultText=`ミナトと、扉の先へ。探索は${state.explore}/6まで進んでいるよ。`;
    else if(state.phase==='trial') resultText=`想いをつないで。${state.trialScore}/${flow.trialTarget(state)}ポイント、残り${state.trialLeft}G。`;
    else if(state.pending==='reward') resultText='裏ボス突破！ 仲間とつかんだ10Gの祝宴だよ。';
    else if(state.phase==='bonus') resultText=state.bonus?`勝利の祝宴、残り${state.bonus}G。`:'祝宴完走！ 仲間と、次の一歩へ。';
    else if(state.pending==='defeat') resultText='まだ、終わりじゃない。力を合わせて立て直そう。';
    else if(state.order) resultText=`${state.order==='strike'?'黒星':'隔壁'}は準備できているよ。次の非REPLAYで発動！`;
  }
  let islandWriter = null;
  try { islandWriter = window.MimiResortRewards.createWriter('arena'); } catch (_) { /* Preserve unreadable source data. */ }
  function save() {
    try { if(!islandWriter)throw new Error('保存停止・元データを保護中'); islandWriter.save({state,settings:{turbo,castChoice},spin:spin ? {isFree:spin.isFree,flag:spin.flag,stopped:spin.stopped,pendingStops:spin.pendingStops} : null}); $('Save').textContent='台専用・自動保存'; }
    catch (error) { $('Save').textContent=error.message || '保存できません・この画面で継続可'; }
  }
  function resize() { $('Cabinet').style.transform=`translate(-50%, -50%) scale(${Math.min(innerWidth/1280,innerHeight/720)})`; }
  function imageSource(node,src) { if(node.getAttribute('src')!==src) node.src=src; }
  function paintReel(col) { core.windowAt(col,Math.floor(positions[col])).forEach((symbol,row)=>{ const cell=$('Reels').children[col].children[row]; imageSource(cell.firstElementChild,symbolPath+symbol.img); cell.firstElementChild.alt=symbol.name; }); }
  $('Reels').innerHTML=[0,1,2].map(c=>`<div class="arena-reel" aria-label="リール${c+1}">${[0,1,2].map(()=>'<div class="arena-symbol"><img alt=""></div>').join('')}</div>`).join('');
  $('BonusLamps').innerHTML=Array.from({length:10},()=>'<i></i>').join('');
  function chooseCast(index){castChoice=index;save();$('CastPicker').close();render();}
  flow.CAST.forEach((actor,index)=>{const button=document.createElement('button');button.type='button';button.setAttribute('aria-label',actor.name+'を選ぶ');const img=document.createElement('img');img.src=actor.battleArt||actor.image;img.className=actor.battleArt?'is-authored':'';img.alt='';const name=document.createElement('strong');name.textContent=actor.name;const role=document.createElement('small');role.textContent=actor.technique+' / '+actor.role;button.append(img,name,role);button.addEventListener('click',()=>chooseCast(index));$('CastGrid').append(button);});
  $('CastRotate').addEventListener('click',()=>chooseCast(-1));
  $('CastOpen').addEventListener('click',()=>{if(spin||feature)return;pause();freezeScene();audioEnabled(false);$('CastPicker').showModal();render();});
  $('CastClose').addEventListener('click',()=>$('CastPicker').close());
  $('CastPicker').addEventListener('close',()=>{resumeScene();audioEnabled(sound&&!document.hidden&&!modalOpen());render();});
  [...flow.CAST.filter(a=>a.battleArt).map(a=>a.battleArt),...flow.ALLIES.map(a=>a.image),...Object.values(cinematicArt),...Object.values(trialOutcomeArt),...bossScenes.flatMap(s=>Object.values(s.art)),...blackstarShots,...Object.values(tokimekiScenes).map(s=>s.image),...flow.BOSSES.map(b=>b.image),...core.SYMBOLS.map(s=>symbolPath+s.img)].forEach(src=>{const img=new Image();img.src=src;});
  function advance(action) {
    audio.stopEffects();clearSceneMotion();
    const before=state; state=flow.advance(state,action); result=null; feature=null; nextQueued=false;
    if (action==='strike'||action==='guard') resultText=action==='strike' ? '黒星、準備完了！ 次の非REPLAYで4ダメージを追加するよ。' : '隔壁、準備完了！ 次の非REPLAYで回復して反撃だよ。';
    else if(before.pending==='defeat') resultText=`不屈Lv.${state.resolve}。次の一撃を強くしよう！`;
    else resultText='仲間と一緒に、進もう。';
    if(sound)audio.cue(action==='champion'?'crownComplete':action==='reward'?'bonus':['strike','guard'].includes(action)?'commandReady':'commandAdvance');
    resultHeadline='ミミ';if(action==='reward'){resultHeadline=tokimekiScene().name;resultText=tokimekiScene().lines[0];}
    if(action==='trial'){resultHeadline='ミナト';resultText='結晶の光を集める。三つの停止で、想いをつないで。';}
    if(action==='explore')resultText='あの扉まで、ミナトと一緒に進もう。';
    save(); render();
    if(action==='reward'||action==='champion')playRewardTransition();
  }
  function showCommand(label,title,text,choices) {
    $('Command').hidden=false; $('CommandLabel').textContent=label; $('CommandTitle').textContent=title; $('CommandText').textContent=text;
    $('Choices').replaceChildren();
    choices.forEach(([label,action,detail])=>{const button=document.createElement('button');button.type='button';button.textContent=label;
      if(detail){const small=document.createElement('small');small.textContent=detail;button.append(small);}
      button.addEventListener('click',()=>{if(button.isConnected) advance(action);});$('Choices').append(button);
    });
  }
  function renderCommand() {
    $('Command').hidden=true; if(spin||feature)return;
    const b=flow.BOSSES[state.round];
    if(state.pending==='explore') showCommand(`第${state.round+1}章 / NORMAL`,'仲間と、試練の扉へ。','探索6ポイントで試練へ。配当なし・REPLAYは1、通常配当は2、BAR・7配当は3ポイント。',[['探索を始める','explore']]);
    else if(state.pending==='trial') showCommand('TRIAL / 3G','扉に、想いを届けよう。',`3G以内に${flow.trialTarget(state)}ポイント。配当成立で2、REPLAYで1。通常BET・通常抽選です。`,[['試練に挑む','trial']]);
    else if(state.pending==='trialWin') showCommand('TRIAL CLEAR','その先に、裏ボスが待つ。',`${state.trialScore}ポイントで突破！ チームHPを保って対決へ。`,[['ボスのもとへ','trialWin']]);
    else if(state.pending==='trialFail') showCommand('TRIAL / 再探索','今の一歩を、次の力に。',`HPは減りません。探索0から再開し、次の試練は${Math.max(1,flow.trialTarget(state)-1)}ポイントで突破。`,[['仲間と再探索','trialFail']]);
    else if(state.pending==='intro') showCommand(`第${state.round+1}戦 / 3`,b.name+'が あらわれた！',b.line,[['対決を始める','intro']]);
    else if(state.pending==='orders') showCommand('ミミの監督指示','この一手で、切り返そう。','指示は次の非REPLAYで発動。リール配当は変わりません。',[
      ['ギドノの黒星','strike','4ダメージ追加 · 不発でも反撃'],['丁零の隔壁','guard','HPを2回復 · 最低1ダメージ']]);
    else if(state.pending==='defeat') showCommand('再挑戦','まだ、終わらせない。',`双方のHPを回復。不屈Lv.${Math.min(3,state.resolve+1)}で、配当成立時の攻撃を強化。`,[['もう一度挑む','defeat']]);
    else if(state.pending==='reward') showCommand('対決突破',b.name+'に勝利！','仲間と祝おう。10Gの無料ボーナス！',[['BONUSへ','reward']]);
    else if(state.pending==='next') showCommand('NEXT CHAPTER',flow.BOSSES[state.round+1].name+'が待つ扉へ。','仲間との探索から、次の試練に進みます。',[['次の章へ','next']]);
    else if(state.pending==='champion') showCommand('ALL BATTLES CLEAR','約束の、その先へ。','3体の裏ボスと最後の10Gを突破。仲間との勝利を記録しよう。',[['制覇を記録','champion']]);
    else if(state.phase==='complete') showCommand('WITH YOUR COMPANIONS','また、この仲間と。',`CREDIT ${state.credit.toLocaleString('en-US')} と制覇記録を残して、第1章から再挑戦できます。`,[['もう一度挑む','restart']]);
    else if(state.credit<BET&&!state.replay&&state.phase!=='bonus') showCommand('リゾートサービス','続きを楽しもう。','300 CREDITを受け取って再開できます。',[['300 CREDITを受け取る','refill']]);
  }
  function render() {
    const b=flow.BOSSES[state.round], ally=feature?flow.ALLIES[feature.actor]:result?.performer||currentPerformer();
    $('CastOpen').disabled=!!spin||!!feature;
    $('CastName').textContent=`${ally.name} / ${ally.technique||ally.move}`;
    $('CastName').hidden=!!feature||!!state.pending||state.phase!=='battle';
    [...$('CastGrid').children].forEach((button,index)=>button.setAttribute('aria-pressed',String(castChoice===index)));
    $('CastRotate').setAttribute('aria-pressed',String(castChoice===-1));
    $('Cabinet').dataset.phase=state.phase; $('Cabinet').dataset.round=state.round; $('Cabinet').dataset.result=result?.kind||''; $('Cabinet').dataset.pending=state.pending;
    const directedBoss=state.phase==='battle'&&bossScenes[state.round];
    const bossScene=directedBoss?(state.pending==='reward'?'concedes':state.pending==='defeat'||result?.kind==='miss'?'counter':'challenge'):'';
    $('Cabinet').dataset.bossScene=bossScene;
    $('BossScene').hidden=!directedBoss;
    if(directedBoss){imageSource($('BossScene'),directedBoss.art[bossScene]);$('BossScene').alt=directedBoss.alt[bossScene];}
    const allyScene=state.phase==='battle'&&!state.pending&&!feature&&!!ally.battleArt;
    $('Cabinet').dataset.allyScene=String(allyScene);$('AllyScene').hidden=!allyScene;
    if(allyScene){imageSource($('AllyScene'),ally.battleArt);$('AllyScene').alt=ally.name+' / '+ally.role;}
    const castTrace=state.phase==='battle'&&!state.pending&&!feature&&result?.kind==='hit';
    $('CastTrace').hidden=!castTrace;
    if(castTrace){$('CastTrace').dataset.effect=ally.effect;$('CastTrace').style.setProperty('--cast-tint',ally.tint);}
    const anticipating=!!spin&&state.phase==='battle'&&(!!state.order||['bar','seven_blue','seven_red'].includes(spin.flag));
    $('Anticipation').hidden=!anticipating;
    if(anticipating){const remaining=spin.stopped.filter(n=>n===null).length;$('Anticipation').textContent=state.order ? `${state.order==='strike'?'黒星':'隔壁'} スタンバイ · ${remaining===1?'最後のリールを止めて！':'仲間に、想いをつなげ。'}` : remaining===1?'最後の一停止。仲間を信じて！':'大きな力が、近づいている。';}
    $('HP').textContent=`${state.hp} / 6`; $('Life').value=state.hp; $('Life').textContent=`${state.hp}/6`; $('Life').setAttribute('aria-label',`チームHP ${state.hp} / 6`); $('Resolve').textContent=state.resolve ? `不屈Lv.${state.resolve} · 配当成立時 +${state.resolve}ダメージ` : '12人の仲間 · 上の「仲間」から選択';
    $('BossTitle').textContent=b.title; $('BossName').textContent=b.name; $('EnemyLife').max=b.hp; $('EnemyLife').value=state.enemy; $('EnemyLife').setAttribute('aria-label',`${b.name} HP ${state.enemy} / ${b.hp}`); $('EnemyHP').textContent=`HP ${state.enemy} / ${b.hp}`;
    $('Round').textContent=`第${state.round+1}章 / ${state.phase==='normal'?'NORMAL':state.phase==='trial'?'TRIAL':state.phase==='battle'?'BOSS':'BONUS'}`; imageSource($('Boss'),b.image);$('Boss').alt=b.name;imageSource($('Ally'),ally.image);$('Ally').alt=ally.name;
    $('Credit').textContent=state.credit.toLocaleString('ja-JP');$('Bet').textContent=state.replay||state.phase==='bonus'?'FREE':BET;$('Win').textContent=state.lastWin;
    $('Prep').textContent=state.phase==='bonus'?`無料BONUS 残り${state.bonus}G`:state.order ? (state.order==='strike'?'黒星 スタンバイ':'隔壁 スタンバイ'):`ときめき ${state.dry} / 4`;
    const chargeTarget=state.phase==='normal'?6:state.phase==='trial'?flow.trialTarget(state):4;
    if($('Charge').children.length!==chargeTarget)$('Charge').replaceChildren(...Array.from({length:chargeTarget},()=>document.createElement('i')));
    $('Charge').setAttribute('role','meter');$('Charge').setAttribute('aria-valuemin','0');$('Charge').setAttribute('aria-valuemax',String(chargeTarget));
    $('Charge').setAttribute('aria-label',state.phase==='normal'?'探索ポイント':state.phase==='trial'?'試練ポイント':'仲間の指示までの連続不発');
    const chargeValue=state.phase==='normal'?state.explore:state.phase==='trial'?state.trialScore:state.order?4:state.dry;
    $('Charge').setAttribute('aria-valuenow',String(Math.min(chargeTarget,chargeValue)));$('Charge').hidden=['bonus','complete'].includes(state.phase);
    [...$('Charge').children].forEach((n,i)=>n.classList.toggle('is-lit',i<chargeValue));
    $('Games').textContent=state.games+' G';$('Progress').textContent=state.phase==='complete'?'全3戦突破 · 仲間とつかんだ勝利':'成立役で仲間が攻撃。各対決の勝利で無料10G。';
    const journey=['normal','trial'].includes(state.phase);
    $('Journey').hidden=!journey;
    $('JourneyArt').hidden=!journey;
    if(journey){
      imageSource($('JourneyArt'),trialOutcomeArt[state.pending]||(state.phase==='trial'?'./assets/arena/trial-crystal-v1.png':'./assets/arena/exploration-arcade-v1.png'));
      $('JourneyArt').alt=state.pending==='trialWin'?'ミミとミナトの前で開いた試練の扉':state.pending==='trialFail'?'閉じた扉の前でミナトを励ますミミ':state.phase==='trial'?'ミミに見守られ、試練の結晶を操るミナト':'ミミとミナトが試練の扉へ歩む回廊';
      const trial=state.phase==='trial',target=trial?flow.trialTarget(state):6,points=trial?state.trialScore:state.explore;
      $('JourneyLabel').textContent=trial?'TRIAL / 試練の扉':'NORMAL / 仲間との探索';
      $('JourneyTitle').textContent=trial?`想いをつなぐ、${target}ポイント。`:'あの扉の先へ、一緒に。';
      $('JourneyValue').textContent=`${points} / ${target}`;
      $('JourneyMeter').max=target;$('JourneyMeter').value=points;
      $('JourneyRule').textContent=trial?`残り${state.trialLeft}G · 配当成立 +2 / REPLAY +1`:'6ポイントで試練 · 通常配当 +2 / BAR・7 +3 / その他 +1';
      $('Prep').textContent=state.pending==='trialWin'?'試練 突破':state.pending==='trialFail'?'再探索へ':trial?`試練 残り${state.trialLeft}G`:`探索 ${points}/6`;
      $('Progress').textContent=trial?'3G以内の規定ポイントでボスへ。失敗後は必要ポイント減少（最低1）。':'探索 → 3Gの試練 → 裏ボス対決 → 無料10Gのときめきモード';
    }
    $('Line').textContent=resultText; $('Speaker').textContent=resultHeadline;
    if(directedBoss&&state.pending==='reward'&&!feature){$('Speaker').textContent=b.name;$('Line').textContent=directedBoss.concession;}
    $('Impact').hidden=!result||!!state.pending||state.phase!=='battle'||!!feature;
    if(result){$('ImpactName').textContent=result.headline;$('ImpactValue').textContent=result.damage?`−${result.damage} HP`:result.kind==='replay'?'回避':'HP −1';$('Payout').textContent=state.lastWin?`リール配当 +${state.lastWin}`:result.kind==='replay'?'次ゲーム無料':'リール配当なし';}
    $('Cutin').hidden=!feature||!!feature.cinematic;
    $('Cinema').hidden=!feature?.cinematic;$('Cabinet').dataset.cinematic=feature?.cinematic?'true':'false';
    if(feature?.cinematic){
      const step=feature.step,trial=feature.trialOutcome,won=trial==='trialWin';$('Cinema').dataset.step=step;$('Cinema').dataset.scene=trial||'blackstar';
      $('Cinema').setAttribute('aria-label',trial?'試練の結果演出':'黒星の連続演出');
      if(trial){
        imageSource($('CinemaArt'),step===0?'./assets/arena/trial-crystal-v1.png':trialOutcomeArt[trial]);
        $('CinemaArt').alt=won?'結晶が応え、ミミとミナトの前で試練の扉が開く':'閉じた扉の前で、ミミがミナトを励ます';
        $('CinemaLabel').textContent=step===2?'TRIAL RESULT / 結果':won?'THE GATE / 開門':'TOGETHER / 再び';
        $('CinemaTitle').textContent=(won?['光が、つながった。','扉が、ひらく。','試練、突破。']:['光が、静まる。','一人で、背負わなくていい。','もう一度、仲間と。'])[step];
        $('CinemaDetail').textContent=step===2?`${state.trialScore}/${flow.trialTarget(state)}ポイント · ${won?'次は '+b.name:`HP減少なし · 次回は${Math.max(1,flow.trialTarget(state)-1)}ポイントで突破`} · 配当 ${state.lastWin?'+'+state.lastWin:'なし'}`:step===1?(won?'ミミ「ほら、君の一手が届いたよ。」':'ミミ「大丈夫。今の一歩は、次につながるよ。」'):'';
        $('CinemaContinue').textContent=step<2?'結果を見る':won?'対決の案内へ':'再探索の案内へ';
      }else{
        imageSource($('CinemaArt'),blackstarShots[Math.min(step,2)]);$('CinemaArt').alt=['黒星に力を集めるギドノゼアース','黒星を解放するギドノゼアース','黒星の奔流を受け止めるアマラ'][Math.min(step,2)];$('CinemaLabel').textContent=['GIDONOZEAAS / 黒星','LIBERATION / 解放','IMPACT / 着弾','BATTLE RESULT / 結果'][step];$('CinemaTitle').textContent=['静寂が、ほどける。','黒星、解放。','アマラに、届く。',state.enemy===0?'アマラ、突破。':`${feature.damage} DAMAGE`][step];$('CinemaDetail').textContent=step===3?`${feature.damage}ダメージ · 敵HP ${state.enemy} / ${b.hp} · リール配当 ${state.lastWin?'+'+state.lastWin:'なし'}`:step===2?'星の奔流が、裁定の盾を貫く。':'';$('CinemaContinue').textContent=step<3?'結果を見る':state.enemy===0?'勝利の祝宴へ':'対決に戻る';
      }
      [...$('Cinema').querySelectorAll('.arena-cinema-track i')].forEach((n,i)=>n.classList.toggle('is-lit',i<=step));
    }
    else if(feature){$('Cutin').dataset.kind=feature.kind;imageSource($('CutinArt'),cinematicArt[feature.kind]);$('CutinArt').alt=flow.ALLIES[feature.actor].name+'の技';$('CutinTitle').textContent=feature.headline;$('CutinText').textContent=`${feature.kind==='guard'?`チームHP ${state.hp}/6 · `:''}${feature.damage}ダメージ！ リール配当 ${state.lastWin ? '+'+state.lastWin : 'なし'}`;}
    const reward=!feature&&(state.phase==='bonus'||state.phase==='complete'||state.pending==='reward'&&!directedBoss); $('Reward').hidden=!reward;
    $('Celebration').hidden=!reward;$('Cabinet').dataset.celebrating=String(reward);
    imageSource($('Celebration'),state.phase==='bonus'?tokimekiScene().image:'./assets/arena/mimi-victory-v1.png');$('Celebration').alt=state.phase==='bonus'?tokimekiScene().name+'とのときめきのひととき':'勝利を祝うミミ';
    if(reward){$('RewardLabel').textContent=`第${state.round+1}戦 · ${b.name} 突破`;$('RewardTitle').textContent=state.phase==='complete'?'ARENA CHAMPIONS':'VICTORY BONUS';$('RewardText').textContent=state.phase==='complete'?'ミミと仲間、裏ボス闘技場を制覇。':'仲間とつかんだ、勝利の祝宴。';$('BonusValue').textContent=state.pending==='reward'?'10 G':state.phase==='complete'?'全3戦 突破':`残り ${state.bonus} G`;$('BonusWin').textContent=`このボーナスの配当 +${state.pending==='reward'?0:state.bonusWin} CREDIT`;[...$('BonusLamps').children].forEach((n,i)=>n.classList.toggle('is-lit',state.pending!=='reward'&&i<10-state.bonus));}
    if(state.phase==='bonus'){
      const ended=!!state.pending;
      $('RewardTitle').textContent=ended?'ときめきの余韻':'ときめきモード';
      $('RewardText').textContent=tokimekiScene().name+'と過ごす、束の間のひととき。';
      $('RewardLabel').textContent=ended?'VICTORY REWARD / RESULT':'勝利報酬 / 無料10G';
      if(ended){$('BonusValue').textContent='10G 完走';$('BonusWin').textContent='10Gの配当合計 +'+state.bonusWin+' CREDIT';$('Prep').textContent='無料10G 終了';$('Round').textContent='第'+(state.round+1)+'章 / CLEAR';$('Speaker').textContent=tokimekiScene().name;$('Line').textContent=bonusFarewell();}
    }
    if(state.phase==='complete'){
      $('RewardLabel').textContent='アマラ・シャハル・無銘 — 全3戦突破';
      $('RewardTitle').textContent='裏ボス闘技場 制覇';$('RewardText').textContent='ミミと仲間がつないだ、最後の一手。';
      $('BonusValue').textContent='通算 '+state.clears+' 回';$('BonusWin').textContent='最終章10Gの配当合計 +'+state.bonusWin+' CREDIT';
      $('Round').textContent='ALL CHAPTERS / CLEAR';$('Prep').textContent='制覇記録 '+state.clears+'回';
      $('Speaker').textContent='ミミ';$('Line').textContent='みんなで、ここまで来られたね。この一勝も、君との大切な思い出だよ。';
    }
    [0,1,2].forEach(c=>{paintReel(c);const moving=!!spin&&spin.stopped[c]===null,queued=!!spin?.pendingStops.includes(c);$('Reels').children[c].classList.toggle('is-spinning',moving);stops[c].disabled=!moving||queued||modalOpen();stops[c].textContent=queued?`STOP ${c+1} 予約`:spin&&spin.stopped[c]!==null?`STOP ${c+1} ✓`:`STOP ${c+1}`;});
    renderCommand();const command=!$('Command').hidden,token=command?state.pending+state.phase+state.round:'';
    if(token!==commandToken){commandToken=token;commandSince=performance.now();}if(command)nextQueued=false;if(state.phase==='complete')auto=false;
    $('Spin').disabled=modalOpen()||command&&!canAdvanceCommand();$('Spin').textContent=feature||command?'PUSH':nextQueued?'予約済み':spin?(nextReel()<0?'次ゲーム予約':`STOP ${nextReel()+1}`):state.replay||state.phase==='bonus'?'FREE SPIN':'SPIN';
    $('Auto').textContent=auto?(command&&!canAdvanceCommand()?'AUTO 待機':'AUTO ON'):'AUTO OFF';$('Auto').setAttribute('aria-pressed',String(auto));$('Turbo').textContent=turbo?'TURBO ON':'TURBO OFF';$('Turbo').setAttribute('aria-pressed',String(turbo));
    $('InputHint').textContent=command&&!canAdvanceCommand()?'画面の選択肢を選んでね':'SPACE / ボタン連打で進む';$('Home').setAttribute('aria-disabled',String(!!spin));
    if(spin&&!frame){last=performance.now();frame=requestAnimationFrame(tick);}syncTrialMotion();syncAudio();scheduleControls();
  }
  function dismissFeature(){audio.stopEffects();clearSceneMotion();feature=null;}
  function canAdvanceCommand(){return ['explore','trial','trialWin','intro','reward','next','champion'].includes(state.pending);}
  function nextReel(){return spin?spin.stopped.findIndex((n,c)=>n===null&&!spin.pendingStops.includes(c)):-1;}
  function pause(){auto=false;nextQueued=false;clearTimeout(controlTimer);controlEpoch++;}
  function scheduleControls(){
    clearTimeout(controlTimer);const epoch=++controlEpoch,transaction=spin,now=performance.now();if(document.hidden||modalOpen())return;
    const later=(due,action)=>{controlTimer=setTimeout(()=>{if(epoch===controlEpoch&&spin===transaction&&!document.hidden&&!modalOpen())action();},Math.max(0,due-now));};
    if(feature){if(feature.cinematic&&feature.step<cinematicLastStep())later(feature.until,()=>cinematicStep(feature.step+1));else if(auto||nextQueued)later(feature.until,()=>{dismissFeature();render();});return;}
    if(spin){if(spin.pendingStops.length)later(spin.started+420,()=>commitStop(sessions.takeReadyStop(spin.session,()=>true)));else if(auto&&nextReel()>=0)later(spin.lastStopAt?spin.lastStopAt+(turbo?200:320):spin.started+(turbo?420:900),()=>stop(nextReel()));}
    else if(!$('Command').hidden){if(auto&&canAdvanceCommand())later(commandSince+(['reward','next','champion'].includes(state.pending)?(turbo?1600:2600):(turbo?600:1200)),()=>$('Choices').firstElementChild.click());}
    else if(auto||nextQueued)later(settledAt+(nextQueued?(turbo?140:300):(turbo?420:900)),start);
  }
  function primary(){if(document.hidden||modalOpen())return;if(feature?.cinematic){if(feature.step<cinematicLastStep())cinematicStep(cinematicLastStep());else{dismissFeature();render();}return;}if(feature){dismissFeature();render();return;}if(!$('Command').hidden){if(canAdvanceCommand())$('Choices').firstElementChild.click();return;}if(!spin){if(performance.now()<settledAt+(turbo?140:300)){nextQueued=true;render();}else start();return;}const col=nextReel();if(col>=0)stop(col);else{nextQueued=true;render();}}
  function start(){
    if(spin||feature||!$('Command').hidden||modalOpen()||document.hidden||state.phase==='complete')return;
    const free=state.replay||state.phase==='bonus';if(!free&&state.credit<BET)return;
    clearSceneMotion();
    audio.stopEffects();state.credit-=free?0:BET;state.replay=false;state.lastWin=0;nextQueued=false;
    const flag=core.rollFlag(state.phase==='bonus'?'bonus':'normal');spin={isFree:free,flag,stopped:[null,null,null],started:performance.now(),braking:[false,false,false],pendingStops:[],lastStopAt:0};attachSession(spin);
    result=null;resultHeadline=currentPerformer().name;resultText=currentPerformer().entrance;
    if(state.phase==='normal'){resultHeadline='ミミ';resultText=['あの扉まで、一緒に進もう。','ミナト、結晶が道を教えてくれるね。','次の一歩は、君の手で。'][state.games%3];}
    if(state.phase==='trial'){resultHeadline='ミナト';resultText=state.trialLeft===1?'最後の一手。想いをつなごう。':'結晶の光を、扉へつなぐ。';}
    if(state.phase==='bonus'){resultHeadline=tokimekiScene().name;resultText=tokimekiScene().lines[Math.min(3,Math.floor((10-state.bonus)/3))];}
    $('Cabinet').dataset.heat=['bar','seven_blue','seven_red'].includes(flag)?'strong':'normal';document.querySelectorAll('.arena-symbol.is-win').forEach(n=>n.classList.remove('is-win'));
    if(sound)audio.spinStart();save();render();
  }
  function stop(col){if(!spin||!Number.isInteger(col)||col<0||col>2||spin.stopped[col]!==null||spin.pendingStops.includes(col)||modalOpen()||document.hidden)return;if(sessions.queueStop(spin.session,col)){save();render();}}
  function commitStop(col){
    if(!spin||col===null||spin.stopped[col]!==null)return;const decision=core.chooseStop({col,flag:spin.flag,stopped:sessions.knownStops(spin.session),natural:positions[col]});if(!sessions.recordStop(spin.session,col,decision))return;
    spin.pendingStops=spin.session.pendingStopQueue;spin.stopped[col]=decision.index;spin.braking[col]=true;spin.lastStopAt=performance.now();positions[col]=decision.index;
    if(sound)audio.reelStop(col,decision.slip);save();render();const transaction=spin;
    if(!reduced.matches)$('Reels').children[col].animate([{transform:'translateY(-9px)'},{transform:'translateY(2px)'},{transform:'translateY(0)'}],{duration:turbo?70:180});
    setTimeout(()=>{if(spin!==transaction)return;spin.braking[col]=false;sessions.markSettled(spin.session,col);if(spin.stopped.every(n=>n!==null)&&!spin.braking.some(Boolean))settle();else render();},reduced.matches?0:turbo?80:200);
  }
  function settle(){
    if(!spin||!sessions.resolve(spin.session))return;
    const grid=spin.stopped.map((n,c)=>core.windowAt(c,n)),out=core.evaluateGrid(grid,{bet:BET});
    const symbols=out.litLines.map(l=>grid[l.cells[0][0]][l.cells[0][1]].id).filter(id=>id!=='replay');const symbol=symbols.sort((a,b)=>core.SYMBOL_BY_ID.get(b).pay-core.SYMBOL_BY_ID.get(a).pay)[0]||'none';
    const performer=currentPerformer(),blackstar=state.phase==='battle'&&state.order==='strike'&&!out.replayHit&&state.round===0;
    result=flow.settle(state,{payout:out.payout,replay:out.replayHit,symbol});result.performer=['liberation','guard'].includes(result.kind)?flow.CAST[result.actor]:performer;
    if(state.phase==='battle'&&result.kind==='miss'&&result.state.hp>0)result.headline=bossCounters[state.round].move;
    if(result.kind==='hit'){result.headline=performer.technique;result.line=`${performer.attack} ${flow.BOSSES[state.round].name}に${result.damage}ダメージ。`;}
    islandWriter?.record({paid:spin.isFree === false,payout:out.payout});
    state=result.state;spin=null;settledAt=performance.now();resultText=result.line;resultHeadline=result.headline;
    if(state.phase==='battle'&&result.kind==='miss'&&state.hp>0){resultHeadline=flow.BOSSES[state.round].name;resultText=counterDialogue();}
    if(state.phase==='bonus'){resultHeadline=tokimekiScene().name;resultText=`${tokimekiScene().lines[Math.min(3,Math.floor((10-state.bonus)/3))]} ${out.payout?'配当 +'+out.payout:'配当なし'}。`;}
    if(['liberation','guard'].includes(result.kind)&&!state.pending)feature={...result,until:performance.now()+(reduced.matches?600:turbo?1500:2800)};
    if(blackstar)feature={...result,actor:0,kind:'liberation',cinematic:true,step:reduced.matches?3:0,speed:turbo?.6:1,until:performance.now()+650};
    if(['trialWin','trialFail'].includes(result.kind))feature={...result,actor:1,cinematic:true,trialOutcome:result.kind,step:reduced.matches?2:0,speed:turbo?.6:1,until:performance.now()+450};
    $('Cabinet').dataset.heat='normal';audio.reelLoop.stop();if(sound&&out.payout)audio.win(out.payout,BET);save();render();
    out.winCells.forEach(key=>{const[c,r]=key.split('-').map(Number);$('Reels').children[c].children[r].classList.add('is-win');});
    if(sound&&!feature?.cinematic){const cue=result.kind==='victory'?'bossDefeat':result.kind==='guard'?'revive':result.damage?'bossHit':result.kind==='miss'?'bossAttack':result.kind==='replay'?'notice':null;if(cue)audio.cue(cue);}
    playResultScene();
    if(document.hidden||modalOpen())freezeScene();
    window.dispatchEvent(new CustomEvent('mimi:arena-settled',{detail:{games:state.games,payout:out.payout,damage:result.damage,kind:result.kind}}));
  }
  function tick(now){frame=0;if(!spin)return;const dt=Math.min((now-last)/1000,.1);last=now;[0,1,2].forEach(c=>{if(spin.stopped[c]===null){positions[c]=core.mod(positions[c]-dt*(turbo?34:24),core.stripLength(c));paintReel(c);}});frame=requestAnimationFrame(tick);}
  $('Spin').addEventListener('click',primary);$('FeatureContinue').addEventListener('click',primary);$('CinemaContinue').addEventListener('click',primary);stops.forEach((b,c)=>b.addEventListener('click',()=>stop(c)));
  $('Auto').addEventListener('click',()=>{if(auto)pause();else{auto=true;if(!$('Command').hidden)commandSince=performance.now();}render();});$('Turbo').addEventListener('click',()=>{turbo=!turbo;save();render();});
  $('Home').addEventListener('click',e=>{if(spin)e.preventDefault();else{pause();save();audioEnabled(false);}});
  $('Help').addEventListener('click',()=>{pause();freezeScene();audioEnabled(false);$('Guide').showModal();render();});$('GuideClose').addEventListener('click',()=>$('Guide').close());$('Guide').addEventListener('close',()=>{resumeScene();audioEnabled(sound&&!document.hidden&&!modalOpen());render();});
  $('Sound').addEventListener('click',()=>{sound=!sound;if(sound)audio.unlock();audioEnabled(sound);$('Sound').textContent=sound?'SOUND ON':'SOUND OFF';$('Sound').setAttribute('aria-pressed',String(sound));if(sound)audio.cue('commandOpen');syncAudio();});
  window.addEventListener('keydown',e=>{if(e.repeat||e.altKey||e.ctrlKey||e.metaKey||modalOpen())return;if(e.code==='Space'&&(e.target===document.body||e.target===$('Spin')||stops.includes(e.target))){e.preventDefault();primary();}if(['Digit1','Digit2','Digit3'].includes(e.code)){e.preventDefault();stop(Number(e.code.slice(-1))-1);}});
  $('TrialMotion').addEventListener('loadeddata',syncTrialMotion);
  $('TrialMotion').addEventListener('error',()=>{trialMotionFailed=true;$('TrialMotion').hidden=true;$('TrialMotion').pause();});
  reduced.addEventListener('change',()=>{clearSceneMotion();syncTrialMotion();});
  window.addEventListener('resize',resize);document.addEventListener('visibilitychange',()=>{if(document.hidden){pause();freezeScene();}else resumeScene();audioEnabled(sound&&!document.hidden&&!modalOpen());render();});window.addEventListener('pagehide',()=>{pause();save();$('TrialMotion').pause();audioEnabled(false);});
  audioEnabled(false);resize();save();render();if(spin?.stopped.every(n=>n!==null))settle();$('Cabinet').dataset.runtimeReady='true';
})();
