require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const vendorRoutes = require('./src/routes/vendorRoutes');
const orderRoutes = require('./src/routes/orderRoutes');
const statsRoutes = require('./src/routes/statsRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve Frontend static assets if available
const frontendDir = path.join(__dirname, '../frontend');
const publicDir = path.join(__dirname, 'public');

if (fs.existsSync(frontendDir)) {
  app.use(express.static(frontendDir));
} else if (fs.existsSync(publicDir)) {
  app.use(express.static(publicDir));
}

// API Routes
app.use('/api/vendors', vendorRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api', statsRoutes);

// System Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    system: 'Vendor Management System (VMS) Core API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    storage: 'Zero-Friction Dual Persistent Engine Active',
  });
});

// Fallback for single page app client-side routing
app.use((req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ success: false, message: 'API route not found' });
  }
  const indexFile = fs.existsSync(path.join(frontendDir, 'index.html'))
    ? path.join(frontendDir, 'index.html')
    : path.join(publicDir, 'index.html');

  if (fs.existsSync(indexFile)) {
    res.sendFile(indexFile);
  } else {
    res.json({ success: true, message: 'VMS Backend API is active and running.' });
  }
});

// Start Server
if (require.main === module) {
  app.listen(PORT, () => {
    console.log('====================================================');
    console.log(`🚀 VENDOR MANAGEMENT SYSTEM (VMS) BACKEND RUNNING`);
    console.log(`🌐 Application URL:      http://localhost:${PORT}`);
    console.log(`📡 API Endpoints Base:   http://localhost:${PORT}/api`);
    console.log(`📦 Storage Adapter:       Self-Healing File-Backed JSON Store`);
    console.log(`🎯 Mode:                  ${process.env.NODE_ENV || 'development'}`);
    console.log('====================================================');
  });
}

module.exports = app;
