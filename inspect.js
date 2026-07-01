const XLSX = require('xlsx');
const path = require('path');

const file1 = path.join('C:\\Users\\ipras\\AppData\\Local\\Temp\\opencode\\ocie\\data', 'NSCLC_Treatment_Mapping_with_PDL1.xlsx');
const file2 = path.join('C:\\Users\\ipras\\AppData\\Local\\Temp\\opencode\\ocie\\data', 'Clinical_Trials_NSCLC_with_PatientPop.xlsx');

// ============ FILE 1 ============
console.log('==================== FILE 1: NSCLC_Treatment_Mapping_with_PDL1.xlsx ====================');
const wb1 = XLSX.readFile(file1, {sheets: 'Metastatic_Final'});
const ws1 = wb1.Sheets['Metastatic_Final'];
if (!ws1) {
  console.log('Sheet Metastatic_Final not found. Available sheets:', wb1.SheetNames);
} else {
  const data1 = XLSX.utils.sheet_to_json(ws1, {header: 1});
  console.log('Sheet name: Metastatic_Final');
  console.log('Total rows (including header):', data1.length);

  if (data1.length > 0) {
    console.log('\n--- Column Headers (Row 1) ---');
    const headers1 = data1[0];
    headers1.forEach((h, i) => console.log('  Col ' + i + ': ' + h));

    console.log('\n--- Full data preview (first 5 data rows) ---');
    for (let r = 1; r < Math.min(6, data1.length); r++) {
      console.log('Row ' + (r+1) + ': ' + JSON.stringify(data1[r]));
    }

    console.log('\n--- Probable drug-name columns ---');
    const drugKeywords = ['drug', 'treatment', 'medication', 'agent', 'regimen', 'therapy', 'chemo', 'immuno', 'targeted', 'systemic'];
    headers1.forEach((h, i) => {
      if (h && typeof h === 'string') {
        const hLower = h.toLowerCase();
        if (drugKeywords.some(k => hLower.includes(k)) || hLower.includes('drug')) {
          console.log('  Col ' + i + ': "' + h + '" (keyword match)');
        }
      }
    });

    console.log('\n--- 5 Sample Drug Names (from likely drug columns) ---');
    const drugColIndices1 = [];
    headers1.forEach((h, i) => {
      if (h && typeof h === 'string') {
        const hLower = h.toLowerCase();
        if (drugKeywords.some(k => hLower.includes(k)) || hLower.includes('drug') || hLower.includes('agent')) {
          drugColIndices1.push(i);
        }
      }
    });
    if (drugColIndices1.length === 0) {
      console.log('  (No columns matched drug keywords; showing first few columns)');
      for (let i = 0; i < Math.min(3, headers1.length); i++) drugColIndices1.push(i);
    }

    for (let r = 1; r < Math.min(6, data1.length); r++) {
      console.log('Sample row ' + r + ':');
      drugColIndices1.forEach(idx => {
        let val = data1[r][idx];
        if (val !== undefined && val !== null) val = String(val);
        console.log('  ' + headers1[idx] + ' = ' + val);
      });
    }
  }
}

// ============ FILE 2 ============
console.log('\n\n==================== FILE 2: Clinical_Trials_NSCLC_with_PatientPop.xlsx ====================');
const wb2 = XLSX.readFile(file2, {sheets: 'Working Sheet'});
const ws2 = wb2.Sheets['Working Sheet'];
if (!ws2) {
  console.log('Sheet "Working Sheet" not found. Available sheets:', wb2.SheetNames);
} else {
  const data2 = XLSX.utils.sheet_to_json(ws2, {header: 1});
  console.log('Sheet name: Working Sheet');
  console.log('Total rows (including header):', data2.length);

  if (data2.length > 0) {
    console.log('\n--- Column Headers (Row 1) ---');
    const headers2 = data2[0];
    headers2.forEach((h, i) => console.log('  Col ' + i + ': ' + h));

    console.log('\n--- Full data preview (first 5 data rows) ---');
    for (let r = 1; r < Math.min(6, data2.length); r++) {
      console.log('Row ' + (r+1) + ': ' + JSON.stringify(data2[r]));
    }

    console.log('\n--- Probable drug-name columns ---');
    const drugKeywords = ['drug', 'treatment', 'medication', 'agent', 'regimen', 'therapy', 'chemo', 'immuno', 'targeted', 'systemic', 'intervention', 'arm', 'regimen'];
    headers2.forEach((h, i) => {
      if (h && typeof h === 'string') {
        const hLower = h.toLowerCase();
        if (drugKeywords.some(k => hLower.includes(k))) {
          console.log('  Col ' + i + ': "' + h + '" (keyword match)');
        }
      }
    });

    console.log('\n--- 5 Sample Drug Names (from likely drug columns) ---');
    const drugColIndices2 = [];
    headers2.forEach((h, i) => {
      if (h && typeof h === 'string') {
        const hLower = h.toLowerCase();
        if (drugKeywords.some(k => hLower.includes(k))) {
          drugColIndices2.push(i);
        }
      }
    });
    if (drugColIndices2.length === 0) {
      console.log('  (No columns matched drug keywords; showing first few columns)');
      for (let i = 0; i < Math.min(3, headers2.length); i++) drugColIndices2.push(i);
    }

    for (let r = 1; r < Math.min(6, data2.length); r++) {
      console.log('Sample row ' + r + ':');
      drugColIndices2.forEach(idx => {
        let val = data2[r][idx];
        if (val !== undefined && val !== null) val = String(val);
        console.log('  ' + headers2[idx] + ' = ' + val);
      });
    }
  }
}
