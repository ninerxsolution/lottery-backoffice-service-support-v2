import { createConnection } from '../../../../lib/database';

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
      const result = await client.query('SELECT six_digit_number FROM lottery_numbers ORDER BY six_digit_number');
      client.release();
      await connection.end();

      return Response.json({
        success: true,
        data: result.rows.map(r => r.six_digit_number)
      });

    } else if (connectionString.startsWith('mysql://')) {
      const [rows] = await connection.execute('SELECT six_digit_number FROM lottery_numbers ORDER BY six_digit_number');
      await connection.end();

      return Response.json({
        success: true,
        data: rows.map(r => r.six_digit_number)
      });

    } else if (connectionString.startsWith('sqlite://')) {
      const rows = await connection.query('SELECT six_digit_number FROM lottery_numbers ORDER BY six_digit_number');
      await connection.close();

      return Response.json({
        success: true,
        data: rows.map(r => r.six_digit_number)
      });
    }

    return Response.json({
      success: false,
      message: 'Unsupported database type in DATABASE_URL'
    }, { status: 400 });

  } catch (error) {
    console.error('Error fetching lottery numbers:', error);
    return Response.json({
      success: false,
      message: 'Failed to fetch lottery numbers from database',
      error: error.message
    }, { status: 500 });
  }
}


