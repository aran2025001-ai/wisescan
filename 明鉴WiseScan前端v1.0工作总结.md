# 明鉴 WiseScan 前端 v1.0 工作总结

**项目周期**：2026-06-07 ～ 2026-06-12（共6天）  
**技术栈**：React 19 + Vite 8 + TypeScript 6 + Tailwind CSS v4 + wagmi 2.x + RainbowKit 2.x  
**总改动数**：94 项

---

## 一、项目初始化（条目 1-7）

| 条目 | 内容 |
|------|------|
| 1 | 项目初始化：Vite + React + TypeScript 脚手架，Tailwind v4 配置 |
| 2 | 安装 wagmi + viem + RainbowKit，配置主网/Sepolia 链 |
| 3 | 创建主布局：Navbar（Logo + 主题切换 + 钱包按钮）+ Footer + App 路由框架 |
| 4 | 安装 shadcn/ui 兼容层（Tailwind v4 主题变量已配置） |
| 5 | 创建欢迎页 Welcome.tsx（连接钱包引导页） |
| 6 | 创建首页 Home.tsx（三大功能入口导航） |
| 7 | 创建项目安全评估页 RiskAssessment.tsx（基础框架） |

---

## 二、核心页面开发（条目 8-20）

| 条目 | 内容 |
|------|------|
| 8 | 商业模式拆解页 BusinessBreakdown.tsx 基础框架 |
| 9 | 全网项目库 ProjectLibrary.tsx + 项目详情 ProjectDetail.tsx |
| 10 | 我的页面 Profile.tsx（含退出确认弹窗） |
| 11 | 帮助中心 HelpCenter.tsx（FAQ 手风琴面板） |
| 12 | 关于明鉴 AboutWiseScan.tsx（品牌介绍页） |
| 13 | 邀请返佣 InvitationRebate.tsx（返佣统计+提现+分享二维码） |
| 14 | 我的报告 MyReports.tsx + 报告详情 ReportDetail.tsx |
| 15 | 我的商业模式 MyBusinessModels.tsx + 详情 BusinessReportDetailPage.tsx |
| 16 | 我的代金券 MyCoupons.tsx（三Tab：未使用/已使用/已过期） |
| 17 | 提现记录 WithdrawalHistory.tsx |
| 18 | 语言切换组件 LanguageSwitch.tsx（中文/English） |
| 19 | 问题反馈页 Feedback.tsx（独立页面，含提交提示） |
| 20 | 全网项目库搜索功能（支持中英文项目名称搜索） |

---

## 三、支付与解锁逻辑（条目 21-28）

| 条目 | 内容 |
|------|------|
| 21 | 项目安全评估「解锁全景风险报告」支付弹窗 + localStorage 支付状态 |
| 22 | 商业模式拆解「开始拆解」支付弹窗 + localStorage 支付状态 |
| 23 | 项目详情页「解锁全景风险报告」支付弹窗 |
| 24 | 支付弹窗统一添加 BSC 链（BEP20）支付说明 |
| 25 | 支付确认后自动 `window.scrollTo(0,0)` 防止页面位置偏移 |
| 26 | 邀请返佣页提现说明添加 BSC 链限制说明 |
| 27 | 支付弹窗内容统一：「需支付 X USDT（当前仅支持BSC链（BEP20）支付）。是否继续？」 |
| 28 | 演示模式 `alert()` 提示「支付成功，报告生成中（演示模式）」 |

---

## 四、组件抽取与共享化（条目 29-35）

| 条目 | 内容 |
|------|------|
| 29 | 抽取 `RiskReportCard` 为共享组件（ProjectDetail ↔ ReportDetail 共用） |
| 30 | 抽取 `BusinessReportCard` 为共享组件（ResultsSection ↔ BusinessReportDetailPage 共用） |
| 31 | 抽取 `ScanMethodologyModal` 为共享组件（RiskAssessment + HelpCenter 共用） |
| 32 | 抽取 `DecomposeMethodologyModal` 为共享组件（BusinessBreakdown + HelpCenter 共用） |
| 33 | 帮助中心两个按钮与对应页面方法论内容完全一致（修改一处全站同步） |
| 34 | 删除 HelpCenter.tsx 中 82 行重复内联代码（dataSources、dimensionTable、riskLevelTable + 两个模态框） |
| 35 | 所有支付弹窗统一使用共享组件，维护成本降至最低 |

