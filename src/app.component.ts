import { Component, OnInit, ElementRef, ViewChild, signal, effect, inject, afterNextRender, computed, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PhysicsService, Station, SimulationStationData } from './services/physics.service';
import { AudioService } from './services/audio.service';
import { GeminiService } from './services/gemini.service';
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

  triggeredStationCount: number;
  maxLocalIntensity: number;
  alerted: boolean; 
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
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './app.component.html',
})
export class AppComponent implements OnInit {
  physics = inject(PhysicsService);
  audio = inject(AudioService);
  gemini = inject(GeminiService);

  // --- Global State ---
  stations = signal<Station[]>([]);
  
  // Current Settings
  magnitude = signal(7.2);
  depth = signal(12);
  epicenter = signal({ lat: 23.85, lng: 120.9 });
  
  // Simulation State
  isSimulating = signal(false);
  activeEvents = signal<ActiveEvent[]>([]);
  elapsedTime = signal(0);
  systemStatus = signal<'待命 (IDLE)' | '偵測中 (DETECTING)' | '發布警報 (ALERTING)' | '結束 (ENDED)'>('待命 (IDLE)');
  
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
  reportNum = signal(0);
  maxDetectedIntensity = signal('1級');
  currentPGA = signal(0); 
  tsunamiAlert = signal(false);
  railwayAlert = signal(false);
  cityCountdowns = signal<CityCountdown[]>([]);

