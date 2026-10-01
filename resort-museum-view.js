/* Three connected exhibition rooms, and freely chosen close-up details.
 * Looking/walking inside the museum is ephemeral. Only remembering a work
 * crosses the existing atomic journey transaction; no new save schema. */
(function(root){
  "use strict";
  const ROOMS=Object.freeze({
    hall:{label:"中央展示室",exits:["sea"],copy:"アーチの奥にも展示が続いている。作品を近くで見るか、奥の部屋へ歩いてみよう。"},
    sea:{label:"海の展示室",image:"assets/resort-town-v1/museum-sea-room-v2.png",exits:["hall","table"],copy:"舟の絵のそばに、同じ舟の模型。右の扉の向こうは、島の暮らしの展示室。"},
    table:{label:"暮らしの展示室",image:"assets/resort-town-v1/museum-table-room-v2.png",exits:["sea","hall"],copy:"食卓の絵と、使い込まれた椅子。ここでは、暮らしの道具も作品の隣に置かれている。"}
  });
  function create({read,transact,scene,refresh,caption,onDialogue}) {
    const world=root.MimiResortWorld,app=document.querySelector("#appRoot");
    let room="hall",work=null,invoker=null,sequence=0,seen=new Set();
    const dialog=document.createElement("dialog");dialog.className="stay-museum-work";
    dialog.setAttribute("aria-labelledby","museumWorkName");
    dialog.innerHTML='<header><div><p data-museum-medium></p><h2 id="museumWorkName"></h2></div><button type="button" data-museum-close>展示室に戻る ×</button></header><div class="stay-museum-art-window"><div class="stay-museum-art"><img alt=""><div data-museum-details></div></div><div class="stay-museum-art-loading" role="status"><p></p><button type="button" data-museum-retry hidden>作品を再読み込み</button></div></div><section class="stay-museum-reading"><p class="stay-museum-eyebrow">気になるところから</p><h3 data-museum-detail-name>作品に近づいて</h3><p data-museum-copy aria-live="polite"></p><button type="button" data-museum-whole hidden>作品全体へ</button><div data-museum-found></div><p data-museum-connection></p><p data-museum-status role="status"></p><button type="button" data-museum-remember></button></section>';
    app.append(dialog);
    const art=dialog.querySelector(".stay-museum-art"),image=art.querySelector("img"),points=dialog.querySelector("[data-museum-details]"),loading=dialog.querySelector(".stay-museum-art-loading"),remember=dialog.querySelector("[data-museum-remember]"),whole=dialog.querySelector("[data-museum-whole]"),found=dialog.querySelector("[data-museum-found]");
    const media=matchMedia("(prefers-reduced-motion: reduce)");
    let timer=0;
    function stop(){art.getAnimations().forEach(a=>a.cancel());}
    function focusDetail(index){
      if(!work || loading.hidden===false)return;
      const detail=work.details[index];if(!detail)return;
      const start=getComputedStyle(art).transform;stop();
      // Bring the detail toward the middle, bounded by the artwork edges.
      // Keep the image and its markers together; do not reveal empty margins.
      const shift=detail.point.map(n=>Math.max(-42.5,Math.min(42.5,(50-n)*1.85)));
      const transform="translate("+shift[0]+"%,"+shift[1]+"%) scale(1.85)";
      art.style.transformOrigin="50% 50%";art.style.transform=transform;art.dataset.detailFocus="true";
      if(!media.matches && read().settings.motion!=="reduced")art.animate([{transform:start},{transform}],{duration:600,easing:"ease-out"}).finished.catch(()=>{});
      dialog.querySelector("[data-museum-detail-name]").textContent=detail.label;
      dialog.querySelector("[data-museum-copy]").textContent=detail.copy;whole.hidden=false;seen.add(index);
      found.replaceChildren();
      for(const i of seen){const b=document.createElement("button");b.type="button";b.textContent=work.details[i].label;b.dataset.museumFound=i;b.addEventListener("click",()=>focusDetail(i));found.append(b);}
      onDialogue?.("作品の細部",detail.copy);
    }
    function all(){stop();art.style.transform="none";delete art.dataset.detailFocus;whole.hidden=true;if(work){dialog.querySelector("[data-museum-detail-name]").textContent="作品に近づいて";dialog.querySelector("[data-museum-copy]").textContent=work.opening;}}
    function load(){
      clearTimeout(timer);const token=++sequence;
      loading.hidden=false;points.hidden=true;remember.disabled=true;
      loading.querySelector("p").textContent="作品を準備しています…";loading.querySelector("button").hidden=true;
      const fail=()=>{if(token!==sequence || !dialog.open)return;clearTimeout(timer);loading.querySelector("p").textContent="作品を読み込めませんでした。再読み込みできます。";loading.querySelector("button").hidden=false;};
      image.onerror=fail;image.onload=async()=>{try{await image.decode();}catch(_){fail();return;}if(token!==sequence || !dialog.open)return;clearTimeout(timer);loading.hidden=true;points.hidden=false;remember.disabled=false;};
      timer=setTimeout(fail,15000);image.src=work.image;
    }
    function cleanup(){
      if(!work)return;
      sequence++;clearTimeout(timer);stop();image.onload=image.onerror=null;
      work=null;delete app.dataset.museumArt;const target=invoker;invoker=null;refresh();
      if(target?.isConnected)target.focus({preventScroll:true});
      else scene.querySelector('[data-world-discover="'+dialog.dataset.work+'"]')?.focus({preventScroll:true});
    }
    function close(){if(dialog.open){dialog.close();cleanup();}}
    dialog.querySelector("[data-museum-close]").addEventListener("click",close);
    dialog.addEventListener("cancel",event=>{event.preventDefault();close();});
    dialog.addEventListener("close",()=>{if(!dialog.open)cleanup();});
    dialog.addEventListener("keydown",e=>{if(["Escape","Enter"," ","ArrowLeft","ArrowRight","ArrowUp","ArrowDown"].includes(e.key))e.stopPropagation();});
    whole.addEventListener("click",all);dialog.querySelector("[data-museum-retry]").addEventListener("click",load);
    remember.addEventListener("click",event=>{
      if(event.detail>1 || !work)return;
      const current=world.museumMoment(read().stay,work.id),status=dialog.querySelector("[data-museum-status]");
      if(!current || current.context!==work.context){status.textContent="場所や時間が変わりました。展示室から、もう一度作品を開いてください。";return;}
      if(current.remembered){close();return;}
      const result=transact(draft=>world.finishMuseum(draft,work.id,work.context));
      if(!result.ok){status.textContent=result.message;return;}
      close();caption.textContent="『"+current.title+"』を旅の記憶に残した。";
    });
    root.addEventListener("blur",stop);root.addEventListener("pagehide",stop);
    document.addEventListener("visibilitychange",()=>{if(document.hidden)stop();});media.addEventListener("change",stop);
    function point(actions,spatial,text,data,rect,kind="detail"){
      const b=document.createElement("button");b.type="button";b.className="stay-world-target";b.textContent=text;Object.assign(b.dataset,data);
      b.dataset.openAir="true";actions.append(b);spatial(b,kind);b.dataset.pointRegion="true";
      b.style.left=rect[0]+"%";b.style.top=rect[1]+"%";b.style.setProperty("--point-width",rect[2]+"%");b.style.setProperty("--point-height",rect[3]+"%");
      if(kind==="exit")b.dataset.direction=rect[0]<30?"left":"right";
    }
    return {
      sync(location){if(location!=="museum"){close();room="hall";delete scene.dataset.museumRoom;}else scene.dataset.museumRoom=room;},
      get room(){return room;},get label(){return ROOMS[room].label;},get plate(){return ROOMS[room].image;},get copy(){return ROOMS[room].copy;},get active(){return dialog.open;},
      move(to){if(dialog.open || scene.hasAttribute("aria-busy") || read().stay.journey.location!=="museum" || !ROOMS[room].exits.includes(to))return;room=to;refresh();},
      decorate(actions,spatial){
        if(room==="hall"){point(actions,spatial,"海の展示室へ",{museumRoom:"sea"},[39,55,15,30],"exit");return;}
        actions.replaceChildren();
        point(actions,spatial,room==="sea"?"中央展示室へ":"海の展示室へ",{museumRoom:room==="sea"?"hall":"sea"},[9,52,15,49],"exit");
        point(actions,spatial,room==="sea"?"暮らしの展示室へ":"中央展示室へ",{museumRoom:room==="sea"?"table":"hall"},[89,52,15,49],"exit");
        const id=room==="sea"?"museum-boat":"museum-table";
        point(actions,spatial,"『"+world.MUSEUM_WORKS[id].title+"』に近づく",{worldDiscover:id},room==="sea"?[56,39,37,34]:[49,37,34,34]);
        if(room==="sea")point(actions,spatial,"舟の模型を眺める",{museumObject:"model"},[25,56,14,18]);
        else {point(actions,spatial,"椅子を見てみる",{museumObject:"chair"},[24,76,16,30]);point(actions,spatial,"食卓の道具を見る",{museumObject:"bowl"},[81,70,24,19]);}
      },
      inspect(id){
        const copy=room==="sea"&&id==="model"?"模型には、絵と同じ青い船首と高い帆柱がある。小さくしても、船をつなぐロープまで省いていない。絵の中でも探してみよう。":room==="table"&&id==="chair"?"編んだ座面の端だけが、少し白く擦れている。飾るための椅子ではなく、誰かが使ってきた椅子。絵の手前にも、よく似た席がある。":room==="table"&&id==="bowl"?"青い模様の大皿と、粉の残ったパンの板。絵の食卓にも、同じ青い縁が見える。暮らしの中の道具が、そのまま絵の中へ続いている。":"";
        if(copy){caption.textContent=copy;onDialogue?.("展示室で見つけたもの",copy);}
      },
      open(id,source){
        if(dialog.open || document.querySelector("dialog[open]") || scene.hasAttribute("aria-busy"))return false;
        const data=world.museumMoment(read().stay,id);if(!data)return false;
        work=data;invoker=source;seen=new Set();dialog.dataset.work=id;app.dataset.museumArt="true";
        dialog.querySelector("h2").textContent="『"+work.title+"』";dialog.querySelector("[data-museum-medium]").textContent=work.medium;
        dialog.querySelector("[data-museum-connection]").textContent=work.connection;dialog.querySelector("[data-museum-status]").textContent="";
        remember.textContent=work.remembered?"展示室に戻る":"この作品を旅の記憶に残す";image.alt="『"+work.title+"』の作品全体";
        found.replaceChildren();points.replaceChildren();
        work.details.forEach((detail,i)=>{const b=document.createElement("button");b.type="button";b.className="stay-museum-detail";b.setAttribute("aria-label",detail.label);b.style.left=detail.point[0]+"%";b.style.top=detail.point[1]+"%";b.dataset.museumDetail=i;const label=document.createElement("span");label.textContent=detail.label;b.append(label);b.addEventListener("click",()=>focusDetail(i));points.append(b);});
        all();dialog.showModal();load();dialog.querySelector("[data-museum-close]").focus({preventScroll:true});return true;
      },close
    };
  }
  root.MimiResortMuseumView=Object.freeze({create});
})(window);
