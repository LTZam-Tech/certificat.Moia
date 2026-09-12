'use strict';

const STRINGS = {
  ar: {
    retrieving: 'جارٍ الاسترجاع من مجلد الوزارة المشترك…',
    genericError: 'تعذّر التحقق من البيانات. تأكد من رقم الهوية الوطنية ورقم الجوال المسجّل ثم حاول مرة أخرى.',
    idFormatError: 'أدخل رقم هوية وطنية صحيح مكوّن من 10 أرقام.',
    mobileFormatError: 'أدخل رقم جوال سعودي صحيح (5X XXX XXXX).',
    lockedOut: 'تم إيقاف الدخول مؤقتًا بسبب عدة محاولات غير ناجحة. الرجاء المحاولة لاحقًا.',
    serviceDown: 'تعذّر الوصول إلى مجلد الشهادات حاليًا. الرجاء المحاولة لاحقًا أو التواصل مع الدعم الفني.',
    noCerts: 'لا توجد شهادات متاحة بعد',
    noCertsSub: 'عند نشر تدريبك المكتمل، ستظهر شهاداتك هنا للتنزيل.',
    verified: 'تم التحقق من الهوية',
    signOut: 'تسجيل الخروج',
    download: 'تنزيل',
    yourCerts: 'شهاداتك',
    certAvailable: (n) => `${n} ${n === 1 ? 'شهادة متاحة' : 'شهادات متاحة'}`,
    issued: (d) => `صدرت في ${d}`,
    completed: 'مكتملة',
    genericCert: (n) => `شهادة ${n}`,
    sessionExpired: 'انتهت الجلسة. الرجاء تسجيل الدخول مرة أخرى.',
  },
  en: {
    retrieving: 'Retrieving from the ministry shared folder…',
    genericError: "We couldn't verify these details. Check your National ID and registered mobile number, then try again.",
    idFormatError: 'Enter a valid 10-digit National ID.',
    mobileFormatError: 'Enter a valid Saudi mobile number (5X XXX XXXX).',
    lockedOut: 'Access is temporarily locked after several unsuccessful attempts. Please try again later.',
    serviceDown: 'The certificate folder is currently unreachable. Please try again later or contact IT support.',
    noCerts: 'No certificates available yet',
    noCertsSub: 'When your completed training is published, your certificates will appear here for download.',
    verified: 'Identity verified',
    signOut: 'Sign out',
    download: 'Download',
    yourCerts: 'Your certificates',
    certAvailable: (n) => `${n} available`,
    issued: (d) => `Issued ${d}`,
    completed: 'Completed',
    genericCert: (n) => `Certificate ${n}`,
    sessionExpired: 'Your session has expired. Please sign in again.',
  },
};

function getLang() {
  return localStorage.getItem('portal_lang') || 'ar';
}
function setLang(lang) {
  localStorage.setItem('portal_lang', lang);
}
function t(key) {
  return STRINGS[getLang()][key];
}

function applyStaticLang() {
  const lang = getLang();
  const root = document.documentElement;
  root.setAttribute('lang', lang);
  root.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');
  document.querySelectorAll('[data-ar]').forEach((el) => {
    const v = el.getAttribute(`data-${lang}`);
    if (v !== null) el.textContent = v;
  });
  document.querySelectorAll('[data-ar-ph]').forEach((el) => {
    const v = el.getAttribute(`data-${lang}-ph`);
    if (v !== null) el.setAttribute('placeholder', v);
  });
  const label = document.getElementById('langLabel');
  if (label) label.textContent = lang === 'ar' ? 'English' : 'عربي';
  document.title = lang === 'ar'
    ? 'بوابة الشهادات — وزارة الشؤون الإسلامية والدعوة والإرشاد'
    : 'Certificate Portal — Ministry of Islamic Affairs, Dawah and Guidance';
}

function toggleLang() {
  setLang(getLang() === 'ar' ? 'en' : 'ar');
  applyStaticLang();
  if (typeof onLangChanged === 'function') onLangChanged();
}
