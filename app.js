const express = require('express');
const path = require('path');
const session = require('express-session'); // 新增 session
const config = require('./config'); 
const app = express();

const port = config.port || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// *** 設定 Session ***
// 這讓伺服器可以記住使用者的登入狀態
app.use(session({
    secret: 'srb_secret_key_123', // 實際專案應使用更複雜的密鑰
    resave: false,
    saveUninitialized: false,
    cookie: { 
        maxAge: 3600000 // 1 小時後過期
    } 
}));

// 設定 View Engine
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// 設定靜態檔案
app.use(express.static(path.join(__dirname, 'public')));

// 讓所有 view 都能讀取到 user 資訊 (用於顯示導覽列的登出按鈕)
app.use((req, res, next) => {
    res.locals.user = req.session.user;
    next();
});

// 載入路由
const indexRouter = require('./routes/index');
app.use('/', indexRouter);

// 啟動伺服器
app.listen(port, () => {
  console.log(`Server is running at port ${port}`);
  console.log(`Inside Docker? DB Host is: ${config.db.host}`);
});