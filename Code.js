/*****************************************************************
 RK EVENTS ERP
 Version : 2.0
 File : Code.gs
*****************************************************************/

/***************************************************************
 * SHEET HEADERS
 ***************************************************************/

const SHEET_HEADERS = {

  Config: [
    "Key",
    "Value"
  ],

  Users: [
    "UserID",
    "Name",
    "Email",
    "Role",
    "Status",
    "CreatedOn"
  ],

  Customers: [

    "CustomerID",

    "CustomerName",

    "Mobile",

    "AlternateMobile",

    "Email",

    "Address",

    "Status",

    "CreatedOn"

  ],

  Packages: [

    "PackageID",

    "PackageName",

    "Price",

    "Description",

    "Status",

    "CreatedOn"

  ],

  Bookings: [

    "BookingID",

    "BookingNo",

    "CustomerID",

    "CustomerName",

    "Mobile",

    "AlternateMobile",

    "EventType",

    "EventDate",

    "EventTime",

    "Venue",

    "Requirement",

    "Budget",

    "GoogleMap",

    "AdvanceAmount",

    "BalanceAmount",

    "PaymentStatus",

    "BookingStatus",

    "Remarks",

    "CreatedOn",

    "CreatedBy"

  ],

  Employees: [

    "EmployeeID",

    "EmployeeName",

    "Phone",

    "Email",

    "Designation",

    "Status",

    "CreatedOn"

  ],

  Payments: [

    "PaymentID",

    "BookingID",

    "PaymentDate",

    "PaymentMode",

    "Amount",

    "Remarks"

  ],

  Expenses: [

    "ExpenseID",

    "ExpenseDate",

    "Category",

    "Description",

    "Amount",

    "Remarks"

  ]

};

/***************************************************************
 * WEB APP
 ***************************************************************/

/***************************************************************
 * WEB APP ENTRY
 ***************************************************************/

function doGet(){

  initializeApplication();

  return HtmlService

    .createTemplateFromFile("index")

    .evaluate()

    .setTitle(APP.INFO.NAME)

    .setXFrameOptionsMode(

      HtmlService.XFrameOptionsMode.ALLOWALL

    );

}

/***************************************************************
 * INCLUDE HTML
 ***************************************************************/

function include(file){

  return HtmlService

    .createHtmlOutputFromFile(file)

    .getContent();

}

/***************************************************************
 * INITIALIZATION
 ***************************************************************/

function initializeApplication(){

  initializeSheets();

  initializeUsers();

}

/***************************************************************
 * CREATE HEADERS
 ***************************************************************/

function initializeSheets(){

  Object.keys(SHEET_HEADERS)

    .forEach(function(name){

      const sheet = getSheet(name);

      if(sheet.getLastRow()==0){

        sheet.appendRow(

          SHEET_HEADERS[name]

        );

      }

    });

}

/***************************************************************
 * DASHBOARD
 ***************************************************************/

function getDashboardSummary(){

  const bookings = getAll(APP.SHEETS.BOOKINGS);
  
  Logger.log("getDashboardSummary - Total bookings: " + bookings.length);
  
  const uniqueCustomerIds = {};
  bookings.forEach(function(booking) {
    if (booking.CustomerID) {
      const customerId = String(booking.CustomerID).trim();
      uniqueCustomerIds[customerId] = true;
    }
  });
  
  const customerCount = Object.keys(uniqueCustomerIds).length;
  
  Logger.log("Unique customers: " + customerCount);

  return{

    customers : customerCount,

    bookings :

      getCount(APP.SHEETS.BOOKINGS),

    packages :

      getCount(APP.SHEETS.PACKAGES),

    employees :

      getCount(APP.SHEETS.EMPLOYEES),

    expenses :

      getCount(APP.SHEETS.EXPENSES),

    company :

      APP.INFO.COMPANY

  };

}
/*****************************************************************
 * CUSTOMER MANAGEMENT
 *****************************************************************/

/**
 * Normalize Mobile Number
 * Strips all non-digit characters and validates format
 * @param {string} mobile - Raw mobile number
 * @returns {string} Normalized 10-digit mobile or empty string if invalid
 */
