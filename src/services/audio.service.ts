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
    const cycleDuration = 0.8; // Each tone lasts 0.4s

    const osc = this.audioCtx.createOscillator();
    osc.type = 'sine';
    this.activeOscillator = osc;

    const gainNode = this.audioCtx.createGain();
    gainNode.gain.setValueAtTime(0.25, t); // volume
    gainNode.gain.linearRampToValueAtTime(0, t + duration); // fade out over the duration
    this.activeGain = gainNode;

    const highFreq = 880; // A5
    const lowFreq = 659; // E5

    // Schedule frequency changes
    for (let i = 0; i < duration / cycleDuration; i++) {
      const cycleStart = t + i * cycleDuration;
      osc.frequency.setValueAtTime(highFreq, cycleStart);
      osc.frequency.setValueAtTime(lowFreq, cycleStart + cycleDuration / 2);
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
}