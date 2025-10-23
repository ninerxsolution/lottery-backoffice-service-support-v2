import { createConnection } from '@/lib/database';

/**
 * POST /api/lottery/shelf/move-to-shelf
 * Move complete matched sets to shelf
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
    const { matchedSetIds, shelfId, itemName, itemDescription, price } = body;

    if (!matchedSetIds || !Array.isArray(matchedSetIds) || matchedSetIds.length === 0) {
      return Response.json({
        success: false,
        message: 'matchedSetIds array is required and must not be empty'
      }, { status: 400 });
    }

    if (!shelfId || !itemName) {
      return Response.json({
        success: false,
        message: 'shelfId and itemName are required'
      }, { status: 400 });
    }

    const connection = createConnection(connectionString);

    if (connectionString.startsWith('postgresql://') || connectionString.startsWith('postgres://')) {
      const client = await connection.connect();
      
      try {
        // Start transaction
        await client.query('BEGIN');

        // 1. Verify that all matched sets are complete and ready for shelf
        const setsResult = await client.query(`
          SELECT 
            lms.id,
            lms.vertical_row_index,
            lms.is_complete,
            COUNT(lmn.id) as matched_count
          FROM lottery_matched_sets lms
          LEFT JOIN lottery_matched_numbers lmn ON lms.id = lmn.matched_set_id AND (lmn.is_active = true OR lmn.is_active IS NULL)
          WHERE lms.id = ANY($1) 
            AND (lms.is_active = true OR lms.is_active IS NULL)
          GROUP BY lms.id, lms.vertical_row_index, lms.is_complete
        `, [matchedSetIds]);

        if (setsResult.rows.length !== matchedSetIds.length) {
          await client.query('ROLLBACK');
          const foundIds = setsResult.rows.map(row => row.id);
          const missingIds = matchedSetIds.filter(id => !foundIds.includes(id));
          return Response.json({
            success: false,
            message: `Some matched sets are not found or not ready for shelf. Missing IDs: ${missingIds.join(', ')}`
          }, { status: 400 });
        }

        // Check if all sets are complete
        const incompleteSets = setsResult.rows.filter(set => !set.is_complete || set.matched_count < 10);
        if (incompleteSets.length > 0) {
          await client.query('ROLLBACK');
          const incompleteIds = incompleteSets.map(set => `ID ${set.id} (${set.matched_count}/10)`);
          return Response.json({
            success: false,
            message: `All matched sets must be complete (10/10 positions filled) before moving to shelf. Incomplete sets: ${incompleteIds.join(', ')}`
          }, { status: 400 });
        }

        // 2. Check shelf capacity
        const shelfResult = await client.query(`
          SELECT 
            ls.max_capacity,
            COALESCE(COUNT(lsi.id), 0) as current_count
          FROM lottery_shelf ls
          LEFT JOIN lottery_shelf_items lsi ON ls.id = lsi.shelf_id AND (lsi.status != 'sold' OR lsi.status IS NULL)
          WHERE ls.id = $1 AND (ls.is_active = true OR ls.is_active IS NULL)
          GROUP BY ls.id, ls.max_capacity
        `, [shelfId]);

        if (shelfResult.rows.length === 0) {
          await client.query('ROLLBACK');
          return Response.json({
            success: false,
            message: `Shelf with ID ${shelfId} not found or inactive`
          }, { status: 404 });
        }

        const shelf = shelfResult.rows[0];
        if (shelf.current_count + matchedSetIds.length > shelf.max_capacity) {
          await client.query('ROLLBACK');
          return Response.json({
            success: false,
            message: `Shelf capacity exceeded. Current: ${shelf.current_count}/${shelf.max_capacity}, Trying to add: ${matchedSetIds.length} items. Available space: ${shelf.max_capacity - shelf.current_count}`
          }, { status: 400 });
        }

        // 3. Move sets to shelf
        const movedItems = [];
        for (const setId of matchedSetIds) {
          const set = setsResult.rows.find(s => s.id === setId);
          if (!set) {
            await client.query('ROLLBACK');
            return Response.json({
              success: false,
              message: `Set with ID ${setId} not found in validation results`
            }, { status: 400 });
          }
          
          const itemNameWithIndex = `${itemName} - Row ${set.vertical_row_index}`;
          
          try {
            const insertResult = await client.query(`
              INSERT INTO lottery_shelf_items (shelf_id, matched_set_id, item_name, item_description, price)
              VALUES ($1, $2, $3, $4, $5)
              RETURNING id, item_name, price, added_at
            `, [shelfId, setId, itemNameWithIndex, itemDescription || null, price || null]);

            movedItems.push(insertResult.rows[0]);
          } catch (insertError) {
            await client.query('ROLLBACK');
            return Response.json({
              success: false,
              message: `Failed to insert shelf item for set ${setId}: ${insertError.message}`
            }, { status: 500 });
          }
        }

        // 4. Update matched sets status (only if status column exists)
        try {
          await client.query(`
            UPDATE lottery_matched_sets 
            SET status = 'on_shelf', updated_at = CURRENT_TIMESTAMP
            WHERE id = ANY($1)
          `, [matchedSetIds]);
        } catch (statusError) {
          // If status column doesn't exist, just update the timestamp
          console.log('Status column not found, updating timestamp only');
          await client.query(`
            UPDATE lottery_matched_sets 
            SET updated_at = CURRENT_TIMESTAMP
            WHERE id = ANY($1)
          `, [matchedSetIds]);
        }

        // 5. Update shelf timestamp (current_count is calculated dynamically)
        await client.query(`
          UPDATE lottery_shelf 
          SET updated_at = CURRENT_TIMESTAMP
          WHERE id = $1
        `, [shelfId]);

        // 6. Record in history (only if table exists)
        try {
          await client.query(`
            INSERT INTO lottery_matching_history (operation_type, sets_moved_to_shelf)
            VALUES ($1, $2)
          `, ['move_to_shelf', matchedSetIds.length]);
        } catch (historyError) {
          // If history table doesn't exist, just log it
          console.log('History table not found, skipping history record');
        }

        // Commit transaction
        await client.query('COMMIT');

        return Response.json({
          success: true,
          data: {
            moved_items: movedItems,
            sets_moved: matchedSetIds.length,
            shelf_id: shelfId
          },
          message: `Successfully moved ${matchedSetIds.length} sets to shelf`
        });
        
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
        await connection.end();
      }
    }
    
  } catch (error) {
    console.error('Error moving sets to shelf:', error);
    return Response.json({
      success: false,
      message: 'Failed to move sets to shelf',
      error: error.message
    }, { status: 500 });
  }
}
