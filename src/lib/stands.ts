/**
 * Benchmark verisinden model parametre kartları üretir. Her eksen için
 * modellerin en iyi skorları sıralanır ve yüzdelik konuma göre A–E notu
 * verilir; o eksende verisi olmayan model "?" alır.
 */
import type { BenchEntry } from './benchmarks';
import { parseModelName } from './models';
import { AXES, GRADE_VALUE, gradeFor, type StandCard } from './standChart';

export function buildStands(entries: BenchEntry[]): StandCard[] {
	const cards = new Map<string, StandCard>();

	for (const axis of AXES) {
		// Eksenin verisi olan ilk benchmark kullanılır
		const benchId = axis.bench.find(b => entries.some(e => e.bench === b));
		if (!benchId) continue;
		const best = new Map<string, BenchEntry>();
		for (const e of entries) {
			if (e.bench !== benchId) continue;
			const cur = best.get(e.key);
			if (!cur || e.score > cur.score) best.set(e.key, e);
		}
		const ranked = [...best.values()].sort((a, b) => b.score - a.score);
		ranked.forEach((e, i) => {
			let card = cards.get(e.key);
			if (!card) {
				card = { key: e.key, name: e.model, provider: e.provider, axes: {}, power: 0, known: 0 };
				cards.set(e.key, card);
			}
			card.axes[axis.id] = { grade: gradeFor(i + 1, ranked.length), score: e.score, rank: i + 1, total: ranked.length };
		});
	}

	for (const card of cards.values()) {
		for (const axis of AXES) {
			if (!card.axes[axis.id]) card.axes[axis.id] = { grade: '?', score: null, rank: null, total: 0 };
			const g = card.axes[axis.id].grade;
			card.power += GRADE_VALUE[g];
			if (g !== '?') card.known++;
		}
	}

	return [...cards.values()]
		.filter(c => c.known >= 3)
		.sort((a, b) => b.power - a.power || (a.axes.guc.rank ?? 1e9) - (b.axes.guc.rank ?? 1e9));
}

/** Haberde adı geçen modelleri parametre kartlarıyla eşleştirir */
export function standsForNames(names: string[], stands: StandCard[], limit = 3): StandCard[] {
	const byKey = new Map(stands.map(s => [s.key, s]));
	const out: StandCard[] = [];
	for (const n of names) {
		const key = parseModelName(String(n)).key;
		const s = byKey.get(key);
		if (s && !out.includes(s)) out.push(s);
		if (out.length >= limit) break;
	}
	return out;
}
