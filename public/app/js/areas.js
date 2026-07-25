/* ============================================================
   areas.js — جوانب الحياة + محرّك الأقسام + المهام
   ============================================================ */

const SEC_TYPES = {
  tasks:     { name: 'مهام',            icon: 'check-square',  hint: 'مهام هذا الجانب — تظهر أيضاً في تخطيط اليوم' },
  habits:    { name: 'عادات',           icon: 'repeat',        hint: 'عادات يومية تُتابَع بسلسلة' },
  goals:     { name: 'أهداف',           icon: 'target',        hint: 'أهداف بمدى زمني ونسبة إنجاز' },
  notes:     { name: 'ملاحظات',         icon: 'notebook-pen',  hint: 'نصوص حرّة' },
  metric:    { name: 'مؤشّر رقمي',      icon: 'trending-up',   hint: 'رقم يُسجَّل بالتاريخ ويُرسم بيانياً — كالوزن' },
  records:   { name: 'سجلّات',          icon: 'table',         hint: 'قائمة بحقول تحدّدها أنت — كالمواعيد والتحاليل' },
  checklist: { name: 'قائمة تحقّق',     icon: 'list-checks',   hint: 'قائمة ثابتة تُعلَّم يومياً أو مرّة واحدة' },
  journal:   { name: 'يوميّات',         icon: 'pen-line',      hint: 'مدخلات مؤرّخة — كالتغذية أو الأفكار' },
  prayers:   { name: 'الصلوات الخمس',   icon: 'moon-star',     hint: 'متابعة الصلوات: جماعة / في وقتها / متأخرة' }
};

/* ============================================================
   حساب تقدّم الجانب — لبطاقات اللوحة
   ============================================================ */
function areaProgress(a) {
  const d = today(), lg = S.habits.log[d] || {};
  const hs = (S.habits.list || []).filter(h => h.areaId === a.id && !h.archived);
  const hDone = hs.filter(h => lg[h.id]).length;
  const ts = (S.tasks || []).filter(t => t.areaId === a.id && t.status !== 'done');
  const tToday = (S.tasks || []).filter(t => t.areaId === a.id && t.doneAt && t.doneAt.slice(0, 10) === d).length;
  let checks = 0, checksDone = 0;
  (a.sections || []).filter(s => s.type === 'checklist' && s.config.daily).forEach(s => {
    (s.items || []).forEach(it => { checks++; if ((it.log || {})[d]) checksDone++; });
  });
  const tot = hs.length + checks, don = hDone + checksDone;
  const pct = tot ? Math.round(don / tot * 100) : (tToday ? 100 : 0);
  const topHabit = hs.find(h => !lg[h.id]);
  return { pct, openTasks: ts.length, hDone, hTot: hs.length, topHabit, updated: areaUpdated(a) };
}
function areaUpdated(a) {
  let last = 0;
  const bump = v => { if (v) { const t = new Date(v).getTime(); if (t > last) last = t; } };
  (S.tasks || []).filter(t => t.areaId === a.id).forEach(t => { bump(t.doneAt); bump(t.createdAt); });
  (S.notes || []).filter(n => n.areaId === a.id).forEach(n => bump(n.updatedAt));
  (a.sections || []).forEach(s => (s.items || []).forEach(it => bump(it.date ? it.date + 'T12:00:00' : it.createdAt)));
  return last ? new Date(last).toISOString() : '';
}

function areaCardHTML(a) {
  const p = areaProgress(a);
  const bits = [];
  if (p.hTot) bits.push(`${p.hDone}/${p.hTot} عادات`);
  if (p.openTasks) bits.push(`${p.openTasks} مهمة مفتوحة`);
  if (p.topHabit) bits.push(`التالي: ${p.topHabit.name}`);
  if (!bits.length) bits.push('كل شيء هادئ اليوم');
  return `<button class="area-card" onclick="go('area','${a.id}')">
    <span class="pct">${p.pct}٪</span>
    <div class="ic" style="background:${hexA(a.color, .13)};color:${a.color}"><i data-lucide="${esc(a.icon)}"></i></div>
    <h3>${esc(a.name)}</h3>
    <div class="meta">${bits.slice(0, 2).map(esc).join('<br>')}</div>
    <div class="bar"><i style="width:${p.pct}%;background:${a.color}"></i></div>
    <div class="tiny muted" style="margin-top:7px">آخر تحديث: ${ago(p.updated)}</div>
  </button>`;
}
function paintAreaCards() {
  const g = document.getElementById('areasGrid');
  if (g) { g.innerHTML = S.areas.filter(a => !a.hidden).map(areaCardHTML).join(''); refreshIcons(); }
}

/* ============================================================
   صفحة الجانب
   ============================================================ */
