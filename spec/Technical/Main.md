# 技术文档

Subvaults 按 Subvaults 和 FileNavigation 两个业务能力组织。插件入口连接唯一会话，持久化边界协调同一份 `data.json`，原生文件导航内部接口集中在适配文件中。

## 导航

- [代码组织与职责边界](CodeOrganization.md)：能力归属、依赖方向及 ECMenu 组织模式的采用方式。
- [Subvault 管理](Subvaults.md)：配置操作、文件夹事件与创建交互。
- [图标候选库与首批名单](IconChoices.md)：完整候选、首批选用范围及调研依据。
- [文件导航](FileNavigation.md)：显示投影、稳定界面与状态恢复。
- [数据与提交](PluginData.md)：状态所有权、存储格式与完成边界。
- [界面与主题](InterfaceAppearance.md)：自有控件的布局、主题配色与原生文件树的样式边界。
- [Obsidian 接入](ObsidianIntegration.md)：公开 API 与文件导航内部接口的输入、输出和适用范围。
- [README 截图](ReadmeScreenshots.md)：专用样例 vault、中英文场景生成与版本过期检查。
- [开发产物](DevelopmentArtifacts.md)：分类目录、运行标识及清理边界。
- [检查与发布](ContinuousIntegration.md)：GitHub Actions 检查、版本标签及 Release 附件。
- [验证记录](Verification.md)：自动化、实机验证入口与当前证据。

产品行为以[需求](../Requirements/Main.md)为准。源码承担完整类型定义和局部算法，本文档集合维护跨文件协作、数据和宿主边界。
