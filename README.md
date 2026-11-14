# КосмоЛаб (`sim-kosmo`) — Виртуальные лаборатории Космоквантума

Браузерная платформа интерактивных лабораторных стендов и практикумов для детских технопарков **«Кванториум» (направление Космоквантум)**, профилей НТО и проектных треков CanSat / Space-π. Работает прямо в браузере без установки ПО, внешних библиотек и регистрации.

---

## 🌐 1. Запуск онлайн прямо из GitHub (в браузере, без установки)

Проект опубликован на **GitHub Pages** и открывается по прямой ссылке на любом компьютере, интерактивной панели или планшете:

- **Открыть платформу целиком:** **[https://pavelb-coder.github.io/sim-kosmo/](https://pavelb-coder.github.io/sim-kosmo/)**
- Прямые ссылки на отдельные стенды:
  1. [Стенд CubeSat · ОрбиКрафт](https://pavelb-coder.github.io/sim-kosmo/?lab=cubesat)
  2. [Орбитальная механика и манёвры](https://pavelb-coder.github.io/sim-kosmo/?lab=orbit)
  3. [Ракета, CanSat и аэродинамическая труба](https://pavelb-coder.github.io/sim-kosmo/?lab=rocket)
  4. [Приёмная станция УКВ «Вьюнок» (Web-SDR + ДЗЗ)](https://pavelb-coder.github.io/sim-kosmo/?lab=sdr)
  5. [Замкнутая СЖО орбитальной станции](https://pavelb-coder.github.io/sim-kosmo/?lab=lss)

---

## ⚡ 2. Быстрый запуск одной командой из GitHub (порт `8086`)

Скрипты сами скачивают (или обновляют) репозиторий в домашнюю папку и поднимают локальный сервер на порту **`8086`** (с доступом для всех компьютеров учебной аудитории по локальной сети `0.0.0.0:8086`).

### Ubuntu / Linux (терминал)
```bash
curl -fsSL https://raw.githubusercontent.com/pavelb-coder/sim-kosmo/main/run-online.sh | bash
```

### Windows 10 / 11 (PowerShell)
```powershell
irm https://raw.githubusercontent.com/pavelb-coder/sim-kosmo/main/run-online.ps1 | iex
```

После запуска платформа доступна по адресу: **`http://localhost:8086`** (и `http://<IP-компьютера>:8086` в локальной сети класса).

---

## 💻 3. Обычный локальный запуск (Windows и Ubuntu, порт `8086`)

Проект **не требует `npm install` или сборки** — работает как на чистом **Node.js**, так и через встроенный **Python 3** (резервный режим, если Node.js не установлен на школьном ПК).

### На Windows
1. Клонируйте или скачайте архив репозитория:
   ```cmd
   git clone https://github.com/pavelb-coder/sim-kosmo.git
   cd sim-kosmo
   ```
2. Запустите двойным кликом файл **`start-windows.bat`** (или из консоли `start-windows.bat`).
   - Скрипт автоматически запустит сервер на порту **`8086`** и откроет браузер на `http://localhost:8086`.
   - При необходимости можно передать другой порт аргументом: `start-windows.bat 8086`.

### На Ubuntu / Linux
1. Клонируйте репозиторий и запустите скрипт:
   ```bash
   git clone https://github.com/pavelb-coder/sim-kosmo.git
   cd sim-kosmo
   chmod +x start-ubuntu.sh install-ubuntu-service.sh
   ./start-ubuntu.sh
   ```
   Сервер запустится на **`0.0.0.0:8086`** (`http://localhost:8086`). Если открыт файрвол `ufw` и нужен доступ с соседних ПК учеников:
   ```bash
   sudo ufw allow 8086/tcp
   ```
2. **Автозапуск в качестве фонового сервиса `systemd` в Ubuntu (по желанию):**
   ```bash
   sudo ./install-ubuntu-service.sh
   ```
   Управление сервисом:
   ```bash
   sudo systemctl status sim-kosmo
   sudo systemctl restart sim-kosmo
   ```

---

## 🛰 Состав платформы

- **5 интерактивных лабораторий:** CubeSat / «ОрбиКрафт», Орбитальная механика (РК4 + формула Циолковского), Ракета + CanSat + аэродинамическая труба, Приёмная станция УКВ Web-SDR + мультиспектральный анализ ДЗЗ (RGB / NIR / TIR / NDVI), СЖО орбитальной станции.
- **15 готовых практикумов и нештатных ситуаций** с автоматической проверкой результата.
- **Справочник космонавтики** с живыми калькуляторами формул.
- **Сохранение и сдача работ файлом `.cosmolab`** и встраивание через `<iframe>` (`&embed=1`).
