import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, '..');
const benchmarksFile = path.join(ROOT, 'data', 'benchmarks.json');

// Standart Doğrulanmış AI Benchmark Referans Veri Havuzu
const canonicalStandardData = [
  // 1. Genel Zekâ & Bilgi
  { model: "Claude 3.5 Sonnet", benchmark: "MMLU", skor: 88.7, birim: "%", category: "genel-zeka", yuksek_iyi_mi: true, source: "Anthropic" },
  { model: "GPT-4o", benchmark: "MMLU", skor: 88.7, birim: "%", category: "genel-zeka", yuksek_iyi_mi: true, source: "OpenAI" },
  { model: "Gemini 1.5 Pro", benchmark: "MMLU", skor: 85.9, birim: "%", category: "genel-zeka", yuksek_iyi_mi: true, source: "Google DeepMind" },
  { model: "Llama 3.3 70B", benchmark: "MMLU", skor: 86.9, birim: "%", category: "genel-zeka", yuksek_iyi_mi: true, source: "Meta AI" },
  { model: "GPT-4o mini", benchmark: "MMLU", skor: 82.0, birim: "%", category: "genel-zeka", yuksek_iyi_mi: true, source: "OpenAI" },
  { model: "Mistral Large 2", benchmark: "MMLU", skor: 84.0, birim: "%", category: "genel-zeka", yuksek_iyi_mi: true, source: "Mistral" },

  { model: "Claude 3.5 Sonnet", benchmark: "MMLU-Pro", skor: 78.0, birim: "%", category: "genel-zeka", yuksek_iyi_mi: true, source: "Anthropic" },
  { model: "GPT-4o", benchmark: "MMLU-Pro", skor: 72.6, birim: "%", category: "genel-zeka", yuksek_iyi_mi: true, source: "OpenAI" },
  { model: "Gemini 1.5 Pro", benchmark: "MMLU-Pro", skor: 69.0, birim: "%", category: "genel-zeka", yuksek_iyi_mi: true, source: "Google DeepMind" },
  { model: "Llama 3.3 70B", benchmark: "MMLU-Pro", skor: 68.3, birim: "%", category: "genel-zeka", yuksek_iyi_mi: true, source: "Meta AI" },

  { model: "Claude 3.5 Sonnet", benchmark: "GPQA Diamond", skor: 65.0, birim: "%", category: "genel-zeka", yuksek_iyi_mi: true, source: "Anthropic" },
  { model: "GPT-4o", benchmark: "GPQA Diamond", skor: 53.6, birim: "%", category: "genel-zeka", yuksek_iyi_mi: true, source: "OpenAI" },
  { model: "Gemini 1.5 Pro", benchmark: "GPQA Diamond", skor: 46.2, birim: "%", category: "genel-zeka", yuksek_iyi_mi: true, source: "Google DeepMind" },
  { model: "Llama 3.3 70B", benchmark: "GPQA Diamond", skor: 45.1, birim: "%", category: "genel-zeka", yuksek_iyi_mi: true, source: "Meta AI" },

  // 2. Matematik & Mantık
  { model: "Claude 3.5 Sonnet", benchmark: "GSM8K", skor: 96.4, birim: "%", category: "matematik", yuksek_iyi_mi: true, source: "Anthropic" },
  { model: "GPT-4o", benchmark: "GSM8K", skor: 95.8, birim: "%", category: "matematik", yuksek_iyi_mi: true, source: "OpenAI" },
  { model: "Llama 3.3 70B", benchmark: "GSM8K", skor: 93.4, birim: "%", category: "matematik", yuksek_iyi_mi: true, source: "Meta AI" },
  { model: "Gemini 1.5 Pro", benchmark: "GSM8K", skor: 91.7, birim: "%", category: "matematik", yuksek_iyi_mi: true, source: "Google DeepMind" },
  { model: "GPT-4o mini", benchmark: "GSM8K", skor: 91.3, birim: "%", category: "matematik", yuksek_iyi_mi: true, source: "OpenAI" },

  { model: "Claude 3.5 Sonnet", benchmark: "MATH", skor: 78.3, birim: "%", category: "matematik", yuksek_iyi_mi: true, source: "Anthropic" },
  { model: "GPT-4o", benchmark: "MATH", skor: 76.6, birim: "%", category: "matematik", yuksek_iyi_mi: true, source: "OpenAI" },
  { model: "Llama 3.3 70B", benchmark: "MATH", skor: 70.2, birim: "%", category: "matematik", yuksek_iyi_mi: true, source: "Meta AI" },
  { model: "Gemini 1.5 Pro", benchmark: "MATH", skor: 67.7, birim: "%", category: "matematik", yuksek_iyi_mi: true, source: "Google DeepMind" },
  { model: "GPT-4o mini", benchmark: "MATH", skor: 70.2, birim: "%", category: "matematik", yuksek_iyi_mi: true, source: "OpenAI" },

  { model: "Claude 3.5 Sonnet", benchmark: "AIME", skor: 43.3, birim: "%", category: "matematik", yuksek_iyi_mi: true, source: "Anthropic" },
  { model: "GPT-4o", benchmark: "AIME", skor: 33.3, birim: "%", category: "matematik", yuksek_iyi_mi: true, source: "OpenAI" },
  { model: "Llama 3.3 70B", benchmark: "AIME", skor: 26.7, birim: "%", category: "matematik", yuksek_iyi_mi: true, source: "Meta AI" },

  // 3. Kodlama & Yazılım
  { model: "Claude 3.5 Sonnet", benchmark: "HumanEval", skor: 92.0, birim: "%", category: "kodlama", yuksek_iyi_mi: true, source: "Anthropic" },
  { model: "GPT-4o", benchmark: "HumanEval", skor: 90.2, birim: "%", category: "kodlama", yuksek_iyi_mi: true, source: "OpenAI" },
  { model: "GPT-4o mini", benchmark: "HumanEval", skor: 87.2, birim: "%", category: "kodlama", yuksek_iyi_mi: true, source: "OpenAI" },
  { model: "Gemini 1.5 Pro", benchmark: "HumanEval", skor: 84.1, birim: "%", category: "kodlama", yuksek_iyi_mi: true, source: "Google DeepMind" },
  { model: "Llama 3.3 70B", benchmark: "HumanEval", skor: 81.7, birim: "%", category: "kodlama", yuksek_iyi_mi: true, source: "Meta AI" },

  { model: "Claude 3.5 Sonnet", benchmark: "SWE-bench Verified", skor: 49.0, birim: "%", category: "kodlama", yuksek_iyi_mi: true, source: "Anthropic" },
  { model: "GPT-4o", benchmark: "SWE-bench Verified", skor: 38.8, birim: "%", category: "kodlama", yuksek_iyi_mi: true, source: "OpenAI" },
  { model: "Gemini 1.5 Pro", benchmark: "SWE-bench Verified", skor: 33.2, birim: "%", category: "kodlama", yuksek_iyi_mi: true, source: "Google DeepMind" },
  { model: "Llama 3.3 70B", benchmark: "SWE-bench Verified", skor: 29.5, birim: "%", category: "kodlama", yuksek_iyi_mi: true, source: "Meta AI" },

  // 4. Akıl Yürütme & Zor Problemler
  { model: "Claude 3.5 Sonnet", benchmark: "BIG-Bench Hard (BBH)", skor: 93.1, birim: "%", category: "muhakeme", yuksek_iyi_mi: true, source: "Anthropic" },
  { model: "GPT-4o", benchmark: "BIG-Bench Hard (BBH)", skor: 90.4, birim: "%", category: "muhakeme", yuksek_iyi_mi: true, source: "OpenAI" },
  { model: "Gemini 1.5 Pro", benchmark: "BIG-Bench Hard (BBH)", skor: 88.3, birim: "%", category: "muhakeme", yuksek_iyi_mi: true, source: "Google DeepMind" },
  { model: "Llama 3.3 70B", benchmark: "BIG-Bench Hard (BBH)", skor: 87.6, birim: "%", category: "muhakeme", yuksek_iyi_mi: true, source: "Meta AI" },

  // 5. Görsel & Çok Modlu (MMMU)
  { model: "Claude 3.5 Sonnet", benchmark: "MMMU", skor: 70.4, birim: "%", category: "gorsel", yuksek_iyi_mi: true, source: "Anthropic" },
  { model: "GPT-4o", benchmark: "MMMU", skor: 69.1, birim: "%", category: "gorsel", yuksek_iyi_mi: true, source: "OpenAI" },
  { model: "Gemini 1.5 Pro", benchmark: "MMMU", skor: 62.3, birim: "%", category: "gorsel", yuksek_iyi_mi: true, source: "Google DeepMind" },

  // 6. Uzun Bağlam & Hafıza
  { model: "Gemini 1.5 Pro (2M)", benchmark: "Needle In A Haystack", skor: 99.8, birim: "%", category: "uzun-baglam", yuksek_iyi_mi: true, source: "Google DeepMind" },
  { model: "Claude 3.5 Sonnet (200K)", benchmark: "Needle In A Haystack", skor: 99.4, birim: "%", category: "uzun-baglam", yuksek_iyi_mi: true, source: "Anthropic" },
  { model: "GPT-4o (128K)", benchmark: "Needle In A Haystack", skor: 98.7, birim: "%", category: "uzun-baglam", yuksek_iyi_mi: true, source: "OpenAI" },

  // 7. Araç Kullanımı & Ajanlar
  { model: "Claude 3.5 Sonnet", benchmark: "BFCL Function Calling", skor: 91.2, birim: "%", category: "ajanlar", yuksek_iyi_mi: true, source: "Berkeley BFCL" },
  { model: "GPT-4o", benchmark: "BFCL Function Calling", skor: 88.5, birim: "%", category: "ajanlar", yuksek_iyi_mi: true, source: "Berkeley BFCL" },
  { model: "Gemini 1.5 Pro", benchmark: "BFCL Function Calling", skor: 85.1, birim: "%", category: "ajanlar", yuksek_iyi_mi: true, source: "Berkeley BFCL" },

  // 8. Güvenlik, Doğruluk & Olgusallık
  { model: "GPT-4o", benchmark: "SimpleQA", skor: 38.2, birim: "%", category: "guvenlik", yuksek_iyi_mi: true, source: "OpenAI" },
  { model: "Claude 3.5 Sonnet", benchmark: "SimpleQA", skor: 34.6, birim: "%", category: "guvenlik", yuksek_iyi_mi: true, source: "Anthropic" },
  { model: "Gemini 1.5 Pro", benchmark: "SimpleQA", skor: 32.1, birim: "%", category: "guvenlik", yuksek_iyi_mi: true, source: "Google DeepMind" },

  // 9. Çok Dillilik & Türkçe
  { model: "GPT-4o", benchmark: "Turkish MMLU", skor: 84.6, birim: "%", category: "turkce", yuksek_iyi_mi: true, source: "Topluluk Değerlendirmesi" },
  { model: "Claude 3.5 Sonnet", benchmark: "Turkish MMLU", skor: 83.2, birim: "%", category: "turkce", yuksek_iyi_mi: true, source: "Topluluk Değerlendirmesi" },
  { model: "Gemini 1.5 Pro", benchmark: "Turkish MMLU", skor: 81.5, birim: "%", category: "turkce", yuksek_iyi_mi: true, source: "Topluluk Değerlendirmesi" },
  { model: "Llama 3.3 70B", benchmark: "Turkish MMLU", skor: 78.4, birim: "%", category: "turkce", yuksek_iyi_mi: true, source: "Topluluk Değerlendirmesi" },

  // 10. Bilim, Tıp & Uzmanlık
  { model: "Claude 3.5 Sonnet", benchmark: "MedQA", skor: 91.1, birim: "%", category: "uzmanlik", yuksek_iyi_mi: true, source: "Anthropic" },
  { model: "GPT-4o", benchmark: "MedQA", skor: 90.2, birim: "%", category: "uzmanlik", yuksek_iyi_mi: true, source: "OpenAI" },
  { model: "Gemini 1.5 Pro", benchmark: "MedQA", skor: 86.8, birim: "%", category: "uzmanlik", yuksek_iyi_mi: true, source: "Google DeepMind" },

  // 11. Verimlilik & Hız
  { model: "GPT-4o mini", benchmark: "Tokens/sec (Üretim Hızı)", skor: 142, birim: "t/s", category: "verimlilik", yuksek_iyi_mi: true, source: "Artificial Analysis" },
  { model: "Llama 3.3 70B (Groq)", benchmark: "Tokens/sec (Üretim Hızı)", skor: 280, birim: "t/s", category: "verimlilik", yuksek_iyi_mi: true, source: "Groq Cloud" },
  { model: "Claude 3.5 Sonnet", benchmark: "Tokens/sec (Üretim Hızı)", skor: 85, birim: "t/s", category: "verimlilik", yuksek_iyi_mi: true, source: "Artificial Analysis" },
  { model: "GPT-4o", benchmark: "Tokens/sec (Üretim Hızı)", skor: 92, birim: "t/s", category: "verimlilik", yuksek_iyi_mi: true, source: "Artificial Analysis" },
  { model: "Gemini 1.5 Pro", benchmark: "Tokens/sec (Üretim Hızı)", skor: 64, birim: "t/s", category: "verimlilik", yuksek_iyi_mi: true, source: "Artificial Analysis" }
];

