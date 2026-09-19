# React example (0.1.0)

[中文](README.md)

The complete implementation is [demo/src/App.tsx](../../demo/src/App.tsx). It consumes the locally built SDK through the public `web-sdk-pp-tracking` package entry. React is a development dependency only; the shipped runtime is framework-neutral.

From the repository root, with Node >=22.12.0:

```sh
pnpm --config.verify-deps-before-run=false --config.manage-package-manager-versions=false install --frozen-lockfile
npm run build
npm run dev:demo
npm run build:react
```

Development URL: http://127.0.0.1:4196. Output: `examples/react/dist`. The npm package and hosted Demo are not published yet.
