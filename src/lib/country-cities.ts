// قائمة أكبر مدن لكل دولة. المفاتيح بأشكال متعددة (عربي/إنجليزي/كود) لمرونة الإدخال.

// كلمات بحث للمساجد (عربي + إنجليزي) — لرفع التغطية في كل مدينة
export const MOSQUE_KEYWORDS = [
  "Mosque", "Masjid", "Islamic Center", "Muslim Community Center",
  "Jami Masjid", "Jamia Masjid", "مسجد", "Islamic Society",
  "Islamic Association", "Muslim Prayer", "Musalla",
];

// كشف ما إذا كان النشاط متعلقاً بالمساجد (يستخدم القائمة الموسّعة)
export function isMosqueActivity(activity: string): boolean {
  const a = activity.trim().toLowerCase();
  return /mosque|masjid|islamic|muslim|musalla|مسجد|اسلام|إسلام|مصلى/i.test(a);
}

export const COUNTRY_CITIES: Record<string, string[]> = {
  USA: [
    // Northeast
    "New York, NY","Brooklyn, NY","Queens, NY","Bronx, NY","Buffalo, NY",
    "Newark, NJ","Jersey City, NJ","Paterson, NJ","Trenton, NJ","Clifton, NJ",
    "Philadelphia, PA","Pittsburgh, PA","Allentown, PA",
    "Boston, MA","Worcester, MA","Springfield, MA",
    "Providence, RI","Hartford, CT","Bridgeport, CT",
    "Manchester, NH","Portland, ME","Burlington, VT",
    // Mid-Atlantic & DC Metro
    "Washington, DC","Baltimore, MD","Silver Spring, MD",
    "Arlington, VA","Alexandria, VA","Falls Church, VA","Richmond, VA",
    "Wilmington, DE",
    // Southeast
    "Atlanta, GA","Augusta, GA","Columbus, GA",
    "Charlotte, NC","Raleigh, NC","Durham, NC","Greensboro, NC",
    "Columbia, SC","Charleston, SC",
    "Jacksonville, FL","Miami, FL","Orlando, FL","Tampa, FL",
    "St. Petersburg, FL","Fort Lauderdale, FL","Boca Raton, FL",
    "Nashville, TN","Memphis, TN","Knoxville, TN",
    "Louisville, KY","Lexington, KY",
    "Birmingham, AL","Montgomery, AL",
    "Jackson, MS","Little Rock, AR",
    // Midwest
    "Chicago, IL","Aurora, IL","Rockford, IL","Naperville, IL","Bridgeview, IL",
    "Detroit, MI","Dearborn, MI","Dearborn Heights, MI","Hamtramck, MI",
    "Grand Rapids, MI","Warren, MI","Sterling Heights, MI",
    "Columbus, OH","Cleveland, OH","Cincinnati, OH","Toledo, OH","Akron, OH",
    "Indianapolis, IN","Fort Wayne, IN",
    "Milwaukee, WI","Madison, WI",
    "Minneapolis, MN","St. Paul, MN",
    "Kansas City, MO","St. Louis, MO",
    "Omaha, NE","Lincoln, NE",
    "Des Moines, IA","Sioux Falls, SD","Fargo, ND",
    // South & Texas
    "Houston, TX","San Antonio, TX","Dallas, TX","Austin, TX",
    "Fort Worth, TX","El Paso, TX","Plano, TX","Irving, TX",
    "Garland, TX","Frisco, TX","Richardson, TX",
    "New Orleans, LA","Baton Rouge, LA",
    "Oklahoma City, OK","Tulsa, OK",
    // Mountain West
    "Denver, CO","Colorado Springs, CO","Aurora, CO",
    "Phoenix, AZ","Tucson, AZ","Mesa, AZ","Scottsdale, AZ","Tempe, AZ",
    "Salt Lake City, UT","Provo, UT",
    "Albuquerque, NM","Santa Fe, NM",
    "Las Vegas, NV","Henderson, NV","Reno, NV",
    "Boise, ID","Billings, MT","Cheyenne, WY",
    // Pacific West
    "Los Angeles, CA","San Diego, CA","San Jose, CA","San Francisco, CA",
    "Fresno, CA","Sacramento, CA","Long Beach, CA","Oakland, CA",
    "Anaheim, CA","Riverside, CA","Santa Ana, CA","Irvine, CA",
    "Chino, CA","Garden Grove, CA","Pomona, CA","Fremont, CA",
    "Seattle, WA","Spokane, WA","Tacoma, WA",
    "Portland, OR","Eugene, OR",
    // HI/AK
    "Honolulu, HI","Anchorage, AK",
  ],
  KSA: [
    "Riyadh","Jeddah","Mecca","Medina","Dammam","Khobar","Dhahran","Taif","Tabuk",
    "Buraidah","Khamis Mushait","Hail","Hofuf","Najran","Jubail","Yanbu","Abha","Jazan",
  ],
  UAE: [
    "Dubai","Abu Dhabi","Sharjah","Ajman","Al Ain","Ras Al Khaimah","Fujairah","Umm Al Quwain",
  ],
  EGYPT: [
    "Cairo","Alexandria","Giza","Shubra El Kheima","Port Said","Suez","Mansoura","El-Mahalla El-Kubra",
    "Tanta","Asyut","Ismailia","Faiyum","Zagazig","Aswan","Damietta","Damanhur","Minya","Beni Suef",
    "Hurghada","Qena","Sohag","Luxor",
  ],
  UK: [
    "London","Birmingham","Manchester","Liverpool","Leeds","Sheffield","Bristol","Newcastle",
    "Leicester","Coventry","Bradford","Cardiff","Belfast","Nottingham","Glasgow","Edinburgh",
  ],
  CANADA: [
    "Toronto, ON","Montreal, QC","Vancouver, BC","Calgary, AB","Edmonton, AB","Ottawa, ON",
    "Winnipeg, MB","Quebec City, QC","Hamilton, ON","Mississauga, ON","Brampton, ON","Surrey, BC",
  ],
  FRANCE: [
    "Paris","Marseille","Lyon","Toulouse","Nice","Nantes","Strasbourg","Montpellier","Bordeaux","Lille",
    "Rennes","Reims","Le Havre","Saint-Étienne","Toulon","Grenoble","Dijon","Angers","Nîmes",
  ],
  GERMANY: [
    "Berlin","Hamburg","Munich","Cologne","Frankfurt","Stuttgart","Düsseldorf","Leipzig","Dortmund",
    "Essen","Bremen","Dresden","Hanover","Nuremberg","Duisburg",
  ],
  TURKEY: [
    "Istanbul","Ankara","Izmir","Bursa","Adana","Gaziantep","Konya","Antalya","Kayseri","Mersin",
    "Eskisehir","Diyarbakir","Samsun","Denizli","Sanliurfa","Trabzon",
  ],
  MOROCCO: [
    "Casablanca","Rabat","Fes","Marrakesh","Agadir","Tangier","Meknes","Oujda","Kenitra","Tetouan",
  ],
  ALGERIA: [
    "Algiers","Oran","Constantine","Annaba","Blida","Batna","Setif","Sidi Bel Abbes","Tlemcen",
  ],
  TUNISIA: ["Tunis","Sfax","Sousse","Kairouan","Bizerte","Gabes","Ariana","Gafsa"],
  IRAQ: ["Baghdad","Basra","Mosul","Erbil","Sulaymaniyah","Najaf","Karbala","Kirkuk","Nasiriyah"],
  JORDAN: ["Amman","Zarqa","Irbid","Aqaba","Salt","Madaba","Jerash"],
  QATAR: ["Doha","Al Rayyan","Al Wakrah","Al Khor","Lusail"],
  KUWAIT: ["Kuwait City","Hawalli","Salmiya","Jahra","Farwaniya"],
  BAHRAIN: ["Manama","Muharraq","Riffa","Hamad Town","Isa Town"],
  OMAN: ["Muscat","Salalah","Sohar","Nizwa","Sur"],
  YEMEN: ["Sanaa","Aden","Taiz","Hodeidah","Mukalla","Ibb"],
  LEBANON: ["Beirut","Tripoli","Sidon","Tyre","Zahle"],
  SYRIA: ["Damascus","Aleppo","Homs","Latakia","Hama"],
  PALESTINE: ["Gaza","Hebron","Nablus","Jerusalem","Ramallah","Bethlehem"],
  LIBYA: ["Tripoli","Benghazi","Misrata","Sabha","Zawiya"],
  SUDAN: ["Khartoum","Omdurman","Port Sudan","Kassala","Nyala"],
  PAKISTAN: ["Karachi","Lahore","Faisalabad","Rawalpindi","Islamabad","Multan","Peshawar","Quetta"],
  INDONESIA: ["Jakarta","Surabaya","Bandung","Medan","Semarang","Makassar","Palembang","Yogyakarta"],
  MALAYSIA: ["Kuala Lumpur","Johor Bahru","Penang","Ipoh","Shah Alam","Kota Kinabalu","Kuching"],
  SPAIN: ["Madrid","Barcelona","Valencia","Seville","Zaragoza","Malaga","Murcia","Palma","Bilbao"],
  ITALY: ["Rome","Milan","Naples","Turin","Palermo","Genoa","Bologna","Florence","Bari","Catania"],
  NETHERLANDS: ["Amsterdam","Rotterdam","The Hague","Utrecht","Eindhoven","Groningen","Tilburg"],
  AUSTRALIA: ["Sydney","Melbourne","Brisbane","Perth","Adelaide","Gold Coast","Newcastle","Canberra"],
};

