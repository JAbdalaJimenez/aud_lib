require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const connectDB = require('./config/db');

const app = express();
const PORT = process.env.PORT || 3000;

// Asegurar que la carpeta uploads exista
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Middleware
app.use(cors({
  origin: function (origin, callback) {
    // Permite requests sin origin (como Postman), localhost y cualquier subdominio de aud-lib en Vercel
    if (!origin || /^https:\/\/aud-lib.*\.vercel\.app$/.test(origin) || origin === 'http://localhost:3000') {
      callback(null, true);
    } else {
      callback(new Error('No permitido por CORS'));
    }
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Archivos estáticos
app.use('/uploads', express.static(uploadsDir));
app.use('/', express.static(path.join(__dirname, '..', 'frontend')));

// Rutas API
app.use('/api/books', require('./routes/books'));

// Ruta raíz → frontend
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
});

// Manejo de errores global
app.use((err, req, res, next) => {
  console.error('Error no manejado:', err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

// Conectar a MongoDB y arrancar servidor
connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`[AudioLib] Server running on http://localhost:${PORT}`);
  });
});
