"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Camera, X, Check, RotateCcw } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"

interface MobileScannerProps {
  onScan: (data: string) => void
  onClose: () => void
}

export default function MobileScanner({ onScan, onClose }: MobileScannerProps) {
  const { toast } = useToast()
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isScanning, setIsScanning] = useState(false)
  const [hasPermission, setHasPermission] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")

  useEffect(() => {
    let stream: MediaStream | null = null

    const startCamera = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        })

        if (videoRef.current) {
          videoRef.current.srcObject = stream
          setHasPermission(true)
          setIsScanning(true)
        }
      } catch (error) {
        console.error("Error accessing camera:", error)
        setErrorMessage("No se pudo acceder a la cámara. Por favor, verifique los permisos.")
        setHasPermission(false)
      }
    }

    startCamera()

    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop())
      }
    }
  }, [])

  const captureImage = () => {
    if (!videoRef.current || !canvasRef.current) return

    const video = videoRef.current
    const canvas = canvasRef.current
    const context = canvas.getContext("2d")

    if (!context) return

    // Establecer dimensiones del canvas al tamaño del video
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight

    // Dibujar el frame actual del video en el canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height)

    // En una implementación real, aquí se procesaría la imagen para detectar códigos de barras o QR
    // Para este ejemplo, simulamos una detección exitosa después de un breve retraso
    setIsScanning(false)

    setTimeout(() => {
      // Simular un código de barras detectado (por ejemplo, un DNI)
      const simulatedBarcode = Math.floor(10000000 + Math.random() * 90000000).toString()

      toast({
        title: "Código detectado",
        description: `Se ha detectado el código: ${simulatedBarcode}`,
      })

      onScan(simulatedBarcode)
    }, 1500)
  }

  const resetScanner = () => {
    setIsScanning(true)
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Escanear Código</CardTitle>
        <CardDescription>Apunte la cámara al código de barras o QR</CardDescription>
      </CardHeader>
      <CardContent>
        {hasPermission ? (
          <div className="relative">
            <video ref={videoRef} autoPlay playsInline className="w-full h-64 object-cover rounded-md" />
            <canvas ref={canvasRef} className="hidden" />

            {isScanning && (
              <div className="absolute inset-0 border-2 border-dashed border-primary rounded-md flex items-center justify-center">
                <div className="w-48 h-1 bg-primary opacity-50"></div>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-muted h-64 rounded-md flex items-center justify-center">
            <p className="text-muted-foreground text-center px-4">
              {errorMessage || "Esperando acceso a la cámara..."}
            </p>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button variant="outline" onClick={onClose}>
          <X className="mr-2 h-4 w-4" />
          Cancelar
        </Button>

        {isScanning ? (
          <Button onClick={captureImage} disabled={!hasPermission}>
            <Camera className="mr-2 h-4 w-4" />
            Capturar
          </Button>
        ) : (
          <div className="space-x-2">
            <Button variant="outline" onClick={resetScanner}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Reintentar
            </Button>
            <Button onClick={() => onScan("12345678")}>
              <Check className="mr-2 h-4 w-4" />
              Confirmar
            </Button>
          </div>
        )}
      </CardFooter>
    </Card>
  )
}
