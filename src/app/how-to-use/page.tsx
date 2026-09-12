import type { Metadata } from 'next';
import { GUIDE_EN } from '@/content/how-to-use';
import { HowToUseView } from '@/features/guide/HowToUseView';

/**
 * How to use — English.
 *
 * Written for someone who has never opened the app and is not going to
 * read an essay before their evening starts. Every step is a screenshot of
 * the real, live app with the sentence that goes with it.
 *
 * The order follows how the app actually gets used rather than how it is
 * built: what's short right now, tell everyone what you can see, the map,
 * then a route, then the reference material. Reporting the crowd comes
 * second on purpose — the tracker is only as good as the number of people
 * who tap those three buttons.
 *
 * The copy lives in src/content/how-to-use.ts alongside the Marathi, and
 * the markup in HowToUseView. This file is only the route and its head.
 */

export const revalidate = 3600;

export const metadata: Metadata = {
  title: GUIDE_EN.meta.title,
  description: GUIDE_EN.meta.description,
  alternates: {
    canonical: GUIDE_EN.path,
    // Each language canonical to itself, and each declaring the other.
    // x-default points at English: it is the version to serve a reader
    // whose language we have no answer for.
    languages: {
      'en-IN': GUIDE_EN.path,
      'mr-IN': GUIDE_EN.alternate.path,
      'x-default': GUIDE_EN.path,
    },
  },
};

export default function HowToUsePage() {
  return <HowToUseView content={GUIDE_EN} />;
}
