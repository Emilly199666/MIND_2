const fs = require('fs');
const vm = require('vm');

function makeNode(tag) {
  const node = {
    tagName: tag, _cls: new Set(), id: '', _className: '', _text: '', _html: '', _children: [], parent: null, _attrs: {}, _onclick: null,
    dataset: {},
    style: new Proxy({}, { get: (t, k) => k === 'setProperty' ? (() => {}) : (t[k] !== undefined ? t[k] : ''), set: (t, k, v) => { t[k] = v; return true; } }),
    get className() { return this._className; }, set className(v) { this._className = v; },
    get textContent() { return this._text; }, set textContent(v) { this._text = v; },
    get innerHTML() { return this._html; }, set innerHTML(v) { this._html = v; },
    get value() { return this._value || ''; }, set value(v) { this._value = v; },
    get checked() { return !!this._checked; }, set checked(v) { this._checked = v; },
    get onclick() { return this._onclick; }, set onclick(f) { this._onclick = f; },
    classList: {
      add: (...c) => c.forEach(x => node._cls.add(x)),
      remove: (...c) => c.forEach(x => node._cls.delete(x)),
      contains: c => node._cls.has(c),
      toggle: (c, f) => { const has = node._cls.has(c); const on = f === undefined ? !has : f; if (on) node._cls.add(c); else node._cls.delete(c); return on; },
    },
    append(...n) { n.forEach(x => { node._children.push(x); if (x) x.parent = node; }); },
    appendChild(n) { node._children.push(n); if (n) n.parent = node; return n; },
    insertBefore(n) { node._children.push(n); if (n) n.parent = node; return n; },
    removeChild(n) { const i = node._children.indexOf(n); if (i >= 0) node._children.splice(i, 1); },
    remove() { if (node.parent) { const i = node.parent._children.indexOf(node); if (i >= 0) node.parent._children.splice(i, 1); } },
    addEventListener() {}, removeEventListener() {},
    querySelector() { return null; }, querySelectorAll() { return []; },
    getBoundingClientRect() { return { left: 0, top: 0, width: 10, height: 10, right: 10, bottom: 10 }; },
    setAttribute(k, v) { node._attrs[k] = v; }, getAttribute(k) { return node._attrs[k]; },
    focus() {}, click() {},
  };
  return node;
}

const registry = {};
function getEl(sel) { const id = String(sel).replace(/^#/, ''); if (!registry[id]) registry[id] = makeNode('div'); return registry[id]; }

const documentStub = {
  createElement: t => makeNode(t),
  getElementById: id => getEl('#' + id),
  querySelector: sel => getEl(sel),
  querySelectorAll: () => [],
  addEventListener() {},
  body: makeNode('body'),
  documentElement: makeNode('html'),
};

const windowStub = {
  Store: undefined,
  addEventListener() {}, removeEventListener() {}, dispatchEvent() { return true; },
  setTimeout: () => 0, clearTimeout() {},
  innerWidth: 1280, innerHeight: 800,
  location: { href: 'http://localhost/', pathname: '/', search: '', hash: '' },
  history: { state: null, pushState() {}, replaceState() {}, back() {}, forward() {} },
  matchMedia() { return { matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }; },
  scrollTo() {}, open() {}, close() {}, focus() {}, blur() {}, alert() {}, confirm() { return false; },
  requestAnimationFrame(cb) { return 0; }, cancelAnimationFrame() {},
  // 以下由浏览器提供，测试中保持 undefined（代码均有守卫，'in window' 判断会返回 false）
  AudioContext: undefined, webkitAudioContext: undefined,
  showSaveFilePicker: undefined, showOpenFilePicker: undefined,
};
const localStorageStub = { _d: {}, getItem(k) { return this._d[k] !== undefined ? this._d[k] : null; }, setItem(k, v) { this._d[k] = String(v); }, removeItem(k) { delete this._d[k]; } };

function uiFn() {
  const r = makeNode('div'); r.el = r;
  const f = function () { return r; };
  f.el = r; f.close = () => {};
  return f;
}
const UIStub = new Proxy({}, { get: () => uiFn, set: () => true });

const ctx = {
  window: windowStub,
  document: documentStub,
  localStorage: localStorageStub,
  UI: UIStub,
  Math, Date, JSON, Object, Array, String, Number, Boolean, parseInt, parseFloat, isNaN, console,
  setTimeout: () => 0, clearTimeout: () => {}, setInterval: () => 0, clearInterval: () => {},
  requestAnimationFrame: () => 0, cancelAnimationFrame: () => {},
  history: windowStub.history,
  location: windowStub.location,
};
ctx.globalThis = ctx;
vm.createContext(ctx);

function run(file) {
  const code = fs.readFileSync(file, 'utf8');
  vm.runInContext(code, ctx, { filename: file });
}

try {
  run('js/store.js');
  ctx.Store = ctx.window.Store;
  if (!ctx.Store) throw new Error('Store 未挂载到 window');
  run('js/app.js');
  ctx.UI = ctx.window.UI;

  const navList = registry['nav-list'];
  if (!navList || !navList._children.length) throw new Error('导航未渲染');
  const reviewLi = navList._children.find(li => li.dataset && li.dataset.id === 'review');
  if (!reviewLi) throw new Error('NAV 中未找到 review 项');
  if (typeof reviewLi._onclick !== 'function') throw new Error('review 项无点击处理');
  reviewLi._onclick();

  const main = registry['app-main'];
  if (!main || !main._children.length) throw new Error('复盘视图未渲染任何内容');

  console.log('PASS: 初始化与「复盘」视图渲染成功，main 子节点数 =', main._children.length);
} catch (e) {
  console.error('FAIL:', e && e.stack ? e.stack : e);
  process.exit(1);
}
