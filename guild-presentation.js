/* Read-only descriptions of real state and visible reel windows. */
(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./slot-core.js'):root.SlotCore);if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.GuildPresentation=api;})(typeof globalThis!=='undefined'?globalThis:this,function(core){
  'use strict';
  function objective(s){
    const target=Math.max(1,3-s.failures),step=['normal','trial','boss','bonus','complete'].indexOf(s.phase);
    const states={
      normal:{title:`あと${6-s.crowd}点で興行が開幕`,detail:'配当で＋2点。BAR・7の配当なら＋3点！',reward:'興行成功 → 大物との勝負 → 無料10G'},
      trial:{title:`あと拍手${Math.max(0,target-s.applause)}点で大入り！`,detail:`残り${s.trialLeft}G。配当で＋2、REPLAYで＋1。`,reward:'大入りで、大物との勝負へ'},
      boss:{title:`あと${s.remaining}点で勝利！`,detail:s.order==='rumor'?'次の非REPLAYで、勝負の点数＋4。':s.order==='tea'?'次の非REPLAYで、粘り＋2・最低1点。':`配当役で攻めよう。粘りはあと${s.nerve}。`,reward:'勝利報酬　仲間入り ＋ 無料10G'},
      bonus:{title:`BET不要の祝宴　残り${s.bonus}G`,detail:`この祝宴で獲得した配当　${s.bonusWin}`,reward:'残りの無料ゲームで、さらに配当を狙おう'},
      complete:{title:'三人の大物が、仲間になった。',detail:'三つの町を巡る旅を達成。',reward:'嘘つきたちに、乾杯！'}
    };
    const o={...states[s.phase],step};
    const titles={welcome:'まずは、6点集めて店を満席に。',trial:'お客が集まった。3Gの興行へ！',success:'大入り達成！ 次は大物と勝負。',retryShow:'次の演目へ。客寄せ不要・拍手目標は最低1点。',intro:'この勝負に勝てば、無料10G。',orders:'噂で攻める？ お茶で粘る？',retry:'得点は残る。粘りを戻して再挑戦！',reward:'勝負に勝った！ 無料10G獲得。',next:'祝宴終了。次の町へ出発！',final:'最後の祝宴を完走！ ギルドへ帰ろう。'};
    if(titles[s.pending])o.title=titles[s.pending];
    return o;
  }
  function outcome(before,result,symbol){
    const s=result.state,role=core.SYMBOL_BY_ID.get(symbol),paid=s.lastWin>0;
    let effect='';
    if(before.phase==='normal')effect=`客寄せ ＋${s.crowd-before.crowd}　→　${s.crowd} / 6`;
    else if(before.phase==='trial')effect=`拍手 ＋${s.applause-before.applause}　→　${s.applause} / ${Math.max(1,3-s.failures)}`;
    else if(before.phase==='boss')effect=result.points?`勝負 ＋${result.points}点　→　勝利まであと${s.remaining}点`:s.replay?'粘りを減らさず、次の勝負へ':`粘り −1　→　残り${s.nerve}`;
    else effect=`祝宴の獲得配当　${s.bonusWin}　／　残り${s.bonus}G`;
    if(result.kind==='tea')effect+=`　粘り ${before.nerve}→${s.nerve}`;
    return {title:paid?`${role?.name||'図柄'}揃い！`:s.replay?'REPLAY · 次は無料！':'配当なし',effect,payout:s.lastWin,tier:paid?(symbol==='seven_red'?'red':symbol==='seven_blue'?'blue':symbol==='bar'?'bar':'win'):s.replay?'replay':'quiet',next:objective(s).title};
  }
  function anticipation(stopped){
    const known=stopped.map((n,c)=>n===null?null:c).filter(n=>n!==null);
    if(known.length!==2)return null;
    const windows=stopped.map((n,c)=>n===null?null:core.windowAt(c,n));
    const candidates=core.PAYLINES.flatMap(line=>{const cells=line.cells.filter(([c])=>stopped[c]!==null),ids=cells.map(([c,r])=>windows[c][r].id);return ids[0]===ids[1]?[{symbol:core.SYMBOL_BY_ID.get(ids[0]),cells}]:[];}).sort((a,b)=>b.symbol.pay-a.symbol.pay);
    if(!candidates.length)return null;
    const best=candidates[0];
    return {symbol:best.symbol.id,name:best.symbol.name,cells:candidates.filter(c=>c.symbol.id===best.symbol.id).flatMap(c=>c.cells),lastCol:stopped.findIndex(n=>n===null)};
  }
  return Object.freeze({objective,outcome,anticipation});
});
