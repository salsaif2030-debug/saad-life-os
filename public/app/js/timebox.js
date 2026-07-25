/* ============================================================
   timebox.js — تخطيط اليوم بالكتل الزمنية (Time Boxing)
   مستوحى من مخطّط سعد الورقي: التاريخ · الأولويات · المهام · شريط الساعات
   ============================================================ */

let TB_DATE = today(), TB_SEEN = '';

function renderTimebox(dateArg) {
  if (dateArg) TB_DATE = dateArg;
  const d = TB_DATE;
  const st = labelToMin(S.settings.dayStart || '05:00');
  const en = labelToMin(S.settings.dayEnd === '24:00' ? '24:00' : (S.settings.dayEnd || '24:00'));
  const step = +S.settings.slotMin || 30;
  const blocks = (S.blocks || []).filter(b => b.date === d);
  const planned = blocks.reduce((a, b) => a + (b.end - b.start), 0);
  const doneMin = blocks.filter(b => b.done).reduce((a, b) => a + (b.end - b.start), 0);

  $('#view').innerHTML = `
    <div class="page-head">
      <div>
        <h1>تخطيط اليوم</h1>
        <div class="sub">${fmtDay(d)} · مخطَّط ${Math.round(planned / 60 * 10) / 10} ساعة${planned ? ` · مُنجز ${Math.round(doneMin / planned * 100)}٪` : ''}</div>
      </div>
      <div class="row">
        <button class="icon-btn" onclick="tbGo(-1)" title="أمس"><i data-lucide="chevron-right"></i></button>
        <input type="date" value="${d}" onchange="TB_DATE=this.value;render()" style="max-width:154px;font-size:13px;padding:7px 10px">
        <button class="icon-btn" onclick="tbGo(1)" title="غداً"><i data-lucide="chevron-left"></i></button>
        <button class="btn ghost xs" onclick="TB_DATE=today();render()">اليوم</button>
        <button class="btn ghost xs" onclick="tbCopyPrev()" title="انسخ خطة الأمس"><i data-lucide="copy"></i> نسخ الأمس</button>
        <button class="icon-btn" onclick="toggleSidebar()" title="وسّع الشاشة"><i data-lucide="maximize-2"></i></button>
      </div>
    </div>

    <div class="tb-wrap">
      <aside class="tb-side">
        <!-- الأولويات -->
        <section class="card pad">
          <div class="between" style="margin-bottom:8px"><h3 style="font-size:14px">أولويات اليوم</h3>
            <span class="tiny muted">أهم ٣</span></div>
          ${[0, 1, 2].map(i => {
            const p = (S.priorities[d] || [])[i] || { id: 'p' + i, text: '', done: false, taskId: '' };
            const t = p.taskId ? (S.tasks || []).find(x => x.id === p.taskId) : null;
            return `<div class="pri-slot ${p.done ? 'done' : ''}">
              <span class="n">${i + 1}</span>
              <span class="cbox ${p.done ? 'on' : ''}" onclick="togglePriority('${d}',${i})"></span>
              <input value="${esc(p.text)}" placeholder="أهم شيء…" onchange="setPriority('${d}',${i},this.value)">
              ${t ? `<button class="icon-btn on" onclick="taskModal(S.tasks.find(x=>x.id==='${t.id}'))"
                       title="مرتبطة بمهمة — افتحها"><i data-lucide="check-square"></i></button>` : ''}
            </div>`;
          }).join('')}
          <p class="tiny muted" style="margin-top:8px">ما تكتبه هنا يصير مهمة في قائمة المهام تلقائياً.</p>
        </section>

        <!-- ما يستحقّ وقتك: كل ما ينتظر قرارك قبل أن تخطّط -->
        <section class="card pad">
          <div class="between" style="margin-bottom:8px"><h3 style="font-size:14px">ما يستحقّ وقتك</h3></div>
          ${tbSignalsHTML(d)}
          <div class="qlinks" style="margin-top:12px">${tbQuickLinksHTML()}</div>
        </section>

        <!-- المهام غير المجدولة -->
        <section class="card pad">
          <div class="between" style="margin-bottom:9px"><h3 style="font-size:14px">المهام</h3>
            <button class="icon-btn" onclick="taskModal({due:'${d}'})" title="مهمة جديدة"><i data-lucide="plus"></i></button></div>
          <p class="tiny muted" style="margin-bottom:9px">اسحب أي مهمة إلى شريط الساعات</p>
          <div class="pool" id="tbPool">${tbPoolHTML(d)}</div>
        </section>

        <!-- مراجعة اليوم -->
        <section class="card pad">
          <div class="between" style="margin-bottom:8px"><h3 style="font-size:14px">مراجعة اليوم</h3>
            <button class="icon-btn" onclick="go('daily','${d}')" title="افتح صفحة المراجعة"><i data-lucide="arrow-left"></i></button></div>
          ${tbReviewHTML(d)}
        </section>
      </aside>

      <section class="tb-grid" id="tbGrid">${tbGridHTML(d, st, en, step)}</section>
    </div>`;
  refreshIcons();
  tbBindDrag();
  /* ننزل إلى الساعة الحالية عند فتح اليوم أول مرة فقط، لا مع كل إعادة رسم */
  if (d === today() && TB_SEEN !== d) {
    TB_SEEN = d;
    setTimeout(() => { const n = $('.slot.now'); if (n) n.scrollIntoView({ block: 'center', behavior: 'smooth' }); }, 200);
  }
}

