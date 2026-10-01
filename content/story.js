(function (root, factory) {
  "use strict";

  const api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  if (root) {
    root.MimiStory = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function deepFreeze(value, seen) {
    if (
      value === null ||
      (typeof value !== "object" && typeof value !== "function")
    ) {
      return value;
    }

    const visited = seen || new WeakSet();
    if (visited.has(value)) return value;
    visited.add(value);

    Reflect.ownKeys(value).forEach(function (key) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor) return;
      if (Object.prototype.hasOwnProperty.call(descriptor, "value")) {
        deepFreeze(descriptor.value, visited);
      }
      if (descriptor.get) deepFreeze(descriptor.get, visited);
      if (descriptor.set) deepFreeze(descriptor.set, visited);
    });

    return Object.freeze(value);
  }

  function scene(config) {
    return {
      id: config.id,
      chapter: config.chapter,
      order: config.order,
      title: config.title,
      start: config.start,
      incident: config.incident,
      action: config.action,
      result: config.result,
      nextQuestion: config.nextQuestion,
      speaker: config.speaker,
      shortLine: config.shortLine,
      nextObjective: config.nextObjective,
      firstRunOnly: config.firstRunOnly,
    };
  }

  const SCHEMA_VERSION = "1.0.0";
  const STORY_ID = "mimis-jackpot-resort-v5";
  const CHAPTER_IDS = ["treasure", "poker", "race", "wonderland", "raid"];
  const SCENE_KINDS = ["explore", "omen", "chain", "boss", "bonus"];
  const EFFECT_IDS = [
    "notice",
    "chance",
    "hot",
    "goldenGate",
    "boss",
    "revive",
    "bonus",
    "jackpot",
  ];

  const chapters = [
    {
      id: "treasure",
      order: 1,
      title: "ロイヤルポットの約束",
      question: "賞金は、取った人のものか、約束を引き受けた人のものか？",
      learning: "Promise",
      entrySceneId: "treasure.explore",
      bossSceneId: "treasure.boss",
      exitSceneId: "treasure.bonus",
    },
    {
      id: "poker",
      order: 2,
      title: "変身ポーカーデュエル",
      question: "観客が信じたい勝者と、結果が示す勝者は同じか？",
      learning: "Discernment",
      entrySceneId: "poker.explore",
      bossSceneId: "poker.boss",
      exitSceneId: "poker.bonus",
    },
    {
      id: "race",
      order: 3,
      title: "泣き虫ドラゴンレース",
      question: "勝つとは、怖がる相手を置いていくことか、一緒に完走することか？",
      learning: "Courage",
      entrySceneId: "race.explore",
      bossSceneId: "race.boss",
      exitSceneId: "race.bonus",
    },
    {
      id: "wonderland",
      order: 4,
      title: "すごろくワンダーランド",
      question: "後悔しないために全てを残すことは、本当に自由か？",
      learning: "Choice",
      entrySceneId: "wonderland.explore",
      bossSceneId: "wonderland.boss",
      exitSceneId: "wonderland.bonus",
    },
    {
      id: "raid",
      order: 5,
      title: "JACKPOT RAID",
      question: "未来を開くことと、未来を所有することを分けられるか？",
      learning: "Freedom",
      entrySceneId: "raid.explore",
      bossSceneId: "raid.boss",
      exitSceneId: "raid.bonus",
    },
  ];

  const scenes = [
    scene({
      id: "treasure.explore",
      chapter: "treasure",
      order: 1,
      title: "ジャックポット・カジノ",
      start: "ミミはバニースタッフとして、最初の卓へ向かう。",
      incident: "リコ先輩がBETコインを置き、勝負の基本を教える。",
      action: "SPINし、小役をそろえてリコ先輩のスタックを0にする。",
      result: "勝利したミミは、最初のBETコインを受け取る。",
      nextQuestion: "残る三人は、どんな勝負を仕掛けるのか？",
      speaker: "ミミ",
      shortLine: "リコ先輩、勝負です！",
      nextObjective: "リコ先輩のスタックを0にする",
      firstRunOnly: false,
    }),
    scene({
      id: "treasure.omen",
      chapter: "treasure",
      order: 2,
      title: "ポルカとセリナ",
      start: "ポルカが強気に賭け、セリナが静かにカードを配る。",
      incident: "相手が変わるたび、必要なスタックも大きくなる。",
      action: "SPINし、成立した小役でそれぞれのスタックを削る。",
      result: "二人に勝ち、BETコインは三枚になる。",
      nextQuestion: "最後のBETコインを持つグラーノに勝てるか？",
      speaker: "ミミ",
      shortLine: "次の卓も、負けません！",
      nextObjective: "ポルカとセリナに勝つ",
      firstRunOnly: false,
    }),
    scene({
      id: "treasure.chain",
      chapter: "treasure",
      order: 3,
      title: "最後のBETコイン",
      start: "グラーノが最後のBETコインを卓上へ置く。",
      incident: "四人で最も大きなスタックが、VIP卓への道をふさぐ。",
      action: "SPINし、小役を重ねてグラーノのスタックを0にする。",
      result: "四枚のBETコインがそろい、ロイヤル卓が開く。",
      nextQuestion: "最後のAを、ミミは呼び込めるか？",
      speaker: "ミミ",
      shortLine: "最後の一枚、いただきます！",
      nextObjective: "グラーノに勝つ",
      firstRunOnly: false,
    }),
    scene({
      id: "treasure.boss",
      chapter: "treasure",
      order: 4,
      title: "ロイヤル卓の女王 ヴェルベット",
      start: "ヴェルベットが四枚のBETコインを受け取り、五枚の札を並べる。",
      incident: "10・J・Q・Kが開き、最後のAだけが伏せられる。",
      action: "WINラインをCALLに変え、スタックを削りながら最後のAを呼ぶ。",
      result: "ロイヤルストレートフラッシュが完成し、ミミがポットを勝ち取る。",
      nextQuestion: "ロイヤルポットのうさぎ紋章は、次に何を開くのか？",
      speaker: "ミミ",
      shortLine: "Aまでそろえて、勝つ！",
      nextObjective: "WINで残りチップを削る",
      firstRunOnly: false,
    }),
    scene({
      id: "treasure.bonus",
      chapter: "treasure",
      order: 5,
      title: "ロイヤルポットの10ゲーム",
      start: "リコ、ポルカ、セリナ、グラーノが勝利の卓を囲む。",
      incident: "完成したロイヤルが、勝者ミミのパスへ刻まれる。",
      action: "BONUSの十ゲームで、ポットのランプを順に灯す。",
      result: "十個のランプが灯り、ロイヤルの紋章がパスへ刻まれる。",
      nextQuestion: "勝者がいないのに、なぜ劇場は勝利を宣伝しているのか？",
      speaker: "ミミ",
      shortLine: "10個、全部灯そう！",
      nextObjective: "10個のランプを灯す",
      firstRunOnly: true,
    }),

    scene({
      id: "poker.explore",
      chapter: "poker",
      order: 1,
      title: "DEAL 空欄のパス",
      start: "ミミは空欄のパスで月夜のカードシアターへ入る。",
      incident: "カードシャークが、先に名前を入れれば勝者になれると誘う。",
      action: "SPINし、斜めを含む成立ラインと伏せ札の縁をSTOPで読む。",
      result: "派手な勝利映像と実際の成立ラインが一致しないと分かる。",
      nextQuestion: "何を見れば、演出ではなく結果を信じられるのか？",
      speaker: "ミミ",
      shortLine: "勝利映像と成立ラインが違う。\n伏せ札の縁を読んで。",
      nextObjective: "成立ラインと伏せ札を照合する",
      firstRunOnly: false,
    }),
    scene({
      id: "poker.omen",
      chapter: "poker",
      order: 2,
      title: "READ 二つの証拠",
      start: "二枚の伏せ札が、異なる勝者名を示して点滅する。",
      incident: "一瞬だけ両方のカードの縁に、同じ月の傷が現れる。",
      action: "CHANCEの二つの鍵を確認し、封印が止まってからPUSHする。",
      result: "幻影の札と本物の記録札を分ける二つの証拠がそろう。",
      nextQuestion: "カードシャークは、なぜ空欄をそれほど恐れるのか？",
      speaker: "ミミ",
      shortLine: "二枚の縁に同じ月の傷が出た。\n封印後にPUSHして。",
      nextObjective: "二つの証拠を確認してPUSHする",
      firstRunOnly: false,
    }),
    scene({
      id: "poker.chain",
      chapter: "poker",
      order: 3,
      title: "SHOWDOWN",
      start: "観客の歓声が、偽の勝者を既成事実にし始める。",
      incident: "三度のブラフが、ベット、盤面、成立ラインの順番を乱す。",
      action: "三ゲームのTRIALで三つの事実を一つずつ照合する。",
      result: "ミミは人気の名前を選ばず、パスの空欄を守る。",
      nextQuestion: "名前を受け取らず、自分で結果を引き受けられるか？",
      speaker: "ミミ",
      shortLine: "歓声が偽の勝者を作っている。\n三つの事実を照合して。",
      nextObjective: "TRIALで三つの事実を照合する",
      firstRunOnly: false,
    }),
    scene({
      id: "poker.boss",
      chapter: "poker",
      order: 4,
      title: "月夜のカードシャーク",
      start: "カードシャークが、満席の劇場を守る巨大な幻影を出す。",
      incident: "偽の勝利がLCDを覆い、本物の成立ラインを隠す。",
      action: "斜めのWINラインを重ね、幻影だけを削って事実を確定する。",
      result: "演出と結果が分かれ、ベルベットが空欄のパスを返す。",
      nextQuestion: "カードの裏に描かれた航路は、どこへ向かうのか？",
      speaker: "ベルベット",
      shortLine: "幻影が本物のラインを隠した。\n斜めWINで幻影を削って。",
      nextObjective: "斜めWINで幻影を減らす",
      firstRunOnly: false,
    }),
    scene({
      id: "poker.bonus",
      chapter: "poker",
      order: 5,
      title: "チップレイン",
      start: "劇場の照明が戻り、全てのカードが裏返る。",
      incident: "カード裏の月光航路が一つにつながり、空へ投射される。",
      action: "BONUSの二十ゲームでチップの光を集め、航路を補修する。",
      result: "Discernmentの光が定着し、強い月光がドラゴンを驚かせる。",
      nextQuestion: "怖がるドラゴンを、障害物として追い越すだけでよいのか？",
      speaker: "ミミ",
      shortLine: "カード裏の航路が空へ伸びた。\nBONUSで欠けを埋めて。",
      nextObjective: "二十ゲームで月光航路を補修する",
      firstRunOnly: true,
    }),

    scene({
      id: "race.explore",
      chapter: "race",
      order: 1,
      title: "START 涙の雲",
      start: "月光航路が涙の雲で途切れ、ドラゴンが縮こまる。",
      incident: "開始ベルに驚いたドラゴンの風が、コースを逆流させる。",
      action: "SPINし、小さなWINを追い風へ変えて進路をSTOPで示す。",
      result: "ドラゴンは逃げずにミミの横へつくが、まだ飛べない。",
      nextQuestion: "怖さを消せなくても、スタートできる方法はあるか？",
      speaker: "ミミ",
      shortLine: "涙の風がコースを逆流させた。\n小さなWINを追い風にして。",
      nextObjective: "小さなWINで追い風を作る",
      firstRunOnly: false,
    }),
    scene({
      id: "race.omen",
      chapter: "race",
      order: 2,
      title: "BOOST 月光の近道",
      start: "カード裏の地図が、涙の嵐を抜ける近道を示す。",
      incident: "近道を独走すれば勝てるが、ドラゴンを置き去りにする。",
      action: "連続WINとCHANCEを読み、ドラゴンと同じ速度でSTOPする。",
      result: "二人の風が同期して嵐の中心へ進むが、涙は強くなる。",
      nextQuestion: "勝敗より先に、何を守るべきか？",
      speaker: "ミミ",
      shortLine: "近道はドラゴンを置き去りにする。\n同じ速度でSTOPして。",
      nextObjective: "ドラゴンと同じ速度で止める",
      firstRunOnly: false,
    }),
    scene({
      id: "race.chain",
      chapter: "race",
      order: 3,
      title: "SPRINT 並走",
      start: "最終直線に三つの乱気流と、単独突破のラインが現れる。",
      incident: "ドラゴンが止まり、ミミへ先に行くよう首を振る。",
      action: "三ゲームのTRIALで同時ラインを作り、並走を維持する。",
      result: "ミミは単独の一着を捨て、二人で渡れる航路を作る。",
      nextQuestion: "ドラゴンは、自分の力で最後の一歩を選べるか？",
      speaker: "ミミ",
      shortLine: "一人用のラインしか光っていない。\n三ゲームで並走路を作って。",
      nextObjective: "TRIALで並走ラインを作る",
      firstRunOnly: false,
    }),
    scene({
      id: "race.boss",
      chapter: "race",
      order: 4,
      title: "涙の嵐",
      start: "涙の嵐が巨大な影となり、ドラゴンの声まで隠す。",
      incident: "恐れが最大になり、風圧がリールの進路を遮る。",
      action: "WINラインで恐れを減らし、REVIVEでも呼びかけを続ける。",
      result: "ドラゴンは自分から翼を開き、ミミと同時にゴールする。",
      nextQuestion: "二人の虹の航跡は、なぜ地上の盤面へ流れ込むのか？",
      speaker: "ミミ",
      shortLine: "涙の嵐が声まで隠している。\nWINラインで恐れを減らして。",
      nextObjective: "WINラインで恐れを減らす",
      firstRunOnly: false,
    }),
    scene({
      id: "race.bonus",
      chapter: "race",
      order: 5,
      title: "ウイニングラン",
      start: "一人分の勝者台を離れ、ミミとドラゴンが並走する。",
      incident: "虹の航跡が地上の分岐盤へ注ぎ、全ルートを点灯する。",
      action: "BONUSの二十ゲームで観客の光を航跡へ返す。",
      result: "Courageの光が定着し、分岐盤は可能性が多すぎて止まる。",
      nextQuestion: "全てが正解なら、どうやって一つを選ぶのか？",
      speaker: "ミミ",
      shortLine: "虹の航跡が全ルートを点灯した。\nBONUSで光を届けて。",
      nextObjective: "二十ゲームで虹の航跡を完成する",
      firstRunOnly: true,
    }),

    scene({
      id: "wonderland.explore",
      chapter: "wonderland",
      order: 1,
      title: "DICE 全点灯",
      start: "分岐盤の全マスが点灯し、どの道もおすすめを示す。",
      incident: "STOPするたび、ルーレットマンドラが盤面を入れ替える。",
      action: "SPINし、現在成立した一つのルートをSTOPで進む。",
      result: "前進できるが、ミミは選ばなかった道を何度も振り返る。",
      nextQuestion: "間違いを避け続けることと、選ぶことは同じか？",
      speaker: "ミミ",
      shortLine: "全ルートが同時に光っている。\n成立した一つをSTOPして。",
      nextObjective: "成立した一つのルートを進む",
      firstRunOnly: false,
    }),
    scene({
      id: "wonderland.omen",
      chapter: "wonderland",
      order: 2,
      title: "EVENT 永遠の振り直し",
      start: "複数の幸運マスが、魅力的な未来を同時に映す。",
      incident: "マンドラが、永遠に振り直せば失敗しないと勧める。",
      action: "NOTICEとCHANCEを読み、成立した結果だけをPUSHで受け取る。",
      result: "再挑戦は選択を消さず、選んだ後に戻れる力だと分かる。",
      nextQuestion: "いつ再挑戦し、いつ結果を確定するのか？",
      speaker: "ミミ",
      shortLine: "振り直しても選択は消えない。\n成立結果をPUSHで受け取って。",
      nextObjective: "成立した結果をPUSHで受け取る",
      firstRunOnly: false,
    }),
    scene({
      id: "wonderland.chain",
      chapter: "wonderland",
      order: 3,
      title: "BRANCH 一つの橋",
      start: "王冠へ続く三分岐が、互いを上書きして揺れる。",
      incident: "全てを保持しようとすると、どの橋も完成しない。",
      action: "三ゲームのTRIALで、一手ごとに一ルートを確定する。",
      result: "一本の橋が固まり、残る道は次回の灯として保存される。",
      nextQuestion: "選ばれなかった可能性を、失敗と呼ばずに進めるか？",
      speaker: "ミミ",
      shortLine: "全てを残すと橋が完成しない。\n三ゲームで一つを選んで。",
      nextObjective: "TRIALで一本の橋を完成する",
      firstRunOnly: false,
    }),
    scene({
      id: "wonderland.boss",
      chapter: "wonderland",
      order: 4,
      title: "分岐盤の番人",
      start: "マンドラが巨大な回転盤となり、王冠の前で回り続ける。",
      incident: "期待が上がるほど、ミミは決定を先延ばしにしたくなる。",
      action: "テンパイで回転を遅め、確定PUSHとWINで迷いを減らす。",
      result: "ミミは失う道を認めて一つを選び、マンドラは王冠を渡す。",
      nextQuestion: "王冠が送った信号を、未来ゲートの誰が受け取るのか？",
      speaker: "ミミ",
      shortLine: "番人が全ルートを回し続けている。\nWINとPUSHで迷いを減らして。",
      nextObjective: "WINとPUSHで迷いを減らす",
      firstRunOnly: false,
    }),
    scene({
      id: "wonderland.bonus",
      chapter: "wonderland",
      order: 5,
      title: "王冠パレード",
      start: "選ばれた橋を客が渡り、王冠が虹の航跡と接続する。",
      incident: "七色の信号が雲上へ届き、未来ゲートを早く起動する。",
      action: "BONUSの二十ゲームでパレードの光を信号へ集める。",
      result: "Choiceの光が定着し、巨大な影が未来ゲートを閉じる。",
      nextQuestion: "門の裁定者は、未来のミミを何から守っているのか？",
      speaker: "ミミ",
      shortLine: "王冠の信号が未来ゲートへ届いた。\nBONUSで光を集めて。",
      nextObjective: "二十ゲームで王冠信号を完成する",
      firstRunOnly: true,
    }),

    scene({
      id: "raid.explore",
      chapter: "raid",
      order: 1,
      title: "ORB 六つのソケット",
      start: "未来ゲートの六ソケットを、四章の光とReturnが巡る。",
      incident: "門が全ての光を勝者の所有物と誤認し、受け付けない。",
      action: "SPINとSTOPで六色を円環へ置き、出来事へ結び直す。",
      result: "光が関係の記録として認証され、Freedomだけが空欄に残る。",
      nextQuestion: "誰かを所有せずに、最後の光を受け取れるか？",
      speaker: "ミミ",
      shortLine: "門が光を所有物だと誤認した。\n六色を円環へSTOPして。",
      nextObjective: "六色の光を円環へ置く",
      firstRunOnly: false,
    }),
    scene({
      id: "raid.omen",
      chapter: "raid",
      order: 2,
      title: "FRAGMENT 未来の断片",
      start: "門に、未来のミミが一人で部屋を閉じる映像が流れる。",
      incident: "逃げた未来と、守るため閉じた未来の編集が重なる。",
      action: "NOTICEとCHANCEで時系列を読み、確かな断片だけPUSHする。",
      result: "未来のミミが、答えではなく空欄を残したと分かる。",
      nextQuestion: "空欄を埋めずに門を開くには、何を約束すればよいか？",
      speaker: "ミミ",
      shortLine: "二つの未来映像が重なっている。\n確かな断片だけPUSHして。",
      nextObjective: "確かな未来の断片を確認する",
      firstRunOnly: false,
    }),
    scene({
      id: "raid.chain",
      chapter: "raid",
      order: 3,
      title: "GATE 三段解錠",
      start: "三つの錠が、過去、未来、参加者の権利を封じる。",
      incident: "永久契約なら開くが、全員が帰る自由を失ってしまう。",
      action: "GOLDEN GATEの三段解錠を見届け、成立結果を確定する。",
      result: "過去を受け取り、未来を固定せず、退出の自由を残す。",
      nextQuestion: "短い今日の選択は、長い未来に耐えられるか？",
      speaker: "ミミ",
      shortLine: "永久契約では帰る自由が消える。\n三つの錠を順に外して。",
      nextObjective: "三段解錠を順に確定する",
      firstRunOnly: false,
    }),
    scene({
      id: "raid.boss",
      chapter: "raid",
      order: 4,
      title: "雲上の裁定者",
      start: "シャハルが、永遠を約束しない招待の価値を試す。",
      incident: "裁定圧が上がり、ミミへ所有者の肩書きを迫る。",
      action: "WINで裁定圧を減らし、REVIVEでも帰る自由を伝える。",
      result: "シャハルは敗北でなく、自分の意志で今日の祭りへ参加する。",
      nextQuestion: "誰のものでもない六色を、どんな明日へ使うのか？",
      speaker: "ミミ",
      shortLine: "シャハルの裁定圧が高まった。\nWINで招待の意味を届けて。",
      nextObjective: "WINラインで裁定圧を減らす",
      firstRunOnly: false,
    }),
    scene({
      id: "raid.bonus",
      chapter: "raid",
      order: 5,
      title: "未来ゲート開放",
      start: "六色がそろい、未来のミミのプロデューサー室が開く。",
      incident: "部屋には正解表がなく、開業ボタンと二人分の署名欄がある。",
      action: "BONUSの二十ゲームで五章の灯をリゾートへ戻す。",
      result: "ミミとパートナーが開業を確定し、FIRST LIGHTが再生する。",
      nextQuestion: "次のアトラクションの空欄へ、二人は何を書くのか？",
      speaker: "未来のミミ",
      shortLine: "正解表ではなく二人分の欄がある。\nBONUSで開業の灯を戻して。",
      nextObjective: "二十ゲームでFIRST LIGHTを戻す",
      firstRunOnly: true,
    }),
  ];

  const SCENE_IDS = scenes.map(function (item) {
    return item.id;
  });

  const nextLinks = {
    "treasure.explore": "treasure.omen",
    "treasure.omen": "treasure.chain",
    "treasure.chain": "treasure.boss",
    "treasure.boss": "treasure.bonus",
    "treasure.bonus": "poker.explore",
    "poker.explore": "poker.omen",
    "poker.omen": "poker.chain",
    "poker.chain": "poker.boss",
    "poker.boss": "poker.bonus",
    "poker.bonus": "race.explore",
    "race.explore": "race.omen",
    "race.omen": "race.chain",
    "race.chain": "race.boss",
    "race.boss": "race.bonus",
    "race.bonus": "wonderland.explore",
    "wonderland.explore": "wonderland.omen",
    "wonderland.omen": "wonderland.chain",
    "wonderland.chain": "wonderland.boss",
    "wonderland.boss": "wonderland.bonus",
    "wonderland.bonus": "raid.explore",
    "raid.explore": "raid.omen",
    "raid.omen": "raid.chain",
    "raid.chain": "raid.boss",
    "raid.boss": "raid.bonus",
    "raid.bonus": "ending.normal",
  };

  const chapterCausalLinks = [
    {
      id: "treasure-to-poker",
      from: "treasure.bonus",
      to: "poker.explore",
      cause: "ロイヤルポットのうさぎ紋章が月夜の劇場を開き、勝者名が空欄のパスを出す。",
      consequence: "誰の勝利かを見極めるポーカーの問いが始まる。",
    },
    {
      id: "poker-to-race",
      from: "poker.bonus",
      to: "race.explore",
      cause: "カード裏の本物の月光航路が空へ投射される。",
      consequence: "強い月光がドラゴンを驚かせ、涙の嵐を起こす。",
    },
    {
      id: "race-to-wonderland",
      from: "race.bonus",
      to: "wonderland.explore",
      cause: "並走で生まれた虹の航跡が地上へ流れ込む。",
      consequence: "分岐盤の全ルートが同時に点灯し、選べなくなる。",
    },
    {
      id: "wonderland-to-raid",
      from: "wonderland.bonus",
      to: "raid.explore",
      cause: "選んだ橋の王冠信号が七色の未来ゲートへ届く。",
      consequence: "ゲートが起動し、裁定者シャハルが目覚める。",
    },
  ];

  const bosses = {
    treasure: {
      chapter: "treasure",
      sceneId: "treasure.boss",
      name: "ヴェルベット",
      title: "ロイヤル卓の女王",
      resistanceLabel: "スタック",
      motive: "名のない賞金を渡す前に、受取人の約束まで背負える勝者か見極めたい。",
      resolution: "ミミが最後のAを呼び、ロイヤルを完成させたため、勝者としてポットを渡す。",
    },
    poker: {
      chapter: "poker",
      sceneId: "poker.boss",
      name: "カードシャーク",
      title: "月夜の勝負師",
      resistanceLabel: "幻影",
      motive: "観客が望む勝者を作り、劇場を満席に保ちたい。",
      resolution: "演出と成立結果を分け、正しい結果を盛り上げる側へ移る。",
    },
    race: {
      chapter: "race",
      sceneId: "race.boss",
      name: "泣き虫ドラゴン",
      title: "虹風のライバル",
      resistanceLabel: "恐れ",
      motive: "皆と走りたいが、自分の力でコースを壊すことを恐れる。",
      resolution: "怖さを残したまま自分で翼を開き、ミミと並走する。",
    },
    wonderland: {
      chapter: "wonderland",
      sceneId: "wonderland.boss",
      name: "ルーレットマンドラ",
      title: "分岐盤の番人",
      resistanceLabel: "迷い",
      motive: "誰も後悔しないよう、全ルートを永遠に開けておきたい。",
      resolution: "選ばれない道も次回へ残せると知り、王冠を渡す。",
    },
    raid: {
      chapter: "raid",
      sceneId: "raid.boss",
      name: "古竜シャハル",
      title: "雲上の裁定者",
      resistanceLabel: "裁定圧",
      motive: "短い選択が所有や予言にならず、持続できるか確かめたい。",
      resolution: "永続契約でなく、今日の祭りへ自分の意志で参加する。",
    },
  };

  const endings = {
    normal: {
      id: "ending.normal",
      kind: "main",
      trigger: "raid.bonus",
      requiresJackpot: false,
      optional: false,
      gatesMainEnding: false,
      speaker: "未来のミミ",
      headline: "FIRST LIGHT",
      line: "正しい未来ではなく、外れた後にも続きを選べる場所を残したよ。",
      result: "ミミとパートナーが共同プロデューサーとしてリゾートを開業する。",
      continuation: "空欄のNEXT ATTRACTIONが、次の共同制作を待つ。",
    },
    jackpotEpilogue: {
      id: "ending.jackpot-epilogue",
      kind: "optional-epilogue",
      trigger: "confirmed-jackpot",
      requiresJackpot: true,
      optional: true,
      gatesMainEnding: false,
      availableBeforeMainEnding: true,
      speaker: "未来のミミ",
      headline: "NEXT ATTRACTION",
      line: "これは正解表ではなく、次を一緒に書くための空欄だよ。",
      result: "五章とReturnの光が同期し、配当と共同制作権が渡される。",
      continuation: "別の未来や追加章を受け入れる余白が残る。",
    },
  };

  const presentationEffects = {
    notice: {
      id: "notice",
      storyMeaning: "背景の変化を、読むべき手掛かりへ変える。",
      copyPolicy: "当たりを保証せず、起きた変化と次の注視先を一〜二行で示す。",
    },
    chance: {
      id: "chance",
      storyMeaning: "二つの手掛かりから、確定操作へ進む。",
      copyPolicy: "予兆、鍵一、鍵二、封印、PUSHの因果を守り、未確定当たりを断言しない。",
    },
    hot: {
      id: "hot",
      storyMeaning: "期待が赤、金、虹へ上がる緊張を示す。",
      copyPolicy: "色だけに頼らず段階名と次の確認を示し、確定前は当たりと言わない。",
    },
    goldenGate: {
      id: "goldenGate",
      storyMeaning: "三つの理解が、一つの進路へ変わる。",
      copyPolicy: "錠一から三と開門を順に述べ、開いた後の移動先を示す。",
    },
    boss: {
      id: "boss",
      storyMeaning: "相手の動機と、対話を阻む抵抗を可視化する。",
      copyPolicy: "相手名、抵抗ラベル、初期値、WINで行う操作を順に示す。",
    },
    revive: {
      id: "revive",
      storyMeaning: "外れを消さず、同じ関係へ戻れる状態に変える。",
      copyPolicy: "外れを一度伝え、確定した救済内容と次の操作を明示する。",
    },
    bonus: {
      id: "bonus",
      storyMeaning: "解決を二十ゲームの祝祭と再点灯へ接続する。",
      copyPolicy: "遷移確定後にゲーム数、起きた解決、最初のSPINを示す。",
    },
    jackpot: {
      id: "jackpot",
      storyMeaning: "五章とReturnを同期し、次の物語を書く権利を渡す。",
      copyPolicy: "配当確定後だけ表示し、本編必須の真相を独占させない。",
    },
  };

  const assetPolicy = {
    generatedImageTextAllowed: false,
    imageTextRule: "文字、数字、ロゴ、UIは生成画像へ焼き込まない。",
    codeNativeFields: [
      "speaker",
      "headline",
      "message",
      "objective",
      "labels",
      "numbers",
      "buttons",
      "toggles",
      "ariaText",
    ],
    safeArea: {
      sourceWidth: 1920,
      sourceHeight: 720,
      topHudStartPercent: 0,
      topHudHeightPercent: 14,
      actionLeftPercent: 24,
      actionRightPercent: 76,
      actionTopPercent: 12,
      actionBottomPercent: 70,
      narrativeStartPercent: 74,
      narrativeHeightPercent: 26,
      horizontalCropPercent: 10,
      characterRightStartPercent: 62,
      characterRightEndPercent: 94,
      transparentPaddingPercent: 4,
    },
    forbiddenInNarrativeBand: [
      "face",
      "mouth",
      "hand",
      "key-evidence",
      "card-evidence",
      "boss-weakness",
    ],
  };

  const sceneById = Object.fromEntries(
    scenes.map(function (item) {
      return [item.id, item];
    }),
  );
  const chapterById = Object.fromEntries(
    chapters.map(function (item) {
      return [item.id, item];
    }),
  );

  function getScene(id) {
    return Object.prototype.hasOwnProperty.call(sceneById, id)
      ? sceneById[id]
      : null;
  }

  function getChapter(id) {
    return Object.prototype.hasOwnProperty.call(chapterById, id)
      ? chapterById[id]
      : null;
  }

  function getBoss(chapterId) {
    return Object.prototype.hasOwnProperty.call(bosses, chapterId)
      ? bosses[chapterId]
      : null;
  }

  function getPresentationEffect(id) {
    return Object.prototype.hasOwnProperty.call(presentationEffects, id)
      ? presentationEffects[id]
      : null;
  }

  function nextFor(sceneId) {
    return Object.prototype.hasOwnProperty.call(nextLinks, sceneId)
      ? nextLinks[sceneId]
      : null;
  }

  return deepFreeze({
    SCHEMA_VERSION: SCHEMA_VERSION,
    STORY_ID: STORY_ID,
    CHAPTER_IDS: CHAPTER_IDS,
    SCENE_KINDS: SCENE_KINDS,
    SCENE_IDS: SCENE_IDS,
    EFFECT_IDS: EFFECT_IDS,
    chapters: chapters,
    scenes: scenes,
    sceneById: sceneById,
    chapterById: chapterById,
    nextLinks: nextLinks,
    chapterCausalLinks: chapterCausalLinks,
    bosses: bosses,
    endings: endings,
    presentationEffects: presentationEffects,
    assetPolicy: assetPolicy,
    getScene: getScene,
    getChapter: getChapter,
    getBoss: getBoss,
    getPresentationEffect: getPresentationEffect,
    nextFor: nextFor,
  });
});
