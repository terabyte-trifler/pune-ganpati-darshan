# Vendored fonts

`Mukta-Regular.ttf` / `Mukta-Bold.ttf` — Ek Type, SIL Open Font License 1.1
(see `OFL.txt`). Mukta is already the app's Devanagari face via
`next/font/google`; these copies exist because the Open Graph card is rendered
by Satori, which cannot read the `woff2` files `next/font` produces and needs a
real `ttf` handed to it.

Vendored rather than fetched at build time so a deploy never depends on
fonts.gstatic.com being reachable.

Used by `src/app/opengraph-image.tsx`.

`Fraunces-Display700.ttf` — Fraunces, SIL Open Font License 1.1 (see
`OFL-Fraunces.txt`). Fraunces is the app's display serif via
`next/font/google`. Upstream ships only a variable font whose default
instance is `opsz 9` — letterforms drawn for captions, which look coarse at
68px. This is a static cut pinned to `wght 700 / opsz 96`, produced with:

    fontTools.varLib.instancer.instantiateVariableFont(
        font, {'wght': 700, 'opsz': 96, 'SOFT': 0, 'WONK': 0})

Regenerate it that way rather than hand-editing.
