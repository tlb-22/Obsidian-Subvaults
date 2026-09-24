# 开发产物

项目路径统一由 [project-paths.cjs](../../scripts/project-paths.cjs) 从模块位置推导。`dist/` 保存编译输出，`TestVaults/` 保存 Obsidian 测试 vault，`.docs/images/` 保存随仓库提交的 README 图片。`.artifacts/` 仅设 `releases/` 和 `scratch/` 两个一级目录，分别保存版本发布文件与临时运行产物：

| 目录 | 内容 | 生命周期 |
| --- | --- | --- |
| `.artifacts/scratch/logs/<run>/` | 应用进程日志 | 单次运行 |
| `.artifacts/scratch/tests/<run>/` | 测试报告、截图实例的独立应用配置 | 单次运行 |
| `.artifacts/scratch/probes/<run>/` | 调查脚本、接口探测与专项检查证据 | 单次调查 |
| `.artifacts/scratch/previews/<run>/` | 原始截图与场景记录 | 单次运行 |
| `.artifacts/releases/<version>/` | 三个安装文件及版本化 ZIP | 按发布版本保存 |

`<run>` 使用 `YYYYMMDD-HHMMSS-SSS-<purpose>-<pid>`，时间为 UTC，`SSS` 为毫秒。时间顺序便于查找，用途说明任务，进程号区分并发调用。例如 `20260919-150000-123-readme-capture-12345`。同次任务的日志、配置和图片使用相同运行名，分类目录按实际需要创建。

[artifact-run.cjs](../../scripts/artifact-run.cjs) 为命令行工具和 Obsidian 宿主验收共用的分配入口。运行目录通过独占创建避免覆盖历史记录；宿主验收先检查 vault 归属，再创建产物目录。`readme-capture.lock` 是截图任务的固定互斥文件，位于 `scratch/probes/`，完成或失败后移除。

## 本地配置

项目根目录的 `config.local.json` 保存本机配置，其中 `defaultVaultPath` 是 Default Vault 的绝对路径，供本地版本更新时确定构建安装目标。同步时读取该字段，将 `dist/` 的三个安装文件复制到目标 vault 的 `.obsidian/plugins/subvaults/`，保留 `data.json`。

该文件由 Git 忽略；个人路径只写在此文件中。其他开发者按自己的目录创建配置，例如：

```json
{
  "defaultVaultPath": "/absolute/path/to/vault"
}
```

常规构建和 CI 不依赖本地配置。

## 维护

项目历史由 Git 管理，依赖缓存使用包管理器的共享存储。仅在修改 Git 未覆盖且无法重建的用户数据时，按需将临时回退副本放入对应任务的 `scratch/probes/<run>/before/`。

任务结束后，将必要的验证结论记录到 `spec/`，再清理其 scratch 产物；临时回退副本在操作验证完成后清理。没有相关任务运行或待验收数据时，可以删除整个 `scratch/`。可重复执行的逻辑放在 `scripts/`、`tests/`；`releases/` 按版本保留。`.artifacts/` 由 Git 忽略。

[README 截图](ReadmeScreenshots.md) 将原始图片、场景记录、进程配置和日志写入同名分类目录；完整检查后的图片才发布至 `.docs/images/`。宿主验收每次创建独立的 `host-verification` 或 `interaction-verification` 运行目录，将 `results.json` 随检查进度写入并在控制台输出位置。专项验证证据及其实际覆盖范围见[验证记录](Verification.md)。
