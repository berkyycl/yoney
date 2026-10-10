import { GeminiProvider } from "./gemini.js";
import { GroqProvider } from "./groq.js";
import { type AnalysisResult, type ArticleInput, type LLMProvider } from "./provider.js";

/**
 * FallbackLLMProvider:
 * 1. Birden fazla GROQ key destekler: GROQ_API_KEY, GROQ_API_KEY_2, GROQ_API_KEY_3, GROQ_API_KEY_4
 *    Bir key rate limit yediğinde otomatik olarak diğerine geçer (round-robin + hata toleransı).
 * 2. Tüm Groq keyleri başarısız olursa GEMINI_API_KEY ile Gemini'a düşer.
 * 3. Hiç key yoksa açıklayıcı hata fırlatır.
 */
export class FallbackLLMProvider implements LLMProvider {
  private groqProviders: GroqProvider[] = [];
  private geminiProvider?: GeminiProvider;
  private groqIndex = 0; // round-robin cursor

  constructor() {
    // Tüm GROQ keylerini sırayla topla
    const groqKeyEnvs = [
      'GROQ_API_KEY',
      'GROQ_API_KEY_2',
      'GROQ_API_KEY_3',
      'GROQ_API_KEY_4',
    ];

    for (const envName of groqKeyEnvs) {
      const key = process.env[envName];
      if (key && key.trim()) {
        this.groqProviders.push(new GroqProvider(key.trim()));
        console.log(`[FallbackLLM] Groq key yüklendi: ${envName}`);
      }
    }

    if (this.groqProviders.length === 0) {
      console.warn('[FallbackLLM] Hiç GROQ_API_KEY bulunamadı.');
    }

    if (process.env.GEMINI_API_KEY) {
      this.geminiProvider = new GeminiProvider();
      console.log('[FallbackLLM] Gemini key yüklendi: GEMINI_API_KEY');
    }
  }

  async analyzeArticle(input: ArticleInput): Promise<AnalysisResult> {
    // Groq key'leri round-robin + her key için fallback dene
    if (this.groqProviders.length > 0) {
      const startIdx = this.groqIndex;
      let attempts = 0;

      while (attempts < this.groqProviders.length) {
        const idx = (startIdx + attempts) % this.groqProviders.length;
        const groqProvider = this.groqProviders[idx];

        try {
          const result = await groqProvider.analyzeArticle(input);
          // Başarılı — bir sonraki çağrı için cursor'u ilerlet (yük dağıtımı)
          this.groqIndex = (idx + 1) % this.groqProviders.length;
          return result;
        } catch (err: any) {
          const isRateLimit = err.message?.includes('429') || err.message?.includes('rate_limit') || err.message?.includes('Rate limit');
          const keyLabel = `GROQ_API_KEY${idx === 0 ? '' : `_${idx + 1}`}`;

          if (isRateLimit) {
            console.warn(`[Groq] ${keyLabel} rate limit yedi, ${attempts + 1 < this.groqProviders.length ? 'sonraki key deneniyor' : 'Gemini\'a geçiliyor'}...`);
          } else {
            console.warn(`[Groq] ${keyLabel} hata: ${err.message}`);
          }
          attempts++;
        }
      }
    }

    // Tüm Groq keyleri başarısız → Gemini
    if (this.geminiProvider) {
      console.log('[FallbackLLM] Gemini ile devam ediliyor...');
      return await this.geminiProvider.analyzeArticle(input);
    }

    throw new Error(
      "Hiçbir LLM API anahtarı bulunamadı! Lütfen GROQ_API_KEY veya GEMINI_API_KEY ortam değişkenini tanımlayın."
    );
  }
}
