import { createConfig, http } from 'wagmi'
import { mainnet, sepolia } from 'wagmi/chains'
import { connectorsForWallets } from '@rainbow-me/rainbowkit'
import {
  injectedWallet,
  okxWallet,
  coinbaseWallet,
  walletConnectWallet,
  tokenPocketWallet,
  imTokenWallet,
  trustWallet,
  rainbowWallet,
  phantomWallet,
  zerionWallet,
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
        tokenPocketWallet,
        imTokenWallet,
        trustWallet,
        okxWallet,
        coinbaseWallet,
        walletConnectWallet,
      ],
    },
    {
      groupName: '更多钱包',
      wallets: [
        rainbowWallet,
        phantomWallet,
        zerionWallet,
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
    projectId: '71e2c66ca016811b34cdcc6f245a28d9',
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
