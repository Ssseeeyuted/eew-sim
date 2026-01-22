import { Component, OnInit, ElementRef, ViewChild, signal, effect, inject, afterNextRender, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PhysicsService, Station, SimulationStationData } from './services/physics.service';
import { AudioService } from './services/audio.service';
import { GeminiService } from './services/gemini.service';
import { PhoneAlertComponent } from './components/phone-alert.component';
import * as L from 'leaflet';

interface ActiveEvent {
  id: string;
  type: 'MAIN' | 'AFTERSHOCK' | 'VOLCANO'; 
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
  ashCircle?: L.Circle; // New Ash Cloud Visual

  triggeredInland: number;
  triggeredOffshore: number;
  
  firstTriggerTime: number | null; 
  processingDelay: number; 
  
  maxLocalIntensity: number;
  
  alerted: boolean; 
  alertTime: number | null; 
  dismissed: boolean; 
  
  tsunamiRisk: boolean; 
  tsunamiAlerted: boolean; 
  tsunamiDelay: number; 
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
    eventType: 'MAIN' | 'AFTERSHOCK' | 'VOLCANO'; 
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
  showTsunamiStations = signal(true);
  showVolcanoStations = signal(true);
  showWaves = signal(true);
  isMuted = signal(false);
  activeTab = signal('Visual');
  showMobileControls = signal(false); 
  isMobile = signal(false);
  selectedStation = signal<any>(null); 

  // Phone Simulator UI State
  isPhoneOpen = signal(true);

  // Metrics & Alerts
  triggeredStations = signal(0);
  inlandTriggerCount = signal(0);
  offshoreTriggerCount = signal(0);
  
  reportNum = signal(0);
  maxDetectedIntensity = signal('1級');
  currentPGA = signal(0); 
  
