'use client';

import { useState, useEffect } from 'react';

export default function LotteryShelfPage() {
    const [shelves, setShelves] = useState([]);
    const [readyForShelf, setReadyForShelf] = useState([]);
    const [shelfItems, setShelfItems] = useState([]);
    const [selectedSets, setSelectedSets] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState(null);
    const [successMessage, setSuccessMessage] = useState(null);
    
    // Form state for moving to shelf
    const [moveForm, setMoveForm] = useState({
        shelfId: '',
        itemName: '',
        itemDescription: '',
        price: ''
    });

    useEffect(() => {
        loadInitialData();
    }, []);

    const loadInitialData = async () => {
        try {
            setIsLoading(true);
            setError(null);
            
            await Promise.all([
                loadShelves(),
                loadReadyForShelf(),
                loadShelfItems()
            ]);
        } catch (err) {
            setError(err.message || 'Failed to load initial data');
            console.error('Error loading initial data:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const loadShelves = async () => {
        try {
            const response = await fetch('/api/lottery/shelf');
            const result = await response.json();
            
            if (!response.ok) {
                throw new Error(result.message || 'Failed to fetch shelves');
            }
            
            console.log('Shelves loaded:', result.data);
            setShelves(result.data || []);
        } catch (err) {
            console.error('Error loading shelves:', err);
            setError(`ไม่สามารถโหลดข้อมูล shelves: ${err.message}`);
        }
    };

    const loadReadyForShelf = async () => {
        try {
            const response = await fetch('/api/lottery/matching?is_complete=true');
            const result = await response.json();
            
            if (!response.ok) {
                throw new Error(result.message || 'Failed to fetch ready sets');
            }
            
            // Filter only sets that are complete and ready for shelf
            const readySets = (result.data || []).filter(set => 
                set.is_complete && set.matched_count >= 10
            );
            setReadyForShelf(readySets);
            console.log(`Loaded ${readySets.length} ready sets for shelf`);
        } catch (err) {
            console.error('Error loading ready for shelf:', err);
            setError(`ไม่สามารถโหลดข้อมูล sets ที่พร้อมย้าย: ${err.message}`);
        }
    };

    const loadShelfItems = async () => {
        try {
            const response = await fetch('/api/lottery/shelf/items');
            const result = await response.json();
            
            if (!response.ok) {
                throw new Error(result.message || 'Failed to fetch shelf items');
            }
            
            setShelfItems(result.data || []);
            console.log(`Loaded ${result.data?.length || 0} shelf items`);
        } catch (err) {
            console.error('Error loading shelf items:', err);
            setError(`ไม่สามารถโหลดข้อมูล shelf items: ${err.message}`);
        }
    };

    const handleSetSelection = (setId, checked) => {
        if (checked) {
            setSelectedSets([...selectedSets, setId]);
        } else {
            setSelectedSets(selectedSets.filter(id => id !== setId));
        }
    };

    const createSampleShelves = async () => {
        try {
            setIsProcessing(true);
            setError(null);
            setSuccessMessage(null);

            const sampleShelves = [
                { shelf_name: 'Shelf A - Premium Sets', shelf_description: 'Premium lottery sets ready for sale', max_capacity: 50 },
                { shelf_name: 'Shelf B - Standard Sets', shelf_description: 'Standard lottery sets ready for sale', max_capacity: 100 },
                { shelf_name: 'Shelf C - Budget Sets', shelf_description: 'Budget lottery sets ready for sale', max_capacity: 150 }
            ];

            for (const shelf of sampleShelves) {
                const response = await fetch('/api/lottery/shelf', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(shelf)
                });

                if (!response.ok) {
                    const result = await response.json();
                    throw new Error(result.message || 'Failed to create shelf');
                }
            }

            setSuccessMessage('Sample shelves created successfully!');
            await loadShelves();

        } catch (err) {
            setError(err.message || 'Failed to create sample shelves');
            console.error('Error creating sample shelves:', err);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleMoveToShelf = async () => {
        if (selectedSets.length === 0) {
            setError('กรุณาเลือกอย่างน้อย 1 set ที่ต้องการย้ายไป shelf');
            return;
        }

        if (!moveForm.shelfId || !moveForm.itemName) {
            setError('กรุณาเลือก shelf และใส่ชื่อ item');
            return;
        }

        try {
            setIsProcessing(true);
            setError(null);
            setSuccessMessage(null);

            const response = await fetch('/api/lottery/shelf/move-to-shelf', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    matchedSetIds: selectedSets,
                    shelfId: parseInt(moveForm.shelfId),
                    itemName: moveForm.itemName,
                    itemDescription: moveForm.itemDescription,
                    price: moveForm.price ? parseFloat(moveForm.price) : null
                })
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || 'Failed to move sets to shelf');
            }

            setSuccessMessage(`ย้าย ${selectedSets.length} sets ไป shelf สำเร็จ!`);
            setSelectedSets([]);
            setMoveForm({ shelfId: '', itemName: '', itemDescription: '', price: '' });
            
            // Reload data
            await Promise.all([
                loadReadyForShelf(),
                loadShelfItems(),
                loadShelves()
            ]);

        } catch (err) {
            setError(err.message || 'เกิดข้อผิดพลาดในการย้าย sets ไป shelf');
            console.error('Error moving to shelf:', err);
        } finally {
            setIsProcessing(false);
        }
    };

    const getUsageColor = (percentage) => {
        if (percentage >= 90) return 'bg-red-500';
        if (percentage >= 70) return 'bg-yellow-500';
        return 'bg-green-500';
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'available': return 'bg-green-100 text-green-800';
            case 'reserved': return 'bg-yellow-100 text-yellow-800';
            case 'sold': return 'bg-gray-100 text-gray-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
                <div className="max-w-7xl mx-auto">
                    <div className="bg-white shadow-lg rounded-lg p-8">
                        <div className="flex items-center justify-center">
                            <svg className="animate-spin h-8 w-8 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            <span className="ml-3 text-lg text-gray-600">Loading shelf data...</span>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
                <div className="max-w-7xl mx-auto">
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
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="bg-white shadow-lg rounded-lg p-8 mb-8">
                    <div className="text-center mb-6">
                        <h1 className="text-3xl font-bold text-gray-900 mb-4">
                            Lottery Shelf Management
                        </h1>
                        <p className="text-gray-600 mb-4">
                            Manage complete lottery sets ready for sale
                        </p>
                        <div className="flex justify-center gap-4">
                            <button
                                onClick={createSampleShelves}
                                disabled={isProcessing}
                                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                            >
                                {isProcessing ? 'Creating...' : 'Create Sample Shelves'}
                            </button>
                            <button
                                onClick={loadInitialData}
                                className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700 transition-colors"
                            >
                                Refresh Data
                            </button>
                        </div>
                    </div>

                    {/* Success Message */}
                    {successMessage && (
                        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                            <div className="flex items-center">
                                <svg className="h-5 w-5 text-green-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                <div className="text-green-800">{successMessage}</div>
                            </div>
                        </div>
                    )}

                    {/* Create Sample Shelves Button */}
                    {shelves.length === 0 && (
                        <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="text-yellow-800 font-medium">No shelves found</h3>
                                    <p className="text-yellow-700 text-sm">You need to create shelves before you can move sets to them.</p>
                                </div>
                                <button
                                    onClick={createSampleShelves}
                                    className="bg-yellow-600 text-white px-4 py-2 rounded hover:bg-yellow-700 transition-colors"
                                >
                                    Create Sample Shelves
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Error Message */}
                    {error && (
                        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                            <div className="flex items-center">
                                <svg className="h-5 w-5 text-red-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                                <div className="text-red-800">{error}</div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Left Panel - Ready for Shelf */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                        <h3 className="text-lg font-semibold text-blue-900 mb-4">
                            Ready for Shelf ({readyForShelf.length} sets)
                        </h3>
                        
                        {readyForShelf.length === 0 ? (
                            <p className="text-sm text-blue-700">
                                ไม่มี complete sets ที่พร้อมย้ายไป shelf กรุณาทำการ matching ก่อน
                            </p>
                        ) : (
                            <>
                                <div className="space-y-2 mb-4 max-h-60 overflow-y-auto">
                                    {readyForShelf.map(set => (
                                        <div key={set.id} className="flex items-center justify-between p-3 bg-white rounded border">
                                            <div>
                                                <span className="font-medium">Row {set.vertical_row_index}</span>
                                                <span className="text-sm text-gray-600 ml-2">Complete Set ({set.matched_count}/10)</span>
                                            </div>
                                            <input
                                                type="checkbox"
                                                checked={selectedSets.includes(set.id)}
                                                onChange={(e) => handleSetSelection(set.id, e.target.checked)}
                                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                            />
                                        </div>
                                    ))}
                                </div>
                                
                                {selectedSets.length > 0 && (
                                    <div className="p-4 bg-white rounded border">
                                        <h4 className="font-medium mb-3">Move to Shelf</h4>
                                        <div className="space-y-3">
                                            <select
                                                value={moveForm.shelfId}
                                                onChange={(e) => setMoveForm({...moveForm, shelfId: e.target.value})}
                                                className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                required
                                            >
                                                <option value="">Select Shelf</option>
                                                {shelves.map(shelf => (
                                                    <option key={shelf.id} value={shelf.id}>
                                                        {shelf.shelf_name} ({shelf.current_count}/{shelf.max_capacity})
                                                    </option>
                                                ))}
                                            </select>
                                            
                                            <input
                                                type="text"
                                                placeholder="ชื่อ Item"
                                                value={moveForm.itemName}
                                                onChange={(e) => setMoveForm({...moveForm, itemName: e.target.value})}
                                                className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                required
                                            />
                                            
                                            <input
                                                type="text"
                                                placeholder="รายละเอียด Item (ไม่บังคับ)"
                                                value={moveForm.itemDescription}
                                                onChange={(e) => setMoveForm({...moveForm, itemDescription: e.target.value})}
                                                className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            />
                                            
                                            <input
                                                type="number"
                                                step="0.01"
                                                placeholder="ราคา (ไม่บังคับ)"
                                                value={moveForm.price}
                                                onChange={(e) => setMoveForm({...moveForm, price: e.target.value})}
                                                className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            />
                                            
                                            <button
                                                onClick={handleMoveToShelf}
                                                disabled={isProcessing}
                                                className="w-full bg-green-600 text-white p-2 rounded hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
                                            >
                                                {isProcessing ? (
                                                    <>
                                                        <svg className="animate-spin h-4 w-4 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                        </svg>
                                                        Moving...
                                                    </>
                                                ) : (
                                                    `ย้าย ${selectedSets.length} Set(s) ไป Shelf`
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    {/* Right Panel - Shelf Inventory */}
                    <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                        <h3 className="text-lg font-semibold text-green-900 mb-4">
                            Shelf Inventory
                        </h3>
                        
                        {shelves.length === 0 ? (
                            <div className="text-center">
                                <p className="text-sm text-green-700 mb-4">
                                    No shelves available. Create shelves first.
                                </p>
                                <button
                                    onClick={createSampleShelves}
                                    disabled={isProcessing}
                                    className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                                >
                                    {isProcessing ? 'Creating...' : 'Create Sample Shelves'}
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {shelves.map(shelf => {
                                    const shelfItemsForShelf = shelfItems.filter(item => item.shelf_id === shelf.id);
                                    const usagePercentage = Math.round((shelf.current_count / shelf.max_capacity) * 100);
                                    
                                    return (
                                        <div key={shelf.id} className="p-4 bg-white rounded border">
                                            <div className="flex items-center justify-between mb-2">
                                                <h4 className="font-medium">{shelf.shelf_name}</h4>
                                                <span className="text-sm text-gray-600">
                                                    {shelf.current_count}/{shelf.max_capacity} items
                                                </span>
                                            </div>
                                            
                                            <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                                                <div
                                                    className={`h-2 rounded-full ${getUsageColor(usagePercentage)}`}
                                                    style={{ width: `${usagePercentage}%` }}
                                                ></div>
                                            </div>
                                            
                                            <p className="text-xs text-gray-600 mb-3">
                                                {usagePercentage}% capacity used
                                            </p>
                                            
                                            {shelfItemsForShelf.length > 0 && (
                                                <div className="space-y-1">
                                                    {shelfItemsForShelf.slice(0, 3).map(item => (
                                                        <div key={item.shelf_item_id} className="flex items-center justify-between text-sm">
                                                            <span className="truncate">{item.item_name}</span>
                                                            <span className={`px-2 py-1 rounded text-xs ${getStatusColor(item.item_status)}`}>
                                                                {item.item_status}
                                                            </span>
                                                        </div>
                                                    ))}
                                                    {shelfItemsForShelf.length > 3 && (
                                                        <p className="text-xs text-gray-500">
                                                            +{shelfItemsForShelf.length - 3} more items
                                                        </p>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
