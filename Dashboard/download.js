const downloadReport = {
    // Check if filters are complete (require year and month)
    isFilterComplete() {
        const tahun = el('filter-tahun')?.value;
        const bulan = el('filter-bulan')?.value;
        return tahun && bulan;
    },

    // Get the current filter state
    getFilterState() {
        return {
            tahun: el('filter-tahun')?.value || '',
            bulan: el('filter-bulan')?.value || '',
            dept:  el('filter-dept')?.value  || '',
        };
    },

    // Generate full report HTML with improved order
    generateReport(data, dataDiagnosa, dataObat) {
        if (!this.isFilterComplete()) {
            return `
                <div class="download-empty">
                    <div class="download-empty-icon">
                        <i class="bi bi-calendar-check"></i>
                    </div>
                    <h3 class="download-empty-title">Lengkapi Filter Terlebih Dahulu</h3>
                    <p class="download-empty-desc">
                        Pilih <strong>Tahun</strong> dan <strong>Bulan</strong> untuk melihat analisis data.
                    </p>
                </div>
            `;
        }

        const filters = this.getFilterState();
        const report = [];

        // Header
        report.push(`
            <div class="report-header">
                <div class="report-title">
                    <i class="bi bi-file-earmark-pdf"></i>
                    <h2>Laporan Bulanan In House Clinic</h2>
                </div>
                <div class="report-meta">
                    <p><strong>Unit:</strong> ${escapeHtml(app.unit)}</p>
                    <p><strong>Periode:</strong> ${this._formatMonth(filters.bulan)} ${filters.tahun}</p>
                    <p><strong>Tanggal Laporan:</strong> ${new Date().toLocaleDateString('id-ID')}</p>
                </div>
            </div>
        `);

        // Data by type
        const berobatData = data.filter(r => r._type === 'Berobat');
        const kecelakaanData = data.filter(r => r._type === 'Kecelakaan');
        const konsultasiData = data.filter(r => r._type === 'Konsultasi');

        // === NEW ORDER ===
        // 1. Berobat Analysis (basic KPI)
        if (berobatData.length > 0) {
            report.push(this._generateBerobatAnalysis(berobatData, dataDiagnosa, dataObat, filters));
        }

        // 2. Comparison with Previous Month
        if (berobatData.length > 0) {
            report.push(this._generateMonthComparison(filters));
        }

        // 3. Visit Time Analysis
        if (berobatData.length > 0) {
            report.push(this._generateVisitTimeAnalysis(berobatData));
        }

        // 4. Date Distribution
        if (berobatData.length > 0) {
            report.push(this._generateDateDistribution(berobatData));
        }

        // 5. Medicine Analysis (Top 3 Obat with patients)
        if (dataObat && dataObat.length > 0) {
            report.push(this._generateMedicineAnalysis(dataObat, filters, berobatData));
        }

        // 6. Kecelakaan Analysis
        if (kecelakaanData.length > 0) {
            report.push(this._generateKecelakaanAnalysis(kecelakaanData));
        }

        // 7. Konsultasi Analysis
        if (konsultasiData.length > 0) {
            report.push(this._generateKonsultasiAnalysis(konsultasiData));
        }

        // 8. Summary & Insights
        report.push(this._generateSummaryInsights(berobatData, kecelakaanData, konsultasiData));

        // 9. Conclusion & Recommendations
        if (berobatData.length > 0) {
            report.push(this._generateConclusionRecommendations(berobatData, filters));
        }

        // Export buttons (PDF & CSV only, NO Print)
        report.push(`
            <div class="report-actions">
                <button class="report-btn-export" onclick="downloadReport.exportPDF()">
                    <i class="bi bi-file-pdf"></i> Export PDF
                </button>
                <button class="report-btn-export" onclick="downloadReport.exportCSV()">
                    <i class="bi bi-file-csv"></i> Export CSV
                </button>
            </div>
        `);

        return report.join('');
    },

    _formatMonth(bulan) {
        const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 
                       'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
        return months[parseInt(bulan) - 1] || '';
    },

    _generateBerobatAnalysis(data, dataDiagnosa, dataObat, filters) {
        const totalKunjungan = data.length;
        const uniquePasien = new Set(data.map(r => r.Nama).filter(Boolean)).size;
        const totalIstirahat = data.filter(r => (r['Perlu Istirahat'] || '').toLowerCase().includes('ya')).length;
        const totalHariIst = data.reduce((s, r) => s + (parseInt(r['Jumlah Hari Istirahat']) || 0), 0);
        const topDiagnosa = this._getTopItems(data, 'Nama Diagnosa', 3); // Changed to 3
        const genderData = this._getGenderBreakdown(data);
        const deptData = this._getDeptBreakdown(data, 5);

        const html = `
            <div class="report-section">
                <div class="report-section-header">
                    <i class="bi bi-clipboard2-pulse"></i>
                    <h3>Analisis Berobat</h3>
                </div>

                <div class="report-kpi-grid">
                    <div class="report-kpi">
                        <div class="report-kpi-value">${totalKunjungan}</div>
                        <div class="report-kpi-label">Total Kunjungan</div>
                    </div>
                    <div class="report-kpi">
                        <div class="report-kpi-value">${uniquePasien}</div>
                        <div class="report-kpi-label">Pasien Unik</div>
                    </div>
                    <div class="report-kpi">
                        <div class="report-kpi-value">${totalIstirahat}</div>
                        <div class="report-kpi-label">Kasus Istirahat</div>
                    </div>
                    <div class="report-kpi">
                        <div class="report-kpi-value">${totalHariIst}</div>
                        <div class="report-kpi-label">Total Hari Istirahat</div>
                    </div>
                </div>

                <div class="report-analysis">
                    <h4>Ringkasan</h4>
                    ${this._generateBerobatQualitative(totalKunjungan, uniquePasien, totalIstirahat, totalHariIst, genderData)}
                </div>

                <div class="report-two-col">
                    <div class="report-col">
                        <h4><i class="bi bi-stethoscope"></i> Top 3 Diagnosa Terbanyak</h4>
                        <ol class="report-list">
                            ${topDiagnosa.map((item, idx) => `
                                <li>${escapeHtml(item.label || '-')} <span class="report-count">${item.value}x</span></li>
                            `).join('')}
                        </ol>
                    </div>
                    <div class="report-col">
                        <h4><i class="bi bi-pie-chart"></i> Distribusi Gender</h4>
                        <div class="report-gender-bars">
                            ${Object.entries(genderData).map(([key, val]) => `
                                <div class="report-gender-bar">
                                    <div class="report-gender-label">${escapeHtml(key)}</div>
                                    <div class="report-gender-fill" style="width: ${val.percent}%;">
                                        <span class="report-gender-value">${val.count}</span>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>

                <div class="report-full">
                    <h4><i class="bi bi-diagram-3"></i> Top Departemen (Jumlah Kunjungan)</h4>
                    <table class="report-table">
                        <thead>
                            <tr>
                                <th>Departemen</th>
                                <th>Jumlah Kunjungan</th>
                                <th>% dari Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${deptData.map(item => {
                                const pct = ((item.value / totalKunjungan) * 100).toFixed(1);
                                return `
                                    <tr>
                                        <td>${escapeHtml(item.label)}</td>
                                        <td style="text-align: center;">${item.value}</td>
                                        <td style="text-align: center;">${pct}%</td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        return html;
    },

    _generateBerobatQualitative(total, pasien, istirahat, hariIst, genderData) {
        const istirahatPct = ((istirahat / total) * 100).toFixed(1);
        const avgHariIst = total > 0 ? (hariIst / total).toFixed(1) : 0;
        const genderDesc = Object.entries(genderData)
            .sort((a, b) => b[1].count - a[1].count)
            .map(([key, val]) => `${key} (${val.count}, ${val.percent}%)`)
            .join(' dan ');

        const avgKunjungan = pasien > 0 ? (total / pasien).toFixed(1) : '0';
        return `
            <p>
                Selama periode laporan, tercatat <strong>${total} kunjungan</strong> yang melibatkan <strong>${pasien} pasien unik</strong>. 
                Rata-rata jumlah kunjungan per pasien adalah <strong>${avgKunjungan} kali</strong>.
            </p>
            <p>
                Sebanyak <strong>${istirahat} kasus (${istirahatPct}%)</strong> memerlukan istirahat kerja dengan total <strong>${hariIst} hari</strong> istirahat. 
                Rata-rata durasi istirahat per kasus adalah <strong>${avgHariIst} hari</strong>.
            </p>
            <p>
                Dari segi demografi, distribusi pasien menurut jenis kelamin adalah: <strong>${genderDesc}</strong>.
            </p>
        `;
    },

    // Comparison with previous month - IMPROVED LOGIC: Turun = Positif, Naik = Evaluasi
    _generateMonthComparison(filters) {
        const currentMonth = parseInt(filters.bulan);
        const currentYear = parseInt(filters.tahun);
        let prevMonth = currentMonth - 1;
        let prevYear = currentYear;

        if (prevMonth < 1) {
            prevMonth = 12;
            prevYear--;
        }

        // Get previous month data from rawData
        const prevData = app.rawData.filter(r => {
            if (app.unit && r.Perusahaan && r.Perusahaan !== app.unit) return false;
            const parsed = parseDateString(r.Tanggal);
            return parsed.m === prevMonth && parsed.y === prevYear && r._type === 'Berobat';
        });

        const currentBerobatData = app.filtered.filter(r => r._type === 'Berobat');
        const prevCount = prevData.length;
        const currCount = currentBerobatData.length;
        const change = currCount - prevCount;
        const changePercent = prevCount > 0 ? ((change / prevCount) * 100).toFixed(1) : 0;
        
        // NEW LOGIC: Penurunan = Positif, Peningkatan = Perlu Evaluasi
        let arrow, arrowColor, interpretation;
        if (change < 0) {
            arrow = '↓';
            arrowColor = 'var(--green)';
            interpretation = `<strong style="color: var(--green);">Penurunan (Positif)</strong> - Menunjukkan pengurangan kasus sakit atau peningkatan keselamatan kerja yang lebih baik.`;
        } else if (change > 0) {
            arrow = '↑';
            arrowColor = 'var(--red)';
            interpretation = `<strong style="color: var(--red);">Peningkatan (Perlu Evaluasi)</strong> - Perlu investigasi lebih lanjut untuk memahami penyebab kenaikan insiden.`;
        } else {
            arrow = '→';
            arrowColor = 'var(--text-secondary)';
            interpretation = `<strong>Stabil</strong> - Aktivitas layanan kesehatan tetap konsisten dengan bulan sebelumnya.`;
        }

        return `
            <div class="report-section">
                <div class="report-section-header">
                    <i class="bi bi-calendar-month"></i>
                    <h3>Perbandingan dengan Bulan Sebelumnya</h3>
                </div>

                <div class="report-comparison-grid">
                    <div class="report-comparison-item prev-month">
                        <div class="comparison-period">${this._formatMonth(prevMonth.toString())} ${prevYear}</div>
                        <div class="comparison-value">${prevCount}</div>
                        <div class="comparison-label">Kunjungan</div>
                    </div>
                    <div class="report-comparison-item current-month">
                        <div class="comparison-period">${this._formatMonth(filters.bulan)} ${filters.tahun}</div>
                        <div class="comparison-value">${currCount}</div>
                        <div class="comparison-label">Kunjungan</div>
                    </div>
                    <div class="report-comparison-item change-stat">
                        <div class="comparison-change" style="color: ${arrowColor}; font-size: 24px;">
                            <span>${arrow}</span> ${Math.abs(change)}
                        </div>
                        <div class="comparison-label" style="color: ${arrowColor};">
                            ${Math.abs(changePercent)}% ${change > 0 ? 'naik' : change < 0 ? 'turun' : 'stabil'}
                        </div>
                    </div>
                </div>

                <div class="report-analysis">
                    <h4>Analisis Perbandingan</h4>
                    <p>${interpretation}</p>
                </div>
            </div>
        `;
    },

    // Visit time analysis
    _generateVisitTimeAnalysis(data) {
        const timeCategories = {
            'Pagi (06:00-11:59)': 0,
            'Siang (12:00-17:59)': 0,
            'Malam (18:00-23:59)': 0,
            'Dini Hari (00:00-05:59)': 0
        };

        data.forEach(r => {
            if (!r.Waktu) return;
            const parts = String(r.Waktu).trim().split(':');
            if (parts.length < 2) return;
            const hour = parseInt(parts[0], 10);
            if (isNaN(hour)) return;

            if (hour >= 6 && hour < 12) timeCategories['Pagi (06:00-11:59)']++;
            else if (hour >= 12 && hour < 18) timeCategories['Siang (12:00-17:59)']++;
            else if (hour >= 18 && hour < 24) timeCategories['Malam (18:00-23:59)']++;
            else timeCategories['Dini Hari (00:00-05:59)']++;
        });

        const total = Object.values(timeCategories).reduce((a, b) => a + b, 0);
        const topTimeEntries = Object.entries(timeCategories)
            .filter(([_, v]) => v > 0)
            .sort((a, b) => b[1] - a[1]);
        const topTime = topTimeEntries[0];

        if (!topTime || total === 0) {
            return `
                <div class="report-section">
                    <div class="report-section-header">
                        <i class="bi bi-clock"></i>
                        <h3>Analisis Waktu Kunjungan</h3>
                    </div>
                    <div class="report-analysis"><p>Tidak ada data waktu kunjungan yang tersedia.</p></div>
                </div>
            `;
        }

        return `
            <div class="report-section">
                <div class="report-section-header">
                    <i class="bi bi-clock"></i>
                    <h3>Analisis Waktu Kunjungan</h3>
                </div>

                <div class="report-time-distribution">
                    ${topTimeEntries.map(([time, count]) => {
                        const pct = ((count / total) * 100).toFixed(1);
                        return `
                            <div class="report-time-item">
                                <div class="report-time-label">${escapeHtml(time)}</div>
                                <div class="report-time-bar-container">
                                    <div class="report-time-bar" style="width: ${pct}%; background: ${this._getTimeColor(time)};">
                                        <span class="report-time-count">${count}</span>
                                    </div>
                                </div>
                                <div class="report-time-percent">${pct}%</div>
                            </div>
                        `;
                    }).join('')}
                </div>

                <div class="report-analysis">
                    <h4>Insight Waktu Kunjungan</h4>
                    <p>
                        Periode <strong>${topTime[0]}</strong> menjadi waktu puncak kunjungan dengan <strong>${topTime[1]} kunjungan (${((topTime[1] / total) * 100).toFixed(1)}%)</strong>.
                        Hal ini penting untuk perencanaan alokasi SDM dan ketersediaan fasilitas kesehatan.
                    </p>
                </div>
            </div>
        `;
    },

    // Get time color
    _getTimeColor(time) {
        if (time.includes('Pagi')) return '#3b82f6';       // Blue
        if (time.includes('Siang')) return '#f97316';      // Orange
        if (time.includes('Malam')) return '#7c3aed';      // Purple
        return '#94a3b8';                                   // Gray
    },

    // Date distribution analysis
    _generateDateDistribution(data) {
        const dateCount = {};
        data.forEach(r => {
            if (!r.Tanggal) return;
            const day = extractDayFromDate(r.Tanggal);
            if (day) dateCount[day] = (dateCount[day] || 0) + 1;
        });

        const sorted = Object.entries(dateCount)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10);

        if (sorted.length === 0) {
            return `
                <div class="report-section">
                    <div class="report-section-header">
                        <i class="bi bi-calendar-event"></i>
                        <h3>Distribusi Kunjungan per Tanggal</h3>
                    </div>
                    <div class="report-analysis"><p>Tidak ada data tanggal kunjungan yang tersedia.</p></div>
                </div>
            `;
        }

        const maxDay = sorted[0];
        const avgPerDay = (data.length / 31).toFixed(1);

        return `
            <div class="report-section">
                <div class="report-section-header">
                    <i class="bi bi-calendar-event"></i>
                    <h3>Distribusi Kunjungan per Tanggal (Top 10)</h3>
                </div>

                <div class="report-date-stats">
                    <div class="report-date-stat-item">
                        <div class="report-date-stat-label">Tanggal Puncak</div>
                        <div class="report-date-stat-value">${maxDay[0]}</div>
                        <div class="report-date-stat-count">${maxDay[1]} kunjungan</div>
                    </div>
                    <div class="report-date-stat-item">
                        <div class="report-date-stat-label">Rata-rata per Hari</div>
                        <div class="report-date-stat-value">${avgPerDay}</div>
                        <div class="report-date-stat-count">kunjungan/hari</div>
                    </div>
                </div>

                <div class="report-full">
                    <h4><i class="bi bi-bar-chart"></i> Top 10 Tanggal Terbanyak Kunjungan</h4>
                    <table class="report-table">
                        <thead>
                            <tr>
                                <th>Tanggal</th>
                                <th>Jumlah Kunjungan</th>
                                <th>% dari Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${sorted.map(([date, count]) => {
                                const pct = ((count / data.length) * 100).toFixed(1);
                                return `
                                    <tr>
                                        <td><strong>${date}</strong></td>
                                        <td style="text-align: center;">${count}</td>
                                        <td style="text-align: center;">${pct}%</td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    },

    // Medicine analysis - IMPROVED: Menampilkan Total Diberikan Kepada Pasien
    _generateMedicineAnalysis(dataObat, filters, berobatData) {
        if (!dataObat || dataObat.length === 0) {
            return '';
        }

        // dataObat is already filtered by app.apply(), use directly
        const periodObat = dataObat;

        if (periodObat.length === 0) {
            return '';
        }

        // Get top 3 medicines by total quantity
        const medicineTotals = {};
        const medicinePatients = {}; // Track unique patients per medicine
        
        periodObat.forEach(r => {
            const name = (r['Nama Obat'] || '').trim();
            const jumlah = parseFloat(r['Jumlah Obat']) || 0;
            const namaPasien = (r.Nama || '').trim();
            
            if (name && name !== '-') {
                medicineTotals[name] = (medicineTotals[name] || 0) + jumlah;
                if (!medicinePatients[name]) medicinePatients[name] = new Set();
                if (namaPasien) medicinePatients[name].add(namaPasien);
            }
        });

        const topMedicines = Object.entries(medicineTotals)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3);

        const totalObat = Object.values(medicineTotals).reduce((a, b) => a + b, 0);

        return `
            <div class="report-section">
                <div class="report-section-header">
                    <i class="bi bi-pill"></i>
                    <h3>Top 3 Obat - Total Diberikan Kepada Pasien</h3>
                </div>

                <div class="report-medicine-grid">
                    ${topMedicines.map((item, idx) => {
                        const pct = ((item[1] / totalObat) * 100).toFixed(1);
                        const uniquePatients = medicinePatients[item[0]]?.size || 0;
                        const rank = idx + 1;
                        const medals = ['🥇', '🥈', '🥉'];
                        return `
                            <div class="report-medicine-card rank-${rank}">
                                <div class="medicine-rank">${medals[idx] || rank}</div>
                                <div class="medicine-name">${escapeHtml(item[0])}</div>
                                <div class="medicine-quantity">${item[1].toFixed(0)} unit</div>
                                <div class="medicine-patients">${uniquePatients} pasien</div>
                                <div class="medicine-percent">${pct}% dari total</div>
                            </div>
                        `;
                    }).join('')}
                </div>

                <div class="report-full">
                    <h4><i class="bi bi-bag-check"></i> Ringkasan Penggunaan Obat</h4>
                    <div class="report-medicine-summary">
                        <p><strong>Total Obat Digunakan:</strong> ${totalObat.toFixed(0)} unit</p>
                        <p><strong>Jenis Obat:</strong> ${Object.keys(medicineTotals).length} jenis</p>
                        <p><strong>Top 3 Obat menyumbang:</strong> ${((topMedicines.reduce((s, m) => s + m[1], 0) / totalObat) * 100).toFixed(1)}% dari total penggunaan obat</p>
                    </div>
                </div>
            </div>
        `;
    },

    _generateKecelakaanAnalysis(data) {
        const totalKecelakaan = data.length;
        const uniqueKorban = new Set(data.map(r => r.Nama).filter(Boolean)).size;
        const uniqueLokasi = new Set(data.map(r => r['Lokasi Kejadian']).filter(Boolean)).size;
        const topLokasi = this._getTopItems(data, 'Lokasi Kejadian', 5);

        const html = `
            <div class="report-section">
                <div class="report-section-header">
                    <i class="bi bi-exclamation-triangle"></i>
                    <h3>Analisis Kecelakaan</h3>
                </div>

                <div class="report-kpi-grid">
                    <div class="report-kpi">
                        <div class="report-kpi-value">${totalKecelakaan}</div>
                        <div class="report-kpi-label">Total Kecelakaan</div>
                    </div>
                    <div class="report-kpi">
                        <div class="report-kpi-value">${uniqueKorban}</div>
                        <div class="report-kpi-label">Korban Unik</div>
                    </div>
                    <div class="report-kpi">
                        <div class="report-kpi-value">${uniqueLokasi}</div>
                        <div class="report-kpi-label">Lokasi Kejadian</div>
                    </div>
                </div>

                <div class="report-analysis">
                    <h4>Ringkasan Kualitatif</h4>
                    ${this._generateKecelakaanQualitative(totalKecelakaan, uniqueKorban, uniqueLokasi, topLokasi)}
                </div>

                <div class="report-full">
                    <h4><i class="bi bi-geo-alt"></i> Lokasi Kejadian Terbanyak</h4>
                    <ol class="report-list">
                        ${topLokasi.map(item => `
                            <li>${escapeHtml(item.label || '-')} <span class="report-count">${item.value}x</span></li>
                        `).join('')}
                    </ol>
                </div>
            </div>
        `;

        return html;
    },

    _generateKecelakaanQualitative(total, korban, lokasi, topLokasi) {
        const topLokStr = topLokasi.length > 0 
            ? `<strong>${escapeHtml(topLokasi[0].label)}</strong> menjadi lokasi dengan insiden terbanyak`
            : 'Lokasi kejadian tersebar di berbagai tempat';

        return `
            <p>
                Tercatat <strong>${total} kejadian kecelakaan</strong> yang menimpa <strong>${korban} korban unik</strong> di <strong>${lokasi} lokasi berbeda</strong>.
            </p>
            <p>
                ${topLokStr}. Hal ini menunjukkan pola risiko keselamatan kerja yang perlu menjadi fokus pencegahan.
            </p>
        `;
    },

    _generateKonsultasiAnalysis(data) {
        const totalKonsultasi = data.length;
        const uniqueKlien = new Set(data.map(r => r.Nama).filter(Boolean)).size;

        const html = `
            <div class="report-section">
                <div class="report-section-header">
                    <i class="bi bi-chat-dots"></i>
                    <h3>Analisis Konsultasi</h3>
                </div>

                <div class="report-kpi-grid">
                    <div class="report-kpi">
                        <div class="report-kpi-value">${totalKonsultasi}</div>
                        <div class="report-kpi-label">Total Konsultasi</div>
                    </div>
                    <div class="report-kpi">
                        <div class="report-kpi-value">${uniqueKlien}</div>
                        <div class="report-kpi-label">Klien Unik</div>
                    </div>
                </div>

                <div class="report-analysis">
                    <h4>Ringkasan Kualitatif</h4>
                    ${this._generateKonsultasiQualitative(totalKonsultasi, uniqueKlien)}
                </div>
            </div>
        `;

        return html;
    },

    _generateKonsultasiQualitative(total, klien) {
        const rataRata = klien > 0 ? (total / klien).toFixed(1) : '0';
        return `
            <p>
                Selama periode laporan, layanan konsultasi mencatat <strong>${total} kunjungan</strong> dari <strong>${klien} klien unik</strong>, 
                dengan rata-rata <strong>${rataRata} konsultasi per klien</strong>.
            </p>
            <p>
                Data ini menunjukkan tingkat keterlibatan klien dalam layanan konsultasi kesehatan kerja.
            </p>
        `;
    },

    _generateSummaryInsights(berobatData, kecelakaanData, konsultasiData) {
        const totalEvents = berobatData.length + kecelakaanData.length + konsultasiData.length;
        const berobatPct = totalEvents > 0 ? ((berobatData.length / totalEvents) * 100).toFixed(1) : 0;
        const kecelakaanPct = totalEvents > 0 ? ((kecelakaanData.length / totalEvents) * 100).toFixed(1) : 0;
        const konsultasiPct = totalEvents > 0 ? ((konsultasiData.length / totalEvents) * 100).toFixed(1) : 0;

        const html = `
            <div class="report-section">
                <div class="report-section-header">
                    <i class="bi bi-graph-up"></i>
                    <h3>Ringkasan & Insight Kunci</h3>
                </div>

                <div class="report-summary-box">
                    <div class="report-summary-stat">
                        <div class="report-summary-label">Total Laporan Periode Ini</div>
                        <div class="report-summary-value">${totalEvents}</div>
                    </div>
                    <div class="report-summary-breakdown">
                        <div class="report-summary-item">
                            <span class="report-summary-icon berobat-icon"><i class="bi bi-clipboard2-pulse"></i></span>
                            <span>Berobat: <strong>${berobatData.length}</strong> (${berobatPct}%)</span>
                        </div>
                        <div class="report-summary-item">
                            <span class="report-summary-icon kecelakaan-icon"><i class="bi bi-exclamation-triangle"></i></span>
                            <span>Kecelakaan: <strong>${kecelakaanData.length}</strong> (${kecelakaanPct}%)</span>
                        </div>
                        <div class="report-summary-item">
                            <span class="report-summary-icon konsultasi-icon"><i class="bi bi-chat-dots"></i></span>
                            <span>Konsultasi: <strong>${konsultasiData.length}</strong> (${konsultasiPct}%)</span>
                        </div>
                    </div>
                </div>

                <div class="report-insights">
                    <h4><i class="bi bi-lightbulb"></i> Insight Kunci</h4>
                    <ul>
                        ${this._generateInsights(berobatData, kecelakaanData, konsultasiData).map(insight => 
                            `<li>${insight}</li>`
                        ).join('')}
                    </ul>
                </div>
            </div>
        `;

        return html;
    },

    _generateInsights(berobatData, kecelakaanData, konsultasiData) {
        const insights = [];

        // Insight 1: Main focus
        if (berobatData.length > kecelakaanData.length && berobatData.length > konsultasiData.length) {
            insights.push(`Fokus utama adalah layanan kesehatan medis (berobat) dengan ${berobatData.length} kunjungan.`);
        }

        // Insight 2: Accident rate
        if (kecelakaanData.length > 0) {
            const injuryRate = kecelakaanData.length;
            if (injuryRate >= 5) {
                insights.push(`Tingkat kecelakaan mencapai ${injuryRate} kasus - memerlukan fokus pada pencegahan dan keselamatan kerja.`);
            } else {
                insights.push(`Tingkat kecelakaan relatif terkendali dengan ${injuryRate} kasus.`);
            }
        }

        // Insight 3: Medical leave proportion
        if (berobatData.length > 0) {
            const istirahat = berobatData.filter(r => (r['Perlu Istirahat'] || '').toLowerCase().includes('ya')).length;
            const istirahatPct = ((istirahat / berobatData.length) * 100).toFixed(1);
            if (istirahatPct > 30) {
                insights.push(`Proporsi kasus yang memerlukan istirahat kerja cukup tinggi (${istirahatPct}%) - pantau produktivitas karyawan.`);
            }
        }

        // Insight 4: Consultation engagement
        if (konsultasiData.length > 0) {
            const uniqueKlien = new Set(konsultasiData.map(r => r.Nama).filter(Boolean)).size;
            insights.push(`Keterlibatan dalam konsultasi kesehatan kerja cukup baik dengan ${uniqueKlien} klien yang aktif.`);
        }

        // Default insight if none generated
        if (insights.length === 0) {
            insights.push('Lanjutkan pemantauan kesehatan kerja secara berkala.');
        }

        return insights;
    },

    // NEW: Conclusion & Recommendations with Top 3 Diagnoses & Input Fields
    _generateConclusionRecommendations(berobatData, filters) {
        const topDiagnosa = this._getTopItems(berobatData, 'Nama Diagnosa', 3);

        return `
            <div class="report-section">
                <div class="report-section-header">
                    <i class="bi bi-award"></i>
                    <h3>Kesimpulan & Rekomendasi</h3>
                </div>

                <div class="report-conclusion">
                    <h4>Top 3 Diagnosa Terbanyak & Rekomendasi Tindakan</h4>
                    <div class="report-conclusion-items">
                        ${topDiagnosa.map((diagnosa, idx) => `
                            <div class="conclusion-item">
                                <div class="conclusion-rank">Rank ${idx + 1}</div>
                                <div class="conclusion-content">
                                    <div class="conclusion-diagnosis">
                                        <strong>${escapeHtml(diagnosa.label)}</strong>
                                        <span class="conclusion-count">${diagnosa.value} kasus</span>
                                    </div>
                                    <div class="conclusion-recommendation">
                                        <label>Rekomendasi Tindakan:</label>
                                        <textarea class="conclusion-input" placeholder="Masukkan rekomendasi untuk mengatasi diagnosa ini..." rows="2"></textarea>
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>

                <div class="report-analysis">
                    <h4>Catatan Umum</h4>
                    <p>
                        Berdasarkan data periode ${this._formatMonth(filters.bulan)} ${filters.tahun}, 
                        ketiga diagnosa di atas menunjukkan pola kesehatan dominan di unit kerja ini. 
                        Implementasi rekomendasi tindakan di atas diharapkan dapat mengurangi insiden serupa pada periode mendatang.
                    </p>
                </div>
            </div>
        `;
    },

    // Helper: Get top items by frequency
    _getTopItems(data, field, limit = 5) {
        const count = {};
        data.forEach(r => {
            const val = r[field];
            if (!val || val === '-' || val === '') return;
            count[val] = (count[val] || 0) + 1;
        });
        const sorted = Object.entries(count)
            .sort((a, b) => b[1] - a[1])
            .slice(0, limit);
        return sorted.map(([label, value]) => ({ label, value }));
    },

    // Helper: Gender breakdown
    _getGenderBreakdown(data) {
        const counts = { 'Laki-laki': 0, 'Perempuan': 0, 'Lainnya': 0 };
        data.forEach(r => {
            const g = (r['Jenis Kelamin'] || '').toLowerCase();
            if (g.includes('laki')) counts['Laki-laki']++;
            else if (g.includes('perempuan')) counts['Perempuan']++;
            else if (g !== '') counts['Lainnya']++;
        });
        const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1;
        const result = {};
        Object.entries(counts).forEach(([key, val]) => {
            if (val > 0) {
                result[key] = {
                    count: val,
                    percent: ((val / total) * 100).toFixed(1)
                };
            }
        });
        return result;
    },

    // Helper: Department breakdown
    _getDeptBreakdown(data, limit = 5) {
        const count = {};
        data.forEach(r => {
            const dept = r.Departemen || 'Tidak diketahui';
            count[dept] = (count[dept] || 0) + 1;
        });
        const sorted = Object.entries(count)
            .sort((a, b) => b[1] - a[1])
            .slice(0, limit);
        return sorted.map(([label, value]) => ({ label, value }));
    },

    // Export to PDF with A4 size and full styling
    exportPDF() {
        const filters = downloadReport.getFilterState();
        const filename = `IHC_Report_${filters.tahun}-${filters.bulan}.pdf`;
        
        const panel = el('panel-Download');
        if (!panel) {
            app.showToast('Panel tidak ditemukan', 'error');
            return;
        }

        const printWindow = window.open('', '', 'width=850,height=1100');
        const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>Laporan IHC Klinik</title>
                <style>
                    :root {
                        --mono-0: #ffffff;
                        --mono-1: #f8fafc;
                        --mono-2: #f1f5f9;
                        --mono-3: #e2e8f0;
                        --mono-4: #cbd5e1;
                        --mono-5: #94a3b8;
                        --mono-6: #64748b;
                        --mono-9: #1e293b;
                        --mono-10: #0f172a;
                        --navy: #1e293b;
                        --navy-light: #dbeafe;
                        --navy-dark: #1e40af;
                        --orange: #f97316;
                        --orange-light: #fff7ed;
                        --orange-dark: #ea580c;
                        --red: #ef4444;
                        --green: #22c55e;
                        --blue: #3b82f6;
                        --yellow: #eab308;
                        --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
                        --border-light: #e2e8f0;
                    }
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    @page { size: A4; margin: 15mm; }
                    @media print { 
                        body { margin: 0; padding: 15mm; size: A4; }
                        .report-section { page-break-inside: avoid; }
                    }
                    body { 
                        font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                        line-height: 1.6;
                        color: var(--mono-9);
                        background: white;
                        padding: 15mm;
                    }
                    h2 { font-size: 20px; font-weight: 700; margin: 15px 0; border-bottom: 2px solid var(--orange); padding-bottom: 10px; }
                    h3 { font-size: 15px; font-weight: 700; margin: 12px 0 8px; color: var(--navy); }
                    h4 { font-size: 12px; font-weight: 700; margin: 8px 0 6px; color: var(--mono-9); }
                    p { font-size: 11px; margin: 6px 0; line-height: 1.5; color: var(--mono-6); }
                    table { width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 10px; }
                    th { background: var(--navy); color: white; padding: 7px; text-align: left; font-weight: 600; border: none; }
                    td { border: 1px solid var(--border-light); padding: 5px 7px; color: var(--mono-6); }
                    tr:nth-child(even) { background: var(--mono-2); }
                    .report-section { margin-bottom: 15px; padding: 12px; background: white; border: 1px solid var(--border-light); border-radius: 4px; }
                    .report-header { margin-bottom: 15px; padding: 12px; background: linear-gradient(135deg, var(--navy-light), var(--mono-2)); border-left: 4px solid var(--orange); border-radius: 4px; }
                    .report-title { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
                    .report-title h2 { margin: 0; border: none; padding: 0; }
                    .report-meta { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; font-size: 10px; }
                    .report-meta p { margin: 0; }
                    .report-kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin: 10px 0; }
                    .report-kpi { padding: 10px; background: var(--mono-2); border-radius: 4px; text-align: center; border: 1px solid var(--border-light); }
                    .report-kpi-value { font-size: 20px; font-weight: 700; color: var(--orange); }
                    .report-kpi-label { font-size: 9px; color: var(--mono-6); margin-top: 3px; }
                    .report-analysis { margin: 10px 0; padding: 10px; background: var(--mono-1); border-left: 3px solid var(--blue); border-radius: 4px; }
                    .report-analysis p { margin: 5px 0; font-size: 10px; }
                    .report-section-header { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; padding-bottom: 8px; border-bottom: 2px solid var(--orange); }
                    .report-section-header i { font-size: 14px; color: var(--orange); }
                    .report-two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 10px 0; }
                    .report-col { padding: 10px; background: var(--mono-2); border-radius: 4px; }
                    .report-col h4 { font-size: 11px; margin: 0 0 8px; display: flex; align-items: center; gap: 4px; }
                    .report-list { list-style: decimal-leading-zero inside; margin: 5px 0; padding: 0; }
                    .report-list li { padding: 3px 0; font-size: 10px; }
                    .report-count { background: var(--orange); color: white; padding: 1px 4px; border-radius: 2px; font-size: 8px; margin-left: 4px; }
                    .report-gender-bars { display: flex; flex-direction: column; gap: 6px; }
                    .report-gender-bar { display: flex; flex-direction: column; gap: 2px; }
                    .report-gender-label { font-size: 9px; font-weight: 600; }
                    .report-gender-fill { background: linear-gradient(90deg, var(--orange), var(--navy)); height: 18px; border-radius: 3px; display: flex; align-items: center; justify-content: flex-end; padding-right: 6px; }
                    .report-gender-value { font-size: 9px; font-weight: 600; color: white; }
                    .report-full { margin: 10px 0; padding: 10px; background: var(--mono-2); border-radius: 4px; }
                    .report-full h4 { margin: 0 0 8px; display: flex; align-items: center; gap: 4px; }
                    .report-comparison-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin: 10px 0; }
                    .report-comparison-item { padding: 10px; border: 1px solid var(--border-light); border-radius: 4px; text-align: center; background: var(--mono-1); }
                    .report-comparison-item.current-month { background: linear-gradient(135deg, var(--navy-light), var(--mono-2)); border-color: var(--orange); }
                    .comparison-value { font-size: 22px; font-weight: 700; color: var(--navy); margin: 5px 0; }
                    .comparison-period { font-size: 9px; color: var(--mono-6); text-transform: uppercase; }
                    .comparison-label { font-size: 10px; color: var(--mono-6); margin-top: 5px; }
                    .report-time-distribution { display: flex; flex-direction: column; gap: 8px; margin: 10px 0; }
                    .report-time-item { display: flex; gap: 8px; align-items: center; }
                    .report-time-label { font-size: 10px; font-weight: 600; min-width: 130px; }
                    .report-time-bar-container { flex: 1; background: var(--border-light); border-radius: 2px; height: 20px; overflow: hidden; }
                    .report-time-bar { height: 100%; display: flex; align-items: center; justify-content: center; color: white; font-weight: 600; font-size: 9px; }
                    .report-medicine-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin: 10px 0; }
                    .report-medicine-card { padding: 10px; background: var(--mono-1); border: 1px solid var(--border-light); border-radius: 4px; text-align: center; }
                    .medicine-rank { font-size: 18px; margin-bottom: 4px; }
                    .medicine-name { font-size: 10px; font-weight: 600; margin-bottom: 3px; }
                    .medicine-quantity { font-size: 14px; font-weight: 700; color: var(--orange); }
                    .medicine-patients { font-size: 9px; color: var(--mono-6); }
                    .medicine-percent { font-size: 9px; color: var(--mono-6); margin-top: 2px; }
                    .report-summary-box { padding: 12px; background: linear-gradient(135deg, var(--navy-light), var(--mono-2)); border: 1px solid var(--border-light); border-radius: 4px; margin: 10px 0; }
                    .report-summary-stat { text-align: center; margin-bottom: 10px; }
                    .report-summary-value { font-size: 28px; font-weight: 700; color: var(--orange); }
                    .report-summary-breakdown { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
                    .report-summary-item { padding: 8px; background: white; border-radius: 3px; font-size: 10px; display: flex; align-items: center; gap: 6px; }
                    .report-summary-icon { width: 24px; height: 24px; border-radius: 3px; display: flex; align-items: center; justify-content: center; font-size: 12px; }
                    .berobat-icon { background: var(--orange-light); color: var(--orange-dark); }
                    .kecelakaan-icon { background: #fee2e2; color: var(--red); }
                    .konsultasi-icon { background: #fef3c7; color: var(--yellow); }
                    .report-insights { padding: 10px; background: var(--mono-2); border-left: 3px solid var(--green); border-radius: 4px; margin: 10px 0; }
                    .report-insights ul { list-style: none; margin: 8px 0; }
                    .report-insights li { padding: 3px 0; font-size: 10px; color: var(--mono-6); }
                    .report-insights li::before { content: "✓ "; color: var(--green); font-weight: 700; margin-right: 4px; }
                    .conclusion-item { padding: 10px; background: var(--mono-1); border-left: 3px solid #7c3aed; margin-bottom: 8px; border-radius: 3px; }
                    .conclusion-rank { font-weight: 700; color: var(--orange); margin-bottom: 4px; font-size: 10px; }
                    .conclusion-diagnosis { font-size: 11px; font-weight: 600; margin-bottom: 4px; }
                    .conclusion-count { background: var(--orange); color: white; padding: 1px 4px; border-radius: 2px; font-size: 8px; margin-left: 4px; }
                    .conclusion-recommendation { font-size: 10px; margin-top: 4px; }
                    .conclusion-input { width: 100%; padding: 5px; border: 1px solid var(--border-light); border-radius: 3px; font-size: 9px; margin-top: 3px; font-family: inherit; }
                    .report-actions { display: flex; gap: 8px; margin-top: 15px; padding-top: 12px; border-top: 1px solid var(--border-light); flex-wrap: wrap; }
                    .report-btn-export { flex: 1; min-width: 120px; padding: 10px 12px; background: var(--navy); color: white; border: none; border-radius: 4px; font-size: 11px; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; transition: all 0.2s ease; }
                    .report-btn-export:hover { background: var(--navy-dark); }
                </style>
            </head>
            <body>
                ${panel.innerHTML}
            </body>
            </html>
        `;

        printWindow.document.write(htmlContent);
        printWindow.document.close();

        // Trigger print dialog
        setTimeout(() => {
            printWindow.print();
            printWindow.close();
        }, 500);

        app.showToast('PDF siap untuk diunduh. Pilih "Simpan sebagai PDF" di print dialog', 'success');
    },

    // Helper: escape nilai untuk CSV (bukan HTML escape)
    _csvVal(v) {
        if (v === null || v === undefined) return '""';
        return '"' + String(v).replace(/"/g, '""') + '"';
    },

    // Export to CSV
    exportCSV() {
        const filters = this.getFilterState();
        const filename = `IHC_Report_${filters.tahun}-${filters.bulan}.csv`;
        const c = this._csvVal.bind(this);

        let csv = 'IHC Klinik - Laporan Analisis\n';
        csv += `Unit: ${app.unit}\n`;
        csv += `Periode: ${this._formatMonth(filters.bulan)} ${filters.tahun}\n`;
        csv += `Tanggal: ${new Date().toLocaleDateString('id-ID')}\n\n`;

        const berobatData    = app.filtered.filter(r => r._type === 'Berobat');
        const kecelakaanData = app.filtered.filter(r => r._type === 'Kecelakaan');
        const konsultasiData = app.filtered.filter(r => r._type === 'Konsultasi');

        if (berobatData.length > 0) {
            csv += '\n--- DATA BEROBAT ---\n';
            csv += 'Nama,Departemen,Tanggal,Diagnosa,Istirahat,Hari Istirahat\n';
            berobatData.slice(0, 100).forEach(r => {
                csv += `${c(r.Nama)},${c(r.Departemen)},${c(r.Tanggal)},${c(r['Nama Diagnosa'])},${c(r['Perlu Istirahat'])},${c(r['Jumlah Hari Istirahat'])}\n`;
            });
        }

        if (kecelakaanData.length > 0) {
            csv += '\n--- DATA KECELAKAAN ---\n';
            csv += 'Nama,Departemen,Tanggal,Lokasi,Deskripsi Kejadian\n';
            kecelakaanData.slice(0, 100).forEach(r => {
                csv += `${c(r.Nama)},${c(r.Departemen)},${c(r.Tanggal)},${c(r['Lokasi Kejadian'])},${c(r['Deskripsi Kejadian'] || '')}\n`;
            });
        }

        if (konsultasiData.length > 0) {
            csv += '\n--- DATA KONSULTASI ---\n';
            csv += 'Nama,Departemen,Tanggal,Keluhan,Saran\n';
            konsultasiData.slice(0, 100).forEach(r => {
                csv += `${c(r.Nama)},${c(r.Departemen)},${c(r.Tanggal)},${c(r.Keluhan || '')},${c(r.Saran || '')}\n`;
            });
        }

        const BOM  = '\uFEFF'; // UTF-8 BOM agar Excel bisa baca karakter Indonesia
        const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);

        app.showToast('File CSV berhasil diunduh', 'success');
    }
};