function normalizeMobile(mobile) {
  
  if (!mobile) return "";
  
  const digits = String(mobile).replace(/[^0-9]/g, '');
  
  if (digits.length !== 10) return "";
  
  return digits;
  
}

/**
 * Validate Customer Data
 * Ensures mobile uniqueness and data integrity
 * @param {Object} data - Customer data
 * @param {string} excludeCustomerId - CustomerID to exclude from duplicate check (for updates)
 * @returns {Object} {valid: boolean, error: string}
 */
function validateCustomerData(data, excludeCustomerId) {
  
  const mobile = normalizeMobile(data.mobile);
  
  if (!mobile) {
    return {
      valid: false,
      error: "Mobile number must be exactly 10 digits (numbers only)"
    };
  }
  
  if (!data.customerName || !data.customerName.trim()) {
    return {
      valid: false,
      error: "Customer name is required"
    };
  }
  
  const existingCustomer = findCustomerByMobile(mobile);
  
  if (existingCustomer && existingCustomer.CustomerID !== excludeCustomerId) {
    return {
      valid: false,
      error: "Mobile number " + mobile + " is already registered to " + existingCustomer.CustomerName
    };
  }
  
  return {
    valid: true,
    normalizedMobile: mobile
  };
  
}

/**
 * Find Customer by Mobile
 */
function findCustomerByMobile(mobile){

  const normalizedMobile = normalizeMobile(mobile);
  
  if (!normalizedMobile) return null;

  const customers =
    getAll(APP.SHEETS.CUSTOMERS);

  const customer =
    customers.find(function(c){

      return normalizeMobile(c.Mobile) === normalizedMobile;

    });

  return customer || null;

}

/**
 * Search Customer by Mobile with Booking History
 */
function searchCustomerByMobile(mobile) {

  try {

    Logger.log("=== SEARCH CUSTOMER BY MOBILE ===");
    Logger.log("Mobile received: " + mobile);

    const normalizedMobile = normalizeMobile(mobile);

    Logger.log("Normalized mobile: " + normalizedMobile);

    if (!normalizedMobile) {
      Logger.log("Validation failed: Invalid mobile number");
      return failure("Invalid mobile number");
    }

    Logger.log("Calling findCustomerByMobile()");
    const customer = findCustomerByMobile(normalizedMobile);

    Logger.log("Customer found: " + (customer ? "YES" : "NO"));

    if (!customer) {
      Logger.log("Returning NEW customer");
      return success("New Customer", {
        exists: false,
        isNew: true
      });
    }

    Logger.log("Customer found - CustomerID: " + customer.CustomerID + ", Name: " + customer.CustomerName);

    const allBookings = getAll(APP.SHEETS.BOOKINGS);
    const normalizedBookings = allBookings.map(normalizeBookingObject);
    
    Logger.log("Total bookings in sheet: " + normalizedBookings.length);
    
    const bookings = [];
    const targetCustomerId = String(customer.CustomerID || "").trim();
    
    normalizedBookings.forEach(function(b) {
      const bookingCustomerId = String(b.CustomerID || "").trim();
      
      if (bookingCustomerId === targetCustomerId) {
        bookings.push(b);
      }
    });

    Logger.log("Bookings matched for CustomerID " + targetCustomerId + ": " + bookings.length);

    const totalBookings = bookings.length;
    
    let lastEventDate = "";
    let eventTypes = [];
    
    if (totalBookings > 0) {
      
      bookings.sort(function(a, b) {
        const dateA = a.EventDate ? new Date(a.EventDate) : new Date(0);
        const dateB = b.EventDate ? new Date(b.EventDate) : new Date(0);
        return dateB - dateA;
      });
      
      lastEventDate = bookings[0].EventDate;
      
      eventTypes = [];
      bookings.forEach(function(b) {
        if (b.EventType && eventTypes.indexOf(b.EventType) === -1) {
          eventTypes.push(b.EventType);
        }
      });
    }
    
    Logger.log("Customer History - Total: " + totalBookings + ", Events: " + eventTypes.join(", ") + ", Latest: " + lastEventDate);

    Logger.log("Returning customer history");

    const formatDateValue = function(value) {
      if (!value) return "";
      if (value instanceof Date) {
        return Utilities.formatDate(value, APP.DATE.TIMEZONE, APP.DATE.FORMAT);
      }
      return String(value);
    };
    
    const returnObject = {
      exists: true,
      isNew: false,
      customer: {
        CustomerID: customer.CustomerID || "",
        CustomerName: customer.CustomerName || "",
        Mobile: customer.Mobile || "",
        AlternateMobile: customer.AlternateMobile || "",
        Email: customer.Email || "",
        Address: customer.Address || "",
        CreatedOn: formatDateValue(customer.CreatedOn)
      },
      history: {
        customerSince: formatDateValue(customer.CreatedOn),
        totalBookings: totalBookings,
        lastEventDate: formatDateValue(lastEventDate),
        eventTypes: eventTypes.join(", ")
      }
    };

    return success("Existing Customer", returnObject);

  } catch (e) {
    Logger.log("ERROR in searchCustomerByMobile: " + e.message);
    return failure(e.message);
  }

}

