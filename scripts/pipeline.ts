import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import FeedParser from 'feedparser';
import { JSDOM } from 'jsdom';
import { z } from 'zod';
import { FallbackLLMProvider } from './llm/fallback.js';
import { analysisSchema, benchmarkSchema } from './llm/provider.js';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, '..');

// Read config
const sources = JSON.parse(fs.readFileSync(path.join(ROOT, 'config/sources.json'), 'utf-8'));
const keywords = JSON.parse(fs.readFileSync(path.join(ROOT, 'config/keywords.json'), 'utf-8'));
const modelAliases = JSON.parse(fs.readFileSync(path.join(ROOT, 'config/models.json'), 'utf-8'));

const provider = new FallbackLLMProvider();

async function fetchRSS(url: string) {
    const res = await axios.get(url, { 
        responseType: 'stream', 
        headers: { 
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'application/rss+xml, application/xml, text/xml, */*'
        },
        timeout: 10000
    });
    const feedparser = new FeedParser({});
    res.data.pipe(feedparser);
    const items: any[] = [];
    return new Promise<any[]>((resolve, reject) => {
        feedparser.on('readable', function () {
            let item;
            while (item = this.read()) {
                items.push(item);
            }
        });
        feedparser.on('end', () => resolve(items));
        feedparser.on('error', reject);
    });
}

function cleanHTML(html: string) {
    const dom = new JSDOM(html);
    return dom.window.document.body.textContent || "";
}

function extractImageFromRSS(item: any): string | null {
    // 1. Check enclosures
    if (item.enclosures && item.enclosures.length > 0) {
        for (const enc of item.enclosures) {
            if (enc.type && enc.type.startsWith('image/')) return enc.url;
            if (enc.url && (enc.url.endsWith('.jpg') || enc.url.endsWith('.png') || enc.url.endsWith('.webp') || enc.url.endsWith('.jpeg'))) {
                return enc.url;
            }
        }
    }
    // 2. Check media:content / media:thumbnail
    if (item['media:content'] && item['media:content']['@'] && item['media:content']['@'].url) {
        return item['media:content']['@'].url;
    }
    if (item['media:thumbnail'] && item['media:thumbnail']['@'] && item['media:thumbnail']['@'].url) {
        return item['media:thumbnail']['@'].url;
    }
    // 3. Check HTML description for <img>
    const html = item.description || item.summary || item['content:encoded'] || "";
    if (html.includes('<img')) {
        const dom = new JSDOM(html);
        const img = dom.window.document.querySelector('img');
        if (img && img.src && !img.src.includes('avatar') && !img.src.includes('icon') && !img.src.includes('pixel')) {
            return img.src;
        }
    }
    return null;
}

async function fetchFullArticleAndMeta(url: string): Promise<{ text: string; imageUrl?: string }> {
    try {
        const res = await axios.get(url, {
            headers: { 
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
            },
            timeout: 7000
        });
        const dom = new JSDOM(res.data);
        const doc = dom.window.document;

        // Extract OpenGraph / Twitter Image
        let imageUrl: string | undefined;
        const ogImage = doc.querySelector('meta[property="og:image"]')?.getAttribute('content') ||
                        doc.querySelector('meta[name="twitter:image"]')?.getAttribute('content');
        if (ogImage && ogImage.startsWith('http')) {
            imageUrl = ogImage;
        }

        // Clean text
        doc.querySelectorAll('script, style, noscript, nav, footer, header').forEach(el => el.remove());
        const mainEl = doc.querySelector('article') || doc.querySelector('main') || doc.body;
        const text = mainEl.textContent?.replace(/\s+/g, ' ').trim() || "";

        return { text: text.length > 500 ? text : "", imageUrl };
    } catch (e) {
        // Direct fetch failed, fallback to reader proxy
    }

    try {
        const proxyRes = await axios.get(`https://r.jina.ai/${url}`, { timeout: 8000 });
        if (proxyRes.data && proxyRes.data.length > 300) {
            return { text: proxyRes.data };
        }
    } catch (e) {
        // proxy fallback failed
    }

    return { text: "" };
}

async function searchImageWithTavily(query: string): Promise<string | null> {
    const apiKey = process.env.TAVILY_API_KEY;
    if (!apiKey) return null;
    try {
        const res = await axios.post('https://api.tavily.com/search', {
            api_key: apiKey,
            query: query.substring(0, 200),
            include_images: true,
            max_results: 3
        }, { timeout: 8000 });
        if (res.data && res.data.images && res.data.images.length > 0) {
            for (const img of res.data.images) {
                if (typeof img === 'string' && img.startsWith('http')) return img;
            }
        }
    } catch (e) {
        // Tavily image lookup failed silently
    }
    return null;
}

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

