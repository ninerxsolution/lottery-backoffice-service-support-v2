"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export default function LotteryImageGenTestPage() {
    const [digits, setDigits] = useState("");
    const [error, setError] = useState("");
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

    const isValid = useMemo(() => /^[0-9]{6}$/.test(digits), [digits]);

    const renderCanvas = useCallback(
        (value) => {
            const canvas = canvasRef.current;
            const img = imgRef.current;
            if (!canvas || !img) return;

            // Define canvas size based on template
            const width = img.width || 1000;
            const height = img.height || 600;
            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext("2d");
            if (!ctx) return;

            // Draw template background
            ctx.clearRect(0, 0, width, height);
            ctx.drawImage(img, 0, 0, width, height);

            // If valid, draw digits
            if (/^[0-9]{6}$/.test(value)) {
                // Text style config — tweak to match the template design
                const fontSize = Math.floor(width * 0.08); // 8% of width
                ctx.font = `bold ${fontSize}px system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial`;
                ctx.fillStyle = "#111111";
                ctx.textBaseline = "middle";
                ctx.backgroundColor = "#ffffff";

                // Positioning: center horizontally near lower-third
                const y = Math.floor(height * 0.165);

                // Measure total width by placing digits with letter spacing
                const digitSpacing = Math.floor(fontSize * 0.3);
                const measures = value.split("").map((d) => ctx.measureText(d).width);
                const totalDigitsWidth = measures.reduce((a, b) => a + b, 0);
                const totalSpacing = digitSpacing * (value.length - 1);
                const totalWidth = totalDigitsWidth + totalSpacing;
                let x = Math.floor((width - totalWidth) / 1.27);

                for (let i = 0; i < value.length; i += 1) {
                    const d = value[i];
                    ctx.fillText(d, x, y);
                    x += measures[i] + digitSpacing;
                }
            }
        },
        []
    );

    // Re-render on digits change
    useEffect(() => {
        renderCanvas(digits);
    }, [digits, renderCanvas]);

    const onChange = (e) => {
        const raw = e.target.value;
        const next = raw.replace(/\D/g, "").slice(0, 6);
        setDigits(next);
        if (next.length !== 6) setError("Please enter exactly 6 digits.");
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
        link.download = `lottery-${digits}-v2.jpeg`;
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
                                <small id="digits-help" style={{ color: !isValid ? "#b00020" : "#666" }}>
                                    Enter exactly 6 digits. Only numbers are accepted.
                                </small>
                                {error ? (
                                    <div role="alert" style={{ color: "#b00020" }}>
                                        {error}
                                    </div>
                                ) : null}
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


