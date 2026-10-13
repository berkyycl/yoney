import { describe, it, expect } from 'vitest';
import { parseModelName } from '../src/lib/models';
import { matchBenchmarkName } from '../src/data/benchmarkCatalog';
import { buildBenchmarkData, convertLegacy } from '../src/lib/benchmarks';

const p = (raw: string, org?: string) => parseModelName(raw, org);

describe('parseModelName', () => {
  it('LMArena slug adlarını okunur hale getirir', () => {
    expect(p('claude-opus-4-6-high').base).toBe('Claude Opus 4.6');
    expect(p('claude-opus-4-6-high').variant).toBe('High');
    expect(p('claude-opus-4-1-20250805-thinking-16k').base).toBe('Claude Opus 4.1');
    expect(p('claude-opus-4-1-20250805-thinking-16k').variant).toBe('Thinking 16k');
    expect(p('gpt-6.1-sol-max').base).toBe('GPT-6.1 Sol');
    expect(p('gpt-5-mini-high').base).toBe('GPT-5 Mini');
    expect(p('o3-2025-04-16').base).toBe('o3');
    expect(p('chatgpt-4o-latest-20250326').base).toBe('ChatGPT 4o');
    expect(p('gemini-2.5-flash-lite-preview-06-17-thinking').base).toBe('Gemini 2.5 Flash Lite');
    expect(p('deepseek-v4-pro-high-20260813').base).toBe('DeepSeek V4 Pro');
    expect(p('qwen3.8-27b').base).toBe('Qwen3.8 27B');
    expect(p('qwen3-vl-235b-a22b-instruct').base).toBe('Qwen3 VL 235B A22B Instruct');
    expect(p('glm-5.3-max').base).toBe('GLM-5.3 Max'); // Qwen/GLM'de Max ürün adıdır
    expect(p('kimi-k2.5-thinking').base).toBe('Kimi K2.5');
    expect(p('muse-spark-1.2 (xHigh)').base).toBe('Muse Spark 1.2');
    expect(p('muse-spark-1.2 (xHigh)').variant).toBe('xHigh');
    expect(p('grok-4-1-fast-reasoning').base).toBe('Grok 4.1 Fast');
    expect(p('ernie-5.0-preview-1203').base).toBe('ERNIE 5.0');
  });

  it('eski başlık-biçimli adları da çözer', () => {
    expect(p('Claude Opus 4 6 High').base).toBe('Claude Opus 4.6');
    expect(p('Gpt 4.1 2025 04 14').base).toBe('GPT-4.1');
    expect(p('Gemini 2.5 Flash Preview 09 2025').base).toBe('Gemini 2.5 Flash');
    expect(p('Glm 5v Turbo').base).toBe('GLM-5V Turbo');
  });

  it('farklı sıralamalar aynı anahtara iner', () => {
    expect(p('Claude 4.5 Opus (high)').key).toBe(p('claude-opus-4-5-20251101').key);
    expect(p('Claude Opus 4.5').key).toBe(p('claude-opus-4-5-20251101-high-32k').key);
    expect(p('Qwen 3.8 27B').key).toBe(p('qwen3.8-27b').key);
    expect(p('GPT-6 Astra').key).toBe(p('gpt-6-astra-max').key);
    expect(p('GPT-6 Astra').key).not.toBe(p('GPT-6 Luna').key);
  });

  it('sağlayıcıyı bulur', () => {
    expect(p('claude-opus-4-6').provider).toBe('Anthropic');
    expect(p('gpt-6-astra').provider).toBe('OpenAI');
    expect(p('gemma-4-31b').provider).toBe('Google');
    expect(p('anything', 'anthropic').provider).toBe('Anthropic');
    expect(p('qwen3.8-max').provider).toBe('Alibaba');
  });
});

describe('matchBenchmarkName', () => {
  it('bilinen testleri eşler, bilinmeyenleri atar', () => {
    expect(matchBenchmarkName('GPQA Diamond')?.id).toBe('gpqa-diamond');
    expect(matchBenchmarkName('SWE-Bench Verified')?.id).toBe('swe-bench-verified');
    expect(matchBenchmarkName('SWE-bench Pro (public)')?.id).toBe('swe-bench-pro');
    expect(matchBenchmarkName("Humanity's Last Exam (no tools)")?.id).toBe('hle');
    expect(matchBenchmarkName('Terminal-Bench 2.0')?.id).toBe('terminal-bench-2');
    expect(matchBenchmarkName('AIME 2026')?.id).toBe('aime-2026');
    expect(matchBenchmarkName('AIME 2026')?.name).toBe('AIME 2026');
    expect(matchBenchmarkName('MMMU-Pro')?.id).toBe('mmmu-pro');
    expect(matchBenchmarkName('MMMU')?.id).toBe('mmmu');
    expect(matchBenchmarkName('Eval loss')).toBeUndefined();
    expect(matchBenchmarkName('Cost per document reduction')).toBeUndefined();
    expect(matchBenchmarkName('Token generation speed')).toBeUndefined();
  });
});