// AI-specific keywords that MUST appear
const AI_REQUIRED_KEYWORDS = [
    'artificial intelligence', 'machine learning', 'deep learning', 'large language model',
    'llm', 'neural network', 'generative ai', 'gpt', 'gemini', 'claude', 'llama', 'mistral',
    'grok', 'openai', 'anthropic', 'deepmind', 'hugging face', 'transformer', 'diffusion',
    'chatbot', 'chatgpt', 'ai model', 'foundation model', 'language model', 'benchmark',
    'multimodal', 'fine-tuning', 'inference', 'open-source ai', 'open weights', 'swe-bench',
    'mmlu', 'rlhf', 'alignment', 'hallucination', 'vector database', 'embedding', 'rag',
    'retrieval augmented', 'context window', 'token', 'parameter', 'gpu cluster',
    'compute', 'training run', 'model release', 'ai research', 'ai safety', 'ai regulation',
    'nvidia', 'amd gpu', 'tpu', 'ai chip', 'ai hardware', 'agentic', 'copilot', 'cursor',
    'stable diffusion', 'midjourney', 'dall-e', 'sora', 'veo', 'imagen', 'whisper',
    'speech recognition', 'text-to-image', 'text-to-video', 'ai agent', 'autonomous agent'
];

// Keywords that indicate NON-AI political/unrelated content — block these
const NON_AI_BLOCKLIST = [
    'election', 'congress', 'senate', 'president', 'democrat', 'republican',
    'vote', 'voting', 'ballot', 'campaign', 'politician', 'governor', 'parliament',
    'sports', 'football', 'basketball', 'soccer', 'nfl', 'nba', 'mlb', 'nhl',
    'celebrity', 'oscar', 'grammy', 'emmy', 'box office', 'movie review',
    'stock market', 'crypto price', 'bitcoin price', 'ethereum price',
    'weather', 'earthquake', 'hurricane', 'flood',
    'fashion', 'beauty', 'makeup', 'skincare', 'recipe', 'cooking'
];

function containsKeywords(text: string) {
    const lower = text.toLowerCase();
    return keywords.some((k: string) => lower.includes(k));
}

/**
 * Checks if an article is genuinely about AI/ML developments.
 * Returns true only if it contains AI-specific keywords AND
 * doesn't appear to be primarily non-AI political/entertainment content.
 */
function isAIRelated(title: string, text: string): boolean {
    const combined = (title + ' ' + text).toLowerCase();

    // Must contain at least one strong AI keyword
    const hasAIKeyword = AI_REQUIRED_KEYWORDS.some(k => combined.includes(k));
    if (!hasAIKeyword) return false;

    // If title (the most reliable signal) contains blocklist words without AI context, skip
    const titleLower = title.toLowerCase();
    const titleHasBlockword = NON_AI_BLOCKLIST.some(k => titleLower.includes(k));
    if (titleHasBlockword) {
        // Only allow if title also has a direct AI keyword
        const titleHasAI = AI_REQUIRED_KEYWORDS.some(k => titleLower.includes(k));
        if (!titleHasAI) return false;
    }

    return true;
}

function normalizeModel(modelName: string) {
    const lower = modelName.toLowerCase();
    for (const [canonical, aliases] of Object.entries(modelAliases)) {
        if ((aliases as string[]).map(a => a.toLowerCase()).includes(lower)) {
            return canonical;
        }
    }
    return modelName;
}

