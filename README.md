# INFRA RUSH

5体の作業Botを指揮し、採掘・橋・土工で勝利への道をつくる、ブラウザ向け3Dストラテジー。

**開発中です。Phase 1の合格判定前であり、完成版ではありません。**
唯一のルール仕様は [INFRA_RUSH_SPEC.md](INFRA_RUSH_SPEC.md)。補完判断は [docs/decisions](docs/decisions)、計画は [docs/PLAN.md](docs/PLAN.md)。

## 起動

Node 22.12以上を推奨。

```sh
npm ci
npm run dev
```

表示されたlocalhost URLを開きます。同一LANのスマートフォンはPCのLAN IPと同ポートでアクセスできます。外部公開・認証設定はこのリポジトリでは行っていません。

配布用静的プレビュー（QA操作なし）:

```sh
npm run build:portable
npm run preview:portable
```

`http://localhost:5177/`。起動時にファイルをメモリに読み込むため、変更後は再起動してください。実際の検証結果と残件は [docs/qa/VALIDATION.md](docs/qa/VALIDATION.md)。

## 遊び方

1. 難易度を選び「工事をはじめる」。
2. マップ上の青いBot・搭乗重機をタップ（PCは数字キー1〜5でも選択）。小さな指示ウィンドウから「掘る」を指示。
3. 石50が集まったら、Botを選んで「橋をつくる」。掘っている途中でも次の仕事へ切り替えられます。
4. 橋ができたら「攻める」。相手の城を一度たたくと自動で帰還。合計5回で勝ち。
5. 相手の道を土でふさぎ、自分の道の土はどけて復旧。橋を強くする・直す・壊すこともできます。作業先は自動で決まり、真ん中の橋はマップ上で直接タップできます。

初期視点は自分の城が手前。1本指/左ドラッグで移動、ピンチ/ホイールで拡大縮小、2本指/右ドラッグで回転できます。

土・石・鉄は1秒1資源、石→土→石→鉄の周期で増加。有限タスクはキャンセル不可。時間切れはHP差に関係なく引き分け。地震は双方同じルールです。

## 開発・検証

```sh
npm run build
npm run lint
npm run format:check
npm test
npx playwright install chromium
npm run test:e2e
```

E2Eはdevサーバーを5173番で起動してから実行します。`?qa`で公開される開発専用テストAPIは時間を早送りして実際の指示・資源計算を検証します。本番ビルドには含まれません。

## アセット

`assets/blender/build.py`から、名前付き可動部を持つ11モデルを生成します。編集可能なライブラリは`assets/blender/infra-rush.blend`。GLBとサイズ・三角形数は`public/models/`。

```sh
npm run assets
```

BlenderのパスはMacの標準インストールを使用。別環境では`blender --background --threads 2 --python assets/blender/build.py`。
正式資料12枚の出典は`docs/references/manifest.json`。比較で残っている形状・色・質感の差分はQA記録に記載します。

## Phase 2

まだ着手していません。Phase 1の全条件を満たした後、Go authoritative server / WebSocket / room / reconnect / command sequence / snapshotを実装する方針です。
