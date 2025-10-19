import { createConnection } from '@/lib/database';

/**
 * GET /api/lottery/matching
 * Fetch all matched lottery sets with completion status
 */
export async function GET(request) {
  try {
    const connectionString = process.env.DATABASE_URL;

    if (!connectionString) {
      return Response.json({
        success: false,
        message: 'DATABASE_URL environment variable is not set'
      }, { status: 500 });
    }

    const connection = createConnection(connectionString);
    const { searchParams } = new URL(request.url);
    const templateId = searchParams.get('template_id');
    const isComplete = searchParams.get('is_complete');
    const verticalRow = searchParams.get('vertical_row');
    const searchNumber = searchParams.get('search_number');

    let query = `
      SELECT 
        lms.id,
        lms.template_id,
        lms.vertical_row_index,
        lms.is_complete,
        lms.matched_numbers,
        lms.created_at,
        lms.updated_at,
        COUNT(lmn.id) as matched_count
      FROM lottery_matched_sets lms
      LEFT JOIN lottery_matched_numbers lmn ON lms.id = lmn.matched_set_id
    `;

    const conditions = [];
    const params = [];
    let paramIndex = 1;

    if (templateId) {
      conditions.push(`lms.template_id = $${paramIndex}`);
      params.push(templateId);
      paramIndex++;
    }

    if (isComplete !== null && isComplete !== undefined) {
      conditions.push(`lms.is_complete = $${paramIndex}`);
      params.push(isComplete === 'true');
      paramIndex++;
    }

    if (verticalRow !== null && verticalRow !== undefined) {
      conditions.push(`lms.vertical_row_index = $${paramIndex}`);
      params.push(parseInt(verticalRow));
      paramIndex++;
    }

    if (searchNumber) {
      // Search for the number in both the matched_numbers JSONB field and origin_number field
      // This will search in the matched_numbers array within each position AND in lottery_matched_numbers.origin_number
      conditions.push(`(
        EXISTS (
          SELECT 1 
          FROM jsonb_array_elements(lms.matched_numbers->'positions') AS position,
               jsonb_array_elements_text(position->'matched_numbers') AS matched_num
          WHERE matched_num = $${paramIndex}
        ) OR EXISTS (
          SELECT 1 
          FROM lottery_matched_numbers lmn
          WHERE lmn.matched_set_id = lms.id 
            AND lmn.origin_number = $${paramIndex + 1}
        )
      )`);
      params.push(searchNumber);
      params.push(searchNumber);
      paramIndex += 2;
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' GROUP BY lms.id ORDER BY lms.created_at DESC';

    let result;

    if (connectionString.startsWith('postgresql://') || connectionString.startsWith('postgres://')) {
      const client = await connection.connect();
      result = await client.query(query, params);
      client.release();
      await connection.end();

      return Response.json({
        success: true,
        data: result.rows,
        count: result.rows.length
      });
    }
  } catch (error) {
    console.error('Error fetching matched lottery sets:', error);
    return Response.json({
      success: false,
      message: 'Failed to fetch matched lottery sets',
      error: error.message
    }, { status: 500 });
  }
}

/**
 * POST /api/lottery/matching
 * Process lottery numbers against templates and create matched sets
 */
export async function POST(request) {
  try {
    const connectionString = process.env.DATABASE_URL;

    if (!connectionString) {
      return Response.json({
        success: false,
        message: 'DATABASE_URL environment variable is not set'
      }, { status: 500 });
    }

    const body = await request.json();
    const { templateId = 1, lotteryNumbers } = body;

    if (!lotteryNumbers || !Array.isArray(lotteryNumbers)) {
      return Response.json({
        success: false,
        message: 'lotteryNumbers array is required'
      }, { status: 400 });
    }

    const connection = createConnection(connectionString);

    let templateResult;

    if (connectionString.startsWith('postgresql://') || connectionString.startsWith('postgres://')) {
      const client = await connection.connect();

      // Clear existing data before new processing
      await client.query('DELETE FROM lottery_matched_numbers');
      await client.query('DELETE FROM lottery_matched_sets');

      templateResult = await client.query('SELECT columns FROM lottery_templates WHERE id = $1', [templateId]);
      client.release();

      if (templateResult.rows.length === 0) {
        await connection.end();
        return Response.json({
          success: false,
          message: 'Template not found'
        }, { status: 404 });
      }

      const rawTemplate = templateResult.rows[0].columns;
      const templateGrid = Array.isArray(rawTemplate?.columns) ? rawTemplate.columns : rawTemplate;
      if (!Array.isArray(templateGrid)) {
        await connection.end();
        return Response.json({ success: false, message: 'Template columns data is invalid' }, { status: 400 });
      }

      const lotteryArr = lotteryNumbers;

      const processedResults = await processMatching(connection, templateGrid, lotteryArr, templateId);
      await connection.end();

      return Response.json({
        success: true,
        data: processedResults
      });

    }

  } catch (error) {
    console.error('Error processing lottery matching:', error);
    return Response.json({
      success: false,
      message: 'Failed to process lottery matching',
      error: error.message
    }, { status: 500 });
  }
}

/**
 * DELETE /api/lottery/matching
 * Clear all matched sets and numbers from database
 */
export async function DELETE() {
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

      // Delete in correct order due to foreign key constraints
      await client.query('DELETE FROM lottery_matched_numbers');
      await client.query('DELETE FROM lottery_matched_sets');

      client.release();
      await connection.end();

      return Response.json({
        success: true,
        message: 'All matched sets and numbers cleared from database'
      });
    }
  } catch (error) {
    console.error('Error clearing matched data:', error);
    return Response.json({
      success: false,
      message: 'Failed to clear matched data from database',
      error: error.message
    }, { status: 500 });
  }
}

