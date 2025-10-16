'use client';

import { useState, useEffect } from 'react';

export default function LotteryMatchingPage() {
    const [templateData, setTemplateData] = useState(null);
    const [lotteryNumbers, setLotteryNumbers] = useState([]);
    const [matchedSets, setMatchedSets] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState(null);
    const [selectedTemplate, setSelectedTemplate] = useState(1);
    const [filters, setFilters] = useState({
        isComplete: null,
        verticalRow: null
    });
    const [unusedNumbers, setUnusedNumbers] = useState([]);

    const computeUnusedNumbers = (allNumbers, sets) => {
        if (!Array.isArray(allNumbers) || !Array.isArray(sets)) return [];
        try {
            const matchedSet = new Set();
            for (const set of sets) {
                const matchedNumbersData = typeof set?.matched_numbers === 'string'
                    ? JSON.parse(set.matched_numbers)
                    : set?.matched_numbers;
                const positions = matchedNumbersData?.positions || [];
                for (const position of positions) {
                    if (position?.is_filled && Array.isArray(position.matched_numbers)) {
                        for (const num of position.matched_numbers) {
                            matchedSet.add(num);
                        }
                    }
                }
            }
            return allNumbers.filter((n) => !matchedSet.has(n));
        } catch (e) {
            console.error('Failed to compute unused numbers:', e);
            return [];
        }
    };

    useEffect(() => {
        loadInitialData();
    }, []);

    useEffect(() => {
        loadMatchedSets();
    }, [filters]);

    const loadInitialData = async () => {
        try {
            setIsLoading(true);
            setError(null);

            // Load template data
            const templateResponse = await fetch('/api/lottery/template');
            const templateResult = await templateResponse.json();

            if (!templateResponse.ok) {
                throw new Error(templateResult.message || 'Failed to fetch template data');
            }

            setTemplateData(templateResult.data);

            // Load lottery numbers
            const numbersResponse = await fetch('/api/lottery/numbers');
            const numbersResult = await numbersResponse.json();

            if (!numbersResponse.ok) {
                throw new Error(numbersResult.message || 'Failed to fetch lottery numbers');
            }

            setLotteryNumbers(numbersResult.data);

        } catch (err) {
            setError(err.message || 'Failed to load initial data');
            console.error('Error loading initial data:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const loadMatchedSets = async () => {
        try {
            const params = new URLSearchParams();
            if (filters.isComplete !== null) {
                params.append('is_complete', filters.isComplete);
            }
            if (filters.verticalRow !== null) {
                params.append('vertical_row', filters.verticalRow);
            }

            const response = await fetch(`/api/lottery/matching?${params.toString()}`);
            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || 'Failed to fetch matched sets');
            }

            const data = result.data || [];
            setMatchedSets(data);

            // Fallback compute of unused numbers if API didn't provide them
            if (!unusedNumbers?.length) {
                const computed = computeUnusedNumbers(lotteryNumbers, data);
                if (computed.length) {
                    setUnusedNumbers(computed);
                }
            }

        } catch (err) {
            console.error('Error loading matched sets:', err);
        }
    };

    const handleProcessMatching = async () => {
        try {
            setIsProcessing(true);
            setError(null);

            const response = await fetch('/api/lottery/matching', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    templateId: selectedTemplate,
                    lotteryNumbers: lotteryNumbers
                })
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || 'Failed to process matching');
            }

            // Store unused numbers and reload matched sets
            if (result?.data?.unused_numbers) {
                setUnusedNumbers(result.data.unused_numbers);
            }

            await loadMatchedSets();

        } catch (err) {
            setError(err.message || 'Failed to process matching');
            console.error('Error processing matching:', err);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleFilterChange = (filterType, value) => {
        setFilters(prev => ({
            ...prev,
            [filterType]: value === '' ? null : value
        }));
    };

    const handleReset = async () => {
        try {
            setError(null);
            setFilters({ isComplete: null, verticalRow: null });

            // Clear database
            const response = await fetch('/api/lottery/matching', {
                method: 'DELETE'
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || 'Failed to clear database');
            }

            // Clear UI state
            setMatchedSets([]);
            setUnusedNumbers([]);

        } catch (err) {
            setError(err.message || 'Failed to reset data');
            console.error('Error resetting data:', err);
        }
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
                            <span className="ml-3 text-lg text-gray-600">Loading matching data...</span>
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
                            <h2 className="text-xl font-semibold text-red-800 mb-2">Error Loading Data</h2>
                            <p className="text-red-600 mb-4">{error}</p>
                            <button
                                onClick={loadInitialData}
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
                {/* Header */}
                <div className="bg-white shadow-lg rounded-lg p-8 mb-8">
                    <div className="text-center mb-6">
                        <h1 className="text-3xl font-bold text-gray-900 mb-4">
                            Lottery Number Matching
                        </h1>
                        <p className="text-gray-600">
                            Match lottery numbers against template vertical rows
                        </p>
                    </div>

                    {/* Process Button */}
                    <div className="flex justify-center mb-6 gap-3">
                        <button
                            onClick={handleProcessMatching}
                            disabled={isProcessing || !lotteryNumbers.length}
                            className="bg-blue-600 text-white px-8 py-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center"
                        >
                            {isProcessing ? (
                                <>
                                    <svg className="animate-spin h-5 w-5 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Processing...
                                </>
                            ) : (
                                'Process Matching'
                            )}
                        </button>
                        <button
                            onClick={handleReset}
                            disabled={isProcessing}
                            className="bg-gray-200 text-gray-900 px-6 py-3 rounded-lg hover:bg-gray-300 disabled:bg-gray-200 disabled:cursor-not-allowed transition-colors"
                        >
                            Reset
                        </button>
                    </div>

                    {/* Statistics */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
                            <div className="text-2xl font-bold text-blue-900">{lotteryNumbers.length}</div>
                            <div className="text-blue-700">Total Lottery Numbers</div>
                        </div>
                        <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                            <div className="text-2xl font-bold text-green-900">
                                {matchedSets.filter(set => set.is_complete).length}
                            </div>
                            <div className="text-green-700">Complete Rows</div>
                        </div>
                        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
                            <div className="text-2xl font-bold text-yellow-900">
                                {matchedSets.filter(set => !set.is_complete).length}
                            </div>
                            <div className="text-yellow-700">Incomplete Rows</div>
                        </div>
                        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 text-center">
                            <div className="text-2xl font-bold text-orange-900">{unusedNumbers.length}</div>
                            <div className="text-orange-700">Unused Numbers</div>
                        </div>
                    </div>

                    {/* Filters */}
                    <div className="flex flex-wrap gap-4 justify-center">
                        <select
                            value={filters.isComplete === null ? '' : filters.isComplete.toString()}
                            onChange={(e) => handleFilterChange('isComplete', e.target.value)}
                            className="border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="">All Completion Status</option>
                            <option value="true">Complete Only</option>
                            <option value="false">Incomplete Only</option>
                        </select>

                        <select
                            value={filters.verticalRow === null ? '' : filters.verticalRow.toString()}
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

                {/* Template Preview */}
                {(() => {
                    const grid = Array.isArray(templateData?.columns)
                        ? templateData.columns
                        : Array.isArray(templateData)
                            ? templateData
                            : null;
                    return grid;
                })() && (
                        <div className="bg-white shadow-lg rounded-lg p-8 mb-8">
                            <h2 className="text-xl font-semibold text-gray-900 mb-4">Template Preview</h2>
                            <div className="flex justify-center">
                                <div className="grid grid-cols-10 gap-1 p-4 bg-gray-100 rounded-lg">
                                    {(() => {
                                        const grid = Array.isArray(templateData?.columns) ? templateData.columns : templateData;
                                        return Array.from({ length: 10 }, (_, rowIndex) => (
                                            Array.from({ length: 10 }, (_, colIndex) => (
                                                <div
                                                    key={`${rowIndex}-${colIndex}`}
                                                    className="w-8 h-8 text-center text-sm font-semibold bg-white border border-gray-300 rounded flex items-center justify-center"
                                                >
                                                    {grid[colIndex][rowIndex]}
                                                </div>
                                            ))
                                        ));
                                    })()}
                                </div>
                            </div>
                            <p className="text-sm text-gray-600 mt-4 text-center">
                                Each column represents a vertical row for matching
                            </p>
                        </div>
                    )}

                {/* Unused Numbers Display */}
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-6 mb-8">
                    <h3 className="text-lg font-semibold text-orange-900 mb-4">
                        Unused Numbers ({unusedNumbers.length} numbers remaining)
                    </h3>
                    {unusedNumbers.length === 0 ? (
                        <p className="text-sm text-orange-700">
                            All numbers were used in the matching process.
                        </p>
                    ) : (
                        <>
                            <p className="text-sm text-orange-700 mb-3">
                                These lottery numbers were not used in the matching process:
                            </p>
                            <div className="flex flex-wrap gap-2 max-h-60 overflow-y-auto">
                                {unusedNumbers.map((number, index) => (
                                    <span
                                        key={index}
                                        className="bg-orange-100 text-orange-800 text-sm px-3 py-1 rounded border border-orange-300"
                                    >
                                        {number}
                                    </span>
                                ))}
                            </div>
                        </>
                    )}
                </div>

                {/* Matched Sets Results */}
                <div className="bg-white shadow-lg rounded-lg p-8">
                    <h2 className="text-xl font-semibold text-gray-900 mb-6">Matching Results</h2>
                    <div className="grid grid-cols-2 gap-4">
                        {matchedSets.length === 0 ? (
                            <div className="col-span-2 text-center py-8">
                                <p className="text-gray-600">No matched sets found. Click "Process Matching" to generate results.</p>
                            </div>
                        ) : (
                            matchedSets.map((set) => {
                                const completionPercentage = Math.round((set.matched_count / 10) * 100);
                                const matchedNumbersData = typeof set.matched_numbers === 'string'
                                    ? JSON.parse(set.matched_numbers)
                                    : set.matched_numbers;

                                return (
                                    <div key={set.id} className="border border-gray-200 rounded-lg p-6">
                                        <div className="flex items-center justify-between mb-4">
                                            <h3 className="text-lg font-semibold text-gray-900">
                                                Vertical Row {set.vertical_row_index}
                                            </h3>
                                            <div className="flex items-center space-x-2">
                                                <span className={`px-3 py-1 rounded-full text-sm font-medium text-white ${getCompletionColor(completionPercentage)}`}>
                                                    {getCompletionText(completionPercentage)}
                                                </span>
                                                <span className="text-sm text-gray-600">
                                                    {set.matched_count}/10 positions
                                                </span>
                                            </div>
                                        </div>

                                        <div className="mb-4">
                                            <div className="w-full bg-gray-200 rounded-full h-2">
                                                <div
                                                    className={`h-2 rounded-full ${getCompletionColor(completionPercentage)}`}
                                                    style={{ width: `${completionPercentage}%` }}
                                                ></div>
                                            </div>
                                            <p className="text-sm text-gray-600 mt-1">
                                                {completionPercentage}% complete
                                            </p>
                                        </div>

                                        {/* Position Details */}
                                        <div className="grid grid-cols-5 gap-2">
                                            {matchedNumbersData?.positions?.map((position, index) => (
                                                <div key={index} className={`p-3 rounded-lg border-2 ${position.is_filled ? 'border-green-500 bg-green-50' : 'border-gray-300 bg-gray-50'}`}>
                                                    <div className="text-center">
                                                        <div className="text-sm font-medium text-gray-900">
                                                            Pos {position.position}
                                                        </div>
                                                        <div className="text-xs text-gray-600 mb-1">
                                                            Template: {position.template_value}
                                                        </div>
                                                        <div className="text-xs">
                                                            {position.is_filled ? (
                                                                <span className="text-green-600 font-medium">
                                                                    {position.matched_numbers.length} match(es)
                                                                </span>
                                                            ) : (
                                                                <span className="text-gray-500">No match</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            )) || (
                                                    <div className="col-span-5 text-center text-gray-500 py-4">
                                                        No position data available
                                                    </div>
                                                )}
                                        </div>

                                        {/* Matched Numbers List */}
                                        {matchedNumbersData?.positions?.some(pos => pos.is_filled) && (
                                            <div className="mt-4">
                                                <h4 className="text-sm font-medium text-gray-900 mb-2">Matched Numbers:</h4>
                                                <div className="flex flex-wrap gap-2">
                                                    {matchedNumbersData.positions
                                                        .filter(pos => pos.is_filled)
                                                        .map((position, posIndex) =>
                                                            position.matched_numbers.map((number, numIndex) => (
                                                                <span
                                                                    key={`${posIndex}-${numIndex}`}
                                                                    className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded"
                                                                >
                                                                    {number} (Pos {position.position})
                                                                </span>
                                                            ))
                                                        )
                                                    }
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
