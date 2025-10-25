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

    if (connectionString.startsWith('postgresql://') || connectionString.startsWith('postgres://')) {
      const client = await connection.connect();

      try {
        const hasShelfItemsTable = await tableExists(client, 'lottery_shelf_items');

        let query = `
          SELECT 
            lms.id,
            lms.template_id,
            lms.vertical_row_index,
            lms.is_complete,
            lms.matched_numbers,
            lms.created_at,
            lms.updated_at,
            lms.status,
            COUNT(lmn.id) as matched_count,
            ${hasShelfItemsTable
              ? "CASE WHEN lsi.id IS NOT NULL THEN 'on_shelf' ELSE COALESCE(lms.status, 'processing') END"
              : "COALESCE(lms.status, 'processing')"} as display_status
          FROM lottery_matched_sets lms
          LEFT JOIN lottery_matched_numbers lmn ON lms.id = lmn.matched_set_id AND (lmn.is_active = true OR lmn.is_active IS NULL)
          ${hasShelfItemsTable ? 'LEFT JOIN lottery_shelf_items lsi ON lms.id = lsi.matched_set_id' : ''}
          WHERE (lms.is_active = true OR lms.is_active IS NULL)
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
          // Search supports both old structure (object with positions->matched_numbers[]) and new compact array structure
          conditions.push(`(
            EXISTS (
              SELECT 1 FROM jsonb_array_elements(
                CASE WHEN jsonb_typeof(lms.matched_numbers) = 'array' THEN lms.matched_numbers ELSE '[]'::jsonb END
              ) AS elem
              WHERE elem->>'matched_numbers' = $${paramIndex}
            ) OR EXISTS (
              SELECT 1 
              FROM jsonb_array_elements(
                CASE WHEN jsonb_typeof(lms.matched_numbers) = 'object' THEN lms.matched_numbers->'positions' ELSE '[]'::jsonb END
              ) AS position,
              jsonb_array_elements_text(COALESCE(position->'matched_numbers', '[]'::jsonb)) AS matched_num
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
          query += ' AND ' + conditions.join(' AND ');
        }

        query += ` GROUP BY lms.id, lms.template_id, lms.vertical_row_index, lms.is_complete, lms.matched_numbers, lms.created_at, lms.updated_at, lms.status${hasShelfItemsTable ? ', lsi.id' : ''} ORDER BY lms.created_at DESC`;

        const result = await client.query(query, params);

        return Response.json({
          success: true,
          data: result.rows,
          count: result.rows.length
        });
      } finally {
        client.release();
        await connection.end();
      }
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
    const { templateId = 1, lotteryNumbers, groupCriteria = null } = body;

    if (!lotteryNumbers || !Array.isArray(lotteryNumbers)) {
      return Response.json({
        success: false,
        message: 'lotteryNumbers array is required'
      }, { status: 400 });
    }

    // สร้าง group criteria ที่ยืดหยุ่น (ใช้ default values ถ้าไม่มี)
    const finalGroupCriteria = {
      lottery_draw_id: groupCriteria?.lottery_draw_id ?? 0,
      branch_id: groupCriteria?.branch_id ?? 0,
      ticket_count: groupCriteria?.ticket_count ?? 0,
      group_type: groupCriteria?.group_type ?? 'row'
    };

    console.log('Final group criteria:', finalGroupCriteria);

    const connection = createConnection(connectionString);

    let templateResult;

    if (connectionString.startsWith('postgresql://') || connectionString.startsWith('postgres://')) {
      const client = await connection.connect();

      // No longer delete existing data - use incremental matching instead

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

      const processedResults = await processIncrementalMatching(connection, templateGrid, lotteryArr, templateId, finalGroupCriteria);
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
 * PUT /api/lottery/matching
 * Manual move complete sets to shelf
 */
export async function PUT(request) {
  try {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      return Response.json({ success: false, message: 'DATABASE_URL environment variable is not set' }, { status: 500 });
    }

    const connection = createConnection(connectionString);

    if (connectionString.startsWith('postgresql://') || connectionString.startsWith('postgres://')) {
      const client = await connection.connect();

      try {
        // Find all complete sets that are still in processing status
        const hasShelfTable = await tableExists(client, 'lottery_shelf');
        const hasShelfItemsTable = await tableExists(client, 'lottery_shelf_items');
        const completeSetsResult = await client.query(`
          SELECT 
            lms.id,
            lms.vertical_row_index,
            lms.is_complete,
            lms.status,
            COUNT(lmn.id) as matched_count
          FROM lottery_matched_sets lms
          LEFT JOIN lottery_matched_numbers lmn ON lms.id = lmn.matched_set_id AND lmn.is_active = true
          WHERE lms.is_complete = true 
            AND (lms.status IS NULL OR lms.status = 'processing')
          GROUP BY lms.id, lms.vertical_row_index, lms.is_complete, lms.status
          ORDER BY lms.id
        `);

        console.log(`Found ${completeSetsResult.rows.length} complete sets to move to shelf`);

        let movedCount = 0;
        for (const set of completeSetsResult.rows) {
          try {
            await moveToShelfAutomatically(client, set.id, { hasShelfTable, hasShelfItemsTable });
            movedCount++;
            console.log(` Moved set ${set.id} to shelf`);
          } catch (error) {
            console.error(` Failed to move set ${set.id}:`, error);
          }
        }

        client.release();
        await connection.end();

        return Response.json({
          success: true,
          message: `Moved ${movedCount} complete sets to shelf`,
          data: { movedCount, totalFound: completeSetsResult.rows.length }
        });

      } catch (error) {
        client.release();
        await connection.end();
        throw error;
      }
    }

  } catch (error) {
    console.error('Error in manual move to shelf:', error);
    return Response.json({ success: false, message: 'Failed to move sets to shelf', error: error.message }, { status: 500 });
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
 * Process incremental matching logic for lottery numbers against template
 * Fills incomplete sets first, then creates new sets from remaining numbers
 * @param {Object} connection - Database connection
 * @param {Array} template - Template grid
 * @param {Array} newNumbers - New lottery numbers to process
 * @param {Number} templateId - Template ID
 * @param {Object} groupCriteria - Group criteria for matching
 */
async function processIncrementalMatching(connection, template, newNumbers, templateId, groupCriteria = null) {
  const connectionString = process.env.DATABASE_URL;
  const results = {
    setsUpdated: 0,
    setsCreated: 0,
    unusedRemaining: 0
  };

  // สร้าง group criteria ที่ยืดหยุ่น (ใช้ default values ถ้าไม่มี)
  const finalGroupCriteria = {
    lottery_draw_id: groupCriteria?.lottery_draw_id ?? 0,
    branch_id: groupCriteria?.branch_id ?? 0,
    ticket_count: groupCriteria?.ticket_count ?? 0,
    group_type: groupCriteria?.group_type ?? 'row'
  };

  if (connectionString.startsWith('postgresql://') || connectionString.startsWith('postgres://')) {
    const client = await connection.connect();

    try {
      // 1. Get existing incomplete sets ordered by matched_count DESC
      const incompleteSetsResult = await client.query(`
        SELECT 
          lms.id,
          lms.template_id,
          lms.vertical_row_index,
          lms.is_complete,
          lms.matched_numbers,
          COUNT(lmn.id) as matched_count
        FROM lottery_matched_sets lms
        LEFT JOIN lottery_matched_numbers lmn ON lms.id = lmn.matched_set_id AND lmn.is_active = true
        WHERE lms.is_active = true AND lms.is_complete = false
        GROUP BY lms.id, lms.template_id, lms.vertical_row_index, lms.is_complete, lms.matched_numbers
        ORDER BY matched_count DESC, lms.created_at ASC
      `);

      // 2. Get unused numbers from database with group criteria
      const unusedNumbers = await getUnusedNumbers(client, finalGroupCriteria);

      // 3. Combine unused + newNumbers (แต่ filter duplicates และ group criteria)
      const allAvailableNumbers = [...unusedNumbers];

      // เพิ่ม newNumbers เฉพาะที่ยังไม่ได้ใช้และตรงกับ group criteria
      for (const newNum of newNumbers) {
        // ตรวจสอบ group criteria (ใช้ default values)
        const numDrawId = newNum.lottery_draw_id ?? 0;
        const numBranchId = newNum.branch_id ?? 0;
        const numTicketCount = newNum.ticket_count ?? 0;
        const numGroupType = newNum.group_type ?? 'row';
        
        if (numDrawId !== finalGroupCriteria.lottery_draw_id) continue;
        if (numBranchId !== finalGroupCriteria.branch_id) continue;
        if (numTicketCount !== finalGroupCriteria.ticket_count) continue;
        if (numGroupType !== finalGroupCriteria.group_type) continue;

        const yearStr = newNum.year_number.toString();
        const yearLastTwo = yearStr.substring(yearStr.length - 2);
        const uniqueKey = `${yearLastTwo}-${newNum.draw_sequence}-${newNum.set_number}-${newNum.six_digit_number}-${newNum.book_number}`;

        // ตรวจสอบว่า number นี้ยังไม่ได้ใช้
        const isAlreadyUsed = allAvailableNumbers.some(num => num.unique_key === uniqueKey);
        if (!isAlreadyUsed) {
          allAvailableNumbers.push({
            ...newNum,
            unique_key: uniqueKey,
            used: false
          });
        }
      }

      // 4. Fill incomplete sets first (prioritize nearly-complete)
      for (const set of incompleteSetsResult.rows) {
        const filledCount = await fillIncompleteSet(client, set, allAvailableNumbers, template);
        if (filledCount > 0) {
          results.setsUpdated++;
          // Check if set is now complete
          await updateSetCompletion(client, set.id);
        }
      }

      // 5. Create new sets from remaining numbers
      const remainingNumbers = allAvailableNumbers.filter(num => !num.used);
      if (remainingNumbers.length > 0) {
        const newSetsResult = await processMatching(connection, template, remainingNumbers, templateId, finalGroupCriteria);
        results.setsCreated = newSetsResult.matched_sets.length;
        results.unusedRemaining = newSetsResult.unused_numbers.length;
      } else {
        results.unusedRemaining = 0;
      }

    } finally {
      client.release();
    }
  }

  return results;
}

/**
 * Get unused numbers from lottery_numbers that are not in lottery_matched_numbers
 * @param {Object} client - Database client
 * @param {Object} groupCriteria - Criteria for grouping (lottery_draw_id, branch_id, ticket_count, group_type)
 */
async function getUnusedNumbers(client, groupCriteria = null) {
  let query = `
    SELECT ln.year_number, ln.draw_sequence, ln.set_number, ln.six_digit_number, ln.book_number,
           ln.lottery_draw_id, ln.branch_id, ln.ticket_count, ln.group_type
    FROM lottery_numbers ln
  `;
  
  const params = [];
  const conditions = [];
  
  // เพิ่มเงื่อนไขการกรองตาม group criteria
  if (groupCriteria) {
    if (groupCriteria.lottery_draw_id !== undefined && groupCriteria.lottery_draw_id !== null) {
      conditions.push(`ln.lottery_draw_id = $${params.length + 1}`);
      params.push(groupCriteria.lottery_draw_id);
    }
    if (groupCriteria.branch_id !== undefined && groupCriteria.branch_id !== null) {
      conditions.push(`ln.branch_id = $${params.length + 1}`);
      params.push(groupCriteria.branch_id);
    }
    if (groupCriteria.ticket_count !== undefined && groupCriteria.ticket_count !== null) {
      conditions.push(`ln.ticket_count = $${params.length + 1}`);
      params.push(groupCriteria.ticket_count);
    }
    if (groupCriteria.group_type !== undefined && groupCriteria.group_type !== null) {
      conditions.push(`ln.group_type = $${params.length + 1}`);
      params.push(groupCriteria.group_type);
    }
  }
  
  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }
  
  const lotteryNumbersResult = await client.query(query, params);
  
  // Debug: ดูข้อมูลที่ได้จาก database
  if (lotteryNumbersResult.rows.length > 0) {
    console.log('Sample lottery numbers from database:', lotteryNumbersResult.rows.slice(0, 3));
    console.log('Group criteria used:', groupCriteria);
  }

  const matchedNumbersResult = await client.query(`
    SELECT lmn.origin_number
    FROM lottery_matched_numbers lmn
    WHERE lmn.is_active = true
  `);

  // Create unique keys for matched numbers
  const matchedKeys = new Set(matchedNumbersResult.rows.map(row => row.origin_number));

  // Filter out matched numbers
  const unusedNumbers = lotteryNumbersResult.rows
    .map(row => {
      const yearStr = row.year_number.toString();
      const yearLastTwo = yearStr.substring(yearStr.length - 2);
      const uniqueKey = `${yearLastTwo}-${row.draw_sequence}-${row.set_number}-${row.six_digit_number}-${row.book_number}`;
      return {
        ...row,
        unique_key: uniqueKey,
        used: false
      };
    })
    .filter(num => !matchedKeys.has(num.unique_key));

  return unusedNumbers;
}

/**
 * Fill incomplete set with available numbers
 */
async function fillIncompleteSet(client, set, availableNumbers, template) {
  const matchedNumbersDataRaw = typeof set.matched_numbers === 'string'
    ? JSON.parse(set.matched_numbers)
    : set.matched_numbers;

  // Convert to compact array structure if needed
  let positionsArray;
  if (Array.isArray(matchedNumbersDataRaw)) {
    positionsArray = matchedNumbersDataRaw;
  } else if (matchedNumbersDataRaw && Array.isArray(matchedNumbersDataRaw.positions)) {
    positionsArray = matchedNumbersDataRaw.positions.map(pos => ({
      template_value: pos.template_value,
      matched_numbers: Array.isArray(pos.matched_numbers) && pos.matched_numbers.length > 0 ? pos.matched_numbers[0] : '',
      unique_key: pos.matched_lottery_object ? createUniqueKey(pos.matched_lottery_object) : ''
    }));
  } else {
    // fallback init using template grid
    positionsArray = Array.from({ length: 10 }).map((_, idx) => ({
      template_value: template[set.vertical_row_index]?.[idx] ?? '',
      matched_numbers: '',
      unique_key: ''
    }));
  }

  let filledCount = 0;

  // Find empty positions in compact structure
  const emptyPositions = positionsArray
    .map((pos, index) => ({ pos, index }))
    .filter(({ pos }) => !pos.matched_numbers || pos.matched_numbers === '');

  // Fill empty positions
  for (const { pos, index } of emptyPositions) {
    const templateValue = pos.template_value;
    const matchingNumber = findMatchingNumber(availableNumbers, templateValue);

    if (matchingNumber) {
      // Update compact position
      pos.matched_numbers = matchingNumber.six_digit_number;
      pos.unique_key = createUniqueKey(matchingNumber);

      // Mark number as used
      matchingNumber.used = true;
      filledCount++;

      // Insert into lottery_matched_numbers
      await client.query(`
        INSERT INTO lottery_matched_numbers (matched_set_id, lottery_number, last_two_digits, position_in_row, origin_number)
        VALUES ($1, $2, $3, $4, $5)
      `, [set.id, matchingNumber.six_digit_number, templateValue, index, pos.unique_key]);
    }
  }

  // Update matched_numbers JSON if any positions were filled (store compact array only)
  if (filledCount > 0) {
    const updatedMatchedNumbers = JSON.stringify(positionsArray);

    await client.query(`
      UPDATE lottery_matched_sets 
      SET matched_numbers = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `, [updatedMatchedNumbers, set.id]);
  }

  return filledCount;
}

/**
 * Find matching number by last two digits (rarest first)
 */
function findMatchingNumber(availableNumbers, lastTwo) {
  const candidates = availableNumbers.filter(num =>
    !num.used &&
    num.six_digit_number.toString().slice(-2) === lastTwo
  );

  if (candidates.length === 0) return null;

  // Count rarity of each last-two-digits
  const rarityMap = {};
  availableNumbers.forEach(num => {
    if (!num.used) {
      const lastTwoOfNum = num.six_digit_number.toString().slice(-2);
      rarityMap[lastTwoOfNum] = (rarityMap[lastTwoOfNum] || 0) + 1;
    }
  });

  // Sort by rarity (ascending) - prefer rarer numbers
  candidates.sort((a, b) => {
    const aLastTwo = a.six_digit_number.toString().slice(-2);
    const bLastTwo = b.six_digit_number.toString().slice(-2);
    return rarityMap[aLastTwo] - rarityMap[bLastTwo];
  });

  return candidates[0];
}

/**
 * Update set completion status and move to shelf if complete
 */
async function updateSetCompletion(client, setId) {
  const countResult = await client.query(`
    SELECT COUNT(*) as count
    FROM lottery_matched_numbers
    WHERE matched_set_id = $1 AND is_active = true
  `, [setId]);

  const matchedCount = parseInt(countResult.rows[0].count);
  const isComplete = matchedCount === 10;

  console.log(`🔍 Set ${setId}: ${matchedCount}/10 positions filled, isComplete: ${isComplete}`);

  await client.query(`
    UPDATE lottery_matched_sets 
    SET is_complete = $1, updated_at = CURRENT_TIMESTAMP
    WHERE id = $2
  `, [isComplete, setId]);

  // Auto-move to shelf if complete
  if (isComplete) {
    console.log(` Set ${setId} is complete, attempting auto-move to shelf...`);
    await moveToShelfAutomatically(client, setId);
  } else {
    console.log(`⏳ Set ${setId} not complete yet (${matchedCount}/10)`);
  }
}

/**
 * Automatically move complete set to default shelf
 */
async function moveToShelfAutomatically(client, setId, tableAvailability = {}) {
  try {
    const { hasShelfTable = true, hasShelfItemsTable = true } = tableAvailability;

    if (!hasShelfTable || !hasShelfItemsTable) {
      console.log(' Shelf tables missing, marking set as on_shelf without shelf entry');
      await client.query(`
        UPDATE lottery_matched_sets
        SET status = 'on_shelf', updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `, [setId]);
      return;
    }

    console.log(`🚀 Starting auto-move for set ${setId}...`);

    // Get default shelf (or first available shelf)
    const shelfResult = await client.query(`
      SELECT id, shelf_name, max_capacity, current_count
      FROM lottery_shelf 
      WHERE is_active = true 
      ORDER BY id ASC 
      LIMIT 1
    `);

    if (shelfResult.rows.length === 0) {
      console.log(' No active shelf found for auto-move');
      return;
    }

    const shelf = shelfResult.rows[0];
    console.log(`📦 Found shelf: ${shelf.shelf_name} (ID: ${shelf.id}, ${shelf.current_count}/${shelf.max_capacity})`);

    // Check shelf capacity
    if (shelf.current_count >= shelf.max_capacity) {
      console.log(` Shelf ${shelf.shelf_name} is at capacity (${shelf.current_count}/${shelf.max_capacity})`);
      return;
    }

    // Get set details
    const setResult = await client.query(`
      SELECT id, vertical_row_index, matched_numbers
      FROM lottery_matched_sets
      WHERE id = $1
    `, [setId]);

    if (setResult.rows.length === 0) {
      console.log(` Set ${setId} not found`);
      return;
    }

    const set = setResult.rows[0];
    console.log(`📋 Set details: Row ${set.vertical_row_index}`);

    // Check if set is already on shelf
    const existingShelfItem = await client.query(`
      SELECT id FROM lottery_shelf_items WHERE matched_set_id = $1
    `, [setId]);

    if (existingShelfItem.rows.length > 0) {
      console.log(`⚠️ Set ${setId} is already on shelf`);
      return;
    }

    // Create shelf item
    const itemName = `Row ${set.vertical_row_index} Set`;
    const itemDescription = `Complete lottery set for vertical row ${set.vertical_row_index}`;

    console.log(`📝 Creating shelf item: ${itemName}`);

    await client.query(`
      INSERT INTO lottery_shelf_items (shelf_id, matched_set_id, item_name, item_description, status, price)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [shelf.id, setId, itemName, itemDescription, 'available', 0]);

    // Update shelf current count
    await client.query(`
      UPDATE lottery_shelf 
      SET current_count = current_count + 1
      WHERE id = $1
    `, [shelf.id]);

    // Update set status to 'on_shelf'
    await client.query(`
      UPDATE lottery_matched_sets 
      SET status = 'on_shelf'
      WHERE id = $1
    `, [setId]);

    console.log(` Set ${setId} successfully moved to shelf ${shelf.shelf_name}`);

  } catch (error) {
    console.error(' Error in auto-move to shelf:', error);
    console.error('Error details:', error.message);
    console.error('Error stack:', error.stack);
  }
}

/**
 * Create unique key for lottery number
 */
function createUniqueKey(lotteryNumber) {
  return `${lotteryNumber.year_number.slice(-2)}-${lotteryNumber.draw_sequence}-${lotteryNumber.set_number}-${lotteryNumber.six_digit_number}-${lotteryNumber.book_number}`;
}

async function tableExists(client, tableName) {
  const result = await client.query(
    "SELECT to_regclass($1) AS table_name",
    [`public.${tableName}`]
  );

  return Boolean(result.rows?.[0]?.table_name);
}

/**
 * Process matching logic for lottery numbers against template (original function)
 * @param {Object} connection - Database connection
 * @param {Array} template - Template grid
 * @param {Array} lotteryArr - Lottery numbers to process
 * @param {Number} templateId - Template ID
 * @param {Object} groupCriteria - Group criteria for matching
 */
async function processMatching(connection, template, lotteryArr, templateId, groupCriteria = null) {
  const connectionString = process.env.DATABASE_URL;
  const results = [];

  // สร้าง group criteria ที่ยืดหยุ่น (ใช้ default values ถ้าไม่มี)
  const finalGroupCriteria = {
    lottery_draw_id: groupCriteria?.lottery_draw_id ?? 0,
    branch_id: groupCriteria?.branch_id ?? 0,
    ticket_count: groupCriteria?.ticket_count ?? 0,
    group_type: groupCriteria?.group_type ?? 'row'
  };

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
    const yearStr = String(lotteryNumber.year_number);
    const yearLastTwo = yearStr.substring(yearStr.length - 2);
    return `${yearLastTwo}-${lotteryNumber.draw_sequence}-${lotteryNumber.set_number}-${lotteryNumber.six_digit_number}-${lotteryNumber.book_number}`;
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
        matched_numbers: picked ? picked.six_digit_number : '',
        unique_key: picked ? createUniqueKey(picked) : ''
      });
    }

    const isComplete = filledPositions === 10;

    const matchedSetData = {
      template_id: templateId,
      vertical_row_index: bestCol,
      is_complete: isComplete,
      matched_numbers: JSON.stringify(matchedPositions),
      lottery_draw_id: finalGroupCriteria.lottery_draw_id,
      branch_id: finalGroupCriteria.branch_id,
      ticket_count: finalGroupCriteria.ticket_count
    };

    // Insert set
    let insertResult;
    if (connectionString.startsWith('postgresql://') || connectionString.startsWith('postgres://')) {
      const client = await connection.connect();
      insertResult = await client.query(`
        INSERT INTO lottery_matched_sets (template_id, vertical_row_index, is_complete, matched_numbers, 
                                         lottery_draw_id, branch_id, ticket_count, status, is_active)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id
      `, [
        matchedSetData.template_id, 
        matchedSetData.vertical_row_index, 
        matchedSetData.is_complete, 
        matchedSetData.matched_numbers,
        matchedSetData.lottery_draw_id,
        matchedSetData.branch_id,
        matchedSetData.ticket_count,
        'processing', 
        true
      ]);
      client.release();
    }

    const matchedSetId = insertResult.rows[0].id;
    
    // Insert matched numbers (only those actually used)
    for (let rowIndex = 0; rowIndex < matchedPositions.length; rowIndex++) {
      const position = matchedPositions[rowIndex];
      if (!position.matched_numbers || position.matched_numbers === '') continue;

      const lotteryNumber = position.matched_numbers;
      const lastTwoDigits = template[bestCol][rowIndex];
      const uniqueKey = position.unique_key;

      if (connectionString.startsWith('postgresql://') || connectionString.startsWith('postgres://')) {
        const client = await connection.connect();
        try {
          await client.query(`
            INSERT INTO lottery_matched_numbers (matched_set_id, lottery_number, last_two_digits, position_in_row, origin_number, is_active)
            VALUES ($1, $2, $3, $4, $5, $6)
          `, [matchedSetId, lotteryNumber, lastTwoDigits, rowIndex, uniqueKey, true]);
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