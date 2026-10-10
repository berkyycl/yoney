import { z } from "zod";

export const benchmarkSchema = z.object({
  model: z.string(),
  benchmark: z.string(),
  skor: z.number(),
  birim: z.string(),
  yuksek_iyi_mi: z.boolean(),
  degerlendirme_ayari: z.string().nullable(),
  kaynak_metinden_alinti: z.string()
});

export const analysisSchema = z.object({
  baslik_tr: z.string().max(90),
  ozet_tr: z.string(),
  kategori: z.enum(["model-cikisi", "guncelleme", "fiyat-limit", "benchmark", "arastirma", "arac-sdk", "politika", "diger"]),
  onem: z.number().int().min(1).max(5),
  onem_gerekce: z.string(),
  etiketler: z.array(z.string()).max(5),
  anilan_modeller: z.array(z.string()),
  yorum_tr: z.string().nullable(),
  benchmarklar: z.array(benchmarkSchema)
});

export type AnalysisResult = z.infer<typeof analysisSchema>;

export interface ArticleInput {
  title: string;
  sourceName: string;
  sourceTier: string;
  url: string;
  text: string;
}

export interface LLMProvider {
  analyzeArticle(input: ArticleInput): Promise<AnalysisResult>;
}
