/* ============================================================
   work.js — صفحة العمل: حملات على لوح مراحل · اجتماعات · مؤشرات أداء
   محرّك الكانبان هنا (kb*) تستعمله صفحة التجارة أيضاً.
   ============================================================ */

/* ---------- محرّك اللوح المرحلي (كانبان) ---------- */
function kbHTML(cols, items, cardFn) {
  return `<div class="kb" id="kb">${cols.map(c => {
    const list = items.filter(i => (i.stage || cols[0].k) === c.k);
    return `<div class="kb-col" data-col="${c.k}">
      <div class="ch">${c.dot ? `<span class="dot" style="background:${c.dot}"></span>` : ''}
        <span>${esc(c.name)}</span><span class="n">${list.length}</span></div>
      ${list.map(cardFn).join('') || `<p class="tiny muted" style="padding:5px 3px">—</p>`}
    </div>`;
  }).join('')}</div>`;
}
function kbBind(onMove) {
  const root = $('#kb'); if (!root || !root.addEventListener) return;
  let id = null;
  $$('.kb-card', root).forEach(el => el.addEventListener('dragstart', e => {
    id = el.dataset.card; e.dataTransfer.effectAllowed = 'move';
    try { e.dataTransfer.setData('text/plain', id); } catch (x) { }
  }));
  $$('.kb-col', root).forEach(col => {
    col.addEventListener('dragover', e => { e.preventDefault(); col.classList.add('over'); });
    col.addEventListener('dragleave', () => col.classList.remove('over'));
    col.addEventListener('drop', e => {
      e.preventDefault(); col.classList.remove('over');
      let x = id;
      if (!x) { try { x = e.dataTransfer.getData('text/plain'); } catch (err) { return; } }
      if (x) onMove(x, col.dataset.col);
      id = null;
    });
  });
}
function kbMove(list, id, stage) {
  const it = (list || []).find(x => x.id === id);
  if (!it || it.stage === stage) return false;
  it.stage = stage; return true;
}

/* شريط تبويبات مشترك */
function tabsHTML(tabs, cur, fnName) {
  return `<div class="tabs">${tabs.map(([k, l, n]) => `<button class="${cur === k ? 'on' : ''}" onclick="${fnName}('${k}')">
    ${esc(l)}${n ? ` <span class="muted">${n}</span>` : ''}</button>`).join('')}</div>`;
}

/* ============================================================
   صفحة العمل
   ============================================================ */
let WORK_TAB = 'campaigns';
const WORK_STAGES = [
  { k: 'idea',   name: 'فكرة' },
  { k: 'design', name: 'تصميم وإنتاج' },
  { k: 'review', name: 'اعتماد' },
  { k: 'live',   name: 'تنفيذ' },
  { k: 'done',   name: 'مُنجزة' }
];
const WORK_CHANNELS = ['مطبوعات ترويجية', 'نقاط بيع POP', 'سوشال ميديا', 'فعالية أو معرض', 'بريد إلكتروني', 'إعلانات'];

/* مؤشرات مقترحة مشتقّة من مهام الوصف الوظيفي — تُضاف بضغطة ثم تُعدّل */
function workSuggestedKPIs() {
  return [
    { id: uid('k'), name: 'مواد ترويجية أُنتجت',        target: 8,   current: 0, unit: 'مادة',  period: 'شهري', dir: 'up' },
    { id: uid('k'), name: 'حملات نُفّذت في موعدها',      target: 100, current: 0, unit: '٪',     period: 'ربعي', dir: 'up' },
    { id: uid('k'), name: 'مواقع POP دُقّقت ميدانياً',   target: 20,  current: 0, unit: 'موقع',  period: 'شهري', dir: 'up' },
    { id: uid('k'), name: 'زمن الاستجابة لطلبات الأقسام', target: 2,   current: 0, unit: 'يوم',  period: 'شهري', dir: 'down' },
    { id: uid('k'), name: 'تقارير سُلّمت في وقتها',       target: 100, current: 0, unit: '٪',     period: 'شهري', dir: 'up' },
    { id: uid('k'), name: 'متابعات مع الوكالات',         target: 4,   current: 0, unit: 'اجتماع', period: 'شهري', dir: 'up' }
  ];
}

