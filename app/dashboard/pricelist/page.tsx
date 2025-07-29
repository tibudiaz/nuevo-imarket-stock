"use client";

import { useState, useEffect, useRef } from "react";
import DashboardLayout from "@/components/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { database } from "@/lib/firebase";
import { ref, onValue } from "firebase/database";
import { useAuth } from "@/hooks/use-auth";

const IG_WIDTH = 1080;
const IG_HEIGHT = 1920;

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
  const [scale, setScale] = useState<number>(1);
  const [aspectRatio, setAspectRatio] = useState<string>("original");
  const [quality, setQuality] = useState<number>(0.92);
  const [sizePreset, setSizePreset] = useState<string>("ig-story");
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragOffset = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (sizePreset === "ig-story") {
      setAspectRatio("9:16");
    }
  }, [sizePreset]);

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
    let cropWidth = image.width;
    let cropHeight = image.height;
    if (aspectRatio !== "original") {
      const [w, h] = aspectRatio.split(":" ).map(Number);
      if (w && h) {
        const ratio = w / h;
        if (image.width / image.height > ratio) {
          cropHeight = image.height;
          cropWidth = cropHeight * ratio;
        } else {
          cropWidth = image.width;
          cropHeight = cropWidth / ratio;
        }
      }
    }
    const sx = (image.width - cropWidth) / 2;
    const sy = (image.height - cropHeight) / 2;
    const width = cropWidth * scale;
    const height = cropHeight * scale;
    const canvasWidth = sizePreset === "ig-story" ? IG_WIDTH : width;
    const canvasHeight = sizePreset === "ig-story" ? IG_HEIGHT : height;

    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    if (sizePreset === "ig-story" && (width < canvasWidth || height < canvasHeight)) {
      ctx.filter = "blur(20px)";
      ctx.drawImage(image, sx, sy, cropWidth, cropHeight, 0, 0, canvasWidth, canvasHeight);
      ctx.filter = "none";
    }

    const x = (canvasWidth - width) / 2;
    const y = (canvasHeight - height) / 2;
    ctx.drawImage(image, sx, sy, cropWidth, cropHeight, x, y, width, height);
    ctx.font = `${fontSize}px ${fontFamily}`;
    ctx.fillStyle = textColor;
    ctx.textBaseline = "top";
    const lines = products.map((p) => `${p.name} - $${p.price}`);
    lines.forEach((line, i) => {
      ctx.fillText(line, x + posX, y + posY + i * (fontSize + 4));
    });
  };

  useEffect(() => {
    drawCanvas();
  }, [products, fontSize, fontFamily, textColor, posX, posY, aspectRatio, scale, sizePreset]);


  const downloadImage = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = "price-list.jpg";
    link.href = canvas.toDataURL("image/jpeg", quality);
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
                "Helvetica",
                "Georgia",
                "Times New Roman",
                "Comic Sans MS",
                "Courier New",
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
          <Select onValueChange={setSizePreset} value={sizePreset}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Tamaño" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">Auto</SelectItem>
              <SelectItem value="ig-story">Historia IG</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2">
            <span>Zoom</span>
            <Slider
              min={0.5}
              max={2}
              step={0.1}
              value={[scale]}
              onValueChange={(val) => setScale(val[0])}
              className="w-40"
            />
          </div>
          <Select onValueChange={setAspectRatio} value={aspectRatio}>
            <SelectTrigger className="w-[100px]">
              <SelectValue placeholder="Ratio" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="original">Original</SelectItem>
              <SelectItem value="16:9">16:9</SelectItem>
              <SelectItem value="4:3">4:3</SelectItem>
              <SelectItem value="1:1">1:1</SelectItem>
              <SelectItem value="9:16">9:16</SelectItem>
            </SelectContent>
          </Select>
          <Input
            type="number"
            step="0.01"
            min="0"
            max="1"
            className="w-20"
            value={quality}
            onChange={(e) => setQuality(Number(e.target.value))}
            placeholder="Calidad"
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