/**
 * Generate Customer ID
 */
/*****************************************************************
 * DEBUG UTILITY - TEST CUSTOMER HISTORY
 *****************************************************************/

/**
 * Test function to verify customer history calculation
 * Run this from Apps Script to debug
 * 
 * USAGE: Change the mobile number below and click Run
 */
function testCustomerHistory() {
  
  // ⚠️ CHANGE THIS TO YOUR TEST MOBILE NUMBER ⚠️
  const mobile = "7358390899";  
  
  Logger.log("=== TEST CUSTOMER HISTORY ===");
  Logger.log("Testing mobile: " + mobile);
  
  const result = searchCustomerByMobile(mobile);
  
  Logger.log("Result success: " + result.success);
  
  if (result.data) {
    Logger.log("Result data: " + JSON.stringify(result.data));
    
    if (result.data.history) {
      const history = result.data.history;
      Logger.log("--- HISTORY DETAILS ---");
      Logger.log("Total Bookings: " + history.totalBookings);
      Logger.log("Last Event Date: " + history.lastEventDate);
      Logger.log("Previous Events: " + history.eventTypes);
      Logger.log("Customer Since: " + history.customerSince);
    }
  }
  
  return result;
  
}

/**
 * Normalize object keys to match expected property names
 * Handles case-insensitive matching of common booking properties
 */
function normalizeBookingObject(obj) {
  
  const normalized = {};
  
  const keyMap = {
    'bookingid': 'BookingID',
    'bookingno': 'BookingNo',
    'customerid': 'CustomerID',
    'customername': 'CustomerName',
    'mobile': 'Mobile',
    'alternatemobile': 'AlternateMobile',
    'eventtype': 'EventType',
    'eventdate': 'EventDate',
    'eventtime': 'EventTime',
    'venue': 'Venue',
    'requirement': 'Requirement',
    'budget': 'Budget',
    'googlemap': 'GoogleMap',
    'advanceamount': 'AdvanceAmount',
    'balanceamount': 'BalanceAmount',
    'paymentstatus': 'PaymentStatus',
    'bookingstatus': 'BookingStatus',
    'remarks': 'Remarks',
    'createdon': 'CreatedOn',
    'createdby': 'CreatedBy'
  };
  
  Object.keys(obj).forEach(function(key) {
    const lowerKey = String(key).trim().toLowerCase();
    const standardKey = keyMap[lowerKey] || key;
    normalized[standardKey] = obj[key];
  });
  
  return normalized;
  
}

/*****************************************************************
 * ID GENERATION - SEQUENTIAL FORMAT
 *****************************************************************/

/**
 * Generate Sequential Customer ID
 * Format: CUS00001, CUS00002, etc.
 * Always reads current max ID from sheet
 */
function generateCustomerId(){

  const customers = getAll(APP.SHEETS.CUSTOMERS);
  
  let maxNo = 0;
  
  customers.forEach(function(customer) {
    if (customer.CustomerID && customer.CustomerID.startsWith("CUS")) {
      const numPart = parseInt(customer.CustomerID.substring(3));
      if (!isNaN(numPart) && numPart > maxNo) {
        maxNo = numPart;
      }
    }
  });
  
  const nextNo = maxNo + 1;

  return "CUS" + String(nextNo).padStart(5, "0");

}

