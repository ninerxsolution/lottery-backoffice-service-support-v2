/**
 * Database connection utility
 * Supports PostgreSQL, MySQL, and SQLite databases
 */

import { Pool } from 'pg';
import mysql from 'mysql2/promise';
import sqlite3 from 'sqlite3';
import { promisify } from 'util';

/**
 * Get database type from connection string
 * @param {string} connectionString - Database connection string
 * @returns {string} Database type (postgresql, mysql, sqlite)
 */
function getDatabaseType(connectionString) {
  if (connectionString.startsWith('postgresql://') || connectionString.startsWith('postgres://')) {
    return 'postgresql';
  } else if (connectionString.startsWith('mysql://')) {
    return 'mysql';
  } else if (connectionString.startsWith('sqlite://')) {
    return 'sqlite';
  }
  throw new Error('Unsupported database type. Supported types: postgresql, mysql, sqlite');
}

/**
 * Create database connection based on connection string
 * @param {string} connectionString - Database connection string
 * @returns {Object} Database connection object
 */
export function createConnection(connectionString) {
  const dbType = getDatabaseType(connectionString);
  
  switch (dbType) {
    case 'postgresql':
      return new Pool({
        connectionString: connectionString,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
      });
    
    case 'mysql':
      // Parse MySQL connection string
      const mysqlUrl = new URL(connectionString);
      return mysql.createConnection({
        host: mysqlUrl.hostname,
        port: mysqlUrl.port || 3306,
        user: mysqlUrl.username,
        password: mysqlUrl.password,
        database: mysqlUrl.pathname.slice(1)
      });
    
    case 'sqlite':
      // Extract file path from sqlite:///path/to/db
      const filePath = connectionString.replace('sqlite:///', '');
      const db = new sqlite3.Database(filePath);
      return {
        query: promisify(db.all.bind(db)),
        run: (sql, params = []) => new Promise((resolve, reject) => {
          db.run(sql, params, function (err) {
            if (err) return reject(err);
            resolve({ lastID: this.lastID, changes: this.changes });
          });
        }),
        close: promisify(db.close.bind(db))
      };
    
    default:
      throw new Error(`Unsupported database type: ${dbType}`);
  }
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
    
    switch (dbType) {
      case 'postgresql':
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
      
      case 'mysql':
        const [rows] = await connection.execute('SELECT NOW() as current_time, VERSION() as version');
        await connection.end();
        return {
          success: true,
          message: 'MySQL connection successful',
          data: {
            currentTime: rows[0].current_time,
            version: rows[0].version
          }
        };
      
      case 'sqlite':
        const sqliteResult = await connection.query('SELECT datetime("now") as current_time, sqlite_version() as version');
        await connection.close();
        return {
          success: true,
          message: 'SQLite connection successful',
          data: {
            currentTime: sqliteResult[0].current_time,
            version: sqliteResult[0].version
          }
        };
      
      default:
        throw new Error(`Unsupported database type: ${dbType}`);
    }
  } catch (error) {
    // Clean up connection if it exists
    if (connection) {
      try {
        if (dbType === 'postgresql') {
          await connection.end();
        } else if (dbType === 'mysql') {
          await connection.end();
        } else if (dbType === 'sqlite') {
          await connection.close();
        }
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
    
    switch (dbType) {
      case 'postgresql':
        const pgUrl = new URL(connectionString);
        return {
          type: 'PostgreSQL',
          host: pgUrl.hostname,
          port: pgUrl.port || 5432,
          database: pgUrl.pathname.slice(1),
          user: pgUrl.username
        };
      
      case 'mysql':
        const mysqlUrl = new URL(connectionString);
        return {
          type: 'MySQL',
          host: mysqlUrl.hostname,
          port: mysqlUrl.port || 3306,
          database: mysqlUrl.pathname.slice(1),
          user: mysqlUrl.username
        };
      
      case 'sqlite':
        const filePath = connectionString.replace('sqlite:///', '');
        return {
          type: 'SQLite',
          filePath: filePath
        };
      
      default:
        return {
          type: 'unknown',
          message: 'Unsupported database type'
        };
    }
  } catch (error) {
    return {
      type: 'unknown',
      message: error.message
    };
  }
}
