/**
 * fetch-benchmarks.ts — Canlı benchmark liderlik tablolarını çeker ve
 * data/benchmarks.json dosyasına yazar.
 *
 * Kaynaklar:
 *  - LMArena (Hugging Face: lmarena-ai/leaderboard-dataset)
 *      text_style_control: genel + kodlama, matematik, yaratıcı yazım, zor istemler ... kategorileri
 *      vision, webdev:     genel sıralama
 *  - SWE-bench Verified (resmi GitHub verisi)
 *
 * Haberlerden çıkan skorlar bu dosyaya YAZILMAZ; site derlenirken doğrudan
 * data/articles/*.json dosyalarından okunur. Böylece bu script dosyayı her
 * yeniden yazdığında haber skorları kaybolmaz.
 *
 * Bir kaynak hata verirse o kaynağın bir önceki verisi korunur.
 * Veri 12 saatten yeniyse hiçbir şey yapılmaz (--force ile zorlanabilir).
 *
 * Kullanım: npx tsx scripts/fetch-benchmarks.ts [--force]
 */
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { readLiveFile, type LiveFile, type LiveRow } from '../src/lib/benchmarks.ts';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.join(path.dirname(__filename), '..');
const OUT = path.join(ROOT, 'data', 'benchmarks.json');
const MAX_AGE_HOURS = 12;

const HF_ROWS = 'https://datasets-server.huggingface.co/rows';
const HF_DATASET = 'lmarena-ai/leaderboard-dataset';
const LMARENA_URL = 'https://lmarena.ai/leaderboard';
const SWE_URL = 'https://raw.githubusercontent.com/swe-bench/swe-bench.github.io/master/data/leaderboards.json';

/**
 * LMArena metin kategorileri. Her test için aday kategori adları öncelik sırasıyla
 * verilir; verideki İLK eşleşen kullanılır (iki farklı tablo karışmasın diye).
 * Verideki adlar: overall, coding, creative_writing, expert, math, non_english ...
 */
export const TEXT_CATEGORIES: Record<string, string[]> = {
  'lmarena-text': ['overall'],
  'lmarena-coding': ['coding'],
  'lmarena-math': ['math'],
  'lmarena-creative': ['creative_writing'],
  'lmarena-hard': ['hard_prompts', 'hard_6', 'hard_prompts_english'],
  'lmarena-if': ['instruction_following', 'if'],
  'lmarena-multiturn': ['multiturn', 'multi_turn'],
  'lmarena-longer': ['longer_query', 'long_user'],
  'lmarena-expert': ['expert'],
  'lmarena-nonenglish': ['non_english'],
  'lmarena-turkish': ['turkish'],
};

const LIMITS: Record<string, number> = { 'lmarena-text': 100, 'lmarena-vision': 80, 'lmarena-webdev': 80 };
const DEFAULT_LIMIT = 60;

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

/** Geçersiz tarihte hata fırlatmak yerine null döner (tek bozuk satır tüm kaynağı düşürmesin). */
export function toIso(d: unknown): string | null {
  if (!d) return null;
  const t = new Date(d as any);
  return isNaN(t.getTime()) ? null : t.toISOString();
}

async function getJson(url: string, params?: Record<string, string | number>, tries = 4): Promise<any> {
  let lastErr: any;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await axios.get(url, { params, timeout: 30000, headers: { 'User-Agent': 'yoney.dev benchmark sync' } });
      return res.data;
    } catch (e: any) {
      lastErr = e;
      const status = e.response?.status;
      if (status && status < 500 && status !== 429) break; // kalıcı hata
      await delay(1500 * (i + 1));
    }
  }
  throw lastErr;
}

export interface ArenaRow {
  model_name: string;
  organization?: string;
  rating?: number;
  rank?: number;
  category?: string;
  vote_count?: number;
  leaderboard_publish_date?: string;
}

