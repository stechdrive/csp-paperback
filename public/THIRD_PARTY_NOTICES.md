# CLIP importer acknowledgements

The CLIP container, BINC timeline, and raster tile readers were developed with
reference to the following MIT-licensed format research and implementations:

- [wamsoft/clipparse](https://github.com/wamsoft/clipparse), commit
  `322a273c0e059d1dee9132af78289efa12a59522` (Offscreen attributes, raster tiles and blend equations).
- [animeops/clip-tools](https://github.com/animeops/clip-tools), commit
  `8807134932a39a009c980fb29acd1ae934354a7c` (BINC serialization, CLIP structure,
  vector spline sampling, brush dynamics and stamp rasterization).
- [nekomimianko/clipvec](https://github.com/nekomimianko/clipvec), commit
  `29130f54311b35f7d8bd4c1d1d357a5a9253f1cd` (closed vector strokes, pen inputs and corner records).
- [Aodaruma/clipfile-rs](https://github.com/Aodaruma/clipfile-rs), commit
  `bd88467fa80e63ad48c6c713fbfb5a8a116d798a` (native timeline identities and correction metadata).
  Release `clipfile-svg-v0.2.0`, commit `b3c4aefe3ba944f47f27aaf0777cbffc1038e75c`,
  was also consulted for the modern 92-byte vector stroke layout.
- [dobrokot/clip_to_psd](https://github.com/dobrokot/clip_to_psd), commit
  `e8db68c768f52ec91ba7530820f52537261cbad0` (text attributes, image effects and fill metadata).
- [al3ks1s/clip-tools](https://github.com/al3ks1s/clip-tools), commit
  `e1d3d7ed4701ac84e9220127daa73c2cf90dd803` (CLIP container and SQLite extraction research via xsheet-remap).
- [sql.js](https://github.com/sql-js/sql.js), `1.15.1` (bundled SQLite WebAssembly).
  SQLite itself is in the public domain.

Copyright (c) 2024

(Both dobrokot/clip_to_psd and al3ks1s/clip-tools use the copyright line above.)

Copyright (c) 2026 wamsoft

Copyright (c) 2026 AnimeOps

Copyright (c) 2026 nekomimianko

Copyright (c) 2026 Aodaruma

Copyright (c) 2017 sql.js authors (see https://github.com/sql-js/sql.js/blob/master/AUTHORS)

MIT License

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## celcodec 0.10.0 (GPL-3.0-or-later)

Copyright (c) 2025-2026 stechdrive. celcodec is licensed under the GNU General
Public License, version 3 or (at your option) any later version. The application
source tree includes the library, its corresponding TypeScript source, build
script, compiler configuration and THIRD_PARTY_NOTICES.md together in
`vendor/celcodec-0.10.0-78ee60458a5c.tgz`.

The MIT permission notice below applies to the earlier code adapted from
csp-paperback (`9256c0326dcbb628ed8c601bf17253c3ca2300dd`) and xsheet-remap
(`6fb67280fdebb2ecd93e0fd0e369b47b4f29a6e8`), and to
[fflate](https://github.com/101arrowz/fflate) 0.8.3, Copyright (c) 2026 Arjun Barrett.

MIT License

Copyright (c) 2025-2026 stechdrive

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
