/**
 * Haber kategorileri (LLM'in döndürdüğü kimlik -> sitedeki "bölüm").
 * Her bölümün kendi numarası, sloganı ve amblemi vardır; renkleri
 * src/styles/global.css içindeki [data-cat] kurallarındadır.
 */
export interface NewsCategory {
  id: string;
  name: string;
  numeral: string;
  tagline: string;
  desc: string;
  /** 24x24 çizgi ikonu (SVG path) */
  emblem: string;
}

export const NEWS_CATEGORIES: NewsCategory[] = [
  {
    id: 'model-cikisi',
    name: 'Model Çıkışı',
    numeral: 'I',
    tagline: 'Sahneye yeni bir model çıktı',
    desc: 'Yeni yapay zekâ modellerinin duyuruları ve yayınları: kim ne çıkardı, neler vadediyor?',
    emblem: 'M12 2.5l2.3 6.2 6.2 2.3-6.2 2.3L12 19.5l-2.3-6.2L3.5 11l6.2-2.3z M19 17l.8 2.2L22 20l-2.2.8L19 23l-.8-2.2L16 20l2.2-.8z',
  },
  {
    id: 'guncelleme',
    name: 'Güncelleme',
    numeral: 'II',
    tagline: 'Bildiğin model, yeni hüner',
    desc: 'Mevcut modellere ve ürünlere gelen yeni özellikler, sürümler ve iyileştirmeler.',
    emblem: 'M20 11A8 8 0 0 0 5.7 6.1L4 8 M4 3.5V8h4.5 M4 13a8 8 0 0 0 14.3 4.9L20 16 M20 20.5V16h-4.5',
  },
  {
    id: 'benchmark',
    name: 'Benchmark',
    numeral: 'III',
    tagline: 'Skorlar konuşur',
    desc: 'Test sonuçları, liderlik tabloları ve modellerin karşılaştırmalı performansı.',
    emblem: 'M3 21h18 M5 21v-7h4v7 M10 21V4h4v17 M15 21v-10h4v10',
  },
  {
    id: 'arastirma',
    name: 'Araştırma',
    numeral: 'IV',
    tagline: 'Laboratuvardan taze bulgular',
    desc: 'Akademik makaleler, teknik raporlar ve bilimsel bulgular.',
    emblem: 'M9 3h6 M10 3v6.5L4.6 18.6A1.6 1.6 0 0 0 6 21h12a1.6 1.6 0 0 0 1.4-2.4L14 9.5V3 M7.2 15h9.6',
  },
  {
    id: 'fiyat-limit',
    name: 'Fiyat & Limit',
    numeral: 'V',
    tagline: 'Kim ne kadar, ne kadarına?',
    desc: 'Fiyat, kota, kullanım limiti ve abonelik değişiklikleri.',
    emblem: 'M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z M7.5 7.5h.01',
  },
  {
    id: 'arac-sdk',
    name: 'Araç & SDK',
    numeral: 'VI',
    tagline: 'Geliştiricinin alet çantası',
    desc: "API'ler, SDK'lar, kütüphaneler ve açık kaynak projeler.",
    emblem: 'M8 6l-6 6 6 6 M16 6l6 6-6 6 M14 3.5l-4 17',
  },
  {
    id: 'politika',
    name: 'Politika & Regülasyon',
    numeral: 'VII',
    tagline: 'Kurallar, kararlar, tartışmalar',
    desc: 'Regülasyon, hukuk, güvenlik politikaları ve yapay zekânın toplumsal etkisi.',
    emblem: 'M12 3v18 M6 21h12 M5 7h14 M5 7l-3 7a3 3 0 0 0 6 0z M19 7l-3 7a3 3 0 0 0 6 0z',
  },
  {
    id: 'diger',
    name: 'Diğer',
    numeral: 'VIII',
    tagline: 'Gündemin tuhaf köşeleri',
    desc: 'Hiçbir kalıba sığmayan ama kaçırılmaması gereken gelişmeler.',
    emblem: 'M12 12a1 1 0 1 1-1-1 3 3 0 1 1-2 4.2A5 5 0 1 1 17 12a7 7 0 1 1-12.8-3.9',
  },
];

export function getCategory(id: string | undefined | null): NewsCategory {
  return NEWS_CATEGORIES.find(c => c.id === id) ?? NEWS_CATEGORIES[NEWS_CATEGORIES.length - 1];
}

/** Haberin kategori kimliği; bilinmeyenler "diger" sayılır */
export function categoryOf(article: any): string {
  return getCategory(article?.kategori).id;
}

export function newsCategoryName(id: string | undefined | null): string {
  return getCategory(id).name;
}

export function tierName(tier: string | undefined | null): string {
  if (tier === 'resmi') return 'Resmi Kaynak';
  if (tier === 'bagimsiz') return 'Bağımsız Basın';
  return 'Topluluk';
}
