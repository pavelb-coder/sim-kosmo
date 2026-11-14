// Лаборатория 3: Ракетостроение — функционал в стиле OpenRocket
// Дерево компонентов + инспектор, 1–2 ступени, Dual-Deploy, RASP .eng, экспорт .ork.json/CSV,
// 2D-чертёж, вид сзади, аэротруба, плоттер и симуляция полёта.
import { TelemetryScope } from '../ui/scope.js';
import {
  OR_MATERIALS,
  OR_NOSE_SHAPES,
  OR_FIN_PROFILES,
  OR_FINISHES,
  OR_MOTORS,
  ROCKET_PRESETS,
  classifyImpulse,
  sampleMotorThrust,
  parseRaspEng,
  analyzeRocketOpenRocket,
  simulateOpenRocket
} from './openrocket_engine.js';

const clone = (o) => JSON.parse(JSON.stringify(o));
const BASE_DESIGN = () => clone(ROCKET_PRESETS.cansat_vish.design);

const LEGACY_MM = {
  bodyLenCm: 'bodyLenMm',
  noseLenCm: 'noseLenMm',
  finSpanCm: 'finSpanMm',
  finRootCm: 'finRootMm',
  finTipCm: 'finTipMm',
  boosterLenCm: 'boosterLenMm',
  caliberCm: 'caliberMm',
  boosterFinSpanCm: 'boosterFinSpanMm'
};

const PRESET_SHORT = {
  cansat_vish: 'ВИШ CanSat',
  junior_c6: 'Учебная C6',
  tandem_2stage: 'Тандем 2 ст.',
  mach_probe: 'Мах-зонд'
};

const TABS = [
  { id: 'side', label: 'Чертёж 2D' },
  { id: 'rear', label: 'Вид сзади' },
  { id: 'tunnel', label: 'Аэротруба' },
  { id: 'plotter', label: 'Плоттер' },
  { id: 'flight', label: 'Полёт' }
];

const SAMPLE_ENG = `D12 24 70 0 0.021 0.045 CosmoLab
0.00 0.0
0.05 19.5
0.20 15.0
0.55 12.4
0.95 10.1
1.10 0.0`;

const C = {
  grid: 'rgba(148,163,184,0.10)',
  axis: 'rgba(148,163,184,0.35)',
  text: '#94a3b8',
  textHi: '#e2e8f0',
  cyan: '#22d3ee',
  blue: '#38bdf8',
  amber: '#fbbf24',
  red: '#ef4444',
  green: '#34d399',
  violet: '#a78bfa',
  body: 'rgba(56,189,248,0.16)',
  bodyStroke: '#38bdf8',
  dark: 'rgba(14,165,233,0.10)'
};

const SHAPE_KEYS = new Set([
  'noseShape',
  'deployMode',
  'hasCanSat',
  'twoStage',
  'boatTailEnabled',
  'motorId',
  'boosterMotorId',
  'bodyMaterial',
  'finProfile',
  'finMaterial',
  'surfaceFinish'
]);

export class RocketLab {
  constructor(shell) {
    this.shell = shell;
    this.design = BASE_DESIGN();
    this.env = {
      railLenM: 1.5,
      rodAngleDeg: 3,
      windSpeedMs: 3.5,
      siteAltM: 150,
      groundTempC: 18
    };
    this.view = 'side';
    this.selected = 'rocket';
    this.tunnelMach = 0.25;
    this.aoaDeg = 4;
    this.tunnelPhase = 0;
    this.sim = null;
    this.playT = 0;
    this.playing = false;
    this.speedMult = 1;
    this.scopeCursor = 0;
    this.presetCache = {};
    this.logs = [];
    this.recalc();
  }

  /* ================= Физика и предупреждения ================= */

  recalc() {
    this.result = analyzeRocketOpenRocket(this.design, { mach: Math.max(0.05, this.tunnelMach) });
    this.buildWarnings();
  }

  buildWarnings() {
    const a = this.result;
    const d = this.design;
    const out = [];
    const st = a.stabilityCal;

    if (st < 0) {
      out.push({ level: 'err', text: `Запас устойчивости ${st.toFixed(2)} кал.: ЦД впереди ЦМ — ракета уйдёт в кувырок сразу после схода с направляющей.` });
    } else if (st < 1.0) {
      out.push({ level: 'err', text: `Запас устойчивости ${st.toFixed(2)} кал. меньше 1.0 — неустойчивый полёт (OpenRocket рекомендует 1–2 кал.).` });
    } else if (st < 1.5) {
      out.push({ level: 'warn', text: `Запас устойчивости ${st.toFixed(2)} кал. — на нижней границе, ракета чувствительна к ветру.` });
    } else if (st > 4.5) {
      out.push({ level: 'warn', text: `Запас устойчивости ${st.toFixed(2)} кал. — избыточный: сильное «виляние» на ветру (weathercocking) и потеря высоты.` });
    } else {
      out.push({ level: 'ok', text: `Запас устойчивости ${st.toFixed(2)} кал. в норме (1.5–4.5 кал.).` });
    }

    if (a.twRatio < 1.25) {
      out.push({ level: 'err', text: `Тяговооружённость T/W = ${a.twRatio.toFixed(2)} < 1.25 — двигатель не оторвёт ракету от стола.` });
    } else if (a.twRatio < 3) {
      out.push({ level: 'warn', text: `T/W = ${a.twRatio.toFixed(2)} — вялый старт, проверьте сход с направляющей.` });
    }

    const m2 = a.motor2;
    if (m2 && (m2.diaMm || 0) > a.caliberMm - 2) {
      out.push({ level: 'err', text: `Двигатель Ø${m2.diaMm} мм не помещается в корпус Ø${a.caliberMm.toFixed(0)} мм.` });
    }
    if (m2 && (m2.lenMm || 0) > a.bodyLenMm * 0.92) {
      out.push({ level: 'warn', text: `Длина МРД ${m2.lenMm} мм больше 92 % корпусного отсека — двигатель не влезет без выступа.` });
    }

    const fineness = a.totalLenMm / a.caliberMm;
    if (fineness > 26) {
      out.push({ level: 'warn', text: `Удлинение корпуса ${fineness.toFixed(1)} — риск изгибных колебаний (fin flutter) на большой скорости.` });
    }

    if (d.finSpanMm < a.caliberMm * 0.42) {
      out.push({ level: 'warn', text: `Размах стабилизаторов ${d.finSpanMm} мм меньше 0.42 калибра — мало для устойчивости.` });
    }

    if (d.deployMode === 'dual' && d.mainDeployAltM >= (this.sim ? this.sim.maxAltM * 0.75 : 1200)) {
      out.push({ level: 'warn', text: `Высота ввода основного купола ${d.mainDeployAltM} м слишком велика для ожидаемого апогея — купол может не раскрыться.` });
    }

    if (d.twoStage && d.stageDelaySec > 1.6) {
      out.push({ level: 'warn', text: `Задержка запуска 2-й ступени ${d.stageDelaySec.toFixed(1)} с — ракета слишком долго летит без тяги.` });
    }

    if (a.totalMassKg > 4) {
      out.push({ level: 'warn', text: `Стартовая масса ${(a.totalMassKg * 1000).toFixed(0)} г — проверьте требования класса и разрешение на пуск.` });
    }

    if (!out.some((w) => w.level !== 'ok')) {
      out.push({ level: 'ok', text: 'Критических предупреждений нет — проект готов к пуску.' });
    }

    this.warnings = out;
  }

  /* ================= Жизненный цикл ================= */

  mount(containers) {
    this.containers = containers;
    this.renderLeft(containers.left);
    this.renderCenter(containers.center);
    this.renderRight(containers.right);
    this.updateRight();
    this.renderExtra();
    this.draw();
  }

  unmount() {
    this.containers = null;
    this.scope = null;
    this.canvas = null;
  }

  pushLog(msg, cls = '') {
    const t = this.sim ? this.playT.toFixed(1).padStart(5, ' ') : '  0.0';
    this.logs.push({ t, msg, cls });
    if (this.logs.length > 90) this.logs.shift();
    this.refreshLog();
  }

  refreshLog() {
    const el = this.containers?.right?.querySelector('#rk-log');
    if (!el) return;
    el.innerHTML = this.logs
      .map((l) => `<div class="${l.cls}" style="${l.cls === 'err' ? 'color:#ef4444' : l.cls === 'ok' ? 'color:#34d399' : ''}">[${l.t}с] ${l.msg}</div>`)
      .join('');
    el.scrollTop = el.scrollHeight;
  }

  /* ================= Левая колонка: проект, дерево, инспектор ================= */

  renderLeft(el) {
    el.innerHTML = `
      <div class="panel-section">
        <div class="section-header">
          <span class="section-title">Проект OpenRocket</span>
          <span class="tag">${Object.keys(OR_MOTORS).length} МРД</span>
        </div>
        <div class="rk-grid2">
          ${Object.entries(ROCKET_PRESETS)
            .map(([k, v]) => `<button class="btn btn-sm" data-preset="${k}" title="${v.label}">${PRESET_SHORT[k] || v.label}</button>`)
            .join('')}
        </div>
        <div class="rk-grid2" style="margin-top:6px;">
          <button class="btn btn-sm" id="rk-import-eng">📥 Импорт .eng</button>
          <button class="btn btn-sm" id="rk-export-ork">💾 Экспорт .ork</button>
          <button class="btn btn-sm" id="rk-export-csv">📊 CSV анализа</button>
          <button class="btn btn-sm" id="rk-export-tele">📈 CSV полёта</button>
        </div>
        <input type="file" id="rk-file" accept=".eng,.txt" style="display:none">
      </div>

      <div class="panel-section">
        <div class="section-header">
          <span class="section-title">Дерево компонентов</span>
          <span style="font-size:10px;color:var(--text-2);font-family:var(--font-mono);" id="rk-tree-mass"></span>
        </div>
        <div id="rk-tree" class="rk-tree"></div>
      </div>

      <div class="panel-section" id="rk-inspector"></div>

      <div class="panel-section">
        <div class="section-header">
          <span class="section-title">Стол, направляющая, атмосфера</span>
        </div>
        ${this.ctrlEnv('Длина направляющей', 'railLenM', 0.5, 6, 0.1, ' м', this.env.railLenM)}
        ${this.ctrlEnv('Угол наклона направляющей', 'rodAngleDeg', 0, 20, 1, '°', this.env.rodAngleDeg)}
        ${this.ctrlEnv('Скорость ветра у земли', 'windSpeedMs', 0, 14, 0.5, ' м/с', this.env.windSpeedMs)}
        ${this.ctrlEnv('Высота стартовой площадки', 'siteAltM', 0, 3000, 50, ' м', this.env.siteAltM)}
        ${this.ctrlEnv('Температура воздуха', 'groundTempC', -25, 45, 1, ' °C', this.env.groundTempC)}
      </div>
    `;

    el.querySelectorAll('[data-preset]').forEach((b) => {
      b.addEventListener('click', () => this.loadPreset(b.dataset.preset));
    });

    el.querySelector('#rk-import-eng').addEventListener('click', () => el.querySelector('#rk-file').click());
    el.querySelector('#rk-file').addEventListener('change', (e) => {
      const f = e.target.files && e.target.files[0];
      if (!f) return;
      const rd = new FileReader();
      rd.onload = () => this.importEng(String(rd.result), f.name);
      rd.readAsText(f);
      e.target.value = '';
    });
    el.querySelector('#rk-export-ork').addEventListener('click', () => this.exportOrk());
    el.querySelector('#rk-export-csv').addEventListener('click', () => this.exportAnalysisCsv());
    el.querySelector('#rk-export-tele').addEventListener('click', () => this.exportFlightCsv());

    this.bindControls(el);
    this.refreshTree();
    this.renderInspector();
  }

  ctrlRange(label, key, min, max, step, unit, value, attr = 'data-key') {
    return `<div class="control-row">
      <label class="control-label"><span>${label}</span><span class="control-val" data-val="${key}" data-unit="${unit}">${value}${unit}</span></label>
      <input type="range" ${attr}="${key}" min="${min}" max="${max}" step="${step}" value="${value}">
    </div>`;
  }

  ctrlEnv(label, key, min, max, step, unit, value) {
    return this.ctrlRange(label, key, min, max, step, unit, value, 'data-env');
  }

  ctrlSelect(label, key, options, value) {
    return `<div class="control-row">
      <label class="control-label"><span>${label}</span></label>
      <select data-key="${key}">
        ${options
          .map(([k, l]) => `<option value="${k}" ${String(value) === String(k) ? 'selected' : ''}>${l}</option>`)
          .join('')}
      </select>
    </div>`;
  }

  ctrlCheck(label, key, checked) {
    return `<div class="control-row">
      <label class="control-label"><span>${label}</span></label>
      <input type="checkbox" data-key="${key}" ${checked ? 'checked' : ''}>
    </div>`;
  }

  bindControls(root) {
    root.querySelectorAll('[data-key],[data-env]').forEach((inp) => {
      const ev = inp.tagName === 'SELECT' || inp.type === 'checkbox' ? 'change' : 'input';
      inp.addEventListener(ev, () => this.onControl(inp));
    });
    root.querySelectorAll('[data-sel]').forEach((row) => {
      row.addEventListener('click', () => {
        this.selected = row.dataset.sel;
        this.refreshTree();
        this.renderInspector();
        this.draw();
      });
    });
    root.querySelectorAll('[data-act]').forEach((b) => {
      b.addEventListener('click', () => this.onAction(b.dataset.act));
    });
  }

