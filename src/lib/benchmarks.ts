/**
 * Benchmark verisini derleme anında tek yerde toplar.
 *
 * İki kaynak birleşir:
 *  1. data/benchmarks.json  -> scripts/fetch-benchmarks.ts'in çektiği canlı liderlik tabloları
 *  2. data/articles/*.json  -> haberlerden çıkarılmış ve kaynak metinde doğrulanmış skorlar
 *     (yalnızca resmi/bağımsız kaynaklar ve katalogdaki bilinen testler)
 *
 * Haber skorları artık her derlemede makalelerden yeniden okunduğu için
 * benchmarks.json yeniden yazıldığında kaybolmaz.
 */
import fs from 'fs';
import path from 'path';
import { BENCHMARK_CATALOG, findBenchmark, matchBenchmarkName, type BenchmarkMeta } from '../data/benchmarkCatalog';
import { parseModelName } from './models';
import { loadArticles } from './articles';

export interface BenchEntry {
  bench: string;
  model: string;
  variant: string;
  key: string;
  provider: string | null;
  score: number;
  setting: string | null;
  source: string;
  url: string | null;
  date: string | null;
  origin: 'canli' | 'haber';
}

export interface BenchSummary {
  id: string;
  name: string;
  description: string;
  category: string;
  unit: string;
  higherIsBetter: boolean;
  link: string | null;
  entryCount: number;
  modelCount: number;
  sources: string[];
  latestDate: string | null;
  origin: 'canli' | 'haber';
}

export interface BenchmarkData {
  entries: BenchEntry[];
  benchmarks: BenchSummary[];
  generatedAt: string | null;
}

/** fetch-benchmarks.ts'in yazdığı satır */
export interface LiveRow {
  benchmarkId: string;
  model: string;
  organization?: string | null;
  score: number;
  setting?: string | null;
  source: string;
  url?: string | null;
  date?: string | null;
}

export interface LiveFile {
  generatedAt: string;
  sources?: Record<string, { fetchedAt: string; count: number; publishDate?: string | null }>;
  entries: LiveRow[];
}

const LEGACY_NAME_TO_ID: Record<string, string> = {
  'Chatbot Arena ELO': 'lmarena-text',
  'LMArena Vision': 'lmarena-vision',
  'LMArena WebDev': 'lmarena-webdev',
  'SWE-bench Verified': 'swe-bench-verified',
};
const LEGACY_LIVE_SOURCES = new Set(['LMSYS Chatbot Arena', 'SWE-bench Official']);

/**
 * Eski düz dizi biçimini yeni biçime çevirir. Eski dosyadaki sabit (2024 dönemi)
 * tablo ve emekliye ayrılmış Open LLM Leaderboard satırları atılır.
 */
export function convertLegacy(arr: any[]): LiveFile {
  const entries: LiveRow[] = [];
  for (const b of arr) {
    if (!b || !LEGACY_LIVE_SOURCES.has(b.source)) continue;
    const id = LEGACY_NAME_TO_ID[b.benchmark];
    if (!id || typeof b.skor !== 'number') continue;
    const org = typeof b.degerlendirme_ayari === 'string' ? b.degerlendirme_ayari.match(/\(([^)]+)\)\s*$/)?.[1] : null;
    // Eski SWE-bench satırları "Ajan + Model" biçimindeydi; tek model varsa modeli ayır
    const parts = id === 'swe-bench-verified' ? String(b.model).split(' + ') : [b.model];
    entries.push({
      benchmarkId: id,
      model: parts.length === 2 ? parts[1] : b.model,
      organization: id === 'swe-bench-verified' ? null : org,
      score: b.skor,
      setting: id === 'swe-bench-verified' ? (b.degerlendirme_ayari ?? null) : null,
      source: id === 'swe-bench-verified' ? 'SWE-bench' : 'LMArena',
      url: b.url ?? null,
      date: b.date ?? null,
    });
  }
  return { generatedAt: '', entries };
}

export function readLiveFile(file: string): LiveFile | null {
  if (!fs.existsSync(file)) return null;
  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf-8'));
    if (Array.isArray(raw)) return convertLegacy(raw);
    if (raw && Array.isArray(raw.entries)) return raw as LiveFile;
  } catch {
    /* bozuk dosya */
  }
  return null;
}

function normUnit(u: unknown): string {
  const s = String(u ?? '').trim().toLowerCase();
  if (['%', 'percent', 'yüzde', 'pct'].includes(s)) return '%';
  if (['', 'puan', 'points', 'point', 'score', 'skor'].includes(s)) return 'puan';
  if (s === 'elo') return 'elo';
  return s;
}

