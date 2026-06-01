const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const db = require('../db/pool');
const cloudinary = require('cloudinary').v2;
const stream = require('stream');

cloudinary.config({
  secure: true
});

async function uploadBufferToCloudinary(buffer, filename) {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { 
        resource_type: 'raw',
        public_id: filename,
        use_filename: true,
        unique_filename: false,
        flags: 'attachment'
      },
      (error, result) => {
        if (error) reject(error);
        else {
          let url = result.secure_url;
          if (url && url.includes('/raw/upload/')) {
            url = url.replace('/raw/upload/', '/raw/upload/fl_attachment/');
          }
          resolve(url);
        }
      }
    );
    const pass = new stream.PassThrough();
    pass.end(buffer);
    pass.pipe(uploadStream);
  });
}

const fs = require('fs');
const path = require('path');

function saveLocalFile(buffer, filename) {
  const tempDir = path.join(__dirname, '../../public/temp');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  const filePath = path.join(tempDir, filename);
  fs.writeFileSync(filePath, buffer);
  return `/api/download/${filename}`;
}

function setupFonts(doc) {
  const fontRegular = 'C:/Windows/Fonts/arial.ttf';
  const fontBold = 'C:/Windows/Fonts/arialbd.ttf';
  const fontItalic = 'C:/Windows/Fonts/ariali.ttf';
  
  if (fs.existsSync(fontRegular)) {
    doc.registerFont('CustomRegular', fontRegular);
  } else {
    doc.registerFont('CustomRegular', 'Helvetica');
  }
  
  if (fs.existsSync(fontBold)) {
    doc.registerFont('CustomBold', fontBold);
  } else {
    doc.registerFont('CustomBold', 'Helvetica-Bold');
  }

  if (fs.existsSync(fontItalic)) {
    doc.registerFont('CustomOblique', fontItalic);
  } else {
    doc.registerFont('CustomOblique', 'Helvetica-Oblique');
  }
}

// ── Helper: fetch all schedule data for a week ──
async function getWeekData(weekId) {
  const weekRes = await db.query(`SELECT * FROM schedule_weeks WHERE id = $1`, [weekId]);
  if (weekRes.rows.length === 0) throw new Error('Week not found');
  const week = weekRes.rows[0];

  const sessionsRes = await db.query(`
    SELECT s.*, c.code as class_code, c.class_type, r.name as room_name,
           ts.label as slot_label, ts.day_of_week, ts.start_time, ts.end_time,
           -- Main teacher
           (SELECT p.short_name FROM session_assignments sa JOIN persons p ON p.id = sa.person_id 
            WHERE sa.session_id = s.id AND sa.role IN ('lead_teacher', 'foreign_teacher', 'ta_solo') LIMIT 1) as teacher_name,
           (SELECT sa.person_id FROM session_assignments sa 
            WHERE sa.session_id = s.id AND sa.role IN ('lead_teacher', 'foreign_teacher', 'ta_solo') LIMIT 1) as person_id,
           (SELECT sa.role FROM session_assignments sa 
            WHERE sa.session_id = s.id AND sa.role IN ('lead_teacher', 'foreign_teacher', 'ta_solo') LIMIT 1) as assigned_role,
           -- Assistant / TA
           (SELECT p.short_name FROM session_assignments sa JOIN persons p ON p.id = sa.person_id 
            WHERE sa.session_id = s.id AND sa.role IN ('ta_support', 'ta_kids', 'ta_ielts') LIMIT 1) as ta_name,
           (SELECT sa.person_id FROM session_assignments sa 
            WHERE sa.session_id = s.id AND sa.role IN ('ta_support', 'ta_kids', 'ta_ielts') LIMIT 1) as ta_id,
           (SELECT sa.role FROM session_assignments sa 
            WHERE sa.session_id = s.id AND sa.role IN ('ta_support', 'ta_kids', 'ta_ielts') LIMIT 1) as assigned_ta_role
    FROM sessions s
    LEFT JOIN classes c ON c.id = s.class_id
    LEFT JOIN rooms r ON r.id = s.room_id
    LEFT JOIN time_slots ts ON ts.id = s.time_slot_id
    WHERE s.week_id = $1
    ORDER BY ts.day_of_week, ts.start_time, r.name
  `, [weekId]);

  const roomsRes = await db.query(`SELECT * FROM rooms WHERE is_active = true ORDER BY name`);
  const slotsRes = await db.query(`SELECT * FROM time_slots WHERE is_active = true ORDER BY day_of_week, start_time`);

  return { week, sessions: sessionsRes.rows, rooms: roomsRes.rows, slots: slotsRes.rows };
}

const DAY_NAMES = { 2: 'Thứ 2', 3: 'Thứ 3', 4: 'Thứ 4', 5: 'Thứ 5', 6: 'Thứ 6', 7: 'Thứ 7', 8: 'CN' };

