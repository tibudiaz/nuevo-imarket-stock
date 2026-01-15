"use client"

import { useState, useEffect, useCallback } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Loader2, Search, Copy, Smartphone } from "lucide-react"
import { toast } from "sonner"
import { ref, get, query, orderByChild, equalTo, onValue, push, set, remove, update } from "firebase/database"
import { database, storage } from "@/lib/firebase"
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage"
import type { RepairPhoto } from "@/types/repair"
import { generateRepairReceiptPdf } from "@/lib/pdf-generator"
import QRCode from "qrcode"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { useAuth } from "@/hooks/use-auth"
import { getAppBaseUrl } from "@/lib/base-url"

interface AddRepairFormProps {
  isOpen: boolean
  onClose: () => void
  onAddRepair: (
    repairData: any,
    customerData: any,
    options?: { photos?: RepairPhoto[]; sessionId?: string }
  ) => Promise<RepairRecord>
}

interface RepairRecord {
  id: string;
  receiptNumber: string;
  customerId: string;
  customerName: string;
  customerDni: string;
  customerPhone: string;
  customerEmail?: string;
  productName: string;
  imei?: string;
  description: string;
  estimatedPrice: number;
  entryDate: string;
  createdAt: number;
  status: 'pending' | 'in_progress' | 'completed' | 'delivered' | 'cancelled';
  store?: 'local1' | 'local2';
  signature?: {
    url: string;
    path?: string;
    signedAt?: string;
    sessionId?: string;
    signerName?: string;
    signerDni?: string;
  } | null;
}

const initialCustomerState = { dni: '', name: '', phone: '', email: '' };
const initialRepairState = { productName: '', imei: '', description: '', estimatedPrice: 0 };

