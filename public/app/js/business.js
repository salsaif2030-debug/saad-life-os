/* ============================================================
   business.js — صفحة التجارة: مسار الصفقات + تقويم المحتوى التسويقي
   تستعمل محرّك الكانبان (kb*) المعرّف في work.js
   ============================================================ */

let BIZ_TAB = 'deals', BIZ_MONTH = '';        // BIZ_MONTH: 'YYYY-MM' لتقويم المحتوى

const DEAL_STAGES = [
  { k: 'lead',   name: 'تواصل أوّلي', dot: '#8a94a6' },
  { k: 'offer',  name: 'عرض مُقدَّم',  dot: '#5b8def' },
  { k: 'talk',   name: 'تفاوض',       dot: '#d99b3c' },
  { k: 'won',    name: 'مكسوبة',      dot: '#2fae94' },
  { k: 'lost',   name: 'مفقودة',      dot: '#e0635f' }
];
const CT_STAGES = [
  { k: 'idea',   name: 'فكرة' },
  { k: 'write',  name: 'كتابة' },
  { k: 'design', name: 'تصميم' },
  { k: 'sched',  name: 'مجدولة' },
  { k: 'live',   name: 'منشورة' }
];
const CT_PLATFORMS = ['إنستقرام', 'تويتر / X', 'لينكدإن', 'تيك توك', 'يوتيوب', 'سناب شات', 'نشرة بريدية', 'الموقع'];

function bizTab(k) { BIZ_TAB = k; render(); }
function bizMonth() { return BIZ_MONTH || today().slice(0, 7); }
function bizMonthShift(n) {
  const [y, m] = bizMonth().split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  BIZ_MONTH = d.getFullYear() + '-' + pad2(d.getMonth() + 1);
  render();
}

function renderBusiness() {
  const b = S.biz;
  const open = b.deals.filter(d => d.stage !== 'won' && d.stage !== 'lost');
  const pipe = open.reduce((a, d) => a + (+d.value || 0), 0);
  const won = b.deals.filter(d => d.stage === 'won').reduce((a, d) => a + (+d.value || 0), 0);
  const newBtn = BIZ_TAB === 'deals' ? ['صفقة جديدة', 'dealModal()'] : ['محتوى جديد', 'contentModal()'];

  $('#view').innerHTML = `
    <div class="page-head">
      <div><h1 class="serif">التجارة</h1>
        <div class="sub">${open.length} صفقة قائمة · ${pipe.toLocaleString('ar-SA')} ر.س في المسار · ${won.toLocaleString('ar-SA')} ر.س مكسوبة</div></div>
      <button class="btn primary" onclick="${newBtn[1]}"><i data-lucide="plus"></i> ${newBtn[0]}</button>
    </div>
    ${tabsHTML([['deals', 'الصفقات', b.deals.length], ['content', 'المحتوى', b.content.length]], BIZ_TAB, 'bizTab')}
    ${BIZ_TAB === 'deals' ? bizDealsHTML() : bizContentHTML()}`;
  refreshIcons();
  kbBind((id, st) => {
    const list = BIZ_TAB === 'deals' ? S.biz.deals : S.biz.content;
    if (kbMove(list, id, st)) { save(); render(); }
  });
}

