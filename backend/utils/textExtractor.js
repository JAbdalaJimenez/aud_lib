const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const AdmZip = require('adm-zip');
const cheerio = require('cheerio');

/**
 * Extrae texto de un archivo según su tipo.
 * @param {string} filePath — Ruta absoluta al archivo
 * @param {string} fileType — Tipo: 'pdf' | 'epub' | 'txt' | 'zip'
 * @returns {Promise<{ text: string, chapters: Array<{title: string, content: string}> }>}
 */
async function extractText(filePath, fileType) {
  switch (fileType) {
    case 'txt':
      return extractFromTxt(filePath);
    case 'pdf':
      return extractFromPdf(filePath);
    case 'epub':
      return extractFromEpub(filePath);
    case 'zip':
      return extractFromZip(filePath);
    default:
      throw new Error(`Tipo de archivo no soportado: ${fileType}`);
  }
}

/**
 * Extrae texto de un archivo TXT.
 */
async function extractFromTxt(filePath) {
  const text = fs.readFileSync(filePath, 'utf-8');
  return { text, chapters: [] };
}

/**
 * Extrae texto de un archivo PDF usando pdf-parse.
 */
async function extractFromPdf(filePath) {
  const buffer = fs.readFileSync(filePath);
  const data = await pdfParse(buffer);
  return { text: data.text, chapters: [] };
}

/**
 * Extrae texto de un archivo EPUB.
 * EPUB es un ZIP con archivos XHTML dentro. Se lee el content.opf
 * para determinar el orden de los capítulos, luego se parsea cada
 * archivo XHTML con cheerio.
 */
async function extractFromEpub(filePath) {
  const zip = new AdmZip(filePath);
  const entries = zip.getEntries();
  const chapters = [];

  // Buscar el archivo container.xml para encontrar el rootfile (content.opf)
  let opfPath = '';
  const containerEntry = entries.find(e =>
    e.entryName.toLowerCase() === 'meta-inf/container.xml'
  );

  if (containerEntry) {
    const containerXml = containerEntry.getData().toString('utf-8');
    const $container = cheerio.load(containerXml, { xmlMode: true });
    const rootfilePath = $container('rootfile').attr('full-path');
    if (rootfilePath) {
      opfPath = rootfilePath;
    }
  }

  // Leer el OPF para obtener el orden de los archivos de contenido
  let contentFiles = [];
  const opfDir = opfPath ? path.dirname(opfPath).replace(/\\/g, '/') : '';

  if (opfPath) {
    const opfEntry = entries.find(e => e.entryName === opfPath);
    if (opfEntry) {
      const opfXml = opfEntry.getData().toString('utf-8');
      const $opf = cheerio.load(opfXml, { xmlMode: true });

      // Crear mapa de id → href desde el manifest
      const manifest = {};
      $opf('manifest item').each((_, el) => {
        const id = $opf(el).attr('id');
        const href = $opf(el).attr('href');
        const mediaType = $opf(el).attr('media-type') || '';
        if (mediaType.includes('html') || mediaType.includes('xml')) {
          manifest[id] = href;
        }
      });

      // Leer el spine para el orden de lectura
      $opf('spine itemref').each((_, el) => {
        const idref = $opf(el).attr('idref');
        if (manifest[idref]) {
          const fullPath = opfDir ? `${opfDir}/${manifest[idref]}` : manifest[idref];
          contentFiles.push(fullPath);
        }
      });
    }
  }

  // Fallback: si no se encontró OPF o spine, buscar todos los XHTML/HTML
  if (contentFiles.length === 0) {
    contentFiles = entries
      .filter(e => /\.(xhtml|html|htm)$/i.test(e.entryName))
      .sort((a, b) => a.entryName.localeCompare(b.entryName))
      .map(e => e.entryName);
  }

  // Extraer texto de cada archivo de contenido
  for (const cf of contentFiles) {
    const entry = entries.find(e => e.entryName === cf);
    if (!entry) continue;

    const html = entry.getData().toString('utf-8');
    const $ = cheerio.load(html, { xmlMode: true });

    // Intentar obtener título del capítulo
    const title = $('h1, h2, h3').first().text().trim() || `Capítulo ${chapters.length + 1}`;

    // Extraer texto del body
    const bodyText = $('body').text().trim() || $.root().text().trim();

    if (bodyText.length > 0) {
      chapters.push({ title, content: bodyText });
    }
  }

  // Concatenar todo el texto
  const fullText = chapters.map(ch => ch.content).join('\n\n');

  return { text: fullText, chapters };
}

/**
 * Extrae texto de un archivo ZIP (busca .txt dentro).
 */
async function extractFromZip(filePath) {
  const zip = new AdmZip(filePath);
  const entries = zip.getEntries();
  const textParts = [];

  for (const entry of entries) {
    if (entry.isDirectory) continue;
    const ext = path.extname(entry.entryName).toLowerCase();

    if (ext === '.txt') {
      textParts.push(entry.getData().toString('utf-8'));
    } else if (ext === '.html' || ext === '.htm' || ext === '.xhtml') {
      const html = entry.getData().toString('utf-8');
      const $ = cheerio.load(html);
      textParts.push($('body').text().trim() || $.root().text().trim());
    }
  }

  const text = textParts.join('\n\n');
  if (!text) {
    throw new Error('No se encontraron archivos de texto dentro del ZIP');
  }

  return { text, chapters: [] };
}

/**
 * Detecta el tipo de archivo por su extensión.
 */
function detectFileType(filename) {
  const ext = path.extname(filename).toLowerCase().replace('.', '');
  if (['pdf', 'epub', 'txt', 'zip'].includes(ext)) {
    return ext;
  }
  return 'unknown';
}

module.exports = { extractText, detectFileType };