/* ---------- إشارات: ماذا ينتظرك قبل أن تخطّط ---------- */
function tbSignalsHTML(d) {
  const inbox = (S.capture || []).filter(c => !c.done).length;
  const late = (S.tasks || []).filter(t => t.status !== 'done' && t.due && t.due < d).length;
  const due = (S.tasks || []).filter(t => t.status !== 'done' && t.due === d).length;
  const lg = (S.habits.log || {})[d] || {};
  const habits = (S.habits.list || []).filter(h => !h.archived && !lg[h.id]).length;
  const goals = (S.goals || []).filter(g => !g.done && g.due && g.due <= dayShift(d, 7)).length;
  const rows = [
    ['inbox', 'صندوق الوارد', inbox, `go('notes')`, false],
    ['alert-triangle', 'مهام متأخّرة', late, `TASK_FILTER='today';go('tasks')`, true],
    ['calendar-check', 'مستحقّ اليوم', due, `TASK_FILTER='today';go('tasks')`, false],
    ['repeat', 'عادات لم تُنجز', habits, `go('dashboard')`, false],
    ['target', 'أهداف تقترب', goals, `go('review')`, false]
  ].filter(r => r[2] > 0);
  if (!rows.length) return `<p class="tiny muted">لا شيء معلّق — الوقت كله لك، خطّطه كما تحب.</p>`;
  return rows.map(([ic, label, n, act, warn]) => `<div class="sig ${warn ? 'warn' : ''}" onclick="${act}">
    <i data-lucide="${ic}"></i><span class="grow">${label}</span><span class="n">${n}</span></div>`).join('');
}

/* روابط ما يصلك من خارج النظام: البريد، التقويم، المفكّرة */
function tbQuickLinksHTML() {
  const want = ['التقويم', 'Gmail', 'Keep'];
  const links = (S.links || []).filter(l => want.some(w => (l.label || '').includes(w)));
  if (!links.length) return `<span class="tiny muted">أضِف روابطك من ويدجت «أدواتي».</span>`;
  return links.map(l => `<a href="${esc(l.url)}" target="_blank" rel="noopener">
    <i data-lucide="${esc(l.icon || 'link')}"></i>${esc(l.label)}</a>`).join('');
}

function tbGo(n) { TB_DATE = dayShift(TB_DATE, n); render(); }

/* ---------- الأولويات ----------
   كل أولوية مرتبطة بمهمة حقيقية في قائمة المهام (taskId):
   تكتبها هنا فتظهر في المهام، وتُنجزها هناك فتُشطب هنا — والعكس. */
function priSlot(d, i) {
  S.priorities[d] = S.priorities[d] || [];
  return (S.priorities[d][i] = Object.assign({ id: 'p' + i, text: '', done: false, taskId: '' }, S.priorities[d][i]));
}
function priTask(p) { return p && p.taskId ? (S.tasks || []).find(t => t.id === p.taskId) || null : null; }