// خرائط اسماء مختلفة → مفتاح موحد
const ALIASES: Record<string, string> = {
  "usa":"USA","united states":"USA","united states of america":"USA","us":"USA","america":"USA","أمريكا":"USA","امريكا":"USA","الولايات المتحدة":"USA","الولايات المتحدة الامريكية":"USA","الولايات المتحدة الأمريكية":"USA","امريكيا":"USA",
  "ksa":"KSA","saudi arabia":"KSA","saudi":"KSA","السعودية":"KSA","المملكة العربية السعودية":"KSA","المملكه العربيه السعوديه":"KSA",
  "uae":"UAE","emirates":"UAE","united arab emirates":"UAE","الإمارات":"UAE","الامارات":"UAE","الامارات العربية المتحدة":"UAE",
  "egypt":"EGYPT","مصر":"EGYPT",
  "uk":"UK","united kingdom":"UK","britain":"UK","england":"UK","بريطانيا":"UK","المملكة المتحدة":"UK","انجلترا":"UK",
  "canada":"CANADA","كندا":"CANADA",
  "france":"FRANCE","فرنسا":"FRANCE",
  "germany":"GERMANY","deutschland":"GERMANY","ألمانيا":"GERMANY","المانيا":"GERMANY",
  "turkey":"TURKEY","türkiye":"TURKEY","تركيا":"TURKEY",
  "morocco":"MOROCCO","المغرب":"MOROCCO",
  "algeria":"ALGERIA","الجزائر":"ALGERIA",
  "tunisia":"TUNISIA","تونس":"TUNISIA",
  "iraq":"IRAQ","العراق":"IRAQ",
  "jordan":"JORDAN","الأردن":"JORDAN","الاردن":"JORDAN",
  "qatar":"QATAR","قطر":"QATAR",
  "kuwait":"KUWAIT","الكويت":"KUWAIT",
  "bahrain":"BAHRAIN","البحرين":"BAHRAIN",
  "oman":"OMAN","عمان":"OMAN","سلطنة عمان":"OMAN",
  "yemen":"YEMEN","اليمن":"YEMEN",
  "lebanon":"LEBANON","لبنان":"LEBANON",
  "syria":"SYRIA","سوريا":"SYRIA","سورية":"SYRIA",
  "palestine":"PALESTINE","فلسطين":"PALESTINE",
  "libya":"LIBYA","ليبيا":"LIBYA",
  "sudan":"SUDAN","السودان":"SUDAN",
  "pakistan":"PAKISTAN","باكستان":"PAKISTAN",
  "indonesia":"INDONESIA","إندونيسيا":"INDONESIA","اندونيسيا":"INDONESIA",
  "malaysia":"MALAYSIA","ماليزيا":"MALAYSIA",
  "spain":"SPAIN","إسبانيا":"SPAIN","اسبانيا":"SPAIN",
  "italy":"ITALY","إيطاليا":"ITALY","ايطاليا":"ITALY",
  "netherlands":"NETHERLANDS","holland":"NETHERLANDS","هولندا":"NETHERLANDS",
  "australia":"AUSTRALIA","أستراليا":"AUSTRALIA","استراليا":"AUSTRALIA",
};

