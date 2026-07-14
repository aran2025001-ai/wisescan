import { useState, useCallback, useEffect } from 'react'
import { encodeFunctionData, parseUnits } from 'viem'
import { createPortal } from 'react-dom'

interface PaymentModalProps {
  isOpen: boolean
  onClose: () => void
  reportType: 'risk' | 'business'
  price: number
  projectId?: string
  projectName?: string
  userAddress: string
  couponAmount?: number
  couponId?: string
  priceType?: 'standard' | 'update'  // standard=首次, update=更新报告
  onPaymentSuccess: () => void
}

type PaymentStatus =
  | 'idle'
  | 'switchingChain'
  | 'confirming'
  | 'broadcasting'
  | 'pending'
  | 'verifying'
  | 'success'
  | 'failed'

const USDT_ABI = [
  {
    name: 'transfer',
    type: 'function',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'decimals',
    type: 'function',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }],
  },
] as const

export default function PaymentModal({
  isOpen,
  onClose,
  reportType,
  price,
  projectId,
  projectName,
  userAddress,
  couponAmount,
  couponId,
  priceType,
  onPaymentSuccess,
}: PaymentModalProps) {

  const [status, setStatus] = useState<PaymentStatus>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [txHash, setTxHash] = useState('')
  const [manualTxHash, setManualTxHash] = useState('')
  const [whitelisted, setWhitelisted] = useState(false)

  // 自动检查当前地址是否在白名单中
  useEffect(() => {
    if (!userAddress) { setWhitelisted(false); return }
    fetch(`/api/whitelist?action=check&address=${encodeURIComponent(userAddress)}`)
      .then(r => r.json())
      .then(j => { if (j.whitelisted) setWhitelisted(true) })
      .catch(() => {})
  }, [userAddress])

  const isMainnet = import.meta.env.VITE_IS_MAINNET === 'true' || false
  const targetChainName = isMainnet ? 'BSC 主网' : 'BSC 测试网'
  const usdtAddress = isMainnet
    ? (import.meta.env.VITE_USDT_CONTRACT_ADDRESS || '0x55d398326f99059fF775485246999027B3197955')
    : '0x337610d27c682E347C9cD60BD4b3b107C9d34dDd'
  const recipientAddress = import.meta.env.VITE_PAYMENT_RECIPIENT_ADDRESS || ''
  const scanUrl = isMainnet
    ? `https://bscscan.com/tx/`
    : `https://testnet.bscscan.com/tx/`

  const deductedPrice = couponAmount ? Math.max(0, price - couponAmount) : price
  const finalPrice = Math.max(deductedPrice, 0.01)
  const reportLabel = reportType === 'risk' ? '全景风险报告' : '商业模式拆解报告'

  const reset = useCallback(() => {
    setStatus('idle')
    setErrorMsg('')
    setTxHash('')
    setManualTxHash('')
  }, [])

  /** 收款地址短格式 */
  const shortAddr = `${recipientAddress.slice(0, 6)}...${recipientAddress.slice(-4)}`

  /** 尝试通过钱包发交易 — 直接调 window.ethereum，绕过所有中间层 */
  const trySendTransaction = async () => {
    const decimals = isMainnet ? 18 : 6
    const amountWei = parseUnits(finalPrice.toFixed(2), decimals)
    const data = encodeFunctionData({
      abi: USDT_ABI,
      functionName: 'transfer',
      args: [recipientAddress as `0x${string}`, amountWei],
    })

    const eth = (window as any).ethereum
    if (!eth?.request) throw new Error('未检测到钱包，请确认已连接钱包')

    // 先确保钱包在正确的链上（带超时，TP Wallet 可能对某些 RPC 方法不响应）
    const targetChainId = isMainnet ? '0x38' : '0x61'  // 56=0x38, 97=0x61
    try {
      await Promise.race([
        eth.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: targetChainId }],
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 2000)),
      ])
    } catch (switchErr: any) {
      // 超时或已在正确链上 → 不阻塞，继续
      if (switchErr?.code === 4902 || switchErr?.message === 'timeout') {
        // 超时不处理，继续；4902 需要添加链
        try {
          await Promise.race([
            eth.request({
              method: 'wallet_addEthereumChain',
              params: [{
                chainId: targetChainId,
                chainName: isMainnet ? 'BSC Mainnet' : 'BSC Testnet',
                rpcUrls: [isMainnet
                  ? (import.meta.env.VITE_BSC_RPC_URL || 'https://bsc-mainnet.nodereal.io/v1/d1b0c864588f4a71a5d0218db04ea872')
                  : (import.meta.env.VITE_BSC_TESTNET_RPC_URL || 'https://bsc-testnet.nodereal.io/v1/d1b0c864588f4a71a5d0218db04ea872')],
                nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
                blockExplorerUrls: [isMainnet ? 'https://bscscan.com' : 'https://testnet.bscscan.com'],
              }],
            }),
            new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 2000)),
          ])
        } catch {}
      }
    }

    // 获取当前 gasPrice；TP Wallet 在 BSC 测试网可能无法自己拿到，我们显式传
    let gasPriceHex = '0x2540BE400' // 默认 10 Gwei
    try {
      const gp = await eth.request({ method: 'eth_gasPrice', params: [] }) as string
      if (gp && gp !== '0x0') {
        gasPriceHex = gp
        console.log('⛽ 当前 gasPrice:', gp)
      }
    } catch (e) {
      console.warn('⛽ 获取 gasPrice 失败，使用默认 10 Gwei:', e)
    }

    // 获取 nonce；TP Wallet 在 BSC 测试网可能报 getNonce 网络不可用，我们直接走 RPC 拿
    let nonceHex: string | undefined
    try {
      const nonce = await eth.request({
        method: 'eth_getTransactionCount',
        params: [userAddress, 'latest'],
      }) as string
      if (nonce) {
        nonceHex = nonce
        console.log('🔢 nonce:', nonce)
      }
    } catch (e) {
      console.warn('🔢 通过钱包获取 nonce 失败，尝试直接走 RPC:', e)
    }

    if (!nonceHex) {
      // fallback：直接调用 NodeReal RPC 获取 nonce
      try {
        const rpcUrl = isMainnet
          ? (import.meta.env.VITE_BSC_RPC_URL || 'https://bsc-mainnet.nodereal.io/v1/d1b0c864588f4a71a5d0218db04ea872')
          : (import.meta.env.VITE_BSC_TESTNET_RPC_URL || 'https://bsc-testnet.nodereal.io/v1/d1b0c864588f4a71a5d0218db04ea872')
        const res = await fetch(rpcUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'eth_getTransactionCount',
            params: [userAddress, 'latest'],
            id: Date.now(),
          }),
        })
        const json = await res.json()
        if (json.result) {
          nonceHex = json.result
          console.log('🔢 通过 RPC 获取 nonce:', nonceHex)
        }
      } catch (e) {
        console.warn('🔢 直接走 RPC 获取 nonce 也失败:', e)
      }
    }

    const txParams: any = {
      from: userAddress,
      to: usdtAddress,
      data,
      gas: '0x30d40',  // 200000
      gasPrice: gasPriceHex,
    }
    if (nonceHex) txParams.nonce = nonceHex

    // 链已切好，发交易
    return await eth.request({
      method: 'eth_sendTransaction',
      params: [txParams],
    }) as string
  }

  const handlePay = async () => {
    // 白名单用户：模拟支付流程，不实际扣费
    if (whitelisted) {
      setStatus('confirming')
      await new Promise(r => setTimeout(r, 1000))
      setStatus('broadcasting')
      await new Promise(r => setTimeout(r, 1000))
      setStatus('pending')
      await new Promise(r => setTimeout(r, 1000))
      setStatus('success')
      await new Promise(r => setTimeout(r, 800))
      onPaymentSuccess()
      return
    }

    setStatus('confirming')

    // 先检查是否有钱包 provider
    const eth = (window as any).ethereum
    if (!eth?.request) {
      setStatus('failed')
      setErrorMsg('未检测到钱包，请确认已连接 TP Wallet')
      return
    }

    // 检查是否已连接钱包地址（和当前页面的 address 是否一致）
    if (!userAddress) {
      setStatus('failed')
      setErrorMsg('请先连接钱包')
      return
    }

    setStatus('broadcasting')

    try {
      // 先切换链（已在BSC链上则静默通过无弹窗），再发交易
      const hash = await trySendTransaction()

      console.log('💳 交易已发送，hash:', hash)
      setTxHash(hash)
      setStatus('pending')

      // 简短等待交易入块（3秒），然后交给后端等区块确认
      await new Promise(r => setTimeout(r, 3000))

      setStatus('verifying')

      // 调用后端验证
      const verifyRes = await fetch('/api/verify-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          txHash: hash,
          reportType,
          userAddress,
          projectId: projectId || undefined,
          couponId: couponId || undefined,
          expectedAmount: finalPrice,
          priceType: priceType || 'standard',
        }),
      })
      const verifyData = await verifyRes.json()

      if (verifyData.success) {
        setStatus('success')
        await new Promise(r => setTimeout(r, 1500))
        onPaymentSuccess()
        onClose()
      } else {
        setStatus('failed')
        setErrorMsg(verifyData.error || '支付验证失败')
      }
    } catch (err: any) {
      console.error('💳 支付错误:', err)

      // 用户取消签名
      if (err.code === 4001 || err.code === 'ACTION_REJECTED' || err?.message?.includes('rejected')) {
        setStatus('idle')
        setErrorMsg('')
        return
      }

      // 记录原始错误信息便于排查
      const rawMsg = typeof err === 'string' ? err : (err?.message || err?.reason || JSON.stringify(err))
      console.warn('🔍 原始错误:', rawMsg)

      // 显示具体错误原因，避免用户困惑
      setStatus('failed')
      setErrorMsg('自动支付失败：' + (rawMsg || '未知错误，请重试'))
    }
  }

  /** 验证手动输入的 txHash */
  const handleVerifyManual = async () => {
    const hash = manualTxHash.trim()
    if (!hash || hash.length < 10) {
      setErrorMsg('请输入有效的交易哈希')
      return
    }

    setStatus('verifying')

    try {
      const verifyRes = await fetch('/api/verify-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          txHash: hash,
          reportType,
          userAddress,
          projectId: projectId || undefined,
          couponId: couponId || undefined,
          expectedAmount: finalPrice,
          priceType: priceType || 'standard',
        }),
      })
      const verifyData = await verifyRes.json()

      if (verifyData.success) {
        setStatus('success')
        await new Promise(r => setTimeout(r, 1500))
        onPaymentSuccess()
        onClose()
      } else {
        setStatus('failed')
        setErrorMsg('验证失败：' + (verifyData.error || '交易未确认'))
      }
    } catch (err: any) {
      setStatus('failed')
      setErrorMsg('验证失败：' + (err?.message || '网络异常'))
    }
  }

  if (!isOpen) return null

  // ---- UI ----
  const isProcessing = ['confirming', 'switchingChain', 'broadcasting', 'pending', 'verifying'].includes(status)

  const statusContent = () => {
    switch (status) {
      case 'confirming':
        return (
          <div className="text-center py-4">
            <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-2" />
            <p className="text-xs text-zinc-300">准备支付...</p>
          </div>
        )
      case 'switchingChain':
        return (
          <div className="text-center py-4">
            <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-2" />
            <p className="text-xs text-zinc-300">正在切换到{isMainnet ? 'BSC主网' : 'BSC测试网'}...</p>
          </div>
        )
      case 'broadcasting':
        return (
          <div className="text-center py-4">
            <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-2" />
            <p className="text-xs text-zinc-300">请在钱包中确认交易...</p>
          </div>
        )
      case 'pending':
        return (
          <div className="text-center py-4">
            <div className="animate-spin w-6 h-6 border-2 border-yellow-500 border-t-transparent rounded-full mx-auto mb-2" />
            <p className="text-xs text-zinc-300">交易已提交，等待上链确认...</p>
            {txHash && (
              <a href={scanUrl + txHash} target="_blank" rel="noopener noreferrer"
                className="text-xs text-blue-400 underline mt-1 inline-block">
                在 BscScan 查看
              </a>
            )}
          </div>
        )
      case 'verifying':
        return (
          <div className="text-center py-4">
            <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-2" />
            <p className="text-xs text-zinc-300">正在验证支付...</p>
          </div>
        )
      case 'success':
        return (
          <div className="text-center py-4">
            <div className="text-green-400 text-2xl mb-2">✅</div>
            <p className="text-xs text-green-400 font-medium">支付成功！</p>
            <p className="text-xs text-zinc-400 mt-1">报告即将解锁...</p>
          </div>
        )
      case 'failed':
        return (
          <div className="text-center py-4">
            <div className="text-red-400 text-2xl mb-2">❌</div>
            <p className="text-xs text-red-400 font-medium">支付未确认</p>
            {errorMsg && (
              <p className="text-[10px] text-zinc-400 mt-1 px-2 break-words">{errorMsg}</p>
            )}
            <p className="text-[10px] text-zinc-500 mt-1">如果钱包显示已扣费，请稍候 30 秒后重试</p>

            {/* 收款信息（仅展示，让用户核对是否真的支付了） */}
            <div className="bg-zinc-800/60 rounded text-left p-2.5 mt-2 space-y-1 text-[11px]">
              <p className="text-zinc-400">收款地址：</p>
              <p className="text-zinc-50 break-all font-mono select-all">{recipientAddress}</p>
              <p className="text-zinc-400 mt-1">金额：</p>
              <p className="text-zinc-50 font-semibold">{finalPrice.toFixed(2)} USDT</p>
              <p className="text-zinc-400 mt-1">网络：</p>
              <p className="text-zinc-50">{targetChainName}</p>
            </div>

            <button onClick={() => { reset(); handlePay() }}
              className="mt-3 text-[10px] text-blue-400 underline">
              重试支付
            </button>
          </div>
        )
      default:
        return null
    }
  }

  return createPortal(
    <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-[99999]"
      onClick={() => { if (!isProcessing) onClose() }}>
      <div className="bg-zinc-900 rounded-t-xl sm:rounded-xl w-full sm:w-80 mx-0 sm:mx-4 border border-[#343438] overflow-hidden"
        onClick={e => e.stopPropagation()}>

        {/* 头部 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#343438]">
          <h3 className="text-sm font-semibold text-white">💳 确认支付</h3>
          {!isProcessing && (
            <button onClick={onClose} className="text-zinc-400 hover:text-white text-lg leading-none">&times;</button>
          )}
        </div>

        {/* 支付详情 */}
        <div className="px-4 py-3 space-y-2.5">
          <div className="flex justify-between text-xs">
            <span className="text-zinc-400">商品</span>
            <span className="text-zinc-50">{reportLabel}</span>
          </div>
          {projectName && (
            <div className="flex justify-between text-xs">
              <span className="text-zinc-400">项目</span>
              <span className="text-zinc-50">{projectName}</span>
            </div>
          )}
          <div className="flex justify-between text-xs">
            <span className="text-zinc-400">网络</span>
            <span className="text-zinc-50">{isMainnet ? 'BSC 主网' : 'BSC 测试网'}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-zinc-400">收款地址</span>
            <span className="text-zinc-50 font-mono text-[10px]">{recipientAddress.slice(0, 6)}...{recipientAddress.slice(-4)}</span>
          </div>

          {/* 金额 */}
          <div className="bg-zinc-800/60 rounded px-3 py-2 mt-1">
            <div className="flex justify-between items-center">
              <span className="text-xs text-zinc-400">应付金额</span>
              <span className="text-sm font-bold text-white">{finalPrice.toFixed(2)} USDT</span>
            </div>
            {couponAmount && couponAmount > 0 && (
              <div className="flex justify-between items-center mt-1">
                <span className="text-xs text-green-400">代金券抵扣</span>
                <span className="text-xs text-green-400">-{couponAmount.toFixed(2)} USDT</span>
              </div>
            )}
            {couponAmount && couponAmount > 0 && (
              <div className="flex justify-between items-center mt-0.5">
                <span className="text-xs text-zinc-500">原价</span>
                <span className="text-xs text-zinc-500 line-through">{price.toFixed(2)} USDT</span>
              </div>
            )}
          </div>

          {/* Gas 费提醒 */}
          <p className="text-[10px] text-zinc-500 text-center">
            * 请确保钱包有足量{isMainnet ? 'BNB' : '测试BNB'}作为 Gas 费
          </p>

          {/* 状态指示器 */}
          {statusContent()}
        </div>

        {/* 支付按钮 */}
        {status === 'idle' && (
          <div className="px-4 pb-4">
            <button onClick={handlePay}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-full transition-colors">
              确认支付 {finalPrice.toFixed(2)} USDT
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}