  onControl(inp) {
    const key = inp.dataset.key;
    const envKey = inp.dataset.env;
    let v;
    if (inp.type === 'checkbox') v = inp.checked;
    else if (inp.type === 'range' || inp.type === 'number') v = Number(inp.value);
    else v = inp.value;

    if (envKey) this.env[envKey] = v;
    else if (key) this.design[key] = v;

    const k = envKey || key;
    const lab = this.containers?.left?.querySelector(`[data-val="${k}"]`);
    if (lab) lab.textContent = `${v}${lab.dataset.unit || ''}`;

    this.onDesignChange(SHAPE_KEYS.has(key));
  }

  onDesignChange(rerenderInspector) {
    this.recalc();
    this.clearSim(true);
    this.refreshTree();
    if (rerenderInspector) this.renderInspector();
    this.updateRight();
    this.renderExtra();
    this.draw();
  }

  treeRows() {
    const a = this.result;
    const d = this.design;
    const comp = (id) => a.components.find((c) => c.id === id);
    const mass = (id) => {
      const c = comp(id);
      return c ? `${c.massG.toFixed(0)} г` : '';
    };
    const row = (id, name, depth, opts = {}) => {
      const c = comp(id);
      const m = opts.mass !== undefined ? opts.mass : mass(id);
      return `<div class="rk-row ${this.selected === id ? 'active' : ''} ${opts.group ? 'rk-group' : ''}" data-sel="${id}" style="padding-left:${8 + depth * 13}px;">
        <span class="rk-ind">${opts.icon || (opts.group ? '▾' : '•')}</span>
        <span class="rk-name">${name}</span>
        <span class="rk-mass">${m || ''}</span>
      </div>`;
    };
    let html = '';
    html += row('rocket', 'Ракета (проект)', 0, { group: true, mass: `${(a.totalMassKg * 1000).toFixed(0)} г`, icon: '🚀' });
    html += row('stage2', `Ступень 2 · маршевая${d.twoStage ? '' : ' (единственная)'}`, 1, { group: true, mass: '', icon: '▾' });
    html += row('nose', `${OR_NOSE_SHAPES[d.noseShape].name.split(' ')[0]} обтекатель`, 2, { icon: '◭' });
    if (d.noseMassG > 0) html += row('ballast', 'Носовой балласт', 3, { icon: '⚖' });
    html += row('body', `Корпусная труба ${d.bodyLenMm} мм`, 2, { icon: '▭' });
    if (d.hasCanSat) html += row('payload', 'Отсек CanSat', 3, { icon: '🛰' });
    html += row('recovery', 'Система спасения', 2, { icon: '🪂' });
    html += row('fins', `Стабилизаторы ×${d.finCount}`, 2, { icon: '◺' });
    if (d.boatTailEnabled && !d.twoStage) html += row('boattail', 'Boat-Tail', 2, { icon: '◿' });
    html += row('motor', a.motor2 ? a.motor2.name : 'МРД', 2, { icon: '🔥' });
    if (d.twoStage) {
      html += row('stage1', 'Ступень 1 · бустер', 1, { group: true, icon: '▾' });
      html += row('booster', `Корпус бустера ${d.boosterLenMm} мм`, 2, { icon: '▭' });
      html += row('booster_fins', 'Стабилизаторы бустера', 2, { icon: '◺' });
      html += row('booster_motor', a.motor1 ? a.motor1.name : 'МРД бустера', 2, { icon: '🔥' });
    }
    return html;
  }

  refreshTree() {
    const tree = this.containers?.left?.querySelector('#rk-tree');
    if (!tree) return;
    tree.innerHTML = this.treeRows();
    tree.querySelectorAll('[data-sel]').forEach((row) => {
      row.addEventListener('click', () => {
        this.selected = row.dataset.sel;
        this.refreshTree();
        this.renderInspector();
        this.draw();
      });
    });
    const mEl = this.containers.left.querySelector('#rk-tree-mass');
    if (mEl) mEl.textContent = `${(this.result.totalMassKg * 1000).toFixed(0)} г · ${(this.result.totalLenMm / 10).toFixed(1)} см`;
  }

  renderInspector() {
    const box = this.containers?.left?.querySelector('#rk-inspector');
    if (!box) return;
    box.innerHTML = this.inspectorHTML(this.selected);
    this.bindControls(box);
  }

  motorOptions() {
    return Object.entries(OR_MOTORS).map(([k, m]) => [k, `${m.name} · ${m.motorClass}`]);
  }

  inspectorHTML(id) {
    const d = this.design;
    const a = this.result;
    const head = (title, sub = '') => `<div class="section-header">
      <span class="section-title">${title}</span>
      ${sub ? `<span style="font-size:10px;color:var(--text-2);">${sub}</span>` : ''}
    </div>`;

    switch (id) {
      case 'rocket':
        return `${head('Проект целиком', `${(a.totalLenMm / 10).toFixed(1)} см · ${(a.totalMassKg * 1000).toFixed(0)} г`)}
          <div class="rk-summary">
            ЦМ (CG): <b>${a.cgMm.toFixed(1)} мм</b> от носка<br>
            ЦД (CP): <b>${a.cpMm.toFixed(1)} мм</b> от носка<br>
            Запас: <b>${a.stabilityCal.toFixed(2)} кал.</b> · Cd₀ = ${a.cdTotal.toFixed(3)} · T/W = ${a.twRatio.toFixed(2)}<br>
            Диаметр ${a.caliberMm.toFixed(0)} мм · удлинение ${(a.totalLenMm / a.caliberMm).toFixed(1)}
          </div>
          ${this.ctrlCheck('Двухступенчатая схема', 'twoStage', d.twoStage)}
          ${this.ctrlRange('Калибр корпуса', 'caliberMm', 24, 160, 1, ' мм', d.caliberMm, 'data-key')}
          <div style="display:flex;gap:6px;margin-top:8px;">
            <button class="btn btn-sm" data-act="run">▶ Симуляция</button>
            <button class="btn btn-sm" data-act="fit-nose">Нос по калибру</button>
          </div>`;

      case 'stage2':
        return `${head('Ступень 2 · маршевая', 'основная ступень')}
          ${this.ctrlRange('Калибр корпуса', 'caliberMm', 24, 160, 1, ' мм', d.caliberMm)}
          ${this.ctrlRange('Толщина стенки', 'wallMm', 0.5, 4, 0.1, ' мм', d.wallMm)}
          ${this.ctrlCheck('Двухступенчатая схема', 'twoStage', d.twoStage)}
          <div class="rk-summary">Масса верхней ступени: <b>${(a.totalMassKg * 1000).toFixed(0)} г</b>${d.twoStage ? ' (с бустером)' : ''}</div>`;

      case 'nose':
      case 'ballast':
        return `${head('Головной обтекатель', OR_NOSE_SHAPES[d.noseShape].name)}
          ${this.ctrlSelect('Тип обтекателя', 'noseShape', Object.entries(OR_NOSE_SHAPES).map(([k, v]) => [k, v.name]), d.noseShape)}
          ${this.ctrlRange('Длина обтекателя', 'noseLenMm', 60, 360, 5, ' мм', d.noseLenMm)}
          ${this.ctrlRange('Носовой балласт', 'noseMassG', 0, 300, 5, ' г', d.noseMassG)}
          <div class="rk-summary">
            Cd формы: <b>${OR_NOSE_SHAPES[d.noseShape].cdForm.toFixed(3)}</b> ·
            положение ЦД обтекателя: ${(OR_NOSE_SHAPES[d.noseShape].cpFrac * 100).toFixed(0)} % длины<br>
            Масса оболочки: <b>${(a.components.find((c) => c.id === 'nose')?.massG || 0).toFixed(0)} г</b>
          </div>
          <div style="display:flex;gap:6px;">
            <button class="btn btn-sm" data-act="ballast-30">+30 г балласта</button>
            <button class="btn btn-sm" data-act="ballast-0">Убрать балласт</button>
          </div>`;

      case 'body':
        return `${head('Корпусная труба', `${(a.bodyLenMm / 10).toFixed(1)} см`)}
          ${this.ctrlRange('Длина корпуса', 'bodyLenMm', 200, 1800, 10, ' мм', d.bodyLenMm)}
          ${this.ctrlRange('Толщина стенки', 'wallMm', 0.5, 4, 0.1, ' мм', d.wallMm)}
          ${this.ctrlSelect('Материал', 'bodyMaterial', Object.entries(OR_MATERIALS).map(([k, v]) => [k, v.name]), d.bodyMaterial)}
          ${this.ctrlSelect('Обработка поверхности', 'surfaceFinish', Object.entries(OR_FINISHES).map(([k, v]) => [k, v.name]), d.surfaceFinish)}
          <div class="rk-summary">Масса трубы: <b>${(a.components.find((c) => c.id === 'body')?.massG || 0).toFixed(0)} г</b> · удлинение ${(a.totalLenMm / a.caliberMm).toFixed(1)}</div>`;

      case 'payload':
        return `${head('Отсек полезной нагрузки', d.hasCanSat ? 'CanSat 0.33 л' : 'электроника')}
          ${this.ctrlCheck('Полезная нагрузка CanSat', 'hasCanSat', d.hasCanSat)}
          ${this.ctrlRange('Масса ПН', 'payloadMassG', 20, 1200, 10, ' г', d.payloadMassG)}
          ${this.ctrlRange('Положение отсека', 'payloadPosFrac', 0.1, 0.6, 0.01, '', d.payloadPosFrac)}
          <div class="rk-summary">Масса отсека: <b>${(a.components.find((c) => c.id === 'payload')?.massG || 0).toFixed(0)} г</b><br>Смещение ПН вперёд снижает ЦМ и повышает устойчивость.</div>`;

      case 'recovery':
        return `${head('Система спасения', d.deployMode === 'dual' ? 'Dual-Deploy' : d.deployMode === 'baro' ? 'барометр' : 'таймер')}
          ${this.ctrlSelect('Схема раскрытия', 'deployMode', [
            ['baro', 'Барометр — купол в апогее'],
            ['dual', 'Dual-Deploy: вытяжной + основной'],
            ['timer', 'Таймер вышибного заряда']
          ], d.deployMode)}
          ${this.ctrlRange('Основной купол', 'chuteDiamCm', 20, 220, 5, ' см', d.chuteDiamCm)}
          ${d.deployMode === 'dual' ? this.ctrlRange('Вытяжной купол (drogue)', 'drogueDiamCm', 10, 90, 1, ' см', d.drogueDiamCm) : ''}
          ${d.deployMode === 'dual' ? this.ctrlRange('Высота ввода основного', 'mainDeployAltM', 60, 900, 10, ' м', d.mainDeployAltM) : ''}
          ${d.deployMode === 'timer' ? this.ctrlRange('Задержка таймера', 'timerSec', 1, 30, 0.5, ' с', d.timerSec) : ''}
          <div class="rk-summary">Масса системы: <b>${(a.components.find((c) => c.id === 'recovery')?.massG || 0).toFixed(0)} г</b><br>Предельная скорость раскрытия ≈ 35 м/с (обрыв строп выше).</div>`;

      case 'fins':
        return `${head('Стабилизаторы', `${d.finCount} шт. · ${OR_FIN_PROFILES[d.finProfile].name}`)}
          ${this.ctrlSelect('Количество', 'finCount', [[3, '3'], [4, '4'], [6, '6']], d.finCount)}
          ${this.ctrlRange('Корневая хорда', 'finRootMm', 40, 320, 5, ' мм', d.finRootMm)}
          ${this.ctrlRange('Концевая хорда', 'finTipMm', 10, 260, 5, ' мм', d.finTipMm)}
          ${this.ctrlRange('Размах (полуразмах)', 'finSpanMm', 20, 260, 2, ' мм', d.finSpanMm)}
          ${this.ctrlRange('Стреловидность', 'finSweepMm', 0, 220, 5, ' мм', d.finSweepMm)}
          ${this.ctrlSelect('Профиль сечения', 'finProfile', Object.entries(OR_FIN_PROFILES).map(([k, v]) => [k, v.name]), d.finProfile)}
          ${this.ctrlSelect('Материал', 'finMaterial', Object.entries(OR_MATERIALS).map(([k, v]) => [k, v.name]), d.finMaterial)}
          <div class="rk-summary">Масса комплекта: <b>${(a.components.find((c) => c.id === 'fins')?.massG || 0).toFixed(0)} г</b> · ЦД стабилизаторов позади ЦМ — они и создают запас.</div>`;

      case 'boattail':
        return `${head('Хвостовое сужение', 'Boat-Tail')}
          ${this.ctrlCheck('Включить Boat-Tail', 'boatTailEnabled', d.boatTailEnabled)}
          ${this.ctrlRange('Длина сужения', 'boatTailLenMm', 10, 160, 5, ' мм', d.boatTailLenMm)}
          ${this.ctrlRange('Диаметр на срезе', 'boatTailAftDiaMm', 20, Math.max(24, d.caliberMm - 4), 2, ' мм', d.boatTailAftDiaMm)}
          <div class="rk-summary">Снижает донное сопротивление, но <b>уменьшает</b> запас устойчивости (дестабилизирующая сила по Барроумену).</div>`;

      case 'motor':
      case 'stage2_motor':
        return `${head('Маршевый двигатель', `${a.motor2.motorClass}-класс`)}
          ${this.ctrlSelect('Модель МРД', 'motorId', this.motorOptions(), d.motorId)}
          <div class="rk-summary">
            Суммарный импульс: <b>${a.motor2.totalImp.toFixed(0)} Н·с</b> (класс ${a.motor2.motorClass})<br>
            Время работы: <b>${a.motor2.burnTime.toFixed(2)} с</b> · средняя тяга ${(a.motor2.totalImp / a.motor2.burnTime).toFixed(0)} Н<br>
            Масса: ${a.motor2.caseMassG.toFixed(0)} г корпус + ${a.motor2.propMassG.toFixed(0)} г топливо<br>
            Габарит: Ø${a.motor2.diaMm} × ${a.motor2.lenMm} мм
          </div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;">
            <button class="btn btn-sm" data-act="import-eng">📥 Импорт .eng</button>
            <button class="btn btn-sm" data-act="sample-eng">📄 Пример .eng</button>
            <button class="btn btn-sm btn-primary" data-act="run">▶ Симуляция</button>
          </div>
          <div class="rk-summary" style="font-size:10px;">RASP .eng — стандарт OpenRocket / ThrustCurve.org: строка заголовка (код, Ø, длина, задержка, масса топлива, масса двигателя, производитель) и таблица «время — тяга».</div>`;

      case 'booster':
      case 'stage1':
        return `${head('Ступень 1 · бустер', 'отделяемая')}
          ${this.ctrlCheck('Двухступенчатая схема', 'twoStage', d.twoStage)}
          ${this.ctrlRange('Длина корпуса бустера', 'boosterLenMm', 120, 900, 10, ' мм', d.boosterLenMm)}
          ${this.ctrlRange('Размах стабилизаторов бустера', 'boosterFinSpanMm', 40, 240, 2, ' мм', d.boosterFinSpanMm)}
          ${this.ctrlRange('Задержка запуска 2-й ст.', 'stageDelaySec', 0, 3, 0.1, ' с', d.stageDelaySec)}
          ${this.ctrlSelect('Двигатель бустера', 'boosterMotorId', this.motorOptions(), d.boosterMotorId)}`;

      case 'booster_fins':
        return `${head('Стабилизаторы бустера', '')}
          ${this.ctrlRange('Размах', 'boosterFinSpanMm', 40, 240, 2, ' мм', d.boosterFinSpanMm)}
          <div class="rk-summary">Корневые и концевые хорды наследуются от маршевых стабилизаторов (×1.12).</div>`;

      case 'booster_motor':
        return `${head('Двигатель бустера', '')}
          ${this.ctrlSelect('Модель МРД бустера', 'boosterMotorId', this.motorOptions(), d.boosterMotorId)}
          ${a.motor1 ? `<div class="rk-summary">Импульс: <b>${a.motor1.totalImp.toFixed(0)} Н·с</b> · время ${a.motor1.burnTime.toFixed(2)} с · Ø${a.motor1.diaMm} × ${a.motor1.lenMm} мм</div>` : ''}`;

      default:
        return `${head('Инспектор компонента', 'выберите элемент дерева')}
          <div class="rk-summary">Щёлкните по компоненту в дереве слева или по ракете на чертеже — здесь появятся его параметры.</div>`;
    }
  }

