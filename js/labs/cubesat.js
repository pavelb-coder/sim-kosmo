import { TelemetryScope } from '../ui/scope.js';

const CODE_PRESETS = {
  free: `// 1. Свободное вращение (управление выключено)
// sensors: { theta, gyro, sunError, targetError, sunVisible, wheelRpm, battery }
return {
  wheelTorque: 0,   // Момент маховика [-100..+100] %
  magTorque: 0,     // Момент магнитных катушек [-100..+100] %
  takePhoto: false  // Команда камере ДЗЗ
};`,

  detumble: `// 2. Гашение начальной закрутки после отделения от РН (B-dot / ДУС)
// Создаём тормозящий момент против угловой скорости sensors.gyro
const kd = 4.2;
const cmd = -kd * sensors.gyro;

if (Math.abs(sensors.gyro) < 0.8 && state.tick % 50 === 0) {
  log("Закрутка погашена: ω = " + sensors.gyro.toFixed(2) + " °/с");
}

return {
  wheelTorque: cmd * 0.5,
  magTorque: cmd,
  takePhoto: false
};`,

  pd_target: `// 3. ПД-регулятор наведения камеры на цель + автосъёмка
// Ошибка наведения sensors.targetError в градусах [-180..+180]
const kp = 2.4;
const kd = 5.5;
const wheelCmd = kp * sensors.targetError - kd * sensors.gyro;

// Магнитная разгрузка маховика, чтобы не ушёл в насыщение
const desat = -0.02 * sensors.wheelRpm;

// Автоматический снимок при точном наведении и малой угловой скорости
const ready = Math.abs(sensors.targetError) < 2.0 && Math.abs(sensors.gyro) < 1.2;

return {
  wheelTorque: wheelCmd,
  magTorque: desat,
  takePhoto: ready && !state.shotDone
};`,

  pd_sun: `// 4. Ориентация на Солнце для зарядки батарей (ПД-регулятор)
if (!sensors.sunVisible) {
  // В тени Земли только гасим вращение
  return { wheelTorque: 0, magTorque: -3.0 * sensors.gyro, takePhoto: false };
}

const kp = 2.2;
const kd = 5.0;
const wheelCmd = kp * sensors.sunError - kd * sensors.gyro;

return {
  wheelTorque: wheelCmd,
  magTorque: -0.015 * sensors.wheelRpm,
  takePhoto: false
};`
};

const MODULES_CATALOG = [
  { id: 'obc', name: 'БКУ (STM32 / ОрбиКрафт)', massG: 120, powerW: 0.55, locked: true },
  { id: 'eps', name: 'СЭП + АКБ Li-Ion', massG: 230, powerW: 0.15, locked: true },
  { id: 'solar', name: 'Солнечные панели (4 грани)', massG: 220, powerW: 0 },
  { id: 'sunsens', name: 'Солнечные датчики ×4', massG: 60, powerW: 0.12 },
  { id: 'gyro', name: 'Гироскоп ДУС (MEMS)', massG: 55, powerW: 0.18 },
  { id: 'mag', name: 'Магнитометр + Катушки B-dot', massG: 175, powerW: 0.45 },
  { id: 'wheel', name: 'Двигатель-маховик (ось Z)', massG: 255, powerW: 0.65 },
  { id: 'uhf', name: 'УКВ-приёмопередатчик 437 МГц', massG: 95, powerW: 0.50 },
  { id: 'cam', name: 'Камера ДЗЗ «Зоркий-Мини»', massG: 110, powerW: 0.40 }
];

function wrapDeg(a) {
  let x = ((a + 180) % 360 + 360) % 360 - 180;
  return x;
}

function norm360(a) {
  return ((a % 360) + 360) % 360;
}

export class CubeSatLab {
  constructor(shell) {
    this.shell = shell;
    this.viewMode = 'rig'; // 'rig' | 'bus'
    this.running = true;
    this.timeScale = 1;

    this.installed = {
      obc: true,
      eps: true,
      solar: true,
      sunsens: true,
      gyro: true,
      mag: true,
      wheel: true,
      uhf: true,
      cam: true
    };

    this.state = {
      simTime: 0,
      tick: 0,
      theta: 35,          // deg (0 = right/East, counter-clockwise screen convention handled consistently)
      omega: 14,          // deg/s
      wheelRpm: 0,        // -6000..+6000 rpm
      sunAngle: 20,       // deg
      targetAngle: 115,   // deg
      magFieldAngle: 90,  // deg
      eclipse: false,
      batteryPct: 78,
      netPowerW: 0,
      genPowerW: 0,
      loadPowerW: 0,
      photosTaken: 0,
      lastPhotoError: null,
      shotCooldown: 0,
      flashAlpha: 0,
      faultSensorInvert: false,
      faultGyroDead: false,
      faultDisturbance: false,
      lastWheelCmd: 0,
      lastMagCmd: 0
    };

    this.codeText = CODE_PRESETS.pd_target;
    this.userFn = null;
    this.userState = { tick: 0, shotDone: false };
    this.logs = [];
    this.dragMode = null;

    this.compileCode(this.codeText, false);
  }

  mount(containers) {
    this.containers = containers;
    this.renderLeft(containers.left);
    this.renderCenter(containers.center);
    this.renderRight(containers.right);
    this.updateTelemetryDOM();
  }

  unmount() {
    this.containers = null;
  }

  compileCode(src, notify = true) {
    this.codeText = src;
    try {
      // Safe local controller function compilation
      this.userFn = new Function('sensors', 'state', 'log', src);
      this.userState = { tick: 0, shotDone: false };
      if (notify) this.pushLog('БКУ: прошивка успешно загружена.', 'ok');
      return true;
    } catch (e) {
      this.pushLog('Ошибка компиляции БКУ: ' + e.message, 'err');
      return false;
    }
  }

