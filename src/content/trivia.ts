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
    title: "橋にも健康診断がある",
    text: "道路の橋は、傷み具合を4段階で調べるよ。3番目なら、早めに手当てが必要。人の健康診断と同じで、悪くなる前に見つけることが大切なんだ。",
    source: "https://www.mlit.go.jp/road/sisaku/yobohozen/tenken/yobo7_23.pdf",
    sourceLabel: "国土交通省・道路橋定期点検要領",
    model: "stone-bridge",
    modelName: "石橋",
  },
  {
    id: "excavator-bucket",
    topic: "採掘と重機",
    title: "ショベルは、掘って積める",
    text: "ショベルは地面を掘るだけでなく、掘った土をトラックに積むこともできる。工事現場の大きなスプーンみたいだね。",
    source: "https://www.thr.mlit.go.jp/narusedam/construction_equipment.html",
    sourceLabel: "国土交通省・成瀬ダム工事事務所",
    model: "excavator",
    modelName: "油圧ショベル",
  },
  {
    id: "bulldozer-blade",
    topic: "盛土と重機",
    title: "ブルドーザーの力は前の板",
    text: "前の大きな板で土を押して、でこぼこの地面をならすよ。ゲームで土を押す動きも、この仕事がモデルなんだ。",
    source: "https://www.thr.mlit.go.jp/narusedam/construction_equipment.html",
    sourceLabel: "国土交通省・成瀬ダム工事事務所",
    model: "dozer",
    modelName: "ブルドーザー",
  },
  {
    id: "bridge-launching",
    topic: "橋を架ける",
    title: "橋を少しずつ押し出して架ける",
    text: "橋の長い部分を、端から少しずつ前へ押し出して架ける方法がある。動かしている間は支え方が変わるので、形を確かめながら進めるよ。",
    source:
      "https://www.mlit.go.jp/tec/r08dobokukoujikyoutsuusiyousyo/honbun03_syo02_setsu13.html",
    sourceLabel: "国土交通省・土木工事共通仕様書",
    model: "launcher",
    modelName: "架橋機",
  },
  {
    id: "motor-grader",
    topic: "整地と重機",
    title: "グレーダーは道の仕上げ役",
    text: "車体の真ん中にある長い刃で、地面を薄く削ったり、土を広げたりする。道を平らに整えるのが得意だよ。",
    source: "https://www.thr.mlit.go.jp/Bumon/J76101/homepage/word/ma.html",
    sourceLabel: "国土交通省・山形河川国道事務所",
    model: "grader",
    modelName: "モーターグレーダー",
  },
  {
    id: "embankment-compaction",
    topic: "盛土のつくり方",
    title: "土は盛るだけでは完成しない",
    text: "土を一度に高く積むのではなく、薄く広げては固める作業を繰り返す。ミルフィーユのように重ねて、丈夫な地面をつくるよ。",
    source:
      "https://www.mlit.go.jp/tec/r08dobokukoujikyoutsuusiyousyo/honbun01_syo02_setsu03.html",
    sourceLabel: "国土交通省・土木工事共通仕様書",
    model: "soil",
    modelName: "盛土",
  },
  {
    id: "stone-arch",
    topic: "石橋のしくみ",
    title: "石橋は、石どうしで支え合う",
    text: "アーチ形の石橋では、並んだ石がとなりの石を押し合って重さを支える。曲がった形にも、ちゃんと理由があるんだ。",
    source: "https://www.thr.mlit.go.jp/Bumon/J76101/homepage/word/index.html",
    sourceLabel: "国土交通省・山形河川国道事務所",
    model: "stone-bridge",
    modelName: "石橋",
  },
  {
    id: "earthwork-drainage",
    topic: "盛土と水",
    title: "盛土には、水の逃げ道も必要",
    text: "雨水がたまらないよう、積んだ土の表面を少し傾ける。土を積むだけでなく、水の通り道まで考えるのが工事のコツだよ。",
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
    text: "岩を細かく砕いた石は、道路の表面より下の層にも使われる。車からは見えないけれど、道を支える大事な材料だよ。",
    source: "https://www.thr.mlit.go.jp/yamagata/word/ka.html",
    sourceLabel: "国土交通省・山形河川国道事務所",
    model: "stone-resource",
    modelName: "砕石",
  },
  {
    id: "seismic-retrofit",
    topic: "地震への備え",
    title: "橋を守るのは、太さだけじゃない",
    text: "地震に備えて、橋を支える柱を強くしたり、橋の長い部分が落ちないよう装置をつけたりする。橋にも安全対策があるんだ。",
    source: "https://www.ktr.mlit.go.jp/toukoku/toukoku00027.html",
    sourceLabel: "国土交通省・東京国道事務所",
    model: "steel-bridge",
    modelName: "鉄橋",
  },
  {
    id: "excavated-soil-reuse",
    topic: "土の再利用",
    title: "掘った土も、資源になる",
    text: "掘った土は、使えるかどうかを確かめて、別の工事で使うこともある。いらない土が、次の現場では役立つんだ。",
    source: "https://www.mlit.go.jp/toshi/web/content/001610448.pdf",
    sourceLabel: "国土交通省・建設発生土の有効利用",
    model: "soil",
    modelName: "土",
  },
  {
    id: "bridge-five-years",
    topic: "橋の点検",
    title: "橋は何年ごとに点検する？",
    text: "道路の橋は、5年に1回を基本に点検するよ。近くから見たり、同じくらい確かに調べられる方法を使ったりして、傷みを探すんだ。",
    source: "https://www.mlit.go.jp/road/sisaku/yobohozen/tenken/yobo7_23.pdf",
    sourceLabel: "国土交通省・道路橋定期点検要領",
    model: "stone-bridge",
    modelName: "石橋",
  },
  {
    id: "excavator-tools",
    topic: "重機の変身",
    title: "ショベルの先は付け替えられる",
    text: "土をすくうバケットのほか、岩を砕く道具などに付け替えられる。先っぽを変えると、同じショベルでも違う仕事ができるよ。",
    source: "https://www.mlit.go.jp/tec/gijutu/kaihatu/josei/147seika.pdf",
    sourceLabel: "国土交通省・建設技術研究開発報告書",
    model: "excavator",
    modelName: "油圧ショベル",
  },
  {
    id: "bridge-heat",
    topic: "橋と気温",
    title: "橋も暑い日は少し伸びる",
    text: "橋の長い部分は、気温が変わると伸び縮みする。その動きを受け止めるため、橋のつなぎ目にも工夫があるよ。",
    source:
      "https://www.thr.mlit.go.jp/bumon/b00097/k00910/h12-hp/R5dourokyou_R6.7ver.pdf",
    sourceLabel: "国土交通省・橋梁設計施工マニュアル",
    model: "steel-bridge",
    modelName: "鉄橋",
  },
  {
    id: "road-drainage",
    topic: "雨の日の道",
    title: "雨を横へ逃がす道路がある",
    text: "道路の表面に小さなすき間をつくり、雨水を下の層から道路わきへ流す舗装がある。水たまりを減らす工夫だよ。",
    source: "https://www.mlit.go.jp/road/soudan/soudan_08b_01.html",
    sourceLabel: "国土交通省・道の相談室",
    model: "stone-resource",
    modelName: "道路の材料になる石",
  },
  {
    id: "bridge-scour",
    topic: "橋と川",
    title: "橋の足元を川が削ることも",
    text: "川の流れが、橋を支える柱のまわりの土を削ることがある。橋の上だけでなく、水の中の足元も見守るんだ。",
    source: "https://www.mlit.go.jp/tetudo/tetudo_tk7_000024.html",
    sourceLabel: "国土交通省・河川橋梁対策",
    model: "steel-bridge",
    modelName: "鉄橋",
  },
  {
    id: "soil-moisture",
    topic: "土と水",
    title: "土はぬれすぎても固まらない",
    text: "土をぎゅっと固めるときは、水分も大事。カラカラでもびしょびしょでも固めにくいので、土に合う水分を確かめるよ。",
    source:
      "https://www.pa.cbr.mlit.go.jp/file/topics/0331_hasai-siryo-sanko.pdf",
    sourceLabel: "国土交通省・土の締固め資料",
    model: "soil",
    modelName: "盛土",
  },
  {
    id: "quiet-road",
    topic: "道路の音",
    title: "静かな道路にもひみつがある",
    text: "雨水を逃がすタイプの舗装には、走る車の音を小さくする効果もある。道のつくり方で、聞こえる音まで変わるんだ。",
    source: "https://www.mlit.go.jp/road/soudan/soudan_10a_02.html",
    sourceLabel: "国土交通省・道に関するデータ集",
    model: "stone-resource",
    modelName: "道路の材料になる石",
  },
];
