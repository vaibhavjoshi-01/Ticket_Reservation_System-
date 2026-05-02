import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
    baseURL: BASE_URL,
    headers: {
        'Content-Type': 'application/json'
    },
    timeout: 10000
});

const requestCache = {
    cache: new Map(),
    pendingRequests: new Map(),
    
    MAX_AGE: 5000,
    
    getCache(key) {
        const cached = this.cache.get(key);
        if (!cached) return null;
        
        if (Date.now() - cached.timestamp < this.MAX_AGE) {
            return cached.data;
        }
        
        this.cache.delete(key);
        return null;
    },
    
    setCache(key, data) {
        this.cache.set(key, {
            data,
            timestamp: Date.now()
        });
    },
    
    createKey(method, url, params, data) {
        const queryString = params ? new URLSearchParams(params).toString() : '';
        const bodyString = data ? JSON.stringify(data) : '';
        return `${method}:${url}:${queryString}:${bodyString}`;
    },
    
    clearCache(pattern) {
        for (const key of this.cache.keys()) {
            if (key.includes(pattern)) {
                this.cache.delete(key);
            }
        }
    },
    
    clearAll() {
        this.cache.clear();
    }
};


api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        
        if (config.method === 'get' && config.url.includes('/seats/status')) {
            const cacheKey = requestCache.createKey(
                config.method, 
                config.url, 
                config.params, 
                config.data
            );
            
            const cachedResponse = requestCache.getCache(cacheKey);
            if (cachedResponse) {
                const source = axios.CancelToken.source();
                source.cancel('Request canceled due to cached response');
                config.cancelToken = source.token;
                config._cachedResponse = cachedResponse;
            }
            
            if (requestCache.pendingRequests.has(cacheKey)) {
                const source = axios.CancelToken.source();
                source.cancel('Request canceled due to duplicate in-flight request');
                config.cancelToken = source.token;
                config._pendingRequest = requestCache.pendingRequests.get(cacheKey);
            } else {
                const promise = new Promise((resolve) => {
                    config._resolvePendingRequest = resolve;
                });
                requestCache.pendingRequests.set(cacheKey, promise);
                config._cacheKey = cacheKey;
            }
        }
        
        return config;
    },
    (error) => Promise.reject(error)
);

api.interceptors.response.use(
    (response) => {
        if (response.config.url.includes('/seats/status')) {
            const cacheKey = response.config._cacheKey;
            if (cacheKey) {
                requestCache.setCache(cacheKey, response.data);
                if (response.config._resolvePendingRequest) {
                    response.config._resolvePendingRequest(response.data);
                    setTimeout(() => {
                        requestCache.pendingRequests.delete(cacheKey);
                    }, 100);
                }
            }
        }
        
        return response;
    },
    (error) => {
        if (axios.isCancel(error) && error.message === 'Request canceled due to cached response') {
            return { data: error.config._cachedResponse };
        }
        
        if (axios.isCancel(error) && error.message === 'Request canceled due to duplicate in-flight request') {
            return error.config._pendingRequest.then(data => ({ data }));
        }
        
        if (!error.response) {
            return Promise.reject({
                success: false,
                message: 'Network error. Please check your connection.',
                isNetworkError: true
            });
        }

        const errorData = error.response.data;
        const errorMessage = (errorData && (errorData.message || errorData.error)) || error.message || 'An API error occurred';
        return Promise.reject({
            success: false,
            message: errorMessage,
            status: error.response.status,
            errorData: errorData
        });
    }
);

export const moviesAPI = {
    getAll: async () => {
        try {
            const response = await api.get('/movies');
            return { success: true, data: response.data.data || [] };
        } catch (error) {
            return { success: false, message:'Failed to fetch movies' };
        }
    },

    getOne: async (id) => {
        try {
            const response = await api.get(`/movies/${id}`);
            return { success: true, data: response.data.data };
        } catch (error) {
            return {
                success: false,
                message: error.message || 'Failed to fetch movie details'
            };
        }
    },

    create: async (movieData) => {
        try {
            const response = await api.post('/movies', movieData);
            return { success: true, data: response.data.data };
        } catch (error) {
            return {
                success: false,
                message: error.message || 'Failed to create movie'
            };
        }
    },
    update: async (id, movieData) => {
        try {
            const response = await api.put(`/movies/${id}`, movieData);
            return { success: true, data: response.data.data };
        } catch (error) {
            return { success: false, message: 'Failed to update movie' };
        }
    },
    delete: async (id) => {
        try {
            const response = await api.delete(`/movies/${id}`);
            return { success: true, message: response.data.message };
        } catch (error) {
            return { success: false, message: 'Failed to delete movie' };
        }
    }
};

