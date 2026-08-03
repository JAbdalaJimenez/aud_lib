/**
 * AudioLib — Reader & TTS Player Logic
 *
 * Features:
 * - Loads book text from API
 * - Renders each word as a clickable <span>
 * - Web Speech API playback with real-time word highlighting (onboundary)
 * - Auto-scroll to active word
 * - Speed control (0.5x–2x)
 * - Voice selector
 * - Click-to-seek on any word
 * - Progress persistence (pause, beforeunload, periodic save)
 * - Resume from last position
 */

const API_BASE = '/api/books';

// SVG Icons
const ICONS = {
  check: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
  x: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
  info: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
  play: '<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" stroke="none"><polygon points="6 3 20 12 6 21 6 3"/></svg>',
  pause: '<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" stroke="none"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>',
  alertCircle: '<svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
  inbox: '<svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>',
};

// =====================
// State
// =====================

let bookId = null;
let bookData = null;
let fullText = '';
let wordSpans = [];        // All rendered <span> elements
let charToSpanIndex = [];  // Maps charIndex → span index

let synth = window.speechSynthesis;
let utterance = null;
let isPlaying = false;
let isPaused = false;
let currentCharIndex = 0;  // Current position in text being spoken
let startCharOffset = 0;   // Offset when starting from a specific position
let selectedVoice = null;
let currentRate = 1;

let autoSaveTimer = null;

// DOM
const readerTitle = document.getElementById('reader-title');
const readerAuthor = document.getElementById('reader-author');
const readerLoading = document.getElementById('reader-loading');
const textContainer = document.getElementById('text-container');
const playerBar = document.getElementById('player-bar');
const btnPlay = document.getElementById('btn-play');
const speedRange = document.getElementById('speed-range');
const speedValue = document.getElementById('speed-value');
const voiceSelect = document.getElementById('voice-select');
const progressPlayed = document.getElementById('progress-played');
const progressTrack = document.getElementById('progress-track');
const toastContainer = document.getElementById('toast-container');

// =====================
// Toast
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
// Init
// =====================

async function init() {
  // Extract book ID from URL
  const params = new URLSearchParams(window.location.search);
  bookId = params.get('id');

  if (!bookId) {
    showToast('No se especificó un libro', 'error');
    setTimeout(() => window.location.href = 'index.html', 1500);
    return;
  }

  // Load voices
  loadVoices();
  if (synth.onvoiceschanged !== undefined) {
    synth.onvoiceschanged = loadVoices;
  }

  // Load book
  await loadBook();

  // Setup event listeners
  setupControls();
}

// =====================
// Load Book
// =====================

async function loadBook() {
  try {
    const response = await fetch(`${API_BASE}/${bookId}`);
    if (!response.ok) throw new Error('Libro no encontrado');

    bookData = await response.json();

    document.title = `AudioLib — ${bookData.title}`;
    readerTitle.textContent = bookData.title;
    readerAuthor.textContent = bookData.author || '';

    // Use chapter text or full text
    if (bookData.chapters && bookData.chapters.length > 0) {
      fullText = bookData.chapters.map(ch =>
        (ch.title ? ch.title + '\n\n' : '') + ch.content
      ).join('\n\n');
    } else {
      fullText = bookData.text || '';
    }

    if (!fullText.trim()) {
      readerLoading.innerHTML = `
        <div class="reader-status">
          <span class="icon">${ICONS.inbox}</span>
          <div class="loading-text">Este libro no tiene contenido de texto</div>
        </div>
      `;
      return;
    }

    renderText();
    readerLoading.style.display = 'none';
    textContainer.style.display = 'block';
    playerBar.style.display = 'block';

    // Restore reading position
    if (bookData.lastCharIndex > 0) {
      restorePosition(bookData.lastCharIndex);
    }

  } catch (error) {
    console.error('Error loading book:', error);
    readerLoading.innerHTML = `
      <div class="reader-status">
        <span class="icon" style="color: var(--danger);">${ICONS.alertCircle}</span>
        <div class="loading-text">Error cargando el libro</div>
      </div>
    `;
    showToast(error.message, 'error');
  }
}

