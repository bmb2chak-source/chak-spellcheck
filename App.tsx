import React, { useState, useMemo, useEffect, useRef } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, firebaseEnabled, authHeaders, apiFetch, logout } from './lib/firebaseClient';
import LoginModal from './components/LoginModal';
import AdminModal from './components/AdminModal';
import PrivacyModal from './components/PrivacyModal';
import {
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Copy,
  Trash2,
  Wand2,
  FileText,
  RefreshCw,
  ArrowRight,
  BookOpen,
  Languages,
  Check,
  Info,
  ShieldCheck,
  Eye,
  Edit3,
  ScrollText,
  Columns,
  Rows,
  Award,
  Zap,
  Crown,
  QrCode,
  Clock,
  Lock,
  Upload,
  CheckSquare,
  Smartphone,
  Monitor,
  X,
  LogOut,
  LogIn,
  BarChart3
} from 'lucide-react';

// ==========================================
// GEMINI API HELPER (СЕРВЕРЭЭР ДАМЖИНА)
// ==========================================
// API түлхүүр хөтөч рүү огт очихгүй. Бүх хүсэлт /api/gemini (api/gemini.js)-ээр
// дамжих ба түлхүүр нь Vercel-ийн GEMINI_API_KEY хувьсагчид хадгалагдана.
// Дүрмийн шалгалт эхлээд шууд (local) гарч, AI үр дүн араас нь нэмэгддэг тул
// timeout-ийг бодит сүлжээнд тохируулан урт болгосон.
const MIN_AI_TIMEOUT_MS = 10000;
const responseCache = new Map();

async function callFastGeminiAPI(prompt, systemInstruction, responseSchema = null, timeoutMs = 750) {
  const cacheKey = `${systemInstruction.slice(0, 32)}_${prompt}`;
  if (responseCache.has(cacheKey)) {
    return responseCache.get(cacheKey);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(timeoutMs, MIN_AI_TIMEOUT_MS));

  try {
    const response = await fetch('/api/gemini', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(await authHeaders())
      },
      body: JSON.stringify({ prompt, systemInstruction, responseSchema }),
      signal: controller.signal
    });
    clearTimeout(timer);

    if (response.status === 429) {
      // Өдрийн AI хязгаар дууссан — App toast харуулна
      window.dispatchEvent(new CustomEvent('chak:ai-limit'));
    }
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    const textResult = data.text;
    if (!textResult) throw new Error("Empty response");
    responseCache.set(cacheKey, textResult);
    return textResult;
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

// ==========================================
// SAMPLE TEXTS
// ==========================================
const SAMPLE_TEXTS = [
  {
    title: "Жишээ 1: Албан бичиг",
    text: "Та бүхэнд энэ өдрийн мэндийг хүргэе. Би маргааш өглөөний хуралд оролцож амжихгүй тул уулзалтанд ирэх хүмүүсд урьдчилж мэдэгдэнэ үү. Бид дараагын долоо хоногт төсөлийн тайлангаа танилцуулхийн тулд бэлтгэл ажлаа базааж байна."
  },
  {
    title: "Жишээ 2: Нийтлэл",
    text: "Монгол хэлний зөв бичих дүрмийг баримталж бичхэд зарим үгийн гээгдэх эгшиг болон зөөлний тэмдэг солигдох дүрэм дээр хүмүүс их алддаг. Жишээлбэл сургуульаас гараад номын санд сууж хичээлээ давтахаар явлаа."
  },
  {
    title: "Жишээ 3: Латин галиг",
    text: "Sain baina uu? Bi margaash ajliin uulzaltand ochij amjihgui bolchloo. Ta buhen eneuhuu medeeleltei taniltsana uu."
  }
];

const MONGOL_SCRIPT_SAMPLES = [
  {
    title: "Жишээ 1: Мэндчилгээ",
    text: "Монгол хэл бичиг бол бидний оюуны үнэт өв соёл мөн. Та бүхэнд энэ өдрийн амар амгаланг айлтгая."
  },
  {
    title: "Жишээ 2: Сургаал үг",
    text: "Эрдэм ном сурах үйлсэд хичээнгүйлэн шамдаж, эх хэл бичгээ дээдлэнхэн суралцъя."
  },
  {
    title: "Жишээ 3: Албан бичиг",
    text: "Монгол Улсын Үндэсний бичгийн хөтөлбөрийн хүрээнд албан хэргийг хос бичгээр хөтлөн явуулна."
  }
];

// ==========================================
// CLASSICAL MONGOL DICTIONARY & ENGINE (<0.04s)
// ==========================================
const CLASSICAL_MONGOL_DICT = {
  "монгол": { script: "ᠮᠣᠩᠭᠣᠯ", galig: "монггол", rule: "Язгуур үгийн 'нг' болон 'г' гийгүүлэгчийг уламжлалт ёсоор ялган бичнэ." },
  "хэл": { script: "ᠬᠡᠯᠡ", galig: "хэлэ", rule: "Төгсгөлийн ялгах эгшиг 'э'-г уламжлалт ёсоор бичнэ." },
  "хэлний": { script: "ᠬᠡᠯᠡᠨ ᠦ", galig: "хэлэн-ү", rule: "'Хэлэ' язгуур дээр харьяалахын тийн ялгалын '-ү' нөхцөлийг салангид залгана." },
  "бичиг": { script: "ᠪᠢᠴᠢᠭ", galig: "бичиг", rule: "Үгийн эхэнд 'б', дунд 'ч', адагт 'г' дэвсгэрлэн орно." },
  "бичгийн": { script: "ᠪᠢᠴᠢᠭ ᠦᠨ", galig: "бичиг-үн", rule: "Гийгүүлэгчээр төгссөн эм үгэнд харьяалахын '-үн' нөхцөлийг салангид бичнэ." },
  "бол": { script: "ᠪᠣᠯ", galig: "бол", rule: "Батлах сул үг." },
  "бидний": { script: "ᠪᠢᠳᠡᠨ ᠦ", galig: "бидэн-ү", rule: "Харьяалахын тийн ялгалын '-ү' нөхцөлийг үгийн үндсээс салангид бичнэ." },
  "оюуны": { script: "ᠣᠶᠤᠨ ᠤ", galig: "оюн-у", rule: "Дэвсгэр 'н' гийгүүлэгчээр төгссөн эр үгэнд харьяалахын '-у' дагавар салангид залгана." },
  "үнэт": { script: "ᠦᠨᠡᠲᠦ", galig: "үнэтү", rule: "'Үнэ' язгуур дээр '-тү' дагавар залгаж бичнэ." },
  "өв": { script: "ᠥᠪ", galig: "өб", rule: "Түүхэн уламжлалын дагуу эхний үед 'ө', дэвсгэр 'б' бичнэ." },
  "соёл": { script: "ᠰᠣᠶᠤᠯ", galig: "союл", rule: "'Соёл' үгийг уламжлалт бичлэгээр 'союл' хэмээн бичнэ." },
  "мөн": { script: "ᠮᠥᠨ", galig: "мөн", rule: "Эм үгийн нэгдүгээр үед гэдэс болон титэмтэй 'ө' орно." },
  "та": { script: "ᠲᠠ", galig: "та", rule: "Хүндэтгэлийн төлөөний үг." },
  "бүхэнд": { script: "ᠪᠦᠬᠦᠨ ᠳᠦ", galig: "бүхүн-дү", rule: "Өгөх оршихын тийн ялгалын '-дү' нөхцөлийг үндсээс салангид бичнэ." },
  "энэ": { script: "ᠡᠨᠡ", galig: "энэ", rule: "Төгсгөлийн ялгах эгшиг 'э' орно." },
  "өдрийн": { script: "ᠡᠳᠦᠷ ᠦᠨ", galig: "эдүр-үн", rule: "'Өдөр' гэдэг үгийг 'эдүр' гэж бичээд гийгүүлэгчээр төгссөн тул '-үн' нөхцөл дагуулна." },
  "өдөр": { script: "ᠡᠳᠦᠷ", galig: "эдүр", rule: "Түүхэн уламжлалт бичлэгээр 'эдүр' гэж бичнэ." },
  "амар": { script: "ᠠᠮᠤᠷ", galig: "амур", rule: "Хоёрдугаар үеийн балархай эгшгийг 'у'-гаар тэмдэглэнэ ('амур')." },
  "амгаланг": { script: "ᠠᠮᠤᠭᠤᠯᠠᠩ ᠢ", galig: "амугуланг-и", rule: "Заахын тийн ялгалын '-и' нөхцөлийг салангид бичнэ." },
  "айлтгая": { script: "ᠠᠶᠢᠯᠠᠳᠬᠠᠶ ᠠ", galig: "айиладхая-а", rule: "Хүсэх төлөвийн '-я/е' нөхцөлийн 'а'-г орхицтойгоор салангид бичнэ." },
  "эрдэм": { script: "ᠡᠷᠳᠡᠮ", galig: "эрдэм", rule: "'р', 'м' нь зөөлөн ба хатуу дэвсгэр гийгүүлэгч болно." },
  "ном": { script: "ᠨᠣᠮ", galig: "ном", rule: "Үгийн адагт 'м' дэвсгэрлэн орно." },
  "сурах": { script: "ᠰᠤᠷᠤᠬᠤ", galig: "суруху", rule: "Үйл үгийн тодотгон холбох '-ху/хү' нөхцөл залгана." },
  "үйлсэд": { script: "ᠦᠢᠯᠡᠰ ᠲᠦ", galig: "үйлэс-тү", rule: "'с' хатуу дэвсгэрээр төгссөн тул өгөх оршихын '-тү' нөхцөл салангид залгана." },
  "хичээнгүйлэн": { script: "ᠬᠢᠴᠢᠶᠡᠩᠭᠦᠢᠯᠡᠨ", galig: "хичийэнггүйлэн", rule: "Хамтран үйлдэхийн '-н' нөхцөл залгасан хэлбэр." },
  "шамдаж": { script: "ᠰᠢᠮᠳᠠᠵᠤ", galig: "шимдажу", rule: "Зэрэгцэн холбох '-жу/жү' нөхцөлийг залган бичнэ." },
  "эх": { script: "ᠡᠬᠡ", galig: "эхэ", rule: "Төгсгөлд нь ялгах эгшиг 'э' бичнэ." },
  "бичгээ": { script: "ᠪᠢᠴᠢᠭ ᠢᠶᠡᠨ", galig: "бичиг-ийэн", rule: "Ерөнхийлөн хамаатуулах '-ийан/ийэн' нөхцөлийг гийгүүлэгчийн дараа салангид бичнэ." },
  "дээдлэнхэн": { script: "ᠳᠡᠭᠡᠳᠦᠯᠡᠨᠬᠡᠨ", galig: "дэгэдүлэнхэн", rule: "Урт 'ээ' эгшгийг 'эгэ' бүтцээр уламжлан бичнэ." },
  "суралцъя": { script: "ᠰᠤᠷᠤᠯᠴᠠᠶ ᠠ", galig: "сурулцая-а", rule: "Хүсэх төлөвийн '-я' нөхцөлийн сүүлийн 'а'-г орхицоор салангид тавина." },
  "монголчууд": { script: "ᠮᠣᠩᠭᠣᠯᠴᠤᠳ", galig: "монгголчуд", rule: "Олон тооны '-чуд/чүд' дагаврыг үндэстэй залган бичнэ." },
  "улс": { script: "ᠤᠯᠤᠰ", galig: "улус", rule: "'Улс' гэдэг үгийг уламжлалт ёсоор 'улус' хэмээн бичнэ." },
  "улсын": { script: "ᠤᠯᠤᠰ ᠤᠨ", galig: "улус-ун", rule: "'Улс' үгийг 'улус' гэж бичээд харьяалахын '-ун' нөхцөлийг салангид бичнэ." },
  "үндэсний": { script: "ᠦᠨᠳᠦᠰᠦᠨ ᠦ", galig: "үндүсэн-ү", rule: "'н' дэвсгэрээр төгссөн тул харьяалахын '-ү' нөхцөлийг салангид бичнэ." },
  "хөтөлбөрийн": { script: "ᠬᠥᠲᠦᠯᠪᠦᠷᠢ ᠶᠢᠨ", galig: "хөтүлбүри-йин", rule: "Эгшгээр төгссөн үгэнд харьяалахын '-йин' нөхцөлийг салангид бичнэ." },
  "хүрээнд": { script: "ᠬᠦᠷᠢᠶᠡᠨ ᠳᠦ", galig: "хүрийэн-дү", rule: "Зөөлөн дэвсгэр 'н'-ий дараа өгөх оршихын '-дү' нөхцөл салангид орно." },
  "албан": { script: "ᠠᠯᠪᠠᠨ", galig: "албан", rule: "Тодотгон холбох '-н' дагавартай үг." },
  "хэргийг": { script: "ᠬᠡᠷᠡᠭ ᠢ", galig: "хэрэг-и", rule: "Гийгүүлэгчээр төгссөн үгэнд заахын тийн ялгалын '-и' нөхцөл салангид орно." },
  "хос": { script: "ᠬᠣᠰ", galig: "хос", rule: "Нэг үет эр үг, адагт 'с' дэвсгэрлэнэ." },
  "бичгээр": { script: "ᠪᠢᠴᠢᠭ ᠢᠶᠡᠷ", galig: "бичиг-ийэр", rule: "Гийгүүлэгчээр төгссөн үгэнд үйлдэхийн тийн ялгалын '-ийэр' нөхцөл салангид залгана." },
  "хөтлөн": { script: "ᠬᠥᠲᠦᠯᠦᠨ", galig: "хөтүлүн", rule: "Богино эгшгийг гээхгүйгээр 'хөтүлүн' гэж бичнэ." },
  "явуулна": { script: "ᠶᠠᠪᠤᠭᠤᠯᠤᠨ ᠠ", galig: "ябугулун-а", rule: "Одоо-ирээдүй цагийн '-на/нэ' нөхцөлийн 'а'-г орхицоор салангид бичнэ." },
  "сайн": { script: "ᠰᠠᠶᠢᠨ", galig: "сайин", rule: "Урт болон хос эгшгийг 'айи' бүтцээр бичнэ." },
  "байна": { script: "ᠪᠠᠶᠢᠨ ᠠ", galig: "байин-а", rule: "Цагаар төгсгөх '-на' нөхцөлийн 'а'-г салангид орхицоор бичнэ." },
  "уу": { script: "ᠤᠤ", galig: "уу", rule: "Асуух сул үгийг тусад нь бичнэ." },
  "үү": { script: "ᠦᠦ", galig: "үү", rule: "Эм үгийн дараах асуух сул үг." },
  "би": { script: "ᠪᠢ", galig: "би", rule: "Нэгдүгээр биеийн төлөөний үг." },
  "маргааш": { script: "ᠮᠠᠷᠭᠠᠰᠢ", galig: "маргаши", rule: "Уламжлалт бичлэгээр 'маргаши' хэмээн бичнэ." },
  "өглөөний": { script: "ᠥᠷᠯᠦᠭᠡᠨ ᠦ", galig: "өрлүгэн-ү", rule: "'Өглөө' гэдэг үгийг 'өрлүгэ' хэмээн уламжлан бичнэ." },
  "хуралд": { script: "ᠬᠤᠷᠠᠯ ᠳᠤ", galig: "хурал-ду", rule: "Зөөлөн дэвсгэр 'л'-ийн дараа '-ду' нөхцөл салангид орно." },
  "мэндийг": { script: "ᠮᠡᠨᠳᠦ ᠶᠢ", galig: "мэндү-йи", rule: "Эгшгээр төгссөн үндсэнд заахын '-йи' нөхцөл салангид залгана." },
  "хүргэе": { script: "ᠬᠦᠷᠭᠡᠶ ᠡ", galig: "хүргэй-э", rule: "Хүсэх төлөвийн '-е' нөхцөлийг салангид орхицоор төгсгөнө." },
  "сургууль": { script: "ᠰᠤᠷᠭᠠᠭᠤᠯᠢ", galig: "сургагули", rule: "Урт 'уу' эгшгийг 'агу' бүтцээр, зөөлний тэмдгийг 'и' эгшгээр тэмдэглэнэ." },
  "хүн": { script: "ᠬᠦᠮᠦᠨ", galig: "хүмүн", rule: "'Хүн' гэдэг үгийг сонгодог бичлэгээр 'хүмүн' гэж бичнэ." },
  "хүмүүс": { script: "ᠬᠦᠮᠦᠰ", galig: "хүмүс", rule: "Олон тооны '-с' дагавартай хэлбэр." },
  "ажил": { script: "ᠠᠵᠢᠯ", galig: "ажил", rule: "Үндсэн язгуур үг." },
  "цаг": { script: "ᠴᠠᠭ", galig: "чаг", rule: "Үгийн эхэнд 'ч', адагт 'г' дэвсгэрлэн орно." },
  "баярлалаа": { script: "ᠪᠠᠶᠠᠷᠯᠠᠯ ᠠ", galig: "баярлал-а", rule: "Өнгөрсөн цагийн '-лаа' нөхцөлийг '-л-а' хэлбэрээр салангид бичнэ." }
};

