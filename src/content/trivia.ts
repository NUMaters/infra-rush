export interface CivilTrivia {
  id: string;
  topic: string;
  title: string;
  text: string;
  source: string;
  sourceLabel: string;
  model:
    | "stone-bridge"
    | "steel-bridge"
    | "excavator"
    | "dozer"
    | "launcher"
    | "grader"
    | "soil"
    | "stone-resource";
  modelName: string;
}

// Real-world techniques represented in the game. The game's resource costs,
// bridge HP and construction times are deliberately simplified.
export const civilTrivia: readonly CivilTrivia[] = [
  {
    id: "bridge-iii",
    topic: "橋の点検",
    title: "Ⅲ判定は、早めに手を打つ合図",
    text: "道路橋の健全性Ⅲは「早期措置段階」。橋の機能に支障が出る可能性があり、早期の措置が必要。Ⅳの「緊急措置段階」とは別だよ。",
    source: "https://www.mlit.go.jp/road/sisaku/yobohozen/tenken/yobo7_23.pdf",
    sourceLabel: "国土交通省・道路橋定期点検要領",
    model: "stone-bridge",
    modelName: "石橋",
  },
  {
    id: "excavator-bucket",
    topic: "採掘と重機",
    title: "ショベルは、掘って積める",
    text: "油圧ショベルの一種、バックホウは地面を掘るのが得意。掘った土や石をダンプカーに積み込む仕事にも活躍するよ。",
    source: "https://www.thr.mlit.go.jp/narusedam/construction_equipment.html",
    sourceLabel: "国土交通省・成瀬ダム工事事務所",
    model: "excavator",
    modelName: "油圧ショベル",
  },
  {
    id: "bulldozer-blade",
    topic: "盛土と重機",
    title: "ブルドーザーの力は前の板",
    text: "前についた「排土板」で土や石を押し、地面のでこぼこをならす。ゲームで土を押す動きも、この仕事がモデルだよ。",
    source: "https://www.thr.mlit.go.jp/narusedam/construction_equipment.html",
    sourceLabel: "国土交通省・成瀬ダム工事事務所",
    model: "dozer",
    modelName: "ブルドーザー",
  },
  {
    id: "bridge-launching",
    topic: "橋を架ける",
    title: "橋桁を少しずつ送り出す方法がある",
    text: "橋の「送出し架設」では、桁を前へ送って架ける。完成後と架設中では力のかかり方が違うので、途中の変形にも注意するよ。",
    source:
      "https://www.mlit.go.jp/tec/r08dobokukoujikyoutsuusiyousyo/honbun03_syo02_setsu13.html",
    sourceLabel: "国土交通省・土木工事共通仕様書",
    model: "launcher",
    modelName: "架橋機",
  },
  {
    id: "motor-grader",
    topic: "整地と重機",
    title: "グレーダーは、面を仕上げる",
    text: "モーターグレーダーは、地面を平らに切削したり、材料を敷きならして形を整えたりする車輪式の重機。道の仕上げ役だよ。",
    source: "https://www.thr.mlit.go.jp/Bumon/J76101/homepage/word/ma.html",
    sourceLabel: "国土交通省・山形河川国道事務所",
    model: "grader",
    modelName: "モーターグレーダー",
  },
  {
    id: "embankment-compaction",
    topic: "盛土のつくり方",
    title: "土は盛るだけでは完成しない",
    text: "現実の盛土は、土を適切な厚さに敷きならし、層ごとに締め固める。下の地盤とも一体になるよう施工するんだ。",
    source:
      "https://www.mlit.go.jp/tec/r08dobokukoujikyoutsuusiyousyo/honbun01_syo02_setsu03.html",
    sourceLabel: "国土交通省・土木工事共通仕様書",
    model: "soil",
    modelName: "盛土",
  },
  {
    id: "bridge-crack-repair",
    topic: "橋の修繕",
    title: "ひび割れは、材料を注入して直すことも",
    text: "コンクリート橋のひび割れ補修には、樹脂などを低い圧力で注入してふさぐ工法がある。傷み方に合わせて方法を選ぶんだ。",
    source:
      "https://www.mlit.go.jp/sogoseisaku/maintenance/_pdf/manual02_pdf03.pdf",
    sourceLabel: "国土交通省・インフラメンテナンス資料",
    model: "stone-bridge",
    modelName: "石橋",
  },
  {
    id: "earthwork-drainage",
    topic: "盛土と水",
    title: "盛土には、水の逃げ道も必要",
    text: "盛土の表面に勾配をつけて排水しやすくする。土を丈夫に保つには、雨が降った後の水の行き先も考えるんだ。",
    source:
      "https://www.mlit.go.jp/tec/r08dobokukoujikyoutsuusiyousyo/honbun01_syo02_setsu03.html",
    sourceLabel: "国土交通省・土木工事共通仕様書",
    model: "soil",
    modelName: "盛土",
  },
  {
    id: "crushed-stone",
    topic: "石の使い道",
    title: "砕いた石は、道の下にもある",
    text: "採石場の岩を砕いてつくる砕石は、舗装の下にある「路盤」にも使われる。見えないところで道を支えているよ。",
    source: "https://www.thr.mlit.go.jp/yamagata/word/ka.html",
    sourceLabel: "国土交通省・山形河川国道事務所",
    model: "stone-resource",
    modelName: "砕石",
  },
  {
    id: "seismic-retrofit",
    topic: "地震への備え",
    title: "橋を守るのは、太さだけじゃない",
    text: "地震への備えでは、橋脚を補強するほか、橋桁が落ちないよう受けや装置を設ける方法もあるよ。",
    source: "https://www.ktr.mlit.go.jp/toukoku/toukoku00027.html",
    sourceLabel: "国土交通省・東京国道事務所",
    model: "steel-bridge",
    modelName: "鉄橋",
  },
  {
    id: "excavated-soil-reuse",
    topic: "土の再利用",
    title: "掘った土も、資源になる",
    text: "工事で出た土は、性質や使い道を確かめて別の工事で利用することがある。土を無駄にしない工夫だよ。",
    source: "https://www.mlit.go.jp/toshi/web/content/001610448.pdf",
    sourceLabel: "国土交通省・建設発生土の有効利用",
    model: "soil",
    modelName: "土",
  },
  {
    id: "bridge-five-years",
    topic: "橋の点検",
    title: "橋の定期点検は5年に1回が基本",
    text: "道路橋は5年に1回の頻度を基本に点検するよ。近接目視、または同等に評価できる方法で、橋の状態を調べるんだ。",
    source: "https://www.mlit.go.jp/road/sisaku/yobohozen/tenken/yobo7_23.pdf",
    sourceLabel: "国土交通省・道路橋定期点検要領",
    model: "stone-bridge",
    modelName: "石橋",
  },
];
