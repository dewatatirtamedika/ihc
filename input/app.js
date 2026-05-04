// ════════════════════════════════════════════════════════
//  VIEWPORT HEIGHT FIX (Mobile Browser Address Bar)
// ════════════════════════════════════════════════════════
function setVHVariable() {
  const vh = window.innerHeight * 0.01;
  document.documentElement.style.setProperty('--vh', `${vh}px`);
}

// Set initial value
setVHVariable();

// Update on resize and orientation change
window.addEventListener('resize', setVHVariable);
window.addEventListener('orientationchange', setVHVariable);

// ════════════════════════════════════════════════════════
//  CONFIGURATION & STATE
// ════════════════════════════════════════════════════════
const GAS_URL  = 'https://script.google.com/macros/s/AKfycbxLD0ItE6aHtnnHtIZUfpIkRynaSL34o_gnOI1144iGe1r0EUiQ4G2sF7IcvPMlKZ1mHA/exec';
const PER_PAGE = 7;

// Data types
const DATA_TYPES = {
  BEROBAT: 'berobat',
  KECELAKAAN: 'kecelakaan',
  KONSULTASI: 'konsultasi'
};

// Sheet mapping
const SHEET_MAP = {
  berobat: 'Berobat',
  kecelakaan: 'Kecelakaan',
  konsultasi: 'Konsultasi'
};

// Form IDs
const FORM_FIELDS = {
  berobat: {
    main: ['b-tanggal', 'b-waktu', 'b-departemen', 'b-nama', 'b-jk', 'b-keluhan'],
    form: ['b-nama','b-keluhan','b-tindakan','b-keterangan'],
    extras: ['b-jk','b-istirahat','b-hari-istirahat','b-kat-diagnosa','b-kat-obat']
  },
  kecelakaan: {
    main: ['k-tanggal','k-waktu','k-departemen','k-nama','k-jk','k-lokasi','k-penyebab','k-bagian-terluka','k-tindakan','k-deskripsi'],
    form: ['k-nama','k-lokasi','k-penyebab','k-bagian-terluka','k-tindakan','k-deskripsi']
  },
  konsultasi: {
    main: ['ko-tanggal','ko-waktu','ko-departemen','ko-nama','ko-jk','ko-keluhan'],
    form: ['ko-nama','ko-keluhan','ko-riwayat','ko-saran']
  }
};

const BULAN = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];

const state = {
  master: null,
  company: '',
  data: {
    berobat:    { rows: [], total: 0, page: 1, totalPages: 1 },
    kecelakaan: { rows: [], total: 0, page: 1, totalPages: 1 },
    konsultasi: { rows: [], total: 0, page: 1, totalPages: 1 },
  },
  filters: {
    berobat:    { search: '', tahun: '', bulan: '', date: '', dept: '' },
    kecelakaan: { search: '', tahun: '', bulan: '', date: '', dept: '' },
    konsultasi: { search: '', tahun: '', bulan: '', date: '', dept: '' },
  },
  editMode:       { sheet: null, rowIndex: null },
  obatList:       [],
  diagnosaList:   [],
  debounceTimers: {},
  detailRecord:   null,
  modalInstances: {},
  incompleteData: { berobat: [], kecelakaan: [], konsultasi: [] },
  notificationTab: 'berobat'
};

// Bootstrap Modal helpers
function getModal(id) {
  if (!state.modalInstances[id]) {
    const el = document.getElementById(id);
    if (el) state.modalInstances[id] = new bootstrap.Modal(el);
  }
  return state.modalInstances[id];
}

function openModal(id) { getModal(id)?.show(); }
function closeModal(id) { getModal(id)?.hide(); }

// ════════════════════════════════════════════════════════
//  FORMAT HELPERS
// ════════════════════════════════════════════════════════
function dateToInput(str) {
  if (!str) return '';
  const p = str.split('/');
  if (p.length === 3) return `${p[2]}-${p[1].padStart(2,'0')}-${p[0].padStart(2,'0')}`;
  return str;
}

function inputToDate(str) {
  if (!str) return '';
  const p = str.split('-');
  if (p.length === 3) return `${p[2]}/${p[1]}/${p[0]}`;
  return str;
}

function todayStr() { return new Date().toISOString().split('T')[0]; }
function nowTime()  { return new Date().toTimeString().slice(0, 5); }

