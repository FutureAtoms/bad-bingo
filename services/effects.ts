import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

// ============================================
// HAPTIC FEEDBACK
// ============================================

export type HapticType = 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error' | 'selection';

export const triggerHaptic = async (type: HapticType = 'medium') => {
  try {
    switch (type) {
      case 'light':
        await Haptics.impact({ style: ImpactStyle.Light });
        break;
      case 'medium':
        await Haptics.impact({ style: ImpactStyle.Medium });
        break;
      case 'heavy':
        await Haptics.impact({ style: ImpactStyle.Heavy });
        break;
      case 'success':
        await Haptics.notification({ type: NotificationType.Success });
        break;
      case 'warning':
        await Haptics.notification({ type: NotificationType.Warning });
        break;
      case 'error':
        await Haptics.notification({ type: NotificationType.Error });
        break;
      case 'selection':
        await Haptics.selectionStart();
        await Haptics.selectionEnd();
        break;
    }
  } catch (e) {
    // Fallback to web vibration API
    if (navigator.vibrate) {
      switch (type) {
        case 'light':
          navigator.vibrate(20);
          break;
        case 'medium':
          navigator.vibrate(40);
          break;
        case 'heavy':
          navigator.vibrate(80);
          break;
        case 'success':
          navigator.vibrate([50, 50, 100]);
          break;
        case 'warning':
          navigator.vibrate([100, 50, 100]);
          break;
        case 'error':
          navigator.vibrate([100, 50, 100, 50, 100]);
          break;
        case 'selection':
          navigator.vibrate(10);
          break;
      }
    }
  }
};

// Special vibration patterns
export const triggerClashVibration = () => {
  if (navigator.vibrate) {
    navigator.vibrate([100, 50, 100, 50, 200, 100, 300]);
  }
  triggerHaptic('success');
};

export const triggerWinVibration = () => {
  if (navigator.vibrate) {
    navigator.vibrate([50, 30, 50, 30, 50, 30, 100, 50, 200]);
  }
  triggerHaptic('success');
};

export const triggerLoseVibration = () => {
  if (navigator.vibrate) {
    navigator.vibrate([200, 100, 200]);
  }
  triggerHaptic('error');
};

// ============================================
// SOUND EFFECTS
// ============================================

type SoundType = 'swipe' | 'match' | 'win' | 'lose' | 'challenge' | 'notification' | 'coin' | 'tap' | 'whoosh';

// Sound URLs (using free sound effects - replace with actual sounds)
const SOUNDS: Record<SoundType, string> = {
  swipe: 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=', // placeholder
  match: 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=',
  win: 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=',
  lose: 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=',
  challenge: 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=',
  notification: 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=',
  coin: 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=',
  tap: 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=',
  whoosh: 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=',
};

let soundEnabled = true;
const audioCache: Record<string, HTMLAudioElement> = {};

export const setSoundEnabled = (enabled: boolean) => {
  soundEnabled = enabled;
  localStorage.setItem('bingo_sound_enabled', String(enabled));
};

export const isSoundEnabled = () => {
  const saved = localStorage.getItem('bingo_sound_enabled');
  if (saved !== null) {
    soundEnabled = saved === 'true';
  }
  return soundEnabled;
};

