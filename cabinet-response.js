/* The visible settled grid owns these paths; no flags, payout or RNG writes. */
(() => {
  'use strict';
  const records=new WeakMap(), media=matchMedia('(prefers-reduced-motion: reduce)');
  function record(layer,reels) {
    let r=records.get(layer);
    if(r?.canvas.isConnected)return r;
    if(r)cancelAnimationFrame(r.frame);
    const canvas=document.createElement('canvas');canvas.className='reel-award-canvas';canvas.setAttribute('aria-hidden','true');layer.append(canvas);
    const shell=layer.closest('.game-shell,.stadium-cabinet,.arena-cabinet,.guild-cabinet');
    let blurred=false;
    r={layer,reels,shell,canvas,lines:new Map(),frame:0,elapsed:0,last:0,points:[]};records.set(layer,r);
    const quiet=()=>blurred||document.hidden||!document.hasFocus()||!!shell?.querySelector('dialog[open]')||document.getElementById('helpOverlay')?.hidden===false||!!shell?.closest('[data-view="slot"]:not(.is-active)');
    const reduced=()=>media.matches||shell?.classList.contains('reduced-motion')||shell?.dataset.motion==='reduced'||shell?.querySelector('.dragon-stage')?.dataset.reduced==='true';
    function paint(now=performance.now()) {
      r.frame=0;
      const bounds=layer.getBoundingClientRect(), sx=layer.clientWidth/(bounds.width||1),sy=layer.clientHeight/(bounds.height||1);
      const width=layer.clientWidth,height=layer.clientHeight;if(!width||!height)return;
      const ratio=Math.min(2,devicePixelRatio||1);if(canvas.width!==Math.round(width*ratio)||canvas.height!==Math.round(height*ratio)){canvas.width=Math.round(width*ratio);canvas.height=Math.round(height*ratio);}
      const ctx=canvas.getContext('2d');ctx.setTransform(ratio,0,0,ratio,0,0);ctx.clearRect(0,0,width,height);
      const paused=quiet(),calm=reduced();
      if(!paused&&!calm&&r.last)r.elapsed+=Math.min(80,now-r.last);r.last=paused?0:now;
      layer.dataset.lineMotion=!r.lines.size?'idle':paused?'paused':calm?'reduced':r.elapsed>=1800?'held':'running';
      r.points=[];
      for(const [id,line]of r.lines){
        const points=line.cells.map(([c,row])=>{const col=reels.children[c],cell=col?.querySelectorAll('.reel-cell.symbol')[row]||col?.children[row],b=cell?.getBoundingClientRect();return b?[(b.left+b.width/2-bounds.left)*sx,(b.top+b.height/2-bounds.top)*sy]:null;});if(points.some(p=>!p))continue;
        r.points.push({id,points});
        const color=line.replay?'#73d7ff':shell?.classList.contains('stadium-cabinet')?'#ffbc65':shell?.classList.contains('arena-cabinet')?'#ffa0c9':shell?.classList.contains('guild-cabinet')?'#fbe3a1':'#ffe295';
        ctx.strokeStyle=color;ctx.fillStyle=color;ctx.lineWidth=2;ctx.lineJoin='round';ctx.shadowColor=color;ctx.shadowBlur=calm||paused?2:7;
        ctx.setLineDash([7,7]);ctx.lineDashOffset=calm||paused?0:-(r.elapsed/32);ctx.beginPath();ctx.moveTo(8,points[0][1]);points.forEach(p=>ctx.lineTo(...p));ctx.lineTo(width-8,points[2][1]);ctx.stroke();
        ctx.setLineDash([]);ctx.shadowBlur=3;
        for(const [x,y]of points){ctx.beginPath();ctx.arc(x,y,Math.min(23,height/8),0,Math.PI*2);ctx.globalAlpha=.5;ctx.stroke();ctx.globalAlpha=1;}
        for(const [x,y,dir]of[[9,points[0][1],1],[width-9,points[2][1],-1]]){ctx.beginPath();ctx.moveTo(x,y-4);ctx.lineTo(x+dir*5,y);ctx.lineTo(x,y+4);ctx.closePath();ctx.fill();}
      }
      if(!paused&&!calm&&r.lines.size&&r.elapsed<1800)r.frame=requestAnimationFrame(paint);
    }
    r.paint=paint;
    const repaint=()=>{cancelAnimationFrame(r.frame);r.frame=0;r.last=0;paint();};
    new ResizeObserver(repaint).observe(layer);
    new MutationObserver(repaint).observe(shell,{subtree:true,attributes:true,attributeFilter:['open','hidden','class','data-motion','data-reduced']});
    media.addEventListener('change',repaint);window.addEventListener('blur',()=>{blurred=true;repaint();});window.addEventListener('focus',()=>{blurred=false;repaint();});document.addEventListener('visibilitychange',repaint);window.addEventListener('pagehide',()=>cancelAnimationFrame(r.frame));
    return r;
  }
  window.MimiReelLines=Object.freeze({
    draw(layer,reels,line,replay=false){if(!layer||!reels)return;const known=window.SlotCore.PAYLINES.find(l=>l.id===line.id);if(!known)return;const r=record(layer,reels);r.lines.set(known.id,{cells:known.cells,replay});layer.dataset.lineIds=[...r.lines.keys()].join(',');r.elapsed=0;r.last=0;cancelAnimationFrame(r.frame);r.paint();},
    clear(layer){const r=records.get(layer);if(!r)return;cancelAnimationFrame(r.frame);r.frame=0;r.lines.clear();r.points=[];r.canvas.getContext('2d').clearRect(0,0,r.canvas.width,r.canvas.height);layer.dataset.lineIds='';layer.dataset.lineMotion='idle';},
    inspect(layer){const r=records.get(layer);return r?{ids:[...r.lines.keys()],replayIds:[...r.lines].filter(([,l])=>l.replay).map(([id])=>id),points:r.points,motion:layer.dataset.lineMotion,frameRunning:!!r.frame}:null;}
  });
})();

