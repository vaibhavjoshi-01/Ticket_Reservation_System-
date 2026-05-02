const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", 
    methods: ["GET", "POST"]
  }
});

const seatCache = {
  cache: new Map(),
  locks: new Map(),
  
  getKey(movie, city, showtime, date, seatNumber) {
    return `${movie}_${city}_${showtime}_${date}_${seatNumber}`;
  },
  
  get(movie, city, showtime, date, seatNumber) {
    const key = this.getKey(movie, city, showtime, date, seatNumber);
    return this.cache.get(key);
  },
  
  set(movie, city, showtime, date, seatNumber, status, user = null) {
    const key = this.getKey(movie, city, showtime, date, seatNumber);
    this.cache.set(key, { status, user, timestamp: Date.now() });
    return true;
  },
  
  async acquireLock(movie, city, showtime, date, seatNumber, timeout = 5000) {
    const key = this.getKey(movie, city, showtime, date, seatNumber);
    
    if (this.locks.has(key)) {
      return new Promise((resolve) => {
        const checkLock = () => {
          if (!this.locks.has(key)) {
            this.locks.set(key, true);
            resolve(true);
          } else {
            setTimeout(checkLock, 100);
          }
        };
        
        setTimeout(() => {
          if (this.locks.has(key)) {
            resolve(false);
          }
        }, timeout);
        
        checkLock();
      });
    }
    
    this.locks.set(key, true);
    return true;
  },
  
  releaseLock(movie, city, showtime, date, seatNumber) {
    const key = this.getKey(movie, city, showtime, date, seatNumber);
    this.locks.delete(key);
    return true;
  },
  
  invalidateShow(movie, city, showtime, date) {
    const prefix = `${movie}_${city}_${showtime}_${date}_`;
    
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }
  }
};

app.set('io', io);
app.set('seatCache', seatCache);

const userRoutes = require('./routes/user');
const bookingRoutes = require('./routes/booking');
const movieRoutes = require('./routes/movie');
const seatRoutes = require('./routes/seat')(io, seatCache);

app.use(cors());
app.use(express.json());
  
app.use('/api/users', userRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/movies', movieRoutes);
app.use('/api/seats', seatRoutes);

app.use('/api/seats/status', (req, res, next) => {
  res.set('Cache-Control', 'private, max-age=5');
  next();
});

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));


const MONGO_URI = 'mongodb://localhost:27017/bookmyshow';

const connectWithRetry = () => {
  mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => {
      server.listen(5000, () => console.log(`Server running on port 5000`));
    })
    .catch(err => {
      setTimeout(connectWithRetry, 5000);
    });
};

connectWithRetry();

io.on('connection', (socket) => {
  
  socket.on('joinShow', (showKey) => {
    socket.join(showKey);
    socket.emit('joined', { message: `Joined show: ${showKey}` });
  });

  socket.on('cancelBooking', (data) => {
    if (data.movie && data.city && data.showtime && data.date) {
      seatCache.invalidateShow(data.movie, data.city, data.showtime, data.date);
    }
    io.to(data.showKey).emit('seatStatusUpdate', { showKey: data.showKey, reload: true });
  });

  socket.on('disconnect', () => {
    return socket.id;
  });
}); 