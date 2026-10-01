/* Pier booking and the saved boat excursion. All paid actions use the same
 * atomic profile transaction as the shop; browsing a reservation is free. */
(function (root) {
  "use strict";
  function create({ read, transact, refresh, scene, lookScene = () => {} }) {
    const world = root.MimiResortWorld;
    const dialog = document.createElement("dialog");
    dialog.className = "stay-dining stay-cruise";
    dialog.setAttribute("aria-labelledby", "stayCruiseName");
    dialog.innerHTML = '<div class="stay-activity-scene"><img class="stay-dining-image" alt=""></div><header><span data-cruise-phase></span><h3 id="stayCruiseName"></h3></header><section class="stay-dining-copy"><p data-cruise-copy></p><p data-cruise-status role="status"></p><div data-meal-actions data-cruise-actions></div></section>';
    scene.append(dialog);
    let sequence = 0;
    const sailing = () => ["aboard", "coast"].includes(read().stay.cruise.active?.stage);
    const slotName = slot => slot === "sunset" ? "夕方" : "夜";
    function render() {
      const profile = read(), cruise = profile.stay.cruise, active = cruise.active;
      const stage = active?.stage || "plan", slot = active?.slot || "sunset";
      sequence = cruise.sequence;
      dialog.dataset.stage = stage;
      dialog.dataset.slot = slot;
      const image = dialog.querySelector("img");
      image.src = sailing() ? "assets/resort-cruise-v1/boat-" + slot + "-v1.png" : "assets/resort-art-v4/pier-" + (profile.stay.journey.time === "night" ? "night" : "day") + "-v4.png";
      image.alt = sailing() ? slotName(slot) + "の船上から見た島" : "船を待つ桟橋";
      dialog.querySelector("h3").textContent = world.CRUISE.name;
      dialog.querySelector("[data-cruise-phase]").textContent = ({plan:"桟橋の船旅案内",reserved:slotName(slot) + "便の予約票 · 集合：この桟橋",aboard:slotName(slot) + "の海へ",coast:"歩いた島を、海から"})[stage];
      dialog.querySelector("[data-cruise-copy]").textContent = stage === "plan"
        ? "夕方と夜の短い周遊。乗船時に90 COINS。予約・変更・乗船前の取消は無料です。選んだ時間帯に桟橋へ。時間を過ごしても予約は失効せず、次の同じ時間帯に参加できます。帰港は夜になります。"
        : stage === "reserved" ? "予約済み：" + slotName(slot) + "便。出発までは自由に島を歩けます。乗船時に90 COINS（所持 " + profile.coins.toLocaleString("ja-JP") + " COINS）。変更・取消は無料。参加できなかった場合も、次の同じ時間帯に乗れます。"
        : stage === "aboard" ? "係留ロープが外れ、桟橋がゆっくり遠ざかる。船頭が岸を指した。「さっきまで歩いていた道、あそこですよ。」"
        : slot === "sunset" ? "ガラス屋根が、夕日を受けて一度だけ明るくなる。その隣にホテル、その先に町の食堂。歩いて覚えた場所が、一つの島につながっている。"
        : "ホテルの窓、ガレリアの回廊、港の食堂。海の上から見ると、それぞれの灯りに、今日会った人の顔が浮かぶ。";
      dialog.querySelector("[data-cruise-status]").textContent = "";
      const controls = dialog.querySelector("[data-cruise-actions]"); controls.replaceChildren();
      const add = (type, text, slot = "", disabled = false) => {
        const button = document.createElement("button"); button.type = "button";
        button.dataset.cruiseAction = type; if (slot) button.dataset.slot = slot;
        button.textContent = text; button.disabled = disabled; controls.append(button);
      };
      if (stage === "plan") { add("reserve", "夕方便を予約する", "sunset"); add("reserve", "夜便を予約する", "night"); }
      if (stage === "reserved") {
        if (profile.stay.journey.time === slot) add("board", "90 COINSで乗船する", "", profile.coins < world.CRUISE.price);
        else add("wait", slotName(slot) + "まで桟橋で過ごす");
        add("change", slot === "sunset" ? "夜便に変更する" : "夕方便に変更する", slot === "sunset" ? "night" : "sunset");
        add("cancel", "予約を取り消す");
        if (profile.coins < world.CRUISE.price) dialog.querySelector("[data-cruise-status]").textContent = "乗船にはCOINSが足りません。予約は残せます。";
      }
      if (stage === "aboard") add("look", "岸の景色をゆっくり眺める");
      if (sailing()) add("return", "船旅を終えて桟橋へ戻る");
      else add("close", stage === "reserved" ? "予約を残して散策へ" : "案内を閉じる");
      if (dialog.open) lookScene(dialog.querySelector(".stay-activity-scene"), image.getAttribute("src"));
    }
    function close() {
      if (sailing()) { dialog.querySelector("[data-cruise-status]").textContent = "帰るときは「船旅を終えて桟橋へ戻る」を選んでください。"; return; }
      dialog.close(); refresh(); scene.querySelector("[data-world-cruise]")?.focus();
    }
    function open() {
      render(); if (!dialog.open) dialog.showModal();
      lookScene(dialog.querySelector(".stay-activity-scene"), dialog.querySelector("img").getAttribute("src"));
      dialog.querySelector("[data-cruise-action]:not(:disabled)")?.focus();
    }
    dialog.addEventListener("cancel", event => { event.preventDefault(); close(); });
    dialog.addEventListener("click", event => {
      const button = event.target.closest("[data-cruise-action]");
      if (!button || event.detail > 1) return;
      const type = button.dataset.cruiseAction;
      if (type === "close") { close(); return; }
      const result = transact(draft => world.cruiseAction(draft, {type, slot:button.dataset.slot, sequence}));
      if (!result.ok) { dialog.querySelector("[data-cruise-status]").textContent = result.message; return; }
      if (type === "return") {
        dialog.close(); refresh("桟橋に足を下ろすと、陸の静かさに気づいた。海から見た灯りへ、歩いて帰ろう。");
        scene.querySelector("[data-world-cruise]")?.focus(); return;
      }
      render(); dialog.querySelector("button:not(:disabled)")?.focus();
    });
    return { open, sailing, close: () => { if (dialog.open && !sailing()) dialog.close(); } };
  }
  root.MimiResortCruiseView = Object.freeze({create});
})(window);