  onAction(act) {
    if (act === 'run') this.runSim();
    else if (act === 'ballast-30') {
      this.design.noseMassG = Math.min(300, (this.design.noseMassG || 0) + 30);
      this.recalc();
      this.clearSim(true);
      this.refreshTree();
      this.renderInspector();
      this.updateRight();
      this.renderExtra();
      this.draw();
    } else if (act === 'ballast-0') {
      this.design.noseMassG = 0;
      this.recalc();
      this.clearSim(true);
      this.refreshTree();
      this.renderInspector();
      this.updateRight();
      this.renderExtra();
      this.draw();
    } else if (act === 'sample-eng') {
      this.importEng(SAMPLE_ENG, 'CosmoLab_D12.eng');
    } else if (act === 'import-eng') {
      this.containers?.left?.querySelector('#rk-file')?.click();
    } else if (act === 'fit-nose') {
      this.design.noseLenMm = Math.round(this.design.caliberMm * 2.4);
      this.recalc();
      this.clearSim(true);
      this.refreshTree();
      this.renderInspector();
      this.updateRight();
      this.draw();
    }
  }

  /* ================= Загрузка пресетов и совместимость ================= */

  normalizeDesign(patch) {
    const base = BASE_DESIGN();
    const out = Object.assign(base, patch || {});
    Object.entries(LEGACY_MM).forEach(([legacy, target]) => {
      if (patch && patch[legacy] !== undefined) {
        out[target] = Number(patch[legacy]) * 10;
        delete out[legacy];
      }
    });
    // совместимость со старыми названиями материалов
    if (out.bodyMaterial === 'carbon' || out.bodyMaterial === 'fiberglass' || out.bodyMaterial === 'cardboard') {
      // ключи совпадают
    }
    // валидация перечислимых параметров (защита от старых .cosmolab и пресетов)
    if (!OR_NOSE_SHAPES[out.noseShape]) out.noseShape = 'ogive';
    if (!OR_MATERIALS[out.bodyMaterial]) out.bodyMaterial = 'fiberglass';
    if (!OR_MATERIALS[out.finMaterial]) out.finMaterial = out.bodyMaterial;
    if (!OR_FIN_PROFILES[out.finProfile]) out.finProfile = 'rounded';
    if (!OR_FINISHES[out.surfaceFinish]) out.surfaceFinish = 'gloss';
    if (!OR_MOTORS[out.motorId]) out.motorId = 'imp_250';
    if (!OR_MOTORS[out.boosterMotorId]) out.boosterMotorId = 'i285';
    if (!['baro', 'dual', 'timer'].includes(out.deployMode)) out.deployMode = 'baro';
    out.noseMassG = Math.max(0, Math.min(400, Number(out.noseMassG) || 0));
    out.payloadMassG = Math.max(0, Math.min(1500, Number(out.payloadMassG) || 0));
    out.finSpanMm = Math.max(10, Math.min(300, Number(out.finSpanMm) || 80));
    out.finRootMm = Math.max(20, Math.min(400, Number(out.finRootMm) || 120));
    out.finTipMm = Math.max(5, Math.min(300, Number(out.finTipMm) || 50));
    out.chuteDiamCm = Math.max(10, Math.min(250, Number(out.chuteDiamCm) || 75));
    out.caliberMm = Math.max(24, Math.min(200, Number(out.caliberMm) || 70));
    out.bodyLenMm = Math.max(120, Math.min(2000, Number(out.bodyLenMm) || 600));
    out.noseLenMm = Math.max(40, Math.min(400, Number(out.noseLenMm) || 160));
    out.finCount = [3, 4, 6].includes(Number(out.finCount)) ? Number(out.finCount) : 4;
    return out;
  }

  loadPreset(key) {
    const p = ROCKET_PRESETS[key];
    if (!p) return;
    this.design = this.normalizeDesign(clone(p.design));
    this.selected = 'rocket';
    this.clearSim(true);
    this.recalc();
    this.pushLog(`Загружен пресет: ${p.label}`);
    if (this.containers) {
      this.refreshTree();
      this.renderInspector();
      this.updateRight();
      this.renderExtra();
      this.draw();
    }
  }

  applyPreset(p) {
    if (!p) return;
    const patch = p.design ? clone(p.design) : p;
    this.design = this.normalizeDesign(patch);
    if (p.env) Object.assign(this.env, p.env);
    this.selected = 'rocket';
    this.clearSim(true);
    this.recalc();
    if (this.containers) {
      this.renderLeft(this.containers.left);
      this.renderRight(this.containers.right);
      this.renderExtra();
      this.updateRight();
      this.draw();
      this.syncTabs();
    }
  }

  getStateForMission() {
    const a = this.result;
    const s = this.sim;
    return {
      stabilityCal: a.stabilityCal,
      maxAltM: s ? s.maxAltM : 0,
      landedOk: s ? !!s.landedOk : false,
      touchdownSpeed: s ? s.touchdownSpeedMs : 0,
      flightStatusText: s ? s.statusText : 'Симуляция не запущена',
      maxMach: s ? s.maxMach : 0,
      maxSpeedMs: s ? s.maxSpeedMs : 0,
      maxAccelG: s ? s.maxAccelG : 0,
      railExitSpeedMs: s ? s.railExitSpeedMs : 0,
      driftM: s ? s.driftM : 0,
      flightTimeSec: s ? s.flightTimeSec : 0,
      chuteRipped: s ? !!s.chuteRipped : false,
      aborted: s ? !!s.aborted : false,
      simRan: !!s,
      twRatio: a.twRatio,
      cdTotal: a.cdTotal,
      totalMassKg: a.totalMassKg,
      twoStage: !!this.design.twoStage,
      deployMode: this.design.deployMode,
      motorClass: a.motor2 ? a.motor2.motorClass : '—',
      importedEng: String(this.design.motorId || '').startsWith('eng_'),
      surfaceFinish: this.design.surfaceFinish,
      motorImpulseNs: a.motor2 ? a.motor2.totalImp : 0
    };
  }

  exportState() {
    return { design: clone(this.design), env: clone(this.env), view: this.view };
  }

  importState(data) {
    if (!data) return;
    if (data.design) this.design = this.normalizeDesign(data.design);
    if (data.env) Object.assign(this.env, data.env);
    this.clearSim(true);
    this.recalc();
    if (this.containers) {
      this.renderLeft(this.containers.left);
      this.renderRight(this.containers.right);
      this.renderExtra();
      this.updateRight();
      this.draw();
      this.syncTabs();
    }
  }

  /* ================= Импорт / экспорт файлов ================= */

  importEng(text, name) {
    try {
      const motor = parseRaspEng(text);
      this.design.motorId = motor.id;
      this.recalc();
      this.clearSim(true);
      this.selected = 'motor';
      this.pushLog(`Импортирован двигатель ${motor.name} из «${name}»`, 'ok');
      if (this.containers) {
        this.renderLeft(this.containers.left);
        this.renderRight(this.containers.right);
        this.updateRight();
        this.renderExtra();
        this.draw();
        this.syncTabs();
      }
    } catch (err) {
      this.pushLog(`Ошибка чтения .eng: ${err.message}`, 'err');
      this.refreshLog();
    }
  }

