let charts = {};

// Register after Chart.js loads
document.addEventListener('DOMContentLoaded', () => {
    if (typeof Chart !== 'undefined' && typeof ChartDataLabels !== 'undefined') {
        Chart.register(ChartDataLabels);
        Chart.defaults.set('plugins.datalabels', {
            color: '#ffffff',
            font: { family: "'Plus Jakarta Sans', sans-serif", weight: '600', size: 10 },
            formatter: v => v > 0 ? v : ''
        });
    }
});

// ── Destroy helpers ─────────────────────────────────
function destroyCharts(...keys) {
    keys.forEach(k => {
        if (charts[k]) { charts[k].destroy(); charts[k] = null; }
    });
}

// ── Download Chart as PNG ───────────────────────────
function downloadChart(canvasId, filename = 'chart') {
    const canvas = document.getElementById(canvasId);
    if (!canvas) {
        console.warn('Canvas not found:', canvasId);
        return;
    }
    
    // Create a temporary link element
    const link = document.createElement('a');
    link.download = `${filename}.png`;
    
    // Convert canvas to blob and trigger download
    canvas.toBlob(function(blob) {
        if (blob) {
            const url = URL.createObjectURL(blob);
            link.href = url;
            link.click();
            URL.revokeObjectURL(url);
        }
    }, 'image/png', 1.0);
}

// ── Create Download Button HTML ─────────────────────
function createDownloadButton(canvasId, filename, buttonClass = '') {
    return `
        <button class="chart-download-btn ${buttonClass}" 
                onclick="downloadChart('${canvasId}', '${filename}')" 
                title="Download chart sebagai PNG">
            <i class="bi bi-download"></i>
        </button>
    `;
}

// ── Detail Modal ─────────────────────────────────────

function showDetailModal(title, data, columns) {
    const modal = document.getElementById('detail-modal');
    const body  = document.getElementById('modal-body');
    const titleEl = document.getElementById('modal-title');
    const countEl = document.getElementById('modal-count');
    if (!modal || !body) return;

    titleEl.textContent = title;
    countEl.textContent = `${data.length} data`;

    const ths  = columns.map(c => `<th>${escapeHtml(c)}</th>`).join('');
    const rows = data.length === 0
        ? `<tr class="empty-row"><td colspan="${columns.length}"><i class="fa-solid fa-inbox" style="margin-right:6px"></i>Tidak ada data</td></tr>`
        : data.map(row => `<tr>${columns.map(col => `<td title="${escapeHtml(row[col])}">${escapeHtml(row[col])}</td>`).join('')}</tr>`).join('');

    body.innerHTML = `
        <table>
            <thead><tr>${ths}</tr></thead>
            <tbody>${rows}</tbody>
        </table>`;

    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function closeDetailModal(e) {
    // If called with an event (overlay click), only close if clicked directly on the overlay
    const modal = document.getElementById('detail-modal');
    if (!modal) return;
    if (e instanceof Event && e.target !== modal) return;
    modal.classList.add('hidden');
    document.body.style.overflow = '';
}

window.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeDetailModal();
});

// ── Chart Base Options ───────────────────────────────
function getCssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

const baseChartColors = {
    // Primary colors
    navy:        '#1e293b',
    navyLight:   '#dbeafe',
    navyDark:   '#1e40af',
    gray:        '#64748b',
    grayLight:   '#cbd5e1',
    grayDark:    '#475569',
    
    // Monochrome scale for charts
    mono0:  '#ffffff',
    mono1:  '#f8fafc',
    mono2:  '#f1f5f9',
    mono3:  '#e2e8f0',
    mono4:  '#cbd5e1',
    mono5:  '#94a3b8',
    mono6:  '#64748b',
    mono7:  '#475569',
    mono8:  '#334155',
    mono9:  '#1e293b',
    mono10: '#0f172a',
    
    // Semantic aliases for charts
    blue:   '#3b82f6',
    red:    '#64748b',
    green:  '#22c55e',
    yellow: '#eab308',
    purple: '#7c3aed',
    
    teal:   '#64748b',
    orange: '#64748b',
    orangeDark: '#334155'
};

// Light theme grid and ticks using monochrome scale
const lightGrid = {
    color: '#e2e8f0',
};

const lightTicks = {
    color: '#64748b',
    font: { family: "'Plus Jakarta Sans', sans-serif", size: 10 }
};

// Tooltip light theme using monochrome scale
const lightTooltip = {
    backgroundColor: '#1e293b', 
    borderColor: '#0f172a', 
    borderWidth: 1,
    titleColor: '#ffffff',
    bodyColor: '#ffffff', 
    padding: 10,
    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
};

