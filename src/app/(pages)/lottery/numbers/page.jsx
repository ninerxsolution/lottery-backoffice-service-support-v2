'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

export default function LotteryNumbersPage() {
    const [numbers, setNumbers] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [positions, setPositions] = useState(['', '', '', '', '', '']);
    const inputsRef = useRef([]);

    useEffect(() => {
        const loadNumbers = async () => {
            try {
                setIsLoading(true);
                setError(null);
                const res = await fetch('/api/lottery/numbers');
                const json = await res.json();
                if (!res.ok || !json.success) {
                    throw new Error(json.message || 'Failed to fetch numbers');
                }
                setNumbers(json.data || []);
            } catch (err) {
                setError(err.message || 'Failed to load numbers');
            } finally {
                setIsLoading(false);
            }
        };

        loadNumbers();
    }, []);

    const hasAnyPosition = useMemo(() => positions.some((d) => d !== ''), [positions]);

    const filteredNumbers = useMemo(() => {
        if (!hasAnyPosition) return numbers;
        return numbers.filter((n) => {
            const str = String(n).padStart(6, '0');
            for (let i = 0; i < 6; i++) {
                const d = positions[i];
                if (d !== '' && str[i] !== d) return false;
            }
            return true;
        });
    }, [numbers, positions, hasAnyPosition]);

    const setDigitAt = (index, value) => {
        setPositions((prev) => {
            const next = [...prev];
            next[index] = value;
            return next;
        });
    };

    const handleChange = (index, e) => {
        const raw = e.target.value;
        const digit = raw.replace(/\D/g, '').slice(-1) || '';
        setDigitAt(index, digit);
        if (digit && inputsRef.current[index + 1]) {
            inputsRef.current[index + 1].focus();
        }
    };

    const handleKeyDown = (index, e) => {
        if (e.key === 'Backspace' && positions[index] === '') {
            const prevIndex = index - 1;
            if (prevIndex >= 0 && inputsRef.current[prevIndex]) {
                setDigitAt(prevIndex, '');
                inputsRef.current[prevIndex].focus();
                e.preventDefault();
            }
        }
        if (e.key === 'ArrowLeft') {
            const prevIndex = index - 1;
            if (prevIndex >= 0 && inputsRef.current[prevIndex]) {
                inputsRef.current[prevIndex].focus();
                e.preventDefault();
            }
        }
        if (e.key === 'ArrowRight') {
            const nextIndex = index + 1;
            if (nextIndex < 6 && inputsRef.current[nextIndex]) {
                inputsRef.current[nextIndex].focus();
                e.preventDefault();
            }
        }
    };

    const handleClear = () => setPositions(['', '', '', '', '', '']);

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-gray-600">Loading numbers...</div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-red-600">{error}</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto bg-white shadow-lg rounded-lg p-8">
                <div className="mb-6">
                    <h1 className="text-2xl font-bold text-gray-900">Lottery Numbers</h1>
                    <p className="text-gray-600">All values from six_digit_number in lottery_numbers</p>
                    <div className="mt-4 flex flex-col gap-3">
                        <div className="text-sm text-gray-700">
                            Showing <span className="font-mono font-semibold">{filteredNumbers.length}</span> of <span className="font-mono font-semibold">{numbers.length}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            {Array.from({ length: 6 }).map((_, i) => (
                                <input
                                    key={i}
                                    ref={(el) => (inputsRef.current[i] = el)}
                                    value={positions[i]}
                                    onChange={(e) => handleChange(i, e)}
                                    onKeyDown={(e) => handleKeyDown(i, e)}
                                    inputMode="numeric"
                                    pattern="[0-9]"
                                    maxLength={1}
                                    placeholder={String(i)}
                                    className="w-10 text-center px-2 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            ))}
                            {hasAnyPosition && (
                                <button
                                    type="button"
                                    onClick={handleClear}
                                    className="ml-2 text-sm text-gray-600 hover:text-gray-900"
                                >
                                    Clear
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {numbers.length === 0 ? (
                    <div className="text-gray-600">No numbers found.</div>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                        {filteredNumbers.map((num, idx) => (
                            <div key={`${num}-${idx}`} className="px-3 py-2 border rounded text-center font-semibold text-gray-800 bg-gray-50">
                                {String(num).padStart(6, '0')}
                            </div>
                        ))}
                    </div>
                )}

                <details className="mt-8">
                    <summary className="cursor-pointer text-sm text-gray-700">View Raw Data</summary>
                    <pre className="mt-2 text-xs bg-gray-100 p-3 rounded overflow-auto text-black">{JSON.stringify(numbers, null, 2)}</pre>
                </details>
            </div>
        </div>
    );
}


