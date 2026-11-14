import { TelemetryScope } from '../ui/scope.js';

const NOSE_SHAPES = {
  ogive: { name: 'Оживальный (Cx 0.33)', cx: 0.33, cpFrac: 0.46 },
  parabolic: { name: 'Параболический (Cx 0.35)', cx: 0.35, cpFrac: 0.50 },
  cone: { name: 'Конический (Cx 0.46)', cx: 0.46, cpFrac: 0.66 },
  blunt: { name: 'Тупой / Сферический (Cx 0.78)', cx: 0.78, cpFrac: 0.42 }
};

const MATERIALS = {
  carbon: { name: 'Углепластик (лёгкий)', densFactor: 0.62 },
  fiberglass: { name: 'Стеклопластик', densFactor: 1.0 },
  cardboard: { name: 'Прессованный картон', densFactor: 0.85 }
};

const MOTORS = {
  rd1_50: { name: 'РД1-50 (импульс 55 Н·с)', totalImp: 55, burnTime: 1.4, propMassG: 32, caseMassG: 35 },
  rd1_100: { name: 'РД1-100 (импульс 120 Н·с)', totalImp: 120, burnTime: 1.9, propMassG: 65, caseMassG: 55 },
  imp_250: { name: 'Импульс-250 CanSat (310 Н·с)', totalImp: 310, burnTime: 2.6, propMassG: 165, caseMassG: 110 },
  strato_900: { name: 'Страто-900 Высотный (980 Н·с)', totalImp: 980, burnTime: 3.8, propMassG: 460, caseMassG: 210 }
};

export class RocketLab {
  constructor(shell) {
    this.shell = shell;
    this.viewMode = 'tunnel'; // 'tunnel' | 'launch'
    this.aoaDeg = 4;

    this.design = {
      noseShape: 'ogive',
      bodyMaterial: 'fiberglass',
      bodyLenCm: 64,
      finCount: 4,
      finSpanCm: 8.2,
      noseMassG: 30,
      hasCanSat: true,
      motorId: 'imp_250',
      chuteDiamCm: 75,
      deployMode: 'baro', // 'baro' | 'timer'
      timerSec: 6.5
    };

    this.smokeParticles = Array.from({ length: 75 }, (_, i) => ({
      x: (i * 19) % 700,
      lane: (i % 15) - 7
    }));

    this.logs = [];
    this.resetFlight();
  }

  calcAeroAndMass(propFraction = 1.0) {
    const d = this.design;
    const calCm = 7.0; // Ø 70 мм (под стандарт CanSat 66 мм)
    const noseLenCm = 16;
    const totalLenCm = noseLenCm + d.bodyLenCm;

    const nose = NOSE_SHAPES[d.noseShape] || NOSE_SHAPES.ogive;
    const mat = MATERIALS[d.bodyMaterial] || MATERIALS.fiberglass;
    const motor = MOTORS[d.motorId] || MOTORS.imp_250;

    // Component masses (g) & CG positions from nose tip (cm)
    const mNose = 48 * mat.densFactor + d.noseMassG;
    const xNose = d.noseMassG > 0 ? 7.5 : 10.0;

    const mBody = d.bodyLenCm * 2.1 * mat.densFactor;
    const xBody = noseLenCm + d.bodyLenCm * 0.5;

    const mCanSat = d.hasCanSat ? 310 : 0;
    const xCanSat = noseLenCm + d.bodyLenCm * 0.28;

    const mChute = 22 + d.chuteDiamCm * 0.45;
    const xChute = noseLenCm + d.bodyLenCm * 0.16;

    const mFins = d.finCount * d.finSpanCm * 4.2 * mat.densFactor;
    const xFins = totalLenCm - 7.0;

    const mMotor = motor.caseMassG + motor.propMassG * propFraction;
    const xMotor = totalLenCm - 8.5;

    const totalMassG = mNose + mBody + mCanSat + mChute + mFins + mMotor;
    const cgCm =
      (mNose * xNose +
        mBody * xBody +
        mCanSat * xCanSat +
        mChute * xChute +
        mFins * xFins +
        mMotor * xMotor) /
      totalMassG;

    // Barrowman CP approximation
    const cnNose = 2.0;
    const xCpNose = noseLenCm * nose.cpFrac;

    const finRootCm = 11.0;
    const sRatio = d.finSpanCm / calCm;
    const cnFins = (1 + 0.5 / (1 + sRatio)) * (4 * d.finCount * (sRatio ** 2)) / (1 + Math.sqrt(1 + (2 * sRatio) ** 2));
    const xCpFins = totalLenCm - finRootCm * 0.62;

    const cpCm = (cnNose * xCpNose + cnFins * xCpFins) / (cnNose + cnFins);
    const stabilityCal = (cpCm - cgCm) / calCm;

    // Effective drag coefficient Cx referenced to Ø 70mm cross-section
    const cx = nose.cx + 0.012 * d.finCount * (d.finSpanCm / 7) + (d.bodyMaterial === 'cardboard' ? 0.05 : 0.015);
    const avgThrustN = motor.totalImp / motor.burnTime;
    const twRatio = avgThrustN / ((totalMassG / 1000) * 9.81);

    return {
      calCm,
      noseLenCm,
      totalLenCm,
      totalMassKg: totalMassG / 1000,
      cgCm,
      cpCm,
      stabilityCal,
      cx,
      twRatio,
      motor
    };
  }

