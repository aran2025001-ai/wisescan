import { createConfig, http } from 'wagmi'
import { mainnet, sepolia } from 'wagmi/chains'
import { connectorsForWallets } from '@rainbow-me/rainbowkit'
import {
  injectedWallet,
  okxWallet,
  coinbaseWallet,
  walletConnectWallet,
  rabbyWallet,
  safepalWallet,
  bitgetWallet,
  bybitWallet,
  coin98Wallet,
  oneKeyWallet,
  braveWallet,
} from '@rainbow-me/rainbowkit/wallets'

const connectors = connectorsForWallets(
  [
    {
      groupName: '推荐',
      wallets: [
        injectedWallet,
        okxWallet,
        coinbaseWallet,
        walletConnectWallet,
      ],
    },
    {
      groupName: '其他钱包',
      wallets: [
        rabbyWallet,
        safepalWallet,
        bitgetWallet,
        bybitWallet,
        coin98Wallet,
        oneKeyWallet,
        braveWallet,
      ],
    },
  ],
  {
    projectId: '7305da927ec9c79f9c85ce56d9e0592f',
    appName: 'WiseScan',
  },
)

export const config = createConfig({
  chains: [mainnet, sepolia],
  connectors,
  transports: {
    [mainnet.id]: http(),
    [sepolia.id]: http(),
  },
  ssr: false,
})
