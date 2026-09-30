import { useEffect, useMemo, useState } from 'react'
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Activity, ArrowDownLeft, ArrowRight, ArrowUpRight, BadgeCheck, Blocks, BriefcaseBusiness, Check, ChevronDown, CircleAlert, Copy, FileChartColumn, Fingerprint, FolderKanban, Landmark, LayoutDashboard, LoaderCircle, LockKeyhole, LogOut, Menu, Plus, Search, ShieldCheck, Wallet, X } from 'lucide-react'
import { AuthProvider } from './context/AuthContext.jsx'
import { useAuth } from './context/useAuth.js'
import { WalletProvider } from './context/WalletContext.jsx'
import { useWallet } from './context/useWallet.js'
import { api, getFriendlyError } from './services/api.js'
import { getProjectDetails, getTransactionHistory, getWalletRole, listChainProjects } from './services/blockchain.js'
import { AdminSystemPage, AdminUsersPage } from './pages/AdminPages.jsx'
import BudgetAllocationPage from './pages/BudgetAllocationPage.jsx'
import NGOWorkspace from './pages/NGOWorkspace.jsx'
import './fund.css'

const rolePaths = { ADMIN: '/admin', NGO_OFFICIAL: '/ngo', GOVERNMENT_OFFICIAL: '/government', AUDITOR: '/auditor', PUBLIC_USER: '/public' }
const roleLabels = { ADMIN: 'Administrator', NGO_OFFICIAL: 'NGO official', GOVERNMENT_OFFICIAL: 'Government official', AUDITOR: 'Auditor', PUBLIC_USER: 'Public user' }
const formatINR = (value) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(value || 0))
const shortHash = (hash = '') => hash ? `${hash.slice(0, 8)}...${hash.slice(-6)}` : 'Not available'
const mapProject = (project) => ({ projectId: project.project_id, name: project.name, budget: Number(project.budget), spent: Number(project.spent || 0), remaining: Number(project.remaining ?? Number(project.budget) - Number(project.spent || 0)), categories: project.categories || {}, description: project.description || '', startDate: project.start_date, endDate: project.end_date })
const mapTransaction = (transaction) => ({ id: transaction.mysql_transaction_id ?? transaction.record_id ?? transaction.id, projectId: transaction.project_id, type: transaction.transaction_type || transaction.type || (transaction.project_id ? 'PROJECT_EXPENSE' : ''), amount: Number(transaction.amount || 0), category: transaction.category || transaction.ngo_category || '', description: transaction.description || '', date: transaction.expense_date || transaction.record_date || transaction.created_at || '', wallet: transaction.wallet_address || '', hash: transaction.transaction_hash || transaction.tx_hash || '', blockNumber: transaction.block_number, status: transaction.status || transaction.chain_status || 'CONFIRMED', mysqlTransactionId: transaction.mysql_transaction_id ?? transaction.id })

function Brand() {
  return <Link className="brand" to="/public"><span className="brand-mark"><Landmark size={20} /></span><span><strong>Fund</strong><br />Transparency</span></Link>
}

function LoadingState({ label = 'Loading records' }) {
  return <div className="state-message"><LoaderCircle className="spin" size={19} />{label}</div>
}

function ErrorState({ message, onRetry }) {
  return <div className="state-message state-error"><CircleAlert size={19} /><span>{message}</span>{onRetry && <button className="text-button" onClick={onRetry}>Retry</button>}</div>
}

function EmptyState({ title, detail }) {
  return <div className="empty-state"><FolderKanban size={22} /><strong>{title}</strong><span>{detail}</span></div>
}

function ProtectedRoute({ allowedRoles, children }) {
  const { user, isAuthenticated } = useAuth()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (allowedRoles && !allowedRoles.includes(user?.role)) return <Navigate to="/access-denied" replace />
  return children
}

function WalletButton() {
  const { address, chainId, expectedChainId, connect, disconnect, switchNetwork, error, isConnecting } = useWallet()
  const [showError, setShowError] = useState(false)
  const isHardhat = chainId === 31337 || (expectedChainId && chainId === expectedChainId)
  const networkLabel = isHardhat ? 'Hardhat local' : chainId ? `Chain ${chainId}` : 'Network unknown'
  return (
    <div className="wallet-control">
      {address ? (
        <button
          className={`wallet-pill ${!isHardhat ? 'wallet-warning' : ''}`}
          onClick={!isHardhat ? switchNetwork : disconnect}
          title={!isHardhat ? 'Click to switch to Hardhat Local network (31337)' : `Disconnect wallet · ${networkLabel}`}
        >
          <span className="wallet-dot" />
          <span>{shortHash(address)}</span>
          <span>{networkLabel}</span>
          <ChevronDown size={14} />
        </button>
      ) : (
        <button
          className="button button-outline button-small"
          onClick={async () => { setShowError(true); await connect() }}
          disabled={isConnecting}
        >
          {isConnecting ? <LoaderCircle className="spin" size={15} /> : <Wallet size={15} />}
          Connect wallet
        </button>
      )}
      {address && !isHardhat && (
        <button
          className="network-warning"
          onClick={switchNetwork}
          style={{ background: 'none', border: 'none', padding: 0, textDecoration: 'underline', cursor: 'pointer' }}
        >
          Click to switch MetaMask to Hardhat Local (Chain 31337).
        </button>
      )}
      {showError && error && <span className="wallet-error" role="status">{error}</span>}
    </div>
  )
}

function AppHeader({ publicView = false }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  return <header className="topbar"><Brand />{publicView && <nav className="public-nav"><Link to="/public">Transparency</Link><a href="#method">Verification</a></nav>}<div className="topbar-actions"><WalletButton />{user ? <div className="user-menu-wrap"><button className="user-menu" onClick={() => setMenuOpen(!menuOpen)} aria-expanded={menuOpen}><span className="avatar">{(user.name || user.email || 'U').slice(0, 1).toUpperCase()}</span><span className="user-copy"><strong>{user.name || user.email}</strong><small>{roleLabels[user.role] || user.role}</small></span><ChevronDown size={15} /></button>{menuOpen && <div className="user-popover"><button onClick={() => { logout(); navigate('/login') }}><LogOut size={15} />Sign out</button></div>}</div> : <Link className="button button-primary button-small" to="/login">Sign in <ArrowRight size={15} /></Link>}</div></header>
}

