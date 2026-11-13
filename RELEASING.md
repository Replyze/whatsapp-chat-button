# Releasing

jsDelivr serves the script from the Git tags (`@1` is the newest `v1.x.y` tag), so a release is a tag on `main` whose `dist/` is the build of `src/`. The [release workflow](.github/workflows/release.yml) checks that, packs the npm tarball, makes the GitHub release and, when npm is set up, publishes the tarball to npm.

## Release vX.Y.Z

1. On a branch, set the new version in three places: `package.json`, and in `src/whatsapp-chat-button.js` the banner on line 1 and `version: '...'`.
2. `npm run build`. It rebuilds `dist/` and prints the size and the new `integrity="sha384-..."`.
3. In `README.md`, update the pinned example (`@X.Y.Z` and its `integrity`), the `WhatsAppChatButton.version` row, and the "KB gzipped" size if it changed.
4. In `CHANGELOG.md`, rename `## [Unreleased]` to `## [X.Y.Z] - YYYY-MM-DD`, add a new empty `## [Unreleased]` above it, and update the links at the bottom.
5. `npm run check` and `npm test` (`BROWSER=firefox` and `BROWSER=webkit` too, or let CI run all three). Open a pull request, wait for CI, merge.
6. Tag the merge commit on `main` and push the tag:

   ```bash
   git checkout main && git pull
   git -c user.name="Replyze" -c user.email="dev@replyze.chat" tag -a vX.Y.Z -m "vX.Y.Z"
   git push origin vX.Y.Z
   ```

The workflow then runs in three jobs:

1. **test**: the CI jobs.
2. **release**: checks that the tag matches `package.json` and that `dist/` is the build, packs the npm tarball, and creates the GitHub release with the `CHANGELOG.md` section as notes and the built file and the tarball attached. In the packed copy of the README, `utm_source=github` becomes `utm_source=npm` (npmjs.com shows that README); the file in the repository does not change. The **Pack** step prints the tarball's sha256.
3. **publish**: publishes that same tarball to npm with provenance, using npm trusted publishing (GitHub's OIDC token, no npm token stored anywhere). Only this job gets `id-token: write`, and it runs in the GitHub environment `npm`. It runs only when the repository variable `NPM_PUBLISH` is `true`; otherwise the run shows a notice.

jsDelivr can take a while to move `@1` to the new tag. To speed it up, open `https://purge.jsdelivr.net/gh/Replyze/whatsapp-chat-button@1/dist/whatsapp-chat-button.min.js`.

Rules:

- Never move or delete a pushed tag. Sites pin exact versions with an SRI hash, and jsDelivr keeps serving what it fetched.
- A change to `src/` goes out as a release: CI fails when `dist/` is not the build of `src/`, and the README test fails when the pinned hash is not the hash of `dist/`. Docs, generator and test changes can merge at any time.
- A breaking change is `v2.0.0`. Sites on `@1` stay on 1.x. Switch the URLs in the README, `index.html` and `tests/browser.test.cjs` to `@2`.

## One-time setup for npm

The package is unscoped: `whatsapp-chat-button`. It is not on npm yet (the name was free on 2026-11-13).

**The first npm version must be a new version.** `v1.0.0` was tagged before this workflow, with `"private": true` in `package.json`. It cannot go to npm, it has no GitHub release, and a pushed tag never moves. The first npm version is the next release (`1.0.1` or `1.1.0`, as in [Release vX.Y.Z](#release-vxyz)). To add a GitHub release for `v1.0.0` by hand:

```bash
gh release create v1.0.0 --verify-tag --title v1.0.0 --notes "First release. See CHANGELOG.md."
```

npm only lets you add a trusted publisher to a package that already exists, so the first npm version is published once without it. Steps 3a and 3b are the two least-privilege ways; pick one.

1. **The npm account.** Use the `replyze` npm organization (or the account that will own the package), with two-factor authentication on for every member, using a security key or an authenticator app.
2. **The GitHub environment `npm`.** Settings → Environments → New environment → `npm`. Under **Deployment branches and tags**, choose **Selected branches and tags** and add the tag rule `v*`. Optionally add yourself under **Required reviewers**. The environment needs no secrets.
3. **The first npm version (once).** Tag it as above.
   - **3a. By hand, with your 2FA (recommended: no token exists at any point).** Leave `NPM_PUBLISH` unset: the run makes the GitHub release with the tarball and skips the publish job. Then, logged in to npm (`npm login`), with the new version for `X.Y.Z`:
     ```bash
     gh release download vX.Y.Z -R Replyze/whatsapp-chat-button -p "*.tgz" -D release-vX.Y.Z
     sha256sum release-vX.Y.Z/whatsapp-chat-button-X.Y.Z.tgz
     gh release view vX.Y.Z -R Replyze/whatsapp-chat-button --json assets -q ".assets[] | .name + \" \" + .digest"
     tar -tzf release-vX.Y.Z/whatsapp-chat-button-X.Y.Z.tgz
     npm publish release-vX.Y.Z/whatsapp-chat-button-X.Y.Z.tgz --access public
     ```
     The sha256 must equal the tarball's asset digest and the `sha256sum` line in the run's **Pack** step. npm asks for your 2FA code. This version has no provenance (only a CI publish gets one); every later version does.
   - **3b. From the workflow, with a one-day token (gives the first version provenance).** On npmjs.com → Access Tokens → Generate New Token (granular): permissions **Read and write**, expiration **1 day**, no organization access, **Bypass two-factor authentication** ticked (the run cannot type a code). A token for a package that does not exist yet cannot be limited to that package, so delete it as soon as the run is done. Save it as the secret `NPM_TOKEN` of the **`npm` environment** (Settings → Environments → `npm` → Environment secrets), never as a repository secret. Add the repository variable `NPM_PUBLISH` = `true` and push the tag. Right after the run: delete the environment secret and delete the token on npmjs.com. The run warns while the secret exists.
4. **Trusted publishing.** Add it when the next version is ready to tag: npm drops a new trusted publisher that has not published within 2 days. npmjs.com → `whatsapp-chat-button` → Settings → **Trusted Publisher** → GitHub Actions: organization or user `Replyze`, repository `whatsapp-chat-button`, workflow filename `release.yml`, environment name `npm`, allowed actions `npm publish` (leave `npm dist-tag` off). The same from a terminal (npm 11.15.0 or newer, 2FA on): `npm trust github whatsapp-chat-button --file release.yml --repo Replyze/whatsapp-chat-button --env npm --allow-publish`.
5. **Lock it down.** In the package's Settings → Publishing access, choose **Require two-factor authentication and disallow tokens** (trusted publishing keeps working). Set the repository variable `NPM_PUBLISH` = `true` if 3a left it unset. `gh secret list -R Replyze/whatsapp-chat-button --env npm` must print nothing.

The publish job installs npm 11.21.1 (trusted publishing needs 11.5.1 or newer) and skips a version that is already on npm. If it fails with `E404` or `ENEEDAUTH`, the trusted publisher does not match the repository, `release.yml` or the environment `npm` letter for letter, or it expired: delete it, add it again and re-run only the failed `publish` job.

After the first npm publish, the README can add an npm option: `npm install whatsapp-chat-button`, then `import 'whatsapp-chat-button'` in browser code and `WhatsAppChatButton.init({ phone: '...' })`. Test it in a bundler before documenting it.
