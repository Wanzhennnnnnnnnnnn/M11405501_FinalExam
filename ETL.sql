-- ----------------------------------------------------------
-- 1. 資料庫初始化 (Database Initialization)
-- ----------------------------------------------------------
-- 建立並使用資料庫
DROP DATABASE IF EXISTS finalexam_db;
CREATE DATABASE finalexam_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE finalexam_db;

-- ----------------------------------------------------------
-- 2. 建立暫存表 (Staging Tables)
-- 用途：暫存從 CSV 匯入的原始資料，不進行正規化
-- ----------------------------------------------------------

-- 對應 data1.csv (SRB 數據)
DROP TABLE IF EXISTS stage_data1;
CREATE TABLE stage_data1 (
    Entity VARCHAR(255),
    Code VARCHAR(50), 
    Year VARCHAR(50),
    SRB VARCHAR(50),
    OWID VARCHAR(255)
);

-- 對應 data2.csv (國家與地區資訊)
DROP TABLE IF EXISTS stage_data2;
CREATE TABLE stage_data2 (
    name VARCHAR(255),
    alpha_2 VARCHAR(50),
    alpha_3 VARCHAR(50),
    country_code VARCHAR(50),
    iso_3166_2 VARCHAR(100),
    region VARCHAR(100),
    sub_region VARCHAR(100),
    intermediate_region VARCHAR(100),
    region_code VARCHAR(50),
    sub_region_code VARCHAR(50),
    intermediate_region_code VARCHAR(50)
);

-- ----------------------------------------------------------
-- 3. 提取 (Extract) - 匯入 CSV 資料
-- ----------------------------------------------------------

-- 載入 data1.csv
LOAD DATA INFILE '/var/lib/mysql-files/data1.csv'
INTO TABLE stage_data1
FIELDS TERMINATED BY ',' 
ENCLOSED BY '"'
LINES TERMINATED BY '\n'
IGNORE 1 LINES;

-- 載入 data2.csv
-- 注意：這裡使用 \r\n 是因為 data2 通常帶有 Windows 換行符
LOAD DATA INFILE '/var/lib/mysql-files/data2.csv'
INTO TABLE stage_data2
FIELDS TERMINATED BY ',' 
ENCLOSED BY '"'
LINES TERMINATED BY '\r\n'
IGNORE 1 LINES;

-- ----------------------------------------------------------
-- 4. 建立目標正規化表格 (Target Tables based on ER Diagram)
-- ----------------------------------------------------------

-- [Table 1] Region (區域表)
CREATE TABLE Region (
    region_id INT AUTO_INCREMENT PRIMARY KEY COMMENT '系統主鍵 (System ID)',
    name VARCHAR(100) NOT NULL COMMENT '區域名稱',
    region_code INT COMMENT '原始 M49 地區代碼 (Original Code)',
    UNIQUE KEY uk_region_name (name)
);

-- [Table 2] SubRegion (子區域表)
CREATE TABLE SubRegion (
    sub_region_id INT AUTO_INCREMENT PRIMARY KEY COMMENT '系統主鍵 (System ID)',
    region_id INT NOT NULL COMMENT '外鍵指向 Region.region_id',
    name VARCHAR(100) NOT NULL COMMENT '子區域名稱',
    sub_region_code INT COMMENT '原始 M49 子區域代碼 (Original Code)',
    FOREIGN KEY (region_id) REFERENCES Region(region_id) ON DELETE CASCADE,
    UNIQUE KEY uk_subregion_name (name)
);

-- [Table 3] Country (國家表)
CREATE TABLE Country (
    country_id INT AUTO_INCREMENT PRIMARY KEY COMMENT '系統主鍵 (System ID)',
    sub_region_id INT NOT NULL COMMENT '外鍵指向 SubRegion.sub_region_id',
    name VARCHAR(255) NOT NULL COMMENT '國家名稱',
    iso_alpha3 VARCHAR(3) NOT NULL COMMENT 'ISO Alpha-3 代碼 (Unique)',
    iso_alpha2 VARCHAR(2) COMMENT 'ISO Alpha-2 代碼',
    FOREIGN KEY (sub_region_id) REFERENCES SubRegion(sub_region_id) ON DELETE CASCADE,
    UNIQUE KEY uk_iso_alpha3 (iso_alpha3)
);

