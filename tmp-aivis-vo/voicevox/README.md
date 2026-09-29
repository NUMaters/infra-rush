Revised script (lines_voicevox.tsv) for the 麒ヶ島宗麟 / †聖騎士 紅桜† versions. With VOICEVOX Engine on :50021:
  cd vo
  python3 voice_synth.py http://127.0.0.1:50021 "麒ヶ島宗麟" ../vo_sourin
  python3 voice_synth.py http://127.0.0.1:50021 "†聖騎士 紅桜†" ../vo_benizakura
Commit vo_sourin/ and vo_benizakura/ (wav + vo.json) to this branch. Mixing and muxing happen in the cloud.

UPDATE 14:10Z: lines_voicevox.tsv now = RioSato's hand-edited SCRIPT (SCRIPT_user_edit.md), with p1/n8a shortened to fit, n8c removed (n8b gets its slot), and n9 ending 「ぜひ遊んでみてください！」. Use this file as-is.