/**
 * Generate Sequential Booking ID
 * Format: BK000001, BK000002, etc.
 * Always reads current max ID from sheet
 */
function generateBookingId(){

  const bookings = getAll(APP.SHEETS.BOOKINGS);
  
  let maxNo = 0;
  
  bookings.forEach(function(booking) {
    if (booking.BookingID && booking.BookingID.startsWith("BK")) {
      const numPart = parseInt(booking.BookingID.substring(2));
      if (!isNaN(numPart) && numPart > maxNo) {
        maxNo = numPart;
      }
    }
  });
  
  const nextNo = maxNo + 1;

  return "BK" + String(nextNo).padStart(6, "0");

}

/**
 * Generate Sequential Booking Number
 * Format: RKB00001, RKB00002, etc.
 * Always reads current max number from sheet
 */
function generateBookingNumber(){

  const bookings =
      getAll(APP.SHEETS.BOOKINGS);

  let maxNo = 0;
  
  bookings.forEach(function(booking) {
    if (booking.BookingNo && booking.BookingNo.startsWith("RKB")) {
      const numPart = parseInt(booking.BookingNo.substring(3));
      if (!isNaN(numPart) && numPart > maxNo) {
        maxNo = numPart;
      }
    }
  });
  
  const nextNo = maxNo + 1;

  return "RKB" +

      String(nextNo).padStart(5,"0");

}

/**
 * Create Customer Automatically
 * BUSINESS RULE: Mobile Number is unique - one mobile = one customer
 * If mobile exists, reuse CustomerID and update details
 * If mobile is new, create new customer with new CustomerID
 */
function createCustomer(data){

  const normalizedMobile = normalizeMobile(data.mobile);
  
  if (!normalizedMobile) {
    throw new Error("Invalid mobile number format");
  }

  const existing = findCustomerByMobile(normalizedMobile);

  if(existing){

      Logger.log("Customer exists - Reusing CustomerID: " + existing.CustomerID);

      update(
        APP.SHEETS.CUSTOMERS,
        "CustomerID",
        existing.CustomerID,
        {
          CustomerName: data.customerName,
          Mobile: normalizedMobile,
          AlternateMobile: data.alternateMobile || ""
        }
      );

      return existing.CustomerID;

  }

  const customerId = generateCustomerId();
  
  Logger.log("Creating new customer - CustomerID: " + customerId + ", Mobile: " + normalizedMobile);

  insert(

      APP.SHEETS.CUSTOMERS,

      {

        CustomerID : customerId,

        CustomerName : data.customerName,

        Mobile : normalizedMobile,

        AlternateMobile :
            data.alternateMobile || "",

        Email : "",

        Address : "",

        Status : "Active",

        CreatedOn : now()

      }

  );

  return customerId;

}

/*****************************************************************
 * SAVE BOOKING
 *****************************************************************/

function saveBooking(data){

  try{

    if(!data.customerName)
      return failure("Customer Name is required.");

    if(!data.mobile)
      return failure("Mobile Number is required.");

    const normalizedMobile = normalizeMobile(data.mobile);
    
    if(!normalizedMobile)
      return failure("Mobile Number must be exactly 10 digits (numbers only).");

    if(!data.eventType)
      return failure("Event Type is required.");

    if(!data.eventDate)
      return failure("Event Date is required.");

    data.mobile = normalizedMobile;

    const customerId =
      createCustomer(data);

    const bookingId =
      generateBookingId();

    const bookingNo =
      generateBookingNumber();

    insert(

      APP.SHEETS.BOOKINGS,

      {

        BookingID : bookingId,

        BookingNo : bookingNo,

        CustomerID : customerId,

        CustomerName : data.customerName,

        Mobile : normalizedMobile,

        AlternateMobile :
          data.alternateMobile,

        EventType :
          data.eventType,

        EventDate :
          data.eventDate,

        EventTime :
          data.eventTime,

        Venue :
          data.venue,

        Requirement :
          data.requirement,

        Budget :
          Number(data.budget || 0),

        GoogleMap :
          data.googleMap,

        AdvanceAmount :
          Number(data.advanceAmount || 0),

        BalanceAmount :
          Number(data.balanceAmount || 0),

        PaymentStatus :
          data.paymentStatus,

        BookingStatus :
          data.bookingStatus,

        Remarks :
          data.remarks || "",

        CreatedOn :
          now(),

        CreatedBy :
          getCurrentUserEmail()

      }

    );

    return success(

      "Booking Saved Successfully",

      {

        BookingID : bookingId,

        BookingNo : bookingNo

      }

    );

  }

  catch(e){

    return failure(e.message);

  }

}
/*****************************************************************
 * GET BOOKING LIST
 *****************************************************************/

