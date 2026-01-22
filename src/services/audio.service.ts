import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class AudioService {
  private audioCtx: AudioContext | null = null;
  private isMuted = false;
  
  // Track active nodes to prevent overlap
  private activeOscillator: OscillatorNode | null = null;
  private activeGain: GainNode | null = null;

  constructor() {}

  private initContext() {
    if (!this.audioCtx) {
      this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    // Immediately stop sound if muted
    if (this.isMuted) {
        this.stopSiren();
    }
    return this.isMuted;
  }

  // Play a single beep or tone
  playTone(freq: number, type: OscillatorType, duration: number, startTime: number = 0) {
    if (this.isMuted) return;
    this.initContext();
    if (!this.audioCtx) return;

    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime + startTime);
    
    gain.gain.setValueAtTime(0.1, this.audioCtx.currentTime + startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + startTime + duration);

    osc.connect(gain);
    gain.connect(this.audioCtx.destination);

    osc.start(this.audioCtx.currentTime + startTime);
    osc.stop(this.audioCtx.currentTime + startTime + duration);
  }

  stopSiren() {
      if (this.activeOscillator) {
          try {
              this.activeOscillator.stop();
              this.activeOscillator.disconnect();
          } catch(e) {}
          this.activeOscillator = null;
      }
      if (this.activeGain) {
          try {
             this.activeGain.disconnect();
          } catch(e) {}
          this.activeGain = null;
      }
  }

  // Simulate a classic two-tone emergency siren
  playPWSSiren() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.audioCtx) return;

    // STOP any existing siren before starting a new one
    this.stopSiren();

    const t = this.audioCtx.currentTime;
    const duration = 6; // Play for 6 seconds
    
    const osc = this.audioCtx.createOscillator();
    osc.type = 'sawtooth'; // More aggressive for alert
    this.activeOscillator = osc;

    const gainNode = this.audioCtx.createGain();
    gainNode.gain.setValueAtTime(0.25, t); 
    gainNode.gain.linearRampToValueAtTime(0, t + duration); 
    this.activeGain = gainNode;

    // Standard PWS/EAS-like two-tone (853Hz / 960Hz)
    const lowFreq = 853; 
    const highFreq = 960;
    const cycleDuration = 0.5; 

    osc.frequency.setValueAtTime(lowFreq, t);
    
    // Schedule frequency changes
    // Create a rapid alternation for urgency
    for (let i = 0; i < duration * 4; i++) {
        const time = t + i * 0.25;
        osc.frequency.setValueAtTime(i % 2 === 0 ? lowFreq : highFreq, time);
    }
    
    osc.connect(gainNode);
    gainNode.connect(this.audioCtx.destination);
    
    osc.start(t);
    osc.stop(t + duration);
    
    // Auto cleanup ref
    osc.onended = () => {
        if (this.activeOscillator === osc) {
            this.activeOscillator = null;
            this.activeGain = null;
        }
    };
  }

  playTriggerSound() {
      if (this.isMuted) return;
      this.playTone(880, 'sine', 0.1);
      this.playTone(1760, 'square', 0.1, 0.1);
  }

  playArrivalSound() {
      if (this.isMuted) return;
      this.playTone(440, 'triangle', 0.3);
  }

  // Distinct sounds for Intensity Gears 1-7
  playIntensitySound(level: number) {
      if (this.isMuted) return;
      this.initContext();
      if (!this.audioCtx) return;
      
      const t = this.audioCtx.currentTime;

      switch (level) {
          case 1: // Gear 1: Subtle notification (Ping)
              this.playTone(1000, 'sine', 0.15);
              break;
          case 2: // Gear 2: Double Ping
              this.playTone(1000, 'sine', 0.15);
              this.playTone(1000, 'sine', 0.15, 0.2);
              break;
          case 3: // Gear 3: Upward Chime (Info)
              this.playTone(660, 'triangle', 0.2);
              this.playTone(880, 'triangle', 0.2, 0.15);
              break;
          case 4: // Gear 4: Minor Chord (Warning start)
              this.playTone(523, 'square', 0.3); // C5
              this.playTone(622, 'square', 0.3, 0.05); // Eb5 (minor)
              this.playTone(784, 'square', 0.3, 0.1); // G5
              break;
          case 5: // Gear 5: Rapid Pulse (Strong shaking)
              for(let i=0; i<3; i++) {
                  this.playTone(1200, 'sawtooth', 0.1, i * 0.12);
              }
              break;
          case 6: // Gear 6: Siren Sweep (Severe)
               const osc = this.audioCtx.createOscillator();
               const gain = this.audioCtx.createGain();
               osc.type = 'sawtooth';
               osc.frequency.setValueAtTime(800, t);
               osc.frequency.linearRampToValueAtTime(1600, t + 0.4);
               gain.gain.setValueAtTime(0.3, t);
               gain.gain.exponentialRampToValueAtTime(0.01, t + 0.4);
               osc.connect(gain);
               gain.connect(this.audioCtx.destination);
               osc.start(t);
               osc.stop(t + 0.4);
               break;
          case 7: // Gear 7: Dissonant Alarm (Catastrophic)
               // Tritone dissonance
               this.playTone(800, 'sawtooth', 0.6);
               this.playTone(1131, 'sawtooth', 0.6); // approx F#5 (tritone from C5ish base)
               // Rapid amplitude modulation effect manually?
               // Just stick to raw dissonance
               break;
          default:
               // Fallback for >7
               this.playIntensitySound(7);
      }
  }
}
