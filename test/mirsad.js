/* اختبار جسر مرصاد ← Supabase.
   يُحمَّل supabase-bridge.js فوق عميل Supabase وهمي يحفظ في الذاكرة،
   فنتحقّق من ترجمة نداءات Firestore بلا شبكة ولا متصفّح. */
const fs = require('fs');
const path = require('path');

/* ---------- عميل Supabase وهمي ---------- */
function fakeClient(store, user) {
  const match = (row, eqs, likes) =>
    eqs.every(([c, v]) => row[c] === v) &&
    likes.every(([c, v]) => new RegExp('^' + v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*') + '$').test(row[c]));

  function builder(op) {
    const b = {
      _eq: [], _like: [], _rows: null,
      select() { return b; },
      eq(c, v) { b._eq.push([c, v]); return b; },
      like(c, v) { b._like.push([c, v]); return b; },
      upsert(row) { b._rows = [row]; return b; },
      run() {
        if (op === 'upsert') {
          const r = b._rows[0], i = store.findIndex(x => x.path === r.path);
          if (i >= 0) store[i] = Object.assign({}, store[i], r); else store.push(Object.assign({}, r));
          return { data: null, error: null };
        }
        const hit = store.filter(r => match(r, b._eq, b._like));
        if (op === 'delete') { hit.forEach(r => store.splice(store.indexOf(r), 1)); return { data: null, error: null }; }
        return { data: hit.map(r => ({ path: r.path, data: r.data })), error: null };
      },
      maybeSingle() { const r = b.run(); return Promise.resolve({ data: r.data[0] || null, error: null }); },
      then(res, rej) { return Promise.resolve(b.run()).then(res, rej); }
    };
    return b;
  }
  return {
    from: () => ({ select: () => builder('select'), upsert: (r) => builder('upsert').upsert(r), delete: () => builder('delete') }),
    auth: {
      getUser: async () => ({ data: { user }, error: null }),
      getSession: async () => ({ data: { session: user ? { user, access_token: 'tok' } : null } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() { } } } }),
      signInWithPassword: async () => ({ data: { user }, error: null }),
      signUp: async () => ({ data: { user }, error: null }),
      signOut: async () => ({ error: null }),
      updateUser: async () => ({ data: { user }, error: null }),
      signInWithOAuth: async () => ({ error: null })
    },
    channel: () => ({ on() { return this; }, subscribe() { return this; } }),
    removeChannel() { },
    storage: { from: () => ({ upload: async () => ({ error: null }), createSignedUrl: async () => ({ data: { signedUrl: 'u' }, error: null }) }) }
  };
}

/* ---------- تحميل الجسر ---------- */
const src = fs.readFileSync(path.join(__dirname, '..', 'public', 'mirsad', 'supabase-bridge.js'), 'utf8');
const body = src.replace(/^import .*$/gm, '').replace(/^export /gm, '');
const NAMES = ['doc', 'collection', 'query', 'where', 'orderBy', 'limit', 'applyConstraints', 'deepMerge', 'resolveWrite',
  'serverTimestamp', 'arrayUnion', 'arrayRemove', 'deleteField', 'setDoc', 'getDoc', 'getDocs', 'addDoc', 'deleteDoc',
  'updateDoc', 'onSnapshot', 'toUser', 'autoId', 'parentOf', 'onAuthStateChanged', 'signInWithEmailAndPassword'];

const STORE = [];
const USER = { id: '11111111-2222-3333-4444-555555555555', email: 'saad@example.com',
               email_confirmed_at: '2026-01-01', user_metadata: { display_name: 'سعد' }, app_metadata: { provider: 'email' } };

const B = new Function('createClient', 'SUPA_URL', 'SUPA_KEY', 'window',
  body + '\n;return {' + NAMES.join(',') + '};')(() => fakeClient(STORE, USER), 'http://x', 'k', {});

/* ---------- الاختبارات ---------- */
const errs = [];
function t(name, fn) {
  return Promise.resolve().then(fn)
    .then(() => console.log('  ✓ ' + name))
    .catch(e => { errs.push(name + ' → ' + e.message); console.log('  ✗ ' + name + ' — ' + e.message); });
}
const db = { __kind: 'db' };

