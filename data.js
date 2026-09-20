/* ============================================================
   SEED DATA — Builder Workforce, Site, Attendance & Wage Mgmt
   Demo data only. Held in memory; resets on page reload.
   ID convention: plain numeric IDs. Text fields are plain
   words/names. No invented alphanumeric codes (e.g. no "S-001")
   unless the real-world field itself is alphanumeric.
   ============================================================ */

const ROLES = [
  { id: 0, name: "Super Admin", level: 0 },
  { id: 1, name: "Business Owner", level: 1 },
  { id: 2, name: "Department Head", level: 2 },
  { id: 3, name: "Project Manager", level: 3 },
  { id: 4, name: "Project Engineer", level: 3 },
];

const DEPARTMENTS = [
  { id: 1, name: "Civil Construction", headUserId: 3, active: true },
  { id: 2, name: "Electrical Works", headUserId: 4, active: true },
  { id: 3, name: "Plumbing and Sanitation", headUserId: 5, active: true },
];

const USERS = [
  { id: 1, name: "Ramesh Behera", mobile: "9876500001", email: "ramesh.behera@builder.demo", designation: "System Administrator", departmentIds: [], roleId: 0, active: true, siteIds: [] },
  { id: 2, name: "Sunita Patnaik", mobile: "9876500002", email: "sunita.patnaik@builder.demo", designation: "Business Owner", departmentIds: [], roleId: 1, active: true, siteIds: [] },
  { id: 3, name: "Debasis Nayak", mobile: "9876500003", email: "debasis.nayak@builder.demo", designation: "Department Head", departmentIds: [1], roleId: 2, active: true, siteIds: [1, 5] },
  { id: 4, name: "Priya Mohanty", mobile: "9876500004", email: "priya.mohanty@builder.demo", designation: "Department Head", departmentIds: [2], roleId: 2, active: true, siteIds: [2, 3] },
  { id: 5, name: "Ashok Swain", mobile: "9876500005", email: "ashok.swain@builder.demo", designation: "Department Head", departmentIds: [3], roleId: 2, active: true, siteIds: [4] },
  { id: 6, name: "Manoj Sethi", mobile: "9876500006", email: "manoj.sethi@builder.demo", designation: "Project Manager", departmentIds: [1], roleId: 3, active: true, siteIds: [1] },
  { id: 7, name: "Kiran Sahu", mobile: "9876500007", email: "kiran.sahu@builder.demo", designation: "Project Engineer", departmentIds: [1, 2], roleId: 4, active: true, siteIds: [1, 5, 3] },
  { id: 8, name: "Rajesh Panda", mobile: "9876500008", email: "rajesh.panda@builder.demo", designation: "Project Manager", departmentIds: [2], roleId: 3, active: true, siteIds: [3] },
  { id: 9, name: "Bikash Jena", mobile: "9876500009", email: "bikash.jena@builder.demo", designation: "Project Engineer", departmentIds: [3], roleId: 4, active: false, siteIds: [4] },
];

const CLIENTS = [
  { id: 1, name: "Odisha Housing Corporation" },
  { id: 2, name: "Kalinga Infra Developers" },
  { id: 3, name: "Bay Residency Owners Association" },
];

