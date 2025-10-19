import { createConnection } from '@/lib/database';

/**
 * GET /api/lottery/duplicate-check
 * Check for duplicate six_digit_numbers in lottery_numbers table
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
        // Find all six_digit_numbers that appear more than once
        const duplicateQuery = `
          SELECT 
            six_digit_number,
            COUNT(*) as duplicate_count,
            ARRAY_AGG(
              CONCAT(
                SUBSTRING(year_number::text, -2), '-',
                LPAD(draw_sequence::text, 2, '0'), '-',
                LPAD(set_number::text, 2, '0'), '-',
                LPAD(six_digit_number::text, 6, '0'), '-',
                LPAD(book_number::text, 4, '0')
              )
            ) as full_keys,
            ARRAY_AGG(id) as record_ids
          FROM lottery_numbers 
          GROUP BY six_digit_number 
          HAVING COUNT(*) > 1
          ORDER BY six_digit_number
        `;
        
        const result = await client.query(duplicateQuery);
        
        // Get total count of all lottery numbers
        const totalCountResult = await client.query('SELECT COUNT(*) as total FROM lottery_numbers');
        const totalCount = totalCountResult.rows[0].total;
        
        // Get count of unique six_digit_numbers
        const uniqueCountResult = await client.query('SELECT COUNT(DISTINCT six_digit_number) as unique_count FROM lottery_numbers');
        const uniqueCount = uniqueCountResult.rows[0].unique_count;
        
        const duplicateCount = totalCount - uniqueCount;
        
        return Response.json({
          success: true,
          data: {
            has_duplicates: result.rows.length > 0,
            duplicate_groups: result.rows.length,
            total_duplicate_records: duplicateCount,
            total_records: parseInt(totalCount),
            unique_six_digit_numbers: parseInt(uniqueCount),
            duplicates: result.rows.map(row => ({
              six_digit_number: row.six_digit_number,
              duplicate_count: parseInt(row.duplicate_count),
              full_keys: row.full_keys,
              record_ids: row.record_ids
            }))
          }
        });
        
      } finally {
        client.release();
        await connection.end();
      }
    }
    
  } catch (error) {
    console.error('Error checking for duplicates:', error);
    return Response.json({
      success: false,
      message: 'Failed to check for duplicates',
      error: error.message
    }, { status: 500 });
  }
}
