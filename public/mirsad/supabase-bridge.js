/* ============================================================
   supabase-bridge.js — يجعل مرصاد يعمل على قاعدة بيانات سعد

   مرصاد مكتوب على واجهة Firebase (Auth + Firestore + Storage).
   هذا الملف يصدّر الأسماء نفسها التي يستوردها مرصاد، لكن ينفّذها
   على Supabase: المصادقة على auth، والمستندات على جدول mirsad_docs
   (انظر supabase/mirsad.sql)، والتحديث اللحظي على قناة Realtime.

   فائدة الربط: حساب واحد وقاعدة واحدة مع نظام سعد — تدخل مرّة
   وتفتح الاثنين.

   حدود هذه النسخة: المشاركة بين الحسابات معطّلة (روابط عامة،
   أعضاء مجلدات، دعوات، محادثات المشاريع). كل صفّ لصاحبه وحده،
   فما يخصّ غيرك لا يُقرأ ولا يُكتب.
   ============================================================ */

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPA_URL, SUPA_KEY } from './config.js';

const TABLE = 'mirsad_docs';
const sb = createClient(SUPA_URL, SUPA_KEY);

/* ============================================================
   أدوات
   ============================================================ */
const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
const isPlain = (v) => v && typeof v === 'object' && !Array.isArray(v);
const parentOf = (path) => path.split('/').slice(0, -1).join('/');
const idOf = (path) => path.split('/').slice(-1)[0];

/* معرّف بطول معرّفات Firestore وشكلها، حتى لا يتفاجأ أي كود يفترض ذلك */
const ID_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
function autoId() {
  let s = '';
  for (let i = 0; i < 20; i++) s += ID_CHARS[Math.floor(Math.random() * ID_CHARS.length)];
  return s;
}

/* دمج عميق كما يفعل setDoc(..., {merge:true}) في Firestore:
   الخرائط تُدمج، وما عداها (وضمنه المصفوفات) يُستبدل. */
function deepMerge(base, patch) {
  const out = isPlain(base) ? Object.assign({}, base) : {};
  for (const k in patch) {
    const v = patch[k];
    if (v === DELETE_FIELD) delete out[k];
    else if (isPlain(v) && isPlain(out[k])) out[k] = deepMerge(out[k], v);
    else out[k] = v;
  }
  return out;
}

/* ============================================================
   قيم خاصة (sentinels)
   ============================================================ */
const SERVER_TS = { __sentinel: 'serverTimestamp' };
const DELETE_FIELD = { __sentinel: 'deleteField' };
export function serverTimestamp() { return SERVER_TS; }
export function deleteField() { return DELETE_FIELD; }
export function arrayUnion(...vals) { return { __sentinel: 'arrayUnion', vals }; }
export function arrayRemove(...vals) { return { __sentinel: 'arrayRemove', vals }; }

/* تُستبدل القيم الخاصة قبل الكتابة. المصفوفات تحتاج القيمة الحالية،
   فتُمرَّر إليها هنا. */
function resolveWrite(value, current) {
  if (value === SERVER_TS) return new Date().toISOString();
  if (value && value.__sentinel === 'arrayUnion') {
    const cur = Array.isArray(current) ? current.slice() : [];
    value.vals.forEach(v => { if (!cur.some(x => JSON.stringify(x) === JSON.stringify(v))) cur.push(v); });
    return cur;
  }
  if (value && value.__sentinel === 'arrayRemove') {
    const cur = Array.isArray(current) ? current.slice() : [];
    return cur.filter(x => !value.vals.some(v => JSON.stringify(x) === JSON.stringify(v)));
  }
  if (Array.isArray(value)) return value.map(v => resolveWrite(v));
  if (isPlain(value)) {
    const out = {};
    for (const k in value) {
      const r = resolveWrite(value[k], current ? current[k] : undefined);
      if (r !== DELETE_FIELD) out[k] = r;
    }
    return out;
  }
  return value;
}

/* ============================================================
   المراجع: doc / collection
   ============================================================ */
function makeDoc(path) {
  return { __kind: 'doc', path, id: idOf(path), get parent() { return makeCol(parentOf(path)); } };
}
function makeCol(path) {
  return { __kind: 'col', path, id: idOf(path) };
}

