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

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

function containsKeywords(text: string) {
    const lower = text.toLowerCase();
    return keywords.some((k: string) => lower.includes(k));
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

    for (const source of sources.filter((s: any) => s.enabled)) {
        console.log(`Fetching ${source.name}...`);
        try {
            const items = isMock ? [] : await fetchRSS(source.url);
            for (const item of items) {
                if (seen.includes(item.link)) continue;
                
                // Son 30 gün kontrolü
                const itemDate = item.pubdate || item.date ? new Date(item.pubdate || item.date) : new Date();
                if (itemDate < oneMonthAgo) continue;

                const rawText = item.description || item.summary || item['content:encoded'] || item.title || "";
                const text = cleanHTML(rawText);
                if (!containsKeywords(text) && !containsKeywords(item.title)) {
                    continue; // skip irrelevant
                }

                console.log(`Analyzing: ${item.title} (Kaynak: ${source.name})`);
                try {
                    let fullText = text;
                    let imageUrl = extractImageFromRSS(item) || undefined;

                    // Web sayfasından tam metin ve görsel meta etiketini çek
                    if (item.link) {
                        const crawled = await fetchFullArticleAndMeta(item.link);
                        if (crawled.text && crawled.text.length > text.length) {
                            fullText = crawled.text;
                        }
                        if (!imageUrl && crawled.imageUrl) {
                            imageUrl = crawled.imageUrl;
                        }
                    }

                    const result = await provider.analyzeArticle({
                        title: item.title,
                        sourceName: source.name,
                        sourceTier: source.tier,
                        url: item.link,
                        text: fullText.substring(0, 15000)
                    });

                    // Verification
                    let validBenchmarks = [];
                    for (const b of result.benchmarklar) {
                        if (fullText.includes(b.skor.toString()) || fullText.includes(b.skor.toLocaleString('tr-TR'))) {
                            b.model = normalizeModel(b.model);
                            validBenchmarks.push(b);
                        }
                    }
                    result.benchmarklar = validBenchmarks;
                    
                    const slug = item.title.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').substring(0, 50);
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
                    allBenchmarks.push(...validBenchmarks.map(b => ({...b, date: article.date, url: article.url, source: article.source})));
                    seen.push(item.link);
                    console.log(`✓ Kaydedildi: ${article.baslik_tr}`);
                    await delay(1500);

                } catch (e) {
                    console.error(`Failed to analyze ${item.title}:`, e);
                }
            }
        } catch (e) {
            console.error(`Failed to fetch ${source.name}:`, e);
        }
    }

    fs.writeFileSync(seenFile, JSON.stringify(seen, null, 2));
    fs.writeFileSync(benchmarkFile, JSON.stringify(allBenchmarks, null, 2));
    console.log("Pipeline finished.");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    runPipeline(process.argv.includes('--mock')).catch(console.error);
}
