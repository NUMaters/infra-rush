# Narration voice model

- Model: fumifumi (v1.0.0, style: ノーマル)
- Description: 落ち着いた青年をイメージして作成したボイスモデル (AivisHub voice timbre: AdultMale)
- Authors: 制作 黒神 / kokushin (https://x.com/kokushing), 声 サガワフミヤ / sagawafumiya (https://x.com/fumi_sagawa)
- AivisHub: https://hub.aivis-project.com/aivm-models/71e72188-2726-4739-9aa9-39567396fb2a
- License: ACML 1.0 (Aivis Common Model License) — commercial and non-commercial use allowed, credit required
  - https://github.com/Aivis-Project/ACML/blob/master/ACML-1.0.md
- Speaker/style id (AivisSpeech Engine 1.2.0 /speakers): 606865152
- Engine: AivisSpeech Engine 1.2.0 (macOS arm64), `python3 aivis.py 606865152`

## Credit text

AivisSpeech: fumifumi（制作: 黒神 / 声: サガワフミヤ）

## Notes

- p1, p2, n6d have no entry in ../audio/cues.json, so they were rendered at speed 1.0 with no slot limit.
- n8a was sped up to 1.164x to fit its 4.35 s slot; every other cued line is at 1.0x. No line exceeds its slot.
- Alternative tried: Lux by Lami (ACML 1.0, speaker id 2031733024) — needed 1.09–1.2x on n8a–n8c and n8a still ran over.
