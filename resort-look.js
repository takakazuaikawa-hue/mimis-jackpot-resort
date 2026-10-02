/* User-controlled view inside each illustrated place. The image, inhabitants,
 * atmosphere and spatial controls share one coordinate system. No game state
 * is written while looking; only an intentional click reaches route actions. */
(function (root) {
  "use strict";
  const SCALE = 1.14;
  function create() {
    const cameras = new Map();
    let active = null;
    function reset(camera) {
      camera.x=0;
      // Luana's source framing reaches the top edge; begin with the whole
      // head visible instead of cropping it with the world's center camera.
      camera.y=camera.node.classList.contains("stay-shop-scene") ? Math.max(0,(camera.node.offsetHeight*camera.scale-camera.shell.clientHeight)/2) : 0;
      paint(camera);
    }
    function mount(node) {
      if (cameras.has(node)) return cameras.get(node);
      const shell = node.closest("dialog, .app-view");
      const camera = {node, shell, scale:SCALE, x:0, y:0, gesture:null, suppressUntil:0, signature:""};
      cameras.set(node,camera);
      node.classList.add("stay-look-scene"); node.tabIndex=0;
      node.setAttribute("role","group");
      node.setAttribute("aria-label","景色を見渡す。ドラッグ、または矢印キー。Homeで正面に戻す");
      node.removeAttribute("aria-hidden");
      const hint=document.createElement("div"); hint.className="stay-look-help";
      hint.innerHTML='<span>ドラッグで見渡す · 光る道へ</span><button type="button" aria-label="視点を正面に戻す">正面へ</button>';
      if (shell.matches("dialog")) hint.querySelector("span").textContent="ドラッグで見渡す";
      shell.append(hint); hint.querySelector("button").addEventListener("click",()=>{reset(camera);node.focus({preventScroll:true});});
      if(node.matches(".stay-world-scene")) {
        camera.edges=[-1,1].map(direction=>{
          const button=document.createElement("button");button.type="button";button.className="stay-look-edge";button.hidden=true;
          button.dataset.lookEdge=direction<0?"left":"right";
          button.innerHTML='<b aria-hidden="true">'+(direction<0?'‹':'›')+'</b><span></span>';
          shell.append(button);
          button.addEventListener("click",()=>{
            const candidates=offscreen(camera,direction);
            if(candidates.length)framePoint(candidates[0]);
          });
          return button;
        });
        new MutationObserver(()=>paint(camera)).observe(node,{childList:true,subtree:true});
      }
      // World/modal controls remain accessible above the camera. Pointer
      // capture is delayed until movement, so a normal region click is intact.
      node.addEventListener("pointerdown",event=>{
        if(event.button!==0 || (event.target.closest("dialog") && event.target.closest("dialog")!==shell))return;
        camera.suppressUntil=0;
        camera.gesture={id:event.pointerId,x:event.clientX,y:event.clientY,originX:camera.x,originY:camera.y,moved:false};
      });
      node.addEventListener("pointermove",event=>{
        const g=camera.gesture;if(!g||g.id!==event.pointerId)return;
        const dx=event.clientX-g.x,dy=event.clientY-g.y;
        if(!g.moved&&Math.hypot(dx,dy)<7)return;
        if(!g.moved){g.moved=true;node.setPointerCapture(event.pointerId);node.dataset.looking="true";}
        event.preventDefault();camera.x=g.originX+dx;camera.y=g.originY+dy;paint(camera);
      });
      const end=event=>{
        const g=camera.gesture;if(!g||g.id!==event.pointerId)return;
        if(g.moved)camera.suppressUntil=performance.now()+450;
        camera.gesture=null;delete node.dataset.looking;
        if(node.hasPointerCapture(event.pointerId))node.releasePointerCapture(event.pointerId);
      };
      node.addEventListener("pointerup",end);node.addEventListener("pointercancel",end);
      node.addEventListener("lostpointercapture",()=>{camera.gesture=null;delete node.dataset.looking;});
      node.addEventListener("click",event=>{
        if(performance.now()<camera.suppressUntil){event.preventDefault();event.stopImmediatePropagation();camera.suppressUntil=0;}
      },true);
      node.addEventListener("dragstart",event=>event.preventDefault());
      node.addEventListener("keydown",event=>{
        if(event.target!==node)return;
        const step=event.shiftKey?70:35;
        if(event.key==="Home"){reset(camera);}
        else if(event.key==="ArrowLeft")camera.x+=step;
        else if(event.key==="ArrowRight")camera.x-=step;
        else if(event.key==="ArrowUp")camera.y+=step;
        else if(event.key==="ArrowDown")camera.y-=step;
        else return;
        event.preventDefault();paint(camera);
      });
      node.addEventListener("focusin",event=>{
        if(event.target===node||(event.target.closest("dialog")&&event.target.closest("dialog")!==shell)||!event.target.matches(":focus-visible"))return;
        const r=event.target.getBoundingClientRect(),s=shell.getBoundingClientRect();
        const margin=80;
        camera.x+=r.left<s.left+margin?s.left+margin-r.left:r.right>s.right-margin?s.right-margin-r.right:0;
        camera.y+=r.top<s.top+margin?s.top+margin-r.top:r.bottom>s.bottom-margin?s.bottom-margin-r.bottom:0;
        paint(camera);
      });
      new ResizeObserver(()=>paint(camera)).observe(shell);
      return camera;
    }
    function paint(camera) {
      const {node,shell}=camera;
      const maxX=Math.max(0,(node.offsetWidth*camera.scale-shell.clientWidth)/2);
      const maxY=Math.max(0,(node.offsetHeight*camera.scale-shell.clientHeight)/2);
      camera.x=Math.max(-maxX,Math.min(maxX,camera.x));camera.y=Math.max(-maxY,Math.min(maxY,camera.y));
      node.style.setProperty("--look-x",camera.x.toFixed(2)+"px");node.style.setProperty("--look-y",camera.y.toFixed(2)+"px");
      node.style.setProperty("--look-scale",camera.scale);
      camera.edges?.forEach((button,index)=>{
        const count=offscreen(camera,index===0?-1:1).length;
        button.hidden=count===0 || node.hasAttribute("aria-busy");
        button.querySelector("span").textContent=(index===0?"左":"右")+"にも道";
        button.setAttribute("aria-label",(index===0?"左":"右")+"を見渡す。画面の外に道が"+count+"つ");
      });
    }
    function offscreen(camera,direction) {
      const bounds=camera.shell.getBoundingClientRect();
      return [...camera.node.querySelectorAll('[data-point-kind="exit"]')].filter(node=>{
        if(!node.getClientRects().length || node.disabled || node.hidden)return false;
        const rect=node.getBoundingClientRect(),center=rect.left+rect.width/2;
        return direction<0 ? center<bounds.left+32 : center>bounds.right-32;
      }).sort((a,b)=>direction*(a.getBoundingClientRect().left-b.getBoundingClientRect().left));
    }
    function framePoint(target) {
      const camera=cameras.get(target?.closest(".stay-look-scene"));
      if(!camera || camera.node.hasAttribute("aria-busy"))return false;
      const rect=target.getBoundingClientRect(),bounds=camera.shell.getBoundingClientRect();
      camera.x+=bounds.left+bounds.width/2-rect.left-rect.width/2;
      camera.y+=bounds.top+bounds.height/2-rect.top-rect.height/2;
      paint(camera);target.focus({preventScroll:true});return true;
    }
    function scene(node,signature) {
      if(!node)return;
      const camera=mount(node);active=camera;
      // Wide artwork supplies the view range itself; never enlarge it again
      // merely to make the camera move. Existing scenes retain their framing.
      camera.scale=node.dataset.panorama ? 1 : SCALE;
      if(camera.signature!==signature){reset(camera);camera.signature=signature;camera.gesture=null;delete node.dataset.looking;}
      paint(camera);
    }
    function spatial(button,kind="detail") {
      if(!button||button.querySelector(":scope > .stay-point-label"))return;
      button.classList.add("stay-spatial-point");button.dataset.pointKind=kind;
      const label=document.createElement("span");label.className="stay-point-label";label.textContent=button.textContent;
      button.replaceChildren(label);
      const fitLabel=()=>requestAnimationFrame(()=>{
        label.style.setProperty("--label-shift","0px");
        const rect=label.getBoundingClientRect();
        const shift=rect.left<16?16-rect.left:rect.right>innerWidth-16?innerWidth-16-rect.right:0;
        const camera=cameras.get(button.closest(".stay-look-scene"));
        label.style.setProperty("--label-shift",(shift/(camera?.scale||SCALE))+"px");
      });
      button.addEventListener("pointerenter",fitLabel);button.addEventListener("focus",fitLabel);
      if(button.dataset.openAir)fitLabel();
    }
    root.addEventListener("blur",()=>{if(active){active.gesture=null;delete active.node.dataset.looking;}});
    // One scenic reading borrows the existing camera; closing restores the
    // player's view. It never enlarges the plate or writes journey state.
    function compose(node) {
      const camera=mount(node), previous={x:camera.x,y:camera.y};
      let motion=null;
      function stop(){if(motion){motion.cancel();motion=null;}}
      return {
        focus(point,reduced) {
          stop();const start=getComputedStyle(node).transform;
          camera.x=(.5-point[0]/100)*node.offsetWidth*camera.scale;
          camera.y=(.5-point[1]/100)*node.offsetHeight*camera.scale;paint(camera);
          if(!reduced){motion=node.animate([{transform:start},{transform:getComputedStyle(node).transform}],{duration:1100,easing:"cubic-bezier(.2,.65,.25,1)"});motion.finished.catch(()=>{});}
        },
        stop,
        release(){stop();camera.x=previous.x;camera.y=previous.y;paint(camera);}
      };
    }
    return {scene,spatial,compose,framePoint};
  }
  root.MimiResortLook=Object.freeze({create});
})(window);
