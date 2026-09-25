const IMAGE_EXTS = ['png', 'jpg', 'jpeg', 'webp', 'svg'];
const $ = id => document.getElementById(id);
const cardGrid = $('cardGrid'), imageCount = $('imageCount'), codeFilename = $('codeFilename'),
  placeholder = $('placeholder'), codeBlock = $('codeBlock'), codeContent = $('codeContent'),
  copyBtn = $('copyBtn'), copyLabel = $('copyLabel'), search = $('search'), empty = $('empty');
const colBtns = document.querySelectorAll('.col-btn');
const segPill = document.querySelector('.seg-pill');
let activeCard = null;

/* Theme toggle */
$('themeToggle').addEventListener('click', () => {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem('theme', next); } catch {}
});

/* Column switcher with sliding pill */
function setCols(n) {
  colBtns.forEach((b, i) => {
    const on = b.dataset.cols === String(n);
    b.classList.toggle('active', on);
    if (on) segPill.style.transform = `translateX(${i * 30}px)`;
  });
  cardGrid.className = `card-grid cols-${n} reflow`;
  setTimeout(() => cardGrid.classList.remove('reflow'), 400);
}
colBtns.forEach(b => b.addEventListener('click', () => setCols(b.dataset.cols)));
setCols(2);

async function headOk(url) {
  try { return (await fetch(url, { method: 'HEAD' })).ok; } catch { return false; }
}
async function findImageExt(name) {
  for (const ext of IMAGE_EXTS) if (await headOk(`assets/${name}.${ext}`)) return ext;
  return null;
}

const escapeHtml = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function highlightCss(code) {
  return code.split('\n').map(line => {
    let m;
    if ((m = line.match(/^(\s*)(\/\*.*\*\/)\s*$/))) return `${m[1]}<span class="tok-comment">${escapeHtml(m[2])}</span>`;
    if ((m = line.match(/^(\s*)([^{}:]+)\{\s*$/))) return `${m[1]}<span class="tok-selector">${escapeHtml(m[2].trim())}</span> <span class="tok-punct">{</span>`;
    if (line.trim() === '}') return line.replace('}', '<span class="tok-punct">}</span>');
    if ((m = line.match(/^(\s*)([\w-]+)(\s*:\s*)(.+?)(;?)\s*$/)))
      return `${m[1]}<span class="tok-prop">${escapeHtml(m[2])}</span><span class="tok-punct">: </span><span class="tok-value">${escapeHtml(m[4])}</span><span class="tok-punct">${m[5]}</span>`;
    return escapeHtml(line);
  }).join('\n');
}

async function selectCard(card, filename) {
  if (activeCard === card) return;
  activeCard?.classList.remove('active');
  card.classList.add('active');
  activeCard = card;
  card.scrollIntoView({ block: 'nearest', behavior: 'smooth' });

  codeFilename.textContent = `${filename}.txt`;
  copyBtn.disabled = false;
  let text;
  try {
    const res = await fetch(`assets/${filename}.txt`);
    text = res.ok ? await res.text() : '/* code not found */';
  } catch { text = '/* failed to load code */'; }
  if (activeCard !== card) return;
  codeContent.innerHTML = highlightCss(text);
  codeContent.dataset.raw = text;
  placeholder.hidden = true;
  codeBlock.hidden = false;
  codeBlock.scrollTop = 0;
  codeBlock.classList.remove('fade'); void codeBlock.offsetWidth; codeBlock.classList.add('fade');
}

copyBtn.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(codeContent.dataset.raw || '');
    copyBtn.classList.add('copied'); copyLabel.textContent = 'Copied';
  } catch { copyLabel.textContent = 'Failed'; }
  setTimeout(() => { copyBtn.classList.remove('copied'); copyLabel.textContent = 'Copy'; }, 1500);
});

/* Search filter */
search.addEventListener('input', () => {
  const q = search.value.trim().toLowerCase();
  let shown = 0;
  cardGrid.querySelectorAll('.card').forEach(c => {
    const hit = c.dataset.name.toLowerCase().includes(q);
    c.classList.toggle('hide', !hit);
    if (hit) shown++;
  });
  empty.hidden = shown > 0;
});

/* Keyboard: arrow keys move between visible cards */
document.addEventListener('keydown', e => {
  if (e.target === search || !activeCard) return;
  const cards = [...cardGrid.querySelectorAll('.card:not(.hide)')];
  const cols = cardGrid.classList.contains('cols-3') ? 3 : cardGrid.classList.contains('cols-2') ? 2 : 1;
  const step = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: cols, ArrowUp: -cols }[e.key];
  if (!step) return;
  e.preventDefault();
  const next = cards[cards.indexOf(activeCard) + step];
  if (next) { next.focus({ preventScroll: true }); next.click(); }
});

async function init() {
  let manifest = [];
  try { manifest = await (await fetch('manifest.json')).json(); } catch {}

  // parallel lookups (much faster than one-by-one)
  const exts = await Promise.all(manifest.map(findImageExt));
  const entries = manifest.map((filename, i) => ({ filename, ext: exts[i] })).filter(e => e.ext);

  imageCount.textContent = `${entries.length} image${entries.length === 1 ? '' : 's'}`;

  entries.forEach((entry, i) => {
    const card = document.createElement('div');
    card.className = 'card';
    card.tabIndex = 0;
    card.dataset.name = entry.filename;
    card.style.setProperty('--i', i);
    card.innerHTML = `<div class="thumb"><img alt="" loading="lazy"></div><div class="card-name"></div>`;
    const img = card.querySelector('img'), thumb = card.querySelector('.thumb');
    img.alt = entry.filename;
    img.onload = img.onerror = () => thumb.classList.add('loaded');
    img.src = `assets/${entry.filename}.${entry.ext}`;
    card.querySelector('.card-name').textContent = entry.filename;
    card.addEventListener('click', () => selectCard(card, entry.filename));
    card.addEventListener('keydown', e => { if (e.key === 'Enter') selectCard(card, entry.filename); });
    cardGrid.appendChild(card);
    if (i === 0) selectCard(card, entry.filename);
  });
}
init();
