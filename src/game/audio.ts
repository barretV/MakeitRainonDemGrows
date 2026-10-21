/**
 * Web Audio bed. Lost in Space plays over the islands. Sketchbook plays in the workshop.
 * Rain loops outdoor ambience (with a drip fallback). Growth notes walk a pentatonic scale
 * and each one is nudged a few cents, so a busy bottle stays soft instead of mechanical.
 */
export type MusicBed = 'field' | 'workshop';

export class AudioBus {
  muted = false;
  musicOn = false;
  private ctx: AudioContext | null = null;
  /** SFX and rain go here so the SFX toggle does not kill the music bed. */
  private sfxBus: GainNode | null = null;
  private rainGain: GainNode | null = null;
  private rainSrc: AudioBufferSourceNode | null = null;
  private rainLow: BiquadFilterNode | null = null;
  private rainHigh: BiquadFilterNode | null = null;
  private humOsc: OscillatorNode | null = null;
  private humGain: GainNode | null = null;
  private drops: AudioBuffer[] = [];
  private rainBed: AudioBuffer | null = null;
  private rainLoop: AudioBuffer | null = null;
  /** True when the bed is the wide outdoor loop, not the old drip recording. */
  private outdoorRain = false;
  private lastDrip = 0;
  private lastGrow = 0;
  /** Where the growth melody is standing on a two-octave pentatonic. */
  private degree = 4;
  private musicGain: GainNode | null = null;
  private musicTimer = 0;
  private beds: Record<MusicBed, AudioBuffer | null> = { field: null, workshop: null };
  private bed: MusicBed = 'field';
  private custom: AudioBuffer | null = null;
  private customNode: AudioBufferSourceNode | null = null;
  private placeholderOn = false;

