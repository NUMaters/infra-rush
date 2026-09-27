# オープニングムービー

ゲーム起動時に、実際に配信している GLB を Blender に読み込んで撮影した 8 秒の映像を再生する。映像は読み込みが終わるまでループし、初回の 8 秒も見せてから従来のタイトル画面に切り替える。動きを減らす設定では静止画を表示し、追加待機をしない。

## カット構成

| 時間 | 被写体と専用の動き |
| --- | --- |
| 0–2 秒 | WorkBot 2 体が歩いて登場し、手を振る |
| 2–4 秒 | 掘削機のブーム・アーム・バケットが掘る。横で Bot が合図する |
| 4–6 秒 | ブルドーザーが進み、Bot も並走する |
| 6–8 秒 | 橋桁が城へ向けて伸び、Bot が完成を喜ぶ |

撮影には `public/models` の `bot.glb`、`excavator.glb`、`dozer.glb`、`soil.glb`、`launcher.glb`、`stone-bridge.glb`、`castle.glb` を使用する。映像のためのカメラ、照明、舞台、小物は `assets/blender/render_opening.py` で生成する。Bot は GLB の歩行・手振りアクションを使用し、重機の可動部と橋桁には専用キーフレームを設定している。

## 再生成

Blender 5.2、ffmpeg、cwebp を使用する。作業ディレクトリはリポジトリのルート。

```sh
/Applications/Blender.app/Contents/MacOS/Blender -b -t 4 --python assets/blender/render_opening.py -- --preview
/Applications/Blender.app/Contents/MacOS/Blender -b -t 4 --python assets/blender/render_opening.py
ffmpeg -framerate 20 -i .qa-preview/opening-frames/frame-%04d.png -c:v libx264 -preset slow -crf 24 -pix_fmt yuv420p -movflags +faststart -an public/media/opening.mp4
cwebp -q 78 .qa-preview/opening-frames/frame-0010.png -o public/media/opening-poster.webp
```

PNG は `.qa-preview/opening-frames` に生成され、Git には含めない。配信する映像と静止画は `public/media` に配置する。動画は音声なしで自動再生し、既存のタイトル BGM が切り替え時に再生される。
