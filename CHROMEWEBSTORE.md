# Chrome Web Store 上架申报指南与元数据 — PixPage 智能元素拾取助手

> **最近更新**: 2026-10-16  
> **插件版本**: v0.3.0
> **适用平台**: Google Chrome Web Store Developer Dashboard  
> **文件说明**: 本文档汇总了在 Chrome Web Store 提交审核时所需填写的全部信息、权限申述理由、隐私合规声明、文案模板与版本履历，发布时可直接复制粘贴至开发者后台对应输入框。

---

## 1. 商店基本信息 (Store Listing)

### 扩展名称 (Extension Name)
```text
PixPage 智能元素拾取助手
```
*(英文可选: PixPage Smart Element Picker)*

### 简短说明 (Short Description)
> **限制**: 132 字符以内。直接展现工具核心功能，避免空洞的营销词汇。

```text
高精度页面元素交互式拾取与AI协同定位工具。一键提取复合选择器、DOM属性与几何坐标，生成标准化AI排查Prompt。
```
*(英文版备用: Interactively inspect DOM elements on any webpage. Extract robust selectors, coordinates, and generate AI debugging prompts.)*

### 详细说明 (Detailed Description)
> **说明**: Chrome Web Store 不支持 Markdown 语法，仅支持换行和纯文本符号（如 • 或数字序号）。文案从用户收益出发，严禁堆砌底层实现黑话。

```text
PixPage 是一款专为前端工程师、自动化测试人员及 AI 开发者打造的高精度页面元素拾取与智能排查助手。

在日常的前端开发、UI 自动化测试编写以及向大模型排查页面缺陷时，寻找唯一稳定的元素选择器往往耗费大量时间。PixPage 帮助你以零侵入方式交互式点击页面上的任意元素，自动计算高稳定度的复合定位表达式，并结构化格式化为大模型专属的排查定位 Prompt，助力 AI 快速分析与修复。

【主要功能】

• 智能抗脆弱选择器生成
自动提取多种定位策略，包括专用测试标识（data-testid/data-qa）、语义 ID、文本内容 XPath、语义属性及精简 CSS 选择器，告别脆弱的绝对路径。

• AI 协同 Prompt 格式化
一键将选中元素的标签类型、文本内容、尺寸坐标、层级路径及计算样式组装为结构清晰的 Markdown Prompt，直接贴入 ChatGPT、Claude、Gemini 等大模型即可开始对话。

• 自由交互与临时穿透模式
拾取过程中按下 Space 空格键，随时挂起拾取进入自由交互模式，畅通操作多级下拉菜单、弹窗表单或切换标签页；亦可按住 Alt (Option) 键临时穿透点击，零阻碍联动页面原有功能。

• 批量多选与自适应标记
支持通过快捷键或界面切换至多选模式，一次性拾取页面上的多个关联元素或表单组件。在单页应用 (SPA) 中切换菜单或动态增删内容时，常驻标记自动识别元素有效性并精准对齐，彻底杜绝错位与悬空幽灵框。

• 防误触分级退出机制
在结果抽屉展开时，按下 ESC 键优先仅收起遮挡弹窗，完整固化保留已选元素与 Prompt 描述内容，方便继续加选被遮挡的元素；再次按下 ESC 才会安全退出。

• 键盘层级与底层穿透
支持按 ↑/↓ 键在父子 DOM 容器间精确导航，按 Tab 键穿透透明遮罩层定位底层元素。

• 零侵入轻量体验
完全隔离插件与被审查页面的样式与交互，不破坏宿主网站的原有排版和类名。

• 全局快捷键快速唤醒
按下 Alt+Shift+X 即可在任意网页中一键开启或关闭元素拾取器。

【使用方法】

1. 点击浏览器右上角工具栏的 PixPage 插件图标，或按下快捷键 Alt+Shift+X 开启拾取；
2. 鼠标移动至页面目标元素上方，查看高亮框与悬浮定位建议；
3. 单击目标元素锁定并弹出定位面板，或按 Space 进入自由交互展开需要审查的复杂菜单；
4. 点击“复制 AI Prompt”或“复制选择器”，直接粘贴至开发工具或 AI 对话框中进行排查。

【隐私与权限安全】

PixPage 严格遵循纯本地运行原则：
• 不收集任何用户的个人身份信息或浏览记录；
• 所有元素分析与选择器计算均在本地浏览器内存中即时完成；
• 绝不向任何外部服务器发送网络请求或上传页面内容。

【问题反馈与支持】

如在使用中遇到任何问题或有新功能建议，欢迎前往 GitHub 项目仓库提交 Issue。
```

