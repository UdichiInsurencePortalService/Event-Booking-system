import React, { useState, useEffect, useContext } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import api from "../utils/axios";
import { AuthContext } from "../context/AuthContext";
import {
  FaCalendarAlt,
  FaMapMarkerAlt,
  FaChair,
  FaMoneyBillWave,
  FaTag,
  FaTicketAlt,
  FaArrowLeft,
  FaExclamationCircle,
  FaCheckCircle,
} from "react-icons/fa";

/* -------------------------------------------------------------------------- */
/*  UI-only helpers (no effect on fetching or booking logic)                  */
/* -------------------------------------------------------------------------- */

const formatINR = (value) =>
  Number.isFinite(Number(value)) ? Number(value).toLocaleString("en-IN") : value;

// Hero image with a graceful fallback when the image is missing or fails to load
const HeroImage = ({ src, alt }) => {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-gray-800 text-gray-400">
        <FaTicketAlt className="text-5xl" />
        <span className="text-sm font-medium">No image available</span>
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      onError={() => setFailed(true)}
      className="ed-zoom h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
    />
  );
};

const InfoItem = ({ icon: Icon, label, children }) => (
  <div className="flex items-start gap-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gray-900 text-white">
      <Icon />
    </span>
    <div className="min-w-0">
      <p className="text-sm text-gray-500">{label}</p>
      <div className="mt-0.5 break-words font-semibold text-gray-900">{children}</div>
    </div>
  </div>
);

const STYLES = `
  @keyframes ed-fade { from { opacity: 0; } to { opacity: 1; } }
  @keyframes ed-zoom { from { transform: scale(1.08); } to { transform: scale(1); } }
  @keyframes ed-rise { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: none; } }
  .ed-hero { animation: ed-fade .6s ease-out both; }
  .ed-zoom { animation: ed-zoom 1.4s cubic-bezier(.22,1,.36,1) both; }
  .ed-rise { opacity: 0; animation: ed-rise .55s cubic-bezier(.22,1,.36,1) forwards; }
  @media (prefers-reduced-motion: reduce) {
    .ed-hero, .ed-zoom, .ed-rise { animation: none; opacity: 1; transform: none; }
  }
`;

const EventDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);

  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [otp, setOtp] = useState("");
  const [showOTP, setShowOTP] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [bookingDone, setBookingDone] = useState(false);

  // Fetch event details
  useEffect(() => {
    const fetchEvent = async () => {
      try {
        setLoading(true);
        setError("");

        const response = await api.get(`/events/${id}`);
        setEvent(response.data.event || response.data);
      } catch (err) {
        console.error("Fetch event error:", err.response?.data || err);
        setError(
          err.response?.data?.message || "Failed to load event details.",
        );
      } finally {
        setLoading(false);
      }
    };

    if (id) fetchEvent();
  }, [id]);

  // Start booking / verify OTP
  const handleBooking = async (e) => {
    e.preventDefault();

    if (!user) {
      navigate("/login");
      return;
    }

    if (!event?._id) {
      setError("Event details are not available. Please refresh.");
      return;
    }

    if (bookingDone) return;

    setBookingLoading(true);
    setError("");
    setSuccessMsg("");

    try {
      if (!showOTP) {
        // Step 1: Request OTP
        await api.post("/bookings/send-otp", {
          eventId: event._id,
        });

        setShowOTP(true);
        setSuccessMsg(
          "OTP sent to your registered email. Please enter it below.",
        );
      } else {
        // Step 2: Verify OTP and create booking
        if (!/^\d{6}$/.test(otp)) {
          setError("Please enter a valid 6-digit OTP.");
          return;
        }

        const response = await api.post("/bookings", {
          eventId: event._id,
          otp: otp.trim(),
        });

        setBookingDone(true);
        setShowOTP(false);
        setOtp("");

        setSuccessMsg(
          response.data?.message ||
            "Booking requested successfully! Awaiting admin confirmation.",
        );

        // Refresh the event data from the backend
        try {
          const refreshed = await api.get(`/events/${id}`);
          setEvent(refreshed.data.event || refreshed.data);
        } catch (refreshError) {
          console.error("Event refresh error:", refreshError);
        }
      }
    } catch (err) {
      console.error("Booking API error:", {
        status: err.response?.status,
        data: err.response?.data,
        message: err.message,
      });

      setError(
        err.response?.data?.message ||
          err.response?.data?.error ||
          (err.response?.status === 401
            ? "Please log in again to continue."
            : err.response?.status === 404
              ? "Booking API route not found. Check your backend routes."
              : "Booking failed. Please check your server and try again."),
      );
    } finally {
      setBookingLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-6xl animate-pulse px-4 pb-12 pt-6 sm:px-6" aria-busy="true" aria-label="Loading event">
        <div className="mb-4 h-5 w-32 rounded bg-gray-200" />
        <div className="aspect-[4/3] rounded-3xl bg-gray-200 sm:aspect-[16/9] lg:aspect-[21/9]" />
        <div className="mt-8 grid gap-8 lg:grid-cols-3">
          <div className="order-2 space-y-6 lg:order-1 lg:col-span-2">
            <div className="h-48 rounded-2xl bg-gray-200" />
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="h-24 rounded-2xl bg-gray-200" />
              <div className="h-24 rounded-2xl bg-gray-200" />
            </div>
          </div>
          <div className="order-1 h-80 rounded-2xl bg-gray-200 lg:order-2" />
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center px-4 py-20 text-center">
        <span className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-red-50 text-2xl text-red-500">
          <FaExclamationCircle />
        </span>
        <h2 className="mb-2 text-2xl font-bold text-gray-900">We couldn't open this event</h2>
        <p role="alert" className="mb-8 break-words text-gray-600">
          {error || "Event not found."}
        </p>
        <Link
          to="/"
          className="rounded-xl bg-gray-900 px-6 py-3 font-semibold text-white shadow-md transition-all duration-200 hover:-translate-y-0.5 hover:bg-black hover:shadow-lg focus:outline-none focus-visible:ring-4 focus-visible:ring-rose-200"
        >
          Browse events
        </Link>
      </div>
    );
  }

  const availableSeats = Number(event.availableSeats ?? 0);
  const isSoldOut = availableSeats <= 0;

  // Display-only values
  const totalSeats = Number(event.totalSeats) || 0;
  const seatsPct = totalSeats > 0 ? Math.min(100, Math.max(0, (availableSeats / totalSeats) * 100)) : 0;
  const eventDate = event.date ? new Date(event.date) : null;
  const validDate = eventDate && !isNaN(eventDate);
  const dateText = validDate
    ? eventDate.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
    : "Date not available";
  // Only show a time when the stored date actually carries one
  const timeText =
    validDate && (eventDate.getHours() !== 0 || eventDate.getMinutes() !== 0)
      ? eventDate.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })
      : "";
  const isFree = Number(event.ticketPrice) === 0;
  const fewLeft = !isSoldOut && availableSeats < 10;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-12 pt-6 sm:px-6">
      <style>{STYLES}</style>

      <Link
        to="/"
        className="ed-rise mb-4 inline-flex items-center gap-2 rounded-lg text-sm font-medium text-gray-600 transition-colors hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
      >
        <FaArrowLeft className="text-xs" /> Back to events
      </Link>

      {/* ------------------------------ Hero ------------------------------ */}
      <section className="ed-hero group relative overflow-hidden rounded-3xl bg-gray-900 shadow-xl">
        <div className="relative aspect-[4/3] sm:aspect-[16/9] lg:aspect-[21/9]">
          <HeroImage src={event.imageUrl} alt={event.title} />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />

          <div className="absolute inset-x-0 bottom-0 p-5 sm:p-8 lg:p-10">
            <span className="ed-rise mb-3 inline-flex items-center gap-2 rounded-full bg-white/95 px-3 py-1 text-sm font-semibold text-gray-900" style={{ animationDelay: "150ms" }}>
              <FaTag className="text-rose-600" /> {event.category || "General"}
            </span>
            <h1 className="ed-rise max-w-3xl text-3xl font-bold leading-tight tracking-tight text-white sm:text-4xl lg:text-5xl" style={{ animationDelay: "230ms" }}>
              {event.title}
            </h1>
            <div className="ed-rise mt-4 flex flex-wrap gap-2 text-sm text-white sm:text-base" style={{ animationDelay: "310ms" }}>
              <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3.5 py-1.5 backdrop-blur">
                <FaCalendarAlt className="shrink-0" />
                {dateText}
                {timeText && ` · ${timeText}`}
              </span>
              <span className="inline-flex max-w-full items-center gap-2 rounded-full bg-white/15 px-3.5 py-1.5 backdrop-blur">
                <FaMapMarkerAlt className="shrink-0" />
                <span className="truncate">{event.location || "Location not available"}</span>
              </span>
            </div>
          </div>
        </div>
      </section>

      <div className="mt-8 grid gap-8 lg:grid-cols-3 lg:items-start">
        {/* ------------------------- Booking card ------------------------- */}
        <aside className="ed-rise order-1 lg:sticky lg:top-24 lg:order-2" style={{ animationDelay: "250ms" }}>
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-lg">
            <h2 className="mb-5 text-xl font-bold text-gray-900">Booking Details</h2>

            <div className="mb-5 flex items-center gap-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gray-900 text-white">
                <FaMoneyBillWave />
              </span>
              <div>
                <p className="text-sm text-gray-500">Ticket price</p>
                <p className="text-2xl font-bold text-gray-900">
                  {isFree ? (
                    <span className="rounded-lg bg-green-50 px-2.5 py-0.5 text-green-700">FREE</span>
                  ) : (
                    `₹${formatINR(event.ticketPrice)}`
                  )}
                </p>
              </div>
            </div>

            <div className="mb-6 rounded-xl bg-gray-50 p-4">
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-gray-600">
                  <FaChair className="text-gray-400" /> Seats available
                </span>
                <span className="font-bold text-gray-900">
                  <span className={availableSeats < 10 ? "text-orange-500" : ""}>{availableSeats}</span>
                  {" / "}
                  {event.totalSeats}
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-gray-200">
                <div
                  className={`h-2 rounded-full transition-all duration-500 ${fewLeft ? "bg-orange-500" : "bg-gray-700"}`}
                  style={{ width: `${seatsPct}%` }}
                />
              </div>
              {(isSoldOut || fewLeft) && (
                <p className={`mt-2 text-xs font-medium ${isSoldOut ? "text-gray-600" : "text-orange-600"}`}>
                  {isSoldOut ? "This event is sold out." : `Only ${availableSeats} ${availableSeats === 1 ? "seat" : "seats"} left. Book soon.`}
                </p>
              )}
            </div>

            <form onSubmit={handleBooking}>
              {showOTP && (
                <div className="mb-4">
                  <label
                    htmlFor="booking-otp"
                    className="mb-2 block text-sm font-semibold text-gray-700"
                  >
                    Enter OTP to Confirm
                  </label>

                  <input
                    id="booking-otp"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    required
                    placeholder="6-digit code"
                    className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-center text-lg font-bold tracking-[0.4em] text-gray-900 placeholder-gray-400 shadow-sm outline-none transition-all duration-200 hover:border-gray-400 focus:border-rose-500 focus:ring-4 focus:ring-rose-100"
                    value={otp}
                    onChange={(e) =>
                      setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
                    }
                    maxLength={6}
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={
                  isSoldOut ||
                  bookingLoading ||
                  bookingDone ||
                  (showOTP && otp.length !== 6)
                }
                className={`flex w-full items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-lg font-bold shadow-md transition-all duration-200 focus:outline-none focus-visible:ring-4 focus-visible:ring-rose-200 ${
                  isSoldOut || bookingDone
                    ? "cursor-not-allowed bg-gray-300 text-gray-500"
                    : "bg-gray-900 text-white hover:-translate-y-0.5 hover:bg-black hover:shadow-lg active:translate-y-0 active:scale-[0.99]"
                } disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0`}
              >
                {bookingLoading && (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" aria-hidden="true" />
                )}
                {bookingLoading
                  ? "Processing..."
                  : bookingDone
                    ? "Booking Requested"
                    : isSoldOut
                      ? "Sold Out"
                      : showOTP
                        ? "Verify OTP & Confirm"
                        : "Book Now"}
              </button>
            </form>

            {!user && !isSoldOut && !bookingDone && (
              <p className="mt-3 text-center text-xs text-gray-500">You'll be asked to log in before booking.</p>
            )}

            {error && (
              <p
                role="alert"
                className="ed-rise mt-4 flex items-start gap-2.5 break-words rounded-xl border border-red-200 bg-red-50 p-3 text-left text-sm font-medium text-red-700"
              >
                <FaExclamationCircle className="mt-0.5 shrink-0" />
                <span className="min-w-0">{error}</span>
              </p>
            )}

            {successMsg && (
              <p
                role="status"
                className="ed-rise mt-4 flex items-start gap-2.5 rounded-xl border border-green-200 bg-green-50 p-3 text-left text-sm font-medium text-green-800"
              >
                <FaCheckCircle className="mt-0.5 shrink-0" />
                <span className="min-w-0">{successMsg}</span>
              </p>
            )}
          </div>
        </aside>

        {/* ------------------------- Main content ------------------------- */}
        <div className="order-2 space-y-8 lg:order-1 lg:col-span-2">
          <section className="ed-rise rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8" style={{ animationDelay: "320ms" }}>
            <h2 className="mb-4 text-2xl font-bold tracking-tight text-gray-900">About this event</h2>
            {event.description ? (
              <p className="whitespace-pre-line break-words text-base leading-relaxed text-gray-600 sm:text-lg sm:leading-8">
                {event.description}
              </p>
            ) : (
              <p className="text-gray-500">No description has been added for this event yet.</p>
            )}
          </section>

          <section className="ed-rise" style={{ animationDelay: "400ms" }}>
            <h2 className="mb-4 text-2xl font-bold tracking-tight text-gray-900">Event information</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <InfoItem icon={FaCalendarAlt} label="Date and time">
                {dateText}
                {timeText && <span className="block text-sm font-medium text-gray-600">{timeText}</span>}
              </InfoItem>
              <InfoItem icon={FaMapMarkerAlt} label="Location">
                {event.location || "Location not available"}
              </InfoItem>
              <InfoItem icon={FaTag} label="Category">
                {event.category || "General"}
              </InfoItem>
              <InfoItem icon={FaChair} label="Seat availability">
                {isSoldOut ? "Sold out" : `${availableSeats} of ${event.totalSeats} seats left`}
              </InfoItem>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default EventDetail;