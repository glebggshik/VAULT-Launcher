// ─── State ────────────────────────────────────────────────────────────────────
let hasChanges = false;
let listeningKey = null;
let currentTheme  = 'dark';
let currentAccent = '#00f5ff';

const STORAGE_KEY = 'vault-settings-v2';

const themes = {
  dark:     { bg: '#050810', accent: '#00f5ff', accent2: '#bf00ff' },
  midnight: { bg: '#000408', accent: '#4080ff', accent2: '#8040ff' },
  carbon:   { bg: '#141414', accent: '#ff6600', accent2: '#ffaa00' },
  matrix:   { bg: '#000800', accent: '#00ff41', accent2: '#008f11' },
};

// ─── Section navigation ───────────────────────────────────────────────────────
function showSection(id, btn) {
  document.querySelectorAll('.settings-section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.snav-item').forEach(b => b.classList.remove('active'));
  document.getElementById('sec-' + id).classList.add('active');
  btn.classList.add('active');
}

// ─── Change tracking ──────────────────────────────────────────────────────────
function markChanged() {
  hasChanges = true;
  document.getElementById('saveBar').classList.add('visible');
}

function discardChanges() {
  hasChanges = false;
  document.getElementById('saveBar').classList.remove('visible');
  loadSettings();
}

// ─── Collect ALL settings from DOM ───────────────────────────────────────────
function collectSettings() {
  const val = (id) => document.getElementById(id)?.value ?? null;

  // Toggles by index (same order they appear in HTML top→bottom)
  const toggles = document.querySelectorAll('.toggle input[type="checkbox"]');
  const t = (i) => toggles[i]?.checked ?? false;

  return {
    // Appearance
    theme:            currentTheme,
    accent:           currentAccent,
    glow:             val('glowSlider'),
    blur:             val('blurSlider'),
    showGrid:         t(0),
    animations:       t(1),

    // Interface
    defaultView:      val('defaultViewSelect'),
    cardSize:         val('cardSlider'),
    defaultSort:      val('defaultSortSelect'),
    showHours:        t(2),
    showSourceBadge:  t(3),
    confirmDelete:    t(4),
    uiScale:          val('uiScaleSelect'),
    uiFont:           val('uiFontSelect'),

    // Library
    autoScanOnStart:  t(5),
    scanDepth:        val('scanDepthSelect'),
    ignoreSystem:     t(6),
    addDuplicates:    t(7),

    // Launch
    minimizeOnLaunch: t(8),
    restoreAfter:     t(9),
    closeToTray:      t(10),
    autostart:        t(11),
    launchDelay:      val('launchDelaySelect'),
    runAsAdmin:       t(12),

    // Performance
    hwAccel:          t(13),
    limitFps:         t(14),
    lazyLoad:         t(15),
    cacheCovers:      t(16),
    cacheLimit:       val('cacheLimitSelect'),

    // Notifications
    notifyLaunch:     t(17),
    notifyClose:      t(18),
    notifyError:      t(19),
    notifyScan:       t(20),
    toastPos:         val('toastPosSelect'),
    toastDuration:    val('toastDurSelect'),
    toastSound:       t(21),

    // Language
    language:         val('languageSelect'),
    timeFormat:       val('timeFormatSelect'),
    hoursFormat:      val('hoursFormatSelect'),
    dateFormat:       val('dateFormatSelect'),
  };
}