function setPriority(d, i, val) {
  const p = priSlot(d, i), txt = String(val || '').trim();
  p.text = txt;
  const t = priTask(p);
  if (!txt) p.taskId = '';                       // مسح النص يفكّ الارتباط ولا يحذف المهمة
  else if (t) t.title = txt;                     // تعديل النص يعيد تسمية المهمة المرتبطة
  else {
    const same = (S.tasks || []).find(x => x.status !== 'done' && x.title === txt);
    if (same) { p.taskId = same.id; if (!same.due) same.due = d; }
    else {
      const nt = { id: uid('t'), title: txt, areaId: '', goalId: '', status: 'open', priority: 'high',
                   due: d, est: 30, notes: '', createdAt: new Date().toISOString(), doneAt: '' };
      S.tasks.unshift(nt); p.taskId = nt.id;
    }
  }
  save(); renderNav();
  if (CUR === 'timebox') render(); else repaintWidget('today');
}
function togglePriority(d, i) {
  if (typeof i === 'string') i = (S.priorities[d] || []).findIndex(p => p && p.id === i);
  if (i < 0) return;
  const p = priSlot(d, i);
  p.done = !p.done;
  const t = priTask(p);
  if (t) { t.status = p.done ? 'done' : 'open'; t.doneAt = p.done ? new Date().toISOString() : ''; }
  save(); renderNav();
  if (CUR === 'timebox') render(); else repaintWidget('today');
}
/* إنجاز المهمة من أي شاشة يُشطب الأولوية المرتبطة بها */
function syncPrioritiesFromTask(t) {
  Object.keys(S.priorities || {}).forEach(d => (S.priorities[d] || []).forEach(p => {
    if (p && p.taskId === t.id) p.done = t.status === 'done';
  }));
}
function priorityOfTask(id, d) {
  return (S.priorities[d || today()] || []).findIndex(p => p && p.taskId === id);
}
/* رفع مهمة إلى أولويات اليوم الثلاث (أو إنزالها منها) */
function taskToPriority(id) {
  const d = today(), t = (S.tasks || []).find(x => x.id === id); if (!t) return;
  const cur = priorityOfTask(id, d);
  if (cur >= 0) {
    S.priorities[d][cur] = { id: 'p' + cur, text: '', done: false, taskId: '' };
    save(); renderNav(); render(); toast('أُزيلت من أولويات اليوم');
    return;
  }
  let slot = -1;
  for (let i = 0; i < 3; i++) { const p = (S.priorities[d] || [])[i]; if (!p || !(p.text || '').trim()) { slot = i; break; } }
  if (slot < 0) { toast('أولويات اليوم الثلاث ممتلئة — أفرغ واحدة أولاً', 'bad'); return; }
  S.priorities[d] = S.priorities[d] || [];
  S.priorities[d][slot] = { id: 'p' + slot, text: t.title, done: t.status === 'done', taskId: t.id };
  if (!t.due) t.due = d;
  save(); renderNav(); render(); toast('صارت من أولويات اليوم', 'good');
}

/* ---------- بركة المهام ---------- */
function tbPoolHTML(d) {
  const scheduled = new Set((S.blocks || []).filter(b => b.date === d && b.taskId).map(b => b.taskId));
  const ts = (S.tasks || []).filter(t => t.status !== 'done' && !scheduled.has(t.id))
    .filter(t => !t.due || t.due <= dayShift(d, 7))
    .sort(taskSort).slice(0, 14);
  if (!ts.length) return `<p class="tiny muted">لا مهام غير مجدولة.</p>`;
  return ts.map(t => `<div class="pi" draggable="true" data-task="${t.id}">
    <span class="pri ${t.priority || 'none'}"></span>
    <span class="grow truncate">${esc(t.title)}</span>
    ${priorityOfTask(t.id, d) >= 0 ? `<i data-lucide="star" style="width:13px;height:13px;color:var(--accent)"></i>` : ''}
    <span class="tiny muted">${t.est || 30}د</span></div>`).join('');
}

/* ---------- شريط الساعات ---------- */

/* ارتفاع الفترة الواحدة بالبكسل — يكبر بكبر الفترة ليبقى نصف الساعة مقروءاً */
function tbSlotH(step) { return step <= 15 ? 26 : step <= 30 ? 38 : 64; }

