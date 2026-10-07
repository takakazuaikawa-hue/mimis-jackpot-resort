/* Independent guild cabinet. Money and reel decisions stay in SlotCore. */
(() => {
  'use strict';
  const flow=window.GuildFlow,core=window.SlotCore,sessions=window.MimiSpinSession,audio=window.MimiAudio,presentation=window.GuildPresentation,scenes=window.GuildScenes;
  const KEY='mimi.guild.slot.v1',BET=30,A='./assets/guild/',$=id=>document.getElementById('guild'+id);
  const stops=[...document.querySelectorAll('[data-guild-stop]')],positions=[0,7,14],reduced=matchMedia('(prefers-reduced-motion: reduce)');
  let state=flow.create(),spin=null,auto=false,turbo=false,calm=false,sound=false,queued=false,result=null,feature=null;
  let sceneAnimation=null,savedStory=null;
  let timer=0,epoch=0,frame=0,last=0,settledAt=0,commandKey='',commandAt=0,saveBlocked=false,resultView=null,reaction=null;
  let speaker='ミミ',line='さあ、皆さん。今夜も開きます！',musicKey='',musicEpoch=0,musicError=false;
  const music=$('Music'),tracks={guild:'guild.mp3',silvio:'silvio.mp3',market:'market.mp3',feast:'feast.mp3'};
  const motionReduced=()=>reduced.matches||calm;
  const paused=()=>document.hidden||$('Guide').open;
  function attach(t){t.session=sessions.create({phase:state.phase,stage:state.round,bet:BET,flag:t.flag});t.stopped.forEach((n,c)=>{if(n!==null){sessions.recordStop(t.session,c,{index:n});sessions.markSettled(t.session,c);}});t.pendingStops.forEach(c=>sessions.queueStop(t.session,c));t.pendingStops=t.session.pendingStopQueue;}
  try{
    const raw=localStorage.getItem(KEY),saved=raw?JSON.parse(raw):null;
    if(saved){
      if(!flow.valid(saved.state))throw Error('Invalid save');
      const t=saved.spin;
      if(t&&(!['none',...core.SYMBOLS.map(s=>s.id)].includes(t.flag)||saved.state.pending||saved.state.phase==='complete'||!Array.isArray(t.stopped)||t.stopped.length!==3||!t.stopped.every((n,c)=>n===null||Number.isInteger(n)&&n>=0&&n<core.stripLength(c))))throw Error('Invalid spin');
      state=saved.state;const st=saved.story;if(!t&&st&&st.round===state.round&&st.phase===state.phase&&st.pending===state.pending&&Number.isInteger(st.step)&&st.step>=0&&st.step<scenes.story(st.id).length)savedStory=st;turbo=saved.turbo===true;calm=saved.calm===true;
      if(Array.isArray(saved.positions)&&saved.positions.length===3&&saved.positions.every((n,c)=>Number.isInteger(n)&&n>=0&&n<core.stripLength(c)))saved.positions.forEach((n,c)=>positions[c]=n);
      if(t){spin={isFree:t.isFree===true||state.phase==='bonus',flag:t.flag,stopped:t.stopped,started:performance.now(),braking:[false,false,false],lastStopAt:0,pendingStops:[...new Set(Array.isArray(t.pendingStops)?t.pendingStops:[])].filter(c=>Number.isInteger(c)&&c>=0&&c<3&&t.stopped[c]===null)};attach(spin);spin.stopped.forEach((n,c)=>{if(n!==null)positions[c]=n;});line='続きの勝負です。残りのリールを止めてくださいね。';}
      else line=state.phase==='complete'?'皆さんの席があるギルドに、帰ってきました。今日は私も座ります。':state.phase==='bonus'?'続きのお茶にしましょう。お皿も、まだありますよ。':'おかえりなさい。続きから、興行を開きましょう！';
    }
  }catch{saveBlocked=true;line='保存データを読み込めませんでした。元のデータは残し、この画面だけで遊べます。';}
  let islandWriter=null;
  try{islandWriter=window.MimiResortRewards.createWriter('guild');}catch(_){saveBlocked=true;}
  function save(){if(saveBlocked){$('Save').textContent='保存停止・元データを保護中';return;}try{islandWriter.save({state,turbo,calm,story:feature?.storyId?{id:feature.storyId,step:feature.step,round:state.round,phase:state.phase,pending:state.pending}:null,positions:positions.map(Math.floor),spin:spin?{isFree:spin.isFree,flag:spin.flag,stopped:spin.stopped,pendingStops:spin.pendingStops}:null});$('Save').textContent='台専用・自動保存';}catch(error){$('Save').textContent=error.message||'保存不可・この画面で継続可';}}
  function src(node,url){if(node.getAttribute('src')!==url)node.src=url;}
  function resize(){$('Cabinet').style.transform=`translate(-50%, -50%) scale(${Math.min(innerWidth/1280,innerHeight/720)})`;}
  function paint(c){core.windowAt(c,Math.floor(positions[c])).forEach((s,r)=>{const img=$('Reels').children[c].children[r].firstChild;src(img,'./assets/generated/v3/symbols/dist/'+s.img);img.alt=s.name;});}
  $('Reels').innerHTML=[0,1,2].map(c=>`<div class="guild-reel" aria-label="リール${c+1}">${[0,1,2].map(()=>'<div class="guild-symbol"><img alt=""></div>').join('')}</div>`).join('');
  function syncAudio(){
    const active=sound&&!paused();
    if(audio.enabled!==active){if(!active)audio.stopEffects();audio.setEnabled(active);if(active&&spin){audio.reelLoop.start();spin.stopped.forEach((n,c)=>{if(n!==null)audio.reelLoop.stopOne(c);});}}
    audio.setMood('silent');
    if(!active){musicEpoch++;music.pause();return;}
    const celebrating=state.phase==='bonus'||state.phase==='complete'||state.pending==='reward'&&(!feature||feature.frames[feature.step].label==='仲間入り');const key=celebrating?'feast':flow.TOWNS[state.round].music;
    if(key!==musicKey){musicEpoch++;music.pause();musicKey=key;musicError=false;music.src=A+'audio/'+tracks[key];}
    music.volume=.19*(audio.payoutMusicGain??1);
    if(music.paused&&!musicError){const ticket=++musicEpoch;music.play().then(()=>{if(ticket!==musicEpoch&&(!sound||paused()))music.pause();}).catch(e=>{if(ticket===musicEpoch&&e.name!=='AbortError'){musicError=true;$('Sound').textContent='SOUND ON・曲を再試行';}});}
  }
  music.addEventListener('error',()=>{musicError=true;if(sound)$('Sound').textContent='SOUND ON・曲を再試行';});
  audio.onPayoutMix?.(gain=>{music.volume=.19*gain;});
  function command(){
    if(spin||feature)return null;
    const t=flow.TOWNS[state.round],p=state.pending;
    const map={welcome:['今夜の興行を始めましょう。客寄せ6点で開幕です。',[['店を開く','welcome']]],trial:[`3G以内に拍手${flow.goal(state)}点。配当で2、REPLAYで1。`,[['興行を始める','trial']]],success:[`${t.boss}が勝負を申し込んできました。`,[['大物の席へ','success']]],retryShow:[`客席はそのまま、次の演目へ。目標は拍手${Math.max(1,flow.goal(state)-1)}点です。`,[['演目を変える','retryShow']]],intro:[t.demand,[['勝負を受ける','intro']]],orders:['4回連続で配当なし。次の非REPLAYに備えましょう。',[['大入りの噂 ＋4点','rumor'],['お茶で一息 粘り＋2','tea']]],retry:[`得点を持ち越し、粘り6で再挑戦。配当時の加点＋${Math.min(3,state.resolve+1)}。`,[['得点を持ち越して再挑戦','retry']]],reward:[`${t.boss}が仲間に。10G無料の祝宴をどうぞ。`,[['祝宴を開く','reward']]],next:[`祝宴の配当合計 ${state.bonusWin}。次の町へ出発しましょう。`,[['次の町へ','next']]],final:[`祝宴の配当合計 ${state.bonusWin}。三人の仲間と帰りましょう。`,[['ギルドへ帰還','final']]]};
    if(p)return {text:map[p][0],choices:map[p][1],safe:!['orders','retry','retryShow'].includes(p),key:p};
    if(state.phase==='complete')return {text:'三つの町の大物が、今夜は同じテーブルに。',choices:[['もう一度旅に出る','restart']],safe:false,key:'restart'};
    if(!state.replay&&state.phase!=='bonus'&&state.credit<BET)return {text:'CREDIT不足です。無料で300補充できます。',choices:[['CREDITを300補充','refill']],safe:false,key:'refill'};
    return null;
  }
  function advance(action){if(spin||feature||paused())return;state=flow.advance(state,action);result=null;resultView=null;reaction=null;queued=false;if(action==='restart')document.querySelectorAll('.guild-symbol.is-win').forEach(n=>n.classList.remove('is-win'));speaker='ミミ';line=action==='intro'?flow.TOWNS[state.round].reply:action==='rumor'?'噂をひとつ。次の勝負は、街じゅうが見ていますよ！':action==='tea'?'ひと息つきましょう。お茶なら、まだありますから。':action==='reward'?'相手だった皆さんも、今夜は一緒のテーブルです。':action==='final'?'嘘つきばかりで、にぎやかですね。……お茶、もう一杯いかがですか？':'さあ、次の一手をどうぞ！';if(sound)audio.cue(action==='reward'?'bonus':'commandAdvance');const storyKind={welcome:'opening',success:'duel',reward:'after'}[action],storyId=action==='final'?'homecoming':action==='trial'&&state.round===0?'bell-chest':storyKind?storyKind+'-'+state.round:null;if(storyId)beginFeature(scenes.story(storyId),storyId);else beginFeature(scenes.action(action,state,flow.TOWNS[state.round]));save();render();}
  function render(){
    const t=flow.TOWNS[state.round],p=state.phase,cmd=command();
    const aim=presentation.objective(state),reach=spin?presentation.anticipation(spin.stopped):null;
    $('Objective').hidden=p==='complete'||!!feature||!!reach||!!result&&!spin;
    $('ObjectiveTitle').textContent=aim.title;$('ObjectiveDetail').textContent=aim.detail;$('ObjectiveReward').textContent=aim.reward;
    [...$('Steps').children].forEach((node,i)=>{node.classList.toggle('is-current',i===Math.min(3,aim.step));node.classList.toggle('is-done',i<aim.step);if(i===Math.min(3,aim.step))node.setAttribute('aria-current','step');else node.removeAttribute('aria-current');});
    $('Cabinet').dataset.resultTier=result&&!spin?resultView?.tier||'quiet':'quiet';
    $('ReelCue').hidden=!reach;
    if(reach)$('ReelCue').textContent=`${reach.name}、あとひとつ！　STOP ${reach.lastCol+1}で決着`;
    document.querySelectorAll('.guild-symbol.is-chance').forEach(n=>n.classList.remove('is-chance'));
    if(reach)reach.cells.forEach(([c,r])=>$('Reels').children[c].children[r].classList.add('is-chance'));
    if(reach&&!spin.reachCued){spin.reachCued=true;if(sound&&!paused())audio.cue(['bar','seven_blue','seven_red'].includes(reach.symbol)?'hot':'tenpai');}
    $('Calm').checked=calm;$('Cabinet').dataset.motion=motionReduced()?'reduced':'full';$('Reels').setAttribute('aria-busy',String(!!spin));$('Cabinet').dataset.phase=p;$('Cabinet').dataset.pending=state.pending;$('Cabinet').dataset.spinning=String(!!spin);$('Cabinet').dataset.feature=feature?String(feature.step):'';
    $('Town').textContent=p==='complete'?'帰還　ギルド':`第${state.round+1}幕　${t.name}`;
    let art=p==='boss'?t.art:p==='complete'?A+'homecoming-v2.png':p==='bonus'?t.feast:scenes.townArt(state.round);
    src($('Scene'),art);$('Scene').alt=p==='boss'?t.boss+'との勝負':p==='bonus'||p==='complete'?'仲間と囲む祝宴':t.name+'で開く旅の興行';
    $('Phase').textContent=p==='normal'?'今夜の興行 · 客寄せ':p==='trial'?`開幕 · 残り${state.trialLeft}G`:p==='boss'?t.title:p==='bonus'?'仲間と囲む · 無料の祝宴':'旅の終わり · ギルドへ帰還';
    $('Title').textContent=p==='normal'?'今夜の興行を始めよう。':p==='trial'?'その拍手を、街じゅうへ。':p==='boss'?t.boss+'との大勝負':p==='bonus'?'仲間と、もう一杯。':'嘘つきたちに、乾杯。';
    let value=p==='normal'?state.crowd:p==='trial'?state.applause:p==='boss'?t.target-state.remaining:p==='bonus'?state.bonus:3,max=p==='normal'?6:p==='trial'?flow.goal(state):p==='boss'?t.target:p==='bonus'?10:3;
    $('Value').textContent=p==='bonus'?`${value} G`:`${value} / ${max}`;$('ValueLabel').textContent=p==='normal'?'客寄せ':p==='trial'?'拍手':p==='boss'?'勝負の点数':p==='bonus'?'残り無料ゲーム':'仲間';
    $('Meter').style.setProperty('--progress',Math.min(1,value/max)*100+'%');$('Meter').setAttribute('aria-valuemax',String(max));$('Meter').setAttribute('aria-valuenow',String(Math.min(value,max)));
    $('Rule').textContent=p==='normal'?'毎ゲーム＋1以上。配当で＋2、BAR・7配当で＋3。':p==='trial'?`配当＋2 ／ REPLAY＋1 · ${flow.goal(state)}点で大入り`:p==='boss'?`配当役で2〜12点${state.resolve?'＋再挑戦'+state.resolve:''} ／ 配当なしで粘り−1`:p==='bonus'?`今回の祝宴　配当合計 ${state.bonusWin}`:'ヴァルド、シルヴィオ、グラーノがギルドに加入。';
    $('Nerve').hidden=p!=='boss';$('Nerve').textContent=`粘り　${'◆'.repeat(state.nerve)}${'◇'.repeat(6-state.nerve)}　${state.nerve} / 6`;
    $('Command').hidden=!cmd;
    const token=cmd?state.round+':'+cmd.key:'';
    if(token!==commandKey){commandKey=token;commandAt=performance.now();$('Choices').replaceChildren();if(cmd)cmd.choices.forEach(([label,action])=>{const b=document.createElement('button');b.type='button';b.textContent=label;b.addEventListener('click',()=>{if(b.isConnected)advance(action);});$('Choices').append(b);});}
    if(cmd)$('CommandText').textContent=cmd.text;
    // One spoken line, in the portrait dialogue; settlement has its own small receipt.
    $('Reaction').hidden=true;
    if(reaction){$('Reaction').dataset.tone=reaction.tone;src($('ReactionPortrait'),reaction.art||t.portrait);$('ReactionPortrait').hidden=!reaction.art&&reaction.speaker==='ミミ';$('ReactionPortrait').alt=reaction.speaker;$('ReactionSpeaker').textContent=reaction.speaker;$('ReactionTitle').textContent=reaction.title;$('ReactionText').textContent=reaction.text;}
    $('Result').hidden=!result||!!feature||!!spin;
    if(result&&resultView){$('ResultLabel').textContent=resultView.effect;$('ResultTitle').textContent=resultView.title;$('ResultWin').textContent=resultView.payout?`WIN ＋${resultView.payout}`:state.replay?'次回BET 0':'WIN 0';$('ResultDetail').textContent=resultView.next;}
    $('StorySkip').hidden=!feature?.storyId;$('StoryReplay').disabled=!!spin||!!feature;$('StoryReplay').textContent=`第${state.round+1}幕の出会いを読み返す`;$('Auto').disabled=!!feature?.storyId;$('Feature').hidden=!feature;$('Feature').dataset.step=feature?String(feature.step):'';
    if(feature){const f=feature.frames[feature.step],final=feature.step===feature.frames.length-1;const premium=f.label==='リールの見せ場'?resultView?.tier:'';$('Feature').dataset.tier=premium||'story';$('PremiumSymbols').hidden=!premium;if(premium){const symbol=core.SYMBOL_BY_ID.get({bar:'bar',blue:'seven_blue',red:'seven_red'}[premium]);[...$('PremiumSymbols').children].forEach(img=>src(img,'./assets/generated/v3/symbols/dist/'+symbol.img));}$('Feature').dataset.art=f.actor?'actor':(f.art.includes('/feast-')||f.art.includes('/homecoming-'))?'feast':/\/(valdo|silvio|grano)\.jpg$/.test(f.art)?'portrait':'wide';src($('FeatureArt'),f.art);$('FeatureArt').alt=f.title;$('FeatureLabel').textContent=feature.storyId?`${f.label} · ${feature.step+1}/${feature.frames.length}`:f.label;$('FeatureTitle').textContent=f.title;$('FeatureText').textContent=f.text;$('FeatureValue').textContent=f.value;$('FeatureContinue').textContent=feature.storyId?(final?'会話を終える':'次の台詞へ ▶'):(final?'台へ戻る':'PUSHで結果へ');speaker=f.speaker;line=f.text;}
    $('Speaker').textContent=speaker;$('Line').textContent=line;
    src($('DialoguePortrait'),reaction?.art||((speaker==='ミミ'||feature)?A+'mimi-smile.jpg':t.portrait));
    $('DialoguePortrait').alt=speaker;
    document.querySelector('.guild-dialogue').hidden=!!feature;
    $('Credit').textContent=state.credit.toLocaleString('ja-JP');$('Win').textContent=state.lastWin.toLocaleString('ja-JP');$('Bet').textContent=(spin?spin.isFree:state.phase==='bonus'||state.replay)?'FREE':BET;
    $('Prepared').textContent=state.order==='rumor'?'大入りの噂 準備完了':state.order==='tea'?'お茶の支度 準備完了':state.replay?'REPLAY · 次は無料':queued?'次のSPINを予約済み':p==='bonus'?'祝宴 · BET不要':'今夜も、一勝負。';
    const help=$('HelpCharge');
    help.textContent=state.order?'助け READY':p==='bonus'?`祝宴 残り${state.bonus}G`:p==='boss'?`不発 ${state.dry} / 4`:p==='trial'?`拍手 ${state.applause} / ${flow.goal(state)}`:p==='normal'?`客寄せ ${state.crowd} / 6`:'仲間 3 / 3';
    const lamps=document.querySelector('.guild-help-lamps');lamps.hidden=p!=='boss';
    lamps.parentElement.querySelector('span').textContent=p==='boss'?'仲間の助け':p==='trial'?'大入りへの拍手':p==='bonus'?'無料の祝宴':p==='complete'?'旅の仲間':'興行の客寄せ';
    [...lamps.children].forEach((lamp,i)=>lamp.classList.toggle('is-lit',i<state.dry||!!state.order));
    $('Spin').textContent=feature?'PUSH':cmd?'PUSH':spin?(nextReel()>=0?'STOP':'予約'):'SPIN';$('Spin').disabled=!!cmd&&!cmd.safe;
    if(!window.MimiCabinetArt.ready){$('Spin').disabled=!window.MimiCabinetArt.failed;$('Spin').textContent=window.MimiCabinetArt.failed?'図柄を再読込':'図柄読込中';}
    $('InputHint').textContent=cmd&&!cmd.safe?'画面の選択肢を選んでください':spin?'順番自由 · 1 / 2 / 3':'SPACEでも操作';
    stops.forEach((b,c)=>{b.disabled=!window.MimiCabinetArt.ready||!spin||spin.stopped[c]!==null||spin.pendingStops.includes(c);b.textContent=`STOP ${c+1}`;});
    $('Auto').textContent=auto?'AUTO ON':'AUTO OFF';$('Auto').setAttribute('aria-pressed',String(auto));$('Turbo').textContent=turbo?'TURBO ON':'TURBO OFF';$('Turbo').setAttribute('aria-pressed',String(turbo));
    $('Route').innerHTML=flow.TOWNS.map((town,i)=>`<li class="${i<state.recruited?'is-ally':i===state.round?'is-current':''}">${i<state.recruited?`<img src="${town.portrait}" alt="">`:''}<span>${i<state.recruited?town.boss+' · 仲間':town.name}</span></li>`).join('');$('Games').textContent=`${state.games} G`;
    positions.forEach((_,c)=>paint(c));syncAudio();schedule();window.MimiCabinetCommands.render();syncPhysicalInputs();
    if(spin&&!paused()&&!frame){last=performance.now();frame=requestAnimationFrame(tick);}else if((!spin||paused())&&frame){cancelAnimationFrame(frame);frame=0;}
  }
  function nextReel(){return spin?spin.stopped.findIndex((n,c)=>n===null&&!spin.pendingStops.includes(c)):-1;}
  function primaryInputReady(){
    if(!window.MimiCabinetArt.ready)return !!window.MimiCabinetArt.failed;
    if(paused())return false;
    if(feature)return true;
    const cmd=command();if(cmd)return true;
    if(spin)return nextReel()>=0;
    if(state.phase==='complete')return false;
    return (state.replay||state.phase==='bonus'||state.credit>=BET)&&performance.now()>=settledAt+(turbo?140:300);
  }
  function stopInputReady(col){
    if(!window.MimiCabinetArt.ready||paused())return false;
    if($('Cabinet').dataset.commandDeck==='choice')return stops[col]?.dataset.inputReady==='true';
    return !!spin&&spin.stopped[col]===null&&!spin.pendingStops.includes(col);
  }
  let inputReadinessTimer=0;
  function publishInput(button,ready){button.disabled=false;button.setAttribute('aria-disabled','false');button.dataset.inputReady=String(!!ready);}
  function syncPhysicalInputs(){
    const deck=$('Cabinet').dataset.commandDeck,cmd=command();
    const commandReady=!!deck&&!!cmd&&!paused()&&window.MimiCabinetArt.ready;
    publishInput($('Spin'),deck?commandReady:primaryInputReady());
    stops.forEach((button,col)=>{
      if(deck==='choice'&&commandReady){
        button.disabled=false;button.setAttribute('aria-disabled','false');
        if(!button.hasAttribute('data-input-ready'))button.dataset.inputReady='false';
      }else publishInput(button,!deck&&stopInputReady(col));
    });
    clearTimeout(inputReadinessTimer);inputReadinessTimer=0;
    const canStart=!deck&&!spin&&!feature&&!command()&&!paused()&&window.MimiCabinetArt.ready&&state.phase!=='complete'&&(state.replay||state.phase==='bonus'||state.credit>=BET);
    const readyAt=settledAt+(turbo?140:300),delay=readyAt-performance.now();
    if(canStart&&delay>0)inputReadinessTimer=setTimeout(()=>{inputReadinessTimer=0;render();},delay+1);
  }
  function contactIgnoredInput(button){window.MimiCabinetResponse?.contact?.(button);}
  const handledStopPointers=new WeakSet();
  const handledPrimaryPointers=new Map(),handledPrimaryClicks=new WeakSet();
  function pause(freeze=false){auto=false;queued=false;clearTimeout(timer);epoch++;if(freeze)sceneAnimation?.pause();if(freeze&&feature&&!Number.isFinite(feature.remaining))feature.remaining=Math.max(0,feature.until-performance.now());}
  function resume(){if(sceneAnimation?.playState==='paused')sceneAnimation.play();if(feature&&Number.isFinite(feature.remaining)){feature.until=performance.now()+feature.remaining;delete feature.remaining;}}
  function schedule(){
    clearTimeout(timer);const e=++epoch,tx=spin,now=performance.now();if(paused())return;
    const later=(due,fn)=>{timer=setTimeout(()=>{if(epoch===e&&spin===tx&&!paused())fn();},Math.max(0,due-now));};
    if(feature){if(feature.storyId)return;if(feature.step<feature.frames.length-1)later(feature.until,()=>stepFeature(feature.step+1));else if(auto||queued)later(feature.until,()=>{endFeature();render();});return;}
    if(spin){if(spin.pendingStops.length)later(performance.now(),()=>commitStop(sessions.takeReadyStop(spin.session,()=>true)));else if(auto&&nextReel()>=0)later(spin.lastStopAt?spin.lastStopAt+(turbo?200:320):spin.started+(turbo?420:900),()=>stop(nextReel(),false));return;}
    const cmd=command();if(cmd){if(auto&&cmd.safe)later(commandAt+(['reward','next','final'].includes(state.pending)?turbo?1600:2600:turbo?600:1200),()=>advance(cmd.choices[0][1]));return;}
    const resultHold=resultView?.payout?(turbo?750:1400):(turbo?420:900);
    if(auto||queued)later(settledAt+(queued?turbo?140:300:resultHold),start);
  }
  function endFeature(){const ended=feature;sceneAnimation?.cancel();sceneAnimation=null;feature=null;save();if(result){speaker=result.speaker;line=result.line;}else if(ended?.storyId){const final=ended.frames[ended.frames.length-1];speaker=final.speaker;line=final.text;}}
  function beginFeature(frames,storyId=null,step=0){if(!frames.length)return;endFeature();if(storyId)pause();feature={frames,storyId,step:0,until:0};stepFeature(storyId?step:motionReduced()?frames.length-1:0);}
  function stepFeature(step){
    sceneAnimation?.cancel();sceneAnimation=null;feature.step=step;
    const readingTime=Math.max(step===feature.frames.length-1?2800:1800,900+feature.frames[step].text.length*70);feature.until=performance.now()+(turbo?Math.max(1000,readingTime*.5):readingTime);
    if(paused())feature.remaining=Math.max(0,feature.until-performance.now());
    if(feature.storyId)save();const f=feature.frames[step];if(sound&&!paused())audio.cue(f.cue);render();
    if(!motionReduced()&&!paused())sceneAnimation=$('FeatureArt').animate([{opacity:.65,transform:'scale(1.025)'},{opacity:1,transform:'scale(1)'}],{duration:turbo?350:650});
  }
  function primary(){if(!window.MimiCabinetArt.ready){if(window.MimiCabinetArt.failed)window.MimiCabinetArt.retry();render();return;}if(paused())return;if(feature){if(feature.step<feature.frames.length-1)stepFeature(feature.storyId?feature.step+1:feature.frames.length-1);else{endFeature();render();}return;}const cmd=command();if(cmd){window.MimiCabinetCommands.confirm();return;}if(!spin){if(performance.now()<settledAt+(turbo?140:300))return;start();return;}const col=nextReel();if(col>=0)stop(col,true);}
  function start(){if(!window.MimiCabinetArt.ready)return;if(spin||feature||command()||paused())return;endFeature();const free=state.replay||state.phase==='bonus';if(!free&&state.credit<BET)return;state.credit-=free?0:BET;state.replay=false;state.lastWin=0;queued=false;result=null;resultView=null;reaction=null;audio.stopEffects();spin={isFree:free,flag:core.rollFlag(state.phase==='bonus'?'bonus':'normal'),stopped:[null,null,null],pendingStops:[],braking:[false,false,false],started:performance.now(),lastStopAt:0};attach(spin);speaker='ミミ';line=state.phase==='boss'?'この一手も、私が引き受けます！':state.phase==='bonus'?'皆さんの席、ちゃんとありますよ。':'さあ、今夜の見せ場です！';document.querySelectorAll('.guild-symbol.is-win').forEach(n=>n.classList.remove('is-win'));if(sound)audio.spinStart();save();render();window.dispatchEvent(new CustomEvent('mimi:cabinet-input', {detail:{machineId:'guild',type:'spin-start',transactionId:spin.session.id}}));}
  function stop(col,immediate=true){if(!window.MimiCabinetArt.ready||!spin||paused()||!Number.isInteger(col)||col<0||col>2||spin.stopped[col]!==null||spin.pendingStops.includes(col))return;if(sessions.queueStop(spin.session,col)){if(immediate){commitStop(sessions.takeReadyStop(spin.session,()=>true));return;}save();render();}}
  function commitStop(col){if(!spin||col===null||spin.stopped[col]!==null)return;const d=core.chooseStop({col,flag:spin.flag,stopped:sessions.knownStops(spin.session),natural:positions[col]});if(!sessions.recordStop(spin.session,col,d))return;spin.pendingStops=spin.session.pendingStopQueue;spin.stopped[col]=d.index;positions[col]=d.index;spin.braking[col]=true;spin.lastStopAt=performance.now();if(sound&&!paused())audio.reelStop(col,d.slip);save();render();window.dispatchEvent(new CustomEvent('mimi:cabinet-input', {detail:{machineId:'guild',type:'stop-accepted',transactionId:spin.session.id,reelIndex:col}}));const tx=spin;if(!motionReduced())$('Reels').children[col].animate([{transform:'translateY(-8px)'},{transform:'translateY(0)'}],{duration:turbo?48:60});setTimeout(()=>{if(spin!==tx)return;spin.braking[col]=false;sessions.markSettled(spin.session,col);if(spin.stopped.every(n=>n!==null)&&!spin.braking.some(Boolean))settle();else render();},motionReduced()?0:turbo?50:60);}
  function settle(){if(!spin||!sessions.resolve(spin.session))return;const transactionId=spin.session.id;const grid=spin.stopped.map((n,c)=>core.windowAt(c,n)),out=core.evaluateGrid(grid,{bet:BET}),symbol=out.litLines.map(l=>grid[l.cells[0][0]][l.cells[0][1]].id).filter(id=>id!=='replay').sort((a,b)=>core.SYMBOL_BY_ID.get(b).pay-core.SYMBOL_BY_ID.get(a).pay)[0]||'none';const before=state;islandWriter?.record({paid:spin.isFree===false,payout:out.payout});result=flow.settle(state,{payout:out.payout,replay:out.replayHit,symbol});reaction=scenes.reaction(before,result,flow.TOWNS[state.round]);if(reaction){result.speaker=reaction.speaker;result.line=reaction.text;}resultView=presentation.outcome(before,result,symbol);state=result.state;spin=null;settledAt=performance.now();speaker=result.speaker;line=result.line;audio.reelLoop.stop();if(sound&&!paused()){if(out.payout)audio.win(out.payout,BET);else if(out.replayHit)audio.cue('notice');else if(before.phase==='boss'&&state.pending!=='retry')audio.cue('bossAttack');}save();beginFeature(scenes.settled(before,result,flow.TOWNS[state.round],resultView));render();out.winCells.forEach(key=>{const[c,r]=key.split('-').map(Number);$('Reels').children[c].children[r].classList.add('is-win');});if(!motionReduced()&&!paused()&&!feature){sceneAnimation?.cancel();sceneAnimation=(reaction&&reaction.tone!=='feast'?document.querySelector('.guild-dialogue'):$('Result')).animate([{opacity:.3,transform:'translateY(9px)'},{opacity:1,transform:'translateY(0)'}],{duration:400});}window.dispatchEvent(new CustomEvent('mimi:cabinet-result', {detail:{machineId:'guild',type:'revealed',transactionId,payout:out.payout,replay:Boolean(out.replayHit),lineIds:out.litLines.map(l=>l.id)}}));window.dispatchEvent(new CustomEvent('mimi:guild-settled',{detail:{games:state.games,payout:out.payout,points:result.points,kind:result.kind}}));}
  function tick(now){frame=0;if(!spin||paused())return;const dt=Math.min((now-last)/1000,.1);last=now;positions.forEach((_,c)=>{if(spin.stopped[c]===null){positions[c]=core.mod(positions[c]-dt*(turbo?34:24),core.stripLength(c));if(!motionReduced())paint(c);}});frame=requestAnimationFrame(tick);}
  function syncMotionPreference(){if(motionReduced()){sceneAnimation?.cancel();sceneAnimation=null;if(feature&&!feature.storyId)stepFeature(feature.frames.length-1);}render();}
  $('Calm').addEventListener('change',()=>{calm=$('Calm').checked;syncMotionPreference();save();});
  $('StorySkip').addEventListener('click',()=>{if(feature?.storyId&&!paused()){endFeature();render();}});$('StoryReplay').addEventListener('click',()=>{if(spin||feature)return;$('Guide').close();const id='opening-'+state.round;beginFeature(scenes.story(id),id);});
  window.addEventListener('mimi:cabinet-art',render);
  window.addEventListener('pointerdown',e=>{const button=e.target.closest?.('#guildSpin');if(!button||e.button!==0||e.isPrimary===false)return;handledPrimaryPointers.set(e.pointerId,button);handledPrimaryClicks.add(button);e.stopImmediatePropagation();if(button.dataset.inputReady==='true')primary();else contactIgnoredInput(button);},true);
  window.addEventListener('pointerdown',e=>{const button=e.target.closest?.('[data-guild-stop]');if(!button||e.button!==0||e.isPrimary===false)return;const deck=$('Cabinet').dataset.commandDeck;if(deck&&button.dataset.inputReady==='true')return;if(button.dataset.inputReady!=='true'||deck||!spin){handledStopPointers.add(button);e.stopImmediatePropagation();contactIgnoredInput(button);return;}handledStopPointers.add(button);e.stopImmediatePropagation();stop(stops.indexOf(button),true);},true);
  window.addEventListener('pointerup',e=>{if(handledPrimaryPointers.has(e.pointerId))handledPrimaryPointers.delete(e.pointerId);},true);
  window.addEventListener('pointercancel',e=>{const primary=handledPrimaryPointers.get(e.pointerId);if(primary){handledPrimaryPointers.delete(e.pointerId);handledPrimaryClicks.delete(primary);}const button=e.target.closest?.('[data-guild-stop]');if(button)handledStopPointers.delete(button);},true);
  window.addEventListener('click',e=>{const button=e.target.closest?.('#guildSpin, [data-guild-stop]');if(!button)return;if(button.matches('#guildSpin')&&e.detail>0&&handledPrimaryClicks.has(button)){handledPrimaryClicks.delete(button);e.preventDefault();e.stopImmediatePropagation();return;}if(button.matches('[data-guild-stop]')&&e.detail>0&&handledStopPointers.has(button)){handledStopPointers.delete(button);e.preventDefault();e.stopImmediatePropagation();return;}if(button.dataset.inputReady==='true')return;e.preventDefault();e.stopImmediatePropagation();contactIgnoredInput(button);},true);
  $('Spin').addEventListener('click',primary);$('FeatureContinue').addEventListener('click',primary);stops.forEach((b,c)=>b.addEventListener('click',()=>stop(c,true)));
  $('Auto').addEventListener('click',()=>{if(auto)pause();else{auto=true;commandAt=performance.now();resume();}render();});$('Turbo').addEventListener('click',()=>{turbo=!turbo;save();render();});
  $('Sound').addEventListener('click',()=>{if(musicError&&sound){musicError=false;musicKey='';}else sound=!sound;if(sound)audio.unlock();$('Sound').textContent=sound?'SOUND ON':'SOUND OFF';$('Sound').setAttribute('aria-pressed',String(sound));syncAudio();});
  $('Help').addEventListener('click',()=>{pause(true);$('Guide').showModal();render();});$('GuideClose').addEventListener('click',()=>$('Guide').close());$('Guide').addEventListener('close',()=>{resume();render();});
  $('Home').addEventListener('click',e=>{if(spin)e.preventDefault();else{pause();save();music.pause();audio.stopEffects();audio.setEnabled(false);}});
  window.addEventListener('keydown',e=>{if(e.altKey||e.ctrlKey||e.metaKey)return;const physicalKey=['Space','Enter'].includes(e.code)&&(e.target===document.body||e.target===$('Spin')||stops.includes(e.target));if(e.repeat){if(physicalKey)e.preventDefault();return;}if(paused())return;if(e.code==='Space'&&(e.target===document.body||e.target===$('Spin')||stops.includes(e.target))){e.preventDefault();if(stops.includes(e.target)){const col=stops.indexOf(e.target);if(e.target.dataset.inputReady==='true')stop(col,true);else contactIgnoredInput(e.target);}else if($('Spin').dataset.inputReady==='true')primary();else contactIgnoredInput($('Spin'));}if(['Digit1','Digit2','Digit3'].includes(e.code)){e.preventDefault();const col=Number(e.code.slice(-1))-1,button=stops[col];if(button?.dataset.inputReady==='true')stop(col,true);else if(button)contactIgnoredInput(button);}});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)pause(true);else resume();render();});window.addEventListener('pagehide',()=>{pause(true);save();musicEpoch++;music.pause();audio.stopEffects();audio.setEnabled(false);});window.addEventListener('resize',resize);reduced.addEventListener('change',syncMotionPreference);
  audio.setEnabled(false);resize();if(savedStory)beginFeature(scenes.story(savedStory.id),savedStory.id,savedStory.step);save();render();if(spin?.stopped.every(n=>n!==null))settle();$('Cabinet').dataset.runtimeReady='true';
})();
