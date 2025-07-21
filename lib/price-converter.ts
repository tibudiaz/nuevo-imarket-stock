// Ruta: lib/price-converter.ts

// Umbral para decidir si un precio está en USD (menor a 3500) o ARS (3500 o más).
const USD_PRICE_THRESHOLD = 3500;

/**
 * Convierte un precio a pesos argentinos (ARS) si es necesario,
 * basándose únicamente en el umbral de precio.
 * @param price - El precio del producto.
 * @param usdRate - La cotización actual del dólar.
 * @returns El precio convertido a ARS.
 */
export const convertPrice = (price: number, usdRate: number): number => {
  // Si el precio es menor al umbral, se asume que es USD y se convierte.
  if (price < USD_PRICE_THRESHOLD) {
    return price * usdRate;
  }
  
  // De lo contrario, se asume que ya está en ARS y se devuelve tal cual.
  return price;
};

/**
 * Formatea un número como una moneda en pesos argentinos.
 * @param amount - El monto a formatear.
 * @returns El monto formateado como string (ej. "$1.234,50").
 */
export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
  }).format(amount);
};