// ── Factory: Line Chart ──────────────────────────────
function makeLineChart(canvasId, label, data, color, onClickFn) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return null;
    destroyCharts(canvasId);
    return charts[canvasId] = new Chart(canvas, {
        type: 'line',
        data: {
            labels: MONTH_LABELS,
            datasets: [{
                label, data,
                borderColor: color,
                backgroundColor: color + '15',
                tension: 0.4, fill: true, borderWidth: 2,
                pointBackgroundColor: color,
                pointBorderColor: '#ffffff',
                pointBorderWidth: 2,
                pointRadius: 4,
                pointHoverRadius: 6,
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { display: false },
                datalabels: { display: true, align: 'top', offset: 6, color: '#64748b', font: { size: 10 } },
                tooltip: lightTooltip
            },
            scales: {
                x: { grid: lightGrid, ticks: lightTicks },
                y: { beginAtZero: true, grid: lightGrid, ticks: { ...lightTicks, stepSize: 1 } }
            },
            onClick: (_, els) => { if (els.length) onClickFn(els[0].index); }
        }
    });
}

// ── Factory: Horizontal Bar Chart ───────────────────
function makeHBarChart(canvasId, label, chartData, color, onClickFn) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return null;
    destroyCharts(canvasId);
    return charts[canvasId] = new Chart(canvas, {
        type: 'bar',
        data: {
            labels: chartData.labels,
            datasets: [{
                label, data: chartData.values,
                backgroundColor: color + 'cc',
                hoverBackgroundColor: color,
                borderRadius: 4, borderSkipped: false
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false, indexAxis: 'y',
            plugins: {
                legend: { display: false },
                datalabels: { display: true, anchor: 'end', align: 'right', offset: 4, color: '#64748b', font: { size: 10 } },
                tooltip: lightTooltip
            },
            scales: {
                x: { beginAtZero: true, grid: lightGrid, ticks: lightTicks },
                y: { grid: { display: false }, ticks: { ...lightTicks, font: { size: 11 } } }
            },
            onClick: (_, els) => { if (els.length) onClickFn(els[0].index); }
        }
    });
}

// ── Factory: Doughnut Chart ──────────────────────────
function makeDoughnutChart(canvasId, chartData, colors, onClickFn) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return null;
    destroyCharts(canvasId);
    return charts[canvasId] = new Chart(canvas, {
        type: 'doughnut',
        data: {
            labels: chartData.labels,
            datasets: [{ data: chartData.values, backgroundColor: colors, borderWidth: 0, hoverOffset: 6 }]
        },
        options: {
            responsive: true, maintainAspectRatio: false, cutout: '68%',
            plugins: {
                legend: { position: 'bottom', labels: { color: '#64748b', font: { size: 11 }, padding: 12, usePointStyle: true } },
                datalabels: {
                    display: true,
                    color: '#ffffff', // Force white label value
                    font: { weight: '700', size: 12 },
                    formatter: (v, ctx) => {
                        const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                        const pct = total > 0 ? Math.round((v / total) * 100) : 0;
                        return pct > 6 ? pct + '%' : '';
                    }
                },
                tooltip: lightTooltip
            },
            onClick: (_, els) => { if (els.length) onClickFn(els[0].index); }
        }
    });
}

// ── Factory: Bar Chart (Daily) ───────────────────────
function makeBarChart(canvasId, label, chartData, color, onClickFn) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return null;
    destroyCharts(canvasId);
    return charts[canvasId] = new Chart(canvas, {
        type: 'bar',
        data: {
            labels: chartData.labels,
            datasets: [{
                label, data: chartData.values,
                backgroundColor: color + 'aa',
                hoverBackgroundColor: color,
                borderRadius: 4, borderSkipped: false
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                datalabels: { display: true, align: 'top', offset: 4, color: '#ffffff', font: { size: 10 }, formatter: v => v > 0 ? v : '' },
                tooltip: lightTooltip
            },
            scales: {
                x: { grid: { display: false }, ticks: { ...lightTicks, maxRotation: 0, autoSkip: false } },
                y: { beginAtZero: true, grid: lightGrid, ticks: { ...lightTicks, stepSize: 1 } }
            },
            onClick: (_, els) => { if (els.length && onClickFn) onClickFn(els[0].index); }
        }
    });
}

// ════════════════════════════════════════════════════
//  BEROBAT CHARTS
// ════════════════════════════════════════════════════

function getVisitTimeCategory(waktu) {
    if (!waktu) return null;
    const parts = waktu.trim().split(':');
    if (parts.length < 2) return null;
    const hour = parseInt(parts[0], 10);
    if (isNaN(hour)) return null;
    if (hour >= 6  && hour < 12) return 'Pagi (06:00–11:59)';
    if (hour >= 12 && hour < 18) return 'Siang (12:00–17:59)';
    if (hour >= 18 && hour < 24) return 'Malam (18:00–23:59)';
    return 'Dini Hari (00:00–05:59)';
}

