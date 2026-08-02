// ═══════════════════════════════════════════════════════════════════
//  IHC Klinik - Google Apps Script API
//  Versi Final - Mendukung ID-based update/delete, validasi akses server
// ═══════════════════════════════════════════════════════════════════

const SPREADSHEET_ID = '1IR2ViFb6HIA37ekaAAMG6mqHiMlVSBfxV8idD4iahYk';
const TIMEZONE = 'Asia/Jakarta';

// Kode akses (server-side, tidak terekspos ke client)
const ACCESS_CODES = {
  dashboard: 'dewata',
  form: 'ihc'
};

const ID_PREFIXES = {
  BEROBAT: 'BRT',
  KECELAKAAN: 'KCL',
  KONSULTASI: 'KNS'
};

const COLUMN_NAMES = {
  ID: 'ID',
  TIMESTAMP: 'Timestamp',
  TANGGAL: 'Tanggal',
  WAKTU: 'Waktu',
  PERUSAHAAN: 'Perusahaan',
  DEPARTEMEN: 'Departemen'
};

// ═══════════════════════════════════════
//  Entry Point
// ═══════════════════════════════════════
function doGet(e) {
  const params = e.parameter;
  const action = params.action || '';
  let payload = {};
  try {
    if (params.payload) payload = JSON.parse(params.payload);
  } catch (err) {}
  
  let result;
  switch (action) {
    case 'validateAccess':   result = validateAccess(payload); break;
    case 'getMasterData':    result = getMasterData(); break;
    case 'getData':          result = getData(payload); break;
    case 'getAll':           result = getAll(payload); break;
    case 'addRow':           result = addRow(payload); break;
    case 'updateRow':        result = updateRow(payload); break;
    case 'deleteRow':        result = deleteRow(payload); break;
    case 'getIncompleteData': result = getIncompleteData(payload); break;
    default:
      result = { status: 'error', message: 'Action tidak dikenal: ' + action };
  }
  
  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

// ═══════════════════════════════════════
//  Validasi Akses (Server)
// ═══════════════════════════════════════
function validateAccess(payload) {
  const module = String(payload.module || '').trim();
  const code = String(payload.code || '').trim();
  if (!module || !code) return { status: 'error', message: 'Parameter module dan code wajib diisi' };
  if (!ACCESS_CODES[module]) return { status: 'error', message: 'Module tidak dikenal' };
  if (code !== ACCESS_CODES[module]) return { status: 'error', message: 'Kode akses salah' };
  return { status: 'success', message: 'Akses diterima' };
}

// ═══════════════════════════════════════
//  Master Data (Perusahaan, Departemen, Obat, Diagnosa)
// ═══════════════════════════════════════
function getMasterData() {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const result = { perusahaan: [], departemen: {}, obat: [], diagnosa: [] };

    // Sheet Perusahaan
    const sheetP = ss.getSheetByName('Perusahaan');
    if (!sheetP) return { status: 'error', message: 'Sheet Perusahaan tidak ditemukan' };
    const rowsP = sheetP.getDataRange().getValues();
    for (let i = 1; i < rowsP.length; i++) {
      const p = String(rowsP[i][0] || '').trim();
      const d = String(rowsP[i][1] || '').trim();
      if (p && !result.perusahaan.includes(p)) result.perusahaan.push(p);
      if (p && d) {
        if (!result.departemen[p]) result.departemen[p] = [];
        if (!result.departemen[p].includes(d)) result.departemen[p].push(d);
      }
    }

    // Sheet Obat
    const sheetO = ss.getSheetByName('Obat');
    if (!sheetO) return { status: 'error', message: 'Sheet Obat tidak ditemukan' };
    const rowsO = sheetO.getDataRange().getValues();
    for (let i = 1; i < rowsO.length; i++) {
      const kat = String(rowsO[i][0] || '').trim();
      const nama = String(rowsO[i][1] || '').trim();
      if (kat && nama) result.obat.push({ kategori: kat, nama: nama });
    }

    // Sheet Diagnosa
    const sheetD = ss.getSheetByName('Diagnosa');
    if (!sheetD) return { status: 'error', message: 'Sheet Diagnosa tidak ditemukan' };
    const rowsD = sheetD.getDataRange().getValues();
    for (let i = 1; i < rowsD.length; i++) {
      const kat = String(rowsD[i][0] || '').trim();
      const nama = String(rowsD[i][1] || '').trim();
      if (kat && nama) result.diagnosa.push({ kategori: kat, nama: nama });
    }

    return { status: 'success', data: result };
  } catch (err) {
    return { status: 'error', message: err.toString() };
  }
}

