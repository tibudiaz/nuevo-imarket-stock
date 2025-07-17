// Ruta: lib/price-converter.ts

// Este es el umbral para decidir si un precio está en USD o ARS.
// Precios menores a este umbral se considerarán en USD.
const USD_PRICE_THRESHOLD = 3000;

/**
 * Convierte un precio a pesos argentinos (ARS) si es necesario,
 * basándose en el umbral.
 * @param price - El precio del producto.
 * @param usdRate - La cotización actual del dólar.
 * @returns El precio convertido a ARS.
 */
export const convertPrice = (price: number, currency: 'USD' | 'ARS', usdRate: number): number => {
  // Si el precio es menor al umbral, se asume que es USD y se convierte.
  // De lo contrario, se asume que ya está en ARS.
  if (price < USD_PRICE_THRESHOLD || currency === 'USD') {
    return price * usdRate;
  }
  return price;
};

/**
 * Formatea un número como una moneda en pesos argentinos.
 * @param amount - El monto a formatear.
 * @returns El monto formateado como string (ej. "$1,234.50").
 */
export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
  }).format(amount);
};