function workTab(k) { WORK_TAB = k; render(); }

function renderWork() {
  const w = S.work;
  const openC = w.campaigns.filter(c => c.stage !== 'done').length;
  const acts = w.meetings.reduce((a, m) => a + (m.actions || []).filter(x => !x.taskId).length, 0);
  const newBtn = { campaigns: ['حملة جديدة', 'campaignModal()'], meetings: ['اجتماع جديد', 'meetingModal()'], kpis: ['مؤشّر جديد', 'kpiModal()'] }[WORK_TAB];

  $('#view').innerHTML = `
    <div class="page-head">
      <div><h1 class="serif">العمل</h1>
        <div class="sub">${esc(S.profile.role || 'مساحة عملك')} · ${openC} حملة قائمة${acts ? ` · ${acts} إجراء بانتظارك` : ''}</div></div>
      <button class="btn primary" onclick="${newBtn[1]}"><i data-lucide="plus"></i> ${newBtn[0]}</button>
    </div>
    ${tabsHTML([['campaigns', 'الحملات', w.campaigns.length], ['meetings', 'الاجتماعات', w.meetings.length], ['kpis', 'مؤشرات الأداء', w.kpis.length]], WORK_TAB, 'workTab')}
    ${WORK_TAB === 'campaigns' ? workCampaignsHTML() : WORK_TAB === 'meetings' ? workMeetingsHTML() : workKPIsHTML()}`;
  refreshIcons();
  if (WORK_TAB === 'campaigns') kbBind((id, st) => { if (kbMove(S.work.campaigns, id, st)) { save(); render(); } });
}