/* الكتل المتداخلة تُقسم أعمدة جنباً إلى جنب: {blkId:{i:رقم العمود, of:عدد الأعمدة}} */
function tbLanes(blocks) {
  const map = {};
  let group = [], gEnd = -1;
  const flush = () => {
    if (!group.length) return;
    const colEnd = [];
    group.forEach(b => {
      let i = colEnd.findIndex(e => e <= b.start);
      if (i < 0) i = colEnd.length;
      colEnd[i] = b.end; map[b.id] = { i: i };
    });
    group.forEach(b => map[b.id].of = colEnd.length);
    group = [];
  };
  blocks.forEach(b => {
    if (group.length && b.start >= gEnd) { flush(); gEnd = -1; }
    group.push(b); gEnd = Math.max(gEnd, b.end);
  });
  flush();
  return map;
}

function tbGridHTML(d, st, en, step) {
  const blocks = (S.blocks || []).filter(b => b.date === d).sort((a, b) => (a.start - b.start) || (b.end - a.end));
  const now = new Date().getHours() * 60 + new Date().getMinutes();
  const isToday = d === today();
  const h = tbSlotH(step), ppm = h / step;
  let rows = '';
  for (let m = st; m < en; m += step) {
    const isNow = isToday && now >= m && now < m + step;
    rows += `<div class="slot ${m % 60 ? 'half' : ''} ${isNow ? 'now' : ''}">
      <div class="hr">${m % 60 === 0 ? minToLabel(m) : ':' + pad2(m % 60)}</div>
      <div class="cell"></div></div>`;
  }
  const lanes = tbLanes(blocks);
  const layer = blocks.map(b => tbBlockHTML(b, st, en, ppm, lanes[b.id])).join('');
  return `<div class="tb-track" id="tbTrack" style="--slotH:${h}px" data-st="${st}" data-en="${en}" data-step="${step}" data-date="${d}">
    <div class="tb-rows">${rows}</div>
    <div class="tb-layer">${layer}</div>
    <div class="dropline" id="tbDrop" style="top:0"></div>
  </div>`;
}

/* الكتلة تأخذ ارتفاعاً يساوي مدّتها فعلياً — ١٢٠ دقيقة أطول أربع مرات من ٣٠ */
function tbBlockHTML(b, st, en, ppm, lane) {
  const c = b.areaId ? areaColor(b.areaId) : 'var(--accent)';
  const dur = b.end - b.start;
  /* كتلة خارج ساعات اليوم تُقصّ إلى الحافة بدل أن تختفي */
  const s = clamp(b.start, st, en - 5);
  const e = clamp(b.end, s + 5, en);
  const top = (s - st) * ppm, hgt = (e - s) * ppm - 3;
  const of = (lane && lane.of) || 1, i = (lane && lane.i) || 0;
  const w = 100 / of;
  const short = hgt < 34;
  return `<div class="blk ${b.done ? 'done' : ''} ${short ? 'short' : ''}" draggable="true" data-blk="${b.id}"
      style="top:${Math.round(top)}px;height:${Math.round(hgt)}px;inset-inline-start:calc(${i * w}% + 5px);width:calc(${w}% - 10px);
             border-inline-start-color:${c};background:${b.areaId ? hexA(c, .12) : 'var(--surface2)'}">
    <div class="bh">
      <span class="cbox ${b.done ? 'on' : ''}" style="width:15px;height:15px" onclick="event.stopPropagation();tbDone('${b.id}')"></span>
      <span class="bt" onclick="tbEdit('${b.id}')">${esc(b.title)}</span>
      ${short ? `<span class="bd" style="display:block">${dur}د</span>` : ''}
      <button class="x icon-btn" style="width:20px;height:20px" onclick="event.stopPropagation();tbDel('${b.id}')"><i data-lucide="x"></i></button>
    </div>
    <span class="bd">${minToLabel(b.start)} — ${minToLabel(b.end)} · ${dur}د</span>
  </div>`;
}

