import { TelemetryScope } from '../ui/scope.js';

const MU = 398600.4418; // km^3 / s^2
const R_EARTH = 6371.0; // km
const G0 = 9.80665;     // m/s^2
const EARTH_ROT_DEG_PER_SEC = 360 / 86164;

const SPACECRAFTS = {
  soyuz: { name: 'КК «Союз-МС» (КТДУ-80)', dryKg: 6800, fuelKg: 850, isp: 302 },
  fregat: { name: 'РБ «Фрегат» (НДМГ+АТ)', dryKg: 1050, fuelKg: 3200, isp: 333 },
  kvtk: { name: 'Криогенный РБ КВТК (H₂+O₂)', dryKg: 3200, fuelKg: 14500, isp: 463 },
  deorbit_sat: { name: 'Отработавший КА ДЗЗ (увод)', dryKg: 280, fuelKg: 18, isp: 290 },
  ion: { name: 'Спутник связи (СПД-100 Xe)', dryKg: 1200, fuelKg: 260, isp: 1600 }
};

const GROUND_STATIONS = [
  { name: 'Красноярск (СибГУ / Железногорск)', lat: 56.01, lon: 92.87 },
  { name: 'ЦУП Королёв (Москва)', lat: 55.92, lon: 37.82 },
  { name: 'Космодром Восточный', lat: 51.88, lon: 128.33 }
];

export class OrbitLab {
  constructor(shell) {
    this.shell = shell;
    this.viewMode = 'orbit'; // 'orbit' | 'map'
    this.running = true;
    this.timeWarp = 50;
    this.zoomScale = 1.0; // Multiplier on auto-fit

    this.cfg = {
      spacecraft: 'soyuz',
      initAltKm: 220,
      inclinationDeg: 51.6,
      targetAltKm: 420,
      dvPrograde: 63,
      dvRadial: 0
    };

    this.resetOrbit();
  }

  resetOrbit() {
    const sc = SPACECRAFTS[this.cfg.spacecraft] || SPACECRAFTS.soyuz;
    const r0 = R_EARTH + this.cfg.initAltKm;
    const v0 = Math.sqrt(MU / r0);

    this.state = {
      simTime: 0,
      x: r0,
      y: 0,
      vx: 0,
      vy: v0,
      dryKg: sc.dryKg,
      fuelKg: sc.fuelKg,
      isp: sc.isp,
      hp: this.cfg.initAltKm,
      ha: this.cfg.initAltKm,
      ecc: 0,
      sma: r0,
      periodMin: (2 * Math.PI * Math.sqrt((r0 ** 3) / MU)) / 60,
      altKm: this.cfg.initAltKm,
      speedKmS: v0,
      remDvMs: sc.isp * G0 * Math.log((sc.dryKg + sc.fuelKg) / sc.dryKg),
      radDose: 0,
      crashed: false,
      crashReason: '',
      burnFlash: 0,
      trail: [],
      groundTrack: []
    };
    this.sampleCounter = 0;
    if (this.scope) this.scope.clear();
  }