const SITES = [
  { id: 1, name: "Riverside Residency Tower 1", description: "12 floor residential tower", departmentId: 1, projectType: "Residential", areaSqft: 45000, address: "Plot 14, Chandrasekharpur, Bhubaneswar", lat: 20.3477, lng: 85.8245, clientId: 1, startDate: "2026-01-12", endDate: "2027-06-30", status: "Active", pmUserId: 6, peUserId: 7, notes: "Foundation and 3 floors complete." },
  { id: 2, name: "Kalinga Business Park", description: "Commercial office complex", departmentId: 2, projectType: "Commercial", areaSqft: 78000, address: "NH16 Service Road, Cuttack", lat: 20.4625, lng: 85.8828, clientId: 2, startDate: "2025-08-01", endDate: "2026-12-15", status: "Paused", pmUserId: 8, peUserId: 9, notes: "Paused pending revised municipal approval." },
  { id: 3, name: "Kalinga IT Annex", description: "IT park annex block", departmentId: 2, projectType: "Commercial", areaSqft: 32000, address: "Infocity Road, Bhubaneswar", lat: 20.3559, lng: 85.8188, clientId: 2, startDate: "2026-02-20", endDate: "2026-11-30", status: "Active", pmUserId: 8, peUserId: 9, notes: "Electrical first fix in progress." },
  { id: 4, name: "Bay Residency Villas", description: "12 villa row housing", departmentId: 3, projectType: "Residential", areaSqft: 21000, address: "Puri Beach Road, Puri", lat: 19.8135, lng: 85.8312, clientId: 3, startDate: "2025-03-10", endDate: "2026-02-28", status: "Completed", pmUserId: 8, peUserId: 9, notes: "Handover complete, retention period active." },
  { id: 5, name: "Riverside Residency Tower 2", description: "10 floor residential tower", departmentId: 1, projectType: "Residential", areaSqft: 38000, address: "Plot 15, Chandrasekharpur, Bhubaneswar", lat: 20.3481, lng: 85.8251, clientId: 1, startDate: "2026-05-01", endDate: "2027-10-31", status: "Active", pmUserId: 6, peUserId: 7, notes: "Excavation stage." },
];

/* Labour / manpower — mixed approval states, one transfer, one duplicate-Aadhaar rejection */
const LABOUR = [
  { id: 1, name: "Suresh Rout", aadhaar: "234567890123", phone: "9556100001", address: "Village Balianta, Bhubaneswar", biometricRef: "BIO10001", category: "Skilled", skill: "Mason", wageRate: 750, siteId: 1, joiningDate: "2026-01-15", active: true, approvalStatus: "Approved" },
  { id: 2, name: "Bijay Kumar Sahoo", aadhaar: "234567890124", phone: "9556100002", address: "Village Balianta, Bhubaneswar", biometricRef: "BIO10002", category: "Skilled", skill: "Electrician", wageRate: 800, siteId: 1, joiningDate: "2026-01-15", active: true, approvalStatus: "Approved" },
  { id: 3, name: "Manoranjan Behera", aadhaar: "234567890125", phone: "9556100003", address: "Village Tamando, Bhubaneswar", biometricRef: "", category: "Unskilled", skill: "Helper", wageRate: 450, siteId: 3, joiningDate: "2026-09-10", active: false, approvalStatus: "Pending" },
  { id: 4, name: "Ajay Nath", aadhaar: "234567890123", phone: "9556100004", address: "Village Balianta, Bhubaneswar", biometricRef: "", category: "Skilled", skill: "Mason", wageRate: 750, siteId: 2, joiningDate: "2026-09-05", active: false, approvalStatus: "Rejected", rejectionReason: "Duplicate Aadhaar number — already registered as Suresh Rout (Labour ID 1)." },
  { id: 5, name: "Dilip Pradhan", aadhaar: "234567890126", phone: "9556100005", address: "Village Khandagiri, Bhubaneswar", biometricRef: "BIO10005", category: "Skilled", skill: "Carpenter", wageRate: 700, siteId: 5, joiningDate: "2026-02-01", active: true, approvalStatus: "Approved", transferHistory: [{ fromSiteId: 1, toSiteId: 5, date: "2026-08-01", movedBy: 6 }] },
  { id: 6, name: "Chittaranjan Das", aadhaar: "234567890127", phone: "9556100006", address: "Village Infocity, Bhubaneswar", biometricRef: "BIO10006", category: "Skilled", skill: "Electrician", wageRate: 780, siteId: 3, joiningDate: "2026-03-01", active: true, approvalStatus: "Approved" },
  { id: 7, name: "Prakash Muduli", aadhaar: "234567890128", phone: "9556100007", address: "Village Puri Road, Puri", biometricRef: "", category: "Unskilled", skill: "Helper", wageRate: 420, siteId: 4, joiningDate: "2026-09-15", active: false, approvalStatus: "Pending" },
  { id: 8, name: "Golak Bihari Jena", aadhaar: "234567890129", phone: "9556100008", address: "Village Balianta, Bhubaneswar", biometricRef: "BIO10008", category: "Skilled", skill: "Mason", wageRate: 760, siteId: 1, joiningDate: "2026-04-12", active: true, approvalStatus: "Approved" },
];

