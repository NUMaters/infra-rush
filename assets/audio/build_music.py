"""Render the original INFRA RUSH match theme to a compact MP3.

Requires numpy and ffmpeg. All tones and percussion are synthesized here; no
third-party samples or licensed melodies are used.
"""

from __future__ import annotations

import subprocess
import tempfile
import wave
from pathlib import Path

import numpy as np


ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "public/audio/infra-rush-loop.mp3"
SAMPLE_RATE = 44_100
BPM = 132
BEAT = 60 / BPM
BAR = BEAT * 4
BARS = 32
LENGTH = BAR * BARS
N = round(LENGTH * SAMPLE_RATE)
LEFT = np.zeros(N, dtype=np.float32)
RIGHT = np.zeros(N, dtype=np.float32)
RNG = np.random.default_rng(260926)


def mix(samples: np.ndarray, at: float, volume: float, pan: float = 0) -> None:
    start = round(at * SAMPLE_RATE)
    if start >= N:
        return
    end = min(N, start + len(samples))
    samples = samples[: end - start] * volume
    LEFT[start:end] += samples * np.sqrt((1 - pan) / 2)
    RIGHT[start:end] += samples * np.sqrt((1 + pan) / 2)


def tone(midi: int, start: float, beats: float, voice: str, volume: float, pan=0) -> None:
    freq = 440 * 2 ** ((midi - 69) / 12)
    duration = min(beats * BEAT, LENGTH - start)
    if duration <= 0:
        return
    n = round((duration + 0.09) * SAMPLE_RATE)
    t = np.arange(n, dtype=np.float32) / SAMPLE_RATE
    if voice == "bell":
        wave_form = (
            np.sin(2 * np.pi * freq * t)
            + 0.25 * np.sin(2 * np.pi * freq * 2.01 * t)
            + 0.1 * np.sin(2 * np.pi * freq * 3 * t)
        )
        envelope = (1 - np.exp(-t * 160)) * np.exp(-t * 4.7)
    elif voice == "mallet":
        wave_form = (
            np.sin(2 * np.pi * freq * t)
            + 0.32 * np.sin(2 * np.pi * freq * 2 * t)
            + 0.11 * np.sin(2 * np.pi * freq * 3.01 * t)
        )
        envelope = (1 - np.exp(-t * 240)) * np.exp(-t * 6)
    elif voice == "bass":
        wave_form = np.sin(2 * np.pi * freq * t) + 0.23 * np.sin(
            2 * np.pi * freq * 2 * t
        )
        envelope = (1 - np.exp(-t * 250)) * np.exp(-t * 3.3)
    else:  # soft, toy-like chord organ
        wave_form = (
            np.sin(2 * np.pi * freq * t)
            + 0.14 * np.sin(2 * np.pi * freq * 2 * t)
            + 0.06 * np.sin(2 * np.pi * freq * 3 * t)
        )
        envelope = (1 - np.exp(-t * 12)) * (1 - np.exp(-(duration - t).clip(0) * 28))
    mix(wave_form * envelope, start, volume, pan)


def drum(kind: str, start: float, volume=1.0) -> None:
    lengths = {"kick": 0.30, "snare": 0.22, "hat": 0.075, "wood": 0.105}
    n = round(lengths[kind] * SAMPLE_RATE)
    t = np.arange(n, dtype=np.float32) / SAMPLE_RATE
    if kind == "kick":
        phase = 2 * np.pi * (49 * t + 88 * (1 - np.exp(-t * 22)) / 22)
        samples = np.sin(phase) * np.exp(-t * 16)
        mix(samples, start, 0.17 * volume)
    elif kind == "snare":
        noise = RNG.standard_normal(n).astype(np.float32)
        noise = noise - np.convolve(noise, np.ones(16) / 16, "same")
        samples = noise * np.exp(-t * 22) + 0.3 * np.sin(2 * np.pi * 190 * t) * np.exp(-t * 28)
        mix(samples, start, 0.05 * volume, 0.04)
    elif kind == "hat":
        noise = RNG.standard_normal(n).astype(np.float32)
        samples = np.diff(noise, prepend=0) * np.exp(-t * 58)
        mix(samples, start, 0.013 * volume, 0.2)
    else:
        samples = (
            np.sin(2 * np.pi * 780 * t) + 0.4 * np.sin(2 * np.pi * 1170 * t)
        ) * np.exp(-t * 39)
        mix(samples, start, 0.019 * volume, -0.22)


