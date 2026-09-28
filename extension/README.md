# Full Context Canvas · Chrome 插件

把你 Chrome 里的全部书签放到神经元画布上，按内容自动分组。一个书签可以同时属于几个组，每次归位都写明理由和把握度。你的书签本身永远不会被修改。

## 安装（开发版，约 1 分钟）

1. 打开 `chrome://extensions`，打开右上角的 **开发者模式**。
2. 点 **加载已解压的扩展程序**，选择这个仓库里的 `extension/dist` 文件夹。
3. 安装后会自动打开画布。之后点浏览器工具栏里的 S 形图标就能再次打开。

## 连接 Claude（可选，但推荐）

1. 在插件的 **设置** 页填入 Claude API key，点 **测试连接**。
2. 点 **重新整理全部书签**，Claude 会重新分组，并给每一条写理由。

没有 key 时插件用离线关键词规则整理，所有归位都会标成"拿不准"。整理时，书签的标题、网址和所在文件夹会发给 Claude；key 只保存在你这台电脑的浏览器里。

## 会发生什么

- 新建、删除、移动、改名书签：画布实时更新，新书签会飞进它的组里。
- 你在画布上点"对"或"不属于这里"：会被保存，下次同步不会覆盖。
- 任意一个组或交汇点：点「复制为 AI 上下文」，粘贴进 Claude、ChatGPT 或 Gemini。

## 开发

```bash
cd extension
npm install
npm run build   # 从 ../prototype/app.html 生成画布页面，把 Anthropic SDK 打包进 background.js
```
