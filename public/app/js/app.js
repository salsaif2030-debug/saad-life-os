/* ============================================================
   app.js — التوجيه، اللوحة الرئيسية، المراجعة، الإعدادات، الإقلاع
   ============================================================ */

const ROUTES = {
  dashboard: renderDashboard,
  timebox:   renderTimebox,
  tasks:     renderTasks,
  area:      renderArea,
  notes:     renderNotes,
  review:    renderReview,
  settings:  renderSettings
};
const TITLES = { dashboard: 'الرئيسية', timebox: 'تخطيط اليوم', tasks: 'المهام', notes: 'الملاحظات', review: 'المراجعة الأسبوعية', settings: 'الإعدادات' };

function go(view, arg) {
  CUR = view; CUR_ARG = arg || null;
  location.hash = view + (arg ? '/' + arg : '');
  $('#ctTitle').textContent = view === 'area' ? (areaName(arg) || 'جانب') : (TITLES[view] || '');
  $$('#nav a, #navFoot a').forEach(el => el.classList.toggle('active', el.dataset.v === (view === 'area' ? 'area:' + arg : view)));
  (ROUTES[view] || renderDashboard)(arg);
  $('#sidebar').classList.remove('open');
  const sc = $('.scrim'); if (sc) sc.remove();
  window.scrollTo({ top: 0 });
}
function render() { (ROUTES[CUR] || renderDashboard)(CUR_ARG); }

/* ============================================================
   القائمة الجانبية
   ============================================================ */
function renderNav() {
  const openT = (S.tasks || []).filter(t => t.status !== 'done').length;
  const inbox = (S.capture || []).filter(c => !c.done).length;
  $('#nav').innerHTML = `
    <a data-v="dashboard" onclick="go('dashboard')"><i data-lucide="layout-dashboard"></i> الرئيسية</a>
    <a data-v="timebox" onclick="go('timebox')"><i data-lucide="calendar-clock"></i> تخطيط اليوم</a>
    <a data-v="tasks" onclick="go('tasks')"><i data-lucide="check-square"></i> المهام ${openT ? `<span class="cnt">${openT}</span>` : ''}</a>
    <a data-v="notes" onclick="go('notes')"><i data-lucide="notebook-pen"></i> الملاحظات ${inbox ? `<span class="cnt">${inbox}</span>` : ''}</a>
    <a data-v="review" onclick="go('review')"><i data-lucide="line-chart"></i> المراجعة</a>
    <div class="navsec">جوانب الحياة</div>
    ${S.areas.filter(a => !a.hidden).map(a => `<a data-v="area:${a.id}" onclick="go('area','${a.id}')">
      <i data-lucide="${esc(a.icon)}" style="color:${a.color}"></i> ${esc(a.name)}</a>`).join('')}
    <a onclick="areaModal()" style="color:var(--muted)"><i data-lucide="plus"></i> جانب جديد</a>`;
  $('#navFoot').innerHTML = `
    <a onclick="customizeWidgets()"><i data-lucide="layout-grid"></i> تخصيص اللوحة</a>
    <a data-v="settings" onclick="go('settings')"><i data-lucide="settings"></i> الإعدادات</a>
    ${CLOUD_ON ? `<a onclick="logout()"><i data-lucide="log-out"></i> خروج</a>` : ''}`;
  refreshIcons();
}
function toggleSidebar() {
  const sb = $('#sidebar');
  if (innerWidth <= 900) {
    sb.classList.toggle('open');
    if (sb.classList.contains('open')) {
      const sc = document.createElement('div'); sc.className = 'scrim'; sc.onclick = () => { sb.classList.remove('open'); sc.remove(); };
      document.body.appendChild(sc);
    } else { const sc = $('.scrim'); if (sc) sc.remove(); }
  } else {
    $('#appShell').classList.toggle('collapsed');
    S.settings.ui.sbCollapsed = $('#appShell').classList.contains('collapsed'); save();
  }
}
function toggleTheme() {
  const cur = document.documentElement.dataset.theme;
  S.settings.theme = cur === 'dark' ? 'light' : 'dark';
  save(); applyTheme();
}

