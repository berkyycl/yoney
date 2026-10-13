import { describe, it, expect } from 'vitest';
import { arenaRowsToEntries, sweToEntries, TEXT_CATEGORIES, readArenaPages, toIso } from '../scripts/fetch-benchmarks';

describe('arenaRowsToEntries', () => {
  it('kategorileri ayırır, sıraya dizer ve bilinmeyenleri atar', () => {
    const rows = [
      { model_name: 'b', organization: 'openai', rating: 1400.4, rank: 2, category: 'overall', vote_count: 1234 },
      { model_name: 'a', organization: 'anthropic', rating: 1500.6, rank: 1, category: 'overall', vote_count: 99 },
      { model_name: 'a', rating: 1450, rank: 1, category: 'coding' },
      { model_name: 'x', rating: 1300, rank: 1, category: 'polish' },
      { model_name: 'y', rating: NaN, rank: 3, category: 'overall' },
    ];
    const out = arenaRowsToEntries(rows, TEXT_CATEGORIES);
    const overall = out.filter(e => e.benchmarkId === 'lmarena-text');
    expect(overall.map(e => e.model)).toEqual(['a', 'b']);
    expect(overall[0].score).toBe(1501);
    expect(overall[1].setting).toBe('Arena sırası #2 · 1.234 oy');
    expect(out.filter(e => e.benchmarkId === 'lmarena-coding')).toHaveLength(1);
    expect(out.some(e => e.model === 'x')).toBe(false);
  });
});

describe('sweToEntries', () => {
  it('skora göre sıralar, model ve ajanı ayırır', () => {
    const json = { leaderboards: [{ name: 'Verified', results: [
      { name: 'Agent + Claude 4.5 Opus', model_display: 'Claude 4.5 Opus', model_org: 'Anthropic', agent: 'Agent', agent_org: 'Org', resolved: 70.04, date: '2025-12-01' },
      { name: 'Rovo Dev', model_display: 'Multiple', agent: 'Rovo Dev', resolved: 76.8 },
      { name: 'Bad', model_display: 'X', resolved: null },
    ] }] };
    const out = sweToEntries(json);
    expect(out.map(e => e.model)).toEqual(['Rovo Dev', 'Claude 4.5 Opus']);
    expect(out[1].score).toBe(70);
    expect(out[1].setting).toBe('Ajan: Agent (Org)');
    expect(out[0].organization).toBeNull();
  });
});

describe('arena kenar durumları', () => {
  it('aynı teste eşlenen iki kategori adını karıştırmaz', () => {
    const rows = [
      { model_name: 'a', rating: 1500, rank: 1, category: 'hard_prompts' },
      { model_name: 'a', rating: 1490, rank: 1, category: 'hard_prompts_english' },
      { model_name: 'b', rating: 1480, rank: 2, category: 'hard_prompts' },
    ];
    const out = arenaRowsToEntries(rows, TEXT_CATEGORIES).filter(e => e.benchmarkId === 'lmarena-hard');
    expect(out.map(e => e.model)).toEqual(['a', 'b']);
  });
  it('bozuk tarih satırı düşürmez', () => {
    expect(toIso('not a date')).toBeNull();
    const out = arenaRowsToEntries([{ model_name: 'a', rating: 1, rank: 1, category: 'overall', leaderboard_publish_date: 'xx' }], { 'lmarena-vision': ['overall'] });
    expect(out).toHaveLength(1);
    expect(out[0].date).toBeNull();
  });
  it('yarıda kesilen sayfalamada yarım kategoriyi atar', async () => {
    const all = [
      ...Array.from({ length: 150 }, (_, i) => ({ model_name: `o${i}`, rating: 1000 - i, rank: i + 1, category: 'overall' })),
      ...Array.from({ length: 150 }, (_, i) => ({ model_name: `c${i}`, rating: 1000 - i, rank: i + 1, category: 'coding' })),
    ];
    const fetchPage = async (offset: number) => {
      if (offset >= 200) throw new Error('429');
      return { rows: all.slice(offset, offset + 100), total: all.length };
    };
    const rows = await readArenaPages(fetchPage);
    expect(rows.filter(r => r.category === 'overall')).toHaveLength(150);
    expect(rows.filter(r => r.category === 'coding')).toHaveLength(0);
  });
  it('sadece overall gerekiyorsa sonraki kategoride durur', async () => {
    let calls = 0;
    const all = [
      ...Array.from({ length: 120 }, (_, i) => ({ model_name: `o${i}`, rating: 1, rank: i + 1, category: 'overall' })),
      ...Array.from({ length: 900 }, (_, i) => ({ model_name: `x${i}`, rating: 1, rank: i + 1, category: 'zzz' })),
    ];
    const rows = await readArenaPages(async offset => { calls++; return { rows: all.slice(offset, offset + 100), total: all.length }; }, new Set(['overall']));
    expect(calls).toBe(2);
    expect(rows.filter(r => r.category === 'overall')).toHaveLength(120);
  });
});
