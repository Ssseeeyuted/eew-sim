import { Injectable } from '@angular/core';
import { GoogleGenAI } from '@google/genai';

@Injectable({
  providedIn: 'root'
})
export class GeminiService {
  private ai: GoogleGenAI;

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: process.env['API_KEY'] });
  }

  async getRecentQuakes(): Promise<any[]> {
    try {
      const response = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: '找出台灣及日本周邊地區（含琉球、菲律賓海域）過去3年內最重要的5次顯著地震。只返回一個 JSON 陣列，包含物件：{ "name": string, "magnitude": number, "depth": number, "lat": number, "lng": number, "date": string }。請確保地震名稱是繁體中文。',
        config: {
          tools: [{ googleSearch: {} }]
        }
      });
      
      const text = response.text || '';
      const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
      return JSON.parse(jsonStr);
    } catch (e) {
      console.error('Gemini Search Error', e);
      return [];
    }
  }

  async analyzeSimulation(magnitude: number, depth: number, location: {lat: number, lng: number}, maxMMI: number): Promise<string> {
    try {
      const response = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `分析一場在台灣-日本島弧區域發生的模擬地震：
        規模 (Magnitude): ${magnitude}
        深度: ${depth}km
        位置: ${location.lat}, ${location.lng}
        最大震度 (MMI): ${maxMMI}

        請用繁體中文，以專業地震學家的語氣，提供3點關於對基礎設施（特別是高鐵/新幹線）、海嘯風險和跨國人口影響的簡潔評估。`,
      });
      return response.text || '無法取得分析數據。';
    } catch (e) {
      console.error('Gemini Analysis Error', e);
      return 'AI 分析因網絡問題暫時無法使用。';
    }
  }

  // Thinking Mode for complex multi-event scenarios
  // Requirement: gemini-3-pro-preview + thinkingBudget 32768
  async analyzeComplexScenario(events: any[]): Promise<string> {
    try {
      const eventDesc = events.map((e, i) => `事件${i+1}: 規模${e.magnitude}, 深度${e.depth}km, 位置(${e.lat.toFixed(2)}, ${e.lng.toFixed(2)})`).join('\n');
      
      const response = await this.ai.models.generateContent({
        model: 'gemini-3-pro-preview', 
        contents: `深度思考模式啟動。
        
        目前發生了跨區域複合式地震災害 (Multi-Event Earthquake Scenario - Taiwan/Japan Region)。
        請分析以下連鎖地震事件的綜合影響：
        ${eventDesc}

        請考慮：
        1. 應力觸發效應 (Stress Triggering) 在板塊邊界的作用
        2. 複合波前疊加造成的極端震度區域
        3. 對跨國海纜、核電廠及高速鐵路系統（THSR/Shinkansen）的系統性風險
        4. 海嘯連鎖反應的可能性

        請提供一份詳細的災害評估報告（繁體中文）。`,
        config: {
            thinkingConfig: {
                thinkingBudget: 32768
            }
        }
      });
      return response.text || 'AI 思考中斷。';
    } catch (e) {
      console.error('Gemini Thinking Error', e);
      return '高階思考模型暫時無法連接。';
    }
  }

  // Image Analysis for Disaster Photos
  async analyzeImage(base64Image: string): Promise<string> {
      try {
          const response = await this.ai.models.generateContent({
              model: 'gemini-3-pro-preview',
              contents: [
                  {
                      role: 'user',
                      parts: [
                          { inlineData: { data: base64Image, mimeType: 'image/jpeg' } },
                          { text: '這是一張災情照片。請分析照片中的損害情況（建築、道路、基礎設施），評估危險等級，並給出即時的安全建議。請用繁體中文回答。' }
                      ]
                  }
              ],
              config: {
                  thinkingConfig: {
                      thinkingBudget: 16000 
                  }
              }
          });
          return response.text || '無法辨識圖片內容。';
      } catch (e) {
          console.error('Gemini Image Analysis Error', e);
          return '圖片分析服務暫時無法使用。';
      }
  }

  // Maps Grounding
  async findNearbyPlaces(lat: number, lng: number, type: string = 'hospital'): Promise<string> {
      try {
          const response = await this.ai.models.generateContent({
              model: 'gemini-2.5-flash',
              contents: `Find ${type}s near latitude ${lat}, longitude ${lng} in Taiwan/Japan region. List the top 3 results with their names and estimated distance.`,
              config: {
                  tools: [{ googleMaps: {} }]
              }
          });
          
          // Google Maps tool returns groundingMetadata
          const grounding = response.candidates?.[0]?.groundingMetadata;
          if (grounding && grounding.groundingChunks) {
              return response.text || '已找到相關地點數據。';
          }
          return response.text || '未找到附近地點。';
      } catch (e) {
          console.error('Gemini Maps Error', e);
          return '地圖服務暫時無法使用。';
      }
  }
}