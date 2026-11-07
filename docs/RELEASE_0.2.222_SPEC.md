# SOLVI.help v0.2.222 — Square-ended Single-colour Trait Ranges

## Requested UI change

The character editor keeps its existing compact three-column trait rows (dynamic label | one aligned range | numeric value). It does not introduce any divider.

The selected value 0–100 still determines the *entire* track colour through the existing blue → cyan → green → yellow → orange → red stops, but each browser-native track is now painted in that single colour. There is no grey inner line, gradient across the track or rounded track ends. Native range thumbs use a plain white 18 px circle, without border, outline ring or box shadow. Keyboard focus remains available through the input's focus indicator, not through a thumb border.

This is a CSS-focused change. Data, behaviour and permissions are not changed. The `app/index.html` CSS and module cache versions are bumped to v0.2.222 so clients load the corrected stylesheet.

## Technical explanation

`app/styles.css` already contains shared generic `input[type=range]::-webkit-slider-runnable-track` and `::-moz-range-track` rules. v0.2.221 coloured the parent range element but did not override the native track pseudos. Consequently, Chrome/Safari showed a grey narrow native track over the coloured rounded input background. v0.2.222 makes the range input transparent and sets the same value-dependent `--trait-track-color` directly on each native track pseudo. The focusable input remains usable via mouse, touch, and keyboard.

## Validation boundaries

CSS regression tests assert that WebKit and Firefox native tracks have square edges, no grey/gradient overlay, and a solid value-dependent background; thumb tests assert no border or shadow. Verify appearance in production Safari and Chrome and ensure drag/focus and save/reload all work. No user data migration, avatar changes, or new APIs. Live visual behaviour must be confirmed in a browser after deployment.