// تطبيع النص العربي والإنجليزي للمطابقة المرنة
function normalize(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/[إأآا]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[ًٌٍَُِّْـ]/g, "")
    .replace(/\s+/g, " ");
}

// بناء فهرس مطبّع مرة واحدة
const NORMALIZED_ALIASES: Record<string, string> = {};
for (const [k, v] of Object.entries(ALIASES)) {
  NORMALIZED_ALIASES[normalize(k)] = v;
}

export function resolveCities(countryInput: string): { key: string | null; cities: string[]; rawCountry: string } {
  const raw = countryInput.trim();
  const norm = normalize(raw);

  // 1) مطابقة مباشرة
  let key = NORMALIZED_ALIASES[norm] ?? null;

  // 2) مطابقة جزئية (يحتوي على اسم معروف)
  if (!key) {
    for (const [aliasNorm, code] of Object.entries(NORMALIZED_ALIASES)) {
      if (aliasNorm.length >= 3 && (norm.includes(aliasNorm) || aliasNorm.includes(norm))) {
        key = code;
        break;
      }
    }
  }

  if (key && COUNTRY_CITIES[key]) {
    return { key, cities: COUNTRY_CITIES[key], rawCountry: raw };
  }
  // fallback: بحث وحيد بالاسم نفسه
  return { key: null, cities: [raw], rawCountry: raw };
}
