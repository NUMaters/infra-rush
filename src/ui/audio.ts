export class Sound {
  private ctx: AudioContext | null = null;
  private music: HTMLAudioElement | null = null;
  private musicGain: GainNode | null = null;
  private isMuted = false;
  get muted() {
    return this.isMuted;
  }
  set muted(value: boolean) {
    this.isMuted = value;
    if (this.musicGain) this.musicGain.gain.value = value ? 0 : 0.23;
  }
  unlock() {
    this.ctx ??= new AudioContext();
    void this.ctx.resume();
  }
  startMusic() {
    this.unlock();
    if (!this.music) {
      const music = new Audio(
        new URL(
          `${import.meta.env.BASE_URL}audio/infra-rush-loop.mp3`,
          document.baseURI,
        ).href,
      );
      music.preload = "auto";
      music.loop = true;
      music.id = "bgm";
      music.hidden = true;
      document.body.append(music);
      const gain = this.ctx!.createGain();
      gain.gain.value = this.isMuted ? 0 : 0.23;
      this.ctx!.createMediaElementSource(music).connect(gain);
      gain.connect(this.ctx!.destination);
      this.music = music;
      this.musicGain = gain;
    }
    this.music.currentTime = 0;
    void this.music.play().catch(() => {
      // The user can retry by resuming the game or toggling audio.
    });
  }
  pauseMusic() {
    this.music?.pause();
  }
  resumeMusic() {
    if (!this.music || !this.music.paused) return;
    this.unlock();
    void this.music.play().catch(() => {
      // Keep gameplay usable when the browser declines playback.
    });
  }
  stopMusic() {
    this.music?.pause();
    if (this.music) this.music.currentTime = 0;
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
    } else if (kind === "warning") {
      note(440, 0, 0.2);
      note(440, 0.3, 0.2);
    } else note(740, 0, 0.1, "triangle", 0.04);
  }
}
