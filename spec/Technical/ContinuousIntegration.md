# 检查与发布

[ci.yml](../../.github/workflows/ci.yml) 包含 Check 和 Release 两个任务，使用 Ubuntu 与 Node.js 22。PR、`main` 分支推送及数字开头的标签触发检查；版本标签在检查成功后触发发布。

Check 依次运行 `npm ci`、`npm test`、`npm run build` 和 `npm run screenshots:check`。构建包含严格类型检查；截图检查确认当前版本的图片及 README 引用。Obsidian 实机验证与截图生成在本地完成。

## 发布

1. 更新 `manifest.json`、`package.json` 与依赖锁文件中的项目版本，完成本地验证；外观不变时重命名截图并更新引用，否则重新截图。
2. 将构建同步到 `config.local.json` 的 `defaultVaultPath` 指定的本地 vault，创建版本提交，并在该提交上添加与 manifest 完全一致的版本标签，例如 `0.1.0`。
3. 等待用户明确要求后推送 `main` 与版本标签。

标签格式为 `x.y.z`，遵循 [Obsidian 的版本标签约定](https://docs.obsidian.md/plugins/releasing/submit-plugin)。[打包脚本](../../scripts/package-release.mjs) 校验标签、manifest 和 package 的版本，以及构建 manifest 是否与源码一致；通过后将三个安装文件及 ZIP 写入 `.artifacts/releases/<version>/`。已有版本目录不会被覆盖。

本地可在构建后运行：

```sh
npm run package:release -- 0.1.0
```

Check 将该次构建的发布文件传递给 Release。Release 使用 GitHub CLI 创建 Release、生成更新说明并上传 `main.js`、`manifest.json`、`styles.css` 和 `subvaults-<version>.zip`。ZIP 根目录直接包含三个安装文件。发布目标来自运行所在仓库，使用内置 `GITHUB_TOKEN`；仅 Release 任务具有 `contents: write` 权限。

检查或版本校验失败时停止发布。GitHub Release 已存在时，创建命令报错；需要修正发行内容时使用新版本。相关验证证据见[验证记录](Verification.md)。
