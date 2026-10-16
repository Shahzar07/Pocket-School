/**
 * ISO 3166-1 alpha-2, one list for sign-up, profiles, institutions, billing, and tax.
 * Names are not stored here. Intl.DisplayNames supplies the localised name.
 * Dial codes are the primary calling code for the phone field.
 */

export interface CountryRecord {
  code: string;
  dial: string;
}

const PACKED = "AD:376,AE:971,AF:93,AG:1268,AI:1264,AL:355,AM:374,AO:244,AQ:672,AR:54,AS:1684,AT:43,AU:61,AW:297,AX:358,AZ:994,BA:387,BB:1246,BD:880,BE:32,BF:226,BG:359,BH:973,BI:257,BJ:229,BL:590,BM:1441,BN:673,BO:591,BQ:599,BR:55,BS:1242,BT:975,BV:47,BW:267,BY:375,BZ:501,CA:1,CC:61,CD:243,CF:236,CG:242,CH:41,CI:225,CK:682,CL:56,CM:237,CN:86,CO:57,CR:506,CU:53,CV:238,CW:599,CX:61,CY:357,CZ:420,DE:49,DJ:253,DK:45,DM:1767,DO:1809,DZ:213,EC:593,EE:372,EG:20,EH:212,ER:291,ES:34,ET:251,FI:358,FJ:679,FK:500,FM:691,FO:298,FR:33,GA:241,GB:44,GD:1473,GE:995,GF:594,GG:44,GH:233,GI:350,GL:299,GM:220,GN:224,GP:590,GQ:240,GR:30,GS:500,GT:502,GU:1671,GW:245,GY:592,HK:852,HM:672,HN:504,HR:385,HT:509,HU:36,ID:62,IE:353,IL:972,IM:44,IN:91,IO:246,IQ:964,IR:98,IS:354,IT:39,JE:44,JM:1876,JO:962,JP:81,KE:254,KG:996,KH:855,KI:686,KM:269,KN:1869,KP:850,KR:82,KW:965,KY:1345,KZ:7,LA:856,LB:961,LC:1758,LI:423,LK:94,LR:231,LS:266,LT:370,LU:352,LV:371,LY:218,MA:212,MC:377,MD:373,ME:382,MF:590,MG:261,MH:692,MK:389,ML:223,MM:95,MN:976,MO:853,MP:1670,MQ:596,MR:222,MS:1664,MT:356,MU:230,MV:960,MW:265,MX:52,MY:60,MZ:258,NA:264,NC:687,NE:227,NF:672,NG:234,NI:505,NL:31,NO:47,NP:977,NR:674,NU:683,NZ:64,OM:968,PA:507,PE:51,PF:689,PG:675,PH:63,PK:92,PL:48,PM:508,PN:64,PR:1787,PS:970,PT:351,PW:680,PY:595,QA:974,RE:262,RO:40,RS:381,RU:7,RW:250,SA:966,SB:677,SC:248,SD:249,SE:46,SG:65,SH:290,SI:386,SJ:47,SK:421,SL:232,SM:378,SN:221,SO:252,SR:597,SS:211,ST:239,SV:503,SX:1721,SY:963,SZ:268,TC:1649,TD:235,TF:262,TG:228,TH:66,TJ:992,TK:690,TL:670,TM:993,TN:216,TO:676,TR:90,TT:1868,TV:688,TW:886,TZ:255,UA:380,UG:256,UM:1,US:1,UY:598,UZ:998,VA:379,VC:1784,VE:58,VG:1284,VI:1340,VN:84,VU:678,WF:681,WS:685,YE:967,YT:262,ZA:27,ZM:260,ZW:263";

export const ISO_COUNTRIES: readonly CountryRecord[] = PACKED.split(",").map((row) => {
  const [code, dial] = row.split(":");
  return { code, dial };
});

export const ISO_COUNTRY_COUNT = ISO_COUNTRIES.length;

