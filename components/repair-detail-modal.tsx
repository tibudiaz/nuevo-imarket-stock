"use client"

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { ref, runTransaction, onValue, update, set } from "firebase/database";
import { database } from "@/lib/firebase";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Copy } from "lucide-react";
import { generateDeliveryReceiptPdf } from "@/lib/pdf-generator";
import { useStore } from "@/hooks/use-store";
import type { RepairPhoto } from "@/types/repair";
import { getAppBaseUrl } from "@/lib/base-url";
import QRCode from "qrcode";
import { Input } from "@/components/ui/input";

// --- INTERFAZ UNIFICADA Y DEFINITIVA ---
// Usando la misma estructura que la página principal para consistencia.
interface Repair {
  id: string;
  receiptNumber: string;
  customerName: string;
  customerDni?: string;
  customerPhone?: string;
  productName: string;
  entryDate: string;
  description: string;
  technicianNotes?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'delivered' | 'cancelled';
  estimatedPrice?: number;
  repairCost?: number;
  finalPrice?: number;
  deliveredAt?: string;
  deliveryReceiptNumber?: string;
  photos?: RepairPhoto[];
  store?: string;
  signature?: {
    url: string;
    path?: string;
    signedAt?: string;
    sessionId?: string;
    signerName?: string;
    signerDni?: string;
  } | null;
  [key: string]: any;
}

interface RepairDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  repair: Repair | null;
  onUpdate: (id: string, data: Partial<Repair>) => Promise<void>;
}

