/**
 * Tiny Web Audio bed. Drop a real track in later with attachMusic().
 * Until then the music toggle plays a soft pentatonic placeholder.
 */
export class AudioBus {
  muted = false;
  musicOn = false;
  private ctx: AudioContext | null = null;
  private rainGain: GainNode | null = null;
  private rainSrc: AudioBufferSourceNode | null = null;
  private humOsc: OscillatorNode | null = null;
  private humGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private musicTimer = 0;
  private custom: AudioBuffer | null = null;
  private customNode: AudioBufferSourceNode | null = null;
  private placeholderOn = false;

  unlock(): void {
    this.context();
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (muted) this.rainStop();
    this.syncMusic();
  }

  toggleMusic(): void {
    this.musicOn = !this.musicOn;
    this.syncMusic();
  }

  /** Replace the placeholder bed. Pass null to go back to the soft synth. */
  attachMusic(buffer: AudioBuffer | null): void {
    this.custom = buffer;
    this.syncMusic();
  }

  rainStart(): void {
    if (this.muted || this.rainSrc) return;
    const ctx = this.context();
    if (!ctx) return;
    const seconds = 1;
    const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1400;
    filter.Q.value = 0.7;
    const gain = ctx.createGain();
    gain.gain.value = 0.035;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start();
    this.rainSrc = src;
    this.rainGain = gain;
  }

  rainStop(): void {
    this.rainSrc?.stop();
    this.rainSrc?.disconnect();
    this.rainGain?.disconnect();
    this.rainSrc = null;
    this.rainGain = null;
    this.setRainHum(false);
  }

  /** Low drone layered on rain (petal shop). */
  setRainHum(on: boolean): void {
    if (this.muted) on = false;
    if (on && this.humOsc) return;
    if (!on) {
      this.humOsc?.stop();
      this.humOsc?.disconnect();
      this.humGain?.disconnect();
      this.humOsc = null;
      this.humGain = null;
      return;
    }
    const ctx = this.context();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 110;
    const gain = ctx.createGain();
    gain.gain.value = 0.012;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    this.humOsc = osc;
    this.humGain = gain;
  }

  zap(): void {
    this.tone({ type: 'square', from: 880, to: 140, dur: 0.16, gain: 0.05 });
  }

  splash(): void {
    this.noise(0.18, 700, 0.06);
  }

  /** A drop hitting the ground: tiny, soft and very short. */
  drip(): void {
    this.noise(0.06, 1800, 0.022);
  }

  private lastRestore = 0;

  /**
   * A patch coming back to life. Called for every finished cell, so it rate
   * limits itself and drifts its pitch, so a busy bottle sounds like rain on
   * leaves rather than a machine gun.
   */
  restore(): void {
    if (this.muted) return;
    const ctx = this.context();
    if (!ctx) return;
    const now = ctx.currentTime;
    if (now - this.lastRestore < 0.11) return;
    this.lastRestore = now;
    const step = 620 + Math.random() * 260;
    this.tone({ type: 'triangle', from: step, to: step * 1.5, dur: 0.07, gain: 0.016 });
  }

  /** A crit: brighter and a little louder than a normal restore. */
  crit(): void {
    this.tone({ type: 'square', from: 1180, to: 1760, dur: 0.09, gain: 0.028 });
    this.tone({ type: 'sine', from: 1760, to: 2100, dur: 0.12, gain: 0.018, delay: 0.03 });
  }

  /** A rare bloom opening up. */
  bloomAward(): void {
    this.tone({ type: 'sine', from: 784, to: 784, dur: 0.16, gain: 0.04 });
    this.tone({ type: 'sine', from: 1046, to: 1046, dur: 0.2, gain: 0.032, delay: 0.07 });
    this.tone({ type: 'triangle', from: 1568, to: 1568, dur: 0.26, gain: 0.022, delay: 0.14 });
  }

  /** An achievement paying out. */
  achievement(): void {
    this.tone({ type: 'triangle', from: 523, to: 523, dur: 0.13, gain: 0.045 });
    this.tone({ type: 'triangle', from: 659, to: 659, dur: 0.15, gain: 0.04, delay: 0.09 });
    this.tone({ type: 'triangle', from: 880, to: 880, dur: 0.2, gain: 0.035, delay: 0.18 });
    this.tone({ type: 'sine', from: 1318, to: 1318, dur: 0.3, gain: 0.02, delay: 0.27 });
  }

