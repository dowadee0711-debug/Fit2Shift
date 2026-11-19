import React from 'react';
import { LogOut, ShieldAlert } from 'lucide-react';
import type { EmployeeSession } from '../types/fit2shift';

interface TopNavProps {
  session: EmployeeSession | null;
  onLogoutEmployee: () => void;
}

export const TopNav: React.FC<TopNavProps> = ({
  session,
  onLogoutEmployee,
}) => {
  return (
    <header className="sticky top-0 z-30 border-b-2 border-slate-900 bg-[#95E1D3]">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-8 px-4 py-3 sm:px-6">
        {/* Zone 1: Single-line Brand Wordmark */}
        <div className="flex items-center gap-2.5 whitespace-nowrap shrink-0">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg border-2 border-slate-950 bg-[#FCE38A] text-slate-950">
            <ShieldAlert className="h-5 w-5 stroke-[2.5]" />
          </span>
          <span className="font-display text-xl font-extrabold tracking-tight text-slate-950 whitespace-nowrap shrink-0">
            Fit2Shift
          </span>
        </div>

        {/* Zone 3: Employee Switch Action */}
        {session ? (
          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={onLogoutEmployee}
              className="inline-flex min-h-[40px] items-center gap-2 rounded-xl border-2 border-slate-950 bg-[#FCE38A] px-4 py-2 text-xs font-extrabold text-slate-950 transition-colors hover:bg-[#EAFFD0] whitespace-nowrap shrink-0"
            >
              <LogOut className="h-4 w-4" />
              <span>เปลี่ยนพนักงาน ({session.employeeId})</span>
            </button>
          </div>
        ) : null}
      </div>
    </header>
  );
};
