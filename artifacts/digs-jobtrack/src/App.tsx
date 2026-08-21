import { useMemo, useRef, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  ArrowLeft, ArrowRight, BarChart3, CalendarDays, Check, CheckCircle2,
  ChevronRight, ClipboardList, Download, Filter, LayoutDashboard,
  MapPin, MessageCircle, MoreHorizontal, Pencil, Phone, Plus, Printer, RefreshCw,
  Search, Settings as SettingsIcon, SlidersHorizontal, Users,
  Wrench, X, Zap
} from 'lucide-react';
import {
  getGetDashboardQueryKey, getGetJobQueryKey, getGetReportsQueryKey, getGetSettingsQueryKey,
  getHealthCheckQueryKey, getListJobsQueryKey, useCreateContact, useCreateJob,
  useGetDashboard, useGetJob, useGetReports, useGetSettings, useHealthCheck, useListJobs,
  useUpdateJob, useUpdateSettings
} from '@workspace/api-client-react';
import type { Job, Settings } from '@workspace/api-client-react';
import { Link, Route, Switch, useLocation, useParams } from 'wouter';
import { ErrorBoundary } from '@/components/error-boundary';
import NotFound from '@/pages/not-found';

const queryClient = new QueryClient();
const statuses = ['NEW', 'CONTACTED', 'CONFIRMED', 'GOING', 'ARRIVED', 'IN_PROGRESS', 'COMPLETED', 'ON_HOLD', 'POSTPONED', 'CANCELLED', 'UNREACHABLE'];
const priorities = ['URGENT', 'HIGH', 'NORMAL', 'LOW'];
const blankJob: Record<string, string> = {
  jobId: '', customerName: '', customerPhone: '', customerEmail: '', customerAddress: '', state: '',
  area: '', installationDate: '', outletName: '', agentName: '', dealCode: '', shopPickName: '',
  shopPickLocation: '', deviceNumber: '', deviceImei: '', deviceType: 'MTN ODU', jobSource: '',
  dateReceived: '', assignedDate: '', scheduledDate: '', priority: 'NORMAL', status: 'NEW', notes: '',
  internalNotes: '', contactStatus: '', nextFollowUpDate: ''
};

