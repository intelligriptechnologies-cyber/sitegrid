/* ============================================================
   SEED DATA — Builder Workforce, Site, Attendance & Wage Mgmt
   Demo data only. Seed data; copied into localStorage on first load (see core/store.js); use Reset demo data to restore.
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
  { id: 1, name: "Suresh Rout", aadhaar: "234567890123", phone: "9556100001", address: "Village Balianta, Bhubaneswar", createdBy: 7, biometricRef: "BIO10001", category: "Skilled", skill: "Mason", wageRate: 750, siteId: 1, joiningDate: "2026-01-15", active: true, approvalStatus: "Approved" },
  { id: 2, name: "Bijay Kumar Sahoo", aadhaar: "234567890124", phone: "9556100002", address: "Village Balianta, Bhubaneswar", createdBy: 7, biometricRef: "BIO10002", category: "Skilled", skill: "Electrician", wageRate: 800, siteId: 1, joiningDate: "2026-01-15", active: true, approvalStatus: "Approved" },
  { id: 3, name: "Manoranjan Behera", aadhaar: "234567890125", phone: "9556100003", address: "Village Tamando, Bhubaneswar", createdBy: 8, biometricRef: "", category: "Unskilled", skill: "Helper", wageRate: 450, siteId: null, joiningDate: "2026-09-10", active: false, approvalStatus: "Pending" },
  { id: 4, name: "Ajay Nath", aadhaar: "234567890123", phone: "9556100004", address: "Village Balianta, Bhubaneswar", createdBy: 9, biometricRef: "", category: "Skilled", skill: "Mason", wageRate: 750, siteId: 2, joiningDate: "2026-09-05", active: false, approvalStatus: "Rejected", rejectionReason: "Duplicate Aadhaar number — already registered as Suresh Rout (Labour ID 1)." },
  { id: 5, name: "Dilip Pradhan", aadhaar: "234567890126", phone: "9556100005", address: "Village Khandagiri, Bhubaneswar", createdBy: 7, biometricRef: "BIO10005", category: "Skilled", skill: "Carpenter", wageRate: 700, siteId: 5, joiningDate: "2026-02-01", active: true, approvalStatus: "Approved", transferHistory: [{ fromSiteId: 1, toSiteId: 5, date: "2026-08-01", movedBy: 6 }] },
  { id: 6, name: "Chittaranjan Das", aadhaar: "234567890127", phone: "9556100006", address: "Village Infocity, Bhubaneswar", createdBy: 8, biometricRef: "BIO10006", category: "Skilled", skill: "Electrician", wageRate: 780, siteId: 3, joiningDate: "2026-03-01", active: true, approvalStatus: "Approved" },
  { id: 7, name: "Prakash Muduli", aadhaar: "234567890128", phone: "9556100007", address: "Village Puri Road, Puri", createdBy: 9, biometricRef: "", category: "Unskilled", skill: "Helper", wageRate: 420, siteId: 4, joiningDate: "2026-09-15", active: false, approvalStatus: "Pending" },
  { id: 8, name: "Golak Bihari Jena", aadhaar: "234567890129", phone: "9556100008", address: "Village Balianta, Bhubaneswar", createdBy: 7, biometricRef: "BIO10008", category: "Skilled", skill: "Mason", wageRate: 760, siteId: 1, joiningDate: "2026-04-12", active: true, approvalStatus: "Approved" },
];

/* Many-to-many labour <-> site mapping. LABOUR.siteId stays as the derived "primary site" (first mapped, or null).
   Seed: every labour's current site; Dilip Pradhan (5) is also on site 1; Manoranjan (3) is deliberately unmapped. */
const LABOUR_SITES = [
  { id: 1, labourId: 1, siteId: 1 },
  { id: 2, labourId: 2, siteId: 1 },
  { id: 3, labourId: 4, siteId: 2 },
  { id: 4, labourId: 5, siteId: 5 },
  { id: 5, labourId: 5, siteId: 1 },
  { id: 6, labourId: 6, siteId: 3 },
  { id: 7, labourId: 7, siteId: 4 },
  { id: 8, labourId: 8, siteId: 1 },
];