function renderArea(id) {
  const a = areaById(id);
  if (!a) { go('dashboard'); return; }
  const p = areaProgress(a);
  $('#view').innerHTML = `
    <div class="page-head">
      <div class="row" style="gap:13px;align-items:flex-start">
        <div class="ic" style="width:44px;height:44px;border-radius:12px;display:grid;place-items:center;background:${hexA(a.color, .13)};color:${a.color};flex:none">
          <i data-lucide="${esc(a.icon)}" style="width:22px;height:22px"></i></div>
        <div><h1>${esc(a.name)}</h1>
          <div class="sub">${p.pct}٪ من إيقاع اليوم · ${p.openTasks} مهمة مفتوحة</div></div>
      </div>
      <div class="row">
        <button class="btn ghost" onclick="secAddModal('${a.id}')"><i data-lucide="plus"></i> قسم جديد</button>
        <button class="icon-btn" onclick="areaModal('${a.id}')" title="إعدادات الجانب"><i data-lucide="settings-2"></i></button>
      </div>
    </div>
    ${(a.sections || []).length
      ? `<div class="sec-grid">${a.sections.map(s => secHTML(a, s)).join('')}</div>`
      : `<div class="empty card pad"><i data-lucide="layout-template"></i><p>لا أقسام بعد في هذا الجانب.</p>
         <button class="btn primary xs" style="margin-top:10px" onclick="secAddModal('${a.id}')">أضف أول قسم</button></div>`}`;
  refreshIcons();
}

function secHTML(a, s) {
  const T = SEC_TYPES[s.type] || SEC_TYPES.notes;
  return `<section class="sec" id="sec_${s.id}">
    <div class="sh">
      <i data-lucide="${esc(s.icon || T.icon)}"></i>
      <h3>${esc(s.title)}</h3>
      <button class="icon-btn" onclick="secAdd('${a.id}','${s.id}')" title="إضافة"><i data-lucide="plus"></i></button>
      <button class="icon-btn" onclick="secMenu('${a.id}','${s.id}')" title="خيارات"><i data-lucide="more-horizontal"></i></button>
    </div>
    <div id="sb_${s.id}">${secBody(a, s)}</div>
  </section>`;
}
function repaintSec(areaId, secId) {
  const a = areaById(areaId), s = (a.sections || []).find(x => x.id === secId);
  const el = document.getElementById('sb_' + secId);
  if (el && s) { el.innerHTML = secBody(a, s); refreshIcons(); }
}
function emptySec(msg) { return `<p class="tiny muted" style="padding:8px 0">${esc(msg)}</p>`; }

function secBody(a, s) {
  switch (s.type) {
    case 'tasks':     return secTasks(a, s);
    case 'habits':    return secHabits(a, s);
    case 'goals':     return secGoals(a, s);
    case 'notes':     return secNotes(a, s);
    case 'metric':    return secMetric(a, s);
    case 'records':   return secRecords(a, s);
    case 'checklist': return secChecklist(a, s);
    case 'journal':   return secJournal(a, s);
    case 'prayers':   return secPrayers(a, s);
    default:          return emptySec('نوع غير معروف');
  }
}
function secAdd(areaId, secId) {
  const a = areaById(areaId), s = a.sections.find(x => x.id === secId);
  switch (s.type) {
    case 'tasks':     return taskModal({ areaId }, () => repaintSec(areaId, secId));
    case 'habits':    return habitModal({ areaId });
    case 'goals':     return goalModal({ areaId });
    case 'notes':     return noteModal({ areaId });
    case 'metric':    return metricAdd(areaId, secId);
    case 'records':   return recordModal(areaId, secId);
    case 'checklist': return checkAdd(areaId, secId);
    case 'journal':   return journalAdd(areaId, secId);
    case 'prayers':   return toast('علّم الصلوات من الشبكة مباشرة');
  }
}

