# Duplicate Numbers Validation Enhancement

## Problem Description

The lottery matching system was using only `six_digit_number` to identify lottery records, which could cause issues when multiple lottery records have the same six-digit number but different other attributes (year_number, draw_sequence, set_number, book_number).

## Issues Identified

1. **Incomplete Identification**: Using only `six_digit_number` for lookup could match the wrong record
2. **Silent Failures**: System would silently use the first matching record without warning
3. **Data Integrity**: No validation to detect duplicate six-digit numbers in the system

## Solution Implemented

### 1. Enhanced Round-Robin Selection System

**File**: `src/app/api/lottery/matching/route.js`

Implemented round-robin selection to distribute usage of duplicate six-digit numbers:

```javascript
// If multiple records found with same six_digit_number, use round-robin selection
if (lookup.rows.length > 1) {
  console.warn(`⚠️  DUPLICATE SIX_DIGIT_NUMBER DETECTED: ${lotteryNumber}`);
  console.warn('Found multiple lottery records with same six_digit_number:');
  lookup.rows.forEach((row, index) => {
    const yy = row.year_number?.toString().slice(-2) ?? '';
    const ds = row.draw_sequence?.toString() ?? '';
    const sn = row.set_number?.toString() ?? '';
    const six = row.six_digit_number?.toString() ?? '';
    const bn = row.book_number?.toString() ?? '';
    const fullKey = `${yy}-${ds}-${sn}-${six}-${bn}`;
    console.warn(`  ${index + 1}. ${fullKey} (ID: ${row.id || 'N/A'})`);
  });
  
  // Use round-robin selection based on matchedSetId and rowIndex to distribute usage
  const selectedIndex = (matchedSetId + rowIndex) % lookup.rows.length;
  const selectedRow = lookup.rows[selectedIndex];
  console.warn(`Using record ${selectedIndex + 1} (round-robin selection)`);
}
```

**Key Improvements**:
- **Unique Cache Keys**: Uses `${lotteryNumber}:${matchedSetId}:${rowIndex}` to ensure each usage gets a unique cache entry
- **Round-Robin Distribution**: Distributes usage across all duplicate records instead of always using the first one
- **Better Logging**: Shows which specific record is being used for each occurrence

### 2. New Duplicate Check API Endpoint

**File**: `src/app/api/lottery/duplicate-check/route.js`

Created a new API endpoint to identify and report duplicate six-digit numbers:

```javascript
// GET /api/lottery/duplicate-check
// Returns detailed information about duplicate six_digit_numbers
```

**API Response Format**:
```json
{
  "success": true,
  "data": {
    "has_duplicates": true,
    "duplicate_groups": 2,
    "total_duplicate_records": 4,
    "total_records": 271,
    "unique_six_digit_numbers": 267,
    "duplicates": [
      {
        "six_digit_number": "123456",
        "duplicate_count": 2,
        "full_keys": ["67-48-32-123456-4154", "68-01-15-123456-7890"],
        "record_ids": [123, 124]
      }
    ]
  }
}
```

## Benefits

1. **Visibility**: Clear warnings when duplicate six-digit numbers are encountered
2. **Data Quality**: Ability to identify and resolve data quality issues
3. **Debugging**: Detailed logging helps identify which records are causing conflicts
4. **Prevention**: Early detection of duplicate data before processing

## Usage

### Check for Duplicates
```bash
GET /api/lottery/duplicate-check
```

### Monitor Processing Logs
When processing lottery matching, watch for warning messages like:
```
⚠️  DUPLICATE SIX_DIGIT_NUMBER DETECTED: 123456
Found multiple lottery records with same six_digit_number:
  1. 67-48-32-123456-4154 (ID: 123)
  2. 68-01-15-123456-7890 (ID: 124)
Using the first record. This may cause incorrect matching!
```

## Recommendations

1. **Data Cleanup**: Use the duplicate check API to identify and resolve duplicate records
2. **Unique Constraint**: Consider adding a unique constraint on the combination of all lottery number fields
3. **Input Validation**: Implement stricter validation during data entry to prevent duplicates
4. **Monitoring**: Regularly check for duplicates using the new API endpoint

## Files Modified

1. **`src/app/api/lottery/matching/route.js`**
   - Added detailed duplicate detection and warning system

2. **`src/app/api/lottery/duplicate-check/route.js`** (New)
   - New API endpoint for duplicate detection and reporting