### 类别 (Category)
- **开发者工具 (Developer Tools)**

### 单一用途声明 (Single Purpose)
> **Google 审核必填**: 必须用简练的一句话明确该扩展的核心单一功能。

```text
Interactively inspect DOM elements on web pages to extract robust selectors, coordinates, and formatted prompts for AI debugging.
```
*(中文含义: 在网页中交互式拾取DOM元素，并提取元素选择器、几何坐标及结构化上下文以生成排查Prompt。)*

### 主要语言 (Primary Language)
- **中文（简体） (Chinese (Simplified))**  
*(如果面向国际开发者，也可在后台添加英文语言包)*

---

## 2. 权限合规与申述理由 (Permissions Justification)

> **审核关键点**：Google 审查团队极其严格，所有在 `manifest.json` 中声明的权限必须有合理的业务理由说明，填“Needed for extension to work”会被直接拒审。

| 权限 (Permission) | 类型 (Type) | 审核申述理由 (Justification - 英文填入后台) |
|---|---|---|
| `activeTab` | permissions | Used to activate the interactive element picker and highlight overlay on the user's current webpage when they click the toolbar icon or press the shortcut key (Alt+Shift+X). |
| `clipboardWrite` | permissions | Used to allow the user to copy extracted element selectors, DOM attributes, and formatted AI prompts to the system clipboard with a single click. |
| `scripting` | permissions | Used only as a fallback to inject the picker into a tab that was already open before the extension was installed or updated, so the shortcut works without requiring the user to reload the page. |
| `storage` | permissions | `storage.session` keeps a snapshot of the user's last picked-element list for the current tab, so they can explicitly restore it after exiting or reloading the page (cleared when the tab closes); `storage.local` keeps a local, capped (200 entries) error log that the user can copy from the popup for troubleshooting. Nothing is transmitted off the device. |
| `<all_urls>` | content_scripts (Host) | PixPage is a universal developer inspection and locator tool. It requires content script injection across web pages so developers and QA engineers can inspect elements and debug issues on any website, web application, or internal admin console they choose to examine. The script runs passively and only activates when the user explicitly triggers picking. |

> **合规说明**：本项目严守 Google “最小权限原则”，仅声明实际调用的权限；`scripting` 与 `storage` 自 v0.3.0 起用于兜底注入、会话保留与本地诊断日志，所有数据均不离开本机。

---

## 3. 隐私与数据使用声明 (Privacy & Data Use)

在开发者后台的 **Privacy** 标签页中按以下标准如实勾选：

### 数据收集调查 (Data Collection)
- **Does your extension collect user data?**: 勾选 **No**（不收集任何数据）。
- （如果被问及是否有数据出境/远程传输）：选择 **No data transmitted off-device**。

### 数据用途承诺 (Data Use Certification)
在多选框中全部勾选：
- [x] **Data is NOT sold to third parties** (不向第三方出售数据)
- [x] **Data is NOT used for purposes unrelated to the extension's core functionality** (不用于无关目的)
- [x] **Data is NOT used for creditworthiness or lending purposes** (不用于信贷或借贷评估)

### 隐私政策链接 (Privacy Policy URL)
> **必填项**（因使用了 `<all_urls>` 内容脚本）。请将本项目 `docs/PRIVACY.md` 托管至公共可访问链接，并填入后台。

