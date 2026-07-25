/* ============================================================
   widgets.js — لوحة الويدجتس القابلة للترتيب والإخفاء
   ============================================================ */

const WIDGET_DEFS = {
  today:    { name: 'يومي الآن',        icon: 'calendar-clock' },
  focus:    { name: 'مؤقّت التركيز',     icon: 'timer' },
  capture:  { name: 'التقاط سريع',      icon: 'inbox' },
  habits:   { name: 'العادات',          icon: 'repeat' },
  goals:    { name: 'أهداف الأسبوع',    icon: 'target' },
  prayer:   { name: 'مواقيت الصلاة',    icon: 'moon-star' },
  weather:  { name: 'الطقس',            icon: 'cloud-sun' },
  links:    { name: 'أدواتي',           icon: 'grid-3x3' },
  notes:    { name: 'ملاحظة مثبّتة',    icon: 'notebook-pen' },
  review:   { name: 'مراجعة اليوم',     icon: 'moon' },
  calendar: { name: 'الشهر',            icon: 'calendar' }
};

function widgetsHTML() {
  const list = (S.widgets || []).filter(w => w.visible && WIDGET_DEFS[w.type]);
  if (!list.length) return '';
  return `<div class="widgets" id="widgets">${list.map(w => {
    const d = WIDGET_DEFS[w.type];
    return `<section class="widget ${w.size || 'md'}" id="wg_${w.id}" data-wid="${w.id}" draggable="true">
      <div class="wh"><i data-lucide="${d.icon}"></i><span>${esc(d.name)}</span>
        <span class="act">${wgActions(w)}<button class="icon-btn" onclick="hideWidget('${w.id}')" title="إخفاء"><i data-lucide="eye-off"></i></button></span>
      </div>
      <div class="wbody" id="wb_${w.id}">${(WG[w.type] || (() => ''))(w)}</div>
    </section>`;
  }).join('')}</div>`;
}
function wgActions(w) {
  if (w.type === 'focus')   return `<button class="icon-btn" onclick="focusSettings()" title="إعدادات"><i data-lucide="settings-2"></i></button>`;
  if (w.type === 'links')   return `<button class="icon-btn" onclick="editLinks()" title="تعديل"><i data-lucide="pencil"></i></button>`;
  if (w.type === 'prayer' || w.type === 'weather') return `<button class="icon-btn" onclick="editLocation()" title="الموقع"><i data-lucide="map-pin"></i></button>`;
  return '';
}
function repaintWidget(type) {
  (S.widgets || []).filter(w => w.type === type && w.visible).forEach(w => {
    const el = document.getElementById('wb_' + w.id);
    if (el) { el.innerHTML = (WG[w.type] || (() => ''))(w); refreshIcons(); }
  });
}
function hideWidget(id) { const w = S.widgets.find(x => x.id === id); if (w) { w.visible = false; save(); render(); toast('أُخفي الويدجت — تعيده من «تخصيص اللوحة»'); } }

