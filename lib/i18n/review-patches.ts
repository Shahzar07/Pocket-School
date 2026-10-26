/**
 * AI-ASSISTED — NEEDS HUMAN REVIEW
 * Machine translations of the strings a reader sees first: the landing hero,
 * the FAQ, and the language picker. The rest of a non-human catalog is the
 * English source, filled in by the catalog merge, and the whole catalog stays
 * `needs-review` until a person checks it.
 */
import { FAQ_DRAFTS } from './faq-drafts';

const HERO: Record<string, { title: string; stat: string; credibility: string }> = {
  ar: {
    title: 'تعلّم بطريقتك & امضِ أبعد مع الذكاء الاصطناعي.',
    stat: 'أكثر من 30 معلّم ET AI متاحون على مدار الساعة',
    credibility: "بُني مع Rochford's International School, Ipoh, ماليزيا.",
  },
  he: {
    title: 'למדו בדרך שלכם & המשיכו הלאה עם AI.',
    stat: 'יותר מ-30 מורי ET AI זמינים 24/7',
    credibility: "נבנה עם Rochford's International School, Ipoh, מלזיה.",
  },
  fa: {
    title: 'به شیوه خود بیاموزید & با هوش مصنوعی جلوتر بروید.',
    stat: 'بیش از ۳۰ معلم ET AI، شبانه‌روزی',
    credibility: "ساخته‌شده با Rochford's International School, Ipoh, مالزی.",
  },
  ur: {
    title: 'اپنے انداز میں سیکھیں & AI کے ساتھ آگے بڑھیں۔',
    stat: '30+ ET AI اساتذہ، دن رات دستیاب',
    credibility: "Rochford's International School, Ipoh, ملائیشیا کے ساتھ بنایا گیا۔",
  },
  ps: {
    title: 'په خپله لاره زده کړه وکړئ & له AI سره نور هم مخکې لاړ شئ.',
    stat: '۳۰+ ET AI ښوونکي، ۲۴/۷',
    credibility: "د Rochford's International School, Ipoh, مالیزیا سره جوړ شوی.",
  },
  hi: { title: 'अपने तरीके से सीखें & AI के साथ आगे बढ़ें।', stat: '30+ ET AI शिक्षक, 24/7', credibility: "Rochford's International School, Ipoh, मलेशिया के साथ बनाया गया।" },
  bn: { title: 'আপনার মতো করে শিখুন & AI-এর সাথে আরও এগিয়ে যান।', stat: '৩০+ ET AI শিক্ষক, ২৪/৭', credibility: "Rochford's International School, Ipoh, মালয়েশিয়া-এর সাথে তৈরি।" },
  pa: { title: 'ਆਪਣੇ ਢੰਗ ਨਾਲ ਸਿੱਖੋ & AI ਨਾਲ ਅੱਗੇ ਵਧੋ।', stat: '30+ ET AI ਅਧਿਆਪਕ, 24/7', credibility: "Rochford's International School, Ipoh, ਮਲੇਸ਼ੀਆ ਨਾਲ ਬਣਾਇਆ ਗਿਆ।" },
  te: { title: 'మీ మార్గంలో నేర్చుకోండి & AIతో ముందుకు వెళ్లండి.', stat: '30+ ET AI ఉపాధ్యాయులు, 24/7', credibility: "Rochford's International School, Ipoh, మలేషియా తో నిర్మించబడింది." },
  mr: { title: 'तुमच्या पद्धतीने शिका & AI सोबत पुढे जा.', stat: '30+ ET AI शिक्षक, 24/7', credibility: "Rochford's International School, Ipoh, मलेशिया सोबत बांधले." },
  gu: { title: 'તમારી રીતે શીખો & AI સાથે આગળ વધો.', stat: '30+ ET AI શિક્ષકો, 24/7', credibility: "Rochford's International School, Ipoh, મલેશિયા સાથે બનાવેલ." },
  kn: { title: 'ನಿಮ್ಮ ರೀತಿಯಲ್ಲಿ ಕಲಿಯಿರಿ & AI ಜೊತೆ ಮುಂದೆ ಹೋಗಿ.', stat: '30+ ET AI ಶಿಕ್ಷಕರು, 24/7', credibility: "Rochford's International School, Ipoh, ಮಲೇಷ್ಯಾ ಜೊತೆ ನಿರ್ಮಿಸಲಾಗಿದೆ." },
  ml: { title: 'നിങ്ങളുടെ രീതിയിൽ പഠിക്കുക & AI-യോടൊപ്പം മുന്നോട്ട്.', stat: '30+ ET AI അധ്യാപകർ, 24/7', credibility: "Rochford's International School, Ipoh, മലേഷ്യ-നൊപ്പം നിർമ്മിച്ചത്." },
  ne: { title: 'आफ्नै तरिकाले सिक्नुहोस् & AI सँग अझ अघि।', stat: '30+ ET AI शिक्षक, 24/7', credibility: "Rochford's International School, Ipoh, मलेसिया सँग बनेको।" },
  or: { title: 'ଆପଣଙ୍କ ଢଙ୍ଗରେ ଶିଖନ୍ତୁ & AI ସହ ଆଗକୁ।', stat: '30+ ET AI ଶିକ୍ଷକ, 24/7', credibility: "Rochford's International School, Ipoh, ମାଲେସିଆ ସହିତ ନିର୍ମିତ।" },
  si: { title: 'ඔබේ ආකාරයට ඉගෙන ගන්න & AI සමඟ තව ඉදිරියට.', stat: 'ET AI ගුරුවරු 30+, 24/7', credibility: "Rochford's International School, Ipoh, මැලේසියාව සමඟ ගොඩනගා ඇත." },
  id: { title: 'Belajar dengan cara Anda & Melangkah lebih jauh dengan AI.', stat: '30+ guru ET AI, 24/7', credibility: "Dibangun bersama Rochford's International School, Ipoh, Malaysia." },
  jv: { title: 'Sinau kanthi caramu & Maju luwih adoh karo AI.', stat: '30+ guru ET AI, 24/7', credibility: "Digawe karo Rochford's International School, Ipoh, Malaysia." },
  vi: { title: 'Học theo cách của bạn & Đi xa hơn cùng AI.', stat: '30+ giáo viên ET AI, 24/7', credibility: "Xây dựng cùng Rochford's International School, Ipoh, Malaysia." },
  th: { title: 'เรียนในแบบของคุณ & ก้าวต่อไปกับ AI', stat: 'ครู ET AI 30+ คน พร้อม 24/7', credibility: "สร้างร่วมกับ Rochford's International School, Ipoh, มาเลเซีย" },
  fil: { title: 'Matuto sa iyong paraan & Lumayo pa kasama ang AI.', stat: '30+ guro ng ET AI, 24/7', credibility: "Itinayo kasama ang Rochford's International School, Ipoh, Malaysia." },
  my: { title: 'သင့်နည်းလမ်းဖြင့် လေ့လာပါ & AI နှင့် ပိုဝေးရာသို့။', stat: 'ET AI ဆရာ 30+၊ 24/7', credibility: "Rochford's International School, Ipoh, မလေးရှား နှင့် တည်ဆောက်ထားသည်။" },
  km: { title: 'រៀនតាមវិធីរបស់អ្នក & ទៅមុខបន្ថែមជាមួយ AI។', stat: 'គ្រូ ET AI 30+ នាក់, 24/7', credibility: "សាងសង់ជាមួយ Rochford's International School, Ipoh, ម៉ាឡេស៊ី." },
  tr: { title: 'Kendi yolunla öğren & Yapay zekâ ile daha ileri git.', stat: '30+ ET AI öğretmeni, 7/24', credibility: "Rochford's International School, Ipoh, Malezya ile birlikte kuruldu." },
  ru: { title: 'Учитесь по-своему & Идите дальше с ИИ.', stat: '30+ преподавателей ET AI, круглосуточно', credibility: "Создано вместе с Rochford's International School, Ipoh, Малайзия." },
  de: { title: 'Lerne auf deine Weise & Komm mit KI weiter.', stat: '30+ ET-AI-Lehrkräfte, rund um die Uhr', credibility: "Entwickelt mit Rochford's International School, Ipoh, Malaysia." },
  fr: { title: 'Apprenez à votre façon & Allez plus loin avec l’IA.', stat: 'Plus de 30 enseignants ET AI, 24 h/24', credibility: "Conçu avec Rochford's International School, Ipoh, Malaisie." },
  it: { title: 'Impara a modo tuo & Vai più lontano con l’IA.', stat: 'Oltre 30 insegnanti ET AI, 24 ore su 24', credibility: "Realizzato con Rochford's International School, Ipoh, Malesia." },
  pt: { title: 'Aprenda do seu jeito & Vá mais longe com IA.', stat: 'Mais de 30 professores ET AI, 24 horas', credibility: "Feito com a Rochford's International School, Ipoh, Malásia." },
  'pt-PT': { title: 'Aprenda à sua maneira & Vá mais longe com IA.', stat: 'Mais de 30 professores ET AI, 24 horas', credibility: "Feito com a Rochford's International School, Ipoh, Malásia." },
  nl: { title: 'Leer op jouw manier & Ga verder met AI.', stat: '30+ ET AI-docenten, 24/7', credibility: "Gebouwd met Rochford's International School, Ipoh, Maleisië." },
  pl: { title: 'Ucz się po swojemu & Idź dalej z AI.', stat: 'Ponad 30 nauczycieli ET AI, 24/7', credibility: "Stworzone z Rochford's International School, Ipoh, Malezja." },
  uk: { title: 'Вчіться по-своєму & Ідіть далі з ШІ.', stat: '30+ викладачів ET AI, цілодобово', credibility: "Створено з Rochford's International School, Ipoh, Малайзія." },
  ro: { title: 'Învață în felul tău & Mergi mai departe cu IA.', stat: 'Peste 30 de profesori ET AI, non-stop', credibility: "Construit cu Rochford's International School, Ipoh, Malaezia." },
  el: { title: 'Μάθε με τον τρόπο σου & Προχώρα πιο μακριά με την ΤΝ.', stat: '30+ δάσκαλοι ET AI, όλο το 24ωρο', credibility: "Χτίστηκε με το Rochford's International School, Ipoh, Μαλαισία." },
  cs: { title: 'Učte se po svém & Jděte dál s AI.', stat: 'Více než 30 učitelů ET AI, nonstop', credibility: "Vytvořeno s Rochford's International School, Ipoh, Malajsie." },
  hu: { title: 'Tanulj a magad módján & Juss tovább az MI-vel.', stat: '30+ ET AI tanár, a nap 24 órájában', credibility: "A Rochford's International School, Ipoh, Malajzia közreműködésével." },
  sv: { title: 'Lär dig på ditt sätt & Gå längre med AI.', stat: '30+ ET AI-lärare, dygnet runt', credibility: "Byggd med Rochford's International School, Ipoh, Malaysia." },
  ja: { title: '自分のやり方で学ぶ & AIと、もっと先へ。', stat: 'ET AIの先生が30人以上、24時間', credibility: "Rochford's International School, Ipoh, マレーシア と共に築かれました。" },
  ko: { title: '당신만의 방식으로 배우세요 & AI와 함께 더 멀리.', stat: 'ET AI 교사 30명 이상, 24시간', credibility: "Rochford's International School, Ipoh, 말레이시아와 함께 만들었습니다." },
  kk: { title: 'Өз жолыңмен үйрен & ЖИ-мен ары қарай бар.', stat: '30+ ET AI мұғалімі, тәулік бойы', credibility: "Rochford's International School, Ipoh, Малайзия-пен бірге жасалған." },
  uz: { title: 'O‘z uslubingizda o‘rganing & AI bilan yanada olg‘a.', stat: '30+ ET AI o‘qituvchisi, 24/7', credibility: "Rochford's International School, Ipoh, Malayziya bilan qurilgan." },
  sw: { title: 'Jifunze kwa njia yako & Nenda mbali zaidi na AI.', stat: 'Walimu 30+ wa ET AI, saa 24', credibility: "Imejengwa na Rochford's International School, Ipoh, Malaysia." },
  ha: { title: 'Koyi ta hanyarka & Ci gaba da AI.', stat: 'Malaman ET AI 30+, 24/7', credibility: "An gina shi tare da Rochford's International School, Ipoh, Malaysia." },
  yo: { title: 'Kọ́ ní ọ̀nà tirẹ & Lọ síwájú pẹ̀lú AI.', stat: 'Olùkọ́ ET AI 30+, 24/7', credibility: "A kọ́ ọ pẹ̀lú Rochford's International School, Ipoh, Malaysia." },
  am: { title: 'በራስህ መንገድ ተማር & ከ AI ጋር የበለጠ ሂድ።', stat: '30+ የ ET AI መምህራን፣ 24/7', credibility: "ከ Rochford's International School, Ipoh, ማሌዢያ ጋር ተገንብቷል።" },
  es: { title: 'Aprende a tu manera & Llega más lejos con la IA.', stat: 'Más de 30 profesores ET AI, las 24 horas', credibility: "Creado con Rochford's International School, Ipoh, Malasia." },
  'zh-Hant': { title: '用你的方式學習 & 與 AI 一起走得更遠。', stat: '30+ 位 ET AI 老師，全天可用', credibility: "與 Rochford's International School, Ipoh, 馬來西亞 共同打造。" },
  yue: { title: '用你嘅方式學 & 同 AI 一齊行遠啲。', stat: '30+ 位 ET AI 老師，24/7', credibility: "同 Rochford's International School, Ipoh, 馬來西亞 一齊起。" },
};

