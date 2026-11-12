
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');

const User = require('./models/User');
const Event = require('./models/Event');
const Booking = require('./models/Bookings');

dotenv.config();

const users = [
    { name: 'Admin User', email: 'admin@eventora.com', password: 'password123', role: 'admin' },
    { name: 'Demo User', email: 'user@eventora.com', password: 'password123', role: 'user' },
    { name: 'Alice Smith', email: 'alice@eventora.com', password: 'password123', role: 'user' },
    { name: 'Bob Johnson', email: 'bob@eventora.com', password: 'password123', role: 'user' },
    { name: 'Charlie Dave', email: 'charlie@eventora.com', password: 'password123', role: 'user' },
    { name: 'Diana Prince', email: 'diana@eventora.com', password: 'password123', role: 'user' },
    { name: 'Ethan Hunt', email: 'ethan@eventora.com', password: 'password123', role: 'user' },
    { name: 'Fiona Gallagher', email: 'fiona@eventora.com', password: 'password123', role: 'user' },
    { name: 'George Miller', email: 'george@eventora.com', password: 'password123', role: 'user' },
    { name: 'Hannah Montana', email: 'hannah@eventora.com', password: 'password123', role: 'user' }
];

const events = [
    {
        title: 'React & Node.js Developer Retreat',
        description: 'Join us for a 3-day deep dive into modern full-stack web development.',
        date: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
        location: 'Silicon Valley Innovation Center, CA',
        category: 'Technology',
        totalSeats: 200,
        ticketPrice: 0,
        imageUrl: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&q=80&w=800'
    },
    {
        title: 'Neon Nights EDM Festival',
        description: 'Experience an unforgettable night of EDM, techno, and dazzling light shows.',
        date: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
        location: 'Grand Arena, New York',
        category: 'Music',
        totalSeats: 500,
        ticketPrice: 1500,
        imageUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&q=80&w=800'
    },
    {
        title: 'Global Leaders Business Summit',
        description: 'A gathering of business leaders discussing global commerce and AI.',
        date: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
        location: 'The Ritz-Carlton, London',
        category: 'Business',
        totalSeats: 150,
        ticketPrice: 5000,
        imageUrl: 'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?auto=format&fit=crop&q=80&w=800'
    },
    {
        title: 'Modern Art Expo',
        description: 'Discover contemporary art from emerging and established artists.',
        date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
        location: 'Downtown Art Museum',
        category: 'Art',
        totalSeats: 300,
        ticketPrice: 200,
        imageUrl: 'https://images.unsplash.com/photo-1536924940846-227afb31e2a5?auto=format&fit=crop&q=80&w=800'
    },
    {
        title: 'Startup Pitch Competition',
        description: 'Watch startups pitch their ideas to investors and entrepreneurs.',
        date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        location: 'Convention Center, Miami',
        category: 'Business',
        totalSeats: 250,
        ticketPrice: 100,
        imageUrl: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&q=80&w=800'
    },
    {
        title: 'Cloud Computing Architecture Seminar',
        description: 'Explore scalable cloud solutions, routing, and serverless computing.',
        date: new Date(Date.now() + 12 * 24 * 60 * 60 * 1000),
        location: 'Tech Hub, Seattle',
        category: 'Technology',
        totalSeats: 100,
        ticketPrice: 600,
        imageUrl: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&q=80&w=800'
    }
];

const seedDatabase = async () => {
    try {
        const mongoURI =
            process.env.MONGO_URI ||
            'mongodb://127.0.0.1:27017/eventora';

        await mongoose.connect(mongoURI);

        console.log('✅ MongoDB connected successfully');

        // WARNING: This deletes all existing data in these collections.
        // Use only with your development/test database.
        await Booking.deleteMany({});
        await Event.deleteMany({});
        await User.deleteMany({});

        console.log('🗑️ Existing users, events, and bookings cleared');

        // Hash passwords before saving users
        const salt = await bcrypt.genSalt(10);

        const hashedUsers = await Promise.all(
            users.map(async (user) => ({
                ...user,
                password: await bcrypt.hash(user.password, salt),
                isVerified: true
            }))
        );

        const createdUsers = await User.insertMany(hashedUsers);

        const adminUser = createdUsers.find(
            (user) => user.role === 'admin'
        );

        const normalUsers = createdUsers.filter(
            (user) => user.role === 'user'
        );

        if (!adminUser || normalUsers.length === 0) {
            throw new Error('Admin or normal users were not created');
        }

        console.log(`👤 Created ${createdUsers.length} users`);

        // Add admin ID and initialize available seats
        const eventsWithAdmin = events.map((event) => ({
            ...event,
            availableSeats: event.totalSeats,
            createdBy: adminUser._id
        }));

        const createdEvents = await Event.insertMany(eventsWithAdmin);

        console.log(`🎉 Created ${createdEvents.length} events`);

        // Generate demo bookings
        const bookingsData = [];

        for (const event of createdEvents) {
            const randomCount = Math.floor(Math.random() * 4) + 3;

            const shuffledUsers = [...normalUsers].sort(
                () => Math.random() - 0.5
            );

            const selectedUsers = shuffledUsers.slice(0, randomCount);

            let confirmedCount = 0;

            for (const user of selectedUsers) {
                const statuses = ['pending', 'confirmed', 'cancelled'];

                const status =
                    statuses[Math.floor(Math.random() * statuses.length)];

                let paymentStatus = 'non_paid';

                if (event.ticketPrice === 0) {
                    // No payment is required for free events
                    paymentStatus = 'paid';
                } else if (status === 'confirmed') {
                    paymentStatus =
                        Math.random() > 0.1 ? 'paid' : 'non_paid';
                }

                bookingsData.push({
                    userId: user._id,
                    eventId: event._id,
                    status,
                    paymentStatus,
                    amount: event.ticketPrice
                });

                if (status === 'confirmed') {
                    confirmedCount++;
                }
            }

            // Deduct seats for confirmed bookings
            event.availableSeats = Math.max(
                0,
                event.totalSeats - confirmedCount
            );

            await event.save();
        }

        if (bookingsData.length > 0) {
            await Booking.insertMany(bookingsData);
        }

        console.log(`🎫 Created ${bookingsData.length} demo bookings`);

        console.log('\n🚀 Database seeded successfully!');
        console.log('--------------------------------------');
        console.log('Admin email: admin@eventora.com');
        console.log('User email:  user@eventora.com');
        console.log('Password:    password123');
        console.log('--------------------------------------');
    } catch (error) {
        console.error('❌ Error seeding data:', error);
        process.exitCode = 1;
    } finally {
        await mongoose.disconnect();
        console.log('MongoDB connection closed');
    }
};

seedDatabase();