示例链接：
- GitHub 原始文件或 Pages：`https://github.com/<你的用户名>/pixpage-element-picking/blob/main/docs/PRIVACY.md`
- 或者使用公开的 GitHub Gist / Notion 页面链接。

---

## 4. 图文素材规格与清单 (Graphics & Assets)

| 素材类型 | 尺寸规格 | 格式 | 状态 | 存放路径 / 提审建议 |
|---|---|---|---|---|
| **商店图标 (Store Icon)** | 128 × 128 px | PNG | ✅ 已就绪 | `icons/icon-128.png` |
| **标准功能截图 1 (弹窗指南)** | 1280 × 800 px (附 640×400) | PNG | ✅ 100%合规 | `store-assets/1280x800/screenshot-1-popup.png` |
| **标准功能截图 2 (结果抽屉)** | 1280 × 800 px (附 640×400) | PNG | ✅ 100%合规 | `store-assets/1280x800/screenshot-2-drawer.png` |
| **标准功能截图 3 (悬浮工具栏)** | 1280 × 800 px (附 640×400) | PNG | ✅ 100%合规 | `store-assets/1280x800/screenshot-3-toolbar.png` |
| **640×400 备用目录** | 640 × 400 px | PNG | ✅ 100%合规 | `store-assets/640x400/` (等比缩放备用) |
| **原始特写裁切图 (参考)** | 原始局部比例 | PNG | 📁 归档 | `store-assets/raw/` (原始组件裁切图) |

---

## 5. 版本历史记录 (Version History)

| 版本 | 发布日期 | 核心变更摘要 |
|---|---|---|
| **v0.2.16** | 2026-10-16 | 修复 iframe 内转多选后跨页面失去拾取能力；新增顶层会话接管与动态 Frame 状态恢复。 |
| **v0.2.15** | 2026-10-16 | 跨页面跳转定位增加语义指纹、候选一致性评分与连续稳定命中确认，降低重复文本和列表刷新后的误定位概率。 |
| **v0.2.14** | 2026-10-16 | 修复文本 XPath 误命中全屏根容器问题，增加候选尺寸防膨胀过滤与跨路由视图隔离。 |
| **v0.2.13** | 2026-10-16 | 单选结果增加常驻高亮和跨页面一键跳转定位。 |
| **v0.2.12** | 2026-10-16 | 增加 SPA 活节点重连、多选元素跨页面穿梭定位与异步渲染补检。 |
| **v0.2.11** | 2026-10-16 | 自由交互模式下 SPA 菜单切换与 DOM 突变实时感知，自动隐现与精准对齐多选常驻标记，彻底根治跨菜单幽灵高亮框。 |
| **v0.2.10** | 2026-10-15 | 引入自由交互模式（Space / P 键切换）、Alt 临时穿透点击与 ESC 分级退出机制，解决弹窗遮挡元素拾取与误退出问题。 |
| **v0.2.9** | 2026-10-10 | 输入法(IME)防误触守卫、底部悬浮栏单行精简胶囊化重构、CWS 权限精简与打包工具链建立。 |

---

## 6. 打包与发布检查清单 (Pre-Publish Checklist)

- [x] `manifest_version` 为 3。
- [x] 图标分辨率符合规范（16x16, 48x48, 128x128 均存在且有效）。
- [x] 代码内无任何 `eval()`、`new Function()` 或远程 CDN 脚本加载。
- [x] 纯本地运行，不含任何外部 API 或用户数据上报代码。
- [x] 安装包已通过专用脚本打包，已严格剔除 `.git`、文档、操作系统临时文件等无关内容。
- [ ] 开发者在 Google 控制台完成 5 美元账号注册。
- [ ] 准备 1~2 张 1280×800 分辨率的界面实际运行截图。
- [ ] 上传 zip 安装包并复制本文档中的文案提交审核。
