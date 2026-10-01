/* A reel-led adaptation of Mimi's Gamble Guild. The source journey is not ported.
 * All money comes from SlotCore; crowd, applause and resolve are story counters. */
(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.GuildFlow = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';
  const A='./assets/guild/';
  const TOWNS=Object.freeze([
    {name:'欠け鐘区',boss:'ヴァルド',title:'看板を賭ける金貸し',target:12,
      art:A+'valdo.jpg',feast:A+'feast-valdo-v3.png',portrait:A+'valdo-portrait.jpg',music:'guild',
      demand:'八千と看板だ。お前の勝負を見せろ。',reply:'看板は渡せません。今夜の勝負で決めましょう！',
      concession:'……読んだ上で、引き受けるか。ならば、その看板を残せ。',
      counters:['数字が足りん。やり直しだ。','まだ、証文の続きがある。','ここで看板を下ろすか？'],
      ally:'取り立ての噂',support:'客なら呼んだ。あとは、お前の勝負だ。'},
    {name:'仮面の町',boss:'シルヴィオ',title:'銀の面の英雄',target:16,
      art:A+'silvio.jpg',feast:A+'feast-silvio-v2.png',portrait:A+'silvio-portrait.jpg',music:'silvio',
      demand:'待たせたな！ 勝負だ。……何の勝負だった？',reply:'この興行の主催者を決める勝負です。今度は、同じ卓でお願いします！',
      concession:'見事だ！ 勝者の隣が、英雄の席だ。今、決めた。',
      counters:['それが掟だ！ ……掟を忘れた。','私の勝ちだ！ まだ終わっていない？','待て。英雄にも考える時間が要る。'],
      ally:'英雄の登場',support:'英雄が来たぞ！ ……入口は、こっちか？'},
    {name:'秤の商都',boss:'グラーノ',title:'すべてに値をつける商人',target:20,
      art:A+'grano.jpg',feast:A+'feast-grano-v2.png',portrait:A+'grano-portrait.jpg',music:'market',
      demand:'お嬢さん。そのギルド、丸ごと買いましょう。',reply:'売り物ではありません。でも、勝負なら受けます！',
      concession:'お嬢さんの判断は利得を超えていた。……隣で見せてもらいましょう。',
      counters:['数字は嘘をつかない。','商談不成立、ですな。','損切り。これも経営です。'],
      ally:'相場板の書き換え',support:'今夜の興行は、値が上がりますな。'}
  ].map(Object.freeze));
  const POWER=Object.freeze({cherry:2,bell:2,grape:3,watermelon:4,bar:6,seven_blue:8,seven_red:12});
  function create(){return {version:1,credit:1200,round:0,phase:'normal',pending:'welcome',crowd:0,trialLeft:0,applause:0,failures:0,nerve:6,remaining:12,dry:0,resolve:0,order:'',bonus:0,bonusWin:0,recruited:0,replay:false,games:0,clears:0,lastWin:0};}
  function valid(s){
    const phases={normal:['','welcome','trial'],trial:['','success','retryShow'],boss:['','intro','orders','retry','reward'],bonus:['','next','final'],complete:['']};
    return !!s&&s.version===1&&phases[s.phase]?.includes(s.pending)===true
      &&['credit','round','crowd','trialLeft','applause','failures','nerve','remaining','dry','resolve','bonus','bonusWin','recruited','games','clears','lastWin'].every(k=>Number.isSafeInteger(s[k])&&s[k]>=0)
      &&s.round<3&&s.crowd<=6&&s.trialLeft<=3&&s.applause<=4&&s.failures<=2&&s.nerve<=6
      &&s.remaining<=TOWNS[s.round].target&&s.dry<=4&&s.resolve<=3&&s.bonus<=10&&s.recruited<=3
      &&typeof s.replay==='boolean'&&['','rumor','tea'].includes(s.order);
  }
  function goal(s){return 3-s.failures;}
  function advance(s,action){
    const n={...s};
    if(action==='welcome'&&s.pending==='welcome')n.pending='';
    else if(action==='trial'&&s.pending==='trial'){n.phase='trial';n.pending='';n.trialLeft=3;n.applause=0;}
    else if(action==='success'&&s.pending==='success'){n.phase='boss';n.pending='intro';}
    else if(action==='retryShow'&&s.pending==='retryShow'){n.phase='trial';n.pending='';n.trialLeft=3;n.applause=0;n.failures=Math.min(2,s.failures+1);}
    else if(action==='intro'&&s.pending==='intro')n.pending='';
    else if(['rumor','tea'].includes(action)&&s.pending==='orders'){n.order=action;n.dry=0;n.pending='';}
    else if(action==='retry'&&s.pending==='retry'){n.nerve=6;n.remaining=s.remaining;n.resolve=Math.min(3,s.resolve+1);n.pending='intro';n.dry=0;n.order='';}
    else if(action==='reward'&&s.pending==='reward'){n.phase='bonus';n.pending='';n.bonus=10;n.bonusWin=0;}
    else if(action==='next'&&s.pending==='next'){Object.assign(n,{round:s.round+1,phase:'normal',pending:'welcome',crowd:0,trialLeft:0,applause:0,failures:0,nerve:6,remaining:TOWNS[s.round+1].target,dry:0,resolve:0,order:''});}
    else if(action==='final'&&s.pending==='final'){n.phase='complete';n.pending='';n.clears++;}
    else if(action==='restart'&&s.phase==='complete')return {...create(),credit:s.credit,games:s.games,clears:s.clears};
    else if(action==='refill'&&!s.pending&&s.phase!=='bonus'&&s.phase!=='complete'&&!s.replay&&s.credit<30)n.credit+=300;
    return n;
  }
  function settle(before,out){
    if(before.pending||before.phase==='complete')throw new Error('A command cannot settle a spin');
    if(!Number.isSafeInteger(out.payout)||out.payout<0)throw new Error('Invalid payout');
    const s={...before,games:before.games+1,lastWin:out.payout,credit:before.credit+out.payout,replay:!!out.replay};
    const r={state:s,kind:'miss',points:0,title:'次の一手へ',line:'今度は、どんな勝負にしましょう。',speaker:'ミミ'};
    if(s.phase==='normal'){
      r.points=out.payout>0?(['bar','seven_blue','seven_red'].includes(out.symbol)?3:2):1;
      s.crowd=Math.min(6,s.crowd+r.points);if(s.crowd===6)s.pending='trial';
      return {...r,kind:'crowd',title:s.pending?'お客が集まりました！':`客寄せ +${r.points}`,line:s.pending?'皆さん、席へどうぞ。そろそろ始めましょう！':['一人、また一人。通りの足が止まりました。','噂を聞いて、店の扉が開きました。','お茶のおかわりですね。……お客さんも増えています！'][s.games%3]};
    }
    if(s.phase==='trial'){
      r.points=out.replay?1:out.payout>0?2:0;s.trialLeft--;s.applause+=r.points;
      if(s.applause>=goal(s))s.pending='success';else if(!s.trialLeft)s.pending='retryShow';
      return {...r,kind:s.pending||'applause',title:s.pending==='success'?'大入り！':s.pending==='retryShow'?'もう一度、幕を開けよう。':`拍手 +${r.points}`,line:s.pending==='success'?`${TOWNS[s.round].boss}さんも、見ていましたね。次は私たちの勝負です！`:s.pending==='retryShow'?'演目を変えて、やってみましょう！':'最後の停止まで、見届けてください！'};
    }
    if(s.phase==='bonus'){
      s.bonus--;s.bonusWin+=out.payout;if(!s.bonus)s.pending=s.round===2?'final':'next';
      return {...r,kind:'bonus',title:out.payout?`配当 +${out.payout}`:'配当なし',line:['負けた方にも、お茶はありますよ。','さっきまで相手だったのに。隣の席、似合いますね。','お皿をもう一枚。仲間が増えましたから！'][s.games%3]};
    }
    if(out.replay)return {...r,kind:'replay',title:'REPLAY · もう一勝負',line:'この一手は引き分け。次のSPINは無料です。'};
    let points=out.payout>0?(POWER[out.symbol]||2)+s.resolve:0;
    if(s.order==='rumor'){points+=4;s.order='';r.kind='rumor';}
    else if(s.order==='tea'){s.nerve=Math.min(6,s.nerve+2);points=Math.max(1,points);s.order='';r.kind='tea';}
    if(points){
      r.points=Math.min(points,s.remaining);s.remaining-=r.points;s.dry=0;
      if(r.kind==='miss')r.kind='win';
      r.title=r.kind==='rumor'?'大きな噂が、届いた！':r.kind==='tea'?'お茶にしましょう。':'ミミの勝ち！';
      r.line=`決着まで、あと${s.remaining}点。${out.payout?'次の一手も、私たちの勝負です！':'助けは勝負の点数だけ。リール配当はありません。'}`;
      if(!s.remaining){s.pending='reward';s.recruited=Math.max(s.recruited,s.round+1);r.kind='recruit';r.title=`${TOWNS[s.round].boss}が仲間に！`;r.speaker=TOWNS[s.round].boss;r.line=TOWNS[s.round].concession;}
    }else{
      s.nerve--;s.dry=Math.min(4,s.dry+1);r.title='相手の勝ち';r.speaker=TOWNS[s.round].boss;r.line=TOWNS[s.round].counters[s.games%3];
      if(!s.nerve){s.pending='retry';r.title='仕切り直しましょう！';r.speaker='ミミ';r.line='看板は、まだ下ろしません。次こそ、やってみましょう！';}
      else if(s.dry===4)s.pending='orders';
    }
    return r;
  }
  return Object.freeze({TOWNS,POWER,create,valid,goal,advance,settle});
});
