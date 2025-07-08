"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import DashboardLayout from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Plus, Search, Edit, Trash, ShoppingCart, Barcode } from "lucide-react"
import { ref, onValue, set, push, remove } from "firebase/database"
import { database } from "@/lib/firebase"
import { useToast } from "@/components/ui/use-toast"
import SellProductModal from "@/components/sell-product-modal"

// Definir interfaces para los tipos
interface User {
  username: string
  role: string
}

interface Product {
  id: string
  name?: string
  brand?: string
  model?: string
  price?: number
  cost?: number
  stock?: number
  category?: string
  barcode?: string
  imei?: string
  [key: string]: any
}

interface NewProduct {
  name: string
  brand: string
  model: string
  price: number
  cost: number
  stock: number
  category: string
  barcode: string
  imei: string
}

export default function InventoryPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [user, setUser] = useState<User | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isSellDialogOpen, setIsSellDialogOpen] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [newProduct, setNewProduct] = useState<NewProduct>({
    name: "",
    brand: "",
    model: "",
    price: 0,
    cost: 0,
    stock: 0,
    category: "",
    barcode: "",
    imei: "",
  })

  useEffect(() => {
    // Verificar autenticación
    const storedUser = localStorage.getItem("user")
    if (!storedUser) {
      router.push("/")
      return
    }

    try {
      setUser(JSON.parse(storedUser))
    } catch (e) {
      localStorage.removeItem("user")
      router.push("/")
    }

    // Cargar productos desde Firebase
    const productsRef = ref(database, "products")

    try {
      const unsubscribe = onValue(
        productsRef,
        (snapshot) => {
          setIsLoading(false)
          if (snapshot.exists()) {
            const productsData: Product[] = []
            snapshot.forEach((childSnapshot) => {
              productsData.push({
                id: childSnapshot.key || "",
                ...childSnapshot.val(),
              })
            })
            setProducts(productsData)
          } else {
            setProducts([])
          }
        },
        (error) => {
          console.error("Error al cargar productos:", error)
          setIsLoading(false)
          setProducts([])
          toast({
            title: "Error de conexión",
            description: "No se pudieron cargar los productos. Verifica tu conexión a Firebase.",
            variant: "destructive",
          })
        },
      )

      return () => {
        unsubscribe()
      }
    } catch (error) {
      console.error("Error general:", error)
      setIsLoading(false)
      setProducts([])
    }
  }, [router, toast])

  const filteredProducts = products.filter(
    (product) =>
      product.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.brand?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.model?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.category?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.barcode?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.imei?.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  const handleAddProduct = async () => {
    try {
      // Validar campos
      if (!newProduct.name || !newProduct.brand || !newProduct.model || !newProduct.category) {
        toast({
          title: "Campos incompletos",
          description: "Por favor complete todos los campos requeridos",
          variant: "destructive",
        })
        return
      }

      if (newProduct.price <= 0) {
        toast({
          title: "Precio inválido",
          description: "El precio debe ser mayor que cero",
          variant: "destructive",
        })
        return
      }

      // Agregar a Firebase
      const productsRef = ref(database, "products")
      const newProductRef = push(productsRef)
      await set(newProductRef, {
        ...newProduct,
        createdAt: new Date().toISOString(),
      })

      setNewProduct({
        name: "",
        brand: "",
        model: "",
        price: 0,
        cost: 0,
        stock: 0,
        category: "",
        barcode: "",
        imei: "",
      })
      setIsAddDialogOpen(false)

      toast({
        title: "Producto agregado",
        description: "El producto ha sido agregado correctamente",
      })
    } catch (error) {
      console.error("Error al agregar producto:", error)
      toast({
        title: "Error",
        description: "Ocurrió un error al agregar el producto",
        variant: "destructive",
      })
    }
  }

  const handleDeleteProduct = async (id: string) => {
    try {
      const productRef = ref(database, `products/${id}`)
      await remove(productRef)

      toast({
        title: "Producto eliminado",
        description: "El producto ha sido eliminado correctamente",
      })
    } catch (error) {
      console.error("Error al eliminar producto:", error)
      toast({
        title: "Error",
        description: "Ocurrió un error al eliminar el producto",
        variant: "destructive",
      })
    }
  }

  const handleSellProduct = (product: Product) => {
    setSelectedProduct(product)
    setIsSellDialogOpen(true)
  }

  const handleProductSold = () => {
    toast({
      title: "Venta exitosa",
      description: "El producto ha sido vendido correctamente",
    })
    setIsSellDialogOpen(false)
  }

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex h-full items-center justify-center p-6">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
          <span className="ml-2">Cargando productos...</span>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Inventario</h1>
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Buscar productos..."
                className="pl-8 w-[250px]"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Agregar Producto
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Agregar Nuevo Producto</DialogTitle>
                  <DialogDescription>
                    Complete los detalles del nuevo producto a agregar al inventario.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Nombre</Label>
                      <Input
                        id="name"
                        value={newProduct.name}
                        onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="brand">Marca</Label>
                      <Input
                        id="brand"
                        value={newProduct.brand}
                        onChange={(e) => setNewProduct({ ...newProduct, brand: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="model">Modelo</Label>
                      <Input
                        id="model"
                        value={newProduct.model}
                        onChange={(e) => setNewProduct({ ...newProduct, model: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="category">Categoría</Label>
                      <Input
                        id="category"
                        value={newProduct.category}
                        onChange={(e) => setNewProduct({ ...newProduct, category: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="barcode">Código de Barras</Label>
                      <Input
                        id="barcode"
                        value={newProduct.barcode}
                        onChange={(e) => setNewProduct({ ...newProduct, barcode: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="imei">IMEI</Label>
                      <Input
                        id="imei"
                        value={newProduct.imei}
                        onChange={(e) => setNewProduct({ ...newProduct, imei: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="price">Precio Venta</Label>
                      <Input
                        id="price"
                        type="number"
                        value={newProduct.price}
                        onChange={(e) => setNewProduct({ ...newProduct, price: Number.parseFloat(e.target.value) })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="cost">Precio Costo</Label>
                      <Input
                        id="cost"
                        type="number"
                        value={newProduct.cost}
                        onChange={(e) => setNewProduct({ ...newProduct, cost: Number.parseFloat(e.target.value) })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="stock">Stock</Label>
                      <Input
                        id="stock"
                        type="number"
                        value={newProduct.stock}
                        onChange={(e) => setNewProduct({ ...newProduct, stock: Number.parseInt(e.target.value) })}
                      />
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleAddProduct}>Guardar</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Producto</TableHead>
                <TableHead>Marca</TableHead>
                <TableHead>Modelo</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead>Código/IMEI</TableHead>
                <TableHead>Precio</TableHead>
                <TableHead>Costo</TableHead>
                <TableHead>Stock</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProducts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-6 text-muted-foreground">
                    No se encontraron productos
                  </TableCell>
                </TableRow>
              ) : (
                filteredProducts.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell className="font-medium">{product.name}</TableCell>
                    <TableCell>{product.brand}</TableCell>
                    <TableCell>{product.model}</TableCell>
                    <TableCell>{product.category}</TableCell>
                    <TableCell>
                      {product.barcode && (
                        <div className="flex items-center gap-1">
                          <Barcode className="h-3 w-3" />
                          {product.barcode}
                        </div>
                      )}
                      {product.imei && <div className="text-xs text-muted-foreground mt-1">IMEI: {product.imei}</div>}
                    </TableCell>
                    <TableCell>${product.price?.toFixed(2) || "0.00"}</TableCell>
                    <TableCell>${product.cost?.toFixed(2) || "0.00"}</TableCell>
                    <TableCell>
                      <Badge variant={product.stock && product.stock > 5 ? "default" : "destructive"}>
                        {product.stock}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => handleSellProduct(product)}>
                          <ShoppingCart className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteProduct(product.id)}>
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
      </div>

      {/* Modal para vender producto */}
      {selectedProduct && (
        <SellProductModal
          isOpen={isSellDialogOpen}
          onClose={() => setIsSellDialogOpen(false)}
          product={selectedProduct}
          onProductSold={handleProductSold}
        />
      )}
    </DashboardLayout>
  )
}
