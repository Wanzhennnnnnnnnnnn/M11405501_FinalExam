const config = {
    db: {
        // 優先讀取 Docker 環境變數，如果沒有則使用本機預設值
        host: process.env.DB_HOST || '127.0.0.1', 
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '417',
        database: process.env.DB_NAME || 'finalexam_db',
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
    },
    use_https: false,
    port: process.env.PORT || 80
};

module.exports = config;