// =====================
// Render Text (word-level spans)
// =====================

function renderText() {
  textContainer.innerHTML = '';
  wordSpans = [];
  charToSpanIndex = new Array(fullText.length).fill(-1);

  // Split text into paragraphs
  const paragraphs = fullText.split(/\n\s*\n/);
  let globalCharIndex = 0;

  paragraphs.forEach((para, pIndex) => {
    if (!para.trim()) {
      // Account for the paragraph separator
      globalCharIndex += para.length + (pIndex < paragraphs.length - 1 ? 2 : 0);
      return;
    }

    const pEl = document.createElement('div');
    pEl.className = 'paragraph';

    // Split paragraph into tokens (words + whitespace)
    const tokens = para.match(/\S+|\s+/g) || [];

    tokens.forEach(token => {
      if (/^\s+$/.test(token)) {
        // Whitespace — render as text node
        pEl.appendChild(document.createTextNode(token));
        // Map these chars
        for (let i = 0; i < token.length; i++) {
          if (globalCharIndex + i < charToSpanIndex.length) {
            charToSpanIndex[globalCharIndex + i] = wordSpans.length; // point to next word
          }
        }
        globalCharIndex += token.length;
      } else {
        // Word — render as span
        const span = document.createElement('span');
        span.className = 'word';
        span.textContent = token;
        span.dataset.charIndex = globalCharIndex;
        span.dataset.spanIndex = wordSpans.length;

        // Map char indices to this span
        for (let i = 0; i < token.length; i++) {
          if (globalCharIndex + i < charToSpanIndex.length) {
            charToSpanIndex[globalCharIndex + i] = wordSpans.length;
          }
        }

        // Click to seek
        span.addEventListener('click', () => {
          seekToChar(parseInt(span.dataset.charIndex));
        });

        pEl.appendChild(span);
        wordSpans.push(span);
        globalCharIndex += token.length;
      }
    });

    textContainer.appendChild(pEl);

    // Account for paragraph separator (\n\n)
    if (pIndex < paragraphs.length - 1) {
      globalCharIndex += 2;
    }
  });
}

// =====================
// Speech Synthesis
// =====================

function speak(fromCharIndex = 0) {
  // Cancel any existing speech
  synth.cancel();

  // Get substring from position
  const textToSpeak = fullText.substring(fromCharIndex);
  if (!textToSpeak.trim()) {
    showToast('Fin del libro', 'info');
    stopPlayback();
    return;
  }

  startCharOffset = fromCharIndex;
  utterance = new SpeechSynthesisUtterance(textToSpeak);
  utterance.rate = currentRate;
  utterance.lang = 'es-ES';

  if (selectedVoice) {
    utterance.voice = selectedVoice;
  }

  // ---- onboundary: highlight current word ----
  utterance.onboundary = (event) => {
    if (event.name === 'word') {
      const charIndex = startCharOffset + event.charIndex;
      currentCharIndex = charIndex;
      highlightWord(charIndex);
      updateProgress(charIndex);
    }
  };

  // ---- onend: playback finished ----
  utterance.onend = () => {
    if (isPlaying && !isPaused) {
      stopPlayback();
      updateProgress(fullText.length);
      saveProgress(fullText.length);
      showToast('Lectura completada', 'success');
    }
  };

  // ---- onerror ----
  utterance.onerror = (event) => {
    if (event.error !== 'canceled' && event.error !== 'interrupted') {
      console.error('Speech error:', event.error);
      showToast('Error en la síntesis de voz', 'error');
      stopPlayback();
    }
  };

  synth.speak(utterance);
  isPlaying = true;
  isPaused = false;
  btnPlay.innerHTML = `<span class="icon">${ICONS.pause}</span>`;
  btnPlay.title = 'Pausar';

  // Start auto-save timer
  startAutoSave();
}

