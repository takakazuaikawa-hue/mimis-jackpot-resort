/*
 * content/stages.js — 5 つの冒険テーマ
 *
 * 上部液晶で自動進行する冒険の中身。プレイヤーは選ばない。
 * リールの結果に応じてここのテキストと絵が呼び出される。
 * 設計の根拠は ADVENTURE_SCREEN_DESIGN.md「3. 5つの冒険演出」。
 *
 * **ステージを足す・文言を直すのはこのファイルだけ。**
 * 画像はパスではなく content/assets.js の ID で書く。
 *
 * 1 テーマの構成:
 *   基本情報   id / number / title / stageName / series / color
 *   ゲージ     gaugeLabel / gaugeMax / nodes（上部液晶の進捗ノード 5 個）
 *   文言       story / intro / chance / win / miss
 *   ボス       boss.name / title / hint / weakness
 *   場面       scenes.explore / omen / chain / boss / bonus
 *
 * scenes の image は content/assets.js のruntime WebP ID。
 * plannedAsset は生成台帳と対応する安定した相対名として残す。
 * 25 枚（5 テーマ × 5 場面）は生成・最適化・配線済み。
 */
(function (root) {
  "use strict";

  /** 上部液晶に出るイベントアイコンの見た目。 */
  const eventVisuals = {
    pot: { icon: "★", tone: "treasure" },
    enemy: { icon: "!", tone: "battle" },
    chest: { icon: "宝", tone: "treasure" },
    merge: { icon: "♥", tone: "chance" },
    training: { icon: "UP", tone: "charge" },
    boss: { icon: "BOSS", tone: "boss" },
    freeze: { icon: "MAX", tone: "premium" }
  };

  const stages = [
    {
      id: "treasure", number: 1, title: "ロイヤルポットの約束", stageName: "ジャックポット・カジノ", series: "JACKPOT RESORT",
      cover: "stage.casinoVip", image: "stage.casinoVip", color: "#ffd36a",
      gaugeLabel: "BET COIN", gaugeMax: 4, nodes: ["RICO", "POLKA", "SELINA", "GRANO", "VELVET"],
      story: "四人の卓でBETコインを集め、ヴェルベットとのロイヤル勝負へ進む。",
      intro: "最初の相手はリコ先輩。小役をそろえてスタックを削ろう。",
      chance: "強い小役ほど、相手のスタックを大きく削る。",
      win: "スタックを削った！",
      miss: "勝負はまだ続く。",
      boss: { name: "ヴェルベット", title: "ロイヤル卓の女王", hint: "四枚のBETコインでVIP卓が開く。", weakness: "WINでスタックを削り、最後のAをそろえる。" },
      scenes: {
        explore: { label: "TABLE MATCH", title: "BETコインを集めよう", objective: "相手のスタックを0にする", image: "scene.treasure.explore", plannedAsset: "casino-loop-v5/zone-01-arrival.png" },
        omen: { label: "CHANCE", title: "強い小役！", objective: "スタックを大きく削る", image: "scene.treasure.omen", plannedAsset: "casino-loop-v5/zone-02-main-floor.png" },
        chain: { label: "BET COIN", title: "次の卓へ", objective: "四人に勝つ", image: "scene.treasure.chain", plannedAsset: "casino-loop-v5/zone-03-vip-salon.png" },
        boss: { label: "ROYAL TABLE", title: "ヴェルベット", objective: "最後のAをそろえる", image: "scene.treasure.boss", plannedAsset: "casino-loop-v5/zone-03-vip-salon.png" },
        bonus: { label: "RESORT BONUS", title: "ロイヤルポットの10ゲーム", objective: "10個のランプを灯す", image: "scene.treasure.bonus", plannedAsset: "casino-loop-v5/zone-04-jewel-exchange.png" }
      }
    },
    {
      id: "poker", number: 2, title: "変身ポーカーデュエル", stageName: "月夜のカードシアター", series: "POKER BATTLE",
      cover: "concept.poker", image: "stage.harbor", color: "#c78aff",
      gaugeLabel: "BLUFF READ", gaugeMax: 3, nodes: ["DEAL", "READ", "BET", "SHOW", "BOSS"],
      story: "3回のBLUFF READで相手の手を読み、月夜のショーダウンに勝利しよう。",
      intro: "月夜のカードシアターが開幕。ラインの気配から相手のブラフを読む。",
      chance: "伏せ札の縁が光った。斜めラインが読み合いを制する。",
      win: "読みが的中。観客席のチップが一斉に舞い上がる。",
      miss: "一手だけ読み違えた。《ぱにゅぱにゅ》が再勝負を引き寄せる。",
      boss: { name: "カードシャーク", title: "月夜の勝負師", hint: "伏せ札と幻影を操るポーカーディーラー。", weakness: "斜めライン成立で追加ダメージのチャンス。" },
      scenes: {
        explore: { label: "ACT 1 / DEAL", title: "月夜のカードシアター", objective: "伏せ札の気配を読み取れ", image: "scene.poker.explore", plannedAsset: "02_poker/scene_explore.webp" },
        omen: { label: "ACT 2 / READ", title: "揺れるブラフサイン", objective: "斜めラインで嘘を見抜け", image: "scene.poker.omen", plannedAsset: "02_poker/scene_omen.webp" },
        chain: { label: "ACT 3 / SHOWDOWN", title: "3Gポーカーデュエル", objective: "読みを2回的中させろ", image: "scene.poker.chain", plannedAsset: "02_poker/scene_chain.webp" },
        boss: { label: "FINAL / BOSS", title: "月夜の勝負師 カードシャーク", objective: "幻影の札を撃ち抜け", image: "scene.poker.boss", plannedAsset: "02_poker/scene_boss.webp" },
        bonus: { label: "RESORT BONUS", title: "チップレインショー", objective: "10Gの勝負を取り切れ", image: "scene.poker.bonus", plannedAsset: "02_poker/scene_bonus.webp" }
      }
    },
    {
      id: "race", number: 3, title: "泣き虫ドラゴンレース", stageName: "虹風のスカイコース", series: "MONSTER RACE",
      cover: "concept.race", image: "stage.jungle", color: "#63e3ff",
      gaugeLabel: "COURSE", gaugeMax: 3, nodes: ["START", "加速", "虹風", "GOAL", "BOSS"],
      story: "3区間のCOURSEを泣き虫ドラゴンと並走し、二人で虹のゴールを目指そう。",
      intro: "虹風のスカイコースへ出走。WINを翼に変えてドラゴンと並走しよう。",
      chance: "追い風が強くなる。連続ラインで二人の並走路を広げよう。",
      win: "泣き虫ドラゴンが勇気を取り戻し、ミミと雲を突き抜ける。",
      miss: "少し高度を落としたが、まだ風は途切れていない。",
      boss: { name: "泣き虫ドラゴン", title: "虹風のライバル", hint: "涙で前が見えなくなった高速ドラゴン。", weakness: "連続WINと高配当シンボルで勇気を取り戻す。" },
      scenes: {
        explore: { label: "ACT 1 / START", title: "虹風のスカイコース", objective: "小役でドラゴンと並走せよ", image: "scene.race.explore", plannedAsset: "03_race/scene_explore.webp" },
        omen: { label: "ACT 2 / BOOST", title: "雲海の追い風", objective: "連続WINで同じ速度を保て", image: "scene.race.omen", plannedAsset: "03_race/scene_omen.webp" },
        chain: { label: "ACT 3 / SPRINT", title: "虹のゴール前決戦", objective: "3Gで二人の航路を完成させろ", image: "scene.race.chain", plannedAsset: "03_race/scene_chain.webp" },
        boss: { label: "FINAL / RIVAL", title: "泣き虫ドラゴン", objective: "涙の暴走を止めて共にゴールせよ", image: "scene.race.boss", plannedAsset: "03_race/scene_boss.webp" },
        bonus: { label: "RESORT BONUS", title: "虹風ウイニングラン", objective: "10Gの祝福を並んで駆けろ", image: "scene.race.bonus", plannedAsset: "03_race/scene_bonus.webp" }
      }
    },
    {
      id: "wonderland", number: 4, title: "すごろくワンダーランド", stageName: "ワンダーランド分岐盤", series: "BOARD ADVENTURE",
      cover: "concept.board", image: "stage.gateway", color: "#72f0a4",
      gaugeLabel: "BRANCH", gaugeMax: 3, nodes: ["DICE", "分岐", "EVENT", "王冠", "BOSS"],
      story: "3つのBRANCHから一つを選び、残る道を次回へ残して王冠信号を届けよう。",
      intro: "ワンダーランド分岐盤が回り出す。停止図柄が次のルートを決める。",
      chance: "分岐マスが二つ同時に光る。選んだ道を確定するCHANCE。",
      win: "一つのルートを選択。残る道は次回の灯として盤面に残る。",
      miss: "遠回りも選んだ結果。《ぱにゅぱにゅ》で次の一手へ戻れる。",
      boss: { name: "ルーレットマンドラ", title: "分岐盤の番人", hint: "予測不能な回転で進路を入れ替える。", weakness: "テンパイCHANCEが出るほど回転が鈍る。" },
      scenes: {
        explore: { label: "ACT 1 / DICE", title: "ワンダーランド分岐盤", objective: "停止図柄で進むルートを決めろ", image: "scene.wonderland.explore", plannedAsset: "04_wonderland/scene_explore.webp" },
        omen: { label: "ACT 2 / EVENT", title: "幸運マス同時点灯", objective: "光る一つのルートを確定せよ", image: "scene.wonderland.omen", plannedAsset: "04_wonderland/scene_omen.webp" },
        chain: { label: "ACT 3 / BRANCH", title: "王冠への3択ルート", objective: "3Gで一本の橋を完成させろ", image: "scene.wonderland.chain", plannedAsset: "04_wonderland/scene_chain.webp" },
        boss: { label: "FINAL / BOSS", title: "分岐盤の番人 ルーレットマンドラ", objective: "回転を止めて王冠信号を受け取れ", image: "scene.wonderland.boss", plannedAsset: "04_wonderland/scene_boss.webp" },
        bonus: { label: "RESORT BONUS", title: "王冠パレード", objective: "10Gで王冠信号を未来へ届けろ", image: "scene.wonderland.bonus", plannedAsset: "04_wonderland/scene_bonus.webp" }
      }
    },
    {
      id: "raid", number: 5, title: "JACKPOT RAID", stageName: "七色の未来ゲート", series: "FINAL RAID",
      cover: "stage.coastal", image: "stage.coastal", color: "#ff5fb7",
      gaugeLabel: "RAINBOW ORB", gaugeMax: 6, nodes: ["ORB", "聖剣", "復活", "GATE", "BOSS"],
      story: "6色のRAINBOW ORBを重ね、未来ゲートを開いてFIRST LIGHTを取り戻そう。JACKPOTは本編を妨げない任意の追加エピローグ。",
      intro: "七色の未来ゲートに到着。6つのORBが揃えば最終扉が開く。",
      chance: "未来の断片が一瞬だけ映る。ここから期待度が大きく上がる。",
      win: "七色の光が重なり、未来ゲートの錠が一つ外れる。",
      miss: "ゲートは閉じたまま。でも鍵穴には復活の光が残った。",
      boss: { name: "古竜シャハル", title: "雲上の裁定者", hint: "未来ゲートの空を巨体で覆う、Secret Boss Arenaからの最終レイド・カメオ。", weakness: "BONUS・Max Orb・高配当ラインが有効。希少配当は任意の追加祝祭。", image: "char.boss.shahar" },
      scenes: {
        explore: { label: "ACT 1 / ORB", title: "七色の未来ゲート", objective: "6色のRAINBOW ORBを集めろ", image: "scene.raid.explore", plannedAsset: "05_raid/scene_explore.webp" },
        omen: { label: "ACT 2 / FRAGMENT", title: "未来の断片", objective: "後の物語へつながる光を追え", image: "scene.raid.omen", plannedAsset: "05_raid/scene_omen.webp" },
        chain: { label: "ACT 3 / GATE", title: "未来ゲート解錠", objective: "3Gで最後の錠を外せ", image: "scene.raid.chain", plannedAsset: "05_raid/scene_chain.webp" },
        boss: { label: "FINAL RAID", title: "雲上の裁定者 古竜シャハル", objective: "全ORBを重ねてシャハルの裁定に応えよ", image: "scene.raid.boss", plannedAsset: "05_raid/scene_boss.webp" },
        bonus: { label: "FIRST LIGHT", title: "未来ゲート開放", objective: "10Gで開業の灯をリゾートへ戻せ", image: "scene.raid.bonus", plannedAsset: "05_raid/scene_bonus.webp" }
      }
    }
  ];

  /** 上部液晶の下敷き。 */
  const lcdBackground = "lcd.walkway";

  root.MimiContent = root.MimiContent || {};
  root.MimiContent.stages = stages;
  root.MimiContent.eventVisuals = eventVisuals;
  root.MimiContent.lcdBackground = lcdBackground;
}(typeof globalThis !== "undefined" ? globalThis : this));
