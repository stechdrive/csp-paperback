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
Watercolor uses EffectWaterEdge while EffectEdge remains enabled. EffectApplyOpacity
is unchanged by the border opacity checkbox and must not stand in for it.

Outline rendering remains approximate. Tests protect translucent interiors,
effect identification, and composited appearance, not universal pixel equality.
