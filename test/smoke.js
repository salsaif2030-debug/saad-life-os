/* اختبار دخان: يشغّل النظام في بيئة DOM مصغّرة ويستدعي كل الشاشات */
const fs = require('fs'), path = require('path');
const APP = require('path').join(__dirname, '..', 'public', 'app');

function mkEl(tag) {
  const el = {
    tagName: (tag || 'div').toUpperCase(), _html: '', children: [], style: { setProperty(){}, removeProperty(){} }, dataset: {}, value: '', checked: false, textContent: '',
    classList: { _s: new Set(), add(...c) { c.forEach(x => this._s.add(x)); }, remove(...c) { c.forEach(x => this._s.delete(x)); }, toggle(c, f) { f === undefined ? (this._s.has(c) ? this._s.delete(c) : this._s.add(c)) : (f ? this._s.add(c) : this._s.delete(c)); }, contains(c) { return this._s.has(c); } },
    get innerHTML() { return this._html; }, set innerHTML(v) { this._html = String(v); },
    appendChild(c) { this.children.push(c); return c; }, remove() { }, insertAdjacentHTML(p, h) { this._html += h; },
    addEventListener() { }, removeEventListener() { }, click() { }, focus() { }, scrollIntoView() { }, closest() { return mkEl('div'); },
    querySelector() { return mkEl('div'); }, querySelectorAll() { return []; }, setAttribute() { }, getAttribute() { return ''; }
  };
  return el;
}
const store = {};
global.localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => store[k] = String(v), removeItem: k => delete store[k] };
global.document = {
  documentElement: mkEl('html'), body: mkEl('body'), head: mkEl('head'),
  _els: {},
  getElementById(id) { return this._els[id] || (this._els[id] = mkEl('div')); },
  querySelector(s) { const m = /^#([\w-]+)$/.exec(s); return m ? this.getElementById(m[1]) : mkEl('div'); },
  querySelectorAll() { return []; },
  createElement: mkEl, addEventListener() { }
};
/* Supabase مزيّف: النظام يُنشئ العميل عند الإقلاع، والاختبار لا يلمس الشبكة */
const sbStub = {
  createClient: () => ({
    auth: {
      getSession: () => Promise.resolve({ data: { session: null } }),
      onAuthStateChange() { }, signInWithPassword() { }, signUp() { }, signOut() { },
      resetPasswordForEmail() { }, updateUser() { }
    },
    from: () => ({ select: () => ({ limit: () => Promise.resolve({ data: [], error: null }) }), update: () => ({ eq() { } }), insert: () => ({ select: () => ({ single: () => Promise.resolve({ data: { id: 'x' } }) }) }) })
  })
};
global.window = { supabase: sbStub, lucide: null, innerWidth: 1440, addEventListener() { }, Notification: undefined, scrollTo() { }, matchMedia: () => ({ matches: false, addEventListener() { } }) };
global.matchMedia = window.matchMedia;
global.innerWidth = 1440;
global.location = { hash: '', origin: 'http://localhost', pathname: '/app/', reload() { } };
global.navigator = { geolocation: null, clipboard: null };
global.fetch = () => new Promise(() => { });   // لا نتائج شبكة في الاختبار
global.setInterval = () => 0;
global.requestAnimationFrame = () => 0;
global.Notification = undefined;

const files = ['core.js', 'widgets.js', 'areas.js', 'timebox.js', 'canvas.js', 'desk.js', 'work.js', 'business.js', 'app.js'];
const code = files.map(f => fs.readFileSync(path.join(APP, 'js', f), 'utf8')).join('\n;\n');
const TESTS = fs.readFileSync(__dirname + '/tests-body.js', 'utf8');
const errs = [];
global.errs = errs;
global.__store = store;
try { (0, eval)(code + '\n;\n' + TESTS); } catch (e) { errs.push('تحميل: ' + e.message + '\n' + (e.stack || '').split('\n')[1]); console.log(e.stack); }
if (errs.length) { console.log('\nأخطاء (' + errs.length + '):\n' + errs.map(e => ' • ' + e).join('\n')); process.exit(1); }
console.log('\nكل الاختبارات نجحت ✓');
