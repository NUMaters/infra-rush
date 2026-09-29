# Narration voices (VOICEVOX)

Engine: VOICEVOX Engine 0.25.2 (macOS arm64), style ノーマル, speed 1.1x, intonation 1.25 — the same settings as the V08 / V15 samples.
Every line fits its slot at 1.1x; no line needed speeding up.

| Folder | Voice | Style id | Credit (required) | Terms |
|---|---|---|---|---|
| vo_sourin/ | 麒ヶ島宗麟 | 53 | VOICEVOX:麒ヶ島宗麟 | https://www.virvoxproject.com/voicevoxの利用規約 |
| vo_benizakura/ | †聖騎士 紅桜† | 51 | VOICEVOX:†聖騎士 紅桜† | https://commons.nicovideo.jp/material/nc296132 |

Both libraries allow commercial and non-commercial use of generated audio as long as the credit above is shown
(for a video: in the end credits or the description).

Regenerate:
    cd vo
    python3 voice_synth.py http://127.0.0.1:50021 "麒ヶ島宗麟" ../vo_sourin
    python3 voice_synth.py http://127.0.0.1:50021 "†聖騎士 紅桜†" ../vo_benizakura
