# Privacy and deployment

[中文](../zh-CN/privacy-deployment.md) · [Home](../../README.en.md)

The SDK has no network requests, telemetry, model downloads or persistent caches. The Demo reads files and computes in memory, without uploading boxes; refresh clears data. User-triggered JSON exports may contain sensitive positions/timestamps and should be shared accordingly. Track IDs do not identify people.

`npm run build:demo` emits `demo/dist` for any static HTTPS host with relative assets. Initial page load requests its own JS/CSS; clicking the paper visits arxiv. Hosts should configure CSP, HTTPS and access controls for their needs.

The Pages template uses official configure-pages/upload-pages-artifact/deploy-pages actions from protected main or manual dispatch. Only the deployment job receives pages/id-token write permissions; it uses github-pages and a serialized concurrency group. Before activation verify default-branch rules, Pages Source=GitHub Actions and HTTPS. No remote resources were created here.

The release template runs when a GitHub Release for a v* tag is published, verifies first, then uses npm OIDC trusted publishing. Explicit authorization is required to configure the trusted publisher (repository/workflow/environment), default-branch protection and immutable v* tags. If initial package registration requires a manual step, authorize it separately; never embed tokens. All GitHub/npm/Pages URLs remain planned.

Use the current CHANGELOG entry as release notes, including algorithm source, Apache-2.0, state/API differences and limits. Workflow files are not remote governance evidence. See the [release checklist](release-checklist.md).
