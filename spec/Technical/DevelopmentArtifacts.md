# 开发产物

项目路径统一由 [project-paths.cjs](../../scripts/project-paths.cjs) 从模块位置推导。`dist/` 保存编译输出，`TestVaults/` 保存 Obsidian 测试 vault，`.docs/images/` 保存随仓库提交的 README 图片。可清理的运行产物按以下用途组织：

| 目录 | 内容 | 生命周期 |
| --- | --- | --- |
| `.artifacts/scratch/logs/<run>/` | 应用进程日志 | 单次运行 |
| `.artifacts/scratch/tests/<run>/` | 测试报告、截图实例的独立应用配置 | 单次运行 |
| `.artifacts/scratch/probes/<run>/` | 调查脚本、接口探测与专项检查证据 | 单次调查 |
| `.artifacts/scratch/previews/<run>/` | 原始截图与场景记录 | 单次运行 |
| `.artifacts/cache/` | npm 等工具可复用的缓存 | 跨运行复用，可重建 |
| `.artifacts/backups/<run>/` | 配置或标识调整前的备份 | 单独决定保留期限 |
| `.artifacts/releases/<version>/` | 三个安装文件及版本化 ZIP | 按发布版本保存 |

`<run>` 使用 `YYYYMMDD-HHMMSS-SSS-<purpose>-<pid>`，时间为 UTC，`SSS` 为毫秒。时间顺序便于查找，用途说明任务，进程号区分并发调用。例如 `20260919-150000-123-readme-capture-12345`。同次任务的日志、配置和图片使用相同运行名，分类目录按实际需要创建。

[artifact-run.cjs](../../scripts/artifact-run.cjs) 为命令行工具和 Obsidian 宿主验收共用的分配入口。运行目录通过独占创建避免覆盖历史记录；宿主验收先检查 vault 归属，再创建产物目录。`readme-capture.lock` 是截图任务的固定互斥文件，位于 `scratch/probes/`，完成或失败后移除。

## 维护

没有相关任务运行时，可以删除整个 `.artifacts/scratch/`。它不承担配置存储或源码职责；可重复执行的逻辑放在 `scripts/`、`tests/`，有长期价值的结论写入 `spec/`。缓存与备份独立于 scratch，便于分别清理。上述目录均由 Git 忽略。

[README 截图](ReadmeScreenshots.md) 将原始图片、场景记录、进程配置和日志写入同名分类目录；完整检查后的图片才发布至 `.docs/images/`。宿主验收每次创建独立的 `host-verification` 或 `interaction-verification` 运行目录，将 `results.json` 随检查进度写入并在控制台输出位置。专项验证证据及其实际覆盖范围见[验证记录](Verification.md)。