---

## 五、UI 一致性与视觉优化（条目 36-55）

| 条目 | 内容 |
|------|------|
| 36 | 邀请返佣页：合并两个 Grid 为一个，解决布局错位 |
| 37 | 邀请返佣页：所有 `alert()` 改为标准模态框（统一项目风格） |
| 38 | 邀请返佣页：「生成分享二维码」改名为「分享二维码」 |
| 39 | 邀请返佣页：金额添加「U」单位 |
| 40 | 我的代金券页：整体紧凑化（字体缩小、横向布局、添加 COUPON 装饰文字） |
| 41 | 我的代金券页：COUPON 装饰文字右对齐（迭代多次，最终 `items-end` + `whitespace-nowrap`） |
| 42 | 关于明鉴页：版本号从卡片改为独立底部居中文字「版本 v1.0」 |
| 43 | 帮助中心页：两个蓝色按钮去掉 📖 图标，文字加粗（`font-bold` + `style.fontWeight:700`） |
| 44 | 欢迎页 Logo：整体放大 20%（`h-40` → `h-48`） |
| 45 | 欢迎页：去掉「无法连接？点此重置」无用按钮 |
| 46 | 反馈页：图标从 MessageSquare 改为 Mail（经典邮件风格） |
| 47 | 反馈页：图标样式升级（渐变蓝色背景 + 阴影） |
| 48 | 反馈页：输入框聚焦时边框变蓝色（`focus:border-blue-500` + `focus:ring-1`） |
| 49 | 反馈页：底部添加 slogan「出一份力，让天下每一位投资者不再被割韭菜！」 |
| 50 | 邀请返佣页：添加灰色备注「每邀请一人使用明鉴，可获得0.5U返佣」（左对齐，紧贴卡片下方） |
| 51 | 所有弹窗统一为项目标准样式（`bg-zinc-900` + `border-[#343438]` + header X 按钮 + `pointer-events-none/auto`） |
| 52 | Info Popover 修复：全局 `boolean` 改为 `number|null`（防止点击一个全部弹出） |
| 53 | Info Popover 修复：MyReports 页使用 `getBoundingClientRect()` 动态定位（防止跑到页面底部） |
| 54 | 项目库卡片文字截断修复：添加 `whitespace-normal` |
| 55 | 导航栏返回按钮统一风格（ChevronLeft + `text-zinc-400`） |

---

## 六、数据一致性与页面联动（条目 56-65）

| 条目 | 内容 |
|------|------|
| 56 | 项目库 → 项目详情：补充 Compound 项目数据（id:"6"） |
| 57 | 我的报告 → 报告详情：通过 `location.state` 传递完整报告对象（替代硬编码） |
| 58 | 我的商业模式 → 商业模式详情：通过 `location.state` 传递完整报告对象 |
| 59 | 商业模式详情页：补回「评估该项目风险」按钮（调用 `navigate('/assess')`） |
| 60 | 空状态引导：MyReports 添加「去项目安全评估」跳转按钮 |
| 61 | 空状态引导：MyBusinessModels 添加「去商业模式拆解」跳转按钮 |
| 62 | 帮助中心 → 独立页面（从弹窗改为路由页面，与邀请返佣/帮助中心风格一致） |
| 63 | 问题反馈页：标题栏与页面内容标题去重（去掉图标下方的重复标题） |
| 64 | 问题反馈页：说明文字与输入框左对齐，整体上移 |
| 65 | 所有 `navigate` 跳转在移动端（max-w-[428px]）容器内正常运行 |

---

## 七、FAQ 文案修正（条目 66-70）

