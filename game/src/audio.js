// Pure Web Audio API offline tactical sound synthesizer. Zero external audio assets.
export function createAudio() {
  let ctx = null;
  let noiseBuffer = null;

  function ensureContext() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      return ctx;
    }
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
    const len = ctx.sampleRate * 0.8;
    noiseBuffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
    return ctx;
  }

  function playNoise(duration, filterFreq, q, gainVal, type = 'bandpass', startGain = gainVal) {
    const c = ensureContext();
    if (!c || !noiseBuffer) return;
    const now = c.currentTime;
    const src = c.createBufferSource();
    src.buffer = noiseBuffer;
    const filter = c.createBiquadFilter();
    filter.type = type;
    filter.frequency.setValueAtTime(filterFreq, now);
    filter.Q.setValueAtTime(q, now);
    const gain = c.createGain();
    gain.gain.setValueAtTime(startGain, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(c.destination);
    src.start(now);
    src.stop(now + duration);
  }

  function playTone(freq, endFreq, duration, type = 'sine', gainVal = 0.14, delay = 0) {
    const c = ensureContext();
    if (!c) return;
    const now = c.currentTime + delay;
    const osc = c.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), now + duration);
    const gain = c.createGain();
    gain.gain.setValueAtTime(gainVal, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(now);
    osc.stop(now + duration);
  }

  return {
    unlock() {
      ensureContext();
    },
    shot(weaponId, volumeScale = 1) {
      if (weaponId === 'knife') {
        playNoise(0.08, 2200, 1.4, 0.12 * volumeScale, 'highpass');
        return;
      }
      if (weaponId === 'pistol') {
        playNoise(0.11, 1600, 0.9, 0.28 * volumeScale, 'bandpass');
        playTone(210, 55, 0.08, 'triangle', 0.22 * volumeScale);
      } else if (weaponId === 'smg') {
        playNoise(0.08, 2100, 1.1, 0.22 * volumeScale, 'bandpass');
        playTone(170, 62, 0.06, 'sawtooth', 0.14 * volumeScale);
      } else if (weaponId === 'sniper') {
        playNoise(0.32, 950, 0.6, 0.44 * volumeScale, 'lowpass');
        playTone(165, 34, 0.26, 'sawtooth', 0.32 * volumeScale);
      } else {
        // rifle
        playNoise(0.15, 1300, 0.8, 0.34 * volumeScale, 'bandpass');
        playTone(190, 48, 0.12, 'sawtooth', 0.24 * volumeScale);
      }
    },
    hit(headshot) {
      if (headshot) {
        playTone(1880, 1520, 0.11, 'sine', 0.22);
        playTone(2780, 2200, 0.09, 'triangle', 0.12);
      } else {
        playTone(320, 140, 0.06, 'triangle', 0.14);
      }
    },
    reload() {
      playTone(620, 420, 0.04, 'square', 0.06, 0);
      playTone(840, 1080, 0.05, 'square', 0.06, 0.18);
    },
    footstep(crouching) {
      playNoise(0.045, crouching ? 320 : 520, 1.2, crouching ? 0.03 : 0.06, 'lowpass');
    },
    bombTick(urgent = false) {
      playTone(urgent ? 1320 : 940, urgent ? 1280 : 900, 0.065, 'square', urgent ? 0.11 : 0.075);
    },
    bombEvent(kind) {
      if (kind === 'plant') {
        playTone(540, 880, 0.16, 'triangle', 0.16, 0);
        playTone(880, 1180, 0.18, 'triangle', 0.14, 0.12);
      } else if (kind === 'defuse') {
        playTone(700, 1050, 0.14, 'sine', 0.15, 0);
        playTone(1050, 1400, 0.22, 'sine', 0.15, 0.12);
      } else {
        playNoise(0.75, 420, 0.5, 0.5, 'lowpass');
        playTone(95, 22, 0.65, 'sawtooth', 0.35);
      }
    },
    explosion() {
      playNoise(0.55, 620, 0.55, 0.45, 'lowpass');
      playTone(110, 26, 0.45, 'sawtooth', 0.3);
    },
    ui(kind) {
      if (kind === 'buy') {
        playTone(520, 780, 0.07, 'triangle', 0.11);
      } else if (kind === 'deny') {
        playTone(210, 150, 0.09, 'sawtooth', 0.09);
      } else if (kind === 'win') {
        playTone(523, 523, 0.12, 'triangle', 0.14, 0);
        playTone(659, 659, 0.14, 'triangle', 0.14, 0.11);
        playTone(784, 987, 0.24, 'triangle', 0.16, 0.22);
      } else {
        playTone(392, 349, 0.16, 'triangle', 0.13, 0);
        playTone(311, 233, 0.28, 'triangle', 0.14, 0.16);
      }
    },
  };
}
