import { getDownloadURL, ref as storageRef } from "firebase/storage";
import { storage } from "@/lib/firebase";
import { toast } from "sonner";
import { PDFDocument, StandardFonts, rgb, PDFFont } from "pdf-lib";

// --- INTERFACES PARA TIPADO SEGURO ---
// Ayudan a prevenir errores si faltan datos.
interface SaleItem {
  productName: string;
  quantity: number;
  price: number;
  currency?: 'USD' | 'ARS';
  imei?: string;
  barcode?: string;
}

interface TradeIn {
  name: string;
  price: number;
  imei?: string;
  serialNumber?: string;
}

interface Sale {
  receiptNumber: string;
  date: string;
  customerName: string;
  customerDni: string;
  customerPhone: string;
  items: SaleItem[];
  totalAmount: number;
  usdRate?: number;
  tradeIn?: TradeIn;
  pointsEarned?: number;
  pointsAccumulated?: number;
}

interface Repair {
    receiptNumber: string;
    entryDate: string;
    productName: string;
    imei?: string;
    unlockPin?: string;
    description: string;
    estimatedPrice: number;
    finalPrice?: number;
    technicianNotes?: string;
    deliveredAt?: string;
    customerName?: string;
    customerDni?: string;
    customerPhone?: string;
}

interface Reserve {
    id: string;
    receiptNumber: string;
    date: string;
    expirationDate: string;
    customerId: string;
    customerName: string;
    customerDni: string;
    customerPhone: string;
    productName: string;
    productId: string;
    quantity: number;
    productPrice: number;
    downPayment: number;
    remainingAmount: number;
    status: 'reserved' | 'completed' | 'cancelled';
}

interface Customer {
    name: string;
    dni: string;
    phone: string;
}

interface Fonts {
    helveticaFont: PDFFont;
    helveticaBold: PDFFont;
}


// --- FUNCIONES DE FORMATO ---
const formatCurrencyForPdf = (amount: number | undefined | null): string => {
  const numAmount = Number(amount || 0);
  const roundedAmount = Math.round(numAmount);
  return `$${roundedAmount.toLocaleString('es-AR')}`;
};

