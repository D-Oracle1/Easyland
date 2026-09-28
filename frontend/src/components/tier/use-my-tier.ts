'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { getUser } from '@/lib/auth-storage';

export interface MyLoyalty {
  currentTier: string;
  totalSalesValue: number;
  nextTier: string | null;
  nextTierThreshold: number | null;
  valueToNextTier: number;
  progressToNextTier: number;
  totalPoints: number;
  achievements: string[];
  pointsHistory: { id: string; points: number; source: string; description: string; createdAt: string }[];
  tierBenefits?: { commissionRate: string; pointsMultiplier: string; perks: string[] };
}

// One request per page load, shared by header, sidebar, dashboard and the
// level-up celebration.
let inflight: Promise<MyLoyalty | null> | null = null;

function fetchMyLoyalty(): Promise<MyLoyalty | null> {
  if (!inflight) {
    inflight = api
      .get('/loyalty/my')
      .then((res: any) => (res?.data !== undefined ? res.data : res) as MyLoyalty)
      .catch(() => null);
  }
  return inflight;
}

/** Loyalty/tier for the signed-in realtor; null for other roles or on error. */
export function useMyLoyalty() {
  const [data, setData] = useState<MyLoyalty | null>(null);

  useEffect(() => {
    if (getUser()?.role !== 'REALTOR') return;
    let alive = true;
    fetchMyLoyalty().then((d) => alive && setData(d));
    return () => {
      alive = false;
    };
  }, []);

  return data;
}
