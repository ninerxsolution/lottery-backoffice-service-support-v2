# Sitemap Guide

This document tracks the site structure and navigation for the Lottery Backoffice Service Support v2 application.

## Current Site Structure

### Main Pages
- `/` - Home page (default Next.js landing page)
- `/database-test` - Database connection testing page

### API Routes
- `/api/database/test` - Database connection testing endpoint
  - `GET` - Test database connection
  - `POST` - Get connection information without connecting

## Navigation Structure

```
Lottery Backoffice Service Support v2
├── Home (/)
└── Database Test (/database-test)
    ├── Test Connection Button
    ├── Get Connection Info Button
    └── Connection Status Display
```

## Page Descriptions

### Home Page (`/`)
- **Purpose**: Main landing page
- **Content**: Next.js default welcome page with deployment links
- **Status**: Default implementation

### Database Test Page (`/database-test`)
- **Purpose**: Test database connectivity using DATABASE_URL environment variable
- **Features**:
  - Test database connection button
  - Get connection information button
  - Real-time connection status display
  - Connection details (host, port, database, user)
  - Error handling and success feedback
  - Setup instructions
- **Status**: Implemented with full functionality

## API Endpoints

### Database Test API (`/api/database/test`)
- **GET**: Tests actual database connection
  - Returns connection status, database version, current time
  - Handles PostgreSQL, MySQL, and SQLite databases
- **POST**: Returns connection information without connecting
  - Parses DATABASE_URL and returns connection details
  - Safe to call without establishing actual connection

## Environment Configuration

### Required Environment Variables
- `DATABASE_URL` - Database connection string
  - Format: `postgresql://user:password@host:port/database`
  - Supported: PostgreSQL, MySQL, SQLite

### Environment Setup
- Create `.env.local` file in project root
- Add DATABASE_URL with your database connection string
- See `documents/ENVIRONMENT_SETUP.md` for detailed instructions

## Future Planned Pages

*This section will be updated as new features are added*

## Update Log

- **2024-10-14**: Initial sitemap creation
- **2024-10-14**: Added database-test page and API endpoint
- **2024-10-14**: Documented environment setup requirements

## Notes

- All pages use Tailwind CSS for styling
- Database connection utility supports multiple database types
- Environment variables are properly secured and not committed to version control
- API routes follow Next.js 13+ App Router conventions
