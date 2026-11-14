export class TelemetryScope {
  /**
   * @param {HTMLElement} container
   * @param {Array<{key:string, label:string, unit:string, color:string, min:number, max:number}>} channels
   * @param {object} opts
   */
  constructor(container, channels, opts = {}) {
    this.container = container;
    this.channels = channels.map((c) => ({ ...c, enabled: c.enabled !== false }));
    this.maxSamples = opts.maxSamples || 260;
    this.height = opts.height || 145;
    this.samples = [];
    this.hoverX = null;

    this.renderDOM();
  }

  renderDOM() {
    this.container.innerHTML = '';
    const box = document.createElement('div');
    box.className = 'scope-box';

    const legend = document.createElement('div');
    legend.className = 'scope-legend';
    this.legendItems = [];

    this.channels.forEach((ch, idx) => {
      const item = document.createElement('span');
      item.className = 'scope-ch' + (ch.enabled ? '' : ' off');
      item.title = 'Нажмите, чтобы скрыть/показать канал';
      item.innerHTML = `<span class="scope-dot" style="background:${ch.color}"></span><span class="ch-txt">${ch.label}</span>`;
      item.addEventListener('click', () => {
        ch.enabled = !ch.enabled;
        item.classList.toggle('off', !ch.enabled);
        this.draw();
      });
      legend.appendChild(item);
      this.legendItems.push(item);
    });

    const clearBtn = document.createElement('button');
    clearBtn.className = 'btn btn-sm';
    clearBtn.style.marginLeft = 'auto';
    clearBtn.style.padding = '1px 6px';
    clearBtn.style.fontSize = '10px';
    clearBtn.textContent = 'Сброс';
    clearBtn.addEventListener('click', () => this.clear());
    legend.appendChild(clearBtn);

    this.canvas = document.createElement('canvas');
    this.canvas.style.width = '100%';
    this.canvas.style.height = `${this.height}px`;
    this.canvas.style.display = 'block';

    this.canvas.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      this.hoverX = e.clientX - rect.left;
      this.draw();
    });
    this.canvas.addEventListener('mouseleave', () => {
      this.hoverX = null;
      this.draw();
    });

    box.appendChild(legend);
    box.appendChild(this.canvas);
    this.container.appendChild(box);
    this.draw();
  }

  push(record) {
    this.samples.push(record);
    if (this.samples.length > this.maxSamples) {
      this.samples.shift();
    }
    this.draw();
  }

  clear() {
    this.samples = [];
    this.draw();
  }

  draw() {
    if (!this.canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    const w = Math.max(220, rect.width || 320);
    const h = this.height;

    if (this.canvas.width !== Math.round(w * dpr) || this.canvas.height !== Math.round(h * dpr)) {
      this.canvas.width = Math.round(w * dpr);
      this.canvas.height = Math.round(h * dpr);
    }

    const ctx = this.canvas.getContext('2d');
    ctx.save();
    ctx.scale(dpr, dpr);

    // Background
    ctx.fillStyle = '#050912';
    ctx.fillRect(0, 0, w, h);

    // Grid lines
    ctx.strokeStyle = 'rgba(54, 78, 122, 0.28)';
    ctx.lineWidth = 1;
    const cols = 8;
    const rows = 4;
    for (let i = 1; i < cols; i++) {
      const x = (w / cols) * i;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let j = 1; j < rows; j++) {
      const y = (h / rows) * j;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Center dashed line
    ctx.strokeStyle = 'rgba(143, 161, 189, 0.25)';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    ctx.stroke();
    ctx.setLineDash([]);

    const n = this.samples.length;
    if (n > 1) {
      const padY = 8;
      const plotH = h - padY * 2;

      this.channels.forEach((ch) => {
        if (!ch.enabled) return;
        ctx.strokeStyle = ch.color;
        ctx.lineWidth = 1.7;
        ctx.beginPath();

        for (let i = 0; i < n; i++) {
          const val = Number(this.samples[i][ch.key] ?? 0);
          const norm = Math.max(0, Math.min(1, (val - ch.min) / ((ch.max - ch.min) || 1)));
          const x = (i / (this.maxSamples - 1)) * w;
          const y = padY + (1 - norm) * plotH;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      });

      // Cursor readout
      if (this.hoverX !== null) {
        const idx = Math.min(
          n - 1,
          Math.max(0, Math.round((this.hoverX / w) * (this.maxSamples - 1)))
        );
        const sx = (idx / (this.maxSamples - 1)) * w;
        ctx.strokeStyle = 'rgba(255,255,255,0.45)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(sx, 0);
        ctx.lineTo(sx, h);
        ctx.stroke();

        const sample = this.samples[idx];
        if (sample) {
          let ty = 14;
          ctx.font = '10.5px ui-monospace, monospace';
          this.channels.forEach((ch) => {
            if (!ch.enabled) return;
            const v = Number(sample[ch.key] ?? 0);
            const txt = `${ch.label}: ${v.toFixed(1)}${ch.unit || ''}`;
            const tw = ctx.measureText(txt).width + 8;
            const bx = sx + 8 + tw > w ? sx - tw - 6 : sx + 6;
            ctx.fillStyle = 'rgba(7, 11, 20, 0.88)';
            ctx.fillRect(bx, ty - 10, tw, 13);
            ctx.fillStyle = ch.color;
            ctx.fillText(txt, bx + 4, ty);
            ty += 14;
          });
        }
      }
    } else {
      ctx.fillStyle = '#64748b';
      ctx.font = '11px sans-serif';
      ctx.fillText('Ожидание телеметрии… (запустите симуляцию)', 12, h / 2 + 4);
    }

    ctx.restore();
  }
}
