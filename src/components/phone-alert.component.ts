import { Component, input, signal, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GeminiService } from '../services/gemini.service';

type AppType = 'HOME' | 'EEW' | 'MAPS' | 'VISION' | 'WEATHER' | 'NEWS' | 'SETTINGS' | 
               'SOCIAL' | 'CAMERA' | 'PHOTOS' | 'MUSIC' | 'MAIL' | 'CALENDAR' | 
               'CLOCK' | 'NOTES' | 'CALCULATOR' | 'BROWSER';

@Component({
  selector: 'app-phone-alert',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="relative w-[320px] h-[640px] bg-black rounded-[3rem] border-[6px] border-slate-800 shadow-2xl overflow-hidden font-sans select-none transform transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:scale-105 will-change-transform">
      
      <!-- Dynamic Island / Notch -->
      <div class="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-8 bg-black rounded-b-3xl z-50 flex justify-center items-center">
        <div class="w-20 h-5 bg-black rounded-full flex items-center justify-between px-2 relative overflow-hidden">
             <!-- Activity Indicators -->
            <div class="w-1.5 h-1.5 rounded-full bg-green-500" [class.animate-pulse]="active()"></div>
            @if(active()) {
                <div class="text-[8px] text-white font-mono animate-marquee whitespace-nowrap px-1">PWS ALERT ACTIVE</div>
            }
            <div class="w-1.5 h-1.5 rounded-full bg-orange-500"></div>
        </div>
      </div>
      
      <!-- Screen Content Container -->
      <div class="w-full h-full bg-slate-900 flex flex-col relative overflow-hidden text-white">
          
          <!-- Wallpaper Layer -->
          <div class="absolute inset-0 z-0 bg-cover bg-center transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)]"
               [style.background-image]="'url(https://picsum.photos/320/640)'"
               [class.scale-125]="currentApp() !== 'HOME'"
               [class.blur-xl]="currentApp() !== 'HOME'">
               <div class="absolute inset-0 bg-black/30"></div>
          </div>

          <!-- Status Bar -->
          <div class="absolute top-3 left-8 text-[12px] font-bold text-white z-40 drop-shadow-md">{{time()}}</div>
          <div class="absolute top-3 right-8 text-[12px] font-bold text-white flex gap-1.5 z-40 drop-shadow-md">
             <div class="w-4 h-3 border border-white rounded-[2px] relative ml-0.5"><div class="absolute inset-y-0.5 left-0.5 right-1 bg-white"></div></div>
          </div>

          <!-- ANIMATION OVERLAY (The "Video") -->
          <!-- Plays when opening ANY app -->
          @if (isPlayingAnimation()) {
             <div class="absolute inset-0 z-[100] bg-black flex items-center justify-center overflow-hidden animate-in fade-in duration-200">
                 <!-- Simulation of the Red ROG-style video -->
                 <div class="absolute inset-0 bg-gradient-to-br from-red-900 to-black"></div>
                 <div class="absolute w-[200%] h-[10px] bg-red-500 blur-xl rotate-45 animate-slash"></div>
                 <div class="absolute w-[200%] h-[2px] bg-white rotate-45 animate-slash delay-100"></div>
                 <div class="absolute inset-0 flex items-center justify-center">
                     <svg viewBox="0 0 100 100" class="w-32 h-32 text-red-600 fill-current animate-pulse-fast drop-shadow-[0_0_20px_rgba(220,38,38,0.8)]">
                         <path d="M50 20 L80 80 L20 80 Z" />
                         <path d="M30 65 L70 65 L50 35 Z" fill="black"/>
                     </svg>
                 </div>
                 <div class="absolute bottom-10 text-red-500 font-mono text-xl font-bold tracking-[0.5em] animate-pulse">SYSTEM START</div>
             </div>
          }

          <!-- HOME SCREEN -->
          <div class="relative z-10 flex-1 flex flex-col pt-16 px-4 pb-6 transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] origin-center"
               [class.opacity-0]="currentApp() !== 'HOME'"
               [class.scale-90]="currentApp() !== 'HOME'"
               [class.pointer-events-none]="currentApp() !== 'HOME'">
               
               <!-- App Grid (16 Apps - 4x4) -->
               <div class="grid grid-cols-4 gap-x-2 gap-y-5 mt-4">
                    <!-- Row 1 -->
                    <button class="flex flex-col items-center gap-1 group" (click)="openApp('EEW')">
                        <div class="w-14 h-14 rounded-2xl bg-gradient-to-br from-gray-800 to-black flex items-center justify-center shadow-lg border border-white/10 group-active:scale-90 transition-transform">
                             <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-red-500"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
                        </div>
                        <span class="text-[10px] text-white font-medium drop-shadow-md">EEW</span>
                    </button>

                    <button class="flex flex-col items-center gap-1 group" (click)="openApp('MAPS')">
                        <div class="w-14 h-14 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-700 flex items-center justify-center shadow-lg border border-white/10 group-active:scale-90 transition-transform">
                             <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11"></polygon></svg>
                        </div>
                        <span class="text-[10px] text-white font-medium drop-shadow-md">Maps</span>
                    </button>

                    <button class="flex flex-col items-center gap-1 group" (click)="openApp('VISION')">
                        <div class="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-700 flex items-center justify-center shadow-lg border border-white/10 group-active:scale-90 transition-transform relative overflow-hidden">
                             <div class="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-30"></div>
                             <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                        </div>
                        <span class="text-[10px] text-white font-medium drop-shadow-md">Vision</span>
                    </button>

                    <button class="flex flex-col items-center gap-1 group" (click)="openApp('WEATHER')">
                        <div class="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center shadow-lg border border-white/10 group-active:scale-90 transition-transform">
                             <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="white" stroke="currentColor" stroke-width="0" stroke-linecap="round" stroke-linejoin="round"><path d="M17.5 19c0-1.7-1.3-3-3-3h-1.1c-.2-2.3-2.1-4-4.4-4-2.5 0-4.5 2-4.5 4.5 0 .2 0 .5.1.7-1.5.4-2.6 1.7-2.6 3.3 0 1.9 1.6 3.5 3.5 3.5h11.5c1.7 0 3-1.3 3-3z"></path></svg>
                        </div>
                        <span class="text-[10px] text-white font-medium drop-shadow-md">Weather</span>
                    </button>

                    <!-- Row 2 -->
                    <button class="flex flex-col items-center gap-1 group" (click)="openApp('NEWS')">
                        <div class="w-14 h-14 rounded-2xl bg-gradient-to-br from-red-500 to-pink-600 flex items-center justify-center shadow-lg border border-white/10 group-active:scale-90 transition-transform">
                             <span class="font-black text-xl italic text-white">N</span>
                        </div>
                        <span class="text-[10px] text-white font-medium drop-shadow-md">News</span>
                    </button>

                    <button class="flex flex-col items-center gap-1 group" (click)="openApp('SOCIAL')">
                        <div class="w-14 h-14 rounded-2xl bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center shadow-lg border border-white/10 group-active:scale-90 transition-transform">
                            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="white" stroke="currentColor" stroke-width="0" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
                        </div>
                        <span class="text-[10px] text-white font-medium drop-shadow-md">Social</span>
                    </button>

                    <button class="flex flex-col items-center gap-1 group" (click)="openApp('CAMERA')">
                        <div class="w-14 h-14 rounded-2xl bg-gradient-to-br from-zinc-400 to-zinc-600 flex items-center justify-center shadow-lg border border-white/10 group-active:scale-90 transition-transform">
                             <div class="w-8 h-8 rounded-full bg-black border-2 border-zinc-700 ring-1 ring-zinc-500"></div>
                        </div>
                        <span class="text-[10px] text-white font-medium drop-shadow-md">Camera</span>
                    </button>

                    <button class="flex flex-col items-center gap-1 group" (click)="openApp('PHOTOS')">
                         <div class="w-14 h-14 rounded-2xl bg-white flex items-center justify-center shadow-lg group-active:scale-90 transition-transform relative overflow-hidden">
                             <div class="w-4 h-4 rounded-full bg-orange-400 absolute top-2 left-2 opacity-80 mix-blend-multiply"></div>
                             <div class="w-4 h-4 rounded-full bg-green-400 absolute top-2 right-4 opacity-80 mix-blend-multiply"></div>
                             <div class="w-4 h-4 rounded-full bg-blue-400 absolute bottom-3 left-4 opacity-80 mix-blend-multiply"></div>
                             <div class="w-4 h-4 rounded-full bg-pink-400 absolute bottom-2 right-2 opacity-80 mix-blend-multiply"></div>
                        </div>
                        <span class="text-[10px] text-white font-medium drop-shadow-md">Photos</span>
                    </button>

                     <!-- Row 3 -->
                    <button class="flex flex-col items-center gap-1 group" (click)="openApp('MUSIC')">
                        <div class="w-14 h-14 rounded-2xl bg-gradient-to-br from-rose-500 to-red-600 flex items-center justify-center shadow-lg border border-white/10 group-active:scale-90 transition-transform">
                            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="white" stroke="currentColor" stroke-width="0" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>
                        </div>
                        <span class="text-[10px] text-white font-medium drop-shadow-md">Music</span>
                    </button>

                    <button class="flex flex-col items-center gap-1 group" (click)="openApp('MAIL')">
                        <div class="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-400 to-cyan-500 flex items-center justify-center shadow-lg border border-white/10 group-active:scale-90 transition-transform">
                            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="white" stroke="currentColor" stroke-width="0" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
                        </div>
                        <span class="text-[10px] text-white font-medium drop-shadow-md">Mail</span>
                    </button>

                    <button class="flex flex-col items-center gap-1 group" (click)="openApp('CALENDAR')">
                        <div class="w-14 h-14 rounded-2xl bg-white flex flex-col items-center justify-center shadow-lg group-active:scale-90 transition-transform">
                             <div class="text-[8px] text-red-500 font-bold uppercase mt-1">WED</div>
                             <div class="text-2xl font-light text-black -mt-1">21</div>
                        </div>
                        <span class="text-[10px] text-white font-medium drop-shadow-md">Calendar</span>
                    </button>

                    <button class="flex flex-col items-center gap-1 group" (click)="openApp('CLOCK')">
                        <div class="w-14 h-14 rounded-2xl bg-black border border-zinc-700 flex items-center justify-center shadow-lg group-active:scale-90 transition-transform relative">
                             <div class="w-10 h-10 rounded-full border border-zinc-500 relative">
                                 <div class="absolute top-1/2 left-1/2 w-[1px] h-3 bg-white -translate-x-1/2 origin-bottom -translate-y-full rotate-45"></div>
                                 <div class="absolute top-1/2 left-1/2 w-[1px] h-2 bg-white -translate-x-1/2 origin-bottom -translate-y-full -rotate-90"></div>
                                 <div class="absolute top-1/2 left-1/2 w-[1px] h-4 bg-orange-500 -translate-x-1/2 origin-bottom -translate-y-full rotate-12"></div>
                             </div>
                        </div>
                        <span class="text-[10px] text-white font-medium drop-shadow-md">Clock</span>
                    </button>

                     <!-- Row 4 -->
                    <button class="flex flex-col items-center gap-1 group" (click)="openApp('NOTES')">
                        <div class="w-14 h-14 rounded-2xl bg-gradient-to-br from-yellow-300 to-yellow-500 flex items-center justify-center shadow-lg border border-white/10 group-active:scale-90 transition-transform pt-1">
                             <div class="w-8 h-8 bg-white/50 rounded-sm">
                                 <div class="w-6 h-[1px] bg-black/20 mx-auto mt-2"></div>
                                 <div class="w-6 h-[1px] bg-black/20 mx-auto mt-1"></div>
                                 <div class="w-4 h-[1px] bg-black/20 mx-auto mt-1 mr-3"></div>
                             </div>
                        </div>
                        <span class="text-[10px] text-white font-medium drop-shadow-md">Notes</span>
                    </button>
                    
                    <button class="flex flex-col items-center gap-1 group" (click)="openApp('CALCULATOR')">
                        <div class="w-14 h-14 rounded-2xl bg-gray-800 flex items-center justify-center shadow-lg border border-white/10 group-active:scale-90 transition-transform">
                             <div class="grid grid-cols-2 gap-0.5">
                                 <div class="w-2 h-2 bg-orange-500 rounded-full"></div>
                                 <div class="w-2 h-2 bg-zinc-500 rounded-full"></div>
                                 <div class="w-2 h-2 bg-zinc-500 rounded-full"></div>
                                 <div class="w-2 h-2 bg-zinc-500 rounded-full"></div>
                             </div>
                        </div>
                        <span class="text-[10px] text-white font-medium drop-shadow-md">Calc</span>
                    </button>

                    <button class="flex flex-col items-center gap-1 group" (click)="openApp('BROWSER')">
                         <div class="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-400 to-blue-500 flex items-center justify-center shadow-lg border border-white/10 group-active:scale-90 transition-transform">
                            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>
                        </div>
                        <span class="text-[10px] text-white font-medium drop-shadow-md">Browser</span>
                    </button>

                     <button class="flex flex-col items-center gap-1 group" (click)="openApp('SETTINGS')">
                        <div class="w-14 h-14 rounded-2xl bg-gradient-to-br from-gray-400 to-gray-600 flex items-center justify-center shadow-lg border border-white/10 group-active:scale-90 transition-transform">
                             <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-white"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
                        </div>
                        <span class="text-[10px] text-white font-medium drop-shadow-md">Settings</span>
                    </button>
               </div>
          </div>

          <!-- UNIVERSAL APP CONTAINER -->
          <div class="absolute inset-0 z-20 bg-black flex flex-col transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]"
               [class.scale-0]="currentApp() === 'HOME'"
               [class.opacity-0]="currentApp() === 'HOME'"
               [class.pointer-events-none]="currentApp() === 'HOME'"
               [class.scale-100]="currentApp() !== 'HOME'"
               [class.opacity-100]="currentApp() !== 'HOME'">
               
                <!-- APP CONTENT SWITCH -->
                
                <!-- 1. EEW -->
                @if(currentApp() === 'EEW') {
                    <div class="h-24 bg-zinc-900 pt-10 px-4 flex items-center justify-between border-b border-zinc-800">
                        <button (click)="goHome()" class="text-blue-500 font-bold flex items-center gap-1 text-sm"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>Back</button>
                        <span class="text-white font-bold text-base">CWA EEW</span>
                        <div class="w-8"></div>
                    </div>
                    <div class="flex-1 bg-black p-4 overflow-y-auto">
                        @if(active()) {
                            <div class="flex flex-col items-center justify-center h-full space-y-6 animate-in zoom-in duration-300">
                                <div class="w-24 h-24 rounded-full bg-red-600/20 flex items-center justify-center animate-ping-slow">
                                    <div class="w-16 h-16 rounded-full bg-red-600 flex items-center justify-center shadow-[0_0_20px_red]">
                                        <span class="text-2xl font-black">{{intensity()}}</span>
                                    </div>
                                </div>
                                <div class="text-center space-y-1">
                                    <h2 class="text-red-500 font-bold text-xl uppercase tracking-widest">Earthquake Alert</h2>
                                    <p class="text-white text-sm">Est. Magnitude: M{{magnitude()}}</p>
                                    <p class="text-gray-400 text-xs">{{location()}}</p>
                                </div>
                            </div>
                        } @else {
                            <div class="flex flex-col items-center justify-center h-full text-zinc-600">
                                <p class="text-sm">Monitoring System Normal</p>
                            </div>
                        }
                    </div>
                }

                <!-- 2. MAPS (Google Maps Grounding) -->
                @if(currentApp() === 'MAPS') {
                     <div class="flex-1 bg-slate-100 relative flex flex-col">
                        <div class="h-24 bg-white/90 backdrop-blur pt-10 px-4 flex items-center justify-between border-b border-slate-200 z-10">
                            <button (click)="goHome()" class="text-blue-500 font-bold text-sm">Back</button>
                            <span class="text-black font-bold">Nearby Shelters</span>
                            <div class="w-8"></div>
                        </div>
                        <div class="flex-1 overflow-y-auto p-4 space-y-3">
                            <div class="bg-blue-50 border border-blue-200 p-3 rounded-lg text-xs text-blue-800">
                                Gemini Maps Grounding Active
                            </div>
                            
                            @if (mapsResult()) {
                                <div class="bg-white p-4 rounded-xl shadow text-black text-sm whitespace-pre-wrap leading-relaxed">
                                    {{mapsResult()}}
                                </div>
                            } @else {
                                <div class="flex flex-col items-center justify-center py-10">
                                    <button (click)="fetchMapsData()" class="bg-blue-600 text-white px-4 py-2 rounded-full text-sm font-bold shadow-lg active:scale-95 transition-transform">
                                        Find Nearby Shelters
                                    </button>
                                </div>
                            }
                        </div>
                    </div>
                }

                <!-- 3. VISION (Video AI) -->
                @if(currentApp() === 'VISION') {
                     <div class="flex-1 bg-black relative flex flex-col">
                        <div class="h-24 bg-black/50 backdrop-blur pt-10 px-4 flex items-center justify-between z-10 absolute w-full top-0">
                            <button (click)="goHome()" class="text-white font-bold text-sm">Back</button>
                            <span class="text-white font-bold">Video AI</span>
                            <div class="w-8"></div>
                        </div>
                        <div class="flex-1 bg-gray-900 flex flex-col items-center justify-center relative overflow-hidden">
                             <div class="absolute inset-0 opacity-30 bg-[url('https://picsum.photos/320/640?grayscale')] bg-cover"></div>
                             <div class="w-48 h-48 border-2 border-white/50 rounded-lg relative flex items-center justify-center">
                                 <div class="absolute inset-0 border-t-2 border-l-2 border-red-500 w-4 h-4 -top-0.5 -left-0.5"></div>
                                 <div class="absolute inset-0 border-t-2 border-r-2 border-red-500 w-4 h-4 -top-0.5 -right-0.5"></div>
                                 <div class="absolute inset-0 border-b-2 border-l-2 border-red-500 w-4 h-4 -bottom-0.5 -left-0.5"></div>
                                 <div class="absolute inset-0 border-b-2 border-r-2 border-red-500 w-4 h-4 -bottom-0.5 -right-0.5"></div>
                                 @if (isAnalyzingVideo()) {
                                     <div class="w-full h-0.5 bg-red-500 shadow-[0_0_10px_red] animate-scan-vertical absolute"></div>
                                 }
                             </div>
                             @if (videoResult()) {
                                 <div class="absolute bottom-24 left-4 right-4 bg-black/80 backdrop-blur border border-white/20 p-3 rounded-xl text-xs text-white animate-in slide-in-from-bottom-5">
                                     <div class="text-red-400 font-bold mb-1">GEMINI 3 PRO ANALYSIS</div>
                                     {{videoResult()}}
                                 </div>
                             }
                        </div>
                        <div class="h-24 bg-black flex items-center justify-center gap-8 pb-4">
                            <button (click)="analyzeSampleVideo()" class="w-16 h-16 rounded-full border-4 border-white flex items-center justify-center p-1 active:scale-95 transition-transform">
                                <div class="w-full h-full bg-red-600 rounded-full"></div>
                            </button>
                        </div>
                    </div>
                }

                <!-- 4. WEATHER -->
                @if(currentApp() === 'WEATHER') {
                    <div class="flex-1 bg-gradient-to-b from-blue-400 to-blue-600 flex flex-col p-6 pt-12 text-white relative">
                        <button (click)="goHome()" class="absolute top-12 left-6 text-white/80 font-bold text-sm">Back</button>
                        <div class="mt-8">
                            <div class="text-4xl font-light">Taipei</div>
                            <div class="text-6xl font-thin mt-2">24°</div>
                            <div class="text-lg font-medium mt-1">Cloudy</div>
                            <div class="text-sm opacity-80">H:28° L:20°</div>
                        </div>
                        <div class="mt-8 p-4 bg-white/10 rounded-xl backdrop-blur-md">
                            <div class="text-xs uppercase opacity-70 mb-2">Hourly Forecast</div>
                            <div class="flex justify-between text-sm">
                                <div class="flex flex-col items-center"><span>Now</span><span>24°</span></div>
                                <div class="flex flex-col items-center"><span>1PM</span><span>25°</span></div>
                                <div class="flex flex-col items-center"><span>2PM</span><span>26°</span></div>
                                <div class="flex flex-col items-center"><span>3PM</span><span>25°</span></div>
                            </div>
                        </div>
                    </div>
                }

                <!-- 5. NEWS -->
                @if(currentApp() === 'NEWS') {
                    <div class="h-24 bg-red-600 pt-10 px-4 flex items-center justify-between shadow-md">
                        <button (click)="goHome()" class="text-white font-bold text-sm opacity-80">Back</button>
                        <span class="text-white font-black italic text-lg">BREAKING</span>
                        <div class="w-8"></div>
                    </div>
                    <div class="flex-1 bg-gray-100 p-4">
                         <div class="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                            <div class="text-[10px] text-red-600 font-bold mb-1">LIVE UPDATE</div>
                            <h3 class="font-bold text-lg leading-tight mb-2 text-black">
                                {{ active() ? 'Major Earthquake Detected Offshore' : 'Seismic Activity Normal' }}
                            </h3>
                            <div class="h-32 bg-gray-300 rounded-lg mb-2 overflow-hidden">
                                <img src="https://picsum.photos/300/150?grayscale" class="w-full h-full object-cover opacity-80">
                            </div>
                        </div>
                    </div>
                }

                <!-- 6. SETTINGS -->
                @if(currentApp() === 'SETTINGS') {
                    <div class="h-24 bg-[#f2f2f7] pt-10 px-4 flex items-center gap-2 border-b border-gray-300">
                        <button (click)="goHome()" class="text-blue-500 font-bold text-sm flex items-center"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg> Settings</button>
                        <span class="text-black font-bold text-lg mx-auto pr-8">Settings</span>
                    </div>
                    <div class="flex-1 bg-[#f2f2f7] p-4 space-y-4">
                        <div class="bg-white rounded-xl overflow-hidden">
                            <div class="p-3 border-b border-gray-100 flex justify-between items-center">
                                <span class="text-sm text-black">Airplane Mode</span>
                                <div class="w-10 h-6 rounded-full bg-gray-200 p-0.5"><div class="w-5 h-5 rounded-full bg-white shadow"></div></div>
                            </div>
                            <div class="p-3 flex justify-between items-center">
                                <span class="text-sm text-black">Wi-Fi</span>
                                <span class="text-sm text-gray-500">Seismo-Net 5G</span>
                            </div>
                        </div>
                    </div>
                }

                <!-- 7. SOCIAL -->
                @if(currentApp() === 'SOCIAL') {
                    <div class="h-24 bg-[#202020] pt-10 px-4 flex items-center justify-between border-b border-[#333]">
                        <button (click)="goHome()" class="text-green-500 font-bold text-sm">Back</button>
                        <span class="text-white font-bold">Line</span>
                        <div class="w-8"></div>
                    </div>
                    <div class="flex-1 bg-[#111] p-4 space-y-4">
                        @if(active()) {
                        <div class="flex gap-3 animate-in slide-in-from-left duration-500">
                            <div class="w-8 h-8 rounded-full bg-gray-500"></div>
                            <div class="bg-zinc-800 p-2 rounded-xl rounded-tl-none text-sm max-w-[80%]">
                                Are you okay? I felt that! 😨
                            </div>
                        </div>
                        } @else {
                            <div class="text-center text-zinc-600 mt-10 text-xs">No new messages</div>
                        }
                    </div>
                }

                <!-- 8. CAMERA -->
                @if(currentApp() === 'CAMERA') {
                    <div class="flex-1 bg-black relative">
                        <div class="absolute inset-0 bg-gray-900 flex items-center justify-center">
                            <span class="text-gray-600 text-xs">Camera Preview</span>
                        </div>
                        <div class="absolute bottom-0 w-full h-24 bg-black/50 backdrop-blur flex items-center justify-center gap-8 pb-4">
                            <div class="w-12 h-12 bg-gray-800 rounded-full"></div>
                            <div class="w-16 h-16 bg-white rounded-full border-4 border-gray-300 cursor-pointer active:scale-90 transition-transform"></div>
                            <button (click)="goHome()" class="w-12 h-12 flex items-center justify-center text-white text-sm font-bold bg-gray-800 rounded-full">Exit</button>
                        </div>
                    </div>
                }

                <!-- 9. PHOTOS -->
                @if(currentApp() === 'PHOTOS') {
                    <div class="h-24 bg-white pt-10 px-4 flex items-center justify-between border-b border-gray-200">
                        <button (click)="goHome()" class="text-blue-500 font-bold text-sm">Back</button>
                        <span class="text-black font-bold">Photos</span>
                        <div class="text-blue-500 text-sm">Select</div>
                    </div>
                    <div class="flex-1 bg-white overflow-y-auto">
                        <div class="grid grid-cols-3 gap-0.5">
                            <div class="aspect-square bg-gray-200"><img src="https://picsum.photos/100/100?random=1" class="w-full h-full object-cover"></div>
                            <div class="aspect-square bg-gray-200"><img src="https://picsum.photos/100/100?random=2" class="w-full h-full object-cover"></div>
                            <div class="aspect-square bg-gray-200"><img src="https://picsum.photos/100/100?random=3" class="w-full h-full object-cover"></div>
                            <div class="aspect-square bg-gray-200"><img src="https://picsum.photos/100/100?random=4" class="w-full h-full object-cover"></div>
                            <div class="aspect-square bg-gray-200"><img src="https://picsum.photos/100/100?random=5" class="w-full h-full object-cover"></div>
                            <div class="aspect-square bg-gray-200"><img src="https://picsum.photos/100/100?random=6" class="w-full h-full object-cover"></div>
                        </div>
                    </div>
                }

                <!-- 10. MUSIC -->
                @if(currentApp() === 'MUSIC') {
                    <div class="flex-1 bg-gradient-to-b from-gray-900 to-black text-white flex flex-col p-6 pt-12">
                        <button (click)="goHome()" class="self-start text-red-500 font-bold mb-8 text-sm">Back</button>
                        <div class="w-full aspect-square bg-gray-800 rounded-xl shadow-2xl mb-8 flex items-center justify-center">
                            <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="gray" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>
                        </div>
                        <div class="mb-8">
                            <h3 class="text-xl font-bold">Seismic Waves</h3>
                            <p class="text-gray-400 text-sm">Earthquake Simulator</p>
                        </div>
                        <div class="flex justify-between items-center mb-6">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="19 20 9 12 19 4 19 20"></polygon><line x1="5" y1="19" x2="5" y2="5"></line></svg>
                            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="white" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 4 15 12 5 20 5 4"></polygon><line x1="19" y1="5" x2="19" y2="19"></line></svg>
                        </div>
                    </div>
                }

                <!-- 11. MAIL -->
                @if(currentApp() === 'MAIL') {
                    <div class="h-24 bg-[#f2f2f7] pt-10 px-4 flex items-center justify-between border-b border-gray-300">
                        <button (click)="goHome()" class="text-blue-500 font-bold text-sm">Back</button>
                        <span class="text-black font-bold">Inbox</span>
                        <div class="text-blue-500 text-sm">Edit</div>
                    </div>
                    <div class="flex-1 bg-white">
                        <div class="border-b border-gray-100 p-3">
                            <div class="flex justify-between text-xs text-gray-500 mb-1">
                                <span class="font-bold text-black">CWA Alert</span>
                                <span>10:23 AM</span>
                            </div>
                            <div class="text-xs text-black font-bold">Earthquake Report #124</div>
                            <div class="text-xs text-gray-400 line-clamp-1">Details regarding the recent seismic event in Hualien...</div>
                        </div>
                         <div class="border-b border-gray-100 p-3">
                            <div class="flex justify-between text-xs text-gray-500 mb-1">
                                <span class="font-bold text-black">System Admin</span>
                                <span>Yesterday</span>
                            </div>
                            <div class="text-xs text-black font-bold">Server Maintenance</div>
                            <div class="text-xs text-gray-400 line-clamp-1">Scheduled downtime for sensor upgrades...</div>
                        </div>
                    </div>
                }

                <!-- 12. CALENDAR -->
                @if(currentApp() === 'CALENDAR') {
                     <div class="h-24 bg-white pt-10 px-4 flex items-center justify-between border-b border-gray-200 text-red-500">
                        <button (click)="goHome()" class="font-bold text-sm">Back</button>
                        <span class="font-bold text-black">Calendar</span>
                        <div class="text-sm">+</div>
                    </div>
                    <div class="flex-1 bg-white p-4">
                        <div class="text-3xl font-bold text-black mb-4">January</div>
                        <div class="grid grid-cols-7 gap-2 text-center text-xs text-black">
                            <span class="text-gray-400">S</span><span class="text-gray-400">M</span><span class="text-gray-400">T</span><span class="text-gray-400">W</span><span class="text-gray-400">T</span><span class="text-gray-400">F</span><span class="text-gray-400">S</span>
                            <span class="text-gray-300">29</span><span class="text-gray-300">30</span><span class="text-gray-300">31</span><span>1</span><span>2</span><span>3</span><span>4</span>
                            <span>5</span><span>6</span><span>7</span><span>8</span><span>9</span><span>10</span><span>11</span>
                            <span>12</span><span>13</span><span>14</span><span>15</span><span>16</span><span>17</span><span>18</span>
                            <span>19</span><span>20</span><span class="bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center mx-auto">21</span><span>22</span><span>23</span><span>24</span><span>25</span>
                        </div>
                    </div>
                }

                <!-- 13. CLOCK -->
                @if(currentApp() === 'CLOCK') {
                    <div class="flex-1 bg-black text-white p-4 pt-12">
                         <div class="flex justify-between items-center mb-6">
                             <button (click)="goHome()" class="text-orange-500 font-bold text-sm">Back</button>
                             <span class="font-bold">World Clock</span>
                             <span class="text-orange-500 text-sm">+</span>
                         </div>
                         <div class="space-y-4">
                             <div class="flex justify-between items-end border-b border-gray-800 pb-2">
                                 <div>
                                     <div class="text-xs text-gray-400">Today, +0HRS</div>
                                     <div class="text-xl">Taipei</div>
                                 </div>
                                 <div class="text-4xl font-light">10:42</div>
                             </div>
                              <div class="flex justify-between items-end border-b border-gray-800 pb-2">
                                 <div>
                                     <div class="text-xs text-gray-400">Today, +1HRS</div>
                                     <div class="text-xl">Tokyo</div>
                                 </div>
                                 <div class="text-4xl font-light">11:42</div>
                             </div>
                              <div class="flex justify-between items-end border-b border-gray-800 pb-2">
                                 <div>
                                     <div class="text-xs text-gray-400">Yesterday, -13HRS</div>
                                     <div class="text-xl">New York</div>
                                 </div>
                                 <div class="text-4xl font-light">21:42</div>
                             </div>
                         </div>
                    </div>
                }

                <!-- 14. NOTES -->
                @if(currentApp() === 'NOTES') {
                    <div class="flex-1 bg-[#1c1c1e] text-white flex flex-col">
                         <div class="h-24 pt-10 px-4 flex items-center gap-2">
                            <button (click)="goHome()" class="text-yellow-500 font-bold text-sm flex items-center"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg> Folders</button>
                        </div>
                        <div class="px-4 pb-2">
                            <h1 class="text-3xl font-bold">Notes</h1>
                        </div>
                        <div class="px-4 space-y-3">
                            <div class="bg-[#2c2c2e] p-3 rounded-xl">
                                <div class="font-bold text-sm">Earthquake Safety</div>
                                <div class="text-xs text-gray-400">1. Drop, Cover, and Hold on...</div>
                            </div>
                             <div class="bg-[#2c2c2e] p-3 rounded-xl">
                                <div class="font-bold text-sm">Emergency Kit</div>
                                <div class="text-xs text-gray-400">Water, Flashlight, Batteries...</div>
                            </div>
                        </div>
                    </div>
                }

                <!-- 15. CALCULATOR -->
                @if(currentApp() === 'CALCULATOR') {
                     <div class="flex-1 bg-black flex flex-col justify-end p-4 pb-8">
                         <button (click)="goHome()" class="self-start text-white mb-auto mt-8 ml-2">Back</button>
                         <div class="text-right text-6xl text-white font-light mb-4">0</div>
                         <div class="grid grid-cols-4 gap-3">
                             <div class="bg-gray-400 h-14 w-14 rounded-full flex items-center justify-center text-black text-xl font-medium">AC</div>
                             <div class="bg-gray-400 h-14 w-14 rounded-full flex items-center justify-center text-black text-xl font-medium">+/-</div>
                             <div class="bg-gray-400 h-14 w-14 rounded-full flex items-center justify-center text-black text-xl font-medium">%</div>
                             <div class="bg-orange-500 h-14 w-14 rounded-full flex items-center justify-center text-white text-xl font-medium">÷</div>
                             <div class="bg-[#333] h-14 w-14 rounded-full flex items-center justify-center text-white text-xl">7</div>
                             <div class="bg-[#333] h-14 w-14 rounded-full flex items-center justify-center text-white text-xl">8</div>
                             <div class="bg-[#333] h-14 w-14 rounded-full flex items-center justify-center text-white text-xl">9</div>
                             <div class="bg-orange-500 h-14 w-14 rounded-full flex items-center justify-center text-white text-xl font-medium">×</div>
                             <div class="bg-[#333] h-14 w-14 rounded-full flex items-center justify-center text-white text-xl">4</div>
                             <div class="bg-[#333] h-14 w-14 rounded-full flex items-center justify-center text-white text-xl">5</div>
                             <div class="bg-[#333] h-14 w-14 rounded-full flex items-center justify-center text-white text-xl">6</div>
                             <div class="bg-orange-500 h-14 w-14 rounded-full flex items-center justify-center text-white text-xl font-medium">-</div>
                             <div class="bg-[#333] h-14 w-14 rounded-full flex items-center justify-center text-white text-xl">1</div>
                             <div class="bg-[#333] h-14 w-14 rounded-full flex items-center justify-center text-white text-xl">2</div>
                             <div class="bg-[#333] h-14 w-14 rounded-full flex items-center justify-center text-white text-xl">3</div>
                             <div class="bg-orange-500 h-14 w-14 rounded-full flex items-center justify-center text-white text-xl font-medium">+</div>
                             <div class="bg-[#333] h-14 col-span-2 rounded-full flex items-center pl-6 text-white text-xl">0</div>
                             <div class="bg-[#333] h-14 w-14 rounded-full flex items-center justify-center text-white text-xl">.</div>
                             <div class="bg-orange-500 h-14 w-14 rounded-full flex items-center justify-center text-white text-xl font-medium">=</div>
                         </div>
                     </div>
                }

                <!-- 16. BROWSER -->
                @if(currentApp() === 'BROWSER') {
                     <div class="flex-1 bg-white flex flex-col">
                         <div class="h-24 bg-gray-100 pt-10 px-4 flex items-center justify-between border-b border-gray-300">
                             <button (click)="goHome()" class="text-blue-500 text-sm">Done</button>
                             <div class="bg-gray-200 rounded-lg flex-1 mx-4 h-8 flex items-center justify-center text-xs text-gray-500">
                                 <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mr-1"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                                 google.com
                             </div>
                             <button class="text-gray-500"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 4v6h-6"></path><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg></button>
                         </div>
                         <div class="flex-1 flex flex-col items-center justify-center gap-4">
                             <div class="text-4xl font-bold text-gray-500 tracking-tighter">Google</div>
                             <div class="w-64 h-10 border border-gray-300 rounded-full shadow-sm"></div>
                         </div>
                     </div>
                }
          </div>


          <!-- OVERLAY ALERT (Modal PWS) -->
          @if (active() && !isAlertDismissed() && currentApp() !== 'EEW') {
            <div class="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center animate-in zoom-in duration-300">
                <div class="bg-white/90 backdrop-blur-xl w-64 rounded-2xl overflow-hidden shadow-2xl border border-white/20">
                    <div class="p-5 flex flex-col items-center text-center">
                        <div class="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mb-3 animate-bounce">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-red-600"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                        </div>
                        <h3 class="font-bold text-gray-900 text-lg mb-1">國家級警報</h3>
                        <p class="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-3">Presidential Alert</p>
                        <p class="text-sm font-semibold text-gray-800 leading-snug text-left mb-2">
                            [地震速報] {{time()}} 左右 {{location()}} 發生顯著有感地震，規模 M{{magnitude()}}。
                        </p>
                    </div>
                    <div class="grid grid-cols-2 border-t border-gray-300/50">
                        <button (click)="openApp('EEW')" class="py-3 text-blue-600 font-bold text-sm hover:bg-black/5 active:bg-black/10 border-r border-gray-300/50">
                            View Details
                        </button>
                         <button (click)="dismissAlert()" class="py-3 text-blue-600 font-bold text-sm hover:bg-black/5 active:bg-black/10">
                            Dismiss
                        </button>
                    </div>
                </div>
            </div>
          }

      </div>
      
      <!-- Home Indicator -->
      <div class="absolute bottom-2 left-1/2 -translate-x-1/2 w-32 h-1.5 bg-white rounded-full opacity-50 z-50 cursor-pointer hover:opacity-100 transition-opacity" (click)="goHome()"></div>
    </div>
  `,
  styles: [`
    @keyframes slash {
        0% { transform: translateX(-100%) rotate(45deg); opacity: 0; }
        50% { opacity: 1; }
        100% { transform: translateX(100%) rotate(45deg); opacity: 0; }
    }
    .animate-slash {
        animation: slash 0.6s cubic-bezier(0.22, 1, 0.36, 1) forwards;
    }
    @keyframes pulse-fast {
        0%, 100% { opacity: 1; transform: scale(1); }
        50% { opacity: 0.8; transform: scale(0.95); }
    }
    .animate-pulse-fast {
        animation: pulse-fast 1s infinite;
    }
    @keyframes scan-vertical {
        0% { top: 0%; opacity: 0; }
        10% { opacity: 1; }
        90% { opacity: 1; }
        100% { top: 100%; opacity: 0; }
    }
    .animate-scan-vertical {
        animation: scan-vertical 2s linear infinite;
    }
  `]
})
export class PhoneAlertComponent {
    gemini = inject(GeminiService);

    active = input<boolean>(false);
    location = input<string>('東北海域');
    time = input<string>('');
    magnitude = input<string>('---');
    intensity = input<string>('---');

    currentApp = signal<AppType>('HOME');
    isAlertDismissed = signal(false);
    isPlayingAnimation = signal(false);
    
    // Feature States
    mapsResult = signal<string | null>(null);
    videoResult = signal<string | null>(null);
    isAnalyzingVideo = signal(false);

    constructor() {
        effect(() => {
            if (this.active()) {
                this.isAlertDismissed.set(false);
            }
        });
    }

    openApp(app: AppType) {
        if (app === this.currentApp()) return;
        
        // Play Intro Animation (Red Flash)
        this.isPlayingAnimation.set(true);
        setTimeout(() => {
            this.isPlayingAnimation.set(false);
            this.currentApp.set(app);
        }, 800); // 0.8s duration for animation
    }

    goHome() {
        this.currentApp.set('HOME');
    }

    dismissAlert() {
        this.isAlertDismissed.set(true);
    }

    // --- Feature Logic ---

    async fetchMapsData() {
        this.mapsResult.set('Locating and finding shelters via Google Maps...');
        // Mock coord for demo
        const result = await this.gemini.findNearbyPlaces(25.03, 121.56, 'emergency shelter');
        this.mapsResult.set(result);
    }

    async analyzeSampleVideo() {
        this.isAnalyzingVideo.set(true);
        this.videoResult.set(null);
        
        setTimeout(async () => {
             const dummyBase64 = 'AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAAAIZnJlZQAA...'; // Truncated
             const result = await this.gemini.analyzeVideo(dummyBase64, 'Describe a simulated video of an earthquake shaking a room. Identify key safety hazards.');
             
             this.videoResult.set(result);
             this.isAnalyzingVideo.set(false);
        }, 2000);
    }
}
