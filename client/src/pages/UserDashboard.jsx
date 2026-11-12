import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import api from '../utils/axios';
import { Link, useNavigate } from 'react-router-dom';
import {
    FaTicketAlt,
    FaTimesCircle,
    FaThLarge,
    FaListUl,
    FaUser,
    FaSignOutAlt,
    FaCalendarAlt,
    FaCalendarCheck,
    FaMapMarkerAlt,
    FaHistory,
    FaBan,
    FaArrowRight,
} from 'react-icons/fa';

/* -------------------------------------------------------------------------- */
/*  UI-only helpers (no effect on fetching, cancelling or auth logic)         */
/* -------------------------------------------------------------------------- */

const NAV_ITEMS = [
    { id: 'overview', label: 'Overview', short: 'Overview', icon: FaThLarge },
    { id: 'bookings', label: 'My Bookings', short: 'Bookings', icon: FaListUl },
    { id: 'tickets', label: 'My Tickets', short: 'Tickets', icon: FaTicketAlt },
    { id: 'profile', label: 'Profile', short: 'Profile', icon: FaUser },
];

const FILTERS = [
    { id: 'all', label: 'All' },
    { id: 'confirmed', label: 'Confirmed' },
    { id: 'pending', label: 'Pending' },
    { id: 'cancelled', label: 'Cancelled' },
];

// Same three-way split the original used: confirmed / cancelled / everything else
const statusOf = (b) => (b.status === 'confirmed' ? 'confirmed' : b.status === 'cancelled' ? 'cancelled' : 'pending');

const startOfToday = () => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
};

const eventDateOf = (b) => {
    if (!b.eventId || !b.eventId.date) return null;
    const d = new Date(b.eventId.date);
    return isNaN(d) ? null : d;
};

const fmtDate = (value) => {
    const d = new Date(value);
    return isNaN(d) ? 'Date not available' : d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
};

// Show a time only when the stored date actually carries one
const fmtTime = (d) =>
    d && (d.getHours() !== 0 || d.getMinutes() !== 0)
        ? d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })
        : '';

const fmtAmount = (amount) =>
    amount === 0 ? 'FREE' : `₹${Number.isFinite(Number(amount)) ? Number(amount).toLocaleString('en-IN') : amount}`;

const shortRef = (id) => (id ? `#${String(id).slice(-8).toUpperCase()}` : '');

const STYLES = `
  @keyframes db-rise { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
  @keyframes db-fade { from { opacity: 0; } to { opacity: 1; } }
  .db-rise { opacity: 0; animation: db-rise .5s cubic-bezier(.22,1,.36,1) forwards; }
  .db-fade { animation: db-fade .3s ease-out both; }
  @media (prefers-reduced-motion: reduce) { .db-rise, .db-fade { animation: none; opacity: 1; transform: none; } }
`;

/* -------------------------------------------------------------------------- */
/*  Small components                                                          */
/* -------------------------------------------------------------------------- */

const StatusBadge = ({ status }) => {
    const styles =
        status === 'confirmed'
            ? 'bg-green-100 text-green-700'
            : status === 'cancelled'
                ? 'bg-red-100 text-red-700'
                : 'bg-yellow-100 text-yellow-800';
    return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${styles}`}>{status}</span>;
};

const PaymentBadge = ({ value }) => (
    <span
        className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${
            value === 'paid' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'
        }`}
    >
        {String(value || '').replace('_', ' ')}
    </span>
);

const EventThumb = ({ src, alt, className = '' }) => {
    const [failed, setFailed] = useState(false);
    if (!src || failed) {
        return (
            <div className={`flex items-center justify-center bg-gray-800 text-gray-500 ${className}`}>
                <FaTicketAlt className="text-3xl" />
            </div>
        );
    }
    return <img src={src} alt={alt} loading="lazy" onError={() => setFailed(true)} className={`object-cover ${className}`} />;
};

const StatCard = ({ icon: Icon, label, value, hint, index }) => (
    <div
        className="db-rise rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
        style={{ animationDelay: `${index * 70}ms` }}
    >
        <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-gray-900 text-white">
            <Icon />
        </span>
        <p className="text-3xl font-bold tracking-tight text-gray-900">{value}</p>
        <p className="mt-1 text-sm font-semibold text-gray-700">{label}</p>
        <p className="mt-0.5 text-xs text-gray-500">{hint}</p>
    </div>
);

