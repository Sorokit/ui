# Release Process

This document describes the release process for `sorokit-ui`. This project adheres to [Semantic Versioning](https://semver.org/) and follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) conventions.

---

## Versioning Guidelines

Given a version number `MAJOR.MINOR.PATCH`:

- **`PATCH`** (e.g. `1.0.0` -> `1.0.1`): Backwards-compatible bug fixes, minor documentation updates, or internal refactors.
- **`MINOR`** (e.g. `1.0.0` -> `1.1.0`): Backwards-compatible new features, new UI components, or non-breaking API additions.
- **`MAJOR`** (e.g. `1.0.0` -> `2.0.0`): Breaking changes, removed components, or incompatible API redesigns.

---

## Pre-Release Verification

Before cutting a new release, verify that all quality checks pass locally from a clean branch:

```bash
# 1. Install dependencies
npm install

# 2. Run linter
npm run lint

# 3. Typecheck the entire project
npx tsc --noEmit -p tsconfig.app.json

# 4. Build library distribution
npm run build

# 5. Check bundle size budget (50 KB gzipped budget)
npm run size

# 6. Verify public API exports
npm run test:exports

# 7. Run full test suite
npm test
```

---

## Step-by-Step Release Workflow

### 1. Ensure you are on the latest `main` branch

```bash
git checkout main
git pull upstream main
```

### 2. Bump the version in `package.json`

Choose the appropriate bump level (`patch`, `minor`, or `major`):

```bash
# For a patch release:
npm version patch --no-git-tag-version

# For a minor release:
npm version minor --no-git-tag-version

# For a major release:
npm version major --no-git-tag-version
```

### 3. Update `CHANGELOG.md`

1. Move the entries from `## [Unreleased]` into a new version heading:
   ```markdown
   ## [X.Y.Z] - YYYY-MM-DD
   ```
2. Retain the empty `## [Unreleased]` header at the top for future work.
3. Categorize changes using Keep a Changelog subheadings:
   - `### Added` for new features and components.
   - `### Changed` for changes in existing functionality.
   - `### Deprecated` for soon-to-be-removed features.
   - `### Removed` for now-removed features.
   - `### Fixed` for any bug fixes.
   - `### Security` in case of vulnerabilities.
4. Update the comparison links at the bottom of `CHANGELOG.md`.

### 4. Commit and Tag

```bash
git commit -am "chore(release): vX.Y.Z"
git tag -a vX.Y.Z -m "Release vX.Y.Z"
```

### 5. Push to GitHub

```bash
git push upstream main --tags
```

### 6. Create GitHub Release & Trigger Automated NPM Publish

1. Navigate to **Releases** > **Draft a new release** on GitHub (`https://github.com/Sorokit/ui/releases/new`).
2. Select the tag `vX.Y.Z` just pushed.
3. Set the release title to `vX.Y.Z`.
4. Copy the release notes for version `X.Y.Z` from `CHANGELOG.md` into the description.
5. Click **Publish release**.
6. The `.github/workflows/publish.yml` GitHub Actions workflow will automatically run on release creation, build the bundle, and publish the package to the npm registry.

---

## Troubleshooting & Verification

- **Verify published package**: Check `https://www.npmjs.com/package/sorokit-ui` after CI finishes.
- **Failed publish**: If the npm publish fails due to authentication or network issues, inspect the Actions log in GitHub Actions and re-run the job once resolved.