function getBookingList() {

  const bookings = getAll(APP.SHEETS.BOOKINGS);

  Logger.log("Bookings length = " + bookings.length);

  const serializedBookings = bookings.map(function(booking) {
    const result = {};
    for (var key in booking) {
      if (booking.hasOwnProperty(key)) {
        var value = booking[key];
        if (value instanceof Date) {
          result[key] = Utilities.formatDate(
            value,
            APP.DATE.TIMEZONE,
            APP.DATE.DATETIME
          );
        } else if (value === null || value === undefined) {
          result[key] = "";
        } else {
          result[key] = value;
        }
      }
    }
    return result;
  });

  Logger.log("Serialized bookings length = " + serializedBookings.length);

  return {
    success: true,
    message: "Success",
    data: serializedBookings
  };

}

/*****************************************************************
 * GET BOOKING
 *****************************************************************/

function getBookingById(bookingId) {

  try {

    const booking = findOne(

      APP.SHEETS.BOOKINGS,

      "BookingID",

      bookingId

    );

    if (!booking) {

      return failure("Booking not found.");

    }

    const serializedBooking = {};
    for (var key in booking) {
      if (booking.hasOwnProperty(key)) {
        var value = booking[key];
        if (value instanceof Date) {
          if (key === "EventDate") {
            serializedBooking[key] = Utilities.formatDate(
              value,
              APP.DATE.TIMEZONE,
              "yyyy-MM-dd"
            );
          } else {
            serializedBooking[key] = Utilities.formatDate(
              value,
              APP.DATE.TIMEZONE,
              APP.DATE.DATETIME
            );
          }
        } else if (value === null || value === undefined) {
          serializedBooking[key] = "";
        } else {
          serializedBooking[key] = value;
        }
      }
    }

    return success(

      "Success",

      serializedBooking

    );

  }
  catch (e) {

    return failure(e.message);

  }

}

/*****************************************************************
 * DELETE BOOKING
 *****************************************************************/

function deleteBooking(bookingId) {

  try {

    if (!bookingId) {
      return failure("Booking ID is required.");
    }

    const existing = findOne(
      APP.SHEETS.BOOKINGS,
      "BookingID",
      bookingId
    );

    if (!existing) {
      return failure("Booking not found.");
    }

    const customerId = existing.CustomerID;

    Logger.log("DELETE: CustomerID = " + customerId);
    Logger.log("DELETE: Deleting booking " + bookingId);

    const deleted = remove(
      APP.SHEETS.BOOKINGS,
      "BookingID",
      bookingId
    );

    if (!deleted) {
      return failure("Failed to delete booking.");
    }

    Logger.log("DELETE: Booking deleted successfully");

    const remainingBookings = filterRecords(
      APP.SHEETS.BOOKINGS,
      function(booking) {
        return booking.CustomerID == customerId;
      }
    );

    Logger.log("DELETE: Remaining bookings for customer = " + remainingBookings.length);

    if (remainingBookings.length === 0) {
      Logger.log("DELETE: No remaining bookings, deleting customer " + customerId);
      const customerDeleted = remove(
        APP.SHEETS.CUSTOMERS,
        "CustomerID",
        customerId
      );
      Logger.log("DELETE: Customer deletion result = " + customerDeleted);
    } else {
      Logger.log("DELETE: Customer has " + remainingBookings.length + " remaining bookings, keeping customer");
    }

    writeLog(
      "DELETE_BOOKING",
      "Deleted booking: " + existing.BookingNo + ", Customer: " + customerId + ", Remaining: " + remainingBookings.length
    );

    return success(
      "Booking Deleted Successfully"
    );

  }
  catch (e) {

    return failure(e.message);

  }

}

