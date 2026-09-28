# 竞品调研与定位（2026-09）

## 一句话结论

"自动收集收藏 + AI 打标签"已经在变成大路货，"跨 AI 的记忆层"也有好几家在做。Full Context Canvas 不能靠"帮你整理"取胜，要靠三件别人没有同时做到的事：

1. **可信**：每一次归位都有理由、有把握度，原件从不移动，拿不准的会主动交给你。
2. **交汇**：把散落在不同平台、不同文件夹里的同一个主题连起来，从收藏里长出新想法。
3. **可带走**：整理好的上下文能一键交给任何一个 AI（现在是复制粘贴，下一步是 MCP）。

## 市场地图

| 类别 | 代表产品 | 他们做到了什么 | 我们的机会 |
|---|---|---|---|
| AI 书签/收藏聚合 | [Bookmarkjar](https://bookmarkjar.com/)、[Dewey](https://getdewey.co/)、[ContextBolt](https://contextbolt.com/blog/best-ai-bookmark-managers/)、Clipmate AI、Burn 451 | 自动导入 X、Reddit、GitHub、YouTube、LinkedIn 的收藏，AI 打标签和摘要，语义搜索 | 他们只给标签，不解释为什么；分类是黑箱，出错了用户不知道。Dewey 的定价从每月 149 美元起，偏向专业创作者 |
| 收藏 + 与资料对话 | [Recall](https://www.recall.it/compare/best-second-brain-apps) | 自动摘要，和自己的资料库对话并引用来源 | 线性列表为主，没有空间结构，也没有"交汇"的概念 |
| 视觉白板 | [Heptabase](https://tana.inc/blog/best-heptabase-alternatives-2026)、Kosmik | 研究卡片在白板上自由摆放和连接 | 需要手动摆放，整理负担仍在用户身上 |
| ADHD 友好的第二大脑 | [Constella](https://www.constella.app/pricing)（无限画布 + AI 自动连接，每月 5.99 美元起）、[Mem、Saner.AI](https://www.saner.ai/blogs/10-best-second-brain-ai-apps) | 不用建文件夹、不用打标签，AI 自己组织 | 以"写笔记"为中心，不接住你在各个平台已经做的收藏 |
| 跨 AI 记忆层 | [MemoryPlugin](https://www.memoryplugin.com/)、[MemoryLake](https://www.memorylake.ai/en/blogs/one-memory-across-chatgpt-claude-gemini)、MemoryX | 用 MCP 让 Claude、ChatGPT、Gemini 读同一份记忆 | 记的是"关于你的事实"，不是"你收藏过的东西"；没有可视化，用户看不见记忆里有什么 |
| 大模型自带 | Claude、ChatGPT、Gemini 的记忆导入 | 2026 年初三家都支持一次性导入对方的记忆 | 一次性快照，导完就开始漂移；每家都只想当中心 |

## 对产品的启示

1. **把"透明"做成可以演示的差异点**。竞品评测里反复出现的是"自动打标签"，没有一家强调"为什么这样分"。可解释性能提升推荐精度和用户信任（见 [PMC 上的实证研究](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC11410769/)），这是我们 pitch 里最该放大的一点。
2. **先赢一个人：重度多平台收藏者，尤其是 ADHD 人群**。Constella 和 Saner.AI 证明了这群人愿意付费，价格锚点在每月 6 到 15 美元。
3. **产品必须"装上就能用"**。竞品的共同点是接入门槛低。我们之前的原型只能看演示，所以这一轮做了 Chrome 插件：安装后直接读取全部书签，新书签自动归位。
4. **"可带走的上下文"是通往跨 AI 记忆层的桥**。先做"复制为 AI 上下文"（已完成），验证用户是否真的会把整理结果交给 AI；数据好的话，再做 MCP server，与 MemoryPlugin 等正面竞争时，我们的优势是"用户看得见、改得了记忆里有什么"。

## 这一轮已经落地的改进

- **Chrome 插件 MVP**（`extension/`）：读取全部书签，不需要导出；新建、删除、移动书签都会实时同步到画布；有 Claude API key 时用 Claude 分组，每条都写理由和把握度，没有 key 时用离线规则并全部标为拿不准；你在画布上的确认和移出会被保存。
- **复制为 AI 上下文**：任意一个组或交汇点，一键复制成带标题、链接、来源、日期和分组理由的 Markdown，直接粘贴进 Claude、ChatGPT 或 Gemini。
- **插件里的综合生成**：填了 key 后，「我的收藏在哪里交汇？」「哪些可以清理？」「我最近在关注什么？」都由 Claude 基于你的真实书签回答，每句带出处。

## 下一步建议（按优先级）

1. **自己用两周**：装上插件，用真实书签验证分组质量和"拿不准"的比例，记录每周纠正了多少条。这是融资时最有说服力的数据。
2. **找 10 个 ADHD、重度收藏用户试用**，测"第二周还会不会回来"。
3. **接入第二个来源**：Claude 和 ChatGPT 的对话导出（原型里已有解析器，搬进插件即可）。
4. **MCP server**：让 Claude Desktop 直接读取某个组或交汇点。
