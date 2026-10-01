/*
 * content/shop.js — ショップの商品カタログ
 *
 * **コスチューム／エフェクト／背景を足すのはこのファイルだけ。**
 * game.js を触る必要はない。ここに 1 行足せば店頭に並ぶ。
 *
 * キーアートが約束している 4 本柱のひとつが「コスチューム収集」。
 * 衣装は assets/imageboard/ の指定書を基準に、12着を個別透過PNGで接続済み。
 * 追加手順は docs/CONTENT.md「コスチュームを足す」。
 *
 * 1 商品の書き方:
 *   id            一意。localStorage の所持記録に使うので後から変えない
 *   tab           costume / effect / background
 *   name          店頭表示名
 *   price         COINS。0 なら最初から所持
 *   icon          店頭のサムネ（content/assets.js の ID）
 *   note          説明文 1 行
 *   costume なら  portrait  装備時にミミの絵として使う ID
 *   effect  なら  effect    game.js が見る効果キー（sparkle / premium / panyu）
 *   background なら stage   装備時に上部液晶の背景に使う ID
 */
(function (root) {
  "use strict";

  const items = [
    // --- コスチューム（装備するとミミの絵が変わる） ---
    {
      id: "rookie", tab: "costume", name: "リゾート・ホワイト", price: 0,
      icon: "char.mimi", portrait: "char.mimi",
      note: "明るいリゾート演出に合うミミの基本衣装。"
    },
    {
      id: "chanceRoyal", tab: "costume", name: "カジノ・ブラック", price: 3200,
      icon: "char.mimi.casino", portrait: "char.mimi.casino",
      note: "CHANCEとボス戦を引き締める黒と赤のカジノ衣装。"
    },
    {
      id: "mimiDealer", tab: "costume", name: "ミミ・ロイヤルディーラー", price: 4200,
      icon: "char.mimi.dealer", portrait: "char.mimi.dealer",
      note: "ポーカー対決のディールとBONUS祝祭を、ミミ自身の白い正装へ翻訳。"
    },
    {
      id: "futureResort", tab: "costume", name: "未来リゾート・ホワイト", price: 6000,
      icon: "char.futureMimi", portrait: "char.futureMimi",
      note: "JACKPOTの先でだけ見える、未来のプロデューサー衣装。"
    },
    {
      id: "treasureExplorer", tab: "costume", name: "ゲートキー探検家", price: 2600,
      icon: "char.mimi.treasure", portrait: "char.mimi.treasure",
      note: "第1章の宝箱と3本のGATE KEYを追う白い探検衣装。"
    },
    {
      id: "moonlightCroupier", tab: "costume", name: "月夜のクルーピエ", price: 3600,
      icon: "char.mimi.croupier", portrait: "char.mimi.croupier",
      note: "伏せ札とブラフを読む、紺とワインレッドの夜会正装。"
    },
    {
      id: "skyRacer", tab: "costume", name: "虹風スカイレーサー", price: 3800,
      icon: "char.mimi.racer", portrait: "char.mimi.racer",
      note: "泣き虫ドラゴンと空を駆ける、アクアのレースコート。"
    },
    {
      id: "wonderNavigator", tab: "costume", name: "分岐盤ナビゲーター", price: 4000,
      icon: "char.mimi.navigator", portrait: "char.mimi.navigator",
      note: "ワンダーランドの正解ルートを示す、ミントの案内服。"
    },
    {
      id: "raidCommander", tab: "costume", name: "レイド・コマンダー", price: 5200,
      icon: "char.mimi.raid", portrait: "char.mimi.raid",
      note: "6色のORBを束ね、未来ゲートへ挑む白い指揮衣装。"
    },
    {
      id: "tropicalHost", tab: "costume", name: "トロピカル・ホスト", price: 3000,
      icon: "char.mimi.tropical", portrait: "char.mimi.tropical",
      note: "プールリゾートの祝祭を迎えるアクアと珊瑚色の装い。"
    },
    {
      id: "twilightGala", tab: "costume", name: "トワイライト・ガラ", price: 4800,
      icon: "char.mimi.gala", portrait: "char.mimi.gala",
      note: "赤→金→虹の激アツ祝祭に映える、深紅の夜会衣装。"
    },
    {
      id: "jackpotEmpress", tab: "costume", name: "JACKPOT EMPRESS", price: 8888,
      icon: "char.mimi.empress", portrait: "char.mimi.empress",
      note: "5作品の勝利モチーフを束ねる、最終報酬の虹金正装。"
    },

    // --- エフェクト（抽選率は変えず、見た目と演出量だけを変える） ---
    {
      id: "sparkle", tab: "effect", name: "スパークル・ハート", price: 800,
      icon: "icon.heart", effect: "sparkle",
      note: "CHANCE前兆とWIN時の粒子を増やします。"
    },
    {
      id: "premium", tab: "effect", name: "プレミア祝祭", price: 1800,
      icon: "icon.orbMax", effect: "premium",
      note: "大当たり時の光と祝祭演出を強化します。"
    },
    {
      id: "panyuCharm", tab: "effect", name: "ぱにゅぱにゅチャーム", price: 1200,
      icon: "icon.revive", effect: "panyu",
      note: "外れ後の復活・昇格・継続をハートの光で強調します（抽選率は不変）。"
    },

    // --- 背景（上部液晶の下敷きが変わる） ---
    {
      id: "resort", tab: "background", name: "リゾート・ゲート", price: 1200,
      icon: "stage.gateway", stage: "stage.gateway",
      note: "通常時の演出背景を明るいゲートにします。"
    },
    {
      id: "market", tab: "background", name: "トロピカル市場", price: 1000,
      icon: "stage.market", stage: "stage.market",
      note: "ショップと小役演出が映える市場背景。"
    },
    {
      id: "pool", tab: "background", name: "プールリゾート", price: 1400,
      icon: "stage.pool", stage: "stage.pool",
      note: "BONUS中に似合う水辺の祝祭背景。"
    }
  ];

  /** 最初から所持している商品（price 0 のもの）。 */
  const defaultOwned = items.filter(item => item.price === 0).map(item => item.id);

  root.MimiContent = root.MimiContent || {};
  root.MimiContent.shopItems = items;
  root.MimiContent.defaultOwned = defaultOwned;
}(typeof globalThis !== "undefined" ? globalThis : this));
