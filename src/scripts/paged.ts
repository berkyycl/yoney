/**
 * "Daha fazla haber" düğmesi. Kullanım:
 *   <div id="feed" data-paged="12"> ...<article class="story">... </div>
 *   <button data-more="feed">  <p data-count="feed">
 * Sunucu ilk sayfadan sonrasını zaten `hidden` ile gönderir; JS kapalıyken de ilk sayfa görünür.
 */
for (const list of document.querySelectorAll<HTMLElement>('[data-paged]')) {
	const size = Number(list.dataset.paged) || 12;
	const items = Array.from(list.children).filter((el): el is HTMLElement => el instanceof HTMLElement && el.classList.contains('story'));
	const btn = document.querySelector<HTMLButtonElement>(`[data-more="${list.id}"]`);
	const note = document.querySelector<HTMLElement>(`[data-count="${list.id}"]`);
	let limit = size;

	const render = () => {
		items.forEach((it, i) => { it.hidden = i >= limit; });
		if (btn) btn.hidden = items.length <= limit;
		if (note) note.textContent = `${Math.min(limit, items.length)} / ${items.length} haber`;
	};

	btn?.addEventListener('click', () => {
		limit += size;
		render();
	});
	render();
}