-- [Table 4] SRB_Data (出生性別比數據表)
CREATE TABLE SRB_Data (
    srb_id INT AUTO_INCREMENT PRIMARY KEY COMMENT '系統主鍵',
    country_id INT NOT NULL COMMENT '外鍵指向 Country.country_id',
    year INT NOT NULL COMMENT '年份',
    srb_value FLOAT NOT NULL COMMENT 'SRB 數值',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最後更新時間',
    FOREIGN KEY (country_id) REFERENCES Country(country_id) ON DELETE CASCADE,
    -- 防止同一個國家在同一年有兩筆數據
    UNIQUE KEY uk_country_year (country_id, year) 
);

-- ----------------------------------------------------------
-- 5. 轉換與資料清洗 (Transform & Clean)
-- ----------------------------------------------------------

-- [清洗規則 1]：刪除 stage_data1 中沒有國家代碼 (Code) 的匯總資料
DELETE FROM stage_data1 
WHERE Code IS NULL OR Code = '' OR LENGTH(Code) > 3;

-- [清洗規則 2]：刪除 stage_data2 中沒有地區或子區域的資料
DELETE FROM stage_data2 
WHERE region IS NULL OR region = '' 
   OR sub_region IS NULL OR sub_region = '';

-- [清洗規則 3]：刪除 SRB 數值無效的資料
DELETE FROM stage_data1 
WHERE SRB IS NULL OR SRB = '';

-- ----------------------------------------------------------
-- 6. 載入 (Load) - 將資料寫入正規化表格
-- ----------------------------------------------------------

-- [Load 1] 載入地區 (Region)
INSERT INTO Region (name, region_code)
SELECT DISTINCT 
    region, 
    CAST(region_code AS UNSIGNED)
FROM stage_data2
WHERE region IS NOT NULL;

-- [Load 2] 載入子區域 (SubRegion)
-- 邏輯：結合 Region 表取得 region_id (現在是指向 Region 表的 PK)
INSERT INTO SubRegion (name, sub_region_code, region_id)
SELECT DISTINCT 
    s2.sub_region, 
    CAST(s2.sub_region_code AS UNSIGNED),
    r.region_id
FROM stage_data2 s2
JOIN Region r ON s2.region = r.name;

-- [Load 3] 載入國家 (Country)
-- 邏輯：結合 SubRegion 表取得 sub_region_id
INSERT INTO Country (name, iso_alpha3, iso_alpha2, sub_region_id)
SELECT DISTINCT 
    s2.name, 
    s2.alpha_3, 
    s2.alpha_2, 
    sr.sub_region_id
FROM stage_data2 s2
JOIN SubRegion sr ON s2.sub_region = sr.name;

-- [Load 4] 載入 SRB 數據 (SRB_Data)
INSERT INTO SRB_Data (country_id, year, srb_value, updated_at)
SELECT 
    c.country_id, 
    CAST(s1.Year AS UNSIGNED), 
    CAST(s1.SRB AS DECIMAL(10,5)),
    NOW()
FROM stage_data1 s1
JOIN Country c ON s1.Code = c.iso_alpha3;

-- ----------------------------------------------------------
-- 7. 驗證查詢 (Validation)
-- ----------------------------------------------------------
SELECT 'Regions Count' AS Metric, COUNT(*) AS Value FROM Region
UNION ALL
SELECT 'SubRegions Count', COUNT(*) FROM SubRegion
UNION ALL
SELECT 'Countries Count', COUNT(*) FROM Country
UNION ALL
SELECT 'SRB Records Count', COUNT(*) FROM SRB_Data;