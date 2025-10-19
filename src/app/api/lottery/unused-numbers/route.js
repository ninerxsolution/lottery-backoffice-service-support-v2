import { createConnection } from '@/lib/database';

/**
 * GET /api/lottery/unused-numbers
 * Calculate unused numbers by comparing lottery_numbers with lottery_matched_numbers
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
        // Get unused numbers by finding lottery_numbers that are not in lottery_matched_numbers
        const lotteryNumbersResult = await client.query(`
          SELECT ln.year_number, ln.draw_sequence, ln.set_number, ln.six_digit_number, ln.book_number
          FROM lottery_numbers ln
        `);

        const matchedNumbersResult = await client.query(`
          SELECT lmn.lottery_number, lmn.origin_number
          FROM lottery_matched_numbers lmn
        `);
        
         // Combine lottery numbers with unique key
         const numbersArr = lotteryNumbersResult.rows.map(row => {
           const yearStr = row.year_number.toString();
           const yearLastTwo = yearStr.substring(yearStr.length - 2); // Get last 2 digits
           const uniqueKey = `${yearLastTwo}-${row.draw_sequence}-${row.set_number}-${row.six_digit_number}-${row.book_number}`;
           return {
             ...row,
             unique_key: uniqueKey
           };
         });

         // Combine matched numbers with unique key from origin_number
         const matchedNumbersArr = matchedNumbersResult.rows.map(row => {
           return {
             ...row
           };
         });

         // Create unused numbers array by finding unique_key that don't have matching origin_number
         const unusedNumbers = [];
         
         for (const lotteryNumber of numbersArr) {
           const isMatched = matchedNumbersArr.some(matched => 
             matched.origin_number === lotteryNumber.unique_key
           );
           
           if (!isMatched) {
             unusedNumbers.push(lotteryNumber);
           }
         }

         const totalLotteryNumbers = lotteryNumbersResult.rows.length;
         const totalMatchedNumbers = matchedNumbersResult.rows.length;
         const totalUnusedNumbers = unusedNumbers.length;

         return Response.json({
           success: true,
           data: {
             total_lottery_numbers: totalLotteryNumbers,
             total_matched_numbers: totalMatchedNumbers,
             total_unused_numbers: totalUnusedNumbers,
             unused_count: totalUnusedNumbers,
             unused_numbers: unusedNumbers.map(item => item.six_digit_number ? item.six_digit_number.toString() : item.toString()),
             arr_unused_numbers: unusedNumbers
           }
         });
        
      } finally {
        client.release();
        await connection.end();
      }
    }
    
  } catch (error) {
    console.error('Error calculating unused numbers:', error);
    return Response.json({
      success: false,
      message: 'Failed to calculate unused numbers',
      error: error.message
    }, { status: 500 });
  }
}
