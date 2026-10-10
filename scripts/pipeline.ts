import fs from 'fs';
import path from 'path';
import axios from 'axios';
import FeedParser from 'feedparser';
import { JSDOM } from 'jsdom';
import { z } from 'zod';
import { GeminiProvider } from './llm/gemini.js';
import { analysisSchema, benchmarkSchema } from './llm/provider.js';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, '..');

// Read config
const sources = JSON.parse(fs.readFileSync(path.join(ROOT, 'config/sources.json'), 'utf-8'));
const keywords = JSON.parse(fs.readFileSync(path.join(ROOT, 'config/keywords.json'), 'utf-8'));
const modelAliases = JSON.parse(fs.readFileSync(path.join(ROOT, 'config/models.json'), 'utf-8'));

const provider = new GeminiProvider();

async function fetchRSS(url: string) {
    const res = await axios.get(url, { responseType: 'stream', headers: { 'User-Agent': 'YoneyBot/1.0' }});
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

    const newArticles = [];
    let allBenchmarks = [];
    const benchmarkFile = path.join(dataDir, 'benchmarks.json');
    if (fs.existsSync(benchmarkFile)) {
        allBenchmarks = JSON.parse(fs.readFileSync(benchmarkFile, 'utf-8'));
    }

    for (const source of sources.filter((s: any) => s.enabled)) {
        console.log(`Fetching ${source.name}...`);
        try {
            const items = isMock ? [] : await fetchRSS(source.url);
            for (const item of items) {
                if (seen.includes(item.link)) continue;
                
                const text = cleanHTML(item.description || "");
                if (!containsKeywords(text) && !containsKeywords(item.title)) {
                    continue; // skip irrelevant
                }

                console.log(`Analyzing: ${item.title}`);
                try {
                    const result = await provider.analyzeArticle({
                        title: item.title,
                        sourceName: source.name,
                        sourceTier: source.tier,
                        url: item.link,
                        text: text.substring(0, 10000) // limit size
                    });

                    // Verification
                    let validBenchmarks = [];
                    for (const b of result.benchmarklar) {
                        if (text.includes(b.skor.toString()) || text.includes(b.skor.toLocaleString('tr-TR'))) {
                            b.model = normalizeModel(b.model);
                            validBenchmarks.push(b);
                        }
                    }
                    result.benchmarklar = validBenchmarks;
                    
                    const slug = item.title.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').substring(0, 50);
                    const article = {
                        ...result,
                        url: item.link,
                        source: source.name,
                        sourceTier: source.tier,
                        date: new Date().toISOString(),
                        slug
                    };

                    fs.writeFileSync(path.join(articlesDir, `${slug}.json`), JSON.stringify(article, null, 2));
                    allBenchmarks.push(...validBenchmarks.map(b => ({...b, date: article.date, url: article.url, source: article.source})));
                    seen.push(item.link);

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