const formatDateForPdf = (dateString: string | undefined | null): string => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    // Sumar un día a la fecha para corregir el desfase de zona horaria al crearla desde un input type="date"
    date.setDate(date.getDate() + 1);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
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
export const generateSaleReceiptPdf = async (completedSale: Sale) => {
  if (!completedSale) {
    toast.error("Error", { description: "No hay datos de la venta para generar el PDF." });
    return;
  }

  const toastId = toast.loading("Generando PDF...", {
    description: "Espere mientras se prepara el comprobante.",
  });

  try {
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
    link.download = `Recibo-${completedSale.receiptNumber || 'venta'}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success("PDF generado", { id: toastId, description: "El comprobante se ha descargado." });
  } catch (error) {
    console.error("Error al generar el PDF:", error);
    toast.error("Error de PDF", { id: toastId, description: `No se pudo generar el comprobante: ${(error as Error).message}` });
  }
};

const drawSalePdfContent = (page: any, saleData: Sale, fonts: Fonts) => {
    const { helveticaFont, helveticaBold } = fonts;
    const positions = {
        numeroRecibo: { x: 430, y: 697 },
        fecha: { x: 430, y: 710 },
        nombreCliente: { x: 110, y: 657 },
        dniCliente: { x: 110, y: 643 },
        celCliente: { x: 110, y: 630 },
        itemStartY: 548,
        itemStartX: 65,
        imeiStartX: 280,
        priceStartX: 455,
        subtotal: { x: 400, y: 300 },
        parteDePago: { x: 400, y: 320 },
        precioFinal: { x: 455, y: 290 },
    };

    const formattedDate = saleData.date ? new Date(saleData.date).toLocaleDateString() : 'N/A';

    page.drawText(String(saleData.receiptNumber || 'N/A'), { ...positions.numeroRecibo, size: 10, font: helveticaFont });
    page.drawText(formattedDate, { ...positions.fecha, size: 10, font: helveticaFont });
    page.drawText(String(saleData.customerName || ''), { ...positions.nombreCliente, size: 10, font: helveticaFont });
    page.drawText(String(saleData.customerDni || ''), { ...positions.dniCliente, size: 10, font: helveticaFont });
    page.drawText(String(saleData.customerPhone || ''), { ...positions.celCliente, size: 10, font: helveticaFont });

    let currentY = positions.itemStartY;
    const itemLineHeight = 15;

    (saleData.items || []).forEach(item => {
        const itemPrice = (item.price || 0) * (item.currency === 'USD' ? (saleData.usdRate || 1) : 1);
        const totalPrice = itemPrice * (item.quantity || 1);
        
        const displayName = item.imei ? item.productName : `${item.quantity || 1}x ${item.productName}`;
        
        page.drawText(displayName || 'Producto sin nombre', { x: positions.itemStartX, y: currentY, size: 10, font: helveticaFont });
        
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

    const pointsY = saleData.tradeIn && saleData.tradeIn.price > 0 ? positions.parteDePago.y - 15 : positions.subtotal.y + 20;
    page.drawText(`Puntos sumados con esta compra: ${saleData.pointsEarned || 0}`, {
        x: positions.itemStartX,
        y: pointsY,
        size: 10,
        font: helveticaFont
    });
    page.drawText(`Puntos acumulados: ${saleData.pointsAccumulated || 0}`, {
        x: positions.itemStartX,
        y: pointsY - 12,
        size: 10,
        font: helveticaFont
    });

    if (saleData.tradeIn && saleData.tradeIn.price > 0) {
        const cartTotal = (saleData.items || []).reduce((sum, item) => {
            const priceInArs = (item.price || 0) * (item.currency === 'USD' ? (saleData.usdRate || 1) : 1);
            return sum + (priceInArs * (item.quantity || 1));
        }, 0);
        const tradeInValue = (saleData.tradeIn.price || 0) * (saleData.usdRate || 1);

        page.drawText(`Subtotal: ${formatCurrencyForPdf(cartTotal)}`, { ...positions.subtotal, size: 10, font: helveticaFont });
        
        const tradeInName = `Parte de Pago: ${saleData.tradeIn.name || ''}`;
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

    page.drawText(`${formatCurrencyForPdf(finalAmount)}`, { ...positions.precioFinal, size: 12, font: helveticaBold });
}


// --- Generador de PDF para Reparaciones (Presupuesto) ---
export const generateRepairReceiptPdf = async (repairData: Repair, customerData: Customer) => {
  if (!repairData || !customerData) {
    toast.error("Error", { description: "No hay datos para generar el PDF de reparación." });
    return;
  }

  const toastId = toast.loading("Generando presupuesto PDF...", {
    description: "Espere mientras se prepara el comprobante.",
  });

  try {
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
    link.download = `Presupuesto-${repairData.receiptNumber || 'reparacion'}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success("PDF generado", { id: toastId, description: "El presupuesto se ha descargado." });
  } catch (error) {
    console.error("Error al generar el PDF de reparación:", error);
    toast.error("Error de PDF", { id: toastId, description: `No se pudo generar el comprobante: ${(error as Error).message}` });
  }
};

