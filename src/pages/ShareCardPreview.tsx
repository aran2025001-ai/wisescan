import React from 'react';
import { ShareCard } from '../components/ShareCard';

/**
 * 分享卡片预览页面
 * 同时展示移动端和分享图两个版本
 */
const ShareCardPreview: React.FC = () => {
  const sampleData = {
    projectName: 'Tradoor',
    contractAddress: '0x9123456789abcdef6B1B6BE9ee5CF703123456789F492',
    top10Holding: 91.2,
    riskLevel: '高度集中',
    riskColor: 'red' as const,
    infoCompleteness: 60,
    completenessLevel: '中等',
    review: '合约开源并LP已锁定，但尚未完成审计且团队匿名。建议警惕控盘风险，保持谨慎观望态度，控制仓位。',
    qrCodeUrl: 'https://wisescan.xyz',
  };

  return (
    <div className="min-h-screen bg-slate-200 py-8">
      <h1 className="text-2xl font-bold text-center text-slate-800 mb-8">
        明鉴WiseScan · 分享卡片预览
      </h1>

      <div className="flex flex-wrap justify-center gap-12 px-4">
        {/* 移动端尺寸 */}
        <div>
          <h3 className="text-sm text-slate-500 mb-4 text-center font-medium">
            移动端 (375px)
          </h3>
          <div className="w-[375px] shadow-2xl rounded-2xl overflow-hidden mx-auto">
            <ShareCard {...sampleData} width={375} />
          </div>
        </div>

        {/* 分享图尺寸 */}
        <div>
          <h3 className="text-sm text-slate-500 mb-4 text-center font-medium">
            大尺寸预览 (600px宽)
          </h3>
          <div className="shadow-2xl rounded-2xl overflow-hidden mx-auto" style={{ width: 600 }}>
            <ShareCard {...sampleData} width={600} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ShareCardPreview;
