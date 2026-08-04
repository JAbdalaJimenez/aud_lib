const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const uri = process.env.MONGODB_URI;
    await mongoose.connect(uri);
    console.log('[DB] MongoDB connected');
  } catch (error) {
    console.error('[DB] Connection error:', error.message);
    process.exit(1);
  }
};

module.exports = connectDB;
