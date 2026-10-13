/**
 * Benchmark sıralama listesinin HTML üretimi.
 * Hem sunucuda (ilk görünüm, JS kapalıyken de çalışsın diye) hem tarayıcıda
 * (filtre değişince) aynı fonksiyon kullanılır.
 */

/** Tarayıcıya giden sıkıştırılmış satır */
export interface CEntry {
  b: string;        // benchmark id
  m: string;        // model (temel ad)
  v: string;        // varyant
  k: string;        // model anahtarı
  p: string | null; // sağlayıcı
  s: number;        // skor
  st: string | null; // ayar
  src: string;      // kaynak
  u: string | null; // bağlantı
  d: string | null; // tarih
}

export interface CBench {
  id: string;
  name: string;
  description: string;
  category: string;
  unit: string;
  higherIsBetter: boolean;
  link: string | null;
  modelCount: number;
  entryCount: number;
  sources: string[];
  latestDate: string | null;
  origin: 'canli' | 'haber';
}

export interface ViewOptions {
  best: boolean;
  q: string;
  provider: string;
  limit: number;
}

export function esc(s: unknown): string {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

/** Yalnızca site içi (/...) ve http(s) bağlantılarına izin ver */
export function safeHref(u: string | null | undefined): boolean {
  return !!u && (/^https?:\/\//i.test(u) || (u.startsWith('/') && !u.startsWith('//')));
}

export function fmtScore(n: number, unit: string): string {
  const num = Number.isInteger(n) ? n.toLocaleString('tr-TR') : n.toLocaleString('tr-TR', { maximumFractionDigits: 2 });
  if (unit === '%') return `%${num}`;
  return num;
}

export function unitLabel(unit: string): string {
  if (unit === '%') return 'yüzde';
  return unit;
}

export function fmtDate(d: string | null): string {
  if (!d) return '-';
  const t = new Date(d);
  return isNaN(t.getTime()) ? '-' : t.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Seçili teste göre sıralanmış ve filtrelenmiş satırlar. */
export function rankEntries(all: CEntry[], bench: CBench, opt: Pick<ViewOptions, 'best' | 'provider'>): CEntry[] {
  let rows = all.filter(e => e.b === bench.id);
  if (opt.provider && opt.provider !== 'all') rows = rows.filter(e => (e.p ?? 'Diğer') === opt.provider);
  const dir = bench.higherIsBetter ? -1 : 1;
  rows = [...rows].sort((a, b) => dir * (a.s - b.s) || a.m.localeCompare(b.m));
  if (opt.best) {
    const seen = new Set<string>();
    rows = rows.filter(e => (seen.has(e.k) ? false : (seen.add(e.k), true)));
  }
  return rows;
}

function scale(rows: CEntry[], bench: CBench): (v: number) => number {
  const vals = rows.map(r => r.s);
  const max = Math.max(...vals);
  const min = Math.min(...vals);
  let lo = 0;
  let hi = max;
  if (bench.unit === '%' && max <= 100) hi = 100;
  if (bench.unit.toLowerCase() === 'elo') {
    // ELO'da 0'dan başlamak tüm çubukları eşit gösterir; en düşük skorun biraz altından başla
    lo = Math.floor((min - 25) / 25) * 25;
  }
  const span = hi - lo || 1;
  return v => {
    const pct = ((v - lo) / span) * 100;
    const shown = bench.higherIsBetter ? pct : 100 - pct;
    return Math.max(1.5, Math.min(100, shown));
  };
}

export function renderRows(all: CEntry[], bench: CBench, opt: ViewOptions): { html: string; total: number; shown: number } {
  const ranked = rankEntries(all, bench, opt);
  const q = opt.q.trim().toLocaleLowerCase('tr-TR');
  // Arama sıralamayı değiştirmez: eşleşen satırlar gerçek sıralarıyla gösterilir
  const withRank = ranked.map((e, i) => ({ e, rank: i + 1 }));
  const filtered = q ? withRank.filter(({ e }) => `${e.m} ${e.v} ${e.p ?? ''}`.toLocaleLowerCase('tr-TR').includes(q)) : withRank;
  const visible = filtered.slice(0, opt.limit);
  if (visible.length === 0) {
    return { html: `<p class="lb-empty">Bu filtrelerle eşleşen model yok.</p>`, total: filtered.length, shown: 0 };
  }
  const width = scale(ranked, bench);
  const html = visible.map(({ e, rank }) => {
    const meta = [e.p, e.st].filter(Boolean).map(esc).join(' · ');
    const title = `${e.m}${e.v ? ` (${e.v})` : ''}: ${fmtScore(e.s, bench.unit)} ${bench.unit === '%' ? '' : bench.unit}`.trim();
    return `<li class="lb-row${rank <= 3 ? ` is-top rank-${rank}` : ''}" title="${esc(title)}">
  <span class="lb-rank">${rank}</span>
  <span class="lb-name"><strong>${esc(e.m)}</strong>${e.v ? ` <span class="lb-variant">${esc(e.v)}</span>` : ''}${meta ? `<span class="lb-meta">${meta}</span>` : ''}</span>
  <span class="lb-track" aria-hidden="true"><span class="lb-bar" style="width:${width(e.s).toFixed(1)}%"></span></span>
  <span class="lb-score">${esc(fmtScore(e.s, bench.unit))}</span>
</li>`;
  }).join('');
  return { html, total: filtered.length, shown: visible.length };
}

export function renderTable(all: CEntry[], bench: CBench, opt: ViewOptions): string {
  const ranked = rankEntries(all, bench, opt);
  return ranked.map((e, i) => `<tr>
  <td class="num">${i + 1}</td>
  <td>${esc(e.m)}${e.v ? ` <span class="lb-variant">${esc(e.v)}</span>` : ''}</td>
  <td>${esc(e.p ?? '-')}</td>
  <td class="num">${esc(fmtScore(e.s, bench.unit))}</td>
  <td>${esc(e.st ?? '-')}</td>
  <td>${safeHref(e.u) ? `<a href="${esc(e.u)}"${/^https?:/i.test(e.u!) ? ' target="_blank" rel="noopener noreferrer"' : ''}>${esc(e.src)}</a>` : esc(e.src)}</td>
  <td class="nowrap">${esc(fmtDate(e.d))}</td>
</tr>`).join('');
}