const SectionHeader = ({ title, subtitle, action }) => (
    <div className="mb-6 flex items-end justify-between gap-4">
        <div>
            <h2 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">{title}</h2>
            {subtitle && <p className="mt-1 text-sm text-gray-500">{subtitle}</p>}
        </div>
        {action}
    </div>
);

const EmptyState = ({ title, message, showBrowse = true }) => (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-14 text-center">
        <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 text-2xl text-gray-400">
            <FaTicketAlt />
        </span>
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        <p className="mt-1 max-w-md text-sm text-gray-500">{message}</p>
        {showBrowse && (
            <Link
                to="/"
                className="mt-6 rounded-xl bg-gray-900 px-6 py-3 text-sm font-semibold text-white shadow-md transition-all duration-200 hover:-translate-y-0.5 hover:bg-black hover:shadow-lg focus:outline-none focus-visible:ring-4 focus-visible:ring-rose-200"
            >
                Browse Events
            </Link>
        )}
    </div>
);

const DetailRow = ({ icon: Icon, children }) => (
    <div className="flex items-start gap-2.5 text-sm text-gray-600">
        <Icon className="mt-0.5 shrink-0 text-gray-400" />
        <span className="min-w-0 break-words">{children}</span>
    </div>
);

const BookingCard = ({ booking, onCancel, index }) => {
    const event = booking.eventId;
    const date = eventDateOf(booking);
    const time = fmtTime(date);
    const status = statusOf(booking);

    return (
        <article
            className="db-rise flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition-shadow duration-200 hover:shadow-lg"
            style={{ animationDelay: `${Math.min(index, 8) * 60}ms` }}
        >
            {event && (event.imageUrl) && (
                <div className="aspect-[16/9] overflow-hidden bg-gray-100">
                    <EventThumb src={event.imageUrl} alt={event.title} className="h-full w-full" />
                </div>
            )}

            <div className="flex-1 p-5">
                {event ? (
                    <>
                        <div className="mb-4 flex flex-wrap items-center gap-2">
                            <StatusBadge status={booking.status} />
                            {status !== 'cancelled' && booking.paymentStatus && <PaymentBadge value={booking.paymentStatus} />}
                        </div>
                        <h3 className="mb-4 text-lg font-bold leading-snug text-gray-900">{event.title}</h3>
                        <div className="space-y-2">
                            <DetailRow icon={FaCalendarAlt}>
                                {fmtDate(event.date)}
                                {time && ` · ${time}`}
                            </DetailRow>
                            {event.location && <DetailRow icon={FaMapMarkerAlt}>{event.location}</DetailRow>}
                        </div>
                        <dl className="mt-5 grid grid-cols-2 gap-3 rounded-xl bg-gray-50 p-3 text-sm">
                            <div>
                                <dt className="text-xs text-gray-500">Booking ID</dt>
                                <dd className="font-mono font-semibold text-gray-900" title={booking._id}>{shortRef(booking._id)}</dd>
                            </div>
                            <div>
                                <dt className="text-xs text-gray-500">Amount</dt>
                                <dd className={`font-semibold ${booking.amount === 0 ? 'text-green-700' : 'text-gray-900'}`}>{fmtAmount(booking.amount)}</dd>
                            </div>
                            <div className="col-span-2">
                                <dt className="text-xs text-gray-500">Requested on</dt>
                                <dd className="font-semibold text-gray-900">{fmtDate(booking.bookedAt)}</dd>
                            </div>
                        </dl>
                    </>
                ) : (
                    <p className="italic text-red-500">Event details unavailable (might have been deleted)</p>
                )}
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-gray-100 bg-gray-50 px-5 py-3">
                {event && status !== 'cancelled' ? (
                    <>
                        <Link
                            to={`/events/${event._id}`}
                            className="inline-flex items-center gap-1.5 rounded-lg text-sm font-semibold text-gray-900 transition-colors hover:text-rose-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
                        >
                            View Event <FaArrowRight className="text-xs" />
                        </Link>
                        <button
                            onClick={() => onCancel(booking._id)}
                            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50 hover:text-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
                        >
                            <FaTimesCircle /> Cancel
                        </button>
                    </>
                ) : (
                    <div className="w-full text-center text-sm italic text-gray-500">
                        {status === 'cancelled' ? 'Booking Cancelled' : 'Event no longer available'}
                    </div>
                )}
            </div>
        </article>
    );
};