/* ---------- مهام ---------- */
function secTasks(a, s) {
  const ts = (S.tasks || []).filter(t => t.areaId === a.id).sort(taskSort).slice(0, 12);
  if (!ts.length) return emptySec('لا مهام هنا. اضغط + لإضافة أول مهمة.');
  return `<div class="list">${ts.map(t => taskRow(t, () => `repaintSec('${a.id}','${s.id}')`)).join('')}</div>`;
}
function taskSort(x, y) {
  if ((x.status === 'done') !== (y.status === 'done')) return x.status === 'done' ? 1 : -1;
  const pv = { high: 0, mid: 1, low: 2, none: 3 };
  if (pv[x.priority || 'none'] !== pv[y.priority || 'none']) return pv[x.priority || 'none'] - pv[y.priority || 'none'];
  return (x.due || '9999') < (y.due || '9999') ? -1 : 1;
}
function taskRow(t, after) {
  const late = t.due && t.due < today() && t.status !== 'done';
  const isPri = priorityOfTask(t.id) >= 0;
  return `<div class="item ${t.status === 'done' ? 'done' : ''}">
    <span class="cbox ${t.status === 'done' ? 'on' : ''}" onclick="taskToggle('${t.id}')"></span>
    <span class="pri ${t.priority || 'none'}"></span>
    <div class="t" onclick="taskModal(S.tasks.find(x=>x.id==='${t.id}'))" style="cursor:pointer">
      <b>${esc(t.title)}</b>
      ${(t.due || t.areaId) ? `<span class="tiny muted">${t.due ? (late ? '⚠ ' : '') + fmtShort(t.due) : ''}${t.due && t.areaId ? ' · ' : ''}${esc(areaName(t.areaId))}</span>` : ''}
    </div>
    ${isPri ? `<i data-lucide="star" style="width:14px;height:14px;color:var(--accent)"></i>` : ''}
    <span class="acts">
      <button class="icon-btn" onclick="taskToPriority('${t.id}')" title="${isPri ? 'أزِلها من أولويات اليوم' : 'اجعلها من أولويات اليوم'}"><i data-lucide="star"></i></button>
      <button class="icon-btn" onclick="taskDel('${t.id}')"><i data-lucide="trash-2"></i></button></span>
  </div>`;
}
function taskToggle(id) {
  const t = (S.tasks || []).find(x => x.id === id); if (!t) return;
  t.status = t.status === 'done' ? 'open' : 'done';
  t.doneAt = t.status === 'done' ? new Date().toISOString() : '';
  syncPrioritiesFromTask(t);   // الأولوية المرتبطة تُشطب معها
  save(); render();
}
function taskDel(id) {
  S.tasks = S.tasks.filter(x => x.id !== id);
  S.blocks = (S.blocks || []).map(b => b.taskId === id ? Object.assign(b, { taskId: '' }) : b);
  Object.keys(S.priorities || {}).forEach(d => (S.priorities[d] || []).forEach(p => { if (p && p.taskId === id) p.taskId = ''; }));
  save(); render();
}
function taskModal(t) {
  t = t || {};
  openModal(t.id ? 'تعديل مهمة' : 'مهمة جديدة',
    `${field('المهمة', inputHTML('tt', t.title, 'ماذا تريد أن تنجز؟'))}
     <div class="grid2">
       ${field('الجانب', areaSelect('ta', t.areaId, true))}
       ${field('الأولوية', `<select id="tp">${[['none', 'عادية'], ['low', 'منخفضة'], ['mid', 'متوسطة'], ['high', 'عالية']].map(([v, l]) => `<option value="${v}" ${(t.priority || 'none') === v ? 'selected' : ''}>${l}</option>`).join('')}</select>`)}
     </div>
     <div class="grid2">
       ${field('الموعد', inputHTML('td', t.due, '', 'date'))}
       ${field('الوقت المتوقّع (دقيقة)', inputHTML('te', t.est, '30', 'number'))}
     </div>
     ${field('الهدف المرتبط', `<select id="tg"><option value="">— بلا هدف —</option>${(S.goals || []).filter(g => !g.done).map(g => `<option value="${g.id}" ${t.goalId === g.id ? 'selected' : ''}>${esc(g.title)}</option>`).join('')}</select>`, 'اربط المهمة بهدف حياة لتعرف لماذا تفعلها')}
     ${field('ملاحظات', `<textarea id="tn" style="min-height:70px">${esc(t.notes || '')}</textarea>`)}`,
    `${t.id ? `<button class="btn ghost" onclick="closeModal();taskDel('${t.id}')" style="margin-inline-end:auto;color:var(--bad)">حذف</button>` : ''}
     <button class="btn ghost" onclick="closeModal()">إلغاء</button><button class="btn primary" onclick="taskSave('${t.id || ''}')">حفظ</button>`, { wide: true });
}
function taskSave(id) {
  const title = $('#tt').value.trim(); if (!title) { toast('اكتب عنوان المهمة', 'bad'); return; }
  const o = { title, areaId: $('#ta').value, priority: $('#tp').value, due: $('#td').value, est: +$('#te').value || 30, goalId: $('#tg').value, notes: $('#tn').value };
  if (id) {
    Object.assign(S.tasks.find(x => x.id === id), o);
    /* تغيير اسم المهمة يغيّر نصّ الأولوية المرتبطة بها */
    Object.keys(S.priorities || {}).forEach(d => (S.priorities[d] || []).forEach(p => { if (p && p.taskId === id) p.text = title; }));
  }
  else S.tasks.unshift(Object.assign({ id: uid('t'), status: 'open', createdAt: new Date().toISOString(), doneAt: '' }, o));
  save(); closeModal(); render(); toast('حُفظت');
}

/* ---------- عادات ---------- */
function secHabits(a, s) {
  const d = today(), lg = S.habits.log[d] || {};
  const hs = (S.habits.list || []).filter(h => h.areaId === a.id && !h.archived);
  if (!hs.length) return emptySec('لا عادات في هذا الجانب.');
  return `<div class="list">${hs.map(h => `<div class="item">
    <span class="cbox ${lg[h.id] ? 'on' : ''}" onclick="habitToggle('${h.id}')"></span>
    <div class="t" onclick="habitModal(S.habits.list.find(x=>x.id==='${h.id}'))" style="cursor:pointer">
      <b>${esc(h.name)}</b><span class="tiny muted">سلسلة ${habitStreak(h.id)} يوم</span></div>
    <span class="tiny muted">${habit7(h.id)}</span></div>`).join('')}</div>`;
}
function habit7(id) {
  let out = '';
  for (let i = 6; i >= 0; i--) { const d = dayShift(today(), -i); out += (S.habits.log[d] || {})[id] ? '●' : '○'; }
  return out;
}

