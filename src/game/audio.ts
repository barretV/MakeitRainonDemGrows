/**
 * Web Audio bed. Lost in Space plays over the islands. Sketchbook plays in the workshop.
 * Rain is a steady procedural shower while you pour. Growth notes walk a pentatonic scale
 * and each one is nudged a few cents, so a busy bottle stays soft instead of mechanical.
 */
export type MusicBed = 'field' | 'workshop';

export class AudioBus {
  muted = false;
  musicOn = false;
  /** How loud the effects are, 0 to 1. */
  sfxVolume = 1;
  /** How loud the music bed is, 0 to 1. */
  musicVolume = 1;
  private ctx: AudioContext | null = null;
  /** SFX and rain go here so the SFX toggle does not kill the music bed. */
  private sfxBus: GainNode | null = null;
  /** The music bed and the placeholder chords go here. */
  private musicBus: GainNode | null = null;
  private rainGain: GainNode | null = null;
  private rainSrc: AudioBufferSourceNode | null = null;
  private rainBedSrc: AudioBufferSourceNode | null = null;
  private rainBedGain: GainNode | null = null;
  private rainLow: BiquadFilterNode | null = null;
  private rainHigh: BiquadFilterNode | null = null;
  private humOsc: OscillatorNode | null = null;
  private humGain: GainNode | null = null;
  private drops: AudioBuffer[] = [];
  private rainBed: AudioBuffer | null = null;
  private rainLoop: AudioBuffer | null = null;
  private rainShower: AudioBuffer | null = null;
  private lastRestore = 0;
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
    if (this.sfxBus) this.sfxBus.gain.value = muted ? 0 : this.sfxVolume;
    if (muted) this.rainStop();
  }

  /** The effects volume, 0 to 1. */
  setSfxVolume(volume: number): void {
    this.sfxVolume = Math.max(0, Math.min(1, volume));
    if (this.sfxBus) this.sfxBus.gain.value = this.muted ? 0 : this.sfxVolume;
  }

  /** The music volume, 0 to 1. */
  setMusicVolume(volume: number): void {
    this.musicVolume = Math.max(0, Math.min(1, volume));
    if (this.musicBus) this.musicBus.gain.value = this.musicVolume;
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

  /** Optional recorded bed mixed quietly under the procedural shower. */
  setRainTexture(buffer: AudioBuffer): void {
    this.rainBed = buffer;
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
    const shower = this.rainShower ?? this.buildRainShower(ctx);
    const src = ctx.createBufferSource();
    src.buffer = shower;
    src.loop = true;
    const high = ctx.createBiquadFilter();
    high.type = 'highpass';
    high.frequency.value = 140;
    high.Q.value = 0.55;
    const low = ctx.createBiquadFilter();
    low.type = 'lowpass';
    low.frequency.value = 7200;
    low.Q.value = 0.45;
    const gain = ctx.createGain();
    const now = ctx.currentTime;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.13, now + 0.45);
    src.connect(high);
    high.connect(low);
    low.connect(gain);
    const dest = this.sfxOut(ctx);
    gain.connect(dest);
    src.start();
    this.rainSrc = src;
    this.rainHigh = high;
    this.rainLow = low;
    this.rainGain = gain;

    const bed = this.prepareLoop();
    if (bed) {
      const bedSrc = ctx.createBufferSource();
      bedSrc.buffer = bed;
      bedSrc.loop = true;
      const bedGain = ctx.createGain();
      bedGain.gain.value = 0.04;
      bedSrc.connect(bedGain);
      bedGain.connect(dest);
      bedSrc.start();
      this.rainBedSrc = bedSrc;
      this.rainBedGain = bedGain;
    }
  }

  rainStop(): void {
    try {
      this.rainSrc?.stop();
      this.rainBedSrc?.stop();
    } catch {
      /* already stopped */
    }
    this.rainSrc?.disconnect();
    this.rainBedSrc?.disconnect();
    this.rainBedGain?.disconnect();
    this.rainHigh?.disconnect();
    this.rainLow?.disconnect();
    this.rainGain?.disconnect();
    this.rainSrc = null;
    this.rainBedSrc = null;
    this.rainBedGain = null;
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

  grow(): void {
    if (this.muted) return;
    const ctx = this.context();
    if (!ctx) return;
    const now = ctx.currentTime;
    if (now - this.lastGrow < 0.16) return;
    this.lastGrow = now;
    this.pluck(this.nextNote(), 0.022 + Math.random() * 0.012);
  }

  /** A mask cell just finished greening — brighter than mid-growth pings. */
  restore(): void {
    if (this.muted) return;
    const ctx = this.context();
    if (!ctx) return;
    const now = ctx.currentTime;
    if (now - this.lastRestore < 0.085) return;
    this.lastRestore = now;
    const root = this.nextNote();
    const pan = (Math.random() - 0.5) * 0.75;
    this.pluck(root, 0.042, 0, pan);
    this.tone({
      type: 'sine',
      from: root * 1.5,
      to: root * 2.02,
      dur: 0.2,
      gain: 0.034,
      delay: 0.05,
      pan,
    });
    this.tone({
      type: 'triangle',
      from: root * 2.4,
      to: root * 2.85,
      dur: 0.24,
      gain: 0.022,
      delay: 0.1,
      pan,
    });
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
      this.sfxBus.gain.value = this.muted ? 0 : this.sfxVolume;
      this.sfxBus.connect(this.ctx.destination);
      this.musicBus = this.ctx.createGain();
      this.musicBus.gain.value = this.musicVolume;
      this.musicBus.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  private sfxOut(ctx: AudioContext): AudioNode {
    return this.sfxBus ?? ctx.destination;
  }

  private musicOut(ctx: AudioContext): AudioNode {
    return this.musicBus ?? ctx.destination;
  }

  private tone(opts: {
    type: OscillatorType;
    from: number;
    to: number;
    dur: number;
    gain: number;
    delay?: number;
    pan?: number;
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
    const out = opts.music ? this.musicOut(ctx) : this.sfxOut(ctx);
    if (opts.pan !== undefined && !opts.music) {
      const panner = ctx.createStereoPanner();
      panner.pan.value = Math.max(-1, Math.min(1, opts.pan));
      gain.connect(panner);
      panner.connect(out);
    } else {
      gain.connect(out);
    }
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

  private pluck(freq: number, volume: number, delay = 0, panValue?: number): void {
    if (this.muted) return;
    const ctx = this.context();
    if (!ctx) return;
    const t = ctx.currentTime + delay;
    const dur = 0.46;
    const pan = ctx.createStereoPanner();
    pan.pan.value = panValue ?? (Math.random() - 0.5) * 0.65;
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

  /** Seamless shower loop: pink noise + gentle hiss, no faucet drips. */
  private buildRainShower(ctx: AudioContext): AudioBuffer {
    const sr = ctx.sampleRate;
    const rawSeconds = 5;
    const rawLen = Math.floor(sr * rawSeconds);
    const fade = Math.floor(sr * 0.2);
    const loopLen = rawLen - fade;
    if (loopLen < fade * 2) {
      const fallback = ctx.createBuffer(2, rawLen, sr);
      this.rainShower = fallback;
      return fallback;
    }
    const raw = ctx.createBuffer(2, rawLen, sr);
    const out = ctx.createBuffer(2, loopLen, sr);
    const wobbleCycles = 4;
    for (let ch = 0; ch < 2; ch += 1) {
      const src = raw.getChannelData(ch);
      let b0 = 0;
      let b1 = 0;
      let b2 = 0;
      let b3 = 0;
      let b4 = 0;
      let b5 = 0;
      let b6 = 0;
      for (let i = 0; i < rawLen; i += 1) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.969 * b2 + white * 0.153852;
        b3 = 0.8665 * b3 + white * 0.3104856;
        b4 = 0.55 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.016898;
        const pink = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
        b6 = white * 0.115926;
        const hiss = (Math.random() * 2 - 1) * 0.014;
        const phase = (Math.PI * 2 * wobbleCycles * i) / loopLen;
        const wobble = 0.9 + 0.1 * Math.sin(phase + ch * 0.35);
        src[i] = (pink * 0.82 + hiss) * wobble;
      }
      const dst = out.getChannelData(ch);
      dst.set(src.subarray(0, loopLen));
      for (let i = 0; i < fade; i += 1) {
        const t = i / fade;
        dst[i] = (src[i] ?? 0) * t + (src[loopLen + i] ?? 0) * (1 - t);
      }
    }
    this.rainShower = out;
    return out;
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
    gain.connect(this.musicOut(ctx));
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
