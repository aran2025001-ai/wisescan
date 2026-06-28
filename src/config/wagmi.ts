import { createConfig, http } from 'wagmi'
import { mainnet, sepolia } from 'wagmi/chains'
import { connectorsForWallets } from '@rainbow-me/rainbowkit'
import {
  injectedWallet,
  coinbaseWallet,
  walletConnectWallet,
} from '@rainbow-me/rainbowkit/wallets'

const connectors = connectorsForWallets(
  [
    {
      groupName: '连接钱包',
      wallets: [injectedWallet, coinbaseWallet, walletConnectWallet],
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