/* Approval workflow log — mirrors LABOUR.approvalStatus */
const APPROVAL_REQUESTS = [
  { id: 1, labourId: 1, requestedBy: 7, requestDate: "2026-01-14 10:20", approvedBy: 3, decisionDate: "2026-01-14 16:05", status: "Approved" },
  { id: 2, labourId: 2, requestedBy: 7, requestDate: "2026-01-14 10:25", approvedBy: 3, decisionDate: "2026-01-14 16:07", status: "Approved" },
  { id: 3, labourId: 3, requestedBy: 8, requestDate: "2026-09-10 09:12", approvedBy: null, decisionDate: null, status: "Pending" },
  { id: 4, labourId: 4, requestedBy: 9, requestDate: "2026-09-05 11:40", approvedBy: 4, decisionDate: "2026-09-06 09:00", status: "Rejected", rejectionReason: "Duplicate Aadhaar number — already registered as Suresh Rout (Labour ID 1)." },
  { id: 5, labourId: 5, requestedBy: 7, requestDate: "2026-02-01 08:30", approvedBy: 2, decisionDate: "2026-02-01 14:15", status: "Approved" },
  { id: 6, labourId: 6, requestedBy: 8, requestDate: "2026-03-01 08:00", approvedBy: 4, decisionDate: "2026-03-01 12:00", status: "Approved" },
  { id: 7, labourId: 7, requestedBy: 9, requestDate: "2026-09-15 07:55", approvedBy: null, decisionDate: null, status: "Pending" },
  { id: 8, labourId: 8, requestedBy: 7, requestDate: "2026-04-12 08:10", approvedBy: 3, decisionDate: "2026-04-12 13:00", status: "Approved" },
];

/* Daily attendance — covers Present / Absent / Half Day / Leave, GPS optional */
const ATTENDANCE = [
  { id: 1, date: "2026-09-15", siteId: 1, labourId: 1, status: "Present", checkIn: "08:00", checkOut: "17:30", markedBy: 7, gps: { lat: 20.3477, lng: 85.8245 }, remarks: "" },
  { id: 2, date: "2026-09-15", siteId: 1, labourId: 2, status: "Present", checkIn: "08:05", checkOut: "17:30", markedBy: 7, gps: { lat: 20.3477, lng: 85.8245 }, remarks: "" },
  { id: 3, date: "2026-09-15", siteId: 1, labourId: 8, status: "Half Day", checkIn: "08:00", checkOut: "12:30", markedBy: 7, gps: null, remarks: "Left early — personal work" },
  { id: 4, date: "2026-09-15", siteId: 3, labourId: 6, status: "Absent", checkIn: "", checkOut: "", markedBy: 9, gps: null, remarks: "No show, not informed" },
  { id: 5, date: "2026-09-15", siteId: 5, labourId: 5, status: "Leave", checkIn: "", checkOut: "", markedBy: 7, gps: null, remarks: "Approved personal leave" },
  { id: 6, date: "2026-09-16", siteId: 1, labourId: 1, status: "Present", checkIn: "08:02", checkOut: "17:35", markedBy: 7, gps: { lat: 20.3478, lng: 85.8246 }, remarks: "" },
  { id: 7, date: "2026-09-16", siteId: 1, labourId: 2, status: "Absent", checkIn: "", checkOut: "", markedBy: 7, gps: null, remarks: "" },
  { id: 8, date: "2026-09-16", siteId: 1, labourId: 8, status: "Present", checkIn: "07:58", checkOut: "17:40", markedBy: 7, gps: { lat: 20.3477, lng: 85.8244 }, remarks: "" },
  { id: 9, date: "2026-09-16", siteId: 3, labourId: 6, status: "Present", checkIn: "08:10", checkOut: "17:20", markedBy: 9, gps: null, remarks: "" },
  { id: 10, date: "2026-09-16", siteId: 5, labourId: 5, status: "Present", checkIn: "08:00", checkOut: "17:00", markedBy: 7, gps: { lat: 20.3481, lng: 85.8251 }, remarks: "" },
];

