import { createConfig, http } from 'wagmi'
import {
  mainnet,
  sepolia,
  bsc,
  bscTestnet,
  polygon,
  arbitrum,
  base,
  optimism,
  avalanche,
  zkSync,
} from 'wagmi/chains'
import { connectorsForWallets } from '@rainbow-me/rainbowkit'
import {
  injectedWallet,
  walletConnectWallet,
  metaMaskWallet,
  tokenPocketWallet,
  imTokenWallet,
  trustWallet,
  okxWallet,
  coinbaseWallet,
  rabbyWallet,
  bitgetWallet,
  bybitWallet,
  braveWallet,
  safepalWallet,
  gateWallet,
} from '@rainbow-me/rainbowkit/wallets'

const connectors = connectorsForWallets(
  [
    {
      groupName: '推荐钱包',
      wallets: [
        injectedWallet,
        tokenPocketWallet,
        metaMaskWallet,
        imTokenWallet,
        trustWallet,
        okxWallet,
        coinbaseWallet,
        rabbyWallet,
        bitgetWallet,
        bybitWallet,
        braveWallet,
        safepalWallet,
        gateWallet,
      ],
    },
    {
      groupName: '其他',
      wallets: [walletConnectWallet],
    },
  ],
  {
    projectId: '71e2c66ca016811b34cdcc6f245a28d9',
    appName: 'WiseScan',
  },
)

export const config = createConfig({
  chains: [
    bsc,
    mainnet,
    bscTestnet,
    polygon,
    arbitrum,
    base,
    optimism,
    avalanche,
    zkSync,
    sepolia,
  ],
  connectors,
  transports: {
    [mainnet.id]: http(),
    [bsc.id]: http(),
    [bscTestnet.id]: http('https://bsc-testnet.nodereal.io/v1/d1b0c864588f4a71a5d0218db04ea872'),
    [polygon.id]: http(),
    [arbitrum.id]: http(),
    [base.id]: http(),
    [optimism.id]: http(),
    [avalanche.id]: http(),
    [zkSync.id]: http(),
    [sepolia.id]: http(),
  },
  ssr: false,
  // 使用 sessionStorage：
  // - localStorage 持久化过期的连接器信息 → wagmi 尝试用旧信息重连但钱包 provider 已回收 → 假性重连
  // - sessionStorage 在页面刷新时清空 → 每次是干净的连接请求 → 更可靠
  // - 同标签页内前进/后退保留连接 → 不会误退到欢迎页
  storage: typeof window !== 'undefined' ? window.sessionStorage : null,
})