// ══════════════════════════════════════════════════════
// ██  EXCEL EXPORT
// ══════════════════════════════════════════════════════
exports.exportExcel = async (req, res, next) => {
  try {
    const { week, sessions, rooms, slots } = await getWeekData(req.params.id);
    const startDate = new Date(week.week_start);
    const d = String(startDate.getDate()).padStart(2, '0');
    const m = String(startDate.getMonth() + 1).padStart(2, '0');
    const year = startDate.getFullYear();
    const weekLabel = `${d}/${m}/${year}`;
    const fileWeekLabel = `${d}-${m}-${year}`;

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'LotusTime';
    workbook.created = new Date();

    const ws = workbook.addWorksheet('Thời Khóa Biểu', {
      views: [{ state: 'frozen', xSplit: 1, ySplit: 6 }]
    });

    // ── Title block (Rows 1-3) ──
    ws.mergeCells(1, 1, 1, 1 + 7 * rooms.length);
    const titleCell = ws.getCell('A1');
    titleCell.value = 'LOTUS ENGLISH CENTER';
    titleCell.font = { name: 'Arial', size: 16, bold: true, color: { argb: 'FF1B365D' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(1).height = 30;

    ws.mergeCells(2, 1, 2, 1 + 7 * rooms.length);
    const subtitleCell = ws.getCell('A2');
    subtitleCell.value = 'THỜI KHÓA BIỂU HỌC TẬP & GIẢNG DẠY';
    subtitleCell.font = { name: 'Arial', size: 12, bold: true, color: { argb: 'FF555555' } };
    subtitleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(2).height = 20;

    ws.mergeCells(3, 1, 3, 1 + 7 * rooms.length);
    const infoCell = ws.getCell('A3');
    infoCell.value = `Tuần: ${weekLabel} (Trạng thái: ${week.status.toUpperCase()})`;
    infoCell.font = { name: 'Arial', size: 11, italic: true, color: { argb: 'FF777777' } };
    infoCell.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(3).height = 20;

    // Row 4 is spacer
    ws.getRow(4).height = 10;

    // Set up Column 1: Time
    ws.getColumn(1).width = 16;
    const timeHeaderCell = ws.getCell(6, 1);
    timeHeaderCell.value = 'Thời gian';
    timeHeaderCell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF333333' } };
    timeHeaderCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
    timeHeaderCell.alignment = { horizontal: 'center', vertical: 'middle' };
    timeHeaderCell.border = {
      top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      bottom: { style: 'medium', color: { argb: 'FF94A3B8' } },
      right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
    };

    const days = [2, 3, 4, 5, 6, 7, 8];

    days.forEach((day, dayIdx) => {
      const startCol = 2 + dayIdx * rooms.length;
      const endCol = startCol + rooms.length - 1;

      // Calculate Date of Day
      const weekStart = new Date(week.week_start);
      const dayDate = new Date(weekStart);
      dayDate.setDate(weekStart.getDate() + (day - 2));
      const dateStr = dayDate.toLocaleDateString('vi-VN');

      // Day Header
      ws.mergeCells(5, startCol, 5, endCol);
      const dayCell = ws.getCell(5, startCol);
      dayCell.value = `${DAY_NAMES[day].toUpperCase()} (${dateStr})`;
      dayCell.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
      dayCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1B365D' } };
      dayCell.alignment = { horizontal: 'center', vertical: 'middle' };
      
      // Border for merged day header
      for (let c = startCol; c <= endCol; c++) {
        const cCell = ws.getCell(5, c);
        cCell.border = {
          top: { style: 'medium', color: { argb: 'FF1B365D' } },
          bottom: { style: 'medium', color: { argb: 'FF1B365D' } },
          left: c === startCol ? { style: 'medium', color: { argb: 'FF0F172A' } } : { style: 'thin', color: { argb: 'FF475569' } },
          right: c === endCol ? { style: 'medium', color: { argb: 'FF0F172A' } } : { style: 'thin', color: { argb: 'FF475569' } }
        };
      }

      // Room Headers
      rooms.forEach((room, roomIdx) => {
        const col = startCol + roomIdx;
        ws.getColumn(col).width = 18;
        const cell = ws.getCell(6, col);
        cell.value = room.name;
        cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF1E293B' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          bottom: { style: 'medium', color: { argb: 'FF94A3B8' } },
          left: col === startCol ? { style: 'medium', color: { argb: 'FF0F172A' } } : { style: 'thin', color: { argb: 'FFCBD5E1' } },
          right: col === endCol ? { style: 'medium', color: { argb: 'FF0F172A' } } : { style: 'thin', color: { argb: 'FFCBD5E1' } }
        };
      });
    });

    ws.getRow(5).height = 26;
    ws.getRow(6).height = 24;

    // ── Data Rows ──
    const uniqueTimeRanges = [];
    const seenRanges = new Set();
    for (const s of slots) {
      const rangeKey = `${s.start_time}-${s.end_time}`;
      if (!seenRanges.has(rangeKey)) {
        seenRanges.add(rangeKey);
        uniqueTimeRanges.push({ start_time: s.start_time, end_time: s.end_time });
      }
    }
    uniqueTimeRanges.sort((a, b) => a.start_time.localeCompare(b.start_time));

    let rowIdx = 7;
    for (const range of uniqueTimeRanges) {
      const row = ws.getRow(rowIdx);
      row.height = 45;

      // Time cell
      const timeStr = `${range.start_time.slice(0, 5)} - ${range.end_time.slice(0, 5)}`;
      const timeCell = row.getCell(1);
      timeCell.value = timeStr;
      timeCell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF333333' } };
      timeCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F3F5' } };
      timeCell.alignment = { horizontal: 'center', vertical: 'middle' };
      timeCell.border = {
        top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        right: { style: 'medium', color: { argb: 'FF94A3B8' } }
      };

      days.forEach((day, dayIdx) => {
        const startCol = 2 + dayIdx * rooms.length;
        const endCol = startCol + rooms.length - 1;

        rooms.forEach((room, roomIdx) => {
          const col = startCol + roomIdx;
          const cell = row.getCell(col);

          const session = sessions.find(s => 
            s.day_of_week === day && 
            s.start_time === range.start_time && 
            s.room_id === room.id
          );

          if (session) {
            const lines = [session.class_code];
            const tDisplay = [session.teacher_name, session.ta_name].filter(Boolean).join(' + ');
            if (tDisplay) lines.push(tDisplay);
            cell.value = lines.join('\n');
            cell.alignment = { wrapText: true, horizontal: 'center', vertical: 'middle' };
            cell.font = { name: 'Arial', size: 9.5, bold: true };
            
            if (session.is_pinned) {
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFCE4EC' } };
              cell.font.color = { argb: 'FFC2185B' };
            } else {
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F5E9' } };
              cell.font.color = { argb: 'FF2E7D32' };
            }
          } else {
            cell.value = '';
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
          }

          cell.border = {
            top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            left: col === startCol ? { style: 'medium', color: { argb: 'FF0F172A' } } : { style: 'thin', color: { argb: 'FFE2E8F0' } },
            right: col === endCol ? { style: 'medium', color: { argb: 'FF0F172A' } } : { style: 'thin', color: { argb: 'FFE2E8F0' } }
          };
        });
      });

      rowIdx++;
    }

    // Row bottom border for last row
    const lastRow = ws.getRow(rowIdx - 1);
    for (let c = 1; c <= 1 + 7 * rooms.length; c++) {
      const cell = lastRow.getCell(c);
      cell.border = {
        ...(cell.border || {}),
        bottom: { style: 'medium', color: { argb: 'FF0F172A' } }
      };
    }

    // ── Footer ──
    rowIdx++;
    ws.mergeCells(rowIdx, 1, rowIdx, 1 + 7 * rooms.length);
    const footerCell = ws.getCell(rowIdx, 1);
    footerCell.value = `Xuất bởi LotusTime — ${new Date().toLocaleString('vi-VN')}`;
    footerCell.font = { name: 'Arial', size: 9, italic: true, color: { argb: 'FF999999' } };

    // ── Send ──
    const sanitizedFilename = `TKB_Tuan_${fileWeekLabel}.xlsx`;
    const buffer = await workbook.xlsx.writeBuffer();
    const downloadUrl = await uploadBufferToCloudinary(buffer, sanitizedFilename);
    res.json({ url: downloadUrl });

  } catch (err) { next(err); }
};

// ══════════════════════════════════════════════════════
// ██  PDF EXPORT
// ══════════════════════════════════════════════════════
exports.exportPdf = async (req, res, next) => {
  try {
    const { week, sessions, rooms, slots } = await getWeekData(req.params.id);
    const startDate = new Date(week.week_start);
    const d = String(startDate.getDate()).padStart(2, '0');
    const m = String(startDate.getMonth() + 1).padStart(2, '0');
    const year = startDate.getFullYear();
    const weekLabel = `${d}/${m}/${year}`;
    const fileWeekLabel = `${d}-${m}-${year}`;

    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 30 });
    setupFonts(doc);

    const sanitizedFilename = `TKB_Tuan_${fileWeekLabel}.pdf`;
    
    const buffers = [];
    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', async () => {
      try {
        const pdfBuffer = Buffer.concat(buffers);
        const downloadUrl = await uploadBufferToCloudinary(pdfBuffer, sanitizedFilename);
        res.json({ url: downloadUrl });
      } catch (err) {
        next(err);
      }
    });

    // ── Title ──
    doc.fontSize(16).font('CustomBold')
       .fillColor('#76b900')
       .text(`THỜI KHÓA BIỂU – Tuần ${weekLabel}`, { align: 'center' });
    doc.moveDown(0.3);
    doc.fontSize(9).font('CustomRegular').fillColor('#999')
       .text(`Anh ngữ Lotus • Xuất bởi LotusTime`, { align: 'center' });
    doc.moveDown(0.8);

    // ── Table Setup ──
    const tableLeft = 30;
    const colWidth0 = 80; // Time column
    const availableWidth = doc.page.width - 60 - colWidth0;
    const colWidth = Math.min(availableWidth / rooms.length, 120);
    const rowHeight = 36;
    const headerHeight = 24;
    let y = doc.y;

    // ── Header ──
    doc.rect(tableLeft, y, colWidth0 + colWidth * rooms.length, headerHeight).fill('#333');
    doc.fontSize(8).font('CustomBold').fillColor('#fff');
    doc.text('Thời gian', tableLeft + 4, y + 7, { width: colWidth0 - 8, align: 'center' });
    rooms.forEach((r, i) => {
      doc.text(r.name, tableLeft + colWidth0 + i * colWidth + 4, y + 7, { width: colWidth - 8, align: 'center' });
    });
    y += headerHeight;

    // ── Green accent line ──
    doc.rect(tableLeft, y, colWidth0 + colWidth * rooms.length, 2).fill('#76b900');
    y += 4;

    // ── Data ──
    const days = [...new Set(slots.map(s => s.day_of_week))].sort((a, b) => a - b);

    for (const day of days) {
      // Check page break
      if (y + rowHeight + 20 > doc.page.height - 40) {
        doc.addPage();
        y = 30;
      }

      // Day header
      doc.rect(tableLeft, y, colWidth0 + colWidth * rooms.length, 18).fill('#f5f5f5');
      doc.fontSize(9).font('CustomBold').fillColor('#76b900');
      doc.text(DAY_NAMES[day] || `Ngày ${day}`, tableLeft + 6, y + 4);
      y += 20;

      const daySlots = slots.filter(s => s.day_of_week === day).sort((a, b) => a.start_time.localeCompare(b.start_time));

      for (const slot of daySlots) {
        if (y + rowHeight > doc.page.height - 40) {
          doc.addPage();
          y = 30;
        }

        const timeStr = `${slot.start_time.slice(0, 5)}\n${slot.end_time.slice(0, 5)}`;

        // Time cell
        doc.rect(tableLeft, y, colWidth0, rowHeight).lineWidth(0.5).stroke('#ddd');
        doc.fontSize(8).font('CustomBold').fillColor('#333');
        doc.text(timeStr, tableLeft + 4, y + 6, { width: colWidth0 - 8, align: 'center' });

        // Room cells
        rooms.forEach((room, i) => {
          const x = tableLeft + colWidth0 + i * colWidth;
          const session = sessions.find(s => s.time_slot_id === slot.id && s.room_id === room.id);

          if (session) {
            const bgColor = session.is_pinned ? '#fce4ec' : '#f1f8e9';
            doc.rect(x, y, colWidth, rowHeight).fill(bgColor);
            doc.rect(x, y, colWidth, rowHeight).lineWidth(0.3).stroke('#ddd');

            doc.fontSize(8).font('CustomBold').fillColor('#222');
            doc.text(session.class_code, x + 3, y + 5, { width: colWidth - 6, align: 'center' });

            const tDisplay = [session.teacher_name, session.ta_name].filter(Boolean).join(' + ');
            if (tDisplay) {
              doc.fontSize(7).font('CustomRegular').fillColor('#666');
              doc.text(tDisplay, x + 3, y + 18, { width: colWidth - 6, align: 'center' });
            }
          } else {
            doc.rect(x, y, colWidth, rowHeight).lineWidth(0.3).stroke('#eee');
          }
        });

        y += rowHeight;
      }
    }

    // ── Footer ──
    doc.moveDown(1);
    doc.fontSize(7).font('CustomRegular').fillColor('#aaa')
       .text(`Xuất bởi LotusTime — ${new Date().toLocaleString('vi-VN')}`, { align: 'right' });

    doc.end();

  } catch (err) { next(err); }
};