/* Physical contact is independent of action eligibility. It never queues play. */
(() => {
  'use strict';
  let lastContact = -Infinity;
  const selector = '#spinBtn,#pushBtn,.stop-button,[data-arena-stop],[data-guild-stop],[data-stadium-stop],#arenaSpin,#guildSpin,#stadiumSpin';
  function contact(button) {
    if (button) { button.dataset.contact = 'true'; clearTimeout(button._contactTimer); button._contactTimer = setTimeout(() => delete button.dataset.contact, 180); }
    const now = performance.now();
    if (!window.MimiAudio?.enabled || now - lastContact < 55) return;
    lastContact = now;
    window.MimiAudio?.unlock();
    window.MimiAudio?.cue('press');
  }
  window.MimiCabinetResponse = Object.freeze({contact});
  const release = button => { if (button) delete button.dataset.pressed; };
  document.addEventListener('pointerdown', event => {
    const button = event.target.closest(selector); if (!button || event.button !== 0) return;
    button.dataset.pressed = 'true';
  }, true);
  document.addEventListener('pointerup', () => document.querySelectorAll('[data-pressed]').forEach(release), true);
  document.addEventListener('pointercancel', () => document.querySelectorAll('[data-pressed]').forEach(release), true);
  window.addEventListener('blur', () => document.querySelectorAll('[data-pressed]').forEach(release));
  document.addEventListener('keydown', event => {
    if (!event.repeat && ['Space','Enter'].includes(event.code) && event.target.matches?.(selector)) event.target.dataset.pressed = 'true';
  }, true);
  document.addEventListener('keyup', event => release(event.target), true);
})();

/* Each cabinet has a visible three-stop escapement. Its pawls only latch
 * on accepted stops; touches during the result merely flex the controls. */
(() => {
  'use strict';
  const shell = document.querySelector('#gameShell,#arenaCabinet,#guildCabinet,#stadiumCabinet');
  if (!shell) return;
  const dragon = new URLSearchParams(location.search).get('machine') === 'dragon-race';
  const machine = dragon ? 'dragon-race' : shell.id === 'gameShell' ? 'jackpot' : shell.id.replace('Cabinet','');
  shell.dataset.hardware = machine;
  const deck = shell.querySelector('.machine-controls,.arena-stops,.guild-stops,.stadium-stops');
  if (!deck) return;
  const mechanism = document.createElement('div');
  mechanism.className = 'cabinet-escapement'; mechanism.setAttribute('aria-hidden','true');
  for (let i=0;i<3;i++) {
    const pawl = document.createElement('i'); pawl.dataset.latched = 'false'; pawl.style.setProperty('--pawl',i); mechanism.append(pawl);
  }
  deck.append(mechanism);
  let transaction = 0;
  const input = event => {
    const d = event.detail || {};
    if (machine !== 'jackpot' && machine !== 'dragon-race' && d.machineId !== machine) return;
    if (d.type === 'spin-start') {
      transaction = Number(d.transactionId); shell.dataset.hardwareCycle = 'spinning';
      [...mechanism.children].forEach(p => p.dataset.latched = 'false');
    } else if (d.type === 'stop-accepted' && Number(d.transactionId) === transaction && mechanism.children[d.reelIndex ?? d.col]) {
      mechanism.children[d.reelIndex ?? d.col].dataset.latched = 'true';
      if ([...mechanism.children].every(p => p.dataset.latched === 'true')) shell.dataset.hardwareCycle = 'held';
    }
  };
  window.addEventListener(['jackpot','dragon-race'].includes(machine) ? 'mimi:reel-input' : 'mimi:cabinet-input',input);
})();

