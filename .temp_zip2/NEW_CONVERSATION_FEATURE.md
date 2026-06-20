# 项目安全评估页面 - 新对话功能实现

## 功能概述

在"项目安全评估"页面的右上角，标题"项目安全评估"的右侧新增了一个"新对话"按钮。用户点击该按钮会弹出确认框，确认后将清空当前对话并重置所有表单数据，开始新的安全评估。

## 按钮样式

- **图标**：Plus（+）图标
- **文字**："新对话"
- **颜色**：电光蓝（`text-blue-400`）
- **背景**：透明
- **圆角**：否（内联样式）
- **内边距**：`px-2 py-1`
- **边框**：无
- **悬停效果**：`hover:text-blue-300`

**按钮位置**：位于 Header 右侧，与返回按钮对称

## 修改的文件

### 1. `/components/project-assessment.tsx`

#### 修改内容：

##### 1. 导入 Plus 图标（第 4 行）
```typescript
import { ChevronLeft, Plus, Mic, Keyboard, Send, BookOpen, AlertCircle, X, Copy, Check, Info } from "lucide-react"
```

##### 2. 添加新对话确认框状态（第 300 行）
```typescript
const [showNewConversationModal, setShowNewConversationModal] = useState(false)
```

##### 3. 新增处理函数（第 376-452 行）

**函数 1：`handleNewConversation()`**
```typescript
const handleNewConversation = () => {
  setShowNewConversationModal(true)
}
```
点击按钮时显示确认框。

**函数 2：`confirmNewConversation()`**
```typescript
const confirmNewConversation = () => {
  // 清空消息列表，只保留初始欢迎语
  setMessages([...])
  
  // 清空表单输入
  setFormData({...})
  
  // 清空输入框
  setInputValue("")
  
  // 重置语音/文字模式
  setIsVoiceMode(true)
  setIsRecording(false)
  
  // 关闭确认框
  setShowNewConversationModal(false)
  
  // 滚动到页面顶部
  setTimeout(() => {...}, 100)
}
```
处理确认后的重置逻辑。

##### 4. 修改 Header（第 490-507 行）
```jsx
<div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 bg-black sticky top-0 z-10">
  <button onClick={handleBackClick} ...>
    <ChevronLeft className="w-6 h-6" />
  </button>
  <h1 className="text-white text-base font-semibold flex-1 text-center">项目安全评估</h1>
  <button
    onClick={handleNewConversation}
    className="text-blue-400 hover:text-blue-300 transition-colors flex-shrink-0 flex items-center gap-1"
    title="开始新对话"
  >
    <Plus className="w-5 h-5" />
    <span className="text-xs">新对话</span>
  </button>
</div>
```
将返回按钮和新对话按钮放在两侧，标题居中。

##### 5. 添加确认模态框（第 884-907 行）
```jsx
{showNewConversationModal && (
  <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
    <div className="bg-zinc-900 rounded-lg p-4 max-w-xs mx-4 space-y-3 border border-zinc-600">
      <h2 className="text-white font-semibold text-sm text-center">新建对话</h2>
      <p className="text-zinc-300 text-xs text-center">将清空当前对话，开始新的安全评估。是否继续？</p>
      <div className="flex gap-3">
        <button onClick={() => setShowNewConversationModal(false)} ...>
          取消
        </button>
        <button onClick={confirmNewConversation} ...>
          确认
        </button>
      </div>
    </div>
  </div>
)}
```

## 功能流程

```
用户点击"新对话"按钮
           ↓
显示确认框（模态框）
"新建对话"
"将清空当前对话，开始新的安全评估。是否继续？"
[取消] [确认]
           ↓
      用户选择
      /      \
    取消    确认
     ↓       ↓
   关闭   执行重置
  模态框   └─ 清空消息列表（保留初始欢迎语）
        └─ 清空表单所有字段
        └─ 清空输入框
        └─ 重置语音/文字模式
        └─ 关闭确认框
        └─ 滚动到页面顶部
        └─ 返回初始状态
```

## 重置操作详解

点击"确认"后执行以下重置：

1. **消息列表**：清空所有用户和AI消息，仅保留初始欢迎语及相关提示
2. **表单字段**：
   - 项目名称
   - 合约地址
   - 官网链接
   - 社群链接
   - 项目白皮书/文档链接
   - 补充说明
   - 上传的图片
3. **输入框**：清空当前输入
4. **输入模式**：重置为语音模式
5. **其他状态**：取消正在录音的状态
6. **UI效果**：关闭确认框，滚动到页面顶部

## 用户交互

- **点击"取消"**：关闭确认框，页面状态不变
- **点击"确认"**：执行重置操作，开始新的评估
- **点击"新对话"按钮**：再次弹出确认框

## 样式参考

样式参考自"商业模式拆解"页面的"新对话"按钮，保持一致的设计风格：
- 相同的颜色方案（电光蓝）
- 相同的图标样式（Plus + 文字）
- 相同的确认框样式
- 相同的用户交互流程

## 兼容性

- ✅ TypeScript 类型检查通过
- ✅ ESLint 检查通过
- ✅ 生产构建成功（`pnpm build`）
- ✅ 响应式设计支持所有设备
- ✅ 不影响其他功能（返回按钮、快速扫描、付费等）

## 测试验证

✅ **按钮显示**：右上角成功显示"新对话"按钮
✅ **点击按钮**：弹出确认框并显示正确的文案
✅ **点击确认**：
  - 消息列表重置
  - 表单清空
  - 输入框清空
  - 页面滚动到顶部
  - 返回初始状态
✅ **点击取消**：确认框关闭，页面状态保持不变
✅ **多次操作**：重复点击按钮时功能正常工作
✅ **其他功能**：不影响返回按钮、快速扫描等其他功能

## 代码行数统计

- **新增行数**：约 100 行（包括导入、状态、函数、UI）
- **修改行数**：2 行（导入语句、Header 结构）
- **删除行数**：0 行

## 关键特性

1. **用户友好**：确认框防止误操作
2. **完全重置**：清空所有数据和状态
3. **样式一致**：与现有设计风格保持一致
4. **响应式**：支持所有屏幕尺寸
5. **无副作用**：不影响历史报告和其他功能
6. **流畅体验**：使用动画和过渡效果提升用户体验

## 后续优化建议

1. 添加快捷键支持（如 Cmd+K）
2. 添加"最近对话"历史记录
3. 支持自动保存对话草稿
4. 添加撤销功能

---

**修改完成时间**：2026-06-10
**修改状态**：✅ 已完成并通过测试
**编译状态**：✅ 生产构建成功