  pushLog(msg, level = 'info') {
    const t = this.state.simTime.toFixed(1).padStart(5, ' ');
    this.logs.push({ t, msg, level });
    if (this.logs.length > 60) this.logs.shift();
    if (this.logEl) {
      this.logEl.innerHTML = this.logs
        .map((l) => {
          const cls = l.level === 'err' ? 'log-err' : l.level === 'ok' ? 'log-ok' : l.level === 'warn' ? 'log-warn' : '';
          return `<div class="${cls}">[${l.t}с] ${l.msg}</div>`;
        })
        .join('');
      this.logEl.scrollTop = this.logEl.scrollHeight;
    }
  }

  calcMassKg() {
    let sumG = 140; // Рама 1U
    MODULES_CATALOG.forEach((m) => {
      if (this.installed[m.id]) sumG += m.massG;
    });
    return sumG / 1000;
  }

  renderLeft(el) {
    el.innerHTML = `
      <div class="panel-section">
        <div class="section-header">
          <span class="section-title">Бортовые системы CubeSat 1U</span>
        </div>
        <div class="module-list" id="cs-module-list"></div>
        <div style="margin-top:10px;">
          <div class="control-label">
            <span>Масса КА (норма 1U ≤ 1.33 кг)</span>
            <span class="control-val" id="cs-mass-val">1.33 кг</span>
          </div>
          <div class="meter-bar"><div class="meter-fill" id="cs-mass-bar"></div></div>
        </div>
      </div>

      <div class="panel-section">
        <div class="section-header">
          <span class="section-title">Стенд имитаторов «Терра»</span>
        </div>

        <div class="control-row">
          <label class="control-label">
            <span>Имитатор Солнца (азимут)</span>
            <span class="control-val" id="cs-sun-lbl">${this.state.sunAngle}°</span>
          </label>
          <input type="range" id="cs-sun-slider" min="0" max="359" value="${this.state.sunAngle}">
        </div>

        <div class="control-row">
          <label class="control-label">
            <span>Мишень съёмки ДЗЗ (азимут)</span>
            <span class="control-val" id="cs-tgt-lbl">${this.state.targetAngle}°</span>
          </label>
          <input type="range" id="cs-tgt-slider" min="0" max="359" value="${this.state.targetAngle}">
        </div>

        <div style="display:flex; gap:6px; flex-wrap:wrap; margin-top:8px;">
          <button class="btn btn-sm" id="cs-btn-eclipse" style="flex:1;">
            ${this.state.eclipse ? '☀ Включить Солнце' : '🌑 Тень Земли'}
          </button>
          <button class="btn btn-sm btn-amber" id="cs-btn-kick" style="flex:1;">
            ↻ Закрутить +25 °/с
          </button>
        </div>

        <div style="display:flex; gap:6px; flex-wrap:wrap; margin-top:6px;">
          <button class="btn btn-sm" id="cs-btn-desat" style="flex:1;">
            Стоп маховика
          </button>
          <button class="btn btn-sm btn-primary" id="cs-btn-photo" style="flex:1;">
            📷 Снимок ДЗЗ
          </button>
        </div>
      </div>
    `;

    this.refreshModuleList();

    const sunSlider = el.querySelector('#cs-sun-slider');
    const tgtSlider = el.querySelector('#cs-tgt-slider');

    sunSlider.addEventListener('input', () => {
      this.state.sunAngle = Number(sunSlider.value);
      el.querySelector('#cs-sun-lbl').textContent = `${this.state.sunAngle}°`;
    });

    tgtSlider.addEventListener('input', () => {
      this.state.targetAngle = Number(tgtSlider.value);
      el.querySelector('#cs-tgt-lbl').textContent = `${this.state.targetAngle}°`;
    });

    el.querySelector('#cs-btn-eclipse').addEventListener('click', (e) => {
      this.state.eclipse = !this.state.eclipse;
      e.currentTarget.textContent = this.state.eclipse ? '☀ Включить Солнце' : '🌑 Тень Земли';
      this.pushLog(this.state.eclipse ? 'Вход в тень Земли (имитатор Солнца погашен)' : 'Выход на солнечную сторону орбиты');
    });

    el.querySelector('#cs-btn-kick').addEventListener('click', () => {
      this.state.omega = Math.max(-60, Math.min(60, this.state.omega + 25));
      this.pushLog(`Внешний импульс: угловая скорость ω = ${this.state.omega.toFixed(1)} °/с`, 'warn');
    });

    el.querySelector('#cs-btn-desat').addEventListener('click', () => {
      this.state.wheelRpm = 0;
      this.pushLog('Маховик принудительно разгружен до 0 об/мин.');
    });

    el.querySelector('#cs-btn-photo').addEventListener('click', () => {
      this.triggerCameraShot(true);
    });
  }

