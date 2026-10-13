/** Haber kategorileri (LLM'in döndürdüğü kimlik -> Türkçe etiket) */
export const NEWS_CATEGORIES: { id: string; name: string }[] = [
  { id: 'model-cikisi', name: 'Model Çıkışı' },
  { id: 'guncelleme', name: 'Güncelleme' },
  { id: 'benchmark', name: 'Benchmark' },
  { id: 'arastirma', name: 'Araştırma' },
  { id: 'fiyat-limit', name: 'Fiyat & Limit' },
  { id: 'arac-sdk', name: 'Araç & SDK' },
  { id: 'politika', name: 'Politika & Regülasyon' },
  { id: 'diger', name: 'Diğer' },
];

export function newsCategoryName(id: string | undefined | null): string {
  return NEWS_CATEGORIES.find(c => c.id === id)?.name ?? 'Diğer';
}

export function tierName(tier: string | undefined | null): string {
  if (tier === 'resmi') return 'Resmi Kaynak';
  if (tier === 'bagimsiz') return 'Bağımsız Basın';
  return 'Topluluk';
}
