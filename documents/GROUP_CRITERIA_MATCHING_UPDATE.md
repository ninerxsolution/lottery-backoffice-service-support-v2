# Group Criteria Matching Update

## Overview
อัปเดตระบบ lottery matching เพื่อเพิ่มการจัดกลุ่มตาม `lottery_draw_id`, `branch_id`, `ticket_count`, และ `group_type` เพื่อให้ lottery numbers ที่มีค่าเดียวกันเท่านั้นถึงจะสามารถจัดเข้า matched_sets ได้

## การเปลี่ยนแปลง

### 1. Database Schema Changes
เพิ่มคอลัมน์ใหม่ใน `lottery_matched_sets` table:
- `lottery_draw_id` (INTEGER)
- `branch_id` (INTEGER) 
- `ticket_count` (INTEGER)

### 2. API Changes

#### POST /api/lottery/matching
เพิ่ม parameter `groupCriteria` ใน request body:

```json
{
  "templateId": 1,
  "lotteryNumbers": [...],
  "groupCriteria": {
    "lottery_draw_id": 1,
    "branch_id": 2,
    "ticket_count": 10,
    "group_type": "row"
  }
}
```

### 3. Function Updates

#### getUnusedNumbers()
- เพิ่ม parameter `groupCriteria`
- เพิ่มการกรอง lottery numbers ตาม group criteria
- เพิ่มฟิลด์ใหม่ในการ SELECT query

#### processIncrementalMatching()
- เพิ่ม parameter `groupCriteria`
- ส่ง group criteria ไปยัง `getUnusedNumbers()`
- กรอง newNumbers ตาม group criteria

#### processMatching()
- เพิ่ม parameter `groupCriteria`
- เก็บข้อมูล group criteria ใน matched_sets
- อัปเดต INSERT query เพื่อรวมฟิลด์ใหม่

## การใช้งาน

### 1. รัน Database Migration
```sql
-- รันไฟล์ database_migration_add_group_fields.sql
```

### 2. เรียกใช้ API
```javascript
// ตัวอย่างการเรียกใช้
const response = await fetch('/api/lottery/matching', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    templateId: 1,
    lotteryNumbers: [
      {
        year_number: 2568,
        draw_sequence: 66,
        set_number: 14,
        six_digit_number: 2706,
        book_number: 9408,
        lottery_draw_id: 1,
        branch_id: 2,
        ticket_count: 10,
        group_type: 'row'
      }
    ],
    groupCriteria: {
      lottery_draw_id: 1,
      branch_id: 2,
      ticket_count: 10,
      group_type: 'row'
    }
  })
});
```

## Logic การทำงาน

1. **การกรอง Lottery Numbers**: ระบบจะกรอง lottery numbers ที่มี `lottery_draw_id`, `branch_id`, `ticket_count`, `group_type` ตรงกับ group criteria เท่านั้น

2. **การจัดกลุ่ม**: Lottery numbers ที่มี group criteria เหมือนกันจะถูกจัดเข้า matched_sets เดียวกัน

3. **การเก็บข้อมูล**: ข้อมูล group criteria จะถูกเก็บใน `lottery_matched_sets` table เพื่อใช้ในการ query และแสดงผล

## ข้อดี

- **การแยกข้อมูล**: สามารถแยก lottery numbers ตาม draw, branch, ticket count ได้
- **ความยืดหยุ่น**: สามารถกำหนด group criteria ได้ตามต้องการ
- **การจัดการที่ดีขึ้น**: ข้อมูลถูกจัดกลุ่มอย่างเป็นระบบ

## หมายเหตุ

- หากไม่ส่ง `groupCriteria` ระบบจะทำงานเหมือนเดิม (backward compatible)
- ฟิลด์ใน `groupCriteria` เป็น optional ทั้งหมด
- ระบบจะกรองเฉพาะฟิลด์ที่มีค่าเท่านั้น