  refreshModuleList() {
    if (!this.containers) return;
    const list = this.containers.left.querySelector('#cs-module-list');
    if (!list) return;

    list.innerHTML = MODULES_CATALOG.map((m) => {
      const on = !!this.installed[m.id];
      return `
        <div class="module-item ${on ? 'installed' : ''}" data-mod="${m.id}">
          <div class="module-meta">
            <span class="module-name">${m.name}</span>
            <span class="module-sub">${m.massG} г · ${m.powerW > 0 ? m.powerW + ' Вт' : 'генерация до 4.8 Вт'}</span>
          </div>
          <span style="font-size:11px; font-weight:700; color:${on ? 'var(--cyan)' : 'var(--text-muted)'}">
            ${m.locked ? 'БАЗА' : on ? 'ВКЛ' : 'ВЫКЛ'}
          </span>
        </div>
      `;
    }).join('');

    list.querySelectorAll('.module-item').forEach((row) => {
      row.addEventListener('click', () => {
        const id = row.dataset.mod;
        const meta = MODULES_CATALOG.find((x) => x.id === id);
        if (meta && !meta.locked) {
          this.installed[id] = !this.installed[id];
          this.refreshModuleList();
          this.pushLog(`${meta.name}: ${this.installed[id] ? 'подключён к шине' : 'отключён'}`);
        }
      });
    });

    const massKg = this.calcMassKg();
    const massVal = this.containers.left.querySelector('#cs-mass-val');
    const massBar = this.containers.left.querySelector('#cs-mass-bar');
    if (massVal && massBar) {
      massVal.textContent = `${massKg.toFixed(2)} кг`;
      const pct = Math.min(100, (massKg / 1.5) * 100);
      massBar.style.width = `${pct}%`;
      massBar.style.background = massKg <= 1.38 ? 'var(--green)' : 'var(--amber)';
    }
  }

  renderCenter(el) {
    el.innerHTML = `
      <div class="bench-toolbar">
        <div class="segmented">
          <button class="seg-btn ${this.viewMode === 'rig' ? 'active' : ''}" data-view="rig">Испытательный подвес</button>
          <button class="seg-btn ${this.viewMode === 'bus' ? 'active' : ''}" data-view="bus">Компоновка и шина RS-485</button>
        </div>

        <div class="time-controls">
          <button class="btn btn-sm ${this.running ? 'btn-amber' : 'btn-success'}" id="cs-run-btn">
            ${this.running ? '⏸ Пауза' : '▶ Старт'}
          </button>
          <div class="segmented">
            ${[1, 2, 5].map((s) => `<button class="seg-btn ${this.timeScale === s ? 'active' : ''}" data-spd="${s}">×${s}</button>`).join('')}
          </div>
          <span class="sim-clock" id="cs-clock">T+ 0.0 с</span>
          <button class="btn btn-sm" id="cs-reset-btn" title="Сброс стенда">↺</button>
        </div>
      </div>

      <div class="canvas-stage">
        <canvas id="cs-canvas"></canvas>
        <div class="canvas-hud" id="cs-hud"></div>
      </div>
    `;

    this.canvas = el.querySelector('#cs-canvas');
    this.hudEl = el.querySelector('#cs-hud');
    this.clockEl = el.querySelector('#cs-clock');

    el.querySelectorAll('[data-view]').forEach((b) => {
      b.addEventListener('click', () => {
        this.viewMode = b.dataset.view;
        el.querySelectorAll('[data-view]').forEach((x) => x.classList.toggle('active', x === b));
      });
    });

    el.querySelector('#cs-run-btn').addEventListener('click', (e) => {
      this.running = !this.running;
      e.currentTarget.textContent = this.running ? '⏸ Пауза' : '▶ Старт';
      e.currentTarget.className = `btn btn-sm ${this.running ? 'btn-amber' : 'btn-success'}`;
    });

    el.querySelectorAll('[data-spd]').forEach((b) => {
      b.addEventListener('click', () => {
        this.timeScale = Number(b.dataset.spd);
        el.querySelectorAll('[data-spd]').forEach((x) => x.classList.toggle('active', x === b));
      });
    });

    el.querySelector('#cs-reset-btn').addEventListener('click', () => {
      this.state.simTime = 0;
      this.state.theta = 35;
      this.state.omega = 14;
      this.state.wheelRpm = 0;
      this.state.batteryPct = 80;
      this.state.photosTaken = 0;
      this.state.lastPhotoError = null;
      this.userState = { tick: 0, shotDone: false };
      if (this.scope) this.scope.clear();
      this.pushLog('Стенд сброшен в исходное положение.');
    });

    this.bindCanvasEvents();
  }

  bindCanvasEvents() {
    const getAngleAndDist = (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const cx = rect.width / 2;
      const cy = rect.height / 2;
      const dx = x - cx;
      const dy = y - cy;
      const ang = norm360((Math.atan2(dy, dx) * 180) / Math.PI);
      const dist = Math.hypot(dx, dy);
      return { x, y, cx, cy, ang, dist, w: rect.width, h: rect.height };
    };

    this.canvas.addEventListener('mousedown', (e) => {
      const p = getAngleAndDist(e);
      if (this.viewMode === 'bus') {
        this.handleBusClick(p.x, p.y, p.w, p.h);
        return;
      }
      const ringR = Math.min(p.w, p.h) * 0.39;
      if (Math.abs(p.dist - ringR) < 32) {
        const dSun = Math.abs(wrapDeg(p.ang - this.state.sunAngle));
        const dTgt = Math.abs(wrapDeg(p.ang - this.state.targetAngle));
        this.dragMode = dSun <= dTgt ? 'sun' : 'target';
      } else if (p.dist < ringR * 0.55) {
        this.dragMode = 'sat';
        this.state.omega = 0;
      }
    });

    window.addEventListener('mousemove', (e) => {
      if (!this.dragMode || !this.canvas || !this.containers) return;
      const p = getAngleAndDist(e);
      if (this.dragMode === 'sun') {
        this.state.sunAngle = Math.round(p.ang);
        const s = this.containers.left.querySelector('#cs-sun-slider');
        const l = this.containers.left.querySelector('#cs-sun-lbl');
        if (s) s.value = this.state.sunAngle;
        if (l) l.textContent = `${this.state.sunAngle}°`;
      } else if (this.dragMode === 'target') {
        this.state.targetAngle = Math.round(p.ang);
        const s = this.containers.left.querySelector('#cs-tgt-slider');
        const l = this.containers.left.querySelector('#cs-tgt-lbl');
        if (s) s.value = this.state.targetAngle;
        if (l) l.textContent = `${this.state.targetAngle}°`;
      } else if (this.dragMode === 'sat') {
        this.state.theta = p.ang;
        this.state.omega = 0;
      }
    });

    window.addEventListener('mouseup', () => {
      this.dragMode = null;
    });
  }

