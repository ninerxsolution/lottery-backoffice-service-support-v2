# Environment Setup Guide

## Database Configuration

Create a `.env.local` file in the project root with the following content:

```env
# Database Configuration
DATABASE_URL=postgresql://username:password@localhost:5432/database_name
```

### Connection String Formats

- **PostgreSQL**: `postgresql://user:password@host:port/database`
- **MySQL**: `mysql://user:password@host:port/database`
- **SQLite**: `sqlite:///path/to/database.db`

### Example Connection Strings

```env
# PostgreSQL (local)
DATABASE_URL=postgresql://postgres:password@localhost:5432/lottery_db

# PostgreSQL (cloud)
DATABASE_URL=postgresql://user:password@db.example.com:5432/lottery_db

# MySQL
DATABASE_URL=mysql://root:password@localhost:3306/lottery_db

# SQLite
DATABASE_URL=sqlite:///./data/lottery.db
```

## Security Notes

- Never commit `.env.local` to version control
- Use strong passwords for database connections
- Consider using connection pooling for production environments
- Implement proper error handling for connection failures
