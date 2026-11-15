# Чак алдаа шалгагч — Сайтаа нийтлэх заавар (v3: Google нэвтрэлт + өгөгдлийн сан + QPay)

**Ажиллах зарчим**
- **Firebase эсвэл QPay тохируулаагүй үед** сайт бүх хүнд **үнэгүй, нэвтрэлтгүй** ажиллана.
- **Хоёуланг нь тохируулмагц** автоматаар:
  1. Хэрэглэгч **Google-ээр нэвтэрнэ** → **7 хоног үнэгүй** (бүртгэлд холбогдох тул хөтөч цэвэрлээд дахин авах боломжгүй).
  2. Дараа нь 6 сар (19,000₮) / 1 жил (39,000₮) багцыг **QPay QR**-аар төлнө → эрх **автоматаар** идэвхжинэ. Дахин төлбөл үлдсэн эрх дээр нэмэгдэнэ.
  3. Эрх Google бүртгэлд хадгалагдах тул утас, компьютер аль алинаас ашиглана.
  4. **Өдрийн AI хязгаар** (туршилт 20, төлсөн 300 удаа — өөрчилж болно) таны Gemini зардлыг хамгаална.
  5. **Админ самбар**: орлого, төлбөрүүд, шинэ хэрэглэгчид, гараар эрх өгөх.

## Төслийн бүтэц

| Файл | Үүрэг |
|---|---|
| `src/App.tsx` | Таны сайт |
| `src/lib/firebaseClient.ts` | Google нэвтрэлт (хөтөч тал) |
| `src/components/LoginModal.tsx` | Нэвтрэх цонх (Facebook/Messenger доторх хөтөчийн анхааруулгатай) |
| `src/components/AdminModal.tsx` | Админ самбар |
| `src/components/PrivacyModal.tsx` | **Нууцлалын бодлого — ЗАГВАР, хуульчаар хянуулж засна уу** |
| `api/me.js` | Хэрэглэгчийн эрх, өнөөдрийн хэрэглээ |
| `api/gemini.js` | Gemini (түлхүүр нууц). Нэвтрэлт, эрх, өдрийн хязгаарыг шалгана |
| `api/qpay/*.js` | QPay нэхэмжлэх үүсгэх, төлбөр шалгах, callback |
| `api/admin/*.js` | Админ статистик, гараар эрх өгөх |
| `api/_lib/plans.js` | **Үнэ, хугацаа, хязгаар** (үнэ өөрчлөх бол `src/App.tsx`-ийн `SUBSCRIPTION_PLANS`-ийг ч засна) |
| `firestore.rules` | Өгөгдлийн санд хөтөчөөс шууд хандахыг бүрэн хаана |

**Өгөгдлийн сан (Firestore):** `users` (эрх), `payments` (төлбөр бүр), `usage` (өдрийн хэрэглээ).

---

## 1-р алхам. Gemini API түлхүүр
1. https://aistudio.google.com/apikey → **Create API key**.
2. Google Cloud дээр **billing** идэвхжүүлж, **Budget alert** (жишээ нь сард $10) тавина.
3. (Зөвлөмж) Google Cloud → **APIs & Services → Generative Language API → Quotas** хэсэгт өдрийн хүсэлтийн дээд хязгаар тавина.

## 2-р алхам. Firebase төсөл
1. https://console.firebase.google.com → **Add project** (Analytics хэрэггүй).
2. **Build → Authentication → Get started → Sign-in method → Google → Enable** → дэмжлэгийн имэйлээ сонгоод **Save**.
3. **Build → Firestore Database → Create database** → байршил (жишээ `asia-east2` эсвэл `asia-northeast1`) → **Production mode**.
4. Firestore → **Rules** → `firestore.rules` файлын агуулгыг хуулж тавиад **Publish**.
5. ⚙️ **Project settings → General → Your apps → `</>` (Web)** → апп бүртгэнэ → `firebaseConfig`-ийн `apiKey`, `authDomain`, `projectId`, `appId`-г хадгална.
6. ⚙️ **Project settings → Service accounts → Generate new private key** → JSON файл татагдана.
   > ⚠️ Энэ файл бол **серверийн мастер түлхүүр**. GitHub-д хэзээ ч бүү оруул, хэнд ч бүү өг. Зөвхөн Vercel-д хийнэ.

## 3-р алхам. GitHub руу байршуулах
1. https://github.com → **New repository** → нэр: `chak-spellcheck` → **Private** (хувийн бүртгэл дээрээ).
2. **uploading an existing file** → энэ хавтасны **доторх** бүх файл, хавтсыг чирж оруулна → **Commit changes**.

## 4-р алхам. Vercel дээр deploy
1. https://vercel.com → **Continue with GitHub** → **Add New → Project** → репогоо **Import** (Framework: Vite).
2. **Environment Variables** (`.env.example`-ийг харна уу):

   | Name | Value |
   |---|---|
   | `GEMINI_API_KEY` | 1-р алхам |
   | `VITE_FIREBASE_API_KEY` | firebaseConfig.apiKey |
   | `VITE_FIREBASE_AUTH_DOMAIN` | firebaseConfig.authDomain |
   | `VITE_FIREBASE_PROJECT_ID` | firebaseConfig.projectId |
   | `VITE_FIREBASE_APP_ID` | firebaseConfig.appId |
   | `FIREBASE_SERVICE_ACCOUNT` | 2-6-р алхмын JSON файлыг Notepad-аар нээгээд **бүх агуулгыг** хуулж тавина |
   | `ADMIN_EMAILS` | Таны Gmail (жишээ `khulan@gmail.com`) |

