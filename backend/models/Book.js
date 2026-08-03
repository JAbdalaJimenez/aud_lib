const mongoose = require('mongoose');

const chapterSchema = new mongoose.Schema({
  title: { type: String, default: '' },
  content: { type: String, default: '' }
}, { _id: false });

const bookSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'El título es obligatorio'],
    trim: true
  },
  author: {
    type: String,
    trim: true,
    default: 'Autor desconocido'
  },
  coverUrl: {
    type: String,
    default: ''
  },
  text: {
    type: String,
    default: ''
  },
  chapters: {
    type: [chapterSchema],
    default: []
  },
  readingProgress: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  lastCharIndex: {
    type: Number,
    default: 0
  },
  fileType: {
    type: String,
    enum: ['pdf', 'epub', 'txt', 'zip', 'unknown'],
    default: 'unknown'
  }
}, {
  timestamps: true
});

// Índice para listar libros eficientemente (sin cargar texto)
bookSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Book', bookSchema);
