"use client";

// Este componente ahora solo muestra una pantalla de carga.
// La lógica de autenticación real ha sido centralizada en el DashboardLayout para evitar errores.
export default function LoadingPage() {
  return (
    <div className="flex h-screen items-center justify-center bg-background">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      <p className="ml-4 text-muted-foreground">Cargando...</p>
    </div>
  );
}