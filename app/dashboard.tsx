"use client";
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Flower2, LayoutDashboard, ArrowLeftRight, Plus, ArrowDownLeft, ArrowUpRight,
  Wallet, Search, Download, X, Pencil, Trash2, RefreshCw, CloudCheck,
  Leaf, Check, Sun, Sunrise, Moon, ChevronRight, BarChart3
} from 'lucide-react';
import {
  Movement, categories, payments, today, range, totals, dateValid, inRange, chartBuckets
} from '../lib/ledger';

/* ── Helpers ── */
const money = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: n % 100 ? 2 : 0 }).format(n / 100);

const dateLabel = (d: string) =>
  new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'short' }).format(new Date(d + 'T12:00:00'));

const fullDate = (d: string) =>
  new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(d + 'T12:00:00'));

const timeLabel = (iso: string) => {
  try {
    return new Intl.DateTimeFormat('es-AR', {
      hour: '2-digit', minute: '2-digit', timeZone: 'America/Argentina/Buenos_Aires'
    }).format(new Date(iso));
  } catch { return ''; }
};

function greetingInfo() {
  const h = new Date().getHours();
  if (h < 7 || h >= 20) return { text: 'Buenas noches', Icon: Moon };
  if (h < 12) return { text: 'Buenos días', Icon: Sunrise };
  return { text: 'Buenas tardes', Icon: Sun };
}