function human(value?: string | null) {
  return value ? value.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()) : '—';
}
function dateLabel(value?: string | null) {
  if (!value) return 'Not set';
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? value : date.toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });
}
function currency(value?: number, unit = '₦') {
  return `${unit}${(value || 0).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function initials(name?: string) {
  return (name || 'Technician').split(' ').map((word) => word[0]).join('').slice(0, 2).toUpperCase();
}
function isToday(value?: string | null) {
  if (!value) return false;
  const date = new Date(value);
  const now = new Date();
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
}

function NavItem({ href, label, icon: Icon, exact = false }: { href: string; label: string; icon: typeof LayoutDashboard; exact?: boolean }) {
  const [location] = useLocation();
  const active = exact ? location === href : location === href || location.startsWith(`${href}/`);
  return <Link href={href} className={`nav-link ${active ? 'active' : ''}`} data-testid={`link-nav-${label.toLowerCase()}`}>
    <Icon /><span>{label}</span>
  </Link>;
}

function Shell({ children }: { children: React.ReactNode }) {
  const settings = useGetSettings({ query: { queryKey: getGetSettingsQueryKey() } });
  const health = useHealthCheck({ query: { queryKey: getHealthCheckQueryKey() } });
  const technician = settings.data?.name || 'Field technician';
  const nav = [
    { href: '/', label: 'Overview', icon: LayoutDashboard, exact: true },
    { href: '/today', label: 'Today', icon: Zap },
    { href: '/jobs', label: 'Jobs', icon: ClipboardList },
    { href: '/contacts', label: 'Contacts', icon: Users },
    { href: '/reports', label: 'Reports', icon: BarChart3 },
    { href: '/settings', label: 'Settings', icon: SettingsIcon }
  ];
  return <div className="app-shell">
    <aside className="sidebar">
      <Link href="/" className="brand" data-testid="link-brand">
        <span className="brand-mark">D</span>
        <span><span className="brand-copy">DIGS</span><span className="brand-sub">JobTrack / Field ops</span></span>
      </Link>
      <div className="nav-label">Workspace</div>
      <nav className="nav">{nav.map((item) => <NavItem key={item.href} {...item} />)}</nav>
      <div className="sidebar-bottom">
        <div className="tech-chip">
          <span className="avatar">{initials(technician)}</span>
          <span><div className="tech-name">{technician}</div><div className="tech-role">MTN ODU technician</div></span>
        </div>
      </div>
    </aside>
    <main className="main">
      <header className="topbar">
        <Link href="/" className="mobile-brand" data-testid="link-mobile-brand"><span className="brand-mark">D</span><span>DIGS JobTrack</span></Link>
        <div className="topbar-right">
          <span className="health-dot" style={{ background: health.isError ? 'hsl(var(--destructive))' : undefined }} />
          <span className="health-label" data-testid="status-api-health">{health.isLoading ? 'Checking link' : health.isError ? 'Offline mode' : 'System linked'}</span>
          <span className="avatar" aria-label="technician profile">{initials(technician)}</span>
        </div>
      </header>
      {children}
      <nav className="mobile-bottom">{nav.slice(0, 5).map((item) => <NavItem key={item.href} {...item} />)}</nav>
    </main>
  </div>;
}

function LoadingPanel() {
  return <div className="grid stats-grid" aria-label="Loading">
    {[1, 2, 3, 4].map((item) => <div className="stat-card" key={item}><div className="skeleton" style={{ height: 11, width: '55%' }} /><div className="skeleton" style={{ height: 38, width: '35%', marginTop: 13 }} /><div className="skeleton" style={{ height: 11, width: '70%', marginTop: 9 }} /></div>)}
  </div>;
}

function ErrorNotice({ onRetry }: { onRetry: () => void }) {
  return <div className="notice error" data-testid="status-error"><strong>Could not load field data.</strong> Check the connection, then retry. <button className="btn small" onClick={onRetry} data-testid="button-retry"><RefreshCw size={13} /> Retry</button></div>;
}

function StatCards({ dashboard }: { dashboard?: { total: number; today: number; completedToday: number; remainingToday: number; followUps: number; awaitingResponse: number } }) {
  const stats = [
    ['Assigned jobs', dashboard?.total ?? 0, 'Across your active queue', ''],
    ['On today', dashboard?.today ?? 0, `${dashboard?.remainingToday ?? 0} still to action`, 'stat-accent'],
    ['Completed today', dashboard?.completedToday ?? 0, 'Closed in the field', ''],
    ['Follow-ups', dashboard?.followUps ?? 0, `${dashboard?.awaitingResponse ?? 0} awaiting response`, 'stat-accent']
  ];
  return <div className="grid stats-grid">{stats.map(([label, number, note, accent]) => <div className="stat-card" key={label}>
    <div className="stat-label">{label}</div><div className={`stat-number ${accent}`}>{number}</div><div className="stat-note">{note}</div>
  </div>)}</div>;
}

function JobRow({ job }: { job: Job }) {
  return <Link href={`/jobs/${job.id}`} className="job-row" data-testid={`link-job-${job.id}`}>
    <div className="job-main"><div className="job-id">{job.jobId}</div><div className="job-name">{job.customerName}</div><div className="job-meta"><MapPin size={11} style={{ display: 'inline', verticalAlign: '-2px' }} /> {job.area || job.state || 'Location not set'} · {job.deviceType || 'ODU install'}</div></div>
    <div className="job-side"><span className={`badge priority-${job.priority.toLowerCase()}`}>{job.priority}</span><span className={`badge status-${job.status.toLowerCase()}`}>{human(job.status)}</span></div><ChevronRight size={15} className="muted" />
  </Link>;
}

function Dashboard() {
  const dashboard = useGetDashboard({ query: { queryKey: getGetDashboardQueryKey() } });
  const jobs = useListJobs({ query: { queryKey: getListJobsQueryKey() } });
  const todayJobs = useMemo(() => (jobs.data || []).filter((job) => isToday(job.scheduledDate || job.installationDate)).slice(0, 5), [jobs.data]);
  if (dashboard.isLoading || jobs.isLoading) return <div className="page"><LoadingPanel /></div>;
  if (dashboard.isError || jobs.isError) return <div className="page"><ErrorNotice onRetry={() => { void dashboard.refetch(); void jobs.refetch(); }} /></div>;
  const byStatus = dashboard.data?.byStatus || {};
  const totalForBars = Math.max(dashboard.data?.total || 0, 1);
  return <div className="page">
    <div className="page-heading"><div><div className="eyebrow">Tuesday · Field control</div><h1 className="page-title">Good morning, keep moving.</h1><p className="page-subtitle">Your installation queue, contact signals and next actions in one place.</p></div><div className="actions"><Link href="/today" className="btn urgent" data-testid="link-open-today"><Zap size={15} /> Open today’s queue</Link><Link href="/jobs" className="btn" data-testid="link-view-jobs"><ClipboardList size={15} /> All jobs</Link></div></div>
    <StatCards dashboard={dashboard.data} />
    <div className="grid dashboard-grid">
      <section className="panel"><div className="panel-header"><div><div className="panel-title">Today’s run sheet</div><div className="panel-kicker">Scheduled jobs that need your attention</div></div><Link href="/today" className="btn ghost small" data-testid="link-see-all-today">See full queue <ArrowRight size={14} /></Link></div>
        {todayJobs.length ? todayJobs.map((job) => <JobRow key={job.id} job={job} />) : <div className="empty"><CalendarDays size={22} /><strong>Nothing scheduled for today</strong>Pull the next job forward from your queue.</div>}
      </section>
      <section className="panel"><div className="panel-header"><div><div className="panel-title">Queue health</div><div className="panel-kicker">Live status mix across assigned work</div></div><MoreHorizontal size={17} className="muted" /></div>
        <div className="status-list">{[['NEW', 'New'], ['CONTACTED', 'Contacted'], ['CONFIRMED', 'Confirmed'], ['IN_PROGRESS', 'In progress'], ['COMPLETED', 'Completed']].map(([key, label]) => <div className="status-line" key={key}><div><div className="status-line-label"><span>{label}</span><span className="mono">{byStatus[key] || 0}</span></div><div className="progress-track"><div className="progress-bar" style={{ width: `${Math.min(((byStatus[key] || 0) / totalForBars) * 100, 100)}%` }} /></div></div></div>)}</div>
      </section>
    </div>
    <div className="grid dashboard-grid mt">
      <section className="panel"><div className="panel-header"><div><div className="panel-title">What needs a response</div><div className="panel-kicker">Contacts and follow-ups become actions here</div></div></div>
        <div className="action-stack"><Link href="/today?focus=followups" className="btn" data-testid="link-followups"><MessageCircle size={16} /> Review {dashboard.data?.followUps || 0} follow-up{dashboard.data?.followUps === 1 ? '' : 's'} <ArrowRight size={14} style={{ marginLeft: 'auto' }} /></Link><Link href="/jobs?status=UNREACHABLE" className="btn" data-testid="link-unreachable"><Phone size={16} /> Revisit unreachable customers <ArrowRight size={14} style={{ marginLeft: 'auto' }} /></Link></div>
      </section>
      <section className="panel"><div className="panel-header"><div><div className="panel-title">Field note</div><div className="panel-kicker">A clean record is a faster close</div></div><Wrench size={17} className="muted" /></div><p className="page-subtitle">Log every customer touch while it is fresh. Your contact trail is the handover if a job moves days.</p></section>
    </div>
  </div>;
}

function JobForm({ onClose, initial, mode = 'create', onSaved }: { onClose: () => void; initial?: Partial<Job>; mode?: 'create' | 'edit'; onSaved?: (job: Job) => void }) {
  const create = useCreateJob();
  const update = useUpdateJob();
  const [form, setForm] = useState<Record<string, string>>(() => ({ ...blankJob, ...Object.fromEntries(Object.entries(initial || {}).map(([key, value]) => [key, value == null ? '' : String(value)])) }));
  const set = (key: string, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const saving = create.isPending || update.isPending;
  const submit = () => {
    if (!form.customerName.trim() || !form.customerPhone.trim()) return;
    const common = {
      ...form, priority: form.priority, status: form.status, id: initial?.id || 0,
      transportCost: Number(initial?.transportCost || 0), otherExpenses: Number(initial?.otherExpenses || 0), totalExpenses: Number(initial?.totalExpenses || 0),
    };
    if (mode === 'edit' && initial?.id) update.mutate({ id: initial.id, data: common as never }, { onSuccess: (job) => { onSaved?.(job); onClose(); } });
    else create.mutate({ data: common as never }, { onSuccess: (job) => { onSaved?.(job); onClose(); } });
  };
  const field = (key: string, label: string, type = 'text', full = false) => <div className={`field ${full ? 'full' : ''}`} key={key}><label htmlFor={`job-${key}`}>{label}</label><input id={`job-${key}`} className="input" type={type} value={form[key] || ''} onChange={(event) => set(key, event.target.value)} data-testid={`input-job-${key}`} /></div>;
  return <div className="modal-backdrop"><div className="modal" role="dialog" aria-modal="true">
    <div className="modal-header"><div><div className="eyebrow">{mode === 'create' ? 'New field record' : 'Update record'}</div><div className="modal-title">{mode === 'create' ? 'Add installation job' : 'Edit job details'}</div></div><button className="icon-btn" onClick={onClose} data-testid="button-close-job-form"><X size={18} /></button></div>
    <div className="modal-body"><div className="form-grid">
      {field('jobId', 'Job reference')}{field('customerName', 'Customer name *')}{field('customerPhone', 'Customer phone *', 'tel')}{field('customerEmail', 'Customer email', 'email')}{field('customerAddress', 'Installation address', 'text', true)}{field('state', 'State')}{field('area', 'Area')}{field('installationDate', 'Installation date', 'date')}{field('scheduledDate', 'Scheduled date', 'date')}{field('outletName', 'Outlet name')}{field('agentName', 'Agent name')}{field('dealCode', 'Deal code')}{field('deviceNumber', 'Device number')}{field('deviceImei', 'Device IMEI')}{field('deviceType', 'Device type')}{field('jobSource', 'Job source')}
      <div className="field"><label htmlFor="job-priority">Priority</label><select id="job-priority" className="select" value={form.priority} onChange={(event) => set('priority', event.target.value)} data-testid="select-job-priority">{priorities.map((value) => <option key={value}>{value}</option>)}</select></div>
      <div className="field"><label htmlFor="job-status">Status</label><select id="job-status" className="select" value={form.status} onChange={(event) => set('status', event.target.value)} data-testid="select-job-status">{statuses.map((value) => <option key={value}>{value}</option>)}</select></div>
      <div className="field full"><label htmlFor="job-notes">Customer notes</label><textarea id="job-notes" className="textarea" value={form.notes} onChange={(event) => set('notes', event.target.value)} data-testid="textarea-job-notes" /></div>
    </div></div>
    <div className="modal-footer"><button className="btn" onClick={onClose} data-testid="button-cancel-job">Cancel</button><button className="btn primary" onClick={submit} disabled={saving || !form.customerName || !form.customerPhone} data-testid="button-save-job">{saving ? 'Saving…' : mode === 'create' ? 'Create job' : 'Save changes'} <Check size={15} /></button></div>
  </div></div>;
}

function Jobs() {
  const jobs = useListJobs({ query: { queryKey: getListJobsQueryKey() } });
  const create = useCreateJob();
  const fileRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('ALL');
  const [priority, setPriority] = useState('ALL');
  const [showForm, setShowForm] = useState(false);
  const [notice, setNotice] = useState('');
  const importCsv = async (file: File) => {
    const text = await file.text();
    const [headerLine, ...lines] = text.split(/\r?\n/).filter(Boolean);
    if (!headerLine || !lines.length) { setNotice('The sheet is empty. Use a header row and at least one job.'); return; }
    const headers = headerLine.split(',').map((item) => item.trim());
    const rows = lines.map((line) => line.split(',').map((item) => item.trim()));
    let imported = 0;
    for (const values of rows) {
      const record = Object.fromEntries(headers.map((header, index) => [header, values[index] || '']));
      if (!record.customerName || !record.customerPhone) continue;
      await create.mutateAsync({ data: { ...blankJob, ...record, priority: record.priority || 'NORMAL', status: record.status || 'NEW', id: 0 } as never });
      imported += 1;
    }
    setNotice(`${imported} job${imported === 1 ? '' : 's'} imported from ${file.name}.`);
    void jobs.refetch();
  };
  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) void importCsv(file);
    event.target.value = '';
  };
  const filtered = useMemo(() => (jobs.data || []).filter((job) => {
    const needle = search.toLowerCase();
    return (!needle || [job.jobId, job.customerName, job.customerPhone, job.area, job.customerAddress].some((item) => item?.toLowerCase().includes(needle))) && (status === 'ALL' || job.status === status) && (priority === 'ALL' || job.priority === priority);
  }), [jobs.data, search, status, priority]);
  if (jobs.isLoading) return <div className="page"><LoadingPanel /></div>;
  if (jobs.isError) return <div className="page"><ErrorNotice onRetry={() => void jobs.refetch()} /></div>;
  return <div className="page">
    <div className="page-heading"><div><div className="eyebrow">Operations / jobs</div><h1 className="page-title">Job register</h1><p className="page-subtitle">Search the queue, find the next customer, move the work forward.</p></div><div className="actions"><input ref={fileRef} type="file" accept=".csv,text/csv" hidden onChange={handleImport} data-testid="input-import-jobs" /><button className="btn" onClick={() => fileRef.current?.click()} disabled={create.isPending} data-testid="button-import-jobs"><Download size={15} /> {create.isPending ? 'Importing…' : 'Import CSV'}</button><button className="btn primary" onClick={() => setShowForm(true)} data-testid="button-create-job"><Plus size={15} /> New job</button></div></div>
    {notice && <div className="notice" data-testid="status-job-imported"><Check size={14} style={{ verticalAlign: '-2px', marginRight: 6 }} />{notice}</div>}
    <div className="panel"><div className="toolbar"><div className="search-wrap"><Search size={16} /><input className="input search" placeholder="Search name, job ID, phone or area" value={search} onChange={(event) => setSearch(event.target.value)} data-testid="input-search-jobs" /></div><select className="select filter-select" value={status} onChange={(event) => setStatus(event.target.value)} data-testid="select-filter-status"><option value="ALL">All statuses</option>{statuses.map((item) => <option key={item}>{human(item)}</option>)}</select><select className="select filter-select" value={priority} onChange={(event) => setPriority(event.target.value)} data-testid="select-filter-priority"><option value="ALL">All priorities</option>{priorities.map((item) => <option key={item}>{item}</option>)}</select><span className="muted mono" data-testid="text-job-result-count">{filtered.length} / {jobs.data?.length || 0}</span></div>
      {filtered.length ? <div className="table-wrap"><table className="table"><thead><tr><th>Job</th><th>Customer</th><th>Location</th><th>Schedule</th><th>Priority</th><th>Status</th><th /></tr></thead><tbody>{filtered.map((job) => <tr key={job.id}><td><Link href={`/jobs/${job.id}`} className="table-link" data-testid={`link-table-job-${job.id}`}>{job.jobId}</Link></td><td><strong>{job.customerName}</strong><div className="muted">{job.customerPhone}</div></td><td>{job.area || job.state || '—'}</td><td>{dateLabel(job.scheduledDate || job.installationDate)}</td><td><span className={`badge priority-${job.priority.toLowerCase()}`}>{job.priority}</span></td><td><span className={`badge status-${job.status.toLowerCase()}`}>{human(job.status)}</span></td><td><Link href={`/jobs/${job.id}`} className="icon-btn" data-testid={`button-open-job-${job.id}`}><ChevronRight size={16} /></Link></td></tr>)}</tbody></table></div> : <div className="empty"><Filter size={23} /><strong>No jobs match those filters</strong>Try a wider search or clear one of the filters.</div>}
    </div>
    {showForm && <JobForm onClose={() => setShowForm(false)} onSaved={() => { void jobs.refetch(); void queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() }); }} />}
  </div>;
}

function ContactForm({ jobId, onClose, onSaved }: { jobId: number; onClose: () => void; onSaved: () => void }) {
  const create = useCreateContact();
  const [method, setMethod] = useState('CALL');
  const [result, setResult] = useState('');
  const [notes, setNotes] = useState('');
  const submit = () => create.mutate({ id: jobId, data: { method, result, notes } as never }, { onSuccess: () => { onSaved(); onClose(); } });
  return <div className="modal-backdrop"><div className="modal" role="dialog" aria-modal="true">
    <div className="modal-header"><div><div className="eyebrow">Contact history</div><div className="modal-title">Log a touchpoint</div></div><button className="icon-btn" onClick={onClose} data-testid="button-close-contact-form"><X size={18} /></button></div>
    <div className="modal-body"><div className="form-grid"><div className="field"><label htmlFor="contact-method">Method</label><select id="contact-method" className="select" value={method} onChange={(event) => setMethod(event.target.value)} data-testid="select-contact-method">{['CALL', 'SMS', 'WHATSAPP', 'IN_PERSON'].map((item) => <option key={item}>{item}</option>)}</select></div><div className="field"><label htmlFor="contact-result">Result *</label><input id="contact-result" className="input" value={result} onChange={(event) => setResult(event.target.value)} placeholder="Reached, rescheduled…" data-testid="input-contact-result" /></div><div className="field full"><label htmlFor="contact-notes">Notes</label><textarea id="contact-notes" className="textarea" value={notes} onChange={(event) => setNotes(event.target.value)} data-testid="textarea-contact-notes" /></div></div></div>
    <div className="modal-footer"><button className="btn" onClick={onClose} data-testid="button-cancel-contact">Cancel</button><button className="btn primary" onClick={submit} disabled={create.isPending || !result} data-testid="button-save-contact">{create.isPending ? 'Logging…' : 'Save touchpoint'} <Check size={15} /></button></div>
  </div></div>;
}

function Detail() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const job = useGetJob(id, { query: { enabled: !!id, queryKey: getGetJobQueryKey(id) } });
  const update = useUpdateJob();
  const [edit, setEdit] = useState(false);
  const [contact, setContact] = useState(false);
  const [notice, setNotice] = useState('');
  const changeStatus = (status: string) => update.mutate({ id, data: { status } as never }, { onSuccess: () => { setNotice(`Job marked ${human(status).toLowerCase()}.`); void job.refetch(); } });
  if (job.isLoading) return <div className="page"><div className="detail-hero skeleton" style={{ height: 180 }} /><div className="panel skeleton" style={{ height: 230 }} /></div>;
  if (job.isError || !job.data) return <div className="page"><ErrorNotice onRetry={() => void job.refetch()} /></div>;
  const current = job.data;
  return <div className="page">
    <div className="actions" style={{ marginBottom: 18 }}><Link href="/jobs" className="btn ghost small" data-testid="link-back-jobs"><ArrowLeft size={15} /> Back to jobs</Link><span className="muted mono">/ {current.jobId}</span></div>
    {notice && <div className="notice" data-testid="status-job-updated"><CheckCircle2 size={15} style={{ verticalAlign: '-3px', marginRight: 7 }} />{notice}</div>}
    <div className="detail-hero"><div className="hero-content"><div className="eyebrow">Installation record · {current.jobId}</div><h1 className="detail-title">{current.customerName}</h1><div className="detail-address"><MapPin size={13} style={{ verticalAlign: '-2px', marginRight: 4 }} />{current.customerAddress || current.area || 'Address not set'}</div><div className="detail-tags"><span className={`badge priority-${current.priority.toLowerCase()}`}>{current.priority} priority</span><span className="badge">{human(current.status)}</span><span className="badge">{current.deviceType || 'MTN ODU'}</span></div></div></div>
    <div className="detail-layout">
      <div className="grid">
        <section className="panel"><div className="panel-header"><div><div className="panel-title">Job brief</div><div className="panel-kicker">The details you need before you roll</div></div><button className="btn small" onClick={() => setEdit(true)} data-testid="button-edit-job"><Pencil size={13} /> Edit</button></div><div className="detail-grid">{[['Customer phone', current.customerPhone], ['Customer email', current.customerEmail], ['Area', current.area], ['State', current.state], ['Scheduled', dateLabel(current.scheduledDate)], ['Outlet', current.outletName], ['Agent', current.agentName], ['Deal code', current.dealCode], ['Device number', current.deviceNumber], ['Device IMEI', current.deviceImei], ['Shop pick', current.shopPickName], ['Shop location', current.shopPickLocation]].map(([label, value]) => <div className="data-cell" key={label}><div className="data-label">{label}</div><div className="data-value">{value || '—'}</div></div>)}</div></section>
        <section className="panel"><div className="panel-header"><div><div className="panel-title">Installation notes</div><div className="panel-kicker">Visible context for the next step</div></div><Wrench size={17} className="muted" /></div><p className="page-subtitle">{current.notes || 'No customer notes have been added.'}</p>{current.installationNotes && <><div className="data-label mt">Completion notes</div><p className="page-subtitle">{current.installationNotes}</p></>}</section>
        <section className="panel"><div className="panel-header"><div><div className="panel-title">Contact trail</div><div className="panel-kicker">{current.contacts?.length || 0} logged touchpoints</div></div><button className="btn primary small" onClick={() => setContact(true)} data-testid="button-log-contact"><Plus size={13} /> Log contact</button></div>{current.contacts?.length ? <div className="timeline">{current.contacts.map((item) => <div className="timeline-item" key={item.id}><div className="timeline-top"><span>{item.method} · {item.result}</span><span className="timeline-date">{item.date} {item.time}</span></div><div className="timeline-note">{item.notes || 'No note attached.'}</div></div>)}</div> : <div className="empty"><MessageCircle size={22} /><strong>No contact history yet</strong>Log the first call, message or visit.</div>}</section>
      </div>
      <aside className="grid">
        <section className="panel"><div className="panel-header"><div><div className="panel-title">Next action</div><div className="panel-kicker">One tap, then keep moving</div></div><Zap size={17} className="muted" /></div><div className="action-stack"><a className="btn urgent" href={`tel:${current.customerPhone}`} data-testid="link-call-customer"><Phone size={15} /> Call customer</a><a className="btn" href={`https://wa.me/${current.customerPhone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" data-testid="link-whatsapp-customer"><MessageCircle size={15} /> Open WhatsApp</a><button className="btn" onClick={() => changeStatus('GOING')} disabled={update.isPending || current.status === 'GOING'} data-testid="button-mark-going"><ArrowRight size={15} /> Mark going</button><button className="btn primary" onClick={() => changeStatus('COMPLETED')} disabled={update.isPending || current.status === 'COMPLETED'} data-testid="button-mark-complete"><CheckCircle2 size={15} /> Mark completed</button></div></section>
        <section className="panel"><div className="panel-header"><div><div className="panel-title">Costs</div><div className="panel-kicker">Record the run, not just the result</div></div></div><div className="expense-total"><div><div className="data-label" style={{ color: 'inherit', opacity: .6 }}>Total expenses</div><div className="stat-number">{currency(current.totalExpenses)}</div></div><BarChart3 size={23} /></div><div className="detail-grid mt"><div className="data-cell"><div className="data-label">Transport</div><div className="data-value">{currency(current.transportCost)}</div></div><div className="data-cell"><div className="data-label">Other</div><div className="data-value">{currency(current.otherExpenses)}</div></div></div></section>
        <section className="panel"><div className="panel-header"><div><div className="panel-title">Workflow</div><div className="panel-kicker">Move the record to the right lane</div></div></div><select className="select" value={current.status} onChange={(event) => changeStatus(event.target.value)} data-testid="select-detail-status">{statuses.map((item) => <option key={item}>{item}</option>)}</select></section>
      </aside>
    </div>
    {edit && <JobForm initial={current} mode="edit" onClose={() => setEdit(false)} onSaved={(saved) => { queryClient.setQueryData(getGetJobQueryKey(id), saved); setNotice('Job details saved.'); }} />}
    {contact && <ContactForm jobId={id} onClose={() => setContact(false)} onSaved={() => { setNotice('Contact logged.'); void job.refetch(); }} />}
  </div>;
}

