/* ============================================================
   MIND · 脑海  —  主程序 (路由 + 各模块视图)
   ============================================================ */
(function () {
  const $ = sel => document.querySelector(sel);
  const main = $('#app-main');
  const navList = $('#nav-list');
  const topProfile = $('#topbar-profile');

  /* ---------- 导航 ---------- */
  const NAV = [
    { id: 'learning', text: '基本学习记录' },
    { id: 'skills',   text: '技能养成记录' },
    { id: 'habits',   text: '习惯养成' },
    { id: 'network',  text: '人脉' },
    { id: 'flow',     text: '项目' },
    { id: 'career-courses', text: '就业+选课', children: [
      { id: 'career',  text: '就业' },
      { id: 'courses', text: '选课' },
    ] },
    { id: 'ideas',    text: '想法' },
    { id: 'review',   text: '复盘' },
    { id: 'settings', text: '设置' },
  ];

  function renderNav() {
    navList.innerHTML = '';
    NAV.forEach(n => {
      const li = document.createElement('li');
      li.dataset.id = n.id;
      li._nav = n;
      if (n.children) {
        li.className = 'nav-group';
        li.innerHTML = `<span class="nav-text">${esc(n.text)}</span><span class="nav-caret">▾</span>`;
        li.onmouseenter = () => showSubnav(li, n);
        li.onmouseleave = scheduleHideSubnav;
        li.onclick = (e) => {
          e.stopPropagation();
          toggleSubnav(li, n);
          // 当前不在子页面里时，顺手落到第一个子页面，避免「点了没反应、还停在上一个页面」
          if (n.children && !n.children.some(c => c.id === currentViewId)) showView(n.children[0].id);
        };
      } else {
        li.textContent = n.text;
        li.onclick = () => showView(n.id);
      }
      navList.appendChild(li);
    });
  }
  function setActive(id) {
    navList.querySelectorAll('li').forEach(li => {
      const n = li._nav;
      let on = li.dataset.id === id;
      if (!on && n && n.children) on = n.children.some(c => c.id === id);
      li.classList.toggle('active', on);
    });
  }
  /* ---------- 悬停下拉（就业加选课） ---------- */
  let _subnavEl = null, _hideTimer = null;
  function ensureSubnav() {
    if (_subnavEl) return _subnavEl;
    const el = document.createElement('div');
    el.className = 'subnav';
    el.style.display = 'none';
    document.body.appendChild(el);
    el.onmouseenter = clearHideTimer;
    el.onmouseleave = scheduleHideSubnav;
    _subnavEl = el;
    return el;
  }
  function showSubnav(li, n) {
    clearHideTimer();
    const el = ensureSubnav();
    el.innerHTML = '';
    n.children.forEach(c => {
      const item = document.createElement('div');
      item.className = 'subnav-item';
      item.textContent = c.text;
      item.onclick = (e) => { e.stopPropagation(); hideSubnav(); showView(c.id); };
      el.appendChild(item);
    });
    const r = li.getBoundingClientRect();
    el.style.position = 'fixed';
    el.style.left = r.left + 'px';
    el.style.top = (r.bottom + 4) + 'px';
    el.style.display = 'block';
  }
  function clearHideTimer() { if (_hideTimer) { clearTimeout(_hideTimer); _hideTimer = null; } }
  function scheduleHideSubnav() { clearHideTimer(); _hideTimer = setTimeout(hideSubnav, 220); }
  function hideSubnav() { clearHideTimer(); if (_subnavEl) _subnavEl.style.display = 'none'; }
  function toggleSubnav(li, n) {
    const el = ensureSubnav();
    if (el.style.display === 'block') hideSubnav(); else showSubnav(li, n);
  }
  document.addEventListener('click', hideSubnav);

  function renderTopProfile() {
    const p = Store.get().profile;
    topProfile.innerHTML = '';
    topProfile.appendChild(UI.avatar(p.avatar, p.name));
    topProfile.title = '点击进入「设置」';
    topProfile.onclick = () => showView('settings');
  }

  /* ---------- 侧边栏收起 / 展开 ---------- */
  const navToggle = document.getElementById('nav-toggle');

  /* 未来日期拦截：onPick 包装器，禁止选择今天之后的日期 */
  function noFuturePick(fn) {
    return (dateStr, isOther) => {
      if (isOther) { UI.toast('不能编辑其他月份的日期'); return; }
      if (dateStr > Store.todayStr()) { UI.toast('不能编辑未来的日期（今天是 ' + Store.todayStr() + '）'); return; }
      fn(dateStr);
    };
  }

  /* ============================================================
     时长输入（单位：小时）—— 支持小数，不再只能填整数
       1.5 / 1.15  → 直接当小时
       1:15 / 1：15 → 1 小时 15 分（= 1.25 小时）
       45分 / 45m   → 45 分钟（= 0.75 小时）
       90min / 1.5h → 同上类推
     解析失败返回 NaN，由调用方提示；留空按 0 处理（= 未打卡）
     ============================================================ */
  function round2(n) { return Math.round(n * 100) / 100; }
  function parseHours(str) {
    const s = String(str == null ? '' : str).trim();
    if (!s) return 0;
    let m;
    m = s.match(/^(\d+(?:\.\d+)?)\s*[:：]\s*(\d+(?:\.\d+)?)$/);            // 1:15
    if (m) return round2(parseFloat(m[1]) + parseFloat(m[2]) / 60);
    m = s.match(/^(\d+(?:\.\d+)?)\s*(分钟|分|mins?|min|m)$/i);             // 45分 / 45min / 45m
    if (m) return round2(parseFloat(m[1]) / 60);
    m = s.match(/^(\d+(?:\.\d+)?)\s*(小时|时|hours?|hrs?|h)$/i);           // 1.5小时 / 1.5h
    if (m) return round2(parseFloat(m[1]));
    const n = parseFloat(s);
    if (!isFinite(n) || n < 0) return NaN;
    return round2(n);
  }
  /* 判断日期串是否合法且不晚于今天 */
  function checkDay(dateStr) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr || '')) return UI.toast('日期格式应为 YYYY-MM-DD');
    if (dateStr > Store.todayStr()) return UI.toast('不能打卡未来的日期（今天是 ' + Store.todayStr() + '）');
    return true;
  }
  /* 统一生成「小时」输入框（placeholder 提示可填小数 / 冒号 / 分钟） */
  function hoursInput(cur, width) {
    const i = UI.input(cur > 0 ? String(cur) : '', '小时，如 1.5 / 1:15 / 45分');
    i.className = 'ci-min';
    if (width) i.style.width = width;
    return i;
  }

  function applySidebar() {
    const collapsed = !!Store.get().sidebarCollapsed;
    document.getElementById('sidebar').classList.toggle('collapsed', collapsed);
    if (navToggle) {
      navToggle.classList.toggle('collapsed', collapsed);
      navToggle.title = collapsed ? '展开导航栏' : '收起导航栏';
    }
  }
  function toggleSidebar() {
    Store.get().sidebarCollapsed = !Store.get().sidebarCollapsed;
    Store.save();
    applySidebar();
  }
  /* ---------- 主题应用范围（全部 / 仅顶栏侧栏 / 仅内容） ---------- */
  function applyScope() {
    const app = document.getElementById('app');
    if (app) app.className = 'scope-' + (Store.get().themeScope || 'all');
  }

  /* ---------- 路由 ---------- */
  let currentViewId = 'learning';
  const isMindRoute = route => !!(route && route.mindRoute && route.view);
  function routeState(view, detail) { return { mindRoute: true, view, detail: detail || null }; }
  function clearRouteOverlays() {
    document.querySelectorAll('.detail-overlay, .img-lightbox').forEach(el => el.remove());
  }
  function showView(id, opts = {}) {
    if (id === 'career') _careerDir = null;
    currentViewId = id;
    if (opts.history !== false) history.pushState(routeState(id), '', location.href);
    setActive(id);
    main.innerHTML = '';
    ({
      learning: viewLearning, skills: viewSkills, habits: viewHabits,
      network: viewNetwork, flow: viewFlow, ideas: viewIdeas, review: viewReview, settings: viewSettings,
      career: viewCareer, courses: viewCourses,
    }[id] || viewLearning)();
  }
  function openHistoryDetail(kind, id) {
    history.pushState(routeState(currentViewId, { kind, id }), '', location.href);
  }
  function restoreHistoryRoute(route) {
    clearRouteOverlays();
    showView(route.view, { history: false });
    if (!route.detail) return;
    const { kind, id } = route.detail;
    if (kind === 'project') openFlowDetail(id, { history: false });
    else if (kind === 'idea') openIdeaDetail(id, { history: false });
    else if (kind === 'learning-item') openItemDetail('learning', id, { history: false });
    else if (kind === 'skill-item') openItemDetail('skills', id, { history: false });
    else if (kind === 'habit') openHabitDetail(id, { history: false });
  }
  window.addEventListener('popstate', e => {
    if (isMindRoute(e.state)) restoreHistoryRoute(e.state);
  });

  /* ============================================================
     通用：记录类模块（学习 / 技能）—— 统一模型
     整体：一个日历（右上角可打卡） + 顶部显眼打卡按钮 + 下方条状行
     ============================================================ */
  function renderTrackView(kind) {
    main.innerHTML = '';
    const st = Store.get();
    const isLearning = kind === 'learning';
    const items = isLearning ? st.learning.subjects : st.skills.items;
    const dayMap = isLearning ? st.learning.daySubjects : aggregateSkillDays();

    // 模块标题（让「基本学习记录」与「技能养成记录」切换时界面明显不同）
    const pageHead = document.createElement('div'); pageHead.className = 'page-head';
    pageHead.innerHTML = `<div class="ph-title">${isLearning ? '基本学习记录' : '技能养成记录'}</div><div class="ph-sub">${isLearning ? '记录每日学习的项目与投入时间' : '记录技能练习进度与掌握程度'}</div>`;
    main.appendChild(pageHead);

    // 整体：仅一个日历，打卡在卡片右上角
    const calCard = UI_card('完成情况');
    const checkinIcon = btn('打卡', () => openTrackCheckin(kind));
    checkinIcon.classList.add('btn-primary');
    calCard.appendChild(UI.calendar({
      year: new Date().getFullYear(), month: new Date().getMonth(),
      getDots: dateStr => {
        const rec = dayMap[dateStr] || {};
        return Object.keys(rec).filter(k => rec[k] > 0).map(k => {
          const it = items.find(x => x.id === k); return it ? it.color : '#ccc';
        });
      },
      onPick: noFuturePick(dateStr => isLearning ? editLearningDay(dateStr) : editSkillDay(dateStr)),
      actions: [checkinIcon],
    }).el);

    // 打卡下方的空白：放「新增项目 / 新增技能」
    const add = btn(isLearning ? '＋ 新增项目' : '＋ 新增技能', () => addSubject(isLearning));
    add.classList.add('btn-add-bottom');

    main.append(calCard, add);

    // 科目/技能：独立条状行（直接渲染，不单独框成区块）
    const head = document.createElement('div');
    head.className = 'section-head';
    head.innerHTML = `<span>${isLearning ? '项目' : '技能'}</span><span class="muted">点击查看打卡记录</span>`;
    main.appendChild(head);
    if (!items.length) {
      const e = document.createElement('div'); e.className = 'empty';
      e.innerHTML = `<p>还没有，点击上方「${isLearning ? '新增项目' : '新增技能'}」</p>`;
      main.appendChild(e);
    } else {
      const list = document.createElement('div'); list.className = 'flow-list';
      sortPinned(items).forEach(it => list.appendChild(trackRow(kind, it)));
      main.appendChild(list);
    }
  }

  function trackRow(kind, it) {
    const el = document.createElement('div'); el.className = 'flow-item';
    const done = countDone(kind, it);
    const pinB = pinBadge(it);
    el.innerHTML = `<div class="fi-main"><span class="fi-dot" style="background:${it.color}"></span><div><div class="fi-name">${esc(it.name)}</div><div class="fi-meta">已打卡 ${done} 天</div>${pinB ? `<div class="fi-badges">${pinB}</div>` : ''}</div></div><div class="fi-status">›</div>`;
    paintItem(el, it.color);
    el.onclick = () => openItemDetail(kind, it.id);
    const isLearning = kind === 'learning';
    const arr = isLearning ? Store.get().learning.subjects : Store.get().skills.items;
    el.addEventListener('contextmenu', e => {
      const extra = [];
      if (!isLearning) extra.push({ label: '📈 掌握度趋势', action: () => openMasteryChart(it) });
      extra.push({ label: '✏️ 编辑名称…', action: () => renameTrackItem(kind, it) });
      extra.push({ label: '🗑️ 删除' + (isLearning ? '项目' : '技能'), action: () => { if (confirm('确认删除「' + it.name + '」？')) { Store.removeItem(arr, it.id); renderTrackView(kind); } } });
      openItemMenu(e, it, extra, () => renderTrackView(kind));
    });
    return el;
  }

  /* 学习项目 / 技能：改名字 */
  function renameTrackItem(kind, it) {
    const isLearning = kind === 'learning';
    const nameI = UI.input(it.name, '名称');
    const body = document.createElement('div'); body.append(UI.field('名称', nameI));
    const footer = modalFooter(() => {
      const nm = nameI.value.trim(); if (!nm) return UI.toast('请填写名称');
      it.name = nm; Store.save(); close(); renderTrackView(kind);
    });
    const close = UI.modal({ title: isLearning ? '编辑项目' : '编辑技能', body, footer });
  }

  function countDone(kind, it) {
    if (kind === 'learning') return Object.values(Store.get().learning.daySubjects).filter(rec => rec[it.id] > 0).length;
    return Object.keys(it.records || {}).length;
  }

  function viewLearning() { renderTrackView('learning'); }
  function viewSkills() { renderTrackView('skills'); }

  // 技能整体日历数据：聚合各技能 item 的 records
  function aggregateSkillDays() {
    const map = {};
    Store.get().skills.items.forEach(s => {
      Object.keys(s.records || {}).forEach(d => { map[d] = map[d] || {}; map[d][s.id] = s.records[d]; });
    });
    return map;
  }

  /* ---------- 新增科目 / 技能 ---------- */
  function addSubject(isLearning) {
    const nameI = UI.input('', '名称');
    const colorWrap = document.createElement('div');
    let color = Store.PALETTE[Math.floor(Math.random() * Store.PALETTE.length)];
    colorWrap.appendChild(UI.colorChips(color, c => color = c));
    const body = document.createElement('div');
    body.append(UI.field('名称', nameI), UI.field('颜色', colorWrap));
    const footer = modalFooter(() => {
      const nm = nameI.value.trim(); if (!nm) return UI.toast('请填写名称');
      const arr = isLearning ? Store.get().learning.subjects : Store.get().skills.items;
      Store.addItem(arr, isLearning ? { id: Store.uid(), name: nm, color, records: {}, dailyDetail: {}, notes: '' } : { id: Store.uid(), name: nm, color, records: {}, dailyDetail: {}, notes: '', mastery: 0, masteryHistory: [] });
      close(); renderTrackView(isLearning ? 'learning' : 'skills');
    });
    const close = UI.modal({ title: isLearning ? '新增科目' : '新增技能', body, footer });
  }

  /* ---------- 顶部打卡（学习/技能）：勾选并填分钟 ---------- */
  function openTrackCheckin(kind) {
    const st = Store.get();
    const isLearning = kind === 'learning';
    const items = isLearning ? st.learning.subjects : st.skills.items;
    if (!items.length) return UI.toast('请先添加' + (isLearning ? '科目' : '技能'));

    const dateI = UI.input(Store.todayStr(), '日期 YYYY-MM-DD');
    const list = document.createElement('div'); list.className = 'checkin-list';

    const readCur = (it, date) => isLearning ? ((st.learning.daySubjects[date] || {})[it.id] || 0)
                                             : ((it.records || {})[date] || 0);
    // 切换日期时，重画列表并带上当天的已有记录
    function renderList(date) {
      list.innerHTML = '';
      items.forEach(it => {
        const cur = readCur(it, date);
        const card = document.createElement('div'); card.className = 'checkin-card' + (cur > 0 ? ' on' : '');
        const box = document.createElement('div'); box.className = 'ci-box'; box.textContent = cur > 0 ? '✓' : '';
        const top = document.createElement('div'); top.className = 'ci-top';
        const dot = document.createElement('span'); dot.className = 'cal-dot'; dot.style.background = it.color;
        const nm = document.createElement('div'); nm.className = 'ci-name'; nm.textContent = it.name;
        const num = UI.input(cur ? String(cur) : '', '小时 / 1:15 / 45分'); num.className = 'ci-min';
        num.onclick = e => e.stopPropagation();
        // 填了时长就自动勾上，清空则自动取消，不用再单独点一次方框
        num.oninput = () => {
          const nv = parseHours(num.value);
          const cardOn = !isNaN(nv) && nv > 0;
          card.classList.toggle('on', cardOn); box.textContent = cardOn ? '✓' : '';
        };
        top.append(dot, nm, num);
        if (!isLearning) {
          const mI = UI.input(typeof it.mastery === 'number' ? String(it.mastery) : '', '掌握度%'); mI.type = 'number'; mI.min = '0'; mI.max = '100'; mI.className = 'ci-mas'; mI.title = '本次掌握度 0–100，留空则不更新';
          mI.onclick = e => e.stopPropagation();
          top.append(mI); card._mas = mI;
        }
        card.append(box, top);
        card.onclick = () => { const on = !card.classList.contains('on'); card.classList.toggle('on', on); box.textContent = on ? '✓' : ''; if (on && !num.value) num.value = '1'; if (!on) num.value = ''; };
        list.appendChild(card);
      });
    }
    renderList(dateI.value.trim() || Store.todayStr());
    dateI.onchange = () => {
      const d = dateI.value.trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return;
      if (checkDay(d) !== true) { dateI.value = Store.todayStr(); }
      renderList(dateI.value.trim() || Store.todayStr());
    };

    const body = document.createElement('div');
    const hint = document.createElement('p'); hint.className = 'muted'; hint.style.fontSize = '12px';
    hint.textContent = '填时长即可打卡，支持小数：1.5（小时）/ 1:15（1 小时 15 分）/ 45分 都行；留空或 0 = 未打卡。也可以点左侧方框快速勾选。';
    body.append(UI.field('日期', dateI), UI.field('打卡情况', list), hint);
    const footer = modalFooter(() => {
      const date = dateI.value.trim() || Store.todayStr();
      if (checkDay(date) !== true) return;
      items.forEach((it, idx) => {
        const cardEl = list.children[idx];
        const raw = cardEl.querySelector('.ci-min').value;
        let v = parseHours(raw);
        if (isNaN(v)) return UI.toast('「' + it.name + '」的时长填写有误，可填 1.5 / 1:15 / 45分');
        if (!cardEl.classList.contains('on')) v = 0;   // 未勾选 = 未打卡
        if (isLearning) {
          st.learning.daySubjects[date] = st.learning.daySubjects[date] || {};
          if (v > 0) st.learning.daySubjects[date][it.id] = v; else delete st.learning.daySubjects[date][it.id];
        } else {
          it.records = it.records || {}; if (v > 0) it.records[date] = v; else delete it.records[date];
          const mEl = list.children[idx]._mas;
          if (mEl && mEl.value !== '') { let m = parseInt(mEl.value, 10); if (isNaN(m)) m = 0; m = Math.max(0, Math.min(100, m)); if (m !== it.mastery || !it.masteryHistory.length) { it.mastery = m; it.masteryHistory = it.masteryHistory || []; it.masteryHistory.push({ date, mastery: m }); } }
        }
      });
      Store.save(); close(); renderTrackView(kind); UI.toast('打卡已记录');
    });
    const close = UI.modal({ title: isLearning ? '学习打卡' : '技能打卡', body, footer });
  }

  /* ---------- 编辑某天（学习：标记科目） ---------- */
  function editLearningDay(dateStr) {
    const st = Store.get();
    const cur = st.learning.daySubjects[dateStr] || {};
    const body = document.createElement('div');
    body.appendChild(UI.field('日期', Object.assign(UI.input(dateStr), { disabled: true })));
    st.learning.subjects.forEach(s => {
      const wrap = document.createElement('div'); wrap.className = 'field';
      const lab = document.createElement('label'); lab.textContent = s.name;
      const row = document.createElement('div'); row.className = 'row'; row.style.alignItems = 'center';
      const num = hoursInput(cur[s.id], '120px');
      num.placeholder = '小时，0 或留空 = 未打卡';
      const dot = document.createElement('span'); dot.className = 'cal-dot'; dot.style.background = s.color;
      row.append(dot, num); wrap.append(lab, row); body.appendChild(wrap); s._num = num;
    });
    const footer = modalFooter(() => {
      const rec = {};
      for (const s of st.learning.subjects) {
        const v = parseHours(s._num.value);
        if (isNaN(v)) return UI.toast('「' + s.name + '」的时长填写有误，可填 1.5 / 1:15 / 45分');
        if (v > 0) rec[s.id] = v;
      }
      if (Object.keys(rec).length) st.learning.daySubjects[dateStr] = rec; else delete st.learning.daySubjects[dateStr];
      Store.save(); close(); renderTrackView('learning');
    });
    const close = UI.modal({ title: '当日学习记录', body, footer });
  }

  /* ---------- 编辑某天（技能：直接记分钟） ---------- */
  function editSkillDay(dateStr) {
    const st = Store.get();
    const body = document.createElement('div');
    body.appendChild(UI.field('日期', Object.assign(UI.input(dateStr), { disabled: true })));
    // 以每个技能为行
    st.skills.items.forEach(s => {
      const wrap = document.createElement('div'); wrap.className = 'field';
      const lab = document.createElement('label'); lab.textContent = s.name;
      const num = hoursInput((s.records && s.records[dateStr]) || 0, '160px');
      num.placeholder = '小时，0 或留空 = 未打卡';
      wrap.append(lab, num); body.appendChild(wrap); s._num = num;
    });
    const footer = modalFooter(() => {
      for (const s of st.skills.items) {
        s.records = s.records || {};
        const v = parseHours(s._num.value);
        if (isNaN(v)) return UI.toast('「' + s.name + '」的时长填写有误，可填 1.5 / 1:15 / 45分');
        if (v > 0) s.records[dateStr] = v; else delete s.records[dateStr];
      }
      Store.save(); close(); renderTrackView('skills');
    });
    const close = UI.modal({ title: '当日技能练习', body, footer });
  }

  /* ============================================================
     记录项详情（全屏）：单个科目/技能 的打卡记录
     含独立日历 + 周/月 柱状图（chevron 导航）+ 打卡明细列表
     ============================================================ */
  function openItemDetail(kind, id, opts = {}) {
    const st = Store.get();
    const isLearning = kind === 'learning';
    const it = (isLearning ? st.learning.subjects : st.skills.items).find(x => x.id === id);
    if (!it) return;
    if (opts.history !== false) openHistoryDetail(isLearning ? 'learning-item' : 'skill-item', id);
    it.records = it.records || {}; it.dailyDetail = it.dailyDetail || {};

    const getMin = (ds) => isLearning ? ((st.learning.daySubjects[ds] || {})[it.id] || 0) : (it.records[ds] || 0);
    const setMin = (ds, v) => {
      if (isLearning) {
        st.learning.daySubjects[ds] = st.learning.daySubjects[ds] || {};
        if (v > 0) st.learning.daySubjects[ds][it.id] = v; else delete st.learning.daySubjects[ds][it.id];
      } else { if (v > 0) it.records[ds] = v; else delete it.records[ds]; }
      Store.save();
    };

    const overlay = document.createElement('div'); overlay.className = 'detail-overlay';
    const head = document.createElement('div'); head.className = 'detail-head';

    /* 同模块所有项目（与列表顺序一致）→ 可左右翻到上一个 / 下一个 */
    const siblings = sortPinned(isLearning ? st.learning.subjects : st.skills.items);
    const idx = siblings.findIndex(x => x.id === id);
    /* 翻页：新页先叠上来再撤旧页，全程不重绘列表，所以不会闪出中间界面 */
    function jumpTo(i) {
      if (i < 0 || i >= siblings.length || i === idx) return;
      const dir = i > idx ? 1 : -1;
      const oldEl = overlay;
      cleanupNav(); overlay.__navCleanup = null;
      const fresh = openItemDetail(kind, siblings[i].id);
      commitDetailSlide(oldEl, fresh, dir);
    }
    function peekSibling(dir) {
      const i = idx + dir;
      if (i < 0 || i >= siblings.length) return null;
      return openItemDetail(kind, siblings[i].id);
    }
    function closeMe() {
      cleanupNav(); overlay.remove();
      if (typeof currentViewId === 'undefined' || currentViewId === (isLearning ? 'learning' : 'skills')) renderTrackView(kind);
    }

    /* 左：关闭按钮（放在左上角） */
    const closeBtn = document.createElement('button'); closeBtn.className = 'close-x dh-close'; closeBtn.textContent = '✕';
    closeBtn.title = '关闭（Esc）';
    closeBtn.onclick = () => { if (isMindRoute(history.state) && history.state.detail) history.back(); else closeMe(); };

    /* 中：标题 */
    const titleEl = document.createElement('div'); titleEl.className = 'dh-title';
    titleEl.innerHTML = `<span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:${it.color};margin-right:8px;vertical-align:middle"></span>${esc(it.name)}<span class="dh-count">${idx + 1}/${siblings.length}</span>`;

    /* 右：上一个 / 下一个 / 打卡 / 删除 */
    const prevB = chev('‹', () => jumpTo(idx - 1)); prevB.title = '上一个项目（← 键）';
    const nextB = chev('›', () => jumpTo(idx + 1)); nextB.title = '下一个项目（→ 键）';
    if (idx <= 0) prevB.classList.add('disabled');
    if (idx >= siblings.length - 1) nextB.classList.add('disabled');
    const checkinBtn = checkinIconBtn(() => openItemCheckin());
    const del = btn('删除', () => { if (confirm('删除该项？')) { Store.removeItem(isLearning ? st.learning.subjects : st.skills.items, it.id); closeMe(); } });
    del.className = 'btn-danger';
    const actions = document.createElement('div'); actions.className = 'dh-actions';
    actions.append(prevB, nextB, checkinBtn, del);
    head.append(closeBtn, titleEl, actions);

    const bodyEl = document.createElement('div'); bodyEl.className = 'detail-body';
    overlay.append(head, bodyEl); document.body.appendChild(overlay);
    const cleanupNav = enableOverlayNav(overlay, {
      prev: () => jumpTo(idx - 1),
      next: () => jumpTo(idx + 1),
      hasPrev: () => idx > 0,
      hasNext: () => idx < siblings.length - 1,
      peek: dir => peekSibling(dir),
      close: () => closeMe(),
    });
    overlay.__navCleanup = cleanupNav;

    let chartMode = 'week', anchor = new Date();

    function drawCal() {
      const card = UI_card('打卡热力图');
      card.appendChild(UI.heatmapCalendar({
        year: new Date().getFullYear(), month: new Date().getMonth(),
        getValue: ds => getMin(ds),
        color: it.color,
        onPick: noFuturePick(ds => editItemDay(ds)),
      }).el);
      return card;
    }
    function editItemDay(dateStr) {
      const cur = getMin(dateStr);
      const numI = hoursInput(cur);
      const body = document.createElement('div');
      body.append(UI.field('日期', Object.assign(UI.input(dateStr), { disabled: true })), UI.field(isLearning ? '学习时长（小时）' : '练习时长（小时）', numI));
      const footer = modalFooter(() => {
        const v = parseHours(numI.value);
        if (isNaN(v)) return UI.toast('时长填写有误，可填 1.5 / 1:15 / 45分');
        setMin(dateStr, v); close(); redraw();
      }, '清除', () => { setMin(dateStr, 0); close(); redraw(); });
      const close = UI.modal({ title: '打卡记录', body, footer });
    }

    /* ---------- 详情内的打卡：日期 + 时长（小时，支持小数） ---------- */
    function openItemCheckin() {
      const today = Store.todayStr();
      const dateI = UI.input(today, '日期 YYYY-MM-DD');
      const numI = hoursInput(getMin(today));
      const body = document.createElement('div');
      const hint = document.createElement('p'); hint.className = 'muted'; hint.style.fontSize = '12px';
      hint.textContent = '时长支持小数：1.5 或一个半小时写法 1:15（1 小时 15 分）、45分；留空或 0 = 未打卡。';
      dateI.onchange = () => {
        const d = dateI.value.trim();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return;
        if (checkDay(d) !== true) { dateI.value = today; return; }
        numI.value = getMin(d) ? String(getMin(d)) : '';
      };
      const fields = [UI.field('日期（可补前几天）', dateI), UI.field(isLearning ? '学习时长（小时）' : '练习时长（小时）', numI)];
      let mI = null;
      if (!isLearning) {
        mI = UI.input(typeof it.mastery === 'number' ? String(it.mastery) : '', '0–100，留空则不更新');
        mI.type = 'number'; mI.min = '0'; mI.max = '100';
        fields.push(UI.field('本次掌握度', mI));
      }
      body.append(...fields, hint);
      const footer = modalFooter(() => {
        const date = dateI.value.trim() || today;
        if (checkDay(date) !== true) return;
        const v = parseHours(numI.value);
        if (isNaN(v)) return UI.toast('时长填写有误，可填 1.5 / 1:15 / 45分');
        setMin(date, v);
        if (!isLearning && mI && mI.value !== '') {
          let m = parseInt(mI.value, 10); if (isNaN(m)) m = 0; m = Math.max(0, Math.min(100, m));
          if (m !== it.mastery || !(it.masteryHistory || []).length) {
            it.mastery = m; it.masteryHistory = it.masteryHistory || [];
            it.masteryHistory.push({ date, mastery: m });
          }
        }
        Store.save(); close(); redraw();
        UI.toast(v > 0 ? `已打卡 ${date} · ${UI.fmtMin(v)}` : `已取消 ${date} 的打卡`);
      }, '清除当天', () => { setMin(dateI.value.trim() || today, 0); close(); redraw(); UI.toast('已清除'); });
      const close = UI.modal({ title: (isLearning ? '项目打卡 · ' : '技能打卡 · ') + it.name, body, footer });
    }
    function drawChart() {
      const card = UI_card('学习时长');
      const { start, end, days } = chartRange(chartMode, anchor);
      const data = days.map(d => ({ label: chartMode === 'week' ? ['日', '一', '二', '三', '四', '五', '六'][d.getDay()] : String(d.getDate()), value: getMin(Store.fmtDate(d)) }));
      const total = days.reduce((a, d) => a + getMin(Store.fmtDate(d)), 0);
      const rangeTitle = document.createElement('div'); rangeTitle.className = 'muted'; rangeTitle.style.fontSize = '13px';
      rangeTitle.textContent = `${Store.fmtDate(start)} ~ ${Store.fmtDate(end)}  ·  共 ${UI.fmtMin(total)}`;
      const nav = document.createElement('div'); nav.className = 'cal-nav'; nav.style.justifyContent = 'flex-start';
      const toggle = btn(chartMode === 'week' ? '按周' : '按月', () => { chartMode = chartMode === 'week' ? 'month' : 'week'; redraw(); });
      const prev = chev('‹', () => move(-1)); const next = chev('›', () => move(1));
      nav.append(toggle, prev, next);
      card.append(rangeTitle, nav, UI.barChart(data));
      return card;
    }
    function move(dir) {
      if (chartMode === 'week') anchor = addDays(anchor, dir * 7);
      else anchor = new Date(anchor.getFullYear(), anchor.getMonth() + dir, anchor.getDate());
      redraw();
    }
    function drawList() {
      const card = UI_card('打卡明细');
      const dates = Object.keys(isLearning ? st.learning.daySubjects : it.records).filter(d => getMin(d) > 0).sort().reverse();
      if (!dates.length) { card.innerHTML += `<div class="empty"><p>暂无打卡</p></div>`; return card; }
      const ul = document.createElement('div');
      dates.forEach(d => { const row = document.createElement('div'); row.className = 'skill-row';
        row.innerHTML = `<span>${d}</span><span class="muted">${UI.fmtMin(getMin(d))}</span>`;
        row.style.cursor = 'pointer'; row.onclick = () => editItemDay(d); ul.appendChild(row); });
      card.appendChild(ul); return card;
    }
    function redraw() {
      bodyEl.innerHTML = '';
      const doneDays = (() => {
        const keys = isLearning ? Object.keys(st.learning.daySubjects) : Object.keys(it.records);
        return keys.filter(d => getMin(d) > 0).length;
      })();
      const sum = UI_card('统计'); sum.innerHTML = `<p>累计打卡 <b>${doneDays}</b> 天</p>`;
      // 打卡日历放到最下面：统计 + 时长 + 明细 在前，日历在最后
      bodyEl.append(sum, drawChart(), drawList(), drawCal());
    }
    redraw();
    return overlay;
  }

  /* ---------- 掌握度变化折线图（单独界面） ---------- */
  function openMasteryChart(it) {
    const hist = (it.masteryHistory || []).slice().sort((a, b) => a.date < b.date ? -1 : 1);
    const overlay = document.createElement('div'); overlay.className = 'detail-overlay';
    const head = document.createElement('div'); head.className = 'detail-head';
    const closeBtn = document.createElement('button'); closeBtn.className = 'close-x dh-close'; closeBtn.textContent = '✕';
    closeBtn.title = '关闭（Esc）';
    closeBtn.onclick = () => overlay.remove();
    const titleEl = document.createElement('div'); titleEl.className = 'dh-title';
    titleEl.innerHTML = `${esc(it.name)} · 掌握度变化`;
    head.append(closeBtn, titleEl);
    const bodyEl = document.createElement('div'); bodyEl.className = 'detail-body';
    overlay.append(head, bodyEl); document.body.appendChild(overlay);
    bodyEl.innerHTML = '';
    if (!hist.length) {
      const card = UI_card('掌握度折线图');
      card.innerHTML = `<div class="empty"><p>暂无掌握度记录</p><p class="muted">在「技能养成记录」打卡时填写掌握度，或在「项目」编辑技能需求，即可生成折线图。</p></div>`;
      bodyEl.appendChild(card); return;
    }
    const pts = hist.map(h => ({ label: h.date, value: h.mastery }));
    const first = hist[0].mastery, last = hist[hist.length - 1].mastery;
    const max = Math.max(...pts.map(p => p.value));
    const stat = UI_card('统计');
    stat.innerHTML = `<p>初始 <b>${first}%</b> · 当前 <b>${last}%</b> · 最高 <b>${max}%</b> · 变化 <b class="${last >= first ? 'up' : 'down'}">${last - first >= 0 ? '+' : ''}${last - first}%</b></p><p class="muted">共 ${pts.length} 次记录</p>`;
    const chartCard = UI_card('掌握度随时间的变化');
    chartCard.appendChild(UI.lineChart(pts, { max: 100, unit: '%', color: it.color || '#4f7cff' }));
    bodyEl.append(stat, chartCard);
  }

  function chev(s, fn) { const b = document.createElement('button'); b.className = 'cal-chev'; b.textContent = s; b.onclick = fn; return b; }

  /* ============================================================
     习惯养成
     ============================================================ */
  function viewHabits() {
    main.innerHTML = '';
    const st = Store.get();
    if (!st.habits.items.length) {
      const c = UI_card('习惯养成');
      c.innerHTML = `<div class="empty"><p>还没有习惯，点击下方添加</p></div>`;
      const add = btn('+ 新建习惯', () => addHabit());
      c.appendChild(add); main.appendChild(c); return;
    }
    // 顶部日历：打卡在卡片右上角
    const calCard = UI_card('每日打卡情况');
    const calCheckin = btn('打卡', openCheckin); calCheckin.classList.add('btn-primary');
    const calBody = document.createElement('div');
    function drawCal() {
      calBody.innerHTML = '';
      calBody.appendChild(UI.calendar({
        year: new Date().getFullYear(), month: new Date().getMonth(),
        getDots: dateStr => st.habits.items.filter(h => h.records && h.records[dateStr]).map(h => h.color),
        onPick: noFuturePick(dateStr => editHabitDay(dateStr)),
        actions: [calCheckin],
        fillCells: true,
      }).el);
    }
    drawCal(); calCard.appendChild(calBody);

    // 打卡按钮下方的空白：放「新建习惯」
    const addH = btn('＋ 新建习惯', () => addHabit());
    addH.classList.add('btn-add-bottom');

    // 项目框框（习惯）
    const gridCard = UI_card('习惯（点击查看打卡日历 · 右键可置顶 / 换色）');
    const grid = document.createElement('div'); grid.className = 'tile-grid';
    sortPinned(st.habits.items).forEach(h => {
      const tile = document.createElement('div'); tile.className = 'tile';
      const doneDays = Object.keys(h.records || {}).length;
      const pinB = pinBadge(h);
      tile.innerHTML = `<div class="tile-name">${esc(h.name)}</div><div class="tile-sub">累计 ${doneDays} 天</div>${pinB ? `<div class="fi-badges">${pinB}</div>` : ''}`;
      paintItem(tile, h.color);
      tile.onclick = () => openHabitDetail(h.id);
      tile.addEventListener('contextmenu', e => openItemMenu(e, h, [
        { label: '✏️ 编辑习惯…', action: () => editHabit(h) },
        { label: '🗑️ 删除习惯', action: () => { if (confirm('确认删除「' + h.name + '」？')) { Store.removeItem(st.habits.items, h.id); viewHabits(); } } },
      ], viewHabits));
      grid.appendChild(tile);
    });
    gridCard.appendChild(grid);

    main.append(calCard, addH, gridCard);
  }

  function habitForm(h) {
    const isNew = !h;
    h = h || { id: Store.uid(), name: '', color: Store.PALETTE[Math.floor(Math.random() * Store.PALETTE.length)], records: {}, notes: '' };
    const nameI = UI.input(h.name, '习惯名称');
    const colorWrap = document.createElement('div');
    let color = h.color || Store.PALETTE[0];
    colorWrap.appendChild(UI.colorChips(color, c => color = c));
    const notesI = UI.textarea(h.notes || '', '备注（可选）');
    const tip = document.createElement('p'); tip.className = 'muted';
    tip.textContent = '这个颜色会铺满整个习惯卡片，也会用在打卡日历里（打卡那天整格变成这个颜色）。';
    const body = document.createElement('div');
    body.append(UI.field('名称', nameI), UI.field('颜色（整块卡片）', colorWrap), UI.field('备注', notesI), tip);
    const footer = modalFooter(() => {
      const nm = nameI.value.trim(); if (!nm) return UI.toast('请填写名称');
      h.name = nm; h.color = color; h.notes = notesI.value.trim(); h.records = h.records || {};
      if (isNew) Store.addItem(Store.get().habits.items, h); else Store.save();
      close(); viewHabits();
    }, isNew ? null : '删除', isNew ? null : () => { Store.removeItem(Store.get().habits.items, h.id); close(); viewHabits(); });
    const close = UI.modal({ title: isNew ? '新建习惯' : '编辑习惯', body, footer });
  }
  function addHabit() { habitForm(null); }
  function editHabit(h) { habitForm(h); }

  // 打卡弹窗
  function openCheckin() {
    const st = Store.get();
    const dateStr = Store.todayStr();
    let picked = {};
    const body = document.createElement('div');
    const tip = document.createElement('div'); tip.className = 'muted'; tip.style.marginBottom = '10px';
    tip.textContent = `打卡日期：${dateStr}（点击左侧方框多选）`;
    const list = document.createElement('div'); list.className = 'checkin-list';
    st.habits.items.forEach(h => {
      const card = document.createElement('div'); card.className = 'checkin-card';
      const box = document.createElement('div'); box.className = 'ci-box';
      const nm = document.createElement('div'); nm.className = 'ci-name'; nm.textContent = h.name;
      nm.style.borderLeft = `4px solid ${h.color}`; nm.style.paddingLeft = '8px';
      const sw = document.createElement('span'); sw.className = 'cal-dot'; sw.style.background = h.color; sw.style.marginTop = '8px'; sw.style.marginLeft = '26px';
      card.append(box, nm, sw);
      card.onclick = () => { picked[h.id] = !picked[h.id]; card.classList.toggle('on', !!picked[h.id]); box.textContent = picked[h.id] ? '✓' : ''; };
      list.appendChild(card);
    });
    body.append(tip, list);
    const footer = document.createElement('div');
    const confirm = btn('确认打卡', () => {
      const ids = Object.keys(picked).filter(k => picked[k]);
      if (!ids.length) return UI.toast('请至少选择一个习惯');
      ids.forEach(id => { const h = st.habits.items.find(x => x.id === id); h.records = h.records || {}; h.records[dateStr] = true; });
      Store.save(); close(); viewHabits(); UI.toast('打卡成功');
    });
    confirm.style.cssText = 'float:right;'; confirm.classList.add('btn-primary');
    footer.appendChild(confirm);
    const close = UI.modal({ title: '习惯打卡', body, footer });
  }

  function editHabitDay(dateStr) {
    const st = Store.get();
    const cur = (st.habits.items[0] && st.habits.items[0].records && st.habits.items[0].records[dateStr]) || false;
    const body = document.createElement('div');
    body.appendChild(UI.field('日期', Object.assign(UI.input(dateStr), { disabled: true })));
    const wrap = document.createElement('div'); wrap.className = 'chip-row';
    st.habits.items.forEach(h => {
      const on = h.records && h.records[dateStr];
      const chip = document.createElement('span'); chip.className = 'chip' + (on ? ' sel' : '');
      chip.textContent = h.name; h._on = on;
      chip.onclick = () => { h._on = !h._on; chip.classList.toggle('sel', h._on); };
      wrap.appendChild(chip);
    });
    body.appendChild(UI.field('完成的习惯（点击切换）', wrap));
    const footer = modalFooter(() => {
      st.habits.items.forEach(h => { h.records = h.records || {}; if (h._on) h.records[dateStr] = true; else delete h.records[dateStr]; });
      Store.save(); close(); viewHabits();
    });
    const close = UI.modal({ title: '当日打卡', body, footer });
  }

  function openHabitDetail(id, opts = {}) {
    const st = Store.get();
    const h = st.habits.items.find(x => x.id === id); if (!h) return;
    if (opts.history !== false) openHistoryDetail('habit', id);
    h.records = h.records || {}; h.notes = h.notes || '';
    const overlay = document.createElement('div'); overlay.className = 'detail-overlay';
    const head = document.createElement('div'); head.className = 'detail-head';

    /* 同模块所有习惯（与列表顺序一致）→ 可左右翻到上一个 / 下一个 */
    const siblings = sortPinned(st.habits.items);
    const idx = siblings.findIndex(x => x.id === id);
    /* 翻页：新页先叠上来再撤旧页，不重绘列表 → 中间不会闪出列表 */
    function jumpTo(i) {
      if (i < 0 || i >= siblings.length || i === idx) return;
      const dir = i > idx ? 1 : -1;
      const oldEl = overlay;
      cleanupNav(); overlay.__navCleanup = null;
      const fresh = openHabitDetail(siblings[i].id);
      commitDetailSlide(oldEl, fresh, dir);
    }
    function peekSibling(dir) {
      const i = idx + dir;
      if (i < 0 || i >= siblings.length) return null;
      return openHabitDetail(siblings[i].id);
    }
    function closeMe() {
      cleanupNav(); overlay.remove();
      if (typeof currentViewId === 'undefined' || currentViewId === 'habits') viewHabits();
    }

    /* 左：关闭按钮 */
    const closeBtn = document.createElement('button'); closeBtn.className = 'close-x dh-close'; closeBtn.textContent = '✕';
    closeBtn.title = '关闭（Esc）';
    closeBtn.onclick = () => { if (isMindRoute(history.state) && history.state.detail) history.back(); else closeMe(); };
    const titleEl = document.createElement('div'); titleEl.className = 'dh-title';
    titleEl.innerHTML = `<span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:${h.color};margin-right:8px;vertical-align:middle"></span>${esc(h.name)}<span class="dh-count">${idx + 1}/${siblings.length}</span>`;

    const prevB = chev('‹', () => jumpTo(idx - 1)); prevB.title = '上一个习惯（← 键）';
    const nextB = chev('›', () => jumpTo(idx + 1)); nextB.title = '下一个习惯（→ 键）';
    if (idx <= 0) prevB.classList.add('disabled');
    if (idx >= siblings.length - 1) nextB.classList.add('disabled');
    const editBtn = btn('编辑', () => { closeMe(); editHabit(h); }); editBtn.className = 'btn-sm'; editBtn.style.marginRight = '8px';
    const pinBtn = btn(pinActive(h) ? '取消置顶' : '置顶', () => {
      if (pinActive(h)) { h.pinned = false; h.pinFrom = ''; } else { h.pinned = true; h.pinFrom = ''; }
      Store.save();
      // 置顶会改变排序，原地换一页（轻微交叉淡化），不退回列表
      const oldEl = overlay;
      cleanupNav(); overlay.__navCleanup = null;
      const fresh = openHabitDetail(h.id);
      replaceDetailInPlace(oldEl, fresh);
      UI.toast(pinActive(h) ? '已置顶' : '已取消置顶');
    }); pinBtn.className = 'btn-sm'; pinBtn.style.marginRight = '8px';
    /* 详情内部也能打卡：点一下就是今天，再点一下取消 */
    const checkinBtn = checkinIconBtn(() => toggleToday());
    const actions = document.createElement('div'); actions.className = 'dh-actions';
    actions.append(prevB, nextB, checkinBtn, pinBtn, editBtn);
    head.append(closeBtn, titleEl, actions);
    const bodyEl = document.createElement('div'); bodyEl.className = 'detail-body';
    overlay.append(head, bodyEl); document.body.appendChild(overlay);
    const cleanupNav = enableOverlayNav(overlay, {
      prev: () => jumpTo(idx - 1),
      next: () => jumpTo(idx + 1),
      hasPrev: () => idx > 0,
      hasNext: () => idx < siblings.length - 1,
      peek: dir => peekSibling(dir),
      close: () => closeMe(),
    });
    overlay.__navCleanup = cleanupNav;

    function toggleToday() {
      const today = Store.todayStr();
      const on = !h.records[today];
      if (on) h.records[today] = true; else delete h.records[today];
      Store.save(); drawBody(); UI.toast(on ? '今日打卡成功 ✓' : '已取消今日打卡');
    }
    function syncCheckinBtn() {
      const done = !!h.records[Store.todayStr()];
      checkinBtn.classList.toggle('done', done);
      checkinBtn.title = done ? '今天已打卡，点击取消' : '点击打卡（今天）';
      const label = checkinBtn.querySelector('span');
      if (label) label.textContent = done ? '已打卡' : '打卡';
    }

    function drawBody() {
      // 备注编辑器可能还在防抖（400ms）等待保存，重绘前先让它落盘，避免内容回退
      try { const ae = document.activeElement; if (ae && ae.blur) ae.blur(); } catch (e) {}
      bodyEl.innerHTML = '';
      syncCheckinBtn();
      const calCard = UI_card('打卡日历');
      calCard.appendChild(UI.calendar({
        year: new Date().getFullYear(), month: new Date().getMonth(),
        getDots: dateStr => (h.records[dateStr] ? [h.color] : []),
        onPick: noFuturePick(dateStr => { if (h.records[dateStr]) delete h.records[dateStr]; else h.records[dateStr] = true; Store.save(); drawBody(); }),
        fillCells: true,
      }).el);
      const calHint = document.createElement('p'); calHint.className = 'muted'; calHint.style.marginTop = '8px';
      calHint.textContent = '点一下日期即可打卡 / 取消打卡，打卡那天整格会变成上面选的颜色。';
      calCard.appendChild(calHint);
      const done = Object.keys(h.records).length;
      const sum = UI_card('统计'); sum.innerHTML = `<p>累计打卡 <b>${done}</b> 天</p>`;
      const noteCard = MindMap.createMemo(h, 'notes', Store.save, '备注');
      bodyEl.append(calCard, sum, noteCard);
    }
    drawBody();
    return overlay;
  }

  /* ============================================================
     人脉
     ============================================================ */
  function viewNetwork() {
    main.innerHTML = '';
    const st = Store.get();
    const card = UI_card('人脉');
    const add = btn('+ 添加联系人', () => editContact(null));
    card.appendChild(add);
    const grid = document.createElement('div'); grid.className = 'contact-grid'; grid.style.marginTop = '14px';
    if (!st.network.length) grid.innerHTML = `<div class="empty" style="grid-column:1/-1"><p>还没有联系人</p></div>`;
    st.network.forEach(c => {
      const el = document.createElement('div'); el.className = 'card contact-card';
      el.append(UI.avatar(c.avatar, c.name), (() => {
        const d = document.createElement('div');
        d.innerHTML = `<div class="cc-name">${esc(c.name)}</div><div class="cc-rel">${esc(c.relation || '')} ${c.phone ? '· ' + esc(c.phone) : ''}</div>`;
        d.style.cursor = 'pointer'; d.onclick = () => editContact(c); return d;
      })());
      grid.appendChild(el);
    });
    card.appendChild(grid);
    main.appendChild(card);
  }

  function editContact(c) {
    const isNew = !c;
    c = c || { id: Store.uid(), name: '', relation: '', phone: '', notes: '', avatar: '' };
    const nameI = UI.input(c.name, '姓名'); const relI = UI.input(c.relation, '关系');
    const phoneI = UI.input(c.phone, '联系方式'); const notesI = UI.textarea(c.notes, '备注');
    const avI = UI.input(c.avatar, '头像图片链接（可选）');
    const body = document.createElement('div');
    body.append(UI.field('姓名', nameI), UI.field('关系', relI), UI.field('联系方式', phoneI), UI.field('头像链接', avI), UI.field('备注', notesI));
    const footer = modalFooter(() => {
      c.name = nameI.value.trim(); if (!c.name) return UI.toast('请填写姓名');
      c.relation = relI.value.trim(); c.phone = phoneI.value.trim(); c.notes = notesI.value.trim(); c.avatar = avI.value.trim();
      if (isNew) Store.addItem(Store.get().network, c); else Store.save();
      close(); viewNetwork();
    }, '删除', () => { Store.removeItem(Store.get().network, c.id); close(); viewNetwork(); });
    const close = UI.modal({ title: isNew ? '添加联系人' : '编辑联系人', body, footer });
  }

  /* ============================================================
     想法（临时灵感 / 小事）
     ============================================================ */
  function viewIdeas() {
    main.innerHTML = '';
    const st = Store.get();
    const ideas = st.ideas || [];
    const pageHead = document.createElement('div'); pageHead.className = 'page-head';
    pageHead.innerHTML = `<div class="ph-title">想法</div><div class="ph-sub">灵光一现的小事与待办：只记标题，点进去写详情与提醒</div>`;
    main.appendChild(pageHead);

    const actCard = UI_card('');
    const add = btn('+ 新建想法', () => editIdea(null));
    add.classList.add('btn-primary');
    actCard.appendChild(add);

    const list = document.createElement('div'); list.className = 'flow-list'; list.style.marginTop = '14px';
    if (!ideas.length) list.innerHTML = `<div class="empty"><p>还没有想法，点击上方「新建想法」</p></div>`;
    sortPinned(ideas).forEach(it => list.appendChild(ideaItem(it)));
    actCard.appendChild(list);
    main.appendChild(actCard);
  }

  function ideaItem(it) {
    const el = document.createElement('div'); el.className = 'flow-item';
    const unread = getReminderList().filter(x => x.source === 'idea' && x.sourceId === it.id && !x.read && (x.status === 'due' || x.status === 'overdue')).length;
    const meta = `创建于 ${it.createdAt || '—'}`
      + (it.reminders && it.reminders.length ? ` · ${it.reminders.length} 个提醒` : '')
      + (unread ? ` · <b style="color:#e23b3b">${unread} 条未读</b>` : '');
    const pinB = pinBadge(it);
    el.innerHTML = `<div class="fi-main"><span class="fi-dot" style="background:${it.color}"></span><div><div class="fi-name">${esc(it.title)}</div><div class="fi-meta">${meta}</div>${pinB ? `<div class="fi-badges">${pinB}</div>` : ''}</div></div><div class="fi-status">›</div>`;
    paintItem(el, it.color);
    el.onclick = () => openIdeaDetail(it.id);
    el.addEventListener('contextmenu', e => openItemMenu(e, it, [
      { label: '✏️ 编辑想法…', action: () => editIdea(it) },
      { label: '🗑️ 删除想法', action: () => { if (confirm('确认删除该想法？')) { Store.removeItem(Store.get().ideas, it.id); viewIdeas(); } } },
    ], viewIdeas));
    return el;
  }

  function editIdea(idea) {
    const isNew = !idea;
    idea = idea || { id: Store.uid(), title: '', color: Store.PALETTE[Math.floor(Math.random() * Store.PALETTE.length)], memo: '', createdAt: Store.todayStr(), reminders: [] };
    const titleI = UI.input(idea.title, '想法标题（一句话）');
    const colorWrap = document.createElement('div');
    let color = idea.color;
    colorWrap.appendChild(UI.colorChips(color, c => color = c));
    const body = document.createElement('div');
    body.append(UI.field('标题', titleI), UI.field('颜色', colorWrap));
    const footer = modalFooter(() => {
      const t = titleI.value.trim(); if (!t) return UI.toast('请填写标题');
      idea.title = t; idea.color = color;
      if (isNew) Store.addItem(Store.get().ideas, idea); else Store.save();
      close(); viewIdeas();
    }, isNew ? null : '删除', isNew ? null : () => { Store.removeItem(Store.get().ideas, idea.id); close(); viewIdeas(); });
    const close = UI.modal({ title: isNew ? '新建想法' : '编辑想法', body, footer });
  }

  function openIdeaDetail(id, opts = {}) {
    const st = Store.get();
    const idea = (st.ideas || []).find(x => x.id === id); if (!idea) return;
    if (opts.history !== false) openHistoryDetail('idea', id);
    idea.memo = idea.memo || ''; idea.reminders = idea.reminders || [];
    const overlay = document.createElement('div'); overlay.className = 'detail-overlay';
    const head = document.createElement('div'); head.className = 'detail-head';
    head.innerHTML = `<div class="dh-title"><span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:${idea.color};margin-right:8px;vertical-align:middle"></span>${esc(idea.title)}</div>`;
    const edit = btn('编辑', () => { closeOverlay(); editIdea(idea); }); edit.className = 'btn-sm'; edit.style.marginRight = '8px';
    const closeBtn = document.createElement('button'); closeBtn.className = 'close-x'; closeBtn.textContent = '✕';
    const closeOverlay = () => overlay.remove();
    closeBtn.onclick = () => { if (isMindRoute(history.state) && history.state.detail) history.back(); else closeOverlay(); };
    head.append(edit, closeBtn);
    const bodyEl = document.createElement('div'); bodyEl.className = 'detail-body';
    overlay.append(head, bodyEl); document.body.appendChild(overlay);

    function redraw() {
      bodyEl.innerHTML = '';
      // 备忘录（支持思维导图模式）
      const memoCard = MindMap.createMemo(idea, 'memo', Store.save, '备忘录');
      // 时间提醒
      const remCard = UI_card('时间提醒');
      const tl = document.createElement('div'); tl.className = 'timeline';
      if (!idea.reminders.length) tl.innerHTML = `<div class="muted">暂无提醒，点击下方添加</div>`;
      idea.reminders.forEach((r, i) => {
        const dt = Store.parseDate(r.date);
        const todayT = Store.parseDate(Store.todayStr());
        const diff = Math.round((dt - todayT) / 86400000);
        const dstr = diff === 0 ? '今天' : (diff < 0 ? `已过期 ${-diff} 天` : `还有 ${diff} 天`);
        const it = document.createElement('div'); it.className = 'tl-item' + (r.read ? ' read' : '');
        it.innerHTML = `<div class="tl-date">${esc(r.date)} · ${dstr}${r.read ? ' · 已读' : ''}</div><div class="tl-title">${esc(r.title)}</div>`;
        it.style.cursor = 'pointer'; it.onclick = () => editIdeaReminder(idea, r, i, redraw);
        tl.appendChild(it);
      });
      const addRem = btn('+ 添加提醒', () => editIdeaReminder(idea, null, -1, redraw));
      remCard.append(tl, addRem);
      bodyEl.append(memoCard, remCard);
    }
    redraw();
  }

  function editIdeaReminder(idea, r, idx, redraw) {
    const isNew = idx < 0;
    const cfg = Store.get().reminder || { on: true, defaultLead: 1 };
    r = r || { id: Store.uid(), date: Store.todayStr(), title: '', remind: true, lead: cfg.defaultLead != null ? cfg.defaultLead : 1, channel: 'inapp', read: false };
    const dateI = UI.input(r.date, '日期 YYYY-MM-DD');
    const titleI = UI.input(r.title, '提醒说明（如：发布第一篇内容）');
    const remindChk = UI.input('', ''); remindChk.type = 'checkbox'; remindChk.checked = (r.remind !== false); remindChk.style.width = 'auto'; remindChk.style.margin = '0 6px 0 0';
    const remindLabel = document.createElement('label'); remindLabel.className = 'row'; remindLabel.style.alignItems = 'center'; remindLabel.style.gap = '4px';
    remindLabel.append(remindChk, document.createTextNode('到点提醒我'));
    const leadSel = UI.select([{ value: '0', text: '当天提醒' }, { value: '1', text: '提前 1 天' }, { value: '3', text: '提前 3 天' }, { value: '7', text: '提前 7 天' }], String(r.lead != null ? r.lead : (cfg.defaultLead != null ? cfg.defaultLead : 1)));
    const chanSel = UI.select([{ value: 'inapp', text: '应用内提醒（打开本页即提示）' }, { value: 'system', text: '系统通知（桌面 / 手机弹窗）' }], r.channel || 'inapp');
    const body = document.createElement('div');
    body.append(UI.field('日期', dateI), UI.field('说明', titleI), UI.field('提醒设置', remindLabel), UI.field('提前提醒天数', leadSel), UI.field('提醒方式', chanSel));
    const footer = modalFooter(() => {
      r.date = dateI.value.trim(); r.title = titleI.value.trim(); if (!r.title) return UI.toast('请填写说明');
      r.remind = remindChk.checked; r.lead = parseInt(leadSel.value, 10); r.channel = chanSel.value;
      if (isNew) idea.reminders.push(r); else idea.reminders[idx] = r;
      Store.save(); close(); redraw();
    }, isNew ? null : '删除', isNew ? null : () => { idea.reminders.splice(idx, 1); Store.save(); close(); redraw(); });
    const close = UI.modal({ title: isNew ? '添加提醒' : '编辑提醒', body, footer });
  }

  /* ============================================================
     周复盘（以周为单位）
     ============================================================ */
  // 周计算辅助（周一为周起点）
  function weekMonday(d) {
    const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const diff = (x.getDay() + 6) % 7; // 距离本周一的天数
    x.setDate(x.getDate() - diff);
    return x;
  }
  function addDays(d, n) { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() + n); return x; }
  function isoWeek(d) {
    const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const day = (x.getDay() + 6) % 7;
    x.setDate(x.getDate() - day + 3);
    const firstThu = new Date(x.getFullYear(), 0, 4);
    const fday = (firstThu.getDay() + 6) % 7;
    firstThu.setDate(firstThu.getDate() - fday + 3);
    const week = 1 + Math.round((x - firstThu) / 6048e5);
    return { year: x.getFullYear(), week };
  }
  function rchev(s) { const b = document.createElement('button'); b.className = 'cal-chev'; b.textContent = s; return b; }

  /* 统计用舍入：保留两位小数（时长可以是小数小时，别截成整数） */
  const r1 = v => Math.round((+v || 0) * 100) / 100;

  /* ============================================================
     周复盘：汇总「基本学习记录 + 技能养成记录 + 习惯养成」三个模块
     —— 时长单位统一为「小时」；平均值按「本周已过天数」算，
        本周还没过完时不会用 7 天去摊薄。
     ============================================================ */
  function collectWeekData(monday) {
    const st = Store.get();
    const today = Store.todayStr();
    const DOW = ['一', '二', '三', '四', '五', '六', '日'];
    const subjMap = {}, skillMap = {};
    st.learning.subjects.forEach(s => subjMap[s.id] = s);
    st.skills.items.forEach(s => skillMap[s.id] = s);
    st.learning.daySubjects = st.learning.daySubjects || {};

    const days = [];
    let learnTotal = 0, skillTotal = 0, habitTotal = 0, learnDays = 0, skillDays = 0, passed = 0;
    const learnByItem = {}, skillByItem = {}, habitCnt = {};

    for (let i = 0; i < 7; i++) {
      const ds = Store.fmtDate(addDays(monday, i));
      const future = ds > today;
      if (!future) passed++;

      let lh = 0;
      const lr = st.learning.daySubjects[ds] || {};
      Object.keys(lr).forEach(k => { const v = +lr[k] || 0; if (v > 0) { lh += v; learnByItem[k] = (learnByItem[k] || 0) + v; } });

      let sh = 0;
      st.skills.items.forEach(s => {
        const v = +((s.records || {})[ds]) || 0;
        if (v > 0) { sh += v; skillByItem[s.id] = (skillByItem[s.id] || 0) + v; }
      });

      const done = [];
      (st.habits.items || []).forEach(h => {
        if ((h.records || {})[ds]) { done.push(h.id); habitCnt[h.id] = (habitCnt[h.id] || 0) + 1; habitTotal++; }
      });

      if (lh > 0) learnDays++;
      if (sh > 0) skillDays++;
      learnTotal += lh; skillTotal += sh;
      days.push({ ds, label: DOW[i], learn: r1(lh), skill: r1(sh), habits: done, future });
    }

    const base = Math.max(1, passed);           // 用来算平均的天数
    const metrics = {
      learnAvgPerDay: r1(learnTotal / base), learnWeek: r1(learnTotal), learnDays: learnDays,
      skillAvgPerDay: r1(skillTotal / base), skillWeek: r1(skillTotal), skillDays: skillDays,
      habitTotal: habitTotal,
      totalAvgPerDay: r1((learnTotal + skillTotal) / base), totalWeek: r1(learnTotal + skillTotal),
      activeDays: learnDays + skillDays, elapsed: passed,
    };
    const mkList = (byItem, mapObj) => Object.keys(byItem)
      .map(id => ({ id, name: (mapObj[id] || {}).name || '（已删除）', color: (mapObj[id] || {}).color || '#9aa0a8', hours: r1(byItem[id]) }))
      .sort((a, b) => b.hours - a.hours);
    const habitItems = (st.habits.items || []).map(h => ({
      id: h.id, name: h.name, color: h.color || '#9aa0a8',
      days: habitCnt[h.id] || 0, marks: days.map(d => d.habits.indexOf(h.id) >= 0),
    }));
    return { days, metrics, learnItems: mkList(learnByItem, subjMap), skillItems: mkList(skillByItem, skillMap), habitItems };
  }

  /* 达标判定：goal <= 0 表示没设目标，不判定 */
  function goalCheck(name, unit, actual, goal) {
    if (!(goal > 0)) return { name, unit, actual, goal: 0, state: 'none', ok: null, diff: null };
    const ok = actual >= goal;
    return { name, unit, actual, goal, state: ok ? 'ok' : 'bad', ok, diff: r1(actual - goal) };
  }

  const REV_METRICS = [
    ['learnAvgPerDay', '平均每天学习', '小时'],
    ['learnWeek', '每周学习总时长', '小时'],
    ['learnDays', '每周学习打卡', '天'],
    ['skillAvgPerDay', '平均每天练技能', '小时'],
    ['skillWeek', '每周技能总时长', '小时'],
    ['skillDays', '每周技能练习', '天'],
    ['habitTotal', '每周习惯完成', '次'],
  ];

  /* 生成一份完整的周复盘报告（生成后作为快照永久保存） */
  function buildReviewReport(monday) {
    const st = Store.get();
    const d = collectWeekData(monday);
    const g = st.reviewGoals;
    const m = d.metrics;
    const checks = REV_METRICS.map(([k, label, unit]) => goalCheck(label, unit, m[k], g[k]));
    const habitChecks = d.habitItems.map(h => goalCheck(h.name, '天', h.days, g.perHabit[h.id] || 0));
    const now = new Date(), p = n => String(n).padStart(2, '0');
    return {
      key: Store.fmtDate(monday),
      from: Store.fmtDate(monday), to: Store.fmtDate(addDays(monday, 6)),
      generatedAt: now.getFullYear() + '-' + p(now.getMonth() + 1) + '-' + p(now.getDate()) + ' ' + p(now.getHours()) + ':' + p(now.getMinutes()),
      goals: JSON.parse(JSON.stringify(g)),
      days: d.days, metrics: m,
      learnItems: d.learnItems, skillItems: d.skillItems, habitItems: d.habitItems,
      checks: checks, habitChecks: habitChecks,
      summary: {
        hit: checks.filter(c => c.state === 'ok').length,
        miss: checks.filter(c => c.state === 'bad').length,
        unset: checks.filter(c => c.state === 'none').length,
      },
    };
  }

  /* ---------- 目标（标准值）设置 ---------- */
  function openReviewGoals(onDone) {
    const st = Store.get();
    const g = st.reviewGoals;
    const numI = (v) => { const i = UI.input(v ? String(v) : '', '0 = 不设目标'); i.type = 'number'; i.min = '0'; i.step = '0.01'; return i; };
    const inputs = {};
    const body = document.createElement('div');
    const tip = document.createElement('p'); tip.className = 'muted';
    tip.textContent = '达到或超过标准值 → 绿色「达标」；没达到 → 红色「未达标」。填 0 或留空表示不设这个目标，报告里不判定。';
    body.appendChild(tip);
    const grid = document.createElement('div'); grid.className = 'rev-goal-grid';
    REV_METRICS.forEach(([k, label, unit]) => {
      inputs[k] = numI(g[k]);
      grid.appendChild(UI.field(label + '（' + unit + '）', inputs[k]));
    });
    body.appendChild(grid);

    const habits = st.habits.items || [];
    if (habits.length) {
      const t = document.createElement('div'); t.className = 'rev-goal-sub'; t.textContent = '每个习惯 · 每周目标天数';
      body.appendChild(t);
      const hg = document.createElement('div'); hg.className = 'rev-goal-grid';
      inputs._habits = {};
      habits.forEach(h => {
        inputs._habits[h.id] = numI(g.perHabit[h.id] || 0);
        hg.appendChild(UI.field(h.name + '（天/周）', inputs._habits[h.id]));
      });
      body.appendChild(hg);
    }

    const footer = modalFooter(() => {
      REV_METRICS.forEach(([k]) => { const v = parseFloat(inputs[k].value); g[k] = isNaN(v) || v < 0 ? 0 : v; });
      if (inputs._habits) Object.keys(inputs._habits).forEach(id => { const v = parseFloat(inputs._habits[id].value); if (!isNaN(v) && v > 0) g.perHabit[id] = v; else delete g.perHabit[id]; });
      Store.save(); close(); onDone && onDone(); UI.toast('标准值已保存');
    });
    const close = UI.modal({ title: '设定本周标准值（目标）', body, footer });
  }

  let reviewWeek = null;
  const MOODS = ['疲惫', '平淡', '还行', '充实', '超棒'];

  function viewReview() {
    main.innerHTML = '';
    if (!reviewWeek) reviewWeek = weekMonday(new Date());
    const st = Store.get();
    st.reviewSnapshots = st.reviewSnapshots || {};
    st.reviewGoals = st.reviewGoals || { perHabit: {} };

    const monday = reviewWeek;
    const key = Store.fmtDate(monday);
    const w = isoWeek(monday);
    const thisMon = weekMonday(new Date());
    const atCurrent = key === Store.fmtDate(thisMon);

    const pageHead = document.createElement('div'); pageHead.className = 'page-head';
    pageHead.innerHTML = '<div class="ph-title">复盘</div><div class="ph-sub">每周日晚点一次「开始复盘」，自动汇总学习 / 技能 / 习惯三个模块的数据</div>';
    main.appendChild(pageHead);

    /* ---------- 周导航 ---------- */
    const navCard = UI_card('');
    navCard.className = 'card rev-navcard';
    const nav = document.createElement('div'); nav.className = 'cal-head';
    const prev = rchev('‹'); prev.title = '上一周';
    const next = rchev('›'); next.title = '下一周';
    const title = document.createElement('span'); title.className = 'cal-title';
    title.textContent = w.year + ' 年第 ' + w.week + ' 周 · ' + Store.fmtDate(monday) + ' ~ ' + Store.fmtDate(addDays(monday, 6));
    prev.onclick = () => { reviewWeek = addDays(reviewWeek, -7); viewReview(); };
    next.onclick = () => { if (atCurrent) { UI.toast('已经是最新一周了'); return; } reviewWeek = addDays(reviewWeek, 7); viewReview(); };
    const actions = document.createElement('div'); actions.className = 'cal-actions';
    actions.appendChild(btn('⚙ 标准值', () => openReviewGoals(() => viewReview())));
    if (!atCurrent) actions.appendChild(btn('回到本周', () => { reviewWeek = thisMon; viewReview(); }));
    nav.append(prev, title, next);
    navCard.append(nav, actions);
    main.appendChild(navCard);

    const snap = st.reviewSnapshots[key];
    if (!snap) renderReviewStart(key, monday, atCurrent);
    else renderReviewReport(snap, atCurrent);
  }

  /* ---------- 未复盘：显示「开始复盘」 ---------- */
  function renderReviewStart(key, monday, atCurrent) {
    const st = Store.get();
    const cur = collectWeekData(monday);
    const hero = UI_card('');
    hero.className = 'card rev-hero';
    const ico = document.createElement('div'); ico.className = 'rev-hero-ico'; ico.textContent = '🗓️';
    const t = document.createElement('div'); t.className = 'rev-hero-t'; t.textContent = '本周还没复盘';
    const s = document.createElement('div'); s.className = 'rev-hero-s';
    s.textContent = '点下面的按钮，系统会把这一周（周一 ~ 周日）里「基本学习记录」「技能养成记录」「习惯养成」三个模块的数据全部汇总起来：算出平均每天投入、每周总时长、打卡天数和每个习惯的完成情况，再和你设定的标准值逐项对比（达标绿 / 未达标红），最后把这份报告永久保存下来。';
    hero.append(ico, t, s);

    // 未生成前也能先看到当前累计
    const prevRow = document.createElement('div'); prevRow.className = 'rev-stat-row rev-stat-row-3';
    [
      [cur.metrics.learnWeek, '学习小时（已记录）', ''],
      [cur.metrics.skillWeek, '技能小时（已记录）', ''],
      [cur.metrics.habitTotal, '习惯完成次数', ''],
    ].forEach(([n, l]) => {
      const c = document.createElement('div'); c.className = 'rev-stat';
      c.innerHTML = '<div class="rev-stat-n">' + n + '</div><div class="rev-stat-l">' + l + '</div>';
      prevRow.appendChild(c);
    });
    hero.appendChild(prevRow);

    const btnRow = document.createElement('div'); btnRow.className = 'rev-hero-btns';
    const start = btn('▶ 开始复盘', () => {
      const rep = buildReviewReport(monday);
      Store.get().reviewSnapshots[key] = rep;
      Store.save();
      UI.toast('复盘报告已生成并保存');
      viewReview();
    });
    start.classList.add('btn-primary', 'rev-start-btn');
    const goal = btn('⚙ 先设定标准值', () => openReviewGoals(() => viewReview()));
    btnRow.append(start, goal);
    hero.appendChild(btnRow);
    main.appendChild(hero);
  }

  /* ---------- 已复盘：渲染报告 ---------- */
  function renderReviewReport(snap, atCurrent) {
    const m = snap.metrics;

    /* 1. 总览大数字 + 达标状态 */
    const ovCard = UI_card('本周概览');
    const row = document.createElement('div'); row.className = 'rev-stat-row';
    [
      { n: m.learnAvgPerDay, l: '平均每天学习（小时）', c: snap.checks[0] },
      { n: m.learnWeek, l: '本周学习总时长（小时）', c: snap.checks[1] },
      { n: m.skillAvgPerDay, l: '平均每天练技能（小时）', c: snap.checks[3] },
      { n: m.skillWeek, l: '本周技能总时长（小时）', c: snap.checks[4] },
      { n: m.habitTotal, l: '本周习惯完成（次）', c: snap.checks[6] },
    ].forEach(it => {
      const c = document.createElement('div'); c.className = 'rev-stat';
      if (it.c && it.c.state !== 'none') c.classList.add(it.c.state === 'ok' ? 'is-ok' : 'is-bad');
      const n = document.createElement('div'); n.className = 'rev-stat-n'; n.textContent = it.n;
      const l = document.createElement('div'); l.className = 'rev-stat-l'; l.textContent = it.l;
      c.append(n, l);
      if (it.c && it.c.state !== 'none') {
        const tag = document.createElement('span'); tag.className = 'rev-tag ' + it.c.state;
        tag.textContent = (it.c.ok ? '达标' : '未达标') + ' · 目标 ' + it.c.goal;
        c.appendChild(tag);
      }
      row.appendChild(c);
    });
    ovCard.appendChild(row);

    const sumLine = document.createElement('div'); sumLine.className = 'rev-summary';
    const parts = [];
    if (snap.summary.hit) parts.push('<b class="ok">' + snap.summary.hit + '</b> 项达标');
    if (snap.summary.miss) parts.push('<b class="bad">' + snap.summary.miss + '</b> 项未达标');
    if (snap.summary.unset) parts.push('<span class="muted">' + snap.summary.unset + ' 项未设目标</span>');
    sumLine.innerHTML = parts.join(' &nbsp;·&nbsp; ') || '<span class="muted">还没有设定任何标准值</span>';
    sumLine.innerHTML += '<span class="muted"> &nbsp;·&nbsp; 平均按本周已过 ' + m.elapsed + ' 天计算</span>';
    ovCard.appendChild(sumLine);
    main.appendChild(ovCard);

    /* 2. 每天投入（堆叠柱） */
    const dayCard = UI_card('每天投入时长（小时）');
    const legend = document.createElement('div'); legend.className = 'rev-legend';
    legend.innerHTML = '<span><i class="sw learn"></i>学习</span><span><i class="sw skill"></i>技能</span><span><i class="sw hab"></i>当天有打卡的习惯数</span>';
    dayCard.appendChild(legend);
    dayCard.appendChild(revDayChart(snap.days));
    main.appendChild(dayCard);

    /* 3. 达标明细（目标 vs 实际） */
    const chkCard = UI_card('达标明细（实际 vs 标准值）');
    const anyGoal = snap.checks.some(c => c.state !== 'none') || snap.habitChecks.some(c => c.state !== 'none');
    if (!anyGoal) {
      const tip = document.createElement('div'); tip.className = 'muted';
      tip.textContent = '还没有设定标准值。点右上角「⚙ 标准值」设置后，这里会用绿色 / 红色标出每一项是否达标。';
      chkCard.appendChild(tip);
    } else {
      snap.checks.forEach(c => chkCard.appendChild(revCheckRow(c)));
      if (snap.habitChecks.length) {
        const sub = document.createElement('div'); sub.className = 'rev-goal-sub'; sub.textContent = '每个习惯 · 每周天数';
        chkCard.appendChild(sub);
        snap.habitChecks.forEach(c => chkCard.appendChild(revCheckRow(c)));
      }
    }
    main.appendChild(chkCard);

    /* 4. 学习 / 技能 明细 */
    main.appendChild(revItemCard('学习项目明细（本周合计）', snap.learnItems, m.learnWeek));
    main.appendChild(revItemCard('技能项目明细（本周合计）', snap.skillItems, m.skillWeek));

    /* 5. 习惯明细 */
    const hCard = UI_card('习惯完成明细（7 天）');
    if (!snap.habitItems.length) hCard.innerHTML += '<div class="empty"><p>还没有习惯</p></div>';
    snap.habitItems.forEach(h => hCard.appendChild(revHabitRow(h)));
    main.appendChild(hCard);

    /* 6. 历史趋势 */
    main.appendChild(revTrendCard());

    /* 7. 感受 + 备忘录 */
    const st = Store.get();
    st.reviews = st.reviews || {};
    const rec = st.reviews[snap.key] || (st.reviews[snap.key] = { content: '', mood: 0, updatedAt: '' });
    const feelCard = UI_card('本周感受与备忘录');
    const moodWrap = document.createElement('div'); moodWrap.className = 'rev-mood';
    const moodLabel = document.createElement('div'); moodLabel.className = 'muted'; moodLabel.style.marginBottom = '8px';
    moodLabel.textContent = '本周状态（点击选择，自动保存）';
    const chips = document.createElement('div'); chips.className = 'chip-row';
    MOODS.forEach((txt, i) => {
      const lvl = i + 1;
      const chip = document.createElement('span'); chip.className = 'chip' + (rec.mood === lvl ? ' sel' : '');
      chip.textContent = txt;
      chip.onclick = () => {
        rec.mood = (rec.mood === lvl ? 0 : lvl);
        chips.querySelectorAll('.chip').forEach(c => c.classList.remove('sel'));
        if (rec.mood) chip.classList.add('sel');
        Store.save(); UI.toast('已记录本周状态：' + txt);
      };
      chips.appendChild(chip);
    });
    moodWrap.append(moodLabel, chips);
    feelCard.appendChild(moodWrap);
    feelCard.appendChild(MindMap.createMemo(rec, 'content', Store.save, '备忘录 / 感受（自动保存）'));
    main.appendChild(feelCard);

    /* 8. 底部操作 */
    const foot = document.createElement('div'); foot.className = 'rev-foot';
    const info = document.createElement('span'); info.className = 'muted';
    info.textContent = '报告生成于 ' + snap.generatedAt + ' · 已永久保存，可随时回来查看';
    const again = btn('↻ 重新生成本周', () => {
      Store.get().reviewSnapshots[snap.key] = buildReviewReport(Store.parseDate(snap.key));
      Store.save(); viewReview(); UI.toast('已按最新数据重新生成');
    });
    const del = btn('删除本周复盘', () => {
      if (!confirm('删除这一周的复盘报告？（备忘录和感受会保留）')) return;
      delete Store.get().reviewSnapshots[snap.key]; Store.save(); viewReview(); UI.toast('已删除');
    }); del.className = 'btn-danger';
    foot.append(info, again, del);
    main.appendChild(foot);
  }

  /* 每天投入：堆叠柱 */
  function revDayChart(days) {
    const wrap = document.createElement('div'); wrap.className = 'rev-days';
    const max = Math.max(1, ...days.map(d => d.learn + d.skill));
    days.forEach(d => {
      const col = document.createElement('div'); col.className = 'rev-day' + (d.future ? ' future' : '');
      const tot = r1(d.learn + d.skill);
      const val = document.createElement('div'); val.className = 'rev-day-val'; val.textContent = tot ? tot + 'h' : '';
      const box = document.createElement('div'); box.className = 'rev-day-box';
      const ls = document.createElement('div'); ls.className = 'rev-seg learn'; ls.style.height = (d.learn / max * 100) + '%';
      const ss = document.createElement('div'); ss.className = 'rev-seg skill'; ss.style.height = (d.skill / max * 100) + '%';
      box.append(ls, ss);
      const lab = document.createElement('div'); lab.className = 'rev-day-lab'; lab.textContent = '周' + d.label;
      const dotRow = document.createElement('div'); dotRow.className = 'rev-day-hab';
      dotRow.textContent = d.habits.length ? '●'.repeat(Math.min(d.habits.length, 5)) : '·';
      const dd = document.createElement('div'); dd.className = 'rev-day-date'; dd.textContent = d.ds.slice(5);
      col.append(val, box, lab, dotRow, dd);
      col.title = d.ds + ' 周' + d.label + '｜学习 ' + d.learn + 'h｜技能 ' + d.skill + 'h｜习惯 ' + d.habits.length + ' 项' + (d.future ? '（未到）' : '');
      wrap.appendChild(col);
    });
    return wrap;
  }

  /* 单项达标行：名称 | 进度条 | 实际/目标 | 状态 */
  function revCheckRow(c) {
    const row = document.createElement('div'); row.className = 'rev-check ' + c.state;
    const name = document.createElement('div'); name.className = 'rc-name'; name.textContent = c.name;
    const track = document.createElement('div'); track.className = 'rc-track';
    if (c.state === 'none') {
      const fill = document.createElement('div'); fill.className = 'rc-fill none'; fill.style.width = '100%';
      track.appendChild(fill);
    } else {
      const pct = Math.min(100, c.goal > 0 ? (c.actual / c.goal * 100) : 0);
      const fill = document.createElement('div'); fill.className = 'rc-fill ' + c.state; fill.style.width = Math.max(2, pct) + '%';
      track.appendChild(fill);
    }
    const val = document.createElement('div'); val.className = 'rc-val';
    val.innerHTML = '<b>' + c.actual + '</b>' + (c.state === 'none' ? '' : ' / ' + c.goal) + ' ' + c.unit;
    const tag = document.createElement('span'); tag.className = 'rev-tag ' + c.state;
    tag.textContent = c.state === 'none' ? '未设目标' : (c.ok ? '达标' : '未达标');
    row.append(name, track, val, tag);
    return row;
  }

  /* 学习 / 技能 明细卡片 */
  function revItemCard(title, items, total) {
    const card = UI_card(title);
    if (!items.length) { card.innerHTML += '<div class="empty"><p>本周没有记录</p></div>'; return card; }
    items.forEach(it => {
      const row = document.createElement('div'); row.className = 'rev-item';
      const dot = document.createElement('span'); dot.className = 'ri-dot'; dot.style.background = it.color;
      const nm = document.createElement('div'); nm.className = 'ri-name'; nm.textContent = it.name;
      const track = document.createElement('div'); track.className = 'rc-track';
      const fill = document.createElement('div'); fill.className = 'rc-fill norm';
      fill.style.width = Math.max(2, total > 0 ? it.hours / total * 100 : 0) + '%';
      fill.style.background = it.color;
      track.appendChild(fill);
      const val = document.createElement('div'); val.className = 'rc-val';
      val.innerHTML = '<b>' + it.hours + '</b> 小时<span class="muted"> · 平均 ' + r1(it.hours / 7) + '/天</span>';
      row.append(dot, nm, track, val);
      card.appendChild(row);
    });
    return card;
  }

  /* 习惯明细行：7 个小方块 */
  function revHabitRow(h) {
    const row = document.createElement('div'); row.className = 'rev-habit';
    const dot = document.createElement('span'); dot.className = 'ri-dot'; dot.style.background = h.color;
    const nm = document.createElement('div'); nm.className = 'ri-name'; nm.textContent = h.name;
    const strip = document.createElement('div'); strip.className = 'rev-strip';
    const DOW = ['一', '二', '三', '四', '五', '六', '日'];
    h.marks.forEach((on, i) => {
      const sq = document.createElement('span'); sq.className = 'rs-sq' + (on ? ' on' : '');
      if (on) sq.style.background = h.color;
      sq.textContent = DOW[i]; sq.title = '周' + DOW[i] + (on ? ' 已打卡' : ' 未打卡');
      strip.appendChild(sq);
    });
    const val = document.createElement('div'); val.className = 'rc-val';
    val.innerHTML = '<b>' + h.days + '</b> / 7 天';
    row.append(dot, nm, strip, val);
    return row;
  }

  /* 历史趋势：已存档的各周 */
  function revTrendCard() {
    const st = Store.get();
    const keys = Object.keys(st.reviewSnapshots || {}).sort().slice(-8);
    const card = UI_card('历史趋势（最近 ' + keys.length + ' 周）');
    if (keys.length < 2) {
      const tip = document.createElement('div'); tip.className = 'muted';
      tip.textContent = '至少复盘两周后，这里就会出现每周学习 / 技能投入的变化曲线。';
      card.appendChild(tip);
      return card;
    }
    const pts1 = keys.map(k => ({ label: k.slice(5), value: (st.reviewSnapshots[k].metrics.learnWeek || 0) + (st.reviewSnapshots[k].metrics.skillWeek || 0) }));
    const pts2 = keys.map(k => ({ label: k.slice(5), value: st.reviewSnapshots[k].metrics.habitTotal || 0 }));
    const h1 = document.createElement('div'); h1.className = 'rev-trend-h'; h1.textContent = '每周总投入时长（学习 + 技能，小时）';
    const h2 = document.createElement('div'); h2.className = 'rev-trend-h'; h2.textContent = '每周习惯完成次数';
    card.append(h1, UI.lineChart(pts1, { color: '#3D7EFF' }), h2, UI.lineChart(pts2, { color: '#2bc58c' }));
    return card;
  }

  /* ============================================================
     项目（机会档案）
     ============================================================ */
  const FLOW_TYPES = ['兼职', '实习', '比赛', '奖学金', '志愿活动', '合作机会', '自媒体', '其他'];
  function viewFlow() {
    main.innerHTML = '';
    const st = Store.get();
    const card = UI_card('项目');
    const intro = document.createElement('p'); intro.className = 'muted';
    intro.textContent = '把 ChatGPT、豆包、朋友或网站提供的机会记在这里：保存来源、链接、截止时间、所需技能和你的跟进记录。';
    const add = btn('+ 记录机会', () => editFlowProject(null));
    card.append(intro, add);
    const list = document.createElement('div'); list.className = 'flow-list'; list.style.marginTop = '14px';
    const today = Store.todayStr();
    // 排序：置顶 → 已激活(按日期) → 普通 → 休眠(沉底、按日期)
    const flowKey = (p) => {
      if (p.priority === 'urgent') return '0' + (p.lastModified || '');
      if (p.priority === 'later') {
        const after = p.showAfter || '9999-12-31';
        return (after <= today ? '1' : '3') + after;
      }
      return '2' + (p.lastModified || '');
    };
    const ordered = st.projects.slice().sort((a, b) => {
      const pa = pinActive(a) ? 0 : 1, pb = pinActive(b) ? 0 : 1;
      if (pa !== pb) return pa - pb;
      return flowKey(a).localeCompare(flowKey(b));
    });
    if (!ordered.length) list.innerHTML = `<div class="empty"><p>还没有项目</p></div>`;
    ordered.forEach(p => list.appendChild(flowItem(p, today)));
    card.appendChild(list);
    main.appendChild(card);
  }

  function flowItem(p, today) {
    const el = document.createElement('div'); el.className = 'flow-item';
    const statusCls = p.status === '结束' ? 's-on' : (p.status === '跟进' ? 's-doing' : 's-none');
    const source = p.source ? ` · 来源：${p.source}` : '';
    const meta = `${p.type || ''}${source} · 最近修改 ${p.lastModified || '—'}`;
    // 优先级徽标
    let badge = '', extraCls = '';
    if (p.priority === 'urgent') {
      badge = '<span class="fi-pill urgent">置顶</span>';
    } else if (p.priority === 'later') {
      const after = p.showAfter || '';
      if (after && after <= today) { badge = '<span class="fi-pill active">🔔 已激活 · 往前排</span>'; extraCls = ' fi-active'; }
      else { badge = `<span class="fi-pill dormant">🕓 ${esc(after)} 起可见</span>`; extraCls = ' fi-dormant'; }
    }
    const pinB = pinBadge(p);
    if (pinB) badge += pinB;
    if (extraCls) el.className += extraCls;
    el.innerHTML = `<div class="fi-main"><span class="fi-type">${esc(p.type || '未分类')}</span><div><div class="fi-name">${esc(p.name)}</div><div class="fi-meta">${esc(meta)}</div>${badge ? `<div class="fi-badges">${badge}</div>` : ''}</div></div><div class="fi-status"><span class="status-dot ${statusCls}"></span></div>`;
    // 整个长方形刷成项目自己的颜色（不只是前面一个圆点）
    paintItem(el, p.color);
    // 长按改状态
    let timer = null, longed = false;
    const start = (e) => { if (e && e.button === 2) return; longed = false; timer = setTimeout(() => { longed = true; el.classList.add('press'); openStatusMenu(p); }, 480); };
    const cancel = () => { clearTimeout(timer); el.classList.remove('press'); };
    el.addEventListener('pointerdown', start);
    el.addEventListener('pointerup', cancel);
    el.addEventListener('pointerleave', cancel);
    el.addEventListener('pointermove', cancel);
    el.addEventListener('contextmenu', e => {
      openItemMenu(e, p, [
        { label: '✏️ 编辑机会…', action: () => editFlowProject(p) },
        { label: '✅ 标记为「还在跟进」', action: () => { p.status = '跟进'; p.lastModified = Store.todayStr(); Store.save(); viewFlow(); } },
        { label: '🏁 标记为「已结束」', action: () => { p.status = '结束'; p.lastModified = Store.todayStr(); Store.save(); viewFlow(); } },
        { label: '🗑️ 删除项目', action: () => { if (confirm('确认删除该项目？')) { Store.removeItem(Store.get().projects, p.id); viewFlow(); } } },
      ], viewFlow);
    });
    el.addEventListener('click', () => { if (!longed) openFlowDetail(p.id); });
    return el;
  }

  function openStatusMenu(p) {
    const body = document.createElement('div');
    const opt = (label, val) => { const b = btn(label, () => { p.status = val; p.lastModified = Store.todayStr(); Store.save(); close(); viewFlow(); }); b.style.width = '100%'; b.style.marginBottom = '8px'; return b; };
    // 置顶 / 定时置顶 / 不置顶（长按也能用，等价于右键菜单）
    const pinRow = document.createElement('div'); pinRow.className = 'seg'; pinRow.style.marginBottom = '10px';
    const bNow = document.createElement('button'); bNow.type = 'button'; bNow.className = 'seg-btn'; bNow.textContent = '📌 置顶';
    const bDate = document.createElement('button'); bDate.type = 'button'; bDate.className = 'seg-btn'; bDate.textContent = '🗓️ 定时置顶';
    const bNone = document.createElement('button'); bNone.type = 'button'; bNone.className = 'seg-btn'; bNone.textContent = '🚫 不置顶';
    bNow.classList.toggle('on', pinActive(p) && !p.pinFrom);
    bDate.classList.toggle('on', pinWaiting(p) || (pinActive(p) && !!p.pinFrom));
    bNone.classList.toggle('on', !p.pinned);
    bNow.onclick = () => { p.pinned = true; p.pinFrom = ''; Store.save(); close(); viewFlow(); UI.toast('已置顶'); };
    bDate.onclick = () => { close(); askPinDate(p, viewFlow); };
    bNone.onclick = () => { p.pinned = false; p.pinFrom = ''; Store.save(); close(); viewFlow(); UI.toast('已取消置顶'); };
    pinRow.append(bNow, bDate, bNone);
    const colorBtn = btn('🎨 设置项目颜色…', () => { close(); askItemColor(p, viewFlow); });
    colorBtn.style.width = '100%'; colorBtn.style.marginBottom = '8px';
    body.append(UI.field('置顶', pinRow), colorBtn,
      opt('还在跟进（未完成）', '跟进'), opt('任务结束（已完成）', '结束'),
      (() => { const d = btn('删除项目', () => { if (confirm('确认删除该项目？')) { Store.removeItem(Store.get().projects, p.id); close(); viewFlow(); } }); d.className = 'btn-danger'; d.style.width = '100%'; return d; })());
    const close = UI.modal({ title: '项目状态', body });
  }

  function editFlowProject(p) {
    const isNew = !p;
    p = p || { id: Store.uid(), name: '', type: '兼职', source: '', sourceLink: '', status: '跟进', lastModified: Store.todayStr(), notes: '', websites: '', skills: [], timeline: [], files: [] };
    if (!p.color) p.color = Store.PALETTE[Math.floor(Math.random() * Store.PALETTE.length)];
    const nameI = UI.input(p.name, '机会 / 项目名称');
    const sourceI = UI.input(p.source || '', '如 ChatGPT、豆包、小红书、学校官网');
    const sourceLinkI = UI.input(p.sourceLink || '', '原始链接、对话链接或网页地址（可不填）'); sourceLinkI.type = 'url';
    const typeSel = UI.select(FLOW_TYPES.map(t => ({ value: t, text: t })), p.type);
    const otherI = UI.input(p.type && !FLOW_TYPES.includes(p.type) ? p.type : '', '请填写类型名称');
    const statusSel = UI.select([{ value: '跟进', text: '还在跟进（未完成）' }, { value: '结束', text: '任务结束（已完成）' }], p.status || '跟进');
    const notesI = UI.textarea(p.notes, '机会内容、适合原因、下一步怎么做…');
    // 项目整体颜色：整块长方形都会是这个颜色
    let color = p.color;
    const colorWrap = document.createElement('div');
    colorWrap.appendChild(UI.colorChips(color, c => color = c));

    // 类型：选「其他」时，在右侧内联出现自定义输入框
    const typeRow = document.createElement('div'); typeRow.className = 'type-row';
    const syncOther = () => { otherI.style.display = (typeSel.value === '其他') ? '' : 'none'; };
    typeSel.onchange = syncOther; syncOther();
    typeRow.append(UI.field('类型', typeSel), UI.field('', otherI));

    // 所需技能：逐条列表，每条 = 大名字输入框 + 掌握度快捷按钮组
    const skillsBox = document.createElement('div'); skillsBox.className = 'sk-box';
    const skList = document.createElement('div'); skList.className = 'sk-list';
    const addSkRow = (nm = '', m = 20) => {
      const row = document.createElement('div'); row.className = 'sk-edit-row';
      const idxSpan = document.createElement('span'); idxSpan.className = 'sk-idx';
      const nmI = UI.input(nm, '技能名称，如 Python / 雅思写作'); nmI.className = 'sk-name';
      // 掌握度：上/下三角形箭头步进器（点箭头调整，步长 5%）
      let curM = typeof m === 'number' ? Math.max(0, Math.min(100, m)) : 20;
      const masWrap = document.createElement('div'); masWrap.className = 'sk-mas-spinner';
      masWrap.dataset.val = curM;
      const valEl = document.createElement('span'); valEl.className = 'mas-val'; valEl.textContent = curM + '%';
      const upBtn = document.createElement('button'); upBtn.type = 'button'; upBtn.className = 'mas-arr'; upBtn.textContent = '▲'; upBtn.title = '提高 5%';
      const downBtn = document.createElement('button'); downBtn.type = 'button'; downBtn.className = 'mas-arr'; downBtn.textContent = '▼'; downBtn.title = '降低 5%';
      upBtn.onclick = () => { curM = Math.min(100, curM + 5); valEl.textContent = curM + '%'; masWrap.dataset.val = curM; };
      downBtn.onclick = () => { curM = Math.max(0, curM - 5); valEl.textContent = curM + '%'; masWrap.dataset.val = curM; };
      masWrap.append(valEl, upBtn, downBtn);
      const del = btn('✕', () => { row.remove(); renumber(); }); del.className = 'btn-danger btn-sm';
      row.append(idxSpan, nmI, masWrap, del); skList.appendChild(row); renumber();
    };
    const renumber = () => skList.querySelectorAll('.sk-edit-row').forEach((r, i) => { r.querySelector('.sk-idx').textContent = (i + 1) + '.'; });
    (p.skills || []).forEach(s => addSkRow(s.name, s.mastery || 20));
    const addSkBtn = btn('+ 添加技能需求', () => addSkRow());
    skillsBox.append(skList, addSkBtn);

    // 优先级：① 非常着急·置顶  ② 没那么急·设定激活日期（到了那天自动往前排、被你看见）
    const prioSeg = document.createElement('div'); prioSeg.className = 'seg';
    const bUrgent = document.createElement('button'); bUrgent.type = 'button'; bUrgent.className = 'seg-btn'; bUrgent.textContent = '🔴 非常着急 · 置顶';
    const bLater = document.createElement('button'); bLater.type = 'button'; bLater.className = 'seg-btn'; bLater.textContent = '⏳ 没那么急 · 设定激活日期';
    prioSeg.append(bUrgent, bLater);
    let selPrio = p.priority === 'urgent' ? 'urgent' : (p.priority === 'later' ? 'later' : '');
    const dateI = UI.input(p.showAfter || '', '年-月-日'); dateI.type = 'date';
    const dateField = UI.field('激活日期（到了这天，项目会自动往前排、被你看见，防止遗忘）', dateI);
    function syncPrio() {
      bUrgent.classList.toggle('on', selPrio === 'urgent');
      bLater.classList.toggle('on', selPrio === 'later');
      dateField.style.display = selPrio === 'later' ? '' : 'none';
    }
    bUrgent.onclick = () => { selPrio = (selPrio === 'urgent') ? '' : 'urgent'; syncPrio(); };
    bLater.onclick = () => { selPrio = (selPrio === 'later') ? '' : 'later'; if (selPrio === 'later' && !dateI.value) dateI.value = Store.todayStr(); syncPrio(); };
    syncPrio();

    const body = document.createElement('div');
    body.append(UI.field('机会 / 项目名称', nameI), UI.field('机会来源', sourceI), UI.field('原始链接 / 对话链接', sourceLinkI), typeRow, UI.field('项目状态', statusSel),
      UI.field('项目颜色（整块长方形）', colorWrap),
      UI.field('优先级', prioSeg), dateField,
      UI.field('所需技能', skillsBox), UI.field('备注', notesI));
    const footer = modalFooter(() => {
      p.name = nameI.value.trim(); if (!p.name) return UI.toast('请填写名称');
      p.source = sourceI.value.trim();
      p.sourceLink = sourceLinkI.value.trim();
      p.type = typeSel.value === '其他' ? (otherI.value.trim() || '其他') : typeSel.value;
      p.status = statusSel.value;
      p.priority = selPrio || 'normal';
      p.showAfter = selPrio === 'later' ? (dateI.value || Store.todayStr()) : '';
      p.notes = notesI.value.trim(); p.color = color; p.lastModified = Store.todayStr();
      // 所需技能：用户逐条填写，掌握度自选（非 100% 自动加入「技能养成记录」）
      const sk = [];
      let added = [];
      skList.querySelectorAll('.sk-edit-row').forEach(r => {
        const nm = r.querySelector('.sk-name').value.trim();
        if (!nm) return;
        const spinner = r.querySelector('.sk-mas-spinner');
        let m = spinner ? parseInt(spinner.dataset.val, 10) : 20;
        if (isNaN(m)) m = 0;
        sk.push({ name: nm, mastery: m });
        if (m !== 100) { Store.ensureSkillRecord(nm); added.push(nm); }
      });
      p.skills = sk;
      if (isNew) Store.addItem(Store.get().projects, p); else Store.save();
      close(); viewFlow();
      if (added.length) UI.toast('已自动加入「技能养成记录」：' + added.join('、'));
    });
    const close = UI.modal({ title: isNew ? '记录机会' : '编辑项目', body, footer });
  }

  /* 材料文件：单文件大小上限（本地存储所限，设为 5MB） */
  const FILE_MAX = 5 * 1024 * 1024;

  /* 把文件转成可存储的 dataURL；图片会压缩到长边 ≤1600px 的 JPEG，方便存下照片 */
  function fileToStorable(file, cb) {
    if (!file.type || !file.type.startsWith('image/')) {
      const r = new FileReader();
      r.onload = () => cb(null, { data: r.result, name: file.name });
      r.onerror = () => cb('读取失败');
      r.readAsDataURL(file);
      return;
    }
    const r = new FileReader();
    r.onload = () => {
      const img = new Image();
      img.onload = () => {
        let w = img.naturalWidth, h = img.naturalHeight;
        const max = 1600;
        if (w > max || h > max) { const k = Math.min(max / w, max / h); w = Math.round(w * k); h = Math.round(h * k); }
        const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
        const ctx = cv.getContext('2d'); ctx.drawImage(img, 0, 0, w, h);
        let out = cv.toDataURL('image/jpeg', 0.85);
        if (out.length > FILE_MAX) out = cv.toDataURL('image/jpeg', 0.6);
        const base = (file.name || 'image').replace(/\.[^.]+$/, '');
        cb(null, { data: out, name: base + '.jpg' });
      };
      img.onerror = () => cb('图片解码失败');
      img.src = r.result;
    };
    r.onerror = () => cb('读取失败');
    r.readAsDataURL(file);
  }

  /* 图片大图查看（双击 / 单击缩略图打开，点遮罩或 ✕ 关闭） */
  function showImageLightbox(src, name) {
    const lb = document.createElement('div'); lb.className = 'img-lightbox';
    const img = document.createElement('img'); img.src = src; img.alt = name || '';
    const cap = document.createElement('div'); cap.className = 'lb-cap'; cap.textContent = name || '';
    const close = document.createElement('button'); close.className = 'lb-close'; close.textContent = '✕';
    close.onclick = (e) => { e.stopPropagation(); lb.remove(); };
    lb.onclick = (e) => { if (e.target === lb) lb.remove(); };
    lb.append(img, cap, close);
    document.body.appendChild(lb);
  }

  function openFlowDetail(id, opts = {}) {
    const st = Store.get();
    const p = st.projects.find(x => x.id === id); if (!p) return;
    if (opts.history !== false) openHistoryDetail('project', id);
    p.skills = p.skills || []; p.timeline = p.timeline || []; p.files = p.files || [];
    const overlay = document.createElement('div'); overlay.className = 'detail-overlay';
    const head = document.createElement('div'); head.className = 'detail-head';
    const leftWrap = document.createElement('div'); leftWrap.className = 'dh-left';
    const toggleBtn = document.createElement('button'); toggleBtn.className = 'panel-toggle-btn';
    toggleBtn.onclick = () => { state.leftCollapsed = !state.leftCollapsed; applyLayout(); };
    const titleEl = document.createElement('div'); titleEl.className = 'dh-title';
    let prioBadge = '';
    if (p.priority === 'urgent') prioBadge = ' <span class="fi-pill urgent">置顶</span>';
    else if (p.priority === 'later') {
      const after = p.showAfter || '';
      const active = after && after <= Store.todayStr();
      prioBadge = active ? ' <span class="fi-pill active">🔔 已激活</span>' : ` <span class="fi-pill dormant">🕓 ${esc(after)} 激活</span>`;
    }
    titleEl.innerHTML = `${esc(p.name)} <span class="fi-type">${esc(p.type || '')}</span>${prioBadge}`;
    leftWrap.append(toggleBtn, titleEl);
    const closeBtn = document.createElement('button'); closeBtn.className = 'close-x'; closeBtn.textContent = '✕';
    closeBtn.onclick = () => { if (isMindRoute(history.state) && history.state.detail) history.back(); else overlay.remove(); };
    head.append(leftWrap, closeBtn);
    const bodyEl = document.createElement('div'); bodyEl.className = 'detail-body';
    overlay.append(head, bodyEl); document.body.appendChild(overlay);

    // 折叠状态：左侧面板整体收起 + 两个分区各自展开/收起
    const state = { leftCollapsed: false, tlOpen: true, skOpen: true };
    let detailLeft, accTl, accSk;

    function applyLayout() {
      if (detailLeft) detailLeft.classList.toggle('collapsed', state.leftCollapsed);
      toggleBtn.textContent = state.leftCollapsed ? '› 面板' : '‹ 面板';
      toggleBtn.title = state.leftCollapsed ? '展开左侧面板（时间节点 / 技能需求）' : '收起左侧面板';
    }
    function applyAcc() {
      if (accTl) accTl.classList.toggle('open', state.tlOpen);
      if (accSk) accSk.classList.toggle('open', state.skOpen);
    }

    // 折叠分区：标题栏点击展开/收起
    function buildAcc(title, bodyFactory) {
      const acc = document.createElement('div'); acc.className = 'acc open';
      const hd = document.createElement('div'); hd.className = 'acc-head';
      hd.innerHTML = `<span>${esc(title)}</span><span class="acc-arrow">▾</span>`;
      const bodyWrap = document.createElement('div'); bodyWrap.className = 'acc-body';
      bodyWrap.appendChild(bodyFactory());
      hd.onclick = () => {
        const open = acc.classList.toggle('open');
        if (title === '重要时间节点') state.tlOpen = open;
        else if (title === '技能需求') state.skOpen = open;
      };
      acc.append(hd, bodyWrap);
      return acc;
    }

    // 材料文件：图片缩略图（单击/双击看大图）+ 文件下载链接 + 5MB 上限
    function buildFileCard() {
      const fileCard = UI_card('材料文件');
      const grid = document.createElement('div'); grid.className = 'file-grid';
      function render() {
        grid.innerHTML = '';
        if (!p.files.length) {
          const empty = document.createElement('div'); empty.className = 'file-empty muted';
          empty.textContent = '还没有材料，点击下方添加图片或文件（单文件 ≤ 5MB）';
          grid.appendChild(empty);
        }
        p.files.forEach((f, i) => {
          const item = document.createElement('div'); item.className = 'file-item';
          const isImg = (f.data && /^data:image\//.test(f.data)) || /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(f.name || '');
          if (isImg) {
            const thumb = document.createElement('div'); thumb.className = 'file-thumb';
            const im = document.createElement('img'); im.src = f.data; im.alt = f.name; im.title = '单击 / 双击查看大图';
            thumb.appendChild(im);
            const nm = document.createElement('div'); nm.className = 'file-name'; nm.textContent = f.name;
            item.append(thumb, nm);
            item.style.cursor = 'zoom-in';
            item.addEventListener('click', () => showImageLightbox(f.data, f.name));
            item.addEventListener('dblclick', () => showImageLightbox(f.data, f.name));
          } else {
            const a = document.createElement('a'); a.className = 'file-link'; a.href = f.data; a.download = f.name;
            a.textContent = '查看 / 下载 ' + f.name; a.title = '点击下载 ' + f.name;
            item.appendChild(a);
          }
          const del = document.createElement('button'); del.className = 'file-del'; del.textContent = '✕'; del.title = '删除';
          del.onclick = (e) => { e.stopPropagation(); p.files.splice(i, 1); Store.save(); render(); };
          item.appendChild(del);
          grid.appendChild(item);
        });
      }
      render();
      const fileInput = document.createElement('input'); fileInput.type = 'file'; fileInput.multiple = true; fileInput.style.display = 'none';
      function addFiles(fileList) {
        const files = Array.from(fileList || []);
        if (!files.length) return;
        let pending = files.length, oversize = 0;
        const finish = () => {
          try { Store.save(); } catch (e) { UI.toast('保存失败：本地存储空间可能已满'); }
          render(); fileInput.value = '';
          if (oversize) UI.toast(oversize + ' 个文件超过 5MB 已跳过');
        };
        files.forEach(f => {
          if (f.size > FILE_MAX) { oversize++; if (--pending === 0) finish(); return; }
          fileToStorable(f, (err, res) => {
            if (!err && res) p.files.push({ name: res.name, data: res.data });
            else if (err) UI.toast(err);
            if (--pending === 0) finish();
          });
        });
      }
      fileInput.onchange = () => { addFiles(fileInput.files); fileInput.value = ''; };

      // 拖放区：把图片/文件拖进来即可加入（也可点击打开选择）
      const drop = document.createElement('div'); drop.className = 'file-drop';
      drop.innerHTML = '<div class="file-drop-in">把图片 / 文件拖到这里，或点击选择（单文件 ≤ 5MB）</div>';
      drop.onclick = () => fileInput.click();
      drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('drag'); });
      drop.addEventListener('dragleave', e => { e.preventDefault(); drop.classList.remove('drag'); });
      drop.addEventListener('drop', e => { e.preventDefault(); drop.classList.remove('drag'); addFiles(e.dataTransfer.files); });

      const hint = document.createElement('div'); hint.className = 'file-hint';
      hint.textContent = '支持图片（自动压缩预览）与任意文件，单文件最大 5MB';
      fileCard.append(drop, grid, fileInput, hint);
      return fileCard;
    }

    function redraw() {
      bodyEl.innerHTML = '';
      const cols = document.createElement('div'); cols.className = 'detail-cols';

      // 左侧面板：重要时间节点 + 技能需求（各自可折叠，整体可收起）
      detailLeft = document.createElement('div'); detailLeft.className = 'detail-left';

      accTl = buildAcc('重要时间节点', () => {
        const wrap = document.createElement('div');
        const tl = document.createElement('div'); tl.className = 'timeline';
        if (!p.timeline.length) tl.innerHTML = `<div class="muted">暂无节点，点击下方添加</div>`;
        p.timeline.forEach((t, i) => {
          const it = document.createElement('div'); it.className = 'tl-item';
          it.innerHTML = `<div class="tl-date">${esc(t.date)}</div><div class="tl-title">${esc(t.title)}</div>`;
          it.style.cursor = 'pointer'; it.onclick = () => editTimeline(p, t, i, redraw);
          tl.appendChild(it);
        });
        const addTl = btn('+ 添加节点', () => editTimeline(p, null, -1, redraw));
        wrap.append(tl, addTl);
        return wrap;
      });

      accSk = buildAcc('技能需求', () => {
        const wrap = document.createElement('div');
        const skList = document.createElement('div');
        if (!p.skills.length) skList.innerHTML = `<div class="muted">暂无技能需求，点击下方添加</div>`;
        p.skills.forEach((s, i) => {
          const m = Math.max(0, Math.min(100, s.mastery || 0));
          const colorCls = m >= 100 ? 'sk-green' : (m >= 85 ? 'sk-orange' : 'sk-red');
          const row = document.createElement('div'); row.className = 'skill-row';
          const name = document.createElement('span'); name.className = 'sk-name'; name.textContent = s.name;
          const bar = document.createElement('div'); bar.className = 'skill-bar'; const fill = document.createElement('span'); fill.style.width = m + '%'; bar.appendChild(fill);
          const tag = document.createElement('span'); tag.className = 'mastery-tag ' + colorCls; tag.textContent = m + '%';
          row.append(name, bar, tag);
          row.onclick = () => editSkillNeed(p, s, i, redraw);
          row.addEventListener('contextmenu', e => { e.preventDefault(); openMasteryChart({ name: s.name, color: '#4f7cff', masteryHistory: s.history || [] }); });
          skList.appendChild(row);
        });
        const addSk = btn('+ 添加技能', () => addSkillNeed(p, redraw));
        wrap.append(skList, addSk);
        return wrap;
      });

      detailLeft.append(accTl, accSk);

      // 右侧主区：机会来源与原文 + 备注（放大）+ 材料文件
      const right = document.createElement('div'); right.className = 'detail-right';
      if (p.source || p.sourceLink) {
        const sourceCard = UI_card('机会来源');
        if (p.source) {
          const sourceText = document.createElement('div'); sourceText.textContent = p.source;
          sourceCard.appendChild(sourceText);
        }
        if (p.sourceLink) {
          const link = document.createElement('a'); link.href = p.sourceLink; link.target = '_blank'; link.rel = 'noopener noreferrer';
          link.textContent = '打开原始链接 / 对话'; link.style.display = 'inline-block'; link.style.marginTop = '8px';
          sourceCard.appendChild(link);
        }
        right.appendChild(sourceCard);
      }
      const noteCard = MindMap.createMemo(p, 'notes', Store.save, '备注');
      const fileCard = buildFileCard();
      right.append(noteCard, fileCard);

      cols.append(detailLeft, right);
      bodyEl.appendChild(cols);
      applyLayout();
      applyAcc();
    }
    redraw();
  }

  function editTimeline(p, t, idx, redraw) {
    const isNew = idx < 0;
    const cfg = Store.get().reminder || { on: true, defaultLead: 1 };
    t = t || { date: Store.todayStr(), title: '', remind: true, lead: cfg.defaultLead != null ? cfg.defaultLead : 1, channel: 'inapp' };
    const dateI = UI.input(t.date, '日期 YYYY-MM-DD');
    const titleI = UI.input(t.title, '节点说明（如：提交初稿、投递截止）');
    const remindChk = UI.input('', ''); remindChk.type = 'checkbox'; remindChk.checked = (t.remind !== false); remindChk.style.width = 'auto'; remindChk.style.margin = '0 6px 0 0';
    const remindLabel = document.createElement('label'); remindLabel.className = 'row'; remindLabel.style.alignItems = 'center'; remindLabel.style.gap = '4px';
    remindLabel.append(remindChk, document.createTextNode('到点提醒我'));
    const leadSel = UI.select([
      { value: '0', text: '当天提醒' }, { value: '1', text: '提前 1 天' },
      { value: '3', text: '提前 3 天' }, { value: '7', text: '提前 7 天' },
    ], String(t.lead != null ? t.lead : (cfg.defaultLead != null ? cfg.defaultLead : 1)));
    const chanSel = UI.select([
      { value: 'inapp', text: '应用内提醒（打开本页即提示）' },
      { value: 'system', text: '系统通知（桌面 / 手机弹窗）' },
    ], t.channel || 'inapp');
    const body = document.createElement('div');
    body.append(UI.field('日期', dateI), UI.field('说明', titleI),
      UI.field('提醒设置', remindLabel),
      UI.field('提前提醒天数', leadSel),
      UI.field('提醒方式', chanSel));
    const footer = modalFooter(() => {
      t.date = dateI.value.trim(); t.title = titleI.value.trim(); if (!t.title) return UI.toast('请填写说明');
      t.remind = remindChk.checked; t.lead = parseInt(leadSel.value, 10); t.channel = chanSel.value;
      if (isNew) p.timeline.push(t); else p.timeline[idx] = t;
      p.timeline.sort((a, b) => a.date.localeCompare(b.date)); p.lastModified = Store.todayStr(); Store.save(); close(); redraw();
    }, isNew ? null : '删除', isNew ? null : () => { p.timeline.splice(idx, 1); Store.save(); close(); redraw(); });
    const close = UI.modal({ title: isNew ? '添加时间节点' : '编辑节点', body, footer });
  }

  function addSkillNeed(p, redraw) {
    const nameI = UI.input('', '技能名称');
    const body = document.createElement('div'); body.append(UI.field('技能名称', nameI));
    const footer = modalFooter(() => {
      const nm = nameI.value.trim(); if (!nm) return UI.toast('请填写技能名称');
      askMastery(nm, (m) => {
        p.skills.push({ name: nm, mastery: m, history: [{ date: Store.todayStr(), mastery: m }] }); p.lastModified = Store.todayStr(); Store.save();
        if (m !== 100) { const r = Store.ensureSkillRecord(nm); UI.toast(`已自动加入「技能养成记录」：${nm}`); }
        close2(); redraw();
      });
    });
    const close2 = UI.modal({ title: '添加技能需求', body, footer });
  }

  function editSkillNeed(p, s, idx, redraw) {
    const nameI = UI.input(s.name, '技能名称');
    const body = document.createElement('div'); body.append(UI.field('技能名称', nameI));
    const footer = modalFooter(() => {
      const nm = nameI.value.trim(); if (!nm) return UI.toast('请填写技能名称');
      askMastery(nm, (m) => {
        const rec = p.skills[idx]; rec.name = nm; rec.mastery = m; rec.history = rec.history || []; rec.history.push({ date: Store.todayStr(), mastery: m }); p.lastModified = Store.todayStr(); Store.save();
        if (m !== 100) Store.ensureSkillRecord(nm);
        close2(); redraw();
      });
    }, '删除', () => { p.skills.splice(idx, 1); Store.save(); close2(); redraw(); });
    const close2 = UI.modal({ title: '编辑技能需求', body, footer });
  }

  // 掌握度询问（数字输入框，用户自行填写；非 100% 自动加入技能养成）
  function askMastery(name, cb) {
    const opts = [0, 10, 25, 40, 55, 70, 85, 100];
    const body = document.createElement('div');
    const tip = document.createElement('p'); tip.className = 'muted'; tip.style.fontSize = '13px'; tip.style.marginBottom = '10px';
    tip.textContent = `你掌握「${name}」的程度？点选即可`;
    body.appendChild(tip);
    const row = document.createElement('div'); row.style.display = 'flex'; row.style.gap = '6px'; row.style.flexWrap = 'wrap';
    let picked = null;
    opts.forEach(v => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'mas-btn';
      b.textContent = v + '%'; b.dataset.val = v;
      b.onclick = () => { row.querySelectorAll('.mas-btn').forEach(x => x.classList.remove('sel')); b.classList.add('sel'); picked = v; };
      row.appendChild(b);
    });
    body.appendChild(row);
    const footer = modalFooter(() => {
      if (picked == null) return UI.toast('请选择一个掌握度');
      close(); cb(picked);
    });
    const close = UI.modal({ title: '掌握度', body, footer });
  }

  /* ============================================================
     AI 找项目（基于用户技能的简单匹配推荐）
     ============================================================ */
  const SAMPLE_AI = [
    { name: '校园二手书小程序', type: '比赛', need: ['编程', '产品设计'], desc: '高校二手教材交易小程序，参加互联网+大赛。' },
    { name: '自媒体读书账号', type: '自媒体', need: ['写作', '剪辑'], desc: '运营一个读书分享抖音/B站账号。' },
    { name: '字节前端实习', type: '实习', need: ['编程', '英语'], desc: '大厂前端开发实习生招聘。' },
    { name: '英语陪练兼职', type: '兼职', need: ['英语', '沟通'], desc: '线上英语口语陪练，按小时计费。' },
    { name: '数据可视化比赛', type: '比赛', need: ['编程', '数学'], desc: 'Kaggle / 天池数据竞赛。' },
    { name: '个人作品集网站', type: '其他', need: ['编程', '设计'], desc: '搭建并维护个人作品集站点。' },
    { name: '社群运营实习', type: '实习', need: ['沟通', '写作'], desc: '负责社群活跃与内容排期。' },
    { name: '翻译兼职', type: '兼职', need: ['英语', '写作'], desc: '文档/字幕翻译外包。' },
  ];
  function viewAI() {
    const st = Store.get();
    const mySkills = new Set([...st.skills.items.map(s => s.name), ...st.projects.flatMap(p => (p.skills || []).map(s => s.name))]);
    const card = UI_card('AI 找符合你的项目');
    card.innerHTML += `<p class="muted">基于你已记录的技能（技能养成记录 / 项目中的技能需求）进行匹配。匹配度越高越适合你。</p>`;
    const grid = document.createElement('div'); grid.className = 'contact-grid'; grid.style.marginTop = '12px';
    SAMPLE_AI.forEach(pr => {
      const hit = pr.need.filter(n => mySkills.has(n)).length;
      const ratio = hit / pr.need.length;
      const level = ratio >= 0.66 ? 'high' : ratio >= 0.33 ? 'mid' : 'low';
      const label = ratio >= 0.66 ? '高度匹配' : ratio >= 0.33 ? '一般匹配' : '可尝试';
      const el = document.createElement('div'); el.className = 'card';
      el.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center"><b>${esc(pr.name)}</b><span class="ai-match ${level}">${label}</span></div>
        <div class="muted" style="font-size:12px;margin:6px 0">类型：${esc(pr.type)} · 需要：${esc(pr.need.join('、'))}</div>
        <div style="font-size:13px">${esc(pr.desc)}</div>
        <div class="muted" style="font-size:12px;margin-top:6px">命中你的技能：${hit ? esc(pr.need.filter(n => mySkills.has(n)).join('、')) : '暂无'}</div>`;
      const claim = btn('保存到项目', () => {
        Store.addItem(st.projects, { id: Store.uid(), name: pr.name, type: pr.type, source: 'MIND AI 找项目', sourceLink: '', status: '跟进', lastModified: Store.todayStr(), notes: pr.desc, websites: '', skills: pr.need.map(n => ({ name: n, mastery: 20 })), timeline: [], files: [] });
        Store.save(); UI.toast('已添加到项目');
      });
      claim.style.marginTop = '10px'; el.appendChild(claim);
      grid.appendChild(el);
    });
    card.appendChild(grid);
    main.appendChild(card);
  }

  /* ============================================================
     设置
     ============================================================ */
  function viewSettings() {
    main.innerHTML = '';
    const st = Store.get();
    const card = UI_card('个人资料');
    const prof = document.createElement('div'); prof.className = 'profile-row';
    const av = UI.avatar(st.profile.avatar, st.profile.name);
    const fileI = document.createElement('input'); fileI.type = 'file'; fileI.accept = 'image/*'; fileI.style.display = 'none';
    fileI.onchange = () => { const f = fileI.files[0]; if (!f) return; if (f.size > 1.5 * 1024 * 1024) return UI.toast('头像过大'); const r = new FileReader(); r.onload = () => { st.profile.avatar = r.result; Store.save(); viewSettings(); renderTopProfile(); }; r.readAsDataURL(f); };
    const upBtn = btn('上传头像', () => fileI.click());
    const nameI = UI.input(st.profile.name, '昵称');
    const sigI = UI.input(st.profile.signature, '个性签名');
    prof.append(av, (() => { const d = document.createElement('div'); d.append(nameI, document.createElement('br'), sigI, document.createElement('br'), upBtn, fileI); d.style.flex = '1'; return d; })());
    const autosaveProf = () => {
      st.profile.name = nameI.value.trim() || '我';
      st.profile.signature = sigI.value.trim();
      try { Store.save(); } catch (e) { /* 云端同步失败不应阻断本地保存 */ }
      renderTopProfile();
    };
    nameI.addEventListener('input', autosaveProf);
    sigI.addEventListener('input', autosaveProf);
    const saveProf = btn('保存资料', autosaveProf);
    card.append(prof, saveProf);

    // 风格（紧凑色块 + 精选 + 可折叠色系）
    const themeCard = UI_card('风格（配色方案）');

    // 白天 / 夜晚模式（放在最上面）
    const modeField = document.createElement('div'); modeField.style.marginBottom = '14px';
    const modeLabel = document.createElement('div'); modeLabel.className = 'field-label'; modeLabel.textContent = '显示模式';
    const seg = document.createElement('div'); seg.className = 'seg';
    const mkSeg = (val, txt) => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'seg-btn' + (st.mode === val ? ' on' : '');
      b.textContent = txt;
      b.onclick = () => { st.mode = val; Store.save(); Store.applyTheme(); viewSettings(); };
      return b;
    };
    seg.append(mkSeg('light', '☀ 白天'), mkSeg('dark', '🌙 夜晚'));
    modeField.append(modeLabel, seg);
    themeCard.appendChild(modeField);

    const themeTip = document.createElement('p'); themeTip.className = 'muted'; themeTip.style.fontSize = '12px'; themeTip.style.margin = '0 0 12px';
    themeTip.textContent = '点色块即可让整套界面同步变色（顶栏 / 内容卡片 / 大项目方块都会跟着变）。当前栏目高亮、整体明暗由上方「显示模式」控制。';
    themeCard.appendChild(themeTip);

    // 主题应用范围
    const scopeSel = UI.select([
      { value: 'all', text: '全部界面（默认）' },
      { value: 'chrome', text: '仅顶栏与侧边栏' },
      { value: 'content', text: '仅内容卡片与大项目' },
    ], st.themeScope || 'all');
    scopeSel.onchange = () => { st.themeScope = scopeSel.value; Store.save(); applyScope(); UI.toast('已更新应用范围'); };
    themeCard.appendChild(UI.field('主题应用范围', scopeSel));

    const setTheme = (id) => { st.themeId = id; Store.applyTheme(); Store.save(); viewSettings(); };
    const allThemes = Store.getThemes();
    // 单个主题 = 2×2 色块方格（直观展示 4 色，避免盲点）
    function makeThemeSquare(t) {
      const sq = document.createElement('div'); sq.className = 'theme-sq' + (t.id === st.themeId ? ' sel' : '');
      const box = document.createElement('div'); box.className = 'sq-box';
      t.c.forEach(col => { const s = document.createElement('span'); s.style.background = col; box.appendChild(s); });
      const nm = document.createElement('div'); nm.className = 'sq-name'; nm.textContent = t.name;
      if (t.custom) {
        nm.textContent = t.name + ' ✕'; nm.style.cursor = 'pointer'; nm.title = '点击删除该自定义风格';
        nm.onclick = (e) => { e.stopPropagation(); Store.removeCustomTheme(t.id); Store.save(); viewSettings(); };
      }
      sq.append(box, nm);
      sq.onclick = () => setTheme(t.id);
      return sq;
    }

    // 精选 · 协调养眼配色（缩短冗长列表）
    const featured = ['mist', 'ocean_teal', 'morandi_haze', 'morandi_sage', 'macaron_mint', 'cream_latte', 'taro_1', 'forest_pine', 'grey_mist', 'monet_water', 'jewel_emerald', 'mint_1', 'ocean_peri', 'morandi_rose'];
    const featWrap = document.createElement('div'); featWrap.className = 'theme-group';
    const featTitle = document.createElement('div'); featTitle.className = 'theme-group-title'; featTitle.textContent = '✦ 精选 · 协调养眼配色';
    featWrap.appendChild(featTitle);
    const featGrid = document.createElement('div'); featGrid.className = 'theme-squares';
    featured.forEach(id => { const t = allThemes.find(x => x.id === id); if (t) featGrid.appendChild(makeThemeSquare(t)); });
    featWrap.appendChild(featGrid);
    themeCard.appendChild(featWrap);

    // 全部色系（默认折叠，仅展开当前所属色系）
    const famWrap = document.createElement('div'); famWrap.className = 'theme-families';
    Store.getFamilies().forEach((f) => {
      const open = f.themes.some(t => t.id === st.themeId);
      const sec = document.createElement('div'); sec.className = 'theme-family' + (open ? ' open' : '');
      const head = document.createElement('div'); head.className = 'theme-family-head';
      const prev = f.themes[0].c.map(c => `<span style="background:${c}"></span>`).join('');
      head.innerHTML = `<span class="tf-prev">${prev}</span><span class="tf-name">${esc(f.name)}</span><span class="tf-count">${f.themes.length}</span><span class="tf-arrow">${open ? '▾' : '▸'}</span>`;
      const body = document.createElement('div'); body.className = 'theme-family-body';
      const grid = document.createElement('div'); grid.className = 'theme-squares';
      f.themes.forEach(t => grid.appendChild(makeThemeSquare(t)));
      body.appendChild(grid);
      head.onclick = () => { sec.classList.toggle('open'); head.querySelector('.tf-arrow').textContent = sec.classList.contains('open') ? '▾' : '▸'; };
      sec.append(head, body);
      famWrap.appendChild(sec);
    });
    themeCard.appendChild(famWrap);

    // 自定义风格（色块 + 可删除）
    const customs = (st.customThemes || []);
    if (customs.length) {
      const cwrap = document.createElement('div'); cwrap.className = 'theme-group';
      const ctitle = document.createElement('div'); ctitle.className = 'theme-group-title'; ctitle.textContent = '我的自定义风格';
      cwrap.appendChild(ctitle);
      const cgrid = document.createElement('div'); cgrid.className = 'theme-squares';
      customs.forEach(t => cgrid.appendChild(makeThemeSquare(t)));
      cwrap.appendChild(cgrid);
      themeCard.appendChild(cwrap);
    }

    // 自定义主题
    const customCard = UI_card('自定义风格（4 个颜色组成一组）');
    const pickWrap = document.createElement('div'); pickWrap.className = 'theme-swatches'; pickWrap.style.gap = '10px';
    const custCols = ['#FF8FAB', '#BDE0C4', '#C7B9E8', '#FFF1D6'];
    const custInputs = [];
    custCols.forEach((c, i) => {
      const inp = document.createElement('input'); inp.type = 'color'; inp.value = c; inp.className = 'color-custom'; inp.style.width = '44px'; inp.style.height = '44px';
      inp.oninput = () => { custCols[i] = inp.value; };
      custInputs.push(inp); pickWrap.appendChild(inp);
    });
    const custNameI = UI.input('', '主题名称');
    const addTheme = btn('保存为我的风格', () => {
      const nm = custNameI.value.trim(); if (!nm) return UI.toast('请填写主题名称');
      Store.addCustomTheme({ id: 'cus_' + Store.uid(), name: nm, c: custCols.slice(), custom: true });
      st.themeId = st.themeId; Store.save(); UI.toast('已保存自定义风格'); viewSettings();
    });
    customCard.append(UI.field('颜色（主色 / 辅色 / 点缀色 / 浅背景色）', pickWrap), UI.field('名称', custNameI), addTheme);

    // 字号
    const fontCard = UI_card('字体大小');
    const slider = document.createElement('input'); slider.type = 'range'; slider.min = '30'; slider.max = '150'; slider.step = '5'; slider.value = st.fontPct || 50; slider.className = 'font-slider';
    const valLabel = document.createElement('span'); valLabel.style.fontWeight = '700'; valLabel.textContent = (st.fontPct || 50) + '%（50% 为常用大小）';
    slider.oninput = () => { valLabel.textContent = slider.value + '%（50% 为常用大小）'; st.fontPct = +slider.value; Store.applyTheme(); };
    slider.onchange = () => { Store.save(); };
    const frow = document.createElement('div'); frow.className = 'row'; frow.style.alignItems = 'center';
    frow.append(slider, valLabel);
    fontCard.appendChild(frow);

    const tip = UI_card('数据说明');
    tip.innerHTML = `<p class="muted" style="font-size:13px">数据默认保存在本机文件 <code>data/mind_data.json</code>（由本地服务器 <code>server.js</code> 落盘，永久不丢）。请用 <code>node server.js</code> 或双击 <code>start.bat</code> 打开本应用；若直接以 <code>file://</code> 或普通静态服务器打开，数据仍会写进浏览器 localStorage，但建议改成本地服务器以获得永久文件备份。每次保存都会自动保留最近 20 份历史备份，可在上方「本地历史备份」中随时回滚。</p>`;

    // 提醒设置
    const st2 = Store.get();
    const cfg2 = st2.reminder || (st2.reminder = { on: true, defaultLead: 1 });
    const remCard = UI_card('重要时间节点提醒');
    const onWrap = document.createElement('label'); onWrap.className = 'row'; onWrap.style.alignItems = 'center'; onWrap.style.gap = '6px';
    const onChk = UI.input('', ''); onChk.type = 'checkbox'; onChk.checked = cfg2.on; onChk.style.width = 'auto'; onChk.style.margin = '0';
    onChk.onchange = () => { cfg2.on = onChk.checked; Store.save(); };
    onWrap.append(onChk, document.createTextNode('开启重要时间节点提醒'));
    const leadSel = UI.select([
      { value: '0', text: '当天提醒' }, { value: '1', text: '提前 1 天' },
      { value: '3', text: '提前 3 天' }, { value: '7', text: '提前 7 天' },
    ], String(cfg2.defaultLead != null ? cfg2.defaultLead : 1));
    leadSel.onchange = () => { cfg2.defaultLead = parseInt(leadSel.value, 10); Store.save(); };
    const leadField = UI.field('默认提前提醒天数', leadSel);
    const notifyState = () => ('Notification' in window) ? (Notification.permission === 'granted' ? '已开启' : (Notification.permission === 'denied' ? '已被浏览器禁用' : '未开启')) : '浏览器不支持';
    const notifyBtn = btn('开启系统通知（' + notifyState() + '）', () => {
      if (!('Notification' in window)) return UI.toast('当前浏览器不支持系统通知，将使用应用内提醒');
      Notification.requestPermission().then(p => { UI.toast(p === 'granted' ? '已开启系统通知' : (p === 'denied' ? '系统通知被禁用，仍会应用内提醒' : '系统通知未开启，仍会应用内提醒')); notifyBtn.textContent = '开启系统通知（' + notifyState() + '）'; });
    });
    const remNote = document.createElement('p'); remNote.className = 'muted'; remNote.style.fontSize = '12px'; remNote.style.marginTop = '10px';
    remNote.textContent = '「系统通知」会像短信一样弹到你的桌面 / 手机（需授权）；即使未授权，打开本页也会收到应用内提醒与声音。短信 / 邮件需接入服务。';
    remCard.append(onWrap, leadField, notifyBtn, remNote);

    // 提醒声音与推送
    const snd = Store.get().sound || { id: 'chime', volume: 90, customUrl: '' };
    const sndCard = UI_card('提醒声音与推送');
    const soundSel = UI.select([
      { value: 'chime', text: '清脆铃声' }, { value: 'dingdong', text: '叮咚' },
      { value: 'beep', text: '蜂鸣提醒' }, { value: 'soft', text: '柔和提示' },
      { value: 'bell', text: '风铃' }, { value: 'drop', text: '水滴声' },
      { value: 'crystal', text: '水晶音' }, { value: 'marimba', text: '木琴声' },
      { value: 'piano', text: '钢琴键' }, { value: 'twinkle', text: '星光音' },
      { value: 'alert', text: '警报声' }, { value: 'knock', text: '敲门声' },
      { value: 'pop', text: '泡泡声' }, { value: 'coin', text: '金币声' },
      { value: 'chord', text: '和弦音' }, { value: 'sweep', text: '上扫音' },
      { value: 'low', text: '低音鼓' }, { value: 'high', text: '高音哨' },
      { value: 'triple', text: '三连音' }, { value: 'wave', text: '海浪声' },
      { value: 'custom', text: '自定义声音' },
    ], snd.id || 'chime');
    soundSel.onchange = () => { Store.get().sound = Store.get().sound || {}; Store.get().sound.id = soundSel.value; Store.save(); };
    const vol = document.createElement('input'); vol.type = 'range'; vol.min = '0'; vol.max = '100'; vol.value = (snd.volume != null ? snd.volume : 90); vol.className = 'font-slider';
    const volLabel = document.createElement('span'); volLabel.style.fontWeight = '700'; volLabel.textContent = vol.value + '%';
    vol.oninput = () => { volLabel.textContent = vol.value + '%'; Store.get().sound = Store.get().sound || {}; Store.get().sound.volume = +vol.value; };
    vol.onchange = () => Store.save();
    const volRow = document.createElement('div'); volRow.className = 'row'; volRow.style.alignItems = 'center'; volRow.append(vol, volLabel);
    const soundFileI = document.createElement('input'); soundFileI.type = 'file'; soundFileI.accept = 'audio/*'; soundFileI.style.display = 'none';
    soundFileI.onchange = () => {
      const f = soundFileI.files[0]; if (!f) return;
      if (f.size > 2 * 1024 * 1024) return UI.toast('声音文件过大（请 < 2MB）');
      const r = new FileReader(); r.onload = () => { const s = Store.get().sound = Store.get().sound || {}; s.customUrl = r.result; s.id = 'custom'; Store.save(); UI.toast('已设置为自定义声音'); viewSettings(); };
      r.readAsDataURL(f);
    };
    const upSoundBtn = btn('上传自定义声音', () => soundFileI.click());
    const testBtn = btn('测试声音', () => { playSound(); showReminderPopup([{ source: 'idea', sourceId: '', name: '测试提醒', title: '这是一条测试提醒', date: Store.todayStr() }]); });
    testBtn.classList.add('btn-primary'); testBtn.style.marginLeft = '8px';
    const wb = Store.get().webhook || { url: '' };
    const wbI = UI.input(wb.url || '', '企业微信机器人 / 自定义 Webhook 地址（可选）');
    wbI.oninput = () => { Store.get().webhook = Store.get().webhook || {}; Store.get().webhook.url = wbI.value.trim(); };
    wbI.onchange = () => Store.save();
    const wbNote = document.createElement('p'); wbNote.className = 'muted'; wbNote.style.fontSize = '12px'; wbNote.style.marginTop = '8px';
    wbNote.innerHTML = '提醒触发时会向该地址推送一条消息，手机对应 App 即弹窗。支持两类：① <b>企业微信 / 钉钉机器人</b> Webhook 地址（直接粘贴即可）；② <b>Server酱</b>（sctapi.ftqq.com 或 sc.ftqq.com 的推送地址），可把提醒推到你的<b>个人微信</b>。填完点「测试声音」可试推。';
    sndCard.append(
      UI.field('提醒铃声', soundSel),
      UI.field('音量', volRow),
      (() => { const d = document.createElement('div'); d.className = 'row'; d.append(upSoundBtn, testBtn); return d; })(),
      UI.field('第三方推送（Webhook）', wbI),
      wbNote,
    );

    /* 数据同步卡片（手机 / 电脑互通） */
    const syncCard = UI_card('数据同步（手机 / 电脑互通）');
    const sync = Store.getSync() || {};
    const sw = document.createElement('input'); sw.type = 'checkbox'; sw.checked = !!sync.enabled;
    const swLabel = document.createElement('label'); swLabel.className = 'row'; swLabel.style.alignItems = 'center'; swLabel.style.gap = '8px';
    swLabel.append(sw, document.createTextNode('启用云端同步（LeanCloud）'));
    const idI = UI.input(sync.appId || '', 'LeanCloud App ID');
    const keyI = UI.input(sync.appKey || '', 'LeanCloud App Key');
    const urlI = UI.input(sync.serverUrl || '', 'API 域名（可选，国内版才需要）');
    const statusEl = document.createElement('p'); statusEl.className = 'muted'; statusEl.style.fontSize = '12px';
    statusEl.textContent = sync.enabled ? (sync.objectId ? '已连接，数据将在设备间自动同步' : '已启用，下次保存将创建云端存档') : '未启用';
    const saveSync = btn('保存同步设置', () => {
      const cur = Store.getSync();
      cur.enabled = sw.checked; cur.appId = idI.value.trim(); cur.appKey = keyI.value.trim(); cur.serverUrl = urlI.value.trim();
      Store.reinitSync(); Store.save();
      statusEl.textContent = sw.checked ? '已保存，正在连接…' : '已关闭';
      setTimeout(() => Store.syncNow().then(ok => { statusEl.textContent = ok ? '同步成功 ✓' : (sw.checked ? '已保存，等待首次上传' : '已关闭'); }), 500);
      UI.toast('同步设置已保存');
    });
    saveSync.classList.add('btn-primary');
    const pushB = btn('立即上传到云端', () => { Store.pushNow(); UI.toast('已上传到云端'); });
    const pullB = btn('立即从云端拉取', () => { Store.syncNow().then(ok => UI.toast(ok ? '已从云端拉取' : '拉取失败 / 未配置')); });
    const syncNote = document.createElement('p'); syncNote.className = 'muted'; syncNote.style.fontSize = '12px'; syncNote.style.marginTop = '8px';
    syncNote.innerHTML = '在 <b>leancloud.cn</b> 免费注册 → 创建应用 →「存储」里新建 Class 名为 <b>MindState</b> → 把 App ID / App Key 填到上面。手机和电脑用<b>同一组</b>，数据即互通。App Key 仅存你本地浏览器。';
    syncCard.append(
      swLabel,
      UI.field('App ID', idI),
      UI.field('App Key', keyI),
      UI.field('API 域名（可选）', urlI),
      statusEl,
      (() => { const d = document.createElement('div'); d.className = 'row'; d.append(saveSync, pushB, pullB); return d; })(),
      syncNote,
    );

    /* 数据备份与恢复（新：可落盘到本地文件，永不再丢） */
    const backupCard = UI_card('数据备份与恢复');
    const statusEl2 = document.createElement('div'); statusEl2.className = 'muted'; statusEl2.style.fontSize = '13px'; statusEl2.style.marginBottom = '10px';
    const refreshStatus = () => {
      const s = Store.getStatus();
      const ls = s.lastSaved ? new Date(s.lastSaved).toLocaleString('zh-CN') : '尚未落盘';
      if (s.backend) statusEl2.innerHTML = `✅ 已连接本地服务器，数据自动保存到本机文件 <code>data/mind_data.json</code>。<br>最近保存：${ls}`;
      else if (s.storage) statusEl2.innerHTML = `⚠️ 未连接本地服务器：数据仅存于当前浏览器（换端口 / 清缓存会丢）。请用 <code>node server.js</code> 打开本应用。`;
      else statusEl2.innerHTML = `⛔ 当前环境无法保存数据，请改用 <code>node server.js</code> 打开。`;
    };
    refreshStatus();
    const statusTimer = setInterval(() => { if (!document.body.contains(backupCard)) { clearInterval(statusTimer); return; } refreshStatus(); }, 2000);

    const dlBtn = btn('立即下载备份', () => {
      const data = Store.exportData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      const ts = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19);
      a.href = URL.createObjectURL(blob); a.download = 'mind-backup-' + ts + '.json'; a.click();
      URL.revokeObjectURL(a.href);
      UI.toast('已下载备份文件，请妥善保存');
    });
    const fileI2 = document.createElement('input'); fileI2.type = 'file'; fileI2.accept = '.json,application/json'; fileI2.style.display = 'none';
    fileI2.onchange = () => {
      const f = fileI2.files[0]; if (!f) return;
      const r = new FileReader();
      r.onload = () => {
        try {
          const obj = JSON.parse(r.result);
          Store.importData(obj); Store.applyTheme(); renderTopProfile(); showView(currentViewId);
          UI.toast('已从文件恢复数据');
        } catch (e) { UI.toast('文件解析失败：' + e.message); }
      };
      r.readAsText(f);
    };
    const impBtn = btn('从文件恢复', () => fileI2.click());
    const migBtn = btn('把当前浏览器数据写入本地文件', () => {
      Store.migrateToDisk().then(ok => { refreshStatus(); UI.toast(ok ? '已写入本地文件 ✓' : '未连接本地服务器，无法写入（请用 node server.js 打开）'); });
    });
    const row1 = document.createElement('div'); row1.className = 'row'; row1.style.flexWrap = 'wrap'; row1.style.gap = '8px';
    row1.append(dlBtn, impBtn, migBtn);
    backupCard.append(statusEl2, row1);

    // 历史备份列表 + 回滚
    const backupsWrap = document.createElement('div'); backupsWrap.style.marginTop = '12px';
    const backupsTitle = document.createElement('div'); backupsTitle.className = 'field-label'; backupsTitle.textContent = '本地历史备份（自动保留最近 20 份，可回滚）';
    const backupsList = document.createElement('div'); backupsList.style.fontSize = '13px';
    backupsList.innerHTML = '<span class="muted">点击下方按钮刷新查看</span>';
    const refreshBackups = btn('刷新备份列表', () => {
      backupsList.innerHTML = '<span class="muted">加载中…</span>';
      Store.getBackups().then(j => {
        if (!j || !j.ok) { backupsList.innerHTML = '<span class="muted">未连接本地服务器，无法列出备份（请用 node server.js 打开）</span>'; return; }
        const items = (j.backups || []);
        if (!items.length) { backupsList.innerHTML = '<span class="muted">暂无历史备份</span>'; return; }
        backupsList.innerHTML = '';
        items.slice(0, 20).forEach(b => {
          const line = document.createElement('div'); line.className = 'row'; line.style.justifyContent = 'space-between'; line.style.alignItems = 'center'; line.style.padding = '6px 0'; line.style.borderBottom = '1px solid rgba(0,0,0,.06)';
          const when = new Date(b.mtime).toLocaleString('zh-CN');
          const left = document.createElement('span'); left.textContent = when + '  （' + (b.size / 1024).toFixed(1) + ' KB）';
          const rb = btn('回滚', () => {
            if (!confirm('确定回滚到该备份？当前未保存的改动将被覆盖。')) return;
            Store.restoreBackup(b.name).then(res => { if (res && res.ok) { Store.applyTheme(); renderTopProfile(); showView(currentViewId); UI.toast('已回滚到 ' + b.name); } else UI.toast('回滚失败：' + ((res && res.message) || '未知错误')); });
          });
          rb.style.padding = '4px 12px'; rb.style.fontSize = '12px';
          line.append(left, rb); backupsList.appendChild(line);
        });
      });
    });
    backupsWrap.append(backupsTitle, refreshBackups, backupsList);
    backupCard.appendChild(backupsWrap);

    const backupNote = document.createElement('p'); backupNote.className = 'muted'; backupNote.style.fontSize = '12px'; backupNote.style.marginTop = '10px';
    backupNote.innerHTML = '所有操作均在你本机完成，不经过任何外部服务器（除非你另行开启上方「云端同步」）。推荐始终用 <code>node server.js</code>（或双击 start.bat）打开本应用，数据会自动、永久地保存到 <code>data/mind_data.json</code>。';
    backupCard.appendChild(backupNote);

    main.append(card, themeCard, fontCard, remCard, sndCard, syncCard, backupCard, tip);
  }

  /* ============================================================
     模块 · 就业 + 选课
     就业：大方向方块总览 → 点入方向看 岗位类型 → 适配公司 → 岗位要求
     选课：各单元考核构成（文字详列，无进度条），数据来自布里斯托官网
     本模块配色固定为中性灰白 + 黑字，不随主题色变化
     ============================================================ */

  // ============================================================
  // 模块八 · 就业+选课（基于 Store 可编辑 + 中性灰白配色）
  //   就业：大方向总览（横向方块）→ 方向下钻 → 岗位类型 → 公司 → 要求
  //   选课：各单元考核构成（文字详列，无进度条），数据来自布里斯托官网
  //   所有就业数据持久化在 Store.profile.career；用户可增删改方向与岗位
  //   "AI 帮忙查找岗位"按钮：提示用户在 WorkBuddy 对话框请求 AI 帮忙
  //   本模块配色固定为中性灰白 + 黑字，不随主题色变化
  // ============================================================

  // ---------- 默认就业数据（首次加载写入 Store；用户后续可自由编辑） ----------
  // 字段：id, dirId, type(英文岗位名), salary, salaryUnit(年薪/月薪/不确定),
  //       education(学历要求), description(岗位是干什么的),
  //       domestic[](国内公司), foreign[](国外公司),
  //       req[](要求), courses[](布里斯托课程代码),
  //       note(短说明), memo(详情备忘录), pinned(置顶)
  function defaultCareerData() {
    const dirs = [
      { id: 'mech',     name: 'Mechanical & Mathematical Modelling', tagline: '用数学建模机器、结构、运动与控制' },
      { id: 'finance',  name: 'Finance',                            tagline: '定价、风险、交易与资本配置' },
      { id: 'computing',name: 'Computing',                          tagline: '软件、AI、机器学习与大规模系统' },
      { id: 'datasci',  name: 'Data Science',                       tagline: '建模、预测与数据洞察' },
      { id: 'statsba',  name: 'Statistics & Business Analytics',    tagline: '推断、决策科学与运筹' },
      { id: 'research', name: 'Research / Academia',                tagline: '推进数学知识本身' },
    ];
    const jobs = [
      // --- Mechanical & Mathematical Modelling ---
      { id: 'j1',  dirId: 'mech',     type: 'Autonomous Driving Engineer',
        salary: '£45k–£90k（UK）；¥30k–¥80k 月薪（国内，不确定）',
        salaryUnit: '年薪 / 月薪', education: '本科及以上（硕士优先），计算机 / 数学 / 自动化 / 车辆工程',
        description: '用数学描述车辆运动与感知，构建自动驾驶的感知、定位、规划与控制算法。负责多体动力学建模、传感器融合、轨迹规划。',
        domestic: ['蔚来','小鹏','理想','华为车 BU','Momenta','文远知行','小马智行','百度 Apollo','滴滴自动驾驶'],
        foreign: ['Tesla','Waymo','Oxa','Wayve','Cruise','Mobileye'],
        req: ['多体动力学与最优控制','C++ 与 Python','概率建模与滤波（卡尔曼/粒子）','感知与定位的数学基础'],
        courses: ['MATH20101','MATH30029','MATH30017','MATH20015'],
        note: '数学偏建模 + 仿真，是数学系学生切入自动驾驶的主要路径。', memo: '', pinned: false },
      { id: 'j2',  dirId: 'mech',     type: 'CAE / Simulation Engineer (wings, chip packaging)',
        salary: '£40k–£75k（UK）；¥20k–¥50k 月薪（国内，不确定）',
        salaryUnit: '年薪 / 月薪', education: '本科及以上，力学 / 机械 / 数学 / 工程计算',
        description: '用有限元与偏微分方程数值解，对航空机翼、芯片封装、汽车结构件做仿真分析，替代部分物理试验。',
        domestic: ['华为','中兴','AVIC（中航工业）','中国商飞','中车','三一重工','比亚迪'],
        foreign: ['ANSYS','Siemens Digital Industries','Dassault Systèmes','Rolls-Royce','Altair','ESI Group'],
        req: ['有限元与偏微分方程数值解','结构力学 / 传热学','Python 自动化脚本','连续介质力学'],
        courses: ['MATH20402','MATH30029','MATH20015'],
        note: '数值 PDE 驱动航空航天与半导体产品设计。', memo: '', pinned: false },
      { id: 'j3',  dirId: 'mech',     type: 'Robotics Engineer (industrial / surgical)',
        salary: '£42k–£80k（UK）；¥25k–¥60k 月薪（国内，不确定）',
        salaryUnit: '年薪 / 月薪', education: '本科及以上，机器人 / 控制 / 数学 / 机械工程',
        description: '机械臂与手术机器人的运动规划、轨迹优化、力控算法。涉及刚体动力学、李群、最优控制。',
        domestic: ['大疆','新松','埃斯顿','节卡','遨博','微创医疗','精锋医疗','术锐技术'],
        foreign: ['ABB','KUKA','Intuitive Surgical','CMR Surgical','Universal Robots','Shadow Robot','Boston Dynamics'],
        req: ['刚体动力学与机械臂运动学','最优控制与轨迹规划','线性代数与数值优化','ROS / C++'],
        courses: ['MATH20101','MATH30017','MATH10015','MATH21100'],
        note: '机械臂与手术机器人的运动规划与控制数学。', memo: '', pinned: false },
      { id: 'j4',  dirId: 'mech',     type: 'Wind / Grid Power Analyst',
        salary: '£40k–£75k（UK）；¥18k–¥40k 月薪（国内，不确定）',
        salaryUnit: '年薪 / 月薪', education: '本科及以上，数学 / 统计 / 电气工程 / 能源工程',
        description: '用随机过程与时间序列预测风况、负荷与电网稳定性；用 PDE 建模流体与热传导。',
        domestic: ['国家电网','南方电网','金风科技','远景能源','明阳智能','华能','大唐'],
        foreign: ['Ørsted','Siemens Gamesa','EDF','Vestas','Iberdrola','NextEra'],
        req: ['风/负荷的随机过程建模','流体与热传导 PDE 模型','时间序列预测','概率与统计'],
        courses: ['MATH20008','MATH33800','MATH20800'],
        note: '可再生能源发电与电网稳定性的统计预测。', memo: '', pinned: false },
      { id: 'j5',  dirId: 'mech',     type: 'Humanoid Robotics Engineer',
        salary: '£55k–£110k（UK）；$90k–$180k（US）；¥40k–¥100k 月薪（国内，不确定）',
        salaryUnit: '年薪 / 月薪', education: '硕士及以上，机器人 / 控制 / 数学 / 强化学习',
        description: '双足运动与全身控制：非线性动力学、接触建模、强化学习控制、刚体的李群几何。',
        domestic: ['宇树科技','傅利叶智能','智元机器人','优必选','小米机器人','追觅'],
        foreign: ['Boston Dynamics','Figure','1X','Agility Robotics','Sanctuary AI','Apptronik'],
        req: ['非线性动力学与接触建模','强化学习控制','刚体的李群几何','实时 C++ / GPU'],
        courses: ['MATH20101','MATH21900','MATH30028','MATH30017'],
        note: '双足运动与全身控制位于数学-ML 交界。', memo: '', pinned: false },
      { id: 'j6',  dirId: 'mech',     type: 'Manufacturing / Path-Planning Analyst',
        salary: '£40k–£70k（UK）；¥15k–¥35k 月薪（国内，不确定）',
        salaryUnit: '年薪 / 月薪', education: '本科及以上，运筹学 / 数学 / 工业工程 / 计算机',
        description: '用图算法与组合优化做仓储路径规划、AGV 调度、配送路线优化。',
        domestic: ['京东物流','菜鸟网络','顺丰','苏宁物流','德邦','安吉物流','美团配送'],
        foreign: ['Amazon Robotics','FedEx','DHL','Siemens Logistics','AutoStore','Symbotic'],
        req: ['图算法与组合优化','运筹学','概率与排队论','Python'],
        courses: ['MATH30017','MATH10015','MATH10013'],
        note: '路径规划、调度与仓储自动化的数学。', memo: '', pinned: false },

      // --- Finance ---
      { id: 'j7',  dirId: 'finance',  type: 'Quantitative Researcher',
        salary: '国内 base 40-80 万 + 业绩提成；UK £80k–£150k 起，senior 总薪酬 £160k–£600k+',
        salaryUnit: '年薪', education: '国内外名校硕士及以上（博士优先），数学 / 统计 / 计算机 / 物理',
        description: '挖掘 alpha 信号、构建因子模型、设计系统化交易策略，从研究想法到实盘落地。把数据转换为对收益有预测力的信号。',
        domestic: ['九坤','明汌','宽德','玄信','幻方','衍复','鸣石','宁泉','景林','朱雀','中金','中信','华泰','招商'],
        foreign: ['Citadel','Jane Street','Two Sigma','Hudson River Trading','Jump Trading','Winton','Man Group','Millennium','Point72'],
        req: ['概率论与随机微积分','统计推断与时间序列','线性代数与数值方法','Python / C++'],
        courses: ['MATH20008','MATH20800','MATH33800','MATH35600','MATH35400'],
        note: '数学密集、奖金驱动；要求名校 + 扎实编程 + 数学竞赛获奖。', memo: '', pinned: false },
      { id: 'j8',  dirId: 'finance',  type: 'Quantitative Developer',
        salary: '国内月薪 30k–60k + 年终奖；UK £60k–£110k 起，senior £110k–£330k',
        salaryUnit: '年薪 / 月薪', education: '本科及以上，计算机 / 数学 / 物理（硕士优先）',
        description: '构建微秒级定价、风控与执行系统；把研究逻辑稳健工程化并部署到实盘。',
        domestic: ['九坤','明汌','宽德','玄信','幻方','衍复','中金','中信','华泰','恒生电子'],
        foreign: ['Goldman Sachs','JPMorgan','Morgan Stanley','Barclays','Citadel','Hudson River Trading'],
        req: ['低延迟 C++ 与 Python','数值线性代数','分布式系统与数据工程','概率与统计'],
        courses: ['MATH10015','MATH21100','MATH20014','MATH30017'],
        note: '量化研究走向实盘的关键工程角色。', memo: '', pinned: false },
      { id: 'j9',  dirId: 'finance',  type: 'Quantitative Analyst (Pricing / Risk)',
        salary: '国内月薪 25k–50k + 年终奖；UK £55k–£100k 起，senior £160k–£280k',
        salaryUnit: '年薪 / 月薪', education: '硕士及以上，金融工程 / 数学 / 物理 / 统计',
        description: '构建利率/外汇/信用产品的定价模型与风险引擎；做风险量化、模型验证与压力测试。',
        domestic: ['中信证券','中金','华泰','招商证券','广发证券','海通','工商银行','建设银行'],
        foreign: ['Goldman Sachs','JPMorgan','Barclays','UBS','BNP Paribas','HSBC','Deutsche Bank'],
        req: ['随机微积分与衍生品定价','蒙特卡洛方法','风险建模（VaR、信用）','Python 与 SQL'],
        courses: ['MATH20008','MATH35600','MATH35400','MATH30014'],
        note: '经典 quant 角色；银行的定价模型与风险引擎。', memo: '', pinned: false },
      { id: 'j10', dirId: 'finance',  type: 'Quantitative Trader',
        salary: '国内 base 4 万 + 月份红不封顶；UK £80k–£180k 起，senior £290k–£700k+',
        salaryUnit: '年薪', education: '名校本科及以上，数学 / 统计 / 计算机 / 物理',
        description: '设计与运行自动化策略；评估改进基于数据的交易策略；绩效挂钩、方差最大。',
        domestic: ['九坤','明汌','衍复','鸣石','宽德','玄信','幻方','宁泉','景林','朱雀'],
        foreign: ['Citadel Securities','Jane Street','Optiver','IMC','Two Sigma','Flow Traders','Akuna','DRW'],
        req: ['概率与统计','博弈论与市场微观结构','C++ / Python','快速心算'],
        courses: ['MATH20008','MATH20800','MATH10013','MATH20014'],
        note: '高薪高方差；要求名校 + 数学/编程/竞赛双优。', memo: '', pinned: false },
      { id: 'j11', dirId: 'finance',  type: 'Actuary',
        salary: '国内毕业 ¥8k–¥15k 月薪，准精算师 ¥15k–¥30k，FIA ¥40k+；UK 毕业 £35k–£55k，qualified £60k–£90k',
        salaryUnit: '年薪 / 月薪', education: '本科及以上，精算 / 数学 / 统计 / 金融',
        description: '保险与养老金产品的定价、准备金评估、资本管理；考 IFoA / 中国精算师考试体系。',
        domestic: ['中国平安','中国人寿','中国太保','新华保险','泰康','友邦','众安在线','太平洋保险'],
        foreign: ['Aviva','Legal & General','Prudential','Aon','Willis Towers Watson','KPMG','PwC','Deloitte'],
        req: ['概率与随机过程','生存模型与寿险精算','统计推断','精算师考试（IFoA / 中精）'],
        courses: ['MATH20008','MATH20800','MATH35600','MATH33800'],
        note: '考试驱动资格路径；稳定增长。', memo: '', pinned: false },
      { id: 'j12', dirId: 'finance',  type: 'Investment Banking Analyst',
        salary: '香港 HK$75k–HK$130k 月薪 + 6-14 个月分红；UK £55k–£80k 底薪，总薪 £80k–£120k；国内 ¥209k–¥340k 年薪',
        salaryUnit: '月薪 + 分红 / 年薪', education: '名校本科及以上（金融 / 经济 / 会计 / 数学），MBA 优先',
        description: 'DCF / LBO / M&A 财务建模、估值、pitch book 制作、尽职调查；每周 65-100 小时。',
        domestic: ['中金','中信','华泰联合','招商证券','国泰君安','申万宏源','海通','广发'],
        foreign: ['Goldman Sachs','Morgan Stanley','JPMorgan','Bank of America','Rothschild','Lazard'],
        req: ['财务建模（DCF、LBO、M&A）','会计与估值','Excel 与 PowerPoint','强沟通能力'],
        courses: ['MATH10013','MATH20800','MATH30014'],
        note: '数学轻但 Excel 重，每周 70–100 小时；高薪但高强度。', memo: '', pinned: false },
      { id: 'j13', dirId: 'finance',  type: 'Asset Management Analyst',
        salary: '国内月薪 15k–30k + 年终奖；UK £55k–£85k 起，总薪酬 £85k–£150k',
        salaryUnit: '年薪 / 月薪', education: '本科及以上，金融 / 数学 / 统计 / 经济',
        description: '管理长期资金；做投资组合理论、因子模型、时间序列与风险预算。',
        domestic: ['易方达','华夏基金','嘉实基金','南方基金','博时基金','广发基金','汇添富','中欧基金','景林','高毅'],
        foreign: ['BlackRock','Vanguard','Fidelity','Schroders','Baillie Gifford','Aberdeen','T. Rowe Price'],
        req: ['投资组合理论与因子模型','时间序列与风险预算','计量经济学','Python / R'],
        courses: ['MATH20800','MATH33800','MATH35600','MATH30014'],
        note: '比 IB 更研究、更少执行；晋升较慢。', memo: '', pinned: false },
      { id: 'j14', dirId: 'finance',  type: 'Risk Manager',
        salary: '国内月薪 20k–40k + 年终奖；UK £45k–£70k 起，senior £65k–£130k',
        salaryUnit: '年薪 / 月薪', education: '本科及以上，数学 / 统计 / 金融工程 / 风险管理',
        description: '量化与限制损失；市场风险、信用风险、操作风险建模与压力测试。',
        domestic: ['工商银行','建设银行','中国银行','农业银行','招商银行','中信银行','平安银行','交通银行'],
        foreign: ['HSBC','Barclays','Standard Chartered','NatWest','Deloitte','EY','PwC','KPMG'],
        req: ['市场与信用风险建模','概率与极值理论','压力测试','SQL / Python'],
        courses: ['MATH20008','MATH20800','MATH30014','MATH35600'],
        note: '监管下增长稳定。', memo: '', pinned: false },
      { id: 'j15', dirId: 'finance',  type: 'Financial Data Analyst',
        salary: '国内月薪 12k–25k + 年终奖；UK £40k–£65k 起，senior £55k–£90k',
        salaryUnit: '年薪 / 月薪', education: '本科及以上，数学 / 统计 / 金融 / 计算机',
        description: '构建行业运行的金融数据产品；时间序列分析、SQL 数据清洗、看板搭建。',
        domestic: ['万得 Wind','东方财富','同花顺','恒生电子','大智慧','雪球'],
        foreign: ['Bloomberg','Refinitiv','S&P Global','Moody\'s','Fitch','FactSet'],
        req: ['时间序列与计量经济','SQL 与数据清洗','看板（Power BI / Tableau）','Python'],
        courses: ['MATH20800','MATH33800','MATH10013'],
        note: '构建行业运行的金融数据产品。', memo: '', pinned: false },

      // --- Computing ---
      { id: 'j16', dirId: 'computing',type: 'Software Engineer',
        salary: '国内月薪 18k–50k + 股票；UK £45k–£75k 起，mid £70k–£120k，senior £110k–£180k',
        salaryUnit: '年薪 / 月薪', education: '本科及以上，计算机 / 数学 / 软件 / 电子工程',
        description: '大规模构建生产软件；数据结构与算法、系统设计、CI/CD。',
        domestic: ['字节跳动','腾讯','阿里','百度','美团','京东','拼多多','网易','快手','滴滴','华为','小米','大疆'],
        foreign: ['Google','Meta','Microsoft','Amazon','Apple','Bloomberg','Spotify','Uber','Netflix'],
        req: ['数据结构与算法','系统设计','Python / Java / C++ / Go 之一','版本控制与 CI/CD'],
        courses: ['MATH20014','MATH10015','MATH21100','MATH10027'],
        note: 'CS 毕业生最常见岗位；行业需求最广。', memo: '', pinned: false },
      { id: 'j17', dirId: 'computing',type: 'Machine Learning Engineer',
        salary: '国内月薪 25k–70k（硕士起步）；UK £55k–£105k，中位数 ~£67k，senior £85k–£140k',
        salaryUnit: '年薪 / 月薪', education: '硕士及以上（博士优先），机器学习 / 数学 / 统计 / 计算机',
        description: '将 ML 模型推向生产；从研究到工程化、模型部署、MLOps 全流程。',
        domestic: ['字节豆包','阿里达摩院','百度文心','腾讯优图','华为诺亚方舟','商汤','旷视','地平线','第四范式','出门问问'],
        foreign: ['DeepMind','OpenAI','Anthropic','Stability AI','Hugging Face','Bloomberg','Tesco ML'],
        req: ['线性代数与多元微积分','概率与统计','PyTorch / TensorFlow','MLOps（Docker、Kubernetes、云）'],
        courses: ['MATH10015','MATH20008','MATH30028','MATH20014','MATH20015'],
        note: '"数据科学家提问，ML 工程师构建"；工资高于通才 15-20%。', memo: '', pinned: false },
      { id: 'j18', dirId: 'computing',type: 'NLP / LLM Engineer',
        salary: '国内月薪 30k–80k；UK £65k–£110k，比通才高 15–20%',
        salaryUnit: '年薪 / 月薪', education: '硕士及以上，NLP / 数学 / 计算机 / 统计',
        description: '在 LLM 上构建聊天、翻译、摘要、Agent 系统；微调、RAG、多模态管线。',
        domestic: ['智谱 AI','百川智能','月之暗面','Minimax','阶跃星辰','澜舟科技','IDEA 研究院'],
        foreign: ['OpenAI','Anthropic','Cohere','Hugging Face','Stability AI','Character.AI','Google DeepMind'],
        req: ['概率与信息论','线性代数与高维几何','PyTorch 与 Transformer 内部','微调与 RAG 管线'],
        courses: ['MATH20008','MATH10015','MATH30028','MATH20014'],
        note: '2026 最热赛道之一；大模型应用层。', memo: '', pinned: false },
      { id: 'j19', dirId: 'computing',type: 'Computer Vision Engineer',
        salary: '国内月薪 25k–60k；UK £60k–£105k',
        salaryUnit: '年薪 / 月薪', education: '硕士及以上，计算机视觉 / 数学 / 计算机 / 自动化',
        description: '图像/视频理解：ADAS、AR/VR、医疗影像、机器人视觉；射影几何、CNN、GPU 编程。',
        domestic: ['商汤','旷视','地平线','文远知行','小马智行','华为车 BU','大疆','依图'],
        foreign: ['Wayve','Oxa','Waymo','Meta Reality Labs','Apple Vision','Samsung AI','Tesla Autopilot'],
        req: ['射影几何与相机模型','CNN 架构','PyTorch 与 GPU 编程','数据集与评估'],
        courses: ['MATH10015','MATH20015','MATH30028','MATH20014'],
        note: '面向 ADAS、AR/VR、医疗影像、机器人。', memo: '', pinned: false },
      { id: 'j20', dirId: 'computing',type: 'AI Research Scientist',
        salary: '国内年薪 50万–150万 + 股票；UK £75k–£140k，前沿实验室 £120k–£250k+',
        salaryUnit: '年薪', education: '博士（或杰出硕士），数学 / 计算机 / 物理 / 统计',
        description: '设计新算法；研究方法、论文写作、PyTorch 内部、大规模训练。',
        domestic: ['上海人工智能实验室','智源研究院','百度研究院','阿里达摩院','腾讯 AI Lab','华为 2012 实验室'],
        foreign: ['DeepMind','OpenAI','Anthropic','FAIR','Microsoft Research','Graphcore','高校实验室'],
        req: ['扎实的数学（概率、分析、线性代数）','研究方法与论文写作','PyTorch 内部','通常需硕士/博士'],
        courses: ['MATH10011','MATH10015','MATH20008','MATH20006','MATH30028'],
        note: '学术与前沿研究；数学密集。', memo: '', pinned: false },
      { id: 'j21', dirId: 'computing',type: 'Prompt / Applied AI Engineer',
        salary: '国内月薪 20k–50k；UK £55k–£100k',
        salaryUnit: '年薪 / 月薪', education: '本科及以上，数学 / 计算机 / 工程（无需研究生）',
        description: '调优、评估并上线 LLM 应用；无需重度 ML 研究，更偏产品判断与工程。',
        domestic: ['字节','阿里','腾讯','百度 AI 应用团队','各企业 AI 团队','智谱','百川'],
        foreign: ['OpenAI','Anthropic','Cohere','LangChain（初创）','企业 AI 团队'],
        req: ['概率推理','LLM 评估方法学','Python 与 LangChain / LlamaIndex','产品判断'],
        courses: ['MATH20008','MATH20014','MATH30028','MATH10013'],
        note: '新岗位；无需 PhD，本科可入行。', memo: '', pinned: false },
      { id: 'j22', dirId: 'computing',type: 'Generative AI Engineer',
        salary: '国内月薪 30k–80k + 期权；UK £70k–£130k',
        salaryUnit: '年薪 / 月薪', education: '硕士及以上，深度学习 / 数学 / 计算机',
        description: '面向创意工具的图像、视频与多模态生成；扩散模型、VAE、Transformer、分布式训练。',
        domestic: ['智谱','百川','月之暗面','Minimax','阶跃星辰','腾讯混元','阿里通义','字节'],
        foreign: ['Stability AI','OpenAI','Anthropic','Runway','Pika','Character.AI','Hugging Face'],
        req: ['扩散模型与 VAE 数学','Transformer 内部','多模态管线','PyTorch 与分布式训练'],
        courses: ['MATH10015','MATH20008','MATH30028','MATH20014'],
        note: '面向创意工具的图像、视频与多模态生成。', memo: '', pinned: false },
      { id: 'j23', dirId: 'computing',type: 'MLOps / ML Platform Engineer',
        salary: '国内月薪 25k–60k；UK £65k–£120k',
        salaryUnit: '年薪 / 月薪', education: '本科及以上，计算机 / 数学 / DevOps',
        description: '让 ML 规模化的基础设施；分布式系统、数据工程、Docker/Kubernetes/云。',
        domestic: ['字节火山引擎','阿里 PAI','腾讯云 TI','华为 ModelArts','百度 BML','第四范式'],
        foreign: ['Hugging Face','Weights & Biases','Databricks','Snowflake','Modal','OctoML'],
        req: ['分布式系统与数据工程','Docker / Kubernetes / 云','ML 生命周期工具','Python 与 Go'],
        courses: ['MATH20014','MATH10015','MATH21100'],
        note: '让 ML 规模化的基础设施；供给稀缺。', memo: '', pinned: false },
      { id: 'j24', dirId: 'computing',type: 'Backend / Distributed Systems Engineer',
        salary: '国内月薪 20k–50k；UK £50k–£95k，senior £85k–£140k',
        salaryUnit: '年薪 / 月薪', education: '本科及以上，计算机 / 数学 / 软件',
        description: '高并发后端、分布式系统、微服务；每个产品背后的管道。',
        domestic: ['字节','腾讯','阿里','美团','京东','拼多多','网易','快手','滴滴','携程'],
        foreign: ['Stripe','Cloudflare','Datadog','Bloomberg','Uber','Spotify','Monzo'],
        req: ['算法与数据结构','分布式系统理论','并发与队列','Go / Java / Rust'],
        courses: ['MATH10015','MATH21100','MATH20014','MATH10027'],
        note: '高薪，行业需求广。', memo: '', pinned: false },

      // --- Data Science ---
      { id: 'j25', dirId: 'datasci',  type: 'Data Scientist',
        salary: '国内月薪 18k–45k；US $80k–$185k 起，total $124k–$260k+；UK £42k–£52k 起，senior £70k–£95k',
        salaryUnit: '年薪 / 月薪', education: '本科及以上（硕士优先），数学 / 统计 / 计算机 / 物理',
        description: '构建预测模型、A/B 测试、因果推断；把模糊业务问题翻译成可回答的数据问题。',
        domestic: ['字节','阿里','腾讯','美团','京东','平安','招行','滴滴','网易','小红书'],
        foreign: ['GDS','Tesco','Sainsbury\'s','Bloomberg','Spotify','BBC','Octopus Energy','OVO'],
        req: ['统计与概率','Python（Pandas、Scikit-learn、NumPy）','SQL 与数据清洗','A/B 测试与实验'],
        courses: ['MATH10013','MATH20800','MATH20014','MATH30028','MATH35600'],
        note: '需定量学位；中间含 ML 与分析两种偏向。', memo: '', pinned: false },
      { id: 'j26', dirId: 'datasci',  type: 'Data Analyst',
        salary: '国内月薪 8k–20k；UK junior £26k–£35k，mid £40k–£55k，senior £55k–£75k',
        salaryUnit: '年薪 / 月薪', education: '本科及以上，统计学 / 数学 / 商科 / 计算机',
        description: 'SQL 查询、Power BI 看板、A/B 测试、报告；最易入行的数据岗位。',
        domestic: ['各行业；四大、京东、网易、滴滴、平安、招行、银行','美团','字节'],
        foreign: ['Deloitte','KPMG','Tesco','NHS','Sky','BBC','ONS'],
        req: ['SQL（必备）','Excel 与 Power BI / Tableau','Python（加分）','商业沟通'],
        courses: ['MATH10013','MATH20800','MATH20014'],
        note: '最易入行的数据岗位；SQL 优先，数学比 DS 少。', memo: '', pinned: false },
      { id: 'j27', dirId: 'datasci',  type: 'Data Engineer',
        salary: '国内月薪 15k–40k；UK junior £45k–£58k，mid £55k–£75k，senior £75k–£110k',
        salaryUnit: '年薪 / 月薪', education: '本科及以上，计算机 / 数学 / 数据工程 / 软件',
        description: '构建喂给每个数据团队的管线；ETL、数据仓库、Airflow/dbt/Spark、云平台。',
        domestic: ['字节','阿里','腾讯','美团','京东','网易','滴滴','平安','字节火山引擎'],
        foreign: ['Snowflake','Databricks','Spotify','Monzo','Deloitte','Octopus Energy'],
        req: ['高级 SQL 与数据建模','Python 管线（Airflow、dbt、Spark）','云（AWS / GCP / Azure）','数据仓库'],
        courses: ['MATH20014','MATH10015','MATH21100','MATH10027'],
        note: '数据岗薪资上限最高。', memo: '', pinned: false },
      { id: 'j28', dirId: 'datasci',  type: 'Analytics Engineer',
        salary: '国内月薪 15k–35k；UK £45k–£70k',
        salaryUnit: '年薪 / 月薪', education: '本科及以上，数学 / 统计 / 计算机 / 商科',
        description: '位于数据工程与分析之间；SQL 精通、dbt 建模、版本控制、干系人沟通。',
        domestic: ['字节','阿里','腾讯','网易','京东','小红书'],
        foreign: ['dbt Labs','Snowflake','Spotify','Monzo','Octopus Energy','Sainsbury\'s'],
        req: ['SQL 精通','dbt 与数据建模','Python 与版本控制','干系人沟通'],
        courses: ['MATH10013','MATH20800','MATH20014'],
        note: '位于数据工程与分析之间；增长快。', memo: '', pinned: false },

      // --- Statistics & Business Analytics ---
      { id: 'j29', dirId: 'statsba',  type: 'Biostatistician',
        salary: '国内月薪 12k–30k；UK £30k–£50k 起，mid £40k–£60k，senior £55k+',
        salaryUnit: '年薪 / 月薪', education: '硕士及以上，统计 / 生物统计 / 数学 / 流行病学',
        description: '临床试验的统计设计与分析；生存分析、广义线性模型、ICH-GCP 合规。',
        domestic: ['恒瑞医药','药明康德','百济神州','信达生物','再鼎医药','康方生物','CDE（国家药监局）'],
        foreign: ['GSK','AstraZeneca','Pfizer','Roche','PHC Oncology','MRC Biostatistics Unit'],
        req: ['统计推断与广义线性模型','生存分析与临床试验设计','R 编程','法规意识（ICH-GCP）'],
        courses: ['MATH10013','MATH20800','MATH35600','MATH30015'],
        note: '稳定的药企职业；监管驱动。', memo: '', pinned: false },
      { id: 'j30', dirId: 'statsba',  type: 'Market / Survey Research Analyst',
        salary: '国内月薪 8k–20k；UK £27k–£40k 起，mid £40k–£60k',
        salaryUnit: '年薪 / 月薪', education: '本科及以上，统计 / 数学 / 市场营销 / 社会学',
        description: '为品牌与政府量化消费者与政治意见；抽样、问卷设计、假设检验、回归。',
        domestic: ['央视市场研究 CTR','零点有数','艾瑞咨询','易观','华通明略','凯度中国','尼尔森中国'],
        foreign: ['Kantar','Nielsen','Ipsos','GfK','YouGov','Gartner','Mintel'],
        req: ['抽样理论与调查方法学','假设检验与回归','R / SPSS','问卷设计'],
        courses: ['MATH10013','MATH20800','MATH35600'],
        note: '为品牌与政府量化意见。', memo: '', pinned: false },
      { id: 'j31', dirId: 'statsba',  type: 'Operations Research Analyst',
        salary: '国内月薪 12k–30k；UK £31.9k–£60.3k（英国政府），私企 £40k–£70k',
        salaryUnit: '年薪 / 月薪', education: '本科及以上，运筹学 / 数学 / 工业工程 / 计算机',
        description: '优化供应链、排班与路由；线性/非线性优化、随机过程、图与网络算法。',
        domestic: ['顺丰','菜鸟','京东物流','滴滴','美团配送','国航 / 东航运控','中铁'],
        foreign: ['政府运筹服务（dstl、MoD、DfT）','Amazon Logistics','DHL','NATS','BA','Ryanair'],
        req: ['线性与非线性优化','随机过程与排队论','图与网络算法','Python / AMPL / Gurobi'],
        courses: ['MATH30017','MATH20008','MATH10015','MATH10013'],
        note: '公务员与私企都有；稳定。', memo: '', pinned: false },
      { id: 'j32', dirId: 'statsba',  type: 'Business / Growth Analyst',
        salary: '国内月薪 12k–30k；UK £35k–£61k（MSc Business Analytics）',
        salaryUnit: '年薪 / 月薪', education: '本科及以上（硕士优先），商业分析 / 数学 / 统计 / 经济',
        description: '将数据转化为策略；描述性与预测性分析、SQL、看板、A/B 测试、干系人沟通。',
        domestic: ['字节','阿里','腾讯','京东','美团','滴滴','小红书','B 站','四大'],
        foreign: ['Deloitte','Accenture','PwC','Capgemini','Barclays','Sainsbury\'s','Octopus Energy'],
        req: ['描述性与预测性分析','SQL 与看板','A/B 测试','沟通与干系人管理'],
        courses: ['MATH10013','MATH20800','MATH20014'],
        note: '比数据科学家宽，建模少。', memo: '', pinned: false },
      { id: 'j33', dirId: 'statsba',  type: 'Government Statistician',
        salary: '国内月薪 6k–15k（公务员体系）；UK £28k–£45k 起，senior £45k–£70k',
        salaryUnit: '年薪 / 月薪', education: '本科及以上，统计 / 数学 / 经济',
        description: '官方统计与政策证据；调查方法学、披露控制、R/SAS、公共部门沟通。',
        domestic: ['国家统计局','各省市统计局','各调查总队','海关','税务局'],
        foreign: ['ONS','GSS（政府统计服务）','devolved administrations'],
        req: ['调查方法学','统计推断与披露控制','R / SAS','公共部门沟通'],
        courses: ['MATH10013','MATH20800','MATH35600'],
        note: '稳定的公共部门路径。', memo: '', pinned: false },
      { id: 'j34', dirId: 'statsba',  type: 'Credit / Risk Scoring Analyst',
        salary: '国内月薪 15k–35k；UK £35k–£65k',
        salaryUnit: '年薪 / 月薪', education: '本科及以上，统计 / 数学 / 金融工程 / 计算机',
        description: '构建每笔贷款与信用卡决策背后的评分卡；logistic 回归、违约概率/损失模型、模型验证。',
        domestic: ['蚂蚁集团','京东科技','招联消费金融','马上消费','微众银行','网商银行','各商业银行'],
        foreign: ['Experian','Equifax','TransUnion','Lloyds Banking Group','Barclays','Capital One'],
        req: ['logistic 回归与广义线性模型','违约概率 / 损失模型','Python / R / SQL','模型验证'],
        courses: ['MATH20800','MATH35600','MATH30014'],
        note: '消费金融核心岗位；监管驱动。', memo: '', pinned: false },

      // --- Research / Academia ---
      { id: 'j35', dirId: 'research', type: 'PhD Student (Mathematics)',
        salary: '国内奖学金 ¥3k–¥8k 月薪 + 学费减免；UKRI £18k–£25k/年 stipend + 学费减免',
        salaryUnit: '月薪 / 年薪（津贴）', education: '一等学位 / 高 2:1 BSc，建议先读硕士',
        description: '3–4 年；通往学术与工业研究职业的入口；选定方向、独立研究、发表。',
        domestic: ['北大','清华','复旦','上交','中科大','浙大','南大','北师大','中科院'],
        foreign: ['Oxford','Cambridge','Imperial','UCL','Bristol','Edinburgh','Warwick','ETH Zurich','MIT'],
        req: ['一等学位 / 高 2:1 BSc','阅读与撰写证明','建议读硕士','选定方向'],
        courses: ['MATH10027','MATH10015','MATH10011','MATH20006','MATH21800','MATH21100'],
        note: '通往学术与工业研究职业的入口。', memo: '', pinned: false },
      { id: 'j36', dirId: 'research', type: 'Postdoctoral Researcher',
        salary: '国内年薪 15万–35万；UK £33k–£38k 起，Y3 ~£42k，London +£3–5k',
        salaryUnit: '年薪', education: '博士毕业',
        description: 'Grade 7 固定期职位；扎实发表、独立研究项目、申请基金。',
        domestic: ['北大','清华','复旦','中科院','上交','中科大','浙大'],
        foreign: ['UCL','Imperial','Oxford','Cambridge','Bristol','Edinburgh','Max Planck','IHES'],
        req: ['博士毕业','扎实的发表记录','独立研究项目','申请基金潜力'],
        courses: ['所有与方向相关的 MATH2xx00 和 MATH3xx00'],
        note: '博士后的标准下一步；2-4 年。', memo: '', pinned: false },
      { id: 'j37', dirId: 'research', type: 'Lecturer (Mathematics)',
        salary: '国内年薪 20万–60万（双一流）；UK lecturer £38k–£58k，senior £44k–£60k+，professor £65k–£100k+',
        salaryUnit: '年薪', education: '博士 + 博后经历',
        description: '永久学术岗位；结合研究与教学；扎实教学记录、国际研究声誉、基金收入。',
        domestic: ['北大','清华','复旦','上交','中科大','浙大','南大','北师大','双一流高校'],
        foreign: ['Russell Group 高校（UCL、Imperial、Oxford、Cambridge、Edinburgh、Bristol）及其他'],
        req: ['博士与博后经历','扎实的教学记录','国际研究声誉','基金收入'],
        courses: ['Y2/Y3 各方向课程 + 教过的 MSc'],
        note: '永久学术岗位；研究+教学。', memo: '', pinned: false },
      { id: 'j38', dirId: 'research', type: 'Industry Research Scientist (AI / Maths)',
        salary: '国内年薪 50万–150万 + 股票；UK £50k–£68k 起，前沿实验室 £120k–£250k+',
        salaryUnit: '年薪', education: '博士或杰出的硕士',
        description: '学术研究的工业对应；研究发表、大规模 PyTorch 与 ML、稀缺技能的高薪。',
        domestic: ['西门子中国研究院','上海人工智能实验室','智源研究院','百度研究院','腾讯 AI Lab','阿里达摩院','华为 2012 实验室'],
        foreign: ['DeepMind','OpenAI','Anthropic','Microsoft Research','FAIR','Graphcore','Stability AI','XTX Markets'],
        req: ['博士或杰出的硕士','扎实的数学','研究发表','大规模 PyTorch 与 ML'],
        courses: ['MATH20008','MATH30028','MATH35600','MATH20006'],
        note: '稀缺技能的高薪；学术研究的工业对应。', memo: '', pinned: false },
    ];
    return { dirs, jobs };
  }

  // ---------- 就业数据访问器（读写 Store.profile.career） ----------
  function careerData() {
    const c = Store.get().profile.career;
    if (!c.dirs || !c.dirs.length) {
      const d = defaultCareerData();
      Store.get().profile.career = d;
      Store.save();
      return d;
    }
    // migration: 老数据可能用 companies 字段（单数组），转成 domestic/foreign；补 pinned/memo/education/description/salaryUnit
    let changed = false;
    c.jobs.forEach(j => {
      if ((!j.domestic && !j.foreign) && j.companies && j.companies.length) {
        j.foreign = j.companies.slice();
        j.domestic = [];
        delete j.companies;
        changed = true;
      }
      if (!('memo' in j))      { j.memo = ''; changed = true; }
      if (!('pinned' in j))    { j.pinned = false; changed = true; }
      if (!('education' in j)) { j.education = ''; changed = true; }
      if (!('description' in j)){ j.description = ''; changed = true; }
      if (!('salaryUnit' in j)){ j.salaryUnit = ''; changed = true; }
    });
    if (changed) Store.save();
    return c;
  }
  function careerUid() { return 'd' + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-3); }
  function careerJobUid() { return 'j' + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-3); }

  // ---------- 小工具 ----------
  function cssId(s) { return 'u' + String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
  function courseChip(text, code) {
    const c = document.createElement('span');
    c.className = 'course-chip';
    c.textContent = text;
    if (code) {
      c.title = '在选课视图中打开本单元';
      c.onclick = (e) => { e.stopPropagation(); showView('courses'); setTimeout(() => { const el = document.getElementById('u-' + cssId(code)); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 60); };
    }
    return c;
  }

  // ---------- 全局右键菜单（用于岗位置顶） ----------
  let _ctxMenu = null;
  function showCtxMenu(x, y, items) {
    hideCtxMenu();
    const m = document.createElement('div'); m.className = 'ctx-menu cc-ctx-menu';
    items.forEach(it => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'ctx-item';
      b.textContent = it.label;
      if (it.disabled) { b.disabled = true; b.classList.add('disabled'); }
      else b.onclick = (e) => { e.stopPropagation(); hideCtxMenu(); it.action && it.action(); };
      m.appendChild(b);
    });
    m.style.left = '0px'; m.style.top = '0px';
    document.body.appendChild(m);
    // 防止菜单超出视口
    const r = m.getBoundingClientRect();
    const vx = Math.max(6, Math.min(x, window.innerWidth - r.width - 6));
    const vy = Math.max(6, Math.min(y, window.innerHeight - r.height - 6));
    m.style.left = vx + 'px'; m.style.top = vy + 'px';
    _ctxMenu = m;
    // 立即绑定：此时右键的 mousedown 已经派发完了，不会误关
    document.addEventListener('mousedown', onDocMouseDown, true);
    document.addEventListener('contextmenu', onDocMouseDown, true);
    document.addEventListener('keydown', onDocKeyDown, true);
  }
  function onDocKeyDown(e) { if (e.key === 'Escape') hideCtxMenu(); }
  /* 关键：只有点在菜单「外面」才关闭。
     点在菜单内部时必须放行，否则捕获阶段就把菜单移除了，click 永远触发不到，菜单就成了摆设。 */
  function onDocMouseDown(e) {
    if (_ctxMenu && e.target && _ctxMenu.contains(e.target)) return;
    hideCtxMenu();
  }
  function hideCtxMenu() {
    if (_ctxMenu) { _ctxMenu.remove(); _ctxMenu = null; }
    document.removeEventListener('mousedown', onDocMouseDown, true);
    document.removeEventListener('contextmenu', onDocMouseDown, true);
    document.removeEventListener('keydown', onDocKeyDown, true);
  }

  // ---------- 就业视图：方向总览（横向方块） ----------
  let _careerDirId = null;
  function viewCareer() {
    main.innerHTML = '';
    _careerDirId = null;
    const wrap = UI_card('就业大方向 · 数学与统计');
    const hint = document.createElement('p'); hint.className = 'cc-hint';
    hint.textContent = '点击方向方块进入岗位下钻。所有数据可编辑——可添加你自己的方向与岗位。在岗位卡片上点击鼠标右键可置顶/取消置顶。';
    wrap.appendChild(hint);

    const toolbar = document.createElement('div'); toolbar.className = 'cc-toolbar';
    const addDirBtn = btn('+ 添加方向', openAddDirForm);
    addDirBtn.classList.add('btn-primary');
    toolbar.appendChild(addDirBtn);
    wrap.appendChild(toolbar);

    const grid = document.createElement('div'); grid.className = 'cc-grid';
    const data = careerData();
    data.dirs.forEach(d => {
      const tile = document.createElement('div'); tile.className = 'cc-tile';
      const cnt = data.jobs.filter(j => j.dirId === d.id).length;
      tile.innerHTML = '<div class="cc-tile-name">' + esc(d.name) + '</div>'
                     + '<div class="cc-tile-tag">' + esc(d.tagline || '') + '</div>'
                     + '<div class="cc-tile-count">' + cnt + ' 个岗位</div>';
      const acts = document.createElement('div'); acts.className = 'cc-tile-acts';
      const edit = btn('编辑', (e) => { e.stopPropagation(); openEditDirForm(d); }); edit.classList.add('btn-ghost');
      const del = btn('删除', (e) => { e.stopPropagation(); confirmDeleteDir(d); }); del.classList.add('btn-ghost');
      acts.append(edit, del);
      tile.appendChild(acts);
      tile.onclick = () => renderCareerDir(d.id);
      grid.appendChild(tile);
    });
    wrap.appendChild(grid);

    const note = document.createElement('p'); note.className = 'cc-note';
    note.innerHTML = '数据来源：国内（BOSS直聘、智联、看准、拉勾、猎聘、前程无忧）+ 国外（LinkedIn、Glassdoor、Payscale、Indeed、ITJobsWatch、Levels.fyi）2026 多网站交叉验证。所有数字仅为参考；薪资因公司、地点与资历而异；不确定的项已标"（不确定）"。可在上方添加或编辑任何条目以匹配你自己的研究。';
    wrap.appendChild(note);

    main.appendChild(wrap);
  }

  // ---------- 就业视图：方向详情（岗位类型 → 公司 → 要求） ----------
  function renderCareerDir(id) {
    _careerDirId = id;
    main.innerHTML = '';
    const data = careerData();
    const dir = data.dirs.find(d => d.id === id);
    if (!dir) { viewCareer(); return; }
    const wrap = UI_card(dir.name);
    if (dir.tagline) { const t = document.createElement('p'); t.className = 'cc-dir-tag'; t.textContent = dir.tagline; wrap.appendChild(t); }

    const back = btn('← 返回方向总览', () => viewCareer()); back.classList.add('btn-ghost', 'back-btn');
    wrap.appendChild(back);

    const toolbar = document.createElement('div'); toolbar.className = 'cc-toolbar';
    const addJob = btn('+ 添加岗位到 ' + dir.name, () => openAddJobForm(dir)); addJob.classList.add('btn-primary');
    toolbar.appendChild(addJob);
    wrap.appendChild(toolbar);

    const jobs = data.jobs.filter(j => j.dirId === id);
    if (!jobs.length) {
      const empty = document.createElement('p'); empty.className = 'cc-empty';
      empty.textContent = '暂无岗位。用上方"+ 添加岗位"来填充本方向。';
      wrap.appendChild(empty);
    } else {
      // 排序：置顶在前；同组内按薪资下界降序
      const sorted = jobs.slice().sort((a, b) => {
        if (!!b.pinned - !!a.pinned) return (!!b.pinned) - (!!a.pinned);
        return salaryLow(b) - salaryLow(a);
      });
      sorted.forEach(j => wrap.appendChild(renderJob(j, dir)));
    }
    main.appendChild(wrap);
  }

  function salaryLow(j) {
    if (!j.salary) return 0;
    const m = String(j.salary).match(/(\d[\d,]*)\s*k/i);
    if (!m) return 0;
    return parseInt(m[1].replace(/,/g, ''), 10);
  }

  // 岗位卡片：标题行 + 按钮区（顶部） → 薪资 + 学历 + 描述 → 国内/国外公司 → 要求 → 课程 → note
  // 右键菜单：置顶 / 取消置顶 / 详情 / 编辑 / 删除
  function renderJob(j, dir) {
    const el = document.createElement('div'); el.className = 'cc-job' + (j.pinned ? ' is-pinned' : '');

    // 顶部：岗位名 + 置顶标 + 按钮区
    const head = document.createElement('div'); head.className = 'cc-job-head';
    const titleWrap = document.createElement('div'); titleWrap.className = 'cc-job-title-wrap';
    if (j.pinned) {
      const pin = document.createElement('span'); pin.className = 'cc-pin'; pin.textContent = '★ 已置顶';
      titleWrap.appendChild(pin);
    }
    const title = document.createElement('span'); title.className = 'cc-job-title'; title.textContent = j.type;
    titleWrap.appendChild(title);
    head.appendChild(titleWrap);
    const acts = document.createElement('div'); acts.className = 'cc-job-acts';
    const detail = btn('详情 →', () => viewJobDetail(j, dir)); detail.classList.add('btn-ghost');
    const edit = btn('编辑', () => openEditJobForm(j, dir)); edit.classList.add('btn-ghost');
    const del = btn('删除', () => confirmDeleteJob(j, dir)); del.classList.add('btn-ghost');
    acts.append(detail, edit, del);
    head.appendChild(acts);
    el.appendChild(head);

    // 薪资 / 学历 / 描述（紧凑信息块）
    const info = document.createElement('div'); info.className = 'cc-job-meta';
    if (j.salary) {
      const row = document.createElement('div'); row.className = 'cc-meta-row';
      row.innerHTML = '<span class="cc-meta-label">薪资</span><span class="cc-meta-val">' + esc(j.salary) + (j.salaryUnit ? '（' + esc(j.salaryUnit) + '）' : '') + '</span>';
      info.appendChild(row);
    }
    if (j.education) {
      const row = document.createElement('div'); row.className = 'cc-meta-row';
      row.innerHTML = '<span class="cc-meta-label">学历</span><span class="cc-meta-val">' + esc(j.education) + '</span>';
      info.appendChild(row);
    }
    if (j.description) {
      const row = document.createElement('div'); row.className = 'cc-meta-row';
      row.innerHTML = '<span class="cc-meta-label">工作内容</span><span class="cc-meta-val">' + esc(j.description) + '</span>';
      info.appendChild(row);
    }
    if (info.children.length) el.appendChild(info);

    // 国内公司
    if (j.domestic && j.domestic.length) {
      const cl = document.createElement('div'); cl.className = 'cc-job-label'; cl.textContent = '国内公司案例';
      const chips = document.createElement('div'); chips.className = 'chips';
      j.domestic.forEach(c => { const s = document.createElement('span'); s.className = 'company-chip'; s.textContent = c; chips.appendChild(s); });
      el.append(cl, chips);
    }
    // 国外公司
    if (j.foreign && j.foreign.length) {
      const cl = document.createElement('div'); cl.className = 'cc-job-label'; cl.textContent = '国外公司案例';
      const chips = document.createElement('div'); chips.className = 'chips';
      j.foreign.forEach(c => { const s = document.createElement('span'); s.className = 'company-chip'; s.textContent = c; chips.appendChild(s); });
      el.append(cl, chips);
    }

    // 要求
    if (j.req && j.req.length) {
      const rl = document.createElement('div'); rl.className = 'cc-job-label'; rl.textContent = '要求（技能与知识）';
      const ul = document.createElement('ul'); ul.className = 'cc-job-req';
      j.req.forEach(r => { const li = document.createElement('li'); li.textContent = r; ul.appendChild(li); });
      el.append(rl, ul);
    }

    // 推荐课程
    if (j.courses && j.courses.length) {
      const cl = document.createElement('div'); cl.className = 'cc-job-label'; cl.textContent = '推荐布里斯托课程';
      const chips = document.createElement('div'); chips.className = 'chips';
      j.courses.forEach(code => chips.appendChild(courseChip(code, code)));
      el.append(cl, chips);
    }

    // 短说明
    if (j.note) { const n = document.createElement('p'); n.className = 'cc-job-note'; n.textContent = j.note; el.appendChild(n); }

    // 右键菜单：置顶 / 详情 / 编辑 / 删除
    el.oncontextmenu = (e) => {
      e.preventDefault();
      showCtxMenu(e.pageX, e.pageY, [
        { label: j.pinned ? '取消置顶' : '★ 置顶', action: () => { j.pinned = !j.pinned; Store.save(); renderCareerDir(dir.id); UI.toast(j.pinned ? '已置顶' : '已取消置顶'); } },
        { label: '查看详情', action: () => viewJobDetail(j, dir) },
        { label: '编辑岗位', action: () => openEditJobForm(j, dir) },
        { label: '删除岗位', action: () => confirmDeleteJob(j, dir) },
      ]);
    };

    return el;
  }

  // ---------- 岗位详情界面（单独一页，含富文本备忘录 + 站内编辑） ----------
  function viewJobDetail(j, dir) {
    main.innerHTML = '';
    const wrap = UI_card(j.type);

    const back = btn('← 返回 ' + dir.name, () => renderCareerDir(dir.id)); back.classList.add('btn-ghost', 'back-btn');
    wrap.appendChild(back);

    // 顶部工具条：编辑 / 置顶 / 删除（详情页内可直接编辑，无需返回列表）
    const toolbar = document.createElement('div'); toolbar.className = 'cc-toolbar';
    const edit = btn('编辑岗位基本信息', () => openEditJobForm(j, dir, () => viewJobDetail(j, dir))); edit.classList.add('btn-primary');
    toolbar.appendChild(edit);
    const pin = btn(j.pinned ? '取消置顶' : '★ 置顶', () => { j.pinned = !j.pinned; Store.save(); viewJobDetail(j, dir); UI.toast(j.pinned ? '已置顶' : '已取消置顶'); });
    pin.classList.add('btn-ghost');
    toolbar.appendChild(pin);
    const del = btn('删除岗位', () => confirmDeleteJob(j, dir)); del.classList.add('btn-ghost');
    toolbar.appendChild(del);
    wrap.appendChild(toolbar);

    // 基本信息
    const info = document.createElement('div'); info.className = 'cc-job-info';
    const rows = [];
    rows.push(['所在方向', dir.name]);
    if (j.salary) rows.push(['薪资', j.salary + (j.salaryUnit ? '（' + j.salaryUnit + '）' : '')]);
    if (j.education) rows.push(['学历要求', j.education]);
    if (j.description) rows.push(['岗位是干什么的', j.description]);
    if (j.domestic && j.domestic.length) {
      const chips = document.createElement('div'); chips.className = 'chips';
      j.domestic.forEach(c => { const s = document.createElement('span'); s.className = 'company-chip'; s.textContent = c; chips.appendChild(s); });
      rows.push(['国内公司案例', chips]);
    }
    if (j.foreign && j.foreign.length) {
      const chips = document.createElement('div'); chips.className = 'chips';
      j.foreign.forEach(c => { const s = document.createElement('span'); s.className = 'company-chip'; s.textContent = c; chips.appendChild(s); });
      rows.push(['国外公司案例', chips]);
    }
    if (j.req && j.req.length) {
      const ul = document.createElement('ul'); ul.className = 'cc-job-req';
      j.req.forEach(r => { const li = document.createElement('li'); li.textContent = r; ul.appendChild(li); });
      rows.push(['要求（技能与知识）', ul]);
    }
    if (j.courses && j.courses.length) {
      const chips = document.createElement('div'); chips.className = 'chips';
      j.courses.forEach(code => chips.appendChild(courseChip(code, code)));
      rows.push(['推荐布里斯托课程', chips]);
    }
    if (j.note) rows.push(['简短说明', j.note]);

    rows.forEach(([label, val]) => {
      const row = document.createElement('div'); row.className = 'cc-info-row';
      const l = document.createElement('div'); l.className = 'cc-info-label'; l.textContent = label;
      const v = document.createElement('div'); v.className = 'cc-info-val';
      if (typeof val === 'string') v.textContent = val; else v.appendChild(val);
      row.append(l, v);
      info.appendChild(row);
    });
    wrap.appendChild(info);

    // 富文本备忘录：用户可以自由写额外的注意事项、面试题、链接等
    const memoCard = MindMap.createMemo(j, 'memo', Store.save, '岗位详情备忘录');
    wrap.appendChild(memoCard);

    main.appendChild(wrap);
  }

  // ---------- 添加/编辑方向表单 ----------
  function openAddDirForm() { openDirForm(null); }
  function openEditDirForm(dir) { openDirForm(dir); }
  function openDirForm(dir) {
    const overlay = document.createElement('div'); overlay.className = 'modal-overlay';
    const modal = document.createElement('div'); modal.className = 'modal career-modal';
    const h = document.createElement('div'); h.className = 'modal-title'; h.textContent = dir ? '编辑方向' : '添加方向';
    modal.appendChild(h);
    const nameI = UI.input(dir ? dir.name : '', '');
    const tagI  = UI.input(dir ? (dir.tagline || '') : '', '');
    modal.append(
      UI.field('1. 方向名称（英文专有词，如 Quantitative Finance）', nameI),
      UI.field('2. 一句话简介', tagI)
    );
    const footer = document.createElement('div'); footer.className = 'modal-footer';
    const cancel = btn('取消', () => overlay.remove()); cancel.classList.add('btn-ghost');
    const save = btn('保存', () => {
      const nm = nameI.value.trim(); if (!nm) { UI.toast('名称必填'); return; }
      const tg = tagI.value.trim();
      const data = careerData();
      if (dir) { dir.name = nm; dir.tagline = tg; }
      else { data.dirs.push({ id: careerUid(), name: nm, tagline: tg }); }
      Store.save();
      overlay.remove();
      viewCareer();
      UI.toast('已保存');
    }); save.classList.add('btn-primary');
    footer.append(cancel, save); modal.appendChild(footer);
    overlay.appendChild(modal);
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
    document.body.appendChild(overlay);
    nameI.focus();
  }
  function confirmDeleteDir(dir) {
    if (!confirm('删除方向"' + dir.name + '"？其下所有岗位也将一并删除。')) return;
    const data = careerData();
    data.dirs = data.dirs.filter(d => d.id !== dir.id);
    data.jobs = data.jobs.filter(j => j.dirId !== dir.id);
    Store.save();
    viewCareer();
    UI.toast('已删除');
  }

  // ---------- 添加/编辑岗位表单（带序号 + 标题；onClose 回调用于详情页内编辑后返回详情页） ----------
  function openAddJobForm(dir) { openJobForm(null, dir); }
  function openEditJobForm(j, dir, onClose) { openJobForm(j, dir, onClose); }
  function openJobForm(j, dir, onClose) {
    const overlay = document.createElement('div'); overlay.className = 'modal-overlay';
    const modal = document.createElement('div'); modal.className = 'modal career-modal career-modal-wide';
    const h = document.createElement('div'); h.className = 'modal-title'; h.textContent = (j ? '编辑岗位' : '添加岗位') + ' · ' + dir.name;
    modal.appendChild(h);

    const hint = document.createElement('div'); hint.className = 'cc-form-hint';
    hint.textContent = '从上往下依次填写。详情备忘录（更长的额外注意事项）请在保存后点该岗位的"详情 →"按钮里编辑。';
    modal.appendChild(hint);

    const typeI       = UI.input(j ? j.type : '', '');
    const salI        = UI.input(j ? (j.salary || '') : '', '');
    const salUnitI    = UI.input(j ? (j.salaryUnit || '') : '', '');
    const eduI        = UI.input(j ? (j.education || '') : '', '');
    const descI       = UI.input(j ? (j.description || '') : '', '');
    const domI        = UI.input(j ? (j.domestic || []).join(', ') : '', '');
    const forI        = UI.input(j ? (j.foreign || []).join(', ') : '', '');
    const reqI        = UI.input(j ? (j.req || []).join('; ') : '', '');
    const coursesI    = UI.input(j ? (j.courses || []).join(', ') : '', '');
    const noteI       = UI.input(j ? (j.note || '') : '', '');

    modal.append(
      UI.field('1. 岗位名称（英文，如 Machine Learning Engineer）', typeI),
      UI.field('2. 薪资区间（如 £55k–£105k，不确定写"不确定"）', salI),
      UI.field('3. 薪资单位（年薪 / 月薪 / 月薪+分红 / 不确定）', salUnitI),
      UI.field('4. 学历要求（如 硕士及以上，数学/统计/计算机）', eduI),
      UI.field('5. 岗位是干什么的（一句话描述工作内容）', descI),
      UI.field('6. 国内公司案例（用逗号分隔，如 蔚来,小鹏,华为车 BU）', domI),
      UI.field('7. 国外公司案例（用逗号分隔，如 Tesla,Waymo）', forI),
      UI.field('8. 要求（用分号分隔，如 概率与统计; Python; 线性代数）', reqI),
      UI.field('9. 推荐布里斯托课程代码（用逗号分隔，如 MATH20008, MATH20800）', coursesI),
      UI.field('10. 简短说明（卡片上显示）', noteI)
    );

    const footer = document.createElement('div'); footer.className = 'modal-footer';
    const cancel = btn('取消', () => overlay.remove()); cancel.classList.add('btn-ghost');
    const save = btn('保存', () => {
      const type = typeI.value.trim(); if (!type) { UI.toast('岗位名必填'); return; }
      const data = careerData();
      const payload = {
        type,
        salary: salI.value.trim(),
        salaryUnit: salUnitI.value.trim(),
        education: eduI.value.trim(),
        description: descI.value.trim(),
        domestic: domI.value.split(',').map(s => s.trim()).filter(Boolean),
        foreign: forI.value.split(',').map(s => s.trim()).filter(Boolean),
        req: reqI.value.split(';').map(s => s.trim()).filter(Boolean),
        courses: coursesI.value.split(',').map(s => s.trim().toUpperCase()).filter(Boolean),
        note: noteI.value.trim(),
      };
      if (j) {
        const oldMemo = j.memo || '';
        const oldPinned = j.pinned || false;
        Object.assign(j, payload);
        j.memo = oldMemo;
        j.pinned = oldPinned;
      } else {
        data.jobs.push(Object.assign({ id: careerJobUid(), dirId: dir.id, memo: '', pinned: false }, payload));
      }
      Store.save();
      overlay.remove();
      // 详情页内编辑：返回详情页；列表内编辑：返回方向列表
      if (typeof onClose === 'function') onClose();
      else renderCareerDir(dir.id);
      UI.toast('已保存');
    }); save.classList.add('btn-primary');
    footer.append(cancel, save); modal.appendChild(footer);
    overlay.appendChild(modal);
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
    document.body.appendChild(overlay);
    typeI.focus();
  }
  function confirmDeleteJob(j, dir) {
    if (!confirm('删除岗位"' + j.type + '"？')) return;
    const data = careerData();
    data.jobs = data.jobs.filter(x => x.id !== j.id);
    Store.save();
    renderCareerDir(dir.id);
    UI.toast('已删除');
  }
  // ---------- 选课视图 ----------
  /* ---------- 布里斯托单元数据（Programme 2MATH005U, 2026/27，官网 verbatim） ---------- */
  const COURSE_DATA = {
    y1: [
      { code: 'MATH10027', name: 'Introduction to Pure Mathematics', tb: 'TB1', mand: true, exam: 90, cw: [{ pct: 10, label: 'Coursework' }], prereq: [],
        aims: 'Introduce core ideas in Pure Mathematics: sets, functions, logic, numbers and groups. Emphasise the central importance of mathematical proof; introduce proof techniques via concrete examples. Equip students to present clear, accurate mathematical arguments.',
        desc: 'Sets, functions, logic, number systems (integers, rationals, reals), elementary number theory (Fundamental Theorem of Arithmetic, Euclid\'s algorithm, modular arithmetic), groups as sets with structure, isomorphism, Lagrange\'s theorem on subgroups, cardinality and infinite sets.',
        outcomes: 'Distinguish correct from sloppy reasoning; write clear proofs; use contradiction, contrapositive, induction; use quantifiers; establish injectivity/surjectivity; work with finite/countable/uncountable sets; use Euclid\'s algorithm and modular arithmetic; work with core group examples; explain and apply basic concepts.',
        teach: 'Plenary lectures; online materials (narrated presentations, worked examples); guided independent problem sheets; weekly group problem/example classes, workshops and tutorials; weekly group tutorials; weekly office hours.' },
      { code: 'MATH10015', name: 'Linear Algebra', tb: 'TB1', mand: true, exam: 90, cw: [{ pct: 10, label: 'Coursework' }], prereq: [],
        aims: 'Lay down foundational concepts for studying maths at undergraduate level; develop clear mathematical thinking. Linear Algebra is the bedrock of higher mathematics, indispensable across every mathematical discipline.',
        desc: 'Euclidean plane, complex numbers, n-dimensional Euclidean space, vectors and matrices, systems of linear equations, linear behaviour, abstract notion of a vector space (a basic structure of pure mathematics, fundamental for applied maths and statistics). Objects and ideas rigorously defined, properties demonstrated, practical computation tools.',
        outcomes: 'Perform calculations with vectors and matrices (products, inverses, determinants, eigenvalues/eigenvectors, diagonalisation); recognise examples/non-examples of vector spaces, subspaces, linear maps; define linear independence, span, bases, rank, nullity and apply them; solve linear equations using elementary operations.',
        teach: 'Plenary lectures; online materials; guided independent problem sheets; weekly group problem/example classes, workshops and tutorials; weekly office hours.' },
      { code: 'MATH10009', name: 'Mathematical Investigations', tb: 'TB1', mand: true, exam: 0, cw: [{ pct: 100, label: 'Continuous assessment: a mixture of online quizzes, written project report, and project presentation' }], prereq: [],
        aims: 'Help transition from school to university. Learn general mathematical skills needed for advanced maths: reading/understanding formal text, writing maths clearly, solving unseen problems beyond straightforward algorithms. Foster community via group work.',
        desc: 'Based on selected topics from A-Level Further Mathematics with historical background. Lectures plus workshops to put knowledge into practice while learning general mathematical skills. Tutorials working in groups on two mini-projects to foster independent study skills. Learn to give/receive feedback and reflect on learning.',
        outcomes: 'Apply selected concepts of A-Level Further Mathematics to problem solving; work effectively in groups and independently with guidance; present mathematical arguments and write short reports (in LaTeX); independently explore new topics in mathematics.',
        teach: 'Plenary lectures; weekly workshops; weekly group meetings with supervisor; guided independent study.' },
      { code: 'MATH10011', name: 'Analysis', tb: 'TB2', mand: true, exam: 100, cw: [], prereq: ['MATH10027 Introduction to Pure Mathematics'],
        aims: 'Introduce basic tools and concepts of university-level mathematics. Emphasise thinking clearly and distinguishing a mathematically correct argument from a merely heuristic one. Rigorous treatment of calculus fundamentals (limits, continuity, differentiation, integration).',
        desc: 'Logically precise formulations and reasoning of university-level maths. Rigorous study of elementary calculus: real numbers, sequences and series, real-valued functions and limit points, continuous functions, rigorous differentiation and integration, real power series, formal definitions of exp, log, sin, cos.',
        outcomes: 'Distinguish correct from sloppy reasoning; construct formal delta-epsilon proofs; explain/apply formal limit concept for sequences, series, functions; explain/apply basic properties of continuous functions and series; explain/apply rigorous definitions of differentiation and integration; explain/apply proofs of important results.',
        teach: 'Plenary lectures; online materials; guided independent problem sheets; weekly group problem/example classes, workshops and tutorials; weekly group tutorials; weekly office hours.' },
      { code: 'MATH10012', name: 'ODEs, Curves and Dynamics', tb: 'TB2', mand: true, exam: 90, cw: [{ pct: 10, label: 'Coursework' }], prereq: [],
        aims: 'Provide essential tools, concepts and skills for Applied Mathematics at undergraduate level. Model what we observe as the world changes with time, using differential equations and integrals in more than one dimension.',
        desc: 'First part: basic theory of ordinary differential equations. Second half: gradients, mathematical description of curves, double and triple integrals. Examples and motivation from elementary Newtonian mechanics (taught from a mathematical perspective).',
        outcomes: 'Solve simple first and second order ODEs; calculate partial derivatives and the gradient vector; parametrise curves, express in different coordinate systems, evaluate line integrals; evaluate integrals in two and three dimensions; solve mechanical problems using Newtonian mechanics and ODE theory.',
        teach: 'Plenary lectures; online materials; guided independent problem sheets; weekly problem/example classes, workshops and tutorials; weekly smaller group tutorials; weekly office hours.' },
      { code: 'MATH10013', name: 'Probability and Statistics', tb: 'TB2', mand: true, exam: 100, cw: [], prereq: [],
        aims: 'Foundation for all probability and statistics units in later years. Quantify how probable events are in random experiments; build parametric statistical models; infer parameters from data.',
        desc: 'Probability spaces, random variables, discrete and continuous random variables, expected values, variances, covariances, generating functions, conditional expectations. Parametric statistical models, method of moments, maximum likelihood, sampling distributions, confidence intervals, hypothesis tests, linear regression.',
        outcomes: 'Calculate probabilities, expectations, variances (incl. via moment generating functions and conditioning); construct a formal probability model from an informal description; estimate parameters of tractable parametric models; construct confidence intervals and calibrate hypothesis tests.',
        teach: 'Plenary lectures; online materials; guided independent problem sheets; weekly problem classes and tutorials; weekly office hours.' },
    ],
    y2: [
      { code: 'MATH20014', name: 'Mathematical Programming', tb: 'TB1', mand: true, exam: 0, cw: [{ pct: 100, label: 'Coursework: weekly individual programming assignments submitted and assessed online and a group project component later in the term' }], prereq: ['A in A Level Mathematics or equivalent'],
        aims: 'Introduce foundational concepts of programming and some of the many computational tools in common use by mathematicians.',
        desc: 'Foundational programming concepts and computational tools. Toward end of term: small-group work applying knowledge to solve one of several computational problems (similar to Mathematical Investigations).',
        outcomes: 'Write, debug and run programs in Python; demonstrate familiarity with basic concepts of programming and algorithms; apply and use various computational methods and tools; work in teams.',
        teach: 'Online materials; independent activities (problem sheets and other exercises); tutorials; office hours.' },
      { code: 'MATH20800', name: 'Statistics 2', tb: 'TB1', mand: true, exam: 80, cw: [{ pct: 20, label: 'Coursework' }], prereq: ['MATH10013 Probability and Statistics'],
        aims: 'Develop the theory and practice of basic statistical inference, and statistical calculation.',
        desc: 'Inference under uncertainty. Estimating parameters of statistical models, making predictions, testing hypotheses. Identifying optimal/good decisions. Crucial for careers in finance, industry, science and policy (climate, hazards, health). Develops Level 4 Probability and Statistics; prerequisite for Bayesian Modelling, Linear and Generalised Linear Models, Theory of Inference.',
        outcomes: 'Design powerful tests for statistical hypotheses and understand their power/limitations; derive ML estimators and assess properties/uncertainty; apply Bayesian approach (conjugate analysis); use asymptotic arguments for ML/Bayesian convergence; choose and validate statistical models; use R for routine statistical calculations and plotting.',
        teach: 'Lectures; online materials; independent activities (problem sheets); tutorials; computer labs; office hours.' },
      { code: 'MATH20008', name: 'Probability 2', tb: 'TB2', mand: true, exam: 100, cw: [], prereq: ['MATH10015 Linear Algebra', 'MATH10011 Analysis', 'MATH10013 Probability and Statistics'],
        aims: 'Survey basic models of applied probability and standard methods of analysis of such models.',
        desc: 'A wide range of phenomena (physics, economics, biology) described by simple probabilistic models with shared mathematical structure. Develops tools useful for modelling applications. Builds on first-year probability and basic analysis; deepens understanding of probability theory.',
        outcomes: 'Deeper, more sophisticated understanding of probability theory than first year; standard tools for analysing properties of a range of model structures within applied probability.',
        teach: 'Lectures; online materials; independent activities (problem sheets); tutorials; office hours.' },
      { code: 'MATH20018', name: 'Perspectives in Data Science', tb: 'TB2', mand: true, exam: 0, cw: [
        { pct: 15, label: "Code-based data analysis report" },
        { pct: 5, label: "Peer review of other students' draft reports" },
        { pct: 20, label: "Individual oral presentation to a small group communicating content from a piece of reading" },
        { pct: 25, label: "Group business plan including an individual contribution mark" },
        { pct: 15, label: "Group video pitch/Q&A on your business plan, including an individual contribution mark" },
        { pct: 10, label: "An overall reflection on your learning throughout the unit" },
      ], prereq: [],
        aims: 'Preparation for future career in big industry, startups, academia or education. Use data science background to develop written/oral communication; understand how technologies such as AI are changing communication and work. Experience group work and constructive peer feedback. Options to learn about developing data science business ideas.',
        desc: 'Individual and group activities to become a rounded data scientist. Four themes: (1) Data Science Workflow (data curation, analysis, communication); (2) Ethics of Data Science; (3) Data Science in Enterprise; (4) Reflective Practice. Soft skills: communication (incl. AI tools), effective group working, business/enterprise development.',
        outcomes: 'Perform a full data science workflow (curation, analysis with AI, reporting); constructively critique others\' contributions; independently explore data ethics topics; work effectively in a group for Enterprise collaboration; reflect on own learning; communicate to a general audience.',
        teach: 'Interactive presentations from experts delivering skills training; small-group discussions; peer review and peer assessment; reading and analysing literature; self-reflection; office hours and drop-in sessions.' },
      { code: 'MATH20015', name: 'Multivariable Calculus and Complex Functions', tb: 'TB1', mand: false, group: 'Choose 1 of 2', exam: 90, cw: [{ pct: 10, label: 'Coursework' }], prereq: ['MATH10011 Analysis or MATH10023 Applied Analysis A', 'MATH10012 ODEs, Curves and Dynamics or MATH10024 Applied Analysis B', 'MATH10015 Linear Algebra or MATH10016 Matrix Algebra and Linear Models'],
        aims: 'Basic ideas and methods of multivariable calculus and functions of a complex variable; theorems stated, emphasis on methods rather than proofs.',
        desc: 'First half: multivariable calculus incl. major theorems of vector calculus; differential vector calculus, coordinate systems, integral theorems for functions of several variables (fundamental to physical applied maths). Second half: functions of a complex variable, holomorphic functions, differentiation/integration, main integration theorems leading to Cauchy\'s Residue theorem, using theorems of complex functions to solve real-valued integrals.',
        outcomes: 'Understand central terms (derivative for multivariable functions, main integral theorems of vector calculus); use vector identities and differential operators in curvilinear coordinates; evaluate line, surface, volume integrals; use elementary properties of holomorphic functions; find power series expansions; integrate holomorphic functions with/without singularities; master residue calculus; apply to real-valued integrals.',
        teach: 'Lectures; online materials; independent activities (problem sheets); group tutorials; office hours.' },
      { code: 'MATH20006', name: 'Metric Spaces', tb: 'TB1', mand: false, group: 'Choose 1 of 2', exam: 100, cw: [], prereq: ['MATH10011 Analysis', 'MATH10027 Introduction to Pure Mathematics'],
        aims: 'Introduce metric spaces; extend concepts from Analysis (convergence, continuity) from the reals to the more general setting of metric spaces.',
        desc: 'A fundamental area of pure maths and entry gate to pointset topology. A metric space = set + notion of distance, generalising the reals/plane. Definition and examples, properties, convergence of sequences, continuity of maps, open/closed sets, complete/compact/connected sets, contraction mapping theorem and applications. Brief (non-examinable) introduction to topological spaces.',
        outcomes: 'Know and understand the basic definitions and theorems (and proofs); solve routine problems similar to assigned exercises; apply ideas to unseen situations.',
        teach: 'Lectures; online materials; independent activities (problem sheets); tutorials; office hours.' },
      { code: 'MATH21800', name: 'Algebra 2', tb: 'TB2', mand: false, group: 'Choose 1 of 6', exam: 100, cw: [], prereq: ['MATH10015 Linear Algebra', 'MATH10027 Introduction to Pure Mathematics'],
        aims: 'Develop the theory of rings and fields; confidently apply the theory to understand properties of examples arising in algebra and number theory: factorisations of polynomials, construction of finite fields, applications to ruler-compass geometry problems.',
        desc: 'Commutative rings (sets with two commutative operations, addition and multiplication, with additive identity and inverses). Examples: Z, Q, Z modulo n, Q[X]. Homomorphisms (maps preserving addition/multiplication). Generalised modular arithmetic to determine nice properties (e.g. multiplicative inverses). Beautiful, clean theory; new proof techniques.',
        outcomes: 'State basic definitions and results; utilise fundamental proof techniques; solve problems similar to lectures and homework.',
        teach: 'Lectures; online materials; independent activities (problem sheets); tutorials; office hours.' },
      { code: 'MATH20402', name: 'Applied Partial Differential Equations 2', tb: 'TB2', mand: false, group: 'Choose 1 of 6', exam: 100, cw: [], prereq: ['MATH20015 Multivariable Calculus and Complex Functions'],
        aims: 'Provide mathematical tools to model physical problems: waves on strings, signal propagation, heat diffusion in solids/chemicals, traffic flow, vibrations of membranes and surfaces.',
        desc: 'PDEs (partial differential equations involving partial derivatives of functions of several variables) essential for understanding physical processes. Simple PDEs and how they arise; techniques for solving them and understanding solution behaviour. Fourier series, Fourier integral, delta function, method of characteristics, eigenvalues in applied maths. Emphasises techniques and broad understanding over proofs.',
        outcomes: 'Understand physical models and derive PDEs for diffusion and wave propagation; identify appropriate boundary conditions; solve linear 2D PDEs on bounded domains by separation of variables and Fourier series; calculate/manipulate Fourier transforms and solve PDEs on unbounded domains; use method of characteristics for first-order PDEs; describe differences between linear and nonlinear PDEs; solve multi-dimensional linear PDEs in various coordinate systems.',
        teach: 'Lectures; online materials; independent activities (problem sheets); group tutorials; office hours.' },
      { code: 'MATH20004', name: 'Introduction to Geometry', tb: 'TB2', mand: false, group: 'Choose 1 of 6', exam: 100, cw: [], prereq: ['MATH10015 Linear Algebra', 'MATH10012 ODEs, Curves and Dynamics', 'MATH10011 Analysis'],
        aims: 'Introduce fundamental concepts in geometry in a hands-on, rigorous way, focused on curves and surfaces; lay foundations for more advanced courses.',
        desc: 'Geometry central to maths (subject in its own right + essential viewpoint on nearly every area of pure/applied maths). Focus on geometry of curves and surfaces in R2 and R3, continuing from calculus. Key concept: curvature of a surface (locally how it bends: flat like Euclidean space, positive like a sphere, negative like a saddle). Major goal: prove the Gauss-Bonnet theorem linking curvature to overall shape.',
        outcomes: 'Understand basic notions/results in differential geometry (tangents, normals, curvature, Gauss-Bonnet); know and use basic properties of Euclidean, spherical and hyperbolic geometries; understand, prove and apply methods to problems from pure and applied maths.',
        teach: 'Lectures and flipped-classroom; online materials; independent activities (problem sheets); problem classes; tutorials; office hours.' },
      { code: 'MATH20101', name: 'Ordinary Differential Equations 2', tb: 'TB2', mand: false, group: 'Choose 1 of 6', exam: 100, cw: [], prereq: ['MATH10012 ODEs, Curves and Dynamics or MATH10024 Applied Analysis B'],
        aims: 'Introduce the basic theory of ordinary differential equations (ODEs).',
        desc: 'ODEs are very important in applied mathematics; many phenomena in physics, biology and engineering are described by ODEs. To understand underlying processes we interpret solutions; this unit is an introduction to that endeavour. Multivariable Calculus is recommended but not required as a co-requisite.',
        outcomes: 'Recognise basic types of ODEs and understand features of linear equations in particular; use phase plane analysis to investigate equations not easily solvable; apply notions of equilibrium, linearization, stability and bifurcation to problems in physics, biology and engineering.',
        teach: 'Lectures; online materials; independent activities (problem sheets); tutorials; office hours.' },
      { code: 'MATH21900', name: 'Mechanics 2', tb: 'TB2', mand: false, group: 'Choose 1 of 6', exam: 100, cw: [], prereq: ['MATH10012 ODEs, Curves and Dynamics', 'MATH20015 Multivariable Calculus and Complex Functions (or equivalent Physics units)'],
        aims: 'Introduce variational principles in mechanics; introduce Lagrangian and Hamiltonian mechanics and their applications; provide a foundation for further study in mathematical physics.',
        desc: 'Newtonian F=ma vs Maupertuis/Euler/Lagrange: trajectory minimises (renders stationary) the action. Calculus of variations links the two. Fundamental laws of physics (Maxwell, relativity, quantum mechanics) expressible via variational principles. Covers least action, calculus of variations, Lagrangian mechanics, symmetry and conservation laws (Noether), small oscillations, Hamiltonian mechanics (Poisson brackets, canonical transformations), intro to special relativity and relativistic particle mechanics.',
        outcomes: 'Understand configuration space, generalised coordinates, phase space; obtain Euler-Lagrange equations from a variational principle; understand relation between Lagrange\'s equations and Newton\'s laws; use Lagrange\'s equations to solve complex dynamical problems; calculate normal modes and characteristic frequencies; obtain Hamiltonian formulation; understand Poisson brackets and canonical transformations.',
        teach: 'Lectures; online materials; independent activities (problem sheets); tutorials; office hours.' },
      { code: 'MATH21100', name: 'Linear Algebra 2', tb: 'TB2', mand: false, group: 'Choose 1 of 6', exam: 100, cw: [], prereq: ['MATH10015 Linear Algebra', 'MATH10027 Introduction to Pure Mathematics (helpful but not required)'],
        aims: 'Focus on Linear Algebra: vector spaces and the (linear) maps between them.',
        desc: 'Recap key notions from Linear Algebra 1 via the vector space of real polynomial functions (used throughout). Introduce dual of a vector space, quotient space, infinite-dimensional spaces. Complete diagonalisation theory: linear maps not diagonalisable still fit Jordan normal form (always computable, with shortcuts). Smith normal form of an integer matrix; classification of finitely-generated abelian groups.',
        outcomes: 'Deepen understanding of vector spaces and natural maps between them; state, use and prove fundamental results in linear algebra.',
        teach: 'Lectures; online materials; independent activities (problem sheets); tutorials; office hours.' },
    ],
    y3: [
      { code: 'MATH35600', name: 'Theory of Inference', tb: 'TB2', mand: true, exam: 80, cw: [{ pct: 20, label: 'Coursework (some examples and homeworks use R)' }], prereq: ['MATH10013 Probability and Statistics'],
        aims: 'Statistical inference: drawing quantitative conclusions about things of interest from data we can collect. Overview of theory and methods, comparing Bayesian and frequentist approaches, with practical focus on using the theory in practice.',
        desc: 'Statistical model, methods of uncertainty quantification, statistical model comparison, model checking, difference between inference about causality and association, practical implementation of Bayesian and maximum likelihood approaches. Builds on Statistics 1; complements Generalized linear modelling, Bayesian statistics, Statistics 2 (none required as prerequisites).',
        outcomes: 'Understand key principles of statistical inference and how they impact current practice across a range of fields. Transferable skills: logical thinking, proof, problem solving, abstraction, notation, self-study and self-appraisal. Some examples/homeworks use R.',
        teach: 'Lectures; online materials; independent activities (problem sheets); problem classes; support sessions; office hours.' },
      { code: 'MATH30009', name: 'Group Project Unit', tb: 'TB4', mand: true, exam: 0, cw: [
        { pct: 60, label: "Group written report (learning outcomes 1-3)" },
        { pct: 10, label: "Group oral presentation (learning outcomes 1, 4)" },
        { pct: 30, label: "Individual oral exam (learning outcomes 2, 3)" },
      ], prereq: ['Various, depending on the project selected'],
        aims: 'Develop independent study skills via first-hand experience in the conduct of mathematical research in a group setting, based on a topic of choice. Present findings as a report, an oral presentation and an oral exam. Give insight into group dynamics, develop interpersonal skills, allow tackling more comprehensive assignments.',
        desc: 'Small groups of students working independently on projects proposed and supervised by individual academic members of staff. Manage self-directed study as part of a team: research the topic, write a joint report, give a group oral presentation, undertake an individual oral exam.',
        outcomes: 'Work within a peer group to produce a report and presentation against a deadline; analyse existing approaches to a problem from the literature and contextualise them; synthesize and communicate complex ideas in written and oral formats; prepare and deliver a formal mathematical presentation.',
        teach: 'Research conducted mostly independently as a group, with guidance from supervisor as needed. Necessary skills training provided early in Teaching Block 1.' },
      { code: 'MATH30014', name: 'Financial Risk Management', tb: 'TB1', mand: false, exam: 100, cw: [], prereq: ['MATH10015 Linear Algebra or MATH10016 Matrix Algebra and Linear Models', 'MATH10011 Analysis or MATH10023 Applied Analysis A', 'MATH10013 Probability and Statistics'],
        aims: 'Explore the theory and practice of financial risk management in a variety of common settings: the casino, sports betting, business, and financial markets.',
        desc: 'Theory of uncertainty assessment, choice under uncertainty, and risk management, illustrated with many practical examples (often involving computing in R). Familiarity with R is not required, but those thinking about a job in finance/data science should aim to be proficient in R or Python by graduation. Clarity and effective communication crucial; must be comfortable writing descriptive text in well-structured sentences.',
        outcomes: 'Use probability theory to structure/quantify uncertainty; justify expected gain for choosing among small gambles; evaluate simple gambles (casinos); explain role of statistical models with examples; state, prove, explain Von Neumann-Morgenstern theorem for expected utility; provide guidelines for assessing utility functions; use decision trees to evaluate linked decisions and value information; state and critique mean-variance portfolio theory.',
        teach: 'Lectures; online materials; independent activities (problem sheets); problem classes; support sessions; office hours.' },
      { code: 'MATH33800', name: 'Time Series Analysis', tb: 'TB1', mand: false, exam: 100, cw: [], prereq: ['MATH20800 Statistics 2'],
        aims: 'Understanding, modelling and forecasting of time series data in both time and frequency domains.',
        desc: 'Time series = observations on variables collected through time (daily temperature, hourly stock prices). Widely collected in pure sciences, medicine, marketing, economics, finance. Observations ordered in time and often dependent; interest lies in modelling serial dependence, identifying suitable models and predicting the future. Builds on estimation/inferential tools for independent data.',
        outcomes: 'Identify and remove simple trend and seasonalities; describe properties of stationary time series and autocorrelations; define ARMA, ARIMA, GARCH models; construct time series models from data and verify fits; define spectral density and understand it as energy distribution in frequency domain; compute periodogram and smoothed versions; analyse multivariate time series. Use R for advanced statistical time series analyses.',
        teach: 'Lectures; online materials; independent activities (problem sheets); problem classes; support sessions; office hours.' },
      { code: 'MATH30015', name: 'Bayesian Modelling', tb: 'TB2', mand: false, exam: 100, cw: [], prereq: ['MATH20008 Probability 2'],
        aims: 'Thorough introduction to the Bayesian approach to statistical analysis and modelling; introduction to computational tools that make Bayesian methods possible in practice.',
        desc: 'Bayesian approach: probabilities express uncertainty about quantities of interest; prior knowledge updated via conditional probabilities as observations arrive. Construction of prior/posterior distributions, Bayesian decision theory, Bayesian asymptotics, model choice. Brief introduction to Markov chain Monte Carlo. Bayesian statistical modelling with emphasis on hierarchical models.',
        outcomes: 'Understand principles and theory underlying Bayesian statistics; understand and use Markov chain Monte Carlo methods to apply Bayesian methods in practice; build and represent complex models using Bayesian networks.',
        teach: 'Lectures; online materials; independent activities (problem sheets); problem classes; support sessions; computer labs; office hours.' },
      { code: 'MATH30028', name: 'Statistical Machine Learning', tb: 'TB2', mand: false, exam: 0, cw: [
        { pct: 25, label: "Assignment 1: regression (Learning Outcome 1)" },
        { pct: 25, label: "Assignment 2: classification (Learning Outcome 2)" },
        { pct: 25, label: "Assignment 3: clustering (Learning Outcome 3)" },
        { pct: 25, label: "Assignment 4: dimension reduction (Learning Outcome 4)" },
      ], prereq: ['Statistics 2 or Econometrics 1', 'Students expected to be familiar with programming; assessed coursework involves substantial amounts of programming in a high-level language such as R'],
        aims: 'Develop theoretically and practically a selection of fundamental machine learning problems and commonly used solutions. Stronger emphasis on algorithms than other statistical units.',
        desc: 'Machine learning: algorithms that process relevant data and perform some task, performance measured statistically, algorithms heavily influenced by statistical ideas. Sufficiently rich class of statistical models must be used effectively; irrelevant data identified and discarded.',
        outcomes: 'Perform linear and non-linear regression and classification in certain settings; implement and understand standard clustering algorithms for unsupervised data; perform appropriate dimension reduction techniques; understand statistical issues in model selection and implement powerful general methods; understand why artificial neural networks can be useful.',
        teach: 'Lectures introducing concepts and algorithms; problem-based learning via assessed coursework implementing algorithms; inquiry-based thinking about applying algorithms to new problems; interactive (optional pair work on assessed coursework). Labs for working on assessed work.' },
      { code: 'MATH30017', name: 'Optimisation', tb: 'TB2', mand: false, exam: 90, cw: [{ pct: 10, label: 'Coursework: computing assignments' }], prereq: ['MATH10011 Analysis or MATH10023 Applied Analysis A', 'MATH10015 Linear Algebra or MATH10016 Matrix Algebra and Linear Models', 'MATH10012 ODEs, Curves and Dynamics or MATH10024 Applied Analysis B', 'MATH20015 Multivariable Calculus and Complex Functions (desirable but not essential)'],
        aims: 'Make students acquainted with the main concepts, ideas, methods, tools and techniques of mathematical optimisation.',
        desc: 'Optimisation = selecting a best solution/decision out of available alternatives. Involved in many human activities and almost all branches of natural sciences (investor portfolios, manufacturing efficiency, engineering design, minimum-energy physical systems, light following minimum-time paths). Mathematically: minimising/maximising a multivariable function subject to constraints.',
        outcomes: 'Understand basic theoretical aspects of optimisation problems; understand numerical methods for optimisation problems and their properties; solve simple optimisation problems by hand; solve (relatively) simple optimisation problems numerically.',
        teach: 'Lectures; online materials; independent activities (problem sheets); problem classes; computer practicals; tutorials; office hours.' },
      { code: 'MATH30029', name: 'Numerical Analysis', tb: 'TB1', mand: false, exam: 100, cw: [], prereq: ['MATH10012 ODEs, Curves and Dynamics or MATH10024 Applied Analysis B'],
        aims: 'Introduce students to the basics of numerical analysis (broadly the study of numerical methods for solving mathematical problems).',
        desc: 'First course in numerical analysis. Fundamental areas: numerical linear algebra, curve fitting, root finding, numerical differentiation, numerical integration, solving ordinary differential equations. Emphasis on exploring the theoretical basis for numerical methods. Computer programming not required; skills from Analysis and Linear Algebra required.',
        outcomes: 'Apply numerical methods for matrix problems; use polynomial interpolation for curve fitting schemes; solve nonlinear equations; numerically differentiate; evaluate complicated integrals; estimate solutions to ODEs to any required accuracy.',
        teach: 'Lectures; online materials; independent activities (problem sheets); problem classes; support sessions; office hours.' },
      { code: 'MATH35400', name: 'Financial Mathematics', tb: 'TB2', mand: false, exam: 80, cw: [{ pct: 20, label: 'Coursework' }], prereq: ['MATH20008 Probability 2'],
        aims: 'Introduction to mathematical ideas underlying modern financial mathematics. Understand pricing of financial derivatives and apply to a variety of option contracts. Derivation of the Black-Scholes option pricing formula.',
        desc: '1973: Black and Scholes solved pricing of a basic financial derivative (European call option) under no-arbitrage, determining a unique fair price. Develops sophisticated maths for subsequent explosion of trade in complex derivatives. Simple two-time-point model (risk-neutral probability measure); general discrete models via martingales; continuous time via exponential Brownian motion, informal stochastic calculus; pricing of derivatives and Black-Scholes formula.',
        outcomes: 'Describe difference between common financial instruments; express financial problems in a mathematical framework; calculate prices of simple financial instruments; do calculations with martingales and Brownian motion.',
        teach: 'Lectures; online materials; independent activities (problem sheets); problem classes; support sessions; office hours.' },
    ],
  };

  function viewCourses() {
    main.innerHTML = '';
    const wrap = UI_card('Undergraduate Units · Assessment (Bristol 2MATH005U, 2026/27)');
    const hint = document.createElement('p'); hint.className = 'cc-hint';
    hint.textContent = 'Source: University of Bristol Unit and Programme Catalogue (Programme 2MATH005U, 2026/27). Year 2 lists Mathematics units only. Click a year header to collapse / expand; click a unit for full details.';
    wrap.appendChild(hint);
    const yrs = [['y1', 'Year 1 · all mandatory'], ['y2', 'Year 2 · Mathematics units'], ['y3', 'Year 3 · core + options']];
    yrs.forEach(([key, title]) => {
      const units = COURSE_DATA[key] || [];
      const sec = document.createElement('div'); sec.className = 'yr-section';
      const head = document.createElement('button'); head.type = 'button'; head.className = 'yr-head';
      head.innerHTML = '<span class="yr-caret">&#9662;</span><span class="yr-title">' + title + '</span><span class="yr-count">' + units.length + ' units</span>';
      const body = document.createElement('div'); body.className = 'yr-body';
      // 必修在前；选修按「Choose 1 of N」分组
      units.filter(u => u.mand).forEach(u => body.appendChild(renderUnit(u)));
      const groups = [];
      units.filter(u => !u.mand).forEach(u => {
        const gname = u.group || 'Optional units';
        let g = groups.find(x => x.name === gname);
        if (!g) { g = { name: gname, items: [] }; groups.push(g); }
        g.items.push(u);
      });
      groups.forEach(g => {
        const t = document.createElement('div'); t.className = 'group-title'; t.textContent = g.name;
        const list = document.createElement('div'); list.className = 'unit-list';
        g.items.forEach(u => list.appendChild(renderUnit(u)));
        body.append(t, list);
      });
      head.onclick = () => { sec.classList.toggle('collapsed'); };
      sec.append(head, body);
      wrap.appendChild(sec);
    });
    main.appendChild(wrap);
  }

  /* 单门课卡片：考核构成用文字详列（不用进度条）；点开进入详情界面 */
  function renderUnit(u) {
    u.cw = u.cw || []; u.prereq = u.prereq || [];
    const el = document.createElement('div'); el.className = 'unit-item';
    el.style.cursor = 'pointer';

    const top = document.createElement('div'); top.className = 'unit-top';
    const left = document.createElement('div');
    left.innerHTML = '<div class="unit-name">' + esc(u.name) + '</div><div class="unit-code">' + esc(u.code) + '</div>';
    top.appendChild(left);

    const tags = document.createElement('div'); tags.className = 'unit-tags';
    const tMand = document.createElement('span'); tMand.className = 'tag ' + (u.mand ? 'mand' : 'opt');
    tMand.textContent = u.mand ? 'Core' : 'Optional';
    const tTb = document.createElement('span'); tTb.className = 'tag tb'; tTb.textContent = u.tb || '';
    const tMore = document.createElement('span'); tMore.className = 'tag detail-tag'; tMore.textContent = '详情 →';
    tags.append(tMand, tTb, tMore);
    el.append(top, tags);

    const cwSum = u.cw.reduce((s, c) => s + (c.pct || 0), 0);
    const parts = [];
    if (u.exam > 0) parts.push(u.exam + '% Examination');
    if (cwSum > 0) parts.push(cwSum + '% Coursework');
    const assess = document.createElement('div'); assess.className = 'unit-assess';
    const line = document.createElement('div'); line.className = 'assess-line';
    line.textContent = 'Assessment: ' + (parts.length ? parts.join(' + ') : '100% Coursework');
    const ul = document.createElement('ul'); ul.className = 'assess-detail';
    if (u.exam > 0) ul.innerHTML += '<li><b>' + u.exam + '%</b> Examination</li>';
    u.cw.forEach(c => { ul.innerHTML += '<li><b>' + c.pct + '%</b> ' + esc(c.label) + '</li>'; });
    assess.append(line, ul);
    el.appendChild(assess);

    if (u.prereq.length) {
      const p = document.createElement('div'); p.className = 'unit-prereq';
      const ph = document.createElement('div'); ph.className = 'prereq-head'; ph.textContent = 'Pre-requisites';
      const pl = document.createElement('ul'); pl.className = 'prereq-list';
      u.prereq.forEach(x => { pl.innerHTML += '<li>' + esc(x) + '</li>'; });
      p.append(ph, pl); el.appendChild(p);
    }
    if (u.note) {
      const n = document.createElement('div'); n.className = 'unit-note'; n.textContent = u.note;
      el.appendChild(n);
    }
    el.onclick = () => viewUnitDetail(u);
    return el;
  }

  /* 单门课详情界面 */
  function viewUnitDetail(u) {
    main.innerHTML = '';
    const back = document.createElement('button'); back.className = 'back-btn'; back.textContent = '← 返回选课';
    back.onclick = () => viewCourses();
    main.appendChild(back);

    const card = UI_card('');
    const h = document.createElement('div'); h.className = 'unit-top';
    h.innerHTML = '<div><div class="unit-name">' + esc(u.name) + '</div><div class="unit-code">' + esc(u.code) + '</div></div>';
    const tags = document.createElement('div'); tags.className = 'unit-tags';
    const tMand = document.createElement('span'); tMand.className = 'tag ' + (u.mand ? 'mand' : 'opt');
    tMand.textContent = u.mand ? 'Core' : 'Optional';
    const tTb = document.createElement('span'); tTb.className = 'tag tb'; tTb.textContent = u.tb || '';
    tags.append(tMand, tTb);
    const sec2 = document.createElement('div'); sec2.style.marginTop = '10px'; sec2.append(tags);
    card.append(h, sec2);

    const cwSum = (u.cw || []).reduce((s, c) => s + (c.pct || 0), 0);
    const parts = [];
    if (u.exam > 0) parts.push(u.exam + '% Examination');
    if (cwSum > 0) parts.push(cwSum + '% Coursework');

    const block = (title, text) => {
      if (!text) return;
      const s = document.createElement('div'); s.className = 'detail-section';
      const hh = document.createElement('div'); hh.className = 'detail-h'; hh.textContent = title;
      const p = document.createElement('div'); p.className = 'detail-text'; p.textContent = text;
      s.append(hh, p); card.appendChild(s);
    };
    block('Unit Aims', u.aims);
    block('Description', u.desc);
    block('Learning Outcomes', u.outcomes);
    block('How you will learn', u.teach);

    const as = document.createElement('div'); as.className = 'detail-section';
    const ah = document.createElement('div'); ah.className = 'detail-h'; ah.textContent = 'How you will be assessed';
    const al = document.createElement('div'); al.className = 'detail-text';
    al.innerHTML = (parts.length ? parts.join(' + ') : '100% Coursework')
      + (u.cw && u.cw.length ? '<br>' + u.cw.map(c => '· <b>' + c.pct + '%</b> ' + esc(c.label)).join('<br>') : '');
    as.append(ah, al); card.appendChild(as);

    if ((u.prereq || []).length) {
      const p = document.createElement('div'); p.className = 'unit-prereq';
      const ph = document.createElement('div'); ph.className = 'prereq-head'; ph.textContent = 'Pre-requisites';
      const pl = document.createElement('ul'); pl.className = 'prereq-list';
      u.prereq.forEach(x => { pl.innerHTML += '<li>' + esc(x) + '</li>'; });
      p.append(ph, pl); card.appendChild(p);
    }

    const src = document.createElement('div'); src.className = 'detail-source';
    src.textContent = 'Source: University of Bristol Unit and Programme Catalogue 2026/27 — UnitDetails?ayrCode=26/27&unitCode=' + u.code;
    card.appendChild(src);
    main.appendChild(card);
    main.scrollTop = 0;
  }

  function UI_card(title) { const c = document.createElement('div'); c.className = 'card'; if (title) { const h = document.createElement('div'); h.className = 'card-title'; h.textContent = title; c.appendChild(h); } return c; }
  function btn(text, onclick) { const b = document.createElement('button'); b.className = 'btn'; b.textContent = text; if (onclick) b.onclick = onclick; return b; }
  /* 详情 / 卡片头部统一的「打卡」图标按钮（✓ + 文字） */
  function checkinIconBtn(onClick, small) {
    const b = document.createElement('button');
    b.className = 'checkin-btn' + (small ? ' sm' : '');
    b.title = '打卡';
    b.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">' +
      '<path d="M20.3 5.7 9 17 3.7 11.7" fill="none" stroke="currentColor" stroke-width="2.6" ' +
      'stroke-linecap="round" stroke-linejoin="round"/></svg><span>打卡</span>';
    b.onclick = onClick;
    b.style.marginRight = '8px';
    return b;
  }

  /* ============================================================
     详情页之间的转场（不经过列表层）
     做法：新页先 append 盖在上面 → 横向推进 → 动画结束才移除旧页；
     整个过程列表从不重绘，所以中间不会闪出列表。
     ============================================================ */
  const DETAIL_DUR = 320;
  const DETAIL_EASE = 'cubic-bezier(.32,.72,0,1)';
  function detailReducedMotion() {
    try { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { return false; }
  }
  function px2pct(px) { const w = (window.innerWidth || document.documentElement.clientWidth || 1); return px / w * 100; }
  function dAnim(el, ms) { if (el) el.style.transition = ms ? `transform ${ms}ms ${DETAIL_EASE}, opacity ${ms}ms linear` : 'none'; }
  function dPlace(el, x, scale, op) {
    if (!el) return;
    el.style.transform = `translate3d(${x}%,0,0) scale(${scale == null ? 1 : scale})`;
    if (op != null) el.style.opacity = String(op);
  }
  function dReset(el) { if (!el) return; el.style.transition = ''; el.style.transform = ''; el.style.opacity = ''; el.style.boxShadow = ''; el.style.zIndex = ''; el.classList.remove('detail-sliding'); }
  /** 解绑某个 overlay 的键盘监听（叠了两层时不能让下层继续响应） */
  function cleanupDetail(el) {
    if (!el) return;
    if (typeof el.__navCleanup === 'function') { try { el.__navCleanup(); } catch (e) {} el.__navCleanup = null; }
  }
  function dShadow(dir) { return dir > 0 ? '-24px 0 60px rgba(15,23,42,.22)' : '24px 0 60px rgba(15,23,42,.22)'; }
  function dDrop(el) { cleanupDetail(el); if (el && el.parentNode) el.remove(); }

  /**
   * 提交一次翻页：新页从 dir 方向推进来（dir=1 从右，-1 从左），
   * 旧页轻微后退 + 淡出（类似 iOS 切后台/卡片堆叠的感觉）。
   * fromPointer=true 表示新页已经在跟手位置，不要重置到屏幕外。
   */
  function commitDetailSlide(oldEl, newEl, dir, fromPointer) {
    if (!newEl) return;
    if (!oldEl || oldEl === newEl) { dReset(newEl); return; }
    if (detailReducedMotion()) { dReset(newEl); dDrop(oldEl); return; }
    newEl.classList.add('detail-sliding');
    newEl.style.zIndex = '52'; newEl.style.boxShadow = dShadow(dir);
    if (!fromPointer) {
      dAnim(newEl, 0); dPlace(newEl, dir * 100, 1, .85);
      void newEl.offsetWidth;                       // 强制回流，确保起始位置生效
    }
    dAnim(oldEl, DETAIL_DUR); dAnim(newEl, DETAIL_DUR);
    dPlace(newEl, 0, 1, 1);
    dPlace(oldEl, -dir * 12, .955, .38);
    const dead = oldEl, live = newEl;
    window.setTimeout(() => {
      dDrop(dead);
      dAnim(live, 0); dPlace(live, 0, 1, 1);
      window.setTimeout(() => dReset(live), 30);
    }, DETAIL_DUR + 30);
  }
  /** 原地替换（置顶后重排等）：轻微缩放交叉淡化，同样不闪列表 */
  function replaceDetailInPlace(oldEl, newEl) {
    if (!newEl) return;
    if (!oldEl || detailReducedMotion()) { dDrop(oldEl); dReset(newEl); return; }
    newEl.classList.add('detail-sliding'); newEl.style.zIndex = '52';
    dAnim(newEl, 0); dPlace(newEl, 0, .97, 0);
    void newEl.offsetWidth;
    dAnim(newEl, 260); dAnim(oldEl, 260);
    dPlace(newEl, 0, 1, 1); dPlace(oldEl, 0, 1.02, 0);
    const dead = oldEl, live = newEl;
    window.setTimeout(() => { dDrop(dead); window.setTimeout(() => dReset(live), 30); }, 290);
  }

  /* ============================================================
     详情页左右切换项目：
       电脑 = 键盘 ← / → ；平板手机 = 左右滑动（跟手，可拖回来）；Esc = 关闭
     使用方必须在关闭详情时调用返回的 cleanup，否则键盘监听会残留。
     opts: { prev(), next(), hasPrev(), hasNext(), close(), peek(dir)->overlay|null }
       peek 用来在手指拖动时先把相邻那一页准备好放在屏幕外
     ============================================================ */
  function enableOverlayNav(overlay, opts) {
    function go(dir) {
      // 正在转场（身上还带着 detail-sliding）时不接受新指令，避免连按叠出一堆层
      if (detailBusy || overlay.classList.contains('detail-sliding')) return;
      if (dir < 0) { if (opts.hasPrev()) opts.prev(); else UI.toast('已经是第一个了'); }
      else { if (opts.hasNext()) opts.next(); else UI.toast('已经是最后一个了'); }
    }
    var detailBusy = false;
    function isTyping(t) {
      if (!t) return false;
      const tag = t.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t.isContentEditable;
    }
    function onKey(e) {
      if (detailBusy) return;
      if (typeof peekEl !== 'undefined' && peekEl) return;         // 手指正在拖动，键盘不掺合
      if (document.querySelector && document.querySelector('.modal-mask')) return;  // 有弹窗时不抢键盘
      if (isTyping(e.target)) return;
      if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
      else if (e.key === 'Escape') { e.preventDefault(); if (opts.close) opts.close(); }
    }
    document.addEventListener('keydown', onKey);

    /* 触摸：横向拖动跟手翻页，松手前可以拖回来取消（竖向滚动不干扰） */
    let sx = 0, sy = 0, tracking = false, horiz = false;
    let peekEl = null, peekDir = 0;
    const THRESHOLD = () => Math.min(96, Math.max(48, (window.innerWidth || 360) * .26));

    function dropPeek(el) { if (el) { cleanupDetail(el); if (el.parentNode) el.remove(); } }
    function ensurePeek(dir) {
      if (peekEl) { if (peekDir === dir) return peekEl; dropPeek(peekEl); peekEl = null; }
      if (!opts.peek) return null;
      const el = opts.peek(dir);
      if (!el) return null;
      peekEl = el; peekDir = dir;
      el.classList.add('detail-sliding'); el.style.animation = 'none';
      el.style.zIndex = '52'; el.style.boxShadow = dShadow(dir);
      dAnim(el, 0); dPlace(el, dir * 100, 1, 1);
      return el;
    }
    function followFinger(dx) {
      const dir = dx < 0 ? 1 : -1;
      const el = ensurePeek(dir); if (!el) return;
      const pct = Math.min(100, px2pct(Math.abs(dx)));
      overlay.classList.add('detail-sliding');
      dAnim(overlay, 0); dAnim(el, 0);
      // 旧页后退速度必须小于新页推进速度，否则两页之间会漏出缝（缝里就是列表）
      dPlace(overlay, -dir * pct * .12, 1 - pct / 100 * .045, 1);
      dPlace(el, dir * (100 - pct), 1, 1);
    }
    function springBack() {
      const el = peekEl, dir = peekDir, back = overlay;
      peekEl = null;
      dAnim(el, 240); dAnim(back, 240);
      dPlace(el, dir * 100, 1, 1); dPlace(back, 0, 1, 1);
      window.setTimeout(() => { dropPeek(el); dReset(back); }, 270);
    }
    function commitPeek() {
      const el = peekEl, dir = peekDir, old = overlay;
      peekEl = null;
      cleanupDetail(old);                    // 旧页交出键盘
      if (opts.onCommit) opts.onCommit(dir, el);
      commitDetailSlide(old, el, dir, true); // 从手指当前位置继续推到底
    }

    overlay.addEventListener('touchstart', e => {
      if (e.touches.length !== 1 || isTyping(e.target)) return;
      if (document.querySelector && document.querySelector('.modal-mask')) return;
      if (detailBusy) return;
      sx = e.touches[0].clientX; sy = e.touches[0].clientY; tracking = true; horiz = false;
    }, { passive: true });
    overlay.addEventListener('touchmove', e => {
      if (!tracking || e.touches.length !== 1) return;
      const dx = e.touches[0].clientX - sx, dy = e.touches[0].clientY - sy;
      if (!horiz) {
        // 方向还没定：竖向动得明显就让位给页面滚动；横向超过 8px 才认作翻页手势
        if (Math.abs(dx) < 8) { if (Math.abs(dy) > 12) tracking = false; return; }
        if (Math.abs(dy) > Math.abs(dx) * 1.2) { tracking = false; return; }
        horiz = true;
      }
      followFinger(dx);
    }, { passive: true });
    overlay.addEventListener('touchend', e => {
      tracking = false;
      if (!peekEl) { horiz = false; return; }
      const t = e.changedTouches && e.changedTouches[0];
      const dx = t ? t.clientX - sx : 0;
      if (Math.abs(dx) >= THRESHOLD() && (dx < 0 ? 1 : -1) === peekDir) commitPeek();
      else springBack();
      horiz = false;
    }, { passive: true });
    overlay.addEventListener('touchcancel', () => {
      tracking = false; horiz = false;
      if (peekEl) springBack();
    }, { passive: true });

    return function cleanup() {
      document.removeEventListener('keydown', onKey);
      detailBusy = true;
      if (peekEl) { dropPeek(peekEl); peekEl = null; }
    };
  }
  function modalFooter(onSave, delText, onDel) {
    const f = document.createElement('div'); f.style.marginTop = '6px';
    const save = btn('保存', onSave); save.classList.add('btn-primary'); f.appendChild(save);
    if (delText) { const del = btn(delText, onDel); del.className = 'btn-danger'; del.style.marginLeft = '8px'; f.appendChild(del); }
    return f;
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

  /* ============================================================
     通用：小项目的「置顶 / 定时置顶 / 不置顶」+「整体配色」
     —— 学习科目、技能、习惯、想法、项目 共用同一套
     it.pinned  : true 表示置顶（含定时置顶）
     it.pinFrom : 'YYYY-MM-DD'，到了这天（含）才真正置顶；为空表示立即置顶
     ============================================================ */
  function pinActive(it) { return !!it.pinned && (!it.pinFrom || it.pinFrom <= Store.todayStr()); }
  function pinWaiting(it) { return !!it.pinned && !!it.pinFrom && it.pinFrom > Store.todayStr(); }
  function pinBadge(it) {
    if (pinActive(it)) return '<span class="fi-pill pin">📌 已置顶</span>';
    if (pinWaiting(it)) return `<span class="fi-pill pin-wait">🕓 ${esc(it.pinFrom)} 起置顶</span>`;
    return '';
  }
  /* 把整个小项目（长方形）刷成它的颜色，文字自动取黑/白保证可读 */
  function paintItem(el, color) {
    if (!color) { el.classList.remove('item-colored'); el.style.background = ''; el.style.color = ''; el.style.borderColor = ''; return; }
    el.classList.add('item-colored');
    el.style.background = color;
    el.style.borderColor = color;
    el.style.color = Store.pickText(color);
  }
  /* 日期选择弹窗（用于「从某天开始置顶」） */
  function askPinDate(it, onDone) {
    const dateI = UI.input(it.pinFrom || Store.todayStr(), '年-月-日'); dateI.type = 'date';
    const body = document.createElement('div');
    const tip = document.createElement('p'); tip.className = 'muted';
    tip.textContent = '到这天（含）起，它会自动置顶到最前面；这天之前按正常顺序排列。';
    body.append(UI.field('开始置顶的日期', dateI), tip);
    const footer = modalFooter(() => {
      const v = dateI.value; if (!v) return UI.toast('请选择日期');
      it.pinned = true; it.pinFrom = v; Store.save(); close(); onDone && onDone();
      UI.toast(v + ' 起置顶');
    });
    const close = UI.modal({ title: '定时置顶', body, footer });
  }
  /* 颜色选择弹窗：改的是「整个小项目」的颜色 */
  function askItemColor(it, onDone) {
    let color = it.color || Store.PALETTE[Math.floor(Math.random() * Store.PALETTE.length)];
    const wrap = document.createElement('div');
    wrap.appendChild(UI.colorChips(color, c => color = c));
    const tip = document.createElement('p'); tip.className = 'muted'; tip.style.marginTop = '10px';
    tip.textContent = '选好后，整个条目（整块长方形）都会变成这个颜色。';
    const body = document.createElement('div'); body.append(UI.field('项目颜色', wrap), tip);
    const footer = modalFooter(() => {
      it.color = color; Store.save(); close(); onDone && onDone(); UI.toast('颜色已更新');
    });
    const close = UI.modal({ title: '设置颜色', body, footer });
  }
  /* 右键菜单：置顶 / 从…起置顶 / 不置顶 / 设置颜色（+ 调用方追加的自定义项） */
  function openItemMenu(e, it, extra, onDone) {
    e.preventDefault(); e.stopPropagation();
    const items = [];
    if (pinActive(it)) items.push({ label: '🚫 取消置顶（不置顶）', action: () => { it.pinned = false; it.pinFrom = ''; Store.save(); onDone && onDone(); UI.toast('已取消置顶'); } });
    else items.push({ label: '📌 置顶（现在就排最前）', action: () => { it.pinned = true; it.pinFrom = ''; Store.save(); onDone && onDone(); UI.toast('已置顶'); } });
    items.push({ label: '🗓️ 从某天开始置顶…', action: () => askPinDate(it, onDone) });
    if (pinWaiting(it)) items.push({ label: '🚫 不置顶', action: () => { it.pinned = false; it.pinFrom = ''; Store.save(); onDone && onDone(); UI.toast('已取消置顶'); } });
    items.push({ label: '🎨 设置项目颜色…', action: () => askItemColor(it, onDone) });
    (extra || []).forEach(x => items.push(x));
    showCtxMenu(e.clientX, e.clientY, items);
  }
  /* 排序：置顶生效的在前，其余保持原顺序 */
  function sortPinned(arr) {
    return arr.slice().sort((a, b) => (pinActive(a) ? 0 : 1) - (pinActive(b) ? 0 : 1));
  }

  function shade(hex) { try { const n = parseInt(hex.slice(1), 16); let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255; r = Math.max(0, r - 40); g = Math.max(0, g - 40); b = Math.max(0, b - 40); return `rgb(${r},${g},${b})`; } catch (e) { return hex; } }
  function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
  function chartRange(mode, anchor) {
    if (mode === 'week') {
      const day = anchor.getDay(); const diff = (day === 0 ? -6 : 1 - day);
      const start = addDays(anchor, diff); const days = []; for (let i = 0; i < 7; i++) days.push(addDays(start, i));
      return { start, end: days[6], days };
    } else {
      const y = anchor.getFullYear(), m = anchor.getMonth();
      const start = new Date(y, m, 1); const end = new Date(y, m + 1, 0);
      const days = []; for (let d = 1; d <= end.getDate(); d++) days.push(new Date(y, m, d));
      return { start, end, days };
    }
  }

  /* ---------- 侧边栏底部：数据管理（导出/备份、导入/恢复、清空） ---------- */
  function renderNavFooter() {
    const sb = $('#sidebar');
    let f = $('#nav-footer');
    if (!f) { f = document.createElement('div'); f.id = 'nav-footer'; sb.appendChild(f); }
    f.innerHTML = '';
    const exportBtn = btn('导出 / 备份', exportData); exportBtn.classList.add('nav-foot-btn');
    const importBtn = btn('导入 / 恢复', importData); importBtn.classList.add('nav-foot-btn');
    const clearBtn = btn('清空数据', clearData); clearBtn.classList.add('nav-foot-btn', 'btn-danger');
    f.append(exportBtn, importBtn, clearBtn);
    if (!$('#import-file')) {
      const fi = document.createElement('input'); fi.type = 'file'; fi.accept = 'application/json'; fi.id = 'import-file'; fi.style.display = 'none';
      fi.onchange = handleImportFile; sb.appendChild(fi);
    }
  }
  async function exportData() {
    const data = Store.exportData();
    const json = JSON.stringify(data, null, 2);
    const fname = 'MIND脑海_备份_' + Store.todayStr() + '.json';
    // 优先：让用户自行选择保存位置（文件夹 + 文件名）
    if (window.showSaveFilePicker) {
      try {
        const handle = await window.showSaveFilePicker({
          suggestedName: fname,
          types: [{ description: 'MIND 备份', accept: { 'application/json': ['.json'] } }],
        });
        const w = await handle.createWritable();
        await w.write(json);
        await w.close();
        UI.toast('已保存到所选位置：' + fname);
        return;
      } catch (e) { if (e && e.name === 'AbortError') return; /* 不支持或用户取消，回退 */ }
    }
    // 回退：浏览器默认下载
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = fname;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    UI.toast('已导出到浏览器默认下载文件夹');
  }
  async function importData() {
    // 优先：让用户自行选择文件（可进入任意文件夹）
    if (window.showOpenFilePicker) {
      try {
        const [handle] = await window.showOpenFilePicker({
          types: [{ description: 'MIND 备份', accept: { 'application/json': ['.json'] } }],
          multiple: false,
        });
        const file = await handle.getFile();
        const text = await file.text();
        doImport(text);
        return;
      } catch (e) { if (e && e.name === 'AbortError') return; UI.toast('导入失败：' + (e.message || e)); }
      return;
    }
    const fi = $('#import-file'); if (fi) fi.click();
  }
  function doImport(text) {
    try {
      const obj = JSON.parse(text);
      if (!confirm('导入将覆盖当前所有数据，确定继续？（建议先导出备份）')) return;
      Store.importData(obj); Store.applyTheme(); renderTopProfile(); showView(currentViewId);
      UI.toast('数据已恢复');
    } catch (err) { UI.toast('导入失败：' + err.message); }
  }
  function handleImportFile(e) {
    const fi = e.target; const file = fi.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { doImport(reader.result); fi.value = ''; };
    reader.readAsText(file);
  }
  function clearData() {
    if (!confirm('确定清空所有数据？此操作不可恢复，建议先「导出 / 备份」。')) return;
    Store.resetData(); Store.applyTheme(); renderTopProfile(); showView(currentViewId);
    UI.toast('数据已清空');
  }

  /* ============================================================
     提醒引擎 + 顶部提醒中心（铃铛）
     ============================================================ */
  let bellPanel = null;
  let reminderItems = [];

  function renderBell() {
    const bar = $('#topbar');
    if (!bar) return;
    let btnEl = $('#bell-btn');
    if (!btnEl) {
      btnEl = document.createElement('button'); btnEl.id = 'bell-btn'; btnEl.className = 'bell-btn';
      btnEl.innerHTML = bellSVG();
      const badge = document.createElement('span'); badge.id = 'bell-badge'; badge.className = 'bell-badge';
      btnEl.appendChild(badge);
      bar.insertBefore(btnEl, $('#topbar-profile'));
      btnEl.onclick = toggleBellPanel;
      bellPanel = document.createElement('div'); bellPanel.id = 'bell-panel'; bellPanel.className = 'reminder-panel';
      document.body.appendChild(bellPanel);
      bellPanel.style.display = 'none';
      document.addEventListener('click', e => {
        if (bellPanel.style.display !== 'none' && !bellPanel.contains(e.target) && e.target !== btnEl && !btnEl.contains(e.target))
          bellPanel.style.display = 'none';
      });
    }
  }
  function bellSVG() {
    return '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>';
  }
  function toggleBellPanel() {
    if (!bellPanel) return;
    if (bellPanel.style.display === 'none') { buildBellPanel(); bellPanel.style.display = ''; }
    else bellPanel.style.display = 'none';
  }
  function buildBellPanel() {
    bellPanel.innerHTML = '';
    const head = document.createElement('div'); head.className = 'rp-head';
    head.innerHTML = `重要时间节点提醒 <span class="muted" style="font-weight:600;font-size:12px">（点开标记已读 · 长按恢复未读 · 右键菜单）</span>`;
    bellPanel.appendChild(head);
    if (!reminderItems.length) { const e = document.createElement('div'); e.className = 'rp-empty'; e.textContent = '暂无时间节点'; bellPanel.appendChild(e); return; }
    reminderItems.forEach(x => {
      const row = document.createElement('div'); row.className = 'rp-item ' + x.status + (x.read ? ' read' : '');
      const dot = document.createElement('span'); dot.className = 'rp-dot' + (x.read ? ' off' : '');
      const dstr = x.diff === 0 ? '今天' : (x.diff < 0 ? `已过期 ${-x.diff} 天` : `还有 ${x.diff} 天`);
      const info = document.createElement('div'); info.className = 'rp-info';
      info.innerHTML = `<div class="rp-date">${esc(x.date)} · ${dstr}</div><div class="rp-title">${esc(x.title)}</div><div class="rp-proj">${esc(x.name)}${x.read ? ' · 已读' : ''}</div>`;
      row.append(dot, info);
      // 交互：点击=标记已读并跳转；长按=恢复未读；右键=菜单
      let timer = null, longed = false;
      const start = () => { longed = false; timer = setTimeout(() => { longed = true; setRead(x, false); UI.toast('已重新标记为未读'); }, 500); };
      const cancel = () => { clearTimeout(timer); };
      row.addEventListener('pointerdown', start);
      row.addEventListener('pointerup', cancel);
      row.addEventListener('pointerleave', cancel);
      row.addEventListener('pointermove', cancel);
      row.addEventListener('contextmenu', e => { e.preventDefault(); showItemMenu(e, x); });
      row.addEventListener('click', () => {
        if (longed) return;
        setRead(x, true);
        bellPanel.style.display = 'none';
        if (x.source === 'project') openFlowDetail(x.sourceId); else openIdeaDetail(x.sourceId);
      });
      bellPanel.appendChild(row);
    });
  }
  function setRead(x, val) {
    x.node.read = val;
    Store.save();
    refreshBell();
  }
  function showItemMenu(e, x) {
    e.preventDefault();
    closeItemMenu();
    const m = document.createElement('div'); m.className = 'ctx-menu';
    m.style.left = e.clientX + 'px'; m.style.top = e.clientY + 'px';
    const mk = (label, fn) => { const b = document.createElement('div'); b.className = 'ctx-item'; b.textContent = label; b.onclick = () => { fn(); closeItemMenu(); }; m.appendChild(b); };
    if (!x.read) mk('标为已读', () => setRead(x, true));
    else mk('标为未读', () => setRead(x, false));
    mk('查看详情', () => { bellPanel.style.display = 'none'; if (x.source === 'project') openFlowDetail(x.sourceId); else openIdeaDetail(x.sourceId); });
    document.body.appendChild(m);
    setTimeout(() => document.addEventListener('click', closeItemMenu, { once: true }), 0);
  }
  function closeItemMenu() { const m = document.querySelector('.ctx-menu'); if (m) m.remove(); }
  function getReminderList() {
    const st = Store.get();
    const todayT = Store.parseDate(Store.todayStr());
    const cfg = st.reminder || { on: true, defaultLead: 1 };
    const list = [];
    // 项目时间节点
    st.projects.forEach(p => (p.timeline || []).forEach(t => {
      const dt = Store.parseDate(t.date);
      const diff = Math.round((dt - todayT) / 86400000);
      const lead = (t.lead != null ? t.lead : (cfg.defaultLead != null ? cfg.defaultLead : 1));
      const status = diff < 0 ? 'overdue' : (diff <= lead ? 'due' : 'upcoming');
      list.push({ source: 'project', sourceId: p.id, name: p.name, node: t, date: t.date, title: t.title, diff, lead, remind: t.remind !== false, status, read: t.read === true, key: p.id + '|' + t.date + '|' + t.title });
    }));
    // 想法提醒
    (st.ideas || []).forEach(idea => (idea.reminders || []).forEach(r => {
      const dt = Store.parseDate(r.date);
      const diff = Math.round((dt - todayT) / 86400000);
      const lead = (r.lead != null ? r.lead : (cfg.defaultLead != null ? cfg.defaultLead : 1));
      const status = diff < 0 ? 'overdue' : (diff <= lead ? 'due' : 'upcoming');
      list.push({ source: 'idea', sourceId: idea.id, name: idea.title, node: r, date: r.date, title: r.title, diff, lead, remind: r.remind !== false, status, read: r.read === true, key: 'idea|' + idea.id + '|' + r.id });
    }));
    list.sort((a, b) => a.diff - b.diff);
    return list;
  }
  function refreshBell() {
    reminderItems = getReminderList();
    const badge = $('#bell-badge');
    if (badge) {
      const n = reminderItems.filter(x => (x.status === 'due' || x.status === 'overdue') && x.remind && !x.read).length;
      badge.textContent = n ? String(n) : '';
      badge.style.display = n ? '' : 'none';
    }
    if (bellPanel && bellPanel.style.display !== 'none') buildBellPanel();
  }
  function scanReminders() {
    const st = Store.get();
    const cfg = st.reminder || { on: true, defaultLead: 1 };
    if (!cfg.on) { refreshBell(); return; }
    const due = getReminderList().filter(x => (x.status === 'due' || x.status === 'overdue') && x.remind && !x.read);
    const toFire = [];
    due.forEach(x => { if (!st.reminders.find(r => r.key === x.key)) toFire.push(x); });
    if (toFire.length) {
      toFire.forEach(x => st.reminders.push({ key: x.key, projectId: x.sourceId, date: x.date, title: x.title, firedAt: new Date().toISOString() }));
      fireReminders(toFire);
    }
    Store.save();
    refreshBell();
  }
  function fireReminders(list) {
    if (!list.length) return;
    // 1) 声音提示（自定义/预设铃声）
    playSound();
    // 2) 系统桌面通知（浏览器原生弹窗，需授权）
    list.forEach(x => {
      const when = x.diff === 0 ? '就是今天' : `还有 ${x.diff} 天`;
      if (x.node.channel !== 'inapp') UI.notify('重要时间节点提醒', `${x.name} · ${x.title}\n${when}（${x.date}）`);
    });
    // 3) 站内弹窗（保证可见的「电脑弹窗」）
    showReminderPopup(list);
    // 4) 第三方推送（企业微信 / 自定义 Webhook，可选）
    pushWebhook(list);
  }
  /* ---------- 声音（Web Audio 预设 + 自定义上传） ---------- */
  let _actx;
  function audioCtx() {
    if (!_actx) { try { _actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} }
    if (_actx && _actx.state === 'suspended') { try { _actx.resume(); } catch (e) {} }
    return _actx;
  }
  function tone(freq, start, dur, vol, type) {
    const ac = audioCtx(); if (!ac) return;
    const o = ac.createOscillator(); const g = ac.createGain();
    o.type = type || 'sine'; o.frequency.value = freq;
    o.connect(g); g.connect(ac.destination);
    const t0 = ac.currentTime + start;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.start(t0); o.stop(t0 + dur + 0.03);
  }
  function beepPreset(id, vol) {
    vol = Math.max(0.05, Math.min(1, vol));
    switch (id) {
      case 'dingdong': tone(1046, 0, 0.25, vol); tone(784, 0.28, 0.45, vol); break;
      case 'beep': tone(440, 0, 0.12, vol, 'square'); tone(440, 0.18, 0.12, vol, 'square'); tone(440, 0.36, 0.16, vol, 'square'); break;
      case 'soft': tone(660, 0, 0.5, vol); break;
      case 'bell': tone(1318, 0, 0.3, vol); tone(1568, 0.1, 0.3, vol); tone(1976, 0.2, 0.6, vol); break;
      case 'drop': tone(880, 0, 0.12, vol); tone(587, 0.12, 0.35, vol); break;
      case 'crystal': tone(1568, 0, 0.15, vol); tone(2093, 0.15, 0.15, vol); tone(2637, 0.3, 0.5, vol); break;
      case 'marimba': tone(523, 0, 0.18, vol); tone(659, 0.18, 0.18, vol); tone(784, 0.36, 0.3, vol); break;
      case 'piano': tone(659, 0, 0.2, vol); tone(523, 0.18, 0.2, vol); tone(784, 0.36, 0.4, vol); break;
      case 'twinkle': tone(988, 0, 0.2, vol); tone(988, 0.2, 0.2, vol); tone(1318, 0.4, 0.4, vol); break;
      case 'alert': tone(880, 0, 0.1, vol, 'square'); tone(1175, 0.15, 0.1, vol, 'square'); tone(880, 0.3, 0.1, vol, 'square'); tone(1175, 0.45, 0.25, vol, 'square'); break;
      case 'knock': tone(180, 0, 0.08, vol, 'sawtooth'); tone(180, 0.14, 0.08, vol, 'sawtooth'); break;
      case 'pop': tone(1200, 0, 0.08, vol); tone(1600, 0.09, 0.12, vol); break;
      case 'coin': tone(988, 0, 0.08, vol); tone(1318, 0.08, 0.25, vol); break;
      case 'chord': tone(523, 0, 0.5, vol); tone(659, 0, 0.5, vol); tone(784, 0, 0.5, vol); break;
      case 'sweep': tone(300, 0, 0.2, vol); tone(500, 0.2, 0.2, vol); tone(800, 0.4, 0.3, vol); break;
      case 'low': tone(120, 0, 0.35, vol, 'sine'); tone(90, 0.3, 0.4, vol, 'sine'); break;
      case 'high': tone(1568, 0, 0.15, vol, 'square'); tone(2093, 0.15, 0.2, vol, 'square'); break;
      case 'triple': tone(660, 0, 0.1, vol); tone(660, 0.15, 0.1, vol); tone(660, 0.3, 0.1, vol); break;
      case 'wave': tone(440, 0, 0.3, vol); tone(392, 0.3, 0.3, vol); tone(330, 0.6, 0.4, vol); break;
      case 'custom': break;
      default: tone(880, 0, 0.22, vol); tone(1320, 0.24, 0.4, vol); // chime 清脆铃声
    }
  }
  function playSound() {
    const s = Store.get().sound || { id: 'chime', volume: 90 };
    const userVol = (s.volume != null ? s.volume : 90) / 100; // 0~1
    const BASE = 0.35;   // 合成器原始缩放（防爆音）
    const BOOST = 3;     // 提醒音量整体提升 200%（相对原始基准 ×3，封顶 1.0）
    const target = Math.min(1, userVol * BASE * BOOST); // 默认约 0.945
    if (s.id === 'custom' && s.customUrl) {
      try { const a = new Audio(s.customUrl); a.volume = Math.max(0.05, Math.min(1, userVol * BOOST)); a.play().catch(() => {}); } catch (e) {}
      return;
    }
    beepPreset(s.id || 'chime', target);
  }
  /* ---------- 站内弹窗（保证可见的提醒） ---------- */
  function showReminderPopup(list) {
    const body = document.createElement('div');
    const wrap = document.createElement('div');
    list.forEach(x => {
      const d = document.createElement('div'); d.className = 'rp-pop-item';
      d.innerHTML = `<div class="rp-pop-name">${esc(x.name)}</div><div class="rp-pop-title">${esc(x.title)} · ${esc(x.date)}</div>`;
      wrap.appendChild(d);
    });
    body.appendChild(wrap);
    const footer = document.createElement('div');
    const ok = btn('知道了', () => close()); ok.classList.add('btn-primary'); ok.style.marginRight = '8px';
    footer.appendChild(ok);
    if (list.length === 1) {
      const view = btn('查看', () => { close(); const x = list[0]; if (x.source === 'project') openFlowDetail(x.sourceId); else openIdeaDetail(x.sourceId); });
      footer.appendChild(view);
    }
    const close = UI.modal({ title: `提醒 · 你有 ${list.length} 个待办`, body, footer });
  }
  /* ---------- 第三方推送（企业微信/钉钉机器人 / Server酱推个人微信） ---------- */
  function pushWebhook(list) {
    const st = Store.get(); const w = st.webhook;
    if (!w || !w.url) return;
    const content = list.map(x => `【${x.name}】${x.title}（${x.date}）`).join('\n');
    const url = w.url.trim();
    let body, hdr;
    if (/sctapi\.ftqq\.com|sc\.ftqq\.com/.test(url)) {
      // Server酱：推送到个人微信（支持 POST，字段 title + desp）
      body = new URLSearchParams({ title: 'MIND 提醒', desp: 'MIND 提醒：\n' + content }).toString();
      hdr = { 'Content-Type': 'application/x-www-form-urlencoded' };
    } else {
      // 企业微信/钉钉机器人：{ msgtype:'text', text:{ content } }
      body = JSON.stringify({ msgtype: 'text', text: { content: 'MIND 提醒：\n' + content } });
      hdr = { 'Content-Type': 'application/json' };
    }
    try {
      fetch(url, { method: 'POST', headers: hdr, body }).catch(() => {});
    } catch (e) {}
  }
  function initNotify() {
    const st = Store.get();
    if ((st.reminder && st.reminder.on) && 'Notification' in window && Notification.permission === 'default') UI.requestNotify();
  }

  /* ---------- 初始化 ---------- */
  Store.applyTheme();
  renderNav();
  renderNavFooter();
  renderTopProfile();
  renderBell();
  if (navToggle) navToggle.onclick = toggleSidebar;
  applySidebar();
  applyScope();
  // 首个 MIND 页面使用当前历史条目；随后每次站内跳转都会新增一条可由浏览器“←”返回的记录。
  const initialRoute = isMindRoute(history.state) ? history.state : routeState('learning');
  history.replaceState(initialRoute, '', location.href);
  restoreHistoryRoute(initialRoute);
  initNotify();
  refreshBell();
  scanReminders();
  setInterval(scanReminders, 60000);
  // 云端拉取完成后刷新界面
  document.addEventListener('store-synced', () => {
    Store.applyTheme(); renderTopProfile(); renderNav(); renderBell(); refreshBell(); showView(currentViewId);
  });
  // 本地服务器数据加载完成（迁移 / 回滚后）刷新界面
  document.addEventListener('store-loaded', () => {
    Store.applyTheme(); renderTopProfile(); renderNav(); renderBell(); refreshBell(); showView(currentViewId);
  });
  // 首次用户交互时解锁音频上下文（浏览器自动播放限制）
  document.addEventListener('pointerdown', () => audioCtx(), { once: true });
})();
