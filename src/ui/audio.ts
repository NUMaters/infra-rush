export type MusicScene = "title" | "game" | "victory" | "retry";

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
  play(kind: string) {
    if (this.isMuted || !this.ctx) return;
    const c = this.ctx,
      t = c.currentTime;
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