export const playSound = (type: SoundType, volume: number = 0.5) => {
  if (!soundEnabled) return;

  try {
    // Use Web Audio API for better performance
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;

    const audioCtx = new AudioContext();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    // Different sounds for different types
    switch (type) {
      case 'swipe':
        oscillator.frequency.setValueAtTime(400, audioCtx.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(200, audioCtx.currentTime + 0.1);
        gainNode.gain.setValueAtTime(volume * 0.3, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
        oscillator.start(audioCtx.currentTime);
        oscillator.stop(audioCtx.currentTime + 0.1);
        break;

      case 'match':
        // Ascending notes for match
        const playMatchNote = (freq: number, start: number, duration: number) => {
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.connect(gain);
          gain.connect(audioCtx.destination);
          osc.frequency.setValueAtTime(freq, audioCtx.currentTime + start);
          gain.gain.setValueAtTime(volume * 0.4, audioCtx.currentTime + start);
          gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + start + duration);
          osc.start(audioCtx.currentTime + start);
          osc.stop(audioCtx.currentTime + start + duration);
        };
        playMatchNote(523, 0, 0.15);    // C5
        playMatchNote(659, 0.1, 0.15);  // E5
        playMatchNote(784, 0.2, 0.25);  // G5
        return; // Skip the default oscillator

      case 'win':
        // Triumphant fanfare
        const playWinNote = (freq: number, start: number, duration: number) => {
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.connect(gain);
          gain.connect(audioCtx.destination);
          osc.frequency.setValueAtTime(freq, audioCtx.currentTime + start);
          gain.gain.setValueAtTime(volume * 0.5, audioCtx.currentTime + start);
          gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + start + duration);
          osc.start(audioCtx.currentTime + start);
          osc.stop(audioCtx.currentTime + start + duration);
        };
        playWinNote(523, 0, 0.2);
        playWinNote(659, 0.15, 0.2);
        playWinNote(784, 0.3, 0.2);
        playWinNote(1047, 0.45, 0.4);
        return;

      case 'lose':
        oscillator.frequency.setValueAtTime(300, audioCtx.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.4);
        gainNode.gain.setValueAtTime(volume * 0.4, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
        oscillator.start(audioCtx.currentTime);
        oscillator.stop(audioCtx.currentTime + 0.4);
        break;

      case 'challenge':
        // Alert-style sound
        const playChallengeNote = (freq: number, start: number) => {
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.connect(gain);
          gain.connect(audioCtx.destination);
          osc.frequency.setValueAtTime(freq, audioCtx.currentTime + start);
          gain.gain.setValueAtTime(volume * 0.4, audioCtx.currentTime + start);
          gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + start + 0.15);
          osc.start(audioCtx.currentTime + start);
          osc.stop(audioCtx.currentTime + start + 0.15);
        };
        playChallengeNote(800, 0);
        playChallengeNote(1000, 0.12);
        playChallengeNote(800, 0.24);
        return;

      case 'coin':
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(1200, audioCtx.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(2400, audioCtx.currentTime + 0.1);
        gainNode.gain.setValueAtTime(volume * 0.3, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
        oscillator.start(audioCtx.currentTime);
        oscillator.stop(audioCtx.currentTime + 0.15);
        break;

      case 'notification':
        oscillator.frequency.setValueAtTime(880, audioCtx.currentTime);
        gainNode.gain.setValueAtTime(volume * 0.3, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
        oscillator.start(audioCtx.currentTime);
        oscillator.stop(audioCtx.currentTime + 0.2);
        break;

      case 'tap':
        oscillator.frequency.setValueAtTime(600, audioCtx.currentTime);
        gainNode.gain.setValueAtTime(volume * 0.2, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.05);
        oscillator.start(audioCtx.currentTime);
        oscillator.stop(audioCtx.currentTime + 0.05);
        break;

      case 'whoosh':
        oscillator.type = 'sawtooth';
        oscillator.frequency.setValueAtTime(800, audioCtx.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.2);
        gainNode.gain.setValueAtTime(volume * 0.2, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
        oscillator.start(audioCtx.currentTime);
        oscillator.stop(audioCtx.currentTime + 0.2);
        break;
    }
  } catch (e) {
    console.log('Sound not supported');
  }
};

// ============================================
// PARTICLE/SPARK EFFECTS
// ============================================

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
}

export const createSparkParticles = (
  x: number,
  y: number,
  count: number = 20,
  colors: string[] = ['#CCFF00', '#FF0099', '#00FFFF', '#FFFFFF']
): Particle[] => {
  const particles: Particle[] = [];
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
    const speed = 2 + Math.random() * 4;
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 1,
      maxLife: 0.5 + Math.random() * 0.5,
      size: 2 + Math.random() * 4,
      color: colors[Math.floor(Math.random() * colors.length)]
    });
  }
  return particles;
};

// ============================================
// COMBINED EFFECTS
// ============================================

export const triggerMatchEffect = () => {
  playSound('match');
  triggerClashVibration();
};

export const triggerWinEffect = () => {
  playSound('win');
  triggerWinVibration();
};

export const triggerLoseEffect = () => {
  playSound('lose');
  triggerLoseVibration();
};

export const triggerSwipeEffect = (direction: 'left' | 'right') => {
  playSound('swipe');
  triggerHaptic('light');
};

export const triggerChallengeEffect = () => {
  playSound('challenge');
  triggerHaptic('warning');
};

export const triggerCoinEffect = () => {
  playSound('coin');
  triggerHaptic('success');
};