/* ---------- الحملات ---------- */
function workCampaignsHTML() {
  if (!S.work.campaigns.length)
    return `<div class="card pad empty"><i data-lucide="megaphone"></i>
      <p>لا حملات بعد.<br>كل حملة تمرّ من الفكرة إلى التنفيذ، واسحبها بين المراحل.</p>
      <button class="btn primary xs" style="margin-top:12px" onclick="campaignModal()">أضف أول حملة</button></div>`;
  return kbHTML(WORK_STAGES, S.work.campaigns, c => {
    const late = c.due && c.due < today() && c.stage !== 'done';
    return `<div class="kb-card" draggable="true" data-card="${c.id}" onclick="campaignModal(S.work.campaigns.find(x=>x.id==='${c.id}'))">
      <b>${esc(c.title)}</b>
      <div class="m">
        ${c.channel ? `<span class="chip">${esc(c.channel)}</span>` : ''}
        ${c.owner ? `<span><i data-lucide="user" style="width:11px;height:11px"></i> ${esc(c.owner)}</span>` : ''}
        ${c.due ? `<span style="${late ? 'color:var(--bad);font-weight:700' : ''}">${late ? '⚠ ' : ''}${fmtShort(c.due)}</span>` : ''}
      </div></div>`;
  });
}
function campaignModal(c) {
  c = c || {};
  openModal(c.id ? 'تعديل حملة' : 'حملة جديدة',
    `${field('اسم الحملة', inputHTML('cmt', c.title, 'حملة العودة للمدارس…'))}
     <div class="grid2">
       ${field('القناة', `<select id="cmc"><option value="">— بلا قناة —</option>${WORK_CHANNELS.map(x => `<option ${c.channel === x ? 'selected' : ''}>${x}</option>`).join('')}</select>`)}
       ${field('المرحلة', `<select id="cms">${WORK_STAGES.map(s => `<option value="${s.k}" ${(c.stage || 'idea') === s.k ? 'selected' : ''}>${s.name}</option>`).join('')}</select>`)}
     </div>
     <div class="grid2">
       ${field('المسؤول من الفريق', inputHTML('cmo', c.owner, 'اسم الزميل'))}
       ${field('الموعد النهائي', inputHTML('cmd', c.due, '', 'date'))}
     </div>
     ${field('الموجز والملاحظات', `<textarea id="cmn" style="min-height:80px">${esc(c.notes || '')}</textarea>`)}`,
    `${c.id ? `<button class="btn ghost" onclick="closeModal();campaignDel('${c.id}')" style="margin-inline-end:auto;color:var(--bad)">حذف</button>` : ''}
     ${c.id ? `<button class="btn ghost" onclick="campaignToTask('${c.id}')">أضِفها للمهام</button>` : ''}
     <button class="btn ghost" onclick="closeModal()">إلغاء</button>
     <button class="btn primary" onclick="campaignSave('${c.id || ''}')">حفظ</button>`, { wide: true });
}
function campaignSave(id) {
  const title = $('#cmt').value.trim(); if (!title) { toast('اكتب اسم الحملة', 'bad'); return; }
  const o = { title, channel: $('#cmc').value, stage: $('#cms').value, owner: $('#cmo').value.trim(), due: $('#cmd').value, notes: $('#cmn').value };
  if (id) Object.assign(S.work.campaigns.find(x => x.id === id), o);
  else S.work.campaigns.unshift(Object.assign({ id: uid('cm'), createdAt: new Date().toISOString() }, o));
  save(); closeModal(); render(); toast('حُفظت');
}
function campaignDel(id) { S.work.campaigns = S.work.campaigns.filter(x => x.id !== id); save(); render(); }
function campaignToTask(id) {
  const c = S.work.campaigns.find(x => x.id === id); if (!c) return;
  S.tasks.unshift({ id: uid('t'), title: c.title, areaId: 'work', goalId: '', status: 'open', priority: 'mid',
                    due: c.due || '', est: 60, notes: c.notes || '', createdAt: new Date().toISOString(), doneAt: '' });
  save(); closeModal(); renderNav(); render(); toast('أُضيفت إلى المهام', 'good');
}