  resetFlight() {
    const aero = this.calcAeroAndMass(1.0);
    this.flight = {
      phase: 'pad', // 'pad' | 'boost' | 'coast' | 'chute' | 'tumble' | 'landed' | 'crashed'
      t: 0,
      altM: 0,
      xDriftM: 0,
      vy: 0,
      vx: 0,
      accelG: 1.0,
      maxAltM: 0,
      maxSpeedMs: 0,
      pressureHpa: 1013.25,
      tempC: 18.0,
      chuteOpen: false,
      chuteRipped: false,
      landedOk: false,
      touchdownSpeed: 0,
      statusText: 'На стартовом столе',
      trail: [],
      apogeeDetectedCount: 0,
      prevBaroAlt: 0,
      pitchRad: 0
    };
    this.aero = aero;
    if (this.scope) this.scope.clear();
  }

  mount(containers) {
    this.containers = containers;
    this.renderLeft(containers.left);
    this.renderCenter(containers.center);
    this.renderRight(containers.right);
    this.updateDOM();
  }

  unmount() {
    this.containers = null;
  }

  pushLog(msg, cls = '') {
    const t = this.flight.t.toFixed(1).padStart(5, ' ');
    this.logs.push({ t, msg, cls });
    if (this.logs.length > 50) this.logs.shift();
    if (this.logEl) {
      this.logEl.innerHTML = this.logs
        .map((l) => `<div class="${l.cls}">[${l.t}с] ${l.msg}</div>`)
        .join('');
      this.logEl.scrollTop = this.logEl.scrollHeight;
    }
  }

