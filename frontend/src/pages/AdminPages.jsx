import { useEffect, useState } from 'react'
import { api, getFriendlyError } from '../services/api.js'

const roles = ['PUBLIC_USER', 'NGO_OFFICIAL', 'GOVERNMENT_OFFICIAL', 'AUDITOR', 'ADMIN']

export function AdminUsersPage() {
  const [users, setUsers] = useState([])
  const [ngos, setNgos] = useState([])
  const [changes, setChanges] = useState({})
  const [ngoForm, setNgoForm] = useState({ ngo_name: '', registration_number: '', contact_email: '', address: '' })
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  async function load() {
    try {
      const [userResponse, ngoResponse] = await Promise.all([api.get('/admin/users/'), api.get('/admin/ngos/')])
      setUsers(userResponse.data.users)
      setNgos(ngoResponse.data.ngos)
      setChanges(Object.fromEntries(userResponse.data.users.map((user) => [user.id, { role: user.role, ngo_id: user.ngo_id || '' }])))
      setError('')
    } catch (requestError) {
      setError(getFriendlyError(requestError, 'Unable to load administration records.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let active = true
    Promise.all([api.get('/admin/users/'), api.get('/admin/ngos/')]).then(([userResponse, ngoResponse]) => {
      if (!active) return
      setUsers(userResponse.data.users)
      setNgos(ngoResponse.data.ngos)
      setChanges(Object.fromEntries(userResponse.data.users.map((user) => [user.id, { role: user.role, ngo_id: user.ngo_id || '' }])))
    }).catch((requestError) => { if (active) setError(getFriendlyError(requestError, 'Unable to load administration records.')) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  async function saveRole(userId) {
    const change = changes[userId]
    setBusy(true)
    setError('')
    setMessage('')
    try {
      await api.patch(`/admin/users/${userId}/role/`, { role: change.role, ngo_id: change.role === 'NGO_OFFICIAL' ? Number(change.ngo_id) : null })
      setMessage('User role updated.')
      await load()
    } catch (requestError) {
      setError(getFriendlyError(requestError, 'Unable to update this user role.'))
    } finally {
      setBusy(false)
    }
  }

  async function createNgo(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    setMessage('')
    try {
      await api.post('/admin/ngos/', ngoForm)
      setNgoForm({ ngo_name: '', registration_number: '', contact_email: '', address: '' })
      setMessage('NGO profile created.')
      await load()
    } catch (requestError) {
      setError(getFriendlyError(requestError, 'Unable to create this NGO profile.'))
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <div className="state-message">Loading users and NGO profiles</div>
  return <>
    <div className="page-title-row"><div><span className="eyebrow">ADMINISTRATION</span><h1>Users and roles</h1><p>Assign restricted roles and associate NGO officials with an organization.</p></div></div>
    {error && <div className="alert alert-error" role="alert">{error}</div>}{message && <div className="alert alert-success" role="status">{message}</div>}
    <section className="panel content-section"><div className="panel-heading"><div><span className="eyebrow">ACCOUNT ACCESS</span><h2>Registered users</h2></div></div><div className="table-wrap"><table><thead><tr><th>User</th><th>Email</th><th>Wallet</th><th>Role</th><th>NGO</th><th /></tr></thead><tbody>{users.map((user) => <tr key={user.id}><td>{user.name}</td><td>{user.email}</td><td><code>{user.wallet_address || '—'}</code></td><td><select aria-label={`Role for ${user.email}`} value={changes[user.id]?.role || user.role} onChange={(event) => setChanges({ ...changes, [user.id]: { ...changes[user.id], role: event.target.value } })}>{roles.map((role) => <option key={role}>{role}</option>)}</select></td><td>{changes[user.id]?.role === 'NGO_OFFICIAL' ? <select aria-label={`NGO for ${user.email}`} value={changes[user.id]?.ngo_id || ''} onChange={(event) => setChanges({ ...changes, [user.id]: { ...changes[user.id], ngo_id: event.target.value } })}><option value="">Select NGO</option>{ngos.map((ngo) => <option key={ngo.id} value={ngo.id}>{ngo.ngo_name}</option>)}</select> : user.ngo_name || '—'}</td><td><button className="button button-outline button-small" disabled={busy || (changes[user.id]?.role === 'NGO_OFFICIAL' && !changes[user.id]?.ngo_id)} onClick={() => saveRole(user.id)}>Save</button></td></tr>)}</tbody></table>{!users.length && <div className="empty-state"><strong>No user accounts</strong></div>}</div></section>
    <section className="panel content-section"><div className="panel-heading"><div><span className="eyebrow">OWNERSHIP</span><h2>NGO profiles</h2></div></div><form className="form-panel" onSubmit={createNgo}><label>Organization name<input required maxLength={200} value={ngoForm.ngo_name} onChange={(event) => setNgoForm({ ...ngoForm, ngo_name: event.target.value })} /></label><label>Registration number<input maxLength={100} value={ngoForm.registration_number} onChange={(event) => setNgoForm({ ...ngoForm, registration_number: event.target.value })} /></label><label>Contact email<input type="email" maxLength={150} value={ngoForm.contact_email} onChange={(event) => setNgoForm({ ...ngoForm, contact_email: event.target.value })} /></label><label>Address<input value={ngoForm.address} onChange={(event) => setNgoForm({ ...ngoForm, address: event.target.value })} /></label><div className="form-footer"><span>{ngos.length} registered NGO profiles</span><button className="button button-primary" disabled={busy}>{busy ? 'Saving…' : 'Create NGO profile'}</button></div></form></section>
  </>
}

export function AdminSystemPage() {
  const [system, setSystem] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  useEffect(() => {
    api.get('/admin/system/').then((response) => setSystem(response.data)).catch((requestError) => setError(getFriendlyError(requestError, 'Unable to load system information.'))).finally(() => setLoading(false))
  }, [])
  if (loading) return <div className="state-message">Loading system information</div>
  if (error) return <div className="state-message state-error" role="alert">{error}</div>
  return <>
    <div className="page-title-row"><div><span className="eyebrow">ADMINISTRATION</span><h1>System information</h1><p>Live counts from MySQL and connectivity from the configured blockchain RPC.</p></div></div>
    <div className="stat-grid dashboard-stats">{Object.entries(system.counts).map(([label, value]) => <article className="stat-card" key={label}><div className="stat-label">{label}</div><strong className="stat-value">{value}</strong><span className="stat-note">Current MySQL records</span></article>)}</div>
    <div className={`notice ${system.blockchain_connected ? 'notice-success' : 'notice-neutral'}`}><span className="pulse-dot" />{system.blockchain_connected ? 'Blockchain RPC connected' : 'Blockchain RPC unavailable'}</div>
  </>
}