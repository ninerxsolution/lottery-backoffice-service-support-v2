'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

export default function LotteryNumbersPage() {
    const [numbers, setNumbers] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [positions, setPositions] = useState(['', '', '', '', '', '']);
    const [rawInput, setRawInput] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitMessage, setSubmitMessage] = useState(null);
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

    const handleSubmit = async () => {
        const value = rawInput.trim();
        setSubmitMessage(null);
        if (!value) {
            setSubmitMessage({ type: 'error', text: 'กรุณาใส่สตริงรูปแบบ YY-DS-SN-XXXXXX-BBBB' });
            return;
        }
        try {
            setIsSubmitting(true);
            const res = await fetch('/api/lottery/numbers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ raw: value })
            });
            const json = await res.json();
            if (!res.ok || !json.success) {
                if (res.status === 409) {
                    throw new Error('หมายเลขชุดนี้มีอยู่ในระบบแล้ว (ปี-งวด-เซ็ต-หมายเลข-เล่ม)');
                }
                throw new Error(json.message || 'เพิ่มข้อมูลไม่สำเร็จ');
            }
            setSubmitMessage({ type: 'success', text: 'เพิ่มข้อมูลสำเร็จ' });
            setRawInput('');
            // refresh list
            try {
                const res2 = await fetch('/api/lottery/numbers');
                const json2 = await res2.json();
                if (res2.ok && json2.success) {
                    setNumbers(json2.data || []);
                }
            } catch {}
        } catch (e) {
            setSubmitMessage({ type: 'error', text: e.message || 'เพิ่มข้อมูลไม่สำเร็จ' });
        } finally {
            setIsSubmitting(false);
        }
    };

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
                    <div className="mt-4 flex flex-col gap-2">
                        <label className="text-sm text-gray-700">เพิ่มด้วยสตริงสแกน (รูปแบบ: YY-DS-SN-XXXXXX-BBBB)</label>
                        <div className="flex gap-2 items-center">
                            <input
                                type="text"
                                value={rawInput}
                                onChange={(e) => setRawInput(e.target.value)}
                                placeholder="เช่น 67-48-09-763401-5755"
                                className="flex-1 px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <button
                                type="button"
                                onClick={handleSubmit}
                                disabled={isSubmitting}
                                className={`px-4 py-2 rounded text-white ${isSubmitting ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'}`}
                            >
                                {isSubmitting ? 'กำลังบันทึก...' : 'เพิ่ม'}
                            </button>
                        </div>
                        {submitMessage && (
                            <div className={submitMessage.type === 'success' ? 'text-green-600 text-sm' : 'text-red-600 text-sm'}>
                                {submitMessage.text}
                            </div>
                        )}
                    </div>
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


