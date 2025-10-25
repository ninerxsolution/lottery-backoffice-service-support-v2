# Group Criteria Validation Update

## Overview
เพิ่มการตรวจสอบและ validation สำหรับ `groupCriteria` เพื่อป้องกันการสร้าง matched_sets ที่มีค่า `null` ในฟิลด์ `lottery_draw_id`, `branch_id`, `ticket_count`

## การเปลี่ยนแปลง

### 1. API Validation (POST /api/lottery/matching)

#### ตรวจสอบ groupCriteria ต้องมีค่า
```javascript
// ตรวจสอบ group criteria - ต้องมีค่าทั้งหมด
if (!groupCriteria) {
  return Response.json({
    success: false,
    message: 'groupCriteria is required and must include lottery_draw_id, branch_id, ticket_count, and group_type'
  }, { status: 400 });
}
```

#### ตรวจสอบฟิลด์ที่จำเป็น
```javascript
// ตรวจสอบว่าทุกฟิลด์ใน group criteria มีค่า
const requiredFields = ['lottery_draw_id', 'branch_id', 'ticket_count', 'group_type'];
const missingFields = requiredFields.filter(field => 
  groupCriteria[field] === undefined || groupCriteria[field] === null || groupCriteria[field] === ''
);

if (missingFields.length > 0) {
  return Response.json({
    success: false,
    message: `Missing required group criteria fields: ${missingFields.join(', ')}`
  }, { status: 400 });
}
```

#### ตรวจสอบความสอดคล้องของ lottery numbers
```javascript
// ตรวจสอบว่า lottery numbers มี group criteria ตรงกัน
const invalidNumbers = lotteryNumbers.filter(num => 
  num.lottery_draw_id !== groupCriteria.lottery_draw_id ||
  num.branch_id !== groupCriteria.branch_id ||
  num.ticket_count !== groupCriteria.ticket_count ||
  num.group_type !== groupCriteria.group_type
);

if (invalidNumbers.length > 0) {
  return Response.json({
    success: false,
    message: `Found ${invalidNumbers.length} lottery numbers with mismatched group criteria. All numbers must have the same lottery_draw_id, branch_id, ticket_count, and group_type.`
  }, { status: 400 });
}
```

### 2. Function Validation

#### processIncrementalMatching()
```javascript
// ตรวจสอบ group criteria
if (!groupCriteria) {
  throw new Error('groupCriteria is required for processIncrementalMatching');
}

const requiredFields = ['lottery_draw_id', 'branch_id', 'ticket_count', 'group_type'];
const missingFields = requiredFields.filter(field => 
  groupCriteria[field] === undefined || groupCriteria[field] === null || groupCriteria[field] === ''
);

if (missingFields.length > 0) {
  throw new Error(`Missing required group criteria fields: ${missingFields.join(', ')}`);
}
```

#### processMatching()
```javascript
// ตรวจสอบ group criteria
if (!groupCriteria) {
  throw new Error('groupCriteria is required for processMatching');
}

const requiredFields = ['lottery_draw_id', 'branch_id', 'ticket_count', 'group_type'];
const missingFields = requiredFields.filter(field => 
  groupCriteria[field] === undefined || groupCriteria[field] === null || groupCriteria[field] === ''
);

if (missingFields.length > 0) {
  throw new Error(`Missing required group criteria fields: ${missingFields.join(', ')}`);
}
```

### 3. Frontend Update

#### สร้าง groupCriteria ที่มีค่า default
```javascript
// สร้าง group criteria จาก lottery numbers (ใช้ค่าจากตัวแรก)
const groupCriteria = lotteryNumbers.length > 0 ? {
    lottery_draw_id: lotteryNumbers[0].lottery_draw_id || 0,
    branch_id: lotteryNumbers[0].branch_id || 0,
    ticket_count: lotteryNumbers[0].ticket_count || 0,
    group_type: lotteryNumbers[0].group_type || 'row'
} : {
    lottery_draw_id: 0,
    branch_id: 0,
    ticket_count: 0,
    group_type: 'row'
};
```

## Error Messages

### 1. Missing groupCriteria
```
"groupCriteria is required and must include lottery_draw_id, branch_id, ticket_count, and group_type"
```

### 2. Missing Required Fields
```
"Missing required group criteria fields: lottery_draw_id, branch_id"
```

### 3. Mismatched Group Criteria
```
"Found 5 lottery numbers with mismatched group criteria. All numbers must have the same lottery_draw_id, branch_id, ticket_count, and group_type."
```

## การทำงาน

1. **API Level**: ตรวจสอบ `groupCriteria` ก่อนประมวลผล
2. **Function Level**: ตรวจสอบใน `processIncrementalMatching()` และ `processMatching()`
3. **Frontend Level**: สร้าง `groupCriteria` ที่มีค่า default เพื่อป้องกัน `null`

## ข้อดี

- **ป้องกัน null values**: ไม่ให้สร้าง matched_sets ที่มีค่า `null`
- **Data Integrity**: ตรวจสอบความสอดคล้องของข้อมูล
- **Clear Error Messages**: แจ้งข้อผิดพลาดที่ชัดเจน
- **Fail Fast**: หยุดการประมวลผลทันทีเมื่อพบปัญหา

## การทดสอบ

1. **ทดสอบส่ง groupCriteria เป็น null**: ควรได้ error message
2. **ทดสอบส่งฟิลด์บางตัวเป็น null**: ควรได้ error message
3. **ทดสอบส่ง lottery numbers ที่มี group criteria ไม่ตรงกัน**: ควรได้ error message
4. **ทดสอบส่งข้อมูลที่ถูกต้อง**: ควรทำงานได้ปกติและเก็บข้อมูลใน matched_sets
