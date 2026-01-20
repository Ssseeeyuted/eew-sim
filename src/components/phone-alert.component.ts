import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-phone-alert',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="relative w-72 h-[500px] bg-black rounded-[2.5rem] border-4 border-gray-800 shadow-2xl overflow-hidden font-sans select-none transform transition-transform duration-500 hover:scale-105">
      <!-- Dynamic Island / Notch -->
      <div class="absolute top-0 left-1/2 -translate-x-1/2 w-28 h-7 bg-black rounded-b-3xl z-50 flex justify-center items-center">
        <div class="w-16 h-4 bg-gray-900 rounded-full flex items-center gap-2 px-2">
            <div class="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
            <div class="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
        </div>
      </div>
      
      <!-- Screen Content -->
      <div class="w-full h-full bg-gray-100 flex flex-col pt-10 relative">
          
          <!-- Status Bar -->
          <div class="absolute top-2 left-6 text-[10px] font-bold text-black">14:03</div>
          <div class="absolute top-2 right-6 text-[10px] font-bold text-black flex gap-1">
             <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.55a11 11 0 0 1 14.08 0"></path><path d="M1.42 9a16 16 0 0 1 19.16 0"></path><path d="M8.53 16.11a6 6 0 0 1 6.95 0"></path><line x1="12" y1="20" x2="12.01" y2="20"></line></svg>
             <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 6l-9.5 9.5-5-5L1 18"></path><path d="M17 6h6v6"></path></svg>
          </div>

          <!-- Alert Modal -->
          @if (active()) {
            <div class="absolute inset-0 z-40 bg-black/60 backdrop-blur-sm flex items-center justify-center animate-in zoom-in duration-300">
                <div class="bg-white w-60 rounded-xl overflow-hidden shadow-2xl">
                    <div class="bg-white p-4 border-b border-gray-100 flex flex-col items-center">
                        <div class="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center mb-2">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-red-600"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                        </div>
                        <h3 class="font-bold text-gray-900 text-base">國家級警報</h3>
                        <p class="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Presidential Alert</p>
                    </div>
                    
                    <div class="p-4 bg-white text-center">
                        <p class="text-sm font-bold text-gray-800 leading-relaxed text-left mb-2">
                            [地震速報] {{time()}} 左右 {{location()}} 發生顯著有感地震，慎防強烈搖晃，就近避難「趴下、掩護、穩住」。
                        </p>
                        <p class="text-[10px] text-gray-500 text-left">
                            Earthquake Alert. Seek cover immediately.
                            <br>Central Weather Administration
                        </p>
                    </div>

                    <div class="border-t border-gray-200">
                        <button class="w-full py-3 text-blue-600 font-bold text-sm hover:bg-gray-50 active:bg-gray-100 transition-colors">
                            確認 (OK)
                        </button>
                    </div>
                </div>
            </div>
          } @else {
              <!-- Idle Screen -->
              <div class="flex-1 flex flex-col items-center justify-center p-6 text-gray-400">
                  <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" class="mb-2"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect><line x1="12" y1="18" x2="12.01" y2="18"></line></svg>
                  <span class="text-xs">Waiting for PWS...</span>
              </div>
          }
      </div>
      
      <!-- Home Indicator -->
      <div class="absolute bottom-2 left-1/2 -translate-x-1/2 w-32 h-1 bg-white rounded-full opacity-50"></div>
    </div>
  `
})
export class PhoneAlertComponent {
    active = input<boolean>(false);
    location = input<string>('東北海域');
    time = input<string>('');
}