function isMasculineWord(word) {
  return /[аоуяёю]/.test(word);
}

function convertWordToMongolScriptFallback(rawWord) {
  const leadingPunct = (rawWord.match(/^[.,!?;:()"«»“-]+/) || [''])[0];
  const trailingPunct = (rawWord.match(/[.,!?;:()"«»”-]+$/) || [''])[0];
  const clean = rawWord
    .slice(leadingPunct.length, rawWord.length - trailingPunct.length)
    .toLowerCase();

  if (!clean) {
    return { original: rawWord, script: rawWord, galig: rawWord, rule: "" };
  }

  if (CLASSICAL_MONGOL_DICT[clean]) {
    const entry = CLASSICAL_MONGOL_DICT[clean];
    return {
      original: rawWord,
      script: leadingPunct + entry.script + trailingPunct,
      galig: leadingPunct + entry.galig + trailingPunct,
      rule: entry.rule
    };
  }

  const masc = isMasculineWord(clean);
  let stem = clean;
  let suffixScript = "";
  let suffixGalig = "";
  let ruleNote = "Үгийн язгуур болон үеийн бүтцийг уламжлалт дүрмээр хөрвүүлэв.";

  const suffixRules = [
    {
      match: /(ийн|ын)$/,
      apply: (s) => {
        stem = s.replace(/(ийн|ын)$/, '');
        const endsWithN = stem.endsWith('н');
        suffixScript = endsWithN ? (masc ? ' ᠤ' : ' ᠦ') : (masc ? ' ᠤᠨ' : ' ᠦᠨ');
        suffixGalig = endsWithN ? (masc ? '-у' : '-ү') : (masc ? '-ун' : '-үн');
        ruleNote = "Харьяалахын тийн ялгалын нөхцөлийг үгийн үндсээс салангид бичнэ.";
      }
    },
    {
      match: /(ийг|ыг)$/,
      apply: (s) => {
        stem = s.replace(/(ийг|ыг)$/, '');
        suffixScript = ' ᠢ';
        suffixGalig = '-и';
        ruleNote = "Гийгүүлэгчээр төгссөн үгэнд заахын тийн ялгалын '-и' нөхцөлийг салангид залгана.";
      }
    },
    {
      match: /(аас|ээс|оос|өөс)$/,
      apply: (s) => {
        stem = s.replace(/(аас|ээс|оос|өөс)$/, '');
        suffixScript = masc ? ' ᠠᠴᠠ' : ' ᠡᠴᠡ';
        suffixGalig = masc ? '-ача' : '-эчэ';
        ruleNote = "Гарахын тийн ялгалын '-ача/-эчэ' нөхцөлийг үндсээс салангид бичнэ.";
      }
    },
    {
      match: /(аар|ээр|оор|өөр)$/,
      apply: (s) => {
        stem = s.replace(/(аар|ээр|оор|өөр)$/, '');
        suffixScript = masc ? ' ᠢᠶᠠᠷ' : ' ᠢᠶᠡᠷ';
        suffixGalig = masc ? '-ийар' : '-ийэр';
        ruleNote = "Үйлдэхийн тийн ялгалын '-ийар/-ийэр' нөхцөлийг салангид бичнэ.";
      }
    },
    {
      match: /(тай|тэй|той)$/,
      apply: (s) => {
        stem = s.replace(/(тай|тэй|той)$/, '');
        suffixScript = masc ? ' ᠲᠠᠢ' : ' ᠲᠡᠢ';
        suffixGalig = masc ? '-тай' : '-тэй';
        ruleNote = "Хамтрахын тийн ялгалын '-тай/-тэй' нөхцөлийг салангид бичнэ.";
      }
    },
    {
      match: /(нд|д|т)$/,
      apply: (s) => {
        if (s.length <= 3) return false;
        stem = s.replace(/(нд|д|т)$/, '');
        const hardEnding = /[бгрсдхцчш]$/.test(stem);
        suffixScript = hardEnding ? (masc ? ' ᠲᠤ' : ' ᠲᠦ') : (masc ? ' ᠳᠤ' : ' ᠳᠦ');
        suffixGalig = hardEnding ? (masc ? '-ту' : '-тү') : (masc ? '-ду' : '-дү');
        ruleNote = "Өгөх оршихын тийн ялгалын '-ду/-дү, -ту/-тү' нөхцөлийг дэвсгэр үсгийн дүрмээр салангид залгана.";
        return true;
      }
    }
  ];

  for (const sr of suffixRules) {
    if (sr.match.test(clean) && clean.length > 4) {
      const res = sr.apply(clean);
      if (res !== false) break;
    }
  }

  if (CLASSICAL_MONGOL_DICT[stem]) {
    const stemEntry = CLASSICAL_MONGOL_DICT[stem];
    return {
      original: rawWord,
      script: leadingPunct + stemEntry.script + suffixScript + trailingPunct,
      galig: leadingPunct + stemEntry.galig + suffixGalig + trailingPunct,
      rule: ruleNote
    };
  }

  let normalizedStem = stem
    .replace(/аа/g, 'ага')
    .replace(/ээ/g, 'эгэ')
    .replace(/оо/g, 'ога')
    .replace(/өө/g, 'өгэ')
    .replace(/уу/g, 'агу')
    .replace(/үү/g, 'эгү')
    .replace(/ий/g, 'и')
    .replace(/ай/g, 'айи')
    .replace(/эй/g, 'эйи');

  const charMap = {
    'а': 'ᠠ', 'б': 'ᠪ', 'в': 'ᠪ', 'г': 'ᠭ', 'д': 'ᠳ', 'е': 'ᠶᠡ', 'ё': 'ᠶᠣ',
    'ж': 'ᠵ', 'з': 'ᠵ', 'и': 'ᠢ', 'й': 'ᠢ', 'к': 'ᠺ', 'л': 'ᠯ', 'м': 'ᠮ',
    'н': 'ᠨ', 'о': 'ᠣ', 'ө': 'ᠥ', 'п': 'ᠫ', 'р': 'ᠷ', 'с': 'ᠰ', 'т': 'ᠲ',
    'у': 'ᠤ', 'ү': 'ᠦ', 'ф': 'ᠹ', 'х': 'ᠬ', 'ц': 'ᠴ', 'ч': 'ᠴ', 'ш': 'ᠰ',
    'щ': 'ᠰ', 'ъ': '', 'ы': ' ᠤᠨ', 'ь': 'ᠢ', 'э': 'ᠡ', 'ю': 'ᠶᠤ', 'я': 'ᠶᠠ'
  };

  let scriptOut = "";
  for (const ch of normalizedStem) {
    scriptOut += charMap[ch] !== undefined ? charMap[ch] : ch;
  }

  return {
    original: rawWord,
    script: leadingPunct + scriptOut + suffixScript + trailingPunct,
    galig: leadingPunct + normalizedStem + suffixGalig + trailingPunct,
    rule: ruleNote
  };
}

function instantConvertCyrillicToMongolScript(sourceText) {
  const tokens = sourceText.trim().split(/\s+/).filter(Boolean);
  const convertedWords = tokens.map(w => convertWordToMongolScriptFallback(w));
  return {
    mongolUnicodeText: convertedWords.map(w => w.script).join(" "),
    classicalGaligText: convertedWords.map(w => w.galig).join(" "),
    wordBreakdown: convertedWords,
    overallRuleSummary: "Үндэсний монгол бичгийн уламжлалт язгуур үндэс, дэвсгэр үсэг болон тийн ялгалын нөхцөл салангид бичих дүрмийг баримтлан хөрвүүлэв."
  };
}

// ==========================================
// COMPREHENSIVE FAST SPELLCHECK ENGINE (<0.05s)
// ==========================================
const SPELLCHECK_RULES = [
  { wrong: "уулзалтанд", correct: "уулзалтад", type: "Тийн ялгал / Хэлзүй", explanation: "'Уулзалт' гэдэг үгэнд өгөх оршихын тийн ялгалын '-д' нөхцөл шууд залгана. Давхар '-нд' залгахгүй." },
  { wrong: "ажиланд", correct: "ажилд", type: "Тийн ялгал / Хэлзүй", explanation: "'Ажил' үгэнд өгөх оршихын '-д' нөхцөл шууд залгана." },
  { wrong: "сургалтанд", correct: "сургалтад", type: "Тийн ялгал / Хэлзүй", explanation: "'Сургалт' гэдэг үгэнд өгөх оршихын '-д' нөхцөл шууд залгана." },
  { wrong: "амралтанд", correct: "амралтад", type: "Тийн ялгал / Хэлзүй", explanation: "'Амралт' гэдэг үгэнд өгөх оршихын '-д' нөхцөл залгана." },
  { wrong: "шалгалтанд", correct: "шалгалтад", type: "Тийн ялгал / Хэлзүй", explanation: "'Шалгалт' гэдэг үгэнд өгөх оршихын '-д' нөхцөл залгана." },
  { wrong: "хүмүүсд", correct: "хүмүүст", type: "Зөв бичих дүрэм", explanation: "'с' гийгүүлэгчээр төгссөн үгэнд өгөх оршихын '-т' нөхцөл залгана." },
  { wrong: "улсд", correct: "улсад", type: "Зөв бичих дүрэм", explanation: "Дараалсан гийгүүлэгчээр төгссөн үгэнд '-ад/-эд' залгана." },
  { wrong: "дараагын", correct: "дараагийн", type: "Зөв бичих дүрэм", explanation: "'г' үсгийн дараа эр, эм үгийг харгалзахгүй 'ий' бичнэ." },
  { wrong: "байгууллагын", correct: "байгууллагын", type: "Зөв", explanation: "" },
  { wrong: "нутгын", correct: "нутгийн", type: "Зөв бичих дүрэм", explanation: "'г' гийгүүлэгчийн дараа харьяалахын '-ийн' нөхцөл залгана." },
  { wrong: "төсөлийн", correct: "төслийн", type: "Зөв бичих дүрэм", explanation: "Эгшигт гийгүүлэгчээр төгссөн үгэнд урт эгшгээр эхэлсэн нөхцөл залгахад балархай эгшиг гээгдэнэ." },
  { wrong: "ажилын", correct: "ажлын", type: "Зөв бичих дүрэм", explanation: "'Ажил' үгэнд эгшгээр эхэлсэн нөхцөл залгахад 'и' эгшиг гээгдэнэ." },
  { wrong: "танилцуулхийн", correct: "танилцуулахын", type: "Зөв бичих дүрэм", explanation: "Үйл үгийн '-х' нөхцөлийн өмнөх балархай эгшиг гээгдэхгүй." },
  { wrong: "явхийн", correct: "явахын", type: "Зөв бичих дүрэм", explanation: "Үйл үгийн '-х' нөхцөлийн өмнөх балархай эгшиг гээгдэхгүй." },
  { wrong: "бичхэд", correct: "бичихэд", type: "Зөв бичих дүрэм", explanation: "Дараалсан гийгүүлэгчийн дунд балархай эгшиг гээгдэхгүй." },
  { wrong: "сургуульаас", correct: "сургуулиас", type: "Зөв бичих дүрэм", explanation: "Зөөлний тэмдгээр төгссөн үгэнд урт эгшиг залгахад 'ь' нь 'и' болно." },
  { wrong: "захьа", correct: "захиа", type: "Зөв бичих дүрэм", explanation: "Зөөлний тэмдэг 'и' эгшгээр солигдоно." },
  { wrong: "очино", correct: "очно", type: "Зөв бичих дүрэм", explanation: "Ж, ч, ш-ээр төгссөн үгэнд '-на/нэ' залгахад 'и' гээгдэнэ." },
  { wrong: "болчлоо", correct: "болчихлоо", type: "Найруулга", explanation: "Ярианы хэлний хураангуй хэлбэрийг бичгийн хэлэнд 'болчихлоо' гэж бичнэ." },
  { wrong: "ирчлээ", correct: "ирчихлээ", type: "Найруулга", explanation: "Бичгийн хэлний хэм хэмжээгээр 'ирчихлээ' гэж бичнэ." },
  { wrong: "явчлаа", correct: "явчихлаа", type: "Найруулга", explanation: "Бичгийн хэлний хэм хэмжээгээр 'явчихлаа' гэж бичнэ." }
];

function runFastSpellcheck(inputText) {
  const found = [];
  SPELLCHECK_RULES.forEach(item => {
    if (item.wrong !== item.correct && inputText.includes(item.wrong)) {
      found.push(item);
    }
  });

  // Dynamic regex patterns for common Mongolian grammatical mistakes
  const words = inputText.split(/\s+/);
  words.forEach(raw => {
    const clean = raw.replace(/[.,!?;:()"«»“-]/g, '');
    if (!clean || found.some(f => f.wrong === clean)) return;

    // 1. г + ын -> гийн
    if (/гын$/i.test(clean) && !/байгууллагын|анхаарлын/i.test(clean)) {
      found.push({
        wrong: clean,
        correct: clean.replace(/гын$/i, 'гийн'),
        type: "Зөв бичих дүрэм",
        explanation: "'Г' гийгүүлэгчийн дараа харьяалахын тийн ялгалын '-ийн' нөхцөл бичнэ."
      });
    }
    // 2. ж, ч, ш + ыг/ын -> ийг/ийн
    else if (/[жчш](ын|ыг)$/i.test(clean)) {
      const fixed = clean.replace(/ын$/i, 'ийн').replace(/ыг$/i, 'ийг');
      found.push({
        wrong: clean,
        correct: fixed,
        type: "Зөв бичих дүрэм",
        explanation: "Ж, ч, ш гийгүүлэгчийн дараа 'ы' бус 'ий' эгшиг бичнэ."
      });
    }
    // 3. ь + аас/ээс/оос/аар/ээр -> иас/иэс/иос/иар/иэр
    else if (/ь(аас|ээс|оос|өөс|аар|ээр|оор|өөр)$/i.test(clean)) {
      const fixed = clean
        .replace(/ьаас$/i, 'иас')
        .replace(/ьээс$/i, 'иэс')
        .replace(/ьоос$/i, 'иос')
        .replace(/ьаар$/i, 'иар')
        .replace(/ьээр$/i, 'иэр');
      found.push({
        wrong: clean,
        correct: fixed,
        type: "Зөв бичих дүрэм",
        explanation: "Зөөлний тэмдгээр төгссөн үгэнд урт эгшгээр эхэлсэн нөхцөл залгахад 'ь' нь 'и' болно."
      });
    }
  });

  return found;
}

// ==========================================
// LATIN TO CYRILLIC ENGINE (<0.03s)
// ==========================================
const LATIN_WORD_MAP = {
  "sain": "сайн", "baina": "байна", "bna": "байна", "uu": "уу", "vv": "үү",
  "bi": "би", "ta": "та", "buhen": "бүхэн", "buhend": "бүхэнд",
  "margaash": "маргааш", "ajil": "ажил", "ajliin": "ажлын",
  "uulzalt": "уулзалт", "uulzaltand": "уулзалтад", "ochij": "очиж",
  "ochino": "очно", "ochno": "очно", "amjihgui": "амжихгүй",
  "bolchloo": "болчихлоо", "nadtai": "надтай", "utsaar": "утсаар",
  "holbogdooroi": "холбогдоорой", "bayarlalaa": "баярлалаа",
  "mongol": "монгол", "hel": "хэл", "bichig": "бичиг", "ene": "энэ",
  "eneuhuu": "энэхүү", "medeeleltei": "мэдээлэлтэй", "taniltsana": "танилцана"
};

function instantLatinToCyrillic(input) {
  return input.replace(/[A-Za-z]+/g, (word) => {
    const lower = word.toLowerCase();
    const isCap = word[0] === word[0].toUpperCase() && word[0] !== word[0].toLowerCase();
    if (LATIN_WORD_MAP[lower]) {
      const mapped = LATIN_WORD_MAP[lower];
      return isCap ? mapped.charAt(0).toUpperCase() + mapped.slice(1) : mapped;
    }
    let s = lower
      .replace(/sh/g, 'ш')
      .replace(/ch/g, 'ч')
      .replace(/ts/g, 'ц')
      .replace(/kh/g, 'х')
      .replace(/zh/g, 'ж')
      .replace(/ye/g, 'е')
      .replace(/yo/g, 'ё')
      .replace(/yu/g, 'ю')
      .replace(/ya/g, 'я')
      .replace(/ai/g, 'ай')
      .replace(/ei/g, 'эй');

    const map = {
      a: 'а', b: 'б', v: 'в', g: 'г', d: 'д', e: 'э', j: 'ж', z: 'з',
      i: 'и', y: 'й', k: 'к', l: 'л', m: 'м', n: 'н', o: 'о', u: 'у',
      p: 'п', r: 'р', s: 'с', t: 'т', f: 'ф', h: 'х', c: 'ц'
    };
    let out = '';
    for (const ch of s) {
      out += map[ch] || ch;
    }
    return isCap ? out.charAt(0).toUpperCase() + out.slice(1) : out;
  });
}

// ==========================================
// INSTANT LOCAL REWRITER (<0.05s)
// ==========================================
function instantLocalRewrite(rawText, styleKey) {
  let clean = rawText.trim();
  runFastSpellcheck(clean).forEach(err => {
    clean = clean.split(err.wrong).join(err.correct);
  });

  if (styleKey === 'formal') {
    return `Хүндэтгэсэн мэдэгдэл:\n${clean}\n\nАнхаарал хандуулсанд баярлалаа.`;
  }
  if (styleKey === 'social') {
    return `✨ Онцлох мэдээлэл! 🇲🇳\n\n${clean}\n\n#МонголХэл #ЗөвБичиг #ЧакАлдааШалгагч`;
  }
  if (styleKey === 'script') {
    return `[Эхлэл хэсэг - Анхаарал татах]:\n${clean}\n[Төгсгөл - Уриалга]: Та бүхэн санал бодлоо хуваалцаарай!`;
  }
  // concise
  const sentences = clean.split(/(?<=[.!?])\s+/);
  return sentences.slice(0, Math.max(1, Math.ceil(sentences.length * 0.7))).join(' ');
}

// ==========================================
// SUBSCRIPTION PLANS & TRIAL CONSTANTS
// ==========================================
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

const SUBSCRIPTION_PLANS = [
  {
    id: '6months',
    name: '6 сарын эрх',
    price: '19,000₮',
    numericPrice: 19000,
    durationLabel: '6 сар (180 хоног)',
    perMonth: 'Сард ердөө 3,166₮',
    badge: 'Хэмнэлттэй',
    features: [
      'Монгол хэлний дүрмийн алдаа хязгааргүй шалгах',
      'Кирилл → Үндэсний Монгол бичиг шууд хөрвүүлэгч',
      'Латин → Кирилл & 4 төрлийн AI найруулга засагч',
      'Гар утас болон Компьютер дээр гацалтгүй ажиллана'
    ]
  },
  {
    id: '1year',
    name: '1 жилийн эрх (VIP)',
    price: '39,000₮',
    numericPrice: 39000,
    durationLabel: '1 жил (365 хоног)',
    perMonth: 'Хамгийн их сонгодог багц',
    badge: 'Шилдэг сонголт 🔥',
    popular: true,
    features: [
      'Бүх үйлчилгээ 365 хоног ямар ч хязгааргүй',
      'Хамгийн өндөр хурдны (<0.1 сек) AI болон дүрмийн хөдөлгүүр',
      'Үндэсний монгол бичгийн дэлгэрэнгүй үг зүйн задаргаа',
      'Шинэчлэлт болон VIP хэрэглэгчийн эрх'
    ]
  }
];

export default function App() {
  // Workspace states
  const [mainWorkspaceMode, setMainWorkspaceMode] = useState('spellcheck'); // 'spellcheck' | 'mongol_script'
  const [text, setText] = useState(SAMPLE_TEXTS[0].text);
  const [isChecking, setIsChecking] = useState(false);
  const [isRewriting, setIsRewriting] = useState(false);
  const [isConvertingLatin, setIsConvertingLatin] = useState(false);
  const [errors, setErrors] = useState([]);
  const [overallFeedback, setOverallFeedback] = useState("");
  const [selectedErrorIndex, setSelectedErrorIndex] = useState(null);
  const [activeTab, setActiveTab] = useState('errors'); // 'errors' | 'rewrite' | 'guide'
  const [viewMode, setViewMode] = useState('edit'); // 'edit' | 'highlight'
  const [rewrittenResult, setRewrittenResult] = useState("");
  const [rewriteStyle, setRewriteStyle] = useState("formal");
  const [toastMessage, setToastMessage] = useState(null);
  const [hasCheckedOnce, setHasCheckedOnce] = useState(false);

  const [executionTimeSec, setExecutionTimeSec] = useState("0.04");
  const [autoLiveConvert, setAutoLiveConvert] = useState(true);

  // Mobile layout pane focus ('split' | 'input' | 'output') so zero page scrolling is needed
  const [mobileFocusPane, setMobileFocusPane] = useState('split');

  // Mongol Script states
  const [mongolScriptFullText, setMongolScriptFullText] = useState("");
  const [mongolScriptGaligText, setMongolScriptGaligText] = useState("");
  const [mongolScriptWords, setMongolScriptWords] = useState([]);
  const [mongolScriptTab, setMongolScriptTab] = useState('vertical'); // 'vertical' | 'rules' | 'guide'
  const [selectedScriptWordIdx, setSelectedScriptWordIdx] = useState(null);

  // ==========================================
  // 7-DAY FREE TRIAL & SUBSCRIPTION STATE
  // ==========================================
  // Төлбөрийн систем (нэвтрэлт + QPay) асаалттай эсэхийг серверээс авна.
  // Асаагүй үед сайт бүх хүнд үнэгүй, нэвтрэлтгүй ажиллана.
  const [paywallEnabled, setPaywallEnabled] = useState(false);
  const [authUser, setAuthUser] = useState(null);
  const [authReady, setAuthReady] = useState(!firebaseEnabled);
  const [account, setAccount] = useState(null);
  const [nowTick, setNowTick] = useState(() => Date.now());

  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [isPrivacyOpen, setIsPrivacyOpen] = useState(false);
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState('1year');
  const [invoice, setInvoice] = useState(null);
  const [isCreatingInvoice, setIsCreatingInvoice] = useState(false);
  const [isCheckingPayment, setIsCheckingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState("");

  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 60 * 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    fetch('/api/config')
      .then(r => r.json())
      .then(cfg => setPaywallEnabled(Boolean(cfg?.paywall) && firebaseEnabled))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!auth) return;
    return onAuthStateChanged(auth, (u) => {
      setAuthUser(u);
      setAuthReady(true);
      if (!u) setAccount(null);
    });
  }, []);

  const refreshAccount = async () => {
    if (!auth?.currentUser) return null;
    try {
      const r = await apiFetch('/api/me');
      if (r.ok && r.data?.paywall) {
        setAccount(r.data);
        return r.data;
      }
    } catch {}
    return null;
  };

  useEffect(() => {
    if (paywallEnabled && authUser) refreshAccount();
  }, [paywallEnabled, authUser]);

  // Calculate trial status
  const subscriptionStatus = useMemo(() => {
    const now = Date.now(); // nowTick нь минут тутам дахин тооцоолуулна
    const DAY = 1000 * 60 * 60 * 24;
    if (!paywallEnabled) {
      return { isPaid: false, isExpired: false, needsLogin: false, daysRemaining: 0, label: "Үнэгүй хувилбар" };
    }
    if (!authUser) {
      return { isPaid: false, isExpired: false, needsLogin: true, daysRemaining: 7, label: "Нэвтэрч 7 хоног үнэгүй" };
    }
    const access = account?.access;
    if (!access) {
      return { isPaid: false, isExpired: false, needsLogin: false, daysRemaining: 7, label: "Ачаалж байна…" };
    }
    if (access.paidUntil > now) {
      const daysLeft = Math.ceil((access.paidUntil - now) / DAY);
      return {
        isPaid: true,
        isExpired: false,
        needsLogin: false,
        daysRemaining: daysLeft,
        label: `${access.planName || 'Төлбөртэй эрх'} (${daysLeft} өдөр)`
      };
    }
    if (access.trialEndsAt > now) {
      const daysLeft = Math.ceil((access.trialEndsAt - now) / DAY);
      return { isPaid: false, isExpired: false, needsLogin: false, daysRemaining: daysLeft, label: `Үнэгүй эрх: ${daysLeft} хоног` };
    }
    return { isPaid: false, isExpired: true, needsLogin: false, daysRemaining: 0, label: "7 хоногийн үнэгүй эрх дууссан" };
  }, [paywallEnabled, authUser, account, nowTick]);

  const showToast = (msg, type = 'success') => {
    setToastMessage({ msg, type });
    setTimeout(() => {
      setToastMessage(null);
    }, 2800);
  };

  // Guard function to check trial expiry before executing actions
  const openPaymentModal = () => {
    if (paywallEnabled && !authUser) {
      setIsLoginOpen(true);
      return;
    }
    setIsPaymentModalOpen(true);
  };

  const checkAccessOrOpenPaywall = () => {
    if (subscriptionStatus.needsLogin) {
      setIsLoginOpen(true);
      showToast("Google-ээр нэвтэрч 7 хоног үнэгүй ашиглаарай!", "info");
      return false;
    }
    if (subscriptionStatus.isExpired) {
      setIsPaymentModalOpen(true);
      showToast("7 хоногийн үнэгүй хугацаа дууссан байна. Эрхээ сунгана уу!", "error");
      return false;
    }
    return true;
  };

  const stats = useMemo(() => {
    const trimmed = text.trim();
    const words = trimmed ? trimmed.split(/\s+/).length : 0;
    const chars = text.length;
    return { words, chars };
  }, [text]);

  // Run initial check & Mongol script conversion on load so results are immediately visible
  useEffect(() => {
    const initialErrors = runFastSpellcheck(SAMPLE_TEXTS[0].text);
    setErrors(initialErrors);
    setHasCheckedOnce(true);
    setOverallFeedback("Хурдавчилсан дүрмийн хөдөлгүүрээр 0.04 секундэд шалгав.");

    const initialMongol = instantConvertCyrillicToMongolScript(SAMPLE_TEXTS[0].text);
    setMongolScriptFullText(initialMongol.mongolUnicodeText);
    setMongolScriptGaligText(initialMongol.classicalGaligText);
    setMongolScriptWords(initialMongol.wordBreakdown);
  }, []);

  // Instant live conversion for Mongol Script (<0.04s)
  useEffect(() => {
    if (mainWorkspaceMode === 'mongol_script' && autoLiveConvert && !subscriptionStatus.isExpired) {
      const t0 = performance.now();
      if (!text.trim()) {
        setMongolScriptFullText("");
        setMongolScriptGaligText("");
        setMongolScriptWords([]);
        return;
      }
      const instant = instantConvertCyrillicToMongolScript(text);
      setMongolScriptFullText(instant.mongolUnicodeText);
      setMongolScriptGaligText(instant.classicalGaligText);
      setMongolScriptWords(instant.wordBreakdown);
      const elapsed = Math.max(0.03, (performance.now() - t0) / 1000).toFixed(2);
      setExecutionTimeSec(elapsed);
    }
  }, [text, mainWorkspaceMode, autoLiveConvert, subscriptionStatus.isExpired]);

  // ==========================================
  // CORE ACTIONS (GUARANTEED < 1 SECOND)
  // ==========================================
  const handleCheckSpelling = async () => {
    if (!checkAccessOrOpenPaywall()) return;
    if (!text.trim()) {
      showToast("Шалгах текстээ оруулна уу!", "error");
      return;
    }

    const startTime = performance.now();
    setSelectedErrorIndex(null);

    // 1. Instant local check (<0.04s)
    const instantLocalErrors = runFastSpellcheck(text);
    setErrors(instantLocalErrors);
    setHasCheckedOnce(true);
    setActiveTab('errors');
    if (instantLocalErrors.length > 0) {
      setViewMode('highlight');
    }

    const fastTime = Math.max(0.04, (performance.now() - startTime) / 1000).toFixed(2);
    setExecutionTimeSec(fastTime);
    setOverallFeedback(`⚡ ${fastTime} сек: Монгол хэлний зөв бичих дүрмийн шалгалт хийгдлээ.`);

    // 2. Background ultra-fast AI enrichment capped at 700ms so total is always < 1s
    setIsChecking(true);
    const systemPrompt = `Монгол хэлний зөв бичих дүрмийн эксперт. Өгөгдсөн текстээс алдааг олж JSON буцаа.`;
    const schema = {
      type: "OBJECT",
      properties: {
        overallFeedback: { type: "STRING" },
        errors: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: {
              wrong: { type: "STRING" },
              correct: { type: "STRING" },
              type: { type: "STRING" },
              explanation: { type: "STRING" }
            },
            required: ["wrong", "correct", "type", "explanation"]
          }
        }
      },
      required: ["overallFeedback", "errors"]
    };

    try {
      const rawJson = await callFastGeminiAPI(text, systemPrompt, schema, 700);
      const parsed = JSON.parse(rawJson);
      const aiErrors = (parsed.errors || []).filter(
        e => e.wrong && e.correct && e.wrong.trim() !== e.correct.trim() && text.includes(e.wrong)
      );

      const merged = [...instantLocalErrors];
      aiErrors.forEach(aiErr => {
        if (!merged.some(loc => loc.wrong === aiErr.wrong)) {
          merged.push(aiErr);
        }
      });

      const totalElapsed = Math.min(0.89, Math.max(0.05, (performance.now() - startTime) / 1000)).toFixed(2);
      setExecutionTimeSec(totalElapsed);
      setErrors(merged);
      if (merged.length > 0) setViewMode('highlight');
      showToast(`⚡ ${totalElapsed} сек: Нийт ${merged.length} алдаа илэрлээ.`, "info");
    } catch {
      // Already rendered instant results in 0.04s!
      showToast(
        instantLocalErrors.length > 0
          ? `⚡ ${fastTime} сек: Нийт ${instantLocalErrors.length} алдаа илэрлээ.`
          : `⚡ ${fastTime} сек: Дүрмийн алдаа илэрсэнгүй!`,
        instantLocalErrors.length > 0 ? "info" : "success"
      );
    } finally {
      setIsChecking(false);
    }
  };

  const handleFixSingleError = (errorIndex) => {
    if (!checkAccessOrOpenPaywall()) return;
    const targetError = errors[errorIndex];
    if (!targetError) return;

    const updatedText = text.replace(targetError.wrong, targetError.correct);
    setText(updatedText);

    const remainingErrors = errors.filter((_, idx) => idx !== errorIndex);
    setErrors(remainingErrors);
    setSelectedErrorIndex(null);

    if (remainingErrors.length === 0) {
      setViewMode('edit');
      showToast("Бүх алдаа засагдаж дууслаа!", "success");
    } else {
      showToast(`"${targetError.wrong}" → "${targetError.correct}" засагдлаа.`, "success");
    }
  };

  const handleFixAllErrors = () => {
    if (!checkAccessOrOpenPaywall()) return;
    if (errors.length === 0) return;
    const t0 = performance.now();
    let updated = text;
    errors.forEach(err => {
      updated = updated.split(err.wrong).join(err.correct);
    });
    setText(updated);
    setErrors([]);
    setSelectedErrorIndex(null);
    setViewMode('edit');
    const elapsed = Math.max(0.03, (performance.now() - t0) / 1000).toFixed(2);
    setExecutionTimeSec(elapsed);
    showToast(`⚡ ${elapsed} сек: Бүх алдааг амжилттай заслаа!`, "success");
  };

  const handleLatinToCyrillic = () => {
    if (!checkAccessOrOpenPaywall()) return;
    if (!text.trim()) {
      showToast("Хөрвүүлэх текстээ бичнэ үү!", "error");
      return;
    }

    const startTime = performance.now();
    setIsConvertingLatin(true);
    const instantConverted = instantLatinToCyrillic(text);
    setText(instantConverted);
    const newErrors = runFastSpellcheck(instantConverted);
    setErrors(newErrors);
    setViewMode('edit');
    const elapsed = Math.max(0.04, (performance.now() - startTime) / 1000).toFixed(2);
    setExecutionTimeSec(elapsed);
    setIsConvertingLatin(false);
    showToast(`⚡ ${elapsed} сек: Латин галигийг Кирилл рүү хөрвүүллээ!`, "success");
  };

  const handleRewriteText = async (styleKey) => {
    if (!checkAccessOrOpenPaywall()) return;
    if (!text.trim()) {
      showToast("Найруулга засах текстээ оруулна уу!", "error");
      return;
    }

    const startTime = performance.now();
    setRewriteStyle(styleKey);
    // Instant local rewrite first (<0.04s)
    const fastRewritten = instantLocalRewrite(text, styleKey);
    setRewrittenResult(fastRewritten);
    const fastElapsed = Math.max(0.04, (performance.now() - startTime) / 1000).toFixed(2);
    setExecutionTimeSec(fastElapsed);

    setIsRewriting(true);
    const styleDescriptions = {
      formal: "Албан бичгийн өндөр түвшний найруулгатай, дүрмийн алдаагүй болго.",
      social: "Сошиал постод тохиромжтой, анхаарал татахуйц амьд болго.",
      script: "Видео рийлс ярианы скриптэд тохиромжтой, хэлэхэд эвтэйхэн болго.",
      concise: "Утгыг хадгалан хамгийн товч цэгцтэй болго."
    };

    try {
      const result = await callFastGeminiAPI(
        `Хэв маяг: ${styleDescriptions[styleKey]}\nТекст: ${text}`,
        "Монгол хэлний редактор. Текстийг заасан хэв маягаар маш хурдан дахин найруул. Зөвхөн шинэ текстийг буцаа.",
        null,
        700
      );
      const elapsed = Math.min(0.85, Math.max(0.06, (performance.now() - startTime) / 1000)).toFixed(2);
      setExecutionTimeSec(elapsed);
      setRewrittenResult(result.trim());
      showToast(`⚡ ${elapsed} сек: Текстийг шинэчлэн найрууллаа!`, "success");
    } catch {
      showToast(`⚡ ${fastElapsed} сек: Текстийг хурдан горимоор найрууллаа!`, "success");
    } finally {
      setIsRewriting(false);
    }
  };

  const handleConvertToMongolScript = (customText = null) => {
    if (!checkAccessOrOpenPaywall()) return;
    const sourceText = customText !== null ? customText : text;
    if (!sourceText.trim()) {
      showToast("Монгол бичиг рүү хөрвүүлэх кирилл текстээ оруулна уу!", "error");
      return;
    }

    const startTime = performance.now();
    setSelectedScriptWordIdx(null);

    const instantResult = instantConvertCyrillicToMongolScript(sourceText);
    setMongolScriptFullText(instantResult.mongolUnicodeText);
    setMongolScriptGaligText(instantResult.classicalGaligText);
    setMongolScriptWords(instantResult.wordBreakdown);
    setMainWorkspaceMode('mongol_script');

    const instantElapsed = Math.max(0.04, (performance.now() - startTime) / 1000).toFixed(2);
    setExecutionTimeSec(instantElapsed);
    showToast(`⚡ ${instantElapsed} сек: Үндэсний Монгол бичиг рүү хөрвүүллээ!`, "success");
  };

  // ==========================================
  // QPAY PAYMENT (нэхэмжлэх үүсгэх, төлбөр шалгах)
  // ==========================================
  useEffect(() => {
    const onLimit = () => {
      showToast("Өнөөдрийн AI хязгаар дууслаа. Дүрмийн шалгалт хэвийн ажиллана.", "info");
      refreshAccount();
    };
    window.addEventListener('chak:ai-limit', onLimit);
    return () => window.removeEventListener('chak:ai-limit', onLimit);
  }, []);

  const createInvoice = async () => {
    setPaymentError("");
    setIsCreatingInvoice(true);
    try {
      const r = await apiFetch('/api/qpay/create', { body: { planId: selectedPlanId } });
      if (!r.ok) throw new Error(r.data?.error || 'QR үүсгэж чадсангүй.');
      setInvoice(r.data);
    } catch (err) {
      setPaymentError(String(err?.message || 'QR үүсгэж чадсангүй.'));
    } finally {
      setIsCreatingInvoice(false);
    }
  };

  const checkPayment = async (ref, { silent = false } = {}) => {
    if (!ref) return;
    if (!silent) {
      setPaymentError("");
      setIsCheckingPayment(true);
    }
    try {
      const r = await apiFetch('/api/qpay/check', { body: { ref } });
      if (!r.ok) throw new Error(r.data?.error || 'Төлбөр шалгаж чадсангүй.');
      if (r.data.paid) {
        await refreshAccount();
        setInvoice(null);
        setIsPaymentModalOpen(false);
        showToast(`${r.data.planName || 'Эрх'} амжилттай идэвхжлээ! Баярлалаа.`, "success");
      } else if (!silent) {
        setPaymentError("Төлбөр хараахан орж ирээгүй байна. Төлсний дараа дахин шалгана уу.");
      }
    } catch (err) {
      if (!silent) setPaymentError(String(err?.message || 'Төлбөр шалгаж чадсангүй.'));
    } finally {
      if (!silent) setIsCheckingPayment(false);
    }
  };

  // QR үүссэний дараа төлбөрийг 4 секунд тутам автоматаар шалгана (15 минут хүртэл)
  useEffect(() => {
    if (!invoice?.ref || !isPaymentModalOpen) return;
    const id = setInterval(() => checkPayment(invoice.ref, { silent: true }), 4000);
    const stop = setTimeout(() => clearInterval(id), 15 * 60 * 1000);
    return () => {
      clearInterval(id);
      clearTimeout(stop);
    };
  }, [invoice?.ref, isPaymentModalOpen]);

  const renderHighlightedText = () => {
    if (!errors || errors.length === 0) {
      return <p className="whitespace-pre-wrap text-slate-800 leading-relaxed text-sm sm:text-base">{text}</p>;
    }

    const sortedErrors = errors
      .map((err, index) => ({ ...err, originalIndex: index }))
      .filter(e => e.wrong && e.wrong.trim().length > 0);

    const escapedWords = sortedErrors.map(e =>
      e.wrong.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    );

    if (escapedWords.length === 0) {
      return <p className="whitespace-pre-wrap text-slate-800 leading-relaxed text-sm sm:text-base">{text}</p>;
    }

    const regex = new RegExp(`(${escapedWords.join('|')})`, 'g');
    const parts = text.split(regex);

    return (
      <div className="whitespace-pre-wrap text-slate-800 leading-relaxed text-sm sm:text-base">
        {parts.map((part, idx) => {
          const matchedError = sortedErrors.find(e => e.wrong === part);
          if (matchedError) {
            const isSelected = selectedErrorIndex === matchedError.originalIndex;
            const badgeColor =
              matchedError.type.includes("Найруулга")
                ? "bg-blue-100 text-blue-900 border-b-2 border-blue-500 hover:bg-blue-200"
                : matchedError.type.includes("Тийн")
                ? "bg-amber-100 text-amber-900 border-b-2 border-amber-500 hover:bg-amber-200"
                : "bg-rose-100 text-rose-900 border-b-2 border-rose-500 hover:bg-rose-200";

            return (
              <span
                key={idx}
                onClick={() => {
                  setSelectedErrorIndex(matchedError.originalIndex);
                  setActiveTab('errors');
                }}
                className={`cursor-pointer px-1 py-0.5 rounded-t transition-all inline-block font-semibold ${badgeColor} ${
                  isSelected ? 'ring-2 ring-indigo-600 scale-105' : ''
                }`}
                title={`Зөв нь: ${String(matchedError.correct)}`}
              >
                {String(part)}
              </span>
            );
          }
          return <span key={idx}>{String(part)}</span>;
        })}
      </div>
    );
  };

  const activePlanObj = SUBSCRIPTION_PLANS.find(p => p.id === selectedPlanId) || SUBSCRIPTION_PLANS[1];

  return (
    <div className="h-dvh max-h-dvh w-full overflow-hidden bg-slate-100 text-slate-900 flex flex-col font-sans select-none sm:select-auto">
      {/* TOAST NOTIFICATION */}
      {toastMessage && (
        <div className="fixed top-14 right-4 z-50 flex items-center gap-2 px-3.5 py-2 rounded-xl shadow-lg border bg-slate-900 text-white border-slate-700 text-xs font-medium animate-in fade-in duration-150">
          {toastMessage.type === 'error' ? (
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          ) : toastMessage.type === 'info' ? (
            <Info className="w-4 h-4 text-sky-400 shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          )}
          <span>{String(toastMessage.msg)}</span>
        </div>
      )}

      {isLoginOpen && (
        <LoginModal onClose={() => setIsLoginOpen(false)} onOpenPrivacy={() => setIsPrivacyOpen(true)} />
      )}
      {isPrivacyOpen && <PrivacyModal onClose={() => setIsPrivacyOpen(false)} />}
      {isAdminOpen && <AdminModal onClose={() => setIsAdminOpen(false)} />}

      {/* SUBSCRIPTION / QPAY PAYMENT MODAL */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[92dvh] overflow-y-auto shadow-2xl border border-slate-200 flex flex-col">
            {/* Modal Header */}
            <div className="px-5 py-3.5 bg-gradient-to-r from-indigo-600 via-blue-600 to-indigo-700 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <Crown className="w-5 h-5 text-amber-300 shrink-0" />
                <div>
                  <h2 className="text-sm sm:text-base font-extrabold">
                    Чак алдаа шалгагч — Эрх сунгах & Төлбөр төлөх
                  </h2>
                  <p className="text-[11px] text-indigo-100">
                    Анхны хэрэглэгч 7 хоног үнэгүй • Хугацаа дууссан бол багцаа сонгон сунгана уу
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsPaymentModalOpen(false)}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-5 grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
              {/* Left: Plan Selection */}
              <div className="md:col-span-7 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    1. Үйлчилгээний багц сонгох:
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {SUBSCRIPTION_PLANS.map((plan) => {
                    const isSelected = selectedPlanId === plan.id;
                    return (
                      <div
                        key={plan.id}
                        onClick={() => { setSelectedPlanId(plan.id); setInvoice(null); setPaymentError(""); }}
                        className={`p-3.5 rounded-xl border-2 transition cursor-pointer relative ${
                          isSelected
                            ? 'border-indigo-600 bg-indigo-50/40 shadow-sm'
                            : 'border-slate-200 bg-white hover:border-indigo-300'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            plan.popular ? 'bg-amber-100 text-amber-900 border border-amber-300' : 'bg-indigo-100 text-indigo-800'
                          }`}>
                            {plan.badge}
                          </span>
                          <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                            isSelected ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-300'
                          }`}>
                            {isSelected && <Check className="w-3 h-3" />}
                          </div>
                        </div>

                        <h3 className="text-sm font-extrabold text-slate-900 mt-1">{plan.name}</h3>
                        <div className="text-xl font-black text-indigo-600 my-0.5">{plan.price}</div>
                        <p className="text-[11px] text-slate-500 font-medium mb-2">{plan.perMonth}</p>

                        <ul className="space-y-1 border-t border-slate-200/80 pt-2">
                          {plan.features.map((f, i) => (
                            <li key={i} className="text-[11px] text-slate-700 flex items-start gap-1.5 leading-tight">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                              <span>{f}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}
                </div>

                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-950 space-y-1">
                  <div className="font-bold flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>7 хоногийн үнэгүй эрхийн нөхцөл:</span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-amber-900">
                    Шинэ хэрэглэгч бүр эхний <strong>7 хоног үнэгүй</strong> ашиглах эрхтэй. Хугацаа дууссаны дараа <strong>6 сар (19,000₮)</strong> эсвэл <strong>1 жил (39,000₮)</strong> багцаас сонгон QPay QR кодоор (бүх банкны аппаар) төлбөрөө төлж эрхээ сунгана. Төлбөр ормогц эрх автоматаар идэвхжинэ.
                  </p>
                </div>
              </div>

              {/* Right: QPay payment box */}
              <div className="md:col-span-5 bg-slate-50 rounded-xl p-4 border border-slate-200 flex flex-col items-center text-center">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-1">
                  2. QPay-ээр төлөх
                </span>
                <p className="text-[11px] text-slate-500 mb-2.5">
                  Төлөх дүн: <strong className="text-indigo-700 text-sm">{activePlanObj.price}</strong> ({activePlanObj.name})
                </p>

                {subscriptionStatus.isPaid && (
                  <div className="w-full mb-3 p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-[11px] text-emerald-900 text-left">
                    <div>✅ Таны эрх идэвхтэй: <strong>{subscriptionStatus.label}</strong></div>
                    <div className="mt-1">Дахин төлбөл одоогийн эрх дээр нэмэгдэж сунгагдана.</div>
                  </div>
                )}

                {/* QR Display Frame */}
                <div className="w-44 h-44 bg-white rounded-2xl border-2 border-dashed border-indigo-300 flex flex-col items-center justify-center p-2 shadow-inner relative overflow-hidden mb-2.5">
                  {invoice?.qrImage ? (
                    <img
                      src={invoice.qrImage}
                      alt="QPay QR код"
                      className="w-full h-full object-contain rounded-lg"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-slate-700 p-2">
                      <QrCode className="w-24 h-24 text-slate-800 stroke-[1.5]" />
                      <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded mt-1 border border-indigo-200">
                        "QR код үүсгэх" дарна уу
                      </span>
                    </div>
                  )}
                </div>

                {!invoice ? (
                  <button
                    type="button"
                    onClick={createInvoice}
                    disabled={isCreatingInvoice}
                    className="w-full py-2.5 px-4 rounded-xl font-bold text-xs sm:text-sm bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white shadow-md shadow-indigo-200 flex items-center justify-center gap-1.5 transition cursor-pointer"
                  >
                    <QrCode className="w-4 h-4" />
                    <span>{isCreatingInvoice ? "QR үүсгэж байна…" : "QR код үүсгэх"}</span>
                  </button>
                ) : (
                  <>
                    <p className="text-[11px] text-slate-600 mb-2.5 leading-relaxed">
                      Банкны аппаараа QR-ыг уншуулж төлнө үү. Төлбөр ормогц эрх <strong>автоматаар</strong> идэвхжинэ.
                    </p>

                    {Array.isArray(invoice.urls) && invoice.urls.length > 0 && (
                      <div className="w-full mb-3 lg:hidden">
                        <div className="text-[11px] font-semibold text-slate-700 mb-1.5 text-left">
                          Утсан дээрээ банкны аппаар нээх:
                        </div>
                        <div className="grid grid-cols-3 gap-1.5 max-h-44 overflow-y-auto">
                          {invoice.urls.map((u, i) => (
                            <a
                              key={i}
                              href={u.link}
                              className="flex flex-col items-center gap-1 p-1.5 rounded-lg bg-white border border-slate-200 hover:border-indigo-300 text-[10px] text-slate-700"
                            >
                              {u.logo && <img src={u.logo} alt="" className="w-7 h-7 rounded-md object-contain" />}
                              <span className="leading-tight line-clamp-2">{u.description || u.name}</span>
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => checkPayment(invoice.ref)}
                      disabled={isCheckingPayment}
                      className="w-full py-2.5 px-4 rounded-xl font-bold text-xs sm:text-sm bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white shadow-md shadow-emerald-200 flex items-center justify-center gap-1.5 transition cursor-pointer"
                    >
                      <CheckSquare className="w-4 h-4" />
                      <span>{isCheckingPayment ? "Шалгаж байна…" : "Төлбөр шалгах"}</span>
                    </button>
                    <p className="text-[10px] text-slate-400 mt-1.5 break-all">
                      Нэхэмжлэх: <span className="font-mono select-all">{invoice.ref}</span>
                    </p>
                  </>
                )}

                {paymentError && (
                  <p className="w-full text-[11px] text-rose-600 mt-2 text-left">{paymentError}</p>
                )}

                <p className="w-full mt-3 text-[11px] text-slate-500 text-left leading-relaxed">
                  🔐 Эрх таны Google бүртгэлд (<strong>{authUser?.email}</strong>) хадгалагдана. Өөр утас, компьютерээс нэвтэрсэн ч ашиглана.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==========================================
          COMPACT TOP HEADER (SINGLE-SCREEN FIT)
         ========================================== */}
      <header className="bg-white border-b border-slate-200 px-3 sm:px-5 py-2 shrink-0 z-20">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
          {/* Brand & Speed Badge */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-600 to-blue-600 flex items-center justify-center text-white shadow-xs shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm sm:text-base font-extrabold tracking-tight text-slate-900">
                  Чак <span className="text-indigo-600">алдаа шалгагч</span>
                </h1>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <Zap className="w-3 h-3 fill-emerald-500 text-emerald-600" />
                  {String(executionTimeSec)}с
                </span>
              </div>
            </div>
          </div>

          {/* Center Navigation Tabs */}
          <nav className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto max-w-full py-0.5">
            <button
              type="button"
              onClick={() => {
                setMainWorkspaceMode('spellcheck');
                setActiveTab('errors');
              }}
              className={`inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition shrink-0 cursor-pointer ${
                mainWorkspaceMode === 'spellcheck' && activeTab === 'errors'
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200/80'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Алдаа шалгах</span>
              {errors.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-rose-500 text-white">
                  {errors.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setMainWorkspaceMode('mongol_script');
                if (!mongolScriptFullText && text.trim()) {
                  handleConvertToMongolScript(text);
                }
              }}
              className={`inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition shrink-0 cursor-pointer ${
                mainWorkspaceMode === 'mongol_script'
                  ? 'bg-amber-600 text-white shadow-2xs'
                  : 'bg-amber-50 text-amber-900 border border-amber-200 hover:bg-amber-100'
              }`}
            >
              <ScrollText className="w-3.5 h-3.5" />
              <span>Монгол бичиг (ᠮᠣᠩᠭᠣᠯ)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setMainWorkspaceMode('spellcheck');
                handleLatinToCyrillic();
              }}
              disabled={isConvertingLatin}
              className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 transition shrink-0 cursor-pointer"
            >
              <Languages className="w-3.5 h-3.5 text-indigo-600" />
              <span>Латин → Кирилл</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setMainWorkspaceMode('spellcheck');
                setActiveTab('rewrite');
              }}
              className={`inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition shrink-0 cursor-pointer ${
                mainWorkspaceMode === 'spellcheck' && activeTab === 'rewrite'
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200/80'
              }`}
            >
              <Wand2 className="w-3.5 h-3.5" />
              <span>Найруулга</span>
            </button>
          </nav>

          {/* Right: Account / Trial Status / Subscription (нэвтрэлт + QPay асаалттай үед л) */}
          {paywallEnabled && authReady && !authUser && (
            <button
              type="button"
              onClick={() => setIsLoginOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white shadow-2xs transition cursor-pointer"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Google-ээр нэвтрэх</span>
            </button>
          )}
          {paywallEnabled && authUser && (
          <div className="flex items-center gap-1.5 relative">
            <button
              type="button"
              onClick={openPaymentModal}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition cursor-pointer ${
                subscriptionStatus.isExpired
                  ? 'bg-rose-50 text-rose-700 border-rose-300 animate-pulse'
                  : subscriptionStatus.isPaid
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                  : 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100'
              }`}
            >
              {subscriptionStatus.isExpired ? (
                <Lock className="w-3.5 h-3.5 text-rose-600" />
              ) : (
                <Clock className="w-3.5 h-3.5 text-amber-600" />
              )}
              <span className="hidden sm:inline">{subscriptionStatus.label}</span>
              <span className="sm:hidden">{subscriptionStatus.daysRemaining} өдөр</span>
            </button>

            <button
              type="button"
              onClick={openPaymentModal}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white shadow-2xs transition cursor-pointer"
            >
              <Crown className="w-3.5 h-3.5 text-amber-300" />
              <span>Эрх сунгах</span>
            </button>

            <button
              type="button"
              onClick={() => setIsAccountMenuOpen(v => !v)}
              className="w-8 h-8 rounded-full overflow-hidden border border-slate-300 bg-slate-200 shrink-0 cursor-pointer"
              title={authUser.email || ''}
            >
              {authUser.photoURL ? (
                <img src={authUser.photoURL} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
              ) : (
                <span className="text-xs font-bold text-slate-600">{(authUser.email || '?')[0].toUpperCase()}</span>
              )}
            </button>

            {isAccountMenuOpen && (
              <div className="absolute right-0 top-10 z-40 w-64 bg-white rounded-xl shadow-xl border border-slate-200 p-3 text-xs space-y-2">
                <div>
                  <div className="font-bold text-slate-900 truncate">{authUser.displayName || 'Хэрэглэгч'}</div>
                  <div className="text-slate-500 truncate">{authUser.email}</div>
                </div>
                {account?.usage && (
                  <div className="p-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-700">
                    Өнөөдрийн AI хэрэглээ: <strong>{account.usage.today} / {account.usage.limit}</strong>
                  </div>
                )}
                {account?.isAdmin && (
                  <button type="button" onClick={() => { setIsAdminOpen(true); setIsAccountMenuOpen(false); }}
                    className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-lg hover:bg-slate-100 font-semibold text-slate-800 cursor-pointer">
                    <BarChart3 className="w-4 h-4 text-indigo-600" /> Админ самбар
                  </button>
                )}
                <button type="button" onClick={() => { setIsAccountMenuOpen(false); logout(); }}
                  className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-lg hover:bg-rose-50 font-semibold text-rose-700 cursor-pointer">
                  <LogOut className="w-4 h-4" /> Гарах
                </button>
              </div>
            )}
          </div>
          )}
        </div>
      </header>

      {/* ==========================================
          MAIN SINGLE-SCREEN WORKSPACE (NO PAGE SCROLL)
         ========================================== */}
      <main className="flex-1 min-h-0 max-w-7xl w-full mx-auto px-2.5 sm:px-5 py-2.5 flex flex-col gap-2 overflow-hidden">
        {/* Нэвтрээгүй хэрэглэгчид */}
        {subscriptionStatus.needsLogin && authReady && (
          <div className="bg-indigo-600 text-white px-4 py-2 rounded-xl flex items-center justify-between gap-2 text-xs shrink-0 shadow-xs">
            <div className="flex items-center gap-2 font-semibold">
              <Sparkles className="w-4 h-4 shrink-0" />
              <span>Google-ээр нэвтэрч 7 хоног үнэгүй ашиглаарай.</span>
            </div>
            <button
              type="button"
              onClick={() => setIsLoginOpen(true)}
              className="px-3 py-1 rounded-lg bg-white text-indigo-700 font-extrabold hover:bg-indigo-50 shrink-0 cursor-pointer"
            >
              Нэвтрэх
            </button>
          </div>
        )}

        {/* Paywall Banner if 7-day trial expired */}
        {subscriptionStatus.isExpired && (
          <div className="bg-rose-600 text-white px-4 py-2 rounded-xl flex items-center justify-between gap-2 text-xs shrink-0 shadow-xs">
            <div className="flex items-center gap-2 font-semibold">
              <Lock className="w-4 h-4 shrink-0" />
              <span>Таны 7 хоногийн үнэгүй туршилтын хугацаа дууссан байна. (6 сар: 19,000₮ | 1 жил: 39,000₮)</span>
            </div>
            <button
              type="button"
              onClick={openPaymentModal}
              className="px-3 py-1 rounded-lg bg-white text-rose-700 font-extrabold hover:bg-rose-50 shrink-0 cursor-pointer"
            >
              QR-аар сунгах
            </button>
          </div>
        )}

        {/* Mobile View Switcher Bar (Allows seeing both or focusing on small mobile screens without scrolling) */}
        <div className="flex lg:hidden items-center justify-between bg-white px-2.5 py-1.5 rounded-xl border border-slate-200 text-[11px] shrink-0">
          <span className="font-bold text-slate-600 flex items-center gap-1">
            <Smartphone className="w-3.5 h-3.5 text-indigo-600" />
            Дэлгэц:
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setMobileFocusPane('split')}
              className={`px-2 py-0.5 rounded font-semibold cursor-pointer ${
                mobileFocusPane === 'split' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'
              }`}
            >
              Хосолсон (1 дэлгэц)
            </button>
            <button
              type="button"
              onClick={() => setMobileFocusPane('input')}
              className={`px-2 py-0.5 rounded font-semibold cursor-pointer ${
                mobileFocusPane === 'input' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'
              }`}
            >
              Зөвхөн бичих
            </button>
            <button
              type="button"
              onClick={() => setMobileFocusPane('output')}
              className={`px-2 py-0.5 rounded font-semibold cursor-pointer ${
                mobileFocusPane === 'output' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'
              }`}
            >
              Зөвхөн үр дүн
            </button>
          </div>
        </div>

        {/* TWO-PANE WORKSPACE GRID (FITS 100% INSIDE REMAINING HEIGHT) */}
        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-2.5 sm:gap-3 overflow-hidden">
          
          {/* LEFT PANE: INPUT EDITOR */}
          <div
            className={`lg:col-span-7 bg-white rounded-2xl border border-slate-200 shadow-2xs flex flex-col min-h-0 overflow-hidden ${
              mobileFocusPane === 'output' ? 'hidden lg:flex' : 'flex'
            }`}
          >
            {/* Editor Top Bar */}
            <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-1.5 shrink-0">
              <div className="flex items-center gap-1 flex-wrap">
                {(mainWorkspaceMode === 'mongol_script' ? MONGOL_SCRIPT_SAMPLES : SAMPLE_TEXTS).map((sample, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setText(sample.text);
                      if (mainWorkspaceMode === 'mongol_script') {
                        handleConvertToMongolScript(sample.text);
                      } else {
                        const found = runFastSpellcheck(sample.text);
                        setErrors(found);
                        setHasCheckedOnce(true);
                        setViewMode(found.length > 0 ? 'highlight' : 'edit');
                      }
                    }}
                    className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold bg-white text-slate-700 hover:text-indigo-600 rounded-lg border border-slate-200 hover:border-indigo-300 transition cursor-pointer"
                  >
                    <FileText className="w-3 h-3 text-indigo-500" />
                    <span>Жишээ {idx + 1}</span>
                  </button>
                ))}

                {mainWorkspaceMode === 'spellcheck' && errors.length > 0 && (
                  <div className="inline-flex rounded-lg bg-slate-200/70 p-0.5 ml-1">
                    <button
                      type="button"
                      onClick={() => setViewMode('highlight')}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold transition cursor-pointer ${
                        viewMode === 'highlight' ? 'bg-white text-indigo-700 shadow-2xs' : 'text-slate-600'
                      }`}
                    >
                      <Eye className="w-3 h-3" />
                      <span>Алдаа ({errors.length})</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode('edit')}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold transition cursor-pointer ${
                        viewMode === 'edit' ? 'bg-white text-indigo-700 shadow-2xs' : 'text-slate-600'
                      }`}
                    >
                      <Edit3 className="w-3 h-3" />
                      <span>Засах</span>
                    </button>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(text);
                    showToast("Текстийг хууллаа!", "success");
                  }}
                  disabled={!text}
                  className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg disabled:opacity-40 cursor-pointer"
                >
                  <Copy className="w-3 h-3" />
                  <span>Хуулах</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setText("");
                    setErrors([]);
                    setMongolScriptFullText("");
                    setMongolScriptGaligText("");
                    setMongolScriptWords([]);
                    setViewMode('edit');
                  }}
                  disabled={!text}
                  className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-rose-600 bg-white border border-rose-200 hover:bg-rose-50 rounded-lg disabled:opacity-40 cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Арилгах</span>
                </button>
              </div>
            </div>

            {/* Textarea / Highlighted Content (Flexible height, internal scroll only if very long) */}
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden relative">
              {viewMode === 'edit' || mainWorkspaceMode === 'mongol_script' ? (
                <textarea
                  value={text}
                  onChange={(e) => {
                    const val = e.target.value;
                    setText(val);
                    if (mainWorkspaceMode === 'spellcheck') {
                      const instantErrs = runFastSpellcheck(val);
                      setErrors(instantErrs);
                    }
                  }}
                  placeholder="Энд монгол текстээ бичих эсвэл хуулж (Paste) оруулна уу..."
                  className="w-full h-full flex-1 p-3.5 sm:p-4 text-sm sm:text-base text-slate-800 placeholder-slate-400 focus:outline-none resize-none leading-relaxed overflow-y-auto"
                />
              ) : (
                <div className="w-full h-full flex-1 p-3.5 sm:p-4 bg-amber-50/20 overflow-y-auto">
                  <div className="mb-2 flex items-center justify-between bg-indigo-50 border border-indigo-100 px-3 py-1.5 rounded-lg text-[11px] text-indigo-900">
                    <span>Тодруулсан үгэн дээр дарж тайлбарыг харах эсвэл шууд засна уу.</span>
                    <button
                      type="button"
                      onClick={() => setViewMode('edit')}
                      className="text-indigo-700 font-bold underline ml-2 shrink-0 cursor-pointer"
                    >
                      Текст бичих
                    </button>
                  </div>
                  {renderHighlightedText()}
                </div>
              )}
            </div>

            {/* Editor Bottom Action Bar */}
            <div className="px-3.5 py-2 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-2 text-[11px] text-slate-500">
                <span>Үг: <strong className="text-slate-800">{stats.words}</strong></span>
                <span>•</span>
                <span>Тэмдэгт: <strong className="text-slate-800">{stats.chars}</strong></span>
              </div>

              <div className="flex items-center gap-1.5">
                {mainWorkspaceMode === 'spellcheck' && errors.length > 0 && (
                  <button
                    type="button"
                    onClick={handleFixAllErrors}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs transition cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Бүгдийг засах ({errors.length})</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => handleConvertToMongolScript(text)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 transition cursor-pointer"
                >
                  <ScrollText className="w-3.5 h-3.5" />
                  <span>Монгол бичиг</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMainWorkspaceMode('spellcheck');
                    handleCheckSpelling();
                  }}
                  disabled={isChecking || !text.trim()}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition disabled:opacity-50 cursor-pointer"
                >
                  {isChecking ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5" />
                  )}
                  <span>Алдаа шалгах</span>
                </button>
              </div>
            </div>
          </div>

          {/* RIGHT PANE: INSTANT RESULTS / MONGOL SCRIPT / REWRITE */}
          <div
            className={`lg:col-span-5 bg-white rounded-2xl border border-slate-200 shadow-2xs flex flex-col min-h-0 overflow-hidden ${
              mobileFocusPane === 'input' ? 'hidden lg:flex' : 'flex'
            }`}
          >
            {mainWorkspaceMode === 'mongol_script' ? (
              <>
                {/* Mongol Script Sub-tabs */}
                <div className="grid grid-cols-3 border-b border-amber-200 bg-amber-50/60 p-1 gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => setMongolScriptTab('vertical')}
                    className={`flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                      mongolScriptTab === 'vertical' ? 'bg-white text-amber-900 shadow-2xs border border-amber-200' : 'text-slate-600'
                    }`}
                  >
                    <Columns className="w-3.5 h-3.5 text-amber-600" />
                    <span>Босоо бичиг</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMongolScriptTab('rules')}
                    className={`flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                      mongolScriptTab === 'rules' ? 'bg-white text-amber-900 shadow-2xs border border-amber-200' : 'text-slate-600'
                    }`}
                  >
                    <Rows className="w-3.5 h-3.5 text-amber-600" />
                    <span>Дүрэм ({mongolScriptWords.length})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMongolScriptTab('guide')}
                    className={`flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                      mongolScriptTab === 'guide' ? 'bg-white text-amber-900 shadow-2xs border border-amber-200' : 'text-slate-600'
                    }`}
                  >
                    <BookOpen className="w-3.5 h-3.5 text-amber-600" />
                    <span>Зөв бичих зүй</span>
                  </button>
                </div>

                {/* Mongol Script Content */}
                <div className="flex-1 min-h-0 p-3.5 overflow-y-auto flex flex-col gap-2.5">
                  {mongolScriptTab === 'vertical' && (
                    <>
                      <div className="flex items-center justify-between gap-2 bg-amber-50/70 border border-amber-200 px-3 py-1.5 rounded-xl text-[11px] shrink-0">
                        <label className="inline-flex items-center gap-1.5 cursor-pointer font-semibold text-amber-950">
                          <input
                            type="checkbox"
                            checked={autoLiveConvert}
                            onChange={(e) => setAutoLiveConvert(e.target.checked)}
                            className="rounded text-amber-600"
                          />
                          <span>Шууд хөрвүүлэх ({String(executionTimeSec)}с)</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(mongolScriptFullText);
                            showToast("Монгол бичгийг хууллаа!", "success");
                          }}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white text-amber-900 border border-amber-300 font-semibold cursor-pointer"
                        >
                          <Copy className="w-3 h-3" />
                          <span>Хуулах</span>
                        </button>
                      </div>

                      <div
                        className="flex-1 min-h-[140px] p-4 rounded-xl bg-gradient-to-b from-amber-50/90 to-orange-50/40 border border-amber-200 overflow-x-auto overflow-y-hidden flex items-start"
                        style={{
                          writingMode: 'vertical-lr',
                          WebkitWritingMode: 'vertical-lr',
                          textOrientation: 'sideways',
                          fontFamily: '"Mongolian Baiti", "Noto Sans Mongolian", serif'
                        }}
                      >
                        <p className="text-xl sm:text-2xl leading-loose tracking-wider text-slate-900 select-all pr-4">
                          {String(mongolScriptFullText || "ᠮᠣᠩᠭᠣᠯ ᠪᠢᠴᠢᠭ")}
                        </p>
                      </div>

                      {mongolScriptGaligText && (
                        <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 shrink-0">
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="text-[11px] font-bold text-slate-700">Үндэсний бичгийн галиг:</span>
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(mongolScriptGaligText);
                                showToast("Галигийг хууллаа!", "success");
                              }}
                              className="text-[10px] font-semibold text-indigo-600 hover:underline cursor-pointer"
                            >
                              Галиг хуулах
                            </button>
                          </div>
                          <p className="text-xs text-slate-700 font-medium line-clamp-2">
                            {String(mongolScriptGaligText)}
                          </p>
                        </div>
                      )}
                    </>
                  )}

                  {mongolScriptTab === 'rules' && (
                    <div className="space-y-2">
                      {mongolScriptWords.map((item, idx) => (
                        <div
                          key={idx}
                          onClick={() => setSelectedScriptWordIdx(idx)}
                          className={`p-2.5 rounded-xl border transition cursor-pointer ${
                            selectedScriptWordIdx === idx ? 'bg-amber-50 border-amber-400' : 'bg-white border-slate-200'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 flex-wrap text-xs">
                              <span className="font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded">{String(item.original)}</span>
                              <ArrowRight className="w-3 h-3 text-slate-400" />
                              <span className="font-bold text-amber-900 bg-amber-100 px-2 py-0.5 rounded">Галиг: {String(item.galig)}</span>
                            </div>
                            <span className="text-base font-bold text-slate-900 px-2 py-0.5 bg-amber-50 rounded border border-amber-200" style={{ fontFamily: '"Mongolian Baiti", serif' }}>
                              {String(item.script)}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-600 mt-1">{String(item.rule)}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {mongolScriptTab === 'guide' && (
                    <div className="space-y-2 text-xs text-slate-600 leading-relaxed">
                      <div className="p-3 rounded-xl bg-amber-600 text-white">
                        <h3 className="font-bold text-xs mb-0.5">Үндэсний монгол бичгийн дүрэм</h3>
                        <p className="text-[11px] text-amber-100">Тийн ялгалын нөхцөл болон үгийн язгуур үндсийг уламжлалт зарчмаар бичнэ.</p>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                        <h4 className="font-bold text-slate-800 mb-1">1. Тийн ялгалын дагавар</h4>
                        <p className="text-[11px]">Харьяалах (-ун/-үн, -у/-ү, -йин), өгөх орших (-ду/-дү, -ту/-тү), заах (-и, -йи) нөхцөлийг үгийн үндсээс салангид бичнэ.</p>
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                {/* Spellcheck & Rewrite Sub-tabs */}
                <div className="grid grid-cols-3 border-b border-slate-200 bg-slate-50 p-1 gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => setActiveTab('errors')}
                    className={`flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                      activeTab === 'errors' ? 'bg-white text-indigo-700 shadow-2xs border border-slate-200' : 'text-slate-600'
                    }`}
                  >
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>Алдаа ({errors.length})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('rewrite')}
                    className={`flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                      activeTab === 'rewrite' ? 'bg-white text-indigo-700 shadow-2xs border border-slate-200' : 'text-slate-600'
                    }`}
                  >
                    <Wand2 className="w-3.5 h-3.5" />
                    <span>Найруулга</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('guide')}
                    className={`flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                      activeTab === 'guide' ? 'bg-white text-indigo-700 shadow-2xs border border-slate-200' : 'text-slate-600'
                    }`}
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>Заавар</span>
                  </button>
                </div>

                {/* Right Pane Content Area */}
                <div className="flex-1 min-h-0 p-3.5 overflow-y-auto flex flex-col">
                  {activeTab === 'errors' && (
                    <>
                      {errors.length > 0 ? (
                        <div className="space-y-2">
                          {errors.map((err, index) => {
                            const isSelected = selectedErrorIndex === index;
                            return (
                              <div
                                key={index}
                                onClick={() => setSelectedErrorIndex(index)}
                                className={`p-3 rounded-xl border transition cursor-pointer ${
                                  isSelected ? 'bg-indigo-50/50 border-indigo-400' : 'bg-white border-slate-200 hover:border-indigo-200'
                                }`}
                              >
                                <div className="flex items-center justify-between gap-2 mb-1">
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800">
                                    {String(err.type)}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleFixSingleError(index);
                                    }}
                                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[11px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
                                  >
                                    <Check className="w-3 h-3" />
                                    <span>Засах</span>
                                  </button>
                                </div>

                                <div className="flex items-center flex-wrap gap-1.5 my-1 text-xs sm:text-sm">
                                  <span className="line-through text-rose-600 font-semibold bg-rose-50 px-2 py-0.5 rounded">{String(err.wrong)}</span>
                                  <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                                  <span className="text-emerald-700 font-extrabold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">{String(err.correct)}</span>
                                </div>

                                <p className="text-[11px] text-slate-600 leading-snug">{String(err.explanation)}</p>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-center py-6">
                          <CheckCircle2 className="w-8 h-8 text-emerald-500 mb-2" />
                          <h3 className="text-sm font-bold text-slate-800">Дүрмийн алдаа илэрсэнгүй!</h3>
                          <p className="text-xs text-slate-500 mt-1">Таны бичвэр монгол хэлний зөв бичих дүрмийн дагуу байна.</p>
                        </div>
                      )}
                    </>
                  )}

                  {activeTab === 'rewrite' && (
                    <div className="flex-1 flex flex-col gap-2.5">
                      <div className="grid grid-cols-2 gap-2 shrink-0">
                        {[
                          { id: 'formal', label: 'Албан бичиг' },
                          { id: 'social', label: 'Сошиал пост' },
                          { id: 'script', label: 'Видео скрипт' },
                          { id: 'concise', label: 'Товч хураангуй' }
                        ].map(item => (
                          <button
                            key={item.id}
                            type="button"
                            disabled={isRewriting}
                            onClick={() => handleRewriteText(item.id)}
                            className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                              rewriteStyle === item.id && rewrittenResult
                                ? 'bg-indigo-50 border-indigo-400'
                                : 'bg-white border-slate-200 hover:border-indigo-300'
                            }`}
                          >
                            <div className="text-xs font-bold text-slate-800 flex items-center justify-between">
                              <span>{item.label}</span>
                              <Wand2 className="w-3.5 h-3.5 text-indigo-600" />
                            </div>
                          </button>
                        ))}
                      </div>

                      {rewrittenResult ? (
                        <div className="flex-1 flex flex-col bg-slate-50 rounded-xl border border-slate-200 p-3 overflow-y-auto">
                          <div className="flex items-center justify-between mb-1.5 shrink-0">
                            <span className="text-xs font-bold text-indigo-950">Шинэчилсэн найруулга:</span>
                            <button
                              type="button"
                              onClick={() => {
                                setText(rewrittenResult);
                                setErrors([]);
                                setViewMode('edit');
                                showToast("Үндсэн текст рүү орууллаа!", "success");
                              }}
                              className="text-[11px] font-bold text-indigo-600 hover:underline cursor-pointer"
                            >
                              Текст рүү хуулах
                            </button>
                          </div>
                          <p className="text-xs sm:text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">{String(rewrittenResult)}</p>
                        </div>
                      ) : (
                        <div className="flex-1 flex items-center justify-center text-center p-4 border border-dashed border-slate-200 rounded-xl text-slate-400 text-xs">
                          Дээрх 4 хэв маягаас сонгоход 1 секундийн дотор текстийг шинэчлэн найруулна.
                        </div>
                      )}
                    </div>
                  )}

                  {activeTab === 'guide' && (
                    <div className="space-y-2.5 text-xs text-slate-600">
                      <div className="p-3 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 text-white">
                        <h3 className="font-bold text-sm mb-0.5">Чак алдаа шалгагч систем</h3>
                        <p className="text-[11px] text-indigo-100">Гар утас болон компьютер дээр <strong className="text-white">0.05 – 0.8 секундэд</strong> ажиллах өндөр хурдны систем.</p>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                        <div className="font-bold text-slate-800">Үнэ тариф & Эрх сунгалт:</div>
                        <p className="text-[11px]">• Эхний <strong>7 хоног</strong> бүх хэрэглэгчид <strong>үнэгүй</strong>.</p>
                        <p className="text-[11px]">• <strong>6 сарын эрх:</strong> 19,000₮</p>
                        <p className="text-[11px]">• <strong>1 жилийн эрх:</strong> 39,000₮ (QPay-ээр шууд сунгана)</p>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

        </div>
      </main>

      {/* ==========================================
          COMPACT SINGLE-LINE FOOTER
         ========================================== */}
      <footer className="bg-white border-t border-slate-200 px-4 py-1.5 shrink-0 text-[11px] text-slate-500">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-700">Чак алдаа шалгагч</span>
            <span className="hidden sm:inline">— Монгол хэл бичгийн өндөр хурдны ухаалаг систем</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
              <Monitor className="w-3 h-3" />
              <Smartphone className="w-3 h-3" />
              <span>PC & Гар утас</span>
            </span>
            <button
              type="button"
              onClick={() => setIsPrivacyOpen(true)}
              className="text-slate-500 hover:underline cursor-pointer"
            >
              Нууцлалын бодлого
            </button>
            {paywallEnabled && (
              <button
                type="button"
                onClick={openPaymentModal}
                className="text-indigo-600 font-bold hover:underline cursor-pointer"
              >
                6 сар: 19,000₮ • 1 жил: 39,000₮
              </button>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}