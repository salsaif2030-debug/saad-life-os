/* ============================================================
   نظام سعد السيف — Life Operating System
   core.js · النواة: الحالة، التخزين، المزامنة، أدوات الواجهة
   ============================================================ */

/* ===== إعدادات الاتصال (يعبّئها سعد من Supabase ← Settings ← API) ===== */
const SUPA_URL = 'https://kyzqhflbovlquxflascm.supabase.co';
const SUPA_KEY = 'sb_publishable_eMjKYZVuP3PjeEFc0Sr1Rg_HWRS8qii';

const APP_KEY  = 'saad_life_os_v1';
const CLOUD_ON = !!(SUPA_URL && SUPA_KEY);

let sb = CLOUD_ON ? window.supabase.createClient(SUPA_URL, SUPA_KEY) : null;
let USER = null, STATE_ID = null, saveTimer = null, CUR = 'dashboard', CUR_ARG = null;

/* ============================================================
   أدوات عامة
   ============================================================ */
const $  = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
const uid = (p) => (p || 'x') + '_' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const pad2 = (n) => String(n).padStart(2, '0');

function today() { const d = new Date(); return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
function dayShift(iso, n) { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
function fmtDay(iso) { try { return new Date(iso + 'T12:00:00').toLocaleDateString('ar-SA-u-ca-gregory', { weekday: 'long', day: 'numeric', month: 'long' }); } catch (e) { return iso; } }
function fmtShort(iso) { if (!iso) return '—'; try { return new Date(iso + 'T12:00:00').toLocaleDateString('ar-SA-u-ca-gregory', { day: 'numeric', month: 'short' }); } catch (e) { return iso; } }
function weekStart(iso) { const d = new Date((iso || today()) + 'T12:00:00'); const dow = d.getDay(); d.setDate(d.getDate() - ((dow + 1) % 7)); return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); } // الأسبوع يبدأ السبت
function minToLabel(m) { const h = Math.floor(m / 60), mm = m % 60; const ap = h < 12 ? 'ص' : 'م'; let h12 = h % 12; if (h12 === 0) h12 = 12; return h12 + ':' + pad2(mm) + ' ' + ap; }
function labelToMin(t) { const [h, m] = String(t).split(':').map(Number); return h * 60 + (m || 0); }
function ago(iso) {
  if (!iso) return '—';
  const diff = (Date.now() - new Date(iso).getTime()) / 86400000;
  if (diff < 0.04) return 'الآن';
  if (diff < 1) return 'اليوم';
  if (diff < 2) return 'أمس';
  if (diff < 30) return 'قبل ' + Math.floor(diff) + ' يوم';
  return fmtShort(String(iso).slice(0, 10));
}
function refreshIcons() { try { if (window.lucide) lucide.createIcons(); } catch (e) { } }

/* ============================================================
   الحالة الافتراضية — جوانب الحياة وأقسامها
   ============================================================ */
function sec(type, title, icon, config) { return { id: uid('sec'), type, title, icon: icon || 'circle', config: config || {}, items: [] }; }

function defaultAreas() {
  return [
    { id: 'health', name: 'الصحة الجسدية', icon: 'heart-pulse', color: '#e0635f', sections: [
        sec('habits', 'الرياضة', 'dumbbell'),
        sec('journal', 'التغذية', 'salad'),
        sec('metric', 'الوزن', 'scale', { unit: 'كجم', goal: '' }),
        sec('metric', 'القياسات', 'ruler', { unit: 'سم', goal: '' }),
        sec('checklist', 'الفيتامينات', 'pill', { daily: true }),
        sec('records', 'المواعيد الطبية', 'stethoscope', { fields: ['الجهة', 'الطبيب', 'السبب'] }),
        sec('records', 'التحاليل', 'flask-conical', { fields: ['نوع التحليل', 'النتيجة', 'رابط الملف'] }),
        sec('records', 'الإصابات', 'bandage', { fields: ['الموضع', 'الحالة'] }),
        sec('goals', 'الأهداف الصحية', 'target')
    ] },
    { id: 'mind', name: 'الصحة النفسية', icon: 'brain', color: '#7c8cf0', sections: [
        sec('metric', 'المزاج', 'smile', { unit: '/10', goal: '7' }),
        sec('metric', 'النوم', 'moon', { unit: 'ساعة', goal: '7' }),
        sec('journal', 'الامتنان', 'sparkles'),
        sec('habits', 'عادات الهدوء', 'wind'),
        sec('notes', 'ملاحظات', 'notebook-pen')
    ] },
    { id: 'worship', name: 'العبادة', icon: 'moon-star', color: '#2fae94', sections: [
        sec('prayers', 'الصلوات الخمس', 'moon-star'),
        sec('habits', 'الورد اليومي', 'book-open'),
        sec('metric', 'الحفظ', 'book-marked', { unit: 'صفحة', goal: '' }),
        sec('checklist', 'الأذكار', 'repeat', { daily: true }),
        sec('goals', 'أهداف إيمانية', 'target')
    ] },
    { id: 'work', name: 'العمل', icon: 'briefcase', color: '#5b8def', sections: [
        sec('tasks', 'مهام العمل', 'check-square'),
        sec('records', 'المشاريع', 'folder-kanban', { fields: ['الحالة', 'الموعد النهائي'] }),
        sec('records', 'الاجتماعات', 'users-round', { fields: ['مع من', 'الخلاصة'] }),
        sec('goals', 'أهداف مهنية', 'target')
    ] },
    { id: 'business', name: 'التجارة', icon: 'trending-up', color: '#d99b3c', sections: [
        sec('records', 'الفرص', 'lightbulb', { fields: ['الجهة', 'القيمة المتوقعة', 'الحالة'] }),
        sec('metric', 'الإيرادات', 'banknote', { unit: 'ر.س', goal: '' }),
        sec('tasks', 'مهام التجارة', 'check-square'),
        sec('goals', 'أهداف تجارية', 'target')
    ] },
    { id: 'content', name: 'صناعة المحتوى', icon: 'clapperboard', color: '#b06fd6', sections: [
        sec('journal', 'بنك الأفكار', 'lightbulb'),
        sec('records', 'خطة النشر', 'calendar-days', { fields: ['المنصة', 'التاريخ', 'الحالة'] }),
        sec('tasks', 'مهام الإنتاج', 'check-square'),
        sec('metric', 'المتابعون', 'users', { unit: '', goal: '' })
    ] },
    { id: 'learning', name: 'التعلم', icon: 'graduation-cap', color: '#3fa9c9', sections: [
        sec('records', 'الكتب', 'book', { fields: ['المؤلف', 'التقدّم', 'الحالة'] }),
        sec('records', 'الدورات', 'monitor-play', { fields: ['المنصة', 'التقدّم'] }),
        sec('habits', 'عادة القراءة', 'book-open-check'),
        sec('notes', 'خلاصات', 'notebook-pen')
    ] },
    { id: 'relations', name: 'العلاقات', icon: 'users', color: '#e08f6a', sections: [
        sec('records', 'الأشخاص المهمّون', 'contact', { fields: ['الصلة', 'آخر تواصل'] }),
        sec('checklist', 'تواصل هذا الأسبوع', 'phone', { daily: false }),
        sec('records', 'المناسبات', 'gift', { fields: ['المناسبة', 'التاريخ'] })
    ] },
    { id: 'money', name: 'المال', icon: 'wallet', color: '#43a67a', sections: [
        sec('metric', 'الدخل الشهري', 'arrow-down-left', { unit: 'ر.س', goal: '' }),
        sec('metric', 'المصروف الشهري', 'arrow-up-right', { unit: 'ر.س', goal: '' }),
        sec('records', 'الالتزامات والاشتراكات', 'receipt', { fields: ['المبلغ', 'الدورة', 'تاريخ التجديد'] }),
        sec('goals', 'أهداف الادخار', 'piggy-bank')
    ] },
    { id: 'fun', name: 'الترفيه', icon: 'gamepad-2', color: '#e0679e', sections: [
        sec('records', 'قائمة المشاهدة', 'clapperboard', { fields: ['النوع', 'الحالة'] }),
        sec('habits', 'هوايات', 'palette'),
        sec('journal', 'لحظات جميلة', 'camera')
    ] },
    { id: 'home', name: 'المنزل', icon: 'home', color: '#8a94a6', sections: [
        sec('tasks', 'مهام المنزل', 'check-square'),
        sec('records', 'الصيانة', 'wrench', { fields: ['الجهة', 'التكلفة'] }),
        sec('checklist', 'قائمة المشتريات', 'shopping-cart', { daily: false })
    ] },
    { id: 'travel', name: 'السفر', icon: 'plane', color: '#59b3c9', sections: [
        sec('records', 'الوجهات', 'map-pin', { fields: ['البلد', 'الموسم المناسب'] }),
        sec('records', 'خطط الرحلات', 'route', { fields: ['التاريخ', 'الميزانية'] }),
        sec('checklist', 'حقيبة السفر', 'luggage', { daily: false })
    ] }
  ];
}

function defaultWidgets() {
  return [
    { id: 'w_today',   type: 'today',   visible: true,  size: 'md' },
    { id: 'w_focus',   type: 'focus',   visible: true,  size: 'sm' },
    { id: 'w_capture', type: 'capture', visible: true,  size: 'sm' },
    { id: 'w_habits',  type: 'habits',  visible: true,  size: 'md' },
    { id: 'w_prayer',  type: 'prayer',  visible: true,  size: 'sm' },
    { id: 'w_weather', type: 'weather', visible: true,  size: 'sm' },
    { id: 'w_goals',   type: 'goals',   visible: true,  size: 'md' },
    { id: 'w_links',   type: 'links',   visible: true,  size: 'md' },
    { id: 'w_notes',   type: 'notes',   visible: false, size: 'sm' },
    { id: 'w_review',  type: 'review',  visible: false, size: 'sm' },
    { id: 'w_calendar',type: 'calendar',visible: false, size: 'md' }
  ];
}

function defaultState() {
  return {
    v: 1,
    profile: { name: 'سعد السيف', email: '', city: 'الرياض', country: 'Saudi Arabia', lat: 24.71, lon: 46.68, motto: 'إن مع العسر يسرا' },
    settings: {
      theme: 'auto', accent: '#5b6cf5', density: 'comfy',
      dayStart: '05:00', dayEnd: '24:00', slotMin: 30,
      wallpaper: '', ui: { sbW: 248, sbCollapsed: false }
    },
    areas: defaultAreas(),
    tasks: [],      // {id,title,areaId,goalId,status,priority,due,est,notes,createdAt,doneAt}
    blocks: [],     // {id,date,start,end,title,taskId,areaId,type,done,notes}
    priorities: {}, // {'YYYY-MM-DD':[{id,text,done}]}  ← أولويات اليوم الثلاث
    habits: { list: [], log: {} },  // log: {'YYYY-MM-DD':{habitId:true}}
    goals: [],      // {id,title,areaId,horizon,target,current,due,done}
    notes: [],      // {id,title,body,areaId,pinned,updatedAt}
    capture: [],    // {id,text,createdAt,done}
    reviews: {},    // {'YYYY-MM-DD':{win,drag,mood,energy,note}}
    prayerLog: {},  // {'YYYY-MM-DD':{Fajr:'mosque'|'ontime'|'late'}}
    widgets: defaultWidgets(),
    links: [
      { id: 'l1', label: 'ChatGPT',  url: 'https://chat.openai.com',    icon: 'message-circle' },
      { id: 'l2', label: 'Gmail',    url: 'https://mail.google.com',    icon: 'mail' },
      { id: 'l3', label: 'WhatsApp', url: 'https://web.whatsapp.com',   icon: 'message-square' },
      { id: 'l4', label: 'التقويم',  url: 'https://calendar.google.com',icon: 'calendar' },
      { id: 'l5', label: 'الملفات',  url: 'https://drive.google.com',   icon: 'folder' },
      { id: 'l6', label: 'Claude',   url: 'https://claude.ai',          icon: 'sparkles' }
    ],
    focus: { work: 25, brk: 5, goalMin: 120, log: {} },
    prayer: { method: 4 }
  };
}

let S = defaultState();

/* ============================================================
   التخزين والمزامنة
   ============================================================ */
function deepMerge(a, b) {
  for (const k in b) {
    if (b[k] && typeof b[k] === 'object' && !Array.isArray(b[k])) a[k] = deepMerge(a[k] || {}, b[k]);
    else a[k] = b[k];
  }
  return a;
}

function loadLocal() {
  try {
    const raw = localStorage.getItem(APP_KEY);
    S = raw ? deepMerge(defaultState(), JSON.parse(raw)) : defaultState();
  } catch (e) { S = defaultState(); }
  if (!Array.isArray(S.areas) || !S.areas.length) S.areas = defaultAreas();
  if (!Array.isArray(S.widgets) || !S.widgets.length) S.widgets = defaultWidgets();
  return S;
}

function save() {
  try { localStorage.setItem(APP_KEY, JSON.stringify(S)); } catch (e) { toast('تعذّر الحفظ محلياً — المساحة ممتلئة', 'bad'); }
  scheduleCloudSave();
}

function setSync(state, title) {
  const d = $('#syncDot'); if (!d) return;
  d.dataset.state = state; d.title = title || '';
}

function scheduleCloudSave() {
  if (!CLOUD_ON || !USER) return;
  setSync('busy', 'جارٍ الحفظ…');
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveCloud, 900);
}

