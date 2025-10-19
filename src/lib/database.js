/**
 * Database connection utility
 * Supports PostgreSQL database only
 */

import { Pool } from 'pg';

/**
 * Get database type from connection string
 * @param {string} connectionString - Database connection string
 * @returns {string} Database type (postgresql)
 */
function getDatabaseType(connectionString) {
  if (connectionString.startsWith('postgresql://') || connectionString.startsWith('postgres://')) {
    return 'postgresql';
  }
  throw new Error('Unsupported database type. Only PostgreSQL is supported.');
}

/**
 * Create database connection based on connection string
 * @param {string} connectionString - Database connection string
 * @returns {Object} Database connection object
 */
export function createConnection(connectionString) {
  const dbType = getDatabaseType(connectionString);
  
  if (dbType === 'postgresql') {
    return new Pool({
      connectionString: connectionString,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
  }
  
  throw new Error(`Unsupported database type: ${dbType}`);
}

/**
 * Test database connection
 * @param {string} connectionString - Database connection string
 * @returns {Promise<Object>} Connection test result
 */
export async function testConnection(connectionString) {
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  const dbType = getDatabaseType(connectionString);
  let connection;
  
  try {
    connection = createConnection(connectionString);
    
    if (dbType === 'postgresql') {
      const client = await connection.connect();
      const result = await client.query('SELECT NOW() as current_time, version() as version');
      client.release();
      await connection.end();
      return {
        success: true,
        message: 'PostgreSQL connection successful',
        data: {
          currentTime: result.rows[0].current_time,
          version: result.rows[0].version
        }
      };
    }
    
    throw new Error(`Unsupported database type: ${dbType}`);
  } catch (error) {
    // Clean up connection if it exists
    if (connection) {
      try {
        await connection.end();
      } catch (cleanupError) {
        console.error('Error cleaning up connection:', cleanupError);
      }
    }
    
    return {
      success: false,
      message: `Database connection failed: ${error.message}`,
      error: error.message
    };
  }
}

/**
 * Get database connection info without connecting
 * @param {string} connectionString - Database connection string
 * @returns {Object} Database connection info
 */
export function getConnectionInfo(connectionString) {
  if (!connectionString) {
    return {
      type: 'unknown',
      message: 'DATABASE_URL not set'
    };
  }

  try {
    const dbType = getDatabaseType(connectionString);
    
    if (dbType === 'postgresql') {
      const pgUrl = new URL(connectionString);
      return {
        type: 'PostgreSQL',
        host: pgUrl.hostname,
        port: pgUrl.port || 5432,
        database: pgUrl.pathname.slice(1),
        user: pgUrl.username
      };
    }
    
    return {
      type: 'unknown',
      message: 'Unsupported database type'
    };
  } catch (error) {
    return {
      type: 'unknown',
      message: error.message
    };
  }
}