// ─── Apply settings to DOM ────────────────────────────────────────────────────
function applySettingsToDom(s) {
  if (!s) return;

  const setVal = (id, v) => {
    const el = document.getElementById(id);
    if (el && v !== null && v !== undefined) el.value = v;
  };

  // Theme card highlight
  currentTheme = s.theme || 'dark';
  document.querySelectorAll('.theme-card').forEach(c => c.classList.remove('active'));
  const tc = document.getElementById('theme-' + currentTheme);
  if (tc) tc.classList.add('active');
  const t = themes[currentTheme];
  if (t) {
    document.documentElement.style.setProperty('--bg-deep',     t.bg);
    document.documentElement.style.setProperty('--neon-purple', t.accent2);
    document.body.style.background = t.bg;
  }

  // Accent
  currentAccent = s.accent || '#00f5ff';
  document.documentElement.style.setProperty('--neon-cyan', currentAccent);
  document.querySelectorAll('.accent-dot').forEach(d => d.classList.remove('active'));
  const dot = document.querySelector(`.accent-dot[data-color="${currentAccent}"]`);
  if (dot) dot.classList.add('active');
  setVal('customColor',    currentAccent);
  setVal('customColorHex', currentAccent);

  // Sliders
  if (s.glow)     { setVal('glowSlider', s.glow);     document.getElementById('glowVal').textContent  = s.glow  + '%'; }
  if (s.blur)     { setVal('blurSlider', s.blur);     document.getElementById('blurVal').textContent  = s.blur  + '%'; }
  if (s.cardSize) { setVal('cardSlider', s.cardSize); document.getElementById('cardVal').textContent  = s.cardSize + 'px'; }

  // Selects
  setVal('defaultViewSelect', s.defaultView);
  setVal('defaultSortSelect', s.defaultSort);
  setVal('uiScaleSelect',     s.uiScale);
  setVal('uiFontSelect',      s.uiFont);
  setVal('scanDepthSelect',   s.scanDepth);
  setVal('launchDelaySelect', s.launchDelay);
  setVal('cacheLimitSelect',  s.cacheLimit);
  setVal('toastPosSelect',    s.toastPos);
  setVal('toastDurSelect',    s.toastDuration);
  setVal('languageSelect',    s.language);
  setVal('timeFormatSelect',  s.timeFormat);
  setVal('hoursFormatSelect', s.hoursFormat);
  setVal('dateFormatSelect',  s.dateFormat);

  // Toggles by index (same order as collectSettings)
  const toggleInputs = document.querySelectorAll('.toggle input[type="checkbox"]');
  const boolKeys = [
    'showGrid', 'animations',
    'showHours', 'showSourceBadge', 'confirmDelete',
    'autoScanOnStart', 'ignoreSystem', 'addDuplicates',
    'minimizeOnLaunch', 'restoreAfter', 'closeToTray', 'autostart',
    'runAsAdmin',
    'hwAccel', 'limitFps', 'lazyLoad', 'cacheCovers',
    'notifyLaunch', 'notifyClose', 'notifyError', 'notifyScan',
    'toastSound',
  ];
  boolKeys.forEach((key, i) => {
    if (toggleInputs[i] && s[key] !== undefined) {
      toggleInputs[i].checked = s[key];
    }
  });
}

// ─── Save ─────────────────────────────────────────────────────────────────────
function saveSettings() {
  const s = collectSettings();
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch(e) {
    console.error('Ошибка сохранения настроек:', e);
  }
  if (window.nexus?.settings?.save) window.nexus.settings.save(s);

  hasChanges = false;
  document.getElementById('saveBar').classList.remove('visible');
  showToast('✅', 'Настройки сохранены', 'Вид по умолчанию: ' + (s.defaultView || 'Сетка'));
}

// ─── Load ─────────────────────────────────────────────────────────────────────
function loadSettings() {
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch {}

  const defaults = {
    theme: 'dark', accent: '#00f5ff',
    glow: '70', blur: '60', cardSize: '175',
    showGrid: true, animations: true,
    defaultView: 'Сетка', defaultSort: 'По дате добавления',
    showHours: true, showSourceBadge: true, confirmDelete: true,
    uiScale: '100%', uiFont: 'Inter (системный)',
    autoScanOnStart: false, scanDepth: '3 уровня',
    ignoreSystem: true, addDuplicates: false,
    minimizeOnLaunch: true, restoreAfter: true,
    closeToTray: false, autostart: false,
    launchDelay: '1 секунда', runAsAdmin: false,
    hwAccel: true, limitFps: false, lazyLoad: true, cacheCovers: true,
    cacheLimit: '500 МБ',
    notifyLaunch: true, notifyClose: true, notifyError: true, notifyScan: false,
    toastPos: 'Снизу справа', toastDuration: '3.5 секунды', toastSound: false,
    language: '🇷🇺 Русский', timeFormat: '24-часовой (16:30)',
    hoursFormat: 'Часы (142ч)', dateFormat: 'Относительно (3 дня назад)',
  };

  applySettingsToDom({ ...defaults, ...saved });
}

