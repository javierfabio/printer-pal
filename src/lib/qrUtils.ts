import QRCode from 'qrcode';
import jsPDF from 'jspdf';

export interface QRPrinterData {
  id: string;
  serie: string;
  nombre: string;
  modelo: string;
  filial: string;
  sector: string;
}

export async function generateQRBase64(data: QRPrinterData): Promise<string> {
  // QR contiene URL completa para que la cámara del celular abra el navegador directo
  const content = `${window.location.origin}/scan/${data.id}`;
  return await QRCode.toDataURL(content, {
    width: 400,
    margin: 2,
    color: { dark: '#000000', light: '#ffffff' },
    errorCorrectionLevel: 'H',
  });
}

// PDF individual tamaño etiqueta 8x10 cm
export async function generateQRPDF(printer: QRPrinterData): Promise<void> {
  const qrBase64 = await generateQRBase64(printer);
  const doc = new jsPDF({ unit: 'mm', format: [80, 100] });

  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, 80, 100, 'F');
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.5);
  doc.rect(2, 2, 76, 96);

  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(120, 120, 120);
  doc.text('IMPRESORA', 40, 9, { align: 'center' });

  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  const nombreTrunc = printer.nombre.length > 18 ? printer.nombre.slice(0, 18) + '…' : printer.nombre;
  doc.text(nombreTrunc, 40, 17, { align: 'center' });

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(90, 90, 90);
  doc.text(printer.modelo, 40, 23, { align: 'center' });

  doc.addImage(qrBase64, 'PNG', 14, 26, 52, 52);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text(printer.serie, 40, 84, { align: 'center' });

  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  const filialTrunc = printer.filial.length > 28 ? printer.filial.slice(0, 28) + '…' : printer.filial;
  const sectorTrunc = printer.sector.length > 28 ? printer.sector.slice(0, 28) + '…' : printer.sector;
  doc.text(filialTrunc, 40, 90, { align: 'center' });
  doc.text(sectorTrunc, 40, 95, { align: 'center' });

  doc.save(`QR_${printer.nombre}_${printer.serie}.pdf`);
}

// PDF masivo A4 con grilla 3x4 etiquetas por página
export async function generateQRBulkPDF(printers: QRPrinterData[]): Promise<void> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const COLS = 3;
  const ROWS = 4;
  const LW = 60;
  const LH = 65;
  const MX = 12;
  const MY = 12;
  const GX = 5;
  const GY = 5;

  for (let i = 0; i < printers.length; i++) {
    const col = i % COLS;
    const row = Math.floor(i / COLS) % ROWS;
    const pageItem = i % (COLS * ROWS);

    if (i > 0 && pageItem === 0) doc.addPage();

    const x = MX + col * (LW + GX);
    const y = MY + row * (LH + GY);

    const qr = await generateQRBase64(printers[i]);

    doc.setDrawColor(180, 180, 180);
    doc.setLineWidth(0.3);
    doc.rect(x, y, LW, LH);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0);
    const nm = printers[i].nombre.length > 14 ? printers[i].nombre.slice(0, 14) + '…' : printers[i].nombre;
    doc.text(nm, x + LW / 2, y + 7, { align: 'center' });

    doc.setFontSize(6);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80);
    doc.text(printers[i].modelo, x + LW / 2, y + 12, { align: 'center' });

    doc.addImage(qr, 'PNG', x + 10, y + 14, 40, 40);

    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0);
    doc.text(printers[i].serie, x + LW / 2, y + 58, { align: 'center' });

    doc.setFontSize(5.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100);
    const fl = printers[i].filial.length > 22 ? printers[i].filial.slice(0, 22) + '…' : printers[i].filial;
    const sc = printers[i].sector.length > 22 ? printers[i].sector.slice(0, 22) + '…' : printers[i].sector;
    doc.text(fl, x + LW / 2, y + 62, { align: 'center' });
    doc.text(sc, x + LW / 2, y + 66.5, { align: 'center' });
  }

  const fecha = new Date().toLocaleDateString('es').replace(/\//g, '-');
  doc.save(`QR_Impresoras_${fecha}.pdf`);
}