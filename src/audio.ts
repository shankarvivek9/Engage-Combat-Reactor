/**
 * Web Audio API synthesizer for retro space shooter sound effects.
 * Avoids any external assets to guarantee zero load failures and full reliability.
 */

let audioCtx: AudioContext | null = null;
let masterVolume = 0.4; // Initialized to moderate level. Can be adjusted by user.

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    // Standard and vendor prefixed support
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  return audioCtx;
}

export function setVolume(val: number) {
  masterVolume = Math.max(0, Math.min(1, val));
}

export function getVolume(): number {
  return masterVolume;
}

/**
 * Resumes audio context if it was in 'suspended' state (standard browser security restriction)
 */
export async function resumeAudio() {
  const ctx = getAudioContext();
  if (ctx && ctx.state === 'suspended') {
    try {
      await ctx.resume();
    } catch (e) {
      console.warn('AudioContext failed to resume:', e);
    }
  }
}

export function playSound(type: 'laser' | 'plasma' | 'missile' | 'tesla' | 'explosion' | 'damage' | 'shield' | 'levelup' | 'heal' | 'click') {
  const ctx = getAudioContext();
  if (!ctx || masterVolume <= 0) return;

  // Auto resume on click if suspended
  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }

  try {
    const now = ctx.currentTime;
    
    // Create master structural gain node for this sound
    const mainGain = ctx.createGain();
    mainGain.gain.setValueAtTime(masterVolume, now);
    mainGain.connect(ctx.destination);

    switch (type) {
      case 'laser': {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.exponentialRampToValueAtTime(150, now + 0.15);

        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);

        osc.connect(gain);
        gain.connect(mainGain);
        osc.start(now);
        osc.stop(now + 0.16);
        break;
      }

      case 'plasma': {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1000, now);
        osc.frequency.exponentialRampToValueAtTime(300, now + 0.25);

        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);

        osc.connect(gain);
        gain.connect(mainGain);
        osc.start(now);
        osc.stop(now + 0.26);
        break;
      }

      case 'missile': {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(100, now);
        osc.frequency.linearRampToValueAtTime(300, now + 0.1);
        osc.frequency.exponentialRampToValueAtTime(40, now + 0.3);

        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);

        osc.connect(gain);
        gain.connect(mainGain);
        osc.start(now);
        osc.stop(now + 0.36);
        break;
      }

      case 'tesla': {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(1200, now);
        osc.frequency.setValueAtTime(400, now + 0.05);
        osc.frequency.setValueAtTime(1600, now + 0.08);
        osc.frequency.exponentialRampToValueAtTime(100, now + 0.15);

        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.18);

        osc.connect(gain);
        gain.connect(mainGain);
        osc.start(now);
        osc.stop(now + 0.19);
        break;
      }

      case 'explosion': {
        // Low-frequency rumble synth representing rocket/gem explosion
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(180, now);
        osc.frequency.exponentialRampToValueAtTime(20, now + 0.4);

        // Add modular distortion with second oscillator or lowpass filter
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(300, now);
        filter.frequency.exponentialRampToValueAtTime(50, now + 0.4);

        gain.gain.setValueAtTime(0.4, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.45);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(mainGain);
        osc.start(now);
        osc.stop(now + 0.46);
        break;
      }

      case 'damage': {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.setValueAtTime(100, now + 0.07);
        osc.frequency.setValueAtTime(50, now + 0.14);

        gain.gain.setValueAtTime(0.25, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.2);

        osc.connect(gain);
        gain.connect(mainGain);
        osc.start(now);
        osc.stop(now + 0.21);
        break;
      }

      case 'shield': {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.exponentialRampToValueAtTime(1800, now + 0.15);

        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);

        osc.connect(gain);
        gain.connect(mainGain);
        osc.start(now);
        osc.stop(now + 0.16);
        break;
      }

      case 'heal': {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(300, now);
        osc.frequency.exponentialRampToValueAtTime(900, now + 0.2);

        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);

        osc.connect(gain);
        gain.connect(mainGain);
        osc.start(now);
        osc.stop(now + 0.26);
        break;
      }

      case 'click': {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1000, now);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);

        osc.connect(gain);
        gain.connect(mainGain);
        osc.start(now);
        osc.stop(now + 0.06);
        break;
      }

      case 'levelup': {
        // Play major ascending chord arpeggio
        const notes = [261.63, 329.63, 392.00, 523.25, 659.25]; // C4, E4, G4, C5, E5
        notes.forEach((freq, idx) => {
          const oscNode = ctx.createOscillator();
          const gainNode = ctx.createGain();
          
          oscNode.type = 'sine';
          oscNode.frequency.setValueAtTime(freq, now + idx * 0.08);
          
          gainNode.gain.setValueAtTime(0.15, now + idx * 0.08);
          gainNode.gain.setValueAtTime(0.15, now + idx * 0.08 + 0.1);
          gainNode.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.25);
          
          oscNode.connect(gainNode);
          gainNode.connect(mainGain);
          
          oscNode.start(now + idx * 0.08);
          oscNode.stop(now + idx * 0.08 + 0.3);
        });
        break;
      }
    }
  } catch (err) {
    console.error('Failed to synthesize sound effect:', err);
  }
}
