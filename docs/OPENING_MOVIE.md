# オープニングムービー

ゲーム起動時に、ユーザーが採用した `gemini_generated_video_77f0d820.mp4` を読み込み中の演出として再生する。配信用に音声を除き、**960×540・20fps・10秒・H.264** へ圧縮したものが `public/media/opening-gemini-77f0d820.mp4`。2秒付近の映像を静止画にした `public/media/opening-gemini-77f0d820-poster.webp` を代替表示に使う。映像は読み込み中だけループし、ゲームの読み込みが終わった時点でタイトル画面に切り替える。映像の再生開始や終了は待たない。再生できない場合や動きを減らす設定では静止画を表示する。

動画内ではBotが現場を走り、ショベルとブルドーザーの作業から架橋、Botの進軍へ移る。画面上の短いカットインはこの映像の流れに合わせて `src/main.ts` で切り替える。エフェクトと文字の表示は `src/style.css` にあり、動きを減らす設定では停止する。

元動画は `Downloads/gemini_generated_video_77f0d820.mp4`。配信用動画の生成コマンド:

```sh
ffmpeg -i ~/Downloads/gemini_generated_video_77f0d820.mp4 -vf 'scale=960:540:flags=lanczos,fps=20' -c:v libx264 -preset slow -crf 24 -pix_fmt yuv420p -movflags +faststart -an public/media/opening-gemini-77f0d820.mp4
ffmpeg -ss 2 -i ~/Downloads/gemini_generated_video_77f0d820.mp4 -frames:v 1 /tmp/infra-rush-opening-poster.png
cwebp -q 82 /tmp/infra-rush-opening-poster.png -o public/media/opening-gemini-77f0d820-poster.webp
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

旧版のPNGは `.qa-preview/opening-frames` と `.qa-preview/opening-cut` に生成され、Git には含めない。配信する映像と静止画は `public/media` に配置する。動画は音声なしで自動再生し、既存のタイトル BGM が切り替え時に再生される。Service Worker は動画を事前キャッシュし、オフライン時の Range リクエストにも部分応答する。

## 映像制作用のキャラ・重機一覧画像

[`assets/opening-reference/全素材.png`](../assets/opening-reference/全素材.png) は現在の `public/models` にある作業Bot、油圧ショベル、ブルドーザー、モーターグレーダー、掘削機、架橋機を一枚に並べた参照画像。各モデルの3/4・正面・側面を収録する。映像のカット設計やキャラデザインの確認に使う。これはメッシュのUV展開図ではない。

モデル更新後は次のコマンドで再生成する。

```sh
/Applications/Blender.app/Contents/MacOS/Blender -b -t 4 --python assets/blender/render_opening_reference.py
python3 assets/opening-reference/compose_sheet.py
```
