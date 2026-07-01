const express = require('express');
const cors = require('cors');
require('dotenv').config();

const apiRouter = require('./routes/api');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
const allowedOrigins = [
  'https://lotus-time.vercel.app',
  'http://localhost:5173',
  'http://localhost:5000'
];
if (process.env.FRONTEND_URL) {
  allowedOrigins.push(process.env.FRONTEND_URL.replace(/\/$/, ''));
}

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin) || allowedOrigins.includes(origin.replace(/\/$/, '')) || process.env.NODE_ENV !== 'production') {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  exposedHeaders: ['Content-Disposition']
}));
app.use(express.json({ limit: '10mb' }));

// Routes
app.use('/api', apiRouter);

// Base route
app.get('/', (req, res) => {
  res.json({ message: 'LotusTime API is running.' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  if (err.code === '23505') {
    let message = 'Dữ liệu đã tồn tại (trùng khóa duy nhất).';
    if (err.constraint === 'classes_code_key') {
      message = 'Mã lớp học này đã tồn tại trong hệ thống.';
    } else if (err.constraint === 'persons_short_name_key') {
      message = 'Tên viết tắt của giáo viên/TA này đã tồn tại.';
    } else if (err.constraint === 'unique_time_slot') {
      message = 'Khung giờ này đã tồn tại.';
    }
    return res.status(400).json({ error: 'DuplicateKey', message });
  }
  res.status(500).json({ error: 'Internal Server Error', message: err.message });
});

const { runMigrations } = require('./db/migrate');

// Start Server & Run Migrations
runMigrations()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Database migrations failed. Server is shutting down.', err);
    process.exit(1);
  });
