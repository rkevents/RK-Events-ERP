/*****************************************************************
 * RK EVENTS ERP
 * Version : 1.0
 * File    : Config.gs
 *****************************************************************/

const APP = Object.freeze({

  INFO: {

    NAME: "RK Events ERP",

    VERSION: "1.0.0",

    COMPANY: "RK Events",

    ADDRESS: "21, Saptagiri Nagar, Lakshmipuram, Chennai - 600099",

    PHONE: "7358532915",

    EMAIL: "rkevents.groups@gmail.com"

  },

  DATABASE: {

    SPREADSHEET_ID: "1Uv2pZRo-McVLsb5BQuGSZxthK4ieqjSAx43X-Lwe8nA"

  },

  SHEETS: {

    CONFIG: "Config",

    USERS: "Users",

    CUSTOMERS: "Customers",

    PACKAGES: "Packages",

    BOOKINGS: "Bookings",

    EDITING: "Editing",

    EXPENSES: "Expenses",

    EMPLOYEES: "Employees",

    ATTENDANCE: "Attendance",

    SETTINGS: "Settings",

    LOGS: "Logs"

  },

  ROLE: {

    ADMIN: "Admin",

    STAFF: "Staff"

  },

  BOOKING_STATUS: {

    NEW: "New",

    CONFIRMED: "Confirmed",

    SHOOT_COMPLETED: "Shoot Completed",

    EDITING: "Editing",

    DELIVERED: "Delivered",

    CANCELLED: "Cancelled"

  },

  PAYMENT_STATUS: {

    PENDING: "Pending",

    PARTIAL: "Partial",

    PAID: "Paid"

  },

  EDITING_STATUS: {

    PENDING: "Pending",

    IN_PROGRESS: "In Progress",

    COMPLETED: "Completed"

  },

  YESNO: {

    YES: "Yes",

    NO: "No"

  },

  DATE: {

    FORMAT: "dd-MMM-yyyy",

    DATETIME: "dd-MMM-yyyy hh:mm:ss a",

    TIMEZONE: Session.getScriptTimeZone()

  }

});