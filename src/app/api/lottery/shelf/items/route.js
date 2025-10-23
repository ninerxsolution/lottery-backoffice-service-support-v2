import { createConnection } from '@/lib/database';

/**
 * GET /api/lottery/shelf/items
 * Get shelf items with matched set details
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
    const shelfId = searchParams.get('shelf_id');
    const status = searchParams.get('status');

    if (connectionString.startsWith('postgresql://') || connectionString.startsWith('postgres://')) {
      const client = await connection.connect();
      
      try {
        let query = `
          SELECT 
            lsi.id as shelf_item_id,
            lsi.shelf_id,
            ls.shelf_name,
            lsi.item_name,
            lsi.item_description,
            COALESCE(lsi.status, 'available') as item_status,
            lsi.price,
            lsi.added_at,
            lsi.sold_at,
            lms.id as matched_set_id,
            lms.vertical_row_index,
            lms.is_complete,
            lms.created_at as set_created_at,
            COUNT(lmn.id) as matched_count
          FROM lottery_shelf_items lsi
          JOIN lottery_shelf ls ON lsi.shelf_id = ls.id
          JOIN lottery_matched_sets lms ON lsi.matched_set_id = lms.id
          LEFT JOIN lottery_matched_numbers lmn ON lms.id = lmn.matched_set_id AND (lmn.is_active = true OR lmn.is_active IS NULL)
          WHERE (ls.is_active = true OR ls.is_active IS NULL)
        `;

        const conditions = [];
        const params = [];
        let paramIndex = 1;

        if (shelfId) {
          conditions.push(`lsi.shelf_id = $${paramIndex}`);
          params.push(shelfId);
          paramIndex++;
        }

        if (status) {
          conditions.push(`lsi.status = $${paramIndex}`);
          params.push(status);
          paramIndex++;
        }

        if (conditions.length > 0) {
          query += ' AND ' + conditions.join(' AND ');
        }

        query += ' GROUP BY lsi.id, lsi.shelf_id, ls.shelf_name, lsi.item_name, lsi.item_description, lsi.status, lsi.price, lsi.added_at, lsi.sold_at, lms.id, lms.vertical_row_index, lms.is_complete, lms.created_at ORDER BY lsi.added_at DESC';

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
    console.error('Error fetching shelf items:', error);
    return Response.json({
      success: false,
      message: 'Failed to fetch shelf items',
      error: error.message
    }, { status: 500 });
  }
}

