const XLSX = require('xlsx');
const fs = require('fs');

const filename = 'Mitigation Sheet.xlsx';
try {
    const workbook = XLSX.readFile(filename);
    const analysis = {};

    workbook.SheetNames.forEach(sheetName => {
        const worksheet = workbook.Sheets[sheetName];
        // limited range to avoid huge output
        const data = XLSX.utils.sheet_to_json(worksheet, { header: 1, range: 0 });

        // Get first 20 rows to understand structure
        const preview = data.slice(0, 20);

        analysis[sheetName] = {
            rowCount: data.length,
            preview: preview
        };
    });

    console.log(JSON.stringify(analysis, null, 2));
} catch (error) {
    console.error("Error reading file:", error.message);
}