  // --- ALERTS ---
  tsunamiAlert = signal(false);
  volcanoAlert = signal(false);
  
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
      // Trigger phone popup for ANY active alert state
      return (
          this.systemStatus() === '發布警報 (ALERTING)' || 
          this.tsunamiAlert() || 
          this.volcanoAlert()
      ) && this.isSimulating();
  });
  
  sensorMatrix = signal<number[]>(Array(1000).fill(0));
  recentQuakes = signal<any[]>([]);
  isLoadingRecents = signal(false);
  aiAnalysis = signal<string | null>(null);
  
  // Image Analysis
  analyzingImage = signal(false);
  imageAnalysisResult = signal<string | null>(null);

  Math = Math;

  private map: L.Map | undefined;
  private stationMarkers: {[id: string]: L.CircleMarker} = {}; 
  private stationCurrentMaxMMI: {[id: string]: number} = {}; 
  private stationLiveMMI: {[id: string]: number} = {}; 
  private stationAshState: {[id: string]: boolean} = {};
  private stationTypeMap: {[id: string]: 'SEISMIC' | 'TSUNAMI' | 'VOLCANO'} = {};
  
  // Sensor Simulation Mapping
  private sensorStationMap: number[] = []; // Maps sensor Index (0-999) to a random Station Index

  private epicenterCursor: L.Marker | undefined;
  private animFrameId: number | null = null;
  private SIM_SPEED = 1.0; 
  private lastReportTime = 0;
  private lastDataUpdateTime = 0;
  private frameCount = 0;
  private lastAlarmTime = 0;
  
  // Audio Gears
  private currentAudioGear = 0;

  constructor() {
    this.stations.set(this.physics.getStations());
    this.generateSystemItems();
    
    // Initialize Sensor Map
    const stationCount = this.stations().length;
    if (stationCount > 0) {
        for(let i=0; i<1000; i++) {
            this.sensorStationMap[i] = Math.floor(Math.random() * stationCount);
        }
    }
    
    setInterval(() => {
        const d = new Date();
        this.currentTimeStr.set(`${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`);
    }, 1000);

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
        const seismicVisible = this.showStations();
        const tsunamiVisible = this.showTsunamiStations();
        const volcanoVisible = this.showVolcanoStations();

        Object.keys(this.stationMarkers).forEach(id => {
            const marker = this.stationMarkers[id];
            const type = this.stationTypeMap[id];
            
            let shouldShow = false;
            if (type === 'SEISMIC' && seismicVisible) shouldShow = true;
            if (type === 'TSUNAMI' && tsunamiVisible) shouldShow = true;
            if (type === 'VOLCANO' && volcanoVisible) shouldShow = true;

            if(shouldShow) marker.addTo(this.map!);
            else marker.remove();
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
  
  togglePhone() {
      this.isPhoneOpen.update(v => !v);
  }

  toggleTsunamiStations() { this.showTsunamiStations.update(v => !v); }
  toggleVolcanoStations() { this.showVolcanoStations.update(v => !v); }

  private initMap() {
    if (this.map) return;
    
    this.map = L.map('map-container', {
        zoomControl: false,
        attributionControl: false,
        preferCanvas: true, 
        fadeAnimation: false 
    }).setView([26.0, 124.0], 5);

    this.map.invalidateSize();

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
        attribution: '&copy; OSM & CartoDB'
    }).addTo(this.map);

    const myRenderer = L.canvas({ padding: 0.5 });

    this.stations().forEach(s => {
        let color = '#334155';
        let radius = 0.6;
        let opacity = 0.6;
        let weight = 0;
        let strokeColor = 'transparent';

        if (s.stationType === 'SEISMIC') {
            if (s.terrain === 'BASIN') color = '#475569';
            if (s.terrain === 'OFFSHORE') color = '#0f766e';
            if (s.isMajor) {
                color = '#f59e0b';
                radius = 3;
                opacity = 0.9;
            }
        } else if (s.stationType === 'TSUNAMI') {
            color = 'transparent'; 
            strokeColor = '#0891b2'; 
            weight = 1;
            radius = 1.5;
            opacity = 0.8;
        } else if (s.stationType === 'VOLCANO') {
            color = '#f97316'; 
            radius = 2.0;
            opacity = 1.0;
        }

        const marker = L.circleMarker([s.lat, s.lng], {
            radius: radius, 
            fillColor: color,
            color: strokeColor,
            weight: weight,
            fillOpacity: opacity,
            renderer: myRenderer
        }).addTo(this.map!);
        
        marker.bindTooltip('', { 
            permanent: false, 
            direction: 'top', 
            offset: [0, -5], 
            opacity: 1, 
            className: 'intensity-tooltip' 
        });

        marker.on('click', () => {
            let dynamicData: any = {};
            const events = this.activeEvents();
            
            let displayPGA = Math.random() * 0.5;
            let displayPGV = Math.random() * 0.01;

            if (events.length > 0 && s.stationType === 'SEISMIC') {
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
        this.stationTypeMap[s.id] = s.stationType;
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
      this.startEvent(this.epicenter(), this.magnitude(), this.depth(), 'MAIN');
  }

  spawnCompositeDisaster() {
      const volStations = this.stations().filter(s => s.stationType === 'VOLCANO');
      if (volStations.length === 0) return;
      const targetVolcano = volStations[Math.floor(Math.random() * volStations.length)];
      
      this.startEvent({ lat: targetVolcano.lat, lng: targetVolcano.lng }, 6.0, 1, 'VOLCANO');

      // Guarantee offshore location for the associated quake to ensure Tsunami alert triggers
      // Shift significantly to ocean (e.g. +1.0 deg)
      const quakeLoc = { 
          lat: targetVolcano.lat + (Math.random() > 0.5 ? 1.0 : -1.0), 
          lng: targetVolcano.lng + (Math.random() > 0.5 ? 1.0 : -1.0) 
      };
      
      setTimeout(() => {
          if (this.isSimulating()) {
              // High Mag (8.2) + Shallow (10km) + Offshore location = Guaranteed Tsunami Risk
              this.startEvent(quakeLoc, 8.2, 10, 'MAIN'); 
          }
      }, 5000); 
  }

  private startEvent(loc: {lat: number, lng: number}, mag: number, depth: number, type: 'MAIN'|'AFTERSHOCK'|'VOLCANO') {
    if (!this.map || this.stations().length === 0) return;
    
    const eventId = `EVT-${Date.now()}-${Math.random()}`; 
    const startT = this.isSimulating() ? this.elapsedTime() : 0;
    
    const sortedImpacts = this.physics.calculateEventImpacts(
        this.stations(), 
        loc, 
        mag, 
        depth
    );

    const pWave = L.circle(loc, { radius: 0, color: '#fbbf24', fill: false, weight: 1, dashArray: '4,4' }).addTo(this.map);
    const sWave = L.circle(loc, { radius: 0, color: '#dc2626', fillColor: '#dc2626', fillOpacity: 0.1, weight: 2 }).addTo(this.map);
    
    let ashCircle: L.Circle | undefined;
    if (type === 'VOLCANO') {
        ashCircle = L.circle(loc, { 
            radius: 0, 
            color: 'transparent', 
            fillColor: '#555555', 
            fillOpacity: 0.4, 
            weight: 0 
        }).addTo(this.map);
    }
    
    const marker = L.marker(loc, {
         icon: L.divIcon({
            className: 'quake-marker',
            html: `<div class="animate-ping-slow" style="width:20px;height:20px;background:transparent;border:2px solid ${type==='VOLCANO'?'orange':'red'};border-radius:50%;"></div>
                   <div style="position:absolute;top:6px;left:6px;width:8px;height:8px;background:${type==='VOLCANO'?'orange':'red'};border-radius:50%;"></div>`,
            iconSize: [20, 20],
            iconAnchor: [10, 10]
         })
    }).addTo(this.map);

    const isOffshore = this.physics.isOffshore(loc.lat, loc.lng);
    const hasTsunamiRisk = mag >= 7.0 && depth < 35 && isOffshore;

    const newEvent: ActiveEvent = {
        id: eventId,
        type: type, 
        magnitude: mag,
        depth: depth,
        lat: loc.lat,
        lng: loc.lng,
        startTime: startT,
        sortedImpacts: sortedImpacts,
        nextPIndex: 0,
        nextSIndex: 0,
        marker,
        pWaveCircle: pWave,
        sWaveCircle: sWave,
        ashCircle: ashCircle,
        triggeredInland: 0,
        triggeredOffshore: 0,
        firstTriggerTime: null,
        processingDelay: 5 + Math.random() * 2,
        maxLocalIntensity: 0,
        alerted: false,
        alertTime: null,
        dismissed: false,
        tsunamiRisk: hasTsunamiRisk,
        tsunamiAlerted: false,
        tsunamiDelay: 8 + Math.random() * 2 
    };

    this.activeEvents.update(events => [...events, newEvent]);
    this.reportNum.update(n => n + 1);
    this.systemStatus.set('偵測中 (DETECTING)');
    this.audio.playTriggerSound();
    
    if (type === 'MAIN' || this.activeEvents().length === 1) {
        const regionName = this.physics.getRegionName(newEvent.lat, newEvent.lng);
        this.epicenterLocationName.set(regionName);
        this.epicenter.set({ lat: loc.lat, lng: loc.lng }); 
        this.epicenterCursor?.setLatLng(this.epicenter());
    }

    if (!this.isSimulating()) {
        this.startSimulationLoop();
    }
  }

  triggerAlarm(event: ActiveEvent) {
      const now = Date.now();
      
      if (this.volcanoAlert() && event.type !== 'VOLCANO') {
          console.log('Suppressed Alert due to Volcano Priority');
          return;
      }

      if (now - this.lastAlarmTime < 5000) {
           if (event.type === 'MAIN' || event.type === 'VOLCANO' || event.tsunamiAlerted) {
               this.audio.stopSiren();
               setTimeout(() => this.audio.playPWSSiren(), 100);
               this.lastAlarmTime = now;
               this.isPhoneOpen.set(true); 
           }
           return;
      }
      
      this.audio.stopSiren(); 
      setTimeout(() => this.audio.playPWSSiren(), 100);
      this.lastAlarmTime = now;
      this.isPhoneOpen.set(true); 
  }

  emergencyStop() {
      if (this.animFrameId) cancelAnimationFrame(this.animFrameId);
      this.isSimulating.set(false);
      this.systemStatus.set('結束 (ENDED)');
  }
  
  dismissTsunami() {
      this.tsunamiAlert.set(false);
  }

  updateStationVisual(id: string, peakMMI: number, liveMMI: number) {
    const marker = this.stationMarkers[id];
    if (!marker) return;

    if (this.stationAshState[id]) {
        marker.setStyle({
            fillColor: '#555555', 
            color: '#aaaaaa',
            radius: 4,
            fillOpacity: 0.9,
            weight: 1
        });
        return;
    }

    if (peakMMI <= 0.1 && liveMMI <= 0) {
        const type = this.stationTypeMap[id];
        if (type === 'SEISMIC') {
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
        } else if (type === 'TSUNAMI') {
            marker.setStyle({
                radius: 1.5,
                fillColor: 'transparent',
                color: '#0891b2', 
                weight: 1,
                fillOpacity: 0.8
            });
        } else if (type === 'VOLCANO') {
             marker.setStyle({
                radius: 2.0,
                fillColor: '#f97316',
                color: 'transparent',
                weight: 1.0,
                fillOpacity: 1.0
            });
        }
        if (marker.isTooltipOpen()) marker.closeTooltip();
    } else {
        const type = this.stationTypeMap[id];
        
        if (type === 'SEISMIC') {
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
        } else if (type === 'TSUNAMI') {
            const simulatedHeight = liveMMI * 2.0; 
            const color = this.physics.getTsunamiColor(simulatedHeight);
            
            marker.setStyle({
                radius: 4, // FIXED: Keep fixed size, only change color
                color: color,
                fillColor: color,
                fillOpacity: 0.9,
                weight: 1
            });
        } else if (type === 'VOLCANO') {
             const pulse = liveMMI > 0 ? (liveMMI + 3) : 2;
             marker.setStyle({
                radius: pulse,
                fillColor: '#ef4444', 
                color: '#f97316', 
                weight: 2,
                fillOpacity: 1.0
            });
        }
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
      this.volcanoAlert.set(false);
      this.isPhoneOpen.set(true);
      this.currentAudioGear = 0; // Reset audio gear
      
      this.mainCountdowns.set([]);
      this.secondaryCountdowns.set([]);
      
      Object.keys(this.stationMarkers).forEach(id => {
         this.stationAshState[id] = false; 
         this.updateStationVisual(id, 0, 0); 
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

          const dirtyStations = new Set<string>();

          const liveIds = Object.keys(this.stationLiveMMI);
          liveIds.forEach(id => {
               const val = this.stationLiveMMI[id];
               if (val > 0) {
                   const type = this.stationTypeMap[id];
                   const decay = type === 'TSUNAMI' ? 0.99 : 0.95; 
                   const newVal = val * decay; 
                   this.stationLiveMMI[id] = newVal > 0.05 ? newVal : 0;
                   dirtyStations.add(id);
                   if (this.stationLiveMMI[id] <= 0) {
                       delete this.stationLiveMMI[id];
                   }
               }
          });

          const cityStats: {[name: string]: {seconds: number, intensity: number, id: string, name: string, type: 'MAIN'|'AFTERSHOCK'|'VOLCANO'}} = {};

          this.activeEvents().forEach(event => {
              const eventElapsed = globalElapsed - event.startTime;
              if (eventElapsed < 0) return;

              if (this.showWaves()) {
                  event.pWaveCircle?.setRadius(eventElapsed * this.physics.VP_BASE * 1000);
                  event.sWaveCircle?.setRadius(eventElapsed * this.physics.VS_BASE * 1000);
                  
                  if (event.type === 'VOLCANO' && event.ashCircle) {
                      event.ashCircle.setRadius(eventElapsed * this.physics.ASH_SPEED_KM_S * 1000);
                  }
              }

              if (event.type === 'VOLCANO') {
                  event.sortedImpacts.forEach(impact => {
                      if (impact.ashTime && eventElapsed >= impact.ashTime) {
                          if (!this.stationAshState[impact.id]) {
                              this.stationAshState[impact.id] = true;
                              dirtyStations.add(impact.id);
                          }
                      }
                  });
              }

              while(event.nextPIndex < event.sortedImpacts.length) {
                  const sData = event.sortedImpacts[event.nextPIndex];
                  if (eventElapsed < sData.pTime) break;

                  if (sData.pMaxMMI > 0.5) {
                      if (sData.region === 'INLAND') event.triggeredInland++;
                      else event.triggeredOffshore++;
                      
                      event.maxLocalIntensity = Math.max(event.maxLocalIntensity, sData.pMaxMMI);

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
              
              const totalTriggers = event.triggeredInland + event.triggeredOffshore;
              const threshold = (event.triggeredOffshore > event.triggeredInland) ? 10 : 15;

              if (totalTriggers > threshold && !event.firstTriggerTime) {
                  event.firstTriggerTime = globalElapsed;
                  this.systemStatus.set('計算中 (COMPUTING)');
              }

              if (event.firstTriggerTime && !event.alerted && !event.dismissed) {
                  const delay = globalElapsed - event.firstTriggerTime;
                  if (delay >= event.processingDelay) { 
                       const highMagnitude = event.magnitude >= 5.0;
                       const moderateMagWithShaking = event.magnitude >= 4.0 && event.maxLocalIntensity >= 1.5;
                       const isVolcano = event.type === 'VOLCANO';
                       
                       if (event.tsunamiRisk || highMagnitude || moderateMagWithShaking || isVolcano) {
                           event.alerted = true;
                           event.alertTime = globalElapsed;
                           this.systemStatus.set('發布警報 (ALERTING)');
                           
                           if (isVolcano) {
                               this.volcanoAlert.set(true);
                           }
                           
                           this.triggerAlarm(event); 
                       } else {
                           event.dismissed = true;
                       }
                  }
              }

              if (event.alerted && event.tsunamiRisk && !event.tsunamiAlerted) {
                  if (event.alertTime) {
                      if (globalElapsed - event.alertTime >= event.tsunamiDelay) {
                          event.tsunamiAlerted = true;
                          if (!this.volcanoAlert()) {
                              this.tsunamiAlert.set(true);
                          }
                          this.triggerAlarm(event); 
                      }
                      
                      if (globalElapsed - event.alertTime >= 2 && globalElapsed - event.alertTime < 30) {
                         const nearbyTsunamiStns = this.stations()
                             .filter(s => s.stationType === 'TSUNAMI')
                             .filter(s => {
                                 const dist = this.physics.calculateDistance(event.lat, event.lng, s.lat, s.lng);
                                 return dist < 800; 
                             });
                             
                         nearbyTsunamiStns.forEach(s => {
                             const dist = this.physics.calculateDistance(event.lat, event.lng, s.lat, s.lng);
                             const waveHeight = this.physics.calculateTsunamiHeight(event.magnitude, dist, event.depth);
                             const visualVal = waveHeight * 0.5; 
                             
                             const current = this.stationLiveMMI[s.id] || 0;
                             if (current < visualVal) {
                                 this.stationLiveMMI[s.id] = current + (visualVal - current) * 0.1;
                                 dirtyStations.add(s.id);
                             }
                         });
                      }
                  }
              }

              if (event.alerted) {
                  event.sortedImpacts.forEach(impact => {
                      if (impact.isMajor) {
                          const timeToS = impact.sTime - eventElapsed;
                          if (impact.maxMMI > 1.5) {
                              const key = `${impact.name}-${event.type}`;
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
          
          dirtyStations.forEach(id => {
              this.updateStationVisual(
                  id, 
                  this.stationCurrentMaxMMI[id] || 0, 
                  this.stationLiveMMI[id] || 0
              );
          });

          const stationIds = Object.keys(this.stationMarkers);
          const sliceSize = 100;
          const startIndex = (this.frameCount * sliceSize) % stationIds.length;
          const endIndex = Math.min(startIndex + sliceSize, stationIds.length);
          for (let i = startIndex; i < endIndex; i++) {
              const id = stationIds[i];
              if (!dirtyStations.has(id)) {
                  const peak = this.stationCurrentMaxMMI[id] || 0;
                  const live = this.stationLiveMMI[id] || 0;
                  if (peak > 0 || live > 0 || this.stationAshState[id]) {
                      this.updateStationVisual(id, peak, live);
                  }
              }
          }

          const allCountdowns: CityCountdown[] = Object.values(cityStats)
            .map(data => ({
                name: data.name,
                seconds: data.seconds,
                intensity: this.physics.toCWAIntensity(data.intensity),
                color: this.physics.getCWAIntensityColorHex(this.physics.toCWAIntensity(data.intensity)),
                eventType: data.type
            }))
            .filter(c => c.seconds > 0 || c.seconds === 0) 
            .sort((a, b) => a.seconds - b.seconds);
          
          this.mainCountdowns.set(allCountdowns.filter(c => c.eventType === 'MAIN' || c.eventType === 'VOLCANO').slice(0, 5));
          this.secondaryCountdowns.set(allCountdowns.filter(c => c.eventType === 'AFTERSHOCK').slice(0, 5));
          
          const triggeredKeys = Object.keys(this.stationCurrentMaxMMI);
          this.triggeredStations.set(triggeredKeys.length);

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

             // Audio Gear Logic (1-7)
             // Map roughly to CWA levels: <1.5=1, <2.5=2, etc.
             let detectedGear = 1;
             if (currentMaxMMI_numeric >= 1.5) detectedGear = 2;
             if (currentMaxMMI_numeric >= 2.5) detectedGear = 3;
             if (currentMaxMMI_numeric >= 3.5) detectedGear = 4;
             if (currentMaxMMI_numeric >= 4.5) detectedGear = 5;
             if (currentMaxMMI_numeric >= 6.0) detectedGear = 6; // Jump slightly for heavy
             if (currentMaxMMI_numeric >= 7.5) detectedGear = 7;

             if (detectedGear > this.currentAudioGear) {
                 this.audio.playIntensitySound(detectedGear);
                 this.currentAudioGear = detectedGear;
             }
          }

          if (globalElapsed - this.lastReportTime > 0.6 && triggeredKeys.length > 5) {
             this.lastReportTime = globalElapsed;
             
             let estimatedMagSum = 0;
             let count = 0;
             
             const evt = this.activeEvents()[0]; 
             if (evt) {
                 const isOffshore = this.physics.isOffshore(evt.lat, evt.lng);
                 
                 triggeredKeys.forEach(sid => {
                    const mmi = this.stationCurrentMaxMMI[sid];
                    const station = this.stations().find(s => s.id === sid);
                    
                    if (station && station.stationType === 'SEISMIC' && mmi > 1.8) { 
                         const dist = this.physics.calculateDistance(evt.lat, evt.lng, station.lat, station.lng);
                         
                         const stationCount = triggeredKeys.length;
                         const noiseFactor = Math.max(0.1, 5.0 / Math.sqrt(stationCount)); 
                         const noise = (Math.random() - 0.5) * noiseFactor;
                         
                         let estimatedDepth = 10;
                         if (stationCount > 40) {
                             estimatedDepth = evt.depth + noise; 
                         } else if (stationCount > 10) {
                             const factor = (stationCount - 10) / 30; 
                             estimatedDepth = (10 * (1 - factor)) + (evt.depth * factor) + noise * 2;
                         } else {
                             estimatedDepth = 10 + noise * 5; 
                         }
                         estimatedDepth = Math.max(0, estimatedDepth);

                         const R = Math.sqrt(dist * dist + estimatedDepth * estimatedDepth); 
                         const estMag = (mmi + 4.1 * Math.log10(R) + 0.0015 * R - 0.2) / 1.62;
                         
                         estimatedMagSum += estMag;
                         count++;
                    }
                 });

                 if (count > 0) {
                     const avgMag = estimatedMagSum / count;
                     const smoothedMag = avgMag; 
                     
                     const newReport: EEWReport = {
                         id: `REP-${Date.now()}`,
                         reportNum: this.eewReports().length + 1,
                     time: globalElapsed,
                     mag: parseFloat(smoothedMag.toFixed(1)),
                     depth: evt.depth, 
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

          if (globalElapsed - this.lastDataUpdateTime > 0.1) { 
             this.lastDataUpdateTime = globalElapsed;
             const newData = [...this.sensorMatrix()];
             
             const stationsList = this.stations();
             
             for(let i=0; i<1000; i++) {
                 if (this.sensorStationMap[i] !== undefined) {
                     const stationIdx = this.sensorStationMap[i];
                     const station = stationsList[stationIdx];
                     if (station) {
                         const liveVal = this.stationLiveMMI[station.id] || 0;
                         const noise = Math.random() * 5;
                         const signal = liveVal * 20; 
                         newData[i] = Math.max(0, signal + noise);
                     } else {
                         newData[i] = Math.random() * 2;
                     }
                 } else {
                     newData[i] = Math.random() * 2;
                 }
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
          e.ashCircle?.remove(); 
      });
      this.activeEvents.set([]);
      
      this.systemStatus.set('待命 (IDLE)');
      this.elapsedTime.set(0);
      this.showMobileControls.set(false);
      this.selectedStation.set(null);
      this.isPhoneOpen.set(true); 
      this.currentAudioGear = 0;
      
      this.stationAshState = {}; 
      Object.keys(this.stationMarkers).forEach(id => {
        this.updateStationVisual(id, 0, 0);
        const marker = this.stationMarkers[id];
        if(marker.isTooltipOpen()) marker.closeTooltip();
      });
      
      this.stationCurrentMaxMMI = {};
      this.stationLiveMMI = {}; 
      this.eewReports.set([]);
      this.predictedMagnitude.set('---');
      this.predictedMaxIntensity.set('---');
      this.currentPGA.set(0);
      this.tsunamiAlert.set(false);
      this.volcanoAlert.set(false);
      
      this.mainCountdowns.set([]);
      this.secondaryCountdowns.set([]);
      this.audio.stopSiren();
      this.imageAnalysisResult.set(null);
  }

  async loadRecentQuakes() {
    this.isLoadingRecents.set(true);
    const quakes = await this.gemini.getRecentQuakes();
    if (quakes && quakes.length > 0) {
        this.recentQuakes.set(quakes);
    }
    this.isLoadingRecents.set(false);
  }

  async handleImageUpload(event: Event) {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (!file) return;

      this.analyzingImage.set(true);
      this.imageAnalysisResult.set(null);

      const reader = new FileReader();
      reader.onload = async (e) => {
          const base64 = (e.target?.result as string).split(',')[1];
          const result = await this.gemini.analyzeImage(base64);
          this.imageAnalysisResult.set(result);
          this.analyzingImage.set(false);
      };
      reader.readAsDataURL(file);
  }
}
