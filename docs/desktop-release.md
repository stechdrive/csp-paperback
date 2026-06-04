# Desktop release workflow

This project keeps the browser app and the Tauri desktop app in one repository.
The React/Vite UI and compositing engine are shared; only file open/save behavior changes at runtime.

## Where artifacts live

- Source code, Tauri config, app icons, and GitHub workflow files are committed.
- Local build output stays under `dist/` and `src-tauri/target/`; both are gitignored.
- Desktop binaries are not committed. The release workflow uploads them to a draft GitHub Release only.
- Existing sample PSD/XDTS files in `public/sample/` and `testdata/` are intentional fixtures. Do not add private production files.

## Local checks

Run these before asking Codex to push or prepare a release:

```bash
npm test
npm run build
npm run tauri:build -- --no-bundle
```

On Windows, a full local installer build can be tested with:

```bash
npm run tauri:build
```

The generated files remain in `src-tauri/target/release/bundle/`.

## Web deployment

The existing gh-pages flow remains unchanged:

```bash
npm run deploy
```

This publishes only the web build from `dist/`.

## Desktop release

Create and push a semver tag after the release commit is on the intended branch:

```bash
git tag v1.14.0
git push origin v1.14.0
```

The `desktop-release` workflow builds:

- Windows x64 installer assets: NSIS setup `.exe` and MSI `.msi`
- Windows x64 plain executable: experimental portable-style `.exe`
- macOS arm64 and x64 assets: `.app` bundle and `.dmg` when available from Tauri

The workflow always creates or updates a draft release. Review the assets in GitHub, then publish manually.

macOS note: `.dmg` is the normal direct-download installer format. A `.app` bundle is the closest portable-style macOS artifact; macOS does not have a single-file portable app equivalent. Unsigned/unnotarized macOS builds may show Gatekeeper warnings until Apple signing and notarization secrets are added.

## Safety checklist for Codex-assisted releases

Before staging, committing, pushing, tagging, or publishing:

```bash
git status --short
git ls-files | rg '(^|/)(dist|target|node_modules|\.env|.*\.local)(/|$)'
rg -n '([A-Z]:\\Users\\|/Users/|TOKEN|SECRET|PASSWORD|PRIVATE KEY|BEGIN [A-Z ]*KEY)' --glob '!node_modules/**' --glob '!src-tauri/target/**' --glob '!dist/**'
```

Expected result:

- No `dist/`, `node_modules/`, or `src-tauri/target/` files are tracked.
- No local absolute user paths are present in committed source/config/docs.
- No secrets, certificates, private keys, or signing credentials are committed.
- Release assets are draft-only until manually reviewed.
