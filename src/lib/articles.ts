import fs from 'fs';
import path from 'path';

/** Kartlarda gösterilecek kısa kaynak adı: "Reddit LocalLLaMA (Topluluk & Benchmark)" -> "Reddit LocalLLaMA" */
export function sourceLabel(source: unknown): string {
  return String(source ?? '').replace(/\s*\([^)]*\)\s*$/, '');
}

/**
 * data/articles/*.json dosyalarını okur. Bozuk ya da yarım yazılmış bir dosya
 * (ör. birleştirme çakışması) tüm derlemeyi durdurmasın diye atlanır.
 */
let cache: any[] | null = null;
export function loadArticles(root = process.cwd()): any[] {
  if (cache) return cache;
  const dir = path.join(root, 'data', 'articles');
  if (!fs.existsSync(dir)) return (cache = []);
  const out: any[] = [];
  for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.json'))) {
    try {
      const a = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8'));
      if (a && a.slug && a.baslik_tr) out.push(a);
      else console.warn(`[articles] eksik alanlı dosya atlandı: ${f}`);
    } catch (e: any) {
      console.warn(`[articles] okunamayan dosya atlandı: ${f} (${e.message})`);
    }
  }
  out.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  return (cache = out);
}
