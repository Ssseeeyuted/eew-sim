import { Component, OnInit, ElementRef, ViewChild, signal, effect, inject, afterNextRender, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PhysicsService, Station, SimulationStationData } from './services/physics.service';
import { AudioService } from './services/audio.service';
import { GeminiService } from './services/gemini.service';
import { PhoneAlertComponent } from './components/phone-alert.component';
import * as L from 'leaflet';

interface ActiveEvent {
  id: string;
  type: 'MAIN' | 'AFTERSHOCK'; 
  magnitude: number;
  depth: number;
  lat: number;
  lng: number;
  startTime: number; 
  
  sortedImpacts: SimulationStationData[];
  
  nextPIndex: number; 
  nextSIndex: number; 
  
  marker?: L.Marker;
  pWaveCircle?: L.Circle;
  sWaveCircle?: L.Circle;

  triggeredInland: number; // Inland triggers (P-wave)
  triggeredOffshore: number; // Offshore triggers (P-wave)
  
  firstTriggerTime: number | null; // For processing delay
  processingDelay: number; // Randomized delay (5-7s)
  
  maxLocalIntensity: number;
  alerted: boolean; 
  dismissed: boolean; // If criteria not met, mark as dismissed
}

interface EEWReport {
  id: string;
  reportNum: number;
  time: number;
  mag: number;
  depth: number;
  stations: number;
  isOffshore: boolean;
}

interface CityCountdown {
    name: string;
    intensity: string;
    seconds: number;
    color: string;
    eventType: 'MAIN' | 'AFTERSHOCK'; // Distinguish for separate timers
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, PhoneAlertComponent],
  templateUrl: './app.component.html',
  host: {
    '(window:resize)': 'checkMobile()'
  }
})
export class AppComponent implements OnInit {
  physics = inject(PhysicsService);
  audio = inject(AudioService);
  gemini = inject(GeminiService);

  // --- Global State ---
  stations = signal<Station[]>([]);
  
  // Current Settings (POLICY)
  magnitude = signal(7.2);
  depth = signal(12);
  epicenter = signal({ lat: 23.85, lng: 120.9 });
  
  // Simulation State (STRATEGY)
  isSimulating = signal(false);
  activeEvents = signal<ActiveEvent[]>([]);
  elapsedTime = signal(0);
  systemStatus = signal<'待命 (IDLE)' | '偵測中 (DETECTING)' | '計算中 (COMPUTING)' | '發布警報 (ALERTING)' | '結束 (ENDED)'>('待命 (IDLE)');
  
  // EEW Reports
  eewReports = signal<EEWReport[]>([]);
  predictedMagnitude = signal('---');
  predictedMaxIntensity = signal('---'); 
  lastReportNum = signal(0);
  
  // UI State
  showTools = signal(false);
  showStations = signal(true);
  showWaves = signal(true);
  isMuted = signal(false);
  activeTab = signal('Visual');
  showMobileControls = signal(false); 
  isMobile = signal(false);
  selectedStation = signal<any>(null); 

  // Metrics & Alerts
  triggeredStations = signal(0);
  inlandTriggerCount = signal(0);
  offshoreTriggerCount = signal(0);
  
  reportNum = signal(0);
  maxDetectedIntensity = signal('1級');
  currentPGA = signal(0); 
  
  // --- ALERTS ---
  tsunamiAlert = signal(false);
  railwayAlert = signal(false);
  railBrakingTime = signal(0);
  
  // 4 Specific Infrastructure Alerts
  fabAlert = signal(false);        
  mrtAlert = signal(false);        
  nuclearAlert = signal(false);    
  gasAlert = signal(false);        
  
  // Phone Props
  currentTimeStr = signal('00:00');
  epicenterLocationName = signal('未知地點');

  // Separate Countdowns
  mainCountdowns = signal<CityCountdown[]>([]);
  secondaryCountdowns = signal<CityCountdown[]>([]);
  
  // 200 System Items
  systemGridItems = signal<any[]>([]);

  // Computed
  maxEventMagnitude = computed(() => {
    const events = this.activeEvents();
    if (events.length === 0) return 0;
    return Math.max(...events.map(e => e.magnitude));
  });
  
  isAlertActive = computed(() => {
      return this.systemStatus() === '發布警報 (ALERTING)' && this.isSimulating();
  });
  
  sensorMatrix = signal<number[]>(Array(1000).fill(0));
  recentQuakes = signal<any[]>([]);
  isLoadingRecents = signal(false);
  aiAnalysis = signal<string | null>(null);

  Math = Math;

