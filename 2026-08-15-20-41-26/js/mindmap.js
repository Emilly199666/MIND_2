/* ============================================================
   MIND · 脑海 — 思维导图记录模块
   纯前端、无依赖。风格刻意保持中性（不跟随主题色），画布为浅色「纸感」。
   数据挂在 obj[textKey + '__mm'] = { mode, layout, root }
   root = { id, text, children: [...] }

   结构名称（更正式、好听）：
     symmetric → 平衡导图（中心向两侧对称发散）
     right     → 右展逻辑图（分支统一向右，总分结构）
     left      → 左展逻辑图（分支统一向左，反向推理）
   ============================================================ */
(function () {
  'use strict';

  const NS = 'http://www.w3.org/2000/svg';

  // 中性「黑白灰」：按层级由深到浅的灰，不抢眼（用户要求，不用红黄绿蓝）
  const GRAYS = ['#6b7280', '#9aa0ab', '#c2c8d2', '#d6dbe3', '#dfe3ea'];

  // 布局选择器定义（名字 + 副标题 + 迷你示意图）
  const LAYOUTS = [
    { v: 'symmetric', t: '平衡导图', s: '中心向两侧对称发散', svg: '<svg viewBox="0 0 64 36" class="mm-mini"><rect x="27" y="13" width="10" height="10" rx="3"/><path d="M27 18 C18 18 14 10 8 8"/><rect x="3" y="4" width="10" height="8" rx="2"/><path d="M27 18 C18 18 14 26 8 28"/><rect x="3" y="24" width="10" height="8" rx="2"/><path d="M37 18 C46 18 50 10 56 8"/><rect x="51" y="4" width="10" height="8" rx="2"/><path d="M37 18 C46 18 50 26 56 28"/><rect x="51" y="24" width="10" height="8" rx="2"/></svg>' },
    { v: 'right', t: '右展逻辑图', s: '分支统一向右 · 总分结构', svg: '<svg viewBox="0 0 64 36" class="mm-mini"><rect x="4" y="13" width="10" height="10" rx="3"/><path d="M14 18 C24 18 28 10 36 8"/><rect x="38" y="4" width="10" height="8" rx="2"/><path d="M14 18 C24 18 28 26 36 28"/><rect x="38" y="24" width="10" height="8" rx="2"/></svg>' },
    { v: 'left', t: '左展逻辑图', s: '分支统一向左 · 反向推理', svg: '<svg viewBox="0 0 64 36" class="mm-mini"><rect x="50" y="13" width="10" height="10" rx="3"/><path d="M50 18 C40 18 36 10 28 8"/><rect x="16" y="4" width="10" height="8" rx="2"/><path d="M50 18 C40 18 36 26 28 28"/><rect x="16" y="24" width="10" height="8" rx="2"/></svg>' },
  ];

  function uid() { return 'n' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3); }

  function findNode(root, id) {
    if (root.id === id) return root;
    for (const c of (root.children || [])) { const r = findNode(c, id); if (r) return r; }
    return null;
  }
  function removeNode(root, id) {
    if (!root.children) return false;
    const i = root.children.findIndex(c => c.id === id);
    if (i >= 0) { root.children.splice(i, 1); return true; }
    for (const c of root.children) { if (removeNode(c, id)) return true; }
    return false;
  }

  /* 幕布式大纲需要的树操作 */
  const noteEditing = new WeakSet();           // 正在编辑「描述」的节点（不持久化）
  function newNode() { return { id: uid(), text: '', note: '', collapsed: false, children: [] }; }
  function findLoc(node, id, parent) {
    const kids = node.children || [];
    for (let i = 0; i < kids.length; i++) {
      if (kids[i].id === id) return { parent: parent, index: i, node: kids[i] };
      const r = findLoc(kids[i], id, node);
      if (r) return r;
    }
    return null;
  }
  function locateRoot(root, id) {
    if (root.id === id) return { parent: null, index: -1, node: root };
    return findLoc(root, id, null);
  }
  function addSibling(root, id) {
    const loc = locateRoot(root, id);
    if (!loc || !loc.parent) return null;          // 根节点无同级
    const arr = loc.parent.children;
    const nn = newNode(); arr.splice(loc.index + 1, 0, nn); return nn;
  }
  function addChildNode(root, id) {
    const n = findNode(root, id); if (!n) return null;
    n.children = n.children || []; const nn = newNode(); n.children.push(nn); return nn;
  }
  function indentNode(root, id) {
    const loc = locateRoot(root, id);
    if (!loc.parent || loc.index === 0) return false;   // 根/首个子节点不能缩进
    const sibs = loc.parent.children;
    const prev = sibs[loc.index - 1];
    sibs.splice(loc.index, 1);
    prev.children = prev.children || []; prev.children.push(loc.node);
    return true;
  }
  function outdentNode(root, id) {
    const loc = locateRoot(root, id);
    if (!loc.parent) return false;
    const ploc = locateRoot(root, loc.parent.id);
    if (!ploc || !ploc.parent) return false;            // 父已是最顶层
    loc.parent.children.splice(loc.index, 1);
    ploc.parent.children.splice(ploc.index + 1, 0, loc.node);
    return true;
  }
  function removeNode2(root, id) {
    const loc = locateRoot(root, id);
    if (!loc || !loc.parent) return null;               // 根不能删
    const kids = loc.node.children || [];
    loc.parent.children.splice(loc.index, 1, ...kids);  // 子节点上提为同级
    return loc.parent;
  }

  /* 渲染整张导图到 host（可编辑 / 只读），并在 SVG 层绘制贝塞尔连线 */
  function renderMap(host, map, save, opts) {
    opts = opts || {};
    const editable = opts.editable !== false;
    const scale = typeof opts.scale === 'number' ? opts.scale : 1;
    const focusId = opts.focusId || null;

    function rerender(fid) { renderMap(host, map, save, Object.assign({}, opts, { focusId: fid || null })); }
    function addChild(pid) {
      const p = findNode(map.root, pid); if (!p) return;
      p.children = p.children || [];
      const nid = uid();
      p.children.push({ id: nid, text: '', children: [] });
      save(); rerender(nid);
    }
    function delNode(id) {
      if (id === map.root.id) return;
      removeNode(map.root, id); save(); rerender();
    }

    // 计算层级 depth、父节点、分支配色（黑白灰，按层级由深到浅）
    const parentMap = new Map(), depthMap = new Map(), colorMap = new Map();
    (function walk(node, parent, depth) {
      parentMap.set(node, parent); depthMap.set(node, depth);
      const color = depth === 0 ? null : GRAYS[Math.min(depth - 1, GRAYS.length - 1)];
      colorMap.set(node, color);
      (node.children || []).forEach(c => walk(c, node, depth + 1));
    })(map.root, null, 0);

    function boxEl(node) {
      const box = document.createElement('div'); box.className = 'mm-box';
      box.setAttribute('data-id', node.id);
      const depth = depthMap.get(node), color = colorMap.get(node);
      if (depth === 0) box.classList.add('mm-root');
      else if (depth === 1) {
        box.style.borderColor = color;
        box.style.borderWidth = '2px';
        box.style.background = 'color-mix(in srgb, ' + color + ' 14%, #fff)';
        box.style.color = '#2b2f38';
      } else {
        box.style.borderColor = '#e4e7ee';
        box.style.borderLeft = '3px solid ' + color;
        box.style.background = '#fff';
        box.style.color = depth >= 3 ? '#5b6270' : '#3a3f4b';
      }
      const txt = document.createElement('div'); txt.className = 'mm-text';
      if (editable) {
        txt.contentEditable = 'true'; txt.spellcheck = false; txt.textContent = node.text || '';
        const sync = () => { node.text = txt.textContent; save(); };
        txt.addEventListener('input', sync);
        txt.addEventListener('blur', sync);
        txt.addEventListener('keydown', e => {
          if (e.key === 'Enter') { e.preventDefault(); txt.blur(); addChild(node.id); }
          else if (e.key === 'Backspace' && txt.textContent === '' && node.id !== map.root.id) {
            e.preventDefault(); delNode(node.id);
          }
        });
      } else {
        txt.textContent = node.text || '未填写';
        txt.classList.add('ro');
        if (!node.text) txt.classList.add('mm-ph');
      }
      box.appendChild(txt);
      if (editable) {
        const tools = document.createElement('div'); tools.className = 'mm-tools';
        const addB = document.createElement('button'); addB.type = 'button'; addB.className = 'mm-btn'; addB.textContent = '+';
        addB.title = '添加子节点'; addB.onclick = (e) => { e.stopPropagation(); addChild(node.id); };
        tools.appendChild(addB);
        if (node.id !== map.root.id) {
          const delB = document.createElement('button'); delB.type = 'button'; delB.className = 'mm-btn mm-del'; delB.textContent = '✕';
          delB.title = '删除节点'; delB.onclick = (e) => { e.stopPropagation(); delNode(node.id); };
          tools.appendChild(delB);
        }
        box.appendChild(tools);
      }
      return box;
    }

    function subtree(node) {
      const li = document.createElement('li'); li.appendChild(boxEl(node));
      if (node.children && node.children.length) {
        const ul = document.createElement('ul'); ul.className = 'mm-tree';
        node.children.forEach(ch => ul.appendChild(subtree(ch)));
        li.appendChild(ul);
      }
      return li;
    }
    function halfTree(children) {
      const ul = document.createElement('ul'); ul.className = 'mm-tree';
      (children || []).forEach(ch => ul.appendChild(subtree(ch)));
      return ul;
    }

    host.innerHTML = '';
    const stage = document.createElement('div'); stage.className = 'mm-stage mm-' + map.layout;
    const svg = document.createElementNS(NS, 'svg'); svg.setAttribute('class', 'mm-links');
    svg.style.position = 'absolute'; svg.style.left = '0'; svg.style.top = '0';
    svg.style.pointerEvents = 'none'; svg.style.overflow = 'visible';
    stage.appendChild(svg);

    if (map.layout === 'symmetric') {
      const kids = map.root.children || [];
      const mid = Math.floor(kids.length / 2);
      const leftKids = kids.slice(0, mid), rightKids = kids.slice(mid);
      const center = document.createElement('div'); center.className = 'mm-center'; center.appendChild(boxEl(map.root));
      const leftCol = document.createElement('div'); leftCol.className = 'mm-col mm-col-left';
      if (leftKids.length) leftCol.appendChild(halfTree(leftKids));
      const rightCol = document.createElement('div'); rightCol.className = 'mm-col mm-col-right';
      if (rightKids.length) rightCol.appendChild(halfTree(rightKids));
      stage.append(leftCol, center, rightCol);
    } else {
      const tree = document.createElement('ul'); tree.className = 'mm-tree';
      tree.appendChild(subtree(map.root));
      stage.appendChild(tree);
    }
    host.appendChild(stage);

    // 绘制连线（用屏幕坐标差 ÷ scale 还原到内容坐标）
    function drawLinks() {
      const sr = stage.getBoundingClientRect();
      const w = stage.scrollWidth, h = stage.scrollHeight;
      svg.setAttribute('width', w); svg.setAttribute('height', h);
      svg.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      const toC = r => ({
        left: (r.left - sr.left) / scale, top: (r.top - sr.top) / scale,
        right: (r.right - sr.left) / scale, bottom: (r.bottom - sr.top) / scale,
      });
      const walk2 = node => {
        (node.children || []).forEach(ch => {
          const pb = stage.querySelector('[data-id="' + node.id + '"]');
          const cb = stage.querySelector('[data-id="' + ch.id + '"]');
          if (pb && cb) {
            const pr = toC(pb.getBoundingClientRect()), cr = toC(cb.getBoundingClientRect());
            const pcy = (pr.top + pr.bottom) / 2, ccy = (cr.top + cr.bottom) / 2;
            const left = (cr.left + cr.right) / 2 < (pr.left + pr.right) / 2;
            const sx = left ? pr.left : pr.right, ex = left ? cr.right : cr.left;
            const dx = Math.abs(ex - sx), k = dx * 0.5;
            const c1x = sx + (left ? -k : k), c2x = ex + (left ? k : -k);
            const depth = depthMap.get(ch);
            const sw = depth <= 1 ? 3 : (depth === 2 ? 2 : 1.6);
            const path = document.createElementNS(NS, 'path');
            path.setAttribute('d', 'M ' + sx + ' ' + pcy + ' C ' + c1x + ' ' + pcy + ' ' + c2x + ' ' + ccy + ' ' + ex + ' ' + ccy);
            path.setAttribute('fill', 'none');
            path.setAttribute('stroke', colorMap.get(ch));
            path.setAttribute('stroke-width', sw);
            path.setAttribute('stroke-linecap', 'round');
            svg.appendChild(path);
          }
          walk2(ch);
        });
      };
      // 每个 box 在创建时已打 data-id，直接按树绘制连线
      walk2(map.root);
    }

    requestAnimationFrame(drawLinks);
    if (focusId) {
      requestAnimationFrame(() => {
        const tb = stage.querySelector('[data-id="' + focusId + '"] .mm-text');
        if (tb) { tb.focus(); const r = document.createRange(); r.selectNodeContents(tb); r.collapse(false); const s = getSelection(); s.removeAllRanges(); s.addRange(r); }
      });
    }
  }

  /* ============================================================
     幕布式大纲编辑器（层级折叠 · 可输入大段文字 · 一键转导图）
     每个节点一行：小圆点 + 可编辑文本，子节点向右缩进；
     · 回车 = 新建同级   · Tab = 缩进一级   · Shift+Tab = 提升一级
     · 左侧小三角 = 折叠/展开（收起即隐藏其下所有内容）
     · 悬停出现工具：＋子主题 / 📝描述 / ✕删除
     ============================================================ */
  function renderOutline(host, map, save, opts) {
    opts = opts || {};
    const editable = opts.editable !== false;
    const focusId = opts.focusId || null;
    const root = map.root;

    function rerender(fid) { renderOutline(host, map, save, Object.assign({}, opts, { focusId: fid || null })); }
    function focusRow(id) {
      const tb = host.querySelector('.mo-row[data-id="' + id + '"] .mo-text');
      if (tb) { tb.focus(); const r = document.createRange(); r.selectNodeContents(tb); r.collapse(false); const s = getSelection(); s.removeAllRanges(); s.addRange(r); }
    }

    host.innerHTML = '';
    const ol = document.createElement('div'); ol.className = 'mm-outline';

    function buildRows(node, depth) {
      const row = document.createElement('div'); row.className = 'mo-row';
      row.dataset.id = node.id;
      row.style.paddingLeft = (10 + depth * 26) + 'px';

      // 折叠三角
      const caret = document.createElement('span'); caret.className = 'mo-caret';
      if (node.children && node.children.length) {
        caret.textContent = node.collapsed ? '▸' : '▾';
        caret.onclick = (e) => { e.stopPropagation(); node.collapsed = !node.collapsed; save(); rerender(); };
      }
      row.appendChild(caret);

      // 主题圆点
      const dot = document.createElement('span'); dot.className = 'mo-dot'; dot.title = '主题';
      dot.onclick = (e) => { e.stopPropagation(); const t = row.querySelector('.mo-text'); if (t) t.focus(); };
      row.appendChild(dot);

      // 文本（可输入大段，自动换行）
      const txt = document.createElement('div'); txt.className = 'mo-text';
      if (editable) {
        txt.contentEditable = 'true'; txt.spellcheck = false; txt.dataset.ph = (depth === 0 ? '中心主题' : '主题');
        if (node.text) txt.textContent = node.text;
        const sync = () => { node.text = txt.textContent; save(); };
        txt.addEventListener('input', sync);
        txt.addEventListener('blur', sync);
        txt.addEventListener('keydown', e => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault(); const nn = addSibling(root, node.id);
            if (nn) { save(); rerender(nn.id); }
          } else if (e.key === 'Tab' && !e.shiftKey) {
            e.preventDefault(); if (indentNode(root, node.id)) { save(); rerender(node.id); }
          } else if (e.key === 'Tab' && e.shiftKey) {
            e.preventDefault(); if (outdentNode(root, node.id)) { save(); rerender(node.id); }
          } else if (e.key === 'Backspace' && txt.textContent === '' && node.id !== root.id) {
            e.preventDefault();
            const loc = locateRoot(root, node.id);
            const prevId = loc && loc.parent
              ? (loc.index > 0 ? loc.parent.children[loc.index - 1].id : loc.parent.id)
              : null;
            removeNode2(root, node.id); save(); rerender(prevId);
          }
        });
      } else {
        txt.textContent = node.text || '（空）';
      }
      row.appendChild(txt);

      // 悬停工具
      if (editable) {
        const tools = document.createElement('span'); tools.className = 'mo-tools';
        const mk = (label, title, fn) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'mo-tool'; b.textContent = label; b.title = title; b.onclick = fn; return b; };
        const bAdd = mk('＋', '添加子主题', (e) => { e.stopPropagation(); const nn = addChildNode(root, node.id); node.collapsed = false; save(); rerender(nn.id); });
        const bNote = mk('📝', '描述 / 备注', (e) => { e.stopPropagation(); if (noteEditing.has(node)) noteEditing.delete(node); else noteEditing.add(node); rerender(node.id); });
        const bDel = mk('✕', '删除主题', (e) => { e.stopPropagation(); if (node.id !== root.id) { const par = removeNode2(root, node.id); save(); rerender(par ? ((par.children && par.children.length) ? par.children[par.children.length - 1].id : par.id) : null); } });
        bDel.classList.add('mo-del');
        tools.append(bAdd, bNote, bDel);
        row.appendChild(tools);
      }
      ol.appendChild(row);

      // 描述（大段文字，随主题一起折叠）
      if (node.note || noteEditing.has(node)) {
        const noteRow = document.createElement('div'); noteRow.className = 'mo-note';
        noteRow.style.paddingLeft = (10 + depth * 26 + 20) + 'px';
        const ta = document.createElement('textarea'); ta.className = 'mo-note-ta';
        ta.placeholder = '添加描述…（可输入大量文字，收起主题即隐藏）';
        ta.value = node.note || '';
        ta.oninput = () => { node.note = ta.value; save(); };
        noteRow.appendChild(ta);
        ol.appendChild(noteRow);
      }

      if (!node.collapsed && node.children) node.children.forEach(ch => buildRows(ch, depth + 1));
    }

    buildRows(root, 0);
    host.appendChild(ol);

    if (focusId) requestAnimationFrame(() => focusRow(focusId));
  }

  /* 全屏独立界面：幕布式大纲 + 可一键切换为思维导图 */
  let overlayEl = null;
  function closeFullscreen() { if (overlayEl) { overlayEl.remove(); overlayEl = null; } }

  function openFullscreen(map, save, titleText, initialView) {
    closeFullscreen();
    let zoom = 1, fitted = false;
    let view = (initialView === 'mindmap') ? 'mindmap' : 'outline';
    const overlay = document.createElement('div'); overlay.className = 'mm-overlay';
    overlayEl = overlay;

    const head = document.createElement('div'); head.className = 'mm-head';
    const title = document.createElement('div'); title.className = 'mm-title'; title.textContent = (titleText || '思维导图') + ' · 大纲笔记';
    const spacer = document.createElement('div'); spacer.style.flex = '1';

    // 视图切换：大纲 / 思维导图（幕布双视图）
    const viewWrap = document.createElement('div'); viewWrap.className = 'mm-view-toggle';
    const vbOutline = document.createElement('button'); vbOutline.type = 'button'; vbOutline.className = 'seg-btn'; vbOutline.textContent = '大纲';
    const vbMap = document.createElement('button'); vbMap.type = 'button'; vbMap.className = 'seg-btn'; vbMap.textContent = '思维导图';
    viewWrap.append(vbOutline, vbMap);

    // 布局切换（仅导图视图）
    const layoutWrap = document.createElement('div'); layoutWrap.className = 'mm-layouts';
    const optEls = {};
    LAYOUTS.forEach(L => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'mm-layout-opt' + (map.layout === L.v ? ' on' : '');
      b.innerHTML = '<span class="mm-lo-svg">' + L.svg + '</span><span class="mm-lo-t">' + L.t + '</span><span class="mm-lo-s">' + L.s + '</span>';
      b.onclick = () => { map.layout = L.v; save(); LAYOUTS.forEach(x => optEls[x.v].classList.toggle('on', x.v === L.v)); if (view === 'mindmap') renderFull(); };
      optEls[L.v] = b; layoutWrap.appendChild(b);
    });

    // 缩放（仅导图视图）
    const zoomWrap = document.createElement('div'); zoomWrap.className = 'mm-zoom';
    const zOut = document.createElement('button'); zOut.type = 'button'; zOut.className = 'mm-zbtn'; zOut.textContent = '－';
    const zLabel = document.createElement('span'); zLabel.className = 'mm-zlabel'; zLabel.textContent = '100%';
    const zIn = document.createElement('button'); zIn.type = 'button'; zIn.className = 'mm-zbtn'; zIn.textContent = '＋';
    const zFit = document.createElement('button'); zFit.type = 'button'; zFit.className = 'mm-zbtn mm-zfit'; zFit.textContent = '适应';
    function applyZoom() { const st = stageHost.firstElementChild; if (st) st.style.transform = 'scale(' + zoom + ')'; zLabel.textContent = Math.round(zoom * 100) + '%'; }
    zOut.onclick = () => { zoom = Math.max(0.4, zoom / 1.15); applyZoom(); };
    zIn.onclick = () => { zoom = Math.min(2, zoom * 1.15); applyZoom(); };
    zFit.onclick = fit;
    zoomWrap.append(zOut, zLabel, zIn, zFit);

    const closeB = document.createElement('button'); closeB.type = 'button'; closeB.className = 'mm-close'; closeB.textContent = '✕ 返回';
    closeB.onclick = closeFullscreen;

    head.append(title, spacer, viewWrap, layoutWrap, zoomWrap, closeB);

    const canvas = document.createElement('div'); canvas.className = 'mm-canvas';
    const stageHost = document.createElement('div'); stageHost.className = 'mm-stage-host';
    canvas.appendChild(stageHost);

    // 图例（仅导图视图）
    const legend = document.createElement('div'); legend.className = 'mm-legend';
    legend.innerHTML =
      '<span class="lg"><i class="lg-dot lg-root"></i>中心主题</span>' +
      '<span class="lg"><i class="lg-dot lg-branch"></i>主分支</span>' +
      '<span class="lg"><i class="lg-dot lg-sub"></i>子主题</span>' +
      '<span class="lg"><i class="lg-dot lg-sub2"></i>次主题</span>' +
      '<span class="lg lg-line">曲线连线 · 由粗到细</span>';
    canvas.appendChild(legend);

    function renderFull() {
      stageHost.innerHTML = '';
      if (view === 'mindmap') {
        canvas.classList.add('mm-canvas-map');
        layoutWrap.style.display = ''; zoomWrap.style.display = ''; legend.style.display = '';
        renderMap(stageHost, map, save, { editable: true, scale: zoom });
        const st = stageHost.firstElementChild;
        if (st) { st.style.transformOrigin = '0 0'; st.style.transform = 'scale(' + zoom + ')'; }
        if (!fitted) { fit(); fitted = true; }
      } else {
        canvas.classList.remove('mm-canvas-map');
        layoutWrap.style.display = 'none'; zoomWrap.style.display = 'none'; legend.style.display = 'none';
        renderOutline(stageHost, map, save, { editable: true });
      }
    }
    function fit() {
      const st = stageHost.firstElementChild; if (!st) return;
      const cw = st.scrollWidth, ch = st.scrollHeight;
      const vp = canvas.getBoundingClientRect();
      zoom = Math.min(1, (vp.width - 60) / cw, (vp.height - 60) / ch);
      zoom = Math.max(0.4, Math.min(1.4, zoom));
      const st2 = stageHost.firstElementChild; if (st2) st2.style.transform = 'scale(' + zoom + ')';
      zLabel.textContent = Math.round(zoom * 100) + '%';
    }
    function setView(v) {
      view = v;
      vbOutline.classList.toggle('on', v === 'outline');
      vbMap.classList.toggle('on', v === 'mindmap');
      renderFull();
    }
    vbOutline.onclick = () => setView('outline');
    vbMap.onclick = () => setView('mindmap');

    // 空白处拖拽平移（避开正文行与节点）
    let panning = false, sx = 0, sy = 0, sl = 0, stp = 0;
    canvas.addEventListener('mousedown', e => {
      if (e.target.closest('.mm-box') || e.target.closest('.mm-legend') || e.target.closest('.mo-row') || e.target.closest('.mo-note')) return;
      panning = true; sx = e.clientX; sy = e.clientY; sl = canvas.scrollLeft; stp = canvas.scrollTop;
      canvas.classList.add('panning');
    });
    overlay.addEventListener('mousemove', e => { if (!panning) return; canvas.scrollLeft = sl - (e.clientX - sx); canvas.scrollTop = stp - (e.clientY - sy); });
    overlay.addEventListener('mouseup', () => { panning = false; canvas.classList.remove('panning'); });
    overlay.addEventListener('mouseleave', () => { panning = false; canvas.classList.remove('panning'); });

    overlay.append(head, canvas);
    document.body.appendChild(overlay);
    setView(view);
  }

  /* 对外：生成带「文本 / 大纲 / 思维导图」切换的备忘录卡片（幕布式） */
  const MindMap = {
    // 备注/备忘录：富文本（类 Word）。选中文字后可改颜色 / 字号 / 加粗。
    // 旧版思维导图数据（xxx__mm）保留不删；文本为空时把导图中心主题迁回，避免丢内容。
    createMemo(obj, textKey, save, title) {
      const mapKey = textKey + '__mm';
      if (!obj[textKey] && obj[mapKey] && obj[mapKey].root && obj[mapKey].root.text) {
        obj[textKey] = obj[mapKey].root.text;
        try { save(); } catch (e) {}
      }

      const card = document.createElement('div'); card.className = 'card mm-memo-card';
      const t = document.createElement('div'); t.className = 'card-title'; t.textContent = title || '备忘录';
      card.appendChild(t);

      // 工具栏：加粗 / 斜体 / 下划线 / 颜色 / 字号 / 清除格式（作用于选中的文字）
      const tb = document.createElement('div'); tb.className = 'memo-toolbar';
      const mkBtn = (txt, ttl, sty) => {
        const b = document.createElement('button'); b.type = 'button'; b.className = 'memo-tb'; b.textContent = txt; b.title = ttl;
        if (sty) Object.assign(b.style, sty); return b;
      };
      const bB = mkBtn('B', '加粗', { fontWeight: '800' });
      const bI = mkBtn('I', '斜体', { fontStyle: 'italic' });
      const bU = mkBtn('U', '下划线', { textDecoration: 'underline' });
      const color = document.createElement('input'); color.type = 'color'; color.className = 'memo-color'; color.title = '文字颜色'; color.value = '#1f2937';
      const size = document.createElement('select'); size.className = 'memo-size'; size.title = '字号';
      [12, 14, 16, 18, 20, 24, 28].forEach(n => { const o = document.createElement('option'); o.value = n; o.textContent = n + 'px'; size.appendChild(o); });
      size.value = 14;
      const clear = mkBtn('清除', '清除选中文字的格式', null);
      tb.append(bB, bI, bU, color, size, clear);
      card.appendChild(tb);

      const hint = document.createElement('div'); hint.className = 'memo-hint';
      hint.textContent = '先用鼠标选中文字，再点工具栏调整颜色 / 字号 / 加粗';
      card.appendChild(hint);

      const host = document.createElement('div'); host.className = 'mm-host';
      card.appendChild(host);

      const editor = document.createElement('div'); editor.className = 'memo-editor';
      editor.contentEditable = 'true'; editor.spellcheck = false;
      editor.dataset.ph = '随手记点什么…';
      const raw = obj[textKey] || '';
      if (raw && /<[a-z][^>]*>/i.test(raw)) {
        editor.innerHTML = raw;                       // 已是 HTML（富文本）
      } else if (raw) {
        editor.innerHTML = raw.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>'); // 旧纯文本兼容
      }
      host.appendChild(editor);

      let saveTimer = null;
      function doSave() { obj[textKey] = editor.innerHTML; save(); }
      editor.addEventListener('input', () => { clearTimeout(saveTimer); saveTimer = setTimeout(doSave, 400); });
      editor.addEventListener('blur', doSave);

      // 选区保存 / 恢复：点工具栏（颜色/字号）会让编辑器失焦，先存住选区再用
      let savedRange = null;
      function saveSel() {
        const sel = window.getSelection();
        if (sel && sel.rangeCount && editor.contains(sel.anchorNode)) savedRange = sel.getRangeAt(0).cloneRange();
      }
      function restoreSel() {
        if (!savedRange) return false;
        const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(savedRange); return true;
      }
      function needSel() {
        editor.focus();
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0 || sel.isCollapsed || !editor.contains(sel.anchorNode)) {
          window.UI.toast('请先用鼠标选中要设置的文字'); return false;
        }
        return true;
      }
      // 普通按钮：阻止失焦以保留选区
      [bB, bI, bU, clear].forEach(b => b.addEventListener('mousedown', e => e.preventDefault()));
      bB.onclick = () => { if (!needSel()) return; document.execCommand('bold', false, null); doSave(); };
      bI.onclick = () => { if (!needSel()) return; document.execCommand('italic', false, null); doSave(); };
      bU.onclick = () => { if (!needSel()) return; document.execCommand('underline', false, null); doSave(); };
      clear.onclick = () => { if (!needSel()) return; document.execCommand('removeFormat', false, null); doSave(); };
      // 颜色 / 字号：先存选区，提交时再恢复并应用
      color.addEventListener('mousedown', saveSel);
      color.onchange = () => {
        if (!restoreSel()) { window.UI.toast('请先用鼠标选中要设置的文字'); return; }
        document.execCommand('foreColor', false, color.value); doSave();
      };
      function applyFontSize(px) {
        document.execCommand('fontSize', false, '7');
        editor.querySelectorAll('font[size="7"]').forEach(f => {
          const span = document.createElement('span'); span.style.fontSize = px + 'px';
          while (f.firstChild) span.appendChild(f.firstChild);
          f.replaceWith(span);
        });
      }
      size.addEventListener('mousedown', saveSel);
      size.onchange = () => {
        if (!restoreSel()) { window.UI.toast('请先用鼠标选中要设置的文字'); return; }
        applyFontSize(size.value); doSave();
      };

      return card;
    },
  };

  window.MindMap = MindMap;
})();