  // Computed
  maxEventMagnitude = computed(() => {
    const events = this.activeEvents();
    if (events.length === 0) return 0;
    return Math.max(...events.map(e => e.magnitude));
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

  @HostListener('window:resize')
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
        triggeredStationCount: 0,
        maxLocalIntensity: 0,
        alerted: false 
    };

    this.activeEvents.update(events => [...events, newEvent]);
    this.reportNum.update(n => n + 1);
    this.systemStatus.set('偵測中 (DETECTING)');
    this.audio.playTriggerSound();
    
    // Check Tsunami Condition based on updated physics isOffshore
    const currentLat = this.epicenter().lat;
    const currentLng = this.epicenter().lng;
    const isOffshore = this.physics.isOffshore(currentLat, currentLng);
    
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

  // Trigger Alarm Smartly
  triggerAlarm(event: ActiveEvent) {
      const now = Date.now();
      // Smart Sequencing:
      // If alarm played recently (within 5 sec), skip UNLESS it's a MAIN event overriding an aftershock
      if (now - this.lastAlarmTime < 5000) {
           if (event.type === 'MAIN') {
               // Force override if main shock detected during aftershock sequence
               this.audio.playPWSSiren();
               this.lastAlarmTime = now;
           }
           return;
      }
      
      this.audio.playPWSSiren();
      this.lastAlarmTime = now;
  }

  emergencyStop() {
      if (this.animFrameId) cancelAnimationFrame(this.animFrameId);
      this.isSimulating.set(false);
      this.systemStatus.set('結束 (ENDED)');
      // Do not clear visual state immediately so user can see what happened
  }
  
  dismissTsunami() {
      this.tsunamiAlert.set(false);
  }

  // --- Optimized Visual Helper ---
  updateStationVisual(id: string, peakMMI: number, liveMMI: number) {
    const marker = this.stationMarkers[id];
    if (!marker) return;

    if (peakMMI <= 0.1) {
        // Reset to default - Optimized for 4000 stations
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
      this.showMobileControls.set(false);
      this.eewReports.set([]);
      this.predictedMagnitude.set('---');
      this.predictedMaxIntensity.set('---');
      this.lastReportNum.set(0);
      this.currentPGA.set(0);
      this.selectedStation.set(null);
      this.tsunamiAlert.set(false);
      this.railwayAlert.set(false);
      this.cityCountdowns.set([]);
      
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

          // Track which stations need a visual update THIS frame
          const dirtyStations = new Set<string>();

          // --- 1. Realistic Decay Loop (Decays Live MMI only) ---
          const liveIds = Object.keys(this.stationLiveMMI);
          liveIds.forEach(id => {
               const val = this.stationLiveMMI[id];
               if (val > 0) {
                   const newVal = val * 0.95; 
                   
                   this.stationLiveMMI[id] = newVal > 0.05 ? newVal : 0;
                   dirtyStations.add(id); // Needs update because value changed

                   if (this.stationLiveMMI[id] <= 0) {
                       delete this.stationLiveMMI[id];
                       // Keep it in dirty one last time to reset visual
                   }
               }
          });

          const cityStats: {[name: string]: {seconds: number, intensity: number, id: string}} = {};

          // --- 2. Physics & Event Impact Loop ---
          this.activeEvents().forEach(event => {
              const eventElapsed = globalElapsed - event.startTime;
              if (eventElapsed < 0) return;

              if (this.showWaves()) {
                  event.pWaveCircle?.setRadius(eventElapsed * this.physics.VP * 1000);
                  event.sWaveCircle?.setRadius(eventElapsed * this.physics.VS * 1000);
              }

              // --- A. P-Wave Processing ---
              const pWaveDist = eventElapsed * this.physics.VP;
              while(event.nextPIndex < event.sortedImpacts.length) {
                  const sData = event.sortedImpacts[event.nextPIndex];
                  if (sData.dist > pWaveDist) break; 

                  const pIntensity = sData.maxMMI * 0.15; 
                  event.triggeredStationCount++; 
                  
                  if (pIntensity > (this.stationLiveMMI[sData.id] || 0)) {
                      this.stationLiveMMI[sData.id] = pIntensity;
                      dirtyStations.add(sData.id); // Mark dirty
                  }
                  
                  const currentPeak = this.stationCurrentMaxMMI[sData.id] || 0;
                  if (pIntensity > currentPeak) {
                      this.stationCurrentMaxMMI[sData.id] = pIntensity;
                      dirtyStations.add(sData.id); // Mark dirty
                  }

                  event.nextPIndex++;
              }

              // --- B. S-Wave Processing ---
              const sWaveDist = eventElapsed * this.physics.VS;
              while(event.nextSIndex < event.sortedImpacts.length) {
                  const sData = event.sortedImpacts[event.nextSIndex];
                  if (sData.dist > sWaveDist) break;

                  const sIntensity = sData.maxMMI;
                  
                  const currentPeak = this.stationCurrentMaxMMI[sData.id] || 0;
                  if (sIntensity > currentPeak) {
                      this.stationCurrentMaxMMI[sData.id] = sIntensity;
                      dirtyStations.add(sData.id); // Mark dirty
                  }

                  if (sIntensity > (this.stationLiveMMI[sData.id] || 0)) {
                      this.stationLiveMMI[sData.id] = sIntensity;
                      dirtyStations.add(sData.id); // Mark dirty
                  }
                  
                  event.maxLocalIntensity = Math.max(event.maxLocalIntensity, sIntensity);

                  // Update Tooltip Logic (Only for significant events to save performance)
                  if (sIntensity >= 0.5) {
                        const marker = this.stationMarkers[sData.id];
                        if (marker) {
                            const cwaIntensity = this.physics.toCWAIntensity(sIntensity);
                            const sTimeVal = sData.sTime.toFixed(1);
                            const htmlContent = `
                                <div class="flex flex-col items-center leading-none">
                                    <span class="text-lg">${cwaIntensity}</span>
                                    <span class="text-[9px] text-red-300 font-bold mt-0.5">S: ${sTimeVal}s</span>
                                </div>
                            `;
                            marker.setTooltipContent(htmlContent);
                            
                            // Auto-open restricted
                            if (sIntensity >= 2.5 && !marker.isTooltipOpen() && this.triggeredStations() < 200) {
                                marker.openTooltip(); 
                            }
                        }
                  }
                  event.nextSIndex++;
              }
              
              if (event.triggeredStationCount > 20 && !event.alerted) {
                  event.alerted = true;
                  this.systemStatus.set('發布警報 (ALERTING)');
                  this.triggerAlarm(event); // Use smart alarm trigger
              }

              // --- S-Wave Countdown Calculation for Cities ---
              event.sortedImpacts.forEach(impact => {
                  if (impact.isMajor) {
                      const timeToS = impact.sTime - eventElapsed;
                      // Only care if intensity is relevant (> CWA 1) and S-wave hasn't passed long ago
                      if (impact.maxMMI > 1.5) {
                          if (!cityStats[impact.name] || (timeToS < cityStats[impact.name].seconds && timeToS > -30)) {
                              cityStats[impact.name] = {
                                  seconds: timeToS,
                                  intensity: impact.maxMMI,
                                  id: impact.id
                              };
                          }
                      }
                  }
              });
          });
          
          // --- 3. Optimized Batch Visual Update ---
          
          // Strategy: Only update stations marked as 'dirty' this frame.
          // This reduces updates from 4000 to ~50-200 per frame during wave propagation.
          dirtyStations.forEach(id => {
              this.updateStationVisual(
                  id, 
                  this.stationCurrentMaxMMI[id] || 0, 
                  this.stationLiveMMI[id] || 0
              );
          });

          // Background Refresh Strategy:
          // Update a small slice of idle stations every frame to ensure consistency 
          // (e.g., in case they were missed or need reset).
          // 4000 stations / 100 per frame = 40 frames (~0.7s) to cycle full map.
          const stationIds = Object.keys(this.stationMarkers);
          const sliceSize = 100;
          const startIndex = (this.frameCount * sliceSize) % stationIds.length;
          const endIndex = Math.min(startIndex + sliceSize, stationIds.length);
          
          for (let i = startIndex; i < endIndex; i++) {
              const id = stationIds[i];
              // Only update if NOT dirty (dirty ones were already handled)
              if (!dirtyStations.has(id)) {
                  // Only force update if it has some state, otherwise leave it default
                  const peak = this.stationCurrentMaxMMI[id] || 0;
                  const live = this.stationLiveMMI[id] || 0;
                  // If it has intensity, we refresh it just in case. 
                  // If peak is 0 and it's not dirty, it's likely already in default state.
                  if (peak > 0 || live > 0) {
                      this.updateStationVisual(id, peak, live);
                  }
              }
          }

          // UI Updates
          // Convert cityStats map to array for UI
          const countdowns: CityCountdown[] = Object.entries(cityStats)
            .map(([name, data]) => ({
                name,
                seconds: data.seconds,
                intensity: this.physics.toCWAIntensity(data.intensity),
                color: this.physics.getCWAIntensityColorHex(this.physics.toCWAIntensity(data.intensity))
            }))
            .filter(c => c.seconds < 60 && c.seconds > -20)
            .sort((a, b) => a.seconds - b.seconds)
            .slice(0, 8); // Show top 8 closest (As requested)

          this.cityCountdowns.set(countdowns);
          
          const triggeredKeys = Object.keys(this.stationCurrentMaxMMI);
          this.triggeredStations.set(triggeredKeys.length);
          
          let currentMaxMMI_numeric = 0;
          if (triggeredKeys.length > 0) {
             currentMaxMMI_numeric = Math.max(0, ...Object.values(this.stationCurrentMaxMMI));
             this.maxDetectedIntensity.set(this.physics.toCWAIntensity(currentMaxMMI_numeric));
          }

          // --- EEW System Logic (Update 1-2 times per sec) ---
          if (globalElapsed - this.lastReportTime > 0.6 && triggeredKeys.length > 5) {
             this.lastReportTime = globalElapsed;
             
             let estimatedMagSum = 0;
             let count = 0;
             
             const evt = this.activeEvents()[0]; 
             if (evt) {
                 const isOffshore = this.physics.isOffshore(evt.lat, evt.lng);
                 
                 // Smart Railway/Train Stop Logic
                 // If intensity is significant (3.5+) or Mag > 5.5, trigger rail stop
                 if (!this.railwayAlert() && (currentMaxMMI_numeric > 3.5 || evt.magnitude > 5.5)) {
                     this.railwayAlert.set(true);
                 }

                 triggeredKeys.forEach(sid => {
                    const mmi = this.stationCurrentMaxMMI[sid];
                    const station = this.stations().find(s => s.id === sid);
                    if (station && mmi > 1.8) { 
                         const dist = this.physics.calculateDistance(evt.lat, evt.lng, station.lat, station.lng);
                         // Robust inversion of attenuation formula
                         const depth = evt.depth || 10;
                         const R = Math.sqrt(dist * dist + depth * depth); 
                         const estMag = (mmi + 3.8 * Math.log10(R) + 0.002 * R) / 1.7;
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
                     depth: evt.depth, 
                     stations: count,
                     isOffshore: isOffshore
                 };
                 
                 this.eewReports.update(reps => [...reps, newReport]); // Append to end for scrolling log
                 this.predictedMagnitude.set(`M${newReport.mag}`);
                 this.lastReportNum.set(newReport.reportNum);
                 
                 // Predict max intensity for major cities based on this report
                 const predictedMMIVal = this.physics.calculateMMI(smoothedMag, 0, evt.depth, 'BASIN', false);
                 this.predictedMaxIntensity.set(this.physics.toCWAIntensity(predictedMMIVal));
                 }
             }
          }

          // --- Data Matrix Update & Real-time PGA Update (Approx 2Hz) ---
          if (globalElapsed - this.lastDataUpdateTime > 0.5) {
             this.lastDataUpdateTime = globalElapsed;
             
             // Update sensor matrix visual - Generate 1000 float values for professional look
             const newData = [...this.sensorMatrix()];
             for(let i=0; i<300; i++) {
                 const idx = Math.floor(Math.random() * 1000);
                 const baseNoise = this.triggeredStations() > 50 ? 100 : 5;
                 const noise = Math.random() * baseNoise;
                 newData[idx] = noise; // Float value
             }
             this.sensorMatrix.set(newData);

             // Update Panel PGA (Simulating Live max read)
             // In reality, this would be the max of all stations currently
             if (currentMaxMMI_numeric > 0) {
                 const estimatedMaxPGA = this.physics.estimatePGA(currentMaxMMI_numeric);
                 this.currentPGA.set(estimatedMaxPGA);
             } else {
                 this.currentPGA.set(Math.random() * 0.5); // noise
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
      this.cityCountdowns.set([]);
      this.aiAnalysis.set(null);
      
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
      this.cityCountdowns.set([]);
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