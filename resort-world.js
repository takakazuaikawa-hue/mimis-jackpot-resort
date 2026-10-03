/* Pure island route/state model. No cabinet credit, RNG, rewards or storage.
 * Scene ids describe implementation proposals; they are not new named canon.
 * UI commits the returned journey through the existing atomic stay transaction.
 */
(function (root, factory) {
  "use strict";
  const store = root?.MimiProfileStore || (typeof module === "object" && module.exports ? require("./profile-store.js") : null);
  const cast = root?.MimiIslandCast || (typeof module === "object" && module.exports ? require("./content/resort-new-cast.js") : null);
  const api = factory(store, cast);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.MimiResortWorld = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (store, NEW_CAST) {
  "use strict";
  if (!store) throw new Error("MimiProfileStore is required before resort-world.js");
  if (!NEW_CAST) throw new Error("MimiIslandCast is required before resort-world.js");
  const definitions = [
    ["arrival", "島への到着", ["plaza"]],
    ["plaza", "ホテル前の広場", ["arrival", "casino", "galleria", "lookout", "hotel"]],
    ["casino", "カジノフロア", ["plaza"]],
    ["galleria", "ガレリア・ラパン", ["plaza", "shop", "promenade"]],
    ["shop", "ルアナの売場", ["galleria"]],
    ["promenade", "海の回廊", ["galleria", "lookout", "harbor"]],
    ["lookout", "海を望むテラス", ["promenade", "plaza", "highland", "lounge"]],
    ["hotel", "ホテルのロビー", ["plaza", "room", "garden", "lounge"]],
    ["room", "海の見える客室", ["hotel"]],
    ["pool", "海辺のプール", ["garden", "cove"]],
    ["harbor", "小さな港", ["promenade", "pier", "cove", "town"]],
    ["pier", "船を待つ桟橋", ["harbor"]],
    ["garden", "木陰の庭", ["hotel", "pool", "highland", "town"]],
    ["highland", "島を望む高台", ["garden", "lookout"]],
    ["cove", "静かな入り江", ["harbor", "pool"]],
    ["lounge", "海風のラウンジ", ["hotel", "lookout"]],
    ["town", "港町の通り", ["harbor", "garden", "museum", "fishdiner", "homekitchen", "bakery"]],
    ["museum", "島の小さな美術館", ["town"]],
    ["fishdiner", "港の魚料理食堂", ["town"]],
    ["homekitchen", "町角の家庭料理店", ["town"]],
    ["bakery", "パンとスープの店", ["town"]]
  ];
  const SCENES = Object.freeze(Object.fromEntries(definitions.map(([id, label, exits]) => [id, Object.freeze({ id, label, exits: Object.freeze(exits) })])));
  const OBSERVATIONS = Object.freeze({
    pool: ["水辺でひと息", "水面から返る光が、パラソルの内側まで揺れている。庭を抜けてきた道の先に、こんな場所があった。", "水中の灯りが、波の縁を青く照らしている。昼よりも、遠くの海の音がよく聞こえる。"],
    harbor: ["港を眺める", "帆柱の向こうに、さっき歩いた回廊が見える。入り江へ続く道は、岸壁の先を曲がっている。", "船の灯りが、水面に長く伸びている。回廊の灯りをたどれば、ガレリアへ帰れそうだ。"],
    pier: ["船着き場で休む", "係留された船が、波に合わせてゆっくり上下する。今は出航を待つ人もなく、海を近くに感じる。", "ロープのきしむ小さな音。沖から来る風は、建物の間で感じた風より少し冷たい。"],
    garden: ["木陰で立ち止まる", "葉の隙間から、細い光が足元に落ちる。水音をたどるとプールへ、階段を上れば高台へ続いている。", "灯りの輪の外では、葉が黒い影になって重なっている。花の香りと、小さな水音だけが近い。"],
    highland: ["歩いた島を見渡す", "足元では草の穂が揺れ、遠くには小さな屋根と港。建物の中で見た海より、ずっと広く感じる。", "木々の影の向こうに、島の輪郭が重なっている。草を照らす月明かりと、遠い海の反射。ここでは風だけが近い。"],
    cove: ["波打ち際を眺める", "浅い水の中で、砂の模様が揺れている。港の賑わいも、ここまでは届かない。", "波が引くたび、濡れた砂に月の光が残る。岩の向こうの草道は、昼に歩いたのと同じ帰り道。"],
    lounge: ["海を見ながら腰を下ろす", "椅子に深く座ると、窓の枠が視界から消えて、海だけが残った。テラスの先は、あの見晴らしへ続いている。", "柔らかな灯りと、開いた窓からの夜風。今日はもう少し、ここで過ごしてもいい。"],
    hotel: ["ロビーを見渡す", "外の強い日差しが、磨かれた床の上で柔らかくなる。階段の先に客室、横の回廊に庭とラウンジ。", "客室へ戻る足音が、高い天井へ静かに消えていく。庭の向こうにも、まだ灯りが見える。"]
  });
  // The artworks, menus and unnamed residents are authored implementation proposals.
  // Inspecting a meal is not ordering it and never changes the wallet.
  const DETAILS = Object.freeze({
    "town-view": { place: "town", label: "通りの暮らしを眺める", x: 48, y: 79, day: "パンの籠を抱えた配達の人。野菜を選びながら話す人。ホテルへ急ぐ足を止めると、町の一日が見えてくる。", night: "買い物帰りの人が立ち話をしている。上の窓には洗濯物、下の食堂には夕食の灯り。ここでは、旅の続きに誰かの暮らしがある。" },
    "museum-boat": { place: "museum", label: "舟の絵を見る", x: 22, y: 31, day: "『朝の舟』。青い船体と、水面に長く伸びる朝の光。さっき通った港にも、こんな一日の始まりがあるのかもしれない。", night: "『朝の舟』。夜の展示室で見ると、絵の中の朝が遠い記憶のように見える。同じ港でも、訪ねる時間で印象が変わりそうだ。" },
    "museum-glass": { place: "museum", label: "ガラスの作品を見る", x: 48, y: 63, day: "『潮のかたち』。青緑のガラスを通った光が、台の上にもう一つの形を落としている。海辺で見た色を思い出す。", night: "『潮のかたち』。天井の小さな灯りが、ガラスの内側で幾重にも重なる。昼の柔らかな青とは違う、深い色。" },
    "museum-table": { place: "museum", label: "食卓の絵を見る", x: 65, y: 31, day: "『いつもの食卓』。湯気の立つ皿と、隣の人へ向けた顔。知らない家の景色なのに、誰かと食べた日のことが浮かぶ。", night: "『いつもの食卓』。この灯りの外でも、今ごろ誰かが夕食を囲んでいる。町の店を、もう一軒のぞいてみたくなった。" },
    "fishdiner-menu": { place: "fishdiner", label: "今日の料理を見る", x: 78, y: 76, day: "今日の一皿は、レモンを添えた焼き魚に、ご飯と温かいスープ。皿は飾りすぎず、魚の焼けた香りが店の奥から届く。", night: "夜も、焼き魚とご飯、スープの定食。仕事を終えた人が、いつもの席でゆっくり箸を進めている。" },
    "homekitchen-menu": { place: "homekitchen", label: "鍋料理の献立を見る", x: 78, y: 76, day: "豆とトマトを煮込んだ鍋料理。ちぎったパンとオリーブが添えられている。店の人は、大鍋から一皿ずつよそっている。", night: "鍋の最後まで、弱い火で温め続けている。夕食の皿には、豆と野菜とたっぷりの汁。客席から、今日あったことを話す声がする。" },
    "bakery-menu": { place: "bakery", label: "パンとスープを見る", x: 78, y: 76, day: "丸いパンを割ると、まだ中が温かそうだ。野菜のスープと小さなバター、コーヒー。配達の袋にも、同じパンが入っている。", night: "焼き足しはひと休み。残ったパンをスープと一緒に出す、静かな夜の席。窓辺では、仕事帰りの人がカップを両手で包んでいる。" }
  });
  const RESIDENTS = Object.freeze({
    vendor: { place: "town", name: "通りの八百屋さん", label: "八百屋さんに声をかける", x: 64, y: 71,
      day: "こんにちは。散歩の途中？ この先の食堂にも、朝ここから野菜を持っていくんです。美術館は、向こうの階段を少し上ったところですよ。",
      night: "今日はそろそろ店じまい。残った野菜を箱に戻したら、私も晩ご飯です。町角の煮込みは、夜に食べるのもいいですよ。",
      again: "また会いましたね。美術館も、食堂も寄ってみました？ 同じ通りでも、時間によってずいぶん顔が変わるでしょう。",
      more: "ここで育てた野菜が、あの店の鍋に入る。食べた人が帰りにまた寄っていく。毎日だいたい同じだけど、話の続きがあるんです。" },
    curator: { place: "museum", name: "美術館の学芸員", label: "学芸員と話す", x: 71, y: 67,
      day: "いらっしゃいませ。今日は、島の舟と食卓、それからガラスの作品を並べています。気になる一つから、どうぞ。",
      night: "こんばんは。夜の展示室は、ガラスの影がよく見えるんです。昼に見た作品も、もう一度眺めてみてください。",
      again: "おかえりなさい。さっきと違う作品が気になりましたか？ 同じ絵でも、その日の気持ちで見えるところが変わりますね。",
      more: "『いつもの食卓』は、料理よりも、人の顔に目を向けてみてください。誰と座っていたか。旅のあとも残るのは、そんなことかもしれません。" },
    fishcook: { place: "fishdiner", name: "魚料理食堂の店主", label: "食堂の店主と話す", x: 64, y: 47,
      day: "いらっしゃい。今日は焼き魚だよ。港の仕事がひと段落すると、みんなこの時間に来るんだ。初めてなら、まず店の中をゆっくり見ていって。",
      night: "こんばんは。今は仕事帰りのお客さんが多いね。昼よりゆっくり食べて、ひとしきり話してから帰るんだ。",
      again: "お、また来てくれたね。港の方は歩いてみた？ あの桟橋から戻ってきた人も、よくここに寄るよ。",
      more: "魚は焼きすぎないように、最後まで目を離さない。あとは温かいご飯と汁があればいい。毎日来る人に、また明日と思ってもらえたらね。" },
    homecook: { place: "homekitchen", name: "家庭料理店の店主", label: "鍋のそばの店主と話す", x: 71, y: 55,
      day: "こんにちは。鍋は朝からゆっくり煮ているの。野菜は通りの八百屋さんから。少しずつ足していると、ちょうどお昼の味になるのよ。",
      night: "こんばんは。今日は遅いお客さんもいるから、もう少し火を落とさずにおくの。外を歩いてきたなら、ここは暖かいでしょう。",
      again: "また寄ってくれたのね。同じ鍋でも、昼より夜の方が少し味がなじむの。町を歩いた話も、聞かせてね。",
      more: "あの席の二人、昼にも顔を出していたのよ。用事があって来る日も、ただ誰かと話したくて来る日もある。そんな店でいたいわね。" },
    baker: { place: "bakery", name: "パン屋の店主", label: "パン屋さんと話す", x: 60, y: 54,
      day: "こんにちは。今、通りの店へ持っていく分を分けていたところ。焼き上がりを待ってくれる人がいると、朝が少し楽しみになるんです。",
      night: "こんばんは。今日はもう焼き終わり。スープの鍋はまだ温かいので、帰り道に立ち寄る人がいるんです。",
      again: "また来てくれたんですね。町角のお店のパンも、ここで焼いているんですよ。見覚えがありませんでした？",
      more: "形が少し違っても、割ったときの香りは揃えたいんです。旅の途中で、ここのパンを思い出してもらえたら、うれしいですね。" }
  });
  const DISCOVERIES = Object.freeze({ "sea-light": "lookout", "store-hours": "promenade", ...Object.fromEntries(Object.keys(OBSERVATIONS).map(id => [id + "-view", id])), ...Object.fromEntries(Object.entries(DETAILS).map(([id, item]) => [id, item.place])) });
  // These are readings of the existing scenery, not new quests or currencies.
  const SCENIC = Object.freeze({
    "sea-light": {title:"海の青を、ひとつ",points:[[76,48],[85,43],[67,55]],opening:"小兎が足を止めた。欄干の向こうで、海が光っている。",sunset:"海の青に、細い金色が混じる。波が動くたび、夕日の道がほどけてはつながる。",ending:"何かを持ち帰らなくても、この青は覚えていられそうだ。"},
    "pool-view": {title:"水音のそばで",points:[[60,57],[74,48],[56,55]],opening:"小兎の耳が、水音の方へ向いた。パラソルの下を、涼しい風が抜ける。",sunset:"夕日の色が、プールと海の境目に重なる。水面が揺れると、椅子の影まで柔らかくなる。",ending:"泳がない時間も、この場所で過ごしていい。庭へ戻る前に、もうひと呼吸。"},
    "harbor-view": {title:"歩いた道と、帆柱",points:[[65,46],[79,40],[47,49]],opening:"小兎が岸壁で振り返った。帆柱の向こうから、船の小さな音が届く。",sunset:"帆柱の影が、岸壁を長く横切る。建物の灯りが点き始め、昼に歩いた道が別の色になっていく。",ending:"海沿いの道と、町へ曲がる道。次は、気になる方を選んでいこう。"},
    "pier-view": {title:"出航しないひととき",points:[[72,53],[83,46],[67,53]],opening:"小兎が板の上でじっとしている。船をつなぐロープが、波に合わせて揺れた。",sunset:"船の白い縁に、夕日が残っている。沖へ出る人を見送るように、桟橋の影が水面へ伸びる。",ending:"船に乗る予定がなくても、ここまで歩いてきてよかった。波の近さを覚えて帰ろう。"},
    "garden-view": {title:"木陰の寄り道",points:[[43,45],[56,50],[41,57]],opening:"小兎が木陰で立ち止まった。葉の間を通った光が、足元に散っている。",sunset:"葉の縁だけが、夕日の色に透ける。階段の石はまだ温かく、木陰には先に涼しさが来ている。",ending:"急いで通り抜けるには、少し惜しい道だった。次は、別の時間にも歩いてみよう。"},
    "highland-view": {title:"風の通る、島の上",points:[[69,44],[79,42],[63,49]],opening:"草の道を上りきると、小兎が耳を立てた。木々の向こうに、海と島の輪郭が広がる。",sunset:"草の穂が、夕日の色に透けている。遠い屋根は小さくなり、海と空の境目が柔らかくなる。",ending:"歩いた場所を上から見つけると、帰り道まで少し親しくなる。"},
    "cove-view": {title:"波が引いたあと",points:[[68,57],[81,55],[65,60]],opening:"小兎が砂の手前で待っている。浅い波が、同じ所まで来ては引いていく。",sunset:"浅い水が、空の桃色を映している。波が引いた砂の上には、もう一つの夕空が残る。",ending:"港の賑わいから、こんなに静かな場所まで続いていた。戻る道も、自分の旅の一部だ。"},
    "lounge-view": {title:"海を見ている時間",points:[[76,40],[85,43],[71,49]],opening:"小兎が椅子のそばで落ち着いた。ここでは、行き先を決めずに座っていられる。",sunset:"窓の外の海が、少しずつ深い色になる。席を立つ人と、もう少し座っている人。それぞれの夕方がある。",ending:"何かをしなくても、今日の一日は続いている。帰るのは、もう少しあとでもいい。"},
    "hotel-view": {title:"帰る場所の灯り",points:[[56,47],[64,40],[46,52]],opening:"小兎がロビーの床で足を止めた。外から入った風が、ここで少し柔らかくなる。",sunset:"窓から届く夕日と、点き始めた室内の灯り。外を歩いた一日が、ここでゆっくり落ち着いていく。",ending:"階段の先には、自分の部屋がある。今日はどんな景色を持って帰ろう。"},
    "town-view": {title:"旅の途中に、暮らし",points:[[49,50],[63,49],[46,58]],opening:"小兎が通りの端で待っている。買い物の声と、店先で交わす挨拶が聞こえる。",sunset:"配達を終えた人が、空の籠を持って戻ってくる。食堂から夕食の匂いがして、通りの一日が続いている。",ending:"知らない通りにも、明日へ続く一日がある。また顔を出したくなる場所が増えた。"}
  });
  const SCENIC_IDS = Object.freeze(Object.keys(SCENIC));
  function scenicMoment(stay,id) {
    const journey=stay.journey;
    if(!Object.hasOwn(SCENIC,id) || DISCOVERIES[id]!==journey.location)return null;
    const scene=SCENIC[id], observation=OBSERVATIONS[journey.location];
    let main=journey.time==="sunset" ? scene.sunset : id==="sea-light"
      ? journey.time==="night" ? "遠くの船の灯りが、海の上で揺れている。昼の青は見えないけれど、波の輪郭には月の光が残る。" : "ガラスのような海の青。近い波と、遠い水平線は、同じ色でも違って見える。"
      : id==="town-view" ? DETAILS[id][journey.time==="night"?"night":"day"]
      : observation[journey.time==="night"?2:1];
    let ending=scene.ending;
    if(id==="sea-light" && journey.visited.includes("shop"))ending="売場で見た小さな品にも、この色があった。戻ったら、ルアナにこの海の話をしてみよう。";
    if(id==="highland-view" && !["galleria","harbor"].every(place=>journey.visited.includes(place)))ending="まだ歩いていない道も、屋根の間に続いている。下りたら、あの景色の中へ行ってみよう。";
    if(id==="cove-view" && journey.discoveries.includes("museum-glass")){
      main=journey.time==="night" ? "月の光が届く浅瀬と、光の届かない沖。『潮のかたち』の薄い縁と重なった青を思い出す。同じ海でも、光の通る場所で色が違った。" : journey.time==="sunset" ? "浅瀬には夕空の桃色、沖には深い青。『潮のかたち』を透かしたときのように、光の通る場所で、同じ水が違う色になる。" : "足元の浅瀬は砂まで透け、沖へ目を移すと青が濃くなる。『潮のかたち』の薄い縁と、厚く重なった青。ガラスの前で見た違いが、海にもあった。";
      if(journey.encounters.includes("noel"))ending="ノエルは、正しい見方を教えるより、どこで足を止めたか聞きたそうだった。この二つの青を、戻って話してみよう。";
    }
    if(id==="highland-view" && journey.discoveries.includes("garden-view") && journey.encounters.includes("marea"))ending="木陰を抜けてきた道が、あの屋根まで続いている。マレアが守っているのは、遠くから見る景色だけじゃない。下りたら、彼女自身が行きたい場所も聞いてみよう。";
    return {id,place:journey.location,time:journey.time,context:journey.location+":"+journey.time,title:scene.title,label:OBSERVATIONS[journey.location]?.[0] || (id==="sea-light"?"海を一緒に眺める":DETAILS[id].label),remembered:journey.discoveries.includes(id),frames:[scene.opening,main,ending].map((copy,index)=>({copy,point:scene.points[index]}))};
  }
  function finishScenic(draft,id,context) {
    const moment=scenicMoment(draft.stay,id);
    if(!moment || moment.context!==context)return "景色や時間が変わりました。散歩に戻り、もう一度眺めてください。";
    if(moment.remembered)return "この景色は、すでに旅の記憶に残っています。";
    const next=transition(draft.stay.journey,{type:"discover",id});
    if(!next.ok)return "今は、この景色を覚えておけません。";
    draft.stay.journey=next.journey;
  }
  const MUSEUM_WORKS = Object.freeze({
    "museum-boat": {title:"朝の舟",image:"assets/resort-town-v1/museum-boat-v2.png",medium:"油彩 · 島の舟",opening:"離れて見ると、朝の港。近づくと、舟を支える細い線や、水の上の筆跡が見えてくる。気になったところから眺めてみよう。",link:"港",details:[
      {label:"舟をつなぐロープ",point:[62,72],copy:"船首から伸びたロープが、水面の筆跡を斜めに横切っている。絵の中の舟も、沖へ出る前は岸につながれていた。"},
      {label:"水面に残る朝の光",point:[22,79],copy:"遠くの光は細い点、手前では厚い金色の筆跡。同じ水面なのに、距離ごとに描き方が変わっている。"}]},
    "museum-glass": {title:"潮のかたち",image:"assets/resort-town-v1/museum-glass-v2.png",medium:"吹きガラス · 海の色",opening:"波のように立ち上がったガラス。輪郭だけでなく、その内側や、台に落ちた光にも形がある。",link:"入り江",details:[
      {label:"重なったガラスの青",point:[56,42],copy:"薄い縁はほとんど透明で、重なったところだけが深い青になる。海の色を塗ったのではなく、厚みの違いで生まれた色だった。"},
      {label:"台に落ちたもう一つの波",point:[30,88],copy:"石の上に、淡い青緑の光がほどけている。作品の本体とは少し違う輪郭。ガラスを通った光まで、展示の一部になっている。"}]},
    "museum-table": {title:"いつもの食卓",image:"assets/resort-town-v1/museum-table-v2.png",medium:"油彩 · 島の暮らし",opening:"料理より先に、誰かへ向けた手が目に入った。賑やかな食卓にも、近づいて初めて見える小さな気遣いがある。",link:"町の食堂",details:[
      {label:"隣の人へ差し出す皿",point:[73,52],copy:"右の人の手が、皿を真ん中へ差し出している。食卓を囲む顔は、絵を見るこちらではなく、隣の人へ向いていた。"},
      {label:"手前の空いた椅子",point:[19,86],copy:"一脚だけ、まだ誰も座っていない。擦れた座面が、こちらを向いている。見ている人のためにも、席が残されているようだ。"}]}
  });
  function museumMoment(stay,id) {
    if(stay.journey.location!=="museum" || !Object.hasOwn(MUSEUM_WORKS,id))return null;
    const work=MUSEUM_WORKS[id],journey=stay.journey;
    const connected=id==="museum-boat" ? journey.visited.includes("harbor") : id==="museum-glass" ? journey.discoveries.includes("cove-view") : Object.keys(stay.dining.memories).length>0;
    const connection=connected ? ({"museum-boat":"港で見た舟を思い出すと、画家が残したロープの一本まで身近に感じる。次に歩くときは、船首と岸の間を見てみよう。","museum-glass":"入り江で見た浅瀬の色にも、深さによる違いがあった。ガラスと海、別のものの中に同じ色の変わり方がある。","museum-table":"町で食べた一皿を思い出す。料理を運んでくれた人の手も、この絵の中の手に少し似ていた。"})[id]
      : ({"museum-boat":"美術館を出て、町から港へ。今度は本当の舟のロープや、水面の光を探してみたくなった。","museum-glass":"町から港を抜けて、静かな入り江へ。浅い水と深い水で、どんな青の違いが見えるだろう。","museum-table":"美術館のすぐ外には、町の食堂がある。料理だけでなく、そこに座る人や、皿を運ぶ手にも目を向けてみたい。"})[id];
    return {...work,id,context:"museum:"+journey.time,remembered:journey.discoveries.includes(id),connection};
  }
  function finishMuseum(draft,id,context) {
    const work=museumMoment(draft.stay,id);
    if(!work || work.context!==context)return "場所や時間が変わりました。展示室から、もう一度作品を開いてください。";
    if(work.remembered)return "この作品は、すでに旅の記憶に残っています。";
    const next=transition(draft.stay.journey,{type:"discover",id});
    if(!next.ok)return "今は、この作品を覚えておけません。";
    draft.stay.journey=next.journey;
  }
  // Optional routes start with something the player actually noticed. Progress
  // uses existing discoveries/encounters; only the chosen bookmark and the
  // deliberately kept return memory are stored, never a second quest counter.
  const PURSUITS = Object.freeze({
    "museum-boat": {title:"絵の舟は、どこにいる？",place:"harbor",image:"assets/resort-art-v4/harbor-day-v4.png",found:"harbor-view",label:"港の舟を眺める",copy:"青い船首と、岸につなぐロープ。展示室の外で、本当の舟を探してみよう。",memory:"『朝の舟』から港へ。舟をつなぐロープと水面の光を見て戻ると、絵の中の一本の線が、島で暮らす人の一日の続きに見えた。"},
    "museum-glass": {title:"ガラスの青を、海で探す",place:"cove",image:"assets/resort-art-v4/cove-day-v5.png",found:"cove-view",label:"入り江の色を眺める",copy:"薄い縁の青と、重なった深い青。浅瀬と沖の海では、どう違うだろう。",memory:"『潮のかたち』から入り江へ。浅瀬から沖へ変わる青を眺めて戻った。ガラスの厚みと海の深さ、別々のものに同じ色の変わり方を見つけた。"},
    "museum-table": {title:"絵の食卓を、町で探す",place:"homekitchen",image:"assets/resort-town-v1/homekitchen-day-v1.png",label:"食卓を迎える人に話す",copy:"絵の中で差し出された一皿。その続きを、町で野菜を届ける人と、食卓を迎える人に聞いてみよう。",memory:"『いつもの食卓』から町へ。野菜を届ける人と、椅子を引いて迎える人の話を聞いた。展示室へ戻ると、絵の空いた席にも、誰かを待つ気持ちが見えた。"}
  });
  function pursuits(stay) {
    const journey=stay.journey;
    return Object.entries(PURSUITS).map(([id,entry])=>{
      const steps=id==="museum-table" ? [
        {place:"town",kind:"encounter",id:"vendor",label:"通りで、野菜を届ける人に聞く",done:journey.encounters.includes("vendor")},
        {place:"homekitchen",kind:"encounter",id:"homecook",label:"家庭料理店で、迎える人に聞く",done:journey.encounters.includes("homecook")}
      ] : [{place:entry.place,kind:"discover",id:entry.found,label:entry.label,done:journey.discoveries.includes(entry.found)}];
      const unlocked=journey.discoveries.includes(id),connected=steps.every(step=>step.done),complete=unlocked&&connected&&journey.reflections.includes(id+"-return");
      return {...entry,id,steps,unlocked,connected,complete,selected:journey.pursuit===id,next:steps.find(step=>!step.done)||{place:"museum",kind:"discover",id,label:"作品と島の景色を見比べる"}};
    });
  }
  function beginPursuit(draft,id,context) {
    const work=museumMoment(draft.stay,id);
    if(!work || work.context!==context)return "作品を見ている場所で、もう一度選んでください。";
    if(!work.remembered){const error=finishMuseum(draft,id,context);if(error)return error;}
    draft.stay.journey.pursuit=id;
  }
  function finishPursuit(draft,id,context) {
    const work=museumMoment(draft.stay,id),pursuit=pursuits(draft.stay).find(entry=>entry.id===id);
    if(!work || work.context!==context || !pursuit?.unlocked || !pursuit.connected)return "島で手がかりを確かめてから、作品へ戻ってきましょう。";
    if(pursuit.complete)return "このつながりは、すでに旅の記憶に残っています。";
    draft.stay.journey.reflections.push(id+"-return");
    if(draft.stay.journey.pursuit===id)draft.stay.journey.pursuit="";
  }
  function pursuitHint(stay) {
    const pursuit=pursuits(stay).find(entry=>entry.selected&&entry.unlocked&&!entry.complete);
    if(!pursuit)return null;
    const next=pursuit.next,here=stay.journey.location,to=route(here,next.place)[1];
    return next.place===here ? {...next,pursuit:pursuit.id,copy:next.label+"。絵の中で気になったものを、ここで確かめてみよう。"}
      : to ? {kind:"move",to,pursuit:pursuit.id,label:SCENES[to].label+"へ続く道",copy:next.label+"ための道。次は「"+SCENES[to].label+"」へ。"} : null;
  }
  const REST_PLACES = Object.freeze(["plaza", "lookout", "room", "pool", "pier", "garden", "highland", "cove", "lounge", "town"]);
  // Title continuation resumes a saved room/shop. Cabinet exits and explicit
  // back buttons still enter home through their existing return boundaries.
  function resumeView(stay) {
    const saved = store.normaliseStay(stay);
    if (saved.cruise.active && saved.cruise.active.stage !== "reserved") return "home";
    return ["room", "shop"].includes(saved.journey.location) ? saved.journey.location : "home";
  }
  function route(from, to) {
    if (!SCENES[from] || !SCENES[to]) return [];
    const queue = [[from]], seen = new Set([from]);
    while (queue.length) {
      const path = queue.shift(), tail = path[path.length - 1];
      if (tail === to) return path;
      for (const next of SCENES[tail].exits) if (!seen.has(next)) { seen.add(next); queue.push([...path, next]); }
    }
    return [];
  }
  const ENCOUNTERS = Object.freeze({ guide: "promenade", traveler: "lookout", ...Object.fromEntries(Object.entries(RESIDENTS).map(([id, person]) => [id, person.place])) });
  // Optional ordinary meetings, not romance choices or paid progression gates.
  // The player controls time; a missed period can be revisited without penalty.
  const MEETING_PLANS = Object.freeze({
    "guide-lounge": Object.freeze({id:"guide-lounge", person:"guide", from:"harbor", offeredAt:"sunset", place:"lounge", time:"night", label:"夜、ラウンジで案内係と待ち合わせ", choice:"夜、ラウンジで会う約束をする", confirmation:"では、仕事が終わったら海側のラウンジで。ホテルかテラスから入れます。ほかの予定ができたら、また別の夜でも大丈夫ですよ。", arrival:"来てくれたんですね。お仕事はここまで。今夜は案内の続きより、あなたが歩いてきた道の話を聞いてみたいです。", memory:"仕事を終えた案内係と、夜のラウンジで待ち合わせた。"}),
    "traveler-lookout": Object.freeze({id:"traveler-lookout", person:"traveler", from:"highland", offeredAt:"day", place:"lookout", time:"sunset", label:"夕方、テラスで旅人と待ち合わせ", choice:"夕方、テラスで会う約束をする", confirmation:"じゃあ、夕方にこの階段の下のテラスで。同じ海がどんな色になるか、一緒に見よう。途中で寄り道したくなったら、次の夕方でもいいから。", arrival:"あ、来たね。高台で話したときより、海の色が柔らかくなった。待ち合わせがあると、同じ道でも誰かの顔を思い浮かべながら歩くんだね。", memory:"高台で会った旅人と、夕方のテラスで待ち合わせた。"})
  });
  function meetingPlan(journey) { return MEETING_PLANS[journey.appointment] || null; }
  function meetingOffer(journey, person) {
    if (journey.appointment || presence(journey) !== person || !journey.encounters.includes(person)) return null;
    return Object.values(MEETING_PLANS).find(plan => plan.person === person && plan.from === journey.location && plan.offeredAt === journey.time && !(journey.appointmentsKept || []).includes(plan.id)) || null;
  }
  function meetingDue(journey, person) {
    const plan = meetingPlan(journey);
    return plan && plan.person === person && plan.place === journey.location && plan.time === journey.time ? plan : null;
  }
  function presence(journey) {
    if (journey.location === "promenade" && journey.time === "day") return "guide";
    if (journey.location === "harbor" && journey.time === "sunset") return "guide";
    if (journey.location === "lounge" && journey.time === "night") return "guide";
    if (journey.location === "highland" && journey.time === "day") return "traveler";
    if (journey.location === "lookout" && journey.time !== "day") return "traveler";
    const newcomer = Object.keys(NEW_CAST).find(id => NEW_CAST[id].schedule[journey.time] === journey.location);
    if (newcomer) return newcomer;
    return Object.keys(RESIDENTS).find(id => RESIDENTS[id].place === journey.location) || "";
  }
  function encounterText(stay, id, followup = false) {
    const seen = stay.journey.encounters.includes(id);
    const location = stay.journey.location;
    if (Object.hasOwn(NEW_CAST,id)) {
      const person=NEW_CAST[id];
      if (followup) return person.more;
      if (stay.relationships?.[id]?.stage === "complete") return person.relation.after;
      const noticed = stay.journey.discoveries;
      if(id==="noel" && stay.journey.reflections.includes("noel-walk-return"))return "おかえり。二つの青を見比べた話、覚えてる。今日は君が来ると、光を測る手も止まるね。次は作品の話じゃなくても、少し座っていって。";
      if(id==="marea" && stay.journey.reflections.includes("marea-walk-return"))return "あ、来たね。庭から高台まで歩いた日、覚えてるよ。今日は点検の話ばかりにしないつもり。あなたが次に行ってみたい場所も、私に教えて。";
      if (id === "noel" && noticed.includes("museum-glass") && noticed.includes("cove-view")) return seen ? "ガラスも入り江も見てきたんだね。海の青は深さで、ガラスの青は厚みで変わる。……僕、説明が長くなると、人の顔を見なくなるんだ。今日は、君が戻ってくる方を見てた。どちらの青が残った？" : "ノエルです。ガラスも入り江も見てきたんだね。『潮のかたち』の灯りを手伝ってるんだ。海の青は深さで、ガラスの青は厚みで変わる。でも、正解の見方は決めたくない。君にはどちらの青が残った？";
      if (id === "marea" && noticed.includes("garden-view") && noticed.includes("highland-view")) return (seen?"":"初めまして、マレアです。")+"庭も高台も見てきたんだね。あの道、私が手入れしてるの。遠くから見ると、港の屋根まで小さかったでしょう。……私も、ときどきあの港から旅に出たい。島を守るのが好きなのと、外を見たいのは、両方あっていいよね。";
      return (seen ? person.again + " " : "") + person.ordinary[stay.journey.time];
    }
    const elsewhere = (stay.journey.meetings || []).some(key => key.startsWith(id + ":") && key !== id + ":" + location);
    const resident = RESIDENTS[id];
    const episode = encounterEpisode(stay, id);
    const planned = meetingDue(stay.journey, id);
    if (planned && !followup) return planned.arrival;
    if(!followup && stay.journey.pursuit==="museum-table" && stay.journey.discoveries.includes("museum-table")){
      if(id==="vendor")return "美術館の食卓の絵を見てきたんですか？ あの青い縁の皿、町角の家庭料理店でも使っていますよ。今日はその店へ、この籠の野菜を届けました。食卓を迎える人にも、声をかけてみてください。";
      if(id==="homecook")return "あの絵の空いた椅子が気になったのね。私も席を整えるとき、椅子を少し引いておきます。まだ誰もいない席にも、迎えたい気持ちがあるから。食事を頼まなくても、ひと息ついていってね。";
    }
    if(!followup && id==="curator"){
      const entries=pursuits(stay),chosen=entries.find(entry=>entry.selected&&entry.connected),last=stay.journey.reflections.filter(key=>key.endsWith("-return")).at(-1);
      const returned=chosen || entries.find(entry=>entry.complete&&entry.id+"-return"===last);
      if(returned)return ({"museum-boat":"港まで歩いてきたんですね。あのロープは飾りではなく、舟と島をつなぐもの。絵へ戻ると、小さな線にも役目が見えてきませんか。","museum-glass":"入り江で、浅い青と深い青を見つけてきたんですね。海をそのまま写さなくても、厚みを重ねて同じ変化を生み出せる。作品を見る旅も、島を見る旅も、まだ続きがあります。","museum-table":"町の人に話を聞いてきたんですね。差し出す皿や、少し引いた椅子。人を迎える仕草は、絵の中だけのものではなかったでしょう。もう一度、あの空いた席を見てみてください。"})[returned.id];
    }
    if (episode?.complete) return episode.again;
    if (followup && id === "curator" && stay.journey.discoveries.includes("museum-table")) return "あの絵が気になったんですね。町角の家庭料理店でも、あんなふうに人が食卓を囲んでいます。鍋の野菜は通りの八百屋さんから。店の人に聞いて、食べてみると、絵の見え方も変わるかもしれません。";
    const mealPlace = ({fishcook:"fishdiner",homecook:"homekitchen",baker:"bakery"})[id];
    if (mealPlace && stay.dining.memories[mealPlace]) return followup ? resident.more : ({fishcook:"定食、食べてくれてありがとう。港を歩いて、またお腹が空いたら寄ってね。",homecook:"煮込み、ゆっくり食べられた？ 使っている野菜は、通りの八百屋さんのものなの。帰りに、顔を出してみて。",baker:"パンの香り、覚えていてくれたらうれしいな。次に町角のお店で食べたら、今日のパンと比べてみてください。"})[id];
    if (resident) return followup ? resident.more : (seen ? resident.again + " " : "") + resident[stay.journey.time === "night" ? "night" : "day"];
    if (id === "guide" && location === "harbor") return followup
      ? "このあと巡回を終えたら、海側のラウンジでひと休みするつもりです。ホテルかテラスから入れます。もしまた会ったら、今日はどこを歩いたか聞かせてください。"
      : elsewhere ? "また会いましたね。港まで歩いてきたんですね。私は夕方の巡回中です。同じ海も、このあたりは舟の音が混じるでしょう。" : "こんにちは。夕方は港のあたりを案内しています。町へ行くなら岸壁の先、船着き場ならあちらの階段です。どちらも、歩いてすぐですよ。";
    if (id === "guide" && location === "lounge") return followup
      ? "道を教えた人と別の場所で会えるのは、私もちょっとうれしいんです。部屋に帰ったら、今日好きだった景色を一つ思い返してみて。明日はそこから、また歩いてもいいですね。"
      : elsewhere ? "あ、また会えましたね。今日はもう仕事を終えて、少し海を見ていました。案内する側でも、何も決めずに過ごすこの時間が好きなんです。" : "こんばんは。昼は海の回廊を案内していますが、今はひと休み。ここなら、何か注文しなくても海を眺めて過ごせますよ。";
    if (id === "traveler" && location === "highland") return followup
      ? "夕方からは海を望むテラスに行こうと思ってる。この階段を下りた先だよ。次に会ったら、どの道が気に入ったか教えて。"
      : elsewhere ? "テラスで会ったね。今日は少し高いところから。同じ屋根でも、歩いた道が増えると、見つけられる場所が増える気がする。" : "こんにちは。僕もこの島を歩いてるところ。上から道を眺めて、次はどこへ行こうかなって。君は、もう気に入った場所を見つけた？";
    if (id === "guide") return followup
      ? "この先のテラスから広場へ戻れます。ガレリアのルアナさんは、光のきれいな場所をよく知っているので、旅の品を選ぶならぜひ。夕方は私も巡回を終えて、港の方へ行きます。"
      : seen ? "また会いましたね。今日はどこまで歩きました？ 海まで行ったら、そのまま広場へ一周できますよ。" : "こんにちは。海の方へ？ ここの小さな店は今日は休みですが、奥のテラスは開いています。あそこからの青が、とてもきれいなんです。";
    return followup
      ? "昼は高台や店、台を巡っていたけれど、今はここでひと休み。帰る前に、さっきとは違う景色を一つ見ておくのが好きなんだ。君も、よかったら。"
      : elsewhere ? "高台でも会ったね。ここまでの道、どうだった？ 僕はガレリアをのぞいてから来たところ。同じ島を歩いていても、それぞれの一日ができるんだね。"
      : seen ? "やあ、また来たんだね。ここ、何度見ても少し違う。今の海は、どんな色に見える？" : "こんにちは。風が気持ちいいね。昼に歩いた道なのに、光が変わるだけで知らない場所みたいだ。";
  }
  // Optional free walks connect an adult's interests to two existing sights.
  // Their next stop comes from real observations, not a new quest/save counter.
  function outings(stay) {
    const noticed=stay.journey.discoveries;
    return [
      {id:"noel",title:"ノエルと見比べる、二つの青",copy:"美術館のガラスから、入り江の海へ。同じ青が変わる理由を見つけて、ノエルに話そう。",stops:[{place:"museum",kind:"discover",id:"museum-glass",label:"『潮のかたち』を見る"},{place:"cove",kind:"discover",id:"cove-view",label:"入り江の浅瀬を眺める"}]},
      {id:"marea",title:"マレアの島、足元から高台へ",copy:"庭の木陰から、島を望む高台へ。手入れされた道と、その先の景色をマレアに聞いてみよう。",stops:[{place:"garden",kind:"discover",id:"garden-view",label:"庭の木陰で立ち止まる"},{place:"highland",kind:"discover",id:"highland-view",label:"高台から島を見渡す"}]}
    ].map(walk=>({...walk,complete:stay.journey.reflections.includes(walk.id+"-walk-return"),next:walk.stops.find(stop=>!noticed.includes(stop.id)) || {place:NEW_CAST[walk.id].schedule[stay.journey.time],kind:"encounter",id:walk.id,label:NEW_CAST[walk.id].name+"に、見つけた景色を話す"}}));
  }
  function outingHint(stay,id) {
    const walk=outings(stay).find(entry=>entry.id===id);if(!walk || walk.complete)return null;
    const next=walk.next,to=route(stay.journey.location,next.place)[1];
    return next.place===stay.journey.location ? {...next,copy:walk.title+"。"+next.label+"。"}
      : to ? {kind:"move",to,label:SCENES[to].label+"へ",copy:walk.title+"。"+next.label+"ために、ここから道をたどろう。"} : null;
  }
  // Reviewable first-stay prices. They do not convert any cabinet CREDIT.
  const MEALS = Object.freeze({
    fishdiner: { name: "港の焼き魚定食", price: 36, description: "焼き魚とレモン、ご飯、温かいスープ。", served: "焼きたてをどうぞ。レモンは、お好みで。", taste: "皮の香ばしさのあとに、魚の柔らかな甘さ。隣の席から、今日の港の話が聞こえてくる。", memory: "港の仕事を終えた人たちと、同じ食堂で焼き魚を食べた。店主の「また寄ってね」が、帰り道に残った。" },
    homekitchen: { name: "豆と野菜の煮込み", price: 24, description: "トマトと豆の煮込みに、パンとオリーブ。", served: "熱いから、ゆっくりね。パンを浸してもおいしいの。", taste: "柔らかく煮えた豆と、トマトの酸味。隣の席では、今日あったことの話がまだ続いている。", memory: "町角の店で、朝から煮込んだ鍋料理を食べた。知らない町の食卓に、少しだけ混ぜてもらった気がした。" },
    bakery: { name: "パンと野菜のスープ", price: 18, description: "ちぎりパン、野菜のスープ、バターとコーヒー。", served: "どうぞ。まずは、パンを少し割ってみてください。", taste: "パンを割ると、小麦の香りが立つ。スープに浸すと、さっきとはまた違う柔らかさになった。", memory: "パン屋の窓辺で、スープとパンをゆっくり味わった。通りの店へも届くパンの、同じ香りを覚えている。" }
  });
  // Expected sequence rejects stale confirmation/finish events even after a meal is closed.
  function mealAction(draft, action) {
    const meal = MEALS[action.id], dining = draft.stay.dining;
    if (!meal || draft.stay.journey.location !== action.id) return "この店で注文してください。";
    if (action.sequence !== dining.sequence) return "注文の状態が変わりました。開き直してください。";
    if (action.type === "order") {
      if (dining.active) return "先に、注文済みの食事を終えてください。";
      if (draft.coins < meal.price) return "COINSが足りません。";
      if (dining.sequence >= Number.MAX_SAFE_INTEGER - 1) return "注文を保存できません。";
      draft.coins -= meal.price;
      dining.sequence++;
      dining.active = { id: action.id, stage: "served", time: draft.stay.journey.time };
      return;
    }
    const active = dining.active;
    if (!active || active.id !== action.id) return "この食事は注文されていません。";
    if (action.type === "taste" && active.stage === "served") active.stage = "tasted";
    else if (action.type === "finish" && active.stage === "tasted") {
      active.stage = "finished";
      dining.memories[action.id] = { count: Math.min(999, (dining.memories[action.id]?.count || 0) + 1), time: active.time };
    } else if (action.type === "leave" && active.stage === "finished") dining.active = null;
    else return "食事の状態が変わりました。開き直してください。";
  }
  const GOODS = Object.freeze([
    Object.freeze({ id: "table-print", name: "食卓のミニプリント", gift: true, image: "assets/resort-keepsakes-v1/table-print-v1.png", kind: "町での食事 · 美術館の小さな贈りもの", description: "食卓を囲む人たちの絵を、小さな木の台に。", memory: "町角の鍋料理を食べ、八百屋さんと店主の話を聞いてから、もう一度あの絵を見た。学芸員が「次に見るときのために」とくれた、小さなプリント。" }),
    Object.freeze({ id: "postcard", name: "ガレリアの絵はがき", price: 30, image: "assets/imageboard/05_stage_galleria-lapin-mall.png", kind: "今日の景色 · 卓上フレーム付き", description: "青い空、ヤシの影、床にこぼれる光。今日通った場所を、客室の片隅に。", memory: "ガレリアで、ルアナがフレームと一緒に包んでくれた一枚。ガラス屋根から落ちる日差しを、部屋へ持ち帰った。", thanks: "この一枚を見たら、今日の光を思い出してね。フレームも一緒に包むわ。" }),
    Object.freeze({ id: "sea-glass", name: "海色のガラスうさぎ", price: 120, image: "assets/resort-stay-v2/sea-glass-v2.png", kind: "島の色 · 小さなガラスの置物", description: "光を受けるたび、青から緑へ。海の回廊で見つけた色を、窓辺にも。", memory: "ガレリアで選んだ、海色のガラス。ルアナは「窓の近くで、朝と夕方の色を比べてみて」と教えてくれた。", thanks: "窓の近くに置いてみて。朝と夕方で、違う海の色になるの。" }),
    Object.freeze({ id: "lamp", name: "真鍮の読書ランプ", price: 480, image: "assets/resort-stay-v2/reading-lamp-v2.png", kind: "夜の居場所 · 卓上照明", description: "夜風と、本を一冊。小さな灯りが、客室にもうひとつの居場所をつくる。", memory: "ガレリアから持ち帰った真鍮のランプ。「夜も、部屋でゆっくりしていってね」。ルアナの言葉と、柔らかな灯りが残った。", thanks: "夜になったら灯してみて。外の灯りを眺めながら、ゆっくり過ごせると思うわ。" })
  ]);
  // Reservation costs nothing; the displayed fare is charged once when boarding.
  // These are proposed activity terms, independent of cabinet credit and odds.
  const CRUISE = Object.freeze({ name: "海から島を眺める小さな船旅", price: 90 });
  function cruiseAction(draft, action) {
    const cruise = draft.stay.cruise, active = cruise.active;
    if (action.sequence !== cruise.sequence) return "予約の状態が変わりました。開き直してください。";
    if (cruise.sequence >= Number.MAX_SAFE_INTEGER - 1) return "予約を保存できません。";
    if (draft.stay.journey.location !== "pier") return "桟橋で手続きしてください。";
    if (action.type === "reserve") {
      if (active || !["sunset", "night"].includes(action.slot)) return "この便は予約できません。";
      cruise.active = { slot: action.slot, stage: "reserved" };
    } else if (!active) return "予約がありません。";
    else if (action.type === "change" && active.stage === "reserved" && ["sunset", "night"].includes(action.slot)) active.slot = action.slot;
    else if (action.type === "cancel" && active.stage === "reserved") cruise.active = null;
    else if (action.type === "wait" && active.stage === "reserved") draft.stay.journey.time = active.slot;
    else if (action.type === "board" && active.stage === "reserved") {
      if (draft.stay.journey.time !== active.slot) return "予約の時間帯に桟橋へお越しください。";
      if (draft.coins < CRUISE.price) return "COINSが足りません。予約はそのまま残っています。";
      draft.coins -= CRUISE.price;
      active.stage = "aboard";
    } else if (action.type === "look" && active.stage === "aboard") active.stage = "coast";
    else if (action.type === "return" && ["aboard", "coast"].includes(active.stage)) {
      cruise.trips = Math.min(999, cruise.trips + 1);
      cruise.lastSlot = active.slot;
      cruise.active = null;
      draft.stay.journey.time = "night";
    } else return "この手続きは今はできません。";
    cruise.sequence++;
  }
  function purchase(draft, id) {
    const item = GOODS.find(entry => entry.id === id);
    if (!item || item.gift) return "この品は購入できません。";
    if (draft.stay.souvenirs.includes(id)) return "この品は、すでに持っています。";
    if (draft.coins < item.price) return "COINSが足りません。";
    draft.coins -= item.price;
    draft.stay.souvenirs.push(id);
    if (id === "postcard") draft.stay.ownedPostcard = true;
    draft.stay.metLuana = true;
  }
  function place(draft, id, spot) {
    if (!draft.stay.souvenirs.includes(id)) return "この品はまだ持っていません。";
    if (!["left", "center", "right", ""].includes(spot)) return "ここには飾れません。";
    const previous = draft.stay.placements[id] || "";
    const displaced = Object.keys(draft.stay.placements).find(key => key !== id && draft.stay.placements[key] === spot);
    if (displaced) {
      if (previous) draft.stay.placements[displaced] = previous;
      else delete draft.stay.placements[displaced];
    }
    if (spot) draft.stay.placements[id] = spot;
    else delete draft.stay.placements[id];
    draft.stay.displaySpot = draft.stay.placements.postcard || "";
  }

  function transition(raw, action) {
    const state = store.normaliseJourney(raw);
    const fail = reason => ({ ok: false, reason, journey: state });
    if (!action || typeof action !== "object") return fail("unknown-action");
    if (action.type === "move") {
      if (!SCENES[state.location].exits.includes(action.to)) return fail("not-connected");
      state.location = action.to;
      state.arrived = true;
      if (!state.visited.includes(action.to)) state.visited.push(action.to);
    } else if (action.type === "travel") {
      // Revisit shortcuts only after discovering the destination. Do not turn
      // this into teleportation through not-yet-built scenery.
      if (!["plaza", "galleria", "room"].includes(action.to) || !state.visited.includes(action.to)) return fail("not-visited");
      state.location = action.to;
    } else if (action.type === "discover") {
      if (DISCOVERIES[action.id] !== state.location) return fail("wrong-place");
      if (!state.discoveries.includes(action.id)) state.discoveries.push(action.id);
    } else if (action.type === "encounter") {
      if (presence(state) !== action.id || !action.id) return fail("not-present");
      if (!state.encounters.includes(action.id)) state.encounters.push(action.id);
      const walk=outings({journey:state}).find(entry=>entry.id===action.id);
      if(walk && !walk.complete && walk.next.kind==="encounter")state.reflections.push(walk.id+"-walk-return");
      if (["guide", "traveler"].includes(action.id)) {
        const meeting = action.id + ":" + state.location;
        if (!state.meetings.includes(meeting)) state.meetings.push(meeting);
      }
      const planned = meetingDue(state, action.id);
      if (planned) {
        if (!state.appointmentsKept.includes(planned.id)) state.appointmentsKept.push(planned.id);
        state.appointment = "";
      }
    } else if (action.type === "promise") {
      const plan = MEETING_PLANS[action.id];
      if (!plan || meetingOffer(state, plan.person)?.id !== action.id) return fail("meeting-unavailable");
      state.appointment = plan.id;
    } else if (action.type === "cancel-promise") {
      if (!state.appointment || state.appointment !== action.id) return fail("meeting-changed");
      state.appointment = "";
    } else if (action.type === "time") {
      if (!REST_PLACES.includes(state.location)) return fail("cannot-rest-here");
      const next = store.STAY_TIMES[(store.STAY_TIMES.indexOf(state.time) + 1) % store.STAY_TIMES.length];
      if (action.to !== next) return fail("invalid-time-step");
      state.time = next;
    } else return fail("unknown-action");
    return { ok: true, journey: state };
  }

  function dialogueContext(stay) {
    const value = store.normaliseStay(stay);
    return Object.freeze({
      firstMeeting: !value.metLuana,
      seenSea: value.journey.discoveries.includes("sea-light"),
      knowsStoreHours: value.journey.discoveries.includes("store-hours"),
      preference: value.preference,
      ownsPostcard: value.ownedPostcard,
      displayedPostcard: Boolean(value.displaySpot),
      time: value.journey.time
    });
  }

  function encounterEpisode(stay, id) {
    if (id === "curator") return {
      key:"sharedTable", complete:stay.episodes.sharedTable,
      ready:Boolean(stay.journey.discoveries.includes("museum-table") && stay.dining.memories.homekitchen && ["vendor","homecook"].every(person => stay.journey.encounters.includes(person))),
      label:"町で囲んだ食卓の話をする",
      story:"あのお店で食べてきたんですね。野菜を育てる人、料理する人、食べる人。絵の外にも続きがあるでしょう。――よかったら、この小さなプリントを。お部屋で見たときに、今日会った人を思い出してもらえたら。",
      again:"あのプリント、お部屋で見てみました？ もう、絵の中だけの食卓ではありませんね。次に来たときも、町の人に会っていってください。"
    };
    if (id === "traveler" && stay.journey.location === "lookout") return {
      key:"islandLights", complete:stay.episodes.islandLights, ready:stay.cruise.trips > 0,
      label:"海から見た島の話をする",
      story:"船に乗ったんだ。海から見ると、帰る部屋の灯りまで特別に見えるよね。僕はここから、君は海から。同じ島でも、それぞれの一日がある。……帰ったら、持ち帰った品も違って見えるかもしれないね。",
      again:"やあ。今日はどんな場所から島を見た？ あの船の話を聞いて、僕も海から眺めてみたくなったよ。"
    };
    return null;
  }
  function finishEncounter(draft, id) {
    const stay = draft.stay, episode = encounterEpisode(stay, id);
    if (!episode || ENCOUNTERS[id] !== stay.journey.location || presence(stay.journey) !== id || !stay.journey.encounters.includes(id)) return "ここでは、その話はできません。";
    if (!episode.ready || episode.complete) return "話の状態が変わりました。もう一度話しかけてください。";
    stay.episodes[episode.key] = true;
    if (id === "curator" && !stay.souvenirs.includes("table-print")) stay.souvenirs.push("table-print");
  }
  function itemMemory(stay, id) {
    const item = GOODS.find(entry => entry.id === id);
    if (!item) return "";
    return item.memory + (id === "sea-glass" && stay.episodes.islandLights ? " 海から戻ったあと、テラスの旅人と島の灯りの話をした。部屋で見る青には、あの船旅の海も重なっている。" : "");
  }

  // Reviewable travel milestones, with no spending, affection or final-ending gate.
  function travelReflections(stay) {
    const journey = stay.journey;
    const familiar = ["guide", "traveler"].some(id => new Set((journey.meetings || []).filter(key => key.startsWith(id + ":"))).size > 1);
    const discovered = journey.discoveries.length > 0;
    const chosen = journey.visited.includes("town") || Object.keys(stay.placements).length > 0 || Object.keys(stay.dining.memories).length > 0 || stay.cruise.trips > 0;
    return [
      { id: "noel-walk-return", ready: journey.reflections.includes("noel-walk-return"), title: "ノエルと見比べた、二つの青", text: "『潮のかたち』のガラスと入り江の浅瀬。同じ青の違いを見つけてノエルに話した。正解を決めつけずに見てほしいという、作り手の気持ちも知った。" },
      { id: "marea-walk-return", ready: journey.reflections.includes("marea-walk-return"), title: "マレアの庭から、高台へ", text: "木陰の庭と、島を望む高台を歩いた。道を守るマレアにも、あの港から旅に出たい日がある。島の景色と一緒に、その人の望みも聞いた。" },
      { id: "first-walk", ready: discovered || stay.metLuana, title: "はじめて歩いた道", text: "知らなかった道の先で、足を止める場所を見つけた。部屋へ帰ってきても、その景色は自分の中に残っている。" },
      { id: "familiar-island", ready: familiar, title: "見知った顔のある島", text: "別の場所で、知っている人に会った。道をたどるだけだった島に、あの人が過ごしている時間が重なった。" },
      { id: "my-stay", ready: familiar && discovered && chosen, title: "自分で選んだ一日", text: "気になった道を選び、人に会い、好きな景色を持って帰ってきた。ひとつの旅として、この部屋でひと息つこう。次の散歩も、台に戻る時間も、自分で選べる。" }
    ].filter(entry=>!entry.id.endsWith("-walk-return")||entry.ready).map(entry => ({ ...entry, saved: (journey.reflections || []).includes(entry.id) }));
  }
  function rememberStay(draft) {
    if (draft.stay.journey.location !== "room") return "客室で、旅を振り返りましょう。";
    const fresh = travelReflections(draft.stay).filter(entry => entry.ready && !entry.saved);
    if (!fresh.length) return "新しく残せる記憶はありません。";
    for (const entry of fresh) draft.stay.journey.reflections.push(entry.id);
  }

  // A broad first chapter across the existing systems. It describes the trip
  // without locking routes or awarding currency; the player chooses how each
  // middle step is fulfilled and closes the chapter only back in the room.
  function chapterOne(stay) {
    const journey = stay.journey;
    const played = (stay.rewards?.lifetime || 0) > 0 || (stay.lastSession?.games || 0) > 0;
    const explored = journey.discoveries.length > 0 || journey.visited.length >= 5;
    const lived = Object.keys(stay.dining.memories).length > 0 || stay.cruise.trips > 0 || stay.souvenirs.length > 0 || journey.appointmentsKept.length > 0;
    const connected = stay.metLuana || journey.meetings.length > 0 || journey.encounters.length > 0
      || Object.values(stay.relationships).some(entry => entry.moments.length > 0);
    const returned = journey.location === "room";
    const complete = journey.reflections.includes("chapter-one");
    const steps = [
      {id:"play", label:"勝負の熱を持ち帰る", done:played, hint:"カジノフロアで好きな台を選び、ひとつの決着まで遊ぶ。"},
      {id:"explore", label:"島の景色に出会う", done:explored, hint:"光る道を選び、気になる景色の前で足を止める。"},
      {id:"live", label:"土地の時間を選ぶ", done:lived, hint:"食事、船旅、思い出の品から、心が向くものをひとつ選ぶ。"},
      {id:"connect", label:"誰かと言葉を交わす", done:connected, hint:"ルアナや島で暮らす人に、自分から声をかける。"},
      {id:"return", label:"客室へ帰る", done:returned, hint:"ホテルへ戻り、海の見える客室で一日を振り返る。"}
    ];
    return {steps, complete, readyToClose:steps.slice(0,4).every(step => step.done) && returned};
  }
  function finishChapterOne(draft) {
    const chapter = chapterOne(draft.stay);
    if (chapter.complete) return "第一章は、すでに旅の記憶に残っています。";
    if (!chapter.readyToClose) return "今の旅を続けてから、客室へ帰りましょう。";
    draft.stay.journey.reflections.push("chapter-one");
  }

  // A silent mascot suggests one ordinary adjacent path. Looking at its hint
  // never changes the itinerary, time, appointment, wallet or chapter state.
  function trailHint(stay) {
    if (!Object.hasOwn(SCENES,stay.journey.location)) return null;
    const journey = stay.journey, here = SCENES[journey.location];
    if (!here) return null;
    const plan = meetingPlan(journey);
    const clue=pursuitHint(stay);
    if(clue && stay.cruise.active?.stage!=="reserved" && !(plan&&plan.time===journey.time))return clue;
    const nearby = SCENIC_IDS.map(id=>scenicMoment(stay,id)).find(moment=>moment && !moment.remembered);
    if(nearby && stay.cruise.active?.stage!=="reserved" && !(plan && plan.time===journey.time))return {kind:"discover",id:nearby.id,label:nearby.label,copy:"小兎が足を止め、景色の方へ耳を向けた。一緒に、少し眺めていこう。"};
    let aim = stay.cruise.active?.stage === "reserved" && here.id !== "pier" ? "pier"
      : plan && plan.time === journey.time && plan.place !== here.id ? plan.place
      : ["promenade","harbor","cove","pool","garden","highland","lookout","town","shop","lounge","room"].find(id=>!journey.visited.includes(id) && id !== here.id);
    if (!aim) {
      const unvisited = Object.keys(SCENES).filter(id=>!journey.visited.includes(id) && id !== here.id);
      aim = unvisited.sort((a,b)=>route(here.id,a).length-route(here.id,b).length)[0];
    }
    const preferred = {arrival:"plaza",plaza:"galleria",galleria:"promenade",shop:"galleria",promenade:"harbor",lookout:"highland",hotel:"garden",room:"hotel",pool:"cove",harbor:"town",pier:"harbor",garden:"highland",highland:"lookout",cove:"harbor",lounge:"lookout",town:"bakery",museum:"town",fishdiner:"town",homekitchen:"town",bakery:"town",casino:"plaza"};
    const to = aim ? route(here.id,aim)[1] : preferred[here.id];
    if (!here.exits.includes(to)) return null;
    const booked = aim === "pier" && stay.cruise.active?.stage === "reserved";
    const promised = plan && aim === plan.place && plan.time === journey.time;
    const copy = booked ? "小兎が、船を予約した桟橋へ続く道を見つめている。"
      : promised ? "小兎が、待ち合わせの場所へ続く道で振り返った。"
      : aim === "shop" ? "小兎がガレリアの奥へ。売場の方が気になるみたい。"
      : aim === "promenade" ? "耳が潮風の方へ向いた。海辺の道が続いている。"
      : aim === "town" ? "小兎が町へ続く道で立ち止まった。通りには、暮らしの気配。"
      : aim === "lounge" ? "小兎が椅子のある方を見ている。海風の中で、ひと休みできそう。"
      : aim === "room" ? "小兎がホテルへ続く道で待っている。自分の部屋へ帰る道だ。"
      : "小兎が道の先で振り返った。次の景色を、一緒に見に行けそう。";
    return {to,aim:aim || to,label:SCENES[to].label + "へ",copy};
  }

  // Share only things the player actually experienced. These optional stories
  // connect existing activities without adding affection, rewards or a quest gate.
  function luanaTopics(stay) {
    const remembered = stay.luanaStories || [];
    const familiar = travelReflections(stay).find(entry => entry.id === "familiar-island").ready;
    const meals = Object.keys(stay.dining.memories).filter(id => MEALS[id]);
    const displayed = GOODS.filter(item => stay.placements[item.id]);
    const plannedReunions = (stay.journey.appointmentsKept || []).some(id => MEETING_PLANS[id]);
    return [
      { id: "scenery", ready: stay.journey.discoveries.length > 0, label: "見つけた景色の話", reply: stay.journey.discoveries.includes("highland-view") ? "高台まで歩いたのね。ここから見える屋根が、上からはどんなふうに見えた？ 自分で歩いた道が見つかると、遠景も少し近くなる気がするわ。" : "足を止めたくなる景色があったのね。ここで品を選ぶときも、その色を思い出してみて。持ち帰らなくても、好きな景色が一つできたのはうれしいことよ。", again: "あの景色の話、覚えてるわ。別の時間に歩いたら、また違う光に会えた？", greeting: "前に教えてくれた景色、私も思い浮かべていたの。また好きな場所ができたら、聞かせてね。" },
      { id: "table", ready: meals.length > 0, label: "町で食べたものの話", reply: (meals.length ? meals.map(id => MEALS[id].name).join("、") + "。町の食事を楽しんできたのね。" : "") + "食べたあとに町を歩くと、窓の灯りまで少し親しく見えない？ 美術館の食卓の絵も、今なら違うところが気になるかもしれないわ。", again: "町の食卓の話ね。味と一緒に、そのとき聞こえた声まで思い出すことがあるわ。またあのお店に寄れた？", greeting: "この前の町での食事、楽しそうに話してくれたわね。今日はどんなふうに過ごしてきたの？" },
      { id: "cruise", ready: stay.cruise.trips > 0, label: "船から見た島の話", reply: "海からガレリアを見つけてくれたの？ 私はそのとき、あの屋根の下にいたのね。帰ってくる場所を外から見るって、少し不思議。今夜の部屋からの海も、違って見えそうね。", again: "船から見た灯りの話、覚えてるわ。あの海の色を思い出すと、同じガラスも違って見えるかもしれないわね。", greeting: "海から見た島の話を聞いてから、夕方の窓の外が少し気になるの。今日は陸を歩いてきた？" },
      { id: "reunion", ready: familiar, label: "また会った人の話", reply: "別の場所でも会えたのね。案内をしているときや、ひと休みしているとき。同じ人でも、違う一面が見えるでしょう。顔を知っている人が増えると、道を歩く楽しみも増えるわね。", again: "あの再会の話ね。次にすれ違ったら、もう道を聞くだけじゃなく、今日のことを話せるわね。", greeting: "この前、島でまた会えた人の話をしてくれたでしょう。私も、こうしてあなたが寄ってくれるとうれしいわ。" },
      { id: "room", ready: displayed.length > 0, label: "部屋に飾った品の話", reply: (displayed.length ? displayed[0].name + "を飾ったのね。" : "") + "ここで見ると旅先の品だけれど、部屋に置くと、あなたが過ごした時間の一部になるのね。朝と夜、好きな方の光で眺めてみて。", again: "あの品、部屋の景色になじんできた？ 気分で場所を変えてみてもいいし、好きな場所にずっと置いてもいいと思うわ。", greeting: "飾ってくれた品の話、覚えてるわ。部屋へ戻る楽しみが少し増えていたら、うれしいな。" },
      { id: "stay", ready: stay.journey.reflections.includes("my-stay"), label: "この滞在を振り返って話す", reply: "いろいろ歩いて、自分の一日ができたのね。初めてここへ来たときとは、見えるものも少し変わったかしら。次は何も決めずに歩いても、好きな台へ戻っても。帰りに、また話を聞かせてね。", again: "あの滞在の続きね。前と同じ道でも、今日は別のところで足を止めたくなるかもしれないわ。あなたのペースで楽しんできて。", greeting: "おかえりなさい。ここで聞かせてくれた旅の話、覚えてる。今日は、その続きの一日ね。" }
    ].filter(entry => entry.ready || remembered.includes(entry.id)).map(entry => ({ ...entry,
      reply: entry.id === "reunion" && plannedReunions ? "待ち合わせをして会ってきたのね。偶然会うときとは、道を歩く気分も違いそう。" + entry.reply : entry.reply,
      again: entry.id === "reunion" && plannedReunions ? "約束して会える人ができたのね。行きたい景色だけでなく、会いたい顔も思い浮かぶようになると、この島での一日も変わりそうね。" : entry.again,
      shared: remembered.includes(entry.id) }));
  }
  function shareLuanaStory(draft, id) {
    if (draft.stay.journey.location !== "shop") return "ガレリアの売場で話しましょう。";
    const topic = luanaTopics(draft.stay).find(entry => entry.id === id);
    if (!topic) return "今は、その話題はありません。";
    if (!draft.stay.luanaStories.includes(id)) draft.stay.luanaStories.push(id);
    draft.stay.metLuana = true;
  }

  // All current island adults are eligible; no exclusive first-partner choice,
  // spending gate or affection score. These individual scenes are draft writing.
  const RELATIONSHIPS = Object.freeze({
    ...Object.fromEntries(Object.entries(NEW_CAST).map(([id,person])=>[id,person.relation])),
    luana: {name:"ルアナ", first:"品物の話じゃなくて、私のこと？ うれしい。でも今は売場を離れられないの。時間が違うときに、また顔を見せて。", reunion:"また会えたね。前はゆっくり話せなかったでしょう。私も、あなたがどんな道を歩いてくるのか、少し気になっていたの。今度は夜、落ち着いて話したいな。", invitation:"今日は、品物を選ばなくてもいいの。私もあなたと、もう少し一緒にいたい。お互いにそう思っているなら、今夜はふたりで過ごさない？", after:"窓の向こうの灯りを見ながら、ルアナが小さく笑った。「明日、売場で会っても、ちゃんと声をかけてね。今日の続きがあるって、うれしいから。」", memory:"ルアナと、品物の話だけではない夜を過ごした。"},
    guide: {name:"案内係", first:"いつも道の話ばかりでしたね。私の好きな場所の話もしたいけれど、今日は巡回の途中なんです。また時間が合うときに。", reunion:"また少し、仕事の時間と重なってしまいましたね。でも、会いに来てくれたことは覚えています。夜のラウンジなら、私自身の話もゆっくりできそうです。", invitation:"今は仕事を終えています。あなたと一緒にいたいのは、案内の続きだからではないんです。あなたも同じ気持ちなら、今夜をふたりで過ごしませんか。", after:"「誰かの帰り道になれるって、こんな気持ちなんですね。」案内係は窓の灯りを眺めた。明日の巡回で会ったら、また挨拶をしようと約束した。", memory:"仕事を終えた案内係と、お互いの気持ちを確かめて過ごした。"},
    traveler: {name:"旅人", first:"一緒に歩きたいけれど、今日は先に見たい場所があるんだ。君の旅も急がせたくない。またどこかで、続きの話をしよう。", reunion:"また会えた。違う道を選んでも、こうして話が続くんだね。今度は夜のテラスで。次は、もう少し長く一緒にいたい。", invitation:"旅程を決めずに、今夜は君と過ごしたい。君もそう思ってくれているなら、ふたりで静かな時間を過ごさない？", after:"「明日は、また別の道を歩いてもいいよね。」旅人はそう言って、こちらを見た。「それでも、今日のことを話せる相手がいる。それがうれしいんだ。」", memory:"旅人と、別々の旅が重なる静かな夜を過ごした。"},
    vendor: {name:"通りの八百屋さん", first:"店の外の私のことも、気にしてくれるんですね。今日はまだ配達が残っていて。また、時間の違うときに話しましょう。", reunion:"今日も立ち寄ってくれたんですね。すれ違ってばかりだったけれど、あなたが来ると、通りの景色が少し変わる気がします。店じまいの頃なら、ゆっくりできそう。", invitation:"今日はもう、店の仕事はおしまいです。私もあなたと一緒にいたい。よかったら、今夜はふたりで過ごしませんか。", after:"空になった配達籠を片付けながら、「明日もいつもの通りだけれど、同じではないんですね」と笑った。次に顔を合わせたら、今日の話の続きをしよう。", memory:"八百屋さんと、店じまいの先に続く夜を過ごした。"},
    curator: {name:"美術館の学芸員", first:"作品を通してではなく、私と話したいんですね。今は展示の確認があるので、また別の時間に。私も、続きを聞きたいです。", reunion:"今日は短い時間でも会えてよかった。前に聞いた言葉を思い出して、同じ絵を見直していたんです。夜の静かな時間なら、もっと話せそうですね。", invitation:"作品の解説を離れて、今夜はあなたと過ごしたいです。あなたも望んでくれるなら、ふたりの時間にしませんか。", after:"「同じ作品でも、明日は違って見えるでしょうね。」学芸員の言葉に、こちらも頷いた。何を見たかより、誰と過ごしたかを覚えている夜になった。", memory:"学芸員と、作品の向こうにいるお互いを知る夜を過ごした。"},
    fishcook: {name:"魚料理食堂の店主", first:"料理以外の話か。うれしいね。でも今は火を見ていないと。また時間を変えて寄ってくれる？", reunion:"前は話の途中だったね。今日は少し、あなたのことを聞けてよかった。閉店の頃なら、仕事の手を止めて向き合えると思う。", invitation:"火も落としたし、今日はもう仕事は終わり。私も、あなたともう少し一緒にいたい。今夜、ふたりで過ごしてもいいかな。", after:"「また食堂に来るときは、空腹じゃなくてもいいから。」店主は照れたように笑った。明日の仕込みの話をする声が、さっきより近く感じられた。", memory:"魚料理食堂の店主と、仕事を終えた夜を一緒に過ごした。"},
    homecook: {name:"家庭料理店の店主", first:"私の話も聞きたいの？ ありがとう。今は鍋から離れられないけれど、また別の時間に、ゆっくり話せたらいいわね。", reunion:"この前は落ち着かなかったでしょう。今日は、少し話せてうれしかった。今度は夜、最後の片付けが終わる頃に会えたら。", invitation:"今日はもう、誰かの食卓を整える仕事はおしまい。私もあなたと過ごしたいの。あなたもそう思うなら、今夜はふたりの時間にしませんか。", after:"「いつも迎える側だから、こうして誰かとゆっくりするのは少し久しぶり。」店主は温かいカップを置いた。次の挨拶を、前より楽しみに思えた。", memory:"家庭料理店の店主と、迎える側と訪れる側を離れて過ごした。"},
    baker: {name:"パン屋の店主", first:"焼き上がりを待つ間なら、と思ったけれど、今日は配達にも出ないと。また違う時間に会えたら、続きを話したいです。", reunion:"また時間が少しずれましたね。それでも顔を見ると、今日はいい日だなって思います。夜、片付けのあとなら、急がずにいられそう。", invitation:"明日の仕込みも済みました。今夜は、私もあなたと一緒にいたいです。同じ気持ちなら、ふたりで過ごしませんか。", after:"「明日も早起きだけれど、今日を急いで終わらせたくなかったんです。」パン屋の店主は笑った。何気ない朝の香りにも、この夜を思い出しそうだった。", memory:"パン屋の店主と、明日の朝へ続く穏やかな夜を過ごした。"}
  });
  function relationshipEpisode(stay, id) {
    if (!Object.hasOwn(RELATIONSHIPS,id)) return null;
    const person = RELATIONSHIPS[id];
    if (!person) return null;
    const here = id === "luana" ? stay.journey.location === "shop" : presence(stay.journey) === id;
    const saved = stay.relationships?.[id] || {moments:[],stage:"talk"};
    const context = stay.journey.location + ":" + stay.journey.time;
    const required = NEW_CAST[id]?.required || 2;
    const phase = saved.stage !== "talk" ? saved.stage : saved.moments.length >= required ? (stay.journey.time === "night" ? "invite" : "later") : saved.moments.includes(context) ? "later" : "talk";
    const text = phase === "complete" ? person.after : phase === "afterglow" ? "お互いの気持ちを確かめて、静かな時間を共に過ごした。窓の外では、島の灯りが揺れている。"
      : phase === "invite" ? person.invitation : phase === "later" ? "今は、それぞれの時間を大切にしよう。また別の時間に会えば、話の続きがある。" : saved.moments.length ? person.reunion : person.first;
    const nextTime = NEW_CAST[id] && ["day","sunset","night"].find(time => !saved.moments.includes(NEW_CAST[id].schedule[time]+":"+time));
    const nextMeeting = NEW_CAST[id] ? nextTime ? ({day:"昼",sunset:"夕方",night:"夜"})[nextTime]+"の"+SCENES[NEW_CAST[id].schedule[nextTime]].label : "夜の"+SCENES[NEW_CAST[id].schedule.night].label : "";
    return {...person,id,here,phase,text,context,count:saved.moments.length,required,nextMeeting};
  }
  // Player-paced scenes are presentation data. Replies never award affection,
  // money, or progress; only finishing the conversation commits a moment.
  const PERSONAL_SCENES = Object.freeze({
    luana: {title:"売場の向こうの話", opening:"ここに並べる前に、品物をひとつずつ窓辺に置くの。光が当たったときの顔を、見ておきたくて。", detail:"売れたあと、どんな部屋へ行くのかまでは見られないでしょう。だから、ここで一度だけ、ちゃんと眺めておく。", question:"あなたは旅先で、何を持ち帰りたくなる？", choices:[{label:"その場所の色を覚えていたい",reply:"色、いいね。海の青も、帰ってから思い出すと少し変わるのかな。変わっても、なくならないならいいな。"},{label:"誰かと話した時間かな",reply:"それは、棚に並べられないね。でも、今のこの時間も持ち帰ってくれるなら、うれしい。"}], reunion:"今日は、どんな道を歩いて来たの？ 売場に立っていると、外の一日を誰かに聞かせてほしくなるの。", quieter:"私にも、何も勧めなくていい時間があるといいなって思ってた。あなたとなら、黙って海を見るのも楽しそう。", afterReply:"明日、売場で会ったら、いつものように声をかけてね。次にどんな道を歩いたか、また聞きたい。"},
    guide: {title:"道を教える人の寄り道",opening:"案内するときは、分かれ道で振り返るんです。ちゃんとついて来られているかな、と。癖になってしまって。",detail:"休みの日まで振り返って、誰もいないのに気づいたこともあります。そのときだけ、どこへ行くか迷いました。",question:"道が分かれたら、何を頼りに選びますか？",choices:[{label:"気になる景色の方へ",reply:"いいですね。私も、案内図に印のない木陰に座るのが好きです。目的地にならなくても、好きな場所はありますね。"},{label:"一緒に歩く人に聞いてみる",reply:"私が聞かれる側ではなく、選んでいいんですか。……それなら、少し遠回りをお願いしたいです。"}],reunion:"今日は、あなたを見つけてから声をかけるまで、少し迷いました。案内が必要なわけではないと分かっていたので。",quieter:"でも、用がなくても挨拶していいんですね。道を覚えてもらうより、私を覚えていてもらえたのがうれしいです。",afterReply:"明日の巡回で見かけたら、手を振りますね。道を尋ねる用事がなくても。"},
    traveler: {title:"旅程にない立ち話",opening:"地図は持ってる。でも、歩き終わってから開くことの方が多いんだ。ここを通ったんだな、って。",detail:"景色のいい所ばかり覚えていると思ってたけど、道に迷って誰かと話した場所が、案外いちばん残る。",question:"予定のない時間ができたら、どうする？",choices:[{label:"もう少し歩いてみる",reply:"それなら、靴が疲れるまで。戻る道で同じ景色を見ても、きっと違うものが見つかるよ。"},{label:"その場所でゆっくりする",reply:"いいね。先へ行かないと見つからないものばかりじゃない。僕も、今日はこの景色をもう少し見ていたい。"}],reunion:"今日は別の道から来たんだ。それでも君に会えて、地図より先に、話の続きを思い出した。",quieter:"次の目的地を言わなくても一緒にいられるって、旅先では珍しいね。急いで出発しなくていい気がする。",afterReply:"明日は別の道でもいいよね。帰ってきたら、見つけたものを話そう。"},
    vendor: {title:"配達籠が空になる頃",opening:"朝いちばんの配達では、野菜より先に挨拶を届けるんです。扉が開くと、今日は元気だなって分かる。",detail:"籠が空になって戻る頃には、通りの誰が何を作るか、だいたい知っています。でも私の夕飯は、まだ決まっていないことも。",question:"いつもの通りで、目に留まるのはどんなもの？",choices:[{label:"店先に並ぶ色",reply:"今日は葉っぱの緑がきれいでしょう。きれいに並べると、私も朝から少し元気になります。"},{label:"そこで交わす挨拶",reply:"それなら、次に会うのも楽しみですね。買い物がなくても、挨拶だけ置いていってください。"}],reunion:"あなたが通ると、つい籠から顔を上げてしまうんです。今日はどこへ行くのかなって。",quieter:"今度は、配達先の話ばかりでなく、私の一日のことも聞いてもらえたら。空の籠を置いてから、ゆっくり。",afterReply:"明日はまた、この通りで。籠がいっぱいでも、あなたへの挨拶は忘れません。"},
    curator: {title:"解説の余白",opening:"展示室を最後に見回るとき、照明を消す前に一枚だけ眺めます。説明を考えずに、ただ見るために。",detail:"仕事では、見てほしい所を言葉にします。でも自分が好きな理由まで、きれいに説明できるとは限らないんです。",question:"気になる作品があったら、まず何を見ますか？",choices:[{label:"色や光を眺める",reply:"言葉を読む前に目が止まる場所ですね。その一瞬を、解説で邪魔したくないと思っています。"},{label:"自分の思い出と重ねる",reply:"作品の中に、来館した人だけが知る景色がある。私には見えないその景色を、少し聞いてみたいです。"}],reunion:"前にあなたと話してから、いつもの見回りで足が止まりました。同じ作品なのに、誰かの言葉が残っていて。",quieter:"私も、解説として整える前の言葉で話してみたいです。閉館後の静かな時間なら、できそうな気がします。",afterReply:"次に展示室で会ったら、あなたが目を留めた所を聞かせてください。正しい答えは用意しておきません。"},
    fishcook: {title:"火を落とす前の話",opening:"魚が焼ける音で、火の具合が分かるんだ。長くここに立っていると、耳まで厨房の一部になる。",detail:"だから仕事が終わったあとは、波の音を聞きたくなる。似ているようで、何もしなくていい音だから。",question:"食事のあと、もう少し残っていたくなるのは？",choices:[{label:"窓の外を眺めたいとき",reply:"港の灯りは、毎日少しずつ違う。空いた皿は片付けるけど、景色を急いで見終わることはないよ。"},{label:"まだ話の続きがあるとき",reply:"それなら、厨房から出て座らないとね。私も、次の注文を気にせず話してみたい。"}],reunion:"前に話してから、火を止めたあとの静けさが少し変わった。今度は、あなたの足音も待っている。",quieter:"食べてもらうのはうれしいけれど、今日は何を作るか考えなくていい時間も、あなたと過ごしたいな。",afterReply:"また来て。空腹じゃなくても、話したいことがあるだけでいいから。"},
    homecook: {title:"迎える人のひと休み",opening:"食卓を整えるとき、椅子も少し引いておくの。座る人が、もう迎えられていると感じられたらいいなって。",detail:"片付けが終わると、最後に自分の椅子を引きます。それまで自分が一度も座っていなかったって、気づく日もあるわ。",question:"旅先の食卓に、何があると落ち着く？",choices:[{label:"湯気の立つ温かいもの",reply:"待っている間も温かいのって、いいでしょう。食べる前から、肩の力が少し抜けるといいな。"},{label:"隣で話せる人",reply:"それなら、今日は私も座らせてもらおうかしら。迎える側のままでなく、一緒に。"}],reunion:"前に来てくれた日のこと、椅子を並べながら思い出していました。今度はどんな話をするのかなって。",quieter:"夜、鍋の火を落としたら、私の席も空けておきたいの。ゆっくり座って話すために。",afterReply:"次は、私の分の椅子も引いておこうかな。あなたと座る時間が楽しみだから。"},
    baker: {title:"明日の朝の手前で",opening:"焼き上がりの少し前が好きです。まだ扉を開けられないけれど、香りだけは先に通りへ出ていく。",detail:"朝が早いと、島の灯りが消えるところも見えます。みんなの一日を待っているようで、少し得した気になります。",question:"朝の町を歩くなら、何が楽しみ？",choices:[{label:"焼きたての香り",reply:"それなら、扉を開ける前から見つけてもらえますね。香りの行き先は選べないけれど、届くとうれしいです。"},{label:"店が開いていく景色",reply:"まだ静かな通りが、少しずつ今日の顔になるんです。私も、その最初のひとつでありたいな。"}],reunion:"また会えましたね。明日の仕込みをしながら、あなたは今どの辺りを歩いているんだろうって、考えていました。",quieter:"早起きのために夜を急いで終えることが多いけれど、今度は、もう少し長く話していたいです。",afterReply:"明日も早いけれど、今日の話は急いで終わらせたくなかったんです。また、朝の通りで。"}
  });
  function relationshipScene(stay,id,choice = null) {
    const episode = relationshipEpisode(stay,id);
    if (!episode) return null;
    const newcomer = NEW_CAST[id];
    const script = newcomer ? ["talk","later"].includes(episode.phase) ? newcomer.talks[Math.min(episode.count,newcomer.required-1)] : newcomer.intimate : PERSONAL_SCENES[id];
    const line = (speaker,text,extra={}) => ({speaker,text,...extra});
    let frames;
    if (episode.phase === "talk") {
      const reply = Number.isInteger(choice) ? script.choices[choice] : null;
      frames = [line(episode.name,episode.count ? script.reunion : script.opening),line(episode.name,episode.count ? script.quieter : script.detail),line(episode.name,script.question,{choices:script.choices.map(entry=>entry.label)})];
      if (reply) frames.push(line("あなた",reply.label),line(episode.name,reply.reply),line(episode.name,script.closing || (episode.count ? episode.reunion : episode.first),{action:"talk",label:"また会いに来る"}));
    } else if (episode.phase === "invite") {
      frames = [line(episode.name,script.quieter),line(episode.name,episode.invitation,{action:"accept",label:"一緒に過ごしたい",decline:"今日はここまでにする"})];
    } else if (episode.phase === "afterglow") {
      frames = [line("ふたりの時間",script.fade || "言葉を急がなくても、そばにいたい気持ちは伝わった。静かな時間が、ゆっくりと過ぎていく。",{blackout:true}),line(episode.name,script.afterReply),line("旅の記憶",episode.memory,{action:"continue",label:"この時間を旅の記憶に残す"})];
    } else if (episode.phase === "complete") {
      frames = [line("旅の記憶",episode.memory),line(episode.name,script.afterReply,{action:"close",label:"またね"})];
    } else {
      frames = [line(episode.name,episode.text,{action:"close",label:"またね"})];
    }
    return {episode,title:script.title,frames};
  }
  function relationshipAction(draft, id, type, expectedPhase) {
    const episode = relationshipEpisode(draft.stay,id);
    if (!episode?.here) return "相手と会っている場所で話しましょう。";
    if (episode.phase !== expectedPhase) return "会話が進みました。もう一度開き直してください。";
    const saved = draft.stay.relationships[id] || {moments:[],stage:"talk"};
    if (type === "talk" && episode.phase === "talk") saved.moments.push(episode.context);
    else if (type === "accept" && episode.phase === "invite") saved.stage="afterglow";
    else if (type === "continue" && episode.phase === "afterglow") saved.stage="complete";
    else return "今はその選択をできません。";
    draft.stay.relationships[id]=saved;
  }

  return Object.freeze({ SCENES, OBSERVATIONS, DETAILS, RESIDENTS, NEW_CAST, REST_PLACES, resumeView, route, MEALS, mealAction, CRUISE, cruiseAction, GOODS, purchase, place, presence, MEETING_PLANS, meetingPlan, meetingOffer, encounterText, encounterEpisode, finishEncounter, itemMemory, travelReflections, rememberStay, chapterOne, finishChapterOne, SCENIC_IDS, scenicMoment, finishScenic, MUSEUM_WORKS, museumMoment, finishMuseum, PURSUITS, pursuits, beginPursuit, finishPursuit, pursuitHint, outings, outingHint, trailHint, luanaTopics, shareLuanaStory, RELATIONSHIPS, relationshipEpisode, relationshipScene, relationshipAction, transition, dialogueContext });
});
