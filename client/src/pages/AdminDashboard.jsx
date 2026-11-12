import React, { useState, useEffect, useContext, useMemo } from 'react';
import { AuthContext } from '../context/AuthContext';
import api from '../utils/axios';
import { useNavigate } from 'react-router-dom';

/* ---------- small helpers (UI only) ---------- */
const EMPTY_FORM = { title: '', description: '', date: '', location: '', category: '', totalSeats: '', ticketPrice: '', image: '' };
const money = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
const monthKey = (d) => { const x = new Date(d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}`; };
const monthLabel = (k) => new Date(`${k}-01`).toLocaleDateString('en-IN', { month: 'short' });
const lastMonths = (n = 6) => {
    const out = []; const now = new Date();
    for (let i = n - 1; i >= 0; i--) { const d = new Date(now.getFullYear(), now.getMonth() - i, 1); out.push(monthKey(d)); }
    return out;
};

const Icon = ({ d, className = 'w-5 h-5' }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
);
const ICONS = {
    grid: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
    cal: 'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z',
    plus: 'M12 5v14M5 12h14',
    ticket: 'M3 9a2 2 0 0 0 0 6v3h18v-3a2 2 0 0 1 0-6V6H3zM13 6v12',
    out: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
    menu: 'M3 6h18M3 12h18M3 18h18',
    search: 'M21 21l-4.3-4.3M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14z',
    chev: 'M15 18l-6-6 6-6',
    x: 'M18 6L6 18M6 6l12 12',
    rupee: 'M6 4h12M6 9h12M9 4c6 0 6 9 0 9H6l8 7',
    seat: 'M5 11V7a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v4M3 15a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v3H3z',
    clock: 'M12 7v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z',
    users: 'M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2M10 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
    eye: 'M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
    trash: 'M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6',
};

const Skeleton = ({ className = '' }) => <div className={`animate-pulse rounded-lg bg-slate-200/70 ${className}`} />;

const Badge = ({ tone = 'slate', children }) => {
    const tones = {
        green: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
        amber: 'bg-amber-50 text-amber-700 ring-amber-600/20',
        red: 'bg-rose-50 text-rose-700 ring-rose-600/20',
        indigo: 'bg-indigo-50 text-indigo-700 ring-indigo-600/20',
        slate: 'bg-slate-100 text-slate-700 ring-slate-500/20',
    };
    return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ring-1 ring-inset ${tones[tone]}`}>{children}</span>;
};
const statusTone = (s) => (s === 'confirmed' ? 'green' : s === 'cancelled' ? 'red' : 'amber');

const EmptyState = ({ title, hint }) => (
    <div className="flex flex-col items-center justify-center text-center py-10 px-4">
        <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mb-3"><Icon d={ICONS.grid} /></div>
        <p className="text-sm font-semibold text-slate-700">{title}</p>
        {hint && <p className="text-xs text-slate-500 mt-1 max-w-xs">{hint}</p>}
    </div>
);

/* ---------- charts (pure SVG/CSS, no dependencies) ---------- */
const BarChart = ({ data, format = (v) => v, color = 'bg-teal-600' }) => {
    const max = Math.max(...data.map((d) => d.value), 0);
    if (!max) return <EmptyState title="No data yet" hint="This chart fills in as records are created." />;
    return (
        <div className="flex items-end gap-3 h-44 pt-2">
            {data.map((d) => (
                <div key={d.label} className="flex-1 flex flex-col items-center justify-end h-full group">
                    <span className="text-[11px] font-semibold text-slate-600 mb-1 opacity-0 group-hover:opacity-100 transition-opacity">{format(d.value)}</span>
                    <div className={`w-full max-w-[40px] rounded-t-md ${color} chart-grow`} style={{ height: `${Math.max((d.value / max) * 100, d.value ? 4 : 0)}%` }} />
                    <span className="text-xs text-slate-500 mt-2">{d.label}</span>
                </div>
            ))}
        </div>
    );
};

const HBars = ({ data }) => {
    const total = data.reduce((s, d) => s + d.value, 0);
    if (!total) return <EmptyState title="No data yet" />;
    return (
        <ul className="space-y-3">
            {data.map((d) => (
                <li key={d.label}>
                    <div className="flex justify-between text-sm mb-1"><span className="font-medium text-slate-700 capitalize">{d.label}</span><span className="text-slate-500">{d.value} · {Math.round((d.value / total) * 100)}%</span></div>
                    <div className="h-2 rounded-full bg-slate-100 overflow-hidden"><div className="h-full rounded-full chart-grow-x" style={{ width: `${(d.value / total) * 100}%`, background: d.color }} /></div>
                </li>
            ))}
        </ul>
    );
};