/** LMArena satırlarını katalog kimliklerine göre gruplayıp sıralı ilk N'i döndürür. */
export function arenaRowsToEntries(rows: ArenaRow[], categories: Record<string, string[]>): LiveRow[] {
  const byCategory = new Map<string, ArenaRow[]>();
  for (const r of rows) {
    if (!r || !r.model_name || typeof r.rating !== 'number' || !Number.isFinite(r.rating)) continue;
    const c = r.category ?? 'overall';
    if (!byCategory.has(c)) byCategory.set(c, []);
    byCategory.get(c)!.push(r);
  }
  const out: LiveRow[] = [];
  for (const [id, candidates] of Object.entries(categories)) {
    const name = candidates.find(c => byCategory.has(c));
    if (!name) continue;
    const list = [...byCategory.get(name)!];
    list.sort((a, b) => (a.rank ?? 1e9) - (b.rank ?? 1e9) || (b.rating ?? 0) - (a.rating ?? 0));
    for (const r of list.slice(0, LIMITS[id] ?? DEFAULT_LIMIT)) {
      const votes = typeof r.vote_count === 'number' ? ` · ${Math.round(r.vote_count).toLocaleString('tr-TR')} oy` : '';
      out.push({
        benchmarkId: id,
        model: r.model_name,
        organization: r.organization ?? null,
        score: Math.round(r.rating!),
        setting: `Arena sırası #${r.rank ?? '-'}${votes}`,
        source: 'LMArena',
        url: LMARENA_URL,
        date: toIso(r.leaderboard_publish_date),
      });
    }
  }
  return out;
}

export type PageFetcher = (offset: number) => Promise<{ rows: ArenaRow[]; total: number }>;

/**
 * Bir LMArena alt kümesinin (latest) satırlarını sayfa sayfa okur.
 * - needed verilirse: satırlar kategori kategori geldiği için, gereken kategoriler
 *   okunup başka bir kategoriye geçildiğinde durur (görsel/WebDev için sadece "overall").
 * - Yarıda kesilirse son okunan kategori eksik kalmış olabilir; o kategori atılır ki
 *   önceki tam verisi korunsun.
 */
export async function readArenaPages(fetchPage: PageFetcher, needed?: Set<string>, maxRows = 20000): Promise<ArenaRow[]> {
  const rows: ArenaRow[] = [];
  let offset = 0;
  let total = Infinity;
  while (offset < total && offset < maxRows) {
    let page: { rows: ArenaRow[]; total: number };
    try {
      page = await fetchPage(offset);
    } catch (e) {
      if (rows.length === 0) throw e;
      const partial = rows[rows.length - 1]?.category;
      console.warn(`  ${offset}. satırda kesildi; yarım kalan "${partial}" kategorisi atlanıyor, öncekiler kullanılıyor`);
      return rows.filter(r => r.category !== partial);
    }
    total = page.total;
    if (page.rows.length === 0) break;
    rows.push(...page.rows);
    offset += page.rows.length;
    if (needed) {
      const seen = new Set(rows.map(r => r.category ?? 'overall'));
      const last = page.rows[page.rows.length - 1]?.category ?? 'overall';
      if ([...needed].every(c => seen.has(c)) && !needed.has(last)) break;
    }
  }
  return rows;
}

function hfPageFetcher(config: string): PageFetcher {
  return async offset => {
    const data = await getJson(HF_ROWS, { dataset: HF_DATASET, config, split: 'latest', offset, length: 100 });
    await delay(150);
    return {
      rows: (data?.rows ?? []).map((x: any) => x?.row).filter(Boolean),
      total: typeof data?.num_rows_total === 'number' ? data.num_rows_total : 0,
    };
  };
}

/** SWE-bench Verified liderlik tablosunu satırlara çevirir. */
export function sweToEntries(json: any, limit = 40): LiveRow[] {
  const board = json?.leaderboards?.find((b: any) => b.name === 'Verified');
  if (!board?.results) return [];
  return [...board.results]
    .filter((r: any) => typeof r.resolved === 'number')
    .sort((a: any, b: any) => b.resolved - a.resolved)
    .slice(0, limit)
    .map((r: any) => {
      const singleModel = r.model_display && !['multiple', 'undisclosed', 'unknown'].includes(String(r.model_display).toLowerCase());
      return {
        benchmarkId: 'swe-bench-verified',
        model: singleModel ? r.model_display : r.name,
        organization: singleModel ? (r.model_org ?? null) : null,
        score: Math.round(r.resolved * 10) / 10,
        setting: r.agent ? `Ajan: ${r.agent}${r.agent_org ? ` (${r.agent_org})` : ''}` : null,
        source: 'SWE-bench',
        url: 'https://www.swebench.com',
        date: toIso(r.date),
      };
    });
}