function getYearlyData(data) {
    const yearCount = {};
    data.forEach(r => {
        const y = _rowYear(r);
        if (y && y > 1900) {
            yearCount[y] = (yearCount[y] || 0) + 1;
        }
    });
    const sorted = Object.keys(yearCount).sort();
    return { labels: sorted, values: sorted.map(y => yearCount[y]) };
}

function getVisitTimeCategoryData(data) {
    const cats = {
        'Pagi (06:00–11:59)': 0,
        'Siang (12:00–17:59)': 0,
        'Malam (18:00–23:59)': 0,
        'Dini Hari (00:00–05:59)': 0,
    };
    data.forEach(r => {
        const cat = getVisitTimeCategory(r.Waktu);
        if (cat && cats[cat] !== undefined) cats[cat]++;
    });
    const labels = Object.keys(cats).filter(k => cats[k] > 0);
    const values = labels.map(k => cats[k]);
    return { labels, values };
}

function getGenderByDeptData(data) {
    const deptSet = {};
    data.forEach(r => {
        const dept = r.Departemen || 'Tidak Diketahui';
        const g    = (r['Jenis Kelamin'] || '').toLowerCase();
        if (!deptSet[dept]) deptSet[dept] = { laki: 0, perempuan: 0 };
        if (g.includes('laki')) deptSet[dept].laki++;
        else if (g.includes('perempuan')) deptSet[dept].perempuan++;
    });
    const sorted = Object.entries(deptSet)
        .sort((a, b) => (b[1].laki + b[1].perempuan) - (a[1].laki + a[1].perempuan))
        .slice(0, 10);
    return {
        depts: sorted.map(([k]) => k),
        laki:  sorted.map(([, v]) => v.laki),
        perempuan: sorted.map(([, v]) => v.perempuan),
    };
}

function makeGroupedHorizontalBarChart(canvasId, chartData, onClickFn) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return null;
    destroyCharts(canvasId);
    return charts[canvasId] = new Chart(canvas, {
        type: 'bar',
        data: {
            labels: chartData.depts,
            datasets: [
                {
                    label: 'Laki-laki',
                    data: chartData.laki,
                    backgroundColor: baseChartColors.navy + 'cc',
                    hoverBackgroundColor: baseChartColors.navy,
                    borderRadius: 3, borderSkipped: false,
                },
                {
                    label: 'Perempuan',
                    data: chartData.perempuan,
                    backgroundColor: baseChartColors.navyDark + 'cc',
                    hoverBackgroundColor: baseChartColors.navyDark,
                    borderRadius: 3, borderSkipped: false,
                }
            ]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom', labels: { color: '#64748b', font: { size: 11 }, padding: 12, usePointStyle: true } },
                datalabels: { display: true, align: 'right', anchor: 'end', offset: 2, color: '#64748b', font: { size: 9 }, formatter: v => v > 0 ? v : '' },
                tooltip: lightTooltip
            },
            scales: {
                x: { beginAtZero: true, grid: lightGrid, ticks: lightTicks },
                y: { grid: { display: false }, ticks: { ...lightTicks, maxRotation: 0, autoSkip: false } }
            },
            onClick: (_, els) => { if (els.length && onClickFn) onClickFn(els[0].index, els[0].datasetIndex); }
        }
    });
}

/**
 * Render tabel Top 10 & Top 20 Obat
 * @param {Array} dataObat - Data dari sheet "D-Obat" yang sudah difilter
 * @param {string} containerId - ID container untuk render
 * @param {Array} colsObat - Kolom untuk detail modal
 */
