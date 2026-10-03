/* Resolved story presentation only: no reel flags, money writes or random draws. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.GuildScenes=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const A='./assets/guild/';
  const frame=(art,label,title,text,value='',speaker='ミミ',cue='commandAdvance')=>({art,label,title,text,value,speaker,cue,actor:/mimi-(smile\.jpg|(?:worried|serious)-identity-v2\.png)$/.test(art)});
  // Slot adaptation of the original first chapter: these are reading beats,
  // not extra wagers, currency transactions or timed outcome effects.
  function story(id){
    if(typeof id!=='string')return [];
    const label=id==='homecoming'?'終幕 · 看板のある場所':id?.endsWith('-1')?'第二幕 · 屋根の上の英雄':id?.endsWith('-2')?'第三幕 · 売らない席':'第一幕 · まだない大会';
    const say=(who,art,text,value='')=>({...frame(A+art,label,who,text,value,who),actor:true});
    const scripts={
      'bell-chest':[
        frame(A+'bell-chest-encounter-v1.png','鐘楼からの先客','蓋の上に、ひとつ。','ノノ「鐘楼の下にあった箱です。帳面には、箱が一つ。でも……上にも何かいます。」','','ノノ'),
        frame(A+'bell-chest-encounter-v1.png','鐘楼からの先客','まずは、席を。','ミミ「先客がいるなら、開けません。この箱にも、机の端を使ってもらいましょう。」','','ミミ'),
        frame(A+'bell-chest-encounter-v1.png','鐘楼からの先客','数え直した席。','ノノ「人の数と、椅子の数は合ってます。……お茶碗は、一つ足しておきますね。」','','ノノ'),
        frame(A+'bell-chest-encounter-v1.png','鐘楼からの先客','今夜は、誰も立たせない。','ミミ「はい。看板も、箱も、皆さんの席も。この興行が終わるまで、ここにあります。」','この先は3Gの興行。箱の出来事で抽選・配当は変わりません。','ミミ')
      ],
      'opening-0':[
        say('ラッツ','ratts-portrait.jpg','ミミさん！ 優勝券を百枚売ったんです。大会は、まだ一度も開いてません！'),
        say('ミミ','mimi-worried-identity-v2.png','百枚……全員、優勝ですか？ それでは、勝った人が誰だか分かりません。'),
        say('ラッツ','ratts-portrait.jpg','大きく「優勝」と書いた方が売れるので。外のお客さんには、まだ内緒で。'),
        say('ミミ','mimi-serious-identity-v2.png','内緒にはしません。券を買った皆さんに説明して、本当に大会を開きましょう。'),
        say('ガルド','gardo-portrait-hand-v2.png','ならば王の出番だな。金はないが、椅子なら運べる。玉座も要るか？'),
        say('ミミ','mimi-smile.jpg','普通の椅子でお願いします、ガルドさん。……私の分は、最後でいいです。'),
        say('ラッツ','ratts-portrait.jpg','今度は券に「参加」と書きます。呼び込みも、俺がやりますよ。'),
        say('ミミ','mimi-smile.jpg','第一回ミミ杯、開幕です！ まずは皆さんに、席へ来てもらいましょう。','客寄せ6点 → 3Gの興行。勝負の配当は別に受け取れます。')
      ],
      'duel-0':[
        say('ヴァルド','valdo-portrait.jpg','客が入ったな。だが、机と看板は貸し物だ。お前、証文を読んだか。'),
        say('ミミ','mimi-worried-identity-v2.png','……読まずに押しました。八千Gって、机のお代だけではないんですね。'),
        say('ヴァルド','valdo-portrait.jpg','看板を守りたいなら、俺と勝負しろ。勝てば今夜の取り立ては待つ。借りまで消えるわけではないぞ。'),
        say('ミミ','mimi-serious-identity-v2.png','今度は、条件を読んでから。私が勝ったら、この机で興行を続けさせてください。'),
        say('ガルド','gardo-portrait-hand-v2.png','客席は俺が見ておく。主催者の椅子は、空けてあるぞ。'),
        say('ミミ','mimi-smile.jpg','ありがとうございます。ヴァルドさん、どうぞ席へ。第一回ミミ杯の、最後の勝負です！','勝負の目標12点。点数は借金返済額やCREDITとは別です。')
      ],
      'opening-1':[
        say('ノノ','nono-portrait.jpg','町じゅう走って探したよ。英雄は広場の屋根にいた！ でも、さっきから降りてこない。'),
        say('シルヴィオ','silvio-portrait.jpg','待たせたな！ 英雄の登場だ！ ……降りる階段は、どちらだ？'),
        say('ミミ','mimi-worried-identity-v2.png','先に上ったんですね。動かずに待っていてください。梯子を借りてきます。'),
        say('ノノ','nono-portrait.jpg','梯子はこっち！ 広場には、英雄を待ってる人がまだ大勢いるよ。'),
        say('ミミ','mimi-smile.jpg','それなら、待っている間に興行を。ノノさん、場所を知らせてもらえますか？'),
        say('ノノ','nono-portrait.jpg','任せて！ 今度は「英雄は屋根の上、興行は地面！」って呼んでくる。'),
        say('ミミ','mimi-serious-identity-v2.png','はい、どちらも本当です。椅子は広場へ並べましょう。','客寄せ6点 → 3Gの興行。拍手を集めて、英雄を迎えよう。')
      ],
      'duel-1':[
        say('シルヴィオ','silvio-portrait.jpg','無事、到着した！ 私の登場を待たずに始めるとは、見事な開幕だった！'),
        say('ミミ','mimi-smile.jpg','おかえりなさい。梯子を押さえていたので、拍手は片手だけでした。'),
        say('シルヴィオ','silvio-portrait.jpg','ならば次は私が受けよう。私に勝てば、君の興行を町じゅうに告げる。それが掟だ。今、決めた。'),
        say('ノノ','nono-portrait.jpg','銀の面の声なら、一度でみんなに届く。僕が走った道の向こうにも！'),
        say('ミミ','mimi-serious-identity-v2.png','私が勝ったら、主催者は私。次の興行でも、その約束を守ってくださいね。'),
        say('シルヴィオ','silvio-portrait.jpg','承知した！ ……負けた方の挨拶は、まだ練習していないな。','勝負の目標16点。勝てばシルヴィオが仲間に。')
      ],
      'after-1':[
        say('シルヴィオ','silvio-portrait.jpg','勝者はミミ！ 聞こえたか、町の者たちよ！ ……負けた方の挨拶も、できるものだな。'),
        say('ノノ','nono-portrait.jpg','遠くの通りからも返事がした！ 今日は、僕も最後まで座って見られたよ。'),
        say('ミミ','mimi-smile.jpg','ノノさんが最初に走ってくれたからです。お茶も、座って飲んでくださいね。'),
        say('シルヴィオ','silvio-portrait.jpg','次の町へも同行しよう。英雄の席は、君の隣だ！'),
        say('ミミ','mimi-worried-identity-v2.png','はい。でも、椅子の上には立たないでください。今度は梯子がありません。','シルヴィオが仲間に。これから10GはBET無料。')
      ],
      'opening-2':[
        say('マルメラ','marmela-portrait.jpg','香料商のマルメラです。荷が傷む前に売りたいのに、相場板に値が出るまで誰も買いません。'),
        say('ミミ','mimi-worried-identity-v2.png','では、待っているうちに……。食べ物の方は、先にいただいてはいけませんか？'),
        say('マルメラ','marmela-portrait.jpg','その顔で言われると、売る前になくなりそうですね。'),
        say('ベアトリクス','beatrix-portrait.jpg','公証人のベアトリクスです。まず荷を開けて、品と持ち主を確かめましょう。証書だけでは中身は分かりません。'),
        say('ミミ','mimi-serious-identity-v2.png','皆さんが見ている前で確かめましょう。品を並べる場所なら、うちの卓を使えます。'),
        say('マルメラ','marmela-portrait.jpg','それなら買い手にも来てもらわなくては。通りへ声をかけてきます。'),
        say('ミミ','mimi-smile.jpg','今夜は、商都の品も見せる興行にしましょう。……試食は、品を数えた後ですね。','客寄せ6点 → 3Gの興行。品を見届ける客を集めよう。')
      ],
      'duel-2':[
        say('グラーノ','grano-portrait.jpg','お久しぶりですな、お嬢さん。相場板を待たずに客を集めるとは。そのギルド、丸ごと買いましょう。'),
        say('ミミ','mimi-serious-identity-v2.png','売り物ではありません。荷の持ち主と買い手が、自分で決められる席にしたいんです。'),
        say('グラーノ','grano-portrait.jpg','ならば勝負で。私が勝てば、看板の買い取り交渉を。お嬢さんが勝てば、この席への値付けを取り下げます。'),
        say('ベアトリクス','beatrix-portrait.jpg','交渉することと、売ることは別です。勝敗で人や荷まで譲る約束は、ここにはありませんね。'),
        say('グラーノ','grano-portrait.jpg','ええ。品も持ち主も、勝手に売りませんな。条件は、その紙の通りです。'),
        say('ミミ','mimi-serious-identity-v2.png','読みました。今度は、最後の行まで。グラーノさん、この席を残すために勝負します。','勝負の目標20点。勝てばグラーノが仲間に。')
      ],
      'after-2':[
        say('グラーノ','grano-portrait.jpg','商談不成立、ですな。この看板の値札は外しましょう。お嬢さんの判断を、もう少し隣で見たくなりました。'),
        say('ベアトリクス','beatrix-portrait.jpg','約束の履行を確認しました。荷の売買も、それぞれの持ち主と買い手で決められます。'),
        say('マルメラ','marmela-portrait.jpg','荷は売れましたよ。傷む前に。こちらは売り物から取っておいた、皆さんの晩ご飯です。'),
        say('ミミ','mimi-smile.jpg','ありがとうございます！ 今度は、数える前に手を出しません。……お皿はもう持ってきました。'),
        say('グラーノ','grano-portrait.jpg','食べ始める判断は、ずいぶん早いですな。私の席も、お願いしましょう。','グラーノが仲間に。最後の10GもBET無料。')
      ],
      'homecoming':[
        say('ラッツ','ratts-portrait.jpg','おかえりなさい！ 看板、ちゃんと残してあります。「三人の大物、来店」って書いても？'),
        say('ヴァルド','valdo-portrait.jpg','今ここにいる。今度は、本当のことだけ書け。'),
        say('シルヴィオ','silvio-portrait.jpg','私も地面から入店した！ 次は入口を間違えない。'),
        say('グラーノ','grano-portrait.jpg','この席には値札を付けない約束ですな。代わりに、晩ご飯の値段を聞きましょう。'),
        say('ガルド','gardo-portrait-hand-v2.png','椅子は足りる。ミミの分も、最初から置いてあるぞ。'),
        say('ミミ','mimi-smile.jpg','では、今日は私も座ります。次の興行の話は、ご飯の後で。皆さん、いただきます！','三つの町の興行を終えて、ギルドへ帰還。')
      ],
      'after-0':[
        say('ラッツ','ratts-portrait.jpg','今度こそ、本物の優勝者だ！ ……百枚の券は、記念に持って帰ってもらいました。'),
        say('ミミ','mimi-worried-identity-v2.png','次からは、始める前に相談してくださいね。百人に説明するの、膝が震えました。'),
        say('ヴァルド','valdo-portrait.jpg','約束だ。看板は置いていけ。次の町でも勝負を開くなら、帳面の付け方ぐらいは教えてやる。'),
        say('ガルド','gardo-portrait-hand-v2.png','お茶が入ったぞ。今夜の椅子は、誰の分もある。'),
        say('ミミ','mimi-smile.jpg','では、ヴァルドさんもこちらへ。優勝のお祝いは、皆さんでいただきましょう！','ヴァルドが仲間に。これから10GはBET無料。')
      ]
    };
    return Object.prototype.hasOwnProperty.call(scripts,id)?scripts[id]:[];
  }
  function action(action,s,t){
    if(action==='trial'||action==='retryShow'){
      const retry=action==='retryShow',goal=3-s.failures;
      const text=retry?[
        `ラッツ、券を買ったお客さんは帰っていません。次は本当の大会にしましょう。`,
        `ノノ、広場のみんなはまだ待っています。次の演目で屋根の英雄を迎えましょう。`,
        `マルメラさん、買い手は荷のそばに残っています。次は品を見届けてもらいましょう。`
      ][s.round]:'三回の勝負で、客席の拍手を集めましょう。';
      return [frame(A+'crowd.jpg',retry?'次の演目':'興行開幕',retry?'皆さん、そのままお席で！':'さあ、今夜の演目を！',text,`残り3G ／ 拍手${goal}点で大入り`)];
    }
    if(action==='success'||action==='retry')return [frame(t.art,t.title,t.boss+'、勝負の席へ。',t.demand,`あと${s.remaining}点 ／ 粘り6${action==='retry'?' ／ 得点は持ち越し':''}`,t.boss),frame(A+'mimi-serious-identity-v2.png','ミミの返答','この勝負、引き受けます。',t.reply,`勝てば${t.boss}が仲間に ＋ 無料10G`)];
    if(action==='reward')return [frame(t.feast,'祝宴開幕','相手から、隣の席へ。','お皿をもう一枚。あなたの席も、ここですよ。','10GすべてBET無料','ミミ','bonus'),frame(t.feast,'新しい仲間',t.boss+'と、乾杯。',[
      '……茶代まで証文に入れるな。今夜は、俺が持つ。',
      '英雄の席はこちらだ！ ……お茶をこぼした。布巾はあるか？',
      'この席には、値札がありませんな。悪くない取引です。'
    ][s.round],'PUSHで無料ゲームへ',t.boss)];
    if(action==='final')return [frame(A+'homecoming-v2.png','三つの町を越えて','嘘つきたちに、乾杯。','看板も、お茶も、仲間の席も。全部、持って帰れましたね。',`仲間3人 ／ 最後の祝宴 ${s.bonusWin}`,'ミミ','crownComplete')];
    return [];
  }
  function settled(before,r,t,view){
    const s=r.state,pay=`リール配当 ${s.lastWin}`,score=`勝負 ＋${r.points}点 ／ 決着まで${s.remaining}点`;
    if(s.pending==='success')return [frame(A+'crowd.jpg','興行成功','大入り！',r.line,`拍手${s.applause}点 ／ 大物との勝負へ`,'ミミ','orderClear')];
    if(s.pending==='retryShow'){
      const nextGoal=Math.max(1,2-s.failures);
      const text=[
        `ラッツ、券を買ったお客さんは帰っていません。次は本当の大会にしましょう。`,
        `ノノ、広場のみんなはまだ待っています。次の演目で屋根の英雄を迎えましょう。`,
        `マルメラさん、買い手は荷のそばに残っています。次は品を見届けてもらいましょう。`
      ][s.round];
      return [frame(A+'mimi-worried-identity-v2.png','興行終了','演目を変えて、もう一度。',text,`拍手${s.applause}点 ／ 次の目標${nextGoal}点`)];
    }
    if(r.kind==='recruit')return [
      frame(A+'mimi-smile.jpg','最後の一手','この勝負、ミミの勝ち！',score,pay,'ミミ','orderClear'),
      frame(t.art,'決着 · '+t.boss,['証文が、閉じられる。','英雄が、席を譲る。','値札のつかない勝ち。'][s.round],t.concession,'勝負の目標達成',t.boss),
      frame(t.feast,'仲間入り',t.boss+'が仲間に！','勝負のあとは、一緒のテーブルです。お茶を淹れますね。','獲得：仲間1人 ＋ 10G無料の祝宴','ミミ','crownComplete')];
    if(s.pending==='retry')return [frame(t.art,'今回の勝負は敗北',t.boss+'の勝ち。',t.counters[s.games%3],`粘り 0 / 6 ／ ${pay}`,t.boss,'bossAttack'),frame(A+'mimi-serious-identity-v2.png','次の勝負へ','看板は、まだ下ろしません。',r.line,`得点持ち越し・あと${s.remaining}点 ／ 次の配当時＋${Math.min(3,s.resolve+1)}点`)];
    if(before.phase==='bonus'&&!s.bonus)return [frame(t.feast,'祝宴終了','ごちそうさまでした！','勝負の話は、道中でも。そろそろ出発しましょう。',`無料10Gの配当合計 ${s.bonusWin}`,'ミミ','orderClear')];
    if(r.kind==='rumor'||r.kind==='tea')return [frame(r.kind==='rumor'?A+'crowd.jpg':A+'mimi-smile.jpg','助けが届く',r.title,r.line,`${score} ／ ${pay}`)];
    if(['bar','blue','red'].includes(view.tier))return [frame(before.phase==='boss'?t.art:A+'crowd.jpg','リールの見せ場',view.title,view.effect,`WIN ＋${view.payout}`,'ミミ','hot')];
    return [];
  }
  function reaction(before,r,t){
    const s=r.state;
    if(before.phase==='trial'&&!s.pending){
      const points=r.points||0;
      const lines=[
        points>0
          ? [`ラッツ`,`ratts-portrait.jpg`,`おお、拍手が返ってきた！ 今度は本当に、大会らしくなってきましたね。`]
          : [`ラッツ`,`ratts-portrait.jpg`,`拍手、まだ静かですね。券を買った人たちに、最後まで見てもらいましょう。`],
        points>0
          ? [`ノノ`,`nono-portrait.jpg`,`拍手が広場の向こうまで届いたよ！ 屋根の英雄にも聞こえたかな。`]
          : [`ノノ`,`nono-portrait.jpg`,`広場はまだ静かだね。もう一度、屋根の英雄まで声を届けてくるよ。`],
        points>0
          ? [`マルメラ`,`marmela-portrait.jpg`,`品を見届ける拍手が届きましたね。荷も、皆さんの前で開けられます。`]
          : [`マルメラ`,`marmela-portrait.jpg`,`荷を囲む皆さんは静かですね。もう少し、品を見届けてもらいましょう。`]
      ][s.round];
      const [speaker,portrait,text]=lines;
      return {tone:'town',title:'演目の合間、客席から。',speaker,art:A+portrait,text};
    }
    if (before.phase==='normal' && !s.pending) {
      const incidents = [
        [
          ['ラッツ','ratts-portrait.jpg','今度の券には「参加」と書きました。優勝は、勝負の後に！'],
          ['ガルド','gardo-portrait-hand-v2.png','椅子を一つ追加だ。主催者の席も、忘れてはならんぞ。'],
          ['ミミ','mimi-smile.jpg','呼び込みだけで帰らないでくださいね。お茶は、座って飲みましょう。'],
          ['ラッツ','ratts-portrait.jpg','あの券を持ってきた人も来た！ 今夜は、最後まで見てもらいます。'],
        ],
        [
          ['ノノ','nono-portrait.jpg','広場の向こうまで声を届けてくる！ 椅子は、一つ空けておいてね。'],
          ['シルヴィオ','silvio-portrait.jpg','英雄は、まだ屋根の上だ！ ……梯子を押さえてくれるか？'],
          ['ミミ','mimi-smile.jpg','皆さん、英雄にも拍手を。今夜は、地面の席から見届けましょう。'],
          ['ノノ','nono-portrait.jpg','遠くの通りからも来てくれたよ。今度は僕も座って見られる！'],
        ],
        [
          ['マルメラ','marmela-portrait.jpg','荷はここへ。値が出るのを待つ間に、実物を見てもらいましょう。'],
          ['ベアトリクス','beatrix-portrait.jpg','証書だけでなく、中身と持ち主も。皆さんの前で確かめます。'],
          ['ミミ','mimi-worried-identity-v2.png','品の数を先に……はい。試食のお皿は、まだ置いておきます。'],
          ['マルメラ','marmela-portrait.jpg','客席から、買い手も来ました。興行が終わるまで、この荷はここに。'],
        ],
      ][s.round];
      const beat = before.phase === 'trial' ? Math.min(3, 3-before.trialLeft) : Math.min(3, Math.floor(before.crowd*2/3));
      const [speaker,portrait,text]=incidents[beat];
      return {tone:'town',title:before.phase==='trial'?'演目の合間、客席から。':'この町で、席が増えていく。',speaker,art:A+portrait,text};
    }
    if(before.phase==='boss'&&!s.pending&&!['tea','rumor'].includes(r.kind)){
      if(s.replay)return {tone:'hold',title:'この一手は、引き分け。',text:'次はBET無料。粘りも、用意した助けも、そのままです。',speaker:'ミミ'};
      if(r.points)return {tone:'hit',title:['証文に、一歩届いた。','英雄の一手を、上回った！','その値踏みを、越えて。'][s.round],text:[
        '……その手は認める。だが、残りの勘定はどうする。',
        'おお、見事だ！ ……拍手をしている場合ではなかった。',
        'お嬢さん、なかなか値の張る一手ですな。'
      ][s.round],speaker:t.boss};
      return {tone:'counter',title:['まだ、証文は閉じない。','英雄の番だ！','商人は、譲らない。'][s.round],text:r.line,speaker:t.boss};
    }
    if(before.phase==='bonus'&&s.bonus){
      const turn=10-s.bonus,lines=[
        [['ミミ','お砂糖は、いくつにします？'],[t.boss,'一つだ。……そこまで帳面につけるな。'],['ミミ','今夜の帳面は、おかわりの数だけです！']],
        [[t.boss,'英雄の乾杯を披露しよう！'],['ミミ','その前に、お茶碗を両手で持ってください。'],[t.boss,'それが掟だな。よし、覚えた！']],
        [[t.boss,'お嬢さん。このお茶の値段は？'],['ミミ','仲間のおかわりは、何杯でもどうぞ。'],[t.boss,'……商売になりませんな。もう一杯。']]
      ][s.round];
      const [speaker,text]=lines[(turn-1)%lines.length];return {tone:'feast',title:'勝負のあとは、同じテーブルで。',speaker,text};
    }
    return null;
  }
  function townArt(round){return [A+'mimi-opening-v2.png',A+'hero-plaza-arrival-v1.png',A+'merchant-market-arrival-v1.png'][round];}
  return Object.freeze({action,settled,reaction,story,townArt});
});