const Card = ({ title, subtitle, children, className = '' }) => (
    <section className={`bg-white rounded-xl border border-slate-200 shadow-sm ${className}`}>
        {title && <header className="px-5 pt-5"><h3 className="font-semibold text-slate-900">{title}</h3>{subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}</header>}
        <div className="p-5">{children}</div>
    </section>
);

const StatCard = ({ label, value, icon, tone }) => (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex items-center justify-between transition hover:-translate-y-0.5 hover:shadow-md">
        <div><p className="text-sm text-slate-500">{label}</p><p className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">{value}</p></div>
        <div className={`w-11 h-11 rounded-lg flex items-center justify-center ${tone}`}><Icon d={icon} /></div>
    </div>
);

/* ---------- main component ---------- */
const AdminDashboard = () => {
    const { user, logout } = useContext(AuthContext) || {};
    const navigate = useNavigate();
    const [events, setEvents] = useState([]);
    const [bookings, setBookings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [formData, setFormData] = useState(EMPTY_FORM);

    // UI-only state
    const [section, setSection] = useState('overview');
    const [collapsed, setCollapsed] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [toast, setToast] = useState(null);
    const [errors, setErrors] = useState({});
    const [eventQuery, setEventQuery] = useState('');
    const [eventSort, setEventSort] = useState('date-asc');
    const [eventPage, setEventPage] = useState(1);
    const [bookingQuery, setBookingQuery] = useState('');
    const [bookingStatus, setBookingStatus] = useState('all');
    const [bookingSort, setBookingSort] = useState('newest');
    const [detail, setDetail] = useState(null); // { type: 'event' | 'booking', item }
    const [confirmDelete, setConfirmDelete] = useState(null);
    const PAGE_SIZE = 8;

    useEffect(() => {
        if (!user || user.role !== 'admin') { navigate('/login'); return; }
        fetchData();
    }, [user, navigate]);

    useEffect(() => { if (toast) { const t = setTimeout(() => setToast(null), 3500); return () => clearTimeout(t); } }, [toast]);

    const fetchData = async () => {
        try {
            const [eventsRes, bookingsRes] = await Promise.all([
                api.get('/events'),
                api.get('/bookings/my') // Admin gets all bookings
            ]);
            setEvents(eventsRes.data);
            setBookings(bookingsRes.data);
        } catch (error) {
            console.error('Error fetching admin data', error);
        } finally {
            setLoading(false);
        }
    };

    /* Existing create logic, unchanged apart from loading/toast feedback */
    const handleCreateEvent = async (e) => {
        e.preventDefault();
        const errs = {};
        if (!formData.title.trim()) errs.title = 'Enter an event title.';
        if (!formData.category.trim()) errs.category = 'Enter a category.';
        if (!formData.date) errs.date = 'Choose a date.';
        if (!formData.location.trim()) errs.location = 'Enter a location.';
        if (!(Number(formData.totalSeats) > 0)) errs.totalSeats = 'Seats must be at least 1.';
        if (formData.ticketPrice === '' || Number(formData.ticketPrice) < 0) errs.ticketPrice = 'Enter 0 for a free event.';
        if (!formData.description.trim()) errs.description = 'Add a short description.';
        setErrors(errs);
        if (Object.keys(errs).length) return;

        setSubmitting(true);
        try {
            const eventData = { ...formData, totalSeats: Number(formData.totalSeats), ticketPrice: Number(formData.ticketPrice) };
            await api.post('/events', eventData);
            setToast({ type: 'success', text: 'Event published.' });
            setFormData(EMPTY_FORM);
            setSection('events');
            fetchData();
        } catch (error) {
            console.error('Create Event Error:', error.response?.data || error);
            setToast({ type: 'error', text: error.response?.data?.message || error.response?.data?.error || 'Could not publish the event. Check the details and try again.' });
        } finally {
            setSubmitting(false);
        }
    };

    /* ------------------------------------------------------------------
       NOTE: handleDeleteEvent, handleConfirmBooking and handleCancelBooking
       were called in your file but never defined in the code you sent.
       If they exist in your real file, DELETE this block and keep yours.
       Endpoints below are assumptions — match them to your backend.
       ------------------------------------------------------------------ */
    const handleDeleteEvent = async (id) => {
        try { await api.delete(`/events/${id}`); setToast({ type: 'success', text: 'Event deleted.' }); fetchData(); }
        catch (error) { setToast({ type: 'error', text: error.response?.data?.message || 'Could not delete the event.' }); }
    };
    const handleConfirmBooking = async (id, paymentStatus) => {
        try { await api.put(`/bookings/${id}/confirm`, { paymentStatus }); setToast({ type: 'success', text: 'Booking approved.' }); fetchData(); }
        catch (error) { setToast({ type: 'error', text: error.response?.data?.message || 'Could not approve the booking.' }); }
    };
    const handleCancelBooking = async (id) => {
        try { await api.put(`/bookings/${id}/cancel`); setToast({ type: 'success', text: 'Booking rejected.' }); fetchData(); }
        catch (error) { setToast({ type: 'error', text: error.response?.data?.message || 'Could not reject the booking.' }); }
    };
    /* ---------------------------- end of block ---------------------------- */

    /* ---------- derived analytics (real data only) ---------- */
    const stats = useMemo(() => {
        const now = new Date();
        const paid = bookings.filter((b) => b.paymentStatus === 'paid' && b.status === 'confirmed');
        const months = lastMonths(6);
        const countBy = (list, field) => months.map((m) => ({ label: monthLabel(m), value: list.filter((x) => x[field] && monthKey(x[field]) === m).length }));
        const revenueByMonth = months.map((m) => ({ label: monthLabel(m), value: paid.filter((b) => b.bookedAt && monthKey(b.bookedAt) === m).reduce((s, b) => s + (b.amount || 0), 0) }));
        const cats = {};
        events.forEach((e) => { const c = e.category || 'Uncategorised'; cats[c] = (cats[c] || 0) + 1; });
        const palette = ['#0f766e', '#4f46e5', '#d97706', '#be123c', '#475569', '#0284c7'];
        return {
            revenue: paid.reduce((s, b) => s + (b.amount || 0), 0),
            clients: new Set(paid.map((b) => b.userId?._id)).size,
            pending: bookings.filter((b) => b.status === 'pending').length,
            upcoming: events.filter((e) => new Date(e.date) >= now).length,
            availableSeats: events.reduce((s, e) => s + (e.availableSeats || 0), 0),
            users: new Set(bookings.map((b) => b.userId?._id).filter(Boolean)).size,
            hasEventDates: events.some((e) => e.createdAt),
            eventTrend: countBy(events, 'createdAt'),
            bookingTrend: countBy(bookings, 'bookedAt'),
            revenueTrend: revenueByMonth,
            categories: Object.entries(cats).map(([label, value], i) => ({ label, value, color: palette[i % palette.length] })),
            statuses: [
                { label: 'confirmed', value: bookings.filter((b) => b.status === 'confirmed').length, color: '#0f766e' },
                { label: 'pending', value: bookings.filter((b) => b.status === 'pending').length, color: '#d97706' },
                { label: 'cancelled', value: bookings.filter((b) => b.status === 'cancelled').length, color: '#be123c' },
            ],
        };
    }, [events, bookings]);

    const filteredEvents = useMemo(() => {
        const q = eventQuery.toLowerCase();
        const list = events.filter((e) => [e.title, e.category, e.location].some((v) => (v || '').toLowerCase().includes(q)));
        const sorters = {
            'date-asc': (a, b) => new Date(a.date) - new Date(b.date),
            'date-desc': (a, b) => new Date(b.date) - new Date(a.date),
            title: (a, b) => (a.title || '').localeCompare(b.title || ''),
            price: (a, b) => (b.ticketPrice || 0) - (a.ticketPrice || 0),
        };
        return [...list].sort(sorters[eventSort]);
    }, [events, eventQuery, eventSort]);
    const eventPages = Math.max(1, Math.ceil(filteredEvents.length / PAGE_SIZE));
    const pagedEvents = filteredEvents.slice((eventPage - 1) * PAGE_SIZE, eventPage * PAGE_SIZE);

    const filteredBookings = useMemo(() => {
        const q = bookingQuery.toLowerCase();
        const list = bookings.filter((b) =>
            (bookingStatus === 'all' || b.status === bookingStatus) &&
            [b._id, b.userId?.name, b.userId?.email, b.eventId?.title].some((v) => (v || '').toLowerCase().includes(q)));
        return [...list].sort((a, b) => (bookingSort === 'newest' ? new Date(b.bookedAt) - new Date(a.bookedAt) : new Date(a.bookedAt) - new Date(b.bookedAt)));
    }, [bookings, bookingQuery, bookingStatus, bookingSort]);

    const nav = [
        { id: 'overview', label: 'Overview', icon: ICONS.grid },
        { id: 'events', label: 'Manage events', icon: ICONS.cal },
        { id: 'create', label: 'Create event', icon: ICONS.plus },
        { id: 'bookings', label: 'Manage bookings', icon: ICONS.ticket, badge: stats.pending },
    ];
    const go = (id) => { setSection(id); setMobileOpen(false); };
    const doLogout = () => { if (typeof logout === 'function') logout(); navigate('/login'); };

    const inputCls = (k) => `w-full rounded-lg border px-3.5 py-2.5 text-sm outline-none transition focus:ring-2 focus:ring-teal-600/30 focus:border-teal-600 ${errors[k] ? 'border-rose-400' : 'border-slate-300'}`;
    const Field = ({ id, label, children }) => (
        <div><label htmlFor={id} className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>{children}{errors[id] && <p className="text-xs text-rose-600 mt-1">{errors[id]}</p>}</div>
    );
    const setF = (k) => (e) => setFormData({ ...formData, [k]: e.target.value });

    return (
        <div className="min-h-screen bg-slate-50 text-slate-800">
            <style>{`
                @keyframes chartGrow{from{transform:scaleY(0)}to{transform:scaleY(1)}}
                @keyframes chartGrowX{from{transform:scaleX(0)}to{transform:scaleX(1)}}
                @keyframes enter{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
                @keyframes pop{from{opacity:0;transform:scale(.97)}to{opacity:1;transform:none}}
                .chart-grow{transform-origin:bottom;animation:chartGrow .6s ease-out both}
                .chart-grow-x{transform-origin:left;animation:chartGrowX .6s ease-out both}
                .page-enter{animation:enter .35s ease-out both}
                .modal-pop{animation:pop .2s ease-out both}
                @media (prefers-reduced-motion:reduce){.chart-grow,.chart-grow-x,.page-enter,.modal-pop{animation:none}}
            `}</style>

            {mobileOpen && <div className="fixed inset-0 bg-slate-900/40 z-30 lg:hidden" onClick={() => setMobileOpen(false)} />}

            {/* Sidebar */}
            <aside className={`fixed inset-y-0 left-0 z-40 bg-slate-900 text-slate-300 flex flex-col transition-all duration-300 ${collapsed ? 'lg:w-[76px]' : 'lg:w-64'} w-64 ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
                <div className="h-16 flex items-center gap-3 px-5 border-b border-white/10 shrink-0">
                    <div className="w-8 h-8 rounded-lg bg-teal-500 text-slate-900 font-black flex items-center justify-center shrink-0">E</div>
                    <span className={`font-semibold text-white truncate ${collapsed ? 'lg:hidden' : ''}`}>Event Admin</span>
                </div>
                <nav className="flex-1 p-3 space-y-1 overflow-y-auto" aria-label="Admin navigation">
                    {nav.map((n) => (
                        <button key={n.id} onClick={() => go(n.id)} title={n.label} aria-current={section === n.id ? 'page' : undefined}
                            className={`w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${section === n.id ? 'bg-teal-500/15 text-teal-300' : 'hover:bg-white/5 hover:text-white'}`}>
                            <Icon d={n.icon} className="w-5 h-5 shrink-0" />
                            <span className={`flex-1 text-left truncate ${collapsed ? 'lg:hidden' : ''}`}>{n.label}</span>
                            {n.badge > 0 && <span className={`text-[11px] font-bold bg-amber-400 text-slate-900 rounded-full px-1.5 ${collapsed ? 'lg:hidden' : ''}`}>{n.badge}</span>}
                        </button>
                    ))}
                </nav>
                <div className="p-3 border-t border-white/10 space-y-1">
                    <button onClick={() => setCollapsed(!collapsed)} className="hidden lg:flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm hover:bg-white/5 hover:text-white transition" aria-label="Toggle sidebar">
                        <Icon d={ICONS.chev} className={`w-5 h-5 shrink-0 transition-transform ${collapsed ? 'rotate-180' : ''}`} />
                        <span className={collapsed ? 'hidden' : ''}>Collapse</span>
                    </button>
                    <button onClick={doLogout} className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm hover:bg-rose-500/15 hover:text-rose-300 transition">
                        <Icon d={ICONS.out} className="w-5 h-5 shrink-0" /><span className={collapsed ? 'lg:hidden' : ''}>Log out</span>
                    </button>
                </div>
            </aside>

            {/* Main */}
            <div className={`transition-all duration-300 ${collapsed ? 'lg:pl-[76px]' : 'lg:pl-64'}`}>
                <header className="sticky top-0 z-20 h-16 bg-white/90 backdrop-blur border-b border-slate-200 flex items-center gap-3 px-4 sm:px-6">
                    <button className="lg:hidden p-2 -ml-2 rounded-lg hover:bg-slate-100" onClick={() => setMobileOpen(true)} aria-label="Open menu"><Icon d={ICONS.menu} /></button>
                    <h1 className="font-semibold text-slate-900 truncate">{nav.find((n) => n.id === section)?.label}</h1>
                    <div className="ml-auto flex items-center gap-3">
                        <div className="text-right hidden sm:block leading-tight">
                            <p className="text-sm font-semibold text-slate-900">{user?.name || 'Admin'}</p>
                            <p className="text-xs text-slate-500">{user?.email || 'Administrator'}</p>
                        </div>
                        <div className="w-9 h-9 rounded-full bg-teal-600 text-white font-bold flex items-center justify-center">{(user?.name || 'A').charAt(0).toUpperCase()}</div>
                    </div>
                </header>

                <main className="p-4 sm:p-6 max-w-[1400px] mx-auto overflow-x-hidden">
                    {loading ? (
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">{[...Array(6)].map((_, i) => <Skeleton key={i} className="h-24" />)}</div>
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4"><Skeleton className="h-64" /><Skeleton className="h-64" /></div>
                        </div>
                    ) : (
                        <div key={section} className="page-enter">
                            {/* OVERVIEW */}
                            {section === 'overview' && (
                                <div className="space-y-6">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                                        <StatCard label="Total events" value={events.length} icon={ICONS.cal} tone="bg-teal-50 text-teal-700" />
                                        <StatCard label="Total bookings" value={bookings.length} icon={ICONS.ticket} tone="bg-indigo-50 text-indigo-700" />
                                        <StatCard label="Customers with bookings" value={stats.users} icon={ICONS.users} tone="bg-sky-50 text-sky-700" />
                                        <StatCard label="Upcoming events" value={stats.upcoming} icon={ICONS.clock} tone="bg-amber-50 text-amber-700" />
                                        <StatCard label="Revenue (paid & confirmed)" value={money(stats.revenue)} icon={ICONS.rupee} tone="bg-emerald-50 text-emerald-700" />
                                        <StatCard label="Seats available" value={stats.availableSeats.toLocaleString('en-IN')} icon={ICONS.seat} tone="bg-slate-100 text-slate-700" />
                                    </div>
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                        <Card title="Bookings per month" subtitle="Last 6 months, by booking date"><BarChart data={stats.bookingTrend} /></Card>
                                        <Card title="Revenue per month" subtitle="Paid and confirmed bookings"><BarChart data={stats.revenueTrend} format={money} color="bg-emerald-600" /></Card>
                                        <Card title="Events created per month" subtitle="Last 6 months">
                                            {stats.hasEventDates ? <BarChart data={stats.eventTrend} color="bg-indigo-600" /> : <EmptyState title="Creation dates unavailable" hint="Your events API doesn't return a createdAt field, so this trend can't be drawn." />}
                                        </Card>
                                        <div className="grid grid-cols-1 gap-6">
                                            <Card title="Events by category"><HBars data={stats.categories} /></Card>
                                            <Card title="Booking status"><HBars data={stats.statuses} /></Card>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* EVENTS */}
                            {section === 'events' && (
                                <Card className="!p-0">
                                    <div className="p-4 flex flex-col sm:flex-row gap-3 border-b border-slate-100">
                                        <div className="relative flex-1"><Icon d={ICONS.search} className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                            <input value={eventQuery} onChange={(e) => { setEventQuery(e.target.value); setEventPage(1); }} placeholder="Search by title, category or location" className="w-full rounded-lg border border-slate-300 pl-9 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-teal-600/30 focus:border-teal-600" aria-label="Search events" /></div>
                                        <select value={eventSort} onChange={(e) => setEventSort(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" aria-label="Sort events">
                                            <option value="date-asc">Date: soonest first</option><option value="date-desc">Date: latest first</option><option value="title">Title A–Z</option><option value="price">Price: high to low</option>
                                        </select>
                                        <button onClick={() => go('create')} className="rounded-lg bg-teal-700 text-white text-sm font-semibold px-4 py-2 hover:bg-teal-800 active:scale-[.98] transition">New event</button>
                                    </div>
                                    {pagedEvents.length === 0 ? <EmptyState title={events.length ? 'No events match your search' : 'No events yet'} hint={events.length ? 'Try a different keyword.' : 'Create your first event to see it here.'} /> : (
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-sm">
                                                <thead className="bg-slate-50 text-left text-xs text-slate-500"><tr>
                                                    {['Event', 'Category', 'Date', 'Location', 'Seats', 'Price', 'Actions'].map((h) => <th key={h} className="px-4 py-3 font-semibold whitespace-nowrap">{h}</th>)}
                                                </tr></thead>
                                                <tbody className="divide-y divide-slate-100">
                                                    {pagedEvents.map((ev) => (
                                                        <tr key={ev._id} className="hover:bg-slate-50 transition-colors">
                                                            <td className="px-4 py-3"><div className="flex items-center gap-3 min-w-[220px]">
                                                                {ev.image ? <img src={ev.image} alt="" className="w-12 h-12 rounded-lg object-cover bg-slate-100 shrink-0" onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }} /> : <div className="w-12 h-12 rounded-lg bg-slate-100 shrink-0" />}
                                                                <div className="min-w-0"><p className="font-semibold text-slate-900 truncate">{ev.title}</p>{ev.createdAt && <p className="text-xs text-slate-500">Created {fmtDate(ev.createdAt)}</p>}</div></div></td>
                                                            <td className="px-4 py-3"><Badge tone="indigo">{ev.category || '—'}</Badge></td>
                                                            <td className="px-4 py-3 whitespace-nowrap">{fmtDate(ev.date)}</td>
                                                            <td className="px-4 py-3">{ev.location}</td>
                                                            <td className="px-4 py-3 whitespace-nowrap"><span className={ev.availableSeats > 0 ? 'text-emerald-700 font-semibold' : 'text-rose-600 font-semibold'}>{ev.availableSeats}</span> / {ev.totalSeats}</td>
                                                            <td className="px-4 py-3 whitespace-nowrap">{ev.ticketPrice === 0 ? <Badge tone="green">Free</Badge> : money(ev.ticketPrice)}</td>
                                                            <td className="px-4 py-3"><div className="flex gap-2">
                                                                <button onClick={() => setDetail({ type: 'event', item: ev })} className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 transition" aria-label={`View ${ev.title}`}><Icon d={ICONS.eye} className="w-4 h-4" /></button>
                                                                <button onClick={() => setConfirmDelete(ev)} className="p-2 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-600 hover:text-white transition" aria-label={`Delete ${ev.title}`}><Icon d={ICONS.trash} className="w-4 h-4" /></button>
                                                            </div></td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                    <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 text-sm text-slate-500">
                                        <span>{filteredEvents.length} event{filteredEvents.length === 1 ? '' : 's'}</span>
                                        <div className="flex items-center gap-2">
                                            <button disabled={eventPage === 1} onClick={() => setEventPage(eventPage - 1)} className="px-3 py-1.5 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50">Previous</button>
                                            <span>{eventPage} / {eventPages}</span>
                                            <button disabled={eventPage === eventPages} onClick={() => setEventPage(eventPage + 1)} className="px-3 py-1.5 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50">Next</button>
                                        </div>
                                    </div>
                                </Card>
                            )}

                            {/* CREATE */}
                            {section === 'create' && (
                                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                                    <Card title="Event details" subtitle="Fill in every field marked required, then publish." className="xl:col-span-2">
                                        <form onSubmit={handleCreateEvent} noValidate className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                            <Field id="title" label="Event title"><input id="title" type="text" placeholder="e.g. Sunburn Music Festival" className={inputCls('title')} value={formData.title} onChange={setF('title')} /></Field>
                                            <Field id="category" label="Category"><input id="category" type="text" placeholder="e.g. Tech, Music" className={inputCls('category')} value={formData.category} onChange={setF('category')} /></Field>
                                            <Field id="date" label="Date"><input id="date" type="date" className={inputCls('date')} value={formData.date} onChange={setF('date')} /></Field>
                                            <Field id="location" label="Location"><input id="location" type="text" placeholder="Venue and city" className={inputCls('location')} value={formData.location} onChange={setF('location')} /></Field>
                                            <Field id="totalSeats" label="Total seats"><input id="totalSeats" type="number" min="1" placeholder="e.g. 500" className={inputCls('totalSeats')} value={formData.totalSeats} onChange={setF('totalSeats')} /></Field>
                                            <Field id="ticketPrice" label="Ticket price (₹)"><input id="ticketPrice" type="number" min="0" placeholder="0 for a free event" className={inputCls('ticketPrice')} value={formData.ticketPrice} onChange={setF('ticketPrice')} /></Field>
                                            <div className="md:col-span-2"><Field id="image" label="Image URL (optional)"><input id="image" type="text" placeholder="Direct link to an image" className={inputCls('image')} value={formData.image} onChange={setF('image')} /></Field></div>
                                            <div className="md:col-span-2"><Field id="description" label="Description"><textarea id="description" placeholder="What should attendees know?" className={`${inputCls('description')} h-32`} value={formData.description} onChange={setF('description')} /></Field></div>
                                            <div className="md:col-span-2 flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
                                                <button type="button" onClick={() => { setFormData(EMPTY_FORM); setErrors({}); }} className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-semibold hover:bg-slate-50 transition">Clear form</button>
                                                <button type="submit" disabled={submitting} className="rounded-lg bg-teal-700 text-white px-6 py-2.5 text-sm font-semibold hover:bg-teal-800 active:scale-[.98] disabled:opacity-60 transition">{submitting ? 'Publishing…' : 'Publish event'}</button>
                                            </div>
                                        </form>
                                    </Card>
                                    <Card title="Preview" subtitle="How the image will look">
                                        {formData.image ? <img src={formData.image} alt="Event preview" className="w-full aspect-video object-cover rounded-lg bg-slate-100" onError={(e) => { e.currentTarget.style.opacity = 0.2; }} onLoad={(e) => { e.currentTarget.style.opacity = 1; }} /> : <div className="w-full aspect-video rounded-lg bg-slate-100 flex items-center justify-center text-sm text-slate-400">Add an image URL to preview it</div>}
                                        <p className="font-semibold text-slate-900 mt-4">{formData.title || 'Event title'}</p>
                                        <p className="text-sm text-slate-500">{[formData.category, formData.date && fmtDate(formData.date), formData.location].filter(Boolean).join(' • ') || 'Category, date and location'}</p>
                                    </Card>
                                </div>
                            )}

                            {/* BOOKINGS */}
                            {section === 'bookings' && (
                                <Card className="!p-0">
                                    <div className="p-4 flex flex-col lg:flex-row gap-3 border-b border-slate-100">
                                        <div className="relative flex-1"><Icon d={ICONS.search} className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                            <input value={bookingQuery} onChange={(e) => setBookingQuery(e.target.value)} placeholder="Search by booking ID, user or event" className="w-full rounded-lg border border-slate-300 pl-9 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-teal-600/30 focus:border-teal-600" aria-label="Search bookings" /></div>
                                        <div className="flex gap-3">
                                            <select value={bookingStatus} onChange={(e) => setBookingStatus(e.target.value)} className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm" aria-label="Filter by status">
                                                <option value="all">All statuses</option><option value="pending">Pending</option><option value="confirmed">Confirmed</option><option value="cancelled">Cancelled</option></select>
                                            <select value={bookingSort} onChange={(e) => setBookingSort(e.target.value)} className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm" aria-label="Sort bookings">
                                                <option value="newest">Newest first</option><option value="oldest">Oldest first</option></select>
                                        </div>
                                    </div>
                                    {filteredBookings.length === 0 ? <EmptyState title={bookings.length ? 'No bookings match your filters' : 'No bookings yet'} hint={bookings.length ? 'Clear the search or status filter.' : 'Bookings appear here as customers reserve seats.'} /> : (
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-sm">
                                                <thead className="bg-slate-50 text-left text-xs text-slate-500"><tr>
                                                    {['Booking', 'Customer', 'Event', 'Amount', 'Status', 'Payment', 'Booked on', 'Actions'].map((h) => <th key={h} className="px-4 py-3 font-semibold whitespace-nowrap">{h}</th>)}
                                                </tr></thead>
                                                <tbody className="divide-y divide-slate-100">
                                                    {filteredBookings.map((b) => (
                                                        <tr key={b._id} className="hover:bg-slate-50 transition-colors align-top">
                                                            <td className="px-4 py-3 font-mono text-xs text-slate-500">…{String(b._id).slice(-8)}</td>
                                                            <td className="px-4 py-3 min-w-[180px]"><p className="font-semibold text-slate-900">{b.userId?.name || '—'}</p><p className="text-xs text-slate-500">{b.userId?.email}</p></td>
                                                            <td className="px-4 py-3 min-w-[160px]">{b.eventId?.title || <span className="text-slate-400">Deleted event</span>}</td>
                                                            <td className="px-4 py-3 whitespace-nowrap font-semibold">{b.amount === 0 ? 'Free' : money(b.amount)}</td>
                                                            <td className="px-4 py-3"><Badge tone={statusTone(b.status)}>{b.status}</Badge></td>
                                                            <td className="px-4 py-3">{b.status !== 'cancelled' && b.paymentStatus ? <Badge tone={b.paymentStatus === 'paid' ? 'indigo' : 'slate'}>{b.paymentStatus.replace('_', ' ')}</Badge> : '—'}</td>
                                                            <td className="px-4 py-3 whitespace-nowrap">{fmtDate(b.bookedAt)}</td>
                                                            <td className="px-4 py-3"><div className="flex flex-wrap gap-2 min-w-[150px]">
                                                                <button onClick={() => setDetail({ type: 'booking', item: b })} className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold hover:bg-slate-100 transition">Details</button>
                                                                {b.status === 'pending' && (<>
                                                                    <button onClick={() => handleConfirmBooking(b._id, 'paid')} className="px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold hover:bg-emerald-600 hover:text-white transition">Approve as paid</button>
                                                                    <button onClick={() => handleConfirmBooking(b._id, 'not_paid')} className="px-3 py-1.5 rounded-lg bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold hover:bg-slate-800 hover:text-white transition">Approve unpaid</button>
                                                                    <button onClick={() => handleCancelBooking(b._id)} className="px-3 py-1.5 rounded-lg bg-rose-50 text-rose-600 border border-rose-200 text-xs font-semibold hover:bg-rose-600 hover:text-white transition">Reject</button>
                                                                </>)}
                                                            </div></td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </Card>
                            )}
                        </div>
                    )}
                </main>
            </div>

            {/* Detail modal */}
            {detail && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50" onClick={() => setDetail(null)} role="dialog" aria-modal="true">
                    <div className="modal-pop bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between p-5 border-b border-slate-100">
                            <h2 className="font-semibold text-slate-900">{detail.type === 'event' ? 'Event details' : 'Booking details'}</h2>
                            <button onClick={() => setDetail(null)} className="p-1.5 rounded-lg hover:bg-slate-100" aria-label="Close"><Icon d={ICONS.x} /></button>
                        </div>
                        <dl className="p-5 grid grid-cols-3 gap-y-3 text-sm">
                            {(detail.type === 'event' ? [
                                ['Title', detail.item.title], ['Category', detail.item.category], ['Date', fmtDate(detail.item.date)], ['Location', detail.item.location],
                                ['Seats', `${detail.item.availableSeats} available of ${detail.item.totalSeats}`], ['Price', detail.item.ticketPrice === 0 ? 'Free' : money(detail.item.ticketPrice)],
                                ['Description', detail.item.description],
                            ] : [
                                ['Booking ID', detail.item._id], ['Customer', detail.item.userId?.name], ['Email', detail.item.userId?.email], ['Event', detail.item.eventId?.title || 'Deleted event'],
                                ['Amount', detail.item.amount === 0 ? 'Free' : money(detail.item.amount)], ['Status', detail.item.status], ['Payment', detail.item.paymentStatus?.replace('_', ' ')], ['Booked on', new Date(detail.item.bookedAt).toLocaleString('en-IN')],
                            ]).map(([k, v]) => (<React.Fragment key={k}><dt className="text-slate-500">{k}</dt><dd className="col-span-2 font-medium text-slate-900 break-words capitalize-first">{v || '—'}</dd></React.Fragment>))}
                        </dl>
                    </div>
                </div>
            )}

            {/* Delete confirmation */}
            {confirmDelete && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50" onClick={() => setConfirmDelete(null)} role="alertdialog" aria-modal="true">
                    <div className="modal-pop bg-white rounded-xl shadow-xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
                        <h2 className="font-semibold text-slate-900">Delete this event?</h2>
                        <p className="text-sm text-slate-500 mt-2">“{confirmDelete.title}” will be removed permanently. This can’t be undone.</p>
                        <div className="flex justify-end gap-3 mt-6">
                            <button onClick={() => setConfirmDelete(null)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold hover:bg-slate-50">Keep event</button>
                            <button onClick={() => { handleDeleteEvent(confirmDelete._id); setConfirmDelete(null); }} className="rounded-lg bg-rose-600 text-white px-4 py-2 text-sm font-semibold hover:bg-rose-700">Delete event</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Toast */}
            {toast && (
                <div role="status" className={`modal-pop fixed bottom-5 right-5 z-[60] rounded-lg px-4 py-3 text-sm font-medium shadow-lg text-white ${toast.type === 'success' ? 'bg-emerald-600' : 'bg-rose-600'}`}>{toast.text}</div>
            )}
        </div>
    );
};

export default AdminDashboard;