// ══════════════════════════════════════════════════════
// ██  CUSTOM EXPORT IMPLEMENTATION
// ══════════════════════════════════════════════════════

function mergeContiguousSessions(sessions, slots) {
  if (!sessions || sessions.length === 0) return [];
  
  // 1. Map each session with its time slot details
  const mapped = sessions.map(s => {
    const ts = slots.find(slot => slot.id === s.time_slot_id) || {};
    return {
      ...s,
      day_of_week: ts.day_of_week,
      start_time: ts.start_time || '',
      end_time: ts.end_time || '',
    };
  });

  // 2. Sort by day of week, then start_time
  mapped.sort((a, b) => {
    if (a.day_of_week !== b.day_of_week) {
      return a.day_of_week - b.day_of_week;
    }
    return a.start_time.localeCompare(b.start_time);
  });

  // 3. Merge contiguous
  const merged = [];
  mapped.forEach(s => {
    if (merged.length === 0) {
      merged.push({
        ...s,
        sessionIds: [s.id]
      });
      return;
    }

    const last = merged[merged.length - 1];
    
    const isContiguous = 
      last.day_of_week === s.day_of_week &&
      last.room_id === s.room_id &&
      last.person_id === s.person_id &&
      last.end_time === s.start_time;

    if (isContiguous) {
      last.end_time = s.end_time;
      last.sessionIds.push(s.id);
    } else {
      merged.push({
        ...s,
        sessionIds: [s.id]
      });
    }
  });

  return merged;
}