/* ---------- أهداف ---------- */
function secGoals(a, s) {
  const gs = (S.goals || []).filter(g => g.areaId === a.id);
  if (!gs.length) return emptySec('لا أهداف محدّدة.');
  const HZ = { week: 'الأسبوع', month: 'الشهر', quarter: 'الربع', year: 'السنة' };
  return gs.map(g => {
    const pct = g.target ? clamp(Math.round((+g.current || 0) / +g.target * 100), 0, 100) : (g.done ? 100 : 0);
    return `<div class="rec" onclick="goalModal(S.goals.find(x=>x.id==='${g.id}'))" style="cursor:pointer">
      <div class="between"><b>${esc(g.title)}</b><span class="tiny muted">${HZ[g.horizon] || ''}</span></div>
      <div style="height:4px;border-radius:3px;background:var(--surface3);margin-top:7px"><i style="display:block;height:100%;width:${pct}%;background:${a.color};border-radius:3px"></i></div>
      <div class="kv">${g.target ? `${g.current || 0} من ${g.target}` : ''}${g.due ? ' · حتى ' + fmtShort(g.due) : ''}</div>
    </div>`;
  }).join('');
}

/* ---------- ملاحظات ---------- */
function secNotes(a, s) {
  const ns = (S.notes || []).filter(n => n.areaId === a.id);
  if (!ns.length) return emptySec('لا ملاحظات.');
  return ns.map(n => `<div class="rec" onclick="noteModal(S.notes.find(x=>x.id==='${n.id}'))" style="cursor:pointer">
    <b>${esc(n.title || 'بلا عنوان')}</b><div class="kv truncate">${esc((n.body || '').slice(0, 90))}</div></div>`).join('');
}

/* ---------- مؤشّر رقمي ---------- */
function secMetric(a, s) {
  const its = (s.items || []).slice().sort((x, y) => x.date < y.date ? -1 : 1);
  if (!its.length) return emptySec('لا قراءات بعد. اضغط + لتسجيل أول قراءة.');
  const last = its[its.length - 1], prev = its[its.length - 2];
  const vals = its.slice(-14).map(i => +i.v || 0);
  const mx = Math.max(...vals, 1), mn = Math.min(...vals, 0);
  const delta = prev ? (+last.v - +prev.v) : 0;
  return `<div class="row" style="align-items:flex-end;gap:9px">
      <span class="big">${esc(last.v)}</span><span class="muted sm">${esc(s.config.unit || '')}</span>
      ${delta ? `<span class="tiny" style="color:${delta > 0 ? 'var(--good)' : 'var(--bad)'};margin-inline-start:auto">${delta > 0 ? '▲' : '▼'} ${Math.abs(delta).toFixed(1)}</span>` : ''}</div>
    <div class="sparkline">${vals.map(v => `<i style="height:${mx === mn ? 50 : clamp((v - mn) / (mx - mn) * 100, 8, 100)}%"></i>`).join('')}</div>
    <div class="between tiny muted"><span>${fmtShort(its[Math.max(0, its.length - 14)].date)}</span><span>${fmtShort(last.date)}</span>
      ${s.config.goal ? `<span>الهدف ${esc(s.config.goal)}</span>` : ''}</div>
    <button class="btn soft xs" style="width:100%;margin-top:9px" onclick="metricLog('${a.id}','${s.id}')">كل القراءات (${its.length})</button>`;
}
function metricAdd(areaId, secId) {
  const a = areaById(areaId), s = a.sections.find(x => x.id === secId);
  openModal('قراءة جديدة — ' + s.title,
    `<div class="grid2">${field('القيمة (' + (s.config.unit || '') + ')', inputHTML('mv', '', '', 'number'))}${field('التاريخ', inputHTML('md', today(), '', 'date'))}</div>
     ${field('ملاحظة', inputHTML('mn', '', 'اختياري'))}`,
    `<button class="btn ghost" onclick="closeModal()">إلغاء</button><button class="btn primary" onclick="metricSave('${areaId}','${secId}')">حفظ</button>`);
}
function metricSave(areaId, secId) {
  const a = areaById(areaId), s = a.sections.find(x => x.id === secId);
  const v = $('#mv').value; if (v === '') { toast('اكتب القيمة', 'bad'); return; }
  s.items.push({ id: uid('m'), v, date: $('#md').value || today(), note: $('#mn').value });
  save(); closeModal(); repaintSec(areaId, secId); toast('سُجّلت');
}
function metricLog(areaId, secId) {
  const a = areaById(areaId), s = a.sections.find(x => x.id === secId);
  const its = (s.items || []).slice().sort((x, y) => x.date > y.date ? -1 : 1);
  openModal(s.title, `<div class="list">${its.map(i => `<div class="item">
    <div class="t"><b>${esc(i.v)} ${esc(s.config.unit || '')}</b><span class="tiny muted">${fmtShort(i.date)}${i.note ? ' · ' + esc(i.note) : ''}</span></div>
    <button class="icon-btn" onclick="metricDel('${areaId}','${secId}','${i.id}',this)"><i data-lucide="trash-2"></i></button></div>`).join('')}</div>`,
    `<button class="btn primary" onclick="closeModal();repaintSec('${areaId}','${secId}')">تم</button>`, { wide: true });
}
function metricDel(areaId, secId, itemId, btn) {
  const s = areaById(areaId).sections.find(x => x.id === secId);
  s.items = s.items.filter(i => i.id !== itemId); save(); btn.closest('.item').remove();
}

