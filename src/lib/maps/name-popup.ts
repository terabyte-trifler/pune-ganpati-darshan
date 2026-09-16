import { Popup, type Map as MapLibreMap } from 'maplibre-gl';
import type { Ganpati } from '@/types/ganpati';

/**
 * Naming the mandal you just tapped.
 *
 * Every map in the app draws mandals as marks, and a mark says where but
 * not which. The full map answered that in a list inside its sheet — which
 * is a different place from the pin, and below the fold at the smaller
 * detents. The embedded maps answered it nowhere: on a mandal's own page,
 * on /parking and on a shared plan, tapping a pin did nothing at all.
 *
 * So the name goes on the map, at the mandal. Shared between the two map
 * components rather than written twice, because "what is this pin" should
 * not be answered differently depending on which surface it is drawn on.
 */

/**
 * The card itself.
 *
 * Built as DOM rather than an HTML string: a mandal's name is content, and
 * putting content through innerHTML is how an apostrophe in a name becomes
 * a rendering bug at best.
 */
export function nameCard(mandal: Ganpati): HTMLElement {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:grid;gap:2px;min-width:0';

  const name = document.createElement('strong');
  name.textContent = mandal.name;
  name.style.cssText =
    'font:700 13px/1.3 ui-sans-serif,system-ui,sans-serif;color:#f6efe3';
  wrap.appendChild(name);

  // Both names where they differ, the pairing the rest of the app uses.
  // Marathi alone does not help a visitor who cannot read it, and English
  // alone is not what the mandal calls itself.
  if (mandal.nameMr && mandal.nameMr !== mandal.name) {
    const mr = document.createElement('span');
    mr.textContent = mandal.nameMr;
    mr.style.cssText =
      'font:400 12px/1.35 ui-sans-serif,system-ui,sans-serif;color:#c9bda6';
    wrap.appendChild(mr);
  }
  return wrap;
}

/**
 * Show `mandal`'s name on `map`, replacing whatever was open.
 *
 * Returns the popup so the caller can hold it and take it down on unmount.
 * One at a time: two names open at once puts one of them over a mark it
 * does not belong to.
 */
export function openNamePopup(
  map: MapLibreMap,
  mandal: Ganpati,
  previous: Popup | null
): Popup {
  previous?.remove();
  return new Popup({
    // Tapping another pin replaces it and tapping the map closes it, so a
    // close button is a third way to do what two gestures already do — and
    // the smallest tap target of the three.
    closeButton: false,
    /**
     * Closed by the callers, not by MapLibre.
     *
     * closeOnClick listens for a map click, and the click that OPENS a
     * popup is a map click too — so whether the name survived the gesture
     * that asked for it came down to listener ordering. It did on the
     * category pins, which are a GL layer, and did not on the numbered
     * route pins, which are DOM markers: those flashed a card and closed
     * it in the same tap. Each map closes this itself when a tap lands on
     * no pin, which is the same behaviour without the race.
     */
    closeOnClick: false,
    offset: 18,
    className: 'mandal-name-popup',
    maxWidth: '220px',
  })
    .setLngLat([mandal.location.lng, mandal.location.lat])
    .setDOMContent(nameCard(mandal))
    .addTo(map);
}
