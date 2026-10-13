/**
 * Model adı normalizasyonu.
 *
 * Farklı kaynaklar aynı modeli farklı yazar:
 *   LMArena:   "claude-opus-4-5-20251101-thinking-32k"
 *   SWE-bench: "Claude 4.5 Opus (high)"
 *   Haberler:  "Claude Opus 4.5"
 * Bu modül hepsini aynı "temel model" anahtarına indirger, çaba/düşünme
 * ayarlarını ve tarihleri ayrı bir "varyant" olarak saklar.
 */

export interface ParsedModel {
  /** Ekranda gösterilecek temel ad, ör. "Claude Opus 4.5" */
  base: string;
  /** Varyant/ayar, ör. "Thinking 32k" ya da "" */
  variant: string;
  /** Sıra bağımsız eşleştirme anahtarı, ör. "4.5 claude opus" */
  key: string;
  /** Tespit edilebildiyse sağlayıcı, ör. "Anthropic" */
  provider: string | null;
}

// Her markada çaba/ayar anlamına gelen kelimeler
const VARIANT_WORDS = new Set([
  'minimal', 'low', 'medium', 'high', 'xhigh', 'thinking', 'reasoning', 'nothinking',
  'latest', 'preview', 'exp', 'experimental', 'beta',
]);
// "max" sadece bu markalarda çaba seviyesi; Qwen/GLM/Kimi'de ürün adının parçası
const MAX_IS_EFFORT = new Set(['claude', 'gpt', 'gemini', 'grok', 'muse', 'deepseek', 'o1', 'o3', 'o4']);

// Bitişik yazılan marka+sürüm ayrıştırması: "qwen3.8" -> "qwen" "3.8"
const SPLIT_BRANDS = /^(qwen|gemma|llama|glm|phi|grok|gpt|claude|gemini|hy|mimo|ernie|nemotron|mistral|deepseek)(\d[\w.]*)$/;

// Ekranda özel yazım
const BRAND_CASE: Record<string, string> = {
  gpt: 'GPT', chatgpt: 'ChatGPT', glm: 'GLM', deepseek: 'DeepSeek', qwen: 'Qwen', ernie: 'ERNIE',
  minimax: 'MiniMax', xai: 'xAI', vl: 'VL', tts: 'TTS', ai: 'AI', moe: 'MoE', cc: 'CC', mtp: 'MTP',
  api: 'API', mimo: 'MiMo', hy: 'Hy', phi: 'Phi', llm: 'LLM', swe: 'SWE', oss: 'OSS', ui: 'UI',
};
// Marka ile sürüm arasına konacak ayraç (Qwen3.8, GPT-6, GLM-5)
const BRAND_JOIN: Record<string, string> = { qwen: '', hy: '', gpt: '-', glm: '-', phi: '-' };

const PROVIDER_BY_ORG: Record<string, string> = {
  anthropic: 'Anthropic', openai: 'OpenAI', google: 'Google', 'google deepmind': 'Google', deepmind: 'Google',
  xai: 'xAI', meta: 'Meta', 'meta ai': 'Meta', deepseek: 'DeepSeek', 'deepseek ai': 'DeepSeek',
  alibaba: 'Alibaba', qwen: 'Alibaba', 'alibaba cloud': 'Alibaba', zhipu: 'Zhipu (Z.ai)', 'zhipu ai': 'Zhipu (Z.ai)',
  'z.ai': 'Zhipu (Z.ai)', zai: 'Zhipu (Z.ai)', moonshot: 'Moonshot', 'moonshot ai': 'Moonshot',
  minimax: 'MiniMax', mistral: 'Mistral', 'mistral ai': 'Mistral', baidu: 'Baidu', tencent: 'Tencent',
  xiaomi: 'Xiaomi', bytedance: 'ByteDance', 'bytedance seed': 'ByteDance', stepfun: 'StepFun',
  nvidia: 'NVIDIA', microsoft: 'Microsoft', amazon: 'Amazon', cohere: 'Cohere', ibm: 'IBM', ai2: 'Ai2',
};

const PROVIDER_BY_BRAND: [RegExp, string][] = [
  [/^claude$/, 'Anthropic'],
  [/^(gpt|chatgpt|o1|o3|o4|codex)$/, 'OpenAI'],
  [/^(gemini|gemma)$/, 'Google'],
  [/^grok$/, 'xAI'],
  [/^(llama|muse)$/, 'Meta'],
  [/^(qwen|qwq)$/, 'Alibaba'],
  [/^deepseek$/, 'DeepSeek'],
  [/^glm$/, 'Zhipu (Z.ai)'],
  [/^kimi$/, 'Moonshot'],
  [/^minimax$/, 'MiniMax'],
  [/^(mistral|magistral|devstral|codestral|ministral)$/, 'Mistral'],
  [/^ernie$/, 'Baidu'],
  [/^hy$/, 'Tencent'],
  [/^mimo$/, 'Xiaomi'],
  [/^(seed|doubao|dola)$/, 'ByteDance'],
  [/^step$/, 'StepFun'],
  [/^nemotron$/, 'NVIDIA'],
  [/^phi$/, 'Microsoft'],
  [/^nova$/, 'Amazon'],
  [/^command$/, 'Cohere'],
];

export function normalizeProvider(org?: string | null): string | null {
  if (!org) return null;
  const k = org.trim().toLowerCase();
  if (!k || k === 'multiple' || k === '-') return null;
  return PROVIDER_BY_ORG[k] ?? org.trim();
}

