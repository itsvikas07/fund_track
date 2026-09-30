import { useEffect, useState } from 'react'
import { api, getFriendlyError } from '../services/api.js'

const today = () => new Date().toISOString().slice(0, 10)
const money = (value) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(value || 0))

export default function BudgetAllocationPage() {
  const [projects, setProjects] = useState([])
  const [form, setForm] = useState({ project_id: '', amount: '', allocation_date: today(), description: '' })
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)

  useEffect(() => {
    let active = true
    api.get('/projects/').then((response) => { if (active) setProjects(response.data.projects) }).catch((requestError) => { if (active) setError(getFriendlyError(requestError, 'Unable to load projects.')) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    setResult(null)
    try {
      const response = await api.post(`/projects/${encodeURIComponent(form.project_id)}/budget/`, { ...form, amount: Number(form.amount) })
      setResult(response.data)
      const projectsResponse = await api.get('/projects/')
      setProjects(projectsResponse.data.projects)
    } catch (requestError) {
      setError(getFriendlyError(requestError, 'Budget allocation could not be completed.'))
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <div className="state-message">Loading project budgets</div>
  return <>
    <div className="page-title-row"><div><span className="eyebrow">GOVERNMENT / BUDGETS</span><h1>Allocate project budget</h1><p>Additional allocation is recorded on chain and in the budget ledger.</p></div></div>
    {error && <div className="alert alert-error" role="alert">{error}</div>}
    {result && <div className="notice notice-success"><div><strong>Allocation confirmed · {money(result.amount)}</strong><span>Block {result.block_number} · {result.transaction_hash}</span></div></div>}
    <form className="form-panel" onSubmit={submit}>
      <label>Project<select required value={form.project_id} onChange={(event) => setForm({ ...form, project_id: event.target.value })}><option value="">Choose a project</option>{projects.map((project) => <option key={project.project_id} value={project.project_id}>{project.project_id} · {project.name} · {money(project.budget)}</option>)}</select></label>
      <label>Additional amount (INR)<input type="number" min="1" step="1" required value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} /></label>
      <label>Allocation date<input type="date" required value={form.allocation_date} onChange={(event) => setForm({ ...form, allocation_date: event.target.value })} /></label>
      <label>Description<input maxLength={1000} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label>
      <div className="form-footer"><span>Requires ADMIN or GOVERNMENT_OFFICIAL authorization.</span><button className="button button-primary" disabled={busy || !projects.length}>{busy ? 'Submitting…' : 'Allocate budget'}</button></div>
    </form>
  </>
}