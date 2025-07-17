"use client"

import { CardDescription } from "@/components/ui/card"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import DashboardLayout from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Download, Upload, Calendar, Clock, Database, Save, Trash, RefreshCw } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
// --- CORRECCIÓN AQUÍ ---
import { ref, onValue, get, set } from "firebase/database" 
import { database } from "@/lib/firebase"
import { toast } from "sonner"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import ScheduleBackupModal from "@/components/schedule-backup-modal"

// Definición de interfaces
interface Backup {
  id: string
  date: string
  size: number
  createdBy: string
  status: string
  scheduleConfig?: {
    enabled: boolean
    frequency: string
  }
  [key: string]: any // Para cualquier otra propiedad que pueda tener
}

interface BackupStats {
  total: number
  lastBackup: Date | null
  nextScheduled: Date | null
  autoBackupEnabled: boolean
}

interface ScheduleSettings {
  enabled: boolean
  frequency: string
}

export default function BackupPage() {
  const router = useRouter()
  const [user, setUser] = useState<{ username: string; role: string } | null>(null)
  const [backups, setBackups] = useState<Backup[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false)
  const [autoBackupEnabled, setAutoBackupEnabled] = useState(false)
  const [backupFrequency, setBackupFrequency] = useState("weekly")
  const [backupStats, setBackupStats] = useState<BackupStats>({
    total: 0,
    lastBackup: null,
    nextScheduled: null,
    autoBackupEnabled: false,
  })

  useEffect(() => {
    // Verificar autenticación y rol
    const storedUser = localStorage.getItem("user")
    if (!storedUser) {
      router.push("/")
      return
    }

    try {
      const parsedUser = JSON.parse(storedUser)
      setUser(parsedUser)

      // Redirigir si no es administrador
      if (parsedUser.role !== "admin") {
        router.push("/dashboard")
      }
    } catch (e) {
      localStorage.removeItem("user")
      router.push("/")
    }

    // Cargar backups desde Firebase
    const backupsRef = ref(database, "backups")
    const unsubscribe = onValue(backupsRef, (snapshot) => {
      if (snapshot.exists()) {
        const backupsData: Backup[] = []
        snapshot.forEach((childSnapshot) => {
          backupsData.push({
            id: childSnapshot.key || "",
            ...childSnapshot.val(),
          })
        })

        // Ordenar por fecha (más reciente primero)
        backupsData.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

        setBackups(backupsData)

        // Calcular estadísticas
        if (backupsData.length > 0) {
          const lastBackup = new Date(backupsData[0].date)

          // Calcular próximo backup programado
          let nextScheduled: Date | null = null
          const scheduleConfig = backupsData[0].scheduleConfig

          if (scheduleConfig && scheduleConfig.enabled) {
            setAutoBackupEnabled(true)
            setBackupFrequency(scheduleConfig.frequency)

            // Calcular próxima fecha basada en la frecuencia
            nextScheduled = new Date(lastBackup)
            if (scheduleConfig.frequency === "daily") {
              nextScheduled.setDate(nextScheduled.getDate() + 1)
            } else if (scheduleConfig.frequency === "weekly") {
              nextScheduled.setDate(nextScheduled.getDate() + 7)
            } else if (scheduleConfig.frequency === "monthly") {
              nextScheduled.setMonth(nextScheduled.getMonth() + 1)
            }
          }

          setBackupStats({
            total: backupsData.length,
            lastBackup,
            nextScheduled,
            autoBackupEnabled: scheduleConfig?.enabled || false,
          })
        } else {
          setBackupStats({
            total: 0,
            lastBackup: null,
            nextScheduled: null,
            autoBackupEnabled: false,
          })
        }
      } else {
        setBackups([])
        setBackupStats({
          total: 0,
          lastBackup: null,
          nextScheduled: null,
          autoBackupEnabled: false,
        })
      }
    })

    return () => {
      unsubscribe()
    }
  }, [router])

  const handleCreateBackup = async () => {
    if (user?.role !== "admin") {
      toast.error("Acceso denegado", {
        description: "Solo los administradores pueden crear backups",
      })
      return
    }

    setIsLoading(true)
    try {
      // Obtener todos los datos de la base de datos
      const dataSnapshot = await get(ref(database))
      const data = dataSnapshot.val()

      // Crear un objeto con los datos y metadatos del backup
      const backupData = {
        data,
        metadata: {
          createdBy: user.username,
          timestamp: Date.now(),
          version: "1.0",
        },
      }

      // Convertir a JSON
      const backupJson = JSON.stringify(backupData)

      // En una implementación real, aquí se guardaría el backup en Firebase Storage
      // Para este ejemplo, simulamos la creación del backup

      // Crear un registro del backup en la base de datos
      const backupRef = ref(database, `backups/${Date.now()}`)
      await set(backupRef, {
        date: new Date().toISOString(),
        size: backupJson.length,
        createdBy: user.username,
        status: "completed",
        scheduleConfig: {
          enabled: autoBackupEnabled,
          frequency: backupFrequency,
        },
      })

      // Simular la descarga del archivo
      const blob = new Blob([backupJson], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `imarket-backup-${new Date().toISOString().split("T")[0]}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      toast.success("Backup creado", {
        description: "El backup ha sido creado y descargado correctamente",
      })
    } catch (error) {
      console.error("Error al crear el backup:", error)
      toast.error("Error", {
        description: "Ocurrió un error al crear el backup",
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Corregido: Añadido tipo explícito para el parámetro backup
  const handleRestoreBackup = (backup: Backup) => {
    // En una implementación real, aquí se restauraría el backup
    // Para este ejemplo, solo mostramos un mensaje
    toast.info("Restauración simulada", {
      description: `Se simularía la restauración del backup del ${new Date(backup.date).toLocaleDateString()}`,
    })
  }

  // Corregido: Añadido tipo explícito para el parámetro backup
  const handleDeleteBackup = (backup: Backup) => {
    // En una implementación real, aquí se eliminaría el backup
    // Para este ejemplo, solo mostramos un mensaje
    toast.info("Eliminación simulada", {
      description: `Se simularía la eliminación del backup del ${new Date(backup.date).toLocaleDateString()}`,
    })
  }

  // Corregido: Añadido tipo explícito para el parámetro backup
  const handleDownloadBackup = (backup: Backup) => {
    // En una implementación real, aquí se descargaría el backup desde Firebase Storage
    // Para este ejemplo, solo mostramos un mensaje
    toast.info("Descarga simulada", {
      description: `Se simularía la descarga del backup del ${new Date(backup.date).toLocaleDateString()}`,
    })
  }

  // Corregido: Añadido tipo explícito para el parámetro scheduleData
  const handleScheduleBackup = (scheduleData: ScheduleSettings) => {
    setAutoBackupEnabled(scheduleData.enabled)
    setBackupFrequency(scheduleData.frequency)

    toast.success("Programación actualizada", {
      description: `Los backups automáticos han sido ${scheduleData.enabled ? "activados" : "desactivados"}`,
    })

    setIsScheduleModalOpen(false)
  }

  if (user?.role !== "admin") {
    return null // No mostrar nada mientras se redirige
  }

  return (
    <DashboardLayout>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Backup y Restauración</h1>
          <div className="flex items-center gap-4">
            <Button variant="outline" onClick={() => setIsScheduleModalOpen(true)}>
              <Calendar className="mr-2 h-4 w-4" />
              Programar Backups
            </Button>
            <Button onClick={handleCreateBackup} disabled={isLoading}>
              {isLoading ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Crear Backup Ahora
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total de Backups</CardTitle>
              <Database className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{backupStats.total}</div>
              <p className="text-xs text-muted-foreground">Backups realizados</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Último Backup</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {backupStats.lastBackup ? backupStats.lastBackup.toLocaleDateString() : "Ninguno"}
              </div>
              <p className="text-xs text-muted-foreground">
                {backupStats.lastBackup
                  ? `Hace ${Math.floor((new Date().getTime() - backupStats.lastBackup.getTime()) / (1000 * 60 * 60 * 24))} días`
                  : "No hay backups"}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Próximo Backup</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {backupStats.autoBackupEnabled && backupStats.nextScheduled
                  ? backupStats.nextScheduled.toLocaleDateString()
                  : "No programado"}
              </div>
              <p className="text-xs text-muted-foreground">
                {backupStats.autoBackupEnabled
                  ? `Frecuencia: ${
                      backupFrequency === "daily" ? "Diaria" : backupFrequency === "weekly" ? "Semanal" : "Mensual"
                    }`
                  : "Backups automáticos desactivados"}
              </p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="backups">
          <TabsList className="mb-4">
            <TabsTrigger value="backups">Backups</TabsTrigger>
            <TabsTrigger value="restore">Restauración</TabsTrigger>
            <TabsTrigger value="settings">Configuración</TabsTrigger>
          </TabsList>

          <TabsContent value="backups">
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Creado por</TableHead>
                    <TableHead>Tamaño</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {backups.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-6 text-muted-foreground">
                        No hay backups disponibles
                      </TableCell>
                    </TableRow>
                  ) : (
                    backups.map((backup) => (
                      <TableRow key={backup.id}>
                        <TableCell>{new Date(backup.date).toLocaleString()}</TableCell>
                        <TableCell>{backup.createdBy}</TableCell>
                        <TableCell>{(backup.size / 1024).toFixed(2)} KB</TableCell>
                        <TableCell>
                          <Badge variant={backup.status === "completed" ? "default" : "secondary"}>
                            {backup.status === "completed" ? "Completado" : "En proceso"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="icon" onClick={() => handleDownloadBackup(backup)}>
                              <Download className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleRestoreBackup(backup)}>
                              <Upload className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDeleteBackup(backup)}>
                              <Trash className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="restore">
            <Card>
              <CardHeader>
                <CardTitle>Restaurar desde Archivo</CardTitle>
                <CardDescription>Suba un archivo de backup para restaurar la base de datos</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-4">
                  <div className="border-2 border-dashed rounded-md p-6 text-center">
                    <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground mb-2">
                      Arrastre y suelte un archivo de backup o haga clic para seleccionar
                    </p>
                    <Input type="file" accept=".json" className="hidden" id="backup-file" />
                    <Button variant="outline" onClick={() => document.getElementById("backup-file")?.click()}>
                      Seleccionar Archivo
                    </Button>
                  </div>

                  <div className="flex justify-end">
                    <Button>
                      <Upload className="mr-2 h-4 w-4" />
                      Restaurar Base de Datos
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings">
            <Card>
              <CardHeader>
                <CardTitle>Configuración de Backup</CardTitle>
                <CardDescription>Configure las opciones de backup automático</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Switch id="auto-backup" checked={autoBackupEnabled} onCheckedChange={setAutoBackupEnabled} />
                    <Label htmlFor="auto-backup">Habilitar backups automáticos</Label>
                  </div>

                  {autoBackupEnabled && (
                    <div className="grid grid-cols-4 items-center gap-2">
                      <Label htmlFor="backup-frequency" className="col-span-1">
                        Frecuencia
                      </Label>
                      <Select value={backupFrequency} onValueChange={setBackupFrequency}>
                        <SelectTrigger className="col-span-3">
                          <SelectValue placeholder="Seleccione frecuencia" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="daily">Diaria</SelectItem>
                          <SelectItem value="weekly">Semanal</SelectItem>
                          <SelectItem value="monthly">Mensual</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div className="grid grid-cols-4 items-center gap-2">
                    <Label htmlFor="retention-period" className="col-span-1">
                      Retención
                    </Label>
                    <Select defaultValue="30">
                      <SelectTrigger className="col-span-3">
                        <SelectValue placeholder="Período de retención" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="7">7 días</SelectItem>
                        <SelectItem value="30">30 días</SelectItem>
                        <SelectItem value="90">90 días</SelectItem>
                        <SelectItem value="365">1 año</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex justify-end">
                    <Button>Guardar Configuración</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <ScheduleBackupModal
        isOpen={isScheduleModalOpen}
        onClose={() => setIsScheduleModalOpen(false)}
        currentSettings={{
          enabled: autoBackupEnabled,
          frequency: backupFrequency,
        }}
        onSchedule={handleScheduleBackup}
      />
    </DashboardLayout>
  )
}