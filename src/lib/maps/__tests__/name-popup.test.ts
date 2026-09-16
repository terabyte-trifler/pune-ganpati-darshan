import { describe, it, expect } from 'vitest';
import { nameCard } from '@/lib/maps/name-popup';
import { localGanpatis } from '@/services/catalogue';
import type { Ganpati } from '@/types/ganpati';

const withName = (name: string, nameMr: string | null): Ganpati =>
  ({ ...localGanpatis[0], name, nameMr }) as Ganpati;

describe('the card that names a mandal', () => {
  it('gives both names when the mandal has both', () => {
    const g = localGanpatis.find((m) => m.nameMr && m.nameMr !== m.name)!;
    const text = nameCard(g).textContent ?? '';
    expect(text).toContain(g.name);
    expect(text).toContain(g.nameMr!);
  });

  it('does not repeat one name twice when they are the same', () => {
    const card = nameCard(withName('Kasba Ganpati', 'Kasba Ganpati'));
    expect(card.childElementCount).toBe(1);
  });

  it('copes with a mandal that has no Marathi name', () => {
    const card = nameCard(withName('Some Mandal', null));
    expect(card.textContent).toBe('Some Mandal');
  });

  /**
   * A name is content. The card is built from DOM nodes rather than an HTML
   * string precisely so a mandal called something with an angle bracket or
   * an apostrophe in it renders as its name and not as markup.
   */
  it('treats a name as text, never as markup', () => {
    const card = nameCard(withName("<img src=x onerror=alert(1)> O'Ganpati", null));
    expect(card.querySelector('img')).toBeNull();
    expect(card.textContent).toBe("<img src=x onerror=alert(1)> O'Ganpati");
  });
});
