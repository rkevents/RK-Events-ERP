/*****************************************************************
 * RK EVENTS ERP
 * Version : 1.0
 * File    : Auth.gs
 *****************************************************************/

/**
 * Returns current Google login email.
 * @returns {string}
 */
function getCurrentUserEmail() {

  return Session.getActiveUser().getEmail().trim().toLowerCase();

}

/**
 * Creates the first administrator if Users sheet is empty.
 */
function initializeUsers() {

  const sheet = getSheet(APP.SHEETS.USERS);

  if (sheet.getLastRow() > 1) {
    return;
  }

  // Create first admin user
  insert(APP.SHEETS.USERS, {

    UserID: generateId("USR"),

    Name: "Administrator",

    Email: getCurrentUserEmail(),

    Role: APP.ROLE.ADMIN,

    Status: "Active",

    CreatedOn: now()

  });

  writeLog(
    "SYSTEM",
    "First administrator account created."
  );

}

/**
 * Returns logged in user object.
 * @returns {Object|null}
 */
function getCurrentUser() {

  const email = getCurrentUserEmail();

  return findOne(
    APP.SHEETS.USERS,
    "Email",
    email
  );

}

/**
 * Check login.
 * @returns {boolean}
 */
function isLoggedIn() {

  return getCurrentUser() !== null;

}

/**
 * Check Admin.
 * @returns {boolean}
 */
function isAdmin() {

  const user = getCurrentUser();

  if (!user) {
    return false;
  }

  return user.Role === APP.ROLE.ADMIN;

}

/**
 * Returns current session information.
 * Used by dashboard.
 */
function getSession() {

  initializeUsers();

  const user = getCurrentUser();

  if (!user) {

    return failure(
      "Access denied. Contact administrator."
    );

  }

  if (user.Status !== "Active") {

    return failure(
      "Your account is inactive."
    );

  }

  return success(
    "Authorized",
    {

      userId: user.UserID,

      name: user.Name,

      email: user.Email,

      role: user.Role,

      company: APP.INFO.COMPANY,

      application: APP.INFO.NAME,

      version: APP.INFO.VERSION

    }

  );

}

/**
 * Returns user role.
 * @returns {string}
 */
function getUserRole() {

  const user = getCurrentUser();

  if (!user) {
    return "";
  }

  return user.Role;

}