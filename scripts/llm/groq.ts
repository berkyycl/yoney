import Groq from "groq-sdk";
import { type AnalysisResult, type ArticleInput, type LLMProvider, analysisSchema } from "./provider.js";
import { systemPrompt } from "./prompt.js";

export class GroqProvider implements LLMProvider {
  private client: Groq;
  private model: string;

  constructor(apiKey?: string, model?: string) {
    const key = apiKey || process.env.GROQ_API_KEY || "";
    this.client = new Groq({ apiKey: key });
    this.model = model || process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
  }

  async analyzeArticle(input: ArticleInput): Promise<AnalysisResult> {
    const prompt = `
Aşağıdaki haberi analiz et:
Başlık: ${input.title}
Kaynak: ${input.sourceName} (${input.sourceTier})
URL: ${input.url}

Metin:
${input.text}

JSON ŞEMASI:
{
  "baslik_tr": "string (en fazla 120 karakter)",
  "ozet_tr": "string (güçlü giriş paragrafı)",
  "detayli_icerik_tr": "string (en az 3-4 paragraflık kapsamlı ve akıcı haber metni)",
  "onemli_maddeler": ["string", "string", "string"],
  "kategori": "model-cikisi" | "guncelleme" | "fiyat-limit" | "benchmark" | "arastirma" | "arac-sdk" | "politika" | "diger",
  "onem": 1..5,
  "onem_gerekce": "string",
  "etiketler": ["string", ... en fazla 5 etiket],
  "anilan_modeller": ["string", ...],
  "yorum_tr": "string veya null (sektörel etki analizi)",
  "benchmarklar": [
    {
      "model": "string",
      "benchmark": "string",
      "skor": number,
      "birim": "string",
      "yuksek_iyi_mi": boolean,
      "degerlendirme_ayari": "string veya null",
      "kaynak_metinden_alinti": "string"
    }
  ]
}

Sadece ve sadece yukarıdaki formata uygun geçerli bir JSON çıktısı ver. Markdown codeblock (\`\`\`json ... \`\`\`) veya ekstra metin ekleme.
`;

    const chatCompletion = await this.client.chat.completions.create({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt }
      ],
      model: this.model,
      temperature: 0.2,
      response_format: { type: "json_object" }
    });

    const content = chatCompletion.choices[0]?.message?.content;
    if (!content) {
      throw new Error("Groq API'den boş yanıt geldi.");
    }

    const data = JSON.parse(content);
    return analysisSchema.parse(data);
  }
}