const SEARCH: Record<string, { search: string; none: string }> = {
  ar: { search: 'ابحث عن لغة', none: 'لا توجد لغة مطابقة.' },
  he: { search: 'חיפוש שפה', none: 'אין שפה תואמת.' },
  fa: { search: 'جستجوی زبان', none: 'زبانی پیدا نشد.' },
  ur: { search: 'زبان تلاش کریں', none: 'کوئی زبان نہیں ملی۔' },
  ps: { search: 'ژبه ولټوه', none: 'هیڅ ژبه ونه موندل شوه.' },
  hi: { search: 'भाषा खोजें', none: 'कोई भाषा नहीं मिली।' },
  bn: { search: 'ভাষা খুঁজুন', none: 'কোনো ভাষা মেলেনি।' },
  id: { search: 'Cari bahasa', none: 'Tidak ada bahasa yang cocok.' },
  vi: { search: 'Tìm ngôn ngữ', none: 'Không có ngôn ngữ phù hợp.' },
  th: { search: 'ค้นหาภาษา', none: 'ไม่พบภาษาที่ตรงกัน' },
  fil: { search: 'Maghanap ng wika', none: 'Walang tumugmang wika.' },
  tr: { search: 'Dil ara', none: 'Eşleşen dil yok.' },
  ru: { search: 'Поиск языка', none: 'Нет подходящего языка.' },
  de: { search: 'Sprache suchen', none: 'Keine passende Sprache.' },
  fr: { search: 'Rechercher une langue', none: 'Aucune langue ne correspond.' },
  it: { search: 'Cerca una lingua', none: 'Nessuna lingua corrisponde.' },
  pt: { search: 'Buscar idioma', none: 'Nenhum idioma encontrado.' },
  'pt-PT': { search: 'Procurar idioma', none: 'Nenhum idioma corresponde.' },
  nl: { search: 'Taal zoeken', none: 'Geen taal gevonden.' },
  pl: { search: 'Szukaj języka', none: 'Brak pasującego języka.' },
  uk: { search: 'Пошук мови', none: 'Немає відповідної мови.' },
  ja: { search: '言語を検索', none: '一致する言語がありません。' },
  ko: { search: '언어 검색', none: '일치하는 언어가 없습니다.' },
  es: { search: 'Buscar idioma', none: 'Ningún idioma coincide.' },
  sw: { search: 'Tafuta lugha', none: 'Hakuna lugha inayolingana.' },
  kk: { search: 'Тілді іздеу', none: 'Сәйкес тіл жоқ.' },
};

function headlineParts(title: string): { title: string; titleEm: string } {
  const splitAt = title.indexOf(' & ');
  if (splitAt < 0) return { title, titleEm: '' };
  return { title: title.slice(0, splitAt), titleEm: title.slice(splitAt + 3) };
}

export function reviewPatch(code: string): Record<string, unknown> | undefined {
  const hero = HERO[code];
  const search = SEARCH[code];
  const faq = FAQ_DRAFTS[code];
  if (!hero && !search && !faq) return undefined;
  const landing = {
    ...(hero ? { hero } : {}),
    ...(faq ? { faq } : {}),
  };
  const parts = hero ? headlineParts(hero.title) : null;
  return {
    ...(Object.keys(landing).length > 0 ? { landing } : {}),
    ...(parts ? {
      home: {
        v3: {
          title: parts.title,
          titleEm: parts.titleEm,
          cred: hero?.credibility,
          rochfords: hero?.credibility,
        },
      },
    } : {}),
    ...(search ? { switcher: search } : {}),
  };
}
