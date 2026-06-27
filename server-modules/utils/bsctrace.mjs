// api/utils/bsctrace.mjs
// NodeReal BSC RPC - 获取链上代币信息（name/symbol/decimals/totalSupply/balanceOf）
// 使用原生 JSON-RPC fetch（兼容性好，无外部依赖）

// 🔑 懒加载读取 env（因为 ESM import 先于 loadEnv() 执行，不能在顶层读 process.env）
function getRpcUrl() { return process.env.NODEREAL_RPC_URL || ''; }
function getApiKey() { return process.env.NODEREAL_API_KEY  || ''; }

/**
 * 发送 JSON-RPC 请求到 BSCTrace RPC
 * @param {string} method - RPC 方法名（如 'eth_call', 'eth_getBalance'）
 * @param {any[]} params - 方法参数
 * @returns {Promise<any>}
 */
async function rpcCall(method, params = []) {
  const rpcUrl = getRpcUrl();
  if (!rpcUrl) throw new Error('NODEREAL_RPC_URL 未配置');
  
  const headers = { 'Content-Type': 'application/json' };
  const apiKey = getApiKey();
  if (apiKey) headers['x-api-key'] = apiKey;

  const res = await fetch(rpcUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method,
      params,
    }),
  });

  if (!res.ok) throw new Error(`RPC HTTP ${res.status}: ${res.statusText}`);
  const json = await res.json();
  if (json.error) throw new Error(`RPC Error ${json.error.code}: ${json.error.message}`);
  return json.result;
}

// ERC-20 只读方法调用的 data 编码（简化版，仅支持 name/symbol/decimals/totalSupply/balanceOf）
// 使用标准方法签名 keccak 前 4 字节
const ERC20_SELECTOR = {
  name:        '0x06fdde03', // name()
  symbol:      '0x95d89b41', // symbol()
  decimals:    '0x313ce567', // decimals()
  totalSupply: '0x18160ddd', // totalSupply()
  balanceOf:   '0x70a08231', // balanceOf(address)
};

/**
 * 调用 ERC-20 合约的只读方法（通过 eth_call）
 * @param {string} contractAddress - 合约地址
 * @param {keyof typeof ERC20_SELECTOR} method - 方法名
 * @param {string[]} [extraArgs] - 额外参数（如 balanceOf 的地址）
 * @returns {Promise<string>} - 十六进制返回数据
 */
async function erc20Call(contractAddress, method, extraArgs = []) {
  let data = ERC20_SELECTOR[method];
  for (const arg of extraArgs) {
    // 地址参数需要 32 字节左对齐十六进制编码
    data += arg.toLowerCase().replace('0x','').padStart(64, '0');
  }
  const result = await rpcCall('eth_call', [
    { to: contractAddress, data },
    'latest',
  ]);
  return result;
}

/**
 * 解码 ABI-encoded string（ERC-20 name/symbol 返回动态字符串）
 * @param {string} hexStr
 * @returns {string}
 */
function decodeString(hexStr) {
  try {
    const hex = hexStr.replace(/^0x/, '');
    // 动态字符串：前 32 字节是 offset，再 32 字节是 length，之后是 UTF-8 数据
    const offset = parseInt(hex.slice(0, 64), 16);
    const len   = parseInt(hex.slice(offset * 2, offset * 2 + 64), 16);
    const strHex = hex.slice(offset * 2 + 64, offset * 2 + 64 + len * 2);
    return Buffer.from(strHex, 'hex').toString('utf-8').replace(/\0/g, '').trim();
  } catch {
    return hexStr;
  }
}

/**
 * 解码 uint256（大端序十六进制 → BigInt 字符串）
 * @param {string} hexStr
 * @returns {string}
 */
function decodeUint256(hexStr) {
  const hex = hexStr.replace(/^0x/, '');
  // 取最后 64 字符（uint256 返回值）
  const val = hex.slice(-64);
  return BigInt('0x' + val).toString();
}