async function saveCloud() {
  if (!CLOUD_ON || !USER || !STATE_ID) return;
  try {
    await sb.from('life_state').update({ data: S, updated_at: new Date().toISOString() }).eq('id', STATE_ID);
    setSync('ok', 'تمت المزامنة');
  } catch (e) { setSync('bad', 'تعذّرت المزامنة'); }
}

async function loadCloud() {
  const { data: rows, error } = await sb.from('life_state').select('*').limit(1);
  if (error) throw error;
  if (rows && rows.length) {
    STATE_ID = rows[0].id;
    S = deepMerge(defaultState(), rows[0].data || {});
    if (!S.areas || !S.areas.length) S.areas = defaultAreas();
  } else {
    const { data: ins, error: e2 } = await sb.from('life_state').insert({ data: S, owner: USER.id }).select('id').single();
    if (e2) throw e2;
    STATE_ID = ins.id;
  }
  setSync('ok', 'تمت المزامنة');
}

/* ============================================================
   المظهر
   ============================================================ */
function applyTheme() {
  const t = (S.settings && S.settings.theme) || 'auto';
  const dark = t === 'dark' || (t === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.documentElement.style.setProperty('--accent', S.settings.accent || '#5b6cf5');
  document.documentElement.dataset.density = S.settings.density || 'comfy';
  const wp = S.settings.wallpaper;
  document.body.style.backgroundImage = wp ? `url("${wp}")` : '';
  document.body.classList.toggle('has-wp', !!wp);
}
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if ((S.settings || {}).theme === 'auto') applyTheme(); });

