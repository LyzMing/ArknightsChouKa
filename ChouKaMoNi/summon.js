(() => {
  const tiers = { grand: ['特等奖', '影之刃零'], first: ['一等奖', '立牌'], second: ['二等奖', '钥匙扣'], third: ['三等奖', '冰箱贴'] };
  const prizes = window.AK_PRIZES || {};
  const picks = { grand: 0, first: 4, second: 2, third: 3 };
  document.querySelectorAll('[data-art]').forEach(img => {
    const pool = prizes[img.dataset.art] || [];
    const prize = pool[picks[img.dataset.art]] || pool[0];
    if (prize) img.src = prize.file;
  });
  const dialog = document.getElementById('prizeDialog');
  function showTier(id) {
    document.getElementById('prizeDialogTitle').textContent = tiers[id].join(' · ');
    document.querySelectorAll('.prizeTabs button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.tier === id)));
    const archive = document.getElementById('prizeArchive');
    archive.replaceChildren();
    (prizes[id] || []).forEach(prize => {
      const figure = document.createElement('figure');
      const img = document.createElement('img');
      img.src = prize.file; img.alt = prize.cn; img.loading = 'lazy';
      const caption = document.createElement('figcaption'); caption.textContent = prize.cn;
      figure.append(img, caption); archive.append(figure);
    });
  }
  Object.entries(tiers).forEach(([id, names]) => {
    const button = document.createElement('button');
    button.textContent = names.join(' · '); button.dataset.tier = id;
    button.addEventListener('click', () => showTier(id));
    document.getElementById('prizeTabs').append(button);
  });
  function openArchive(id) { showTier(id); dialog.showModal(); }
  document.querySelectorAll('[data-prize]').forEach(button => button.addEventListener('click', () => openArchive(button.dataset.prize)));
  document.getElementById('prizeDetailsBtn').addEventListener('click', () => openArchive('grand'));
  document.getElementById('demoBtn').addEventListener('click', () => document.getElementById('demoDialog').showModal());
  document.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => document.getElementById(button.dataset.close).close()));
  document.querySelectorAll('dialog').forEach(d => d.addEventListener('click', e => { if (e.target === d) { const r = d.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) d.close(); } }));
})();
