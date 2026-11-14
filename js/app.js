import { CubeSatLab } from './labs/cubesat.js';
import { OrbitLab } from './labs/orbit.js';
import { RocketLab } from './labs/rocket.js';
import { SdrLab } from './labs/sdr.js';
import { LssLab } from './labs/lss.js';
import { MISSIONS } from './data/missions.js';
import { renderReferenceModal } from './data/reference.js';

function encodeStateParam(obj) {
  const bytes = new TextEncoder().encode(JSON.stringify(obj));
  let bin = '';
  bytes.forEach((b) => { bin += String.fromCharCode(b); });
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decodeStateParam(str) {
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4));
  const bin = atob(b64 + pad);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}

class CosmoLabApp {
  constructor() {
    this.labs = {
      cubesat: new CubeSatLab(this),
      orbit: new OrbitLab(this),
      rocket: new RocketLab(this),
      sdr: new SdrLab(this),
      lss: new LssLab(this)
    };

    this.activeLabKey = 'cubesat';
    this.activeMission = null;
    this.missionDoneInSession = false;
    this.completedMissions = new Set(this.loadCompleted());

    this.containers = {
      left: document.getElementById('panel-left'),
      center: document.getElementById('panel-center'),
      right: document.getElementById('panel-right')
    };

    this.bindTopbar();
    this.bindMissionBar();
    this.bindModals();
    this.bindFileDrop();
    this.parseInitialUrl();

    this.lastTime = performance.now();
    this.checkAcc = 0;
    requestAnimationFrame((t) => this.loop(t));
  }

  loadCompleted() {
    try {
      return JSON.parse(localStorage.getItem('cosmolab_done_v1') || '[]');
    } catch {
      return [];
    }
  }

  saveCompleted() {
    try {
      localStorage.setItem('cosmolab_done_v1', JSON.stringify([...this.completedMissions]));
    } catch {
      // ignore storage restrictions in sandboxed iframes
    }
    this.updateBadgeCount();
  }

  updateBadgeCount() {
    const el = document.getElementById('missions-badge');
    if (el) {
      el.textContent = `${this.completedMissions.size}/${MISSIONS.length}`;
    }
  }

  toast(msg, type = 'info') {
    const wrap = document.getElementById('toast-container');
    if (!wrap) return;
    const item = document.createElement('div');
    item.className = `toast ${type}`;
    item.textContent = msg;
    wrap.appendChild(item);
    setTimeout(() => {
      item.remove();
    }, 3800);
  }

