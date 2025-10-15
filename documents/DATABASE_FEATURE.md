# Database Connection Feature Documentation

## Overview

This feature provides a comprehensive database connection testing system for the Lottery Backoffice Service Support v2 application. It supports multiple database types and provides a user-friendly interface for testing connections.

## Features

### Supported Database Types
- **PostgreSQL** - Full support with connection pooling
- **MySQL** - Full support with prepared statements
- **SQLite** - Full support with file-based storage

### Core Functionality
- Database connection testing
- Connection information parsing
- Error handling and reporting
- Real-time status updates
- Security best practices

## Implementation Details

### Database Utility (`src/lib/database.js`)

#### Functions
- `getDatabaseType(connectionString)` - Determines database type from connection string
- `createConnection(connectionString)` - Creates appropriate database connection
- `testConnection(connectionString)` - Tests database connectivity
- `getConnectionInfo(connectionString)` - Parses connection details without connecting

#### Connection String Formats
```javascript
// PostgreSQL
postgresql://user:password@host:port/database

// MySQL
mysql://user:password@host:port/database

// SQLite
sqlite:///path/to/database.db
```

### API Routes (`src/app/api/database/test/route.js`)

#### GET `/api/database/test`
- Tests actual database connection
- Returns connection status, database version, and current time
- Handles all supported database types

#### POST `/api/database/test`
- Returns parsed connection information
- Safe operation that doesn't establish actual connection
- Useful for configuration validation

### Frontend Component (`src/app/(pages)/database-test/page.jsx`)

#### Features
- Interactive connection testing
- Real-time loading states
- Comprehensive error display
- Connection information display
- Setup instructions

#### UI Components
- Test Connection Button
- Get Connection Info Button
- Connection Status Display
- Error/Success Feedback
- Database Response Details

## Security Considerations

### Environment Variables
- DATABASE_URL stored in `.env.local` (not committed to version control)
- Connection strings parsed securely
- No sensitive data exposed in frontend

### Connection Handling
- Proper connection cleanup on errors
- SSL support for production PostgreSQL connections
- Prepared statements for MySQL to prevent SQL injection

### Error Handling
- Comprehensive error catching
- User-friendly error messages
- No sensitive information leaked in error responses

## Usage Instructions

### Setup
1. Create `.env.local` file in project root
2. Add your DATABASE_URL:
   ```env
   DATABASE_URL=postgresql://username:password@localhost:5432/database_name
   ```
3. Install dependencies: `npm install`

### Testing
1. Navigate to `/database-test`
2. Click "Test Database Connection" to verify connectivity
3. Click "Get Connection Info" to view parsed connection details
4. Review connection status and any error messages

## Dependencies

### Production Dependencies
- `pg` (^8.11.3) - PostgreSQL client
- `mysql2` (^3.9.1) - MySQL client
- `sqlite3` (^5.1.6) - SQLite client

### Built-in Dependencies
- `next` - Next.js framework
- `react` - React library
- `util` - Node.js utilities (promisify)

## Error Handling

### Common Error Scenarios
- Missing DATABASE_URL environment variable
- Invalid connection string format
- Database server unavailable
- Authentication failures
- Network connectivity issues

### Error Response Format
```javascript
{
  success: false,
  message: "Error description",
  error: "Detailed error message",
  connectionInfo: null
}
```

## Performance Considerations

### Connection Pooling
- PostgreSQL uses connection pooling for better performance
- Connections are properly closed after testing
- No connection leaks

### Caching
- Connection info parsing is lightweight
- No unnecessary database connections
- Efficient error handling

## Testing

### Manual Testing
- Test with different database types
- Verify error handling with invalid connections
- Check UI responsiveness and loading states

### Automated Testing
*Future enhancement: Add unit tests for database utility functions*

## Future Enhancements

### Planned Features
- Connection pooling configuration
- Database schema inspection
- Query execution testing
- Connection health monitoring
- Multiple database support per environment

### Potential Improvements
- Add connection timeout configuration
- Implement retry logic for failed connections
- Add database-specific query examples
- Create connection history logging

## Troubleshooting

### Common Issues
1. **"DATABASE_URL not set"** - Ensure `.env.local` exists with correct variable name
2. **Connection timeout** - Check database server status and network connectivity
3. **Authentication failed** - Verify username/password in connection string
4. **Database not found** - Ensure database exists on the server

### Debug Steps
1. Check environment variable is loaded
2. Verify connection string format
3. Test database server accessibility
4. Review error messages for specific issues

## Code Quality

### TypeScript Considerations
- Strong typing for all database operations
- No use of `any` type as per user requirements
- Proper error type definitions

### Best Practices
- Separation of concerns (utility, API, UI)
- Comprehensive error handling
- Security-first approach
- User-friendly interface design
