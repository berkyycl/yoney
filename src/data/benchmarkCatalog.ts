/**
 * Benchmark kataloğu.
 *
 * - "live" kaynaklı testler scripts/fetch-benchmarks.ts tarafından her gün
 *   resmi liderlik tablolarından çekilir.
 * - Diğerleri haberlerden (resmi/bağımsız kaynaklar) çıkarılan skorlarla dolar.
 *   Bir haber skoru ancak adı buradaki takma adlardan biriyle eşleşirse
 *   sıralama sayfalarına girer; şirket içi metrikler, müşteri KPI'ları ve
 *   donanım hız ölçümleri sadece kendi haber sayfasında görünür.
 */

export interface BenchmarkMeta {
  id: string;
  name: string;
  description: string;
  category: string;
  unit: string;
  higherIsBetter: boolean;
  /** Haberlerden gelen adları eşlemek için (küçük harfe çevrilmiş metne uygulanır) */
  aliases?: RegExp[];
  /** Resmi liderlik tablosunun adresi */
  link?: string;
  /** Yıllık değişen testler (AIME 2025 ≠ AIME 2026): yıl adın parçası olur */
  yearly?: boolean;
}

export const BENCHMARK_CATEGORIES = [
  { id: "sohbet-arena", name: "Sohbet & İnsan Tercihi" },
  { id: "kodlama", name: "Kodlama & Yazılım" },
  { id: "matematik", name: "Matematik" },
  { id: "muhakeme", name: "Akıl Yürütme" },
  { id: "genel-zeka", name: "Genel Bilgi & Talimat" },
  { id: "gorsel", name: "Görsel & Çok Modlu" },
  { id: "uzun-baglam", name: "Uzun Bağlam" },
  { id: "ajanlar", name: "Ajanlar & Araç Kullanımı" },
  { id: "guvenlik", name: "Doğruluk & Güvenlik" },
  { id: "turkce", name: "Çok Dillilik" },
  { id: "uzmanlik", name: "Uzmanlık Alanları" },
  { id: "verimlilik", name: "Verimlilik & Maliyet" },
];

const LMARENA = "https://lmarena.ai/leaderboard";

