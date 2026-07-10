import { useState, useRef } from 'react';
import { AlertCircle, Loader2, CheckCircle2, Upload, X } from 'lucide-react';

interface EvidenceUploadProps {
  /** 合约地址 */
  contractAddress: string;
  /** 项目名称 */
  projectName: string;
  /** 贡献者钱包地址 */
  contributorAddress: string;
  /** 来源类型 */
  sourceType?: 'form' | 'evidence_button';
  /** 上传成功回调 */
  onSuccess?: (result: { id: number; image_analysis?: string }) => void;
  /** 最大图片数 */
  maxImages?: number;
  /** 组件样式类名 */
  className?: string;
}

export default function EvidenceUpload({
  contractAddress,
  projectName,
  contributorAddress,
  sourceType = 'evidence_button',
  onSuccess,
  maxImages = 5,
  className = '',
}: EvidenceUploadProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [imageDescription, setImageDescription] = useState('');
  const [textContent, setTextContent] = useState('');
  const [uploading, setUploading] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [statusType, setStatusType] = useState<'info' | 'error' | 'success'>('info');
  const fileInputRef = useRef<HTMLInputElement>(null);

  /** 选择文件 */
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    const total = files.length + selectedFiles.length;
    if (total > maxImages) {
      setStatusMsg(`最多上传${maxImages}张图片`);
      setStatusType('error');
      return;
    }

    const newPreviews = selectedFiles.map((f) => URL.createObjectURL(f));
    setFiles((prev) => [...prev, ...selectedFiles]);
    setPreviewUrls((prev) => [...prev, ...newPreviews]);
    setStatusMsg('');
  };

  /** 移除文件 */
  const removeFile = (index: number) => {
    URL.revokeObjectURL(previewUrls[index]);
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setPreviewUrls((prev) => prev.filter((_, i) => i !== index));
  };

  /** 提交证据 */
  const handleSubmit = async () => {
    if (files.length === 0 && !textContent.trim()) {
      setStatusMsg('请选择图片或填写文本说明');
      setStatusType('error');
      return;
    }
    if (files.length > 0 && (!imageDescription.trim() || imageDescription.trim().length < 10)) {
      setStatusMsg('上传图片时请填写图片描述（至少10字）');
      setStatusType('error');
      return;
    }

    setUploading(true);
    setStatusMsg('上传中...');
    setStatusType('info');

    let successCount = 0;
    const results: { id: number; image_analysis?: string }[] = [];

    try {
      // 1. 提交文本证据（如果有）
      if (textContent.trim()) {
        const textRes = await fetch('/api/evidence/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contract_address: contractAddress,
            project_name: projectName,
            contributor_address: contributorAddress,
            content_type: 'text',
            content: textContent.trim(),
            source_type: sourceType,
          }),
        });
        if (textRes.ok) {
          successCount++;
          const data = await textRes.json();
          results.push(data);
        }
      }

      // 2. 提交图片证据
      if (files.length > 0) {
        for (const file of files) {
          const base64 = await fileToBase64(file);
          const imgRes = await fetch('/api/evidence/submit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contract_address: contractAddress,
              project_name: projectName,
              contributor_address: contributorAddress,
              content_type: 'screenshot',
              content: imageDescription.trim(),
              image_base64: base64,
              image_description: imageDescription.trim(),
              source_type: sourceType,
            }),
          });
          if (imgRes.ok) {
            successCount++;
            const data = await imgRes.json();
            results.push(data);
          }
        }
      }

      if (successCount > 0) {
        setStatusMsg(`✅ 已提交 ${successCount} 条证据，感谢贡献！`);
        setStatusType('success');
        // 清理
        setTimeout(() => {
          setFiles([]);
          setPreviewUrls((urls) => { urls.forEach((u) => URL.revokeObjectURL(u)); return []; });
          setImageDescription('');
          setTextContent('');
          if (fileInputRef.current) fileInputRef.current.value = '';
        }, 2000);
        if (onSuccess) onSuccess(results[0]);
      } else {
        setStatusMsg('提交失败，请重试');
        setStatusType('error');
      }
    } catch (err) {
      setStatusMsg('提交出错：' + (err instanceof Error ? err.message : '未知错误'));
      setStatusType('error');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className={`space-y-3 ${className}`}>
      {/* 图片上传区域 */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-zinc-300 text-xs">图片上传（最多{maxImages}张）</span>
          <span className="text-zinc-500 text-xs">{files.length}/{maxImages}</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {previewUrls.map((url, index) => (
            <div key={index} className="relative w-full aspect-square bg-zinc-800 rounded-lg overflow-hidden">
              <img src={url} alt={`证据${index + 1}`} className="w-full h-full object-cover" />
              <button
                onClick={() => removeFile(index)}
                disabled={uploading}
                className="absolute top-0.5 right-0.5 w-4 h-4 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center text-xs leading-none disabled:opacity-50"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </div>
          ))}
          {files.length < maxImages && (
            <label className="w-full aspect-square bg-zinc-800 rounded-lg border-2 border-dashed border-zinc-600 flex flex-col items-center justify-center cursor-pointer hover:border-zinc-500 transition-colors">
              <Upload className="w-3.5 h-3.5 text-zinc-400 mb-0.5" />
              <span className="text-zinc-400 text-[12px]">添加图片</span>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                onChange={handleFileChange}
                disabled={uploading}
                className="hidden"
              />
            </label>
          )}
        </div>
      </div>

      {/* 图片描述（必填，当有图片时） */}
      {files.length > 0 && (
        <div className="space-y-1">
          <span className="text-zinc-300 text-xs">
            图片描述 <span className="text-red-400">*必填</span>
            <span className="text-zinc-500 ml-1">（10-30字）</span>
          </span>
          <input
            type="text"
            placeholder="例如：项目方发布的矿机挖矿终止公告"
            value={imageDescription}
            onChange={(e) => {
              setImageDescription(e.target.value);
              setStatusMsg('');
            }}
            maxLength={30}
            className="w-full px-3 py-1.5 bg-zinc-800 text-white text-xs rounded border border-[#343438] placeholder-zinc-600 placeholder:text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      )}

      {/* 文本补充区域 */}
      <div className="space-y-1">
        <span className="text-zinc-300 text-xs">文本说明（可选）</span>
        <textarea
          placeholder="粘贴聊天记录、公告链接或其他说明"
          value={textContent}
          onChange={(e) => setTextContent(e.target.value)}
          className="w-full px-3 py-2 bg-zinc-800 text-white text-xs rounded border border-[#343438] placeholder-zinc-600 placeholder:text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 h-20 resize-none"
        />
      </div>

      {/* 状态提示 */}
      {statusMsg && (
        <div
          className={`rounded-lg p-2 flex items-center gap-2 ${
            statusType === 'error'
              ? 'bg-red-900/30 border border-red-500/50'
              : statusType === 'success'
              ? 'bg-green-900/30 border border-green-500/50'
              : 'bg-blue-900/30 border border-blue-500/50'
          }`}
        >
          {statusType === 'error' ? (
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
          ) : statusType === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />
          ) : (
            <Loader2 className="w-4 h-4 text-blue-400 flex-shrink-0 animate-spin" />
          )}
          <p
            className={`text-xs leading-relaxed ${
              statusType === 'error' ? 'text-red-200' : statusType === 'success' ? 'text-green-200' : 'text-blue-200'
            }`}
          >
            {statusMsg}
          </p>
        </div>
      )}

      {/* 提交按钮 */}
      <div className="flex gap-3 pt-1">
        <button
          onClick={handleSubmit}
          disabled={uploading}
          className="flex-1 py-1.5 px-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 text-white rounded-lg transition-colors text-xs flex items-center justify-center gap-1"
        >
          {uploading ? (
            <>
              <Loader2 className="w-3 h-3 animate-spin" />
              提交中...
            </>
          ) : (
            '提交证据'
          )}
        </button>
      </div>
    </div>
  );
}

/** 将 File 转为 base64 字符串 */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
