/**
 * Haberlerde adı geçen modeller. Yalnızca sürüm numarası içeren adlar sayılır
 * ("Claude", "ChatGPT", "llama.cpp" gibi genel adlar elenir); farklı yazımlar
 * src/lib/models.ts ile aynı modele bağlanır.
 */
import { parseModelName } from './models';

export interface Mention {
	key: string;
	name: string;
	provider: string | null;
	count: number;
}

/** Bir haberde adı geçen modellerin anahtarları (her model bir kez) */
export function articleModelKeys(article: any): string[] {
	const keys = new Set<string>();
	for (const raw of article?.anilan_modeller ?? []) {
		const name = String(raw);
		if (!/\d/.test(name)) continue;
		const key = parseModelName(name).key;
		if (key) keys.add(key);
	}
	return [...keys];
}

/** En yeni haberden geriye doğru `days` gün içinde adı geçen modeller, çoktan aza */
export function modelMentions(articles: any[], days = 14): Mention[] {
	const time = (a: any) => new Date(a.date).getTime();
	const newest = articles.length ? Math.max(...articles.map(time)) : 0;
	const out = new Map<string, Mention>();
	for (const a of articles) {
		if (newest - time(a) > days * 864e5) continue;
		for (const raw of a.anilan_modeller ?? []) {
			const name = String(raw);
			if (!/\d/.test(name)) continue;
			const p = parseModelName(name);
			if (!p.key) continue;
			const cur = out.get(p.key);
			if (cur) {
				// Aynı haberde aynı model iki kez yazılmışsa bir kez say
				if ((cur as any)._last === a.slug) continue;
				cur.count++;
				(cur as any)._last = a.slug;
			} else {
				const m: Mention & { _last?: string } = { key: p.key, name: p.base, provider: p.provider, count: 1, _last: a.slug };
				out.set(p.key, m);
			}
		}
	}
	return [...out.values()]
		.map(({ key, name, provider, count }) => ({ key, name, provider, count }))
		.sort((a, b) => b.count - a.count);
}
