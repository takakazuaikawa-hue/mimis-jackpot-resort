/* Non-slot stay: all money, ownership and placement commit through one profile
 * write before visible changes. Goods/prices/dialogue remain production proposals. */
(function (root) {
  "use strict";
  const world = root.MimiResortWorld;
  const goods = world.GOODS;
  const rewards = root.MimiResortRewards;
  const fmt = value => value.toLocaleString("ja-JP");
  function create({ read, transact, navigate, onMotionChange = () => {} }) {
    const find = selector => document.querySelector(selector);
    const dialogue = find("[data-stay-dialogue]");
    const status = find("[data-stay-status]");
    const purchaseActions = find("[data-stay-purchase-actions]");
    const roomActions = find("[data-stay-room-actions]");
    const roomStatus = find("[data-stay-room-status]");
    const archive = find(".stay-archive");
    const memory = find(".stay-memory");
    const product = find(".stay-product");
    const arrange = find(".stay-room-controls");
    const roomItems = find("[data-stay-room-items]");
    const talkActions = find(".stay-talk-actions");
    const personalOpen = find("[data-stay-personal-open]");
    const personalStep = find("[data-stay-luana-step]");
    const motionQuery = root.matchMedia?.("(prefers-reduced-motion: reduce)") ?? null;
    // A bounded reading aid, separate from game progress. Session storage keeps
    // the spoken words across reloads/cabinet visits without another profile write.
    const historyKey = "mimi-resort-conversations-v1", historyLimit = 60;
    let historyEntries = [], historyStored = true, historyOpener = null, pendingWords = null;
    try {
      const raw = JSON.parse(sessionStorage.getItem(historyKey) || "[]");
      if (Array.isArray(raw)) historyEntries = raw.filter(entry => entry && typeof entry.speaker === "string" && entry.speaker.length <= 40 && typeof entry.text === "string" && entry.text.length <= 1200 && Object.hasOwn(world.SCENES, entry.place) && ["day","sunset","night"].includes(entry.time)).slice(-historyLimit);
    } catch (_) { historyStored = false; }
    const history = document.createElement("dialog");
    history.className = "stay-travel-journal stay-conversation-history";
    history.setAttribute("aria-labelledby", "stayHistoryHeading");
    history.innerHTML = '<button type="button" class="stay-product-close" aria-label="会話の履歴を閉じる">×</button><h2 id="stayHistoryHeading">会話の履歴</h2><p data-history-note></p><div data-history-entries></div>';
    find("#appRoot").append(history);
    const chapter = document.createElement("dialog");
    chapter.className = "stay-travel-journal stay-chapter-journal";
    chapter.setAttribute("aria-labelledby", "stayChapterHeading");
    chapter.innerHTML = '<button type="button" class="stay-product-close" data-chapter-close aria-label="旅のしおりを閉じる">×</button><p class="stay-journal-eyebrow">心と旅 · 第一章</p><h2 id="stayChapterHeading">はじめての滞在</h2><p class="stay-chapter-lead">勝負の熱を持って島へ出て、景色と人に出会い、自分の部屋へ帰る。順番や寄り道は自由です。</p><ol data-chapter-steps></ol><p class="stay-chapter-next" data-chapter-next></p><p role="status" data-chapter-status></p><div class="stay-chapter-actions"><button type="button" class="stay-primary" data-chapter-finish>第一章を結ぶ</button><button type="button" data-chapter-close>旅へ戻る</button></div>';
    find("#appRoot").append(chapter);
    let chapterOpener = null;
    function renderChapter() {
      const state = world.chapterOne(read().stay), list = chapter.querySelector("[data-chapter-steps]");
      list.replaceChildren();
      for (const step of state.steps) {
        const item = document.createElement("li"), mark = document.createElement("span"), copy = document.createElement("div"), title = document.createElement("strong"), hint = document.createElement("p");
        item.dataset.done = String(step.done || state.complete); mark.textContent = step.done || state.complete ? "✓" : "○";
        title.textContent = step.label; hint.textContent = step.hint; copy.append(title,hint); item.append(mark,copy); list.append(item);
      }
      const next = state.steps.find(step => !step.done);
      chapter.querySelector("[data-chapter-next]").textContent = state.complete ? "第一章は客室の記録に残りました。島の次の一日は、好きな場所から始められます。" : next ? "次の手掛かり — " + next.hint : "客室で、この一日を旅の記憶に残せます。";
      chapter.querySelector("[data-chapter-finish]").hidden = !state.readyToClose || state.complete;
    }
    function rememberWords(speaker, text) {
      if (!text) return;
      const {location:place,time} = read().stay.journey;
      const entry = {speaker, text, place, time}, last = historyEntries.at(-1);
      if (last && ["speaker","text","place","time"].every(key => last[key] === entry[key])) return;
      historyEntries.push(entry); historyEntries = historyEntries.slice(-historyLimit);
      try { sessionStorage.setItem(historyKey, JSON.stringify(historyEntries)); historyStored = true; }
      catch (_) { historyStored = false; }
    }
    function sayLuana(text) {
      dialogue.textContent = text;
      if (product.open) pendingWords = text;
      else rememberWords("ルアナ", text);
    }
    function showHistory(button) {
      historyOpener = button;
      const entries = history.querySelector("[data-history-entries]"); entries.replaceChildren();
      history.querySelector("[data-history-note]").textContent = !historyEntries.length ? "まだ会話はありません。島で聞いた言葉を、ここで読み返せます。"
        : "最近聞いた言葉を、新しい順に表示しています（最大60件）。" + (historyStored ? "" : " 履歴を保存できないため、画面を開き直すと今回の言葉は残りません。");
      for (const entry of [...historyEntries].reverse()) {
        const section = document.createElement("section"), label = document.createElement("h3"), where = document.createElement("small"), text = document.createElement("p");
        label.textContent = entry.speaker;
        where.textContent = world.SCENES[entry.place].label + " · " + ({day:"昼",sunset:"夕方",night:"夜"})[entry.time];
        text.textContent = entry.text; section.append(where,label,text); entries.append(section);
      }
      history.showModal(); history.scrollTop = 0; history.querySelector("button").focus();
    }
    for (const header of document.querySelectorAll(".stay-spatial-header")) {
      const motionButton = document.createElement("button");
      motionButton.type = "button"; motionButton.className = "stay-sound stay-motion";
      motionButton.dataset.stayMotion = "";
      header.insertBefore(motionButton, header.querySelector("[data-stay-sound]"));
      const casinoButton = document.createElement("button");
      casinoButton.type = "button"; casinoButton.className = "stay-casino-entry";
      casinoButton.dataset.route = "machines"; casinoButton.textContent = "カジノフロアへ";
      casinoButton.addEventListener("click", () => navigate("machines"));
      header.append(casinoButton);
      const chapterButton = document.createElement("button"); chapterButton.type = "button"; chapterButton.className = "stay-map-open stay-chapter-open"; chapterButton.textContent = "旅のしおり";
      header.insertBefore(chapterButton, header.querySelector(".wallet")); chapterButton.addEventListener("click", () => { chapterOpener = chapterButton; renderChapter(); chapter.querySelector("[data-chapter-status]").textContent = ""; chapter.showModal(); chapter.querySelector("[data-chapter-close]").focus(); });
      const button = document.createElement("button"); button.type = "button"; button.className = "stay-map-open stay-history-open"; button.textContent = "会話の履歴";
      header.insertBefore(button, header.querySelector(".wallet")); button.addEventListener("click", () => showHistory(button));
    }
    history.querySelector("button").addEventListener("click", () => history.close());
    history.addEventListener("keydown", event => { if (event.key === "Escape") event.stopPropagation(); });
    history.addEventListener("close", () => historyOpener?.focus({preventScroll:true}));
    chapter.querySelectorAll("[data-chapter-close]").forEach(button => button.addEventListener("click", () => chapter.close()));
    chapter.addEventListener("keydown", event => { if (event.key === "Escape") event.stopPropagation(); });
    chapter.addEventListener("close", () => chapterOpener?.focus({preventScroll:true}));
    chapter.querySelector("[data-chapter-finish]").addEventListener("click", () => {
      const result = transact(draft => world.finishChapterOne(draft));
      chapter.querySelector("[data-chapter-status]").textContent = result.ok ? "第一章を旅の記憶に残しました。次の朝も、島とカジノを自由に歩けます。" : result.message;
      renderChapter();
    });
    product.addEventListener("close", () => { if (pendingWords && currentView === "shop") rememberWords("ルアナ", pendingWords); pendingWords = null; });
    const personal = document.createElement("dialog");
    personal.className = "stay-personal";
    personal.setAttribute("aria-labelledby", "stayPersonalHeading");
    personal.innerHTML = '<div class="stay-personal-visual" aria-hidden="true" inert></div><header class="stay-personal-header"><div><p data-personal-place></p><h2 id="stayPersonalHeading"></h2></div><button type="button" data-personal-action="close" aria-label="会話を閉じる">×</button></header><section class="stay-personal-subtitle"><p class="stay-personal-speaker" data-personal-speaker></p><p class="stay-personal-copy" data-personal-copy aria-live="polite" aria-atomic="true"></p><p role="status" data-personal-status></p><div data-personal-actions></div></section>';
    find("#appRoot").append(personal);
    let personalId = "", personalPhase = "", personalOpener = null, personalScene = null, personalFrame = 0, personalStay = null;
    function setPersonalVisual(episode) {
      const visual = personal.querySelector(".stay-personal-visual"); visual.replaceChildren();
      personal.dataset.time = read().stay.journey.time;
      personal.dataset.motion = String(read().settings.motion);
      // Use the authored wide composition so a prior look-around cannot leave
      // the speaker outside the frame. Clones have no controls or active canvases.
      const source = episode.id === "luana" ? find(".stay-shop-scene") : find("[data-world-scene]");
      const backdrop = source.cloneNode(true), actor = backdrop.querySelector(".stay-world-person");
      backdrop.style.setProperty("--look-x","0px"); backdrop.style.setProperty("--look-y","0px"); backdrop.style.setProperty("--look-scale","1");
      if (actor) {
        const figure = document.createElement("div"); figure.className = actor.className;
        figure.style.cssText = actor.style.cssText;
        figure.dataset.worldTalk = actor.dataset.worldTalk;
        figure.append(actor.querySelector("img").cloneNode(true)); backdrop.append(figure);
      }
      backdrop.querySelectorAll("nav,button,a,canvas,.stay-look-help,.stay-scene-actions,.stay-trail-guide,[data-world-caption]").forEach(node=>node.remove());
      for (const node of [backdrop,...backdrop.querySelectorAll("*")]) {
        for (const attribute of [...node.attributes]) if (attribute.name === "id" || attribute.name === "tabindex" || attribute.name === "aria-busy" || (attribute.name.startsWith("data-") && !["data-location","data-time","data-world-talk"].includes(attribute.name))) node.removeAttribute(attribute.name);
      }
      visual.append(backdrop);
      const privateArt = world.NEW_CAST[episode.id]?.privateArt || (episode.id === "luana" ? "assets/resort-stay-v2/luana-window-night-v3.png" : "");
      if (privateArt && ["invite","afterglow","complete"].includes(episode.phase)) {
        const art = document.createElement("img"); art.className = "stay-personal-night"; art.alt = "";
        if (world.NEW_CAST[episode.id]) art.dataset.islandCast = "true";
        art.addEventListener("load",()=>{ art.dataset.ready="true"; },{once:true});
        art.src = privateArt;
        if (art.complete && art.naturalWidth) art.dataset.ready="true";
        visual.append(art); // The live scene remains visible if the new art fails.
      }
    }
    function renderPersonal() {
      const frame = personalScene.frames[personalFrame];
      personal.dataset.phase = personalPhase; personal.dataset.blackout = String(!!frame.blackout);
      personal.dataset.frame = String(personalFrame);
      personal.querySelector("h2").textContent = personalScene.title;
      const cast = world.NEW_CAST[personalId];
      const placeLabel = cast && ["invite","afterglow","complete"].includes(personalPhase) ? cast.privatePlace : world.SCENES[read().stay.journey.location].label + " · " + ({day:"昼",sunset:"夕方",night:"夜"})[read().stay.journey.time];
      personal.querySelector("[data-personal-place]").textContent = placeLabel + (cast ? " · "+cast.name+" "+cast.age+"歳" : "");
      personal.querySelector("[data-personal-speaker]").textContent = frame.speaker;
      personal.querySelector("[data-personal-copy]").textContent = frame.text;
      personal.querySelector("[data-personal-status]").textContent = "";
      const actions = personal.querySelector("[data-personal-actions]"); actions.replaceChildren();
      const add = (type,label,choice) => { const button = document.createElement("button"); button.type="button"; button.dataset.personalAction=type; if(choice !== undefined)button.dataset.personalChoice=String(choice); button.textContent=label; actions.append(button); };
      if (frame.choices) frame.choices.forEach((label,index)=>add("reply",label,index));
      else if (frame.action) { add(frame.action,frame.label); if(frame.decline)add("close",frame.decline); }
      else add("next",frame.blackout ? "余韻の続きを見る" : "続きを聞く");
      rememberWords(frame.speaker,frame.text);
      if (personal.open) actions.querySelector("button").focus();
    }
    function renderLuanaThread() {
      const episode = world.relationshipEpisode(read().stay,"luana");
      const copy = episode.phase === "complete"
        ? {label:"ルアナとの思い出を見る", step:"ふたりの時間は、客室の旅の記録にも残っている。"}
        : episode.phase === "afterglow"
          ? {label:"昨夜の続きを話す", step:"ルアナは、昨夜の続きを話したそうにしている。"}
          : episode.phase === "invite"
            ? {label:"ルアナの誘いを聞く", step:"今夜は売場を離れて、ふたりで話せそうだ。"}
            : episode.count === 0
              ? {label:"ルアナとゆっくり話す", step:"まずは、ルアナ自身の話を聞いてみよう。"}
              : episode.count === 1
                ? {label:"ルアナにまた会いに来る", step:"昼・夕方・夜のうち、前とは違う時間にもう一度会おう。"}
                : {label:"ルアナとゆっくり話す", step:"次は夜に訪ねると、ルアナから話したいことがあるようだ。"};
      personalOpen.textContent = copy.label;
      personalStep.textContent = copy.step;
    }
    function openPersonal(id, opener) {
      const episode = world.relationshipEpisode(read().stay,id);
      if (!episode?.here) return;
      personalId=id; personalOpener=opener;
      personalPhase=episode.phase; personalFrame=0;
      personalStay=read().stay; personalScene=world.relationshipScene(personalStay,id);
      setPersonalVisual(episode); renderPersonal();
      personal.showModal(); personal.querySelector("[data-personal-actions] button").focus();
    }
    personal.addEventListener("keydown", event => { if (["Escape","Enter"," "].includes(event.key)) event.stopPropagation(); });
    personal.addEventListener("close", () => { worldView.refreshPersonal(); renderLuanaThread(); if(personalOpener?.isConnected && personalOpener.getClientRects().length)personalOpener.focus({preventScroll:true}); });
    personal.addEventListener("click", event => {
      const button = event.target.closest("[data-personal-action]"), type = button?.dataset.personalAction;
      if (!type || event.detail > 1) return;
      if (type === "close") { personal.close(); return; }
      const frame = personalScene.frames[personalFrame];
      if (type === "next" && !frame.action && !frame.choices && personalFrame < personalScene.frames.length-1) { personalFrame++; renderPersonal(); return; }
      if (type === "reply" && frame.choices) {
        const choice=Number(button.dataset.personalChoice);
        if (!Number.isInteger(choice) || !frame.choices[choice]) return;
        personalScene=world.relationshipScene(personalStay,personalId,choice); personalFrame++; renderPersonal(); return;
      }
      if (type !== frame.action) return;
      const result=transact(draft=>world.relationshipAction(draft,personalId,type,personalPhase));
      if (!result.ok) { personal.querySelector("[data-personal-status]").textContent=result.message; return; }
      if (type === "talk" || type === "continue") { personal.close(); return; }
      personalStay=read().stay; personalScene=world.relationshipScene(personalStay,personalId); personalPhase=personalScene.episode.phase; personalFrame=0;
      setPersonalVisual(personalScene.episode); renderPersonal();
    });
    personalOpen.addEventListener("click",()=>openPersonal("luana",personalOpen));
    const storyOpen = document.createElement("button");
    storyOpen.type = "button"; storyOpen.textContent = "旅の話をする";
    talkActions.insertBefore(storyOpen, find("[data-stay-conversation-close]"));
    const storyActions = document.createElement("div");
    storyActions.className = "stay-talk-actions stay-story-actions";
    storyActions.hidden = true;
    storyActions.setAttribute("aria-label", "ルアナに話す旅のこと");
    talkActions.after(storyActions);
    const journalButton = document.createElement("button");
    journalButton.type = "button";
    journalButton.className = "stay-scene-action stay-room-journal";
    journalButton.textContent = "旅を振り返る";
    find(".stay-room").append(journalButton);
    const journal = document.createElement("dialog");
    journal.className = "stay-travel-journal";
    journal.setAttribute("aria-labelledby", "stayJournalHeading");
    journal.innerHTML = '<button type="button" class="stay-product-close" data-journal-close aria-label="旅の記憶を閉じる">×</button><p class="stay-journal-eyebrow">海の見える客室</p><h2 id="stayJournalHeading">旅を振り返る</h2><div data-journal-experiences></div><div data-journal-reflections></div><p role="status" data-journal-status></p><button type="button" class="stay-primary" data-journal-save>この滞在を覚えておく</button>';
    find(".stay-room").append(journal);
    const ambience = root.MimiResortAmbience.create();
    const look = root.MimiResortLook.create();
    // Keep shop/room targets attached to the art while the player looks around.
    find(".stay-shop-scene").append(find(".stay-scene-actions"));
    document.querySelectorAll(".stay-scene-actions button").forEach(button => {
      if (!button.hasAttribute("data-stay-personal-open")) look.spatial(button,button.hasAttribute("data-route")?"exit":"detail");
    });
    for(const button of document.querySelectorAll(".stay-room > .stay-scene-action")) { find(".stay-room-scene").append(button); look.spatial(button); }
    function scene(view, node, signature) {
      ambience.setScene(view, read().stay.journey, read().settings.sound, read().settings.motion);
      ambience.reveal(node, signature);
      look.scene(node,signature);
    }
    const worldView = root.MimiResortWorldView.create({ read, transact, navigate, onScene: scene, spatial:look.spatial, lookScene:look.scene, framePoint:look.framePoint, composeScene:look.compose, onDialogue:rememberWords, onPersonal:openPersonal });
    let currentView = "title", confirming = false, selected = "postcard", selectedRoom = "postcard";
    const itemFor = id => goods.find(entry => entry.id === id);
    function pose(name) {
      for (const img of document.querySelectorAll(".stay-shop-actor,.stay-shop-hand")) img.src = "assets/resort-stay-v2/luana-" + name + "-v2.png";
    }

    function greeting() {
      const stay = read().stay;
      const lastStory = world.luanaTopics(stay).find(entry => entry.id === stay.luanaStories.at(-1));
      if (lastStory) return lastStory.greeting;
      if (stay.journey.time === "night") return stay.metLuana
        ? "おかえりなさい。ガラス屋根が、今は星の色ね。前に話した場所も、夜には違って見えるわ。"
        : "こんばんは。夜のガレリアへようこそ。まだ売場は開いているから、ゆっくり見ていってね。";
      if (stay.placements.lamp) return "灯りを置いてくれたのね。夜の部屋、少し好きになれたかしら。";
      if (stay.souvenirs.includes("sea-glass")) return stay.placements["sea-glass"]
        ? "あのガラス、部屋ではどんな青に見えた？ 同じ品でも、置く場所で変わるの。"
        : "ガラスのうさぎは、窓の近くがおすすめ。あの海の色に会えると思うわ。";
      if (stay.ownedPostcard) return stay.displaySpot
        ? "あの絵はがき、飾ってくれたのね。部屋で見ると、同じ景色も少し違って見えるでしょう？"
        : "絵はがきは、お部屋へ持っていってね。飾る場所が決まったら、また聞かせて。";
      if (world.dialogueContext(stay).seenSea) return "海の回廊を歩いてきたのね。あの青、ここから見る空とは少し違うでしょう。";
      if (stay.journey.encounters.includes("guide")) return "島の案内係に会ったのね。あの人はいつも、きれいな寄り道を教えてくれるの。";
      if (stay.preference === "sunlight") return "おかえりなさい。光がきれいだって話してくれたの、覚えてる。この絵はがきも、同じガラス屋根の下で描かれたの。";
      if (stay.preference === "sea") return "おかえりなさい。海を眺めるのが好きだったわね。窓辺にあのガラスを置くと、島の青とよく合うの。";
      return "いらっしゃい。今日は、どんな景色に出会った？";
    }
    function openConversation() {
      pose("listen"); storyActions.hidden = true; talkActions.hidden = false;
      storyOpen.hidden = !world.luanaTopics(read().stay).length;
      talkActions.querySelector("button").focus();
    }
    function closeConversation() {
      pose("welcome"); talkActions.hidden = true; storyActions.hidden = true;
      find("[data-stay-conversation-open]").focus({ preventScroll: true });
    }
    function openStories() {
      storyActions.replaceChildren();
      const add = (label, action, id = "") => {
        const button = document.createElement("button"); button.type = "button";
        button.textContent = label; button.dataset.storyAction = action;
        if (id) button.dataset.storyId = id;
        storyActions.append(button);
      };
      const topics = world.luanaTopics(read().stay);
      topics.filter(entry => !entry.shared).concat(topics.filter(entry => entry.shared)).forEach(entry => add(entry.label, "share", entry.id));
      add("話題を戻す", "back"); add("またね", "close");
      talkActions.hidden = true; storyActions.hidden = false;
      storyActions.querySelector("button").focus();
    }
    function renderPurchase() {
      const profile = read(), item = itemFor(selected);
      const preview = find("[data-stay-product-preview]");
      preview.dataset.item = item.id;
      preview.querySelector("img").src = item.image;
      preview.querySelector("img").alt = item.name;
      find("#stayProductName").textContent = item.name;
      find("[data-stay-product-kind]").textContent = item.kind;
      find("[data-stay-product-copy]").textContent = item.description;
      find("[data-stay-price]").textContent = fmt(item.price);
      const owned = profile.stay.souvenirs.includes(item.id);
      find("[data-stay-owned]").textContent = owned ? "所持しています" : "客室に飾れます";
      if (owned) {
        confirming = false;
        purchaseActions.innerHTML = '<button class="stay-primary" data-stay-action="room" type="button">客室で飾る →</button>';
      } else if (confirming) {
        purchaseActions.innerHTML = '<p class="stay-confirm-copy">' + fmt(item.price) + ' COINSで購入します。<br>残高 ' + fmt(profile.coins) + ' → ' + fmt(Math.max(0, profile.coins - item.price)) + ' COINS</p><div class="stay-confirm-actions"><button class="stay-primary" data-stay-action="confirm" type="button">購入する</button><button data-stay-action="cancel" type="button">やめる</button></div>';
      } else purchaseActions.innerHTML = '<button class="stay-primary" data-stay-action="buy" type="button">この品を選ぶ</button>';
    }
    function renderRoom() {
      const stay = read().stay;
      find(".stay-room").dataset.time = stay.journey.time;
      scene("room", find(".stay-room-scene"), "room:" + stay.journey.time);
      find(".stay-room-background").src = stay.journey.time === "night" ? "assets/resort-stay-v2/guest-room-night-v2.png" : "assets/resort-stay-v1/guest-room-v1.png";
      find("[data-stay-rest]").textContent = ({day:"夕方まで過ごす",sunset:"夜まで過ごす",night:"朝まで休む"})[stay.journey.time];
      look.spatial(find("[data-stay-rest]"));
      if (!stay.souvenirs.includes(selectedRoom)) selectedRoom = stay.souvenirs[0] || "postcard";
      const postcard = find("[data-stay-inspect]");
      postcard.hidden = !stay.displaySpot;
      postcard.dataset.spot = stay.displaySpot;
      const placed = find("[data-stay-room-objects]");
      placed.replaceChildren();
      for (const item of goods.filter(entry => entry.id !== "postcard" && stay.placements[entry.id])) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "stay-displayed-object";
        button.dataset.item = item.id;
        button.dataset.spot = stay.placements[item.id];
        button.setAttribute("aria-label", item.name + "を眺める");
        const image = document.createElement("img");
        image.src = item.image; image.alt = "";
        button.append(image);
        button.addEventListener("click", () => inspect(item.id));
        placed.append(button);
      }
      find("[data-stay-room-copy]").textContent = stay.souvenirs.length ? itemFor(selectedRoom).name + "を、どこに飾ろう。" : "まだ品はありません。ガレリアで、持ち帰りたいものを。";
      find("[data-stay-room-caption]").textContent = Object.keys(stay.placements).length ? "今日選んだものが、部屋の景色になっている。" : "窓の向こうに、海が広がっている。";
      roomItems.innerHTML = goods.filter(entry => stay.souvenirs.includes(entry.id)).map(entry => '<button type="button" data-stay-select="' + entry.id + '" aria-pressed="' + (entry.id === selectedRoom) + '">' + entry.name + '</button>').join("");
      roomActions.innerHTML = !stay.souvenirs.length
        ? '<button class="stay-primary" data-stay-room-action="shop" type="button">ガレリアへ →</button>'
        : [["left", "窓に近い側"], ["center", "机の中央"], ["right", "机の奥側"]].map(([spot, label]) => {
          const other = goods.find(entry => entry.id !== selectedRoom && stay.placements[entry.id] === spot);
          return '<button data-stay-room-action="' + spot + '" type="button" aria-pressed="' + (stay.placements[selectedRoom] === spot) + '">' + label + 'に飾る' + (other ? '<small>' + other.name + 'と入替</small>' : '') + '</button>';
        }).join("") + '<button data-stay-room-action="inspect" type="button">品の由来を見る</button>' + (stay.placements[selectedRoom] ? '<button data-stay-room-action="put-away" type="button">しまう</button>' : "");
    }
    function renderReceipt() {
      const receipt = find("[data-stay-receipt]"), session = read().stay.lastSession;
      const received = read().stay.rewards.recent;
      receipt.hidden = (!session || session.games === 0) && !received.length;
      if (receipt.hidden) return;
      receipt.innerHTML = '<details><summary>台で受け取ったCOINS</summary>' + received.slice(0,4).map(item => '<p>' + rewards.MACHINES[item.machine].name + ' · ' + fmt(item.games) + 'G<br>+' + fmt(item.amount) + ' COINS' + (item.discarded ? '（残高上限のため一部受取不可）' : '') + '</p>').join('')
        + (session?.games ? '<p>前回のHold’em · +' + fmt(session.coins) + ' COINS<br>' + fmt(session.games) + 'G · 台のCREDIT ' + (session.creditDelta >= 0 ? "+" : "") + fmt(session.creditDelta) + '</p>' : '')
        + '<small>記録開始後の累計獲得 ' + fmt(read().collection.lifetimeEarned) + ' COINS<br>受取済み・再訪での追加付与はありません</small></details>';
    }
    function renderJournal() {
      const stay = read().stay, journey = stay.journey;
      const experiences = journal.querySelector("[data-journal-experiences]");
      experiences.replaceChildren();
      const lines = [];
      const views = journey.discoveries.map(id => {
        if (world.DETAILS[id]) return world.DETAILS[id].label;
        if (id === "sea-light") return "テラスから海を眺めた";
        if (id === "store-hours") return "回廊の店先で足を止めた";
        return world.OBSERVATIONS[id.replace(/-view$/, "")]?.[0];
      }).filter(Boolean);
      if (views.length) lines.push("心に留めた景色 — " + views.join("、"));
      for (const [id, name] of [["guide", "案内係"], ["traveler", "旅人"]]) {
        const places = journey.meetings.filter(key => key.startsWith(id + ":")).map(key => world.SCENES[key.split(":")[1]].label);
        if (places.length) lines.push(name + "と話した場所 — " + places.join("、"));
      }
      const meals = Object.keys(stay.dining.memories).map(id => world.MEALS[id].name);
      if (meals.length) lines.push("島で味わったもの — " + meals.join("、"));
      if (stay.cruise.trips) lines.push("海から島を眺める船旅をした。帰ってくる岸辺の灯りも、覚えている。");
      if (stay.metLuana) lines.push("ガレリアで、ルアナと話した。");
      for (const [id, relation] of Object.entries(stay.relationships)) if (relation.stage === "complete") lines.push(world.RELATIONSHIPS[id].memory);
      for (const id of journey.appointmentsKept) lines.push(world.MEETING_PLANS[id].memory);
      for (const pursuit of world.pursuits(stay)) if(pursuit.complete)lines.push(pursuit.memory);
      const plan = world.meetingPlan(journey);
      if (plan) lines.push("これからの予定 — " + plan.label + "。");
      const displayed = goods.filter(item => stay.placements[item.id]).map(item => item.name);
      if (displayed.length) lines.push("部屋の景色になったもの — " + displayed.join("、"));
      if (!lines.length) lines.push("窓の向こうには、これから歩く島が広がっている。心に残った景色や出会いを、ここで思い返せる。");
      for (const line of lines) { const p = document.createElement("p"); p.textContent = line; experiences.append(p); }
      const cards = journal.querySelector("[data-journal-reflections]");
      cards.replaceChildren();
      const reflections = world.travelReflections(stay);
      for (const entry of reflections.filter(item => item.ready || item.saved)) {
        const section = document.createElement("section"), title = document.createElement("h3"), copy = document.createElement("p"), note = document.createElement("small");
        title.textContent = entry.title; copy.textContent = entry.text;
        note.textContent = entry.saved ? "記憶に残した滞在" : "今、心に残っていること";
        section.append(note, title, copy); cards.append(section);
      }
      journal.querySelector("[data-journal-save]").hidden = !reflections.some(entry => entry.ready && !entry.saved);
    }
    function enter(view) {
      const previous = currentView;
      if (["home", "machines", "shop", "room"].includes(view)) {
        const candidates = rewards.sources();
        if (rewards.pending(read().stay.rewards, candidates).length) {
          const received = transact(draft => { rewards.receive(draft, candidates); });
          if (!received.ok) return received;
        }
      }
      const entry = worldView.enter(view, previous);
      if (!entry.ok) return entry;
      currentView = view; confirming = false;
      if (view !== previous && history.open) history.close();
      if (view !== previous && chapter.open) chapter.close();
      if (view !== previous && personal.open) personal.close();
      if (view !== "shop") pendingWords = null;
      ambience.setScene(view, read().stay.journey, read().settings.sound, read().settings.motion);
      renderSound();
      renderMotion();
      onMotionChange();
      if (view !== "shop") { archive.close(); product.close(); }
      if (view !== "room") { memory.close(); arrange.close(); journal.close(); }
      if (view === "home") renderReceipt();
      if (view === "shop") {
        const time = read().stay.journey.time;
        find(".stay-shop").dataset.time = time;
        for (const image of document.querySelectorAll(".stay-shop-plate,.stay-shop-foreground")) image.src = "assets/resort-stay-v2/galleria-counter" + (time === "night" ? "-night" : "") + "-v2.png";
        pose("welcome"); talkActions.hidden = true; storyActions.hidden = true; sayLuana(greeting()); status.textContent = ""; renderPurchase();
        renderLuanaThread();
        scene("shop", find(".stay-shop-scene"), "shop:" + time);
      }
      if (view === "room") { roomStatus.textContent = ""; renderRoom(); }
      return { ok: true };
    }
    function renderSound() {
      document.querySelectorAll("[data-stay-sound]").forEach(button => {
        button.setAttribute("aria-pressed", String(read().settings.sound));
        button.textContent = read().settings.sound ? "音 ON" : "音 OFF";
        button.setAttribute("aria-label", read().settings.sound ? "音を消す" : "音を入れる");
      });
    }
    function renderMotion() {
      const systemReduced = Boolean(motionQuery?.matches);
      document.querySelectorAll("[data-stay-motion]").forEach(button => {
        const reduced = systemReduced || read().settings.motion === "reduced";
        button.textContent = systemReduced ? "動き 控えめ（端末）" : reduced ? "動き 控えめ" : "動き 標準";
        button.setAttribute("aria-pressed", String(reduced));
        button.disabled = systemReduced;
        const label = systemReduced ? "動きは端末設定で控えめです" : reduced ? "動きを標準に戻す" : "動きを控えめにする";
        button.setAttribute("aria-label", label);
        button.title = systemReduced ? "端末の視差効果を減らす設定が優先されています" : label;
      });
    }
    document.querySelectorAll("[data-stay-motion]").forEach(button => button.addEventListener("click", () => {
      if (motionQuery?.matches) { renderMotion(); return; }
      const next = read().settings.motion === "reduced" ? "full" : "reduced";
      const result = transact(draft => { draft.settings.motion = next; });
      if (!result.ok) { button.textContent = "保存できません"; button.title = result.message; return; }
      button.title = ""; renderMotion();
      ambience.setScene(currentView, read().stay.journey, read().settings.sound, read().settings.motion);
      onMotionChange();
    }));
    motionQuery?.addEventListener?.("change", () => {
      renderMotion();
      ambience.setScene(currentView, read().stay.journey, read().settings.sound, read().settings.motion);
      onMotionChange();
    });
    document.querySelectorAll("[data-stay-sound]").forEach(button => button.addEventListener("click", () => {
      const result = transact(draft => { draft.settings.sound = !draft.settings.sound; });
      if (!result.ok) { button.textContent = "保存できません"; button.title = result.message; return; }
      button.title = ""; renderSound(); root.MimiAudio.setEnabled(read().settings.sound);
      ambience.setScene(currentView, read().stay.journey, read().settings.sound, read().settings.motion);
    }));
    find("[data-stay-conversation-open]").addEventListener("click", openConversation);
    find("[data-stay-conversation-close]").addEventListener("click", closeConversation);
    storyOpen.addEventListener("click", openStories);
    storyActions.addEventListener("click", event => {
      const button = event.target.closest("[data-story-action]");
      if (!button || event.detail > 1) return;
      if (button.dataset.storyAction === "back") { openConversation(); return; }
      if (button.dataset.storyAction === "close") { closeConversation(); return; }
      const topic = world.luanaTopics(read().stay).find(entry => entry.id === button.dataset.storyId);
      if (!topic) return;
      const saved = transact(draft => world.shareLuanaStory(draft, topic.id));
      if (!saved.ok) { dialogue.textContent = saved.message; return; }
      pose("listen"); sayLuana(topic.shared ? topic.again : topic.reply);
    });
    document.querySelectorAll("[data-stay-product-open]").forEach(button => button.addEventListener("click", () => {
      selected = button.dataset.stayProductOpen; confirming = false; status.textContent = ""; renderPurchase(); product.showModal();
    }));
    find("[data-stay-product-close]").addEventListener("click", () => product.close());
    document.querySelectorAll("[data-stay-talk]").forEach(button => button.addEventListener("click", () => {
      const preference = button.dataset.stayTalk;
      const result = transact(draft => { draft.stay.metLuana = true; draft.stay.preference = preference; });
      if (!result.ok) { dialogue.textContent = result.message; return; }
      pose("offer");
      sayLuana(preference === "sunlight"
        ? "でしょう？ 私、昼のこの店が好きなの。ヤシの影がゆっくり動いて。絵はがきなら、その光も部屋に連れていけるわ。"
        : "私も。店の奥から海の回廊へ抜けられるの。あのガラスの青と、本物の海を見比べてみて。");
      status.textContent = "";
    }));
    purchaseActions.addEventListener("click", event => {
      if (event.detail > 1) return;
      const action = event.target.closest("[data-stay-action]")?.dataset.stayAction, item = itemFor(selected);
      if (!action) return;
      if (action === "room") { selectedRoom = selected; navigate("room"); if (currentView === "room") arrange.showModal(); return; }
      if (action === "cancel") { confirming = false; renderPurchase(); purchaseActions.querySelector("button").focus(); return; }
      if (action === "buy") {
        if (read().coins < item.price) { status.textContent = "あと" + fmt(item.price - read().coins) + " COINS。今は眺めるだけでも。台で遊んだ結果を、島に戻ると受け取れます。「COINSの案内」で確認できます。"; return; }
        confirming = true; renderPurchase(); purchaseActions.querySelector("button").focus(); return;
      }
      if (action !== "confirm" || !confirming) return;
      const result = transact(draft => world.purchase(draft, selected));
      if (!result.ok) { status.textContent = result.message; return; }
      confirming = false; sayLuana(item.thanks);
      pose("offer");
      status.textContent = item.name + "を受け取りました。所持品と残高を保存しました。";
      renderPurchase(); purchaseActions.querySelector("button").focus();
    });
    function inspect(id = selectedRoom) {
      if (!read().stay.souvenirs.includes(id)) return;
      const item = itemFor(id);
      find("#stayMemoryHeading").textContent = item.name;
      find("[data-stay-memory-origin]").textContent = item.gift ? "島の美術館 / 町で出会った人たち" : "GALLERIA LAPIN / 旅の品";
      memory.dataset.item = id; memory.querySelector("img").src = item.image; memory.querySelector("img").alt = item.name;
      find("[data-stay-memory-copy]").textContent = world.itemMemory(read().stay, id); memory.showModal();
    }
    find("[data-stay-inspect]").addEventListener("click", () => inspect("postcard"));
    find("[data-stay-room-open]").addEventListener("click", () => { renderRoom(); arrange.showModal(); });
    find("[data-stay-rest]").addEventListener("click", event => {
      if (event.detail > 1) return;
      const next = world.transition(read().stay.journey, { type: "time", to: ({day:"sunset",sunset:"night",night:"day"})[read().stay.journey.time] });
      if (!next.ok) return;
      const saved = transact(draft => { draft.stay.journey = next.journey; });
      if (!saved.ok) { find("[data-stay-room-caption]").textContent = saved.message; return; }
      renderRoom(); find("#stayRoomHeading").focus();
    });
    find("[data-stay-room-close]").addEventListener("click", () => arrange.close());
    journalButton.addEventListener("click", () => { renderJournal(); journal.querySelector("[data-journal-status]").textContent = ""; journal.showModal(); });
    journal.querySelector("[data-journal-close]").addEventListener("click", () => journal.close());
    journal.addEventListener("close", () => { if (currentView === "room") journalButton.focus({ preventScroll: true }); });
    journal.querySelector("[data-journal-save]").addEventListener("click", () => {
      const saved = transact(draft => world.rememberStay(draft));
      if (saved.ok) renderJournal();
      journal.querySelector("[data-journal-status]").textContent = saved.ok ? "この滞在を記憶に残しました。またここで振り返れます。" : saved.message;
      if (saved.ok) journal.querySelector("[data-journal-close]").focus();
    });
    roomItems.addEventListener("click", event => {
      const id = event.target.closest("[data-stay-select]")?.dataset.staySelect;
      if (!itemFor(id)) return;
      selectedRoom = id; renderRoom(); roomItems.querySelector('[data-stay-select="' + id + '"]').focus();
    });
    roomActions.addEventListener("click", event => {
      const action = event.target.closest("[data-stay-room-action]")?.dataset.stayRoomAction;
      if (action === "shop") { navigate("shop"); return; }
      if (action === "inspect") { inspect(); return; }
      if (!["left", "center", "right", "put-away"].includes(action)) return;
      const result = transact(draft => world.place(draft, selectedRoom, action === "put-away" ? "" : action));
      if (!result.ok) { roomStatus.textContent = result.message; return; }
      renderRoom();
      roomStatus.textContent = action === "put-away" ? "大切にしまいました。配置を保存しました。" : "品を飾りました。次に来たときも、ここに。保存しました。";
      (roomActions.querySelector('[data-stay-room-action="' + action + '"]') || roomActions.querySelector("button"))?.focus();
    });
    find("[data-stay-memory-close]").addEventListener("click", () => memory.close());
    find("[data-stay-archive-open]").addEventListener("click", () => archive.showModal());
    find("[data-stay-archive-close]").addEventListener("click", () => archive.close());
    document.addEventListener("keydown", event => {
      if (archive.open || memory.open || product.open || arrange.open || journal.open || history.open || chapter.open || personal.open || event.defaultPrevented) return;
      if (event.key === "Escape" && ["shop", "room"].includes(currentView)) {
        event.preventDefault();
        if ((!talkActions.hidden || !storyActions.hidden) && currentView === "shop") closeConversation();
        else navigate("home");
      }
      if (!["ArrowLeft", "ArrowRight"].includes(event.key)) return;
      const group = event.target.closest(".stay-talk-actions");
      if (!group) return;
      const buttons = [...group.querySelectorAll("button")].filter(button => !button.hidden && !button.disabled), index = buttons.indexOf(event.target);
      if (index < 0) return;
      event.preventDefault();
      buttons[(index + (event.key === "ArrowRight" ? 1 : buttons.length - 1)) % buttons.length].focus();
    });
    return { enter };
  }
  root.MimiResortStay = Object.freeze({ create });
})(window);
