export interface CivilTrivia {
  id: string;
  topic: string;
  title: string;
  text: string;
  source: string;
  sourceLabel: string;
}

// Short, source-linked facts. These describe real infrastructure, not the
// game's simplified bridge HP or construction rules.
export const civilTrivia: readonly CivilTrivia[] = [
  {
    id: "bridge-iii",
    topic: "橋の点検",
    title: "Ⅲ判定は、早めに手を打つ合図",
    text: "道路橋の健全性Ⅲは「早期措置段階」。橋の機能に支障が出る可能性があり、早期の措置が必要。Ⅳの「緊急措置段階」とは別だよ。",
    source: "https://www.mlit.go.jp/road/sisaku/yobohozen/tenken/yobo7_23.pdf",
    sourceLabel: "国土交通省・道路橋定期点検要領",
  },
  {
    id: "bridge-five-years",
    topic: "橋の点検",
    title: "橋の定期点検は5年に1回が基本",
    text: "道路橋は5年に1回の頻度を基本に点検するよ。近接目視、または同等に評価できる方法で、橋の状態を調べるんだ。",
    source: "https://www.mlit.go.jp/road/sisaku/yobohozen/tenken/yobo7_23.pdf",
    sourceLabel: "国土交通省・道路橋定期点検要領",
  },
  {
    id: "bridge-ii",
    topic: "橋の手入れ",
    title: "Ⅱ判定は、今のうちに備える段階",
    text: "道路橋の健全性Ⅱは「予防保全段階」。いま機能に支障がなくても、先を見て措置することが望ましい状態だよ。",
    source: "https://www.mlit.go.jp/road/sisaku/yobohozen/tenken/yobo7_23.pdf",
    sourceLabel: "国土交通省・道路橋定期点検要領",
  },
  {
    id: "bridge-fatigue",
    topic: "橋の傷み",
    title: "車が通るたび、橋に力がかかる",
    text: "交通荷重が繰り返しかかると、コンクリートにはひび割れ、鋼材には亀裂が生じることがある。これを「疲労」というよ。",
    source: "https://www.cbr.mlit.go.jp/road/taisaku/current/cur02.html",
    sourceLabel: "国土交通省・中部地方整備局",
  },
  {
    id: "earthwork-drainage",
    topic: "土をつくる",
    title: "盛土には、水を逃がす工夫も必要",
    text: "現実の道路の盛土では、土を盛るだけでなく、雨水を適切に排水することも大切。水への備えが道路を支えるんだ。",
    source: "https://www.mlit.go.jp/report/press/road01_hh_001960.html",
    sourceLabel: "国土交通省・道路土工構造物技術基準",
  },
  {
    id: "bridge-temperature",
    topic: "橋のしくみ",
    title: "橋は温度で伸び縮みする",
    text: "気温が変わると橋も伸び縮みする。支承や伸縮装置は、その動きを見込んで設計されるんだよ。",
    source: "https://www.mlit.go.jp/road/sign/kijyun/pdf/hashikouka.pdf",
    sourceLabel: "国土交通省・道路橋示方書",
  },
];
