import { createRoot } from 'react-dom/client'
import { ThemeProvider } from 'next-themes'
import { Providers } from './components/Providers'
import App from './App.tsx'
import '@rainbow-me/rainbowkit/styles.css'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
    <Providers>
      <App />
    </Providers>
  </ThemeProvider>,
)
