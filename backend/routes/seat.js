module.exports = function(io) {
  const express = require('express');
  const router = express.Router();
  const ShowSeat = require('../models/ShowSeat');
  const mongoose = require('mongoose');
  
  const heldSeats = new Map();
  const HOLD_TIMEOUT = 5 * 60 * 1000;

  function getShowKey({ movie, city, showtime, date }) {
    return `${movie}_${city}_${showtime}_${date}`;
  }

  setInterval(() => {
    const now = Date.now();
    heldSeats.forEach((seats, showKey) => {
      seats.forEach((holdInfo, seatNumber) => {
        if (holdInfo.expiresAt < now) {
          seats.delete(seatNumber);
          emitSeatStatus(showKey);
        }
      });
      if (seats.size === 0) {
        heldSeats.delete(showKey);
      }
    });
  }, 30000);


  async function emitSeatStatus(showKey) {
    try {
      const bookedSeats = await ShowSeat.find({ showKey });
      
      const showHolds = heldSeats.get(showKey) || new Map();
      const heldSeatsArray = [];
      const now = Date.now();
      
      showHolds.forEach((holdInfo, seatNumber) => {
        if (holdInfo.expiresAt > now) {
          heldSeatsArray.push({
            showKey,
            seatNumber,
            status: 'held',
            heldBy: holdInfo.heldBy,
            holdExpiresAt: new Date(holdInfo.expiresAt)
          });
        }
      });
      
      const allSeats = [
        ...bookedSeats.map(seat => ({ 
          showKey: seat.showKey, 
          seatNumber: seat.seatNumber, 
          status: 'booked',
          bookedBy: seat.bookedBy
        })),
        ...heldSeatsArray
      ];
      
      console.log(`Emitting seat status for ${showKey}. Booked: ${bookedSeats.length}, Held: ${heldSeatsArray.length}`);
      io.to(showKey).emit('seatStatusUpdate', { showKey, seats: allSeats });
    } catch (error) {
      console.error('Error emitting seat status:', error);
    }
  }

  async function handleBookingCancellation(showKey) {
    console.log(`Processing booking cancellation for ${showKey}`);
    try {
      await emitSeatStatus(showKey);
      io.to(showKey).emit('seatStatusUpdate', { showKey, reload: true });
    } catch (error) {
      console.error('Error handling booking cancellation:', error);
    }
  }

  router.post('/hold', async (req, res) => {
    const { movie, city, showtime, date, seatNumber, user } = req.body;
    console.log('Hold request:', { movie, city, showtime, date, seatNumber, user });
    
    if (!user) {
        console.error('Hold request missing user');
        return res.status(400).json({ success: false, message: 'User is required' });
    }
    
    if (!seatNumber) {
        console.error('Hold request missing seatNumber');
        return res.status(400).json({ success: false, message: 'Seat number is required' });
    }
    
    const showKey = getShowKey({ movie, city, showtime, date });
    const now = Date.now();
    const expiresAt = now + HOLD_TIMEOUT;
    
    try {
        const bookedSeat = await ShowSeat.findOne({ showKey, seatNumber });
        if (bookedSeat) {
            console.log(`Seat ${seatNumber} already booked for ${showKey}`);
            return res.status(409).json({ success: false, message: 'Seat already booked' });
        }
        
        let showHolds = heldSeats.get(showKey);
        if (!showHolds) {
            showHolds = new Map();
            heldSeats.set(showKey, showHolds);
        }
        
        const existingHold = showHolds.get(Number(seatNumber));
        if (existingHold && existingHold.heldBy !== user && existingHold.expiresAt > now) {
            console.log(`Seat ${seatNumber} held by another user for ${showKey}`);
            return res.status(409).json({ success: false, message: 'Seat held by another user' });
        }
        
        showHolds.set(Number(seatNumber), { heldBy: user, expiresAt });
        console.log(`Seat ${seatNumber} now held by ${user} for ${showKey} until ${new Date(expiresAt)}`);
        
        const seatInfo = {
            showKey,
            seatNumber: Number(seatNumber),
            status: 'held',
            heldBy: user,
            holdExpiresAt: new Date(expiresAt)
        };
        
        res.json({ success: true, seat: seatInfo });
        
        try {
            await emitSeatStatus(showKey);
        } catch (emitError) {
            console.error('Error emitting seat status after hold:', emitError);
        }
    } catch (err) {
        console.error('Hold error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
  });

  router.post('/book', async (req, res) => {
    const { movie, city, showtime, date, seatNumber, user, bookingId } = req.body;
    console.log('Book request:', { movie, city, showtime, date, seatNumber, user, bookingId });
    
    if (!bookingId) {
        console.error('Book request missing bookingId');
        return res.status(400).json({ success: false, message: 'Booking ID is required' });
    }
    
    let parsedBookingId;
    try {
        if (mongoose.Types.ObjectId.isValid(bookingId)) {
            parsedBookingId = new mongoose.Types.ObjectId(bookingId);
            console.log(`Converted bookingId ${bookingId} to ObjectId: ${parsedBookingId}`);
        } else {
            parsedBookingId = bookingId.toString();
            console.log(`Using bookingId as string: ${parsedBookingId}`);
        }
    } catch (err) {
        console.error('Error parsing bookingId:', err);
        parsedBookingId = bookingId.toString();
    }
    
    const showKey = getShowKey({ movie, city, showtime, date });
    
    try {
        const existingBooking = await ShowSeat.findOne({ showKey, seatNumber });
        if (existingBooking) {
            console.log(`Seat ${seatNumber} already booked for ${showKey}`);
            return res.status(409).json({ success: false, message: 'Seat already booked' });
        }
        
        const showHolds = heldSeats.get(showKey);
        const existingHold = showHolds?.get(Number(seatNumber));
        
        if (!existingHold) {
            console.log(`Seat ${seatNumber} not held for ${showKey}`);
        } else if (existingHold.heldBy !== user) {
            console.log(`Seat ${seatNumber} held by different user for ${showKey}`);
            return res.status(409).json({ success: false, message: 'Seat not held by you' });
        } else if (existingHold.expiresAt < Date.now()) {
            console.log(`Hold for seat ${seatNumber} has expired for ${showKey}`);
            return res.status(409).json({ success: false, message: 'Hold has expired' });
        }
        
        const seat = new ShowSeat({
            showKey,
            seatNumber: Number(seatNumber),
            bookedBy: user,
            bookingId: parsedBookingId,
            status: 'booked'
        });
        
        console.log(`Saving seat ${seatNumber} to database for ${showKey} with bookingId:`, parsedBookingId);
        const savedSeat = await seat.save();
        console.log(`Saved seat with _id: ${savedSeat._id}, bookingId: ${savedSeat.bookingId}`);
        
        if (showHolds) {
            showHolds.delete(Number(seatNumber));
        }
        
        console.log(`Seat ${seatNumber} now booked by ${user} for ${showKey}`);
        res.json({ 
            success: true, 
            seat: {
                showKey,
                seatNumber: Number(seatNumber),
                status: 'booked',
                bookedBy: user,
                bookingId: parsedBookingId
            }
        });
        
        try {
            await emitSeatStatus(showKey);
        } catch (emitError) {
            console.error('Error emitting seat status after booking:', emitError);
        }
    } catch (err) {
        console.error('Book error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
  });

  router.post('/release', async (req, res) => {
    const { movie, city, showtime, date, seatNumber, user } = req.body;
    console.log('Release request:', { movie, city, showtime, date, seatNumber, user });
    
    const showKey = getShowKey({ movie, city, showtime, date });
    
    try {
        const showHolds = heldSeats.get(showKey);
        if (!showHolds) {
            console.log(`No holds found for show ${showKey}`);
            return res.json({ success: true });
        }
        
        const existingHold = showHolds.get(Number(seatNumber));
        if (!existingHold) {
            console.log(`Seat ${seatNumber} not held for ${showKey}`);
            return res.json({ success: true });
        }
        
        if (existingHold.heldBy !== user) {
            console.log(`Seat ${seatNumber} held by different user (${existingHold.heldBy}) for ${showKey}`);
            return res.json({ success: true });
        }
        
        showHolds.delete(Number(seatNumber));
        console.log(`Released hold on seat ${seatNumber} for ${showKey}`);
        
        res.json({ success: true });
        
        try {
            await emitSeatStatus(showKey);
        } catch (emitError) {
            console.error('Error emitting seat status after release:', emitError);
        }
    } catch (err) {
        console.error('Release error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
  });

  router.post('/release-batch', async (req, res) => {
    const { seats } = req.body;
    console.log(`Batch release request for ${seats?.length || 0} seats`);
    
    if (!seats || !Array.isArray(seats) || seats.length === 0) {
        return res.status(400).json({ success: false, message: 'No seats provided for release' });
    }
    
    try {
        const seatsByShowKey = {};
        
        for (const seat of seats) {
            const { movie, city, showtime, date, seatNumber, user } = seat;
            const showKey = getShowKey({ movie, city, showtime, date });
            
            if (!seatsByShowKey[showKey]) {
                seatsByShowKey[showKey] = [];
            }
            
            seatsByShowKey[showKey].push({ seatNumber: Number(seatNumber), user });
            
            const showHolds = heldSeats.get(showKey);
            if (showHolds) {
                const existingHold = showHolds.get(Number(seatNumber));
                if (existingHold && existingHold.heldBy === user) {
                    showHolds.delete(Number(seatNumber));
                    console.log(`Batch released seat ${seatNumber} for ${showKey}`);
                }
            }
        }
        
        for (const showKey of Object.keys(seatsByShowKey)) {
            try {
                await emitSeatStatus(showKey);
            } catch (emitError) {
                console.error(`Error emitting seat status for ${showKey} after batch release:`, emitError);
            }
        }
        
        res.json({ success: true, message: `Released ${seats.length} seats` });
    } catch (err) {
        console.error('Batch release error:', err);
        res.status(200).json({ success: true, message: 'Attempted to release seats' });
    }
  });

  router.get('/status', async (req, res) => {
    const { movie, city, showtime, date } = req.query;
    console.log('Status request:', { movie, city, showtime, date });
    
    if (!movie || !city || !showtime || !date) {
        console.error('Status request missing parameters');
        return res.status(400).json({ success: false, message: 'Missing required parameters' });
    }
    
    const showKey = getShowKey({ movie, city, showtime, date });
    
    try {
        const bookedSeats = await ShowSeat.find({ showKey });
        console.log(`Found ${bookedSeats.length} booked seats for ${showKey}`);
        
        const showHolds = heldSeats.get(showKey) || new Map();
        const heldSeatsArray = [];
        const now = Date.now();
        let holdCount = 0;
        
        showHolds.forEach((holdInfo, seatNumber) => {
            if (holdInfo.expiresAt > now) {
                holdCount++;
                heldSeatsArray.push({
                    showKey,
                    seatNumber,
                    status: 'held',
                    heldBy: holdInfo.heldBy,
                    holdExpiresAt: new Date(holdInfo.expiresAt)
                });
            }
        });
        console.log(`Found ${holdCount} held seats for ${showKey}`);
        
        const allSeats = [
            ...bookedSeats.map(seat => ({ 
                showKey: seat.showKey, 
                seatNumber: seat.seatNumber, 
                status: 'booked',
                bookedBy: seat.bookedBy
            })),
            ...heldSeatsArray
        ];
        
        console.log(`Returning ${allSeats.length} total seat statuses for ${showKey}`);
        res.json({ success: true, seats: allSeats });
        
        try {
            await emitSeatStatus(showKey);
        } catch (emitError) {
            console.error('Error emitting seat status during status request:', emitError);
        }
    } catch (err) {
        console.error('Status error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
  });

  io.on('cancelBooking', async (data) => {
    try {
      console.log(`Received cancelBooking event for ${data.showKey}`);
      await handleBookingCancellation(data.showKey);
    } catch (error) {
      console.error('Error handling cancelBooking event:', error);
    }
  });

  return router;
};