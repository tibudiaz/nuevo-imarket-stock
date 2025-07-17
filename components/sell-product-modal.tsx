"use client"

import { useState, useEffect, useMemo } from "react"
import { ref, set, push, get, update, onValue, query, orderByChild, equalTo } from "firebase/database"
import { database } from "@/lib/firebase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, Search, FileText, Trash2, Plus, Minus, DollarSign, User, Phone, Mail } from "lucide-react"
import { toast } from "sonner"
import { generateSaleReceiptPdf } from "@/lib/pdf-generator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { convertPrice, formatCurrency } from "@/lib/price-converter"
import { Separator } from "@/components/ui/separator"

interface CartProduct {
  id: string;
  name: string;
  price: number;
  currency: 'USD' | 'ARS';
  stock: number;
  quantity: number;
  imei?: string;
  category?: string;
  model?: string; // Es crucial que los productos tengan este campo
}

interface BundleRule {
  id: string;
  name: string;
  type: 'model_range' | 'model_start' | 'category';
  conditions: {
    start?: string;
    end?: string;
    category?: string;
  };
  accessories: { id: string; name: string; category: string }[];
}


export default function SellProductModal({ isOpen, onClose, product, onProductSold }) {
  const [isLoading, setIsLoading] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const [customer, setCustomer] = useState({ name: "", dni: "", phone: "", email: "" })
  const [paymentMethod, setPaymentMethod] = useState("efectivo")
  const [completedSale, setCompletedSale] = useState(null)
  const [isPdfDialogOpen, setIsPdfDialogOpen] = useState(false)
  const [receiptNumber, setReceiptNumber] = useState("")

  const [cart, setCart] = useState<CartProduct[]>([])
  const [allProducts, setAllProducts] = useState<CartProduct[]>([])
  const [productSearchTerm, setProductSearchTerm] = useState("")
  const [usdRate, setUsdRate] = useState(0)
  const [isTradeIn, setIsTradeIn] = useState(false);
  const [tradeInProduct, setTradeInProduct] = useState({ name: "", imei: "", price: 0 });
  const [bundles, setBundles] = useState<BundleRule[]>([]);

  useEffect(() => {
    if (isOpen) {
      const productsRef = ref(database, "products")
      const unsubscribeProducts = onValue(productsRef, (snapshot) => {
        const data = snapshot.val() ? Object.entries(snapshot.val()).map(([id, value]) => ({ id, ...(value as object) })) : [];
        setAllProducts(data as CartProduct[]);
      })

      const currencyRef = ref(database, 'config/usdRate')
      const unsubscribeCurrency = onValue(currencyRef, (snapshot) => {
        if (snapshot.exists()) setUsdRate(snapshot.val());
      })

      const bundlesRef = ref(database, 'config/accessoryBundles');
      const unsubscribeBundles = onValue(bundlesRef, (snapshot) => {
        const data = snapshot.val();
        const bundleList: BundleRule[] = data ? Object.values(data) : [];
        setBundles(bundleList);
      });

      if (product) {
        handleAddProductToCart(product, true);
      }
      
      const date = new Date()
      const randomNum = Math.floor(Math.random() * 10000).toString().padStart(4, "0")
      setReceiptNumber(`${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2, "0")}${date.getDate().toString().padStart(2, "0")}-${randomNum}`)

      return () => {
        unsubscribeProducts();
        unsubscribeCurrency();
        unsubscribeBundles();
      }
    } else {
      setCart([])
      setIsTradeIn(false)
      setProductSearchTerm("")
      setCustomer({ name: "", dni: "", phone: "", email: "" })
      setTradeInProduct({ name: "", imei: "", price: 0 });
    }
  }, [isOpen, product])

  const searchCustomerByDni = async () => {
    if (!customer.dni) {
      toast.error("Por favor, ingrese un DNI para buscar.");
      return;
    }
    
    const normalizedDni = customer.dni.replace(/\./g, "");
    
    setIsSearching(true);
    try {
      const customersRef = ref(database, "customers");
      let foundCustomerData = null;
      const snapshot = await get(customersRef);
      if (snapshot.exists()) {
        snapshot.forEach((childSnapshot) => {
            const dbDni = (childSnapshot.val().dni || "").replace(/\./g, "");
            if(dbDni === normalizedDni) {
                foundCustomerData = childSnapshot.val();
            }
        });
      }

      if (foundCustomerData) {
          setCustomer({ name: foundCustomerData.name, dni: foundCustomerData.dni, phone: foundCustomerData.phone || "", email: foundCustomerData.email || "" });
          toast.success("Cliente encontrado");
      } else {
          toast.info("Cliente no encontrado, puede registrarlo.");
      }
    } catch (error) {
        toast.error("Error al buscar cliente.");
    } finally {
        setIsSearching(false);
    }
  };

  const handleAddProductToCart = (productToAdd, isInitialProduct = false) => {
    const existingProductInCart = cart.find(item => item.id === productToAdd.id);
  
    setCart(prevCart => {
      if (existingProductInCart) {
        return prevCart.map(item => item.id === productToAdd.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prevCart, { ...productToAdd, quantity: 1, currency: productToAdd.currency || 'USD' }];
    });
    
    if (!isInitialProduct) {
      setProductSearchTerm("");
    }
  
    const isCellphone = productToAdd.category?.toLowerCase().includes('celular');
    if (!isCellphone) return;
  
    const parseModelFromProductName = (name: string): string => {
      const match = name.match(/^(\d+\s*(?:pro|max|pro max|plus)?)/i);
      return match ? match[1].trim().replace(/\s+/g, ' ') : name;
    };
  
    const mainProductModel = parseModelFromProductName(productToAdd.name || "");
    if (!mainProductModel) return;

    let matchedRule: BundleRule | undefined;
  
    for (const rule of bundles) {
      const { start, end, category } = rule.conditions;
      const productCategory = productToAdd.category || "";
      
      const modelNumber = parseInt(mainProductModel.replace(/[^0-9]/g, ''), 10);
      const startNumber = start ? parseInt(start.replace(/[^0-9]/g, ''), 10) : 0;
      const endNumber = end ? parseInt(end.replace(/[^0-9]/g, ''), 10) : 0;
  
      if (rule.type === 'category' && productCategory === category) { matchedRule = rule; break; }
      if (rule.type === 'model_range' && start && end && modelNumber >= startNumber && modelNumber <= endNumber) { matchedRule = rule; break; }
      if (rule.type === 'model_start' && start && modelNumber >= startNumber) { matchedRule = rule; break; }
    }
  
    if (matchedRule) {
      const accessoriesToAdd: CartProduct[] = [];
      matchedRule.accessories.forEach(acc => {
        const accessoryCategory = acc.category; 
        
        const accessoryProduct = allProducts.find(p => 
          p.category?.toLowerCase() === accessoryCategory?.toLowerCase() &&
          p.model?.toLowerCase() === mainProductModel.toLowerCase()
        );
  
        if (accessoryProduct) {
          if (accessoryProduct.stock > 0) {
            accessoriesToAdd.push({ ...accessoryProduct, quantity: 1, price: 0, currency: 'ARS' });
          } else {
            toast.warning(`Sin stock`, { description: `El accesorio para "${mainProductModel}" no tiene stock.` });
          }
        } else {
           toast.error(`Accesorio no encontrado`, { description: `No se encontró un producto de categoría "${accessoryCategory}" para el modelo "${mainProductModel}".` });
        }
      });
      if (accessoriesToAdd.length > 0) {
        setCart(prevCart => {
          const newCart = [...prevCart];
          accessoriesToAdd.forEach(accToAdd => { if (!newCart.find(item => item.id === accToAdd.id)) { newCart.push(accToAdd); } });
          return newCart;
        });
        toast.info(`Combo "${matchedRule.name}" aplicado`, { description: `Se agregaron ${accessoriesToAdd.length} accesorios de regalo.` });
      }
    }
  };

  const handleRemoveProductFromCart = (productId) => setCart(cart.filter(item => item.id !== productId));
  const handleQuantityChange = (productId, newQuantity) => {
    if (newQuantity < 1) { handleRemoveProductFromCart(productId); return; }
    setCart(cart.map(item => item.id === productId ? { ...item, quantity: newQuantity } : item));
  };
  const searchedProducts = useMemo(() => {
    if (!productSearchTerm) return [];
    return allProducts.filter(p => p.name.toLowerCase().includes(productSearchTerm.toLowerCase()) && p.stock > 0);
  }, [productSearchTerm, allProducts]);
  const totalAmountInARS = useMemo(() => {
    const cartTotal = cart.reduce((sum, item) => sum + (convertPrice(item.price, item.currency, usdRate) * item.quantity), 0);
    const tradeInValueInARS = isTradeIn ? tradeInProduct.price * usdRate : 0;
    return cartTotal - tradeInValueInARS;
  }, [cart, usdRate, isTradeIn, tradeInProduct.price]);

  const handleSellProduct = async () => { /* ...Lógica de venta... */ };
  const handlePdfDialogClose = (generatePdfOption) => { /* ...Lógica de PDF... */ };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-5xl h-[95vh] flex flex-col">
          <DialogHeader><DialogTitle>Registrar Venta</DialogTitle></DialogHeader>
          <div className="grid md:grid-cols-2 gap-x-8 flex-grow min-h-0">
            {/* Columna Izquierda: Carrito y Búsqueda */}
            <ScrollArea className="pr-4 -mr-4">
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-medium">Carrito de Compra</h3>
                  <Separator className="my-2"/>
                  <ScrollArea className="h-48 pr-4 border rounded-md">
                    {cart.length === 0 ? <p className="text-center text-muted-foreground py-10">Agregue productos</p> : cart.map(item => (
                        <div key={item.id} className="flex items-center justify-between p-2 mb-2 bg-muted/50 rounded-md">
                          <div>
                            <p className="font-medium">{item.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {item.price === 0 ? <span className="font-bold text-green-600">Regalo</span> : formatCurrency(convertPrice(item.price, item.currency, usdRate) * item.quantity)}
                              {item.currency === 'USD' && item.price > 0 && <span className="text-xs text-blue-500"> ({item.quantity} x ${item.price})</span>}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => handleQuantityChange(item.id, item.quantity - 1)}><Minus className="h-4 w-4"/></Button>
                            <span>{item.quantity}</span>
                            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => handleQuantityChange(item.id, item.quantity + 1)}><Plus className="h-4 w-4"/></Button>
                            <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => handleRemoveProductFromCart(item.id)}><Trash2 className="h-4 w-4"/></Button>
                          </div>
                        </div>
                    ))}
                  </ScrollArea>
                </div>
                <div>
                  <Label htmlFor="productSearch">Agregar Producto al Carrito</Label>
                  <div className="relative"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" /><Input id="productSearch" placeholder="Buscar para agregar..." className="pl-8" value={productSearchTerm} onChange={(e) => setProductSearchTerm(e.target.value)}/></div>
                  <ScrollArea className="h-32 border rounded-md mt-2">
                    {searchedProducts.map(p => (
                        <div key={p.id} className="flex items-center justify-between p-2 hover:bg-accent cursor-pointer" onClick={() => handleAddProductToCart(p)}>
                            <div><p className="font-medium">{p.name}</p><p className="text-xs text-muted-foreground">Stock: {p.stock}</p></div>
                            <span className="text-sm font-semibold">{formatCurrency(convertPrice(p.price, p.currency || 'USD', usdRate))}</span>
                        </div>
                    ))}
                  </ScrollArea>
                </div>
              </div>
            </ScrollArea>

            {/* Columna Derecha: Datos de la Venta */}
            <ScrollArea className="pr-4 -mr-4">
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Datos de la Venta</h3>
                <Separator className="my-2"/>
                <div className="space-y-3">
                  <div className="space-y-2"><Label htmlFor="usdRate" className="flex items-center gap-1.5"><DollarSign className="h-4 w-4"/> Cotización Dólar</Label><Input id="usdRate" type="number" value={usdRate} onChange={(e) => setUsdRate(Number(e.target.value) || 0)}/></div>
                  <div className="space-y-2"><Label htmlFor="customerDni" className="flex items-center gap-1.5"><User className="h-4 w-4"/>DNI Cliente</Label><div className="flex gap-2"><Input id="customerDni" value={customer.dni} onChange={(e) => setCustomer({...customer, dni: e.target.value})} /><Button variant="outline" size="icon" onClick={searchCustomerByDni} disabled={isSearching}>{isSearching ? <Loader2 className="h-4 w-4 animate-spin"/> : <Search className="h-4 w-4"/>}</Button></div></div>
                  <div className="space-y-2"><Label htmlFor="customerName">Nombre Cliente</Label><Input id="customerName" value={customer.name} onChange={(e) => setCustomer({...customer, name: e.target.value})}/></div>
                  <div className="space-y-2"><Label htmlFor="customerPhone" className="flex items-center gap-1.5"><Phone className="h-4 w-4"/>Teléfono</Label><Input id="customerPhone" value={customer.phone} onChange={(e) => setCustomer({...customer, phone: e.target.value})}/></div>
                  <div className="space-y-2"><Label htmlFor="customerEmail" className="flex items-center gap-1.5"><Mail className="h-4 w-4"/>Email (Opcional)</Label><Input id="customerEmail" value={customer.email} onChange={(e) => setCustomer({...customer, email: e.target.value})}/></div>
                  <div className="space-y-2"><Label>Método de Pago</Label><Select value={paymentMethod} onValueChange={setPaymentMethod}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="efectivo">Efectivo</SelectItem><SelectItem value="tarjeta">Tarjeta</SelectItem><SelectItem value="transferencia">Transferencia</SelectItem></SelectContent></Select></div>
                  <div><Button type="button" variant="secondary" onClick={() => setIsTradeIn(!isTradeIn)} className="w-full">{isTradeIn ? "Cancelar Parte de Pago" : "Recibir en Parte de Pago"}</Button></div>
                  {isTradeIn && <div className="p-4 border rounded-md space-y-3"><h4 className="font-medium text-center text-sm">Equipo Recibido (Apple)</h4><div className="space-y-1"><Label htmlFor="tradeIn-name" className="text-xs">Modelo</Label><Input id="tradeIn-name" placeholder="Ej: iPhone 13 Pro" value={tradeInProduct.name} onChange={(e) => setTradeInProduct({ ...tradeInProduct, name: e.target.value })} /></div><div className="space-y-1"><Label htmlFor="tradeIn-imei" className="text-xs">IMEI</Label><Input id="tradeIn-imei" value={tradeInProduct.imei} onChange={(e) => setTradeInProduct({ ...tradeInProduct, imei: e.target.value })} /></div><div className="space-y-1"><Label htmlFor="tradeIn-price" className="text-xs">Valor Toma (USD)</Label><Input id="tradeIn-price" type="number" value={tradeInProduct.price} onChange={(e) => setTradeInProduct({ ...tradeInProduct, price: Number(e.target.value) })} /></div></div>}
                </div>
              </div>
            </ScrollArea>
          </div>
          
          <DialogFooter className="mt-auto pt-4 border-t">
            <div className="w-full flex justify-between items-center">
              <div className="text-2xl font-bold">
                Total: {formatCurrency(totalAmountInARS)}
              </div>
              <div className="flex gap-2">
                  <Button variant="outline" onClick={onClose}>Cancelar</Button>
                  <Button onClick={handleSellProduct} disabled={isLoading || cart.length === 0}>{isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Completar Venta</Button>
              </div>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {completedSale && (
        <Dialog open={isPdfDialogOpen} onOpenChange={() => setIsPdfDialogOpen(false)}>
          <DialogContent><DialogHeader><DialogTitle>Venta Completada</DialogTitle><DialogDescription>¿Deseas generar el comprobante de la venta en PDF?</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" onClick={() => handlePdfDialogClose(false)}>No, gracias</Button><Button onClick={() => handlePdfDialogClose(true)}><FileText className="mr-2 h-4 w-4" />Generar PDF</Button></DialogFooter></DialogContent>
        </Dialog>
      )}
    </>
  )
}