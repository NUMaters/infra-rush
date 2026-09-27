# オープニングムービー

ゲーム起動時に、実際に配信している GLB を Blender に読み込んで撮影した 8 秒の映像を再生する。最初の映像フレームに表示の機会を与えてから重い3D読み込みを始める。映像は読み込みが終わるまでループし、初回の再生フレームと終盤の再生位置を確認してから従来のタイトル画面に切り替える。起動からの経過時間だけでは切り替えない。再生が禁止・停止・失敗した場合は、ポスターと「ムービーを再生」「タイトルへ進む」を表示する。動きを減らす設定では静止画を表示し、追加待機をしない。

カメラを低く近づけて各モデルの大きさを見せる。掘削・押し出し・橋の接続では、可動部に合わせて破片、衝撃の輪、短いカメラの寄りをキーフレームで撮影する。`scripts/edit-opening.mjs` で4場面をテンポよくつなぎ、最後の2秒は0.5秒ごとに見せ場を連続させる。カットの境目には大きな効果音風の文字と短い画面演出を重ねる。これらの画面演出は `src/main.ts` と `src/style.css` にあり、動きを減らす設定では停止する。

## カット構成

| 時間 | 被写体と専用の動き |
| --- | --- |
| 0–1.5 秒 | WorkBot 2 体がカメラに向かって登場 |
| 1.5–3 秒 | 掘削機が掘り、破片と衝撃の輪が広がる |
| 3–4.5 秒 | ブルドーザーが土を押して前進し、土砂が飛ぶ |
| 4.5–6 秒 | 橋桁が城へ伸び、接続時に光の破片が散る |
| 6–8 秒 | Bot・掘削・整地・架橋の見せ場を0.5秒ずつ畳みかける |

撮影には `public/models` の `bot.glb`、`excavator.glb`、`dozer.glb`、`soil.glb`、`launcher.glb`、`stone-bridge.glb`、`castle.glb` を使用する。映像のためのカメラ、照明、舞台、小物は `assets/blender/render_opening.py` で生成する。Bot は GLB の歩行・手振りアクションを使用し、重機の可動部と橋桁には専用キーフレームを設定している。

## 再生成

Blender 5.2、ffmpeg、cwebp を使用する。作業ディレクトリはリポジトリのルート。

```sh
/Applications/Blender.app/Contents/MacOS/Blender -b -t 4 --python assets/blender/render_opening.py -- --preview
/Applications/Blender.app/Contents/MacOS/Blender -b -t 4 --python assets/blender/render_opening.py
node scripts/edit-opening.mjs
ffmpeg -framerate 20 -i .qa-preview/opening-cut/frame-%04d.png -c:v libx264 -preset slow -crf 24 -pix_fmt yuv420p -movflags +faststart -an public/media/opening.mp4
cwebp -q 78 .qa-preview/opening-frames/frame-0063.png -o public/media/opening-poster.webp
```

特定のカットだけ撮り直す場合は、Blender コマンドの最後に `-- --frames=121-160` のようにフレーム範囲を指定してから、編集とエンコードを再実行する。

PNG は `.qa-preview/opening-frames` と `.qa-preview/opening-cut` に生成され、Git には含めない。配信する映像と静止画は `public/media` に配置する。動画は音声なしで自動再生し、既存のタイトル BGM が切り替え時に再生される。Service Worker は動画を事前キャッシュし、オフライン時の Range リクエストにも部分応答する。
