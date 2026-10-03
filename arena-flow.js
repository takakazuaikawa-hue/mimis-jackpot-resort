/* Slot adaptation of mimi_secret_boss_arena. Reel money is separate from combat. */
(function(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.ArenaFlow = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function() {
  "use strict";
  const A = "./assets/arena/";
  const ALLIES = Object.freeze([
    { name: "ギドノゼアース", image: A + "gidonozeaas-v1.png", art: A + "gidonozeaas-starburst-v1.webp", move: "黒星" },
    { name: "ミナト", image: A + "minato-combat-ready-v1.png", move: "名もない剣" },
    { name: "丁零", image: A + "teirei-v1.png", move: "空欄命令" }
  ].map(Object.freeze));
  // Presentation cast only: selectable from the outset; no rarity or odds bonuses.
  const DIRECTIONS = [
    {technique:'一滴',role:'液状の一撃',effect:'droplet',tint:'#9ceee8',battleArt:A+'gido-battle-v1.png',entrance:'一滴で足りる。見ていろ。',attack:'一滴は、届いた。'},
    {technique:'名もない剣',role:'旅人の剣',effect:'slash',tint:'#a9dcff',battleArt:A+'minato-battle-v1.png',entrance:'今度は、自分で選んだ一歩です。',attack:'この剣で、帰り道をつなぎます。'},
    {technique:'点検光',role:'機構の走査',effect:'scan',tint:'#f7d994',battleArt:A+'teirei-battle-v1.png',entrance:'対象を確認。次の一手を待機。',attack:'走査完了。点検光、照射。'},
    {technique:'日暮れ',role:'薄暮の影',effect:'dusk',tint:'#aaa6ef',battleArt:A+'night-battle-v1.png',entrance:'灯りの向こうで、待っている。',attack:'日暮れが、届く。'},
    {technique:'指一本',role:'巨人の手加減',effect:'tap',tint:'#ffb4a3',battleArt:A+'peony-battle-v1.png',entrance:'力は、ちゃんと加減するからね。',attack:'指一本。大丈夫、狙いは外さない。'},
    {technique:'合鍵',role:'倉庫の扉',effect:'key',tint:'#f3da91',battleArt:A+'cassim-battle-v1.png',entrance:'必要な扉を、お開けしましょう。',attack:'合鍵なら、こちらに。'},
    {technique:'小波',role:'深海のうねり',effect:'tide',tint:'#83dfef',battleArt:A+'saza-battle-v1.png',entrance:'……少しだけ、波を立てる。',attack:'小さな波が、向こうへ届く。'},
    {technique:'反命',role:'聖職者の魔力',effect:'prayer',tint:'#f3c9ee',battleArt:A+'marian-battle-v1.png',entrance:'この力も、皆さんの一歩のために。',attack:'反命。祈りを、力へ。'},
    {technique:'肩越し',role:'視界の外',effect:'shadow',tint:'#c3c7df',battleArt:A+'ushiro-battle-v1.png',entrance:'……振り返らずに、いて。',attack:'……肩越しに、届いた。'},
    {technique:'第一決闘',role:'正面からの爪',effect:'claw',tint:'#ffc18b',battleArt:A+'wolf-battle-v1.png',entrance:'正面から行く。目を逸らすな。',attack:'第一決闘。その一手、受けてみろ。'},
    {technique:'扉を開く',role:'迷宮の入口',effect:'door',tint:'#cbb1ff',battleArt:A+'room-battle-v1.png',entrance:'入口はここ。帰りの出口も、残す。',attack:'扉を開く。今なら、届く。'},
    {technique:'空のコイン',role:'転生者の一投',effect:'coin',tint:'#f9d58b',battleArt:A+'rinne-battle-v1.png',entrance:'次の一手、見届けようか。',attack:'空のコイン。それでも、この一投は届く。'}
  ];
  const CAST = Object.freeze([
    ...ALLIES.map(a=>({...a,entrance:'仲間と、前へ。',attack:'この一撃を、つなぐ。'})),
    {name:'夜を食べるもの',image:A+'night-eater-v1.png',entrance:'夜の向こうまで、共に。',attack:'その影を、越えてゆく。'},
    {name:'ピオニー',image:A+'peony-v1.png',entrance:'大丈夫。ここは、私が支える。',attack:'みんなの道を、ひらくよ。'},
    {name:'カシム・ベル',image:A+'cassim-bell-v1.png',entrance:'この先の扉を、開けよう。',attack:'まだ見ぬ先へ、届け。'},
    {name:'さざなみ',image:A+'sazanami-v1.png',entrance:'静かな波も、いつか届く。',attack:'さあ、波を返そう。'},
    {name:'マリアン',image:A+'marian-v1.png',entrance:'最後まで、一緒にいます。',attack:'あなたの一歩を、支えます。'},
    {name:'うしろ',image:A+'ushiro-v1.png',entrance:'……ここに、いるよ。',attack:'……その先へ。'},
    {name:'ヴォルフ・ナイン',image:A+'wolf-nine-v1.png',entrance:'さあ、正面から行こう。',attack:'この一撃に、応えてみろ。'},
    {name:'十七号室',image:A+'room-seventeen-combat-ready-v1.png',entrance:'次の扉は、こちらです。',attack:'道を、開きましょう。'},
    {name:'リンネ',image:A+'rinne-v1.png',entrance:'私たちの出番ね。',attack:'今を、切りひらく！'}
  ].map((actor,i)=>Object.freeze({...actor,...DIRECTIONS[i]})));
  const BOSSES = Object.freeze([
    { name: "ピヨゼリー", title: "新人杯・盾を構える新人", hp: 8, bonus:0, image: A + "rookie-piyo-arena-v1.png", line: "ぴ、ぴよ！ 盾は下ろさない！", counter:'盾ごつん', concession:'ぴよ……！ もう震えてない。次の選手にも、声援を送る！' },
    { name: "コボルト見習い", title: "新人杯・借り物の大兜", hp: 8, bonus:0, image: A + "rookie-kobold-arena-v1.png", line: "兜は借り物でも、この一振りは自分のものだ！", counter:'木剣スラッシュ', concession:'負けた。けど、兜のせいにはしない。次はもっと速く動く！' },
    { name: "魔導コウモリ", title: "新人杯・教本を見ながら", hp: 10, bonus:0, image: A + "rookie-bat-arena-v1.png", line: "初級つむじ風……ええと、しおりはどこだっけ？", counter:'初級つむじ風', concession:'試合中に読んだページは、もう覚えたよ。裏ボスの席まで、応援する！' },
    { name: "アマラ", title: "裏ボス・天秤の裁定者", hp: 12, bonus:10, image: A + "amara-v1.png", line: "あなたたちの力、量らせてもらうわ。" },
    { name: "シャハル", title: "裏ボス・雲上の古竜", hp: 16, bonus:10, image: A + "shahar-combat-ready-v1.png", line: "小さき者よ。その一歩を見せてみよ。" },
    { name: "無銘", title: "裏ボス・名を持たぬ剣", hp: 20, bonus:10, image: A + "mumyo-v1.png", line: "言葉は要らない。次の一手で語れ。" }
  ].map(Object.freeze));
  function create() { return { version: 3, routeStart:0, credit: 1200, round: 0, hp: 6, enemy: 8, dry: 0, resolve: 0, order: "", phase: "normal", pending: "explore", explore:0, trialLeft:0, trialScore:0,trialsFailed:0, bonus: 0, bonusWin: 0, games: 0, clears: 0, lastWin: 0, replay: false }; }
  function baseValid(s,legacy=false) {
    return s && [s.credit,s.round,s.hp,s.enemy,s.dry,s.resolve,s.bonus,s.bonusWin,s.games,s.clears,s.lastWin].every(n => Number.isSafeInteger(n) && n >= 0)
      && s.round < (legacy?3:BOSSES.length) && s.hp <= 6 && s.enemy <= BOSSES[s.round+(legacy?3:0)].hp && s.dry <= 4 && s.resolve <= 3 && s.bonus <= 10
      && typeof s.replay === "boolean" && ["","strike","guard"].includes(s.order);
  }
  function valid(s) {
    if (!baseValid(s)) return false;
    const phases={normal:['','explore','trial'],trial:['','trialWin','trialFail'],battle:['','intro','orders','defeat','reward'],bonus:['','next','champion'],complete:['']};
    return s.version===3 && [0,3].includes(s.routeStart) && s.round>=s.routeStart && phases[s.phase]?.includes(s.pending) === true
      && [s.explore,s.trialLeft,s.trialScore,s.trialsFailed].every(n=>Number.isSafeInteger(n)&&n>=0)
      && s.explore<=6 && s.trialLeft<=3 && s.trialScore<=4 && s.trialsFailed<=2;
  }
  function migrate(s) {
    if(valid(s)) return {...s};
    if(![1,2].includes(s?.version) || !baseValid(s,true)) return null;
    if(s.version===1 && (!['battle','bonus','complete'].includes(s.phase)
      || !['','intro','orders','defeat','reward','next','champion'].includes(s.pending)))return null;
    const n={...s,version:3,routeStart:3,round:s.round+3,...(s.version===1?{explore:0,trialLeft:0,trialScore:0,trialsFailed:0}:{})};
    return valid(n)?n:null;
  }
  function trialTarget(s) { return 3-s.trialsFailed; }
  function advance(s, action) {
    const n = {...s};
    if (action === "explore" && n.pending === "explore") n.pending = "";
    else if (action === "trial" && n.pending === "trial") { n.phase='trial'; n.pending=''; n.trialLeft=3; n.trialScore=0; }
    else if (action === "trialWin" && n.pending === "trialWin") { n.phase='battle'; n.pending='intro'; }
    else if (action === "trialFail" && n.pending === "trialFail") { n.phase='normal'; n.pending='explore'; n.explore=0; n.trialsFailed=Math.min(2,n.trialsFailed+1); }
    else if (action === "intro" && n.pending === "intro") n.pending = "";
    else if (["strike","guard"].includes(action) && n.pending === "orders") { n.order = action; n.dry = 0; n.pending = ""; }
    else if (action === "defeat" && n.pending === "defeat") { n.hp = 6; n.enemy = BOSSES[n.round].hp; n.resolve = Math.min(3,n.resolve+1); n.pending = "intro"; n.order = ""; n.dry = 0; }
    else if (action === "reward" && n.pending === "reward") {
      if(!BOSSES[n.round].bonus)return advance({...n,phase:'bonus',pending:'next'},'next');
      n.phase = "bonus"; n.pending = ""; n.bonus = BOSSES[n.round].bonus; n.bonusWin = 0;
    }
    else if (action === "next" && n.pending === "next") { n.round++; n.hp = 6; n.enemy = BOSSES[n.round].hp; n.resolve = 0; n.dry = 0; n.order = ""; n.phase = n.round<3?'battle':'normal'; n.pending = n.round<3?'intro':'explore'; n.explore=0; n.trialLeft=0; n.trialScore=0; n.trialsFailed=0; }
    else if (action === "champion" && n.pending === "champion") { n.phase = "complete"; n.pending = ""; n.clears++; }
    else if (action === "restart" && n.phase === "complete") return {...create(), credit: n.credit, games: n.games, clears: n.clears};
    else if (action === "refill" && !n.pending && ["normal","trial","battle"].includes(n.phase) && !n.replay && n.credit < 30) n.credit += 300;
    return n;
  }
  function settle(state, out) {
    const s = {...state}; s.games++; s.lastWin = out.payout; s.credit += out.payout; s.replay = out.replay;
    let result = { state:s, actor:0, damage:0, kind:"miss", headline:"反撃！", line:"仲間の力をためよう。" };
    if(s.phase==='normal') {
      const points=out.payout>0?(['bar','seven_blue','seven_red'].includes(out.symbol)?3:2):1;
      s.explore=Math.min(6,s.explore+points); if(s.explore===6)s.pending='trial';
      return {...result,kind:'explore',headline:s.pending?'試練の扉へ':'仲間と、一歩。',line:`探索 +${points} → ${s.explore}/6。${out.replay?'次ゲーム無料。':out.payout?`配当 +${out.payout}。`:'配当なし。'}`};
    }
    if(s.phase==='trial') {
      const points=out.replay?1:out.payout>0?2:0;
      s.trialLeft--;s.trialScore+=points;
      if(s.trialScore>=trialTarget(s))s.pending='trialWin';else if(!s.trialLeft)s.pending='trialFail';
      const target=trialTarget(s);
      const line=s.pending==='trialWin'
        ? `試練 +${points} · 目標${target}ポイントに対し${s.trialScore}ポイント獲得。対決へ。${out.replay?'次ゲーム無料。':''}`
        : `試練 +${points} · ${s.trialScore}/${target}ポイント · 残り${s.trialLeft}G。${out.replay?'次ゲーム無料。':''}`;
      return {...result,kind:s.pending||'trial',headline:s.pending==='trialWin'?'扉が、ひらく。':s.pending==='trialFail'?'もう一度、力を合わせて。':'試練の一手',line};
    }
    if (s.phase === "bonus") { s.bonus--; s.bonusWin += out.payout; if (!s.bonus) s.pending = s.round === BOSSES.length-1 ? "champion" : "next"; return {...result,kind:"bonus",headline:out.payout ? `WIN +${out.payout}` : "配当なし",line:`勝利の祝宴、残り${s.bonus}G。`}; }
    if (out.replay) return {...result,kind:"replay",headline:"回避！ REPLAY",line:"攻撃をかわした！ 次のSPINは無料。指示と準備は持ち越し。"};
    let damage = out.payout > 0 ? ({cherry:2,bell:2,grape:3,watermelon:4,bar:6,seven_blue:8,seven_red:12}[out.symbol] || 2) + s.resolve : 0;
    result.actor = ["cherry","bell"].includes(out.symbol) ? 1 : out.symbol === "watermelon" ? 2 : 0;
    if (s.order === "strike") { damage += 4; result.actor = 0; s.order = ""; result.kind = "liberation"; }
    else if (s.order === "guard") { s.hp = Math.min(6,s.hp+2); damage = Math.max(1,damage); result.actor = 2; s.order = ""; result.kind = "guard"; }
    if (damage) {
      result.damage = Math.min(s.enemy,damage); s.enemy -= result.damage; s.dry = 0;
      if (result.kind === "miss") result.kind = "hit";
      result.headline = result.kind === "guard" ? "隔壁！" : result.kind === "liberation" ? "黒星、解放！" : ALLIES[result.actor].move;
      result.line = `${ALLIES[result.actor].name}の一撃！ ${BOSSES[s.round].name}に${result.damage}ダメージ。`;
      if (s.enemy === 0) { s.pending = "reward"; result.kind = "victory"; result.headline = "勝利！"; result.line = `${BOSSES[s.round].name}を突破！ ${BOSSES[s.round].bonus?'10Gの無料ボーナスへ。':'次の対決へ、仲間と進もう。'}`; }
    } else {
      s.hp--; s.dry = Math.min(4,s.dry+1);
      result.line = `相手の反撃。チームHP −1。${s.dry === 4 ? "ミミの指示で切り返そう！" : `ときめき ${s.dry}/4。`}`;
      if (!s.hp) { s.pending = "defeat"; result.headline = "立て直そう！"; result.line = "チームHPが0になった。力を合わせて、もう一度挑もう。"; }
      else if (s.dry === 4) s.pending = "orders";
    }
    return result;
  }
  return Object.freeze({ALLIES,CAST,BOSSES,create,valid,migrate,trialTarget,advance,settle});
});
