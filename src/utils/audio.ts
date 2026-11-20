function clampUnit(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

const PENTATONIC_MELODY_HZ = [
  523.25, // C5
  587.33, // D5
  659.25, // E5
  783.99, // G5
  880.0,  // A5
  659.25, // E5
  587.33, // D5
  523.25, // C5
  440.0,  // A4
  523.25, // C5
  587.33, // D5
  659.25, // E5
  783.99, // G5
  659.25, // E5
  587.33, // D5
  392.0,  // G4
];

const BASS_PATTERN_HZ = [
  130.81, // C3
  130.81,
  164.81, // E3
  196.0,  // G3
  110.0,  // A2
  110.0,
  146.83, // D3
  196.0,  // G3
];

class ProceduralAudioEngine {
  private ctx: AudioContext | null = null;
  private muted = false;
  private bgmVolume = 0.45;
  private sfxVolume = 0.75;

  private bgmTimerId: number | null = null;
  private bgmStep = 0;
  private bgmMasterGain: GainNode | null = null;
  private bgmFilter: BiquadFilterNode | null = null;

  private steamSource: AudioBufferSourceNode | null = null;
  private steamGain: GainNode | null = null;
  private steamActive = false;
  private steamIntensity = 0.65;

  public setMuted(muted: boolean) {
    this.muted = muted;
    this.syncAudioNodes();
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public setBgmVolume(volume: number) {
    this.bgmVolume = clampUnit(volume);
    this.syncAudioNodes();
  }

  public getBgmVolume(): number {
    return this.bgmVolume;
  }

  public setSfxVolume(volume: number) {
    this.sfxVolume = clampUnit(volume);
    this.syncAudioNodes();
  }

  public getSfxVolume(): number {
    return this.sfxVolume;
  }

  public isBgmPlaying(): boolean {
    return this.bgmTimerId !== null;
  }

  private getContext(allowWhenMuted = false): AudioContext | null {
    if ((!allowWhenMuted && this.muted) || typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      try {
        this.ctx = new AudioCtx();
      } catch {
        return null;
      }
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private syncAudioNodes() {
    if (this.bgmMasterGain && this.ctx) {
      const targetGain = this.muted ? 0.0001 : Math.max(0.0001, this.bgmVolume * 0.22);
      try {
        this.bgmMasterGain.gain.setTargetAtTime(targetGain, this.ctx.currentTime, 0.05);
      } catch {
        // ignore in mocked environments
      }
    }
    if (this.steamGain && this.ctx) {
      const targetSteam =
        this.muted || !this.steamActive || this.sfxVolume <= 0
          ? 0.0001
          : Math.max(0.0001, this.sfxVolume * this.steamIntensity * 0.045);
      try {
        this.steamGain.gain.setTargetAtTime(targetSteam, this.ctx.currentTime, 0.08);
      } catch {
        // ignore
      }
    }
    if (this.muted && this.steamActive) {
      this.teardownSteamNodes();
    }
  }

  private ensureBgmBus(ctx: AudioContext): AudioNode | null {
    try {
      if (!this.bgmMasterGain || !this.bgmFilter) {
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1350, ctx.currentTime);

        const gain = ctx.createGain();
        const initialGain = this.muted ? 0.0001 : Math.max(0.0001, this.bgmVolume * 0.22);
        gain.gain.setValueAtTime(initialGain, ctx.currentTime);

        filter.connect(gain);
        gain.connect(ctx.destination);
        this.bgmFilter = filter;
        this.bgmMasterGain = gain;
      }
      return this.bgmFilter;
    } catch {
      return null;
    }
  }

  public startBgm() {
    if (typeof window === 'undefined') return;
    if (this.bgmTimerId !== null) return;

    const tickBgm = () => {
      if (this.muted || this.bgmVolume <= 0.01) return;
      const ctx = this.getContext();
      if (!ctx) return;
      const bus = this.ensureBgmBus(ctx);
      if (!bus) return;

      const step = this.bgmStep % PENTATONIC_MELODY_HZ.length;
      const now = ctx.currentTime;

      // Soft kalimba / rhodes-style cozy pentatonic note
      const melodyFreq = PENTATONIC_MELODY_HZ[step];
      try {
        const osc = ctx.createOscillator();
        const noteGain = ctx.createGain();
        osc.type = step % 4 === 0 ? 'triangle' : 'sine';
        osc.frequency.setValueAtTime(melodyFreq, now);

        noteGain.gain.setValueAtTime(0.0001, now);
        noteGain.gain.exponentialRampToValueAtTime(0.14, now + 0.03);
        noteGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.44);

        osc.connect(noteGain);
        noteGain.connect(bus);
        osc.start(now);
        osc.stop(now + 0.46);

        // Warm bass pulse on even steps
        if (step % 2 === 0) {
          const bassFreq = BASS_PATTERN_HZ[Math.floor(step / 2) % BASS_PATTERN_HZ.length];
          const bassOsc = ctx.createOscillator();
          const bassGain = ctx.createGain();
          bassOsc.type = 'sine';
          bassOsc.frequency.setValueAtTime(bassFreq, now);

          bassGain.gain.setValueAtTime(0.0001, now);
          bassGain.gain.exponentialRampToValueAtTime(0.18, now + 0.05);
          bassGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.85);

          bassOsc.connect(bassGain);
          bassGain.connect(bus);
          bassOsc.start(now);
          bassOsc.stop(now + 0.88);
        }
      } catch {
        // ignore if audio node creation unavailable
      }

      this.bgmStep += 1;
    };

    this.bgmTimerId = window.setInterval(tickBgm, 480);
  }

  public stopBgm() {
    if (this.bgmTimerId !== null && typeof window !== 'undefined') {
      window.clearInterval(this.bgmTimerId);
    }
    this.bgmTimerId = null;
  }

  private playTone(
    freq: number,
    duration: number,
    type: OscillatorType = 'sine',
    gainPeak = 0.08,
    delay = 0,
  ) {
    if (this.muted || this.sfxVolume <= 0.001) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const scaledGain = Math.max(0.0002, gainPeak * this.sfxVolume);
    const now = ctx.currentTime + delay;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(scaledGain, now + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + duration + 0.02);
    } catch {
      // ignore in restricted environments
    }
  }

  public playClick() {
    this.playTone(520, 0.07, 'triangle', 0.05);
  }

  public playChop() {
    this.playTone(220, 0.06, 'square', 0.04);
    this.playTone(150, 0.05, 'triangle', 0.05, 0.02);
  }

  public playMix() {
    this.playTone(340, 0.09, 'sine', 0.05);
    this.playTone(410, 0.09, 'sine', 0.04, 0.04);
  }

  public playWrap() {
    this.playTone(460, 0.08, 'triangle', 0.06);
  }

  public playSteam() {
    this.playTone(620, 0.14, 'sine', 0.04);
    this.playTone(760, 0.16, 'sine', 0.04, 0.07);
  }

  public playDoorbell() {
    // Cozy shop entrance two-chime brass bell
    this.playTone(880, 0.22, 'sine', 0.065, 0);
    this.playTone(1318.5, 0.34, 'sine', 0.055, 0.09);
    this.playTone(1760, 0.24, 'triangle', 0.02, 0.09);
  }

  public playCashier() {
    this.playTone(880, 0.12, 'triangle', 0.07);
    this.playTone(1318, 0.22, 'triangle', 0.08, 0.09);
  }

  public playSuccess() {
    this.playTone(523.25, 0.12, 'triangle', 0.07, 0);
    this.playTone(659.25, 0.12, 'triangle', 0.07, 0.09);
    this.playTone(783.99, 0.22, 'triangle', 0.08, 0.18);
  }

  public playError() {
    this.playTone(210, 0.16, 'sawtooth', 0.05, 0);
    this.playTone(165, 0.2, 'sawtooth', 0.05, 0.1);
  }

  private teardownSteamNodes() {
    if (this.steamSource) {
      try {
        this.steamSource.stop();
        this.steamSource.disconnect();
      } catch {
        // ignore
      }
      this.steamSource = null;
    }
    if (this.steamGain) {
      try {
        this.steamGain.disconnect();
      } catch {
        // ignore
      }
      this.steamGain = null;
    }
  }

  public setSteamAmbience(active: boolean, intensity = 0.65) {
    this.steamActive = active;
    this.steamIntensity = clampUnit(intensity);

    if (!active || this.muted || this.sfxVolume <= 0.001) {
      this.teardownSteamNodes();
      return;
    }

    const ctx = this.getContext();
    if (!ctx) return;

    if (this.steamSource && this.steamGain) {
      this.syncAudioNodes();
      return;
    }

    try {
      const sampleRate = ctx.sampleRate || 44100;
      const length = sampleRate * 1.5;
      const buffer = ctx.createBuffer(1, length, sampleRate);
      const data = buffer.getChannelData(0);
      let prev = 0;
      for (let i = 0; i < length; i++) {
        const white = Math.random() * 2 - 1;
        // Soften high-frequency harshness into gentle pink-like bamboo hiss
        prev = (prev + 0.12 * white) / 1.12;
        data[i] = prev * 2.4;
      }

      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1150, ctx.currentTime);
      filter.Q.setValueAtTime(0.75, ctx.currentTime);

      const gain = ctx.createGain();
      const target = Math.max(0.0001, this.sfxVolume * this.steamIntensity * 0.045);
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.setTargetAtTime(target, ctx.currentTime, 0.12);

      source.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      source.start();

      this.steamSource = source;
      this.steamGain = gain;
    } catch {
      this.teardownSteamNodes();
    }
  }
}

export const soundFx = new ProceduralAudioEngine();
