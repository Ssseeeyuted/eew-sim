import { Component, input, signal, effect, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { GeminiService } from '../services/gemini.service';

type AppType = 'HOME' | 'EEW' | 'MAPS' | 'WEATHER' | 'NEWS' | 'STOCKS' | 'SETTINGS' | 
               'SOCIAL' | 'CAMERA' | 'PHOTOS' | 'MUSIC' | 'MAIL' | 'CALENDAR' | 
               'CLOCK' | 'NOTES' | 'CALCULATOR' | 'BROWSER' | 'FLASHLIGHT';

interface NavPage {
    id: string;
    title: string;
    type: 'list' | 'detail' | 'grid' | 'custom' | 'gallery' | 'article' | 'map' | 'chart' | 'flashlight' | 'raw';
    content: any;
    depth: number;
    appName: string; 
    meta?: any; // Extra data for context
}

@Component({
  selector: 'app-phone-alert',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="relative w-[360px] h-[720px] bg-[#000000] rounded-[3.5rem] border-[8px] border-[#333333] shadow-[0_30px_60px_-12px_rgba(0,0,0,0.8)] overflow-hidden font-sans select-none transform transition-transform duration-300 ease-out hover:scale-[1.01] will-change-transform ring-4 ring-black/50"
         (mousemove)="handleMouseMove($event)" (mouseleave)="resetParallax()">
      
      <!-- Flashlight Overlay (Beam Effect) -->
      <div class="absolute inset-0 pointer-events-none z-[60] transition-all duration-300 mix-blend-overlay" 
           [class.opacity-0]="!flashlightOn()" [class.opacity-100]="flashlightOn()"
           style="background: radial-gradient(circle at 50% 10%, rgba(255,255,255,0.8) 0%, rgba(255,255,255,0) 60%);">
      </div>
      <div class="absolute inset-0 pointer-events-none z-[60] transition-opacity duration-300 bg-white/10"
           [class.opacity-0]="!flashlightOn()" [class.opacity-100]="flashlightOn()"></div>

      <!-- Dynamic Island / Notch -->
      <div class="absolute top-2 left-1/2 -translate-x-1/2 w-[120px] h-[35px] bg-black rounded-full z-50 flex justify-center items-center shadow-md transition-all duration-300"
           [class.w-[200px]]="active()">
        <div class="w-full h-full flex items-center justify-between px-3 relative overflow-hidden group">
            <!-- Sensors/Camera -->
            <div class="flex gap-3 items-center">
                <div class="w-3 h-3 rounded-full bg-[#1a1a1a] ring-1 ring-white/10 shadow-inner"></div>
                <!-- Alert Indicator -->
                <div class="w-1.5 h-1.5 rounded-full transition-colors duration-300" 
                     [class.bg-green-500]="!active()" 
                     [class.bg-red-500]="active() && !volcano()" 
                     [class.bg-orange-500]="active() && volcano()" 
                     [class.animate-pulse]="active()"></div>
            </div>
            
            @if(active()) {
                <div class="flex-1 text-center">
                    <div class="text-[10px] text-white font-bold animate-pulse whitespace-nowrap">{{ getNotchText() }}</div>
                </div>
                <div class="w-4 h-4 rounded-full bg-red-500/20 flex items-center justify-center">
                    <div class="w-2 h-2 bg-red-500 rounded-full animate-ping"></div>
                </div>
            }
        </div>
      </div>
      
      <!-- Screen Content Container -->
      <div class="w-full h-full bg-slate-900 flex flex-col relative overflow-hidden text-white rounded-[3rem]">
          
          <!-- Wallpaper with Parallax -->
          <div class="absolute inset-[-25px] z-0 bg-cover bg-center transition-transform duration-100 ease-out"
               [style.background-image]="'url(https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80)'"
               [style.transform]="parallaxStyle()"
               [class.blur-xl]="currentApp() !== 'HOME' && currentApp() !== 'FLASHLIGHT'"
               [class.scale-110]="currentApp() !== 'HOME'">
               <div class="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/70"></div>
          </div>

          <!-- Status Bar -->
          <div class="absolute top-4 left-10 text-[14px] font-semibold text-white z-40 drop-shadow-md tracking-wide">{{time()}}</div>
          <div class="absolute top-4 right-9 text-[12px] font-bold text-white flex gap-1.5 z-40 drop-shadow-md items-center">
             <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M1.5 8.67v8.58a3 3 0 003 3h15a3 3 0 003-3V8.67l-8.928 5.493a3 3 0 01-3.144 0L1.5 8.67z"/><path d="M22.5 6.908V6.75a3 3 0 00-3-3h-15a3 3 0 00-3 3v.158l9.714 5.978a1.5 1.5 0 001.572 0L22.5 6.908z"/></svg>
             <div class="w-6 h-3 border border-white/60 rounded-[4px] relative p-[1.5px]"><div class="h-full bg-white rounded-[2px]" [style.width.%]="batteryLevel()"></div></div>
          </div>

          <!-- HOME SCREEN (Level 1) -->
          <div class="relative z-10 flex-1 flex flex-col pt-20 px-6 pb-8 transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]"
               [class.opacity-0]="currentApp() !== 'HOME'"
               [class.scale-90]="currentApp() !== 'HOME'"
               [class.pointer-events-none]="currentApp() !== 'HOME'">
               
               <!-- Widgets -->
               <div class="flex gap-4 mb-8 h-36">
                   <div class="flex-1 bg-white/20 backdrop-blur-xl rounded-[24px] p-4 shadow-xl flex flex-col justify-between border border-white/20 relative overflow-hidden group cursor-pointer" (click)="openApp('WEATHER')">
                       <div class="absolute inset-0 bg-gradient-to-br from-blue-400/30 to-purple-500/30 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                       <div class="text-[11px] font-bold uppercase text-white/80 z-10">Weather</div>
                       <div class="z-10">
                           <div class="text-4xl font-light tracking-tighter">24°</div>
                           <div class="text-[12px] font-medium opacity-90">H:28° L:19°</div>
                       </div>
                       <div class="absolute top-4 right-4 text-yellow-300 text-2xl">☀</div>
                   </div>
                   <div class="flex-1 bg-black/40 backdrop-blur-xl rounded-[24px] p-4 shadow-xl flex flex-col justify-between border border-white/10 relative overflow-hidden group cursor-pointer" (click)="openApp('EEW')">
                        <div class="absolute inset-0 bg-gradient-to-br from-red-900/40 to-black/40 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        <div class="text-[11px] font-bold uppercase text-white/80 z-10">Seismic Network</div>
                        <div class="z-10 flex items-end gap-2">
                           <div class="text-3xl font-bold text-green-400">OK</div>
                           <div class="text-[10px] mb-1 opacity-70">Normal</div>
                        </div>
                        <div class="absolute right-3 bottom-3 opacity-30"><svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12h2l2 8 4-16 4 16 4-8h2"/></svg></div>
                   </div>
               </div>

               <!-- App Grid -->
               <div class="grid grid-cols-4 gap-x-5 gap-y-7">
                    <button *ngFor="let app of appsList" 
                            class="flex flex-col items-center gap-2 group relative" 
                            (click)="openApp(app.id)">
                        <div class="w-[62px] h-[62px] rounded-[18px] flex items-center justify-center shadow-2xl border-[0.5px] border-white/20 group-active:scale-90 transition-transform duration-200 relative overflow-hidden bg-gradient-to-br" 
                             [ngClass]="app.bgClass">
                             <div class="text-white drop-shadow-md transform group-hover:scale-110 transition-transform duration-300" [innerHTML]="getSafeHtml(app.icon)"></div>
                             <!-- Gloss Shine -->
                             <div class="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        </div>
                        <span class="text-[11px] text-white font-medium drop-shadow-md tracking-tight group-hover:text-white/90">{{app.name}}</span>
                    </button>
               </div>
               
               <!-- Dock -->
               <div class="absolute bottom-6 left-6 right-6 h-[90px] bg-white/10 backdrop-blur-2xl rounded-[30px] border border-white/10 flex items-center justify-evenly px-2 shadow-2xl">
                    <button *ngFor="let dockApp of dockList" (click)="openApp(dockApp.id)" class="group active:scale-90 transition-transform duration-200 flex flex-col items-center gap-1">
                        <div class="w-[58px] h-[58px] rounded-[18px] flex items-center justify-center shadow-lg bg-gradient-to-br border border-white/5" [ngClass]="dockApp.bgClass" [innerHTML]="getSafeHtml(dockApp.icon)"></div>
                    </button>
               </div>
          </div>

          <!-- APP CONTAINER (Universal Navigation) -->
          <div class="absolute inset-0 z-20 bg-black flex flex-col transition-all duration-500 ease-[cubic-bezier(0.19,1,0.22,1)]"
               [class.translate-x-full]="currentApp() === 'HOME'"
               [class.translate-x-0]="currentApp() !== 'HOME'"
               [class.rounded-[3rem]]="currentApp() === 'HOME'"
               [class.rounded-none]="currentApp() !== 'HOME'">
               
               <!-- App Header (Levels 1-5) -->
               <div class="h-28 pt-12 px-6 flex items-center justify-between z-30 bg-black/80 backdrop-blur-xl sticky top-0 transition-all border-b border-white/5">
                    <button (click)="goBack()" class="text-blue-500 font-semibold text-[17px] flex items-center gap-1 active:opacity-50 hover:bg-white/5 px-2 py-1 -ml-2 rounded-lg transition-colors">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
                        {{ navStack().length > 1 ? 'Back' : 'Home' }}
                    </button>
                    <span class="text-white font-bold text-[17px] truncate max-w-[160px] animate-in fade-in slide-in-from-bottom-2">{{ getCurrentPageTitle() }}</span>
                    <!-- Context Indicator (Level) -->
                    <div class="flex items-center gap-1">
                        <div *ngFor="let i of [1,2,3,4,5]" class="w-1.5 h-1.5 rounded-full transition-colors"
                             [class.bg-blue-500]="i <= navStack().length"
                             [class.bg-gray-800]="i > navStack().length"></div>
                    </div>
               </div>

               <!-- Active Page Content -->
               <div class="flex-1 overflow-y-auto bg-black relative scroll-smooth p-0">
                   
                   <!-- FLASHLIGHT APP (Custom UI) -->
                   @if(currentApp() === 'FLASHLIGHT') {
                       <div class="flex flex-col items-center justify-center h-full gap-10 bg-gradient-to-b from-gray-900 to-black">
                           <button (click)="toggleFlashlight()" 
                                   class="w-40 h-40 rounded-full border-[6px] flex items-center justify-center shadow-[0_0_60px_rgba(255,255,255,0.1)] transition-all duration-300 active:scale-95 relative overflow-hidden group"
                                   [class.bg-white]="flashlightOn()" [class.border-white]="flashlightOn()" [class.shadow-[0_0_100px_white]]="flashlightOn()"
                                   [class.bg-transparent]="!flashlightOn()" [class.border-gray-700]="!flashlightOn()">
                               
                               <div class="absolute inset-0 bg-gradient-to-br from-gray-800 to-black opacity-20" *ngIf="!flashlightOn()"></div>
                               
                               <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" 
                                    [class.text-black]="flashlightOn()" [class.text-gray-600]="!flashlightOn()"
                                    class="relative z-10 transition-colors duration-300">
                                    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
                               </svg>
                           </button>
                           <div class="flex flex-col items-center gap-2">
                                <div class="text-white font-bold text-2xl tracking-wide">{{ flashlightOn() ? 'ON' : 'OFF' }}</div>
                                <div class="text-gray-500 text-xs font-mono uppercase tracking-widest bg-gray-900 px-3 py-1 rounded-full border border-gray-800">
                                    Level 5 Intensity
                                </div>
                           </div>
                       </div>
                   }

                   <!-- EEW DASHBOARD (Level 1 - Custom) -->
                   @if(currentApp() === 'EEW' && getCurrentPageType() === 'custom') {
                       <div class="p-5 flex flex-col h-full bg-gradient-to-b from-gray-900 to-black space-y-6">
                           <!-- Active Alert Card -->
                           <div class="rounded-[32px] p-6 relative overflow-hidden shadow-2xl border border-white/10 group cursor-pointer transition-transform active:scale-[0.98]" 
                                (click)="navigate('Event Analysis', 'article', null)"
                                [class.bg-gradient-to-br]="true"
                                [class.from-red-900]="!volcano()" [class.to-black]="!volcano()"
                                [class.from-orange-900]="volcano()" [class.to-slate-900]="volcano()">
                               
                               <div class="absolute -right-8 -top-8 opacity-20 transform rotate-12 group-hover:scale-110 transition-transform duration-700">
                                   <svg width="180" height="180" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L2 22h20L12 2zm0 3.5L18.5 19H5.5L12 5.5zM11 10v4h2v-4h-2zm0 6v2h2v-2h-2z"/></svg>
                               </div>
                               <div class="relative z-10">
                                   <div class="text-[11px] font-black opacity-80 uppercase tracking-[0.2em] mb-4 border-b border-white/20 pb-2 inline-flex items-center gap-2">
                                       <span class="w-2 h-2 rounded-full bg-white animate-pulse"></span>
                                       {{ volcano() ? 'VOLCANO WARNING' : 'SEISMIC ALERT' }}
                                   </div>
                                   <div class="flex items-end gap-3 mb-2">
                                       <div class="text-7xl font-black tracking-tighter leading-none">{{ intensity() || '0' }}</div>
                                       <div class="text-2xl font-bold text-white/80 mb-1 tracking-tighter leading-none whitespace-nowrap">M{{ magnitude() || '0.0' }}</div>
                                   </div>
                                   <div class="text-[15px] font-medium leading-snug opacity-90 text-white/90 line-clamp-2 pr-4">{{ location() || 'No Active Event' }}</div>
                                   <div class="mt-6 flex gap-2">
                                       <span class="px-3 py-1.5 bg-white/10 rounded-full text-[11px] font-bold backdrop-blur border border-white/10">P-Wave Arrived</span>
                                       <span class="px-3 py-1.5 bg-red-500/30 rounded-full text-[11px] font-bold backdrop-blur border border-red-500/30 animate-pulse">S-Wave Inbound</span>
                                   </div>
                               </div>
                           </div>

                           <!-- Recent List (Level 1 List) -->
                           <div class="space-y-4">
                               <div class="flex justify-between items-center px-1">
                                   <span class="text-sm font-bold text-gray-400 uppercase tracking-wide">Recent Events</span>
                                   <button class="text-xs text-blue-400 font-bold hover:text-blue-300 transition-colors" (click)="navigate('History', 'list', generateList(10, 'Quake', 'Detail', 'article'))">See All</button>
                               </div>
                               <div class="space-y-2">
                                   <div *ngFor="let i of [1,2,3]" class="bg-[#1a1a1a] p-4 rounded-2xl flex items-center justify-between border border-white/5 active:bg-white/5 transition-colors cursor-pointer"
                                        (click)="navigate('Event #' + i, 'article', null)">
                                       <div class="flex items-center gap-4">
                                           <div class="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center font-mono font-bold text-green-400 border border-white/5">
                                               3.{{i}}
                                           </div>
                                           <div>
                                               <div class="text-sm font-bold text-white">Minor Tremor</div>
                                               <div class="text-[11px] text-gray-500">2h ago • Hualien Offshore</div>
                                           </div>
                                       </div>
                                       <svg class="text-gray-600" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>
                                   </div>
                               </div>
                           </div>
                       </div>
                   }

                   <!-- Level 1/2: List View (App Context Specific) -->
                   @if(getCurrentPageType() === 'list') {
                       <div class="divide-y divide-white/5 px-2 animate-in slide-in-from-right-8 duration-300">
                           <button *ngFor="let item of getCurrentListItems(); let i = index" 
                                   (click)="navigate(item.label, item.targetType || 'detail', item.content)" 
                                   class="w-full p-4 flex items-center justify-between hover:bg-white/5 active:scale-[0.98] transition-all rounded-xl text-left group"
                                   [style.animation-delay]="i * 50 + 'ms'">
                               <div class="flex items-center gap-4">
                                   <div *ngIf="item.image" class="w-12 h-12 rounded-xl bg-gray-800 bg-cover bg-center shadow-inner" [style.background-image]="'url(' + item.image + ')'"></div>
                                   <div *ngIf="!item.image && item.icon" class="w-12 h-12 rounded-full bg-gray-800 flex items-center justify-center text-xl shadow-inner text-blue-400">{{item.icon}}</div>
                                   
                                   <!-- Context-Specific List Item Layout -->
                                   <div class="flex flex-col flex-1">
                                       <div class="flex justify-between items-center">
                                            <span class="text-[15px] font-semibold text-white group-hover:text-blue-400 transition-colors">{{item.label}}</span>
                                            @if(currentApp() === 'STOCKS') {
                                                <span class="text-xs font-mono" [class.text-green-400]="item.sub.includes('+')" [class.text-red-400]="item.sub.includes('-')">{{item.sub.split('•')[1] || ''}}</span>
                                            }
                                       </div>
                                       <span class="text-[12px] text-gray-500 line-clamp-1 mt-0.5">{{item.sub}}</span>
                                   </div>
                               </div>
                               <div class="text-gray-600 group-hover:text-white transition-colors ml-2">
                                   <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>
                               </div>
                           </button>
                       </div>
                   }

                   <!-- Level 3: Detail / Article View (Context Specific) -->
                   @if(getCurrentPageType() === 'article' || getCurrentPageType() === 'detail') {
                       <div class="bg-black min-h-full pb-20 animate-in slide-in-from-bottom-12 duration-500">
                           
                           <!-- Header Image (Context Aware) -->
                           <div class="w-full h-72 bg-gray-800 bg-cover bg-center relative shadow-2xl" [style.background-image]="'url(' + getContextualImage(currentApp()) + ')'">
                                <div class="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent"></div>
                                <div class="absolute bottom-6 left-6 right-6">
                                    <div class="bg-blue-600/90 text-white text-[10px] font-bold px-2 py-1 rounded w-fit mb-3 uppercase tracking-wide backdrop-blur">
                                        {{ currentApp() }} • Level {{ navStack().length }}
                                    </div>
                                    <h1 class="text-3xl font-bold text-white leading-tight drop-shadow-xl">{{getCurrentPageTitle()}}</h1>
                                </div>
                           </div>
                           
                           <div class="p-6 space-y-8">
                               <!-- Author/Meta Info -->
                               <div class="flex items-center gap-3 text-xs text-gray-400 border-b border-white/10 pb-6">
                                   <div class="w-10 h-10 rounded-full bg-gray-700 border border-white/10 overflow-hidden">
                                       <img src="https://i.pravatar.cc/150?u=a042581f4e29026704d" class="w-full h-full object-cover">
                                   </div>
                                   <div class="flex flex-col">
                                       <span class="text-white font-bold text-sm">{{ getContextualAuthor(currentApp()) }}</span>
                                       <span>2 hours ago • Verified Source</span>
                                   </div>
                               </div>
                               
                               <!-- Body Text (Simulated Context) -->
                               <div class="text-[15px] text-gray-300 leading-7 font-normal space-y-4">
                                   <p>{{ getContextualBody(currentApp()) }}</p>
                                   <p>Detailed analysis continues below with visualization data extracted from the {{currentApp()}} core engine.</p>
                                </div>

                               <!-- Level 4 Preview: Embedded Chart (Context Aware Type) -->
                               <div class="bg-[#1c1c1e] rounded-2xl p-6 border border-white/5 shadow-lg group cursor-pointer hover:border-blue-500/50 transition-colors" 
                                    (click)="navigate('Visual Analysis', 'chart', null)">
                                   <div class="flex justify-between items-end mb-6">
                                       <div>
                                           <div class="text-[10px] text-gray-500 uppercase font-bold tracking-wider mb-1">{{currentApp()}} VISUALIZATION</div>
                                           <div class="text-xl font-bold text-white">
                                               {{ currentApp() === 'STOCKS' ? 'Market Trend' : (currentApp() === 'WEATHER' ? 'Temp Curve' : (currentApp() === 'EEW' ? 'Waveform' : 'Data Metrics')) }}
                                           </div>
                                       </div>
                                       <div class="bg-green-500/20 text-green-400 text-xs font-bold px-2 py-1 rounded flex items-center gap-1">
                                           ▲ 12.5%
                                       </div>
                                   </div>
                                   
                                   <!-- Contextual Chart Type -->
                                   <div class="flex items-end gap-1.5 h-40 border-b border-white/10 pb-1">
                                       <!-- Stocks: Candlestick approximation -->
                                       @if(currentApp() === 'STOCKS') {
                                            <div *ngFor="let h of [40, 60, 45, 70, 55, 80, 65, 90, 75]" class="flex-1 flex flex-col justify-end items-center group relative h-full">
                                                <div class="w-[1px] bg-gray-500 h-full absolute"></div>
                                                <div class="w-full relative z-10" 
                                                     [style.height.%]="h/2" 
                                                     [class.bg-green-500]="h%2===0" [class.bg-red-500]="h%2!==0"></div>
                                            </div>
                                       } 
                                       <!-- Weather: Line/Bar hybrid -->
                                       @else if (currentApp() === 'WEATHER') {
                                            <div *ngFor="let h of [20, 25, 30, 45, 60, 80, 75, 50, 40]" 
                                                 class="flex-1 bg-yellow-500/50 rounded-t-full hover:bg-yellow-400 transition-colors" 
                                                 [style.height.%]="h"></div>
                                       }
                                       <!-- EEW: Waveform / Frequency Distribution -->
                                       @else if (currentApp() === 'EEW') {
                                            <div *ngFor="let h of [10, 15, 80, 95, 40, 20, 15, 30, 85, 90, 25, 10, 5]" 
                                                 class="flex-1 bg-gradient-to-t from-purple-900 to-purple-500 rounded-t-sm" 
                                                 [style.height.%]="h"></div>
                                       }
                                       <!-- Default: Bar -->
                                       @else {
                                            <div *ngFor="let h of [40, 65, 35, 85, 50, 75, 95, 55, 80]" 
                                                 class="flex-1 bg-gradient-to-t from-blue-900 to-blue-500 rounded-t-[3px] hover:from-blue-700 hover:to-blue-400 transition-all" 
                                                 [style.height.%]="h">
                                            </div>
                                       }
                                   </div>
                                   <div class="mt-3 flex justify-between text-[10px] text-gray-500 uppercase font-bold">
                                       <span>Start</span>
                                       <span>Click to Expand (Level {{navStack().length + 1}})</span>
                                       <span>End</span>
                                   </div>
                               </div>

                               @if(navStack().length < 5) {
                                   <button (click)="navigate('Deep Data Source', 'raw', null)" class="w-full py-4 bg-white/5 hover:bg-white/10 active:scale-[0.98] transition-all rounded-xl font-bold text-sm text-white border border-white/10 flex items-center justify-center gap-2">
                                       <span>View Raw Metadata (Level {{navStack().length + 1}})</span>
                                       <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                                   </button>
                               }
                           </div>
                       </div>
                   }
                   
                   <!-- Level 4: Chart / Map (Expanded) -->
                   @if(getCurrentPageType() === 'chart' || getCurrentPageType() === 'map') {
                       <div class="h-full relative bg-[#0f0f0f] p-4 flex flex-col items-center justify-center animate-in zoom-in-95 duration-500">
                           <div class="absolute inset-0 opacity-10" style="background-image: radial-gradient(#444 1px, transparent 1px); background-size: 20px 20px;"></div>
                           
                           @if(getCurrentPageType() === 'map') {
                               <div class="absolute inset-0 bg-slate-800">
                                   <!-- Stylized Map -->
                                   <div class="absolute top-0 left-1/4 w-4 h-full bg-slate-700"></div>
                                   <div class="absolute top-1/3 left-0 w-full h-4 bg-slate-700"></div>
                                   <div class="absolute top-1/2 right-0 w-full h-2 bg-slate-700 -rotate-12"></div>
                                   <!-- Pin -->
                                   <div class="absolute top-1/4 left-1/4 w-10 h-10 -translate-x-5 -translate-y-10 text-red-500 animate-bounce drop-shadow-2xl z-10 filter drop-shadow-lg">
                                       <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
                                   </div>
                               </div>
                               <div class="absolute bottom-8 left-4 right-4 bg-black/80 backdrop-blur-xl p-5 rounded-2xl border border-white/10 shadow-2xl">
                                   <div class="flex justify-between items-start mb-2">
                                       <h3 class="text-white font-bold text-base">Target Location</h3>
                                       <span class="text-[10px] bg-blue-600 px-2 py-0.5 rounded font-bold">LIVE</span>
                                   </div>
                                   <p class="text-gray-400 text-xs font-mono">LAT: 25.0345 N | LNG: 121.5644 E</p>
                                   <button (click)="navigate('Sector Data', 'raw', null)" class="w-full mt-4 bg-white/10 hover:bg-white/20 py-3 rounded-xl text-sm font-bold transition-colors">Analyze Sector (Level 5)</button>
                               </div>
                           } @else {
                               <!-- Large Interactive Chart (Context Aware) -->
                               <div class="w-full h-80 bg-gray-900 rounded-3xl p-6 border border-white/5 relative shadow-2xl overflow-hidden">
                                   <div class="absolute top-0 left-0 right-0 h-16 bg-gradient-to-b from-black/50 to-transparent z-10"></div>
                                   <div class="absolute top-4 left-6 text-xs font-bold text-gray-400 uppercase tracking-widest">{{currentApp()}} METRICS</div>
                                   
                                   <div class="flex items-end justify-between h-full pt-10 pb-2 gap-1.5">
                                       <div *ngFor="let h of [20, 45, 30, 80, 55, 95, 40, 65, 35, 75, 50, 85, 60, 90, 45]" 
                                            class="w-full rounded-t-[4px] animate-in slide-in-from-bottom duration-[1000ms] hover:opacity-80 transition-opacity"
                                            [class.bg-gradient-to-t]="true"
                                            [class.from-purple-600]="currentApp() === 'EEW'" [class.to-pink-500]="currentApp() === 'EEW'"
                                            [class.from-green-600]="currentApp() === 'STOCKS'" [class.to-emerald-400]="currentApp() === 'STOCKS'"
                                            [class.from-blue-600]="currentApp() === 'WEATHER'" [class.to-cyan-400]="currentApp() === 'WEATHER'"
                                            [class.from-gray-700]="currentApp() === 'NEWS'" [class.to-gray-400]="currentApp() === 'NEWS'"
                                            [style.height.%]="h"></div>
                                   </div>
                               </div>
                               <div class="mt-8 text-center px-6">
                                   <h2 class="text-2xl font-bold text-white mb-2">Deep Analysis</h2>
                                   <p class="text-gray-400 text-sm leading-relaxed">
                                       Visualizing complex datasets from the last 24 hours. The trend indicates a significant anomaly in the sector.
                                   </p>
                                   <button (click)="navigate('Raw Dataset', 'raw', null)" class="mt-6 text-blue-400 text-sm font-bold hover:text-blue-300">View Source Data (Level 5)</button>
                               </div>
                           }
                       </div>
                   }

                   <!-- Level 5: Raw Data / Terminal (Context Aware) -->
                   @if(getCurrentPageType() === 'raw') {
                        <div class="h-full bg-[#0d1117] p-4 font-mono text-xs overflow-y-auto text-green-400/90 animate-in fade-in duration-500">
                            <div class="mb-4 text-white font-bold border-b border-white/10 pb-2 flex justify-between">
                                <span>RAW_{{currentApp()}}_STREAM.json</span>
                                <span class="text-gray-500">RO-444</span>
                            </div>
                            <div class="space-y-1">
                                <div><span class="text-purple-400">timestamp</span>: {{active() ? '1692634455000' : '1692634000000'}},</div>
                                <div><span class="text-purple-400">app_context</span>: "{{currentApp()}}",</div>
                                <div><span class="text-purple-400">depth_level</span>: 5,</div>
                                <div><span class="text-purple-400">payload</span>: {{ '{' }}</div>
                                
                                @if(currentApp() === 'STOCKS') {
                                    <div class="pl-4"><span class="text-blue-400">"bid"</span>: 145.20,</div>
                                    <div class="pl-4"><span class="text-blue-400">"ask"</span>: 145.25,</div>
                                    <div class="pl-4"><span class="text-blue-400">"vol"</span>: 1200000,</div>
                                } @else if(currentApp() === 'WEATHER') {
                                    <div class="pl-4"><span class="text-blue-400">"pressure_hpa"</span>: 1013.2,</div>
                                    <div class="pl-4"><span class="text-blue-400">"humidity_pct"</span>: 65,</div>
                                    <div class="pl-4"><span class="text-blue-400">"uv_index"</span>: 7,</div>
                                } @else if(currentApp() === 'EEW') {
                                    <div class="pl-4"><span class="text-blue-400">"pga_z"</span>: 12.4,</div>
                                    <div class="pl-4"><span class="text-blue-400">"pga_ns"</span>: 45.1,</div>
                                    <div class="pl-4"><span class="text-blue-400">"pga_ew"</span>: 33.2,</div>
                                } @else {
                                    <div class="pl-4"><span class="text-blue-400">"signal_strength"</span>: -45,</div>
                                    <div class="pl-4"><span class="text-blue-400">"latency_ms"</span>: 12,</div>
                                }
                                
                                <div>{{ '}' }},</div>
                                <div><span class="text-purple-400">checksum</span>: "0x4A5F99B...",</div>
                                <div class="opacity-50 mt-4">// End of Stream</div>
                                <div class="mt-4 text-white bg-white/10 p-2 rounded">
                                    > SYSTEM_CHECK: OK
                                    <br>> RENDER_COMPLETE
                                </div>
                            </div>
                        </div>
                   }
               </div>
          </div>

          <!-- PWS NOTIFICATION (True Presidential Alert Popup) -->
          @if (active() && !isAlertDismissed()) {
            <div class="absolute inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
                <div class="w-[85%] max-w-[280px] bg-[#1c1c1e] rounded-[22px] overflow-hidden shadow-2xl border border-white/10 animate-in zoom-in duration-300 flex flex-col font-sans">
                    <div class="p-6 flex flex-col items-center text-center">
                        <div class="mb-4 relative">
                            <div class="absolute -inset-4 bg-red-500/20 blur-xl rounded-full"></div>
                            <h2 class="text-white font-bold text-[19px] leading-6 relative z-10">Emergency Alert</h2>
                            <p class="text-red-400 text-[11px] font-bold uppercase tracking-widest mt-1 relative z-10">
                                {{ getAlertHeader() }}
                            </p>
                        </div>
                        <p class="text-white text-[15px] leading-[20px] font-normal opacity-90">
                            {{ getAlertMessage() }}
                        </p>
                    </div>
                    <div class="border-t border-white/10 flex">
                        <button (click)="dismissAlert()" class="flex-1 py-4 text-[#0a84ff] text-[17px] font-semibold active:bg-white/10 transition-colors">
                            OK
                        </button>
                    </div>
                </div>
            </div>
          }
      </div>
      
      <!-- Home Bar -->
      <div class="absolute bottom-2 left-1/2 -translate-x-1/2 w-36 h-1.5 bg-white rounded-full opacity-60 z-50 cursor-pointer hover:opacity-100 transition-opacity hover:scale-110 active:scale-95 shadow-[0_0_10px_white]" (click)="goHome()"></div>
    </div>
  `
})
export class PhoneAlertComponent {
    gemini = inject(GeminiService);
    // Fix: Explicitly type DomSanitizer to prevent implicit 'unknown' error
    sanitizer: DomSanitizer = inject(DomSanitizer);

    active = input<boolean>(false);
    location = input<string>('');
    time = input<string>('');
    magnitude = input<string>('');
    intensity = input<string>('');
    tsunami = input<boolean>(false);
    volcano = input<boolean>(false);

    currentApp = signal<AppType>('HOME');
    navStack = signal<NavPage[]>([]);
    isAlertDismissed = signal(false);
    batteryLevel = signal(100);
    flashlightOn = signal(false);
    alertMessage = signal(''); // Store generated message
    
    // Parallax State
    mouseX = 0;
    mouseY = 0;

    appsList = [
        { id: 'EEW', name: 'EEW Pro', bgClass: 'from-gray-900 to-black border-red-500/30', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-7 h-7"><path d="M2 12h2l2 8 4-16 4 16 4-8h2"/></svg>' },
        { id: 'MAPS', name: 'Maps', bgClass: 'from-emerald-500 to-green-600', icon: '<svg viewBox="0 0 24 24" fill="white" class="w-7 h-7"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>' },
        { id: 'NEWS', name: 'News', bgClass: 'from-rose-500 to-red-600', icon: '<svg viewBox="0 0 24 24" fill="white" class="w-7 h-7"><path d="M20 2H4c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 19h12v-2H6v2zm0-4h12v-2H6v2zm0-4h12V9H6v2zm0-4h12V5H6v2z"/></svg>' },
        { id: 'FLASHLIGHT', name: 'Flashlight', bgClass: 'from-yellow-400 to-amber-500', icon: '<svg viewBox="0 0 24 24" fill="white" class="w-7 h-7"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>' },
        { id: 'STOCKS', name: 'Stocks', bgClass: 'from-gray-800 to-slate-900', icon: '<svg viewBox="0 0 24 24" fill="white" class="w-7 h-7"><path d="M3 3v18h18"/><path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3"/></svg>' },
        { id: 'WEATHER', name: 'Weather', bgClass: 'from-blue-400 to-cyan-500', icon: '<svg viewBox="0 0 24 24" fill="white" class="w-7 h-7"><path d="M6.76 4.84l-1.8-1.79-1.41 1.41 1.79 1.79 1.42-1.41zM4 10.5H1v2h3v-2zm9-9.95h-2V3.5h2V.55zm7.45 3.91l-1.41-1.41-1.79 1.79 1.41 1.41 1.79-1.79zm-3.21 13.7l1.79 1.79 1.41-1.41-1.79-1.79-1.41 1.41zM20 10.5v2h3v-2h-3zm-8-5c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6zm-1 16.95h2V19.5h-2v2.95zm-7.45-3.91l1.41 1.41 1.79-1.8-1.41-1.41-1.79 1.8z"/></svg>' },
        { id: 'SETTINGS', name: 'Settings', bgClass: 'from-gray-500 to-slate-600', icon: '<svg viewBox="0 0 24 24" fill="white" class="w-7 h-7"><path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 00.12-.61l-1.92-3.32a.488.488 0 00-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 00-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96a.48.48 0 00-.59.22L2.68 8.87a.484.484 0 00.12.61l2.03 1.58c-.05.3-.07.62-.07.94s.02.64.07.94l-2.03 1.58a.48.48 0 00-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.57 1.62-.94l2.39.96c.21.08.47 0 .59-.22l1.92-3.32a.484.484 0 00-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/></svg>' },
        { id: 'CAMERA', name: 'Camera', bgClass: 'from-neutral-700 to-neutral-800 border-2 border-neutral-600', icon: '<div class="w-8 h-8 rounded-full bg-[#1a1a1a] border-2 border-[#333] flex items-center justify-center shadow-inner"><div class="w-3 h-3 rounded-full bg-[#0f0f0f] shadow-[inset_0_1px_2px_rgba(255,255,255,0.2)]"></div></div>' },
        { id: 'PHOTOS', name: 'Photos', bgClass: 'bg-white', icon: '<div class="w-full h-full relative"><div class="absolute w-3 h-3 rounded-full bg-orange-400 top-2.5 left-3 mix-blend-multiply opacity-90"></div><div class="absolute w-3 h-3 rounded-full bg-green-400 top-2.5 right-3 mix-blend-multiply opacity-90"></div><div class="absolute w-3 h-3 rounded-full bg-blue-400 bottom-3.5 left-4 mix-blend-multiply opacity-90"></div><div class="absolute w-3 h-3 rounded-full bg-pink-400 bottom-2.5 right-2.5 mix-blend-multiply opacity-90"></div></div>' },
        { id: 'MUSIC', name: 'Music', bgClass: 'from-pink-500 to-rose-600', icon: '<svg viewBox="0 0 24 24" fill="white" class="w-8 h-8"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>' },
        { id: 'MAIL', name: 'Mail', bgClass: 'from-blue-500 to-indigo-600', icon: '<svg viewBox="0 0 24 24" fill="white" class="w-7 h-7"><path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg>' },
        { id: 'CALENDAR', name: 'Calendar', bgClass: 'bg-white', icon: '<div class="flex flex-col items-center justify-center pt-1"><span class="text-[7px] text-red-600 font-bold uppercase tracking-wider">WED</span><span class="text-xl font-light text-slate-900 -mt-1">21</span></div>' },
    ];
    
    dockList = [
        { id: 'PHONE', bgClass: 'from-green-500 to-green-600', icon: '<svg viewBox="0 0 24 24" fill="white" class="w-6 h-6"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/></svg>' },
        { id: 'BROWSER', bgClass: 'from-blue-500 to-blue-600', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" class="w-6 h-6"><circle cx="12" cy="12" r="9"/><line x1="3.6" y1="9" x2="20.4" y2="9"/><line x1="3.6" y1="15" x2="20.4" y2="15"/><path d="M11.5 3a17 17 0 000 18"/><path d="M12.5 3a17 17 0 010 18"/></svg>' },
        { id: 'NOTES', bgClass: 'from-yellow-400 to-orange-400', icon: '<svg viewBox="0 0 24 24" fill="white" class="w-6 h-6"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>' },
        { id: 'CALCULATOR', bgClass: 'from-gray-700 to-gray-800', icon: '<div class="grid grid-cols-2 gap-1"><div class="w-2 h-2 rounded-full bg-orange-500"></div><div class="w-2 h-2 rounded-full bg-gray-400"></div><div class="w-2 h-2 rounded-full bg-gray-400"></div><div class="w-2 h-2 rounded-full bg-gray-400"></div></div>' }
    ];

    constructor() {
        effect(() => { 
            const isActive = this.active();
            // Track key changes to update message if event type escalates
            const isVolcano = this.volcano();
            const isTsunami = this.tsunami();
            const loc = this.location();

            if (isActive) { 
                this.isAlertDismissed.set(false);
                this.updateAlertMessage();
            } 
        });
        setInterval(() => { this.batteryLevel.update(v => Math.max(10, v - 0.1)); }, 30000);
    }

    private updateAlertMessage() {
        const d = new Date();
        const dateStr = `${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getDate().toString().padStart(2, '0')}`;
        const timeStr = this.time();
        const loc = this.location() || '未知地點';
        // Random CWA-style ID for realism
        const id = `0${Math.floor(Math.random()*9)+1}_${Math.floor(Math.random()*9000)+1000} ${Math.floor(Math.random()*9000)+1000}`;

        if (this.volcano()) {
            this.alertMessage.set(
                `[火山噴發訊息 Volcanic Eruption Message] ${dateStr} ${timeStr}左右 ${loc} 偵測到火山噴發，請注意火山灰擴散並遠離危險區域，氣象署。Volcanic eruption detected. Beware of ashfall and stay away from danger zones. CWA ${id} 避難宣導：https://gov.tw/HmJ`
            );
        } else if (this.tsunami()) {
            this.alertMessage.set(
                `[海嘯警報 Tsunami Alert] ${dateStr} ${timeStr}左右 ${loc} 發生地震引發海嘯，沿海民眾請立即疏散至高處避難，氣象署。Tsunami warning issued. Coastal residents evacuate to higher ground immediately. CWA ${id} 避難宣導：https://gov.tw/HmJ`
            );
        } else {
            this.alertMessage.set(
                `[地震速報 Earthquake Alert] ${dateStr} ${timeStr}左右 ${loc} 發生顯著有感地震，慎防強烈搖晃，就近避難「趴下、掩護、穩住」，氣象署。Felt earthquake alert. Keep calm and seek cover nearby. CWA ${id} 避難宣導：https://gov.tw/HmJ`
            );
        }
    }

    // --- Parallax Effect ---
    handleMouseMove(e: MouseEvent) {
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const x = e.clientX - rect.left - rect.width / 2;
        const y = e.clientY - rect.top - rect.height / 2;
        this.mouseX = x;
        this.mouseY = y;
    }

    resetParallax() {
        this.mouseX = 0;
        this.mouseY = 0;
    }

    parallaxStyle() {
        const moveX = -(this.mouseX / 30); 
        const moveY = -(this.mouseY / 30);
        return `translate(${moveX}px, ${moveY}px) scale(1.15)`;
    }

    // --- Flashlight ---
    toggleFlashlight() {
        this.flashlightOn.update(v => !v);
    }

    // --- Navigation & Content ---
    getSafeHtml(html: string): SafeHtml {
        return this.sanitizer.bypassSecurityTrustHtml(html);
    }

    openApp(appId: any) {
        this.currentApp.set(appId);
        const rootContent = this.generateRootContent(appId);
        this.navStack.set([rootContent]);
    }

    navigate(title: string, type: 'list' | 'detail' | 'grid' | 'custom' | 'gallery' | 'article' | 'map' | 'chart' | 'flashlight' | 'raw', content: any) {
        const currentDepth = this.navStack().length;
        this.navStack.update(s => [...s, { 
            id: Date.now().toString(), 
            title, 
            type, 
            content,
            depth: currentDepth + 1,
            appName: this.currentApp()
        }]);
    }

    goBack() {
        if (this.navStack().length > 1) {
            this.navStack.update(s => s.slice(0, -1));
        } else {
            this.goHome();
        }
    }

    goHome() {
        this.currentApp.set('HOME');
        this.navStack.set([]);
    }

    dismissAlert() {
        this.isAlertDismissed.set(true);
    }

    // Fix: Replace unsupported .at(-1) with standard array index access
    getCurrentPageTitle() { 
        const stack = this.navStack();
        return stack[stack.length - 1]?.title || ''; 
    }
    getCurrentPageType() { 
        const stack = this.navStack();
        return stack[stack.length - 1]?.type || 'list'; 
    }
    getCurrentContent() { 
        const stack = this.navStack();
        return stack[stack.length - 1]?.content; 
    }
    getCurrentListItems() { 
        const stack = this.navStack();
        const content = stack[stack.length - 1]?.content;
        return Array.isArray(content) ? content : []; 
    }

    // --- Context-Aware Content Generator ---
    generateRootContent(appId: string): NavPage {
        const depth = 1;
        switch(appId) {
            case 'EEW': return { id: 'root', title: 'EEW Dashboard', type: 'custom', content: 'dashboard', depth, appName: appId };
            case 'FLASHLIGHT': return { id: 'root', title: 'Flashlight', type: 'flashlight', content: null, depth, appName: appId };
            
            case 'NEWS': return { id: 'root', title: 'Top Stories', type: 'list', content: this.generateNewsItems(), depth, appName: appId };
            case 'WEATHER': return { id: 'root', title: 'Forecast', type: 'list', content: this.generateWeatherItems(), depth, appName: appId };
            case 'STOCKS': return { id: 'root', title: 'Market Watch', type: 'list', content: this.generateStockItems(), depth, appName: appId };
            case 'MAPS': return { id: 'root', title: 'Explore', type: 'map', content: null, depth, appName: appId };
            
            case 'SETTINGS': return { id: 'root', title: 'Settings', type: 'list', content: [
                { label: 'Airplane Mode', sub: 'Off', icon: '✈️', targetType: 'detail' },
                { label: 'Wi-Fi', sub: 'Seismo-Net', icon: '📶', targetType: 'list', content: this.generateList(5, 'Network') },
                { label: 'Notifications', sub: 'On', icon: '🔔', targetType: 'list', content: this.generateList(3, 'App') },
                { label: 'General', sub: '', icon: '⚙️', targetType: 'list', content: this.generateList(6, 'Option') },
                { label: 'Display & Brightness', sub: '', icon: '☀️', targetType: 'detail' }
            ], depth, appName: appId };
            case 'PHOTOS': return { id: 'root', title: 'Recent', type: 'gallery', content: this.generateList(12, 'Photo'), depth, appName: appId };
            
            default: return { id: 'root', title: appId, type: 'list', content: this.generateList(5, 'Item', 'Description'), depth, appName: appId };
        }
    }

    generateList(count: number, prefix: string = 'Item', sub: string = 'Detail', targetType: any = 'detail') {
        return Array.from({length: count}, (_, i) => ({
            label: `${prefix} ${i+1}`,
            sub: `${sub} ${i+1}`,
            targetType: targetType,
            content: `This is detailed content for ${prefix} ${i+1}. Generated at Level 2+.`
        }));
    }

    // -- Specific Context Generators --

    generateNewsItems() {
        return [
            { label: 'Volcano Activity Increasing', sub: 'Breaking News • 2m ago', image: 'https://picsum.photos/100/100?random=1', targetType: 'article' },
            { label: 'Tech Giants Merge', sub: 'Business • 1h ago', icon: '💼', targetType: 'article' },
            { label: 'Global Markets Rally', sub: 'Finance • 3h ago', icon: '📈', targetType: 'article' },
            { label: 'New AI Model Released', sub: 'Technology • 5h ago', image: 'https://picsum.photos/100/100?random=2', targetType: 'article' }
        ];
    }

    generateWeatherItems() {
        return [
            { label: 'Taipei', sub: 'Rain • 24°C', icon: '🌧️', targetType: 'detail' },
            { label: 'Tokyo', sub: 'Sunny • 28°C', icon: '☀️', targetType: 'detail' },
            { label: 'New York', sub: 'Cloudy • 18°C', icon: '☁️', targetType: 'detail' },
            { label: 'London', sub: 'Rain • 15°C', icon: '🌧️', targetType: 'detail' }
        ];
    }

    generateStockItems() {
        return [
            { label: 'AAPL', sub: 'Apple Inc. • +1.2%', icon: '📈', targetType: 'chart' },
            { label: 'TSMC', sub: 'Taiwan Semi • +3.5%', icon: '🏭', targetType: 'chart' },
            { label: 'GOOGL', sub: 'Alphabet Inc. • -0.4%', icon: '📉', targetType: 'chart' },
            { label: 'NVDA', sub: 'NVIDIA Corp • +5.1%', icon: '🚀', targetType: 'chart' }
        ];
    }

    // -- Context Detail Helpers --
    getContextualImage(app: string) {
        if(app === 'NEWS') return 'https://picsum.photos/600/400?grayscale';
        if(app === 'WEATHER') return 'https://images.unsplash.com/photo-1592210454359-9043f067919b?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80';
        if(app === 'STOCKS') return 'https://images.unsplash.com/photo-1611974765270-ca1258634369?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80';
        if(app === 'EEW') return 'https://images.unsplash.com/photo-1517524927509-0d314840846c?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80'; // Seismic Map
        
        // Deterministic fallback (Use hash of app name instead of Math.random)
        let hash = 0;
        for (let i = 0; i < app.length; i++) {
            hash = app.charCodeAt(i) + ((hash << 5) - hash);
        }
        return `https://picsum.photos/600/400?random=${Math.abs(hash)}`;
    }

    getContextualAuthor(app: string) {
        if(app === 'NEWS') return 'Reuters Feed';
        if(app === 'WEATHER') return 'CWA Met Office';
        if(app === 'STOCKS') return 'Bloomberg Terminal';
        if(app === 'EEW') return 'Seismic Center';
        return 'System Admin';
    }

    getContextualBody(app: string) {
        if(app === 'NEWS') return 'Breaking: Major seismic activity reported in the Pacific Ring of Fire. Markets react as supply chains face potential disruption. Authorities are monitoring the situation closely.';
        if(app === 'WEATHER') return 'A high-pressure system is moving in from the east, bringing clear skies and rising temperatures. Expect UV index to peak around noon. Coastal areas should be wary of sudden gusts.';
        if(app === 'STOCKS') return 'Tech sector rallies as semiconductor demand outstrips supply. TSMC leads gains in Asian trading hours. Analysts upgrade forecast for Q4 revenue.';
        if(app === 'EEW') return 'Event Report: A significant seismic event has been detected. Preliminary data suggests shallow depth. Residents in affected areas should prepare for aftershocks. Check tsunami status immediately.';
        return 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.';
    }

    // --- Helpers ---
    getNotchText() { return this.volcano() ? 'VOLCANO WARNING' : 'EARTHQUAKE ALERT'; }
    getAlertTitle() { return this.volcano() ? '火山噴發警報' : (this.tsunami() ? '海嘯警報' : '地震警報'); }
    getAlertHeader() { 
        if (this.tsunami()) return 'NATIONAL ALERT (TSUNAMI)';
        if (this.volcano()) return 'PRESIDENTIAL ALERT (VOLCANO)';
        return 'PRESIDENTIAL ALERT';
    }
    getAlertMessage() { 
        return this.alertMessage();
    }
}