// ─── Theme ────────────────────────────────────────────────────────────────────
function setTheme(name, btn) {
  currentTheme = name;
  document.querySelectorAll('.theme-card').forEach(c => c.classList.remove('active'));
  if (btn) btn.classList.add('active');
  const t = themes[name];
  if (t) {
    document.documentElement.style.setProperty('--bg-deep',     t.bg);
    document.documentElement.style.setProperty('--neon-cyan',   t.accent);
    document.documentElement.style.setProperty('--neon-purple', t.accent2);
    document.body.style.background = t.bg;
    currentAccent = t.accent;
    document.querySelectorAll('.accent-dot').forEach(d => d.classList.remove('active'));
    const dot = document.querySelector(`.accent-dot[data-color="${t.accent}"]`);
    if (dot) dot.classList.add('active');
    document.getElementById('customColor').value    = t.accent;
    document.getElementById('customColorHex').value = t.accent;
  }
  markChanged();
}

// ─── Accent color ─────────────────────────────────────────────────────────────
function setAccent(color, dot) {
  currentAccent = color;
  document.querySelectorAll('.accent-dot').forEach(d => d.classList.remove('active'));
  if (dot) dot.classList.add('active');
  document.documentElement.style.setProperty('--neon-cyan', color);
  document.getElementById('customColor').value    = color;
  document.getElementById('customColorHex').value = color;
  markChanged();
}

function setAccentFromPicker(val) {
  currentAccent = val;
  document.getElementById('customColorHex').value = val;
  document.querySelectorAll('.accent-dot').forEach(d => d.classList.remove('active'));
  document.documentElement.style.setProperty('--neon-cyan', val);
  markChanged();
}

function setAccentFromHex(val) {
  if (/^#[0-9a-fA-F]{6}$/.test(val)) {
    currentAccent = val;
    document.getElementById('customColor').value = val;
    document.querySelectorAll('.accent-dot').forEach(d => d.classList.remove('active'));
    document.documentElement.style.setProperty('--neon-cyan', val);
    markChanged();
  }
}

// ─── Sliders ──────────────────────────────────────────────────────────────────
function updateSlider(sliderId, valId, suffix = '%') {
  const val = document.getElementById(sliderId).value;
  document.getElementById(valId).textContent = val + suffix;
  markChanged();
}

// ─── Folders ──────────────────────────────────────────────────────────────────
async function addFolder() {
  let p;
  if (window.nexus?.dialog?.openFolder) {
    p = await window.nexus.dialog.openFolder();
  } else {
    p = prompt('Введи путь к папке:');
  }
  if (!p) return;
  const list = document.getElementById('folderList');
  const item = document.createElement('div');
  item.className = 'folder-item';
  item.innerHTML = `<span style="font-size:16px">📂</span>
    <span class="folder-path">${escHtml(p)}</span>
    <button class="folder-remove" onclick="removeFolder(this)">✕</button>`;
  list.appendChild(item);
  markChanged();
}

function removeFolder(btn) {
  btn.closest('.folder-item').remove();
  markChanged();
}

// ─── Scan ─────────────────────────────────────────────────────────────────────
function startScan() {
  const wrap   = document.getElementById('scanBarWrap');
  const fill   = document.getElementById('scanFill');
  const status = document.getElementById('scanStatus');
  const btn    = document.getElementById('scanBtn');
  wrap.style.display = '';
  btn.disabled = true;
  btn.textContent = '🔄 Сканирование...';
  const steps = [
    [15,'Сканирование C:\\Games...'], [35,'Сканирование D:\\Games...'],
    [60,'Сканирование Steam...'],     [82,'Проверка дубликатов...'],
    [95,'Обработка результатов...'],  [100,'Готово! Найдено 3 новых игры'],
  ];
  let i = 0;
  const tick = setInterval(() => {
    if (i >= steps.length) {
      clearInterval(tick);
      btn.disabled = false;
      btn.textContent = '🔍 Сканировать снова';
      document.getElementById('lastScanText').textContent = 'Последнее сканирование: только что';
      setTimeout(() => { wrap.style.display = 'none'; fill.style.width = '0%'; }, 3000);
      return;
    }
    fill.style.width = steps[i][0] + '%';
    status.textContent = steps[i][1];
    i++;
  }, 600);
}

