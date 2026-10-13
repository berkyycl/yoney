import { describe, it, expect } from 'vitest';
import { normalizeUrl, makeSlug, isAIRelated } from '../scripts/pipeline';

describe('pipeline yardımcıları', () => {
  it('URL normalizasyonu tekrarları yakalar', () => {
    expect(normalizeUrl('https://www.openai.com/index/foo/?utm_source=rss#x')).toBe(normalizeUrl('http://openai.com/index/foo'));
    expect(normalizeUrl('https://a.com/x?id=2')).not.toBe(normalizeUrl('https://a.com/x?id=3'));
  });
  it('slug sonunda tire bırakmaz', () => {
    expect(makeSlug('Chatham scales its capital markets expertise with OpenAI and more words here')).not.toMatch(/-$/);
    expect(makeSlug('Ünicode — başlık')).toBe('nicode-ba-l-k');
  });
  it('anahtar kelimeleri kelime sınırıyla arar', () => {
    expect(isAIRelated('Storage prices drop on average', 'drag and drop')).toBe(false); // "rag" yakalanmamalı
    expect(isAIRelated('New LLM release', '')).toBe(true);
    expect(isAIRelated('GPT-6 launches', '')).toBe(true);
    expect(isAIRelated('New tokens', 'text')).toBe(true); // çoğul
    expect(isAIRelated('Election results', 'the chatbot said')).toBe(false); // başlıkta siyaset, başlıkta YZ yok
  });
});

import { normalizeKategori, analysisSchema } from '../scripts/llm/provider';
describe('normalizeKategori', () => {
  it('LLM varyasyonlarını kimliğe çevirir', () => {
    expect(normalizeKategori('Model Çıkışı')).toBe('model-cikisi');
    expect(normalizeKategori('model_cikisi')).toBe('model-cikisi');
    expect(normalizeKategori('Güncelleme')).toBe('guncelleme');
    expect(normalizeKategori('Fiyat & Limit')).toBe('fiyat-limit');
    expect(normalizeKategori('Araç & SDK')).toBe('arac-sdk');
    expect(normalizeKategori('benchmark')).toBe('benchmark');
    expect(normalizeKategori('???')).toBe('diger');
  });
  it('şema geçersiz kategoride hata vermek yerine düzeltir', () => {
    const r = analysisSchema.parse({ baslik_tr: 'a', ozet_tr: 'b', kategori: 'Model Çıkışı', onem: 4, onem_gerekce: 'x', etiketler: [], anilan_modeller: [], yorum_tr: null, benchmarklar: [] });
    expect(r.kategori).toBe('model-cikisi');
  });
});

import fs from 'fs';
import os from 'os';
import path from 'path';
import { cleanupRedirectedArticles } from '../scripts/pipeline';
describe('cleanupRedirectedArticles', () => {
  it('yalnızca korunan sürümü olan eski dosyaları siler', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'yoney-'));
    fs.writeFileSync(path.join(dir, 'old.json'), '{}');
    fs.writeFileSync(path.join(dir, 'new.json'), '{}');
    fs.writeFileSync(path.join(dir, 'lonely.json'), '{}');
    const red = path.join(dir, 'redirects.json');
    fs.writeFileSync(red, JSON.stringify({ old: 'new', lonely: 'missing' }));
    expect(cleanupRedirectedArticles(dir, red)).toBe(1);
    expect(fs.existsSync(path.join(dir, 'old.json'))).toBe(false);
    expect(fs.existsSync(path.join(dir, 'lonely.json'))).toBe(true);
  });
});
