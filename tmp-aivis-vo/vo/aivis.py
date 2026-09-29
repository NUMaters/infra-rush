"""Narration with AivisSpeech (VOICEVOX-compatible API, default http://127.0.0.1:10101).
Each line is fitted to its slot in ../audio/cues.json: if the natural take is longer than the gap
before the next line, it is re-synthesized a little faster (up to MAX_SPEED)."""
import json, sys, urllib.request, urllib.parse, io, wave, subprocess, numpy as np
URL = 'http://127.0.0.1:10101'; SPEAKER = int(sys.argv[1]); BASE_SPEED = float(sys.argv[2]) if len(sys.argv) > 2 else 1.0
MAX_SPEED, GAP = 1.2, 0.35
def call(path, params, body=None):
    req = urllib.request.Request(f'{URL}{path}?{urllib.parse.urlencode(params)}', data=body, method='POST', headers={'Content-Type': 'application/json'})
    return urllib.request.urlopen(req, timeout=300).read()
def synth(text, speed):
    q = json.loads(call('/audio_query', {'text': text, 'speaker': SPEAKER}))
    q.update(speedScale=speed, prePhonemeLength=0.05, postPhonemeLength=0.1, outputSamplingRate=48000, outputStereo=False)
    w = wave.open(io.BytesIO(call('/synthesis', {'speaker': SPEAKER}, json.dumps(q).encode())))
    x = np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float32); sr = w.getframerate()
    env = np.convolve(np.abs(x), np.ones(480) / 480, 'same'); idx = np.where(env > env.max() * 0.02)[0]
    return x[max(0, idx[0] - int(0.03 * sr)): idx[-1] + int(0.08 * sr)], sr
cues = json.load(open('../audio/cues.json'))['vo']; order = sorted(cues, key=lambda c: c['t'])
slot = {c['id']: (order[i + 1]['t'] - c['t'] - GAP if i + 1 < len(order) else 99) for i, c in enumerate(order)}
out = {}
for line in open('lines_aivis.tsv', encoding='utf8'):
    i, text = line.rstrip('\n').split('\t'); sp = BASE_SPEED
    y, sr = synth(text, sp)
    for _ in range(3):
        if len(y) / sr <= slot.get(i, 99) or sp >= MAX_SPEED: break
        sp = min(MAX_SPEED, sp * (len(y) / sr) / slot.get(i, 99) * 1.02); y, sr = synth(text, sp)
    wave_path = f'{i}.wav'
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-f', 's16le', '-ar', str(sr), '-ac', '1', '-i', '-', '-ar', '48000', wave_path], input=y.astype(np.int16).tobytes(), check=True)
    d = round(len(y) / sr, 3); out[i] = {'text': text, 'dur': d, 'speed': round(sp, 3)}
    print(i, d, 'slot', round(slot.get(i, 99), 2), 'speed', round(sp, 3), 'OVER' if d > slot.get(i, 99) else '')
json.dump(out, open('vo.json', 'w'), ensure_ascii=False, indent=1)