  renderLeft(el) {
    const d = this.design;
    el.innerHTML = `
      <div class="panel-section">
        <div class="section-header">
          <span class="section-title">Планер и аэродинамика (Ø 70 мм)</span>
        </div>

        <div class="control-row">
          <label class="control-label"><span>Головной обтекатель</span></label>
          <select id="rk-nose">
            ${Object.entries(NOSE_SHAPES)
              .map(([k, v]) => `<option value="${k}" ${d.noseShape === k ? 'selected' : ''}>${v.name}</option>`)
              .join('')}
          </select>
        </div>

        <div class="control-row">
          <label class="control-label"><span>Материал корпуса</span></label>
          <select id="rk-mat">
            ${Object.entries(MATERIALS)
              .map(([k, v]) => `<option value="${k}" ${d.bodyMaterial === k ? 'selected' : ''}>${v.name}</option>`)
              .join('')}
          </select>
        </div>

        <div class="control-row">
          <label class="control-label">
            <span>Длина тубуса</span>
            <span class="control-val" id="rk-len-lbl">${d.bodyLenCm} см</span>
          </label>
          <input type="range" id="rk-len" min="40" max="95" step="1" value="${d.bodyLenCm}">
        </div>

        <div class="control-row">
          <label class="control-label">
            <span>Размах стабилизаторов (${d.finCount} шт.)</span>
            <span class="control-val" id="rk-fin-lbl">${d.finSpanCm} см</span>
          </label>
          <input type="range" id="rk-fin" min="2.5" max="13.5" step="0.5" value="${d.finSpanCm}">
        </div>

        <div class="control-row">
          <label class="control-label">
            <span>Носовой балласт (центровка ЦМ)</span>
            <span class="control-val" id="rk-bal-lbl">${d.noseMassG} г</span>
          </label>
          <input type="range" id="rk-bal" min="0" max="140" step="5" value="${d.noseMassG}">
        </div>

        <label style="display:flex; align-items:center; gap:8px; cursor:pointer; margin-top:6px; font-size:12px;">
          <input type="checkbox" id="rk-cansat" ${d.hasCanSat ? 'checked' : ''}>
          <span>Отсек <strong>CanSat 0.33 л (310 г)</strong></span>
        </label>
      </div>

      <div class="panel-section">
        <div class="section-header">
          <span class="section-title">Двигатель и спасение</span>
        </div>

        <div class="control-row">
          <label class="control-label"><span>Ракетный двигатель (МРД)</span></label>
          <select id="rk-motor">
            ${Object.entries(MOTORS)
              .map(([k, v]) => `<option value="${k}" ${d.motorId === k ? 'selected' : ''}>${v.name}</option>`)
              .join('')}
          </select>
        </div>

        <div class="control-row">
          <label class="control-label">
            <span>Диаметр парашюта</span>
            <span class="control-val" id="rk-chute-lbl">${d.chuteDiamCm} см</span>
          </label>
          <input type="range" id="rk-chute" min="35" max="115" step="5" value="${d.chuteDiamCm}">
        </div>

        <div class="control-row">
          <label class="control-label"><span>Автоматика выброса парашюта</span></label>
          <select id="rk-deploy">
            <option value="baro" ${d.deployMode === 'baro' ? 'selected' : ''}>Бортовой барометр CanSat (апогей)</option>
            <option value="timer" ${d.deployMode === 'timer' ? 'selected' : ''}>Пиротаймер задержки (с)</option>
          </select>
        </div>

        <div class="control-row" id="rk-timer-row" style="display:${d.deployMode === 'timer' ? 'flex' : 'none'};">
          <label class="control-label">
            <span>Задержка таймера от старта</span>
            <span class="control-val" id="rk-tmr-lbl">${d.timerSec} с</span>
          </label>
          <input type="range" id="rk-tmr" min="1.5" max="16.0" step="0.5" value="${d.timerSec}">
        </div>

        <button class="btn btn-success" id="rk-launch-btn" style="width:100%; margin-top:8px; font-size:13px;">
          🚀 ЗАПУСТИТЬ НА ПОЛИГОНЕ
        </button>
      </div>
    `;

    const bind = (sel, evt, fn) => el.querySelector(sel).addEventListener(evt, fn);

    bind('#rk-nose', 'change', (e) => { d.noseShape = e.target.value; this.onDesignChange(); });
    bind('#rk-mat', 'change', (e) => { d.bodyMaterial = e.target.value; this.onDesignChange(); });
    bind('#rk-len', 'input', (e) => {
      d.bodyLenCm = Number(e.target.value);
      el.querySelector('#rk-len-lbl').textContent = `${d.bodyLenCm} см`;
      this.onDesignChange();
    });
    bind('#rk-fin', 'input', (e) => {
      d.finSpanCm = Number(e.target.value);
      el.querySelector('#rk-fin-lbl').textContent = `${d.finSpanCm} см`;
      this.onDesignChange();
    });
    bind('#rk-bal', 'input', (e) => {
      d.noseMassG = Number(e.target.value);
      el.querySelector('#rk-bal-lbl').textContent = `${d.noseMassG} г`;
      this.onDesignChange();
    });
    bind('#rk-cansat', 'change', (e) => { d.hasCanSat = e.target.checked; this.onDesignChange(); });
    bind('#rk-motor', 'change', (e) => { d.motorId = e.target.value; this.onDesignChange(); });
    bind('#rk-chute', 'input', (e) => {
      d.chuteDiamCm = Number(e.target.value);
      el.querySelector('#rk-chute-lbl').textContent = `${d.chuteDiamCm} см`;
      this.onDesignChange();
    });
    bind('#rk-deploy', 'change', (e) => {
      d.deployMode = e.target.value;
      el.querySelector('#rk-timer-row').style.display = d.deployMode === 'timer' ? 'flex' : 'none';
      this.onDesignChange();
    });
    bind('#rk-tmr', 'input', (e) => {
      d.timerSec = Number(e.target.value);
      el.querySelector('#rk-tmr-lbl').textContent = `${d.timerSec} с`;
    });

    bind('#rk-launch-btn', 'click', () => this.startLaunch());
  }

  onDesignChange() {
    this.aero = this.calcAeroAndMass(1.0);
    if (this.flight.phase === 'pad') {
      this.updateDOM();
    }
  }

  startLaunch() {
    this.resetFlight();
    this.viewMode = 'launch';
    if (this.containers) {
      this.containers.center.querySelectorAll('[data-view]').forEach((b) => {
        b.classList.toggle('active', b.dataset.view === 'launch');
      });
    }

    if (this.aero.twRatio < 1.35) {
      this.flight.phase = 'crashed';
      this.flight.statusText = 'Тяга меньше веса ракеты (T/W < 1.35)!';
      this.pushLog('ОТКАЗ СТАРТА: недостаточная тяговооружённость двигателя!', 'log-err');
      return;
    }

    this.flight.phase = 'boost';
    this.flight.statusText = 'Активный участок (работа МРД)';
    this.logs = [];
    this.pushLog(`ПУСК! Масса ${(this.aero.totalMassKg * 1000).toFixed(0)} г, запас уст. ${this.aero.stabilityCal.toFixed(2)} кал.`, 'log-ok');
  }

