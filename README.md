# VAULT Launcher

> Игровой лаунчер с glassmorphism UI для Steam и локальных игр.  
> Поиск игр через Steam Store API + RAWG, трекинг времени, папки, темы.

---

## Скачать

Готовый установщик для Windows — на странице [Releases](../../releases/latest):

- **`VAULT Launcher Setup.exe`** — установщик (рекомендуется)
- **`VAULT Launcher.exe`** — portable, без установки

Node.js и npm **не нужны** — всё упаковано внутри.

---

## Запуск из исходников

### Linux (Arch / Manjaro / Ubuntu / Fedora)

**1. Установи Node.js**

```bash
# Arch / Manjaro
sudo pacman -S nodejs npm

# Ubuntu / Debian
sudo apt install nodejs npm

# Fedora
sudo dnf install nodejs npm
```

**2. Клонируй репозиторий**

```bash
git clone https://github.com/glebggshik/VAULT-Launcher.git
cd VAULT-Launcher
```

**3. Установи зависимости и запусти**

```bash
npm install
npm start
```

**Ярлык на рабочий стол (опционально)**

Создай `~/.local/share/applications/vault-launcher.desktop`:

```ini
[Desktop Entry]
Name=VAULT Launcher
Exec=bash -c "cd /полный/путь/к/VAULT-Launcher && npm start"
Icon=/полный/путь/к/VAULT-Launcher/assets/icon.png
Terminal=false
Type=Application
Categories=Game;
```

```bash
chmod +x ~/.local/share/applications/vault-launcher.desktop
update-desktop-database ~/.local/share/applications
```

> **Fish shell:** замени `bash -c` на `fish -c`, или создай скрипт-обёртку `start.sh`
> (`#!/bin/sh` + `cd /путь && npm start`) и укажи его в Exec.

**Запуск .exe игр на Linux**

Нужен Wine:

```bash
sudo pacman -S wine       # Arch / Manjaro
sudo apt install wine     # Ubuntu / Debian
sudo dnf install wine     # Fedora
```

VAULT автоматически обнаружит Wine. Альтернатива — добавь игру в Steam как «Стороннее приложение», тогда используется Proton.

---

### Windows (из исходников)

```powershell
git clone https://github.com/glebggshik/VAULT-Launcher.git
cd VAULT-Launcher
npm install
npm start
```

---

## Сборка установщика

Установщик собирается автоматически через GitHub Actions при создании тега:

```bash
git tag v1.0.0
git push origin v1.0.0
```

Через ~5 минут в разделе **Releases** появится готовый `.exe`.

Для ручной сборки на Windows:

```powershell
npm install
npm run build:win
# Результат в папке dist/
```

---

## Первый запуск

При первом запуске появится экран настройки **RAWG API ключа**.

RAWG — бесплатная база данных игр (рейтинги, жанры, обложки при поиске).

**Получить бесплатный ключ (20 000 запросов/месяц):**
1. Зайди на [rawg.io/apidocs](https://rawg.io/apidocs)
2. Нажми **Get API key** и зарегистрируйся
3. Вставь ключ в поле и нажми «Сохранить»

Можно пропустить — поиск будет работать только через Steam Store.

> Если ключ истечёт или станет недействительным, экран появится снова автоматически.

---

## Возможности

- 🎮 Библиотека Steam и локальных игр в одном месте
- 🔍 Поиск по названию с автозаполнением (Steam Store + RAWG)
- ⏱ Трекинг времени игры с точностью до минуты
- 📁 Папки / теги для группировки
- 🔎 Сканирование папок — находит все игры автоматически
- ✏️ Редактирование всей информации об игре включая часы
- 🎨 4 темы + кастомный цвет акцента
- 🐧 Linux: Wine для .exe, нативные бинарники напрямую
- 🖥 Windows: установщик или portable .exe

---

## Структура проекта

```
VAULT-Launcher/
├── .github/workflows/
│   └── main.yml           # GitHub Actions — сборка и релиз
├── src/
│   ├── main/
│   │   ├── main.js        # Electron main process
│   │   └── preload.js     # IPC bridge
│   └── renderer/
│       ├── index.html     # Главный экран
│       ├── app.js         # Логика UI
│       ├── settings.html  # Настройки
│       ├── settings.js    # Логика настроек
│       └── style.css      # Стили
├── assets/                # Иконки (png, ico, svg)
├── installer/             # NSIS скрипт
├── package.json
├── README.md
└── README.txt
```

## Данные приложения

- **Linux:** `~/.config/vault-launcher/`
- **Windows:** `%APPDATA%\vault-launcher\`

---

MIT License
