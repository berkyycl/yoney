import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, '..');
const articlesDir = path.join(ROOT, 'data', 'articles');

const TAVILY_API_KEY = process.env.TAVILY_API_KEY;

if (!TAVILY_API_KEY) {
    console.error("TAVILY_API_KEY is not defined in .env!");
    process.exit(1);
}

async function searchImageForArticle(title: string, keywords: string[] = []): Promise<string | null> {
    try {
        const query = `${title} ${keywords.slice(0, 2).join(' ')} AI tech`;
        const res = await axios.post('https://api.tavily.com/search', {
            api_key: TAVILY_API_KEY,
            query: query.substring(0, 200),
            include_images: true,
            max_results: 3
        }, { timeout: 10000 });

        if (res.data && res.data.images && res.data.images.length > 0) {
            // Find a valid image url
            for (const img of res.data.images) {
                if (typeof img === 'string' && img.startsWith('http')) {
                    return img;
                }
            }
        }
    } catch (e: any) {
        console.error(`Tavily image search failed for "${title}":`, e.response?.data || e.message);
    }
    return null;
}

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

async function main() {
    const files = fs.readdirSync(articlesDir).filter(f => f.endsWith('.json'));
    console.log(`Toplam ${files.length} haber taranıyor...`);

    let updatedCount = 0;

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const filePath = path.join(articlesDir, file);
        const article = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

        if (!article.gorsel_url) {
            console.log(`[${i + 1}/${files.length}] Görsel aranıyor: ${article.baslik_tr || article.title}`);
            const queryTitle = article.title || article.baslik_tr;
            const img = await searchImageForArticle(queryTitle, article.etiketler || []);

            if (img) {
                article.gorsel_url = img;
                fs.writeFileSync(filePath, JSON.stringify(article, null, 2));
                console.log(`  -> Görsel eklendi: ${img.substring(0, 80)}...`);
                updatedCount++;
            } else {
                console.log(`  -> Görsel bulunamadı.`);
            }
            await delay(400); // polite rate limit
        } else {
            console.log(`[${i + 1}/${files.length}] Zaten görsel var: ${article.baslik_tr}`);
        }
    }

    console.log(`Bitti! Toplam ${updatedCount} habere Tavily üzerinden görsel eklendi.`);
}

main().catch(console.error);