function renderObatTable(dataObat, containerId, colsObat) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    // Kolom yang digunakan untuk detail modal
    const detailCols = colsObat || ['Tanggal', 'Nama', 'Departemen', 'Nama Obat', 'Jumlah Obat', 'Satuan Obat'];
    
    // Top 10 Obat - Total Diberikan Kepada Pasien (berdasarkan frekuensi)
    const top10 = getTopData(dataObat, 'Nama Obat', 10);
    
    // Top 20 Obat — Total Jumlah Yang Digunakan (berdasarkan kuantitas)
    const top20Jumlah = getTopObatByJumlah(dataObat, 20);
    
    container.innerHTML = `
        <div class="chart-grid">
            <div class="chart-card col-6">
                <div class="chart-title">
                    <i class="fa-solid fa-pills"></i> Top 10 Obat - Total Diberikan Kepada Pasien 
                    <span class="chart-hint">klik bar → detail</span>
                </div>
                <div class="table-wrap" style="max-height: 400px; overflow-y: auto;">
                    <table>
                        <thead><tr><th>Obat</th><th>Frekuensi</th></tr></thead>
                        <tbody id="top10-obat-body"></tbody>
                    </table>
                </div>
            </div>
            <div class="chart-card col-6">
                <div class="chart-title">
                    <i class="fa-solid fa-box-open"></i> Top 20 Obat — Total Jumlah Yang Digunakan 
                    <span class="chart-hint">klik bar → detail</span>
                </div>
                <div class="table-wrap" style="max-height: 400px; overflow-y: auto;">
                    <table>
                        <thead><tr><th>Obat</th><th>Total Unit</th></tr></thead>
                        <tbody id="top20-obat-jumlah-body"></tbody>
                    </table>
                </div>
            </div>
        </div>
    `;
    
    // Isi tabel Top 10 (frekuensi)
    const tbody10 = document.getElementById('top10-obat-body');
    if (tbody10) {
        if (top10.labels.length === 0) {
            const row = tbody10.insertRow();
            const cell = row.insertCell();
            cell.colSpan = 2;
            cell.textContent = 'Tidak ada data obat';
            cell.style.textAlign = 'center';
            cell.style.color = 'var(--text-tertiary)';
            cell.style.padding = '24px';
        } else {
            top10.labels.forEach((label, i) => {
                const row = tbody10.insertRow();
                row.insertCell().textContent = label;
                row.insertCell().textContent = top10.values[i];
                row.style.cursor = 'pointer';
                row.addEventListener('click', () => {
                    showDetailModal(`Obat: ${label}`, 
                        dataObat.filter(r => (r['Nama Obat'] || '').trim() === label), 
                        detailCols);
                });
            });
        }
    }
    
    // Isi tabel Top 20 (jumlah/kuantitas)
    const tbody20 = document.getElementById('top20-obat-jumlah-body');
    if (tbody20) {
        if (top20Jumlah.labels.length === 0) {
            const row = tbody20.insertRow();
            const cell = row.insertCell();
            cell.colSpan = 2;
            cell.textContent = 'Tidak ada data obat';
            cell.style.textAlign = 'center';
            cell.style.color = 'var(--text-tertiary)';
            cell.style.padding = '24px';
        } else {
            top20Jumlah.labels.forEach((label, i) => {
                const row = tbody20.insertRow();
                row.insertCell().textContent = label;
                row.insertCell().textContent = top20Jumlah.values[i].toFixed(0);
                row.style.cursor = 'pointer';
                row.addEventListener('click', () => {
                    showDetailModal(`Obat (Jumlah): ${label}`, 
                        dataObat.filter(r => (r['Nama Obat'] || '').trim() === label), 
                        detailCols);
                });
            });
        }
    }
}

