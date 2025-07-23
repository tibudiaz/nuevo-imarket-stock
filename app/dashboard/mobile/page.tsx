"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useMobile } from "@/hooks/use-mobile";
import DashboardLayout from "@/components/dashboard-layout";
import { getAuth } from "firebase/auth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Barcode, Package, PlusCircle, Wrench, Smartphone } from "lucide-react";
import MobileScanner from "@/components/mobile-scanner";

export default function MobilePage() {
  const router = useRouter();
  const isMobile = useMobile();
  const [user, setUser] = useState<{ username: string; role: string } | null>(
    null,
  );
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [deviceInfo, setDeviceInfo] = useState({
    userAgent: "",
    platform: "",
    screenWidth: 0,
    screenHeight: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const auth = getAuth();

    if (auth.currentUser) {
      const role = auth.currentUser.email?.endsWith("@admin.com")
        ? "admin"
        : "moderator";
      const currentUser = {
        username: auth.currentUser.email || "",
        role,
      };
      setUser(currentUser);
      localStorage.setItem("user", JSON.stringify(currentUser));
    } else {
      const storedUser = localStorage.getItem("user");
      if (!storedUser) {
        router.push("/");
        return;
      }

      try {
        setUser(JSON.parse(storedUser));
      } catch (e) {
        localStorage.removeItem("user");
        router.push("/");
      }
    }

    if (typeof window !== "undefined") {
      setDeviceInfo({
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        screenWidth: window.screen.width,
        screenHeight: window.screen.height,
      });
    }
    setIsLoading(false);
  }, [router]);

  const handleScan = (data: string) => {
    setIsScannerOpen(false); // Cierra el scanner inmediatamente
    toast.success("Código escaneado", {
      description: `Buscando producto: ${data}`,
    });

    // Redirige al inventario y busca el producto por su código
    router.push(`/dashboard/inventory?category=&search=${data}`);
  };

  const handleScannerClose = () => {
    setIsScannerOpen(false);
  };

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  if (isScannerOpen) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
        <MobileScanner onScan={handleScan} onClose={handleScannerClose} />
      </div>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-4 space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Panel Rápido</h1>
          <p className="text-muted-foreground">
            Acciones rápidas para {user?.username}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4">
          <Card
            className="cursor-pointer bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            onClick={() => setIsScannerOpen(true)}
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Barcode className="h-6 w-6" />
                Escanear Producto
              </CardTitle>
              <CardDescription className="text-primary-foreground/80">
                Usa la cámara para buscar un producto o agregarlo a una venta.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card
            className="cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => router.push("/dashboard/inventory")}
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-6 w-6" />
                Ver Inventario
              </CardTitle>
              <CardDescription>
                Consulta el stock de todos los productos.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card
            className="cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => router.push("/dashboard/sales")}
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PlusCircle className="h-6 w-6" />
                Nueva Venta
              </CardTitle>
              <CardDescription>
                Registra una nueva venta de productos.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card
            className="cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => router.push("/dashboard/repairs")}
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wrench className="h-6 w-6" />
                Nueva Reparación
              </CardTitle>
              <CardDescription>
                Registra el ingreso de un nuevo equipo para reparar.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Smartphone className="h-5 w-5" />
              Información del Dispositivo
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground break-words">
            <p>
              <strong>Plataforma:</strong> {deviceInfo.platform}
            </p>
            <p>
              <strong>Resolución:</strong> {deviceInfo.screenWidth}x
              {deviceInfo.screenHeight}
            </p>
            <p>
              <strong>User Agent:</strong> {deviceInfo.userAgent}
            </p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
