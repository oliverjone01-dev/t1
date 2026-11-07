# Third-party components

SmoothTab (Swipe Tabs) and LiquidGlassCard / LiquidButton are copied as complete source files from https://github.com/kokonut-labs/kokonutui at commit `9976111a38abe05a47229867611db02646b597ef` (MIT, Dorian Baffier). See KOKONUT-LICENSE. The unused music demo remains in upstream source and is removed by tree shaking. App primitives resolve the upstream shadcn aliases; the board opts out of SVG refraction and supplies its own semantic styles.

Fractional indexing source is copied from the locked npm package `fractional-indexing` into public/vendor/; see FRACTIONAL-INDEXING-LICENSE there. React, Motion, DnD Kit and other packages retain their licenses in npm dependencies; esbuild preserves license comments in the bundle.
