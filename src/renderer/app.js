// ─── State ────────────────────────────────────────────────────────────────────
let games         = [];
let currentFilter = 'all';
let currentSort   = 'added';
let currentFolder = null;   // null = все, строка = фильтр по папке
let searchQuery   = '';
let viewMode      = 'grid';
let editingId     = null;
let ctxGameId     = null;
let customFolders = [];     // пользовательские папки

// ─── Init ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  loadCustomFolders();
  await loadGames();
  bindEvents();
  // Показываем экран ввода RAWG ключа при первом запуске
  if (!localStorage.getItem('vault-rawg-skipped') && !getRawgKey()) {
    setTimeout(checkRawgKeyOnStartup, 500);
  }
});

async function loadGames() {
  applyStoredSettings();
  games = window.nexus ? await window.nexus.games.getAll() : getMockGames();
  renderGames();
  renderFolderNav();
}

// ─── Render ───────────────────────────────────────────────────────────────────
function renderGames() {
  const grid = document.getElementById('gamesGrid');
  const list = applyFilterSort(games);

  document.getElementById('gameCount').textContent = `${list.length} ${pluralGames(list.length)}`;

  if (list.length === 0) {
    grid.innerHTML = `<div class="empty-state">
      <div class="empty-icon">🎮</div>
      <div class="empty-text">ИГРЫ НЕ НАЙДЕНЫ</div>
      <div class="empty-sub">${searchQuery ? 'Попробуй другой запрос' : 'Добавь первую игру'}</div>
    </div>`;
    return;
  }
  grid.innerHTML = list.map((g, i) => cardHTML(g, i)).join('');
}

function applyFilterSort(list) {
  let r = [...list];
  if (currentFilter !== 'all') r = r.filter(g => g.type === currentFilter);
  if (currentFolder) r = r.filter(g => (g.folder||'').toLowerCase() === currentFolder.toLowerCase());
  if (searchQuery) { const q = searchQuery.toLowerCase(); r = r.filter(g => g.name.toLowerCase().includes(q)); }
  switch (currentSort) {
    case 'name':       r.sort((a,b) => a.name.localeCompare(b.name)); break;
    case 'hours':      r.sort((a,b) => (b.hours||0) - (a.hours||0)); break;
    case 'lastPlayed': r.sort((a,b) => {
      if (!a.lastPlayed && !b.lastPlayed) return 0;
      if (!a.lastPlayed) return 1; if (!b.lastPlayed) return -1;
      return new Date(b.lastPlayed) - new Date(a.lastPlayed);
    }); break;
  }
  return r;
}

function cardHTML(g, i) {
  const coverUrl = g.cover ||
    (g.type === 'steam' ? `https://cdn.cloudflare.steamstatic.com/steam/apps/${g.appId}/library_600x900.jpg` : '');
  const coverInner = coverUrl
    ? `<img class="card-cover" src="${coverUrl}" alt="${escHtml(g.name)}"
           onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" loading="lazy">
       <div class="cover-placeholder cover-grad-${i%6}" style="display:none">${g.emoji||'🎮'}</div>`
    : `<div class="cover-placeholder cover-grad-${i%6}">${g.emoji||'🎮'}</div>`;

  const hoursText = formatHours(g.hours);
  const folderBadge = g.folder ? `<span class="card-folder-badge">${escHtml(g.folder)}</span>` : '';

  return `<div class="game-card${g.running?' running':''}" id="card-${g.id}" data-id="${g.id}"
       onclick="launchGame(${g.id})" oncontextmenu="showCtxMenu(event,${g.id})"
       style="animation-delay:${Math.min(i*0.04,0.4)}s">
    <div class="running-badge">● PLAYING</div>
    <div class="card-actions">
      <button class="card-action-btn" onclick="openEditModal(event,${g.id})" title="Редактировать">✏️</button>
      <button class="card-action-btn" onclick="deleteGame(event,${g.id})" title="Удалить">🗑</button>
    </div>
    <div class="card-cover-wrap">${coverInner}</div>
    <div class="card-overlay"></div>
    <div class="play-btn">▶</div>
    <div class="card-info">
      <div class="card-name" title="${escHtml(g.name)}">${escHtml(g.name)}</div>
      <div class="card-meta">
        <span class="card-source ${g.type==='steam'?'source-steam':'source-local'}">${g.type==='steam'?'Steam':'Local'}</span>
        <span class="card-hours">${hoursText}</span>
        ${folderBadge}
      </div>
    </div>
  </div>`;
}

// ─── Launch ───────────────────────────────────────────────────────────────────
async function launchGame(id) {
  const game = games.find(g => g.id === id);
  if (!game) return;
  if (game.running) { showToast('⏹','Уже запущена', game.name, false); return; }

  showToast(game.type==='steam'?'🟦':'🚀', `Запуск: ${game.name}`,
    game.type==='steam'?`Steam App ${game.appId}`:(game.path||''), false);

  if (window.nexus) {
    const result = await window.nexus.games.launch(id);
    if (!result.success) showToast('❌','Ошибка запуска', result.error, true);
  } else {
    game.running = true; renderGames();
    setTimeout(() => { game.running = false; game.hours = (game.hours||0) + 0.1; renderGames(); }, 5000);
  }
}

// ─── Delete ───────────────────────────────────────────────────────────────────
async function deleteGame(e, id) {
  e.stopPropagation();
  const game = games.find(g => g.id === id);
  if (!game) return;
  if (window.nexus) await window.nexus.games.delete(id);
  games = games.filter(g => g.id !== id);
  renderGames(); renderFolderNav();
  showToast('🗑','Удалено', game.name, false);
}