const drawRepairPdfContent = (page: any, repair: Repair, customer: Customer, fonts: Fonts) => {
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

    const formattedDate = repair.entryDate ? new Date(repair.entryDate).toLocaleDateString() : 'N/A';

    page.drawText(String(repair.receiptNumber || 'N/A'), { ...positions.numeroRecibo, size: 10, font: helveticaFont });
    page.drawText(formattedDate, { ...positions.fecha, size: 10, font: helveticaFont });
    page.drawText(String(customer.name || ''), { ...positions.nombreCliente, size: 10, font: helveticaFont });
    page.drawText(String(customer.dni || ''), { ...positions.dniCliente, size: 10, font: helveticaFont });
    page.drawText(String(customer.phone || ''), { ...positions.celCliente, size: 10, font: helveticaFont });

    page.drawText(repair.productName || 'Equipo no especificado', { x: positions.itemStartX, y: positions.itemStartY, size: 12, font: helveticaFont });

    let identifiers = [];
    if (repair.unlockPin) identifiers.push(`PIN: ${repair.unlockPin}`);
    if (repair.imei) identifiers.push(`IMEI: ${repair.imei}`);
    
    if (identifiers.length > 0) {
        page.drawText(identifiers.join('  /  '), { x: positions.imeiStartX, y: positions.itemStartY, size: 8, font: helveticaFont, color: rgb(0.3, 0.3, 0.3) });
    }

    page.drawText("Falla reportada:", { x: positions.itemStartX, y: positions.descriptionY, size: 10, font: helveticaBold });
    page.drawText(repair.description || 'Sin descripción.', { x: positions.itemStartX, y: positions.descriptionY - 15, size: 10, font: helveticaFont });

    const priceText = formatCurrencyForPdf(repair.estimatedPrice);
    page.drawText("Presupuesto Estimado:", { x: positions.priceStartX - 110, y: positions.priceFinalY, size: 12, font: helveticaBold });
    page.drawText(priceText, { x: positions.priceStartX, y: positions.priceFinalY, size: 12, font: helveticaBold });
};