// ═══════════════════════════════════════
//  Ambil Semua Data (tanpa paginasi, untuk dashboard)
// ═══════════════════════════════════════
function getAll(payload) {
  try {
    const sheetName = payload.sheet;
    const perusahaan = String(payload.perusahaan || '').trim();
    if (!sheetName) return { status: 'error', message: 'Parameter sheet wajib diisi' };

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) return { status: 'error', message: `Sheet "${sheetName}" tidak ditemukan` };

    const allValues = sheet.getDataRange().getValues();
    if (allValues.length < 2) return { status: 'success', data: [] };

    const headers = allValues[0].map(h => String(h).trim());
    const iPerusahaan = headers.indexOf(COLUMN_NAMES.PERUSAHAAN);
    const iTgl = headers.indexOf(COLUMN_NAMES.TANGGAL);
    const iWaktu = headers.indexOf(COLUMN_NAMES.WAKTU);

    const data = [];
    for (let i = 1; i < allValues.length; i++) {
      const row = allValues[i];
      if (row.every(cell => cell === '' || cell === null || cell === undefined)) continue;
      if (perusahaan && iPerusahaan >= 0) {
        const pVal = String(row[iPerusahaan] || '').trim();
        if (pVal !== perusahaan) continue;
      }
      const obj = { _rowIndex: i + 1 };
      headers.forEach((h, idx) => { obj[h] = formatCellValue(row[idx], h); });
      const emptyColumns = getEmptyColumns(row, headers, sheetName);
      if (emptyColumns.length > 0) {
        obj._hasEmptyColumns = true;
        obj._emptyColumns = emptyColumns;
      }
      data.push(obj);
    }

    // Sorting by tanggal desc
    if (iTgl >= 0) {
      data.sort((a, b) => {
        const da = parseTanggal(a.Tanggal);
        const db = parseTanggal(b.Tanggal);
        if (da.getTime() === db.getTime() && iWaktu >= 0) {
          const wa = parseWaktuToMinutes(a.Waktu);
          const wb = parseWaktuToMinutes(b.Waktu);
          return wb - wa;
        }
        return db - da;
      });
    }

    return { status: 'success', data: data };
  } catch (err) {
    return { status: 'error', message: err.toString() };
  }
}

