'use client';

import { useState } from 'react';

export default function DatabaseTestPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [connectionInfo, setConnectionInfo] = useState(null);

  const testConnection = async () => {
    setIsLoading(true);
    setResult(null);
    setConnectionInfo(null);

    try {
      const response = await fetch('/api/database/test');
      const data = await response.json();
      
      setResult(data);
      setConnectionInfo(data.connectionInfo);
    } catch (error) {
      setResult({
        success: false,
        message: 'Failed to test database connection',
        error: error.message
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getConnectionInfo = async () => {
    setIsLoading(true);
    setResult(null);
    setConnectionInfo(null);

    try {
      const response = await fetch('/api/database/test', {
        method: 'POST'
      });
      const data = await response.json();
      
      setResult(data);
      setConnectionInfo(data.connectionInfo);
    } catch (error) {
      setResult({
        success: false,
        message: 'Failed to get connection info',
        error: error.message
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white shadow-lg rounded-lg p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-4">
              Database Connection Test
            </h1>
            <p className="text-gray-600">
              Test your database connection using the DATABASE_URL environment variable
            </p>
          </div>

          <div className="space-y-6">
            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={testConnection}
                disabled={isLoading}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200 flex items-center justify-center"
              >
                {isLoading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Testing Connection...
                  </>
                ) : (
                  'Test Database Connection'
                )}
              </button>

              <button
                onClick={getConnectionInfo}
                disabled={isLoading}
                className="bg-gray-600 hover:bg-gray-700 disabled:bg-gray-400 text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200"
              >
                Get Connection Info
              </button>
            </div>

            {/* Connection Info Display */}
            {connectionInfo && (
              <div className="bg-gray-50 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Connection Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <span className="font-medium text-gray-700">Database Type:</span>
                    <span className="ml-2 text-gray-900">{connectionInfo.type}</span>
                  </div>
                  
                  {connectionInfo.host && (
                    <div>
                      <span className="font-medium text-gray-700">Host:</span>
                      <span className="ml-2 text-gray-900">{connectionInfo.host}</span>
                    </div>
                  )}
                  
                  {connectionInfo.port && (
                    <div>
                      <span className="font-medium text-gray-700">Port:</span>
                      <span className="ml-2 text-gray-900">{connectionInfo.port}</span>
                    </div>
                  )}
                  
                  {connectionInfo.database && (
                    <div>
                      <span className="font-medium text-gray-700">Database:</span>
                      <span className="ml-2 text-gray-900">{connectionInfo.database}</span>
                    </div>
                  )}
                  
                  {connectionInfo.user && (
                    <div>
                      <span className="font-medium text-gray-700">User:</span>
                      <span className="ml-2 text-gray-900">{connectionInfo.user}</span>
                    </div>
                  )}
                  
                  {connectionInfo.filePath && (
                    <div>
                      <span className="font-medium text-gray-700">File Path:</span>
                      <span className="ml-2 text-gray-900">{connectionInfo.filePath}</span>
                    </div>
                  )}
                  
                  {connectionInfo.message && (
                    <div className="col-span-full">
                      <span className="font-medium text-gray-700">Message:</span>
                      <span className="ml-2 text-gray-900">{connectionInfo.message}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Result Display */}
            {result && (
              <div className={`rounded-lg p-6 ${
                result.success 
                  ? 'bg-green-50 border border-green-200' 
                  : 'bg-red-50 border border-red-200'
              }`}>
                <div className="flex items-center mb-4">
                  {result.success ? (
                    <svg className="h-6 w-6 text-green-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="h-6 w-6 text-red-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  )}
                  <h3 className={`text-lg font-semibold ${
                    result.success ? 'text-green-800' : 'text-red-800'
                  }`}>
                    {result.success ? 'Connection Successful' : 'Connection Failed'}
                  </h3>
                </div>
                
                <p className={`mb-4 ${
                  result.success ? 'text-green-700' : 'text-red-700'
                }`}>
                  {result.message}
                </p>

                {result.error && (
                  <div className="bg-red-100 border border-red-300 rounded p-3 mb-4">
                    <p className="text-red-800 text-sm">
                      <strong>Error:</strong> {result.error}
                    </p>
                  </div>
                )}

                {result.data && (
                  <div className="bg-white border border-gray-200 rounded p-4">
                    <h4 className="font-medium text-gray-900 mb-2">Database Response:</h4>
                    <div className="space-y-2">
                      {result.data.currentTime && (
                        <div>
                          <span className="font-medium text-gray-700">Current Time:</span>
                          <span className="ml-2 text-gray-900">{result.data.currentTime}</span>
                        </div>
                      )}
                      {result.data.version && (
                        <div>
                          <span className="font-medium text-gray-700">Version:</span>
                          <span className="ml-2 text-gray-900">{result.data.version}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Instructions */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-blue-900 mb-4">
                Setup Instructions
              </h3>
              <div className="text-blue-800 space-y-2">
                <p>1. Create a <code className="bg-blue-100 px-2 py-1 rounded text-sm">.env.local</code> file in your project root</p>
                <p>2. Add your database connection string:</p>
                <div className="bg-blue-100 p-3 rounded mt-2">
                  <code className="text-sm">
                    DATABASE_URL=postgresql://username:password@localhost:5432/database_name
                  </code>
                </div>
                <p>3. Supported database types: PostgreSQL, MySQL, SQLite</p>
                <p>4. Click "Test Database Connection" to verify your setup</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
