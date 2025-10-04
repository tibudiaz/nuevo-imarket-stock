import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const removeDiacritics = (value: string) =>
  value.normalize("NFD").replace(/[\u0300-\u036f]/g, "")

export const shouldRemoveProductFromInventory = (
  category?: string | null,
) => {
  if (!category) return false

  const normalized = removeDiacritics(category).toLowerCase()
  const isCellphone = normalized.includes("celular")
  if (!isCellphone) return false

  const isNew = normalized.includes("nuevo")
  const isUsed = normalized.includes("usad")

  return isNew || isUsed
}
