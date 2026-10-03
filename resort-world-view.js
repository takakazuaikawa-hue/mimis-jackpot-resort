/* Island scene presentation. Pure route rules are in resort-world.js; every
 * remembered visit commits through the existing save-before-display boundary. */
(function (root) {
  "use strict";
  const world = root.MimiResortWorld;
  // Same playable runtime, explicit art review only. These generated panoramas
  // do not meet the native-height gate, so keep original art by default.
  const panoramaPreview = new URLSearchParams(root.location.search).get("resort-view") === "panorama";
  const PANORAMAS = {
    highland: {width:2076, height:758, links:[["garden", "庭へ戻る", 19.5, 37], ["lookout", "テラスへ下りる", 76.5, 84]]},
    galleria: {width:1983, height:793, links:[["shop", "ルアナの売場へ", 8, 68], ["promenade", "海の回廊へ", 94, 69], ["plaza", "広場へ戻る", 49, 91]], regions:{
      "move:shop": [8, 68, 12, 24, "left"],
      "move:promenade": [94, 69, 10, 25, "right"],
      "move:plaza": [49, 91, 20, 12, "back"]
    }}
  };
  const PLATES = {
    arrival: ["assets/resort-stay-v2/arrival-plaza-v2.png", "潮風の先に、ガラス屋根が光っている。"],
    plaza: ["assets/resort-stay-v2/arrival-plaza-v2.png", ""],
    galleria: ["assets/imageboard/05_stage_galleria-lapin-mall.png", "店先の向こうから、海へ抜ける風がくる。"],
    promenade: ["assets/resort-stay-v2/sea-promenade-v2.png", "建物の陰を抜けると、波の音が近くなる。"],
    lookout: ["assets/resort-art-v4/lookout-day-v4.png", ""],
    hotel: ["assets/resort-art-v4/hotel-day-v4.png", "庭の緑と、海側のラウンジ。階段の先には自分の部屋。"],
    pool: ["assets/resort-art-v4/pool-day-v4.png", "水音の向こうに、海が広がる。"],
    harbor: ["assets/resort-art-v4/harbor-day-v4.png", "回廊を離れると、風に揺れる帆柱が見えてきた。"],
    pier: ["assets/resort-art-v4/pier-day-v4.png", "足元のすぐ近くまで、海が来ている。"],
    garden: ["assets/resort-art-v4/garden-day-v4.png", "ヤシの影が重なる、涼しい回り道。"],
    highland: ["assets/resort-art-v4/highland-day-v5.png", "建物を離れ、草の道を上ってきた。遠い海まで風が通る。"],
    cove: ["assets/resort-art-v4/cove-day-v5.png", "灯りも屋根もない浜。岩の間から、小さな波が届く。"],
    lounge: ["assets/resort-art-v4/lounge-day-v4.png", "海風が通り抜ける椅子で、少し休んでいこう。"],
    town: ["assets/resort-town-v1/town-day-v2.png", "パンの香りと、通りで交わす挨拶。"],
    museum: ["assets/resort-town-v1/museum-day-v1.png", "旅先の景色が、誰かの作品の中にもある。"],
    fishdiner: ["assets/resort-town-v1/fishdiner-day-v1.png", "港で働く人が、いつもの席へ。"],
    homekitchen: ["assets/resort-town-v1/homekitchen-day-v1.png", "鍋のそばで、話の続きが始まる。"],
    bakery: ["assets/resort-town-v1/bakery-day-v1.png", "通りの食卓へ届く、今日のパン。"]
  };
  const LINKS = {
    arrival: [["plaza", "広場へ", 51, 75]],
    plaza: [["galleria", "ガレリアへ", 25, 48], ["casino", "台を選ぶ", 86, 51], ["hotel", "ホテルへ", 51, 42], ["lookout", "海辺の道へ", 7, 55], ["arrival", "到着の階段へ", 49, 91]],
    galleria: [["shop", "ルアナの売場へ", 20, 76], ["promenade", "海の回廊へ", 83, 80], ["plaza", "広場へ戻る", 49, 89]],
    promenade: [["lookout", "見晴らしへ", 66, 46], ["galleria", "ガレリアへ戻る", 18, 88], ["harbor", "海沿いを港へ", 85, 75]],
    lookout: [["plaza", "広場へ抜ける", 18, 80], ["promenade", "回廊を戻る", 46, 89], ["highland", "高台へ上る", 32, 46], ["lounge", "ラウンジへ", 12, 55]],
    hotel: [["room", "客室へ", 63, 53], ["plaza", "広場へ戻る", 16, 65], ["garden", "庭へ", 42, 51], ["lounge", "ラウンジへ", 86, 51]],
    pool: [["garden", "庭へ", 18, 36], ["cove", "入り江へ下りる", 85, 51]],
    harbor: [["promenade", "海の回廊へ", 32, 50], ["pier", "桟橋へ", 58, 55], ["cove", "海岸の道を入り江へ", 68, 88], ["town", "町の通りへ", 22, 83]],
    pier: [["harbor", "港へ戻る", 20, 85]],
    garden: [["hotel", "ホテルへ", 12, 53], ["highland", "高台へ上る", 44, 49], ["pool", "プールへ", 87, 54], ["town", "坂を下って町へ", 20, 86]],
    highland: [["garden", "庭へ戻る", 11, 37], ["lookout", "テラスへ下りる", 82, 81]],
    cove: [["harbor", "港へ続く道", 14, 55], ["pool", "プールへ上る", 35, 46]],
    lounge: [["hotel", "ホテルへ", 21, 44], ["lookout", "海のテラスへ", 46, 52]],
    town: [["harbor", "港へ", 50, 54], ["garden", "坂を上って庭へ", 25, 87], ["museum", "美術館へ", 31, 45], ["bakery", "パンとスープの店へ", 15, 66], ["homekitchen", "家庭料理の店へ", 75, 60], ["fishdiner", "魚料理の食堂へ", 91, 70]],
    museum: [["town", "町の通りへ", 89, 61]],
    fishdiner: [["town", "町の通りへ", 13, 59]],
    homekitchen: [["town", "町の通りへ", 14, 59]],
    bakery: [["town", "町の通りへ", 13, 59]]
  };
  const VIEW_GATEWAYS = { casino: "machines", shop: "shop", room: "room" };
  // Image-space interaction regions, reviewed against both day/night plates.
  // Wider targets follow the stairs, doorways, people and empty seats rather
  // than making players hunt a small point unrelated to the pictured object.
  const REGIONS = {
    galleria: {
      "move:shop": [20, 76, 16, 18, "left"],
      "move:promenade": [83, 80, 16, 18, "right"],
      "move:plaza": [49, 89, 22, 12, "back"]
    },
    promenade: {
      "move:lookout": [57, 53, 16, 18, "forward"],
      "move:galleria": [18, 88, 17, 13, "back"],
      "move:harbor": [70, 85, 17, 18, "back"],
      "discover:store-hours": [9.5, 40, 6, 12]
    },
    harbor: {
      "move:promenade": [32, 53, 14, 18, "forward"],
      "move:pier": [58, 57, 13, 16, "right"],
      "move:cove": [68, 88, 19, 13, "back"],
      "move:town": [22, 83, 17, 16, "back"],
      "discover:harbor-view": [78, 68, 14, 18]
    },
    pier: {
      "move:harbor": [13, 49, 12, 14, "forward"],
      "discover:pier-view": [54, 55, 14, 18],
      rest: [8.5, 64.5, 10, 14],
      cruise: [76, 67, 27, 23]
    },
    cove: {
      "move:harbor": [9, 52, 12, 20, "forward"],
      "move:pool": [35, 29, 14, 22, "forward"]
    },
    highland: {
      "move:garden": [13, 38, 12, 20, "left"],
      "move:lookout": [85, 79, 18, 20, "back"]
    },
    town: {
      "move:harbor": [50, 59, 11, 17, "forward"],
      "move:garden": [25, 90, 20, 10, "back"],
      "move:museum": [32, 56, 13, 16, "forward"],
      "move:bakery": [11, 65, 12, 22, "left"],
      "move:homekitchen": [76, 60, 10, 23, "forward"],
      "move:fishdiner": [93, 66, 10, 25, "right"],
      "talk:vendor": [65, 50, 9, 20]
    },
    museum: {
      "move:town": [91, 63, 11, 30, "right"],
      "talk:curator": [71, 50, 8, 30],
      "discover:museum-boat": [22, 31, 20, 30],
      "discover:museum-glass": [48, 40, 11, 34],
      "discover:museum-table": [60, 35, 14, 22]
    },
    fishdiner: {
      "move:town": [14, 62, 15, 27, "left"],
      "talk:fishcook": [64, 29, 11, 22],
      "discover:fishdiner-menu": [66, 83, 24, 15],
      "meal:fishdiner": [76, 65, 20, 12]
    },
    homekitchen: {
      "move:town": [11, 71, 10, 22, "left"],
      "talk:homecook": [70, 30, 13, 25],
      "discover:homekitchen-menu": [79, 84, 23, 15],
      "meal:homekitchen": [61, 64, 21, 16]
    },
    bakery: {
      "move:town": [13, 62, 13, 27, "left"],
      "talk:baker": [60.5, 32, 12, 24],
      "discover:bakery-menu": [67, 84, 18, 15],
      "meal:bakery": [82, 66, 21, 10]
    }
  };
  const NIGHT_PLATES = {
    arrival: "assets/resort-stay-v2/arrival-plaza-night-v2.png", plaza: "assets/resort-stay-v2/arrival-plaza-night-v2.png",
    galleria: "assets/resort-stay-v2/galleria-night-v2.png", promenade: "assets/resort-stay-v2/sea-promenade-night-v2.png",
    ...Object.fromEntries(["hotel", "pool", "harbor", "pier", "garden", "highland", "cove", "lounge", "lookout"].map(id => [id, "assets/resort-art-v4/" + id + "-night-v4.png"])),
    ...Object.fromEntries(["town", "museum", "fishdiner", "homekitchen", "bakery"].map(id => [id, "assets/resort-town-v1/" + id + "-night-v1.png"]))
  };
  NIGHT_PLATES.cove = "assets/resort-art-v4/cove-night-v5.png";
  NIGHT_PLATES.town = "assets/resort-town-v1/town-night-v2.png";
  NIGHT_PLATES.highland = "assets/resort-art-v4/highland-night-v5.png";
  // A schematic of actual route edges, not an invented geographical scale.
  const MAP_POINTS = { arrival: [8,83], plaza: [22,83], casino: [8,48], galleria: [36,83], shop: [50,83], promenade: [64,83], harbor: [78,83], pier: [92,83], cove: [64,48], pool: [64,13], garden: [50,13], highland: [36,13], lookout: [50,48], hotel: [22,48], room: [8,13], lounge: [36,48], town: [78,48], museum: [78,13], fishdiner: [92,65], homekitchen: [92,36], bakery: [92,13] };

  function create({ read, transact, navigate, onScene = () => {}, spatial = () => {}, lookScene = () => {}, framePoint = () => {}, composeScene, onDialogue = () => {}, onPersonal = () => {} }) {
    const scene = document.querySelector("[data-world-scene]");
    const plate = document.querySelector("[data-world-plate]");
    const heading = document.querySelector("[data-world-heading]");
    const actions = document.querySelector("[data-world-actions]");
    const caption = document.querySelector("[data-world-caption]");
    const conversation = document.querySelector("[data-world-conversation]");
    function say(text) {
      document.querySelector("[data-world-dialogue]").textContent = text;
      onDialogue(document.querySelector("[data-world-speaker]").textContent, text);
    }
    const episodeReply = document.createElement("button");
    episodeReply.type = "button"; episodeReply.dataset.worldEpisode = "true"; episodeReply.hidden = true;
    conversation.insertBefore(episodeReply, conversation.querySelector("[data-world-farewell]"));
    const meetingReply = document.createElement("button");
    meetingReply.type = "button"; meetingReply.hidden = true;
    conversation.insertBefore(meetingReply, conversation.querySelector("[data-world-farewell]"));
    const personalReply = document.createElement("button");
    personalReply.type = "button"; personalReply.dataset.worldPersonal = "true";
    conversation.insertBefore(personalReply, conversation.querySelector("[data-world-farewell]"));
    const personalCue = document.createElement("p"); personalCue.className = "stay-personal-cue";
    conversation.insertBefore(personalCue, personalReply);
    personalReply.addEventListener("click", () => onPersonal(speaker, personalReply));
    const outingReply=document.createElement("button");outingReply.type="button";outingReply.dataset.worldOuting="true";outingReply.hidden=true;
    conversation.insertBefore(outingReply,conversation.querySelector("[data-world-farewell]"));
    outingReply.addEventListener("click",()=>{if(!world.outings(read().stay).some(walk=>walk.id===speaker&&!walk.complete))return;selectedOuting=speaker;showMap();});
    const map = document.querySelector("[data-world-map]");
    const mapOpen = document.querySelector("[data-world-map-open]");
    const mapCanvas = map.querySelector("[data-world-map-canvas]");
    const mapRoute = map.querySelector("[data-world-map-route]");
    const mapWalk = map.querySelector("[data-world-map-walk]");
    const clue=document.createElement("details");clue.className="stay-pursuit";clue.hidden=true;clue.open=true;
    clue.innerHTML='<summary><span>絵から島へ</span><b data-pursuit-title></b></summary><p data-pursuit-next></p><button type="button" data-pursuit-frame>手がかりへの道を見渡す</button><button type="button" data-pursuit-pause>今は自由に歩く</button><p data-pursuit-status role="status"></p>';
    scene.closest('.app-view').append(clue);
    const mapClues=document.createElement('section');mapClues.className="stay-map-clues";mapCanvas.before(mapClues);
    const mapPlan = document.createElement("section");
    mapPlan.className = "stay-map-plan"; mapPlan.hidden = true;
    mapPlan.innerHTML = '<p data-meeting-note></p><button type="button" data-meeting-route>待ち合わせへの道順</button><button type="button" data-meeting-cancel>約束を取り消す</button><p role="status" data-meeting-status></p>';
    mapCanvas.before(mapPlan);
    // Keep the chosen direction and first walking action above the map,
    // including when optional artwork clues make the guide scrollable.
    mapCanvas.before(mapRoute,mapWalk);
    let speaker = "";
    let selectedOuting = "";
    let currentView = "title";
    let plateRequest = null, readyPlate = null, plateSequence = 0, waitingMessage = "";
    const trail = root.MimiResortTrailGuide?.create({scene,read,onFollow:(action,source)=>act(action,source)});
    const scenic = root.MimiResortScenicView.create({read,transact,scene,compose:composeScene,refresh:message=>render(message),onDialogue});
    const museum = root.MimiResortMuseumView.create({read,transact,scene,refresh:()=>render(),caption,onDialogue});
    function refreshPersonal() {
      const episode = world.relationshipEpisode(read().stay,speaker);
      if (!episode?.here) { personalReply.hidden = true; personalCue.hidden = true; return; }
      const state = episode.phase === "complete" ? {label:"ふたりの思い出を話す",cue:"この人との時間は、客室の旅の記録にも残っている。"}
        : episode.phase === "afterglow" ? {label:"昨夜の続きを話す",cue:"昨夜から続く言葉を、もう一度交わせそうだ。"}
        : episode.phase === "invite" ? {label:"今夜の誘いを聞く",cue:"仕事や旅を離れて、ふたりで話したいことがあるようだ。"}
        : episode.count === 0 ? {label:"この人のことをもっと知る",cue:"道案内や店の話だけではなく、この人自身のことを聞ける。"}
        : episode.count === 1 ? {label:"また会えたことを話す",cue:"昼・夕方・夜のうち、前とは違う時間に会うと話が続く。"}
        : {label:"夜にまた会いたい",cue:"次は夜に会えば、ふたりの話を続けられそうだ。"};
      if (world.NEW_CAST[speaker]) {
        if (episode.phase === "talk") {
          const talk=world.NEW_CAST[speaker].talks[episode.count];
          state.label = "「"+talk.title+"」を聞く";
          state.cue = talk.question;
        } else if (episode.phase === "later") state.cue = "次は"+episode.nextMeeting+"で、話の続きを。時間は自分のペースで進められる。";
      }
      personalReply.hidden = false; personalCue.hidden = false; personalReply.textContent = state.label; personalCue.textContent = state.cue;
    }
    const loading = document.createElement("div");
    loading.className = "stay-scene-loading"; loading.hidden = true;
    loading.innerHTML = '<p role="status"></p><button type="button" hidden>景色を再読み込み</button>';
    scene.closest(".app-view").append(loading);
    function releasePlateGate() {
      scene.inert = false; scene.removeAttribute("aria-busy");
      mapOpen.disabled = false; loading.hidden = true;
    }
    function cancelPlateRequest() {
      clearTimeout(plateRequest?.timer);
      plateSequence++; plateRequest = null; readyPlate = null;
      releasePlateGate();
    }
    loading.querySelector("button").addEventListener("click", () => {
      clearTimeout(plateRequest?.timer);
      plateRequest = null; render(waitingMessage);
    });
    function preparePlate(url, label, message) {
      waitingMessage = message;
      if (readyPlate?.url === url || (plate.getAttribute("src") === url && plate.complete && plate.naturalWidth)) {
        if (plateRequest) { clearTimeout(plateRequest.timer); plateSequence++; plateRequest = null; }
        if (plate.getAttribute("src") !== url || !plate.complete || !plate.naturalWidth) plate.src = url;
        readyPlate = null; releasePlateGate(); return true;
      }
      if (plateRequest?.url === url) return false;
      clearTimeout(plateRequest?.timer);
      const sequence = ++plateSequence, image = new Image(), request = {url, image, timer:0};
      plateRequest = request;
      trail?.loading();
      scene.inert = true; scene.setAttribute("aria-busy", "true");
      mapOpen.disabled = true; conversation.hidden = true; loading.hidden = false;
      loading.querySelector("p").textContent = label + "の景色を準備しています…";
      loading.querySelector("button").hidden = true;
      const fail = () => {
        clearTimeout(request.timer);
        if (sequence !== plateSequence || currentView !== "home") return;
        loading.querySelector("p").textContent = "景色を読み込めませんでした。もう一度お試しください。";
        const retry = loading.querySelector("button"); retry.hidden = false;
        retry.focus({preventScroll:true});
      };
      image.onerror = fail;
      image.onload = async () => {
        try { await image.decode(); } catch (_) { fail(); return; }
        clearTimeout(request.timer);
        if (sequence !== plateSequence || currentView !== "home") return;
        readyPlate = {url, image}; plateRequest = null;
        render(waitingMessage);
        heading.focus({preventScroll:true});
      };
      // A connection that never answers still offers a recovery action.
      request.timer = setTimeout(fail, 15000);
      image.src = url;
      return false;
    }
    const cruise = root.MimiResortCruiseView.create({read, transact, refresh: message => render(message), scene, lookScene});
    const dining = document.createElement("dialog");
    dining.className = "stay-dining stay-meal";
    dining.setAttribute("aria-labelledby", "stayDiningName");
    dining.innerHTML = '<div class="stay-activity-scene"><img class="stay-dining-image" alt=""></div><header><span data-meal-phase></span><h3 id="stayDiningName"></h3></header><section class="stay-dining-copy"><p data-meal-copy></p><p data-meal-status role="status"></p><div data-meal-actions></div></section>';
    scene.append(dining);
    let mealId = "", mealSequence = 0, mealBusy = false;
    function renderMeal() {
      const profile = read(), meal = world.MEALS[mealId];
      const active = profile.stay.dining.active;
      const stage = active?.id === mealId ? active.stage : "quote";
      dining.dataset.stage = stage;
      dining.querySelector("img").src = "assets/resort-dining-v1/" + mealId + (stage === "finished" ? "-finished-v1.png" : "-served-v1.png");
      dining.querySelector("img").alt = stage === "finished" ? "食事を終えた" + meal.name + "の食卓" : meal.name;
      dining.querySelector("h3").textContent = meal.name;
      dining.querySelector("[data-meal-phase]").textContent = ({quote:"注文の確認",served:"料理が届きました",tasted:"食卓で過ごす",finished:"旅の食事を覚えました"})[stage];
      dining.querySelector("[data-meal-copy]").textContent = stage === "quote"
        ? meal.description + " " + meal.price + " COINS · 所持 " + profile.coins.toLocaleString("ja-JP") + (profile.coins >= meal.price ? " → " + (profile.coins - meal.price).toLocaleString("ja-JP") : "") + " COINS"
        : stage === "served" ? meal.served : stage === "tasted" ? meal.taste : meal.memory;
      const status = dining.querySelector("[data-meal-status]");
      status.textContent = stage === "quote" && profile.coins < meal.price
        ? `あと${(meal.price - profile.coins).toLocaleString("ja-JP")} COINS。注文せず戻って、台で遊ぶこともできます。保存した遊技報酬は、島へ戻ると受け取れます。`
        : "";
      const controls = dining.querySelector("[data-meal-actions]");
      controls.replaceChildren();
      const add = (action, text, disabled = false) => {
        const button = document.createElement("button");
        button.type = "button"; button.dataset.mealAction = action; button.textContent = text; button.disabled = disabled;
        controls.append(button);
      };
      if (stage === "quote") { add("order", meal.price + " COINSで注文する", profile.coins < meal.price); add("close", "注文せず戻る"); }
      if (stage === "served") { add("taste", "ひと口いただく"); add("close", "席を離れる・食事は保存"); }
      if (stage === "tasted") { add("finish", "ゆっくり食事を終える"); add("close", "席を離れる・食事は保存"); }
      if (stage === "finished") add("leave", "ごちそうさま");
      if (dining.open) lookScene(dining.querySelector(".stay-activity-scene"), dining.querySelector("img").getAttribute("src"));
    }
    function closeMeal() {
      if (dining.dataset.stage === "finished") {
        const saved = transact(draft => world.mealAction(draft, {type:"leave", id:mealId, sequence:mealSequence}));
        if (!saved.ok) { dining.querySelector("[data-meal-status]").textContent = saved.message; return; }
      }
      dining.close();
      render();
      actions.querySelector("[data-world-meal]")?.focus();
    }
    function openMeal() {
      conversation.hidden = true; caption.hidden = false;
      mealId = read().stay.journey.location;
      const active = read().stay.dining.active;
      if (active && active.id !== mealId) {
        caption.textContent = world.SCENES[active.id].label + "に、注文済みの食事があります。その店で続きを楽しめます。";
        return;
      }
      mealSequence = read().stay.dining.sequence;
      renderMeal(); dining.showModal();
      lookScene(dining.querySelector(".stay-activity-scene"), dining.querySelector("img").getAttribute("src"));
      dining.querySelector("[data-meal-action]:not(:disabled)")?.focus();
    }
    dining.addEventListener("cancel", event => { event.preventDefault(); closeMeal(); });
    dining.addEventListener("click", event => {
      const action = event.target.closest("[data-meal-action]")?.dataset.mealAction;
      if (!action || mealBusy || event.detail > 1) return;
      if (action === "close" || action === "leave") { closeMeal(); return; }
      mealBusy = true;
      const saved = transact(draft => world.mealAction(draft, {type:action, id:mealId, sequence:mealSequence}));
      mealBusy = false;
      if (!saved.ok) { dining.querySelector("[data-meal-status]").textContent = saved.message; return; }
      mealSequence = read().stay.dining.sequence;
      renderMeal();
      dining.querySelector("button")?.focus();
    });
    function commit(journey) {
      return transact(draft => { draft.stay.journey = journey; });
    }
    function render(message = "") {
      const journey = read().stay.journey;
      const id = PLATES[journey.location] ? journey.location : "plaza";
      museum.sync(id);
      const panorama = panoramaPreview && PANORAMAS[id];
      const source = id === "museum" && museum.plate ? museum.plate : panorama ? "assets/resort-panorama-v1/" + id + "-panorama-" + (journey.time === "night" ? "night" : "day") + "-v1.png"
        : journey.time === "night" ? NIGHT_PLATES[id] : PLATES[id][0];
      // Keep the previous art AND its coordinates together until the new
      // image is decoded. The journey has already committed; loading cannot
      // debit, travel again, or leave new hotspots over the old scenery.
      if (!preparePlate(source, world.SCENES[id].label, message)) return;
      if (panorama) {
        scene.dataset.panorama = id;
        scene.style.setProperty("--panorama-ratio", panorama.width + " / " + panorama.height);
        scene.style.setProperty("--panorama-width", (100 * panorama.width / panorama.height) + "vh");
      } else {
        delete scene.dataset.panorama;
        scene.style.removeProperty("--panorama-ratio");
        scene.style.removeProperty("--panorama-width");
      }
      scene.dataset.location = id;
      scene.dataset.time = journey.time;
      scene.dataset.placeArt = String(Boolean(world.OBSERVATIONS[id]));
      onScene("home", scene, id + ":" + journey.time + (id==="museum" ? ":"+museum.room : panorama ? ":panorama" : ""));
      heading.textContent = (id==="museum" ? museum.label : world.SCENES[id].label) + " · " + ({day:"昼",sunset:"夕方",night:"夜"})[journey.time];
      caption.textContent = message || (id==="museum" ? museum.copy : PLATES[id][1]);
      if (!message && read().stay.cruise.active?.stage === "reserved") caption.textContent += "　次の予定：" + (read().stay.cruise.active.slot === "sunset" ? "夕方" : "夜") + "、桟橋の船旅。";
      const plannedMeeting = world.meetingPlan(journey);
      if (!message && plannedMeeting) caption.textContent += "　" + plannedMeeting.label + "。";
      conversation.hidden = true;
      caption.hidden = false;
      actions.replaceChildren();
      const person = world.presence(journey);
      const resident = world.RESIDENTS[person];
      if (resident) {
        const button = document.createElement("button");
        button.type = "button"; button.className = "stay-world-target stay-world-resident";
        button.dataset.worldTalk = person; button.textContent = resident.label;
        button.style.left = resident.x + "%"; button.style.top = resident.y + "%";
        actions.append(button);
      } else if (person) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "stay-world-person";
        button.dataset.worldTalk = person;
        const img = document.createElement("img");
        const newcomer = world.NEW_CAST[person];
        img.src = newcomer?.actor || (person === "guide" ? "assets/resort-art-v4/island-guide-v4.png" : "assets/resort-stay-v2/island-traveler-v2.png");
        if (newcomer) {
          for (const [key,value] of Object.entries(newcomer.placement)) button.style[key] = value+"%";
          button.setAttribute("aria-label",newcomer.name+"に話しかける");
        }
        img.alt = "";
        const name = document.createElement("span");
        name.textContent = newcomer ? newcomer.name+"に話しかける" : person === "guide" ? "案内係に話しかける" : "旅人に話しかける";
        button.append(img, name); actions.append(button);
      }
      const links = panorama ? panorama.links : LINKS[id];
      for (const [to, label, x, y] of links) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "stay-world-target";
        button.dataset.worldMove = to;
        // Keep the way out readable even when the player has not hovered a
        // small arrow. The label belongs to the pictured doorway/path.
        if (["museum","fishdiner","homekitchen","bakery","hotel","lounge"].includes(id) || (id === "galleria" && to === "promenade")) button.dataset.openAir = "true";
        button.textContent = label;
        button.style.left = `${x}%`;
        button.style.top = `${y}%`;
        actions.append(button);
      }
      if (id === "lookout" || id === "promenade" || world.OBSERVATIONS[id]) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "stay-world-target stay-world-observe";
        button.dataset.worldDiscover = world.OBSERVATIONS[id] ? id + "-view" : id === "lookout" ? "sea-light" : "store-hours";
        button.textContent = world.OBSERVATIONS[id]?.[0] || (id === "lookout" ? "海を眺める" : "店先の札を見る");
        actions.append(button);
      }
      if (id === "promenade") {
        const sign = document.createElement("span");
        sign.className = "stay-world-shop-sign";
        sign.textContent = "本日\n休業";
        actions.append(sign);
      }
      for (const [detailId, detail] of Object.entries(world.DETAILS)) {
        if (detail.place !== id) continue;
        const button = document.createElement("button");
        button.type = "button"; button.className = "stay-world-target";
        button.dataset.worldDiscover = detailId; button.textContent = detail.label;
        button.style.left = detail.x + "%"; button.style.top = detail.y + "%";
        actions.append(button);
      }
      if (world.REST_PLACES.includes(id)) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "stay-world-target stay-world-rest";
        button.dataset.worldTime = ({ day: "sunset", sunset: "night", night: "day" })[journey.time];
        button.textContent = ({ day: "夕方まで過ごす", sunset: "夜まで過ごす", night: "朝まで過ごす" })[journey.time];
        actions.append(button);
      }
      if (world.MEALS[id]) {
        const button = document.createElement("button");
        button.type = "button"; button.className = "stay-world-target";
        button.dataset.worldMeal = id; button.style.left = "50%"; button.style.top = "86%";
        button.textContent = journey.location === read().stay.dining.active?.id ? "注文した食事に戻る" : "食事を注文する · " + world.MEALS[id].price + " COINS";
        actions.append(button);
        if (read().stay.dining.memories[id]) {
          const memory = document.createElement("button");
          memory.type = "button"; memory.className = "stay-world-target";
          memory.dataset.mealMemory = id; memory.textContent = "ここでの食事を思い出す";
          memory.style.left = "27%"; memory.style.top = "75%";
          actions.append(memory);
        }
      }
      if (id === "pier") {
        const button = document.createElement("button");
        button.type = "button"; button.className = "stay-world-target";
        button.dataset.worldCruise = "true"; button.style.left = "74%"; button.style.top = "57%";
        button.textContent = read().stay.cruise.active ? "船旅の予約票を見る" : "船旅の案内を見る";
        actions.append(button);
        if (read().stay.cruise.trips) {
          const memory = document.createElement("button"); memory.type = "button"; memory.className = "stay-world-target";
          memory.textContent = "海から見た島を思い出す"; memory.style.left = "42%"; memory.style.top = "63%";
          memory.addEventListener("click", () => { caption.textContent = "海から見たガラス屋根と、窓の灯り。帰る場所のある島を、少し遠くから眺めた。"; });
          actions.append(memory);
        }
      }
      for (const button of actions.querySelectorAll(".stay-world-target")) {
        spatial(button,button.dataset.worldMove ? "exit" : "detail");
        if(button.dataset.worldMove) button.dataset.direction = Number.parseFloat(button.style.top)>80 ? "back" : "forward";
        const key = button.dataset.worldMove ? "move:" + button.dataset.worldMove
          : button.dataset.worldTalk ? "talk:" + button.dataset.worldTalk
          : button.dataset.worldDiscover ? "discover:" + button.dataset.worldDiscover
          : button.dataset.worldMeal ? "meal:" + button.dataset.worldMeal
          : button.dataset.worldTime ? "rest" : button.dataset.worldCruise ? "cruise" : "";
        const region = (panorama ? panorama.regions : REGIONS[id])?.[key];
        if (region) {
          const [x, y, width, height, direction] = region;
          button.dataset.pointRegion = "true";
          button.style.left = x + "%"; button.style.top = y + "%";
          button.style.setProperty("--point-width", width + "%");
          button.style.setProperty("--point-height", height + "%");
          if (direction) button.dataset.direction = direction;
        }
      }
      if(id==="museum")museum.decorate(actions,spatial);
      renderPursuit();
      trail?.update({id,time:journey.time,nextHint:world.outingHint(read().stay,selectedOuting)||world.trailHint(read().stay),motion:read().settings.motion});
    }
    function renderPursuit(){
      const pursuit=world.pursuits(read().stay).find(entry=>entry.selected&&entry.unlocked&&!entry.complete);
      clue.hidden=!pursuit;clue.querySelector('[data-pursuit-status]').textContent="";
      if(!pursuit)return;
      clue.dataset.pursuit=pursuit.id;clue.querySelector('[data-pursuit-title]').textContent=pursuit.title;
      clue.querySelector('[data-pursuit-next]').textContent=pursuit.next.label+" · "+world.SCENES[pursuit.next.place].label;
      clue.querySelector('[data-pursuit-frame]').textContent=pursuit.next.place===read().stay.journey.location?"ここで手がかりを探す":"続く道を見渡す";
    }
    clue.querySelector('[data-pursuit-frame]').addEventListener('click',()=>{
      if(plateRequest || scenic.active || museum.active || document.querySelector('dialog[open]'))return;
      const hint=world.pursuitHint(read().stay);if(!hint)return;
      const selector=hint.kind==="move"?'[data-world-move="'+hint.to+'"]':hint.kind==="encounter"?'[data-world-talk="'+hint.id+'"]':'[data-world-discover="'+hint.id+'"]';
      let target=actions.querySelector(selector);
      if(hint.kind==="discover"&&world.MUSEUM_WORKS[hint.id]){
        const room=museum.nextRoomFor(hint.id);if(room)target=actions.querySelector('[data-museum-room="'+room+'"]');
      }
      if(target)framePoint(target);
    });
    clue.querySelector('[data-pursuit-pause]').addEventListener('click',()=>{
      if(plateRequest || document.querySelector('dialog[open]'))return;
      const saved=transact(draft=>{draft.stay.journey.pursuit="";});
      if(!saved.ok){clue.querySelector('[data-pursuit-status]').textContent=saved.message;return;}
      render("手がかりは島の案内に残して、今は気の向く方へ歩こう。");
    });
    function act(action,source=document.activeElement) {
      if (cruise.sailing() || plateRequest || scenic.active || museum.active) return;
      if(action.type==="discover" && world.museumMoment(read().stay,action.id)){
        const room=museum.nextRoomFor(action.id);if(room){museum.move(room);return;}
        museum.open(action.id,source);return;
      }
      if(action.type==="discover" && world.scenicMoment(read().stay,action.id)){scenic.open(action.id,source);return;}
      const firstWords = action.type === "encounter" ? world.encounterText(read().stay, action.id) : "";
      const next = world.transition(read().stay.journey, action);
      if (!next.ok) return;
      const saved = commit(next.journey);
      if (!saved.ok) { caption.textContent = saved.message; return; }
      if(action.type==="encounter" && action.id===selectedOuting && world.outings(read().stay).some(walk=>walk.id===action.id&&walk.complete))selectedOuting="";
      if (action.type === "move" && VIEW_GATEWAYS[action.to]) {
        navigate(VIEW_GATEWAYS[action.to]);
        return;
      }
      const observation = world.OBSERVATIONS[read().stay.journey.location];
      const detail = world.DETAILS[action.id];
      const message = action.type === "discover"
        ? detail ? detail[read().stay.journey.time === "night" ? "night" : "day"]
        : observation ? observation[read().stay.journey.time === "night" ? 2 : 1]
        : action.id === "sea-light" ? read().stay.journey.visited.includes("shop")
          ? "ガラスのような海の青。店で見た小さな品にも、この色があった。"
          : "ガラスのような海の青。何か、この色を部屋へ持ち帰れたら。"
        : "小さな店先には「本日休業」の札。海の方へ、もう少し歩いてみよう。"
        : "";
      render(message);
      if (action.type === "encounter") {
        speaker = action.id;
        const episode = world.encounterEpisode(read().stay, speaker);
        episodeReply.hidden = !episode?.ready || episode.complete;
        episodeReply.textContent = episode?.label || "";
        const offer = world.meetingOffer(read().stay.journey, speaker);
        meetingReply.hidden = !offer;
        meetingReply.textContent = offer?.choice || "";
        refreshPersonal();
        outingReply.hidden=!world.outings(read().stay).some(walk=>walk.id===speaker&&!walk.complete);
        outingReply.textContent=speaker==="noel"?"二つの青を見に行く":"庭と高台を歩いてみる";
        conversation.querySelector("[data-world-reply]").hidden=!outingReply.hidden;
        conversation.hidden = false; caption.hidden = true;
        document.querySelector("[data-world-speaker]").textContent = world.NEW_CAST[speaker]?.name || world.RESIDENTS[speaker]?.name || (speaker === "guide" ? (read().stay.journey.location === "lounge" ? "仕事を終えた案内係" : "巡回中の案内係") : "島を歩く旅人");
        say(firstWords);
        conversation.querySelector("button").focus();
        return;
      }
      heading.focus({ preventScroll: true });
    }
    function showMap() {
      if (plateRequest) return;
      const journey = read().stay.journey;
      const plan = world.meetingPlan(journey);
      mapPlan.hidden = !plan;
      mapPlan.dataset.plan = plan?.id || "";
      mapPlan.querySelector("[data-meeting-note]").textContent = plan ? plan.label + "。時間帯は自分で進められます。別の予定を優先しても、次の同じ時間帯に会えます。" : "";
      mapPlan.querySelector("[data-meeting-status]").textContent = "";
      mapClues.replaceChildren();
      const walks=world.outings(read().stay);
      if(walks.some(walk=>walk.id===selectedOuting&&walk.complete))selectedOuting="";
      const pursuits=world.pursuits(read().stay).filter(entry=>entry.unlocked);
      mapClues.hidden=false;
      const walkTitle=document.createElement("h4");walkTitle.textContent="島の人が教える寄り道 · 無料の散歩";mapClues.append(walkTitle);
      for(const walk of walks){
        const button=document.createElement("button");button.type="button";button.dataset.walkSelect=walk.id;button.className="stay-walk-choice";
        const title=document.createElement("strong"),copy=document.createElement("span");title.textContent=walk.title+(walk.complete?" · 旅の記憶に残した":"");copy.textContent=walk.copy;button.append(title,copy);button.disabled=walk.complete;
        button.setAttribute("aria-pressed",String(selectedOuting===walk.id));
        button.addEventListener("click",()=>{selectedOuting=walk.id;showOuting(walk.id);for(const choice of mapClues.querySelectorAll('[data-walk-select]'))choice.setAttribute("aria-pressed",String(choice.dataset.walkSelect===walk.id));});mapClues.append(button);
      }
      if(pursuits.length){const title=document.createElement('h4');title.textContent="気になった作品の続き";mapClues.append(title);}
      for(const pursuit of pursuits){
        const button=document.createElement('button');button.type="button";button.dataset.pursuitSelect=pursuit.id;
        button.textContent= pursuit.title+(pursuit.complete?" · 思い出に残した":pursuit.selected?" · 探している":" · 続きを探す");
        button.disabled=pursuit.complete;
        button.addEventListener('click',()=>{
          const saved=transact(draft=>{if(!world.pursuits(draft.stay).some(entry=>entry.id===pursuit.id&&entry.unlocked&&!entry.complete))return "この手がかりは今は選べません。";draft.stay.journey.pursuit=pursuit.id;});
          if(!saved.ok){mapRoute.textContent=saved.message;return;}
          selectedOuting="";
          map.close();render();
        });mapClues.append(button);
      }
      mapCanvas.replaceChildren();
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("viewBox", "0 0 1000 480"); svg.setAttribute("preserveAspectRatio", "none"); svg.setAttribute("aria-hidden", "true");
      for (const place of Object.values(world.SCENES)) for (const exit of place.exits) {
        if (place.id > exit) continue;
        const line = document.createElementNS(svg.namespaceURI, "line");
        const a = MAP_POINTS[place.id], b = MAP_POINTS[exit];
        for (const [key, value] of Object.entries({ x1: a[0] * 10, y1: a[1] * 4.8, x2: b[0] * 10, y2: b[1] * 4.8 })) line.setAttribute(key, value);
        svg.append(line);
      }
      mapCanvas.append(svg);
      for (const [id, [x, y]] of Object.entries(MAP_POINTS)) {
        const button = document.createElement("button");
        button.type = "button"; button.dataset.mapDestination = id;
        button.style.left = x + "%"; button.style.top = y + "%";
        button.textContent = world.SCENES[id].label;
        button.dataset.visited = String(journey.visited.includes(id));
        if (id === journey.location) button.setAttribute("aria-current", "location");
        button.addEventListener("click", () => {
          selectedOuting="";
          for(const choice of mapClues.querySelectorAll('[data-walk-select]'))choice.setAttribute("aria-pressed","false");
          showRoute(id);
        });
        mapCanvas.append(button);
      }
      mapRoute.textContent = "現在地：" + world.SCENES[journey.location].label + "。行きたい場所を選ぶと、ここからの道順が分かります。";
      mapWalk.hidden = true;
      if(selectedOuting)showOuting(selectedOuting);
      map.showModal();
    }
    function showRoute(id) {
      delete mapWalk.dataset.action;delete mapWalk.dataset.target;
      const path = world.route(read().stay.journey.location, id);
      mapRoute.textContent = path.length === 1 ? "今、ここにいます。" : path.map(step => world.SCENES[step].label).join(" → ");
      mapWalk.hidden = path.length < 2;
      mapWalk.dataset.next = path[1] || "";
      mapWalk.textContent = path.length > 1 ? "まず「" + world.SCENES[path[1]].label + "」へ" : "";
    }
    function showOuting(id){
      const walk=world.outings(read().stay).find(entry=>entry.id===id);if(!walk || walk.complete)return;
      showRoute(walk.next.place);
      mapRoute.textContent=walk.next.label+" · "+mapRoute.textContent;
      if(walk.next.place===read().stay.journey.location){
        mapWalk.hidden=false;mapWalk.dataset.action=walk.next.kind;mapWalk.dataset.target=walk.next.id;
        mapWalk.textContent=walk.next.kind==="discover"&&world.MUSEUM_WORKS[walk.next.id]&&museum.nextRoomFor(walk.next.id)?"作品のある展示室へ":walk.next.label;
      }
    }
    mapPlan.querySelector("[data-meeting-route]").addEventListener("click", () => {
      const plan = world.meetingPlan(read().stay.journey);
      if (plan) showRoute(plan.place);
    });
    mapPlan.querySelector("[data-meeting-cancel]").addEventListener("click", () => {
      const next = world.transition(read().stay.journey, {type:"cancel-promise", id:mapPlan.dataset.plan});
      const result = next.ok ? commit(next.journey) : {ok:false, message:"予定が変わりました。島の案内を開き直してください。"};
      if (!result.ok) { mapPlan.querySelector("[data-meeting-status]").textContent = result.message; return; }
      render(); mapPlan.hidden = true;
      mapRoute.textContent = "約束を取り消しました。また会ったときに声をかけられます。";
      mapWalk.hidden = true;
      map.querySelector("[data-world-map-close]").focus();
    });
    mapOpen.addEventListener("click", showMap);
    map.querySelector("[data-world-map-close]").addEventListener("click", () => map.close());
    map.addEventListener("close", () => {
      mapOpen.focus();
      const journey=read().stay.journey;
      trail?.update({id:journey.location,time:journey.time,nextHint:world.outingHint(read().stay,selectedOuting)||world.trailHint(read().stay),motion:read().settings.motion});
    });
    mapWalk.addEventListener("click", () => {
      const next = mapWalk.dataset.next;
      const action=mapWalk.dataset.action,target=mapWalk.dataset.target;
      map.close();
      if(action)act({type:action,id:target});
      else if (next) act({ type: "move", to: next });
    });
    actions.addEventListener("click", event => {
      if (event.detail > 1) return;
      const button = event.target.closest("button");
      if(button?.dataset.museumRoom) museum.move(button.dataset.museumRoom);
      if(button?.dataset.museumObject) museum.inspect(button.dataset.museumObject);
      if (button?.dataset.worldMove) act({ type: "move", to: button.dataset.worldMove });
      if (button?.dataset.worldDiscover) act({ type: "discover", id: button.dataset.worldDiscover });
      if (button?.dataset.worldTime) act({ type: "time", to: button.dataset.worldTime });
      if (button?.dataset.worldTalk) act({ type: "encounter", id: button.dataset.worldTalk });
      if (button?.dataset.worldMeal) openMeal();
      if (button?.dataset.worldCruise) { conversation.hidden = true; caption.hidden = false; cruise.open(); }
      if (button?.dataset.mealMemory) caption.textContent = world.MEALS[button.dataset.mealMemory].memory;
    });
    document.querySelector("[data-world-reply]").addEventListener("click", () => {
      say(world.encounterText(read().stay, speaker, true));
    });
    meetingReply.addEventListener("click", event => {
      if (event.detail > 1) return;
      const offer = world.meetingOffer(read().stay.journey, speaker);
      const next = world.transition(read().stay.journey, {type:"promise", id:offer?.id});
      const result = next.ok ? commit(next.journey) : {ok:false, message:"今はその約束をできません。もう一度声をかけてください。"};
      if (!result.ok) { document.querySelector("[data-world-dialogue]").textContent = result.message; return; }
      say(offer.confirmation);
      meetingReply.hidden = true;
      conversation.querySelector("[data-world-farewell]").focus();
    });
    episodeReply.addEventListener("click", event => {
      if (event.detail > 1) return;
      const episode = world.encounterEpisode(read().stay, speaker);
      const result = transact(draft => world.finishEncounter(draft, speaker));
      if (!result.ok) { document.querySelector("[data-world-dialogue]").textContent = result.message; return; }
      say(episode.story + (speaker === "curator" ? "　食卓のミニプリントを受け取りました。客室で飾れます。" : ""));
      episodeReply.hidden = true;
      conversation.querySelector("[data-world-farewell]").focus();
    });
    function farewell() {
      conversation.hidden = true; caption.hidden = false;
      actions.querySelector("[data-world-talk]")?.focus();
    }
    document.querySelector("[data-world-farewell]").addEventListener("click", farewell);
    document.addEventListener("keydown", event => {
      if (currentView === "home" && event.key === "Escape" && !conversation.hidden) { event.preventDefault(); farewell(); }
    });
    actions.addEventListener("keydown", event => {
      if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
      const buttons = [...actions.querySelectorAll("button")];
      const index = buttons.indexOf(event.target);
      if (index < 0) return;
      event.preventDefault();
      const direction = ["ArrowRight", "ArrowDown"].includes(event.key) ? 1 : -1;
      buttons[(index + direction + buttons.length) % buttons.length].focus();
    });

    function enter(view, previous) {
      if (cruise.sailing() && view !== "home") return {ok:false, message:"船旅を終えて桟橋へ戻ってください。"};
      if(view!=="home")scenic.close();
      if(view!=="home")museum.close();
      if (view !== "home") cancelPlateRequest();
      if (view !== "home") cruise.close();
      if (view !== "home" && dining.open) dining.close();
      const journey = read().stay.journey;
      let location = journey.location;
      if (view === "home") {
        if (["slot", "machines", "holdem-result"].includes(previous)) location = "plaza";
        else if (previous === "shop" || location === "shop") location = "galleria";
        else if (previous === "room" || location === "room") location = "hotel";
        else if (location === "casino") location = "plaza";
      } else if (view === "shop") location = "shop";
      else if (view === "room") location = "room";
      else if (view === "machines" || view === "slot") location = "casino";
      else { currentView = view; trail?.setActive(false); return { ok: true }; }
      // Existing cabinet/room entry points are retained. Their explicit return
      // is a boundary entry, not a reward or a fabricated walk through scenes.
      if (location !== journey.location) {
        const next = { ...journey, location, arrived: true, visited: [...new Set([...journey.visited, location])] };
        const saved = commit(next);
        if (!saved.ok) return saved;
      }
      currentView = view;
      trail?.setActive(view === "home");
      if (view === "home") { render(); if (cruise.sailing()) cruise.open(); }
      return { ok: true };
    }
    return { enter, render, refreshPersonal, get view() { return currentView; } };
  }
  root.MimiResortWorldView = Object.freeze({ create });
})(window);
