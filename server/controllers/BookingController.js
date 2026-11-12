
const Booking = require('../models/Bookings');
const OTP = require('../models/OTP');
const Event = require('../models/Event');
const { sendOTPEmail, sendBookingEmail } = require('../utils/email');

const generateOtp = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

// Send booking OTP
exports.sendBookingOTP = async (req, res) => {
    try {
const email = req.user.email.trim().toLowerCase();
        const otp = generateOtp();

        await OTP.findOneAndDelete({
            email,
            action: 'event_booking'
        });

        await OTP.create({
            email,
            otp,
            action: 'event_booking',
            expiresAt: new Date(Date.now() + 5 * 60 * 1000)
        });

        await sendOTPEmail(email, otp, 'event_booking');

        res.status(200).json({
            message: 'OTP sent to email'
        });
    } catch (error) {
        res.status(500).json({
            error: error.message
        });
    }
};

// Book event after OTP verification
exports.bookEvent = async (req, res) => {
    try {
        const { eventId, otp } = req.body;
const email = req.user.email.trim().toLowerCase();
        if (!eventId || !otp) {
            return res.status(400).json({
                error: 'Event ID and OTP are required'
            });
        }

        const otpRecord = await OTP.findOne({
            email,
            otp: String(otp),
            action: 'event_booking',
            expiresAt: { $gt: new Date() }
        });

        if (!otpRecord) {
            return res.status(400).json({
                error: 'Invalid or expired OTP'
            });
        }

        const event = await Event.findById(eventId);

        if (!event) {
            return res.status(404).json({
                error: 'Event not found'
            });
        }

        if (event.availableSeats <= 0) {
            return res.status(400).json({
                error: 'No seats available'
            });
        }

        const existingBooking = await Booking.findOne({
            userId: req.user._id,
            eventId,
            status: { $ne: 'cancelled' }
        });

        if (existingBooking) {
            return res.status(400).json({
                error: 'You already have an active booking for this event'
            });
        }

        const booking = await Booking.create({
            userId: req.user._id,
            eventId,
            status: 'pending',
            paymentStatus: 'non_paid',
            amount: event.ticketPrice
        });

        await OTP.deleteMany({
            email,
            action: 'event_booking'
        });

        res.status(201).json({
            message: 'Booking created successfully',
            booking
        });
    } catch (error) {
        res.status(500).json({
            error: error.message
        });
    }
};

// Confirm booking (admin only)
exports.confirmBooking = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                message: 'Only admins can confirm bookings'
            });
        }

        const { paymentStatus } = req.body;

        if (
            paymentStatus !== undefined &&
            !['paid', 'non_paid'].includes(paymentStatus)
        ) {
            return res.status(400).json({
                message: 'Invalid payment status'
            });
        }

        const booking = await Booking.findById(req.params.id)
            .populate('userId', 'name email')
            .populate('eventId', 'title availableSeats');

        if (!booking) {
            return res.status(404).json({
                message: 'Booking not found'
            });
        }

        if (booking.status !== 'pending') {
            return res.status(400).json({
                message: `Cannot confirm a ${booking.status} booking`
            });
        }

        const event = await Event.findOneAndUpdate(
            {
                _id: booking.eventId._id,
                availableSeats: { $gt: 0 }
            },
            {
                $inc: { availableSeats: -1 }
            },
            { new: true }
        );

        if (!event) {
            return res.status(400).json({
                message: 'No seats available'
            });
        }

        booking.status = 'confirmed';

        if (paymentStatus !== undefined) {
            booking.paymentStatus = paymentStatus;
        }

        await booking.save();

        try {
            await sendBookingEmail(
                booking.userId.email,
                booking.userId.name,
                booking.eventId.title
            );
        } catch (emailError) {
            console.error('Booking email failed:', emailError.message);
        }

        res.status(200).json({
            message: 'Booking confirmed successfully',
            booking
        });
    } catch (error) {
        res.status(500).json({
            message: 'Server error',
            error: error.message
        });
    }
};

// Get bookings
exports.getMyBookings = async (req, res) => {
    try {
        const bookings = req.user.role === 'admin'
            ? await Booking.find()
                .populate('eventId')
                .populate('userId', 'name email')
                .sort({ createdAt: -1 })
            : await Booking.find({
                userId: req.user._id
            })
                .populate('eventId')
                .sort({ createdAt: -1 });

        res.status(200).json(bookings);
    } catch (error) {
        res.status(500).json({
            message: 'Server error',
            error: error.message
        });
    }
};

// Cancel booking
exports.cancelBooking = async (req, res) => {
    try {
        const booking = await Booking.findById(req.params.id);

        if (!booking) {
            return res.status(404).json({
                message: 'Booking not found'
            });
        }

        const isOwner =
            booking.userId.toString() === req.user._id.toString();

        if (!isOwner && req.user.role !== 'admin') {
            return res.status(403).json({
                message: 'Not authorized'
            });
        }

        if (booking.status === 'cancelled') {
            return res.status(400).json({
                message: 'Booking is already cancelled'
            });
        }

        const wasConfirmed = booking.status === 'confirmed';

        booking.status = 'cancelled';
        await booking.save();

        if (wasConfirmed) {
            await Event.findByIdAndUpdate(
                booking.eventId,
                { $inc: { availableSeats: 1 } }
            );
        }

        res.status(200).json({
            message: 'Booking cancelled successfully',
            booking
        });
    } catch (error) {
        res.status(500).json({
            message: 'Server error',
            error: error.message
        });
    }
};
 