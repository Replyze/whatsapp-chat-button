# Releasing

jsDelivr serves the script from the Git tags (`@1` is the newest `v1.x.y` tag), so a release is a tag on `main` whose `dist/` is the build of `src/`. The [release workflow](.github/workflows/release.yml) checks that, makes the GitHub release and, when npm is set up, publishes to npm.

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

The workflow then runs the CI jobs, checks that the tag matches `package.json` and that `dist/` is the build, creates the GitHub release with the `CHANGELOG.md` section as notes and the built file attached, and publishes to npm if that is set up (below). Without npm set up, the publish step is skipped with a notice.

jsDelivr can take a while to move `@1` to the new tag. To speed it up, open `https://purge.jsdelivr.net/gh/Replyze/whatsapp-chat-button@1/dist/whatsapp-chat-button.min.js`.

Rules:

- Never move or delete a pushed tag. Sites pin exact versions with an SRI hash, and jsDelivr keeps serving what it fetched.
- A change to `src/` goes out as a release: CI fails when `dist/` is not the build of `src/`, and the README test fails when the pinned hash is not the hash of `dist/`. Docs, generator and test changes can merge at any time.
- A breaking change is `v2.0.0`. Sites on `@1` stay on 1.x. Switch the URLs in the README, `index.html` and `tests/browser.test.cjs` to `@2`.

## One-time setup for npm

The package is unscoped: `whatsapp-chat-button`. It is not on npm yet.

1. Create or pick the npm account (or npm organization) that will own the package, with two-factor authentication on.
2. First publish, with a token: create a granular access token on npmjs.com with read and write access to packages, and add it as the repository secret `NPM_TOKEN` (Settings → Secrets and variables → Actions). The next release tag publishes the package, with provenance.
3. Then switch to trusted publishing, which needs no token: on npmjs.com, open the package → Settings → Trusted publishing → GitHub Actions, and enter organization `Replyze`, repository `whatsapp-chat-button`, workflow `release.yml`. Add the repository variable `NPM_TRUSTED_PUBLISHING` = `true` (Settings → Secrets and variables → Actions → Variables), delete the `NPM_TOKEN` secret and revoke the token.

Trusted publishing is set per package on npmjs.com, so the package has to exist before step 3. You can also do the first publish by hand from a clean checkout of the tag: `npm publish --access public`.

`v1.0.0` was tagged before this workflow, with `"private": true` in `package.json`. It cannot go to npm, and it has no GitHub release. The first npm version is the next tag. To add a GitHub release for `v1.0.0` by hand:

```bash
gh release create v1.0.0 --verify-tag --title v1.0.0 --notes "First release. See CHANGELOG.md."
```

After the first npm publish, the README can add an npm option: `npm install whatsapp-chat-button`, then `import 'whatsapp-chat-button'` in browser code and `WhatsAppChatButton.init({ phone: '...' })`. Test it in a bundler before documenting it.