  download(filename, text, mime) {
    const blob = new Blob([text], { type: mime || 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
  }

  exportOrk() {
    const payload = {
      format: 'cosmolab-openrocket',
      version: 2,
      savedAt: new Date().toISOString(),
      design: clone(this.design),
      environment: clone(this.env),
      analysis: {
        totalMassG: this.result.totalMassKg * 1000,
        totalLenMm: this.result.totalLenMm,
        caliberMm: this.result.caliberMm,
        cgMm: this.result.cgMm,
        cpMm: this.result.cpMm,
        stabilityCal: this.result.stabilityCal,
        cdFriction: this.result.cdFriction,
        cdPressure: this.result.cdPressure,
        cdBase: this.result.cdBase,
        cdTotal: this.result.cdTotal,
        components: this.result.components
      },
      lastFlight: this.sim
        ? {
            maxAltM: this.sim.maxAltM,
            maxSpeedMs: this.sim.maxSpeedMs,
            maxMach: this.sim.maxMach,
            maxAccelG: this.sim.maxAccelG,
            railExitSpeedMs: this.sim.railExitSpeedMs,
            touchdownSpeedMs: this.sim.touchdownSpeedMs,
            flightTimeSec: this.sim.flightTimeSec,
            driftM: this.sim.driftM,
            landedOk: this.sim.landedOk,
            statusText: this.sim.statusText
          }
        : null
    };
    this.download('rocket.ork.json', JSON.stringify(payload, null, 2), 'application/json');
    this.pushLog('Экспорт проекта: rocket.ork.json', 'ok');
  }

  exportAnalysisCsv() {
    const rows = [['Компонент', 'ID', 'X от носка, мм', 'Длина, мм', 'Масса, г'].join(';')];
    this.result.components.forEach((c) => {
      rows.push([c.name, c.id, c.xMm.toFixed(1), c.lenMm.toFixed(1), c.massG.toFixed(2)].join(';'));
    });
    rows.push(
      ['ИТОГО', '', 'ЦМ ' + this.result.cgMm.toFixed(1), 'ЦД ' + this.result.cpMm.toFixed(1), this.result.totalMassKg * 1000].join(';')
    );
    rows.push(['Cd трение', this.result.cdFriction.toFixed(4)].join(';'));
    rows.push(['Cd давление/волновое', this.result.cdPressure.toFixed(4)].join(';'));
    rows.push(['Cd донное', this.result.cdBase.toFixed(4)].join(';'));
    rows.push(['Cd суммарный', this.result.cdTotal.toFixed(4)].join(';'));
    rows.push(['Запас устойчивости, кал', this.result.stabilityCal.toFixed(3)].join(';'));
    this.download('rocket-analysis.csv', '\uFEFF' + rows.join('\r\n'), 'text/csv;charset=utf-8');
    this.pushLog('Экспорт анализа: rocket-analysis.csv', 'ok');
  }

  exportFlightCsv() {
    if (!this.sim || !this.sim.series.length) {
      this.pushLog('Нет данных полёта — сначала запустите симуляцию.', 'err');
      return;
    }
    const head = ['t,с', 'x,м', 'высота,м', 'vx,м/с', 'v,м/с', 'Мах', 'перегрузка,g', 'тяга,Н', 'сопротивление,Н', 'Cd', 'запас,кал', 'давление,гПа'].join(';');
    const rows = [head];
    this.sim.series.forEach((s) => {
      rows.push(
        [s.t, s.x, s.y, s.vy, s.v, s.mach, s.accelG, s.thrustN, s.dragN, s.cd, s.stab, s.pressureHpa]
          .map((v) => (typeof v === 'number' ? v.toFixed(3) : v))
          .join(';')
      );
    });
    this.download('rocket-flight.csv', '\uFEFF' + rows.join('\r\n'), 'text/csv;charset=utf-8');
    this.pushLog('Экспорт телеметрии: rocket-flight.csv', 'ok');
  }

  /* ================= Симуляция полёта ================= */

  clearSim(silent) {
    this.sim = null;
    this.playT = 0;
    this.playing = false;
    this.scopeCursor = 0;
    this.logs = [];
    if (this.scope) this.scope.clear();
    if (!silent && this.containers) {
      this.updateRight();
      this.renderExtra();
      this.draw();
    }
  }

  runSim() {
    this.recalc();
    const sim = simulateOpenRocket(clone(this.design), clone(this.env));
    this.sim = sim;
    this.playT = 0;
    this.scopeCursor = 0;
    this.playing = !sim.aborted;
    this.logs = [];
    if (this.scope) this.scope.clear();
    if (sim.aborted) {
      this.pushLog('СТОП: ' + sim.statusText, 'err');
    } else {
      this.pushLog(`Расчёт ЦМ/ЦД: ${this.result.stabilityCal.toFixed(2)} кал., Cd₀ ${this.result.cdTotal.toFixed(3)}`);
      sim.events.forEach((e) => this.pushLog(e.label, e.type === 'err' ? 'err' : e.type === 'ok' ? 'ok' : ''));
    }
    this.view = 'flight';
    if (this.containers) {
      this.syncTabs();
      this.updateRight();
      this.renderExtra();
      this.draw();
    }
  }

  syncTabs() {
    const center = this.containers?.center;
    if (!center) return;
    center.querySelectorAll('[data-view]').forEach((b) => b.classList.toggle('active', b.dataset.view === this.view));
    const extra = center.querySelector('#rk-extra');
    if (extra) extra.style.display = this.view === 'side' || this.view === 'flight' || this.view === 'plotter' || this.view === 'rear' || this.view === 'tunnel' ? 'block' : 'none';
  }

  /* ================= Центральная область: виды и канвас ================= */

  renderCenter(el) {
    el.innerHTML = `
      <div class="bench-toolbar">
        <div class="segmented">
          ${TABS.map((t) => `<button class="seg-btn ${this.view === t.id ? 'active' : ''}" data-view="${t.id}">${t.label}</button>`).join('')}
        </div>
        <div class="time-controls">
          <button class="btn btn-sm btn-primary" id="rk-run">▶ Симуляция</button>
          <button class="btn btn-sm" id="rk-play">⏸</button>
          <div class="segmented">
            ${[0.25, 0.5, 1, 2, 4].map((s) => `<button class="seg-btn ${this.speedMult === s ? 'active' : ''}" data-speed="${s}">×${s}</button>`).join('')}
          </div>
          <span class="sim-clock" id="rk-clock">t = 0.0 с</span>
        </div>
      </div>

      <div class="canvas-stage">
        <canvas id="rk-canvas"></canvas>
        <div class="canvas-hud" id="rk-hud"></div>
        <div class="canvas-bottom-bar">
          <div class="hud-chip" id="rk-hint" style="font-size:11px;"></div>
          <div class="hud-chip" id="rk-legend" style="font-size:11px;">ЦМ <span style="color:#38bdf8;">●</span> &nbsp; ЦД <span style="color:#ef4444;">●</span></div>
        </div>
      </div>

      <div id="rk-extra" class="rk-extra"></div>
    `;

    this.canvas = el.querySelector('#rk-canvas');
    this.hudEl = el.querySelector('#rk-hud');
    this.clockEl = el.querySelector('#rk-clock');
    this.hintEl = el.querySelector('#rk-hint');
    this.legendEl = el.querySelector('#rk-legend');

    el.querySelectorAll('[data-view]').forEach((b) => {
      b.addEventListener('click', () => {
        this.view = b.dataset.view;
        el.querySelectorAll('[data-view]').forEach((x) => x.classList.toggle('active', x === b));
        this.renderExtra();
        this.draw();
      });
    });

    el.querySelector('#rk-run').addEventListener('click', () => this.runSim());

    el.querySelector('#rk-play').addEventListener('click', () => {
      if (!this.sim || this.sim.aborted) {
        this.runSim();
        return;
      }
      if (!this.playing && this.playT >= this.sim.flightTimeSec - 1e-3) {
        this.playT = 0;
        this.scopeCursor = 0;
        if (this.scope) this.scope.clear();
      }
      this.playing = !this.playing;
      this.syncPlayBtn();
    });

    el.querySelectorAll('[data-speed]').forEach((b) => {
      b.addEventListener('click', () => {
        this.speedMult = Number(b.dataset.speed);
        el.querySelectorAll('[data-speed]').forEach((x) => x.classList.toggle('active', x === b));
      });
    });

    this.canvas.addEventListener('click', (e) => {
      const r = this.canvas.getBoundingClientRect();
      const x = e.clientX - r.left;
      const y = e.clientY - r.top;
      const hit = [...this.hitRegions].reverse().find((hg) => x >= hg.x0 && x <= hg.x1 && y >= hg.y0 && y <= hg.y1);
      if (hit) {
        this.selected = hit.id;
        this.refreshTree();
        this.renderInspector();
        this.draw();
      }
    });

    this.syncPlayBtn();
  }

  syncPlayBtn() {
    const b = this.containers?.center?.querySelector('#rk-play');
    if (!b) return;
    b.textContent = this.playing ? '⏸' : '▶';
    b.className = `btn btn-sm ${this.playing ? 'btn-amber' : ''}`;
  }

  updateClock() {
    if (!this.clockEl) return;
    const t = this.playT;
    this.clockEl.textContent = this.sim
      ? `t = ${t.toFixed(2)} с / ${this.sim.flightTimeSec.toFixed(1)} с`
      : `t = ${t.toFixed(2)} с`;
  }

  renderRight(el) {
    el.innerHTML = `
      <div class="panel-section">
        <div class="section-header">
          <span class="section-title">Анализ OpenRocket</span>
          <span class="tag" id="rk-motor-tag">—</span>
        </div>
        <div class="telemetry-grid">
          <div class="telemetry-card"><span class="telemetry-label">Стартовая масса / длина</span><span class="telemetry-value cyan" id="rk-s-mass">—</span></div>
          <div class="telemetry-card"><span class="telemetry-label">ЦМ / ЦД от носка</span><span class="telemetry-value" id="rk-s-cgcp">—</span></div>
          <div class="telemetry-card"><span class="telemetry-label">Запас устойчивости</span><span class="telemetry-value green" id="rk-s-stab">—</span></div>
          <div class="telemetry-card"><span class="telemetry-label">Cd₀ при M</span><span class="telemetry-value violet" id="rk-s-cd">—</span></div>
          <div class="telemetry-card"><span class="telemetry-label">Тяговооружённость</span><span class="telemetry-value amber" id="rk-s-tw">—</span></div>
          <div class="telemetry-card"><span class="telemetry-label">Класс МРД / импульс</span><span class="telemetry-value" id="rk-s-imp">—</span></div>
        </div>
        <div style="margin-top:8px;">
          <div class="control-label"><span style="font-size:10px;">Шкала запаса (0…6 кал.)</span><span class="control-val" id="rk-stab-lbl">—</span></div>
          <div class="meter-bar" style="height:9px;"><div class="meter-fill" id="rk-stab-bar" style="width:0%;background:var(--green);"></div></div>
        </div>
      </div>

      <div class="panel-section">
        <div class="section-header"><span class="section-title">Составляющие сопротивления</span></div>
        <div id="rk-drag"></div>
      </div>

      <div class="panel-section">
        <div class="section-header">
          <span class="section-title">Предупреждения</span>
          <span class="tag" id="rk-warn-count">0</span>
        </div>
        <div id="rk-warn" class="rk-warn"></div>
      </div>

      <div class="panel-section">
        <div class="section-header">
          <span class="section-title">Результаты полёта</span>
          <span class="tag" id="rk-status-tag">нет расчёта</span>
        </div>
        <div class="telemetry-grid">
          <div class="telemetry-card"><span class="telemetry-label">Апогей</span><span class="telemetry-value cyan" id="rk-r-apogee">—</span></div>
          <div class="telemetry-card"><span class="telemetry-label">Макс. скорость</span><span class="telemetry-value amber" id="rk-r-vmax">—</span></div>
          <div class="telemetry-card"><span class="telemetry-label">Число Маха</span><span class="telemetry-value violet" id="rk-r-mach">—</span></div>
          <div class="telemetry-card"><span class="telemetry-label">Перегрузка</span><span class="telemetry-value green" id="rk-r-accel">—</span></div>
          <div class="telemetry-card"><span class="telemetry-label">Сход с направляющей</span><span class="telemetry-value" id="rk-r-rail">—</span></div>
          <div class="telemetry-card"><span class="telemetry-label">Раскрытие купола</span><span class="telemetry-value" id="rk-r-deploy">—</span></div>
          <div class="telemetry-card"><span class="telemetry-label">Касание земли</span><span class="telemetry-value" id="rk-r-touch">—</span></div>
          <div class="telemetry-card"><span class="telemetry-label">Снос по ветру</span><span class="telemetry-value" id="rk-r-drift">—</span></div>
        </div>
        <div class="rk-summary" id="rk-flight-note" style="margin-top:8px;">Симуляция не запущена.</div>
      </div>

      <div class="panel-section">
        <div class="section-header"><span class="section-title">Осциллограф полёта</span></div>
        <div id="rk-scope"></div>
      </div>

      <div class="panel-section">
        <div class="section-header"><span class="section-title">Журнал OpenRocket</span></div>
        <div class="serial-log" id="rk-log" style="height:130px;overflow:auto;font-size:10.5px;"></div>
      </div>
    `;
    this.createScope();
    this.refreshLog();
  }

  createScope() {
    const box = this.containers?.right?.querySelector('#rk-scope');
    if (!box) return;
    this.scope = new TelemetryScope(
      box,
      [
        { key: 'alt', label: 'Высота', unit: 'м', color: '#22d3ee', min: 0, max: 100 },
        { key: 'v', label: 'Скорость', unit: 'м/с', color: '#fbbf24', min: 0, max: 50 },
        { key: 'mach', label: 'Мах', unit: '', color: '#a78bfa', min: 0, max: 0.3 },
        { key: 'accel', label: 'Перегрузка', unit: 'g', color: '#34d399', min: 0, max: 5 }
      ],
      { height: 150, maxSamples: 240 }
    );
  }

  updateRight() {
    const root = this.containers?.right;
    if (!root) return;
    const a = this.result;
    const s = this.sim;
    const d = this.design;
    const set = (id, txt, cls) => {
      const el = root.querySelector('#' + id);
      if (el) {
        el.textContent = txt;
        if (cls) el.className = `telemetry-value ${cls}`;
      }
    };

    set('rk-s-mass', `${(a.totalMassKg * 1000).toFixed(0)} г · ${(a.totalLenMm / 10).toFixed(1)} см`, 'cyan');
    set('rk-s-cgcp', `${a.cgMm.toFixed(0)} / ${a.cpMm.toFixed(0)} мм`);
    set('rk-s-stab', `${a.stabilityCal.toFixed(2)} кал.`, a.stabilityCal >= 1.5 && a.stabilityCal <= 4.5 ? 'green' : a.stabilityCal >= 1 ? 'amber' : 'red');
    set('rk-s-cd', `${this.tunnelMach.toFixed(2)} → ${a.cdTotal.toFixed(3)}`, 'violet');
    set('rk-s-tw', `${a.twRatio.toFixed(2)} : 1`, a.twRatio >= 3 ? 'green' : a.twRatio >= 1.25 ? 'amber' : 'red');
    set('rk-s-imp', `${a.motor2.motorClass} · ${a.motor2.totalImp.toFixed(0)} Н·с`);
    const tag = root.querySelector('#rk-motor-tag');
    if (tag) tag.textContent = d.twoStage ? '2 ступени' : '1 ступень';

    const stabBar = root.querySelector('#rk-stab-bar');
    if (stabBar) {
      const pct = Math.max(0, Math.min(100, (a.stabilityCal / 6) * 100));
      stabBar.style.width = `${pct}%`;
      stabBar.style.background = a.stabilityCal >= 1.5 && a.stabilityCal <= 4.5 ? 'var(--green)' : a.stabilityCal >= 1 ? 'var(--amber)' : 'var(--red)';
    }
    const stabLbl = root.querySelector('#rk-stab-lbl');
    if (stabLbl) stabLbl.textContent = `${a.stabilityCal.toFixed(2)} кал. (${a.stabilityPct.toFixed(1)} % длины)`;

    // Drag breakdown
    const dragEl = root.querySelector('#rk-drag');
    if (dragEl) {
      const rows = [
        ['Трение (skin friction)', a.cdFriction, '#22d3ee'],
        ['Давление + волновое', a.cdPressure, '#fbbf24'],
        ['Донное (base)', a.cdBase, '#a78bfa']
      ];
      const scaleMax = Math.max(0.02, a.cdTotal);
      dragEl.innerHTML =
        rows
          .map(
            ([label, val, color]) => `<div style="margin-bottom:5px;">
              <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--text-1);">
                <span>${label}</span><span style="font-family:var(--font-mono);color:${color};">${val.toFixed(4)}</span>
              </div>
              <div class="meter-bar" style="height:5px;"><div class="meter-fill" style="width:${Math.min(100, (val / scaleMax) * 100)}%;background:${color};"></div></div>
            </div>`
          )
          .join('') +
        `<div style="display:flex;justify-content:space-between;font-size:11px;margin-top:6px;padding-top:5px;border-top:1px solid var(--border);">
          <span style="color:var(--text-1);">Cd суммарный (S<sub>mid</sub>)</span>
          <span style="font-family:var(--font-mono);font-weight:700;color:var(--text-0);">${a.cdTotal.toFixed(4)}</span>
        </div>
        <div style="font-size:9.5px;color:var(--text-2);margin-top:3px;">S<sub>mid</sub> = ${(a.refArea * 10000).toFixed(1)} см² · удлинение ${(a.totalLenMm / a.caliberMm).toFixed(1)}</div>`;
    }

    // Warnings
    const warnEl = root.querySelector('#rk-warn');
    if (warnEl) {
      const color = { err: '#ef4444', warn: '#fbbf24', ok: '#34d399' };
      warnEl.innerHTML = this.warnings
        .map(
          (wn) => `<div class="rk-warn-row" style="border-left:2px solid ${color[wn.level]};">
            <span style="color:${color[wn.level]};font-weight:700;">${wn.level === 'err' ? '✕' : wn.level === 'warn' ? '!' : '✓'}</span>
            <span>${wn.text}</span>
          </div>`
        )
        .join('');
      const cnt = root.querySelector('#rk-warn-count');
      if (cnt) cnt.textContent = `${this.warnings.filter((wn) => wn.level !== 'ok').length} / ${this.warnings.length}`;
    }

    // Simulation results
    const stTag = root.querySelector('#rk-status-tag');
    const note = root.querySelector('#rk-flight-note');
    if (!s) {
      ['rk-r-apogee', 'rk-r-vmax', 'rk-r-mach', 'rk-r-accel', 'rk-r-rail', 'rk-r-deploy', 'rk-r-touch', 'rk-r-drift'].forEach((id) => set(id, '—'));
      if (stTag) stTag.textContent = 'нет расчёта';
      if (note) note.textContent = 'Симуляция не запущена. Нажмите «▶ Симуляция» — OpenRocket рассчитает траекторию с ветром и системой спасения.';
    } else if (s.aborted) {
      ['rk-r-apogee', 'rk-r-vmax', 'rk-r-mach', 'rk-r-accel', 'rk-r-rail', 'rk-r-deploy', 'rk-r-touch', 'rk-r-drift'].forEach((id) => set(id, '—'));
      if (stTag) stTag.textContent = 'СТОП';
      if (note) {
        note.innerHTML = `<span style="color:#ef4444;">Пуск отменён: ${s.statusText}</span><br>Увеличьте тягу двигателя или снизьте массу.`;
      }
    } else {
      set('rk-r-apogee', `${s.maxAltM.toFixed(0)} м`, 'cyan');
      set('rk-r-vmax', `${s.maxSpeedMs.toFixed(0)} м/с`, 'amber');
      set('rk-r-mach', `M ${s.maxMach.toFixed(2)}`, 'violet');
      set('rk-r-accel', `${s.maxAccelG.toFixed(1)} g`, 'green');
      set('rk-r-rail', `${s.railExitSpeedMs.toFixed(1)} м/с`);
      set('rk-r-deploy', `${s.deploySpeedMs.toFixed(1)} м/с`);
      set('rk-r-touch', `${s.touchdownSpeedMs.toFixed(1)} м/с`, s.landedOk ? 'green' : 'red');
      set('rk-r-drift', `${s.driftM.toFixed(0)} м`);
      if (stTag) stTag.textContent = s.landedOk ? 'успех' : 'авария';
      if (note) {
        note.innerHTML = `${s.landedOk ? '<span style="color:#34d399;">✓ ' : '<span style="color:#ef4444;">✕ '}${s.statusText}</span> · время полёта ${s.flightTimeSec.toFixed(1)} с${s.chuteRipped ? ' · <span style="color:#ef4444;">обрыв строп</span>' : ''}${s.tumbling ? ' · <span style="color:#ef4444;">кувырок</span>' : ''}`;
      }
    }

    if (this.scope && s && !s.aborted) {
      const ch = this.scope.channels;
      ch[0].max = Math.max(20, s.maxAltM * 1.05);
      ch[1].max = Math.max(15, s.maxSpeedMs * 1.05);
      ch[2].max = Math.max(0.3, s.maxMach * 1.05);
      ch[3].max = Math.max(3, s.maxAccelG * 1.05);
    }

    this.updateClock();
  }

  /* ================= Дополнительная панель под канвасом ================= */

  renderExtra() {
    const el = this.containers?.center?.querySelector('#rk-extra');
    if (!el) return;
    const a = this.result;
    const d = this.design;

    if (this.view === 'side') {
      el.innerHTML = `
        <div class="section-header"><span class="section-title">Массовая сводка (технология OpenRocket)</span><span class="tag">${(a.totalMassKg * 1000).toFixed(0)} г</span></div>
        <table class="ref-table rk-table">
          <thead><tr><th>Компонент</th><th>X от носка</th><th>Длина</th><th>Масса</th></tr></thead>
          <tbody>
            ${a.components
              .map(
                (c) => `<tr data-sel="${c.id}" class="${this.selected === c.id ? 'active' : ''}" style="cursor:pointer;">
                  <td>${c.name}</td>
                  <td>${c.xMm.toFixed(0)} мм</td>
                  <td>${c.lenMm.toFixed(0)} мм</td>
                  <td>${c.massG.toFixed(0)} г</td>
                </tr>`
              )
              .join('')}
            <tr style="font-weight:700;"><td>ИТОГО</td><td>ЦМ ${a.cgMm.toFixed(0)} мм</td><td>ЦД ${a.cpMm.toFixed(0)} мм</td><td>${(a.totalMassKg * 1000).toFixed(0)} г</td></tr>
          </tbody>
        </table>`;
    } else if (this.view === 'rear') {
      el.innerHTML = `
        <div class="section-header"><span class="section-title">Кривая тяги МРД F(t)</span><span class="tag">${d.twoStage ? '2 ступени' : '1 ступень'}</span></div>
        <div class="rk-extra-canvas-wrap"><canvas id="rk-x-canvas"></canvas></div>`;
    } else if (this.view === 'tunnel') {
      el.innerHTML = `
        <div class="rk-tunnel-controls">
          <div style="flex:1;">
            <label class="control-label"><span style="font-size:10px;">Число Маха в потоке</span><span class="control-val" id="rk-mach-lbl">${this.tunnelMach.toFixed(2)}</span></label>
            <input type="range" id="rk-mach" min="0.05" max="2.6" step="0.05" value="${this.tunnelMach}">
          </div>
          <div style="flex:1;">
            <label class="control-label"><span style="font-size:10px;">Угол атаки α</span><span class="control-val" id="rk-aoa-lbl">${this.aoaDeg}°</span></label>
            <input type="range" id="rk-aoa" min="0" max="12" step="1" value="${this.aoaDeg}">
          </div>
        </div>
        <div class="rk-extra-canvas-wrap" style="height:120px;"><canvas id="rk-x-canvas"></canvas></div>`;
    } else if (this.view === 'plotter') {
      el.innerHTML = this.comparisonTableHTML();
    } else {
      const sim = this.sim;
      if (!sim) {
        el.innerHTML = `<div class="rk-summary">События полёта появятся после расчёта симуляции (старт, сход с направляющей, выгорание, апогей, выброс купола, посадка).</div>`;
      } else {
        const col = (t) => (t === 'err' ? '#ef4444' : t === 'ok' ? '#34d399' : '#94a3b8');
        el.innerHTML = `
          <div class="section-header"><span class="section-title">Дискретные события полёта</span><span class="tag">${sim.events.length}</span></div>
          <div class="rk-events">
            ${sim.events
              .map(
                (e) => `<div style="border-left-color:${col(e.type)};"><b style="color:${col(e.type)};">${e.t.toFixed(2)} с</b> · ${e.label}</div>`
              )
              .join('') || '<div>—</div>'}
          </div>`;
      }
    }

    this.bindExtra();
    this.drawExtra();
  }

  comparisonTableHTML() {
    const rows = Object.entries(ROCKET_PRESETS).map(([key, p]) => {
      if (!this.presetCache[key]) {
        try {
          const sim = simulateOpenRocket(clone(p.design), clone(this.env));
          const a = analyzeRocketOpenRocket(clone(p.design), { mach: 0.3 });
          this.presetCache[key] = { sim, stab: a.stabilityCal, mass: a.totalMassKg };
        } catch (e) {
          this.presetCache[key] = null;
        }
      }
      const c = this.presetCache[key];
      const label = PRESET_SHORT[key] || p.label;
      if (!c || !c.sim || c.sim.aborted) {
        return `<tr><td>${label}</td><td colspan="5" style="color:#fbbf24;">отмена пуска (T/W < 1.25)</td></tr>`;
      }
      return `<tr>
        <td>${label}</td>
        <td>${c.sim.maxAltM.toFixed(0)} м</td>
        <td>${c.sim.maxSpeedMs.toFixed(0)} м/с</td>
        <td>M ${c.sim.maxMach.toFixed(2)}</td>
        <td>${c.stab.toFixed(2)} кал.</td>
        <td style="color:${c.sim.landedOk ? '#34d399' : '#ef4444'};">${c.sim.landedOk ? 'мягкая' : 'авария'}</td>
      </tr>`;
    });

    const cur = this.sim && !this.sim.aborted
      ? `<tr style="background:rgba(56,189,248,0.12);font-weight:700;">
          <td>Текущий проект</td>
          <td>${this.sim.maxAltM.toFixed(0)} м</td>
          <td>${this.sim.maxSpeedMs.toFixed(0)} м/с</td>
          <td>M ${this.sim.maxMach.toFixed(2)}</td>
          <td>${this.result.stabilityCal.toFixed(2)} кал.</td>
          <td style="color:${this.sim.landedOk ? '#34d399' : '#ef4444'};">${this.sim.landedOk ? 'мягкая' : 'авария'}</td>
        </tr>`
      : `<tr style="color:var(--text-2);"><td>Текущий проект</td><td colspan="5">запустите симуляцию для сравнения</td></tr>`;

    return `
      <div class="section-header"><span class="section-title">Сравнение симуляций (Flight Simulations)</span></div>
      <table class="ref-table rk-table">
        <thead><tr><th>Конфигурация</th><th>Апогей</th><th>Vмакс</th><th>Мах</th><th>Запас</th><th>Посадка</th></tr></thead>
        <tbody>${rows.join('')}${cur}</tbody>
      </table>`;
  }

  bindExtra() {
    const el = this.containers?.center?.querySelector('#rk-extra');
    if (!el) return;
    el.querySelectorAll('[data-sel]').forEach((row) => {
      row.addEventListener('click', () => {
        this.selected = row.dataset.sel;
        this.refreshTree();
        this.renderInspector();
        this.renderExtra();
        this.draw();
      });
    });
    const mach = el.querySelector('#rk-mach');
    if (mach) {
      mach.addEventListener('input', () => {
        this.tunnelMach = Number(mach.value);
        const lbl = el.querySelector('#rk-mach-lbl');
        if (lbl) lbl.textContent = this.tunnelMach.toFixed(2);
        this.recalc();
        this.updateRight();
        this.draw();
      });
    }
    const aoa = el.querySelector('#rk-aoa');
    if (aoa) {
      aoa.addEventListener('input', () => {
        this.aoaDeg = Number(aoa.value);
        const lbl = el.querySelector('#rk-aoa-lbl');
        if (lbl) lbl.textContent = `${this.aoaDeg}°`;
        this.draw();
      });
    }
  }

  /* ================= Отрисовка канваса ================= */

  prepareCanvas(cv) {
    const dpr = window.devicePixelRatio || 1;
    const rect = cv.getBoundingClientRect();
    const w = Math.max(260, rect.width);
    const h = Math.max(200, rect.height);
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
    }
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    return { ctx, w, h };
  }

  drawGrid(ctx, w, h) {
    ctx.fillStyle = 'rgba(148,163,184,0.07)';
    for (let x = 12; x < w; x += 24) {
      for (let y = 12; y < h; y += 24) {
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }

  draw() {
    if (!this.canvas) return;
    const { ctx, w, h } = this.prepareCanvas(this.canvas);
    this.drawGrid(ctx, w, h);
    this.hitRegions = [];
    if (this.view === 'side') this.drawSide(ctx, w, h);
    else if (this.view === 'rear') this.drawRear(ctx, w, h);
    else if (this.view === 'tunnel') this.drawTunnel(ctx, w, h);
    else if (this.view === 'plotter') this.drawPlotter(ctx, w, h);
    else this.drawFlight(ctx, w, h);
    this.updateHud();
    this.drawExtra();
  }

  updateHud() {
    if (!this.hudEl) return;
    const a = this.result;
    const chips = [
      `Проект: ${(a.totalLenMm / 10).toFixed(1)} см · Ø${a.caliberMm.toFixed(0)} мм · ${(a.totalMassKg * 1000).toFixed(0)} г`,
      `ЦМ ${a.cgMm.toFixed(0)} мм · ЦД ${a.cpMm.toFixed(0)} мм · ${a.stabilityCal.toFixed(2)} кал.`
    ];
    if (this.view === 'tunnel') chips.push(`M = ${this.tunnelMach.toFixed(2)} · α = ${this.aoaDeg}° · Cd = ${a.cdTotal.toFixed(3)}`);
    if (this.sim && this.view === 'flight' && !this.sim.aborted) {
      const s = this.sampleAt(this.playT);
      if (s) chips.push(`t = ${this.playT.toFixed(2)} с · H = ${s.y.toFixed(0)} м · V = ${s.v.toFixed(0)} м/с · M ${s.mach.toFixed(2)}`);
    }
    this.hudEl.innerHTML = chips.map((c) => `<div class="hud-chip">${c}</div>`).join('');

    const hints = {
      side: 'Щёлкните по компоненту на чертеже или в дереве — откроется инспектор. Δ = ЦД − ЦМ.',
      rear: 'Вид сзади: размах и количество стабилизаторов, габарит двигателя в корпусе.',
      tunnel: 'Меняйте Мах и угол атаки — следите за ростом волнового сопротивления.',
      plotter: 'Сравните пресеты по апогею/скорости и оптимизируйте свой проект.',
      flight: '▶/⏸ — воспроизведение полёта, ×0.25…×4 — скорость времени.'
    };
    if (this.hintEl) this.hintEl.textContent = hints[this.view] || '';
    if (this.legendEl) {
      this.legendEl.innerHTML =
        this.view === 'plotter'
          ? '<span style="color:#22d3ee;">— высота</span> <span style="color:#fbbf24;">— скорость</span> <span style="color:#a78bfa;">— Мах</span> <span style="color:#34d399;">— перегрузка</span>'
          : 'ЦМ <span style="color:#38bdf8;">●</span> &nbsp; ЦД <span style="color:#ef4444;">●</span>';
    }
  }

  noseProfile(u) {
    const s = this.design.noseShape;
    const cl = (v) => Math.max(0, Math.min(1, v));
    switch (s) {
      case 'cone':
        return cl(u);
      case 'parabolic':
        return cl(Math.pow(u, 0.72));
      case 'ogive':
        return cl(Math.sqrt(1 - Math.pow(1 - u, 2)));
      case 'haack':
        return cl(Math.pow(1 - Math.pow(1 - u, 1.7), 0.62));
      case 'ellipsoid':
        return cl(Math.sqrt(1 - Math.pow(1 - u, 2.8)));
      case 'blunt':
        return cl(Math.min(1, Math.pow(u * 3.2, 0.42)));
      default:
        return cl(u);
    }
  }

  drawHull(ctx, X, Y, sc, opts = {}) {
    const a = this.result;
    const d = this.design;
    const Ln = a.noseLenMm;
    const Lb = a.bodyLenMm;
    const Ltail = a.tailLenMm;
    const Lboost = a.boosterLenMm;
    const halfCal = a.caliberMm / 2;
    const fillStyle = opts.fill || 'rgba(56,189,248,0.15)';
    const strokeStyle = opts.stroke || '#38bdf8';

    ctx.save();
    ctx.lineJoin = 'round';

    // Нос
    ctx.beginPath();
    ctx.moveTo(X(0), Y(0));
    for (let i = 1; i <= 32; i++) {
      const u = i / 32;
      ctx.lineTo(X(Ln * u), Y(this.noseProfile(u) * halfCal));
    }
    for (let i = 31; i >= 0; i--) {
      const u = i / 32;
      ctx.lineTo(X(Ln * u), Y(-this.noseProfile(u) * halfCal));
    }
    ctx.closePath();
    ctx.fillStyle = 'rgba(125,211,252,0.20)';
    ctx.fill();
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = 1.6;
    ctx.stroke();

    // Корпус
    ctx.beginPath();
    ctx.rect(X(Ln), Y(halfCal), X(Ln + Lb) - X(Ln), Y(-halfCal) - Y(halfCal));
    ctx.fillStyle = fillStyle;
    ctx.fill();
    ctx.stroke();

    // Boat-Tail
    if (Ltail > 0.5) {
      const raft = a.aftDiaMm / 2;
      ctx.beginPath();
      ctx.moveTo(X(Ln + Lb), Y(halfCal));
      ctx.lineTo(X(Ln + Lb + Ltail), Y(raft));
      ctx.lineTo(X(Ln + Lb + Ltail), Y(-raft));
      ctx.lineTo(X(Ln + Lb), Y(-halfCal));
      ctx.closePath();
      ctx.fillStyle = 'rgba(56,189,248,0.12)';
      ctx.fill();
      ctx.stroke();
    }

    // Бустер
    if (Lboost > 0.5) {
      const xb = Ln + Lb;
      ctx.beginPath();
      ctx.rect(X(xb), Y(halfCal), X(xb + Lboost) - X(xb), Y(-halfCal) - Y(halfCal));
      ctx.fillStyle = 'rgba(167,139,250,0.16)';
      ctx.fill();
      ctx.strokeStyle = '#a78bfa';
      ctx.stroke();
      ctx.strokeStyle = 'rgba(167,139,250,0.55)';
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(X(xb), Y(halfCal));
      ctx.lineTo(X(xb), Y(-halfCal));
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#a78bfa';
      ctx.font = '9.5px ui-monospace, monospace';
      ctx.fillText('Ступень 1', X(xb) + 4, Y(halfCal) - 5);
    }

    // Стабилизаторы
    const finSet = (xLead, rootMm, tipMm, spanMm, sweepMm, color) => {
      [1, -1].forEach((dir) => {
        const xA = X(xLead);
        const xB = X(xLead + sweepMm);
        const xC = X(xLead + sweepMm + tipMm);
        const xD = X(xLead + rootMm);
        const yRoot = Y(dir * halfCal);
        const yTip = Y(dir * (halfCal + spanMm));
        ctx.beginPath();
        ctx.moveTo(xA, yRoot);
        ctx.lineTo(xB, yTip);
        ctx.lineTo(xC, yTip);
        ctx.lineTo(xD, yRoot);
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = strokeStyle;
        ctx.lineWidth = 1.3;
        ctx.stroke();
      });
    };

    const rootMm = d.finRootMm;
    finSet(Ln + Lb - rootMm - 8, rootMm, d.finTipMm, d.finSpanMm, d.finSweepMm, 'rgba(56,189,248,0.28)');
    if (Lboost > 0.5) {
      const xb = Ln + Lb;
      finSet(xb + Lboost - rootMm * 1.12 - 6, rootMm * 1.12, d.finTipMm * 1.1, d.boosterFinSpanMm, d.finSweepMm * 1.05, 'rgba(167,139,250,0.28)');
    }

    // Внутренние элементы
    const inner = (id, color, radFrac) => {
      const c = a.components.find((x) => x.id === id);
      if (!c) return;
      const yTop = Y(halfCal * radFrac);
      ctx.beginPath();
      ctx.rect(X(c.xMm), yTop, Math.max(2, X(c.xMm + c.lenMm) - X(c.xMm)), Math.max(2, Y(-halfCal * radFrac) - yTop));
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = 'rgba(226,232,240,0.35)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.stroke();
      ctx.setLineDash([]);
    };
    inner('motor', 'rgba(251,191,36,0.30)', 0.62);
    inner('payload', 'rgba(52,211,153,0.22)', 0.7);
    inner('recovery', 'rgba(244,114,182,0.18)', 0.55);
    inner('ballast', 'rgba(148,163,184,0.35)', 0.5);

    ctx.restore();
  }

  drawSide(ctx, w, h) {
    const a = this.result;
    const d = this.design;
    const L = a.totalLenMm;
    const finReach = a.caliberMm / 2 + Math.max(d.finSpanMm, d.twoStage ? d.boosterFinSpanMm : 0);
    const maxRad = Math.max(a.caliberMm / 2, finReach);
    const padL = 62;
    const padR = 52;
    const padT = 58;
    const padB = 66;
    const sc = Math.min((w - padL - padR) / L, (h - padT - padB) / (maxRad * 2));
    const x0 = padL;
    const cy = padT + (h - padT - padB) / 2;
    const X = (mm) => x0 + mm * sc;
    const Y = (mm) => cy - mm * sc;
    const R = (a.caliberMm / 2) * sc;

    // Осевая линия
    ctx.strokeStyle = 'rgba(148,163,184,0.30)';
    ctx.setLineDash([6, 5]);
    ctx.beginPath();
    ctx.moveTo(X(-12) - 8, cy);
    ctx.lineTo(X(L) + 18, cy);
    ctx.stroke();
    ctx.setLineDash([]);

    this.drawHull(ctx, X, Y, sc);

    // Область выделения + хит-регионы компонентов
    a.components.forEach((c) => {
      let yTop = Y(a.caliberMm / 2);
      let yBot = Y(-a.caliberMm / 2);
      if (c.id === 'fins') {
        yTop = Y(a.caliberMm / 2 + d.finSpanMm);
        yBot = Y(-(a.caliberMm / 2 + d.finSpanMm));
      } else if (c.id === 'booster_fins') {
        yTop = Y(a.caliberMm / 2 + d.boosterFinSpanMm);
        yBot = Y(-(a.caliberMm / 2 + d.boosterFinSpanMm));
      } else if (c.id === 'motor') {
        yTop = Y((a.motor2.diaMm / 2) * 0.62);
        yBot = Y(-(a.motor2.diaMm / 2) * 0.62);
      }
      const px0 = X(c.xMm);
      const px1 = Math.max(px0 + 6, X(c.xMm + c.lenMm));
      this.hitRegions.push({ id: c.id, x0: px0 - 2, x1: px1 + 2, y0: Math.min(yTop, yBot), y1: Math.max(yTop, yBot) });

      if (this.selected === c.id) {
        ctx.fillStyle = 'rgba(251,191,36,0.16)';
        ctx.fillRect(px0 - 2, yTop, px1 - px0 + 4, yBot - yTop);
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 1.2;
        ctx.setLineDash([4, 3]);
        ctx.strokeRect(px0 - 2, yTop, px1 - px0 + 4, yBot - yTop);
        ctx.setLineDash([]);
        ctx.fillStyle = '#fbbf24';
        ctx.font = '10px ui-monospace, monospace';
        ctx.fillText(`▸ ${c.name}`, px0, yTop - 5);
      }
    });

    // Маркеры ЦМ и ЦД
    const marker = (mm, color, label) => {
      const x = X(mm);
      const top = Y(maxRad) - 24;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.3;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.moveTo(x, top + 8);
      ctx.lineTo(x, Y(-maxRad) + 12);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(x, top + 2);
      ctx.lineTo(x - 5, top - 6);
      ctx.lineTo(x + 5, top - 6);
      ctx.closePath();
      ctx.fill();
      ctx.font = 'bold 10.5px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(label, x, top - 10);
      ctx.textAlign = 'left';
    };
    marker(a.cgMm, '#38bdf8', 'ЦМ');
    marker(a.cpMm, '#ef4444', 'ЦД');

    // Скобка запаса устойчивости
    const yb = Y(-maxRad) + 24;
    const xa = X(a.cgMm);
    const xb = X(a.cpMm);
    ctx.strokeStyle = 'rgba(226,232,240,0.75)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(xa, yb);
    ctx.lineTo(xb, yb);
    ctx.stroke();
    [xa, xb].forEach((x, i) => {
      const dir = i === 0 ? -1 : 1;
      ctx.beginPath();
      ctx.moveTo(x, yb);
      ctx.lineTo(x - dir * 6, yb - 4);
      ctx.lineTo(x - dir * 6, yb + 4);
      ctx.closePath();
      ctx.fillStyle = 'rgba(226,232,240,0.75)';
      ctx.fill();
    });
    ctx.fillStyle = 'rgba(226,232,240,0.9)';
    ctx.font = '10px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`Δ = ${Math.abs(a.cpMm - a.cgMm).toFixed(0)} мм · ${a.stabilityCal.toFixed(2)} кал.`, (xa + xb) / 2, yb + 14);
    ctx.textAlign = 'left';

    // Размеры
    const dimLine = (xA, xB, y, text) => {
      ctx.strokeStyle = 'rgba(148,163,184,0.6)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(xA, y);
      ctx.lineTo(xB, y);
      ctx.moveTo(xA, y - 4);
      ctx.lineTo(xA, y + 4);
      ctx.moveTo(xB, y - 4);
      ctx.lineTo(xB, y + 4);
      ctx.stroke();
      ctx.fillStyle = 'rgba(203,213,225,0.9)';
      ctx.font = '10px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(10,16,28,0.85)';
      const tw = ctx.measureText(text).width + 10;
      ctx.fillRect((xA + xB) / 2 - tw / 2, y - 6, tw, 13);
      ctx.fillStyle = 'rgba(203,213,225,0.95)';
      ctx.fillText(text, (xA + xB) / 2, y + 4);
      ctx.textAlign = 'left';
    };
    dimLine(X(0), X(a.noseLenMm), Y(maxRad) - 8, `нос ${(a.noseLenMm / 10).toFixed(1)} см`);
    dimLine(X(0), X(L), Y(-maxRad) + 44, `L = ${(L / 10).toFixed(1)} см`);

    // Калибр
    ctx.strokeStyle = 'rgba(148,163,184,0.6)';
    ctx.beginPath();
    ctx.moveTo(x0 - 18, Y(a.caliberMm / 2));
    ctx.lineTo(x0 - 18, Y(-a.caliberMm / 2));
    ctx.moveTo(x0 - 22, Y(a.caliberMm / 2));
    ctx.lineTo(x0 - 14, Y(a.caliberMm / 2));
    ctx.moveTo(x0 - 22, Y(-a.caliberMm / 2));
    ctx.lineTo(x0 - 14, Y(-a.caliberMm / 2));
    ctx.stroke();
    ctx.save();
    ctx.translate(x0 - 26, cy);
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = 'rgba(203,213,225,0.9)';
    ctx.font = '10px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`Ø ${a.caliberMm.toFixed(0)} мм`, 0, 0);
    ctx.restore();
  }

  drawRear(ctx, w, h) {
    const a = this.result;
    const d = this.design;
    const cx = w * 0.46;
    const cy = h * 0.47;
    const span = a.caliberMm / 2 + d.finSpanMm;
    const sc = Math.min((w * 0.6) / (span * 2), (h * 0.7) / (span * 2));
    const R = (a.caliberMm / 2) * sc;
    const n = d.finCount;

    // Стабилизаторы по кругу
    for (let i = 0; i < n; i++) {
      const ang = -Math.PI / 2 + (i * 2 * Math.PI) / n;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(ang);
      const rootW = Math.max(3, (d.finRootMm * 0.2) * sc);
      const tipW = Math.max(2, (d.finTipMm * 0.2) * sc);
      ctx.beginPath();
      ctx.moveTo(-rootW, R * 0.96);
      ctx.lineTo(-tipW, R + d.finSpanMm * sc);
      ctx.lineTo(tipW, R + d.finSpanMm * sc);
      ctx.lineTo(rootW, R * 0.96);
      ctx.closePath();
      ctx.fillStyle = i % 2 === 0 ? 'rgba(56,189,248,0.34)' : 'rgba(56,189,248,0.22)';
      ctx.fill();
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.3;
      ctx.stroke();
      ctx.restore();
    }

    // Корпус
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(8,47,73,0.85)';
    ctx.fill();
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, Math.max(2, R - 3.5), 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(125,211,252,0.45)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Двигатель
    const mr = Math.max(3, (a.motor2.diaMm / 2) * sc);
    ctx.beginPath();
    ctx.arc(cx, cy, mr, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(251,191,36,0.30)';
    ctx.fill();
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    if (d.hasCanSat) {
      ctx.beginPath();
      ctx.arc(cx, cy, mr * 0.55, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(52,211,153,0.45)';
      ctx.fill();
    }

    // Осевые штрихи
    ctx.strokeStyle = 'rgba(148,163,184,0.25)';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(cx - R - 34, cy);
    ctx.lineTo(cx + R + 34, cy);
    ctx.moveTo(cx, cy - R - 34);
    ctx.lineTo(cx, cy + R + 34);
    ctx.stroke();
    ctx.setLineDash([]);

    // Размеры
    ctx.strokeStyle = 'rgba(148,163,184,0.6)';
    ctx.beginPath();
    ctx.moveTo(cx - R, cy + R + 22);
    ctx.lineTo(cx + R, cy + R + 22);
    ctx.moveTo(cx - R, cy + R + 18);
    ctx.lineTo(cx - R, cy + R + 26);
    ctx.moveTo(cx + R, cy + R + 18);
    ctx.lineTo(cx + R, cy + R + 26);
    ctx.stroke();
    ctx.fillStyle = 'rgba(203,213,225,0.9)';
    ctx.font = '10px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`Ø ${a.caliberMm.toFixed(0)} мм`, cx, cy + R + 37);

    const spanPx = (a.caliberMm / 2 + d.finSpanMm) * sc;
    ctx.beginPath();
    ctx.moveTo(cx + spanPx + 16, cy - spanPx);
    ctx.lineTo(cx + spanPx + 16, cy + spanPx);
    ctx.moveTo(cx + spanPx + 12, cy - spanPx);
    ctx.lineTo(cx + spanPx + 20, cy - spanPx);
    ctx.moveTo(cx + spanPx + 12, cy + spanPx);
    ctx.lineTo(cx + spanPx + 20, cy + spanPx);
    ctx.stroke();
    ctx.save();
    ctx.translate(cx + spanPx + 30, cy);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(`размах ${a.caliberMm + 2 * d.finSpanMm} мм`, 0, 0);
    ctx.restore();
    ctx.textAlign = 'left';

    // Подписи
    ctx.fillStyle = '#94a3b8';
    ctx.font = '11px ui-sans-serif, system-ui, sans-serif';
    ctx.fillText(`Стабилизаторов: ${n} · профиль: ${OR_FIN_PROFILES[d.finProfile].name}`, 14, 18);
    ctx.fillText(`МРД Ø${a.motor2.diaMm} мм внутри корпуса Ø${a.caliberMm.toFixed(0)} мм`, 14, 34);
  }

  drawTunnel(ctx, w, h) {
    const a = this.result;
    const d = this.design;
    const L = a.totalLenMm;
    const finReach = a.caliberMm / 2 + d.finSpanMm;
    const maxRad = Math.max(a.caliberMm / 2, finReach);
    const padX = 66;
    const sc = Math.min((w - padX * 2) / L, (h - 90) / (maxRad * 2.4));
    const x0 = padX;
    const cy = h * 0.48;
    const X = (mm) => x0 + mm * sc;
    const Y = (mm) => cy - mm * sc;
    const R = (a.caliberMm / 2) * sc;

    // Линии тока
    const lanes = Math.max(8, Math.floor(h / 26));
    for (let i = 0; i < lanes; i++) {
      const baseY = 18 + ((i + 0.5) * (h - 36)) / lanes;
      const dRad = (baseY - cy) / Math.max(6, R * 2.6);
      ctx.beginPath();
      for (let x = 0; x <= w; x += 5) {
        const rel = (x - x0) / Math.max(1, L * sc);
        const env = rel >= 0 && rel <= 1 ? Math.sin(Math.PI * rel) : 0;
        const defl = -Math.sign(baseY - cy) * env * (R * 0.85) * Math.exp(-Math.abs(dRad) * 0.5);
        ctx.lineTo(x, baseY + defl);
      }
      ctx.strokeStyle = 'rgba(56,189,248,0.20)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Движущиеся маркеры потока
      for (let k = 0; k < 3; k++) {
        const px = ((this.tunnelPhase * 90 + k * (w / 3) + i * 37) % (w + 60)) - 30;
        const rel = (px - x0) / Math.max(1, L * sc);
        const env = rel >= 0 && rel <= 1 ? Math.sin(Math.PI * rel) : 0;
        const defl = -Math.sign(baseY - cy) * env * (R * 0.85) * Math.exp(-Math.abs(dRad) * 0.5);
        ctx.beginPath();
        ctx.arc(px, baseY + defl, 1.9, 0, Math.PI * 2);
        ctx.fillStyle = rel > 0.35 && rel < 0.75 ? 'rgba(251,191,36,0.85)' : 'rgba(125,211,252,0.75)';
        ctx.fill();
      }
    }

    // Ракета под углом атаки
    ctx.save();
    ctx.translate(x0, cy);
    ctx.rotate((-this.aoaDeg * Math.PI) / 180);
    ctx.translate(-x0, -cy);
    this.drawHull(ctx, X, Y, sc, { fill: 'rgba(14,165,233,0.18)' });
    ctx.restore();

    // Вектор скорости и угол атаки
    ctx.strokeStyle = 'rgba(251,191,36,0.9)';
    ctx.lineWidth = 1.6;
    const vx0 = 18;
    const vy0 = cy;
    ctx.beginPath();
    ctx.moveTo(vx0, vy0);
    ctx.lineTo(vx0 + 46, vy0);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(vx0 + 46, vy0);
    ctx.lineTo(vx0 + 38, vy0 - 4);
    ctx.lineTo(vx0 + 38, vy0 + 4);
    ctx.closePath();
    ctx.fillStyle = 'rgba(251,191,36,0.9)';
    ctx.fill();
    ctx.font = '10px ui-monospace, monospace';
    ctx.fillText('V∞', vx0 + 4, vy0 - 7);

    // Заголовок области
    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 11px ui-monospace, monospace';
    ctx.fillText(`M∞ = ${this.tunnelMach.toFixed(2)}   α = ${this.aoaDeg}°`, 14, 18);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '10.5px ui-sans-serif, system-ui, sans-serif';
    ctx.fillText(`Cd = ${a.cdTotal.toFixed(4)} · Re-режим: ${this.tunnelMach < 0.8 ? 'дозвуковой' : this.tunnelMach < 1.2 ? 'трансзвуковой' : 'сверхзвуковой'}`, 14, 34);
  }

  drawPlotter(ctx, w, h) {
    const sim = this.sim;
    const padL = 56;
    const padR = 56;
    const padT = 34;
    const padB = 34;

    if (!sim || !sim.series || sim.series.length < 2) {
      ctx.fillStyle = '#94a3b8';
      ctx.font = '13px ui-sans-serif, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Нет данных для плоттера', w / 2, h / 2 - 10);
      ctx.fillStyle = '#64748b';
      ctx.font = '11px ui-sans-serif, system-ui, sans-serif';
      ctx.fillText('Нажмите «▶ Симуляция», затем вернитесь на вкладку «Плоттер»', w / 2, h / 2 + 12);
      ctx.textAlign = 'left';
      return;
    }

    const series = sim.series;
    const tMax = Math.max(1, series[series.length - 1].t);
    const altMax = Math.max(20, sim.maxAltM * 1.08);
    const vMax = Math.max(15, sim.maxSpeedMs * 1.08);
    const machMax = Math.max(0.3, sim.maxMach * 1.1);
    const gMax = Math.max(3, sim.maxAccelG * 1.08);
    const plotW = w - padL - padR;
    const plotH = h - padT - padB;
    const X = (t) => padL + (t / tMax) * plotW;
    const Yn = (v) => padT + plotH - v * plotH;

    // Сетка
    ctx.strokeStyle = 'rgba(148,163,184,0.14)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = padT + (plotH / 4) * i;
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(w - padR, y);
      ctx.stroke();
    }
    for (let i = 0; i <= 5; i++) {
      const x = padL + (plotW / 5) * i;
      ctx.beginPath();
      ctx.moveTo(x, padT);
      ctx.lineTo(x, padT + plotH);
      ctx.stroke();
      ctx.fillStyle = '#64748b';
      ctx.font = '9.5px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${((tMax / 5) * i).toFixed(1)}`, x, padT + plotH + 14);
      ctx.textAlign = 'left';
    }

    // Подписи осей
    ctx.fillStyle = '#22d3ee';
    ctx.font = '10px ui-monospace, monospace';
    for (let i = 0; i <= 4; i++) {
      ctx.fillText(`${((altMax / 4) * (4 - i)).toFixed(0)}`, 8, padT + (plotH / 4) * i + 3);
    }
    ctx.fillStyle = '#fbbf24';
    for (let i = 0; i <= 4; i++) {
      ctx.fillText(`${((vMax / 4) * (4 - i)).toFixed(0)}`, w - padR + 8, padT + (plotH / 4) * i + 3);
    }
    ctx.fillStyle = '#64748b';
    ctx.font = '10px ui-sans-serif, system-ui, sans-serif';
    ctx.fillText('Высота, м', 6, padT - 8);
    ctx.fillStyle = '#fbbf24';
    ctx.fillText('V, м/с', w - padR + 6, padT - 8);
    ctx.fillStyle = '#64748b';
    ctx.textAlign = 'right';
    ctx.fillText('время, с', w - padR, h - 8);
    ctx.textAlign = 'left';

    const curve = (key, scale, color, dash) => {
      ctx.beginPath();
      series.forEach((s, i) => {
        const x = X(s.t);
        const y = Yn(Math.max(0, Math.min(1, s[key] / scale)));
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.8;
      if (dash) ctx.setLineDash(dash);
      ctx.stroke();
      ctx.setLineDash([]);
    };
    curve('y', altMax, '#22d3ee');
    curve('v', vMax, '#fbbf24');
    curve('mach', machMax, '#a78bfa', [5, 3]);
    curve('accelG', gMax, '#34d399', [2, 3]);

    // Маркер апогея
    const apogeeSample = series.reduce((best, s) => (s.y > (best ? best.y : -1) ? s : best), null);
    if (apogeeSample) {
      ctx.beginPath();
      ctx.arc(X(apogeeSample.t), Yn(Math.min(1, apogeeSample.y / altMax)), 3.5, 0, Math.PI * 2);
      ctx.fillStyle = '#22d3ee';
      ctx.fill();
      ctx.fillStyle = '#22d3ee';
      ctx.font = '9.5px ui-monospace, monospace';
      ctx.fillText(`апогей ${sim.maxAltM.toFixed(0)} м`, X(apogeeSample.t) + 6, Yn(Math.min(1, apogeeSample.y / altMax)) - 6);
    }

    // Линия воспроизведения
    if (this.playT > 0) {
      const px = X(this.playT);
      ctx.strokeStyle = 'rgba(255,255,255,0.55)';
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(px, padT);
      ctx.lineTo(px, padT + plotH);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  drawFlight(ctx, w, h) {
    const sim = this.sim;
    if (!sim) {
      ctx.fillStyle = '#94a3b8';
      ctx.font = '13px ui-sans-serif, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Полёт не рассчитан', w / 2, h / 2 - 10);
      ctx.fillStyle = '#64748b';
      ctx.font = '11px ui-sans-serif, system-ui, sans-serif';
      ctx.fillText('Нажмите «▶ Симуляция» — OpenRocket построит траекторию с ветром, ступенями и парашютами', w / 2, h / 2 + 12);
      ctx.textAlign = 'left';
      return;
    }
    if (sim.aborted) {
      ctx.fillStyle = '#ef4444';
      ctx.font = 'bold 14px ui-sans-serif, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('ПУСК ОТМЕНЁН', w / 2, h / 2 - 8);
      ctx.fillStyle = '#fca5a5';
      ctx.font = '12px ui-sans-serif, system-ui, sans-serif';
      ctx.fillText(sim.statusText, w / 2, h / 2 + 16);
      ctx.textAlign = 'left';
      return;
    }

    const padL = 48;
    const padR = 48;
    const padT = 30;
    const padB = 40;
    const altMax = Math.max(20, sim.maxAltM * 1.12);
    const driftMax = Math.max(25, Math.abs(sim.driftM) * 1.35);
    const plotW = w - padL - padR;
    const plotH = h - padT - padB;
    const X = (x) => padL + ((x + driftMax * 0.15) / (driftMax * 1.3)) * plotW;
    const Y = (y) => h - padB - (y / altMax) * plotH;

    // Земля
    const groundY = h - padB;
    ctx.strokeStyle = 'rgba(52,211,153,0.55)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    ctx.lineTo(w, groundY);
    ctx.stroke();
    ctx.fillStyle = 'rgba(52,211,153,0.10)';
    ctx.fillRect(0, groundY, w, padB);

    // Высотная сетка
    for (let i = 1; i <= 4; i++) {
      const y = Y((altMax / 4) * i);
      ctx.strokeStyle = 'rgba(148,163,184,0.10)';
      ctx.beginPath();
      ctx.moveTo(padL - 10, y);
      ctx.lineTo(w - padR, y);
      ctx.stroke();
      ctx.fillStyle = '#64748b';
      ctx.font = '9.5px ui-monospace, monospace';
      ctx.textAlign = 'right';
      ctx.fillText(`${((altMax / 4) * i).toFixed(0)} м`, padL - 14, y + 3);
      ctx.textAlign = 'left';
    }

    // Пусковой стол и направляющая
    const padX = X(0);
    ctx.strokeStyle = 'rgba(148,163,184,0.75)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(padX + 5, groundY);
    ctx.lineTo(padX + 5, groundY - 34);
    ctx.moveTo(padX - 4, groundY);
    ctx.lineTo(padX - 4, groundY - 30);
    ctx.stroke();

    // Траектория
    const series = sim.series;
    ctx.lineWidth = 2.2;
    let prev = null;
    series.forEach((s) => {
      const x = X(s.x);
      const y = Y(s.y);
      if (prev) {
        const u = Math.min(1, s.mach / Math.max(0.35, sim.maxMach || 1));
        const col = u > 0.95 ? '#ef4444' : u > 0.6 ? '#fbbf24' : u > 0.25 ? '#38bdf8' : '#22d3ee';
        ctx.strokeStyle = col;
        ctx.beginPath();
        ctx.moveTo(prev[0], prev[1]);
        ctx.lineTo(x, y);
        ctx.stroke();
      }
      prev = [x, y];
    });

    // События
    sim.events.forEach((e) => {
      const x = X(e.x ?? 0);
      const y = e.y !== undefined ? Y(e.y) : groundY;
      ctx.beginPath();
      ctx.arc(x, y, 3.2, 0, Math.PI * 2);
      ctx.fillStyle = e.type === 'err' ? '#ef4444' : e.type === 'ok' ? '#34d399' : '#94a3b8';
      ctx.fill();
      ctx.fillStyle = 'rgba(226,232,240,0.85)';
      ctx.font = '9.5px ui-monospace, monospace';
      ctx.fillText(`${e.t.toFixed(1)}с ${e.label}`, x + 7, y - 5);
    });

    // Текущее положение
    const cur = this.sampleAt(this.playT);
    if (cur) {
      const px = X(cur.x);
      const py = Y(cur.y);

      if (cur.mainOpen || cur.chute) {
        const cw = cur.mainOpen ? 16 : 8;
        ctx.strokeStyle = 'rgba(226,232,240,0.7)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px - cw, py - 16);
        ctx.moveTo(px, py);
        ctx.lineTo(px + cw, py - 16);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(px, py - 18, cw, Math.PI, Math.PI * 2);
        ctx.fillStyle = cur.mainOpen ? 'rgba(251,191,36,0.55)' : 'rgba(244,114,182,0.55)';
        ctx.fill();
        ctx.strokeStyle = cur.mainOpen ? '#fbbf24' : '#f472b6';
        ctx.stroke();
      }

      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(cur.pitchRad || 0);
      ctx.fillStyle = '#e2e8f0';
      ctx.beginPath();
      ctx.moveTo(0, -9);
      ctx.lineTo(3.2, 4);
      ctx.lineTo(0, 2);
      ctx.lineTo(-3.2, 4);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(-1.6, 3, 3.2, 5);
      ctx.restore();

      // Стрелка скорости
      const sx = px;
      const sy = py;
      ctx.strokeStyle = 'rgba(251,191,36,0.9)';
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      const vx = (cur.vx || 0) * 1.1;
      const vyv = (cur.vy || 0) * 1.1;
      const norm = Math.hypot(vx, vyv) || 1;
      ctx.lineTo(sx + (vx / norm) * 26, sy - (vyv / norm) * 26);
      ctx.stroke();
    }

    // Подписи
    ctx.fillStyle = '#94a3b8';
    ctx.font = '10.5px ui-sans-serif, system-ui, sans-serif';
    ctx.fillText(`Апогей ${sim.maxAltM.toFixed(0)} м · Vмакс ${sim.maxSpeedMs.toFixed(0)} м/с · M ${sim.maxMach.toFixed(2)}`, 12, 18);
    ctx.fillText(`Снос ${sim.driftM.toFixed(0)} м · время ${sim.flightTimeSec.toFixed(1)} с · ${sim.landedOk ? 'посадка мягкая' : 'авария'}`, 12, 33);
  }

  drawExtra() {
    const el = this.containers?.center?.querySelector('#rk-extra');
    if (!el) return;
    const cv = el.querySelector('#rk-x-canvas');
    if (!cv) return;
    const { ctx, w, h } = this.prepareCanvas(cv);

    if (this.view === 'rear') {
      const a = this.result;
      const m1 = a.includeBooster && a.motor1 ? a.motor1 : null;
      const m2 = a.motor2;
      const tMax = Math.max(m2.burnTime, m1 ? m1.burnTime : 0) * 1.12;
      const fMax = Math.max(
        10,
        ...m2.curve.map((p) => p[1]),
        m1 ? Math.max(...m1.curve.map((p) => p[1])) : 0
      ) * 1.12;
      const padL = 42;
      const padR = 12;
      const padT = 12;
      const padB = 22;
      const plotW = w - padL - padR;
      const plotH = h - padT - padB;
      const X = (t) => padL + (t / tMax) * plotW;
      const Y = (f) => padT + plotH - (f / fMax) * plotH;

      ctx.strokeStyle = 'rgba(148,163,184,0.16)';
      for (let i = 0; i <= 4; i++) {
        const y = padT + (plotH / 4) * i;
        ctx.beginPath();
        ctx.moveTo(padL, y);
        ctx.lineTo(w - padR, y);
        ctx.stroke();
      }
      ctx.fillStyle = '#64748b';
      ctx.font = '9px ui-monospace, monospace';
      for (let i = 0; i <= 4; i++) {
        ctx.textAlign = 'right';
        ctx.fillText(`${((fMax / 4) * (4 - i)).toFixed(0)}`, padL - 4, padT + (plotH / 4) * i + 3);
        ctx.textAlign = 'center';
        ctx.fillText(`${((tMax / 4) * i).toFixed(1)}`, padL + (plotW / 4) * i, h - 6);
        ctx.textAlign = 'left';
      }
      ctx.fillStyle = '#64748b';
      ctx.fillText('F, Н', 6, padT + 4);

      const drawCurve = (motor, color, dash) => {
        if (!motor) return;
        ctx.beginPath();
        for (let i = 0; i <= 160; i++) {
          const t = (motor.burnTime * i) / 160;
          const f = sampleMotorThrust(motor, t);
          const x = X(t);
          const y = Y(f);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.9;
        if (dash) ctx.setLineDash(dash);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = color;
        ctx.font = '9.5px ui-monospace, monospace';
        const fAvg = motor.totalImp / motor.burnTime;
        ctx.fillText(`${motor.motorClass}: ${motor.totalImp.toFixed(0)} Н·с, ${motor.burnTime.toFixed(2)} с, Fср ${fAvg.toFixed(0)} Н`, padL + 6, padT + 12 + (motor === m1 ? 12 : 0));
      };
      drawCurve(m2, '#fbbf24');
      if (m1) drawCurve(m1, '#a78bfa', [5, 3]);
    } else if (this.view === 'tunnel') {
      const a = this.result;
      const machs = [];
      for (let m = 0; m <= 2.4; m += 0.05) machs.push(m);
      const cds = machs.map((m) => analyzeRocketOpenRocket(this.design, { mach: m }).cdTotal);
      const cdMax = Math.max(...cds) * 1.1;
      const padL = 42;
      const padR = 12;
      const padT = 12;
      const padB = 20;
      const plotW = w - padL - padR;
      const plotH = h - padT - padB;
      const X = (m) => padL + (m / 2.4) * plotW;
      const Y = (cd) => padT + plotH - (cd / cdMax) * plotH;

      ctx.strokeStyle = 'rgba(148,163,184,0.16)';
      for (let i = 0; i <= 4; i++) {
        const y = padT + (plotH / 4) * i;
        ctx.beginPath();
        ctx.moveTo(padL, y);
        ctx.lineTo(w - padR, y);
        ctx.stroke();
      }
      ctx.fillStyle = '#64748b';
      ctx.font = '9px ui-monospace, monospace';
      ctx.fillText('Cd(M)', 6, padT + 4);
      [0, 0.6, 1.2, 1.8, 2.4].forEach((m) => {
        ctx.textAlign = 'center';
        ctx.fillText(`M${m.toFixed(1)}`, X(m), h - 5);
        ctx.textAlign = 'left';
      });

      // Зона трансзвука
      ctx.fillStyle = 'rgba(239,68,68,0.10)';
      ctx.fillRect(X(0.8), padT, X(1.2) - X(0.8), plotH);

      ctx.beginPath();
      machs.forEach((m, i) => {
        const x = X(m);
        const y = Y(cds[i]);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.strokeStyle = '#22d3ee';
      ctx.lineWidth = 2;
      ctx.stroke();

      const cm = Math.max(0, Math.min(2.4, this.tunnelMach));
      ctx.beginPath();
      ctx.arc(X(cm), Y(a.cdTotal), 4, 0, Math.PI * 2);
      ctx.fillStyle = '#fbbf24';
      ctx.fill();
      ctx.fillStyle = '#fbbf24';
      ctx.font = '9.5px ui-monospace, monospace';
      ctx.fillText(`M${cm.toFixed(2)} → Cd ${a.cdTotal.toFixed(3)}`, Math.min(X(cm) + 7, w - 110), Math.max(12, Y(a.cdTotal) - 7));
    }
  }

  sampleAt(t) {
    const sim = this.sim;
    if (!sim || !sim.series.length) return null;
    const s = sim.series;
    if (t <= s[0].t) return s[0];
    if (t >= s[s.length - 1].t) return s[s.length - 1];
    let lo = 0;
    let hi = s.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (s[mid].t <= t) lo = mid;
      else hi = mid;
    }
    const a = s[lo];
    const b = s[hi];
    const u = (t - a.t) / Math.max(1e-6, b.t - a.t);
    const lerp = (k) => a[k] + (b[k] - a[k]) * u;
    return {
      ...a,
      t,
      x: lerp('x'),
      y: lerp('y'),
      v: lerp('v'),
      vx: b.vx !== undefined ? lerp('vx') : 0,
      vy: lerp('vy'),
      mach: lerp('mach'),
      accelG: lerp('accelG'),
      pitchRad: a.pitchRad + (b.pitchRad - a.pitchRad) * u,
      chute: b.chute,
      mainOpen: b.mainOpen
    };
  }

  feedScope() {
    if (!this.sim || !this.scope) return;
    const s = this.sim.series;
    let guard = 0;
    while (this.scopeCursor < s.length && s[this.scopeCursor].t <= this.playT && guard < 6) {
      const p = s[this.scopeCursor];
      this.scope.push({ alt: p.y, v: p.v, mach: p.mach, accel: p.accelG });
      this.scopeCursor++;
      guard++;
    }
  }

  /* ================= Главный шаг анимации ================= */

  step(dtReal) {
    const dt = Math.min(0.1, Number(dtReal) || 0.016);
    this.tunnelPhase += dt * 3.2;

    if (this.sim && this.playing && !this.sim.aborted) {
      this.playT += dt * this.speedMult;
      if (this.playT >= this.sim.flightTimeSec) {
        this.playT = this.sim.flightTimeSec;
        this.playing = false;
        this.syncPlayBtn();
      }
      this.feedScope();
      this.updateClock();
    }

    this.draw();
  }
}
