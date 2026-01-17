import { Injectable } from '@angular/core';

export interface Station {
  id: string;
  name: string;
  lat: number;
  lng: number;
  terrain: 'BASIN' | 'PLAIN' | 'MOUNTAIN' | 'VALLEY' | 'OFFSHORE';
  isMajor?: boolean;
  isCitizen?: boolean;
  isSpecial?: boolean; // For Rail sensors
}

export interface SimulationStationData extends Station {
  dist: number; // Distance to specific event
  maxMMI: number; // Max intensity from specific event
  pTime: number;
  sTime: number;
}

@Injectable({
  providedIn: 'root'
})
export class PhysicsService {
  readonly VP = 6.0; // P-wave speed km/s
  readonly VS = 3.5; // S-wave speed km/s
  
  private _cachedStations: Station[] = [];

  constructor() {
    this._cachedStations = this.generateMassiveNetwork();
  }

  getStations() {
    return this._cachedStations;
  }

  // Pre-calculate the impact of ONE event on ALL stations
  // Returns sorted array for efficient iteration in the game loop
  calculateEventImpacts(
      stations: Station[], 
      epicenter: {lat: number, lng: number}, 
      magnitude: number, 
      depth: number
  ): SimulationStationData[] {
      
      const impacts = stations.map(s => {
          const dist = this.calculateDistance(epicenter.lat, epicenter.lng, s.lat, s.lng);
          const maxMMI = this.calculateMMI(magnitude, dist, depth, s.terrain);
          return {
              ...s,
              dist,
              maxMMI,
              pTime: dist / this.VP,
              sTime: dist / this.VS
          };
      });

      // Sort by distance (arrival time) for O(1) simulation loop
      return impacts.sort((a, b) => a.dist - b.dist);
  }