const generateUploadSessionId = () => {
  if (
    typeof globalThis !== "undefined" &&
    typeof globalThis.crypto !== "undefined" &&
    typeof globalThis.crypto.randomUUID === "function"
  ) {
    return globalThis.crypto.randomUUID();
  }

  return `session-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const generateSignatureSessionId = () => {
  if (
    typeof globalThis !== "undefined" &&
    typeof globalThis.crypto !== "undefined" &&
    typeof globalThis.crypto.randomUUID === "function"
  ) {
    return globalThis.crypto.randomUUID();
  }

  return `session-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

export default function AddRepairForm({ isOpen, onClose, onAddRepair }: AddRepairFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [customerData, setCustomerData] = useState(initialCustomerState);
  const [repairData, setRepairData] = useState(initialRepairState);
  const [completedRepair, setCompletedRepair] = useState<RepairRecord | null>(null);
  const [uploadSessionId, setUploadSessionId] = useState<string | null>(null);
  const [sessionPhotos, setSessionPhotos] = useState<RepairPhoto[]>([]);
  const [isUploadingPhotos, setIsUploadingPhotos] = useState(false);
  const [origin, setOrigin] = useState<string>("");
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [isSignatureDialogOpen, setIsSignatureDialogOpen] = useState(false);
  const [signatureSessionId, setSignatureSessionId] = useState<string | null>(null);
  const [signatureQrDataUrl, setSignatureQrDataUrl] = useState<string>("");
  const [signatureLink, setSignatureLink] = useState<string>("");
  const [signatureStatus, setSignatureStatus] = useState<string>("pending");
  const [signatureData, setSignatureData] = useState<RepairRecord["signature"]>(null);
  const [signatureSessionRefPath, setSignatureSessionRefPath] = useState<string>("");
  const [signatureSessionError, setSignatureSessionError] = useState<string | null>(null);
  const { user } = useAuth();

  // Resetea el estado del formulario cuando el modal se abre.
  useEffect(() => {
    if (isOpen) {
      setCustomerData(initialCustomerState);
      setRepairData(initialRepairState);
      setIsLoading(false);
      setIsSearching(false);
      setSessionPhotos([]);
      setCompletedRepair(null);
      setSignatureSessionId(null);
      setSignatureQrDataUrl("");
      setSignatureLink("");
      setSignatureStatus("pending");
      setSignatureData(null);
      setSignatureSessionRefPath("");
      setSignatureSessionError(null);
      setIsSignatureDialogOpen(false);
      const newSession = generateUploadSessionId();
      setUploadSessionId(newSession);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      if (uploadSessionId) {
        const sessionRef = ref(database, `repairUploadSessions/${uploadSessionId}`);
        remove(sessionRef).catch(() => null);
      }
      if (signatureSessionRefPath) {
        const sessionRef = ref(database, signatureSessionRefPath);
        update(sessionRef, {
          status: "closed",
          closedAt: new Date().toISOString(),
        }).catch(() => null);
      }
      setUploadSessionId(null);
      setQrDataUrl("");
      setSignatureSessionRefPath("");
      setSignatureSessionId(null);
    }
  }, [isOpen, signatureSessionRefPath, uploadSessionId]);

  useEffect(() => {
    const resolvedOrigin = getAppBaseUrl()
    setOrigin(resolvedOrigin)
  }, [])

  useEffect(() => {
    if (!isOpen || !uploadSessionId) return;

    const sessionRef = ref(database, `repairUploadSessions/${uploadSessionId}`);
    set(sessionRef, {
      createdAt: new Date().toISOString(),
      status: "pending",
      createdBy: user?.username ?? null,
      pendingUpload: true,
    }).catch((error) => {
      console.error("Error al crear la sesión de carga:", error);
    });

    const photosRef = ref(database, `repairUploadSessions/${uploadSessionId}/photos`);
    const unsubscribe = onValue(photosRef, (snapshot) => {
      if (!snapshot.exists()) {
        setSessionPhotos([]);
        return;
      }
      const photos: RepairPhoto[] = Object.entries(snapshot.val()).map(([photoId, value]) => ({
        id: photoId,
        ...(value as Omit<RepairPhoto, "id">),
      }));
      setSessionPhotos(photos.sort((a, b) => new Date(a.uploadedAt).getTime() - new Date(b.uploadedAt).getTime()));
    });

    return () => unsubscribe();
  }, [isOpen, uploadSessionId, user?.username]);

  useEffect(() => {
    if (!uploadSessionId) {
      setQrDataUrl("");
      return;
    }
    const resolvedOrigin =
      origin ||
      getAppBaseUrl() ||
      (typeof window !== "undefined" ? window.location.origin : "");
    if (!resolvedOrigin) {
      setQrDataUrl("");
      return;
    }
    const url = `${resolvedOrigin}/repairs/mobile-upload?sessionId=${uploadSessionId}`;
    QRCode.toDataURL(url, { width: 300 })
      .then(setQrDataUrl)
      .catch((error) => {
        console.error("No se pudo generar el código QR", error);
      });
  }, [origin, uploadSessionId]);

  useEffect(() => {
    if (!signatureSessionId) {
      setSignatureQrDataUrl("");
      setSignatureLink("");
      return;
    }
    const resolvedOrigin =
      origin ||
      getAppBaseUrl() ||
      (typeof window !== "undefined" ? window.location.origin : "");
    if (!resolvedOrigin) {
      setSignatureQrDataUrl("");
      setSignatureLink("");
      return;
    }
    const link = `${resolvedOrigin}/repairs/mobile-signature?sessionId=${signatureSessionId}`;
    setSignatureLink(link);
    QRCode.toDataURL(link, { width: 300 })
      .then(setSignatureQrDataUrl)
      .catch((error) => {
        console.error("No se pudo generar el código QR de firma", error);
      });
  }, [origin, signatureSessionId]);

  useEffect(() => {
    if (!signatureSessionRefPath) return;
    const sessionRef = ref(database, signatureSessionRefPath);
    const unsubscribe = onValue(sessionRef, (snapshot) => {
      if (!snapshot.exists()) {
        setSignatureStatus("pending");
        setSignatureData(null);
        return;
      }
      const sessionData = snapshot.val();
      setSignatureStatus(sessionData.status || "pending");
      if (sessionData.signature?.url) {
        const signaturePayload = {
          url: sessionData.signature.url as string,
          path: sessionData.signature.path as string | undefined,
          signedAt: sessionData.signature.signedAt as string | undefined,
          sessionId: signatureSessionId ?? undefined,
          signerName: sessionData.signature.signerName as string | undefined,
          signerDni: sessionData.signature.signerDni as string | undefined,
        };
        setSignatureData(signaturePayload);
        setCompletedRepair((prev) => (prev ? { ...prev, signature: signaturePayload } : prev));
      }
    });

    return () => unsubscribe();
  }, [signatureSessionId, signatureSessionRefPath]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const isCustomerField = Object.prototype.hasOwnProperty.call(initialCustomerState, name);
    const setter = isCustomerField ? setCustomerData : setRepairData;

    setter(prev => ({
        ...prev,
        [name]: type === 'number' ? parseFloat(value) || 0 : value
    }));
  }, []);

  const addPhotoToSession = useCallback(async (file: File, source: "desktop" | "mobile" = "desktop") => {
    if (!uploadSessionId) return;
    const storagePath = `repair-uploads/${uploadSessionId}/${Date.now()}-${file.name}`;
    const fileRef = storageRef(storage, storagePath);
    await uploadBytes(fileRef, file);
    const url = await getDownloadURL(fileRef);
    const photosRef = ref(database, `repairUploadSessions/${uploadSessionId}/photos`);
    await push(photosRef, {
      url,
      uploadedAt: new Date().toISOString(),
      uploadedBy: source,
      name: file.name,
      path: storagePath,
    });
    const sessionRef = ref(database, `repairUploadSessions/${uploadSessionId}`);
    await update(sessionRef, {
      pendingUpload: false,
      lastUploadedAt: new Date().toISOString(),
      lastUploadedFrom: source,
    }).catch(() => null);
  }, [uploadSessionId]);

  const handleLocalPhotos = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files?.length || !uploadSessionId) return;
    const files = Array.from(event.target.files);
    setIsUploadingPhotos(true);
    try {
      for (const file of files) {
        await addPhotoToSession(file, "desktop");
      }
      toast.success("Fotos agregadas correctamente.");
    } catch (error) {
      console.error("Error al subir fotos:", error);
      toast.error("No se pudieron subir las fotos", {
        description: (error as Error).message,
      });
    } finally {
      event.target.value = "";
      setIsUploadingPhotos(false);
    }
  };

  const searchCustomerByDni = async () => {
    if (!customerData.dni || customerData.dni.length < 7) {
      toast.error("DNI inválido", { description: "Por favor ingrese un DNI válido para buscar" });
      return;
    }
    setIsSearching(true);
    try {
      const customersRef = ref(database, "customers");
      const q = query(customersRef, orderByChild('dni'), equalTo(customerData.dni));
      const snapshot = await get(q);
      if (snapshot.exists()) {
        const foundCustomer = Object.values(snapshot.val())[0] as any;
        setCustomerData({
            name: foundCustomer.name,
            dni: foundCustomer.dni,
            phone: foundCustomer.phone,
            email: foundCustomer.email || "",
        });
        toast.success("Cliente encontrado", { description: "Los datos del cliente se han cargado." });
      } else {
        toast.info("Cliente no encontrado", { description: "Puede crear uno nuevo completando los campos." });
      }
    } catch (error) {
      console.error("Error al buscar cliente:", error);
      toast.error("Error", { description: "Ocurrió un error al buscar el cliente" });
    } finally {
      setIsSearching(false);
    }
  };

  const startSignatureSession = useCallback(async (repair: RepairRecord) => {
    setSignatureSessionError(null);
    setSignatureSessionId(null);
    setSignatureQrDataUrl("");
    setSignatureLink("");
    setSignatureSessionRefPath("");

    const sessionPayload = {
      createdAt: new Date().toISOString(),
      status: "pending",
      repairId: repair.id,
      receiptNumber: repair.receiptNumber,
      store: repair.store ?? null,
      createdBy: user?.username ?? null,
      pendingSignature: true,
    };

    const newSessionId = generateSignatureSessionId();
    try {
      const sessionRef = ref(database, `repairSignatureSessions/${newSessionId}`);
      await set(sessionRef, sessionPayload);
      setSignatureSessionId(newSessionId);
      setSignatureSessionRefPath(`repairSignatureSessions/${newSessionId}`);
      setIsSignatureDialogOpen(true);
      return;
    } catch (error) {
      console.error("Error al crear la sesión de firma:", error);
    }

    try {
      const repairRef = ref(database, `repairs/${repair.id}`);
      await update(repairRef, { signatureSession: sessionPayload });
      setSignatureSessionId(repair.id);
      setSignatureSessionRefPath(`repairs/${repair.id}/signatureSession`);
      setIsSignatureDialogOpen(true);
    } catch (error) {
      console.error("Error al crear la sesión de firma en la reparación:", error);
      setSignatureSessionError("No se pudo iniciar la sesión de firma. Revisá la conexión e intentá nuevamente.");
      throw error;
    }
  }, [user?.username]);

  const handleCloseSignatureDialog = async () => {
    if (signatureSessionRefPath) {
      const sessionRef = ref(database, signatureSessionRefPath);
      await update(sessionRef, {
        status: "closed",
        closedAt: new Date().toISOString(),
      }).catch(() => null);
    }
    setIsSignatureDialogOpen(false);
    if (completedRepair) {
      await generateRepairReceiptPdf(
        completedRepair,
        customerData,
        completedRepair.store === "local2" ? "local2" : "local1",
      );
    }
    onClose();
  };

  const handleCopySignatureLink = async () => {
    if (!signatureLink) return;
    try {
      await navigator.clipboard.writeText(signatureLink);
      toast.success("Enlace copiado");
    } catch (error) {
      console.error("No se pudo copiar el enlace", error);
      toast.error("No se pudo copiar el enlace");
    }
  };

  const handleRetrySignatureSession = async () => {
    if (!completedRepair) return;
    try {
      await startSignatureSession(completedRepair);
    } catch (error) {
      console.error("No se pudo iniciar la sesión de firma:", error);
      setSignatureSessionError("No se pudo iniciar la sesión de firma. Revisá la conexión e intentá nuevamente.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerData.dni || !customerData.name || !customerData.phone) {
      toast.error("Datos del cliente incompletos");
      return;
    }
    if (!repairData.productName || !repairData.description) {
      toast.error("Los datos del equipo y la falla son obligatorios");
      return;
    }
    setIsLoading(true);
    try {
      const createdRepair = await onAddRepair(repairData, customerData, {
        photos: sessionPhotos,
        sessionId: uploadSessionId || undefined,
      });
      setCompletedRepair(createdRepair);
      setSignatureData(null);
      setSignatureStatus("pending");
      try {
        await startSignatureSession(createdRepair);
      } catch (error) {
        console.error("No se pudo iniciar la sesión de firma:", error);
        toast.error("No se pudo iniciar la firma", {
          description: "Se continuará sin captura de firma.",
        });
        setSignatureSessionError("No se pudo iniciar la sesión de firma. Revisá la conexión e intentá nuevamente.");
        setIsSignatureDialogOpen(true);
      }
    } catch (error) {
      console.error("Error al guardar la reparación:", error);
      toast.error("No se pudo guardar la reparación", {
        description: (error as Error).message,
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[600px]">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>Registrar Nueva Reparación</DialogTitle>
              <DialogDescription>
                Busca un cliente por DNI o registra uno nuevo. Luego, completa los datos de la reparación.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4 max-h-[70vh] overflow-y-auto px-1">

              {/* SECCIÓN CLIENTE */}
              <h3 className="text-lg font-medium border-b pb-2">Datos del Cliente</h3>
              <div className="space-y-2">
                <Label htmlFor="dni">DNI del Cliente</Label>
                <div className="flex gap-2">
                  <Input name="dni" id="dni" value={customerData.dni} onChange={handleChange} placeholder="Buscar o ingresar DNI..." />
                  <Button variant="outline" size="icon" type="button" onClick={searchCustomerByDni} disabled={isSearching}>
                    {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nombre Completo</Label>
                  <Input name="name" id="name" placeholder="Juan Pérez" required value={customerData.name} onChange={handleChange} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Teléfono</Label>
                  <Input name="phone" id="phone" placeholder="3584123456" required value={customerData.phone} onChange={handleChange} />
                </div>
              </div>

              {/* SECCIÓN EQUIPO */}
              <h3 className="text-lg font-medium border-b pb-2 mt-4">Datos del Equipo y Reparación</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="productName">Equipo</Label>
                  <Input name="productName" id="productName" placeholder="iPhone 13 Pro" required value={repairData.productName} onChange={handleChange} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="imei">IMEI / N° de Serie</Label>
                  <Input name="imei" id="imei" placeholder="Opcional" value={repairData.imei} onChange={handleChange} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Falla Reportada</Label>
                <Textarea name="description" id="description" placeholder="Describe el problema del equipo" required value={repairData.description} onChange={handleChange} />
              </div>
               <div className="space-y-2">
                  <Label htmlFor="estimatedPrice">Presupuesto Estimado ($)</Label>
                  <Input name="estimatedPrice" id="estimatedPrice" type="number" placeholder="0.00" value={repairData.estimatedPrice} onChange={handleChange}/>
                </div>

              {/* SECCIÓN FOTOS */}
              <h3 className="text-lg font-medium border-b pb-2 mt-4">Fotos del Equipo</h3>
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Podés subir fotos desde esta PC o escanear el código QR para cargarlas directamente desde tu celular personal.
                </p>
                {uploadSessionId && sessionPhotos.length === 0 && (
                  <Alert className="border-amber-200 bg-amber-50 text-amber-900">
                    <AlertTitle>Fotos pendientes en el celular</AlertTitle>
                    <AlertDescription>
                      Esta sesión de carga está esperando imágenes. Abrí el enlace desde tu celular para tomar las fotos del equipo.
                    </AlertDescription>
                  </Alert>
                )}
                <div className="grid gap-2 sm:grid-cols-[auto,1fr] sm:items-center">
                  <div className="flex flex-col items-center gap-2 rounded-md border p-3">
                    {qrDataUrl ? (
                      <Image src={qrDataUrl} alt="Código QR para subir fotos" width={128} height={128} className="h-32 w-32" />
                    ) : (
                      <div className="flex h-32 w-32 items-center justify-center text-muted-foreground text-sm text-center">
                        Generando QR...
                      </div>
                    )}
                    <span className="text-xs text-muted-foreground text-center">Escanealo con tu celular</span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={() => {
                        if (!uploadSessionId || !origin) return;
                        const link = `${origin}/repairs/mobile-upload?sessionId=${uploadSessionId}`;
                        if (navigator.clipboard?.writeText) {
                          navigator.clipboard.writeText(link)
                            .then(() => toast.success("Enlace copiado al portapapeles"))
                            .catch(() => toast.error("No se pudo copiar el enlace"));
                        } else {
                          toast.error("No se pudo copiar el enlace", {
                            description: "Copiá la URL manualmente desde el botón 'Abrir en el celular'.",
                          });
                        }
                      }}>
                        <Copy className="mr-2 h-4 w-4" /> Copiar enlace
                      </Button>
                      <a
                        href={uploadSessionId && origin ? `${origin}/repairs/mobile-upload?sessionId=${uploadSessionId}` : "#"}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-muted"
                      >
                        <Smartphone className="h-4 w-4" /> Abrir en el celular
                      </a>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="repair-photos" className="text-sm font-medium">Subir desde esta PC</Label>
                      <Input
                        id="repair-photos"
                        type="file"
                        accept="image/*"
                        multiple
                        capture="environment"
                        onChange={handleLocalPhotos}
                        disabled={isUploadingPhotos || !uploadSessionId}
                      />
                      {isUploadingPhotos && (
                        <p className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" /> Subiendo fotos...
                        </p>
                      )}
                    </div>
                  </div>
                </div>
                {sessionPhotos.length > 0 ? (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {sessionPhotos.map((photo) => (
                      <div key={photo.id} className="space-y-1">
                        <div className="relative aspect-square w-full overflow-hidden rounded-md border bg-muted">
                          <Image
                            src={photo.url}
                            alt={photo.name || "Foto de reparación"}
                            fill
                            className="object-cover"
                            sizes="150px"
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {photo.uploadedBy === "mobile" ? "Desde celular" : "Desde PC"}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Aún no hay fotos agregadas.</p>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                Guardar Reparación
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {completedRepair && (
        <Dialog
          open={isSignatureDialogOpen}
          onOpenChange={(open) => {
            if (!open) return;
            setIsSignatureDialogOpen(true);
          }}
        >
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>Firma del cliente</DialogTitle>
              <DialogDescription>
                Antes de generar el PDF podés solicitar la firma desde otra tablet o celular.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {signatureSessionError && (
                <Alert variant="destructive">
                  <AlertTitle>No se pudo iniciar la firma</AlertTitle>
                  <AlertDescription className="space-y-3">
                    <p>{signatureSessionError}</p>
                    <Button type="button" variant="outline" onClick={handleRetrySignatureSession}>
                      Reintentar generar QR
                    </Button>
                  </AlertDescription>
                </Alert>
              )}
              <Alert>
                <Smartphone className="h-4 w-4" />
                <AlertTitle>Conectá el dispositivo</AlertTitle>
                <AlertDescription>
                  Escaneá el QR o abrí el enlace para dibujar la firma del cliente.
                </AlertDescription>
              </Alert>

              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <div className="flex h-40 w-40 items-center justify-center rounded-md border bg-muted">
                  {signatureQrDataUrl ? (
                    <Image
                      src={signatureQrDataUrl}
                      alt="Código QR para firma"
                      width={160}
                      height={160}
                      className="h-36 w-36"
                    />
                  ) : (
                    <span className="text-sm text-muted-foreground">Generando QR...</span>
                  )}
                </div>
                <div className="flex-1 space-y-2">
                  <Label>Enlace para firmar</Label>
                  <div className="flex gap-2">
                    <Input readOnly value={signatureLink || "Generando enlace..."} />
                    <Button type="button" variant="outline" size="icon" onClick={handleCopySignatureLink} disabled={!signatureLink}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Compartí este enlace con la tablet o celular del cliente.
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Estado de la firma</Label>
                <div className="rounded-md border p-3">
                  {signatureData?.url ? (
                    <div className="space-y-3">
                      <p className="text-sm font-medium text-green-600">Firma recibida.</p>
                      <div className="rounded-md border bg-white p-2">
                        <Image
                          src={signatureData.url}
                          alt="Firma del cliente"
                          width={320}
                          height={160}
                          className="h-28 w-full object-contain"
                        />
                      </div>
                      {signatureData.signedAt && (
                        <p className="text-xs text-muted-foreground">
                          Firmado el {new Date(signatureData.signedAt).toLocaleString()}
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {signatureStatus === "closed"
                        ? "La sesión de firma fue cerrada."
                        : "Esperando la firma del cliente..."}
                    </p>
                  )}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={handleCloseSignatureDialog}>
                Omitir firma
              </Button>
              <Button onClick={handleCloseSignatureDialog} disabled={!signatureData?.url}>
                Generar PDF
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}
