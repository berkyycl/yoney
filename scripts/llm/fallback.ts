import { GoogleGenAI } from "@google/genai";
import { GroqProvider } from "./groq.js";
import { type AnalysisResult, type ArticleInput, type LLMProvider, analysisSchema } from "./provider.js";
import { systemPrompt } from "./prompt.js";

/**
 * FallbackLLMProvider — Çoklu Key Rotasyonu + Gemini Batch Modu
 *
 * Sıra:
 * 1. Groq (GROQ_API_KEY … _4) — round-robin, 429 yerse diğerine geç
 * 2. Tüm Groq keyleri başarısız → Gemini BATCH modu
 *    - Gemini'nin düşük RPM/günlük limitini aşmamak için makaleleri
 *      biriktirip tek seferde toplu analiz eder.
 *    - 1 Gemini isteğinde 5 makale → 100 makale için yalnızca 20 istek
 *    - İstekler arası 5 sn bekleme (15 RPM limitinin altında kalır)
 *
 * GEMINI BATCH SCHEMA: Tek promptta tüm makaleler verilir,
 * Gemini "articles" anahtarı altında dizi döner.
 */

// ── Gemini için tek makale şeması ──────────────────────────────────────────
const ARTICLE_SCHEMA_PROPS = {
  baslik_tr:         { type: "STRING" },
  ozet_tr:           { type: "STRING" },
  detayli_icerik_tr: { type: "STRING" },
  onemli_maddeler:   { type: "ARRAY",  items: { type: "STRING" } },
  kategori:          { type: "STRING" },
  onem:              { type: "INTEGER" },
  onem_gerekce:      { type: "STRING" },
  etiketler:         { type: "ARRAY",  items: { type: "STRING" } },
  anilan_modeller:   { type: "ARRAY",  items: { type: "STRING" } },
  yorum_tr:          { type: "STRING", nullable: true },
  gorseller:         { type: "ARRAY",  items: { type: "STRING" } },
  benchmarklar: {
    type: "ARRAY",
    items: {
      type: "OBJECT",
      properties: {
        model:                  { type: "STRING" },
        benchmark:              { type: "STRING" },
        skor:                   { type: "NUMBER" },
        birim:                  { type: "STRING" },
        yuksek_iyi_mi:          { type: "BOOLEAN" },
        degerlendirme_ayari:    { type: "STRING", nullable: true },
        kaynak_metinden_alinti: { type: "STRING" },
      },
      required: ["model", "benchmark", "skor", "birim", "yuksek_iyi_mi", "kaynak_metinden_alinti"],
    },
  },
};
const ARTICLE_REQUIRED = [
  "baslik_tr", "ozet_tr", "detayli_icerik_tr", "onemli_maddeler",
  "kategori", "onem", "onem_gerekce", "etiketler", "anilan_modeller", "benchmarklar",
];

// Batch response şeması
const BATCH_SCHEMA = {
  type: "OBJECT",
  properties: {
    articles: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: ARTICLE_SCHEMA_PROPS,
        required: ARTICLE_REQUIRED,
      },
    },
  },
  required: ["articles"],
};

const GEMINI_BATCH_SIZE = 5;   // Tek istekte kaç makale
const GEMINI_DELAY_MS  = 5000; // İstekler arası bekleme (ms) — 12 RPM = 15 limitin altı

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

// ─── Batch kuyruğu ────────────────────────────────────────────────────────
interface QueueItem {
  input: ArticleInput;
  resolve: (r: AnalysisResult) => void;
  reject:  (e: Error) => void;
}

export class FallbackLLMProvider implements LLMProvider {
  private groqProviders: GroqProvider[] = [];
  private geminiClients: { ai: GoogleGenAI; model: string; keyLabel: string }[] = [];
  private groqIndex    = 0;
  private geminiIndex  = 0;

  // Gemini batch kuyruğu
  private geminiQueue: QueueItem[] = [];
  private geminiFlushTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly FLUSH_WAIT_MS = 3000; // Yeni makale gelmezse bu kadar bekleyip flush et