/* ============================================================
   اللوحة الرئيسية
   ============================================================ */
function greeting() {
  const h = new Date().getHours();
  if (h < 5) return 'ليلة هادئة';
  if (h < 12) return 'صباح الخير';
  if (h < 17) return 'مساء الخير';
  if (h < 21) return 'مساء الخير';
  return 'مساء الخير';
}
function renderDashboard() {
  const name = (S.profile.name || '').split(' ')[0];
  $('#view').innerHTML = `
    <div class="page-head">
      <div>
        <h1 class="serif">${greeting()}${name ? '، ' + esc(name) : ''}</h1>
        <div class="sub">${esc(S.profile.motto || '')}</div>
      </div>
      <div class="row">
        <button class="btn ghost" onclick="go('timebox')"><i data-lucide="calendar-clock"></i> خطّط يومك</button>
        <button class="btn primary" onclick="quickCapture()"><i data-lucide="plus"></i> التقاط</button>
      </div>
    </div>
    ${widgetsHTML()}
    <div class="between" style="margin:6px 0 14px">
      <h2 style="font-size:17px">جوانب حياتي</h2>
      <button class="btn ghost xs" onclick="areaModal()"><i data-lucide="plus"></i> جانب</button>
    </div>
    <div class="areas-grid" id="areasGrid">${S.areas.filter(a => !a.hidden).map(areaCardHTML).join('')}</div>`;
  refreshIcons();
  initWidgetDrag();
}

/* ============================================================
   الملاحظات + صندوق الوارد
   ============================================================ */
function renderNotes() {
  const inbox = (S.capture || []).filter(c => !c.done);
  $('#view').innerHTML = `
    <div class="page-head"><div><h1>الملاحظات</h1><div class="sub">صندوق الوارد وما دوّنته</div></div>
      <button class="btn primary" onclick="noteModal()"><i data-lucide="plus"></i> ملاحظة</button></div>
    ${inbox.length ? `<section class="card pad" style="margin-bottom:var(--gap)">
      <div class="between" style="margin-bottom:10px"><h3 style="font-size:15px"><i data-lucide="inbox"></i> صندوق الوارد (${inbox.length})</h3>
        <span class="tiny muted">حوّلها لمهام أو ملاحظات ثم أفرغ الصندوق</span></div>
      <div class="list">${inbox.map(c => `<div class="item">
        <span class="cbox" onclick="captureDone('${c.id}');render()"></span>
        <div class="t"><b>${esc(c.text)}</b><span class="tiny muted">${ago(c.createdAt)}</span></div>
        <span class="acts">
          <button class="icon-btn" onclick="captureToTask('${c.id}')" title="حوّل لمهمة"><i data-lucide="check-square"></i></button>
          <button class="icon-btn" onclick="captureToNote('${c.id}')" title="حوّل لملاحظة"><i data-lucide="notebook-pen"></i></button>
        </span></div>`).join('')}</div></section>` : ''}
    ${(S.notes || []).length ? `<div class="sec-grid">${S.notes.map(n => `
      <article class="sec" onclick="noteModal(S.notes.find(x=>x.id==='${n.id}'))" style="cursor:pointer">
        <div class="sh"><i data-lucide="${n.pinned ? 'pin' : 'file-text'}"></i><h3>${esc(n.title || 'بلا عنوان')}</h3></div>
        <p class="sm muted" style="white-space:pre-wrap;max-height:120px;overflow:hidden">${esc((n.body || '').slice(0, 300))}</p>
        <div class="tiny muted" style="margin-top:9px">${n.areaId ? esc(areaName(n.areaId)) + ' · ' : ''}${ago(n.updatedAt)}</div>
      </article>`).join('')}</div>`
      : `<div class="card pad empty"><i data-lucide="notebook-pen"></i><p>لا ملاحظات بعد.</p></div>`}`;
  refreshIcons();
}
function captureToNote(id) {
  const c = S.capture.find(x => x.id === id); if (!c) return;
  c.done = true; S.notes.unshift({ id: uid('n'), title: c.text.slice(0, 40), body: c.text, areaId: '', pinned: false, updatedAt: new Date().toISOString() });
  save(); render(); toast('حُوّلت لملاحظة');
}

