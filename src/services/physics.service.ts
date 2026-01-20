import { Injectable } from '@angular/core';

export interface Station {
  id: string;
  name: string;
  lat: number;
  lng: number;
  terrain: 'BASIN' | 'PLAIN' | 'MOUNTAIN' | 'VALLEY' | 'OFFSHORE';
  region: 'INLAND' | 'OFFSHORE'; // New classification
  isMajor?: boolean;
  isCitizen?: boolean;
  isSpecial?: boolean; // For Rail sensors
}

export interface SimulationStationData extends Station {
  dist: number; // Distance to specific event
  maxMMI: number; // Max intensity (S-wave dominated)
  pMaxMMI: number; // Max P-wave intensity (New: for separate detection logic)
  pTime: number;
  sTime: number;
}

@Injectable({
  providedIn: 'root'
})
export class PhysicsService {
  // Base Wave Speeds (km/s)
  readonly VP_BASE = 6.0; 
  readonly VS_BASE = 3.5; 
  
  private _cachedStations: Station[] = [];

  constructor() {
    this._cachedStations = this.generateMassiveNetwork();
  }

  getStations() {
    return this._cachedStations;
  }

  // Pre-calculate the impact of ONE event on ALL stations
  calculateEventImpacts(
      stations: Station[], 
      epicenter: {lat: number, lng: number}, 
      magnitude: number, 
      depth: number
  ): SimulationStationData[] {
      
      const impacts = stations.map(s => {
          const dist = this.calculateDistance(epicenter.lat, epicenter.lng, s.lat, s.lng);
          
          const { pTime, sTime } = this.calculateArrivalTimes(dist, depth, s.terrain);
          
          // S-Wave Intensity (Destructive)
          const maxMMI = this.calculateMMI(magnitude, dist, depth, s.terrain, 'S');
          
          // P-Wave Intensity (Detection - Decays faster)
          const pMaxMMI = this.calculateMMI(magnitude, dist, depth, s.terrain, 'P');
          
          return {
              ...s,
              dist,
              maxMMI,
              pMaxMMI,
              pTime,
              sTime
          };
      });

      return impacts.sort((a, b) => a.dist - b.dist);
  }

  private calculateArrivalTimes(distKm: number, depthKm: number, terrain: string) {
      const hypocentralDist = Math.sqrt(distKm * distKm + depthKm * depthKm);
      
      let speedMod = 1.0;
      if (terrain === 'MOUNTAIN') speedMod = 1.1; 
      if (terrain === 'BASIN' || terrain === 'OFFSHORE') speedMod = 0.9; 
      if (terrain === 'VALLEY') speedMod = 1.05;

      const vp = this.VP_BASE * speedMod;
      const vs = this.VS_BASE * speedMod;

      return {
          pTime: hypocentralDist / vp,
          sTime: hypocentralDist / vs
      };
  }

