Temporary hand-off for re-voicing the intro video narration with AivisSpeech. Not for merge; this branch will be deleted.
Run AivisSpeech Engine on 127.0.0.1:10101, then `cd vo && python3 aivis.py <speaker_id>`; commit vo/*.wav and vo/vo.json back to this branch.

UPDATE 16:30Z (Gemini/Orus): RioSato asked to add "no install / no sign-up", "auto-scaling for heavy load" and "first to take down the enemy castle wins". Only n2, n7d, n7c changed in tmp-aivis-vo/voicevox/vo/lines_voicevox.tsv. Re-render just those 3 lines with gemini-3.8-flash-tts Orus into tmp-aivis-vo/gemini/vo_orus/ (slots: n2 13.9s, n7d 6.1s, n7c 6.5s).