// ─── Context Menu ─────────────────────────────────────────────────────────────
function showCtxMenu(e, id) {
  e.preventDefault(); e.stopPropagation();
  ctxGameId = id;
  const menu = document.getElementById('ctxMenu');
  menu.style.visibility = 'hidden';
  menu.classList.add('visible');
  const x = Math.min(e.clientX, window.innerWidth  - menu.offsetWidth  - 10);
  const y = Math.min(e.clientY, window.innerHeight - menu.offsetHeight - 10);
  menu.style.left = x+'px'; menu.style.top = y+'px';
  menu.style.visibility = '';
}
function hideCtxMenu() { document.getElementById('ctxMenu').classList.remove('visible'); }

function bindCtxMenu() {
  document.getElementById('ctxLaunch').onclick = () => { hideCtxMenu(); launchGame(ctxGameId); };
  document.getElementById('ctxEdit').onclick   = () => { hideCtxMenu(); openEditModal(null, ctxGameId); };
  document.getElementById('ctxFolder').onclick = async () => {
    hideCtxMenu();
    const g = games.find(x => x.id === ctxGameId);
    if (!g) return;
    if (g.type === 'local' && g.path && window.nexus) await window.nexus.shell.openFolder(g.path);
    else showToast('ℹ️','Недоступно','Для Steam-игр папка недоступна', false);
  };
  document.getElementById('ctxDelete').onclick = async (e) => { hideCtxMenu(); await deleteGame(e, ctxGameId); };
}

// ─── Modal: ДОБАВИТЬ ──────────────────────────────────────────────────────────
let currentGameType = 'local';

function openModal() {
  editingId = null;
  document.getElementById('modalTitle').textContent = '+ ДОБАВИТЬ ИГРУ';
  document.getElementById('modalSubmitBtn').textContent = 'ДОБАВИТЬ';
  document.getElementById('fieldHours').style.display = 'none';
  document.getElementById('fieldFolderAdd').style.display = '';
  clearForm();
  document.getElementById('modalOverlay').classList.add('open');
  setTimeout(() => { document.getElementById('inputSearch').focus(); checkLinuxHint(); }, 300);
}

function openEditModal(e, id) {
  if (e) e.stopPropagation();
  const game = games.find(g => g.id === id);
  if (!game) return;

  editingId = id;
  document.getElementById('modalTitle').textContent = '✏️ РЕДАКТИРОВАТЬ';
  document.getElementById('modalSubmitBtn').textContent = 'СОХРАНИТЬ';
  document.getElementById('fieldHours').style.display = '';
  document.getElementById('fieldFolderAdd').style.display = 'none';

  // Заполняем форму данными игры
  document.getElementById('inputSearch').value = '';
  document.getElementById('inputName').value   = game.name;
  document.getElementById('inputEmoji').value  = game.emoji || '🎮';
  document.getElementById('inputHours').value  = game.hours || 0;
  document.getElementById('inputFolder').value = game.folder || '';
  document.getElementById('inputCover').value  = game.cover || '';

  setGameType(game.type, document.querySelector(`.type-tab[data-type="${game.type}"]`));

  if (game.type === 'local') {
    document.getElementById('inputPath').value = game.path || '';
  } else {
    document.getElementById('inputAppId').value = game.appId || '';
    previewCover();
  }

  if (game.cover) {
    document.getElementById('coverImg').src = game.cover;
    document.getElementById('coverPreview').style.display = '';
  }

  document.getElementById('modalOverlay').classList.add('open');
  setTimeout(() => document.getElementById('inputName').focus(), 300);
}

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('open');
  editingId = null;
}