function Today() {
  const jobs = useListJobs({ query: { queryKey: getListJobsQueryKey() } });
  const [showAll, setShowAll] = useState(false);
  if (jobs.isLoading) return <div className="page"><LoadingPanel /></div>;
  if (jobs.isError) return <div className="page"><ErrorNotice onRetry={() => void jobs.refetch()} /></div>;
  const today = (jobs.data || []).filter((job) => isToday(job.scheduledDate || job.installationDate));
  const queue = today.length ? today : (jobs.data || []).filter((job) => !['COMPLETED', 'CANCELLED'].includes(job.status)).slice(0, 12);
  const shown = showAll ? queue : queue.slice(0, 6);
  return <div className="page"><div className="page-heading"><div><div className="eyebrow">Field focus / {new Date().toLocaleDateString('en-NG', { weekday: 'long', day: 'numeric', month: 'short' })}</div><h1 className="page-title">Today’s queue</h1><p className="page-subtitle">{today.length ? `${today.length} scheduled stop${today.length === 1 ? '' : 's'} on your run sheet.` : 'No dated stops found — here are your next open jobs.'}</p></div><div className="actions"><button className="btn" onClick={() => setShowAll((value) => !value)} data-testid="button-toggle-today">{showAll ? 'Show less' : 'Show all'} <SlidersHorizontal size={14} /></button></div></div>
    <section className="panel"><div className="panel-header"><div><div className="panel-title">Run sheet</div><div className="panel-kicker">Start at the top. Close each loop before the next stop.</div></div><span className="badge status-in_progress">{queue.filter((job) => job.status === 'IN_PROGRESS').length} in progress</span></div>{shown.length ? shown.map((job, index) => <div className="job-row" key={job.id}><div className="avatar" style={{ background: index === 0 ? 'hsl(var(--accent))' : 'hsl(var(--primary))', color: index === 0 ? 'hsl(var(--accent-foreground))' : undefined }}>{String(index + 1).padStart(2, '0')}</div><div className="job-main"><div className="job-id">{job.jobId} · {dateLabel(job.scheduledDate || job.installationDate)}</div><div className="job-name">{job.customerName}</div><div className="job-meta"><MapPin size={11} style={{ display: 'inline', verticalAlign: '-2px' }} /> {job.customerAddress || job.area || 'Location not set'} · <Phone size={11} style={{ display: 'inline', verticalAlign: '-2px' }} /> {job.customerPhone}</div></div><div className="job-side"><span className={`badge priority-${job.priority.toLowerCase()}`}>{job.priority}</span><Link href={`/jobs/${job.id}`} className="btn small" data-testid={`link-today-job-${job.id}`}>Open <ChevronRight size={13} /></Link></div></div>) : <div className="empty"><CheckCircle2 size={23} /><strong>Queue is clear</strong>There is no open work waiting in the current queue.</div>}</section>
  </div>;
}

