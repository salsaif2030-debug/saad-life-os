/* ============================================================
   إعدادات Firebase الخاصة بمرصاد — املأها من مشروعك أنت.

   من أين تأتي هذه القيم:
   console.firebase.google.com ← مشروعك ← ⚙ Project settings
   ← Your apps ← Web app ← SDK setup and configuration ← Config

   ثم فعّل من لوحة Firebase:
   · Authentication ← Sign-in method ← Google
   · Firestore Database (وضع Production)
   · Storage
   وانشر قواعد الحماية الموجودة في مجلد «تطبيق مرصاد»:
   firestore.rules و storage.rules

   ملاحظة: apiKey هنا مفتاح عام — ظهوره طبيعي وآمن،
   الحماية الحقيقية في قواعد Firestore و Storage.
   ============================================================ */

window.MIRSAD_FIREBASE = {
  apiKey: "",
  authDomain: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: ""
};
