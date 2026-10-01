(function () {
  "use strict";
  const catalog = window.MimiMachineCatalog;
  const requested = new URLSearchParams(location.search);
  const selected = requested.get("machine");
  let selectedId = catalog.some(entry=>entry.id === selected) ? selected : "jackpot";
  let floorZone = 1, disposeFloor = null;
  const shortNames = {jackpot:"ジャックポット","dragon-race":"ドラゴンレース",stadium:"スタジアム",arena:"闘技場",guild:"ギルド"};
  function node(tag, className, value) {
    const result = document.createElement(tag); result.className = className;
    if (value) result.textContent = value;
    return result;
  }
  function initialView(fallback) {
    if (selected && !catalog.some(entry => entry.id === selected)) return "machines";
    const view = requested.get("view");
    return ["title", "home", "machines", "shop", "slot"].includes(view) ? view : fallback;
  }
  function mount() {
    const view = document.querySelector('[data-view="machines"]');
    if (view.querySelector(".machine-lobby-layout")) return;
    const layout = node("div", view.hasAttribute("data-casino-floor") ? "machine-lobby-layout casino-floor-layout" : "machine-lobby-layout");
    for (const element of [...view.children]) if (!element.classList.contains("route-backdrop")) layout.append(element);
    view.append(layout);
    if (!view.hasAttribute("data-casino-floor")) {
      const fit = () => layout.style.setProperty("--lobby-scale", Math.min(view.clientWidth / 1280, view.clientHeight / 720));
      new ResizeObserver(fit).observe(view); fit();
    }
    document.addEventListener("click", event => {
      const route = event.target.closest("[data-route]")?.dataset.route;
      if (!route) return;
      queueMicrotask(() => {
        // 回転中などで遷移を断られた場合、URLだけを先に切り替えない。
        const actual = document.querySelector(".app-view.is-active")?.dataset.view;
        if (!actual) return;
        const url = new URL(location.href); url.searchParams.set("view", actual);
        history.replaceState(null, "", url);
        if (actual !== "machines" || route !== "machines") return;
        const grid = document.querySelector(".machine-lobby-grid");
        if (grid) { grid.scrollTop = 0; (grid.querySelector('[data-machine-select][aria-pressed="true"]') || grid.querySelector("a,button:not(:disabled)"))?.focus({ preventScroll: true }); }
      });
    });
  }
  function renderFloor(carousel,legacyActions,legacyArchive,selectAttribute="machineSelect") {
    carousel.replaceChildren(); carousel.className = "machine-carousel machine-lobby-grid casino-selection";
    carousel.removeAttribute("role"); carousel.setAttribute("aria-label","カジノの台選択");
    const stage=node("section","casino-selected-machine"); stage.setAttribute("aria-labelledby","casinoSelectedTitle");
    const cabinet=node("figure","casino-preview-cabinet"); cabinet.setAttribute("aria-label","選んだ台の外観");
    const picture=node("div","casino-preview-screen"),art=node("img","casino-preview-art"),logo=node("img","casino-preview-logo"); art.alt="";logo.alt="";picture.append(art,logo);
    const frame=node("img","casino-preview-frame");frame.src="assets/casino-loop-v5/slot-selection-cabinet-v1.png";frame.alt="";cabinet.append(picture,frame);
    const detail=node("div","casino-selection-detail"),heading=node("h3","");heading.id="casinoSelectedTitle";
    const description=node("p","casino-selected-description"),theme=node("p","casino-selected-theme"),play=node("div","casino-play-actions");
    detail.append(heading,description,theme,play);
    if(legacyArchive){const archive=node("details","casino-history");archive.append(node("summary","","やり込みの記録"),legacyArchive);detail.append(archive);}
    stage.append(cabinet,detail);
    const picker=node("nav","casino-machine-picker");picker.setAttribute("aria-labelledby","casinoPickerHeading");
    const label=node("h3","","台を選ぶ");label.id="casinoPickerHeading";
    const rail=node("div","casino-machine-rail");picker.append(label,rail);
    const buttons=[];
    const choose=id=>{
      const entry=catalog.find(candidate=>candidate.id===id);if(!entry)return;
      selectedId=id;carousel.dataset.selectedMachine=id;
      heading.replaceChildren(node("span","casino-title-prefix",entry.title.startsWith("ミミの")?"ミミの":""),node("span","casino-title-name",entry.title.replace(/^ミミの/,"")));
      description.textContent=entry.description;theme.textContent=entry.tag;
      art.src=entry.image;logo.hidden=!entry.logo;if(entry.logo)logo.src=entry.logo;else logo.removeAttribute("src");
      cabinet.dataset.machine=id;art.style.objectPosition=id==="guild"?"left center":"center 25%";
      play.replaceChildren();
      if(entry.legacy && legacyActions){
        legacyActions.classList.add("casino-play-legacy");
        legacyActions.querySelectorAll("[data-machine]").forEach(button=>{button.textContent="この台で遊ぶ";button.dataset.route="slot";button.setAttribute("aria-label",entry.title+"の台で遊ぶ");});
        play.append(legacyActions);
      }else if(entry.status==="available"){
        const link=node("a","","この台で遊ぶ");link.href=entry.href;link.setAttribute("aria-label",entry.title+"の台で遊ぶ");play.append(link);
      }else{const button=node("button","","準備中");button.disabled=true;play.append(button);}
      buttons.forEach(button=>button.setAttribute("aria-pressed",String(button.dataset[selectAttribute]===id)));
      detail.querySelector(".casino-history")?.toggleAttribute("hidden",!entry.legacy);
    };
    catalog.forEach(entry=>{
      const button=node("button","");button.type="button";button.dataset[selectAttribute]=entry.id;
      const thumbnail=node("img","");thumbnail.src=entry.image;thumbnail.alt="";
      button.append(thumbnail,node("span","",shortNames[entry.id]||entry.title));
      button.setAttribute("aria-label",entry.title+"を選ぶ");button.addEventListener("click",()=>choose(entry.id));rail.append(button);buttons.push(button);
    });
    rail.addEventListener("keydown",event=>{
      const current=buttons.indexOf(event.target);if(current<0)return;
      let index=current;
      if(["ArrowRight","ArrowDown"].includes(event.key))index=(current+1)%buttons.length;
      else if(["ArrowLeft","ArrowUp"].includes(event.key))index=(current-1+buttons.length)%buttons.length;
      else if(event.key==="Home")index=0;else if(event.key==="End")index=buttons.length-1;else return;
      event.preventDefault();buttons[index].focus();choose(buttons[index].dataset[selectAttribute]);
    });
    carousel.append(stage,picker);choose(selectedId);
  }
  function renderSpatialFloor(carousel, legacyActions, legacyArchive) {
    disposeFloor?.();
    carousel.replaceChildren(); carousel.className="machine-carousel machine-lobby-grid casino-walk";
    carousel.removeAttribute("role"); carousel.setAttribute("aria-label","カジノフロアを巡る");
    const viewport=node("div","casino-walk-viewport"),scene=node("div","casino-walk-scene");
    viewport.tabIndex=0; viewport.setAttribute("role","group");viewport.setAttribute("aria-label","カジノの台。左右のキーで列を移動、台を選ぶと近づきます");
    const plate=node("img","casino-walk-plate");plate.alt="";scene.append(plate);viewport.append(scene);
    const objectButtons=new Map(), order=["dragon-race","arena","jackpot","stadium","guild"];
    for(const id of order){
      const entry=catalog.find(machine=>machine.id===id),button=node("button","casino-walk-object");
      button.type="button";button.dataset.machineSelect=id;button.setAttribute("aria-label",entry.title+"に近づく");
      const cabinet=node("span","casino-walk-cabinet"),picture=node("span","casino-preview-screen");
      const art=node("img","casino-preview-art");art.src=entry.image;art.alt="";art.style.objectPosition=id==="guild"?"left center":"center 25%";picture.append(art);
      if(entry.logo){const logo=node("img","casino-preview-logo");logo.src=entry.logo;logo.alt="";picture.append(logo);}
      const frame=node("img","casino-preview-frame");frame.src="assets/casino-loop-v5/slot-selection-cabinet-v1.png";frame.alt="";
      cabinet.append(picture,frame);button.append(cabinet,node("span","casino-walk-name",shortNames[id]));
      scene.append(button);objectButtons.set(id,button);button.addEventListener("click",()=>approach(id,button));
      button.addEventListener("focus",()=>{
        if(!button.matches(":focus-visible"))return;
        const box=button.getBoundingClientRect(),bounds=viewport.getBoundingClientRect();
        if(box.left<bounds.left || box.right>bounds.right)moveZone(id==="jackpot"?1:["dragon-race","arena"].includes(id)?0:2);
      });
    }
    const hud=node("nav","casino-walk-controls");hud.setAttribute("aria-label","フロアの移動");
    const hint=node("p","casino-walk-hint","台に近づく · 左右のキーで移動"),paths=node("div","casino-walk-paths");
    const zoneNames=["左の列","中央の台","右の列"],zoneButtons=[];
    ["← 左の列へ","中央へ","右の列へ →"].forEach((label,index)=>{
      const button=node("button","casino-walk-path",label);button.type="button";button.dataset.floorZone=String(index);
      button.addEventListener("click",()=>moveZone(index));zoneButtons.push(button);paths.append(button);
    });
    const current=node("p","casino-walk-location");current.setAttribute("aria-live","polite");
    const quickOpen=node("button","casino-walk-quick-open","台をすぐ選ぶ");quickOpen.type="button";quickOpen.dataset.floorQuickOpen="";
    hud.append(hint,paths,current,quickOpen);
    const dialog=node("dialog","casino-approach");dialog.setAttribute("aria-labelledby","casinoSelectedTitle");
    const head=node("header","casino-approach-header"),back=node("button","casino-approach-back","← フロアへ戻る");back.type="button";back.dataset.floorBack="";
    head.append(node("p","","台の前"),back);
    const detailHost=node("div","");renderFloor(detailHost,legacyActions,legacyArchive,"previewMachineSelect");
    dialog.append(head,detailHost);
    const quick=node("dialog","casino-quick-dialog");quick.setAttribute("aria-labelledby","casinoQuickHeading");
    const quickHeader=node("header",""),quickHeading=node("h3","","台をすぐ選ぶ"),quickClose=node("button","","フロアへ戻る ×");
    quickHeading.id="casinoQuickHeading";quickClose.type="button";quickClose.dataset.floorQuickClose="";quickHeader.append(quickHeading,quickClose);quick.append(quickHeader);
    for(const entry of catalog){const button=node("button","casino-quick-choice");button.type="button";button.dataset.floorQuick=entry.id;
      const art=node("img","");art.src=entry.image;art.alt="";button.append(art,node("span","",entry.title));
      button.addEventListener("click",()=>{quick.close();const zone=entry.id==="jackpot"?1:["dragon-race","arena"].includes(entry.id)?0:2;moveZone(zone);approach(entry.id,objectButtons.get(entry.id));});quick.append(button);
    }
    let opener=null, motion=null, alive=true, foreground=true, sceneVersion=0;
    const media=matchMedia("(prefers-reduced-motion: reduce)"),reduced=()=>media.matches||document.querySelector("#gameShell")?.classList.contains("reduced-motion");
    const stop=()=>{motion?.cancel();motion=null;};
    const pause=()=>{foreground=false;stop();},resume=()=>{foreground=true;};
    function fit(){viewport.style.setProperty("--floor-width",Math.max(viewport.clientWidth,viewport.clientHeight*1.7778)+"px");}
    function moveZone(zone, animate=true){
      if(!alive || zone<0 || zone>2)return;
      const previous=floorZone;floorZone=zone;carousel.dataset.floorZone=String(zone);scene.dataset.zone=String(zone);stop();
      const sources=["assets/casino-loop-v5/slot-walk-left-v1.png","assets/casino-loop-v5/slot-selection-floor-v1.png","assets/casino-loop-v5/slot-walk-right-v1.png"];
      const version=++sceneVersion;plate.src=sources[zone];viewport.setAttribute("aria-busy","true");
      const ready=()=>{if(!alive||version!==sceneVersion)return;viewport.removeAttribute("aria-busy");
        if(animate && previous!==zone && foreground && !dialog.open && !quick.open && !reduced()){motion=scene.animate([{opacity:.45,transform:"translateX("+(zone>previous?28:-28)+"px)"},{opacity:1,transform:"none"}],{duration:620,easing:"cubic-bezier(.2,.65,.25,1)"});motion.finished.catch(()=>{});}
      };
      if(plate.complete)ready();else{plate.onload=ready;plate.onerror=()=>{if(version===sceneVersion){viewport.removeAttribute("aria-busy");current.textContent="景色を読み込めませんでした。台は引き続き選べます。";}};}
      current.textContent=zoneNames[zone];zoneButtons.forEach((button,index)=>button.setAttribute("aria-pressed",String(index===zone)));
      for(const [id,button]of objectButtons){
        const index=order.indexOf(id),left=["dragon-race","arena"].includes(id),visible=zone===1 || (zone===0?left:!left&&id!=="jackpot");
        button.hidden=!visible;
        button.style.setProperty("--cabinet-x",zone===1?[12,31,50,69,88][index]+"%":(id==="dragon-race"||id==="stadium"?36:64)+"%");
        button.style.setProperty("--cabinet-height",zone===1?(id==="jackpot"?68:index===1||index===3?56:50)+"%":"68%");
        button.style.setProperty("--cabinet-ground",zone===1?(id==="jackpot"?12:index===1||index===3?20:23)+"%":"16%");
        button.style.zIndex=id==="jackpot"?"3":"2";
      }
      fit();
    }
    function approach(id,source){
      if(!alive || dialog.open || quick.open || document.querySelector("dialog[open]"))return;
      opener=source;stop();detailHost.querySelector('[data-preview-machine-select="'+id+'"]').click();
      for(const [key,button]of objectButtons)button.setAttribute("aria-pressed",String(key===id));
      carousel.dataset.selectedMachine=id;dialog.dataset.machine=id;dialog.showModal();back.focus({preventScroll:true});
      if(foreground && !reduced()){motion=dialog.querySelector(".casino-selected-machine").animate([{opacity:.4,transform:"translateY(18px)"},{opacity:1,transform:"none"}],{duration:360,easing:"ease-out"});motion.finished.catch(()=>{});}
    }
    back.addEventListener("click",()=>dialog.close());
    dialog.addEventListener("close",()=>{stop();opener?.isConnected&&opener.focus({preventScroll:true});});
    dialog.addEventListener("keydown",event=>{if(["Escape","Enter"," ","ArrowLeft","ArrowRight"].includes(event.key))event.stopPropagation();});
    dialog.addEventListener("click",()=>queueMicrotask(()=>{if(document.querySelector(".app-view.is-active")?.dataset.view!=="machines")dialog.close();}));
    quickOpen.addEventListener("click",()=>{stop();quick.showModal();quickClose.focus();});quickClose.addEventListener("click",()=>quick.close());
    quick.addEventListener("close",()=>{if(!dialog.open)quickOpen.focus({preventScroll:true});});
    quick.addEventListener("keydown",event=>{if(["Escape","Enter"," "].includes(event.key))event.stopPropagation();});
    carousel.addEventListener("keydown",event=>{
      if(dialog.open||quick.open)return;let zone=floorZone;
      if(event.key==="ArrowLeft")zone=Math.max(0,zone-1);else if(event.key==="ArrowRight")zone=Math.min(2,zone+1);else if(event.key==="Home")zone=1;else return;
      event.preventDefault();event.stopPropagation();const fromMachine=event.target.closest(".casino-walk-object");moveZone(zone);
      if(fromMachine?.hidden)(zone===1?objectButtons.get("jackpot"):[...objectButtons.values()].find(button=>!button.hidden)).focus({preventScroll:true});
    });
    carousel.append(viewport,hud,dialog,quick);moveZone(floorZone,false);
    for(const [id,button]of objectButtons)button.setAttribute("aria-pressed",String(id===selectedId));
    const resize=new ResizeObserver(fit);resize.observe(viewport);
    const view=carousel.closest(".app-view"),observer=new MutationObserver(()=>{if(!view.classList.contains("is-active")){stop();dialog.close();quick.close();}});
    observer.observe(view,{attributes:true,attributeFilter:["class"]});
    window.addEventListener("blur",pause);window.addEventListener("pagehide",pause);window.addEventListener("focus",resume);media.addEventListener("change",stop);
    disposeFloor=()=>{alive=false;stop();resize.disconnect();observer.disconnect();window.removeEventListener("blur",pause);window.removeEventListener("pagehide",pause);window.removeEventListener("focus",resume);media.removeEventListener("change",stop);dialog.close();quick.close();};
  }
  function render(carousel) {
    // 既存台の開始・再挑戦ボタンはハンドラーごと保持し、進行や記録を初期化しない。
    const legacy = carousel.querySelector('[data-machine="jackpot"]')?.closest(".machine-card");
    const legacyActions = legacy?.querySelector(".machine-card-actions");
    const legacyArchive = legacy?.querySelector(".machine-replay-order");
    if(carousel.closest("[data-casino-floor]")){renderSpatialFloor(carousel,legacyActions,legacyArchive);return;}
    carousel.replaceChildren(); carousel.classList.remove("has-dragon-machine"); carousel.classList.add("machine-lobby-grid");
    carousel.setAttribute("role", "list"); carousel.setAttribute("aria-label", "遊べる台");
    catalog.forEach((entry, index) => {
      const card = node("article", "lobby-card lobby-card-" + entry.id); card.dataset.catalogId = entry.id; card.setAttribute("role", "listitem");
      const cabinet = node("div", "lobby-cabinet");
      const crown = node("div", "lobby-cabinet-crown");
      crown.append(node("span", "lobby-cabinet-number", String(index + 1).padStart(2, "0")));
      const heading = node("h3", "", entry.title);
      heading.id = "machine-title-" + entry.id; card.setAttribute("aria-labelledby", heading.id);
      crown.append(heading);
      const art = node("div", "lobby-card-art"), img = node("img", "lobby-card-image"); img.src = entry.image; img.alt = ""; art.append(img);
      if (entry.logo) { const logo = node("img", "lobby-card-logo"); logo.src = entry.logo; logo.alt = ""; art.append(logo); }
      art.append(node("span", "lobby-card-tag", entry.tag));
      const deck = node("div", "lobby-cabinet-deck");
      deck.innerHTML = '<i></i><i></i><b aria-hidden="true"></b><i></i><i></i>';
      cabinet.append(crown, art, deck); card.append(cabinet);
      const copy = node("div", "lobby-card-copy");
      copy.append(node("p", "", entry.description));
      let actions;
      if (entry.legacy && !window.MimiDragonMachine?.active && legacyActions) {
        actions = legacyActions; actions.classList.add("lobby-card-actions");
        actions.querySelectorAll("button").forEach(button => { button.dataset.route = "slot"; });
        // 履歴の詳細は任意に開く。新規プレイヤーの台選択を圧迫しない。
        if (legacyArchive) {
          const archive = node("details", "lobby-archive"); archive.append(node("summary", "", "やり込みの記録"), legacyArchive); copy.append(archive);
        }
      } else {
        actions = node("div", "lobby-card-actions");
        if (entry.status === "available") {
          const link = node("a", "", "この台で遊ぶ"); link.href = entry.href; actions.append(link);
        } else { const button = node("button", "", "準備中"); button.disabled = true; actions.append(button); }
      }
      copy.append(actions); card.append(copy); carousel.append(card);
    });
  }
  window.MimiMachineLobby = Object.freeze({ mount, render, initialView });
}());
