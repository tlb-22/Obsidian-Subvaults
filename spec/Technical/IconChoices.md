# 图标候选库与首批名单

本页维护 subvault 图标的完整候选库、首批选用范围及筛选依据。候选库共 **57 个**图标，其中 **49 个**用于选择器，按七列排列为七行；另外 **8 个**保留供后续扩充。

首批名单由 [IconChoices](../../src/Presentation/IconChoices.ts) 实现，选择交互见 [Subvault 管理](Subvaults.md)，已完成的宿主验证见[验证记录](Verification.md)。

## 完整候选库

图标使用 Lucide 名称，通过 Obsidian 提供的图形呈现。下表是候选及首批归属的唯一名单；首批顺序按表格从上到下、单元格内从左到右读取。用途分组用于说明选择依据，界面呈现为连续网格。

| 用途 | 首批选用，共 49 个 | 保留候选，共 8 个 |
| --- | --- | --- |
| 收纳与归档 | `folder`、`box`、`archive`、`inbox`、`file-text` | — |
| 工作与计划 | `briefcase`、`building-2`、`users`、`target`、`list-todo`、`flag` | `check-square` |
| 阅读与研究 | `book-open`、`graduation-cap`、`microscope`、`flask-conical` | `book` |
| 记录与想法 | `notebook-pen`、`calendar`、`lightbulb`、`bookmark` | — |
| 技术与数据 | `code`、`terminal`、`database` | `cpu`、`wrench`、`git-branch` |
| 创作与娱乐 | `pencil`、`palette`、`camera`、`music`、`film`、`gamepad-2` | — |
| 生活与健康 | `house`、`heart`、`dumbbell`、`paw-print` | — |
| 财务与饮食 | `wallet`、`shopping-cart`、`receipt`、`utensils` | — |
| 旅行与自然 | `plane`、`compass`、`map-pin`、`leaf`、`sprout` | — |
| 沟通与协作 | `message-square` | `mail`、`phone` |
| 私密资料 | `lock`、`shield`、`key` | `fingerprint` |
| 自由标识 | `star`、`circle`、`triangle`、`hexagon` | — |

## 筛选依据

- 用途覆盖：同时容纳工作、知识整理、创作、生活、财务和兴趣，使不同使用习惯都能找到直观标识。
- 图形辨识：优先选择在侧栏小尺寸下轮廓清楚、容易区分的图形；简单几何符号供用户自行赋予含义。
- 首批取舍：49 项兼顾用途覆盖和网格长度。相近表达及更具体的技术、联系渠道图标保留在候选库中，扩充时可直接重新选择。

## 调研依据与适用范围

- **参考实现观察**：[obsidian-spaces 默认清单](../../reference/obsidian-spaces/src/ui/iconPicker.ts)及其[初始预设](../../reference/obsidian-spaces/src/ui/createSpaceForm.ts)提供文件夹、工作、学习、创作和技术图标的手选样本。
- **官方接口约定**：[Firefox 容器图标名单](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/contextualIdentities/getSupportedIcons)覆盖工作、财务、购物、饮食、宠物、自然及度假，作为用途覆盖的参考。
- **公开用户需求**：[工作空间图标定制请求](https://github.com/NousResearch/hermes-agent/issues/79233)提出按工作、研究、实验、开发、创作、数据和安全等角色挑选图标。这是用户提出的方案，不能作为已实现功能或使用频率的证据。

本页名单是基于这些样本及 subvault 场景的设计选择。图标名称查阅 [Lucide 目录](https://lucide.dev/icons/)，宿主绘制边界见 [Obsidian 接入](ObsidianIntegration.md)。图标可用性与布局的实机证据统一维护于[验证记录](Verification.md)。
