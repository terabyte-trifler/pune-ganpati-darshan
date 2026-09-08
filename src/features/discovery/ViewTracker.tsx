'use client';

import { useEffect } from 'react';
import { trackEvent } from '@/services/analytics';

/** Records a mandal view once per mount. Renders nothing. */
export function ViewTracker({ ganpatiId, slug }: { ganpatiId: string; slug: string }) {
  useEffect(() => {
    trackEvent('ganpati_viewed', { ganpatiId, props: { slug } });
  }, [ganpatiId, slug]);

  return null;
}
