import { createConnection } from '@/lib/database';

/**
 * GET /api/lottery/shelf
 * Fetch all shelves with current counts
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
        const result = await client.query(`
          SELECT 
            ls.id,
            ls.shelf_name,
            ls.shelf_description,
            ls.max_capacity,
            COALESCE(COUNT(lsi.id), 0) as current_count,
            ls.is_active,
            ls.created_at,
            ls.updated_at,
            ROUND((COALESCE(COUNT(lsi.id), 0)::decimal / ls.max_capacity) * 100, 2) as usage_percentage
          FROM lottery_shelf ls
          LEFT JOIN lottery_shelf_items lsi ON ls.id = lsi.shelf_id AND (lsi.status != 'sold' OR lsi.status IS NULL)
          WHERE (ls.is_active = true OR ls.is_active IS NULL)
          GROUP BY ls.id, ls.shelf_name, ls.shelf_description, ls.max_capacity, ls.is_active, ls.created_at, ls.updated_at
          ORDER BY ls.shelf_name
        `);

        return Response.json({
          success: true,
          data: result.rows
        });
        
      } finally {
        client.release();
        await connection.end();
      }
    }
    
  } catch (error) {
    console.error('Error fetching shelves:', error);
    return Response.json({
      success: false,
      message: 'Failed to fetch shelves',
      error: error.message
    }, { status: 500 });
  }
}

/**
 * POST /api/lottery/shelf
 * Create new shelf
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
    const { shelf_name, shelf_description, max_capacity = 100 } = body;

    if (!shelf_name || typeof shelf_name !== 'string') {
      return Response.json({
        success: false,
        message: 'shelf_name is required and must be a string'
      }, { status: 400 });
    }

    const connection = createConnection(connectionString);

    if (connectionString.startsWith('postgresql://') || connectionString.startsWith('postgres://')) {
      const client = await connection.connect();
      
      try {
        // Check if shelf name already exists
        const existingShelf = await client.query(`
          SELECT id FROM lottery_shelf WHERE shelf_name = $1 AND (is_active = true OR is_active IS NULL)
        `, [shelf_name]);

        if (existingShelf.rows.length > 0) {
          return Response.json({
            success: false,
            message: 'Shelf name already exists'
          }, { status: 409 });
        }

        const result = await client.query(`
          INSERT INTO lottery_shelf (shelf_name, shelf_description, max_capacity)
          VALUES ($1, $2, $3)
          RETURNING id, shelf_name, shelf_description, max_capacity, is_active, created_at
        `, [shelf_name, shelf_description || null, max_capacity]);

        return Response.json({
          success: true,
          data: result.rows[0],
          message: 'Shelf created successfully'
        }, { status: 201 });
        
      } finally {
        client.release();
        await connection.end();
      }
    }
    
  } catch (error) {
    console.error('Error creating shelf:', error);
    return Response.json({
      success: false,
      message: 'Failed to create shelf',
      error: error.message
    }, { status: 500 });
  }
}

