'use strict';

// ── Viewport-height fix (mobile browser chrome bar) ───
(function setVH() {
  const vh = window.innerHeight * 0.01;
  document.documentElement.style.setProperty('--vh', `${vh}px`);
})();
window.addEventListener('resize', () => {
  document.documentElement.style.setProperty('--vh', `${window.innerHeight * 0.01}px`);
});
window.addEventListener('orientationchange', () => {
  setTimeout(() => {
    document.documentElement.style.setProperty('--vh', `${window.innerHeight * 0.01}px`);
  }, 200);
});

// ════════════════════════════════════════════════════════
//  CONFIG
// ════════════════════════════════════════════════════════
const GAS_URL  = 'https://script.google.com/macros/s/AKfycbxLD0ItE6aHtnnHtIZUfpIkRynaSL34o_gnOI1144iGe1r0EUiQ4G2sF7IcvPMlKZ1mHA/exec';
const BULAN_NAMES = ['Januari','Februari','Maret','April','Mei','Juni',
                     'Juli','Agustus','September','Oktober','November','Desember'];

// ════════════════════════════════════════════════════════
//  INTERNAL STATE
// ════════════════════════════════════════════════════════
const _state = {
  master:    null,
  company:   '',
  passwords: {},
  rawData: {
    berobat:    [],
    kecelakaan: [],
    konsultasi: [],
    dDiagnosa:  [], // Data dari sheet "D-Diagnosa"
    dObat:      [], // Data dari sheet "D-Obat"
  },
  activeTab: 'Berobat',
  activeDataSubTab: 'Berobat',
  filters: {
    dept:  '',
    bulan: '',
    tahun: '',
  },
  // Pencarian nama khusus untuk panel Data (disimpan terpisah)
  dataSearch: {
    berobat: '',
    kecelakaan: '',
    konsultasi: ''
  }
};

// These are updated every time filters change
let _filteredBerobat    = [];
let _filteredKecelakaan = [];
let _filteredKonsultasi = [];
let _filteredDDiagnosa  = []; // Data D-Diagnosa yang sudah difilter
let _filteredDObat      = []; // Data D-Obat yang sudah difilter

// Data setelah filter + search (untuk tampilan di panel Data)
let _searchedBerobat    = [];
let _searchedKecelakaan = [];
let _searchedKonsultasi = [];

