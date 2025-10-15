import { testConnection, getConnectionInfo } from '@/lib/database';

/**
 * API route to test database connection
 * GET /api/database/test
 */
export async function GET() {
  try {
    const databaseUrl = process.env.DATABASE_URL;
    
    if (!databaseUrl) {
      return Response.json({
        success: false,
        message: 'DATABASE_URL environment variable is not set',
        connectionInfo: null
      }, { status: 400 });
    }

    // Get connection info without connecting
    const connectionInfo = getConnectionInfo(databaseUrl);
    
    // Test the connection
    const result = await testConnection(databaseUrl);
    
    return Response.json({
      ...result,
      connectionInfo: connectionInfo
    });
    
  } catch (error) {
    console.error('Database test error:', error);
    
    return Response.json({
      success: false,
      message: `Database test failed: ${error.message}`,
      error: error.message,
      connectionInfo: null
    }, { status: 500 });
  }
}

/**
 * API route to get database connection info without connecting
 * POST /api/database/test
 */
export async function POST() {
  try {
    const databaseUrl = process.env.DATABASE_URL;
    
    if (!databaseUrl) {
      return Response.json({
        success: false,
        message: 'DATABASE_URL environment variable is not set',
        connectionInfo: null
      }, { status: 400 });
    }

    const connectionInfo = getConnectionInfo(databaseUrl);
    
    return Response.json({
      success: true,
      message: 'Connection info retrieved successfully',
      connectionInfo: connectionInfo
    });
    
  } catch (error) {
    console.error('Database info error:', error);
    
    return Response.json({
      success: false,
      message: `Failed to get connection info: ${error.message}`,
      error: error.message,
      connectionInfo: null
    }, { status: 500 });
  }
}
