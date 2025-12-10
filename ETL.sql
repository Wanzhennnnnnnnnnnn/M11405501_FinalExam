-- 1. 初始化資料庫
CREATE DATABASE IF NOT EXISTS finalexam_db;
USE finalexam_db;

-- ==========================================
-- 2. 建立暫存表 (Tables) 用於匯入 CSV
-- ==========================================

-- 對應 data1.csv (SRB 數據)
DROP TABLE IF EXISTS data1;
CREATE TABLE data1 (
    Entity VARCHAR(255),
    Code VARCHAR(10),
    Year INT,
    SRB FLOAT,
    OWID VARCHAR(255)
);

-- 對應 data2.csv (國家與地區資訊)
DROP TABLE IF EXISTS data2;
CREATE TABLE data2 (
    name VARCHAR(255),
    alpha_2 VARCHAR(10),
    alpha_3 VARCHAR(10),
    country_code INT,
    iso_3166_2 VARCHAR(50),
    region VARCHAR(100),
    sub_region VARCHAR(100),
    intermediate_region VARCHAR(100),
    region_code INT,
    sub_region_code INT,
    intermediate_region_code INT
);

-- ==========================================
-- 3. 匯入 CSV 資料 (Extract)
-- ==========================================

-- 載入 data1.csv
LOAD DATA INFILE '/var/lib/mysql-files/data1.csv'
INTO TABLE data1
FIELDS TERMINATED BY ','
ENCLOSED BY '"'
LINES TERMINATED BY '\n'
IGNORE 1 ROWS
(@v_Entity, @v_Code, @v_Year, @v_SRB, @v_OWID)
SET 
    Entity = NULLIF(TRIM(@v_Entity), ''),
    Code = NULLIF(TRIM(@v_Code), ''),
    Year = NULLIF(TRIM(@v_Year), ''),
    SRB = NULLIF(TRIM(@v_SRB), ''),
    OWID = NULLIF(TRIM(@v_OWID), '');

-- 載入 data2.csv
LOAD DATA INFILE '/var/lib/mysql-files/data2.csv'
INTO TABLE data2
FIELDS TERMINATED BY ','
ENCLOSED BY '"'
LINES TERMINATED BY '\r\n'
IGNORE 1 ROWS
(@v_name, @v_alpha_2, @v_alpha_3, @v_country_code, @v_iso_3166_2, @v_region, @v_sub_region, @v_intermediate_region, @v_region_code, @v_sub_region_code, @v_intermediate_region_code)
SET 
    name = NULLIF(TRIM(@v_name), ''),
    alpha_2 = NULLIF(TRIM(@v_alpha_2), ''),
    alpha_3 = NULLIF(TRIM(@v_alpha_3), ''),
    country_code = NULLIF(TRIM(@v_country_code), ''),
    iso_3166_2 = NULLIF(TRIM(@v_iso_3166_2), ''),
    region = NULLIF(TRIM(@v_region), ''),
    sub_region = NULLIF(TRIM(@v_sub_region), ''),
    intermediate_region = NULLIF(TRIM(@v_intermediate_region), ''),
    region_code = NULLIF(TRIM(@v_region_code), ''),
    sub_region_code = NULLIF(TRIM(@v_sub_region_code), ''),
    intermediate_region_code = NULLIF(TRIM(@v_intermediate_region_code), '');

-- ==========================================
-- 3.5 資料清洗與過濾 (Data Cleaning)
-- ==========================================

-- 1. [data1] 刪除沒有國家代碼 (Code) 的資料
-- 策略改變：完全刪除無法對應到標準 ISO 國家的聚合數據 (如 World, Africa)
-- 這樣能確保資料庫中只包含具備完整地區層級資訊的 "真實國家"
DELETE FROM data1 
WHERE Code IS NULL OR Code = '';

-- 2. [data1] 刪除無效或異常數據
DELETE FROM data1 WHERE Entity IS NULL;

-- 刪除生物學上極不合理的數值 (SRB < 50 或 SRB > 180)
DELETE FROM data1 
WHERE SRB IS NULL OR SRB < 50 OR SRB > 180;