// --- Generador de PDF para Entregas ---
export const generateDeliveryReceiptPdf = async (repairData: Repair) => {
  if (!repairData) {
    toast.error("Error", { description: "No hay datos para generar el comprobante de entrega." });
    return;
  }

  const toastId = toast.loading("Generando Comprobante de Entrega...", {
    description: "Espere mientras se prepara el PDF.",
  });

  try {
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
    
    drawDeliveryPdfContent(firstPage, repairData, { helveticaFont, helveticaBold });

    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([pdfBytes], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Entrega-${repairData.receiptNumber || 'reparacion'}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success("PDF de Entrega generado", { id: toastId, description: "El comprobante se ha descargado." });
  } catch (error) {
    console.error("Error al generar el PDF de entrega:", error);
    toast.error("Error de PDF", { id: toastId, description: `No se pudo generar el comprobante: ${(error as Error).message}` });
  }
};

const drawDeliveryPdfContent = (page: any, repair: Repair, fonts: Fonts) => {
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

    page.drawText(String(repair.receiptNumber || 'N/A'), { ...positions.numeroRecibo, size: 10, font: helveticaFont });
    page.drawText(formattedDate, { ...positions.fecha, size: 10, font: helveticaFont });
    page.drawText(String(repair.customerName || ''), { ...positions.nombreCliente, size: 10, font: helveticaFont });
    page.drawText(String(repair.customerDni || ''), { ...positions.dniCliente, size: 10, font: helveticaFont });
    page.drawText(String(repair.customerPhone || ''), { ...positions.celCliente, size: 10, font: helveticaFont });

    page.drawText(repair.productName || 'Equipo no especificado', { x: positions.itemStartX, y: positions.itemStartY, size: 12, font: helveticaFont });

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

// --- Generador de PDF para Reservas (Señas) ---
export const generateReserveReceiptPdf = async (reserveData: Reserve) => {
  if (!reserveData) {
    toast.error("Error", { description: "No hay datos de la reserva para generar el PDF." });
    return;
  }

  const toastId = toast.loading("Generando PDF de seña...", {
    description: "Espere mientras se prepara el comprobante.",
  });

  try {
    let pdfDoc: PDFDocument;
    const pdfTemplatePath = "templates/reserve-template.pdf";
    const pdfTemplateExists = await checkPdfExists(pdfTemplatePath);

    if (pdfTemplateExists) {
      try {
        const pdfTemplateUrl = await getDownloadURL(storageRef(storage, pdfTemplatePath));
        const pdfArrayBuffer = await fetch(pdfTemplateUrl).then(res => res.arrayBuffer());
        pdfDoc = await PDFDocument.load(pdfArrayBuffer);
      } catch (e) {
        console.error("Error al cargar la plantilla de reserva, creando uno desde cero.", e);
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
    
    drawReservePdfContent(firstPage, reserveData, { helveticaFont, helveticaBold });

    if (pdfDoc.getPageCount() > 1) {
        const secondPage = pdfDoc.getPages()[1];
        drawReservePdfContent(secondPage, reserveData, { helveticaFont, helveticaBold });
    }

    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([pdfBytes], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Reserva-${reserveData.receiptNumber || 'reserva'}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success("PDF de reserva generado", { id: toastId, description: "El comprobante se ha descargado." });
  } catch (error) {
    console.error("Error al generar el PDF de reserva:", error);
    toast.error("Error de PDF", { id: toastId, description: `No se pudo generar el comprobante: ${(error as Error).message}` });
  }
};

const drawReservePdfContent = (page: any, reserve: Reserve, fonts: Fonts) => {
    const { helveticaFont, helveticaBold } = fonts;
    const positions = {
        numeroRecibo: { x: 430, y: 697 },
        fecha: { x: 430, y: 710 },
        nombreCliente: { x: 110, y: 657 },
        dniCliente: { x: 110, y: 643 },
        celCliente: { x: 110, y: 630 },
        itemStartY: 548,
        itemStartX: 65,
        priceStartX: 455,
        total: { x: 400, y: 320 },
        entrega: { x: 400, y: 300 },
        saldo: { x: 455, y: 290 },
        fechaRetiro1: { x: 65, y: 450 },
        fechaRetiro2: { x: 65, y: 200 }
    };

    const formattedDate = reserve.date ? new Date(reserve.date).toLocaleDateString() : 'N/A';
    const formattedExpirationDate = formatDateForPdf(reserve.expirationDate);

    page.drawText(String(reserve.receiptNumber || 'N/A'), { ...positions.numeroRecibo, size: 10, font: helveticaFont });
    page.drawText(formattedDate, { ...positions.fecha, size: 10, font: helveticaFont });
    page.drawText(String(reserve.customerName || ''), { ...positions.nombreCliente, size: 10, font: helveticaFont });
    page.drawText(String(reserve.customerDni || ''), { ...positions.dniCliente, size: 10, font: helveticaFont });
    page.drawText(String(reserve.customerPhone || ''), { ...positions.celCliente, size: 10, font: helveticaFont });

    page.drawText(reserve.productName || 'Producto sin nombre', { x: positions.itemStartX, y: positions.itemStartY, size: 10, font: helveticaFont });
    page.drawText(formatCurrencyForPdf(reserve.productPrice), { x: positions.priceStartX, y: positions.itemStartY, size: 10, font: helveticaFont });
    
    page.drawText(`Total: ${formatCurrencyForPdf(reserve.productPrice)}`, { ...positions.total, size: 10, font: helveticaFont });
    page.drawText(`Entrega: ${formatCurrencyForPdf(reserve.downPayment)}`, { ...positions.entrega, size: 10, font: helveticaFont });
    page.drawText(`${formatCurrencyForPdf(reserve.remainingAmount)}`, { ...positions.saldo, size: 12, font: helveticaBold });

    // Imprimir fecha de retiro
    page.drawText(`Fecha límite para retirar el producto: ${formattedExpirationDate}`, { ...positions.fechaRetiro1, size: 12, font: helveticaFont });
    page.drawText(`Fecha límite para retirar el producto: ${formattedExpirationDate}`, { ...positions.fechaRetiro2, size: 12, font: helveticaFont });
};