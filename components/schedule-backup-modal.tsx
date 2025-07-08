"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Calendar } from "lucide-react"

interface ScheduleBackupModalProps {
  isOpen: boolean
  onClose: () => void
  currentSettings: {
    enabled: boolean
    frequency: string
  }
  onSchedule: (scheduleData: any) => void
}

export default function ScheduleBackupModal({
  isOpen,
  onClose,
  currentSettings,
  onSchedule,
}: ScheduleBackupModalProps) {
  const [enabled, setEnabled] = useState(currentSettings.enabled)
  const [frequency, setFrequency] = useState(currentSettings.frequency)
  const [time, setTime] = useState("03:00") // Por defecto a las 3 AM
  const [dayOfWeek, setDayOfWeek] = useState("1") // Por defecto lunes
  const [dayOfMonth, setDayOfMonth] = useState("1") // Por defecto día 1

  const handleSubmit = () => {
    const scheduleData = {
      enabled,
      frequency,
      time,
      dayOfWeek: frequency === "weekly" ? Number.parseInt(dayOfWeek) : null,
      dayOfMonth: frequency === "monthly" ? Number.parseInt(dayOfMonth) : null,
    }

    onSchedule(scheduleData)
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Programar Backups Automáticos</DialogTitle>
          <DialogDescription>Configure la frecuencia y el momento para realizar backups automáticos.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="flex items-center space-x-2">
            <Switch id="schedule-enabled" checked={enabled} onCheckedChange={setEnabled} />
            <Label htmlFor="schedule-enabled">Habilitar backups automáticos</Label>
          </div>

          {enabled && (
            <>
              <div className="grid grid-cols-4 items-center gap-2">
                <Label htmlFor="frequency" className="col-span-1">
                  Frecuencia
                </Label>
                <Select value={frequency} onValueChange={setFrequency}>
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

              <div className="grid grid-cols-4 items-center gap-2">
                <Label htmlFor="time" className="col-span-1">
                  Hora
                </Label>
                <Input
                  id="time"
                  type="time"
                  className="col-span-3"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                />
              </div>

              {frequency === "weekly" && (
                <div className="grid grid-cols-4 items-center gap-2">
                  <Label htmlFor="day-of-week" className="col-span-1">
                    Día
                  </Label>
                  <Select value={dayOfWeek} onValueChange={setDayOfWeek}>
                    <SelectTrigger className="col-span-3">
                      <SelectValue placeholder="Seleccione día" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Lunes</SelectItem>
                      <SelectItem value="2">Martes</SelectItem>
                      <SelectItem value="3">Miércoles</SelectItem>
                      <SelectItem value="4">Jueves</SelectItem>
                      <SelectItem value="5">Viernes</SelectItem>
                      <SelectItem value="6">Sábado</SelectItem>
                      <SelectItem value="0">Domingo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {frequency === "monthly" && (
                <div className="grid grid-cols-4 items-center gap-2">
                  <Label htmlFor="day-of-month" className="col-span-1">
                    Día
                  </Label>
                  <Select value={dayOfMonth} onValueChange={setDayOfMonth}>
                    <SelectTrigger className="col-span-3">
                      <SelectValue placeholder="Seleccione día" />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 31 }, (_, i) => (
                        <SelectItem key={i + 1} value={(i + 1).toString()}>
                          {i + 1}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit}>
            <Calendar className="mr-2 h-4 w-4" />
            Guardar Programación
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