function createBerobatCharts(data, containerId, dataDiagnosa = [], dataObat = []) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const cols = [
        'Timestamp','ID','Tanggal','Waktu','Perusahaan','Departemen','Nama','Jenis Kelamin',
        'Keluhan','Kategori Diagnosa','Nama Diagnosa','Kategori Obat','Nama Obat',
        'Jumlah Obat','Satuan Obat','Tindakan','Perlu Istirahat','Jumlah Hari Istirahat','Keterangan Berobat'
    ];
    const colsDiagnosa = ['Tanggal','Nama','Departemen','Perusahaan','Nama Diagnosa'];
    const colsObat     = ['Tanggal','Nama','Departemen','Perusahaan','Nama Obat','Jumlah Obat','Satuan Obat'];

    // Build main structure dengan tombol download di setiap chart
    container.innerHTML = `
        <div class="chart-grid">
            <div class="chart-card col-4">
                <div class="chart-title">
                    <i class="fa-solid fa-calendar-check"></i> Per Tahun 
                    <span class="chart-hint">klik bar → detail</span>
                    ${createDownloadButton('ch-berobat-yearly', 'Berobat_Per_Tahun')}
                </div>
                <div class="chart-wrap h-240"><canvas id="ch-berobat-yearly"></canvas></div>
            </div>
            <div class="chart-card col-8">
                <div class="chart-title">
                    <i class="fa-solid fa-chart-line"></i> Per Bulan 
                    <span class="chart-hint">klik titik → detail</span>
                    ${createDownloadButton('ch-berobat-monthly', 'Berobat_Per_Bulan')}
                </div>
                <div class="chart-wrap h-240"><canvas id="ch-berobat-monthly"></canvas></div>
            </div>
            
            <div class="chart-card col-12">
                <div class="chart-title">
                    <i class="fa-solid fa-chart-column"></i> Kunjungan per Hari 
                    <span class="chart-hint">klik bar → detail</span>
                    ${createDownloadButton('ch-berobat-daily', 'Berobat_Kunjungan_per_Hari')}
                </div>
                <div class="chart-wrap h-240"><canvas id="ch-berobat-daily"></canvas></div>
            </div>
        </div>

        <div class="chart-grid">
            <div class="chart-card col-4">
                <div class="chart-title">
                    <i class="fa-solid fa-venus-mars"></i> Jenis Kelamin 
                    <span class="chart-hint">klik slice → detail</span>
                    ${createDownloadButton('ch-berobat-gender', 'Berobat_Jenis_Kelamin')}
                </div>
                <div class="chart-wrap h-280"><canvas id="ch-berobat-gender"></canvas></div>
            </div>
            <div class="chart-card col-8">
                <div class="chart-title">
                    <i class="fa-solid fa-building"></i> Per Departemen 
                    <span class="chart-hint">klik bar → detail</span>
                    ${createDownloadButton('ch-berobat-dept', 'Berobat_Per_Departemen')}
                </div>
                <div class="chart-wrap h-280"><canvas id="ch-berobat-dept"></canvas></div>
            </div>
            <div class="chart-card col-6">
                <div class="chart-title">
                    <i class="fa-solid fa-venus-mars"></i> Jenis Kelamin per Departemen 
                    <span class="chart-hint">klik bar → detail</span>
                    ${createDownloadButton('ch-berobat-gender-dept', 'Berobat_Gender_per_Departemen')}
                </div>
                <div class="chart-wrap h-400"><canvas id="ch-berobat-gender-dept"></canvas></div>
            </div>
            <div class="chart-card col-6">
                <div class="chart-title">
                    <i class="fa-solid fa-clock"></i> Distribusi Waktu Kunjungan 
                    <span class="chart-hint">klik bar → detail</span>
                    ${createDownloadButton('ch-berobat-waktu', 'Berobat_Waktu_Kunjungan')}
                </div>
                <div class="chart-wrap h-400"><canvas id="ch-berobat-waktu"></canvas></div>
            </div>
        </div>

        <div class="chart-grid">
            <div class="chart-card col-4">
                <div class="chart-title">
                    <i class="fa-solid fa-bed"></i> Status Perlu Istirahat 
                    <span class="chart-hint">klik slice → detail</span>
                    ${createDownloadButton('ch-berobat-istirahat-status', 'Berobat_Status_Istirahat')}
                </div>
                <div class="chart-wrap h-280"><canvas id="ch-berobat-istirahat-status"></canvas></div>
            </div>
            <div class="chart-card col-8">
                <div class="chart-title">
                    <i class="fa-solid fa-calendar-days"></i> Top 10 Hari Istirahat 
                    <span class="chart-hint">klik bar → detail</span>
                    ${createDownloadButton('ch-berobat-istirahat', 'Berobat_Top_10_Hari_Istirahat')}
                </div>
                <div class="chart-wrap h-280"><canvas id="ch-berobat-istirahat"></canvas></div>
            </div>
            <div class="chart-card col-12">
                <div class="chart-title">
                    <i class="fa-solid fa-stethoscope"></i> Top 10 Diagnosa 
                    <span class="chart-hint">klik bar → detail</span>
                    ${createDownloadButton('ch-berobat-diagnosa', 'Berobat_Top_10_Diagnosa')}
                </div>
                <div class="chart-wrap h-320"><canvas id="ch-berobat-diagnosa"></canvas></div>
            </div>
        </div>

        <div class="chart-grid">
            <div class="chart-card col-12">
                <div class="chart-title">
                    <i class="fa-solid fa-users"></i> Top 10 Nama Karyawan Sering Berobat 
                    <span class="chart-hint">klik bar → detail</span>
                    ${createDownloadButton('ch-berobat-nama', 'Berobat_Top_10_Karyawan')}
                </div>
                <div class="chart-wrap h-320"><canvas id="ch-berobat-nama"></canvas></div>
            </div>
        </div>
        <div id="berobat-obat-tables"></div>
    `;

    // ── Daily
    const daily = getDailyData(data);
    makeBarChart('ch-berobat-daily', 'Kunjungan', daily, baseChartColors.navy, idx => {
        const day = daily.labels[idx];
        showDetailModal(`Berobat — Tanggal ${day}`, data.filter(r => extractDayFromDate(r.Tanggal) === day), cols);
    });

    // ── Monthly
    makeLineChart('ch-berobat-monthly', 'Kunjungan', getMonthlyData(data), baseChartColors.navy, idx => {
        showDetailModal(`Berobat — ${MONTH_LABELS[idx]}`, data.filter(r => _rowMonth(r) === idx + 1), cols);
    });

    // ── Yearly
    const yearlyData = getYearlyData(data);
    makeBarChart('ch-berobat-yearly', 'Kunjungan', yearlyData, baseChartColors.navyDark, idx => {
        const yr = parseInt(yearlyData.labels[idx]);
        showDetailModal(`Berobat — Tahun ${yr}`, data.filter(r => _rowYear(r) === yr), cols);
    });

    // ── Gender (doughnut)
    const genderData = getGenderData(data);
    makeDoughnutChart('ch-berobat-gender', genderData,
        [baseChartColors.navy, baseChartColors.navyDark, baseChartColors.mono5], idx => {
        const val = genderData.labels[idx];
        const subset = data.filter(r => {
            const g = (r['Jenis Kelamin'] || '').toLowerCase();
            if (val === 'Laki-laki') return g.includes('laki');
            if (val === 'Perempuan') return g.includes('perempuan');
            return !g.includes('laki') && !g.includes('perempuan');
        });
        showDetailModal(`Berobat — ${val}`, subset, cols);
    });

    // ── Dept
    const deptData = getTopData(data, 'Departemen', 10);
    makeHBarChart('ch-berobat-dept', 'Kunjungan', deptData, baseChartColors.navyDark, idx => {
        const val = deptData.labels[idx];
        showDetailModal(`Berobat — ${val}`, data.filter(r => r.Departemen === val), cols);
    });

    // ── Gender × Departemen (Horizontal Grouped Bar)
    const genderDeptData = getGenderByDeptData(data);
    makeGroupedHorizontalBarChart('ch-berobat-gender-dept', genderDeptData, (idx, dsIdx) => {
        const dept  = genderDeptData.depts[idx];
        const gender = dsIdx === 0 ? 'laki' : 'perempuan';
        const subset = data.filter(r => {
            const g = (r['Jenis Kelamin'] || '').toLowerCase();
            return r.Departemen === dept && g.includes(gender);
        });
        const label = dsIdx === 0 ? 'Laki-laki' : 'Perempuan';
        showDetailModal(`Berobat — ${dept} (${label})`, subset, cols);
    });

    // ── Waktu Kunjungan
    const waktuData = getVisitTimeCategoryData(data);
    makeBarChart('ch-berobat-waktu', 'Kunjungan', waktuData, baseChartColors.navyDark, idx => {
        const cat = waktuData.labels[idx];
        const subset = data.filter(r => getVisitTimeCategory(r.Waktu) === cat);
        showDetailModal(`Berobat — ${cat}`, subset, cols);
    });

    // ── Top 10 Diagnosa (dari dataDiagnosa / D-Diagnosa)
    const diagnosaData = getTopData(dataDiagnosa, 'Nama Diagnosa', 10);
    makeHBarChart('ch-berobat-diagnosa', 'Jumlah', diagnosaData, baseChartColors.navyDark, idx => {
        const val = diagnosaData.labels[idx];
        showDetailModal(`Diagnosa: ${val}`, dataDiagnosa.filter(r => r['Nama Diagnosa'] === val), colsDiagnosa);
    });

    // ── Top 10 Nama Karyawan
    const namaData = getTopData(data, 'Nama', 10);
    makeHBarChart('ch-berobat-nama', 'Kunjungan', namaData, baseChartColors.navy, idx => {
        const val = namaData.labels[idx];
        showDetailModal(`Berobat — ${val}`, data.filter(r => r.Nama === val), cols);
    });

    // ── Status Istirahat (doughnut)
    const istirahatStatusData = (() => {
        let ya = 0, tidak = 0;
        data.forEach(r => {
            const v = (r['Perlu Istirahat'] || '').toLowerCase();
            if (v.includes('ya')) ya++;
            else tidak++;
        });
        const labels = [], values = [];
        if (ya > 0)    { labels.push('Perlu Istirahat');  values.push(ya); }
        if (tidak > 0) { labels.push('Tidak Istirahat');  values.push(tidak); }
        return { labels, values };
    })();
    makeDoughnutChart('ch-berobat-istirahat-status', istirahatStatusData,
        [baseChartColors.navy, baseChartColors.navyDark], idx => {
        const val = istirahatStatusData.labels[idx];
        const isYa = val === 'Perlu Istirahat';
        const subset = data.filter(r => {
            const v = (r['Perlu Istirahat'] || '').toLowerCase();
            return isYa ? v.includes('ya') : !v.includes('ya');
        });
        showDetailModal(`Berobat — ${val}`, subset, cols);
    });

    // ── Top 10 Hari Istirahat (bar)
    const istirahatData = getTopIstirahatData(data);
    makeHBarChart('ch-berobat-istirahat', 'Hari', istirahatData, baseChartColors.navy, idx => {
        const nama = istirahatData.labels[idx].split(' (')[0];
        showDetailModal(`Berobat — Istirahat: ${nama}`, data.filter(r => r.Nama === nama), cols);
    });

    // ── Obat Tables (menggunakan dataObat dari D-Obat)
    renderObatTable(dataObat, 'berobat-obat-tables', colsObat);
}

