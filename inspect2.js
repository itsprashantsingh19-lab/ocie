const XLSX = require('xlsx');
const path = require('path');

const file1 = path.join('C:\\Users\\ipras\\AppData\\Local\\Temp\\opencode\\ocie\\data', 'NSCLC_Treatment_Mapping_with_PDL1.xlsx');
const file2 = path.join('C:\\Users\\ipras\\AppData\\Local\\Temp\\opencode\\ocie\\data', 'Clinical_Trials_NSCLC_with_PatientPop.xlsx');

// ============ FILE 1 ============
console.log('==================== FILE 1: NSCLC_Treatment_Mapping_with_PDL1.xlsx ====================');
const wb1 = XLSX.readFile(file1, {sheets: 'Metastatic_Final'});
const ws1 = wb1.Sheets['Metastatic_Final'];
const data1 = XLSX.utils.sheet_to_json(ws1, {header: 1});
console.log('Sheet: Metastatic_Final');
console.log('Total rows:', data1.length);

console.log('\n--- Row 1 (Merged Title) ---');
console.log('  ' + data1[0][0]);

console.log('\n--- Actual Column Headers (Row 2) ---');
const actualHeaders = data1[1];
actualHeaders.forEach((h, i) => console.log('  Col ' + i + ': "' + h + '"'));

console.log('\n--- Full data preview (first 5 drug rows, starting from Row 3) ---');
for (let r = 2; r < Math.min(7, data1.length); r++) {
  console.log('Row ' + (r+1) + ': ' + JSON.stringify(data1[r]));
}

console.log('\n--- Drug Column Identification ---');
console.log('  Primary drug column: Col 0 = "Drug / Regimen"');

console.log('\n--- 5 Sample Drug Names from "Drug / Regimen" column ---');
for (let r = 2; r < Math.min(7, data1.length); r++) {
  const drugName = data1[r][0];
  console.log('  Row ' + (r+1) + ': ' + drugName);
}

// ============ FILE 2 ============
console.log('\n\n==================== FILE 2: Clinical_Trials_NSCLC_with_PatientPop.xlsx ====================');
const wb2 = XLSX.readFile(file2, {sheets: 'Working Sheet'});
const ws2 = wb2.Sheets['Working Sheet'];
const data2 = XLSX.utils.sheet_to_json(ws2, {header: 1});
console.log('Sheet: Working Sheet');
console.log('Total rows:', data2.length);

console.log('\n--- Column Headers (Row 1) ---');
const headers2 = data2[0];
headers2.forEach((h, i) => console.log('  Col ' + i + ': "' + h + '"'));

console.log('\n--- Full data preview (first 5 data rows) ---');
for (let r = 1; r < Math.min(6, data2.length); r++) {
  console.log('Row ' + (r+1) + ': ' + JSON.stringify(data2[r]));
}

console.log('\n--- Drug Column Identification ---');
console.log('  Primary drug column: Col 4 = "Drug / Regimen"');

console.log('\n--- 5 Sample Drug Names from "Drug / Regimen" column ---');
for (let r = 1; r < Math.min(6, data2.length); r++) {
  const drugName = data2[r][4];
  console.log('  Row ' + (r+1) + ': ' + drugName);
}

// ============ COMPARISON ============
console.log('\n\n==================== COMPARISON OF DRUG NAME FORMATS ====================');

console.log('\n--- File 1: Drug entries (first 20) ---');
for (let r = 2; r < Math.min(22, data1.length); r++) {
  const v = data1[r][0];
  if (v) console.log('  ' + String(v));
}

console.log('\n--- File 2: Drug entries (first 20) ---');
for (let r = 1; r < Math.min(21, data2.length); r++) {
  const v = data2[r][4];
  if (v) console.log('  ' + String(v));
}