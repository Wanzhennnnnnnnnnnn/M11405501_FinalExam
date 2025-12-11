const express = require('express');
const router = express.Router();
const db = require('../db');
const bcrypt = require('bcryptjs'); // 用於加密密碼

// --- Middleware: 檢查是否登入 ---
function isAuthenticated(req, res, next) {
    if (req.session.user) {
        return next();
    }
    res.redirect('/login');
}

// --- Pages ---

// 首頁 (需要登入才能看)
router.get('/', isAuthenticated, function(req, res, next) {
  res.render('index', { user: req.session.user });
});

// 登入頁面
router.get('/login', (req, res) => {
    res.render('login', { error: null, success: null });
});

// 註冊頁面
router.get('/register', (req, res) => {
    res.render('register', { error: null });
});

// 忘記密碼頁面 (修正：路徑改為 /forgot-password，渲染檔名改為 forgot-password)
router.get('/forgot-password', (req, res) => {
    res.render('forgot-password', { error: null, success: null });
});

// --- Auth API ---

// 處理登入
router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        // 1. 找使用者
        const [users] = await db.query('SELECT * FROM Users WHERE email = ?', [email]);
        if (users.length === 0) {
            return res.render('login', { error: 'Invalid email or password', success: null });
        }
        
        const user = users[0];

        // 2. 比對密碼
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.render('login', { error: 'Invalid email or password', success: null });
        }

        // 3. 登入成功，寫入 session
        req.session.user = { id: user.user_id, name: user.name, email: user.email };
        res.redirect('/');

    } catch (err) {
        console.error(err);
        res.render('login', { error: 'System error', success: null });
    }
});

// 處理註冊
router.post('/register', async (req, res) => {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
        return res.render('register', { error: 'All fields are required' });
    }

    try {
        // 1. 檢查 Email 是否重複
        const [existing] = await db.query('SELECT * FROM Users WHERE email = ?', [email]);
        if (existing.length > 0) {
            return res.render('register', { error: 'Email already registered' });
        }

        // 2. 加密密碼
        const hashedPassword = await bcrypt.hash(password, 10);

        // 3. 寫入資料庫
        await db.query('INSERT INTO Users (name, email, password) VALUES (?, ?, ?)', [name, email, hashedPassword]);

        // 4. 導向登入頁
        res.render('login', { success: 'Registration successful! Please login.', error: null });

    } catch (err) {
        console.error(err);
        res.render('register', { error: 'System error during registration' });
    }
});

// 處理登出
router.get('/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/login');
    });
});

// 處理忘記密碼 (修正：路徑改為 /forgot-password)
router.post('/forgot-password', async (req, res) => {
    const { email, new_password } = req.body;
    try {
        // 1. 檢查用戶是否存在
        const [users] = await db.query('SELECT * FROM Users WHERE email = ?', [email]);
        if (users.length === 0) {
            // 修正：渲染檔名改為 forgot-password
            return res.render('forgot-password', { error: 'Email not found', success: null });
        }

        // 2. 加密新密碼
        const hashedPassword = await bcrypt.hash(new_password, 10);

        // 3. 更新密碼
        await db.query('UPDATE Users SET password = ? WHERE email = ?', [hashedPassword, email]);

        res.render('login', { success: 'Password reset successful. Please login with new password.', error: null });

    } catch (err) {
        console.error(err);
        // 修正：渲染檔名改為 forgot-password
        res.render('forgot-password', { error: 'System error', success: null });
    }
});

// --- Data API Endpoints (保持不變) ---

// 1. 取得所有國家
router.get('/api/countries', isAuthenticated, async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM Country ORDER BY name ASC');
        res.json(rows);
    } catch (err) {
        console.error('Error fetching countries:', err);
        res.status(500).json({ error: err.message });
    }
});

// 2. 取得所有地區
router.get('/api/regions', isAuthenticated, async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM Region ORDER BY name ASC');
        res.json(rows);
    } catch (err) {
        console.error('Error fetching regions:', err);
        res.status(500).json({ error: err.message });
    }
});

// 3. 取得所有子地區
router.get('/api/subregions', isAuthenticated, async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM SubRegion ORDER BY name ASC');
        res.json(rows);
    } catch (err) {
        console.error('Error fetching subregions:', err);
        res.status(500).json({ error: err.message });
    }
});

// 4. 取得所有 SRB 數據
router.get('/api/srb-data', isAuthenticated, async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM SRB_Data ORDER BY year ASC');
        res.json(rows);
    } catch (err) {
        console.error('Error fetching SRB data:', err);
        res.status(500).json({ error: err.message });
    }
});

// 5. 新增 SRB 數據
router.post('/api/srb-data', isAuthenticated, async (req, res) => {
    const { country_id, year, srb_value } = req.body;
    try {
        await db.query(
            'INSERT INTO SRB_Data (country_id, year, srb_value, updated_at) VALUES (?, ?, ?, NOW())', 
            [country_id, year, srb_value]
        );
        res.json({ success: true });
    } catch (err) {
        console.error('Error inserting data:', err);
        res.status(500).json({ error: err.message });
    }
});

// 6. 更新 SRB 數據
router.put('/api/srb-data', isAuthenticated, async (req, res) => {
    const { country_id, year, srb_value } = req.body;
    try {
        const [result] = await db.query(
            'UPDATE SRB_Data SET srb_value = ?, updated_at = NOW() WHERE country_id = ? AND year = ?',
            [srb_value, country_id, year]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Record not found' });
        }
        res.json({ success: true });
    } catch (err) {
        console.error('Error updating data:', err);
        res.status(500).json({ error: err.message });
    }
});

// 7. 刪除 SRB 數據
router.delete('/api/srb-data', isAuthenticated, async (req, res) => {
    const { country_id, start_year, end_year } = req.body;
    try {
        const [result] = await db.query(
            'DELETE FROM SRB_Data WHERE country_id = ? AND year BETWEEN ? AND ?',
            [country_id, start_year, end_year]
        );
        res.json({ success: true, affectedRows: result.affectedRows });
    } catch (err) {
        console.error('Error deleting data:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;