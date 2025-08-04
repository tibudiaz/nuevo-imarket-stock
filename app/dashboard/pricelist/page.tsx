"use client";

import { useState, useEffect, useRef } from "react";
import DashboardLayout from "@/components/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
  Stage,
  Layer,
  Image as KonvaImage,
  Text as KonvaText,
  Transformer,
} from "react-konva";
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
  const { loading: authLoading } = useAuth();
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [products, setProducts] = useState<Product[]>([]);
  const [bgUrl, setBgUrl] = useState<string | null>(null);
  const [background, setBackground] = useState<HTMLImageElement | null>(null);
  const [fontSize, setFontSize] = useState<number>(32);
  const [fontFamily, setFontFamily] = useState<string>("Arial");
  const [textColor, setTextColor] = useState<string>("#000000");
  const [stageSize, setStageSize] = useState<{ width: number; height: number }>(
    { width: IG_WIDTH, height: IG_HEIGHT }
  );
  const [textPos, setTextPos] = useState<{ x: number; y: number }>({
    x: 50,
    y: 50,
  });
  const [imageProps, setImageProps] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  }>({ x: 0, y: 0, width: IG_WIDTH, height: IG_HEIGHT });
  const stageRef = useRef<Konva.Stage>(null);
  const textRef = useRef<Konva.Text>(null);
  const imageRef = useRef<Konva.Image>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

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
    img.onload = () => {
      setBackground(img);
      setStageSize({ width: img.width, height: img.height });
      setImageProps({ x: 0, y: 0, width: img.width, height: img.height });
    };
    img.src = bgUrl;
  }, [bgUrl]);

  useEffect(() => {
    const tr = transformerRef.current;
    const stage = stageRef.current;
    if (!tr || !stage) return;
    if (selectedId) {
      const node = stage.findOne(`#${selectedId}`);
      if (node) {
        tr.nodes([node]);
        tr.getLayer()?.batchDraw();
      }
    } else {
      tr.nodes([]);
      tr.getLayer()?.batchDraw();
    }
  }, [selectedId, imageProps, textPos, fontSize]);

  const handleStageMouseDown = (e: any) => {
    if (e.target === e.target.getStage()) {
      setSelectedId(null);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBgUrl(URL.createObjectURL(file));
  };

  const downloadImage = () => {
    const stage = stageRef.current;
    if (!stage) return;
    const uri = stage.toDataURL({ mimeType: "image/jpeg", quality: 0.92 });
    const link = document.createElement("a");
    link.download = "price-list.jpg";
    link.href = uri;
    link.click();
  };

  const lines = products.map((p) => `${p.name} - $${p.price}`);

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
          <Button onClick={downloadImage}>Descargar</Button>
        </div>
        <Stage
          ref={stageRef}
          width={stageSize.width}
          height={stageSize.height}
          className="border"
          onMouseDown={handleStageMouseDown}
          onTouchStart={handleStageMouseDown}
        >
          <Layer>
            {background && (
              <KonvaImage
                id="bg"
                image={background}
                x={imageProps.x}
                y={imageProps.y}
                width={imageProps.width}
                height={imageProps.height}
                draggable
                ref={imageRef}
                onClick={() => setSelectedId("bg")}
                onTap={() => setSelectedId("bg")}
                onDragEnd={(e) =>
                  setImageProps({
                    ...imageProps,
                    x: e.target.x(),
                    y: e.target.y(),
                  })
                }
                onTransformEnd={() => {
                  const node = imageRef.current;
                  if (!node) return;
                  const scaleX = node.scaleX();
                  const scaleY = node.scaleY();
                  node.scaleX(1);
                  node.scaleY(1);
                  setImageProps({
                    x: node.x(),
                    y: node.y(),
                    width: Math.max(5, node.width() * scaleX),
                    height: Math.max(5, node.height() * scaleY),
                  });
                }}
              />
            )}
            <KonvaText
              id="text"
              ref={textRef}
              x={textPos.x}
              y={textPos.y}
              text={lines.join("\n")}
              fontSize={fontSize}
              fontFamily={fontFamily}
              fill={textColor}
              draggable
              onClick={() => setSelectedId("text")}
              onTap={() => setSelectedId("text")}
              onDragEnd={(e) =>
                setTextPos({ x: e.target.x(), y: e.target.y() })
              }
              onTransformEnd={() => {
                const node = textRef.current;
                if (!node) return;
                const scaleX = node.scaleX();
                node.scaleX(1);
                node.scaleY(1);
                setFontSize(node.fontSize() * scaleX);
                setTextPos({ x: node.x(), y: node.y() });
              }}
            />
            {selectedId && <Transformer ref={transformerRef} rotateEnabled />} 
          </Layer>
        </Stage>
      </div>
    </DashboardLayout>
  );
}

