const User = require('../models/User');
const bcrypt = require('bcryptjs');

async function ensureInitialAdmin() {
  const email = process.env.INIT_ADMIN_EMAIL;
  const password = process.env.INIT_ADMIN_PASSWORD;
  const name = process.env.INIT_ADMIN_NAME || 'Admin';
  if (!email || !password) return;
  const existing = await User.findOne({ email });
  if (existing) return;
  const passwordHash = await bcrypt.hash(password, 10);
  await User.create({ name, email, passwordHash, role: 'admin' });
  console.log(`Created initial admin: ${email}`);
}

module.exports = { ensureInitialAdmin };