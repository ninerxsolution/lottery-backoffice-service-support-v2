import { createConnection } from '@/lib/database';

// Ensure required tables exist for each supported DB
async function ensureSchema(connectionString, connection) {
  if (connectionString.startsWith('postgresql://') || connectionString.startsWith('postgres://')) {
    const client = await connection.connect();
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS lottery_templates (
          id SERIAL PRIMARY KEY,
          columns JSONB NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
      `);
      await client.query(`
        CREATE TABLE IF NOT EXISTS lottery_matched_sets (
          id SERIAL PRIMARY KEY,
          template_id INTEGER NOT NULL,
          vertical_row_index INTEGER NOT NULL,
          is_complete BOOLEAN NOT NULL DEFAULT FALSE,
          matched_numbers JSONB NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
      `);
      await client.query(`
        CREATE TABLE IF NOT EXISTS lottery_matched_numbers (
          id SERIAL PRIMARY KEY,
          matched_set_id INTEGER NOT NULL,
          lottery_number VARCHAR(32) NOT NULL,
          last_two_digits VARCHAR(2) NOT NULL,
          position_in_row INTEGER NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
      `);
    } finally {
      client.release();
    }
  } else if (connectionString.startsWith('mysql://')) {
    // MySQL 5.7+ supports JSON; fallback to TEXT if needed
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS lottery_templates (
        id INT AUTO_INCREMENT PRIMARY KEY,
        columns JSON NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS lottery_matched_sets (
        id INT AUTO_INCREMENT PRIMARY KEY,
        template_id INT NOT NULL,
        vertical_row_index INT NOT NULL,
        is_complete TINYINT(1) NOT NULL DEFAULT 0,
        matched_numbers JSON NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS lottery_matched_numbers (
        id INT AUTO_INCREMENT PRIMARY KEY,
        matched_set_id INT NOT NULL,
        lottery_number VARCHAR(32) NOT NULL,
        last_two_digits CHAR(2) NOT NULL,
        position_in_row INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
  } else if (connectionString.startsWith('sqlite://')) {
    await connection.query(`
      CREATE TABLE IF NOT EXISTS lottery_templates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        columns TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      )
    `);
    await connection.query(`
      CREATE TABLE IF NOT EXISTS lottery_matched_sets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        template_id INTEGER NOT NULL,
        vertical_row_index INTEGER NOT NULL,
        is_complete INTEGER NOT NULL DEFAULT 0,
        matched_numbers TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      )
    `);
    await connection.query(`
      CREATE TABLE IF NOT EXISTS lottery_matched_numbers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        matched_set_id INTEGER NOT NULL,
        lottery_number TEXT NOT NULL,
        last_two_digits TEXT NOT NULL,
        position_in_row INTEGER NOT NULL,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `);
  }
}

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
    await ensureSchema(connectionString, connection);
    const { searchParams } = new URL(request.url);
    const templateId = searchParams.get('template_id');
    const isComplete = searchParams.get('is_complete');
    const verticalRow = searchParams.get('vertical_row');

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
      
    } else if (connectionString.startsWith('mysql://')) {
      // Convert PostgreSQL placeholders to MySQL placeholders
      const mysqlQuery = query.replace(/\$\d+/g, '?');
      const [rows] = await connection.execute(mysqlQuery, params);
      await connection.end();
      
      return Response.json({
        success: true,
        data: rows,
        count: rows.length
      });
      
    } else if (connectionString.startsWith('sqlite://')) {
      // Convert PostgreSQL placeholders to SQLite placeholders
      const sqliteQuery = query.replace(/\$\d+/g, '?');
      const rows = await connection.query(sqliteQuery, params);
      await connection.close();
      
      return Response.json({
        success: true,
        data: rows,
        count: rows.length
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
 * POST /api/lottery/matching/process
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
    await ensureSchema(connectionString, connection);

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
      
      const processedResults = await processMatching(connection, templateGrid, lotteryNumbers, templateId);
      await connection.end();
      
      return Response.json({
        success: true,
        data: processedResults
      });
      
    } else if (connectionString.startsWith('mysql://')) {
      // Clear existing data before new processing
      await connection.execute('DELETE FROM lottery_matched_numbers');
      await connection.execute('DELETE FROM lottery_matched_sets');
      
      const [rows] = await connection.execute('SELECT columns FROM lottery_templates WHERE id = ?', [templateId]);
      
      if (rows.length === 0) {
        await connection.end();
        return Response.json({
          success: false,
          message: 'Template not found'
        }, { status: 404 });
      }
      
      const rawTemplate = JSON.parse(rows[0].columns);
      const templateGrid = Array.isArray(rawTemplate?.columns) ? rawTemplate.columns : rawTemplate;
      if (!Array.isArray(templateGrid)) {
        await connection.end();
        return Response.json({ success: false, message: 'Template columns data is invalid' }, { status: 400 });
      }
      
      const processedResults = await processMatching(connection, templateGrid, lotteryNumbers, templateId);
      await connection.end();
      
      return Response.json({
        success: true,
        data: processedResults
      });
      
    } else if (connectionString.startsWith('sqlite://')) {
      // Clear existing data before new processing
      await connection.query('DELETE FROM lottery_matched_numbers');
      await connection.query('DELETE FROM lottery_matched_sets');
      
      const rows = await connection.query('SELECT columns FROM lottery_templates WHERE id = ?', [templateId]);
      
      if (rows.length === 0) {
        await connection.close();
        return Response.json({
          success: false,
          message: 'Template not found'
        }, { status: 404 });
      }
      
      const rawTemplate = JSON.parse(rows[0].columns);
      const templateGrid = Array.isArray(rawTemplate?.columns) ? rawTemplate.columns : rawTemplate;
      if (!Array.isArray(templateGrid)) {
        await connection.close();
        return Response.json({ success: false, message: 'Template columns data is invalid' }, { status: 400 });
      }
      
      const processedResults = await processMatching(connection, templateGrid, lotteryNumbers, templateId);
      await connection.close();
      
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
    await ensureSchema(connectionString, connection);

    if (connectionString.startsWith('postgresql://') || connectionString.startsWith('postgres://')) {
      const client = await connection.connect();
      
      // Delete in correct order due to foreign key constraints
      await client.query('DELETE FROM lottery_matched_numbers');
      await client.query('DELETE FROM lottery_matched_sets');
      
      client.release();
      await connection.end();
      
    } else if (connectionString.startsWith('mysql://')) {
      // Delete in correct order due to foreign key constraints
      await connection.execute('DELETE FROM lottery_matched_numbers');
      await connection.execute('DELETE FROM lottery_matched_sets');
      await connection.end();
      
    } else if (connectionString.startsWith('sqlite://')) {
      // Delete in correct order due to foreign key constraints
      await connection.query('DELETE FROM lottery_matched_numbers');
      await connection.query('DELETE FROM lottery_matched_sets');
      await connection.close();
    }

    return Response.json({
      success: true,
      message: 'All matched sets and numbers cleared from database'
    });
    
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
async function processMatching(connection, template, lotteryNumbers, templateId) {
  const connectionString = process.env.DATABASE_URL;
  const results = [];

  // Make a working copy and track usage to enforce single-use
  const remainingNumbers = lotteryNumbers.map(n => n.toString());

  // Helper to count how many numbers available for a specific last-two-digits
  const countAvailable = (lastTwo) => {
    return remainingNumbers.filter(n => n.slice(-2) === lastTwo).length;
  };

  // Helper to take the rarest number (least common last-two-digits first)
  const takeNumberFor = (lastTwo) => {
    const candidates = remainingNumbers
      .map((n, idx) => ({ n, idx }))
      .filter(({ n }) => n.slice(-2) === lastTwo);
    
    if (candidates.length === 0) return null;
    
    // Among candidates, pick the one whose last-two-digits is rarest overall
    const scored = candidates.map(({ n, idx }) => {
      const lastTwoOfN = n.slice(-2);
      const rarity = countAvailable(lastTwoOfN); // lower is rarer
      return { n, idx, rarity };
    });
    
    // Sort by rarity (ascending) - prefer rarer numbers
    scored.sort((a, b) => a.rarity - b.rarity);
    const chosen = scored[0];
    
    remainingNumbers.splice(chosen.idx, 1);
    return chosen.n;
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

  // Process columns dynamically - recalculate best column each iteration
  const processedColumns = new Set();
  
  for (let iteration = 0; iteration < 10; iteration++) {
    // Find best column among unprocessed
    let bestCol = -1;
    let bestPotential = -1;
    
    for (let colIndex = 0; colIndex < 10; colIndex++) {
      if (processedColumns.has(colIndex)) continue;
      const potential = calculateColumnPotential(colIndex);
      if (potential > bestPotential) {
        bestPotential = potential;
        bestCol = colIndex;
      }
    }
    
    if (bestCol === -1) break; // No more columns
    processedColumns.add(bestCol);
    
    // Process this column
    const matchedPositions = [];
    let filledPositions = 0;

    for (let rowIndex = 0; rowIndex < 10; rowIndex++) {
      const templateValue = template[bestCol][rowIndex];
      const picked = takeNumberFor(templateValue);
      if (picked) filledPositions++;
      matchedPositions.push({
        position: rowIndex,
        template_value: templateValue,
        matched_numbers: picked ? [picked] : [],
        is_filled: Boolean(picked)
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
    } else if (connectionString.startsWith('mysql://')) {
      const [result] = await connection.execute(`
        INSERT INTO lottery_matched_sets (template_id, vertical_row_index, is_complete, matched_numbers)
        VALUES (?, ?, ?, ?)
      `, [matchedSetData.template_id, matchedSetData.vertical_row_index, matchedSetData.is_complete, matchedSetData.matched_numbers]);
      insertResult = { rows: [{ id: result.insertId }] };
    } else if (connectionString.startsWith('sqlite://')) {
      const result = await connection.query(`
        INSERT INTO lottery_matched_sets (template_id, vertical_row_index, is_complete, matched_numbers)
        VALUES (?, ?, ?, ?)
      `, [matchedSetData.template_id, matchedSetData.vertical_row_index, matchedSetData.is_complete, matchedSetData.matched_numbers]);
      insertResult = { rows: [{ id: result.lastID }] };
    }

    const matchedSetId = insertResult.rows[0].id;

    // Insert matched numbers (only those actually used)
    for (const position of matchedPositions) {
      if (!position.is_filled) continue;
      for (const lotteryNumber of position.matched_numbers) {
        const lastTwoDigits = lotteryNumber.toString().slice(-2);
        if (connectionString.startsWith('postgresql://') || connectionString.startsWith('postgres://')) {
          const client = await connection.connect();
          await client.query(`
            INSERT INTO lottery_matched_numbers (matched_set_id, lottery_number, last_two_digits, position_in_row)
            VALUES ($1, $2, $3, $4)
          `, [matchedSetId, lotteryNumber, lastTwoDigits, position.position]);
          client.release();
        } else if (connectionString.startsWith('mysql://')) {
          await connection.execute(`
            INSERT INTO lottery_matched_numbers (matched_set_id, lottery_number, last_two_digits, position_in_row)
            VALUES (?, ?, ?, ?)
          `, [matchedSetId, lotteryNumber, lastTwoDigits, position.position]);
        } else if (connectionString.startsWith('sqlite://')) {
          await connection.query(`
            INSERT INTO lottery_matched_numbers (matched_set_id, lottery_number, last_two_digits, position_in_row)
            VALUES (?, ?, ?, ?)
          `, [matchedSetId, lotteryNumber, lastTwoDigits, position.position]);
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
    unused_numbers: remainingNumbers
  };
}