function Contacts() {
  const jobs = useListJobs({ query: { queryKey: getListJobsQueryKey() } });
  const [search, setSearch] = useState('');
  const contacts = useMemo(() => (jobs.data || []).flatMap((job) => (job.contacts || []).map((contact) => ({ ...contact, customerName: job.customerName, jobRef: job.jobId, id: `${job.id}-${contact.id}`, jobIdNumber: job.id }))).filter((item) => !search || [item.customerName, item.jobRef, item.result, item.notes].some((value) => value?.toLowerCase().includes(search.toLowerCase()))), [jobs.data, search]);
  if (jobs.isLoading) return <div className="page"><LoadingPanel /></div>;
  if (jobs.isError) return <div className="page"><ErrorNotice onRetry={() => void jobs.refetch()} /></div>;
  return <div className="page"><div className="page-heading"><div><div className="eyebrow">Operations / contact history</div><h1 className="page-title">Contacts</h1><p className="page-subtitle">Every customer touch, searchable and tied back to its installation.</p></div><div className="actions"><Link href="/jobs" className="btn primary" data-testid="link-log-contact-jobs"><Plus size={15} /> Log from a job</Link></div></div>
    <section className="panel"><div className="toolbar"><div className="search-wrap"><Search size={16} /><input className="input search" placeholder="Search contacts or customers" value={search} onChange={(event) => setSearch(event.target.value)} data-testid="input-search-contacts" /></div><span className="muted mono" data-testid="text-contact-count">{contacts.length} touchpoints</span></div>{contacts.length ? <div className="table-wrap"><table className="table"><thead><tr><th>Date</th><th>Customer</th><th>Job</th><th>Method</th><th>Result</th><th>Notes</th><th /></tr></thead><tbody>{contacts.sort((a, b) => `${b.date}${b.time}`.localeCompare(`${a.date}${a.time}`)).map((contact) => <tr key={contact.id}><td className="mono nowrap">{contact.date}<div className="muted">{contact.time}</div></td><td><strong>{contact.customerName}</strong></td><td><Link className="table-link" href={`/jobs/${contact.jobIdNumber}`} data-testid={`link-contact-job-${contact.id}`}>{contact.jobRef}</Link></td><td><span className="badge status-confirmed">{contact.method}</span></td><td>{contact.result}</td><td className="muted">{contact.notes || '—'}</td><td><Link href={`/jobs/${contact.jobIdNumber}`} className="icon-btn" data-testid={`button-open-contact-job-${contact.id}`}><ChevronRight size={16} /></Link></td></tr>)}</tbody></table></div> : <div className="empty"><MessageCircle size={23} /><strong>No contact history yet</strong>Contact events logged from job details will appear here.</div>}</section>
  </div>;
}

