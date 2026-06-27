/**
 * search-fallback.mjs — 多级搜索降级
 *
 * 优先级（按顺序自动降级）:
 *   1. Tavily（主搜索引擎，质量最高，1000次/月免费）
 *   2. DuckDuckGo（备选，完全免费，无需 API Key）
 *
 * 全部失败 → 返回空结果，不影响报告生成。
 */

// ─── DuckDuckGo 搜索（完全免费，无需 API Key）───────────────
async function duckDuckGoSearch(query, timeoutMs = 4000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const qStart = Date.now();

  try {
    // DuckDuckGo 的 HTML 搜索端点（轻量，返回精简 HTML）
    const encoded = encodeURIComponent(query);
    const res = await fetch(`https://html.duckduckgo.com/html/?q=${encoded}`, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      },
    });

    if (!res.ok) {
      throw new Error(`DuckDuckGo HTTP ${res.status}`);
    }

    const html = await res.text();
    const elapsed = ((Date.now() - qStart) / 1000).toFixed(1);

    // 从 HTML 中提取搜索结果行
    // DuckDuckGo HTML 结构：
    //   <a class="result__a" href="...">标题</a>
    //   <a class="result__snippet" href="...">摘要...</a>
    const results = [];
    const titleRegex = /<a[^>]+class="result__a"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
    const snippetRegex = /<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;

    const titles = [];
    let m;
    while ((m = titleRegex.exec(html)) !== null) {
      const title = m[2].replace(/<[^>]*>/g, '').trim();
      const url = m[1].trim();
      if (title && url && !url.startsWith('//')) {
        titles.push({ title, url });
      }
    }

    const snippets = [];
    while ((m = snippetRegex.exec(html)) !== null) {
      snippets.push(m[1].replace(/<[^>]*>/g, '').trim());
    }

    // 合并标题 + 摘要
    for (let i = 0; i < titles.length; i++) {
      results.push({
        title: titles[i].title,
        url: titles[i].url,
        content: snippets[i] || '',
        score: 1,   // DuckDuckGo 没有评分信息
      });
    }

    console.log(`  🦆 [DuckDuckGo] "${query.slice(0, 40)}..." 耗时 ${elapsed}s, 返回 ${results.length} 条`);
    return results;
  } catch (err) {
    if (err.name === 'AbortError') {
      console.warn(`  🦆 [DuckDuckGo] 超时 ⏱️`);
    } else {
      console.warn(`  🦆 [DuckDuckGo] 失败: ${err.message}`);
    }
    return [];
  } finally {
    clearTimeout(timer);
  }
}

// ─── Tavily 搜索 ────────────────────────────────────────
async function tavilySearch(query, apiKey, timeoutMs = 4000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const qStart = Date.now();

  try {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        query: query,
        topic: 'general',
        search_depth: 'basic',
        max_results: 5,
        include_answer: true,
        include_raw_content: false,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      // 432 = 配额耗尽 → 降级
      // 其他 HTTP 错误也降级
      const elapsed = ((Date.now() - qStart) / 1000).toFixed(1);
      console.log(`  🔍 [Tavily] HTTP ${res.status} (${elapsed}s) — 将降级`);
      return { results: [], error: `HTTP ${res.status}`, answerText: '' };
    }

    const data = await res.json();
    const elapsed = ((Date.now() - qStart) / 1000).toFixed(1);

    let answerText = '';
    if (data.answer && typeof data.answer === 'string' && data.answer.trim()) {
      answerText = data.answer.trim();
    }

    // 后处理：去重
    const seenUrls = new Set();
    const seenTitles = new Set();
    const results = (data.results || [])
      .filter(r => {
        const normUrl = (r.url || '').replace(/^https?:\/\//, '').replace(/\/$/, '');
        const normTitle = (r.title || '').trim().toLowerCase();
        if (seenUrls.has(normUrl) || seenTitles.has(normTitle)) return false;
        seenUrls.add(normUrl);
        seenTitles.add(normTitle);
        return true;
      })
      .slice(0, 5)
      .map(r => ({
        title: r.title || '',
        url: r.url || '',
        content: (r.content || '').slice(0, 300),
        score: r.score || 0,
      }));

    console.log(`  🔍 [Tavily] "${query.slice(0, 40)}..." 耗时 ${elapsed}s, 返回 ${results.length} 条`);
    return { results, answerText };
  } catch (err) {
    const elapsed = ((Date.now() - qStart) / 1000).toFixed(1);
    if (err.name === 'AbortError') {
      console.log(`  🔍 [Tavily] 超时 ⏱️ (${elapsed}s) — 将降级`);
    } else {
      console.warn(`  🔍 [Tavily] 失败: ${err.message} (${elapsed}s) — 将降级`);
    }
    return { results: [], error: err.message, answerText: '' };
  } finally {
    clearTimeout(timer);
  }
}

// ─── 域名优先级排序（与原有逻辑保持一致）────────────────
const DOMAIN_PRIORITY = {
  'github.com': 1, 'etherscan.io': 1, 'bscscan.com': 1,
  'coinmarketcap.com': 1, 'coingecko.com': 1,
  'reuters.com': 2, 'bloomberg.com': 2,
  'docs.searxng.org': 99,
};
function getDomainPriority(url) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    return DOMAIN_PRIORITY[host] || 5;
  } catch { return 5; }
}

// ─── 搜索降级调度器 ─────────────────────────────────────
// 按顺序尝试 Tavily → DuckDuckGo
// DuckDuckGo 独立超时（比 Tavily 长 2s，因为免费引擎响应慢）
const DDG_TIMEOUT_MS = 8000;

// 返回 { results: [...], answerText: '', engine: 'tavily'|'duckduckgo'|null }
async function searchWithFallback(query, tavilyApiKey = null, timeoutMs = 4000, engineLog = []) {
  // 1. Tavily（有 API Key 时优先）
  if (tavilyApiKey) {
    const result = await tavilySearch(query, tavilyApiKey, timeoutMs);
    if (result.results && result.results.length > 0) {
      engineLog.push({ query: query.slice(0, 50), engine: 'tavily', count: result.results.length });
      return { ...result, engine: 'tavily' };
    }
    // Tavily 失败或返回空 → 标注降级原因
    const reason = result.error || '空结果';
    console.log(`  ⤵️ [降级] Tavily 失败 (${reason}) → DuckDuckGo`);
  } else {
    console.log(`  ⤵️ [降级] 无 Tavily Key → DuckDuckGo`);
  }

  // 2. DuckDuckGo（免费备胎，给更长的超时时间）
  const ddgResults = await duckDuckGoSearch(query, DDG_TIMEOUT_MS);
  if (ddgResults && ddgResults.length > 0) {
    engineLog.push({ query: query.slice(0, 50), engine: 'duckduckgo', count: ddgResults.length });
    return { results: ddgResults, answerText: '', engine: 'duckduckgo' };
  }

  // 全部失败
  engineLog.push({ query: query.slice(0, 50), engine: 'none', count: 0 });
  console.log(`  ❌ [搜索] "${query.slice(0, 40)}..." 全部引擎失败，跳过`);
  return { results: [], answerText: '', engine: null };
}

export {
  searchWithFallback,
  duckDuckGoSearch,
  tavilySearch,
  getDomainPriority,
};