/* ---------- مسار الصفقات ---------- */
function bizDealsHTML() {
  if (!S.biz.deals.length)
    return `<div class="card pad empty"><i data-lucide="handshake"></i>
      <p>لا صفقات بعد.<br>كل صفقة تتدرّج من التواصل الأوّلي إلى الإغلاق، واسحبها بين المراحل.</p>
      <button class="btn primary xs" style="margin-top:12px" onclick="dealModal()">أضف أول صفقة</button></div>`;
  return kbHTML(DEAL_STAGES, S.biz.deals, d => {
    const due = d.nextAt && d.nextAt < today();
    return `<div class="kb-card" draggable="true" data-card="${d.id}" onclick="dealModal(S.biz.deals.find(x=>x.id==='${d.id}'))">
      <b>${esc(d.name)}</b>
      <div class="m">
        ${d.company ? `<span>${esc(d.company)}</span>` : ''}
        ${+d.value ? `<span class="chip">${(+d.value).toLocaleString('ar-SA')} ر.س</span>` : ''}
      </div>
      ${d.nextStep ? `<div class="m" style="margin-top:5px">
        <i data-lucide="corner-down-left" style="width:11px;height:11px"></i>
        <span style="${due ? 'color:var(--bad);font-weight:700' : ''}">${esc(d.nextStep)}${d.nextAt ? ' · ' + fmtShort(d.nextAt) : ''}</span></div>` : ''}
    </div>`;
  });
}
function dealModal(d) {
  d = d || {};
  openModal(d.id ? 'تعديل صفقة' : 'صفقة جديدة',
    `${field('اسم الصفقة', inputHTML('dln', d.name, 'توريد، رعاية، عقد سنوي…'))}
     <div class="grid2">
       ${field('الجهة', inputHTML('dlc', d.company, 'اسم الشركة أو العميل'))}
       ${field('القيمة المتوقّعة (ر.س)', inputHTML('dlv', d.value, '0', 'number'))}
     </div>
     <div class="grid2">
       ${field('المرحلة', `<select id="dls">${DEAL_STAGES.map(s => `<option value="${s.k}" ${(d.stage || 'lead') === s.k ? 'selected' : ''}>${s.name}</option>`).join('')}</select>`)}
       ${field('جهة الاتصال', inputHTML('dlp', d.contact, 'الاسم أو الجوال'))}
     </div>
     <div class="grid2">
       ${field('الخطوة التالية', inputHTML('dlx', d.nextStep, 'اتّصل، أرسل العرض…'))}
       ${field('موعدها', inputHTML('dla', d.nextAt, '', 'date'))}
     </div>
     ${field('ملاحظات', `<textarea id="dlt" style="min-height:70px">${esc(d.notes || '')}</textarea>`)}`,
    `${d.id ? `<button class="btn ghost" onclick="closeModal();dealDel('${d.id}')" style="margin-inline-end:auto;color:var(--bad)">حذف</button>` : ''}
     ${d.id ? `<button class="btn ghost" onclick="dealToTask('${d.id}')">اجعل الخطوة التالية مهمة</button>` : ''}
     <button class="btn ghost" onclick="closeModal()">إلغاء</button>
     <button class="btn primary" onclick="dealSave('${d.id || ''}')">حفظ</button>`, { wide: true });
}
function dealSave(id) {
  const name = $('#dln').value.trim(); if (!name) { toast('اكتب اسم الصفقة', 'bad'); return; }
  const o = { name, company: $('#dlc').value.trim(), value: +$('#dlv').value || 0, stage: $('#dls').value,
              contact: $('#dlp').value.trim(), nextStep: $('#dlx').value.trim(), nextAt: $('#dla').value, notes: $('#dlt').value };
  if (id) Object.assign(S.biz.deals.find(x => x.id === id), o);
  else S.biz.deals.unshift(Object.assign({ id: uid('dl'), createdAt: new Date().toISOString() }, o));
  save(); closeModal(); render(); toast('حُفظت');
}
function dealDel(id) { S.biz.deals = S.biz.deals.filter(x => x.id !== id); save(); render(); }
function dealToTask(id) {
  const d = S.biz.deals.find(x => x.id === id); if (!d) return;
  if (!d.nextStep) { toast('اكتب الخطوة التالية أولاً', 'bad'); return; }
  S.tasks.unshift({ id: uid('t'), title: d.nextStep + ' — ' + (d.company || d.name), areaId: 'business', goalId: '',
                    status: 'open', priority: 'mid', due: d.nextAt || '', est: 30, notes: d.notes || '',
                    createdAt: new Date().toISOString(), doneAt: '' });
  save(); closeModal(); renderNav(); render(); toast('أُضيفت إلى المهام', 'good');
}

