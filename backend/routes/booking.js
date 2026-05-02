const express = require('express');
const router = express.Router();
const Booking = require('../models/Booking');
const ShowSeat = require('../models/ShowSeat');
const mongoose = require('mongoose');

const seatCache = new Map();
const CACHE_DURATION = 2 * 1000;

const seatLocks = new Map();
const LOCK_TIMEOUT = 5 * 60 * 1000;

const getCacheKey = (movie, city, showtime, date) => 
    `${movie}_${city}_${showtime}_${date}`;

const lockSeats = (movie, city, showtime, date, seats) => {
    const lockKey = getCacheKey(movie, city, showtime, date);
    const currentLocks = seatLocks.get(lockKey) || new Map();
    
    seats.forEach(seat => {
        currentLocks.set(seat, Date.now());
    });
    
    seatLocks.set(lockKey, currentLocks);
};

const areSeatsLocked = (movie, city, showtime, date, seats) => {
    const lockKey = getCacheKey(movie, city, showtime, date);
    const currentLocks = seatLocks.get(lockKey);
    
    if (!currentLocks) return false;
    
    const now = Date.now();
    return seats.some(seat => {
        const lockTime = currentLocks.get(seat);
        return lockTime && (now - lockTime) < LOCK_TIMEOUT;
    });
};

router.get('/seat-status', async (req, res) => {
    const { movie, city, showtime, date } = req.query;
    try {
        const bookings = await Booking.find({
            movie,
            city,
            showtime,
            showDate: { $gte: new Date(date), $lt: new Date(new Date(date).getTime() + 24*60*60*1000) }
        });
        const seats = bookings.flatMap(b => b.seatsBooked.map(Number));
        res.json({ success: true, seats });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

router.post('/', async (req, res) => {
    try {
        const {
            user,
            movie,
            email,
            theaterId,
            theaterName,
            city,
            showtime,
            showDate,
            seatsBooked,
            numberOfSeats,
            totalAmount,
            paymentDetails,
            convenienceFee,
            taxes
        } = req.body;

        if (!user || !movie || !email || !showtime || !showDate || !seatsBooked || !seatsBooked.length) {
            console.error('Missing required booking fields:', {
                user: !!user,
                movie: !!movie,
                email: !!email,
                showtime: !!showtime,
                showDate: !!showDate,
                seatsBooked: !!(seatsBooked && seatsBooked.length)
            });
            return res.status(400).json({
                success: false,
                message: 'Missing required booking fields'
            });
        }

        const cacheKey = getCacheKey(movie, city, showtime, showDate);
        const requestedSeats = Array.isArray(seatsBooked) ? seatsBooked.map(Number) : [];
        if (areSeatsLocked(movie, city, showtime, showDate, requestedSeats)) {
            return res.status(409).json({
                success: false,
                message: 'Some selected seats are being booked by another user'
            });
        }

        lockSeats(movie, city, showtime, showDate, requestedSeats);
        try {
            const existingBookings = await Booking.find({
                movie,
                city,
                showtime,
                showDate: {
                    $gte: new Date(showDate),
                    $lt: new Date(new Date(showDate).setDate(new Date(showDate).getDate() + 1))
                },
                status: { $in: ['confirmed', 'completed'] }
            });
            const bookedSeats = existingBookings.flatMap(b => b.seatsBooked.map(Number));
            const conflictingSeats = requestedSeats.filter(seat => bookedSeats.includes(seat));
            
            if (conflictingSeats.length > 0) {
                return res.status(409).json({
                    success: false,
                    message: `Some selected seats are already booked: ${conflictingSeats.join(', ')}`
                });
            }

            const booking = new Booking({
                user,
                movie,
                email,
                theaterId: theaterId || `${city}_theater`,
                theaterName: theaterName || `${city} theater`,
                city,
                showtime,
                showDate: new Date(showDate),
                seatsBooked,
                numberOfSeats: numberOfSeats || seatsBooked.length,
                totalAmount: totalAmount || 0,
                paymentDetails: paymentDetails || { method: 'default', status: 'completed' },
                convenienceFee: convenienceFee || 0,
                taxes: taxes || 0,
                status: 'confirmed'
            });
            const savedBooking = await booking.save();
            seatCache.delete(cacheKey);
            res.status(201).json({ 
                success: true, 
                data: savedBooking,
                message: 'Booking created successfully'
            });
        } catch (dbError) {
            res.status(500).json({ 
                success: false, 
                message: 'Database error while creating booking',
                error: dbError.message 
            });
        }
    } catch (err) {
        res.status(500).json({ 
            success: false, 
            message: 'Failed to create booking',
            error: err.message 
        });
    }
});

router.get('/user/:userId', async (req, res) => {
  try {
    const bookings = await Booking.find({ user: req.params.userId });
    res.json(bookings);
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch user bookings. Please try again later.' });
  }
});

router.delete('/:bookingId', async (req, res) => {
  try {
    const bookingId = req.params.bookingId;
    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }
    
    const showDate = new Date(booking.showDate);
    const formattedDate = showDate.toISOString().split('T')[0];
    const showKey = `${booking.movie}_${booking.city}_${booking.showtime}_${formattedDate}`;
    const seatNumbers = booking.seatsBooked ? booking.seatsBooked.map(seat => Number(seat)) : [];
    try {
      const staticDeleteResult = await ShowSeat.deleteByBookingId(bookingId);
      if (!staticDeleteResult || staticDeleteResult.deletedCount === 0) {
        try {
          const objIdDeleteResult = await ShowSeat.deleteMany({ 
            bookingId: mongoose.Types.ObjectId(bookingId) 
          });
        } catch (e) {
          console.log('Error with ObjectId approach:', e.message);
        }
        
        const stringDeleteResult = await ShowSeat.deleteMany({ 
          bookingId: bookingId.toString() 
        });
        if (seatNumbers.length > 0) {
          const showKeyDeleteResult = await ShowSeat.deleteMany({
            showKey: showKey,
            seatNumber: { $in: seatNumbers }
          });
        }
        
        if (booking.user) {
          const userDeleteResult = await ShowSeat.deleteMany({
            showKey: showKey,
            bookedBy: booking.user
          });
        }
      }
      
      const remainingSeats = await ShowSeat.findByBookingId(bookingId);
      
      if (remainingSeats.length > 0) {
        console.log(`WARNING: ${remainingSeats.length} seats still found after deletion attempts:`, 
          remainingSeats.map(s => ({ id: s._id, seat: s.seatNumber, showKey: s.showKey })));
        
        for (const seat of remainingSeats) {
          await ShowSeat.findByIdAndDelete(seat._id);
        }
      }
    } catch (seatDeleteError) {
      console.error(`Error deleting seats for booking ${bookingId}:`, seatDeleteError);
    }
    
    await Booking.findByIdAndDelete(bookingId);
    res.json({ success: true, message: 'Booking cancelled successfully' });
    
    try {
      const io = req.app.get('io');
      if (io) {
        io.emit('cancelBooking', { showKey });
      } else {
      }
    } catch (socketError) {
    }
    
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to cancel booking. Please try again later.' });
  }
});

router.get('/booked-seats', async (req, res) => {
  const { movie, city, showtime } = req.query;
  if (!movie || !city || !showtime) {
    return res.status(400).json({ success: false, message: 'Missing parameters' });
  }
  try {
    const bookings = await Booking.find({ movie, city, showtime });
    const seats = bookings.flatMap(b => b.seatsBooked || []);
    const uniqueSeats = [...new Set(seats.map(Number))];
    res.json({ success: true, seats: uniqueSeats });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch booked seats. Please try again later.' });
  }
});

module.exports = router; 