  private generateMassiveNetwork(): Station[] {
    const stations: Station[] = [];
    let idCounter = 1;

    // 1. Major Cities
    const cities = [
        { name: '台北 (Taipei)', lat: 25.03, lng: 121.56, type: 'BASIN' },
        { name: '新北 (New Taipei)', lat: 25.01, lng: 121.46, type: 'BASIN' },
        { name: '台中 (Taichung)', lat: 24.14, lng: 120.67, type: 'BASIN' },
        { name: '高雄 (Kaohsiung)', lat: 22.62, lng: 120.30, type: 'PLAIN' },
        { name: '花蓮 (Hualien)', lat: 23.98, lng: 121.60, type: 'VALLEY' },
        { name: '台東 (Taitung)', lat: 22.75, lng: 121.15, type: 'VALLEY' },
        { name: '那霸 (Naha)', lat: 26.21, lng: 127.68, type: 'OFFSHORE' },
        { name: '福岡 (Fukuoka)', lat: 33.59, lng: 130.40, type: 'PLAIN' },
        { name: '廣島 (Hiroshima)', lat: 34.38, lng: 132.45, type: 'PLAIN' },
        { name: '大阪 (Osaka)', lat: 34.69, lng: 135.50, type: 'BASIN' },
        { name: '名古屋 (Nagoya)', lat: 35.18, lng: 136.90, type: 'PLAIN' },
        { name: '東京 (Tokyo)', lat: 35.68, lng: 139.76, type: 'PLAIN' },
        { name: '新潟 (Niigata)', lat: 37.91, lng: 139.02, type: 'PLAIN' },
        { name: '仙台 (Sendai)', lat: 38.26, lng: 140.87, type: 'PLAIN' },
        { name: '札幌 (Sapporo)', lat: 43.06, lng: 141.35, type: 'BASIN' }
    ];

    cities.forEach(city => {
        stations.push({
            id: `CITY-${city.name.split(' ')[0]}`, 
            name: city.name,
            lat: city.lat,
            lng: city.lng,
            terrain: city.type as any,
            region: city.type === 'OFFSHORE' ? 'OFFSHORE' : 'INLAND',
            isMajor: true
        });
    });

    // 2. High-Fidelity Japan Network
    this.generateZone(stations, 1200, { latMin: 21.0, latMax: 26.0, lngMin: 119.0, lngMax: 123.0 }, 'TW', idCounter);
    idCounter += 1200;
    this.generateZone(stations, 300, { latMin: 24.0, latMax: 30.0, lngMin: 123.0, lngMax: 130.0 }, 'RYUKYU', idCounter, true);
    idCounter += 300;
    this.generateZone(stations, 800, { latMin: 31.0, latMax: 34.5, lngMin: 129.5, lngMax: 134.5 }, 'KYU', idCounter);
    idCounter += 800;
    this.generateZone(stations, 1200, { latMin: 34.0, latMax: 36.0, lngMin: 132.0, lngMax: 136.0 }, 'W-HONSHU', idCounter);
    idCounter += 1200;
    this.generateZone(stations, 2000, { latMin: 35.0, latMax: 41.5, lngMin: 137.0, lngMax: 142.0 }, 'E-HONSHU', idCounter);
    idCounter += 2000;
    this.generateZone(stations, 700, { latMin: 41.5, latMax: 45.5, lngMin: 139.5, lngMax: 146.0 }, 'HOKKAIDO', idCounter);
        
    return stations;
  }

  private generateZone(stations: Station[], count: number, bounds: any, prefix: string, startId: number, isArc: boolean = false) {
    let attempts = 0;
    let added = 0;
    const maxAttempts = count * 5;

    while(added < count && attempts < maxAttempts) {
        attempts++;
        const lat = bounds.latMin + Math.random() * (bounds.latMax - bounds.latMin);
        const lng = bounds.lngMin + Math.random() * (bounds.lngMax - bounds.lngMin);

        const isOffshore = this.isOffshore(lat, lng);
        
        if (prefix === 'TW' && isOffshore && Math.random() > 0.1) continue; 
        if (prefix !== 'TW' && isOffshore && Math.random() > 0.25) continue; 

        let terrain: any = isOffshore ? 'OFFSHORE' : 'MOUNTAIN';
        if (!isOffshore && Math.random() > 0.6) terrain = 'PLAIN';

        stations.push({
            id: `${prefix}-${startId + added}`,
            name: isOffshore ? `${prefix}-Sea` : `${prefix}-Stn`,
            lat: lat,
            lng: lng,
            terrain: terrain,
            region: isOffshore ? 'OFFSHORE' : 'INLAND',
            isSpecial: Math.random() > 0.95 
        });
        added++;
    }
  }

  calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; 
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  }

  calculateMMI(mag: number, distKm: number, depthKm: number, terrain: string, waveType: 'P'|'S' = 'S', includeRandomness: boolean = true): number {
    const R = Math.sqrt(distKm * distKm + depthKm * depthKm); 
    
    // Base attenuation
    let baseI = 0;
    
    if (waveType === 'S') {
        // S-wave: Standard CWA/MMI attenuation
        // Modified constants for sharper falloff offshore vs inland
        baseI = 1.65 * mag - 4.2 * Math.log10(R < 5 ? 5 : R) - 0.003 * R;
    } else {
        // P-wave: Weaker, decays faster, but arrives first
        // Typically 2-3 intensity units lower than S, and faster decay over distance
        baseI = 1.4 * mag - 4.8 * Math.log10(R < 5 ? 5 : R) - 0.006 * R;
    }

    // Site Effects (Terrain Amplification) - Enhanced for better regional fidelity
    let siteAmp = 0;
    if (terrain === 'BASIN') siteAmp = 1.2; // Taipei Basin effect stronger
    if (terrain === 'PLAIN') siteAmp = 0.4;
    if (terrain === 'MOUNTAIN') siteAmp = -0.7; // Hard rock attenuation
    if (terrain === 'OFFSHORE') siteAmp = -1.1; // Seafloor absorption/distance perception

    let final = baseI + siteAmp;
    
    if (includeRandomness) {
        final += (Math.random() - 0.5) * 0.15; 
    }
    
    if (final < 0) final = 0;
    if (final > 12) final = 12; 
    
    return final; 
  }
  
  estimatePGA(mmi: number): number {
      if (mmi <= 1) return Math.random() * 2;
      return Math.pow(10, (mmi * 0.53) - 0.6);
  }

  estimatePGV(mmi: number): number {
      const pga = this.estimatePGA(mmi);
      return pga / (15 + (Math.random() * 5)); 
  }

  toCWAIntensity(mmi: number): string {
    if (mmi < 1.5) return '1級';
    if (mmi < 2.5) return '2級';
    if (mmi < 3.5) return '3級';
    if (mmi < 4.5) return '4級';
    if (mmi < 5.5) return '5弱';
    if (mmi < 6.5) return '5強';
    if (mmi < 7.5) return '6弱';
    if (mmi < 8.5) return '6強';
    return '7級';
  }

  getCWAIntensityColorHex(intensity: string): string {
    switch (intensity) {
      case '1級': return '#06b6d4'; // Cyan
      case '2級': return '#0ea5e9'; // Sky
      case '3級': return '#22c55e'; // Green
      case '4級': return '#eab308'; // Yellow
      case '5弱': return '#f97316'; // Orange
      case '5強': return '#dc2626'; // Red
      case '6弱': return '#991b1b'; // Dark Red
      case '6強': return '#7e22ce'; // Purple
      case '7級': return '#be185d'; // Fuchsia
      default: return '#334155'; // Slate
    }
  }

  isOffshore(lat: number, lng: number): boolean {
    // Robust Land Check for TW and JP
    if (lat > 21.8 && lat < 25.4 && lng > 120.0 && lng < 122.0) {
        const centerLng = 120.8 + (lat - 22.0) * 0.25;
        if (Math.abs(lng - centerLng) < 0.6) return false; 
    }
    if (lat > 31.0 && lat < 34.0 && lng > 129.5 && lng < 132.0) return false;
    if (lat > 32.7 && lat < 34.5 && lng > 132.0 && lng < 134.8) return false;
    if (lat > 34.0 && lat < 41.5 && lng > 131.0 && lng < 142.0) {
        if (lat < 35 && lng > 137) return true;
        if (lat > 38 && lng < 138) return true; 
        return false;
    }
    if (lat > 41.5 && lat < 45.5 && lng > 139.5 && lng < 146.0) return false;
    return true; 
  }
  
  getRegionName(lat: number, lng: number): string {
    // Rough bounding boxes for display
    if (lat >= 21.0 && lat <= 26.0 && lng >= 119.0 && lng <= 123.0) return '台灣地區 (Taiwan Region)';
    if (lat >= 24.0 && lat <= 30.0 && lng >= 123.0 && lng <= 130.0) return '琉球群島 (Ryukyu Islands)';
    if (lat >= 30.0 && lat <= 35.0 && lng >= 128.0 && lng <= 132.0) return '日本九州 (Kyushu, Japan)';
    if (lat >= 33.0 && lat <= 36.0 && lng >= 132.0 && lng <= 136.0) return '日本西本州 (W. Honshu, Japan)';
    if (lat >= 35.0 && lat <= 42.0 && lng >= 136.0 && lng <= 142.0) return '日本東本州 (E. Honshu, Japan)';
    if (lat >= 41.0 && lng >= 139.0) return '日本北海道 (Hokkaido, Japan)';
    
    // Fallbacks
    if (lat > 30) return '日本海域 (Japan Region)';
    return '西太平洋海域 (W. Pacific)';
  }
}