export default function RepairDetailModal({ isOpen, onClose, repair, onUpdate }: RepairDetailModalProps) {
  const [editableRepair, setEditableRepair] = useState<Repair | null>(repair);
  const [completedDeliveryRepair, setCompletedDeliveryRepair] = useState<Repair | null>(null);
  const [origin, setOrigin] = useState<string>("");
  const [isSignatureDialogOpen, setIsSignatureDialogOpen] = useState(false);
  const [signatureSessionId, setSignatureSessionId] = useState<string | null>(null);
  const [signatureQrDataUrl, setSignatureQrDataUrl] = useState<string>("");
  const [signatureLink, setSignatureLink] = useState<string>("");
  const [signatureStatus, setSignatureStatus] = useState<string>("pending");
  const [signatureData, setSignatureData] = useState<Repair["signature"]>(null);
  const [signatureSessionRefPath, setSignatureSessionRefPath] = useState<string>("");
  const [signatureSessionError, setSignatureSessionError] = useState<string | null>(null);
  const { selectedStore } = useStore();

  useEffect(() => {
    if (repair) {
      setEditableRepair({ ...repair });
      setCompletedDeliveryRepair(null);
      setSignatureSessionId(null);
      setSignatureQrDataUrl("");
      setSignatureLink("");
      setSignatureStatus("pending");
      setSignatureData(null);
      setSignatureSessionRefPath("");
      setSignatureSessionError(null);
      setIsSignatureDialogOpen(false);
    }
  }, [repair]);

  useEffect(() => {
    if (!isOpen && signatureSessionRefPath) {
      const sessionRef = ref(database, signatureSessionRefPath);
      update(sessionRef, {
        status: "closed",
        closedAt: new Date().toISOString(),
      }).catch(() => null);
      setSignatureSessionRefPath("");
      setSignatureSessionId(null);
    }
  }, [isOpen, signatureSessionRefPath]);

  useEffect(() => {
    const resolvedOrigin = getAppBaseUrl();
    setOrigin(resolvedOrigin);
  }, []);

  useEffect(() => {
    if (!signatureSessionId || !origin) {
      setSignatureQrDataUrl("");
      setSignatureLink("");
      return;
    }
    const link = `${origin}/repairs/mobile-signature?sessionId=${signatureSessionId}`;
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
        setCompletedDeliveryRepair((prev) => (prev ? { ...prev, signature: signaturePayload } : prev));
      }
    });

    return () => unsubscribe();
  }, [signatureSessionId, signatureSessionRefPath]);

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

  const startSignatureSession = useCallback(async (repairData: Repair) => {
    setSignatureSessionError(null);
    setSignatureSessionId(null);
    setSignatureQrDataUrl("");
    setSignatureLink("");
    setSignatureSessionRefPath("");

    const sessionPayload = {
      createdAt: new Date().toISOString(),
      status: "pending",
      repairId: repairData.id,
      receiptNumber: repairData.deliveryReceiptNumber || repairData.receiptNumber,
      store: repairData.store ?? null,
      createdBy: null,
      pendingSignature: true,
    };

    const newSessionId = generateSignatureSessionId();
    const sessionRef = ref(database, `repairSignatureSessions/${newSessionId}`);
    await set(sessionRef, sessionPayload);
    setSignatureSessionId(newSessionId);
    setSignatureSessionRefPath(`repairSignatureSessions/${newSessionId}`);
    setIsSignatureDialogOpen(true);
  }, []);

  const handleCloseSignatureDialog = async () => {
    if (signatureSessionRefPath) {
      const sessionRef = ref(database, signatureSessionRefPath);
      await update(sessionRef, {
        status: "closed",
        closedAt: new Date().toISOString(),
      }).catch(() => null);
    }
    setIsSignatureDialogOpen(false);
    if (completedDeliveryRepair) {
      await generateDeliveryReceiptPdf(
        completedDeliveryRepair,
        selectedStore === "local2" ? "local2" : "local1",
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
    if (!completedDeliveryRepair) return;
    try {
      await startSignatureSession(completedDeliveryRepair);
    } catch (error) {
      console.error("No se pudo iniciar la sesión de firma:", error);
      setSignatureSessionError("No se pudo iniciar la sesión de firma. Revisá la conexión e intentá nuevamente.");
    }
  };

  if (!repair || !editableRepair) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { id, value, type } = e.target;
    setEditableRepair(prev => prev ? { ...prev, [id]: type === 'number' ? parseFloat(value) || 0 : value } : null);
  }

  const handleStatusChange = (value: Repair['status']) => {
    setEditableRepair(prev => prev ? { ...prev, status: value } : null);
  }

    const handleUpdate = async () => {
      if (!editableRepair) return;

      let deliveryReceiptNumber: string | undefined;
      const isDelivering = editableRepair.status === 'delivered' && repair.status !== 'delivered';
      if (isDelivering) {
        const counterRef = ref(database, 'counters/deliveryNumber');
        const transactionResult = await runTransaction(counterRef, (currentData) => {
          if (currentData === null) {
            return { value: 1, prefix: 'E-', lastUpdated: new Date().toISOString() };
          }
          currentData.value++;
          currentData.lastUpdated = new Date().toISOString();
          return currentData;
        });
        if (!transactionResult.committed || !transactionResult.snapshot.exists()) {
          toast.error('Error al generar número de recibo.');
          return;
        }
        const newCounterData = transactionResult.snapshot.val();
        deliveryReceiptNumber = `${newCounterData.prefix}${String(newCounterData.value).padStart(5, '0')}`;
      }

      const { photos: _ignoredPhotos, ...restOfEditable } = editableRepair;

      const updatedData = {
          ...restOfEditable,
          deliveredAt: isDelivering && !repair.deliveredAt
              ? new Date().toISOString()
              : repair.deliveredAt,
          ...(deliveryReceiptNumber ? { deliveryReceiptNumber } : {}),
          ...(isDelivering ? { signature: null } : {}),
      };

      await onUpdate(repair.id, updatedData);

      if (isDelivering) {
        const repairForSignature = { ...repair, ...updatedData };
        setCompletedDeliveryRepair(repairForSignature);
        setSignatureData(null);
        setSignatureStatus("pending");
        try {
          await startSignatureSession(repairForSignature);
        } catch (error) {
          console.error("No se pudo iniciar la sesión de firma:", error);
          toast.error("No se pudo iniciar la firma", {
            description: "Se continuará sin captura de firma.",
          });
          setSignatureSessionError("No se pudo iniciar la sesión de firma. Revisá la conexión e intentá nuevamente.");
          setIsSignatureDialogOpen(true);
        }
        return;
      }

      onClose();
    }

  const getStatusVariant = (status: Repair['status']) => {
    switch (status) {
      case 'pending': return 'destructive';
      case 'in_progress': return 'secondary';
      case 'completed': return 'default';
      case 'delivered': return 'outline';
      case 'cancelled': return 'outline';
      default: return 'secondary';
    }
  }

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalle de Reparación: {repair.receiptNumber}</DialogTitle>
            <DialogDescription>
              Cliente: {repair.customerName} | Equipo: {repair.productName}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4 max-h-[70vh] overflow-y-auto pr-4">
            <div>
              <h4 className="font-semibold mb-2">Información General</h4>
              <div className="space-y-2 text-sm">
                <p><span className="font-medium text-muted-foreground">Fecha de Ingreso:</span> {new Date(repair.entryDate).toLocaleString()}</p>
                {repair.deliveredAt && <p><span className="font-medium text-muted-foreground">Fecha de Entrega:</span> {new Date(repair.deliveredAt).toLocaleString()}</p>}
                <p><span className="font-medium text-muted-foreground">Presupuesto:</span> ${repair.estimatedPrice?.toFixed(2) || '0.00'}</p>
                <p><span className="font-medium text-muted-foreground">Costo Reparación:</span> ${repair.repairCost?.toFixed(2) || '0.00'}</p>
                <p><span className="font-medium text-muted-foreground">Precio Final:</span> ${repair.finalPrice?.toFixed(2) || 'No definido'}</p>
                <p className="flex items-center gap-2"><span className="font-medium text-muted-foreground">Estado Actual:</span> <Badge variant={getStatusVariant(repair.status)}>{repair.status.replace(/_/g, ' ')}</Badge></p>
              </div>
              <div className="mt-4">
                  <Label htmlFor="description" className="font-semibold">Falla reportada</Label>
                  <Textarea id="description" value={editableRepair.description || ''} onChange={handleChange} className="mt-1" />
              </div>
              <div className="mt-4">
                  <Label htmlFor="technicianNotes" className="font-semibold">Notas del técnico</Label>
                  <Textarea id="technicianNotes" value={editableRepair.technicianNotes || ''} onChange={handleChange} className="mt-1" />
              </div>
              <div className="mt-4">
                <h4 className="font-semibold mb-2">Fotos adjuntas</h4>
                {repair.photos && repair.photos.length > 0 ? (
                  <div className="grid grid-cols-2 gap-3">
                    {repair.photos.map((photo) => (
                      <div key={photo.id} className="space-y-1">
                        <div className="relative aspect-square overflow-hidden rounded-md border">
                          <Image
                            src={photo.url}
                            alt={photo.name || "Foto de reparación"}
                            fill
                            className="object-cover"
                            sizes="200px"
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {new Date(photo.uploadedAt).toLocaleString()} · {photo.uploadedBy === 'mobile' ? 'Celular' : 'PC'}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No hay fotos adjuntas para esta reparación.</p>
                )}
              </div>
            </div>
            <div>
               <h4 className="font-semibold mb-2">Actualizar Información</h4>
               <div className="space-y-4">
                  <div className="space-y-2">
                      <Label htmlFor="status">Estado</Label>
                      <Select value={editableRepair.status} onValueChange={handleStatusChange}>
                          <SelectTrigger>
                              <SelectValue placeholder="Seleccionar estado" />
                          </SelectTrigger>
                          <SelectContent>
                              <SelectItem value="pending">Pendiente</SelectItem>
                              <SelectItem value="in_progress">En Progreso</SelectItem>
                              <SelectItem value="completed">Completado</SelectItem>
                              <SelectItem value="delivered">Entregado</SelectItem>
                              <SelectItem value="cancelled">Cancelado</SelectItem>
                          </SelectContent>
                      </Select>
                  </div>
                   <div className="space-y-2">
                      <Label htmlFor="finalPrice">Precio Final ($)</Label>
                      <Input id="finalPrice" type="number" value={editableRepair.finalPrice || ''} onChange={handleChange} />
                  </div>
               </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={onClose}>Cerrar</Button>
            <Button onClick={handleUpdate}>Guardar Cambios</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {completedDeliveryRepair && (
        <Dialog
          open={isSignatureDialogOpen}
          onOpenChange={(open) => {
            if (!open) return;
            setIsSignatureDialogOpen(true);
          }}
        >
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>Firma de entrega</DialogTitle>
              <DialogDescription>
                Para entregar el equipo se debe solicitar una firma nueva.
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
                <AlertTitle>Conectá el dispositivo</AlertTitle>
                <AlertDescription>
                  Escaneá el QR o abrí el enlace para firmar la entrega.
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
                      <span className="sr-only">Copiar enlace</span>
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
                          alt="Firma de entrega"
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
