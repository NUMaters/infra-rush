# 公開マルチプレイ検証（2026-09-26）

GitHub Pages `https://numaters.github.io/infra-rush/` と Fly.io `https://infra-rush-numaters.fly.dev/` を使用。Fly.io は東京リージョンの共有CPU・256MBを1台、共有IPv4とIPv6、待機中の自動停止で構成した。Pages 側の GitHub Actions 変数 `INFRA_RUSH_WS_URL` は `wss://infra-rush-numaters.fly.dev/ws`。Pages のワークフロー実行 `36244892077` は成功。

- 公開Pagesのマルチプレイ画面でサーバーへの接続を確認。
- PC幅とスマホ幅の別ブラウザでランダム対戦を開始。双方で採掘し、相手側の状態スナップショットに石の増加が反映された。
- 別の2ブラウザで5文字の部屋IDを使って参加し、名前を変更して試合を開始した。
- Fly Machineが接続終了後に `stopped` になり、次の公開ページの接続で自動起動して再接続できた。
- 対戦メニューを閉じた際、WebSocketを閉じて再入場時に新しく接続できることをローカルプレビューで確認。

この検証は公開URLの接続と主要なマッチング操作を対象とする。対戦中のサーバー再起動時にルーム状態を復元する仕組みはなく、進行中の試合は失われる。
