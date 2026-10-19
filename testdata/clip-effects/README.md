# CLIP layer effect references

Synthetic artwork authored for this test: an opaque circle and curve, translucent
ellipse and triangle, and an alpha ramp. No production artwork is included.

`base.png` is the decoded layer before effects. `edge-on.png` and `edge-off.png`
are crops of native transparent PNG exports from CLIP STUDIO PAINT EX 5.1.5
(768 × 512, 72 dpi, sRGB), with a white 3 px border. The only effect setting
changed between exports is 「描画の不透明度を反映」.

`effects.json` contains the corresponding LayerEffectInfo blobs, plus the native
watercolor defaults: range 5, opacity influence 50, brightness influence 20,
blur width 10. These are settings only; there are no document identifiers.

The opacity checkbox changes byte 633 of the 638-byte native effect record.
The AA checkbox changes byte 625, not the final word. `options.json` contains
the native AA-off record and an enabled tone record (no border enabled).
Watercolor uses EffectWaterEdge while EffectEdge remains enabled. EffectApplyOpacity
is unchanged by the border opacity checkbox and must not stand in for it.

`kernels-base.png` contains isolated pixels (alpha 255, 128, 32, 1), translucent
and opaque rectangles, an antialiased circle/line, and an alpha ramp. The 128 px
images listed in `kernels.json` are crops of three native transparent PNG exports
(512 x 512, 72 dpi, sRGB). Each tile is an independent layer; no white paper is
present. Parameters were changed in copies of native effect records and the
documents opened and exported in CSP EX 5.1.5. The third export sweeps border
widths 0.1, 0.5, 1, 1.5, 2, 2.5, 3, 6 with AA on/off and opacity reflection off.
The native AA checkbox was also changed interactively to identify its field.

Tests compare alpha and compositing on both black and white. Smooth border alpha
differs by at most 1/255 in these fixtures; hard AA thresholds can flip a few
pixels. Watercolor is an empirical approximation, tested for improvement over
omission on nontransparent content, not universal pixel equality. Strong effects
and thin strokes still have local differences. No private CLIP files or paths are
included. Only synthetic images and effect settings are retained here.