/**
 * Process matching logic for lottery numbers against template
 */
async function processMatching(connection, template, lotteryArr, templateId) {
  const connectionString = process.env.DATABASE_URL;
  const results = [];

  // lotteryArr
  // [
  //     {
  //       year_number: '2568', required for validate unique in Query WHERE (slide to get last 2 characters before)
  //       draw_sequence: '66', required for validate unique in Query WHERE
  //       set_number: '14', required for validate unique in Query WHERE
  //       six_digit_number: '002706', required for validate unique in Query WHERE
  //       book_number: '9408' required for validate unique in Query WHERE
  //     },
  //     {
  //       year_number: '2568',
  //       draw_sequence: '66',
  //       set_number: '09',
  //       six_digit_number: '007508',
  //       book_number: '8956'
  //     },


  // Make a working copy and track usage to enforce single-use
  // Use complete lottery number objects instead of just six_digit_number
  const remainingNumbers = [...lotteryArr];

  // Helper to create unique key for lottery number
  const createUniqueKey = (lotteryNumber) => {
    return `${lotteryNumber.year_number.slice(-2)}-${lotteryNumber.draw_sequence}-${lotteryNumber.set_number}-${lotteryNumber.six_digit_number}-${lotteryNumber.book_number}`;
  };

  // Helper to count how many numbers available for a specific last-two-digits
  const countAvailable = (lastTwo) => {
    return remainingNumbers.filter(n => n.six_digit_number.toString().slice(-2) === lastTwo).length;
  };

  // Helper to take the rarest number (least common last-two-digits first)
  const takeNumberFor = (lastTwo) => {
    const candidates = remainingNumbers
      .map((n, idx) => ({ n, idx }))
      .filter(({ n }) => n.six_digit_number.toString().slice(-2) === lastTwo);

    if (candidates.length === 0) return null;

    // Among candidates, pick the one whose last-two-digits is rarest overall
    const scored = candidates.map(({ n, idx }) => {
      const lastTwoOfN = n.six_digit_number.toString().slice(-2);
      const rarity = countAvailable(lastTwoOfN); // lower is rarer
      return { n, idx, rarity };
    });

    // Sort by rarity (ascending) - prefer rarer numbers
    scored.sort((a, b) => a.rarity - b.rarity);
    const chosen = scored[0];

    const selectedNumber = remainingNumbers.splice(chosen.idx, 1)[0];
    return selectedNumber;
  };

  // Calculate potential for each column dynamically
  const calculateColumnPotential = (colIndex) => {
    let potential = 0;
    for (let rowIndex = 0; rowIndex < 10; rowIndex++) {
      const lastTwo = template[colIndex][rowIndex];
      if (countAvailable(lastTwo) > 0) potential++;
    }
    return potential;
  };

  // Process columns dynamically - allow multiple sets per column
  // Keep generating sets while there is at least one column with potential > 0
  // Safety cap to avoid infinite loops in unexpected cases
  let safetyCounter = 0;
  const maxIterations = Math.max(10, lotteryArr.length * 2);
  while (safetyCounter < maxIterations) {
    safetyCounter++;

    // Find best column (highest potential) in current state
    let bestCol = -1;
    let bestPotential = -1;

    for (let colIndex = 0; colIndex < 10; colIndex++) {
      const potential = calculateColumnPotential(colIndex);
      if (potential > bestPotential) {
        bestPotential = potential;
        bestCol = colIndex;
      }
    }

    // Stop if no column can be filled further
    if (bestCol === -1 || bestPotential <= 0) break;

    // Process this column
    const matchedPositions = [];
    let filledPositions = 0;

    for (let rowIndex = 0; rowIndex < 10; rowIndex++) {
      const templateValue = template[bestCol][rowIndex];
      const picked = takeNumberFor(templateValue);
      if (picked) filledPositions++;
      matchedPositions.push({
        template_value: templateValue,
        matched_numbers: picked ? [picked.six_digit_number] : [],
        matched_lottery_object: picked || null,
        // is_filled removed; derive via matched_numbers.length > 0
      });
    }

    const isComplete = filledPositions === 10;

    const matchedSetData = {
      template_id: templateId,
      vertical_row_index: bestCol,
      is_complete: isComplete,
      matched_numbers: JSON.stringify({
        positions: matchedPositions,
        completion_stats: {
          total_positions: 10,
          filled_positions: filledPositions,
          completion_percentage: Math.round((filledPositions / 10) * 100)
        }
      })
    };

    // Insert set
    let insertResult;
    if (connectionString.startsWith('postgresql://') || connectionString.startsWith('postgres://')) {
      const client = await connection.connect();
      insertResult = await client.query(`
        INSERT INTO lottery_matched_sets (template_id, vertical_row_index, is_complete, matched_numbers)
        VALUES ($1, $2, $3, $4)
        RETURNING id
      `, [matchedSetData.template_id, matchedSetData.vertical_row_index, matchedSetData.is_complete, matchedSetData.matched_numbers]);
      client.release();
    }

    const matchedSetId = insertResult.rows[0].id;
    // Insert matched numbers (only those actually used)
    for (let rowIndex = 0; rowIndex < matchedPositions.length; rowIndex++) {
      const position = matchedPositions[rowIndex];
      if (!position.matched_lottery_object) continue;
      
      const lotteryObject = position.matched_lottery_object;
      const lotteryNumber = lotteryObject.six_digit_number;
      const lastTwoDigits = lotteryNumber.toString().slice(-2);
      
      if (connectionString.startsWith('postgresql://') || connectionString.startsWith('postgres://')) {
        const client = await connection.connect();
        try {
          // Create unique key for this lottery number
          const uniqueKey = createUniqueKey(lotteryObject);
          
          // Use the complete lottery object data directly instead of database lookup
          // This ensures we use the exact data that was provided in the request
          const originalNumber = uniqueKey;

          await client.query(`
            INSERT INTO lottery_matched_numbers (matched_set_id, lottery_number, last_two_digits, position_in_row, origin_number)
            VALUES ($1, $2, $3, $4, $5)
          `, [matchedSetId, lotteryNumber, lastTwoDigits, rowIndex, originalNumber]);
        } finally {
          client.release();
        }
      }
    }

    results.push({
      id: matchedSetId,
      vertical_row_index: bestCol,
      is_complete: isComplete,
      completion_percentage: Math.round((filledPositions / 10) * 100),
      filled_positions: filledPositions,
      total_positions: 10,
      matched_numbers: matchedPositions
    });
  }

  return {
    matched_sets: results,
    unused_numbers: remainingNumbers.map(n => ({
      six_digit_number: n.six_digit_number,
      unique_key: createUniqueKey(n),
      lottery_object: n
    }))
  };
}
