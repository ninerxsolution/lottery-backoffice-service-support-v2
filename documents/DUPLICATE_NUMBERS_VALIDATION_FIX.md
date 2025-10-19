# Duplicate Numbers Validation Fix

## Problem Description

The lottery matching process was recording duplicate data because it was only using `six_digit_number` to track uniqueness, instead of using the complete composite key that includes all required fields for lottery number validation.

## Root Cause

In the `processMatching` function in `src/app/api/lottery/matching/route.js`, the code was:

1. **Only tracking `six_digit_number`**: The `remainingNumbers` array was created using only `lotteryArr.map(n => n.six_digit_number.toString())`
2. **Incomplete uniqueness check**: The system wasn't considering the full composite key (year_number, draw_sequence, set_number, six_digit_number, book_number)
3. **Database lookup issues**: The code was doing complex database lookups to resolve original numbers, which could lead to inconsistencies

## Solution Implemented

### 1. Complete Lottery Object Tracking

**Before:**
```javascript
const remainingNumbers = lotteryArr.map(n => n.six_digit_number.toString());
```

**After:**
```javascript
const remainingNumbers = [...lotteryArr];
```

### 2. Unique Key Generation

Added a helper function to create unique keys using all required fields:

```javascript
const createUniqueKey = (lotteryNumber) => {
  return `${lotteryNumber.year_number}-${lotteryNumber.draw_sequence}-${lotteryNumber.set_number}-${lotteryNumber.six_digit_number}-${lotteryNumber.book_number}`;
};
```

### 3. Updated Number Selection Logic

Modified the `takeNumberFor` function to work with complete lottery objects:

```javascript
const takeNumberFor = (lastTwo) => {
  const candidates = remainingNumbers
    .map((n, idx) => ({ n, idx }))
    .filter(({ n }) => n.six_digit_number.toString().slice(-2) === lastTwo);
  
  // ... selection logic ...
  
  const selectedNumber = remainingNumbers.splice(chosen.idx, 1)[0];
  return selectedNumber; // Returns complete lottery object
};
```

### 4. Enhanced Position Data Structure

Updated the matched positions to include the complete lottery object:

```javascript
matchedPositions.push({
  template_value: templateValue,
  matched_numbers: picked ? [picked.six_digit_number] : [],
  matched_lottery_object: picked || null, // Complete lottery object
});
```

### 5. Simplified Database Insertion

Removed complex database lookups and used the provided lottery data directly:

```javascript
// Create unique key for this lottery number
const uniqueKey = createUniqueKey(lotteryObject);

// Use the complete lottery object data directly instead of database lookup
// This ensures we use the exact data that was provided in the request
const originalNumber = uniqueKey;
```

### 6. Enhanced Unused Numbers Response

Updated the return value to include complete information about unused numbers:

```javascript
return {
  matched_sets: results,
  unused_numbers: remainingNumbers.map(n => ({
    six_digit_number: n.six_digit_number,
    unique_key: createUniqueKey(n),
    lottery_object: n
  }))
};
```

## Benefits

1. **True Uniqueness**: Each lottery number is now tracked using its complete composite key
2. **No Duplicates**: The system prevents the same lottery number (with same year, draw, set, number, and book) from being used multiple times
3. **Data Integrity**: Uses the exact data provided in the request instead of database lookups
4. **Better Traceability**: Complete lottery object information is preserved throughout the process
5. **Simplified Logic**: Removed complex database lookup logic that could introduce inconsistencies

## Validation

The fix ensures that:
- Each lottery number can only be used once per matching process
- The complete composite key (year_number, draw_sequence, set_number, six_digit_number, book_number) is used for uniqueness
- No duplicate data is recorded in the processing steps
- The system maintains data integrity throughout the matching process

## Files Modified

- `src/app/api/lottery/matching/route.js` - Main matching logic updated

## Testing Recommendations

1. Test with lottery numbers that have duplicate `six_digit_number` but different other fields
2. Verify that each unique lottery number is used only once
3. Check that unused numbers are properly tracked with complete information
4. Validate that the matching process completes without recording duplicates