/* ---------- السحب والإفلات ---------- */
/* الإفلات صار على الشريط كله لا على خانة بعينها — لأن الكتل تغطّي الخانات الآن */
function tbMinAt(track, clientY) {
  const st = +track.dataset.st, en = +track.dataset.en, step = +track.dataset.step;
  const rect = track.getBoundingClientRect();
  const h = tbSlotH(step);
  const idx = Math.floor((clientY - rect.top) / h);
  return clamp(st + idx * step, st, en - step);
}
function tbBindDrag() {
  const track = $('#tbTrack'), pool = $('#tbPool');
  if (!track) return;
  const line = $('#tbDrop'), h = tbSlotH(+track.dataset.step), st = +track.dataset.st;
  let payload = null;

  const start = (e, data) => { payload = data; e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', JSON.stringify(data)); } catch (x) { } };

  $$('.pi', pool).forEach(el => {
    el.addEventListener('dragstart', e => { el.classList.add('dragging'); start(e, { kind: 'task', id: el.dataset.task }); });
    el.addEventListener('dragend', () => el.classList.remove('dragging'));
  });
  $$('.blk', track).forEach(el => el.addEventListener('dragstart', e => start(e, { kind: 'block', id: el.dataset.blk })));

  track.addEventListener('dragover', e => {
    e.preventDefault();
    track.classList.add('dragging');
    if (line) line.style.top = ((tbMinAt(track, e.clientY) - st) / (+track.dataset.step) * h) + 'px';
  });
  track.addEventListener('dragleave', e => { if (!track.contains(e.relatedTarget)) track.classList.remove('dragging'); });
  track.addEventListener('drop', e => {
    e.preventDefault(); track.classList.remove('dragging');
    let p = payload;
    if (!p) { try { p = JSON.parse(e.dataTransfer.getData('text/plain')); } catch (x) { return; } }
    const m = tbMinAt(track, e.clientY);
    if (p.kind === 'task') tbDropTask(p.id, m);
    else if (p.kind === 'block') tbMoveBlock(p.id, m);
    payload = null;
  });
  /* نقرتان على فراغ في الشريط تفتحان كتلة جديدة عند تلك الساعة */
  track.addEventListener('dblclick', e => {
    if (e.target.closest('.blk')) return;
    tbAdd(track.dataset.date, tbMinAt(track, e.clientY));
  });
}
function tbDropTask(taskId, min) {
  const t = (S.tasks || []).find(x => x.id === taskId); if (!t) return;
  const step = +S.settings.slotMin || 30;
  const dur = Math.max(step, Math.ceil((t.est || 30) / step) * step);
  S.blocks.push({ id: uid('b'), date: TB_DATE, start: min, end: min + dur, title: t.title, taskId: t.id, areaId: t.areaId, type: 'focus', done: false, notes: '' });
  save(); render();
}
function tbMoveBlock(id, min) {
  const b = (S.blocks || []).find(x => x.id === id); if (!b) return;
  const dur = b.end - b.start; b.start = min; b.end = min + dur;
  save(); render();
}
function tbAdd(d, min) {
  const step = +S.settings.slotMin || 30;
  openModal('كتلة زمنية جديدة',
    `${field('العنوان', inputHTML('bt', '', 'ماذا ستفعل في هذه الكتلة؟'))}
     <div class="grid2">
       ${field('من', `<input id="bs" type="time" value="${pad2(Math.floor(min / 60))}:${pad2(min % 60)}">`)}
       ${field('إلى', `<input id="be" type="time" value="${pad2(Math.floor((min + step) / 60) % 24)}:${pad2((min + step) % 60)}">`)}
     </div>
     ${field('الجانب', areaSelect('ba', '', true))}
     ${field('نوع الكتلة', `<select id="bty">${[['focus', 'عمل عميق'], ['routine', 'روتين'], ['meeting', 'موعد/اجتماع'], ['break', 'راحة'], ['personal', 'شخصي']].map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select>`)}`,
    `<button class="btn ghost" onclick="closeModal()">إلغاء</button><button class="btn primary" onclick="tbSave('','${d}')">أضف</button>`);
}
function tbEdit(id) {
  const b = (S.blocks || []).find(x => x.id === id); if (!b) return;
  openModal('تعديل الكتلة',
    `${field('العنوان', inputHTML('bt', b.title, ''))}
     <div class="grid2">
       ${field('من', `<input id="bs" type="time" value="${pad2(Math.floor(b.start / 60))}:${pad2(b.start % 60)}">`)}
       ${field('إلى', `<input id="be" type="time" value="${pad2(Math.floor(b.end / 60) % 24)}:${pad2(b.end % 60)}">`)}
     </div>
     ${field('الجانب', areaSelect('ba', b.areaId, true))}
     ${field('نوع الكتلة', `<select id="bty">${[['focus', 'عمل عميق'], ['routine', 'روتين'], ['meeting', 'موعد/اجتماع'], ['break', 'راحة'], ['personal', 'شخصي']].map(([v, l]) => `<option value="${v}" ${b.type === v ? 'selected' : ''}>${l}</option>`).join('')}</select>`)}
     ${field('ملاحظات', `<textarea id="bn" style="min-height:60px">${esc(b.notes || '')}</textarea>`)}`,
    `<button class="btn ghost" onclick="closeModal();tbDel('${b.id}')" style="margin-inline-end:auto;color:var(--bad)">حذف</button>
     <button class="btn ghost" onclick="closeModal()">إلغاء</button><button class="btn primary" onclick="tbSave('${b.id}','${b.date}')">حفظ</button>`, { wide: true });
}
function tbSave(id, d) {
  const title = $('#bt').value.trim(); if (!title) { toast('اكتب عنوان الكتلة', 'bad'); return; }
  let s = labelToMin($('#bs').value), e = labelToMin($('#be').value);
  if (e <= s) e = s + (+S.settings.slotMin || 30);
  const o = { title, start: s, end: e, areaId: $('#ba').value, type: $('#bty').value, notes: $('#bn') ? $('#bn').value : '' };
  if (id) Object.assign(S.blocks.find(x => x.id === id), o);
  else S.blocks.push(Object.assign({ id: uid('b'), date: d, taskId: '', done: false }, o));
  save(); closeModal(); render(); toast('حُفظت');
}
function tbDel(id) { S.blocks = (S.blocks || []).filter(b => b.id !== id); save(); render(); }
function tbDone(id) {
  const b = (S.blocks || []).find(x => x.id === id); if (!b) return;
  b.done = !b.done;
  if (b.taskId) {
    const t = (S.tasks || []).find(x => x.id === b.taskId);
    if (t) { t.status = b.done ? 'done' : 'open'; t.doneAt = b.done ? new Date().toISOString() : ''; syncPrioritiesFromTask(t); }
  }
  save(); render();
}
function tbCopyPrev() {
  const prev = dayShift(TB_DATE, -1);
  const src = (S.blocks || []).filter(b => b.date === prev);
  if (!src.length) { toast('لا خطة في اليوم السابق', 'bad'); return; }
  src.forEach(b => S.blocks.push(Object.assign({}, b, { id: uid('b'), date: TB_DATE, done: false })));
  save(); render(); toast(`نُسخت ${src.length} كتلة`, 'good');
}

/* ---------- مراجعة اليوم داخل الصفحة ---------- */
function tbReviewHTML(d) {
  const r = S.reviews[d];
  const blocks = (S.blocks || []).filter(b => b.date === d);
  const done = blocks.filter(b => b.done).length;
  const byArea = {};
  blocks.forEach(b => { const k = b.areaId || '_'; byArea[k] = (byArea[k] || 0) + (b.end - b.start); });
  const top = Object.entries(byArea).sort((a, b) => b[1] - a[1]).slice(0, 3);
  return `
    <div class="tiny muted" style="margin-bottom:6px">${done} من ${blocks.length} كتلة مُنجزة</div>
    ${top.length ? `<div style="margin-bottom:10px">${top.map(([k, mins]) => `
      <div class="row" style="gap:7px;font-size:12.5px;padding:2px 0">
        <span class="dot" style="background:${k === '_' ? 'var(--muted)' : areaColor(k)}"></span>
        <span class="grow">${k === '_' ? 'بلا جانب' : esc(areaName(k))}</span>
        <span class="muted">${Math.round(mins / 60 * 10) / 10} س</span></div>`).join('')}</div>` : ''}
    ${r ? `<p class="sm" style="margin-bottom:8px"><b>الأفضل:</b> ${esc(r.win || '—')}</p>` : ''}
    <button class="btn ${r ? 'soft' : 'primary'} xs" style="width:100%" onclick="reviewModal('${d}')">${r ? 'تعديل المراجعة' : 'أغلق اليوم بمراجعة'}</button>`;
}