export const bookingsAPI = {
    create: async (bookingData) => {
        try {
            const response = await api.post('/bookings', bookingData);
            return { success: true, data: response.data.data };
        } catch (error) {
            return { success: false, message:'Failed to create booking' };
        }
    },
    getUserBookings: async (username) => {
        try {
            const response = await api.get(`/bookings/user/${username}`);
            return { success: true, data: response.data };
        } catch (error) {
            return { success: false, message:'Failed to fetch user bookings' };
        }
    },
    deleteBooking: async (bookingId) => {
        try {
            const response = await api.delete(`/bookings/${bookingId}`);
            if (response.data.success) {
                return { 
                    success: true, 
                    message: 'Booking cancelled successfully' 
                };
            } else {
                return { 
                    success: false, 
                    message: 'Failed to cancel booking' 
                };
            }
        } catch (error) {
            return { 
                success: false, 
                message: 'An error occurred while cancelling the booking. Please try again.' 
            };
        }
    },
    getBookedSeats: async ({ movie, city, showtime }) => {
        try {
            const response = await api.get(
                `/bookings/booked-seats?movie=${encodeURIComponent(movie)}&city=${encodeURIComponent(city)}&showtime=${encodeURIComponent(showtime)}`
            );
            return response.data;
        } catch (error) {
            return { success: false, message:'Failed to fetch booked seats' };
        }
    },
    pollSeatStatus: async ({ movie, city, showtime, date }) => {
        try {
            const response = await api.get(
                `/bookings/seat-status?` +
                `movie=${encodeURIComponent(movie)}&` +
                `city=${encodeURIComponent(city)}&` +
                `showtime=${encodeURIComponent(showtime)}&` +
                `date=${encodeURIComponent(date)}`
            );
            
            if (response.data.success) {
                return { 
                    success: true, 
                    data: {
                        seats: response.data.seats,
                        timestamp: response.data.timestamp
                    }
                };
            }
            return { 
                success: false, 
                message:'Failed to fetch seat status' 
            };
        } catch (error) {
            return { 
                success: false, 
                message: 'Failed to fetch seat status',
                error: error
            };
        }
    }
};

export const authAPI = {
    login: async (credentials) => {
        try {
            const response = await api.post('/users/login', credentials);
            if (response.data && response.data.token && response.data.user) {
                localStorage.setItem('token', response.data.token);
                localStorage.setItem('userData', JSON.stringify(response.data.user));
                return { success: true, user: response.data.user, token: response.data.token };
            }
            return { success: false, message:'Login failed: Invalid server response.' };
        } catch (error) {
            return { success: false, message:'Login failed. Please try again.' };
        }
    },

    register: async (userData) => {
        try {
            const response = await api.post('/users/register', userData);
            return { success: true, data: response.data };
        } catch (error) {
            return { success: false, message:'Registration failed. Please try again.' };
        }
    },

    logout: () => {
        localStorage.removeItem('token');
        localStorage.removeItem('userData');
    },

};

export const userAPI = {
    getUserByEmail: async (email) => {
        try {
            const response = await api.get(`/users/email/${email}`);
            return { success: true, data: response.data };
        } catch (error) {
            return { success: false, message: 'User fetch failed' };
        }
    },
    insertUser: async (userData) => {
        try {
            const response = await api.post('/users', userData);
            return { success: true, data: response.data };
        } catch (error) {
            return { success: false, message:'Failed to insert user' };
        }
    },
    login: async (credentials) => {
        try {
            const response = await api.post('/users/login', credentials);
            if (response.data && response.data.token && response.data.user) {
                localStorage.setItem('token', response.data.token);
                localStorage.setItem('userData', JSON.stringify(response.data.user));
                return { success: true, user: response.data.user, token: response.data.token };
            }
            return { success: false, message:'Login failed: Invalid server response.' };
        } catch (error) {
            return { success: false, message:'Failed to login' };
        }
    },
    getMe: async () => {
        const token = localStorage.getItem('token');
        const res = await fetch('/api/user/me', {
            headers: { Authorization: `Bearer ${token}` }
        });
        return res.json();
    }
};

export const seatAPI = {
    hold: async (data) => {
        try {
            
            requestCache.clearCache(`/seats/status?movie=${encodeURIComponent(data.movie)}&city=${encodeURIComponent(data.city)}`);
            
            const response = await api.post('/seats/hold', data);
            return response.data;
        } catch (error) {
            return { success: false, message:'Failed to hold seat' };
        }
    },
    book: async (data) => {
        try {
            requestCache.clearCache(`/seats/status?movie=${encodeURIComponent(data.movie)}&city=${encodeURIComponent(data.city)}`);
            
            const response = await api.post('/seats/book', data);
            return response.data;
        } catch (error) {
            return { success: false, message: 'Failed to book seat' };
        }
    },
    release: async (data) => {
        try {
            requestCache.clearCache(`/seats/status?movie=${encodeURIComponent(data.movie)}&city=${encodeURIComponent(data.city)}`);
            
            const response = await api.post('/seats/release', data);
            return response.data;
        } catch (error) {
            return { success: false, message:'Failed to release seat' };
        }
    },
    getStatus: async (params) => {
        try {
            const response = await api.get('/seats/status', { params });
            return response.data;
        } catch (error) {
            return { success: false, message: 'Failed to get seat status' };
        }
    },
    invalidateCache: () => {
        requestCache.clearCache('/seats/status');
    }
};

export { requestCache };

export default api;