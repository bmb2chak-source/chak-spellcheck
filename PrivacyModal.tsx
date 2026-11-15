import React from 'react';
import { X, Lock } from 'lucide-react';

// ЗАГВАР: Хуульчаар хянуулж, өөрийн мэдээллээр (эзэмшигчийн нэр, холбоо барих) засна уу.
const OWNER_NAME = 'Чак алдаа шалгагч';
const CONTACT_PHONE = '88058809';
const UPDATED_AT = '2026 оны 10-р сар';

const Section = ({ title, children }) => (
  <section className="space-y-1">
    <h3 className="text-[13px] font-bold text-slate-900">{title}</h3>
    <div className="text-[12px] text-slate-700 leading-relaxed space-y-1">{children}</div>
  </section>
);

export default function PrivacyModal({ onClose }) {
  return (
    <div className="fixed inset-0 z-[60] bg-slate-900/75 flex items-center justify-center p-3">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90dvh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4" />
            <h2 className="text-sm font-extrabold">Нууцлалын бодлого</h2>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 overflow-y-auto space-y-4">
          <p className="text-[12px] text-slate-500">Сүүлд шинэчилсэн: {UPDATED_AT}</p>
          <p className="text-[12px] text-slate-700 leading-relaxed">
            "{OWNER_NAME}" (цаашид "бид") нь Хүний хувийн мэдээлэл хамгаалах тухай хуулийн дагуу таны хувийн мэдээллийг
            хэрхэн цуглуулж, ашиглаж, хамгаалдгийг энэхүү бодлогоор тайлбарлана.
          </p>
          <Section title="1. Бидний цуглуулах мэдээлэл">
            <p>• <strong>Google бүртгэлийн мэдээлэл:</strong> нэр, имэйл хаяг, Google-ийн хэрэглэгчийн дугаар (нэвтрэх үед).</p>
            <p>• <strong>Эрх, төлбөрийн мэдээлэл:</strong> сонгосон багц, төлсөн дүн, огноо, QPay-ийн гүйлгээ/нэхэмжлэхийн дугаар. Таны банкны карт, дансны мэдээллийг бид авдаггүй, хадгалдаггүй.</p>
            <p>• <strong>Хэрэглээний мэдээлэл:</strong> өдөрт AI функц ашигласан тоо.</p>
            <p>• <strong>Таны шалгуулсан текст</strong>-ийг бид хадгалдаггүй. AI шалгалт хийхэд тухайн текстийг зөвхөн боловсруулах зорилгоор Google Gemini үйлчилгээ рүү илгээнэ.</p>
          </Section>
          <Section title="2. Ашиглах зорилго">
            <p>Таныг таних, үнэгүй туршилт болон төлбөртэй эрхийг тооцох, төлбөр баталгаажуулах, хэрэглээний хязгаарыг хэрэгжүүлэх, татвар, нягтлан бодох бүртгэлийн хууль ёсны үүргээ биелүүлэх.</p>
          </Section>
          <Section title="3. Гуравдагч этгээд">
            <p>Үйлчилгээ үзүүлэхэд дараах байгууллагын үйлчилгээг ашигладаг: Google (Firebase нэвтрэлт, өгөгдлийн сан; Gemini AI), QPay (төлбөр), Vercel (вэб байршуулалт). Эдгээр үйлчилгээний сервер Монгол Улсаас гадна байрлаж болно. Бид таны мэдээллийг зар сурталчилгааны зорилгоор худалдахгүй, дамжуулахгүй.</p>
          </Section>
          <Section title="4. Хадгалах хугацаа">
            <p>Бүртгэлийн мэдээллийг таны бүртгэл идэвхтэй байх хугацаанд, төлбөрийн бүртгэлийг хуульд заасан хугацаанд хадгална. Өдрийн хэрэглээний тоолуурыг богино хугацаанд хадгална.</p>
          </Section>
          <Section title="5. Таны эрх">
            <p>Та өөрийн мэдээллийг үзэх, засуулах, устгуулах, зөвшөөрлөө цуцлах эрхтэй. Хүсэлтээ доорх холбоо барих хаягаар илгээнэ үү. Бүртгэлээ устгуулбал төлбөртэй эрх хүчингүй болохыг анхаарна уу.</p>
          </Section>
          <Section title="6. Холбоо барих">
            <p>Утас: {CONTACT_PHONE}</p>
          </Section>
        </div>
      </div>
    </div>
  );
}