export function doc(first, ...seg) {
  if (first && first.__kind === 'col') return makeDoc(first.path + '/' + (seg[0] || autoId()));
  if (first && first.__kind === 'doc') return makeDoc([first.path, ...seg].join('/'));
  return makeDoc(seg.join('/'));                       // doc(db, 'users', uid, …)
}
export function collection(first, ...seg) {
  if (first && first.__kind === 'doc') return makeCol([first.path, ...seg].join('/'));
  return makeCol(seg.join('/'));                       // collection(db, 'users', uid, 'projects')
}

/* ============================================================
   الاستعلامات
   ============================================================ */
export function where(field, op, value) { return { t: 'where', field, op, value }; }
export function orderBy(field, dir) { return { t: 'orderBy', field, dir: dir === 'desc' ? 'desc' : 'asc' }; }
export function limit(n) { return { t: 'limit', n }; }
export function query(col, ...cons) { return { __kind: 'query', path: col.path, cons }; }

const CMP = {
  '==': (a, b) => a === b,
  '!=': (a, b) => a !== b,
  '>':  (a, b) => a > b,
  '>=': (a, b) => a >= b,
  '<':  (a, b) => a < b,
  '<=': (a, b) => a <= b,
  'in': (a, b) => Array.isArray(b) && b.includes(a),
  'array-contains': (a, b) => Array.isArray(a) && a.includes(b)
};

/* المجموعات هنا صغيرة (مشاريع مستخدم واحد)، فالترشيح والترتيب في المتصفّح
   أبسط وأأمن من ترجمة كل مؤثّرات Firestore إلى استعلام jsonb. */
function applyConstraints(rows, cons) {
  let out = rows.slice();
  (cons || []).filter(c => c.t === 'where').forEach(c => {
    const f = CMP[c.op] || CMP['=='];
    out = out.filter(r => f((r.data || {})[c.field], c.value));
  });
  const ord = (cons || []).find(c => c.t === 'orderBy');
  if (ord) {
    out.sort((a, b) => {
      const x = (a.data || {})[ord.field], y = (b.data || {})[ord.field];
      if (x === y) return 0;
      if (x === undefined || x === null) return 1;
      if (y === undefined || y === null) return -1;
      return (x < y ? -1 : 1) * (ord.dir === 'desc' ? -1 : 1);
    });
  }
  const lim = (cons || []).find(c => c.t === 'limit');
  return lim ? out.slice(0, lim.n) : out;
}

/* ============================================================
   اللقطات (snapshots)
   ============================================================ */
function docSnap(path, data) {
  return {
    id: idOf(path), ref: makeDoc(path),
    exists: () => data != null,
    data: () => (data == null ? undefined : clone(data))
  };
}
function querySnap(rows) {
  const docs = rows.map(r => docSnap(r.path, r.data));
  return { docs, empty: docs.length === 0, size: docs.length, forEach: (fn) => docs.forEach(fn) };
}

/* ============================================================
   القراءة والكتابة
   ============================================================ */
async function fetchDoc(path) {
  const { data, error } = await sb.from(TABLE).select('path,data').eq('path', path).maybeSingle();
  if (error) throw error;
  return data ? data.data : null;
}
async function fetchCol(path) {
  const { data, error } = await sb.from(TABLE).select('path,data').eq('parent', path);
  if (error) throw error;
  return data || [];
}

export async function getDoc(ref) { return docSnap(ref.path, await fetchDoc(ref.path)); }

export async function getDocs(target) {
  const path = target.path;
  const rows = await fetchCol(path);
  return querySnap(target.__kind === 'query' ? applyConstraints(rows, target.cons) : rows);
}

async function ownerId() {
  const { data } = await sb.auth.getUser();
  if (!data || !data.user) throw new Error('مرصاد: لا جلسة دخول — سجّل الدخول أولاً.');
  return data.user.id;
}

export async function setDoc(ref, value, opts) {
  const merge = !!(opts && opts.merge);
  const cur = merge ? await fetchDoc(ref.path) : null;
  const resolved = resolveWrite(value, cur);
  const data = merge ? deepMerge(cur || {}, resolved) : resolved;
  const { error } = await sb.from(TABLE).upsert({
    path: ref.path, parent: parentOf(ref.path), owner: await ownerId(),
    data, updated_at: new Date().toISOString()
  }, { onConflict: 'path' });
  if (error) throw error;
}

