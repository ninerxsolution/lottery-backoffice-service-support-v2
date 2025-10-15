'use client';

import { useEffect, useState } from 'react';

export default function LotteryNumbersPage() {
    const [numbers, setNumbers] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

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
                    <div className="mt-3 text-sm text-gray-700">
                        Count: <span className="font-mono font-semibold">{numbers.length}</span>
                    </div>
                </div>

                {numbers.length === 0 ? (
                    <div className="text-gray-600">No numbers found.</div>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                        {numbers.map((num, idx) => (
                            <div key={`${num}-${idx}`} className="px-3 py-2 border rounded text-center font-semibold text-gray-800 bg-gray-50">
                                {String(num).padStart(6, '0')}
                            </div>
                        ))}
                    </div>
                )}

                <details className="mt-8">
                    <summary className="cursor-pointer text-sm text-gray-700">View Raw Data</summary>
                    <pre className="mt-2 text-xs bg-gray-100 p-3 rounded overflow-auto">{JSON.stringify(numbers, null, 2)}</pre>
                </details>
            </div>
        </div>
    );
}


