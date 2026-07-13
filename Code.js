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
 * CUSTOM MENU
 ***************************************************************/

function onOpen() {
  
  const ui = SpreadsheetApp.getUi();
  
  ui.createMenu('🔧 RK Events Admin')
    .addItem('🗑️ Clear All Bookings & Customers', 'runCleanup')
    .addSeparator()
    .addItem('ℹ️ About', 'showAbout')
    .addToUi();
    
}

function runCleanup() {
  
  const ui = SpreadsheetApp.getUi();
  
  const response = ui.alert(
    'Clear All Data',
    'This will delete ALL bookings and customers. Are you sure?',
    ui.ButtonSet.YES_NO
  );
  
  if (response == ui.Button.YES) {
    
    const result = clearAllBookingsAndCustomers();
    
    if (result.success) {
      ui.alert('✅ Success', result.message, ui.ButtonSet.OK);
    } else {
      ui.alert('❌ Error', result.message, ui.ButtonSet.OK);
    }
    
  }
  
}

function showAbout() {
  
  const ui = SpreadsheetApp.getUi();
  ui.alert(
    'RK Events ERP',
    'Version: 2.0\nEvent Booking Management System',
    ui.ButtonSet.OK
  );
  
}

/***************************************************************
 * WEB APP ENTRY
 ***************************************************************/

function doGet(e){

  if (e && e.parameter && e.parameter.action === 'cleanup') {
    
    const result = clearAllBookingsAndCustomers();
    
    return ContentService
      .createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
      
  }

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
    Logger.log("Booking CustomerID: '" + booking.CustomerID + "' (type: " + typeof booking.CustomerID + ")");
    if (booking.CustomerID) {
      let rawId = String(booking.CustomerID).trim();
      
      let cleanId = rawId;
      if (rawId.startsWith("RKCO") && rawId.length > 9) {
        cleanId = rawId.substring(0, 9);
      } else if (rawId.startsWith("CUS")) {
        cleanId = rawId;
      }
      
      Logger.log("Cleaned CustomerID: '" + cleanId + "' from '" + rawId + "'");
      uniqueCustomerIds[cleanId] = true;
    }
  });
  
  Logger.log("Unique CustomerIDs: " + JSON.stringify(Object.keys(uniqueCustomerIds)));
  
  const customerCount = Object.keys(uniqueCustomerIds).length;
  
  Logger.log("Customer count: " + customerCount);

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
 * Find Customer by Mobile
 */
