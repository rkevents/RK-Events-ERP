/*****************************************************************
 * RK EVENTS ERP
 * Version : 1.0
 * File    : Database.gs
 *****************************************************************/

/**
 * Opens the configured spreadsheet.
 * @returns {Spreadsheet}
 */
function getDatabase() {
  return SpreadsheetApp.openById(APP.DATABASE.SPREADSHEET_ID);
}

/**
 * Returns a sheet by name.
 * @param {string} sheetName
 * @returns {GoogleAppsScript.Spreadsheet.Sheet}
 */
function getSheet(sheetName) {

  const sheet = getDatabase().getSheetByName(sheetName);

  if (!sheet) {
    throw new Error("Sheet not found : " + sheetName);
  }

  return sheet;

}

/**
 * Returns header row.
 * @param {string} sheetName
 * @returns {Array}
 */
function getHeaders(sheetName) {

  const sheet = getSheet(sheetName);

  if (sheet.getLastColumn() === 0) {
    return [];
  }

  return sheet
    .getRange(1, 1, 1, sheet.getLastColumn())
    .getValues()[0];

}

/**
 * Returns all rows as objects.
 * @param {string} sheetName
 * @returns {Array<Object>}
 */
function getAll(sheetName) {

  const sheet = getSheet(sheetName);

  if (sheet.getLastRow() <= 1) {
    return [];
  }

  const values = sheet.getDataRange().getValues();

  const headers = values.shift();

  return values.map(function (row) {

    let obj = {};

    headers.forEach(function (header, index) {

      obj[header] = row[index];

    });

    return obj;

  });

}

/**
 * Count rows excluding header.
 * @param {string} sheetName
 * @returns {number}
 */
function getCount(sheetName) {

  return getAll(sheetName).length;

}

/**
 * Find first matching record.
 * @param {string} sheetName
 * @param {string} field
 * @param {*} value
 * @returns {Object|null}
 */
function findOne(sheetName, field, value) {

  const rows = getAll(sheetName);

  for (let i = 0; i < rows.length; i++) {

    if (rows[i][field] == value) {

      return rows[i];

    }

  }

  return null;

}

/**
 * Returns true if record exists.
 * @param {string} sheetName
 * @param {string} field
 * @param {*} value
 * @returns {boolean}
 */
function exists(sheetName, field, value) {

  return findOne(sheetName, field, value) !== null;

}
/**
 * Insert one record.
 * @param {string} sheetName
 * @param {Object} data
 */
function insert(sheetName, data) {

  const sheet = getSheet(sheetName);

  const headers = getHeaders(sheetName);

  if (headers.length === 0) {
    throw new Error("Header row not found in " + sheetName);
  }

  const row = headers.map(function (header) {
    return data.hasOwnProperty(header) ? data[header] : "";
  });

  sheet.appendRow(row);

  return true;

}

/**
 * Insert multiple records.
 * @param {string} sheetName
 * @param {Array<Object>} dataList
 */
function insertMany(sheetName, dataList) {

  if (!dataList || dataList.length === 0) {
    return;
  }

  const sheet = getSheet(sheetName);

  const headers = getHeaders(sheetName);

  const rows = dataList.map(function (item) {

    return headers.map(function (header) {

      return item.hasOwnProperty(header)
        ? item[header]
        : "";

    });

  });

  sheet.getRange(
    sheet.getLastRow() + 1,
    1,
    rows.length,
    headers.length
  ).setValues(rows);

}

/**
 * Update a record.
 * @param {string} sheetName
 * @param {string} idField
 * @param {*} idValue
 * @param {Object} data
 */
function update(sheetName, idField, idValue, data) {

  const sheet = getSheet(sheetName);

  const values = sheet.getDataRange().getValues();

  if (values.length <= 1) {
    return false;
  }

  const headers = values[0];

  const idIndex = headers.indexOf(idField);

  if (idIndex === -1) {
    throw new Error("Invalid ID Field : " + idField);
  }

  for (let r = 1; r < values.length; r++) {

    if (values[r][idIndex] == idValue) {

      headers.forEach(function (header, c) {

        if (data.hasOwnProperty(header)) {
          values[r][c] = data[header];
        }

      });

      sheet
        .getRange(r + 1, 1, 1, headers.length)
        .setValues([values[r]]);

      return true;

    }

  }

  return false;

}

/**
 * Delete a record.
 * @param {string} sheetName
 * @param {string} idField
 * @param {*} idValue
 */
function remove(sheetName, idField, idValue) {

  const sheet = getSheet(sheetName);

  const values = sheet.getDataRange().getValues();

  const headers = values[0];

  const idIndex = headers.indexOf(idField);

  if (idIndex === -1) {
    return false;
  }

  for (let r = 1; r < values.length; r++) {

    if (values[r][idIndex] == idValue) {

      sheet.deleteRow(r + 1);

      return true;

    }

  }

  return false;

}

/**
 * Clear all data except header.
 * @param {string} sheetName
 */
function clearSheet(sheetName) {

  const sheet = getSheet(sheetName);

  if (sheet.getLastRow() <= 1) {
    return;
  }

  sheet.getRange(
    2,
    1,
    sheet.getLastRow() - 1,
    sheet.getLastColumn()
  ).clearContent();

}
/**
 * Generate ID
 * Example:
 * CUS20260705153010
 *
 * @param {string} prefix
 * @returns {string}
 */
function generateId(prefix) {

  return prefix +
    Utilities.formatDate(
      new Date(),
      APP.DATE.TIMEZONE,
      "yyyyMMddHHmmss"
    );

}

/**
 * Returns today's date
 * @returns {string}
 */
function today() {

  return Utilities.formatDate(
    new Date(),
    APP.DATE.TIMEZONE,
    APP.DATE.FORMAT
  );

}

/**
 * Returns current timestamp
 * @returns {string}
 */
function now() {

  return Utilities.formatDate(
    new Date(),
    APP.DATE.TIMEZONE,
    APP.DATE.DATETIME
  );

}

/**
 * Filter records
 *
 * Example:
 * filterRecords(
 *   APP.SHEETS.CUSTOMERS,
 *   row => row.Status === "Active"
 * );
 */
function filterRecords(sheetName, callback) {

  return getAll(sheetName).filter(callback);

}

/**
 * Sort records
 *
 * Example:
 * sortRecords(
 *   APP.SHEETS.CUSTOMERS,
 *   "CustomerName"
 * );
 */
function sortRecords(sheetName, field) {

  return getAll(sheetName).sort(function(a,b){

    if(a[field] < b[field]) return -1;

    if(a[field] > b[field]) return 1;

    return 0;

  });

}

/**
 * Write Log
 */
function writeLog(action, remarks){

  try{

    insert(APP.SHEETS.LOGS,{

      DateTime : now(),

      User : Session.getActiveUser().getEmail(),

      Action : action,

      Remarks : remarks

    });

  }catch(e){

    Logger.log(e);

  }

}

/**
 * Validate Sheet
 */
function validateSheet(sheetName){

  const sheet = getSheet(sheetName);

  if(sheet.getLastRow() === 0){

    throw new Error(
      sheetName +
      " does not contain headers."
    );

  }

  return true;

}

/**
 * Validate Database
 */
function validateDatabase(){

  Object.keys(APP.SHEETS).forEach(function(key){

    validateSheet(APP.SHEETS[key]);

  });

  return true;

}