  renderCenter(el) {
    el.innerHTML = `
      <div class="bench-toolbar">
        <div class="segmented">
          <button class="seg-btn ${this.viewMode === 'tunnel' ? 'active' : ''}" data-view="tunnel">Аэродинамическая труба</button>
          <button class="seg-btn ${this.viewMode === 'launch' ? 'active' : ''}" data-view="launch">Полигон запуска</button>
        </div>

        <div class="time-controls">
          <label style="font-size:11.5px; color:var(--text-2); display:flex; align-items:center; gap:6px;">
            <span>Угол атаки α:</span>
            <input type="range" id="rk-aoa" min="-12" max="12" step="1" value="${this.aoaDeg}" style="width:80px;">
            <span class="control-val" id="rk-aoa-val">${this.aoaDeg}°</span>
          </label>
          <button class="btn btn-sm btn-success" id="rk-top-launch">🚀 Пуск</button>
        </div>
      </div>

      <div class="canvas-stage">
        <canvas id="rk-canvas"></canvas>
        <div class="canvas-hud" id="rk-hud"></div>
      </div>
    `;

    this.canvas = el.querySelector('#rk-canvas');
    this.hudEl = el.querySelector('#rk-hud');

    el.querySelectorAll('[data-view]').forEach((b) => {
      b.addEventListener('click', () => {
        this.viewMode = b.dataset.view;
        el.querySelectorAll('[data-view]').forEach((x) => x.classList.toggle('active', x === b));
      });
    });

    const aoa = el.querySelector('#rk-aoa');
    aoa.addEventListener('input', () => {
      this.aoaDeg = Number(aoa.value);
      el.querySelector('#rk-aoa-val').textContent = `${this.aoaDeg}°`;
    });

    el.querySelector('#rk-top-launch').addEventListener('click', () => this.startLaunch());
  }

  renderRight(el) {
    el.innerHTML = `
      <div class="panel-section">
        <div class="section-header">
          <span class="section-title">Центровка и баллистика</span>
        </div>
        <div class="telemetry-grid">
          <div class="telemetry-card">
            <span class="telemetry-label">Стартовая масса / T/W</span>
            <span class="telemetry-value" id="rk-t-mass">0 г</span>
          </div>
          <div class="telemetry-card">
            <span class="telemetry-label">Запас устойчивости</span>
            <span class="telemetry-value cyan" id="rk-t-stab">1.60 кал.</span>
          </div>
          <div class="telemetry-card">
            <span class="telemetry-label">Высота / Апогей</span>
            <span class="telemetry-value green" id="rk-t-alt">0 / 0 м</span>
          </div>
          <div class="telemetry-card">
            <span class="telemetry-label">Вертик. скорость Vy</span>
            <span class="telemetry-value amber" id="rk-t-vel">0.0 м/с</span>
          </div>
          <div class="telemetry-card">
            <span class="telemetry-label">Барометр BMP280</span>
            <span class="telemetry-value violet" id="rk-t-baro">1013.2 гПа</span>
          </div>
          <div class="telemetry-card">
            <span class="telemetry-label">Посадка CanSat</span>
            <span class="telemetry-value" id="rk-t-land">Ожидание</span>
          </div>
        </div>
      </div>

      <div class="panel-section">
        <div class="section-header">
          <span class="section-title">Графики телеметрии CanSat</span>
        </div>
        <div id="rk-scope-root"></div>
      </div>

      <div class="panel-section" style="flex:1; display:flex; flex-direction:column; gap:6px;">
        <div class="section-title">Пакеты радиотелеметрии (433 МГц)</div>
        <div class="serial-log" id="rk-log" style="flex:1; min-height:110px;"></div>
      </div>
    `;

    this.scope = new TelemetryScope(
      el.querySelector('#rk-scope-root'),
      [
        { key: 'alt', label: 'Высота', unit: ' м', color: '#22c55e', min: 0, max: 3800 },
        { key: 'vy', label: 'Vy', unit: ' м/с', color: '#38bdf8', min: -80, max: 280 },
        { key: 'p', label: 'P', unit: ' гПа', color: '#a78bfa', min: 600, max: 1020 }
      ],
      { height: 138 }
    );

    this.logEl = el.querySelector('#rk-log');
    this.pushLog('Стенд продувки и предстартовой подготовки готов.');
  }

  deployParachute(reason) {
    const f = this.flight;
    if (f.chuteOpen) return;
    f.chuteOpen = true;
    const speed = Math.hypot(f.vx, f.vy);

    if (speed > 34) {
      f.chuteRipped = true;
      f.statusText = `Обрыв строп парашюта на скорости ${speed.toFixed(0)} м/с!`;
      this.pushLog(`АВАРИЯ СС (${reason}): динамический удар при V=${speed.toFixed(1)} м/с — стропы оборваны!`, 'log-err');
    } else {
      f.phase = 'chute';
      f.statusText = 'Спуск на парашюте';
      this.pushLog(`Срабатывание СС (${reason}) на высоте ${f.altM.toFixed(0)} м (V=${speed.toFixed(1)} м/с). Купол раскрыт!`, 'log-ok');
    }
  }