const app = {
  get unit()     { return _state.company; },
  get rawData()  {
    const berobat    = _state.rawData.berobat.map(r    => ({ ...r, _type: 'Berobat' }));
    const kecelakaan = _state.rawData.kecelakaan.map(r => ({ ...r, _type: 'Kecelakaan' }));
    const konsultasi = _state.rawData.konsultasi.map(r => ({ ...r, _type: 'Konsultasi' }));
    return [...berobat, ...kecelakaan, ...konsultasi];
  },
  get filtered() {
    const berobat    = _filteredBerobat.map(r    => ({ ...r, _type: 'Berobat' }));
    const kecelakaan = _filteredKecelakaan.map(r => ({ ...r, _type: 'Kecelakaan' }));
    const konsultasi = _filteredKonsultasi.map(r => ({ ...r, _type: 'Konsultasi' }));
    return [...berobat, ...kecelakaan, ...konsultasi];
  },
  get filteredDiagnosa() { return _filteredDDiagnosa; },
  get filteredObat()     { return _filteredDObat; },
  showToast(msg, type = 'info') { _showToast(msg, type); },

  enterDashboard()  { _enterDashboard(); },
  fetchData()       { _fetchData(); },
  setTab(tab)       { _setTab(tab); },
  setDataSubTab(subTab) { _setDataSubTab(subTab); },
  showLoginGate()   { _showLoginGate(); },
  // Reset filter (tanpa search)
  resetFilters()    { _resetFilters(); },
  // Search handlers untuk panel Data
  onDataSearch(type, value) { _onDataSearch(type, value); },
  
  // Export Excel (.xls) untuk data yang sedang ditampilkan
  exportDataToExcel() {
    const type = _state.activeDataSubTab.toLowerCase();
    const dataMap = {
      'berobat': _searchedBerobat,
      'kecelakaan': _searchedKecelakaan,
      'konsultasi': _searchedKonsultasi
    };
    
    const data = dataMap[type] || [];
    
    if (data.length === 0) {
      _showToast('Tidak ada data untuk diexport', 'warning');
      return;
    }
    
    // Definisikan headers sesuai jenis data
    const headersMap = {
      'berobat': [
        'Timestamp', 'ID', 'Tanggal', 'Waktu', 'Perusahaan', 'Departemen', 
        'Nama', 'Jenis Kelamin', 'Keluhan', 'Kategori Diagnosa', 'Nama Diagnosa',
        'Kategori Obat', 'Nama Obat', 'Jumlah Obat', 'Satuan Obat', 'Tindakan',
        'Perlu Istirahat', 'Jumlah Hari Istirahat', 'Keterangan Berobat'
      ],
      'kecelakaan': [
        'Timestamp', 'ID', 'Tanggal', 'Waktu', 'Perusahaan', 'Departemen',
        'Nama', 'Jenis Kelamin', 'Lokasi Kejadian', 'Penyebab', 
        'Bagian Yang Terluka', 'Tindakan', 'Deskripsi Kejadian'
      ],
      'konsultasi': [
        'Timestamp', 'ID', 'Tanggal', 'Waktu', 'Perusahaan', 'Departemen',
        'Nama', 'Jenis Kelamin', 'Keluhan', 'Riwayat Penyakit', 'Saran'
      ]
    };
    
    const headers = headersMap[type] || [];
    
    // Build HTML table untuk Excel
    let html = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" 
            xmlns:x="urn:schemas-microsoft-com:office:excel" 
            xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="UTF-8">
        <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
        <!--[if gte mso 9]><xml>
          <x:ExcelWorkbook>
            <x:ExcelWorksheets>
              <x:ExcelWorksheet>
                <x:Name>IHC Data</x:Name>
                <x:WorksheetOptions>
                  <x:DisplayGridlines/>
                </x:WorksheetOptions>
              </x:ExcelWorksheet>
            </x:ExcelWorksheets>
          </x:ExcelWorkbook>
        </xml><![endif]-->
        <style>
          @page {
            margin: 0.5cm;
            size: landscape;
          }
          body {
            font-family: 'Segoe UI', Arial, sans-serif;
            font-size: 10pt;
            margin: 10px;
          }
          .report-header {
            margin-bottom: 15px;
          }
          .report-title {
            font-size: 14pt;
            font-weight: bold;
            color: #1e293b;
            margin-bottom: 5px;
          }
          .report-meta {
            font-size: 9pt;
            color: #64748b;
            margin-bottom: 3px;
          }
          table {
            border-collapse: collapse;
            width: 100%;
            margin-top: 10px;
          }
          th {
            background-color: #1e293b;
            color: #ffffff;
            font-weight: bold;
            font-size: 9pt;
            padding: 8px 10px;
            border: 1px solid #334155;
            text-align: left;
          }
          td {
            padding: 6px 10px;
            border: 1px solid #e2e8f0;
            font-size: 9pt;
            color: #1e293b;
          }
          tr:nth-child(even) {
            background-color: #f8fafc;
          }
          tr:hover {
            background-color: #e2e8f0;
          }
          .number-col {
            text-align: center;
          }
          .date-col {
            text-align: center;
          }
        </style>
      </head>
      <body>
        <div class="report-header">
          <div class="report-title">IHC Klinik - Data ${_state.activeDataSubTab}</div>
          <div class="report-meta">Unit: ${_state.company}</div>`;
    
    const filters = _state.filters;
    if (filters.tahun) {
      html += `<div class="report-meta">Tahun: ${filters.tahun}</div>`;
    }
    if (filters.bulan) {
      const bulanNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
                        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
      html += `<div class="report-meta">Bulan: ${bulanNames[parseInt(filters.bulan) - 1]}</div>`;
    }
    if (filters.dept) {
      html += `<div class="report-meta">Departemen: ${filters.dept}</div>`;
    }
    
    const now = new Date();
    const tanggalExport = now.toLocaleDateString('id-ID', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    html += `<div class="report-meta">Tanggal Export: ${tanggalExport}</div>`;
    html += `<div class="report-meta">Jumlah Data: ${data.length}</div>`;
    html += `</div>`;
    
    // Build table
    html += `<table>`;
    
    // Header
    html += `<thead><tr>`;
    html += `<th style="text-align:center;width:40px;">No</th>`;
    headers.forEach(h => {
      const isNumberCol = ['Jumlah Obat', 'Jumlah Hari Istirahat'].includes(h);
      const isDateCol = ['Tanggal', 'Timestamp'].includes(h);
      let style = '';
      if (isNumberCol || isDateCol) {
        style = 'text-align:center;';
      }
      html += `<th style="${style}">${h}</th>`;
    });
    html += `</tr></thead>`;
    
    // Body
    html += `<tbody>`;
    data.forEach((row, idx) => {
      html += `<tr>`;
      html += `<td style="text-align:center;font-weight:500;">${idx + 1}</td>`;
      headers.forEach(h => {
        let val = row[h] || '';
        if (typeof val === 'string') {
          val = val.replace(/\|/g, ', ');
        }
        
        const isNumberCol = ['Jumlah Obat', 'Jumlah Hari Istirahat'].includes(h);
        const isDateCol = ['Tanggal', 'Timestamp'].includes(h);
        let style = '';
        if (isNumberCol) {
          style = 'text-align:center;';
        } else if (isDateCol) {
          style = 'text-align:center;';
        }
        
        // Escape HTML
        const escapedVal = String(val)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;');
        
        html += `<td style="${style}">${escapedVal || '—'}</td>`;
      });
      html += `</tr>`;
    });
    html += `</tbody>`;
    html += `</table>`;
    
    html += `
      </body>
      </html>`;
    
    // Create and trigger download
    const blob = new Blob([html], { 
      type: 'application/vnd.ms-excel;charset=utf-8' 
    });
    const link = document.createElement('a');
    const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const companySafe = _state.company.replace(/[^a-zA-Z0-9]/g, '_');
    const filename = `IHC_${_state.activeDataSubTab}_${companySafe}_${timestamp}.xls`;
    
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
    
    _showToast(`File Excel berhasil diunduh (${data.length} data)`, 'success');
  }
};

// ════════════════════════════════════════════════════════
//  BOOTSTRAP
// ════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', async () => {
  _setupFilterListeners();

  try {
    const res = await _gasRequest('getMasterData');
    if (res.status !== 'success') throw new Error(res.message || 'Gagal memuat data master');
    _state.master = res.data;

    if (res.data.passwords) _state.passwords = res.data.passwords;

    _populateCompanySelect();
    _hideLoading();

    const saved = sessionStorage.getItem('ihc_company');
    if (saved && _state.master.perusahaan && _state.master.perusahaan.includes(saved)) {
      _applyCompany(saved, false);
    } else {
      _showLoginGate();
    }
  } catch (e) {
    _hideLoading();
    _showToast('Tidak dapat terhubung ke server: ' + e.message, 'error');
    _showLoginGate();
  }
});

// ════════════════════════════════════════════════════════
//  API HELPER
// ════════════════════════════════════════════════════════
async function _gasRequest(action, payload = {}) {
  const params = new URLSearchParams({ action });
  if (Object.keys(payload).length) params.set('payload', JSON.stringify(payload));
  const res = await fetch(GAS_URL + '?' + params.toString());
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}

// ════════════════════════════════════════════════════════
//  LOADING SCREEN
// ════════════════════════════════════════════════════════
function _hideLoading() {
  const el = document.getElementById('loading-screen');
  if (el) el.classList.add('hidden');
}

// ════════════════════════════════════════════════════════
//  LOGIN / COMPANY GATE
// ════════════════════════════════════════════════════════
function _showLoginGate() {
  const modal = document.getElementById('login-modal');
  const dashboard = document.getElementById('dashboard');
  if (modal) modal.classList.remove('hidden');
  if (dashboard) dashboard.classList.add('hidden');

  const pwEl = document.getElementById('company-password');
  if (pwEl) pwEl.value = '';
  const errEl = document.getElementById('pw-error');
  if (errEl) errEl.classList.add('hidden');
}

function _populateCompanySelect() {
  const sel = document.getElementById('company-select');
  if (!sel || !_state.master?.perusahaan) return;
  sel.innerHTML = '<option value="">— Pilih Unit —</option>';
  _state.master.perusahaan.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p;
    opt.textContent = p;
    sel.appendChild(opt);
  });
}

function _enterDashboard() {
  const sel    = document.getElementById('company-select');
  const pwEl   = document.getElementById('company-password');
  const errEl  = document.getElementById('pw-error');
  const company = sel?.value;
  const password = pwEl?.value || '';

  if (!company) {
    _showToast('Pilih unit perusahaan terlebih dahulu.', 'warning');
    return;
  }

  if (_state.passwords && Object.keys(_state.passwords).length > 0) {
    const expected = _state.passwords[company];
    if (expected && password !== expected) {
      if (errEl) errEl.classList.remove('hidden');
      if (pwEl)  pwEl.focus();
      return;
    }
  }

  if (errEl) errEl.classList.add('hidden');
  _applyCompany(company, true);
}

function _applyCompany(company, showToast = true) {
  _state.company = company;
  sessionStorage.setItem('ihc_company', company);

  document.querySelectorAll('#navbar-company-name, #active-company').forEach(el => {
    el.textContent = company;
  });

  const modal = document.getElementById('login-modal');
  const dashboard = document.getElementById('dashboard');
  if (modal) modal.classList.add('hidden');
  if (dashboard) dashboard.classList.remove('hidden');

  if (showToast) _showToast('Selamat datang, ' + company, 'success');

  _resetFilters(false);
  _fetchData();
}

// ════════════════════════════════════════════════════════
//  DATA FETCHING
// ════════════════════════════════════════════════════════
async function _fetchData() {
  if (!_state.company) return;

  const syncIcon = document.getElementById('sync-icon');
  if (syncIcon) syncIcon.classList.add('spinning');

  try {
    // Fetch semua sheet termasuk D-Diagnosa dan D-Obat
    const [bRes, kRes, koRes, dRes, oRes] = await Promise.all([
      _gasRequest('getAll', { sheet: 'Berobat',    perusahaan: _state.company }),
      _gasRequest('getAll', { sheet: 'Kecelakaan', perusahaan: _state.company }),
      _gasRequest('getAll', { sheet: 'Konsultasi', perusahaan: _state.company }),
      _gasRequest('getAll', { sheet: 'D-Diagnosa', perusahaan: _state.company }),
      _gasRequest('getAll', { sheet: 'D-Obat',     perusahaan: _state.company }),
    ]);

    if (bRes.status  === 'success') _state.rawData.berobat    = _enrichRows(bRes.data  || []);
    if (kRes.status  === 'success') _state.rawData.kecelakaan = _enrichRows(kRes.data  || []);
    if (koRes.status === 'success') _state.rawData.konsultasi = _enrichRows(koRes.data || []);
    if (dRes.status  === 'success') _state.rawData.dDiagnosa  = _enrichRows(dRes.data  || []);
    if (oRes.status  === 'success') _state.rawData.dObat      = _enrichRows(oRes.data  || []);

    _buildFilterOptions();
    _applyFilters();
    _showToast('Data berhasil disinkronisasi', 'success');
  } catch (e) {
    _showToast('Gagal sinkronisasi: ' + e.message, 'error');
  } finally {
    if (syncIcon) syncIcon.classList.remove('spinning');
  }
}

function _enrichRows(rows) {
  return rows.map(r => {
    const d = _parseDMY(r.Tanggal);
    return {
      ...r,
      bulan: d ? d.m : 0,
      tahun: d ? d.y : 0,
    };
  });
}

function _parseDMY(s) {
  if (!s) return null;
  const parts = String(s).trim().split('/');
  if (parts.length !== 3) return null;
  const day = parseInt(parts[0], 10);
  const m   = parseInt(parts[1], 10);
  const y   = parseInt(parts[2], 10);
  if (day >= 1 && day <= 31 && m >= 1 && m <= 12 && y > 1900) return { d: day, m, y };
  return null;
}

// ════════════════════════════════════════════════════════
//  FILTER LOGIC
// ════════════════════════════════════════════════════════
function _setupFilterListeners() {
  const deptEl  = document.getElementById('filter-dept');
  const bulanEl = document.getElementById('filter-bulan');
  const tahunEl = document.getElementById('filter-tahun');

  deptEl?.addEventListener('change',  () => { _state.filters.dept  = deptEl.value;  _applyFilters(); });
  bulanEl?.addEventListener('change', () => { _state.filters.bulan = bulanEl.value; _applyFilters(); });
  tahunEl?.addEventListener('change', () => { _state.filters.tahun = tahunEl.value; _applyFilters(); });
}

function _applyFilters() {
  const { dept, bulan, tahun } = _state.filters;

  function filter(rows) {
    return rows.filter(r => {
      if (dept  && r.Departemen !== dept)  return false;
      if (bulan && String(r.bulan) !== bulan) return false;
      if (tahun && String(r.tahun) !== tahun) return false;
      return true;
    });
  }

  _filteredBerobat    = filter(_state.rawData.berobat);
  _filteredKecelakaan = filter(_state.rawData.kecelakaan);
  _filteredKonsultasi = filter(_state.rawData.konsultasi);
  _filteredDDiagnosa  = filter(_state.rawData.dDiagnosa);
  _filteredDObat      = filter(_state.rawData.dObat);

  // Reset search results ke filtered data
  _applyDataSearch();

  _updateBadges();
  _renderActiveTab();
}

// Terapkan pencarian nama pada data yang sudah difilter
function _applyDataSearch() {
  const searchBerobat = _state.dataSearch.berobat.toLowerCase();
  const searchKecelakaan = _state.dataSearch.kecelakaan.toLowerCase();
  const searchKonsultasi = _state.dataSearch.konsultasi.toLowerCase();

  _searchedBerobat = _filteredBerobat.filter(r => 
    !searchBerobat || (r.Nama || '').toLowerCase().includes(searchBerobat)
  );
  _searchedKecelakaan = _filteredKecelakaan.filter(r => 
    !searchKecelakaan || (r.Nama || '').toLowerCase().includes(searchKecelakaan)
  );
  _searchedKonsultasi = _filteredKonsultasi.filter(r => 
    !searchKonsultasi || (r.Nama || '').toLowerCase().includes(searchKonsultasi)
  );
}

// Handler untuk pencarian di panel Data
function _onDataSearch(type, value) {
  _state.dataSearch[type] = value;
  _applyDataSearch();
  _renderDataSubPanel(type); // Re-render hanya sub-panel yang berubah, bukan seluruh panel Data
}

// Debounce timers untuk pencarian data
const _dataSearchDebounce = {};

// Fungsi global agar bisa dipanggil dari oninput attribute di HTML
function _debounceDataSearch(type, value) {
  clearTimeout(_dataSearchDebounce[type]);
  _dataSearchDebounce[type] = setTimeout(() => {
    app.onDataSearch(type, value);
  }, 300);
}

// Re-render hanya isi tbody dan count untuk satu sub-panel (tanpa mereset input)
function _renderDataSubPanel(type) {
  const title = type.charAt(0).toUpperCase() + type.slice(1);
  const colsMap = {
    berobat:    ['Tanggal','Nama','Departemen','Keluhan','Nama Diagnosa','Tindakan','Perlu Istirahat'],
    kecelakaan: ['Tanggal','Nama','Departemen','Lokasi Kejadian','Penyebab','Bagian Yang Terluka','Tindakan'],
    konsultasi: ['Tanggal','Nama','Departemen','Keluhan','Riwayat Penyakit','Saran'],
  };
  const searchedMap = { berobat: _searchedBerobat, kecelakaan: _searchedKecelakaan, konsultasi: _searchedKonsultasi };
  const rows = searchedMap[type] || [];
  const cols  = colsMap[type];
  const allCols = ['No', ...cols];

  // Update count badge pada tab button
  const countEl = document.querySelector(`.data-subtab-btn[data-subtab="${title}"] .data-tab-count`);
  if (countEl) countEl.textContent = rows.length;

  // Update tbody saja tanpa menyentuh input search
  const subpanel = document.getElementById('data-subpanel-' + title);
  if (!subpanel) return;
  const tbody = subpanel.querySelector('tbody');
  if (!tbody) return;

  tbody.innerHTML = rows.length === 0
    ? `<tr class="empty-row"><td colspan="${allCols.length}" style="text-align:center;padding:40px 0;color:var(--text-tertiary)"><i class="bi bi-inbox me-2"></i>Tidak ada data</td></tr>`
    : rows.map((r, idx) => {
        const hasErr = r._hasEmptyColumns;
        const cls    = hasErr ? 'row-danger' : '';
        const tds = [`<td style="text-align:center;font-weight:500;">${idx + 1}</td>`];
        cols.forEach(c => {
          let val = r[c] || '';
          if (typeof val === 'string') val = val.replace(/\|/g, ', ');
          tds.push(`<td title="${escapeHtml(val)}">${escapeHtml(val)}</td>`);
        });
        return `<tr class="${cls}">${tds.join('')}</tr>`;
      }).join('');
}

function _buildFilterOptions() {
  const depts  = new Set();
  const tahuns = new Set();
  [..._state.rawData.berobat, ..._state.rawData.kecelakaan, ..._state.rawData.konsultasi].forEach(r => {
    if (r.Departemen) depts.add(r.Departemen);
    if (r.tahun > 0)  tahuns.add(String(r.tahun));
  });

  const deptEl  = document.getElementById('filter-dept');
  const tahunEl = document.getElementById('filter-tahun');

  if (deptEl) {
    const currentDept = deptEl.value;
    deptEl.innerHTML = '<option value="">Semua Departemen</option>';
    [...depts].sort().forEach(d => {
      const opt = document.createElement('option');
      opt.value = d; opt.textContent = d;
      if (d === currentDept) opt.selected = true;
      deptEl.appendChild(opt);
    });
  }

  if (tahunEl) {
    const currentTahun = tahunEl.value;
    tahunEl.innerHTML = '<option value="">Semua Tahun</option>';
    [...tahuns].sort().reverse().forEach(y => {
      const opt = document.createElement('option');
      opt.value = y; opt.textContent = y;
      if (y === currentTahun) opt.selected = true;
      tahunEl.appendChild(opt);
    });
  }
}

function _resetFilters(rerender = true) {
  _state.filters = { dept: '', bulan: '', tahun: '' };
  _state.dataSearch = { berobat: '', kecelakaan: '', konsultasi: '' };
  
  const fields = ['filter-dept','filter-bulan','filter-tahun'];
  fields.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  
  if (rerender) {
    _applyFilters();
  }
}

function _updateBadges() {
  const map = {
    Berobat:    _filteredBerobat.length,
    Kecelakaan: _filteredKecelakaan.length,
    Konsultasi: _filteredKonsultasi.length,
  };
  Object.entries(map).forEach(([tab, count]) => {
    const sb = document.getElementById('count-' + tab);
    if (sb) sb.textContent = count;
    const bb = document.getElementById('bnav-count-' + tab);
    if (bb) {
      bb.textContent = count || '';
      bb.style.display = count > 0 ? 'inline-block' : 'none';
    }
  });
}

// ════════════════════════════════════════════════════════
//  TAB NAVIGATION
// ════════════════════════════════════════════════════════
function _setTab(tab) {
  _state.activeTab = tab;

  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.tab === tab);
  });
  document.querySelectorAll('.bnav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.tab === tab);
  });
  document.querySelectorAll('.tab-panel').forEach(el => {
    el.classList.toggle('active', el.id === 'panel-' + tab);
  });

  _renderActiveTab();
}

function _setDataSubTab(subTab) {
  _state.activeDataSubTab = subTab;
  
  document.querySelectorAll('.data-subtab-btn').forEach(el => {
    el.classList.toggle('active', el.dataset.subtab === subTab);
  });
  
  document.querySelectorAll('.data-subpanel').forEach(el => {
    el.classList.toggle('active', el.id === 'data-subpanel-' + subTab);
  });
}

function _renderActiveTab() {
  const tab = _state.activeTab;
  if (tab === 'Berobat')    _renderBerobat();
  else if (tab === 'Kecelakaan') _renderKecelakaan();
  else if (tab === 'Konsultasi') _renderKonsultasi();
  else if (tab === 'Data')       _renderData();
  else if (tab === 'Download')   _renderDownload();
}

// ════════════════════════════════════════════════════════
//  PANEL RENDERERS
// ════════════════════════════════════════════════════════

function _kpiCard(icon, iconClass, label, value) {
  return `<div class="kpi-card">
    <div class="kpi-icon ${iconClass}"><i class="bi bi-${icon}"></i></div>
    <div class="kpi-info">
      <div class="kpi-value">${value}</div>
      <div class="kpi-label">${escapeHtml(label)}</div>
    </div>
  </div>`;
}

// ── BEROBAT ────────────────────────────────────────────
function _renderBerobat() {
  const panel = document.getElementById('panel-Berobat');
  if (!panel) return;
  const data = _filteredBerobat;

  const totalKunjungan = data.length;
  const uniquePasien   = new Set(data.map(r => r.Nama).filter(Boolean)).size;
  const totalIstirahat = data.filter(r => (r['Perlu Istirahat'] || '').toLowerCase().includes('ya')).length;
  const totalHariIst   = data.reduce((s, r) => s + (parseInt(r['Jumlah Hari Istirahat']) || 0), 0);

  panel.innerHTML = `
    <div class="kpi-grid">
      ${_kpiCard('clipboard2-pulse', 'teal',   'Total Kunjungan',     totalKunjungan)}
      ${_kpiCard('people',           'blue',   'Pasien Unik',         uniquePasien)}
      ${_kpiCard('bandaid',          'yellow', 'Kasus Istirahat',     totalIstirahat)}
      ${_kpiCard('calendar-check',   'green',  'Total Hari Istirahat',totalHariIst)}
    </div>
    <div id="charts-berobat"></div>
  `;

  if (typeof createBerobatCharts === 'function') {
    // Gunakan _filteredDDiagnosa dan _filteredDObat yang sudah difilter
    const dataDiagnosa = _filteredDDiagnosa;
    const dataObat     = _filteredDObat;
    createBerobatCharts(data, 'charts-berobat', dataDiagnosa, dataObat);
  }
}

// ── KECELAKAAN ─────────────────────────────────────────
function _renderKecelakaan() {
  const panel = document.getElementById('panel-Kecelakaan');
  if (!panel) return;
  const data = _filteredKecelakaan;

  const total    = data.length;
  const uniqueP  = new Set(data.map(r => r.Nama).filter(Boolean)).size;
  const depts    = new Set(data.map(r => r.Departemen).filter(Boolean)).size;
  const lokasis  = new Set(data.map(r => r['Lokasi Kejadian']).filter(Boolean)).size;

  panel.innerHTML = `
    <div class="kpi-grid">
      ${_kpiCard('exclamation-triangle', 'red',    'Total Kecelakaan',   total)}
      ${_kpiCard('people',              'blue',   'Karyawan Terdampak',  uniqueP)}
      ${_kpiCard('building',            'yellow', 'Departemen Terdampak',depts)}
      ${_kpiCard('geo-alt',             'green',  'Lokasi Berbeda',      lokasis)}
    </div>
    <div id="charts-kecelakaan"></div>
  `;

  if (typeof createKecelakaanCharts === 'function') {
    createKecelakaanCharts(data, 'charts-kecelakaan');
  }
}

// ── KONSULTASI ─────────────────────────────────────────
function _renderKonsultasi() {
  const panel = document.getElementById('panel-Konsultasi');
  if (!panel) return;
  const data = _filteredKonsultasi;

  const total   = data.length;
  const uniqueP = new Set(data.map(r => r.Nama).filter(Boolean)).size;
  const depts   = new Set(data.map(r => r.Departemen).filter(Boolean)).size;

  panel.innerHTML = `
    <div class="kpi-grid">
      ${_kpiCard('chat-dots',  'teal',  'Total Konsultasi',   total)}
      ${_kpiCard('people',     'blue',  'Pasien Unik',         uniqueP)}
      ${_kpiCard('building',   'yellow','Departemen',          depts)}
    </div>
    <div id="charts-konsultasi"></div>
  `;

  if (typeof createKonsultasiCharts === 'function') {
    createKonsultasiCharts(data, 'charts-konsultasi');
  }
}

// ── DATA TABLE (dengan search per sub-tab dan nomor urut) ──
function _renderData() {
  const panel = document.getElementById('panel-Data');
  if (!panel) return;

  const currentSubTab = _state.activeDataSubTab;

  panel.innerHTML = `
    <div class="data-tabs-container">
      <div class="data-tabs-header">
        <button class="data-subtab-btn ${currentSubTab === 'Berobat' ? 'active' : ''}" data-subtab="Berobat" onclick="app.setDataSubTab('Berobat')">
          <i class="bi bi-clipboard2-pulse"></i>
          <span>Berobat</span>
          <span class="data-tab-count">${_searchedBerobat.length}</span>
        </button>
        <button class="data-subtab-btn ${currentSubTab === 'Kecelakaan' ? 'active' : ''}" data-subtab="Kecelakaan" onclick="app.setDataSubTab('Kecelakaan')">
          <i class="bi bi-exclamation-triangle"></i>
          <span>Kecelakaan</span>
          <span class="data-tab-count">${_searchedKecelakaan.length}</span>
        </button>
        <button class="data-subtab-btn ${currentSubTab === 'Konsultasi' ? 'active' : ''}" data-subtab="Konsultasi" onclick="app.setDataSubTab('Konsultasi')">
          <i class="bi bi-chat-dots"></i>
          <span>Konsultasi</span>
          <span class="data-tab-count">${_searchedKonsultasi.length}</span>
        </button>
        
        <!-- Tombol Export Excel -->
        <button class="data-export-btn" onclick="app.exportDataToExcel()" title="Export data ke Excel">
          <i class="bi bi-file-earmark-excel"></i>
          <span>Export Excel</span>
        </button>
      </div>
      
      <div class="data-tabs-content">
        <div id="data-subpanel-Berobat" class="data-subpanel ${currentSubTab === 'Berobat' ? 'active' : ''}">
          ${_buildDataTableWithSearch('Berobat', _searchedBerobat, 'teal', ['Tanggal','Nama','Departemen','Keluhan','Nama Diagnosa','Tindakan','Perlu Istirahat'])}
        </div>
        <div id="data-subpanel-Kecelakaan" class="data-subpanel ${currentSubTab === 'Kecelakaan' ? 'active' : ''}">
          ${_buildDataTableWithSearch('Kecelakaan', _searchedKecelakaan, 'red', ['Tanggal','Nama','Departemen','Lokasi Kejadian','Penyebab','Bagian Yang Terluka','Tindakan'])}
        </div>
        <div id="data-subpanel-Konsultasi" class="data-subpanel ${currentSubTab === 'Konsultasi' ? 'active' : ''}">
          ${_buildDataTableWithSearch('Konsultasi', _searchedKonsultasi, 'green', ['Tanggal','Nama','Departemen','Keluhan','Riwayat Penyakit','Saran'])}
        </div>
      </div>
    </div>
  `;
}

function _buildDataTableWithSearch(title, rows, colorClass, cols) {
  const typeKey = title.toLowerCase();
  const currentSearch = _state.dataSearch[typeKey] || '';
  const icon = title === 'Berobat' ? 'clipboard2-pulse' : title === 'Kecelakaan' ? 'exclamation-triangle' : 'chat-dots';
  
  // Tambahkan kolom "No" di awal
  const allCols = ['No', ...cols];
  const ths  = allCols.map(c => `<th>${escapeHtml(c)}</th>`).join('');
  
  const trs  = rows.length === 0
    ? `<tr class="empty-row"><td colspan="${allCols.length}" style="text-align:center;padding:40px 0;color:var(--text-tertiary)"><i class="bi bi-inbox me-2"></i>Tidak ada data</td></tr>`
    : rows.map((r, idx) => {
        const hasErr = r._hasEmptyColumns;
        const cls    = hasErr ? 'row-danger' : '';
        // Nomor urut mulai dari 1
        const tds = [`<td style="text-align:center;font-weight:500;">${idx + 1}</td>`];
        cols.forEach(c => {
          let val = r[c] || '';
          if (typeof val === 'string') val = val.replace(/\|/g, ', ');
          tds.push(`<td title="${escapeHtml(val)}">${escapeHtml(val)}</td>`);
        });
        return `<tr class="${cls}">${tds.join('')}</tr>`;
      }).join('');

  return `
    <div class="table-section">
      <div class="table-section-head">
        <div class="table-section-title ${colorClass}">
          <i class="bi bi-${icon}"></i> ${title}
        </div>
        <div class="table-section-meta">${rows.length} data</div>
      </div>
      <!-- Search bar di dalam panel Data -->
      <div style="padding: 12px 16px; border-bottom: 1px solid var(--border-light);">
        <div style="position: relative; max-width: 300px;">
          <i class="bi bi-search" style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--text-tertiary); font-size: 14px;"></i>
          <input type="text"
                 id="data-search-${typeKey}"
                 placeholder="Cari Nama..."
                 value="${escapeHtml(currentSearch)}"
                 style="width: 100%; padding: 8px 12px 8px 36px; border: 1px solid var(--border-light); border-radius: var(--radius); font-size: 13px; outline: none;"
                 autocomplete="off"
                 oninput="_debounceDataSearch('${typeKey}', this.value)">
        </div>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr>${ths}</tr></thead>
          <tbody>${trs}</tbody>
        </table>
      </div>
    </div>
  `;
}

// ── DOWNLOAD ───────────────────────────────────────────
function _renderDownload() {
  const panel = document.getElementById('panel-Download');
  if (!panel) return;

  if (typeof downloadReport === 'undefined') {
    panel.innerHTML = `<div style="padding:48px;text-align:center;color:var(--text-tertiary)"><i class="bi bi-file-earmark-pdf" style="font-size:32px"></i><p style="margin-top:12px">Modul download tidak tersedia.</p></div>`;
    return;
  }

  // Gunakan data yang sudah difilter
  const dataDiagnosa = _filteredDDiagnosa;
  const dataObat     = _filteredDObat;
  const allData      = [
    ..._filteredBerobat.map(r    => ({ ...r, _type: 'Berobat' })),
    ..._filteredKecelakaan.map(r => ({ ...r, _type: 'Kecelakaan' })),
    ..._filteredKonsultasi.map(r => ({ ...r, _type: 'Konsultasi' })),
  ];

  panel.innerHTML = `<div id="download-report-content"></div>`;
  const content = document.getElementById('download-report-content');
  if (content) {
    content.innerHTML = downloadReport.generateReport(allData, dataDiagnosa, dataObat);
  }
}

// ════════════════════════════════════════════════════════
//  UTILS
// ════════════════════════════════════════════════════════

function _expandField(rows, field) {
  const result = [];
  rows.forEach(r => {
    const raw = (r[field] || '').trim();
    if (!raw || raw === '-') return;
    const values = raw.split('|').map(v => v.trim()).filter(v => v && v !== '-');
    values.forEach(val => result.push({ ...r, [field]: val }));
  });
  return result;
}

// ════════════════════════════════════════════════════════
//  TOAST
// ════════════════════════════════════════════════════════
function _showToast(msg, type = 'info') {
  const toast = document.getElementById('toast');
  if (!toast) return;

  const colorMap = { success: 'var(--green)', error: 'var(--red)', warning: 'var(--yellow)', info: 'var(--navy)' };
  toast.textContent = msg;
  toast.style.borderLeftColor = colorMap[type] || 'var(--navy)';
  toast.classList.remove('hidden');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.add('hidden'), 3500);
}

// ════════════════════════════════════════════════════════
//  PASSWORD TOGGLE
// ════════════════════════════════════════════════════════
function togglePassword() {
  const input  = document.getElementById('company-password');
  const eyeIcon = document.getElementById('pw-eye');
  if (!input) return;
  if (input.type === 'password') {
    input.type = 'text';
    if (eyeIcon) { eyeIcon.classList.remove('bi-eye'); eyeIcon.classList.add('bi-eye-slash'); }
  } else {
    input.type = 'password';
    if (eyeIcon) { eyeIcon.classList.remove('bi-eye-slash'); eyeIcon.classList.add('bi-eye'); }
  }
}