export async function updateDoc(ref, value) {
  const cur = await fetchDoc(ref.path);
  if (cur == null) throw new Error('مرصاد: لا يمكن تحديث مستند غير موجود — ' + ref.path);
  return setDoc(ref, value, { merge: true });
}

export async function addDoc(col, value) {
  const ref = makeDoc(col.path + '/' + autoId());
  await setDoc(ref, value);
  return ref;
}

export async function deleteDoc(ref) {
  /* Firestore يحذف المستند وحده لا فروعه؛ لكن هنا الفروع تصير أيتاماً
     بلا وسيلة للوصول إليها، فنحذف الشجرة كاملة — في نداءين منفصلين
     تجنّباً لتعقيد ترميز المسارات داخل مرشّح or الواحد. */
  const kids = await sb.from(TABLE).delete().like('parent', ref.path + '/%');
  if (kids.error) throw kids.error;
  const { error } = await sb.from(TABLE).delete().eq('path', ref.path);
  if (error) throw error;
}

/* ============================================================
   التحديث اللحظي
   ============================================================ */
let chanN = 0;
export function onSnapshot(target, ...rest) {
  const cb = rest.find(a => typeof a === 'function');
  const onErr = rest.filter(a => typeof a === 'function')[1];
  const isDoc = target.__kind === 'doc';
  const path = target.path;

  let dead = false;
  const push = async () => {
    if (dead) return;
    try {
      if (isDoc) cb(docSnap(path, await fetchDoc(path)));
      else {
        const rows = await fetchCol(path);
        cb(querySnap(target.__kind === 'query' ? applyConstraints(rows, target.cons) : rows));
      }
    } catch (e) { if (onErr) onErr(e); }
  };

  push();                                   // اللقطة الأولى فوراً كما يفعل Firestore
  const ch = sb.channel('mirsad_' + (++chanN))
    .on('postgres_changes',
        { event: '*', schema: 'public', table: TABLE, filter: (isDoc ? 'path=eq.' : 'parent=eq.') + path },
        push)
    .subscribe();

  return () => { dead = true; try { sb.removeChannel(ch); } catch (e) { } };
}

/* ============================================================
   التطبيق وقاعدة البيانات — كائنات علامة فقط
   ============================================================ */
let _app = null;
export function initializeApp() { _app = { name: '[DEFAULT]', __supabase: true }; return _app; }
export function getApp() { if (!_app) throw new Error('no app'); return _app; }
export function getFirestore() { return { __kind: 'db' }; }

/* ============================================================
   المصادقة
   ============================================================ */
function toUser(u) {
  if (!u) return null;
  const m = u.user_metadata || {};
  return {
    uid: u.id,
    email: u.email || '',
    emailVerified: !!u.email_confirmed_at,
    displayName: m.display_name || m.full_name || m.name || '',
    photoURL: m.avatar_url || m.picture || '',
    providerData: [{ providerId: (u.app_metadata || {}).provider || 'password' }],
    getIdToken: async () => (await sb.auth.getSession()).data.session?.access_token || ''
  };
}

const authObj = { currentUser: null, __kind: 'auth' };
export function initializeAuth() { return authObj; }
export function getAuth() { return authObj; }

/* ثوابت الاستمرارية في Firebase — Supabase يحفظ الجلسة وحده، فهي بلا أثر */
export const indexedDBLocalPersistence = { type: 'indexedDB' };
export const browserLocalPersistence = { type: 'local' };
export const browserPopupRedirectResolver = { type: 'popup' };

export function onAuthStateChanged(auth, cb) {
  sb.auth.getSession().then(({ data }) => {
    authObj.currentUser = toUser(data.session ? data.session.user : null);
    cb(authObj.currentUser);
  });
  const { data: sub } = sb.auth.onAuthStateChange((_e, session) => {
    authObj.currentUser = toUser(session ? session.user : null);
    cb(authObj.currentUser);
  });
  return () => { try { sub.subscription.unsubscribe(); } catch (e) { } };
}