/* Wage & payment tracking — Pending / Partially Paid / Paid */
const WAGES = [
  { id: 1, labourId: 1, siteId: 1, wageRate: 750, daysPresent: 24, halfDays: 1, totalPayable: 18375, advancePaid: 5000, balancePayable: 13375, status: "Partially Paid", paymentDate: "2026-09-05", paidBy: 6, remarks: "Advance adjusted" },
  { id: 2, labourId: 2, siteId: 1, wageRate: 800, daysPresent: 22, halfDays: 0, totalPayable: 17600, advancePaid: 0, balancePayable: 17600, status: "Pending", paymentDate: null, paidBy: null, remarks: "" },
  { id: 3, labourId: 5, siteId: 5, wageRate: 700, daysPresent: 20, halfDays: 0, totalPayable: 14000, advancePaid: 14000, balancePayable: 0, status: "Paid", paymentDate: "2026-09-10", paidBy: 6, remarks: "Full settlement" },
  { id: 4, labourId: 6, siteId: 3, wageRate: 780, daysPresent: 18, halfDays: 2, totalPayable: 14820, advancePaid: 8000, balancePayable: 6820, status: "Partially Paid", paymentDate: "2026-09-08", paidBy: 8, remarks: "" },
  { id: 5, labourId: 8, siteId: 1, wageRate: 760, daysPresent: 21, halfDays: 1, totalPayable: 16340, advancePaid: 0, balancePayable: 16340, status: "Pending", paymentDate: null, paidBy: null, remarks: "" },
];

/* Petty expenses */
const EXPENSES = [
  { id: 1, date: "2026-09-14", siteId: 1, category: "Transport", amount: 1200, paidBy: 7, description: "Sand transport local trips", approvedBy: 3, remarks: "" },
  { id: 2, date: "2026-09-14", siteId: 1, category: "Food", amount: 850, paidBy: 7, description: "Labour tea and refreshment", approvedBy: 3, remarks: "" },
  { id: 3, date: "2026-09-15", siteId: 3, category: "Tools Purchase", amount: 3200, paidBy: 9, description: "Hand tools replacement", approvedBy: null, remarks: "Awaiting department head review" },
  { id: 4, date: "2026-09-15", siteId: 5, category: "Miscellaneous", amount: 500, paidBy: 7, description: "Site cleaning supplies", approvedBy: 3, remarks: "" },
  { id: 5, date: "2026-09-16", siteId: 4, category: "Transport", amount: 950, paidBy: 9, description: "Material shifting between blocks", approvedBy: 5, remarks: "" },
];

/* Tools tracking — Phase 1 text entry per site */
const TOOLS = [
  { id: 1, siteId: 1, details: "4 concrete mixers, 6 vibrators, 10 wheelbarrows, 25 shovels", remarks: "1 mixer under repair" },
  { id: 2, siteId: 2, details: "2 scaffolding sets, 8 ladders", remarks: "Stored, site paused" },
  { id: 3, siteId: 3, details: "3 cable drums, 40 conduit pipes, 2 drilling machines", remarks: "" },
  { id: 4, siteId: 4, details: "5 tile cutters, 12 trowels", remarks: "Handed over to client store" },
  { id: 5, siteId: 5, details: "2 excavators on rent, 6 shovels, 4 wheelbarrows", remarks: "Excavator rent ends 2026-10-01" },
];

/* Safety equipment tracking — Phase 1 text entry per site */
const SAFETY_EQUIPMENT = [
  { id: 1, siteId: 1, details: "40 helmets, 40 safety shoes, 15 harnesses, 20 reflective jackets", remarks: "10 harnesses due for inspection" },
  { id: 2, siteId: 2, details: "20 helmets, 20 safety shoes", remarks: "Stored, site paused" },
  { id: 3, siteId: 3, details: "25 helmets, 25 safety shoes, 10 gloves sets", remarks: "" },
  { id: 4, siteId: 4, details: "15 helmets, 15 safety shoes", remarks: "Returned to central store" },
  { id: 5, siteId: 5, details: "18 helmets, 18 safety shoes, 6 harnesses", remarks: "New stock issued 2026-09-01" },
];