  switchLab(key, updateUrl = true) {
    if (!this.labs[key]) key = 'cubesat';
    const prev = this.labs[this.activeLabKey];
    if (prev) prev.unmount();

    this.activeLabKey = key;
    document.querySelectorAll('.lab-tab').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.lab === key);
    });

    this.labs[key].mount(this.containers);

    if (updateUrl) {
      this.syncUrlBar();
    }
  }

  startMission(missionId, updateUrl = true) {
    const m = MISSIONS.find((x) => x.id === missionId);
    if (!m) return;

    this.activeMission = m;
    this.missionDoneInSession = false;

    if (this.activeLabKey !== m.lab) {
      this.switchLab(m.lab, false);
    }
    this.labs[m.lab].applyPreset(m.preset);
    this.renderMissionBar();

    if (updateUrl) {
      this.syncUrlBar();
    }
  }

  clearMission() {
    this.activeMission = null;
    this.missionDoneInSession = false;
    document.getElementById('mission-bar').classList.add('hidden');
    this.syncUrlBar();
  }

  renderMissionBar() {
    const bar = document.getElementById('mission-bar');
    if (!this.activeMission) {
      bar.classList.add('hidden');
      return;
    }
    bar.classList.remove('hidden');
    bar.classList.toggle('completed', this.missionDoneInSession);

    document.getElementById('mb-pill').textContent = this.missionDoneInSession ? '✓ ЗАЧТЕНО' : 'ЗАДАНИЕ';
    document.getElementById('mb-title').textContent = this.activeMission.title;
    document.getElementById('mb-desc').textContent = this.activeMission.desc;
  }

  syncUrlBar() {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('lab', this.activeLabKey);
      if (this.activeMission) {
        url.searchParams.set('task', this.activeMission.id);
      } else {
        url.searchParams.delete('task');
      }
      url.searchParams.delete('s');
      window.history.replaceState({}, '', url.toString());
    } catch {
      // ignore
    }
  }

  parseInitialUrl() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('embed') === '1') {
      document.getElementById('app-shell').classList.add('embed-mode');
    }

    const taskParam = params.get('task') || params.get('mission');
    const labParam = params.get('lab');
    const stateParam = params.get('s');

    if (taskParam && MISSIONS.some((m) => m.id === taskParam)) {
      this.startMission(taskParam, false);
    } else {
      this.switchLab(labParam || 'cubesat', false);
    }

    if (stateParam) {
      try {
        const decoded = decodeStateParam(stateParam);
        this.labs[this.activeLabKey].importState(decoded);
        this.toast('Конфигурация стенда загружена по ссылке.', 'success');
      } catch {
        this.toast('Не удалось прочитать состояние из ссылки.', 'warn');
      }
    }

    this.updateBadgeCount();
  }

  bindTopbar() {
    document.querySelectorAll('.lab-tab').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (this.activeMission && this.activeMission.lab !== btn.dataset.lab) {
          this.activeMission = null;
          document.getElementById('mission-bar').classList.add('hidden');
        }
        this.switchLab(btn.dataset.lab, true);
      });
    });

    document.getElementById('btn-open-missions').addEventListener('click', () => {
      this.openMissionsModal('all');
    });

    document.getElementById('btn-open-ref').addEventListener('click', () => {
      const modal = document.getElementById('modal-ref');
      renderReferenceModal(document.getElementById('modal-ref-body'));
      modal.classList.remove('hidden');
    });

    document.getElementById('btn-open-mentor').addEventListener('click', () => {
      this.openMentorModal();
    });

    document.getElementById('btn-save-file').addEventListener('click', () => {
      this.saveCosmoLabFile();
    });

    document.getElementById('btn-load-file').addEventListener('click', () => {
      document.getElementById('file-input-cosmolab').click();
    });

    document.getElementById('file-input-cosmolab').addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (file) this.loadCosmoLabFile(file);
      e.target.value = '';
    });

    document.getElementById('btn-share-link').addEventListener('click', () => {
      this.copyShareLink();
    });
  }

  bindMissionBar() {
    document.getElementById('mb-btn-hint').addEventListener('click', () => {
      if (this.activeMission) {
        this.toast('💡 Подсказка: ' + this.activeMission.hint, 'info');
      }
    });

    document.getElementById('mb-btn-reset').addEventListener('click', () => {
      if (this.activeMission) {
        this.startMission(this.activeMission.id, false);
        this.toast('Стенд задания возвращён в начальное состояние.');
      }
    });

    document.getElementById('mb-btn-close').addEventListener('click', () => {
      this.clearMission();
    });
  }

  bindModals() {
    document.querySelectorAll('[data-close-modal]').forEach((btn) => {
      btn.addEventListener('click', () => {
        btn.closest('.modal-backdrop').classList.add('hidden');
      });
    });

    document.querySelectorAll('.modal-backdrop').forEach((bd) => {
      bd.addEventListener('click', (e) => {
        if (e.target === bd) bd.classList.add('hidden');
      });
    });
  }

  openMissionsModal(filterLab = 'all') {
    const modal = document.getElementById('modal-missions');
    const body = document.getElementById('modal-missions-body');
    modal.classList.remove('hidden');

    const labNames = {
      all: 'Все практикумы (15)',
      cubesat: '1. CubeSat / ОрбиКрафт',
      orbit: '2. Орбиты и манёвры',
      rocket: '3. Ракета и CanSat',
      sdr: '4. Приём ДЗЗ / SDR',
      lss: '5. СЖО станции'
    };

    const renderList = (curFilter) => {
      const list = curFilter === 'all' ? MISSIONS : MISSIONS.filter((m) => m.lab === curFilter);
      body.innerHTML = `
        <div style="display:flex; gap:6px; flex-wrap:wrap;">
          ${Object.entries(labNames)
            .map(
              ([k, label]) =>
                `<button class="seg-btn ${curFilter === k ? 'active' : ''}" data-mfilter="${k}">${label}</button>`
            )
            .join('')}
        </div>

        <div class="missions-grid">
          ${list
            .map((m) => {
              const done = this.completedMissions.has(m.id);
              return `
                <div class="mission-card ${done ? 'done' : ''}">
                  <div>
                    <div class="mission-card-top">
                      <span class="tag">${m.badge}</span>
                      <span class="tag age">${done ? '✓ Выполнено' : m.track}</span>
                    </div>
                    <h4>${m.title}</h4>
                    <p>${m.desc}</p>
                  </div>
                  <div style="display:flex; gap:6px; margin-top:6px;">
                    <button class="btn btn-sm btn-primary" data-run-mission="${m.id}" style="flex:1;">
                      Открыть на столе
                    </button>
                    <button class="btn btn-sm" data-copy-mission="${m.id}" title="Скопировать прямую ссылку на задание для учеников">
                      🔗 Ссылка
                    </button>
                  </div>
                </div>
              `;
            })
            .join('')}
        </div>
      `;

      body.querySelectorAll('[data-mfilter]').forEach((b) => {
        b.addEventListener('click', () => renderList(b.dataset.mfilter));
      });

      body.querySelectorAll('[data-run-mission]').forEach((b) => {
        b.addEventListener('click', () => {
          modal.classList.add('hidden');
          this.startMission(b.dataset.runMission, true);
        });
      });

      body.querySelectorAll('[data-copy-mission]').forEach((b) => {
        b.addEventListener('click', () => {
          const m = MISSIONS.find((x) => x.id === b.dataset.copyMission);
          if (!m) return;
          const u = new URL(window.location.href);
          u.search = `?lab=${m.lab}&task=${m.id}`;
          navigator.clipboard?.writeText(u.toString());
          this.toast(`Ссылка на задание «${m.title}» скопирована!`, 'success');
        });
      });
    };

    renderList(filterLab);
  }

  openMentorModal() {
    const modal = document.getElementById('modal-mentor');
    const body = document.getElementById('modal-mentor-body');
    modal.classList.remove('hidden');

    const baseUrl = window.location.origin + window.location.pathname;
    const iframeCode = `<iframe src="${baseUrl}?lab=${this.activeLabKey}&embed=1" width="100%" height="640" style="border:1px solid #253554; border-radius:12px;" allowfullscreen></iframe>`;

    body.innerHTML = `
      <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap:14px;">
        <div class="formula-card">
          <h4>1. Мгновенная выдача заданий группе</h4>
          <p style="color:var(--text-1); margin-top:6px;">
            Как и на <code>урокихимии.рф</code> и <code>урокробототехники.рф</code>, ученикам не нужны аккаунты и права администратора на ПК Кванториума. Отправьте ссылку в чат группы — у каждого откроется индивидуальный предсобранный стенд (включая сценарии поиска неисправностей!).
          </p>
        </div>

        <div class="formula-card">
          <h4>2. Сдача работ файлом .cosmolab</h4>
          <p style="color:var(--text-1); margin-top:6px;">
            Кнопка <strong>«Скачать .cosmolab»</strong> сохраняет схему, параметры ракеты/орбиты и код БКУ в компактный файл. Ученик прикрепляет его к заданию, а наставник просто перетаскивает файл в окно браузера для проверки.
          </p>
        </div>

        <div class="formula-card">
          <h4>3. Привязка к модулям Космоквантума (360 ч)</h4>
          <p style="color:var(--text-1); margin-top:6px;">
            • <strong>Вводный модуль (72 ч):</strong> Ракетомоделирование, аэротруба, базовые орбиты.<br>
            • <strong>Базовый модуль (144 ч):</strong> Стенд «ОрбиКрафт», УКВ радиосвязь и Доплер, СЖО станции.<br>
            • <strong>Проектный / НТО и ВИШ CanSat (144 ч):</strong> ПД-регуляторы, отказ датчиков, ИК/NDVI мониторинг пожаров и паводков.
          </p>
        </div>
      </div>

      <div class="formula-card" style="margin-top:14px;">
        <h4>Встраивание живой лаборатории на сайт Кванториума / Moodle / Stepik</h4>
        <p style="color:var(--text-1); margin:4px 0 8px;">Скопируйте готовый HTML-код для текущей открытой лаборатории (параметр <code>embed=1</code> включает компактный режим):</p>
        <textarea class="code-editor" style="min-height:68px;" readonly id="mentor-iframe-code">${iframeCode}</textarea>
        <button class="btn btn-primary btn-sm" id="mentor-copy-embed" style="margin-top:8px;">Скопировать код iframe</button>
      </div>
    `;

    body.querySelector('#mentor-copy-embed').addEventListener('click', () => {
      const txt = body.querySelector('#mentor-iframe-code').value;
      navigator.clipboard?.writeText(txt);
      this.toast('Код встраивания <iframe> скопирован в буфер обмена!', 'success');
    });
  }

  saveCosmoLabFile() {
    const payload = {
      format: 'cosmolab-v1',
      savedAt: new Date().toISOString(),
      lab: this.activeLabKey,
      missionId: this.activeMission ? this.activeMission.id : null,
      data: this.labs[this.activeLabKey].exportState()
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `project-${this.activeLabKey}.cosmolab`;
    a.click();
    URL.revokeObjectURL(a.href);
    this.toast(`Проект сохранён в файл project-${this.activeLabKey}.cosmolab`, 'success');
  }

  loadCosmoLabFile(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const obj = JSON.parse(String(reader.result));
        if (!obj || !obj.lab || !this.labs[obj.lab]) {
          throw new Error('Неверный формат файла');
        }
        if (obj.missionId) {
          this.startMission(obj.missionId, false);
        } else {
          this.clearMission();
          this.switchLab(obj.lab, true);
        }
        this.labs[obj.lab].importState(obj.data);
        this.toast(`Файл «${file.name}» успешно открыт на рабочем столе!`, 'success');
      } catch (e) {
        this.toast('Ошибка чтения файла .cosmolab: ' + e.message, 'warn');
      }
    };
    reader.readAsText(file);
  }

  bindFileDrop() {
    window.addEventListener('dragover', (e) => e.preventDefault());
    window.addEventListener('drop', (e) => {
      e.preventDefault();
      const file = e.dataTransfer?.files?.[0];
      if (file) this.loadCosmoLabFile(file);
    });
  }

  copyShareLink() {
    try {
      const stateData = this.labs[this.activeLabKey].exportState();
      const encoded = encodeStateParam(stateData);
      const u = new URL(window.location.href);
      u.searchParams.set('lab', this.activeLabKey);
      if (this.activeMission) u.searchParams.set('task', this.activeMission.id);
      u.searchParams.set('s', encoded);
      navigator.clipboard?.writeText(u.toString());
      window.history.replaceState({}, '', u.toString());
      this.toast('Прямая ссылка на текущий собранный стенд скопирована!', 'success');
    } catch {
      this.toast('Не удалось сформировать ссылку.', 'warn');
    }
  }

  loop(now) {
    const dt = Math.min(0.05, Math.max(0.001, (now - this.lastTime) / 1000));
    this.lastTime = now;

    const lab = this.labs[this.activeLabKey];
    if (lab) {
      lab.step(dt);
    }

    // Check active mission 4 times per second
    this.checkAcc += dt;
    if (this.checkAcc >= 0.25) {
      this.checkAcc = 0;
      this.evaluateActiveMission();
    }

    requestAnimationFrame((t) => this.loop(t));
  }

  evaluateActiveMission() {
    if (!this.activeMission) return;
    const lab = this.labs[this.activeMission.lab];
    if (!lab || this.activeLabKey !== this.activeMission.lab) return;

    const res = this.activeMission.check(lab.getStateForMission());
    const progEl = document.getElementById('mb-progress');
    if (res.ok) {
      if (!this.missionDoneInSession) {
        this.missionDoneInSession = true;
        this.completedMissions.add(this.activeMission.id);
        this.saveCompleted();
        this.renderMissionBar();
        this.toast('🎉 Задание зачтено! ' + res.msg, 'success');
      }
      if (progEl) progEl.textContent = res.msg;
    } else if (progEl && !this.missionDoneInSession) {
      progEl.textContent = res.progress || '';
    }
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.cosmoApp = new CosmoLabApp();
});
