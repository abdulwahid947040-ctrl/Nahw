export interface NahwDemoTopic {
  id: string;
  titleArabic: string;
  category: string;
  meaning: string;
  exampleArabic: string;
  exampleUrdu: string;
}

export const NAHW_DEMO_TOPICS: NahwDemoTopic[] = [
  {
    id: 'fail',
    titleArabic: 'الفَاعِل',
    category: 'مَرْفُوعَات',
    meaning: 'The Subject / Doer',
    exampleArabic: 'قَامَ زَيْدٌ',
    exampleUrdu: 'فعل صادر کرنے والا، ہمیشہ مرفوع ہوتا ہے',
  },
  {
    id: 'maful',
    titleArabic: 'المَفْعُولُ بِهِ',
    category: 'مَنْصُوبَات',
    meaning: 'The Direct Object',
    exampleArabic: 'قَرَأَ الطَّالِبُ الكِتَابَ',
    exampleUrdu: 'جس پر فعل واقع ہو، ہمیشہ منصوب ہوتا ہے',
  },
  {
    id: 'mubtada-khabar',
    titleArabic: 'المُبْتَدَأ وَالخَبَر',
    category: 'جُمْلَہ اسْمِیَّہ',
    meaning: 'Subject & Predicate',
    exampleArabic: 'العِلْمُ نُورٌ',
    exampleUrdu: 'جملہ اسمیہ کے دو بنیادی ارکان، دونوں مرفوع',
  },
  {
    id: 'hal',
    titleArabic: 'الحَال',
    category: 'مَنْصُوبَات',
    meaning: 'The Circumstantial State',
    exampleArabic: 'جَاءَ زَيْدٌ رَاكِبًا',
    exampleUrdu: 'فاعل یا مفعول بہ کی کیفیت بیان کرنے والا اسم',
  },
  {
    id: 'tamyiz',
    titleArabic: 'التَّمْيِيز',
    category: 'مَنْصُوبَات',
    meaning: 'The Specification',
    exampleArabic: 'عِشْرُونَ دِرْهَمًا',
    exampleUrdu: 'مبہم عدد یا مقدار سے ابہام دور کرنے والا اسم',
  },
  {
    id: 'idhafah',
    titleArabic: 'الإِضَافَة',
    category: 'مَجْرُورَات',
    meaning: 'Genitive Construct',
    exampleArabic: 'كِتَابُ اللهِ',
    exampleUrdu: 'مضاف اور مضاف الیہ کا پاکیزہ نسبتی تعلق',
  },
  {
    id: 'huruf-jarr',
    titleArabic: 'حُرُوفُ الجَرّ',
    category: 'عَوَامِل',
    meaning: 'The Prepositions',
    exampleArabic: 'فِي المَسْجِدِ',
    exampleUrdu: 'سترہ وہ حروف جو بعد والے اسم کو کسرہ (جر) دیتے ہیں',
  },
  {
    id: 'naat',
    titleArabic: 'النَّعْت وَالمَنْعُوت',
    category: 'تَوَابِع',
    meaning: 'Adjective & Modified Noun',
    exampleArabic: 'رَجُلٌ كَرِيمٌ',
    exampleUrdu: 'موصوف کی صفت جو اعراب اور تعریف میں موافقت رکھے',
  },
];
