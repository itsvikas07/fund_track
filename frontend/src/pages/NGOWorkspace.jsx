import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { api, getFriendlyError } from '../services/api.js'

const money = (value) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(value || 0))
const today = () => new Date().toISOString().slice(0, 10)

function Hash({ value }) {
  return value ? <code title={value}>{`${value.slice(0, 10)}...${value.slice(-8)}`}</code> : <span className="muted">Pending</span>
}

export default function NGOWorkspace() {
  const location = useLocation()
  const page = location.pathname.split('/')[2] || 'overview'
  const [profile, setProfile] = useState(null)
  const [balance, setBalance] = useState(null)
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [form, setForm] = useState({ amount: '', category: 'PROGRAM', description: '', record_date: today(), document_hash: '' })

  async function load() {
    try {
      const [profileResponse, balanceResponse, transactionResponse] = await Promise.all([
        api.get('/ngo/profile/'),
        api.get('/ngo/balance/'),
        api.get('/ngo/transactions/'),
      ])
      setProfile(profileResponse.data.profile)
      setBalance(balanceResponse.data.balance)
      setTransactions(transactionResponse.data.transactions)
    } catch (requestError) {
      setError(getFriendlyError(requestError, 'Unable to load this NGO account.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let active = true
    Promise.all([api.get('/ngo/profile/'), api.get('/ngo/balance/'), api.get('/ngo/transactions/')]).then(([profileResponse, balanceResponse, transactionResponse]) => {
      if (!active) return
      setProfile(profileResponse.data.profile)
      setBalance(balanceResponse.data.balance)
      setTransactions(transactionResponse.data.transactions)
    }).catch((requestError) => { if (active) setError(getFriendlyError(requestError, 'Unable to load this NGO account.')) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [location.pathname])

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    setSuccess('')
    try {
      const endpoint = page === 'funds' ? '/ngo/funds/' : '/ngo/expenses/'
      const response = await api.post(endpoint, {
        ...form,
        amount: Number(form.amount),
      })
      setSuccess(`Confirmed in block ${response.data.block_number}. Transaction hash: ${response.data.transaction_hash}`)
      setForm({ amount: '', category: 'PROGRAM', description: '', record_date: today(), document_hash: '' })
      await load()
    } catch (requestError) {
      setError(getFriendlyError(requestError, 'The NGO transaction could not be completed.'))
    } finally {
      setBusy(false)
    }
  }

  const titles = {
    overview: 'NGO overview',
    funds: 'Record funds received',
    expenses: 'Record an NGO expense',
    transactions: 'NGO transaction history',
    reports: 'NGO financial summary',
  }

  if (loading) return <div className="state-message">Loading NGO records</div>
  if (error && !profile) return <div className="state-message state-error" role="alert">{error}</div>

  const isForm = page === 'funds' || page === 'expenses'
  const shownTransactions = page === 'transactions' ? transactions : transactions.slice(0, 6)
  return <>
    <div className="page-title-row">
      <div><span className="eyebrow">NGO FINANCIAL RECORDS</span><h1>{titles[page] || titles.overview}</h1><p>{profile?.ngo_name} · Registration {profile?.registration_number || 'not provided'}</p></div>
    </div>
    {error && <div className="alert alert-error" role="alert">{error}</div>}
    {success && <div className="alert alert-success" role="status">{success}</div>}
    {!isForm && <div className="stat-grid dashboard-stats">
      <article className="stat-card"><div className="stat-label">Total funds received</div><strong className="stat-value">{money(balance?.total_funds_received)}</strong><span className="stat-note">Confirmed on-chain receipts</span></article>
      <article className="stat-card"><div className="stat-label">Total expenses</div><strong className="stat-value">{money(balance?.total_spent)}</strong><span className="stat-note">Confirmed on-chain expenses</span></article>
      <article className="stat-card"><div className="stat-label">Remaining balance</div><strong className="stat-value">{money(balance?.remaining_balance)}</strong><span className="stat-note">Received less confirmed expenses</span></article>
      <article className="stat-card"><div className="stat-label">Available to spend</div><strong className="stat-value">{money(balance?.available_balance)}</strong><span className="stat-note">Accounts for pending expenses</span></article>
    </div>}
    {isForm && <form className="form-panel" onSubmit={submit}>
      <label>Amount (INR)<input type="number" min="1" step="1" required value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} /></label>
      {page === 'expenses' && <label>Category<select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>{['PROGRAM', 'OPERATIONS', 'ADMINISTRATION', 'OTHER'].map((category) => <option key={category}>{category}</option>)}</select></label>}
      <label>Record date<input type="date" required value={form.record_date} onChange={(event) => setForm({ ...form, record_date: event.target.value })} /></label>
      <label>Description<input required maxLength={1000} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label>
      <label>Document hash or reference <span className="muted">Optional</span><input maxLength={255} value={form.document_hash} onChange={(event) => setForm({ ...form, document_hash: event.target.value })} /></label>
      <div className="form-footer"><span>Signed by the configured server-side NGO operator</span><button className="button button-primary" disabled={busy}>{busy ? 'Submitting…' : 'Submit transaction'}</button></div>
    </form>}
    {!isForm && <section className="panel content-section">
      <div className="panel-heading"><div><span className="eyebrow">CONFIRMED AND PENDING RECORDS</span><h2>{page === 'transactions' ? 'All transactions' : 'Recent transactions'}</h2></div></div>
      {shownTransactions.length ? <div className="table-wrap"><table><thead><tr><th>Date</th><th>Type</th><th>Category</th><th>Amount</th><th>Recorded by</th><th>Block</th><th>Transaction hash</th><th>Status</th></tr></thead><tbody>{shownTransactions.map((tx) => <tr key={tx.record_id}><td>{tx.record_date}</td><td>{tx.transaction_type.replace('_', ' ')}</td><td>{tx.category}</td><td>{money(tx.amount)}</td><td><code>{tx.wallet_address || tx.recorded_by || '—'}</code></td><td>{tx.block_number ?? '—'}</td><td><Hash value={tx.transaction_hash} /></td><td><span className={`status-badge status-${String(tx.status).toLowerCase()}`}><i />{tx.status}</span></td></tr>)}</tbody></table></div> : <div className="empty-state"><strong>No NGO transactions recorded</strong><span>Confirmed funds and expenses will appear here.</span></div>}
    </section>}
  </>
}