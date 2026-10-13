/**
 * Renk kayması: her bölümün kendi sabit paleti vardır. Palet yalnızca başka
 * bir bölüme geçildiğinde değişir; aynı sayfayı yenilemek ya da aynı bölümde
 * gezinmek rengi değiştirmez. Renk değerleri src/styles/global.css içindedir.
 */
export type Palette =
	| 'altin' | 'menekse' | 'zehir' | 'mercan' | 'gece'
	| 'kan' | 'col' | 'yildiz' | 'morioh' | 'okyanus' | 'denizci';

/** Sayfa zemin renkleri (tarayıcı çubuğu rengi için) */
export const PALETTE_BG: Record<Palette, string> = {
	altin: '#170f33',
	menekse: '#f2dcff',
	zehir: '#0c2a20',
	mercan: '#ffdccb',
	gece: '#0a0a12',
	kan: '#2a0a12',
	col: '#f6e3b8',
	yildiz: '#0e1a3d',
	morioh: '#d8f6ec',
	okyanus: '#08262e',
	denizci: '#e6eefc',
};

/** Haber bölümlerinin paletleri; bölüm sayfası ve o bölümün haberleri aynı paleti kullanır */
export const CATEGORY_PALETTE: Record<string, Palette> = {
	'model-cikisi': 'yildiz',
	guncelleme: 'okyanus',
	benchmark: 'zehir',
	arastirma: 'denizci',
	'fiyat-limit': 'col',
	'arac-sdk': 'kan',
	diger: 'morioh',
};

export function categoryPalette(id: string): Palette {
	return CATEGORY_PALETTE[id] ?? 'altin';
}
