const express = require('express');
const router = express.Router();
const db = require('../db'); // 匯入 db.js 來連接資料庫

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index');
});

// --- API Endpoints (這些是 script.js 需要的 "廚師") ---

// 1. 取得所有國家
router.get('/api/countries', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM Country ORDER BY name ASC');
        res.json(rows);
    } catch (err) {
        console.error('Error fetching countries:', err);
        res.status(500).json({ error: err.message });
    }
});

// 2. 取得所有地區
router.get('/api/regions', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM Region ORDER BY name ASC');
        res.json(rows);
    } catch (err) {
        console.error('Error fetching regions:', err);
        res.status(500).json({ error: err.message });
    }
});

// 3. 取得所有子地區
router.get('/api/subregions', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM SubRegion ORDER BY name ASC');
        res.json(rows);
    } catch (err) {
        console.error('Error fetching subregions:', err);
        res.status(500).json({ error: err.message });
    }
});

// 4. 取得所有 SRB 數據
router.get('/api/srb-data', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM SRB_Data ORDER BY year ASC');
        res.json(rows);
    } catch (err) {
        console.error('Error fetching SRB data:', err);
        res.status(500).json({ error: err.message });
    }
});

// 5. 新增 SRB 數據 (POST)
router.post('/api/srb-data', async (req, res) => {
    const { country_id, year, srb_value } = req.body;
    try {
        // 使用 INSERT IGNORE 或 ON DUPLICATE KEY UPDATE 可以避免重複錯誤
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

// 6. 更新 SRB 數據 (PUT)
router.put('/api/srb-data', async (req, res) => {
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

// 7. 刪除 SRB 數據 (DELETE)
router.delete('/api/srb-data', async (req, res) => {
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