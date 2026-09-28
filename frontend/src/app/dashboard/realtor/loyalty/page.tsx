'use client';

import { motion } from 'framer-motion';
import { Loader2, Lock, CheckCircle, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { formatCurrency } from '@/lib/utils';
import {
  TierBadge,
  TIER_ORDER,
  TIER_THRESHOLDS,
  normalizeTier,
  tierLabel,
} from '@/components/tier/tier-badge';
import { useMyLoyalty } from '@/components/tier/use-my-tier';

export default function RealtorLoyaltyPage() {
  const loyalty = useMyLoyalty();

  if (!loyalty) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const tier = normalizeTier(loyalty.currentTier);
  const tierIndex = TIER_ORDER.indexOf(tier);
  const next = loyalty.nextTier ? normalizeTier(loyalty.nextTier) : null;

  return (
    <div className="space-y-6">
      {/* Current rank */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
          <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-white/5" />
          <CardContent className="relative p-6 sm:p-8">
            <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center">
              <TierBadge tier={tier} size={112} animated />
              <div className="w-full flex-1 text-center sm:text-left">
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-white/60">Current rank</p>
                <h2 className="text-3xl font-extrabold">{tierLabel(tier)} Realtor</h2>
                <p className="mt-1 text-white/75">
                  Total sales value: <span className="font-semibold text-white">{formatCurrency(loyalty.totalSalesValue)}</span>
                </p>

                {next ? (
                  <div className="mt-5">
                    <div className="mb-2 flex justify-between text-sm">
                      <span>Progress to {tierLabel(next)}</span>
                      <span className="font-semibold">{Math.floor(loyalty.progressToNextTier)}%</span>
                    </div>
                    <Progress value={loyalty.progressToNextTier} className="h-3 bg-white/20" />
                    <p className="mt-2 text-sm text-white/75">
                      {formatCurrency(loyalty.valueToNextTier)} more in sales to unlock the{' '}
                      <span className="font-semibold text-white">{tierLabel(next)}</span> badge
                    </p>
                  </div>
                ) : (
                  <p className="mt-5 font-semibold text-yellow-300">Top rank reached — you're a legend!</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Rank ladder */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Rank ladder
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {TIER_ORDER.map((t, i) => {
              const unlocked = i <= tierIndex;
              const current = i === tierIndex;
              return (
                <motion.div
                  key={t}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.08 }}
                  className={`relative flex flex-col items-center rounded-xl border p-4 text-center ${
                    current ? 'border-primary bg-primary/5 ring-2 ring-primary/30' : ''
                  }`}
                >
                  <div className={unlocked ? '' : 'opacity-30 grayscale'}>
                    <TierBadge tier={t} size={64} />
                  </div>
                  {!unlocked && <Lock className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />}
                  {unlocked && !current && <CheckCircle className="absolute right-3 top-3 h-4 w-4 text-green-500" />}
                  <p className="mt-2 font-semibold">{tierLabel(t)}</p>
                  <p className="text-xs text-muted-foreground">
                    {TIER_THRESHOLDS[t] === 0 ? 'Starting rank' : `${formatCurrency(TIER_THRESHOLDS[t])}+ in sales`}
                  </p>
                  {current && <span className="mt-2 rounded-full bg-primary px-2 py-0.5 text-xs text-white">You are here</span>}
                </motion.div>
              );
            })}
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            Your rank is based on the total value of your completed and in-progress sales. Commission is a flat{' '}
            {loyalty.tierBenefits?.commissionRate ?? '12%'} at every rank.
          </p>
        </CardContent>
      </Card>

      {/* Points history */}
      <Card>
        <CardHeader>
          <CardTitle>Points history</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-muted-foreground">
            {loyalty.totalPoints.toLocaleString()} points earned from sales, referrals and achievements.
          </p>
          {loyalty.pointsHistory.length === 0 ? (
            <p className="text-sm text-muted-foreground">No points yet — close your first sale to start earning.</p>
          ) : (
            <ul className="divide-y">
              {loyalty.pointsHistory.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{p.description}</p>
                    <p className="text-xs text-muted-foreground">{new Date(p.createdAt).toLocaleDateString()}</p>
                  </div>
                  <span className="shrink-0 font-semibold text-green-600">+{p.points.toLocaleString()}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
