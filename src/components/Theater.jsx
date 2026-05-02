import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { moviesAPI, bookingsAPI, seatAPI, requestCache } from '../services/api';
import './Theater.css';
import { FaStar, FaPlay } from 'react-icons/fa';
import { useUser } from '../UserContext';
import { io } from 'socket.io-client';

const socket = io('http://localhost:5000', { autoConnect: false });

const getShowKey = (city, movieId, showTime, date) => {
  return `${city}_${movieId}_${showTime}_${date}`;
};

const showTimes = [
  { label: "Morning", value: "morning", display: "09:00 AM" },
  { label: "Afternoon", value: "afternoon", display: "01:00 PM" },
  { label: "Evening", value: "evening", display: "06:00 PM" },
  { label: "Late Night", value: "late_night", display: "10:00 PM" }
];

const Theater = () => {
    const { movieId } = useParams();
    const navigate = useNavigate();
    const { user, setUser } = useUser();
    const [movie, setMovie] = useState(null);
    const [selectedSeats, setSelectedSeats] = useState([]);
    const [seats, setSeats] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadingMessage, setLoadingMessage] = useState("Preparing theater experience...");
    const [error, setError] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [showPayment, setShowPayment] = useState(false);
    const [paymentMethod, setPaymentMethod] = useState('');
    const [city, setCity] = useState(localStorage.getItem('selectedCity') || 'Delhi');
    const [theaterId, setTheaterId] = useState(`${city}_theater`);
    const [selectedShowTime, setSelectedShowTime] = useState(showTimes[0].value);
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [socketConnected, setSocketConnected] = useState(false);
    const [contentReady, setContentReady] = useState(false);
    const [localSeatUpdates, setLocalSeatUpdates] = useState({});

    const [username, setUsername] = useState(user && user.username ? user.username : "");
    const [email, setEmail] = useState(user && user.email ? user.email : "");

    const [statusChangedSeats, setStatusChangedSeats] = useState([]);
    const [lastFetchTime, setLastFetchTime] = useState(0);
    const FETCH_COOLDOWN = 2000;

    useEffect(() => {
        
        const initializeTheater = async () => {
            try {
                setLoadingMessage("Loading movie details...");
                if (!movieId) {
                    throw new Error("Movie ID is missing");
                }

                const movieResponse = await moviesAPI.getOne(movieId);
                if (!movieResponse.success) {
                    throw new Error(movieResponse.message || "Failed to load movie details");
                }
                
                setMovie(movieResponse.data);
                
                setLoadingMessage("Connecting to seat service...");
                await new Promise(resolve => setTimeout(resolve, 2000));
                
                if (!socket.connected) {
                    socket.connect();
                }
                
                let socketTimeout = false;
                const socketConnectTimeout = setTimeout(() => {
                    socketTimeout = true;
                    setSocketConnected(false);
                    setContentReady(true);
                    setLoading(false);
                }, 4000);
                
                socket.on('connect', () => {
                    clearTimeout(socketConnectTimeout);
                    setSocketConnected(true);
                    
                    setLoadingMessage("Loading seat availability...");
                    fetchSeatData();
                    
                    setContentReady(true);
                    setLoading(false);
                });
                
                socket.on('connect_error', (err) => {
                    if (!socketTimeout) {
                        clearTimeout(socketConnectTimeout);
                        setSocketConnected(false);
                        setContentReady(true);
                        setLoading(false);
                    }
                });
                
            } catch (err) {
                setError(err.message || 'Failed to load theater');
                setLoading(false);
            }
        };
        
        initializeTheater();
        
        return () => {
            if (socket.connected) {
                socket.disconnect();
            }
        };
    }, [movieId]);
    
    const fetchSeatData = async (force = false) => {
        if (!movieId || (!socketConnected && !force)) return;
        
        const now = Date.now();
        if (!force && now - lastFetchTime < FETCH_COOLDOWN) {
            console.log("Skipping fetch due to cooldown", now - lastFetchTime);
            return;
        }
        
        setLastFetchTime(now);
        
        try {
            setLoadingMessage("Loading seat availability...");
            const seatResponse = await seatAPI.getStatus({
                movie: movieId,
                city: city,
                showtime: selectedShowTime,
                date: selectedDate.toISOString().split('T')[0]
            });
            
            if (seatResponse.success) {
                
                const mergedSeats = [...(seatResponse.seats || [])].map(serverSeat => {
                    const localUpdate = localSeatUpdates[serverSeat.seatNumber];
                    if (localUpdate && localUpdate.timestamp > (serverSeat.timestamp || 0)) {
                        return { ...serverSeat, status: localUpdate.status };
                    }
                    return serverSeat;
                });
                
                setSeats(mergedSeats);
                
                const showKey = getShowKey(
                    city, 
                    movieId, 
                    selectedShowTime, 
                    selectedDate.toISOString().split('T')[0]
                );
                socket.emit('joinShow', showKey);
            } else {
            }
        } catch (err) {
        }
    };

    useEffect(() => {
        if (!socketConnected) return;
        
        socket.on('seatUpdated', (updatedSeat) => {
            
            seatAPI.invalidateCache();
            
            setSeats(prev => {
                const seatIndex = prev.findIndex(s => s.seatNumber === updatedSeat.seatNumber);
                if (seatIndex >= 0) {
                    markSeatStatusChanged(updatedSeat.seatNumber);
                    
                    const localUpdate = localSeatUpdates[updatedSeat.seatNumber];
                    if (localUpdate) {
                        setLocalSeatUpdates(prev => {
                            const newUpdates = { ...prev };
                            delete newUpdates[updatedSeat.seatNumber];
                            return newUpdates;
                        });
                    }
                    
                    const newSeats = [...prev];
                    newSeats[seatIndex] = updatedSeat;
                    return newSeats;
                } else {
                    markSeatStatusChanged(updatedSeat.seatNumber);
                    return [...prev, updatedSeat];
                }
            });
        });
        
        socket.on('seatStatusUpdate', (data) => {
            if (data.reload) {
                seatAPI.invalidateCache();
                fetchSeatData(true);
            }
        });
        
        return () => {
            socket.off('seatUpdated');
            socket.off('seatStatusUpdate');
        };
    }, [socketConnected, localSeatUpdates]);

    useEffect(() => {
        if (contentReady) {
            
            setLocalSeatUpdates({});
            
            seatAPI.invalidateCache();
            
            if (socketConnected) {
                fetchSeatData(true);
            
                if (selectedSeats.length > 0) {
                    selectedSeats.forEach(seatNumber => {
                        seatAPI.release({
                            movie: movieId,
                            city: city,
                            showtime: selectedShowTime,
                            date: selectedDate.toISOString().split('T')[0],
                            seatNumber: seatNumber,
                            user: user?.username
                        });
                    });
                    setSelectedSeats([]);
                }
            }
        }
    }, [selectedShowTime, selectedDate, contentReady, socketConnected]);

    const markSeatStatusChanged = (seatNumber) => {
        setStatusChangedSeats(prev => [...prev, seatNumber]);
        setTimeout(() => {
            setStatusChangedSeats(prev => prev.filter(s => s !== seatNumber));
        }, 500);
    };

    const handleSeatClick = async (seatNumber) => {
        
        const seat = seats.find(s => s.seatNumber === seatNumber);
        
        if (seat && (seat.status === 'booked')) {
            return;
        }
        
        if (selectedSeats.includes(seatNumber)) {
            setSelectedSeats(prev => prev.filter(s => s !== seatNumber));
            markSeatStatusChanged(seatNumber);
            
            setLocalSeatUpdates(prev => ({
                ...prev,
                [seatNumber]: { status: 'available', timestamp: Date.now() }
            }));
            
            setSeats(prev => {
                return prev.map(s => {
                    if (s.seatNumber === seatNumber) {
                        return { ...s, status: 'available' };
                    }
                    return s;
                });
            });
            
            try {
                const result = await seatAPI.release({
                    movie: movieId,
                    city: city,
                    showtime: selectedShowTime,
                    date: selectedDate.toISOString().split('T')[0],
                    seatNumber: seatNumber,
                    user: user?.username
                });
                
                if (!result.success) {
                    setSelectedSeats(prev => [...prev, seatNumber]);
                    setError(result.message || 'Failed to unselect seat');
                    
                    setLocalSeatUpdates(prev => {
                        const newUpdates = { ...prev };
                        delete newUpdates[seatNumber];
                        return newUpdates;
                    });
                }
            } catch (err) {
                setSelectedSeats(prev => [...prev, seatNumber]);
                setError('Network error while releasing seat');
                
                setLocalSeatUpdates(prev => {
                    const newUpdates = { ...prev };
                    delete newUpdates[seatNumber];
                    return newUpdates;
                });
            }
        } else {
            setSelectedSeats(prev => [...prev, seatNumber]);
            markSeatStatusChanged(seatNumber);
            
            setLocalSeatUpdates(prev => ({
                ...prev,
                [seatNumber]: { status: 'selected', timestamp: Date.now() }
            }));
            
            setSeats(prev => {
                return prev.map(s => {
                    if (s.seatNumber === seatNumber) {
                        return { ...s, status: 'selected' };
                    }
                    return s;
                });
            });
            
            try {
                const result = await seatAPI.hold({
                    movie: movieId,
                    city: city,
                    showtime: selectedShowTime,
                    date: selectedDate.toISOString().split('T')[0],
                    seatNumber: seatNumber,
                    user: user?.username
                });
                
                if (!result.success) {
                    setSelectedSeats(prev => prev.filter(s => s !== seatNumber));
                    setError(result.message || 'Failed to select seat');
                    
                    setLocalSeatUpdates(prev => {
                        const newUpdates = { ...prev };
                        delete newUpdates[seatNumber];
                        return newUpdates;
                    });
                }
            } catch (err) {
                setSelectedSeats(prev => prev.filter(s => s !== seatNumber));
                setError('Network error while selecting seat');
                
                setLocalSeatUpdates(prev => {
                    const newUpdates = { ...prev };
                    delete newUpdates[seatNumber];
                    return newUpdates;
                });
            }
        }
    };

    const handlePayment = async () => {
        if (!paymentMethod) {
            setError('Please select a payment method');
            return;
        }
        
        if (selectedSeats.length === 0) {
            setError('Please select at least one seat');
            return;
        }
        
        setIsProcessing(true);
        setError('');

        try {
            const showtimeDisplay = showTimes.find(st => st.value === selectedShowTime)?.display || "";
            const basePrice = selectedSeats.length * (movie?.price || 0);
            const convenienceFee = basePrice * 0.05;
            const taxes = basePrice * 0.18;
            const totalAmount = basePrice + convenienceFee + taxes;

            const bookingData = {
                movie: movie?.title,
                user: user?.username || username,
                email: user?.email || email,
                theaterId: theaterId,
                theaterName: `${city} theater`,
                city: city,
                showtime: selectedShowTime, 
                showDate: selectedDate.toISOString(),
                seatsBooked: selectedSeats.map(String),
                numberOfSeats: selectedSeats.length,
                totalAmount: totalAmount,
                paymentDetails: {
                    method: paymentMethod,
                    status: 'completed',
                    amount: totalAmount,
                    currency: 'INR'
                },
                convenienceFee: convenienceFee,
                taxes: taxes
            };

            
            const res = await bookingsAPI.create(bookingData);
            
            if (!res.success) {
                throw new Error('Failed to create booking');
            }
            
            const bookingId = res.data._id;
            
            const seatBookingPromises = selectedSeats.map(seatNumber => 
                seatAPI.book({
                    movie: movieId,
                    city: city,
                    showtime: selectedShowTime,
                    date: selectedDate.toISOString().split('T')[0],
                    seatNumber: seatNumber,
                    user: user?.username,
                    bookingId: bookingId
                })
            );
            
            const seatResults = await Promise.all(seatBookingPromises);
            
            const failedSeats = seatResults.filter(result => !result.success);
            if (failedSeats.length > 0) {
                setError(`Some seats failed to book: ${failedSeats.map(f => f.message).join(', ')}`);
                setIsProcessing(false);
                return;
            }

            navigate('/confirmation', { 
                state: { 
                    bookingId: bookingId,
                    ...bookingData,
                    showtime: showtimeDisplay 
                }
            });
        } catch (err) {
            setError('Booking failed');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('user');
        if (setUser) setUser(null);
        navigate('/');
    };
    
    useEffect(() => {
        if (!contentReady) return;
        
        const handleBeforeUnload = (e) => {
            if (selectedSeats.length > 0 && user?.username) {
                
                const releaseRequests = selectedSeats.map(seatNumber => ({
                    movie: movieId,
                    city,
                    showtime: selectedShowTime,
                    date: selectedDate.toISOString().split('T')[0],
                    seatNumber,
                    user: user.username
                }));
                
                if (navigator.sendBeacon) {
                    const data = new Blob([JSON.stringify({ seats: releaseRequests })], { type: 'application/json' });
                    navigator.sendBeacon('/api/seats/release-batch', data);
                } else {
                    selectedSeats.forEach(seatNumber => {
                        try {
                            const xhr = new XMLHttpRequest();
                            xhr.open('POST', '/api/seats/release', false);
                            xhr.setRequestHeader('Content-Type', 'application/json');
                            xhr.send(JSON.stringify({
                                movie: movieId,
                                city,
                                showtime: selectedShowTime,
                                date: selectedDate.toISOString().split('T')[0],
                                seatNumber,
                                user: user.username
                            }));
                        } catch (e) {
                            console.error('Failed to release seat during page unload:', e);
                        }
                    });
                }
            }
        };
        
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
        };
    }, [selectedSeats, movieId, city, selectedShowTime, selectedDate, user, contentReady]);
    
     
    if (loading) {
        return (
            <div className="theater-container">
                <div className="loading-screen">
                    <div className="loading">
                        <h2>Loading Theater</h2>
                        <p>{loadingMessage}</p>
                        <div className="loading-spinner"></div>
                    </div>
                </div>
            </div>
        );
    }

    if (error && !movie) {
        return (
            <div className="theater-container">
                <div className="error-screen">
                    <div className="error">
                        <h2>Something went wrong</h2>
                        <p>{error}</p>
                        <button onClick={() => window.location.reload()} className="retry-button">
                            Try Again
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="theater-container">
            <div className="user-info">
                <span className="user-label"><b>User:</b></span> <span className="user-value">{user?.username || user?.name || user?.email || "Guest"}</span><br />
                <span className="user-label"><b>Email:</b></span> <span className="user-value">{user?.email || "-"}</span><br />
                <span className="user-label"><b>City:</b></span> <span className="user-value">{city}</span>
                <button onClick={handleLogout} className="logout-button">Log out</button>
            </div>
            
            {movie && (
                <div className="movie-details">
                    <div className="movie-poster">
                        <img src={movie.posterUrl} alt={movie.title} />
                    </div>
                    <div className="movie-info">
                        <h2>{movie.title}</h2>
                        <div className="movie-meta">
                            <span className="rating">
                                <FaStar /> {movie.rating}/5
                            </span>
                            <span className="duration">{movie.duration} min</span>
                            <span className="language">{movie.language}</span>
                        </div>
                        <p className="description">{movie.description}</p>
                        <div className="genre-tags">
                            {movie.genre.split(',').map((g, i) => (
                                <span key={i} className="genre-tag">{g.trim()}</span>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            <div className="screen">SCREEN</div>

            <div className="seats-container">
                {error && <div className="error-message">{error}</div>}
                
                {!socketConnected && (
                    <div className="warning-message">
                        Note: Real-time seat updates are currently unavailable. Some seats may appear available but might be booked by other users.
                    </div>
                )}
                
                <div className="showtime-selector">
                    <div className="date-selector">
                        <label><b>Available Dates:</b> </label>
                        <div className="date-selector-row">
                            {Array.from({ length: 7 }).map((_, idx) => {
                                const date = new Date();
                                date.setDate(date.getDate() + idx);
                                const isSelected = selectedDate.toDateString() === date.toDateString();
                                const day = date.toLocaleDateString('en-US', { weekday: 'short' });
                                const monthDay = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                                return (
                                    <div key={idx} className="date-button-container">
                                        <button
                                            className={isSelected ? "date-button selected" : "date-button"}
                                            onClick={() => setSelectedDate(new Date(date))}
                                        >
                                            <div>{day}</div>
                                            <div>{monthDay}</div>
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
                
                <div className="showtime-selector">
                    <label>Show Time: </label>
                    <select value={selectedShowTime} onChange={e => setSelectedShowTime(e.target.value)}>
                        {showTimes.map(st => (
                           <option key={st.value} value={st.value}>{st.label} : {st.display}</option>
                        ))}
                    </select>
                </div>


                <div className="seats-grid">
                    {Array.from({ length: movie?.totalSeats || 40 }, (_, i) => {
                        const seatNumber = i + 1;
                        const serverSeat = seats.find(s => s.seatNumber === seatNumber);
                        
                        let seatClass = 'seat';
                        let seatStatus = 'available';
                        
                        if (selectedSeats.includes(seatNumber)) {
                            seatClass += ' selected';
                            seatStatus = 'selected';
                        } 
                        else if (serverSeat?.status === 'booked') {
                            seatClass += ' booked';
                            seatStatus = 'booked';
                        } 
                        if (statusChangedSeats.includes(seatNumber)) {
                            seatClass += ' seat-status-changed';
                        }
                        
                        return (
                            <div key={seatNumber} className={seatClass} onClick={() => handleSeatClick(seatNumber)} title={`Seat ${seatNumber} - ${seatStatus}`} aria-label={`Seat ${seatNumber} - ${seatStatus}`}>
                                {seatNumber}
                            </div>
                        );
                    })}
                </div>

                <div className="seat-legend">
                    <div className="legend-item">
                        <div className="seat-sample available"></div>
                        <span>Available</span>
                    </div>
                    <div className="legend-item">
                        <div className="seat-sample selected"></div>
                        <span>Selected</span>
                    </div>
                    <div className="legend-item">
                        <div className="seat-sample booked"></div>
                        <span>Booked</span>
                    </div>
                </div>

                {/* Booking summary */}
                <div className="booking-summary">
                    <h3>Booking Summary</h3>
                    <p>Selected Seats: {selectedSeats.join(', ')}</p>
                    <p>Price per seat: ₹{movie?.price}</p>
                    <p>Total Amount: ₹{selectedSeats.length * (movie?.price || 0)}</p>
                    
                    {!showPayment ? (
                        <button onClick={() => setShowPayment(true)} disabled={isProcessing || selectedSeats.length === 0} className="proceed-button">
                            Proceed to Payment
                        </button>
                    ) : (
                        <div className="payment-section">
                            <h4>Select Payment Method</h4>
                            <div className="payment-methods">
                                <label>
                                    <input type="radio" name="payment" value="card" checked={paymentMethod === 'card'} onChange={(e) => setPaymentMethod(e.target.value)}/>
                                    Credit/Debit Card
                                </label>
                                <label>
                                    <input
                                        type="radio" name="payment" value="upi" checked={paymentMethod === 'upi'} onChange={(e) => setPaymentMethod(e.target.value)} />
                                    UPI
                                </label>
                                <label>
                                    <input type="radio" name="payment" value="netbanking" checked={paymentMethod === 'netbanking'} onChange={(e) => setPaymentMethod(e.target.value)}/>
                                    Net Banking
                                </label>
                            </div>
                            <button onClick={handlePayment} disabled={isProcessing || !paymentMethod} className="payment-button">
                                {isProcessing ? 'Processing Payment...' : 'Pay Now'}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Theater; 