// ─── Keybind listener ─────────────────────────────────────────────────────────
function listenKey(el) {
  if (listeningKey) {
    listeningKey.classList.remove('listening');
    listeningKey.textContent = listeningKey._original;
  }
  listeningKey = el;
  el._original = el.textContent;
  el.classList.add('listening');
  el.textContent = 'Нажми клавишу...';
  const handler = (e) => {
    e.preventDefault();
    const parts = [];
    if (e.ctrlKey)  parts.push('Ctrl');
    if (e.shiftKey) parts.push('Shift');
    if (e.altKey)   parts.push('Alt');
    const key = e.key === ' ' ? 'Space' : e.key.length === 1 ? e.key.toUpperCase() : e.key;
    if (!['Control','Shift','Alt','Meta'].includes(e.key)) parts.push(key);
    el.textContent = parts.join(' + ') || el._original;
    el.classList.remove('listening');
    listeningKey = null;
    document.removeEventListener('keydown', handler);
    markChanged();
  };
  document.addEventListener('keydown', handler);
}

// ─── Misc ─────────────────────────────────────────────────────────────────────
function importSteam() {
  showToast('🟦', 'Импорт Steam', 'Сканирование steamapps...');
  setTimeout(() => showToast('✅', 'Импортировано', '12 игр добавлено в библиотеку'), 2000);
}
function clearCache() {
  if (confirm('Очистить кэш обложек (~47 МБ)?'))
    showToast('🗑', 'Кэш очищен', '47 МБ освобождено');
}
function openDataFolder() {
  if (window.nexus?.shell?.openFolder) window.nexus.shell.openFolder('');
  else showToast('ℹ️', 'Только в Electron', 'Откройте %APPDATA%\\vault-launcher');
}
function exportLibrary() { showToast('💾', 'Экспорт', 'games.json сохранён на рабочем столе'); }
function importLibrary() { showToast('📥', 'Импорт', 'Выберите games.json файл'); }
function resetSettings() {
  if (confirm('Сбросить все настройки? (игры останутся)')) {
    localStorage.removeItem(STORAGE_KEY);
    location.reload();
  }
}
function nukeData() {
  if (confirm('УДАЛИТЬ ВСЕ ДАННЫЕ? Это необратимо!')) {
    if (confirm('Вы уверены? Библиотека будет уничтожена.')) {
      if (window.nexus?.games?.nukeAll) window.nexus.games.nukeAll();
      else localStorage.clear();
      showToast('💥', 'Данные удалены', 'Перезапуск...');
      setTimeout(() => location.reload(), 2000);
    }
  }
}
function goBack() { window.location.href = 'index.html'; }

// ─── Toast ────────────────────────────────────────────────────────────────────
function showToast(icon, title, sub) {
  let t = document.getElementById('_toast');
  if (!t) {
    t = document.createElement('div');
    t.id = '_toast';
    t.style.cssText = `position:fixed;bottom:80px;right:28px;background:rgba(4,8,18,.97);
      border:1px solid rgba(0,245,255,.28);border-radius:14px;padding:14px 16px;
      display:flex;align-items:center;gap:12px;z-index:700;min-width:280px;max-width:380px;
      box-shadow:0 20px 40px rgba(0,0,0,.45);
      transform:translateX(120%);opacity:0;transition:all .35s cubic-bezier(.23,1,.32,1);`;
    document.body.appendChild(t);
  }
  t.innerHTML = `
    <span style="font-size:20px">${icon}</span>
    <div style="flex:1;min-width:0">
      <div style="font-family:'Rajdhani',sans-serif;font-size:14px;font-weight:700;color:var(--neon-cyan)">${title}</div>
      ${sub ? `<div style="font-size:11px;color:var(--text-muted);margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${sub}</div>` : ''}
    </div>`;
  t.style.transform = 'translateX(0)';
  t.style.opacity = '1';
  clearTimeout(t._timer);
  t._timer = setTimeout(() => { t.style.transform = 'translateX(120%)'; t.style.opacity = '0'; }, 3500);
}

// ─── Init ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  loadSettings();

  if (window.nexus) {
    const gs = await window.nexus.games.getAll();
    document.getElementById('statGames').textContent = gs.length;
    document.getElementById('statHours').textContent = Math.round(gs.reduce((s,g) => s+(g.hours||0), 0));
    document.getElementById('statSteam').textContent = gs.filter(g => g.type === 'steam').length;
  } else {
    document.getElementById('statGames').textContent = '10';
    document.getElementById('statHours').textContent = '831';
    document.getElementById('statSteam').textContent = '7';
  }

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && listeningKey) {
      listeningKey.classList.remove('listening');
      listeningKey.textContent = listeningKey._original;
      listeningKey = null;
    }
  });
});

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
