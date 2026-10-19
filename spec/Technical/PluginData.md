# 数据与提交

插件 ID 由 [manifest](../../manifest.json) 定义为 `subvaults`。配置通过 Obsidian 的 `Plugin.loadData()` 和 `Plugin.saveData()` 读写插件目录下的 `data.json`；浏览恢复状态通过 `App.loadLocalStorage()` 和 `App.saveLocalStorage()` 保存到按 vault 隔离的本机存储。入口将这些公开 API 连接到项目的解码与保存模块。[官方 API 说明](https://github.com/obsidianmd/obsidian-api)

## 状态所有权

| 状态或事实 | 唯一所有者及生命周期 |
| --- | --- |
| 当前 subvault 清单、排列顺序及配置操作队列 | [SubvaultCatalog](../../src/Subvaults/SubvaultCatalog.ts)，随插件会话存活 |
| 当前选择及各视图滚动位置 | [NavigationSession](../../src/FileNavigation/NavigationSession.ts)，随插件会话存活并保存本机恢复值 |
| 创建草稿、搜索和单选树展开状态 | [CreatePanel](../../src/Subvaults/CreatePanel.ts)，随创建交互存活 |
| 文件夹名称、路径、内容 | Obsidian vault；名称从绑定路径推导 |
| 打开的文件、原生排序和原生展开状态 | Obsidian 工作区与文件导航；[OpenFiles](../../src/FileNavigation/OpenFiles.ts) 按需读取真实文件视图，外部文件列表由这些事实和当前绑定推导，不写入插件数据 |
| 原生接入句柄、DOM 节点及事件监听 | 创建它们的适配器或呈现对象，由 [PluginSession](../../src/App/PluginSession.ts) 的组件生命周期协调释放 |

## 文档格式与保存

[PluginDocument](../../src/Persistence/PluginDocument.ts) 定义配置与导航的存储边界。`data.json` 只包含 `subvaults` 清单；数组元素顺序就是切换条顺序，每项保存身份、工作路径及外观。本机导航记录在 `subvaults:navigation` 键下保存 `selection` 和 `positions`，分别表示当前选择和各视图滚动位置。存储解码验证领域值、清单唯一性和滚动记录。

首次使用且没有配置时初始化空清单；本机导航记录缺失时从 `All` 和顶部开始。格式错误明确中止加载并显示原因，保留原始数据。恢复完成后，当前 vault 中已经不存在的工作文件夹通过 Catalog 的文件夹删除处理移除；失效的当前选择回到 `All`。

[PluginPersistence](../../src/Persistence/PluginPersistence.ts) 分别连接配置和导航存储，加载时只读。Catalog 串行协调配置操作；配置保存失败时，调用者收到失败，后续操作可继续提交。切换和滚动只更新本机导航记录，`data.json` 可由 Git 追踪配置变化。导航状态在同一设备重启后恢复，各设备分别记忆；清空应用本地存储后重新从默认位置开始。

## 完成与失败

- 用户发起的创建、排序、外观修改和移除：保存成功后更新清单并发布，保存失败保留当前清单。
- 已观察到的文件夹变化：先反映真实文件状态，再报告保存结果。保存失败不会撤销已经发生的文件操作。
- 视图切换：立即更新导航会话并保存本机恢复数据。滚动变化合并保存，卸载时再次保存最新恢复值；本机写入失败时直接报告错误。
- 真实文件创建：完成点和错误由原生文件创建流程决定。

数据格式的完整字段、局部验证和保存边界以源码为准。当前自动化覆盖的并发及失败边界见[验证记录](Verification.md)。
