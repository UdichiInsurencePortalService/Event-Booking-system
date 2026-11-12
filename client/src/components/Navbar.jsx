import React, { useContext, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { FaTicketAlt, FaBars, FaTimes } from 'react-icons/fa';

const Navbar = () => {
    const { user, logout } = useContext(AuthContext);
    const navigate = useNavigate();
    const location = useLocation();

    // UI-only state for the mobile menu
    const [menuOpen, setMenuOpen] = useState(false);
    const closeMenu = () => setMenuOpen(false);

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const dashboardPath = user && user.role === 'admin' ? '/admin' : '/dashboard';

    // Active-link styling (visual only)
    const linkClass = (path) =>
        `relative rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 ${
            location.pathname === path
                ? 'bg-white/10 text-white'
                : 'text-gray-300 hover:bg-white/5 hover:text-white'
        }`;

    const mobileLinkClass = (path) =>
        `block rounded-lg px-4 py-3 text-base font-medium transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 ${
            location.pathname === path
                ? 'bg-white/10 text-white'
                : 'text-gray-300 hover:bg-white/5 hover:text-white'
        }`;

    const primaryBtn =
        'inline-flex items-center justify-center rounded-lg bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm transition-colors duration-200 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900';

    const secondaryBtn =
        'inline-flex items-center justify-center rounded-lg border border-white/15 px-4 py-2 text-sm font-semibold text-white transition-colors duration-200 hover:border-white/30 hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400';

    return (
        <nav className="sticky top-0 z-50 border-b border-white/10 bg-gray-900/95 shadow-md backdrop-blur supports-[backdrop-filter]:bg-gray-900/85">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex h-16 items-center justify-between">
                    {/* Brand */}
                    <Link
                        to="/"
                        onClick={closeMenu}
                        className="flex items-center gap-2.5 rounded-lg text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
                    >
                        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-600 text-base shadow-sm">
                            <FaTicketAlt />
                        </span>
                        <span className="text-xl font-bold tracking-tight">Eventora</span>
                    </Link>

                    {/* Desktop / tablet navigation */}
                    <div className="hidden items-center gap-1 md:flex">
                        <Link to="/" className={linkClass('/')}>Events</Link>
                        {user ? (
                            <>
                                <Link to={dashboardPath} className={linkClass(dashboardPath)}>Dashboard</Link>
                                <span className="mx-3 h-6 w-px bg-white/10" aria-hidden="true" />
                                <button onClick={handleLogout} className={secondaryBtn}>Logout</button>
                            </>
                        ) : (
                            <>
                                <Link to="/login" className={linkClass('/login')}>Login</Link>
                                <span className="mx-3 h-6 w-px bg-white/10" aria-hidden="true" />
                                <Link to="/register" className={primaryBtn}>Sign Up</Link>
                            </>
                        )}
                    </div>

                    {/* Mobile menu toggle */}
                    <button
                        type="button"
                        onClick={() => setMenuOpen((open) => !open)}
                        aria-label={menuOpen ? 'Close menu' : 'Open menu'}
                        aria-expanded={menuOpen}
                        aria-controls="mobile-menu"
                        className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-gray-200 transition-colors duration-200 hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 md:hidden"
                    >
                        {menuOpen ? <FaTimes className="text-lg" /> : <FaBars className="text-lg" />}
                    </button>
                </div>
            </div>

            {/* Mobile menu panel */}
            <div
                id="mobile-menu"
                className={`overflow-hidden border-white/10 transition-all duration-300 ease-in-out md:hidden ${
                    menuOpen ? 'max-h-96 border-t opacity-100' : 'max-h-0 opacity-0'
                }`}
            >
                <div className="container mx-auto space-y-1 px-4 pb-5 pt-3 sm:px-6">
                    <Link to="/" onClick={closeMenu} className={mobileLinkClass('/')}>Events</Link>
                    {user ? (
                        <>
                            <Link to={dashboardPath} onClick={closeMenu} className={mobileLinkClass(dashboardPath)}>Dashboard</Link>
                            <div className="pt-3">
                                <button
                                    onClick={() => {
                                        closeMenu();
                                        handleLogout();
                                    }}
                                    className={`${secondaryBtn} w-full py-3`}
                                >
                                    Logout
                                </button>
                            </div>
                        </>
                    ) : (
                        <>
                            <Link to="/login" onClick={closeMenu} className={mobileLinkClass('/login')}>Login</Link>
                            <div className="pt-3">
                                <Link to="/register" onClick={closeMenu} className={`${primaryBtn} w-full py-3`}>Sign Up</Link>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </nav>
    );
};

export default Navbar;