// --- Global Data Variables ---
let regions = [];
let subRegions = [];
let countries = [];
let srbData = [];

// --- Init (頁面載入初始化) ---
window.onload = async function() {
    try {
        // 並行載入所有基礎資料
        await Promise.all([
            fetchData('/api/regions', (data) => regions = data),
            fetchData('/api/subregions', (data) => subRegions = data),
            fetchData('/api/countries', (data) => countries = data),
            fetchData('/api/srb-data', (data) => srbData = data)
        ]);

        console.log('Data loaded:', { regions, subRegions, countries, srbDataCount: srbData.length });

        // 1. 初始化下拉選單
        populateSelect('q1-country', countries, 'country_id');
        populateSelect('q2-subregion', subRegions, 'sub_region_id');
        populateSelect('q3-region', regions, 'region_id');
        populateSelect('m5-country', countries, 'country_id');
        populateSelect('m6-country', countries, 'country_id');
        populateSelect('m7-country', countries, 'country_id');

        // 2. 動態載入年份
        const uniqueYears = [...new Set(srbData.map(item => item.year))].sort((a, b) => b - a);
        populateYearSelect('q2-year', uniqueYears);
        populateYearSelect('q3-year', uniqueYears);

        // 設定 M5 功能的連動事件
        const m5Select = document.getElementById('m5-country');
        if(m5Select) {
            m5Select.addEventListener('change', function(e) {
                const cId = parseInt(e.target.value);
                const maxYear = getMaxYear(cId);
                const label = document.getElementById('m5-latest-year');
                if(label) label.innerText = maxYear || '--';
            });
        }
    } catch (error) {
        console.error('Failed to load data:', error);
        alert('Error loading data from database. Check console for details.');
    }
};

// Helper: 封裝 fetch 邏輯
async function fetchData(url, callback) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();
    callback(data);
}

// --- Tab Logic ---
function switchTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('tab-' + tab).classList.add('active');
    
    document.getElementById('view-query').classList.add('hidden');
    document.getElementById('view-manage').classList.add('hidden');
    
    const target = document.getElementById('view-' + tab);
    target.classList.remove('hidden');
}

function toggleDesc(id) {
    const el = document.getElementById(id);
    el.classList.toggle('hidden');
}

// 收合結果區塊
function closeResult(id) {
    const el = document.getElementById(id);
    if (el) {
        el.classList.add('hidden');
    }
}

function populateSelect(elementId, data, idKey) {
    const el = document.getElementById(elementId);
    if (!el) return;
    el.innerHTML = '<option value="">-- Select --</option>';
    data.forEach(item => {
        const opt = document.createElement('option');
        opt.value = item[idKey];
        opt.innerText = item.name;
        el.appendChild(opt);
    });
}

function populateYearSelect(elementId, years) {
    const el = document.getElementById(elementId);
    if (!el) return;
    el.innerHTML = '<option value="">-- Select --</option>';
    years.forEach(year => {
        const opt = document.createElement('option');
        opt.value = year;
        opt.innerText = year;
        el.appendChild(opt);
    });
}

// --- Function 1 ---
function runQuery1() {
    const cId = parseInt(document.getElementById('q1-country').value);
    if(!cId) return alert('Please select a country.');
    
    const data = srbData.filter(d => d.country_id === cId).sort((a,b) => a.year - b.year);
    
    const tbody = document.getElementById('tbody-q1');
    tbody.innerHTML = '';
    if(data.length === 0) tbody.innerHTML = '<tr><td colspan="2">No data found</td></tr>';
    data.forEach(row => {
        tbody.innerHTML += `<tr><td>${row.year}</td><td>${row.srb_value}</td></tr>`;
    });
    document.getElementById('result-q1').classList.remove('hidden');
}

// --- Function 2 ---
function runQuery2() {
    const sId = parseInt(document.getElementById('q2-subregion').value);
    const year = parseInt(document.getElementById('q2-year').value);
    if(!sId) return alert('Please select a sub-region.');
    
    const targetCountries = countries.filter(c => c.sub_region_id === sId).map(c => c.country_id);
    const data = srbData.filter(d => targetCountries.includes(d.country_id) && d.year === year)
                        .sort((a,b) => b.srb_value - a.srb_value);
    
    const tbody = document.getElementById('tbody-q2');
    tbody.innerHTML = '';
    if(data.length === 0) tbody.innerHTML = '<tr><td colspan="3">No data found</td></tr>';
    data.forEach((row, idx) => {
        const cName = countries.find(c => c.country_id === row.country_id)?.name || 'Unknown';
        tbody.innerHTML += `<tr><td>${idx+1}</td><td>${cName}</td><td>${row.srb_value}</td></tr>`;
    });
    document.getElementById('result-q2').classList.remove('hidden');
}

// --- Function 3 ---
function runQuery3() {
    const rId = parseInt(document.getElementById('q3-region').value);
    const year = parseInt(document.getElementById('q3-year').value);
    if(!rId) return alert('Please select a region.');
    
    const tbody = document.getElementById('tbody-q3');
    tbody.innerHTML = '';
    
    const subs = subRegions.filter(s => s.region_id === rId);
    let hasData = false;
    
    subs.forEach(sub => {
        const cIds = countries.filter(c => c.sub_region_id === sub.sub_region_id).map(c => c.country_id);
        const records = srbData.filter(d => cIds.includes(d.country_id) && d.year === year);
        if(records.length > 0) {
            hasData = true;
            const maxVal = Math.max(...records.map(r => r.srb_value));
            tbody.innerHTML += `<tr><td>${sub.name}</td><td>${maxVal}</td></tr>`;
        }
    });
    if(!hasData) tbody.innerHTML = '<tr><td colspan="2">No data found</td></tr>';
    document.getElementById('result-q3').classList.remove('hidden');
}

