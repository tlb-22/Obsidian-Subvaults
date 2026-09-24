# Obsidian 接入

当前实现面向桌面端 Obsidian 1.13.7，使用 npm `obsidian` 1.13.1 的公开类型声明。公开接口与文件导航内部接入分开维护：前者依据 SDK，后者依据本机 Debug-Vault 中读取的宿主方法及结构。

## 公开接口

| 调用位置 | API 与输入 | 输出及用途 |
| --- | --- | --- |
| 插件入口 | `Plugin.loadData()`、`saveData(document)` | 恢复数据或异步保存结果；具体语义见[数据与提交](PluginData.md) |
| 会话装配 | `Workspace.onLayoutReady`、`Component.registerEvent` / `register` | 布局就绪与组件清理点 |
| 文件夹管理 | `Vault.getFolderByPath`、`getAllFolders`，`create` / `rename` / `delete` 事件 | 文件夹存在性、选择候选及真实路径变化 |
| 导航协调 | `getLeavesOfType`、`WorkspaceLeaf.isDeferred`、`iterateAllLeaves`、`FileView.file`、`WorkspaceLeaf.getViewState` | 文件导航实例、原生加载状态与工作区标签页的文件路径 |
| 呈现 | `Menu`、`ButtonComponent`、`SearchComponent`、`setIcon`、`setTooltip`、`Notice` | 原生菜单、控件、图标、提示和操作反馈 |

公开接口依据：[官方类型定义仓库](https://github.com/obsidianmd/obsidian-api)、[插件开发文档](https://docs.obsidian.md/)。

Obsidian 1.13.7 的本地源码观察确认：原生提示在带 `aria-label` 的元素上委托处理 `pointerover` / `pointerout`，退出时同时取消显示计时器并移除当前提示。[Controls](../../src/Presentation/Controls.ts) 在切换条拖动开始时发送退出事件，复用这条清理路径；该行为属于宿主实现观察，验证结果见[验证记录](Verification.md)。

## 工作区文件视图

[OpenFiles](../../src/FileNavigation/OpenFiles.ts) 使用 `iterateAllLeaves` 读取各区域的当前视图，已加载视图通过公开的 `FileView`、`navigation` 和 `file` 成员取得允许文件导航的打开文件。对于 `isDeferred` 为真的视图，解析其 `state.file`，再通过内部接口 `app.viewRegistry.getTypeByExtension(file.extension)` 确认保存的视图类型是该文件的注册打开类型。适配器按需读取宿主注册表，不保存扩展名映射或打开文件清单。

Obsidian 1.13.7 本地源码显示，该注册表由宿主和插件的扩展名注册维护；此成员不属于公开 SDK，类型契约集中在 `OpenFiles`。实际观察表明，反向链接、出链和大纲的延迟视图也会保存 `state.file`，加载后继承 `FileView` 但关闭 `navigation`，其文件表示关联目标。宿主的活动文件视图选择也使用这一导航标志。注册外的第三方替代编辑视图及其他宿主版本需要独立验证。

## 原生文件导航内部接口

下列成员未由公开的文件导航 API 承诺，集中在 [NativeExplorer](../../src/FileNavigation/NativeExplorer.ts)。表中宿主行为是在 Obsidian 1.13.7 的 Debug-Vault 中读取方法实现所得的源码观察，实际插件协作结果以[验证记录](Verification.md)为准。

| 成员或结构 | 观察到的输入 / 输出 | 项目使用方式 |
| --- | --- | --- |
| `getSortedFolderItems(TFolder)` | 读取该文件夹 children，按宿主排序并映射为原生条目 | 替换显示根查询；内部内容仍由原方法排序 |
| `fileItems[path]` | 路径对应的原生文件或文件夹条目，包含 `file`、`el`、`selfEl` | 复用文件身份和交互，追加外部已打开文件 |
| `sort()` | 对文件夹排序、设置虚拟根子条目、计算滚动区域，并可能触发自动定位 | 在显示范围变化后同步刷新；本次刷新中的自动定位由适配器约束 |
| `navFileContainerEl` | 原生滚动容器 | 标题置于容器外，内部与外部内容共用滚动 |
| `tree.infinityScroll.compute()` / `scrollIntoView(item, margin)` | 重算可见窗口或定位原生条目 | 恢复滚动及定位外部文件 |
| `revealActiveFile()` / `revealInFolder(file)` | 原生自动定位或显式定位，可能展开祖先 | 外部文件定位限制到已显示的原生文件项 |
| `createAbstractFile(kind, parent, leaf)` | 按类型调用宿主文件创建，完成后进入原生打开或重命名流程 | 工具栏与空白处菜单显式指定 subvault 工作文件夹 |
| `onFileContextMenu(event, file)` | 构造原生菜单及扩展事件 | 仅替换 subvault 空白处以 vault 根为目标的菜单；保留真实子项菜单 |
| `onFilePointerover(event, title)` | 原生文件信息提示与 `hover-link` 事件 | 外部文件使用完整路径的公开 tooltip，同时继续发送文件悬停预览事件 |
| 文件夹条目的原生 drop 监听 | 读取宿主拖动上下文、检查目标并执行文件操作 | 空白处拖放转交当前工作文件夹的原生条目 |

Coordinator 使用公开的 `WorkspaceLeaf.isDeferred` 区分后台占位视图与已加载的文件导航，仅为已加载视图创建适配器。宿主完成延迟加载后发出的 `layout-change` 驱动接入；后台视图保持原生加载时机。`ExplorerView` 集中描述已加载文件导航的内部接口契约。卸载时仅恢复自己仍拥有的方法覆盖；若后续插件包装了本插件的函数，本插件的包装停止应用视图逻辑。

## 适用边界

当前接入限定桌面文件导航。主题样式的适配契约见[界面与主题](InterfaceAppearance.md)，已验证的主题与宿主组合见[验证记录](Verification.md)。其他版本、第三方文件树替换和多窗口组合需要各自的实机证据。

文件夹追踪基于插件运行时的 vault 事件。插件停用期间发生的离线移动没有事件可用于恢复身份；启动时无法解析的绑定按失去工作文件夹处理。外部文件列表只依据当前能解析为真实文件的工作区标签页。

[参考项目](../../reference/obsidian-spaces/README.md) 提供原生条目替换与外部文件分组的方案参考；本项目的接口适配和生命周期由上述源码实现。
