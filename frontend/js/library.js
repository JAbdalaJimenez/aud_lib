/**
 * AudioLib — Library Page Logic
 * Handles: loading books, upload modal, book upload, delete, navigation.
 */

const API_BASE = API_URL;

// SVG Icons (inline, no emoji)
const ICONS = {
  check: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
  x: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
  info: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
  trash: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
  edit: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
  book: '<svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>',
  file: '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
  image: '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>',
};

// DOM Elements
const booksGrid = document.getElementById('books-grid');
const emptyState = document.getElementById('empty-state');
const uploadModal = document.getElementById('upload-modal');
const uploadForm = document.getElementById('upload-form');
const uploadLoading = document.getElementById('upload-loading');
const toastContainer = document.getElementById('toast-container');

// File input displays
const bookFileInput = document.getElementById('book-file');
const coverFileInput = document.getElementById('cover-file');
const bookFileDisplay = document.getElementById('book-file-display');
const coverFileDisplay = document.getElementById('cover-file-display');

// =====================
// Toast Notifications
// =====================

function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  const iconMap = { success: ICONS.check, error: ICONS.x, info: ICONS.info };
  toast.innerHTML = `<span class="toast-icon">${iconMap[type] || iconMap.info}</span> ${message}`;

  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(24px) scale(0.96)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// =====================
// Modal Management
// =====================

// Edit Modal DOM
const editModal = document.getElementById('edit-modal');
const editForm = document.getElementById('edit-form');
const editLoading = document.getElementById('edit-loading');
const editCoverFileInput = document.getElementById('edit-cover-file');
const editCoverFileDisplay = document.getElementById('edit-cover-file-display');
const editBookIdInput = document.getElementById('edit-book-id');
const editBookTitleInput = document.getElementById('edit-book-title');
const editBookAuthorInput = document.getElementById('edit-book-author');

function openModal() {
  uploadModal.classList.add('active');
  document.body.style.overflow = 'hidden';
  uploadForm.reset();
  bookFileDisplay.classList.remove('has-file');
  bookFileDisplay.querySelector('.file-icon').innerHTML = `<span class="icon">${ICONS.file}</span>`;
  bookFileDisplay.querySelectorAll('div')[1].textContent = 'Arrastrá o hacé clic para seleccionar';
  coverFileDisplay.classList.remove('has-file');
  coverFileDisplay.querySelector('.file-icon').innerHTML = `<span class="icon">${ICONS.image}</span>`;
  coverFileDisplay.querySelectorAll('div')[1].textContent = 'Seleccionar imagen de portada';
}

function closeModal() {
  uploadModal.classList.remove('active');
  editModal.classList.remove('active');
  document.body.style.overflow = '';
}

function openEditModal(bookId, title, author) {
  editBookIdInput.value = bookId;
  editBookTitleInput.value = title;
  editBookAuthorInput.value = author;
  
  editModal.classList.add('active');
  document.body.style.overflow = 'hidden';
  
  // Reset cover input
  editCoverFileInput.value = '';
  editCoverFileDisplay.classList.remove('has-file');
  editCoverFileDisplay.querySelector('.file-icon').innerHTML = `<span class="icon">${ICONS.image}</span>`;
  editCoverFileDisplay.querySelectorAll('div')[1].textContent = 'Seleccionar imagen de portada para reemplazar la actual';
}

// Modal event listeners
document.getElementById('btn-upload-open').addEventListener('click', openModal);
document.getElementById('btn-upload-empty')?.addEventListener('click', openModal);
document.getElementById('modal-close').addEventListener('click', closeModal);
document.getElementById('edit-modal-close').addEventListener('click', closeModal);

uploadModal.addEventListener('click', (e) => {
  if (e.target === uploadModal) closeModal();
});
editModal.addEventListener('click', (e) => {
  if (e.target === editModal) closeModal();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && (uploadModal.classList.contains('active') || editModal.classList.contains('active'))) {
    closeModal();
  }
});

// =====================
// File Input Display
// =====================

bookFileInput.addEventListener('change', () => {
  const file = bookFileInput.files[0];
  if (file) {
    bookFileDisplay.classList.add('has-file');
    bookFileDisplay.querySelector('.file-icon').innerHTML = `<span class="toast-icon" style="color: var(--success);">${ICONS.check}</span>`;
    bookFileDisplay.querySelectorAll('div')[1].textContent = file.name;
  }
});

coverFileInput.addEventListener('change', () => {
  const file = coverFileInput.files[0];
  if (file) {
    coverFileDisplay.classList.add('has-file');
    coverFileDisplay.querySelector('.file-icon').innerHTML = `<span class="toast-icon" style="color: var(--success);">${ICONS.check}</span>`;
    coverFileDisplay.querySelectorAll('div')[1].textContent = file.name;
  }
});

editCoverFileInput.addEventListener('change', () => {
  const file = editCoverFileInput.files[0];
  if (file) {
    editCoverFileDisplay.classList.add('has-file');
    editCoverFileDisplay.querySelector('.file-icon').innerHTML = `<span class="toast-icon" style="color: var(--success);">${ICONS.check}</span>`;
    editCoverFileDisplay.querySelectorAll('div')[1].textContent = file.name;
  }
});

