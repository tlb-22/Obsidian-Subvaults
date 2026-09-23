# 文件导航

本能力实现[文件导航需求](../Requirements/FileNavigation.md)。[ExplorerCoordinator](../../src/FileNavigation/ExplorerCoordinator.ts) 将应用状态连接到原生文件导航实例，并随布局变化增减实例。

## 显示流程

Coordinator 为已加载的文件导航创建 ExplorerPane，后台延迟视图在宿主加载并发出布局事件后接入。它从当前 subvault 和工作区仍打开的文件生成显示范围。每个 ExplorerPane 保留独立的原生适配器和界面节点，将范围交给原生树适配器，并更新标题及切换条。

在 subvault 视图中，原生 vault 根查询返回工作文件夹的原生有序子条目，再追加外部已打开文件的原生条目。内部后代继续使用原生查询，外部祖先不参与该视图的层级。`All` 直接使用原生查询结果。

切换时先记住离开视图的滚动位置，在同一同步更新中修改标题与显示范围，再恢复目标位置。外部文件集合变化只更新必要的树投影；标题和切换条按稳定身份更新，现存节点继续使用。

## 源码职责

| 模块 | 责任与输入 / 输出 | 源码 |
| --- | --- | --- |
| 选择与外部文件规则 | 视图身份与打开文件事实 → 外部文件路径集合 | [NavigationState](../../src/FileNavigation/NavigationState.ts) |
| 导航会话 | 当前选择、滚动记录与清单变化 → 视图通知及恢复数据 | [NavigationSession](../../src/FileNavigation/NavigationSession.ts) |
| 实例协调 | 宿主布局与会话 → 每个文件导航的显示范围和生命周期 | [ExplorerCoordinator](../../src/FileNavigation/ExplorerCoordinator.ts) |
| 原生接入 | 显示范围 → 原生条目投影、定位、导航内新建和样式标记 | [NativeExplorer](../../src/FileNavigation/NativeExplorer.ts) |
| 导航呈现 | 清单与选择 → 固定标题、切换条、管理入口 | [ExplorerChrome](../../src/FileNavigation/ExplorerChrome.ts) |
| 切换条拖拽 | 原生拖放事件 → 插入提示、边缘滚动及排序意图 | [SwitcherDrag](../../src/FileNavigation/SwitcherDrag.ts) |

## 操作与稳定性

工具栏的新建操作显式将当前工作文件夹交给原生创建方法。空白处菜单由原生 Menu 构建，将同一目标传给原生创建方法；子文件夹菜单保持原生处理。其他新建入口使用原有函数。

空白处的拖放事件在 subvault 视图中转交工作文件夹自身的原生拖放条目，文件操作继续由原生处理器执行。文件项上的拖放保持原生事件路径。

切换条使用 HTML 拖放事件，只有本条内的 subvault 图标可以发起排序。拖动位置根据包括源按钮在内的按钮中点转换为相邻项的前后位置；插入提示按实际按钮边界居中于间隙，首尾延伸半个间距，并随横向滚动重新定位。提示独立于滚动内容，使用主题强调色，限制在滚动区域及两侧间隙内；靠近区域边缘时按动画帧滚动。拖动开始时通过 [Controls](../../src/Presentation/Controls.ts) 触发原生悬停退出，取消延迟提示并关闭已有提示；拖动期间阻止切换图标的悬停进入事件传到宿主提示处理器，保留无障碍名称。松开后交给 Catalog 保存，取消、移出区域和卸载均清理插入提示与滚动任务。提交后移动已有按钮节点并恢复焦点与切换条滚动位置；当前选择和原生文件树继续使用。存储和预期失败见[Subvault 管理](Subvaults.md)。

外部条目通过专属样式标记区分；首个外部条目的外层容器以顶部内边距容纳分隔线，文件行本身沿用主题的背景、边框和圆角。MutationObserver 在虚拟滚动插入条目后更新标记和完整路径提示，保持同一个滚动容器。具体视觉样式集中在 [styles.css](../../src/styles.css)。

外部文件的普通、悬停和选中配色沿用原生文件树，插件增加斜体与分组线。标题和切换条的控件边界见[界面与主题](InterfaceAppearance.md)。

卸载时解除自有订阅与事件处理，恢复被覆盖的原生方法，移除标题、切换条和自有样式，再请求原生排序。

共享状态归属见[数据与提交](PluginData.md)，接入契约及其限制见 [Obsidian 接入](ObsidianIntegration.md)，验证范围见[验证记录](Verification.md)。
