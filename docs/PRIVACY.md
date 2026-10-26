# Privacy Policy for PixPage 智能元素拾取助手 (Smart Element Picker)

> **Last Updated / 最近更新**: 2026-10-16

---

## English Version

### 1. Introduction
**PixPage 智能元素拾取助手** ("PixPage Smart Element Picker") is a lightweight developer and testing productivity extension designed for high-precision DOM element inspection, multi-attribute extraction, and AI debugging prompt generation.

We are committed to protecting your privacy. This extension operates strictly offline on your local device and does **not** collect, store, sell, or transmit any of your personal data or browsing activity.

### 2. Information We Collect
**We do not collect any personal data.**
- **No Personal Information**: We do not collect names, email addresses, phone numbers, or account details.
- **No Browsing History or Activity**: We do not track, log, or analyze the websites you visit or your browsing habits.
- **No Analytics / Telemetry**: We do not include any tracking pixels, third-party analytics (e.g., Google Analytics), or diagnostic telemetry.
- **No Remote Transmission**: No data is sent to external servers or third parties. All DOM analysis and locator calculations are performed entirely in-memory on your local browser.

### 3. Permissions Explanation
The extension requests only the minimum permissions necessary to function:
- **`activeTab`**: Allows the extension to interact with the current tab when you activate the picker via the toolbar icon or the shortcut key (`Alt+Shift+X`).
- **`clipboardWrite`**: Allows you to copy generated selectors, element properties, and formatted AI prompts to your system clipboard when you click the copy buttons.
- **Content Scripts on `<all_urls>`**: PixPage is a universal developer inspection tool. It requires content script access to inspect DOM elements on the pages where you explicitly trigger the picker. It runs passively and only executes inspection logic when activated by you.

### 4. Third-Party Services
This extension does **not** use any third-party services, APIs, or external code libraries.

### 5. Changes to This Privacy Policy
If this Privacy Policy is updated, changes will be posted to this document and reflected in the extension's release notes.

### 6. Contact Us
If you have any questions or suggestions regarding this privacy policy, please open an issue in the project's repository.

---

## 中文版（隐私政策）

### 1. 引言
**PixPage 智能元素拾取助手** 是一款专为前端开发与测试人员打造的高精度 DOM 元素拾取与 AI 协同定位扩展。

我们极为重视您的隐私。本插件遵循**零数据收集**与**纯本地运行**原则，绝不收集、存储、出售或向任何远程服务器传输您的个人信息或浏览行为。

### 2. 数据收集说明
**我们不会收集任何个人数据。**
- **不收集个人身份信息**：不收集姓名、邮箱、账户名、手机号等任何身份数据；
- **不追踪浏览历史**：不记录、不上报您访问的网址（URL）与浏览行为；
- **不包含第三方统计/埋点**：不接入任何统计分析平台（如 Google Analytics、百度统计等），无任何遥测代码；
- **纯本地内存运算**：所有 DOM 拾取、选择器计算与 Prompt 生成均在您本地浏览器的内存中即时完成，不向外部服务器发送任何网络请求。

### 3. 所需权限用途说明
本插件仅申请实现核心功能所必需的最小权限：
- **`activeTab`**：仅在您主动点击扩展图标或按下唤醒快捷键（`Alt+Shift+X`）时，与当前活动标签页通信以开启元素拾取界面；
- **`clipboardWrite`**：当您点击“复制选择器”或“复制 AI 格式化 Prompt”时，将文本写入您的系统剪贴板；
- **内容脚本匹配 `<all_urls>`**：作为通用的开发调试工具，插件需要在您选择审查的各类 Web 页面及管理后台中注入拾取图层。拾取器在未唤醒时处于休眠状态，只有在用户主动触发时才激活交互。

### 4. 第三方服务与外链
本插件不依赖任何外部第三方 API 或远程执行脚本，完全独立运行。

### 5. 政策变更与联系方式
如隐私政策有任何调整，将在此文档中同步更新。如有任何疑问或反馈，请通过代码仓库 Issue 与我们联系。
