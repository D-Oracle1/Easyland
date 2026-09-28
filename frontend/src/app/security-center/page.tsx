'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ShieldCheck, ArrowLeft, ShieldX } from 'lucide-react';
import { getUser } from '@/lib/auth-storage';
import { isSocOwner } from '@/lib/security/owner';
import { SocDashboard } from '@/components/security/soc-dashboard';

/**
 * Standalone, full-screen Security Operations Center.
 *
 * Rendered OUTSIDE the dashboard shell (no Easyland sidebar/header) for an
 * independent, focused view. Access is restricted to the SOC owner account;
 * everyone else sees an access-denied screen.
 */
export default function SecurityCenterPage() {
  const [state, setState] = useState<'checking' | 'granted' | 'denied'>('checking');

  useEffect(() => {
    const user = getUser();
    setState(isSocOwner(user?.email) ? 'granted' : 'denied');
  }, []);

  if (state === 'checking') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#05070d] text-slate-400">
        <div className="flex items-center gap-2 text-sm">
          <ShieldCheck className="h-4 w-4 animate-pulse" /> Verifying access…
        </div>
      </div>
    );
  }

  if (state === 'denied') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#05070d] px-6 text-center text-slate-200">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-500/10 ring-1 ring-red-500/40">
          <ShieldX className="h-7 w-7 text-red-400" />
        </div>
        <div>
          <h1 className="text-lg font-semibold">Access restricted</h1>
          <p className="mt-1 max-w-sm text-sm text-slate-400">
            The Security Operations Center is private to its owner account. Your account does not
            have access.
          </p>
        </div>
        <Link
          href="/dashboard/admin"
          className="flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm text-slate-200 hover:bg-white/10"
        >
          <ArrowLeft className="h-4 w-4" /> Back to dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#05070d]">
      {/* Slim standalone top bar (replaces the app header/sidebar) */}
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 md:px-6">
        <div className="flex items-center gap-2 text-sm font-semibold tracking-tight text-slate-100">
          <ShieldCheck className="h-5 w-5 text-emerald-400" />
          EASYLAND SOC
        </div>
        <Link
          href="/dashboard/admin"
          className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300 hover:bg-white/10"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Exit to dashboard
        </Link>
      </div>

      <div className="p-3 md:p-5">
        <SocDashboard />
      </div>
    </div>
  );
}