function stripDates(s: string): string {
  return s
    .replace(/\b20\d{2}[-_ ./]\d{2}[-_ ./]\d{2}\b/g, ' ')        // 2025-04-14
    .replace(/\b20\d{6}\b/g, ' ')                                 // 20250805
    .replace(/\b20\d{4}\b/g, ' ')                                 // 202506
    .replace(/(preview|exp)[-_ ](\d{2})[-_ ](\d{2}|20\d{2})\b/gi, '$1 ') // preview-06-17, preview-09-2025
    .replace(/\b(\d{2})[-_ ](20\d{2})\b/g, ' ');                  // 09-2025
}

function isMMDD(tok: string): boolean {
  return /^(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])$/.test(tok);
}

function formatToken(tok: string, isFirst: boolean): string {
  if (BRAND_CASE[tok]) return BRAND_CASE[tok];
  if (/^o\d(-mini|-pro)?$/.test(tok)) return tok; // OpenAI o3, o4-mini
  if (/^\d+(\.\d+)?[bmt]$/.test(tok)) return tok.toUpperCase(); // 235b -> 235B
  if (/^a\d+(\.\d+)?b$/.test(tok)) return tok.toUpperCase(); // a22b -> A22B
  if (/^[kvm]\d[\w.]*$/.test(tok)) return tok.toUpperCase(); // k2.5 -> K2.5, v4 -> V4, m2.5 -> M2.5
  if (/^\d+v$/.test(tok)) return tok.toUpperCase(); // 5v -> 5V
  if (/^\d/.test(tok)) return tok;
  if (/^[a-z]{1,3}\d/.test(tok) && !isFirst) return tok.toUpperCase();
  return tok.charAt(0).toUpperCase() + tok.slice(1);
}

function formatName(tokens: string[]): string {
  const out: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    const f = formatToken(t, i === 0);
    const prev = tokens[i - 1];
    if (i > 0 && prev in BRAND_JOIN && /^\d/.test(t)) {
      out[out.length - 1] = out[out.length - 1] + BRAND_JOIN[prev] + f;
    } else {
      out.push(f);
    }
  }
  return out.join(' ');
}

function cleanOriginal(raw: string): string {
  return stripDates(raw.replace(/\([^)]*\)/g, ' ')).replace(/\s+/g, ' ').trim();
}

/** Ham model adını temel ad + varyant + anahtar olarak ayrıştırır. */
export function parseModelName(raw: string, org?: string | null): ParsedModel {
  let s = (raw || '').trim();
  const parenParts: string[] = [];
  s = s.replace(/\(([^)]*)\)/g, (_m, inner: string) => {
    const cleaned = stripDates(inner).trim();
    if (cleaned) parenParts.push(cleaned);
    return ' ';
  });
  s = stripDates(s).toLowerCase();

  let tokens = s.split(/[\s\-_/:,]+/).filter(Boolean);

  // Bitişik marka+sürüm: qwen3.8 -> qwen 3.8
  tokens = tokens.flatMap(t => {
    const m = t.match(SPLIT_BRANDS);
    return m ? [m[1], m[2]] : [t];
  });

  // Ardışık sürüm parçaları: "4" "5" -> "4.5"
  const joined: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    const next = tokens[i + 1];
    if (/^\d{1,2}$/.test(t) && next !== undefined && /^\d{1,2}$/.test(next) && joined.length > 0) {
      joined.push(`${t}.${next}`);
      i++;
    } else {
      joined.push(t);
    }
  }
  tokens = joined;

  const brand = tokens[0] ?? '';
  const baseTokens: string[] = [];
  const variantTokens: string[] = [];
  let sawVersion = false;
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (i === 0) { baseTokens.push(t); sawVersion = /\d/.test(t); continue; }
    const isBudget = /^\d+k$/.test(t);
    const isNoThinking = t === 'no' && tokens[i + 1] === 'thinking';
    const isEffortMax = t === 'max' && MAX_IS_EFFORT.has(brand);
    // "Mistral Medium 3.5" -> Medium ürün adı; "Gemini 3.5 Flash Medium" -> çaba seviyesi.
    // Ayar kelimeleri ancak sürüm numarasından SONRA geliyorsa varyant sayılır.
    const isSetting = sawVersion && (VARIANT_WORDS.has(t) || isNoThinking || isEffortMax || /^beta\d*$/.test(t));
    if (isSetting || isBudget || isMMDD(t)) {
      variantTokens.push(t);
    } else {
      baseTokens.push(t);
      if (/\d/.test(t)) sawVersion = true;
    }
  }

  // Bilinen bir model ailesi değilse (ör. "Atlassian Rovo Dev", "ACoder") orijinal yazımı koru
  const knownBrand = SPLIT_BRANDS.test(brand + '1') || PROVIDER_BY_BRAND.some(([re]) => re.test(brand)) || brand === 'chatgpt';
  const base = knownBrand ? formatName(baseTokens) : cleanOriginal(raw);
  const variantParts = [
    ...(variantTokens.length ? [variantTokens.map(t => (/^\d/.test(t) ? t : formatToken(t, false))).join(' ')] : []),
    ...parenParts.map(x => (x === x.toLowerCase() ? x.replace(/(^|\s)([a-z])/g, (_m, a, b) => a + b.toUpperCase()) : x)),
  ];
  const variant = variantParts.join(', ');
  const key = [...baseTokens].sort().join(' ');

  let provider = normalizeProvider(org);
  if (!provider) {
    const b = brand === 'chatgpt' ? 'chatgpt' : brand;
    for (const [re, name] of PROVIDER_BY_BRAND) {
      if (re.test(b)) { provider = name; break; }
    }
  }

  return { base, variant, key, provider };
}

/** Varyantla birlikte tam görünen ad */
export function displayName(p: ParsedModel): string {
  return p.variant ? `${p.base} (${p.variant})` : p.base;
}