/* Material tracking — client-provided vs company-provided */
const MATERIALS = [
  { id: 1, siteId: 1, name: "Cement (OPC 53)", category: "Company Provided", quantity: 500, unit: "Bags", providedBy: "Kalinga Infra Suppliers", date: "2026-09-01", remarks: "" },
  { id: 2, siteId: 1, name: "TMT Steel Bars", category: "Client Provided", quantity: 12, unit: "Tonnes", providedBy: "Odisha Housing Corporation", date: "2026-09-03", remarks: "Grade Fe500" },
  { id: 3, siteId: 3, name: "Copper Wiring", category: "Company Provided", quantity: 2000, unit: "Meters", providedBy: "Kalinga Infra Suppliers", date: "2026-09-05", remarks: "" },
  { id: 4, siteId: 3, name: "MCB Distribution Boards", category: "Client Provided", quantity: 15, unit: "Units", providedBy: "Kalinga Infra Developers", date: "2026-09-06", remarks: "" },
  { id: 5, siteId: 5, name: "Bricks", category: "Company Provided", quantity: 25000, unit: "Numbers", providedBy: "Local Brick Kiln", date: "2026-09-10", remarks: "" },
  { id: 6, siteId: 4, name: "Sanitary Fittings", category: "Client Provided", quantity: 12, unit: "Sets", providedBy: "Bay Residency Owners Association", date: "2026-01-20", remarks: "Installed and handed over" },
];

/* Audit log — important system actions */
const AUDIT_LOG = [
  { id: 1, timestamp: "2026-01-14 10:20", userId: 7, action: "Labour Added", details: "Suresh Rout added at Riverside Residency Tower 1" },
  { id: 2, timestamp: "2026-01-14 16:05", userId: 3, action: "Labour Approved", details: "Suresh Rout approval granted" },
  { id: 3, timestamp: "2026-09-05 11:40", userId: 9, action: "Labour Added", details: "Ajay Nath added at Kalinga Business Park" },
  { id: 4, timestamp: "2026-09-06 09:00", userId: 4, action: "Labour Rejected", details: "Ajay Nath rejected — duplicate Aadhaar number" },
  { id: 5, timestamp: "2026-09-15 08:05", userId: 7, action: "Attendance Marked", details: "Attendance marked for Riverside Residency Tower 1, 2026-09-15" },
  { id: 6, timestamp: "2026-09-08 15:00", userId: 8, action: "Wage Payment Updated", details: "Chittaranjan Das marked Partially Paid" },
  { id: 7, timestamp: "2026-09-14 18:10", userId: 3, action: "Expense Approved", details: "Transport expense approved for Riverside Residency Tower 1" },
  { id: 8, timestamp: "2026-08-01 09:00", userId: 6, action: "Labour Transferred", details: "Dilip Pradhan transferred from Tower 1 to Tower 2" },
  { id: 9, timestamp: "2026-09-16 08:02", userId: 7, action: "Attendance Marked", details: "Attendance marked for Riverside Residency Tower 1, 2026-09-16" },
];

/* Rejected duplicate-Aadhaar scenario is pre-seeded above (Labour ID 4).
   ACCESS_MATRIX drives what each role level may do in the UI. */
const ACCESS_MATRIX = {
  addEditDepartments: [0, 1],
  addEditUsers: [0, 1],
  addSite: [0, 1, 2, 3, 4],
  approveLabour: [0, 1, 2],
  addLabour: [0, 1, 2, 3, 4],
  markAttendance: [0, 1, 2, 3, 4],
  updateWagePayment: [0, 1, 2, 3],
  addExpense: [0, 1, 2, 3, 4],
  viewAllReports: [0, 1],
  viewDeptReports: [2],
  viewSiteReports: [3, 4],
};