function DashboardLayout({ children, role }) {
  const { user, logout } = useAuth()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const navItems = useMemo(() => {
    const common = [{ label: 'Overview', path: rolePaths[role], icon: LayoutDashboard }]
    if (role === 'GOVERNMENT_OFFICIAL' || role === 'ADMIN') return [...common, { label: 'Projects', path: role === 'ADMIN' ? '/admin/projects' : '/government/projects', icon: FolderKanban }, { label: 'Transactions', path: role === 'ADMIN' ? '/admin/transactions' : '/government/expenses', icon: Activity }, ...(role === 'GOVERNMENT_OFFICIAL' ? [{ label: 'Budget allocation', path: '/government/expenses?mode=budget', icon: FileChartColumn }] : []), ...(role === 'ADMIN' ? [{ label: 'Users', path: '/admin/users', icon: BriefcaseBusiness }, { label: 'Reports', path: '/admin/reports', icon: FileChartColumn }] : [])]
    if (role === 'NGO_OFFICIAL') return [...common, { label: 'Funds', path: '/ngo/funds', icon: ArrowDownLeft }, { label: 'Expenses', path: '/ngo/expenses', icon: ArrowUpRight }, { label: 'Transactions', path: '/ngo/transactions', icon: Activity }, { label: 'Reports', path: '/ngo/reports', icon: FileChartColumn }]
    if (role === 'AUDITOR') return [...common, { label: 'Projects', path: '/auditor/projects', icon: FolderKanban }, { label: 'Transactions', path: '/auditor/transactions', icon: Activity }, { label: 'Audit trail', path: '/auditor/audit-trail', icon: Fingerprint }, { label: 'Reports', path: '/auditor/reports', icon: FileChartColumn }]
    return [...common, { label: 'Public projects', path: '/public', icon: Landmark }]
  }, [role])
  const isNavActive = (path) => {
    const [pathname, query] = path.split('?')
    return location.pathname === pathname && (query ? location.search === `?${query}` : !location.search)
  }
  const pageTitle = navItems.find((item) => isNavActive(item.path))?.label || 'Overview'
  return <div className="app-frame"><AppHeader /><button className="mobile-menu" aria-label="Open navigation" onClick={() => setSidebarOpen(!sidebarOpen)}>{sidebarOpen ? <X /> : <Menu />}</button><div className="dashboard-frame"><aside className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}><div className="side-section-label">WORKSPACE</div><nav className="side-nav" aria-label="Dashboard navigation">{navItems.map(({ label, path, icon: Icon }) => <Link key={path} to={path} onClick={() => setSidebarOpen(false)} className={isNavActive(path) ? 'active' : ''}><Icon size={17} /><span>{label}</span>{isNavActive(path) && <i className="active-marker" />}</Link>)}</nav><div className="sidebar-bottom"><div className="role-box"><span className="role-icon"><ShieldCheck size={16} /></span><div><small>Signed in as</small><strong>{roleLabels[role] || role}</strong></div></div><button className="side-logout" onClick={() => { logout(); window.location.assign('/login') }}><LogOut size={16} />Sign out</button></div></aside><main className="workspace"><div className="workspace-heading"><div className="breadcrumb">Workspace <span>/</span> {pageTitle}</div><div className="heading-mobile-user">{user?.name}</div></div>{children}</main></div></div>
}

function AuthPage({ mode = 'login' }) {
  const isLogin = mode === 'login'
  const { login } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const update = (event) => setForm({ ...form, [event.target.name]: event.target.value })
  async function submit(event) {
    event.preventDefault(); setError(''); setSuccess('')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return setError('Enter a valid email address.')
    if (form.password.length < 8) return setError('Password must be at least 8 characters.')
    if (!isLogin && (form.password !== form.confirmPassword || !form.name.trim())) return setError(form.password !== form.confirmPassword ? 'Passwords do not match.' : 'Enter your name.')
    setBusy(true)
    try {
      if (isLogin) {
        const response = await api.post('/auth/login/', { email: form.email, password: form.password })
        login(response.data); navigate(rolePaths[response.data.user.role] || '/public', { replace: true })
      } else {
        await api.post('/auth/register/', { name: form.name.trim(), email: form.email, password: form.password })
        setSuccess('Account created. You can now sign in.'); window.setTimeout(() => navigate('/login'), 900)
      }
    } catch (requestError) { setError(getFriendlyError(requestError)) } finally { setBusy(false) }
  }
  return <div className="auth-page"><div className="auth-top"><Brand /><Link to="/public" className="back-public">View public records <ArrowRight size={15} /></Link></div><div className="auth-grid"><section className="auth-intro"><span className="eyebrow"><i className="eyebrow-dot" />PUBLIC FINANCE, ACCOUNTABLE BY DESIGN</span><h1>Every rupee.<br /><em>On the record.</em></h1><p>A shared view of public project funding, spending, and blockchain verification.</p><div className="auth-proof"><span><ShieldCheck size={17} />Role-based access</span><span><Blocks size={17} />On-chain records</span></div><div className="auth-index"><span>01 / ACCOUNTABILITY</span><span>02 / TRACEABILITY</span><span>03 / TRUST</span></div></section><section className="auth-panel"><div className="form-heading"><span className="form-kicker">{isLogin ? 'SECURE ACCESS' : 'GET STARTED'}</span><h2>{isLogin ? 'Welcome back' : 'Create your account'}</h2><p>{isLogin ? 'Sign in to your transparency workspace.' : 'Your account starts with public access.'}</p></div>{error && <div className="alert alert-error" role="alert"><CircleAlert size={17} />{error}</div>}{success && <div className="alert alert-success" role="status"><Check size={17} />{success}</div>}<form className="auth-form" onSubmit={submit}>{!isLogin && <label>Full name<input name="name" autoComplete="name" value={form.name} onChange={update} required maxLength={100} placeholder="Your name" /></label>}<label>Email address<input name="email" type="email" autoComplete="email" value={form.email} onChange={update} required placeholder="name@example.com" /></label><label>Password<span className="password-input"><input name="password" type={showPassword ? 'text' : 'password'} autoComplete={isLogin ? 'current-password' : 'new-password'} value={form.password} onChange={update} required minLength={8} placeholder="At least 8 characters" /><button type="button" className="reveal-password" onClick={() => setShowPassword(!showPassword)}>{showPassword ? 'Hide' : 'Show'}</button></span></label>{!isLogin && <label>Confirm password<input name="confirmPassword" type="password" autoComplete="new-password" value={form.confirmPassword} onChange={update} required placeholder="Enter password again" /></label>}{!isLogin && <div className="role-note"><LockKeyhole size={16} /><span>New accounts are registered as <strong>Public Users</strong>. Authorized administrators can assign official roles.</span></div>}<button className="button button-primary auth-submit" type="submit" disabled={busy}>{busy ? <><LoaderCircle className="spin" size={17} />{isLogin ? 'Signing in...' : 'Creating account...'}</> : <>{isLogin ? 'Sign in' : 'Create account'}<ArrowRight size={16} /></>}</button></form><div className="auth-switch">{isLogin ? 'New to Fund Transparency?' : 'Already have an account?'} <Link to={isLogin ? '/register' : '/login'}>{isLogin ? 'Create account' : 'Sign in'}</Link></div><div className="auth-foot"><LockKeyhole size={13} />Credentials are transmitted through the configured API connection.</div></section></div></div>
}

