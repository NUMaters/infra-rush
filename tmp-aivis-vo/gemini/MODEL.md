# Narration voice (Gemini TTS)

- Model: gemini-3.8-flash-tts (Gemini API), prebuilt voice **Orus** (Google describes it as "Firm")
- Direction: Nintendo Direct style game-reveal announcer — bright, confident, excited, crisp articulation (see NOTES in gemini_synth.py)
- Script: ../voicevox/vo/lines_voicevox.tsv (spoken column), timing: ../voicevox/audio/cues.json
- One request per line. Lines longer than their slot were time-stretched with ffmpeg atempo (pitch preserved): p1 1.11x, p2 1.13x, n1 1.13x, n7a 1.04x, n7b 1.06x; everything else is natural speed. No line exceeds its slot.
- Output: vo_orus/<id>.wav (48 kHz mono) and vo_orus/vo.json (same shape as the VOICEVOX takes)
- Usage: generated with the Gemini API on a paid project; Google's Gemini API terms let you use the generated audio. No credit is required, but "Voice: Gemini TTS (Google)" can be listed in the credits.

Regenerate (resumes where it stopped; delete vo_orus/ to start over):

    GEMINI_API_KEY=... python3 gemini_synth.py Orus vo_orus

## Extra lines for the next cut (vo_orus_extra/)

Candidate lines for the owner's 2026-09-29 requests, rendered at natural speed (no slot yet, so nothing is time-stretched).
The video side decides where they go; rerun with a cue in cues.json and `TSV=extra_lines.tsv` to fit them to a slot.

| id | text | sec | purpose |
|---|---|---|---|
| x_browser | アプリのインストールも、会員登録も不要。ブラウザを開けば、すぐに遊べます！ | 5.6 | no install / no sign-up (could replace n7d) |
| x_scale | サーバーはオートスケーリングに対応。アクセスが集中しても、快適に対戦できる設計です。 | 6.7 | auto scaling under heavy traffic |
| x_rule | ルールはシンプル。相手の城にダメージを与えて、先に落とした方の勝ち！ | 5.6 | win condition |
| x_close | 遊んで知ろう、土木のしくみ。INFRA RUSH！ぜひ遊んでみてください！ | 5.6 | closing screen (could replace n9) |
