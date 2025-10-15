"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export default function LotteryImageGenTestPage() {
    const [digits, setDigits] = useState("");
    const [error, setError] = useState("");
    const [layoutMode, setLayoutMode] = useState("single"); // "single" | "stack10"
    const [stackDigits, setStackDigits] = useState(Array.from({ length: 10 }, () => ""));
    const canvasRef = useRef(null);
    const imgRef = useRef(null);

    // Template asset path from public/
    const templateSrc = useMemo(() => "/assets/images/lottery-card-template-v2.jpg", []);

    // Load base image once
    useEffect(() => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = templateSrc;
        img.onload = () => {
            imgRef.current = img;
            // Render initial state if valid
            renderCanvas(digits);
        };
        img.onerror = () => {
            setError("Failed to load template image.");
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [templateSrc]);

    const isSix = (val) => /^[0-9]{6}$/.test(val);
    const isValidSingle = useMemo(() => isSix(digits), [digits]);
    const isValidStack = useMemo(() => stackDigits.every((v) => isSix(v)), [stackDigits]);
    const isValid = layoutMode === "stack10" ? isValidStack : isValidSingle;

    const renderCanvas = useCallback(
        (value) => {
            const canvas = canvasRef.current;
            const img = imgRef.current;
            if (!canvas || !img) return;

            // Base template size
            const baseWidth = img.width || 1000;
            const baseHeight = img.height || 600;

            // Layout sizing
            const isStack = layoutMode === "stack10";
            const values = isStack ? stackDigits : [value];
            const count = values.length;
            const offsetY = Math.floor(baseHeight * 0.315); // vertical overlap step
            const canvasWidth = baseWidth;
            const canvasHeight = isStack ? baseHeight + (count - 1) * offsetY : baseHeight;
            canvas.width = canvasWidth;
            canvas.height = canvasHeight;

            const ctx = canvas.getContext("2d");
            if (!ctx) return;

            // Clear
            ctx.clearRect(0, 0, canvasWidth, canvasHeight);

            // Draw cards (single or stacked)
            for (let i = 0; i < count; i += 1) {
                const yOffset = isStack ? i * offsetY : 0;
                ctx.drawImage(img, 0, yOffset, baseWidth, baseHeight);
            }

            // If valid, draw digits
            // Text style config — tweak to match the template design
            const fontSize = Math.floor(baseWidth * 0.08); // 8% of width
            ctx.font = `bold ${fontSize}px system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial`;
            ctx.fillStyle = "#111111";
            ctx.textBaseline = "middle";
            ctx.backgroundColor = "#ffffff";

            // Positioning within a single card
            const yWithinCard = Math.floor(baseHeight * 0.165);
            const digitSpacing = Math.floor(fontSize * 0.3);

            for (let cardIndex = 0; cardIndex < count; cardIndex += 1) {
                const val = values[cardIndex] || "";
                if (!/^[0-9]{6}$/.test(val)) continue;
                const measures = val.split("").map((d) => ctx.measureText(d).width);
                const totalDigitsWidth = measures.reduce((a, b) => a + b, 0);
                const totalSpacing = digitSpacing * (val.length - 1);
                const totalWidth = totalDigitsWidth + totalSpacing;
                const xStart = Math.floor((baseWidth - totalWidth) / 1.27);
                let x = xStart;
                const cardYOffset = isStack ? cardIndex * offsetY : 0;
                for (let i = 0; i < val.length; i += 1) {
                    const d = val[i];
                    ctx.fillText(d, x, yWithinCard + cardYOffset);
                    x += measures[i] + digitSpacing;
                }
            }
        },
        [layoutMode, stackDigits]
    );

    // Re-render on input change
    useEffect(() => {
        renderCanvas(digits);
    }, [digits, stackDigits, layoutMode, renderCanvas]);

    const onChange = (e) => {
        const raw = e.target.value;
        const next = raw.replace(/\D/g, "").slice(0, 6);
        setDigits(next);
        if (next.length !== 6) setError("Please enter exactly 6 digits.");
        else setError("");
    };

    const onChangeStack = (index) => (e) => {
        const raw = e.target.value;
        const next = raw.replace(/\D/g, "").slice(0, 6);
        setStackDigits((prev) => {
            const copy = prev.slice();
            copy[index] = next;
            return copy;
        });
        if (next.length !== 6) setError("Each card requires exactly 6 digits.");
        else setError("");
    };

    const onDownload = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        if (!isValid) {
            setError("Please enter a valid 6-digit number before downloading.");
            return;
        }
        const link = document.createElement("a");
        const modeSuffix = layoutMode === "stack10" ? "stack10" : "single";
        const namePart = layoutMode === "stack10" ? stackDigits.join("-") : digits;
        link.download = `lottery-${namePart}-v2-${modeSuffix}.png`;
        link.href = canvas.toDataURL("image/png");
        link.click();
    };

    return (
        <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-6xl mx-auto">
                <div className="bg-white shadow-lg rounded-lg p-8">
                    <div style={{ background: "#ffffff" }}>
                        <div style={{ padding: 24, display: "grid", gap: 16, maxWidth: 1024, margin: "0 auto" }}>
                            <h1 style={{ fontSize: 20, fontWeight: 700 }}>Lottery Image Generator</h1>

                            <div style={{ display: "grid", gap: 8, maxWidth: 360 }}>
                                <label htmlFor="digits-input" style={{ fontWeight: 600 }}>
                                    6-digit number
                                </label>
                                {layoutMode === "single" ? (
                                    <input
                                        id="digits-input"
                                        inputMode="numeric"
                                        pattern="[0-9]*"
                                        value={digits}
                                        onChange={onChange}
                                        placeholder="e.g., 123456"
                                        style={{
                                            padding: "10px 12px",
                                            border: "1px solid #ccc",
                                            borderRadius: 8,
                                            fontSize: 16,
                                            width: "100%",
                                        }}
                                        aria-invalid={!isValid}
                                        aria-describedby="digits-help"
                                    />
                                ) : (
                                    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
                                        {stackDigits.map((v, i) => (
                                            <div key={i} style={{ display: "grid", gap: 4 }}>
                                                <label htmlFor={`digits-${i}`} style={{ fontSize: 12, color: "#555" }}>Card {i + 1}</label>
                                                <input
                                                    id={`digits-${i}`}
                                                    inputMode="numeric"
                                                    pattern="[0-9]*"
                                                    value={v}
                                                    onChange={onChangeStack(i)}
                                                    placeholder="000000"
                                                    style={{
                                                        padding: "10px 12px",
                                                        border: "1px solid #ccc",
                                                        borderRadius: 8,
                                                        fontSize: 16,
                                                        width: "100%",
                                                    }}
                                                    aria-invalid={!isSix(v)}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                )}
                                <small id="digits-help" style={{ color: !isValid ? "#b00020" : "#666" }}>
                                    Enter exactly 6 digits. Only numbers are accepted.
                                </small>
                                {error ? (
                                    <div role="alert" style={{ color: "#b00020" }}>
                                        {error}
                                    </div>
                                ) : null}
                                <div role="group" aria-label="Layout" style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 4 }}>
                                    <label style={{ display: "flex", gap: 6, alignItems: "center", cursor: "pointer" }}>
                                        <input
                                            type="radio"
                                            name="layoutMode"
                                            value="single"
                                            checked={layoutMode === "single"}
                                            onChange={() => setLayoutMode("single")}
                                        />
                                        <span>1 image: 1 card</span>
                                    </label>
                                    <label style={{ display: "flex", gap: 6, alignItems: "center", cursor: "pointer" }}>
                                        <input
                                            type="radio"
                                            name="layoutMode"
                                            value="stack10"
                                            checked={layoutMode === "stack10"}
                                            onChange={() => setLayoutMode("stack10")}
                                        />
                                        <span>1 image: 10 cards (stack)</span>
                                    </label>
                                </div>
                                <div style={{ display: "flex", gap: 8 }}>
                                    <button
                                        type="button"
                                        onClick={onDownload}
                                        disabled={!isValid}
                                        style={{
                                            padding: "10px 14px",
                                            background: isValid ? "#111" : "#999",
                                            color: "#fff",
                                            borderRadius: 8,
                                            border: 0,
                                            cursor: isValid ? "pointer" : "not-allowed",
                                        }}
                                    >
                                        Download PNG
                                    </button>
                                </div>
                            </div>

                            <div style={{ display: "grid", gap: 8 }}>
                                <span style={{ fontWeight: 600 }}>Preview</span>
                                <canvas
                                    ref={canvasRef}
                                    style={{
                                        width: "min(100%, 900px)",
                                        height: "auto",
                                        border: "1px solid #eee",
                                        borderRadius: 8,
                                        background: "#fafafa",
                                    }}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}


