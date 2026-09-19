# 验证记录

## 自动化入口

| 命令 | 验证范围 | 当前结果 |
| --- | --- | --- |
| `npm run check` | 严格 TypeScript 类型检查，包括测试源码 | 通过 |
| `npm test` | 10 项纯规则与应用协作测试，1 项开发目录搬迁测试，3 项截图工具测试 | 通过 |
| `npm run sync:debug` | 构建插件并同步到固定 Debug-Vault，保留插件数据 | 已执行 |
| `npm run screenshots` | 独立截图 vault 中的中英文 All、Research 四张真实界面 | 通过 |
| `npm run screenshots:check` | 当前版本图片的存在性及 README 引用 | 通过 |
| `npm run package:release -- 0.1.0` | 发布版本一致性、三个安装文件与 ZIP 内容 | 通过 |

[领域测试](../../tests/domain.test.ts) 覆盖重复绑定、重叠文件夹、祖先路径变化、路径段边界、外部文件去重、文件夹搜索和存储格式错误。[应用测试](../../tests/application.test.ts) 覆盖异步创建的唯一性、提交失败与重试、真实删除后的保存失败、共享文档并发写入及导航恢复。

[开发目录测试](../../tests/tooling.test.ts) 将项目副本移动到包含空格及中文的新名称目录，再从无关工作目录执行构建、同步和发布打包；核对输出归属、文件及 ZIP 内容、产物分类与共享运行名，并验证版本不符与重复打包会报错，宿主入口拒绝其他 vault 且不创建产物。

[截图工具测试](../../tests/screenshots.test.ts) 覆盖版本图片缺失、捕获过程中源码或图片变化、语言不符、README 区块更新，以及拒绝覆盖未标记的现有 vault。[截图流程](ReadmeScreenshots.md) 已在下述 macOS 宿主版本上执行，四张图片经查看确认 All 与 Research 导航、外部文件分组及本地化状态栏正确；场景记录保存在该次 `.artifacts/scratch/previews/<run>/screenshots.json`。其他操作系统的捕获尚未实现，无界面检查仅依赖 Node.js 文件接口。

