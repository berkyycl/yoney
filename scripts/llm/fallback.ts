import { GoogleGenAI } from "@google/genai";
import { GroqProvider } from "./groq.js";
import { type AnalysisResult, type ArticleInput, type LLMProvider, analysisSchema } from "./provider.js";
import { systemPrompt } from "./prompt.js";

/**
 * FallbackLLMProvider — Çoklu Key Rotasyonu
 *
 * Sıra:
 * 1. GROQ_API_KEY, GROQ_API_KEY_2, GROQ_API_KEY_3, GROQ_API_KEY_4 — round-robin, biri 429 yerse diğerine geç
 * 2. Tüm Groq keyleri başarısız → GEMINI_API_KEY..GEMINI_API_KEY_10 — round-robin
 * 3. Hepsi başarısız → hata fırlat
 */
export class FallbackLLMProvider implements LLMProvider {
  private groqProviders: GroqProvider[] = [];
  private geminiClients: { ai: GoogleGenAI; model: string; keyLabel: string }[] = [];
  private groqIndex = 0;
  private geminiIndex = 0;

  constructor() {
    // --- Groq keyleri ---
    const groqEnvs = ['GROQ_API_KEY', 'GROQ_API_KEY_2', 'GROQ_API_KEY_3', 'GROQ_API_KEY_4'];
    for (const env of groqEnvs) {
      const key = process.env[env]?.trim();
      if (key) {
        this.groqProviders.push(new GroqProvider(key));
        console.log(`[FallbackLLM] Groq key yüklendi: ${env}`);
      }
    }
    if (this.groqProviders.length === 0) {
      console.warn('[FallbackLLM] Hiç GROQ_API_KEY bulunamadı.');
    }

    // --- Gemini keyleri ---
    const geminiEnvs = [
      'GEMINI_API_KEY', 'GEMINI_API_KEY_2', 'GEMINI_API_KEY_3', 'GEMINI_API_KEY_4',
      'GEMINI_API_KEY_5', 'GEMINI_API_KEY_6', 'GEMINI_API_KEY_7', 'GEMINI_API_KEY_8',
      'GEMINI_API_KEY_9', 'GEMINI_API_KEY_10',
    ];
    // Preferred model per key — first 2 keys support gemini-2.5-flash, rest use gemini-3.8-flash
    const preferredModels: Record<string, string> = {
      'GEMINI_API_KEY':   'gemini-2.5-flash',
      'GEMINI_API_KEY_2': 'gemini-2.5-flash',
    };
    for (const env of geminiEnvs) {
      const key = process.env[env]?.trim();
      if (key) {
        const model = preferredModels[env] || 'gemini-3.8-flash';
        this.geminiClients.push({ ai: new GoogleGenAI({ apiKey: key }), model, keyLabel: env });
        console.log(`[FallbackLLM] Gemini key yüklendi: ${env} (model: ${model})`);
      }
    }
    if (this.geminiClients.length === 0) {
      console.warn('[FallbackLLM] Hiç GEMINI_API_KEY bulunamadı.');
    }
  }

  /** Gemini ile analiz — çoklu key round-robin */
  private async analyzeWithGemini(input: ArticleInput): Promise<AnalysisResult> {
    const startIdx = this.geminiIndex;
    let attempts = 0;

    while (attempts < this.geminiClients.length) {
      const idx = (startIdx + attempts) % this.geminiClients.length;
      const { ai, model, keyLabel } = this.geminiClients[idx];

      try {
        const prompt = `
Aşağıdaki haberi analiz et:
Başlık: ${input.title}
Kaynak: ${input.sourceName} (${input.sourceTier})
URL: ${input.url}

Metin:
${input.text}
`;
        const response = await ai.models.generateContent({
          model,
          contents: prompt,
          config: {
            systemInstruction: systemPrompt,
            responseMimeType: "application/json",
            responseSchema: {
              type: "OBJECT",
              properties: {
                baslik_tr: { type: "STRING" },
                ozet_tr: { type: "STRING" },
                detayli_icerik_tr: { type: "STRING" },
                onemli_maddeler: { type: "ARRAY", items: { type: "STRING" } },
                kategori: { type: "STRING" },
                onem: { type: "INTEGER" },
                onem_gerekce: { type: "STRING" },
                etiketler: { type: "ARRAY", items: { type: "STRING" } },
                anilan_modeller: { type: "ARRAY", items: { type: "STRING" } },
                yorum_tr: { type: "STRING", nullable: true },
                gorseller: { type: "ARRAY", items: { type: "STRING" } },
                benchmarklar: {
                  type: "ARRAY",
                  items: {
                    type: "OBJECT",
                    properties: {
                      model: { type: "STRING" },
                      benchmark: { type: "STRING" },
                      skor: { type: "NUMBER" },
                      birim: { type: "STRING" },
                      yuksek_iyi_mi: { type: "BOOLEAN" },
                      degerlendirme_ayari: { type: "STRING", nullable: true },
                      kaynak_metinden_alinti: { type: "STRING" },
                    },
                    required: ["model", "benchmark", "skor", "birim", "yuksek_iyi_mi", "kaynak_metinden_alinti"],
                  },
                },
              },
              required: ["baslik_tr", "ozet_tr", "detayli_icerik_tr", "onemli_maddeler", "kategori", "onem", "onem_gerekce", "etiketler", "anilan_modeller", "benchmarklar"],
            },
          },
        });

        if (!response.text) throw new Error("Boş yanıt");
        const data = JSON.parse(response.text);
        this.geminiIndex = (idx + 1) % this.geminiClients.length;
        return analysisSchema.parse(data);

      } catch (err: any) {
        const msg: string = err.message || '';
        const isRetryable = msg.includes('503') || msg.includes('429') || msg.includes('overloaded') || msg.includes('high demand');
        console.warn(`[Gemini] ${keyLabel} hata: ${msg.substring(0, 80)}${isRetryable ? ' → sonraki key deneniyor' : ''}`);
        attempts++;
      }
    }

    throw new Error('Tüm Gemini keyleri başarısız oldu.');
  }

  async analyzeArticle(input: ArticleInput): Promise<AnalysisResult> {
    // 1. Groq round-robin
    if (this.groqProviders.length > 0) {
      const startIdx = this.groqIndex;
      let attempts = 0;

      while (attempts < this.groqProviders.length) {
        const idx = (startIdx + attempts) % this.groqProviders.length;
        try {
          const result = await this.groqProviders[idx].analyzeArticle(input);
          this.groqIndex = (idx + 1) % this.groqProviders.length;
          return result;
        } catch (err: any) {
          const isRateLimit = err.message?.includes('429') || err.message?.includes('rate_limit');
          const label = idx === 0 ? 'GROQ_API_KEY' : `GROQ_API_KEY_${idx + 1}`;
          console.warn(`[Groq] ${label} ${isRateLimit ? 'rate limit' : 'hata'}: ${err.message?.substring(0, 60)}`);
          attempts++;
        }
      }
      console.log('[FallbackLLM] Tüm Groq keyleri başarısız → Gemini deneniyor...');
    }

    // 2. Gemini round-robin
    if (this.geminiClients.length > 0) {
      return await this.analyzeWithGemini(input);
    }

    throw new Error(
      'Hiçbir LLM API anahtarı bulunamadı! GROQ_API_KEY veya GEMINI_API_KEY tanımlayın.'
    );
  }
}
