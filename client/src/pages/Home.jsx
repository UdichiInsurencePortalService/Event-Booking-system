import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import api from "../utils/axios";
import {
  FaCalendarAlt, FaMapMarkerAlt, FaSearch, FaRegClock, FaTicketAlt, FaShieldAlt,
  FaTimes, FaFilter, FaChevronLeft, FaChevronRight, FaRedo, FaMusic, FaLaughBeam,
  FaFutbol, FaTheaterMasks, FaTools, FaGlassCheers, FaBriefcase, FaGraduationCap,
  FaLaptopCode,
} from "react-icons/fa";

/* -------------------------------------------------------------------------- */
/*  Constants & helpers                                                       */
/* -------------------------------------------------------------------------- */

// Category cards. `keys` are matched against the category stored on each event.
// FIX: added a Technology card, so events like "Future Tech Summit 2026"
// (category "Technology") have a matching card instead of only appearing
// in the generic sections.
const CATEGORY_CARDS = [
  { label: "Music & Concerts", keys: ["music", "concert"], icon: FaMusic },
  { label: "Comedy Shows", keys: ["comedy", "stand-up", "standup"], icon: FaLaughBeam },
  { label: "Sports", keys: ["sport"], icon: FaFutbol },
  { label: "Theatre", keys: ["theatre", "theater", "drama"], icon: FaTheaterMasks },
  { label: "Workshops", keys: ["workshop"], icon: FaTools },
  { label: "Festivals", keys: ["festival", "fest"], icon: FaGlassCheers },
  { label: "Business Events", keys: ["business", "conference", "networking", "summit"], icon: FaBriefcase },
  { label: "Technology", keys: ["tech", "technology", "software", "ai", "coding", "hackathon"], icon: FaLaptopCode },
  { label: "Education", keys: ["education", "seminar", "course", "training"], icon: FaGraduationCap },
];

const DATE_OPTIONS = [
  { value: "", label: "Any date" },
  { value: "today", label: "Today" },
  { value: "week", label: "Next 7 days" },
  { value: "month", label: "Next 30 days" },
  { value: "custom", label: "Pick a date" },
];

const PRICE_OPTIONS = [
  { value: "", label: "Any price" },
  { value: "free", label: "Free" },
  { value: "under500", label: "Up to ₹500" },
  { value: "mid", label: "₹500 – ₹2,000" },
  { value: "high", label: "Above ₹2,000" },
];