function authFail(error) {
  /* نُلبس الخطأ شكل أخطاء Firebase لأن مرصاد يفحص error.code */
  const msg = (error && error.message) || '';
  let code = 'auth/unknown';
  if (/invalid login|invalid credentials/i.test(msg)) code = 'auth/wrong-password';
  else if (/already registered|already exists/i.test(msg)) code = 'auth/email-already-in-use';
  else if (/password/i.test(msg) && /least|short/i.test(msg)) code = 'auth/weak-password';
  else if (/email/i.test(msg) && /invalid/i.test(msg)) code = 'auth/invalid-email';
  const e = new Error(msg); e.code = code; return e;
}

export async function signInWithEmailAndPassword(auth, email, password) {
  const { data, error } = await sb.auth.signInWithPassword({ email: String(email).trim().toLowerCase(), password });
  if (error) throw authFail(error);
  authObj.currentUser = toUser(data.user);
  return { user: authObj.currentUser };
}
export async function createUserWithEmailAndPassword(auth, email, password) {
  const { data, error } = await sb.auth.signUp({ email: String(email).trim().toLowerCase(), password });
  if (error) throw authFail(error);
  authObj.currentUser = toUser(data.user);
  return { user: authObj.currentUser };
}
export async function signOut() {
  await sb.auth.signOut();
  authObj.currentUser = null;
}
export async function updateProfile(user, patch) {
  const d = {};
  if (patch.displayName !== undefined) d.display_name = patch.displayName;
  if (patch.photoURL !== undefined) d.avatar_url = patch.photoURL;
  const { error } = await sb.auth.updateUser({ data: d });
  if (error) throw authFail(error);
  if (authObj.currentUser) Object.assign(authObj.currentUser, patch);
}
export async function updateEmail(user, email) {
  const { error } = await sb.auth.updateUser({ email });
  if (error) throw authFail(error);
}

/* دخول Google — يعمل متى فعّلته في Supabase ← Authentication ← Providers */
export class GoogleAuthProvider {
  constructor() { this.providerId = 'google'; }
  addScope() { return this; }
  setCustomParameters() { return this; }
  static credential() { return { providerId: 'google' }; }
  static credentialFromResult() { return null; }
}
export class EmailAuthProvider {
  static credential(email, password) { return { providerId: 'password', email, password }; }
}
async function oauthGoogle() {
  const { error } = await sb.auth.signInWithOAuth({
    provider: 'google', options: { redirectTo: location.origin + location.pathname }
  });
  if (error) throw authFail(error);
  return { user: null };                     // المتصفّح ينتقل لصفحة Google الآن
}
export const signInWithPopup = oauthGoogle;
export const signInWithRedirect = oauthGoogle;
export async function getRedirectResult() {
  const { data } = await sb.auth.getSession();   // Supabase يلتقط العودة وحده
  return data.session ? { user: toUser(data.session.user) } : null;
}
export async function signInWithCredential(auth, cred) {
  if (cred && cred.providerId === 'password') return signInWithEmailAndPassword(auth, cred.email, cred.password);
  return oauthGoogle();
}
export async function linkWithCredential(user, cred) {
  if (cred && cred.providerId === 'password') {
    const { error } = await sb.auth.updateUser({ password: cred.password });
    if (error) throw authFail(error);
  }
  return { user: authObj.currentUser };
}

/* ============================================================
   الملفات
   ============================================================ */
export function getStorage() { return { __kind: 'storage' }; }
export function ref(storage, path) { return { __kind: 'file', path: String(path || '').replace(/^\/+/, '') }; }
export async function uploadBytes(fileRef, body) {
  const full = (await ownerId()) + '/' + fileRef.path;
  const { error } = await sb.storage.from('mirsad').upload(full, body, { upsert: true });
  if (error) throw error;
  return { ref: Object.assign({}, fileRef, { path: full }) };
}
export async function getDownloadURL(fileRef) {
  const full = fileRef.path.includes('/') && fileRef.path.split('/')[0].length === 36
    ? fileRef.path : (await ownerId()) + '/' + fileRef.path;
  const { data, error } = await sb.storage.from('mirsad').createSignedUrl(full, 60 * 60 * 8);
  if (error) throw error;
  return data.signedUrl;
}

/* للفحص من نافذة المطوّر عند الحاجة */
window.__mirsadSupabase = sb;