function togglePlayPause() {
  if (!isPlaying && !isPaused) {
    // Start playback from current position or beginning
    speak(currentCharIndex || 0);
  } else if (isPlaying && !isPaused) {
    // Pause
    synth.pause();
    isPaused = true;
    btnPlay.innerHTML = `<span class="icon">${ICONS.play}</span>`;
    btnPlay.title = 'Reproducir';
    saveProgress(currentCharIndex);
    stopAutoSave();
  } else if (isPaused) {
    // Resume
    synth.resume();
    isPaused = false;
    btnPlay.innerHTML = `<span class="icon">${ICONS.pause}</span>`;
    btnPlay.title = 'Pausar';
    startAutoSave();
  }
}

function stopPlayback() {
  synth.cancel();
  isPlaying = false;
  isPaused = false;
  btnPlay.innerHTML = `<span class="icon">${ICONS.play}</span>`;
  btnPlay.title = 'Reproducir';
  stopAutoSave();
}

function seekToChar(charIndex) {
  const wasPlaying = isPlaying;
  stopPlayback();
  currentCharIndex = charIndex;

  // Clear highlights
  clearHighlights();

  if (wasPlaying) {
    // Resume from new position
    speak(charIndex);
  } else {
    // Just highlight the position
    highlightWord(charIndex);
  }
}

// =====================
// Highlighting
// =====================

let activeSpanIndex = -1;

function highlightWord(charIndex) {
  // Find the span index for this charIndex
  let spanIndex = -1;

  if (charIndex >= 0 && charIndex < charToSpanIndex.length) {
    spanIndex = charToSpanIndex[charIndex];
  }

  // Fallback: find nearest span
  if (spanIndex < 0 || spanIndex >= wordSpans.length) {
    for (let i = charIndex; i < Math.min(charIndex + 20, charToSpanIndex.length); i++) {
      if (charToSpanIndex[i] >= 0 && charToSpanIndex[i] < wordSpans.length) {
        spanIndex = charToSpanIndex[i];
        break;
      }
    }
  }

  if (spanIndex < 0 || spanIndex >= wordSpans.length) return;

  // Remove previous highlight
  if (activeSpanIndex >= 0 && activeSpanIndex < wordSpans.length) {
    wordSpans[activeSpanIndex].classList.remove('active');
    wordSpans[activeSpanIndex].classList.add('spoken');
  }

  // Add new highlight
  wordSpans[spanIndex].classList.add('active');
  activeSpanIndex = spanIndex;

  // Auto-scroll
  wordSpans[spanIndex].scrollIntoView({
    behavior: 'smooth',
    block: 'center'
  });
}

function clearHighlights() {
  wordSpans.forEach(span => {
    span.classList.remove('active', 'spoken');
  });
  activeSpanIndex = -1;
}

// =====================
// Progress
// =====================

function updateProgress(charIndex) {
  const percentage = fullText.length > 0
    ? Math.min(100, (charIndex / fullText.length) * 100)
    : 0;
  progressPlayed.style.width = `${percentage}%`;
}

async function saveProgress(charIndex) {
  if (!bookId) return;

  const readingProgress = fullText.length > 0
    ? Math.min(100, Math.round((charIndex / fullText.length) * 100))
    : 0;

  try {
    await fetch(`${API_BASE}/${bookId}/progress`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        readingProgress,
        lastCharIndex: charIndex
      })
    });
  } catch (error) {
    console.error('Error saving progress:', error);
  }
}

function startAutoSave() {
  stopAutoSave();
  autoSaveTimer = setInterval(() => {
    if (isPlaying && !isPaused) {
      saveProgress(currentCharIndex);
    }
  }, 30000); // Every 30 seconds
}

function stopAutoSave() {
  if (autoSaveTimer) {
    clearInterval(autoSaveTimer);
    autoSaveTimer = null;
  }
}

