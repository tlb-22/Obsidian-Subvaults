# README 截图

截图工具从固定样例启动真实 Obsidian，分别生成英文和简体中文界面的 All、Research 和新建 subvault 三个场景，以三列表格展示在对应 README 中。文件名沿用 ECMenu 的版本与语言约定，例如 `all-v0.1.0-en.png`、`subvault-v0.1.0-zh-Hans.png` 和 `create-v0.1.0-en.png`。版本来自根目录 `manifest.json`。

## 运行

在已安装 Obsidian 的 macOS 上，使用 Node.js 24 或更新版本和 `package.json` 固定版本的 pnpm：

```sh
pnpm install --frozen-lockfile
pnpm run screenshots
```

命令构建插件、重建 `TestVaults/Debug-Screenshot-Vault/`、依次启动两个语言实例，并生成 `.docs/images/` 中的六张图片。全部场景通过检查后更新 README 引用，删除本工具管理的旧版本图片。运行期间会显示截图窗口，应让脚本自行完成场景切换。

截图 vault 是可重建的样例环境，手工编辑内容会在下次运行时重置。笔记和布局的维护入口是 [Scenarios.ts](../../scripts/screenshots/Scenarios.ts) 与 [ScreenshotVault.ts](../../scripts/screenshots/ScreenshotVault.ts)。普通开发继续使用 `TestVaults/Debug-Vault/`。

应用默认位于 `/Applications/Obsidian.app`。非标准安装可设置 `SUBVAULTS_OBSIDIAN_EXECUTABLE` 指向应用可执行文件；`SUBVAULTS_OBSIDIAN_PROFILE` 指向已安装 Obsidian 的配置目录，用于读取更新后的应用包。所有项目路径从脚本所在位置推导，支持项目整体移动或重命名。

## 画面与输出

| 场景 | 文件导航 | 展示目的 |
| --- | --- | --- |
| All | Learning、Research、Leisure 三个文件夹，共七篇笔记 | 同一 vault 中的多种用途，以及底部切换入口 |
| Research | 研究文件夹及一个 Papers 子目录；分割线下显示已打开的 Learning/Reading plan | 以文件夹为根的导航、图标颜色，以及外部打开文件 |
| Create | 选中 Leisure 文件夹、游戏手柄图标和橙色，Create 按钮可用 | 从已有文件夹创建具有明确用途的 subvault |

使用默认浅色主题、1120 × 520 逻辑窗口尺寸和 2 倍像素密度。捕获范围取自文件导航面板的实际边界，包含原生工具栏、文件树或创建表单，以及底部切换条。README 使用三列等宽的 HTML 表格，每张图目标宽度为 240 像素，窄预览中随列宽等比例缩小。样例预先配置 Learning、Research 两个 subvault，Leisure 留作创建场景。笔记内容与插件的英文标签在两个语言版本中一致；Obsidian 原生界面使用各自语言。

`.docs/images/` 中的 PNG 和 README 引用一起提交。每次捕获使用带时间戳的同一运行名，将独立应用配置、进程日志、原始截图与场景记录分别写入 `.artifacts/scratch/` 下的 `tests/`、`logs/`、`previews/`。`screenshots.json` 随原始图片保存在该次 `previews/` 目录中。目录约定与清理边界见[开发产物](DevelopmentArtifacts.md)。

## 过期检查

```sh
pnpm run screenshots:check
```

该命令无需启动 Obsidian，可直接用于 GitHub Actions。它根据 `manifest.json` 的版本检查六张图片是否存在，以及两个 README 是否引用各自语言的当前版本图片。它只读取仓库文件，清理本地产物后仍可执行。

过期判断以插件版本为边界。同版本下修改界面或升级宿主后，需要主动重新截图并查看画面。

## 实现边界

- [捕获入口](../../scripts/capture-readme-images.ts) 编排构建产物、样例、宿主和发布；同项目同时只允许一个捕获任务。
- [ObsidianApp.ts](../../scripts/screenshots/ObsidianApp.ts) 使用独立应用配置启动本次截图进程，仅复制本机已安装的更新应用包。语言设置和插件启用保存在该独立配置中，进程在完成或失败后关闭。
- [HostScene.ts](../../scripts/screenshots/HostScene.ts) 在操作前核对 vault 路径，验证插件版本、原生控件语言、活动笔记、文件分组及创建表单选择，等待字体和布局完成。它通过真实切换按钮、原生文件树及创建控件生成场景，并返回面板边界。
- [DevTools.ts](../../scripts/screenshots/DevTools.ts) 仅连接截图实例公布的本机端点，使用 [Chromium 页面截图接口](https://chromedevtools.github.io/devtools-protocol/tot/Page/#method-captureScreenshot) 捕获应用内容。
- [ImageRules.ts](../../scripts/screenshots/ImageRules.ts) 保存纯检查规则和 README 区块生成；[ImageFiles.ts](../../scripts/screenshots/ImageFiles.ts) 负责文件读取、摘要及发布。记录只包含相对文件名、摘要和场景事实。

专用 vault 通过生成标记确认归属；已有目录缺少标记或路径为符号链接时，准备过程报错。应用启动、语言切换、宿主验证或截图失败时，命令退出并保留诊断日志。捕获过程以 SHA-256 核对原始图片，并在发布前再次核对源码摘要，避免将运行中发生变化的源码与截图配对。源码摘要覆盖插件源码、样式、构建及截图脚本、manifest 和依赖配置，以相对路径和文件内容计算；这些捕获验证数据保存在本次运行记录中。

Electron 的 [远程调试开关](https://www.electronjs.org/docs/latest/api/command-line-switches#--remote-debugging-portport) 和 Chromium 截图协议是公开接口。Obsidian 的启动配置、语言存储、插件启用及文件树操作属于本机实测的内部接入方式，集中在上述适配模块；升级宿主后应重新验证。已验证环境及结果见[验证记录](Verification.md)。
