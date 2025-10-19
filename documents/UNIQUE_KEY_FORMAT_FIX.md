# Unique Key Format Fix

## Problem Description

The `unique_key` in the unused-numbers API was showing incorrect format like `"67-48-32-23443-4154"` instead of the expected format `"67-48-32-023443-4154"`. The issue was that the six-digit number was not being properly padded with leading zeros.

## Root Cause

The `unused-numbers/route.js` file was generating the `unique_key` by directly concatenating database values without proper string formatting and padding, while the `matching/route.js` file was using a `padLeft` helper function to ensure consistent formatting.

### Before (Incorrect):
```javascript
const uniqueKey = `${yearLastTwo}-${row.draw_sequence}-${row.set_number}-${row.six_digit_number}-${row.book_number}`;
// Result: "67-48-32-23443-4154" (missing leading zero in six-digit number)
```

### After (Correct):
```javascript
const padLeft = (value, length) => value.toString().padStart(length, '0');
const ds = padLeft(row.draw_sequence ?? '', 2);
const sn = typeof row.set_number === 'string' ? row.set_number.padStart(2, '0') : padLeft(row.set_number ?? '', 2);
const six = padLeft(row.six_digit_number ?? '', 6);
const bookRaw = (row.book_number ?? '').toString();
const bn = bookRaw.length >= 4 ? bookRaw : bookRaw.padStart(4, '0');
const uniqueKey = `${yearLastTwo}-${ds}-${sn}-${six}-${bn}`;
// Result: "67-48-32-023443-4154" (properly formatted)
```

## Solution Implemented

1. **Added `padLeft` helper function** to the unused-numbers route to match the formatting logic used in the matching route
2. **Applied proper padding** to all components of the unique key:
   - `draw_sequence`: padded to 2 digits
   - `set_number`: padded to 2 digits (handles both string and number types)
   - `six_digit_number`: padded to 6 digits with leading zeros
   - `book_number`: padded to minimum 4 digits, keeps longer numbers as-is

3. **Updated database schema documentation** to include the `origin_number` field that was missing from the design document

## Format Consistency

Both `origin_number` (stored in `lottery_matched_numbers` table) and `unique_key` (generated in unused-numbers API) now use the same formatting logic:

- **Format**: `YY-DS-SN-XXXXXX-BBBB`
- **YY**: 2-digit year (last 2 digits of Buddhist Era year)
- **DS**: 2-digit draw sequence (padded with leading zeros)
- **SN**: 2-digit set number (padded with leading zeros)
- **XXXXXX**: 6-digit lottery number (padded with leading zeros)
- **BBBB**: Book number (minimum 4 digits, longer numbers preserved)

## Files Modified

1. **`src/app/api/lottery/unused-numbers/route.js`**
   - Added `padLeft` helper function
   - Updated unique key generation logic to use proper padding

2. **`documents/LOTTERY_MATCHING_DESIGN.md`**
   - Added `origin_number` field to `lottery_matched_numbers` table schema
   - Added index for `origin_number` field for better performance

## Result

The unique key format is now consistent across the entire system:
- All lottery numbers are properly formatted with leading zeros
- The unused numbers API correctly matches against the origin numbers stored in the database
- Data consistency is maintained between different parts of the system
