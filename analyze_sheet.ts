import * as XLSX from 'xlsx';
import * as fs from 'fs';

const filename = 'Mitigation Sheet.xlsx';
const workbook = XLSX.readFile(filename);

const analysis = {};

workbook.SheetNames.forEach(sheetName => {
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    // Get first few rows to understand structure
    const preview = data.slice(0, 10);

    analysis[sheetName] = {
        rowCount: data.length,
        colCount: data.length > 0 ? (data[0] as any[]).length : 0,
        preview: preview
    };
});

console.log(JSON.stringify(analysis, null, 2));
