/* ============================================================
   canvas.js — المساحة الحرة: لوح لا نهائي على فكرة Freeform
   ألواح مستقلة، كل لوح فيه بطاقات تُسحب وتُكتب وتُلوَّن.
   ============================================================ */

let CV_BOARD = '';                          // اللوح المفتوح حالياً
const CV = { pan: { x: 0, y: 0 }, zoom: 1, drag: null, sel: '' };

const CV_COLORS = ['#f7d774', '#f2a2a2', '#a8d5b5', '#a5c4ea', '#d3b8e8', '#e8ddc8', 'transparent'];
const CV_KINDS = {
  note: { name: 'ملاحظة', icon: 'sticky-note', w: 190, h: 130 },
  text: { name: 'نص',    icon: 'type',         w: 240, h: 60  },
  box:  { name: 'إطار',  icon: 'square',       w: 300, h: 220 },
  task: { name: 'مهمة',  icon: 'check-square', w: 210, h: 78  }
};

function cvBoard() { return (S.boards || []).find(b => b.id === CV_BOARD) || null; }

/* ---------- قائمة الألواح ---------- */
function renderCanvas(arg) {
  if (arg !== undefined) CV_BOARD = arg || '';
  const b = cvBoard();
  if (!b) return renderCanvasList();

  $('#view').innerHTML = `
    <div class="page-head">
      <div>
        <h1 class="serif" onclick="cvRename()" style="cursor:text" title="اضغط لتغيير الاسم">${esc(b.title)}</h1>
        <div class="sub">${(b.items || []).length} بطاقة · ${ago(b.updatedAt)}</div>
      </div>
      <div class="row">
        <button class="btn ghost xs" onclick="go('canvas','')"><i data-lucide="arrow-left"></i> كل الألواح</button>
        <button class="btn ghost xs" onclick="cvFit()" title="أظهر كل البطاقات"><i data-lucide="scan"></i> ضبط</button>
        <button class="icon-btn" onclick="toggleSidebar()" title="وسّع الشاشة"><i data-lucide="maximize-2"></i></button>
      </div>
    </div>

    <div class="cv-bar">
      ${Object.entries(CV_KINDS).map(([k, v]) => `<button class="btn ghost xs" onclick="cvAdd('${k}')">
        <i data-lucide="${v.icon}"></i> ${v.name}</button>`).join('')}
      <span class="grow"></span>
      <button class="icon-btn" onclick="cvZoom(-1)" title="تصغير"><i data-lucide="minus"></i></button>
      <span class="tiny muted" style="min-width:42px;text-align:center">${Math.round(CV.zoom * 100)}٪</span>
      <button class="icon-btn" onclick="cvZoom(1)" title="تكبير"><i data-lucide="plus"></i></button>
    </div>

    <div class="cv-stage" id="cvStage">
      <div class="cv-world" id="cvWorld">${(b.items || []).map(cvItemHTML).join('')}</div>
      ${(b.items || []).length ? '' : `<div class="cv-hint">
        <i data-lucide="mouse-pointer-click"></i>
        <p>اضغط نقرتين على أي مكان لتضع ملاحظة،<br>واسحب الخلفية لتتنقّل في اللوح.</p></div>`}
    </div>`;
  cvApplyView();
  refreshIcons();
  cvBind();
}

function renderCanvasList() {
  const bs = (S.boards || []).slice().sort((a, b) => (b.updatedAt || '') < (a.updatedAt || '') ? -1 : 1);
  $('#view').innerHTML = `
    <div class="page-head">
      <div><h1 class="serif">المساحة الحرة</h1><div class="sub">لوح مفتوح للأفكار — بلا ترتيب ولا قواعد</div></div>
      <button class="btn primary" onclick="cvNewBoard()"><i data-lucide="plus"></i> لوح جديد</button>
    </div>
    ${bs.length ? `<div class="areas-grid">${bs.map(b => `
      <button class="area-card" onclick="go('canvas','${b.id}')">
        <div class="ic" style="background:${hexA(S.settings.accent, .12)};color:var(--accent)"><i data-lucide="layout-template"></i></div>
        <h3>${esc(b.title)}</h3>
        <div class="meta">${(b.items || []).length} بطاقة · ${ago(b.updatedAt)}</div>
      </button>`).join('')}</div>`
    : `<div class="card pad empty"><i data-lucide="layout-template"></i>
        <p>لا ألواح بعد.<br>ابدأ لوحاً وارمِ فيه ما يدور في رأسك.</p>
        <button class="btn primary xs" style="margin-top:12px" onclick="cvNewBoard()">أنشئ أول لوح</button></div>`}`;
  refreshIcons();
}