describe('buildBenchmarkData', () => {
  it('eski dosyadaki sabit tabloyu ve Open LLM satırlarını atar', () => {
    const legacy = convertLegacy([
      { model: 'GPT-4o', benchmark: 'MMLU', skor: 88.7, birim: '%', source: 'OpenAI' },
      { model: 'Aura-4B', benchmark: 'MMLU-Pro', skor: 30, birim: '%', source: 'Open LLM Leaderboard' },
      { model: 'Claude Opus 4 6 High', benchmark: 'Chatbot Arena ELO', skor: 1504, birim: 'ELO', source: 'LMSYS Chatbot Arena', degerlendirme_ayari: 'Sıralama: #3 | Oylar: 79.415 (anthropic)' },
    ]);
    expect(legacy.entries).toHaveLength(1);
    expect(legacy.entries[0].benchmarkId).toBe('lmarena-text');
    expect(legacy.entries[0].organization).toBe('anthropic');
  });

  it('haber skorlarını ekler, topluluk ve bilinmeyen testleri almaz, adları birleştirir', () => {
    const live = {
      generatedAt: '2026-10-13T00:00:00Z',
      entries: [
        { benchmarkId: 'lmarena-text', model: 'claude-opus-4-5-20251101', organization: 'anthropic', score: 1480, source: 'LMArena' },
        { benchmarkId: 'swe-bench-verified', model: 'Claude 4.5 Opus', organization: 'Anthropic', score: 79.2, source: 'SWE-bench', setting: 'Ajan: X' },
      ],
    };
    const articles = [
      { slug: 'a', source: 'Google DeepMind', sourceTier: 'resmi', date: '2026-10-01', benchmarklar: [
        { model: 'Gemini 4 Argon', benchmark: 'GPQA Diamond', skor: 91.2, birim: '%' },
        { model: 'Claude Opus 4.5', benchmark: 'GPQA Diamond', skor: 87, birim: '%' },
        { model: 'Gemini 4 Argon', benchmark: 'Internal eval', skor: 5, birim: '%' },
      ] },
      { slug: 'b', source: 'Reddit', sourceTier: 'topluluk', benchmarklar: [
        { model: 'Qwen 27B', benchmark: 'GPQA Diamond', skor: 60, birim: '%' },
      ] },
    ];
    const data = buildBenchmarkData(live, articles);
    const gpqa = data.entries.filter(e => e.bench === 'gpqa-diamond');
    expect(gpqa).toHaveLength(2);
    // Haberdeki "Claude Opus 4.5" ile SWE-bench'teki "Claude 4.5 Opus" aynı model
    const claude = data.entries.filter(e => e.key === parseModelName('Claude Opus 4.5').key);
    expect(new Set(claude.map(e => e.model)).size).toBe(1);
    expect(claude[0].model).toBe('Claude Opus 4.5');
    expect(claude.map(e => e.bench).sort()).toEqual(['gpqa-diamond', 'lmarena-text', 'swe-bench-verified']);
    expect(data.benchmarks.find(b => b.id === 'gpqa-diamond')?.modelCount).toBe(2);
  });
});

describe('parseModelName kenar durumları', () => {
  it('sürümden önce gelen ayar kelimesi ürün adıdır', () => {
    expect(parseModelName('Mistral Medium 3.5').base).toBe('Mistral Medium 3.5');
    expect(parseModelName('gemini-3.5-flash-medium').base).toBe('Gemini 3.5 Flash');
  });
  it('bilinmeyen sistem adlarının yazımını korur', () => {
    expect(parseModelName('Atlassian Rovo Dev (2025-09-02)').base).toBe('Atlassian Rovo Dev');
    expect(parseModelName('ACoder').base).toBe('ACoder');
  });
  it('parantez içi küçük harfli ayarları büyütür', () => {
    expect(parseModelName('Claude 4.5 Opus (high)').variant).toBe('High');
  });
});
