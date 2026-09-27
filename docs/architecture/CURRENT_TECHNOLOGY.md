# INFRA RUSH 現行技術とデータフロー

調査日: 2026-09-28 / 対象コミット: f0e6a4f / 対象: リポジトリ内の実装と設定。AWS 構成は [AWS_ARCHITECTURE.md](AWS_ARCHITECTURE.md) の**設計案**であり、現時点の稼働環境ではない。

## 1. 製品と実行境界

INFRA RUSH はブラウザで動く 3D 土木ストラテジー。チュートリアルと CPU 戦はクライアント側で進行し、オンライン対戦のみ Go サーバーが試合を権威的に進める。ゲームの基準値は <code>master/*.json</code> にあり、TypeScript と Go がそれぞれ読み込む。試合の tick は <code>master/game.json</code> の 0.05 秒、つまり 20 Hz。両実装のルール変更を同期させる必要がある。

| 領域 | 現行技術と責務 | 実装の根拠 |
| --- | --- | --- |
| UI / 3D | TypeScript、Vite、Three.js、WebGL。Bot、重機、橋、演出、操作画面をブラウザで描画 | [src/main.ts](../../src/main.ts)、[src/render/world.ts](../../src/render/world.ts)、[package.json](../../package.json) |
| アセット | Blender で制作した GLB/glTF を実行時に読み込み。モデル URL は Vite の <code>BASE_URL</code> に追従 | [assets/blender](../../assets/blender)、[public/models](../../public/models)、[src/render/world.ts](../../src/render/world.ts) |
| 単独プレイ | TypeScript のルールエンジン、CPU 判断、チュートリアル | [src/game/engine.ts](../../src/game/engine.ts)、[src/game/cpu.ts](../../src/game/cpu.ts) |
| オンライン対戦 | Go 1.25、<code>gorilla/websocket</code>。サーバーが指示を検証し、50 ms ごとに状態を更新・配信 | [server/main.go](../../server/main.go)、[server/game.go](../../server/game.go)、[go.mod](../../go.mod) |
| 匿名データ | CPU 戦の結果と任意アンケートを HTTP で送信。クライアントは localStorage に最大 20 件を保持して再送 | [src/net/outbox.ts](../../src/net/outbox.ts)、[server/match_telemetry.go](../../server/match_telemetry.go)、[server/feedback.go](../../server/feedback.go) |
| CPU 調整 | GitHub Actions の日次ジョブが直近データを取得し、条件を満たす場合だけ <code>master/cpu.json</code> を小幅更新 | [.github/workflows/cpu-balance.yml](../../.github/workflows/cpu-balance.yml)、[docs/balance/README.md](../balance/README.md) |
| 品質 | Vitest、Playwright、Go test、ESLint、Prettier | [tests](../../tests)、[server](../../server)、[package.json](../../package.json) |

## 2. 現在の通信・状態管理

1. ブラウザはビルド時に埋め込まれた <code>VITE_ONLINE_WS_URL</code> へ WSS 接続する。ローカルでは同一ホストの <code>/ws</code> を使う。[クライアント](../../src/net/client.ts)は再接続トークンと指示番号を保持し、切断後に再接続する。
2. Go の <code>hub</code> は、ランダム待機列、数字 5 桁の招待コード、部屋、プレイヤー、再接続トークンを**プロセス内の map / slice**で保持する。部屋は 2 人、再接続猶予は 90 秒。サーバー側は指示の連番と毎秒 20 件の上限を検証する。
3. 試合状態も <code>room.game</code> として同じプロセスにある。HTTP の <code>/health</code> は固定の <code>ok</code> を返す。主要エンドポイントは <code>/ws</code>、<code>/matches</code>、<code>/feedback</code>、トークン保護された <code>/balance/export</code>。
4. 結果と回答は <code>INFRA_MATCH_PATH</code> / <code>INFRA_FEEDBACK_PATH</code> の JSONL ファイルへ書く。現行 Fly.io 設定では永続ボリューム <code>/data</code> にある。個別データに名前・招待コードを含めない設計。

**重要な制約:** ロードバランサーの後ろでこの Go プロセスを 2 台に増やしても、部屋・待機列・再接続トークンは共有されない。WebSocket の接続固定だけでは、2 人を同じ部屋へ確実に割り当てられない。ローカル JSONL も複数ライターにできない。単に ECS のオートスケーリングを有効化するのは不正確な構成になる。

## 3. 現行デプロイ

- 静的画面は GitHub Actions でビルドし、GitHub Pages の <https://numaters.github.io/infra-rush/> に公開。[pages.yml](../../.github/workflows/pages.yml)。本体の配布物は現行のローカルビルドで約 23 MB、GLB 群は約 16 MB。これは設計用の参考値で、通信量はブラウザキャッシュに依存する。
- オンライン Go サーバーは東京リージョンの Fly.io Machine 1 台。256 MB、shared CPU、停止・再起動でメモリ中の試合は消える。[fly.toml](../../fly.toml)、[Dockerfile.fly](../../Dockerfile.fly)、[ONLINE_DEPLOYMENT.md](../ONLINE_DEPLOYMENT.md)。
- <code>Dockerfile</code> はフロントと Go を一緒に配信する可搬イメージ。<code>Dockerfile.fly</code> は Pages と重複する静的配布物を省く。
- PWA のサービスワーカーは本番ブラウザで登録される。[src/main.ts](../../src/main.ts)。AWS 移行時は旧キャッシュと <code>BASE_URL</code>、GLB・音声の URL、WSS 設定を合わせて検証する。

## 4. AWS 移行時にそのまま使える部分・改修が必要な部分

| そのまま使える | 移行前に改修が必要 |
| --- | --- |
| Vite の静的ビルド、GLB、Three.js 描画、クライアントの再接続 UI、Go のゲームルール、匿名フィードバック形式 | 複数プロセスに跨る部屋検索・待機列・再接続、部屋所有権とフェイルオーバー、耐久性のある指示記録と試合スナップショット、JSONL から共有ストアへの移行、WS ゲートウェイと試合ワーカーの分割 |

AWS 設計は、**現行コードを 1 タスクで動かす暫定移行**と、**コード改修後に実現する 2 AZ オートスケール構成**を明確に分ける。後者の図を [AWS_ARCHITECTURE.png](AWS_ARCHITECTURE.png) に示す。
