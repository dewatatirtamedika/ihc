const MONTH_LABELS = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];

// ── Date Parsing ────────────────────────────────────
function parseDMY(s) {
    if (!s) return null;
    const str = String(s).trim();
    const parts = str.split('/');
    if (parts.length !== 3) return null;
    const day   = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    let   year  = parseInt(parts[2], 10);
    if (year < 100) year += 2000;
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year > 1900) {
        return { day, month, year };
    }
    return null;
}

function parseDateString(s) {
    if (!s) return { m: 0, y: 0 };
    const d = parseDMY(s);
    return d ? { m: d.month, y: d.year } : { m: 0, y: 0 };
}

function extractDayFromDate(tanggal) {
    const d = parseDMY(tanggal);
    return d ? d.day.toString() : null;
}

// ── Aggregate Helpers ───────────────────────────────

// Returns month (1–12) from a row; uses pre-computed r.bulan when available,
// otherwise falls back to parsing r.Tanggal (dd/MM/yyyy).
function _rowMonth(r) {
    if (r.bulan >= 1 && r.bulan <= 12) return r.bulan;
    const d = parseDMY(r.Tanggal);
    return d ? d.month : 0;
}

// Returns year from a row; uses pre-computed r.tahun when available.
function _rowYear(r) {
    if (r.tahun && r.tahun > 1900) return r.tahun;
    const d = parseDMY(r.Tanggal);
    return d ? d.year : 0;
}

function getMonthlyData(data) {
    const monthly = Array(12).fill(0);
    data.forEach(r => {
        const m = _rowMonth(r);
        if (m >= 1 && m <= 12) monthly[m - 1]++;
    });
    return monthly;
}

function getDailyData(data) {
    const daily = {};
    data.forEach(r => {
        const day = extractDayFromDate(r.Tanggal);
        if (day) daily[day] = (daily[day] || 0) + 1;
    });
    const labels = [], values = [];
    for (let i = 1; i <= 31; i++) {
        labels.push(i.toString());
        values.push(daily[i.toString()] || 0);
    }
    return { labels, values };
}

function getGenderData(data) {
    const counts = { 'Laki-laki': 0, 'Perempuan': 0, 'Lainnya': 0 };
    data.forEach(r => {
        const g = (r['Jenis Kelamin'] || '').toLowerCase();
        if (g.includes('laki')) counts['Laki-laki']++;
        else if (g.includes('perempuan')) counts['Perempuan']++;
        else counts['Lainnya']++;
    });
    return {
        labels: Object.keys(counts).filter(k => counts[k] > 0),
        values: Object.values(counts).filter(v => v > 0)
    };
}

function getTopData(data, field, limit = 10) {
    const count = {};
    data.forEach(r => {
        const val = r[field];
        if (!val || val === '-' || val === '') return;
        if (field === 'Nama Obat') {
            val.split(/[,;]/).map(o => o.trim()).filter(o => o && o !== '-')
               .forEach(o => { count[o] = (count[o] || 0) + 1; });
        } else {
            count[val] = (count[val] || 0) + 1;
        }
    });
    const sorted = Object.entries(count).sort((a, b) => b[1] - a[1]).slice(0, limit);
    return { labels: sorted.map(([k]) => k), values: sorted.map(([, v]) => v) };
}

function getTopObatByJumlah(data, limit = 20) {
    const totals = {};
    data.forEach(r => {
        const nama      = (r['Nama Obat'] || '').trim();
        const jumlahRaw = r['Jumlah Obat'];
        
        // Skip jika nama obat kosong atau '-'
        if (!nama || nama === '-') return;
        
        // Handle cell kosong - anggap 0 jika null/undefined/kosong
        let jumlah = 0;
        if (jumlahRaw !== null && jumlahRaw !== undefined && jumlahRaw !== '') {
            jumlah = parseFloat(jumlahRaw);
            // Jika hasil parse adalah NaN, anggap 0
            if (isNaN(jumlah)) jumlah = 0;
        }
        
        // Tetap tambahkan ke totals meskipun jumlah = 0
        // agar obat tetap muncul dalam daftar, tapi jangan tambahkan 0
        if (!totals[nama]) totals[nama] = 0;
        totals[nama] += jumlah;
    });
    
    const sorted = Object.entries(totals).sort((a, b) => b[1] - a[1]).slice(0, limit);
    return { labels: sorted.map(([k]) => k), values: sorted.map(([, v]) => v) };
}

function getTopIstirahatData(data) {
    const namaMap = {};
    data.forEach(r => {
        const hari = parseInt(r['Jumlah Hari Istirahat']);
        if (!hari || hari <= 0) return;
        const nama = r.Nama || 'Tidak diketahui';
        namaMap[nama] = (namaMap[nama] || 0) + hari;
    });
    const sorted = Object.entries(namaMap).sort((a, b) => b[1] - a[1]).slice(0, 10);
    return {
        labels: sorted.map(([nama, hari]) => `${nama} (${hari}h)`),
        values: sorted.map(([, v]) => v)
    };
}

// ── XSS Protection ──────────────────────────────────
function escapeHtml(str) {
    if (str === null || str === undefined || str === '') return '—';
    if (str === '-') return '—';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// ── DOM Helpers ─────────────────────────────────────
function el(id) { return document.getElementById(id); }
function setText(id, val) { const e = el(id); if (e) e.textContent = val; }