export async function syncAllBenchmarks() {
    console.log("Syncing canonical benchmarks and fetching live LMArena splits...");
    const allBenchmarks: any[] = [...canonicalStandardData];

    // 1. Fetch LMArena Text Overall (Chatbot Arena ELO)
    try {
        const textUrl = 'https://datasets-server.huggingface.co/rows?dataset=lmarena-ai%2Fleaderboard-dataset&config=text_style_control&split=latest&limit=100';
        const res = await axios.get(textUrl, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 25000 });
        if (res.data && res.data.rows) {
            res.data.rows.forEach((item: any) => {
                const r = item.row;
                if (!r || !r.model_name || !r.rating) return;
                const modelName = r.model_name.replace(/-/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase());
                allBenchmarks.push({
                    model: modelName,
                    benchmark: 'Chatbot Arena ELO',
                    skor: Math.round(r.rating),
                    birim: 'ELO',
                    category: 'sohbet-arena',
                    yuksek_iyi_mi: true,
                    degerlendirme_ayari: `Sıra: #${r.rank} | Oy: ${r.vote_count?.toLocaleString('tr-TR') || '-'} (${r.organization})`,
                    date: r.leaderboard_publish_date ? new Date(r.leaderboard_publish_date).toISOString() : new Date().toISOString(),
                    url: 'https://lmarena.ai',
                    source: 'LMSYS Chatbot Arena'
                });
            });
            console.log("✓ LMArena Sohbet ELO yüklendi.");
        }
    } catch (e: any) {
        console.warn("LMArena Text fetch warning:", e.message);
    }

    // 2. Fetch LMArena Vision (Görsel ELO)
    try {
        const visionUrl = 'https://datasets-server.huggingface.co/rows?dataset=lmarena-ai%2Fleaderboard-dataset&config=vision&split=latest&limit=30';
        const res = await axios.get(visionUrl, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 25000 });
        if (res.data && res.data.rows) {
            res.data.rows.forEach((item: any) => {
                const r = item.row;
                if (!r || !r.model_name || !r.rating || isNaN(r.rating)) return;
                const modelName = r.model_name.replace(/-/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase());
                allBenchmarks.push({
                    model: modelName,
                    benchmark: 'LMArena Vision',
                    skor: Math.round(r.rating),
                    birim: 'ELO',
                    category: 'gorsel',
                    yuksek_iyi_mi: true,
                    degerlendirme_ayari: `Sıra: #${r.rank} (${r.organization})`,
                    date: new Date().toISOString(),
                    url: 'https://lmarena.ai',
                    source: 'LMSYS Chatbot Arena'
                });
            });
            console.log("✓ LMArena Vision ELO yüklendi.");
        }
    } catch (e: any) {
        console.warn("LMArena Vision fetch warning:", e.message);
    }

    // 3. Fetch LMArena WebDev (Ajanlar / Kodlama ELO)
    try {
        const webdevUrl = 'https://datasets-server.huggingface.co/rows?dataset=lmarena-ai%2Fleaderboard-dataset&config=webdev&split=latest&limit=30';
        const res = await axios.get(webdevUrl, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 25000 });
        if (res.data && res.data.rows) {
            res.data.rows.forEach((item: any) => {
                const r = item.row;
                if (!r || !r.model_name || !r.rating || isNaN(r.rating)) return;
                const modelName = r.model_name.replace(/-/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase());
                allBenchmarks.push({
                    model: modelName,
                    benchmark: 'LMArena WebDev',
                    skor: Math.round(r.rating),
                    birim: 'ELO',
                    category: 'ajanlar',
                    yuksek_iyi_mi: true,
                    degerlendirme_ayari: `Sıra: #${r.rank} (${r.organization})`,
                    date: new Date().toISOString(),
                    url: 'https://lmarena.ai',
                    source: 'LMSYS Chatbot Arena'
                });
            });
            console.log("✓ LMArena WebDev ELO yüklendi.");
        }
    } catch (e: any) {
        console.warn("LMArena WebDev fetch warning:", e.message);
    }

    fs.writeFileSync(benchmarksFile, JSON.stringify(allBenchmarks, null, 2));
    console.log(`Bitti! Toplam ${allBenchmarks.length} benchmark kaydı hazırlandı.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    syncAllBenchmarks().catch(console.error);
}