// ═══════════════════════════════════════
//  Ambil Data dengan Paginasi (untuk input.html)
// ═══════════════════════════════════════
function getData(payload) {
  try {
    const sheetName = payload.sheet;
    if (!sheetName) return { status: 'error', message: 'Parameter sheet wajib diisi' };

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) return { status: 'error', message: `Sheet "${sheetName}" tidak ditemukan` };

    const allValues = sheet.getDataRange().getValues();
    if (allValues.length < 2) {
      return { status: 'success', data: [], total: 0, page: 1, totalPages: 1, filterOptions: { tahun: [], bulan: [], dept: [] } };
    }

    const headers = allValues[0].map(h => String(h).trim());
    const search = String(payload.search || '').toLowerCase().trim();
    const perusahaan = String(payload.perusahaan || '').trim();
    const tahun = String(payload.tahun || '').trim();
    const bulan = String(payload.bulan || '').trim();
    const date = String(payload.date || '').trim();
    const dept = String(payload.dept || '').trim();
    const page = Math.max(1, parseInt(payload.page || 1));
    const perPage = Math.max(1, parseInt(payload.perPage || 15));

    const iTgl = headers.indexOf(COLUMN_NAMES.TANGGAL);
    const iWaktu = headers.indexOf(COLUMN_NAMES.WAKTU);
    const iDept = headers.indexOf(COLUMN_NAMES.DEPARTEMEN);
    const iPerusahaan = headers.indexOf(COLUMN_NAMES.PERUSAHAAN);

    const filtered = [];
    for (let i = 1; i < allValues.length; i++) {
      const row = allValues[i];
      if (row.every(cell => cell === '' || cell === null || cell === undefined)) continue;
      if (perusahaan && iPerusahaan >= 0) {
        const pVal = String(row[iPerusahaan] || '').trim();
        if (pVal !== perusahaan) continue;
      }
      if (date || tahun || bulan) {
        const tglVal = iTgl >= 0 ? row[iTgl] : null;
        if (!tglVal) continue;
        if (date) {
          let rowDate = null;
          if (tglVal instanceof Date) {
            rowDate = Utilities.formatDate(tglVal, TIMEZONE, 'yyyy-MM-dd');
          } else {
            const s = String(tglVal).trim();
            if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
              const [dd, mm, yyyy] = s.split('/');
              rowDate = `${yyyy}-${mm}-${dd}`;
            } else if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
              rowDate = s.substring(0, 10);
            }
          }
          if (rowDate !== date) continue;
        } else {
          const parts = extractTglParts(row[iTgl]);
          if (tahun && parts[2] !== tahun) continue;
          if (bulan) {
            const bulanPadded = String(bulan).padStart(2, '0');
            if (parts[1] !== bulanPadded) continue;
          }
        }
      }
      if (dept && iDept >= 0) {
        const dVal = String(row[iDept] || '').trim();
        if (dVal !== dept) continue;
      }
      if (search) {
        const rowText = row.map((cell, colIdx) => formatCellValue(cell, headers[colIdx])).join(' ').toLowerCase();
        if (!rowText.includes(search)) continue;
      }
      filtered.push({ rowIndex: i + 1, row });
    }

    if (iTgl >= 0) {
      filtered.sort((a, b) => {
        const da = parseTanggal(a.row[iTgl]);
        const db = parseTanggal(b.row[iTgl]);
        if (da.getTime() === db.getTime() && iWaktu >= 0) {
          const wa = parseWaktuToMinutes(a.row[iWaktu]);
          const wb = parseWaktuToMinutes(b.row[iWaktu]);
          return wb - wa;
        }
        return db - da;
      });
    }

    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / perPage));
    const safePage = Math.min(page, totalPages);
    const start = (safePage - 1) * perPage;
    const slice = filtered.slice(start, start + perPage);

    const data = slice.map(({ rowIndex, row }) => {
      const obj = { _rowIndex: rowIndex };
      headers.forEach((h, i) => { obj[h] = formatCellValue(row[i], h); });
      const emptyColumns = getEmptyColumns(row, headers, sheetName);
      if (emptyColumns.length > 0) {
        obj._hasEmptyColumns = true;
        obj._emptyColumns = emptyColumns;
      }
      return obj;
    });

    // Filter options for dropdowns
    const years = new Set();
    const months = new Set();
    const depts = new Set();
    for (let i = 1; i < allValues.length; i++) {
      const row = allValues[i];
      if (row.every(cell => cell === '' || cell === null || cell === undefined)) continue;
      if (perusahaan && iPerusahaan >= 0) {
        const pVal = String(row[iPerusahaan] || '').trim();
        if (pVal !== perusahaan) continue;
      }
      const parts = extractTglParts(row[iTgl]);
      if (parts.length === 3) {
        if (parts[2]) years.add(parts[2]);
        if (parts[1]) months.add(parts[1]);
      }
      if (iDept >= 0 && row[iDept]) depts.add(String(row[iDept]).trim());
    }

    return {
      status: 'success',
      data,
      total,
      page: safePage,
      totalPages,
      perPage,
      filterOptions: {
        tahun: [...years].sort().reverse(),
        bulan: [...months].sort(),
        dept: [...depts].sort(),
      },
    };
  } catch (err) {
    return { status: 'error', message: err.toString() };
  }
}

