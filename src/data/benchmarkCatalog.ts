export interface BenchmarkMeta {
  id: string;
  name: string;
  description: string;
  category: string; // "genel-zeka" | "matematik" | "kodlama" | "muhakeme" | "gorsel" | "uzun-baglam" | "ajanlar" | "sohbet-arena" | "guvenlik" | "turkce" | "uzmanlik" | "verimlilik"
  unit: string;
  higherIsBetter: boolean;
}

export const BENCHMARK_CATEGORIES = [
  { id: "all", name: "Tüm Kategoriler" },
  { id: "sohbet-arena", name: "Sohbet & İnsan Tercihi (Arena)" },
  { id: "genel-zeka", name: "Genel Zekâ & Bilgi" },
  { id: "matematik", name: "Matematik & Mantık" },
  { id: "kodlama", name: "Kodlama & Yazılım" },
  { id: "muhakeme", name: "Akıl Yürütme & Zor Problemler" },
  { id: "gorsel", name: "Görsel & Çok Modlu (Vision)" },
  { id: "uzun-baglam", name: "Uzun Bağlam & Hafıza" },
  { id: "ajanlar", name: "Araç Kullanımı & Ajanlar" },
  { id: "guvenlik", name: "Güvenlik & Doğruluk" },
  { id: "turkce", name: "Çok Dillilik & Türkçe" },
  { id: "uzmanlik", name: "Bilim, Tıp & Uzmanlık" },
  { id: "verimlilik", name: "Verimlilik & Hız / Maliyet" }
];

