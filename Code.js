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

  return{

    customers :

      getCount(APP.SHEETS.CUSTOMERS),

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

    if (!mobile || String(mobile).trim().length !== 10) {
      return failure("Invalid mobile number");
    }

    const customer = findCustomerByMobile(mobile);

    if (!customer) {
      return success("New Customer", {
        exists: false,
        isNew: true
      });
    }

    const bookings = filterRecords(
      APP.SHEETS.BOOKINGS,
      function(b) {
        return String(b.Mobile).trim() == String(mobile).trim();
      }
    );

    const totalBookings = bookings.length;
    
    let lastEventDate = "";
    let eventTypes = [];
    
    if (totalBookings > 0) {
      bookings.sort(function(a, b) {
        return new Date(b.EventDate) - new Date(a.EventDate);
      });
      
      lastEventDate = bookings[0].EventDate;
      
      eventTypes = bookings.map(function(b) {
        return b.EventType;
      }).filter(function(value, index, self) {
        return self.indexOf(value) === index;
      });
    }

    return success("Existing Customer", {
      exists: true,
      isNew: false,
      customer: {
        CustomerID: customer.CustomerID,
        CustomerName: customer.CustomerName,
        Mobile: customer.Mobile,
        AlternateMobile: customer.AlternateMobile || "",
        Email: customer.Email || "",
        Address: customer.Address || "",
        CreatedOn: customer.CreatedOn
      },
      history: {
        customerSince: customer.CreatedOn,
        totalBookings: totalBookings,
        lastEventDate: lastEventDate,
        eventTypes: eventTypes.join(", ")
      }
    });

  } catch (e) {
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

  const nextNo =
      bookings.length + 1;

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