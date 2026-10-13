/**
 * Haber görseli bulma ve doğrulama.
 *
 * Adaylar sırayla denenir; ilk "gerçekten görsel olan" adres kullanılır:
 *   RSS'teki görsel -> sayfanın og:image'ı -> LLM'in önerdiği görsel ->
 *   okuyucu vekil (r.jina.ai) üzerinden og:image (bot engelleyen siteler için,
 *   ör. openai.com) -> Tavily görsel araması.
 * Bir adres ancak görsel türünde (image/*) yanıt veriyorsa kabul edilir; böylece
 * HTML sayfası döndüren "görsel" adresleri ve 403/404 veren bağlantılar elenir.
 */
import axios from 'axios';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// Görsel gibi görünen ama tarayıcıya HTML döndüren adresler
const BAD_IMAGE_HOSTS = /(^|\.)(lookaside\.instagram\.com|lookaside\.fbsbx\.com)$/i;

export async function isUsableImage(url?: string | null): Promise<boolean> {
    if (!url || !/^https?:\/\//i.test(url)) return false;
    try {
        if (BAD_IMAGE_HOSTS.test(new URL(url).hostname)) return false;
    } catch {
        return false;
    }
    try {
        const res = await axios.get(url, {
            responseType: 'stream',
            timeout: 8000,
            maxRedirects: 4,
            headers: { 'User-Agent': UA, 'Accept': 'image/avif,image/webp,image/*,*/*;q=0.8', 'Range': 'bytes=0-1023' },
            validateStatus: s => s >= 200 && s < 300,
        });
        const type = String(res.headers['content-type'] || '');
        res.data?.destroy?.();
        return /^image\//i.test(type);
    } catch {
        return false;
    }
}

/** Sayfanın og:image'ını okuyucu vekil üzerinden okur (doğrudan erişimi engelleyen siteler için) */
export async function ogImageViaReader(pageUrl: string): Promise<string | null> {
    try {
        const res = await axios.get(`https://r.jina.ai/${pageUrl}`, {
            timeout: 20000,
            headers: { 'X-Return-Format': 'html' },
            responseType: 'text',
        });
        const html = String(res.data || '');
        const m = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
            || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
        return m ? m[1].replace(/&amp;/g, '&') : null;
    } catch {
        return null;
    }
}

export async function searchImageWithTavily(query: string): Promise<string | null> {
    const apiKey = process.env.TAVILY_API_KEY;
    if (!apiKey) return null;
    try {
        const res = await axios.post('https://api.tavily.com/search', {
            api_key: apiKey,
            query: query.substring(0, 200),
            include_images: true,
            max_results: 3
        }, { timeout: 8000 });
        for (const img of res.data?.images ?? []) {
            if (typeof img === 'string' && img.startsWith('http')) return img;
        }
    } catch {
        // Tavily görsel araması sessizce başarısız olabilir
    }
    return null;
}

/**
 * Bir haber için kullanılabilir ilk görseli döndürür.
 * candidates: elde zaten olan adaylar (RSS, og:image, LLM önerisi), öncelik sırasıyla.
 */
export async function pickImage(candidates: (string | null | undefined)[], pageUrl: string, query?: string): Promise<string | null> {
    const seen = new Set<string>();
    for (const c of candidates) {
        if (!c || seen.has(c)) continue;
        seen.add(c);
        if (await isUsableImage(c)) return c;
    }
    const viaReader = await ogImageViaReader(pageUrl);
    if (viaReader && !seen.has(viaReader) && await isUsableImage(viaReader)) return viaReader;
    if (query) {
        const tavily = await searchImageWithTavily(query);
        if (tavily && await isUsableImage(tavily)) return tavily;
    }
    return null;
}
