// Docker-specific configuration using environment variables

const config = {
    db: {
        host: process.env.DB_HOST || 'mysql_db',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '417',
        database: process.env.DB_NAME || 'finalexam_db',
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
    },
    use_https: false,
    port: 80
};

module.exports = config;