[GitHub Actions](ContinuousIntegration.md) 已于 2026-09-19 在项目 private repo 完成实测：[主分支检查](https://github.com/tlb-22/Obsidian-Subvaults/actions/runs/35453000270)通过且跳过发布，[0.1.0 标签流程](https://github.com/tlb-22/Obsidian-Subvaults/actions/runs/35453078276)完成检查与发布。下载的四个 Release 附件与对应 CI 产物逐字节一致，三个安装文件也与本地构建一致；ZIP 根目录恰含这三个文件且内容一致。日志及核对结果按 `ci-verification` 运行保存于 `.artifacts/scratch/`。

## 实机环境与入口

- Obsidian 应用版本：1.13.7；安装器版本：1.6.5。
- Vault：项目内 `TestVaults/Debug-Vault/`，使用默认主题及英文界面。
- [测试样本准备](../../scripts/prepare-debug.mjs)：现存文件保持原样，补充基本文件夹及 160 个长列表样本。
- [宿主验收脚本](../../tests/obsidian/verify.cjs)：通过 Debug-Vault 的开发控制台执行，内置 vault 路径检查；结果写入 `.artifacts/scratch/tests/<run>/results.json`，运行用途为 `host-verification`。
- [交互补充验证](../../tests/obsidian/verify-interactions.cjs)：检查路径提示、真实拖放、新建文件夹、逐帧显示及提示清理；结果同样按运行保存，用途为 `interaction-verification`。逐帧检查要求测试窗口保持可见。

在测试 vault 的开发控制台执行：

```js
(() => {
  const script = require('node:path').resolve(app.vault.adapter.getBasePath(), '../../tests/obsidian/verify.cjs');
  delete require.cache[require.resolve(script)];
  return require(script)(app);
})()
```

将文件名换为 `verify-interactions.cjs` 可执行补充验证。脚本会创建测试 subvault、操作指定测试文件夹、打开标签页、执行原生新建，并验证插件卸载和重新加载。

[开发路径](../../scripts/project-paths.cjs) 从模块位置推导项目根目录，供构建、同步、样本准备及宿主验收共用。[宿主入口检查](../../tests/obsidian/debug-vault.cjs) 使用 `FileSystemAdapter.getBasePath()` 和真实目录路径，确保验收只操作该项目的 `TestVaults/Debug-Vault`。项目可以整体移动或重命名；内部测试目录结构保持约定，构建脚本可从其他工作目录调用。

`npm run dev` 监听 TypeScript 源码，将开发构建写入 `dist/`；启动构建时同时复制 `src/styles.css` 和 manifest。修改 CSS 后运行 `npm run sync:debug` 并重新加载插件以检查效果。同步目录由构建 manifest 的插件 ID 决定。`TestVaults/`、`dist/` 和 `.artifacts/` 均为本地开发目录，由 Git 忽略。

## 当前实机证据

验证日期：2026-09-19。已同步构建并重新加载 Debug-Vault。

宿主验收报告按运行保存于 `scratch/tests/`，下述专项检查证据按用途保存于 `scratch/probes/<run>/`；完整目录约定见[开发产物](DevelopmentArtifacts.md)。

当前安装标识为 `subvaults`，显示名称为 `Subvaults`。实机启用和重载验证确认 3 个已有 subvault 的配置完整保留，文件导航仅有一份切换条，创建面板的 `Icon`、`Color` 标签正常；证据为 `identity-review` 调查中的 `identity-review.json`。

核心宿主验收 10 项通过：显示根与重叠绑定、6 种原生排序、外部文件去重及最后标签页关闭、展开状态和标签页保持、160 文件长列表滚动恢复、重复创建拒绝、祖先重命名及删除追踪、创建取消、新建入口边界、卸载和重载恢复。

补充交互已通过 3 项：外部文件完整路径的原生延迟提示及悬停预览事件、空白处和子文件夹的真实拖放移动、工具栏新建文件夹的位置。右键移除配置及切到 Search 面板后隐藏切换条也已人工操作确认。

创建界面的实机结构与布局测量已确认：容器无提示标签；文件夹选择区域有统一圆角边框；图标和颜色以无文字网格呈现。图标网格没有搜索输入，单元约 35 × 35 px，图形为 20 × 20 px。预设色选择能更新草稿。当前默认主题下，分割线距前一行和后一行选中背景边缘分别约 9 px、8 px；新增矩形圆角均继承同一宿主变量。测量证据为 `ui-review` 调查中的 `ui-review.json`，视觉参数的实现归属为样式文件。

切换图标的提示内容与工作文件夹路径逐项一致，嵌套路径的原生延迟提示正常显示。创建面板在 140、180、240、320 px 的宽度测量下，上下两行按钮均等宽铺满且对齐，图标与文字处于按钮内部；窄布局的外观标签截断，控件保留完整提示标签。图标与颜色选择器打开、创建的有效性限制和取消通过，证据为 `create-layout-review` 调查中的 `create-layout-review.json`。

图标选择器的宿主检查确认：49 个图标及其顺序与[首批名单](IconChoices.md)逐项一致，全部由宿主正常绘制为七列七行；打开时完整渲染，滚动前后列表范围一致，选择末项后重新打开仍在原位，方向键按七列移动焦点。证据为 `icon-review` 调查中的 `icon-review.json`。12 个颜色的实机测量与截图检查确认空心圆环排列为六列两行，颜色选择及重新打开后的选中状态恢复通过，证据为 `picker-review` 调查中的 `picker-review.json`。全部预设色通过存储格式往返验证；样式源码、构建输出与 Debug-Vault 安装文件一致。

## 未验证范围

逐帧连续采样与补充脚本的卸载提示清理尚未形成完成记录；窗口隐藏会暂停动画帧，不能据此判断闪动。核心脚本已验证标题节点身份稳定和插件卸载恢复。其他 Obsidian 版本、非默认主题、多窗口组合和第三方文件树替换仍需各自的实机验证。

## 公开文件检查

当前工作树中的源码、脚本、测试、文档、依赖锁文件及构建产物已检查本机用户目录路径、凭据格式、私人邮箱与旧插件标识；内嵌 source map 解码后另行检查，源码定位均为相对路径。检查未发现匹配项，中英文 README 的本地链接有效，证据为 `public-file-review` 调查中的 `public-file-review.json`。该检查覆盖当前可发布文件；Git 历史及被忽略的本地开发数据不在此范围内。
