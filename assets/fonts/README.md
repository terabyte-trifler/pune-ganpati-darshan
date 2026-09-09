# Vendored fonts

`Mukta-Regular.ttf` / `Mukta-Bold.ttf` — Ek Type, SIL Open Font License 1.1
(see `OFL.txt`). Mukta is already the app's Devanagari face via
`next/font/google`; these copies exist because the Open Graph card is rendered
by Satori, which cannot read the `woff2` files `next/font` produces and needs a
real `ttf` handed to it.

Vendored rather than fetched at build time so a deploy never depends on
fonts.gstatic.com being reachable.

Used by `src/app/opengraph-image.tsx`.