/*****************************************************************
 * EDIT BOOKING
 *****************************************************************/

function updateBooking(data) {

  try {

    if (!data.bookingId)
      return failure("Booking ID is required.");

    if (!data.customerName)
      return failure("Customer Name is required.");

    if (!data.mobile)
      return failure("Mobile Number is required.");

    if (!data.eventType)
      return failure("Event Type is required.");

    if (!data.eventDate)
      return failure("Event Date is required.");

    const existing = findOne(
      APP.SHEETS.BOOKINGS,
      "BookingID",
      data.bookingId
    );

    if (!existing) {
      return failure("Booking not found.");
    }

    const customerId = createCustomer(data);

    const updated = update(
      APP.SHEETS.BOOKINGS,
      "BookingID",
      data.bookingId,
      {
        CustomerID: customerId,
        CustomerName: data.customerName,
        Mobile: data.mobile,
        AlternateMobile: data.alternateMobile,
        EventType: data.eventType,
        EventDate: data.eventDate,
        EventTime: data.eventTime,
        Venue: data.venue,
        Requirement: data.requirement,
        Budget: Number(data.budget || 0),
        GoogleMap: data.googleMap,
        AdvanceAmount: Number(data.advanceAmount || 0),
        BalanceAmount: Number(data.balanceAmount || 0),
        PaymentStatus: data.paymentStatus,
        BookingStatus: data.bookingStatus,
        Remarks: data.remarks || ""
      }
    );

    if (!updated) {
      return failure("Failed to update booking.");
    }

    return success(
      "Booking Updated Successfully",
      { BookingID: data.bookingId }
    );

  }
  catch (e) {

    return failure(e.message);

  }

}

/*****************************************************************
 * ADMIN UTILITY - RESET DEVELOPMENT DATA
 *****************************************************************/

/**
 * Development Utility - Reset Development Database
 * Clears all test data from Bookings and Customers sheets
 * Preserves headers and sheet structure
 * @returns {Object} {success: boolean, bookingsDeleted: number, customersDeleted: number}
 */
function resetDevelopmentData() {
  
  try {
    
    Logger.log("=== RESET DEVELOPMENT DATA ===");
    Logger.log("Timestamp: " + new Date().toISOString());
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    
    const bookingsSheet = ss.getSheetByName(APP.SHEETS.BOOKINGS);
    const customersSheet = ss.getSheetByName(APP.SHEETS.CUSTOMERS);
    
    let bookingsDeleted = 0;
    let customersDeleted = 0;
    
    if (bookingsSheet) {
      const lastRow = bookingsSheet.getLastRow();
      Logger.log("Bookings sheet - Last row: " + lastRow);
      
      if (lastRow > 1) {
        bookingsSheet.deleteRows(2, lastRow - 1);
        bookingsDeleted = lastRow - 1;
        Logger.log("Deleted " + bookingsDeleted + " booking rows");
      } else {
        Logger.log("Bookings already empty");
      }
    } else {
      Logger.log("ERROR: Bookings sheet not found");
    }
    
    if (customersSheet) {
      const lastRow = customersSheet.getLastRow();
      Logger.log("Customers sheet - Last row: " + lastRow);
      
      if (lastRow > 1) {
        customersSheet.deleteRows(2, lastRow - 1);
        customersDeleted = lastRow - 1;
        Logger.log("Deleted " + customersDeleted + " customer rows");
      } else {
        Logger.log("Customers already empty");
      }
    } else {
      Logger.log("ERROR: Customers sheet not found");
    }
    
    Logger.log("=== CLEANUP COMPLETE ===");
    Logger.log("Bookings deleted: " + bookingsDeleted);
    Logger.log("Customers deleted: " + customersDeleted);
    
    return {
      success: true,
      bookingsDeleted: bookingsDeleted,
      customersDeleted: customersDeleted
    };
    
  } catch (e) {
    
    Logger.log("ERROR during cleanup: " + e.message);
    Logger.log("Stack trace: " + e.stack);
    
    return {
      success: false,
      bookingsDeleted: 0,
      customersDeleted: 0
    };
    
  }
  
}

/*****************************************************************
 * ADMIN UTILITY - REPAIR DATABASE INTEGRITY
 *****************************************************************/