(async function () {
  console.log('\n— مسارات المستندات —');
  await t('doc(db, …أجزاء)', () => {
    const r = B.doc(db, 'users', 'u1', 'projects', 'p1');
    if (r.path !== 'users/u1/projects/p1') throw new Error(r.path);
    if (r.id !== 'p1') throw new Error('id=' + r.id);
  });
  await t('collection ثم doc بمعرّف', () => {
    const col = B.collection(db, 'users', 'u1', 'projects');
    if (col.path !== 'users/u1/projects') throw new Error(col.path);
    if (B.doc(col, 'p9').path !== 'users/u1/projects/p9') throw new Error('doc(col,id) خاطئ');
  });
  await t('doc بلا معرّف يولّد واحداً بطول ٢٠', () => {
    const r = B.doc(B.collection(db, 'users', 'u1', 'projects'));
    if (r.id.length !== 20) throw new Error('الطول ' + r.id.length);
  });
  await t('parent يُحسب من المسار', () => {
    if (B.parentOf('users/u1/projects/p1') !== 'users/u1/projects') throw new Error('خاطئ');
  });

  console.log('\n— الكتابة والقراءة —');
  await t('setDoc ثم getDoc', async () => {
    const r = B.doc(db, 'users', 'u1', 'projects', 'p1');
    await B.setDoc(r, { name: 'إعلان رمضان', scenes: [{ id: 's1' }] });
    const s = await B.getDoc(r);
    if (!s.exists()) throw new Error('غير موجود');
    if (s.data().name !== 'إعلان رمضان') throw new Error('البيانات مختلفة');
    if (s.id !== 'p1') throw new Error('المعرّف خاطئ');
  });
  await t('مستند غير موجود: exists() = false', async () => {
    const s = await B.getDoc(B.doc(db, 'users', 'u1', 'projects', 'لا-شيء'));
    if (s.exists()) throw new Error('ادّعى الوجود');
    if (s.data() !== undefined) throw new Error('أعاد بيانات');
  });
  await t('setDoc بلا merge يستبدل كل شيء', async () => {
    const r = B.doc(db, 'users', 'u1', 'projects', 'p1');
    await B.setDoc(r, { name: 'اسم جديد' });
    if ((await B.getDoc(r)).data().scenes !== undefined) throw new Error('بقي الحقل القديم');
  });
  await t('merge يدمج الخرائط ويستبدل المصفوفات', async () => {
    const r = B.doc(db, 'users', 'u1', 'meta', 'folders');
    await B.setDoc(r, { list: [1, 2], cfg: { a: 1, b: 2 } });
    await B.setDoc(r, { list: [9], cfg: { b: 5 } }, { merge: true });
    const d = (await B.getDoc(r)).data();
    if (JSON.stringify(d.list) !== '[9]') throw new Error('المصفوفة دُمجت بدل أن تُستبدل');
    if (d.cfg.a !== 1 || d.cfg.b !== 5) throw new Error('الخريطة لم تُدمج: ' + JSON.stringify(d.cfg));
  });
  await t('updateDoc يرفض مستنداً غير موجود', async () => {
    let threw = false;
    try { await B.updateDoc(B.doc(db, 'users', 'u1', 'projects', 'وهمي'), { a: 1 }); } catch (e) { threw = true; }
    if (!threw) throw new Error('لم يرفض');
  });
  await t('addDoc يولّد معرّفاً ويكتب', async () => {
    const col = B.collection(db, 'projectChats', 'c1', 'messages');
    const ref = await B.addDoc(col, { text: 'مرحباً' });
    if (!(await B.getDoc(ref)).exists()) throw new Error('لم يُكتب');
  });
  await t('deleteDoc يحذف المستند وفروعه', async () => {
    await B.setDoc(B.doc(db, 'users', 'u1', 'projects', 'pz'), { n: 1 });
    await B.setDoc(B.doc(db, 'users', 'u1', 'projects', 'pz', 'scenes', 's1'), { n: 2 });
    await B.deleteDoc(B.doc(db, 'users', 'u1', 'projects', 'pz'));
    if ((await B.getDoc(B.doc(db, 'users', 'u1', 'projects', 'pz'))).exists()) throw new Error('بقي المستند');
    if ((await B.getDoc(B.doc(db, 'users', 'u1', 'projects', 'pz', 'scenes', 's1'))).exists()) throw new Error('بقي الفرع');
  });

  console.log('\n— المجموعات والاستعلامات —');
  await t('getDocs يعيد أبناء المجموعة فقط', async () => {
    await B.setDoc(B.doc(db, 'users', 'u2', 'projects', 'a'), { folderId: 'f1', createdAt: '2026-01-02' });
    await B.setDoc(B.doc(db, 'users', 'u2', 'projects', 'b'), { folderId: 'f2', createdAt: '2026-01-01' });
    await B.setDoc(B.doc(db, 'users', 'u2', 'projects', 'a', 'scenes', 's'), { deep: true });
    const snap = await B.getDocs(B.collection(db, 'users', 'u2', 'projects'));
    if (snap.size !== 2) throw new Error('العدد ' + snap.size + ' بدل ٢ — تسرّبت المستندات العميقة');
    if (snap.empty) throw new Error('ادّعى الفراغ');
  });
  await t('where يرشّح', async () => {
    const q = B.query(B.collection(db, 'users', 'u2', 'projects'), B.where('folderId', '==', 'f1'));
    const snap = await B.getDocs(q);
    if (snap.size !== 1 || snap.docs[0].id !== 'a') throw new Error('ترشيح خاطئ');
  });
  await t('orderBy يرتّب', async () => {
    const q = B.query(B.collection(db, 'users', 'u2', 'projects'), B.orderBy('createdAt', 'asc'));
    const ids = (await B.getDocs(q)).docs.map(d => d.id);
    if (ids.join(',') !== 'b,a') throw new Error('الترتيب ' + ids.join(','));
  });
  await t('مجموعة فارغة', async () => {
    const snap = await B.getDocs(B.collection(db, 'users', 'لا-أحد', 'projects'));
    if (!snap.empty || snap.size !== 0) throw new Error('ليست فارغة');
    let n = 0; snap.forEach(() => n++);
    if (n !== 0) throw new Error('forEach دار');
  });

  console.log('\n— القيم الخاصة —');
  await t('serverTimestamp يصير نصّاً زمنياً', async () => {
    const r = B.doc(db, 'projectChats', 'c1', 'messages', 'm1');
    await B.setDoc(r, { text: 'a', createdAt: B.serverTimestamp() });
    const v = (await B.getDoc(r)).data().createdAt;
    if (typeof v !== 'string' || isNaN(Date.parse(v))) throw new Error('ليس وقتاً: ' + v);
    if (v.__sentinel) throw new Error('بقيت القيمة الخاصة كما هي');
  });
  await t('arrayUnion و arrayRemove', () => {
    const u = B.resolveWrite(B.arrayUnion('x', 'y'), ['x']);
    if (JSON.stringify(u) !== '["x","y"]') throw new Error('union: ' + JSON.stringify(u));
    const r = B.resolveWrite(B.arrayRemove('x'), ['x', 'z']);
    if (JSON.stringify(r) !== '["z"]') throw new Error('remove: ' + JSON.stringify(r));
  });
  await t('القيم الخاصة داخل الخرائط المتداخلة', async () => {
    const r = B.doc(db, 'users', 'u1', 'meta', 'nested');
    await B.setDoc(r, { a: { b: { at: B.serverTimestamp() } } });
    const v = (await B.getDoc(r)).data().a.b.at;
    if (typeof v !== 'string') throw new Error('لم تُستبدل في العمق');
  });

  console.log('\n— اللحظي والمصادقة —');
  await t('onSnapshot يعطي لقطة أولى ويعيد دالة إلغاء', async () => {
    let got = null;
    const off = B.onSnapshot(B.collection(db, 'users', 'u2', 'projects'), s => { got = s; });
    await new Promise(r => setTimeout(r, 10));
    if (!got || got.size !== 2) throw new Error('لا لقطة أولى');
    if (typeof off !== 'function') throw new Error('لا دالة إلغاء');
    off();
  });
  await t('المستخدم يُترجم لشكل Firebase', () => {
    const u = B.toUser(USER);
    if (u.uid !== USER.id) throw new Error('uid');
    if (u.displayName !== 'سعد') throw new Error('displayName');
    if (u.emailVerified !== true) throw new Error('emailVerified');
    if (B.toUser(null) !== null) throw new Error('null لم يُعَد null');
  });
  await t('onAuthStateChanged ينادى بالمستخدم الحالي', async () => {
    let seen;
    B.onAuthStateChanged({}, u => { seen = u; });
    await new Promise(r => setTimeout(r, 10));
    if (!seen || seen.uid !== USER.id) throw new Error('لم يصل المستخدم');
  });

  if (errs.length) { console.log('\nأخطاء (' + errs.length + '):\n' + errs.map(e => ' • ' + e).join('\n')); process.exit(1); }
  console.log('\nجسر مرصاد: كل الاختبارات نجحت ✓');
})();