function Reports() {
  const reports = useGetReports({ query: { queryKey: getGetReportsQueryKey() } });
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [notice, setNotice] = useState('');
  const exportCsv = () => {
    if (!reports.data) return;
    const rows = [['Group', 'Name', 'Count'], ...Object.entries(reports.data.byStatus).map(([key, value]) => ['Status', key, String(value)]), ...Object.entries(reports.data.byArea).map(([key, value]) => ['Area', key, String(value)])];
    const blob = new Blob([rows.map((row) => row.join(',')).join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'digs-jobtrack-report.csv'; anchor.click(); URL.revokeObjectURL(url); setNotice('Report exported.');
  };
  if (reports.isLoading) return <div className="page"><LoadingPanel /></div>;
  if (reports.isError) return <div className="page"><ErrorNotice onRetry={() => void reports.refetch()} /></div>;
  const data = reports.data;
  const max = (values: Record<string, number>) => Math.max(...Object.values(values), 1);
  const BarGroup = ({ title, values }: { title: string; values: Record<string, number> }) => <section className="panel"><div className="panel-header"><div><div className="panel-title">{title}</div><div className="panel-kicker">Count of jobs in this report</div></div></div><div className="bars">{Object.entries(values).length ? Object.entries(values).map(([name, count]) => <div className="bar-item" key={name}><div className="bar-name">{human(name)}</div><div className="bar-track"><div className="bar-fill" style={{ width: `${(count / max(values)) * 100}%` }} /></div><div className="bar-count">{count}</div></div>) : <div className="empty">No data for this group.</div>}</div></section>;
  return <div className="page"><div className="page-heading"><div><div className="eyebrow">Operations / reporting</div><h1 className="page-title">Reports</h1><p className="page-subtitle">A compact read on throughput, territory and the cost of getting there.</p></div><div className="actions"><button className="btn" onClick={() => window.print()} data-testid="button-print-report"><Printer size={15} /> Print</button><button className="btn primary" onClick={exportCsv} data-testid="button-export-report"><Download size={15} /> Export CSV</button></div></div>{notice && <div className="notice" data-testid="status-report-exported"><Check size={14} style={{ verticalAlign: '-2px', marginRight: 6 }} />{notice}</div>}
    <section className="panel" style={{ marginBottom: 15 }}><div className="toolbar" style={{ marginBottom: 0 }}><div><div className="panel-title">Report window</div><div className="panel-kicker">Filter context for your printed handover</div></div><div className="actions"><input type="date" className="input" value={from} onChange={(event) => setFrom(event.target.value)} data-testid="input-report-from" /><ArrowRight size={14} className="muted" /><input type="date" className="input" value={to} onChange={(event) => setTo(event.target.value)} data-testid="input-report-to" /></div></div></section>
    <div className="report-grid"><BarGroup title="By status" values={data?.byStatus || {}} /><BarGroup title="By area" values={data?.byArea || {}} /><BarGroup title="By agent" values={data?.byAgent || {}} /><section className="panel"><div className="panel-header"><div><div className="panel-title">Expenses</div><div className="panel-kicker">Transport and all other recorded spend</div></div></div><div className="expense-total"><div><div className="data-label" style={{ color: 'inherit', opacity: .6 }}>Total expenses</div><div className="stat-number">{currency(data?.totalExpenses)}</div></div><div><div className="data-label" style={{ color: 'inherit', opacity: .6 }}>Transport</div><div className="data-value">{currency(data?.transportExpenses)}</div></div></div></section></div>
  </div>;
}

function SettingsPage() {
  const settings = useGetSettings({ query: { queryKey: getGetSettingsQueryKey() } });
  const update = useUpdateSettings();
  const [form, setForm] = useState<Settings | null>(null);
  const [notice, setNotice] = useState('');
  const data = form || settings.data;
  const set = (key: keyof Settings, value: string) => setForm((current) => ({ ...(current || settings.data as Settings), [key]: value }));
  const setTemplate = (channel: 'smsTemplates' | 'whatsappTemplates', key: string, value: string) => setForm((current) => ({ ...(current || settings.data as Settings), [channel]: { ...((current || settings.data as Settings)[channel]), [key]: value } }));
  if (settings.isLoading) return <div className="page"><LoadingPanel /></div>;
  if (settings.isError || !data) return <div className="page"><ErrorNotice onRetry={() => void settings.refetch()} /></div>;
  const sms = Object.entries(data.smsTemplates || {});
  const whatsapp = Object.entries(data.whatsappTemplates || {});
  const save = () => update.mutate({ data: data as never }, { onSuccess: (saved) => { setForm(saved); setNotice('Settings saved.'); queryClient.setQueryData(getGetSettingsQueryKey(), saved); } });
  return <div className="page"><div className="page-heading"><div><div className="eyebrow">Personal / configuration</div><h1 className="page-title">Settings</h1><p className="page-subtitle">Keep your identity and customer message shortcuts ready for the road.</p></div><button className="btn primary" onClick={save} disabled={update.isPending} data-testid="button-save-settings"><Check size={15} /> {update.isPending ? 'Saving…' : 'Save settings'}</button></div>{notice && <div className="notice" data-testid="status-settings-saved"><Check size={14} style={{ verticalAlign: '-2px', marginRight: 6 }} />{notice}</div>}
    <div className="settings-grid"><section className="panel"><div className="panel-header"><div><div className="panel-title">Technician profile</div><div className="panel-kicker">Shown on your field workspace</div></div><span className="avatar">{initials(data.name)}</span></div><div className="form-grid"><div className="field full"><label htmlFor="settings-name">Name</label><input id="settings-name" className="input" value={data.name} onChange={(event) => set('name', event.target.value)} data-testid="input-settings-name" /></div><div className="field"><label htmlFor="settings-phone">Phone</label><input id="settings-phone" className="input" value={data.phone} onChange={(event) => set('phone', event.target.value)} data-testid="input-settings-phone" /></div><div className="field"><label htmlFor="settings-whatsapp">WhatsApp</label><input id="settings-whatsapp" className="input" value={data.whatsapp} onChange={(event) => set('whatsapp', event.target.value)} data-testid="input-settings-whatsapp" /></div><div className="field"><label htmlFor="settings-currency">Currency</label><input id="settings-currency" className="input" value={data.currency} onChange={(event) => set('currency', event.target.value)} data-testid="input-settings-currency" /></div><div className="field"><label htmlFor="settings-default-status">Default status</label><select id="settings-default-status" className="select" value={data.defaultStatus} onChange={(event) => set('defaultStatus', event.target.value)} data-testid="select-settings-status">{statuses.map((item) => <option key={item}>{item}</option>)}</select></div><div className="field"><label htmlFor="settings-default-priority">Default priority</label><select id="settings-default-priority" className="select" value={data.defaultPriority} onChange={(event) => set('defaultPriority', event.target.value)} data-testid="select-settings-priority">{priorities.map((item) => <option key={item}>{item}</option>)}</select></div></div></section>
      <section className="panel"><div className="panel-header"><div><div className="panel-title">Message templates</div><div className="panel-kicker">Edit once, use the right words on every call-back</div></div><MessageCircle size={18} className="muted" /></div><div className="eyebrow" style={{ marginBottom: 8 }}>SMS</div>{sms.length ? sms.map(([key, value]) => <div className="template-row" key={`sms-${key}`}><div className="template-key">{key}</div><textarea className="textarea" value={value} onChange={(event) => setTemplate('smsTemplates', key, event.target.value)} data-testid={`textarea-sms-template-${key}`} /></div>) : <p className="muted">No SMS templates configured.</p>}<div className="eyebrow" style={{ margin: '23px 0 8px' }}>WhatsApp</div>{whatsapp.length ? whatsapp.map(([key, value]) => <div className="template-row" key={`wa-${key}`}><div className="template-key">{key}</div><textarea className="textarea" value={value} onChange={(event) => setTemplate('whatsappTemplates', key, event.target.value)} data-testid={`textarea-whatsapp-template-${key}`} /></div>) : <p className="muted">No WhatsApp templates configured.</p>}</section>
    </div>
  </div>;
}

function Router() {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}><Switch>
    <Route path="/" component={Dashboard} />
    <Route path="/jobs" component={Jobs} />
    <Route path="/jobs/:id" component={Detail} />
    <Route path="/today" component={Today} />
    <Route path="/contacts" component={Contacts} />
    <Route path="/reports" component={Reports} />
    <Route path="/settings" component={SettingsPage} />
    <Route component={NotFound} />
  </Switch></ErrorBoundary>;
}

function App() {
  return <QueryClientProvider client={queryClient}><Shell><Router /></Shell></QueryClientProvider>;
}

export default App;