  handleBusClick(x, y, w, h) {
    if (!this.faultBoxes) return;
    for (const box of this.faultBoxes) {
      if (x >= box.x && x <= box.x + box.w && y >= box.y && y <= box.y + box.h) {
        this.state[box.key] = !this.state[box.key];
        this.pushLog(
          `Шина: «${box.label}» → ${this.state[box.key] ? 'АКТИВНА (неисправность)' : 'ШТАТНО'}`,
          this.state[box.key] ? 'warn' : 'ok'
        );
      }
    }
  }

  renderRight(el) {
    el.innerHTML = `
      <div class="panel-section">
        <div class="section-header">
          <span class="section-title">Показания приборов БКУ</span>
        </div>
        <div class="telemetry-grid">
          <div class="telemetry-card">
            <span class="telemetry-label">Курс камеры θ</span>
            <span class="telemetry-value cyan" id="cs-t-theta">0.0°</span>
          </div>
          <div class="telemetry-card">
            <span class="telemetry-label">Угл. скорость ω</span>
            <span class="telemetry-value" id="cs-t-omega">0.0 °/с</span>
          </div>
          <div class="telemetry-card">
            <span class="telemetry-label">Ошибка на цель</span>
            <span class="telemetry-value amber" id="cs-t-terr">0.0°</span>
          </div>
          <div class="telemetry-card">
            <span class="telemetry-label">Маховик (макс 6000)</span>
            <span class="telemetry-value violet" id="cs-t-rpm">0 об/м</span>
          </div>
          <div class="telemetry-card">
            <span class="telemetry-label">Заряд АКБ / СЭП</span>
            <span class="telemetry-value green" id="cs-t-bat">78% (+1.2 Вт)</span>
          </div>
          <div class="telemetry-card">
            <span class="telemetry-label">Кадры ДЗЗ</span>
            <span class="telemetry-value" id="cs-t-shots">0 шт.</span>
          </div>
        </div>
      </div>

      <div class="panel-section">
        <div class="section-header">
          <span class="section-title">Осциллограф телеметрии</span>
        </div>
        <div id="cs-scope-root"></div>
      </div>

      <div class="panel-section" style="flex:1; display:flex; flex-direction:column; gap:7px;">
        <div class="section-header" style="margin-bottom:2px;">
          <span class="section-title">Алгоритм ориентации БКУ (JS)</span>
          <button class="btn btn-sm btn-primary" id="cs-apply-code">Загрузить в БКУ</button>
        </div>

        <select id="cs-preset-select">
          <option value="pd_target" selected>3. ПД-наведение на цель + автосъёмка</option>
          <option value="detumble">2. Гашение закрутки (B-dot / ДУС)</option>
          <option value="pd_sun">4. Ориентация на Солнце (зарядка)</option>
          <option value="free">1. Свободное вращение (без стабилизации)</option>
        </select>

        <textarea class="code-editor" id="cs-code-editor" spellcheck="false"></textarea>

        <div class="section-title" style="margin-top:2px;">Радиоканал ЦУП (437.85 МГц)</div>
        <div class="serial-log" id="cs-serial-log"></div>
      </div>
    `;

    this.scope = new TelemetryScope(
      el.querySelector('#cs-scope-root'),
      [
        { key: 'omega', label: 'ω', unit: '°/с', color: '#38bdf8', min: -45, max: 45 },
        { key: 'terr', label: 'ΔЦель', unit: '°', color: '#f59e0b', min: -180, max: 180 },
        { key: 'rpmPct', label: 'Маховик', unit: '%', color: '#a78bfa', min: -100, max: 100 },
        { key: 'bat', label: 'АКБ', unit: '%', color: '#22c55e', min: 0, max: 100 }
      ],
      { height: 132 }
    );

    const editor = el.querySelector('#cs-code-editor');
    editor.value = this.codeText;
    this.logEl = el.querySelector('#cs-serial-log');
    this.pushLog('Стенд «ОрбиКрафт» готов. Телеметрия активна.', 'ok');

    el.querySelector('#cs-preset-select').addEventListener('change', (e) => {
      const key = e.target.value;
      if (CODE_PRESETS[key]) {
        editor.value = CODE_PRESETS[key];
        this.compileCode(editor.value, true);
      }
    });

    el.querySelector('#cs-apply-code').addEventListener('click', () => {
      this.compileCode(editor.value, true);
    });
  }

  triggerCameraShot(manual = false) {
    if (!this.installed.cam) {
      if (manual) this.pushLog('Ошибка: модуль «Камера ДЗЗ» не установлен!', 'err');
      return;
    }
    if (this.state.batteryPct <= 2) return;

    const err = Math.abs(wrapDeg(this.state.targetAngle - this.state.theta));
    this.state.photosTaken += 1;
    this.state.lastPhotoError = err;
    this.state.flashAlpha = 1.0;
    this.state.shotCooldown = 2.5;
    this.userState.shotDone = true;

    if (err <= 2.5 && Math.abs(this.state.omega) <= 1.8) {
      this.pushLog(`Снимок #${this.state.photosTaken}: ЦЕЛЬ В КАДРЕ (отклонение ${err.toFixed(2)}°)`, 'ok');
    } else {
      this.pushLog(`Снимок #${this.state.photosTaken}: смаз/промах (ошибка ${err.toFixed(1)}°, ω=${this.state.omega.toFixed(1)} °/с)`, 'warn');
    }
  }