/* سحب وإفلات لترتيب الويدجتس */
function initWidgetDrag() {
  const box = document.getElementById('widgets'); if (!box) return;
  let src = null;
  box.querySelectorAll('.widget').forEach(el => {
    el.addEventListener('dragstart', e => { src = el; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', el.dataset.wid); });
    el.addEventListener('dragover', e => { if (!src || src === el) return; e.preventDefault(); el.classList.add('drag-over'); });
    el.addEventListener('dragleave', () => el.classList.remove('drag-over'));
    el.addEventListener('drop', e => {
      e.preventDefault(); el.classList.remove('drag-over');
      if (!src || src === el) return;
      const from = S.widgets.findIndex(w => w.id === src.dataset.wid);
      const to = S.widgets.findIndex(w => w.id === el.dataset.wid);
      if (from < 0 || to < 0) return;
      const [m] = S.widgets.splice(from, 1); S.widgets.splice(to, 0, m);
      save(); render();
    });
  });
}

/* ============================================================
   تعريفات الويدجتس
   ============================================================ */
const WG = {};

/* — يومي الآن: الكتلة الحالية والقادمة من Time Boxing — */
WG.today = function () {
  const d = today();
  const blocks = (S.blocks || []).filter(b => b.date === d).sort((a, b) => a.start - b.start);
  const now = new Date().getHours() * 60 + new Date().getMinutes();
  const cur = blocks.find(b => now >= b.start && now < b.end);
  const next = blocks.filter(b => b.start > now).slice(0, 3);
  /* الخانات غير المكتوبة تُحفظ null داخل JSON — نتحقّق من العنصر قبل قراءته */
  const pr = (S.priorities[d] || []).filter(p => p && (p.text || '').trim());
  if (!blocks.length && !pr.length)
    return `<div class="empty"><i data-lucide="calendar-plus"></i><p>لم تُخطّط اليوم بعد.</p>
      <button class="btn primary xs" style="margin-top:10px" onclick="go('timebox')">خطّط يومك</button></div>`;
  return `
    ${cur ? `<div style="margin-bottom:12px"><div class="tiny muted">الآن</div>
      <div class="row" style="gap:8px"><span class="dot" style="background:${areaColor(cur.areaId)}"></span>
      <b style="font-size:16px">${esc(cur.title)}</b></div>
      <div class="tiny muted">${minToLabel(cur.start)} — ${minToLabel(cur.end)}</div></div>`
    : `<div class="tiny muted" style="margin-bottom:10px">لا توجد كتلة نشطة الآن</div>`}
    ${next.length ? `<div class="tiny muted" style="margin-bottom:4px">التالي</div>
      <div class="list">${next.map(b => `<div class="item" style="padding:5px 0">
        <span class="dot" style="background:${areaColor(b.areaId)}"></span>
        <div class="t"><b style="font-size:13.5px">${esc(b.title)}</b></div>
        <span class="tiny muted">${minToLabel(b.start)}</span></div>`).join('')}</div>` : ''}
    ${pr.length ? `<div class="tiny muted" style="margin:12px 0 4px">أولويات اليوم</div>
      ${pr.map(p => `<div class="row" style="gap:7px;font-size:13px${p.done ? ';opacity:.5' : ''}">
        <span class="cbox ${p.done ? 'on' : ''}" style="width:15px;height:15px" onclick="togglePriority('${d}','${p.id}')"></span>
        <span style="${p.done ? 'text-decoration:line-through' : ''}">${esc(p.text)}</span></div>`).join('')}` : ''}
    <button class="btn soft xs" style="width:100%;margin-top:12px" onclick="go('timebox')">فتح تخطيط اليوم</button>`;
};

/* — مؤقّت التركيز (بومودورو) — */
const FOCUS = { on: false, left: 0, mode: 'work', iv: null };
WG.focus = function () {
  const f = S.focus, spent = (f.log && f.log[today()]) || 0;
  const pct = Math.min(100, Math.round(spent / Math.max(1, f.goalMin) * 100));
  if (!FOCUS.left) FOCUS.left = f.work * 60;
  const mm = Math.floor(FOCUS.left / 60), ss = FOCUS.left % 60;
  return `
    <div style="text-align:center">
      <div class="big" style="font-variant-numeric:tabular-nums;color:${FOCUS.mode === 'brk' ? 'var(--good)' : 'var(--ink)'}">${pad2(mm)}:${pad2(ss)}</div>
      <div class="tiny muted" style="margin-bottom:10px">${FOCUS.mode === 'brk' ? 'استراحة' : 'تركيز'}</div>
      <div class="row" style="justify-content:center;gap:6px">
        <button class="btn ${FOCUS.on ? 'soft' : 'primary'} xs" onclick="focusToggle()">${FOCUS.on ? 'إيقاف' : 'ابدأ'}</button>
        <button class="btn ghost xs" onclick="focusReset()">تصفير</button>
      </div>
      <div class="bar" style="height:4px;border-radius:3px;background:var(--surface3);margin-top:12px;overflow:hidden">
        <i style="display:block;height:100%;width:${pct}%;background:var(--accent);border-radius:3px"></i></div>
      <div class="tiny muted" style="margin-top:5px">${spent} من ${f.goalMin} دقيقة اليوم</div>
    </div>`;
};
function focusToggle() {
  FOCUS.on = !FOCUS.on;
  if (FOCUS.on) { if (FOCUS.iv) clearInterval(FOCUS.iv); FOCUS.iv = setInterval(focusTick, 1000); }
  else { clearInterval(FOCUS.iv); FOCUS.iv = null; save(); }
  repaintWidget('focus');
}
function focusTick() {
  FOCUS.left--;
  if (FOCUS.mode === 'work') {
    const d = today(); S.focus.log = S.focus.log || {};
    if (FOCUS.left % 60 === 0) { S.focus.log[d] = (S.focus.log[d] || 0) + 1; save(); }
  }
  if (FOCUS.left <= 0) {
    beep();
    FOCUS.mode = FOCUS.mode === 'work' ? 'brk' : 'work';
    FOCUS.left = (FOCUS.mode === 'work' ? S.focus.work : S.focus.brk) * 60;
    notifyMe(FOCUS.mode === 'brk' ? 'استراحة 🌿' : 'عودة للتركيز', FOCUS.mode === 'brk' ? 'خذ نفسًا وقُم عن الكرسي.' : 'جولة جديدة — ابدأ.');
  }
  repaintWidget('focus');
}
function focusReset() { FOCUS.on = false; clearInterval(FOCUS.iv); FOCUS.iv = null; FOCUS.mode = 'work'; FOCUS.left = S.focus.work * 60; repaintWidget('focus'); }
function focusSettings() {
  const f = S.focus;
  openModal('إعدادات التركيز',
    `<div class="grid2">
      ${field('مدة التركيز (دقيقة)', inputHTML('fw', f.work, '', 'number'))}
      ${field('مدة الاستراحة (دقيقة)', inputHTML('fb', f.brk, '', 'number'))}
     </div>
     ${field('هدف اليوم (دقيقة)', inputHTML('fg', f.goalMin, '', 'number'))}`,
    `<button class="btn ghost" onclick="closeModal()">إلغاء</button><button class="btn primary" onclick="focusSave()">حفظ</button>`);
}
function focusSave() {
  S.focus.work = clamp(+$('#fw').value || 25, 1, 180);
  S.focus.brk = clamp(+$('#fb').value || 5, 1, 60);
  S.focus.goalMin = clamp(+$('#fg').value || 120, 10, 900);
  save(); closeModal(); focusReset(); repaintWidget('focus'); toast('حُفظ');
}
let AC = null;
function beep() { try { AC = AC || new (window.AudioContext || window.webkitAudioContext)(); const o = AC.createOscillator(), g = AC.createGain(); o.connect(g); g.connect(AC.destination); o.frequency.value = 660; g.gain.setValueAtTime(.0001, AC.currentTime); g.gain.exponentialRampToValueAtTime(.25, AC.currentTime + .02); g.gain.exponentialRampToValueAtTime(.0001, AC.currentTime + .6); o.start(); o.stop(AC.currentTime + .62); } catch (e) { } }
function notifyMe(t, b) { try { if (window.Notification && Notification.permission === 'granted') new Notification(t, { body: b }); } catch (e) { } }

/* — الالتقاط السريع — */
WG.capture = function () {
  const open = (S.capture || []).filter(c => !c.done);
  return `
    <input id="capIn" placeholder="اكتب واضغط Enter…" onkeydown="if(event.key==='Enter')captureAdd(this)">
    ${open.length ? `<div class="list" style="margin-top:8px;max-height:150px;overflow-y:auto">
      ${open.slice(0, 8).map(c => `<div class="item" style="padding:6px 0">
        <span class="cbox" onclick="captureDone('${c.id}')"></span>
        <div class="t sm">${esc(c.text)}</div>
        <span class="acts"><button class="icon-btn" onclick="captureToTask('${c.id}')" title="حوّل لمهمة"><i data-lucide="arrow-left-right"></i></button></span>
      </div>`).join('')}</div>
      ${open.length > 8 ? `<div class="tiny muted" style="margin-top:6px">+${open.length - 8} أخرى</div>` : ''}`
    : `<p class="tiny muted" style="margin-top:8px">الصندوق فارغ — أفرغ ذهنك هنا وقت ما تشاء.</p>`}`;
};
function captureAdd(el) {
  const v = el.value.trim(); if (!v) return;
  S.capture.unshift({ id: uid('c'), text: v, createdAt: new Date().toISOString(), done: false });
  el.value = ''; save(); repaintWidget('capture'); const i = $('#capIn'); if (i) i.focus();
}
function captureDone(id) { const c = S.capture.find(x => x.id === id); if (c) { c.done = true; save(); repaintWidget('capture'); } }
function captureToTask(id) {
  const c = S.capture.find(x => x.id === id); if (!c) return;
  c.done = true; save(); closeModal(); taskModal({ title: c.text });
}
function quickCapture() {
  openModal('التقاط سريع', field('ما الذي يشغل بالك؟', `<textarea id="qcap" placeholder="فكرة، مهمة، تذكير… اكتبها واتركها"></textarea>`, 'تُحفظ في صندوق الوارد لتُرتّبها لاحقاً'),
    `<button class="btn ghost" onclick="closeModal()">إلغاء</button><button class="btn primary" onclick="qcapSave()">احفظ</button>`);
}
function qcapSave() {
  const v = $('#qcap').value.trim(); if (!v) { closeModal(); return; }
  v.split('\n').filter(x => x.trim()).forEach(t => S.capture.unshift({ id: uid('c'), text: t.trim(), createdAt: new Date().toISOString(), done: false }));
  save(); closeModal(); toast('حُفظ في صندوق الوارد', 'good'); if (CUR === 'dashboard') repaintWidget('capture');
}

/* — العادات — */
WG.habits = function () {
  const d = today(), lg = S.habits.log[d] || {};
  const list = (S.habits.list || []).filter(h => !h.archived);
  if (!list.length) return `<div class="empty"><i data-lucide="repeat"></i><p>لا عادات بعد.</p>
    <button class="btn primary xs" style="margin-top:8px" onclick="habitModal()">أضف عادة</button></div>`;
  const doneN = list.filter(h => lg[h.id]).length;
  return `<div class="between" style="margin-bottom:8px"><span class="tiny muted">${doneN} من ${list.length} اليوم</span>
      <button class="icon-btn" onclick="habitModal()" title="عادة جديدة"><i data-lucide="plus"></i></button></div>
    <div class="list">${list.slice(0, 7).map(h => `<div class="item" style="padding:6px 0">
      <span class="cbox ${lg[h.id] ? 'on' : ''}" onclick="habitToggle('${h.id}')"></span>
      <div class="t sm ${lg[h.id] ? 'muted' : ''}">${esc(h.name)}</div>
      <span class="tiny muted">${habitStreak(h.id)}🔥</span></div>`).join('')}</div>`;
};
function habitToggle(id, day) {
  const d = day || today();
  S.habits.log[d] = S.habits.log[d] || {};
  if (S.habits.log[d][id]) delete S.habits.log[d][id]; else S.habits.log[d][id] = true;
  save();
  if (CUR === 'dashboard') { repaintWidget('habits'); paintAreaCards(); } else render();
}
function habitStreak(id) {
  let n = 0, d = today();
  if (!((S.habits.log[d] || {})[id])) d = dayShift(d, -1);
  while ((S.habits.log[d] || {})[id]) { n++; d = dayShift(d, -1); }
  return n;
}
function habitModal(h) {
  h = h || {};
  openModal(h.id ? 'تعديل عادة' : 'عادة جديدة',
    `${field('اسم العادة', inputHTML('hn', h.name, 'مثال: المشي ٣٠ دقيقة'))}
     ${field('الجانب', areaSelect('ha', h.areaId, true))}
     ${field('تذكير (اختياري)', inputHTML('hr', h.reminder, '', 'time'))}`,
    `${h.id ? `<button class="btn ghost" onclick="habitDel('${h.id}')" style="margin-inline-end:auto;color:var(--bad)">حذف</button>` : ''}
     <button class="btn ghost" onclick="closeModal()">إلغاء</button><button class="btn primary" onclick="habitSave('${h.id || ''}')">حفظ</button>`);
}
function habitSave(id) {
  const name = $('#hn').value.trim(); if (!name) { toast('اكتب اسم العادة', 'bad'); return; }
  const o = { name, areaId: $('#ha').value, reminder: $('#hr').value };
  if (id) Object.assign(S.habits.list.find(x => x.id === id), o);
  else S.habits.list.push(Object.assign({ id: uid('h') }, o));
  save(); closeModal(); render(); toast('حُفظ');
}
function habitDel(id) {
  S.habits.list = S.habits.list.filter(x => x.id !== id);
  save(); closeModal(); render(); toast('حُذفت العادة');
}

/* — أهداف الأسبوع — */
WG.goals = function () {
  const gs = (S.goals || []).filter(g => !g.done).slice(0, 5);
  if (!gs.length) return `<div class="empty"><i data-lucide="target"></i><p>لا أهداف مفتوحة.</p>
    <button class="btn primary xs" style="margin-top:8px" onclick="goalModal()">حدّد هدفاً</button></div>`;
  return `<div class="list">${gs.map(g => {
    const pct = g.target ? clamp(Math.round((+g.current || 0) / (+g.target) * 100), 0, 100) : 0;
    return `<div style="padding:7px 0;border-bottom:1px solid var(--line)">
      <div class="between" style="gap:8px"><span class="sm truncate" style="flex:1">${esc(g.title)}</span>
        <span class="tiny muted">${g.target ? pct + '٪' : (g.due ? fmtShort(g.due) : '')}</span></div>
      ${g.target ? `<div style="height:3px;border-radius:2px;background:var(--surface3);margin-top:5px"><i style="display:block;height:100%;width:${pct}%;background:${areaColor(g.areaId)};border-radius:2px"></i></div>` : ''}
    </div>`;
  }).join('')}</div>
  <button class="btn soft xs" style="width:100%;margin-top:10px" onclick="goalModal()">هدف جديد</button>`;
};
function goalModal(g) {
  g = g || {};
  openModal(g.id ? 'تعديل هدف' : 'هدف جديد',
    `${field('الهدف', inputHTML('gt', g.title, 'مثال: أقرأ ٤ كتب'))}
     ${field('الجانب', areaSelect('ga', g.areaId, true))}
     <div class="grid2">
       ${field('المدى', `<select id="gh">${[['week', 'هذا الأسبوع'], ['month', 'هذا الشهر'], ['quarter', 'هذا الربع'], ['year', 'هذه السنة']].map(([v, l]) => `<option value="${v}" ${g.horizon === v ? 'selected' : ''}>${l}</option>`).join('')}</select>`)}
       ${field('الموعد', inputHTML('gd', g.due, '', 'date'))}
     </div>
     <div class="grid2">
       ${field('الرقم المستهدف', inputHTML('gtar', g.target, 'اختياري', 'number'))}
       ${field('المُنجز حالياً', inputHTML('gcur', g.current, '0', 'number'))}
     </div>`,
    `${g.id ? `<button class="btn ghost" onclick="goalDel('${g.id}')" style="margin-inline-end:auto;color:var(--bad)">حذف</button>` : ''}
     <button class="btn ghost" onclick="closeModal()">إلغاء</button><button class="btn primary" onclick="goalSave('${g.id || ''}')">حفظ</button>`);
}
function goalSave(id) {
  const title = $('#gt').value.trim(); if (!title) { toast('اكتب الهدف', 'bad'); return; }
  const o = { title, areaId: $('#ga').value, horizon: $('#gh').value, due: $('#gd').value, target: $('#gtar').value, current: $('#gcur').value };
  if (id) Object.assign(S.goals.find(x => x.id === id), o);
  else S.goals.push(Object.assign({ id: uid('g'), done: false }, o));
  save(); closeModal(); render(); toast('حُفظ');
}
function goalDel(id) { S.goals = S.goals.filter(x => x.id !== id); save(); closeModal(); render(); }

/* — مواقيت الصلاة — */
const PRAYER = { date: '', t: null, loading: false };
const PR_AR = [['Fajr', 'الفجر'], ['Dhuhr', 'الظهر'], ['Asr', 'العصر'], ['Maghrib', 'المغرب'], ['Isha', 'العشاء']];
WG.prayer = function () {
  if (PRAYER.date !== today() && !PRAYER.loading) loadPrayer();
  if (!PRAYER.t) return `<p class="tiny muted">جارٍ جلب المواقيت…</p>`;
  const now = new Date().getHours() * 60 + new Date().getMinutes();
  let nextI = PR_AR.findIndex(([k]) => labelToMin(PRAYER.t[k]) > now);
  if (nextI < 0) nextI = 0;
  return `<div class="list">${PR_AR.map(([k, ar], i) => `
    <div class="item" style="padding:5px 0;${i === nextI ? 'color:var(--accent);font-weight:600' : ''}">
      <div class="t sm">${ar}</div>
      <span class="tiny" style="font-variant-numeric:tabular-nums">${fmt12(PRAYER.t[k])}</span>
    </div>`).join('')}</div>
    <div class="tiny muted" style="margin-top:8px">${esc(S.profile.city || '')}</div>`;
};
function fmt12(hhmm) { if (!hhmm) return '—'; const [h, m] = hhmm.slice(0, 5).split(':').map(Number); const ap = h < 12 ? 'ص' : 'م'; let h12 = h % 12; if (!h12) h12 = 12; return h12 + ':' + pad2(m) + ' ' + ap; }
function loadPrayer() {
  PRAYER.loading = true;
  const p = S.profile;
  fetch(`https://api.aladhan.com/v1/timings/${today()}?latitude=${p.lat}&longitude=${p.lon}&method=${S.prayer.method || 4}`)
    .then(r => r.json()).then(j => { PRAYER.t = j.data.timings; PRAYER.date = today(); PRAYER.loading = false; repaintWidget('prayer'); })
    .catch(() => { PRAYER.loading = false; });
}

/* — الطقس — */
const WX = { t: null, loading: false, day: '' };
const WX_ICON = { 0: ['صحو', 'sun'], 1: ['صحو غالباً', 'sun'], 2: ['غائم جزئياً', 'cloud-sun'], 3: ['غائم', 'cloud'], 45: ['ضباب', 'cloud-fog'], 48: ['ضباب', 'cloud-fog'], 51: ['رذاذ', 'cloud-drizzle'], 61: ['مطر خفيف', 'cloud-rain'], 63: ['مطر', 'cloud-rain'], 65: ['مطر غزير', 'cloud-rain-wind'], 80: ['زخات', 'cloud-rain'], 95: ['عاصفة رعدية', 'cloud-lightning'] };
WG.weather = function () {
  if (WX.day !== today() && !WX.loading) loadWeather();
  if (!WX.t) return `<p class="tiny muted">جارٍ جلب الطقس…</p>`;
  const [lbl, ic] = WX_ICON[WX.t.code] || ['—', 'cloud'];
  return `<div class="row" style="gap:12px">
      <i data-lucide="${ic}" style="width:34px;height:34px;color:var(--accent)"></i>
      <div><div class="big" style="font-size:26px">${Math.round(WX.t.temp)}°</div>
      <div class="tiny muted">${lbl} · ${esc(S.profile.city || '')}</div></div></div>
    <div class="tiny muted" style="margin-top:8px">العظمى ${Math.round(WX.t.max)}° · الصغرى ${Math.round(WX.t.min)}°</div>`;
};
function loadWeather() {
  WX.loading = true; const p = S.profile;
  fetch(`https://api.open-meteo.com/v1/forecast?latitude=${p.lat}&longitude=${p.lon}&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=1`)
    .then(r => r.json()).then(j => {
      WX.t = { temp: j.current.temperature_2m, code: j.current.weather_code, max: j.daily.temperature_2m_max[0], min: j.daily.temperature_2m_min[0] };
      WX.day = today(); WX.loading = false; repaintWidget('weather');
    }).catch(() => { WX.loading = false; });
}
function editLocation() {
  const p = S.profile;
  openModal('الموقع', `${field('المدينة', inputHTML('pc', p.city, 'الرياض'))}
    <div class="grid2">${field('خط العرض', inputHTML('plat', p.lat, '', 'number'))}${field('خط الطول', inputHTML('plon', p.lon, '', 'number'))}</div>
    <button class="btn ghost xs" onclick="geoLocate()"><i data-lucide="crosshair"></i> حدّد موقعي تلقائياً</button>`,
    `<button class="btn ghost" onclick="closeModal()">إلغاء</button><button class="btn primary" onclick="saveLocation()">حفظ</button>`);
}
function geoLocate() {
  if (!navigator.geolocation) { toast('الموقع غير متاح', 'bad'); return; }
  navigator.geolocation.getCurrentPosition(pos => { $('#plat').value = pos.coords.latitude.toFixed(3); $('#plon').value = pos.coords.longitude.toFixed(3); toast('تم تحديد موقعك'); }, () => toast('تعذّر تحديد الموقع', 'bad'));
}
function saveLocation() {
  S.profile.city = $('#pc').value.trim(); S.profile.lat = +$('#plat').value; S.profile.lon = +$('#plon').value;
  save(); closeModal(); PRAYER.date = ''; WX.day = ''; render(); toast('حُفظ');
}

/* — أدواتي (روابط سريعة) — */
WG.links = function () {
  return `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(74px,1fr));gap:8px">
    ${(S.links || []).map(l => `<a href="${esc(l.url)}" target="_blank" rel="noopener"
      style="display:flex;flex-direction:column;align-items:center;gap:6px;padding:11px 4px;border-radius:11px;background:var(--surface2);transition:.14s"
      onmouseover="this.style.background='var(--surface3)'" onmouseout="this.style.background='var(--surface2)'">
      <i data-lucide="${esc(l.icon || 'link')}" style="width:19px;height:19px;color:var(--accent)"></i>
      <span class="tiny" style="text-align:center;line-height:1.2">${esc(l.label)}</span></a>`).join('')}</div>`;
};
function editLinks() {
  openModal('أدواتي', `<div id="lnkList">${(S.links || []).map(l => lnkRow(l)).join('')}</div>
    <button class="btn ghost xs" onclick="lnkAdd()"><i data-lucide="plus"></i> رابط جديد</button>`,
    `<button class="btn ghost" onclick="closeModal()">إلغاء</button><button class="btn primary" onclick="lnkSave()">حفظ</button>`, { wide: true });
}
function lnkRow(l) {
  l = l || { id: uid('l'), label: '', url: '', icon: 'link' };
  return `<div class="row lnk" data-id="${l.id}" style="margin-bottom:8px">
    <input class="ln" value="${esc(l.label)}" placeholder="الاسم" style="max-width:130px">
    <input class="lu" value="${esc(l.url)}" placeholder="https://">
    <input class="li" value="${esc(l.icon || 'link')}" placeholder="أيقونة" style="max-width:110px">
    <button class="icon-btn" onclick="this.parentElement.remove()"><i data-lucide="trash-2"></i></button></div>`;
}
function lnkAdd() { $('#lnkList').insertAdjacentHTML('beforeend', lnkRow()); refreshIcons(); }
function lnkSave() {
  S.links = $$('#lnkList .lnk').map(r => ({ id: r.dataset.id, label: $('.ln', r).value.trim(), url: $('.lu', r).value.trim(), icon: $('.li', r).value.trim() || 'link' })).filter(l => l.label && l.url);
  save(); closeModal(); render(); toast('حُفظ');
}

/* — ملاحظة مثبّتة — */
WG.notes = function () {
  const n = (S.notes || []).find(x => x.pinned) || (S.notes || [])[0];
  if (!n) return `<div class="empty"><i data-lucide="notebook-pen"></i><p>لا ملاحظات.</p>
    <button class="btn primary xs" style="margin-top:8px" onclick="noteModal()">اكتب ملاحظة</button></div>`;
  return `<b class="sm">${esc(n.title || 'بلا عنوان')}</b>
    <p class="sm muted" style="margin-top:5px;white-space:pre-wrap;max-height:120px;overflow:hidden">${esc((n.body || '').slice(0, 260))}</p>
    <button class="btn soft xs" style="width:100%;margin-top:10px" onclick="noteModal(S.notes.find(x=>x.id==='${n.id}'))">تحرير</button>`;
};
function noteModal(n) {
  n = n || {};
  openModal(n.id ? 'تحرير ملاحظة' : 'ملاحظة جديدة',
    `${field('العنوان', inputHTML('nt', n.title, 'عنوان قصير'))}
     ${field('النص', `<textarea id="nb" style="min-height:180px">${esc(n.body || '')}</textarea>`)}
     ${field('الجانب', areaSelect('na', n.areaId, true))}
     <label class="row" style="gap:8px;font-size:13px"><input type="checkbox" id="np" ${n.pinned ? 'checked' : ''}> تثبيت في اللوحة</label>`,
    `${n.id ? `<button class="btn ghost" onclick="noteDel('${n.id}')" style="margin-inline-end:auto;color:var(--bad)">حذف</button>` : ''}
     <button class="btn ghost" onclick="closeModal()">إلغاء</button><button class="btn primary" onclick="noteSave('${n.id || ''}')">حفظ</button>`, { wide: true });
}
function noteSave(id) {
  const o = { title: $('#nt').value.trim(), body: $('#nb').value, areaId: $('#na').value, pinned: $('#np').checked, updatedAt: new Date().toISOString() };
  if (o.pinned) S.notes.forEach(x => x.pinned = false);
  if (id) Object.assign(S.notes.find(x => x.id === id), o);
  else S.notes.unshift(Object.assign({ id: uid('n') }, o));
  save(); closeModal(); render(); toast('حُفظت');
}
function noteDel(id) { S.notes = S.notes.filter(x => x.id !== id); save(); closeModal(); render(); }

/* — مراجعة اليوم — */
WG.review = function () {
  const d = today(), r = S.reviews[d];
  if (r) return `<div class="tiny muted">أفضل ما في اليوم</div><p class="sm">${esc(r.win || '—')}</p>
    <div class="row" style="gap:14px;margin-top:10px"><span class="chip">المزاج ${r.mood || '—'}/5</span><span class="chip">الطاقة ${r.energy || '—'}/5</span></div>
    <button class="btn soft xs" style="width:100%;margin-top:10px" onclick="reviewModal()">تعديل</button>`;
  return `<p class="sm muted">أغلق يومك بمراجعة قصيرة — دقيقتان تكفيان.</p>
    <button class="btn primary xs" style="width:100%;margin-top:10px" onclick="reviewModal()">ابدأ المراجعة</button>`;
};
/* المراجعة صار لها صفحة كاملة تحفظ كل المراجعات — والنافذة تحوّل إليها */
function reviewModal(day) { closeModal(); go('daily', day || today()); }

/* — تقويم الشهر المصغّر — */
WG.calendar = function () {
  const now = new Date(), y = now.getFullYear(), m = now.getMonth();
  const first = new Date(y, m, 1), days = new Date(y, m + 1, 0).getDate();
  const lead = (first.getDay() + 1) % 7; // السبت أول
  const names = ['س', 'أ', 'ن', 'ث', 'ر', 'خ', 'ج'];
  let cells = names.map(n => `<div class="tiny muted" style="text-align:center;padding:3px 0">${n}</div>`).join('');
  for (let i = 0; i < lead; i++) cells += '<div></div>';
  for (let d = 1; d <= days; d++) {
    const iso = y + '-' + pad2(m + 1) + '-' + pad2(d);
    const has = (S.blocks || []).some(b => b.date === iso);
    const isToday = iso === today();
    cells += `<div onclick="go('timebox','${iso}')" style="text-align:center;padding:4px 0;font-size:12px;border-radius:7px;cursor:pointer;position:relative;
      ${isToday ? 'background:var(--accent);color:#fff;font-weight:700' : ''}">${d}
      ${has && !isToday ? `<span style="position:absolute;bottom:1px;inset-inline-start:50%;transform:translateX(50%);width:3px;height:3px;border-radius:50%;background:var(--accent)"></span>` : ''}</div>`;
  }
  return `<div class="tiny muted" style="margin-bottom:6px">${now.toLocaleDateString('ar-SA-u-ca-gregory', { month: 'long', year: 'numeric' })}</div>
    <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px">${cells}</div>`;
};

/* — تخصيص اللوحة — */
function customizeWidgets() {
  openModal('تخصيص اللوحة',
    `<p class="tiny muted" style="margin-bottom:14px">أظهر ما تحتاجه فقط. رتّبها بالسحب من اللوحة مباشرة.</p>
     ${(S.widgets || []).map(w => {
      const d = WIDGET_DEFS[w.type]; if (!d) return '';
      return `<div class="row" style="padding:9px 0;border-bottom:1px solid var(--line)">
        <i data-lucide="${d.icon}" style="width:16px;height:16px;color:var(--muted)"></i>
        <span class="grow sm">${esc(d.name)}</span>
        <select onchange="wSize('${w.id}',this.value)" style="max-width:96px;font-size:12px;padding:5px 8px">
          ${[['sm', 'صغير'], ['md', 'متوسط'], ['lg', 'كبير'], ['xl', 'عريض']].map(([v, l]) => `<option value="${v}" ${w.size === v ? 'selected' : ''}>${l}</option>`).join('')}
        </select>
        <button class="icon-btn" onclick="wVis('${w.id}',this)"><i data-lucide="${w.visible ? 'eye' : 'eye-off'}"></i></button></div>`;
    }).join('')}`,
    `<button class="btn primary" onclick="closeModal();render()">تم</button>`, { wide: true });
}
function wVis(id, btn) { const w = S.widgets.find(x => x.id === id); w.visible = !w.visible; save(); btn.innerHTML = `<i data-lucide="${w.visible ? 'eye' : 'eye-off'}"></i>`; refreshIcons(); }
function wSize(id, v) { const w = S.widgets.find(x => x.id === id); w.size = v; save(); }
