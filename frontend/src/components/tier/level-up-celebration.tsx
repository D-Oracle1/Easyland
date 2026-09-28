'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { getUser } from '@/lib/auth-storage';
import { Button } from '@/components/ui/button';
import { TierBadge, TIER_ORDER, TIER_THRESHOLDS, normalizeTier, tierLabel, Tier } from './tier-badge';
import { useMyLoyalty } from './use-my-tier';

const seenKey = (userId: string) => `tier_seen:${userId}`;

function readSeen(userId: string): Tier | null {
  try {
    const v = localStorage.getItem(seenKey(userId));
    return v ? normalizeTier(v) : null;
  } catch {
    return null;
  }
}

function writeSeen(userId: string, tier: Tier) {
  try {
    localStorage.setItem(seenKey(userId), tier);
  } catch {
    /* storage unavailable — celebration may show again, harmless */
  }
}

/**
 * Game-style "LEVEL UP!" overlay shown once when a realtor's tier rises above
 * the last tier this browser celebrated. First visit just records the tier.
 */
export function LevelUpCelebration() {
  const loyalty = useMyLoyalty();
  const [tier, setTier] = useState<Tier | null>(null);

  useEffect(() => {
    const user = getUser();
    if (!loyalty || !user?.id) return;
    const current = normalizeTier(loyalty.currentTier);
    const seen = readSeen(user.id);
    if (seen === null) {
      // First time on this device: celebrate only if they're above Bronze
      if (current !== 'BRONZE') setTier(current);
      else writeSeen(user.id, current);
    } else if (TIER_ORDER.indexOf(current) > TIER_ORDER.indexOf(seen)) {
      setTier(current);
    } else if (current !== seen) {
      writeSeen(user.id, current); // tier went down — just record it
    }
  }, [loyalty]);

  const close = () => {
    const user = getUser();
    if (user?.id && tier) writeSeen(user.id, tier);
    setTier(null);
  };

  return (
    <AnimatePresence>
      {tier && (
        <motion.div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={close}
          role="dialog"
          aria-modal="true"
          aria-label={`Level up: ${tierLabel(tier)} tier`}
        >
          <motion.div
            className="relative w-full max-w-sm overflow-hidden rounded-2xl bg-gradient-to-b from-slate-900 to-slate-800 p-8 text-center text-white shadow-2xl"
            initial={{ scale: 0.6, y: 40 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 18 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Light rays */}
            <motion.div
              aria-hidden
              className="pointer-events-none absolute left-1/2 top-24 h-[28rem] w-[28rem] -translate-x-1/2 -translate-y-1/2 rounded-full"
              style={{ background: 'conic-gradient(from 0deg, transparent 0 10%, rgba(255,215,0,0.18) 10% 15%, transparent 15% 35%, rgba(255,215,0,0.18) 35% 40%, transparent 40% 60%, rgba(255,215,0,0.18) 60% 65%, transparent 65% 85%, rgba(255,215,0,0.18) 85% 90%, transparent 90%)' }}
              animate={{ rotate: 360 }}
              transition={{ duration: 18, repeat: Infinity, ease: 'linear' }}
            />
            {/* Sparks */}
            {Array.from({ length: 14 }).map((_, i) => (
              <motion.span
                key={i}
                aria-hidden
                className="absolute left-1/2 top-24 h-1.5 w-1.5 rounded-full bg-yellow-300"
                initial={{ x: 0, y: 0, opacity: 1 }}
                animate={{
                  x: Math.cos((i / 14) * Math.PI * 2) * 140,
                  y: Math.sin((i / 14) * Math.PI * 2) * 140,
                  opacity: 0,
                }}
                transition={{ duration: 1.2, delay: 0.25, ease: 'easeOut' }}
              />
            ))}

            <motion.p
              className="relative text-sm font-bold uppercase tracking-[0.3em] text-yellow-300"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
            >
              Level Up!
            </motion.p>

            <motion.div
              className="relative mx-auto my-5 flex justify-center"
              initial={{ rotate: -180, scale: 0 }}
              animate={{ rotate: 0, scale: 1 }}
              transition={{ type: 'spring', stiffness: 180, damping: 12, delay: 0.2 }}
            >
              <TierBadge tier={tier} size={128} animated />
            </motion.div>

            <h2 className="relative text-2xl font-extrabold">{tierLabel(tier)} Realtor</h2>
            <p className="relative mt-2 text-sm text-white/75">
              Your total sales passed ₦{TIER_THRESHOLDS[tier].toLocaleString()}. Your new badge now shows on your
              profile picture.
            </p>

            <Button className="relative mt-6 w-full" onClick={close}>
              Awesome!
            </Button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
