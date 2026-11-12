import React, { useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import {
    FaTicketAlt,
    FaUser,
    FaEnvelope,
    FaLock,
    FaKey,
    FaEye,
    FaEyeSlash,
    FaCheckCircle,
    FaExclamationCircle,
} from 'react-icons/fa';

/* ------------------------------------------------------------------ */
/*  UI-only helpers (no effect on registration logic)                  */
/* ------------------------------------------------------------------ */

const inputClass =
    'w-full rounded-xl border border-gray-300 bg-white py-3 pl-11 pr-4 text-gray-900 placeholder-gray-400 shadow-sm ' +
    'transition-all duration-200 hover:border-gray-400 focus:border-rose-500 focus:outline-none focus:ring-4 focus:ring-rose-100 ' +
    '[&:not(:placeholder-shown):invalid]:border-red-400 [&:not(:placeholder-shown):invalid]:focus:ring-red-100';

const iconClass =
    'pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 transition-colors duration-200 group-focus-within:text-rose-600';

// Visual hint only: it is NOT used for validation and never blocks submit
const getStrength = (pw) => {
    if (!pw) return 0;
    let score = 0;
    if (pw.length >= 8) score++;
    if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
    if (/\d/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;
    return Math.max(1, score);
};
const STRENGTH_LABELS = ['', 'Weak', 'Fair', 'Good', 'Strong'];
const STRENGTH_COLORS = ['', 'bg-red-500', 'bg-amber-500', 'bg-lime-500', 'bg-green-600'];
const STRENGTH_TEXT = ['', 'text-red-600', 'text-amber-600', 'text-lime-700', 'text-green-700'];

const BARCODE = [3, 1, 2, 1, 4, 1, 2, 3, 1, 2, 1, 3, 2, 1, 4, 1, 2, 1];

const Register = () => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [otp, setOtp] = useState('');
    const [showOTP, setShowOTP] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    // UI-only state
    const [showPassword, setShowPassword] = useState(false);

    const { register, verifyOTP } = useContext(AuthContext);
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            if (!showOTP) {
                await register(name, email, password);
                setShowOTP(true);
                setError('');
            } else {
                await verifyOTP(email, otp);
                navigate('/dashboard');
            }
        } catch (err) {
            setError(err);
        } finally {
            setLoading(false);
        }
    };

    const strength = getStrength(password);
    // Stagger helper: each element rises in slightly after the previous one
    const rise = (i) => ({ animationDelay: `${120 + i * 70}ms` });

    return (
        <div className="px-4 py-8 sm:py-12">
            {/* Scoped keyframes so no Tailwind config change is needed */}
            <style>{`
                @keyframes reg-card-in { from { opacity: 0; transform: translateY(16px) scale(.985); } to { opacity: 1; transform: none; } }
                @keyframes reg-rise { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
                @keyframes reg-float { 0%, 100% { transform: translateY(0) rotate(var(--r, 0deg)); } 50% { transform: translateY(-8px) rotate(var(--r, 0deg)); } }
                @keyframes reg-drift { 0%, 100% { transform: translate(0, 0); } 50% { transform: translate(14px, -10px); } }
                .reg-card { animation: reg-card-in .55s cubic-bezier(.22,1,.36,1) both; }
                .reg-rise { opacity: 0; animation: reg-rise .5s cubic-bezier(.22,1,.36,1) forwards; }
                .reg-float { animation: reg-float 6s ease-in-out infinite; }
                .reg-drift { animation: reg-drift 14s ease-in-out infinite; }
                @media (prefers-reduced-motion: reduce) {
                    .reg-card, .reg-rise, .reg-float, .reg-drift { animation: none; opacity: 1; transform: none; }
                }
            `}</style>

            <div className="reg-card mx-auto grid w-full max-w-5xl overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-xl lg:grid-cols-2">
                {/* ---------------- Visual panel (desktop / tablet landscape) ---------------- */}
                <aside className="relative hidden overflow-hidden bg-gray-900 p-10 text-white lg:flex lg:flex-col lg:justify-between xl:p-12">
                    <div className="reg-drift pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-rose-600/20 blur-3xl" aria-hidden="true" />
                    <div className="reg-drift pointer-events-none absolute -bottom-28 -left-20 h-72 w-72 rounded-full bg-indigo-500/15 blur-3xl" style={{ animationDelay: '-6s' }} aria-hidden="true" />

                    <div className="relative flex items-center gap-2.5">
                        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-600 shadow-sm">
                            <FaTicketAlt />
                        </span>
                        <span className="text-xl font-bold tracking-tight">Eventora</span>
                    </div>

                    {/* Ticket illustration */}
                    <div className="relative my-10 flex h-56 items-center justify-center" aria-hidden="true">
                        <div className="reg-float absolute w-64 rounded-2xl border border-white/10 bg-white/5 p-5" style={{ '--r': '8deg', animationDelay: '-2s' }}>
                            <div className="h-24" />
                        </div>
                        <div className="reg-float relative w-64 overflow-hidden rounded-2xl bg-white text-gray-900 shadow-2xl" style={{ '--r': '-5deg' }}>
                            <div className="flex items-center justify-between bg-rose-600 px-5 py-3 text-white">
                                <span className="flex items-center gap-2 text-sm font-semibold">
                                    <FaTicketAlt /> Eventora
                                </span>
                                <span className="text-xs font-medium">Admit one</span>
                            </div>
                            <div className="relative px-5 py-5">
                                <div className="mb-2 h-3 w-3/4 rounded bg-gray-200" />
                                <div className="mb-5 h-3 w-1/2 rounded bg-gray-100" />
                                <div className="flex h-10 items-end gap-[3px]">
                                    {BARCODE.map((w, i) => (
                                        <span key={i} className="h-full rounded-sm bg-gray-900" style={{ width: `${w * 2}px` }} />
                                    ))}
                                </div>
                                <span className="absolute -left-2.5 top-0 h-5 w-5 -translate-y-1/2 rounded-full bg-gray-900" />
                                <span className="absolute -right-2.5 top-0 h-5 w-5 -translate-y-1/2 rounded-full bg-gray-900" />
                            </div>
                        </div>
                    </div>

                    <div className="relative">
                        <h2 className="text-3xl font-bold leading-tight tracking-tight xl:text-4xl">
                            Your next great night out is a few clicks away.
                        </h2>
                        <ul className="mt-6 space-y-3 text-sm text-gray-300">
                            {[
                                'Book tickets for concerts, shows and workshops',
                                'Download and manage tickets from your dashboard',
                                'Secure sign-up with email verification',
                            ].map((item) => (
                                <li key={item} className="flex items-start gap-2.5">
                                    <FaCheckCircle className="mt-0.5 shrink-0 text-rose-400" />
                                    <span>{item}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                </aside>

                {/* ---------------- Form panel ---------------- */}
                <section className="flex flex-col justify-center p-6 sm:p-10 xl:p-14">
                    {/* Compact brand for screens where the visual panel is hidden */}
                    <div className="reg-rise mb-6 flex items-center gap-2.5 lg:hidden" style={rise(0)}>
                        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-600 text-white shadow-sm">
                            <FaTicketAlt />
                        </span>
                        <span className="text-xl font-bold tracking-tight text-gray-900">Eventora</span>
                    </div>

                    <div className="reg-rise mb-8" style={rise(1)}>
                        <h2 className="mb-2 text-3xl font-extrabold tracking-tight text-gray-900">Create an Account</h2>
                        <p className="text-gray-500">Join Eventora today</p>
                    </div>

                    {error && (
                        <div
                            role="alert"
                            className="reg-rise mb-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-700"
                        >
                            <FaExclamationCircle className="mt-0.5 shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-5">
                        {!showOTP ? (
                            <div key="details" className="space-y-5">
                                <div className="reg-rise" style={rise(2)}>
                                    <label htmlFor="reg-name" className="mb-2 block text-sm font-semibold text-gray-700">Full Name</label>
                                    <div className="group relative">
                                        <FaUser className={iconClass} />
                                        <input
                                            id="reg-name"
                                            type="text"
                                            required
                                            autoComplete="name"
                                            placeholder="Your full name"
                                            className={inputClass}
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                        />
                                    </div>
                                </div>

                                <div className="reg-rise" style={rise(3)}>
                                    <label htmlFor="reg-email" className="mb-2 block text-sm font-semibold text-gray-700">Email Address</label>
                                    <div className="group relative">
                                        <FaEnvelope className={iconClass} />
                                        <input
                                            id="reg-email"
                                            type="email"
                                            required
                                            autoComplete="email"
                                            placeholder="you@example.com"
                                            className={inputClass}
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                        />
                                    </div>
                                </div>

                                <div className="reg-rise" style={rise(4)}>
                                    <label htmlFor="reg-password" className="mb-2 block text-sm font-semibold text-gray-700">Password</label>
                                    <div className="group relative">
                                        <FaLock className={iconClass} />
                                        <input
                                            id="reg-password"
                                            type={showPassword ? 'text' : 'password'}
                                            required
                                            autoComplete="new-password"
                                            placeholder="Create a password"
                                            className={`${inputClass} pr-12`}
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword((s) => !s)}
                                            aria-label={showPassword ? 'Hide password' : 'Show password'}
                                            aria-pressed={showPassword}
                                            className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
                                        >
                                            {showPassword ? <FaEyeSlash /> : <FaEye />}
                                        </button>
                                    </div>

                                    {password && (
                                        <div className="mt-3" aria-live="polite">
                                            <div className="flex gap-1.5">
                                                {[1, 2, 3, 4].map((n) => (
                                                    <span
                                                        key={n}
                                                        className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${
                                                            n <= strength ? STRENGTH_COLORS[strength] : 'bg-gray-200'
                                                        }`}
                                                    />
                                                ))}
                                            </div>
                                            <p className={`mt-1.5 text-xs font-medium ${STRENGTH_TEXT[strength]}`}>
                                                Password strength: {STRENGTH_LABELS[strength]}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div key="otp" className="reg-rise" style={rise(0)}>
                                <p className="mb-5 flex items-start gap-2.5 rounded-xl border border-green-200 bg-green-50 p-3.5 text-sm text-green-800">
                                    <FaCheckCircle className="mt-0.5 shrink-0" />
                                    <span>An OTP has been sent to your email. Please verify your account.</span>
                                </p>
                                <label htmlFor="reg-otp" className="mb-2 block text-sm font-semibold text-gray-700">Verification Code (OTP)</label>
                                <div className="group relative">
                                    <FaKey className={iconClass} />
                                    <input
                                        id="reg-otp"
                                        type="text"
                                        required
                                        inputMode="numeric"
                                        autoComplete="one-time-code"
                                        placeholder="6-digit code"
                                        className={`${inputClass} pr-4 text-center text-lg font-bold tracking-[0.4em]`}
                                        value={otp}
                                        onChange={(e) => setOtp(e.target.value)}
                                        maxLength="6"
                                    />
                                </div>
                            </div>
                        )}

                        <div className="reg-rise pt-2" style={rise(showOTP ? 1 : 5)}>
                            <button
                                type="submit"
                                disabled={loading}
                                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gray-900 py-3.5 font-bold text-white shadow-md transition-all duration-200 hover:-translate-y-0.5 hover:bg-black hover:shadow-lg focus:outline-none focus-visible:ring-4 focus-visible:ring-rose-200 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:translate-y-0"
                            >
                                {loading && (
                                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" aria-hidden="true" />
                                )}
                                {loading ? 'Processing...' : (showOTP ? 'Verify & Complete' : 'Sign Up')}
                            </button>
                        </div>
                    </form>

                    {!showOTP && (
                        <p className="reg-rise mt-8 text-center text-gray-600" style={rise(6)}>
                            Already have an account?{' '}
                            <Link to="/login" className="rounded font-bold text-gray-900 underline-offset-4 hover:text-rose-600 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400">
                                Log in
                            </Link>
                        </p>
                    )}
                </section>
            </div>
        </div>
    );
};

export default Register;