// ════════════════════════════════════════════════════
//  KECELAKAAN CHARTS
// ════════════════════════════════════════════════════

function createKecelakaanCharts(data, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const cols = [
        'Timestamp','ID','Tanggal','Waktu','Perusahaan','Departemen','Nama','Jenis Kelamin',
        'Lokasi Kejadian','Penyebab','Bagian Yang Terluka','Tindakan','Deskripsi Kejadian'
    ];

    container.innerHTML = `
        <div class="chart-grid">
            <div class="chart-card col-6">
                <div class="chart-title">
                    <i class="fa-solid fa-chart-line"></i> Per Bulan 
                    <span class="chart-hint">klik titik → detail</span>
                    ${createDownloadButton('ch-kec-monthly', 'Kecelakaan_Per_Bulan')}
                </div>
                <div class="chart-wrap h-240"><canvas id="ch-kec-monthly"></canvas></div>
            </div>
            <div class="chart-card col-6">
                <div class="chart-title">
                    <i class="fa-solid fa-building"></i> Per Departemen 
                    <span class="chart-hint">klik bar → detail</span>
                    ${createDownloadButton('ch-kec-dept', 'Kecelakaan_Per_Departemen')}
                </div>
                <div class="chart-wrap h-240"><canvas id="ch-kec-dept"></canvas></div>
            </div>
        </div>

        <div class="chart-grid">
            <div class="chart-card col-4">
                <div class="chart-title">
                    <i class="fa-solid fa-venus-mars"></i> Jenis Kelamin 
                    <span class="chart-hint">klik slice → detail</span>
                    ${createDownloadButton('ch-kec-gender', 'Kecelakaan_Jenis_Kelamin')}
                </div>
                <div class="chart-wrap h-280"><canvas id="ch-kec-gender"></canvas></div>
            </div>
            <div class="chart-card col-8">
                <div class="chart-title">
                    <i class="fa-solid fa-location-dot"></i> Top Lokasi Kejadian 
                    <span class="chart-hint">klik bar → detail</span>
                    ${createDownloadButton('ch-kec-lokasi', 'Kecelakaan_Lokasi_Kejadian')}
                </div>
                <div class="chart-wrap h-280"><canvas id="ch-kec-lokasi"></canvas></div>
            </div>
        </div>

        <div class="chart-grid">
            <div class="chart-card col-6">
                <div class="chart-title">
                    <i class="fa-solid fa-person-falling-burst"></i> Bagian Terluka 
                    <span class="chart-hint">klik bar → detail</span>
                    ${createDownloadButton('ch-kec-luka', 'Kecelakaan_Bagian_Terluka')}
                </div>
                <div class="chart-wrap h-280"><canvas id="ch-kec-luka"></canvas></div>
            </div>
            <div class="chart-card col-6">
                <div class="chart-title">
                    <i class="fa-solid fa-circle-exclamation"></i> Penyebab 
                    <span class="chart-hint">klik bar → detail</span>
                    ${createDownloadButton('ch-kec-penyebab', 'Kecelakaan_Penyebab')}
                </div>
                <div class="chart-wrap h-280"><canvas id="ch-kec-penyebab"></canvas></div>
            </div>
        </div>`;

    makeLineChart('ch-kec-monthly', 'Kecelakaan', getMonthlyData(data), baseChartColors.gray, idx => {
        showDetailModal(`Kecelakaan — ${MONTH_LABELS[idx]}`, data.filter(r => _rowMonth(r) === idx + 1), cols);
    });

    const deptData = getTopData(data, 'Departemen', 10);
    makeHBarChart('ch-kec-dept', 'Kecelakaan', deptData, baseChartColors.gray, idx => {
        const val = deptData.labels[idx];
        showDetailModal(`Kecelakaan — ${val}`, data.filter(r => r.Departemen === val), cols);
    });

    const genderData = getGenderData(data);
    makeDoughnutChart('ch-kec-gender', genderData,
        [baseChartColors.navy, baseChartColors.gray, baseChartColors.mono5], idx => {
        const val = genderData.labels[idx];
        const subset = data.filter(r => {
            const g = (r['Jenis Kelamin'] || '').toLowerCase();
            if (val === 'Laki-laki') return g.includes('laki');
            if (val === 'Perempuan') return g.includes('perempuan');
            return !g.includes('laki') && !g.includes('perempuan');
        });
        showDetailModal(`Kecelakaan — ${val}`, subset, cols);
    });

    const lokasiData = getTopData(data, 'Lokasi Kejadian', 10);
    makeHBarChart('ch-kec-lokasi', 'Kejadian', lokasiData, baseChartColors.gray, idx => {
        const val = lokasiData.labels[idx];
        showDetailModal(`Kecelakaan — Lokasi: ${val}`, data.filter(r => r['Lokasi Kejadian'] === val), cols);
    });

    const lukaData = getTopData(data, 'Bagian Yang Terluka', 10);
    makeHBarChart('ch-kec-luka', 'Kasus', lukaData, baseChartColors.grayDark, idx => {
        const val = lukaData.labels[idx];
        showDetailModal(`Kecelakaan — Bagian: ${val}`, data.filter(r => r['Bagian Yang Terluka'] === val), cols);
    });

    const penyebabData = getTopData(data, 'Penyebab', 10);
    makeHBarChart('ch-kec-penyebab', 'Kasus', penyebabData, baseChartColors.navyDark, idx => {
        const val = penyebabData.labels[idx];
        showDetailModal(`Kecelakaan — Penyebab: ${val}`, data.filter(r => r.Penyebab === val), cols);
    });
}

