export type MusicScene = "title" | "game" | "victory" | "retry";
export type WorkSound = "mine" | "build" | "embank" | "clear" | "destroy";

const workIntervals: Record<WorkSound, number> = {
  mine: 1.25,
  build: 1.05,
  embank: 1.35,
  clear: 1.25,
  destroy: 0.62,
};
const workPriority: WorkSound[] = [
  "destroy",
  "build",
  "embank",
  "clear",
  "mine",
];

const musicFiles: Record<MusicScene, string> = {
  title: "infra-rush-title.mp3",
  game: "infra-rush-loop.mp3",
  victory: "infra-rush-victory.mp3",
  retry: "infra-rush-retry.mp3",
};
const musicVolume: Record<MusicScene, number> = {
  title: 0.19,
  game: 0.23,
  victory: 0.19,
  retry: 0.18,
};

export class Sound {
  private ctx: AudioContext | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private workSound: WorkSound | null = null;
  private nextWorkAt = 0;
  private workPulse = 0;
  private lastResourceAt = -Infinity;
  private tracks = new Map<
    MusicScene,
    { music: HTMLAudioElement; gain: GainNode }
  >();
  private scene: MusicScene | null = null;
  private isMuted = false;
  get muted() {
    return this.isMuted;
  }
  set muted(value: boolean) {
    this.isMuted = value;
    if (value) this.workSound = null;
    const now = this.ctx?.currentTime ?? 0;
    for (const [scene, track] of this.tracks) {
      track.gain.gain.cancelScheduledValues(now);
      track.gain.gain.setTargetAtTime(
        value || scene !== this.scene ? 0 : musicVolume[scene],
        now,
        0.06,
      );
    }
  }
  unlock() {
    this.ctx ??= new AudioContext();
    void this.ctx.resume();
  }
  private track(scene: MusicScene) {
    this.unlock();
    const existing = this.tracks.get(scene);
    if (existing) return existing;
    const music = new Audio(
      new URL(
        `${import.meta.env.BASE_URL}audio/${musicFiles[scene]}`,
        document.baseURI,
      ).href,
    );
    music.preload = "auto";
    music.loop = true;
    music.id = scene === "game" ? "bgm" : `bgm-${scene}`;
    music.hidden = true;
    document.body.append(music);
    const gain = this.ctx!.createGain();
    gain.gain.value = 0;
    this.ctx!.createMediaElementSource(music).connect(gain);
    gain.connect(this.ctx!.destination);
    const track = { music, gain };
    this.tracks.set(scene, track);
    return track;
  }
  setMusicScene(scene: MusicScene) {
    if (this.scene === scene) {
      this.resumeMusic();
      return;
    }
    const previous = this.scene;
    const oldTrack = previous ? this.tracks.get(previous) : null;
    const next = this.track(scene);
    const now = this.ctx!.currentTime;
    this.scene = scene;
    if (oldTrack) {
      oldTrack.gain.gain.cancelScheduledValues(now);
      oldTrack.gain.gain.setTargetAtTime(0, now, 0.09);
      setTimeout(() => {
        if (this.scene !== previous) {
          oldTrack.music.pause();
          oldTrack.music.currentTime = 0;
        }
      }, 450);
    }
    next.gain.gain.cancelScheduledValues(now);
    next.gain.gain.setValueAtTime(0, now);
    next.gain.gain.setTargetAtTime(
      this.isMuted ? 0 : musicVolume[scene],
      now,
      0.12,
    );
    next.music.currentTime = 0;
    void next.music.play().catch(() => {
      // Browsers may wait for the first tap before allowing title music.
    });
  }
  pauseMusic() {
    if (this.scene) this.tracks.get(this.scene)?.music.pause();
  }
  resumeMusic() {
    if (!this.scene) return;
    const music = this.tracks.get(this.scene)?.music;
    if (!music || !music.paused) return;
    this.unlock();
    void music.play().catch(() => {
      // Keep the screen usable when the browser declines autoplay.
    });
  }
  stopMusic() {
    for (const track of this.tracks.values()) {
      track.music.pause();
      track.music.currentTime = 0;
      track.gain.gain.value = 0;
    }
    this.scene = null;
  }
  updateWork(active: readonly WorkSound[], enabled: boolean) {
    if (!enabled || this.isMuted || !this.ctx || this.ctx.state !== "running") {
      this.workSound = null;
      return;
    }
    const kind =
      workPriority.find((candidate) => active.includes(candidate)) ?? null;
    if (!kind) {
      this.workSound = null;
      return;
    }
    const now = this.ctx.currentTime;
    if (kind !== this.workSound) {
      this.workSound = kind;
      this.nextWorkAt = now;
    }
    if (now >= this.nextWorkAt) {
      this.play(kind);
      this.nextWorkAt = now + workIntervals[kind];
    }
  }
  private noise() {
    if (this.noiseBuffer) return this.noiseBuffer;
    const c = this.ctx!;
    const buffer = c.createBuffer(
      1,
      Math.round(c.sampleRate * 0.6),
      c.sampleRate,
    );
    const samples = buffer.getChannelData(0);
    let seed = 0x1f4a7;
    for (let i = 0; i < samples.length; i++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      samples[i] = (seed / 2147483648 - 1) * 0.7;
    }
    this.noiseBuffer = buffer;
    return buffer;
  }
  play(kind: string) {
    if (this.isMuted || !this.ctx) return;
    const c = this.ctx,
      t = c.currentTime;
    if (kind === "resource") {
      if (t - this.lastResourceAt < 0.22) return;
      this.lastResourceAt = t;
    }
    const variation =
      kind in workIntervals ? [0.97, 1, 1.035][this.workPulse++ % 3] : 1;
    const note = (
      f: number,
      time: number,
      duration: number,
      type: OscillatorType = "sine",
      volume = 0.05,
    ) => {
      const o = c.createOscillator(),
        g = c.createGain();
      o.type = type;
      o.frequency.setValueAtTime(f, t + time);
      if (kind === "return")
        o.frequency.exponentialRampToValueAtTime(f * 3, t + time + duration);
      g.gain.setValueAtTime(0.0001, t + time);
      g.gain.exponentialRampToValueAtTime(volume, t + time + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t + time + duration);
      o.connect(g);
      g.connect(c.destination);
      o.start(t + time);
      o.stop(t + time + duration);
    };
    const scrape = (
      time: number,
      duration: number,
      frequency: number,
      volume: number,
    ) => {
      const source = c.createBufferSource();
      const filter = c.createBiquadFilter();
      const gain = c.createGain();
      source.buffer = this.noise();
      source.playbackRate.value = variation;
      filter.type = "bandpass";
      filter.frequency.setValueAtTime(frequency, t + time);
      filter.frequency.exponentialRampToValueAtTime(
        Math.max(80, frequency * 0.58),
        t + time + duration,
      );
      filter.Q.value = 0.7;
      gain.gain.setValueAtTime(0.0001, t + time);
      gain.gain.exponentialRampToValueAtTime(volume, t + time + 0.018);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + time + duration);
      source.connect(filter);
      filter.connect(gain);
      gain.connect(c.destination);
      source.start(t + time);
      source.stop(t + time + duration);
    };
    if (kind === "complete" || kind === "end") {
      [523, 659, 784, 1046].forEach((f, i) =>
        note(f, i * 0.075, 0.25, "triangle", 0.055),
      );
    } else if (kind === "attack") {
      note(100, 0, 0.2, "triangle", 0.13);
      note(60, 0.03, 0.3, "sine", 0.13);
      note(440, 0.1, 0.12);
    } else if (kind === "earthquake" || kind === "collapse") {
      [45, 53, 70].forEach((f, i) => note(f, i * 0.13, 0.7, "sawtooth", 0.035));
    } else if (kind === "mine") {
      scrape(0, 0.23, 720, 0.055);
      note(170 * variation, 0.02, 0.13, "triangle", 0.047);
      note(890 * variation, 0.18, 0.12, "sine", 0.023);
    } else if (kind === "build") {
      scrape(0, 0.08, 2500, 0.035);
      note(760 * variation, 0.015, 0.17, "triangle", 0.038);
      note(1140 * variation, 0.04, 0.18, "sine", 0.021);
      note(980 * variation, 0.15, 0.12, "triangle", 0.02);
    } else if (kind === "destroy") {
      scrape(0, 0.34, 920, 0.085);
      note(105 * variation, 0, 0.26, "sawtooth", 0.038);
      note(145 * variation, 0.1, 0.11, "triangle", 0.028);
    } else if (kind === "embank") {
      scrape(0, 0.27, 340, 0.05);
      note(115 * variation, 0, 0.24, "triangle", 0.043);
      note(175 * variation, 0.16, 0.11, "triangle", 0.025);
    } else if (kind === "clear") {
      scrape(0, 0.31, 1150, 0.052);
      note(270 * variation, 0.06, 0.15, "triangle", 0.027);
    } else if (kind === "return") note(220, 0, 0.18, "sine", 0.025);
    else if (kind === "resource") note(1000, 0, 0.07, "sine", 0.012);
    else if (kind === "select") {
      note(660, 0, 0.09);
      note(880, 0.045, 0.08);
    } else if (kind === "ui") {
      note(480, 0, 0.07, "triangle", 0.025);
      note(720, 0.055, 0.08, "sine", 0.018);
    } else if (kind === "warning") {
      note(440, 0, 0.2);
      note(440, 0.3, 0.2);
    } else note(740, 0, 0.1, "triangle", 0.04);
  }
}
