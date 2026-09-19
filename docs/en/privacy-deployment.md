# Privacy and deployment

[中文](../zh-CN/privacy-deployment.md) · [Home](../../README.en.md)

The SDK has no network requests, telemetry, model downloads, persistent caches or built-in feature extractor. The Demo reads files and computes in memory without uploading boxes or embeddings; refresh clears data. Both the compact input sequence and result report are user-triggered exports containing source boxes/timestamps and possibly appearance vectors that can correlate individuals; the result report also includes tracks and actual options. Share them accordingly. Track IDs do not identify people, and a feature-space ID does not prove vector provenance.

`npm run build:demo` emits `demo/dist` for any static HTTPS host with relative assets. Initial page load requests its own JS/CSS; clicking the paper visits arxiv. Hosts should configure CSP, HTTPS and access controls for their needs.

The Pages template uses official configure-pages/upload-pages-artifact/deploy-pages actions from protected main or manual dispatch. Only the deployment job receives pages/id-token write permissions; it uses github-pages and a serialized concurrency group. Before activation verify default-branch rules, Pages Source=GitHub Actions and HTTPS. No remote resources were created here.

The release template runs when a GitHub Release for a v* tag is published, verifies first, then uses npm OIDC trusted publishing. Explicit authorization is required to configure the trusted publisher (repository/workflow/environment), default-branch protection and immutable v* tags. If initial package registration requires a manual step, authorize it separately; never embed tokens. All GitHub/npm/Pages URLs remain planned.

Use the current CHANGELOG entry as release notes, including algorithm source, Apache-2.0, state/API differences and limits. Workflow files are not remote governance evidence. See the [release checklist](release-checklist.md).
