/* The silent animal mascot lives in image coordinates. Its finite gestures
 * suggest an ordinary path; only a deliberate follow click reaches routing. */
(function (root) {
  "use strict";
  // Grounded positions belong to the existing place plates. It stays
  // outside shops/private scenes and never covers a resident's face or a door.
  const GROUND = {
    arrival:[42,86,59,83], plaza:[40,85,64,85], galleria:[44,85,64,84],
    promenade:[39,87,55,83], lookout:[36,88,55,84], hotel:[38,87,53,83],
    pool:[45,89,59,88], harbor:[33,88,51,87], pier:[24,87,38,86],
    garden:[35,89,54,85], highland:[32,84,50,81], cove:[35,90,27,85],
    lounge:[30,88,40,87], town:[44,87,57,85]
  };
  // Two genuinely drawn four-pose gestures per sheet. Selection and visit
  // history live only here: they never consume the slot RNG or save a reward.
  const GESTURES = {
    wash:["groom",0,"前足でほっぺたを洗っています。",3400], scratch:["groom",4,"折れた耳の根元を、後ろ足でかいています。",2800],
    sniff:["curious",0,"鼻を近づけて、足元をくんくん調べています。",3200], listen:["curious",4,"左右へ耳を向けて、遠くの音を聞いています。",3500],
    stretch:["play",0,"前足を伸ばして、ゆっくり背伸びしています。",3700], earplay:["play",4,"自分の折れ耳をつかまえようとしています。",3000],
    wave:["coast",0,"揺れる水面を見て、小さな前足を引っ込めました。",3300], breeze:["coast",4,"風に耳を預けてから、ふるっと振っています。",3400],
    greet:["social",0,"こちらに気づいて、小さな前足を上げました。",2700], pat:["social",4,"ほっぺたを寄せて、目を細めています。",3700],
    yawn:["sleep",0,"小さくあくびをして、首を伸ばしています。",3800], nap:["sleep",4,"前足をしまい、丸くなってひと休みしています。",4200]
  };
  const HABITS = {
    cove:["wave","sniff","wash","listen"], harbor:["sniff","breeze","listen","stretch"], pier:["breeze","wave","listen","earplay"],
    garden:["sniff","wash","earplay","stretch"], highland:["breeze","listen","stretch","greet"], pool:["wave","stretch","wash","earplay"],
    promenade:["listen","breeze","sniff","greet"], lookout:["breeze","listen","yawn","stretch"],
    arrival:["greet","sniff","earplay","wash"], plaza:["greet","earplay","scratch","stretch"],
    town:["sniff","listen","greet","scratch"], galleria:["greet","wash","earplay","stretch"],
    hotel:["stretch","wash","yawn","scratch"], lounge:["yawn","nap","wash","stretch"]
  };
  // Native sheets remain untouched. Individual CSS windows register feet to
  // the same ground despite the generator's different row baselines.
  const SHEETS={
    groom:{split:443,feet:[434,434,434,434,854,854,854,854]},
    curious:{split:443,feet:[426,426,426,426,858,858,858,858]},
    play:{split:450,feet:[408,408,408,414,842,842,842,842]},
    coast:{split:462,feet:[458,458,458,458,850,850,850,850]},
    social:{split:450,feet:[442,442,443,444,861,861,861,861]},
    sleep:{split:510,feet:[497,498,498,498,847,850,839,839]}
  };
  function create({scene,read,onFollow}) {
    const host = document.createElement("div"); host.className="stay-trail-guide"; host.hidden=true;
    const animal = document.createElement("button"); animal.type="button"; animal.className="stay-trail-animal";
    animal.setAttribute("aria-label","小兎の見つけた道を見る"); animal.setAttribute("aria-expanded","false");
    animal.setAttribute("aria-controls","stayTrailHint");
    animal.innerHTML='<span class="stay-trail-shadow" aria-hidden="true"></span><span class="stay-trail-rabbit" aria-hidden="true"></span>';
    host.append(animal); scene.append(host);
    const rabbit=animal.querySelector(".stay-trail-rabbit"), shadow=animal.querySelector(".stay-trail-shadow");
    const bubble=document.createElement("div"); bubble.id="stayTrailHint"; bubble.className="stay-trail-hint";
    bubble.setAttribute("popover","auto"); bubble.setAttribute("role","group"); bubble.setAttribute("aria-label","小兎の見つけた道");
    bubble.innerHTML='<p data-trail-copy aria-live="polite"></p><div><button type="button" data-trail-follow></button><button type="button" data-trail-play>少し構ってみる</button><button type="button" data-trail-dismiss>今は寄り道する</button></div>';
    document.querySelector("#appRoot").append(bubble);
    const media=matchMedia("(prefers-reduced-motion: reduce)");
    let active=false, ready=false, awake=!document.hidden, reduced=false, signature="", hint=null, offer=null, ground=null;
    let motions=[], generation=0, pendingArrival=false, lastAttention=-Infinity, restTimer=0, place="", period="", visit=0, beats=0, reaction=0;
    const visits=new Map(), recent=[], packs=new Map();
    const image=new Image();
    // Native1774x887 atlas. Offset each row's viewing window rather than
    // slicing/redrawing the approved source. All grounded paws meet y82%.
    // The hop row begins below the seated silhouettes, so no neighbour leaks.
    const pose=index=>({backgroundSize:"400% 200%",clipPath:"none",backgroundPosition:`${(index%4)*100/3}% ${index<4?2.706:108.23}%`,transform:`translate(-6%,${index<4?-15.2:4}%)`});
    const frame=index=>{ rabbit.style.backgroundImage='url("'+image.src+'")';Object.assign(rabbit.style,pose(index)); };
    const blocked=()=>!awake || !!document.querySelector("dialog[open]:not(.stay-scenic)") || !document.querySelector("[data-world-conversation]").hidden || scene.hasAttribute("aria-busy");
    const still=()=>reduced || media.matches;
    function stop() {
      clearTimeout(restTimer); restTimer=0;
      generation++; for(const motion of motions)motion.cancel(); motions=[];
      if(ground){animal.style.left=ground[2]+"%";animal.style.top=ground[3]+"%";}
      frame(2); host.dataset.phase="waiting";
    }
    const scenic=()=>!!document.querySelector(".stay-scenic[open]");
    function chooseHabits() {
      const habits=(HABITS[place]||["greet","listen"]).slice();
      if(period==="night")habits.splice(1,0,"yawn","nap");
      else if(period==="sunset")habits.push("stretch","yawn");
      const start=(period==="night"?1+beats:visit-1+beats)%habits.length;
      return [...habits.slice(start),...habits.slice(0,start)].find(id=>!recent.slice(-2).includes(id))||habits[start];
    }
    function scheduleRest() {
      clearTimeout(restTimer);
      // A few quiet, separated beats per visit, never an endless animation.
      if(beats>=3 || host.hidden || still() || scenic() || host.dataset.phase!=="waiting" || bubble.matches(":popover-open"))return;
      restTimer=setTimeout(()=>{restTimer=0;if(!host.hidden && !blocked() && !scenic()){beats++;gesture(chooseHabits());}},10000+beats*6500);
    }
    function gesture(id) {
      const spec=GESTURES[id], pack=spec && packs.get(spec[0]);
      if(!pack?.ready || host.hidden || blocked() || scenic())return false;
      stop();recent.push(id);if(recent.length>6)recent.shift();host.dataset.gesture=id;
      rabbit.style.backgroundImage='url("'+pack.image.src+'")';
      const frames=[0,1,2,2,3].map((n,i)=>({...pack.pose(spec[1]+n),offset:[0,.2,.42,.72,1][i],easing:"steps(1,end)"}));
      if(still()){Object.assign(rabbit.style,pack.pose(spec[1]+2));host.dataset.phase="waiting";return true;}
      host.dataset.phase="gesture";const token=generation;
      const motion=rabbit.animate(frames,{duration:spec[3],fill:"forwards"});
      // Small continuous weight shifts bridge the authored silhouettes. Feet
      // stay at the registered origin; no rotation or bounce loop is added.
      const lean=["earplay","scratch","breeze"].includes(id)?2.5:0;
      const weight=rabbit.animate([{rotate:"0deg",scale:"1 1"},{rotate:-lean+"deg",scale:"1.015 .985",offset:.2},{rotate:lean+"deg",scale:".99 1.01",offset:.52},{rotate:"0deg",scale:"1 1"}],{duration:spec[3],easing:"ease-in-out"});
      motions=[motion,weight];
      motion.finished.then(()=>{if(token!==generation)return;motions=[];Object.assign(rabbit.style,pack.pose(spec[1]+3));motion.cancel();weight.cancel();host.dataset.phase="waiting";scheduleRest();}).catch(()=>{});
      return true;
    }
    function closeHint() { if(bubble.matches(":popover-open"))bubble.hidePopover(); offer=null; animal.setAttribute("aria-expanded","false"); }
    function animateArrival() {
      stop(); pendingArrival=false;
      if(still() || blocked() || !ready || !active)return;
      const token=generation, [x0,y0,x1,y1]=ground;
      animal.style.left=x0+"%";animal.style.top=y0+"%";host.dataset.phase="hopping";
      const locations=[{left:x0+"%",top:y0+"%",offset:0},{left:x0+"%",top:y0+"%",offset:.14}];
      for(let hop=0;hop<3;hop++) {
        const base=.14+hop*.27, fraction=(hop+.5)/3;
        locations.push({left:(x0+(x1-x0)*fraction)+"%",top:(y0+(y1-y0)*fraction-2.3)+"%",offset:base+.13});
        locations.push({left:(x0+(x1-x0)*(hop+1)/3)+"%",top:(y0+(y1-y0)*(hop+1)/3)+"%",offset:base+.27});
      }
      locations.push({left:x1+"%",top:y1+"%",offset:1});
      const timing={duration:2050,easing:"linear",fill:"forwards"};
      const travel=animal.animate(locations,timing);
      const frames=[{...pose(3),offset:0,easing:"steps(1,end)"}];
      for(let hop=0;hop<3;hop++)for(const [offset,index] of [[.14,4],[.2,5],[.27,6],[.35,7],[.4,4]]) {
        const time=offset+hop*.27;
        if(time<.95)frames.push({...pose(index),offset:time,easing:"steps(1,end)"});
      }
      frames.sort((a,b)=>a.offset-b.offset); frames.push({...pose(2),offset:.96,easing:"steps(1,end)"},{...pose(2),offset:1});
      const poses=rabbit.animate(frames,timing);
      const contact=shadow.animate([{opacity:.2},{opacity:.08,offset:.27},{opacity:.2,offset:.41},{opacity:.08,offset:.54},{opacity:.2,offset:.68},{opacity:.08,offset:.81},{opacity:.2}],timing);
      motions=[travel,poses,contact];
      travel.finished.then(()=>{if(token!==generation)return;stop();gesture(chooseHabits());scheduleRest();}).catch(()=>{});
    }
    function sync() {
      const visible=active && ready && ground && !blocked();
      host.hidden=!visible;
      if(!visible){closeHint();stop();return;}
      // A scenic reading keeps this same grounded animal in the same camera
      // coordinates. Do not paste another rabbit over the water/dialog.
      if(scenic()){closeHint();pendingArrival=false;stop();return;}
      if(still()){pendingArrival=false;stop();return;}
      if(pendingArrival)animateArrival();
      else if(!restTimer && host.dataset.phase==="waiting")scheduleRest();
    }
    function attention() {
      if(host.hidden || still() || scenic() || host.dataset.phase!=="waiting" || performance.now()-lastAttention<2400)return;
      lastAttention=performance.now();beats=0;stop(); const token=generation;
      if(gesture(["greet","earplay","listen","pat"][reaction++%4]))return;
      const motion=rabbit.animate([0,1,3,2].map((index,i)=>({...pose(index),offset:i/3,easing:"steps(1,end)"})),{duration:1050,fill:"forwards"});
      motions=[motion];motion.finished.then(()=>{if(token===generation)stop();}).catch(()=>{});
    }
    function showHint() {
      if(host.hidden || !hint || blocked())return;
      stop(); offer={action:hint.kind==="discover"?{type:"discover",id:hint.id}:{type:"move",to:hint.to},signature};
      bubble.querySelector("[data-trail-copy]").textContent=hint.copy;
      bubble.querySelector("[data-trail-follow]").textContent=hint.label;
      bubble.showPopover();animal.setAttribute("aria-expanded","true");
      const rect=animal.getBoundingClientRect(), width=bubble.offsetWidth;
      bubble.style.left=Math.max(16,Math.min(innerWidth-width-16,rect.left+rect.width/2-width/2))+"px";
      bubble.style.top=Math.max(90,rect.top-bubble.offsetHeight-12)+"px";
      bubble.querySelector("[data-trail-follow]").focus({preventScroll:true});
    }
    animal.addEventListener("pointerenter",attention);animal.addEventListener("focus",attention);
    animal.addEventListener("click",event=>{if(event.detail>1)return;bubble.matches(":popover-open")?closeHint():showHint();});
    animal.addEventListener("keydown",event=>{if(["Enter"," "].includes(event.key))event.stopPropagation();});
    bubble.addEventListener("keydown",event=>{if(["Escape","Enter"," "].includes(event.key))event.stopPropagation();});
    bubble.addEventListener("toggle",event=>{if(event.newState==="closed"){offer=null;animal.setAttribute("aria-expanded","false");scheduleRest();}});
    bubble.querySelector("[data-trail-dismiss]").addEventListener("click",()=>{closeHint();animal.focus({preventScroll:true});});
    bubble.querySelector("[data-trail-play]").addEventListener("click",()=>{
      beats=0;
      const id=["pat","earplay","greet","scratch","stretch","wash","listen","sniff"][reaction++%8];
      if(gesture(id)){bubble.querySelector("[data-trail-copy]").textContent=GESTURES[id][2];bubble.querySelector("[data-trail-play]").textContent="もう少し構ってみる";}
    });
    bubble.querySelector("[data-trail-follow]").addEventListener("click",event=>{
      if(event.detail>1 || !offer || offer.signature!==signature || blocked())return;
      const action=offer.action; closeHint(); onFollow(action,animal);
    });
    image.addEventListener("load",()=>{
      ready=true;host.style.setProperty("--trail-aspect",image.naturalWidth/image.naturalHeight/2);
      rabbit.style.backgroundImage='url("'+image.src+'")';sync();
    },{once:true});
    image.addEventListener("error",()=>{ready=false;sync();},{once:true});
    image.src="assets/resort-stay-v2/mimi-trail-rabbit-atlas-v4.png";
    for(const [name,layout] of Object.entries(SHEETS)) {
      const sheet=new Image(), pack={image:sheet,ready:false};packs.set(name,pack);
      sheet.addEventListener("load",()=>{
        pack.ready=true;
        pack.pose=index=>{
          const cell=sheet.naturalWidth/4, windowSize=512, col=index%4;
          const x=col*cell+cell*.56-windowSize/2, y=layout.feet[index]-windowSize*.82;
          const edgeTop=index<4?0:layout.split, edgeBottom=index<4?layout.split:sheet.naturalHeight;
          const inset=n=>Math.max(0,n/windowSize*100).toFixed(3)+"%";
          return {backgroundSize:`${sheet.naturalWidth/windowSize*100}% ${sheet.naturalHeight/windowSize*100}%`,
            backgroundPosition:`${x/(sheet.naturalWidth-windowSize)*100}% ${y/(sheet.naturalHeight-windowSize)*100}%`,
            clipPath:`inset(${inset(edgeTop-y)} ${inset(x+windowSize-(col+1)*cell)} ${inset(y+windowSize-edgeBottom)} ${inset(col*cell-x)})`,
            transform:"scale(.72)"};
        };
      },{once:true});
      sheet.src="assets/resort-stay-v2/mimi-trail-rabbit-"+name+"-v5.png";
    }
    new MutationObserver(sync).observe(document.querySelector("#appRoot"),{subtree:true,attributes:true,attributeFilter:["open"]});
    new MutationObserver(sync).observe(document.querySelector("[data-world-conversation]"),{attributes:true,attributeFilter:["hidden"]});
    new MutationObserver(()=>{reduced=read().settings.motion==="reduced";sync();}).observe(document.querySelector("#gameShell"),{attributes:true,attributeFilter:["class"]});
    new MutationObserver(()=>{if(scene.dataset.looking==="true")closeHint();sync();}).observe(scene,{attributes:true,attributeFilter:["aria-busy","data-looking"]});
    media.addEventListener("change",sync);
    document.addEventListener("visibilitychange",()=>{awake=!document.hidden;sync();});
    root.addEventListener("blur",event=>{if(event.target===root){awake=false;sync();}});
    root.addEventListener("focus",event=>{if(event.target===root){awake=!document.hidden;sync();}});
    root.addEventListener("resize",closeHint);
    root.addEventListener("pagehide",()=>{awake=false;sync();});
    root.addEventListener("pageshow",()=>{awake=!document.hidden;sync();});
    return {
      update({id,time,nextHint,motion}) {
        const nextSignature=id+":"+time;
        if(nextSignature!==signature){closeHint();stop();signature=nextSignature;pendingArrival=true;place=id;period=time;visit=(visits.get(id)||0)+1;visits.set(id,visit);beats=0;}
        // A discovery may change the offered route without replaying arrival.
        if(hint?.id!==nextHint?.id || hint?.to!==nextHint?.to)closeHint();
        ground=GROUND[id]?.slice()||null;hint=nextHint;reduced=motion==="reduced";
        host.dataset.place=id;host.dataset.time=time;host.dataset.destination=hint?.to||"";host.dataset.discovery=hint?.id||"";
        for(const button of scene.querySelectorAll("[data-trail-recommended]"))delete button.dataset.trailRecommended;
        const destination=hint && scene.querySelector(hint.kind==="discover"?'[data-world-discover="'+hint.id+'"]':'[data-world-move="'+hint.to+'"]');
        if(destination && ground){
          // Wait beside the actual recommended path, leaving its hit region
          // clear. The short rightward hop approaches that waiting point.
          const pathX=parseFloat(destination.style.left);
          if(Number.isFinite(pathX)){ground[2]=Math.max(28,Math.min(72,pathX+(pathX<=50?14:-14)));ground[0]=ground[2]-13;}
          destination.dataset.trailRecommended="true";
        }
        if(ground){
          // Recommended paths can share a foreground with another exit.
          // Keep every actual target center clear, not only the chosen path.
          const points=[...scene.querySelectorAll("[data-world-move],[data-world-talk],[data-world-discover]")].map(node=>[parseFloat(node.style.left),parseFloat(node.style.top)]);
          const pixels=animal.offsetWidth||Math.min(150,Math.max(92,scene.offsetWidth*.086));
          const preferred=ground[2], width=pixels/scene.offsetWidth*100, height=(animal.offsetHeight||pixels)/scene.offsetHeight*100;
          const choices=[preferred,preferred-12,preferred+12,preferred-24,preferred+24].map(x=>Math.max(28,Math.min(72,x)));
          ground[2]=choices.find(x=>points.every(([px,py])=>!Number.isFinite(px)||!Number.isFinite(py)||Math.abs(px-x)>width/2+2||py<ground[3]-height*.8-2||py>ground[3]+height*.2+2))??preferred;
          ground[0]=Math.max(22,ground[2]-13);
        }
        if(ground){animal.style.left=ground[2]+"%";animal.style.top=ground[3]+"%";}
        sync();
      },
      setActive(value){active=value;if(!value)pendingArrival=false;sync();},
      loading(){closeHint();stop();host.hidden=true;}
    };
  }
  root.MimiResortTrailGuide=Object.freeze({create});
})(window);
