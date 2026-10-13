import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import FeedParser from 'feedparser';
import { JSDOM } from 'jsdom';
import { FallbackLLMProvider } from './llm/fallback.js';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, '..');

// Read config
const sources = JSON.parse(fs.readFileSync(path.join(ROOT, 'config/sources.json'), 'utf-8'));
const keywords = JSON.parse(fs.readFileSync(path.join(ROOT, 'config/keywords.json'), 'utf-8'));

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

/**
 * Anahtar kelimeyi kelime sınırlarıyla arar (çoğul eki ve bitişik sürüm numarası serbest: gpt4o, llama3).
 * Eskiden düz "includes" kullanılıyordu: "rag" -> "storage", "average" gibi
 * alakasız kelimeleri de yakalıyordu.
 */
function keywordRegex(k: string): RegExp {
    const esc = k.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(^|[^a-z0-9])${esc}(s|es|\\d[\\w.]*)?($|[^a-z0-9])`);
}
const KEYWORD_RES: RegExp[] = keywords.map((k: string) => keywordRegex(k));

function containsKeywords(text: string) {
    const lower = text.toLowerCase();
    return KEYWORD_RES.some(re => re.test(lower));
}

/**
 * Checks if an article is genuinely about AI/ML developments.
 * Returns true only if it contains AI-specific keywords AND
 * doesn't appear to be primarily non-AI political/entertainment content.
 */
const AI_RES = AI_REQUIRED_KEYWORDS.map(keywordRegex);
const BLOCK_RES = NON_AI_BLOCKLIST.map(keywordRegex);

export function isAIRelated(title: string, text: string): boolean {
    const combined = (title + ' ' + text).toLowerCase();

    // Must contain at least one strong AI keyword
    const hasAIKeyword = AI_RES.some(re => re.test(combined));
    if (!hasAIKeyword) return false;

    // If title (the most reliable signal) contains blocklist words without AI context, skip
    const titleLower = title.toLowerCase();
    const titleHasBlockword = BLOCK_RES.some(re => re.test(titleLower));
    if (titleHasBlockword) {
        // Only allow if title also has a direct AI keyword
        const titleHasAI = AI_RES.some(re => re.test(titleLower));
        if (!titleHasAI) return false;
    }

    return true;
}

/** Tekrarları yakalamak için URL'yi sadeleştirir (utm parametreleri, sondaki /, http/https). */
export function normalizeUrl(url: string): string {
    try {
        const u = new URL(url);
        u.hash = '';
        for (const k of [...u.searchParams.keys()]) {
            if (/^(utm_|ref$|ref_|source$|fbclid|gclid)/i.test(k)) u.searchParams.delete(k);
        }
        let out = `${u.hostname.replace(/^www\./, '')}${u.pathname.replace(/\/+$/, '')}`;
        const q = u.searchParams.toString();
        if (q) out += `?${q}`;
        return out.toLowerCase();
    } catch {
        return (url || '').trim().toLowerCase();
    }
}

export function makeSlug(title: string): string {
    return (title || 'article')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .substring(0, 60)
        .replace(/-$/, '') || 'article';
}

/**
 * data/redirects.json'daki eski (tekrar eden) haber dosyalarını, korunan sürümü
 * mevcutsa siler. Silinen dosyaları iş akışındaki "git add data/" adımı commit'ler.
 */
export function cleanupRedirectedArticles(articlesDir: string, redirectsFile: string): number {
    if (!fs.existsSync(redirectsFile)) return 0;
    let removed = 0;
    try {
        const map: Record<string, string> = JSON.parse(fs.readFileSync(redirectsFile, 'utf-8'));
        for (const [from, to] of Object.entries(map)) {
            const oldFile = path.join(articlesDir, `${from}.json`);
            const keptFile = path.join(articlesDir, `${to}.json`);
            if (from !== to && fs.existsSync(oldFile) && fs.existsSync(keptFile)) {
                fs.unlinkSync(oldFile);
                removed++;
            }
        }
    } catch (e: any) {
        console.warn(`redirects.json okunamadı: ${e.message}`);
    }
    if (removed) console.log(`Tekrar eden ${removed} eski haber dosyası silindi.`);
    return removed;
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

    cleanupRedirectedArticles(articlesDir, path.join(dataDir, 'redirects.json'));

    const seenFile = path.join(dataDir, 'seen.json');
    const seenList: string[] = fs.existsSync(seenFile) ? JSON.parse(fs.readFileSync(seenFile, 'utf-8')) : [];
    const seen = new Set<string>(seenList.map(normalizeUrl));

    // Daha önce kaydedilmiş haberlerin adresleri de "görüldü" sayılır. Böylece seen.json
    // kaydedilemeden iş kesilse bile aynı haber ikinci kez (farklı dosya adıyla) yazılmaz.
    const slugOwner = new Map<string, string>();
    for (const f of fs.readdirSync(articlesDir).filter(f => f.endsWith('.json'))) {
        try {
            const a = JSON.parse(fs.readFileSync(path.join(articlesDir, f), 'utf-8'));
            if (a.url) seen.add(normalizeUrl(a.url));
            slugOwner.set(f.replace(/\.json$/, ''), normalizeUrl(a.url || ''));
        } catch { /* bozuk dosya */ }
    }
    const markSeen = (link: string) => {
        const n = normalizeUrl(link);
        if (!seen.has(n)) { seen.add(n); seenList.push(link); }
    };
    const saveSeen = () => fs.writeFileSync(seenFile, JSON.stringify(seenList, null, 2));

    // 1 AY (30 GÜN) geriye dönük haberleri al
    const oneMonthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    let processedCount = 0;
    let skippedNotAI = 0;
    let skippedLowValue = 0;
    let skippedPolicy = 0;

    // Benchmark API kaynakları (LMArena, SWE-bench) scripts/fetch-benchmarks.ts tarafından işlenir
    const enabledSources = sources.filter((s: any) => s.enabled && (s.type ?? 'rss') === 'rss');
    console.log(`Processing ${enabledSources.length} enabled RSS sources...`);

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

        // Kaynak başına tur limiti (ör. Reddit'in siteyi doldurmaması için)
        const maxItems: number = typeof source.maxItems === 'number' ? source.maxItems : Infinity;
        let analyzedFromSource = 0;

        for (const item of items) {
            if (!item.link) continue;
            if (analyzedFromSource >= maxItems) {
                console.log(`[${source.name}] Tur limiti (${maxItems}) doldu.`);
                break;
            }

            // Already processed?
            if (seen.has(normalizeUrl(item.link))) continue;

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
            // Yapay zekâ laboratuvarlarının kendi akışları (aiOnly) zaten tamamen YZ içeriklidir;
            // kısa açıklamalı başlıkların ("Building on our commitment to ...") elenmemesi için filtre atlanır.
            // First pass: legacy keyword check (fast)
            if (!source.aiOnly && !containsKeywords(text) && !containsKeywords(item.title || '')) {
                continue; // obviously irrelevant
            }
            // Second pass: strict AI-focus check
            if (!source.aiOnly && !isAIRelated(item.title || '', text)) {
                skippedNotAI++;
                console.log(`  ⊘ Skipped (not AI): ${item.title}`);
                // Still mark as seen so we don't recheck it
                markSeen(item.link);
                continue;
            }

            console.log(`  → Analyzing: ${item.title}`);
            analyzedFromSource++;
            try {
                let fullText = text;
                let imageUrl = extractImageFromRSS(item) || undefined;

                // Web sayfasından tam metin ve görsel meta etiketini çek
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

                const result = await provider.analyzeArticle({
                    title: item.title,
                    sourceName: source.name,
                    sourceTier: source.tier,
                    url: item.link,
                    text: fullText.substring(0, 15000)
                });

                // Politika haberleri sitede yer almıyor -> yayınlama
                if (result.kategori === 'politika') {
                    skippedPolicy++;
                    console.log(`  ⊘ Skipped (politika): ${item.title}`);
                    markSeen(item.link);
                    await delay(1500);
                    continue;
                }

                // Reklam / müşteri başarı hikâyesi / haber değeri olmayan gönderi -> yayınlama
                if (result.onem <= 1) {
                    skippedLowValue++;
                    console.log(`  ⊘ Skipped (low value, önem=1): ${item.title}`);
                    markSeen(item.link);
                    await delay(1500);
                    continue;
                }

                // Benchmark verification: skor kaynak metinde birebir geçmeli.
                // (Model adları burada değil, site derlenirken src/lib/models.ts ile birleştirilir.)
                const validBenchmarks: any[] = [];
                for (const b of result.benchmarklar || []) {
                    try {
                        if (fullText.includes(b.skor.toString()) || fullText.includes(b.skor.toLocaleString('tr-TR'))) {
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

                // Aynı dosya adı başka bir habere aitse sonuna -2, -3 ... ekle
                const baseSlug = makeSlug(item.title);
                let slug = baseSlug;
                for (let n = 2; slugOwner.has(slug) && slugOwner.get(slug) !== normalizeUrl(item.link); n++) {
                    slug = `${baseSlug}-${n}`;
                }

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
                slugOwner.set(slug, normalizeUrl(item.link));
                markSeen(item.link);
                processedCount++;
                console.log(`  ✓ Saved: ${article.baslik_tr || item.title}`);

                // === INCREMENTAL SAVE: survive interruptions ===
                if (processedCount % 5 === 0) {
                    saveSeen();
                    console.log(`  [Checkpoint] Saved progress (${processedCount} articles)`);
                }

                await delay(1500);

            } catch (e: any) {
                console.error(`  ✗ Failed to analyze "${item.title}": ${e.message}`);
                // Don't add to seen — we may retry next run
            }
        }
    }

    console.log(`\nPipeline summary: ${processedCount} processed, ${skippedNotAI} skipped (non-AI), ${skippedLowValue} skipped (low value), ${skippedPolicy} skipped (politika)`);

    // Final save. Not: haberlerdeki benchmark skorları artık benchmarks.json'a yazılmıyor;
    // site derlenirken doğrudan data/articles/*.json dosyalarından okunuyor.
    saveSeen();
    console.log("Pipeline finished.");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    runPipeline(process.argv.includes('--mock')).catch(console.error);
}
