const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
    movie: {
        type: String,
        required: true,
    },
    user: {
        type: String,
        required: true,
    },
    theaterName: {
        type: String,
        required: true,
    },
    city: {
        type: String,
        required: true,
    },
    showtime: {
        type: String,
        required: true,
    },
    showDate: {
        type: Date,
        required: true,
    },
    seatsBooked: {
        type: [String],
        required: true,
    },
    numberOfSeats: {
        type: Number,
        required: true,
        min: [1, 'Must book at least one seat'],
    },
    totalAmount: {
        type: Number,
        required: true,
    },
    bookingStatus: {
        type: String,
        enum: ['Pending', 'Confirmed', 'Cancelled'],
        default: 'Confirmed',
    },
    bookingDate: {
        type: Date,
        default: Date.now
    },
    status: {
        type: String,
        enum: ['pending', 'confirmed', 'cancelled', 'completed'],
        default: 'pending'
    },
    paymentDetails: {
        method: {
            type: String,
            enum: ['credit_card', 'debit_card', 'upi', 'netbanking', 'wallet', 'card'],
        },
        transactionId: String,
        status: {
            type: String,
            enum: ['pending', 'completed', 'failed'],
            default: 'pending'
        },
        amount: Number,
        currency: {
            type: String,
            default: 'INR'
        }
    },
    cancellationDetails: {
        cancelledAt: Date,
        reason: String,
        refundAmount: Number,
        refundStatus: {
            type: String,
            enum: ['pending', 'completed', 'failed'],
            default: 'pending'
        }
    },
    bookingReference: {
        type: String,
        unique: true,
    }
}, {
    timestamps: true
});

bookingSchema.pre('save', async function(next) {
    if (!this.bookingReference) {
        const date = new Date();
        const year = date.getFullYear().toString().slice(-2);
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
        this.bookingReference = `BMS${year}${month}${day}${random}`;
    }
    next();
});

const Booking = mongoose.model('Booking', bookingSchema);

module.exports = Booking; 