// ═══════════════════════════════════════
//  Tambah Data Baru
// ═══════════════════════════════════════
function addRow(payload) {
  try {
    const { sheet: sheetName, row: rowData } = payload;
    if (!sheetName || !rowData) return { status: 'error', message: 'sheet dan row wajib diisi' };

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) return { status: 'error', message: `Sheet "${sheetName}" tidak ditemukan` };

    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const now = new Date();
    const id = generateId(sheetName);

    const newRow = headers.map(h => {
      const key = String(h).trim();
      if (key === COLUMN_NAMES.TIMESTAMP) return now;
      if (key === COLUMN_NAMES.ID) return id;
      if (key === COLUMN_NAMES.TANGGAL && rowData[key]) {
        const tglStr = String(rowData[key]).trim();
        if (/^\d{2}\/\d{2}\/\d{4}$/.test(tglStr)) {
          const [dd, mm, yyyy] = tglStr.split('/');
          return new Date(yyyy, mm - 1, dd);
        }
      }
      if (key === COLUMN_NAMES.WAKTU && rowData[key]) {
        return parseWaktuToTimeString(rowData[key]);
      }
      return rowData[key] !== undefined ? rowData[key] : '';
    });

    sheet.appendRow(newRow);
    return { status: 'success', message: 'Data berhasil ditambahkan.', id: id };
  } catch (err) {
    return { status: 'error', message: err.toString() };
  }
}

// ═══════════════════════════════════════
//  Update Data Berdasarkan ID
// ═══════════════════════════════════════
function updateRow(payload) {
  try {
    const { sheet: sheetName, rowId, row: rowData } = payload;
    if (!sheetName || !rowId || !rowData) {
      return { status: 'error', message: 'sheet, rowId, dan row wajib diisi' };
    }

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) return { status: 'error', message: `Sheet "${sheetName}" tidak ditemukan` };

    const allValues = sheet.getDataRange().getValues();
    const headers = allValues[0].map(h => String(h).trim());
    const iId = headers.indexOf(COLUMN_NAMES.ID);
    if (iId < 0) return { status: 'error', message: 'Kolom ID tidak ditemukan' };

    let targetRowIndex = -1;
    for (let i = 1; i < allValues.length; i++) {
      if (String(allValues[i][iId] || '').trim() === String(rowId).trim()) {
        targetRowIndex = i + 1;
        break;
      }
    }
    if (targetRowIndex < 0) {
      return { status: 'error', message: `Data dengan ID "${rowId}" tidak ditemukan` };
    }

    const now = new Date();
    const updRow = headers.map(h => {
      const key = String(h).trim();
      if (key === COLUMN_NAMES.TIMESTAMP) return now;
      if (key === COLUMN_NAMES.ID) return rowId;
      if (key === COLUMN_NAMES.TANGGAL && rowData[key]) {
        const tglStr = String(rowData[key]).trim();
        if (/^\d{2}\/\d{2}\/\d{4}$/.test(tglStr)) {
          const [dd, mm, yyyy] = tglStr.split('/');
          return new Date(yyyy, mm - 1, dd);
        }
      }
      if (key === COLUMN_NAMES.WAKTU && rowData[key]) {
        return parseWaktuToTimeString(rowData[key]);
      }
      return rowData[key] !== undefined ? rowData[key] : '';
    });

    sheet.getRange(targetRowIndex, 1, 1, updRow.length).setValues([updRow]);
    return { status: 'success', message: 'Data berhasil diperbarui.' };
  } catch (err) {
    return { status: 'error', message: err.toString() };
  }
}