  computeOrbitalElements(x, y, vx, vy) {
    const r = Math.hypot(x, y);
    const v2 = vx * vx + vy * vy;
    const v = Math.sqrt(v2);
    const energy = v2 / 2 - MU / r;
    const h = x * vy - y * vx; // specific angular momentum

    // Eccentricity vector
    const ex = (vy * h) / MU - x / r;
    const ey = (-vx * h) / MU - y / r;
    const ecc = Math.hypot(ex, ey);

    let sma = Infinity;
    let rp = r;
    let ra = r;
    let periodMin = Infinity;

    if (energy < -1e-6) {
      sma = -MU / (2 * energy);
      rp = sma * (1 - ecc);
      ra = sma * (1 + ecc);
      periodMin = (2 * Math.PI * Math.sqrt((sma ** 3) / MU)) / 60;
    } else {
      rp = (h * h / MU) / (1 + ecc);
      ra = 999999;
    }

    return {
      r,
      v,
      sma,
      ecc,
      hp: rp - R_EARTH,
      ha: ra - R_EARTH,
      periodMin,
      periAngle: Math.atan2(ey, ex)
    };
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

  renderLeft(el) {
    el.innerHTML = `
      <div class="panel-section">
        <div class="section-header">
          <span class="section-title">Космический аппарат и орбита</span>
        </div>

        <div class="control-row">
          <label class="control-label"><span>Аппарат / Разгонный блок</span></label>
          <select id="orb-sc-select">
            ${Object.entries(SPACECRAFTS)
              .map(([k, v]) => `<option value="${k}" ${this.cfg.spacecraft === k ? 'selected' : ''}>${v.name}</option>`)
              .join('')}
          </select>
        </div>

        <div class="control-row">
          <label class="control-label">
            <span>Начальная высота h₀</span>
            <span class="control-val" id="orb-h0-lbl">${this.cfg.initAltKm} км</span>
          </label>
          <input type="range" id="orb-h0" min="160" max="2000" step="10" value="${this.cfg.initAltKm}">
        </div>

        <div class="control-row">
          <label class="control-label"><span>Космодром (наклонение i)</span></label>
          <select id="orb-inc-select">
            <option value="51.6" ${this.cfg.inclinationDeg === 51.6 ? 'selected' : ''}>Байконур / Восточный (51.6°)</option>
            <option value="62.8" ${this.cfg.inclinationDeg === 62.8 ? 'selected' : ''}>Плесецк (62.8°)</option>
            <option value="97.6" ${this.cfg.inclinationDeg === 97.6 ? 'selected' : ''}>Солнечно-синхронная ССО (97.6°)</option>
            <option value="0" ${this.cfg.inclinationDeg === 0 ? 'selected' : ''}>Экваториальная / ГСО (0°)</option>
          </select>
        </div>

        <div class="control-row">
          <label class="control-label">
            <span>Целевая орбита (пунктир)</span>
            <span class="control-val" id="orb-tgt-lbl">${this.cfg.targetAltKm} км</span>
          </label>
          <input type="number" id="orb-tgt-input" min="80" max="42000" step="10" value="${this.cfg.targetAltKm}">
        </div>

        <button class="btn btn-sm" id="orb-relaunch" style="width:100%; margin-top:4px;">
          🚀 Вывести заново на h₀
        </button>
      </div>

      <div class="panel-section">
        <div class="section-header">
          <span class="section-title">Планировщик манёвра (Δv)</span>
        </div>

        <div class="control-row">
          <label class="control-label">
            <span>Продольный импульс Δvτ (м/с)</span>
            <span class="control-val" id="orb-dvp-lbl">${this.cfg.dvPrograde} м/с</span>
          </label>
          <input type="range" id="orb-dvp-range" min="-600" max="2600" step="1" value="${Math.max(-600, Math.min(2600, this.cfg.dvPrograde))}">
          <input type="number" id="orb-dvp-num" step="1" value="${this.cfg.dvPrograde}" style="margin-top:4px;">
        </div>

        <div class="control-row">
          <label class="control-label">
            <span>Радиальный импульс Δvₙ (м/с)</span>
            <span class="control-val" id="orb-dvr-lbl">${this.cfg.dvRadial} м/с</span>
          </label>
          <input type="range" id="orb-dvr-range" min="-300" max="300" step="1" value="${this.cfg.dvRadial}">
        </div>

        <button class="btn btn-primary" id="orb-fire-btn" style="width:100%; margin-top:6px;">
          🔥 Включить маршевый двигатель
        </button>

        <div style="display:flex; gap:6px; margin-top:6px;">
          <button class="btn btn-sm" id="orb-calc-hoh1" style="flex:1;" title="Подставить 1-й импульс Гомана до целевой орбиты">
            Расчёт Δv₁
          </button>
          <button class="btn btn-sm" id="orb-calc-circ" style="flex:1;" title="Подставить импульс скругления в текущей точке">
            Скруглить
          </button>
        </div>
      </div>
    `;

    el.querySelector('#orb-sc-select').addEventListener('change', (e) => {
      this.cfg.spacecraft = e.target.value;
      this.resetOrbit();
    });

    const h0 = el.querySelector('#orb-h0');
    h0.addEventListener('input', () => {
      this.cfg.initAltKm = Number(h0.value);
      el.querySelector('#orb-h0-lbl').textContent = `${this.cfg.initAltKm} км`;
    });
    h0.addEventListener('change', () => this.resetOrbit());

    el.querySelector('#orb-inc-select').addEventListener('change', (e) => {
      this.cfg.inclinationDeg = Number(e.target.value);
      this.state.groundTrack = [];
    });

    const tgtInp = el.querySelector('#orb-tgt-input');
    tgtInp.addEventListener('input', () => {
      this.cfg.targetAltKm = Math.max(80, Number(tgtInp.value) || 400);
      el.querySelector('#orb-tgt-lbl').textContent = `${this.cfg.targetAltKm} км`;
    });

    el.querySelector('#orb-relaunch').addEventListener('click', () => this.resetOrbit());

    const dvpRange = el.querySelector('#orb-dvp-range');
    const dvpNum = el.querySelector('#orb-dvp-num');
    const syncDvp = (val) => {
      this.cfg.dvPrograde = Number(val) || 0;
      dvpRange.value = Math.max(-600, Math.min(2600, this.cfg.dvPrograde));
      dvpNum.value = this.cfg.dvPrograde;
      el.querySelector('#orb-dvp-lbl').textContent = `${this.cfg.dvPrograde >= 0 ? '+' : ''}${this.cfg.dvPrograde} м/с`;
    };
    dvpRange.addEventListener('input', () => syncDvp(dvpRange.value));
    dvpNum.addEventListener('input', () => syncDvp(dvpNum.value));

    const dvrRange = el.querySelector('#orb-dvr-range');
    dvrRange.addEventListener('input', () => {
      this.cfg.dvRadial = Number(dvrRange.value) || 0;
      el.querySelector('#orb-dvr-lbl').textContent = `${this.cfg.dvRadial >= 0 ? '+' : ''}${this.cfg.dvRadial} м/с`;
    });

    el.querySelector('#orb-fire-btn').addEventListener('click', () => this.executeBurn());

    el.querySelector('#orb-calc-hoh1').addEventListener('click', () => {
      const r1 = Math.hypot(this.state.x, this.state.y);
      const r2 = R_EARTH + this.cfg.targetAltKm;
      const a = (r1 + r2) / 2;
      const vNeed = Math.sqrt(MU * (2 / r1 - 1 / a));
      const vCur = Math.hypot(this.state.vx, this.state.vy);
      syncDvp(Math.round((vNeed - vCur) * 1000));
    });

    el.querySelector('#orb-calc-circ').addEventListener('click', () => {
      const r = Math.hypot(this.state.x, this.state.y);
      const vCirc = Math.sqrt(MU / r);
      const vCur = Math.hypot(this.state.vx, this.state.vy);
      syncDvp(Math.round((vCirc - vCur) * 1000));
      this.cfg.dvRadial = 0;
      dvrRange.value = 0;
      el.querySelector('#orb-dvr-lbl').textContent = '0 м/с';
    });
  }

  executeBurn() {
    const s = this.state;
    if (s.crashed) return;

    const dvTotalMs = Math.hypot(this.cfg.dvPrograde, this.cfg.dvRadial);
    if (dvTotalMs < 0.1) return;

    if (dvTotalMs > s.remDvMs + 0.5) {
      this.shell.toast(`Недостаточно топлива! Доступно ${s.remDvMs.toFixed(0)} м/с, требуется ${dvTotalMs.toFixed(0)} м/с.`, 'warn');
      return;
    }

    // Consume propellant via inverse Tsiolkovsky equation
    const m0 = s.dryKg + s.fuelKg;
    const m1 = m0 / Math.exp(dvTotalMs / (s.isp * G0));
    s.fuelKg = Math.max(0, m1 - s.dryKg);
    s.remDvMs = s.isp * G0 * Math.log((s.dryKg + s.fuelKg) / s.dryKg);

    // Apply velocity impulse along tangent & radial unit vectors
    const v = Math.hypot(s.vx, s.vy) || 1e-6;
    const tx = s.vx / v;
    const ty = s.vy / v;
    const r = Math.hypot(s.x, s.y) || 1;
    const rx = s.x / r;
    const ry = s.y / r;

    s.vx += tx * (this.cfg.dvPrograde / 1000) + rx * (this.cfg.dvRadial / 1000);
    s.vy += ty * (this.cfg.dvPrograde / 1000) + ry * (this.cfg.dvRadial / 1000);
    s.burnFlash = 1.0;

    const el = this.computeOrbitalElements(s.x, s.y, s.vx, s.vy);
    Object.assign(s, {
      hp: el.hp,
      ha: el.ha,
      ecc: el.ecc,
      sma: el.sma,
      periodMin: el.periodMin,
      altKm: el.r - R_EARTH,
      speedKmS: el.v
    });
  }

  renderCenter(el) {
    el.innerHTML = `
      <div class="bench-toolbar">
        <div class="segmented">
          <button class="seg-btn ${this.viewMode === 'orbit' ? 'active' : ''}" data-view="orbit">Орбитальный стол</button>
          <button class="seg-btn ${this.viewMode === 'map' ? 'active' : ''}" data-view="map">Трасса полёта (ЦУП)</button>
        </div>

        <div class="time-controls">
          <button class="btn btn-sm ${this.running ? 'btn-amber' : 'btn-success'}" id="orb-run-btn">
            ${this.running ? '⏸' : '▶'}
          </button>
          <div class="segmented">
            ${[1, 10, 50, 200, 1000]
              .map((w) => `<button class="seg-btn ${this.timeWarp === w ? 'active' : ''}" data-warp="${w}">×${w}</button>`)
              .join('')}
          </div>
          <span class="sim-clock" id="orb-clock">00:00</span>
        </div>
      </div>

      <div class="canvas-stage">
        <canvas id="orb-canvas"></canvas>
        <div class="canvas-hud" id="orb-hud"></div>
        <div class="canvas-bottom-bar">
          <div class="hud-chip" style="font-size:11px;">Колёсико мыши — масштаб орбиты</div>
          <button class="btn btn-sm" id="orb-zoom-reset">Автомасштаб</button>
        </div>
      </div>
    `;

    this.canvas = el.querySelector('#orb-canvas');
    this.hudEl = el.querySelector('#orb-hud');
    this.clockEl = el.querySelector('#orb-clock');

    el.querySelectorAll('[data-view]').forEach((b) => {
      b.addEventListener('click', () => {
        this.viewMode = b.dataset.view;
        el.querySelectorAll('[data-view]').forEach((x) => x.classList.toggle('active', x === b));
      });
    });

    el.querySelector('#orb-run-btn').addEventListener('click', (e) => {
      this.running = !this.running;
      e.currentTarget.textContent = this.running ? '⏸' : '▶';
      e.currentTarget.className = `btn btn-sm ${this.running ? 'btn-amber' : 'btn-success'}`;
    });

    el.querySelectorAll('[data-warp]').forEach((b) => {
      b.addEventListener('click', () => {
        this.timeWarp = Number(b.dataset.warp);
        el.querySelectorAll('[data-warp]').forEach((x) => x.classList.toggle('active', x === b));
      });
    });

    el.querySelector('#orb-zoom-reset').addEventListener('click', () => {
      this.zoomScale = 1.0;
    });

    this.canvas.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        const factor = e.deltaY > 0 ? 1.15 : 0.87;
        this.zoomScale = Math.max(0.18, Math.min(6.0, this.zoomScale * factor));
      },
      { passive: false }
    );
  }

  renderRight(el) {
    el.innerHTML = `
      <div class="panel-section">
        <div class="section-header">
          <span class="section-title">Параметры орбиты (Кеплер)</span>
        </div>
        <div class="telemetry-grid">
          <div class="telemetry-card">
            <span class="telemetry-label">Перигей hₚ</span>
            <span class="telemetry-value cyan" id="orb-t-hp">220 км</span>
          </div>
          <div class="telemetry-card">
            <span class="telemetry-label">Апогей hₐ</span>
            <span class="telemetry-value cyan" id="orb-t-ha">220 км</span>
          </div>
          <div class="telemetry-card">
            <span class="telemetry-label">Текущая высота</span>
            <span class="telemetry-value" id="orb-t-alt">220 км</span>
          </div>
          <div class="telemetry-card">
            <span class="telemetry-label">Скорость КА</span>
            <span class="telemetry-value amber" id="orb-t-vel">7.77 км/с</span>
          </div>
          <div class="telemetry-card">
            <span class="telemetry-label">Эксцентриситет / T</span>
            <span class="telemetry-value" id="orb-t-ecc">0.000 · 89 м</span>
          </div>
          <div class="telemetry-card">
            <span class="telemetry-label">Топливо / Запас Δv</span>
            <span class="telemetry-value green" id="orb-t-fuel">850 кг</span>
          </div>
        </div>
      </div>

      <div class="panel-section">
        <div class="section-header">
          <span class="section-title">Осциллограф баллистики</span>
        </div>
        <div id="orb-scope-root"></div>
      </div>

      <div class="panel-section">
        <div class="section-header">
          <span class="section-title">Проверка расчёта ученика</span>
        </div>
        <p style="font-size:11.5px; color:var(--text-1); margin-bottom:8px;">
          Рассчитайте 1-й импульс Гомана <strong>Δv₁ (м/с)</strong> с начальной круговой орбиты h₀ до целевой орбиты:
        </p>
        <div style="display:flex; gap:6px;">
          <input type="number" id="orb-quiz-ans" placeholder="Ответ в м/с (напр. 63)">
          <button class="btn btn-primary" id="orb-quiz-btn">Проверить</button>
        </div>
        <div id="orb-quiz-res" style="margin-top:7px; font-size:11.5px;"></div>
      </div>
    `;

    this.scope = new TelemetryScope(
      el.querySelector('#orb-scope-root'),
      [
        { key: 'alt', label: 'Высота', unit: ' км', color: '#38bdf8', min: 0, max: 38000 },
        { key: 'vel', label: 'Скорость', unit: ' км/с', color: '#f59e0b', min: 1, max: 11 },
        { key: 'dv', label: 'Запас Δv', unit: ' м/с', color: '#22c55e', min: 0, max: 4500 }
      ],
      { height: 135 }
    );

    el.querySelector('#orb-quiz-btn').addEventListener('click', () => {
      const userVal = Number(el.querySelector('#orb-quiz-ans').value);
      const r1 = R_EARTH + this.cfg.initAltKm;
      const r2 = R_EARTH + this.cfg.targetAltKm;
      const a = (r1 + r2) / 2;
      const exact = Math.abs(Math.sqrt(MU * (2 / r1 - 1 / a)) - Math.sqrt(MU / r1)) * 1000;
      const resEl = el.querySelector('#orb-quiz-res');
      if (!Number.isFinite(userVal) || el.querySelector('#orb-quiz-ans').value === '') {
        resEl.innerHTML = `<span style="color:var(--amber);">Введите числовое значение в м/с.</span>`;
        return;
      }
      const diffPct = Math.abs(userVal - exact) / Math.max(1, exact);
      if (diffPct <= 0.04 || Math.abs(userVal - exact) <= 3) {
        resEl.innerHTML = `<span style="color:var(--green); font-weight:600;">✓ Верно! Точное значение Δv₁ = ${exact.toFixed(1)} м/с.</span>`;
      } else {
        resEl.innerHTML = `<span style="color:var(--red);">✗ Пока не сходится. Подсказка: r₁=${r1} км, a=${a.toFixed(0)} км (ожидается ~${exact.toFixed(0)} м/с).</span>`;
      }
    });
  }

  accel(x, y, vx, vy) {
    const r2 = x * x + y * y;
    const r = Math.sqrt(r2);
    const g = -MU / (r2 * r);
    let ax = g * x;
    let ay = g * y;

    // Atmospheric drag below 150 km
    const alt = r - R_EARTH;
    if (alt < 150 && alt > 0) {
      const v = Math.hypot(vx, vy) || 1e-6;
      const rhoRel = Math.exp(-(alt - 95) / 14);
      const drag = -0.00022 * rhoRel * v;
      ax += drag * vx;
      ay += drag * vy;
    }
    return [ax, ay];
  }

  rk4Step(dt) {
    const s = this.state;
    const [ax1, ay1] = this.accel(s.x, s.y, s.vx, s.vy);

    const x2 = s.x + 0.5 * dt * s.vx;
    const y2 = s.y + 0.5 * dt * s.vy;
    const vx2 = s.vx + 0.5 * dt * ax1;
    const vy2 = s.vy + 0.5 * dt * ay1;
    const [ax2, ay2] = this.accel(x2, y2, vx2, vy2);

    const x3 = s.x + 0.5 * dt * vx2;
    const y3 = s.y + 0.5 * dt * vy2;
    const vx3 = s.vx + 0.5 * dt * ax2;
    const vy3 = s.vy + 0.5 * dt * ay2;
    const [ax3, ay3] = this.accel(x3, y3, vx3, vy3);

    const x4 = s.x + dt * vx3;
    const y4 = s.y + dt * vy3;
    const vx4 = s.vx + dt * ax3;
    const vy4 = s.vy + dt * ay3;
    const [ax4, ay4] = this.accel(x4, y4, vx4, vy4);

    s.x += (dt / 6) * (s.vx + 2 * vx2 + 2 * vx3 + vx4);
    s.y += (dt / 6) * (s.vy + 2 * vy2 + 2 * vy3 + vy4);
    s.vx += (dt / 6) * (ax1 + 2 * ax2 + 2 * ax3 + ax4);
    s.vy += (dt / 6) * (ay1 + 2 * ay2 + 2 * ay3 + ay4);
    s.simTime += dt;
  }

  step(dtReal) {
    if (!this.containers) return;
    const s = this.state;

    if (this.running && !s.crashed) {
      const totalSimDt = dtReal * this.timeWarp;
      const maxSubDt = 5.0; // max 5 seconds per RK4 step for crisp accuracy even at 1000x
      const steps = Math.max(1, Math.ceil(totalSimDt / maxSubDt));
      const subDt = totalSimDt / steps;

      for (let i = 0; i < steps; i++) {
        this.rk4Step(subDt);
        const r = Math.hypot(s.x, s.y);
        const alt = r - R_EARTH;
        if (alt <= 82) {
          s.crashed = true;
          s.crashReason = 'burnup';
          s.altKm = Math.max(0, alt);
          break;
        }
        // Radiation belt dose
        if ((alt > 2000 && alt < 6000) || (alt > 13000 && alt < 25000)) {
          s.radDose += 0.015 * subDt;
        }
      }

      const el = this.computeOrbitalElements(s.x, s.y, s.vx, s.vy);
      s.hp = el.hp;
      s.ha = el.ha;
      s.ecc = el.ecc;
      s.sma = el.sma;
      s.periodMin = el.periodMin;
      s.altKm = el.r - R_EARTH;
      s.speedKmS = el.v;

      // Record trail & ground track
      this.sampleCounter += 1;
      if (this.sampleCounter % 2 === 0) {
        s.trail.push({ x: s.x, y: s.y });
        if (s.trail.length > 360) s.trail.shift();

        // Ground track projection
        const orbAngle = Math.atan2(s.y, s.x);
        const incRad = (this.cfg.inclinationDeg * Math.PI) / 180;
        const lat = (Math.asin(Math.sin(incRad) * Math.sin(orbAngle)) * 180) / Math.PI;
        const rawLon = (Math.atan2(Math.cos(incRad) * Math.sin(orbAngle), Math.cos(orbAngle)) * 180) / Math.PI;
        const lon = ((((rawLon - s.simTime * EARTH_ROT_DEG_PER_SEC + 70) + 180) % 360) + 360) % 360 - 180;
        s.groundTrack.push({ lat, lon });
        if (s.groundTrack.length > 420) s.groundTrack.shift();
      }

      if (this.sampleCounter % 4 === 0 && this.scope) {
        this.scope.push({ alt: Math.min(38000, s.altKm), vel: s.speedKmS, dv: s.remDvMs });
      }
    }

    if (s.burnFlash > 0) s.burnFlash = Math.max(0, s.burnFlash - dtReal * 2.2);

    this.drawCanvas();
    this.updateDOM();
  }

  updateDOM() {
    if (!this.containers) return;
    const s = this.state;
    const r = this.containers.right;

    const mins = Math.floor(s.simTime / 60);
    const hrs = Math.floor(mins / 60);
    if (this.clockEl) {
      this.clockEl.textContent = `${String(hrs).padStart(2, '0')}ч ${String(mins % 60).padStart(2, '0')}м`;
    }

    r.querySelector('#orb-t-hp').textContent = `${s.hp.toFixed(0)} км`;
    r.querySelector('#orb-t-ha').textContent = s.ha > 300000 ? 'Гипербола ∞' : `${s.ha.toFixed(0)} км`;
    r.querySelector('#orb-t-alt').textContent = `${s.altKm.toFixed(0)} км`;
    r.querySelector('#orb-t-vel').textContent = `${s.speedKmS.toFixed(2)} км/с`;
    r.querySelector('#orb-t-ecc').textContent =
      `${s.ecc.toFixed(3)} · ${Number.isFinite(s.periodMin) ? s.periodMin.toFixed(0) + ' м' : '∞'}`;
    r.querySelector('#orb-t-fuel').textContent = `${s.fuelKg.toFixed(0)} кг (${s.remDvMs.toFixed(0)} м/с)`;

    if (this.hudEl) {
      const chips = [];
      if (s.crashed) {
        chips.push(`<div class="hud-chip danger">🔥 Вход в плотные слои атмосферы (< 85 км) — аппарат разрушен плазмой!</div>`);
      } else if (s.altKm < 125) {
        chips.push(`<div class="hud-chip warn">⚠ Аэродинамическое торможение в термосфере!</div>`);
      } else if (s.ecc >= 1.0) {
        chips.push(`<div class="hud-chip warn">🚀 Достигнута вторая космическая скорость — уход от Земли!</div>`);
      } else {
        chips.push(`<div class="hud-chip ok">● Пунктир — прогноз орбиты после импульса Δv · Зелёное кольцо — цель</div>`);
      }
      if (s.radDose > 20) {
        chips.push(`<div class="hud-chip warn">☢ Радиационные пояса Ван Аллена: накоплено ${s.radDose.toFixed(0)} рад</div>`);
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

    if (this.viewMode === 'map') {
      this.drawGroundTrackMap(ctx, w, h);
    } else {
      this.drawOrbitView(ctx, w, h);
    }

    ctx.restore();
  }

  drawOrbitView(ctx, w, h) {
    const s = this.state;
    ctx.fillStyle = '#060a14';
    ctx.fillRect(0, 0, w, h);

    // Subtle stars
    ctx.fillStyle = 'rgba(203, 213, 225, 0.35)';
    for (let i = 0; i < 45; i++) {
      const sx = ((i * 173) % w);
      const sy = ((i * 293) % h);
      ctx.fillRect(sx, sy, 1.4, 1.4);
    }

    const cx = w / 2;
    const cy = h / 2;

    // Auto-fit scale based on max(current apogee, target orbit)
    const maxR = Math.max(
      R_EARTH + 1400,
      Math.min(60000, R_EARTH + Math.max(this.cfg.targetAltKm, Math.min(45000, s.ha || 400)))
    );
    const pxPerKm = ((Math.min(w, h) * 0.41) / maxR) * this.zoomScale;

    // Van Allen belts (subtle)
    const drawBelt = (rInKm, rOutKm, color) => {
      const rIn = (R_EARTH + rInKm) * pxPerKm;
      const rOut = (R_EARTH + rOutKm) * pxPerKm;
      if (rOut < 25 || rIn > Math.max(w, h)) return;
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(2, rOut - rIn);
      ctx.beginPath();
      ctx.arc(cx, cy, (rIn + rOut) / 2, 0, Math.PI * 2);
      ctx.stroke();
    };
    drawBelt(2200, 5800, 'rgba(239, 68, 68, 0.06)');
    drawBelt(13500, 24000, 'rgba(167, 139, 250, 0.05)');

    // Target circular orbit
    const rTgtPx = (R_EARTH + this.cfg.targetAltKm) * pxPerKm;
    ctx.strokeStyle = 'rgba(34, 197, 94, 0.55)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 5]);
    ctx.beginPath();
    ctx.arc(cx, cy, rTgtPx, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Planned maneuver preview conic (if dv != 0)
    if (!s.crashed && (Math.abs(this.cfg.dvPrograde) > 0.5 || Math.abs(this.cfg.dvRadial) > 0.5)) {
      const v = Math.hypot(s.vx, s.vy) || 1e-6;
      const r = Math.hypot(s.x, s.y) || 1;
      const pvx = s.vx + (s.vx / v) * (this.cfg.dvPrograde / 1000) + (s.x / r) * (this.cfg.dvRadial / 1000);
      const pvy = s.vy + (s.vy / v) * (this.cfg.dvPrograde / 1000) + (s.y / r) * (this.cfg.dvRadial / 1000);
      const pel = this.computeOrbitalElements(s.x, s.y, pvx, pvy);

      if (pel.ecc < 0.99 && Number.isFinite(pel.sma)) {
        ctx.strokeStyle = 'rgba(251, 191, 36, 0.65)';
        ctx.lineWidth = 1.4;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        const pSemiLatus = pel.sma * (1 - pel.ecc * pel.ecc);
        for (let i = 0; i <= 120; i++) {
          const nu = (i / 120) * Math.PI * 2;
          const rad = pSemiLatus / (1 + pel.ecc * Math.cos(nu));
          const ang = nu + pel.periAngle;
          const px = cx + Math.cos(ang) * rad * pxPerKm;
          const py = cy - Math.sin(ang) * rad * pxPerKm;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // Current analytical orbit curve
    if (!s.crashed && s.ecc < 0.99 && Number.isFinite(s.sma)) {
      const el = this.computeOrbitalElements(s.x, s.y, s.vx, s.vy);
      const pSemiLatus = el.sma * (1 - el.ecc * el.ecc);
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.78)';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      for (let i = 0; i <= 140; i++) {
        const nu = (i / 140) * Math.PI * 2;
        const rad = pSemiLatus / (1 + el.ecc * Math.cos(nu));
        const ang = nu + el.periAngle;
        const px = cx + Math.cos(ang) * rad * pxPerKm;
        const py = cy - Math.sin(ang) * rad * pxPerKm;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();

      // Perigee & Apogee badges
      const periPxX = cx + Math.cos(el.periAngle) * (R_EARTH + el.hp) * pxPerKm;
      const periPxY = cy - Math.sin(el.periAngle) * (R_EARTH + el.hp) * pxPerKm;
      const apoPxX = cx - Math.cos(el.periAngle) * (R_EARTH + el.ha) * pxPerKm;
      const apoPxY = cy + Math.sin(el.periAngle) * (R_EARTH + el.ha) * pxPerKm;

      ctx.font = 'bold 10px ui-monospace, monospace';
      ctx.fillStyle = '#38bdf8';
      ctx.fillText('П', periPxX + 6, periPxY - 6);
      if (el.ha < 150000) ctx.fillText('А', apoPxX + 6, apoPxY - 6);
    }

    // Earth Atmosphere & Globe
    const earthPx = Math.max(10, R_EARTH * pxPerKm);
    const atmGrad = ctx.createRadialGradient(cx, cy, earthPx * 0.96, cx, cy, earthPx * 1.08);
    atmGrad.addColorStop(0, 'rgba(56, 189, 248, 0.45)');
    atmGrad.addColorStop(1, 'rgba(56, 189, 248, 0)');
    ctx.fillStyle = atmGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, earthPx * 1.08, 0, Math.PI * 2);
    ctx.fill();

    const earthGrad = ctx.createRadialGradient(cx - earthPx * 0.3, cy - earthPx * 0.3, earthPx * 0.1, cx, cy, earthPx);
    earthGrad.addColorStop(0, '#2563eb');
    earthGrad.addColorStop(0.65, '#1d4ed8');
    earthGrad.addColorStop(1, '#0f172a');
    ctx.fillStyle = earthGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, earthPx, 0, Math.PI * 2);
    ctx.fill();

    // Spacecraft Marker
    const sx = cx + s.x * pxPerKm;
    const sy = cy - s.y * pxPerKm;

    if (s.burnFlash > 0 || s.altKm < 115) {
      ctx.fillStyle = s.altKm < 115 ? 'rgba(239, 68, 68, 0.65)' : `rgba(251, 191, 36, ${s.burnFlash})`;
      ctx.beginPath();
      ctx.arc(sx, sy, 12, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = s.crashed ? '#ef4444' : '#ffffff';
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(sx, sy, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  drawGroundTrackMap(ctx, w, h) {
    ctx.fillStyle = '#081224';
    ctx.fillRect(0, 0, w, h);

    const pad = 28;
    const mw = w - pad * 2;
    const mh = h - pad * 2;

    const toXY = (lat, lon) => ({
      x: pad + ((lon + 180) / 360) * mw,
      y: pad + ((90 - lat) / 180) * mh
    });

    // Grid
    ctx.strokeStyle = 'rgba(54, 78, 122, 0.35)';
    ctx.lineWidth = 1;
    ctx.strokeRect(pad, pad, mw, mh);
    for (let lon = -120; lon <= 120; lon += 60) {
      const p = toXY(0, lon);
      ctx.beginPath(); ctx.moveTo(p.x, pad); ctx.lineTo(p.x, pad + mh); ctx.stroke();
    }
    for (let lat = -60; lat <= 60; lat += 30) {
      const p = toXY(lat, 0);
      ctx.beginPath(); ctx.moveTo(pad, p.y); ctx.lineTo(pad + mw, p.y); ctx.stroke();
    }

    // Simplified Eurasia / Continents polygons for visual orientation
    ctx.fillStyle = 'rgba(30, 58, 95, 0.65)';
    const eurasia = [
      [36, -9], [55, 10], [70, 30], [73, 85], [70, 140], [62, 175],
      [45, 142], [23, 115], [10, 102], [24, 68], [30, 35], [36, -9]
    ];
    ctx.beginPath();
    eurasia.forEach(([lat, lon], idx) => {
      const p = toXY(lat, lon);
      if (idx === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.fill();

    // Ground stations (Krasnoyarsk, Korolev, Vostochny) + visibility circles
    GROUND_STATIONS.forEach((gs) => {
      const p = toXY(gs.lat, gs.lon);
      const visRadiusPx = Math.min(95, Math.max(22, Math.sqrt(Math.max(100, this.state.altKm)) * 1.4));
      ctx.strokeStyle = 'rgba(34, 197, 94, 0.4)';
      ctx.fillStyle = 'rgba(34, 197, 94, 0.08)';
      ctx.beginPath();
      ctx.arc(p.x, p.y, visRadiusPx, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#4ade80';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = '10.5px sans-serif';
      ctx.fillText(gs.name.split(' ')[0], p.x + 7, p.y + 3);
    });

    // Ground track points
    const gt = this.state.groundTrack;
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < gt.length; i++) {
      const p = toXY(gt[i].lat, gt[i].lon);
      if (i === 0 || Math.abs(gt[i].lon - gt[i - 1].lon) > 120) {
        ctx.moveTo(p.x, p.y);
      } else {
        ctx.lineTo(p.x, p.y);
      }
    }
    ctx.stroke();

    if (gt.length > 0) {
      const cur = toXY(gt[gt.length - 1].lat, gt[gt.length - 1].lon);
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.arc(cur.x, cur.y, 5.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  applyPreset(p) {
    if (!p) return;
    if (p.spacecraft) this.cfg.spacecraft = p.spacecraft;
    if (typeof p.altKm === 'number') this.cfg.initAltKm = p.altKm;
    if (typeof p.targetAltKm === 'number') this.cfg.targetAltKm = p.targetAltKm;
    this.zoomScale = 1.0;
    this.resetOrbit();
    this.running = true;
    if (this.containers) this.mount(this.containers);
  }

  getStateForMission() {
    return { ...this.state };
  }

  exportState() {
    return { cfg: { ...this.cfg }, state: { ...this.state, trail: [], groundTrack: [] } };
  }

  importState(data) {
    if (!data) return;
    if (data.cfg) Object.assign(this.cfg, data.cfg);
    this.resetOrbit();
    if (data.state) Object.assign(this.state, data.state);
    if (this.containers) this.mount(this.containers);
  }
}
