/* Spatial atmosphere for the illustrated island. Coordinates refer to the
 * actual plates, not viewport rectangles. Never move the camera or game RNG.
 * A single 24fps canvas runs only for the foreground scene; reduced motion
 * keeps the lighting but removes every continuous animation. */
(function (root) {
  "use strict";
  const W = 1672, H = 941;
  const PROFILES = {
    plaza: { water: [[43,55,61,55,60,56.5,44,56.5]], floor: [15,68,83,68,80,88,17,88], light: [[38,10,28]], lamps: [[13,42,6],[43,40,5],[79,37,6],[97,30,8]] },
    galleria: { floor: [29,74,70,74,97,100,2,100], beams: [[49,0,15,96,52,96]], light: [[48,5,29]], lamps: [[3,18,8],[15,27,5],[95,25,6]] },
    "galleria-panorama": { floor: [20,74,76,74,100,100,0,100], beams: [[48,0,25,96,60,96]], light: [[49,4,22]], lamps: [[17,9,5],[83,21,5],[97,43,3]] },
    shop: { beams: [[65,2,39,60,72,60]], light: [[68,8,24]], lamps: [[89,56,9],[27,28,6],[74,53,7]] },
    promenade: { water: [[79,49,92,46,92,53,86,56,82,55]], floor: [36,64,59,54,70,83,63,100,18,100], light: [[65,10,24]], lamps: [[31,27,7],[72,47,5],[96,54,9]] },
    lookout: { water: [[69,52,93,50,93,62,71,57]], floor: [10,72,64,67,83,100,0,100], light: [[58,11,25]], lamps: [[3,27,10],[23,40,7],[60,49,7],[97,55,8]] },
    hotel: { floor: [25,69,72,65,90,100,28,100], beams: [[13,25,12,82,52,89]], light: [[17,32,18]], lamps: [[54,6,15],[1,51,9],[68,49,6]] },
    pool: { water: [[20,46,40,43,56,43,69,48,81,57,91,66,79,80,58,75,35,60]], floor: [32,80,48,84,81,98,40,98], light: [[70,4,27]], lamps: [[29,28,5],[76,39,5],[97,47,7]] },
    harbor: { water: [[67,65,77,66,83,73,84,80,76,80,72,76]], floor: [26,62,43,60,64,91,70,100,16,100], light: [[68,5,27]], lamps: [[3,26,8],[19,40,6],[53,39,5]] },
    pier: { water: [[50,49,61,46,62,55,58,58,55,68,49,66]], light: [[69,8,25]], lamps: [[23,50,7],[39,51,7],[46,53,9],[14,55,6]] },
    garden: { water: [[58,60,72,59,79,61,71,63,61,62]], floor: [22,70,50,65,80,92,80,100,13,100], light: [[50,3,23]], lamps: [[5,24,8],[22,32,6],[94,34,6]] },
    highland: { water: [[67,40,81,40,94,39,99,43,99,48,81,47,72,44],[79,53,89,52,95,57,86,59]], light: [[70,6,18]], lamps: [] },
    "highland-panorama": { water: [[53,37,62,37,66,40,65,44,62,44,60,42,56,42],[62,57,68,58,72,60,71,64,67,66,64,64]], floor: [29,77,45,70,55,83,66,100,27,100], light: [[63,5,20]], lamps: [[29,39,4],[96,51,4],[10,12,3]] },
    cove: { water: [[67,42,98,41,99,49,86,52,71,57,53,57,43,52,61,46],[49,59,72,59,86,61,96,63,99,82,96,96,88,87,64,78,54,72]], light: [[70,6,18]], lamps: [] },
    lounge: { water: [[82,45,87,44,92,47,92,49,82,49]], floor: [35,64,55,62,61,95,44,100,24,100], beams: [[84,23,58,83,80,83]], light: [[84,30,18]], lamps: [[48,10,10],[15,28,6],[76,55,8]] },
    town: { floor: [42,73,54,74,74,100,24,100], light: [[50,8,18]], lamps: [[29,13,8],[81,29,8],[12,29,6],[48,39,4]] },
    museum: { floor: [56,77,76,76,86,90,38,100], beams: [[91,22,61,88,85,82]], light: [[88,31,12]], lamps: [[29,5,7],[68,4,7]] },
    room: { water: [[25,38,32,37,36,39,35,42,26,43]], floor: [29,66,42,66,67,90,39,87], beams: [[33,22,38,87,72,89]], light: [[34,29,20]], lamps: [[98,25,12],[1,32,8]] },
    boat: { water: [[0,57,32,55,41,51,79,50,81,57,74,62,65,67,41,74,5,84,0,86]], light: [[94,40,22]], lamps: [[20,35,7],[44,42,5],[81,72,6]], moon: [67.5,16,10] }
  };
  PROFILES.arrival = PROFILES.plaza;
  // Food scenes are lit indoors: no moving sunbeam across the meal or people.
  for (const id of ["fishdiner", "homekitchen", "bakery", "meal"]) PROFILES[id] = { indoor: true };
  const point = (x, y) => [x * W / 100, y * H / 100];
  function polygon(values) {
    const path = new Path2D();
    for (let i = 0; i < values.length; i += 2) path[i ? "lineTo" : "moveTo"](...point(values[i], values[i + 1]));
    path.closePath(); return path;
  }
  function create() {
    let view = "title", place = "", time = "day", reduced = false, awake = true;
    let target, frame = 0, elapsed = 0, lastFrame = 0, draws = 0;
    const surfaces = new Map(), media = matchMedia("(prefers-reduced-motion: reduce)");
    function surface(host, image) {
      if (surfaces.has(host)) return surfaces.get(host);
      const canvas = document.createElement("canvas");
      canvas.className = "stay-environment"; canvas.width = W; canvas.height = H;
      canvas.setAttribute("aria-hidden", "true"); image.after(canvas);
      const entry = { canvas, ctx: canvas.getContext("2d"), image, key: "" };
      surfaces.set(host, entry); image.addEventListener("load", refresh); return entry;
    }
    function glow(ctx, x, y, radius, opacity, color = "255,219,152") {
      const [px, py] = point(x, y), r = radius * W / 100;
      const g = ctx.createRadialGradient(px, py, 0, px, py, r);
      g.addColorStop(0, `rgba(${color},${opacity})`); g.addColorStop(.25, `rgba(${color},${opacity * .38})`); g.addColorStop(1, `rgba(${color},0)`);
      ctx.fillStyle = g; ctx.fillRect(px-r, py-r, r*2, r*2);
    }
    function draw() {
      if (!target?.ctx) return;
      const {ctx, image, profile, water, floor, canvas} = target;
      ctx.clearRect(0, 0, W, H);
      if (!image.complete || !image.naturalWidth) return;
      const night = target.time === "night", sunset = target.time === "sunset", t = elapsed / 1000;
      // Slow local texture displacement gives the painted water a surface;
      // masks deliberately avoid land, ropes, boats, statues and balustrades.
      for (const path of water) {
        ctx.save(); ctx.clip(path); ctx.globalAlpha = .22;
        for (let y = 0; y < H; y += 10) {
          const shift = Math.sin(y * .044 + t * .67) * 1.25;
          ctx.drawImage(image, 0, y * image.naturalHeight / H, image.naturalWidth, 10 * image.naturalHeight / H,
            shift, y, W, 10);
        }
        ctx.globalAlpha = 1;
        for (let i = 0; i < 235; i++) {
          const x = (i * 193.71 + 97) % W, y = (i * 83.13 + 421) % H;
          if (!ctx.isPointInPath(path, x, y)) continue;
          const wave = Math.pow((Math.sin(t * .85 + i * 2.37) + 1) / 2, 5);
          const length = 1.5 + y / H * 8;
          ctx.strokeStyle = `rgba(${night ? "206,227,250" : sunset ? "255,216,148" : "225,255,253"},${wave * (night ? .45 : .62)})`;
          ctx.lineWidth = .65 + y / H * .7; ctx.beginPath();
          ctx.moveTo(x - length, y); ctx.quadraticCurveTo(x, y + Math.sin(t+i)*1.4, x+length, y); ctx.stroke();
        }
        ctx.restore();
      }
      // Lighting is source-local; night never inherits daylight shafts/dust.
      for (const [x,y,r] of night ? profile.lamps || [] : profile.light || [])
        glow(ctx, x, y, r, night ? .19 : sunset ? .10 : .075);
      if (night && profile.moon) glow(ctx, ...profile.moon, .075, "194,219,255");
      if (!night) {
        for (const values of profile.beams || []) {
          ctx.save(); ctx.clip(polygon(values));
          const g = ctx.createLinearGradient(...point(values[0],values[1]), ...point(values[2],values[3]));
          g.addColorStop(0,"rgba(255,239,194,0)"); g.addColorStop(.32,"rgba(255,239,194,.055)"); g.addColorStop(1,"rgba(255,239,194,0)");
          ctx.fillStyle=g; ctx.fillRect(0,0,W,H);
          for(let i=0;i<9;i++) {
            const x = (i*171.3+elapsed*.003)%W, y=(i*59.1+elapsed*.0015)%H;
            glow(ctx,x/W*100,y/H*100,.14,.17,"255,246,214");
          }
          ctx.restore();
        }
        if (floor) {
          ctx.save(); ctx.clip(floor);
          for (let i=0;i<16;i++) {
            const x = 14+(i*17.7)%76 + Math.sin(t*.22+i)*.25, y=62+(i*7.3)%38;
            glow(ctx,x,y,1.8+i%3,.035+.016*Math.sin(t*.45+i),"255,238,183");
          }
          ctx.restore();
        }
      }
      canvas.dataset.environment = target.key; draws++;
    }
    function tick(now) {
      frame = 0;
      if (!awake || reduced || media.matches || !target) return;
      if (!lastFrame || now-lastFrame >= 1000/24) {
        elapsed += lastFrame ? Math.min(now-lastFrame,100) : 0; lastFrame=now; draw();
      }
      frame=requestAnimationFrame(tick);
    }
    function refresh() {
      cancelAnimationFrame(frame); frame=0; lastFrame=0;
      for(const entry of surfaces.values()) entry.canvas.hidden=true;
      target=null;
      if (!["home","shop","room"].includes(view)) return;
      const dialog = view === "home" ? document.querySelector(".stay-dining[open]") : null;
      const host = dialog?.querySelector(".stay-activity-scene") || dialog || document.querySelector(view === "home" ? ".stay-world-scene" : view === "shop" ? ".stay-shop-scene" : ".stay-room-scene");
      const image = host?.querySelector("img"); if (!image) return;
      let key=place, period=time;
      if (!dialog && PROFILES[host.dataset.panorama + "-panorama"]) key=host.dataset.panorama + "-panorama";
      if (dialog) {
        const boat = dialog.classList.contains("stay-cruise") && ["aboard","coast"].includes(dialog.dataset.stage);
        key=boat ? "boat" : dialog.classList.contains("stay-cruise") ? "pier" : "meal";
        if (boat) period=dialog.dataset.slot;
      }
      const profile=PROFILES[key]; if(!profile || (host.dataset.museumRoom && host.dataset.museumRoom!=="hall")) return;
      target=surface(host,image); target.canvas.hidden=false; target.key=key; target.time=period; target.profile=profile;
      target.water=(profile.water||[]).map(polygon); target.floor=profile.floor ? polygon(profile.floor) : null;
      draw();
      if(awake && !reduced && !media.matches && !profile.indoor) frame=requestAnimationFrame(tick);
    }
    // Reconcile only image/dialog changes, never our canvas drawing/attributes.
    new MutationObserver(refresh).observe(document.querySelector("#appRoot"), {subtree:true,attributes:true,attributeFilter:["open","src","data-stage","data-slot"]});
    media.addEventListener("change",refresh);
    return {
      setScene(nextView,nextPlace,nextTime,nextReduced,nextAwake) {
        view=nextView;place=nextPlace;time=nextTime;reduced=nextReduced;awake=nextAwake;refresh();
      },
      snapshot: () => ({place:target?.key, running:Boolean(frame), draws, reduced:reduced||media.matches})
    };
  }
  root.MimiResortEnvironment=Object.freeze({create});
})(window);
