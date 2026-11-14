export const CELESTIAL_BODIES = [
  { name: 'Земля', radiusKm: 6371, g: 9.81, v1: 7.91, v2: 11.19, atm: 'N₂ 78%, O₂ 21% (101.3 кПа)', mu: 398600.4 },
  { name: 'Луна', radiusKm: 1737, g: 1.62, v1: 1.68, v2: 2.38, atm: 'Экзосфера (вакуум)', mu: 4902.8 },
  { name: 'Марс', radiusKm: 3390, g: 3.72, v1: 3.55, v2: 5.03, atm: 'CO₂ 95% (0.61 кПа)', mu: 42828.4 },
  { name: 'Венера', radiusKm: 6052, g: 8.87, v1: 7.33, v2: 10.36, atm: 'CO₂ 96.5% (9.2 МПа, 465 °C)', mu: 324859 },
  { name: 'Меркурий', radiusKm: 2440, g: 3.70, v1: 3.01, v2: 4.25, atm: 'Следовая экзосфера', mu: 22032 },
  { name: 'Юпитер', radiusKm: 69911, g: 24.79, v1: 42.1, v2: 59.5, atm: 'H₂ 90%, He 10% (газовый гигант)', mu: 126686534 },
  { name: 'Титан (Сатурн)', radiusKm: 2575, g: 1.35, v1: 1.86, v2: 2.64, atm: 'N₂ 95%, CH₄ 5% (147 кПа)', mu: 8978 }
];

export const ROCKET_ENGINES = [
  { name: 'РД-180 / РД-191 («Ангара»)', pair: 'Керосин РГ-1 + жидкий O₂', isp: 338, thrustKn: '2085–4150 кН', role: 'Первые ступени РН' },
  { name: 'РД-0124 («Союз-2.1б»)', pair: 'Керосин РГ-1 + жидкий O₂', isp: 359, thrustKn: '294 кН', role: 'Третья ступень РН (рекордный УИ керосина)' },
  { name: 'С5.92 (РБ «Фрегат»)', pair: 'НДМГ + АТ (самовосплам.)', isp: 333, thrustKn: '19.6 кН', role: 'Многократные включения на орбите (до 7 раз)' },
  { name: 'РД-0146Д (КВТК)', pair: 'Жидкий H₂ + жидкий O₂', isp: 463, thrustKn: '98 кН', role: 'Криогенный разгонный блок для ГСО и Луны' },
  { name: 'СПД-100 (ОКБ «Факел»)', pair: 'Ксенон Xe (ионно-плазменный)', isp: 1600, thrustKn: '0.083 Н (83 мН)', role: 'Коррекция орбиты спутников («Экспресс», «Ямал»)' },
  { name: 'МРД РД1-100 / CanSat', pair: 'Твёрдое смесевое топливо', isp: 195, thrustKn: '45–120 Н', role: 'Учебные модели ракет Космоквантума и ВИШ' }
];

export const ORBIT_TYPES = [
  { code: 'НОО (LEO)', alt: '160–2 000 км', inc: '0°–98°', period: '88–127 мин', usage: 'МКС (~420 км, 51.6°), кубсаты Space-π, пилотируемые КК' },
  { code: 'ССО (SSO)', alt: '500–850 км', inc: '97°–99° (ретрогр.)', period: '95–102 мин', usage: 'ДЗЗ («Метеор-М», «Канопус-В», «Зоркий»): съёмка в одно местное солнечное время' },
  { code: 'СПО (MEO)', alt: '19 100–20 200 км', inc: '64.8° / 55°', period: '11 ч 15 мин', usage: 'Навигационные группировки ГЛОНАСС и GPS' },
  { code: 'ГСО (GEO)', alt: '35 786 км', inc: '0° (экватор)', period: '23 ч 56 мин 04 с', usage: 'Связь и метео («Электро-Л», «Экспресс»): спутник неподвижен над точкой экватора' },
  { code: 'ВЭО «Молния»', alt: '500 × 39 800 км', inc: '63.4°', period: '11 ч 58 мин', usage: 'Связь и мониторинг Арктики и высоких широт РФ (зависание в апогее)' }
];

export const STANDARDS_TABLE = [
  { format: 'CanSat (ВИШ)', dims: 'Ø 66 × 115 мм (банка 0.33 л)', mass: '≤ 350 г', power: '1–3 Вт (АКБ)', tasks: 'Стратосферный/ракетный сброс, барометр, спасение, телеметрия' },
  { format: 'CubeSat 1U', dims: '100 × 100 × 113.5 мм', mass: '≤ 1.33 кг (до 2 кг)', power: '1.5–3 Вт', tasks: 'Учебный стенд «ОрбиКрафт», маяк УКВ, базовая ориентация' },
  { format: 'CubeSat 3U', dims: '100 × 100 × 340.5 мм', mass: '≤ 4.0 кг (до 6 кг)', power: '6–15 Вт', tasks: 'Space-π («СириусСат», «ОрбиКрафт-Зоркий»), камера ДЗЗ, АИС' },
  { format: 'CubeSat 6U / 16U', dims: '200 × 100 × 340 мм и выше', mass: '8–24 кг', power: '25–60 Вт', tasks: 'Мультиспектральная съёмка высокого разрешения, радар, двигатели' }
];

