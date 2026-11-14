const SATELLITES = {
  meteor: { name: 'Метеор-М №2-4 (LRPT)', freqMhz: 137.900, maxVrKmS: 7.1 },
  zorkiy: { name: 'ОрбиКрафт-Зоркий (Space-π)', freqMhz: 437.850, maxVrKmS: 7.4 },
  noaa19: { name: 'NOAA-19 (APT Метео)', freqMhz: 137.100, maxVrKmS: 7.0 }
};

const EO_SCENES = {
  siberia_fires: {
    name: 'Приенисейская тайга (поиск пожаров)',
    baseLat: 57.4,
    baseLon: 93.2,
    targets: [
      { u: 0.28, v: 0.34, label: 'Очаг №1 (верховой пожар)' },
      { u: 0.64, v: 0.27, label: 'Очаг №2 (кромка тайги)' },
      { u: 0.52, v: 0.71, label: 'Очаг №3 (торфяник)' }
    ]
  },
  river_flood: {
    name: 'Весенний паводок (разлив в пойме)',
    baseLat: 54.8,
    baseLon: 91.5,
    targets: [
      { u: 0.33, v: 0.44, label: 'Разлив №1 (пойма у моста)' },
      { u: 0.56, v: 0.52, label: 'Разлив №2 (подтопление лугов)' },
      { u: 0.74, v: 0.36, label: 'Разлив №3 (старица)' }
    ]
  }
};

export class SdrLab {
  constructor(shell) {
    this.shell = shell;
    this.mode = 'radio'; // 'radio' | 'eo'
    this.running = true;

    // Radio state
    this.satId = 'meteor';
    this.antAz = 200;
    this.antEl = 25;
    this.tuneOffsetKhz = 0;
    this.autoTrack = false;
    this.autoDoppler = false;

    // EO state
    this.sceneId = 'siberia_fires';
    this.bandMode = 'rgb'; // 'rgb' | 'nir' | 'tir' | 'ndvi'
    this.foundIndices = new Set();
    this.userMarks = [];
    this.hoverInfo = null;

    this.waterfallRows = [];
    this.resetPass();
  }

