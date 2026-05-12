'use client';

import { useEffect, useState } from 'react';
import { api } from './api';

export interface MeResponse {
  auth: {
    kind: 'session' | 'apiKey';
    userId?: string;
    email?: string;
    tenantId: string;
    role: string;
  };
  memberships: { tenantId: string; tenantName: string; tenantPlan: string; role: string }[];
}

export function useMe() {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .get<MeResponse>('/api/auth/me')
      .then((res) => {
        if (!cancelled) setMe(res);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { me, loading, error, reload: () => api.get<MeResponse>('/api/auth/me').then(setMe) };
}