/* ---------- الاجتماعات ---------- */
function workMeetingsHTML() {
  const ms = S.work.meetings.slice().sort((a, b) => (b.date || '') < (a.date || '') ? -1 : 1);
  if (!ms.length)
    return `<div class="card pad empty"><i data-lucide="users-round"></i>
      <p>لا اجتماعات مسجّلة.<br>سجّل الخلاصة والإجراءات، وحوّل كل إجراء إلى مهمة.</p>
      <button class="btn primary xs" style="margin-top:12px" onclick="meetingModal()">سجّل أول اجتماع</button></div>`;
  return `<div class="sec-grid">${ms.map(m => `
    <section class="sec">
      <div class="sh"><i data-lucide="users-round"></i><h3>${esc(m.title)}</h3>
        <button class="icon-btn" onclick="meetingModal(S.work.meetings.find(x=>x.id==='${m.id}'))"><i data-lucide="pencil"></i></button></div>
      <div class="tiny muted" style="margin-bottom:8px">${m.date ? fmtDay(m.date) : 'بلا تاريخ'}${m.people ? ' · ' + esc(m.people) : ''}</div>
      ${m.summary ? `<p class="sm" style="white-space:pre-wrap;margin-bottom:10px">${esc(m.summary)}</p>` : ''}
      ${(m.actions || []).length ? `<div class="tiny muted" style="margin-bottom:4px">الإجراءات</div>
        <div class="list">${m.actions.map(a => `<div class="item" style="padding:6px 0">
          <span class="cbox ${a.taskId ? 'on' : ''}" onclick="actionToTask('${m.id}','${a.id}')" title="${a.taskId ? 'صارت مهمة' : 'حوّلها لمهمة'}"></span>
          <div class="t sm">${esc(a.text)}</div>
          ${a.taskId ? `<span class="tiny muted">في المهام</span>` : ''}</div>`).join('')}</div>` : ''}
    </section>`).join('')}</div>`;
}
function meetingModal(m) {
  m = m || {};
  openModal(m.id ? 'تعديل اجتماع' : 'اجتماع جديد',
    `${field('الموضوع', inputHTML('mgt', m.title, 'مراجعة خطة الربع…'))}
     <div class="grid2">
       ${field('التاريخ', inputHTML('mgd', m.date || today(), '', 'date'))}
       ${field('مع من', inputHTML('mgp', m.people, 'مدير التسويق، الوكالة…'))}
     </div>
     ${field('الخلاصة', `<textarea id="mgs" style="min-height:90px">${esc(m.summary || '')}</textarea>`)}
     ${field('الإجراءات', `<textarea id="mga" style="min-height:80px">${esc((m.actions || []).map(a => a.text).join('\n'))}</textarea>`,
       'إجراء في كل سطر — ثم حوّل ما تشاء منها إلى مهام بضغطة')}`,
    `${m.id ? `<button class="btn ghost" onclick="closeModal();meetingDel('${m.id}')" style="margin-inline-end:auto;color:var(--bad)">حذف</button>` : ''}
     <button class="btn ghost" onclick="closeModal()">إلغاء</button>
     <button class="btn primary" onclick="meetingSave('${m.id || ''}')">حفظ</button>`, { wide: true });
}
function meetingSave(id) {
  const title = $('#mgt').value.trim(); if (!title) { toast('اكتب موضوع الاجتماع', 'bad'); return; }
  const old = id ? (S.work.meetings.find(x => x.id === id).actions || []) : [];
  const lines = $('#mga').value.split('\n').map(s => s.trim()).filter(Boolean);
  /* نحتفظ بارتباط الإجراء بمهمته إن لم يتغيّر نصّه */
  const actions = lines.map(text => {
    const prev = old.find(a => a.text === text);
    return { id: prev ? prev.id : uid('ac'), text, taskId: prev ? prev.taskId : '' };
  });
  const o = { title, date: $('#mgd').value, people: $('#mgp').value.trim(), summary: $('#mgs').value, actions };
  if (id) Object.assign(S.work.meetings.find(x => x.id === id), o);
  else S.work.meetings.unshift(Object.assign({ id: uid('mg') }, o));
  save(); closeModal(); render(); toast('حُفظ');
}
function meetingDel(id) { S.work.meetings = S.work.meetings.filter(x => x.id !== id); save(); render(); }
function actionToTask(mid, aid) {
  const m = S.work.meetings.find(x => x.id === mid); if (!m) return;
  const a = (m.actions || []).find(x => x.id === aid); if (!a) return;
  if (a.taskId) { a.taskId = ''; save(); render(); return; }     // تراجُع: يفكّ الارتباط فقط
  S.tasks.unshift({ id: uid('t'), title: a.text, areaId: 'work', goalId: '', status: 'open', priority: 'mid',
                    due: '', est: 30, notes: 'من اجتماع: ' + m.title, createdAt: new Date().toISOString(), doneAt: '' });
  a.taskId = S.tasks[0].id;
  save(); renderNav(); render(); toast('صارت مهمة', 'good');
}