function esc(str) {
  return String(str ?? '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function toggleIstirahat() {
  const v = document.getElementById('b-istirahat')?.value;
  const wrap = document.getElementById('wrap-hari-istirahat');
  if (wrap) wrap.style.display = v === 'Ya' ? 'block' : 'none';
}

// ════════════════════════════════════════════════════════
//  API REQUEST
// ════════════════════════════════════════════════════════
async function gasRequest(action, payload = {}) {
  const params = new URLSearchParams({ action });
  if (Object.keys(payload).length) params.set('payload', JSON.stringify(payload));
  const res = await fetch(GAS_URL + '?' + params.toString());
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}

// ════════════════════════════════════════════════════════
//  INIT
// ════════════════════════════════════════════════════════
window.addEventListener('DOMContentLoaded', async () => {
  // Set VH variable again after DOM load
  setVHVariable();
  
  if (GAS_URL.includes('GANTI')) {
    hideLoading();
    toast('warning', 'Konfigurasi', 'Ganti GAS_URL dengan URL deployment Google Apps Script Anda.');
    openModal('modalPerusahaan');
    return;
  }
  try {
    const res = await gasRequest('getMasterData');
    if (res.status !== 'success') throw new Error(res.message);
    state.master = res.data;
    populateMasterDropdowns();
    hideLoading();
    const saved = sessionStorage.getItem('selectedCompany');
    if (saved && state.master.perusahaan.includes(saved)) {
      applyCompany(saved);
    } else {
      openModal('modalPerusahaan');
    }
  } catch (e) {
    hideLoading();
    toast('error', 'Gagal Memuat', 'Tidak dapat terhubung ke server: ' + e.message);
    openModal('modalPerusahaan');
  }
});

function hideLoading() {
  document.getElementById('loading-overlay')?.classList.add('d-none');
}

function populateMasterDropdowns() {
  if (!state.master) return;
  
  // Populate company selector
  populateDropdown('select-perusahaan', '<option value="">-- Pilih Perusahaan --</option>', 
    state.master.perusahaan, p => p, p => p);
  
  // Populate diagnosa category
  populateDropdown('b-kat-diagnosa', '<option value="">-- Pilih Kategori --</option>',
    Object.keys(state.master.diagnosa), k => k, k => k);
  
  // Populate obat category
  populateDropdown('b-kat-obat', '<option value="">-- Pilih Kategori --</option>',
    Object.keys(state.master.obat), k => k, k => k);
}

// Helper: Generic dropdown population (DRY principle)
function populateDropdown(elementId, firstOption, data, valueFn, labelFn) {
  const el = document.getElementById(elementId);
  if (!el) return;
  el.innerHTML = firstOption;
  data.forEach(v => el.insertAdjacentHTML('beforeend',
    `<option value="${esc(String(valueFn(v)))}">${esc(String(labelFn(v)))}</option>`));
}

function filterNamaDiagnosa() {
  const kat = document.getElementById('b-kat-diagnosa')?.value;
  const data = kat && state.master?.diagnosa[kat] ? state.master.diagnosa[kat] : [];
  populateDropdown('b-nama-diagnosa', '<option value="">-- Pilih Nama --</option>', data, n => n, n => n);
}

function filterNamaObat() {
  const kat = document.getElementById('b-kat-obat')?.value;
  const data = kat && state.master?.obat[kat] ? state.master.obat[kat] : [];
  populateDropdown('b-nama-obat', '<option value="">-- Pilih Nama --</option>', data, n => n, n => n);
}

function fillDepartemenDropdown(selectId) {
  const sel = document.getElementById(selectId);
  if (!sel) return;
  sel.innerHTML = '<option value="">-- Pilih Departemen --</option>';
  if (!state.company || !state.master) return;
  (state.master.departemen[state.company] || []).forEach(d =>
    sel.insertAdjacentHTML('beforeend', `<option value="${esc(d)}">${esc(d)}</option>`)
  );
}

// ════════════════════════════════════════════════════════
//  COMPANY SELECTION
// ════════════════════════════════════════════════════════
function openCompanyModal() {
  const sel = document.getElementById('select-perusahaan');
  if (state.company && sel) sel.value = state.company;
  openModal('modalPerusahaan');
}

function saveCompany() {
  const val = document.getElementById('select-perusahaan')?.value;
  if (!val) { toast('warning', 'Perhatian', 'Pilih perusahaan terlebih dahulu.'); return; }
  applyCompany(val);
  closeModal('modalPerusahaan');
}

function applyCompany(company) {
  state.company = company;
  sessionStorage.setItem('selectedCompany', company);
  
  document.querySelectorAll('[id$="-company-name"]').forEach(el => el.textContent = company);
  
  toast('success', 'Perusahaan Dipilih', company);
  
  // Reset all filters and reload data
  Object.values(DATA_TYPES).forEach(type => {
    state.filters[type] = { search: '', tahun: '', bulan: '', date: '', dept: '' };
    const searchEl = document.getElementById(`search-${type}`);
    if (searchEl) searchEl.value = '';
    const tahunEl = document.getElementById(`filter-tahun-${type}`);
    if (tahunEl) tahunEl.value = '';
    const bulanEl = document.getElementById(`filter-bulan-${type}`);
    if (bulanEl) bulanEl.value = '';
    const dateEl = document.getElementById(`filter-date-${type}`);
    if (dateEl) dateEl.value = '';
    const deptEl = document.getElementById(`filter-dept-${type}`);
    if (deptEl) deptEl.value = '';
  });
  
  // Reload all data
  loadData(DATA_TYPES.BEROBAT, 1);
  loadData(DATA_TYPES.KECELAKAAN, 1);
  loadData(DATA_TYPES.KONSULTASI, 1);
  
  // Load incomplete data for notifications
  loadIncompleteData();
}

// ════════════════════════════════════════════════════════
//  INCOMPLETE DATA (NOTIFICATION) FUNCTIONS
// ════════════════════════════════════════════════════════
async function loadIncompleteData() {
  if (!state.company) return;
  
  try {
    const res = await gasRequest('getIncompleteData', { perusahaan: state.company });
    if (res.status !== 'success') throw new Error(res.message);
    
    state.incompleteData = res.data;
    updateNotificationBadges();
  } catch (e) {
    console.error('Failed to load incomplete data:', e);
  }
}

function updateNotificationBadges() {
  const total = (state.incompleteData.berobat?.length || 0) + 
                (state.incompleteData.kecelakaan?.length || 0) + 
                (state.incompleteData.konsultasi?.length || 0);
  
  // Update sidebar notification button
  const sidebarCount = document.getElementById('sidebar-notification-count');
  if (sidebarCount) {
    sidebarCount.textContent = total;
    sidebarCount.style.display = total > 0 ? 'inline-block' : 'none';
  }
  
  // Update topbar notification button (mobile)
  const topbarCount = document.getElementById('topbar-notification-count');
  if (topbarCount) {
    topbarCount.textContent = total;
    topbarCount.style.display = total > 0 ? 'inline-block' : 'none';
  }
  
  // Update tab badges
  ['berobat', 'kecelakaan', 'konsultasi'].forEach(type => {
    const badge = document.getElementById(`notification-badge-${type}`);
    if (badge) {
      const count = state.incompleteData[type]?.length || 0;
      badge.textContent = count;
      badge.style.display = count > 0 ? 'inline-block' : 'none';
    }
  });
}

function openNotificationModal() {
  if (!state.company) {
    toast('warning', 'Perhatian', 'Pilih perusahaan terlebih dahulu.');
    openCompanyModal();
    return;
  }
  
  // Refresh incomplete data
  loadIncompleteData().then(() => {
    renderNotificationContent('berobat');
    openModal('modalNotification');
  });
}

function switchNotificationTab(type) {
  state.notificationTab = type;
  
  // Update tab active states
  document.querySelectorAll('.notification-tab').forEach(tab => {
    tab.classList.remove('active');
  });
  document.querySelector(`.notification-tab[data-type="${type}"]`)?.classList.add('active');
  
  renderNotificationContent(type);
}

function renderNotificationContent(type) {
  const container = document.getElementById('notification-content');
  if (!container) return;
  
  const items = state.incompleteData[type] || [];
  
  if (items.length === 0) {
    container.innerHTML = `
      <div class="notification-empty">
        <i class="bi bi-check-circle-fill"></i>
        <p>Tidak ada data yang perlu diperbaiki untuk kategori ini.</p>
        <small class="text-muted">Semua data sudah lengkap.</small>
      </div>
    `;
    return;
  }
  
  let html = '';
  items.forEach(item => {
    const emptyCols = item._emptyColumns || [];
    const typeLabel = type === 'berobat' ? 'Berobat' : type === 'kecelakaan' ? 'Kecelakaan' : 'Konsultasi';
    
    html += `
      <div class="notification-item" onclick="fixIncompleteData('${type}', ${item._rowIndex})">
        <div class="notification-icon">
          <i class="bi bi-exclamation-triangle-fill"></i>
        </div>
        <div class="notification-content">
          <div class="notification-title">${esc(item['Nama'] || '-')}</div>
          <div class="notification-desc">
            ${esc(formatDateDisplay(item['Tanggal']))} · ${esc(item['Departemen'] || '-')}<br>
            <span class="text-danger">Kolom kosong: ${esc(emptyCols.join(', '))}</span>
          </div>
        </div>
        <div class="notification-badge">
          ${emptyCols.length} kolom
        </div>
        <button class="btn-icon-sm btn-fix ms-2" onclick="event.stopPropagation(); fixIncompleteData('${type}', ${item._rowIndex})" title="Perbaiki Data">
          <i class="bi bi-pencil-square"></i>
        </button>
      </div>
    `;
  });
  
  container.innerHTML = html;
}

function fixIncompleteData(type, rowIndex) {
  closeModal('modalNotification');
  
  // Switch to the correct page
  showPage(type);
  
  // Open edit modal for the specific row
  setTimeout(() => {
    openEditModal(type, rowIndex);
  }, 200);
}

// ════════════════════════════════════════════════════════
//  NAVIGATION
// ════════════════════════════════════════════════════════
function showPage(name) {
  document.querySelectorAll('.page-section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('[data-page]').forEach(el => el.classList.remove('active'));
  
  document.getElementById('page-' + name)?.classList.add('active');
  document.querySelectorAll(`[data-page="${name}"]`).forEach(el => el.classList.add('active'));

  // Toggle sidebar filter groups
  Object.values(DATA_TYPES).forEach(p => {
    const fg = document.getElementById('sidebar-filters-' + p);
    if (fg) fg.classList.toggle('d-none', p !== name);
  });
}

// ════════════════════════════════════════════════════════
//  DATA LOADING
// ════════════════════════════════════════════════════════
async function loadData(type, page) {
  if (GAS_URL.includes('GANTI')) return;
  if (page !== undefined) state.data[type].page = page;
  renderSkeleton(type);
  const f = state.filters[type];
  try {
    const res = await gasRequest('getData', {
      sheet      : SHEET_MAP[type],
      perusahaan : state.company,
      search     : f.search,
      tahun      : f.tahun,
      bulan      : f.bulan,
      date       : f.date,
      dept       : f.dept,
      page       : state.data[type].page,
      perPage    : PER_PAGE,
    });
    if (res.status !== 'success') throw new Error(res.message);
    state.data[type].rows       = res.data || [];
    state.data[type].total      = res.total || 0;
    state.data[type].page       = res.page  || 1;
    state.data[type].totalPages = res.totalPages || 1;
    updateBadges(type, res.total);
    populateFilterOptions(type, res.filterOptions || {});
    renderTable(type);
    
    // Refresh incomplete data after loading
    loadIncompleteData();
  } catch (e) {
    const tbody = document.getElementById('tbody-' + type);
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><i class="bi bi-wifi-off"></i><p>Gagal memuat: ${esc(e.message)}</p></div></td></tr>`;
    }
    toast('error', 'Gagal Memuat', e.message);
  }
}

function updateBadges(type, n) {
  ['badge', 'sidebar-badge', 'bnav-badge'].forEach(prefix => {
    const el = document.getElementById(`${prefix}-${type}`);
    if (el) { el.textContent = n || 0; el.style.display = n ? 'inline-block' : 'none'; }
  });
}

function populateFilterOptions(type, options) {
  const fill = (id, arr, valFn, labelFn) => {
    const el = document.getElementById(id);
    if (!el) return;
    const first = el.querySelector('option:first-child')?.outerHTML || '<option value="">Semua</option>';
    el.innerHTML = first;
    arr.forEach(v => el.insertAdjacentHTML('beforeend', 
      `<option value="${esc(String(valFn(v)))}">${esc(String(labelFn(v)))}</option>`));
  };
  if (options.tahun) fill(`filter-tahun-${type}`, options.tahun, v=>v, v=>v);
  if (options.bulan) fill(`filter-bulan-${type}`, options.bulan, v=>v, v=>BULAN[parseInt(v)-1]||v);
  if (options.dept) fill(`filter-dept-${type}`, options.dept, v=>v, v=>v);
}

function debounceSearch(type) {
  clearTimeout(state.debounceTimers[type]);
  state.debounceTimers[type] = setTimeout(() => {
    state.filters[type].search = document.getElementById(`search-${type}`)?.value.trim() || '';
    loadData(type, 1);
  }, 350);
}

function applyFilter(type) {
  state.filters[type].tahun = document.getElementById(`filter-tahun-${type}`)?.value || '';
  state.filters[type].bulan = document.getElementById(`filter-bulan-${type}`)?.value || '';
  state.filters[type].date  = document.getElementById(`filter-date-${type}`)?.value || '';
  state.filters[type].dept  = document.getElementById(`filter-dept-${type}`)?.value  || '';
  loadData(type, 1);
}

// ════════════════════════════════════════════════════════
//  TABLE RENDERING
// ════════════════════════════════════════════════════════
function renderTable(type) {
  const { rows, total, page, totalPages } = state.data[type];
  const start = (page - 1) * PER_PAGE;
  const tbody = document.getElementById('tbody-' + type);
  if (!tbody) return;
  
  tbody.innerHTML = rows.length
    ? rows.map((r, i) => buildRow(type, r, start + i + 1)).join('')
    : `<tr><td colspan="7"><div class="empty-state"><i class="bi bi-inbox"></i><p>Tidak ada data ditemukan</p></div></td></tr>`;
  
  const info = document.getElementById('info-' + type);
  if (info) {
    info.textContent = total
      ? `Menampilkan ${start + 1}–${Math.min(start + PER_PAGE, total)} dari ${total} data`
      : 'Tidak ada data';
  }
  
  renderPagination(type, page, totalPages);
}

function renderSkeleton(type) {
  const tbody = document.getElementById('tbody-' + type);
  if (!tbody) return;
  tbody.innerHTML = Array(5).fill(
    '<tr>' + Array(7).fill('<td><div class="skeleton"></div></td>').join('') + '</tr>'
  ).join('');
}

function formatDateDisplay(val) {
  if (!val) return '';
  const s = String(val).trim();
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) return s;
  if (s.startsWith('Sat') || s.startsWith('Sun') || s.startsWith('Mon') || s.startsWith('Tue') || s.startsWith('Wed') || s.startsWith('Thu') || s.startsWith('Fri')) {
    try {
      const d = new Date(s);
      if (!isNaN(d.getTime())) {
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const yyyy = d.getFullYear();
        if (yyyy >= 1900) return `${dd}/${mm}/${yyyy}`;
      }
    } catch (e) { }
  }
  return s;
}

function buildRow(type, r, no) {
  const idx = r._rowIndex;
  const hasError = r._hasEmptyColumns || false;
  const emptyColumns = r._emptyColumns || [];
  const errorTitle = hasError ? `Kolom kosong: ${emptyColumns.join(', ')}` : '';
  
  let row = `<tr class="${hasError ? 'row-error' : ''}" title="${esc(errorTitle)}">
    <td>${no}</td>
    <td><strong>${esc(r['Nama'] || '')}</strong>${hasError ? ' <i class="bi bi-exclamation-circle-fill text-danger ms-1" title="Ada data yang kosong"></i>' : ''}</td>
    <td>${esc(formatDateDisplay(r['Tanggal']))}</td>
    <td>${esc(r['Departemen'] || '')}</td>`;
  
  if (type === 'berobat') {
    row += `<td>${esc(r['Keluhan'] || '')}</td>
    <td>${esc((r['Nama Diagnosa'] || '').replace(/\|/g, ', '))}</td>`;
  } else if (type === 'kecelakaan') {
    row += `<td>${esc(r['Lokasi Kejadian'] || '')}</td>
    <td>${esc(r['Penyebab'] || '')}</td>`;
  } else if (type === 'konsultasi') {
    row += `<td>${esc(r['Keluhan'] || '')}</td>
    <td>${esc(r['Riwayat Penyakit'] || '')}</td>`;
  }
  
  row += `<td><div class="action-btns">
    <button class="btn-icon-sm btn-detail" onclick="openDetailModal('${type}',${idx})" title="${hasError ? 'Lihat detail & perbaiki' : 'Detail'}" style="${hasError ? 'background: #fecaca !important; color: var(--red) !important;' : ''}"><i class="bi bi-${hasError ? 'exclamation' : 'eye'}"></i></button>
    <button class="btn-icon-sm btn-edit" onclick="openEditModal('${type}',${idx})" title="Edit"><i class="bi bi-pencil"></i></button>
    <button class="btn-icon-sm btn-delete" onclick="confirmDelete('${type}',${idx})" title="Hapus"><i class="bi bi-trash3"></i></button>
  </div></td>
  </tr>`;
  
  return row;
}

function renderPagination(type, page, totalPages) {
  const wrap = document.getElementById('pages-' + type);
  if (!wrap) return;
  if (totalPages <= 1) { wrap.innerHTML = ''; return; }
  
  let html = `<button class="page-btn" ${page===1?'disabled':''} onclick="gotoPage('${type}',${page-1})"><i class="bi bi-chevron-left"></i></button>`;
  paginationRange(page, totalPages).forEach(p => {
    if (p === '...') html += `<span class="page-btn disabled">…</span>`;
    else html += `<button class="page-btn ${p===page?'active':''}" onclick="gotoPage('${type}',${p})">${p}</button>`;
  });
  html += `<button class="page-btn" ${page===totalPages?'disabled':''} onclick="gotoPage('${type}',${page+1})"><i class="bi bi-chevron-right"></i></button>`;
  wrap.innerHTML = html;
}

function paginationRange(c, t) {
  if (t <= 7) return Array.from({length:t}, (_,i)=>i+1);
  if (c <= 4) return [1,2,3,4,5,'...',t];
  if (c >= t-3) return [1,'...',t-4,t-3,t-2,t-1,t];
  return [1,'...',c-1,c,c+1,'...',t];
}

function gotoPage(type, page) { loadData(type, page); }

// ════════════════════════════════════════════════════════
//  DETAIL MODAL
// ════════════════════════════════════════════════════════
function openDetailModal(type, rowIndex) {
  const record = state.data[type].rows.find(r => r._rowIndex === rowIndex);
  if (!record) return toast('error','Error','Data tidak ditemukan.');
  state.detailRecord = { type, rowIndex, data: record };
  
  const hasError = record._hasEmptyColumns;
  const emptyColumns = record._emptyColumns || [];
  
  document.getElementById('detail-modal-title').innerHTML = 
    `<i class="bi bi-${type==='berobat'?'clipboard2-pulse':type==='kecelakaan'?'exclamation-triangle':'chat-dots'} me-2"></i>Detail Data${hasError ? ' <span class="badge bg-danger ms-2">Ada data kosong</span>' : ''}`;
  
  const body = document.getElementById('detail-modal-body');
  
  // Tampilkan warning jika ada sel kosong
  let warningHtml = '';
  if (hasError) {
    warningHtml = `
      <div class="alert alert-danger alert-dismissible fade show mb-3" role="alert">
        <i class="bi bi-exclamation-triangle-fill me-2"></i>
        <strong>Data Tidak Lengkap!</strong><br>
        Kolom berikut masih kosong dan harus diisi: <strong>${esc(emptyColumns.join(', '))}</strong>
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
      </div>
    `;
  }
  
  const fields = [
    ['ID', record['ID']], ['Timestamp', record['Timestamp']], ['Tanggal', formatDateDisplay(record['Tanggal'])],
    ['Waktu', record['Waktu']], ['Perusahaan', record['Perusahaan']], ['Departemen', record['Departemen']],
    ['Nama', record['Nama']], ['Jenis Kelamin', record['Jenis Kelamin']]
  ];
  
  if (type === 'berobat') {
    fields.push(
      ['Keluhan', record['Keluhan']], 
      ['Kategori Diagnosa', (record['Kategori Diagnosa']||'').replace(/\|/g, ', ')],
      ['Nama Diagnosa', (record['Nama Diagnosa']||'').replace(/\|/g, ', ')], 
      ['Kategori Obat', (record['Kategori Obat']||'').replace(/\|/g, ', ')],
      ['Nama Obat', (record['Nama Obat']||'').replace(/\|/g, ', ')], 
      ['Jumlah Obat', (record['Jumlah Obat']||'').replace(/\|/g, ', ')],
      ['Satuan Obat', (record['Satuan Obat']||'').replace(/\|/g, ', ')], 
      ['Tindakan', record['Tindakan']],
      ['Perlu Istirahat', record['Perlu Istirahat']], 
      ['Jumlah Hari Istirahat', record['Jumlah Hari Istirahat']],
      ['Keterangan Berobat', record['Keterangan Berobat']]
    );
  } else if (type === 'kecelakaan') {
    fields.push(
      ['Lokasi Kejadian', record['Lokasi Kejadian']], 
      ['Penyebab', record['Penyebab']],
      ['Bagian Yang Terluka', record['Bagian Yang Terluka']], 
      ['Tindakan', record['Tindakan']],
      ['Deskripsi Kejadian', record['Deskripsi Kejadian']]
    );
  } else {
    fields.push(
      ['Keluhan', record['Keluhan']], 
      ['Riwayat Penyakit', record['Riwayat Penyakit']], 
      ['Saran', record['Saran']]
    );
  }
  
  const fieldsHtml = fields.map(([l, v]) => {
    const isEmpty = !v || v === '-';
    const isRequired = emptyColumns.includes(l);
    const style = (isEmpty && isRequired) ? 'background: #fee2e2; border-left: 4px solid var(--red);' : '';
    return `
    <div class="detail-row" style="${style}">
      <div class="detail-label">${esc(l)}${(isEmpty && isRequired) ? ' <i class="bi bi-exclamation-circle-fill text-danger ms-1"></i>' : ''}</div>
      <div class="detail-value">${esc(v||'-')}</div>
    </div>
  `;
  }).join('');
  
  body.innerHTML = warningHtml + fieldsHtml;
  
  openModal('modalDetail');
}

function editFromDetail() {
  if (!state.detailRecord) return toast('error', 'Error', 'Data tidak ditemukan.');
  closeModal('modalDetail');
  openEditModal(state.detailRecord.type, state.detailRecord.rowIndex);
}

// ════════════════════════════════════════════════════════
//  FORM MODALS
// ════════════════════════════════════════════════════════
function openAddModal(type) {
  if (!state.company) { toast('warning','Perhatian','Pilih perusahaan dahulu.'); openCompanyModal(); return; }
  state.editMode = { sheet: null, rowIndex: null };
  state.obatList = []; state.diagnosaList = [];
  
  if (type === 'berobat') {
    resetBerobatForm();
    document.getElementById('title-berobat').innerHTML = '<i class="bi bi-clipboard2-pulse me-2"></i>Tambah Data Berobat';
  } else if (type === 'kecelakaan') {
    resetKecelakaanForm();
    document.getElementById('title-kecelakaan').innerHTML = '<i class="bi bi-exclamation-triangle me-2"></i>Tambah Data Kecelakaan';
  } else {
    resetKonsultasiForm();
    document.getElementById('title-konsultasi').innerHTML = '<i class="bi bi-chat-dots me-2"></i>Tambah Data Konsultasi';
  }
  openModal('modal' + type.charAt(0).toUpperCase() + type.slice(1));
}

function resetBerobatForm() {
  document.getElementById('b-tanggal').value = todayStr();
  document.getElementById('b-waktu').value = nowTime();
  document.getElementById('b-perusahaan').value = state.company;
  fillDepartemenDropdown('b-departemen');
  ['b-nama','b-keluhan','b-tindakan','b-keterangan','b-jumlah-obat','b-satuan-obat'].forEach(id => { const el=document.getElementById(id); if(el) el.value=''; });
  document.getElementById('b-jk').value = '';
  document.getElementById('b-istirahat').value = '';
  document.getElementById('b-hari-istirahat').value = '';
  document.getElementById('wrap-hari-istirahat').style.display = 'none';
  document.getElementById('b-kat-diagnosa').value = '';
  document.getElementById('b-nama-diagnosa').innerHTML = '<option value="">-- Pilih Nama --</option>';
  document.getElementById('b-kat-obat').value = '';
  document.getElementById('b-nama-obat').innerHTML = '<option value="">-- Pilih Nama --</option>';
  renderObatList(); renderDiagnosaList();
}

function resetKecelakaanForm() {
  document.getElementById('k-tanggal').value = todayStr();
  document.getElementById('k-waktu').value = nowTime();
  document.getElementById('k-perusahaan').value = state.company;
  fillDepartemenDropdown('k-departemen');
  ['k-nama','k-lokasi','k-penyebab','k-bagian-terluka','k-tindakan','k-deskripsi'].forEach(id => { const el=document.getElementById(id); if(el) el.value=''; });
  document.getElementById('k-jk').value = '';
}

function resetKonsultasiForm() {
  document.getElementById('ko-tanggal').value = todayStr();
  document.getElementById('ko-waktu').value = nowTime();
  document.getElementById('ko-perusahaan').value = state.company;
  fillDepartemenDropdown('ko-departemen');
  ['ko-nama','ko-keluhan','ko-riwayat','ko-saran'].forEach(id => { const el=document.getElementById(id); if(el) el.value=''; });
  document.getElementById('ko-jk').value = '';
}

function tambahDiagnosa() {
  const kat = document.getElementById('b-kat-diagnosa')?.value;
  const nama = document.getElementById('b-nama-diagnosa')?.value;
  if (!nama) return toast('warning','Perhatian','Pilih nama diagnosa.');
  state.diagnosaList.push({ kategori: kat, nama });
  renderDiagnosaList();
  document.getElementById('b-kat-diagnosa').value = '';
  document.getElementById('b-nama-diagnosa').innerHTML = '<option value="">-- Pilih Nama --</option>';
}
function hapusDiagnosa(i) { state.diagnosaList.splice(i,1); renderDiagnosaList(); }
function renderDiagnosaList() {
  const tbody = document.getElementById('diagnosa-list-tbody');
  if (!tbody) return;
  tbody.innerHTML = state.diagnosaList.length
    ? state.diagnosaList.map((d,i)=>`<tr><td>${i+1}</td><td>${esc(d.kategori||'-')}</td><td>${esc(d.nama)}</td><td><button class="btn btn-sm btn-outline-danger" onclick="hapusDiagnosa(${i})"><i class="bi bi-x"></i></button></td></tr>`).join('')
    : '<tr><td colspan="4" class="text-center text-muted py-3">Belum ada diagnosa</td></tr>';
}

function tambahObat() {
  const kat = document.getElementById('b-kat-obat')?.value;
  const nama = document.getElementById('b-nama-obat')?.value;
  const jumlah = document.getElementById('b-jumlah-obat')?.value;
  const satuan = document.getElementById('b-satuan-obat')?.value;
  if (!nama) return toast('warning','Perhatian','Pilih nama obat.');
  state.obatList.push({ kategori: kat, nama, jumlah, satuan });
  renderObatList();
  document.getElementById('b-kat-obat').value = '';
  document.getElementById('b-nama-obat').innerHTML = '<option value="">-- Pilih Nama --</option>';
  document.getElementById('b-jumlah-obat').value = '';
  document.getElementById('b-satuan-obat').value = '';
}
function hapusObat(i) { state.obatList.splice(i,1); renderObatList(); }
function renderObatList() {
  const tbody = document.getElementById('obat-list-tbody');
  if (!tbody) return;
  tbody.innerHTML = state.obatList.length
    ? state.obatList.map((o,i)=>`<tr><td>${i+1}</td><td>${esc(o.kategori||'-')}</td><td>${esc(o.nama)}</td><td>${esc(o.jumlah||'')}</td><td>${esc(o.satuan||'')}</td><td><button class="btn btn-sm btn-outline-danger" onclick="hapusObat(${i})"><i class="bi bi-x"></i></button></td></tr>`).join('')
    : '<tr><td colspan="6" class="text-center text-muted py-3">Belum ada obat</td></tr>';
}

// ════════════════════════════════════════════════════════
//  SAVE FUNCTIONS
// ════════════════════════════════════════════════════════
async function saveBerobat() {
  // UPDATED: Tambahkan validasi untuk Nama Diagnosa dan Nama Obat
  if (!validateRequired(['b-tanggal','b-waktu','b-departemen','b-nama','b-jk','b-keluhan','b-tindakan'])) return;
  
  // Validasi tambahan: pastikan diagnosa dan obat tidak kosong
  if (state.diagnosaList.length === 0) {
    toast('warning', 'Form Tidak Lengkap', 'Minimal satu diagnosa harus ditambahkan.');
    return;
  }
  if (state.obatList.length === 0) {
    toast('warning', 'Form Tidak Lengkap', 'Minimal satu obat harus ditambahkan.');
    return;
  }
  
  await doSave('berobat', {
    'Tanggal': inputToDate(document.getElementById('b-tanggal').value),
    'Waktu': document.getElementById('b-waktu').value,
    'Perusahaan': state.company,
    'Departemen': document.getElementById('b-departemen').value,
    'Nama': document.getElementById('b-nama').value.trim(),
    'Jenis Kelamin': document.getElementById('b-jk').value,
    'Keluhan': document.getElementById('b-keluhan').value.trim(),
    'Kategori Diagnosa': state.diagnosaList.map(d=>d.kategori).join('|'),
    'Nama Diagnosa': state.diagnosaList.map(d=>d.nama).join('|'),
    'Kategori Obat': state.obatList.map(o=>o.kategori).join('|'),
    'Nama Obat': state.obatList.map(o=>o.nama).join('|'),
    'Jumlah Obat': state.obatList.map(o=>o.jumlah).join('|'),
    'Satuan Obat': state.obatList.map(o=>o.satuan).join('|'),
    'Tindakan': document.getElementById('b-tindakan').value.trim(),
    'Perlu Istirahat': document.getElementById('b-istirahat').value,
    'Jumlah Hari Istirahat': document.getElementById('b-hari-istirahat').value,
    'Keterangan Berobat': document.getElementById('b-keterangan').value.trim(),
  });
}

async function saveKecelakaan() {
  if (!validateRequired(['k-tanggal','k-waktu','k-departemen','k-nama','k-jk','k-lokasi','k-penyebab','k-bagian-terluka','k-tindakan','k-deskripsi'])) return;
  await doSave('kecelakaan', {
    'Tanggal': inputToDate(document.getElementById('k-tanggal').value),
    'Waktu': document.getElementById('k-waktu').value,
    'Perusahaan': state.company,
    'Departemen': document.getElementById('k-departemen').value,
    'Nama': document.getElementById('k-nama').value.trim(),
    'Jenis Kelamin': document.getElementById('k-jk').value,
    'Lokasi Kejadian': document.getElementById('k-lokasi').value.trim(),
    'Penyebab': document.getElementById('k-penyebab').value.trim(),
    'Bagian Yang Terluka': document.getElementById('k-bagian-terluka').value.trim(),
    'Tindakan': document.getElementById('k-tindakan').value.trim(),
    'Deskripsi Kejadian': document.getElementById('k-deskripsi').value.trim(),
  });
}

async function saveKonsultasi() {
  if (!validateRequired(['ko-tanggal','ko-waktu','ko-departemen','ko-nama','ko-jk','ko-keluhan'])) return;
  await doSave('konsultasi', {
    'Tanggal': inputToDate(document.getElementById('ko-tanggal').value),
    'Waktu': document.getElementById('ko-waktu').value,
    'Perusahaan': state.company,
    'Departemen': document.getElementById('ko-departemen').value,
    'Nama': document.getElementById('ko-nama').value.trim(),
    'Jenis Kelamin': document.getElementById('ko-jk').value,
    'Keluhan': document.getElementById('ko-keluhan').value.trim(),
    'Riwayat Penyakit': document.getElementById('ko-riwayat').value.trim(),
    'Saran': document.getElementById('ko-saran').value.trim(),
  });
}

function validateRequired(ids) {
  for (const id of ids) {
    const el = document.getElementById(id);
    if (!el?.value?.toString().trim()) {
      toast('warning', 'Form Tidak Lengkap', `${el?.labels?.[0]?.textContent || id} wajib diisi.`);
      el?.focus(); return false;
    }
  }
  return true;
}

async function doSave(type, row) {
  const isEdit = state.editMode.sheet === type;
  const btn = document.getElementById(`btn-save-${type}`);
  const orig = btn?.innerHTML || '';
  
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Menyimpan...';
  }
  
  try {
    let res;
    if (isEdit) {
      const origRow = state.data[type].rows.find(r => r._rowIndex === state.editMode.rowIndex);
      row['Timestamp'] = origRow?.['Timestamp'] || '';
      row['ID'] = origRow?.['ID'] || '';
      res = await gasRequest('updateRow', { sheet: SHEET_MAP[type], rowIndex: state.editMode.rowIndex, row });
    } else {
      res = await gasRequest('addRow', { sheet: SHEET_MAP[type], row });
    }
    if (res.status !== 'success') throw new Error(res.message);
    toast('success', isEdit ? 'Data Diperbarui' : 'Data Ditambahkan', 'Operasi berhasil.');
    closeModal('modal' + type.charAt(0).toUpperCase() + type.slice(1));
    state.editMode = { sheet: null, rowIndex: null };
    await loadData(type);
  } catch (e) {
    toast('error','Gagal Menyimpan', e.message);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = orig;
    }
  }
}

// ════════════════════════════════════════════════════════
//  EDIT
// ════════════════════════════════════════════════════════
function openEditModal(type, rowIndex) {
  const record = state.data[type].rows.find(r => r._rowIndex === rowIndex);
  if (!record) return toast('error','Error','Data tidak ditemukan.');
  state.editMode = { sheet: type, rowIndex };
  state.obatList = []; state.diagnosaList = [];

  if (type === 'berobat') {
    resetBerobatForm();
    document.getElementById('title-berobat').innerHTML = '<i class="bi bi-pencil me-2"></i>Edit Data Berobat';
    setVal('b-tanggal', dateToInput(record['Tanggal']));
    setVal('b-waktu', record['Waktu']);
    setVal('b-nama', record['Nama']);
    setVal('b-jk', record['Jenis Kelamin']);
    setVal('b-departemen', record['Departemen']);
    setVal('b-keluhan', record['Keluhan']);
    setVal('b-tindakan', record['Tindakan']);
    setVal('b-keterangan', record['Keterangan Berobat']);
    setVal('b-istirahat', record['Perlu Istirahat']);
    setVal('b-hari-istirahat', record['Jumlah Hari Istirahat']);
    toggleIstirahat();
    
    const katDiag = (record['Kategori Diagnosa']||'').split('|').filter(Boolean);
    const namaDiag = (record['Nama Diagnosa']||'').split('|').filter(Boolean);
    namaDiag.forEach((n,i) => state.diagnosaList.push({ kategori: katDiag[i]||'', nama: n }));
    renderDiagnosaList();
    
    const katObat = (record['Kategori Obat']||'').split('|').filter(Boolean);
    const namaObat = (record['Nama Obat']||'').split('|').filter(Boolean);
    const jumlah = (record['Jumlah Obat']||'').split('|');
    const satuan = (record['Satuan Obat']||'').split('|');
    namaObat.forEach((n,i) => state.obatList.push({ kategori: katObat[i]||'', nama: n, jumlah: jumlah[i]||'', satuan: satuan[i]||'' }));
    renderObatList();
  } else if (type === 'kecelakaan') {
    resetKecelakaanForm();
    document.getElementById('title-kecelakaan').innerHTML = '<i class="bi bi-pencil me-2"></i>Edit Data Kecelakaan';
    setVal('k-tanggal', dateToInput(record['Tanggal']));
    setVal('k-waktu', record['Waktu']);
    setVal('k-nama', record['Nama']);
    setVal('k-jk', record['Jenis Kelamin']);
    setVal('k-departemen', record['Departemen']);
    setVal('k-lokasi', record['Lokasi Kejadian']);
    setVal('k-penyebab', record['Penyebab']);
    setVal('k-bagian-terluka', record['Bagian Yang Terluka']);
    setVal('k-tindakan', record['Tindakan']);
    setVal('k-deskripsi', record['Deskripsi Kejadian']);
  } else {
    resetKonsultasiForm();
    document.getElementById('title-konsultasi').innerHTML = '<i class="bi bi-pencil me-2"></i>Edit Data Konsultasi';
    setVal('ko-tanggal', dateToInput(record['Tanggal']));
    setVal('ko-waktu', record['Waktu']);
    setVal('ko-nama', record['Nama']);
    setVal('ko-jk', record['Jenis Kelamin']);
    setVal('ko-departemen', record['Departemen']);
    setVal('ko-keluhan', record['Keluhan']);
    setVal('ko-riwayat', record['Riwayat Penyakit']);
    setVal('ko-saran', record['Saran']);
  }
  openModal('modal' + type.charAt(0).toUpperCase() + type.slice(1));
}

function setVal(id, val) { const el = document.getElementById(id); if (el) el.value = val || ''; }

// ════════════════════════════════════════════════════════
//  DELETE
// ════════════════════════════════════════════════════════
function confirmDelete(type, rowIndex) {
  document.getElementById('btn-confirm-delete').onclick = () => doDelete(type, rowIndex);
  openModal('modalDelete');
}

async function doDelete(type, rowIndex) {
  closeModal('modalDelete');
  try {
    const res = await gasRequest('deleteRow', { sheet: SHEET_MAP[type], rowIndex });
    if (res.status !== 'success') throw new Error(res.message);
    toast('success','Data Dihapus','Data berhasil dihapus.');
    await loadData(type);
  } catch (e) {
    toast('error','Gagal Menghapus', e.message);
  }
}

// ════════════════════════════════════════════════════════
//  TOAST
// ════════════════════════════════════════════════════════
const toastIcons = { success:'bi-check-circle-fill', error:'bi-x-circle-fill', warning:'bi-exclamation-triangle-fill', info:'bi-info-circle-fill' };
const toastTitles = { success:'Berhasil', error:'Gagal', warning:'Perhatian', info:'Informasi' };

function toast(type, title, message) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const id = 'toast-' + Date.now();
  const item = document.createElement('div');
  item.className = `toast-item ${type}`;
  item.id = id;
  item.innerHTML = `<i class="bi ${toastIcons[type]} toast-icon"></i>
    <div class="toast-body"><strong>${esc(title||toastTitles[type])}</strong><span>${esc(message)}</span></div>
    <button class="toast-close" onclick="closeToast('${id}')"><i class="bi bi-x"></i></button>`;
  container.appendChild(item);
  requestAnimationFrame(() => item.classList.add('show'));
  setTimeout(() => closeToast(id), 4500);
}

function closeToast(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove('show');
  setTimeout(() => el.remove(), 300);
}