  resetPass() {
    this.passProgress = 0.05; // 0..1 across a 90-second virtual pass
    this.scanLines = new Array(80).fill(null); // null or { snr, seed }
    this.snrDb = 4;
    this.dopplerKhz = 0;
    this.satAz = 195;
    this.satEl = 8;
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
      <div class="panel-section" id="sdr-left-radio" style="display:${this.mode === 'radio' ? 'block' : 'none'};">
        <div class="section-header">
          <span class="section-title">Комплекс приёма УКВ «Вьюнок»</span>
        </div>

        <div class="control-row">
          <label class="control-label"><span>Пролетающий КА</span></label>
          <select id="sdr-sat">
            ${Object.entries(SATELLITES)
              .map(([k, v]) => `<option value="${k}" ${this.satId === k ? 'selected' : ''}>${v.name} · ${v.freqMhz.toFixed(3)} МГц</option>`)
              .join('')}
          </select>
        </div>

        <div class="control-row">
          <label class="control-label">
            <span>Азимут антенны</span>
            <span class="control-val" id="sdr-az-lbl">${this.antAz}°</span>
          </label>
          <input type="range" id="sdr-az" min="0" max="359" value="${this.antAz}">
        </div>

        <div class="control-row">
          <label class="control-label">
            <span>Угол места (элевация)</span>
            <span class="control-val" id="sdr-el-lbl">${this.antEl}°</span>
          </label>
          <input type="range" id="sdr-el" min="0" max="90" value="${this.antEl}">
        </div>

        <label style="display:flex; align-items:center; gap:8px; margin:6px 0; cursor:pointer;">
          <input type="checkbox" id="sdr-autotrack" ${this.autoTrack ? 'checked' : ''}>
          <span>Автосопровождение ротора по TLE</span>
        </label>

        <div class="control-row" style="margin-top:10px;">
          <label class="control-label">
            <span>Настройка приёмника Δf</span>
            <span class="control-val" id="sdr-tune-lbl">${this.tuneOffsetKhz.toFixed(2)} кГц</span>
          </label>
          <input type="range" id="sdr-tune" min="-12" max="12" step="0.1" value="${this.tuneOffsetKhz}">
        </div>

        <label style="display:flex; align-items:center; gap:8px; margin:6px 0; cursor:pointer;">
          <input type="checkbox" id="sdr-autodop" ${this.autoDoppler ? 'checked' : ''}>
          <span>Автокомпенсация сдвига Доплера</span>
        </label>

        <button class="btn btn-primary" id="sdr-restart-pass" style="width:100%; margin-top:8px;">
          📡 Начать новый сеанс связи
        </button>
      </div>

      <div class="panel-section" id="sdr-left-eo" style="display:${this.mode === 'eo' ? 'block' : 'none'};">
        <div class="section-header">
          <span class="section-title">Мультиспектральный стол ДЗЗ</span>
        </div>

        <div class="control-row">
          <label class="control-label"><span>Спутниковая сцена</span></label>
          <select id="eo-scene">
            ${Object.entries(EO_SCENES)
              .map(([k, v]) => `<option value="${k}" ${this.sceneId === k ? 'selected' : ''}>${v.name}</option>`)
              .join('')}
          </select>
        </div>

        <div class="control-row">
          <label class="control-label"><span>Спектральный синтез / Индекс</span></label>
          <div style="display:flex; flex-direction:column; gap:5px; margin-top:4px;">
            <button class="btn ${this.bandMode === 'rgb' ? 'btn-primary' : ''}" data-band="rgb">Естественные цвета (RGB)</button>
            <button class="btn ${this.bandMode === 'nir' ? 'btn-primary' : ''}" data-band="nir">Ближний ИК-синтез (NIR-R-G)</button>
            <button class="btn ${this.bandMode === 'tir' ? 'btn-primary' : ''}" data-band="tir">Тепловой канал TIR (10.8 мкм)</button>
            <button class="btn ${this.bandMode === 'ndvi' ? 'btn-primary' : ''}" data-band="ndvi">Вегетационный индекс NDVI</button>
          </div>
        </div>

        <button class="btn btn-sm" id="eo-clear-marks" style="width:100%; margin-top:10px;">
          Очистить метки на карте
        </button>
      </div>
    `;

    el.querySelector('#sdr-sat').addEventListener('change', (e) => {
      this.satId = e.target.value;
      this.resetPass();
    });

    const az = el.querySelector('#sdr-az');
    az.addEventListener('input', () => {
      this.antAz = Number(az.value);
      el.querySelector('#sdr-az-lbl').textContent = `${this.antAz}°`;
    });

    const elv = el.querySelector('#sdr-el');
    elv.addEventListener('input', () => {
      this.antEl = Number(elv.value);
      el.querySelector('#sdr-el-lbl').textContent = `${this.antEl}°`;
    });

    el.querySelector('#sdr-autotrack').addEventListener('change', (e) => {
      this.autoTrack = e.target.checked;
    });

    const tune = el.querySelector('#sdr-tune');
    tune.addEventListener('input', () => {
      this.tuneOffsetKhz = Number(tune.value);
      el.querySelector('#sdr-tune-lbl').textContent = `${this.tuneOffsetKhz >= 0 ? '+' : ''}${this.tuneOffsetKhz.toFixed(2)} кГц`;
    });

    el.querySelector('#sdr-autodop').addEventListener('change', (e) => {
      this.autoDoppler = e.target.checked;
    });

    el.querySelector('#sdr-restart-pass').addEventListener('click', () => this.resetPass());

    el.querySelector('#eo-scene').addEventListener('change', (e) => {
      this.sceneId = e.target.value;
      this.foundIndices.clear();
      this.userMarks = [];
      this.buildSceneBuffer();
    });

    el.querySelectorAll('[data-band]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.bandMode = btn.dataset.band;
        el.querySelectorAll('[data-band]').forEach((b) => b.classList.toggle('btn-primary', b === btn));
        this.buildSceneBuffer();
      });
    });

    el.querySelector('#eo-clear-marks').addEventListener('click', () => {
      this.foundIndices.clear();
      this.userMarks = [];
    });
  }

  renderCenter(el) {
    el.innerHTML = `
      <div class="bench-toolbar">
        <div class="segmented">
          <button class="seg-btn ${this.mode === 'radio' ? 'active' : ''}" data-mode="radio">Радиорубка УКВ (Web-SDR)</button>
          <button class="seg-btn ${this.mode === 'eo' ? 'active' : ''}" data-mode="eo">Анализ космоснимков ДЗЗ</button>
        </div>
        <div class="time-controls">
          <span class="sim-clock" id="sdr-status-pill">Сеанс активен</span>
        </div>
      </div>

      <div class="canvas-stage">
        <canvas id="sdr-canvas"></canvas>
        <div class="canvas-hud" id="sdr-hud"></div>
      </div>
    `;

    this.canvas = el.querySelector('#sdr-canvas');
    this.hudEl = el.querySelector('#sdr-hud');
    this.statusPill = el.querySelector('#sdr-status-pill');

    el.querySelectorAll('[data-mode]').forEach((b) => {
      b.addEventListener('click', () => {
        this.mode = b.dataset.mode;
        el.querySelectorAll('[data-mode]').forEach((x) => x.classList.toggle('active', x === b));
        if (this.containers) {
          this.containers.left.querySelector('#sdr-left-radio').style.display = this.mode === 'radio' ? 'block' : 'none';
          this.containers.left.querySelector('#sdr-left-eo').style.display = this.mode === 'eo' ? 'block' : 'none';
        }
        this.buildSceneBuffer();
      });
    });

    this.canvas.addEventListener('mousemove', (e) => this.onCanvasHover(e));
    this.canvas.addEventListener('click', (e) => this.onCanvasClick(e));
    this.buildSceneBuffer();
  }

  renderRight(el) {
    el.innerHTML = `
      <div class="panel-section">
        <div class="section-header">
          <span class="section-title">Радиотелеметрия и спектрометр</span>
        </div>
        <div class="telemetry-grid">
          <div class="telemetry-card">
            <span class="telemetry-label">Сдвиг Доплера Δf</span>
            <span class="telemetry-value amber" id="sdr-t-dop">+0.00 кГц</span>
          </div>
          <div class="telemetry-card">
            <span class="telemetry-label">Отношение сигнал/шум</span>
            <span class="telemetry-value cyan" id="sdr-t-snr">0.0 дБ</span>
          </div>
          <div class="telemetry-card">
            <span class="telemetry-label">Координаты КА (Аз / УМ)</span>
            <span class="telemetry-value" id="sdr-t-azel">195° / 12°</span>
          </div>
          <div class="telemetry-card">
            <span class="telemetry-label">Декодер снимка</span>
            <span class="telemetry-value green" id="sdr-t-lines">0 / 80 строк</span>
          </div>
        </div>
      </div>

      <div class="panel-section">
        <div class="section-header">
          <span class="section-title">Пиксельный спектрометр ДЗЗ</span>
        </div>
        <div id="eo-probe-box" style="background:var(--bg-0); border:1px solid var(--border); border-radius:6px; padding:10px; font-family:var(--font-mono); font-size:11.5px; line-height:1.6;">
          Наведите курсор на космоснимок во вкладке «Анализ космоснимков ДЗЗ», чтобы измерить каналы RED, NIR, температуру TIR и индекс NDVI.
        </div>
      </div>

      <div class="panel-section">
        <div class="section-header">
          <span class="section-title">Шкала индекса NDVI</span>
        </div>
        <div style="font-size:11.5px; color:var(--text-1); line-height:1.55;">
          <div><strong style="color:#38bdf8;">-0.5 … 0.0:</strong> Открытая вода, паводок, снег</div>
          <div><strong style="color:#a1a1aa;">0.0 … 0.18:</strong> Гари, почва, дым, застройка</div>
          <div><strong style="color:#facc15;">0.20 … 0.45:</strong> Редколесье, угнетённая растит.</div>
          <div><strong style="color:#22c55e;">0.50 … 0.85:</strong> Здоровая плотная тайга / посевы</div>
        </div>
      </div>
    `;
    this.probeEl = el.querySelector('#eo-probe-box');
  }

  sampleScenePixel(u, v) {
    // Procedural physically-consistent multispectral generator (RED, NIR, TIR_C)
    const scene = EO_SCENES[this.sceneId] || EO_SCENES.siberia_fires;
    let red = 0.07;
    let nir = 0.52;
    let tempC = 19;

    // Sinusoidal river channel across terrain
    const riverCenter = this.sceneId === 'siberia_fires'
      ? 0.18 + 0.12 * Math.sin(v * 5.0)
      : 0.48 + 0.16 * Math.sin(v * 4.2);
    const distRiver = Math.abs(u - riverCenter);
    const riverWidth = this.sceneId === 'river_flood' ? 0.055 : 0.038;

    // Terrain variation
    const forestWave = 0.5 + 0.5 * Math.sin(u * 19 + v * 13) * Math.cos(u * 11 - v * 17);
    red = 0.05 + 0.05 * (1 - forestWave);
    nir = 0.44 + 0.28 * forestWave;
    tempC = 17 + 4 * (1 - forestWave);

    if (distRiver < riverWidth) {
      // River water: muddy in RGB if flood, but strongly absorbs NIR!
      red = this.sceneId === 'river_flood' ? 0.14 : 0.04;
      nir = 0.02;
      tempC = 12;
    }

    if (this.sceneId === 'siberia_fires') {
      scene.targets.forEach((t) => {
        const d = Math.hypot(u - t.u, v - t.v);
        // Smoke plume drifting northeast (+u, -v) obscures RGB!
        const smokeD = Math.hypot((u - t.u - 0.06) * 0.7, (v - t.v + 0.03) * 1.3);
        if (smokeD < 0.11) {
          const sm = 1 - smokeD / 0.11;
          red = red * (1 - sm * 0.7) + 0.55 * sm * 0.7; // Hazy grey in visible
        }
        if (d < 0.05) {
          // Burned scar
          red = 0.14;
          nir = 0.08;
          tempC = 48;
        }
        if (d < 0.024) {
          // Active fire core! Extreme TIR anomaly
          tempC = 460 * (1 - d / 0.024) + 95;
          red = 0.22;
          nir = 0.06;
        }
      });
    } else if (this.sceneId === 'river_flood') {
      scene.targets.forEach((t) => {
        const d = Math.hypot((u - t.u) * 1.1, (v - t.v) * 1.3);
        if (d < 0.068) {
          // Muddy floodwater looks brownish-green in RGB (similar to soil), but black in NIR!
          red = 0.13;
          nir = 0.025;
          tempC = 13.5;
        }
      });
    }

    const ndvi = (nir - red) / Math.max(0.001, nir + red);
    return { red, nir, tempC, ndvi };
  }

  buildSceneBuffer() {
    const bw = 260;
    const bh = 180;
    const off = document.createElement('canvas');
    off.width = bw;
    off.height = bh;
    const octx = off.getContext('2d');
    const img = octx.createImageData(bw, bh);

    for (let py = 0; py < bh; py++) {
      for (let px = 0; px < bw; px++) {
        const u = px / bw;
        const v = py / bh;
        const p = this.sampleScenePixel(u, v);
        let r = 0, g = 0, b = 0;

        if (this.bandMode === 'rgb') {
          const smoke = p.red > 0.22 ? p.red : 0;
          r = Math.min(255, p.red * 520 + smoke * 180);
          g = Math.min(255, (p.nir * 0.22 + p.red * 0.65) * 440 + smoke * 180);
          b = Math.min(255, (p.nir < 0.04 && p.red < 0.08 ? 140 : p.red * 360) + smoke * 190);
        } else if (this.bandMode === 'nir') {
          // False color: NIR -> Red, RED -> Green
          r = Math.min(255, p.nir * 360);
          g = Math.min(255, p.red * 480);
          b = Math.min(255, p.nir < 0.05 ? 45 : 35);
        } else if (this.bandMode === 'tir') {
          // Thermal palette: cool blue/purple -> warm orange -> bright yellow-white fire
          const normT = Math.max(0, Math.min(1, (p.tempC - 8) / 320));
          if (normT < 0.12) {
            const k = normT / 0.12;
            r = 20 + k * 70; g = 25 + k * 30; b = 80 + k * 90;
          } else {
            const k = (normT - 0.12) / 0.88;
            r = 220 + k * 35; g = 60 + k * 195; b = 20 + k * 140;
          }
        } else {
          // NDVI color ramp
          if (p.ndvi < 0) {
            r = 25; g = 95; b = 215; // Water
          } else if (p.ndvi < 0.2) {
            r = 135; g = 115; b = 105; // Bare / Burned
          } else if (p.ndvi < 0.48) {
            r = 225; g = 195; b = 55;
          } else {
            const k = Math.min(1, (p.ndvi - 0.48) / 0.35);
            r = 35 * (1 - k); g = 140 + 95 * k; b = 55;
          }
        }

        const idx = (py * bw + px) * 4;
        img.data[idx] = r;
        img.data[idx + 1] = g;
        img.data[idx + 2] = b;
        img.data[idx + 3] = 255;
      }
    }

    octx.putImageData(img, 0, 0);
    this.sceneBuffer = off;
  }

  getEoRect(w, h) {
    const pad = 22;
    return { x: pad, y: pad + 18, w: w - pad * 2, h: h - pad * 2 - 18 };
  }

  onCanvasHover(e) {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (this.mode === 'eo') {
      const box = this.getEoRect(rect.width, rect.height);
      if (x >= box.x && x <= box.x + box.w && y >= box.y && y <= box.y + box.h) {
        const u = (x - box.x) / box.w;
        const v = (y - box.y) / box.h;
        const px = this.sampleScenePixel(u, v);
        const sc = EO_SCENES[this.sceneId];
        this.hoverInfo = {
          lat: sc.baseLat + (0.5 - v) * 1.2,
          lon: sc.baseLon + (u - 0.5) * 1.8,
          ...px
        };
        if (this.probeEl) {
          this.probeEl.innerHTML =
            `Коорд: <strong>${this.hoverInfo.lat.toFixed(3)}°N, ${this.hoverInfo.lon.toFixed(3)}°E</strong><br>` +
            `Канал RED: ${(px.red * 100).toFixed(1)}% · NIR: ${(px.nir * 100).toFixed(1)}%<br>` +
            `Яркостная T (TIR): <strong style="color:${px.tempC > 60 ? 'var(--red)' : 'var(--cyan)'}">${px.tempC.toFixed(1)} °C</strong><br>` +
            `Индекс NDVI: <strong style="color:var(--green)">${px.ndvi.toFixed(2)}</strong>`;
        }
      }
    }
  }

  onCanvasClick(e) {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (this.mode === 'radio') {
      // Allow clicking on the waterfall to tune Δf directly!
      const wfX = 18;
      const wfW = rect.width * 0.46 - 26;
      const wfY = rect.height * 0.53;
      if (x >= wfX && x <= wfX + wfW && y >= wfY) {
        const frac = (x - wfX) / wfW;
        this.tuneOffsetKhz = (frac - 0.5) * 24;
        if (this.containers) {
          const sl = this.containers.left.querySelector('#sdr-tune');
          const lb = this.containers.left.querySelector('#sdr-tune-lbl');
          if (sl) sl.value = this.tuneOffsetKhz;
          if (lb) lb.textContent = `${this.tuneOffsetKhz >= 0 ? '+' : ''}${this.tuneOffsetKhz.toFixed(2)} кГц`;
        }
      }
      return;
    }

    const box = this.getEoRect(rect.width, rect.height);
    if (x < box.x || x > box.x + box.w || y < box.y || y > box.y + box.h) return;

    const u = (x - box.x) / box.w;
    const v = (y - box.y) / box.h;
    const sc = EO_SCENES[this.sceneId];
    let hit = false;

    sc.targets.forEach((t, idx) => {
      if (Math.hypot(u - t.u, v - t.v) < 0.065) {
        this.foundIndices.add(idx);
        hit = true;
        this.shell.toast(`✓ Обнаружен объект: ${t.label} (${this.foundIndices.size}/3)`, 'success');
      }
    });

    if (!hit) {
      this.userMarks.push({ u, v });
      this.shell.toast('В этой точке аномалии нет — проверьте каналы NIR / TIR / NDVI.', 'warn');
    }
  }

  step(dtReal) {
    if (!this.containers) return;

    if (this.mode === 'radio') {
      const sat = SATELLITES[this.satId] || SATELLITES.meteor;
      if (this.passProgress < 1.0) {
        this.passProgress = Math.min(1.0, this.passProgress + dtReal * 0.022);
      }

      // Pass trajectory across sky: Azimuth 195° -> 15°, max Elevation 74°
      const u = this.passProgress;
      this.satAz = (195 + u * 175) % 360;
      this.satEl = Math.max(2, 74 * Math.sin(u * Math.PI));

      // Radial velocity S-curve -> Doppler shift
      const vrKmS = -sat.maxVrKmS * Math.cos(u * Math.PI);
      this.dopplerKhz = -(sat.freqMhz * 1e3) * (vrKmS / 299792.458);

      if (this.autoTrack) {
        this.antAz = Math.round(this.satAz);
        this.antEl = Math.round(this.satEl);
        const l = this.containers.left;
        if (l) {
          l.querySelector('#sdr-az').value = this.antAz;
          l.querySelector('#sdr-az-lbl').textContent = `${this.antAz}°`;
          l.querySelector('#sdr-el').value = this.antEl;
          l.querySelector('#sdr-el-lbl').textContent = `${this.antEl}°`;
        }
      }

      if (this.autoDoppler) {
        this.tuneOffsetKhz = this.dopplerKhz;
        const l = this.containers.left;
        if (l) {
          l.querySelector('#sdr-tune').value = this.tuneOffsetKhz;
          l.querySelector('#sdr-tune-lbl').textContent = `${this.tuneOffsetKhz >= 0 ? '+' : ''}${this.tuneOffsetKhz.toFixed(2)} кГц`;
        }
      }

      // Compute SNR based on pointing error + frequency tuning error
      let dAz = Math.abs(this.antAz - this.satAz);
      if (dAz > 180) dAz = 360 - dAz;
      const pointErr = Math.hypot(dAz * 0.65, this.antEl - this.satEl);
      const freqErrKhz = Math.abs(this.tuneOffsetKhz - this.dopplerKhz);

      const maxSnr = 6 + 19 * Math.sin(u * Math.PI);
      const pointLoss = Math.min(18, (pointErr / 24) ** 2 * 10);
      const tuneLoss = Math.min(20, (freqErrKhz / 1.8) ** 2 * 9);
      this.snrDb = Math.max(1, maxSnr - pointLoss - tuneLoss);

      // Push waterfall row & decode current scanline
      const lineIdx = Math.min(79, Math.floor(u * 80));
      if (!this.scanLines[lineIdx] || this.snrDb > this.scanLines[lineIdx].snr) {
        this.scanLines[lineIdx] = { snr: this.snrDb };
      }

      this.waterfallRows.unshift({ dopplerKhz: this.dopplerKhz, snr: maxSnr - pointLoss });
      if (this.waterfallRows.length > 90) this.waterfallRows.pop();
    }

    this.drawCanvas();
    this.updateDOM();
  }

  updateDOM() {
    if (!this.containers) return;
    const r = this.containers.right;
    r.querySelector('#sdr-t-dop').textContent = `${this.dopplerKhz >= 0 ? '+' : ''}${this.dopplerKhz.toFixed(2)} кГц`;

    const snrEl = r.querySelector('#sdr-t-snr');
    snrEl.textContent = `${this.snrDb.toFixed(1)} дБ`;
    snrEl.className = 'telemetry-value ' + (this.snrDb >= 13 ? 'green' : this.snrDb >= 8 ? 'amber' : 'red');

    r.querySelector('#sdr-t-azel').textContent = `${this.satAz.toFixed(0)}° / ${this.satEl.toFixed(0)}°`;

    const decoded = this.scanLines.filter(Boolean).length;
    const clean = this.scanLines.filter((x) => x && x.snr >= 12.5).length;
    r.querySelector('#sdr-t-lines').textContent = `${clean}/${decoded} чистых`;

    if (this.statusPill) {
      this.statusPill.textContent =
        this.mode === 'radio'
          ? `Пролёт ${(this.passProgress * 100).toFixed(0)}%`
          : `Найдено объектов: ${this.foundIndices.size}/3`;
    }

    if (this.hudEl) {
      if (this.mode === 'radio') {
        this.hudEl.innerHTML =
          this.snrDb >= 13
            ? `<div class="hud-chip ok">✓ Захват несущей LRPT/УКВ (SNR ${this.snrDb.toFixed(1)} дБ) — идёт приём чистых строк</div>`
            : `<div class="hud-chip warn">⚠ Слабый сигнал: наведите антенну на КА и совместите фильтр SDR с несущей на водопаде!</div>`;
      } else {
        this.hudEl.innerHTML = `<div class="hud-chip ok">● Кликните по аномалиям на космоснимке (${this.foundIndices.size}/3 отмечено)</div>`;
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

    if (this.mode === 'eo') {
      this.drawEoWorkspace(ctx, w, h);
    } else {
      this.drawRadioWorkspace(ctx, w, h);
    }

    ctx.restore();
  }

  drawRadioWorkspace(ctx, w, h) {
    ctx.fillStyle = '#060b16';
    ctx.fillRect(0, 0, w, h);

    const leftW = w * 0.46;

    // 1. Skyplot Radar (Top-Left)
    const skyCx = leftW / 2;
    const skyCy = h * 0.27;
    const skyR = Math.min(leftW * 0.38, h * 0.20);

    ctx.strokeStyle = '#253554';
    ctx.lineWidth = 1.4;
    [1, 0.66, 0.33].forEach((f) => {
      ctx.beginPath(); ctx.arc(skyCx, skyCy, skyR * f, 0, Math.PI * 2); ctx.stroke();
    });
    ctx.beginPath();
    ctx.moveTo(skyCx - skyR, skyCy); ctx.lineTo(skyCx + skyR, skyCy);
    ctx.moveTo(skyCx, skyCy - skyR); ctx.lineTo(skyCx, skyCy + skyR);
    ctx.stroke();

    const azElToXY = (az, el) => {
      const r = skyR * (1 - el / 90);
      const rad = ((az - 90) * Math.PI) / 180;
      return { x: skyCx + Math.cos(rad) * r, y: skyCy + Math.sin(rad) * r };
    };

    // Pass arc
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    for (let i = 0; i <= 30; i++) {
      const u = i / 30;
      const p = azElToXY((195 + u * 175) % 360, 74 * Math.sin(u * Math.PI));
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // Antenna beam circle
    const antP = azElToXY(this.antAz, this.antEl);
    ctx.strokeStyle = '#22c55e';
    ctx.fillStyle = 'rgba(34, 197, 94, 0.16)';
    ctx.beginPath();
    ctx.arc(antP.x, antP.y, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Satellite dot
    const satP = azElToXY(this.satAz, this.satEl);
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.arc(satP.x, satP.y, 5.5, 0, Math.PI * 2);
    ctx.fill();

    // 2. Web-SDR Waterfall (Bottom-Left)
    const wfX = 18;
    const wfY = h * 0.53;
    const wfW = leftW - 26;
    const wfH = h - wfY - 18;

    ctx.fillStyle = '#03060d';
    ctx.strokeStyle = '#253554';
    ctx.fillRect(wfX, wfY, wfW, wfH);
    ctx.strokeRect(wfX, wfY, wfW, wfH);

    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText('Спектр и водопад Web-SDR (-12 … +12 кГц, клик = настройка)', wfX, wfY - 6);

    const rowH = Math.max(2, wfH / 75);
    this.waterfallRows.forEach((row, rIdx) => {
      const ry = wfY + rIdx * rowH;
      if (ry > wfY + wfH - rowH) return;

      // Base noise stripe
      ctx.fillStyle = '#0b1933';
      ctx.fillRect(wfX + 1, ry, wfW - 2, rowH);

      // Signal carrier shifted by Doppler
      const sigX = wfX + ((row.dopplerKhz + 12) / 24) * wfW;
      const strength = Math.max(0.15, Math.min(1, row.snr / 22));
      ctx.fillStyle = `rgba(251, 191, 36, ${strength})`;
      ctx.fillRect(sigX - 5, ry, 10, rowH);
      ctx.fillStyle = `rgba(255, 255, 255, ${strength * 0.85})`;
      ctx.fillRect(sigX - 1.5, ry, 3, rowH);
    });

    // Receiver Tuning Passband Cursor
    const tuneX = wfX + ((this.tuneOffsetKhz + 12) / 24) * wfW;
    ctx.fillStyle = this.snrDb >= 13 ? 'rgba(34, 197, 94, 0.22)' : 'rgba(239, 68, 68, 0.22)';
    ctx.fillRect(tuneX - 9, wfY, 18, wfH);
    ctx.strokeStyle = this.snrDb >= 13 ? '#22c55e' : '#ef4444';
    ctx.beginPath();
    ctx.moveTo(tuneX, wfY);
    ctx.lineTo(tuneX, wfY + wfH);
    ctx.stroke();

    // 3. Decoded Satellite Image Scanlines (Right Half)
    const imgX = leftW + 10;
    const imgY = 48;
    const imgW = w - imgX - 18;
    const imgH = h - imgY - 18;

    ctx.fillStyle = '#050811';
    ctx.strokeStyle = '#253554';
    ctx.fillRect(imgX, imgY, imgW, imgH);
    ctx.strokeRect(imgX, imgY, imgW, imgH);

    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 11.5px sans-serif';
    ctx.fillText('Построчный декодер снимка ДЗЗ (APT / LRPT)', imgX, imgY - 7);

    const lineH = imgH / 80;
    for (let i = 0; i < 80; i++) {
      const rec = this.scanLines[i];
      if (!rec) continue;
      const ly = imgY + i * lineH;
      const v = i / 80;

      // Render 48 horizontal blocks per scanline
      const cols = 48;
      const cw = imgW / cols;
      for (let c = 0; c < cols; c++) {
        const u = c / cols;
        if (rec.snr < 11.5 && ((i * 13 + c * 7) % 10) > rec.snr * 0.7) {
          // RF static noise!
          const g = 90 + ((i * 31 + c * 17) % 150);
          ctx.fillStyle = `rgb(${g},${g},${g})`;
        } else {
          // Crisp Earth clouds + land + river feature
          const cloud = Math.sin(u * 9 + v * 7) * Math.cos(u * 5 - v * 8);
          if (cloud > 0.42) {
            ctx.fillStyle = '#e2e8f0';
          } else if (Math.abs(u - (0.45 + 0.12 * Math.sin(v * 5))) < 0.05) {
            ctx.fillStyle = '#1d4ed8';
          } else {
            ctx.fillStyle = '#15803d';
          }
        }
        ctx.fillRect(imgX + c * cw, ly, cw + 0.6, lineH + 0.6);
      }
    }
  }

  drawEoWorkspace(ctx, w, h) {
    ctx.fillStyle = '#060a14';
    ctx.fillRect(0, 0, w, h);

    const box = this.getEoRect(w, h);
    if (this.sceneBuffer) {
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(this.sceneBuffer, box.x, box.y, box.w, box.h);
    }
    ctx.strokeStyle = '#364e7a';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(box.x, box.y, box.w, box.h);

    // Draw found targets
    const sc = EO_SCENES[this.sceneId];
    this.foundIndices.forEach((idx) => {
      const t = sc.targets[idx];
      if (!t) return;
      const tx = box.x + t.u * box.w;
      const ty = box.y + t.v * box.h;
      ctx.strokeStyle = '#22c55e';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(tx, ty, 18, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#86efac';
      ctx.font = 'bold 11px sans-serif';
      ctx.fillText(t.label, tx + 22, ty + 4);
    });

    // User misses
    this.userMarks.forEach((m) => {
      const mx = box.x + m.u * box.w;
      const my = box.y + m.v * box.h;
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(mx - 6, my - 6); ctx.lineTo(mx + 6, my + 6);
      ctx.moveTo(mx + 6, my - 6); ctx.lineTo(mx - 6, my + 6);
      ctx.stroke();
    });
  }

  applyPreset(p) {
    if (!p) return;
    if (p.mode) this.mode = p.mode;
    if (p.satId) this.satId = p.satId;
    if (typeof p.autoTrack === 'boolean') this.autoTrack = p.autoTrack;
    if (typeof p.autoDoppler === 'boolean') this.autoDoppler = p.autoDoppler;
    if (p.sceneId) this.sceneId = p.sceneId;
    if (p.bandMode) this.bandMode = p.bandMode;

    this.foundIndices.clear();
    this.userMarks = [];
    this.resetPass();
    this.buildSceneBuffer();
    if (this.containers) this.mount(this.containers);
  }

  getStateForMission() {
    const decodedLines = this.scanLines.filter(Boolean).length;
    const cleanLines = this.scanLines.filter((x) => x && x.snr >= 12.5).length;
    return {
      decodedLines,
      cleanRatio: decodedLines > 0 ? cleanLines / 80 : 0,
      sceneId: this.sceneId,
      foundTargets: this.foundIndices.size
    };
  }

  exportState() {
    return {
      mode: this.mode,
      satId: this.satId,
      sceneId: this.sceneId,
      bandMode: this.bandMode
    };
  }

  importState(data) {
    if (!data) return;
    this.applyPreset(data);
  }
}