/* ---------- مؤشرات الأداء ---------- */
function workKPIsHTML() {
  if (!S.work.kpis.length)
    return `<div class="card pad empty"><i data-lucide="gauge"></i>
      <p>لا مؤشرات بعد.<br>ابدأ بمؤشرات مقترحة مشتقّة من وصفك الوظيفي، ثم عدّلها كما تشاء.</p>
      <div class="row" style="justify-content:center;gap:8px;margin-top:12px">
        <button class="btn primary xs" onclick="kpiSeed()">أضِف المؤشرات المقترحة</button>
        <button class="btn ghost xs" onclick="kpiModal()">مؤشّر من عندي</button></div></div>`;
  return `<div class="sec-grid">${S.work.kpis.map(k => {
    const pct = k.dir === 'down'
      ? (k.current ? clamp(Math.round(k.target / k.current * 100), 0, 100) : 0)
      : clamp(Math.round(k.current / (k.target || 1) * 100), 0, 100);
    const ok = pct >= 100;
    return `<section class="sec">
      <div class="sh"><i data-lucide="gauge"></i><h3>${esc(k.name)}</h3>
        <button class="icon-btn" onclick="kpiModal(S.work.kpis.find(x=>x.id==='${k.id}'))"><i data-lucide="pencil"></i></button></div>
      <div class="between" style="align-items:flex-end;margin-bottom:8px">
        <div class="big" style="font-size:26px">${k.current}<span class="tiny muted" style="font-weight:400"> ${esc(k.unit || '')}</span></div>
        <span class="tiny muted">الهدف ${k.dir === 'down' ? '≤ ' : ''}${k.target} ${esc(k.unit || '')} · ${esc(k.period || '')}</span>
      </div>
      <div style="height:6px;border-radius:4px;background:var(--surface3);overflow:hidden">
        <i style="display:block;height:100%;width:${pct}%;border-radius:4px;background:${ok ? 'var(--good)' : 'var(--accent)'}"></i></div>
      <div class="tiny muted" style="margin-top:5px">${pct}٪ من الهدف</div>
    </section>`;
  }).join('')}</div>`;
}
function kpiSeed() { S.work.kpis = workSuggestedKPIs(); save(); render(); toast('أُضيفت ٦ مؤشرات — عدّل أرقامها', 'good'); }
function kpiModal(k) {
  k = k || {};
  openModal(k.id ? 'تعديل مؤشّر' : 'مؤشّر جديد',
    `${field('اسم المؤشّر', inputHTML('kpn', k.name, 'ما الذي تقيسه؟'))}
     <div class="grid2">
       ${field('القيمة الحالية', inputHTML('kpc', k.current || 0, '', 'number'))}
       ${field('الهدف', inputHTML('kpt', k.target || 0, '', 'number'))}
     </div>
     <div class="grid2">
       ${field('الوحدة', inputHTML('kpu', k.unit, 'مادة، ٪، يوم…'))}
       ${field('الدورة', `<select id="kpp">${['أسبوعي', 'شهري', 'ربعي', 'سنوي'].map(x => `<option ${k.period === x ? 'selected' : ''}>${x}</option>`).join('')}</select>`)}
     </div>
     ${field('الاتجاه الجيّد', `<select id="kpd">
       <option value="up" ${k.dir !== 'down' ? 'selected' : ''}>كلما زاد كان أفضل</option>
       <option value="down" ${k.dir === 'down' ? 'selected' : ''}>كلما قلّ كان أفضل</option></select>`)}`,
    `${k.id ? `<button class="btn ghost" onclick="closeModal();kpiDel('${k.id}')" style="margin-inline-end:auto;color:var(--bad)">حذف</button>` : ''}
     <button class="btn ghost" onclick="closeModal()">إلغاء</button>
     <button class="btn primary" onclick="kpiSave('${k.id || ''}')">حفظ</button>`, { wide: true });
}
function kpiSave(id) {
  const name = $('#kpn').value.trim(); if (!name) { toast('اكتب اسم المؤشّر', 'bad'); return; }
  const o = { name, current: +$('#kpc').value || 0, target: +$('#kpt').value || 0, unit: $('#kpu').value.trim(), period: $('#kpp').value, dir: $('#kpd').value };
  if (id) Object.assign(S.work.kpis.find(x => x.id === id), o);
  else S.work.kpis.push(Object.assign({ id: uid('k') }, o));
  save(); closeModal(); render(); toast('حُفظ');
}
function kpiDel(id) { S.work.kpis = S.work.kpis.filter(x => x.id !== id); save(); render(); }
