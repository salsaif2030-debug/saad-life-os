
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
t('حذف جانب', () => { const n = S.areas.length; areaDelYes('travel'); if (S.areas.length !== n - 1) throw new Error('لم يُحذف'); });
t('إضافة قسم جديد', () => { const a = areaById('work'); const n = a.sections.length; a.sections.push({ id: 'sx', type: 'journal', title: 'يوميات العمل', icon: 'pen-line', config: {}, items: [] }); renderArea('work'); if (a.sections.length !== n + 1) throw new Error('لم يُضف'); });
t('حفظ الحالة محلياً', () => { save(); if (!globalThis.__store[APP_KEY]) throw new Error('لم يُحفظ'); JSON.parse(globalThis.__store[APP_KEY]); });

