"use client"

import { useEffect, useRef } from "react"
import { toast } from "sonner"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { X } from "lucide-react"

// --- DECLARACIÓN DE TIPOS PARA LA LIBRERÍA EXTERNA ---
// Esto ayuda a TypeScript a entender la librería que cargaremos dinámicamente.
declare global {
  interface Window {
    Html5QrcodeScanner: any;
    Html5Qrcode: any;
  }
}

interface MobileScannerProps {
  onScan: (data: string) => void
  onClose: () => void
}

export default function MobileScanner({ onScan, onClose }: MobileScannerProps) {
  const scannerRef = useRef<any>(null);

  useEffect(() => {
    // Cargar el script de la librería de escaneo de forma dinámica
    const script = document.createElement("script")
    script.src = "https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js"
    script.async = true
    script.onload = () => {
      // Una vez cargado el script, inicializamos el escáner
      
      const onScanSuccess = (decodedText: string, decodedResult: any) => {
        // Cuando se escanea un código correctamente
        console.log(`Código detectado: ${decodedText}`, decodedResult);
        toast.success("Código detectado", {
          description: `Valor: ${decodedText}`
        });

        // Detenemos el escáner para evitar múltiples detecciones
        if (scannerRef.current) {
          scannerRef.current.clear().catch((error: any) => {
            console.error("Fallo al detener el escáner.", error);
          });
        }
        
        // Enviamos el dato escaneado al componente padre
        onScan(decodedText);
      };

      const onScanFailure = (error: any) => {
        // Ignoramos los errores de "QR code not found" que son constantes
      };
      
      // Creamos la instancia del escáner
      const html5QrcodeScanner = new window.Html5QrcodeScanner(
        "reader", // ID del div donde se renderizará
        {
          fps: 10, // Frames por segundo para el escaneo
          qrbox: { width: 250, height: 250 }, // Tamaño del cuadro de escaneo
          supportedScanTypes: [0], // 0 para escanear con la cámara
          rememberLastUsedCamera: true, // Recordar la última cámara usada
        },
        false // `verbose` en falso para no mostrar logs en consola
      );

      // Renderizamos el escáner
      html5QrcodeScanner.render(onScanSuccess, onScanFailure);
      scannerRef.current = html5QrcodeScanner;
    };

    document.body.appendChild(script);

    // --- FUNCIÓN DE LIMPIEZA ---
    // Se ejecuta cuando el componente se desmonta
    return () => {
      if (scannerRef.current) {
        // Nos aseguramos de que el escáner y la cámara se detengan
        scannerRef.current.clear().catch((error: any) => {
          console.error("Fallo al limpiar el escáner al desmontar.", error);
        });
      }
      document.body.removeChild(script);
    };
  }, [onScan]);

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Escanear Código</CardTitle>
        <CardDescription>Apunta la cámara al código de barras o QR del producto.</CardDescription>
      </CardHeader>
      <CardContent>
        {/* Este div es donde la librería renderizará la vista de la cámara */}
        <div id="reader" className="w-full"></div>
      </CardContent>
      <CardFooter>
        <Button variant="outline" className="w-full" onClick={onClose}>
          <X className="mr-2 h-4 w-4" />
          Cancelar
        </Button>
      </CardFooter>
    </Card>
  );
}