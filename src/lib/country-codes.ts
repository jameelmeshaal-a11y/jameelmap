// تحويل اسم الدولة (عربي/إنجليزي) إلى كود ISO-3166 alpha-2
// — يستخدم لاستدعاء Places API (New) عبر includedRegionCodes

const MAP: Record<string, string> = {
  // English
  "usa": "US", "us": "US", "united states": "US", "america": "US",
  "uk": "GB", "united kingdom": "GB", "britain": "GB", "england": "GB", "great britain": "GB",
  "uae": "AE", "united arab emirates": "AE", "emirates": "AE",
  "ksa": "SA", "saudi arabia": "SA", "saudi": "SA",
  "egypt": "EG", "turkey": "TR", "türkiye": "TR",
  "germany": "DE", "france": "FR", "spain": "ES", "italy": "IT",
  "canada": "CA", "australia": "AU", "india": "IN", "pakistan": "PK",
  "indonesia": "ID", "malaysia": "MY", "singapore": "SG",
  "jordan": "JO", "lebanon": "LB", "syria": "SY", "iraq": "IQ",
  "kuwait": "KW", "qatar": "QA", "bahrain": "BH", "oman": "OM", "yemen": "YE",
  "morocco": "MA", "algeria": "DZ", "tunisia": "TN", "libya": "LY", "sudan": "SD",
  "palestine": "PS", "israel": "IL",
  "japan": "JP", "china": "CN", "korea": "KR", "south korea": "KR",
  "brazil": "BR", "mexico": "MX", "argentina": "AR", "chile": "CL",
  "netherlands": "NL", "belgium": "BE", "sweden": "SE", "norway": "NO",
  "denmark": "DK", "finland": "FI", "switzerland": "CH", "austria": "AT",
  "poland": "PL", "portugal": "PT", "greece": "GR", "ireland": "IE",
  "russia": "RU", "ukraine": "UA",
  "south africa": "ZA", "nigeria": "NG", "kenya": "KE", "ethiopia": "ET",
  "thailand": "TH", "vietnam": "VN", "philippines": "PH",
  "bangladesh": "BD", "afghanistan": "AF", "iran": "IR",
  "new zealand": "NZ",
  // Arabic
  "أمريكا": "US", "امريكا": "US", "الولايات المتحدة": "US",
  "بريطانيا": "GB", "المملكة المتحدة": "GB", "انجلترا": "GB", "إنجلترا": "GB",
  "الإمارات": "AE", "الامارات": "AE",
  "السعودية": "SA", "المملكة العربية السعودية": "SA",
  "مصر": "EG", "تركيا": "TR",
  "ألمانيا": "DE", "المانيا": "DE", "فرنسا": "FR", "إسبانيا": "ES", "اسبانيا": "ES", "إيطاليا": "IT", "ايطاليا": "IT",
  "كندا": "CA", "أستراليا": "AU", "استراليا": "AU", "الهند": "IN", "باكستان": "PK",
  "إندونيسيا": "ID", "اندونيسيا": "ID", "ماليزيا": "MY", "سنغافورة": "SG",
  "الأردن": "JO", "الاردن": "JO", "لبنان": "LB", "سوريا": "SY", "العراق": "IQ",
  "الكويت": "KW", "قطر": "QA", "البحرين": "BH", "عُمان": "OM", "عمان": "OM", "اليمن": "YE",
  "المغرب": "MA", "الجزائر": "DZ", "تونس": "TN", "ليبيا": "LY", "السودان": "SD",
  "فلسطين": "PS", "إسرائيل": "IL", "اسرائيل": "IL",
  "اليابان": "JP", "الصين": "CN", "كوريا": "KR", "كوريا الجنوبية": "KR",
  "البرازيل": "BR", "المكسيك": "MX",
  "هولندا": "NL", "بلجيكا": "BE", "السويد": "SE", "النرويج": "NO",
  "الدنمارك": "DK", "فنلندا": "FI", "سويسرا": "CH", "النمسا": "AT",
  "بولندا": "PL", "البرتغال": "PT", "اليونان": "GR", "أيرلندا": "IE", "ايرلندا": "IE",
  "روسيا": "RU", "أوكرانيا": "UA", "اوكرانيا": "UA",
  "جنوب أفريقيا": "ZA", "نيجيريا": "NG", "كينيا": "KE", "إثيوبيا": "ET",
  "تايلاند": "TH", "فيتنام": "VN", "الفلبين": "PH",
  "بنغلاديش": "BD", "أفغانستان": "AF", "افغانستان": "AF", "إيران": "IR", "ايران": "IR",
  "نيوزيلندا": "NZ", "نيوزلندا": "NZ",
};

export function countryNameToCode(name: string): string | null {
  const key = name.trim().toLowerCase();
  if (/^[a-z]{2}$/i.test(key)) return key.toUpperCase();
  return MAP[key] ?? null;
}
