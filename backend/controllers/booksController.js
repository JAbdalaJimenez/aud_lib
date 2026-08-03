const Book = require('../models/Book');
const { extractText, detectFileType } = require('../utils/textExtractor');
const path = require('path');
const fs = require('fs');

/**
 * POST /api/books
 * Sube un libro nuevo: archivo + portada + metadata.
 * Extrae el texto del archivo y lo guarda en MongoDB.
 */
exports.uploadBook = async (req, res) => {
  try {
    const { title, author } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'El título es obligatorio' });
    }

    if (!req.files || !req.files.bookFile) {
      return res.status(400).json({ error: 'Se requiere un archivo del libro' });
    }

    const bookFile = req.files.bookFile[0];
    const coverFile = req.files.coverImage ? req.files.coverImage[0] : null;

    // Detectar tipo de archivo
    const fileType = detectFileType(bookFile.originalname);
    if (fileType === 'unknown') {
      // Limpiar archivos subidos
      fs.unlinkSync(bookFile.path);
      if (coverFile) fs.unlinkSync(coverFile.path);
      return res.status(400).json({
        error: 'Tipo de archivo no soportado. Usa PDF, EPUB, TXT o ZIP.'
      });
    }

    // Extraer texto del archivo
    let textData;
    try {
      textData = await extractText(bookFile.path, fileType);
    } catch (extractError) {
      // Limpiar archivos subidos
      fs.unlinkSync(bookFile.path);
      if (coverFile) fs.unlinkSync(coverFile.path);
      return res.status(422).json({
        error: `Error extrayendo texto: ${extractError.message}`
      });
    }

    // Construir URL de portada
    let coverUrl = '';
    if (coverFile) {
      coverUrl = `/uploads/${coverFile.filename}`;
    }

    // Crear el libro en la base de datos
    const book = new Book({
      title,
      author: author || 'Autor desconocido',
      coverUrl,
      text: textData.text,
      chapters: textData.chapters,
      fileType
    });

    await book.save();

    // Eliminar el archivo del libro (ya extrajimos el texto)
    fs.unlinkSync(bookFile.path);

    // Responder con el libro creado (sin el texto completo)
    const response = book.toObject();
    delete response.text;
    delete response.chapters;

    res.status(201).json(response);
  } catch (error) {
    console.error('Error en uploadBook:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

/**
 * GET /api/books
 * Lista todos los libros (sin texto completo para rendimiento).
 */
exports.getAllBooks = async (req, res) => {
  try {
    const books = await Book.find()
      .select('-text -chapters')
      .sort({ createdAt: -1 });

    res.json(books);
  } catch (error) {
    console.error('Error en getAllBooks:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

/**
 * GET /api/books/:id
 * Obtiene el detalle completo de un libro incluyendo texto y capítulos.
 */
exports.getBookById = async (req, res) => {
  try {
    const book = await Book.findById(req.params.id);
    if (!book) {
      return res.status(404).json({ error: 'Libro no encontrado' });
    }
    res.json(book);
  } catch (error) {
    console.error('Error en getBookById:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({ error: 'ID de libro inválido' });
    }
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

/**
 * PATCH /api/books/:id/progress
 * Actualiza el progreso de lectura de un libro.
 */
exports.updateProgress = async (req, res) => {
  try {
    const { readingProgress, lastCharIndex } = req.body;

    const updateData = {};
    if (readingProgress !== undefined) {
      updateData.readingProgress = Math.max(0, Math.min(100, readingProgress));
    }
    if (lastCharIndex !== undefined) {
      updateData.lastCharIndex = Math.max(0, lastCharIndex);
    }

    const book = await Book.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, select: '-text -chapters' }
    );

    if (!book) {
      return res.status(404).json({ error: 'Libro no encontrado' });
    }

    res.json(book);
  } catch (error) {
    console.error('Error en updateProgress:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({ error: 'ID de libro inválido' });
    }
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

/**
 * DELETE /api/books/:id
 * Elimina un libro y su portada.
 */
exports.deleteBook = async (req, res) => {
  try {
    const book = await Book.findById(req.params.id);
    if (!book) {
      return res.status(404).json({ error: 'Libro no encontrado' });
    }

    // Eliminar la portada si existe
    if (book.coverUrl) {
      const coverPath = path.join(__dirname, '..', book.coverUrl);
      if (fs.existsSync(coverPath)) {
        fs.unlinkSync(coverPath);
      }
    }

    await Book.findByIdAndDelete(req.params.id);
    res.json({ message: 'Libro eliminado correctamente' });
  } catch (error) {
    console.error('Error en deleteBook:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({ error: 'ID de libro inválido' });
    }
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

/**
 * PATCH /api/books/:id
 * Actualiza la información de un libro (título, autor, portada).
 */
exports.updateBook = async (req, res) => {
  try {
    const { title, author } = req.body;
    const book = await Book.findById(req.params.id);

    if (!book) {
      return res.status(404).json({ error: 'Libro no encontrado' });
    }

    // Actualizar campos de texto
    if (title && title.trim()) {
      book.title = title.trim();
    }
    if (author !== undefined) {
      book.author = author.trim() || 'Autor desconocido';
    }

    // Actualizar portada si se envió una nueva
    if (req.files && req.files.coverImage && req.files.coverImage[0]) {
      // Eliminar portada anterior
      if (book.coverUrl) {
        const oldCoverPath = path.join(__dirname, '..', book.coverUrl);
        if (fs.existsSync(oldCoverPath)) {
          fs.unlinkSync(oldCoverPath);
        }
      }
      book.coverUrl = `/uploads/${req.files.coverImage[0].filename}`;
    }

    await book.save();

    // Responder sin texto completo
    const response = book.toObject();
    delete response.text;
    delete response.chapters;

    res.json(response);
  } catch (error) {
    console.error('Error en updateBook:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({ error: 'ID de libro inválido' });
    }
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

