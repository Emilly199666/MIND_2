/* ============================================================
   MIND · 脑海  —  UI 通用组件
   ============================================================ */
(function () {
  const root = document.getElementById('modal-root');
  const toastRoot = document.getElementById('toast-root');

  /* ---------- 轻提示 ---------- */
  function toast(msg, ms = 1800) {
    const t = document.createElement('div');
    t.className = 'toast'; t.textContent = msg;
    toastRoot.appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity .3s'; setTimeout(() => t.remove(), 300); }, ms);
  }

  /* ---------- 通用弹窗 ----------
     opts: { title, body(HTMLElement|string), footer(HTMLElement|null), onClose }
     返回 close 函数
  */
  function modal(opts) {
    const mask = document.createElement('div');
    mask.className = 'modal-mask';
    const box = document.createElement('div');
    box.className = 'modal';
    const h = document.createElement('h3'); h.textContent = opts.title || '';
    const body = document.createElement('div');
    if (typeof opts.body === 'string') body.innerHTML = opts.body; else if (opts.body) body.appendChild(opts.body);
    box.appendChild(h); box.appendChild(body);
    if (opts.footer) box.appendChild(opts.footer);
    mask.appendChild(box);
    const close = () => { mask.remove(); opts.onClose && opts.onClose(); };
    mask.addEventListener('click', e => { if (e.target === mask) close(); });
    root.appendChild(mask);
    return close;
  }

  /* ---------- 头像 ----------
     data: url 或 文本首字
  */
  function avatar(url, name) {
    if (url) { const i = document.createElement('img'); i.src = url; i.alt = name || ''; return i; }
    const s = document.createElement('span');
    s.className = 'avatar-fallback';
    s.textContent = (name || '?').slice(0, 1).toUpperCase();
    return s;
  }

  /* ---------- 表单字段 ---------- */
  function field(labelText, inputEl) {
    const f = document.createElement('div'); f.className = 'field';
    const l = document.createElement('label'); l.textContent = labelText;
    f.appendChild(l); f.appendChild(inputEl); return f;
  }
  function input(value = '', placeholder = '') {
    const i = document.createElement('input'); i.value = value; i.placeholder = placeholder; return i;
  }
  function textarea(value = '', placeholder = '') {
    const t = document.createElement('textarea'); t.value = value; t.placeholder = placeholder; return t;
  }
  function select(options, value) {
    const s = document.createElement('select');
    options.forEach(o => { const op = document.createElement('option'); op.value = o.value; op.textContent = o.text; s.appendChild(op); });
    if (value != null) s.value = value; return s;
  }

  /* ---------- 颜色选择 chips（含自定义取色器 + 实时预览） ---------- */
  function colorChips(selected, onPick) {
    const wrap = document.createElement('div'); wrap.className = 'chip-row';
    const cur = (typeof selected === 'string' && /^#[0-9a-fA-F]{6}$/.test(selected)) ? selected : (Store.PALETTE[0] || '#888888');
    const preview = document.createElement('span'); preview.className = 'color-preview'; preview.style.background = cur;
    const previewTxt = document.createElement('span'); previewTxt.className = 'color-preview-txt'; previewTxt.textContent = '已选颜色（点击「保存」生效）';

    const customInput = document.createElement('input'); customInput.type = 'color'; customInput.className = 'color-custom';
    customInput.value = cur;
    const setPreview = (c) => { preview.style.background = c; previewTxt.textContent = '已选颜色（点击「保存」生效）'; onPick(c); };
    const markCustom = () => { wrap.querySelectorAll('.chip').forEach(x => x.classList.remove('sel')); customInput.style.outline = '3px solid var(--c1)'; customInput.style.outlineOffset = '2px'; };
    customInput.oninput = () => setPreview(customInput.value);
    customInput.onclick = () => { markCustom(); setPreview(customInput.value); };

    Store.PALETTE.forEach(c => {
      const chip = document.createElement('span'); chip.className = 'chip';
      chip.style.background = c; chip.style.width = '26px'; chip.style.height = '26px'; chip.style.padding = '0';
      chip.style.borderRadius = '50%';
      if (c.toLowerCase() === cur.toLowerCase()) { chip.classList.add('sel'); chip.style.outline = '3px solid var(--c1)'; chip.style.outlineOffset = '2px'; }
      chip.onclick = () => { wrap.querySelectorAll('.chip').forEach(x => { x.style.outline = 'none'; }); chip.classList.add('sel'); customInput.style.outline = 'none'; setPreview(c); };
      wrap.appendChild(chip);
    });
    const cusWrap = document.createElement('label'); cusWrap.className = 'color-custom-wrap'; cusWrap.title = '自定义颜色';
    cusWrap.textContent = '＋ 自定义';
    cusWrap.style.cssText = 'display:inline-flex;align-items:center;gap:6px;font-size:12px;color:var(--text-soft);font-weight:700;cursor:pointer;margin-left:4px';
    cusWrap.appendChild(customInput);
    wrap.append(preview, previewTxt, cusWrap);
    return wrap;
  }

  /* ---------- 日历渲染 ----------
     opts: { year, month(0-11), getDots(dateStr) -> [{color}], onPick(dateStr),
             actions: [HTMLElement]  (右上角动作按钮)
             fillCells: true  —— 有打卡时整格填充为「深的颜色」（不再只是左下角小圆点） }
     返回 {el, title}
  */
  function calendar(opts) {
    let y = opts.year, m = opts.month;
    const wrap = document.createElement('div');

    const navRow = document.createElement('div'); navRow.className = 'cal-head';
    const nav = document.createElement('div'); nav.className = 'cal-nav';
    const title = document.createElement('span'); title.className = 'cal-title';
    const yPrev = chev('«'), mPrev = chev('‹'), mNext = chev('›'), yNext = chev('»');
    yPrev.title = '上一年'; mPrev.title = '上一月'; mNext.title = '下一月'; yNext.title = '下一年';
    yPrev.onclick = () => { y--; if (y < 1970) y = 1970; render(); };
    yNext.onclick = () => { y++; if (y > 2099) y = 2099; render(); };
    mPrev.onclick = () => { m--; if (m < 0) { m = 11; y--; } render(); };
    mNext.onclick = () => { m++; if (m > 11) { m = 0; y++; } render(); };
    nav.append(yPrev, mPrev, title, mNext, yNext);
    navRow.appendChild(nav);

    if (opts.actions && opts.actions.length) {
      const actions = document.createElement('div'); actions.className = 'cal-actions';
      opts.actions.forEach(a => actions.appendChild(a));
      navRow.appendChild(actions);
    }

    const gridWrap = document.createElement('div');
    wrap.append(navRow, gridWrap);

    function render() {
      title.textContent = `${y}年${m + 1}月`;
      gridWrap.innerHTML = '';
      gridWrap.appendChild(buildGrid(y, m));
    }

    function buildGrid(year, month) {
      const grid = document.createElement('div'); grid.className = 'cal-grid';
      // 周一开头（Apple 系统风格）
      const dows = ['一', '二', '三', '四', '五', '六', '日'];
      dows.forEach(d => { const c = document.createElement('div'); c.className = 'cal-dow'; c.textContent = d; grid.appendChild(c); });

      const first = new Date(year, month, 1);
      const startDow = first.getDay();                          // 0=Sun ... 6=Sat
      const startCol = (startDow + 6) % 7;                      // 周一开头下 1号 所在的列
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const prevDays = new Date(year, month, 0).getDate();
      const today = Store.todayStr();

      const cells = [];
      // 前置：上月末尾几天
      for (let i = startCol - 1; i >= 0; i--) cells.push({ d: prevDays - i, str: Store.fmtDate(new Date(year, month - 1, prevDays - i)), other: true });
      // 当月
      for (let d = 1; d <= daysInMonth; d++) cells.push({ d, str: Store.fmtDate(new Date(year, month, d)), other: false });
      // 补齐末尾
      let n = 1;
      while (cells.length % 7 !== 0) { cells.push({ d: n, str: Store.fmtDate(new Date(year, month + 1, n)), other: true }); n++; }

      cells.forEach(c => {
        const cell = document.createElement('div');
        cell.className = 'cal-cell' + (c.other ? ' other-month' : '') + (c.str === today ? ' today' : '');
        const num = document.createElement('div'); num.className = 'dnum'; num.textContent = c.d;
        const dots = document.createElement('div'); dots.className = 'dots';
        const ds = opts.getDots ? opts.getDots(c.str) : [];
        ds.forEach(col => { const dot = document.createElement('span'); dot.className = 'cal-dot'; dot.style.background = col; dots.appendChild(dot); });
        // 整格填充：有记录的日期整块变成该颜色的深色，而不只是左下角小圆点
        if (opts.fillCells && ds.length) {
          cell.classList.add('filled');
          if (ds.length === 1) cell.style.background = ds[0];
          else cell.style.background = 'linear-gradient(135deg,' + ds.join(',') + ')';
          const tc = pickText(ds[0]);
          cell.style.color = tc;
          num.style.color = tc;
          if (ds.length > 1) { const b = document.createElement('span'); b.className = 'cal-badge'; b.textContent = ds.length + ' 项'; b.style.color = tc; cell.appendChild(b); }
        }
        cell.appendChild(num); cell.appendChild(dots);
        cell.onclick = () => opts.onPick && opts.onPick(c.str, c.other);
        grid.appendChild(cell);
      });
      return grid;
    }

    render();
    return { el: wrap };
  }

  /* ---------- 打卡热力图（月历方块，仿 GitHub 贡献图） ----------
     与 calendar 同一套导航：«上一年 ‹上月 标题 ›下月 »下一年；周一开头。
     每天一个小方块，颜色按当日数值（学习小时）分 5 级深浅：0=空 / 1~4 由该科目色由浅到实色。
     底部带「少 → 多」图例；悬停显示 日期 + 时长。
     opts: { year, month(0-11), getValue(dateStr)->number, color(基色), onPick(dateStr, other), actions:[HTMLElement] }
     返回 {el}
  */
  function pickText(c) {
    let r, g, b;
    if (typeof c === 'string' && c.indexOf('rgb') === 0) {
      const m = c.match(/\d+/g); r = +m[0]; g = +m[1]; b = +m[2];
    } else {
      let h = (c || '#000').replace('#', '');
      if (h.length === 3) h = h.split('').map(x => x + x).join('');
      r = parseInt(h.slice(0, 2), 16); g = parseInt(h.slice(2, 4), 16); b = parseInt(h.slice(4, 6), 16);
    }
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return lum > 0.6 ? '#222' : '#fff';
  }
  // 把基色向白色混合 t(0~1)：t=1 为实色，t 越小越浅
  function mixWhite(hex, t) {
    let c = (hex || '#4f7cff').replace('#', '');
    if (c.length === 3) c = c.split('').map(x => x + x).join('');
    const r = parseInt(c.slice(0, 2), 16), g = parseInt(c.slice(2, 4), 16), b = parseInt(c.slice(4, 6), 16);
    const R = Math.round(r * t + 255 * (1 - t));
    const G = Math.round(g * t + 255 * (1 - t));
    const B = Math.round(b * t + 255 * (1 - t));
    return `rgb(${R},${G},${B})`;
  }
  // 数值 -> 级别（0~4）：基于学习小时的分级
  function levelOf(v) {
    if (!v || v <= 0) return 0;
    if (v <= 1) return 1;
    if (v <= 2) return 2;
    if (v <= 4) return 3;
    return 4;
  }
  const HM_TIERS = [0.62, 0.76, 0.90, 1.0]; // 级别 1~4 对应的混合比例（浅 → 实色，最低档也要看得出来）
  function heatmapCalendar(opts) {
    let y = opts.year, m = opts.month;
    const color = opts.color || '#4f7cff';
    const wrap = document.createElement('div'); wrap.className = 'hm-wrap';

    const navRow = document.createElement('div'); navRow.className = 'cal-head';
    const nav = document.createElement('div'); nav.className = 'cal-nav';
    const title = document.createElement('span'); title.className = 'cal-title';
    const yPrev = chev('«'), mPrev = chev('‹'), mNext = chev('›'), yNext = chev('»');
    yPrev.title = '上一年'; mPrev.title = '上一月'; mNext.title = '下一月'; yNext.title = '下一年';
    yPrev.onclick = () => { y--; if (y < 1970) y = 1970; render(); };
    yNext.onclick = () => { y++; if (y > 2099) y = 2099; render(); };
    mPrev.onclick = () => { m--; if (m < 0) { m = 11; y--; } render(); };
    mNext.onclick = () => { m++; if (m > 11) { m = 0; y++; } render(); };
    nav.append(yPrev, mPrev, title, mNext, yNext);
    navRow.appendChild(nav);

    if (opts.actions && opts.actions.length) {
      const actions = document.createElement('div'); actions.className = 'cal-actions';
      opts.actions.forEach(a => actions.appendChild(a));
      navRow.appendChild(actions);
    }

    const gridWrap = document.createElement('div');
    const leg = buildLegend();
    const tip = document.createElement('div'); tip.className = 'hm-tip'; tip.style.display = 'none';
    wrap.append(navRow, gridWrap, leg, tip);

    function buildLegend() {
      const el = document.createElement('div'); el.className = 'hm-legend';
      const less = document.createElement('span'); less.className = 'muted'; less.textContent = '少';
      const more = document.createElement('span'); more.className = 'muted'; more.textContent = '多';
      el.append(less);
      for (let i = 0; i < 5; i++) {
        const s = document.createElement('span'); s.className = 'hm-legend-sq';
        if (i > 0) s.style.background = mixWhite(color, HM_TIERS[i - 1]);
        el.appendChild(s);
      }
      el.append(more);
      return el;
    }

    function render() {
      title.textContent = `${y}年${m + 1}月`;
      gridWrap.innerHTML = '';
      gridWrap.appendChild(buildGrid(y, m));
    }

    function buildGrid(year, month) {
      const grid = document.createElement('div'); grid.className = 'hm-grid';
      // 周一开头
      const dows = ['一', '二', '三', '四', '五', '六', '日'];
      dows.forEach(d => { const c = document.createElement('div'); c.className = 'hm-dow'; c.textContent = d; grid.appendChild(c); });

      const first = new Date(year, month, 1);
      const startDow = first.getDay();                       // 0=Sun ... 6=Sat
      const startCol = (startDow + 6) % 7;                   // 周一开头下 1号 所在列
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const prevDays = new Date(year, month, 0).getDate();
      const today = Store.todayStr();

      const cells = [];
      for (let i = startCol - 1; i >= 0; i--) cells.push({ d: prevDays - i, str: Store.fmtDate(new Date(year, month - 1, prevDays - i)), other: true });
      for (let d = 1; d <= daysInMonth; d++) cells.push({ d, str: Store.fmtDate(new Date(year, month, d)), other: false });
      let n = 1;
      while (cells.length % 7 !== 0) { cells.push({ d: n, str: Store.fmtDate(new Date(year, month + 1, n)), other: true }); n++; }

      cells.forEach(c => {
        const cell = document.createElement('div');
        cell.className = 'hm-cell' + (c.other ? ' other-month' : '') + (c.str === today ? ' today' : '');
        const val = opts.getValue ? (opts.getValue(c.str) || 0) : (opts.getChecked ? (opts.getChecked(c.str) ? 1 : 0) : 0);
        const lvl = levelOf(val);
        if (lvl > 0 && !c.other) {
          cell.classList.add('filled');
          cell.style.background = mixWhite(color, HM_TIERS[lvl - 1]);
          cell.style.color = pickText(mixWhite(color, HM_TIERS[lvl - 1]));
        }
        const num = document.createElement('div'); num.className = 'hm-num'; num.textContent = c.d;
        cell.appendChild(num);
        if (!c.other) {
          cell.onclick = () => opts.onPick && opts.onPick(c.str, c.other);
          cell.addEventListener('mouseenter', () => showTip(cell, c.str, val));
          cell.addEventListener('mouseleave', () => { tip.style.display = 'none'; });
        }
        grid.appendChild(cell);
      });
      return grid;
    }

    function showTip(cell, dateStr, val) {
      const wr = wrap.getBoundingClientRect(), cr = cell.getBoundingClientRect();
      const v = Math.round(val * 10) / 10;
      tip.textContent = v > 0 ? `${dateStr} · ${v} 小时` : `${dateStr} · 未打卡`;
      tip.style.display = 'block';
      tip.style.left = (cr.left - wr.left + cr.width / 2) + 'px';
      tip.style.top = (cr.top - wr.top - 6) + 'px';
    }

    render();
    return { el: wrap };
  }

  function chev(s) { const b = document.createElement('button'); b.className = 'cal-chev'; b.textContent = s; return b; }

  /* ---------- 系统通知（桌面 / 手机） ---------- */
  function notify(title, body) {
    try {
      if (!('Notification' in window)) return false;
      if (Notification.permission === 'granted') { new Notification(title, { body, tag: title + '|' + body }); return true; }
    } catch (e) { /* 某些环境会抛错，回退到应用内提示 */ }
    return false;
  }
  function requestNotify() {
    try { if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission(); } catch (e) {}
  }

  /* ---------- 柱状图 ----------
     data: [{label, value}]  value=分钟
  */
  function barChart(data) {
    const wrap = document.createElement('div'); wrap.className = 'bars';
    const max = Math.max(1, ...data.map(d => d.value));
    data.forEach(d => {
      const col = document.createElement('div'); col.className = 'bar-col';
      const val = document.createElement('div'); val.className = 'bar-val'; val.textContent = d.value ? fmtMin(d.value) : '';
      const bar = document.createElement('div'); bar.className = 'bar'; bar.style.height = (d.value / max * 100) + '%';
      const lab = document.createElement('div'); lab.className = 'bar-label'; lab.textContent = d.label;
      if (d.value > 0) bar.title = d.label + '：' + fmtMin(d.value);
      col.appendChild(val); col.appendChild(bar); col.appendChild(lab);
      wrap.appendChild(col);
    });
    return wrap;
  }
  // 时长格式化：单位「小时」，最多两位小数并去掉多余的 0（1.15 / 1.5 / 2）
  function fmtMin(m) { if (m == null) return ''; const v = Math.round((+m) * 100) / 100; return v + ' 小时'; }
  // 通用折线图：points = [{label, value}]，返回 <svg>
  function lineChart(points, opts) {
    opts = opts || {};
    const color = opts.color || '#4f7cff';
    const maxV = Math.max(opts.max || 0, ...points.map(p => p.value), 1);
    const W = 520, H = 240, padL = 42, padR = 16, padT = 18, padB = 34;
    const innerW = W - padL - padR, innerH = H - padT - padB;
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.setAttribute('class', 'line-chart-svg');
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet'); svg.setAttribute('width', '100%');
    const ticks = 4;
    for (let i = 0; i <= ticks; i++) {
      const y = padT + innerH * i / ticks;
      const gl = document.createElementNS(ns, 'line');
      gl.setAttribute('x1', padL); gl.setAttribute('x2', W - padR); gl.setAttribute('y1', y); gl.setAttribute('y2', y);
      gl.setAttribute('class', 'lc-grid'); svg.appendChild(gl);
      const tv = document.createElementNS(ns, 'text'); tv.setAttribute('x', padL - 6); tv.setAttribute('y', y + 4);
      tv.setAttribute('class', 'lc-ytick'); tv.setAttribute('text-anchor', 'end'); tv.textContent = Math.round(maxV * (ticks - i) / ticks);
      svg.appendChild(tv);
    }
    const n = points.length;
    const X = i => n <= 1 ? padL + innerW / 2 : padL + innerW * i / (n - 1);
    const Y = v => padT + innerH * (1 - v / maxV);
    if (n === 1) {
      const c = document.createElementNS(ns, 'circle'); c.setAttribute('cx', X(0)); c.setAttribute('cy', Y(points[0].value)); c.setAttribute('r', 4.5); c.setAttribute('fill', color); svg.appendChild(c);
    } else {
      let d = '';
      points.forEach((p, i) => { d += (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(p.value).toFixed(1) + ' '; });
      const path = document.createElementNS(ns, 'path'); path.setAttribute('d', d.trim()); path.setAttribute('fill', 'none'); path.setAttribute('stroke', color); path.setAttribute('stroke-width', '2.5'); path.setAttribute('stroke-linejoin', 'round'); path.setAttribute('stroke-linecap', 'round'); svg.appendChild(path);
      points.forEach((p, i) => {
        const c = document.createElementNS(ns, 'circle'); c.setAttribute('cx', X(i)); c.setAttribute('cy', Y(p.value)); c.setAttribute('r', 3.6); c.setAttribute('fill', '#fff'); c.setAttribute('stroke', color); c.setAttribute('stroke-width', '2');
        const ttl = document.createElementNS(ns, 'title'); ttl.textContent = `${p.label}：${p.value}${opts.unit || ''}`; c.appendChild(ttl); svg.appendChild(c);
      });
    }
    const step = Math.ceil(n / 8);
    points.forEach((p, i) => { if (i % step === 0 || i === n - 1) { const t = document.createElementNS(ns, 'text'); t.setAttribute('x', X(i)); t.setAttribute('y', H - 12); t.setAttribute('class', 'lc-xtick'); t.setAttribute('text-anchor', 'middle'); t.textContent = p.label; svg.appendChild(t); } });
    return svg;
  }

  window.UI = { toast, modal, avatar, field, input, textarea, select, colorChips, calendar, heatmapCalendar, barChart, lineChart, fmtMin, notify, requestNotify, pickText };
})();
