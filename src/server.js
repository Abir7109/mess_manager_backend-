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

app.use(helmet());
app.use(morgan('dev'));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use(cors({ origin: FRONTEND_URL, credentials: true }));

connectDB().then(() => ensureInitialAdmin()).catch(() => {});

app.get('/', (req, res) => res.json({ name: 'Mess Manager API', ok: true, health: '/api/health' }));
app.get('/api/health', (req, res) => res.json({ ok: true }));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/meals', require('./routes/meals'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/community', require('./routes/community'));
app.use('/api/expenses', require('./routes/expenses'));
app.use('/api/notifications', require('./routes/notifications'));

app.use(require('./middleware/error'));

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