/**
 * 解码 uint8（decimals）
 * @param {string} hexStr
 * @returns {number}
 */
function decodeUint8(hexStr) {
  const hex = hexStr.replace(/^0x/, '');
  return parseInt(hex.slice(-2), 16);
}

/**
 * 获取代币基本信息（name, symbol, decimals, totalSupply）
 * @param {string} contractAddress
 * @returns {Promise<{name:string, symbol:string, decimals:number, totalSupply:string}>}
 */
export async function getTokenInfo(contractAddress) {
  try {
    const [nameHex, symbolHex, decimalsHex, supplyHex] = await Promise.all([
      erc20Call(contractAddress, 'name').catch(() => '0x'),
      erc20Call(contractAddress, 'symbol').catch(() => '0x'),
      erc20Call(contractAddress, 'decimals').catch(() => '0x12'), // 默认 18
      erc20Call(contractAddress, 'totalSupply').catch(() => '0x'),
    ]);

    return {
      name:        nameHex === '0x' ? '未知' : decodeString(nameHex),
      symbol:       symbolHex === '0x' ? '未知' : decodeString(symbolHex),
      decimals:     decimalsHex === '0x12' ? 18 : decodeUint8(decimalsHex),
      totalSupply:  supplyHex === '0x' ? '0' : decodeUint256(supplyHex),
    };
  } catch (err) {
    console.error('[BSCTrace] getTokenInfo 失败:', err.message);
    return { name: '未知', symbol: '未知', decimals: 18, totalSupply: '0' };
  }
}

/**
 * 获取指定地址的代币余额（balanceOf）
 * @param {string} contractAddress - ERC20 合约
 * @param {string} walletAddress   - 钱包地址
 * @returns {Promise<string>} 原始余额（wei 单位，BigInt 十进制字符串）
 */
export async function getBalanceOf(contractAddress, walletAddress) {
  try {
    const hex = await erc20Call(contractAddress, 'balanceOf', [walletAddress]);
    return decodeUint256(hex);
  } catch (err) {
    console.error('[BSCTrace] getBalanceOf 失败:', err.message);
    return '0';
  }
}

/**
 * 检查地址是否为合约（通过获取 bytecode）
 * @param {string} address
 * @returns {Promise<{isContract:boolean, codeSize:number}>}
 */
export async function getContractStatus(address) {
  try {
    const code = await rpcCall('eth_getCode', [address, 'latest']);
    const isContract = code && code !== '0x';
    return {
      isContract: !!isContract,
      codeSize: isContract ? (code.length - 2) / 2 : 0,
    };
  } catch (err) {
    console.error('[BSCTrace] getContractStatus 失败:', err.message);
    return { isContract: false, codeSize: 0 };
  }
}

/**
 * 获取 BSC 最新区块号（用于验证 RPC 连通性）
 * @returns {Promise<string>}
 */
export async function getLatestBlockNumber() {
  try {
    const hex = await rpcCall('eth_blockNumber', []);
    return BigInt(hex).toString();
  } catch (err) {
    console.error('[BSCTrace] RPC 连通性检查失败:', err.message);
    return '0';
  }
}

/**
 * 格式化 totalSupply 为人类可读字符串
 * @param {string} totalSupplyRaw - BigInt 十进制字符串
 * @param {number} decimals       - 小数位数
 * @returns {string}
 */
export function formatSupply(totalSupplyRaw, decimals) {
  try {
    const bi = BigInt(totalSupplyRaw);
    const divisor = 10n ** BigInt(decimals);
    const intPart = bi / divisor;
    const fracPart = bi % divisor;
    if (fracPart === 0n) return intPart.toLocaleString('en-US');
    const fracStr = fracPart.toString().padStart(decimals, '0').replace(/0+$/, '');
    return fracStr ? `${intPart.toLocaleString('en-US')}.${fracStr}` : intPart.toLocaleString('en-US');
  } catch {
    return totalSupplyRaw || '0';
  }
}