export async function syncBenchmarks(force = false) {
  const prev = readLiveFile(OUT);
  if (!force && prev?.sources) {
    // Ancak TÜM kaynaklar son 12 saatte başarıyla çekildiyse atla; biri bile
    // eskiyse (ör. önceki tur hata verdiyse) yeniden dene.
    const ages = ['lmarena-text', 'lmarena-vision', 'lmarena-webdev', 'swe-bench-verified'].map(id => {
      const t = prev.sources?.[id]?.fetchedAt;
      return t ? (Date.now() - new Date(t).getTime()) / 36e5 : Infinity;
    });
    const oldest = Math.max(...ages);
    if (oldest < MAX_AGE_HOURS) {
      console.log(`Benchmark verisi güncel (en eskisi ${oldest.toFixed(1)} saatlik). Atlanıyor (zorlamak için --force).`);
      return;
    }
  }

  const fresh = new Map<string, LiveRow[]>();
  const add = (rows: LiveRow[]) => {
    for (const r of rows) {
      if (!fresh.has(r.benchmarkId)) fresh.set(r.benchmarkId, []);
      fresh.get(r.benchmarkId)!.push(r);
    }
  };

  const jobs: [string, () => Promise<LiveRow[]>][] = [
    ['LMArena metin (tüm kategoriler)', async () => arenaRowsToEntries(await readArenaPages(hfPageFetcher('text_style_control')), TEXT_CATEGORIES)],
    ['LMArena görsel', async () => arenaRowsToEntries(await readArenaPages(hfPageFetcher('vision'), new Set(['overall'])), { 'lmarena-vision': ['overall'] })],
    ['LMArena WebDev', async () => arenaRowsToEntries(await readArenaPages(hfPageFetcher('webdev'), new Set(['overall'])), { 'lmarena-webdev': ['overall'] })],
    ['SWE-bench Verified', async () => sweToEntries(await getJson(SWE_URL))],
  ];

  for (const [label, job] of jobs) {
    try {
      const rows = await job();
      add(rows);
      const ids = [...new Set(rows.map(r => r.benchmarkId))];
      console.log(`✓ ${label}: ${rows.length} satır (${ids.join(', ') || '-'})`);
    } catch (e: any) {
      console.warn(`✗ ${label} alınamadı: ${e.message}`);
    }
  }

  // Bu turda gelmeyen testler için önceki veriyi koru
  const entries: LiveRow[] = [];
  const sources: LiveFile['sources'] = {};
  const prevIds = new Set((prev?.entries ?? []).map(e => e.benchmarkId));
  const allIds = new Set([...fresh.keys(), ...prevIds]);
  for (const id of allIds) {
    const rows = fresh.get(id);
    if (rows && rows.length) {
      entries.push(...rows);
      sources[id] = { fetchedAt: new Date().toISOString(), count: rows.length, publishDate: rows[0].date ?? null };
    } else {
      const old = (prev?.entries ?? []).filter(e => e.benchmarkId === id);
      entries.push(...old);
      sources[id] = prev?.sources?.[id] ?? { fetchedAt: prev?.generatedAt || '', count: old.length };
      console.log(`  ↺ ${id}: yeni veri yok, önceki ${old.length} satır korundu`);
    }
  }

  if (fresh.size === 0) {
    // Hiçbir kaynaktan yeni veri gelmedi: dosyaya dokunma (gereksiz commit ve yanlış "son veri" tarihi olmasın)
    console.log('Hiçbir kaynaktan yeni veri alınamadı; data/benchmarks.json değiştirilmedi.');
    return;
  }
  const out: LiveFile = { generatedAt: new Date().toISOString(), sources, entries };
  fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
  console.log(`Tamamlandı: ${entries.length} satır, ${allIds.size} test → data/benchmarks.json`);
}

if (process.argv[1] === __filename) {
  syncBenchmarks(process.argv.includes('--force')).catch(e => {
    console.error(e);
    process.exitCode = 1;
  });
}
