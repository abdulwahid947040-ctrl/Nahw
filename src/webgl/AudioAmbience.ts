/**
 * Procedural Ethereal Soundscape using Web Audio API
 * Generates warm, glowing ambient drones and interactive crystal chimes upon touch
 */
export class GardenAudio {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private droneGain: GainNode | null = null;
  private isMuted: boolean = false;
  private isInitialized: boolean = false;

  // Pentatonic frequencies in Hz for harmonious interaction
  private chimeFreqs = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25];

  public init() {
    if (this.isInitialized) return;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.35, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      this.startAmbientDrone();
      this.isInitialized = true;
    } catch {
      // Audio context might fail or be blocked by browser policy
    }
  }

  private startAmbientDrone() {
    if (!this.ctx || !this.masterGain) return;

    this.droneGain = this.ctx.createGain();
    this.droneGain.gain.setValueAtTime(0.01, this.ctx.currentTime);
    this.droneGain.gain.exponentialRampToValueAtTime(0.2, this.ctx.currentTime + 4.0);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(420, this.ctx.currentTime);

    // Warm chord: D, A, E, F#
    const baseFreqs = [73.42, 110.0, 164.81, 185.0];
    baseFreqs.forEach((freq, idx) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      osc.type = idx % 2 === 0 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

      const lfo = this.ctx.createOscillator();
      lfo.frequency.setValueAtTime(0.1 + idx * 0.05, this.ctx.currentTime);
      const lfoGain = this.ctx.createGain();
      lfoGain.gain.setValueAtTime(1.5, this.ctx.currentTime);
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);
      lfo.start();

      osc.connect(filter);
      osc.start();
    });

    filter.connect(this.droneGain);
    this.droneGain.connect(this.masterGain);
  }

  /**
   * Play ethereal singing bowl / crystal harmonics when fluid ripples sweep the bas-relief
   */
  public playFluidRipple(intensity: number = 0.5, speed: number = 0.5) {
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    const noteIdx = Math.floor(Math.min(this.chimeFreqs.length - 1, speed * this.chimeFreqs.length));
    const baseFreq = this.chimeFreqs[noteIdx] || 329.63;

    // Harmonic singing bowl fundamental + overtone
    const now = this.ctx.currentTime;
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    osc1.type = 'sine';
    osc2.type = 'sine';

    osc1.frequency.setValueAtTime(baseFreq, now);
    osc2.frequency.setValueAtTime(baseFreq * 2.008, now); // subtle shimmer beat

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(800 + intensity * 600, now);

    const gain = this.ctx.createGain();
    const vol = Math.min(0.2, 0.05 * (0.6 + intensity));
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(vol, now + 0.1);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 2.8);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 2.9);
    osc2.stop(now + 2.9);
  }

  /**
   * Play an ethereal bloom chime when bas-relief is touched or burst
   */
  public playBloomChime(intensity: number = 0.5) {
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    const noteIdx = Math.floor(Math.random() * this.chimeFreqs.length);
    const freq = this.chimeFreqs[noteIdx];

    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    // Subtle glide
    osc.frequency.exponentialRampToValueAtTime(freq * 1.01, this.ctx.currentTime + 1.2);

    const gain = this.ctx.createGain();
    const now = this.ctx.currentTime;
    const vol = Math.min(0.25, 0.08 * (0.5 + intensity));

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(vol, now + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 2.5);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 2.6);
  }

  /**
   * Sound when user touches/activates the dormant seed
   */
  public playSeedAwaken() {
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(110, now);
    osc.frequency.exponentialRampToValueAtTime(220, now + 1.2);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(300, now);
    filter.frequency.exponentialRampToValueAtTime(900, now + 1.2);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.18, now + 0.3);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 2.0);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 2.0);
  }

  /**
   * Sound when the rose blooms
   */
  public playRoseBloom() {
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    const now = this.ctx.currentTime;

    [261.63, 329.63, 392.0, 523.25].forEach((freq, idx) => {
      if (!this.ctx || !this.masterGain) return;
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.15);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.0001, now + idx * 0.15);
      gain.gain.linearRampToValueAtTime(0.08, now + idx * 0.15 + 0.1);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.15 + 2.5);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now + idx * 0.15);
      osc.stop(now + idx * 0.15 + 2.6);
    });
  }

  /**
   * Sound when the rose explodes and petals scatter
   */
  public playRoseExplode() {
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    const now = this.ctx.currentTime;

    // Breath / rushing air burst
    const bufferSize = this.ctx.sampleRate * 1.5;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.35));
    }

    const whiteNoise = this.ctx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(600, now);
    filter.Q.setValueAtTime(2.0, now);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.4);

    whiteNoise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    whiteNoise.start(now);

    // Ethereal high shimmers
    [659.25, 880.0, 1046.5].forEach((freq, idx) => {
      if (!this.ctx || !this.masterGain) return;
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.08);

      const sGain = this.ctx.createGain();
      sGain.gain.setValueAtTime(0.06, now + idx * 0.08);
      sGain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.08 + 2.2);

      osc.connect(sGain);
      sGain.connect(this.masterGain);
      osc.start(now + idx * 0.08);
      osc.stop(now + idx * 0.08 + 2.3);
    });
  }

  public toggleMute(): boolean {
    if (!this.masterGain || !this.ctx) {
      this.init();
      return false;
    }
    this.isMuted = !this.isMuted;
    const now = this.ctx.currentTime;
    this.masterGain.gain.cancelScheduledValues(now);
    this.masterGain.gain.linearRampToValueAtTime(this.isMuted ? 0 : 0.35, now + 0.2);
    return this.isMuted;
  }

  public getMuted(): boolean {
    return this.isMuted;
  }
}
