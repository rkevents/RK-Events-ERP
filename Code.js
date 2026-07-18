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

    "PaymentDate",

    "PaymentMode",

    "PaymentRemarks",

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

  // BUSINESS RULE: Customer count MUST come from Customer Master (not Booking sheet)
  const customerCount = getCount(APP.SHEETS.CUSTOMERS);
  
  Logger.log("getDashboardSummary - Customer count from Customer Master: " + customerCount);

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

    Logger.log("========================================");
    Logger.log("BACKEND: searchCustomerByMobile CALLED");
    Logger.log("========================================");
    Logger.log("1. INPUT: mobile = " + mobile);
    Logger.log("   Type: " + typeof mobile);

    const normalizedMobile = normalizeMobile(mobile);

    Logger.log("2. NORMALIZED: " + normalizedMobile);

    if (!normalizedMobile) {
      Logger.log("3. VALIDATION FAILED");
      return failure("Invalid mobile number");
    }

    Logger.log("3. CALLING findCustomerByMobile()");
    const customer = findCustomerByMobile(normalizedMobile);

    Logger.log("4. CUSTOMER OBJECT RETURNED:");
    Logger.log(JSON.stringify(customer));

    if (!customer) {
      Logger.log("5. NEW CUSTOMER - Returning");
      return success("New Customer", {
        exists: false,
        isNew: true
      });
    }

    Logger.log("5. EXISTING CUSTOMER FOUND");
    Logger.log("   CustomerID: " + customer.CustomerID);
    Logger.log("   CustomerName: " + customer.CustomerName);
    Logger.log("   Mobile: " + customer.Mobile);

    Logger.log("6. CALLING getAll(BOOKINGS)");
    const allBookings = getAll(APP.SHEETS.BOOKINGS);
    Logger.log("7. NUMBER OF BOOKINGS LOADED: " + allBookings.length);
    
    Logger.log("8. NORMALIZING BOOKING OBJECTS");
    const normalizedBookings = allBookings.map(normalizeBookingObject);
    
    Logger.log("9. FILTERING BY MOBILE NUMBER (not CustomerID)");
    const targetMobile = normalizeMobile(customer.Mobile);
    Logger.log("   Target Mobile: " + targetMobile);
    
    const bookings = [];
    
    normalizedBookings.forEach(function(b) {
      const bookingMobile = normalizeMobile(b.Mobile);
      
      if (bookingMobile === targetMobile) {
        Logger.log("    MATCH FOUND: BookingNo=" + b.BookingNo + ", Mobile=" + bookingMobile);
        bookings.push(b);
      }
    });

    Logger.log("11. NUMBER OF MATCHED BOOKINGS: " + bookings.length);

    const totalBookings = bookings.length;
    
    Logger.log("12. CALCULATING HISTORY");
    Logger.log("    totalBookings = " + totalBookings);
    
    let lastEventDate = "";
    let eventTypes = [];
    let outstandingBalance = 0;
    let isRepeatCustomer = totalBookings > 1;
    
    if (totalBookings > 0) {
      
      bookings.sort(function(a, b) {
        const dateA = a.EventDate ? new Date(a.EventDate) : new Date(0);
        const dateB = b.EventDate ? new Date(b.EventDate) : new Date(0);
        return dateB - dateA;
      });
      
      lastEventDate = bookings[0].EventDate;
      Logger.log("    lastEventDate = " + lastEventDate);
      
      eventTypes = [];
      bookings.forEach(function(b) {
        if (b.EventType && eventTypes.indexOf(b.EventType) === -1) {
          eventTypes.push(b.EventType);
          Logger.log("    eventType added: " + b.EventType);
        }
        
        // Calculate outstanding balance
        const balance = parseFloat(b.BalanceAmount) || 0;
        outstandingBalance += balance;
      });
    }
    
    Logger.log("13. FINAL VALUES:");
    Logger.log("    totalBookings = " + totalBookings);
    Logger.log("    eventTypes = " + eventTypes.join(", "));
    Logger.log("    lastEventDate = " + lastEventDate);
    Logger.log("    outstandingBalance = " + outstandingBalance);
    Logger.log("    isRepeatCustomer = " + isRepeatCustomer);

    const formatDateValue = function(value) {
      if (!value) return "";
      if (value instanceof Date) {
        return Utilities.formatDate(value, APP.DATE.TIMEZONE, APP.DATE.FORMAT);
      }
      return String(value);
    };
    
    const historyObject = {
      customerSince: formatDateValue(customer.CreatedOn),
      totalBookings: totalBookings,
      lastEventDate: formatDateValue(lastEventDate),
      eventTypes: eventTypes.join(", "),
      outstandingBalance: outstandingBalance,
      isRepeatCustomer: isRepeatCustomer
    };
    
    Logger.log("14. HISTORY OBJECT CREATED:");
    Logger.log(JSON.stringify(historyObject));
    
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
      history: historyObject
    };
    
    Logger.log("15. RETURN OBJECT TO FRONTEND:");
    Logger.log(JSON.stringify(returnObject));
    Logger.log("========================================");

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
 * DEBUG UTILITY - DATABASE INTEGRITY AUDIT
 *****************************************************************/

/**
 * Test specific customer lookup
 * Traces what backend actually returns
 */
