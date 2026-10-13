/**
 * Model parametre kartı: altı eksenli altıgen tablo ve A–E notları.
 * Hem sunucuda (Astro, set:html) hem tarayıcıda (karşılaştırma sayfası)
 * kullanıldığı için Node'a özgü hiçbir şey içe aktarmaz.
 */

export type Grade = 'A' | 'B' | 'C' | 'D' | 'E' | '?';

export interface Axis {
	id: string;
	label: string;
	short: string;
	/** Öncelik sırasıyla denenecek benchmark kimlikleri */
	bench: string[];
}

export const AXES: Axis[] = [
	{ id: 'guc', label: 'Genel güç', short: 'Güç', bench: ['lmarena-text'] },
	{ id: 'kod', label: 'Kodlama', short: 'Kod', bench: ['lmarena-coding', 'lmarena-webdev'] },
	{ id: 'akil', label: 'Zor görevler', short: 'Akıl', bench: ['lmarena-hard', 'lmarena-math'] },
	{ id: 'yaratici', label: 'Yaratıcılık', short: 'Yaratıcılık', bench: ['lmarena-creative'] },
	{ id: 'uzman', label: 'Uzmanlık', short: 'Uzmanlık', bench: ['lmarena-expert'] },
	{ id: 'gorme', label: 'Görme', short: 'Görme', bench: ['lmarena-vision'] },
];

export const GRADE_VALUE: Record<Grade, number> = { A: 5, B: 4, C: 3, D: 2, E: 1, '?': 0 };

export interface AxisResult {
	grade: Grade;
	score: number | null;
	rank: number | null;
	total: number;
}

export interface StandCard {
	key: string;
	name: string;
	provider: string | null;
	axes: Record<string, AxisResult>;
	/** Notların toplamı (sıralama için) */
	power: number;
	known: number;
}

/** Sıralamadaki yüzdelik konuma göre not: ilk %10 A, %10–30 B, %30–55 C, %55–80 D, gerisi E */
export function gradeFor(rank: number, total: number): Grade {
	const p = (rank - 1) / Math.max(1, total);
	if (p < 0.1) return 'A';
	if (p < 0.3) return 'B';
	if (p < 0.55) return 'C';
	if (p < 0.8) return 'D';
	return 'E';
}

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

export interface ChartSeries {
	card: StandCard;
	/** CSS renk değeri, ör. var(--a2) */
	color: string;
}

/**
 * Altıgen tablo SVG'si. Bir ya da iki seri çizilebilir (karşılaştırma).
 * Notlar yalnızca ilk seri için köşelerdeki dairelerde yazılır.
 */
export function standSvg(series: ChartSeries[], opts: { size?: number; labels?: boolean; title?: string } = {}): string {
	const size = opts.size ?? 300;
	const labels = opts.labels ?? true;
	const pad = labels ? 62 : 14;
	const R = size / 2 - pad;
	const cx = size / 2, cy = size / 2;
	const pt = (i: number, r: number) => {
		const a = -Math.PI / 2 + (i * Math.PI * 2) / AXES.length;
		return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
	};
	const poly = (r: (i: number) => number) => AXES.map((_, i) => pt(i, r(i)).map(n => n.toFixed(1)).join(',')).join(' ');

	let out = `<svg class="stand-svg" viewBox="0 0 ${size} ${size}" role="img" aria-label="${esc(opts.title ?? 'Parametre tablosu')}">`;
	// Halkalar (E..A)
	for (let lv = 5; lv >= 1; lv--) {
		out += `<polygon class="st-ring${lv === 5 ? ' st-outer' : ''}" points="${poly(() => (R * lv) / 5)}"/>`;
	}
	// Eksen çizgileri
	AXES.forEach((_, i) => {
		const [x, y] = pt(i, R);
		out += `<line class="st-spoke" x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}"/>`;
	});
	// Seriler
	series.forEach((s, si) => {
		const v = (i: number) => (R * Math.max(0.35, GRADE_VALUE[s.card.axes[AXES[i].id]?.grade ?? '?'])) / 5;
		out += `<polygon class="st-shape st-shape-${si}" style="--sc:${s.color}" points="${poly(v)}"/>`;
	});
	// Etiketler ve notlar
	if (labels) {
		const first = series[0]?.card;
		AXES.forEach((ax, i) => {
			const [lx, ly] = pt(i, R + 34);
			const grade = first?.axes[ax.id]?.grade ?? '?';
			out += `<g class="st-label"><circle cx="${lx.toFixed(1)}" cy="${(ly - 8).toFixed(1)}" r="15"/>` +
				`<text class="st-grade" x="${lx.toFixed(1)}" y="${(ly - 8).toFixed(1)}" dy="0.36em">${grade}</text>` +
				`<text class="st-axis" x="${lx.toFixed(1)}" y="${(ly + 20).toFixed(1)}">${esc(ax.short)}</text></g>`;
		});
	}
	out += '</svg>';
	return out;
}
