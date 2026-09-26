# BGM確認（2026-09-26）

- オリジナル音源 `public/audio/infra-rush-loop.mp3` を生成。ffprobeでMP3、44.1kHz、ステレオ、58.18秒、1,178,887バイトを確認。
- 音源を含むポータブル版を `http://localhost:5177/` で起動。MP3はHTTP 200で配信された。
- 実ブラウザで「工事をはじめる」を押し、`#bgm` の `paused=false`、`loop=true`、再生位置の進行と音源URLを確認。
- ポーズで `paused=true`、再開で `paused=false`。音声ボタンのオン・オフは `aria-pressed` が切り替わった。
- 「タイトルへ戻る」で `paused=true`、再生位置0秒を確認。ブラウザコンソールのエラーはなかった。
- iOS/Android実機では未検証。ユーザーがローカルURLで試聴予定。

音源は `assets/audio/build_music.py` から再生成できる。再生状態を検証するE2Eケースを `tests/e2e/music.spec.ts` に追加したが、このホストではPlaywrightの起動がファイル読み込みで停滞し、このケース自体の完走は未確認。上記は実ブラウザでの直接検証結果。