  constructor() {
    // ── Groq keyleri ──────────────────────────────────────────────────────
    const groqEnvs = ['GROQ_API_KEY', 'GROQ_API_KEY_2', 'GROQ_API_KEY_3', 'GROQ_API_KEY_4'];
    for (const env of groqEnvs) {
      const key = process.env[env]?.trim();
      if (key) {
        this.groqProviders.push(new GroqProvider(key));
        console.log(`[FallbackLLM] Groq key yüklendi: ${env}`);
      }
    }
    if (this.groqProviders.length === 0) console.warn('[FallbackLLM] Hiç GROQ_API_KEY bulunamadı.');

    // ── Gemini keyleri ────────────────────────────────────────────────────
    const geminiEnvs = [
      'GEMINI_API_KEY',   'GEMINI_API_KEY_2',  'GEMINI_API_KEY_3',  'GEMINI_API_KEY_4',
      'GEMINI_API_KEY_5', 'GEMINI_API_KEY_6',  'GEMINI_API_KEY_7',  'GEMINI_API_KEY_8',
      'GEMINI_API_KEY_9', 'GEMINI_API_KEY_10',
    ];
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
    if (this.geminiClients.length === 0) console.warn('[FallbackLLM] Hiç GEMINI_API_KEY bulunamadı.');
  }

  // ── Gemini BATCH analiz ────────────────────────────────────────────────
  /**
   * Birden fazla makaleyi tek Gemini isteğiyle analiz eder.
   * RPM'i korumak için çağrılar arasına GEMINI_DELAY_MS ekler.
   */
  private async geminiBatchAnalyze(items: QueueItem[]): Promise<void> {
    const inputs = items.map(i => i.input);

    // Prompt: her makaleyi numaralı blok halinde sun
    const articlesBlock = inputs.map((inp, idx) => `
--- MAKALE ${idx + 1} ---
Başlık: ${inp.title}
Kaynak: ${inp.sourceName} (${inp.sourceTier})
URL:    ${inp.url}

İçerik (ilk 8000 karakter):
${inp.text.substring(0, 8000)}
`.trim()).join('\n\n');

    const prompt = `Aşağıdaki ${inputs.length} AI haber makalesini analiz et.
Her makale için "articles" dizisinde bir eleman oluştur. Dizi sırası makale sırasıyla AYNI olmalı.

${articlesBlock}

ÖNEMLI: Tam olarak ${inputs.length} eleman içeren "articles" dizisi döndür.`;

    const startIdx = this.geminiIndex;
    let attempts   = 0;

    while (attempts < this.geminiClients.length) {
      const idx = (startIdx + attempts) % this.geminiClients.length;
      const { ai, model, keyLabel } = this.geminiClients[idx];

      try {
        console.log(`[Gemini Batch] ${keyLabel} → ${inputs.length} makale tek istekte analiz ediliyor...`);

        const response = await ai.models.generateContent({
          model,
          contents: prompt,
          config: {
            systemInstruction: systemPrompt,
            responseMimeType: "application/json",
            responseSchema: BATCH_SCHEMA,
          },
        });

        if (!response.text) throw new Error("Boş yanıt");
        const data = JSON.parse(response.text);
        const results: any[] = data.articles || [];

        if (results.length !== inputs.length) {
          throw new Error(`Beklenen ${inputs.length} sonuç, gelen ${results.length}`);
        }

        // Sonuçları tek tek normalize edip resolve et
        results.forEach((r, i) => {
          try {
            // Güvenlik normalizasyonu: Gemini şema dışı kategori veya fazla etiket verebilir
            const validCategories = ["model-cikisi", "guncelleme", "fiyat-limit", "benchmark", "arastirma", "arac-sdk", "politika", "diger"];
            if (!validCategories.includes(r.kategori)) {
              r.kategori = "diger";
            }
            if (Array.isArray(r.etiketler) && r.etiketler.length > 5) {
              r.etiketler = r.etiketler.slice(0, 5);
            }
            if (typeof r.baslik_tr === 'string' && r.baslik_tr.length > 120) {
              r.baslik_tr = r.baslik_tr.substring(0, 120);
            }
            if (typeof r.onem !== 'number' || r.onem < 1 || r.onem > 5) {
              r.onem = 3;
            }
            if (!Array.isArray(r.onemli_maddeler)) r.onemli_maddeler = [];
            if (!Array.isArray(r.anilan_modeller)) r.anilan_modeller = [];
            if (!Array.isArray(r.gorseller)) r.gorseller = [];
            if (!Array.isArray(r.benchmarklar)) r.benchmarklar = [];

            items[i].resolve(analysisSchema.parse(r));
          } catch (parseErr: any) {
            console.warn(`[Gemini Parse Warning] ${parseErr.message} — ham sonuç ile kurtarılıyor`);
            try {
              // Minimal fallback
              items[i].resolve({
                baslik_tr: (r.baslik_tr || items[i].input.title || '').substring(0, 120),
                ozet_tr: r.ozet_tr || items[i].input.title || '',
                detayli_icerik_tr: r.detayli_icerik_tr || r.ozet_tr || '',
                onemli_maddeler: Array.isArray(r.onemli_maddeler) ? r.onemli_maddeler : [],
                kategori: "diger",
                onem: 3,
                onem_gerekce: r.onem_gerekce || "Otomatik analiz",
                etiketler: Array.isArray(r.etiketler) ? r.etiketler.slice(0, 5) : ["yapay-zeka"],
                anilan_modeller: Array.isArray(r.anilan_modeller) ? r.anilan_modeller : [],
                yorum_tr: null,
                gorseller: [],
                benchmarklar: []
              });
            } catch (fallbackErr: any) {
              items[i].reject(new Error(`Parse hatası: ${parseErr.message}`));
            }
          }
        });

        this.geminiIndex = (idx + 1) % this.geminiClients.length;
        console.log(`[Gemini Batch] ${inputs.length} makale başarıyla işlendi.`);

        // RPM koruması: istekler arası bekleme
        await delay(GEMINI_DELAY_MS);
        return;

      } catch (err: any) {
        const msg: string = err.message || '';
        const isRetryable = msg.includes('503') || msg.includes('429') || msg.includes('overloaded');
        console.warn(`[Gemini] ${keyLabel} hata: ${msg.substring(0, 100)}${isRetryable ? ' → sonraki key' : ''}`);
        if (isRetryable) await delay(2000);
        attempts++;
      }
    }

    // Tüm Gemini keyleri başarısız → tüm kuyruğu reddet
    const err = new Error('Tüm Gemini keyleri başarısız.');
    items.forEach(i => i.reject(err));
  }