function restorePosition(charIndex) {
  if (charIndex <= 0 || charIndex >= fullText.length) return;

  currentCharIndex = charIndex;
  highlightWord(charIndex);
  updateProgress(charIndex);

  // Mark previous words as spoken
  const spanIdx = charToSpanIndex[charIndex];
  if (spanIdx > 0) {
    for (let i = 0; i < spanIdx; i++) {
      wordSpans[i].classList.add('spoken');
    }
  }

  showToast('Continuando donde lo dejaste', 'info');
}

// =====================
// Voices
// =====================

function loadVoices() {
  const voices = synth.getVoices();
  voiceSelect.innerHTML = '';

  // Prefer Spanish voices, then show all
  const spanishVoices = voices.filter(v => v.lang.startsWith('es'));
  const otherVoices = voices.filter(v => !v.lang.startsWith('es'));
  const sortedVoices = [...spanishVoices, ...otherVoices];

  if (sortedVoices.length === 0) {
    voiceSelect.innerHTML = '<option value="">Sin voces</option>';
    return;
  }

  sortedVoices.forEach((voice, i) => {
    const option = document.createElement('option');
    option.value = i;
    const langTag = voice.lang.startsWith('es') ? '[ES]' : '[' + voice.lang.substring(0, 2).toUpperCase() + ']';
    option.textContent = `${langTag} ${voice.name}`;
    option.dataset.voiceIndex = voices.indexOf(voice);
    voiceSelect.appendChild(option);
  });

  // Auto-select first Spanish voice
  if (spanishVoices.length > 0) {
    selectedVoice = spanishVoices[0];
  }
}

// =====================
// Controls Setup
// =====================

function setupControls() {
  // Play / Pause
  btnPlay.addEventListener('click', togglePlayPause);

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;

    switch (e.code) {
      case 'Space':
        e.preventDefault();
        togglePlayPause();
        break;
      case 'ArrowRight':
        // Skip forward ~50 words
        if (isPlaying) {
          const nextIndex = Math.min(fullText.length - 1, currentCharIndex + 300);
          seekToChar(nextIndex);
        }
        break;
      case 'ArrowLeft':
        // Skip backward ~50 words
        if (isPlaying || currentCharIndex > 0) {
          const prevIndex = Math.max(0, currentCharIndex - 300);
          seekToChar(prevIndex);
        }
        break;
    }
  });

  // Speed slider
  speedRange.addEventListener('input', () => {
    currentRate = parseFloat(speedRange.value);
    speedValue.textContent = `${currentRate}x`;

    // If currently speaking, restart with new rate
    if (isPlaying && !isPaused) {
      const resumeFrom = currentCharIndex;
      stopPlayback();
      speak(resumeFrom);
    }
  });

  // Voice selector
  voiceSelect.addEventListener('change', () => {
    const option = voiceSelect.selectedOptions[0];
    if (option && option.dataset.voiceIndex !== undefined) {
      const voices = synth.getVoices();
      selectedVoice = voices[parseInt(option.dataset.voiceIndex)];

      // Restart if playing
      if (isPlaying) {
        const resumeFrom = currentCharIndex;
        stopPlayback();
        speak(resumeFrom);
      }
    }
  });

  // Click on progress track to seek
  progressTrack.addEventListener('click', (e) => {
    const rect = progressTrack.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    const targetChar = Math.floor(ratio * fullText.length);
    seekToChar(targetChar);
  });

  // Save progress on page unload
  window.addEventListener('beforeunload', () => {
    if (currentCharIndex > 0) {
      // Use sendBeacon for reliable save
      const data = JSON.stringify({
        readingProgress: Math.min(100, Math.round((currentCharIndex / fullText.length) * 100)),
        lastCharIndex: currentCharIndex
      });
      navigator.sendBeacon(
        `${API_BASE}/${bookId}/progress`,
        new Blob([data], { type: 'application/json' })
      );
    }
    synth.cancel();
  });
}

// =====================
// Start
// =====================

init();
