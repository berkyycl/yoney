/**
 * backfill.ts — Tek seferlik 30 günlük haber doldurma scripti.
 * RSS feed'lerinde artık bulunmayan eski AI haberlerini Tavily Search ile bulur,
 * pipeline'ın LLM analizinden geçirir ve data/articles/ klasörüne kaydeder.
 *
 * Kullanım: npx tsx scripts/backfill.ts
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { JSDOM } from 'jsdom';
import { FallbackLLMProvider } from './llm/fallback.js';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, '..');

const provider = new FallbackLLMProvider();
const TAVILY_API_KEY = process.env.TAVILY_API_KEY;

if (!TAVILY_API_KEY) {
    console.error('TAVILY_API_KEY eksik! .env dosyasını kontrol et.');
    process.exit(1);
}

// 30 günlük backfill için arama sorguları
const SEARCH_QUERIES = [
    'artificial intelligence model release 2026',
    'OpenAI new model announcement 2026',
    'Google Gemini AI update 2026',
    'Anthropic Claude AI release 2026',
    'Meta Llama AI model 2026',
    'AI benchmark results performance 2026',
    'large language model new capabilities 2026',
    'AI agent autonomous 2026',
    'generative AI breakthrough research 2026',
    'Mistral AI model release 2026',
    'AI coding assistant update 2026',
    'multimodal AI vision model 2026',
    'AI safety alignment research 2026',
    'AI startup funding announcement 2026',
    'open source AI model weights release 2026',
    'AI hardware GPU inference 2026',
    'ChatGPT update feature 2026',
    'AI API pricing update 2026',
    'deep learning research paper 2026',
    'AI reasoning model improvement 2026',
];

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

async function tavilySearch(query: string): Promise<any[]> {
    try {
        const res = await axios.post('https://api.tavily.com/search', {
            api_key: TAVILY_API_KEY,
            query,
            search_depth: 'advanced',
            include_images: true,
            max_results: 8,
            days: 30,          // Son 30 gün
            include_answer: false,
        }, { timeout: 15000 });

        return res.data?.results || [];
    } catch (e: any) {
        console.warn(`  Tavily search failed for "${query}": ${e.message}`);
        return [];
    }
}

async function fetchArticleText(url: string): Promise<{ text: string; imageUrl?: string }> {
    // 1. Direct fetch
    try {
        const res = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            },
            timeout: 8000,
        });
        const dom = new JSDOM(res.data);
        const doc = dom.window.document;

        const ogImage = doc.querySelector('meta[property="og:image"]')?.getAttribute('content') ||
                        doc.querySelector('meta[name="twitter:image"]')?.getAttribute('content');
        const imageUrl = ogImage?.startsWith('http') ? ogImage : undefined;

        doc.querySelectorAll('script, style, noscript, nav, footer, header').forEach(el => el.remove());
        const mainEl = doc.querySelector('article') || doc.querySelector('main') || doc.body;
        const text = mainEl?.textContent?.replace(/\s+/g, ' ').trim() || '';

        if (text.length > 400) return { text, imageUrl };
    } catch { /* fallthrough */ }

    // 2. Jina reader fallback
    try {
        const res = await axios.get(`https://r.jina.ai/${url}`, {
            timeout: 10000,
            headers: { 'Accept': 'text/plain' }
        });
        if (res.data?.length > 300) return { text: res.data };
    } catch { /* fallthrough */ }

    return { text: '' };
}

// AI relevance check (same logic as pipeline.ts)
const AI_KEYWORDS = [
    'artificial intelligence', 'machine learning', 'deep learning', 'large language model',
    'llm', 'neural network', 'generative ai', 'gpt', 'gemini', 'claude', 'llama', 'mistral',
    'grok', 'openai', 'anthropic', 'deepmind', 'transformer', 'diffusion',
    'chatbot', 'chatgpt', 'ai model', 'foundation model', 'language model', 'benchmark',
    'multimodal', 'fine-tuning', 'inference', 'open-source ai', 'open weights',
    'alignment', 'hallucination', 'context window', 'model release', 'ai research',
    'ai safety', 'nvidia', 'ai chip', 'agentic', 'autonomous agent', 'ai agent',
    'stable diffusion', 'text-to-image', 'text-to-video', 'sora', 'imagen',
];

function isAIRelated(title: string, text: string): boolean {
    const combined = (title + ' ' + text).toLowerCase();
    return AI_KEYWORDS.some(k => combined.includes(k));
}