  /**
   * Kuyruğu GEMINI_BATCH_SIZE'lık gruplar halinde işle.
   */
  private async flushGeminiQueue(): Promise<void> {
    if (this.geminiFlushTimer) {
      clearTimeout(this.geminiFlushTimer);
      this.geminiFlushTimer = null;
    }

    while (this.geminiQueue.length > 0) {
      const batch = this.geminiQueue.splice(0, GEMINI_BATCH_SIZE);
      await this.geminiBatchAnalyze(batch);
    }
  }

  /**
   * Makaleyi Gemini kuyruğuna ekle.
   * FLUSH_WAIT_MS içinde yeni makale gelmezse kuyruğu otomatik gönder.
   * GEMINI_BATCH_SIZE dolunca hemen gönder.
   */
  private enqueueGemini(input: ArticleInput): Promise<AnalysisResult> {
    return new Promise<AnalysisResult>((resolve, reject) => {
      this.geminiQueue.push({ input, resolve, reject });

      // Batch doldu mu? Hemen gönder
      if (this.geminiQueue.length >= GEMINI_BATCH_SIZE) {
        this.flushGeminiQueue();
        return;
      }

      // Dolmadıysa FLUSH_WAIT_MS sonra gönder (son makale beklemesi)
      if (this.geminiFlushTimer) clearTimeout(this.geminiFlushTimer);
      this.geminiFlushTimer = setTimeout(() => {
        this.flushGeminiQueue();
      }, this.FLUSH_WAIT_MS);
    });
  }

  // ── Ana analiz metodu ──────────────────────────────────────────────────
  async analyzeArticle(input: ArticleInput): Promise<AnalysisResult> {
    // 1. Groq round-robin
    if (this.groqProviders.length > 0) {
      const startIdx = this.groqIndex;
      let attempts   = 0;

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
      console.log('[FallbackLLM] Tüm Groq keyleri başarısız → Gemini batch kuyruğuna ekleniyor...');
    }

    // 2. Gemini batch kuyruğu
    if (this.geminiClients.length > 0) {
      return await this.enqueueGemini(input);
    }

    throw new Error('Hiçbir LLM API anahtarı bulunamadı! GROQ_API_KEY veya GEMINI_API_KEY tanımlayın.');
  }
}