/** Haber skorunu katalog birimiyle uyumluysa kabul eder. */
function acceptArticleScore(meta: BenchmarkMeta, unit: string, score: number): boolean {
  if (!Number.isFinite(score) || score < 0) return false;
  const u = normUnit(unit);
  if (meta.unit === '%') return (u === '%' || u === 'puan') && score <= 100;
  if (meta.unit === 'puan') return u === 'puan';
  if (meta.unit.toLowerCase() === 'elo') return u === 'elo' || u === 'puan';
  return u === meta.unit.toLowerCase();
}

const SOURCE_PRIORITY: Record<string, number> = { LMArena: 0, 'SWE-bench': 1 };

export function buildBenchmarkData(live: LiveFile | null, articles: any[]): BenchmarkData {
  type Raw = Omit<BenchEntry, 'model' | 'variant' | 'key' | 'provider'> & { rawModel: string; org: string | null; priority: number; benchName?: string };
  const raws: Raw[] = [];
  const metaOverrides = new Map<string, BenchmarkMeta>();

  for (const r of live?.entries ?? []) {
    if (!findBenchmark(r.benchmarkId) || typeof r.score !== 'number' || !r.model) continue;
    raws.push({
      bench: r.benchmarkId,
      rawModel: r.model,
      org: r.organization ?? null,
      score: r.score,
      setting: r.setting ?? null,
      source: r.source,
      url: r.url ?? null,
      date: r.date ?? null,
      origin: 'canli',
      priority: SOURCE_PRIORITY[r.source] ?? 2,
    });
  }

  for (const a of articles) {
    if (!a || a.sourceTier === 'topluluk') continue;
    for (const b of a.benchmarklar ?? []) {
      const meta = matchBenchmarkName(b?.benchmark);
      if (!meta || !acceptArticleScore(meta, b.birim, Number(b.skor))) continue;
      metaOverrides.set(meta.id, meta);
      raws.push({
        bench: meta.id,
        rawModel: String(b.model ?? ''),
        org: null,
        score: Number(b.skor),
        setting: b.degerlendirme_ayari ?? null,
        source: a.source ?? 'Haber',
        url: a.slug ? `/haber/${a.slug}` : (a.url ?? null),
        date: a.date ?? null,
        origin: 'haber',
        priority: 3,
      });
    }
  }

  // Aynı modelin farklı yazımlarını tek görünen ada bağla (en güvenilir kaynağın yazımı)
  const parsed = raws.map(r => ({ r, p: parseModelName(r.rawModel, r.org) })).filter(x => x.p.key);
  parsed.sort((x, y) => x.r.priority - y.r.priority);
  const displayByKey = new Map<string, string>();
  const providerByKey = new Map<string, string>();
  for (const { p } of parsed) {
    if (!displayByKey.has(p.key)) displayByKey.set(p.key, p.base);
    if (p.provider && !providerByKey.has(p.key)) providerByKey.set(p.key, p.provider);
  }

  const seen = new Set<string>();
  const entries: BenchEntry[] = [];
  for (const { r, p } of parsed) {
    const sig = `${r.bench}|${p.key}|${p.variant}|${r.score}|${r.setting ?? ''}`;
    if (seen.has(sig)) continue;
    seen.add(sig);
    entries.push({
      bench: r.bench,
      model: displayByKey.get(p.key) ?? p.base,
      variant: p.variant,
      key: p.key,
      provider: providerByKey.get(p.key) ?? null,
      score: r.score,
      setting: r.setting,
      source: r.source,
      url: r.url,
      date: r.date,
      origin: r.origin,
    });
  }

  const benchmarks: BenchSummary[] = [];
  const allMetas = [...BENCHMARK_CATALOG, ...[...metaOverrides.values()].filter(m => !findBenchmark(m.id))];
  for (const meta of allMetas) {
    const es = entries.filter(e => e.bench === meta.id);
    if (es.length === 0) continue;
    const dates = es.map(e => e.date).filter((d): d is string => !!d).sort();
    benchmarks.push({
      id: meta.id,
      name: meta.name,
      description: meta.description,
      category: meta.category,
      unit: meta.unit,
      higherIsBetter: meta.higherIsBetter,
      link: meta.link ?? null,
      entryCount: es.length,
      modelCount: new Set(es.map(e => e.key)).size,
      sources: [...new Set(es.map(e => e.source))],
      latestDate: dates.length ? dates[dates.length - 1] : null,
      origin: es.some(e => e.origin === 'canli') ? 'canli' : 'haber',
    });
  }

  return { entries, benchmarks, generatedAt: live?.generatedAt || null };
}

let cache: BenchmarkData | null = null;
export function loadBenchmarkData(root = process.cwd()): BenchmarkData {
  if (cache) return cache;
  const live = readLiveFile(path.join(root, 'data', 'benchmarks.json'));
  cache = buildBenchmarkData(live, loadArticles(root));
  return cache;
}