// ════════════════════════════════════════════════════
//  KONSULTASI CHARTS
// ════════════════════════════════════════════════════

function createKonsultasiCharts(data, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const cols = [
        'Timestamp','ID','Tanggal','Waktu','Perusahaan','Departemen','Nama','Jenis Kelamin',
        'Keluhan','Riwayat Penyakit','Saran'
    ];

    container.innerHTML = `
        <div class="chart-grid">
            <div class="chart-card col-6">
                <div class="chart-title">
                    <i class="fa-solid fa-chart-line"></i> Per Bulan 
                    <span class="chart-hint">klik titik → detail</span>
                    ${createDownloadButton('ch-kon-monthly', 'Konsultasi_Per_Bulan')}
                </div>
                <div class="chart-wrap h-240"><canvas id="ch-kon-monthly"></canvas></div>
            </div>
            <div class="chart-card col-6">
                <div class="chart-title">
                    <i class="fa-solid fa-building"></i> Per Departemen 
                    <span class="chart-hint">klik bar → detail</span>
                    ${createDownloadButton('ch-kon-dept', 'Konsultasi_Per_Departemen')}
                </div>
                <div class="chart-wrap h-240"><canvas id="ch-kon-dept"></canvas></div>
            </div>
        </div>

        <div class="chart-grid">
            <div class="chart-card col-4">
                <div class="chart-title">
                    <i class="fa-solid fa-venus-mars"></i> Jenis Kelamin 
                    <span class="chart-hint">klik slice → detail</span>
                    ${createDownloadButton('ch-kon-gender', 'Konsultasi_Jenis_Kelamin')}
                </div>
                <div class="chart-wrap h-280"><canvas id="ch-kon-gender"></canvas></div>
            </div>
            <div class="chart-card col-8">
                <div class="chart-title">
                    <i class="fa-solid fa-comment-medical"></i> Top Keluhan 
                    <span class="chart-hint">klik bar → detail</span>
                    ${createDownloadButton('ch-kon-keluhan', 'Konsultasi_Top_Keluhan')}
                </div>
                <div class="chart-wrap h-280"><canvas id="ch-kon-keluhan"></canvas></div>
            </div>
        </div>`;

    makeLineChart('ch-kon-monthly', 'Konsultasi', getMonthlyData(data), baseChartColors.green, idx => {
        showDetailModal(`Konsultasi — ${MONTH_LABELS[idx]}`, data.filter(r => _rowMonth(r) === idx + 1), cols);
    });

    const deptData = getTopData(data, 'Departemen', 10);
    makeHBarChart('ch-kon-dept', 'Konsultasi', deptData, baseChartColors.green, idx => {
        const val = deptData.labels[idx];
        showDetailModal(`Konsultasi — ${val}`, data.filter(r => r.Departemen === val), cols);
    });

    const genderData = getGenderData(data);
    makeDoughnutChart('ch-kon-gender', genderData,
        [baseChartColors.navy, baseChartColors.gray, baseChartColors.mono5], idx => {
        const val = genderData.labels[idx];
        const subset = data.filter(r => {
            const g = (r['Jenis Kelamin'] || '').toLowerCase();
            if (val === 'Laki-laki') return g.includes('laki');
            if (val === 'Perempuan') return g.includes('perempuan');
            return !g.includes('laki') && !g.includes('perempuan');
        });
        showDetailModal(`Konsultasi — ${val}`, subset, cols);
    });

    const keluhanData = getTopData(data, 'Keluhan', 10);
    makeHBarChart('ch-kon-keluhan', 'Kasus', keluhanData, baseChartColors.gray, idx => {
        const val = keluhanData.labels[idx];
        showDetailModal(`Konsultasi — Keluhan: ${val}`, data.filter(r => r.Keluhan === val), cols);
    });
}