const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const path  = require('path');
const fs    = require('fs');
const { spawn, exec, execSync } = require('child_process');

// ─── Хранилище ────────────────────────────────────────────────────────────────
const DATA_PATH = path.join(app.getPath('userData'), 'games.json');

function loadGames() {
  try {
    if (fs.existsSync(DATA_PATH)) return JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
  } catch(e) { console.error('Ошибка загрузки:', e); }
  return [
    { id:1, name:"Cyberpunk 2077",       type:"steam", appId:"1091500", cover:"", emoji:"🌃", hours:0, lastPlayed:null, running:false, folder:"" },
    { id:2, name:"Elden Ring",           type:"steam", appId:"1245620", cover:"", emoji:"⚔️", hours:0, lastPlayed:null, running:false, folder:"" },
    { id:3, name:"The Witcher 3",        type:"steam", appId:"292030",  cover:"", emoji:"🐺", hours:0, lastPlayed:null, running:false, folder:"" },
    { id:4, name:"Baldur's Gate 3",      type:"steam", appId:"1086940", cover:"", emoji:"🎲", hours:0, lastPlayed:null, running:false, folder:"" },
    { id:5, name:"Red Dead Redemption 2",type:"steam", appId:"1174180", cover:"", emoji:"🤠", hours:0, lastPlayed:null, running:false, folder:"" },
  ];
}

function saveGames(games) {
  try { fs.writeFileSync(DATA_PATH, JSON.stringify(games, null, 2), 'utf8'); }
  catch(e) { console.error('Ошибка сохранения:', e); }
}

let games = loadGames();
let runningProcesses = {}; // id -> { process, startTime, ticker }

// ─── Окно ─────────────────────────────────────────────────────────────────────
let mainWindow;
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280, height: 800, minWidth: 900, minHeight: 600,
    frame: false, transparent: false, backgroundColor: '#050810',
    webPreferences: {
      nodeIntegration: false, contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'), webSecurity: true,
    },
    icon: path.join(__dirname, '../../assets', process.platform === 'win32' ? 'icon.ico' : 'icon.png'),
    titleBarStyle: 'hidden',
  });
  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  if (process.argv.includes('--dev')) mainWindow.webContents.openDevTools();
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });

// ─── IPC: Окно ────────────────────────────────────────────────────────────────
ipcMain.on('window:minimize', () => mainWindow.minimize());
ipcMain.on('window:maximize', () => mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize());
ipcMain.on('window:close',    () => mainWindow.close());

// ─── IPC: Игры ────────────────────────────────────────────────────────────────
ipcMain.handle('games:getAll', () =>
  games.map(g => ({ ...g, running: !!runningProcesses[g.id] }))
);

ipcMain.handle('games:add', (_, game) => {
  const newGame = { ...game, id: Date.now(), hours: Number(game.hours)||0, lastPlayed: game.lastPlayed||null, running: false, folder: game.folder||'' };
  games.unshift(newGame);
  saveGames(games);
  return newGame;
});

ipcMain.handle('games:delete', (_, id) => {
  games = games.filter(g => g.id !== id);
  saveGames(games);
  return true;
});

// Полное обновление игры (для редактирования)
ipcMain.handle('games:update', (_, id, data) => {
  const idx = games.findIndex(g => g.id === id);
  if (idx === -1) return null;
  // hours — число, защита от NaN
  if (data.hours !== undefined) data.hours = Math.max(0, Number(data.hours) || 0);
  games[idx] = { ...games[idx], ...data };
  saveGames(games);
  return games[idx];
});

