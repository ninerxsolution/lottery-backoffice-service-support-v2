import { createConnection } from '../../../../lib/database';

export async function GET() {
  try {
    const connectionString = process.env.DATABASE_URL;

    if (!connectionString) {
      return Response.json({
        success: false,
        message: 'DATABASE_URL environment variable is not set'
      }, { status: 500 });
    }

    const connection = createConnection(connectionString);

    if (connectionString.startsWith('postgresql://') || connectionString.startsWith('postgres://')) {
      const client = await connection.connect();
      const result = await client.query('SELECT year_number, draw_sequence, set_number, six_digit_number, book_number FROM lottery_numbers ORDER BY six_digit_number');
      client.release();
      await connection.end();

      return Response.json({
        success: true,
        data: result.rows.map(r => ({ year_number: r.year_number, draw_sequence: r.draw_sequence, set_number: r.set_number, six_digit_number: r.six_digit_number, book_number: r.book_number }))
      });

    }

    return Response.json({
      success: false,
      message: 'Unsupported database type in DATABASE_URL'
    }, { status: 400 });

  } catch (error) {
    console.error('Error fetching lottery numbers:', error);
    return Response.json({
      success: false,
      message: 'Failed to fetch lottery numbers from database',
      error: error.message
    }, { status: 500 });
  }
}


export async function POST(request) {
  try {
    const connectionString = process.env.DATABASE_URL;

    if (!connectionString) {
      return Response.json({
        success: false,
        message: 'DATABASE_URL environment variable is not set'
      }, { status: 500 });
    }

    const { raw } = await request.json();
    if (!raw || typeof raw !== 'string') {
      return Response.json({ success: false, message: 'Missing body.raw string' }, { status: 400 });
    }

    // Expected format: "YY-DS-SN-XXXXXX-BBBB"
    const parts = raw.split('-');
    if (parts.length !== 5) {
      return Response.json({ success: false, message: 'Invalid format. Expected YY-DS-SN-XXXXXX-BBBB' }, { status: 400 });
    }

    const [yyStr, drawSeqStr, setNumStr, sixStr, bookStr] = parts.map(p => p.trim());

    if (!/^\d{2}$/.test(yyStr)) {
      return Response.json({ success: false, message: 'Invalid year segment' }, { status: 400 });
    }
    if (!/^\d{2}$/.test(drawSeqStr)) {
      return Response.json({ success: false, message: 'Invalid draw_sequence segment' }, { status: 400 });
    }
    if (!/^\d{2}$/.test(setNumStr)) {
      return Response.json({ success: false, message: 'Invalid set_number segment' }, { status: 400 });
    }
    if (!/^\d{6}$/.test(sixStr)) {
      return Response.json({ success: false, message: 'Invalid six_digit_number segment' }, { status: 400 });
    }
    if (!/^\d{1,6}$/.test(bookStr)) {
      return Response.json({ success: false, message: 'Invalid book_number segment' }, { status: 400 });
    }

    const yy = parseInt(yyStr, 10);
    // Convert to Buddhist Era: use 2500 + YY (e.g., '67' -> 2567)
    const year_number = 2500 + yy;
    const draw_sequence = drawSeqStr; // Keep as string
    const set_number = setNumStr; // Keep as string to preserve leading zeros like '09'
    const six_digit_number = sixStr; // Keep as string
    const book_number = bookStr; // Keep as string
    const lottery_draw_id = 0;
    const branch_id = 0;
    const ticket_count = 0;
    const group_type = 'row';

    const connection = createConnection(connectionString);

    if (connectionString.startsWith('postgresql://') || connectionString.startsWith('postgres://')) {
      const client = await connection.connect();
      try {
        // Ensure primary key sequence is in sync to avoid duplicate key on id
        await client.query(`
          SELECT setval(
            pg_get_serial_sequence('lottery_numbers', 'id'),
            COALESCE((SELECT MAX(id) FROM lottery_numbers), 0)
          )
        `);

        // Check if this exact combination already exists
        const checkSql = `
          SELECT id FROM lottery_numbers 
          WHERE year_number = $1 
            AND draw_sequence = $2 
            AND set_number = $3 
            AND six_digit_number = $4 
            AND book_number = $5
        `;
        const checkResult = await client.query(checkSql, [
          year_number, draw_sequence, set_number, six_digit_number, book_number
        ]);
        
        if (checkResult.rows.length > 0) {
          return Response.json({
            success: false,
            message: 'หมายเลขชุดนี้มีอยู่ในระบบแล้ว (ปี-งวด-เซ็ต-หมายเลข-เล่ม)',
            error: 'Duplicate entry'
          }, { status: 409 });
        }

        const insertSql = `
          INSERT INTO lottery_numbers (
            year_number, draw_sequence, set_number, six_digit_number, book_number,
            lottery_draw_id, branch_id, ticket_count, group_type
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
          RETURNING six_digit_number
        `;
        const result = await client.query(insertSql, [
          year_number, draw_sequence, set_number, six_digit_number, book_number,
          lottery_draw_id, branch_id, ticket_count, group_type
        ]);
        return Response.json({ success: true, data: { six_digit_number: result.rows[0].six_digit_number } }, { status: 201 });
      } finally {
        client.release();
        await connection.end();
      }

    }

    return Response.json({
      success: false,
      message: 'Unsupported database type in DATABASE_URL'
    }, { status: 400 });

  } catch (error) {
    console.error('Error inserting lottery number:', error);
    
    // Handle specific database errors
    if (error.code === '23505') { // PostgreSQL unique constraint violation
      return Response.json({
        success: false,
        message: 'This lottery number already exists in the database',
        error: 'Duplicate entry'
      }, { status: 409 });
    }
    
    return Response.json({
      success: false,
      message: 'Failed to insert lottery number',
      error: error.message
    }, { status: 500 });
  }
}