  unlock(): void {
    this.context();
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.sfxBus) this.sfxBus.gain.value = muted ? 0 : 1;
    if (muted) this.rainStop();
  }

  toggleMusic(): void {
    this.musicOn = !this.musicOn;
    this.syncMusic();
  }

  /** Store a loop and start it if that scene is the one on screen. */
  setBed(which: MusicBed, buffer: AudioBuffer): void {
    this.beds[which] = buffer;
    if (this.bed === which) {
      this.custom = buffer;
      this.syncMusic();
    }
  }

  /** Switch between the island theme and the workshop theme. */
  useBed(which: MusicBed): void {
    this.bed = which;
    this.custom = this.beds[which];
    this.syncMusic();
  }

  /** Soft impact samples (ponds, etc.). Not used for the main rain shower loop. */
  setDrops(buffers: AudioBuffer[]): void {
    this.drops = buffers.filter((b) => b.length > 0);
  }

  setRainTexture(buffer: AudioBuffer, outdoor = true): void {
    this.rainBed = buffer;
    this.outdoorRain = outdoor;
    this.rainLoop = null;
    if (this.rainSrc) {
      this.rainStop();
      this.rainStart();
    }
  }

  rainStart(): void {
    if (this.muted || this.rainSrc) return;
    const ctx = this.context();
    if (!ctx) return;
    const recorded = this.prepareLoop();
    const buffer = recorded ?? this.wash(ctx);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    const high = ctx.createBiquadFilter();
    high.type = 'highpass';
    high.frequency.value = recorded ? (this.outdoorRain ? 80 : 140) : 280;
    high.Q.value = 0.6;
    const low = ctx.createBiquadFilter();
    low.type = 'lowpass';
    low.frequency.value = recorded ? (this.outdoorRain ? 9000 : 5200) : 1400;
    low.Q.value = 0.5;
    const gain = ctx.createGain();
    const now = ctx.currentTime;
    const level = recorded ? (this.outdoorRain ? 0.38 : 0.42) : 0.12;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(level, now + 0.65);
    src.connect(high);
    high.connect(low);
    low.connect(gain);
    gain.connect(this.sfxOut(ctx));
    src.start();
    this.rainSrc = src;
    this.rainHigh = high;
    this.rainLow = low;
    this.rainGain = gain;
  }

  rainStop(): void {
    try {
      this.rainSrc?.stop();
    } catch {
      /* already stopped */
    }
    this.rainSrc?.disconnect();
    this.rainHigh?.disconnect();
    this.rainLow?.disconnect();
    this.rainGain?.disconnect();
    this.rainSrc = null;
    this.rainHigh = null;
    this.rainLow = null;
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
    gain.connect(this.sfxOut(ctx));
    osc.start();
    this.humOsc = osc;
    this.humGain = gain;
  }

  zap(): void {
    this.tone({ type: 'square', from: 880, to: 140, dur: 0.16, gain: 0.05 });
  }

  splash(): void {
    const buf = this.longestDrop();
    if (!buf) {
      this.rainPatter(0.06, 1100 + Math.random() * 600, (Math.random() - 0.5) * 0.5, 0.08);
      return;
    }
    const semis = -6 - Math.random() * 4;
    this.playSample(buf, {
      rate: 2 ** (semis / 12),
      gain: 0.1,
      pan: (Math.random() - 0.5) * 0.5,
    });
  }

  drip(): void {
    if (this.muted) return;
    const ctx = this.context();
    if (!ctx) return;
    const now = ctx.currentTime;
    if (now - this.lastDrip < 0.05) return;
    this.lastDrip = now;
    if (this.outdoorRain || Math.random() < 0.72) {
      const center = 1800 + Math.random() * 3800;
      this.rainPatter(0.02 + Math.random() * 0.025, center, (Math.random() - 0.5) * 0.9);
      return;
    }
    const buf = this.shortDrop();
    if (!buf) {
      this.rainPatter(0.022, 2400, 0);
      return;
    }
    const semis = (Math.random() - Math.random()) * 5;
    this.playSample(buf, {
      rate: 2 ** (semis / 12),
      gain: 0.045 * (0.7 + Math.random() * 0.5),
      pan: (Math.random() - 0.5) * 1.2,
    });
  }

  grow(): void {
    if (this.muted) return;
    const ctx = this.context();
    if (!ctx) return;
    const now = ctx.currentTime;
    if (now - this.lastGrow < 0.18) return;
    this.lastGrow = now;
    this.pluck(this.nextNote(), 0.028 + Math.random() * 0.016);
  }

  restore(): void {
    this.grow();
  }

  crit(): void {
    this.tone({ type: 'square', from: 1180, to: 1760, dur: 0.09, gain: 0.028 });
    this.tone({ type: 'sine', from: 1760, to: 2100, dur: 0.12, gain: 0.018, delay: 0.03 });
  }

  bloomAward(): void {
    this.tone({ type: 'sine', from: 784, to: 784, dur: 0.16, gain: 0.04 });
    this.tone({ type: 'sine', from: 1046, to: 1046, dur: 0.2, gain: 0.032, delay: 0.07 });
    this.tone({ type: 'triangle', from: 1568, to: 1568, dur: 0.26, gain: 0.022, delay: 0.14 });
  }

  achievement(): void {
    this.tone({ type: 'triangle', from: 523, to: 523, dur: 0.13, gain: 0.045 });
    this.tone({ type: 'triangle', from: 659, to: 659, dur: 0.15, gain: 0.04, delay: 0.09 });
    this.tone({ type: 'triangle', from: 880, to: 880, dur: 0.2, gain: 0.035, delay: 0.18 });
    this.tone({ type: 'sine', from: 1318, to: 1318, dur: 0.3, gain: 0.02, delay: 0.27 });
  }

  milestone(step: number): void {
    const root = 392 * Math.pow(2, Math.min(4, step) / 12);
    this.tone({ type: 'sine', from: root, to: root, dur: 0.22, gain: 0.045 });
    this.tone({ type: 'sine', from: root * 1.5, to: root * 1.5, dur: 0.26, gain: 0.03, delay: 0.1 });
  }

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
    if (this.muted) return;
    const first = this.nextNote();
    this.pluck(first, 0.046);
    this.degree = Math.min(11, this.degree + 2);
    const cents = (Math.random() - 0.5) * 18;
    const second = this.noteAt(this.degree) * 2 ** (cents / 1200);
    this.pluck(second, 0.032, 0.12);
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
    this.sfxBus = null;
  }

  private context(): AudioContext | null {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.sfxBus = this.ctx.createGain();
      this.sfxBus.gain.value = this.muted ? 0 : 1;
      this.sfxBus.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  private sfxOut(ctx: AudioContext): AudioNode {
    return this.sfxBus ?? ctx.destination;
  }

  private tone(opts: {
    type: OscillatorType;
    from: number;
    to: number;
    dur: number;
    gain: number;
    delay?: number;
    /** Placeholder “music” while tracks load — not affected by SFX mute. */
    music?: boolean;
  }): void {
    if (this.muted && !opts.music) return;
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
    gain.connect(opts.music ? ctx.destination : this.sfxOut(ctx));
    osc.start(t);
    osc.stop(t + opts.dur + 0.02);
  }

  private nextNote(): number {
    const roll = Math.random();
    const hop = roll < 0.18 ? 0 : roll < 0.55 ? 1 : roll < 0.85 ? -1 : roll < 0.93 ? 2 : -2;
    this.degree += hop;
    if (this.degree < 0) this.degree = -this.degree;
    if (this.degree > 11) this.degree = 22 - this.degree;
    this.degree = Math.max(0, Math.min(11, this.degree));
    const cents = (Math.random() - 0.5) * 22;
    return this.noteAt(this.degree) * 2 ** (cents / 1200);
  }

  private noteAt(degree: number): number {
    const scale = [0, 2, 4, 7, 9];
    const oct = Math.floor(degree / 5);
    const semis = oct * 12 + (scale[degree % 5] ?? 0);
    return 196 * 2 ** (semis / 12);
  }

  private pluck(freq: number, volume: number, delay = 0): void {
    if (this.muted) return;
    const ctx = this.context();
    if (!ctx) return;
    const t = ctx.currentTime + delay;
    const dur = 0.46;
    const pan = ctx.createStereoPanner();
    pan.pan.value = (Math.random() - 0.5) * 0.65;
    const master = ctx.createGain();
    master.gain.setValueAtTime(0.0001, t);
    master.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), t + 0.014);
    master.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    pan.connect(master);
    master.connect(this.sfxOut(ctx));
    const partials: Array<[number, number, OscillatorType]> = [
      [freq, 1, 'sine'],
      [freq * 2, 0.22, 'sine'],
      [freq * 3, 0.05, 'triangle'],
    ];
    for (const [f, amp, type] of partials) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(f, t);
      gain.gain.value = amp;
      osc.connect(gain);
      gain.connect(pan);
      osc.start(t);
      osc.stop(t + dur + 0.02);
    }
    this.tap(t, volume * 0.4, pan);
  }

  private tap(when: number, volume: number, dest: AudioNode): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const length = Math.floor(ctx.sampleRate * 0.018);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1400;
    filter.Q.value = 0.8;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, when);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.02);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(dest);
    src.start(when);
    src.stop(when + 0.03);
  }

  private playSample(buffer: AudioBuffer, opts: { rate: number; gain: number; pan: number }): void {
    if (this.muted) return;
    const ctx = this.context();
    if (!ctx) return;
    const rate = Math.max(0.4, opts.rate);
    const dur = buffer.duration / rate;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.playbackRate.value = rate;
    const pan = ctx.createStereoPanner();
    pan.pan.value = Math.max(-1, Math.min(1, opts.pan));
    const gain = ctx.createGain();
    const now = ctx.currentTime;
    gain.gain.setValueAtTime(opts.gain, now);
    const fadeAt = now + Math.max(0.02, dur - 0.04);
    gain.gain.setValueAtTime(opts.gain, fadeAt);
    gain.gain.exponentialRampToValueAtTime(0.0001, fadeAt + 0.04);
    src.connect(pan);
    pan.connect(gain);
    gain.connect(this.sfxOut(ctx));
    src.start(now);
    src.stop(now + dur + 0.05);
  }

  private shortDrop(): AudioBuffer | null {
    if (this.drops.length === 0) return null;
    const longest = this.longestDrop();
    const shorts = this.drops.filter((b) => b !== longest);
    const pool = shorts.length > 0 ? shorts : this.drops;
    return pool[Math.floor(Math.random() * pool.length)] ?? null;
  }

  private longestDrop(): AudioBuffer | null {
    let best: AudioBuffer | null = null;
    for (const drop of this.drops) {
      if (!best || drop.duration > best.duration) best = drop;
    }
    return best;
  }

  private prepareLoop(): AudioBuffer | null {
    if (!this.rainBed) return null;
    if (this.rainLoop) return this.rainLoop;
    const ctx = this.context();
    if (!ctx) return this.rainBed;
    const fade = Math.min(Math.floor(this.rainBed.sampleRate * 0.1), Math.floor(this.rainBed.length / 4));
    const length = this.rainBed.length - fade;
    if (length < fade) return this.rainBed;
    const out = ctx.createBuffer(this.rainBed.numberOfChannels, length, this.rainBed.sampleRate);
    for (let c = 0; c < this.rainBed.numberOfChannels; c += 1) {
      const src = this.rainBed.getChannelData(c);
      const dst = out.getChannelData(c);
      dst.set(src.subarray(0, length));
      for (let i = 0; i < fade; i += 1) {
        const t = i / fade;
        dst[i] = (src[i] ?? 0) * t + (src[length + i] ?? 0) * (1 - t);
      }
    }
    this.rainLoop = out;
    return out;
  }

  private wash(ctx: AudioContext): AudioBuffer {
    const seconds = 2;
    const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let pink = 0;
    for (let i = 0; i < data.length; i += 1) {
      pink = pink * 0.96 + (Math.random() * 2 - 1) * 0.04;
      data[i] = pink;
    }
    return buffer;
  }

  private rainPatter(volume: number, centerFreq: number, pan: number, durBase = 0.028): void {
    const ctx = this.context();
    if (!ctx || this.muted) return;
    const dur = durBase + Math.random() * 0.04;
    const length = Math.floor(ctx.sampleRate * dur);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let pink = 0;
    for (let i = 0; i < data.length; i += 1) {
      pink = pink * 0.92 + (Math.random() * 2 - 1) * 0.08;
      const env = 1 - i / data.length;
      data[i] = pink * env * env;
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = centerFreq;
    filter.Q.value = 0.65;
    const panner = ctx.createStereoPanner();
    panner.pan.value = Math.max(-1, Math.min(1, pan));
    const gain = ctx.createGain();
    const now = ctx.currentTime;
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    src.connect(filter);
    filter.connect(panner);
    panner.connect(gain);
    gain.connect(this.sfxOut(ctx));
    src.start(now);
    src.stop(now + dur + 0.02);
  }

  private syncMusic(): void {
    window.clearInterval(this.musicTimer);
    this.musicTimer = 0;
    this.stopCustom();
    this.placeholderOn = false;
    if (!this.musicOn) return;
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
    this.tone({ type: 'sine', from: root, to: root, dur: 1.3, gain: 0.018, music: true });
    this.tone({ type: 'triangle', from: root * 1.5, to: root * 1.5, dur: 1.1, gain: 0.01, music: true });
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
