import { createConnection } from '@/lib/database';

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
    
    // Query the lottery_templates table to get the columns data
    let result;
    
    if (connectionString.startsWith('postgresql://') || connectionString.startsWith('postgres://')) {
      const client = await connection.connect();
      result = await client.query('SELECT columns FROM lottery_templates LIMIT 1');
      client.release();
      await connection.end();
      
      if (result.rows.length === 0) {
        return Response.json({
          success: false,
          message: 'No template data found in lottery_templates table'
        }, { status: 404 });
      }
      
      return Response.json({
        success: true,
        data: result.rows[0].columns
      });
      
    } else if (connectionString.startsWith('mysql://')) {
      const [rows] = await connection.execute('SELECT columns FROM lottery_templates LIMIT 1');
      await connection.end();
      
      if (rows.length === 0) {
        return Response.json({
          success: false,
          message: 'No template data found in lottery_templates table'
        }, { status: 404 });
      }
      
      return Response.json({
        success: true,
        data: JSON.parse(rows[0].columns)
      });
      
    } else if (connectionString.startsWith('sqlite://')) {
      const rows = await connection.query('SELECT columns FROM lottery_templates LIMIT 1');
      await connection.close();
      
      if (rows.length === 0) {
        return Response.json({
          success: false,
          message: 'No template data found in lottery_templates table'
        }, { status: 404 });
      }
      
      return Response.json({
        success: true,
        data: JSON.parse(rows[0].columns)
      });
    }
    
  } catch (error) {
    console.error('Error fetching lottery template data:', error);
    return Response.json({
      success: false,
      message: 'Failed to fetch template data from database',
      error: error.message
    }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      return Response.json({ success: false, message: 'DATABASE_URL environment variable is not set' }, { status: 500 });
    }

    const body = await request.json();
    const { columns } = body || {};

    // Basic validation: must be 10x10 grid of strings "00"-"99" and unique
    if (!Array.isArray(columns) || columns.length !== 10 || !columns.every(r => Array.isArray(r) && r.length === 10)) {
      return Response.json({ success: false, message: 'columns must be a 10x10 array' }, { status: 400 });
    }

    const flat = columns.flat();
    const isTwoDigits = (v) => typeof v === 'string' && /^\d{2}$/.test(v);
    if (!flat.every(isTwoDigits)) {
      return Response.json({ success: false, message: 'Each cell must be a two-digit string 00-99' }, { status: 400 });
    }
    const set = new Set(flat);
    if (set.size !== flat.length) {
      return Response.json({ success: false, message: 'Values must be unique across the template' }, { status: 400 });
    }

    const connection = createConnection(connectionString);

    if (connectionString.startsWith('postgresql://') || connectionString.startsWith('postgres://')) {
      const client = await connection.connect();
      try {
        await client.query('BEGIN');
        await client.query('DELETE FROM lottery_templates');
        await client.query('INSERT INTO lottery_templates (columns) VALUES ($1::jsonb)', [JSON.stringify(columns)]);
        await client.query('COMMIT');
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      } finally {
        client.release();
        await connection.end();
      }
      return Response.json({ success: true });

    } else if (connectionString.startsWith('mysql://')) {
      try {
        await connection.execute('START TRANSACTION');
        await connection.execute('DELETE FROM lottery_templates');
        await connection.execute('INSERT INTO lottery_templates (columns) VALUES (?)', [JSON.stringify(columns)]);
        await connection.execute('COMMIT');
      } catch (e) {
        await connection.execute('ROLLBACK');
        throw e;
      } finally {
        await connection.end();
      }
      return Response.json({ success: true });

    } else if (connectionString.startsWith('sqlite://')) {
      try {
        await connection.query('BEGIN TRANSACTION');
        await connection.query('DELETE FROM lottery_templates');
        await connection.query('INSERT INTO lottery_templates (columns) VALUES (?)', [JSON.stringify(columns)]);
        await connection.query('COMMIT');
      } catch (e) {
        await connection.query('ROLLBACK');
        throw e;
      } finally {
        await connection.close();
      }
      return Response.json({ success: true });
    }

  } catch (error) {
    console.error('Error updating lottery template data:', error);
    return Response.json({ success: false, message: 'Failed to update template', error: error.message }, { status: 500 });
  }
}