const TicketCard = ({ booking, index }) => {
    const event = booking.eventId;
    const date = eventDateOf(booking);
    const time = fmtTime(date);
    const ended = date && date < startOfToday();

    return (
        <article
            className="db-rise flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition-shadow duration-200 hover:shadow-lg sm:flex-row"
            style={{ animationDelay: `${Math.min(index, 8) * 60}ms` }}
        >
            <div className="flex flex-1 gap-4 p-5 sm:p-6">
                {event.imageUrl && (
                    <EventThumb src={event.imageUrl} alt={event.title} className="hidden h-24 w-24 shrink-0 rounded-xl sm:block" />
                )}
                <div className="min-w-0 flex-1">
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                        <StatusBadge status="confirmed" />
                        {ended && <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-600">Event ended</span>}
                    </div>
                    <h3 className="mb-3 text-lg font-bold leading-snug text-gray-900">{event.title}</h3>
                    <div className="space-y-2">
                        <DetailRow icon={FaCalendarAlt}>
                            {fmtDate(event.date)}
                            {time && ` · ${time}`}
                        </DetailRow>
                        {event.location && <DetailRow icon={FaMapMarkerAlt}>{event.location}</DetailRow>}
                    </div>
                </div>
            </div>

            <div className="flex flex-col justify-between gap-4 border-t border-dashed border-gray-300 bg-gray-50 p-5 sm:w-56 sm:border-l sm:border-t-0">
                <div>
                    <p className="text-xs text-gray-500">Booking reference</p>
                    <p className="font-mono text-lg font-bold text-gray-900" title={booking._id}>{shortRef(booking._id)}</p>
                    <p className="mt-2 text-xs text-gray-500">Amount</p>
                    <p className={`font-semibold ${booking.amount === 0 ? 'text-green-700' : 'text-gray-900'}`}>{fmtAmount(booking.amount)}</p>
                </div>
                <Link
                    to={`/events/${event._id}`}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-black hover:shadow-md focus:outline-none focus-visible:ring-4 focus-visible:ring-rose-200"
                >
                    View Event <FaArrowRight className="text-xs" />
                </Link>
            </div>
        </article>
    );
};

const DashboardSkeleton = () => (
    <div className="mx-auto w-full max-w-6xl animate-pulse" aria-busy="true" aria-label="Loading dashboard">
        <div className="grid gap-6 lg:grid-cols-[17rem_minmax(0,1fr)]">
            <div className="hidden h-96 rounded-2xl bg-gray-200 lg:block" />
            <div>
                <div className="mb-6 h-10 w-64 rounded-lg bg-gray-200" />
                <div className="mb-8 grid grid-cols-2 gap-4 xl:grid-cols-4">
                    {[0, 1, 2, 3].map((i) => (
                        <div key={i} className="h-36 rounded-2xl bg-gray-200" />
                    ))}
                </div>
                <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                    {[0, 1, 2].map((i) => (
                        <div key={i} className="h-64 rounded-2xl bg-gray-200" />
                    ))}
                </div>
            </div>
        </div>
    </div>
);

/* -------------------------------------------------------------------------- */
/*  Dashboard                                                                 */
/* -------------------------------------------------------------------------- */

const UserDashboard = () => {
    const { user, logout } = useContext(AuthContext);
    const navigate = useNavigate();
    const [bookings, setBookings] = useState([]);
    const [loading, setLoading] = useState(true);

    // UI-only state
    const [activeTab, setActiveTab] = useState('overview');
    const [filter, setFilter] = useState('all');

    useEffect(() => {
        if (!user) {
            navigate('/login');
            return;
        }
        fetchBookings();
    }, [user, navigate]);

    const fetchBookings = async () => {
        try {
            const { data } = await api.get('/bookings/my');
            setBookings(data);
        } catch (error) {
            console.error('Error fetching bookings', error);
        } finally {
            setLoading(false);
        }
    };

    const cancelBooking = async (id) => {
        if (window.confirm('Are you sure you want to cancel this booking request?')) {
            try {
                await api.delete(`/bookings/${id}`);
                fetchBookings();
            } catch (error) {
                alert(error.response?.data?.message || 'Error cancelling booking');
            }
        }
    };

    // Same logout flow as the Navbar
    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    if (loading) return <DashboardSkeleton />;

    /* ------------------------- derived display data ------------------------- */

    const today = startOfToday();
    const total = bookings.length;
    const cancelled = bookings.filter((b) => statusOf(b) === 'cancelled');
    const upcoming = bookings
        .filter((b) => {
            const d = eventDateOf(b);
            return statusOf(b) !== 'cancelled' && d && d >= today;
        })
        .sort((a, b) => eventDateOf(a) - eventDateOf(b));
    const completed = bookings.filter((b) => {
        const d = eventDateOf(b);
        return statusOf(b) === 'confirmed' && d && d < today;
    });
    const tickets = bookings.filter((b) => statusOf(b) === 'confirmed' && b.eventId);
    const pendingCount = bookings.filter((b) => statusOf(b) === 'pending').length;
    const counts = {
        all: total,
        confirmed: bookings.filter((b) => statusOf(b) === 'confirmed').length,
        pending: pendingCount,
        cancelled: cancelled.length,
    };
    const filtered = filter === 'all' ? bookings : bookings.filter((b) => statusOf(b) === filter);
    const recent = [...bookings].sort((a, b) => new Date(b.bookedAt) - new Date(a.bookedAt)).slice(0, 3);
    const nextBooking = upcoming[0];
    const nextDate = nextBooking ? eventDateOf(nextBooking) : null;

    const name = user?.name || '';
    const initial = name ? name.charAt(0) : '?';
    const navCount = { bookings: total, tickets: tickets.length };

    const goTo = (id) => setActiveTab(id);

    return (
        <div className="mx-auto w-full max-w-6xl">
            <style>{STYLES}</style>

            <div className="grid gap-6 lg:grid-cols-[17rem_minmax(0,1fr)] lg:items-start">
                {/* ---------------------------- Sidebar (desktop) ---------------------------- */}
                <aside className="db-rise hidden rounded-2xl border border-gray-200 bg-white p-5 shadow-sm lg:sticky lg:top-24 lg:block">
                    <div className="mb-6 flex items-center gap-3 border-b border-gray-100 pb-6">
                        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gray-900 text-lg font-bold uppercase text-white">
                            {initial}
                        </span>
                        <div className="min-w-0">
                            <p className="truncate font-bold text-gray-900">{name}</p>
                            {user?.email && <p className="truncate text-xs text-gray-500">{user.email}</p>}
                        </div>
                    </div>

                    <nav className="space-y-1" aria-label="Dashboard">
                        {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
                            <button
                                key={id}
                                type="button"
                                onClick={() => goTo(id)}
                                aria-current={activeTab === id ? 'page' : undefined}
                                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 ${
                                    activeTab === id ? 'bg-gray-900 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                                }`}
                            >
                                <Icon className="shrink-0" />
                                <span className="flex-1 text-left">{label}</span>
                                {navCount[id] > 0 && (
                                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${activeTab === id ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'}`}>
                                        {navCount[id]}
                                    </span>
                                )}
                            </button>
                        ))}
                    </nav>

                    <div className="mt-6 border-t border-gray-100 pt-4">
                        <button
                            type="button"
                            onClick={handleLogout}
                            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-red-600 transition-colors duration-200 hover:bg-red-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
                        >
                            <FaSignOutAlt /> Logout
                        </button>
                    </div>
                </aside>

                <div className="min-w-0">
                    {/* ------------------------ Mobile / tablet header ------------------------ */}
                    <div className="db-rise mb-4 flex items-center gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm lg:hidden">
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gray-900 font-bold uppercase text-white">
                            {initial}
                        </span>
                        <div className="min-w-0 flex-1">
                            <p className="truncate font-bold text-gray-900">{name}</p>
                            {user?.email && <p className="truncate text-xs text-gray-500">{user.email}</p>}
                        </div>
                        <button
                            type="button"
                            onClick={handleLogout}
                            className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
                        >
                            <FaSignOutAlt /> Logout
                        </button>
                    </div>

                    <nav className="db-rise mb-6 grid grid-cols-4 gap-1 rounded-2xl border border-gray-200 bg-white p-1.5 shadow-sm lg:hidden" aria-label="Dashboard" style={{ animationDelay: '60ms' }}>
                        {NAV_ITEMS.map(({ id, short, icon: Icon }) => (
                            <button
                                key={id}
                                type="button"
                                onClick={() => goTo(id)}
                                aria-current={activeTab === id ? 'page' : undefined}
                                className={`flex flex-col items-center gap-1 rounded-xl px-1 py-2.5 text-xs font-medium transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 ${
                                    activeTab === id ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'
                                }`}
                            >
                                <Icon className="text-base" />
                                {short}
                            </button>
                        ))}
                    </nav>

                    {/* ------------------------------ Content ------------------------------ */}
                    <main key={activeTab} className="db-fade">
                        {/* ----------------------------- Overview ----------------------------- */}
                        {activeTab === 'overview' && (
                            <section>
                                <SectionHeader
                                    title={name ? `Welcome back, ${name.split(' ')[0]}` : 'Welcome back'}
                                    subtitle="Here's a summary of your bookings."
                                />

                                <div className="mb-8 grid grid-cols-2 gap-4 xl:grid-cols-4">
                                    <StatCard index={0} icon={FaTicketAlt} label="Total Bookings" value={total} hint="All booking requests" />
                                    <StatCard index={1} icon={FaCalendarCheck} label="Upcoming Events" value={upcoming.length} hint="Active bookings, event ahead" />
                                    <StatCard index={2} icon={FaHistory} label="Completed Events" value={completed.length} hint="Confirmed, event passed" />
                                    <StatCard index={3} icon={FaBan} label="Cancelled" value={cancelled.length} hint="Cancelled bookings" />
                                </div>

                                {total === 0 ? (
                                    <EmptyState title="No bookings yet" message="You haven't booked any events yet. Find something you'd like to attend." />
                                ) : (
                                    <div className="grid gap-6 xl:grid-cols-2">
                                        <div className="db-rise rounded-2xl border border-gray-200 bg-white p-5 shadow-sm" style={{ animationDelay: '300ms' }}>
                                            <h3 className="mb-4 text-lg font-bold text-gray-900">Next event</h3>
                                            {nextBooking ? (
                                                <div className="flex gap-4">
                                                    {nextBooking.eventId.imageUrl && (
                                                        <EventThumb src={nextBooking.eventId.imageUrl} alt={nextBooking.eventId.title} className="h-24 w-24 shrink-0 rounded-xl" />
                                                    )}
                                                    <div className="min-w-0 flex-1">
                                                        <div className="mb-2"><StatusBadge status={nextBooking.status} /></div>
                                                        <p className="font-bold leading-snug text-gray-900">{nextBooking.eventId.title}</p>
                                                        <p className="mt-1 text-sm text-gray-600">
                                                            {fmtDate(nextBooking.eventId.date)}
                                                            {fmtTime(nextDate) && ` · ${fmtTime(nextDate)}`}
                                                        </p>
                                                        {nextBooking.eventId.location && <p className="text-sm text-gray-500">{nextBooking.eventId.location}</p>}
                                                        <Link
                                                            to={`/events/${nextBooking.eventId._id}`}
                                                            className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-gray-900 hover:text-rose-600"
                                                        >
                                                            View Event <FaArrowRight className="text-xs" />
                                                        </Link>
                                                    </div>
                                                </div>
                                            ) : (
                                                <p className="text-sm text-gray-500">You have no upcoming events right now.</p>
                                            )}
                                        </div>

                                        <div className="db-rise rounded-2xl border border-gray-200 bg-white p-5 shadow-sm" style={{ animationDelay: '370ms' }}>
                                            <div className="mb-4 flex items-center justify-between">
                                                <h3 className="text-lg font-bold text-gray-900">Recent bookings</h3>
                                                <button type="button" onClick={() => goTo('bookings')} className="text-sm font-semibold text-rose-600 hover:text-rose-700">
                                                    View all
                                                </button>
                                            </div>
                                            <ul className="divide-y divide-gray-100">
                                                {recent.map((b) => (
                                                    <li key={b._id} className="flex items-center justify-between gap-3 py-3">
                                                        <div className="min-w-0">
                                                            <p className="truncate text-sm font-semibold text-gray-900">
                                                                {b.eventId ? b.eventId.title : 'Event unavailable'}
                                                            </p>
                                                            <p className="text-xs text-gray-500">Requested {fmtDate(b.bookedAt)}</p>
                                                        </div>
                                                        <StatusBadge status={b.status} />
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    </div>
                                )}
                            </section>
                        )}

                        {/* ---------------------------- My Bookings ---------------------------- */}
                        {activeTab === 'bookings' && (
                            <section>
                                <SectionHeader title="My Bookings" subtitle="Your booking requests and their current status." />

                                {total === 0 ? (
                                    <EmptyState title="No bookings yet" message="You haven't booked any events yet." />
                                ) : (
                                    <>
                                        <div className="mb-6 flex flex-wrap gap-2" role="tablist" aria-label="Filter bookings">
                                            {FILTERS.filter((f) => f.id === 'all' || counts[f.id] > 0).map((f) => (
                                                <button
                                                    key={f.id}
                                                    type="button"
                                                    role="tab"
                                                    aria-selected={filter === f.id}
                                                    onClick={() => setFilter(f.id)}
                                                    className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 ${
                                                        filter === f.id
                                                            ? 'border-gray-900 bg-gray-900 text-white'
                                                            : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-100'
                                                    }`}
                                                >
                                                    {f.label} <span className="opacity-70">({counts[f.id]})</span>
                                                </button>
                                            ))}
                                        </div>

                                        {filtered.length === 0 ? (
                                            <EmptyState title="Nothing here" message="No bookings match this filter." showBrowse={false} />
                                        ) : (
                                            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
                                                {filtered.map((booking, i) => (
                                                    <BookingCard key={booking._id} booking={booking} onCancel={cancelBooking} index={i} />
                                                ))}
                                            </div>
                                        )}
                                    </>
                                )}
                            </section>
                        )}

                        {/* ----------------------------- My Tickets ----------------------------- */}
                        {activeTab === 'tickets' && (
                            <section>
                                <SectionHeader title="My Tickets" subtitle="Confirmed bookings appear here as tickets." />

                                {tickets.length === 0 ? (
                                    <EmptyState
                                        title="No confirmed tickets yet"
                                        message={
                                            pendingCount > 0
                                                ? `You have ${pendingCount} booking ${pendingCount === 1 ? 'request' : 'requests'} awaiting confirmation. They'll show up here once confirmed.`
                                                : "Once a booking is confirmed, your ticket will show up here."
                                        }
                                    />
                                ) : (
                                    <div className="space-y-5">
                                        {tickets.map((booking, i) => (
                                            <TicketCard key={booking._id} booking={booking} index={i} />
                                        ))}
                                    </div>
                                )}
                            </section>
                        )}

                        {/* ------------------------------ Profile ------------------------------ */}
                        {activeTab === 'profile' && (
                            <section>
                                <SectionHeader title="Profile" subtitle="Your account details." />
                                <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
                                    <div className="mb-8 flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
                                        <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-gray-900 text-3xl font-bold uppercase text-white">
                                            {initial}
                                        </span>
                                        <div className="min-w-0">
                                            <h3 className="break-words text-2xl font-bold text-gray-900">{name}</h3>
                                            <p className="mt-1 inline-flex items-center gap-2 text-sm text-gray-500">
                                                <span className="h-2 w-2 rounded-full bg-green-500" /> User Dashboard
                                            </p>
                                        </div>
                                    </div>

                                    <dl className="divide-y divide-gray-100 rounded-xl border border-gray-200">
                                        <div className="flex flex-col gap-1 p-4 sm:flex-row sm:items-center sm:gap-6">
                                            <dt className="w-40 shrink-0 text-sm text-gray-500">Name</dt>
                                            <dd className="break-words font-semibold text-gray-900">{name || 'Not available'}</dd>
                                        </div>
                                        {user?.email && (
                                            <div className="flex flex-col gap-1 p-4 sm:flex-row sm:items-center sm:gap-6">
                                                <dt className="w-40 shrink-0 text-sm text-gray-500">Email</dt>
                                                <dd className="break-all font-semibold text-gray-900">{user.email}</dd>
                                            </div>
                                        )}
                                        {user?.role && (
                                            <div className="flex flex-col gap-1 p-4 sm:flex-row sm:items-center sm:gap-6">
                                                <dt className="w-40 shrink-0 text-sm text-gray-500">Account type</dt>
                                                <dd className="font-semibold capitalize text-gray-900">{user.role}</dd>
                                            </div>
                                        )}
                                    </dl>
                                </div>
                            </section>
                        )}
                    </main>
                </div>
            </div>
        </div>
    );
};

export default UserDashboard;