const express = require('express');
const multer = require('multer');
const path = require('path');
const router = express.Router();

const booksController = require('../controllers/booksController');

// Configuración de Multer para subida de archivos (Se guardan temporalmente en local)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '..', 'uploads'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const baseName = path.basename(file.originalname, ext)
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .substring(0, 50);
    cb(null, `${baseName}-${uniqueSuffix}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  if (file.fieldname === 'bookFile') {
    const allowedBook = /\.(pdf|epub|txt|zip)$/i;
    if (allowedBook.test(file.originalname)) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos PDF, EPUB, TXT o ZIP'), false);
    }
  } else if (file.fieldname === 'coverImage') {
    const allowedImage = /\.(jpg|jpeg|png|webp|gif)$/i;
    if (allowedImage.test(file.originalname)) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten imágenes JPG, PNG, WebP o GIF'), false);
    }
  } else {
    cb(null, false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50 MB max
  }
});

const uploadFields = upload.fields([
  { name: 'bookFile', maxCount: 1 },
  { name: 'coverImage', maxCount: 1 }
]);

// Middleware para manejar errores de Multer
const handleMulterError = (req, res, next) => {
  uploadFields(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ error: 'El archivo excede el límite de 50 MB' });
      }
      return res.status(400).json({ error: err.message });
    } else if (err) {
      return res.status(400).json({ error: err.message });
    }
    next();
  });
};

// Rutas
router.post('/', handleMulterError, booksController.uploadBook);
router.get('/', booksController.getAllBooks);
router.get('/:id', booksController.getBookById);
router.patch('/:id/progress', booksController.updateProgress);
router.patch('/:id', uploadFields, booksController.updateBook);
router.delete('/:id', booksController.deleteBook);

module.exports = router;
