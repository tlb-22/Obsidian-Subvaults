# Subvault 管理

本能力实现[管理需求](../Requirements/Subvaults.md)。[SubvaultCatalog](../../src/Subvaults/SubvaultCatalog.ts) 是应用操作入口，管理创建、外观修改、移除及文件夹生命周期。

## 操作流程

用户意图进入 Catalog 的串行操作队列，读取当前清单及文件夹存在性，调用纯规则生成下一份清单，再交给存储边界提交。保存成功后发布新清单，呈现层显示结果。

文件夹重命名和删除属于已经发生的外部事实。Catalog 先更新受影响的绑定并发布，再尝试保存；保存失败作为独立结果反馈。详细完成点见[数据与提交](PluginData.md)。

## 源码职责

| 模块 | 责任与输入 / 输出 | 源码 |
| --- | --- | --- |
| 领域值与规则 | 有效身份、路径及外观；当前清单与文件夹事实 → 创建结果或变更后的清单 | [Subvault](../../src/Subvaults/Subvault.ts) |
| 配置操作 | 用户意图或文件夹变化 → 已完成结果或预期失败；串行维护唯一性检查与提交 | [SubvaultCatalog](../../src/Subvaults/SubvaultCatalog.ts) |
| 文件夹选择规则 | 路径、展开集合及搜索词 → 可见层级行 | [FolderChoices](../../src/Subvaults/FolderChoices.ts) |
| 创建交互 | 草稿、单选状态、提交占用及局部树更新 | [CreatePanel](../../src/Subvaults/CreatePanel.ts) |
| 管理菜单 | 原生右键菜单 → 外观或移除意图 | [SubvaultMenu](../../src/Subvaults/SubvaultMenu.ts) |
| 外观选择与反馈 | 图标与预设色网格、弹层生命周期及英文失败说明 | [AppearancePicker](../../src/Presentation/AppearancePicker.ts)、[SubvaultFeedback](../../src/Subvaults/SubvaultFeedback.ts) |

图标与预设色共用锚定弹层、方形单元及选择状态样式。图标清单由 [IconChoices](../../src/Presentation/IconChoices.ts) 维护，选用[候选库](IconChoices.md)中的首批 49 项及其顺序，通过宿主绘制为七列七行网格；打开时完整渲染，滚动范围固定，选中项保留原位。12 个预设色以空心圆环排列为六列两行。单元只显示图形，控件名称通过原生延迟提示提供；键盘方向键在网格中移动焦点。弹层处理外部点击、Escape、窗口变化及关闭后的资源释放。

创建面板顶部的图标与颜色按钮、底部的取消与创建按钮共用等宽填满整行的布局。外观按钮保留图形尺寸，文字随可用宽度收缩并以省略号截断，完整标签由原生延迟提示提供。文件夹选择区域包含搜索及单选树，并使用统一边框容器；树行沿用 Obsidian 样式，维护自身的搜索、展开和选择会话。面板覆盖文件导航期间，覆盖范围内的其他控件暂时不可交互，关闭后恢复。

共用控件规则由 [Controls](../../src/Presentation/Controls.ts) 与 [styles.css](../../src/styles.css) 维护：新增矩形控件和容器的圆角统一使用宿主 `--radius-s`；容器通过独立的无障碍标签命名，避免 Obsidian 将容器的 `aria-label` 转为悬浮提示。

预期失败包括工作文件夹不可用、同路径已绑定、待操作 subvault 已移除和配置保存失败。业务失败值由呈现边界转换为英文信息；名称始终从工作文件夹路径推导。

运行时事件来源及 UI API 见 [Obsidian 接入](ObsidianIntegration.md)，验证范围见[验证记录](Verification.md)。
