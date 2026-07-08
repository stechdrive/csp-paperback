# Desktop release workflow

This project keeps the browser app and the Tauri desktop app in one repository.
The React/Vite UI and compositing engine are shared; only file open/save behavior changes at runtime.

## Where artifacts live

- Source code, Tauri config, app icons, and GitHub workflow files are committed.
- Local build output stays under `dist/` and `src-tauri/target/`; both are gitignored.
- Desktop binaries are not committed. The release workflow uploads only the approved Japanese UI binaries to a draft GitHub Release.
- Existing sample PSD/XDTS files in `public/sample/` and `testdata/` are intentional fixtures. Do not add private production files.

## Local checks

Run these before asking Codex to push or prepare a release:

```bash
npm test
npm run build
npm run audit:artifacts -- dist
npm run tauri:build
```

## Versioning

The app uses `major.minor.build`, where `build` is the local Git commit count
(`git rev-list --count HEAD`). Feature and compatibility changes still bump
`major` or `minor` manually. Local build commands run `npm run version:sync`
first, which updates:

- `package.json`
- `package-lock.json`
- `src-tauri/Cargo.toml`
- `src-tauri/Cargo.lock`

This keeps local Web and Tauri builds on the same visible version without
requiring a GitHub Release. Set `CSP_PAPERBACK_SKIP_VERSION_SYNC=1` to skip the
local sync for a one-off command.

GitHub Actions skip this automatic sync. Release workflows continue to use the
committed version and the pushed tag, so create a release tag only after the
version sync change is committed:

```bash
npm run version:sync
git status --short
git tag vX.Y.Z
git push origin vX.Y.Z
```

The local `tauri:build` script runs Tauri with Rust path remapping so generated binaries do not contain the checkout path, user home directory, or temp build directory. With no extra arguments, it follows the release asset policy: Windows builds a portable `.exe` only, and macOS builds an Apple Silicon `.dmg` only.

For a local Windows handoff copy, set `CSP_PAPERBACK_EXE_COPY_DIR` in the environment or in ignored `.env.local`. After `npm run tauri:build` succeeds, the portable `csp-paperback.exe` is copied there. CI and release builds leave this unset, so GitHub Release assets are unchanged.

## Update check

The desktop app does not self-update or download binaries inside the app.
Users can manually check for updates from the help dialog. That action fetches
only the latest GitHub Release metadata from
`https://api.github.com/repos/stechdrive/csp-paperback/releases/latest` and
opens the GitHub Releases page in the user's default browser when an update is
available. PSD/XDTS contents, file names, settings, and generated images are not
sent.

## Web deployment

The existing gh-pages flow remains unchanged:

```bash
npm run deploy
```

This builds and audits `dist/`, then publishes only the web build from `dist/`.

## Desktop release

Create and push a semver tag after the release commit is on the intended branch:

```bash
git tag vX.Y.Z
git push origin vX.Y.Z
```

The `desktop-release` workflow builds exactly two Japanese UI assets:

- Windows x64 portable executable: `.exe`
- macOS Apple Silicon: `.dmg`

The workflow creates or updates a draft release, scans `dist/` and generated Tauri artifacts for local build path leakage, verifies that the draft contains exactly the two approved asset names, then publishes the release only after all platform jobs pass.

Do not produce English UI assets, Windows installers, macOS Intel builds, or macOS `.app.tar.gz` assets. macOS `.dmg` assets are not notarized unless signing secrets are configured separately.

Release notes must stay minimal: state that the entry is the latest desktop binary distribution and show the version only. The workflow deletes older GitHub Release entries after the new release is published, while leaving Git tags intact.

## Safety checklist for Codex-assisted releases

Before staging, committing, pushing, tagging, or publishing:

```bash
git status --short
git ls-files | rg '(^|/)(dist|target|node_modules|\.env|.*\.local)(/|$)'
rg -n '([A-Z]:\\Users\\|/Users/|TOKEN|SECRET|PASSWORD|PRIVATE KEY|BEGIN [A-Z ]*KEY)' --glob '!node_modules/**' --glob '!src-tauri/target/**' --glob '!dist/**'
npm run audit:artifacts -- dist
```

Expected result:

- No `dist/`, `node_modules/`, or `src-tauri/target/` files are tracked.
- No local absolute user paths are present in committed source/config/docs.
- `npm run audit:artifacts -- dist` passes before gh-pages deployment.
- No secrets, certificates, private keys, or signing credentials are committed.
- Release assets stay draft-only until the workflow artifact audit and exact two-asset check pass.
