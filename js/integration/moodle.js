// Мост «КосмоЛаб ↔ Moodle (mod_cosmolab)».
// Платформа работает внутри <iframe> элемента курса и обменивается сообщениями
// с родительской страницей Moodle: сообщает о готовности, о старте задания,
// о прогрессе и о зачёте, а также принимает конфигурацию (кабинет/задание).
import { MISSIONS } from '../data/missions.js';

const SOURCE = 'cosmolab';
const PARENT_SOURCE = 'moodle-cosmolab';

export class MoodleBridge {
  constructor(app) {
    this.app = app;
    this.version = '1.2.0';
    this.lastProgressAt = 0;
    this.inbound = null; // последняя полученная конфигурация от Moodle
  }

  get embedded() {
    try {
      return !!window.parent && window.parent !== window;
    } catch (e) {
      return false;
    }
  }

  /** Сообщение родительскому окну Moodle. Если платформа открыта напрямую — молча выходим. */
  post(payload) {
    if (!this.embedded) return false;
    try {
      window.parent.postMessage(Object.assign({ source: SOURCE, version: this.version }, payload), '*');
      return true;
    } catch (e) {
      return false;
    }
  }

  init() {
    window.addEventListener('message', (e) => this.onMessage(e));
    // Сообщаем о готовности сразу и повторно — на случай, если родитель ещё не подписался.
    this.post(this.readyPayload());
    window.setTimeout(() => this.post(this.readyPayload()), 900);
  }

  readyPayload() {
    return {
      type: 'ready',
      url: window.location.href,
      embedded: this.embedded,
      labs: Object.keys(this.app.labs),
      missions: MISSIONS.map((m) => ({ id: m.id, lab: m.lab, title: m.title, badge: m.badge }))
    };
  }

  onMessage(event) {
    const data = event.data;
    if (!data || typeof data !== 'object' || data.source !== PARENT_SOURCE) return;
    this.inbound = data;

    if (data.type === 'ping') {
      this.post(this.readyPayload());
      return;
    }

    if (data.type === 'config') {
      this.applyConfig(data);
      return;
    }

    if (data.type === 'request-state') {
      const lab = this.app.labs[this.app.activeLabKey];
      this.post({
        type: 'state',
        lab: this.app.activeLabKey,
        missionId: this.app.activeMission ? this.app.activeMission.id : null,
        state: lab ? lab.exportState() : null
      });
    }
  }

  applyConfig(cfg) {
    try {
      if (cfg.embed) {
        const shell = document.getElementById('app-shell');
        if (shell) shell.classList.add('embed-mode');
      }
      if (cfg.missionId && MISSIONS.some((m) => m.id === cfg.missionId)) {
        if (!this.app.activeMission || this.app.activeMission.id !== cfg.missionId) {
          this.app.startMission(cfg.missionId, false);
        }
      } else if (cfg.lab && this.app.labs[cfg.lab]) {
        this.app.switchLab(cfg.lab, false);
      }
    } catch (e) {
      // Конфигурация от LMS не должна ломать лабораторию.
    }
  }

  labChanged(key) {
    this.post({ type: 'lab-changed', lab: key });
  }

  missionStart(mission) {
    if (!mission) return;
    this.post({
      type: 'mission-start',
      missionId: mission.id,
      lab: mission.lab,
      title: mission.title,
      badge: mission.badge
    });
  }

  missionComplete(mission, result) {
    if (!mission) return;
    this.post({
      type: 'mission-complete',
      missionId: mission.id,
      lab: mission.lab,
      title: mission.title,
      message: result && result.msg ? result.msg : '',
      score: 100,
      completedAt: Date.now()
    });
  }

  missionProgress(mission, result) {
    if (!mission || !result) return;
    const now = Date.now();
    if (now - this.lastProgressAt < 2000) return; // не чаще 1 раза в 2 секунды
    this.lastProgressAt = now;
    this.post({
      type: 'progress',
      missionId: mission.id,
      lab: mission.lab,
      progress: result.progress || ''
    });
  }

  missionCleared() {
    this.post({ type: 'mission-cleared' });
  }
}