export const BENCHMARK_CATALOG: BenchmarkMeta[] = [
  // 1. Genel zekâ ve bilgi testleri
  { id: "MMLU", name: "MMLU", description: "57 alanda genel bilgi ve akademik başarı", category: "genel-zeka", unit: "%", higherIsBetter: true },
  { id: "MMLU-Pro", name: "MMLU-Pro", description: "Daha zor, çok alanlı bilgi ve akıl yürütme", category: "genel-zeka", unit: "%", higherIsBetter: true },
  { id: "GPQA Diamond", name: "GPQA Diamond", description: "Uzman seviyesinde biyoloji, fizik ve kimya", category: "genel-zeka", unit: "%", higherIsBetter: true },
  { id: "ARC-Challenge", name: "ARC-Challenge", description: "Bilimsel bilgi ve akıl yürütme", category: "genel-zeka", unit: "%", higherIsBetter: true },
  { id: "HellaSwag", name: "HellaSwag", description: "Günlük olaylarda mantıklı devamı tahmin etme", category: "genel-zeka", unit: "%", higherIsBetter: true },
  { id: "IFEval", name: "IFEval", description: "Karmaşık talimatlara tam uyma başarısı", category: "genel-zeka", unit: "%", higherIsBetter: true },

  // 2. Matematik ve mantık
  { id: "GSM8K", name: "GSM8K", description: "İlköğretim ve ortaöğretim seviyesinde matematik problemleri", category: "matematik", unit: "%", higherIsBetter: true },
  { id: "MATH", name: "MATH", description: "Yarışma seviyesinde ileri düzey matematik", category: "matematik", unit: "%", higherIsBetter: true },
  { id: "AIME", name: "AIME", description: "Matematik olimpiyatı tarzı zor problemler", category: "matematik", unit: "%", higherIsBetter: true },
  { id: "FrontierMath", name: "FrontierMath", description: "Uzmanlık gerektiren, son derece zor matematik problemleri", category: "matematik", unit: "%", higherIsBetter: true },

  // 3. Kodlama ve yazılım geliştirme
  { id: "HumanEval", name: "HumanEval", description: "Fonksiyon üretme ve Python birim testlerini geçme", category: "kodlama", unit: "%", higherIsBetter: true },
  { id: "SWE-bench Verified", name: "SWE-bench Verified", description: "Gerçek GitHub sorunlarını çözme ve hata ayıklama", category: "kodlama", unit: "%", higherIsBetter: true },
  { id: "LiveCodeBench", name: "LiveCodeBench", description: "Güncel rekabetçi programlama problemlerini çözme", category: "kodlama", unit: "%", higherIsBetter: true },
  { id: "MBPP", name: "MBPP", description: "Temel Python programlama görevleri", category: "kodlama", unit: "%", higherIsBetter: true },

  // 4. Akıl yürütme ve zor problemler
  { id: "ARC-AGI", name: "ARC-AGI", description: "Yeni örüntülerden kural çıkarma ve soyutlama", category: "muhakeme", unit: "%", higherIsBetter: true },
  { id: "Humanity's Last Exam (HLE)", name: "Humanity's Last Exam (HLE)", description: "Çok çeşitli uzmanlık alanlarında son derece zor sorular", category: "muhakeme", unit: "%", higherIsBetter: true },
  { id: "BIG-Bench Hard (BBH)", name: "BIG-Bench Hard (BBH)", description: "Zor akıl yürütme görevleri", category: "muhakeme", unit: "%", higherIsBetter: true },

  // 5. Görsel anlama ve çok modlu AI
  { id: "MMMU", name: "MMMU", description: "Üniversite düzeyinde görsel ve metinsel sorular", category: "gorsel", unit: "%", higherIsBetter: true },
  { id: "LMArena Vision", name: "LMArena Vision", description: "İnsanların görsel model yanıtlarına verdiği tercihler (ELO)", category: "gorsel", unit: "ELO", higherIsBetter: true },
  { id: "MathVista", name: "MathVista", description: "Görsel içerikli matematiksel akıl yürütme", category: "gorsel", unit: "%", higherIsBetter: true },
  { id: "DocVQA", name: "DocVQA", description: "Belgeler ve taranmış evraklardan bilgi çıkarma", category: "gorsel", unit: "%", higherIsBetter: true },

  // 6. Uzun bağlam ve hafıza
  { id: "Needle In A Haystack", name: "Needle In A Haystack", description: "Uzun metinde gizlenmiş belirli bir bilgiyi bulma (İğne Samanlıkta)", category: "uzun-baglam", unit: "%", higherIsBetter: true },
  { id: "RULER", name: "RULER", description: "Uzun bağlamda bilgi bulma ve çeşitli görevleri yerine getirme", category: "uzun-baglam", unit: "%", higherIsBetter: true },
  { id: "LongBench", name: "LongBench", description: "Uzun metin anlama, özetleme ve soru cevaplama", category: "uzun-baglam", unit: "%", higherIsBetter: true },

  // 7. Araç kullanımı ve otonom ajanlar
  { id: "BFCL Function Calling", name: "BFCL Function Calling", description: "Doğru araç ve fonksiyon çağırma başarısı", category: "ajanlar", unit: "%", higherIsBetter: true },
  { id: "LMArena WebDev", name: "LMArena WebDev", description: "Web geliştirme ve kodlama ajanları insan tercihi (ELO)", category: "ajanlar", unit: "ELO", higherIsBetter: true },
  { id: "GAIA", name: "GAIA", description: "Araç kullanarak genel asistan ve internet araştırması problemlerini çözme", category: "ajanlar", unit: "%", higherIsBetter: true },
  { id: "OSWorld", name: "OSWorld", description: "Bilgisayar arayüzünü ve işletim sistemini kullanarak görev tamamlama", category: "ajanlar", unit: "%", higherIsBetter: true },

  // 8. Yazı kalitesi, sohbet ve LMArena
  { id: "Chatbot Arena ELO", name: "Chatbot Arena ELO", description: "LMSYS Chatbot Arena insan tercihlerine dayalı küresel ELO sıralaması", category: "sohbet-arena", unit: "ELO", higherIsBetter: true },
  { id: "MT-Bench", name: "MT-Bench", description: "Çok turlu sohbet ve karmaşık talimatları yerine getirme", category: "sohbet-arena", unit: "/10", higherIsBetter: true },
  { id: "AlpacaEval 2", name: "AlpacaEval 2", description: "İnsan tercihleriyle ilişkili model yanıt kazanma oranı", category: "sohbet-arena", unit: "%", higherIsBetter: true },

  // 9. Güvenlik, doğruluk ve güvenilirlik
  { id: "SimpleQA", name: "SimpleQA", description: "Olgusal sorulara halüsinasyon görmeden doğru cevap verme", category: "guvenlik", unit: "%", higherIsBetter: true },
  { id: "TruthfulQA", name: "TruthfulQA", description: "Yanlış inanışlara kapılmadan ve uydurmadan doğru cevap verme", category: "guvenlik", unit: "%", higherIsBetter: true },
  { id: "HarmBench", name: "HarmBench", description: "Zararlı isteklere karşı güvenlik ve direnç", category: "guvenlik", unit: "%", higherIsBetter: true },

  // 10. Çok dillilik ve Türkçe performansı
  { id: "Turkish MMLU", name: "Turkish MMLU", description: "Türkçe genel bilgi, dil bilgisi ve akademik sorular", category: "turkce", unit: "%", higherIsBetter: true },
  { id: "MGSM Çok Dilli Matematik", name: "MGSM Çok Dilli Matematik", description: "Farklı dillerde matematiksel mantık yürütme", category: "turkce", unit: "%", higherIsBetter: true },
  { id: "FLORES-200 Çeviri", name: "FLORES-200 Çeviri", description: "Diller arası doğru anlam çevirisi (spBLEU)", category: "turkce", unit: "BLEU", higherIsBetter: true },

  // 11. Bilim, tıp ve uzmanlık
  { id: "MedQA", name: "MedQA", description: "Tıp fakültesi seviyesinde klinik tıp soruları", category: "uzmanlik", unit: "%", higherIsBetter: true },
  { id: "PubMedQA", name: "PubMedQA", description: "Biyomedikal araştırma makalelerinden çıkarım yapma", category: "uzmanlik", unit: "%", higherIsBetter: true },
  { id: "LegalBench", name: "LegalBench", description: "Hukuki metin analizi ve yasal akıl yürütme", category: "uzmanlik", unit: "%", higherIsBetter: true },

  // 12. Verimlilik ve maliyet
  { id: "Tokens/sec (Üretim Hızı)", name: "Tokens/sec (Üretim Hızı)", description: "Saniyede üretilen ortalama token hızı", category: "verimlilik", unit: "t/s", higherIsBetter: true },
  { id: "TTFT (İlk Token Süresi)", name: "TTFT (İlk Token Süresi)", description: "İlk cevabın gelme gecikmesi (düşük iyi)", category: "verimlilik", unit: "ms", higherIsBetter: false }
];
