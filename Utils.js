/*****************************************************************
 * RK EVENTS ERP
 * Version : 1.0
 * File    : Utils.gs
 *****************************************************************/

/**
 * Success Response
 * @param {string} message
 * @param {*} data
 * @returns {Object}
 */
function success(message, data) {

  return {

    success: true,

    message: message || "Success",

    data: data || null

  };

}

/**
 * Error Response
 * @param {string} message
 * @returns {Object}
 */
function failure(message) {

  return {

    success: false,

    message: message || "Something went wrong."

  };

}

/**
 * Returns true if value is empty.
 * @param {*} value
 * @returns {boolean}
 */
function isEmpty(value) {

  return value === null ||
         value === undefined ||
         value === "";

}

/**
 * Returns safe value.
 * @param {*} value
 * @returns {*}
 */
function safe(value){

  return isEmpty(value)
    ? ""
    : value;

}

/**
 * Format Date
 * @param {Date|string} value
 * @returns {string}
 */
function formatDate(value){

  if(isEmpty(value))
    return "";

  return Utilities.formatDate(

    new Date(value),

    APP.DATE.TIMEZONE,

    APP.DATE.FORMAT

  );

}

/**
 * Format Date Time
 * @param {Date|string} value
 * @returns {string}
 */
function formatDateTime(value){

  if(isEmpty(value))
    return "";

  return Utilities.formatDate(

    new Date(value),

    APP.DATE.TIMEZONE,

    APP.DATE.DATETIME

  );

}

/**
 * Returns current login email.
 * @returns {string}
 */
function getLoginUser(){

  return Session
    .getActiveUser()
    .getEmail();

}

/**
 * Generate UUID
 * @returns {string}
 */
function uuid(){

  return Utilities.getUuid();

}

/**
 * Company Information
 * @returns {Object}
 */
function getCompany(){

  return APP.INFO;

}

/**
 * Application Information
 * @returns {Object}
 */
function getApplication(){

  return {

    name: APP.INFO.NAME,

    version: APP.INFO.VERSION,

    company: APP.INFO.COMPANY

  };

}

/**
 * Ping
 * Used for testing server connection.
 */
function ping(){

  return success(

    "RK Events ERP Connected Successfully."

  );

}