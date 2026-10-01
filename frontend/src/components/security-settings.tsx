'use client';

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { toast } from 'sonner';
import { Copy, Download, KeyRound, Loader2, Shield, ShieldCheck, ShieldOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';

// Mirrors backend ChangePasswordDto
const PASSWORD_RULE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/;

const errorText = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong');

function ChangePassword() {
  const [form, setForm] = useState({ current: '', next: '', confirm: '' });
  const [saving, setSaving] = useState(false);

  const problem =
    form.next && form.next.length < 8
      ? 'At least 8 characters'
      : form.next && !PASSWORD_RULE.test(form.next)
        ? 'Use upper and lower case letters, a number and one of @$!%*?&'
        : form.confirm && form.next !== form.confirm
          ? 'Passwords do not match'
          : '';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.current || !form.next || problem) return;
    setSaving(true);
    try {
      await api.post('/auth/change-password', { currentPassword: form.current, newPassword: form.next });
      toast.success('Password updated');
      setForm({ current: '', next: '', confirm: '' });
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <h3 className="font-semibold">Change password</h3>
        <p className="text-sm text-muted-foreground">Use a strong password you don&apos;t use anywhere else.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Input type="password" autoComplete="current-password" placeholder="Current password" value={form.current}
          onChange={(e) => setForm({ ...form, current: e.target.value })} />
        <Input type="password" autoComplete="new-password" placeholder="New password" value={form.next}
          onChange={(e) => setForm({ ...form, next: e.target.value })} />
        <Input type="password" autoComplete="new-password" placeholder="Confirm new password" value={form.confirm}
          onChange={(e) => setForm({ ...form, confirm: e.target.value })} />
      </div>
      {problem && <p className="text-sm text-destructive">{problem}</p>}
      <Button type="submit" disabled={saving || !form.current || !form.next || !form.confirm || !!problem}>
        {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Shield className="mr-2 h-4 w-4" />}
        Update password
      </Button>
    </form>
  );
}

function BackupCodes({ codes }: { codes: string[] }) {
  const text = codes.join('\n');
  return (
    <div className="space-y-3 rounded-xl border border-amber-300/60 bg-amber-50 p-4 dark:border-amber-500/30 dark:bg-amber-500/10">
      <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
        Save these backup codes somewhere safe. Each one works once if you lose access to your authenticator app.
      </p>
      <div className="grid grid-cols-2 gap-2 font-mono text-sm sm:grid-cols-4">
        {codes.map((c) => <span key={c} className="rounded-lg bg-white px-2 py-1 text-center dark:bg-gray-900">{c}</span>)}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(text); toast.success('Copied'); }}>
          <Copy className="mr-2 h-4 w-4" /> Copy
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => {
          const url = URL.createObjectURL(new Blob([text + '\n'], { type: 'text/plain' }));
          const a = document.createElement('a'); a.href = url; a.download = 'backup-codes.txt'; a.click(); URL.revokeObjectURL(url);
        }}>
          <Download className="mr-2 h-4 w-4" /> Download
        </Button>
      </div>
    </div>
  );
}

function TwoFactor() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [setup, setSetup] = useState<{ secret: string; qr: string } | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [freshCodes, setFreshCodes] = useState<string[] | null>(null);
  const [mode, setMode] = useState<'idle' | 'disable' | 'regenerate'>('idle');

  useEffect(() => {
    api.get('/auth/2fa/status')
      .then((r: any) => setEnabled(!!(r?.data ?? r)?.enabled))
      .catch(() => setEnabled(false));
  }, []);

  const startSetup = async () => {
    setBusy(true);
    try {
      const r: any = await api.post('/auth/2fa/setup');
      const d = r?.data ?? r;
      const qr = await QRCode.toDataURL(d.qrCodeUrl, { width: 200, margin: 1 });
      setSetup({ secret: d.secret, qr });
      setCode('');
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const confirm = async (action: 'enable' | 'disable' | 'regenerate') => {
    if (!/^\d{6}$/.test(code)) { toast.error('Enter the 6-digit code from your authenticator app'); return; }
    setBusy(true);
    try {
      const path = action === 'regenerate' ? '/auth/2fa/regenerate-backup-codes' : `/auth/2fa/${action}`;
      const r: any = await api.post(path, { code });
      const d = r?.data ?? r;
      if (action === 'enable') { setEnabled(true); setSetup(null); setFreshCodes(d.backupCodes || null); toast.success('Two-factor authentication is on'); }
      if (action === 'disable') { setEnabled(false); setFreshCodes(null); toast.success('Two-factor authentication is off'); }
      if (action === 'regenerate') { setFreshCodes(d.backupCodes || null); toast.success('New backup codes created'); }
      setMode('idle');
      setCode('');
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const codeInput = (
    <Input inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="6-digit code" value={code}
      onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} className="w-40 font-mono tracking-widest" />
  );

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="flex items-center gap-2 font-semibold">
            Two-factor authentication
            {enabled && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">On</span>}
          </h3>
          <p className="text-sm text-muted-foreground">
            Require a code from an authenticator app (Google Authenticator, Authy, Microsoft Authenticator) when you sign in.
          </p>
        </div>
        {enabled === null ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /> : !enabled && !setup && (
          <Button onClick={startSetup} disabled={busy}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />} Set up
          </Button>
        )}
      </div>

      {setup && (
        <div className="flex flex-col gap-5 rounded-xl border p-4 sm:flex-row">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={setup.qr} alt="Scan with your authenticator app" className="h-[200px] w-[200px] rounded-lg border bg-white p-1" />
          <div className="space-y-3 text-sm">
            <p><strong>1.</strong> Scan the QR code with your authenticator app.</p>
            <p className="text-muted-foreground">Can&apos;t scan? Enter this key manually: <code className="break-all rounded bg-muted px-1.5 py-0.5 font-mono">{setup.secret}</code></p>
            <p><strong>2.</strong> Enter the 6-digit code it shows to finish.</p>
            <div className="flex flex-wrap gap-2">
              {codeInput}
              <Button onClick={() => confirm('enable')} disabled={busy}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Turn on</Button>
              <Button variant="ghost" onClick={() => setSetup(null)} disabled={busy}>Cancel</Button>
            </div>
          </div>
        </div>
      )}

      {enabled && mode === 'idle' && (
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => { setMode('regenerate'); setCode(''); }}><KeyRound className="mr-2 h-4 w-4" /> New backup codes</Button>
          <Button variant="outline" className="text-destructive" onClick={() => { setMode('disable'); setCode(''); }}><ShieldOff className="mr-2 h-4 w-4" /> Turn off</Button>
        </div>
      )}
      {enabled && mode !== 'idle' && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border p-4">
          <span className="text-sm">{mode === 'disable' ? 'Confirm with a code to turn off 2FA:' : 'Confirm with a code to replace your backup codes:'}</span>
          {codeInput}
          <Button onClick={() => confirm(mode)} disabled={busy} variant={mode === 'disable' ? 'destructive' : 'default'}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{mode === 'disable' ? 'Turn off' : 'Replace codes'}
          </Button>
          <Button variant="ghost" onClick={() => setMode('idle')} disabled={busy}>Cancel</Button>
        </div>
      )}

      {freshCodes && freshCodes.length > 0 && <BackupCodes codes={freshCodes} />}
    </div>
  );
}

/** Working password change + two-factor management for every role's Settings → Security tab. */
export function SecuritySettings() {
  return (
    <div className="space-y-8">
      <ChangePassword />
      <div className="border-t pt-6">
        <TwoFactor />
      </div>
    </div>
  );
}
