import { ImageResponse } from "next/og"

export const size = {
  width: 1200,
  height: 630,
}

export const contentType = "image/png"

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          background:
            "radial-gradient(circle at center, #1f2937 0%, #0f172a 45%, #020617 100%)",
          color: "white",
          fontFamily: "Arial, sans-serif",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "repeating-linear-gradient(45deg, rgba(255,255,255,0.03) 0, rgba(255,255,255,0.03) 2px, transparent 2px, transparent 10px)",
          }}
        />

        <div
          style={{
            width: 130,
            height: 130,
            borderRadius: 28,
            border: "6px solid #ffffff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 72,
            fontWeight: 800,
            zIndex: 1,
            marginBottom: 28,
            boxShadow: "0 12px 40px rgba(0, 0, 0, 0.35)",
          }}
        >
          iM
        </div>

        <div
          style={{
            zIndex: 1,
            fontSize: 116,
            fontWeight: 700,
            lineHeight: 1,
            letterSpacing: "-0.04em",
            textShadow: "0 10px 30px rgba(0, 0, 0, 0.45)",
          }}
        >
          iMarket
        </div>
      </div>
    ),
    size,
  )
}
