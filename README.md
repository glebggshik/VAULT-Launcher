# VAULT Launcher

> Игровой лаунчер с glassmorphism UI для Steam и локальных игр.  
> Поиск игр через Steam Store API + RAWG, трекинг времени, папки, темы.
> 
> Установщик по ссылке https://disk.yandex.ru/d/7YkoSqAFbcnvVg
---

## Требования

| | Linux | Windows |
|---|---|---|
| Node.js | ≥ 18 | ≥ 18 |
| npm | ≥ 9 | ≥ 9 |
| Wine (для .exe) | wine / wine64 | не нужен |
| Steam | опционально | опционально |

---

## Установка и запуск

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

**2. Распакуй архив и перейди в папку**

```bash
unzip vault-launcher.zip
cd vault-launcher
```

**3. Установи зависимости**

```bash
npm install
```

**4. Запусти**

```bash
npm start
```

**Ярлык на рабочий стол (опционально)**

Создай файл `~/.local/share/applications/vault-launcher.desktop`:

```ini
[Desktop Entry]
Name=VAULT Launcher
Comment=Game Launcher
Exec=bash -c "cd /полный/путь/к/vault-launcher && npm start"
Icon=/полный/путь/к/vault-launcher/assets/icon.png
Terminal=false
Type=Application
Categories=Game;
```

```bash
chmod +x ~/.local/share/applications/vault-launcher.desktop
update-desktop-database ~/.local/share/applications
```

> **Fish shell:** замени `bash -c` на `fish -c` в строке Exec,
> или создай скрипт-обёртку `start.sh` (`#!/bin/sh` + `cd /путь && npm start`)
> и укажи его путь в Exec.

---

**Запуск .exe игр на Linux**

Нужен Wine:

```bash
sudo pacman -S wine       # Arch / Manjaro
sudo apt install wine     # Ubuntu / Debian
sudo dnf install wine     # Fedora
```

VAULT автоматически обнаружит Wine и будет запускать .exe через него.
Если Wine не найден — при запуске появится ошибка с инструкцией.

Альтернатива: добавь игру в Steam как «Стороннее приложение» — Steam использует Proton автоматически.

---

### Windows

**1. Установи Node.js** — скачай с [nodejs.org](https://nodejs.org) (LTS версия).

**2. Распакуй архив** в удобную папку, например `C:\vault-launcher`.

**3. Открой PowerShell в папке** (ПКМ → «Открыть в терминале»):

```powershell
npm install
npm start
```

**Ярлык:** создай `start.bat` в папке:

```bat
@echo off
cd /d %~dp0
npm start
```

Сделай ярлык на этот .bat файл и перемести на рабочий стол.

---

## Первый запуск

При первом запуске появится экран настройки **RAWG API ключа**.

RAWG — бесплатная база данных игр (рейтинги, жанры, обложки при поиске).

**Получить бесплатный ключ (20 000 запросов/месяц):**
1. Зайди на [rawg.io/apidocs](https://rawg.io/apidocs)
2. Нажми **Get API key** и зарегистрируйся
3. Вставь ключ в поле и нажми «Сохранить»

Если пропустить — поиск работает только через Steam Store (название + App ID).

> Если ключ истечёт или станет недействительным, экран ввода появится снова автоматически.

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
- 🖥 Windows: .exe напрямую

---

## Структура проекта

```
vault-launcher/
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
├── assets/
├── package.json
└── README.md
```

## Данные приложения

- **Linux:** `~/.config/vault-launcher/`
- **Windows:** `%APPDATA%\vault-launcher\`

---

MIT License
