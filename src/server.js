require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const { connectDB } = require('./config/db');
const { ensureInitialAdmin } = require('./config/init');

const app = express();

const PORT = process.env.PORT || 8080;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// Build allowed origins list (GH Pages uses domain without path)
const allowedOrigins = Array.from(new Set([
  FRONTEND_URL,
  process.env.FRONTEND_ORIGIN,
  // Web dev and GH Pages
  'http://localhost:5173',
  'https://abir7109.github.io',
  // Capacitor (mobile) webview origins
  'capacitor://localhost',
  'http://localhost',
  'https://localhost',
].filter(Boolean).map(v => { try { return new URL(v).origin; } catch { return v; } })));
console.log('CORS allowed origins:', allowedOrigins);

app.use(helmet());
app.use(morgan('dev'));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true); // allow curl/postman
    if (allowedOrigins.includes(origin)) return callback(null, origin);
    return callback(new Error('CORS not allowed: ' + origin), false);
  },
  credentials: true,
}));

connectDB().then(() => ensureInitialAdmin()).catch(() => {});

// expose db for GridFS
const mongoose = require('mongoose');
mongoose.connection.on('connected', () => {
  app.locals.db = mongoose.connection.db;
});

app.get('/', (req, res) => res.json({ name: 'Mess Manager API', ok: true, health: '/api/health' }));
app.get('/api/health', (req, res) => res.json({ ok: true }));
// Quiet favicon requests on this domain (e.g., when opening PDF in new tab)
app.get('/favicon.ico', (req, res) => res.status(204).end());
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/meals', require('./routes/meals'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/community', require('./routes/community'));
app.use('/api/expenses', require('./routes/expenses'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/public', require('./routes/public'));
app.use('/api/files', require('./routes/files'));

app.use(require('./middleware/error'));

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
