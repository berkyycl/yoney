import { GeminiProvider } from "./gemini.js";
import { GroqProvider } from "./groq.js";
import { type AnalysisResult, type ArticleInput, type LLMProvider } from "./provider.js";

/**
 * FallbackLLMProvider:
 * 1. Öncelikli olarak GROQ_API_KEY varsa Groq (Llama 3.3 70B) kullanır (Günde 14.400 istek limiti!).
 * 2. Groq yoksa veya hata verirse GEMINI_API_KEY varsa Gemini'a düşer.
 * 3. Her iki servis de yedekli çalışarak kesintisiz haber analizini garanti eder.
 */
export class FallbackLLMProvider implements LLMProvider {
  private groqProvider?: GroqProvider;
  private geminiProvider?: GeminiProvider;

  constructor() {
    if (process.env.GROQ_API_KEY) {
      this.groqProvider = new GroqProvider();
    }
    if (process.env.GEMINI_API_KEY) {
      this.geminiProvider = new GeminiProvider();
    }
  }

  async analyzeArticle(input: ArticleInput): Promise<AnalysisResult> {
    // 1. Önce Groq dene (Limitleri çok yüksek ve hızlı)
    if (this.groqProvider) {
      try {
        return await this.groqProvider.analyzeArticle(input);
      } catch (err: any) {
        console.warn(`[Groq Warning] Analiz başarısız oldu, Gemini deneniyor: ${err.message || err}`);
      }
    }

    // 2. Groq yoksa veya başarısız olursa Gemini dene
    if (this.geminiProvider) {
      return await this.geminiProvider.analyzeArticle(input);
    }

    // Eğer hiç API key yoksa açıklayıcı hata fırlat
    throw new Error(
      "Hiçbir LLM API anahtarı bulunamadı! Lütfen GROQ_API_KEY veya GEMINI_API_KEY ortam değişkenini tanımlayın."
    );
  }
}
