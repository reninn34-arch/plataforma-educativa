"use client";

let audioCtx: AudioContext | null = null;

function ctx(): AudioContext {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }
  return audioCtx;
}

function tone(frequency: number, duration: number, type: OscillatorType = "sine", volume = 0.12) {
  try {
    const c = ctx();
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, c.currentTime);
    gain.gain.setValueAtTime(volume, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(c.currentTime);
    osc.stop(c.currentTime + duration);
  } catch {}
}

export const sounds = {
  correct() {
    tone(523, 0.1);
    setTimeout(() => tone(659, 0.1), 80);
    setTimeout(() => tone(784, 0.15), 160);
  },
  incorrect() {
    tone(200, 0.15, "square", 0.08);
    setTimeout(() => tone(180, 0.25, "square", 0.08), 120);
  },
  tick() {
    tone(800, 0.04, "sine", 0.06);
  },
  urgentTick() {
    tone(1200, 0.04, "square", 0.08);
  },
  countdownBeep() {
    tone(440, 0.12, "sine", 0.1);
  },
  countdownGo() {
    tone(523, 0.1, "sine", 0.12);
    setTimeout(() => tone(784, 0.2, "sine", 0.12), 80);
  },
  achievement() {
    [523, 659, 784, 1047].forEach((freq, i) => {
      setTimeout(() => tone(freq, 0.25, "sine", 0.1), i * 120);
    });
  },
  heartbreak() {
    tone(400, 0.15, "sawtooth", 0.06);
    setTimeout(() => tone(300, 0.2, "sawtooth", 0.06), 120);
    setTimeout(() => tone(200, 0.3, "sawtooth", 0.05), 240);
  },
};