/* ============================================================
   المراجعة الأسبوعية
   ============================================================ */
function renderReview() {
  const days = []; for (let i = 6; i >= 0; i--) days.push(dayShift(today(), -i));
  const habits = (S.habits.list || []).filter(h => !h.archived);
  const doneTasks = (S.tasks || []).filter(t => t.doneAt && t.doneAt.slice(0, 10) >= days[0]).length;
  const focusMin = days.reduce((a, d) => a + ((S.focus.log || {})[d] || 0), 0);
  const plannedMin = (S.blocks || []).filter(b => days.includes(b.date)).reduce((a, b) => a + (b.end - b.start), 0);
  const moods = days.map(d => (S.reviews[d] || {}).mood || 0);

  const areaMin = {};
  (S.blocks || []).filter(b => days.includes(b.date)).forEach(b => { const k = b.areaId || '_'; areaMin[k] = (areaMin[k] || 0) + (b.end - b.start); });
  const areaRank = Object.entries(areaMin).sort((a, b) => b[1] - a[1]);
  const maxA = areaRank.length ? areaRank[0][1] : 1;

  $('#view').innerHTML = `
    <div class="page-head"><div><h1>المراجعة الأسبوعية</h1>
      <div class="sub">${fmtShort(days[0])} — ${fmtShort(days[6])}</div></div>
      <button class="btn primary" onclick="reviewModal()"><i data-lucide="moon"></i> مراجعة اليوم</button></div>

    <div class="widgets" style="margin-bottom:var(--gap)">
      ${statCard('مهام مُنجزة', doneTasks, 'check-check')}
      ${statCard('ساعات مخطَّطة', Math.round(plannedMin / 60 * 10) / 10, 'calendar-clock')}
      ${statCard('دقائق تركيز', focusMin, 'timer')}
      ${statCard('الصلوات في وقتها', prayerWeekPct() + '٪', 'moon-star')}
    </div>

    <div class="sec-grid">
      <section class="sec">
        <div class="sh"><i data-lucide="repeat"></i><h3>العادات — آخر ٧ أيام</h3></div>
        ${habits.length ? `<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12.5px">
          <tr><th></th>${days.map(d => `<th class="tiny muted" style="font-weight:600;padding:4px">${new Date(d + 'T12:00:00').toLocaleDateString('ar', { weekday: 'narrow' })}</th>`).join('')}</tr>
          ${habits.map(h => `<tr><td style="padding:5px 4px;white-space:nowrap">${esc(h.name)}</td>
            ${days.map(d => `<td style="text-align:center;padding:4px">
              <span onclick="habitToggle('${h.id}','${d}')" style="display:inline-block;width:16px;height:16px;border-radius:5px;cursor:pointer;
                background:${(S.habits.log[d] || {})[h.id] ? 'var(--accent)' : 'var(--surface3)'}"></span></td>`).join('')}</tr>`).join('')}
        </table></div>` : emptySec('لا عادات بعد.')}
      </section>

      <section class="sec">
        <div class="sh"><i data-lucide="pie-chart"></i><h3>أين ذهب وقتي</h3></div>
        ${areaRank.length ? areaRank.map(([k, m]) => `
          <div style="margin-bottom:9px">
            <div class="between tiny"><span>${k === '_' ? 'بلا جانب' : esc(areaName(k))}</span><span class="muted">${Math.round(m / 60 * 10) / 10} س</span></div>
            <div style="height:5px;border-radius:3px;background:var(--surface3);margin-top:4px">
              <i style="display:block;height:100%;width:${Math.round(m / maxA * 100)}%;background:${k === '_' ? 'var(--muted)' : areaColor(k)};border-radius:3px"></i></div>
          </div>`).join('') : emptySec('لم تُخطّط كتلاً هذا الأسبوع.')}
      </section>

      <section class="sec">
        <div class="sh"><i data-lucide="smile"></i><h3>المزاج والطاقة</h3></div>
        ${moods.some(m => m) ? `<div class="sparkline" style="height:60px">${moods.map(m => `<i style="height:${m ? m / 5 * 100 : 4}%"></i>`).join('')}</div>
          <div class="between tiny muted"><span>${fmtShort(days[0])}</span><span>${fmtShort(days[6])}</span></div>`
        : emptySec('سجّل مراجعة يومية ليظهر لك الاتجاه.')}
      </section>

      <section class="sec">
        <div class="sh"><i data-lucide="book-open"></i><h3>مراجعات الأيام</h3></div>
        ${days.slice().reverse().filter(d => S.reviews[d]).map(d => {
          const r = S.reviews[d];
          return `<div class="rec" onclick="reviewModal('${d}')" style="cursor:pointer">
            <div class="between"><b>${fmtShort(d)}</b><span class="tiny muted">مزاج ${r.mood}/5</span></div>
            <div class="kv">${esc(r.win || '—')}</div></div>`;
        }).join('') || emptySec('لا مراجعات هذا الأسبوع.')}
      </section>
    </div>`;
  refreshIcons();
}
function statCard(label, val, icon) {
  return `<section class="widget sm"><div class="wh"><i data-lucide="${icon}"></i><span>${esc(label)}</span></div>
    <div class="big">${esc(String(val))}</div></section>`;
}

/* ============================================================
   الإعدادات
   ============================================================ */
const ACCENTS = ['#5b6cf5', '#2fae94', '#e0635f', '#d99b3c', '#b06fd6', '#3fa9c9', '#43a67a', '#e0679e', '#8a94a6'];
function renderSettings() {
  const p = S.profile, st = S.settings;
  $('#view').innerHTML = `
    <div class="page-head"><div><h1>الإعدادات</h1><div class="sub">اضبط النظام على مقاسك</div></div></div>
    <div class="sec-grid">

      <section class="sec">
        <div class="sh"><i data-lucide="user"></i><h3>الملف الشخصي</h3></div>
        ${field('الاسم', inputHTML('sp_name', p.name, ''))}
        ${field('شعارك اليومي', inputHTML('sp_motto', p.motto, 'جملة تراها كل صباح'))}
        ${field('المدينة', inputHTML('sp_city', p.city, 'الرياض'))}
        <button class="btn primary xs" onclick="saveProfile()">حفظ</button>
      </section>

      <section class="sec">
        <div class="sh"><i data-lucide="palette"></i><h3>المظهر</h3></div>
        ${field('الوضع', `<select id="s_theme" onchange="S.settings.theme=this.value;save();applyTheme()">
          ${[['auto', 'حسب النظام'], ['light', 'فاتح'], ['dark', 'داكن']].map(([v, l]) => `<option value="${v}" ${st.theme === v ? 'selected' : ''}>${l}</option>`).join('')}</select>`)}
        ${field('لون التمييز', `<div class="row" style="gap:7px;flex-wrap:wrap">
          ${ACCENTS.map(c => `<button onclick="setAccent('${c}')" style="width:28px;height:28px;border-radius:50%;background:${c};border:2px solid ${st.accent === c ? 'var(--ink)' : 'transparent'}"></button>`).join('')}</div>`)}
        ${field('الكثافة', `<select id="s_dens" onchange="S.settings.density=this.value;save();applyTheme()">
          ${[['comfy', 'مريحة'], ['compact', 'مضغوطة']].map(([v, l]) => `<option value="${v}" ${st.density === v ? 'selected' : ''}>${l}</option>`).join('')}</select>`)}
        ${field('خلفية الشاشة', `<select id="s_wp" onchange="S.settings.wallpaper=this.value;save();applyTheme()">
          <option value="">بلا خلفية (أنقى)</option>
          ${['tahoe-dark', 'tahoe-blue', 'tahoe-flow', 'tahoe-sunset', 'sequoia-forest', 'monterey-dark', 'monterey-black', 'bigsur-color']
            .map(w => `<option value="./wallpapers/${w}.jpg" ${st.wallpaper === './wallpapers/' + w + '.jpg' ? 'selected' : ''}>${w}</option>`).join('')}</select>`)}
      </section>

      <section class="sec">
        <div class="sh"><i data-lucide="calendar-clock"></i><h3>تخطيط اليوم</h3></div>
        <div class="grid2">
          ${field('بداية اليوم', `<input id="s_ds" type="time" value="${st.dayStart}">`)}
          ${field('نهاية اليوم', `<input id="s_de" type="time" value="${st.dayEnd === '24:00' ? '23:59' : st.dayEnd}">`)}
        </div>
        ${field('طول الفترة', `<select id="s_slot">${[15, 30, 60].map(v => `<option value="${v}" ${+st.slotMin === v ? 'selected' : ''}>${v} دقيقة</option>`).join('')}</select>`)}
        <button class="btn primary xs" onclick="saveDaySettings()">حفظ</button>
      </section>

      <section class="sec">
        <div class="sh"><i data-lucide="database"></i><h3>البيانات والمزامنة</h3></div>
        <p class="sm muted" style="margin-bottom:12px">
          ${CLOUD_ON ? (USER ? `متصل بالسحابة باسم <b>${esc(USER.email)}</b> — كل تغيير يُحفظ تلقائياً.` : 'غير مسجّل دخول.')
            : 'وضع محلي: البيانات محفوظة في هذا المتصفح فقط. لتفعيل المزامنة عبر أجهزتك، اربط مشروع Supabase (انظر README).'}
        </p>
        <div class="row" style="gap:7px;flex-wrap:wrap">
          <button class="btn ghost xs" onclick="exportData()"><i data-lucide="download"></i> تصدير نسخة</button>
          <button class="btn ghost xs" onclick="$('#impFile').click()"><i data-lucide="upload"></i> استيراد</button>
          <input type="file" id="impFile" accept="application/json" class="hidden" onchange="importData(this)">
          <button class="btn ghost xs" style="color:var(--bad)" onclick="resetAll()"><i data-lucide="trash-2"></i> تصفير النظام</button>
        </div>
      </section>

      <section class="sec">
        <div class="sh"><i data-lucide="layout-grid"></i><h3>الجوانب والويدجتس</h3></div>
        <div class="row" style="gap:7px;flex-wrap:wrap;margin-bottom:12px">
          <button class="btn ghost xs" onclick="customizeWidgets()">تخصيص اللوحة</button>
          <button class="btn ghost xs" onclick="areaModal()">جانب جديد</button>
        </div>
        <div class="list">${S.areas.map(a => `<div class="item" style="padding:6px 0">
          <i data-lucide="${esc(a.icon)}" style="width:15px;height:15px;color:${a.color}"></i>
          <div class="t sm">${esc(a.name)}${a.hidden ? ' <span class="tiny muted">(مخفي)</span>' : ''}</div>
          <button class="icon-btn" onclick="areaModal('${a.id}')"><i data-lucide="pencil"></i></button></div>`).join('')}</div>
      </section>

      <section class="sec">
        <div class="sh"><i data-lucide="keyboard"></i><h3>اختصارات</h3></div>
        <div class="list sm">
          ${[['⌘K / Ctrl+K', 'بحث وتنقّل سريع'], ['N', 'مهمة جديدة'], ['C', 'التقاط سريع'], ['T', 'تخطيط اليوم'], ['D', 'الرئيسية']]
            .map(([k, l]) => `<div class="item" style="padding:5px 0"><div class="t">${l}</div><span class="chip">${k}</span></div>`).join('')}
        </div>
      </section>
    </div>`;
  refreshIcons();
}
function setAccent(c) { S.settings.accent = c; save(); applyTheme(); render(); }
function saveProfile() {
  S.profile.name = $('#sp_name').value.trim();
  S.profile.motto = $('#sp_motto').value.trim();
  S.profile.city = $('#sp_city').value.trim();
  save(); PRAYER.date = ''; WX.day = ''; toast('حُفظ', 'good');
}
function saveDaySettings() {
  S.settings.dayStart = $('#s_ds').value || '05:00';
  S.settings.dayEnd = $('#s_de').value || '23:59';
  S.settings.slotMin = +$('#s_slot').value || 30;
  save(); toast('حُفظ', 'good');
}
function exportData() {
  const blob = new Blob([JSON.stringify(S, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = 'life-os-' + today() + '.json'; a.click();
  toast('نُزّلت النسخة', 'good');
}
function importData(input) {
  const f = input.files[0]; if (!f) return;
  const r = new FileReader();
  r.onload = () => {
    try {
      S = deepMerge(defaultState(), JSON.parse(r.result));
      save(); renderNav(); applyTheme(); go('dashboard'); toast('استُوردت البيانات', 'good');
    } catch (e) { toast('ملف غير صالح', 'bad'); }
  };
  r.readAsText(f);
}
function resetAll() {
  openModal('تصفير النظام', `<p class="sm">سيُحذف كل شيء: الجوانب، المهام، الكتل، العادات، الملاحظات. لا يمكن التراجع.</p>
    <p class="tiny muted" style="margin-top:8px">صدّر نسخة احتياطية أولاً إن أردت.</p>`,
    `<button class="btn ghost" onclick="closeModal()">تراجع</button><button class="btn danger" onclick="resetYes()">احذف كل شيء</button>`);
}
function resetYes() { S = defaultState(); save(); closeModal(); renderNav(); applyTheme(); go('dashboard'); toast('تم التصفير'); }

/* ============================================================
   البحث والتنقّل السريع (⌘K)
   ============================================================ */
function openPalette() {
  $('#paletteRoot').innerHTML = `
    <div class="palette" onclick="if(event.target===this)closePalette()">
      <div class="box">
        <input id="pq" placeholder="ابحث عن مهمة، جانب، ملاحظة… أو اكتب أمراً" oninput="paletteSearch()" onkeydown="paletteKey(event)">
        <div class="res" id="pres"></div>
      </div></div>`;
  paletteSearch(); $('#pq').focus();
}
function closePalette() { $('#paletteRoot').innerHTML = ''; }
function paletteItems(q) {
  q = (q || '').trim().toLowerCase();
  const out = [];
  const cmds = [
    { t: 'الرئيسية', i: 'layout-dashboard', a: () => go('dashboard') },
    { t: 'تخطيط اليوم', i: 'calendar-clock', a: () => go('timebox') },
    { t: 'المهام', i: 'check-square', a: () => go('tasks') },
    { t: 'المراجعة الأسبوعية', i: 'line-chart', a: () => go('review') },
    { t: 'مهمة جديدة', i: 'plus', a: () => taskModal() },
    { t: 'التقاط سريع', i: 'inbox', a: () => quickCapture() },
    { t: 'مراجعة اليوم', i: 'moon', a: () => reviewModal() },
    { t: 'الإعدادات', i: 'settings', a: () => go('settings') }
  ];
  cmds.filter(c => !q || c.t.toLowerCase().includes(q)).forEach(c => out.push(c));
  S.areas.filter(a => !q || a.name.toLowerCase().includes(q)).forEach(a => out.push({ t: a.name, i: a.icon, k: 'جانب', a: () => go('area', a.id) }));
  if (q) {
    (S.tasks || []).filter(t => t.title.toLowerCase().includes(q)).slice(0, 6).forEach(t => out.push({ t: t.title, i: 'check-square', k: 'مهمة', a: () => taskModal(t) }));
    (S.notes || []).filter(n => (n.title + n.body).toLowerCase().includes(q)).slice(0, 5).forEach(n => out.push({ t: n.title || 'ملاحظة', i: 'notebook-pen', k: 'ملاحظة', a: () => noteModal(n) }));
  }
  return out.slice(0, 12);
}
let PSEL = 0, PITEMS = [];
function paletteSearch() {
  PITEMS = paletteItems($('#pq').value); PSEL = 0;
  $('#pres').innerHTML = PITEMS.length ? PITEMS.map((it, i) => `<a onclick="paletteRun(${i})" class="${i === 0 ? 'sel' : ''}">
      <i data-lucide="${esc(it.i)}"></i><span>${esc(it.t)}</span>${it.k ? `<span class="k">${it.k}</span>` : ''}</a>`).join('')
    : `<div class="empty tiny">لا نتائج</div>`;
  refreshIcons();
}
function paletteRun(i) { const it = PITEMS[i]; if (!it) return; closePalette(); it.a(); }
function paletteKey(e) {
  if (e.key === 'Escape') return closePalette();
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    PSEL = clamp(PSEL + (e.key === 'ArrowDown' ? 1 : -1), 0, PITEMS.length - 1);
    $$('#pres a').forEach((a, i) => a.classList.toggle('sel', i === PSEL));
  }
  if (e.key === 'Enter') paletteRun(PSEL);
}

/* اختصارات لوحة المفاتيح */
document.addEventListener('keydown', e => {
  const typing = /input|textarea|select/i.test((e.target.tagName || ''));
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openPalette(); return; }
  if (typing || e.metaKey || e.ctrlKey || !USER_READY) return;
  const k = e.key.toLowerCase();
  if (k === 'n') { e.preventDefault(); taskModal(); }
  else if (k === 'c') { e.preventDefault(); quickCapture(); }
  else if (k === 't') go('timebox');
  else if (k === 'd') go('dashboard');
});

/* ============================================================
   المصادقة والإقلاع
   ============================================================ */
let USER_READY = false;
function lerr(m) { $('#loginErr').textContent = m || ''; }
function lmsg(m) { $('#loginMsg').textContent = m || ''; }

async function doLogin() {
  const em = $('#em').value.trim().toLowerCase(), pw = $('#pw').value;
  if (!em || !pw) { lerr('اكتب البريد وكلمة المرور.'); return; }
  lerr(''); lmsg('جارٍ الدخول…');
  const { data, error } = await sb.auth.signInWithPassword({ email: em, password: pw });
  if (error) { lmsg(''); lerr(/invalid login/i.test(error.message) ? 'البريد أو كلمة المرور غير صحيحة.' : error.message); return; }
  await enterApp(data.user);
}
async function doSignup() {
  const em = $('#em').value.trim().toLowerCase(), pw = $('#pw').value;
  if (!em) { lerr('اكتب بريدك.'); return; }
  if (pw.length < 8) { lerr('كلمة المرور ٨ أحرف على الأقل.'); return; }
  lerr(''); lmsg('جارٍ إنشاء الحساب…');
  const { data, error } = await sb.auth.signUp({ email: em, password: pw, options: { emailRedirectTo: location.origin + location.pathname } });
  if (error) { lmsg(''); lerr(error.message); return; }
  if (data.session) await enterApp(data.user);
  else lmsg('تم الإنشاء — أكّد بريدك من الرسالة ثم ادخل.');
}
async function logout() { if (sb) await sb.auth.signOut(); location.reload(); }

async function enterApp(user) {
  USER = user;
  lmsg('جارٍ تحميل بياناتك…');
  try { await loadCloud(); } catch (e) { lmsg(''); lerr('تعذّر تحميل البيانات: ' + e.message); return; }
  boot();
}

function boot() {
  USER_READY = true;
  $('#loginView').classList.add('hidden');
  $('#appShell').classList.remove('hidden');
  $('#fab').classList.remove('hidden');
  applyTheme();
  if (S.settings.ui.sbCollapsed && innerWidth > 900) $('#appShell').classList.add('collapsed');
  $('#brandName').textContent = 'نظام ' + ((S.profile.name || 'سعد').split(' ')[0]);
  $('#ctDate').textContent = new Date().toLocaleDateString('ar-SA-u-ca-gregory', { weekday: 'long', day: 'numeric', month: 'long' });
  renderNav();
  const h = (location.hash || '').replace('#', '').split('/');
  if (h[0] && ROUTES[h[0]]) go(h[0], h[1]); else go('dashboard');
  try { if (window.Notification && Notification.permission === 'default') Notification.requestPermission(); } catch (e) { }
  setInterval(() => { if (CUR === 'dashboard') { repaintWidget('today'); repaintWidget('prayer'); } }, 60000);
}

(async function start() {
  loadLocal();
  applyTheme();
  if (!CLOUD_ON) { boot(); return; }
  $('#loginView').classList.remove('hidden');
  const { data } = await sb.auth.getSession();
  if (data && data.session) await enterApp(data.session.user);
})();
