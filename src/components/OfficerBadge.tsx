import React, { useEffect, useState } from 'react';
import { LogOut } from 'lucide-react';
import { clearSession, getOfficer, officerLabel, subscribeAccessToken } from '../services/accessToken';

/** Header badge for the signed-in officer ("RANK Name [Badge] • District") with a LOGOUT button. */
export const OfficerBadge: React.FC = () => {
  const [officer, setOfficer] = useState(getOfficer());
  useEffect(() => subscribeAccessToken(() => setOfficer(getOfficer())), []);
  if (!officer) return null;

  const logout = () => {
    clearSession();
    window.location.reload();
  };

  return (
    <div className="flex items-center gap-1.5 shrink-0">
      <div
        className="hidden lg:flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 text-[10px] font-mono whitespace-nowrap max-w-[340px]"
        title={`${officerLabel(officer)} · ${officer.policeStation}`}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
        <span className="truncate">
          <span className="text-[#00E5FF]">{officer.rank}</span> {officer.fullName} [{officer.badgeNumber}] • {officer.district}
        </span>
      </div>
      <button
        type="button"
        onClick={logout}
        title="Log out of this browser"
        className="flex items-center gap-1 px-2 py-0.5 rounded-md border border-white/10 text-slate-400 hover:text-rose-300 hover:border-rose-500/40 text-[10px] font-mono"
      >
        <LogOut className="w-3 h-3" aria-hidden />
        LOGOUT
      </button>
    </div>
  );
};
