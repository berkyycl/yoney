/**
 * Model parametre kartı: altı eksenli altıgen tablo.
 * Her eksende modelin LMArena puanı (ELO) ve o sıralamadaki yeri gösterilir;
 * altıgenin şekli sıralamadaki konuma göre çizilir (ilk sıra en dışta).
 * Hem sunucuda (Astro, set:html) hem tarayıcıda (karşılaştırma sayfası)
 * kullanıldığı için Node'a özgü hiçbir şey içe aktarmaz.
 */

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

export interface AxisResult {
	/** O eksendeki en iyi puan (yoksa null) */
	score: number | null;
	/** Sıralamadaki yeri (1 en iyi) */
	rank: number | null;
	/** O eksende sıralanan model sayısı */
	total: number;
}

export interface StandCard {
	key: string;
	name: string;
	provider: string | null;
	axes: Record<string, AxisResult>;
	/** Eksenlerdeki konumların toplamı (sıralama için) */
	power: number;
	/** Verisi olan eksen sayısı */
	known: number;
}

/** Sıralamadaki konum: 1 = birinci, 0 = sonuncu ya da veri yok */
export function standing(r: AxisResult | undefined): number {
	if (!r || r.rank == null || r.total <= 1) return r && r.rank === 1 ? 1 : 0;
	return 1 - (r.rank - 1) / (r.total - 1);
}

export const fmtScore = (n: number | null) => (n == null ? '—' : Math.round(n).toLocaleString('tr-TR'));

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

export interface ChartSeries {
	card: StandCard;
	/** CSS renk değeri, ör. var(--a2) */
	color: string;
}

/**
 * Altıgen tablo SVG'si. Bir ya da iki seri çizilebilir (karşılaştırma).
 * Köşelerde ilk serinin puanı ve sırası yazar.
 */
export function standSvg(series: ChartSeries[], opts: { size?: number; labels?: boolean; title?: string } = {}): string {
	const size = opts.size ?? 300;
	const labels = opts.labels ?? true;
	const pad = labels ? 64 : 14;
	const R = size / 2 - pad;
	const cx = size / 2, cy = size / 2;
	const pt = (i: number, r: number) => {
		const a = -Math.PI / 2 + (i * Math.PI * 2) / AXES.length;
		return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
	};
	const poly = (r: (i: number) => number) => AXES.map((_, i) => pt(i, r(i)).map(n => n.toFixed(1)).join(',')).join(' ');

	let out = `<svg class="stand-svg" viewBox="0 0 ${size} ${size}" role="img" aria-label="${esc(opts.title ?? 'Parametre tablosu')}">`;
	// Halkalar
	for (let lv = 5; lv >= 1; lv--) {
		out += `<polygon class="st-ring${lv === 5 ? ' st-outer' : ''}" points="${poly(() => (R * lv) / 5)}"/>`;
	}
	// Eksen çizgileri
	AXES.forEach((_, i) => {
		const [x, y] = pt(i, R);
		out += `<line class="st-spoke" x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}"/>`;
	});
	// Seriler: sıralamada üstte olan eksen dışa doğru uzar
	series.forEach((s, si) => {
		const v = (i: number) => {
			const r = s.card.axes[AXES[i].id];
			return r?.score == null ? R * 0.12 : R * (0.22 + 0.78 * standing(r));
		};
		out += `<polygon class="st-shape st-shape-${si}" style="--sc:${s.color}" points="${poly(v)}"/>`;
	});
	// Köşelerde puan ve sıra
	if (labels) {
		const first = series[0]?.card;
		AXES.forEach((ax, i) => {
			const [lx, ly] = pt(i, R + 36);
			const r = first?.axes[ax.id];
			const top = r?.rank === 1 ? ' st-top' : '';
			out += `<g class="st-label${top}"><rect x="${(lx - 26).toFixed(1)}" y="${(ly - 22).toFixed(1)}" width="52" height="24" rx="3"/>` +
				`<text class="st-score" x="${lx.toFixed(1)}" y="${(ly - 10).toFixed(1)}" dy="0.36em">${fmtScore(r?.score ?? null)}</text>` +
				`<text class="st-axis" x="${lx.toFixed(1)}" y="${(ly + 15).toFixed(1)}">${esc(ax.short)}${r?.rank ? ` #${r.rank}` : ''}</text></g>`;
		});
	}
	out += '</svg>';
	return out;
}
