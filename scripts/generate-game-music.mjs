// Rebuild the two deterministic, royalty-free in-game music loops with:
//   node scripts/generate-game-music.mjs
// Requires ffmpeg (libmp3lame); no downloaded samples or third-party music.
import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const rate = 32_000;
const twoPi = Math.PI * 2;
const outDir = resolve("public/audio");
mkdirSync(outDir, { recursive: true });
const hz = (midi) => 440 * 2 ** ((midi - 69) / 12);
const chords = [
  { bass: 38, notes: [50, 53, 57, 62] }, // Dm
  { bass: 34, notes: [46, 50, 53, 58] }, // Bb
  { bass: 31, notes: [43, 46, 50, 55] }, // Gm
  { bass: 33, notes: [45, 49, 52, 57] }, // A7 tension
];

function render({ name, bpm, urgent }) {
  const beat = 60 / bpm;
  const beats = 64;
  const seconds = beats * beat;
  const count = Math.ceil(seconds * rate);
  const left = new Float32Array(count);
  const right = new Float32Array(count);
  let seed = urgent ? 0x132a9 : 0x56f41;
  const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32);
  const put = (index, sample, pan = 0) => {
    if (index < 0 || index >= count) return;
    left[index] += sample * Math.sqrt((1 - pan) / 2);
    right[index] += sample * Math.sqrt((1 + pan) / 2);
  };

  function tone(midi, at, length, volume, kind, pan = 0) {
    const first = Math.round(at * rate);
    const n = Math.min(Math.ceil(length * rate), count - first);
    const f = hz(midi);
    for (let i = 0; i < n; i++) {
      const t = i / rate;
      const phase = twoPi * f * t;
      const attack = Math.min(1, t / (kind === "pad" ? 0.18 : 0.012));
      const release = Math.min(1, (length - t) / (kind === "pad" ? 0.28 : 0.08));
      let wave;
      let env;
      if (kind === "bass") {
        wave = Math.sin(phase) + 0.24 * Math.sin(2 * phase) + 0.1 * Math.sin(3 * phase);
        env = Math.exp(-t * 0.65);
      } else if (kind === "pad") {
        const vibrato = Math.sin(twoPi * 4.7 * t) * 0.017;
        wave = Math.sin(phase + vibrato) + 0.3 * Math.sin(2 * phase + vibrato) + 0.13 * Math.sin(3 * phase);
        env = 0.7 + 0.15 * Math.sin(twoPi * 0.55 * t);
      } else if (kind === "brass") {
        wave = Math.sin(phase) + 0.42 * Math.sin(2 * phase) + 0.21 * Math.sin(3 * phase) + 0.09 * Math.sin(4 * phase);
        env = Math.exp(-t * 1.4);
      } else { // muted mallet / metallic pluck
        wave = Math.sin(phase) + 0.34 * Math.sin(2.01 * phase) + 0.16 * Math.sin(3.98 * phase);
        env = Math.exp(-t * 5.5);
      }
      put(first + i, wave * attack * release * env * volume, pan);
    }
  }

  function kick(at, volume) {
    const first = Math.round(at * rate);
    const n = Math.min(Math.round(0.42 * rate), count - first);
    let phase = 0;
    for (let i = 0; i < n; i++) {
      const t = i / rate;
      phase += twoPi * (48 + 105 * Math.exp(-t * 34)) / rate;
      put(first + i, Math.sin(phase) * Math.exp(-t * 10) * volume);
    }
  }
  function snare(at, volume) {
    const first = Math.round(at * rate);
    const n = Math.min(Math.round(0.28 * rate), count - first);
    let last = 0;
    for (let i = 0; i < n; i++) {
      const t = i / rate;
      const white = random() * 2 - 1;
      const high = white - last * 0.72;
      last = white;
      const body = Math.sin(twoPi * 174 * t) * Math.exp(-t * 25);
      put(first + i, (high * 0.38 + body * 0.4) * Math.exp(-t * 15) * volume);
    }
  }
  function hat(at, volume, pan) {
    const first = Math.round(at * rate);
    const n = Math.min(Math.round(0.065 * rate), count - first);
    let prev = 0;
    for (let i = 0; i < n; i++) {
      const t = i / rate;
      const noise = random() * 2 - 1;
      const high = noise - prev;
      prev = noise;
      put(first + i, high * Math.exp(-t * 60) * volume, pan);
    }
  }

  for (let bar = 0; bar < 16; bar++) {
    const chord = chords[bar % 4];
    const start = bar * 4 * beat;
    const rise = bar >= 4 ? 1 : 0.72;
    for (let i = 0; i < 3; i++)
      tone(chord.notes[i] + 12, start, 4 * beat, urgent ? 0.017 : 0.022, "pad", (i - 1) * 0.45);
    tone(chord.bass, start, 3.9 * beat, urgent ? 0.085 : 0.072, "bass");
    for (let b = 0; b < 4; b++) {
      const at = start + b * beat;
      if (b === 0 || b === 2 || (urgent && b === 3)) kick(at, (urgent ? 0.42 : 0.35) * rise);
      if (b === 1 || b === 3) snare(at, (urgent ? 0.26 : 0.2) * rise);
      for (let s = 0; s < (urgent ? 4 : 2); s++)
        hat(at + s * beat / (urgent ? 4 : 2), (urgent ? 0.045 : 0.035) * rise, s % 2 ? 0.3 : -0.3);
      tone(chord.bass + (b === 3 ? 12 : 0), at, beat * 0.85, urgent ? 0.075 : 0.065, "bass");
    }
    // A restrained hook gives the normal loop a firmer, less playful melody.
    const motif = urgent ? [0, 2, 1, 3, 2, 1, 0, 1] : [0, -1, 1, -1, 2, -1, 1, -1];
    for (let step = 0; step < 8; step++) {
      const index = motif[step];
      if (index < 0) continue;
      const note = chord.notes[index] + (urgent ? 24 : 12);
      tone(note, start + step * beat / 2, beat * (urgent ? 0.39 : 0.55), urgent ? 0.034 : 0.028, urgent ? "brass" : "pluck", step % 2 ? 0.22 : -0.22);
    }
    if (bar % 4 === 3) {
      tone(chord.notes[1] + 12, start + 3 * beat, beat * 0.85, urgent ? 0.05 : 0.036, "brass", -0.15);
      tone(chord.notes[3] + 12, start + 3 * beat, beat * 0.85, urgent ? 0.043 : 0.03, "brass", 0.15);
    }
  }

  // A short stereo reflection adds depth without a long tail across the loop seam.
  for (const [delay, amount] of [[0.09, 0.08], [0.17, 0.045]]) {
    const shift = Math.round(delay * rate);
    for (let i = shift; i < count; i++) {
      left[i] += right[i - shift] * amount;
      right[i] += left[i - shift] * amount;
    }
  }
  let peak = 0;
  for (let i = 0; i < count; i++) peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i]));
  const scale = 0.84 / peak;
  const pcm = Buffer.allocUnsafe(count * 4);
  for (let i = 0; i < count; i++) {
    const edge = Math.min(1, i / (rate * 0.025), (count - i - 1) / (rate * 0.025));
    pcm.writeInt16LE(Math.round(Math.tanh(left[i] * scale * edge) * 32767), i * 4);
    pcm.writeInt16LE(Math.round(Math.tanh(right[i] * scale * edge) * 32767), i * 4 + 2);
  }
  const output = resolve(outDir, `infra-rush-${name}.mp3`);
  const result = spawnSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-f", "s16le", "-ar", String(rate), "-ac", "2", "-i", "pipe:0", "-codec:a", "libmp3lame", "-qscale:a", "3", output], { input: pcm, maxBuffer: 1024 * 1024 });
  if (result.status !== 0) throw new Error(result.stderr?.toString() || "ffmpeg failed");
  console.log(`${output}: ${seconds.toFixed(2)} s`);
}

render({ name: "loop", bpm: 108, urgent: false });
render({ name: "urgent", bpm: 136, urgent: true });