  private map: L.Map | undefined;
  private stationMarkers: {[id: string]: L.CircleMarker} = {}; 
  private stationCurrentMaxMMI: {[id: string]: number} = {}; 
  private stationLiveMMI: {[id: string]: number} = {}; 
  
  private epicenterCursor: L.Marker | undefined;
  private animFrameId: number | null = null;
  private SIM_SPEED = 1.0; 
  private lastReportTime = 0;
  private lastDataUpdateTime = 0;
  private frameCount = 0;
  private lastAlarmTime = 0;

  constructor() {
    this.stations.set(this.physics.getStations());
    this.generateSystemItems();
    
    // Update Clock for Phone
    setInterval(() => {
        const d = new Date();
        this.currentTimeStr.set(`${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`);
    }, 1000);

    // Refresh system items occasionally
    setInterval(() => {
        if(this.isSimulating()) this.updateSystemItems();
    }, 2000);

    afterNextRender(() => {
        setTimeout(() => {
           this.initMap();
           this.checkMobile();
        }, 100);
    });

    effect(() => {
        if (!this.map) return;
        const visible = this.showStations();
        Object.values(this.stationMarkers).forEach(m => {
            if(visible) m.addTo(this.map!);
            else m.remove();
        });
    });
  }

  ngOnInit() {}
  
  generateSystemItems() {
      const items = [];
      const prefixes = ['SEN', 'NET', 'PWR', 'UPL', 'DB', 'AI', 'MEM', 'CPU', 'FAN', 'BAT'];
      for(let i=0; i<200; i++) {
          const type = prefixes[i % prefixes.length];
          items.push({
              id: `${type}-${(Math.floor(i/prefixes.length)+1).toString().padStart(3, '0')}`,
              status: Math.random() > 0.95 ? 'WARN' : 'OK',
              val: Math.floor(Math.random() * 99)
          });
      }
      this.systemGridItems.set(items);
  }

  updateSystemItems() {
      const items = [...this.systemGridItems()];
      // Randomly update 20 items
      for(let k=0; k<20; k++) {
          const idx = Math.floor(Math.random() * 200);
          const r = Math.random();
          items[idx].status = r > 0.98 ? 'ERR' : (r > 0.9 ? 'WARN' : 'OK');
          items[idx].val = Math.floor(Math.random() * 99);
      }
      this.systemGridItems.set(items);
  }

  checkMobile() {
      this.isMobile.set(window.innerWidth < 768);
      this.map?.invalidateSize();
  }