/**
 * Repairs database integrity issues
 * Fixes duplicate CustomerIDs, duplicate mobiles, and inconsistent data
 * Rebuilds Customer Master as single source of truth
 * @returns {Object} Repair report
 */
function repairDatabase() {
  
  try {
    
    Logger.log("=== DATABASE REPAIR STARTED ===");
    Logger.log("Timestamp: " + new Date().toISOString());
    
    const bookings = getAll(APP.SHEETS.BOOKINGS);
    
    Logger.log("Total bookings found: " + bookings.length);
    
    const mobileGroups = {};
    
    bookings.forEach(function(booking) {
      const mobile = normalizeMobile(booking.Mobile);
      
      if (!mobile) {
        Logger.log("WARNING: Booking " + booking.BookingNo + " has invalid mobile");
        return;
      }
      
      if (!mobileGroups[mobile]) {
        mobileGroups[mobile] = {
          mobile: mobile,
          bookings: [],
          customerNames: [],
          customerIds: []
        };
      }
      
      mobileGroups[mobile].bookings.push(booking);
      
      if (booking.CustomerName && mobileGroups[mobile].customerNames.indexOf(booking.CustomerName) === -1) {
        mobileGroups[mobile].customerNames.push(booking.CustomerName);
      }
      
      if (booking.CustomerID && mobileGroups[mobile].customerIds.indexOf(booking.CustomerID) === -1) {
        mobileGroups[mobile].customerIds.push(booking.CustomerID);
      }
    });
    
    Logger.log("Unique mobile numbers found: " + Object.keys(mobileGroups).length);
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const customersSheet = ss.getSheetByName(APP.SHEETS.CUSTOMERS);
    const bookingsSheet = ss.getSheetByName(APP.SHEETS.BOOKINGS);
    
    customersSheet.deleteRows(2, Math.max(1, customersSheet.getLastRow() - 1));
    Logger.log("Cleared existing customer master");
    
    let customersCreated = 0;
    let bookingsUpdated = 0;
    let duplicateMobilesFixed = 0;
    let duplicateCustomerIdsFixed = 0;
    
    Object.keys(mobileGroups).forEach(function(mobile) {
      const group = mobileGroups[mobile];
      
      if (group.customerNames.length > 1) {
        Logger.log("WARNING: Multiple names for mobile " + mobile + ": " + group.customerNames.join(", "));
        duplicateMobilesFixed++;
      }
      
      if (group.customerIds.length > 1) {
        Logger.log("WARNING: Multiple CustomerIDs for mobile " + mobile + ": " + group.customerIds.join(", "));
        duplicateCustomerIdsFixed++;
      }
      
      const primaryCustomerName = group.customerNames[0] || "Unknown";
      const newCustomerId = generateCustomerId();
      
      const customerRow = {
        CustomerID: newCustomerId,
        CustomerName: primaryCustomerName,
        Mobile: mobile,
        AlternateMobile: "",
        Email: "",
        Address: "",
        Status: "Active",
        CreatedOn: now()
      };
      
      insert(APP.SHEETS.CUSTOMERS, customerRow);
      customersCreated++;
      
      Logger.log("Created customer: " + newCustomerId + " for mobile " + mobile);
      
      group.bookings.forEach(function(booking) {
        update(
          APP.SHEETS.BOOKINGS,
          "BookingID",
          booking.BookingID,
          {
            CustomerID: newCustomerId,
            CustomerName: primaryCustomerName,
            Mobile: mobile
          }
        );
        bookingsUpdated++;
      });
    });
    
    Logger.log("=== DATABASE REPAIR COMPLETE ===");
    Logger.log("Customers created: " + customersCreated);
    Logger.log("Bookings updated: " + bookingsUpdated);
    Logger.log("Duplicate mobiles fixed: " + duplicateMobilesFixed);
    Logger.log("Duplicate CustomerIDs fixed: " + duplicateCustomerIdsFixed);
    
    return {
      success: true,
      customersCreated: customersCreated,
      bookingsUpdated: bookingsUpdated,
      duplicateMobilesFixed: duplicateMobilesFixed,
      duplicateCustomerIdsFixed: duplicateCustomerIdsFixed
    };
    
  } catch (e) {
    
    Logger.log("ERROR during repair: " + e.message);
    Logger.log("Stack trace: " + e.stack);
    
    return {
      success: false,
      error: e.message
    };
    
  }
  
}

