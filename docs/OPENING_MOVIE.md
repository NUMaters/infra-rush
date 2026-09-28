# オープニングムービー

ゲーム起動時に、ユーザーが採用した `gemini_generated_video_77f0d820.mp4` を読み込み中の演出として再生する。高画質版は元映像の **1280×720・24fps・10秒・H.264** を再圧縮せず音声だけ除去した `public/media/opening-gemini-77f0d820-hd.mp4`。端末の画面幅・CPU数・メモリ・通信節約設定に応じて540p・360p版を選ぶ。再生が3秒進まない場合は360pへ切り替え、それでも再生できない場合や動きを減らす設定ではポスター画像を表示する。映像は読み込み中だけループし、ゲームの読み込みが終われば途中でもタイトル画面に切り替える。

動画内ではBotが現場を走り、ショベルとブルドーザーの作業から架橋、Botの進軍へ移る。動画上に掛け声やロゴのカットインは重ねず、読み込み表示だけを下部に置く。

元動画は `Downloads/gemini_generated_video_77f0d820.mp4`。配信用動画の生成コマンド:

```sh
ffmpeg -i ~/Downloads/gemini_generated_video_77f0d820.mp4 -map 0:v:0 -c:v copy -movflags +faststart -an public/media/opening-gemini-77f0d820-hd.mp4
ffmpeg -ss 2 -i ~/Downloads/gemini_generated_video_77f0d820.mp4 -frames:v 1 /tmp/infra-rush-opening-poster.png
cwebp -q 90 /tmp/infra-rush-opening-poster.png -o public/media/opening-gemini-77f0d820-hd-poster.webp
ffmpeg -i ~/Downloads/gemini_generated_video_77f0d820.mp4 -vf "scale=960:540:flags=lanczos,fps=24" -c:v libx264 -preset slow -crf 22 -profile:v baseline -level 3.1 -pix_fmt yuv420p -g 48 -bf 0 -movflags +faststart -an public/media/opening-gemini-77f0d820-md.mp4
ffmpeg -i ~/Downloads/gemini_generated_video_77f0d820.mp4 -vf "scale=640:360:flags=lanczos,fps=20" -c:v libx264 -preset slow -crf 24 -profile:v baseline -level 3.0 -pix_fmt yuv420p -g 40 -bf 0 -movflags +faststart -an public/media/opening-gemini-77f0d820-lite.mp4
```

## 旧Blender版の制作手順

以前の8秒版は、`public/models` の `bot.glb`、`excavator.glb`、`dozer.glb`、`soil.glb`、`launcher.glb`、`stone-bridge.glb`、`castle.glb` を使用して撮影した。カメラ、照明、舞台、小物は `assets/blender/render_opening.py` で生成する。以下のコマンドは旧版を別ファイルに再生成する手順で、現在の採用動画は上書きしない。

Blender 5.2、ffmpeg、cwebp を使用する。作業ディレクトリはリポジトリのルート。

```sh
/Applications/Blender.app/Contents/MacOS/Blender -b -t 4 --python assets/blender/render_opening.py -- --preview
/Applications/Blender.app/Contents/MacOS/Blender -b -t 4 --python assets/blender/render_opening.py
node scripts/edit-opening.mjs
ffmpeg -framerate 20 -i .qa-preview/opening-cut/frame-%04d.png -c:v libx264 -preset slow -crf 24 -pix_fmt yuv420p -movflags +faststart -an /tmp/infra-rush-old-opening.mp4
cwebp -q 78 .qa-preview/opening-frames/frame-0063.png -o /tmp/infra-rush-old-opening-poster.webp
```

特定のカットだけ撮り直す場合は、Blender コマンドの最後に `-- --frames=121-160` のようにフレーム範囲を指定してから、編集とエンコードを再実行する。

旧版のPNGは `.qa-preview/opening-frames` と `.qa-preview/opening-cut` に生成され、Git には含めない。配信する映像と静止画は `public/media` に配置する。動画は音声なしで自動再生し、既存のタイトル BGM が切り替え時に再生される。Service Worker はポスターだけをキャッシュする。動画はブラウザの標準 Range 通信で直接配信し、動画全体を Worker のメモリに展開しない。

## 映像制作用のキャラ・重機一覧画像

[`assets/opening-reference/全素材.png`](../assets/opening-reference/全素材.png) は現在の `public/models` にある作業Bot、油圧ショベル、ブルドーザー、モーターグレーダー、掘削機、架橋機を一枚に並べた参照画像。各モデルの3/4・正面・側面を収録する。映像のカット設計やキャラデザインの確認に使う。これはメッシュのUV展開図ではない。

モデル更新後は次のコマンドで再生成する。

```sh
/Applications/Blender.app/Contents/MacOS/Blender -b -t 4 --python assets/blender/render_opening_reference.py
python3 assets/opening-reference/compose_sheet.py
```
