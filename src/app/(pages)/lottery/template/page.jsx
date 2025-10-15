'use client';

import { useState, useEffect } from 'react';

export default function LotteryTemplatePage() {
    const [templateData, setTemplateData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [editGrid, setEditGrid] = useState(null);



    useEffect(() => {
        const loadTemplateData = async () => {
            try {
                setIsLoading(true);
                setError(null);

                const response = await fetch('/api/lottery/template');
                const result = await response.json();

                if (!response.ok) {
                    throw new Error(result.message || 'Failed to fetch template data');
                }

                if (!result.success) {
                    throw new Error(result.message || 'API returned unsuccessful response');
                }

                setTemplateData(result.data);
                // initialize edit buffer from loaded data
                const initial = Array.isArray(result.data?.columns) ? result.data.columns : result.data;
                if (Array.isArray(initial)) {
                    setEditGrid(initial.map(row => row.slice()));
                }
            } catch (err) {
                setError(err.message || 'Failed to load template data from database');
                console.error('Error loading template data:', err);
            } finally {
                setIsLoading(false);
            }
        };

        loadTemplateData();
    }, []);

    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState(null);
    const [saveOk, setSaveOk] = useState(false);
    const [focusedCell, setFocusedCell] = useState({ row: null, col: null, prev: '' });

    const getGrid = () => {
        if (editGrid) return editGrid;
        if (!templateData) return null;
        return Array.isArray(templateData?.columns) ? templateData.columns : templateData;
    };

    const sanitizeInputDigits = (value) => String(value || '').replace(/\D/g, '').slice(0, 2);

    const isGridValid = (grid) => {
        if (!Array.isArray(grid) || grid.length !== 10 || !grid.every(r => Array.isArray(r) && r.length === 10)) return false;
        const flat = grid.flat();
        if (!flat.every(v => /^\d{2}$/.test(v))) return false;
        const set = new Set(flat);
        return set.size === flat.length;
    };

    const persistTemplate = async (gridArg) => {
        try {
            setSaving(true);
            setSaveError(null);
            const grid = gridArg || getGrid();
            // Validate strictly: all cells must already be two digits and unique
            if (!isGridValid(grid)) {
                setSaveError('Template must be 10x10 with unique 00-99 values');
                return; // do not call API, keep editing state
            }
            const response = await fetch('/api/lottery/template', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ columns: grid })
            });
            const result = await response.json();
            if (!response.ok || !result.success) {
                setSaveError(result.message || 'Failed to save template');
                return;
            }
            // commit normalized grid into both states
            setEditGrid(grid.map(row => row.slice()));
            if (templateData?.columns) {
                setTemplateData({ ...templateData, columns: grid });
            } else {
                setTemplateData(grid);
            }
            setSaveOk(true);
            setTimeout(() => setSaveOk(false), 1500);
        } catch (e) {
            setSaveError(e.message);
        } finally {
            setSaving(false);
        }
    };

    const handleCellChange = (rowIndex, colIndex, value) => {
        setEditGrid(prev => {
            const base = prev ? prev : (Array.isArray(templateData?.columns) ? templateData.columns : templateData);
            const copy = base.map(row => row.slice());
            // columns-first storage: grid[col][row]
            copy[colIndex][rowIndex] = sanitizeInputDigits(value);
            return copy;
        });
    };

    const handleCellFocus = (rowIndex, colIndex) => {
        const grid = getGrid();
        // columns-first storage
        setFocusedCell({ row: rowIndex, col: colIndex, prev: (grid[colIndex][rowIndex] || '') });
    };

    const applySwapIfDuplicate = (grid, rowIndex, colIndex) => {
        // columns-first storage
        const current = grid[colIndex][rowIndex];
        if (!/^\d{2}$/.test(current)) return grid;
        // find duplicate position excluding current cell
        for (let r = 0; r < 10; r++) {
            for (let c = 0; c < 10; c++) {
                if (r === rowIndex && c === colIndex) continue;
                if (grid[c][r] === current) {
                    // swap duplicate with previous value if valid
                    const prevVal = (focusedCell.prev || '').padStart(2, '0');
                    grid[c][r] = /^\d{2}$/.test(prevVal) ? prevVal : grid[c][r];
                    return grid;
                }
            }
        }
        return grid;
    };

    const commitCell = async (rowIndex, colIndex) => {
        // build normalized two-digit grid and swap duplicates
        const base = getGrid();
        // columns-first: normalize each cell
        let next = base.map(col => col.map(v => v.padStart(2, '0')));
        next = applySwapIfDuplicate(next, rowIndex, colIndex);
        setEditGrid(next.map(col => col.slice()));
        await persistTemplate(next);
    };

    const handleCellCommitKey = async (e, rowIndex, colIndex) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const target = e.currentTarget; // capture before async
            await commitCell(rowIndex, colIndex);
            if (target && typeof target.blur === 'function') {
                target.blur();
            }
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
                <div className="max-w-4xl mx-auto">
                    <div className="bg-white shadow-lg rounded-lg p-8">
                        <div className="flex items-center justify-center">
                            <svg className="animate-spin h-8 w-8 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            <span className="ml-3 text-lg text-gray-600">Loading template data...</span>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
                <div className="max-w-4xl mx-auto">
                    <div className="bg-white shadow-lg rounded-lg p-8">
                        <div className="text-center">
                            <div className="flex items-center justify-center mb-4">
                                <svg className="h-8 w-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </div>
                            <h2 className="text-xl font-semibold text-red-800 mb-2">Error Loading Template</h2>
                            <p className="text-red-600">{error}</p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-6xl mx-auto">
                <div className="bg-white shadow-lg rounded-lg p-8">
                    {/* Header */}
                    <div className="text-center mb-8">
                        <h1 className="text-3xl font-bold text-gray-900 mb-4">
                            Lottery Template
                        </h1>
                        <p className="text-gray-600">
                            10x10 Grid Template from lottery_templates table
                        </p>
                        {saveError && (
                            <div className="mt-4 inline-block bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded">
                                {saveError}
                            </div>
                        )}
                        {saveOk && !saveError && (
                            <div className="mt-4 inline-block bg-green-50 border border-green-200 text-green-700 px-4 py-2 rounded">
                                Saved
                            </div>
                        )}
                    </div>

                    {/* Template Grid */}
                    {getGrid() && (
                        <div className="flex justify-center">
                            <div className="grid grid-cols-10 gap-2 p-6 bg-gray-100 rounded-lg">
                                {/* Render columns as vertical; iterate rows first, then columns */}
                                {Array.from({ length: 10 }, (_, rowIndex) => (
                                    Array.from({ length: 10 }, (_, colIndex) => {
                                        const grid = getGrid();
                                        const value = grid[colIndex][rowIndex];
                                        return (
                                        <input
                                            key={`${rowIndex}-${colIndex}`}
                                            type="text"
                                            value={value}
                                            onChange={(e) => handleCellChange(rowIndex, colIndex, e.target.value)}
                                            onFocus={() => handleCellFocus(rowIndex, colIndex)}
                                            onBlur={() => commitCell(rowIndex, colIndex)}
                                            onKeyDown={(e) => handleCellCommitKey(e, rowIndex, colIndex)}
                                            placeholder="00"
                                            maxLength={2}
                                            className={`w-12 h-12 text-center text-lg font-semibold bg-white border-2 rounded-lg focus:outline-none transition-colors duration-200 ${/^(\d{2})$/.test(value) ? 'border-gray-300 focus:border-blue-500' : 'border-red-400 focus:border-red-500'}`}
                                            style={{
                                                gridRow: rowIndex + 1,
                                                gridColumn: colIndex + 1
                                            }}
                                        />
                                        );
                                    })
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Template Information */}
                    <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
                        <h3 className="text-lg font-semibold text-blue-900 mb-4">
                            Template Information
                        </h3>
                        <div className="text-blue-800 space-y-2">
                            <p><strong>Data Source:</strong> lottery_templates table</p>
                            <p><strong>Field:</strong> columns (JSON format)</p>
                            <p><strong>Grid Size:</strong> 10x10 (100 cells total)</p>
                            <p><strong>Data Type:</strong> String values (00-99)</p>
                            <p><strong>Status:</strong> {saving ? 'Saving...' : 'Idle'}</p>
                        </div>
                    </div>

                    {/* Raw Data Display (for debugging) */}
                    <details className="mt-6">
                        <summary className="cursor-pointer text-sm font-medium text-gray-700 hover:text-gray-900">
                            View Raw JSON Data
                        </summary>
                        <div className="mt-2 bg-gray-100 rounded p-4">
                            <pre className="text-xs text-gray-800 overflow-auto">
                                {JSON.stringify(templateData, null, 2)}
                            </pre>
                        </div>
                    </details>
                </div>
            </div>
        </div>
    );
}
