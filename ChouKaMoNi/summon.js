(() => {
  const prizes = window.AK_PRIZES || {};
  const tiers = window.AK_PRIZE_TIERS || [];
  const tierById = Object.fromEntries(tiers.map(tier => [tier.id, tier]));

  // 海报图片：2026 秋季换奖后每档一张实拍图，直接取该档第一张。
  document.querySelectorAll('[data-art]').forEach(img => {
    const pool = prizes[img.dataset.art] || [];
    if (pool[0]) img.src = pool[0].file;
  });
  // 海报文案：这里的设计同时展示奖项等级和奖品种类，所以两行都写全。
  // 特等奖是「影之刃零」专属版式，文案直接写在 HTML 里，不在这里覆盖。
  document.querySelectorAll('.prizeFeature').forEach(button => {
    const info = tierById[button.dataset.prize];
    if (!info || info.id === 'grand') return;
    const name = button.querySelector('.tierName');
    const en = button.querySelector('.prizeCaption small');
    if (name) name.innerHTML = `${info.name} <span>${info.category}</span>`;
    if (en) en.textContent = info.categoryEn;
  });

  const dialog = document.getElementById('prizeDialog');

  function showTier(id) {
    const info = tierById[id] || { id, name: id, category: '' };
    document.getElementById('prizeDialogTitle').textContent =
      info.category ? `${info.name} · ${info.category}` : info.name;
    document.querySelectorAll('.prizeTabs button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.tier === id)));
    const archive = document.getElementById('prizeArchive');
    archive.replaceChildren();
    (prizes[id] || []).forEach(prize => {
      const figure = document.createElement('figure');
      const img = document.createElement('img');
      img.src = prize.file; img.alt = prize.cn; img.loading = 'lazy';
      const caption = document.createElement('figcaption');
      // 只写档位名的奖品，在图下补上种类，方便和现场实物对照。
      caption.textContent = info.category && prize.cn !== info.category
        ? `${prize.cn} · ${info.category}` : prize.cn;
      figure.append(img, caption); archive.append(figure);
    });
  }

  tiers.forEach(info => {
    const button = document.createElement('button');
    button.textContent = info.category ? `${info.name} · ${info.category}` : info.name;
    button.dataset.tier = info.id;
    button.addEventListener('click', () => showTier(info.id));
    document.getElementById('prizeTabs').append(button);
  });

  function openArchive(id) { showTier(id); dialog.showModal(); }
  document.querySelectorAll('[data-prize]').forEach(button => button.addEventListener('click', () => openArchive(button.dataset.prize)));
  document.getElementById('prizeDetailsBtn').addEventListener('click', () => openArchive(tiers[0] ? tiers[0].id : 'grand'));
  document.getElementById('demoBtn').addEventListener('click', () => document.getElementById('demoDialog').showModal());
  document.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => document.getElementById(button.dataset.close).close()));
  document.querySelectorAll('dialog').forEach(d => d.addEventListener('click', e => { if (e.target === d) { const r = d.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) d.close(); } }));
})();