export function renderReferenceModal(container) {
  container.innerHTML = `
    <div style="display:flex; gap:6px; flex-wrap:wrap; margin-bottom:14px;">
      <button class="seg-btn active" data-ref-tab="calc">Живые калькуляторы формул</button>
      <button class="seg-btn" data-ref-tab="bodies">Небесные тела</button>
      <button class="seg-btn" data-ref-tab="engines">Двигатели и топлива</button>
      <button class="seg-btn" data-ref-tab="orbits">Орбиты и форматы МКА</button>
    </div>

    <div id="ref-pane-calc">
      <div class="formula-grid">
        <div class="formula-card">
          <h4>1. Формула К. Э. Циолковского</h4>
          <div class="formula-math">Δv = Isp · g₀ · ln(m₀ / mₖ)</div>
          <div class="control-row">
            <label class="control-label"><span>Удельный импульс Isp (с)</span></label>
            <input type="number" id="rc-isp" value="333" step="1">
          </div>
          <div class="control-row">
            <label class="control-label"><span>Сухая масса КА mₖ (кг)</span></label>
            <input type="number" id="rc-mdry" value="950" step="10">
          </div>
          <div class="control-row">
            <label class="control-label"><span>Масса топлива mтопл (кг)</span></label>
            <input type="number" id="rc-mfuel" value="650" step="10">
          </div>
          <div id="rc-tsiol-out" class="telemetry-value cyan" style="margin-top:8px;"></div>
        </div>

        <div class="formula-card">
          <h4>2. Круговая орбита и Гомановский переход</h4>
          <div class="formula-math">v = √(μ / r),  T = 2π√(r³ / μ)</div>
          <div class="control-row">
            <label class="control-label"><span>Начальная высота h₁ (км)</span></label>
            <input type="number" id="rc-h1" value="250" step="10">
          </div>
          <div class="control-row">
            <label class="control-label"><span>Целевая высота h₂ (км, 35786 = ГСО)</span></label>
            <input type="number" id="rc-h2" value="35786" step="100">
          </div>
          <div id="rc-hoh-out" class="telemetry-value green" style="margin-top:8px; font-size:12px; line-height:1.5;"></div>
        </div>

        <div class="formula-card">
          <h4>3. Радиосвязь: эффект Доплера и индекс NDVI</h4>
          <div class="formula-math">Δf = -f₀ · (vᵣ / c),  NDVI = (NIR - RED) / (NIR + RED)</div>
          <div class="control-row">
            <label class="control-label"><span>Частота передатчика f₀ (МГц)</span></label>
            <input type="number" id="rc-freq" value="437.85" step="0.05">
          </div>
          <div class="control-row">
            <label class="control-label"><span>Радиальная скорость vᵣ (км/с, «-» приближение)</span></label>
            <input type="number" id="rc-vr" value="-7.2" step="0.2">
          </div>
          <div id="rc-dop-out" class="telemetry-value amber" style="margin-top:8px; font-size:12px; line-height:1.5;"></div>
        </div>
      </div>
    </div>

    <div id="ref-pane-bodies" style="display:none;">
      <p style="color:var(--text-1); margin-bottom:8px;">Параметры планет и спутников для баллистических расчётов:</p>
      <table class="ref-table">
        <thead>
          <tr>
            <th>Тело</th>
            <th>Радиус (км)</th>
            <th>g (м/с²)</th>
            <th>v₁ (км/с)</th>
            <th>v₂ (км/с)</th>
            <th>μ (км³/с²)</th>
            <th>Атмосфера</th>
          </tr>
        </thead>
        <tbody>
          ${CELESTIAL_BODIES.map((b) => `
            <tr>
              <td><strong>${b.name}</strong></td>
              <td>${b.radiusKm.toLocaleString('ru-RU')}</td>
              <td>${b.g}</td>
              <td style="color:var(--cyan);font-family:var(--font-mono);">${b.v1}</td>
              <td style="color:var(--amber);font-family:var(--font-mono);">${b.v2}</td>
              <td style="font-family:var(--font-mono);">${b.mu}</td>
              <td>${b.atm}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>

    <div id="ref-pane-engines" style="display:none;">
      <p style="color:var(--text-1); margin-bottom:8px;">Характерные ракетные двигатели и рабочие тела:</p>
      <table class="ref-table">
        <thead>
          <tr>
            <th>Двигатель</th>
            <th>Топливная пара</th>
            <th>Удельный импульс Isp (с)</th>
            <th>Тяга</th>
            <th>Применение</th>
          </tr>
        </thead>
        <tbody>
          ${ROCKET_ENGINES.map((e) => `
            <tr>
              <td><strong>${e.name}</strong></td>
              <td>${e.pair}</td>
              <td style="color:var(--green);font-family:var(--font-mono);font-weight:700;">${e.isp} с</td>
              <td>${e.thrustKn}</td>
              <td>${e.role}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>

    <div id="ref-pane-orbits" style="display:none;">
      <h4 style="margin-bottom:6px;">Классификация рабочих орбит</h4>
      <table class="ref-table" style="margin-bottom:18px;">
        <thead>
          <tr>
            <th>Тип орбиты</th>
            <th>Высота</th>
            <th>Наклонение</th>
            <th>Период</th>
            <th>Назначение и российские КА</th>
          </tr>
        </thead>
        <tbody>
          ${ORBIT_TYPES.map((o) => `
            <tr>
              <td><strong style="color:var(--cyan);">${o.code}</strong></td>
              <td>${o.alt}</td>
              <td>${o.inc}</td>
              <td>${o.period}</td>
              <td>${o.usage}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <h4 style="margin-bottom:6px;">Форматы учебных и малых космических аппаратов (Космоквантум / Space-π)</h4>
      <table class="ref-table">
        <thead>
          <tr>
            <th>Форм-фактор</th>
            <th>Габариты</th>
            <th>Масса</th>
            <th>Средняя мощность</th>
            <th>Типовые задачи</th>
          </tr>
        </thead>
        <tbody>
          ${STANDARDS_TABLE.map((s) => `
            <tr>
              <td><strong>${s.format}</strong></td>
              <td>${s.dims}</td>
              <td>${s.mass}</td>
              <td>${s.power}</td>
              <td>${s.tasks}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;

  // Tab switching
  const tabs = container.querySelectorAll('[data-ref-tab]');
  tabs.forEach((btn) => {
    btn.addEventListener('click', () => {
      tabs.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      const key = btn.dataset.refTab;
      ['calc', 'bodies', 'engines', 'orbits'].forEach((k) => {
        const pane = container.querySelector(`#ref-pane-${k}`);
        if (pane) pane.style.display = k === key ? 'block' : 'none';
      });
    });
  });

  // Live formula updates
  const updateCalcs = () => {
    const isp = Math.max(1, Number(container.querySelector('#rc-isp').value) || 300);
    const mdry = Math.max(0.1, Number(container.querySelector('#rc-mdry').value) || 100);
    const mfuel = Math.max(0, Number(container.querySelector('#rc-mfuel').value) || 0);
    const dv = isp * 9.80665 * Math.log((mdry + mfuel) / mdry);
    container.querySelector('#rc-tsiol-out').textContent =
      `Запас Δv = ${dv.toFixed(1)} м/с (${(dv / 1000).toFixed(2)} км/с)`;

    const R = 6371;
    const mu = 398600.4418;
    const h1 = Math.max(100, Number(container.querySelector('#rc-h1').value) || 200);
    const h2 = Math.max(100, Number(container.querySelector('#rc-h2').value) || 400);
    const r1 = R + h1;
    const r2 = R + h2;
    const v1 = Math.sqrt(mu / r1);
    const t1 = (2 * Math.PI * Math.sqrt((r1 ** 3) / mu)) / 60;
    const a = (r1 + r2) / 2;
    const dv1 = Math.abs(Math.sqrt(mu * (2 / r1 - 1 / a)) - v1) * 1000;
    const dv2 = Math.abs(Math.sqrt(mu / r2) - Math.sqrt(mu * (2 / r2 - 1 / a))) * 1000;
    container.querySelector('#rc-hoh-out').innerHTML =
      `v₁ = ${v1.toFixed(2)} км/с · T₁ = ${t1.toFixed(1)} мин<br>` +
      `Импульс Δv₁ = ${dv1.toFixed(0)} м/с · Δv₂ = ${dv2.toFixed(0)} м/с · ΣΔv = ${(dv1 + dv2).toFixed(0)} м/с`;

    const fMHz = Number(container.querySelector('#rc-freq').value) || 437.8;
    const vr = Number(container.querySelector('#rc-vr').value) || 0;
    const dfHz = -(fMHz * 1e6) * (vr / 299792.458);
    container.querySelector('#rc-dop-out').innerHTML =
      `Сдвиг Доплера Δf = ${dfHz >= 0 ? '+' : ''}${(dfHz / 1000).toFixed(2)} кГц<br>` +
      `Принимаемая частота: ${(fMHz + dfHz / 1e6).toFixed(5)} МГц`;
  };

  container.querySelectorAll('input').forEach((inp) => inp.addEventListener('input', updateCalcs));
  updateCalcs();
}