function testSpecificCustomer() {
  
  const testMobile = "9876543210"; // Ramya/CUS00001
  
  Logger.log("========================================");
  Logger.log("TESTING CUSTOMER LOOKUP: " + testMobile);
  Logger.log("========================================");
  
  const result = searchCustomerByMobile(testMobile);
  
  Logger.log("Result returned:");
  Logger.log("  success: " + result.success);
  Logger.log("  message: " + result.message);
  
  if (result.data) {
    Logger.log("  data.exists: " + result.data.exists);
    Logger.log("  data.isNew: " + result.data.isNew);
    
    if (result.data.customer) {
      Logger.log("  data.customer.CustomerID: " + result.data.customer.CustomerID);
      Logger.log("  data.customer.CustomerName: " + result.data.customer.CustomerName);
      Logger.log("  data.customer.Mobile: " + result.data.customer.Mobile);
    }
    
    if (result.data.history) {
      Logger.log("  data.history.totalBookings: " + result.data.history.totalBookings);
      Logger.log("  data.history.eventTypes: " + result.data.history.eventTypes);
      Logger.log("  data.history.lastEventDate: " + result.data.history.lastEventDate);
      Logger.log("  data.history.customerSince: " + result.data.history.customerSince);
    }
  }
  
  Logger.log("");
  Logger.log("FULL RESULT OBJECT:");
  Logger.log(JSON.stringify(result));
  Logger.log("========================================");
  
  return result;
}

/**
 * Complete database integrity audit
 * Inspects actual data in Google Sheets
 * Verifies referential integrity between Customers and Bookings
 */
