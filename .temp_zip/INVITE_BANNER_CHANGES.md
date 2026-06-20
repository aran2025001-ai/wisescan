## 商业模式拆解页面 - 邀请插件集成修改总结

### 修改内容概览
已成功将邀请插件集成到商业模式拆解页面的第五条对话消息中，邀请横幅现在显示在对话框内部，与对话内容统一渲染。

### 核心修改清单

#### 1. 图标导入 (第4行)
```typescript
import { ChevronLeft, Plus, Mic, Keyboard, Send, AlertCircle, Gift, ChevronRight } from "lucide-react"
```
- 新增：`Gift`（礼物图标）、`ChevronRight`（右箭头图标）

#### 2. 邀请模态框状态 (第80行)
```typescript
const [showInviteModal, setShowInviteModal] = useState(false)
```
- 控制邀请功能模态框的显示/隐藏状态

#### 3. 第五条消息的卡片结构 (第330-370行)
消息 id="5" 采用特殊的组合卡片渲染逻辑：

```typescript
{message.id === "5" ? (
  /* Combined card for message 5 with invite banner */
  <div className="bg-zinc-800 text-zinc-200 rounded-lg overflow-hidden">
    {/* Message content */}
    <div className="px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap">
      {message.content}
    </div>
    
    {/* Divider */}
    <div className="h-px bg-gray-600"></div>
    
    {/* Invite Banner inside the card */}
    <button 
      onClick={(e) => {
        e.stopPropagation()
        setShowInviteModal(true)
      }}
      className="w-full px-4 py-3 flex items-center gap-3 hover:bg-zinc-700 transition-colors text-left"
    >
      <Gift className="w-5 h-5 flex-shrink-0 text-blue-400" />
      <span className="text-sm flex-1 text-gray-300">
        邀请一位朋友，立得 2.99U 代金券（终身一次）
      </span>
      <ChevronRight className="w-5 h-5 flex-shrink-0 text-gray-500" />
    </button>
  </div>
) : (
  /* Regular message */
  // ... 其他消息类型
)}
```

**关键特性：**
- 整个结构放在单个容器内（`bg-zinc-800 rounded-lg overflow-hidden`）
- 消息内容与邀请横幅用灰色细线分隔（`h-px bg-gray-600`）
- 邀请横幅是容器内的可点击按钮
- 悬停时横幅背景变深（`hover:bg-zinc-700`）

#### 4. 邀请模态框 (第536-552行)
```typescript
{showInviteModal && (
  <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
    <div className="bg-zinc-900 rounded-lg p-4 max-w-xs mx-4 space-y-3 border border-zinc-600">
      <h2 className="text-white font-semibold text-sm text-center">邀请功能</h2>
      <p className="text-zinc-300 text-xs text-center">邀请功能开发中</p>
      <div className="flex gap-3">
        <button
          onClick={() => setShowInviteModal(false)}
          className="flex-1 py-1.5 px-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-xs"
        >
          确定
        </button>
      </div>
    </div>
  </div>
)}
```

**样式特点：**
- 与"新对话"和"返回"确认框风格完全一致
- 固定位置叠加层（`fixed inset-0`）
- 黑色半透明背景遮罩（`bg-black/60`）
- 深灰色卡片（`bg-zinc-900 border border-zinc-600`）

### 视觉效果

| 元素 | 样式 | 值 |
|------|------|-----|
| **容器背景** | `bg-zinc-800` | 深灰 |
| **分隔线** | `h-px bg-gray-600` | 1px 灰线 |
| **邀请横幅背景** | hover时 `bg-zinc-700` | 更深灰 |
| **Gift 图标** | `text-blue-400` | 蓝色 |
| **文字颜色** | `text-gray-300` | 浅灰 |
| **ChevronRight** | `text-gray-500` | 深灰 |
| **圆角** | `rounded-lg` | 标准圆角 |
| **内边距** | `px-4 py-3` | 适中间距 |

### 交互流程

1. **页面加载** → 第五条消息显示组合卡片
2. **用户看到** → "如有补充...拆解。" 文本 + 分隔线 + 邀请横幅
3. **用户点击邀请横幅** → `setShowInviteModal(true)` 触发
4. **模态框显示** → "邀请功能开发中"提示
5. **用户点击确定** → `setShowInviteModal(false)` 关闭模态

### 实现细节

**为什么用条件渲染而不是 Fragment？**
- 保持第5条消息容器的整体性
- 确保分隔线和邀请横幅紧密相连
- 简化布局计算，避免额外的 flex 嵌套

**消息容器判断逻辑：**
```typescript
<div className={message.id === "5" ? "" : "flex flex-col gap-1"}>
```
- 第5条消息：无额外的 flex 包装（留给组合卡片自己管理）
- 其他消息：`flex flex-col gap-1`（保持原样式）

### 文件替换指南

1. **备份原文件**
   ```bash
   cp components/business-breakdown.tsx components/business-breakdown.backup.tsx
   ```

2. **替换文件**
   ```bash
   cp components/business-breakdown-updated.tsx components/business-breakdown.tsx
   ```

3. **验证导入**
   - 确保 `framer-motion` 已安装
   - 确保 `results-section.tsx` 在同级目录

### 样式一致性说明

- ✅ 邀请横幅布局：完全遵循"项目安全评估"页面的邀请插件样式
- ✅ 模态框样式：与"新对话"和"返回"确认框保持完全一致
- ✅ 颜色方案：所有深灰、蓝色、灰色均匹配现有设计体系
- ✅ 间距和圆角：使用 Tailwind 标准值保持统一

### 已完成的功能

✓ 邀请横幅集成到第5条消息  
✓ 灰色分隔线分隔对话和邀请  
✓ 点击事件触发模态框  
✓ 模态框显示"邀请功能开发中"  
✓ 确认按钮关闭模态框  
✓ 样式与现有设计系统一致  
✓ 不影响其他功能（返回、付费、新对话等）
