'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Compass, Map, Route, Heart } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Mobile bottom navigation.
 *
 * The sliding indicator is pure CSS. It previously used motion's `layoutId`,
 * which pulled the whole layout-animation engine into the shared bundle on
 * every route — ~137 KiB of unused JS and ~740 ms of main-thread work on a
 * mid-range Android, to animate a 32px underline. Tabs are equal width, so
 * a transform on a single element gives the identical effect for free.
 *
 * Hidden on md+ where the split layout takes over, and inside the admin area.
 */

const TABS = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/explore', label: 'Explore', icon: Compass },
  { href: '/map', label: 'Map', icon: Map },
  { href: '/plan', label: 'Plan', icon: Route },
  { href: '/saved', label: 'Saved', icon: Heart },
] as const;

export function BottomNav() {
  const pathname = usePathname();
  if (pathname.startsWith('/admin')) return null;

  const activeIndex = TABS.findIndex(({ href }) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href)
  );

  return (
    <nav
      aria-label="Primary"
      className={cn(
        'fixed inset-x-0 bottom-0 z-40 md:hidden',
        'border-t border-[var(--line)] bg-[var(--raat)]/92 backdrop-blur-xl'
      )}
      style={{ paddingBottom: 'var(--safe-bottom)' }}
    >
      <ul className="relative mx-auto flex h-[var(--nav-height)] max-w-lg items-stretch">
        {activeIndex >= 0 && (
          <li
            aria-hidden="true"
            className="pointer-events-none absolute top-0 h-0.5 rounded-full bg-[var(--shendur)] transition-transform duration-300 ease-out"
            style={{
              width: `${100 / TABS.length}%`,
              transform: `translateX(${activeIndex * 100}%) scaleX(0.4)`,
            }}
          />
        )}

        {TABS.map(({ href, label, icon: Icon }, index) => {
          const active = index === activeIndex;
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex h-full flex-col items-center justify-center gap-0.5',
                  'text-[10px] font-medium transition-colors duration-150',
                  active ? 'text-[var(--shendur)]' : 'text-[var(--faint)]'
                )}
              >
                <Icon size={20} strokeWidth={active ? 2.4 : 1.9} aria-hidden="true" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
