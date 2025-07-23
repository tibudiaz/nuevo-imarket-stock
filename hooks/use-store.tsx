"use client"

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type StoreState = {
  selectedStore: 'all' | 'local1' | 'local2';
  setSelectedStore: (store: 'all' | 'local1' | 'local2') => void;
};

export const useStore = create<StoreState>()(
  persist(
    (set) => ({
      selectedStore: 'all', // Valor por defecto: mostrar todos los locales
      setSelectedStore: (store) => set({ selectedStore: store }),
    }),
    {
      name: 'imarket-store-selection', // Nombre de la clave en localStorage
    }
  )
);