"use client";

import { useState, useEffect, useRef } from "react";
import DashboardLayout from "@/components/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { database } from "@/lib/firebase";
import { ref, onValue } from "firebase/database";
import { useAuth } from "@/hooks/use-auth";
import { Stage, Layer, Image as KonvaImage, Text as KonvaText } from "react-konva";
import Konva from "konva";

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
  const [bgUrl, setBgUrl] = useState<string | null>(null);
  const [background, setBackground] = useState<HTMLImageElement | null>(null);
  const [fontSize, setFontSize] = useState<number>(20);
  const [fontFamily, setFontFamily] = useState<string>("Arial");
  const [textColor, setTextColor] = useState<string>("#000000");
  const [pos, setPos] = useState<{ x: number; y: number }>({ x: 20, y: 40 });
  const [scale, setScale] = useState<number>(1);
  const [aspectRatio, setAspectRatio] = useState<string>("original");
  const [quality, setQuality] = useState<number>(0.92);
  const [sizePreset, setSizePreset] = useState<string>("ig-story");
  const stageRef = useRef<Konva.Stage>(null);

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

  useEffect(() => {
    if (!bgUrl) {
      setBackground(null);
      return;
    }
    const img = new window.Image();
    img.onload = () => setBackground(img);
    img.src = bgUrl;
  }, [bgUrl]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBgUrl(URL.createObjectURL(file));
  };

  const downloadImage = () => {
    const stage = stageRef.current;
    if (!stage) return;
    const uri = stage.toDataURL({ mimeType: "image/jpeg", quality });
    const link = document.createElement("a");
    link.download = "price-list.jpg";
    link.href = uri;
    link.click();
  };

  const lines = products.map((p) => `${p.name} - $${p.price}`);

  let stageWidth = IG_WIDTH;
  let stageHeight = IG_HEIGHT;
  let textX = pos.x;
  let textY = pos.y;
  let imageProps: any = null;

  if (background) {
    let cropWidth = background.width;
    let cropHeight = background.height;
    if (aspectRatio !== "original") {
      const [w, h] = aspectRatio.split(":").map(Number);
      if (w && h) {
        const ratio = w / h;
        if (background.width / background.height > ratio) {
          cropHeight = background.height;
          cropWidth = cropHeight * ratio;
        } else {
          cropWidth = background.width;
          cropHeight = cropWidth / ratio;
        }
      }
    }
    const sx = (background.width - cropWidth) / 2;
    const sy = (background.height - cropHeight) / 2;
    const width = cropWidth * scale;
    const height = cropHeight * scale;
    stageWidth = sizePreset === "ig-story" ? IG_WIDTH : width;
    stageHeight = sizePreset === "ig-story" ? IG_HEIGHT : height;
    const x = (stageWidth - width) / 2;
    const y = (stageHeight - height) / 2;
    imageProps = {
      image: background,
      x,
      y,
      width,
      height,
      crop: { x: sx, y: sy, width: cropWidth, height: cropHeight },
    };
    textX = x + pos.x;
    textY = y + pos.y;
  }

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
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
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
          <Input
            type="number"
            className="w-20"
            value={pos.x}
            onChange={(e) => setPos({ ...pos, x: Number(e.target.value) })}
            placeholder="X"
          />
          <Input
            type="number"
            className="w-20"
            value={pos.y}
            onChange={(e) => setPos({ ...pos, y: Number(e.target.value) })}
            placeholder="Y"
          />
          <Button onClick={downloadImage}>Descargar</Button>
        </div>
        <Stage ref={stageRef} width={stageWidth} height={stageHeight} className="border">
          <Layer>
            {imageProps && <KonvaImage {...imageProps} />}
            <KonvaText
              x={textX}
              y={textY}
              text={lines.join("\n")}
              fontSize={fontSize}
              fontFamily={fontFamily}
              fill={textColor}
              draggable
              onDragEnd={(e) =>
                setPos({
                  x: e.target.x() - (imageProps?.x ?? 0),
                  y: e.target.y() - (imageProps?.y ?? 0),
                })
              }
            />
          </Layer>
        </Stage>
      </div>
    </DashboardLayout>
  );
}