function StatCard({ label, value, note, icon: Icon, tone = 'blue' }) {
  return <article className="stat-card"><div className={`stat-icon stat-${tone}`}><Icon size={18} /></div><div className="stat-label">{label}</div><strong className="stat-value">{value}</strong><span className="stat-note">{note}</span></article>
}

function HashText({ hash }) {
  const [copied, setCopied] = useState(false)
  if (!hash) return <span className="muted">No hash</span>
  return <span className="hash-cell"><code title={hash}>{shortHash(hash)}</code><button aria-label="Copy transaction hash" title="Copy hash" onClick={async () => { await navigator.clipboard.writeText(hash); setCopied(true); window.setTimeout(() => setCopied(false), 1200) }}>{copied ? <Check size={13} /> : <Copy size={13} />}</button></span>
}

function StatusBadge({ children = 'CONFIRMED' }) {
  const kind = String(children).toLowerCase()
  return <span className={`status-badge status-${kind}`}><i />{children}</span>
}

function ProjectTable({ projects, showActions = false, basePath = '/public/projects' }) {
  const [statusFilter, setStatusFilter] = useState('ALL')
  if (!projects.length) return <EmptyState title="No projects found" detail="Projects appear after they are recorded in the public register." />
  const statusOf = (project) => project.remaining <= 0 ? 'COMPLETED' : project.spent > 0 ? 'ACTIVE' : 'PLANNED'
  const filteredProjects = projects.filter((project) => statusFilter === 'ALL' || statusOf(project) === statusFilter)
  return <><label className="table-filter">Status<select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="ALL">All statuses</option><option value="PLANNED">Planned</option><option value="ACTIVE">Active</option><option value="COMPLETED">Completed</option></select></label><div className="table-wrap"><table><thead><tr><th>Project</th><th>Status</th><th>Allocated</th><th>Spent</th><th>Remaining</th><th>Progress</th><th /></tr></thead><tbody>{filteredProjects.map((project) => { const percent = project.budget ? Math.min(100, Math.round(project.spent / project.budget * 100)) : 0; return <tr key={project.projectId}><td><Link className="project-link" to={`${basePath}/${encodeURIComponent(project.projectId)}`}><strong>{project.name}</strong><small>{project.projectId}</small></Link></td><td><StatusBadge>{statusOf(project)}</StatusBadge></td><td>{formatINR(project.budget)}</td><td>{formatINR(project.spent)}</td><td className="remaining-cell">{formatINR(project.remaining)}</td><td><span className="progress-copy">{percent}%</span><div className="progress-track"><i style={{ width: `${percent}%` }} /></div></td><td>{showActions && <Link className="icon-link" aria-label={`View ${project.name}`} to={`${basePath}/${encodeURIComponent(project.projectId)}`}><ArrowRight size={17} /></Link>}</td></tr> })}</tbody></table>{!filteredProjects.length && <EmptyState title="No projects match this status" detail="Choose another status to view project records." />}</div></>
}

function TransactionTable({ transactions }) {
  const expenseTransactions = transactions.filter((transaction) => ['EXPENSE', 'PROJECT_EXPENSE', 'NGO_EXPENSE'].includes(transaction.type))
  const categories = expenseTransactions.reduce((totals, transaction) => {
    const category = String(transaction.category || 'OTHER').toUpperCase()
    const key = category === 'MATERIAL' ? 'MATERIAL' : ['LABOUR', 'EQUIPMENT', 'CONTRACTOR'].includes(category) ? category : 'OTHER'
    totals[key] += Number(transaction.amount || 0)
    return totals
  }, { LABOUR: 0, MATERIAL: 0, EQUIPMENT: 0, CONTRACTOR: 0, OTHER: 0 })
  return <>
    <div className="stat-grid category-breakdown">{Object.entries(categories).map(([category, amount]) => <article className="stat-card" key={category}><div className="stat-label">{category === 'MATERIAL' ? 'Materials' : category[0] + category.slice(1).toLowerCase()}</div><strong className="stat-value">{formatINR(amount)}</strong></article>)}</div>
    {transactions.length ? <div className="table-wrap"><table><thead><tr><th>Date</th><th>Project / NGO</th><th>Type / category</th><th>Description</th><th>Amount</th><th>Recorded by</th><th>Block</th><th>MySQL ref</th><th>Transaction hash</th><th>Status</th></tr></thead><tbody>{transactions.map((tx) => <tr key={`${tx.hash || tx.id}-${tx.id}`}><td>{tx.date || 'On chain'}</td><td>{tx.projectId ? <Link className="table-project-id" to={`/public/projects/${encodeURIComponent(tx.projectId)}`}>{tx.projectId}</Link> : 'NGO ledger'}</td><td><strong>{tx.type}</strong><small className="table-sub">{tx.category}</small></td><td>{tx.description || '—'}</td><td>{formatINR(tx.amount)}</td><td><code title={tx.wallet}>{shortHash(tx.wallet)}</code></td><td>{tx.blockNumber ?? '—'}</td><td>{tx.mysqlTransactionId ?? '—'}</td><td><HashText hash={tx.hash} /></td><td><StatusBadge>{tx.status || 'CONFIRMED'}</StatusBadge></td></tr>)}</tbody></table></div> : <EmptyState title="No transactions recorded" detail="Confirmed expenses will appear after they are written to the contract." />}
  </>
}

