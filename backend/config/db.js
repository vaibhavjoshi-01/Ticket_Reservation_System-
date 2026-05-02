const mongoose = require('mongoose');

const MONGODB_URI = "mongodb://localhost:27017/bookmyshow";

const connectWithRetry = async () => {
    try {
        const conn = await mongoose.connect(MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 5000
        });
    } catch (error) {
        if (error.message.includes('buffering timed out after')) {
            console.error('Please ensure MongoDB is running on your machine.');
        }
        setTimeout(connectWithRetry, 5000);
    }
};

connectWithRetry(); 

module.exports = connectWithRetry; 