  step(dtReal) {
    if (!this.containers) return;

    if (this.running) {
      const subSteps = this.timeScale * 2;
      const dt = (dtReal * this.timeScale) / subSteps;
      for (let i = 0; i < subSteps; i++) {
        this.physicsTick(dt);
      }
    }

    if (this.state.flashAlpha > 0) {
      this.state.flashAlpha = Math.max(0, this.state.flashAlpha - dtReal * 2.5);
    }

    this.drawCanvas();
    this.updateTelemetryDOM();
  }

  physicsTick(dt) {
    const s = this.state;
    s.simTime += dt;
    s.tick += 1;
    if (s.shotCooldown > 0) s.shotCooldown = Math.max(0, s.shotCooldown - dt);

    const rawSunErr = wrapDeg(s.sunAngle - s.theta);
    const measSunErr = s.faultSensorInvert ? -rawSunErr : rawSunErr;
    const targetErr = wrapDeg(s.targetAngle - s.theta);

    const sensors = {
      theta: norm360(s.theta),
      gyro: this.installed.gyro && !s.faultGyroDead ? s.omega : 0,
      sunError: this.installed.sunsens && !s.eclipse ? measSunErr : 0,
      targetError: targetErr,
      sunVisible: !s.eclipse && this.installed.sunsens,
      wheelRpm: this.installed.wheel ? s.wheelRpm : 0,
      battery: s.batteryPct
    };

    let cmd = { wheelTorque: 0, magTorque: 0, takePhoto: false };
    if (this.userFn && s.batteryPct > 1) {
      this.userState.tick = s.tick;
      try {
        const res = this.userFn(sensors, this.userState, (m) => this.pushLog(String(m)));
        if (res && typeof res === 'object') cmd = res;
      } catch (e) {
        if (s.tick % 120 === 0) this.pushLog('Ошибка исполнения БКУ: ' + e.message, 'err');
      }
    }

    // Clamp commands
    let wCmd = this.installed.wheel ? Math.max(-100, Math.min(100, Number(cmd.wheelTorque) || 0)) : 0;
    let mCmd = this.installed.mag ? Math.max(-100, Math.min(100, Number(cmd.magTorque) || 0)) : 0;

    // Reaction wheel saturation at ±6000 RPM
    if ((s.wheelRpm >= 6000 && wCmd > 0) || (s.wheelRpm <= -6000 && wCmd < 0)) {
      wCmd = 0;
    }

    s.lastWheelCmd = wCmd;
    s.lastMagCmd = mCmd;

    // Inertia proportional to spacecraft mass
    const inertiaFactor = 1.25 / Math.max(0.6, this.calcMassKg());

    // Wheel accelerates internally, applying reaction torque onto chassis
    s.wheelRpm = Math.max(-6000, Math.min(6000, s.wheelRpm - wCmd * 16.0 * dt));

    const disturb = s.faultDisturbance ? 4.5 * Math.sin(s.simTime * 0.9) : 0;
    const friction = -0.025 * s.omega; // Tiny air bearing drag
    const alphaDeg = (wCmd * 0.42 + mCmd * 0.24 + disturb + friction) * inertiaFactor;

    s.omega = Math.max(-180, Math.min(180, s.omega + alphaDeg * dt));
    s.theta = norm360(s.theta + s.omega * dt);

    if (cmd.takePhoto && s.shotCooldown <= 0) {
      this.triggerCameraShot(false);
    }

    // Power & EPS budget
    let loadW = 0;
    MODULES_CATALOG.forEach((m) => {
      if (this.installed[m.id]) loadW += m.powerW;
    });
    loadW += (Math.abs(wCmd) / 100) * 1.4 + (Math.abs(mCmd) / 100) * 0.8;

    let genW = 0;
    if (this.installed.solar && !s.eclipse) {
      // 4-sided CubeSat panels collect power at any angle, peaking on face normal
      const rad = (rawSunErr * Math.PI) / 180;
      genW = 3.4 * (Math.abs(Math.cos(rad)) + 0.65 * Math.abs(Math.sin(rad)));
    }

    s.genPowerW = genW;
    s.loadPowerW = loadW;
    s.netPowerW = genW - loadW;
    // Battery capacity scaled so students see realistic charge/discharge over ~minutes
    s.batteryPct = Math.max(0, Math.min(100, s.batteryPct + (s.netPowerW * dt) / 12));

    // Sample oscilloscope ~10 Hz
    if (s.tick % 5 === 0 && this.scope) {
      this.scope.push({
        omega: s.omega,
        terr: targetErr,
        rpmPct: (s.wheelRpm / 6000) * 100,
        bat: s.batteryPct
      });
    }
  }

