import type { Metadata } from 'next';
import { GUIDE_MR, GUIDE_EN } from '@/content/how-to-use';
import { HowToUseView } from '@/features/guide/HowToUseView';

/**
 * How to use — Marathi.
 *
 * A separate URL rather than a toggle on the English page, so it can be
 * shared, bookmarked, crawled and ranked on its own. Pune searches for
 * this in Marathi, and a language that exists only behind a button is a
 * language no search engine ever sees.
 *
 * It is a translation of the same eight steps, not a different guide, and
 * it points at the same screenshots — the app's interface is English, so
 * that is what the reader will actually meet on screen. App labels are
 * therefore left in English throughout; see src/content/how-to-use.ts.
 *
 * `title.absolute` because the layout's brand suffix is English and would
 * read oddly appended to a Devanagari title — and because with it the
 * title runs past the point Google truncates.
 */

export const revalidate = 3600;

export const metadata: Metadata = {
  title: { absolute: `${GUIDE_MR.meta.title} — पुणे गणपती दर्शन` },
  description: GUIDE_MR.meta.description,
  alternates: {
    canonical: GUIDE_MR.path,
    languages: {
      'en-IN': GUIDE_EN.path,
      'mr-IN': GUIDE_MR.path,
      'x-default': GUIDE_EN.path,
    },
  },
  openGraph: {
    title: GUIDE_MR.meta.title,
    description: GUIDE_MR.meta.description,
    url: GUIDE_MR.path,
    locale: 'mr_IN',
  },
};

export default function HowToUseMarathiPage() {
  return <HowToUseView content={GUIDE_MR} />;
}
