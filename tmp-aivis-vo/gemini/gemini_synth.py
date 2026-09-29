"""Narration with Gemini TTS, one request per line.
usage: GEMINI_API_KEY=... python3 gemini_synth.py <voice> <out_dir> [model]
Reads ../voicevox/vo/lines_voicevox.tsv (spoken column) and fits each take to its slot in
../voicevox/audio/cues.json by time-stretching (ffmpeg atempo, up to MAX_TEMPO). Existing wavs are kept,
so a run stopped by the daily quota can be resumed later."""
import json, os, sys, time, base64, subprocess, urllib.request, urllib.error, numpy as np
VOICE, OUT = sys.argv[1], sys.argv[2]; MODEL = sys.argv[3] if len(sys.argv) > 3 else 'gemini-3.8-flash-tts'
KEY = os.environ['GEMINI_API_KEY']; MAX_TEMPO, GAP, SR = 1.25, 0.35, 48000
NOTES = """# AUDIO PROFILE
Male Japanese announcer for a Nintendo Direct style game reveal trailer.

### DIRECTOR'S NOTES
Style: Bright, confident, energetic and genuinely excited, like a game showcase narrator. Crisp, clear articulation of every word.
Pace: Brisk but not rushed, with short natural pauses at commas.
Language: Japanese. Speak ONLY the transcript below. Do not read these notes aloud.

#### TRANSCRIPT
"""
here = os.path.dirname(os.path.abspath(__file__)); base = f'{here}/../voicevox'
cj = json.load(open(f'{base}/audio/cues.json')); cues = sorted(cj['vo'], key=lambda c: c['t'])
slot = {c['id']: (cues[i + 1]['t'] - c['t'] - GAP if i + 1 < len(cues) else cj['duration'] - 0.3 - c['t']) for i, c in enumerate(cues)}
os.makedirs(OUT, exist_ok=True)
vo_path = f'{OUT}/vo.json'; out = json.load(open(vo_path))['lines'] if os.path.exists(vo_path) else {}
def tts(text):
    body = {'contents': [{'parts': [{'text': NOTES + text}]}],
            'generationConfig': {'responseModalities': ['AUDIO'], 'speechConfig': {'voiceConfig': {'prebuiltVoiceConfig': {'voiceName': VOICE}}}}}
    for attempt in range(4):
        try:
            req = urllib.request.Request(f'https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent',
                data=json.dumps(body).encode(), headers={'Content-Type': 'application/json', 'x-goog-api-key': KEY})
            part = json.load(urllib.request.urlopen(req, timeout=300))['candidates'][0]['content']['parts'][0]['inlineData']; break
        except urllib.error.HTTPError as e:
            msg = e.read().decode()
            if e.code == 429 and 'PerDay' in msg: print('daily quota reached; rerun later to resume'); sys.exit(2)
            print('retry', e.code, msg[:120].replace('\n', ' '), flush=True); time.sleep(20 * (attempt + 1))
    else: sys.exit(1)
    raw = base64.b64decode(part['data']); fmt = [] if raw[:4] == b'RIFF' else ['-f', 's16le', '-ar', '24000', '-ac', '1']
    pcm = subprocess.run(['ffmpeg', '-loglevel', 'error', *fmt, '-i', '-', '-f', 's16le', '-ar', str(SR), '-ac', '1', '-'], input=raw, capture_output=True, check=True).stdout
    x = np.frombuffer(pcm, np.int16).astype(np.float32)
    env = np.convolve(np.abs(x), np.ones(480) / 480, 'same'); idx = np.where(env > env.max() * 0.02)[0]
    return x[max(0, idx[0] - int(0.03 * SR)): idx[-1] + int(0.08 * SR)]
for line in open(f'{base}/vo/lines_voicevox.tsv', encoding='utf8'):
    i, spoken, shown = line.rstrip('\n').split('\t'); wav = f'{OUT}/{i}.wav'
    if os.path.exists(wav) and i in out: continue
    y = tts(spoken); natural = len(y) / SR; tempo = 1.0
    if natural > slot[i]: tempo = min(MAX_TEMPO, natural / slot[i] * 1.02)
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-f', 's16le', '-ar', str(SR), '-ac', '1', '-i', '-', *(['-af', f'atempo={tempo:.4f}'] if tempo > 1 else []), wav],
                   input=y.astype(np.int16).tobytes(), check=True)
    d = round(natural / tempo, 3); out[i] = {'text': shown, 'dur': d, 'speed': round(tempo, 3)}
    json.dump({'speaker': f'Gemini TTS {VOICE} ({MODEL})', 'lines': out}, open(vo_path, 'w'), ensure_ascii=False, indent=1)
    print(i, d, 'slot', round(slot[i], 2), 'tempo', round(tempo, 3), 'OVER' if d > slot[i] else '', flush=True)