  updateTelemetryDOM() {
    if (!this.containers) return;
    const s = this.state;
    const r = this.containers.right;
    if (!r) return;

    const terr = wrapDeg(s.targetAngle - s.theta);
    if (this.clockEl) this.clockEl.textContent = `T+ ${s.simTime.toFixed(1)} с`;

    r.querySelector('#cs-t-theta').textContent = `${norm360(s.theta).toFixed(1)}°`;
    const omEl = r.querySelector('#cs-t-omega');
    omEl.textContent = `${s.omega >= 0 ? '+' : ''}${s.omega.toFixed(1)} °/с`;
    omEl.className = 'telemetry-value ' + (Math.abs(s.omega) < 1.5 ? 'green' : Math.abs(s.omega) > 20 ? 'red' : 'amber');

    const teEl = r.querySelector('#cs-t-terr');
    teEl.textContent = `${terr >= 0 ? '+' : ''}${terr.toFixed(1)}°`;
    teEl.className = 'telemetry-value ' + (Math.abs(terr) < 2.5 ? 'green' : 'amber');

    const rpmEl = r.querySelector('#cs-t-rpm');
    rpmEl.textContent = `${Math.round(s.wheelRpm)} об/м`;
    rpmEl.className = 'telemetry-value ' + (Math.abs(s.wheelRpm) > 5400 ? 'red' : 'violet');

    const sign = s.netPowerW >= 0 ? '+' : '';
    r.querySelector('#cs-t-bat').textContent = `${s.batteryPct.toFixed(0)}% (${sign}${s.netPowerW.toFixed(1)} Вт)`;
    r.querySelector('#cs-t-shots').textContent = `${s.photosTaken} шт.`;

    // HUD chips
    if (this.hudEl) {
      const chips = [];
      if (Math.abs(s.wheelRpm) >= 5800) {
        chips.push(`<div class="hud-chip danger">⚠ Насыщение маховика (${Math.round(s.wheelRpm)} об/м) — включите разгрузку катушками!</div>`);
      }
      if (s.faultSensorInvert) {
        chips.push(`<div class="hud-chip danger">⚠ Неисправность шины: инверсия солнечных датчиков</div>`);
      }
      if (s.faultGyroDead) {
        chips.push(`<div class="hud-chip danger">⚠ Обрыв RS-485 датчика угловой скорости (ДУС)</div>`);
      }
      if (s.eclipse) {
        chips.push(`<div class="hud-chip warn">🌑 Режим орбитальной тени (питание от АКБ)</div>`);
      }
      if (chips.length === 0) {
        chips.push(`<div class="hud-chip ok">● Телеметрия БКУ штатно · Перетаскивайте Солнце, цель или спутник мышью</div>`);
      }
      this.hudEl.innerHTML = chips.join('');
    }
  }