function addRoomGridExcelSheet(workbook, week, sessions, rooms, slots, weekLabel) {
  const ws = workbook.addWorksheet('Lưới phòng học', {
    views: [{ state: 'frozen', xSplit: 1, ySplit: 6 }]
  });

  // ── Title block (Rows 1-3) ──
  ws.mergeCells(1, 1, 1, 1 + 7 * rooms.length);
  const titleCell = ws.getCell('A1');
  titleCell.value = 'LOTUS ENGLISH CENTER';
  titleCell.font = { name: 'Arial', size: 16, bold: true, color: { argb: 'FF1B365D' } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(1).height = 30;

  ws.mergeCells(2, 1, 2, 1 + 7 * rooms.length);
  const subtitleCell = ws.getCell('A2');
  subtitleCell.value = 'THỜI KHÓA BIỂU HỌC TẬP & GIẢNG DẠY (LƯỚI PHÒNG HỌC)';
  subtitleCell.font = { name: 'Arial', size: 12, bold: true, color: { argb: 'FF555555' } };
  subtitleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(2).height = 20;

  ws.mergeCells(3, 1, 3, 1 + 7 * rooms.length);
  const infoCell = ws.getCell('A3');
  infoCell.value = `Tuần: ${weekLabel} (Trạng thái: ${week.status.toUpperCase()})`;
  infoCell.font = { name: 'Arial', size: 11, italic: true, color: { argb: 'FF777777' } };
  infoCell.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(3).height = 20;

  // Row 4 is spacer
  ws.getRow(4).height = 10;

  // Set up Column 1: Time
  ws.getColumn(1).width = 16;
  const timeHeaderCell = ws.getCell(6, 1);
  timeHeaderCell.value = 'Thời gian';
  timeHeaderCell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF333333' } };
  timeHeaderCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
  timeHeaderCell.alignment = { horizontal: 'center', vertical: 'middle' };
  timeHeaderCell.border = {
    top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    bottom: { style: 'medium', color: { argb: 'FF94A3B8' } },
    right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
  };

  const days = [2, 3, 4, 5, 6, 7, 8];

  days.forEach((day, dayIdx) => {
    const startCol = 2 + dayIdx * rooms.length;
    const endCol = startCol + rooms.length - 1;

    // Calculate Date of Day
    const weekStart = new Date(week.week_start);
    const dayDate = new Date(weekStart);
    dayDate.setDate(weekStart.getDate() + (day - 2));
    const dateStr = dayDate.toLocaleDateString('vi-VN');

    // Day Header
    ws.mergeCells(5, startCol, 5, endCol);
    const dayCell = ws.getCell(5, startCol);
    dayCell.value = `${DAY_NAMES[day].toUpperCase()} (${dateStr})`;
    dayCell.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    dayCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1B365D' } };
    dayCell.alignment = { horizontal: 'center', vertical: 'middle' };
    
    // Border for merged day header
    for (let c = startCol; c <= endCol; c++) {
      const cCell = ws.getCell(5, c);
      cCell.border = {
        top: { style: 'medium', color: { argb: 'FF1B365D' } },
        bottom: { style: 'medium', color: { argb: 'FF1B365D' } },
        left: c === startCol ? { style: 'medium', color: { argb: 'FF0F172A' } } : { style: 'thin', color: { argb: 'FF475569' } },
        right: c === endCol ? { style: 'medium', color: { argb: 'FF0F172A' } } : { style: 'thin', color: { argb: 'FF475569' } }
      };
    }

    // Room Headers
    rooms.forEach((room, roomIdx) => {
      const col = startCol + roomIdx;
      ws.getColumn(col).width = 18;
      const cell = ws.getCell(6, col);
      cell.value = room.name;
      cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF1E293B' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        bottom: { style: 'medium', color: { argb: 'FF94A3B8' } },
        left: col === startCol ? { style: 'medium', color: { argb: 'FF0F172A' } } : { style: 'thin', color: { argb: 'FFCBD5E1' } },
        right: col === endCol ? { style: 'medium', color: { argb: 'FF0F172A' } } : { style: 'thin', color: { argb: 'FFCBD5E1' } }
      };
    });
  });

  ws.getRow(5).height = 26;
  ws.getRow(6).height = 24;

  // ── Data Rows ──
  const uniqueTimeRanges = [];
  const seenRanges = new Set();
  for (const s of slots) {
    const rangeKey = `${s.start_time}-${s.end_time}`;
    if (!seenRanges.has(rangeKey)) {
      seenRanges.add(rangeKey);
      uniqueTimeRanges.push({ start_time: s.start_time, end_time: s.end_time });
    }
  }
  uniqueTimeRanges.sort((a, b) => a.start_time.localeCompare(b.start_time));

  let rowIdx = 7;
  for (const range of uniqueTimeRanges) {
    const row = ws.getRow(rowIdx);
    row.height = 45;

    // Time cell
    const timeStr = `${range.start_time.slice(0, 5)} - ${range.end_time.slice(0, 5)}`;
    const timeCell = row.getCell(1);
    timeCell.value = timeStr;
    timeCell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF333333' } };
    timeCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F3F5' } };
    timeCell.alignment = { horizontal: 'center', vertical: 'middle' };
    timeCell.border = {
      top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      right: { style: 'medium', color: { argb: 'FF94A3B8' } }
    };

    days.forEach((day, dayIdx) => {
      const startCol = 2 + dayIdx * rooms.length;
      const endCol = startCol + rooms.length - 1;

      rooms.forEach((room, roomIdx) => {
        const col = startCol + roomIdx;
        const cell = row.getCell(col);

        const session = sessions.find(s => 
          s.day_of_week === day && 
          s.start_time === range.start_time && 
          s.room_id === room.id
        );

        if (session) {
          const lines = [session.class_code];
          const tDisplay = [session.teacher_name, session.ta_name].filter(Boolean).join(' + ');
          if (tDisplay) lines.push(tDisplay);
          cell.value = lines.join('\n');
          cell.alignment = { wrapText: true, horizontal: 'center', vertical: 'middle' };
          cell.font = { name: 'Arial', size: 9.5, bold: true };
          
          if (session.is_pinned) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFCE4EC' } };
            cell.font.color = { argb: 'FFC2185B' };
          } else {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F5E9' } };
            cell.font.color = { argb: 'FF2E7D32' };
          }
        } else {
          cell.value = '';
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
        }

        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: col === startCol ? { style: 'medium', color: { argb: 'FF0F172A' } } : { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: col === endCol ? { style: 'medium', color: { argb: 'FF0F172A' } } : { style: 'thin', color: { argb: 'FFE2E8F0' } }
        };
      });
    });

    rowIdx++;
  }

  // Row bottom border for last row
  const lastRow = ws.getRow(rowIdx - 1);
  for (let c = 1; c <= 1 + 7 * rooms.length; c++) {
    const cell = lastRow.getCell(c);
    cell.border = {
      ...(cell.border || {}),
      bottom: { style: 'medium', color: { argb: 'FF0F172A' } }
    };
  }

  // ── Footer ──
  rowIdx++;
  ws.mergeCells(rowIdx, 1, rowIdx, 1 + 7 * rooms.length);
  const footerCell = ws.getCell(rowIdx, 1);
  footerCell.value = `Xuất bởi LotusTime — ${new Date().toLocaleString('vi-VN')}`;
  footerCell.font = { name: 'Arial', size: 9, italic: true, color: { argb: 'FF999999' } };
}