export async function runPipeline(isMock = false) {
    console.log("Starting pipeline...");
    if (!process.env.GROQ_API_KEY && !process.env.GEMINI_API_KEY && !isMock) {
        console.warn("UYARI: GROQ_API_KEY veya GEMINI_API_KEY ortam değişkeni tanımlı değil!");
    }
    
    // Ensure dirs
    const dataDir = path.join(ROOT, 'data');
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);
    const articlesDir = path.join(dataDir, 'articles');
    if (!fs.existsSync(articlesDir)) fs.mkdirSync(articlesDir);

    let seen: string[] = [];
    const seenFile = path.join(dataDir, 'seen.json');
    if (fs.existsSync(seenFile)) {
        seen = JSON.parse(fs.readFileSync(seenFile, 'utf-8'));
    }

    let allBenchmarks = [];
    const benchmarkFile = path.join(dataDir, 'benchmarks.json');
    if (fs.existsSync(benchmarkFile)) {
        allBenchmarks = JSON.parse(fs.readFileSync(benchmarkFile, 'utf-8'));
    }

    // 1 AY (30 GÜN) geriye dönük haberleri al
    const oneMonthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    let processedCount = 0;
    let skippedNotAI = 0;

    const enabledSources = sources.filter((s: any) => s.enabled);
    console.log(`Processing ${enabledSources.length} enabled sources...`);

    for (const source of enabledSources) {
        console.log(`\n[${source.name}] Fetching RSS...`);
        let items: any[] = [];
        try {
            items = isMock ? [] : await fetchRSS(source.url);
            console.log(`[${source.name}] Found ${items.length} items`);
        } catch (e: any) {
            console.error(`[${source.name}] RSS fetch failed: ${e.message}`);
            continue; // move on to next source
        }

        for (const item of items) {
            // Already processed?
            if (seen.includes(item.link)) continue;

            // Date filter — son 30 gün
            let itemDate: Date;
            try {
                const rawDate = item.pubdate || item.date || item.published || item['dc:date'];
                itemDate = rawDate ? new Date(rawDate) : new Date();
                if (isNaN(itemDate.getTime())) itemDate = new Date();
            } catch {
                itemDate = new Date();
            }
            if (itemDate < oneMonthAgo) continue;

            const rawText = item.description || item.summary || item['content:encoded'] || item.title || "";
            const text = cleanHTML(rawText);

            // === AI RELEVANCE FILTER ===
            // First pass: legacy keyword check (fast)
            if (!containsKeywords(text) && !containsKeywords(item.title || '')) {
                continue; // obviously irrelevant
            }
            // Second pass: strict AI-focus check
            if (!isAIRelated(item.title || '', text)) {
                skippedNotAI++;
                console.log(`  ⊘ Skipped (not AI): ${item.title}`);
                // Still mark as seen so we don't recheck it
                seen.push(item.link);
                continue;
            }

            console.log(`  → Analyzing: ${item.title}`);
            try {
                let fullText = text;
                let imageUrl = extractImageFromRSS(item) || undefined;

                // Web sayfasından tam metin ve görsel meta etiketini çek
                if (item.link) {
                    try {
                        const crawled = await fetchFullArticleAndMeta(item.link);
                        if (crawled.text && crawled.text.length > fullText.length) {
                            fullText = crawled.text;
                        }
                        if (!imageUrl && crawled.imageUrl) {
                            imageUrl = crawled.imageUrl;
                        }
                    } catch (crawlErr: any) {
                        console.warn(`    Crawl failed for ${item.link}: ${crawlErr.message}`);
                    }
                }

                const result = await provider.analyzeArticle({
                    title: item.title,
                    sourceName: source.name,
                    sourceTier: source.tier,
                    url: item.link,
                    text: fullText.substring(0, 15000)
                });

                // Benchmark verification
                let validBenchmarks: any[] = [];
                for (const b of result.benchmarklar || []) {
                    try {
                        if (fullText.includes(b.skor.toString()) || fullText.includes(b.skor.toLocaleString('tr-TR'))) {
                            b.model = normalizeModel(b.model);
                            validBenchmarks.push(b);
                        }
                    } catch { /* skip bad benchmark entry */ }
                }
                result.benchmarklar = validBenchmarks;

                if (!imageUrl) {
                    try {
                        const tavilyImg = await searchImageWithTavily(`${item.title} artificial intelligence`);
                        if (tavilyImg) imageUrl = tavilyImg;
                    } catch { /* image search failed */ }
                }

                const slug = (item.title || 'article')
                    .toLowerCase()
                    .replace(/[^a-z0-9]/g, '-')
                    .replace(/-+/g, '-')
                    .replace(/^-|-$/g, '')
                    .substring(0, 60);

                const article = {
                    ...result,
                    gorsel_url: imageUrl || (result.gorseller && result.gorseller.length > 0 ? result.gorseller[0] : null),
                    url: item.link,
                    source: source.name,
                    sourceTier: source.tier,
                    date: itemDate.toISOString(),
                    slug
                };

                fs.writeFileSync(path.join(articlesDir, `${slug}.json`), JSON.stringify(article, null, 2));
                allBenchmarks.push(...validBenchmarks.map(b => ({ ...b, date: article.date, url: article.url, source: article.source })));
                seen.push(item.link);
                processedCount++;
                console.log(`  ✓ Saved: ${article.baslik_tr || item.title}`);

                // === INCREMENTAL SAVE: survive interruptions ===
                // Save every 5 articles so progress isn't lost if pipeline is killed
                if (processedCount % 5 === 0) {
                    fs.writeFileSync(seenFile, JSON.stringify(seen, null, 2));
                    fs.writeFileSync(benchmarkFile, JSON.stringify(allBenchmarks, null, 2));
                    console.log(`  [Checkpoint] Saved progress (${processedCount} articles)`);
                }

                await delay(1500);

            } catch (e: any) {
                console.error(`  ✗ Failed to analyze "${item.title}": ${e.message}`);
                // Don't add to seen — we may retry next run
            }
        }
    }

    console.log(`\nPipeline summary: ${processedCount} processed, ${skippedNotAI} skipped (non-AI)`);


    // Final save
    fs.writeFileSync(seenFile, JSON.stringify(seen, null, 2));
    fs.writeFileSync(benchmarkFile, JSON.stringify(allBenchmarks, null, 2));
    console.log("Pipeline finished.");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    runPipeline(process.argv.includes('--mock')).catch(console.error);
}
