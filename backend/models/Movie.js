const mongoose = require('mongoose');

const movieSchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, 'Title is required'],
        trim: true
    },
    description: {
        type: String,
        required: [true, 'Description is required'],
    },
    genre: {
        type: String,
        required: [true, 'Genre is required'],
    },
    duration: {
        type: Number,
        required: [true, 'Duration is required'],
    },
    language: {
        type: String,
        required: [true, 'Language is required'],
    },
    price: {
        type: Number,
        required: true
    },
    posterUrl: {
        type: String,
        required: [true, 'Poster URL is required'],
    },
    trailerUrl: {
        type: String,
    },
    rating: {
        type: Number,
        default: 0
    },
    totalRatings: {
        type: Number,
        default: 0
    },
    releaseDate: {
        type: Date,
        required: [true, 'Release date is required'],
    },
    status: {
        type: String,
        enum: ['coming-soon', 'now-showing', 'expired'],
        default: 'now-showing'
    },
    reviews: [{
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        rating: Number,
        comment: String,
        date: {
            type: Date,
            default: Date.now
        }
    }],
    availableSeats: {
        type: Number,
        required: true,
        min: 0,
        default: 100
    },
    totalSeats: {
        type: Number,
        required: true,
        default: 100
    }
}, {
    timestamps: true
});

const Movie = mongoose.model('Movie', movieSchema);

module.exports = Movie; 