/**
 * fix-images.ts — Görseli olmayan ya da artık açılmayan haberlere görsel bulur.
 *
 * data/articles/*.json içindeki her haberin gorsel_url'si denetlenir; adres yoksa
 * veya görsel döndürmüyorsa sırasıyla haber sayfasının og:image'ı, okuyucu vekil
 * üzerinden og:image ve (TAVILY_API_KEY varsa) Tavily denenir. Bulunamazsa
 * gorsel_url boşaltılır; site o haberde bölüm renklerinden bir kapak gösterir.
 *
 * Kullanım: npx tsx scripts/fix-images.ts [--dry]
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { JSDOM } from 'jsdom';
import { fileURLToPath } from 'url';
import { isUsableImage, pickImage } from './images.ts';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(ROOT, 'data', 'articles');
const dry = process.argv.includes('--dry');

async function pageOgImage(url: string): Promise<string | null> {
    try {
        const res = await axios.get(url, {
            timeout: 10000,
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
        });
        const doc = new JSDOM(res.data).window.document;
        const og = doc.querySelector('meta[property="og:image"]')?.getAttribute('content')
            || doc.querySelector('meta[name="twitter:image"]')?.getAttribute('content');
        return og && og.startsWith('http') ? og : null;
    } catch {
        return null;
    }
}

async function main() {
    const files = fs.readdirSync(DIR).filter(f => f.endsWith('.json'));
    let checked = 0, fixed = 0, cleared = 0;
    const queue = [...files];

    async function worker() {
        while (queue.length) {
            const f = queue.shift()!;
            const file = path.join(DIR, f);
            let a: any;
            try { a = JSON.parse(fs.readFileSync(file, 'utf-8')); } catch { continue; }
            if (!a?.url) continue;
            checked++;
            if (a.gorsel_url && await isUsableImage(a.gorsel_url)) continue;

            const img = await pickImage([await pageOgImage(a.url)], a.url, a.baslik_tr ? `${a.baslik_tr} artificial intelligence` : undefined);
            if (img === (a.gorsel_url ?? null)) continue;
            console.log(`${img ? '✓' : '✗'} ${f}\n    ${a.gorsel_url ?? '(yok)'}\n -> ${img ?? '(bulunamadı)'}`);
            if (img) fixed++; else if (a.gorsel_url) cleared++;
            if (!dry) {
                a.gorsel_url = img;
                fs.writeFileSync(file, JSON.stringify(a, null, 2));
            }
        }
    }

    await Promise.all(Array.from({ length: 4 }, worker));
    console.log(`\n${checked} haber denetlendi: ${fixed} görsel bulundu, ${cleared} bozuk adres temizlendi${dry ? ' (deneme, dosyalar değişmedi)' : ''}.`);
}

main().catch(e => {
    console.error(e);
    process.exitCode = 1;
});