// ═══════════════════════════════════════
//  Hapus Data Berdasarkan ID
// ═══════════════════════════════════════
function deleteRow(payload) {
  try {
    const { sheet: sheetName, rowId } = payload;
    if (!sheetName || !rowId) {
      return { status: 'error', message: 'sheet dan rowId wajib diisi' };
    }

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) return { status: 'error', message: `Sheet "${sheetName}" tidak ditemukan` };

    const allValues = sheet.getDataRange().getValues();
    const headers = allValues[0].map(h => String(h).trim());
    const iId = headers.indexOf(COLUMN_NAMES.ID);
    if (iId < 0) return { status: 'error', message: 'Kolom ID tidak ditemukan' };

    let targetRowIndex = -1;
    for (let i = 1; i < allValues.length; i++) {
      if (String(allValues[i][iId] || '').trim() === String(rowId).trim()) {
        targetRowIndex = i + 1;
        break;
      }
    }
    if (targetRowIndex < 0) {
      return { status: 'error', message: `Data dengan ID "${rowId}" tidak ditemukan` };
    }

    sheet.deleteRow(targetRowIndex);
    return { status: 'success', message: 'Data berhasil dihapus.' };
  } catch (err) {
    return { status: 'error', message: err.toString() };
  }
}

// ═══════════════════════════════════════
//  Data Tidak Lengkap (Notifikasi)
// ═══════════════════════════════════════
function getIncompleteData(payload) {
  try {
    const perusahaan = String(payload.perusahaan || '').trim();
    if (!perusahaan) return { status: 'error', message: 'Perusahaan wajib diisi' };

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const result = { berobat: [], kecelakaan: [], konsultasi: [] };
    const sheets = ['Berobat', 'Kecelakaan', 'Konsultasi'];

    sheets.forEach(sheetName => {
      const sheet = ss.getSheetByName(sheetName);
      if (!sheet) return;
      const allValues = sheet.getDataRange().getValues();
      if (allValues.length < 2) return;
      const headers = allValues[0].map(h => String(h).trim());
      const iPerusahaan = headers.indexOf(COLUMN_NAMES.PERUSAHAAN);
      const type = sheetName.toLowerCase();

      for (let i = 1; i < allValues.length; i++) {
        const row = allValues[i];
        if (row.every(cell => cell === '' || cell === null || cell === undefined)) continue;
        if (perusahaan && iPerusahaan >= 0) {
          const pVal = String(row[iPerusahaan] || '').trim();
          if (pVal !== perusahaan) continue;
        }
        const emptyColumns = getEmptyColumns(row, headers, sheetName);
        if (emptyColumns.length > 0) {
          const obj = { _rowIndex: i + 1, _sheetName: sheetName, _type: type, _emptyColumns: emptyColumns };
          headers.forEach((h, idx) => { obj[h] = formatCellValue(row[idx], h); });
          result[type].push(obj);
        }
      }
    });

    return { status: 'success', data: result };
  } catch (err) {
    return { status: 'error', message: err.toString() };
  }
}

// ═══════════════════════════════════════
//  HELPER FUNCTIONS
// ═══════════════════════════════════════
function generateId(sheetName) {
  const prefix = ID_PREFIXES[sheetName] || 'IDX';
  const now = new Date();
  const ts = Utilities.formatDate(now, TIMEZONE, 'yyyyMMddHHmmss');
  return prefix + '-' + ts;
}

function parseTanggal(val) {
  if (!val) return new Date(0);
  if (val instanceof Date) return val;
  const s = String(val).trim();
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
    const [dd, mm, yyyy] = s.split('/');
    return new Date(yyyy, mm - 1, dd);
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return new Date(s);
  return new Date(s);
}

function parseWaktuToMinutes(val) {
  if (!val) return -1;
  if (val instanceof Date) return val.getHours() * 60 + val.getMinutes();
  if (typeof val === 'number' && val >= 0 && val < 1) return Math.round(val * 24 * 60);
  const s = String(val).trim();
  const match = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (match) return parseInt(match[1],10)*60 + parseInt(match[2],10);
  return -1;
}