  drawCanvas() {
    if (!this.canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    const w = Math.max(300, rect.width);
    const h = Math.max(300, rect.height);
    if (this.canvas.width !== Math.round(w * dpr) || this.canvas.height !== Math.round(h * dpr)) {
      this.canvas.width = Math.round(w * dpr);
      this.canvas.height = Math.round(h * dpr);
    }

    const ctx = this.canvas.getContext('2d');
    ctx.save();
    ctx.scale(dpr, dpr);

    if (this.viewMode === 'bus') {
      this.drawBusSchematic(ctx, w, h);
    } else {
      this.drawTestRig(ctx, w, h);
    }

    ctx.restore();
  }

  drawTestRig(ctx, w, h) {
    const s = this.state;
    const cx = w / 2;
    const cy = h / 2;
    const ringR = Math.min(w, h) * 0.39;

    ctx.clearRect(0, 0, w, h);

    // Subtle star / lab grid background
    ctx.strokeStyle = 'rgba(37, 53, 84, 0.25)';
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 40) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }
    for (let y = 0; y < h; y += 40) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }

    // Magnetic field lines (Helmholtz cage)
    ctx.save();
    ctx.translate(cx, cy);
    ctx.strokeStyle = 'rgba(167, 139, 250, 0.14)';
    ctx.setLineDash([6, 6]);
    for (let offset = -ringR * 0.65; offset <= ringR * 0.65; offset += ringR * 0.325) {
      ctx.beginPath();
      ctx.moveTo(offset, -ringR * 0.88);
      ctx.lineTo(offset, ringR * 0.88);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(167, 139, 250, 0.55)';
    ctx.font = '11px sans-serif';
    ctx.fillText('Магнитная рамка B⃗ (север ↑)', -74, -ringR * 0.88 - 8);
    ctx.restore();

    // Sun rays illumination cone
    const sunRad = (s.sunAngle * Math.PI) / 180;
    const sunX = cx + Math.cos(sunRad) * ringR;
    const sunY = cy + Math.sin(sunRad) * ringR;

    if (!s.eclipse) {
      const grad = ctx.createRadialGradient(sunX, sunY, 8, cx, cy, ringR * 1.1);
      grad.addColorStop(0, 'rgba(251, 191, 36, 0.28)');
      grad.addColorStop(0.55, 'rgba(251, 191, 36, 0.07)');
      grad.addColorStop(1, 'rgba(251, 191, 36, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, ringR, 0, Math.PI * 2);
      ctx.fill();
    }

    // Outer Azimuth Ring ("Терра" test stand)
    ctx.strokeStyle = '#2c4066';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, ringR, 0, Math.PI * 2);
    ctx.stroke();

    // Degree ticks
    ctx.font = '10px ui-monospace, monospace';
    ctx.fillStyle = '#64748b';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let deg = 0; deg < 360; deg += 15) {
      const r = (deg * Math.PI) / 180;
      const major = deg % 45 === 0;
      const r1 = ringR - (major ? 10 : 5);
      ctx.strokeStyle = major ? '#476291' : '#263859';
      ctx.lineWidth = major ? 1.5 : 1;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(r) * r1, cy + Math.sin(r) * r1);
      ctx.lineTo(cx + Math.cos(r) * ringR, cy + Math.sin(r) * ringR);
      ctx.stroke();
      if (major) {
        ctx.fillText(`${deg}°`, cx + Math.cos(r) * (ringR + 16), cy + Math.sin(r) * (ringR + 16));
      }
    }

    // Target marker on ring
    const tgtRad = (s.targetAngle * Math.PI) / 180;
    const tgtX = cx + Math.cos(tgtRad) * ringR;
    const tgtY = cy + Math.sin(tgtRad) * ringR;
    ctx.save();
    ctx.translate(tgtX, tgtY);
    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-7, 0); ctx.lineTo(7, 0);
    ctx.moveTo(0, -7); ctx.lineTo(0, 7);
    ctx.stroke();
    ctx.fillStyle = '#86efac';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText('ЦЕЛЬ ДЗЗ', 0, -22);
    ctx.restore();

    // Sun Simulator Lamp on ring
    ctx.save();
    ctx.translate(sunX, sunY);
    ctx.fillStyle = s.eclipse ? '#1e293b' : '#fbbf24';
    ctx.strokeStyle = s.eclipse ? '#475569' : '#fef08a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = s.eclipse ? '#94a3b8' : '#fde68a';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText(s.eclipse ? 'ТЕНЬ' : 'СОЛНЦЕ', 0, 25);
    ctx.restore();

    // CubeSat 1U in Center
    const satSize = Math.max(78, Math.min(116, ringR * 0.48));
    const satRad = (s.theta * Math.PI) / 180;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(satRad);

    // Camera FOV Cone (points along +X in CubeSat body frame)
    if (this.installed.cam) {
      const aligned = Math.abs(wrapDeg(s.targetAngle - s.theta)) <= 3.0;
      const fovGrad = ctx.createLinearGradient(satSize / 2, 0, ringR - 12, 0);
      fovGrad.addColorStop(0, aligned ? 'rgba(34, 197, 94, 0.35)' : 'rgba(56, 189, 248, 0.22)');
      fovGrad.addColorStop(1, 'rgba(56, 189, 248, 0.01)');
      ctx.fillStyle = fovGrad;
      ctx.beginPath();
      ctx.moveTo(satSize / 2, 0);
      ctx.lineTo(ringR - 14, -26);
      ctx.lineTo(ringR - 14, 26);
      ctx.closePath();
      ctx.fill();

      if (s.flashAlpha > 0) {
        ctx.fillStyle = `rgba(255,255,255,${s.flashAlpha * 0.65})`;
        ctx.beginPath();
        ctx.moveTo(satSize / 2, 0);
        ctx.lineTo(ringR, -38);
        ctx.lineTo(ringR, 38);
        ctx.closePath();
        ctx.fill();
      }
    }

    // UHF Antenna dipoles
    if (this.installed.uhf) {
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-satSize * 0.35, -satSize / 2);
      ctx.lineTo(-satSize * 0.58, -satSize * 0.85);
      ctx.moveTo(-satSize * 0.35, satSize / 2);
      ctx.lineTo(-satSize * 0.58, satSize * 0.85);
      ctx.stroke();
    }

    // Solar Panels on 4 faces
    if (this.installed.solar) {
      ctx.fillStyle = '#1d4ed8';
      ctx.strokeStyle = '#60a5fa';
      ctx.lineWidth = 1.5;
      const pThick = 7;
      const pLen = satSize * 0.78;
      // Top, Bottom, Back, Front split panels
      ctx.fillRect(-pLen / 2, -satSize / 2 - pThick, pLen, pThick);
      ctx.strokeRect(-pLen / 2, -satSize / 2 - pThick, pLen, pThick);
      ctx.fillRect(-pLen / 2, satSize / 2, pLen, pThick);
      ctx.strokeRect(-pLen / 2, satSize / 2, pLen, pThick);
      ctx.fillRect(-satSize / 2 - pThick, -pLen / 2, pThick, pLen);
      ctx.strokeRect(-satSize / 2 - pThick, -pLen / 2, pThick, pLen);
    }

    // CubeSat Aluminum 1U Chassis
    ctx.fillStyle = '#162136';
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.roundRect(-satSize / 2, -satSize / 2, satSize, satSize, 8);
    ctx.fill();
    ctx.stroke();

    // Corner rails
    const rail = 8;
    ctx.fillStyle = '#cbd5e1';
    [
      [-satSize / 2, -satSize / 2],
      [satSize / 2 - rail, -satSize / 2],
      [-satSize / 2, satSize / 2 - rail],
      [satSize / 2 - rail, satSize / 2 - rail]
    ].forEach(([rx, ry]) => ctx.fillRect(rx, ry, rail, rail));

    // Camera optical barrel on +X face
    if (this.installed.cam) {
      ctx.fillStyle = '#0f172a';
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      ctx.fillRect(satSize / 2 - 3, -11, 11, 22);
      ctx.strokeRect(satSize / 2 - 3, -11, 11, 22);
    }

    // Magnetic torquer coils glow when active
    if (this.installed.mag && Math.abs(s.lastMagCmd) > 2) {
      ctx.strokeStyle = `rgba(167, 139, 250, ${Math.min(0.95, Math.abs(s.lastMagCmd) / 70)})`;
      ctx.lineWidth = 3;
      ctx.strokeRect(-satSize * 0.38, -satSize * 0.38, satSize * 0.76, satSize * 0.76);
    }

    // Central Reaction Wheel (Flywheel)
    if (this.installed.wheel) {
      const wheelR = satSize * 0.27;
      const saturated = Math.abs(s.wheelRpm) > 5400;
      ctx.fillStyle = '#090f1d';
      ctx.strokeStyle = saturated ? '#ef4444' : '#a78bfa';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, 0, wheelR, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Spinning spokes
      const spokeAngle = (s.simTime * (s.wheelRpm / 60) * 0.35) % (Math.PI * 2);
      ctx.save();
      ctx.rotate(spokeAngle);
      ctx.strokeStyle = saturated ? '#fca5a5' : '#c4b5fd';
      ctx.lineWidth = 2;
      for (let k = 0; k < 3; k++) {
        const a = (k * Math.PI * 2) / 3;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(a) * wheelR, Math.sin(a) * wheelR);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Forward axis arrow (+X)
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(satSize * 0.28, 0);
    ctx.lineTo(satSize * 0.68, 0);
    ctx.stroke();

    ctx.restore();
  }

  drawBusSchematic(ctx, w, h) {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#080e1a';
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText('Бортовая шина CubeSat (RS-485 + Питание СЭП 8.4В / 5В)', 22, 30);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '12px sans-serif';
    ctx.fillText('Кликните по блокам имитации отказов ниже, чтобы протестировать устойчивость алгоритмов БКУ:', 22, 50);

    // Draw Horizontal Spine Buses
    const busYPower = 105;
    const busYData = 130;

    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(30, busYPower); ctx.lineTo(w - 30, busYPower); ctx.stroke();
    ctx.fillStyle = '#fca5a5';
    ctx.font = 'bold 11px ui-monospace, monospace';
    ctx.fillText('ШИНА ПИТАНИЯ +Vbat / +5V', 32, busYPower - 8);

    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(30, busYData); ctx.lineTo(w - 30, busYData); ctx.stroke();
    ctx.fillStyle = '#7dd3fc';
    ctx.fillText('ИНФОРМАЦИОННАЯ ШИНА RS-485 (A/B)', 32, busYData + 16);

    // Module nodes hanging off the bus
    const cols = 3;
    const cardW = Math.min(220, (w - 80) / cols);
    const cardH = 56;
    MODULES_CATALOG.forEach((m, idx) => {
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      const x = 30 + col * (cardW + 14);
      const y = 165 + row * (cardH + 14);
      const on = !!this.installed[m.id];

      // Drop wires
      ctx.strokeStyle = on ? 'rgba(239,68,68,0.55)' : 'rgba(100,116,139,0.2)';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(x + 18, busYPower); ctx.lineTo(x + 18, y); ctx.stroke();
      ctx.strokeStyle = on ? 'rgba(56,189,248,0.55)' : 'rgba(100,116,139,0.2)';
      ctx.beginPath(); ctx.moveTo(x + 30, busYData); ctx.lineTo(x + 30, y); ctx.stroke();

      ctx.fillStyle = on ? '#132038' : '#0d1322';
      ctx.strokeStyle = on ? '#38bdf8' : '#253554';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(x, y, cardW, cardH, 7);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = on ? '#f8fafc' : '#64748b';
      ctx.font = 'bold 11.5px sans-serif';
      ctx.fillText(m.name, x + 10, y + 22);
      ctx.fillStyle = '#8fa1bd';
      ctx.font = '10.5px ui-monospace, monospace';
      ctx.fillText(`Адрес 0x0${idx + 1} · ${on ? 'ONLINE' : 'OFFLINE'}`, x + 10, y + 40);
    });

    // Interactive Fault Injection Switches at the bottom
    const faults = [
      { key: 'faultSensorInvert', label: 'Инверсия полярности солнечных датчиков' },
      { key: 'faultGyroDead', label: 'Обрыв линии RS-485 гироскопа (ДУС)' },
      { key: 'faultDisturbance', label: 'Внешний возмущающий момент стенда' }
    ];

    const fy = Math.max(385, h - 92);
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText('Стенд нештатных ситуаций (нажмите для вкл/выкл отказа):', 30, fy - 12);

    this.faultBoxes = [];
    const fw = Math.min(250, (w - 84) / 3);
    faults.forEach((f, i) => {
      const fx = 30 + i * (fw + 12);
      const active = !!this.state[f.key];
      this.faultBoxes.push({ x: fx, y: fy, w: fw, h: 52, key: f.key, label: f.label });

      ctx.fillStyle = active ? 'rgba(239, 68, 68, 0.22)' : '#131c31';
      ctx.strokeStyle = active ? '#ef4444' : '#364e7a';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.roundRect(fx, fy, fw, 52, 7);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = active ? '#fca5a5' : '#cbd5e1';
      ctx.font = 'bold 11px sans-serif';
      ctx.fillText(f.label.slice(0, 34), fx + 10, fy + 21);
      ctx.font = '10.5px ui-monospace, monospace';
      ctx.fillStyle = active ? '#ef4444' : '#22c55e';
      ctx.fillText(active ? '● АВАРИЯ АКТИВНА' : '● ШТАТНЫЙ РЕЖИМ', fx + 10, fy + 39);
    });
  }

  applyPreset(p) {
    if (!p) return;
    if (typeof p.theta === 'number') this.state.theta = p.theta;
    if (typeof p.omega === 'number') this.state.omega = p.omega;
    if (typeof p.sunAngle === 'number') this.state.sunAngle = p.sunAngle;
    if (typeof p.targetAngle === 'number') this.state.targetAngle = p.targetAngle;
    if (typeof p.eclipse === 'boolean') this.state.eclipse = p.eclipse;
    this.state.faultSensorInvert = !!p.faultSensorInvert;
    this.state.faultGyroDead = !!p.faultGyroDead;
    this.state.wheelRpm = 0;
    this.state.simTime = 0;
    this.state.photosTaken = 0;
    this.state.lastPhotoError = null;
    this.running = true;

    if (p.presetCode && CODE_PRESETS[p.presetCode]) {
      this.compileCode(CODE_PRESETS[p.presetCode], false);
    }

    if (this.containers) {
      this.mount(this.containers);
    }
  }

  getStateForMission() {
    return {
      ...this.state,
      targetError: wrapDeg(this.state.targetAngle - this.state.theta),
      sunError: wrapDeg(this.state.sunAngle - this.state.theta)
    };
  }

  exportState() {
    return {
      installed: { ...this.installed },
      state: { ...this.state },
      codeText: this.codeText
    };
  }

  importState(data) {
    if (!data) return;
    if (data.installed) Object.assign(this.installed, data.installed);
    if (data.state) Object.assign(this.state, data.state);
    if (data.codeText) this.compileCode(data.codeText, false);
    if (this.containers) this.mount(this.containers);
  }
}
