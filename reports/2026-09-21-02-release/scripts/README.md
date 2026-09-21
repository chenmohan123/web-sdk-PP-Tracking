# 回读脚本

从 SDK 根目录执行；需要已安装本仓库开发依赖、桌面 Chromium 和对应 GPU，以及可访问 npm/ModelScope/Hugging Face 的网络。

1. 将本报告的 `package-check.json` 复制到 `.tmp/tracking-02-release/package-check.json`。
2. 运行 `node reports/2026-09-21-02-release/scripts/verify-published.mjs`，输出 registry 字节/通道/attestation 元数据到 `.tmp/tracking-02-release/registry`。
3. 运行 `node reports/2026-09-21-02-release/scripts/online-smoke.mjs`，验证公开 Demo，将结果与截图保存到 `.tmp/tracking-02-release/online`。人工图片不是精度样本。
4. 在独立空目录 `npm install --ignore-scripts --no-audit --save-exact web-sdk-pp-tracking@0.2.0-rc.0`，随后 `npm audit signatures` 验签；第 2 步单独运行不构成密码学验证。

`collect-remote.mjs` 使用宿主 Windows gh 路径，只读 GitHub API；它会覆盖本报告 remote 快照，重验时应先修改输出目录并保留原记录。脚本固定本次发布 run/提交，不是“最新版本”探测器。
