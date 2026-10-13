// @ts-check
import { defineConfig } from 'astro/config';
import fs from 'node:fs';

// Tekrar eden haberler temizlendiğinde silinen eski adresler korunan habere yönlendirilir
// (data/redirects.json: { "eski-slug": "yeni-slug" }).
/** @type {Record<string, string>} */
const redirects = {};
try {
  const map = JSON.parse(fs.readFileSync(new URL('./data/redirects.json', import.meta.url), 'utf-8'));
  for (const [from, to] of Object.entries(map)) {
    // Eski dosya hâlâ duruyorsa (henüz temizlenmediyse) sayfa çakışmasın diye yönlendirme ekleme
    if (fs.existsSync(new URL(`./data/articles/${from}.json`, import.meta.url))) continue;
    redirects[`/haber/${from}`] = `/haber/${to}`;
  }
} catch {
  // dosya yoksa yönlendirme yok
}

// https://astro.build/config
export default defineConfig({
  site: 'https://yoney.dev',
  redirects,
});
