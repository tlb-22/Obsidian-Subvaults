# 数据与提交

插件 ID 由 [manifest](../../manifest.json) 定义为 `subvaults`。长期数据通过 Obsidian 的 `Plugin.loadData()` 和 `Plugin.saveData()` 读写该插件目录下的 `data.json`。入口将这两个公开 API 连接到项目的解码与保存模块。[官方 API 说明](https://github.com/obsidianmd/obsidian-api)

## 状态所有权

| 状态或事实 | 唯一所有者及生命周期 |
| --- | --- |
| 当前 subvault 清单及排列顺序 | [SubvaultCatalog](../../src/Subvaults/SubvaultCatalog.ts)，随插件会话存活 |
| 当前选择及各视图滚动位置 | [NavigationSession](../../src/FileNavigation/NavigationSession.ts)，随插件会话存活并保存恢复值 |
| 已成功保存的文档快照及写入队列 | [PluginPersistence](../../src/Persistence/PluginPersistence.ts)，仅用于合并存储片段和确认提交 |
| 创建草稿、搜索和单选树展开状态 | [CreatePanel](../../src/Subvaults/CreatePanel.ts)，随创建交互存活 |
| 文件夹名称、路径、内容 | Obsidian vault；名称从绑定路径推导 |
| 打开的文件、原生排序和原生展开状态 | Obsidian 工作区与文件导航；[OpenFiles](../../src/FileNavigation/OpenFiles.ts) 按需读取真实文件视图，外部文件列表由这些事实和当前绑定推导，不写入插件数据 |
| 原生接入句柄、DOM 节点及事件监听 | 创建它们的适配器或呈现对象，由 [PluginSession](../../src/App/PluginSession.ts) 的组件生命周期协调释放 |

## 文档格式与保存

[PluginDocument](../../src/Persistence/PluginDocument.ts) 定义版本为 `1` 的存储格式，包括 subvault 清单和 navigation 恢复数据。Subvault 数组的元素顺序就是切换条顺序；领域对象只保存身份、工作路径及外观，存储解码负责验证值、清单唯一性和滚动记录。

首次使用且没有存储数据时初始化空清单。格式错误明确中止加载并提示检查文件，保留原始数据。恢复完成后，当前 vault 中已经不存在的工作文件夹通过 Catalog 的文件夹删除处理移除；失效的当前选择回到 `All`。

Persistence 串行处理各能力的更新，每次基于上一份成功写入的文档合并目标片段。异步写入失败时，已提交快照保持原值，调用者收到失败；后续操作可继续提交。

## 完成与失败

- 用户发起的创建、排序、外观修改和移除：保存成功后更新清单并发布，保存失败保留当前清单。
- 已观察到的文件夹变化：先反映真实文件状态，再报告保存结果。保存失败不会撤销已经发生的文件操作。
- 视图切换：立即更新导航会话并提交恢复数据。滚动变化合并保存，卸载时再次提交最新恢复值。
- 真实文件创建：完成点和错误由原生文件创建流程决定。

数据格式的完整字段、局部验证和合并步骤以源码为准。当前自动化覆盖的并发及失败边界见[验证记录](Verification.md)。
