// ═══════════════════════════════════════════════════
//  app.js — Main Application
// ═══════════════════════════════════════════════════

const app = {
    // ── Config ────────────────────────────────────
    SID: '1IR2ViFb6HIA37ekaAAMG6mqHiMlVSBfxV8idD4iahYk',
    get URL() { return `https://opensheet.elk.sh/${this.SID}`; },

    // Passwords: key = lowercase perusahaan substring, value = password
    passwords: {
        'delonix hotel karawang': 'DHK',
        'pt. sankei dharma indonesia': 'SDI',
    },

    // ── State ─────────────────────────────────────
    rawData:    [],
    rawDiagnosa: [],
    rawObat:    [],
    filtered:   [],
    filteredDiagnosa: [],
    filteredObat: [],
    unit:       null,
    activeTab:  'Berobat',
    page:       { Berobat: 1, Kecelakaan: 1, Konsultasi: 1 },
    rowsPerPage: 25,
    _debounce:  null,

    // ── Boot ──────────────────────────────────────
    async init() {
        this._bindEvents();
        await this.fetchData();
    },

    // ── Data Fetch ────────────────────────────────
    async fetchData() {
        this._showLoading(true);
        this._setSyncing(true);
        try {
            const sheets = ['Berobat', 'Kecelakaan', 'Konsultasi'];
            const extraSheets = ['D-Diagnosa', 'D-Obat'];
            const allSheets = [...sheets, ...extraSheets];
            const results = await Promise.all(
                allSheets.map(s =>
                    fetch(`${this.URL}/${encodeURIComponent(s)}`)
                        .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
                )
            );
            this.rawData = [];
            results.slice(0, 3).forEach((rows, idx) => {
                const type = sheets[idx];
                rows.forEach(row => {
                    const d = parseDateString(row.Tanggal || row.Timestamp);
                    this.rawData.push({ ...row, _type: type, bulan: d.m, tahun: d.y });
                });
            });

            // D-Diagnosa raw
            this.rawDiagnosa = (results[3] || []).map(row => {
                const d = parseDateString(row.Tanggal);
                return { ...row, bulan: d.m, tahun: d.y };
            });

            // D-Obat raw
            this.rawObat = (results[4] || []).map(row => {
                const d = parseDateString(row.Tanggal);
                return { ...row, bulan: d.m, tahun: d.y };
            });

            // Sort descending by date
            this.rawData.sort((a, b) => {
                const da = parseDMY(a.Tanggal || a.Timestamp);
                const db = parseDMY(b.Tanggal || b.Timestamp);
                if (!da && !db) return 0;
                if (!da) return 1; if (!db) return -1;
                const av = da.year * 10000 + da.month * 100 + da.day;
                const bv = db.year * 10000 + db.month * 100 + db.day;
                return bv - av;
            });

            this._populateCompanySelect();
            this._showLoading(false);
            this._setSyncing(false);

            if (this.unit) {
                this._populateFilters();
                this.apply();
            } else {
                this._showLoginGate();
            }
        } catch (e) {
            console.error('fetchData:', e);
            this._showLoading(false);
            this._setSyncing(false);
            this.showToast('Gagal memuat data. Periksa koneksi.', 'error');
        }
    },

    // ── Login Modal ───────────────────────────────
    _showLoginGate() {
        el('loading-screen').classList.add('hidden');
        el('login-modal').classList.remove('hidden');
    },

    showLoginGate() {
        this._populateCompanySelect();
        el('company-password').value = '';
        el('pw-error').classList.add('hidden');
        el('dashboard').classList.add('hidden');
        el('login-modal').classList.remove('hidden');
    },

    _populateCompanySelect() {
        const companies = [...new Set(this.rawData.map(r => r.Perusahaan).filter(Boolean))].sort();
        const sel = el('company-select');
        if (!sel) return;
        sel.innerHTML = '<option value="">— Pilih Unit —</option>' +
            companies.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
        // restore if previously selected
        if (this.unit) {
            sel.value = this.unit;
            setText('navbar-company-name', this.unit);
        }
    },

    enterDashboard() {
        const company  = el('company-select').value;
        const password = el('company-password').value;
        const errEl    = el('pw-error');

        if (!company) {
            this.showToast('Pilih unit perusahaan terlebih dahulu.', 'error');
            return;
        }

        const cLower = company.toLowerCase();
        let valid = false;
        for (const [key, pw] of Object.entries(this.passwords)) {
            if (cLower.includes(key) || key.includes(cLower)) {
                if (password === pw) { valid = true; break; }
            }
        }

        if (!valid) {
            errEl.classList.remove('hidden');
            el('company-password').value = '';
            el('company-password').focus();
            return;
        }

        errEl.classList.add('hidden');
        this.unit = company;
        setText('active-company', company);
        setText('navbar-company-name', company);

        el('login-modal').classList.add('hidden');
        el('dashboard').classList.remove('hidden');

        this._populateFilters();
        this.apply();
    },

    // ── Filters ───────────────────────────────────
    _populateFilters() {
        const base  = this.rawData.filter(r => r.Perusahaan === this.unit);
        const depts = [...new Set(base.map(r => r.Departemen).filter(Boolean))].sort();
        const years = [...new Set(base.map(r => r.tahun).filter(y => y > 0))].sort((a, b) => b - a);

        const deptSel = el('filter-dept');
        if (deptSel) {
            deptSel.innerHTML = '<option value="">Semua Departemen</option>' +
                depts.map(d => `<option value="${escapeHtml(d)}">${escapeHtml(d)}</option>`).join('');
        }

        const tahunSel = el('filter-tahun');
        if (tahunSel) {
            tahunSel.innerHTML = '<option value="">Semua Tahun</option>' +
                years.map(y => `<option value="${y}">${y}</option>`).join('');
        }
    },

    apply() {
        if (!this.unit) return;

        const nama  = (el('filter-nama')?.value || '').toLowerCase().trim();
        const dept  = el('filter-dept')?.value || '';
        const bulan = el('filter-bulan')?.value || '';
        const tahun = el('filter-tahun')?.value || '';

        this.filtered = this.rawData.filter(r => {
            if (r.Perusahaan !== this.unit) return false;
            if (nama && !(r.Nama || '').toLowerCase().includes(nama)) return false;
            if (dept && r.Departemen !== dept) return false;
            if (bulan && r.bulan != bulan) return false;
            if (tahun && r.tahun != tahun) return false;
            return true;
        });

        // Filter D-Diagnosa & D-Obat by Perusahaan + optional filters
        this.filteredDiagnosa = this.rawDiagnosa.filter(r => {
            if (r.Perusahaan !== this.unit) return false;
            if (nama && !(r.Nama || '').toLowerCase().includes(nama)) return false;
            if (dept && r.Departemen !== dept) return false;
            if (bulan && r.bulan != bulan) return false;
            if (tahun && r.tahun != tahun) return false;
            return true;
        });

        this.filteredObat = this.rawObat.filter(r => {
            if (r.Perusahaan !== this.unit) return false;
            if (nama && !(r.Nama || '').toLowerCase().includes(nama)) return false;
            if (dept && r.Departemen !== dept) return false;
            if (bulan && r.bulan != bulan) return false;
            if (tahun && r.tahun != tahun) return false;
            return true;
        });

        // Update tab counts
        ['Berobat', 'Kecelakaan', 'Konsultasi'].forEach(t => {
            const cnt = this.filtered.filter(r => r._type === t).length;
            setText(`count-${t}`, cnt);
        });

        // Reset pages when filter changes
        this.page = { Berobat: 1, Kecelakaan: 1, Konsultasi: 1 };

        this.renderActiveTab();
    },

    applyDebounced() {
        clearTimeout(this._debounce);
        this._debounce = setTimeout(() => this.apply(), 280);
    },

    resetFilters() {
        ['filter-nama','filter-dept','filter-bulan','filter-tahun'].forEach(id => {
            const e = el(id);
            if (e) e.value = '';
        });
        this.apply();
    },

    // ── Tab Management ────────────────────────────
    setTab(tab) {
        this.activeTab = tab;

        // Update sidebar nav items
        document.querySelectorAll('.nav-item').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tab);
        });

        // Update bottom nav items (mobile)
        document.querySelectorAll('.bnav-item').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tab);
        });

        // Update panels
        document.querySelectorAll('.tab-panel').forEach(p => {
            p.classList.toggle('active', p.id === `panel-${tab}`);
        });

        this.renderActiveTab();
    },

    renderActiveTab() {
        const tab = this.activeTab;
        const data = this.filtered.filter(r => r._type === tab);

        if (tab === 'Berobat')     this._renderBerobatPanel(data);
        if (tab === 'Kecelakaan')  this._renderKecelakaanPanel(data);
        if (tab === 'Konsultasi')  this._renderKonsultasiPanel(data);
        if (tab === 'Data')        this._renderDataPanel();
        if (tab === 'Download')    this._renderDownloadPanel();
    },

    // ── Panel Renderers ───────────────────────────

    _renderBerobatPanel(data) {
        const panel = el('panel-Berobat');
        if (!panel) return;

        // KPI
        const totalKunjungan  = data.length;
        const totalIstirahat  = data.filter(r => (r['Perlu Istirahat'] || '').toLowerCase().includes('ya')).length;
        const totalHariIst    = data.reduce((s, r) => s + (parseInt(r['Jumlah Hari Istirahat']) || 0), 0);
        const uniquePasien    = new Set(data.map(r => r.Nama).filter(Boolean)).size;
        const diagnosaSet     = new Set(data.map(r => r['Nama Diagnosa']).filter(v => v && v !== '-'));

        panel.innerHTML = `
            <div class="kpi-grid">
                <div class="kpi-card">
                    <div class="kpi-icon teal"><i class="fa-solid fa-suitcase-medical"></i></div>
                    <div class="kpi-info"><div class="kpi-value">${totalKunjungan}</div><div class="kpi-label">Total Kunjungan</div></div>
                </div>
                <div class="kpi-card">
                    <div class="kpi-icon blue"><i class="fa-solid fa-user-group"></i></div>
                    <div class="kpi-info"><div class="kpi-value">${uniquePasien}</div><div class="kpi-label">Pasien Unik</div></div>
                </div>
                <div class="kpi-card">
                    <div class="kpi-icon yellow"><i class="fa-solid fa-stethoscope"></i></div>
                    <div class="kpi-info"><div class="kpi-value">${diagnosaSet.size}</div><div class="kpi-label">Jenis Diagnosa</div></div>
                </div>
                <div class="kpi-card">
                    <div class="kpi-icon red"><i class="fa-solid fa-bed"></i></div>
                    <div class="kpi-info"><div class="kpi-value">${totalIstirahat}</div><div class="kpi-label">Perlu Istirahat</div></div>
                </div>
                <div class="kpi-card">
                    <div class="kpi-icon purple"><i class="fa-solid fa-calendar-days"></i></div>
                    <div class="kpi-info"><div class="kpi-value">${totalHariIst}</div><div class="kpi-label">Total Hari Istirahat</div></div>
                </div>
            </div>
            <div id="berobat-charts"></div>`;

        createBerobatCharts(data, 'berobat-charts', this.filteredDiagnosa, this.filteredObat);
    },

    _renderKecelakaanPanel(data) {
        const panel = el('panel-Kecelakaan');
        if (!panel) return;

        const uniqueLokasi = new Set(data.map(r => r['Lokasi Kejadian']).filter(Boolean)).size;
        const uniquePasien = new Set(data.map(r => r.Nama).filter(Boolean)).size;

        panel.innerHTML = `
            <div class="kpi-grid">
                <div class="kpi-card">
                    <div class="kpi-icon red"><i class="fa-solid fa-triangle-exclamation"></i></div>
                    <div class="kpi-info"><div class="kpi-value">${data.length}</div><div class="kpi-label">Total Kecelakaan</div></div>
                </div>
                <div class="kpi-card">
                    <div class="kpi-icon blue"><i class="fa-solid fa-user-group"></i></div>
                    <div class="kpi-info"><div class="kpi-value">${uniquePasien}</div><div class="kpi-label">Korban Unik</div></div>
                </div>
                <div class="kpi-card">
                    <div class="kpi-icon yellow"><i class="fa-solid fa-location-dot"></i></div>
                    <div class="kpi-info"><div class="kpi-value">${uniqueLokasi}</div><div class="kpi-label">Lokasi Kejadian</div></div>
                </div>
            </div>
            <div id="kecelakaan-charts"></div>`;

        createKecelakaanCharts(data, 'kecelakaan-charts');
    },

    _renderKonsultasiPanel(data) {
        const panel = el('panel-Konsultasi');
        if (!panel) return;

        const uniquePasien = new Set(data.map(r => r.Nama).filter(Boolean)).size;

        panel.innerHTML = `
            <div class="kpi-grid">
                <div class="kpi-card">
                    <div class="kpi-icon green"><i class="fa-solid fa-user-doctor"></i></div>
                    <div class="kpi-info"><div class="kpi-value">${data.length}</div><div class="kpi-label">Total Konsultasi</div></div>
                </div>
                <div class="kpi-card">
                    <div class="kpi-icon blue"><i class="fa-solid fa-user-group"></i></div>
                    <div class="kpi-info"><div class="kpi-value">${uniquePasien}</div><div class="kpi-label">Pasien Unik</div></div>
                </div>
            </div>
            <div id="konsultasi-charts"></div>`;

        createKonsultasiCharts(data, 'konsultasi-charts');
    },

    _renderDataPanel() {
        const panel = el('panel-Data');
        if (!panel) return;

        const berobatData    = this.filtered.filter(r => r._type === 'Berobat');
        const kecelakaanData = this.filtered.filter(r => r._type === 'Kecelakaan');
        const konsultasiData = this.filtered.filter(r => r._type === 'Konsultasi');

        panel.innerHTML = `
            <div class="data-section-group">
                <div class="data-section-header">
                    <div class="data-section-label teal"><i class="fa-solid fa-suitcase-medical"></i> Data Berobat</div>
                    <div class="data-section-count">${berobatData.length} data</div>
                </div>
                <div class="table-section" id="data-berobat-table"></div>
            </div>
            <div class="data-section-group">
                <div class="data-section-header">
                    <div class="data-section-label red"><i class="fa-solid fa-triangle-exclamation"></i> Data Kecelakaan</div>
                    <div class="data-section-count">${kecelakaanData.length} data</div>
                </div>
                <div class="table-section" id="data-kecelakaan-table"></div>
            </div>
            <div class="data-section-group">
                <div class="data-section-header">
                    <div class="data-section-label green"><i class="fa-solid fa-user-doctor"></i> Data Konsultasi</div>
                    <div class="data-section-count">${konsultasiData.length} data</div>
                </div>
                <div class="table-section" id="data-konsultasi-table"></div>
            </div>`;

        this._buildBerobatTable(berobatData, 'data-berobat-table');
        this._buildKecelakaanTable(kecelakaanData, 'data-kecelakaan-table');
        this._buildKonsultasiTable(konsultasiData, 'data-konsultasi-table');
    },

    _renderDownloadPanel() {
        const panel = el('panel-Download');
        if (!panel) return;

        // Use downloadReport if available, otherwise show placeholder
        if (typeof downloadReport !== 'undefined') {
            panel.innerHTML = downloadReport.generateReport(this.filtered, this.filteredDiagnosa, this.filteredObat);
        } else {
            panel.innerHTML = `
                <div class="download-empty">
                    <div class="download-empty-icon"><i class="fa-solid fa-download"></i></div>
                    <div class="download-empty-title">Halaman Download</div>
                    <div class="download-empty-desc">Fitur unduhan sedang dimuat...</div>
                </div>`;
        }
    },

    // ── Table Builders ────────────────────────────

    _buildBerobatTable(data, sectionId = 'berobat-table-section') {
        const headers = [
            'No','Tanggal','Waktu','Nama','Jenis Kelamin','Departemen',
            'Keluhan','Kat. Diagnosa','Nama Diagnosa','Kat. Obat','Nama Obat',
            'Jml Obat','Satuan','Tindakan','Istirahat','Hari Istirahat','Keterangan'
        ];
        const rowFn = (r, i) => `<tr>
            <td>${i}</td>
            <td>${escapeHtml(r.Tanggal)}</td>
            <td>${escapeHtml(r.Waktu)}</td>
            <td>${escapeHtml(r.Nama)}</td>
            <td>${escapeHtml(r['Jenis Kelamin'])}</td>
            <td>${escapeHtml(r.Departemen)}</td>
            <td title="${escapeHtml(r.Keluhan)}">${escapeHtml(r.Keluhan)}</td>
            <td>${escapeHtml(r['Kategori Diagnosa'])}</td>
            <td>${escapeHtml(r['Nama Diagnosa'])}</td>
            <td>${escapeHtml(r['Kategori Obat'])}</td>
            <td>${escapeHtml(r['Nama Obat'])}</td>
            <td>${escapeHtml(r['Jumlah Obat'])}</td>
            <td>${escapeHtml(r['Satuan Obat'])}</td>
            <td>${escapeHtml(r.Tindakan)}</td>
            <td>${escapeHtml(r['Perlu Istirahat'])}</td>
            <td>${escapeHtml(r['Jumlah Hari Istirahat'])}</td>
            <td title="${escapeHtml(r['Keterangan Berobat'])}">${escapeHtml(r['Keterangan Berobat'])}</td>
        </tr>`;
        this._buildTable(sectionId, data, headers, rowFn, 'Berobat');
    },

    _buildKecelakaanTable(data, sectionId = 'kecelakaan-table-section') {
        const headers = [
            'No','Tanggal','Waktu','Nama','Jenis Kelamin','Departemen',
            'Lokasi Kejadian','Penyebab','Bagian Terluka','Tindakan','Deskripsi Kejadian'
        ];
        const rowFn = (r, i) => `<tr class="row-danger">
            <td>${i}</td>
            <td>${escapeHtml(r.Tanggal)}</td>
            <td>${escapeHtml(r.Waktu)}</td>
            <td>${escapeHtml(r.Nama)}</td>
            <td>${escapeHtml(r['Jenis Kelamin'])}</td>
            <td>${escapeHtml(r.Departemen)}</td>
            <td>${escapeHtml(r['Lokasi Kejadian'])}</td>
            <td>${escapeHtml(r.Penyebab)}</td>
            <td>${escapeHtml(r['Bagian Yang Terluka'])}</td>
            <td>${escapeHtml(r.Tindakan)}</td>
            <td title="${escapeHtml(r['Deskripsi Kejadian'])}">${escapeHtml(r['Deskripsi Kejadian'])}</td>
        </tr>`;
        this._buildTable(sectionId, data, headers, rowFn, 'Kecelakaan');
    },

    _buildKonsultasiTable(data, sectionId = 'konsultasi-table-section') {
        const headers = [
            'No','Tanggal','Waktu','Nama','Jenis Kelamin','Departemen',
            'Keluhan','Riwayat Penyakit','Saran'
        ];
        const rowFn = (r, i) => `<tr>
            <td>${i}</td>
            <td>${escapeHtml(r.Tanggal)}</td>
            <td>${escapeHtml(r.Waktu)}</td>
            <td>${escapeHtml(r.Nama)}</td>
            <td>${escapeHtml(r['Jenis Kelamin'])}</td>
            <td>${escapeHtml(r.Departemen)}</td>
            <td title="${escapeHtml(r.Keluhan)}">${escapeHtml(r.Keluhan)}</td>
            <td title="${escapeHtml(r['Riwayat Penyakit'])}">${escapeHtml(r['Riwayat Penyakit'])}</td>
            <td title="${escapeHtml(r.Saran)}">${escapeHtml(r.Saran)}</td>
        </tr>`;
        this._buildTable(sectionId, data, headers, rowFn, 'Konsultasi');
    },

    // ── Generic Table ─────────────────────────────
    _buildTable(sectionId, data, headers, rowFn, tabType) {
        const section = el(sectionId);
        if (!section) return;

        const total = data.length;
        const totalPages = Math.ceil(total / this.rowsPerPage) || 1;
        const p = this.page[tabType] || 1;
        const slice = data.slice((p - 1) * this.rowsPerPage, p * this.rowsPerPage);

        const ths = headers.map(h => `<th>${h}</th>`).join('');
        const rows = slice.length === 0
            ? `<tr class="empty-row"><td colspan="${headers.length}"><i class="fa-solid fa-inbox" style="margin-right:8px"></i>Tidak ada data</td></tr>`
            : slice.map((r, i) => rowFn(r, (p - 1) * this.rowsPerPage + i + 1)).join('');

        const start = total === 0 ? 0 : (p - 1) * this.rowsPerPage + 1;
        const end   = Math.min(p * this.rowsPerPage, total);

        section.innerHTML = `
            <div class="table-section-head">
                <div class="table-section-title"><i class="fa-solid fa-table"></i> Data Detail</div>
                <div class="table-section-meta">${start}–${end} dari ${total} data</div>
            </div>
            <div class="table-wrap">
                <table><thead><tr>${ths}</tr></thead><tbody>${rows}</tbody></table>
            </div>
            ${totalPages > 1 ? this._renderPagination(tabType, p, totalPages) : ''}`;
    },

    // ── Pagination ────────────────────────────────
    _renderPagination(type, page, totalPages) {
        const delta = 2;
        const start = Math.max(1, page - delta);
        const end   = Math.min(totalPages, page + delta);
        let btns = '';

        // Prev
        btns += `<button class="pg-btn" onclick="app.goToPage('${type}',${page - 1})" ${page === 1 ? 'disabled' : ''}>
            <i class="fa-solid fa-chevron-left"></i></button>`;

        if (start > 1) {
            btns += `<button class="pg-btn" onclick="app.goToPage('${type}',1)">1</button>`;
            if (start > 2) btns += `<button class="pg-btn ellipsis" disabled>…</button>`;
        }

        for (let i = start; i <= end; i++) {
            btns += `<button class="pg-btn ${i === page ? 'active' : ''}" onclick="app.goToPage('${type}',${i})">${i}</button>`;
        }

        if (end < totalPages) {
            if (end < totalPages - 1) btns += `<button class="pg-btn ellipsis" disabled>…</button>`;
            btns += `<button class="pg-btn" onclick="app.goToPage('${type}',${totalPages})">${totalPages}</button>`;
        }

        // Next
        btns += `<button class="pg-btn" onclick="app.goToPage('${type}',${page + 1})" ${page === totalPages ? 'disabled' : ''}>
            <i class="fa-solid fa-chevron-right"></i></button>`;

        return `<div class="pagination-bar">
            <span class="pagination-info">Hal ${page} / ${totalPages}</span>
            <div class="pagination-btns">${btns}</div>
        </div>`;
    },

    goToPage(type, page) {
        // For Data panel, type is one of Berobat/Kecelakaan/Konsultasi
        const total = this.filtered.filter(r => r._type === type).length;
        const max   = Math.ceil(total / this.rowsPerPage) || 1;
        if (page < 1 || page > max) return;
        this.page[type] = page;
        // If we're on the Data tab, re-render the Data panel; otherwise render active tab
        if (this.activeTab === 'Data') {
            this._renderDataPanel();
        } else {
            this.renderActiveTab();
        }
        window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    // ── Misc ──────────────────────────────────────
    _showLoading(show) {
        const ls = el('loading-screen');
        if (ls) ls.classList.toggle('hidden', !show);
    },

    _setSyncing(on) {
        const icon = el('sync-icon');
        if (!icon) return;
        icon.classList.toggle('spinning', on);
    },

    showToast(msg, type = 'info') {
        const t = el('toast');
        if (!t) return;
        t.textContent = msg;
        t.className = 'toast' + (type === 'error' ? ' error' : '');
        t.classList.remove('hidden');
        clearTimeout(this._toastTimer);
        this._toastTimer = setTimeout(() => t.classList.add('hidden'), 4000);
    },

    _bindEvents() {
        el('filter-nama')?.addEventListener('input',  () => this.applyDebounced());
        el('filter-dept')?.addEventListener('change', () => this.apply());
        el('filter-bulan')?.addEventListener('change',() => this.apply());
        el('filter-tahun')?.addEventListener('change',() => this.apply());

        el('company-password')?.addEventListener('keydown', e => {
            if (e.key === 'Enter') this.enterDashboard();
        });

        el('company-password')?.addEventListener('input', () => {
            el('pw-error')?.classList.add('hidden');
        });
    }
};

// ── Toggle password visibility
function togglePassword() {
    const input = el('company-password');
    const icon  = el('pw-eye');
    if (!input || !icon) return;
    if (input.type === 'password') {
        input.type = 'text';
        icon.className = 'bi bi-eye-slash';
    } else {
        input.type = 'password';
        icon.className = 'bi bi-eye';
    }
}

window.addEventListener('load', () => app.init());