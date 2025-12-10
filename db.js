const mysql = require('mysql2');
const config = require('./config');

// 建立資料庫連線池
// 在 Docker 環境中，config.db.host 會自動讀取為 'mysql_db' (根據 docker-compose 設定)
const pool = mysql.createPool({
    host: config.db.host,
    user: config.db.user,
    password: config.db.password,
    database: config.db.database,
    waitForConnections: config.db.waitForConnections,
    connectionLimit: config.db.connectionLimit,
    queueLimit: config.db.queueLimit
});

// 匯出 Promise 介面，方便使用 async/await
module.exports = pool.promise();