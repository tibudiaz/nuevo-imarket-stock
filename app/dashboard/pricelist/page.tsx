"use client";

import { useState, useEffect, useRef } from "react";
import DashboardLayout from "@/components/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { database } from "@/lib/firebase";
import { ref, onValue } from "firebase/database";
import { useAuth } from "@/hooks/use-auth";

interface Product {
  id: string;
  name?: string;
  price?: number;
  category?: string;
}

export default function PriceListPage() {
  const { user, loading: authLoading } = useAuth();
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [products, setProducts] = useState<Product[]>([]);
  const [background, setBackground] = useState<HTMLImageElement | null>(null);
  const [fontSize, setFontSize] = useState<number>(20);
  const [fontFamily, setFontFamily] = useState<string>("Arial");
  const [textColor, setTextColor] = useState<string>("#000000");
  const [posX, setPosX] = useState<number>(20);
  const [posY, setPosY] = useState<number>(40);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragOffset = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const categoriesRef = ref(database, "categories");
    onValue(categoriesRef, (snapshot) => {
      const data = snapshot.val();
      const list: string[] = data ? Object.values(data).map((c: any) => c.name) : [];
      setCategories(list);
    });
  }, []);

  useEffect(() => {
    if (!selectedCategory) return;
    const productsRef = ref(database, "products");
    onValue(productsRef, (snapshot) => {
      const data = snapshot.val();
      const list: Product[] = data
        ? Object.entries(data).map(([id, value]: [string, any]) => ({ id, ...value }))
        : [];
      setProducts(list.filter((p) => p.category === selectedCategory));
    });
  }, [selectedCategory]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const img = new Image();
    img.onload = () => {
      setBackground(img);
      drawCanvas(img);
    };
    img.src = URL.createObjectURL(file);
  };

  const drawCanvas = (img?: HTMLImageElement) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const image = img || background;
    if (!image) return;
    canvas.width = image.width;
    canvas.height = image.height;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0);
    ctx.font = `${fontSize}px ${fontFamily}`;
    ctx.fillStyle = textColor;
    ctx.textBaseline = "top";
    const lines = products.map((p) => `${p.name} - $${p.price}`);
    lines.forEach((line, i) => {
      ctx.fillText(line, posX, posY + i * (fontSize + 4));
    });
  };

  useEffect(() => {
    drawCanvas();
  }, [products, fontSize, fontFamily, textColor, posX, posY]);

  const downloadImage = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = "price-list.png";
    link.href = canvas.toDataURL();
    link.click();
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    dragOffset.current = {
      x: e.clientX - rect.left - posX,
      y: e.clientY - rect.top - posY,
    };
    setIsDragging(true);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    setPosX(e.clientX - rect.left - dragOffset.current.x);
    setPosY(e.clientY - rect.top - dragOffset.current.y);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  if (authLoading) {
    return <div className="flex h-screen items-center justify-center">Loading...</div>;
  }

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div className="flex flex-wrap gap-4">
          <Input type="file" accept="image/*" onChange={handleImageChange} />
          <Select onValueChange={setSelectedCategory} value={selectedCategory}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Categoría" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="number"
            className="w-20"
            value={fontSize}
            onChange={(e) => setFontSize(Number(e.target.value))}
            placeholder="Tamaño"
          />
          <Select onValueChange={setFontFamily} value={fontFamily}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Fuente" />
            </SelectTrigger>
            <SelectContent>
              {[
                "Arial",
                "Courier New",
                "Georgia",
                "Times New Roman",
                "Comic Sans MS",
                "Impact",
              ].map((f) => (
                <SelectItem key={f} value={f} style={{ fontFamily: f }}>
                  {f}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="color"
            className="w-20"
            value={textColor}
            onChange={(e) => setTextColor(e.target.value)}
          />
          <Input type="number" className="w-20" value={posX} onChange={(e) => setPosX(Number(e.target.value))} placeholder="X" />
          <Input type="number" className="w-20" value={posY} onChange={(e) => setPosY(Number(e.target.value))} placeholder="Y" />
          <Button onClick={() => drawCanvas()}>Actualizar</Button>
          <Button onClick={downloadImage}>Descargar</Button>
        </div>
        <canvas
          ref={canvasRef}
          className="border"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        />
      </div>
    </DashboardLayout>
  );
}