function useLedgerData(enabled = true, scope = 'role') {
  const { user } = useAuth()
  const [projects, setProjects] = useState([])
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(enabled)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let active = true
    if (!enabled) return () => { active = false }
    const privileged = scope !== 'public' && ['ADMIN', 'GOVERNMENT_OFFICIAL', 'AUDITOR'].includes(user?.role)
    const projectsEndpoint = privileged ? '/projects/' : '/public/projects/'
    const transactionsEndpoint = scope === 'public' ? '/public/transactions/' : user?.role === 'NGO_OFFICIAL' ? '/ngo/transactions/' : ['ADMIN', 'AUDITOR'].includes(user?.role) ? '/audit/transactions/' : '/public/transactions/'
    Promise.all([api.get(projectsEndpoint), api.get(transactionsEndpoint)]).then(([projectResponse, transactionResponse]) => {
      if (active) {
        setProjects(projectResponse.data.projects.map(mapProject))
        setTransactions(transactionResponse.data.transactions.map(mapTransaction))
      }
    }).catch((loadError) => { if (active) setError(getFriendlyError(loadError, 'Unable to load project and transaction records.')) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [attempt, enabled, scope, user?.role])
  return { projects, transactions, loading, error, reload: () => { setLoading(true); setError(''); setAttempt((value) => value + 1) } }
}

function PublicDashboard() {
  const { projects, transactions, loading, error, reload } = useLedgerData(true, 'public')
  const [query, setQuery] = useState('')
  const totals = projects.reduce((result, item) => ({ budget: result.budget + item.budget, spent: result.spent + item.spent }), { budget: 0, spent: 0 })
  const visibleProjects = projects.filter((project) => `${project.name} ${project.projectId}`.toLowerCase().includes(query.toLowerCase()))
  return <div className="public-page"><AppHeader publicView /><main><section className="public-hero"><div className="public-hero-copy"><span className="eyebrow"><i className="eyebrow-dot" />OPEN PUBLIC LEDGER</span><h1>Public money,<br /><em>public record.</em></h1><p>Follow government project allocations and spending, with records verified against the deployed Ethereum contract.</p><a className="button button-public" href="#projects">Explore projects <ArrowDownLeft size={16} /></a></div><div className="ledger-stamp"><div className="stamp-ring"><Fingerprint size={36} /><span>VERIFIABLE<br />ON CHAIN</span></div><div className="stamp-bottom">LOCAL HARDHAT NETWORK<br />LIVE READ ACCESS</div></div><div className="hero-foot"><span>TRANSPARENCY INDEX</span><span>ETHEREUM · HARDHAT</span><span>READ ONLY / PUBLIC</span></div></section><section className="public-content"><div className="section-heading"><div><span className="eyebrow">THE LEDGER AT A GLANCE</span><h2>Funds in focus</h2></div><div className="live-label"><i className="pulse-dot" />CONNECTED TO CONTRACT</div></div>{loading ? <LoadingState label="Reading the blockchain" /> : error ? <ErrorState message={error} onRetry={reload} /> : <><div className="stat-grid public-stats"><StatCard label="Projects" value={projects.length} note="Created on this network" icon={FolderKanban} /><StatCard label="Total allocation" value={formatINR(totals.budget)} note="Across listed projects" icon={ArrowDownLeft} tone="teal" /><StatCard label="Recorded spend" value={formatINR(totals.spent)} note="Confirmed contract records" icon={ArrowUpRight} tone="amber" /><StatCard label="Remaining" value={formatINR(totals.budget - totals.spent)} note="Allocation less recorded spend" icon={Landmark} tone="green" /></div><section id="projects" className="content-section"><div className="section-heading section-heading-tight"><div><span className="eyebrow">PROJECT REGISTER</span><h2>Government projects</h2></div><label className="search-field"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name or project ID" /></label></div><ProjectTable projects={visibleProjects} /></section><section className="content-section"><div className="section-heading section-heading-tight"><div><span className="eyebrow">LATEST CONTRACT ACTIVITY</span><h2>Recent transactions</h2></div><Link className="subtle-link" to="/login">Open workspace <ArrowRight size={15} /></Link></div><TransactionTable transactions={transactions.slice(0, 5)} /></section></>}<section id="method" className="verification-band"><div className="verification-symbol"><BadgeCheck size={23} /></div><div><span className="eyebrow">VERIFICATION METHOD</span><h3>Funds are publicly traceable.</h3><p>Values and expense details are read from FundTransparency. Official changes are submitted through Django and its backend signer.</p></div><div className="contract-tag"><span>CONTRACT</span><code>0x5FbD...80aa3</code></div></section><footer className="public-footer"><Brand /><span>Records depend on the configured Hardhat node and deployed contract.</span><span>FUND TRANSPARENCY · 2026</span></footer></section></main></div>
}

function DashboardHome({ role }) {
  const { projects, transactions, loading, error, reload } = useLedgerData(role !== 'NGO_OFFICIAL')
  const { user } = useAuth()
  if (role === 'NGO_OFFICIAL') return <NGOWorkspace />
  const total = projects.reduce((result, project) => ({ budget: result.budget + project.budget, spent: result.spent + project.spent }), { budget: 0, spent: 0 })
  const title = role === 'ADMIN' ? 'Administration' : role === 'GOVERNMENT_OFFICIAL' ? 'Government workspace' : role === 'NGO_OFFICIAL' ? 'NGO workspace' : role === 'AUDITOR' ? 'Audit overview' : 'Public account'
  const subtitle = role === 'NGO_OFFICIAL' ? 'Review public project activity and available on-chain records.' : role === 'AUDITOR' ? 'Inspect project and transaction records from the deployed contract.' : 'Monitor project allocations, recorded spending, and verified activity.'
  return <><div className="page-title-row"><div><span className="eyebrow">{roleLabels[role]?.toUpperCase()} WORKSPACE</span><h1>{title}</h1><p>{subtitle}</p></div><div className="welcome-mark"><span>GOOD DAY</span><strong>{user?.name || 'Account'}</strong></div></div>{role === 'ADMIN' && <div className="notice notice-neutral"><CircleAlert size={17} /><span>User, NGO, and department totals are not exposed by the current backend API and are not estimated.</span></div>}{role === 'NGO_OFFICIAL' && <div className="notice notice-neutral"><CircleAlert size={17} /><span>The current backend exposes no NGO funds, expenses, or transaction APIs. NGO-specific figures are unavailable.</span></div>}{role === 'GOVERNMENT_OFFICIAL' && <div className="notice notice-info"><ShieldCheck size={17} /><span>Official writes use Django. Your connected wallet is separate from the backend transaction signer.</span></div>}{loading ? <LoadingState label="Loading verified activity" /> : error ? <ErrorState message={error} onRetry={reload} /> : <><div className="stat-grid dashboard-stats"><StatCard label="Projects" value={projects.length} note="On-chain project records" icon={FolderKanban} /><StatCard label="Total allocation" value={formatINR(total.budget)} note="Across deployed projects" icon={ArrowDownLeft} tone="teal" /><StatCard label="Recorded expenditure" value={formatINR(total.spent)} note="Confirmed expenses" icon={ArrowUpRight} tone="amber" /><StatCard label="Transactions" value={transactions.length} note="On-chain records loaded" icon={Activity} tone="green" /></div><div className="dashboard-main-grid"><section className="panel panel-wide"><div className="panel-heading"><div><span className="eyebrow">ON-CHAIN REGISTER</span><h2>Project activity</h2></div>{role === 'GOVERNMENT_OFFICIAL' && <Link className="button button-primary button-small" to="/government/projects/create"><Plus size={15} />Create project</Link>}</div><ProjectTable projects={projects.slice(0, 6)} basePath={role === 'ADMIN' ? '/admin/projects' : role === 'AUDITOR' ? '/auditor/projects' : '/government/projects'} showActions /></section><section className="panel"><div className="panel-heading"><div><span className="eyebrow">LATEST</span><h2>Transactions</h2></div><Activity size={18} className="panel-icon" /></div>{transactions.length ? <div className="activity-list">{transactions.slice(0, 4).map((tx) => <div className="activity-row" key={`${tx.id}-${tx.hash}`}><span className="activity-marker"><ArrowUpRight size={14} /></span><div><strong>{tx.category || tx.type}</strong><span>{tx.projectId} · {formatINR(tx.amount)}</span><small>{tx.date || 'On chain'}</small></div><StatusBadge>{tx.status}</StatusBadge></div>)}</div> : <EmptyState title="No activity yet" detail="Contract transactions will appear here." />}</section></div></>}</>
}

export function CreateProjectPageBasic() {
  const [form, setForm] = useState({ project_id: '', name: '', budget: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  async function submit(event) {
    event.preventDefault(); setError(''); setBusy(true)
    try { const response = await api.post('/projects/', { ...form, budget: Number(form.budget) }); setResult(response.data) } catch (requestError) { setError(getFriendlyError(requestError)) } finally { setBusy(false) }
  }
  return <div className="form-page"><div className="page-title-row"><div><span className="eyebrow">GOVERNMENT / PROJECTS</span><h1>Create project</h1><p>Create the record in MySQL and the existing deployed contract.</p></div><Link className="button button-outline" to="/government/projects"><ArrowRight className="rotate-left" size={16} />Back to projects</Link></div>{result ? <section className="success-panel"><div className="success-mark"><Check size={22} /></div><span className="eyebrow">PROJECT CREATED</span><h2>{result.project_id}</h2><p>{result.message}</p><dl className="result-grid"><div><dt>MySQL record ID</dt><dd>{result.mysql_project_id}</dd></div><div><dt>Block number</dt><dd>{result.block_number}</dd></div><div className="result-hash"><dt>Transaction hash</dt><dd><HashText hash={result.transaction_hash} /></dd></div></dl><Link className="button button-primary" to={`/government/projects/${encodeURIComponent(result.project_id)}`}>View project <ArrowRight size={16} /></Link></section> : <form className="form-panel" onSubmit={submit}>{error && <div className="alert alert-error"><CircleAlert size={17} />{error}</div>}<div className="form-panel-heading"><span className="eyebrow">PROJECT DETAILS</span><p>The existing API accepts project ID, name, and budget. Description and dates are not currently stored.</p></div><label>Project ID<input required maxLength={100} value={form.project_id} onChange={(event) => setForm({ ...form, project_id: event.target.value.trim() })} placeholder="e.g. BRIDGE003" /></label><label>Project name<input required maxLength={255} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Project name" /></label><label>Approved budget (INR)<input required type="number" min="1" step="1" value={form.budget} onChange={(event) => setForm({ ...form, budget: event.target.value })} placeholder="3000000" /></label><div className="form-footer"><span><LockKeyhole size={14} />Requires ADMIN or GOVERNMENT_OFFICIAL access</span><button className="button button-primary" disabled={busy}>{busy ? <><LoaderCircle className="spin" size={16} />Creating project...</> : <>Create project <ArrowRight size={16} /></>}</button></div></form>}</div>
}

export function GovernmentExpensePageBasic() {
  const [projects, setProjects] = useState([])
  const [form, setForm] = useState({ project_id: '', category: 'LABOUR', amount: '', description: '', expense_date: new Date().toISOString().slice(0, 10) })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  useEffect(() => { let active = true; api.get('/projects/').then(({ data }) => { if (active) setProjects(data.projects.map(mapProject)) }).catch((requestError) => { if (active) setError(getFriendlyError(requestError, 'Unable to load the project register.')) }); return () => { active = false } }, [])
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError(''); setResult(null)
    try { const response = await api.post(`/projects/${encodeURIComponent(form.project_id)}/expenses/`, { category: form.category, amount: Number(form.amount), description: form.description, expense_date: form.expense_date }); setResult(response.data) } catch (requestError) { setError(getFriendlyError(requestError)) } finally { setBusy(false) }
  }
  return <div className="form-page"><div className="page-title-row"><div><span className="eyebrow">GOVERNMENT / TRANSACTIONS</span><h1>Record an expense</h1><p>Django records the expense on chain and stores the MySQL transaction.</p></div></div>{error && <div className="alert alert-error"><CircleAlert size={17} />{error}</div>}{result && <div className="notice notice-success"><BadgeCheck size={19} /><div><strong>Transaction confirmed</strong><span>Block {result.block_number} · {formatINR(result.amount)}</span><span>Wallet {shortHash(result.wallet_address)}</span><HashText hash={result.transaction_hash} /></div></div>}<form className="form-panel" onSubmit={submit}><label>Project<select required value={form.project_id} onChange={(event) => setForm({ ...form, project_id: event.target.value })}><option value="">Choose a project</option>{projects.map((project) => <option key={project.projectId} value={project.projectId}>{project.projectId} · {project.name}</option>)}</select></label><label>Category<select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>{['LABOUR', 'MATERIAL', 'CONTRACTOR', 'EQUIPMENT', 'OTHER'].map((category) => <option key={category}>{category}</option>)}</select></label><label>Amount (INR)<input type="number" min="1" step="1" required value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} placeholder="50000" /></label><label>Expense date<input type="date" required value={form.expense_date} onChange={(event) => setForm({ ...form, expense_date: event.target.value })} /></label><label className="field-full">Description<input required value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Purpose of this expense" /></label><div className="form-footer field-full"><span><Blocks size={15} />Backend signer submits the blockchain transaction</span><button className="button button-primary" disabled={busy || !projects.length}>{busy ? <><LoaderCircle className="spin" size={16} />Submitting...</> : <>Record expense <ArrowRight size={16} /></>}</button></div></form></div>
}

export function ProjectDetailPageBasic() {
  const { projectId } = useParams()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  useEffect(() => { let active = true; getProjectDetails(projectId).then((project) => { if (active) setData(project) }).catch((loadError) => { if (active) setError(getFriendlyError(loadError, 'This project could not be read from the configured blockchain.')) }).finally(() => { if (active) setLoading(false) }); return () => { active = false } }, [projectId, attempt])
  if (loading) return <LoadingState label="Loading project and contract records" />
  if (error) return <ErrorState message={error} onRetry={() => { setLoading(true); setError(''); setAttempt((value) => value + 1) }} />
  if (!data) return <EmptyState title="Project not found" detail="No matching project exists on the configured network." />
  return <div className="project-detail"><div className="page-title-row"><div><span className="eyebrow">VERIFIED PROJECT RECORD</span><h1>{data.name}</h1><p>Project ID <code>{data.projectId}</code></p></div><StatusBadge>{data.remaining <= 0 ? 'COMPLETED' : data.spent ? 'ACTIVE' : 'PLANNED'}</StatusBadge></div><div className="detail-hero"><div><span>APPROVED BUDGET</span><strong>{formatINR(data.budget)}</strong><small>Recorded on deployed contract</small></div><div><span>RECORDED SPEND</span><strong>{formatINR(data.spent)}</strong><small>{data.transactions.length} on-chain expense records</small></div><div><span>REMAINING</span><strong>{formatINR(data.remaining)}</strong><small>Allocation less recorded spend</small></div></div><section className="panel detail-transactions"><div className="panel-heading"><div><span className="eyebrow">EXPENSE REGISTER</span><h2>Blockchain transactions</h2></div><span className="chain-chip"><i className="pulse-dot" />ON CHAIN</span></div><TransactionTable transactions={data.transactions} /></section><section className="verification-card"><div className="verification-symbol"><Blocks size={22} /></div><div><span className="eyebrow">BLOCKCHAIN VERIFICATION</span><h3>Read directly from FundTransparency</h3><p>Project totals and expense details come from the existing deployed contract.</p></div><div className="contract-tag"><span>CONTRACT ADDRESS</span><code>0x5FbD...80aa3</code></div></section></div>
}

export function TransactionsPageBasic() {
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState({ transactions: [], loading: true, error: '' })
  useEffect(() => { let active = true; getTransactionHistory().then((transactions) => { if (active) setState({ transactions, loading: false, error: '' }) }).catch((error) => { if (active) setState({ transactions: [], loading: false, error: getFriendlyError(error) }) }); return () => { active = false } }, [attempt])
  return <><div className="page-title-row"><div><span className="eyebrow">PUBLIC CONTRACT DATA</span><h1>Transactions</h1><p>Expense events and their originating contract transactions.</p></div><span className="chain-chip"><i className="pulse-dot" />READ ONLY</span></div><section className="panel">{state.loading ? <LoadingState /> : state.error ? <ErrorState message={state.error} onRetry={() => { setState({ transactions: [], loading: true, error: '' }); setAttempt((value) => value + 1) }} /> : <TransactionTable transactions={state.transactions} />}</section></>
}

function WalletRoleNotice({ contractRole }) {
  const { address, chainId, expectedChainId } = useWallet()
  const [roleResult, setRoleResult] = useState({ key: '', allowed: null })
  const roleKey = `${address || ''}:${chainId ?? ''}:${contractRole}`
  useEffect(() => { if (!address || !expectedChainId || chainId !== expectedChainId) return; let active = true; getWalletRole(address, contractRole).then((allowed) => { if (active) setRoleResult({ key: roleKey, allowed }) }).catch(() => { if (active) setRoleResult({ key: roleKey, allowed: false }) }); return () => { active = false } }, [address, chainId, expectedChainId, contractRole, roleKey])
  const isAuthorized = roleResult.key === roleKey ? roleResult.allowed : null
  if (!address) return <div className="notice notice-neutral"><Wallet size={17} /><span>Wallet not connected. Application role and blockchain wallet role are separate. Official project operations are signed by the configured backend wallet.</span></div>
  if (chainId !== expectedChainId) return <div className="notice notice-neutral"><CircleAlert size={17} /><span>Please connect MetaMask to the local Hardhat network before checking contract roles.</span></div>
  return <div className={`notice ${isAuthorized ? 'notice-info' : 'notice-neutral'}`}><ShieldCheck size={17} /><span>{isAuthorized === null ? 'Checking connected wallet contract role...' : isAuthorized ? 'Connected wallet has the required contract role. Official API operations still use the backend signer.' : 'Connected wallet does not have the required contract role. Official API operations use the backend signer.'}</span></div>
}

function CreateProjectPage() {
  const [form, setForm] = useState({ project_id: '', name: '', budget: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  async function submit(event) {
    event.preventDefault(); setError(''); setBusy(true)
    try { const response = await api.post('/projects/', { ...form, budget: Number(form.budget) }); setResult(response.data) } catch (requestError) { setError(getFriendlyError(requestError)) } finally { setBusy(false) }
  }
  return <div className="form-page"><div className="page-title-row"><div><span className="eyebrow">GOVERNMENT / PROJECTS</span><h1>Create project</h1><p>Create a record in MySQL and the existing deployed contract.</p></div><Link className="button button-outline" to="/government/projects"><ArrowRight className="rotate-left" size={16} />Back to projects</Link></div><WalletRoleNotice contractRole="GOVERNMENT_OFFICIAL" />{result ? <section className="success-panel"><div className="success-mark"><Check size={22} /></div><span className="eyebrow">PROJECT CREATED</span><h2>{result.project_id}</h2><p>{result.message}</p><dl className="result-grid"><div><dt>MySQL record ID</dt><dd>{result.mysql_project_id}</dd></div><div><dt>Block number</dt><dd>{result.block_number}</dd></div><div className="result-hash"><dt>Transaction hash</dt><dd><HashText hash={result.transaction_hash} /></dd></div></dl><Link className="button button-primary" to={`/government/projects/${encodeURIComponent(result.project_id)}`}>View project <ArrowRight size={16} /></Link></section> : <form className="form-panel" onSubmit={submit}>{error && <div className="alert alert-error"><CircleAlert size={17} />{error}</div>}<div className="form-panel-heading"><span className="eyebrow">PROJECT DETAILS</span><p>The existing API accepts project ID, name, and budget. Description and dates are not currently stored.</p></div><label>Project ID<input required maxLength={100} value={form.project_id} onChange={(event) => setForm({ ...form, project_id: event.target.value.trim() })} placeholder="e.g. BRIDGE003" /></label><label>Project name<input required maxLength={255} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Project name" /></label><label>Approved budget (INR)<input required type="number" min="1" step="1" value={form.budget} onChange={(event) => setForm({ ...form, budget: event.target.value })} placeholder="3000000" /></label><div className="form-footer"><span><LockKeyhole size={14} />Requires ADMIN or GOVERNMENT_OFFICIAL access</span><button className="button button-primary" disabled={busy}>{busy ? <><LoaderCircle className="spin" size={16} />Creating project...</> : <>Create project <ArrowRight size={16} /></>}</button></div></form>}</div>
}

function GovernmentExpensePage() {
  const [searchParams] = useSearchParams()
  const [projects, setProjects] = useState([])
  const [form, setForm] = useState({ project_id: '', category: 'LABOUR', amount: '', description: '', expense_date: new Date().toISOString().slice(0, 10) })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  useEffect(() => { let active = true; listChainProjects().then((rows) => { if (active) setProjects(rows) }).catch(() => { if (active) setError('Unable to load projects from the local contract.') }); return () => { active = false } }, [])
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError(''); setResult(null)
    try { const response = await api.post(`/projects/${encodeURIComponent(form.project_id)}/expenses/`, { category: form.category, amount: Number(form.amount), description: form.description, expense_date: form.expense_date }); setResult(response.data) } catch (requestError) { setError(getFriendlyError(requestError)) } finally { setBusy(false) }
  }
  if (searchParams.get('mode') === 'budget') return <BudgetAllocationPage />
  return <div className="form-page"><div className="page-title-row"><div><span className="eyebrow">GOVERNMENT / TRANSACTIONS</span><h1>Record an expense</h1><p>Django records the expense on chain and stores the MySQL transaction.</p></div></div><WalletRoleNotice contractRole="GOVERNMENT_OFFICIAL" />{error && <div className="alert alert-error"><CircleAlert size={17} />{error}</div>}{result && <div className="notice notice-success"><BadgeCheck size={19} /><div><strong>Transaction confirmed</strong><span>Block {result.block_number} · {formatINR(result.amount)}</span><span>Wallet {shortHash(result.wallet_address)}</span><HashText hash={result.transaction_hash} /></div></div>}<form className="form-panel" onSubmit={submit}><label>Project<select required value={form.project_id} onChange={(event) => setForm({ ...form, project_id: event.target.value })}><option value="">Choose a project</option>{projects.map((project) => <option key={project.projectId} value={project.projectId}>{project.projectId} · {project.name}</option>)}</select></label><label>Category<select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>{['LABOUR', 'MATERIAL', 'CONTRACTOR', 'EQUIPMENT', 'OTHER'].map((category) => <option key={category}>{category}</option>)}</select></label><label>Amount (INR)<input type="number" min="1" step="1" required value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} placeholder="50000" /></label><label>Expense date<input type="date" required value={form.expense_date} onChange={(event) => setForm({ ...form, expense_date: event.target.value })} /></label><label className="field-full">Description<input required value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Purpose of this expense" /></label><div className="form-footer field-full"><span><Blocks size={15} />Backend signer submits the blockchain transaction</span><button className="button button-primary" disabled={busy || !projects.length}>{busy ? <><LoaderCircle className="spin" size={16} />Submitting...</> : <>Record expense <ArrowRight size={16} /></>}</button></div></form></div>
}

function ProjectDetailPage() {
  const { projectId } = useParams()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [chainRead, setChainRead] = useState(null)
  useEffect(() => {
    let active = true
    api.get(`/public/projects/${encodeURIComponent(projectId)}/`).then(({ data: response }) => {
      const project = response.project
      if (active) setData({
        projectId: project.project_id,
        name: project.name,
        budget: Number(project.budget),
        spent: Number(project.spent),
        remaining: Number(project.remaining),
        description: project.description,
        startDate: project.start_date,
        endDate: project.end_date,
        categories: project.categories,
        transactions: (project.transactions || project.expenses).map(mapTransaction),
      })
    }).catch((loadError) => { if (active) setError(getFriendlyError(loadError, 'Unable to load this public project.')) }).finally(() => { if (active) setLoading(false) })
    getProjectDetails(projectId).then((chainProject) => { if (active) setChainRead(Boolean(chainProject)) }).catch(() => { if (active) setChainRead(false) })
    return () => { active = false }
  }, [projectId, attempt])
  if (loading) return <LoadingState label="Loading project and contract records" />
  if (error) return <ErrorState message={error} onRetry={() => { setLoading(true); setError(''); setAttempt((value) => value + 1) }} />
  if (!data) return <EmptyState title="Project not found" detail="No matching project exists on the configured network." />
  return <div className="project-detail"><div className="page-title-row"><div><span className="eyebrow">PUBLIC PROJECT RECORD</span><h1>{data.name}</h1><p>Project ID <code>{data.projectId}</code> · {data.description || 'Government-funded project'}</p></div><StatusBadge>{data.remaining <= 0 ? 'COMPLETED' : data.spent ? 'ACTIVE' : 'PLANNED'}</StatusBadge></div><div className="detail-hero"><div><span>APPROVED BUDGET</span><strong>{formatINR(data.budget)}</strong><small>MySQL project register</small></div><div><span>RECORDED SPEND</span><strong>{formatINR(data.spent)}</strong><small>{data.transactions.length} persisted expenses</small></div><div><span>REMAINING</span><strong>{formatINR(data.remaining)}</strong><small>Allocation less recorded spend</small></div></div><div className="notice notice-info"><Blocks size={17} /><span>{chainRead === null ? 'Checking contract read…' : chainRead ? 'Project is readable from the configured FundTransparency contract.' : 'Contract RPC is unavailable; figures above are from persisted MySQL records.'}</span></div><section className="panel detail-transactions"><div className="panel-heading"><div><span className="eyebrow">EXPENSE REGISTER</span><h2>Recorded transactions</h2></div><span className="chain-chip"><i className="pulse-dot" />MYSQL + CHAIN REFERENCES</span></div><TransactionTable transactions={data.transactions} /></section><section className="verification-card"><div className="verification-symbol"><Blocks size={22} /></div><div><span className="eyebrow">BLOCKCHAIN VERIFICATION</span><h3>Contract reads use ethers.js</h3><p>Hashes, block numbers, and wallet addresses come from confirmed transaction records.</p></div><div className="contract-tag"><span>CONTRACT ADDRESS</span><code>0x5FbD...80aa3</code></div></section></div>
}

function TransactionsPage({ publicOnly = false }) {
  const { user } = useAuth()
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState({ transactions: [], loading: true, error: '', chainCount: null })
  useEffect(() => {
    let active = true
    const endpoint = publicOnly ? '/public/transactions/' : user?.role === 'NGO_OFFICIAL' ? '/ngo/transactions/' : ['ADMIN', 'AUDITOR'].includes(user?.role) ? '/audit/transactions/' : '/public/transactions/'
    Promise.all([api.get(endpoint), getTransactionHistory().catch(() => null)]).then(([response, chainRows]) => {
      if (active) setState({ transactions: response.data.transactions.map(mapTransaction), loading: false, error: '', chainCount: chainRows?.length ?? null })
    }).catch((requestError) => { if (active) setState({ transactions: [], loading: false, error: getFriendlyError(requestError), chainCount: null }) })
    return () => { active = false }
  }, [attempt, publicOnly, user?.role])
  return <><div className="page-title-row"><div><span className="eyebrow">PERSISTED TRANSACTION RECORDS</span><h1>Transactions</h1><p>MySQL references alongside confirmed contract hashes and block numbers.</p></div><span className="chain-chip"><i className="pulse-dot" />{state.chainCount === null ? 'CONTRACT RPC UNAVAILABLE' : `${state.chainCount} ON-CHAIN RECORDS`}</span></div><section className="panel">{state.loading ? <LoadingState /> : state.error ? <ErrorState message={state.error} onRetry={() => setAttempt((value) => value + 1)} /> : <TransactionTable transactions={state.transactions} />}</section></>
}

function PlaceholderPage({ title, role }) {
  const location = useLocation()
  if (role === 'ADMIN' && location.pathname === '/admin/users') return <AdminUsersPage />
  if (role === 'ADMIN') return <AdminSystemPage />
  if (role === 'NGO_OFFICIAL') return <NGOWorkspace />
  if (role === 'AUDITOR' && /transactions|audit-trail/.test(location.pathname)) return <TransactionsPage />
  if (role === 'AUDITOR') return <DashboardHome role="AUDITOR" />
  return <><div className="page-title-row"><div><span className="eyebrow">{roleLabels[role]?.toUpperCase()} WORKSPACE</span><h1>{title}</h1><p>Backend API capability check</p></div></div><div className="unavailable-panel"><div className="unavailable-icon"><CircleAlert size={21} /></div><div><h2>This data is not available yet</h2><p>The current Django backend does not expose this resource. No placeholder records are shown; a compatible direct-MySQL API addition is needed before this view can be populated.</p><span className="capability-label">CURRENT API: NOT PROVIDED</span></div></div></>
}

function AccessDenied() {
  const { user } = useAuth()
  return <div className="access-page"><Brand /><div className="access-content"><span className="access-icon"><LockKeyhole size={25} /></span><span className="eyebrow">403 · ACCESS RESTRICTED</span><h1>Access denied</h1><p>Your {roleLabels[user?.role] || 'account'} role does not have permission to view this workspace.</p><Link className="button button-primary" to={rolePaths[user?.role] || '/public'}>Return to your dashboard <ArrowRight size={16} /></Link></div></div>
}

function RoleWorkspace({ role, children }) {
  return <ProtectedRoute allowedRoles={[role]}><DashboardLayout role={role}>{children}</DashboardLayout></ProtectedRoute>
}

function AppRoutes() {
  const { isAuthenticated, user } = useAuth()
  return <Routes><Route path="/" element={<Navigate to={isAuthenticated ? rolePaths[user?.role] || '/public' : '/public'} replace />} /><Route path="/login" element={isAuthenticated ? <Navigate to={rolePaths[user?.role] || '/public'} replace /> : <AuthPage />} /><Route path="/register" element={isAuthenticated ? <Navigate to={rolePaths[user?.role] || '/public'} replace /> : <AuthPage mode="register" />} /><Route path="/access-denied" element={<AccessDenied />} /><Route path="/public" element={<PublicDashboard />} /><Route path="/public/projects/:projectId" element={<ProjectDetailPage />} /><Route path="/admin" element={<RoleWorkspace role="ADMIN"><DashboardHome role="ADMIN" /></RoleWorkspace>} /><Route path="/admin/projects" element={<RoleWorkspace role="ADMIN"><DashboardHome role="ADMIN" /></RoleWorkspace>} /><Route path="/admin/projects/create" element={<RoleWorkspace role="ADMIN"><CreateProjectPage /></RoleWorkspace>} /><Route path="/admin/projects/:projectId" element={<RoleWorkspace role="ADMIN"><ProjectDetailPage /></RoleWorkspace>} /><Route path="/admin/transactions" element={<RoleWorkspace role="ADMIN"><TransactionsPage /></RoleWorkspace>} /><Route path="/admin/users" element={<RoleWorkspace role="ADMIN"><PlaceholderPage title="Users" role="ADMIN" /></RoleWorkspace>} /><Route path="/admin/reports" element={<RoleWorkspace role="ADMIN"><PlaceholderPage title="Reports" role="ADMIN" /></RoleWorkspace>} /><Route path="/government" element={<RoleWorkspace role="GOVERNMENT_OFFICIAL"><DashboardHome role="GOVERNMENT_OFFICIAL" /></RoleWorkspace>} /><Route path="/government/projects" element={<RoleWorkspace role="GOVERNMENT_OFFICIAL"><DashboardHome role="GOVERNMENT_OFFICIAL" /></RoleWorkspace>} /><Route path="/government/projects/create" element={<RoleWorkspace role="GOVERNMENT_OFFICIAL"><CreateProjectPage /></RoleWorkspace>} /><Route path="/government/projects/:projectId" element={<RoleWorkspace role="GOVERNMENT_OFFICIAL"><ProjectDetailPage /></RoleWorkspace>} /><Route path="/government/expenses" element={<RoleWorkspace role="GOVERNMENT_OFFICIAL"><GovernmentExpensePage /></RoleWorkspace>} /><Route path="/ngo" element={<RoleWorkspace role="NGO_OFFICIAL"><DashboardHome role="NGO_OFFICIAL" /></RoleWorkspace>} /><Route path="/ngo/*" element={<RoleWorkspace role="NGO_OFFICIAL"><PlaceholderPage title="NGO records" role="NGO_OFFICIAL" /></RoleWorkspace>} /><Route path="/auditor" element={<RoleWorkspace role="AUDITOR"><DashboardHome role="AUDITOR" /></RoleWorkspace>} /><Route path="/auditor/projects" element={<RoleWorkspace role="AUDITOR"><DashboardHome role="AUDITOR" /></RoleWorkspace>} /><Route path="/auditor/projects/:projectId" element={<RoleWorkspace role="AUDITOR"><ProjectDetailPage /></RoleWorkspace>} /><Route path="/auditor/transactions" element={<RoleWorkspace role="AUDITOR"><TransactionsPage /></RoleWorkspace>} /><Route path="/auditor/*" element={<RoleWorkspace role="AUDITOR"><TransactionsPage /></RoleWorkspace>} /><Route path="*" element={<Navigate to="/public" replace />} /></Routes>
}

export default function FundApp() {
  return <BrowserRouter><AuthProvider><WalletProvider><WalletLoginAction /><AppRoutes /><Routes><Route path="/transactions" element={<TransactionsPage publicOnly />} /></Routes></WalletProvider></AuthProvider></BrowserRouter>
}

function WalletLoginAction() {
  const location = useLocation()
  return location.pathname === '/login' ? <div className="auth-wallet-action"><WalletButton /></div> : null
}