/* Decorative cabinet feedback for the four independent machines. Only
 * accepted input and publicly revealed receipts can drive a light burst. */
(() => {
  "use strict";
  const dragon = new URLSearchParams(location.search).get("machine") === "dragon-race";
  const shell = document.querySelector(dragon ? "#gameShell" : "#stadiumCabinet, #arenaCabinet, #guildCabinet");
  if (!shell) return;
  const machine = dragon ? "dragon-race" : shell.id.replace("Cabinet", "");
  if (!dragon) {
    const primary = document.getElementById(machine + "Spin");
    const stops = [...shell.querySelectorAll(`[data-${machine}-stop]`)];
    const panel = document.getElementById(machine + "Command");
    const choices = document.getElementById(machine + "Choices");
    const hint = document.getElementById(machine + "InputHint");
    choices.classList.add("cabinet-command-choices"); hint.classList.add("cabinet-command-hint");
    let commandToken = "", selected = 0, active = false;
    const available = () => window.MimiCabinetArt?.ready && !document.hidden && !shell.querySelector("dialog[open]");
    function renderCommands() {
      const buttons = [...choices.children];
      active = available() && !panel.hidden && Boolean(buttons.length)
        && !shell.querySelector(`.${machine}-feature:not([hidden]), .arena-cinema:not([hidden]), .arena-cutin:not([hidden])`);
      const token = active ? [shell.dataset.pending, shell.dataset.phase, shell.dataset.round || shell.dataset.team, buttons.map(b => b.textContent).join("|")].join(":") : "";
      if (token !== commandToken) { commandToken = token; selected = 0; }
      shell.dataset.commandDeck = active ? buttons.length > 1 ? "choice" : "continue" : "";
      if (!active) {
        stops.forEach(b => { b.removeAttribute("aria-pressed"); b.removeAttribute("aria-label"); });
        return;
      }
      primary.disabled = false; primary.textContent = "PUSH";
      primary.setAttribute("aria-describedby", hint.id);
      hint.textContent = buttons.length > 1 ? "STOP 1 / 2で選択 → PUSHで決定" : "PUSH · " + buttons[0].textContent;
      buttons.forEach((button, index) => { button.dataset.deckSelected = String(index === selected); });
      stops.forEach((button, index) => {
        const selectable = buttons.length > 1 && index < buttons.length && !buttons[index].disabled;
        button.disabled = false;
        button.setAttribute('aria-disabled', 'false');
        button.dataset.inputReady = String(selectable);
        button.textContent = selectable ? `選択 ${index + 1}` : `STOP ${index + 1}`;
        if (selectable) { button.setAttribute("aria-label", buttons[index].textContent + "を選択"); button.setAttribute("aria-pressed", String(index === selected)); }
        else { button.removeAttribute("aria-pressed"); button.removeAttribute("aria-label"); }
      });
    }
    function select(index) {
      if (!active || !available() || primary.dataset.inputReady === 'false' || stops[index]?.dataset.inputReady === 'false' || choices.children.length < 2 || !choices.children[index] || choices.children[index].disabled) return false;
      selected = index; renderCommands(); return true;
    }
    function confirm() {
      if (!active || !available() || primary.dataset.inputReady === 'false') { window.MimiCabinetResponse.contact(primary); return false; }
      const button = choices.children[selected];
      if (!button || button.disabled) { window.MimiCabinetResponse.contact(primary); return false; }
      button.click(); return true;
    }
    primary.addEventListener("click", event => { if (active && available()) { event.stopImmediatePropagation(); confirm(); } }, true);
    stops.forEach((button, index) => button.addEventListener("click", event => {
      if (!active || !available()) return;
      event.stopImmediatePropagation();
      if (!select(index)) window.MimiCabinetResponse.contact(button);
    }, true));
    window.addEventListener("keydown", event => {
      if (!active || !available() || event.altKey || event.ctrlKey || event.metaKey) return;
      const stopIndex = stops.indexOf(event.target);
      const stopKey = stopIndex >= 0 && (event.code === "Space" || event.code === "Enter");
      const confirmKey = event.target === primary && (event.code === "Space" || event.code === "Enter")
        || event.target === document.body && event.code === "Space";
      if (event.repeat) {
        if (stopKey || confirmKey) { event.preventDefault(); event.stopImmediatePropagation(); }
        return;
      }
      if (stopKey) {
        event.preventDefault(); event.stopImmediatePropagation();
        if (!select(stopIndex)) window.MimiCabinetResponse.contact(event.target);
      } else if (confirmKey) {
        event.preventDefault(); event.stopImmediatePropagation(); confirm();
      } else if (/^Digit[123]$/.test(event.code) && select(Number(event.code.slice(-1)) - 1)) {
        event.preventDefault(); event.stopImmediatePropagation();
      }
    }, true);
    window.MimiCabinetCommands = Object.freeze({ render: renderCommands, confirm });
  }
  if (!dragon) {
    let ready = false, failed = false, ticket = 0, images = [];
    function load() {
      if (!failed && ticket) return;
      const owner = ++ticket; ready = false; failed = false;
      shell.dataset.cabinetArt = "loading";
      images = [...new Set(window.SlotCore.SYMBOLS.map(symbol => symbol.img))].map(file => {
        const image = new Image(); image.fetchPriority = "high"; image.src = "./assets/generated/v3/symbols/dist/" + file; return image;
      });
      let timeout;
      Promise.race([Promise.all(images.map(image => image.decode())), new Promise((_, reject) => {
        timeout = setTimeout(() => reject(new Error("Reel texture timeout")), 30000);
      })]).then(() => {
        clearTimeout(timeout);
        if (owner !== ticket) return; ready = true; shell.dataset.cabinetArt = "ready";
        shell.querySelectorAll(`.${machine}-reels img`).forEach(image => {
          if (image.complete && !image.naturalWidth && image.getAttribute("src")) image.src = image.getAttribute("src");
        });
        window.dispatchEvent(new Event("mimi:cabinet-art"));
      }).catch(() => {
        clearTimeout(timeout);
        if (owner !== ticket) return; failed = true; shell.dataset.cabinetArt = "failed";
        window.dispatchEvent(new Event("mimi:cabinet-art"));
      });
    }
    window.MimiCabinetArt = Object.freeze({ get ready() { return ready; }, get failed() { return failed; }, retry: load });
    load();
  }
  function mount() {
  const theater = shell.querySelector(dragon ? ".dragon-stage" : `.${machine}-theater, .${machine}-stage`);
  const reels = shell.querySelector(dragon ? ".reel-frame" : `.${machine}-reel-block`);
  if (!theater || !reels) return false;
  shell.dataset.responseCabinet = machine;
  const frame = document.createElement("div");
  frame.className = "cabinet-response-frame"; frame.setAttribute("aria-hidden", "true");
  for (const side of ["left", "right"]) {
    const rail = document.createElement("div"); rail.className = `cabinet-response-rail ${side}`;
    for (let i = 0; i < 8; i++) { const lamp = document.createElement("i"); lamp.style.setProperty("--lamp-step", i); rail.append(lamp); }
    frame.append(rail);
  }
  shell.append(frame);
  const trail = document.createElement("div");
  trail.className = "cabinet-response-trail"; trail.setAttribute("aria-hidden", "true");
  const beams = Array.from({ length: 3 }, () => { const beam = document.createElement("i"); trail.append(beam); return beam; });
  reels.append(trail);
  const lineLayer=dragon?shell.querySelector('.payline-layer'):document.createElement('div');
  if(!dragon){lineLayer.className='reel-award-lines';lineLayer.setAttribute('aria-hidden','true');reels.append(lineLayer);}
  const grid=dragon?shell.querySelector('#reels'):shell.querySelector(`.${machine}-reels`);
  const media = matchMedia("(prefers-reduced-motion: reduce)");
  let transaction = 0, timer = 0, burst = "", payout = 0, suspended = document.hidden, spinning = false;
  const stopped = new Set();
  function modalOpen() { return Boolean(shell.querySelector("dialog[open]")) || dragon && document.getElementById("helpOverlay")?.hidden === false; }
  function visible() { return !dragon || shell.closest('[data-view="slot"]')?.classList.contains("is-active"); }
  function reduced() {
    return media.matches || shell.dataset.motion === "reduced" || shell.querySelector(".dragon-stage")?.dataset.reduced === "true";
  }
  function phase() {
    const source = dragon ? shell.querySelector(".dragon-stage") : shell;
    const p = source?.dataset.phase;
    return p === "bonus" ? "bonus" : ["boss", "battle"].includes(p) ? "boss" : p === "trial" ? "chance" : "idle";
  }
  function paint() {
    const quiet = suspended || document.hidden || !visible() || modalOpen();
    if (quiet && burst) { clearTimeout(timer); timer = 0; burst = ""; delete shell.dataset.responseStopReel; }
    shell.dataset.responseSuspended = String(quiet);
    shell.dataset.responseReduced = String(reduced());
    shell.dataset.responsePhase = phase();
    shell.dataset.responseMode = burst || (spinning ? "spin" : phase());
    shell.dataset.responseTransaction = String(transaction);
    shell.dataset.responseStops = String(stopped.size);
    shell.dataset.responsePayout = String(payout);
    beams.forEach((beam, index) => beam.dataset.accepted = String(stopped.has(index)));
  }
  function clearBurst() { clearTimeout(timer); timer = 0; burst = ""; delete shell.dataset.responseStopReel; paint(); }
  function showBurst(mode, duration) {
    if (suspended || document.hidden || !visible() || modalOpen()) { clearBurst(); return; }
    clearTimeout(timer); burst = mode; paint();
    const owner = transaction;
    timer = setTimeout(() => { if (owner === transaction) clearBurst(); }, duration);
  }
  function input(event) {
    const d = event.detail || {}, id = Number(d.transactionId);
    if (!dragon && d.machineId !== machine || !Number.isSafeInteger(id) || id < 1) return;
    if (d.type === "spin-start") {
      transaction = id; spinning = true; payout = 0; stopped.clear(); window.MimiReelLines.clear(lineLayer);clearBurst(); return;
    }
    if (d.type !== "stop-accepted") return;
    // A reloaded unfinished transaction starts with no historic light burst.
    if (!transaction && shell.dataset.spinning === "true") { transaction = id; spinning = true; }
    const reel = Number(d.reelIndex);
    if (id !== transaction || !spinning || !Number.isInteger(reel) || reel < 0 || reel > 2 || stopped.has(reel)) return;
    stopped.add(reel); shell.dataset.responseStopReel = String(reel); showBurst("stop", 420);
  }
  function result(event) {
    const d = event.detail || {};
    if (d.machineId !== machine || d.type !== "revealed" || Number(d.transactionId) !== transaction || !spinning) return;
    spinning = false; payout = Math.max(0, Number(d.payout) || 0);
    (d.lineIds||[]).forEach(id=>{const line=window.SlotCore.PAYLINES.find(l=>l.id===id);if(line)window.MimiReelLines.draw(lineLayer,grid,line,d.replay===true);});
    delete shell.dataset.responseStopReel;
    if (payout > 0) showBurst("win", 1800);
    else if (d.replay === true) showBurst("replay", 900);
    else clearBurst();
  }
  window.addEventListener(dragon ? "mimi:reel-input" : "mimi:cabinet-input", input);
  window.addEventListener("mimi:cabinet-result", result);
  const observer = new MutationObserver(paint);
  observer.observe(shell, {subtree:true, attributes:true, attributeFilter:["data-phase", "data-spinning", "data-mode", "data-reduced", "data-motion", "class", "hidden", "open"]});
  const view = shell.closest('[data-view="slot"]');
  if (view) observer.observe(view, {attributes:true, attributeFilter:["class"]});
  const help = dragon && document.getElementById("helpOverlay");
  if (help) observer.observe(help, {attributes:true, attributeFilter:["hidden"]});
  function suspend() { suspended = true; clearBurst(); }
  function resume() { suspended = document.hidden; paint(); }
  window.addEventListener("blur", suspend); window.addEventListener("focus", resume);
  window.addEventListener("pagehide", suspend); window.addEventListener("pageshow", resume);
  document.addEventListener("visibilitychange", () => document.hidden ? suspend() : resume());
  media.addEventListener("change", paint); paint(); return true;
  }
  if (!mount()) {
    // The Dragon adapter creates its visible stage during asynchronous boot.
    // Do not decorate the hidden legacy theater while that stage is pending.
    const pending = new MutationObserver(() => { if (mount()) pending.disconnect(); });
    pending.observe(shell, {childList:true, subtree:true});
  }
})();
