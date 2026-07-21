/* ============================================================
   timebox.js — تخطيط اليوم بالكتل الزمنية (Time Boxing)
   مستوحى من مخطّط سعد الورقي: التاريخ · الأولويات · المهام · شريط الساعات
   ============================================================ */

let TB_DATE = today();

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
      </div>
    </div>

    <div class="tb-wrap">
      <aside class="tb-side">
        <!-- الأولويات -->
        <section class="card pad">
          <div class="between" style="margin-bottom:8px"><h3 style="font-size:14px">أولويات اليوم</h3>
            <span class="tiny muted">أهم ٣</span></div>
          ${[0, 1, 2].map(i => {
            const p = (S.priorities[d] || [])[i] || { id: 'p' + i, text: '', done: false };
            return `<div class="pri-slot ${p.done ? 'done' : ''}">
              <span class="n">${i + 1}</span>
              <span class="cbox ${p.done ? 'on' : ''}" onclick="togglePriority('${d}',${i})"></span>
              <input value="${esc(p.text)}" placeholder="أهم شيء…" onchange="setPriority('${d}',${i},this.value)">
            </div>`;
          }).join('')}
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
          <div class="between" style="margin-bottom:8px"><h3 style="font-size:14px">مراجعة اليوم</h3></div>
          ${tbReviewHTML(d)}
        </section>
      </aside>

      <section class="tb-grid" id="tbGrid">${tbGridHTML(d, st, en, step)}</section>
    </div>`;
  refreshIcons();
  tbBindDrag();
  if (d === today()) setTimeout(() => { const n = $('.slot.now'); if (n) n.scrollIntoView({ block: 'center', behavior: 'smooth' }); }, 200);
}

function tbGo(n) { TB_DATE = dayShift(TB_DATE, n); render(); }

/* ---------- الأولويات ---------- */
function setPriority(d, i, val) {
  S.priorities[d] = S.priorities[d] || [];
  S.priorities[d][i] = Object.assign({ id: 'p' + i, text: '', done: false }, S.priorities[d][i], { text: val });
  save();
}
function togglePriority(d, i) {
  S.priorities[d] = S.priorities[d] || [];
  if (typeof i === 'string') i = (S.priorities[d] || []).findIndex(p => p && p.id === i);
  if (i < 0) return;
  const p = S.priorities[d][i] = Object.assign({ id: 'p' + i, text: '', done: false }, S.priorities[d][i]);
  p.done = !p.done; save();
  if (CUR === 'timebox') render(); else repaintWidget('today');
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
    <span class="tiny muted">${t.est || 30}د</span></div>`).join('');
}

/* ---------- شريط الساعات ---------- */
function tbGridHTML(d, st, en, step) {
  const blocks = (S.blocks || []).filter(b => b.date === d).sort((a, b) => a.start - b.start);
  const now = new Date().getHours() * 60 + new Date().getMinutes();
  const isToday = d === today();
  let out = '';
  for (let m = st; m < en; m += step) {
    const inSlot = blocks.filter(b => b.start >= m && b.start < m + step);
    const isNow = isToday && now >= m && now < m + step;
    out += `<div class="slot ${m % 60 ? 'half' : ''} ${isNow ? 'now' : ''}">
      <div class="hr">${m % 60 === 0 ? minToLabel(m) : ':30'}</div>
      <div class="cell" data-min="${m}" ondblclick="tbAdd('${d}',${m})">
        ${inSlot.map(b => tbBlockHTML(b)).join('')}
      </div></div>`;
  }
  return out;
}
function tbBlockHTML(b) {
  const c = b.areaId ? areaColor(b.areaId) : 'var(--accent)';
  const dur = b.end - b.start;
  return `<div class="blk ${b.done ? 'done' : ''}" draggable="true" data-blk="${b.id}"
      style="border-inline-start-color:${c};background:${b.areaId ? hexA(c, .10) : 'var(--surface2)'}">
    <span class="cbox ${b.done ? 'on' : ''}" style="width:15px;height:15px" onclick="event.stopPropagation();tbDone('${b.id}')"></span>
    <span class="bt" onclick="tbEdit('${b.id}')">${esc(b.title)}</span>
    <span class="tiny muted">${dur}د</span>
    <button class="x icon-btn" style="width:20px;height:20px" onclick="event.stopPropagation();tbDel('${b.id}')"><i data-lucide="x"></i></button>
  </div>`;
}

/* ---------- السحب والإفلات ---------- */
function tbBindDrag() {
  const grid = $('#tbGrid'), pool = $('#tbPool');
  if (!grid) return;
  let payload = null;

  const start = (e, data) => { payload = data; e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', JSON.stringify(data)); } catch (x) { } };

  $$('.pi', pool).forEach(el => el.addEventListener('dragstart', e => { el.classList.add('dragging'); start(e, { kind: 'task', id: el.dataset.task }); }));
  $$('.pi', pool).forEach(el => el.addEventListener('dragend', () => el.classList.remove('dragging')));
  $$('.blk', grid).forEach(el => el.addEventListener('dragstart', e => start(e, { kind: 'block', id: el.dataset.blk })));

  $$('.cell', grid).forEach(cell => {
    cell.addEventListener('dragover', e => { e.preventDefault(); cell.classList.add('over'); });
    cell.addEventListener('dragleave', () => cell.classList.remove('over'));
    cell.addEventListener('drop', e => {
      e.preventDefault(); cell.classList.remove('over');
      let p = payload;
      if (!p) { try { p = JSON.parse(e.dataTransfer.getData('text/plain')); } catch (x) { return; } }
      const m = +cell.dataset.min;
      if (p.kind === 'task') tbDropTask(p.id, m);
      else if (p.kind === 'block') tbMoveBlock(p.id, m);
      payload = null;
    });
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
  if (b.taskId) { const t = (S.tasks || []).find(x => x.id === b.taskId); if (t) { t.status = b.done ? 'done' : 'open'; t.doneAt = b.done ? new Date().toISOString() : ''; } }
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
