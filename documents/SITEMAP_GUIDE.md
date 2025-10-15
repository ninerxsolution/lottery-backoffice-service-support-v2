# Sitemap Guide

This document tracks the site structure and navigation for the Lottery Backoffice Service Support v2 application.

## Current Site Structure

### Main Pages
- `/` - Home page (default Next.js landing page)
- `/database-test` - Database connection testing page
- `/lottery/template` - Lottery template display page
- `/lottery/numbers` - Display all six_digit_number values
- `/lottery/matching_gen` - Lottery number matching page
- `/lottery-image-gen-test` - Generate lottery card image from 6 digits

### API Routes
- `/api/database/test` - Database connection testing endpoint
  - `GET` - Test database connection
  - `POST` - Get connection information without connecting
- `/api/lottery/template` - Lottery template data endpoint
  - `GET` - Fetch template data from lottery_templates table
- `/api/lottery/numbers` - Lottery numbers endpoint
  - `GET` - Fetch all `six_digit_number` from `lottery_numbers`
- `/api/lottery/matching` - Lottery matching endpoint
  - `GET` - Fetch matched lottery sets with filters
  - `POST` - Process lottery numbers against templates

## Navigation Structure

```
Lottery Backoffice Service Support v2
├── Home (/)
├── Database Test (/database-test)
│   ├── Test Connection Button
│   ├── Get Connection Info Button
│   └── Connection Status Display
├── Lottery Template (/lottery/template)
│   ├── 10x10 Grid Display
│   ├── Template Information
│   └── Raw JSON Data View
├── Lottery Numbers (/lottery/numbers)
│   ├── List six_digit_number values
│   └── Raw data view
├── Lottery Matching (/lottery/matching_gen)
│   ├── Process Matching Button
│   ├── Statistics Dashboard
│   ├── Template Preview
│   ├── Filter Controls
│   └── Matching Results Display
└── Lottery Image Generator (/lottery-image-gen-test)
    ├── 6-digit input field
    ├── Canvas preview over template
    └── Download PNG action
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

### Lottery Template Page (`/lottery/template`)
- **Purpose**: Display lottery template data in 10x10 grid format
- **Features**:
  - 10x10 grid layout with input text fields
  - Data sourced from lottery_templates table (columns field)
  - JSON data parsing and display
  - Template information section
  - Raw JSON data viewer (collapsible)
  - Loading states and error handling
  - Responsive design with Tailwind CSS
- **Status**: Implemented with real database integration

### Lottery Matching Page (`/lottery/matching_gen`)
- **Purpose**: Match lottery numbers against template vertical rows with completion tracking
- **Features**:
  - Process matching button to analyze lottery numbers against templates
  - Statistics dashboard showing total numbers, complete rows, and incomplete rows
  - Template preview showing 10x10 grid structure
  - Filter controls for completion status and vertical row selection
  - Detailed matching results with completion percentages
  - Visual progress bars and color-coded completion status
  - Position-by-position matching details
  - Matched numbers display with position information
  - Real-time processing with loading states
  - Error handling and retry functionality
- **Matching Logic**:
  - Matches lottery numbers based on last 2 digits against template vertical columns
  - Tracks completion status for each vertical row (0-9)
  - Flags incomplete rows when not all 10 positions are filled
  - Stores results in lottery_matched_sets and lottery_matched_numbers tables
- **Status**: Fully implemented with database integration

### Lottery Image Generator Page (`/lottery-image-gen-test`)
- **Purpose**: Generate a lottery card image by rendering a 6-digit number onto a template
- **Features**:
  - 6-digit numeric input with validation
  - Live canvas preview drawn over `/assets/images/lottery-card-template.jpg`
  - Centered digits with consistent spacing and responsive font sizing
  - Download final image as PNG (`lottery-<digits>.png`)
- **Status**: Implemented (client-side rendering)

## API Endpoints

### Database Test API (`/api/database/test`)
- **GET**: Tests actual database connection
  - Returns connection status, database version, current time
  - Handles PostgreSQL, MySQL, and SQLite databases
- **POST**: Returns connection information without connecting
  - Parses DATABASE_URL and returns connection details
  - Safe to call without establishing actual connection

### Lottery Template API (`/api/lottery/template`)
- **GET**: Fetches template data from lottery_templates table
  - Returns columns field data in JSON format
  - Handles PostgreSQL, MySQL, and SQLite databases
  - Returns 404 if no template data found
  - Proper error handling for database connection issues

### Lottery Numbers API (`/api/lottery/numbers`)
- **GET**: Fetches all `six_digit_number` values from `lottery_numbers`
  - Sorted ascending
  - Supports PostgreSQL, MySQL, and SQLite
  - Returns array of strings/numbers

### Lottery Matching API (`/api/lottery/matching`)
- **GET**: Fetches matched lottery sets with optional filters
  - Query parameters: template_id, is_complete, vertical_row
  - Returns matched sets with completion statistics
  - Supports PostgreSQL, MySQL, and SQLite
- **POST**: Processes lottery numbers against templates
  - Body: { templateId, lotteryNumbers }
  - Creates matched sets and individual number records
  - Returns processing results with completion status

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
- **2024-10-14**: Added lottery template page with 10x10 grid display
- **2024-10-14**: Implemented real database integration for lottery template data
- **2024-10-14**: Added lottery matching system with vertical row completion logic
- **2024-10-14**: Created matching API endpoints and UI with completion flags
-. **2025-10-15**: Added lottery image generator page and documented route

## Notes

- All pages use Tailwind CSS for styling
- Database connection utility supports multiple database types
- Environment variables are properly secured and not committed to version control
- API routes follow Next.js 13+ App Router conventions