const BY_CODE = new Map(ISO_COUNTRIES.map((row) => [row.code, row]));

const nameCache = new Map<string, Intl.DisplayNames>();

function displayNames(locale: string): Intl.DisplayNames {
  const cached = nameCache.get(locale);
  if (cached) return cached;
  let names: Intl.DisplayNames;
  try {
    names = new Intl.DisplayNames([locale, "en"], { type: "region" });
  } catch {
    names = new Intl.DisplayNames(["en"], { type: "region" });
  }
  nameCache.set(locale, names);
  return names;
}

export function isIsoCountry(code: string | null | undefined): boolean {
  return !!code && BY_CODE.has(code.trim().toUpperCase());
}

export function countryByCode(code: string | null | undefined): CountryRecord | null {
  if (!code) return null;
  return BY_CODE.get(code.trim().toUpperCase()) ?? null;
}

/** Regional-indicator flag. Empty when the code is not an ISO country. */
export function flagEmoji(code: string | null | undefined): string {
  const row = countryByCode(code);
  if (!row) return "";
  return String.fromCodePoint(...row.code.split("").map((char) => 127397 + char.charCodeAt(0)));
}

export function countryName(code: string | null | undefined, locale = "en"): string {
  const row = countryByCode(code);
  if (!row) return "";
  return displayNames(locale).of(row.code) || row.code;
}

export function dialCode(code: string | null | undefined): string {
  return countryByCode(code)?.dial ?? "";
}

/** Match a stored code or an older English country name. */
export function resolveCountryCode(value: string | null | undefined): string {
  const raw = (value ?? "").trim();
  if (!raw) return "";
  const direct = countryByCode(raw);
  if (direct) return direct.code;
  const needle = raw.toLowerCase();
  const english = displayNames("en");
  for (const row of ISO_COUNTRIES) {
    if ((english.of(row.code) || "").toLowerCase() === needle) return row.code;
  }
  return "";
}

export function parseGeoCountry(cookie: string | null | undefined): string {
  if (!cookie) return "";
  const match = cookie.match(/(?:^|; )poket-geo-country=([^;]*)/);
  if (!match?.[1]) return "";
  try {
    return countryByCode(decodeURIComponent(match[1]))?.code ?? "";
  } catch {
    return "";
  }
}

export function readGeoCountry(): string {
  if (typeof document === "undefined") return "";
  return parseGeoCountry(document.cookie);
}

export interface CountryOption {
  code: string;
  dial: string;
  name: string;
  flag: string;
}

export function countryOptions(locale = "en"): CountryOption[] {
  return ISO_COUNTRIES.map((row) => ({
    code: row.code,
    dial: row.dial,
    name: countryName(row.code, locale),
    flag: flagEmoji(row.code),
  })).sort((a, b) => a.name.localeCompare(b.name, locale));
}

export function searchCountries(query: string, locale = "en"): CountryOption[] {
  const needle = query.trim().toLowerCase().replace(/^\+/, "");
  const options = countryOptions(locale);
  if (!needle) return options;
  return options.filter((option) => (
    option.code.toLowerCase().includes(needle)
    || option.name.toLowerCase().includes(needle)
    || option.dial.startsWith(needle)
    || countryName(option.code, "en").toLowerCase().includes(needle)
  ));
}

/** Join a calling code and a national number into E.164, or return "" when empty. */
export function toE164(country: string, national: string): string {
  const digits = national.replace(/[^\d]/g, "").replace(/^0+/, "");
  if (!digits) return "";
  const dial = dialCode(country);
  if (!dial) return `+${digits}`;
  return `+${dial}${digits}`;
}

export function splitE164(value: string, country: string): string {
  const dial = dialCode(country);
  const compact = value.replace(/\s/g, "");
  if (dial && compact.startsWith(`+${dial}`)) return compact.slice(dial.length + 1);
  if (compact.startsWith("+")) return compact.slice(1);
  return value;
}
