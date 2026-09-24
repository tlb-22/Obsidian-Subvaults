# Subvaults

<p align="center">
  <a href="README.md">English</a> ·
  <strong>简体中文</strong>
</p>

Subvaults 让你在 Obsidian 中将不同文件夹作为独立空间浏览，同时共用一个 vault 和一套设置。工作、学习和生活笔记可以放在一起，文件导航则聚焦于当前需要的文件夹。

本项目受到 [obsidian-spaces](https://github.com/psjdev/obsidian-spaces) 的启发。

## 功能

- **文件夹视图。** 将任意文件夹创建为 subvault，选择图标和颜色。名称跟随文件夹，重命名和移动后自动追踪。
- **快速切换。** 通过文件导航底部的图标切换视图，点击 **All** 查看整个 vault。
- **原生导航。** 沿用 Obsidian 的排序、文件夹展开状态和文件交互。文件导航中的新建笔记与新建文件夹操作以当前 subvault 为根目录。
- **访问已打开的文件。** 当前 subvault 之外的已打开文件显示在分割线下方，名称使用斜体。

<!-- screenshots:start -->

<table>
  <tr>
    <th width="33.33%">All</th>
    <th width="33.33%">Research</th>
    <th width="33.33%">新建 subvault</th>
  </tr>
  <tr>
    <td><img src=".docs/images/all-v0.1.3-zh-Hans.png" width="240" alt="All：在同一 vault 中组织学习、研究与娱乐"></td>
    <td><img src=".docs/images/subvault-v0.1.3-zh-Hans.png" width="240" alt="Research subvault：聚焦研究文件夹，并保留已打开的学习笔记"></td>
    <td><img src=".docs/images/create-v0.1.3-zh-Hans.png" width="240" alt="为 Leisure 文件夹创建 subvault，使用橙色游戏手柄图标"></td>
  </tr>
</table>

<!-- screenshots:end -->

## 安装

需要 Obsidian 桌面端 1.13.7 或更高版本。插件界面目前为英文。

1. 打开 [Latest Release](https://github.com/tlb-22/Obsidian-Subvaults/releases/latest)，下载并解压 ZIP 压缩包，或单独下载 `main.js`、`manifest.json` 和 `styles.css`。
2. 将这三个文件放入 `<vault>/.obsidian/plugins/subvaults/`，如果目录不存在则先创建。
3. 重新加载 Obsidian，在“设置 → 第三方插件”中启用 **Subvaults**。

## 使用

1. 点击文件导航底部的 **+**。
2. 选择工作文件夹，通过 **Icon** 和 **Color** 设置外观。
3. 点击 **Create**，随后使用底部图标切换视图。拖动 subvault 图标可调整顺序，顺序自动保存。
4. 右键点击 subvault 图标可修改外观或移除视图。移除 subvault 会保留对应文件夹和文件。

## 源码构建

需要 Node.js 24 或更高版本，以及 `package.json` 固定版本的 [pnpm](https://pnpm.io/installation)。在项目目录执行：

```sh
pnpm install --frozen-lockfile
pnpm run build
```

插件文件生成在 `dist/` 中。开发与验证的详细说明见[项目规格](spec/Main.md)。

## 许可证

[MIT](LICENSE)
