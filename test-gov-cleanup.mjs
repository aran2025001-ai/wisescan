/**
 * test-gov-cleanup.mjs — 与 api-server.mjs 中 cleanGovClaims 保持同步
 * 验证所有 FBI/DFPI/监管机构幻觉被替换为中性"公开网络"表述
 */
function cleanGovClaims(text, hasGovSource = false) {
  if (!text || typeof text !== 'string') return text;
  let r = text;
  r = r.replace(/执法机构/g, '公开网络渠道').replace(/监管机构/g, '公开网络渠道').replace(/向执法/g, '向网络').replace(/相关执法/g, '相关网络');
  r = r
    .replace(/FBI[^，。]*已启动[^，。]*行动/g, '有用户在网络投诉')
    .replace(/FBI[^，。]*受害者识别/g, '有用户在网络投诉')
    .replace(/FBI[^，。]*诈骗受害者/g, '有用户在网络投诉')
    .replace(/被FBI[^，。]*调查/g, '有公开网络投诉报道')
    .replace(/被FBI[^，。]*立案/g, '有公开网络投诉报道')
    .replace(/被FBI[^，。]*通缉/g, '有公开网络投诉报道')
    .replace(/被FBI举报/g, '有用户通过公开渠道举报')
    .replace(/向FBI[^，。]*举报/g, '有用户通过公开渠道举报')
    .replace(/举报至FBI[^，。]*/gi, '有用户通过网络平台投诉')
    .replace(/用户被(?:引导|建议)/g, '')
    .replace(/FBI举报/g, '有用户在网络投诉')
    .replace(/fbi\.gov[^，。]*(?:诈骗|警示|举报)/gi, '网络上有相关风险报道');
  r = r
    .replace(/被SEC[^，。]*调查/g, '有公开合规风险报道')
    .replace(/被SEC[^，。]*起诉/g, '有公开合规风险报道')
    .replace(/向SEC[^，。]*举报/g, '有用户通过公开渠道举报')
    .replace(/SEC[^，。]*已启动[^，。]*调查/g, '有公开合规风险报道');
  if (!hasGovSource) {
    r = r
      .replace(/[^，。]{2,20}(?:金融保护|监管|监督|管理)部?（?有相关/g, '公开网络存在相关')
      .replace(/[^，。]{2,20}(?:金融保护|监管|监督|管理)部?（?有用户/g, '公开网络存在用户')
      .replace(/dfpi\.ca\.gov[^，。]*(?:警示列表|警告)[^，。]*(?:明确)?(?:标记|列入|列为)[^，。]*(?:诈骗|欺诈)/gi, '公开网络存在相关风险报道')
      .replace(/dfpi\.ca\.gov[^，。]*(?:警示列表|警告)[^，。]*/gi, '公开网络存在相关风险报道')
      .replace(/dfpi\.ca\.gov[^，。]*(?:标记|列入|列为)/gi, '公开网络存在相关风险报道')
      .replace(/dfpi\.ca\.gov[^，。]*警示列表[^，。]*显示[^，。]*标记为诈骗/g, '公开网络存在相关风险报道')
      .replace(/dfpi\.ca\.gov[^，。]*警示列表[^，。]*显示[^，。]*列入[^，。]*诈骗/g, '公开网络存在相关风险报道')
      .replace(/被DFPI[^，。]*标记[^，。]*诈骗/g, '公开网络存在相关风险报道')
      .replace(/被DFPI[^，。]*列入[^，。]*诈骗警示列表/g, '公开网络存在相关风险报道')
      .replace(/被DFPI[^，。]*列入[^，。]*加密货币诈骗警示列表/g, '公开网络存在相关风险报道')
      .replace(/被DFPI[^，。]*标记/g, '公开网络存在相关风险报道')
      .replace(/被DFPI[^，。]*列入/g, '公开网络存在相关风险报道')
      .replace(/DFPI[^，。]*警示列表/g, '公开网络风险报道')
      .replace(/DFPI[^，。]*诈骗警示列表/g, '公开网络风险报道')
      .replace(/DFPI标记为撤池跑路/g, '公开网络风险报道')
      .replace(/被[^，。]{2,6}(?:官方)?机构[^，。]*(?:列入|列为)/g, '公开网络存在相关风险报道')
      .replace(/被[^，。]{2,6}(?:官方)?机构[^，。]*标记/g, '公开网络存在相关风险报道')
      .replace(/被[^，。]{2,6}(?:官方)?机构[^，。]*调查/g, '公开网络存在相关报道')
      .replace(/被[^，。]{2,6}(?:官方)?机构[^，。]*举报/g, '有用户通过公开渠道投诉')
      .replace(/被[^，。]{2,6}(?:官方)?机构[^，。]*(?:列为|定性为|认定为)/g, '公开网络存在相关风险报道');
  }
  r = r
    .replace(/，\s*，/g, '，').replace(/。\s*。/g, '。').replace(/；\s*；/g, '；')
    .replace(/，\s*$/g, '').replace(/。\s*$/g, '').replace(/，\s*。/g, '。')
    .replace(/[（(][^，。)]*$/g, '').replace(/[（(]\s*[）)]?/g, '').replace(/\s*[）)]\s*/g, '')
    .replace(/被[^，。]{4,30}(?:公开网络|有用户|有公开)/g, '公开网络存在')
    .replace(/(有用户通过公开渠道举报[，。]?\s*)有用户通过公开渠道举报/g, '有用户通过公开渠道举报')
    .replace(/(有用户通过网络平台投诉[，。]?\s*)有用户通过网络平台投诉/g, '有用户通过网络平台投诉')
    .replace(/(公开网络存在相关[^，。]*[，。]?\s*)公开网络存在相关/g, '公开网络存在相关')
    .replace(/,([^，。])/g, '，$1').trim();
  return r;
}

