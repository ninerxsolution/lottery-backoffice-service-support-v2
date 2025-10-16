## Lottery Numbers Input Format

- **Format**: `YY-DS-SN-XXXXXX-BBBB`
  - **YY**: two-digit year. Converted to BE as `2500 + YY` (e.g., `67` -> `2567`).
  - **DS**: draw_sequence (two digits)
  - **SN**: set_number (two digits)
  - **XXXXXX**: six_digit_number (six digits)
  - **BBBB**: book_number (1-6 digits)

- Fixed values:
  - `lottery_draw_id = 0`
  - `branch_id = 0`
  - `ticket_count = 0`
  - `group_type = 'row'`

- API
  - POST `api/lottery/numbers` with body `{ "raw": "67-48-09-763401-5755" }`
  - Validates format and inserts into `lottery_numbers`.

- UI
  - Page `/(pages)/lottery/numbers` provides a text input to submit the scanned string and refreshes the list.


