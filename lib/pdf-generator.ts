import { getDownloadURL, ref as storageRef } from "firebase/storage";
import { storage } from "@/lib/firebase";
import { toast } from "sonner";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

// --- NUEVA FUNCIÓN DE FORMATO DE MONEDA ---
/**
 * Formatea un número como moneda ARS sin decimales y con punto de mil.
 * @param amount El monto a formatear.
 * @returns El monto formateado como string (ej. "$150.000").
 */
const formatCurrencyForPdf = (amount: number): string => {
  const roundedAmount = Math.round(amount);
  return `$${roundedAmount.toLocaleString('es-AR')}`;
};


// Función para verificar si una plantilla PDF existe en Firebase Storage
const checkPdfExists = async (path: string): Promise<boolean> => {
  try {
    const fileRef = storageRef(storage, path);
    await getDownloadURL(fileRef);
    return true;
  } catch (error) {
    console.warn(`La plantilla PDF en la ruta "${path}" no existe.`);
    return false;
  }
};

// --- Generador de PDF para Ventas ---
export const generateSaleReceiptPdf = async (completedSale: any) => {
  if (!completedSale) {
    toast.error("Error", { description: "No hay datos de la venta para generar el PDF." });
    return;
  }

  toast.loading("Generando PDF...", {
    description: "Espere mientras se prepara el comprobante.",
  });

  try {
    const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
    let pdfDoc: PDFDocument;

    const pdfTemplatePath = "templates/factura.pdf";
    const pdfTemplateExists = await checkPdfExists(pdfTemplatePath);

    if (pdfTemplateExists) {
      try {
        const pdfTemplateUrl = await getDownloadURL(storageRef(storage, pdfTemplatePath));
        const pdfArrayBuffer = await fetch(pdfTemplateUrl).then(res => res.arrayBuffer());
        pdfDoc = await PDFDocument.load(pdfArrayBuffer);
      } catch (e) {
        console.error("Error al cargar la plantilla PDF, creando uno desde cero.", e);
        pdfDoc = await PDFDocument.create();
        pdfDoc.addPage([595, 842]);
        toast.info("Plantilla no encontrada", { description: "Se ha creado un comprobante básico." });
      }
    } else {
      pdfDoc = await PDFDocument.create();
      pdfDoc.addPage([595, 842]);
    }

    const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const firstPage = pdfDoc.getPages()[0];
    
    drawSalePdfContent(firstPage, completedSale, { helveticaFont, helveticaBold });

    if (pdfDoc.getPageCount() > 1) {
        const secondPage = pdfDoc.getPages()[1];
        drawSalePdfContent(secondPage, completedSale, { helveticaFont, helveticaBold });
    }

    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([pdfBytes], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Recibo-${completedSale.receiptNumber}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success("PDF generado", { description: "El comprobante se ha descargado." });
  } catch (error) {
    console.error("Error al generar el PDF:", error);
    toast.error("Error de PDF", { description: `No se pudo generar el comprobante: ${(error as Error).message}` });
  }
};

const drawSalePdfContent = (page, saleData, fonts) => {
    const { helveticaFont, helveticaBold } = fonts;

    const positions = {
        numeroRecibo: { x: 430, y: 697 },
        fecha: { x: 430, y: 710 },
        nombreCliente: { x: 110, y: 657 },
        dniCliente: { x: 110, y: 643 },
        celCliente: { x: 110, y: 630 },
        itemStartY: 548,
        itemStartX: 65,
        imeiStartX: 320,
        priceStartX: 455,
        subtotal: { x: 400, y: 335 },
        parteDePago: { x: 400, y: 320 },
        precioFinal: { x: 455, y: 290 },
    };

    const formattedDate = new Date(saleData.date).toLocaleDateString();

    page.drawText(String(saleData.receiptNumber), { ...positions.numeroRecibo, size: 10, font: helveticaFont });
    page.drawText(formattedDate, { ...positions.fecha, size: 10, font: helveticaFont });
    page.drawText(String(saleData.customerName), { ...positions.nombreCliente, size: 10, font: helveticaFont });
    page.drawText(String(saleData.customerDni), { ...positions.dniCliente, size: 10, font: helveticaFont });
    page.drawText(String(saleData.customerPhone), { ...positions.celCliente, size: 10, font: helveticaFont });

    let currentY = positions.itemStartY;
    const itemLineHeight = 15;

    saleData.items.forEach(item => {
        const itemPrice = item.price * (item.currency === 'USD' ? saleData.usdRate : 1);
        const totalPrice = itemPrice * item.quantity;
        
        const displayName = item.imei ? item.productName : `${item.quantity}x ${item.productName}`;
        
        page.drawText(displayName, { x: positions.itemStartX, y: currentY, size: 10, font: helveticaFont });
        
        if (item.price > 0) {
           page.drawText(formatCurrencyForPdf(totalPrice), { x: positions.priceStartX, y: currentY, size: 10, font: helveticaFont });
        } else {
           page.drawText("Regalo", { x: positions.priceStartX, y: currentY, size: 10, font: helveticaBold, color: rgb(0, 0.5, 0) });
        }
        
        let identifiers = [];
        if (item.barcode) identifiers.push(`S/N: ${item.barcode}`);
        if (item.imei) identifiers.push(`IMEI: ${item.imei}`);

        if (identifiers.length > 0) {
             page.drawText(identifiers.join(' / '), { x: positions.imeiStartX, y: currentY, size: 8, font: helveticaFont, color: rgb(0.3, 0.3, 0.3) });
        }
        
        currentY -= itemLineHeight;
    });

    const finalAmount = saleData.totalAmount || 0;
    
    if (saleData.tradeIn && saleData.tradeIn.price > 0) {
        const cartTotal = saleData.items.reduce((sum, item) => {
            const priceInArs = item.price * (item.currency === 'USD' ? saleData.usdRate : 1);
            return sum + (priceInArs * item.quantity);
        }, 0);
        const tradeInValue = saleData.tradeIn.price * saleData.usdRate;

        page.drawText(`Subtotal: ${formatCurrencyForPdf(cartTotal)}`, { ...positions.subtotal, size: 10, font: helveticaFont });
        
        const tradeInName = `Parte de Pago: ${saleData.tradeIn.name}`;
        let tradeInIdentifiers = [];
        if (saleData.tradeIn.serialNumber) tradeInIdentifiers.push(`S/N: ${saleData.tradeIn.serialNumber}`);
        if (saleData.tradeIn.imei) tradeInIdentifiers.push(`IMEI: ${saleData.tradeIn.imei}`);

        page.drawText(tradeInName, { x: positions.itemStartX, y: positions.parteDePago.y, size: 8, font: helveticaBold });
        if(tradeInIdentifiers.length > 0) {
            page.drawText(tradeInIdentifiers.join(' / '), { x: positions.imeiStartX, y: positions.parteDePago.y, size: 8, font: helveticaBold });
        }
        page.drawText(`-${formatCurrencyForPdf(tradeInValue)}`, { ...positions.parteDePago, x: positions.priceStartX, size: 10, font: helveticaFont, color: rgb(0.7, 0, 0) });
        
    } else {
        page.drawText(`Subtotal: ${formatCurrencyForPdf(finalAmount)}`, { ...positions.subtotal, size: 10, font: helveticaFont });
    }

    page.drawText(`Total: ${formatCurrencyForPdf(finalAmount)}`, { ...positions.precioFinal, size: 12, font: helveticaBold });
}


// --- Generador de PDF para Reparaciones (Presupuesto) ---
export const generateRepairReceiptPdf = async (repairData: any, customerData: any) => {
  if (!repairData || !customerData) {
    toast.error("Error", { description: "No hay datos para generar el PDF de reparación." });
    return;
  }

  toast.loading("Generando presupuesto PDF...", {
    description: "Espere mientras se prepara el comprobante.",
  });

  try {
    const { PDFDocument, StandardFonts } = await import("pdf-lib");
    let pdfDoc: PDFDocument;
    
    const pdfTemplatePath = "templates/presupuesto.pdf";
    const pdfTemplateExists = await checkPdfExists(pdfTemplatePath);

    if (pdfTemplateExists) {
      try {
        const pdfTemplateUrl = await getDownloadURL(storageRef(storage, pdfTemplatePath));
        const pdfArrayBuffer = await fetch(pdfTemplateUrl).then(res => res.arrayBuffer());
        pdfDoc = await PDFDocument.load(pdfArrayBuffer);
      } catch (e) {
        console.error("Error al cargar la plantilla de presupuesto, creando uno desde cero.", e);
        pdfDoc = await PDFDocument.create();
        pdfDoc.addPage([595, 842]);
        toast.info("Plantilla no encontrada", { description: "Se ha creado un comprobante básico." });
      }
    } else {
      pdfDoc = await PDFDocument.create();
      pdfDoc.addPage([595, 842]);
    }

    const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const firstPage = pdfDoc.getPages()[0];
    
    drawRepairPdfContent(firstPage, repairData, customerData, { helveticaFont, helveticaBold });

    if (pdfDoc.getPageCount() > 1) {
        const secondPage = pdfDoc.getPages()[1];
        drawRepairPdfContent(secondPage, repairData, customerData, { helveticaFont, helveticaBold });
    }

    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([pdfBytes], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Presupuesto-${repairData.receiptNumber}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success("PDF generado", { description: "El presupuesto se ha descargado." });
  } catch (error) {
    console.error("Error al generar el PDF de reparación:", error);
    toast.error("Error de PDF", { description: `No se pudo generar el comprobante: ${(error as Error).message}` });
  }
};

const drawRepairPdfContent = (page, repair, customer, fonts) => {
    const { helveticaFont, helveticaBold } = fonts;

    const positions = {
        numeroRecibo: { x: 430, y: 697 },
        fecha: { x: 430, y: 710 },
        nombreCliente: { x: 110, y: 657 },
        dniCliente: { x: 110, y: 643 },
        celCliente: { x: 110, y: 630 },
        itemStartY: 548,
        itemStartX: 65,
        imeiStartX: 320,
        priceStartX: 455,
        descriptionY: 500,
        priceFinalY: 290
    };

    const formattedDate = new Date(repair.entryDate).toLocaleDateString();

    page.drawText(String(repair.receiptNumber), { ...positions.numeroRecibo, size: 10, font: helveticaFont });
    page.drawText(formattedDate, { ...positions.fecha, size: 10, font: helveticaFont });
    page.drawText(String(customer.name), { ...positions.nombreCliente, size: 10, font: helveticaFont });
    page.drawText(String(customer.dni), { ...positions.dniCliente, size: 10, font: helveticaFont });
    page.drawText(String(customer.phone), { ...positions.celCliente, size: 10, font: helveticaFont });

    page.drawText(repair.productName, { x: positions.itemStartX, y: positions.itemStartY, size: 12, font: helveticaFont });

    let identifiers = [];
    if (repair.unlockPin) identifiers.push(`PIN: ${repair.unlockPin}`);
    if (repair.imei) identifiers.push(`IMEI: ${repair.imei}`);
    
    if (identifiers.length > 0) {
        page.drawText(identifiers.join('  /  '), { x: positions.imeiStartX, y: positions.itemStartY, size: 8, font: helveticaFont, color: rgb(0.3, 0.3, 0.3) });
    }

    page.drawText("Falla reportada:", { x: positions.itemStartX, y: positions.descriptionY, size: 10, font: helveticaBold });
    page.drawText(repair.description, { x: positions.itemStartX, y: positions.descriptionY - 15, size: 10, font: helveticaFont });

    const priceText = formatCurrencyForPdf(repair.estimatedPrice);
    page.drawText("Presupuesto Estimado:", { x: positions.priceStartX - 110, y: positions.priceFinalY, size: 12, font: helveticaBold });
    page.drawText(priceText, { x: positions.priceStartX, y: positions.priceFinalY, size: 12, font: helveticaBold });
};


// --- Generador de PDF para Entregas ---
export const generateDeliveryReceiptPdf = async (repairData: any) => {
  if (!repairData) {
    toast.error("Error", { description: "No hay datos para generar el comprobante de entrega." });
    return;
  }

  toast.loading("Generando Comprobante de Entrega...", {
    description: "Espere mientras se prepara el PDF.",
  });

  try {
    const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
    let pdfDoc: PDFDocument;
    
    const pdfTemplatePath = "templates/entrega.pdf";
    const pdfTemplateExists = await checkPdfExists(pdfTemplatePath);

    if (pdfTemplateExists) {
      try {
        const pdfTemplateUrl = await getDownloadURL(storageRef(storage, pdfTemplatePath));
        const pdfArrayBuffer = await fetch(pdfTemplateUrl).then(res => res.arrayBuffer());
        pdfDoc = await PDFDocument.load(pdfArrayBuffer);
      } catch (e) {
        pdfDoc = await PDFDocument.create();
        pdfDoc.addPage([595, 842]);
        toast.info("Plantilla de entrega no encontrada", { description: "Se ha creado un comprobante básico." });
      }
    } else {
      pdfDoc = await PDFDocument.create();
      pdfDoc.addPage([595, 842]);
    }

    const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const firstPage = pdfDoc.getPages()[0];
    
    drawDeliveryPdfContent(firstPage, repairData, {name: repairData.customerName, dni: repairData.customerDni, phone: repairData.customerPhone }, { helveticaFont, helveticaBold });

    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([pdfBytes], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Entrega-${repairData.receiptNumber}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success("PDF de Entrega generado", { description: "El comprobante se ha descargado." });
  } catch (error) {
    console.error("Error al generar el PDF de entrega:", error);
    toast.error("Error de PDF", { description: `No se pudo generar el comprobante: ${(error as Error).message}` });
  }
};

const drawDeliveryPdfContent = (page, repair, customer, fonts) => {
    const { helveticaFont, helveticaBold } = fonts;

    const positions = {
        numeroRecibo: { x: 430, y: 697 },
        fecha: { x: 430, y: 710 },
        nombreCliente: { x: 110, y: 657 },
        dniCliente: { x: 110, y: 643 },
        celCliente: { x: 110, y: 630 },
        itemStartY: 548,
        itemStartX: 65,
        imeiStartX: 320,
        priceStartX: 455,
        descriptionY: 500,
        priceFinalY: 290
    };

    const formattedDate = new Date(repair.deliveredAt || repair.entryDate).toLocaleDateString();

    page.drawText(String(repair.receiptNumber), { ...positions.numeroRecibo, size: 10, font: helveticaFont });
    page.drawText(formattedDate, { ...positions.fecha, size: 10, font: helveticaFont });
    page.drawText(String(customer.name), { ...positions.nombreCliente, size: 10, font: helveticaFont });
    page.drawText(String(customer.dni), { ...positions.dniCliente, size: 10, font: helveticaFont });
    page.drawText(String(customer.phone), { ...positions.celCliente, size: 10, font: helveticaFont });

    page.drawText(repair.productName, { x: positions.itemStartX, y: positions.itemStartY, size: 12, font: helveticaFont });

    let identifiers = [];
    if (repair.unlockPin) identifiers.push(`PIN: ${repair.unlockPin}`);
    if (repair.imei) identifiers.push(`IMEI: ${repair.imei}`);
    
    if (identifiers.length > 0) {
        page.drawText(identifiers.join('  /  '), { x: positions.imeiStartX, y: positions.itemStartY, size: 8, font: helveticaFont, color: rgb(0.3, 0.3, 0.3) });
    }

    page.drawText("Trabajo realizado:", { x: positions.itemStartX, y: positions.descriptionY, size: 10, font: helveticaBold });
    page.drawText(repair.technicianNotes || 'Sin notas adicionales.', { x: positions.itemStartX, y: positions.descriptionY - 15, size: 10, font: helveticaFont });

    const priceText = formatCurrencyForPdf(repair.finalPrice || repair.estimatedPrice);
    page.drawText("Total:", { x: positions.priceStartX - 40, y: positions.priceFinalY, size: 12, font: helveticaBold });
    page.drawText(priceText, { x: positions.priceStartX, y: positions.priceFinalY, size: 12, font: helveticaBold });
};