function auditDatabaseIntegrity() {
  
  Logger.log("========================================");
  Logger.log("DATABASE INTEGRITY AUDIT");
  Logger.log("========================================");
  
  // Read actual data from sheets
  const customers = getAll(APP.SHEETS.CUSTOMERS);
  const bookings = getAll(APP.SHEETS.BOOKINGS);
  
  Logger.log("Total Customers: " + customers.length);
  Logger.log("Total Bookings: " + bookings.length);
  Logger.log("");
  
  // CUSTOMERS SHEET
  Logger.log("========================================");
  Logger.log("CUSTOMERS SHEET");
  Logger.log("========================================");
  customers.forEach(function(c, i) {
    Logger.log("Row " + (i+1) + ":");
    Logger.log("  CustomerID: " + c.CustomerID);
    Logger.log("  CustomerName: " + c.CustomerName);
    Logger.log("  Mobile: " + c.Mobile);
    Logger.log("");
  });
  
  // BOOKINGS SHEET
  Logger.log("========================================");
  Logger.log("BOOKINGS SHEET");
  Logger.log("========================================");
  bookings.forEach(function(b, i) {
    Logger.log("Row " + (i+1) + ":");
    Logger.log("  BookingID: " + b.BookingID);
    Logger.log("  BookingNo: " + b.BookingNo);
    Logger.log("  CustomerID: " + b.CustomerID);
    Logger.log("  CustomerName: " + b.CustomerName);
    Logger.log("  Mobile: " + b.Mobile);
    Logger.log("");
  });
  
  // REFERENTIAL INTEGRITY CHECK
  Logger.log("========================================");
  Logger.log("REFERENTIAL INTEGRITY CHECK");
  Logger.log("========================================");
  
  const customerIdMap = {};
  customers.forEach(function(c) {
    customerIdMap[c.CustomerID] = c;
  });
  
  const missingCustomers = [];
  bookings.forEach(function(b) {
    const exists = customerIdMap[b.CustomerID];
    Logger.log("Booking " + b.BookingNo + " → CustomerID: " + b.CustomerID);
    if (exists) {
      Logger.log("  Status: MATCH");
      Logger.log("  Customer: " + exists.CustomerName);
    } else {
      Logger.log("  Status: MISSING");
      missingCustomers.push(b.CustomerID);
    }
    Logger.log("");
  });
  
  // BOOKINGS PER CUSTOMER
  Logger.log("========================================");
  Logger.log("BOOKINGS PER CUSTOMER");
  Logger.log("========================================");
  
  const bookingCounts = {};
  bookings.forEach(function(b) {
    if (!bookingCounts[b.CustomerID]) {
      bookingCounts[b.CustomerID] = [];
    }
    bookingCounts[b.CustomerID].push(b.BookingNo);
  });
  
  customers.forEach(function(c) {
    const customerBookings = bookingCounts[c.CustomerID] || [];
    Logger.log("CustomerID: " + c.CustomerID);
    Logger.log("  Name: " + c.CustomerName);
    Logger.log("  Bookings: " + customerBookings.join(", "));
    Logger.log("  Total: " + customerBookings.length);
    Logger.log("");
  });
  
  // ORPHANED RECORDS
  Logger.log("========================================");
  Logger.log("ORPHANED RECORDS");
  Logger.log("========================================");
  
  if (missingCustomers.length > 0) {
    Logger.log("⚠️ BOOKINGS WITH MISSING CUSTOMERS:");
    missingCustomers.forEach(function(id) {
      Logger.log("  CustomerID: " + id);
    });
  } else {
    Logger.log("✓ All bookings reference existing customers");
  }
  Logger.log("");
  
  const unusedCustomers = [];
  customers.forEach(function(c) {
    if (!bookingCounts[c.CustomerID]) {
      unusedCustomers.push(c.CustomerID);
    }
  });
  
  if (unusedCustomers.length > 0) {
    Logger.log("⚠️ CUSTOMERS WITH NO BOOKINGS:");
    unusedCustomers.forEach(function(id) {
      Logger.log("  CustomerID: " + id);
    });
  } else {
    Logger.log("✓ All customers have at least one booking");
  }
  
  Logger.log("");
  Logger.log("========================================");
  Logger.log("AUDIT COMPLETE");
  Logger.log("========================================");
  
  return {
    totalCustomers: customers.length,
    totalBookings: bookings.length,
    missingCustomers: missingCustomers.length,
    unusedCustomers: unusedCustomers.length
  };
  
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
    'paymentdate': 'PaymentDate',
    'paymentmode': 'PaymentMode',
    'paymentremarks': 'PaymentRemarks',
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
      
      // BUSINESS RULE: Customer Master is the ONLY source of truth
      // NEVER update customer name from booking
      // Only update AlternateMobile if provided
      
      if (data.alternateMobile && data.alternateMobile.trim()) {
        update(
          APP.SHEETS.CUSTOMERS,
          "CustomerID",
          existing.CustomerID,
          {
            AlternateMobile: data.alternateMobile.trim()
          }
        );
      }

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
    
    // BUSINESS RULE: Validate customer name consistency
    // If mobile exists, customer name MUST match Customer Master
    const existingCustomer = findCustomerByMobile(normalizedMobile);
    
    if (existingCustomer) {
      const masterCustomerName = existingCustomer.CustomerName.trim();
      const typedCustomerName = data.customerName.trim();
      
      if (masterCustomerName.toLowerCase() !== typedCustomerName.toLowerCase()) {
        return failure(
          "This mobile number already belongs to '" + masterCustomerName + "'. " +
          "Customer name cannot be changed here. Edit it from Customer Management."
        );
      }
      
      // Use exact name from Customer Master (preserve case)
      data.customerName = masterCustomerName;
    }

    const customerId =
      createCustomer(data);

    const bookingId =
      generateBookingId();

    const bookingNo =
      generateBookingNumber();
    
    const budget = Number(data.budget || 0);
    const advanceAmount = Number(data.advanceAmount || 0);
    const balanceAmount = Number(data.balanceAmount || 0);
    
    if (!isFinite(budget)) {
      return failure("Invalid Budget value.");
    }
    
    if (!isFinite(advanceAmount)) {
      return failure("Invalid Advance Amount value.");
    }
    
    if (!isFinite(balanceAmount)) {
      return failure("Invalid Balance Amount value.");
    }

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
          budget,

        GoogleMap :
          data.bookingSource || data.googleMap || "",

        AdvanceAmount :
          advanceAmount,

        BalanceAmount :
          balanceAmount,

        PaymentStatus :
          data.paymentStatus,

        PaymentDate :
          data.paymentDate || "",

        PaymentMode :
          data.paymentMode || "",

        PaymentRemarks :
          data.paymentRemarks || "",

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
        } else if (key === "AdvanceAmount" || key === "AmountReceived" || key === "BalanceAmount" || key === "Budget") {
          const numValue = Number(value);
          result[key] = (isFinite(numValue) && !isNaN(numValue)) ? numValue : 0;
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
        } else if (key === "AdvanceAmount" || key === "AmountReceived" || key === "BalanceAmount" || key === "Budget") {
          const numValue = Number(value);
          serializedBooking[key] = (isFinite(numValue) && !isNaN(numValue)) ? numValue : 0;
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
    
    // BUSINESS RULE: Validate customer name consistency during edit
    // Customer name must match Customer Master
    const normalizedMobile = normalizeMobile(data.mobile);
    
    if (!normalizedMobile) {
      return failure("Mobile Number must be exactly 10 digits (numbers only).");
    }
    
    const existingCustomer = findCustomerByMobile(normalizedMobile);
    
    if (existingCustomer) {
      const masterCustomerName = existingCustomer.CustomerName.trim();
      const typedCustomerName = data.customerName.trim();
      
      if (masterCustomerName.toLowerCase() !== typedCustomerName.toLowerCase()) {
        return failure(
          "This mobile number belongs to '" + masterCustomerName + "'. " +
          "Customer name cannot be changed here. Edit it from Customer Management."
        );
      }
      
      // Use exact name from Customer Master
      data.customerName = masterCustomerName;
    }
    
    data.mobile = normalizedMobile;

    const customerId = createCustomer(data);
    
    const budget = Number(data.budget || 0);
    const advanceAmount = Number(data.advanceAmount || 0);
    const balanceAmount = Number(data.balanceAmount || 0);
    
    if (!isFinite(budget)) {
      return failure("Invalid Budget value.");
    }
    
    if (!isFinite(advanceAmount)) {
      return failure("Invalid Advance Amount value.");
    }
    
    if (!isFinite(balanceAmount)) {
      return failure("Invalid Balance Amount value.");
    }

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
        Budget: budget,
        GoogleMap: data.bookingSource || data.googleMap || "",
        AdvanceAmount: advanceAmount,
        BalanceAmount: balanceAmount,
        PaymentStatus: data.paymentStatus,
        PaymentDate: data.paymentDate || "",
        PaymentMode: data.paymentMode || "",
        PaymentRemarks: data.paymentRemarks || "",
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

/******************************************************
 * CUSTOMER MANAGEMENT MODULE
 ******************************************************/

/**
 * REPAIR UTILITY - Fix Booking Customer Names from Customer Master
 * Business Rule: Customer Master is the ONLY source of truth
 */
function repairBookingCustomerNames() {
  
  try {
    
    Logger.log("=== REPAIR BOOKING CUSTOMER NAMES START ===");
    
    const customers = getAll(APP.SHEETS.CUSTOMERS);
    const bookings = getAll(APP.SHEETS.BOOKINGS);
    
    Logger.log("Total Customers: " + customers.length);
    Logger.log("Total Bookings: " + bookings.length);
    
    let updatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    const report = [];
    
    bookings.forEach(function(booking) {
      
      try {
        
        const bookingId = booking.BookingID;
        const bookingCustomerId = booking.CustomerID;
        const bookingCustomerName = booking.CustomerName;
        const bookingMobile = booking.Mobile;
        
        // Find matching customer by CustomerID
        const customer = customers.find(function(c) {
          return String(c.CustomerID).trim() === String(bookingCustomerId).trim();
        });
        
        if (!customer) {
          report.push({
            bookingId: bookingId,
            status: "ERROR",
            reason: "Customer not found for CustomerID: " + bookingCustomerId
          });
          errorCount++;
          Logger.log("ERROR: Booking " + bookingId + " - Customer not found: " + bookingCustomerId);
          return;
        }
        
        const masterCustomerName = customer.CustomerName;
        
        // Check if name matches
        if (String(bookingCustomerName).trim() === String(masterCustomerName).trim()) {
          report.push({
            bookingId: bookingId,
            status: "SKIPPED",
            reason: "Name already correct"
          });
          skippedCount++;
          return;
        }
        
        // Update booking with correct customer name from master
        Logger.log("Updating Booking " + bookingId + ": '" + bookingCustomerName + "' → '" + masterCustomerName + "'");
        
        update(
          APP.SHEETS.BOOKINGS,
          "BookingID",
          bookingId,
          { CustomerName: masterCustomerName }
        );
        
        report.push({
          bookingId: bookingId,
          status: "UPDATED",
          oldName: bookingCustomerName,
          newName: masterCustomerName
        });
        updatedCount++;
        
      } catch (e) {
        report.push({
          bookingId: booking.BookingID,
          status: "ERROR",
          reason: e.message
        });
        errorCount++;
        Logger.log("ERROR processing booking " + booking.BookingID + ": " + e.message);
      }
      
    });
    
    Logger.log("=== REPAIR COMPLETE ===");
    Logger.log("Updated: " + updatedCount);
    Logger.log("Skipped: " + skippedCount);
    Logger.log("Errors: " + errorCount);
    Logger.log("=== REPAIR BOOKING CUSTOMER NAMES END ===");
    
    return {
      success: true,
      message: "Repair completed",
      data: {
        updated: updatedCount,
        skipped: skippedCount,
        errors: errorCount,
        report: report
      }
    };
    
  } catch (e) {
    Logger.log("FATAL ERROR in repairBookingCustomerNames: " + e.message);
    return {
      success: false,
      message: "Repair failed: " + e.message,
      data: null
    };
  }
  
}

/**
 * VALIDATION UTILITY - Validate Customer Master Integrity
 * Checks for data integrity issues and returns detailed report
 */
function validateCustomerIntegrity() {
  
  try {
    
    Logger.log("=== VALIDATE CUSTOMER INTEGRITY START ===");
    
    const customers = getAll(APP.SHEETS.CUSTOMERS);
    const bookings = getAll(APP.SHEETS.BOOKINGS);
    
    Logger.log("Total Customers: " + customers.length);
    Logger.log("Total Bookings: " + bookings.length);
    
    const issues = {
      duplicateMobiles: [],
      duplicateCustomerIds: [],
      sameMobileDifferentNames: [],
      bookingsWithoutCustomerId: [],
      bookingsMissingCustomer: [],
      customerIdsNotInMaster: []
    };
    
    // CHECK 1: Duplicate Mobile Numbers in Customer Master
    const mobileMap = {};
    customers.forEach(function(customer) {
      const mobile = normalizeMobile(customer.Mobile);
      if (mobile) {
        if (mobileMap[mobile]) {
          mobileMap[mobile].push(customer.CustomerID);
        } else {
          mobileMap[mobile] = [customer.CustomerID];
        }
      }
    });
    
    for (var mobile in mobileMap) {
      if (mobileMap[mobile].length > 1) {
        issues.duplicateMobiles.push({
          mobile: mobile,
          customerIds: mobileMap[mobile]
        });
      }
    }
    
    // CHECK 2: Duplicate CustomerIDs in Customer Master
    const customerIdMap = {};
    customers.forEach(function(customer) {
      const id = customer.CustomerID;
      if (customerIdMap[id]) {
        customerIdMap[id]++;
      } else {
        customerIdMap[id] = 1;
      }
    });
    
    for (var id in customerIdMap) {
      if (customerIdMap[id] > 1) {
        issues.duplicateCustomerIds.push({
          customerId: id,
          count: customerIdMap[id]
        });
      }
    }
    
    // CHECK 3: Same Mobile with Different Names in Bookings
    const bookingMobileNames = {};
    bookings.forEach(function(booking) {
      const mobile = normalizeMobile(booking.Mobile);
      const name = String(booking.CustomerName || '').trim();
      
      if (mobile && name) {
        if (!bookingMobileNames[mobile]) {
          bookingMobileNames[mobile] = {};
        }
        if (!bookingMobileNames[mobile][name]) {
          bookingMobileNames[mobile][name] = [];
        }
        bookingMobileNames[mobile][name].push(booking.BookingID);
      }
    });
    
    for (var mobile in bookingMobileNames) {
      var names = Object.keys(bookingMobileNames[mobile]);
      if (names.length > 1) {
        issues.sameMobileDifferentNames.push({
          mobile: mobile,
          names: names,
          bookingIds: bookingMobileNames[mobile]
        });
      }
    }
    
    // CHECK 4: Bookings without CustomerID
    bookings.forEach(function(booking) {
      if (!booking.CustomerID || String(booking.CustomerID).trim() === '') {
        issues.bookingsWithoutCustomerId.push({
          bookingId: booking.BookingID,
          bookingNo: booking.BookingNo,
          customerName: booking.CustomerName,
          mobile: booking.Mobile
        });
      }
    });
    
    // CHECK 5: Bookings referencing missing customers
    const customerIds = customers.map(function(c) { return c.CustomerID; });
    
    bookings.forEach(function(booking) {
      const customerId = booking.CustomerID;
      if (customerId && customerIds.indexOf(customerId) === -1) {
        issues.bookingsMissingCustomer.push({
          bookingId: booking.BookingID,
          bookingNo: booking.BookingNo,
          customerId: customerId,
          customerName: booking.CustomerName
        });
      }
    });
    
    // CHECK 6: CustomerIDs in bookings not in Customer Master
    const uniqueBookingCustomerIds = {};
    bookings.forEach(function(booking) {
      if (booking.CustomerID) {
        uniqueBookingCustomerIds[booking.CustomerID] = true;
      }
    });
    
    for (var bookingCustId in uniqueBookingCustomerIds) {
      if (customerIds.indexOf(bookingCustId) === -1) {
        issues.customerIdsNotInMaster.push(bookingCustId);
      }
    }
    
    // Calculate totals
    const totalIssues = 
      issues.duplicateMobiles.length +
      issues.duplicateCustomerIds.length +
      issues.sameMobileDifferentNames.length +
      issues.bookingsWithoutCustomerId.length +
      issues.bookingsMissingCustomer.length +
      issues.customerIdsNotInMaster.length;
    
    Logger.log("=== VALIDATION RESULTS ===");
    Logger.log("Duplicate Mobiles: " + issues.duplicateMobiles.length);
    Logger.log("Duplicate CustomerIDs: " + issues.duplicateCustomerIds.length);
    Logger.log("Same Mobile Different Names: " + issues.sameMobileDifferentNames.length);
    Logger.log("Bookings without CustomerID: " + issues.bookingsWithoutCustomerId.length);
    Logger.log("Bookings Missing Customer: " + issues.bookingsMissingCustomer.length);
    Logger.log("CustomerIDs Not in Master: " + issues.customerIdsNotInMaster.length);
    Logger.log("Total Issues: " + totalIssues);
    Logger.log("=== VALIDATE CUSTOMER INTEGRITY END ===");
    
    return {
      success: true,
      message: totalIssues === 0 ? "No integrity issues found" : totalIssues + " integrity issues found",
      data: {
        totalIssues: totalIssues,
        issues: issues,
        summary: {
          duplicateMobiles: issues.duplicateMobiles.length,
          duplicateCustomerIds: issues.duplicateCustomerIds.length,
          sameMobileDifferentNames: issues.sameMobileDifferentNames.length,
          bookingsWithoutCustomerId: issues.bookingsWithoutCustomerId.length,
          bookingsMissingCustomer: issues.bookingsMissingCustomer.length,
          customerIdsNotInMaster: issues.customerIdsNotInMaster.length
        }
      }
    };
    
  } catch (e) {
    Logger.log("FATAL ERROR in validateCustomerIntegrity: " + e.message);
    return {
      success: false,
      message: "Validation failed: " + e.message,
      data: null
    };
  }
  
}

/**
 * DIAGNOSTIC TEST FUNCTION - DELETE AFTER DEBUGGING
 */
function testCustomerDataDiagnostics() {
  
  Logger.log("=== DIAGNOSTIC TEST START ===");
  
  // Test 1: Check Customers sheet
  const customers = getAll(APP.SHEETS.CUSTOMERS);
  Logger.log("TEST 1 - Customers in sheet: " + customers.length);
  
  if (customers.length > 0) {
    Logger.log("First customer raw data:");
    Logger.log(JSON.stringify(customers[0]));
  } else {
    Logger.log("ERROR: No customers found in Customers sheet!");
  }
  
  // Test 2: Check Bookings sheet
  const bookings = getAll(APP.SHEETS.BOOKINGS);
  Logger.log("TEST 2 - Bookings in sheet: " + bookings.length);
  
  if (bookings.length > 0) {
    Logger.log("First booking raw data:");
    Logger.log(JSON.stringify(bookings[0]));
  } else {
    Logger.log("ERROR: No bookings found in Bookings sheet!");
  }
  
  // Test 3: Call getCustomerList()
  Logger.log("TEST 3 - Calling getCustomerList()");
  const result = getCustomerList();
  Logger.log("Result success: " + result.success);
  
  if (result.success) {
    Logger.log("Result data length: " + (result.data ? result.data.length : 0));
    if (result.data && result.data.length > 0) {
      Logger.log("First customer in result:");
      Logger.log(JSON.stringify(result.data[0]));
    } else {
      Logger.log("ERROR: getCustomerList returned empty array!");
    }
  } else {
    Logger.log("ERROR: getCustomerList failed: " + result.message);
  }
  
  // Test 4: Call getCustomerDashboardStats()
  Logger.log("TEST 4 - Calling getCustomerDashboardStats()");
  const statsResult = getCustomerDashboardStats();
  Logger.log("Stats result success: " + statsResult.success);
  
  if (statsResult.success) {
    Logger.log("Dashboard stats:");
    Logger.log(JSON.stringify(statsResult.data));
  } else {
    Logger.log("ERROR: getCustomerDashboardStats failed: " + statsResult.message);
  }
  
  Logger.log("=== DIAGNOSTIC TEST END ===");
  
}

/**
 * Get customer list with calculated statistics
 */
function getCustomerList() {
  
  try {
    
    Logger.log("=== GET CUSTOMER LIST START ===");
    
    const customers = getAll(APP.SHEETS.CUSTOMERS);
    const bookings = getAll(APP.SHEETS.BOOKINGS);
    
    Logger.log("Customers loaded: " + customers.length);
    Logger.log("Bookings loaded: " + bookings.length);
    
    if (customers.length === 0) {
      Logger.log("WARNING: No customers found in Customers sheet");
      return {
        success: true,
        message: "Success",
        data: []
      };
    }
    
    const now = new Date();
    
    const customerList = customers.map(function(customer) {
      
      const customerId = customer.CustomerID;
      const customerMobile = customer.Mobile;
      
      Logger.log("Processing customer: " + customerId + " - " + customer.CustomerName);
      
      // Match by CustomerID first, then by Mobile as fallback
      const customerBookings = bookings.filter(function(b) {
        const bookingCustomerId = String(b.CustomerID || '').trim();
        const bookingMobile = String(b.Mobile || '').replace(/\D/g, '');
        const custMobile = String(customerMobile || '').replace(/\D/g, '');
        
        // Match by CustomerID
        if (bookingCustomerId && customerId) {
          if (bookingCustomerId === String(customerId).trim()) {
            return true;
          }
        }
        
        // Fallback: Match by Mobile (normalized)
        if (bookingMobile && custMobile && bookingMobile.length === 10 && custMobile.length === 10) {
          if (bookingMobile === custMobile) {
            return true;
          }
        }
        
        return false;
      });
      
      const totalBookings = customerBookings.length;
      
      Logger.log("  Matched bookings: " + totalBookings);
      
      let completedEvents = 0;
      let upcomingEvents = 0;
      let totalRevenue = 0;
      let pendingAmount = 0;
      let lastEventDate = null;
      let nextEventDate = null;
      
      customerBookings.forEach(function(booking) {
        
        const eventDate = booking.EventDate ? new Date(booking.EventDate) : null;
        
        if (eventDate) {
          if (eventDate < now) {
            completedEvents++;
            if (!lastEventDate || eventDate > lastEventDate) {
              lastEventDate = eventDate;
            }
          } else {
            upcomingEvents++;
            if (!nextEventDate || eventDate < nextEventDate) {
              nextEventDate = eventDate;
            }
          }
        }
        
        const budget = parseFloat(booking.Budget) || 0;
        const advance = parseFloat(booking.AdvanceAmount) || 0;
        const balance = parseFloat(booking.BalanceAmount) || 0;
        
        totalRevenue += budget;
        pendingAmount += balance;
        
      });
      
      Logger.log("  Statistics - Bookings: " + totalBookings + ", Revenue: " + totalRevenue + ", Completed: " + completedEvents + ", Upcoming: " + upcomingEvents);
      
      return {
        CustomerID: customer.CustomerID,
        CustomerName: customer.CustomerName,
        Mobile: customer.Mobile,
        AlternateMobile: customer.AlternateMobile || '',
        Email: customer.Email || '',
        Address: customer.Address || '',
        CustomerSince: customer.CustomerSince ? formatDate(new Date(customer.CustomerSince)) : '',
        Status: customer.Status || 'Active',
        TotalBookings: totalBookings,
        CompletedEvents: completedEvents,
        UpcomingEvents: upcomingEvents,
        TotalRevenue: totalRevenue,
        PendingAmount: pendingAmount,
        LastEventDate: lastEventDate ? formatDate(lastEventDate) : '',
        NextEventDate: nextEventDate ? formatDate(nextEventDate) : '',
        AverageBookingValue: totalBookings > 0 ? Math.round(totalRevenue / totalBookings) : 0
      };
      
    });
    
    Logger.log("Total customers processed: " + customerList.length);
    
    // STEP 2: Log array before return
    Logger.log("=== BEFORE RETURN ===");
    Logger.log("typeof customerList: " + typeof customerList);
    Logger.log("Array.isArray(customerList): " + Array.isArray(customerList));
    Logger.log("customerList.length: " + customerList.length);
    
    if (customerList.length > 0) {
      Logger.log("First customer object:");
      try {
        Logger.log(JSON.stringify(customerList[0]));
      } catch (stringifyError) {
        Logger.log("JSON.stringify FAILED for first customer: " + stringifyError.message);
        Logger.log("Inspecting customer fields individually:");
        var firstCustomer = customerList[0];
        for (var key in firstCustomer) {
          try {
            var value = firstCustomer[key];
            Logger.log("  " + key + " (" + typeof value + "): " + value);
            JSON.stringify(value);
          } catch (fieldError) {
            Logger.log("  " + key + " CANNOT BE SERIALIZED: " + fieldError.message);
          }
        }
      }
    }
    
    Logger.log("=== CALLING success() ===");
    var result = success(customerList);
    Logger.log("=== AFTER success() ===");
    Logger.log("result.success: " + result.success);
    Logger.log("typeof result.data: " + typeof result.data);
    Logger.log("Array.isArray(result.data): " + Array.isArray(result.data));
    Logger.log("result.data.length: " + (result.data ? result.data.length : "NULL"));
    
    Logger.log("=== GET CUSTOMER LIST END ===");
    
    // FIX: Return object directly like booking module
    return {
      success: true,
      message: "Success",
      data: customerList
    };
    
  } catch (e) {
    
    Logger.log("ERROR in getCustomerList: " + e.message);
    Logger.log("Stack trace: " + e.stack);
    return failure("Unable to load customers: " + e.message);
    
  }
  
}

/**
 * Get customer by ID with full details
 */
function getCustomerById(customerId) {
  
  try {
    
    Logger.log("Getting customer by ID: " + customerId);
    
    const customers = getAll(APP.SHEETS.CUSTOMERS);
    const bookings = getAll(APP.SHEETS.BOOKINGS);
    
    const customer = customers.find(function(c) {
      return String(c.CustomerID).trim() === String(customerId).trim();
    });
    
    if (!customer) {
      Logger.log("Customer not found: " + customerId);
      return failure("Customer not found");
    }
    
    const customerMobile = customer.Mobile;
    
    // Match by CustomerID or Mobile
    const customerBookings = bookings.filter(function(b) {
      const bookingCustomerId = String(b.CustomerID || '').trim();
      const bookingMobile = String(b.Mobile || '').replace(/\D/g, '');
      const custMobile = String(customerMobile || '').replace(/\D/g, '');
      
      if (bookingCustomerId && customerId) {
        if (bookingCustomerId === String(customerId).trim()) {
          return true;
        }
      }
      
      if (bookingMobile && custMobile && bookingMobile.length === 10 && custMobile.length === 10) {
        if (bookingMobile === custMobile) {
          return true;
        }
      }
      
      return false;
    });
    
    Logger.log("Found " + customerBookings.length + " bookings for customer");
    
    const now = new Date();
    
    let completedEvents = 0;
    let upcomingEvents = 0;
    let cancelledEvents = 0;
    let totalRevenue = 0;
    let amountReceived = 0;
    let pendingAmount = 0;
    let lastEventDate = null;
    let nextEventDate = null;
    let lastPaymentDate = null;
    
    customerBookings.forEach(function(booking) {
      
      const eventDate = booking.EventDate ? new Date(booking.EventDate) : null;
      const bookingStatus = (booking.BookingStatus || '').toLowerCase();
      
      if (bookingStatus === 'cancelled' || bookingStatus === 'canceled') {
        cancelledEvents++;
      } else if (eventDate) {
        if (eventDate < now) {
          completedEvents++;
          if (!lastEventDate || eventDate > lastEventDate) {
            lastEventDate = eventDate;
          }
        } else {
          upcomingEvents++;
          if (!nextEventDate || eventDate < nextEventDate) {
            nextEventDate = eventDate;
          }
        }
      }
      
      const budget = parseFloat(booking.Budget) || 0;
      const advance = parseFloat(booking.AdvanceAmount) || 0;
      const balance = parseFloat(booking.BalanceAmount) || 0;
      
      totalRevenue += budget;
      amountReceived += advance;
      pendingAmount += balance;
      
      if (advance > 0 && eventDate) {
        if (!lastPaymentDate || eventDate > lastPaymentDate) {
          lastPaymentDate = eventDate;
        }
      }
      
    });
    
    const totalBookings = customerBookings.length;
    
    return {
      success: true,
      message: "Success",
      data: {
        CustomerID: customer.CustomerID,
        CustomerName: customer.CustomerName,
        Mobile: customer.Mobile,
        AlternateMobile: customer.AlternateMobile || '',
        Email: customer.Email || '',
        Address: customer.Address || '',
        CustomerSince: customer.CustomerSince ? formatDate(new Date(customer.CustomerSince)) : '',
        Status: customer.Status || 'Active',
        TotalBookings: totalBookings,
        CompletedEvents: completedEvents,
        UpcomingEvents: upcomingEvents,
        CancelledEvents: cancelledEvents,
        TotalRevenue: totalRevenue,
        AmountReceived: amountReceived,
        PendingAmount: pendingAmount,
        AverageBookingValue: totalBookings > 0 ? Math.round(totalRevenue / totalBookings) : 0,
        LastEventDate: lastEventDate ? formatDate(lastEventDate) : '',
        NextEventDate: nextEventDate ? formatDate(nextEventDate) : '',
        LastPaymentDate: lastPaymentDate ? formatDate(lastPaymentDate) : ''
      }
    };
    
  } catch (e) {
    
    Logger.log("ERROR in getCustomerById: " + e.message);
    return failure("Unable to load customer: " + e.message);
    
  }
  
}

/**
 * Get customer booking history
 */
function getCustomerBookings(customerId) {
  
  try {
    
    Logger.log("Getting bookings for customer: " + customerId);
    
    const customers = getAll(APP.SHEETS.CUSTOMERS);
    const bookings = getAll(APP.SHEETS.BOOKINGS);
    
    // Find customer to get mobile
    const customer = customers.find(function(c) {
      return String(c.CustomerID).trim() === String(customerId).trim();
    });
    
    if (!customer) {
      Logger.log("Customer not found for booking history: " + customerId);
      return {
        success: true,
        message: "Success",
        data: []
      };
    }
    
    const customerMobile = customer.Mobile;
    
    // Match by CustomerID or Mobile
    const customerBookings = bookings.filter(function(b) {
      const bookingCustomerId = String(b.CustomerID || '').trim();
      const bookingMobile = String(b.Mobile || '').replace(/\D/g, '');
      const custMobile = String(customerMobile || '').replace(/\D/g, '');
      
      if (bookingCustomerId && customerId) {
        if (bookingCustomerId === String(customerId).trim()) {
          return true;
        }
      }
      
      if (bookingMobile && custMobile && bookingMobile.length === 10 && custMobile.length === 10) {
        if (bookingMobile === custMobile) {
          return true;
        }
      }
      
      return false;
    });
    
    Logger.log("Found " + customerBookings.length + " bookings");
    
    customerBookings.sort(function(a, b) {
      const dateA = a.EventDate ? new Date(a.EventDate) : new Date(0);
      const dateB = b.EventDate ? new Date(b.EventDate) : new Date(0);
      return dateB - dateA;
    });
    
    const formattedBookings = customerBookings.map(function(booking) {
      const budget = Number(booking.Budget || 0);
      const advanceAmount = Number(booking.AdvanceAmount || 0);
      const balanceAmount = Number(booking.BalanceAmount || 0);
      
      return {
        BookingID: booking.BookingID,
        BookingNo: booking.BookingNo,
        CustomerName: booking.CustomerName,
        Mobile: booking.Mobile,
        EventType: booking.EventType,
        EventDate: booking.EventDate ? formatDate(new Date(booking.EventDate)) : '',
        EventTime: booking.EventTime,
        Venue: booking.Venue,
        Budget: (isFinite(budget) && !isNaN(budget)) ? budget : 0,
        AdvanceAmount: (isFinite(advanceAmount) && !isNaN(advanceAmount)) ? advanceAmount : 0,
        BalanceAmount: (isFinite(balanceAmount) && !isNaN(balanceAmount)) ? balanceAmount : 0,
        BookingStatus: booking.BookingStatus,
        PaymentStatus: booking.PaymentStatus,
        Requirement: booking.Requirement,
        Remarks: booking.Remarks
      };
    });
    
    return {
      success: true,
      message: "Success",
      data: formattedBookings
    };
    
  } catch (e) {
    
    Logger.log("ERROR in getCustomerBookings: " + e.message);
    return failure("Unable to load customer bookings: " + e.message);
    
  }
  
}

/**
 * Update customer information
 */
function updateCustomer(customerId, data) {
  
  try {
    
    if (!customerId) {
      return failure("Customer ID is required");
    }
    
    if (!data.customerName || !data.customerName.trim()) {
      return failure("Customer name is required");
    }
    
    const updateData = {
      CustomerName: data.customerName.trim()
    };
    
    if (data.alternateMobile !== undefined) {
      updateData.AlternateMobile = data.alternateMobile.trim();
    }
    
    if (data.email !== undefined) {
      updateData.Email = data.email.trim();
    }
    
    if (data.address !== undefined) {
      updateData.Address = data.address.trim();
    }
    
    if (data.status !== undefined) {
      updateData.Status = data.status.trim();
    }
    
    update(
      APP.SHEETS.CUSTOMERS,
      "CustomerID",
      customerId,
      updateData
    );
    
    if (data.customerName) {
      const bookings = getAll(APP.SHEETS.BOOKINGS);
      const customerBookings = bookings.filter(function(b) {
        return String(b.CustomerID).trim() === String(customerId).trim();
      });
      
      customerBookings.forEach(function(booking) {
        update(
          APP.SHEETS.BOOKINGS,
          "BookingID",
          booking.BookingID,
          { CustomerName: data.customerName.trim() }
        );
      });
    }
    
    return {
      success: true,
      message: "Customer updated successfully",
      data: null
    };
    
  } catch (e) {
    
    Logger.log("ERROR in updateCustomer: " + e.message);
    return failure("Unable to update customer: " + e.message);
    
  }
  
}

/**
 * Get customer dashboard statistics
 */
function getCustomerDashboardStats() {
  
  try {
    
    Logger.log("=== GET CUSTOMER DASHBOARD STATS START ===");
    
    const customers = getAll(APP.SHEETS.CUSTOMERS);
    const bookings = getAll(APP.SHEETS.BOOKINGS);
    
    Logger.log("Customers: " + customers.length + ", Bookings: " + bookings.length);
    
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    let totalCustomers = customers.length;
    let activeCustomers = 0;
    let inactiveCustomers = 0;
    let newThisMonth = 0;
    let repeatCustomers = 0;
    
    customers.forEach(function(customer) {
      
      const status = (customer.Status || 'Active').toLowerCase();
      
      if (status === 'active') {
        activeCustomers++;
      } else {
        inactiveCustomers++;
      }
      
      const customerSince = customer.CustomerSince ? new Date(customer.CustomerSince) : null;
      if (customerSince && customerSince >= startOfMonth) {
        newThisMonth++;
      }
      
      const customerId = customer.CustomerID;
      const customerMobile = customer.Mobile;
      
      // Match by CustomerID or Mobile
      const customerBookings = bookings.filter(function(b) {
        const bookingCustomerId = String(b.CustomerID || '').trim();
        const bookingMobile = String(b.Mobile || '').replace(/\D/g, '');
        const custMobile = String(customerMobile || '').replace(/\D/g, '');
        
        if (bookingCustomerId && customerId) {
          if (bookingCustomerId === String(customerId).trim()) {
            return true;
          }
        }
        
        if (bookingMobile && custMobile && bookingMobile.length === 10 && custMobile.length === 10) {
          if (bookingMobile === custMobile) {
            return true;
          }
        }
        
        return false;
      });
      
      if (customerBookings.length > 1) {
        repeatCustomers++;
      }
      
    });
    
    Logger.log("Stats - Total: " + totalCustomers + ", Active: " + activeCustomers + ", New: " + newThisMonth + ", Repeat: " + repeatCustomers);
    Logger.log("=== GET CUSTOMER DASHBOARD STATS END ===");
    
    return {
      success: true,
      message: "Success",
      data: {
        totalCustomers: totalCustomers,
        activeCustomers: activeCustomers,
        inactiveCustomers: inactiveCustomers,
        newThisMonth: newThisMonth,
        repeatCustomers: repeatCustomers
      }
    };
    
  } catch (e) {
    
    Logger.log("ERROR in getCustomerDashboardStats: " + e.message);
    Logger.log("Stack trace: " + e.stack);
    return failure("Unable to load customer stats: " + e.message);
    
  }
  
}