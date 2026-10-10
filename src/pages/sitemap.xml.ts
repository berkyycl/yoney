import fs from 'fs';
import path from 'path';

export async function GET() {
  const articlesDir = path.join(process.cwd(), 'data', 'articles');
  let articles: any[] = [];
  if (fs.existsSync(articlesDir)) {
    const files = fs.readdirSync(articlesDir).filter(f => f.endsWith('.json'));
    articles = files.map(f => JSON.parse(fs.readFileSync(path.join(articlesDir, f), 'utf-8')));
  }

  const staticPages = [
    '',
    '/benchmarklar',
    '/karsilastir',
    '/ne-degisti',
    '/kaynaklar',
    '/hakkinda'
  ];

  const siteUrl = 'https://yoney.dev';

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${staticPages.map(page => `  <url>
    <loc>${siteUrl}${page}</loc>
    <changefreq>daily</changefreq>
    <priority>${page === '' ? '1.0' : '0.8'}</priority>
  </url>`).join('\n')}
${articles.map(article => `  <url>
    <loc>${siteUrl}/haber/${article.slug}</loc>
    <lastmod>${new Date(article.date).toISOString().split('T')[0]}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`).join('\n')}
</urlset>`;

  return new Response(sitemap, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=3600'
    }
  });
}