3. **Deploy**. QPay-гүй тул одоогоор сайт **үнэгүй горимоор** ажиллана.
4. Firebase → **Authentication → Settings → Authorized domains → Add domain** → `таны-төсөл.vercel.app` (дараа нь өөрийн домэйноо ч) нэмнэ. **Үүнгүйгээр Google нэвтрэлт ажиллахгүй.**

> ⚠️ Төлбөр авч эхэлбэл арилжааны хэрэглээ тул Vercel-ийн **Pro** багц шаардлагатай.

## 5-р алхам. QPay холбох (төлбөр авч эхлэх)
1. QPay-тэй **merchant гэрээ** байгуулна (https://qpay.mn). Тэд **client_id**, **client_secret**, **invoice_code** олгоно.
2. Vercel → **Settings → Environment Variables**: `QPAY_CLIENT_ID`, `QPAY_CLIENT_SECRET`, `QPAY_INVOICE_CODE` нэмнэ. (Туршилтын орчинд QPay-ийн өгсөн sandbox хаягийг `QPAY_BASE_URL`-д.)
3. **Deployments → ⋯ → Redeploy**. Одоо "Google-ээр нэвтрэх" товч гарч, бүх систем асна.
4. **Туршиж үзэх:** өөр Gmail-ээр нэвтэрч хамгийн бага багцыг өөрөө төлөөд эрх идэвхжиж, админ самбарт төлбөр харагдаж байгааг шалгана.

## 6-р алхам. Домэйн
- Vercel → **Settings → Domains** → домэйн худалдаж авах эсвэл `.mn` домэйноо **Add** хийж Vercel-ийн харуулсан DNS бичлэгийг бүртгэгчдээ оруулна.
- Шинэ домэйноо Firebase → **Authorized domains**-д заавал нэмнэ.

---

## Админ самбар
Таны Gmail `ADMIN_EMAILS`-д байвал нэвтэрсний дараа баруун дээд буланд байх **зураг (аватар) → Админ самбар**.
- **Сүүлийн төлбөрүүд**, **энэ сарын / нийт орлого** (татварын тайланд хэрэгтэй)
- **Шинэ хэрэглэгчид** ба тэдний төлөв
- **Гараар эрх өгөх**: бэлнээр төлсөн, урамшуулал, буцаалт (хасах тоогоор) — хэрэглэгч сайтад нэг удаа нэвтэрсэн байх ёстой

## Анхаарах зүйлс
- **Facebook / Messenger-ээр** линк нээсэн хүмүүст Google нэвтрэлт ажилладаггүй (Google-ийн хориг). Сайт тэдэнд "Open in browser" дарахыг зааж өгнө.
- **Нууцлалын бодлого** (`src/components/PrivacyModal.tsx`) нь загвар. Хүний хувийн мэдээлэл хамгаалах тухай хуулийн дагуу хуульчаар хянуулж, эзэмшигчийн нэр, холбоо барих мэдээллээ оруулна уу.
- AI-гүй дүрмийн функцууд хөтөч дотор ажилладаг тул техникийн мэдлэгтэй хүн тойрч болно. Харин AI (зардал гардаг хэсэг) сервер талдаа бүрэн хамгаалагдсан.
- Firebase-ийн үнэгүй (Spark) багцын өдрийн хязгаар жижиг, дунд сайтад хангалттай. Хэрэглэгч олширвол Firebase Console → Usage хэсгийг хянана.

## Цаашид шинэчлэх
GitHub дээрх файлаа засах бүрт Vercel автоматаар дахин deploy хийнэ.

## Асуудал гарвал

| Шинж тэмдэг | Шийдэл |
|---|---|
| Google нэвтрэх товч алга | `VITE_FIREBASE_*`, `FIREBASE_SERVICE_ACCOUNT`, `QPAY_*` бүгд байгаа эсэхийг шалгаад **Redeploy** |
| Нэвтрэх үед `auth/unauthorized-domain` | Firebase → Authentication → Settings → **Authorized domains**-д домэйноо нэмнэ |
| "Серверийн алдаа" / 500 | `FIREBASE_SERVICE_ACCOUNT` буруу хуулагдсан (JSON бүтэн `{`-ээр эхэлж `}`-ээр төгсөх ёстой). Vercel → **Logs** |
| QR үүсэхгүй | QPay түлхүүрүүд буруу эсвэл sandbox/production хаяг зөрсөн. Vercel → **Logs**-оос `QPay error` |
| Төлсөн ч эрх идэвхжихгүй | "Төлбөр шалгах" дарна. Болохгүй бол админ самбараас **гараар эрх өгөх** |
| Админ самбар харагдахгүй | `ADMIN_EMAILS`-д яг нэвтэрсэн Gmail-ээ бичээд Redeploy |
| AI үр дүн нэмэгдэхгүй | `GEMINI_API_KEY` эсвэл квот. Өдрийн хязгаар дууссан бол маргааш шинэчлэгдэнэ |
