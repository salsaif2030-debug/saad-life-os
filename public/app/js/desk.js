/* ============================================================
   desk.js — المكتب: كل تطبيقات النظام في مكان واحد + تخصيص الخلفية
   ============================================================ */

/* صور الخلفيات المرفقة في public/app/wallpapers */
const WALLPAPERS = [
  { f: 'tahoe-dark.jpg',     name: 'تاهو الليلي' },
  { f: 'tahoe-blue.jpg',     name: 'تاهو الأزرق' },
  { f: 'tahoe-flow.jpg',     name: 'تاهو المتدفّق' },
  { f: 'tahoe-sunset.jpg',   name: 'غروب تاهو' },
  { f: 'sequoia-forest.jpg', name: 'غابة سيكويا' },
  { f: 'monterey-dark.jpg',  name: 'مونتيري الداكن' },
  { f: 'monterey-black.jpg', name: 'مونتيري الأسود' },
  { f: 'bigsur-color.jpg',   name: 'بيغ سور الملوّن' }
];
/* تدرّجات لونية — بلا تحميل صور، وأخفّ على الاتصال البطيء */
const WP_GRADIENTS = [
  { css: 'linear-gradient(150deg,#1b2a4a 0%,#3b1f4e 58%,#0d1220 100%)', name: 'ليل هادئ' },
  { css: 'linear-gradient(150deg,#f7ddc6 0%,#e8bcd6 55%,#c9d6f2 100%)', name: 'فجر' },
  { css: 'linear-gradient(150deg,#0f3d3e 0%,#1d5c4a 58%,#0a2422 100%)', name: 'زمرّد' },
  { css: 'linear-gradient(150deg,#2b1b3d 0%,#7b3f6e 55%,#1a1030 100%)', name: 'شفق' }
];
const LINK_COLORS = ['#5b8def', '#e0635f', '#2fae94', '#d99b3c', '#b06fd6', '#3fa9c9', '#e0679e', '#43a67a'];

/* الخلفية قد تكون صورة أو تدرّجاً — والتعتيم يُطبَّق طبقةً فوقها لتبقى الكتابة مقروءة */
function wpCSS(wp) { return /^(linear|radial)-gradient/.test(wp) ? wp : `url("${wp}")`; }

/* ---------- الخلفيات المتغيّرة ----------
   الاختيار محسوب من بذرة ثابتة (التاريخ/الساعة) لا عشوائياً في كل رسم،
   وإلا لرفّت الخلفية مع كل إعادة رسم للشاشة. */
const WP_ROTATE = [
  ['off',  'ثابتة — ما أختاره'],
  ['open', 'تتغيّر مع كل فتح للنظام'],
  ['hour', 'تتغيّر كل ساعة'],
  ['day',  'تتغيّر كل يوم'],
  ['time', 'تتبع وقت اليوم']
];
let WP_SESSION = '';
function wpSeedIndex(seed, len) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h % len;
}
function wpByTime() {
  const h = new Date().getHours();
  if (h < 5)  return './wallpapers/monterey-black.jpg';
  if (h < 11) return './wallpapers/tahoe-sunset.jpg';
  if (h < 16) return './wallpapers/tahoe-blue.jpg';
  if (h < 19) return './wallpapers/bigsur-color.jpg';
  return './wallpapers/tahoe-dark.jpg';
}
function effectiveWallpaper() {
  const mode = (S.settings || {}).wpRotate || 'off';
  if (mode === 'off') return S.settings.wallpaper || '';
  if (mode === 'time') return wpByTime();
  if (mode === 'open') {
    if (!WP_SESSION) WP_SESSION = './wallpapers/' + WALLPAPERS[Math.floor(Math.random() * WALLPAPERS.length)].f;
    return WP_SESSION;
  }
  const seed = mode === 'hour' ? today() + '-' + new Date().getHours() : today();
  return './wallpapers/' + WALLPAPERS[wpSeedIndex(seed, WALLPAPERS.length)].f;
}

/* ---------- تطبيقات النظام ---------- */
function deskScreens() {
  return [
    { t: 'الرئيسية',        i: 'layout-dashboard', c: '#5b6cf5', a: "go('dashboard')" },
    { t: 'تخطيط اليوم',     i: 'calendar-clock',   c: '#4a7ef0', a: "go('timebox')" },
    { t: 'المهام',          i: 'check-square',     c: '#2fae94', a: "go('tasks')" },
    { t: 'العمل',           i: 'briefcase',        c: '#5b8def', a: "go('work')" },
    { t: 'التجارة',         i: 'trending-up',      c: '#d99b3c', a: "go('business')" },
    { t: 'المساحة الحرة',   i: 'layout-template',  c: '#b06fd6', a: "go('canvas','')" },
    { t: 'الملاحظات',       i: 'notebook-pen',     c: '#e0a03c', a: "go('notes')" },
    { t: 'مراجعة اليوم',    i: 'moon',             c: '#7c8cf0', a: "go('daily')" },
    { t: 'المراجعة الأسبوعية', i: 'line-chart',    c: '#3fa9c9', a: "go('review')" },
    { t: 'الإعدادات',       i: 'settings',         c: '#8a94a6', a: "go('settings')" }
  ];
}

