/* lilPalette - native lilAgents build.
 * Form -> /.netlify/functions/palette-generate (Gemini, key stays server-side)
 * -> swatches + canvas mood board PNG. Falls back to a local industry palette
 * if the function or AI is unavailable, so the tool always returns something.
 */
(function () {
  const USAGE_KEY = 'colorPaletteUsageCount';
  const USAGE_LIMIT = 3;

  const form = document.getElementById('palette-form');
  if (!form) return;

  const bizName = document.getElementById('biz-name');
  const bizTagline = document.getElementById('biz-tagline');
  const bizIndustry = document.getElementById('biz-industry');
  const generateBtn = document.getElementById('generate-btn');
  const results = document.getElementById('palette-results');
  const swatchesEl = document.getElementById('swatches');
  const canvas = document.getElementById('moodboard-canvas');
  const downloadBtn = document.getElementById('download-btn');
  const modal = document.getElementById('usage-modal');
  const modalLater = document.getElementById('modal-later');
  const remainingEl = document.getElementById('remaining-uses');

  let currentBusiness = null;
  const cache = new Map();

  /* ---------- usage limit (per browser, like the original) ---------- */
  function getUsage() {
    const n = parseInt(localStorage.getItem(USAGE_KEY) || '0', 10);
    return Number.isFinite(n) ? n : 0;
  }
  function remaining() { return Math.max(0, USAGE_LIMIT - getUsage()); }
  function canUse() { return getUsage() < USAGE_LIMIT; }
  function incrementUsage() {
    localStorage.setItem(USAGE_KEY, String(getUsage() + 1));
    updateRemaining();
  }
  function updateRemaining() {
    if (!remainingEl) return;
    const r = remaining();
    remainingEl.textContent = r > 0
      ? `${r} free generation${r === 1 ? '' : 's'} left`
      : 'No free generations left';
  }

  /* ---------- toast ---------- */
  let toastTimer;
  function toast(message) {
    let el = document.getElementById('palette-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'palette-toast';
      el.className = 'palette-toast';
      document.body.appendChild(el);
    }
    el.textContent = message;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
  }

  /* ---------- local fallback palette (industry-keyed) ---------- */
  const industryColorMaps = {
    coffee: ['#8B4513', '#D2B48C', '#F5DEB3', '#A0522D', '#CD853F', '#DEB887'],
    restaurant: ['#FF6B35', '#2E8B57', '#FFD700', '#DC143C', '#4169E1', '#32CD32'],
    tech: ['#4285F4', '#34A853', '#FBBC04', '#EA4335', '#9C27B0', '#FF9800'],
    healthcare: ['#00BCD4', '#4CAF50', '#E3F2FD', '#81C784', '#26A69A', '#66BB6A'],
    beauty: ['#E91E63', '#F48FB1', '#FCE4EC', '#FF69B4', '#DA70D6', '#DDA0DD'],
    finance: ['#1565C0', '#424242', '#37474F', '#2196F3', '#607D8B', '#90A4AE'],
    hospitality: ['#D2691E', '#F4A460', '#DEB887', '#BC8F8F', '#CD853F', '#B8860B'],
    retail: ['#FF1493', '#00CED1', '#FFD700', '#32CD32', '#FF69B4', '#1E90FF'],
    creative: ['#9370DB', '#FF6347', '#20B2AA', '#FFD700', '#FF69B4', '#00FA9A'],
  };
  function fallbackColors(industry) {
    const key = (industry || '').toLowerCase();
    let colors = industryColorMaps.creative;
    for (const k of Object.keys(industryColorMaps)) {
      if (key.includes(k)) { colors = industryColorMaps[k]; break; }
    }
    return colors.slice(0, 5 + Math.floor(Math.random() * 2)).map((h) => h.toUpperCase());
  }

  /* ---------- generation ---------- */
  async function generate(data) {
    const cacheKey = `${data.businessName.toLowerCase()}|${data.industry.toLowerCase()}|${(data.tagline || '').toLowerCase()}`;
    if (cache.has(cacheKey)) return { colors: cache.get(cacheKey), source: 'cache' };
    try {
      const res = await fetch('/.netlify/functions/palette-generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('function ' + res.status);
      const payload = await res.json();
      const colors = Array.isArray(payload.colors) ? payload.colors.map((h) => String(h).toUpperCase()) : [];
      if (colors.length >= 5) {
        cache.set(cacheKey, colors);
        return { colors, source: 'ai' };
      }
      throw new Error('bad response');
    } catch (e) {
      return { colors: fallbackColors(data.industry), source: 'fallback' };
    }
  }

  /* ---------- swatches ---------- */
  function renderSwatches(colors) {
    swatchesEl.innerHTML = '';
    colors.forEach((hex) => {
      const wrap = document.createElement('div');
      wrap.className = 'swatch-item';

      const box = document.createElement('button');
      box.type = 'button';
      box.className = 'swatch-box';
      box.style.backgroundColor = hex;
      box.title = `Copy ${hex}`;
      box.setAttribute('aria-label', `Copy ${hex}`);
      box.addEventListener('click', () => copyHex(hex));

      const label = document.createElement('span');
      label.className = 'swatch-hex';
      label.textContent = hex.toUpperCase();

      wrap.appendChild(box);
      wrap.appendChild(label);
      swatchesEl.appendChild(wrap);
    });
  }
  async function copyHex(hex) {
    try {
      await navigator.clipboard.writeText(hex);
      toast(`Copied ${hex.toUpperCase()}`);
    } catch {
      toast('Copy failed');
    }
  }

  /* ---------- mood board canvas (downloadable PNG) ---------- */
  function drawMoodBoard(colors, business) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = 800;
    canvas.height = 600;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#1a1a1a';
    ctx.font = 'bold 32px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(business.businessName, canvas.width / 2, 60);

    if (business.tagline) {
      ctx.font = '16px Inter, sans-serif';
      ctx.fillStyle = '#666666';
      ctx.fillText(business.tagline, canvas.width / 2, 90);
    }

    const swatchSize = 100;
    const spacing = 20;
    const totalWidth = colors.length * swatchSize + (colors.length - 1) * spacing;
    const startX = (canvas.width - totalWidth) / 2;
    const startY = 150;

    colors.forEach((hex, index) => {
      const x = startX + index * (swatchSize + spacing);
      ctx.fillStyle = hex;
      ctx.fillRect(x, startY, swatchSize, swatchSize);
      ctx.strokeStyle = '#e0e0e0';
      ctx.lineWidth = 1;
      ctx.strokeRect(x, startY, swatchSize, swatchSize);
      ctx.fillStyle = '#1a1a1a';
      ctx.font = '12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(hex.toUpperCase(), x + swatchSize / 2, startY + swatchSize + 20);
    });

    const combY = 320;
    ctx.fillStyle = '#1a1a1a';
    ctx.font = 'bold 18px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Color Combinations', canvas.width / 2, combY);

    if (colors.length >= 2) {
      const combSize = 60;
      const combinations = [
        [colors[0], colors[1]],
        [colors[1], colors[2] || colors[0]],
        [colors[2] || colors[0], colors[3] || colors[1]],
      ];
      combinations.forEach((combo, index) => {
        const baseX = 150 + index * 200;
        const baseY = combY + 40;
        ctx.fillStyle = combo[0];
        ctx.fillRect(baseX, baseY, combSize, combSize);
        ctx.fillStyle = combo[1];
        ctx.fillRect(baseX + combSize, baseY, combSize, combSize);
        ctx.strokeStyle = '#e0e0e0';
        ctx.lineWidth = 1;
        ctx.strokeRect(baseX, baseY, combSize * 2, combSize);
      });
    }

    ctx.fillStyle = '#999999';
    ctx.font = '12px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Generated by lilPalette, the color brand generator by lilAgents.', canvas.width / 2, canvas.height - 30);
  }
  function downloadMoodBoard() {
    if (!canvas || !currentBusiness) return;
    try {
      const link = document.createElement('a');
      link.download = `${currentBusiness.businessName.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'brand'}_color_palette.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      toast('Mood board downloaded');
    } catch {
      toast('Download failed');
    }
  }

  /* ---------- submit ---------- */
  function setLoading(loading) {
    generateBtn.disabled = loading;
    generateBtn.textContent = loading ? 'Generating Colors...' : 'Generate Color Palette';
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = {
      businessName: (bizName.value || '').trim(),
      tagline: (bizTagline.value || '').trim(),
      industry: (bizIndustry.value || '').trim(),
    };
    if (!data.businessName || !data.industry) return;

    if (!canUse()) { openModal(); return; }

    setLoading(true);
    const { colors, source } = await generate(data);
    currentBusiness = data;

    renderSwatches(colors);
    drawMoodBoard(colors, data);
    results.classList.remove('hidden');
    incrementUsage();
    setLoading(false);

    if (source === 'fallback') toast('Showing a starter palette (AI unavailable)');
    else toast(`Generated ${colors.length} colors for ${data.businessName}`);

    results.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  if (downloadBtn) downloadBtn.addEventListener('click', downloadMoodBoard);

  /* ---------- modal ---------- */
  function openModal() { if (modal) modal.classList.remove('hidden'); }
  function closeModal() { if (modal) modal.classList.add('hidden'); }
  if (modalLater) modalLater.addEventListener('click', closeModal);
  if (modal) modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

  updateRemaining();
})();