async function addClassExcelSheet(workbook, week, sessions, slots, weekLabel) {
  const ws = workbook.addWorksheet('TKB theo Lớp');
  
  // Set up column widths
  ws.getColumn(1).width = 18; // Mã Lớp
  ws.getColumn(2).width = 15; // Loại Lớp
  ws.getColumn(3).width = 25; // Thời gian
  ws.getColumn(4).width = 15; // Phòng
  ws.getColumn(5).width = 25; // Giáo viên
  ws.getColumn(6).width = 18; // Vai trò

  // Title
  ws.mergeCells(1, 1, 1, 6);
  const titleCell = ws.getCell('A1');
  titleCell.value = 'LOTUS ENGLISH CENTER';
  titleCell.font = { name: 'Arial', size: 16, bold: true, color: { argb: 'FF1B365D' } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(1).height = 30;

  ws.mergeCells(2, 1, 2, 6);
  const subtitleCell = ws.getCell('A2');
  subtitleCell.value = 'THỜI KHÓA BIỂU HỌC TẬP & GIẢNG DẠY (THEO LỚP HỌC)';
  subtitleCell.font = { name: 'Arial', size: 12, bold: true, color: { argb: 'FF555555' } };
  subtitleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(2).height = 20;

  ws.mergeCells(3, 1, 3, 6);
  const infoCell = ws.getCell('A3');
  infoCell.value = `Tuần: ${weekLabel}`;
  infoCell.font = { name: 'Arial', size: 11, italic: true, color: { argb: 'FF777777' } };
  infoCell.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(3).height = 20;

  // Header Row
  const headers = ['Mã Lớp', 'Loại Lớp', 'Thời gian', 'Phòng học', 'Giáo viên / TA', 'Vai trò'];
  const headerRow = ws.getRow(5);
  headerRow.height = 24;
  headers.forEach((h, idx) => {
    const cell = headerRow.getCell(idx + 1);
    cell.value = h;
    cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1B365D' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF0F172A' } },
      bottom: { style: 'medium', color: { argb: 'FF0F172A' } },
      left: { style: 'thin', color: { argb: 'FF475569' } },
      right: { style: 'thin', color: { argb: 'FF475569' } }
    };
  });

  // Fetch Class Details
  const classesRes = await db.query(`SELECT * FROM classes ORDER BY code`);
  const classes = classesRes.rows;

  let rowIdx = 6;
  for (const cls of classes) {
    const clsSessions = sessions.filter(s => s.class_id === cls.id);
    if (clsSessions.length === 0) continue;

    const merged = mergeContiguousSessions(clsSessions, slots);

    merged.forEach((s, sIdx) => {
      const row = ws.getRow(rowIdx);
      row.height = 20;

      // Group styling or merge class code for visual neatness
      if (sIdx === 0) {
        row.getCell(1).value = cls.code;
        row.getCell(1).font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF1B365D' } };
        row.getCell(2).value = cls.class_type.toUpperCase();
        row.getCell(2).font = { name: 'Arial', size: 9, bold: true };
      } else {
        row.getCell(1).value = '';
        row.getCell(2).value = '';
      }

      // Time
      const dayName = DAY_NAMES[s.day_of_week] || `Thứ ${s.day_of_week}`;
      row.getCell(3).value = `${dayName} (${s.start_time.slice(0, 5)} - ${s.end_time.slice(0, 5)})`;
      row.getCell(3).alignment = { horizontal: 'left', vertical: 'middle' };

      // Room
      row.getCell(4).value = s.room_name;
      row.getCell(4).alignment = { horizontal: 'center', vertical: 'middle' };

      // Teacher
      const tDisplay = [s.teacher_name, s.ta_name].filter(Boolean).join(' + ');
      row.getCell(5).value = tDisplay || 'Chưa phân công';
      if (!tDisplay) {
        row.getCell(5).font = { name: 'Arial', italic: true, color: { argb: 'FFDC2626' } };
      } else {
        row.getCell(5).font = { name: 'Arial', bold: true };
      }
      row.getCell(5).alignment = { horizontal: 'left', vertical: 'middle' };

      // Role
      let roleLabel = '';
      const roles = [];
      if (s.assigned_role) {
        const mainLabel = s.assigned_role === 'lead_teacher' ? 'GV Chính' :
                          s.assigned_role === 'foreign_teacher' ? 'GV Nước Ngoài' :
                          s.assigned_role === 'ta_solo' ? 'TA Độc Lập' :
                          s.assigned_role === 'ta_support' ? 'TA Hỗ Trợ' :
                          s.assigned_role === 'ta_ielts' ? 'TA IELTS' :
                          s.assigned_role === 'ta_kids' ? 'TA Kids' : s.assigned_role;
        roles.push(mainLabel);
      }
      if (s.assigned_ta_role) {
        const taLabel = s.assigned_ta_role === 'lead_teacher' ? 'GV Chính' :
                        s.assigned_ta_role === 'foreign_teacher' ? 'GV Nước Ngoài' :
                        s.assigned_ta_role === 'ta_solo' ? 'TA Độc Lập' :
                        s.assigned_ta_role === 'ta_support' ? 'TA Hỗ Trợ' :
                        s.assigned_ta_role === 'ta_ielts' ? 'TA IELTS' :
                        s.assigned_ta_role === 'ta_kids' ? 'TA Kids' : s.assigned_ta_role;
        roles.push(taLabel);
      }
      roleLabel = roles.join(' + ');
      row.getCell(6).value = roleLabel;
      row.getCell(6).alignment = { horizontal: 'center', vertical: 'middle' };

      // Borders
      for (let c = 1; c <= 6; c++) {
        const cell = row.getCell(c);
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
        };
      }

      rowIdx++;
    });

    // Add a thin border line under each class group
    const prevRow = ws.getRow(rowIdx - 1);
    for (let c = 1; c <= 6; c++) {
      prevRow.getCell(c).border.bottom = { style: 'medium', color: { argb: 'FF94A3B8' } };
    }
  }

  // Footer
  rowIdx++;
  ws.mergeCells(rowIdx, 1, rowIdx, 6);
  const footerCell = ws.getCell(rowIdx, 1);
  footerCell.value = `Xuất bởi LotusTime — ${new Date().toLocaleString('vi-VN')}`;
  footerCell.font = { name: 'Arial', size: 9, italic: true, color: { argb: 'FF999999' } };
}

async function addTeacherExcelSheet(workbook, week, sessions, slots, weekLabel) {
  const ws = workbook.addWorksheet('TKB theo Giáo viên');
  
  // Set up column widths
  ws.getColumn(1).width = 20; // Giáo viên (Short)
  ws.getColumn(2).width = 25; // Tên đầy đủ
  ws.getColumn(3).width = 25; // Thời gian
  ws.getColumn(4).width = 15; // Lớp
  ws.getColumn(5).width = 15; // Phòng
  ws.getColumn(6).width = 18; // Vai trò

  // Title
  ws.mergeCells(1, 1, 1, 6);
  const titleCell = ws.getCell('A1');
  titleCell.value = 'LOTUS ENGLISH CENTER';
  titleCell.font = { name: 'Arial', size: 16, bold: true, color: { argb: 'FF1B365D' } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(1).height = 30;

  ws.mergeCells(2, 1, 2, 6);
  const subtitleCell = ws.getCell('A2');
  subtitleCell.value = 'THỜI KHÓA BIỂU HỌC TẬP & GIẢNG DẠY (THEO GIÁO VIÊN & TA)';
  subtitleCell.font = { name: 'Arial', size: 12, bold: true, color: { argb: 'FF555555' } };
  subtitleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(2).height = 20;

  ws.mergeCells(3, 1, 3, 6);
  const infoCell = ws.getCell('A3');
  infoCell.value = `Tuần: ${weekLabel}`;
  infoCell.font = { name: 'Arial', size: 11, italic: true, color: { argb: 'FF777777' } };
  infoCell.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(3).height = 20;

  // Header Row
  const headers = ['Giáo viên / TA', 'Tên đầy đủ', 'Thời gian', 'Lớp học', 'Phòng học', 'Vai trò'];
  const headerRow = ws.getRow(5);
  headerRow.height = 24;
  headers.forEach((h, idx) => {
    const cell = headerRow.getCell(idx + 1);
    cell.value = h;
    cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1B365D' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF0F172A' } },
      bottom: { style: 'medium', color: { argb: 'FF0F172A' } },
      left: { style: 'thin', color: { argb: 'FF475569' } },
      right: { style: 'thin', color: { argb: 'FF475569' } }
    };
  });

  // Fetch Persons Details
  const personsRes = await db.query(`SELECT * FROM persons WHERE is_active = true ORDER BY short_name`);
  const persons = personsRes.rows;

  let rowIdx = 6;

  // Add Unassigned first if any
  const unassignedSessions = sessions.filter(s => !s.person_id && !s.ta_id);
  if (unassignedSessions.length > 0) {
    const mergedUnassigned = mergeContiguousSessions(unassignedSessions, slots);
    mergedUnassigned.forEach((s, sIdx) => {
      const row = ws.getRow(rowIdx);
      row.height = 20;

      if (sIdx === 0) {
        row.getCell(1).value = 'CHƯA PHÂN CÔNG';
        row.getCell(1).font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFDC2626' } };
        row.getCell(2).value = '—';
      } else {
        row.getCell(1).value = '';
        row.getCell(2).value = '';
      }

      const dayName = DAY_NAMES[s.day_of_week] || `Thứ ${s.day_of_week}`;
      row.getCell(3).value = `${dayName} (${s.start_time.slice(0, 5)} - ${s.end_time.slice(0, 5)})`;
      row.getCell(4).value = s.class_code;
      row.getCell(4).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(5).value = s.room_name;
      row.getCell(5).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(6).value = '—';
      row.getCell(6).alignment = { horizontal: 'center', vertical: 'middle' };

      for (let c = 1; c <= 6; c++) {
        row.getCell(c).border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
        };
      }
      rowIdx++;
    });

    const prevRow = ws.getRow(rowIdx - 1);
    for (let c = 1; c <= 6; c++) {
      prevRow.getCell(c).border.bottom = { style: 'medium', color: { argb: 'FF94A3B8' } };
    }
  }

  // Then add each active teacher
  persons.forEach(p => {
    const tSessions = sessions.filter(s => s.person_id === p.id || s.ta_id === p.id);
    if (tSessions.length === 0) return;

    const merged = mergeContiguousSessions(tSessions, slots);

    merged.forEach((s, sIdx) => {
      const row = ws.getRow(rowIdx);
      row.height = 20;

      if (sIdx === 0) {
        row.getCell(1).value = p.short_name;
        row.getCell(1).font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF1B365D' } };
        row.getCell(2).value = p.full_name || p.name || '';
        row.getCell(2).font = { name: 'Arial', size: 9.5 };
      } else {
        row.getCell(1).value = '';
        row.getCell(2).value = '';
      }

      const dayName = DAY_NAMES[s.day_of_week] || `Thứ ${s.day_of_week}`;
      row.getCell(3).value = `${dayName} (${s.start_time.slice(0, 5)} - ${s.end_time.slice(0, 5)})`;
      row.getCell(3).alignment = { horizontal: 'left', vertical: 'middle' };

      row.getCell(4).value = s.class_code;
      row.getCell(4).alignment = { horizontal: 'center', vertical: 'middle' };

      row.getCell(5).value = s.room_name;
      row.getCell(5).alignment = { horizontal: 'center', vertical: 'middle' };

      let roleLabel = '';
      if (s.person_id === p.id && s.assigned_role) {
        roleLabel = s.assigned_role === 'lead_teacher' ? 'GV Chính' :
                    s.assigned_role === 'foreign_teacher' ? 'GV Nước Ngoài' :
                    s.assigned_role === 'ta_solo' ? 'TA Độc Lập' :
                    s.assigned_role === 'ta_support' ? 'TA Hỗ Trợ' :
                    s.assigned_role === 'ta_ielts' ? 'TA IELTS' :
                    s.assigned_role === 'ta_kids' ? 'TA Kids' : s.assigned_role;
      } else if (s.ta_id === p.id && s.assigned_ta_role) {
        roleLabel = s.assigned_ta_role === 'lead_teacher' ? 'GV Chính' :
                    s.assigned_ta_role === 'foreign_teacher' ? 'GV Nước Ngoài' :
                    s.assigned_ta_role === 'ta_solo' ? 'TA Độc Lập' :
                    s.assigned_ta_role === 'ta_support' ? 'TA Hỗ Trợ' :
                    s.assigned_ta_role === 'ta_ielts' ? 'TA IELTS' :
                    s.assigned_ta_role === 'ta_kids' ? 'TA Kids' : s.assigned_ta_role;
      }
      row.getCell(6).value = roleLabel;
      row.getCell(6).alignment = { horizontal: 'center', vertical: 'middle' };

      // Borders
      for (let c = 1; c <= 6; c++) {
        const cell = row.getCell(c);
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
        };
      }

      rowIdx++;
    });

    const prevRow = ws.getRow(rowIdx - 1);
    for (let c = 1; c <= 6; c++) {
      prevRow.getCell(c).border.bottom = { style: 'medium', color: { argb: 'FF94A3B8' } };
    }
  });

  // Footer
  rowIdx++;
  ws.mergeCells(rowIdx, 1, rowIdx, 6);
  const footerCell = ws.getCell(rowIdx, 1);
  footerCell.value = `Xuất bởi LotusTime — ${new Date().toLocaleString('vi-VN')}`;
  footerCell.font = { name: 'Arial', size: 9, italic: true, color: { argb: 'FF999999' } };
}

