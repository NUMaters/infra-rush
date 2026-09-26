"""Generate INFRA RUSH's short, original menu/result loops with stdlib + ffmpeg.

Run: python3 scripts/generate_scene_music.py
The fixed melodies, instruments and random seed keep the committed MP3s reproducible.
"""

from array import array
import math
from pathlib import Path
import random
import struct
import subprocess
import tempfile
import wave

RATE = 24_000
OUT = Path(__file__).resolve().parents[1] / "public" / "audio"
PITCH = {"C": 0, "C#": 1, "D": 2, "D#": 3, "E": 4, "F": 5, "F#": 6,
         "G": 7, "G#": 8, "A": 9, "A#": 10, "B": 11}


def hz(name: str) -> float:
    octave = int(name[-1])
    midi = (octave + 1) * 12 + PITCH[name[:-1]]
    return 440 * 2 ** ((midi - 69) / 12)


class Song:
    def __init__(self, bpm: int, bars: int):
        self.beat = 60 / bpm
        self.length = bars * 4 * self.beat
        self.samples = array("f", [0]) * round(self.length * RATE)
        self.random = random.Random(20260926)

    def tone(self, beat: float, pitch: str, beats: float, volume: float,
             voice: str = "mallet") -> None:
        start = round(beat * self.beat * RATE)
        duration = beats * self.beat
        count = min(round(duration * RATE), len(self.samples) - start)
        frequency = hz(pitch)
        for i in range(max(0, count)):
            t = i / RATE
            phase = 2 * math.pi * frequency * t
            if voice == "pad":
                envelope = min(1, t * 8) * min(1, (duration - t) * 4)
                wave_value = math.sin(phase) + .25 * math.sin(2 * phase)
            elif voice == "horn":
                envelope = min(1, t * 55) * min(1, (duration - t) * 12)
                wave_value = math.sin(phase) + .42 * math.sin(2 * phase) + .15 * math.sin(3 * phase)
            elif voice == "bass":
                envelope = (1 - math.exp(-t * 95)) * math.exp(-t * 4)
                wave_value = math.sin(phase) + .2 * math.sin(2 * phase)
            else:
                envelope = (1 - math.exp(-t * 140)) * math.exp(-t * (5 if voice == "mallet" else 3.6))
                wave_value = math.sin(phase) + .32 * math.sin(2.02 * phase) + .13 * math.sin(3.9 * phase)
            self.samples[start + i] += volume * envelope * wave_value

    def drum(self, beat: float, kind: str, volume: float) -> None:
        start = round(beat * self.beat * RATE)
        duration = {"kick": .23, "clap": .13, "hat": .07}[kind]
        count = min(round(duration * RATE), len(self.samples) - start)
        previous_noise = 0.0
        for i in range(max(0, count)):
            t = i / RATE
            noise = self.random.uniform(-1, 1)
            if kind == "kick":
                value = math.sin(2 * math.pi * (60 * t + 70 * (1 - math.exp(-t * 30)) / 30)) * math.exp(-t * 20)
            elif kind == "clap":
                value = (.8 * noise + .2 * math.sin(2 * math.pi * 180 * t)) * math.exp(-t * 31)
            else:
                value = (noise - previous_noise) * math.exp(-t * 75)
            previous_noise = noise
            self.samples[start + i] += volume * value

    def export(self, name: str) -> None:
        # A short seam ramp avoids clicks when a browser loops an MP3.
        fade = round(.045 * RATE)
        peak = max(abs(v) for v in self.samples) or 1
        scale = .78 / peak
        pcm = bytearray()
        for i, value in enumerate(self.samples):
            edge = min(1, i / fade, (len(self.samples) - 1 - i) / fade)
            pcm.extend(struct.pack("<h", round(value * scale * max(0, edge) * 32767)))
        OUT.mkdir(parents=True, exist_ok=True)
        with tempfile.TemporaryDirectory() as directory:
            wav = Path(directory) / "mix.wav"
            with wave.open(str(wav), "wb") as file:
                file.setnchannels(1)
                file.setsampwidth(2)
                file.setframerate(RATE)
                file.writeframes(pcm)
            subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
                            "-i", str(wav), "-codec:a", "libmp3lame", "-b:a", "96k",
                            str(OUT / name)], check=True)
        print(f"{name}: {self.length:.2f}s")