  step(dtReal) {
    if (!this.containers) return;

    // Advance wind tunnel smoke
    this.smokeParticles.forEach((p) => {
      p.x += dtReal * 240;
      if (p.x > 900) p.x -= 900;
    });

    // Advance flight physics if in flight
    const f = this.flight;
    if (['boost', 'coast', 'chute', 'tumble'].includes(f.phase)) {
      const simSpeed = f.phase === 'chute' && f.altM > 120 ? 3.5 : 1.6;
      const subSteps = 4;
      const dt = (dtReal * simSpeed) / subSteps;

      for (let i = 0; i < subSteps; i++) {
        this.flightTick(dt);
        if (f.phase === 'landed' || f.phase === 'crashed') break;
      }

      if (this.scope) {
        this.scope.push({ alt: f.altM, vy: f.vy, p: f.pressureHpa });
      }
    }

    this.drawCanvas();
    this.updateDOM();
  }

  flightTick(dt) {
    const f = this.flight;
    const d = this.design;
    f.t += dt;

    const motor = MOTORS[d.motorId] || MOTORS.imp_250;
    const propFrac = Math.max(0, 1 - f.t / motor.burnTime);
    const aero = this.calcAeroAndMass(propFrac);
    this.aero = aero;

    // Atmosphere ISA
    f.tempC = 18.0 - 0.0065 * f.altM;
    f.pressureHpa = 1013.25 * Math.pow(Math.max(0.1, 1 - (0.0065 * f.altM) / 291.15), 5.255);
    const rho = 1.225 * Math.exp(-f.altM / 8500);

    // Thrust curve (trapezoidal boost peak)
    let thrustN = 0;
    if (f.t <= motor.burnTime && f.phase !== 'tumble') {
      const u = f.t / motor.burnTime;
      const shape = u < 0.15 ? 1.35 : u < 0.85 ? 1.02 : (1 - u) * 5.0;
      thrustN = (motor.totalImp / motor.burnTime) * shape;
    } else if (f.phase === 'boost') {
      f.phase = 'coast';
      f.statusText = 'Пассивный полёт по инерции';
      this.pushLog(`Выгорание МРД на высоте ${f.altM.toFixed(0)} м, V=${f.vy.toFixed(1)} м/с.`);
    }

    // Check aerodynamic stability once off launch rail (> 18 m)
    if (f.altM > 18 && aero.stabilityCal < 0.35 && f.phase !== 'tumble') {
      f.phase = 'tumble';
      f.statusText = 'Потеря устойчивости — кувырок!';
      this.pushLog(`АВАРИЯ: ЦД впереди ЦМ (${aero.stabilityCal.toFixed(2)} кал.) — ракета ушла в кувырок!`, 'log-err');
    }

    const areaRocket = Math.PI * (0.035 ** 2);
    let effCxArea = aero.cx * areaRocket;

    if (f.phase === 'tumble') {
      f.pitchRad += 9.5 * dt;
      effCxArea *= 4.5; // High drag while tumbling sideways
    } else {
      f.pitchRad = Math.atan2(f.vx, Math.max(2, Math.abs(f.vy))) * 0.25;
    }

    if (f.chuteOpen && !f.chuteRipped) {
      const rChute = (d.chuteDiamCm / 100) / 2;
      effCxArea += 1.35 * Math.PI * rChute * rChute;
    }

    const vMag = Math.hypot(f.vx, f.vy) || 1e-5;
    const dragForce = 0.5 * rho * vMag * vMag * effCxArea;
    const dragY = -dragForce * (f.vy / vMag);
    const windMs = 2.8 + (f.altM / 1500) * 4.0;
    const ay = (thrustN + dragY) / aero.totalMassKg - 9.81;

    f.vy += ay * dt;
    f.vx = f.chuteOpen && !f.chuteRipped ? windMs * 0.7 : windMs * 0.12;
    f.altM += f.vy * dt;
    f.xDriftM += f.vx * dt;
    f.accelG = (ay + 9.81) / 9.81;

    if (f.altM > f.maxAltM) f.maxAltM = f.altM;
    if (Math.abs(f.vy) > f.maxSpeedMs) f.maxSpeedMs = Math.abs(f.vy);

    // Parachute trigger logic
    if (!f.chuteOpen && f.phase !== 'tumble' && f.t > 0.6) {
      if (d.deployMode === 'timer' && f.t >= d.timerSec) {
        this.deployParachute(`Таймер ${d.timerSec}с`);
      } else if (d.deployMode === 'baro' && f.t > motor.burnTime + 0.2 && f.vy <= -1.2) {
        this.deployParachute('Детектор апогея BMP280');
      }
    }

    if (Math.floor(f.t * 5) !== Math.floor((f.t - dt) * 5)) {
      f.trail.push({ x: f.xDriftM, y: Math.max(0, f.altM), chute: f.chuteOpen && !f.chuteRipped });
      if (f.trail.length > 260) f.trail.shift();
    }

    // Ground contact check
    if (f.altM <= 0 && f.t > 0.4) {
      f.altM = 0;
      f.touchdownSpeed = Math.abs(f.vy);
      f.vy = 0;
      if (f.chuteOpen && !f.chuteRipped && f.touchdownSpeed <= 8.0 && f.phase !== 'tumble') {
        f.phase = 'landed';
        f.landedOk = true;
        f.statusText = `Мягкая посадка (${f.touchdownSpeed.toFixed(1)} м/с)`;
        this.pushLog(`ПОСАДКА УСПЕШНА! Апогей ${f.maxAltM.toFixed(0)} м, Vкас = ${f.touchdownSpeed.toFixed(1)} м/с.`, 'log-ok');
      } else {
        f.phase = 'crashed';
        f.landedOk = false;
        f.statusText = `Разрушение при ударе (${f.touchdownSpeed.toFixed(1)} м/с)`;
        this.pushLog(`ЖЁСТКИЙ УДАР О ЗЕМЛЮ (${f.touchdownSpeed.toFixed(1)} м/с) — аппарат повреждён!`, 'log-err');
      }
    }
  }

