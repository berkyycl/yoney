import { GoogleGenAI } from "@google/genai";
import { type AnalysisResult, type ArticleInput, type LLMProvider, analysisSchema } from "./provider.js";
import { systemPrompt } from "./prompt.js";

// Make sure to configure API key in environment
const ai = new GoogleGenAI({});

export class GeminiProvider implements LLMProvider {
  async analyzeArticle(input: ArticleInput): Promise<AnalysisResult> {
    const model = process.env.GEMINI_MODEL || "gemini-1.5-flash";
    const prompt = `
Aşağıdaki haberi analiz et:
Başlık: ${input.title}
Kaynak: ${input.sourceName} (${input.sourceTier})
URL: ${input.url}

Metin:
${input.text}
`;

    // Note: In @google/genai, we use gemini API like this:
    const response = await ai.models.generateContent({
        model: model,
        contents: prompt,
        config: {
            systemInstruction: systemPrompt,
            responseMimeType: "application/json",
            // Need to pass zod schema in JSON schema format for Gemini. 
            // We use simple mapping or raw JSON schema for @google/genai
            // Since we need to use responseSchema, we can provide it as an object
            responseSchema: {
                type: "OBJECT",
                properties: {
                    baslik_tr: { type: "STRING" },
                    ozet_tr: { type: "STRING" },
                    kategori: { type: "STRING" },
                    onem: { type: "INTEGER" },
                    onem_gerekce: { type: "STRING" },
                    etiketler: { type: "ARRAY", items: { type: "STRING" } },
                    anilan_modeller: { type: "ARRAY", items: { type: "STRING" } },
                    yorum_tr: { type: "STRING", nullable: true },
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
                                kaynak_metinden_alinti: { type: "STRING" }
                            },
                            required: ["model", "benchmark", "skor", "birim", "yuksek_iyi_mi", "kaynak_metinden_alinti"]
                        }
                    }
                },
                required: ["baslik_tr", "ozet_tr", "kategori", "onem", "onem_gerekce", "etiketler", "anilan_modeller", "benchmarklar"]
            }
        }
    });

    if (!response.text) {
        throw new Error("Boş yanıt geldi");
    }

    const data = JSON.parse(response.text);
    return analysisSchema.parse(data);
  }
}
