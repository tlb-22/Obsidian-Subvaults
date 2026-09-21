# 界面与主题

Subvaults 的自有界面由插件维护结构、尺寸与交互状态，使用 Obsidian 语义变量取得主题配色。原生文件树与右键菜单继续由宿主呈现。

## 职责边界

| 范围 | 实现与样式归属 |
| --- | --- |
| 标题与切换条 | [ExplorerChrome](../../src/FileNavigation/ExplorerChrome.ts) 维护稳定节点；图标保持身份色，`aria-pressed` 同时表达选择状态与驱动选中样式 |
| 创建面板 | [CreatePanel](../../src/Subvaults/CreatePanel.ts) 使用原生 ButtonComponent、SearchComponent，文件夹单选树维护自身行结构与无障碍状态 |
| 图标及颜色弹层 | [AppearancePicker](../../src/Presentation/AppearancePicker.ts) 维护锚定位置、网格、键盘焦点与关闭生命周期 |
| 共用外观 | [Controls](../../src/Presentation/Controls.ts) 提供图标、提示与语义颜色映射；[styles.css](../../src/styles.css) 维护控件布局、圆角、状态及视口边界 |

自有界面以 `sv-ui` 为样式边界，按钮、弹层与选择树使用 `sv-` 类。主题通过继承的语义变量参与呈现。共享按钮规则统一字体、内边距、边框、焦点与禁用状态，具体控件补充自身布局。界面根将宿主 `--radius-s` 解析为局部 `--sv-radius`，矩形控件与容器共用该值；颜色圆环保留圆形几何。

上下操作行等宽对齐，图标保持尺寸，文字随宽度截断；切换图标区域独立横向滚动。外观弹层受视口宽高约束，网格内部滚动。主题变更只重新计算样式，现有节点、草稿与焦点继续使用。

## 配色契约

背景、文字、边框与悬停使用对应的 `--background-*`、`--text-*` 和 `--interactive-*` 变量。主要操作与选择行使用 `--interactive-accent` 配合 `--text-on-accent`，键盘焦点使用强调色轮廓。Subvault 的预设色使用宿主扩展颜色；lime、teal 和 brown 从现有主题色混合取得，配置仍保存颜色身份。

外部已打开文件复用原生条目的状态配色，附加斜体与分组线。插件的自有控件规则仅作用于 `sv-ui` 内部。

## 依据与验证

官方约定来自 Obsidian 的[样式说明](https://docs.obsidian.md/Reference/CSS%20variables/About%20styling)及[颜色变量](https://docs.obsidian.md/Reference/CSS%20variables/Foundations/Colors)：插件可通过宿主 CSS 变量适应社区主题，语义色描述交互元素及文字的用途。

主题的额外选择器属于各主题实现；源码观察与实际兼容结果以[验证记录](Verification.md)为准。[主题验收脚本](../../tests/obsidian/verify-appearance.cjs) 在 Debug-Vault 临时加载主题样式，检查控件几何、配色和交互，并恢复测试前的主题模式及视图选择。
