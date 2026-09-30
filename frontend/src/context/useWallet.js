import { useContext } from 'react'
import { WalletContext } from './wallet-context.js'

export function useWallet() {
  const context = useContext(WalletContext)
  if (!context) throw new Error('useWallet must be used within WalletProvider')
  return context
}