  private generateMassiveNetwork(): Station[] {
    const stations: Station[] = [];
    let idCounter = 1;

    // 1. Major Cities (Target Nodes) - Taiwan & Japan
    const cities = [
        // Taiwan
        { name: '台北 (Taipei)', lat: 25.03, lng: 121.56, type: 'BASIN' },
        { name: '新北 (New Taipei)', lat: 25.01, lng: 121.46, type: 'BASIN' },
        { name: '台中 (Taichung)', lat: 24.14, lng: 120.67, type: 'BASIN' },
        { name: '高雄 (Kaohsiung)', lat: 22.62, lng: 120.30, type: 'PLAIN' },
        { name: '花蓮 (Hualien)', lat: 23.98, lng: 121.60, type: 'VALLEY' },
        { name: '台東 (Taitung)', lat: 22.75, lng: 121.15, type: 'VALLEY' },
        
        // Japan (Kyushu to Hokkaido)
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
            isMajor: true
        });
    });

    // 2. High-Fidelity Japan Network Generation
    // Broken into geological zones for accuracy
    
    // Zone A: Taiwan (Dense)
    this.generateZone(stations, 1200, 
        { latMin: 21.0, latMax: 26.0, lngMin: 119.0, lngMax: 123.0 }, 
        'TW', idCounter);
    idCounter += 1200;

    // Zone B: Ryukyu Arc (Sparse/Sea)
    this.generateZone(stations, 300, 
        { latMin: 24.0, latMax: 30.0, lngMin: 123.0, lngMax: 130.0 }, 
        'RYUKYU', idCounter, true);
    idCounter += 300;

    // Zone C: Kyushu & Shikoku
    this.generateZone(stations, 800, 
        { latMin: 31.0, latMax: 34.5, lngMin: 129.5, lngMax: 134.5 }, 
        'KYU', idCounter);
    idCounter += 800;

    // Zone D: Honshu (Mainland - Dense)
    // We split Honshu to follow the curve
    // West Honshu
    this.generateZone(stations, 1200, 
        { latMin: 34.0, latMax: 36.0, lngMin: 132.0, lngMax: 136.0 }, 
        'W-HONSHU', idCounter);
    idCounter += 1200;
    
    // Central/East Honshu (Tokyo/Tohoku)
    this.generateZone(stations, 2000, 
        { latMin: 35.0, latMax: 41.5, lngMin: 137.0, lngMax: 142.0 }, 
        'E-HONSHU', idCounter);
    idCounter += 2000;

    // Zone E: Hokkaido
    this.generateZone(stations, 700, 
        { latMin: 41.5, latMax: 45.5, lngMin: 139.5, lngMax: 146.0 }, 
        'HOKKAIDO', idCounter);
        
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

        // Basic land masking for Japan shapes (very rough)
        // Helps avoid square-looking distributions
        if (!isArc && prefix.includes('HONSHU')) {
            // Skew points to follow the island curve roughly
            // Approx line: lat 34, lng 132 -> lat 41, lng 141
            // Simple validation: is point roughly near diagonal?
            // lng should be approx (lat - 20) * 2 + 100 ? No.
            // Let's just use strict bounding boxes defined above for simplicity but check bounds
        }

        const isOffshore = this.isOffshore(lat, lng);
        
        // Distribution Balance
        // Japan has extensive seafloor networks (S-net, DONET), so we allow offshore
        if (prefix === 'TW' && isOffshore && Math.random() > 0.1) continue; // Taiwan mostly land stations
        if (prefix !== 'TW' && isOffshore && Math.random() > 0.25) continue; // Japan ~25% offshore allowed

        let terrain: any = isOffshore ? 'OFFSHORE' : 'MOUNTAIN';
        if (!isOffshore) {
             if (Math.random() > 0.6) terrain = 'PLAIN';
        }

        stations.push({
            id: `${prefix}-${startId + added}`,
            name: isOffshore ? `${prefix}-Sea` : `${prefix}-Stn`,
            lat: lat,
            lng: lng,
            terrain: terrain,
            isSpecial: Math.random() > 0.95 // 5% chance to be a Rail Sensor
        });
        added++;
    }
  }

  private pointNearLine(lat: number, lng: number, lat1: number, lng1: number, lat2: number, lng2: number, tolerance: number): boolean {
      if (lat < Math.min(lat1, lat2) - tolerance || lat > Math.max(lat1, lat2) + tolerance) return false;
      if (lng < Math.min(lng1, lng2) - tolerance || lng > Math.max(lng1, lng2) + tolerance) return false;
      return true;
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

  calculateMMI(mag: number, distKm: number, depthKm: number, terrain: string, includeRandomness: boolean = true): number {
    const R = Math.sqrt(distKm * distKm + depthKm * depthKm); 
    
    // Adjusted attenuation for Japan/Taiwan region
    let baseI = 1.7 * mag - 3.8 * Math.log10(R < 5 ? 5 : R) - 0.002 * R;
    
    // Site Effects
    let siteAmp = 0;
    if (terrain === 'BASIN') siteAmp = 0.9;
    if (terrain === 'PLAIN') siteAmp = 0.3;
    if (terrain === 'MOUNTAIN') siteAmp = -0.5;
    if (terrain === 'OFFSHORE') siteAmp = -0.8; 

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
    
    // Taiwan Main
    if (lat > 21.8 && lat < 25.4 && lng > 120.0 && lng < 122.0) {
        const centerLng = 120.8 + (lat - 22.0) * 0.25;
        if (Math.abs(lng - centerLng) < 0.6) return false; 
    }
    
    // Japan - Kyushu
    if (lat > 31.0 && lat < 34.0 && lng > 129.5 && lng < 132.0) return false;
    
    // Japan - Shikoku
    if (lat > 32.7 && lat < 34.5 && lng > 132.0 && lng < 134.8) return false;

    // Japan - Honshu (Simplified polygons)
    if (lat > 34.0 && lat < 41.5 && lng > 131.0 && lng < 142.0) {
        // Exclude Sea of Japan / Pacific roughly
        if (lat < 35 && lng > 137) return true; // Sea south of Tokyo
        if (lat > 38 && lng < 138) return true; // Sea of Japan
        return false;
    }

    // Japan - Hokkaido
    if (lat > 41.5 && lat < 45.5 && lng > 139.5 && lng < 146.0) return false;

    return true; // Ocean
  }
}