| 条目 | 内容 |
|------|------|
| 66 | 「如何获得邀请返佣和代金券」：修正为「您可以获得2.99 USDT代金券，终身一次。每邀请一人可获得0.5 USDT返佣，需累积5 USDT才可提现。」 |
| 67 | 「代金券如何使用」：修正为「系统会自动使用当前最大面额的可用代金券进行抵扣。」 |
| 68 | 「代金券存在有效期」：修正「有」→「存在」 |
| 69 | 邀请返佣页文案：「每邀请一人可获得0.5U返佣」（去掉「代金券」误用，改为「返佣」） |
| 70 | 反馈页底部 slogan 多次微调：「助力我们」→「出一份力」，「投资人」→「投资者」，加感叹号 |

---

## 八、路由总表（最终状态）

| 路径 | 页面 | 状态 |
|------|------|------|
| `/` | Welcome（欢迎/连接钱包） | ✅ |
| `/home` | Home（首页/功能导航） | ✅ |
| `/assess` | RiskAssessment（项目安全评估） | ✅ |
| `/business` | BusinessBreakdown（商业模式拆解） | ✅ |
| `/library` | ProjectLibrary（全网项目库） | ✅ |
| `/library/:id` | ProjectDetail（项目详情+风险报告） | ✅ |
| `/profile` | Profile（我的） | ✅ |
| `/profile/reports` | MyReports（我的报告） | ✅ |
| `/profile/reports/:id` | ReportDetail（报告详情） | ✅ |
| `/profile/business-models` | MyBusinessModels（我的商业模式） | ✅ |
| `/profile/business-models/:id` | BusinessReportDetailPage（商业模式详情） | ✅ |
| `/profile/invitation` | InvitationRebate（邀请返佣） | ✅ |
| `/profile/coupons` | MyCoupons（我的代金券） | ✅ |
| `/profile/help` | HelpCenter（帮助中心） | ✅ |
| `/profile/about` | AboutWiseScan（关于明鉴） | ✅ |
| `/profile/feedback` | Feedback（问题反馈） | ✅ |
| `/profile/withdrawal` | WithdrawalHistory（提现记录） | ✅ |

---

## 九、共享组件清单

| 组件 | 用途 | 使用页面 |
|------|------|----------|
| `RiskReportCard` | 全景风险报告卡片 | ProjectDetail、ReportDetail |
| `BusinessReportCard` | 商业模式拆解报告卡片 | BusinessBreakdown、BusinessReportDetailPage |
| `ScanMethodologyModal` | 全景扫描方法论弹窗 | RiskAssessment、HelpCenter |
| `DecomposeMethodologyModal` | 商业模式拆解方法论弹窗 | BusinessBreakdown、HelpCenter |
| `Navbar` | 顶部导航栏 | 所有页面 |
| `Footer` | 底部版权 | 所有页面 |
| `LanguageSwitch` | 中英文切换 | Welcome、Home |
| `EnhancedFeatureButton` | 功能入口按钮（带光晕动效） | Home |
| `RadarChart` | 雷达图（六大维度） | RiskAssessment、ProjectDetail、ReportDetail |

---

## 十、待后端对接的功能点

以下功能当前为演示模式（前端模拟），需后端实现：

1. **钱包支付**：连接真实支付合约（BSC链 BEP20 USDT）
2. **报告生成**：调用后端 API 生成真实风险评估/商业模式拆解报告
3. **邀请返佣**：真实邀请关系链 + 返佣发放（当前为 mock 数据）
4. **提现功能**：真实提现申请 + 审核流程（当前为 alert 提示）
5. **代金券系统**：后端发放 + 抵扣逻辑
6. **报告刷新**：支付 1 USDT 刷新报告（当前为 localStorage 模拟）
7. **图片分享**：报告图片生成 + 下载（当前为 alert 提示）
8. **用户系统**：注册/登录（当前为钱包地址识别）

---

## 十一、存档信息

| 项目 | 内容 |
|------|------|
| 存档文件名 | `WiseScan_frontend_v1.0_20260612_2003.zip` |
| 存档位置 | `C:\Users\ASUS\Desktop\` |
| 存档大小 | 634 KB |
| 源代码行数 | ~8,500 行（含备份文件） / ~5,200 行（不含备份） |
| TypeScript 错误 | 0 |
| 生产构建 | ✅ 成功 |

---

*总结生成时间：2026-06-12 20:04*  
*生成者：旺财（WorkBuddy Agent）*  
*审核者：冉哥*