const SORT_OPTIONS = [
  { value: "date", label: "Date: soonest first" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
  { value: "recent", label: "Recently added" },
];

const pad = (n) => String(n).padStart(2, "0");
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const formatDate = (value) => {
  const d = new Date(value);
  return isNaN(d)
    ? "Date to be announced"
    : d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
};

const priceOf = (e) => Number(e.ticketPrice) || 0;
const formatPrice = (e) => (priceOf(e) === 0 ? "FREE" : `₹${priceOf(e).toLocaleString("en-IN")}`);

// Events have a single `location` string (there are no separate city/venue fields)
const getLocation = (e) => String(e.location || "").trim();

const soldRatio = (e) => {
  const total = Number(e.totalSeats) || 0;
  if (total <= 0) return 0;
  return Math.min(1, Math.max(0, (total - (Number(e.availableSeats) || 0)) / total));
};

const matchesQuery = (e, q) => {
  const tokens = q.toLowerCase().split(/\s+/).filter(Boolean);
  if (!tokens.length) return true;
  const hay = [e.title, e.category, e.location].filter(Boolean).join(" ").toLowerCase();
  return tokens.every((t) => hay.includes(t));
};

// FIX: short keys such as "ai" or "tech" must match whole words, otherwise
// "ai" would match "rain", "fair", "mainstage" etc. Longer keys keep substring matching.
const keyMatches = (cat, key) =>
  key.length <= 3 ? new RegExp(`(^|[^a-z])${key}([^a-z]|$)`).test(cat) : cat.includes(key);

const matchesCategory = (e, selected) => {
  const cat = String(e.category || "").toLowerCase();
  const sel = selected.toLowerCase();
  if (cat === sel) return true;
  const card = CATEGORY_CARDS.find((c) => c.label.toLowerCase() === sel);
  return card ? card.keys.some((k) => keyMatches(cat, k)) : false;
};

const matchesDate = (e, preset, on) => {
  if (!preset) return true;
  const d = new Date(e.date);
  if (isNaN(d)) return false;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  if (preset === "today") return ymd(d) === ymd(start);
  if (preset === "week" || preset === "month") {
    const end = new Date(start);
    end.setDate(end.getDate() + (preset === "week" ? 7 : 30));
    return d >= start && d < end;
  }
  if (preset === "custom") return on ? ymd(d) === on : true;
  return true;
};

const matchesPrice = (e, price) => {
  const p = priceOf(e);
  if (price === "free") return p === 0;
  if (price === "under500") return p > 0 && p <= 500;
  if (price === "mid") return p > 500 && p <= 2000;
  if (price === "high") return p > 2000;
  return true;
};

const byRecent = (a, b) =>
  a.createdAt && b.createdAt
    ? new Date(b.createdAt) - new Date(a.createdAt)
    : String(b._id).localeCompare(String(a._id)); // Mongo ObjectIds are time-ordered

// FIX: the API may return a plain array or any wrapped/nested object. Walk the
// known wrapper keys (data, events, results, items, docs) to any depth and
// return the first array found. Throws (instead of silently returning []) when
// no array exists, so the real response shape is visible in the console.
const WRAPPER_KEYS = ["events", "data", "results", "items", "docs", "rows"];
const extractEvents = (payload) => {
  const find = (node, depth = 0) => {
    if (Array.isArray(node)) return node;
    if (!node || typeof node !== "object" || depth > 4) return null;
    for (const key of WRAPPER_KEYS) {
      if (key in node) {
        const found = find(node[key], depth + 1);
        if (found) return found;
      }
    }
    return null;
  };
  const list = find(payload);
  if (!list) {
    console.error("GET /events returned a response with no events array. Actual response:", payload);
    throw new Error("Unexpected events response shape");
  }
  const valid = list.filter((e) => e && typeof e === "object" && e._id);
  if (valid.length !== list.length) {
    console.warn(`Home: ${list.length - valid.length} item(s) in the response had no _id and were skipped`, list);
  }
  return valid;
};

const useDebounce = (value, delay = 250) => {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
};

/* -------------------------------------------------------------------------- */
/*  Small presentational components                                           */
/* -------------------------------------------------------------------------- */

const EventImage = ({ event, className = "" }) => {
  const [failed, setFailed] = useState(false);
  if (!event.imageUrl || failed) {
    return (
      <div className={`flex flex-col items-center justify-center gap-2 bg-gray-800 text-gray-400 ${className}`}>
        <FaTicketAlt className="text-3xl" />
        <span className="text-sm font-medium">{event.category || "Event"}</span>
      </div>
    );
  }
  return (
    <img
      src={event.imageUrl}
      alt={event.title}
      loading="lazy"
      onError={() => setFailed(true)}
      className={`object-cover ${className}`}
    />
  );
};

const SectionHeader = ({ title, subtitle, action }) => (
  <div className="mb-6 flex items-end justify-between gap-4">
    <div>
      <h2 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">{title}</h2>
      {subtitle && <p className="mt-1 text-sm text-gray-500">{subtitle}</p>}
    </div>
    {action}
  </div>
);

const EventCard = ({ event }) => {
  const total = Number(event.totalSeats) || 0;
  const available = Number(event.availableSeats) || 0;
  const pctLeft = total > 0 ? Math.min(100, Math.max(0, (available / total) * 100)) : 0;
  const soldOut = total > 0 && available <= 0;
  const fewLeft = !soldOut && total > 0 && pctLeft <= 20;

  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition-shadow duration-200 hover:shadow-lg">
      <div className="relative aspect-[16/10] overflow-hidden bg-gray-100">
        <EventImage event={event} className="h-full w-full" />
        <span
          className={`absolute right-3 top-3 rounded-full bg-white/95 px-3 py-1 text-sm font-semibold shadow-sm ${
            priceOf(event) === 0 ? "text-green-700" : "text-gray-900"
          }`}
        >
          {formatPrice(event)}
        </span>
        {soldOut && (
          <span className="absolute left-3 top-3 rounded-full bg-gray-900 px-3 py-1 text-xs font-semibold text-white">
            Sold out
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-5">
        {event.category && <p className="mb-1 text-sm font-semibold text-rose-600">{event.category}</p>}
        <h3 className="mb-3 line-clamp-2 text-lg font-bold leading-snug text-gray-900">{event.title}</h3>

        <div className="mb-4 flex flex-col gap-2 text-sm text-gray-600">
          <div className="flex items-start gap-2">
            <FaCalendarAlt className="mt-0.5 shrink-0 text-gray-400" />
            <span>{formatDate(event.date)}</span>
          </div>
          <div className="flex items-start gap-2">
            <FaMapMarkerAlt className="mt-0.5 shrink-0 text-gray-400" />
            <span className="line-clamp-1">{event.location}</span>
          </div>
        </div>

        <div className="mt-auto">
          <div className="mb-2 h-1.5 w-full rounded-full bg-gray-200">
            <div
              className={`h-1.5 rounded-full ${fewLeft ? "bg-amber-500" : "bg-gray-700"}`}
              style={{ width: `${pctLeft}%` }}
            />
          </div>
          <p className={`mb-4 text-xs ${fewLeft ? "font-medium text-amber-700" : "text-gray-500"}`}>
            {soldOut ? "No seats remaining" : `${available} of ${total} seats remaining`}
          </p>
          <Link
            to={`/events/${event._id}`}
            className="block w-full rounded-lg bg-gray-900 py-2.5 text-center text-sm font-semibold text-white transition-colors duration-200 hover:bg-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-2"
          >
            View Details
          </Link>
        </div>
      </div>
    </article>
  );
};

const SkeletonCard = () => (
  <div className="animate-pulse overflow-hidden rounded-2xl border border-gray-200 bg-white">
    <div className="aspect-[16/10] bg-gray-200" />
    <div className="space-y-3 p-5">
      <div className="h-3 w-1/4 rounded bg-gray-200" />
      <div className="h-5 w-3/4 rounded bg-gray-200" />
      <div className="h-3 w-1/2 rounded bg-gray-200" />
      <div className="h-3 w-2/3 rounded bg-gray-200" />
      <div className="mt-4 h-10 rounded-lg bg-gray-200" />
    </div>
  </div>
);

const GRID = "grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";

const SkeletonGrid = ({ count = 4 }) => (
  <div className={GRID}>
    {Array.from({ length: count }).map((_, i) => (
      <SkeletonCard key={i} />
    ))}
  </div>
);

const EmptyState = ({ title, message, action }) => (
  <div className="flex flex-col items-center rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-16 text-center">
    <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gray-100 text-xl text-gray-500">
      <FaSearch />
    </div>
    <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
    <p className="mt-1 max-w-md text-sm text-gray-500">{message}</p>
    {action && <div className="mt-6">{action}</div>}
  </div>
);

const FilterSelect = ({ label, value, onChange, children }) => (
  <label className="flex flex-col gap-1 text-xs font-medium text-gray-500">
    {label}
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 focus:border-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-200"
    >
      {children}
    </select>
  </label>
);

/* -------------------------------------------------------------------------- */
/*  Search box with live suggestions                                          */
/* -------------------------------------------------------------------------- */

const SearchBox = ({ events, initialValue, onSubmit }) => {
  const navigate = useNavigate();
  const [value, setValue] = useState(initialValue);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const boxRef = useRef(null);
  const debounced = useDebounce(value, 250);

  useEffect(() => setValue(initialValue), [initialValue]);

  useEffect(() => {
    const onDown = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const suggestions = useMemo(() => {
    const q = debounced.trim();
    if (q.length < 2) return [];
    return events.filter((e) => matchesQuery(e, q)).slice(0, 6);
  }, [debounced, events]);

  useEffect(() => setActive(-1), [suggestions]);

  const submit = (e) => {
    if (e) e.preventDefault();
    setOpen(false);
    onSubmit(value.trim());
  };

  const onKeyDown = (e) => {
    if (e.key === "Escape") return setOpen(false);
    if (!suggestions.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((i) => (i + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (e.key === "Enter" && active >= 0) {
      e.preventDefault();
      navigate(`/events/${suggestions[active]._id}`);
    }
  };

  const showList = open && value.trim().length >= 2;

  return (
    <div ref={boxRef} className="relative">
      <form onSubmit={submit} role="search" className="flex items-center gap-2 rounded-2xl bg-white p-2 shadow-lg">
        <div className="relative flex-1">
          <FaSearch className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={value}
            onChange={(e) => { setValue(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            onKeyDown={onKeyDown}
            placeholder="Search by event, category or location"
            autoComplete="off"
            role="combobox"
            aria-label="Search events"
            aria-expanded={showList}
            aria-controls="search-suggestions"
            aria-autocomplete="list"
            aria-activedescendant={active >= 0 ? `suggestion-${active}` : undefined}
            className="h-12 w-full rounded-xl bg-transparent pl-11 pr-10 text-base text-gray-900 placeholder-gray-400 focus:outline-none"
          />
          {value && (
            <button
              type="button"
              onClick={() => { setValue(""); setOpen(false); }}
              aria-label="Clear search text"
              className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-700"
            >
              <FaTimes />
            </button>
          )}
        </div>
        <button
          type="submit"
          className="h-12 shrink-0 rounded-xl bg-rose-600 px-5 text-sm font-semibold text-white transition-colors duration-200 hover:bg-rose-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-2"
        >
          Search
        </button>
      </form>

      {showList && (
        <div className="absolute left-0 right-0 top-full z-30 mt-2 overflow-hidden rounded-2xl border border-gray-200 bg-white text-gray-900 shadow-xl">
          {suggestions.length ? (
            <ul id="search-suggestions" role="listbox">
              {suggestions.map((s, i) => (
                <li key={s._id} id={`suggestion-${i}`} role="option" aria-selected={i === active}>
                  <Link
                    to={`/events/${s._id}`}
                    onClick={() => setOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 ${i === active ? "bg-gray-100" : "hover:bg-gray-50"}`}
                  >
                    <EventImage event={s} className="h-12 w-12 shrink-0 rounded-lg" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-gray-900">{s.title}</span>
                      <span className="block truncate text-xs text-gray-500">
                        {[s.category, s.location, formatDate(s.date)].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p id="search-suggestions" className="px-4 py-3 text-sm text-gray-500">
              No quick matches. Press Search to see all results.
            </p>
          )}
          <button
            type="button"
            onClick={() => submit()}
            className="w-full border-t border-gray-100 px-4 py-3 text-left text-sm font-medium text-rose-600 hover:bg-gray-50"
          >
            See all results for “{value.trim()}”
          </button>
        </div>
      )}
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/*  Featured carousel                                                         */
/* -------------------------------------------------------------------------- */

const FeaturedCarousel = ({ items }) => {
  const [index, setIndex] = useState(0);
  const i = Math.min(index, items.length - 1);
  const event = items[i];
  const go = (dir) => setIndex((i + dir + items.length) % items.length);

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gray-800 shadow-xl" aria-roledescription="carousel">
      <div className="relative aspect-[4/3]">
        <EventImage event={event} className="h-full w-full" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
        <span className="absolute left-4 top-4 rounded-full bg-white/95 px-3 py-1 text-xs font-semibold text-gray-900">
          Featured
        </span>
        <div className="absolute inset-x-0 bottom-0 p-5">
          {event.category && <p className="text-sm font-semibold text-rose-300">{event.category}</p>}
          <h3 className="mt-1 line-clamp-2 text-xl font-bold text-white">{event.title}</h3>
          <p className="mt-1 text-sm text-gray-200">
            {formatDate(event.date)}
            {event.location ? ` · ${event.location}` : ""} · {formatPrice(event)}
          </p>
          <Link
            to={`/events/${event._id}`}
            className="mt-4 inline-flex rounded-lg bg-white px-4 py-2 text-sm font-semibold text-gray-900 transition-colors hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
          >
            View Details
          </Link>
        </div>
      </div>

      {items.length > 1 && (
        <>
          <button
            type="button"
            onClick={() => go(-1)}
            aria-label="Previous featured event"
            className="absolute left-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <FaChevronLeft />
          </button>
          <button
            type="button"
            onClick={() => go(1)}
            aria-label="Next featured event"
            className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <FaChevronRight />
          </button>
          <div className="absolute right-4 top-4 flex gap-1.5">
            {items.map((_, n) => (
              <button
                key={n}
                type="button"
                onClick={() => setIndex(n)}
                aria-label={`Show featured event ${n + 1}`}
                className={`h-2 rounded-full transition-all ${n === i ? "w-5 bg-white" : "w-2 bg-white/50"}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/*  Home                                                                      */
/* -------------------------------------------------------------------------- */

const Home = () => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [visibleUpcoming, setVisibleUpcoming] = useState(8);
  const [searchParams, setSearchParams] = useSearchParams();
  const resultsRef = useRef(null);
  const pendingScroll = useRef(false);

  const q = searchParams.get("q") || "";
  const category = searchParams.get("category") || "";
  const place = searchParams.get("location") || "";
  const date = searchParams.get("date") || "";
  const on = searchParams.get("on") || "";
  const price = searchParams.get("price") || "";
  const sort = searchParams.get("sort") || "date";
  const isFiltering = Boolean(q || category || place || date || price);
  const activeFilterCount = [category, place, date, price].filter(Boolean).length;

  // FIX 1: accepts plain-array OR wrapped responses (see extractEvents).
  // FIX 2: `silent` lets us refresh in the background without flashing skeletons
  //        and without wiping the existing list if a refresh fails.
  const fetchEvents = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    setError("");
    try {
      // Same endpoint as the original page; search and filters run locally
      const res = await api.get("/events?search=");
      // FIX: if utils/axios has a response interceptor that already returns
      // response.data, `res` IS the payload and `res.data` would be undefined.
      const isAxiosResponse = res && typeof res === "object" && "status" in res && "data" in res && "headers" in res;
      const payload = isAxiosResponse ? res.data : res;
      const list = extractEvents(payload);
      console.debug(`Home: fetched ${list.length} events`, list.map((e) => e.title));
      setEvents(list);
    } catch (err) {
      console.error("Error fetching events:", err?.response?.status, err?.response?.data || err);
      if (!silent) setError("We couldn't load events right now. Please check your connection and try again.");
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  // FIX 3: the page used to fetch only once on mount, so a newly created event
  // never showed until a manual reload. Now it also refetches whenever the tab
  // or window becomes visible/focused again.
  useEffect(() => {
    fetchEvents();
    const refresh = () => {
      if (document.visibilityState === "visible") fetchEvents({ silent: true });
    };
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    window.addEventListener("pageshow", refresh); // back/forward cache restores
    return () => {
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("pageshow", refresh);
    };
  }, [fetchEvents]);

  const updateParams = useCallback(
    (patch, { replace = false, scroll = false } = {}) => {
      const next = new URLSearchParams(searchParams);
      Object.entries(patch).forEach(([k, v]) => {
        if (v === "" || v == null || (k === "sort" && v === "date")) next.delete(k);
        else next.set(k, v);
      });
      if (patch.date !== undefined && patch.date !== "custom") next.delete("on");
      if (scroll) {
        if (next.toString() === searchParams.toString()) {
          resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        } else {
          pendingScroll.current = true;
        }
      }
      setSearchParams(next, { replace });
    },
    [searchParams, setSearchParams]
  );

  const clearFilters = () => setSearchParams({});

  useEffect(() => {
    if (!pendingScroll.current) return;
    if (isFiltering && resultsRef.current) {
      resultsRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    pendingScroll.current = false;
  }, [searchParams, isFiltering]);

  const scrollToId = (id) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

  /* ----------------------------- derived data ----------------------------- */

  // FIX 4: events whose date can't be parsed used to be dropped silently.
  // They are now kept (shown as "Date to be announced") after the dated ones.
  const upcoming = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const dated = [];
    const undated = [];
    events.forEach((e) => {
      const d = new Date(e.date);
      if (isNaN(d)) undated.push(e);
      else if (d >= start) dated.push(e);
    });
    dated.sort((a, b) => new Date(a.date) - new Date(b.date));
    return [...dated, ...undated];
  }, [events]);

  const featured = useMemo(() => upcoming.filter((e) => e.imageUrl).slice(0, 5), [upcoming]);

  // "Trending" = upcoming events with the highest share of seats already booked.
  // A brand-new event with no bookings is intentionally not trending yet.
  const trending = useMemo(
    () =>
      upcoming
        .filter((e) => soldRatio(e) > 0)
        .sort((a, b) => soldRatio(b) - soldRatio(a))
        .slice(0, 4),
    [upcoming]
  );

  const recent = useMemo(() => [...upcoming].sort(byRecent).slice(0, 4), [upcoming]);

  const categoryCounts = useMemo(
    () => CATEGORY_CARDS.map((c) => upcoming.filter((e) => matchesCategory(e, c.label)).length),
    [upcoming]
  );

  const locationCards = useMemo(() => {
    const map = new Map();
    upcoming.forEach((e) => {
      const name = getLocation(e);
      if (!name) return;
      const key = name.toLowerCase();
      const entry = map.get(key) || { name, count: 0, image: "" };
      entry.count += 1;
      if (!entry.image && e.imageUrl) entry.image = e.imageUrl;
      map.set(key, entry);
    });
    return [...map.values()].sort((a, b) => b.count - a.count).slice(0, 8);
  }, [upcoming]);

  const realCategories = useMemo(() => {
    const set = new Map();
    upcoming.forEach((e) => {
      const c = String(e.category || "").trim();
      if (c) set.set(c.toLowerCase(), c);
    });
    const list = [...set.values()].sort((a, b) => a.localeCompare(b));
    if (category && !list.some((c) => c.toLowerCase() === category.toLowerCase())) list.unshift(category);
    return list;
  }, [upcoming, category]);

  const locationOptions = useMemo(() => {
    const set = new Map();
    upcoming.forEach((e) => {
      const c = getLocation(e);
      if (c) set.set(c.toLowerCase(), c);
    });
    const list = [...set.values()].sort((a, b) => a.localeCompare(b));
    if (place && !list.some((c) => c.toLowerCase() === place.toLowerCase())) list.unshift(place);
    return list;
  }, [upcoming, place]);

  const results = useMemo(() => {
    if (!isFiltering) return [];
    const list = upcoming.filter(
      (e) =>
        matchesQuery(e, q) &&
        (!category || matchesCategory(e, category)) &&
        (!place || getLocation(e).toLowerCase() === place.toLowerCase()) &&
        matchesDate(e, date, on) &&
        matchesPrice(e, price)
    );
    if (sort === "price-asc") list.sort((a, b) => priceOf(a) - priceOf(b));
    else if (sort === "price-desc") list.sort((a, b) => priceOf(b) - priceOf(a));
    else if (sort === "recent") list.sort(byRecent);
    return list;
  }, [upcoming, isFiltering, q, category, place, date, on, price, sort]);

  /* -------------------------------- render -------------------------------- */

  return (
    <div className="flex min-h-screen flex-col">
      {/* Hero */}
      <section className="relative mb-12 rounded-3xl bg-gray-900 text-white shadow-xl">
        <div className="grid items-center gap-10 p-6 sm:p-10 lg:grid-cols-5 lg:p-14">
          <div className={featured.length ? "lg:col-span-3" : "mx-auto w-full max-w-3xl text-center lg:col-span-5"}>
            <h1 className="text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
              Book tickets for the events happening around you
            </h1>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-gray-300 sm:text-lg">
              Concerts, comedy, sports, workshops and more. Search by event, category or location and book your seat in a
              few clicks.
            </p>

            <div className="mt-8 text-left">
              <SearchBox
                events={upcoming}
                initialValue={q}
                onSubmit={(value) => updateParams({ q: value }, { scroll: Boolean(value) })}
              />
            </div>

            <div className={`mt-6 flex flex-wrap gap-3 ${featured.length ? "" : "justify-center"}`}>
              <button
                type="button"
                onClick={() => scrollToId("upcoming")}
                className="rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-gray-900 transition-colors hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
              >
                Browse upcoming events
              </button>
              <button
                type="button"
                onClick={() => scrollToId("locations")}
                className="rounded-lg border border-white/20 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
              >
                Popular locations
              </button>
            </div>
          </div>

          {featured.length > 0 && (
            <div className="lg:col-span-2">
              <FeaturedCarousel items={featured} />
            </div>
          )}
        </div>
      </section>

      {error && !loading && (
        <div role="alert" className="mb-10 flex flex-col items-center gap-4 rounded-2xl border border-red-200 bg-red-50 px-6 py-10 text-center">
          <p className="max-w-md text-sm text-red-800">{error}</p>
          <button
            type="button"
            onClick={() => fetchEvents()}
            className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
          >
            <FaRedo /> Try again
          </button>
        </div>
      )}

      {/* Search results */}
      {isFiltering && !error && (
        <section ref={resultsRef} className="mb-16 scroll-mt-20" aria-live="polite">
          <SectionHeader
            title={q ? `Results for “${q}”` : "Matching events"}
            subtitle={loading ? "Loading events…" : `${results.length} upcoming ${results.length === 1 ? "event" : "events"} found`}
            action={
              <button
                type="button"
                onClick={clearFilters}
                className="shrink-0 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
              >
                Clear filters
              </button>
            }
          />

          <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-4">
            <div className="flex items-center justify-between gap-3 md:hidden">
              <button
                type="button"
                onClick={() => setFiltersOpen((o) => !o)}
                aria-expanded={filtersOpen}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-800"
              >
                <FaFilter className="text-gray-500" /> Filters
                {activeFilterCount > 0 && (
                  <span className="flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-rose-600 px-1 text-xs text-white">
                    {activeFilterCount}
                  </span>
                )}
              </button>
              <div className="w-44">
                <FilterSelect label="Sort by" value={sort} onChange={(v) => updateParams({ sort: v }, { replace: true })}>
                  {SORT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </FilterSelect>
              </div>
            </div>

            <div className={`${filtersOpen ? "grid" : "hidden"} mt-4 grid-cols-1 gap-3 sm:grid-cols-2 md:mt-0 md:grid md:grid-cols-3 lg:grid-cols-6`}>
              <FilterSelect label="Category" value={category} onChange={(v) => updateParams({ category: v }, { replace: true })}>
                <option value="">All categories</option>
                {realCategories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </FilterSelect>
              <FilterSelect label="Location" value={place} onChange={(v) => updateParams({ location: v }, { replace: true })}>
                <option value="">All locations</option>
                {locationOptions.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </FilterSelect>
              <FilterSelect label="Date" value={date} onChange={(v) => updateParams({ date: v }, { replace: true })}>
                {DATE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </FilterSelect>
              {date === "custom" && (
                <label className="flex flex-col gap-1 text-xs font-medium text-gray-500">
                  On this day
                  <input
                    type="date"
                    value={on}
                    onChange={(e) => updateParams({ on: e.target.value }, { replace: true })}
                    className="h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 focus:border-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-200"
                  />
                </label>
              )}
              <FilterSelect label="Price" value={price} onChange={(v) => updateParams({ price: v }, { replace: true })}>
                {PRICE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </FilterSelect>
              <div className="hidden md:block">
                <FilterSelect label="Sort by" value={sort} onChange={(v) => updateParams({ sort: v }, { replace: true })}>
                  {SORT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </FilterSelect>
              </div>
            </div>
          </div>

          {loading ? (
            <SkeletonGrid count={4} />
          ) : results.length === 0 ? (
            <EmptyState
              title="No events found"
              message="We couldn't find any upcoming events matching your search and filters. Try a different keyword or clear some filters."
              action={
                <button
                  type="button"
                  onClick={clearFilters}
                  className="rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-gray-700"
                >
                  Clear all filters
                </button>
              }
            />
          ) : (
            <div className={GRID}>
              {results.map((event) => (
                <EventCard key={event._id} event={event} />
              ))}
            </div>
          )}
        </section>
      )}

      {/* Discovery sections */}
      {!isFiltering && !error && (
        <>
          {/* Categories */}
          <section className="mb-16" aria-labelledby="categories-title">
            <SectionHeader title="Browse by category" subtitle="Find the kind of experience you're in the mood for" />
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
              {CATEGORY_CARDS.map((c, idx) => {
                const Icon = c.icon;
                return (
                  <button
                    key={c.label}
                    type="button"
                    onClick={() => updateParams({ category: c.label }, { scroll: true })}
                    className="flex flex-col items-center rounded-2xl border border-gray-200 bg-white p-5 text-center shadow-sm transition-shadow duration-200 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
                  >
                    <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-gray-900 text-lg text-white">
                      <Icon />
                    </span>
                    <span className="text-sm font-semibold text-gray-900">{c.label}</span>
                    {!loading && (
                      <span className="mt-0.5 text-xs text-gray-500">
                        {categoryCounts[idx]} {categoryCounts[idx] === 1 ? "event" : "events"}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </section>

          {/* Trending */}
          {!loading && trending.length > 0 && (
            <section className="mb-16">
              <SectionHeader title="Trending events" subtitle="Selling fastest right now" />
              <div className={GRID}>
                {trending.map((event) => (
                  <EventCard key={event._id} event={event} />
                ))}
              </div>
            </section>
          )}

          {/* Upcoming */}
          <section id="upcoming" className="mb-16 scroll-mt-20">
            <SectionHeader
              title="Upcoming events"
              subtitle={loading ? "Loading events…" : `${upcoming.length} ${upcoming.length === 1 ? "event" : "events"} coming up`}
            />
            {loading ? (
              <SkeletonGrid count={8} />
            ) : upcoming.length === 0 ? (
              <EmptyState
                title="No upcoming events yet"
                message="New events will show up here as soon as they're published. Please check back soon."
              />
            ) : (
              <>
                <div className={GRID}>
                  {upcoming.slice(0, visibleUpcoming).map((event) => (
                    <EventCard key={event._id} event={event} />
                  ))}
                </div>
                {upcoming.length > visibleUpcoming && (
                  <div className="mt-8 text-center">
                    <button
                      type="button"
                      onClick={() => setVisibleUpcoming((n) => n + 8)}
                      className="rounded-lg border border-gray-300 bg-white px-6 py-2.5 text-sm font-semibold text-gray-900 hover:bg-gray-100"
                    >
                      Show more events
                    </button>
                  </div>
                )}
              </>
            )}
          </section>

          {/* Popular locations */}
          {!loading && locationCards.length > 0 && (
            <section id="locations" className="mb-16 scroll-mt-20">
              <SectionHeader title="Popular locations" subtitle="Pick a location to see what's on" />
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                {locationCards.map((c) => (
                  <button
                    key={c.name}
                    type="button"
                    onClick={() => updateParams({ location: c.name }, { scroll: true })}
                    className="group relative h-32 overflow-hidden rounded-2xl bg-gray-800 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-2 sm:h-36"
                  >
                    {c.image && (
                      <img
                        src={c.image}
                        alt=""
                        loading="lazy"
                        onError={(e) => { e.currentTarget.style.display = "none"; }}
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                    )}
                    <span className="absolute inset-0 bg-black/55 transition-colors group-hover:bg-black/45" />
                    <span className="relative flex h-full flex-col justify-end p-4 text-white">
                      <span className="flex items-start gap-1.5 text-base font-bold leading-tight">
                        <FaMapMarkerAlt className="mt-1 shrink-0 text-sm text-rose-300" />
                        <span className="line-clamp-2">{c.name}</span>
                      </span>
                      <span className="text-xs text-gray-200">
                        {c.count} {c.count === 1 ? "event" : "events"}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* Recently added */}
          {!loading && recent.length > 0 && (
            <section className="mb-16">
              <SectionHeader title="Recently added" subtitle="The newest events on Eventora" />
              <div className={GRID}>
                {recent.map((event) => (
                  <EventCard key={event._id} event={event} />
                ))}
              </div>
            </section>
          )}

          {/* Why Eventora */}
          <section className="mb-16 grid grid-cols-1 gap-6 md:grid-cols-3">
            {[
              { icon: FaRegClock, title: "Fast booking", text: "Reserve your tickets in a few clicks with a booking flow built for speed." },
              { icon: FaTicketAlt, title: "Seamless access", text: "Download your tickets instantly and manage them from your personal dashboard." },
              { icon: FaShieldAlt, title: "Secure platform", text: "Registrations and transactions are protected with secure authentication and 2FA OTP." },
            ].map(({ icon: Icon, title, text }) => (
              <div key={title} className="flex flex-col items-center rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
                <span className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-900 text-xl text-white">
                  <Icon />
                </span>
                <h3 className="mb-2 text-lg font-bold text-gray-900">{title}</h3>
                <p className="text-sm leading-relaxed text-gray-500">{text}</p>
              </div>
            ))}
          </section>
        </>
      )}

      {/* Footer */}
      <footer className="mt-auto border-t border-gray-200 pb-8 pt-12 text-center">
        <div className="mb-4 flex items-center justify-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-600 text-white">
            <FaTicketAlt />
          </span>
          <span className="text-xl font-bold text-gray-900">Eventora</span>
        </div>
        <p className="mx-auto mb-6 max-w-md text-sm text-gray-500">
          The simplest way to discover, book and host events in your city. Let's make memories together.
        </p>
        <p className="text-xs text-gray-400">&copy; {new Date().getFullYear()} Eventora Platform. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default Home;