/*****************************************************************
 * ADMIN UTILITY - MIGRATE TO SEQUENTIAL IDS
 *****************************************************************/

/**
 * Migrate existing data from timestamp/UUID IDs to sequential IDs
 * Converts CustomerID and BookingID to new format
 * Maintains all referential integrity
 * @returns {Object} Migration report
 */
function migrateToSequentialIds() {
  
  try {
    
    Logger.log("=== ID MIGRATION STARTED ===");
    Logger.log("Timestamp: " + new Date().toISOString());
    
    const customers = getAll(APP.SHEETS.CUSTOMERS);
    const bookings = getAll(APP.SHEETS.BOOKINGS);
    
    Logger.log("Found " + customers.length + " customers");
    Logger.log("Found " + bookings.length + " bookings");
    
    const customerIdMap = {};
    
    let customersMigrated = 0;
    let customerIdCounter = 1;
    
    customers.forEach(function(customer) {
      const oldCustomerId = customer.CustomerID;
      const newCustomerId = "CUS" + String(customerIdCounter).padStart(5, "0");
      
      customerIdMap[oldCustomerId] = newCustomerId;
      
      update(
        APP.SHEETS.CUSTOMERS,
        "CustomerID",
        oldCustomerId,
        {
          CustomerID: newCustomerId
        }
      );
      
      Logger.log("Migrated Customer: " + oldCustomerId + " -> " + newCustomerId);
      
      customerIdCounter++;
      customersMigrated++;
    });
    
    Logger.log("Customer migration complete: " + customersMigrated + " customers");
    
    let bookingsMigrated = 0;
    let bookingIdCounter = 1;
    let bookingNoCounter = 1;
    
    bookings.forEach(function(booking) {
      const oldBookingId = booking.BookingID;
      const oldCustomerId = booking.CustomerID;
      
      const newBookingId = "BK" + String(bookingIdCounter).padStart(6, "0");
      const newCustomerId = customerIdMap[oldCustomerId] || oldCustomerId;
      
      let newBookingNo = booking.BookingNo;
      
      if (!newBookingNo || !newBookingNo.startsWith("RKB")) {
        newBookingNo = "RKB" + String(bookingNoCounter).padStart(5, "0");
      }
      
      update(
        APP.SHEETS.BOOKINGS,
        "BookingID",
        oldBookingId,
        {
          BookingID: newBookingId,
          CustomerID: newCustomerId,
          BookingNo: newBookingNo
        }
      );
      
      Logger.log("Migrated Booking: " + oldBookingId + " -> " + newBookingId);
      Logger.log("  Updated CustomerID: " + oldCustomerId + " -> " + newCustomerId);
      
      bookingIdCounter++;
      bookingNoCounter++;
      bookingsMigrated++;
    });
    
    Logger.log("Booking migration complete: " + bookingsMigrated + " bookings");
    
    const highestCustomerId = "CUS" + String(customerIdCounter - 1).padStart(5, "0");
    const highestBookingId = "BK" + String(bookingIdCounter - 1).padStart(6, "0");
    const highestBookingNo = "RKB" + String(bookingNoCounter - 1).padStart(5, "0");
    
    Logger.log("=== MIGRATION COMPLETE ===");
    Logger.log("Customers migrated: " + customersMigrated);
    Logger.log("Bookings migrated: " + bookingsMigrated);
    Logger.log("Highest CustomerID: " + highestCustomerId);
    Logger.log("Highest BookingID: " + highestBookingId);
    Logger.log("Highest BookingNo: " + highestBookingNo);
    
    return {
      success: true,
      customersMigrated: customersMigrated,
      bookingsMigrated: bookingsMigrated,
      highestCustomerId: highestCustomerId,
      highestBookingId: highestBookingId,
      highestBookingNo: highestBookingNo
    };
    
  } catch (e) {
    
    Logger.log("ERROR during migration: " + e.message);
    Logger.log("Stack trace: " + e.stack);
    
    return {
      success: false,
      error: e.message
    };
    
  }
  
}