let passed = 0, failed = 0;
function test(label, input, hasGovSource = false) {
  const result = cleanGovClaims(input, hasGovSource);
  const checks = [
    [/FBI已启动|被FBI调查|被FBI举报|举报至FBI/, 'FBI字面'],
    [/用户被(?:引导|建议)/, '用户被引导/建议'],
    [/被DFPI|DFPI警示列表|DFPI诈骗|dfpi\.ca\.gov警示/, 'DFPI字面'],
    [/被SEC|SEC已启动/, 'SEC字面'],
    [/[。，]?\s*有用户通过公开渠道举报[。，]?\s*有用户通过公开渠道举报/, '重复举报'],
    [/[。，]?\s*公开网络存在相关[^，。]*[，。]?\s*公开网络存在相关/, '重复公开网络'],
    [/[（(][^]，。]*$/, '未闭合括号(英文)'],
    [/[\uFF08(][^\)\uFF09]*$/, '未闭合括号(中文)'],
    [/执法机构|监管机构/, '执法/监管字样'],
    [/被[^，。]{4,30}(?:公开网络|有用户|有公开)/, '被[agency]公开网络残留'],
  ];
  const issues = checks.filter(([re]) => re.test(result)).map(([,n]) => n);
  if (issues.length > 0 && !hasGovSource) {
    console.log(`❌ FAIL: ${label}`);
    console.log(`   残留: ${issues.join(', ')}`);
    console.log(`   输出: ${result}`);
    failed++;
  } else {
    console.log(`✅ PASS: ${label}`);
    console.log(`   输出: ${result}`);
    passed++;
  }
}

console.log('🧪 V2.1 测试\n');
test('核心: 舆情摘要' , '项目被美国加州金融保护与创新部（DFPI）列入加密货币诈骗警示列表，用户被引导向FBI和SEC举报。BBB网站有用户投诉记录。FBI已启动相关诈骗受害者识别行动。');
test('核心: 中文机构括号', '项目被美国加州金融保护与创新部（有相关监管风险报道，有用户声称已向执法机构举报');
test('核心: dfpi.ca.gov', '【网络搜索-Tavily】dfpi.ca.gov警示列表明确标记为诈骗/欺诈');
test('核心: 被DFPI列入', '项目被DFPI列入加密货币诈骗警示列表');
test('FBI已启动', 'FBI已启动相关行动');
test('被FBI调查', '该项目被FBI调查');
test('被FBI举报', '该项目被FBI举报');
test('举报至FBI', '用户举报至FBI');
test('向FBI举报', '有用户声称已向FBI举报');
test('fbi.gov警示', 'fbi.gov有相关诈骗警示');
test('被SEC调查', '该项目被SEC调查');
test('用户被引导/建议', '用户被引导向FBI举报，用户被建议举报至FBI');
test('被官方机构列入', '项目已被官方机构列入诈骗名单');
test('被机构调查', '项目已被相关机构调查');
test('hasGovSource=true', 'dfpi.ca.gov警示列表明确标记为诈骗', true);
console.log(`\n通过: ${passed}  失败: ${failed}  总数: ${passed+failed}`);
process.exit(failed > 0 ? 1 : 0);