async function main() {
    console.log('🚀 Backfill başlatılıyor — son 30 günün AI haberleri aranıyor...\n');

    const dataDir = path.join(ROOT, 'data');
    const articlesDir = path.join(dataDir, 'articles');
    if (!fs.existsSync(articlesDir)) fs.mkdirSync(articlesDir, { recursive: true });

    const seenFile = path.join(dataDir, 'seen.json');
    let seen: string[] = fs.existsSync(seenFile)
        ? JSON.parse(fs.readFileSync(seenFile, 'utf-8'))
        : [];

    const benchmarkFile = path.join(dataDir, 'benchmarks.json');
    let allBenchmarks: any[] = fs.existsSync(benchmarkFile)
        ? JSON.parse(fs.readFileSync(benchmarkFile, 'utf-8'))
        : [];

    let processed = 0;
    let skipped = 0;
    const allUrls = new Set<string>(seen); // dedup within this run too

    for (let qi = 0; qi < SEARCH_QUERIES.length; qi++) {
        const query = SEARCH_QUERIES[qi];
        console.log(`\n[${qi + 1}/${SEARCH_QUERIES.length}] Aranıyor: "${query}"`);

        const results = await tavilySearch(query);
        console.log(`  ${results.length} sonuç bulundu`);

        for (const result of results) {
            const url: string = result.url;
            if (!url || allUrls.has(url)) continue;

            const titleRaw: string = result.title || '';
            const snippetRaw: string = result.content || '';

            // Quick AI relevance pre-check before wasting LLM quota
            if (!isAIRelated(titleRaw, snippetRaw)) {
                console.log(`  ⊘ AI değil, atlandı: ${titleRaw.substring(0, 70)}`);
                allUrls.add(url);
                continue;
            }

            console.log(`  → İşleniyor: ${titleRaw.substring(0, 80)}`);

            try {
                // Fetch full article
                const { text: fullText, imageUrl: crawledImage } = await fetchArticleText(url);
                const imageUrl = crawledImage ||
                    (result.images && result.images.length > 0 ? result.images[0] : undefined);

                const textForLLM = fullText.length > 500
                    ? fullText.substring(0, 15000)
                    : (snippetRaw + ' ' + fullText).substring(0, 15000);

                if (textForLLM.length < 100) {
                    console.log(`    ⚠ Yeterli içerik yok, atlandı`);
                    allUrls.add(url);
                    continue;
                }

                // LLM analizi
                const analysisResult = await provider.analyzeArticle({
                    title: titleRaw,
                    sourceName: result.source || new URL(url).hostname,
                    sourceTier: 'backfill',
                    url,
                    text: textForLLM,
                });

                // Date: Tavily provides published_date
                let articleDate: Date;
                try {
                    articleDate = result.published_date
                        ? new Date(result.published_date)
                        : new Date();
                    if (isNaN(articleDate.getTime())) articleDate = new Date();
                } catch {
                    articleDate = new Date();
                }

                const slug = titleRaw
                    .toLowerCase()
                    .replace(/[^a-z0-9]/g, '-')
                    .replace(/-+/g, '-')
                    .replace(/^-|-$/g, '')
                    .substring(0, 60);

                const article = {
                    ...analysisResult,
                    gorsel_url: imageUrl || null,
                    url,
                    source: result.source || new URL(url).hostname,
                    sourceTier: 'backfill',
                    date: articleDate.toISOString(),
                    slug,
                };

                fs.writeFileSync(
                    path.join(articlesDir, `${slug}.json`),
                    JSON.stringify(article, null, 2)
                );

                allBenchmarks.push(
                    ...(analysisResult.benchmarklar || []).map(b => ({
                        ...b,
                        date: article.date,
                        url: article.url,
                        source: article.source,
                    }))
                );

                allUrls.add(url);
                seen.push(url);
                processed++;

                console.log(`  ✓ Kaydedildi: ${analysisResult.baslik_tr || titleRaw}`);

                // Checkpoint every 10 articles
                if (processed % 10 === 0) {
                    fs.writeFileSync(seenFile, JSON.stringify(seen, null, 2));
                    fs.writeFileSync(benchmarkFile, JSON.stringify(allBenchmarks, null, 2));
                    console.log(`\n  💾 [Checkpoint] ${processed} makale işlendi, kaydedildi.\n`);
                }

                await delay(2000); // LLM rate limit için

            } catch (e: any) {
                console.error(`  ✗ Hata: ${e.message}`);
                skipped++;
            }
        }

        // Sorgu arası kısa bekleme (Tavily rate limit)
        await delay(1000);
    }

    // Final save
    fs.writeFileSync(seenFile, JSON.stringify(seen, null, 2));
    fs.writeFileSync(benchmarkFile, JSON.stringify(allBenchmarks, null, 2));

    console.log(`\n✅ Backfill tamamlandı!`);
    console.log(`   İşlenen: ${processed} makale`);
    console.log(`   Hata: ${skipped}`);
    console.log(`   Toplam seen.json: ${seen.length} URL`);
}

main().catch(console.error);