  updateDOM() {
    if (!this.containers) return;
    const r = this.containers.right;
    const f = this.flight;
    const a = this.aero;

    r.querySelector('#rk-t-mass').textContent = `${(a.totalMassKg * 1000).toFixed(0)} г · T/W ${a.twRatio.toFixed(1)}`;
    const stabEl = r.querySelector('#rk-t-stab');
    stabEl.textContent = `${a.stabilityCal >= 0 ? '+' : ''}${a.stabilityCal.toFixed(2)} кал.`;
    stabEl.className = 'telemetry-value ' + (a.stabilityCal >= 1.0 && a.stabilityCal <= 3.2 ? 'green' : a.stabilityCal < 0.4 ? 'red' : 'amber');

    r.querySelector('#rk-t-alt').textContent = `${f.altM.toFixed(0)} / ${f.maxAltM.toFixed(0)} м`;
    r.querySelector('#rk-t-vel').textContent = `${f.vy.toFixed(1)} м/с`;
    r.querySelector('#rk-t-baro').textContent = `${f.pressureHpa.toFixed(1)} гПа`;

    const landEl = r.querySelector('#rk-t-land');
    landEl.textContent = f.statusText;
    landEl.className = 'telemetry-value ' + (f.landedOk ? 'green' : f.phase === 'crashed' || f.phase === 'tumble' ? 'red' : '');

    if (this.hudEl) {
      const chips = [];
      if (a.stabilityCal < 0.4) {
        chips.push(`<div class="hud-chip danger">⚠ НЕУСТОЙЧИВА (${a.stabilityCal.toFixed(2)} кал.): ЦД впереди ЦМ! Увеличьте стабилизаторы или носовой груз</div>`);
      } else if (a.stabilityCal < 1.0) {
        chips.push(`<div class="hud-chip warn">⚠ Малый запас устойчивости (${a.stabilityCal.toFixed(2)} кал., рекомендуется 1.2–2.5 кал.)</div>`);
      } else {
        chips.push(`<div class="hud-chip ok">✓ Аэродинамически устойчива: запас ${a.stabilityCal.toFixed(2)} калибра (ЦД позади ЦМ)</div>`);
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

    if (this.viewMode === 'launch') {
      this.drawLaunchRange(ctx, w, h);
    } else {
      this.drawWindTunnel(ctx, w, h);
    }

    ctx.restore();
  }

  drawWindTunnel(ctx, w, h) {
    const a = this.aero;
    const d = this.design;
    ctx.fillStyle = '#070e1b';
    ctx.fillRect(0, 0, w, h);

    // Wind tunnel honeycomb intake & walls
    ctx.strokeStyle = '#1e3a5f';
    ctx.lineWidth = 2;
    ctx.strokeRect(18, 48, w - 36, h - 80);

    const cy = h / 2 + 12;
    const cx = w / 2;
    const scalePxPerCm = Math.min((w * 0.58) / a.totalLenCm, 5.2);
    const rPx = (a.calCm / 2) * scalePxPerCm;
    const xNoseTip = cx - (a.totalLenCm * scalePxPerCm) / 2;

    // Animated smoke streamlines
    const aoaRad = (this.aoaDeg * Math.PI) / 180;
    ctx.strokeStyle = 'rgba(125, 211, 252, 0.22)';
    ctx.lineWidth = 1.4;
    for (let lane = -6; lane <= 6; lane++) {
      if (lane === 0) continue;
      const baseY = cy + lane * 22;
      ctx.beginPath();
      for (let x = 24; x < w - 24; x += 12) {
        const dx = x - cx;
        const bodyHalf = (a.totalLenCm * scalePxPerCm) / 2;
        let deflect = 0;
        if (Math.abs(dx) < bodyHalf + 60) {
          const factor = Math.exp(-((dx / (bodyHalf * 0.85)) ** 2));
          deflect = Math.sign(lane) * factor * (rPx * 1.15) * (1 / (0.6 + Math.abs(lane) * 0.35));
          deflect += factor * this.aoaDeg * 0.9;
        }
        const y = baseY + deflect;
        if (x === 24) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // Smoketracer dots
    ctx.fillStyle = 'rgba(186, 230, 253, 0.55)';
    this.smokeParticles.forEach((p) => {
      const x = 24 + (p.x % (w - 48));
      const y = cy + p.lane * 20;
      ctx.fillRect(x, y, 8, 2);
    });

    // Rocket assembly rotated by AoA
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-aoaRad);
    ctx.translate(-cx, -cy);

    const nosePx = a.noseLenCm * scalePxPerCm;
    const bodyPx = d.bodyLenCm * scalePxPerCm;
    const xBodyStart = xNoseTip + nosePx;
    const xTail = xBodyStart + bodyPx;

    // Fins at tail
    const finSpanPx = d.finSpanCm * scalePxPerCm;
    const finRootPx = 11 * scalePxPerCm;
    ctx.fillStyle = '#0284c7';
    ctx.strokeStyle = '#7dd3fc';
    ctx.lineWidth = 1.5;
    [-1, 1].forEach((dir) => {
      ctx.beginPath();
      ctx.moveTo(xTail - finRootPx, cy + dir * rPx);
      ctx.lineTo(xTail - finRootPx * 0.25, cy + dir * (rPx + finSpanPx));
      ctx.lineTo(xTail + finRootPx * 0.12, cy + dir * (rPx + finSpanPx * 0.8));
      ctx.lineTo(xTail, cy + dir * rPx);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    });

    // Body Tube
    ctx.fillStyle = d.bodyMaterial === 'carbon' ? '#1e293b' : d.bodyMaterial === 'fiberglass' ? '#334155' : '#475569';
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1.8;
    ctx.fillRect(xBodyStart, cy - rPx, bodyPx, rPx * 2);
    ctx.strokeRect(xBodyStart, cy - rPx, bodyPx, rPx * 2);

    // Internal X-ray view: CanSat payload + Chute + Motor
    if (d.hasCanSat) {
      const csX = xBodyStart + bodyPx * 0.2;
      const csW = 11.5 * scalePxPerCm;
      ctx.fillStyle = 'rgba(34, 197, 94, 0.35)';
      ctx.strokeStyle = '#4ade80';
      ctx.fillRect(csX, cy - rPx * 0.82, csW, rPx * 1.64);
      ctx.strokeRect(csX, cy - rPx * 0.82, csW, rPx * 1.64);
      ctx.fillStyle = '#bbf7d0';
      ctx.font = 'bold 10px sans-serif';
      ctx.fillText('CanSat', csX + 4, cy + 3);
    }

    // Motor casing at aft
    const motW = 13 * scalePxPerCm;
    ctx.fillStyle = 'rgba(245, 158, 11, 0.38)';
    ctx.strokeStyle = '#fbbf24';
    ctx.fillRect(xTail - motW, cy - rPx * 0.55, motW, rPx * 1.1);
    ctx.strokeRect(xTail - motW, cy - rPx * 0.55, motW, rPx * 1.1);

    // Nosecone
    ctx.fillStyle = '#e2e8f0';
    ctx.beginPath();
    if (d.noseShape === 'cone') {
      ctx.moveTo(xNoseTip, cy);
      ctx.lineTo(xBodyStart, cy - rPx);
      ctx.lineTo(xBodyStart, cy + rPx);
    } else if (d.noseShape === 'blunt') {
      ctx.arc(xNoseTip + rPx, cy, rPx, Math.PI * 0.5, Math.PI * 1.5);
      ctx.lineTo(xBodyStart, cy - rPx);
      ctx.lineTo(xBodyStart, cy + rPx);
      ctx.lineTo(xNoseTip + rPx, cy + rPx);
    } else {
      ctx.moveTo(xNoseTip, cy);
      ctx.quadraticCurveTo(xNoseTip + nosePx * 0.45, cy - rPx, xBodyStart, cy - rPx);
      ctx.lineTo(xBodyStart, cy + rPx);
      ctx.quadraticCurveTo(xNoseTip + nosePx * 0.45, cy + rPx, xNoseTip, cy);
    }
    ctx.closePath();
    ctx.fill();

    // CG (Центр масс) & CP (Центр давления) Markers!
    const xCg = xNoseTip + a.cgCm * scalePxPerCm;
    const xCp = xNoseTip + a.cpCm * scalePxPerCm;

    const drawMarker = (mx, my, color, label, above) => {
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(mx, my, 7, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(mx, my);
      ctx.lineTo(mx, my + (above ? -36 : 36));
      ctx.stroke();
      ctx.font = 'bold 11px sans-serif';
      ctx.fillText(label, mx - 28, my + (above ? -42 : 50));
    };

    drawMarker(xCg, cy, '#38bdf8', `ЦМ (${a.cgCm.toFixed(0)} см)`, true);
    drawMarker(xCp, cy, '#ef4444', `ЦД (${a.cpCm.toFixed(0)} см)`, false);

    ctx.restore();
  }

  drawLaunchRange(ctx, w, h) {
    const f = this.flight;
    const skyDark = Math.min(1, f.altM / 4500);
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, skyDark > 0.5 ? '#030712' : '#0c2448');
    grad.addColorStop(1, '#163a5f');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    const groundY = h - 38;
    ctx.fillStyle = '#143326';
    ctx.fillRect(0, groundY, w, 38);
    ctx.strokeStyle = '#22c55e';
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    ctx.lineTo(w, groundY);
    ctx.stroke();

    const maxScaleAlt = Math.max(300, f.maxAltM * 1.22);
    const pxPerM = (groundY - 52) / maxScaleAlt;
    const padX = w * 0.28;

    // Altitude grid markers
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.18)';
    ctx.fillStyle = '#94a3b8';
    ctx.font = '10.5px ui-monospace, monospace';
    const stepM = maxScaleAlt > 2200 ? 500 : maxScaleAlt > 800 ? 200 : 50;
    for (let m = stepM; m < maxScaleAlt; m += stepM) {
      const y = groundY - m * pxPerM;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
      ctx.fillText(`${m} м`, 10, y - 4);
    }

    // Flight trajectory trail
    if (f.trail.length > 1) {
      ctx.lineWidth = 2;
      for (let i = 1; i < f.trail.length; i++) {
        const p0 = f.trail[i - 1];
        const p1 = f.trail[i];
        ctx.strokeStyle = p1.chute ? '#4ade80' : '#38bdf8';
        ctx.beginPath();
        ctx.moveTo(padX + p0.x * pxPerM * 1.4, groundY - p0.y * pxPerM);
        ctx.lineTo(padX + p1.x * pxPerM * 1.4, groundY - p1.y * pxPerM);
        ctx.stroke();
      }
    }

    // Current rocket / CanSat position
    const rx = Math.min(w - 30, padX + f.xDriftM * pxPerM * 1.4);
    const ry = groundY - f.altM * pxPerM;

    ctx.save();
    ctx.translate(rx, ry);

    // Parachute canopy if open
    if (f.chuteOpen && !f.chuteRipped) {
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(0, -10); ctx.lineTo(-14, -30);
      ctx.moveTo(0, -10); ctx.lineTo(14, -30);
      ctx.stroke();

      ctx.fillStyle = '#f97316';
      ctx.beginPath();
      ctx.arc(0, -30, 16, Math.PI, 0);
      ctx.fill();
    }

    ctx.rotate(f.pitchRad);
    // Flame plume during boost
    if (f.phase === 'boost') {
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.moveTo(-4, 10);
      ctx.lineTo(0, 28 + Math.random() * 8);
      ctx.lineTo(4, 10);
      ctx.fill();
    }

    // Rocket sprite
    ctx.fillStyle = f.phase === 'crashed' ? '#ef4444' : '#f8fafc';
    ctx.fillRect(-4, -14, 8, 24);
    ctx.beginPath();
    ctx.moveTo(-4, -14); ctx.lineTo(0, -24); ctx.lineTo(4, -14);
    ctx.fill();

    ctx.restore();
  }

  applyPreset(p) {
    if (!p) return;
    Object.assign(this.design, p);
    this.viewMode = 'tunnel';
    this.resetFlight();
    if (this.containers) this.mount(this.containers);
  }

  getStateForMission() {
    return {
      stabilityCal: this.aero.stabilityCal,
      maxAltM: this.flight.maxAltM,
      landedOk: this.flight.landedOk,
      touchdownSpeed: this.flight.touchdownSpeed,
      flightStatusText: this.flight.statusText
    };
  }

  exportState() {
    return { design: { ...this.design } };
  }

  importState(data) {
    if (data && data.design) {
      Object.assign(this.design, data.design);
      this.resetFlight();
      if (this.containers) this.mount(this.containers);
    }
  }
}