/* Biometric (thumb-impression) images: { id, labourId, label, imageDataUrl, hash, capturedOn } */
const BIOMETRICS = [];

/* Approval requests (generic). Labour onboarding is one request type and mirrors LABOUR.approvalStatus.
   Shape: {id,type,title,description,siteId,labourId|null,amount|null,priority,requestedBy,requestDate,status,approvedBy|null,decisionDate|null,rejectionReason?,attachments[],history[{at,by,action,remark}]} */
const REQUEST_TYPES = ["Manpower Onboarding", "Petty Cash", "Material", "Tools & Safety", "General"];
const REQUEST_STATUSES = ["Pending", "Review Requested", "Resubmitted", "Approved", "Rejected"];
const APPROVAL_REQUESTS = [
  { id: 1, type: "Manpower Onboarding", title: "Onboard Suresh Rout", description: "Onboarding request for Suresh Rout.", siteId: 1, labourId: 1, amount: null, priority: "Normal", requestedBy: 7, requestDate: "2026-01-14 10:20", status: "Approved", approvedBy: 3, decisionDate: "2026-01-14 16:05", attachments: [], history: [{at: "2026-01-14 10:20", by: 7, action: "Created", remark: ""},{at: "2026-01-14 16:05", by: 3, action: "Approved", remark: ""}] },
  { id: 2, type: "Manpower Onboarding", title: "Onboard Bijay Kumar Sahoo", description: "Onboarding request for Bijay Kumar Sahoo.", siteId: 1, labourId: 2, amount: null, priority: "Normal", requestedBy: 7, requestDate: "2026-01-14 10:25", status: "Approved", approvedBy: 3, decisionDate: "2026-01-14 16:07", attachments: [], history: [{at: "2026-01-14 10:25", by: 7, action: "Created", remark: ""},{at: "2026-01-14 16:07", by: 3, action: "Approved", remark: ""}] },
  { id: 3, type: "Manpower Onboarding", title: "Onboard Manoranjan Behera", description: "Onboarding request for Manoranjan Behera.", siteId: null, labourId: 3, amount: null, priority: "Normal", requestedBy: 8, requestDate: "2026-09-10 09:12", status: "Pending", approvedBy: null, decisionDate: null, attachments: [], history: [{at: "2026-09-10 09:12", by: 8, action: "Created", remark: ""}] },
  { id: 4, type: "Manpower Onboarding", title: "Onboard Ajay Nath", description: "Onboarding request for Ajay Nath.", siteId: 2, labourId: 4, amount: null, priority: "Normal", requestedBy: 9, requestDate: "2026-09-05 11:40", status: "Rejected", approvedBy: 4, decisionDate: "2026-09-06 09:00", rejectionReason: "Duplicate Aadhaar number — already registered as Suresh Rout (Labour ID 1).", attachments: [], history: [{at: "2026-09-05 11:40", by: 9, action: "Created", remark: ""},{at: "2026-09-06 09:00", by: 4, action: "Rejected", remark: "Duplicate Aadhaar number — already registered as Suresh Rout (Labour ID 1)."}] },
  { id: 5, type: "Manpower Onboarding", title: "Onboard Dilip Pradhan", description: "Onboarding request for Dilip Pradhan.", siteId: 5, labourId: 5, amount: null, priority: "Normal", requestedBy: 7, requestDate: "2026-02-01 08:30", status: "Approved", approvedBy: 2, decisionDate: "2026-02-01 14:15", attachments: [], history: [{at: "2026-02-01 08:30", by: 7, action: "Created", remark: ""},{at: "2026-02-01 14:15", by: 2, action: "Approved", remark: ""}] },
  { id: 6, type: "Manpower Onboarding", title: "Onboard Chittaranjan Das", description: "Onboarding request for Chittaranjan Das.", siteId: 3, labourId: 6, amount: null, priority: "Normal", requestedBy: 8, requestDate: "2026-03-01 08:00", status: "Approved", approvedBy: 4, decisionDate: "2026-03-01 12:00", attachments: [], history: [{at: "2026-03-01 08:00", by: 8, action: "Created", remark: ""},{at: "2026-03-01 12:00", by: 4, action: "Approved", remark: ""}] },
  { id: 7, type: "Manpower Onboarding", title: "Onboard Prakash Muduli", description: "Onboarding request for Prakash Muduli.", siteId: 4, labourId: 7, amount: null, priority: "Normal", requestedBy: 9, requestDate: "2026-09-15 07:55", status: "Pending", approvedBy: null, decisionDate: null, attachments: [], history: [{at: "2026-09-15 07:55", by: 9, action: "Created", remark: ""}] },
  { id: 8, type: "Manpower Onboarding", title: "Onboard Golak Bihari Jena", description: "Onboarding request for Golak Bihari Jena.", siteId: 1, labourId: 8, amount: null, priority: "Normal", requestedBy: 7, requestDate: "2026-04-12 08:10", status: "Approved", approvedBy: 3, decisionDate: "2026-04-12 13:00", attachments: [], history: [{at: "2026-04-12 08:10", by: 7, action: "Created", remark: ""},{at: "2026-04-12 13:00", by: 3, action: "Approved", remark: ""}] },
  { id: 9, type: "Petty Cash", title: "Site cleaning and tea supplies", description: "Cash advance for cleaning supplies and labour tea this week.", siteId: 1, labourId: null, amount: 2500, priority: "Normal", requestedBy: 7, requestDate: "2026-09-15 09:30", status: "Pending", approvedBy: null, decisionDate: null, attachments: [], history: [{at: "2026-09-15 09:30", by: 7, action: "Created", remark: ""}] },
  { id: 10, type: "Petty Cash", title: "Emergency cable purchase", description: "Local purchase of 50 m armoured cable.", siteId: 3, labourId: null, amount: 6400, priority: "Urgent", requestedBy: 8, requestDate: "2026-09-14 14:10", status: "Review Requested", approvedBy: null, decisionDate: null, attachments: [], history: [{at: "2026-09-14 14:10", by: 8, action: "Created", remark: ""},{at: "2026-09-15 10:00", by: 4, action: "Review Requested", remark: "Attach the vendor quotation and split by item."}] },
  { id: 11, type: "Material", title: "Cement 200 bags for Tower 1", description: "Slab casting for the 4th floor.", siteId: 1, labourId: null, amount: 78000, priority: "Normal", requestedBy: 7, requestDate: "2026-09-10 08:45", status: "Approved", approvedBy: 3, decisionDate: "2026-09-10 15:20", attachments: [], history: [{at: "2026-09-10 08:45", by: 7, action: "Created", remark: ""},{at: "2026-09-10 15:20", by: 3, action: "Approved", remark: ""}] },
  { id: 12, type: "General", title: "Extra site office container", description: "Request for an additional office container at Tower 2.", siteId: 5, labourId: null, amount: null, priority: "Normal", requestedBy: 6, requestDate: "2026-09-12 11:00", status: "Rejected", approvedBy: 3, decisionDate: "2026-09-13 09:40", rejectionReason: "Not budgeted this quarter.", attachments: [], history: [{at: "2026-09-12 11:00", by: 6, action: "Created", remark: ""},{at: "2026-09-13 09:40", by: 3, action: "Rejected", remark: "Not budgeted this quarter."}] },
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

/* Wage & payment tracking — one record per labour + site + period ("YYYY-MM").
   payments[] is the ledger; advancePaid / balancePayable / status are derived by recalcWage (pages/wages.js). */
const WAGES = [
  { id: 1, labourId: 1, siteId: 1, period: "2026-09", wageRate: 750, daysPresent: 24, halfDays: 1, totalPayable: 18375, advancePaid: 5000, balancePayable: 13375, status: "Partially Paid", paymentDate: "2026-09-05", paidBy: 6, remarks: "Advance adjusted", payments: [{ id: 1, date: "2026-09-05", amount: 5000, mode: "Cash", by: 6, remarks: "Advance adjusted" }] },
  { id: 2, labourId: 2, siteId: 1, period: "2026-09", wageRate: 800, daysPresent: 22, halfDays: 0, totalPayable: 17600, advancePaid: 0, balancePayable: 17600, status: "Pending", paymentDate: null, paidBy: null, remarks: "", payments: [] },
  { id: 3, labourId: 5, siteId: 5, period: "2026-09", wageRate: 700, daysPresent: 20, halfDays: 0, totalPayable: 14000, advancePaid: 14000, balancePayable: 0, status: "Paid", paymentDate: "2026-09-10", paidBy: 6, remarks: "Full settlement", payments: [{ id: 1, date: "2026-09-10", amount: 14000, mode: "Bank", by: 6, remarks: "Full settlement" }] },
  { id: 4, labourId: 6, siteId: 3, period: "2026-09", wageRate: 780, daysPresent: 18, halfDays: 2, totalPayable: 14820, advancePaid: 8000, balancePayable: 6820, status: "Partially Paid", paymentDate: "2026-09-08", paidBy: 8, remarks: "", payments: [{ id: 1, date: "2026-09-08", amount: 8000, mode: "UPI", by: 8, remarks: "" }] },
  { id: 5, labourId: 8, siteId: 1, period: "2026-09", wageRate: 760, daysPresent: 21, halfDays: 1, totalPayable: 16340, advancePaid: 0, balancePayable: 16340, status: "Pending", paymentDate: null, paidBy: null, remarks: "", payments: [] },
];

/* Petty expenses — status Approved | Pending | Rejected (derived from approvedBy for the seed); labourId optional */
const EXPENSES = [
  { id: 1, date: "2026-09-14", siteId: 1, labourId: null, category: "Transport", amount: 1200, paidBy: 7, description: "Sand transport local trips", approvedBy: 3, status: "Approved", remarks: "" },
  { id: 2, date: "2026-09-14", siteId: 1, labourId: null, category: "Food", amount: 850, paidBy: 7, description: "Labour tea and refreshment", approvedBy: 3, status: "Approved", remarks: "" },
  { id: 3, date: "2026-09-15", siteId: 3, labourId: null, category: "Tools Purchase", amount: 3200, paidBy: 9, description: "Hand tools replacement", approvedBy: null, status: "Pending", remarks: "Awaiting department head review" },
  { id: 4, date: "2026-09-15", siteId: 5, labourId: null, category: "Miscellaneous", amount: 500, paidBy: 7, description: "Site cleaning supplies", approvedBy: 3, status: "Approved", remarks: "" },
  { id: 5, date: "2026-09-16", siteId: 4, labourId: null, category: "Transport", amount: 950, paidBy: 9, description: "Material shifting between blocks", approvedBy: 5, status: "Approved", remarks: "" },
  { id: 6, date: "2026-08-28", siteId: 1, labourId: 1, category: "Labour Welfare", amount: 1800, paidBy: 6, description: "First-aid and medicine for Suresh Rout", approvedBy: null, status: "Pending", remarks: "" },
];

/* Tools and safety equipment — one row per item per site.
   condition: Good | Needs repair | Needs inspection | Out of service */
const TOOLS = [
  { id: 1, siteId: 1, name: "Concrete mixer", quantity: 3, unit: "Nos", condition: "Good", remarks: "", updatedOn: "2026-09-01", updatedBy: 7 },
  { id: 2, siteId: 1, name: "Concrete mixer", quantity: 1, unit: "Nos", condition: "Needs repair", remarks: "Under repair", updatedOn: "2026-09-01", updatedBy: 7 },
  { id: 3, siteId: 1, name: "Vibrator", quantity: 6, unit: "Nos", condition: "Good", remarks: "", updatedOn: "2026-09-01", updatedBy: 7 },
  { id: 4, siteId: 1, name: "Wheelbarrow", quantity: 10, unit: "Nos", condition: "Good", remarks: "", updatedOn: "2026-09-01", updatedBy: 7 },
  { id: 5, siteId: 1, name: "Shovel", quantity: 25, unit: "Nos", condition: "Good", remarks: "", updatedOn: "2026-09-01", updatedBy: 7 },
  { id: 6, siteId: 2, name: "Scaffolding set", quantity: 2, unit: "Sets", condition: "Good", remarks: "Stored, site paused", updatedOn: "2026-09-01", updatedBy: 7 },
  { id: 7, siteId: 2, name: "Ladder", quantity: 8, unit: "Nos", condition: "Good", remarks: "Stored, site paused", updatedOn: "2026-09-01", updatedBy: 7 },
  { id: 8, siteId: 3, name: "Cable drum", quantity: 3, unit: "Nos", condition: "Good", remarks: "", updatedOn: "2026-09-01", updatedBy: 7 },
  { id: 9, siteId: 3, name: "Conduit pipe", quantity: 40, unit: "Nos", condition: "Good", remarks: "", updatedOn: "2026-09-01", updatedBy: 7 },
  { id: 10, siteId: 3, name: "Drilling machine", quantity: 2, unit: "Nos", condition: "Good", remarks: "", updatedOn: "2026-09-01", updatedBy: 7 },
  { id: 11, siteId: 4, name: "Tile cutter", quantity: 5, unit: "Nos", condition: "Good", remarks: "Handed over to client store", updatedOn: "2026-09-01", updatedBy: 7 },
  { id: 12, siteId: 4, name: "Trowel", quantity: 12, unit: "Nos", condition: "Good", remarks: "Handed over to client store", updatedOn: "2026-09-01", updatedBy: 7 },
  { id: 13, siteId: 5, name: "Excavator (rented)", quantity: 2, unit: "Nos", condition: "Good", remarks: "Excavator rent ends 2026-10-01", updatedOn: "2026-09-01", updatedBy: 7 },
  { id: 14, siteId: 5, name: "Shovel", quantity: 6, unit: "Nos", condition: "Good", remarks: "", updatedOn: "2026-09-01", updatedBy: 7 },
  { id: 15, siteId: 5, name: "Wheelbarrow", quantity: 4, unit: "Nos", condition: "Good", remarks: "", updatedOn: "2026-09-01", updatedBy: 7 },
];

const SAFETY_EQUIPMENT = [
  { id: 1, siteId: 1, name: "Helmet", quantity: 40, unit: "Nos", condition: "Good", remarks: "", updatedOn: "2026-09-01", updatedBy: 7 },
  { id: 2, siteId: 1, name: "Safety shoes", quantity: 40, unit: "Pairs", condition: "Good", remarks: "", updatedOn: "2026-09-01", updatedBy: 7 },
  { id: 3, siteId: 1, name: "Harness", quantity: 5, unit: "Nos", condition: "Good", remarks: "", updatedOn: "2026-09-01", updatedBy: 7 },
  { id: 4, siteId: 1, name: "Harness", quantity: 10, unit: "Nos", condition: "Needs inspection", remarks: "Due for inspection", updatedOn: "2026-09-01", updatedBy: 7 },
  { id: 5, siteId: 1, name: "Reflective jacket", quantity: 20, unit: "Nos", condition: "Good", remarks: "", updatedOn: "2026-09-01", updatedBy: 7 },
  { id: 6, siteId: 2, name: "Helmet", quantity: 20, unit: "Nos", condition: "Good", remarks: "Stored, site paused", updatedOn: "2026-09-01", updatedBy: 7 },
  { id: 7, siteId: 2, name: "Safety shoes", quantity: 20, unit: "Pairs", condition: "Good", remarks: "Stored, site paused", updatedOn: "2026-09-01", updatedBy: 7 },
  { id: 8, siteId: 3, name: "Helmet", quantity: 25, unit: "Nos", condition: "Good", remarks: "", updatedOn: "2026-09-01", updatedBy: 7 },
  { id: 9, siteId: 3, name: "Safety shoes", quantity: 25, unit: "Pairs", condition: "Good", remarks: "", updatedOn: "2026-09-01", updatedBy: 7 },
  { id: 10, siteId: 3, name: "Gloves set", quantity: 10, unit: "Sets", condition: "Good", remarks: "", updatedOn: "2026-09-01", updatedBy: 7 },
  { id: 11, siteId: 4, name: "Helmet", quantity: 15, unit: "Nos", condition: "Good", remarks: "Returned to central store", updatedOn: "2026-09-01", updatedBy: 7 },
  { id: 12, siteId: 4, name: "Safety shoes", quantity: 15, unit: "Pairs", condition: "Good", remarks: "Returned to central store", updatedOn: "2026-09-01", updatedBy: 7 },
  { id: 13, siteId: 5, name: "Helmet", quantity: 18, unit: "Nos", condition: "Good", remarks: "New stock issued 2026-09-01", updatedOn: "2026-09-01", updatedBy: 7 },
  { id: 14, siteId: 5, name: "Safety shoes", quantity: 18, unit: "Pairs", condition: "Good", remarks: "New stock issued 2026-09-01", updatedOn: "2026-09-01", updatedBy: 7 },
  { id: 15, siteId: 5, name: "Harness", quantity: 6, unit: "Nos", condition: "Good", remarks: "New stock issued 2026-09-01", updatedOn: "2026-09-01", updatedBy: 7 },
];

/* Material tracking — client-provided vs company-provided */
const MATERIALS = [
  { id: 1, siteId: 1, name: "Cement (OPC 53)", category: "Company Provided", quantity: 500, unit: "Bags", providedBy: "Kalinga Infra Suppliers", date: "2026-09-01", remarks: "", updatedBy: 7 },
  { id: 2, siteId: 1, name: "TMT Steel Bars", category: "Client Provided", quantity: 12, unit: "Tonnes", providedBy: "Odisha Housing Corporation", date: "2026-09-03", remarks: "Grade Fe500", updatedBy: 7 },
  { id: 3, siteId: 3, name: "Copper Wiring", category: "Company Provided", quantity: 2000, unit: "Meters", providedBy: "Kalinga Infra Suppliers", date: "2026-09-05", remarks: "", updatedBy: 7 },
  { id: 4, siteId: 3, name: "MCB Distribution Boards", category: "Client Provided", quantity: 15, unit: "Units", providedBy: "Kalinga Infra Developers", date: "2026-09-06", remarks: "", updatedBy: 7 },
  { id: 5, siteId: 5, name: "Bricks", category: "Company Provided", quantity: 25000, unit: "Numbers", providedBy: "Local Brick Kiln", date: "2026-09-10", remarks: "", updatedBy: 7 },
  { id: 6, siteId: 4, name: "Sanitary Fittings", category: "Client Provided", quantity: 12, unit: "Sets", providedBy: "Bay Residency Owners Association", date: "2026-01-20", remarks: "Installed and handed over", updatedBy: 7 },
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

/* Roles carry an editable perms[] array; ACCESS_MATRIX above is only the seed. */
ROLES.forEach((r) => {
  r.active = true;
  r.perms = Object.keys(ACCESS_MATRIX).filter((k) => ACCESS_MATRIX[k].includes(r.id));
});
const PERM_KEYS = Object.keys(ACCESS_MATRIX);
const PERM_LABELS = {
  addEditDepartments: "Add/edit departments",
  addEditUsers: "Manage users & roles",
  addSite: "Add sites",
  approveLabour: "Approve labour",
  addLabour: "Add labour",
  markAttendance: "Mark attendance",
  updateWagePayment: "Update wage payment",
  addExpense: "Add expenses",
  viewAllReports: "View all reports",
  viewDeptReports: "View department reports",
  viewSiteReports: "View site reports",
};
