# Lottery Matching System Design

## Overview
This document describes the design for the lottery number matching system that matches lottery numbers based on vertical rows in templates.

## Database Schema Design

### Table: `lottery_matched_sets`
Stores information about matched lottery sets based on template vertical rows.

```sql
CREATE TABLE lottery_matched_sets (
    id SERIAL PRIMARY KEY,
    template_id INTEGER NOT NULL,
    vertical_row_index INTEGER NOT NULL, -- Which vertical row in template (0-9)
    is_complete BOOLEAN NOT NULL DEFAULT FALSE, -- TRUE if all 10 positions filled
    matched_numbers JSONB NOT NULL, -- Array of matched numbers with positions
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for better performance
CREATE INDEX idx_lottery_matched_sets_template_id ON lottery_matched_sets(template_id);
CREATE INDEX idx_lottery_matched_sets_vertical_row ON lottery_matched_sets(vertical_row_index);
CREATE INDEX idx_lottery_matched_sets_complete ON lottery_matched_sets(is_complete);
```

### Table: `lottery_matched_numbers`
Stores individual matched numbers with their positions in the vertical row.

```sql
CREATE TABLE lottery_matched_numbers (
    id SERIAL PRIMARY KEY,
    matched_set_id INTEGER NOT NULL REFERENCES lottery_matched_sets(id) ON DELETE CASCADE,
    lottery_number VARCHAR(6) NOT NULL, -- Full 6-digit lottery number
    last_two_digits VARCHAR(2) NOT NULL, -- Last 2 digits for matching
    position_in_row INTEGER NOT NULL, -- Position in vertical row (0-9)
    origin_number VARCHAR(50) NOT NULL, -- Original lottery number in format YY-DS-SN-XXXXXX-BBBB
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for better performance
CREATE INDEX idx_lottery_matched_numbers_set_id ON lottery_matched_numbers(matched_set_id);
CREATE INDEX idx_lottery_matched_numbers_last_two ON lottery_matched_numbers(last_two_digits);
CREATE INDEX idx_lottery_matched_numbers_position ON lottery_matched_numbers(position_in_row);
CREATE INDEX idx_lottery_matched_numbers_origin_number ON lottery_matched_numbers(origin_number);
```

## Matching Logic

### Vertical Row Matching Algorithm
1. **Template Structure**: 10x10 grid where each column represents a vertical row
2. **Matching Process**:
   - For each vertical column (0-9) in the template
   - Match lottery numbers whose last 2 digits appear in that column
- Track which positions in the vertical row are filled (derived by `matched_numbers.length > 0`)
- Mark as complete when all 10 positions are filled (i.e., 10 positions where `matched_numbers.length > 0`)

### Completion Criteria
- **Complete Row**: All 10 positions in a vertical row have matching lottery numbers
- **Incomplete Row**: Some positions are missing matching lottery numbers
- **Flag System**: `is_complete` boolean field indicates completion status; per-position fill state is not stored as a boolean and should be derived using `matched_numbers.length > 0`.

## JSON Structure for matched_numbers
```json
{
  "positions": [
    {
      "position": 0,
      "template_value": "00",
      "matched_numbers": ["123400", "567800"]
    },
    {
      "position": 1,
      "template_value": "01", 
      "matched_numbers": []
    }
    // ... up to position 9
  ],
  "completion_stats": {
    "total_positions": 10,
    "filled_positions": 7,
    "completion_percentage": 70
  }
}
```

## API Endpoints

### GET /api/lottery/matching
- Fetch all matched sets with completion status
- Optional filters: template_id, is_complete, vertical_row_index

### POST /api/lottery/matching/process
- Process lottery numbers against templates
- Create matched sets and numbers
- Return completion statistics

### GET /api/lottery/matching/:setId
- Fetch specific matched set with all numbers
- Include completion details

## UI Components

### Matching Results Display
- Vertical row visualization
- Completion status indicators
- Matched numbers list
- Statistics dashboard

### Filters and Search
- Filter by completion status
- Filter by template
- Filter by vertical row
- Search by lottery numbers