/* ---------- سجلّات ---------- */
function secRecords(a, s) {
  const its = (s.items || []).slice().sort((x, y) => (y.date || '') > (x.date || '') ? 1 : -1);
  if (!its.length) return emptySec('لا سجلّات بعد.');
  return its.slice(0, 8).map(r => `<div class="rec" onclick="recordModal('${a.id}','${s.id}','${r.id}')" style="cursor:pointer">
      <div class="between"><b>${esc(r.title)}</b>${r.date ? `<span class="tiny muted">${fmtShort(r.date)}</span>` : ''}</div>
      ${(s.config.fields || []).map((f, i) => (r.f || [])[i] ? `<div class="kv">${esc(f)}: ${linkify((r.f || [])[i])}</div>` : '').join('')}
    </div>`).join('') + (its.length > 8 ? `<button class="btn soft xs" style="width:100%" onclick="recordsAll('${a.id}','${s.id}')">عرض الكل (${its.length})</button>` : '');
}
function linkify(v) { return /^https?:\/\//.test(v) ? `<a href="${esc(v)}" target="_blank" rel="noopener" style="color:var(--accent)">فتح الرابط ↗</a>` : esc(v); }
function recordModal(areaId, secId, recId) {
  const s = areaById(areaId).sections.find(x => x.id === secId);
  const r = recId ? s.items.find(i => i.id === recId) : {};
  openModal((recId ? 'تعديل' : 'سجل جديد') + ' — ' + s.title,
    `${field('العنوان', inputHTML('rt', r.title, ''))}
     ${field('التاريخ', inputHTML('rd', r.date || today(), '', 'date'))}
     ${(s.config.fields || []).map((f, i) => field(f, inputHTML('rf' + i, (r.f || [])[i], ''))).join('')}
     ${field('ملاحظات', `<textarea id="rn" style="min-height:60px">${esc(r.note || '')}</textarea>`)}`,
    `${recId ? `<button class="btn ghost" onclick="recordDel('${areaId}','${secId}','${recId}')" style="margin-inline-end:auto;color:var(--bad)">حذف</button>` : ''}
     <button class="btn ghost" onclick="closeModal()">إلغاء</button>
     <button class="btn primary" onclick="recordSave('${areaId}','${secId}','${recId || ''}')">حفظ</button>`, { wide: true });
}
function recordSave(areaId, secId, recId) {
  const s = areaById(areaId).sections.find(x => x.id === secId);
  const title = $('#rt').value.trim(); if (!title) { toast('اكتب العنوان', 'bad'); return; }
  const o = { title, date: $('#rd').value, f: (s.config.fields || []).map((_, i) => $('#rf' + i).value.trim()), note: $('#rn').value };
  if (recId) Object.assign(s.items.find(i => i.id === recId), o);
  else s.items.unshift(Object.assign({ id: uid('r'), createdAt: new Date().toISOString() }, o));
  save(); closeModal(); repaintSec(areaId, secId); toast('حُفظ');
}
function recordDel(areaId, secId, recId) {
  const s = areaById(areaId).sections.find(x => x.id === secId);
  s.items = s.items.filter(i => i.id !== recId); save(); closeModal(); repaintSec(areaId, secId);
}
function recordsAll(areaId, secId) {
  const s = areaById(areaId).sections.find(x => x.id === secId);
  const its = (s.items || []).slice().sort((x, y) => (y.date || '') > (x.date || '') ? 1 : -1);
  openModal(s.title, its.map(r => `<div class="rec" onclick="closeModal();recordModal('${areaId}','${secId}','${r.id}')" style="cursor:pointer">
    <div class="between"><b>${esc(r.title)}</b><span class="tiny muted">${fmtShort(r.date)}</span></div></div>`).join(''),
    `<button class="btn primary" onclick="closeModal()">تم</button>`, { wide: true });
}

/* ---------- قائمة تحقّق ---------- */
function secChecklist(a, s) {
  const d = today(), daily = !!s.config.daily;
  if (!(s.items || []).length) return emptySec('القائمة فارغة. اضغط + لإضافة بند.');
  const doneN = s.items.filter(it => daily ? (it.log || {})[d] : it.done).length;
  return `<div class="tiny muted" style="margin-bottom:6px">${doneN} من ${s.items.length}${daily ? ' اليوم' : ''}</div>
    <div class="list">${s.items.map(it => {
      const on = daily ? !!(it.log || {})[d] : !!it.done;
      return `<div class="item ${on ? 'done' : ''}" style="padding:6px 0">
        <span class="cbox ${on ? 'on' : ''}" onclick="checkToggle('${a.id}','${s.id}','${it.id}')"></span>
        <div class="t"><b>${esc(it.text)}</b></div>
        <span class="acts"><button class="icon-btn" onclick="checkDel('${a.id}','${s.id}','${it.id}')"><i data-lucide="x"></i></button></span></div>`;
    }).join('')}</div>`;
}
function checkAdd(areaId, secId) {
  const s = areaById(areaId).sections.find(x => x.id === secId);
  openModal('بند جديد — ' + s.title, field('البند', inputHTML('ci', '', 'اكتب البند')),
    `<button class="btn ghost" onclick="closeModal()">إلغاء</button><button class="btn primary" onclick="checkSave('${areaId}','${secId}')">إضافة</button>`);
}
function checkSave(areaId, secId) {
  const s = areaById(areaId).sections.find(x => x.id === secId);
  const v = $('#ci').value.trim(); if (!v) return;
  s.items.push({ id: uid('ci'), text: v, done: false, log: {} });
  save(); closeModal(); repaintSec(areaId, secId);
}
function checkToggle(areaId, secId, itemId) {
  const s = areaById(areaId).sections.find(x => x.id === secId), it = s.items.find(i => i.id === itemId);
  if (s.config.daily) { it.log = it.log || {}; const d = today(); if (it.log[d]) delete it.log[d]; else it.log[d] = true; }
  else it.done = !it.done;
  save(); repaintSec(areaId, secId);
}
function checkDel(areaId, secId, itemId) {
  const s = areaById(areaId).sections.find(x => x.id === secId);
  s.items = s.items.filter(i => i.id !== itemId); save(); repaintSec(areaId, secId);
}

/* ---------- يوميّات ---------- */
function secJournal(a, s) {
  const its = (s.items || []).slice(0, 6);
  if (!its.length) return emptySec('لا مدخلات بعد.');
  return its.map(j => `<div class="rec">
    <div class="between"><span class="tiny muted">${fmtShort(j.date)}</span>
      <button class="icon-btn" onclick="journalDel('${a.id}','${s.id}','${j.id}')"><i data-lucide="x"></i></button></div>
    <div style="white-space:pre-wrap;font-size:13.5px;margin-top:2px">${esc(j.text)}</div></div>`).join('');
}
function journalAdd(areaId, secId) {
  const s = areaById(areaId).sections.find(x => x.id === secId);
  openModal('مدخل جديد — ' + s.title,
    `${field('التاريخ', inputHTML('jd', today(), '', 'date'))}
     ${field('النص', `<textarea id="jt" placeholder="اكتب بحرية…"></textarea>`)}`,
    `<button class="btn ghost" onclick="closeModal()">إلغاء</button><button class="btn primary" onclick="journalSave('${areaId}','${secId}')">حفظ</button>`, { wide: true });
}
function journalSave(areaId, secId) {
  const s = areaById(areaId).sections.find(x => x.id === secId);
  const t = $('#jt').value.trim(); if (!t) return;
  s.items.unshift({ id: uid('j'), date: $('#jd').value || today(), text: t });
  save(); closeModal(); repaintSec(areaId, secId); toast('حُفظ');
}
function journalDel(areaId, secId, id) {
  const s = areaById(areaId).sections.find(x => x.id === secId);
  s.items = s.items.filter(i => i.id !== id); save(); repaintSec(areaId, secId);
}

/* ---------- الصلوات ---------- */
const PR_STATE = [['mosque', 'جماعة', 'var(--good)'], ['ontime', 'في وقتها', 'var(--accent)'], ['late', 'متأخرة', 'var(--warn)']];
function secPrayers(a, s) {
  const d = today(), lg = S.prayerLog[d] || {};
  return `<div class="list">${PR_AR.map(([k, ar]) => {
    const st = lg[k];
    const c = (PR_STATE.find(p => p[0] === st) || [])[2] || 'var(--surface3)';
    return `<div class="item" style="padding:7px 0">
      <div class="t"><b>${ar}</b></div>
      <div class="row" style="gap:4px">${PR_STATE.map(([v, l, col]) => `
        <button class="btn xs" style="padding:3px 8px;font-size:11px;background:${st === v ? col : 'var(--surface2)'};color:${st === v ? '#fff' : 'var(--muted)'}"
          onclick="prayerSet('${k}','${v}')">${l}</button>`).join('')}</div></div>`;
  }).join('')}</div>
  <div class="tiny muted" style="margin-top:8px">هذا الأسبوع: ${prayerWeekPct()}٪ في وقتها</div>`;
}
function prayerSet(k, v) {
  const d = today(); S.prayerLog[d] = S.prayerLog[d] || {};
  if (S.prayerLog[d][k] === v) delete S.prayerLog[d][k]; else S.prayerLog[d][k] = v;
  save(); render();
}
function prayerWeekPct() {
  let tot = 0, ok = 0;
  for (let i = 0; i < 7; i++) { const lg = S.prayerLog[dayShift(today(), -i)] || {}; PR_AR.forEach(([k]) => { tot++; if (lg[k] === 'mosque' || lg[k] === 'ontime') ok++; }); }
  return Math.round(ok / Math.max(1, tot) * 100);
}

/* ============================================================
   إدارة الأقسام والجوانب
   ============================================================ */
function secMenu(areaId, secId) {
  const a = areaById(areaId), s = a.sections.find(x => x.id === secId), i = a.sections.indexOf(s);
  openModal('قسم: ' + s.title,
    `${field('اسم القسم', inputHTML('sn', s.title, ''))}
     ${field('الأيقونة (Lucide)', inputHTML('si', s.icon, 'مثال: heart'), 'أسماء الأيقونات من lucide.dev')}
     ${s.type === 'metric' ? `<div class="grid2">${field('الوحدة', inputHTML('su', s.config.unit, 'كجم'))}${field('الهدف', inputHTML('sg', s.config.goal, 'اختياري'))}</div>` : ''}
     ${s.type === 'records' ? field('الحقول (افصل بفاصلة)', inputHTML('sf', (s.config.fields || []).join('، '), 'الجهة، الطبيب، السبب')) : ''}
     ${s.type === 'checklist' ? `<label class="row" style="gap:8px;font-size:13px;margin-bottom:14px"><input type="checkbox" id="sd" ${s.config.daily ? 'checked' : ''}> تتكرّر يومياً (تُصفَّر كل يوم)</label>` : ''}
     <div class="row" style="gap:6px">
       <button class="btn ghost xs" onclick="secMove('${areaId}','${secId}',-1)" ${i === 0 ? 'disabled' : ''}><i data-lucide="arrow-up"></i> أعلى</button>
       <button class="btn ghost xs" onclick="secMove('${areaId}','${secId}',1)" ${i === a.sections.length - 1 ? 'disabled' : ''}><i data-lucide="arrow-down"></i> أسفل</button>
     </div>`,
    `<button class="btn ghost" onclick="secDel('${areaId}','${secId}')" style="margin-inline-end:auto;color:var(--bad)">حذف القسم</button>
     <button class="btn ghost" onclick="closeModal()">إلغاء</button><button class="btn primary" onclick="secSave('${areaId}','${secId}')">حفظ</button>`);
}
function secSave(areaId, secId) {
  const a = areaById(areaId), s = a.sections.find(x => x.id === secId);
  s.title = $('#sn').value.trim() || s.title;
  s.icon = $('#si').value.trim() || s.icon;
  if (s.type === 'metric') { s.config.unit = $('#su').value.trim(); s.config.goal = $('#sg').value.trim(); }
  if (s.type === 'records') s.config.fields = $('#sf').value.split(/[،,]/).map(x => x.trim()).filter(Boolean);
  if (s.type === 'checklist') s.config.daily = $('#sd').checked;
  save(); closeModal(); renderArea(areaId); toast('حُفظ');
}
function secDel(areaId, secId) {
  const a = areaById(areaId);
  a.sections = a.sections.filter(x => x.id !== secId);
  save(); closeModal(); renderArea(areaId); toast('حُذف القسم');
}
function secMove(areaId, secId, dir) {
  const a = areaById(areaId), i = a.sections.findIndex(x => x.id === secId), j = i + dir;
  if (j < 0 || j >= a.sections.length) return;
  const [m] = a.sections.splice(i, 1); a.sections.splice(j, 0, m);
  save(); closeModal(); renderArea(areaId);
}
function secAddModal(areaId) {
  openModal('قسم جديد',
    `${field('اسم القسم', inputHTML('nsn', '', 'مثال: التحاليل'))}
     ${field('النوع', `<select id="nst" onchange="secTypeHint()">${Object.entries(SEC_TYPES).map(([k, v]) => `<option value="${k}">${v.name}</option>`).join('')}</select>`)}
     <p class="tiny muted" id="stHint" style="margin:-8px 0 14px">${SEC_TYPES.tasks.hint}</p>
     ${field('الأيقونة', inputHTML('nsi', '', 'circle'))}`,
    `<button class="btn ghost" onclick="closeModal()">إلغاء</button><button class="btn primary" onclick="secCreate('${areaId}')">أضف</button>`);
}
function secTypeHint() { const t = $('#nst').value; $('#stHint').textContent = (SEC_TYPES[t] || {}).hint || ''; }
function secCreate(areaId) {
  const a = areaById(areaId);
  const name = $('#nsn').value.trim(); if (!name) { toast('اكتب اسم القسم', 'bad'); return; }
  const type = $('#nst').value;
  const cfg = type === 'records' ? { fields: ['تفصيل'] } : type === 'metric' ? { unit: '', goal: '' } : type === 'checklist' ? { daily: false } : {};
  a.sections.push({ id: uid('sec'), type, title: name, icon: $('#nsi').value.trim() || SEC_TYPES[type].icon, config: cfg, items: [] });
  save(); closeModal(); renderArea(areaId); toast('أُضيف القسم');
}

const AREA_ICONS = ['heart-pulse', 'brain', 'moon-star', 'briefcase', 'trending-up', 'clapperboard', 'graduation-cap', 'users', 'wallet', 'gamepad-2', 'home', 'plane', 'dumbbell', 'book', 'camera', 'car', 'leaf', 'target', 'sparkles', 'coffee'];
const AREA_COLORS = ['#e0635f', '#e08f6a', '#d99b3c', '#43a67a', '#2fae94', '#3fa9c9', '#5b8def', '#7c8cf0', '#b06fd6', '#e0679e', '#8a94a6'];
function areaModal(id) {
  const a = id ? areaById(id) : { name: '', icon: 'circle', color: AREA_COLORS[0] };
  openModal(id ? 'إعدادات الجانب' : 'جانب جديد',
    `${field('الاسم', inputHTML('an', a.name, 'مثال: التطوّع'))}
     ${field('الأيقونة', `<div style="display:grid;grid-template-columns:repeat(10,1fr);gap:5px" id="icPick">
       ${AREA_ICONS.map(ic => `<button type="button" onclick="pickIc('${ic}')" data-ic="${ic}" class="icon-btn" style="width:100%;${a.icon === ic ? 'background:var(--surface3);color:var(--accent)' : ''}"><i data-lucide="${ic}"></i></button>`).join('')}</div>
       <input type="hidden" id="ai" value="${esc(a.icon)}">`)}
     ${field('اللون', `<div class="row" style="gap:6px;flex-wrap:wrap" id="colPick">
       ${AREA_COLORS.map(c => `<button type="button" onclick="pickCol('${c}')" data-c="${c}" style="width:26px;height:26px;border-radius:50%;background:${c};border:2px solid ${a.color === c ? 'var(--ink)' : 'transparent'}"></button>`).join('')}</div>
       <input type="hidden" id="ac" value="${esc(a.color)}">`)}
     ${id ? `<label class="row" style="gap:8px;font-size:13px"><input type="checkbox" id="ah" ${a.hidden ? 'checked' : ''}> إخفاء من اللوحة</label>` : ''}`,
    `${id ? `<button class="btn ghost" onclick="areaDel('${id}')" style="margin-inline-end:auto;color:var(--bad)">حذف الجانب</button>` : ''}
     <button class="btn ghost" onclick="closeModal()">إلغاء</button><button class="btn primary" onclick="areaSave('${id || ''}')">حفظ</button>`, { wide: true });
}
function pickIc(ic) { $('#ai').value = ic; $$('#icPick .icon-btn').forEach(b => b.style.cssText = 'width:100%' + (b.dataset.ic === ic ? ';background:var(--surface3);color:var(--accent)' : '')); }
function pickCol(c) { $('#ac').value = c; $$('#colPick button').forEach(b => b.style.border = '2px solid ' + (b.dataset.c === c ? 'var(--ink)' : 'transparent')); }
function areaSave(id) {
  const name = $('#an').value.trim(); if (!name) { toast('اكتب اسم الجانب', 'bad'); return; }
  if (id) {
    const a = areaById(id);
    Object.assign(a, { name, icon: $('#ai').value, color: $('#ac').value, hidden: $('#ah') ? $('#ah').checked : false });
    save(); closeModal(); renderNav(); renderArea(id);
  } else {
    S.areas.push({ id: uid('a'), name, icon: $('#ai').value, color: $('#ac').value, sections: [] });
    save(); closeModal(); renderNav(); render();
  }
  toast('حُفظ');
}
function areaDel(id) {
  const a = areaById(id);
  openModal('حذف الجانب', `<p class="sm">سيُحذف «${esc(a.name)}» وكل أقسامه ومحتواها. المهام والعادات المرتبطة به تبقى لكن بلا جانب.</p>`,
    `<button class="btn ghost" onclick="closeModal()">تراجع</button><button class="btn danger" onclick="areaDelYes('${id}')">احذف نهائياً</button>`);
}
function areaDelYes(id) {
  S.areas = S.areas.filter(a => a.id !== id);
  (S.tasks || []).forEach(t => { if (t.areaId === id) t.areaId = ''; });
  (S.habits.list || []).forEach(h => { if (h.areaId === id) h.areaId = ''; });
  save(); closeModal(); renderNav(); go('dashboard'); toast('حُذف الجانب');
}

/* ============================================================
   صفحة المهام الشاملة
   ============================================================ */
let TASK_FILTER = 'open';
function renderTasks() {
  const f = TASK_FILTER;
  let ts = (S.tasks || []).slice();
  if (f === 'open') ts = ts.filter(t => t.status !== 'done');
  else if (f === 'today') ts = ts.filter(t => t.status !== 'done' && t.due && t.due <= today());
  else if (f === 'done') ts = ts.filter(t => t.status === 'done');
  ts.sort(taskSort);
  const counts = {
    open: S.tasks.filter(t => t.status !== 'done').length,
    today: S.tasks.filter(t => t.status !== 'done' && t.due && t.due <= today()).length,
    done: S.tasks.filter(t => t.status === 'done').length
  };
  $('#view').innerHTML = `
    <div class="page-head"><div><h1>المهام</h1><div class="sub">كل ما عليك في مكان واحد</div></div>
      <button class="btn primary" onclick="taskModal()"><i data-lucide="plus"></i> مهمة جديدة</button></div>
    <div class="row" style="gap:6px;margin-bottom:16px;flex-wrap:wrap">
      ${[['open', 'مفتوحة', counts.open], ['today', 'مستحقّة اليوم', counts.today], ['all', 'الكل', S.tasks.length], ['done', 'منجزة', counts.done]]
      .map(([k, l, c]) => `<button class="btn ${f === k ? 'primary' : 'ghost'} xs" onclick="TASK_FILTER='${k}';render()">${l} ${c ? `<span style="opacity:.7">${c}</span>` : ''}</button>`).join('')}
    </div>
    <div class="card pad">${ts.length ? `<div class="list">${ts.map(t => taskRow(t)).join('')}</div>`
      : `<div class="empty"><i data-lucide="check-check"></i><p>لا مهام هنا — استمتع بالهدوء.</p></div>`}</div>`;
  refreshIcons();
}