function drawPdfRoomGrid(doc, week, sessions, rooms, slots, weekLabel) {
  // Title
  doc.fontSize(14).font('CustomBold')
     .fillColor('#76b900')
     .text(`THỜI KHÓA BIỂU – LƯỚI PHÒNG HỌC`, { align: 'center' });
  doc.fontSize(10).font('CustomRegular').fillColor('#666')
     .text(`Tuần ${weekLabel}`, { align: 'center' });
  doc.moveDown(0.5);

  const tableLeft = 30;
  const colWidth0 = 70; // Time column
  const availableWidth = doc.page.width - 60 - colWidth0;
  const colWidth = Math.min(availableWidth / rooms.length, 120);
  const rowHeight = 36;
  const headerHeight = 24;
  let y = doc.y;

  // Header
  doc.rect(tableLeft, y, colWidth0 + colWidth * rooms.length, headerHeight).fill('#1b365d');
  doc.fontSize(8).font('CustomBold').fillColor('#fff');
  doc.text('Thời gian', tableLeft + 4, y + 8, { width: colWidth0 - 8, align: 'center' });
  rooms.forEach((r, i) => {
    doc.text(r.name, tableLeft + colWidth0 + i * colWidth + 4, y + 8, { width: colWidth - 8, align: 'center' });
  });
  y += headerHeight;

  // Accent line
  doc.rect(tableLeft, y, colWidth0 + colWidth * rooms.length, 2).fill('#76b900');
  y += 4;

  // Data
  const days = [...new Set(slots.map(s => s.day_of_week))].sort((a, b) => a - b);
  for (const day of days) {
    if (y + rowHeight + 20 > doc.page.height - 40) {
      doc.addPage();
      y = 30;
    }

    doc.rect(tableLeft, y, colWidth0 + colWidth * rooms.length, 18).fill('#f1f5f9');
    doc.fontSize(9).font('CustomBold').fillColor('#1b365d');
    doc.text(DAY_NAMES[day] || `Ngày ${day}`, tableLeft + 6, y + 4);
    y += 20;

    const daySlots = slots.filter(s => s.day_of_week === day).sort((a, b) => a.start_time.localeCompare(b.start_time));
    for (const slot of daySlots) {
      if (y + rowHeight > doc.page.height - 40) {
        doc.addPage();
        y = 30;
      }

      const timeStr = `${slot.start_time.slice(0, 5)} - ${slot.end_time.slice(0, 5)}`;
      doc.rect(tableLeft, y, colWidth0, rowHeight).lineWidth(0.5).stroke('#cbd5e1');
      doc.fontSize(8).font('CustomBold').fillColor('#333');
      doc.text(timeStr, tableLeft + 4, y + 14, { width: colWidth0 - 8, align: 'center' });

      rooms.forEach((room, i) => {
        const x = tableLeft + colWidth0 + i * colWidth;
        const session = sessions.find(s => s.time_slot_id === slot.id && s.room_id === room.id);

        if (session) {
          const bgColor = session.is_pinned ? '#fdf2f8' : '#f0fdf4';
          const strokeColor = session.is_pinned ? '#fbcfe8' : '#bbf7d0';
          const textColor = session.is_pinned ? '#9d174d' : '#166534';
          
          doc.rect(x, y, colWidth, rowHeight).fill(bgColor);
          doc.rect(x, y, colWidth, rowHeight).lineWidth(0.3).stroke(strokeColor);

          doc.fontSize(8).font('CustomBold').fillColor(textColor);
          doc.text(session.class_code, x + 3, y + 8, { width: colWidth - 6, align: 'center' });

          if (session.teacher_name) {
            doc.fontSize(7).font('CustomRegular').fillColor('#555');
            doc.text(session.teacher_name, x + 3, y + 20, { width: colWidth - 6, align: 'center' });
          }
        } else {
          doc.rect(x, y, colWidth, rowHeight).lineWidth(0.3).stroke('#f1f5f9');
        }
      });

      y += rowHeight;
    }
  }
}