# D major, A major, B minor, G major: a bright route-building theme.
PROGRESSION = [
    (50, (62, 66, 69), (74, 78, 81)),
    (45, (61, 64, 69), (73, 76, 81)),
    (47, (59, 62, 66), (71, 74, 78)),
    (43, (59, 62, 67), (71, 74, 79)),
]

# Eight-bar lead phrase, then three hand-written variations with a middle break.
PHRASES = [
    [(0, 74), (2, 78), (3, 81), (5, 78), (6, 76)],
    [(0, 76), (1, 78), (3, 81), (4, 83), (6, 81)],
    [(0, 78), (2, 76), (3, 74), (5, 71), (6, 74)],
    [(0, 71), (2, 74), (3, 76), (5, 79), (6, 78)],
    [(0, 74), (1, 76), (2, 78), (4, 81), (6, 86)],
    [(0, 83), (2, 81), (3, 78), (5, 76), (6, 73)],
    [(0, 71), (2, 74), (3, 78), (4, 81), (6, 78)],
    [(0, 79), (2, 78), (4, 76), (6, 74)],
]

for bar in range(BARS):
    start = bar * BAR
    root, chord, high = PROGRESSION[bar % 4]
    section = bar // 8

    # The break thins the arrangement so the return of the main hook feels good.
    intensity = 0.72 if section == 2 else 1.0
    for beat, shift, velocity in [(0, 0, 1), (1.5, 7, 0.45), (2, 0, 0.82), (3.5, 7, 0.42)]:
        tone(root + shift, start + beat * BEAT, 0.9, "bass", 0.092 * velocity * intensity)
    for beat in (1, 3):
        for i, pitch in enumerate(chord):
            tone(pitch, start + beat * BEAT, 0.63, "organ", 0.019 * intensity, (i - 1) * 0.15)
    for step in range(8):
        tone(high[(step + (step // 4)) % 3], start + step * BEAT / 2, 0.36,
             "bell", 0.027 * intensity, 0.16)

    phrase = PHRASES[bar % 8]
    for step, pitch in phrase:
        note = pitch + (0 if section in (0, 3) else 12 if section == 1 and step >= 4 else 0)
        if section == 2 and step in (1, 3):
            continue
        tone(note, start + step * BEAT / 2, 0.8 if step in (0, 4) else 0.48,
             "mallet", 0.12 if section != 2 else 0.083, -0.12)

    for beat in range(4):
        drum("kick" if beat % 2 == 0 else "snare", start + beat * BEAT,
             0.78 if section == 2 else 1.0)
        if section != 2 or beat % 2 == 0:
            drum("hat", start + (beat + 0.5) * BEAT, 0.78)
    if bar % 4 == 3:
        for beat in (3, 3.5):
            drum("wood", start + beat * BEAT, 0.9)

# Quiet stereo echoes add space without reverb files or runtime DSP.
for destination, source, delay in ((RIGHT, LEFT, 0.187), (LEFT, RIGHT, 0.302)):
    offset = round(delay * SAMPLE_RATE)
    destination[offset:] += source[:-offset] * 0.055

# Avoid a discontinuity where the music loops.
fade = round(0.075 * SAMPLE_RATE)
LEFT[-fade:] *= np.linspace(1, 0, fade)
RIGHT[-fade:] *= np.linspace(1, 0, fade)
peak = max(np.max(np.abs(LEFT)), np.max(np.abs(RIGHT)))
pcm = np.column_stack((LEFT, RIGHT)) * (0.78 / peak)
OUTPUT.parent.mkdir(parents=True, exist_ok=True)
with tempfile.NamedTemporaryFile(suffix=".wav") as temporary:
    with wave.open(temporary.name, "wb") as wav:
        wav.setnchannels(2)
        wav.setsampwidth(2)
        wav.setframerate(SAMPLE_RATE)
        wav.writeframes((pcm * 32767).astype("<i2").tobytes())
    subprocess.run(
        ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", temporary.name,
         "-codec:a", "libmp3lame", "-qscale:a", "3", "-metadata", "title=INFRA RUSH - Build the Way",
         str(OUTPUT)],
        check=True,
    )
print(f"Rendered {OUTPUT} ({LENGTH:.1f}s, {OUTPUT.stat().st_size / 1024:.0f} KiB)")
