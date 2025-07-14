import { getDownloadURL, ref as storageRef } from "firebase/storage";
import { storage } from "@/lib/firebase";
import { toast } from "sonner";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

// Función para verificar si la plantilla del PDF existe en Firebase Storage
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

// Función principal para generar y descargar el comprobante de venta o reserva
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

    // --- ✅ CAMBIO CLAVE AQUÍ ---
    // Ahora busca el archivo dentro de la carpeta "templates"
    const pdfTemplatePath = "templates/factura.pdf";
    const pdfTemplateExists = await checkPdfExists(pdfTemplatePath);
    // --- FIN DEL CAMBIO ---

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
      // Crea un PDF desde cero si la plantilla no existe
      pdfDoc = await PDFDocument.create();
      pdfDoc.addPage([595, 842]);
    }

    const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const firstPage = pdfDoc.getPages()[0];
    
    // Dibuja el contenido en el PDF
    drawPdfContent(firstPage, completedSale, { helveticaFont, helveticaBold });

    // Si hay una segunda página en la plantilla, dibuja el contenido también
    if (pdfDoc.getPageCount() > 1) {
        const secondPage = pdfDoc.getPages()[1];
        drawPdfContent(secondPage, completedSale, { helveticaFont, helveticaBold });
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
    toast.error("Error de PDF", { description: `No se pudo generar el comprobante: ${error.message}` });
  }
};

// Función auxiliar para dibujar el contenido en una página del PDF (sin cambios)
const drawPdfContent = (page, saleData, fonts) => {
    const { helveticaFont, helveticaBold } = fonts;

    const positions = {
        numeroRecibo: { x: 430, y: 697 },
        fecha: { x: 430, y: 710 },
        nombreCliente: { x: 110, y: 657 },
        dniCliente: { x: 110, y: 643 },
        celCliente: { x: 110, y: 630 },
        productoNombre: { x: 65, y: 548 },
        productoImei: { x: 320, y: 535 },
        precioVenta: { x: 455, y: 548 },
        precioFinal: { x: 455, y: 290 },
        subtotal: { x: 400, y: 320 },
        parteDePago: { x: 400, y: 305 },
    };

    const formattedDate = new Date(saleData.date).toLocaleDateString();

    page.drawText(String(saleData.receiptNumber), { x: positions.numeroRecibo.x, y: positions.numeroRecibo.y, size: 10, font: helveticaFont });
    page.drawText(formattedDate, { x: positions.fecha.x, y: positions.fecha.y, size: 10, font: helveticaFont });
    page.drawText(String(saleData.customerName), { x: positions.nombreCliente.x, y: positions.nombreCliente.y, size: 10, font: helveticaFont });
    page.drawText(String(saleData.customerDni), { x: positions.dniCliente.x, y: positions.dniCliente.y, size: 10, font: helveticaFont });
    page.drawText(String(saleData.customerPhone), { x: positions.celCliente.x, y: positions.celCliente.y, size: 10, font: helveticaFont });
    page.drawText(String(saleData.productName || "N/A"), { x: positions.productoNombre.x, y: positions.productoNombre.y, size: 12, font: helveticaFont });
    page.drawText(String(saleData.productImei || "N/A"), { x: positions.productoImei.x, y: positions.productoImei.y, size: 10, font: helveticaFont });
    
    const salePrice = saleData.hasOwnProperty("downPayment") ? saleData.productPrice : saleData.salePrice;
    page.drawText(`$${Number(salePrice).toFixed(2)}`, { x: positions.precioVenta.x, y: positions.precioVenta.y, size: 12, font: helveticaFont });

    // Dibuja el total final y el desglose si hay parte de pago
    const finalAmount = saleData.finalAmount !== undefined ? saleData.finalAmount : salePrice;
    page.drawText(`$${Number(finalAmount).toFixed(2)}`, { x: positions.precioFinal.x, y: positions.precioFinal.y, size: 12, font: helveticaBold });

    if (saleData.tradeInValue && saleData.tradeInValue > 0) {
        page.drawText(`Subtotal: $${Number(saleData.salePrice).toFixed(2)}`, { ...positions.subtotal, size: 10, font: helveticaFont });
        page.drawText(`Parte de Pago: -$${Number(saleData.tradeInValue).toFixed(2)}`, { ...positions.parteDePago, size: 10, font: helveticaFont });
    }
}