// =====================
// Load Books
// =====================

async function loadBooks() {
  try {
    const response = await fetch(API_BASE);
    if (!response.ok) throw new Error('Error cargando libros');

    const books = await response.json();
    renderBooks(books);
  } catch (error) {
    console.error('Error loading books:', error);
    showToast('Error cargando la biblioteca', 'error');
  }
}

function renderBooks(books) {
  if (books.length === 0) {
    booksGrid.style.display = 'none';
    emptyState.style.display = 'block';
    return;
  }

  booksGrid.style.display = 'grid';
  emptyState.style.display = 'none';

  booksGrid.innerHTML = books.map((book, index) => `
    <div class="book-card"
         data-book-id="${book._id}"
         style="animation-delay: ${index * 0.05}s"
         onclick="openBook('${book._id}')">

      <div class="card-actions">
        <button class="edit-btn"
                onclick="event.stopPropagation(); openEditModal('${book._id}', '${book.title.replace(/'/g, "\\'")}', '${(book.author || '').replace(/'/g, "\\'")}')"
                aria-label="Editar libro"
                title="Editar">
          <span class="icon">${ICONS.edit}</span>
        </button>

        <button class="delete-btn"
                onclick="event.stopPropagation(); deleteBook('${book._id}', '${book.title.replace(/'/g, "\\'")}')"
                aria-label="Eliminar libro"
                title="Eliminar">
          <span class="icon">${ICONS.trash}</span>
        </button>
      </div>

      <div class="cover-wrapper">
        ${book.coverUrl
          ? `<img src="${book.coverUrl}" alt="Portada de ${book.title}" loading="lazy">`
          : `<div class="cover-placeholder"><span class="icon">${ICONS.book}</span></div>`
        }
      </div>

      <div class="card-body">
        <div class="book-title" title="${book.title}">${book.title}</div>
        <div class="book-author">${book.author || 'Autor desconocido'}</div>
        <div class="progress-bar">
          <div class="progress-fill" style="width: ${book.readingProgress || 0}%"></div>
        </div>
      </div>
    </div>
  `).join('');
}

// =====================
// Upload Book
// =====================

uploadForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const title = document.getElementById('book-title').value.trim();
  const author = document.getElementById('book-author').value.trim();
  const bookFile = bookFileInput.files[0];
  const coverFile = coverFileInput.files[0];

  if (!title || !bookFile) {
    showToast('Completá el título y seleccioná un archivo', 'error');
    return;
  }

  const formData = new FormData();
  formData.append('title', title);
  if (author) formData.append('author', author);
  formData.append('bookFile', bookFile);
  if (coverFile) formData.append('coverImage', coverFile);

  // Show loading
  uploadLoading.style.display = 'flex';

  try {
    const response = await fetch(API_BASE, {
      method: 'POST',
      body: formData
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Error subiendo el libro');
    }

    showToast(`"${data.title}" subido con éxito`, 'success');
    closeModal();
    loadBooks();
  } catch (error) {
    console.error('Upload error:', error);
    showToast(error.message, 'error');
  } finally {
    uploadLoading.style.display = 'none';
  }
});

// =====================
// Edit Book
// =====================

editForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const bookId = editBookIdInput.value;
  const title = editBookTitleInput.value.trim();
  const author = editBookAuthorInput.value.trim();
  const coverFile = editCoverFileInput.files[0];

  if (!title) {
    showToast('El título es obligatorio', 'error');
    return;
  }

  const formData = new FormData();
  formData.append('title', title);
  if (author !== undefined) formData.append('author', author);
  if (coverFile) formData.append('coverImage', coverFile);

  // Show loading
  editLoading.style.display = 'flex';

  try {
    const response = await fetch(`${API_BASE}/${bookId}`, {
      method: 'PATCH',
      body: formData
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Error actualizando el libro');
    }

    showToast(`"${data.title}" actualizado con éxito`, 'success');
    closeModal();
    loadBooks();
  } catch (error) {
    console.error('Edit error:', error);
    showToast(error.message, 'error');
  } finally {
    editLoading.style.display = 'none';
  }
});

// =====================
// Delete Book
// =====================

async function deleteBook(bookId, title) {
  if (!confirm(`¿Eliminar "${title}"? Esta acción no se puede deshacer.`)) return;

  try {
    const response = await fetch(`${API_BASE}/${bookId}`, {
      method: 'DELETE'
    });

    if (!response.ok) throw new Error('Error eliminando el libro');

    showToast(`"${title}" eliminado`, 'success');
    loadBooks();
  } catch (error) {
    console.error('Delete error:', error);
    showToast('Error eliminando el libro', 'error');
  }
}

// =====================
// Navigation
// =====================

function openBook(bookId) {
  window.location.href = `reader.html?id=${bookId}`;
}

// =====================
// Init
// =====================

loadBooks();

// =====================
// PWA Service Worker Registration
// =====================

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js')
      .then(registration => {
        console.log('[PWA] Service Worker registrado exitosamente con el alcance:', registration.scope);
      })
      .catch(error => {
        console.error('[PWA] Error registrando el Service Worker:', error);
      });
  });
}
