
function t(name, fn) { try { fn(); console.log('  ✓ ' + name); } catch (e) { globalThis.errs.push(name + ' → ' + e.message + '\n     ' + (e.stack || '').split('\n')[1]); console.log('  ✗ ' + name + ' — ' + e.message); } }

console.log('\n— الشاشات —');
t('اللوحة الرئيسية', () => renderDashboard());
t('تخطيط اليوم', () => renderTimebox());
t('المهام', () => renderTasks());
t('الملاحظات', () => renderNotes());
t('المراجعة الأسبوعية', () => renderReview());
t('الإعدادات', () => renderSettings());
t('القائمة الجانبية', () => renderNav());

console.log('\n— كل جوانب الحياة وأقسامها —');
S.areas.forEach(a => t('جانب: ' + a.name, () => renderArea(a.id)));

console.log('\n— كل الويدجتس —');
Object.keys(WIDGET_DEFS).forEach(k => t('ويدجت: ' + WIDGET_DEFS[k].name, () => {
  const out = WG[k]({ id: 'w_' + k, type: k, visible: true, size: 'md' });
  if (typeof out !== 'string') throw new Error('لم يُرجع HTML');
}));

console.log('\n— العمليات —');
t('إضافة مهمة', () => { S.tasks.push({ id: 't1', title: 'مهمة تجربة', areaId: 'health', status: 'open', priority: 'high', due: today(), est: 60, createdAt: new Date().toISOString() }); renderTasks(); });
t('جدولة مهمة في كتلة', () => { TB_DATE = today(); tbDropTask('t1', 8 * 60); if (!S.blocks.length) throw new Error('لم تُنشأ الكتلة'); });
t('إنجاز الكتلة', () => { tbDone(S.blocks[0].id); if (S.tasks[0].status !== 'done') throw new Error('لم تُعلَّم المهمة منجزة'); });
t('نسخ خطة الأمس', () => { TB_DATE = dayShift(today(), 1); tbCopyPrev(); });
t('أولويات اليوم', () => { setPriority(today(), 0, 'أهم شيء'); togglePriority(today(), 0); if (!S.priorities[today()][0].done) throw new Error('لم تُعلَّم'); });
t('عادة + سلسلة', () => { S.habits.list.push({ id: 'h1', name: 'مشي', areaId: 'health' }); habitToggle('h1'); if (habitStreak('h1') !== 1) throw new Error('السلسلة خاطئة'); });
t('قسم مؤشّر (الوزن)', () => { const s = areaById('health').sections.find(x => x.type === 'metric'); s.items.push({ id: 'm1', v: 88, date: dayShift(today(), -3) }, { id: 'm2', v: 86.5, date: today() }); renderArea('health'); });
t('قائمة تحقّق يومية', () => { const s = areaById('health').sections.find(x => x.type === 'checklist'); s.items.push({ id: 'c1', text: 'فيتامين د', log: {} }); checkToggle('health', s.id, 'c1'); if (!s.items[0].log[today()]) throw new Error('لم تُعلَّم'); });
t('سجلّ (موعد طبي)', () => { const s = areaById('health').sections.find(x => x.type === 'records'); s.items.push({ id: 'r1', title: 'مراجعة تكميم', date: today(), f: ['مستشفى', 'د. أحمد', 'متابعة'] }); renderArea('health'); });
t('الصلوات', () => { prayerSet('Fajr', 'mosque'); if (S.prayerLog[today()].Fajr !== 'mosque') throw new Error('لم تُسجّل'); });
t('التقاط سريع', () => { S.capture.unshift({ id: 'c9', text: 'اشتري الكتب', createdAt: new Date().toISOString(), done: false }); renderNotes(); });
t('تقدّم الجانب', () => { const p = areaProgress(areaById('health')); if (typeof p.pct !== 'number') throw new Error('نسبة غير صالحة'); });
t('البحث السريع', () => { const r = paletteItems('صحة'); if (!Array.isArray(r)) throw new Error('لا نتائج'); });
t('تصدير/استيراد', () => { const j = JSON.stringify(S); const back = deepMerge(defaultState(), JSON.parse(j)); if (!back.areas.length) throw new Error('فقدت الجوانب'); });
t('أولوية في الخانة الثالثة تصمد بعد إعادة التحميل', () => {
  const d = today();
  S.priorities[d] = []; setPriority(d, 2, 'ثالث فقط');           // خانتان فارغتان قبله
  S.priorities = JSON.parse(JSON.stringify(S.priorities));       // كما يحدث في الحفظ ثم التحميل
  const html = WG.today({ id: 'w', type: 'today', visible: true, size: 'md' });
  if (!html.includes('ثالث فقط')) throw new Error('اختفت الأولوية');
});
t('كتلة خارج ساعات اليوم تبقى ظاهرة', () => {
  const d = today();
  S.settings.dayStart = '08:00';
  S.blocks.push({ id: 'b_early', date: d, start: 5 * 60, end: 6 * 60, title: 'فجر مبكر', areaId: '', type: 'routine', done: false });
  S.blocks.push({ id: 'b_late', date: d, start: 23 * 60 + 30, end: 24 * 60, title: 'قبل النوم', areaId: '', type: 'routine', done: false });
  const html = tbGridHTML(d, labelToMin('08:00'), labelToMin('23:00'), 30);
  if (!html.includes('فجر مبكر')) throw new Error('اختفت الكتلة المبكرة');
  if (!html.includes('قبل النوم')) throw new Error('اختفت الكتلة المتأخرة');
  S.settings.dayStart = '05:00';
});
t('ارتفاع الكتلة يتناسب مع مدّتها', () => {
  const d = '2030-01-01';
  S.blocks.push({ id: 'b_30', date: d, start: 9 * 60, end: 9 * 60 + 30, title: 'ثلاثون', areaId: '', type: 'focus', done: false });
  S.blocks.push({ id: 'b_120', date: d, start: 11 * 60, end: 13 * 60, title: 'مئة وعشرون', areaId: '', type: 'focus', done: false });
  const html = tbGridHTML(d, 8 * 60, 20 * 60, 30);
  const hOf = id => { const m = new RegExp('data-blk="' + id + '"[^>]*style="[^"]*height:(\\d+)px').exec(html); return m ? +m[1] : 0; };
  const h30 = hOf('b_30'), h120 = hOf('b_120');
  if (!h30 || !h120) throw new Error('لم يُحسب ارتفاع الكتل');
  if (h120 < h30 * 3.5) throw new Error(`كتلة ١٢٠د (${h120}px) ليست أطول أربع مرات من ٣٠د (${h30}px)`);
});
t('الكتل المتداخلة تُقسم أعمدة', () => {
  const lanes = tbLanes([{ id: 'a', start: 60, end: 180 }, { id: 'b', start: 120, end: 240 }, { id: 'c', start: 300, end: 360 }]);
  if (lanes.a.of !== 2 || lanes.b.of !== 2) throw new Error('لم تُقسم المتداخلتان');
  if (lanes.a.i === lanes.b.i) throw new Error('وقعتا في العمود نفسه');
  if (lanes.c.of !== 1) throw new Error('كتلة منفصلة قُسّمت بلا داع');
});
t('الأولوية تُنشئ مهمة مرتبطة', () => {
  const d = today();
  S.priorities[d] = []; const n = S.tasks.length;
  setPriority(d, 0, 'اتّصل بالعميل');
  if (S.tasks.length !== n + 1) throw new Error('لم تُنشأ مهمة');
  const p = S.priorities[d][0];
  if (!p.taskId) throw new Error('لم تُربط الأولوية بالمهمة');
  if (S.tasks.find(x => x.id === p.taskId).title !== 'اتّصل بالعميل') throw new Error('عنوان المهمة مختلف');
});
t('إنجاز المهمة يشطب الأولوية المرتبطة', () => {
  const d = today(), p = S.priorities[d][0];
  taskToggle(p.taskId);
  if (!S.priorities[d][0].done) throw new Error('لم تُشطب الأولوية');
  taskToggle(p.taskId);
  if (S.priorities[d][0].done) throw new Error('لم تُعَد فتح الأولوية');
});
t('إنجاز الأولوية يُنجز المهمة', () => {
  const d = today(), p = S.priorities[d][0];
  togglePriority(d, 0);
  if (S.tasks.find(x => x.id === p.taskId).status !== 'done') throw new Error('لم تُنجز المهمة');
  togglePriority(d, 0);
});
t('رفع مهمة إلى أولويات اليوم', () => {
  const d = today();
  S.tasks.unshift({ id: 't_pri', title: 'مراجعة الحملة', areaId: 'work', status: 'open', priority: 'mid', due: '', est: 30, createdAt: new Date().toISOString(), doneAt: '' });
  taskToPriority('t_pri');
  if (priorityOfTask('t_pri', d) < 0) throw new Error('لم تُرفع للأولويات');
  taskToPriority('t_pri');
  if (priorityOfTask('t_pri', d) >= 0) throw new Error('لم تُنزّل من الأولويات');
});
t('حذف المهمة يفكّ ارتباط الأولوية', () => {
  const d = today(), p = S.priorities[d][0], id = p.taskId;
  taskDel(id);
  if (S.priorities[d][0].taskId) throw new Error('بقي الارتباط بمهمة محذوفة');
});
t('صفحة مراجعة اليوم', () => renderDaily());
t('حفظ المراجعة يزرع أولوية الغد', () => {
  const d = '2030-03-10', tm = dayShift(d, 1);
  DAILY_DATE = d; S.priorities[tm] = [];
  $('#dw').value = 'أنهيت العرض'; $('#dd').value = 'تشتّت'; $('#dm').value = '4'; $('#de').value = '4';
  $('#dn').value = ''; $('#dt').value = 'اجتماع الفريق';
  dailySave(d);
  if (!S.reviews[d] || S.reviews[d].win !== 'أنهيت العرض') throw new Error('لم تُحفظ المراجعة');
  if ((S.priorities[tm][0] || {}).text !== 'اجتماع الفريق') throw new Error('لم تُزرع أولوية الغد');
  if (!S.priorities[tm][0].taskId) throw new Error('أولوية الغد بلا مهمة');
});
t('سلسلة المراجعة', () => {
  S.reviews = {}; [0, 1, 2].forEach(i => S.reviews[dayShift(today(), -i)] = { win: 'شيء', mood: 4, energy: 4 });
  if (reviewStreak() !== 3) throw new Error('السلسلة ' + reviewStreak() + ' بدل ٣');
});
t('زرع رابط Keep مرّة واحدة', () => {
  S.settings.seeded = []; S.links = [];
  migrate();
  if (!S.links.some(l => l.url.includes('keep.google.com'))) throw new Error('لم يُزرع الرابط');
  S.links = S.links.filter(l => !l.url.includes('keep.google.com'));   // المستخدم حذفه
  migrate();
  if (S.links.some(l => l.url.includes('keep.google.com'))) throw new Error('عاد رابط محذوف');
});
console.log('\n— المكتب والخلفيات —');
t('صفحة المكتب تعرض كل التطبيقات', () => {
  renderDesk();
  const html = $('#view').innerHTML;
  ['تخطيط اليوم', 'العمل', 'التجارة', 'المساحة الحرة'].forEach(n => { if (!html.includes(n)) throw new Error('غاب: ' + n); });
  S.areas.filter(a => !a.hidden).forEach(a => { if (!html.includes(a.name)) throw new Error('غاب الجانب: ' + a.name); });
  (S.links || []).forEach(l => { if (!html.includes(l.label)) throw new Error('غابت الأداة: ' + l.label); });
});
t('اختيار خلفية يوقف التبديل التلقائي', () => {
  S.settings.wpRotate = 'day';
  setWallpaper('./wallpapers/tahoe-dark.jpg');
  if (S.settings.wpRotate !== 'off') throw new Error('بقي التبديل التلقائي شغّالاً');
  if (S.settings.wallpaper !== './wallpapers/tahoe-dark.jpg') throw new Error('لم تُحفظ الخلفية');
});
t('الخلفية اليومية ثابتة خلال اليوم', () => {
  S.settings.wpRotate = 'day';
  const a = effectiveWallpaper(), b = effectiveWallpaper();
  if (a !== b) throw new Error('تتغيّر مع كل استدعاء');
  if (!a.includes('/wallpapers/')) throw new Error('ليست من مجموعة الخلفيات');
});
t('خلفية وقت اليوم تتبع الساعة', () => {
  S.settings.wpRotate = 'time';
  if (!effectiveWallpaper().includes('/wallpapers/')) throw new Error('لم تُختر خلفية');
  S.settings.wpRotate = 'off';
});
t('التدرّج اللوني يُكتب بلا url()', () => {
  const g = WP_GRADIENTS[0].css;
  if (wpCSS(g) !== g) throw new Error('لُفّ التدرّج بـurl()');
  if (wpCSS('./wallpapers/x.jpg') !== 'url("./wallpapers/x.jpg")') throw new Error('الصورة لم تُلفّ بـurl()');
});
t('التعتيم والوضع الزجاجي يُطبَّقان', () => {
  S.settings.wallpaper = './wallpapers/tahoe-dark.jpg'; setWpDim(40); setGlass(true);
  if (!/rgba\(/.test(document.body.style.backgroundImage || '')) throw new Error('لم تُضف طبقة التعتيم');
  if (document.documentElement.dataset.glass !== 'on') throw new Error('لم يُفعّل الوضع الزجاجي');
  setGlass(false); setWpDim(0); S.settings.wallpaper = '';
  applyTheme();
  if (document.body.style.backgroundImage) throw new Error('بقيت الخلفية بعد إزالتها');
});

console.log('\n— المساحة الحرة —');
t('قائمة الألواح فارغة', () => renderCanvas(''));
t('إنشاء لوح', () => {
  S.boards.unshift({ id: 'bd1', title: 'عصف ذهني', items: [], updatedAt: new Date().toISOString() });
  CV_BOARD = 'bd1'; renderCanvas('bd1');
  if (!cvBoard()) throw new Error('لم يُفتح اللوح');
});
t('إضافة بطاقات بكل الأنواع', () => {
  Object.keys(CV_KINDS).forEach((k, i) => cvAdd(k, i * 220, 0));
  if (cvBoard().items.length !== Object.keys(CV_KINDS).length) throw new Error('نقص في البطاقات');
});
t('تعديل نصّ بطاقة وحذفها', () => {
  const it = cvBoard().items[0];
  it.text = 'فكرة أولى'; cvTouch();
  if (!renderCanvas('bd1') && !$('#view').innerHTML.includes('فكرة أولى')) throw new Error('لم يظهر النص');
  const n = cvBoard().items.length; cvDel(it.id);
  if (cvBoard().items.length !== n - 1) throw new Error('لم تُحذف');
});
t('تحويل بطاقة إلى مهمة', () => {
  const it = cvBoard().items.find(x => x.kind === 'task');
  it.text = 'جهّز عرض الحملة'; const n = S.tasks.length;
  cvToTask(it.id);
  if (S.tasks.length !== n + 1) throw new Error('لم تُضف للمهام');
});
t('التكبير محصور بين ٣٠٪ و٢٥٠٪', () => {
  CV.zoom = 1; for (let i = 0; i < 40; i++) cvZoom(1);
  if (CV.zoom > 2.5) throw new Error('تجاوز الحد الأعلى');
  for (let i = 0; i < 60; i++) cvZoom(-1);
  if (CV.zoom < 0.3) throw new Error('تجاوز الحد الأدنى');
});

console.log('\n— صفحة العمل —');
t('الحملات فارغة', () => { WORK_TAB = 'campaigns'; renderWork(); });
t('إضافة حملة ونقلها بين المراحل', () => {
  S.work.campaigns.unshift({ id: 'cm1', title: 'حملة العودة للمدارس', stage: 'idea', channel: 'نقاط بيع POP', owner: 'ريم', due: today(), notes: '' });
  renderWork();
  if (!kbMove(S.work.campaigns, 'cm1', 'design')) throw new Error('لم تنتقل المرحلة');
  if (kbMove(S.work.campaigns, 'cm1', 'design')) throw new Error('نقل بلا تغيير');
  if (S.work.campaigns[0].stage !== 'design') throw new Error('المرحلة لم تُحفظ');
});
t('الحملة تصير مهمة', () => { const n = S.tasks.length; campaignToTask('cm1'); if (S.tasks.length !== n + 1) throw new Error('لم تُضف'); });
t('الاجتماعات وإجراءاتها', () => {
  WORK_TAB = 'meetings';
  S.work.meetings.unshift({ id: 'mg1', title: 'مراجعة الخطة', date: today(), people: 'مدير التسويق', summary: 'اتفقنا', actions: [{ id: 'ac1', text: 'أرسل المقترح', taskId: '' }] });
  renderWork();
  const n = S.tasks.length; actionToTask('mg1', 'ac1');
  if (S.tasks.length !== n + 1) throw new Error('لم يتحوّل الإجراء لمهمة');
  if (!S.work.meetings[0].actions[0].taskId) throw new Error('لم يُحفظ الارتباط');
  actionToTask('mg1', 'ac1');
  if (S.work.meetings[0].actions[0].taskId) throw new Error('لم يُفكّ الارتباط');
});
t('المؤشرات المقترحة', () => {
  WORK_TAB = 'kpis'; renderWork();
  kpiSeed();
  if (S.work.kpis.length !== 6) throw new Error('عدد المؤشرات ' + S.work.kpis.length);
  renderWork();
  const down = S.work.kpis.find(k => k.dir === 'down');
  if (!down) throw new Error('لا مؤشّر «كلما قلّ كان أفضل»');
});

console.log('\n— صفحة التجارة —');
t('الصفقات فارغة', () => { BIZ_TAB = 'deals'; renderBusiness(); });
t('إضافة صفقة ونقلها', () => {
  S.biz.deals.unshift({ id: 'dl1', name: 'عقد رعاية', company: 'شركة ألف', value: 45000, stage: 'lead', contact: 'أبو خالد', nextStep: 'أرسل العرض', nextAt: today(), notes: '' });
  renderBusiness();
  kbMove(S.biz.deals, 'dl1', 'offer');
  if (S.biz.deals[0].stage !== 'offer') throw new Error('لم تنتقل');
});
t('الخطوة التالية تصير مهمة', () => { const n = S.tasks.length; dealToTask('dl1'); if (S.tasks.length !== n + 1) throw new Error('لم تُضف'); });
t('تقويم المحتوى', () => {
  BIZ_TAB = 'content';
  S.biz.content.unshift({ id: 'ct1', title: 'ريلز المنتج', platform: 'إنستقرام', stage: 'write', date: today(), link: '', brief: '' });
  renderBusiness();
  const html = $('#view').innerHTML;
  if (!html.includes('ريلز المنتج')) throw new Error('لم يظهر المحتوى في التقويم');
  if (!html.includes('cal-i')) throw new Error('لم يُرسم التقويم');
});
t('تنقّل الشهور في التقويم', () => {
  BIZ_MONTH = '2026-01'; bizMonthShift(1);
  if (bizMonth() !== '2026-02') throw new Error('الشهر ' + bizMonth());
  bizMonthShift(-2);
  if (bizMonth() !== '2025-12') throw new Error('الرجوع عبر السنة فشل: ' + bizMonth());
  BIZ_MONTH = '';
});
t('المحتوى يصير مهمة', () => { const n = S.tasks.length; contentToTask('ct1'); if (S.tasks.length !== n + 1) throw new Error('لم يُضف'); });

console.log('\n— بقيّة العمليات —');
t('حذف جانب', () => { const n = S.areas.length; areaDelYes('travel'); if (S.areas.length !== n - 1) throw new Error('لم يُحذف'); });
t('إضافة قسم جديد', () => { const a = areaById('work'); const n = a.sections.length; a.sections.push({ id: 'sx', type: 'journal', title: 'يوميات العمل', icon: 'pen-line', config: {}, items: [] }); renderArea('work'); if (a.sections.length !== n + 1) throw new Error('لم يُضف'); });
t('حفظ الحالة محلياً', () => { save(); if (!globalThis.__store[APP_KEY]) throw new Error('لم يُحفظ'); JSON.parse(globalThis.__store[APP_KEY]); });