function cvNewBoard() {
  openModal('لوح جديد', field('اسم اللوح', inputHTML('cvn', '', 'عصف ذهني، خطة حملة، أفكار محتوى…')),
    `<button class="btn ghost" onclick="closeModal()">إلغاء</button>
     <button class="btn primary" onclick="cvNewBoardSave()">أنشئ</button>`);
}
function cvNewBoardSave() {
  const title = $('#cvn').value.trim() || 'لوح بلا اسم';
  const b = { id: uid('bd'), title, items: [], updatedAt: new Date().toISOString() };
  S.boards.unshift(b); save(); closeModal();
  CV.pan = { x: 0, y: 0 }; CV.zoom = 1;
  go('canvas', b.id);
}
function cvRename() {
  const b = cvBoard(); if (!b) return;
  openModal('اسم اللوح', field('الاسم', inputHTML('cvn', b.title, '')),
    `<button class="btn ghost" onclick="closeModal();cvDeleteBoard()" style="margin-inline-end:auto;color:var(--bad)">حذف اللوح</button>
     <button class="btn ghost" onclick="closeModal()">إلغاء</button>
     <button class="btn primary" onclick="cvRenameSave()">حفظ</button>`);
}
function cvRenameSave() { const b = cvBoard(); b.title = $('#cvn').value.trim() || b.title; cvTouch(); closeModal(); render(); }
function cvDeleteBoard() {
  const b = cvBoard(); if (!b) return;
  confirmBox(`سيُحذف لوح «${b.title}» وكل بطاقاته.`, () => {
    S.boards = S.boards.filter(x => x.id !== b.id); save(); go('canvas', '');
  });
}

/* ---------- البطاقات ---------- */
function cvItemHTML(it) {
  const k = CV_KINDS[it.kind] || CV_KINDS.note;
  const bg = it.color && it.color !== 'transparent' ? it.color : '';
  const sel = CV.sel === it.id ? ' sel' : '';
  const inner = it.kind === 'task'
    ? `<div class="row" style="gap:8px;align-items:flex-start">
         <span class="cbox ${it.done ? 'on' : ''}" onpointerdown="event.stopPropagation()" onclick="cvToggleTask('${it.id}')"></span>
         <span class="cv-tx ${it.done ? 'off' : ''}">${esc(it.text || '')}</span></div>`
    : `<div class="cv-tx">${esc(it.text || '')}</div>`;
  return `<div class="cv-item ${it.kind}${sel}" data-it="${it.id}"
      style="left:${it.x}px;top:${it.y}px;width:${it.w}px;height:${it.h}px;${bg ? `background:${bg};` : ''}">
    ${inner}
    <span class="cv-rs" data-rs="${it.id}"></span>
  </div>`;
}

function cvAdd(kind, x, y) {
  const b = cvBoard(); if (!b) return;
  const k = CV_KINDS[kind] || CV_KINDS.note;
  /* بلا إحداثيات: ضعها في منتصف ما يراه المستخدم الآن */
  if (x === undefined) {
    const st = $('#cvStage'), r = st && st.getBoundingClientRect ? st.getBoundingClientRect() : { width: 900, height: 520 };
    x = (-CV.pan.x + r.width / 2) / CV.zoom - k.w / 2;
    y = (-CV.pan.y + r.height / 2) / CV.zoom - k.h / 2;
  }
  const it = { id: uid('cv'), kind, x: Math.round(x), y: Math.round(y), w: k.w, h: k.h,
               text: '', color: kind === 'note' ? CV_COLORS[0] : 'transparent', done: false };
  b.items.push(it); CV.sel = it.id; cvTouch(); render();
  setTimeout(() => cvEdit(it.id), 40);
}
function cvItem(id) { const b = cvBoard(); return b ? (b.items || []).find(i => i.id === id) : null; }
function cvTouch() { const b = cvBoard(); if (b) b.updatedAt = new Date().toISOString(); save(); }