  private initMap() {
    if (this.map) return;
    
    // Zoom out to see Taiwan AND Japan (Okinawa/Mainland)
    this.map = L.map('map-container', {
        zoomControl: false,
        attributionControl: false,
        preferCanvas: true, 
        fadeAnimation: false 
    }).setView([26.0, 124.0], 5); // Center between Taiwan and Okinawa

    this.map.invalidateSize();

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
        attribution: '&copy; OSM'
    }).addTo(this.map);

    // CRITICAL PERFORMANCE FIX: Use Canvas Renderer explicitly
    const myRenderer = L.canvas({ padding: 0.5 });

    // Init Stations
    this.stations().forEach(s => {
        let color = '#334155';
        if (s.terrain === 'BASIN') color = '#475569';
        if (s.terrain === 'OFFSHORE') color = '#0f766e';
        if (s.isMajor) color = '#f59e0b'; 
        // Inland vs Offshore visual check (optional, here we stick to terrain color)

        // Adjusted radius for better visibility
        const marker = L.circleMarker([s.lat, s.lng], {
            radius: s.isMajor ? 3 : 0.6, 
            fillColor: color,
            color: 'transparent',
            fillOpacity: s.isMajor ? 0.9 : 0.6,
            renderer: myRenderer // USE EXPLICIT CANVAS RENDERER
        }).addTo(this.map!);
        
        marker.bindTooltip('', { 
            permanent: false, 
            direction: 'top', 
            offset: [0, -5], 
            opacity: 1, 
            className: 'intensity-tooltip' 
        });

        // Add Click Interaction with Professional Data Calculation
        marker.on('click', () => {
            let dynamicData: any = {};
            const events = this.activeEvents();
            
            // Default "Noise" values if no event
            let displayPGA = Math.random() * 0.5;
            let displayPGV = Math.random() * 0.01;

            if (events.length > 0) {
                let maxMMI = -1;
                let bestImpact = null;
                
                events.forEach(e => {
                    const impact = e.sortedImpacts.find(i => i.id === s.id);
                    if (impact && impact.maxMMI > maxMMI) {
                        maxMMI = impact.maxMMI;
                        bestImpact = impact;
                    }
                });

                if (bestImpact) {
                    displayPGA = this.physics.estimatePGA(bestImpact.maxMMI);
                    displayPGV = this.physics.estimatePGV(bestImpact.maxMMI);
                    
                    dynamicData = {
                        dist: bestImpact.dist,
                        pTime: bestImpact.pTime,
                        sTime: bestImpact.sTime,
                        maxMMI: bestImpact.maxMMI,
                        intensity: this.physics.toCWAIntensity(bestImpact.maxMMI),
                        pga: displayPGA,
                        pgv: displayPGV
                    };
                }
            } else {
                // Background noise level
                dynamicData = {
                    pga: displayPGA,
                    pgv: displayPGV
                };
            }

            this.selectedStation.set({
                ...s,
                ...dynamicData
            });
        });

        this.stationMarkers[s.id] = marker;
        this.stationCurrentMaxMMI[s.id] = 0;
    });

    const icon = L.divIcon({
        className: 'epicenter-cursor',
        html: `<div style="width:16px;height:16px;background:red;border-radius:50%;border:2px solid white;box-shadow:0 0 10px red;"></div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8]
    });
    
    this.epicenterCursor = L.marker([this.epicenter().lat, this.epicenter().lng], { 
        icon, 
        draggable: true,
        zIndexOffset: 1000
    }).addTo(this.map!);

    this.epicenterCursor.on('dragend', (e) => {
        const ll = e.target.getLatLng();
        this.epicenter.set({ lat: ll.lat, lng: ll.lng });
    });

    this.map.on('click', (e) => {
        this.epicenter.set({ lat: e.latlng.lat, lng: e.latlng.lng });
        this.epicenterCursor?.setLatLng(e.latlng);
    });
  }

  // --- Controls ---
  toggleTools() { 
      this.showTools.update(v => !v); 
      setTimeout(() => this.map?.invalidateSize(), 300);
  }
  toggleMute() { this.isMuted.set(this.audio.toggleMute()); }
  toggleShowStations() { this.showStations.update(v => !v); }
  toggleShowWaves() { this.showWaves.update(v => !v); }
  toggleMobileControls() { 
      this.showMobileControls.update(v => !v); 
      setTimeout(() => this.map?.invalidateSize(), 300);
  }
  closeStationPopup() { this.selectedStation.set(null); }
  
  setMagnitude(e: any) { this.magnitude.set(parseFloat(e.target.value)); }
  setDepth(e: any) { this.depth.set(parseInt(e.target.value)); }

  applyPreset(preset: string | any) {
    if (typeof preset === 'object') {
        this.magnitude.set(preset.magnitude);
        this.depth.set(preset.depth);
        this.epicenter.set({ lat: preset.lat, lng: preset.lng });
        this.epicenterCursor?.setLatLng([preset.lat, preset.lng]);
        return;
    }
    if (preset === '921') {
        this.magnitude.set(7.6);
        this.depth.set(8);
        this.epicenter.set({ lat: 23.85, lng: 120.82 });
    } else if (preset === '0403') {
        this.magnitude.set(7.4);
        this.depth.set(15);
        this.epicenter.set({ lat: 23.77, lng: 121.67 });
    }
    this.epicenterCursor?.setLatLng([this.epicenter().lat, this.epicenter().lng]);
  }

  // --- Multi-Event Simulation Logic ---
  spawnEarthquake() {
    if (!this.map || this.stations().length === 0) return;
    
    const eventId = `EQ-${Date.now()}`;
    const startT = this.isSimulating() ? this.elapsedTime() : 0;
    
    const type = this.activeEvents().length === 0 ? 'MAIN' : 'AFTERSHOCK';

    const sortedImpacts = this.physics.calculateEventImpacts(
        this.stations(), 
        this.epicenter(), 
        this.magnitude(), 
        this.depth()
    );

    const pWave = L.circle(this.epicenter(), { radius: 0, color: '#fbbf24', fill: false, weight: 1, dashArray: '4,4' }).addTo(this.map);
    const sWave = L.circle(this.epicenter(), { radius: 0, color: '#dc2626', fillColor: '#dc2626', fillOpacity: 0.1, weight: 2 }).addTo(this.map);
    
    const marker = L.marker(this.epicenter(), {
         icon: L.divIcon({
            className: 'quake-marker',
            html: `<div class="animate-ping-slow" style="width:20px;height:20px;background:transparent;border:2px solid red;border-radius:50%;"></div>
                   <div style="position:absolute;top:6px;left:6px;width:8px;height:8px;background:red;border-radius:50%;"></div>`,
            iconSize: [20, 20],
            iconAnchor: [10, 10]
         })
    }).addTo(this.map);

    const newEvent: ActiveEvent = {
        id: eventId,
        type: type, 
        magnitude: this.magnitude(),
        depth: this.depth(),
        lat: this.epicenter().lat,
        lng: this.epicenter().lng,
        startTime: startT,
        sortedImpacts: sortedImpacts,
        nextPIndex: 0,
        nextSIndex: 0,
        marker,
        pWaveCircle: pWave,
        sWaveCircle: sWave,
        triggeredInland: 0,
        triggeredOffshore: 0,
        firstTriggerTime: null,
        processingDelay: 5 + Math.random() * 2, // 5-7 seconds random delay
        maxLocalIntensity: 0,
        alerted: false,
        dismissed: false
    };

    this.activeEvents.update(events => [...events, newEvent]);
    this.reportNum.update(n => n + 1);
    this.systemStatus.set('偵測中 (DETECTING)');
    this.audio.playTriggerSound();
    
    // Set Epicenter Name for Phone (Updated to use Physics Regions)
    const regionName = this.physics.getRegionName(newEvent.lat, newEvent.lng);
    this.epicenterLocationName.set(regionName);

    // Check Tsunami Condition based on updated physics isOffshore
    const isOffshore = this.physics.isOffshore(newEvent.lat, newEvent.lng);
    if (this.magnitude() >= 7.0 && this.depth() < 40 && isOffshore) {
        this.tsunamiAlert.set(true);
    }

    // Move cursor slightly to simulate variation/chaos
    this.epicenter.update(c => ({ lat: c.lat + (Math.random()-0.5)*0.05, lng: c.lng + (Math.random()-0.5)*0.05 }));
    this.epicenterCursor?.setLatLng(this.epicenter());

    if (!this.isSimulating()) {
        this.startSimulationLoop();
    }
  }

  // Trigger Alarm Smartly - Prevents Overlap
  triggerAlarm(event: ActiveEvent) {
      const now = Date.now();
      
      // Stop any existing siren if we need to play a new one, 
      // but only if it's a MAIN event or if sufficient time passed.
      if (now - this.lastAlarmTime < 5000) {
           if (event.type === 'MAIN') {
               // FORCE PRIORITY: Stop existing, play new
               this.audio.stopSiren();
               setTimeout(() => this.audio.playPWSSiren(), 100);
               this.lastAlarmTime = now;
           }
           return;
      }
      
      // Normal case: Play
      this.audio.stopSiren(); // Ensure clean slate
      setTimeout(() => this.audio.playPWSSiren(), 100);
      this.lastAlarmTime = now;
  }

  emergencyStop() {
      if (this.animFrameId) cancelAnimationFrame(this.animFrameId);
      this.isSimulating.set(false);
      this.systemStatus.set('結束 (ENDED)');
  }
  
  dismissTsunami() {
      this.tsunamiAlert.set(false);
  }

  // --- Optimized Visual Helper ---
  updateStationVisual(id: string, peakMMI: number, liveMMI: number) {
    const marker = this.stationMarkers[id];
    if (!marker) return;

    if (peakMMI <= 0.1) {
        // Reset to default
        const s = this.stations().find(x => x.id === id);
        let color = '#334155';
        if (s?.terrain === 'BASIN') color = '#475569';
        if (s?.terrain === 'OFFSHORE') color = '#0f766e';
        if (s?.isMajor) color = '#f59e0b';
        
        marker.setStyle({
            radius: s?.isMajor ? 3 : 0.6, 
            fillColor: color,
            color: 'transparent',
            fillOpacity: s?.isMajor ? 0.9 : 0.6,
            weight: 0
        });
        if (marker.isTooltipOpen()) marker.closeTooltip();
    } else {
        const cwaIntensity = this.physics.toCWAIntensity(peakMMI);
        const color = this.physics.getCWAIntensityColorHex(cwaIntensity);
        const isMajor = this.stations().find(x => x.id === id)?.isMajor;
        
        const damageSize = peakMMI > 2.5 ? 2.0 : 0; 
        const pulseSize = liveMMI > 0 ? (liveMMI * 0.6 + 1.5) : 0; 
        const baseSize = isMajor ? 6 : 1.5;
        
        marker.setStyle({
            fillColor: color,
            radius: Math.max(baseSize + damageSize, pulseSize), 
            fillOpacity: 0.9,
            color: 'white',
            weight: 0.5
        });
    }
  }

  startSimulationLoop() {
      this.isSimulating.set(true);
      this.elapsedTime.set(0);
      this.triggeredStations.set(0);
      this.inlandTriggerCount.set(0);
      this.offshoreTriggerCount.set(0);
      this.showMobileControls.set(false);
      this.eewReports.set([]);
      this.predictedMagnitude.set('---');
      this.predictedMaxIntensity.set('---');
      this.lastReportNum.set(0);
      this.currentPGA.set(0);
      this.selectedStation.set(null);
      this.tsunamiAlert.set(false);
      this.railwayAlert.set(false);
      
      // Reset 4 Specific Alerts
      this.fabAlert.set(false);
      this.mrtAlert.set(false);
      this.nuclearAlert.set(false);
      this.gasAlert.set(false);

      this.mainCountdowns.set([]);
      this.secondaryCountdowns.set([]);
      this.railBrakingTime.set(0);
      
      Object.values(this.stationMarkers).forEach(m => {
        m.setRadius(0.6).setStyle({ fillColor: '#334155', color: 'transparent', fillOpacity: 0.5 });
        if (m.isTooltipOpen()) m.closeTooltip();
      });
      this.stationCurrentMaxMMI = {};
      this.stationLiveMMI = {};

      const realStartTime = Date.now();
      this.lastReportTime = 0;
      this.lastDataUpdateTime = 0;
      this.frameCount = 0;
      this.lastAlarmTime = 0;

      const loop = () => {
          if (this.activeEvents().length === 0) return;
          this.frameCount++;

          const now = Date.now();
          const globalElapsed = (now - realStartTime) / 1000 * this.SIM_SPEED;
          this.elapsedTime.set(globalElapsed);

          // Update Rail Braking Countdown
          if (this.railwayAlert() && this.railBrakingTime() > 0) {
              this.railBrakingTime.update(t => Math.max(0, t - 0.05));
          }

          const dirtyStations = new Set<string>();

          // --- 1. Realistic Decay Loop ---
          const liveIds = Object.keys(this.stationLiveMMI);
          liveIds.forEach(id => {
               const val = this.stationLiveMMI[id];
               if (val > 0) {
                   const newVal = val * 0.95; 
                   this.stationLiveMMI[id] = newVal > 0.05 ? newVal : 0;
                   dirtyStations.add(id);
                   if (this.stationLiveMMI[id] <= 0) {
                       delete this.stationLiveMMI[id];
                   }
               }
          });

          const cityStats: {[name: string]: {seconds: number, intensity: number, id: string, name: string, type: 'MAIN'|'AFTERSHOCK'}} = {};

          // --- 2. Physics & Event Impact Loop ---
          this.activeEvents().forEach(event => {
              const eventElapsed = globalElapsed - event.startTime;
              if (eventElapsed < 0) return;

              if (this.showWaves()) {
                  event.pWaveCircle?.setRadius(eventElapsed * this.physics.VP_BASE * 1000);
                  event.sWaveCircle?.setRadius(eventElapsed * this.physics.VS_BASE * 1000);
              }

              // --- A. P-Wave Processing (Detection) ---
              while(event.nextPIndex < event.sortedImpacts.length) {
                  const sData = event.sortedImpacts[event.nextPIndex];
                  
                  // STRICT PHYSICS: Only detect if P-wave has arrived
                  if (eventElapsed < sData.pTime) break;

                  // P-wave Intensity Check (Attenuation)
                  // If P-wave intensity is too low (< 0.5 CWA), it might not trigger the sensor immediately
                  if (sData.pMaxMMI > 0.5) {
                      if (sData.region === 'INLAND') event.triggeredInland++;
                      else event.triggeredOffshore++;
                      
                      // Visual P-Wave pulse
                      const pIntensity = sData.pMaxMMI;
                      if (pIntensity > (this.stationLiveMMI[sData.id] || 0)) {
                          this.stationLiveMMI[sData.id] = pIntensity;
                          dirtyStations.add(sData.id);
                      }
                      const currentPeak = this.stationCurrentMaxMMI[sData.id] || 0;
                      if (pIntensity > currentPeak) {
                          this.stationCurrentMaxMMI[sData.id] = pIntensity;
                          dirtyStations.add(sData.id);
                      }
                  }

                  event.nextPIndex++;
              }

              // --- B. S-Wave Processing (Damage) ---
              while(event.nextSIndex < event.sortedImpacts.length) {
                  const sData = event.sortedImpacts[event.nextSIndex];
                  if (eventElapsed < sData.sTime) break;

                  const sIntensity = sData.maxMMI;
                  
                  const currentPeak = this.stationCurrentMaxMMI[sData.id] || 0;
                  if (sIntensity > currentPeak) {
                      this.stationCurrentMaxMMI[sData.id] = sIntensity;
                      dirtyStations.add(sData.id);
                  }

                  if (sIntensity > (this.stationLiveMMI[sData.id] || 0)) {
                      this.stationLiveMMI[sData.id] = sIntensity;
                      dirtyStations.add(sData.id);
                  }
                  
                  event.maxLocalIntensity = Math.max(event.maxLocalIntensity, sIntensity);
                  event.nextSIndex++;
              }
              
              // --- TRIGGER LOGIC (Refined for Inland vs Offshore) ---
              const totalTriggers = event.triggeredInland + event.triggeredOffshore;
              const threshold = (event.triggeredOffshore > event.triggeredInland) ? 10 : 15;

              // Phase 1: Detection
              if (totalTriggers > threshold && !event.firstTriggerTime) {
                  event.firstTriggerTime = globalElapsed;
                  this.systemStatus.set('計算中 (COMPUTING)');
              }

              // Phase 2: Processing Delay (5-7 seconds)
              if (event.firstTriggerTime && !event.alerted && !event.dismissed) {
                  const delay = globalElapsed - event.firstTriggerTime;
                  // Wait until processingDelay is reached before alerting
                  if (delay >= event.processingDelay) { 
                       // STRICT CRITERIA: Mag >= 4.5 AND Intensity >= 4 (MMI >= 3.5)
                       if (event.magnitude >= 4.5 && event.maxLocalIntensity >= 3.5) {
                           event.alerted = true;
                           this.systemStatus.set('發布警報 (ALERTING)');
                           this.triggerAlarm(event); 
                       } else {
                           event.dismissed = true; // Mark as dismissed so we don't check again
                           // Keep system status as COMPUTING or switch to DETECTING, or IDLE if single event
                           // But usually we just let it run silently.
                       }
                  }
              }

              // --- Countdown Calculation ---
              // CRITICAL UPDATE: Only calculate and show countdowns IF the alert has been issued
              if (event.alerted) {
                  event.sortedImpacts.forEach(impact => {
                      if (impact.isMajor) {
                          const timeToS = impact.sTime - eventElapsed;
                          if (impact.maxMMI > 1.5) {
                              const key = `${impact.name}-${event.type}`;
                              
                              // Clamp countdown to 0, never negative
                              const displaySeconds = Math.max(0, timeToS);
                              
                              if (!cityStats[key] || (displaySeconds < cityStats[key].seconds)) {
                                  cityStats[key] = {
                                      seconds: displaySeconds,
                                      intensity: impact.maxMMI,
                                      id: impact.id,
                                      name: impact.name,
                                      type: event.type
                                  };
                              }
                          }
                      }
                  });
              }
          });
          
          // --- 3. Optimized Batch Visual Update ---
          dirtyStations.forEach(id => {
              this.updateStationVisual(
                  id, 
                  this.stationCurrentMaxMMI[id] || 0, 
                  this.stationLiveMMI[id] || 0
              );
          });

          // Background Refresh Strategy
          const stationIds = Object.keys(this.stationMarkers);
          const sliceSize = 100;
          const startIndex = (this.frameCount * sliceSize) % stationIds.length;
          const endIndex = Math.min(startIndex + sliceSize, stationIds.length);
          for (let i = startIndex; i < endIndex; i++) {
              const id = stationIds[i];
              if (!dirtyStations.has(id)) {
                  const peak = this.stationCurrentMaxMMI[id] || 0;
                  const live = this.stationLiveMMI[id] || 0;
                  if (peak > 0 || live > 0) {
                      this.updateStationVisual(id, peak, live);
                  }
              }
          }

          // UI Updates
          const allCountdowns: CityCountdown[] = Object.values(cityStats)
            .map(data => ({
                name: data.name,
                seconds: data.seconds,
                intensity: this.physics.toCWAIntensity(data.intensity),
                color: this.physics.getCWAIntensityColorHex(this.physics.toCWAIntensity(data.intensity)),
                eventType: data.type
            }))
            .filter(c => c.seconds > 0 || c.seconds === 0) // Only keep valid countdowns
            .sort((a, b) => a.seconds - b.seconds);
          
          this.mainCountdowns.set(allCountdowns.filter(c => c.eventType === 'MAIN').slice(0, 5));
          this.secondaryCountdowns.set(allCountdowns.filter(c => c.eventType === 'AFTERSHOCK').slice(0, 5));
          
          const triggeredKeys = Object.keys(this.stationCurrentMaxMMI);
          this.triggeredStations.set(triggeredKeys.length);

          // Update specific counts for UI
          const events = this.activeEvents();
          if (events.length > 0) {
              const main = events[0];
              this.inlandTriggerCount.set(main.triggeredInland);
              this.offshoreTriggerCount.set(main.triggeredOffshore);
          }
          
          let currentMaxMMI_numeric = 0;
          if (triggeredKeys.length > 0) {
             currentMaxMMI_numeric = Math.max(0, ...Object.values(this.stationCurrentMaxMMI));
             this.maxDetectedIntensity.set(this.physics.toCWAIntensity(currentMaxMMI_numeric));
          }

          // --- EEW System Logic ---
          if (globalElapsed - this.lastReportTime > 0.6 && triggeredKeys.length > 5) {
             this.lastReportTime = globalElapsed;
             
             let estimatedMagSum = 0;
             let count = 0;
             
             const evt = this.activeEvents()[0]; 
             if (evt) {
                 const isOffshore = this.physics.isOffshore(evt.lat, evt.lng);
                 
                 // --- NEW 4 ALERTS LOGIC (Cascading Intensity) ---
                 // 1. Semiconductor Fabs (Very Sensitive)
                 if (currentMaxMMI_numeric > 2.5 && !this.fabAlert()) this.fabAlert.set(true);

                 // 2. MRT/Metro (Moderate)
                 if (currentMaxMMI_numeric > 3.5 && !this.mrtAlert()) this.mrtAlert.set(true);

                 // 3. Nuclear (High)
                 if (currentMaxMMI_numeric > 4.5 || evt.magnitude > 6.0) {
                    if (!this.nuclearAlert()) this.nuclearAlert.set(true);
                 }

                 // 4. Gas (Extreme)
                 if (currentMaxMMI_numeric > 5.0) {
                     if (!this.gasAlert()) this.gasAlert.set(true);
                 }

                 // Original Railway Logic
                 if (!this.railwayAlert() && (currentMaxMMI_numeric > 3.5 || evt.magnitude > 5.5)) {
                     this.railwayAlert.set(true);
                     this.railBrakingTime.set(90);
                 }

                 triggeredKeys.forEach(sid => {
                    const mmi = this.stationCurrentMaxMMI[sid];
                    const station = this.stations().find(s => s.id === sid);
                    if (station && mmi > 1.8) { 
                         const dist = this.physics.calculateDistance(evt.lat, evt.lng, station.lat, station.lng);
                         
                         // --- P-WAVE DEPTH & MAGNITUDE PREDICTION ---
                         // New P-wave logic implementation for depth convergence and magnitude inversion
                         
                         // 1. Depth Estimation (Grid Search Simulation)
                         // Start with default shallow (10km) and converge to real depth as station count increases
                         let estimatedDepth = 10;
                         const stationCount = triggeredKeys.length;
                         
                         if (stationCount > 25) {
                             // High confidence - Converged close to reality
                             estimatedDepth = evt.depth * (0.95 + Math.random() * 0.1);
                         } else if (stationCount > 10) {
                             // Medium confidence - Transitioning
                             const factor = (stationCount - 10) / 15; 
                             estimatedDepth = (10 * (1 - factor)) + (evt.depth * factor) + (Math.random() - 0.5) * 5;
                         } else {
                             // Low confidence - Shallow assumption dominant
                             estimatedDepth = 10 + (Math.random() - 0.5) * 3;
                         }
                         estimatedDepth = Math.max(0, estimatedDepth);

                         // 2. Magnitude Estimation (Attenuation Inversion)
                         // Calculate Hypocentral Distance using ESTIMATED depth
                         const R = Math.sqrt(dist * dist + estimatedDepth * estimatedDepth); 
                         
                         // Inverted Attenuation Formula adjusted for P-wave/Early Phase
                         // EstMag = (Intensity + C1*log(R) + C2*R + C3) / Scale
                         const estMag = (mmi + 4.1 * Math.log10(R) + 0.0015 * R - 0.2) / 1.62;
                         
                         estimatedMagSum += estMag;
                         count++;
                    }
                 });

                 if (count > 0) {
                     const avgMag = estimatedMagSum / count;
                     const trustFactor = Math.min(count / 15, 0.95); 
                     const smoothedMag = avgMag * trustFactor + (evt.magnitude || 0) * (1 - trustFactor);
                     
                     const newReport: EEWReport = {
                         id: `REP-${Date.now()}`,
                         reportNum: this.eewReports().length + 1,
                     time: globalElapsed,
                     mag: parseFloat(smoothedMag.toFixed(1)),
                     depth: evt.depth, // Reported depth implies the system's current best estimate
                     stations: count,
                     isOffshore: isOffshore
                 };
                 
                 this.eewReports.update(reps => [...reps, newReport]);
                 this.predictedMagnitude.set(`M${newReport.mag}`);
                 this.lastReportNum.set(newReport.reportNum);
                 
                 const predictedMMIVal = this.physics.calculateMMI(smoothedMag, 0, evt.depth, 'BASIN', 'S', false);
                 this.predictedMaxIntensity.set(this.physics.toCWAIntensity(predictedMMIVal));
                 }
             }
          }

          // --- Data Matrix Update ---
          if (globalElapsed - this.lastDataUpdateTime > 0.5) {
             this.lastDataUpdateTime = globalElapsed;
             const newData = [...this.sensorMatrix()];
             for(let i=0; i<300; i++) {
                 const idx = Math.floor(Math.random() * 1000);
                 const baseNoise = this.triggeredStations() > 50 ? 100 : 5;
                 const noise = Math.random() * baseNoise;
                 newData[idx] = noise;
             }
             this.sensorMatrix.set(newData);

             if (currentMaxMMI_numeric > 0) {
                 const estimatedMaxPGA = this.physics.estimatePGA(currentMaxMMI_numeric);
                 this.currentPGA.set(estimatedMaxPGA);
             } else {
                 this.currentPGA.set(Math.random() * 0.5);
             }
          }

          if (globalElapsed > 300) {
              this.finishSimulation();
              return;
          }

          this.animFrameId = requestAnimationFrame(loop);
      };
      
      this.animFrameId = requestAnimationFrame(loop);
  }

  async finishSimulation() {
      if (this.animFrameId) cancelAnimationFrame(this.animFrameId);
      this.isSimulating.set(false);
      this.systemStatus.set('結束 (ENDED)');
      this.mainCountdowns.set([]);
      this.secondaryCountdowns.set([]);
      this.aiAnalysis.set(null);
      this.audio.stopSiren();
      
      const maxIntensity = this.physics.toCWAIntensity(
        Math.max(0, ...Object.values(this.stationCurrentMaxMMI))
      );
      
      if (this.activeEvents().length > 1) {
          const analysis = await this.gemini.analyzeComplexScenario(this.activeEvents());
          this.aiAnalysis.set(analysis);
      } else if (this.activeEvents().length === 1) {
          const evt = this.activeEvents()[0];
           const analysis = await this.gemini.analyzeSimulation(
              evt.magnitude, evt.depth, {lat: evt.lat, lng: evt.lng}, parseInt(maxIntensity, 10)
          );
          this.aiAnalysis.set(analysis);
      }
  }

  resetSimulation() {
      if (this.animFrameId) cancelAnimationFrame(this.animFrameId);
      this.activeEvents().forEach(e => {
          e.marker?.remove();
          e.pWaveCircle?.remove();
          e.sWaveCircle?.remove();
      });
      this.activeEvents.set([]);
      
      this.systemStatus.set('待命 (IDLE)');
      this.elapsedTime.set(0);
      this.showMobileControls.set(false);
      this.selectedStation.set(null);
      
      Object.values(this.stationMarkers).forEach(m => {
        m.setRadius(0.6).setStyle({ fillColor: '#334155', color: 'transparent', fillOpacity: 0.5 });
        if(m.isTooltipOpen()) m.closeTooltip();
      });
      
      this.stationCurrentMaxMMI = {};
      this.stationLiveMMI = {}; 
      this.eewReports.set([]);
      this.predictedMagnitude.set('---');
      this.predictedMaxIntensity.set('---');
      this.currentPGA.set(0);
      this.tsunamiAlert.set(false);
      this.railwayAlert.set(false);
      
      // Reset Alerts
      this.nuclearAlert.set(false);
      this.fabAlert.set(false);
      this.mrtAlert.set(false);
      this.gasAlert.set(false);

      this.mainCountdowns.set([]);
      this.secondaryCountdowns.set([]);
      this.audio.stopSiren();
  }

  async loadRecentQuakes() {
    this.isLoadingRecents.set(true);
    const quakes = await this.gemini.getRecentQuakes();
    if (quakes && quakes.length > 0) {
        this.recentQuakes.set(quakes);
    }
    this.isLoadingRecents.set(false);
  }
}