function deskTile(app) {
  const ic = `<span class="ic" style="background:linear-gradient(160deg,color-mix(in srgb,${app.c} 58%,#fff),${app.c})">
    <i data-lucide="${esc(app.i)}"></i></span>`;
  return app.url
    ? `<a class="desk-app" href="${esc(app.url)}" target="_blank" rel="noopener">${ic}<span class="lb">${esc(app.t)}</span></a>`
    : `<button class="desk-app" onclick="${app.a}">${ic}<span class="lb">${esc(app.t)}</span></button>`;
}
function deskGroup(title, apps) {
  if (!apps.length) return '';
  return `<h2 class="desk-h">${esc(title)}</h2><div class="desk-grid">${apps.map(deskTile).join('')}</div>`;
}

function renderDesk() {
  const areas = S.areas.filter(a => !a.hidden).map(a => ({ t: a.name, i: a.icon, c: a.color, a: `go('area','${a.id}')` }));
  const tools = (S.links || []).map((l, i) => ({ t: l.label, i: l.icon || 'link', c: LINK_COLORS[i % LINK_COLORS.length], url: l.url }));

  $('#view').innerHTML = `
    <div class="page-head">
      <div><h1 class="serif">المكتب</h1>
        <div class="sub">كل تطبيقات النظام في مكان واحد — اختر تطبيقاً للدخول إليه.</div></div>
      <div class="row">
        <button class="btn ghost" onclick="wallpaperModal()"><i data-lucide="image"></i> تخصيص الخلفية</button>
        <button class="btn ghost xs" onclick="editLinks()"><i data-lucide="pencil"></i> أدواتي</button>
      </div>
    </div>
    ${deskGroup('شاشات النظام', deskScreens())}
    ${deskGroup('جوانب حياتي', areas)}
    ${deskGroup('أدواتي', tools)}`;
  refreshIcons();
}

/* ---------- تخصيص الخلفية ---------- */
function wallpaperModal() {
  const st = S.settings, cur = st.wallpaper || '', rot = st.wpRotate || 'off';
  const cell = (val, name, style) => `
    <button class="wp-cell ${rot === 'off' && cur === val ? 'on' : ''}" onclick="setWallpaper('${val.replace(/'/g, "\\'")}')" title="${esc(name)}">
      <span class="th" style="${style}"></span><span class="nm">${esc(name)}</span></button>`;

  openModal('خلفية الواجهة',
    `<div class="wp-grid">
       ${cell('', 'بلا خلفية', 'background:var(--surface2);border:1px dashed var(--line2)')}
       ${WP_GRADIENTS.map(g => cell(g.css, g.name, `background:${g.css}`)).join('')}
       ${WALLPAPERS.map(w => cell('./wallpapers/' + w.f, w.name, `background-image:url("./wallpapers/${w.f}");background-size:cover;background-position:center`)).join('')}
     </div>
     ${rot !== 'off' ? `<p class="tiny muted" style="margin:-4px 0 14px">التبديل التلقائي يعمل الآن، فاختيارك اليدوي معطّل حتى توقفه.</p>` : ''}
     ${field('التبديل التلقائي', `<select id="wpRot" onchange="setWpRotate(this.value)">
        ${WP_ROTATE.map(([v, l]) => `<option value="${v}" ${rot === v ? 'selected' : ''}>${l}</option>`).join('')}</select>`)}
     ${field('الوضع الزجاجي', `<select id="wpGlass" onchange="setGlass(this.value==='1')">
        <option value="0" ${st.glass ? '' : 'selected'}>مصمت — بطاقات معتمة</option>
        <option value="1" ${st.glass ? 'selected' : ''}>زجاجي — البطاقات تُظهر الخلفية خلفها</option></select>`,
        'يظهر أثره حين تكون هناك خلفية')}
     ${field('تعتيم الخلفية', `<input id="wpDim" type="range" min="0" max="80" step="5" value="${+st.wpDim || 0}"
        oninput="setWpDim(this.value)" style="padding:0">`, 'ارفعه إن كانت الخلفية تُتعب قراءة النصوص')}
     ${field('خلفية من عندك', `<input id="wpUrl" type="url" placeholder="https://…" value="${esc(/^\.\/wallpapers|^(linear|radial)-gradient/.test(cur) ? '' : cur)}"
        onchange="setWallpaper(this.value.trim())">`, 'الصق رابط أي صورة')}`,
    `<button class="btn primary" onclick="closeModal()">تم</button>`, { wide: true, noFocus: true });
}
function setWallpaper(v) {
  S.settings.wallpaper = v;
  S.settings.wpRotate = 'off';        // اختيار يدوي يوقف التبديل التلقائي
  save(); applyTheme(); wallpaperModal();
}
function setWpRotate(v) { S.settings.wpRotate = v; WP_SESSION = ''; save(); applyTheme(); wallpaperModal(); }
function setWpDim(v) { S.settings.wpDim = +v || 0; save(); applyTheme(); }
function setGlass(on) { S.settings.glass = !!on; save(); applyTheme(); }