function cvToggleTask(id) { const it = cvItem(id); if (!it) return; it.done = !it.done; cvTouch(); render(); }

function cvEdit(id) {
  const it = cvItem(id); if (!it) return;
  const k = CV_KINDS[it.kind] || CV_KINDS.note;
  openModal(k.name,
    `${field('النص', `<textarea id="cvt" style="min-height:110px">${esc(it.text || '')}</textarea>`)}
     ${field('اللون', `<div class="row" style="gap:7px;flex-wrap:wrap">${CV_COLORS.map(c => `
       <button onclick="cvSetColor('${id}','${c}')" title="${c === 'transparent' ? 'بلا لون' : ''}"
         style="width:26px;height:26px;border-radius:50%;border:2px solid ${it.color === c ? 'var(--ink)' : 'var(--line2)'};
                background:${c === 'transparent' ? 'var(--surface2)' : c}"></button>`).join('')}</div>`)}`,
    `<button class="btn ghost" onclick="closeModal();cvDel('${id}')" style="margin-inline-end:auto;color:var(--bad)">حذف</button>
     ${it.kind === 'task' ? `<button class="btn ghost" onclick="cvToTask('${id}')">أرسلها للمهام</button>` : ''}
     <button class="btn primary" onclick="cvEditSave('${id}')">حفظ</button>`);
}
function cvEditSave(id) { const it = cvItem(id); if (!it) return; it.text = $('#cvt').value; cvTouch(); closeModal(); render(); }
function cvSetColor(id, c) { const it = cvItem(id); if (!it) return; it.color = c; cvTouch(); cvEdit(id); }
function cvDel(id) { const b = cvBoard(); if (!b) return; b.items = b.items.filter(i => i.id !== id); CV.sel = ''; cvTouch(); render(); }
function cvToTask(id) {
  const it = cvItem(id); if (!it || !(it.text || '').trim()) { toast('اكتب نصّ المهمة أولاً', 'bad'); return; }
  S.tasks.unshift({ id: uid('t'), title: it.text.trim().slice(0, 120), areaId: '', goalId: '', status: 'open',
                    priority: 'none', due: '', est: 30, notes: '', createdAt: new Date().toISOString(), doneAt: '' });
  save(); closeModal(); renderNav(); toast('أُضيفت إلى المهام', 'good');
}

/* ---------- العرض: تحريك وتكبير ---------- */
function cvApplyView() {
  const w = $('#cvWorld'); if (!w || !w.style) return;
  w.style.transform = `translate(${CV.pan.x}px, ${CV.pan.y}px) scale(${CV.zoom})`;
}
function cvZoom(dir, atX, atY) {
  const z = clamp(Math.round((CV.zoom + dir * 0.15) * 100) / 100, 0.3, 2.5);
  if (z === CV.zoom) return;
  if (atX !== undefined) {   // ثبّت النقطة تحت المؤشّر أثناء التكبير
    CV.pan.x = atX - (atX - CV.pan.x) * (z / CV.zoom);
    CV.pan.y = atY - (atY - CV.pan.y) * (z / CV.zoom);
  }
  CV.zoom = z; cvApplyView();
  const lbl = $('.cv-bar .tiny'); if (lbl) lbl.textContent = Math.round(z * 100) + '٪';
}
function cvFit() {
  const b = cvBoard(), st = $('#cvStage');
  if (!b || !b.items.length || !st || !st.getBoundingClientRect) { CV.pan = { x: 0, y: 0 }; CV.zoom = 1; cvApplyView(); return; }
  const xs = b.items.map(i => i.x), ys = b.items.map(i => i.y);
  const x2 = Math.max(...b.items.map(i => i.x + i.w)), y2 = Math.max(...b.items.map(i => i.y + i.h));
  const x1 = Math.min(...xs), y1 = Math.min(...ys);
  const r = st.getBoundingClientRect(), pad = 60;
  CV.zoom = clamp(Math.min((r.width - pad) / (x2 - x1 || 1), (r.height - pad) / (y2 - y1 || 1)), 0.3, 1.4);
  CV.pan.x = r.width / 2 - ((x1 + x2) / 2) * CV.zoom;
  CV.pan.y = r.height / 2 - ((y1 + y2) / 2) * CV.zoom;
  cvApplyView(); render();
}