function parseWaktuToTimeString(waktuStr) {
  if (!waktuStr) return '';
  const s = String(waktuStr).trim();
  const match = s.match(/^(\d{1,2}):(\d{2})$/);
  if (match) {
    return `${String(parseInt(match[1],10)).padStart(2,'0')}:${String(parseInt(match[2],10)).padStart(2,'0')}`;
  }
  return s;
}

function extractTglParts(val) {
  if (!val) return [];
  if (val instanceof Date) {
    return [
      Utilities.formatDate(val, TIMEZONE, 'dd'),
      Utilities.formatDate(val, TIMEZONE, 'MM'),
      Utilities.formatDate(val, TIMEZONE, 'yyyy')
    ];
  }
  const s = String(val).trim();
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) return s.split('/');
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    return [
      Utilities.formatDate(d, TIMEZONE, 'dd'),
      Utilities.formatDate(d, TIMEZONE, 'MM'),
      Utilities.formatDate(d, TIMEZONE, 'yyyy')
    ];
  }
  return [];
}

function formatCellValue(val, colHeader) {
  const h = String(colHeader || '').trim();
  if (h === COLUMN_NAMES.TIMESTAMP) {
    if (!val) return '';
    if (val instanceof Date) return Utilities.formatDate(val, TIMEZONE, 'dd/MM/yyyy HH:mm:ss');
    const d = new Date(val);
    if (!isNaN(d.getTime())) return Utilities.formatDate(d, TIMEZONE, 'dd/MM/yyyy HH:mm:ss');
    return String(val);
  }
  if (h === COLUMN_NAMES.TANGGAL) {
    if (!val) return '';
    if (val instanceof Date) return Utilities.formatDate(val, TIMEZONE, 'dd/MM/yyyy');
    const s = String(val).trim();
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) return s;
    const d = new Date(val);
    if (!isNaN(d.getTime())) return Utilities.formatDate(d, TIMEZONE, 'dd/MM/yyyy');
    return s;
  }
  if (h === COLUMN_NAMES.WAKTU) {
    if (!val && val !== 0) return '';
    if (val instanceof Date) return Utilities.formatDate(val, TIMEZONE, 'HH:mm');
    if (typeof val === 'number' && val >= 0 && val < 1) {
      const totalMinutes = Math.round(val * 24 * 60);
      return `${String(Math.floor(totalMinutes/60)).padStart(2,'0')}:${String(totalMinutes%60).padStart(2,'0')}`;
    }
    const s = String(val).trim();
    const match = s.match(/^(\d{1,2}):(\d{2})/);
    if (match) return `${String(parseInt(match[1],10)).padStart(2,'0')}:${String(parseInt(match[2],10)).padStart(2,'0')}`;
    const d = new Date(val);
    if (!isNaN(d.getTime())) return Utilities.formatDate(d, TIMEZONE, 'HH:mm');
    return s;
  }
  if (val === null || val === undefined) return '';
  return String(val);
}

function isCellEmpty(val) {
  return val === null || val === undefined || String(val).trim() === '';
}

function getRequiredColumns(sheetName) {
  const required = {
    'Berobat': ['Tanggal','Waktu','Nama','Jenis Kelamin','Departemen','Keluhan','Tindakan','Nama Diagnosa','Nama Obat','Jumlah Obat','Satuan Obat'],
    'Kecelakaan': ['Tanggal','Waktu','Nama','Jenis Kelamin','Departemen','Lokasi Kejadian','Penyebab','Bagian Yang Terluka','Tindakan','Deskripsi Kejadian'],
    'Konsultasi': ['Tanggal','Waktu','Nama','Jenis Kelamin','Departemen','Keluhan']
  };
  return required[sheetName] || [];
}

function getEmptyColumns(row, headers, sheetName) {
  const required = getRequiredColumns(sheetName);
  const empty = [];
  required.forEach(col => {
    const idx = headers.indexOf(col);
    if (idx >= 0 && isCellEmpty(row[idx])) empty.push(col);
  });
  return empty;
}