async function drawPdfClassView(doc, week, sessions, slots, weekLabel) {
  doc.fontSize(14).font('CustomBold')
     .fillColor('#76b900')
     .text(`THỜI KHÓA BIỂU – THEO LỚP HỌC`, { align: 'center' });
  doc.fontSize(10).font('CustomRegular').fillColor('#666')
     .text(`Tuần ${weekLabel}`, { align: 'center' });
  doc.moveDown(0.5);

  const tableLeft = 40;
  const colWidths = [100, 80, 155, 80, 120, 100]; // Total = 635
  const headerHeight = 24;
  const rowHeight = 20;
  let y = doc.y;

  // Header row
  doc.rect(tableLeft, y, colWidths.reduce((a, b) => a + b), headerHeight).fill('#1b365d');
  doc.fontSize(8).font('CustomBold').fillColor('#fff');
  
  const headers = ['Mã Lớp', 'Loại Lớp', 'Thời gian', 'Phòng học', 'Giáo viên / TA', 'Vai trò'];
  let currentX = tableLeft;
  headers.forEach((h, idx) => {
    doc.text(h, currentX + 4, y + 8, { width: colWidths[idx] - 8, align: 'center' });
    currentX += colWidths[idx];
  });
  y += headerHeight;

  // Green line
  doc.rect(tableLeft, y, colWidths.reduce((a, b) => a + b), 2).fill('#76b900');
  y += 4;

  const classesRes = await db.query(`SELECT * FROM classes ORDER BY code`);
  const classes = classesRes.rows;

  for (const cls of classes) {
    const clsSessions = sessions.filter(s => s.class_id === cls.id);
    if (clsSessions.length === 0) continue;

    const merged = mergeContiguousSessions(clsSessions, slots);

    for (let sIdx = 0; sIdx < merged.length; sIdx++) {
      const s = merged[sIdx];
      
      // Page break check
      if (y + rowHeight > doc.page.height - 40) {
        doc.addPage();
        y = 40;
        
        // Redraw table headers on new page
        doc.rect(tableLeft, y, colWidths.reduce((a, b) => a + b), headerHeight).fill('#1b365d');
        doc.fontSize(8).font('CustomBold').fillColor('#fff');
        let tempX = tableLeft;
        headers.forEach((h, idx) => {
          doc.text(h, tempX + 4, y + 8, { width: colWidths[idx] - 8, align: 'center' });
          tempX += colWidths[idx];
        });
        y += headerHeight;
        doc.rect(tableLeft, y, colWidths.reduce((a, b) => a + b), 2).fill('#76b900');
        y += 4;
      }

      // Zebra striping per class group
      const bgColor = y % 40 === 0 ? '#f8fafc' : '#ffffff';
      doc.rect(tableLeft, y, colWidths.reduce((a, b) => a + b), rowHeight).fill(bgColor);
      doc.rect(tableLeft, y, colWidths.reduce((a, b) => a + b), rowHeight).lineWidth(0.3).stroke('#e2e8f0');

      doc.fontSize(8).font('CustomRegular').fillColor('#333');
      
      // Draw first two columns only for the first slot
      let drawX = tableLeft;
      if (sIdx === 0) {
        doc.font('CustomBold').fillColor('#1b365d');
        doc.text(cls.code, drawX + 6, y + 6, { width: colWidths[0] - 12, align: 'left' });
        drawX += colWidths[0];

        doc.font('CustomBold').fillColor('#475569');
        doc.text(cls.class_type.toUpperCase(), drawX + 4, y + 6, { width: colWidths[1] - 8, align: 'center' });
        drawX += colWidths[1];
      } else {
        drawX += colWidths[0] + colWidths[1];
      }

      // Time
      const dayName = DAY_NAMES[s.day_of_week] || `Thứ ${s.day_of_week}`;
      doc.font('CustomRegular').fillColor('#333');
      doc.text(`${dayName} (${s.start_time.slice(0, 5)} - ${s.end_time.slice(0, 5)})`, drawX + 6, y + 6, { width: colWidths[2] - 12 });
      drawX += colWidths[2];

      // Room
      doc.text(s.room_name, drawX + 4, y + 6, { width: colWidths[3] - 8, align: 'center' });
      drawX += colWidths[3];

      // Teacher
      const tDisplay = [s.teacher_name, s.ta_name].filter(Boolean).join(' + ');
      doc.font(tDisplay ? 'CustomBold' : 'CustomOblique');
      doc.fillColor(tDisplay ? '#333' : '#dc2626');
      doc.text(tDisplay || 'Chưa phân công', drawX + 6, y + 6, { width: colWidths[4] - 12 });
      drawX += colWidths[4];

      // Role
      doc.font('CustomRegular').fillColor('#555');
      let roleLabel = '';
      const roles = [];
      if (s.assigned_role) {
        const mainLabel = s.assigned_role === 'lead_teacher' ? 'GV Chính' :
                          s.assigned_role === 'foreign_teacher' ? 'GV Nước Ngoài' :
                          s.assigned_role === 'ta_solo' ? 'TA Độc Lập' :
                          s.assigned_role === 'ta_support' ? 'TA Hỗ Trợ' :
                          s.assigned_role === 'ta_ielts' ? 'TA IELTS' :
                          s.assigned_role === 'ta_kids' ? 'TA Kids' : s.assigned_role;
        roles.push(mainLabel);
      }
      if (s.assigned_ta_role) {
        const taLabel = s.assigned_ta_role === 'lead_teacher' ? 'GV Chính' :
                        s.assigned_ta_role === 'foreign_teacher' ? 'GV Nước Ngoài' :
                        s.assigned_ta_role === 'ta_solo' ? 'TA Độc Lập' :
                        s.assigned_ta_role === 'ta_support' ? 'TA Hỗ Trợ' :
                        s.assigned_ta_role === 'ta_ielts' ? 'TA IELTS' :
                        s.assigned_ta_role === 'ta_kids' ? 'TA Kids' : s.assigned_ta_role;
        roles.push(taLabel);
      }
      roleLabel = roles.join(' + ');
      doc.text(roleLabel, drawX + 4, y + 6, { width: colWidths[5] - 8, align: 'center' });

      y += rowHeight;
    }
  }
}

