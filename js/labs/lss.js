import { TelemetryScope } from '../ui/scope.js';

export class LssLab {
  constructor(shell) {
    this.shell = shell;
    this.running = true;
    this.speedMinPerSec = 4; // 4 simulated minutes per real second

    this.ctrl = {
      crew: 3,
      activity: 'normal', // 'rest' | 'normal' | 'work'
      elektronRate: 50,   // 0..100% (2H2O -> 2H2 + O2)
      vozdukhRate: 55,    // 0..100% (CO2 adsorption)
      liohCartridges: false, // 2LiOH + CO2 -> Li2CO3 + H2O
      sabatierRate: 50,   // 0..100% (CO2 + 4H2 -> CH4 + 2H2O)
      radiatorPct: 60     // 0..100% external heat rejection
    };

    this.resetStation();
  }

  resetStation() {
    this.state = {
      simMinutes: 0,
      pO2: 159.0,         // mmHg (norm 145..175)
      pCO2: 2.1,          // mmHg (norm < 3.5, danger > 6.5)
      h2Pct: 0.08,        // % vol (danger > 1.5%, LEL 4.0%)
      waterLiters: 42.0,  // reserve water tank
      cabinTempC: 21.8,   // norm 19..25 °C
      inSunlight: true,
      crewAlive: true,
      alertReason: '',
      thermalStableMinutes: 0,
      liohLeftPct: 100
    };
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

  renderLeft(el) {
    const c = this.ctrl;
    el.innerHTML = `
      <div class="panel-section">
        <div class="section-header">
          <span class="section-title">Экипаж орбитальной станции</span>
        </div>

        <div class="control-row">
          <label class="control-label">
            <span>Численность экипажа</span>
            <span class="control-val" id="lss-crew-lbl">${c.crew} чел.</span>
          </label>
          <input type="range" id="lss-crew" min="1" max="6" step="1" value="${c.crew}">
        </div>

        <div class="control-row">
          <label class="control-label"><span>Нагрузка космонавтов</span></label>
          <select id="lss-act">
            <option value="rest" ${c.activity === 'rest' ? 'selected' : ''}>Сон / Отдых (низкое потребление O₂)</option>
            <option value="normal" ${c.activity === 'normal' ? 'selected' : ''}>Штатная работа в модуле</option>
            <option value="work" ${c.activity === 'work' ? 'selected' : ''}>Велоэргометр / ВКД (×1.6 CO₂ и тепло)</option>
          </select>
        </div>
      </div>

      <div class="panel-section">
        <div class="section-header">
          <span class="section-title">Химические агрегаты СЖО</span>
        </div>

        <div class="control-row">
          <label class="control-label">
            <span>Электролиз «Электрон-ВМ»</span>
            <span class="control-val" id="lss-el-lbl">${c.elektronRate}%</span>
          </label>
          <input type="range" id="lss-el" min="0" max="100" value="${c.elektronRate}">
          <span style="font-size:10.5px; color:var(--text-2); font-family:var(--font-mono);">2H₂O → 2H₂↑ + O₂↑</span>
        </div>

        <div class="control-row">
          <label class="control-label">
            <span>Цеолитовый адсорбер «Воздух»</span>
            <span class="control-val" id="lss-voz-lbl">${c.vozdukhRate}%</span>
          </label>
          <input type="range" id="lss-voz" min="0" max="100" value="${c.vozdukhRate}">
        </div>

        <div class="control-row">
          <label class="control-label">
            <span>Реактор Сабатье (350 °C, Ru)</span>
            <span class="control-val" id="lss-sab-lbl">${c.sabatierRate}%</span>
          </label>
          <input type="range" id="lss-sab" min="0" max="100" value="${c.sabatierRate}">
          <span style="font-size:10.5px; color:var(--text-2); font-family:var(--font-mono);">CO₂ + 4H₂ → CH₄↑ + 2H₂O</span>
        </div>

        <label style="display:flex; align-items:center; gap:8px; margin:8px 0; cursor:pointer; font-size:12px;">
          <input type="checkbox" id="lss-lioh" ${c.liohCartridges ? 'checked' : ''}>
          <span>Аварийные патроны <strong>LiOH</strong> (<span id="lss-lioh-pct">${this.state.liohLeftPct.toFixed(0)}</span>%)</span>
        </label>

        <div class="control-row" style="margin-top:8px;">
          <label class="control-label">
            <span>Наружные радиаторы СТР</span>
            <span class="control-val" id="lss-rad-lbl">${c.radiatorPct}%</span>
          </label>
          <input type="range" id="lss-rad" min="0" max="100" value="${c.radiatorPct}">
        </div>
      </div>
    `;

    el.querySelector('#lss-crew').addEventListener('input', (e) => {
      c.crew = Number(e.target.value);
      el.querySelector('#lss-crew-lbl').textContent = `${c.crew} чел.`;
    });
    el.querySelector('#lss-act').addEventListener('change', (e) => {
      c.activity = e.target.value;
    });
    el.querySelector('#lss-el').addEventListener('input', (e) => {
      c.elektronRate = Number(e.target.value);
      el.querySelector('#lss-el-lbl').textContent = `${c.elektronRate}%`;
    });
    el.querySelector('#lss-voz').addEventListener('input', (e) => {
      c.vozdukhRate = Number(e.target.value);
      el.querySelector('#lss-voz-lbl').textContent = `${c.vozdukhRate}%`;
    });
    el.querySelector('#lss-sab').addEventListener('input', (e) => {
      c.sabatierRate = Number(e.target.value);
      el.querySelector('#lss-sab-lbl').textContent = `${c.sabatierRate}%`;
    });
    el.querySelector('#lss-lioh').addEventListener('change', (e) => {
      c.liohCartridges = e.target.checked;
    });
    el.querySelector('#lss-rad').addEventListener('input', (e) => {
      c.radiatorPct = Number(e.target.value);
      el.querySelector('#lss-rad-lbl').textContent = `${c.radiatorPct}%`;
    });
  }

  renderCenter(el) {
    el.innerHTML = `
      <div class="bench-toolbar">
        <div style="font-weight:700; color:var(--text-1); font-size:12px;">
          Мнемосхема регенеративной СЖО орбитального модуля (виток 92 мин)
        </div>
        <div class="time-controls">
          <button class="btn btn-sm ${this.running ? 'btn-amber' : 'btn-success'}" id="lss-run-btn">
            ${this.running ? '⏸' : '▶'}
          </button>
          <div class="segmented">
            ${[1, 4, 15].map((sp) => `<button class="seg-btn ${this.speedMinPerSec === sp ? 'active' : ''}" data-sp="${sp}">×${sp}</button>`).join('')}
          </div>
          <span class="sim-clock" id="lss-clock">0 мин</span>
          <button class="btn btn-sm" id="lss-reset-btn">↺</button>
        </div>
      </div>

      <div class="canvas-stage">
        <canvas id="lss-canvas"></canvas>
        <div class="canvas-hud" id="lss-hud"></div>
      </div>
    `;

    this.canvas = el.querySelector('#lss-canvas');
    this.hudEl = el.querySelector('#lss-hud');
    this.clockEl = el.querySelector('#lss-clock');

    el.querySelector('#lss-run-btn').addEventListener('click', (e) => {
      this.running = !this.running;
      e.currentTarget.textContent = this.running ? '⏸' : '▶';
      e.currentTarget.className = `btn btn-sm ${this.running ? 'btn-amber' : 'btn-success'}`;
    });

    el.querySelectorAll('[data-sp]').forEach((b) => {
      b.addEventListener('click', () => {
        this.speedMinPerSec = Number(b.dataset.sp);
        el.querySelectorAll('[data-sp]').forEach((x) => x.classList.toggle('active', x === b));
      });
    });

    el.querySelector('#lss-reset-btn').addEventListener('click', () => this.resetStation());
  }

  renderRight(el) {
    el.innerHTML = `
      <div class="panel-section">
        <div class="section-header">
          <span class="section-title">Газовый состав и климат модуля</span>
        </div>
        <div class="telemetry-grid">
          <div class="telemetry-card">
            <span class="telemetry-label">p(O₂) норма 145–175</span>
            <span class="telemetry-value green" id="lss-t-o2">159 мм</span>
          </div>
          <div class="telemetry-card">
            <span class="telemetry-label">p(CO₂) норма < 3.5</span>
            <span class="telemetry-value cyan" id="lss-t-co2">2.10 мм</span>
          </div>
          <div class="telemetry-card">
            <span class="telemetry-label">Примесь H₂ (ПДК < 0.5%)</span>
            <span class="telemetry-value amber" id="lss-t-h2">0.08%</span>
          </div>
          <div class="telemetry-card">
            <span class="telemetry-label">Запас воды СРВ-К2М</span>
            <span class="telemetry-value" id="lss-t-h2o">42.0 л</span>
          </div>
          <div class="telemetry-card">
            <span class="telemetry-label">Температура отсека</span>
            <span class="telemetry-value" id="lss-t-temp">+21.8 °C</span>
          </div>
          <div class="telemetry-card">
            <span class="telemetry-label">Освещённость орбиты</span>
            <span class="telemetry-value" id="lss-t-sun">Солнце</span>
          </div>
        </div>
      </div>

      <div class="panel-section">
        <div class="section-header">
          <span class="section-title">Самописец атмосферы СЖО</span>
        </div>
        <div id="lss-scope-root"></div>
      </div>

      <div class="panel-section" style="font-size:11.5px; color:var(--text-1); line-height:1.55;">
        <div class="section-title" style="margin-bottom:6px;">Ключевые реакции жизнеобеспечения</div>
        <div>1) <strong>Электролиз:</strong> 2H₂O → 2H₂↑ + O₂↑</div>
        <div>2) <strong>Патрон LiOH:</strong> 2LiOH + CO₂ → Li₂CO₃ + H₂O</div>
        <div>3) <strong>Сабатье:</strong> CO₂ + 4H₂ → CH₄↑ (за борт) + 2H₂O</div>
      </div>
    `;

    this.scope = new TelemetryScope(
      el.querySelector('#lss-scope-root'),
      [
        { key: 'o2', label: 'p(O₂)', unit: ' мм', color: '#22c55e', min: 110, max: 210 },
        { key: 'co2', label: 'p(CO₂)', unit: ' мм', color: '#ef4444', min: 0, max: 12 },
        { key: 'temp', label: 'T', unit: ' °C', color: '#38bdf8', min: 10, max: 38 }
      ],
      { height: 142 }
    );
  }

  step(dtReal) {
    if (!this.containers) return;
    const s = this.state;
    const c = this.ctrl;

    if (this.running && s.crewAlive) {
      const dMin = dtReal * this.speedMinPerSec;
      s.simMinutes += dMin;

      // 92-minute ISS orbit: 56 min sun, 36 min eclipse
      const orbPhase = s.simMinutes % 92;
      s.inSunlight = orbPhase < 56;

      const actMult = c.activity === 'rest' ? 0.72 : c.activity === 'work' ? 1.55 : 1.0;

      // Crew O2 consumption & CO2 production + humidity condensate
      const crewO2Use = c.crew * 0.048 * actMult * dMin;
      const crewCO2Gen = c.crew * 0.044 * actMult * dMin;
      const crewCondensateL = c.crew * 0.0014 * actMult * dMin;

      // Elektron-VM water electrolysis
      const elActive = s.waterLiters > 0.2 ? c.elektronRate / 100 : 0;
      const o2Gen = elActive * 0.30 * dMin;
      const h2Gen = elActive * 0.038 * dMin;
      const h2oUsed = elActive * 0.014 * dMin;

      // Vozdukh zeolite + LiOH CO2 scrubbing
      const co2Vozdukh = (c.vozdukhRate / 100) * 0.28 * Math.min(1.5, s.pCO2 / 2.2) * dMin;
      let co2Lioh = 0;
      if (c.liohCartridges && s.liohLeftPct > 0) {
        co2Lioh = 0.35 * dMin;
        s.liohLeftPct = Math.max(0, s.liohLeftPct - 0.18 * dMin);
      }

      // Sabatier reactor consumes H2 and captured CO2 to regenerate H2O!
      const sabFactor = (c.sabatierRate / 100);
      const h2Consumed = Math.min(s.h2Pct + h2Gen, sabFactor * 0.052 * dMin);
      const sabWaterGain = h2Consumed * 0.26;

      s.pO2 = Math.max(60, Math.min(260, s.pO2 + o2Gen - crewO2Use));
      s.pCO2 = Math.max(0.2, Math.min(25, s.pCO2 + crewCO2Gen - co2Vozdukh - co2Lioh - sabFactor * 0.04 * dMin));
      s.h2Pct = Math.max(0, s.h2Pct + h2Gen - h2Consumed - 0.002 * dMin);
      s.waterLiters = Math.max(0, s.waterLiters - h2oUsed + crewCondensateL + sabWaterGain);

      // Cabin Thermal balance
      const solarHeat = s.inSunlight ? 0.34 : -0.18;
      const internalHeat = 0.16 + c.crew * 0.035 * actMult + (c.sabatierRate / 100) * 0.08;
      const radCool = (c.radiatorPct / 100) * 0.82;
      const dTemp = (solarHeat + internalHeat - radCool) * dMin * 0.45;
      s.cabinTempC = Math.max(2, Math.min(48, s.cabinTempC + dTemp));

      if (s.cabinTempC >= 20.0 && s.cabinTempC <= 24.0) {
        s.thermalStableMinutes += dMin;
      } else {
        s.thermalStableMinutes = Math.max(0, s.thermalStableMinutes - dMin * 0.5);
      }

      // Critical life safety bounds
      if (s.pO2 < 105) {
        s.crewAlive = false;
        s.alertReason = 'Острая гипоксия экипажа (p(O₂) < 105 мм рт. ст.)!';
      } else if (s.pCO2 > 14.5) {
        s.crewAlive = false;
        s.alertReason = 'Тяжёлое отравление CO₂ (гиперкапния > 14.5 мм рт. ст.)!';
      } else if (s.h2Pct >= 4.0) {
        s.crewAlive = false;
        s.alertReason = 'Достигнут нижний предел взрываемости водорода (H₂ ≥ 4%)!';
      }

      if (this.scope) {
        this.scope.push({ o2: s.pO2, co2: s.pCO2, temp: s.cabinTempC });
      }
    }

    this.drawCanvas();
    this.updateDOM();
  }

  updateDOM() {
    if (!this.containers) return;
    const s = this.state;
    const r = this.containers.right;
    const l = this.containers.left;

    if (this.clockEl) this.clockEl.textContent = `${s.simMinutes.toFixed(0)} мин`;
    const liohLbl = l.querySelector('#lss-lioh-pct');
    if (liohLbl) liohLbl.textContent = s.liohLeftPct.toFixed(0);

    const o2El = r.querySelector('#lss-t-o2');
    o2El.textContent = `${s.pO2.toFixed(1)} мм`;
    o2El.className = 'telemetry-value ' + (s.pO2 >= 145 && s.pO2 <= 175 ? 'green' : 'red');

    const co2El = r.querySelector('#lss-t-co2');
    co2El.textContent = `${s.pCO2.toFixed(2)} мм`;
    co2El.className = 'telemetry-value ' + (s.pCO2 < 3.5 ? 'green' : s.pCO2 < 6.0 ? 'amber' : 'red');

    const h2El = r.querySelector('#lss-t-h2');
    h2El.textContent = `${s.h2Pct.toFixed(2)}%`;
    h2El.className = 'telemetry-value ' + (s.h2Pct < 0.4 ? 'green' : s.h2Pct < 1.5 ? 'amber' : 'red');

    r.querySelector('#lss-t-h2o').textContent = `${s.waterLiters.toFixed(1)} л`;

    const tEl = r.querySelector('#lss-t-temp');
    tEl.textContent = `${s.cabinTempC >= 0 ? '+' : ''}${s.cabinTempC.toFixed(1)} °C`;
    tEl.className = 'telemetry-value ' + (s.cabinTempC >= 20 && s.cabinTempC <= 24 ? 'green' : 'amber');

    r.querySelector('#lss-t-sun').textContent = s.inSunlight ? '☀ Солнце' : '🌑 Тень Земли';

    if (this.hudEl) {
      if (!s.crewAlive) {
        this.hudEl.innerHTML = `<div class="hud-chip danger">🚨 АВАРИЯ СЖО: ${s.alertReason}</div>`;
      } else if (s.pCO2 >= 4.0) {
        this.hudEl.innerHTML = `<div class="hud-chip danger">⚠ Повышен уровень CO₂ (${s.pCO2.toFixed(1)} мм) — включите «Воздух» или патроны LiOH!</div>`;
      } else if (s.h2Pct >= 0.6) {
        this.hudEl.innerHTML = `<div class="hud-chip warn">⚠ Накопление водорода H₂ (${s.h2Pct.toFixed(2)}%) — включите реактор Сабатье!</div>`;
      } else {
        this.hudEl.innerHTML = `<div class="hud-chip ok">✓ Параметры жизнеобеспечения станции в пределах нормы</div>`;
      }
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

    const s = this.state;
    const c = this.ctrl;

    ctx.fillStyle = s.inSunlight ? '#091326' : '#050811';
    ctx.fillRect(0, 0, w, h);

    // Draw closed-loop blocks & animated pipelines
    const cx = w / 2;
    const cy = h / 2 + 10;

    const drawNode = (x, y, bw, bh, title, sub, borderCol) => {
      ctx.fillStyle = '#111c33';
      ctx.strokeStyle = borderCol;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(x - bw / 2, y - bh / 2, bw, bh, 9);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(title, x, y - 5);
      ctx.fillStyle = '#94a3b8';
      ctx.font = '11px ui-monospace, monospace';
      ctx.fillText(sub, x, y + 14);
      ctx.textAlign = 'left';
    };

    const drawPipe = (x1, y1, x2, y2, color, label, active) => {
      ctx.strokeStyle = active ? color : 'rgba(100,116,139,0.25)';
      ctx.lineWidth = active ? 2.6 : 1.5;
      if (active) {
        ctx.setLineDash([8, 6]);
        ctx.lineDashOffset = -(s.simMinutes * 6) % 28;
      }
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = active ? color : '#64748b';
      ctx.font = 'bold 10.5px ui-monospace, monospace';
      ctx.fillText(label, (x1 + x2) / 2 - 16, (y1 + y2) / 2 - 6);
    };

    const cabinX = cx;
    const cabinY = cy - 15;
    const elX = cx - Math.min(200, w * 0.30);
    const elY = cy - 95;
    const vozX = cx + Math.min(200, w * 0.30);
    const vozY = cy - 95;
    const sabX = cx;
    const sabY = cy + 115;
    const h2oX = cx - Math.min(200, w * 0.30);
    const h2oY = cy + 115;
    const radX = cx + Math.min(200, w * 0.30);
    const radY = cy + 115;

    // Connecting pipelines
    drawPipe(elX + 60, elY + 10, cabinX - 75, cabinY - 15, '#22c55e', 'O₂', c.elektronRate > 0);
    drawPipe(cabinX + 75, cabinY - 15, vozX - 60, vozY + 10, '#f87171', 'CO₂', true);
    drawPipe(elX, elY + 32, sabX - 65, sabY - 10, '#fbbf24', 'H₂', c.elektronRate > 0 && c.sabatierRate > 0);
    drawPipe(vozX, vozY + 32, sabX + 65, sabY - 10, '#f87171', 'CO₂', c.vozdukhRate > 0 && c.sabatierRate > 0);
    drawPipe(sabX - 75, sabY, h2oX + 70, h2oY, '#38bdf8', 'H₂O реген.', c.sabatierRate > 0);
    drawPipe(h2oX, h2oY - 30, elX, elY + 30, '#38bdf8', 'H₂O', s.waterLiters > 0.2);
    drawPipe(cabinX + 55, cabinY + 34, radX - 55, radY - 24, '#a78bfa', 'Тепло СТР', c.radiatorPct > 0);

    // Blocks
    drawNode(
      cabinX,
      cabinY,
      175,
      72,
      `Гермоотсек (${c.crew} косм.)`,
      `O₂:${s.pO2.toFixed(0)} CO₂:${s.pCO2.toFixed(1)} мм`,
      s.pCO2 > 5 || s.pO2 < 135 ? '#ef4444' : '#22c55e'
    );
    drawNode(elX, elY, 150, 56, 'Электрон-ВМ', `Подача ${c.elektronRate}%`, '#22c55e');
    drawNode(
      vozX,
      vozY,
      150,
      56,
      c.liohCartridges ? 'Воздух + LiOH' : 'Блок «Воздух»',
      `Очистка ${c.vozdukhRate}%`,
      '#f87171'
    );
    drawNode(sabX, sabY, 165, 56, 'Реактор Сабатье', `Синтез H₂O: ${c.sabatierRate}%`, '#fbbf24');
    drawNode(h2oX, h2oY, 145, 56, 'Бак СРВ-К2М', `Вода: ${s.waterLiters.toFixed(1)} л`, '#38bdf8');
    drawNode(radX, radY, 150, 56, 'Радиаторы СТР', `Отвод ${c.radiatorPct}% (${s.cabinTempC.toFixed(1)}°C)`, '#a78bfa');

    ctx.restore();
  }

  applyPreset(p) {
    if (!p) return;
    this.resetStation();
    ['crew', 'activity', 'elektronRate', 'vozdukhRate', 'liohCartridges', 'sabatierRate', 'radiatorPct'].forEach((k) => {
      if (p[k] !== undefined) this.ctrl[k] = p[k];
    });
    ['pO2', 'pCO2', 'h2Pct', 'cabinTempC'].forEach((k) => {
      if (typeof p[k] === 'number') this.state[k] = p[k];
    });
    this.running = true;
    if (this.containers) this.mount(this.containers);
  }

  getStateForMission() {
    return { ...this.state };
  }

  exportState() {
    return { ctrl: { ...this.ctrl }, state: { ...this.state } };
  }

  importState(data) {
    if (!data) return;
    if (data.ctrl) Object.assign(this.ctrl, data.ctrl);
    if (data.state) Object.assign(this.state, data.state);
    if (this.containers) this.mount(this.containers);
  }
}
