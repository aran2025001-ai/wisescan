/**
 * 测试脚本：验证 DeepSeek API 调用和报告生成
 * 运行: npx tsx test-generate-report.ts
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions';
const MODEL = 'deepseek-chat';

const SYSTEM_PROMPT = `你是一个Web3安全审计专家，属于"明鉴·风险洞察官"系统。你的任务是分析区块链项目的安全风险。

## 核心原则（必须遵守）
1. **证据先行**：所有评分必须基于可验证的信息。如果某项信息无法获取，在评分中注明"未审计"/"信息不足"，不得编造。
2. **结论明确**：给出清晰的风险等级（极低风险/低风险/中等风险/高风险/极高风险）和参与建议（可以参与/谨慎参与/不建议参与/严禁参与）。
3. **用户自决**：报告仅提供参考，最终决策权归用户所有。

## 评分维度（总分100）
- 代码与技术安全（25分）：合约是否开源/审计、是否有已知漏洞
- 团队与运营透明度（20分）：团队是否实名、项目信息是否公开
- 经济模型与资金安全（20分）：代币分配是否合理、流动性是否锁定
- 社群与市场热度（15分）：社区活跃度、讨论是否正面
- 历史与执行可靠性（10分）：是否有违约记录、模式是否稳定
- 合规性与法律风险（10分）：是否有法律实体、是否有合规风险

## 输出格式
必须严格输出以下 JSON 结构（字段名固定，值必须根据实际分析填写，不得复制示例值）：
{
  "total_score": <整数，6维得分之和>,
  "risk_level": "<极低风险/低风险/中等风险/高风险/极高风险>",
  "conclusion": "<可以参与/谨慎参与/不建议参与/严禁参与>",
  "six_dimensions": [
    { "name": "代码与技术安全", "score": <整数>, "max": 25, "deduction": "<扣分原因>" },
    { "name": "团队与运营透明度", "score": <整数>, "max": 20, "deduction": "<扣分原因>" },
    { "name": "经济模型与资金安全", "score": <整数>, "max": 20, "deduction": "<扣分原因>" },
    { "name": "社群与市场热度", "score": <整数>, "max": 15, "deduction": "<扣分原因>" },
    { "name": "历史与执行可靠性", "score": <整数>, "max": 10, "deduction": "<扣分原因>" },
    { "name": "合规性与法律风险", "score": <整数>, "max": 10, "deduction": "<扣分原因>" }
  ],
  "radar_data": [<6个整数，与six_dimensions的score一一对应>],
  "public_opinion": "<互联网舆情分析，包含负面关键词、典型抱怨、舆情结论，200字以内>",
  "ai_summary": "<综合风险解读，包含核心风险点和参与建议，200字以内>"
}

⚠️ 重要：以上<...>标注的部分必须根据项目实际情况填写真实分析结果，不得留空，不得使用示例数据。`;

async function testDeepSeekAPI() {
  console.log('🧪 开始测试 DeepSeek API 调用...\n');

  const deepseekKey = process.env.VITE_DEEPSEEK_API_KEY;
  if (!deepseekKey) {
    console.error('❌ 缺少 VITE_DEEPSEEK_API_KEY 环境变量');
    process.exit(1);
  }
  console.log('✅ API Key 已配置');

  const projectName = 'MY';
  const address = '0x1234567890abcdef';
  const userPrompt = `请对以下项目进行安全风险评估：
- 项目名称：${projectName}
- 合约地址：${address}

请严格按照系统提示中的 JSON 格式输出评估结果。仅输出JSON，不要包含其他文字。`;

  try {
    console.log('\n📡 调用 DeepSeek API...');
    const startTime = Date.now();

    const dsRes = await fetch(DEEPSEEK_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${deepseekKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
        max_tokens: 4096,
      }),
    });

    const elapsed = Date.now() - startTime;
    console.log(`⏱️  响应时间: ${elapsed}ms`);

    if (!dsRes.ok) {
      const errText = await dsRes.text();
      console.error(`❌ DeepSeek API 错误 (${dsRes.status}):`, errText.slice(0, 500));
      process.exit(1);
    }

    const dsJson = await dsRes.json() as any;
    const rawContent = dsJson?.choices?.[0]?.message?.content;

    if (!rawContent) {
      console.error('❌ DeepSeek 返回空响应:', JSON.stringify(dsJson, null, 2));
      process.exit(1);
    }

    console.log('✅ DeepSeek API 调用成功');
    console.log('\n📄 原始响应内容（前500字符）:');
    console.log(rawContent.slice(0, 500));

    // 解析 JSON
    const jsonMatch = rawContent.match(/```(?:json)?\s*([\s\S]*?)```/);
    const jsonStr = jsonMatch ? jsonMatch[1].trim() : rawContent.trim();
    
    let reportData: any;
    try {
      reportData = JSON.parse(jsonStr);
      console.log('\n✅ JSON 解析成功');
    } catch (parseErr) {
      console.error('❌ JSON 解析失败:', parseErr);
      console.log('原始内容:', rawContent.slice(0, 1000));
      process.exit(1);
    }

    // 验证结构
    console.log('\n🔍 验证报告结构...');
    const requiredFields = ['total_score', 'risk_level', 'conclusion', 'six_dimensions', 'radar_data', 'public_opinion', 'ai_summary'];
    const missingFields = requiredFields.filter(f => !(f in reportData));
    
    if (missingFields.length > 0) {
      console.error('❌ 缺少必需字段:', missingFields);
      console.log('实际返回:', Object.keys(reportData));
      process.exit(1);
    }

    console.log('✅ 所有必需字段都存在');
    console.log('\n📊 报告数据预览:');
    console.log('- total_score:', reportData.total_score);
    console.log('- risk_level:', reportData.risk_level);
    console.log('- conclusion:', reportData.conclusion);
    console.log('- six_dimensions 数量:', reportData.six_dimensions?.length);
    console.log('- radar_data:', reportData.radar_data);
    console.log('- public_opinion（前100字）:', reportData.public_opinion?.slice(0, 100));
    console.log('- ai_summary（前100字）:', reportData.ai_summary?.slice(0, 100));

    // 测试 Supabase 存储
    console.log('\n💾 测试 Supabase 存储...');
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      console.warn('⚠️  缺少 Supabase 环境变量，跳过存储测试');
    } else {
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(supabaseUrl, supabaseKey);

      const { data: insertData, error: insertError } = await supabase
        .from('risk_reports')
        .insert({
          user_address: 'test_user',
          project_id: null,
          report_data: reportData,
          total_score: reportData.total_score,
          risk_level: reportData.risk_level,
        })
        .select()
        .single();

      if (insertError) {
        console.error('❌ Supabase 存储失败:', insertError.message);
        console.error('详细信息:', insertError);
      } else {
        console.log('✅ Supabase 存储成功!');
        console.log('   记录 ID:', insertData.id);
        console.log('   可通过以下 SQL 删除测试记录:');
        console.log(`   DELETE FROM risk_reports WHERE id = '${insertData.id}';`);
      }
    }

    console.log('\n🎉 测试完成！API 实现正确，可以生成真实报告。');

  } catch (err: any) {
    console.error('❌ 测试失败:', err.message);
    console.error(err);
    process.exit(1);
  }
}

testDeepSeekAPI();