// ─── IPC: Запуск ──────────────────────────────────────────────────────────────
ipcMain.handle('games:launch', async (_, id) => {
  const game = games.find(g => g.id === id);
  if (!game) return { success: false, error: 'Игра не найдена' };
  if (runningProcesses[id]) return { success: false, error: 'Игра уже запущена' };

  try {
    const startTime = Date.now();

    if (game.type === 'steam') {
      await shell.openExternal(`steam://rungameid/${game.appId}`);

      // Для Steam нет процесса — считаем время тикером каждые 30 сек
      const ticker = setInterval(() => {
        if (!runningProcesses[id]) { clearInterval(ticker); return; }
        const hrs = (Date.now() - runningProcesses[id].startTime) / 3600000;
        // Обновляем live но не сохраняем каждый тик — только при остановке
        mainWindow?.webContents.send('game:tick', { id, hours: round1(games.find(g=>g.id===id)?.hours||0) + round1(hrs) });
      }, 30000);

      runningProcesses[id] = { process: null, startTime, ticker };

      // Снимаем running через 15 сек (Steam запустился, передаём управление)
      setTimeout(() => {
        if (!runningProcesses[id]) return;
        const elapsed = (Date.now() - runningProcesses[id].startTime) / 3600000;
        clearInterval(runningProcesses[id].ticker);
        updatePlayTime(id, elapsed);
        delete runningProcesses[id];
        mainWindow?.webContents.send('game:stopped', id);
      }, 15000);

    } else if (game.type === 'local') {
      if (!fs.existsSync(game.path)) return { success: false, error: `Файл не найден:\n${game.path}` };

      const isWindows = process.platform === 'win32';
      const isExe     = game.path.toLowerCase().endsWith('.exe');
      let cmd, args;

      if (!isWindows && isExe) {
        const launcher = detectLinuxLauncher();
        if (!launcher) return {
          success: false,
          error: `Для запуска .exe на Linux нужен Wine.\n\nУстановите:\nsudo pacman -S wine\n\nИли добавьте игру как стороннее приложение в Steam — он использует Proton автоматически.`
        };
        cmd = launcher.cmd; args = [...launcher.args, game.path];
      } else {
        cmd = game.path; args = [];
      }

      // ВАЖНО: сначала навешиваем обработчики, потом unref()
      const proc = spawn(cmd, args, {
        detached: true,
        cwd: path.dirname(game.path),
        stdio: 'ignore',
      });

      // Тикер — обновляем часы каждые 60 сек в реальном времени
      const ticker = setInterval(() => {
        if (!runningProcesses[id]) { clearInterval(ticker); return; }
        const elapsed = (Date.now() - runningProcesses[id].startTime) / 3600000;
        const base = games.find(g => g.id === id)?.hours || 0;
        mainWindow?.webContents.send('game:tick', { id, hours: round1(base + elapsed) });
      }, 60000);

      runningProcesses[id] = { process: proc, startTime, ticker };

      proc.on('exit', (code) => {
        const rp = runningProcesses[id];
        if (!rp) return;
        clearInterval(rp.ticker);
        const elapsed = (Date.now() - rp.startTime) / 3600000;
        updatePlayTime(id, elapsed);
        delete runningProcesses[id];
        mainWindow?.webContents.send('game:stopped', id);
      });

      proc.on('error', (err) => {
        const rp = runningProcesses[id];
        if (rp) { clearInterval(rp.ticker); delete runningProcesses[id]; }
        let msg = err.message;
        if (err.code === 'ENOENT') msg = (!isWindows && isExe) ? `Wine не найден.\nsudo pacman -S wine` : `Файл не найден: ${cmd}`;
        else if (err.code === 'EACCES') msg = `Нет прав на запуск.\nchmod +x "${game.path}"`;
        mainWindow?.webContents.send('game:error', { id, error: msg });
      });

      // unref ПОСЛЕ навешивания обработчиков!
      proc.unref();
    }

    // Обновляем lastPlayed
    const idx = games.findIndex(g => g.id === id);
    if (idx !== -1) { games[idx].lastPlayed = new Date().toISOString(); saveGames(games); }

    mainWindow?.webContents.send('game:started', id);
    return { success: true };
  } catch(err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('games:stop', (_, id) => {
  const rp = runningProcesses[id];
  if (rp?.ticker) clearInterval(rp.ticker);
  if (rp?.process) {
    try {
      if (process.platform === 'win32') exec(`taskkill /pid ${rp.process.pid} /T /F`);
      else rp.process.kill('SIGTERM');
    } catch(e) {}
  }
  if (runningProcesses[id]) {
    const elapsed = (Date.now() - runningProcesses[id].startTime) / 3600000;
    updatePlayTime(id, elapsed);
    delete runningProcesses[id];
    mainWindow?.webContents.send('game:stopped', id);
  }
  return true;
});

// ─── Определение Wine/Proton ──────────────────────────────────────────────────
function detectLinuxLauncher() {
  try { const p = execSync('which wine 2>/dev/null').toString().trim(); if (p) return { cmd: p, args: [] }; } catch {}
  try { const p = execSync('which wine64 2>/dev/null').toString().trim(); if (p) return { cmd: p, args: [] }; } catch {}
  try { execSync('flatpak list 2>/dev/null | grep -i wine', { stdio:'pipe' }); return { cmd:'flatpak', args:['run','org.winehq.Wine'] }; } catch {}
  return null;
}

function updatePlayTime(id, hoursElapsed) {
  const idx = games.findIndex(g => g.id === id);
  if (idx === -1) return;
  games[idx].hours = round1((games[idx].hours || 0) + hoursElapsed);
  saveGames(games);
  mainWindow?.webContents.send('game:timeUpdated', { id, hours: games[idx].hours });
}

function round1(n) { return Math.round(n * 10) / 10; }

// ─── IPC: Диалоги ─────────────────────────────────────────────────────────────
ipcMain.handle('dialog:openFile', async () => {
  const r = await dialog.showOpenDialog(mainWindow, {
    title: 'Выберите исполняемый файл',
    filters: [{ name:'Исполняемые', extensions:['exe','sh','AppImage','x86_64','bin'] }, { name:'Все файлы', extensions:['*'] }],
    properties: ['openFile'],
  });
  return r.canceled ? null : r.filePaths[0];
});

ipcMain.handle('dialog:openFolder', async () => {
  const r = await dialog.showOpenDialog(mainWindow, {
    title: 'Выберите папку с играми',
    properties: ['openDirectory'],
  });
  return r.canceled ? null : r.filePaths[0];
});

// ─── IPC: Сканирование папки ──────────────────────────────────────────────────
const GAME_EXTS = new Set(['.exe', '.sh', '.AppImage', '.x86_64', '.bin']);
const IGNORE_NAMES = new Set(['unins000.exe','uninstall.exe','setup.exe','redist','vcredist','directx','dotnet','vc_redist']);

ipcMain.handle('folder:scan', async (_, folderPath, depth = 3) => {
  const found = [];

  function scan(dir, level) {
    if (level < 0) return;
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        scan(fullPath, level - 1);
      } else if (entry.isFile()) {
        const ext  = path.extname(entry.name).toLowerCase();
        const base = entry.name.toLowerCase();
        if (!GAME_EXTS.has(ext)) continue;
        if (IGNORE_NAMES.has(base) || IGNORE_NAMES.has(base.replace(ext,''))) continue;
        // Имя игры = имя папки или файла без расширения, красиво
        const gameName = path.basename(path.dirname(fullPath)) !== path.basename(folderPath)
          ? path.basename(path.dirname(fullPath))
          : path.basename(entry.name, ext);
        found.push({
          name: gameName.replace(/[_\-\.]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).trim(),
          path: fullPath,
          ext,
        });
      }
    }
  }

  scan(folderPath, depth);
  return found;
});

// ─── IPC: Shell ───────────────────────────────────────────────────────────────
ipcMain.handle('shell:openFolder', (_, p) => shell.showItemInFolder(p));
ipcMain.handle('shell:openExternal', (_, url) => shell.openExternal(url));
