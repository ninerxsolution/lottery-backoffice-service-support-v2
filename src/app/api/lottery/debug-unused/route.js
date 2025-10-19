import { createConnection } from '@/lib/database';

/**
 * GET /api/lottery/debug-unused
 * Debug endpoint to understand the unused numbers calculation
 */
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
      
      try {
        // Get all lottery numbers
        const allNumbersResult = await client.query(`
          SELECT six_digit_number, id
          FROM lottery_numbers 
          ORDER BY six_digit_number
        `);
        
        // Get all used numbers from lottery_matched_numbers with more details
        const usedNumbersResult = await client.query(`
          SELECT lottery_number, COUNT(*) as count
          FROM lottery_matched_numbers 
          WHERE lottery_number IS NOT NULL
          GROUP BY lottery_number
          ORDER BY lottery_number
        `);
        
        // Find numbers in lottery_matched_numbers that don't exist in lottery_numbers
        const orphanedNumbersResult = await client.query(`
          SELECT DISTINCT lmn.lottery_number, COUNT(*) as count
          FROM lottery_matched_numbers lmn
          LEFT JOIN lottery_numbers ln ON lmn.lottery_number::text = ln.six_digit_number::text
          WHERE ln.six_digit_number IS NULL
          GROUP BY lmn.lottery_number
          ORDER BY lmn.lottery_number
        `);
        
        // Get total count of rows in lottery_matched_numbers
        const totalMatchedRowsResult = await client.query(`
          SELECT COUNT(*) as total_rows
          FROM lottery_matched_numbers
        `);
        
        // Get sample data from both tables
        const sampleLotteryNumbers = await client.query(`
          SELECT six_digit_number, id
          FROM lottery_numbers 
          ORDER BY id
          LIMIT 5
        `);
        
        const sampleMatchedNumbers = await client.query(`
          SELECT lottery_number, matched_set_id, id
          FROM lottery_matched_numbers 
          ORDER BY id
          LIMIT 5
        `);
        
        const allNumbers = allNumbersResult.rows.map(row => row.six_digit_number.toString());
        const usedNumbers = new Set(usedNumbersResult.rows.map(row => row.lottery_number.toString()));
        const totalMatchedRows = parseInt(totalMatchedRowsResult.rows[0].total_rows);
        
        // Find unused numbers
        const unusedNumbers = allNumbers.filter(number => !usedNumbers.has(number));
        
        return Response.json({
          success: true,
          data: {
            total_lottery_numbers: allNumbers.length,
            total_matched_rows: totalMatchedRows,
            distinct_used_numbers: usedNumbers.size,
            orphaned_numbers_count: orphanedNumbersResult.rows.length,
            orphaned_numbers: orphanedNumbersResult.rows,
            unused_numbers_count: unusedNumbers.length,
            unused_numbers: unusedNumbers,
            sample_lottery_numbers: sampleLotteryNumbers.rows,
            sample_matched_numbers: sampleMatchedNumbers.rows,
            used_numbers_with_counts: usedNumbersResult.rows.slice(0, 10), // First 10 with counts
            debug_info: {
              all_numbers_sample: allNumbers.slice(0, 5),
              used_numbers_sample: Array.from(usedNumbers).slice(0, 5),
              unused_numbers_sample: unusedNumbers.slice(0, 5),
              explanation: "Orphaned numbers are in lottery_matched_numbers but not in lottery_numbers"
            }
          }
        });
        
      } finally {
        client.release();
        await connection.end();
      }
    }
    
  } catch (error) {
    console.error('Error in debug unused numbers:', error);
    return Response.json({
      success: false,
      message: 'Failed to debug unused numbers',
      error: error.message
    }, { status: 500 });
  }
}