/* ============================================================
   عناصر الواجهة المشتركة: نافذة، تنبيه، تأكيد
   ============================================================ */
function openModal(title, bodyHTML, footHTML, opts) {
  opts = opts || {};
  const root = $('#modalRoot');
  root.innerHTML = `
    <div class="modal-back" onclick="if(event.target===this)closeModal()">
      <div class="modal ${opts.wide ? 'wide' : ''}" role="dialog" aria-modal="true">
        <div class="modal-head">
          <h3>${esc(title)}</h3>
          <button class="icon-btn" onclick="closeModal()" aria-label="إغلاق"><i data-lucide="x"></i></button>
        </div>
        <div class="modal-body">${bodyHTML}</div>
        ${footHTML ? `<div class="modal-foot">${footHTML}</div>` : ''}
      </div>
    </div>`;
  refreshIcons();
  const f = root.querySelector('input,textarea,select'); if (f && !opts.noFocus) setTimeout(() => f.focus(), 60);
}
function closeModal() { $('#modalRoot').innerHTML = ''; }
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

let toastTimer = null;
function toast(msg, kind) {
  let t = $('#toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; document.body.appendChild(t); }
  t.className = 'show ' + (kind || '');
  t.textContent = msg;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.className = '', 2600);
}

function confirmBox(msg, onYes, okLabel) {
  openModal('تأكيد', `<p class="sm" style="margin:4px 0 0">${esc(msg)}</p>`,
    `<button class="btn ghost" onclick="closeModal()">إلغاء</button>
     <button class="btn danger" id="cfmYes">${esc(okLabel || 'حذف')}</button>`, { noFocus: true });
  const b = $('#cfmYes');
  if (b) b.onclick = () => { closeModal(); onYes(); };
}

/* اختصار: حقل نموذج */
function field(label, inner, hint) {
  return `<label class="field"><span>${esc(label)}</span>${inner}${hint ? `<em>${esc(hint)}</em>` : ''}</label>`;
}
function inputHTML(id, val, ph, type) { return `<input id="${id}" type="${type || 'text'}" value="${esc(val || '')}" placeholder="${esc(ph || '')}">`; }
function areaSelect(id, val, allowEmpty) {
  return `<select id="${id}">${allowEmpty ? `<option value="">— بلا جانب —</option>` : ''}${S.areas.map(a => `<option value="${a.id}" ${a.id === val ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}</select>`;
}
function areaById(id) { return S.areas.find(a => a.id === id) || null; }
function areaName(id) { const a = areaById(id); return a ? a.name : ''; }
function areaColor(id) { const a = areaById(id); return a ? a.color : 'var(--muted)'; }

/* لون بشفافية */
function hexA(h, al) {
  h = String(h || '#888').trim().replace('#', '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  const n = parseInt(h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${al})`;
}
