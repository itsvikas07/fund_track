import { useEffect, useState } from 'react'
import { JsonRpcProvider } from 'ethers'
import { WalletContext } from './wallet-context.js'

export function WalletProvider({ children }) {
  const [address, setAddress] = useState('')
  const [chainId, setChainId] = useState(null)
  const [expectedChainId, setExpectedChainId] = useState(31337)
  const [isConnecting, setIsConnecting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    const rpcUrl = import.meta.env.VITE_BLOCKCHAIN_RPC_URL || 'http://127.0.0.1:8545'
    const rpcProvider = new JsonRpcProvider(rpcUrl)
    rpcProvider.getNetwork().then((network) => {
      if (active) setExpectedChainId(Number(network.chainId))
    }).catch(() => {
      if (active) setExpectedChainId(31337)
    })

    const ethereum = window.ethereum
    if (ethereum) {
      ethereum.request({ method: 'eth_accounts' }).then((accounts) => {
        if (!active) return
        if (accounts && accounts.length > 0) {
          setAddress(accounts[0])
          ethereum.request({ method: 'eth_chainId' }).then((id) => {
            if (active && id) setChainId(parseInt(id, 16))
          }).catch(() => {})
        }
      }).catch(() => {})

      const onAccountsChanged = (accounts) => {
        if (!active) return
        const newAddress = accounts && accounts.length > 0 ? accounts[0] : ''
        setAddress(newAddress)
        if (newAddress) {
          ethereum.request({ method: 'eth_chainId' }).then((id) => {
            if (active && id) setChainId(parseInt(id, 16))
          }).catch(() => {})
        }
      }

      const onChainChanged = (id) => {
        if (!active) return
        if (id) setChainId(parseInt(id, 16))
        ethereum.request({ method: 'eth_accounts' }).then((accounts) => {
          if (!active) return
          if (accounts && accounts.length > 0) setAddress(accounts[0])
          else setAddress('')
        }).catch(() => {})
      }

      ethereum.on?.('accountsChanged', onAccountsChanged)
      ethereum.on?.('chainChanged', onChainChanged)

      return () => {
        active = false
        ethereum.removeListener?.('accountsChanged', onAccountsChanged)
        ethereum.removeListener?.('chainChanged', onChainChanged)
        rpcProvider.destroy()
      }
    }

    return () => {
      active = false
      rpcProvider.destroy()
    }
  }, [])

  async function switchNetwork() {
    if (!window.ethereum) return
    const hardhatHexChainId = '0x7a69' // 31337
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: hardhatHexChainId }],
      })
    } catch (switchError) {
      if (switchError.code === 4902 || switchError?.data?.originalError?.code === 4902) {
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [
              {
                chainId: hardhatHexChainId,
                chainName: 'Hardhat Local',
                rpcUrls: [import.meta.env.VITE_BLOCKCHAIN_RPC_URL || 'http://127.0.0.1:8545'],
                nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
              },
            ],
          })
        } catch (addError) {
          console.error('Could not add Hardhat network to MetaMask:', addError)
        }
      }
    }
  }

  async function connect() {
    setError('')
    if (!window.ethereum) {
      setError('MetaMask was not detected. Install the MetaMask browser extension to connect a wallet.')
      return
    }
    setIsConnecting(true)
    try {
      const ethereum = window.ethereum
      const accounts = await ethereum.request({ method: 'eth_requestAccounts' })
      let hexChainId = await ethereum.request({ method: 'eth_chainId' })
      let currentChainId = parseInt(hexChainId, 16)

      if (currentChainId !== 31337) {
        try {
          await ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: '0x7a69' }],
          })
          hexChainId = await ethereum.request({ method: 'eth_chainId' })
          currentChainId = parseInt(hexChainId, 16)
        } catch (switchErr) {
          if (switchErr.code === 4902 || switchErr?.data?.originalError?.code === 4902) {
            try {
              await ethereum.request({
                method: 'wallet_addEthereumChain',
                params: [
                  {
                    chainId: '0x7a69',
                    chainName: 'Hardhat Local',
                    rpcUrls: [import.meta.env.VITE_BLOCKCHAIN_RPC_URL || 'http://127.0.0.1:8545'],
                    nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
                  },
                ],
              })
              hexChainId = await ethereum.request({ method: 'eth_chainId' })
              currentChainId = parseInt(hexChainId, 16)
            } catch (addErr) {
              // User declined
            }
          }
        }
      }

      const updatedAccounts = await ethereum.request({ method: 'eth_accounts' })
      const activeAddress = updatedAccounts && updatedAccounts.length > 0 ? updatedAccounts[0] : (accounts[0] || '')

      setAddress(activeAddress)
      setChainId(currentChainId)
    } catch (connectError) {
      setError(connectError.code === 4001 ? 'Wallet connection was declined.' : 'Could not connect to MetaMask.')
    } finally {
      setIsConnecting(false)
    }
  }

  function disconnect() {
    setAddress('')
    setChainId(null)
  }

  const isCorrectNetwork = Boolean(chainId && (chainId === 31337 || (expectedChainId && chainId === expectedChainId)))

  return (
    <WalletContext.Provider
      value={{
        address,
        chainId,
        expectedChainId,
        isConnecting,
        error,
        connect,
        disconnect,
        switchNetwork,
        isCorrectNetwork,
      }}
    >
      {children}
    </WalletContext.Provider>
  )
}


