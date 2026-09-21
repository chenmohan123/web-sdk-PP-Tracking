# Privacy and deployment

[中文](../zh-CN/privacy-deployment.md) · [Home](../../README.en.md)

The default algorithm entry has no network requests, telemetry or persistent cache. The optional `web-sdk-pp-tracking/reid` entry downloads weights from the selected ModelScope/Hugging Face source and loads static ORT resources during load. Remote hosts receive normal resource-request network information; images, boxes and vectors are not uploaded with those requests. Weights use this SDK's own CacheStorage namespace, which survives refresh; local modelBytes are not persisted.

Demo images, boxes and embeddings are processed locally; refresh clears the in-memory session. The box/vector workspace's input and result exports are user-triggered and contain source boxes, times, appearance vectors and actual options. Share them accordingly. Track IDs are not personal identities, and feature-space IDs do not prove vector provenance. State reset only resets tracks. Full cleanup cancels and waits for extraction, releases the session, clears this SDK's model cache and resets association state without deleting other SDK caches.

`npm run build:demo` emits `demo/dist` for static HTTPS hosting with relative assets. The build includes ORT engine resources but no model weights; engine and selected-source requests occur only when the model is enabled and loaded. Allow static JS/MJS/WASM and model-source CORS requests, configuring CSP and access controls as needed. WebGPU, SHA-256 and CacheStorage require browser secure contexts (HTTPS or localhost); plain LAN HTTP is not equivalent.

Pages uses official configure-pages/upload-pages-artifact/deploy-pages actions. Only its deployment job receives pages/id-token write permissions, with the github-pages environment and serialized concurrency. Remote governance and delivery for 0.1.0 are archived. The RC uses protected-branch CI, immutable tags and trusted publishing; see the release checklist for status.

The release workflow runs when a GitHub Release for a v* tag is published, verifies first, then uses npm OIDC Trusted Publishing. The publisher is configured; the first version used local authentication. A future version still needs an actual receipt proving OIDC success. Recheck protected branches, immutable tags and the environment before publishing; do not embed tokens in code or artifacts.

Use the current CHANGELOG entry as release notes, including algorithm source, Apache-2.0, state/API differences and limits. Workflow files are not remote governance evidence. See the [release checklist](release-checklist.md).
