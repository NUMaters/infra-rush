"""Narration with a VOICEVOX-compatible engine (VOICEVOX :50021, AivisSpeech :10101).
usage: python3 voice_synth.py <engine_url> "<speaker name>" <out_dir> [style name]
Each line is fitted to its slot in ../audio/cues.json: if the natural take runs past the next line,
it is re-synthesized a little faster (up to MAX_SPEED). Writes <out_dir>/<id>.wav and <out_dir>/vo.json."""
import json, sys, os, io, wave, subprocess, urllib.request, urllib.parse, numpy as np
URL, NAME, OUT = sys.argv[1].rstrip('/'), sys.argv[2], sys.argv[3]; STYLE = sys.argv[4] if len(sys.argv) > 4 else 'ノーマル'
MAX_SPEED, GAP, BASE, INTONATION = 1.3, 0.35, 1.1, 1.25
os.makedirs(OUT, exist_ok=True)
def get(path): return json.loads(urllib.request.urlopen(URL + path, timeout=60).read())
def post(path, params, body=None):
    req = urllib.request.Request(f'{URL}{path}?{urllib.parse.urlencode(params)}', data=body or b'', method='POST', headers={'Content-Type': 'application/json'})
    return urllib.request.urlopen(req, timeout=600).read()
sp = next(s for s in get('/speakers') if s['name'] == NAME)
sty = next((s for s in sp['styles'] if s['name'] == STYLE), sp['styles'][0]); SID = sty['id']
print('speaker', NAME, sty['name'], SID)
def synth(text, speed):
    q = json.loads(post('/audio_query', {'text': text, 'speaker': SID}))
    q.update(speedScale=speed, intonationScale=INTONATION, prePhonemeLength=0.05, postPhonemeLength=0.1, outputSamplingRate=48000, outputStereo=False)
    w = wave.open(io.BytesIO(post('/synthesis', {'speaker': SID}, json.dumps(q).encode())))
    x = np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float32); sr = w.getframerate()
    env = np.convolve(np.abs(x), np.ones(480) / 480, 'same'); idx = np.where(env > env.max() * 0.02)[0]
    return x[max(0, idx[0] - int(0.03 * sr)): idx[-1] + int(0.08 * sr)], sr
here = os.path.dirname(os.path.abspath(__file__))
cues = sorted(json.load(open(f'{here}/../audio/cues.json'))['vo'], key=lambda c: c['t'])
dur = json.load(open(f'{here}/../audio/cues.json'))['duration']
slot = {c['id']: (cues[i + 1]['t'] - c['t'] - GAP if i + 1 < len(cues) else dur - 0.3 - c['t']) for i, c in enumerate(cues)}
out = {}
for line in open(f'{here}/lines_voicevox.tsv', encoding='utf8'):
    i, spoken, shown = line.rstrip('\n').split('\t'); s = BASE
    y, sr = synth(spoken, s)
    for _ in range(3):
        if len(y) / sr <= slot[i] or s >= MAX_SPEED: break
        s = min(MAX_SPEED, s * (len(y) / sr) / slot[i] * 1.03); y, sr = synth(spoken, s)
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-f', 's16le', '-ar', str(sr), '-ac', '1', '-i', '-', '-ar', '48000', f'{OUT}/{i}.wav'], input=y.astype(np.int16).tobytes(), check=True)
    d = round(len(y) / sr, 3); out[i] = {'text': shown, 'dur': d, 'speed': round(s, 3)}
    print(i, d, 'slot', round(slot[i], 2), 'speed', round(s, 3), 'OVER' if d > slot[i] else '')
json.dump({'speaker': f'{NAME}（{sty["name"]}）', 'lines': out}, open(f'{OUT}/vo.json', 'w'), ensure_ascii=False, indent=1)
