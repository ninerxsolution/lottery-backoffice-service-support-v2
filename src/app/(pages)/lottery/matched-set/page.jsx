'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export default function LotteryMatchedSetsPage() {
    const [matchedSets, setMatchedSets] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [filters, setFilters] = useState({
        isComplete: null,
        verticalRow: null
    });
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedSet, setSelectedSet] = useState(null);
    const [layoutMode, setLayoutMode] = useState('single'); // 'single' | 'stack10'
    const [selectedNumber, setSelectedNumber] = useState('');
    const [stackNumbers, setStackNumbers] = useState([]);
    const [previewError, setPreviewError] = useState('');
    const canvasRef = useRef(null);
    const imgRef = useRef(null);
    const templateSrc = useMemo(() => '/assets/images/lottery-card-template-v2.jpg', []);

    useEffect(() => {
        loadMatchedSets();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filters.isComplete, filters.verticalRow]);

    const loadMatchedSets = async () => {
        try {
            setIsLoading(true);
            setError(null);

            const params = new URLSearchParams();
            if (filters.isComplete !== null) params.append('is_complete', filters.isComplete);
            if (filters.verticalRow !== null) params.append('vertical_row', filters.verticalRow);

            const res = await fetch(`/api/lottery/matching?${params.toString()}`);
            const json = await res.json();
            if (!res.ok) throw new Error(json?.message || 'Failed to fetch matched sets');

            setMatchedSets(Array.isArray(json?.data) ? json.data : []);
        } catch (e) {
            setError(e.message || 'Unknown error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleFilterChange = (key, value) => {
        setFilters((prev) => ({
            ...prev,
            [key]: value === '' ? null : value
        }));
    };

    const getCompletionColor = (percentage) => {
        if (percentage === 100) return 'bg-green-500';
        if (percentage >= 70) return 'bg-yellow-500';
        if (percentage >= 40) return 'bg-orange-500';
        return 'bg-red-500';
    };

    const getCompletionText = (percentage) => {
        if (percentage === 100) return 'Complete';
        if (percentage >= 70) return 'Mostly Complete';
        if (percentage >= 40) return 'Partially Complete';
        return 'Incomplete';
    };

    const openModal = (setItem) => {
        setSelectedSet(setItem);
        setIsModalOpen(true);
        // Initialize numbers from the set
        try {
            const data = typeof setItem?.matched_numbers === 'string' ? JSON.parse(setItem.matched_numbers) : setItem?.matched_numbers;
            const nums = Array.isArray(data?.positions)
                ? data.positions.filter(p => p.is_filled && Array.isArray(p.matched_numbers)).flatMap(p => p.matched_numbers)
                : [];
            const sixOnly = nums.map(n => n?.toString?.() ?? '').filter(v => /^\d{6}$/.test(v));
            setSelectedNumber(sixOnly[0] || '');
            setStackNumbers(sixOnly.slice(0, 10));
            setLayoutMode('single');
            setPreviewError('');
        } catch (e) {
            setSelectedNumber('');
            setStackNumbers([]);
        }
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setSelectedSet(null);
    };

    const handleGenerateImage = async () => {
        try {
            // Placeholder for image generation trigger
            // e.g., call an API or navigate to a generator page with params
            // await fetch('/api/lottery/image', { method: 'POST', body: JSON.stringify({...}) })
            onDownload();
        } catch (e) {
            console.error(e);
        }
    };

    // Load base image once per mount
    useEffect(() => {
        if (!isModalOpen) return;
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = templateSrc;
        img.onload = () => {
            imgRef.current = img;
            renderCanvas();
        };
        img.onerror = () => setPreviewError('Failed to load template image.');
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isModalOpen, templateSrc]);

    const valuesForRender = useMemo(() => {
        if (layoutMode === 'stack10') return stackNumbers.filter(v => /^\d{6}$/.test(v));
        return /^\d{6}$/.test(selectedNumber) ? [selectedNumber] : [];
    }, [layoutMode, selectedNumber, stackNumbers]);

    const renderCanvas = useCallback(() => {
        const canvas = canvasRef.current;
        const img = imgRef.current;
        if (!canvas || !img) return;

        const isStack = layoutMode === 'stack10';
        const values = valuesForRender;
        const count = Math.max(values.length, 1);

        const baseWidth = img.width || 1000;
        const baseHeight = img.height || 600;
        const offsetY = Math.floor(baseHeight * 0.315);
        const canvasWidth = baseWidth;
        const canvasHeight = isStack ? baseHeight + (count - 1) * offsetY : baseHeight;
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.clearRect(0, 0, canvasWidth, canvasHeight);

        for (let i = 0; i < count; i += 1) {
            const yOffset = isStack ? i * offsetY : 0;
            ctx.drawImage(img, 0, yOffset, baseWidth, baseHeight);
        }

        const fontSize = Math.floor(baseWidth * 0.08);
        ctx.font = `bold ${fontSize}px system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial`;
        ctx.fillStyle = '#111111';
        ctx.textBaseline = 'middle';

        const yWithinCard = Math.floor(baseHeight * 0.165);
        const digitSpacing = Math.floor(fontSize * 0.3);

        for (let cardIndex = 0; cardIndex < values.length; cardIndex += 1) {
            const val = values[cardIndex] || '';
            if (!/^\d{6}$/.test(val)) continue;
            const measures = val.split('').map((d) => ctx.measureText(d).width);
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
    }, [layoutMode, valuesForRender]);

    useEffect(() => {
        if (!isModalOpen) return;
        renderCanvas();
    }, [isModalOpen, renderCanvas, layoutMode, selectedNumber, stackNumbers]);

    const isValid = useMemo(() => {
        if (layoutMode === 'stack10') return valuesForRender.length > 0 && valuesForRender.every(v => /^\d{6}$/.test(v));
        return /^\d{6}$/.test(selectedNumber);
    }, [layoutMode, selectedNumber, valuesForRender]);

    const onDownload = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        if (!isValid) {
            setPreviewError('Provide valid 6-digit number(s) before downloading.');
            return;
        }
        const link = document.createElement('a');
        const modeSuffix = layoutMode === 'stack10' ? 'stack' : 'single';
        const namePart = layoutMode === 'stack10' ? valuesForRender.join('-') : selectedNumber;
        link.download = `lottery-${namePart}-v2-${modeSuffix}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
                <div className="max-w-6xl mx-auto">
                    <div className="bg-white shadow-lg rounded-lg p-8">
                        <div className="flex items-center justify-center">
                            <svg className="animate-spin h-8 w-8 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            <span className="ml-3 text-lg text-gray-600">Loading matched sets...</span>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
                <div className="max-w-6xl mx-auto">
                    <div className="bg-white shadow-lg rounded-lg p-8">
                        <div className="text-center">
                            <div className="flex items-center justify-center mb-4">
                                <svg className="h-8 w-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </div>
                            <h2 className="text-xl font-semibold text-red-800 mb-2">Error Loading Matched Sets</h2>
                            <p className="text-red-600 mb-4">{error}</p>
                            <button
                                onClick={loadMatchedSets}
                                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                            >
                                Retry
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-6xl mx-auto">
                <div className="bg-white shadow-lg rounded-lg p-8 mb-8">
                    <div className="text-center mb-6">
                        <h1 className="text-3xl font-bold text-gray-900 mb-4">
                            Matched Sets
                        </h1>
                        <p className="text-gray-600">All computed vertical rows from the matching process</p>
                    </div>

                    <div className="flex flex-wrap gap-4 justify-center">
                        <select
                            value={filters.isComplete === null ? '' : String(filters.isComplete)}
                            onChange={(e) => handleFilterChange('isComplete', e.target.value)}
                            className="border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="">All Completion Status</option>
                            <option value="true">Complete Only</option>
                            <option value="false">Incomplete Only</option>
                        </select>

                        <select
                            value={filters.verticalRow === null ? '' : String(filters.verticalRow)}
                            onChange={(e) => handleFilterChange('verticalRow', e.target.value)}
                            className="border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="">All Vertical Rows</option>
                            {Array.from({ length: 10 }, (_, i) => (
                                <option key={i} value={i}>Row {i}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="bg-white shadow-lg rounded-lg p-8">
                    {matchedSets.length === 0 ? (
                        <div className="text-center py-8">
                            <p className="text-gray-600">No matched sets found.</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {matchedSets.map((set) => {
                                const matchedNumbersData = typeof set.matched_numbers === 'string'
                                    ? JSON.parse(set.matched_numbers)
                                    : set.matched_numbers;
                                const allNumbers = Array.isArray(matchedNumbersData?.positions)
                                    ? matchedNumbersData.positions
                                        .filter((p) => p.is_filled && Array.isArray(p.matched_numbers))
                                        .flatMap((p) => p.matched_numbers)
                                    : [];
                                const completionPercentage = Math.round((Number(set.matched_count || 0) / 10) * 100);
                                const isComplete = set.is_complete ?? completionPercentage === 100;

                                return (
                                    <button
                                        key={set.id}
                                        type="button"
                                        className="w-full text-left border border-gray-200 hover:border-blue-300 hover:shadow rounded-lg p-4 transition-colors"
                                        onClick={() => openModal(set)}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <div className="text-sm text-gray-500">Vertical Row</div>
                                                    <span className={`px-2 py-0.5 rounded-full text-xs text-white ${getCompletionColor(completionPercentage)}`}>
                                                        {isComplete ? 'Complete' : 'Incomplete'}
                                                    </span>
                                                </div>
                                                <div className="text-lg font-semibold text-gray-900">{set.vertical_row_index}</div>
                                            </div>
                                            <div className="flex flex-wrap gap-2 justify-end max-w-[70%]">
                                                {allNumbers.length === 0 ? (
                                                    <span className="text-xs text-gray-500">No numbers</span>
                                                ) : (
                                                    allNumbers.map((num, idx) => (
                                                        <span key={idx} className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">
                                                            {num}
                                                        </span>
                                                    ))
                                                )}
                                            </div>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
                    <div className="absolute inset-0 bg-black/40" onClick={closeModal} />
                    <div className="relative bg-white w-full h-full max-w-6xl mx-auto rounded-lg shadow-lg p-4 sm:p-6 md:p-8 overflow-hidden flex flex-col">
                        <div className="flex items-start justify-between mb-4 shrink-0">
                            <div>
                                <h3 className="text-xl font-semibold text-gray-900">Generate Image</h3>
                                <p className="text-sm text-gray-600">Vertical Row {selectedSet?.vertical_row_index}</p>
                            </div>
                            <button
                                type="button"
                                className="text-gray-500 hover:text-gray-700"
                                onClick={closeModal}
                                aria-label="Close"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="mb-5 space-y-3 flex-1 overflow-auto pr-1">
                            <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto">
                                {stackNumbers.length === 0 ? (
                                    <span className="text-sm text-gray-500">No numbers</span>
                                ) : (
                                    stackNumbers.map((num, idx) => (
                                        <span key={idx} className={`text-xs px-2 py-1 rounded border ${selectedNumber === num ? 'bg-blue-600 text-white border-blue-600' : 'bg-blue-50 text-blue-800 border-blue-200'}`}
                                            onClick={() => setSelectedNumber(num)}
                                            role="button"
                                        >
                                            {num}
                                        </span>
                                    ))
                                )}
                            </div>

                            <div className="flex items-center gap-6">
                                <label className="inline-flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="radio"
                                        name="layoutMode"
                                        value="single"
                                        checked={layoutMode === 'single'}
                                        onChange={() => setLayoutMode('single')}
                                    />
                                    <span className="text-sm">1 image: 1 card</span>
                                </label>
                                <label className="inline-flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="radio"
                                        name="layoutMode"
                                        value="stack10"
                                        checked={layoutMode === 'stack10'}
                                        onChange={() => setLayoutMode('stack10')}
                                    />
                                    <span className="text-sm">1 image: stacked cards</span>
                                </label>
                            </div>

                            {previewError ? (
                                <div className="text-sm text-red-600">{previewError}</div>
                            ) : null}

                            <div className="pb-2">
                                <canvas
                                    ref={canvasRef}
                                    style={{ width: 'min(100%, 900px)', height: 'auto', borderRadius: 8, border: '1px solid #eee', background: '#fafafa' }}
                                />
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 pt-3 border-t border-gray-100 shrink-0">
                            <button
                                type="button"
                                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
                                onClick={closeModal}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                className={`px-4 py-2 rounded-lg ${isValid ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-gray-300 text-gray-600 cursor-not-allowed'}`}
                                onClick={handleGenerateImage}
                                disabled={!isValid}
                            >
                                Generate Image
                            </button>
                            <button
                                type="button"
                                className={`px-4 py-2 rounded-lg ${isValid ? 'bg-gray-900 hover:bg-black text-white' : 'bg-gray-300 text-gray-600 cursor-not-allowed'}`}
                                onClick={onDownload}
                                disabled={!isValid}
                            >
                                Download PNG
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}


