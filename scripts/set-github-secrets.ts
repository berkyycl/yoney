/**
 * set-github-secrets.ts
 * GitHub API ile tüm secrets'ı repoya yükler.
 *
 * Bu script yalnızca yerelde çalıştırılır ve sitenin derlenmesi için gerekmeyen
 * libsodium-wrappers paketine ihtiyaç duyar. Bir kereliğine kur:
 *   npm install --no-save libsodium-wrappers
 *
 * Sonra .env dosyasındaki keyleri bu scriptle yükle:
 *   npx tsx scripts/set-github-secrets.ts GH_PERSONAL_TOKEN_BURAYA
 *
 * GH_PERSONAL_TOKEN nasıl alınır:
 *   github.com → Settings → Developer settings → Personal access tokens → Tokens (classic)
 *   → "repo" scope seç → Generate
 */

import axios from 'axios';
import sodium from 'libsodium-wrappers';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const OWNER = 'berkyycl';
const REPO  = 'yoney';
const TOKEN = process.argv[2] || process.env.GH_TOKEN;

if (!TOKEN) {
    console.error('GitHub Personal Access Token gerekli!');
    console.error('Kullanım: npx tsx scripts/set-github-secrets.ts <GH_TOKEN>');
    process.exit(1);
}

// .env dosyasından keyleri oku
function loadSecretsFromEnv(): Record<string, string> {
    const envPath = path.join(ROOT, '.env');
    if (!fs.existsSync(envPath)) {
        console.error('.env dosyası bulunamadı!');
        process.exit(1);
    }
    const envContent = fs.readFileSync(envPath, 'utf-8');
    const secrets: Record<string, string> = {};
    for (const line of envContent.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx < 0) continue;
        const key = trimmed.substring(0, eqIdx).trim();
        const value = trimmed.substring(eqIdx + 1).trim();
        if (value) secrets[key] = value;
    }
    return secrets;
}

const api = axios.create({
    baseURL: 'https://api.github.com',
    headers: {
        Authorization: `Bearer ${TOKEN}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
    },
    timeout: 10000,
});

async function getPublicKey(): Promise<{ key_id: string; key: string }> {
    const res = await api.get(`/repos/${OWNER}/${REPO}/actions/secrets/public-key`);
    return res.data;
}

async function encryptSecret(publicKey: string, secretValue: string): Promise<string> {
    await sodium.ready;
    const keyBytes = Buffer.from(publicKey, 'base64');
    const msgBytes = Buffer.from(secretValue, 'utf-8');
    const encrypted = sodium.crypto_box_seal(msgBytes, keyBytes);
    return Buffer.from(encrypted).toString('base64');
}

async function setSecret(name: string, value: string, keyId: string, publicKey: string) {
    const encryptedValue = await encryptSecret(publicKey, value);
    await api.put(`/repos/${OWNER}/${REPO}/actions/secrets/${name}`, {
        encrypted_value: encryptedValue,
        key_id: keyId,
    });
}

async function main() {
    const secrets = loadSecretsFromEnv();
    console.log(`\nRepo: ${OWNER}/${REPO}`);
    console.log(`Yüklenecek secret sayısı: ${Object.keys(secrets).length}\n`);

    const { key_id, key } = await getPublicKey();

    let ok = 0;
    let fail = 0;

    for (const [name, value] of Object.entries(secrets)) {
        try {
            await setSecret(name, value, key_id, key);
            console.log(`  ✓ ${name}`);
            ok++;
        } catch (e: any) {
            console.error(`  ✗ ${name}: ${e.response?.data?.message || e.message}`);
            fail++;
        }
        await new Promise(r => setTimeout(r, 300));
    }

    console.log(`\n✅ Tamamlandı: ${ok} başarılı, ${fail} başarısız`);
    if (ok > 0) {
        console.log('\nGitHub Actions artık tüm keylere erişebilir!');
    }
}

main().catch(console.error);
