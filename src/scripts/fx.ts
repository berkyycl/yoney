/**
 * Sitenin etkileşimleri:
 *  - Renk kayması: her sayfa açılışında palet kendiliğinden değişir (Layout.astro'daki
 *    satır içi betik). Burada yalnızca tıklanan nokta kaydedilir; yeni sayfa,
 *    sayfa geçişi sırasında o noktadan dairesel bir dalga olarak yayılır.
 *  - Eğilen kartlar (.tilt), sahneye "poz vererek" giriş (.pose), fareye göre
 *    hafif derinlik (arka plan ve manşet katmanları), okuma ilerlemesi.
 * Hareketler "hareketi azalt" tercihinde ve dokunmatik ekranlarda devre dışıdır.
 */

const root = document.documentElement;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = matchMedia('(pointer: fine)').matches;

// Sayfa geçişindeki dalga, tıklanan bağlantının olduğu yerden başlasın
addEventListener('click', e => {
	if (!(e.target as Element | null)?.closest('a[href]')) return;
	try { sessionStorage.setItem('yoney-dalga', `${Math.round(e.clientX)},${Math.round(e.clientY)}`); } catch {}
}, { capture: true });

/* ---------- Canlı saat (İstanbul) ---------- */
const clock = document.getElementById('clock');
if (clock) {
	const fmt = new Intl.DateTimeFormat('tr-TR', { timeZone: 'Europe/Istanbul', hour: '2-digit', minute: '2-digit', second: '2-digit' });
	const tick = () => { clock.textContent = fmt.format(new Date()); };
	tick();
	// Saniye başına hizala, sonra her saniye güncelle
	setTimeout(() => { tick(); setInterval(tick, 1000); }, 1000 - (Date.now() % 1000));
}

/* ---------- Mobil menü ---------- */
const header = document.querySelector('.site-header');
const menuBtn = document.getElementById('menuToggle');
menuBtn?.addEventListener('click', () => {
	const open = header?.classList.toggle('menu-open') ?? false;
	menuBtn.setAttribute('aria-expanded', String(open));
});

/* ---------- Göreli tarihler ("3 saat önce") ---------- */
for (const t of document.querySelectorAll<HTMLTimeElement>('time[data-rel]')) {
	const ms = Date.now() - new Date(t.dateTime).getTime();
	if (!Number.isFinite(ms) || ms < 0) continue;
	const min = ms / 60000;
	let txt = '';
	if (min < 60) txt = `${Math.max(1, Math.round(min))} dk önce`;
	else if (min < 1440) txt = `${Math.floor(min / 60)} saat önce`;
	else if (min < 2880) txt = 'dün';
	else if (min < 10080) txt = `${Math.floor(min / 1440)} gün önce`;
	if (txt) {
		t.title = t.textContent?.trim() ?? '';
		t.textContent = txt;
	}
}

/* ---------- Sahneye "poz vererek" giriş ---------- */
const poses = document.querySelectorAll<HTMLElement>('.pose');
if (reduceMotion || !('IntersectionObserver' in window)) {
	poses.forEach(el => el.classList.add('in'));
} else {
	const io = new IntersectionObserver(entries => {
		for (const en of entries) {
			if (!en.isIntersecting) continue;
			en.target.classList.add('in');
			io.unobserve(en.target);
		}
	}, { rootMargin: '0px 0px -6% 0px' });
	poses.forEach(el => io.observe(el));
}

/* ---------- Okuma ilerlemesi ---------- */
const progress = document.querySelector<HTMLElement>('[data-progress]');
if (progress) {
	const target = document.querySelector<HTMLElement>(progress.dataset.progress || 'main') ?? document.body;
	const update = () => {
		const r = target.getBoundingClientRect();
		const total = r.height - innerHeight;
		const p = total > 0 ? Math.min(1, Math.max(0, -r.top / total)) : 1;
		progress.style.setProperty('--p', String(p));
	};
	addEventListener('scroll', update, { passive: true });
	addEventListener('resize', update);
	update();
}

if (finePointer && !reduceMotion) {
	/* ---------- Fareye göre hafif derinlik (arka plan ve manşet katmanları) ---------- */
	let queued = false;
	let last: PointerEvent | null = null;
	addEventListener('pointermove', e => {
		last = e;
		if (queued) return;
		queued = true;
		requestAnimationFrame(() => {
			queued = false;
			if (!last) return;
			root.style.setProperty('--px', ((last.clientX / innerWidth) * 2 - 1).toFixed(3));
			root.style.setProperty('--py', ((last.clientY / innerHeight) * 2 - 1).toFixed(3));
		});
	}, { passive: true });

	/* ---------- Eğilen kartlar ---------- */
	document.addEventListener('pointermove', e => {
		const el = (e.target as Element | null)?.closest<HTMLElement>('.tilt');
		if (!el || e.pointerType !== 'mouse') return;
		const r = el.getBoundingClientRect();
		const x = (e.clientX - r.left) / r.width;
		const y = (e.clientY - r.top) / r.height;
		el.style.setProperty('--ry', `${((x - 0.5) * 9).toFixed(2)}deg`);
		el.style.setProperty('--rx', `${((0.5 - y) * 7).toFixed(2)}deg`);
		el.style.setProperty('--mx', `${(x * 100).toFixed(1)}%`);
		el.style.setProperty('--my', `${(y * 100).toFixed(1)}%`);
		el.classList.add('tilting');
	}, { passive: true });
	document.addEventListener('pointerout', e => {
		const el = (e.target as Element | null)?.closest<HTMLElement>('.tilt');
		if (!el || el.contains(e.relatedTarget as Node | null)) return;
		el.classList.remove('tilting');
		el.style.setProperty('--rx', '0deg');
		el.style.setProperty('--ry', '0deg');
	});
}