function clearForm() {
  ['inputSearch','inputName','inputPath','inputAppId','inputCover','inputEmoji','inputFolderAdd'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  document.getElementById('searchDropdown')?.classList.remove('open');
  hideCoverPreview();
  setGameType('local', document.querySelector('.type-tab[data-type="local"]'));
}

function setGameType(type, btn) {
  currentGameType = type;
  document.querySelectorAll('.type-tab').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  document.getElementById('fieldLocal').style.display = type==='local' ? '' : 'none';
  document.getElementById('fieldSteam').style.display = type==='steam' ? '' : 'none';
}

async function browsePath() {
  if (window.nexus) {
    const p = await window.nexus.dialog.openFile();
    if (p) {
      document.getElementById('inputPath').value = p;
      if (!document.getElementById('inputName').value) {
        const base = p.split(/[\\/]/).pop().replace(/\.(exe|sh|AppImage|bin|x86_64)$/i,'').replace(/[_\-\.]+/g,' ').trim();
        document.getElementById('inputName').value = base.replace(/\b\w/g, c => c.toUpperCase());
      }
    }
  } else {
    showToast('ℹ️','Только в Electron','Диалог доступен в приложении', false);
  }
}

function previewCover() {
  const appId = document.getElementById('inputAppId').value.trim();
  if (appId && /^\d+$/.test(appId)) {
    const url = `https://cdn.cloudflare.steamstatic.com/steam/apps/${appId}/library_600x900.jpg`;
    const img = document.getElementById('coverImg');
    img.src = url;
    img.onload  = () => { document.getElementById('coverPreview').style.display=''; document.getElementById('inputCover').value=url; };
    img.onerror = () => { document.getElementById('coverPreview').style.display='none'; };
  }
}

function hideCoverPreview() {
  document.getElementById('coverPreview').style.display = 'none';
  document.getElementById('coverImg').src = '';
}

function openSteamSearch() {
  window.nexus ? window.nexus.shell.openExternal('https://store.steampowered.com/search/') : window.open('https://store.steampowered.com/search/','_blank');
}

async function submitGame() {
  const name  = document.getElementById('inputName').value.trim();
  const pathV = document.getElementById('inputPath').value.trim();
  const appId = document.getElementById('inputAppId').value.trim();
  const cover = document.getElementById('inputCover').value.trim();
  const emoji = document.getElementById('inputEmoji').value.trim() || '🎮';
  const folder = editingId
    ? document.getElementById('inputFolder').value.trim()
    : document.getElementById('inputFolderAdd').value.trim();
  const hours = editingId ? parseFloat(document.getElementById('inputHours').value) || 0 : undefined;

  if (!name) { shake('inputName'); return; }
  if (currentGameType==='local' && !pathV && !editingId) { shake('inputPath'); return; }
  if (currentGameType==='steam' && !appId) { shake('inputAppId'); return; }

  const data = {
    name, type: currentGameType, cover, emoji, folder,
    path:  currentGameType==='local' ? pathV  : undefined,
    appId: currentGameType==='steam' ? appId  : undefined,
    ...(hours !== undefined ? { hours } : {}),
  };

  if (editingId) {
    // Редактирование
    let updated;
    if (window.nexus) {
      updated = await window.nexus.games.update(editingId, data);
    } else {
      const idx = games.findIndex(g => g.id === editingId);
      if (idx !== -1) { games[idx] = { ...games[idx], ...data }; updated = games[idx]; }
    }
    if (updated) {
      const idx = games.findIndex(g => g.id === editingId);
      if (idx !== -1) games[idx] = updated;
    }
    showToast('✅', `${name} обновлена!`, hours !== undefined ? `Часов: ${hours}` : '', false);
  } else {
    // Добавление
    let newGame;
    if (window.nexus) {
      newGame = await window.nexus.games.add(data);
    } else {
      newGame = { ...data, id: Date.now(), hours: 0, lastPlayed: null, running: false };
    }
    games.unshift(newGame);
    showToast('✅', `${name} добавлена!`, currentGameType==='steam'?`Steam ID: ${appId}`:pathV, false);
  }

  closeModal();
  renderGames();
  renderFolderNav();
}

function shake(inputId) {
  const el = document.getElementById(inputId);
  el.style.borderColor = 'rgba(255,60,60,0.6)';
  el.style.animation = 'none'; el.offsetHeight;
  el.style.animation = 'shake 0.3s ease';
  setTimeout(() => { el.style.borderColor=''; }, 1000);
}

// ─── Folder Manager ───────────────────────────────────────────────────────────
function loadCustomFolders() {
  try { customFolders = JSON.parse(localStorage.getItem('nexus-folders') || '[]'); } catch { customFolders = []; }
}
function saveCustomFolders() {
  localStorage.setItem('nexus-folders', JSON.stringify(customFolders));
}

function getAllFolders() {
  const fromGames = [...new Set(games.map(g => g.folder).filter(Boolean))];
  return [...new Set([...customFolders, ...fromGames])].sort();
}

function renderFolderNav() {
  const list = document.getElementById('folderNavList');
  const folders = getAllFolders();
  list.innerHTML = folders.map(f => `
    <button class="nav-btn nav-folder-btn ${currentFolder===f?'active':''}"
            onclick="setFolderFilter(${JSON.stringify(f)})" title="${escHtml(f)}">
      <span class="nav-icon">📁</span>
      <span class="nav-label">${escHtml(f)}</span>
      <span class="nav-folder-count">${games.filter(g=>(g.folder||'')===f).length}</span>
    </button>`).join('');
}

function setFolderFilter(folder) {
  currentFolder = currentFolder === folder ? null : folder;
  currentFilter = 'all';
  document.querySelectorAll('.filter-tab').forEach(b => b.classList.remove('active'));
  document.querySelector('.filter-tab').classList.add('active');
  renderFolderNav();
  renderGames();
  document.getElementById('headerTitle').textContent = currentFolder ? currentFolder.toUpperCase() : 'LIBRARY';
}

function openFolderManager() {
  renderFolderManagerList();
  document.getElementById('folderManagerOverlay').classList.add('open');
}
function closeFolderManager() {
  document.getElementById('folderManagerOverlay').classList.remove('open');
  renderFolderNav();
}

function renderFolderManagerList() {
  const el = document.getElementById('folderManagerList');
  const folders = getAllFolders();
  if (!folders.length) {
    el.innerHTML = `<div style="color:var(--text-muted);font-size:12px;padding:12px 0">Папок пока нет. Добавь ниже или назначь при добавлении игры.</div>`;
    return;
  }
  el.innerHTML = folders.map(f => `
    <div style="display:flex;align-items:center;gap:8px;padding:6px 10px;background:rgba(255,255,255,.03);border-radius:8px">
      <span style="font-size:14px">📁</span>
      <span style="flex:1;font-size:12px;color:var(--text-primary)">${escHtml(f)}</span>
      <span style="font-size:10px;color:var(--text-muted)">${games.filter(g=>(g.folder||'')===f).length} игр</span>
      <button onclick="deleteCustomFolder(${JSON.stringify(f)})"
              style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:12px;padding:2px 6px"
              title="Удалить папку">✕</button>
    </div>`).join('');
}

function addCustomFolder() {
  const val = document.getElementById('newFolderInput').value.trim();
  if (!val) return;
  if (!customFolders.includes(val)) { customFolders.push(val); saveCustomFolders(); }
  document.getElementById('newFolderInput').value = '';
  renderFolderManagerList();
}

function deleteCustomFolder(name) {
  customFolders = customFolders.filter(f => f !== name);
  saveCustomFolders();
  renderFolderManagerList();
}

// ─── Scan Modal ───────────────────────────────────────────────────────────────
let scannedGames = [];

function openScanModal() {
  document.getElementById('scanOverlay').classList.add('open');
  document.getElementById('scanProgress').style.display = 'none';
  document.getElementById('scanResults').style.display = 'none';
  document.getElementById('scanAddBtn').style.display = 'none';
  document.getElementById('scanRunBtn').style.display = '';
}
function closeScanModal() {
  document.getElementById('scanOverlay').classList.remove('open');
}

async function browseScanFolder() {
  if (window.nexus) {
    const p = await window.nexus.dialog.openFolder();
    if (p) {
      document.getElementById('scanPath').value = p;
      document.getElementById('scanFolder').placeholder = p.split('/').pop() || 'Из папки';
    }
  } else {
    document.getElementById('scanPath').value = '/home/user/games';
  }
}

async function runScan() {
  const folderPath = document.getElementById('scanPath').value.trim();
  if (!folderPath) { shake('scanPath'); return; }

  const depth = parseInt(document.getElementById('scanDepth').value);
  document.getElementById('scanProgress').style.display = '';
  document.getElementById('scanResults').style.display = 'none';
  document.getElementById('scanAddBtn').style.display = 'none';
  document.getElementById('scanRunBtn').disabled = true;

  // Анимация прогресса пока идёт сканирование
  let prog = 0;
  const fill = document.getElementById('scanProgressFill');
  const txt  = document.getElementById('scanProgressText');
  fill.style.width = '5%';
  txt.textContent = 'Сканирование...';
  const progTimer = setInterval(() => {
    prog = Math.min(prog + Math.random() * 15, 85);
    fill.style.width = prog + '%';
  }, 300);

  try {
    let found = [];
    if (window.nexus) {
      found = await window.nexus.folder.scan(folderPath, depth);
    } else {
      // Mock для браузера
      found = [
        { name: 'Cyberpunk 2077', path: folderPath + '/Cyberpunk2077/bin/x64/Cyberpunk2077.exe', ext: '.exe' },
        { name: 'Elden Ring',     path: folderPath + '/ELDEN RING/Game/eldenring.exe',             ext: '.exe' },
        { name: 'GTA V',          path: folderPath + '/Grand Theft Auto V/PlayGTAV.exe',           ext: '.exe' },
      ];
    }

    clearInterval(progTimer);
    fill.style.width = '100%';
    txt.textContent = `Найдено ${found.length} игр`;

    setTimeout(() => {
      document.getElementById('scanProgress').style.display = 'none';
      showScanResults(found);
    }, 600);

  } catch(err) {
    clearInterval(progTimer);
    txt.textContent = '❌ Ошибка: ' + err.message;
  }

  document.getElementById('scanRunBtn').disabled = false;
}

function showScanResults(found) {
  scannedGames = found;
  const wrap = document.getElementById('scanResults');
  const list = document.getElementById('scanResultsList');
  const count = document.getElementById('scanResultsCount');

  // Фильтруем уже добавленные
  const existingPaths = new Set(games.map(g => g.path).filter(Boolean));
  const newFound = found.filter(f => !existingPaths.has(f.path));

  count.textContent = `Найдено ${found.length}, новых: ${newFound.length}`;

  if (!found.length) {
    list.innerHTML = `<div class="sr-empty">Ничего не найдено. Попробуй увеличить глубину поиска.</div>`;
    wrap.style.display = '';
    return;
  }

  list.innerHTML = found.map((g, i) => {
    const isNew = !existingPaths.has(g.path);
    return `<div class="scan-result-item ${isNew?'':'scan-result-exists'}">
      <input type="checkbox" class="scan-check" data-idx="${i}" ${isNew?'checked':''} ${!isNew?'disabled':''}>
      <span style="font-size:13px">🎮</span>
      <div style="flex:1;min-width:0">
        <div style="font-family:'Rajdhani',sans-serif;font-size:13px;font-weight:700;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(g.name)}</div>
        <div style="font-size:10px;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(g.path)}</div>
      </div>
      ${!isNew ? '<span style="font-size:9px;color:var(--neon-cyan);opacity:.6">УЖЕ ЕСТЬ</span>' : ''}
    </div>`;
  }).join('');

  wrap.style.display = '';
  document.getElementById('scanAddBtn').style.display = newFound.length ? '' : 'none';
  document.getElementById('scanRunBtn').style.display = '';
}

function scanToggleAll(checked) {
  document.querySelectorAll('.scan-check:not(:disabled)').forEach(cb => { cb.checked = checked; });
}

async function addScannedGames() {
  const folder = document.getElementById('scanFolder').value.trim();
  const checked = [...document.querySelectorAll('.scan-check:checked')];
  if (!checked.length) { showToast('ℹ️','Ничего не выбрано','', false); return; }

  let added = 0;
  for (const cb of checked) {
    const g = scannedGames[parseInt(cb.dataset.idx)];
    if (!g) continue;
    const data = { name: g.name, type: 'local', path: g.path, cover: '', emoji: '🎮', folder, hours: 0, lastPlayed: null };
    let newGame;
    if (window.nexus) { newGame = await window.nexus.games.add(data); }
    else { newGame = { ...data, id: Date.now() + added, running: false }; }
    games.unshift(newGame);
    added++;
  }

  closeScanModal();
  renderGames();
  renderFolderNav();
  showToast('✅', `Добавлено ${added} игр`, folder ? `В папку: ${folder}` : '', false);
}

// ─── RAWG + Steam Search ──────────────────────────────────────────────────────
// RAWG ключ хранится в localStorage, вводится один раз на экране приветствия
function getRawgKey() {
  return localStorage.getItem('vault-rawg-key') || '';
}
function setRawgKey(key) {
  localStorage.setItem('vault-rawg-key', key.trim());
}
const RAWG_BASE = 'https://api.rawg.io/api';
const STEAM_SEARCH = 'https://store.steampowered.com/api/storesearch/?cc=us&l=en&term=';

let searchTimer   = null;
let selectedResult = null;

async function onSearchInput() {
  const q = document.getElementById('inputSearch').value.trim();
  const spinner = document.getElementById('searchSpinner');
  const dd = document.getElementById('searchDropdown');
  if (q.length < 2) { dd.classList.remove('open'); spinner.classList.remove('visible'); return; }
  clearTimeout(searchTimer);
  searchTimer = setTimeout(async () => {
    spinner.classList.add('visible');
    try {
      const [steamR, rawgR] = await Promise.allSettled([searchSteamStore(q), searchRAWG(q)]);
      const steam = steamR.status==='fulfilled' ? steamR.value : [];
      const rawg  = rawgR.status==='fulfilled'  ? rawgR.value  : [];
      renderSearchDropdown(mergeResults(steam, rawg));
    } catch(e) { renderSearchDropdown(null, e.message); }
    finally { spinner.classList.remove('visible'); }
  }, 350);
}

async function searchSteamStore(query) {
  const res = await fetch(STEAM_SEARCH + encodeURIComponent(query));
  if (res.status === 429) { showRawgKeyScreen('limit'); return []; }
  if (!res.ok) return [];
  const data = await res.json();
  return (data.items||[]).slice(0,8).map(item => ({
    appId: String(item.id), name: item.name,
    coverFull: `https://cdn.cloudflare.steamstatic.com/steam/apps/${item.id}/library_600x900.jpg`,
    price: item.price?.final_formatted || '', source: 'steam',
  }));
}

async function searchRAWG(query) {
  const key = getRawgKey();
  const keyParam = key ? `&key=${key}` : '';
  const res = await fetch(`${RAWG_BASE}/games?search=${encodeURIComponent(query)}&page_size=10${keyParam}`);
  if (!res.ok) return [];
  return (await res.json()).results || [];
}

function mergeResults(steamList, rawgList) {
  const norm = s => s.toLowerCase().replace(/[^a-zа-яё0-9]/gi,'');
  return steamList.map(s => {
    const rawg = rawgList.find(r => { const rn=norm(r.name),sn=norm(s.name); return rn===sn||rn.includes(sn)||sn.includes(rn); });
    return { appId:s.appId, name:s.name, coverFull:s.coverFull, price:s.price,
             rating:rawg?.rating||null, released:rawg?.released||null,
             genres:rawg?.genres||[], platforms:rawg?.platforms||[], cover:s.coverFull };
  });
}

function renderSearchDropdown(results, error) {
  const dd = document.getElementById('searchDropdown');
  if (error) { dd.innerHTML=`<div class="sr-empty">❌ ${escHtml(error)}</div>`; dd.classList.add('open'); return; }
  if (!results?.length) { dd.innerHTML=`<div class="sr-empty">Ничего не найдено</div>`; dd.classList.add('open'); return; }

  dd.innerHTML = results.map((g,i) => `
    <div class="search-result" onclick="selectSearchResult(${i})">
      ${g.cover ? `<img class="sr-cover" src="${g.cover}" loading="lazy" onerror="this.style.opacity='.2'">` : `<div class="sr-cover" style="display:flex;align-items:center;justify-content:center">🎮</div>`}
      <div class="sr-info">
        <div class="sr-name">${escHtml(g.name)}</div>
        <div class="sr-meta">
          ${g.appId    ? `<span class="sr-appid">AppID ${g.appId}</span>` : ''}
          ${g.rating   ? `<span class="sr-rating">⭐${g.rating.toFixed(1)}</span>` : ''}
          ${g.released ? `<span>${g.released.split('-')[0]}</span>` : ''}
          ${g.price    ? `<span style="color:#a4d007">${escHtml(g.price)}</span>` : ''}
        </div>
      </div>
    </div>`).join('');
  dd._results = results;
  dd.classList.add('open');
}

function selectSearchResult(idx) {
  const dd = document.getElementById('searchDropdown');
  const g  = dd._results?.[idx]; if (!g) return;
  selectedResult = g;
  document.getElementById('inputName').value   = g.name;
  document.getElementById('inputSearch').value = g.name;
  if (g.appId) {
    setGameType('steam', document.querySelector('.type-tab[data-type="steam"]'));
    document.getElementById('inputAppId').value = g.appId;
  }
  const cover = g.coverFull || g.cover || '';
  if (cover) {
    document.getElementById('inputCover').value = cover;
    const img = document.getElementById('coverImg');
    img.src = cover;
    img.onload  = () => { document.getElementById('coverPreview').style.display=''; };
    img.onerror = () => { document.getElementById('coverPreview').style.display='none'; };
  }
  document.getElementById('inputEmoji').value = getGenreEmoji(g.genres);
  dd.classList.remove('open');
}

function getPlatformIcons(platforms) {
  if (!platforms) return '';
  const map = {pc:'🖥️',playstation:'🎮',xbox:'🟩',nintendo:'🔴',ios:'📱',android:'📱',mac:'🍎',linux:'🐧'};
  return [...new Set(platforms.map(p => { const s=p.platform?.slug||''; for(const[k,v] of Object.entries(map)) if(s.includes(k)) return v; return ''; }).filter(Boolean))].join('');
}

function getGenreEmoji(genres) {
  if (!genres?.length) return '🎮';
  const map = {action:'⚔️',shooter:'🔫',rpg:'🧙',strategy:'♟️',adventure:'🗺️',puzzle:'🧩',racing:'🏎️',sports:'⚽',simulation:'🏗️',fighting:'🥊',horror:'👻',platformer:'🏃'};
  for (const g of genres) { const s=g.slug||g.name?.toLowerCase()||''; for(const[k,v] of Object.entries(map)) if(s.includes(k)) return v; }
  return '🎮';
}

function checkLinuxHint() {
  const isLinux = navigator.platform.toLowerCase().includes('linux') || (typeof process!=='undefined' && process.platform==='linux');
  const hint = document.getElementById('linuxHint');
  if (hint && isLinux) hint.style.display = '';
}

// ─── Toast ────────────────────────────────────────────────────────────────────
let toastTimer;
function showToast(icon, title, sub, isError) {
  const t = document.getElementById('toast');
  document.getElementById('toastIcon').textContent  = icon;
  document.getElementById('toastTitle').textContent = title;
  document.getElementById('toastSub').textContent   = sub;
  t.classList.toggle('error', !!isError);
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(hideToast, isError ? 5000 : 3500);
}
function hideToast() { document.getElementById('toast').classList.remove('show'); }

// ─── Filters & Search ─────────────────────────────────────────────────────────
function setFilter(f, btn) {
  currentFilter = f; currentFolder = null;
  document.querySelectorAll('.filter-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('headerTitle').textContent = 'LIBRARY';
  renderFolderNav();
  renderGames();
}

function clearSearch() {
  document.getElementById('searchInput').value = '';
  searchQuery = '';
  document.getElementById('searchClear').classList.remove('visible');
  renderGames();
}

function setViewMode(mode) {
  viewMode = mode;
  document.getElementById('gamesGrid').classList.toggle('list-mode', mode==='list');
  document.getElementById('gridBtn').classList.toggle('active', mode==='grid');
  document.getElementById('listBtn').classList.toggle('active', mode==='list');
}

// ─── IPC listeners + client-side playtime timer ───────────────────────────────
const _sessionTimers = {};

function bindIpcListeners() {
  if (!window.nexus) return;

  window.nexus.on('game:started', id => {
    const g = games.find(x => x.id === id);
    if (!g) return;
    g.running    = true;
    g.lastPlayed = new Date().toISOString();
    g._baseHours = g.hours || 0;
    _sessionTimers[id] = {
      startTime: Date.now(),
      intervalId: setInterval(() => {
        const g2 = games.find(x => x.id === id);
        if (!g2) return;
        const elapsed = (Date.now() - _sessionTimers[id].startTime) / 3600000;
        g2.hours = Math.round((g2._baseHours + elapsed) * 100) / 100;
        updateCardHours(id, g2.hours);
      }, 30000),
    };
    renderGames();
  });

  window.nexus.on('game:stopped', id => {
    const g = games.find(x => x.id === id);
    if (g) {
      g.running = false;
      if (_sessionTimers[id]) {
        const elapsed = (Date.now() - _sessionTimers[id].startTime) / 3600000;
        clearInterval(_sessionTimers[id].intervalId);
        delete _sessionTimers[id];
        g.hours = Math.round(((g._baseHours || 0) + elapsed) * 100) / 100;
        delete g._baseHours;
        if (window.nexus && window.nexus.games && window.nexus.games.update)
          window.nexus.games.update(id, { hours: g.hours, lastPlayed: g.lastPlayed });
      }
    }
    renderGames();
  });

  window.nexus.on('game:timeUpdated', ({ id, hours }) => {
    const g = games.find(x => x.id === id);
    if (g && !g.running) { g.hours = hours; renderGames(); }
  });

  window.nexus.on('game:error', ({ id, error }) => {
    const g = games.find(x => x.id === id);
    if (g) { g.running = false; }
    if (_sessionTimers[id]) { clearInterval(_sessionTimers[id].intervalId); delete _sessionTimers[id]; }
    showToast('❌', 'Ошибка запуска', error, true);
    renderGames();
  });

  // game:tick — минутный тик от main.js, синхронизирует часы с файлом
  window.nexus.on('game:tick', ({ id, hours }) => {
    const g = games.find(x => x.id === id);
    if (g && g.running) {
      g.hours = hours;
      updateCardHours(id, hours);
    }
  });
}

function updateCardHours(id, hours) {
  const card = document.getElementById('card-' + id);
  if (!card) return;
  const el = card.querySelector('.card-hours');
  if (el) el.textContent = formatHours(hours);
}

function formatHours(h) {
  if (!h || h === 0) return 'Не запускалась';
  if (h < 1) return Math.round(h * 60) + 'мин';
  return h.toFixed(h < 10 ? 1 : 0) + 'ч';
}

// ─── Bind events ──────────────────────────────────────────────────────────────
function bindEvents() {
  document.getElementById('searchInput').addEventListener('input', e => {
    searchQuery = e.target.value;
    document.getElementById('searchClear').classList.toggle('visible', !!searchQuery);
    renderGames();
  });
  document.getElementById('sortSelect').addEventListener('change', e => { currentSort=e.target.value; renderGames(); });
  document.getElementById('modalOverlay').addEventListener('click', e => { if (e.target===document.getElementById('modalOverlay')) closeModal(); });
  document.getElementById('scanOverlay').addEventListener('click', e => { if (e.target===document.getElementById('scanOverlay')) closeScanModal(); });
  document.getElementById('folderManagerOverlay').addEventListener('click', e => { if (e.target===document.getElementById('folderManagerOverlay')) closeFolderManager(); });
  document.addEventListener('click', e => {
    if (!e.target.closest('#ctxMenu')) hideCtxMenu();
    if (!e.target.closest('.search-dropdown') && !e.target.closest('#inputSearch')) document.getElementById('searchDropdown')?.classList.remove('open');
  });
  document.addEventListener('keydown', e => {
    if (e.key==='Escape') { closeModal(); closeScanModal(); closeFolderManager(); hideCtxMenu(); }
  });
  document.getElementById('newFolderInput')?.addEventListener('keydown', e => { if(e.key==='Enter') addCustomFolder(); });
  bindCtxMenu();
  bindIpcListeners();

  document.querySelectorAll('.nav-btn[data-view]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.nav-btn[data-view]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFolder = null;
      const v = btn.dataset.view;
      if (v==='steam')   { currentFilter='steam';  currentSort='added'; }
      else if (v==='local') { currentFilter='local';  currentSort='added'; }
      else if (v==='recent'){ currentFilter='all';   currentSort='lastPlayed'; document.getElementById('sortSelect').value='lastPlayed'; }
      else                  { currentFilter='all';   currentSort='added'; document.getElementById('sortSelect').value='added'; }
      document.querySelectorAll('.filter-tab').forEach(b=>b.classList.remove('active'));
      document.querySelector('.filter-tab').classList.add('active');
      document.getElementById('headerTitle').textContent = v==='recent'?'НЕДАВНИЕ':v==='steam'?'STEAM':v==='local'?'ЛОКАЛЬНЫЕ':'LIBRARY';
      renderFolderNav();
      renderGames();
    });
  });
}