// --- Function 4 (Fixed: Sort by SRB Descending) ---
function runQuery4() {
    const key = document.getElementById('q4-keyword').value.toLowerCase();
    if(!key) return alert('Please enter a keyword.');
    
    // 1. 找出所有名稱匹配的國家
    const matchedC = countries.filter(c => c.name.toLowerCase().includes(key));
    
    // 2. 收集這些國家的最新數據
    let results = [];
    matchedC.forEach(c => {
        const cData = srbData.filter(d => d.country_id === c.country_id);
        if(cData.length > 0) {
            // 找出該國最新的一筆資料 (reduce 比較年份)
            const latest = cData.reduce((prev, curr) => (prev.year > curr.year) ? prev : curr);
            results.push({
                name: c.name,
                year: latest.year,
                value: latest.srb_value
            });
        }
    });

    // 3. [關鍵修正] 依照 SRB 數值降序排列 (Desc)
    results.sort((a, b) => b.value - a.value);

    // 4. 渲染結果
    const tbody = document.getElementById('tbody-q4');
    tbody.innerHTML = '';
    
    if(results.length === 0) {
        tbody.innerHTML = '<tr><td colspan="2">Not found</td></tr>';
    } else {
        results.forEach(item => {
            tbody.innerHTML += `<tr><td>${item.name} (${item.year})</td><td>${item.value}</td></tr>`;
        });
    }
    document.getElementById('result-q4').classList.remove('hidden');
}

// --- Function 5 (Add) ---
async function runCRUD5() {
    const cId = parseInt(document.getElementById('m5-country').value);
    const val = parseFloat(document.getElementById('m5-value').value);
    if(!cId || isNaN(val)) return alert('Please fill in all fields.');
    
    const maxYear = getMaxYear(cId) || 2020;
    const newYear = maxYear + 1;
    
    try {
        const res = await fetch('/api/srb-data', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ country_id: cId, year: newYear, srb_value: val })
        });
        
        if(res.ok) {
            srbData.push({srb_id: Date.now(), country_id: cId, year: newYear, srb_value: val});
            const cName = countries.find(c => c.country_id === cId).name;
            alert(`Added successfully: ${cName} - ${newYear}`);
            document.getElementById('m5-latest-year').innerText = newYear;
            document.getElementById('m5-value').value = '';
        } else {
            alert('Failed to add record.');
        }
    } catch(err) {
        console.error(err);
        alert('Error connecting to server.');
    }
}

// --- Function 6 (Update) ---
function updateM6Years() {
    const cId = parseInt(document.getElementById('m6-country').value);
    const sel = document.getElementById('m6-year');
    sel.innerHTML = '<option value="">Select</option>';
    
    const cRecords = srbData.filter(d => d.country_id === cId).sort((a,b) => b.year - a.year);
    cRecords.forEach(r => {
        const opt = document.createElement('option');
        opt.value = r.year;
        opt.innerText = `${r.year} (Val: ${r.srb_value})`;
        sel.appendChild(opt);
    });
}

async function runCRUD6() {
    const cId = parseInt(document.getElementById('m6-country').value);
    const year = parseInt(document.getElementById('m6-year').value);
    const val = parseFloat(document.getElementById('m6-value').value);
    
    if(!cId || !year || isNaN(val)) return alert('Please fill in all fields.');
    
    try {
        const res = await fetch('/api/srb-data', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ country_id: cId, year: year, srb_value: val })
        });
        
        if(res.ok) {
            const idx = srbData.findIndex(d => d.country_id === cId && d.year === year);
            if(idx !== -1) {
                srbData[idx].srb_value = val;
                alert('Updated successfully');
                updateM6Years(); // 重新整理下拉選單
            }
        } else {
            alert('Failed to update record.');
        }
    } catch(err) {
        console.error(err);
        alert('Error connecting to server.');
    }
}

// --- Function 7 (Delete) ---
async function runCRUD7() {
    const cId = parseInt(document.getElementById('m7-country').value);
    const start = parseInt(document.getElementById('m7-start').value);
    const end = parseInt(document.getElementById('m7-end').value);
    
    if(!cId || !start || !end) return alert('Please fill in all fields.');
    if(!confirm('Are you sure you want to delete these records?')) return;
    
    try {
        const res = await fetch('/api/srb-data', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ country_id: cId, start_year: start, end_year: end })
        });
        
        if(res.ok) {
            const result = await res.json();
            // 從本地資料中移除已刪除的項目
            srbData = srbData.filter(d => !(d.country_id === cId && d.year >= start && d.year <= end));
            alert(`Deleted ${result.affectedRows || 'selected'} record(s).`);
        } else {
            alert('Failed to delete records.');
        }
    } catch(err) {
        console.error(err);
        alert('Error connecting to server.');
    }
}

function getMaxYear(cId) {
    const records = srbData.filter(d => d.country_id === cId);
    if(records.length === 0) return 0;
    return Math.max(...records.map(r => r.year));
}