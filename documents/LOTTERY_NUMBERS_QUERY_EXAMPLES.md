# Lottery Numbers SQL Query Examples

## Overview
This document provides SQL query examples for the lottery number set: **67-48-10-052044-7332**

## Number Breakdown
- **Format**: `YY-DS-SN-XXXXXX-BBBB`
- **YY**: 67 (year) → Converted to Buddhist Era: 2500 + 67 + 1 = 2568
- **DS**: 48 (draw_sequence)
- **SN**: 10 (set_number)
- **XXXXXX**: 052044 (six_digit_number)
- **BBBB**: 7332 (book_number)

## Database Schema
The `lottery_numbers` table contains the following columns:
- `year_number` (INTEGER) - Buddhist Era year (e.g., 2568)
- `draw_sequence` (INTEGER) - Draw sequence number
- `set_number` (INTEGER) - Set number
- `six_digit_number` (INTEGER) - The main 6-digit lottery number
- `book_number` (INTEGER) - Book number
- `lottery_draw_id` (INTEGER) - Default: 0
- `branch_id` (INTEGER) - Default: 0
- `ticket_count` (INTEGER) - Default: 0
- `group_type` (VARCHAR) - Default: 'row'

## SQL Query Examples

### 1. Insert Lottery Number
```sql
-- PostgreSQL
INSERT INTO lottery_numbers (
    year_number, draw_sequence, set_number, six_digit_number, book_number,
    lottery_draw_id, branch_id, ticket_count, group_type
) VALUES (2568, 48, 10, 52044, 7332, 0, 0, 0, 'row')
RETURNING six_digit_number;


```

### 2. Find Specific Lottery Number
```sql
-- Find by six_digit_number
SELECT * FROM lottery_numbers 
WHERE six_digit_number = 52044;

-- Find by complete set of parameters
SELECT * FROM lottery_numbers 
WHERE year_number = 2568 
  AND draw_sequence = 48 
  AND set_number = 10 
  AND six_digit_number = 52044 
  AND book_number = 7332;
```

### 3. Find by Year and Draw Sequence
```sql
-- Find all numbers from year 2568, draw sequence 48
SELECT * FROM lottery_numbers 
WHERE year_number = 2568 
  AND draw_sequence = 48 
ORDER BY set_number, six_digit_number;
```

### 4. Find by Set Number
```sql
-- Find all numbers from set 10
SELECT * FROM lottery_numbers 
WHERE set_number = 10 
ORDER BY year_number DESC, draw_sequence, six_digit_number;
```

### 5. Find by Book Number Range
```sql
-- Find all numbers with book number between 7000-8000
SELECT * FROM lottery_numbers 
WHERE book_number BETWEEN 7000 AND 8000 
ORDER BY book_number, six_digit_number;
```

### 6. Search by Six-Digit Number Pattern
```sql
-- Find numbers starting with '052'
SELECT * FROM lottery_numbers 
WHERE CAST(six_digit_number AS TEXT) LIKE '052%'
ORDER BY six_digit_number;

-- Find numbers ending with '044'
SELECT * FROM lottery_numbers 
WHERE CAST(six_digit_number AS TEXT) LIKE '%044'
ORDER BY six_digit_number;
```

### 7. Count Statistics
```sql
-- Count total numbers by year
SELECT year_number, COUNT(*) as total_numbers
FROM lottery_numbers 
GROUP BY year_number 
ORDER BY year_number DESC;

-- Count numbers by draw sequence for year 2568
SELECT draw_sequence, COUNT(*) as count
FROM lottery_numbers 
WHERE year_number = 2568 
GROUP BY draw_sequence 
ORDER BY draw_sequence;

-- Count numbers by set
SELECT set_number, COUNT(*) as count
FROM lottery_numbers 
GROUP BY set_number 
ORDER BY set_number;
```

### 8. Find Recent Entries
```sql
-- Find the 10 most recent entries (if created_at column exists)
SELECT * FROM lottery_numbers 
ORDER BY created_at DESC 
LIMIT 10;

-- Find entries from the last 7 days (if created_at column exists)
SELECT * FROM lottery_numbers 
WHERE created_at >= NOW() - INTERVAL '7 days'
ORDER BY created_at DESC;
```

### 9. Check for Duplicates
```sql
-- Find duplicate six_digit_numbers
SELECT six_digit_number, COUNT(*) as duplicate_count
FROM lottery_numbers 
GROUP BY six_digit_number 
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC;

-- Find duplicate complete sets
SELECT year_number, draw_sequence, set_number, six_digit_number, book_number, COUNT(*) as duplicate_count
FROM lottery_numbers 
GROUP BY year_number, draw_sequence, set_number, six_digit_number, book_number
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC;
```

### 10. Update Operations
```sql
-- Update ticket_count for specific number
UPDATE lottery_numbers 
SET ticket_count = 1 
WHERE six_digit_number = 52044 
  AND year_number = 2568 
  AND draw_sequence = 48 
  AND set_number = 10 
  AND book_number = 7332;

-- Update group_type for all numbers in a set
UPDATE lottery_numbers 
SET group_type = 'column' 
WHERE year_number = 2568 
  AND draw_sequence = 48 
  AND set_number = 10;
```

### 11. Delete Operations
```sql
-- Delete specific lottery number
DELETE FROM lottery_numbers 
WHERE six_digit_number = 52044 
  AND year_number = 2568 
  AND draw_sequence = 48 
  AND set_number = 10 
  AND book_number = 7332;

-- Delete all numbers from a specific draw
DELETE FROM lottery_numbers 
WHERE year_number = 2568 
  AND draw_sequence = 48;
```

### 12. Complex Queries
```sql
-- Find numbers that appear in multiple sets
SELECT six_digit_number, COUNT(DISTINCT set_number) as set_count
FROM lottery_numbers 
GROUP BY six_digit_number 
HAVING COUNT(DISTINCT set_number) > 1
ORDER BY set_count DESC, six_digit_number;

-- Find the most common six_digit_numbers
SELECT six_digit_number, COUNT(*) as frequency
FROM lottery_numbers 
GROUP BY six_digit_number 
ORDER BY frequency DESC 
LIMIT 20;

-- Find numbers with specific patterns (e.g., all same digits)
SELECT * FROM lottery_numbers 
WHERE CAST(six_digit_number AS TEXT) ~ '^(\d)\1{5}$'  -- PostgreSQL regex
ORDER BY six_digit_number;
```

## Database-Specific Notes

### PostgreSQL
- Uses `RETURNING` clause for INSERT operations
- Supports `JSONB` data type for complex queries
- Uses `~` operator for regex matching
- Uses `INTERVAL` for date arithmetic



## Best Practices

1. **Always use parameterized queries** to prevent SQL injection
2. **Add appropriate indexes** on frequently queried columns
3. **Use transactions** for multiple related operations
4. **Validate input data** before inserting
5. **Use appropriate data types** for each column
6. **Consider performance** when writing complex queries

## Index Recommendations

```sql
-- Recommended indexes for better performance
CREATE INDEX idx_lottery_numbers_six_digit ON lottery_numbers(six_digit_number);
CREATE INDEX idx_lottery_numbers_year_draw ON lottery_numbers(year_number, draw_sequence);
CREATE INDEX idx_lottery_numbers_set ON lottery_numbers(set_number);
CREATE INDEX idx_lottery_numbers_book ON lottery_numbers(book_number);
CREATE INDEX idx_lottery_numbers_composite ON lottery_numbers(year_number, draw_sequence, set_number, six_digit_number);
```