/* ── Dashboard ── */
export default function Dashboard() {
  /* State */
  const [rows, setRows] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [auth, setAuth] = useState(false);
  const [view, setView] = useState('Inicio');
  const [period, setPeriod] = useState('month');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<Movement | null>(null);
  const [kind, setKind] = useState<'income' | 'expense'>('income');
  const [category, setCategory] = useState(categories.income[0]);
  const [dates, setDates] = useState<[string, string]>(() => range('month', today()));
  const [from, setFrom] = useState(() => range('month', today())[0]);
  const [to, setTo] = useState(() => range('month', today())[1]);
  const [dateError, setDateError] = useState('');
  const [subView, setSubView] = useState<'detalle' | 'estadisticas'>('detalle');

  const dialog = useRef<HTMLDialogElement>(null);
  const form = useRef<HTMLFormElement>(null);

  /* Data loading */
  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/movements', { cache: 'no-store' });
      const data = await r.json() as Movement[] & { error: string };
      setAuth(r.status === 401);
      if (!r.ok) throw new Error(data.error);
      setRows(data);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No pudimos conectar. Revisá tu conexión.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000);
    const focus = () => { if (document.visibilityState === 'visible') load(); };
    document.addEventListener('visibilitychange', focus);
    return () => { clearInterval(interval); document.removeEventListener('visibilitychange', focus); };
  }, [load]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(''), 4000);
    return () => clearTimeout(t);
  }, [notice]);

  /* Computed — today */
  const todayStr = today();
  const todayRows = rows
    .filter(r => r.date === todayStr)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const todaySum = totals(todayRows);

  /* Computed — selected period */
  const [start, end] = dates;
  const selected = inRange(rows, start, end);
  const sum = totals(selected);
  const visible = selected.filter(r =>
    (filter === 'all' || r.type === filter) &&
    [r.description, r.category, r.payment].join(' ').toLocaleLowerCase().includes(search.toLocaleLowerCase())
  );
  const periodName = fullDate(start) + ' al ' + fullDate(end);
  const chart = chartBuckets(selected, start, end);
  const max = Math.max(100, ...chart.flatMap(b => [b.income, b.expense]));
  const groups = categories.expense
    .map(name => ({
      name,
      value: selected.filter(r => r.type === 'expense' && r.category === name).reduce((s, r) => s + r.amount, 0)
    }))
    .filter(g => g.value)
    .sort((a, b) => b.value - a.value);

  /* Navigation */
  function navigate(next: string) {
    setView(next);
    setEditing(null);
    setKind('income');
    setCategory(categories.income[0]);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* Date range */
  function applyDates(e: React.FormEvent) {
    e.preventDefault();
    if (!dateValid(from) || !dateValid(to) || from > to) {
      setDateError('Elegí una fecha final igual o posterior a la inicial.');
      return;
    }
    setDates([from, to]);
    setPeriod('custom');
    setDateError('');
  }

  function preset(value: string) {
    const next = range(value, today());
    setDates(next);
    setFrom(next[0]);
    setTo(next[1]);
    setPeriod(value);
    setDateError('');
  }

  /* Dialog */
  function openForm(type: 'income' | 'expense', row?: Movement) {
    setEditing(row || null);
    setKind(row?.type || type);
    setCategory(row?.category || categories[type][0]);
    form.current?.reset();
    dialog.current?.showModal();
  }

  /* Save */
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    try {
      const r = await fetch('/api/movements', {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editing?.id,
          type: kind,
          amount: Math.round(Number(f.get('amount')) * 100),
          description: f.get('description'),
          date: f.get('date'),
          category,
          payment: f.get('payment')
        })
      });
      const data = await r.json() as Movement & { error: string };
      if (!r.ok) throw new Error(data.error);
      setRows(prev => [...prev.filter(x => x.id !== data.id), data]
        .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)));
      dialog.current?.close();
      form.current?.reset();
      setNotice(editing ? 'Movimiento actualizado' : 'Movimiento guardado');
      setError('');
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'No se pudo guardar. Revisá tu conexión.');
    } finally {
      setBusy(false);
    }
  }

  /* Delete */
  async function remove(row: Movement) {
    if (!confirm('¿Eliminar "' + row.description + '"? Esta acción no se puede deshacer.')) return;
    setBusy(true);
    try {
      const r = await fetch('/api/movements', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: row.id })
      });
      if (!r.ok) throw new Error((await r.json() as { error: string }).error);
      setRows(v => v.filter(x => x.id !== row.id));
      setNotice('Movimiento eliminado');
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'No se pudo eliminar.');
    } finally {
      setBusy(false);
    }
  }

  /* CSV export */
  function exportCsv() {
    const cell = (v: unknown) => '"' + String(v).replace(/^[=+@-]/, "'$&").replaceAll('"', '""') + '"';
    const csv = [
      ['Fecha', 'Tipo', 'Detalle', 'Categoría', 'Medio de pago', 'Monto ARS'],
      ...visible.map(r => [
        r.date,
        r.type === 'income' ? 'Ingreso' : 'Egreso',
        r.description, r.category, r.payment,
        (r.amount / 100).toFixed(2).replace('.', ',')
      ])
    ].map(line => line.map(cell).join(';')).join('\r\n');
    const url = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'uno-movimientos-' + start + '-' + end + '.csv';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  /* Greeting */
  const greeting = greetingInfo();
  const todayFull = new Intl.DateTimeFormat('es-AR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    timeZone: 'America/Argentina/Buenos_Aires'
  }).format(new Date());

  /* ── Movement form (reused in dialog) ── */
  const movementFormContent = (
    <form ref={form} key={editing?.id || 'new'} onSubmit={save}>
      <div className="modalhead">
        <div>
          <p className="eyebrow">REGISTRO DE CAJA</p>
          <h2>{editing ? 'Editar movimiento' : 'Nuevo movimiento'}</h2>
        </div>
        <button type="button" aria-label="Cerrar" disabled={busy} onClick={() => dialog.current?.close()}>
          <X />
        </button>
      </div>
      <fieldset disabled={busy || loading || auth || !!error} className="movement-fields">
        <div className="typepicker">
          {(['income', 'expense'] as const).map(t => (
            <button
              type="button" key={t}
              className={kind === t ? 'chosen ' + t : ''}
              onClick={() => { setKind(t); setCategory(categories[t][0]); }}
            >
              {t === 'income' ? <ArrowDownLeft size={18} /> : <ArrowUpRight size={18} />}
              {t === 'income' ? 'Ingreso' : 'Egreso'}
            </button>
          ))}
        </div>
        <label>Monto (ARS)
          <input
            autoFocus name="amount" type="number" min=".01" max="1000000000" step=".01"
            required placeholder="0,00" defaultValue={editing ? editing.amount / 100 : undefined}
            className="amountinput"
          />
        </label>
        <label>Detalle
          <input
            name="description" required maxLength={160}
            placeholder={kind === 'income' ? 'Ej. Ramo de flores para regalo' : 'Ej. Compra de flores frescas'}
            defaultValue={editing?.description}
          />
        </label>
        <div className="formgrid">
          <label>Fecha
            <input type="date" name="date" required defaultValue={editing?.date || today()} />
          </label>
          <label>Categoría
            <select value={category} onChange={e => setCategory(e.target.value)}>
              {categories[kind].map(c => <option key={c}>{c}</option>)}
            </select>
          </label>
        </div>
        <label>Medio de pago
          <select name="payment" defaultValue={editing?.payment || payments[0]}>
            {payments.map(p => <option key={p}>{p}</option>)}
          </select>
        </label>
        <p className="modalnote"><CloudCheck size={15} /> Se guarda al instante.</p>
        <button type="submit" disabled={busy} className="primary save">
          {busy ? 'Guardando…' : editing ? 'Guardar cambios' : 'Guardar movimiento'}
          <Check size={18} />
        </button>
      </fieldset>
    </form>
  );

  /* ══════════════════ RENDER ══════════════════ */
  return (
    <div className="shell">
      {/* ── Sidebar ── */}
      <aside className="sidebar">
        <a className="brand" href="/">
          <span>uno<span className="brandplus">+</span></span>
          <small>FLORERÍA</small>
        </a>
        <div className="workspace">
          <span className="shopmark"><Flower2 size={20} /></span>
          <div>Mi florería<small>Control de caja</small></div>
        </div>
        <p className="navcaption">MENÚ</p>
        <nav>
          {([[LayoutDashboard, 'Inicio'], [ArrowLeftRight, 'Movimientos']] as const).map(([Icon, label]) => (
            <button
              key={label}
              className={view === label ? 'active' : ''}
              aria-current={view === label ? 'page' : undefined}
              onClick={() => navigate(label)}
            >
              <Icon size={19} />{label}
            </button>
          ))}
        </nav>
      </aside>

      {/* ── Main ── */}
      <main>
        <header>
          <div className="breadcrumb">Mi florería <span>/</span> <b>{view}</b></div>
          <span className="connected">
            <CloudCheck size={16} />{loading ? 'Conectando…' : error ? 'Sin conexión' : 'Datos sincronizados'}
          </span>
        </header>

        <div className="content">
          {/* Error bar */}
          {error && (
            <div role="alert" className="error">
              {error}{' '}
              {auth
                ? <a href="/signin-with-chatgpt?return_to=/" target="_top">Iniciar sesión</a>
                : <button onClick={load}>Reintentar</button>
              }
            </div>
          )}

          {/* ═══════════ HOME ═══════════ */}
          {view === 'Inicio' && (
            <div className="home-view" key="home">
              {/* Hero Banner with direct action */}
              <section className="hero anim-fade-in">
                <div className="hero-content">
                  <div className="hero-greeting">
                    <span className="hero-icon"><greeting.Icon size={18} /></span>
                    <span>{greeting.text}</span>
                    <span className="hero-dot">·</span>
                    <span className="hero-date">{todayFull}</span>
                  </div>
                  <h1>Resumen del día</h1>
                  <p>Estado de caja y movimientos de la florería</p>
                </div>
                <button
                  className="primary hero-add-btn"
                  disabled={auth || loading || !!error}
                  onClick={() => openForm('income')}
                >
                  <Plus size={20} />
                  <span>Nuevo movimiento</span>
                </button>
              </section>

              {/* Today stats */}
              <section className="today-stats">
                <article className="stat-card income-card anim-card" style={{ '--delay': '0.08s' } as React.CSSProperties}>
                  <div className="stat-head">
                    <span className="stat-label">Ingresos hoy</span>
                    <span className="stat-icon green"><ArrowDownLeft size={18} /></span>
                  </div>
                  <strong className="stat-value">{loading || error ? '—' : money(todaySum.income)}</strong>
                  <span className="stat-sub">{todayRows.filter(r => r.type === 'income').length} ventas registradas</span>
                </article>

                <article className="stat-card expense-card anim-card" style={{ '--delay': '0.14s' } as React.CSSProperties}>
                  <div className="stat-head">
                    <span className="stat-label">Egresos hoy</span>
                    <span className="stat-icon rose"><ArrowUpRight size={18} /></span>
                  </div>
                  <strong className="stat-value">{loading || error ? '—' : money(todaySum.expense)}</strong>
                  <span className="stat-sub">{todayRows.filter(r => r.type === 'expense').length} gastos registrados</span>
                </article>

                <article className="stat-card balance-card anim-card" style={{ '--delay': '0.2s' } as React.CSSProperties}>
                  <div className="stat-head">
                    <span className="stat-label">Saldo del día</span>
                    <span className="stat-icon amber"><Wallet size={18} /></span>
                  </div>
                  <strong className={'stat-value ' + (todaySum.balance >= 0 ? 'pos' : 'neg')}>
                    {loading || error ? '—' : money(todaySum.balance)}
                  </strong>
                  <span className="stat-sub">Ingresos menos egresos</span>
                </article>
              </section>

              {/* Today's movements */}
              <section className="today-section anim-card" style={{ '--delay': '0.26s' } as React.CSSProperties}>
                <div className="section-header">
                  <div>
                    <h2>Movimientos de hoy</h2>
                    <p className="section-sub">Registros cargados en la jornada</p>
                  </div>
                  <button className="link-btn" onClick={() => navigate('Movimientos')}>
                    Ver historial completo <ChevronRight size={15} />
                  </button>
                </div>
                {todayRows.length ? (
                  <div className="today-list">
                    {todayRows.map(r => (
                      <div className={'today-item item-' + r.type} key={r.id}>
                        <span className={'item-icon ' + (r.type === 'income' ? 'green' : 'rose')}>
                          {r.type === 'income' ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
                        </span>
                        <div className="item-info">
                          <b>{r.description}</b>
                          <small>
                            <span className={'tag cat-' + r.category.toLowerCase().replace(/[^a-z0-9]/g, '')}>{r.category}</span>
                            <span className="bullet">·</span>
                            {r.payment}
                          </small>
                        </div>
                        <div className="item-right">
                          <span className={'item-amount ' + r.type}>
                            {r.type === 'income' ? '+' : '−'} {money(r.amount)}
                          </span>
                          <small>{timeLabel(r.createdAt)}</small>
                        </div>
                        <div className="item-actions">
                          <button aria-label={'Editar ' + r.description} disabled={busy} onClick={() => openForm(r.type, r)}>
                            <Pencil size={14} />
                          </button>
                          <button aria-label={'Eliminar ' + r.description} disabled={busy} onClick={() => remove(r)}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="today-empty">
                    <div className="empty-bloom"><Flower2 size={32} /></div>
                    <h3>Todavía no hay movimientos hoy</h3>
                    <p>
                      {loading
                        ? 'Obteniendo datos…'
                        : error
                          ? 'Conectá para ver tus movimientos.'
                          : 'Hacé clic en "+ Nuevo movimiento" para registrar la primera venta o gasto del día.'
                      }
                    </p>
                  </div>
                )}
              </section>
            </div>
          )}

          {/* ═══════════ MOVIMIENTOS ═══════════ */}
          {view === 'Movimientos' && (
            <div className="ledger-view" key="ledger">
              {/* Page heading */}
              <section className="page-heading anim-fade-in">
                <div>
                  <p className="eyebrow">HISTORIAL Y BALANCE</p>
                  <h1>Movimientos</h1>
                  <p>Consultá, filtrá y analizá los números de tu negocio.</p>
                </div>
                <button className="primary" disabled={auth || loading || !!error} onClick={() => openForm('income')}>
                  <Plus size={18} /> Nuevo movimiento
                </button>
              </section>

              {/* Date range selector */}
              <section className="panel date-panel anim-card" style={{ '--delay': '0.08s' } as React.CSSProperties}>
                <div className="date-panel-heading">
                  <div>
                    <h2>Período a consultar</h2>
                    <p>Elegí un rango para ver resumen y estadísticas</p>
                  </div>
                  <div className="segments">
                    {[['day', 'Hoy'], ['week', 'Semana'], ['month', 'Mes'], ['year', 'Año']].map(([value, label]) => (
                      <button className={period === value ? 'selected' : ''} onClick={() => preset(value)} key={value}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <form className="date-range-form" onSubmit={applyDates}>
                  <label>Desde
                    <input type="date" required min="1900-01-01" max="2100-12-31" value={from}
                      onInput={e => setFrom(e.currentTarget.value)} onChange={e => setFrom(e.target.value)} />
                  </label>
                  <span className="range-arrow">→</span>
                  <label>Hasta
                    <input type="date" required min="1900-01-01" max="2100-12-31" value={to}
                      onInput={e => setTo(e.currentTarget.value)} onChange={e => setTo(e.target.value)} />
                  </label>
                  <button className="primary" type="submit">Aplicar fechas</button>
                </form>
                {dateError && <p role="alert" className="range-error">{dateError}</p>}
                <p className="applied-range">Mostrando período: <b>{periodName}</b></p>
              </section>

              {/* Summary cards */}
              <section className="cards anim-card" style={{ '--delay': '0.14s' } as React.CSSProperties}>
                <article className="metric income-card">
                  <div className="metrichead">
                    <span>Ingresos</span>
                    <span className="iconbox green"><ArrowDownLeft size={20} /></span>
                  </div>
                  <strong>{loading || error ? '—' : money(sum.income)}</strong>
                  <small><span className="dot green-dot" /> {selected.filter(r => r.type === 'income').length} ventas</small>
                </article>
                <article className="metric expense-card">
                  <div className="metrichead">
                    <span>Egresos</span>
                    <span className="iconbox pink"><ArrowUpRight size={20} /></span>
                  </div>
                  <strong>{loading || error ? '—' : money(sum.expense)}</strong>
                  <small><span className="dot pink-dot" /> {selected.filter(r => r.type === 'expense').length} gastos</small>
                </article>
                <article className="metric balance-card">
                  <div className="metrichead">
                    <span>Saldo del período</span>
                    <span className="iconbox amber"><Wallet size={20} /></span>
                  </div>
                  <strong>{loading || error ? '—' : money(sum.balance)}</strong>
                  <small>Ingresos menos egresos</small>
                </article>
              </section>

              {/* Sub-tabs */}
              <div className="sub-tabs anim-card" style={{ '--delay': '0.18s' } as React.CSSProperties}>
                <button className={subView === 'detalle' ? 'active' : ''} onClick={() => setSubView('detalle')}>
                  <ArrowLeftRight size={16} /> Detalle de movimientos
                </button>
                <button className={subView === 'estadisticas' ? 'active' : ''} onClick={() => setSubView('estadisticas')}>
                  <BarChart3 size={16} /> Estadísticas y gráficos
                </button>
              </div>

              {/* ── Detail tab ── */}
              {subView === 'detalle' && (
                <section className="panel movements anim-fade-in">
                  <div className="panel-title">
                    <div>
                      <h2>Listado de movimientos <span className="count">{selected.length}</span></h2>
                      <p>Detalle de cada venta y gasto registrado</p>
                    </div>
                    <button className="outline" disabled={!visible.length} onClick={exportCsv}>
                      <Download size={16} /> Exportar CSV
                    </button>
                  </div>
                  <div className="tablefilters">
                    <label className="search">
                      <Search size={17} />
                      <input placeholder="Buscar por detalle, categoría o pago…" aria-label="Buscar movimiento"
                        value={search} onChange={e => setSearch(e.target.value)} />
                    </label>
                    <select aria-label="Filtrar tipo" value={filter} onChange={e => setFilter(e.target.value)}>
                      <option value="all">Todos los tipos</option>
                      <option value="income">Solo ingresos</option>
                      <option value="expense">Solo egresos</option>
                    </select>
                    <button className="iconbutton" aria-label="Actualizar movimientos" onClick={load}>
                      <RefreshCw size={17} />
                    </button>
                  </div>
                  <div className="tablewrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Movimiento</th><th>Fecha</th><th>Categoría</th>
                          <th>Medio de pago</th><th className="right">Monto</th>
                          <th><span className="sr-only">Acciones</span></th>
                        </tr>
                      </thead>
                      <tbody>
                        {visible.map(r => (
                          <tr key={r.id}>
                            <td>
                              <div className="movementname">
                                <span className={'iconbox ' + (r.type === 'income' ? 'green' : 'pink')}>
                                  {r.type === 'income' ? <ArrowDownLeft size={17} /> : <ArrowUpRight size={17} />}
                                </span>
                                <div>
                                  <b>{r.description}</b>
                                  <small>{r.type === 'income' ? 'Ingreso' : 'Egreso'}</small>
                                </div>
                              </div>
                            </td>
                            <td>{dateLabel(r.date)}</td>
                            <td>
                              <span className={'tag cat-' + r.category.toLowerCase().replace(/[^a-z0-9]/g, '')}>
                                {r.category}
                              </span>
                            </td>
                            <td>{r.payment}</td>
                            <td className={'right amount ' + r.type}>
                              {r.type === 'income' ? '+' : '−'} {money(r.amount)}
                            </td>
                            <td>
                              <div className="rowactions">
                                <button aria-label={'Editar ' + r.description} disabled={busy} onClick={() => openForm(r.type, r)}>
                                  <Pencil size={15} />
                                </button>
                                <button aria-label={'Eliminar ' + r.description} disabled={busy} onClick={() => remove(r)}>
                                  <Trash2 size={15} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {!visible.length && (
                    <div className="empty">
                      <span className="emptyicon"><Flower2 size={28} strokeWidth={1.3} /></span>
                      <h3>
                        {loading ? 'Cargando…'
                          : error ? 'Conectá para ver tus cuentas'
                          : search || filter !== 'all' ? 'No encontramos coincidencias'
                          : 'Sin movimientos en este período'}
                      </h3>
                      <p>
                        {search || filter !== 'all'
                          ? 'Probá ajustando el buscador o el filtro de tipo.'
                          : 'Cargá tu primer movimiento para comenzar.'}
                      </p>
                    </div>
                  )}
                  <div className="tablefooter">
                    <span>{visible.length} movimientos · {dateLabel(start)} al {dateLabel(end)}</span>
                    <span>Moneda: pesos argentinos (ARS)</span>
                  </div>
                </section>
              )}

              {/* ── Stats tab ── */}
              {subView === 'estadisticas' && (
                <div className="stats-section">
                  {/* Chart */}
                  <article className="panel chartpanel">
                    <div className="panel-title">
                      <div>
                        <h2>Evolución de ingresos y egresos</h2>
                        <p>{chart.length && chart[0].start !== chart[0].end ? 'Agrupados por intervalos' : 'Día por día'}</p>
                      </div>
                      <div className="legend">
                        <span><i className="green-dot" />Ingresos</span>
                        <span><i className="pink-dot" />Egresos</span>
                      </div>
                    </div>
                    <div className="chart" aria-label="Gráfico de ingresos y egresos">
                      <div className="gridlines">
                        <span>{money(max)}</span>
                        <span>{money(max / 2)}</span>
                        <span>$ 0</span>
                      </div>
                      <div className="bars">
                        {chart.map((b, i) => (
                          <div className="barcolumn" key={b.key}
                            title={b.start + ' al ' + b.end + ' · Ingresos: ' + money(b.income) + ' · Egresos: ' + money(b.expense)}>
                            <div className="barpair">
                              <div style={{ height: (b.income / max * 100) + '%' }} className="bar income" />
                              <div style={{ height: (b.expense / max * 100) + '%' }} className="bar expense" />
                            </div>
                            <small>
                              {chart.length <= 12 || i % Math.max(1, Math.ceil(chart.length / 6)) === 0 || i === chart.length - 1
                                ? b.label : ''}
                            </small>
                          </div>
                        ))}
                      </div>
                      {!selected.length && (
                        <div className="chartempty">
                          <Leaf size={22} />
                          <span>Sin datos en estas fechas</span>
                        </div>
                      )}
                    </div>
                  </article>

                  {/* Expenses + Insights */}
                  <div className="stats-grid">
                    <article className="panel expensespanel">
                      <h2>Gastos por categoría</h2>
                      <p>Distribución de egresos</p>
                      {groups.length ? (
                        <div className="categorylist">
                          {groups.map(g => (
                            <div key={g.name}>
                              <div><span>{g.name}</span><b>{money(g.value)}</b></div>
                              <div className="track"><i style={{ width: g.value / sum.expense * 100 + '%' }} /></div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="categoryempty">
                          <div className="emptyring"><Flower2 size={35} strokeWidth={1} /></div>
                          <b>Sin egresos registrados</b>
                          <small>Acá verás en qué se dividen tus gastos.</small>
                        </div>
                      )}
                    </article>

                    <article className="panel insights-panel">
                      <h2>Detalle financiero</h2>
                      <div className="insights-grid">
                        <div className="insight-item">
                          <span>Venta promedio</span>
                          <strong>{money(sum.income / (selected.filter(r => r.type === 'income').length || 1))}</strong>
                        </div>
                        {payments.map(p => (
                          <div className="insight-item" key={p}>
                            <span>Saldo · {p}</span>
                            <strong>{money(totals(selected.filter(r => r.payment === p)).balance)}</strong>
                          </div>
                        ))}
                      </div>
                    </article>
                  </div>
                </div>
              )}
            </div>
          )}

          <footer className="pagefooter"><Flower2 size={15} /> uno+ · Florería</footer>
        </div>
      </main>

      {/* Dialog */}
      <dialog ref={dialog} onCancel={e => { if (busy) e.preventDefault(); }}>
        {movementFormContent}
      </dialog>

      {/* Toast */}
      {notice && <div role="status" className="toast">{notice}</div>}
    </div>
  );
}
