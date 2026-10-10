import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, '..');
const benchmarksFile = path.join(ROOT, 'data', 'benchmarks.json');

export async function fetchLMArenaBenchmarks(): Promise<number> {
    console.log("Fetching live benchmarks from LMSYS Chatbot Arena (LMArena)...");
    try {
        const url = 'https://datasets-server.huggingface.co/rows?dataset=lmarena-ai%2Fleaderboard-dataset&config=text_style_control&split=latest&limit=100';
        const res = await axios.get(url, { 
            headers: { 'User-Agent': 'Mozilla/5.0' },
            timeout: 30000 
        });

        if (!res.data || !res.data.rows) {
            console.warn("LMArena data structure unexpected");
            return 0;
        }

        let existing: any[] = [];
        if (fs.existsSync(benchmarksFile)) {
            existing = JSON.parse(fs.readFileSync(benchmarksFile, 'utf-8'));
        }

        // Filter out old LMArena entries to refresh with latest rankings
        const nonArena = existing.filter(b => b.source !== 'LMSYS Chatbot Arena' && b.source !== 'LMArena');
        const arenaEntries: any[] = [];

        // Map top models from LMArena
        for (const item of res.data.rows) {
            const row = item.row;
            if (!row || !row.model_name || !row.rating) continue;

            // Format readable model name
            const modelDisplay = row.model_name
                .replace(/-/g, ' ')
                .replace(/\b\w/g, (l: string) => l.toUpperCase());

            const eloScore = Math.round(row.rating);

            arenaEntries.push({
                model: modelDisplay,
                benchmark: 'Chatbot Arena ELO',
                skor: eloScore,
                birim: 'ELO',
                yuksek_iyi_mi: true,
                degerlendirme_ayari: `Sıralama: #${row.rank} | Oylama Sayısı: ${row.vote_count?.toLocaleString('tr-TR') || '-'} (${row.organization})`,
                kaynak_metinden_alinti: `LMSYS Chatbot Arena official leaderboard snapshot (${row.leaderboard_publish_date || 'latest'})`,
                date: row.leaderboard_publish_date ? new Date(row.leaderboard_publish_date).toISOString() : new Date().toISOString(),
                url: 'https://lmarena.ai',
                source: 'LMSYS Chatbot Arena'
            });
        }

        const merged = [...nonArena, ...arenaEntries];
        fs.writeFileSync(benchmarksFile, JSON.stringify(merged, null, 2));
        console.log(`✓ LMArena'dan ${arenaEntries.length} modelin canlı ELO skoru başarıyla güncellendi!`);
        return arenaEntries.length;
    } catch (e: any) {
        console.error("LMArena fetch failed:", e.message);
        return 0;
    }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    fetchLMArenaBenchmarks().catch(console.error);
}
