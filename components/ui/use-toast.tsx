"use client"
import { create } from "zustand"

type ToastState = {
  toasts: any[]
  addToast: (toast: any) => void
  updateToast: (id: string, toast: any) => void
  removeToast: (id: string) => void
}

const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  addToast: (toast) =>
    set((state) => ({ toasts: [...state.toasts, { id: Math.random().toString(36).substring(2, 9), ...toast }] })),
  updateToast: (id, toast) =>
    set((state) => ({
      toasts: state.toasts.map((t) => (t.id === id ? { ...t, ...toast } : t)),
    })),
  removeToast: (id) => set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })),
}))

function useToast() {
  const { toasts, addToast, updateToast, removeToast } = useToastStore()

  const toast = (toast: any) => {
    addToast(toast)
  }

  return {
    toasts,
    toast,
    updateToast,
    removeToast,
  }
}

export { useToast }
