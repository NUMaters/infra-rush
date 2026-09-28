# GitHub Pages からオンライン対戦を使う

GitHub Pages は静的ファイルのみ配信する。`/ws` の Go プロセスは別ホストで常時接続を受けられるようにする。画面はGitHub Pagesへ設定したカスタムドメイン `https://infrarush.net/` で公開する。

現在の対戦サーバーは `https://infra-rush-numaters.fly.dev/`。GitHub リポジトリ変数 `INFRA_RUSH_WS_URL` は `wss://infra-rush-numaters.fly.dev/ws` に設定済み。1台の Fly Machine を東京リージョンに配置した。

## 必要な設定

1. このリポジトリの `Dockerfile` から Go サーバーを HTTPS と WebSocket に対応した公開ホストへデプロイする。サーバーは `PORT` で待ち受け、`/health`、`/ws`、CPU戦結果用 `/matches`、任意アンケート用 `/feedback` を提供する。収集を続ける場合は `INFRA_MATCH_PATH` と `INFRA_FEEDBACK_PATH` に永続ストレージ上のファイルを指定する。
2. サーバーの環境変数 `INFRA_ALLOWED_ORIGINS=https://infrarush.net,https://numaters.github.io` を設定する。接続元はページのパスを含まず、オリジンだけを指定する。後者はGitHub Pagesの標準URLから確認するときのために残す。
3. GitHub リポジトリ変数 `INFRA_RUSH_WS_URL` に、公開サーバーの `wss://<host>/ws` を設定する。Pages のビルド時に `VITE_ONLINE_WS_URL` として埋め込まれる。`ws://` は HTTPS ページから使えない。
4. `pages.yml` を再実行し、`https://infrarush.net/` を別々の2ブラウザで開いてランダム対戦、数字5桁の招待コード、共有リンクからの参加を確認する。

サーバーがまだない場合、Pages 上ではマルチプレイの参加操作を無効にし、設定が必要と表示する。ローカルプレビューの `5173` / `5177` / `5178` からは従来どおり同じPCの `8080` 番へ接続する。Goサーバー自身が画面を配信するときは同一ホストの `/ws` を使う。

## Fly.io での低コスト配置

`fly.toml` は東京リージョンの 256MB / shared CPU 1台、待機中の自動停止と匿名試合・アンケート保存用1GBボリュームを指定する。`Dockerfile.fly` には対戦用Goサーバーとマスターデータだけを入れ、Pagesで配信する3Dモデルは重複配置しない。Bot・部屋・資源はプロセスのメモリにあるため、**必ず1台**にする。

Fly.ioにサインインし、支払い方法と実際の料金を確認してから、次を実行する。`infra-rush-numaters` が既に使われている場合は、`fly.toml` の `app` も同じ別名に変更する。

```sh
flyctl auth login
flyctl apps create infra-rush-numaters
flyctl volumes create feedback_data -a infra-rush-numaters -r nrt -s 1 -y
flyctl deploy --ha=false
flyctl scale count 1
curl https://infra-rush-numaters.fly.dev/health
gh variable set INFRA_RUSH_WS_URL --repo NUMaters/infra-rush --body 'wss://infra-rush-numaters.fly.dev/ws'
gh workflow run pages.yml --repo NUMaters/infra-rush
```

`/health` が `ok` を返し、Pages の再デプロイが成功したら、`https://infrarush.net/` を2ブラウザで開いてランダム対戦と部屋IDを確認する。自動停止中の初回接続には起動待ちが生じる。無料トライアルは2 VM時間または7日で終了し、決済手段なしではその後の対戦サーバーが止まる。継続利用は従量課金で、稼働時間のほか転送量・停止中のルートファイルシステムなどが課金される。デプロイ・再起動中の試合も失われる。

CPU戦結果は `/data/matches.jsonl`、アンケートは `/data/feedback.jsonl` に保存する。ボリュームはマシン停止中も1GB分が課金される（現行価格で約0.15米ドル/月）。手動集計するときは `fly ssh sftp get /data/feedback.jsonl feedback.jsonl -a infra-rush-numaters` でローカルへ取得し、`python3 scripts/feedback-report.py feedback.jsonl` を実行する。ファイルには名前・招待コードを含まないが、個々の回答なので公開しない。

自動調整を使うには、ランダムな同一トークンをFlyシークレット `INFRA_BALANCE_EXPORT_TOKEN` とGitHub Actionsシークレット `BALANCE_EXPORT_TOKEN` に設定する。前者は集計ジョブ専用の非公開データ取得APIを保護する。定期ジョブの閾値・停止方法・変更履歴は[CPU難易度の自動調整](balance/README.md)を参照する。

## Google Cloud Run での配置例

**専用の課金可能な Google Cloud プロジェクトを決めてから**実行する。既存の別サービス用プロジェクトには配置しない。公開中の WebSocket 接続は課金対象になる。まず最小インスタンス0、最大1、同時接続上限80で始める。

```sh
PROJECT_ID=<専用プロジェクトID>
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com --project "$PROJECT_ID"
gcloud run deploy infra-rush-online --source . --project "$PROJECT_ID" --region asia-northeast1 --allow-unauthenticated --port 8080 --timeout 3600 --min-instances 0 --max-instances 1 --concurrency 80 --set-env-vars INFRA_ALLOWED_ORIGINS=https://infrarush.net\,https://numaters.github.io
```

デプロイで返った `https://...` の URL に対して `/health` が `ok` を返すことを確認する。次に GitHub Actions のリポジトリ変数へ `wss://.../ws` を登録し、Pages を再デプロイする。

```sh
gh variable set INFRA_RUSH_WS_URL --repo NUMaters/infra-rush --body 'wss://<Cloud Run のホスト>/ws'
gh workflow run pages.yml --repo NUMaters/infra-rush
```

現在の部屋状態は Go プロセスのメモリにある。最大1インスタンス設定は別インスタンスへ対戦者が分かれるのを防ぐためで、サーバーの再起動・デプロイ時には進行中の試合が失われる。多台数で運用するには共有状態ストアとルーム割当を別途実装する。