def title() -> Song:
    song = Song(124, 8)
    chords = [("C4", "E4", "G4"), ("G3", "D4", "G4"),
              ("A3", "C4", "E4"), ("F3", "C4", "F4"),
              ("C4", "E4", "G4"), ("G3", "D4", "G4"),
              ("F3", "A3", "C4"), ("G3", "B3", "D4")]
    melody = [
        ["E5", "G5", "C6", "G5"], ["D5", "G5", "B5", "G5"],
        ["E5", "A5", "C6", "A5"], ["F5", "A5", "C6", "G5"],
        ["E5", "G5", "C6", "E6"], ["D6", "B5", "G5", "D5"],
        ["C6", "A5", "F5", "A5"], ["B5", "G5", "D5", "G5"],
    ]
    for bar, chord in enumerate(chords):
        base = bar * 4
        for pitch in chord:
            song.tone(base, pitch, 3.9, .044, "pad")
        for quarter in range(4):
            song.tone(base + quarter, chord[0], .8, .15, "bass")
            song.tone(base + quarter, melody[bar][quarter], .75, .19)
            song.drum(base + quarter, "kick" if quarter % 2 == 0 else "clap", .095)
        for eighth in range(8):
            song.tone(base + eighth * .5, chord[(eighth + 1) % 3], .38, .052)
            song.drum(base + eighth * .5, "hat", .038)
    return song


def victory() -> Song:
    song = Song(118, 8)
    chords = [("C4", "E4", "G4"), ("F3", "A3", "C4"),
              ("G3", "B3", "D4"), ("C4", "E4", "G4")] * 2
    fanfare = [
        ["G5", "C6", "E6", "C6"], ["A5", "C6", "F6", "C6"],
        ["B5", "D6", "G6", "D6"], ["E6", "G6", "C7", "G6"],
        ["G5", "C6", "E6", "G6"], ["A5", "F6", "C6", "A5"],
        ["B5", "G6", "D6", "B5"], ["C6", "E6", "G6", "C7"],
    ]
    for bar, chord in enumerate(chords):
        base = bar * 4
        for pitch in chord:
            song.tone(base, pitch, 3.8, .06, "pad")
        for quarter, pitch in enumerate(fanfare[bar]):
            song.tone(base + quarter, pitch, .9, .16, "horn")
            song.tone(base + quarter, chord[quarter % 3], .68, .10)
            song.tone(base + quarter, chord[0], .75, .12, "bass")
            song.drum(base + quarter, "kick" if quarter % 2 == 0 else "clap", .08)
        for eighth in range(8):
            song.drum(base + eighth * .5, "hat", .025)
    return song


def retry() -> Song:
    song = Song(100, 8)
    chords = [("A3", "C4", "E4"), ("F3", "A3", "C4"),
              ("C4", "E4", "G4"), ("G3", "B3", "D4")] * 2
    melody = [
        ["E5", "C5", "A4", "C5"], ["F5", "E5", "C5", "A4"],
        ["G5", "E5", "C5", "E5"], ["D5", "B4", "G4", "B4"],
        ["E5", "A5", "C6", "A5"], ["F5", "A5", "C6", "A5"],
        ["G5", "E5", "G5", "C6"], ["B5", "G5", "D5", "G5"],
    ]
    for bar, chord in enumerate(chords):
        base = bar * 4
        for pitch in chord:
            song.tone(base, pitch, 3.85, .05, "pad")
        for quarter, pitch in enumerate(melody[bar]):
            song.tone(base + quarter, pitch, .92, .16, "bell")
            song.tone(base + quarter, chord[0], .7, .10, "bass")
            if quarter in (0, 2):
                song.drum(base + quarter, "kick", .045)
        for eighth in (1, 3, 5, 7):
            song.drum(base + eighth * .5, "hat", .015)
    return song


if __name__ == "__main__":
    title().export("infra-rush-title.mp3")
    victory().export("infra-rush-victory.mp3")
    retry().export("infra-rush-retry.mp3")
