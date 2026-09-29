Temporary hand-off for re-voicing the intro video narration with AivisSpeech. Not for merge; this branch will be deleted.
Run AivisSpeech Engine on 127.0.0.1:10101, then `cd vo && python3 aivis.py <speaker_id>`; commit vo/*.wav and vo/vo.json back to this branch.

UPDATE 16:30Z (Gemini/Orus): RioSato asked to add "no install / no sign-up", "auto-scaling for heavy load" and "first to take down the enemy castle wins". Only n2, n7d, n7c changed in tmp-aivis-vo/voicevox/vo/lines_voicevox.tsv. Re-render just those 3 lines with gemini-3.8-flash-tts Orus into tmp-aivis-vo/gemini/vo_orus/ (slots: n2 13.9s, n7d 6.1s, n7c 6.5s).

UPDATE 16:32Z (supersedes 16:30Z): RioSato wants the ORIGINAL content kept AND the new points added.
- n2: original text (existing vo_orus/n2.wav is fine, no re-render).
- x_rule: vo_orus_extra/x_rule.wav placed at 27.0s (no re-render).
- n7d (slot 6.1s) and n7c (slot 6.5s): merged old+new text in lines_voicevox.tsv — re-render ONLY these two with Orus into vo_orus/ (speed up to fit if needed).
- n9: keep x_close as the closing line.

UPDATE 16:33Z: final n7d/n7c text is in lines_voicevox.tsv (n7d includes PWA). n2 as rendered in 9eafc89 is final; no x_rule line.
