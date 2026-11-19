import React, { useState } from 'react';
import { ArrowRight, HardHat, ShieldCheck, Timer, UserCheck } from 'lucide-react';
import type { EmployeeSession, ShiftType } from '../types/fit2shift';

interface LoginScreenProps {
  onLogin: (session: EmployeeSession) => void;
}

const DEPARTMENTS = [
  'ควบคุมเครื่องจักรกลหนัก',
  'งานไฟฟ้าแรงสูงและซ่อมบำรุง',
  'ปฏิบัติงานบนที่สูง / ปั้นจั่น',
  'คลังวัตถุอันตราย / โลจิสติกส์',
  'ห้องควบคุมกระบวนการผลิต',
];

const SHIFTS: ShiftType[] = [
  'กะเช้า (06:00–14:00)',
  'กะบ่าย (14:00–22:00)',
  'กะดึก (22:00–06:00)',
];

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const [employeeId, setEmployeeId] = useState('');
  const [employeeName, setEmployeeName] = useState('');
  const [department, setDepartment] = useState(DEPARTMENTS[0]);
  const [shift, setShift] = useState<ShiftType>('กะเช้า (06:00–14:00)');
  const [error, setError] = useState('');
  const [imgFailed, setImgFailed] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanedId = employeeId.trim().toUpperCase();
    if (cleanedId.length < 3) {
      setError('กรุณากรอกรหัสพนักงานอย่างน้อย 3 ตัวอักษร (เช่น EMP-1042)');
      return;
    }
    setError('');
    onLogin({
      employeeId: cleanedId,
      employeeName: employeeName.trim() || `พนักงาน ${cleanedId}`,
      department,
      shift,
      loginAt: new Date().toISOString(),
    });
  };

  return (
    <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:py-12">
      <div className="grid grid-cols-1 items-stretch gap-8 lg:grid-cols-12">
        {/* Left: High-Contrast Employee ID Login Form */}
        <div className="flex flex-col justify-between rounded-2xl border-2 border-slate-900 bg-white p-6 sm:p-8 lg:col-span-7">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-slate-700">
              <span>ระบบคัดกรองความพร้อมก่อนเข้ากะ</span>
              <span aria-hidden="true" className="text-slate-400">·</span>
              <span>มาตรฐานความปลอดภัยพื้นที่เสี่ยงสูง</span>
            </div>

            <h1 className="mt-3 font-display text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl text-balance">
              ลงชื่อเข้าใช้ด้วยรหัสพนักงาน เพื่อเริ่มประเมินใน 30 วินาที
            </h1>
            <p className="mt-2.5 max-w-2xl text-base leading-relaxed text-slate-700">
              กรอกรหัสพนักงานและเลือกกะการทำงานของคุณ เพื่อตรวจสอบความเร็วปฏิกิริยา ชั่วโมงการนอนหลับ และสถานะความปลอดภัยก่อนปฏิบัติงาน
            </p>

            <form onSubmit={handleSubmit} className="mt-7 space-y-5" noValidate>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="employee-id"
                    className="block text-sm font-bold text-slate-900"
                  >
                    รหัสพนักงาน <span className="text-[#d94848]">*</span>
                  </label>
                  <input
                    id="employee-id"
                    type="text"
                    inputMode="text"
                    autoComplete="username"
                    placeholder="เช่น EMP-4082"
                    value={employeeId}
                    onChange={(e) => {
                      setEmployeeId(e.target.value.toUpperCase());
                      if (error) setError('');
                    }}
                    className="mt-2 block h-13 w-full rounded-xl border-2 border-slate-900 bg-[#EAFFD0]/45 px-4 font-mono text-lg font-bold tracking-wide text-slate-950 placeholder:font-sans placeholder:text-sm placeholder:font-normal placeholder:text-slate-500 focus:border-[#F38181] focus:bg-white focus:outline-none"
                  />
                </div>

                <div>
                  <label
                    htmlFor="employee-name"
                    className="block text-sm font-bold text-slate-900"
                  >
                    ชื่อ-นามสกุลพนักงาน (ถ้ามี)
                  </label>
                  <input
                    id="employee-name"
                    type="text"
                    placeholder="เช่น สมชาย ใจดี"
                    value={employeeName}
                    onChange={(e) => setEmployeeName(e.target.value)}
                    className="mt-2 block h-13 w-full rounded-xl border-2 border-slate-900 bg-[#EAFFD0]/45 px-4 text-base font-medium text-slate-950 placeholder:text-sm placeholder:text-slate-500 focus:border-[#F38181] focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="department-select"
                  className="block text-sm font-bold text-slate-900"
                >
                  แผนก / พื้นที่ปฏิบัติงานเสี่ยงสูง
                </label>
                <select
                  id="department-select"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="mt-2 block h-13 w-full rounded-xl border-2 border-slate-900 bg-[#EAFFD0]/45 px-4 text-base font-semibold text-slate-950 focus:border-[#F38181] focus:bg-white focus:outline-none"
                >
                  {DEPARTMENTS.map((dept) => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <span className="block text-sm font-bold text-slate-900">
                  เลือกกะการทำงาน
                </span>
                <div className="mt-2 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                  {SHIFTS.map((item) => {
                    const active = shift === item;
                    return (
                      <button
                        key={item}
                        type="button"
                        onClick={() => setShift(item)}
                        className={`min-h-[48px] rounded-xl border-2 px-3 py-2.5 text-sm font-bold transition-colors whitespace-nowrap ${
                          active
                            ? 'border-slate-950 bg-[#FCE38A] text-slate-950'
                            : 'border-slate-900/30 bg-[#95E1D3]/30 text-slate-900 hover:border-slate-900 hover:bg-[#95E1D3]/60'
                        }`}
                      >
                        {item}
                      </button>
                    );
                  })}
                </div>
              </div>

              {error && (
                <div
                  role="alert"
                  className="rounded-xl border-2 border-slate-950 bg-[#F38181] px-4 py-3 text-sm font-bold text-slate-950"
                >
                  {error}
                </div>
              )}

              <div className="pt-2">
                <button
                  type="submit"
                  className="flex min-h-[56px] w-full items-center justify-center gap-3 rounded-xl border-2 border-slate-950 bg-[#FCE38A] px-6 py-3.5 text-base font-extrabold text-slate-950 transition-colors hover:bg-[#95E1D3] focus-visible:outline-3 focus-visible:outline-[#F38181]"
                >
                  <UserCheck className="h-5 w-5 stroke-[2.5]" />
                  <span>เริ่มประเมินความพร้อม 30 วินาที</span>
                  <ArrowRight className="h-5 w-5 stroke-[2.5]" />
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Right: Industrial Safety Protocol Visual Panel */}
        <div className="relative flex flex-col justify-end overflow-hidden rounded-2xl border-2 border-slate-900 bg-[#95E1D3] min-h-[360px] lg:col-span-5">
          {!imgFailed ? (
            <img
              src="/src/assets/images/industrial_safety_shift_1795085425668.jpg"
              alt="หัวหน้างานความปลอดภัยในโรงงานอุตสาหกรรมตรวจสอบความพร้อมก่อนเข้ากะ"
              referrerPolicy="no-referrer"
              onError={() => setImgFailed(true)}
              className="absolute inset-0 h-full w-full object-cover object-center"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[#95E1D3] via-[#EAFFD0] to-[#FCE38A]">
              <HardHat className="h-24 w-24 text-slate-900/30" />
            </div>
          )}

          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-t from-slate-950/95 via-slate-950/75 to-slate-950/15"
          />

          <div className="relative z-10 p-6 sm:p-8">
            <h2 className="font-display text-2xl font-bold text-white">
              ขั้นตอนตรวจความพร้อมหน้างาน
            </h2>
            <div className="mt-4 space-y-3.5 text-sm text-slate-100">
              <div className="flex items-start gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-slate-950 bg-[#FCE38A] font-mono text-xs font-bold text-slate-950">
                  01
                </span>
                <p className="leading-snug">
                  <strong className="text-[#FCE38A]">ทดสอบปฏิกิริยาตอบสนอง 3 รอบ:</strong>{' '}
                  วัดความตื่นตัวของระบบประสาทด้วยสัญญาณไฟระดับมิลลิวินาที
                </p>
              </div>
              <div className="flex items-start gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-slate-950 bg-[#95E1D3] font-mono text-xs font-bold text-slate-950">
                  02
                </span>
                <p className="leading-snug">
                  <strong className="text-[#95E1D3]">ระบุชั่วโมงการนอนหลับ:</strong>{' '}
                  เลื่อนแถบวัดเวลาพักผ่อนและยืนยันความพร้อมด้านอาการทางกาย
                </p>
              </div>
              <div className="flex items-start gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-slate-950 bg-[#EAFFD0] font-mono text-xs font-bold text-slate-950">
                  03
                </span>
                <p className="leading-snug">
                  <strong className="text-[#EAFFD0]">รับสถานะผ่าน/ไม่ผ่านทันที:</strong>{' '}
                  คำนวณคะแนนความเหนื่อยล้าและบันทึกข้อมูลอัตโนมัติ
                </p>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-4 border-t border-slate-700/80 pt-4 text-xs font-semibold text-slate-200">
              <span className="inline-flex items-center gap-1.5">
                <Timer className="h-4 w-4 text-[#FCE38A]" />
                ใช้เวลาเฉลี่ย ≤ 30 วินาที
              </span>
              <span aria-hidden="true" className="text-slate-500">·</span>
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-[#95E1D3]" />
                บันทึกข้อมูลอัตโนมัติในแบ็กเอนด์
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
