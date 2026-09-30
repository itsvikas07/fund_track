import { Contract, JsonRpcProvider } from 'ethers'
import artifact from '../../../blockchain/artifacts/contracts/FundTransparency.sol/FundTransparency.json'

const rpcUrl = import.meta.env.VITE_BLOCKCHAIN_RPC_URL || 'http://127.0.0.1:8545'
const contractAddress = import.meta.env.VITE_CONTRACT_ADDRESS || '0x5FbDB2315678afecb367f032d93F642f64180aa3'
let provider
let contract

function readContract() {
  if (!provider) provider = new JsonRpcProvider(rpcUrl)
  if (!contract) contract = new Contract(contractAddress, artifact.abi, provider)
  return contract
}

const asNumber = (value) => Number(value)

async function expenseEventMap(instance) {
  const logs = await instance.queryFilter(instance.filters.ExpenseRecorded(), 0, 'latest')
  return new Map(logs.map((log) => [asNumber(log.args.transactionId), log]))
}

function formatDate(timestamp) {
  return timestamp ? new Date(asNumber(timestamp) * 1000).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : ''
}

async function hydrateTransaction(instance, id, eventLog) {
  const record = await instance.getTransaction(id)
  return {
    id: asNumber(record.id ?? record[0]),
    projectId: record.entityId ?? record[1],
    type: record.transactionType ?? record[2],
    amount: asNumber(record.amount ?? record[3]),
    category: record.category ?? record[4],
    description: record.description ?? record[5],
    timestamp: asNumber(record.timestamp ?? record[6]),
    date: formatDate(record.timestamp ?? record[6]),
    wallet: record.recordedBy ?? record[8],
    hash: eventLog?.transactionHash || '',
    blockNumber: eventLog?.blockNumber ?? null,
    status: 'CONFIRMED',
  }
}

export async function listChainProjects() {
  const instance = readContract()
  const events = await instance.queryFilter(instance.filters.ProjectCreated(), 0, 'latest')
  const ids = [...new Set(events.map((event) => event.args.projectId))]
  const rows = await Promise.all(ids.map(async (projectId) => {
    const project = await instance.getProject(projectId)
    if (!(project.exists ?? project[4])) return null
    const budget = asNumber(project.allocatedBudget ?? project[2])
    const spent = asNumber(project.spentAmount ?? project[3])
    return { projectId: project.projectId ?? project[0], name: project.name ?? project[1], budget, spent, remaining: budget - spent }
  }))
  return rows.filter(Boolean).reverse()
}

export async function getProjectDetails(projectId) {
  const instance = readContract()
  const project = await instance.getProject(projectId)
  if (!(project.exists ?? project[4])) return null
  const ids = await instance.getProjectTransactions(projectId)
  const events = await expenseEventMap(instance)
  const transactions = await Promise.all(ids.map((id) => hydrateTransaction(instance, asNumber(id), events.get(asNumber(id)))))
  const budget = asNumber(project.allocatedBudget ?? project[2])
  const spent = asNumber(project.spentAmount ?? project[3])
  return { projectId: project.projectId ?? project[0], name: project.name ?? project[1], budget, spent, remaining: budget - spent, transactions: transactions.reverse() }
}

export async function getTransactionHistory() {
  const instance = readContract()
  const count = asNumber(await instance.getTransactionCount())
  const events = await expenseEventMap(instance)
  const start = Math.max(0, count - 100)
  const rows = await Promise.all(Array.from({ length: count - start }, (_, index) => hydrateTransaction(instance, start + index, events.get(start + index))))
  return rows.reverse()
}

export async function getWalletRole(address, role) {
  const instance = readContract()
  return instance.hasRole(await instance[`${role}_ROLE`](), address)
}

export async function getNetworkInfo() {
  const instance = readContract()
  const network = await instance.runner.provider.getNetwork()
  return { chainId: Number(network.chainId), contractAddress }
}