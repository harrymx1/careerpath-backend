require('dotenv').config(); 

const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors()); // Mengizinkan akses dari domain luar (penting untuk integrasi frontend)
app.use(express.json()); // Agar server bisa membaca data berformat JSON dari body request

// API Routes
const apiRoutes = require('./routes/api');
app.use('/api', apiRoutes);

// Base Route untuk testing
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to CareerPath AI API',
    status: 'Server is running smoothly'
  });
});

// Menjalankan server
app.listen(PORT, () => {
  console.log(`Server CareerPath AI berjalan di http://localhost:${PORT}`);
});