  /** A revival milestone: the pitch climbs with the island's progress. */
  milestone(step: number): void {
    const root = 392 * Math.pow(2, Math.min(4, step) / 12);
    this.tone({ type: 'sine', from: root, to: root, dur: 0.22, gain: 0.045 });
    this.tone({ type: 'sine', from: root * 1.5, to: root * 1.5, dur: 0.26, gain: 0.03, delay: 0.1 });
  }

  /** Menu feedback. */
  ui(): void {
    this.tone({ type: 'square', from: 540, to: 380, dur: 0.05, gain: 0.018 });
  }

  chime(): void {
    this.tone({ type: 'sine', from: 523, to: 523, dur: 0.12, gain: 0.05 });
    this.tone({ type: 'sine', from: 659, to: 659, dur: 0.14, gain: 0.045, delay: 0.08 });
    this.tone({ type: 'sine', from: 784, to: 784, dur: 0.18, gain: 0.04, delay: 0.16 });
  }

  coin(): void {
    this.tone({ type: 'square', from: 880, to: 1320, dur: 0.09, gain: 0.03 });
  }

  bloom(): void {
    this.tone({ type: 'triangle', from: 440, to: 880, dur: 0.18, gain: 0.04 });
  }

  victory(): void {
    this.chime();
    this.tone({ type: 'sine', from: 392, to: 523, dur: 0.22, gain: 0.05, delay: 0.22 });
    this.tone({ type: 'triangle', from: 523, to: 784, dur: 0.28, gain: 0.045, delay: 0.38 });
    this.tone({ type: 'sine', from: 659, to: 988, dur: 0.42, gain: 0.04, delay: 0.55 });
  }

  dispose(): void {
    this.rainStop();
    this.stopCustom();
    this.placeholderOn = false;
    window.clearInterval(this.musicTimer);
    void this.ctx?.close();
    this.ctx = null;
  }

  private context(): AudioContext | null {
    if (this.muted && !this.ctx) return null;
    if (!this.ctx) this.ctx = new AudioContext();
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  private tone(opts: {
    type: OscillatorType;
    from: number;
    to: number;
    dur: number;
    gain: number;
    delay?: number;
  }): void {
    if (this.muted) return;
    const ctx = this.context();
    if (!ctx) return;
    const t = ctx.currentTime + (opts.delay ?? 0);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = opts.type;
    osc.frequency.setValueAtTime(opts.from, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, opts.to), t + opts.dur);
    gain.gain.setValueAtTime(opts.gain, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + opts.dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + opts.dur + 0.02);
  }

  private noise(dur: number, freq: number, volume: number): void {
    if (this.muted) return;
    const ctx = this.context();
    if (!ctx) return;
    const length = Math.floor(ctx.sampleRate * dur);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start();
  }

  private syncMusic(): void {
    window.clearInterval(this.musicTimer);
    this.musicTimer = 0;
    this.stopCustom();
    this.placeholderOn = false;
    if (!this.musicOn || this.muted) return;
    if (this.custom) {
      this.playCustom();
      return;
    }
    this.placeholderOn = true;
    this.playChord();
    this.musicTimer = window.setInterval(() => {
      if (this.placeholderOn) this.playChord();
    }, 1600);
  }

  private playChord(): void {
    const notes = [196, 247, 294, 330, 392];
    const root = notes[Math.floor(Math.random() * notes.length)] ?? 247;
    this.tone({ type: 'sine', from: root, to: root, dur: 1.3, gain: 0.018 });
    this.tone({ type: 'triangle', from: root * 1.5, to: root * 1.5, dur: 1.1, gain: 0.01 });
  }

  private playCustom(): void {
    const ctx = this.context();
    if (!ctx || !this.custom) return;
    const src = ctx.createBufferSource();
    src.buffer = this.custom;
    src.loop = true;
    const gain = ctx.createGain();
    gain.gain.value = 0.2;
    src.connect(gain);
    gain.connect(ctx.destination);
    src.start();
    this.customNode = src;
    this.musicGain = gain;
  }

  private stopCustom(): void {
    this.customNode?.stop();
    this.customNode?.disconnect();
    this.musicGain?.disconnect();
    this.customNode = null;
    this.musicGain = null;
  }
}