async function drawPdfTeacherView(doc, week, sessions, slots, weekLabel) {
  doc.fontSize(14).font('CustomBold')
     .fillColor('#76b900')
     .text(`THỜI KHÓA BIỂU – THEO GIÁO VIÊN & TA`, { align: 'center' });
  doc.fontSize(10).font('CustomRegular').fillColor('#666')
     .text(`Tuần ${weekLabel}`, { align: 'center' });
  doc.moveDown(0.5);

  const tableLeft = 40;
  const colWidths = [100, 110, 155, 80, 90, 100]; // Total = 635
  const headerHeight = 24;
  const rowHeight = 20;
  let y = doc.y;

  // Header row
  doc.rect(tableLeft, y, colWidths.reduce((a, b) => a + b), headerHeight).fill('#1b365d');
  doc.fontSize(8).font('CustomBold').fillColor('#fff');
  
  const headers = ['Giáo viên / TA', 'Tên đầy đủ', 'Thời gian', 'Lớp học', 'Phòng học', 'Vai trò'];
  let currentX = tableLeft;
  headers.forEach((h, idx) => {
    doc.text(h, currentX + 4, y + 8, { width: colWidths[idx] - 8, align: 'center' });
    currentX += colWidths[idx];
  });
  y += headerHeight;

  // Green line
  doc.rect(tableLeft, y, colWidths.reduce((a, b) => a + b), 2).fill('#76b900');
  y += 4;

  const personsRes = await db.query(`SELECT * FROM persons WHERE is_active = true ORDER BY short_name`);
  const persons = personsRes.rows;

  // Unassigned first
  const unassigned = sessions.filter(s => !s.person_id && !s.ta_id);
  const teacherGroups = [];
  if (unassigned.length > 0) {
    teacherGroups.push({
      short_name: 'CHƯA PHÂN CÔNG',
      full_name: '—',
      sessions: unassigned,
      personId: null
    });
  }
  persons.forEach(p => {
    const tSessions = sessions.filter(s => s.person_id === p.id || s.ta_id === p.id);
    if (tSessions.length > 0) {
      teacherGroups.push({
        short_name: p.short_name,
        full_name: p.full_name || p.name || '',
        sessions: tSessions,
        personId: p.id
      });
    }
  });

  for (const group of teacherGroups) {
    const merged = mergeContiguousSessions(group.sessions, slots);

    for (let sIdx = 0; sIdx < merged.length; sIdx++) {
      const s = merged[sIdx];
      
      // Page break check
      if (y + rowHeight > doc.page.height - 40) {
        doc.addPage();
        y = 40;
        
        // Redraw table headers on new page
        doc.rect(tableLeft, y, colWidths.reduce((a, b) => a + b), headerHeight).fill('#1b365d');
        doc.fontSize(8).font('CustomBold').fillColor('#fff');
        let tempX = tableLeft;
        headers.forEach((h, idx) => {
          doc.text(h, tempX + 4, y + 8, { width: colWidths[idx] - 8, align: 'center' });
          tempX += colWidths[idx];
        });
        y += headerHeight;
        doc.rect(tableLeft, y, colWidths.reduce((a, b) => a + b), 2).fill('#76b900');
        y += 4;
      }

      const bgColor = y % 40 === 0 ? '#f8fafc' : '#ffffff';
      doc.rect(tableLeft, y, colWidths.reduce((a, b) => a + b), rowHeight).fill(bgColor);
      doc.rect(tableLeft, y, colWidths.reduce((a, b) => a + b), rowHeight).lineWidth(0.3).stroke('#e2e8f0');

      doc.fontSize(8).font('CustomRegular').fillColor('#333');
      
      // Draw first two columns only for the first slot
      let drawX = tableLeft;
      if (sIdx === 0) {
        doc.font('CustomBold').fillColor(group.short_name === 'CHƯA PHÂN CÔNG' ? '#dc2626' : '#1b365d');
        doc.text(group.short_name, drawX + 6, y + 6, { width: colWidths[0] - 12, align: 'left' });
        drawX += colWidths[0];

        doc.font('CustomRegular').fillColor('#555');
        doc.text(group.full_name, drawX + 6, y + 6, { width: colWidths[1] - 12 });
        drawX += colWidths[1];
      } else {
        drawX += colWidths[0] + colWidths[1];
      }

      // Time
      const dayName = DAY_NAMES[s.day_of_week] || `Thứ ${s.day_of_week}`;
      doc.font('CustomRegular').fillColor('#333');
      doc.text(`${dayName} (${s.start_time.slice(0, 5)} - ${s.end_time.slice(0, 5)})`, drawX + 6, y + 6, { width: colWidths[2] - 12 });
      drawX += colWidths[2];

      // Class
      doc.font('CustomBold').fillColor('#16a34a');
      doc.text(s.class_code, drawX + 4, y + 6, { width: colWidths[3] - 8, align: 'center' });
      drawX += colWidths[3];

      // Room
      doc.font('CustomRegular').fillColor('#333');
      doc.text(s.room_name, drawX + 4, y + 6, { width: colWidths[4] - 8, align: 'center' });
      drawX += colWidths[4];

      // Role
      doc.font('CustomRegular').fillColor('#555');
      let roleLabel = '';
      if (s.person_id === group.personId && s.assigned_role) {
        roleLabel = s.assigned_role === 'lead_teacher' ? 'GV Chính' :
                    s.assigned_role === 'foreign_teacher' ? 'GV Nước Ngoài' :
                    s.assigned_role === 'ta_solo' ? 'TA Độc Lập' :
                    s.assigned_role === 'ta_support' ? 'TA Hỗ Trợ' :
                    s.assigned_role === 'ta_ielts' ? 'TA IELTS' :
                    s.assigned_role === 'ta_kids' ? 'TA Kids' : s.assigned_role;
      } else if (s.ta_id === group.personId && s.assigned_ta_role) {
        roleLabel = s.assigned_ta_role === 'lead_teacher' ? 'GV Chính' :
                    s.assigned_ta_role === 'foreign_teacher' ? 'GV Nước Ngoài' :
                    s.assigned_ta_role === 'ta_solo' ? 'TA Độc Lập' :
                    s.assigned_ta_role === 'ta_support' ? 'TA Hỗ Trợ' :
                    s.assigned_ta_role === 'ta_ielts' ? 'TA IELTS' :
                    s.assigned_ta_role === 'ta_kids' ? 'TA Kids' : s.assigned_ta_role;
      }
      doc.text(roleLabel, drawX + 4, y + 6, { width: colWidths[5] - 8, align: 'center' });

      y += rowHeight;
    }
  }
}

exports.exportCustom = async (req, res, next) => {
  try {
    const { format, views } = req.body;
    if (!format || !views || !Array.isArray(views) || views.length === 0) {
      return res.status(400).json({ error: 'Thiếu định dạng hoặc danh sách chế độ xem cần xuất' });
    }

    const { week, sessions, rooms, slots } = await getWeekData(req.params.id);
    const startDate = new Date(week.week_start);
    const d = String(startDate.getDate()).padStart(2, '0');
    const m = String(startDate.getMonth() + 1).padStart(2, '0');
    const year = startDate.getFullYear();
    const weekLabel = `${d}/${m}/${year}`;
    const fileWeekLabel = `${d}-${m}-${year}`;

    if (format === 'excel') {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'LotusTime';
      workbook.created = new Date();

      if (views.includes('grid')) {
        addRoomGridExcelSheet(workbook, week, sessions, rooms, slots, weekLabel);
      }
      if (views.includes('class')) {
        await addClassExcelSheet(workbook, week, sessions, slots, weekLabel);
      }
      if (views.includes('teacher')) {
        await addTeacherExcelSheet(workbook, week, sessions, slots, weekLabel);
      }

      const sanitizedFilename = `TKB_Tuan_${fileWeekLabel}.xlsx`;
      const buffer = await workbook.xlsx.writeBuffer();
      if (!process.env.CLOUDINARY_URL) {
        throw new Error('CLOUDINARY_URL is not configured in .env');
      }
      const downloadUrl = await uploadBufferToCloudinary(buffer, sanitizedFilename);
      return res.json({ url: downloadUrl });

    } else if (format === 'pdf') {
      const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 30 });
      setupFonts(doc);
      const sanitizedFilename = `TKB_Tuan_${fileWeekLabel}.pdf`;
      const buffers = [];
      
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', async () => {
        try {
          const pdfBuffer = Buffer.concat(buffers);
          if (!process.env.CLOUDINARY_URL) {
            throw new Error('CLOUDINARY_URL is not configured in .env');
          }
          const downloadUrl = await uploadBufferToCloudinary(pdfBuffer, sanitizedFilename);
          res.json({ url: downloadUrl });
        } catch (err) {
          next(err);
        }
      });

      let pageCount = 0;
      if (views.includes('grid')) {
        if (pageCount > 0) doc.addPage();
        drawPdfRoomGrid(doc, week, sessions, rooms, slots, weekLabel);
        pageCount++;
      }
      if (views.includes('class')) {
        if (pageCount > 0) doc.addPage();
        await drawPdfClassView(doc, week, sessions, slots, weekLabel);
        pageCount++;
      }
      if (views.includes('teacher')) {
        if (pageCount > 0) doc.addPage();
        await drawPdfTeacherView(doc, week, sessions, slots, weekLabel);
        pageCount++;
      }

      // Add footer to last page
      doc.moveDown(1);
      doc.fontSize(7).font('CustomRegular').fillColor('#aaa')
         .text(`Xuất bởi LotusTime — ${new Date().toLocaleString('vi-VN')}`, { align: 'right' });

      doc.end();
    } else {
      return res.status(400).json({ error: 'Định dạng xuất không hợp lệ' });
    }

  } catch (err) {
    next(err);
  }
};