function findCustomerByMobile(mobile){

  const customers =
    getAll(APP.SHEETS.CUSTOMERS);

  const customer =
    customers.find(function(c){

      return String(c.Mobile).trim() ==
             String(mobile).trim();

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
    Logger.log("Mobile type: " + typeof mobile);
    Logger.log("Mobile length: " + String(mobile).length);
    Logger.log("Mobile trimmed length: " + String(mobile).trim().length);

    const trimmedMobile = String(mobile).trim();
    const digitsOnly = trimmedMobile.replace(/[^0-9]/g, '');

    Logger.log("Digits only: " + digitsOnly);
    Logger.log("Digits length: " + digitsOnly.length);

    if (!digitsOnly || digitsOnly.length !== 10) {
      Logger.log("Validation failed: Invalid mobile number");
      return failure("Invalid mobile number");
    }

    Logger.log("Calling findCustomerByMobile()");
    const customer = findCustomerByMobile(digitsOnly);

    Logger.log("Customer found: " + (customer ? "YES" : "NO"));

    if (!customer) {
      Logger.log("Returning NEW customer");
      return success("New Customer", {
        exists: false,
        isNew: true
      });
    }

    Logger.log("=== VERSION: 2024-07-13-23:32 ===");
    Logger.log("Customer details: " + JSON.stringify(customer));

    Logger.log("Fetching bookings for CustomerID: " + customer.CustomerID);
    
    const allBookings = getAll(APP.SHEETS.BOOKINGS);
    Logger.log("Total bookings in sheet: " + allBookings.length);
    
    const bookings = [];
    const customerCustomerId = String(customer.CustomerID || "").trim().substring(0, 9);
    
    Logger.log("Looking for CustomerID starting with: '" + customerCustomerId + "'");
    
    allBookings.forEach(function(b, idx) {
      const bookingCustomerId = String(b.CustomerID || "").trim();
      const cleanBookingId = bookingCustomerId.substring(0, 9);
      
      Logger.log("Booking " + idx + ": '" + bookingCustomerId + "' -> cleaned: '" + cleanBookingId + "'");
      
      if (cleanBookingId === customerCustomerId) {
        Logger.log("  -> MATCH! Adding to results");
        bookings.push(b);
      } else {
        Logger.log("  -> no match");
      }
    });

    Logger.log("Bookings found: " + bookings.length);

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

    Logger.log("Returning EXISTING customer with history");

    const formatDateValue = function(value) {
      if (!value) return "";
      if (value instanceof Date) {
        return Utilities.formatDate(value, APP.DATE.TIMEZONE, APP.DATE.FORMAT);
      }
      return String(value);
    };

    return success("Existing Customer", {
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
    });

  } catch (e) {
    Logger.log("ERROR in searchCustomerByMobile: " + e.message);
    return failure(e.message);
  }

}

/**
 * Generate Customer ID
 */
function generateCustomerId(){

  return "CUS" +

    Utilities.formatDate(

      new Date(),

      Session.getScriptTimeZone(),

      "yyyyMMddHHmmss"

    );

}

/**
 * Create Customer Automatically
 */
function createCustomer(data){

  const existing =
      findCustomerByMobile(data.mobile);

  if(existing){

      update(
        APP.SHEETS.CUSTOMERS,
        "CustomerID",
        existing.CustomerID,
        {
          CustomerName: data.customerName,
          Mobile: data.mobile,
          AlternateMobile: data.alternateMobile || ""
        }
      );

      return existing.CustomerID;

  }

  const customerId =
      generateCustomerId();

  insert(

      APP.SHEETS.CUSTOMERS,

      {

        CustomerID : customerId,

        CustomerName : data.customerName,

        Mobile : data.mobile,

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
 * BOOKING NUMBER
 *****************************************************************/

function generateBookingNumber(){

  const bookings =
      getAll(APP.SHEETS.BOOKINGS);

  let maxNo = 0;
  
  bookings.forEach(function(booking) {
    if (booking.BookingNo && booking.BookingNo.startsWith("RKB")) {
      const numPart = parseInt(booking.BookingNo.substring(3));
      if (numPart > maxNo) {
        maxNo = numPart;
      }
    }
  });
  
  const nextNo = maxNo + 1;

  return "RKB" +

      String(nextNo).padStart(5,"0");

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

    const mobileDigits = String(data.mobile).replace(/[^0-9]/g, '');
    
    if(mobileDigits.length !== 10)
      return failure("Mobile Number must be exactly 10 digits.");

    if(!data.eventType)
      return failure("Event Type is required.");

    if(!data.eventDate)
      return failure("Event Date is required.");

    const customerId =
      createCustomer(data);

    const bookingId =
      Utilities.getUuid();

    const bookingNo =
      generateBookingNumber();

    insert(

      APP.SHEETS.BOOKINGS,

      {

        BookingID : bookingId,

        BookingNo : bookingNo,

        CustomerID : customerId,

        CustomerName : data.customerName,

        Mobile : data.mobile,

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
 * ADMIN UTILITY - CLEAR ALL DATA
 *****************************************************************/

function clearAllBookingsAndCustomers() {
  
  try {
    
    Logger.log("Starting data cleanup...");
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    
    const bookingsSheet = ss.getSheetByName(APP.SHEETS.BOOKINGS);
    const customersSheet = ss.getSheetByName(APP.SHEETS.CUSTOMERS);
    
    if (bookingsSheet) {
      const lastRow = bookingsSheet.getLastRow();
      if (lastRow > 1) {
        bookingsSheet.deleteRows(2, lastRow - 1);
        Logger.log("Cleared " + (lastRow - 1) + " bookings");
      }
    }
    
    if (customersSheet) {
      const lastRow = customersSheet.getLastRow();
      if (lastRow > 1) {
        customersSheet.deleteRows(2, lastRow - 1);
        Logger.log("Cleared " + (lastRow - 1) + " customers");
      }
    }
    
    Logger.log("Data cleanup completed!");
    
    return {
      success: true,
      message: "All bookings and customers cleared successfully"
    };
    
  } catch (e) {
    
    Logger.log("Error during cleanup: " + e.message);
    return {
      success: false,
      message: "Error: " + e.message
    };
    
  }
  
}