-- 刪除未來年份
DELETE FROM data1 WHERE Year > 2025 OR Year IS NULL;

-- 3. [data2] 清除維度表中的無用資料
DELETE FROM data2 
WHERE alpha_3 IS NULL OR region IS NULL;

-- ==========================================
-- 4. 建立正式 Schema (Transform & Load)
-- ==========================================

-- [Table 1] Regions
CREATE TABLE Regions (
    ID INT PRIMARY KEY,
    Name VARCHAR(100) NOT NULL UNIQUE
);

INSERT INTO Regions (ID, Name)
SELECT DISTINCT region_code, region 
FROM data2;

-- [Table 2] SubRegions
CREATE TABLE SubRegions (
    ID INT PRIMARY KEY,
    Name VARCHAR(100) NOT NULL,
    RegionID INT,
    FOREIGN KEY (RegionID) REFERENCES Regions(ID)
);

INSERT INTO SubRegions (ID, Name, RegionID)
SELECT DISTINCT sub_region_code, sub_region, region_code
FROM data2
WHERE sub_region IS NOT NULL AND sub_region_code IS NOT NULL;

-- [Table 3] IntermediateRegions
CREATE TABLE IntermediateRegions (
    ID INT PRIMARY KEY,
    Name VARCHAR(100),
    SubRegionID INT,
    FOREIGN KEY (SubRegionID) REFERENCES SubRegions(ID)
);

INSERT INTO IntermediateRegions (ID, Name, SubRegionID)
SELECT DISTINCT intermediate_region_code, intermediate_region, sub_region_code
FROM data2
WHERE intermediate_region_code IS NOT NULL AND intermediate_region_code != 0;

-- [Table 4] Countries (國家維度)
CREATE TABLE Countries (
    ID INT AUTO_INCREMENT PRIMARY KEY,
    Name VARCHAR(255) NOT NULL,
    Alpha2 VARCHAR(2) NULL,
    Alpha3 VARCHAR(10) NOT NULL UNIQUE,
    NumericCode INT,
    SubRegionID INT,
    IntermediateRegionID INT,
    FOREIGN KEY (SubRegionID) REFERENCES SubRegions(ID),
    FOREIGN KEY (IntermediateRegionID) REFERENCES IntermediateRegions(ID)
);

-- 只從 data2 匯入標準國家
INSERT INTO Countries (Name, Alpha2, Alpha3, NumericCode, SubRegionID, IntermediateRegionID)
SELECT DISTINCT 
    r2.name, 
    r2.alpha_2, 
    r2.alpha_3, 
    r2.country_code,
    sub.ID,
    inter.ID
FROM data2 r2
JOIN Regions reg ON r2.region = reg.Name
JOIN SubRegions sub ON r2.sub_region = sub.Name AND sub.RegionID = reg.ID
LEFT JOIN IntermediateRegions inter ON r2.intermediate_region = inter.Name AND inter.SubRegionID = sub.ID;

-- [Table 5] Years
CREATE TABLE Years (
    YearVal INT PRIMARY KEY
);

INSERT INTO Years (YearVal)
SELECT DISTINCT Year FROM data1 ORDER BY Year;

-- [Table 6] SRB_Facts
CREATE TABLE SRB_Facts (
    ID INT AUTO_INCREMENT PRIMARY KEY,
    CountryID INT NOT NULL,
    YearVal INT NOT NULL,
    SRB_Value FLOAT NOT NULL,
    FOREIGN KEY (CountryID) REFERENCES Countries(ID) ON DELETE CASCADE,
    FOREIGN KEY (YearVal) REFERENCES Years(YearVal) ON DELETE CASCADE,
    UNIQUE(CountryID, YearVal)
);

-- 載入事實資料
-- INNER JOIN 會自動過濾掉 data1 中有 Code 但 Countries 表裡沒有的資料 (如果有這種情況的話)
INSERT INTO SRB_Facts (CountryID, YearVal, SRB_Value)
SELECT 
    c.ID,
    r1.Year,
    r1.SRB
FROM data1 r1
JOIN Countries c ON r1.Code = c.Alpha3;