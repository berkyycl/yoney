# Yöney

**Türkiye'nin yapay zekâ haber ve benchmark takibi.**

Site: [https://yoney.dev](https://yoney.dev)

## Proje Hakkında
Yöney (vektör kelimesinin öz Türkçe karşılığı), yapay zekâ dünyasındaki gelişmeleri güvenilir kaynaklardan toplayan, Türkçe özetleyen ve benchmark sonuçlarını grafiklerle gösteren otomatik bir platformdur. Ziyaretçiye statik sayfalar sunar, veritabanı gerektirmez, Gemini AI destekli veri hattıyla kendini günceller.

## Kurulum ve Çalıştırma

1. `npm install` ile bağımlılıkları yükleyin.
2. `GEMINI_API_KEY` ortam değişkenini ayarlayın (`.env` dosyasına ekleyebilirsiniz).
3. Veri hattını çalıştırmak için: `npm run pipeline` (Mock veri ile test etmek için: `npm run pipeline:mock`)
4. Siteyi geliştirme modunda açmak için: `npm run dev`
5. Statik siteyi derlemek için: `npm run build`

## GitHub Pages ve Özel Domain (yoney.dev) Ayarları

1. Projeyi GitHub'a pushlayın.
2. Deponuzun **Settings > Pages** sekmesine gidin.
3. "Build and deployment" altında "Source" ayarını **GitHub Actions** olarak seçin.
4. "Custom domain" kısmına `yoney.dev` yazın.
5. Domain DNS ayarlarınızda `yoney.dev` için GitHub Pages IP'lerine A kayıtları ve/veya CNAME kaydını ekleyin.
6. "Enforce HTTPS" ayarının işaretli olduğundan emin olun (`.dev` uzantısı HTTPS zorunludur).
7. GitHub deponuzun **Settings > Secrets and variables > Actions** sekmesine gidin.
8. `GEMINI_API_KEY` adında yeni bir secret oluşturup API anahtarınızı yapıştırın.

## Sınırlamalar
- Sadece config/sources.json içerisindeki yapılandırılmış kaynaklardan veri çeker.
- Tüm içerikler LLM'e (Gemini) güvenir, yorum ve özetler yapay zekâ tarafından oluşturulur.
- LLM'ler halüsinasyon görebilir, bu yüzden veriler her zaman doğrudan orijinal kaynak metnindeki verilerle doğrulanır, ancak bazen LLM'ler hiç içerik çıkaramayabilir.
