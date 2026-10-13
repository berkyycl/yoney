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

export const KATEGORILER = ["model-cikisi", "guncelleme", "fiyat-limit", "benchmark", "arastirma", "arac-sdk", "politika", "diger"] as const;

/**
 * LLM'ler kategoriyi bazen "Model Çıkışı", "model_cikisi" ya da "Güncelleme" gibi
 * döndürüyor; eskiden bunların hepsi "diger"e düşüyordu. Kimliğe çevirir.
 */
export function normalizeKategori(raw: unknown): (typeof KATEGORILER)[number] {
  const s = String(raw ?? '')
    .toLocaleLowerCase('tr-TR')
    .replace(/ç/g, 'c').replace(/ğ/g, 'g').replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ş/g, 's').replace(/ü/g, 'u')
    .replace(/&/g, ' ').replace(/[\s_/]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  if ((KATEGORILER as readonly string[]).includes(s)) return s as any;
  if (/model.*(cikis|lansman|release|launch)|yeni-model|model-release/.test(s)) return 'model-cikisi';
  if (/guncelle|update|surum/.test(s)) return 'guncelleme';
  if (/fiyat|limit|pricing|price|kota/.test(s)) return 'fiyat-limit';
  if (/benchmark|test|leaderboard|degerlendirme/.test(s)) return 'benchmark';
  if (/arastirma|research|makale|paper/.test(s)) return 'arastirma';
  if (/arac|sdk|api|tool|kutuphane|library/.test(s)) return 'arac-sdk';
  if (/politika|regulasyon|regulation|policy|hukuk|guvenlik/.test(s)) return 'politika';
  return 'diger';
}

export const analysisSchema = z.object({
  baslik_tr: z.string().max(120),
  ozet_tr: z.string(),
  detayli_icerik_tr: z.string().optional(),
  onemli_maddeler: z.array(z.string()).default([]),
  kategori: z.preprocess(normalizeKategori, z.enum(KATEGORILER)),
  onem: z.number().int().min(1).max(5),
  onem_gerekce: z.string(),
  etiketler: z.array(z.string()).max(5),
  anilan_modeller: z.array(z.string()),
  yorum_tr: z.string().nullable(),
  gorseller: z.array(z.string()).default([]),
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