// ─── Settings & applyStoredSettings ──────────────────────────────────────────
function applyStoredSettings() {
  try {
    const s = JSON.parse(localStorage.getItem('vault-settings-v2') || '{}');
    const themes = { dark:{bg:'#050810',accent:'#00f5ff',accent2:'#bf00ff'}, midnight:{bg:'#000408',accent:'#4080ff',accent2:'#8040ff'}, carbon:{bg:'#141414',accent:'#ff6600',accent2:'#ffaa00'}, matrix:{bg:'#000800',accent:'#00ff41',accent2:'#008f11'} };
    const t = themes[s.theme];
    if (t) { document.documentElement.style.setProperty('--bg-deep',t.bg); document.documentElement.style.setProperty('--neon-purple',t.accent2); document.body.style.background=t.bg; }
    const accent = s.accent || (t&&t.accent) || '#00f5ff';
    document.documentElement.style.setProperty('--neon-cyan', accent);
    if (s.defaultView==='Список') {
      viewMode='list';
      document.getElementById('gamesGrid')?.classList.add('list-mode');
      document.getElementById('gridBtn')?.classList.remove('active');
      document.getElementById('listBtn')?.classList.add('active');
    }
    if (s.defaultSort) {
      const map={'По дате добавления':'added','По названию':'name','По времени игры':'hours','Последние запущенные':'lastPlayed'};
      currentSort = map[s.defaultSort] || 'added';
      const sel = document.getElementById('sortSelect'); if (sel) sel.value = currentSort;
    }
  } catch(e) {}
}
function openSettings() { window.location.href = 'settings.html'; }

