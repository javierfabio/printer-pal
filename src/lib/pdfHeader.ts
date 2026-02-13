import jsPDF from 'jspdf';

const LOGO_STORAGE_KEY = 'corporate_logo_base64';

export function saveCorporateLogo(base64: string) {
  localStorage.setItem(LOGO_STORAGE_KEY, base64);
}

export function getCorporateLogo(): string | null {
  return localStorage.getItem(LOGO_STORAGE_KEY);
}

export function removeCorporateLogo() {
  localStorage.removeItem(LOGO_STORAGE_KEY);
}

/**
 * Adds a unified corporate header to a jsPDF document.
 * Returns the Y position after the header so content can start below it.
 */
export function addPDFHeader(doc: jsPDF, title: string, subtitle?: string): number {
  const pageWidth = doc.internal.pageSize.getWidth();
  const logo = getCorporateLogo();
  let currentY = 14;

  if (logo) {
    try {
      // Add logo on the left (max 30x30)
      doc.addImage(logo, 'PNG', 14, 10, 28, 28);
      currentY = 18;
    } catch {
      // If logo fails, just skip it
    }
  }

  // Title
  const titleX = logo ? 48 : 14;
  doc.setFontSize(18);
  doc.setTextColor(40, 40, 40);
  doc.text(title, titleX, currentY);

  // Subtitle or date
  currentY += 7;
  doc.setFontSize(9);
  doc.setTextColor(120, 120, 120);
  if (subtitle) {
    doc.text(subtitle, titleX, currentY);
    currentY += 5;
  }
  doc.text(
    `Generado: ${new Date().toLocaleDateString('es', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`,
    titleX,
    currentY
  );

  // Separator line
  currentY += 4;
  const lineY = Math.max(currentY, logo ? 42 : currentY);
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.5);
  doc.line(14, lineY, pageWidth - 14, lineY);

  return lineY + 6;
}

/**
 * Adds page numbers to all pages of a jsPDF document.
 */
export function addPDFPageNumbers(doc: jsPDF) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `Página ${i} de ${pageCount}`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: 'center' }
    );
  }
}
