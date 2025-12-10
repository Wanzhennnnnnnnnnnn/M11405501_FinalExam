const express = require('express');
const path = require('path');
const config = require('./config'); // 重要：載入 config 設定
const app = express();

// 重要：從 config 讀取 PORT。
// 在 Docker 中 config.port 會是 80，這符合 docker-compose 的 "3000:80" 設定
const port = config.port || 3000;

// *** 關鍵修正：加入 Body Parser Middleware ***
// 必須在載入路由之前加入這些設定，否則 req.body 會是 undefined
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 設定 View Engine
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// 設定靜態檔案
app.use(express.static(path.join(__dirname, 'public')));

// 載入路由 (必須在 body parser 之後)
const indexRouter = require('./routes/index');
app.use('/', indexRouter);

// 啟動伺服器
app.listen(port, () => {
  console.log(`Server is running at port ${port}`);
  console.log(`Inside Docker? DB Host is: ${config.db.host}`);
});