export const BENCHMARK_CATALOG: BenchmarkMeta[] = [
  // ── LMArena (canlı, insan oylarıyla ELO) ─────────────────────────────
  { id: "lmarena-text", name: "LMArena Metin (Genel)", description: "Kullanıcıların iki anonim modelin cevabını karşılaştırıp oy verdiği genel sohbet sıralaması (stil kontrollü ELO).", category: "sohbet-arena", unit: "ELO", higherIsBetter: true, link: LMARENA },
  { id: "lmarena-creative", name: "LMArena Yaratıcı Yazım", description: "Hikâye, şiir ve yaratıcı metin isteklerinde insan tercihi.", category: "sohbet-arena", unit: "ELO", higherIsBetter: true, link: LMARENA },
  { id: "lmarena-multiturn", name: "LMArena Çok Turlu Sohbet", description: "Birden fazla mesajlık konuşmalarda insan tercihi.", category: "sohbet-arena", unit: "ELO", higherIsBetter: true, link: LMARENA },
  { id: "lmarena-coding", name: "LMArena Kodlama", description: "Kodlama sorularında insan tercihi.", category: "kodlama", unit: "ELO", higherIsBetter: true, link: LMARENA },
  { id: "lmarena-webdev", name: "LMArena WebDev", description: "Modellerin sıfırdan web uygulaması kurduğu ve kullanıcıların sonucu oyladığı sıralama.", category: "kodlama", unit: "ELO", higherIsBetter: true, link: LMARENA },
  { id: "lmarena-math", name: "LMArena Matematik", description: "Matematik sorularında insan tercihi.", category: "matematik", unit: "ELO", higherIsBetter: true, link: LMARENA },
  { id: "lmarena-hard", name: "LMArena Zor İstemler", description: "Karmaşık, çok adımlı ve zor isteklerde insan tercihi.", category: "muhakeme", unit: "ELO", higherIsBetter: true, link: LMARENA },
  { id: "lmarena-if", name: "LMArena Talimat Takibi", description: "Ayrıntılı talimatlara uyma gerektiren isteklerde insan tercihi.", category: "genel-zeka", unit: "ELO", higherIsBetter: true, link: LMARENA },
  { id: "lmarena-longer", name: "LMArena Uzun Sorgular", description: "Uzun girdili isteklerde insan tercihi.", category: "uzun-baglam", unit: "ELO", higherIsBetter: true, link: LMARENA },
  { id: "lmarena-expert", name: "LMArena Uzman Soruları", description: "Alan uzmanlığı gerektiren sorularda insan tercihi.", category: "uzmanlik", unit: "ELO", higherIsBetter: true, link: LMARENA },
  { id: "lmarena-vision", name: "LMArena Görsel", description: "Görsel içeren isteklerde insan tercihi.", category: "gorsel", unit: "ELO", higherIsBetter: true, link: LMARENA },
  { id: "lmarena-turkish", name: "LMArena Türkçe", description: "Türkçe isteklerde insan tercihi.", category: "turkce", unit: "ELO", higherIsBetter: true, link: LMARENA },
  { id: "lmarena-nonenglish", name: "LMArena İngilizce Dışı Diller", description: "İngilizce dışındaki tüm dillerde insan tercihi.", category: "turkce", unit: "ELO", higherIsBetter: true, link: LMARENA },

  // ── SWE-bench (canlı, resmi liderlik tablosu) ───────────────────────
  { id: "swe-bench-verified", name: "SWE-bench Verified", description: "Gerçek GitHub sorunlarını çözme oranı (500 doğrulanmış görev). Skor model + ajan sisteminindir.", category: "kodlama", unit: "%", higherIsBetter: true, link: "https://www.swebench.com", aliases: [/swe[- ]?bench[- ]verified/] },

  // ── Haberlerden eşlenen bilinen testler ──────────────────────────────
  { id: "swe-bench-pro", name: "SWE-bench Pro", description: "Daha uzun ve zor, kurumsal ölçekli yazılım görevleri.", category: "kodlama", unit: "%", higherIsBetter: true, aliases: [/swe[- ]?bench[- ]pro/] },
  { id: "terminal-bench-2", name: "Terminal-Bench 2.0", description: "Terminalde gerçek görevleri uçtan uca tamamlama (2.0 sürümü).", category: "kodlama", unit: "%", higherIsBetter: true, aliases: [/terminal[- ]?bench[- ]?(v|@)?2/] },
  { id: "terminal-bench", name: "Terminal-Bench", description: "Terminalde gerçek görevleri uçtan uca tamamlama.", category: "kodlama", unit: "%", higherIsBetter: true, aliases: [/terminal[- ]?bench/] },
  { id: "livecodebench", name: "LiveCodeBench", description: "Eğitim verisine sızmamış güncel yarışma programlama soruları.", category: "kodlama", unit: "%", higherIsBetter: true, aliases: [/livecodebench/] },
  { id: "aider-polyglot", name: "Aider Polyglot", description: "Altı dilde zor kod düzenleme alıştırmaları.", category: "kodlama", unit: "%", higherIsBetter: true, aliases: [/aider.*polyglot/] },
  { id: "codeforces", name: "Codeforces Elo", description: "Rekabetçi programlama derecelendirmesi.", category: "kodlama", unit: "Elo", higherIsBetter: true, aliases: [/^codeforces/] },
  { id: "ioi", yearly: true, name: "IOI", description: "Uluslararası Bilişim Olimpiyatı soruları.", category: "kodlama", unit: "puan", higherIsBetter: true, aliases: [/^ioi\b/] },

  { id: "aime", yearly: true, name: "AIME", description: "Amerikan matematik olimpiyatı eleme soruları.", category: "matematik", unit: "%", higherIsBetter: true, aliases: [/^aime\b/] },
  { id: "hmmt", yearly: true, name: "HMMT", description: "Harvard-MIT matematik turnuvası soruları.", category: "matematik", unit: "%", higherIsBetter: true, aliases: [/^hmmt\b/] },
  { id: "frontiermath", name: "FrontierMath", description: "Araştırma düzeyinde, çok zor matematik problemleri.", category: "matematik", unit: "%", higherIsBetter: true, aliases: [/frontiermath/] },
  { id: "imo", yearly: true, name: "IMO", description: "Uluslararası Matematik Olimpiyatı.", category: "matematik", unit: "puan", higherIsBetter: true, aliases: [/^imo\b(?![- ]?proof)/] },

  { id: "hle", name: "Humanity's Last Exam", description: "Yüzlerce alandan uzmanların hazırladığı son derece zor sorular.", category: "muhakeme", unit: "%", higherIsBetter: true, aliases: [/humanity.?s last exam/, /^hle\b/] },
  { id: "arc-agi-2", name: "ARC-AGI-2", description: "Yeni görsel örüntülerden kural çıkarma ve soyutlama.", category: "muhakeme", unit: "%", higherIsBetter: true, aliases: [/arc[- ]?agi[- ]?2/] },
  { id: "arc-agi-3", name: "ARC-AGI-3", description: "Etkileşimli ortamlarda soyut akıl yürütme.", category: "muhakeme", unit: "%", higherIsBetter: true, aliases: [/arc[- ]?agi[- ]?3/] },

  { id: "gpqa-diamond", name: "GPQA Diamond", description: "Uzman seviyesinde biyoloji, fizik ve kimya soruları.", category: "genel-zeka", unit: "%", higherIsBetter: true, aliases: [/gpqa/] },
  { id: "mmlu-pro", name: "MMLU-Pro", description: "Çok alanlı, zorlaştırılmış genel bilgi ve akıl yürütme.", category: "genel-zeka", unit: "%", higherIsBetter: true, aliases: [/mmlu[- ]?pro/] },
  { id: "mmmlu", name: "MMMLU", description: "MMLU'nun 14 dile çevrilmiş çok dilli sürümü.", category: "turkce", unit: "%", higherIsBetter: true, aliases: [/^mmmlu/] },
  { id: "aa-index", name: "Artificial Analysis Intelligence Index", description: "Artificial Analysis'in birçok testi birleştiren genel zekâ endeksi.", category: "genel-zeka", unit: "puan", higherIsBetter: true, aliases: [/artificial analysis.*intelligence index/] },

  { id: "mmmu", name: "MMMU", description: "Üniversite düzeyinde görsel + metinsel sorular.", category: "gorsel", unit: "%", higherIsBetter: true, aliases: [/^mmmu(?![- ]?pro)/] },
  { id: "mmmu-pro", name: "MMMU-Pro", description: "MMMU'nun zorlaştırılmış sürümü.", category: "gorsel", unit: "%", higherIsBetter: true, aliases: [/mmmu[- ]?pro/] },
  { id: "video-mme", name: "Video-MME", description: "Video anlama ve soru cevaplama.", category: "gorsel", unit: "%", higherIsBetter: true, aliases: [/video[- ]?mme/] },
  { id: "lvbench", name: "LVBench", description: "Uzun video anlama.", category: "gorsel", unit: "%", higherIsBetter: true, aliases: [/^lvbench/] },

  { id: "mrcr", name: "MRCR", description: "Çok uzun bağlamda birden çok bilgiyi doğru geri çağırma.", category: "uzun-baglam", unit: "%", higherIsBetter: true, aliases: [/\bmrcr\b/] },

  { id: "tau-bench", name: "τ²-bench", description: "Müşteri hizmeti senaryolarında araç kullanan ajan başarısı.", category: "ajanlar", unit: "%", higherIsBetter: true, aliases: [/τ²|tau2|tau[- ]?bench|τ[- ]?bench/] },
  { id: "osworld", name: "OSWorld", description: "Bilgisayarı ekran üzerinden kullanarak görev tamamlama.", category: "ajanlar", unit: "%", higherIsBetter: true, aliases: [/osworld/] },
  { id: "browsecomp", name: "BrowseComp", description: "Web'de zor bulunur bilgileri araştırıp bulma.", category: "ajanlar", unit: "%", higherIsBetter: true, aliases: [/browsecomp/] },
  { id: "gdpval", name: "GDPval", description: "Gerçek meslek görevlerinde uzman çıktısıyla karşılaştırma.", category: "ajanlar", unit: "%", higherIsBetter: true, aliases: [/gdpval/] },
  { id: "bfcl", name: "BFCL", description: "Doğru fonksiyon/araç çağırma (Berkeley).", category: "ajanlar", unit: "%", higherIsBetter: true, aliases: [/\bbfcl\b|berkeley function/] },

  { id: "simpleqa", name: "SimpleQA", description: "Kısa olgusal sorularda uydurmadan doğru cevap verme.", category: "guvenlik", unit: "%", higherIsBetter: true, aliases: [/simpleqa/] },
];

export function findBenchmark(id: string): BenchmarkMeta | undefined {
  return BENCHMARK_CATALOG.find(b => b.id === id);
}

/**
 * Haberden gelen benchmark adını katalogla eşler.
 * Yıllık testlerde yıl kimliğe eklenir: "AIME 2026" -> { id: "aime-2026", name: "AIME 2026" }
 */
export function matchBenchmarkName(name: string): BenchmarkMeta | undefined {
  const n = (name || '').toLowerCase().replace(/\s+/g, ' ').trim();
  if (!n) return undefined;
  const meta = BENCHMARK_CATALOG.find(b => b.aliases?.some(re => re.test(n)));
  if (!meta || !meta.yearly) return meta;
  const year = n.match(/\b(20\d{2})\b/)?.[1];
  if (!year) return meta;
  return { ...meta, id: `${meta.id}-${year}`, name: `${meta.name} ${year}` };
}

export function categoryName(id: string): string {
  return BENCHMARK_CATEGORIES.find(c => c.id === id)?.name ?? id;
}
