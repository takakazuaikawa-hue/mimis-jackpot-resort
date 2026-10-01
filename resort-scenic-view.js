/* A player-paced reading of the live scenery. Only the final explicit action
 * records the existing discovery through save-before-display transactions. */
(function(root){
  "use strict";
  function create({read,transact,scene,compose,refresh,onDialogue}) {
    const world=root.MimiResortWorld, app=document.querySelector("#appRoot");
    const dialog=document.createElement("dialog");dialog.className="stay-scenic";
    dialog.setAttribute("aria-labelledby","stayScenicHeading");
    dialog.innerHTML='<div class="stay-scenic-top"><p data-scenic-place></p><button type="button" data-scenic-close aria-label="景色を眺めるのをやめる">散歩に戻る ×</button></div><div class="stay-scenic-reading"><p class="stay-scenic-eyebrow">足を止めて</p><h2 id="stayScenicHeading"></h2><p data-scenic-copy></p><p data-scenic-status role="status"></p><button type="button" data-scenic-next></button><span data-scenic-page aria-hidden="true"></span></div>';
    app.append(dialog);
    const next=dialog.querySelector("[data-scenic-next]"), media=matchMedia("(prefers-reduced-motion: reduce)");
    let moment=null,index=0,owner=null,invoker=null;
    const reduced=()=>media.matches || read().settings.motion==="reduced";
    function stop(){owner?.stop();}
    function show() {
      stop();dialog.dataset.frame=index;dialog.dataset.time=moment.time;
      dialog.querySelector("[data-scenic-copy]").textContent=moment.frames[index].copy;
      dialog.querySelector("[data-scenic-page]").textContent=(index+1)+" / "+moment.frames.length;
      next.textContent=index<moment.frames.length-1 ? (index===0?"もう少し眺める":"この景色を心に留める") : moment.remembered?"散歩に戻る":"この景色を覚えて帰る";
      dialog.querySelector("[data-scenic-status]").textContent="";
      owner.focus(moment.frames[index].point,reduced());
      onDialogue?.("島の景色",moment.frames[index].copy);
    }
    function close(message="") {
      if(!dialog.open)return;
      dialog.close();cleanup(message);
    }
    function cleanup(message="") {
      if(!moment)return;
      stop();owner?.release();owner=null;moment=null;delete app.dataset.scenicActive;
      // The source controls are rebuilt on a successful save. Restore the
      // equivalent discovery control, or the mascot if it was the invoker.
      const target=invoker;invoker=null;refresh(message);
      if(target?.isConnected)target.focus({preventScroll:true});
      else scene.querySelector('[data-world-discover="'+dialog.dataset.discovery+'"]')?.focus({preventScroll:true});
    }
    next.addEventListener("click",event=>{
      if(event.detail>1 || !moment)return;
      if(index<moment.frames.length-1){index++;show();return;}
      const current=world.scenicMoment(read().stay,moment.id);
      if(!current || current.context!==moment.context){dialog.querySelector("[data-scenic-status]").textContent="景色や時間が変わりました。散歩に戻り、もう一度眺めてください。";return;}
      if(current.remembered){close();return;}
      const result=transact(draft=>world.finishScenic(draft,moment.id,moment.context));
      if(!result.ok){dialog.querySelector("[data-scenic-status]").textContent=result.message;return;}
      close("この景色を、旅の記憶に残した。");
    });
    dialog.querySelector("[data-scenic-close]").addEventListener("click",()=>close());
    dialog.addEventListener("cancel",event=>{event.preventDefault();close();});
    dialog.addEventListener("close",()=>{if(!dialog.open)cleanup();});
    dialog.addEventListener("keydown",event=>{if(["Enter"," ","Escape","ArrowLeft","ArrowRight","ArrowUp","ArrowDown"].includes(event.key))event.stopPropagation();});
    media.addEventListener("change",()=>{if(dialog.open){stop();owner.focus(moment.frames[index].point,true);}});
    root.addEventListener("blur",stop);root.addEventListener("pagehide",stop);
    document.addEventListener("visibilitychange",()=>{if(document.hidden)stop();});
    return {
      open(id,source) {
        if(dialog.open || document.querySelector("dialog[open]") || scene.hasAttribute("aria-busy"))return false;
        const data=world.scenicMoment(read().stay,id);if(!data)return false;
        moment=data;index=0;invoker=source;owner=compose(scene);dialog.dataset.discovery=id;dialog.dataset.place=moment.place;
        dialog.querySelector("h2").textContent=moment.title;
        dialog.querySelector("[data-scenic-place]").textContent=world.SCENES[moment.place].label+" · "+({day:"昼",sunset:"夕方",night:"夜"})[moment.time];
        app.dataset.scenicActive="true";dialog.showModal();show();next.focus({preventScroll:true});return true;
      },
      close,
      get active(){return dialog.open;}
    };
  }
  root.MimiResortScenicView=Object.freeze({create});
})(window);