/* ---------- المحتوى: لوح مراحل + تقويم الشهر ---------- */
function bizContentHTML() {
  if (!S.biz.content.length)
    return `<div class="card pad empty"><i data-lucide="calendar-days"></i>
      <p>لا محتوى مجدول.<br>اكتب الفكرة، ثم مرّرها: كتابة ← تصميم ← جدولة ← نشر.</p>
      <button class="btn primary xs" style="margin-top:12px" onclick="contentModal()">أضف أول محتوى</button></div>`;
  return `${bizContentCalHTML()}
    <h3 style="font-size:15px;margin:22px 0 12px">مراحل الإنتاج</h3>
    ${kbHTML(CT_STAGES, S.biz.content, c => `
      <div class="kb-card" draggable="true" data-card="${c.id}" onclick="contentModal(S.biz.content.find(x=>x.id==='${c.id}'))">
        <b>${esc(c.title)}</b>
        <div class="m">
          ${c.platform ? `<span class="chip">${esc(c.platform)}</span>` : ''}
          ${c.date ? `<span>${fmtShort(c.date)}</span>` : ''}
        </div></div>`)}`;
}
function bizContentCalHTML() {
  const ym = bizMonth(), [y, m] = ym.split('-').map(Number);
  const days = new Date(y, m, 0).getDate();
  const lead = (new Date(y, m - 1, 1).getDay() + 1) % 7;     // الأسبوع يبدأ السبت
  const names = ['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'];
  let cells = names.map(n => `<div class="cal-h">${n}</div>`).join('');
  for (let i = 0; i < lead; i++) cells += `<div class="cal-d empty"></div>`;
  for (let d = 1; d <= days; d++) {
    const iso = y + '-' + pad2(m) + '-' + pad2(d);
    const items = S.biz.content.filter(c => c.date === iso);
    cells += `<div class="cal-d ${iso === today() ? 'now' : ''}" ondblclick="contentModal({date:'${iso}'})">
      <span class="dn">${d}</span>
      ${items.map(c => `<button class="cal-i ${c.stage || 'idea'}" onclick="event.stopPropagation();contentModal(S.biz.content.find(x=>x.id==='${c.id}'))"
          title="${esc(c.title)}">${esc(c.title)}</button>`).join('')}</div>`;
  }
  return `<div class="between" style="margin-bottom:10px">
      <h3 style="font-size:15px">تقويم النشر</h3>
      <div class="row" style="gap:4px">
        <button class="icon-btn" onclick="bizMonthShift(-1)"><i data-lucide="chevron-right"></i></button>
        <span class="sm" style="min-width:110px;text-align:center">${new Date(y, m - 1, 1).toLocaleDateString('ar-SA-u-ca-gregory', { month: 'long', year: 'numeric' })}</span>
        <button class="icon-btn" onclick="bizMonthShift(1)"><i data-lucide="chevron-left"></i></button>
      </div></div>
    <div class="card pad"><div class="cal">${cells}</div>
      <p class="tiny muted" style="margin-top:10px">نقرتان على أي يوم تضيفان محتوى فيه.</p></div>`;
}
function contentModal(c) {
  c = c || {};
  openModal(c.id ? 'تعديل محتوى' : 'محتوى جديد',
    `${field('العنوان', inputHTML('ctt', c.title, 'ما هذا المحتوى؟'))}
     <div class="grid2">
       ${field('المنصّة', `<select id="ctp"><option value="">— بلا منصّة —</option>${CT_PLATFORMS.map(x => `<option ${c.platform === x ? 'selected' : ''}>${x}</option>`).join('')}</select>`)}
       ${field('المرحلة', `<select id="cts">${CT_STAGES.map(s => `<option value="${s.k}" ${(c.stage || 'idea') === s.k ? 'selected' : ''}>${s.name}</option>`).join('')}</select>`)}
     </div>
     <div class="grid2">
       ${field('تاريخ النشر', inputHTML('ctd', c.date, '', 'date'))}
       ${field('رابط المادة', inputHTML('ctl', c.link, 'رابط الملف أو المنشور'))}
     </div>
     ${field('الموجز', `<textarea id="ctb" style="min-height:80px">${esc(c.brief || '')}</textarea>`)}`,
    `${c.id ? `<button class="btn ghost" onclick="closeModal();contentDel('${c.id}')" style="margin-inline-end:auto;color:var(--bad)">حذف</button>` : ''}
     ${c.id ? `<button class="btn ghost" onclick="contentToTask('${c.id}')">أضِفه للمهام</button>` : ''}
     <button class="btn ghost" onclick="closeModal()">إلغاء</button>
     <button class="btn primary" onclick="contentSave('${c.id || ''}')">حفظ</button>`, { wide: true });
}
function contentSave(id) {
  const title = $('#ctt').value.trim(); if (!title) { toast('اكتب عنوان المحتوى', 'bad'); return; }
  const o = { title, platform: $('#ctp').value, stage: $('#cts').value, date: $('#ctd').value, link: $('#ctl').value.trim(), brief: $('#ctb').value };
  if (id) Object.assign(S.biz.content.find(x => x.id === id), o);
  else S.biz.content.unshift(Object.assign({ id: uid('ct'), createdAt: new Date().toISOString() }, o));
  save(); closeModal(); render(); toast('حُفظ');
}
function contentDel(id) { S.biz.content = S.biz.content.filter(x => x.id !== id); save(); render(); }
function contentToTask(id) {
  const c = S.biz.content.find(x => x.id === id); if (!c) return;
  S.tasks.unshift({ id: uid('t'), title: c.title + (c.platform ? ' — ' + c.platform : ''), areaId: 'content', goalId: '',
                    status: 'open', priority: 'mid', due: c.date || '', est: 60, notes: c.brief || '',
                    createdAt: new Date().toISOString(), doneAt: '' });
  save(); closeModal(); renderNav(); render(); toast('أُضيف إلى المهام', 'good');
}
