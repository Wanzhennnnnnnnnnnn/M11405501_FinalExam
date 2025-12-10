const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs');
const mysql = require('mysql2/promise');

// Config 載入
const config = require('./config');

const app = express();
app.set('view engine', 'hjs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser('secretingredient'));
app.use(express.static(path.join(__dirname, 'public')));

const pool = mysql.createPool(config.db);

// --- 公開路由 ---

app.get('/', (req, res) => res.redirect('/login'));

app.get('/login', (req, res) => {
    res.render('login', { error: req.cookies.error });
    res.clearCookie('error');
});

app.get('/register', (req, res) => {
    res.render('register', { error: req.cookies.error });
    res.clearCookie('error');
});

app.get('/forgot-password', (req, res) => {
    res.render('forgotPassword', { 
        error: req.cookies.error,
        success: req.cookies.success 
    });
    res.clearCookie('error');
    res.clearCookie('success');
});

// --- 認證路由 ---

// 登入
app.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        // ★★★ 明天注意：如果資料表不叫 Contractors，記得改這裡 ★★★
        const [rows] = await pool.execute('SELECT * FROM Contractors WHERE Email = ?', [email]);
        
        if (rows.length === 0 || rows[0].Password !== password) {
            res.cookie('error', '帳號或密碼錯誤', { maxAge: 10000 });
            return res.redirect('/login');
        }

        const user = rows[0];
        res.cookie('loggedIn', 'true', { signed: true });
        // ★★★ 明天注意：如果 ID 欄位不叫 ContractorID，記得改這裡 ★★★
        res.cookie('userId', user.ContractorID, { signed: true });
        res.cookie('username', user.Name, { signed: true });

        res.redirect('/dashboard');

    } catch (err) {
        console.error(err);
        res.redirect('/login');
    }
});

// 註冊
app.post('/register', async (req, res) => {
    try {
        const { name, email, password, phone, address } = req.body;
        
        const [exists] = await pool.execute('SELECT 1 FROM Contractors WHERE Email = ?', [email]);
        if (exists.length > 0) {
            res.cookie('error', 'Email 已被註冊', { maxAge: 10000 });
            return res.redirect('/register');
        }

        await pool.execute(
            'INSERT INTO Contractors (Name, Email, Password, PhoneNumber, Address) VALUES (?, ?, ?, ?, ?)',
            [name, email, password, phone, address]
        );

        res.cookie('success', '註冊成功，請登入', { maxAge: 10000 });
        res.redirect('/login');

    } catch (err) {
        console.error(err);
        res.redirect('/register');
    }
});

// 忘記密碼
app.post('/forgot-password', async (req, res) => {
    try {
        const { username, new_password } = req.body;
        const email = username;

        const [users] = await pool.execute('SELECT * FROM Contractors WHERE Email = ?', [email]);

        if (users.length === 0) {
            res.cookie('error', '找不到此 Email 帳號', { maxAge: 10000 });
            return res.redirect('/forgot-password');
        }

        await pool.execute('UPDATE Contractors SET Password = ? WHERE Email = ?', [new_password, email]);

        res.cookie('success', '密碼重設成功，請使用新密碼登入', { maxAge: 10000 });
        return res.redirect('/login');

    } catch (err) {
        console.error(err);
        res.cookie('error', '系統錯誤，請稍後再試', { maxAge: 10000 });
        return res.redirect('/forgot-password');
    }
});

app.get('/logout', (req, res) => {
    res.clearCookie('loggedIn');
    res.clearCookie('userId');
    res.clearCookie('username');
    res.redirect('/login');
});

// --- 中間件 ---
const checkLogin = (req, res, next) => {
    if (req.signedCookies.loggedIn === 'true') {
        res.locals.username = req.signedCookies.username;
        res.locals.userId = req.signedCookies.userId;
        next();
    } else {
        res.redirect('/login');
    }
};

// 簡易 Dashboard
app.get('/dashboard', checkLogin, (req, res) => {
    res.send(`
        <h1>登入成功！</h1>
        <p>歡迎回來, ${res.locals.username}</p>
        <a href="/logout">登出</a>
    `);
});

const port = config.port || 80;
app.listen(port, () => console.log(`FinalExam running on port ${port}`));