// ─── Utils ────────────────────────────────────────────────────────────────────
function escHtml(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function pluralGames(n) {
  if (n%100>=11&&n%100<=19) return 'игр';
  switch(n%10){case 1:return 'игра';case 2:case 3:case 4:return 'игры';default:return 'игр';}
}

function getMockGames() {
  return [
    {id:1,name:"Cyberpunk 2077",      type:"steam",appId:"1091500",cover:"",emoji:"🌃",hours:142, lastPlayed:"2024-01-10",running:false,folder:"RPG"},
    {id:2,name:"Elden Ring",          type:"steam",appId:"1245620",cover:"",emoji:"⚔️",hours:87,  lastPlayed:"2024-01-05",running:false,folder:"Souls-like"},
    {id:3,name:"GTA V",              type:"local",path:"C:\\Games\\GTAV\\PlayGTAV.exe",cover:"https://cdn.cloudflare.steamstatic.com/steam/apps/271590/library_600x900.jpg",emoji:"🔫",hours:230,lastPlayed:"2023-12-28",running:false,folder:"Action"},
    {id:4,name:"Red Dead Redemption 2",type:"steam",appId:"1174180",cover:"",emoji:"🤠",hours:64,lastPlayed:"2024-01-01",running:false,folder:"Action"},
    {id:5,name:"Hogwarts Legacy",     type:"local",path:"C:\\Games\\Hogwarts\\HogwartsLegacy.exe",cover:"https://cdn.cloudflare.steamstatic.com/steam/apps/990080/library_600x900.jpg",emoji:"🪄",hours:38,lastPlayed:"2023-11-20",running:false,folder:"RPG"},
    {id:6,name:"The Witcher 3",       type:"steam",appId:"292030", cover:"",emoji:"🐺",hours:196,lastPlayed:"2023-10-15",running:false,folder:"RPG"},
    {id:7,name:"Baldur's Gate 3",     type:"steam",appId:"1086940",cover:"",emoji:"🎲",hours:55, lastPlayed:"2024-01-08",running:false,folder:"RPG"},
    {id:8,name:"AC Mirage",           type:"local",path:"C:\\Games\\ACMirage\\ACMirage.exe",cover:"",emoji:"🗡️",hours:22,lastPlayed:"2023-12-01",running:false,folder:"Action"},
    {id:9,name:"Starfield",           type:"steam",appId:"1716740",cover:"",emoji:"🚀",hours:15, lastPlayed:"2023-09-10",running:false,folder:""},
    {id:10,name:"Alan Wake 2",        type:"local",path:"C:\\Games\\AlanWake2\\AlanWake2.exe",cover:"https://cdn.cloudflare.steamstatic.com/steam/apps/1675970/library_600x900.jpg",emoji:"💡",hours:12,lastPlayed:"2023-11-05",running:false,folder:"Horror"},
  ];
}

// Стиль shake
const styleEl = document.createElement('style');
styleEl.textContent = `
@keyframes shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
.nav-folder-btn{padding:6px 12px 6px 16px!important;font-size:12px!important}
.nav-folder-count{margin-left:auto;font-size:9px;opacity:.5;background:rgba(255,255,255,.07);padding:1px 5px;border-radius:8px}
.nav-folder-header{display:flex;align-items:center;justify-content:space-between;padding:4px 12px 2px;margin-top:4px}
.nav-folder-add{background:none;border:none;color:var(--neon-cyan);cursor:pointer;font-size:16px;line-height:1;opacity:.7;transition:opacity .2s}.nav-folder-add:hover{opacity:1}
.scan-results-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;font-family:'Rajdhani',sans-serif;font-size:12px;color:var(--text-muted)}
.scan-results-list{display:flex;flex-direction:column;gap:4px;max-height:260px;overflow-y:auto}
.scan-result-item{display:flex;align-items:center;gap:10px;padding:7px 10px;background:rgba(255,255,255,.03);border-radius:8px;border:1px solid rgba(255,255,255,.05)}
.scan-result-exists{opacity:.45}
.scan-result-item input[type=checkbox]{accent-color:var(--neon-cyan);width:14px;height:14px;flex-shrink:0}
.card-folder-badge{font-size:9px;background:rgba(0,245,255,.1);border:1px solid rgba(0,245,255,.2);color:var(--neon-cyan);padding:1px 5px;border-radius:6px;letter-spacing:.5px}
.scan-bar-wrap{height:4px;background:rgba(255,255,255,.07);border-radius:2px;overflow:hidden;margin-bottom:6px}
.scan-bar-fill{height:100%;background:var(--neon-cyan);transition:width .3s ease;border-radius:2px}
.scan-status{font-size:11px;color:var(--text-muted);font-family:'Rajdhani',sans-serif}
`;
document.head.appendChild(styleEl);

// ─── RAWG API Key Setup Screen ────────────────────────────────────────────────
function checkRawgKeyOnStartup() {
  const key = getRawgKey();
  if (!key) showRawgKeyScreen('first');
}

function showRawgKeyScreen(reason) {
  const overlay = document.getElementById('rawgKeyOverlay');
  const title   = document.getElementById('rawgKeyTitle');
  const hint    = document.getElementById('rawgKeyHint');
  const input   = document.getElementById('rawgKeyInput');

  if (reason === 'first') {
    title.textContent = '🔑 ДОБРО ПОЖАЛОВАТЬ В VAULT';
    hint.innerHTML = `Для поиска игр по названию используется <b>RAWG API</b> — бесплатная база данных игр.<br><br>
      Получи бесплатный ключ (20 000 запросов/месяц):<br>
      1. Зайди на <a href="#" onclick="openExtLink('https://rawg.io/apidocs')" style="color:var(--neon-cyan)">rawg.io/apidocs</a><br>
      2. Нажми <b>Get API key</b> и зарегистрируйся<br>
      3. Вставь ключ ниже<br><br>
      <span style="opacity:.6;font-size:11px">Можно пропустить — поиск будет работать через Steam Store без метаданных RAWG</span>`;
  } else if (reason === 'invalid') {
    title.textContent = '⚠️ НЕВЕРНЫЙ RAWG КЛЮЧ';
    hint.innerHTML = `Текущий ключ отклонён сервером (401).<br>Обнови ключ или получи новый на <a href="#" onclick="openExtLink('https://rawg.io/apidocs')" style="color:var(--neon-cyan)">rawg.io/apidocs</a>`;
    input.value = getRawgKey();
  } else if (reason === 'limit') {
    title.textContent = '⚠️ ЛИМИТ RAWG КЛЮЧА ИСЧЕРПАН';
    hint.innerHTML = `Ключ исчерпал лимит запросов (429).<br>Получи новый на <a href="#" onclick="openExtLink('https://rawg.io/apidocs')" style="color:var(--neon-cyan)">rawg.io/apidocs</a> или подожди сброса в начале месяца.`;
    input.value = getRawgKey();
  }

  overlay.classList.add('open');
  setTimeout(() => input.focus(), 300);
}

function saveRawgKey() {
  const key = document.getElementById('rawgKeyInput').value.trim();
  if (key && key.length < 10) {
    document.getElementById('rawgKeyInput').style.borderColor = 'rgba(255,60,60,.6)';
    document.getElementById('rawgKeyError').textContent = 'Ключ слишком короткий';
    return;
  }
  if (key) setRawgKey(key);
  document.getElementById('rawgKeyOverlay').classList.remove('open');
  if (key) showToast('✅', 'RAWG ключ сохранён', 'Поиск с метаданными активирован', false);
  else     showToast('ℹ️', 'Пропущено', 'Работает только Steam поиск', false);
}

function skipRawgKey() {
  // Ставим маркер что пользователь осознанно пропустил — не спрашиваем снова
  localStorage.setItem('vault-rawg-skipped', '1');
  document.getElementById('rawgKeyOverlay').classList.remove('open');
  showToast('ℹ️', 'Пропущено', 'Поиск через Steam Store всё равно работает', false);
}

function openExtLink(url) {
  if (window.nexus?.shell?.openExternal) window.nexus.shell.openExternal(url);
  else window.open(url, '_blank');
}