/* ---------- التفاعل ---------- */
function cvBind() {
  const stage = $('#cvStage'); if (!stage || !stage.addEventListener) return;
  const toWorld = e => {
    const r = stage.getBoundingClientRect();
    return { x: (e.clientX - r.left - CV.pan.x) / CV.zoom, y: (e.clientY - r.top - CV.pan.y) / CV.zoom };
  };

  stage.addEventListener('pointerdown', e => {
    const rs = e.target.closest && e.target.closest('.cv-rs');
    const el = e.target.closest && e.target.closest('.cv-item');
    if (rs) {
      const it = cvItem(rs.dataset.rs); if (!it) return;
      CV.drag = { mode: 'size', id: it.id, sx: e.clientX, sy: e.clientY, w: it.w, h: it.h };
    } else if (el) {
      const it = cvItem(el.dataset.it); if (!it) return;
      CV.sel = it.id;
      $$('.cv-item', stage).forEach(n => n.classList.toggle('sel', n.dataset.it === it.id));
      CV.drag = { mode: 'move', id: it.id, sx: e.clientX, sy: e.clientY, x: it.x, y: it.y, el: el, moved: false };
    } else {
      CV.sel = '';
      $$('.cv-item', stage).forEach(n => n.classList.remove('sel'));
      CV.drag = { mode: 'pan', sx: e.clientX, sy: e.clientY, x: CV.pan.x, y: CV.pan.y };
      stage.classList.add('panning');
    }
    try { stage.setPointerCapture(e.pointerId); } catch (x) { }
  });

  stage.addEventListener('pointermove', e => {
    const d = CV.drag; if (!d) return;
    const dx = (e.clientX - d.sx), dy = (e.clientY - d.sy);
    if (d.mode === 'pan') { CV.pan.x = d.x + dx; CV.pan.y = d.y + dy; cvApplyView(); return; }
    const it = cvItem(d.id); if (!it) return;
    if (Math.abs(dx) + Math.abs(dy) > 3) d.moved = true;
    const node = d.el || $(`.cv-item[data-it="${d.id}"]`, stage);
    if (d.mode === 'move') {
      it.x = Math.round(d.x + dx / CV.zoom); it.y = Math.round(d.y + dy / CV.zoom);
      if (node && node.style) { node.style.left = it.x + 'px'; node.style.top = it.y + 'px'; }
    } else {
      it.w = Math.max(90, Math.round(d.w + dx / CV.zoom)); it.h = Math.max(48, Math.round(d.h + dy / CV.zoom));
      if (node && node.style) { node.style.width = it.w + 'px'; node.style.height = it.h + 'px'; }
    }
  });

  const end = () => {
    const d = CV.drag; CV.drag = null;
    stage.classList.remove('panning');
    if (d && d.mode !== 'pan') cvTouch();
  };
  stage.addEventListener('pointerup', end);
  stage.addEventListener('pointercancel', end);

  stage.addEventListener('dblclick', e => {
    const el = e.target.closest && e.target.closest('.cv-item');
    if (el) { cvEdit(el.dataset.it); return; }
    const p = toWorld(e);
    cvAdd('note', p.x - CV_KINDS.note.w / 2, p.y - CV_KINDS.note.h / 2);
  });

  stage.addEventListener('wheel', e => {
    if (!(e.ctrlKey || e.metaKey)) return;      // العجلة وحدها تمرّر الصفحة، مع Ctrl تكبّر
    e.preventDefault();
    const r = stage.getBoundingClientRect();
    cvZoom(e.deltaY < 0 ? 1 : -1, e.clientX - r.left, e.clientY - r.top);
  }, { passive: false });
}

/* حذف البطاقة المحدَّدة بمفتاح Delete */
document.addEventListener('keydown', e => {
  if (CUR !== 'canvas' || !CV.sel) return;
  if (/input|textarea|select/i.test(e.target.tagName || '')) return;
  if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); cvDel(CV.sel); }
});
