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

  try {

    const bookings = getAll(APP.SHEETS.BOOKINGS);

    bookings.sort(function (a, b) {

      return new Date(b.CreatedOn) - new Date(a.CreatedOn);

    });

    return success(

      "Success",

      bookings

    );

  }
  catch (e) {

    return failure(e.message);

  }

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

    return success(

      "Success",

      booking

    );

  }
  catch (e) {

    return failure(e.message);

  }

}

/*****************************************************************
 * DELETE BOOKING
 * (Placeholder - implement later)
 *****************************************************************/

function deleteBooking(bookingId) {

  return failure(

    "Delete Booking will be added in the next version."

  );

}

/*****************************************************************
 * EDIT BOOKING
 * (Placeholder - implement later)
 *****************************************************************/

function updateBooking(data) {

  return failure(

    "Edit Booking will be added in the next version."

  );

}