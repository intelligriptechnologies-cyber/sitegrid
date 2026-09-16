# Business Requirement Document

## Builder Workforce, Site, Attendance & Wage Management App

## 1. Document Purpose

This Business Requirement Document defines the functional and business requirements for a customised application for a builder/construction business. The application will help the business owner and internal team manage construction sites, manpower/labour onboarding, attendance, wages, petty expenses, materials, resources, and project-level tracking across multiple locations.

The first version of the application will support three departments. The system should be designed in a scalable way so that more departments and additional modules can be added in future phases.

---

## 2. Business Background

The client is a builder who manages multiple construction sites and has staff, project engineers, project managers, and labour/manpower working at different locations. Currently, tracking of manpower, attendance, wages, expenses, tools, materials, and site progress may be handled manually or through disconnected records.

The proposed application will centralise these activities and provide better visibility to the business owner and department heads.

---

## 3. Business Objectives

The key objectives of the application are:

1. Manage multiple construction sites from a single system.
2. Onboard and maintain labour/manpower records with approval workflow.
3. Track daily attendance of labourers project-wise/site-wise.
4. Track wages and payment status of manpower.
5. Track petty expenses incurred at each project/site.
6. Maintain basic records of tools and safety equipment used at each project.
7. Track client-provided and company/personal-provided materials.
8. Capture site details including location, address, area, and GPS coordinates.
9. Provide role-based access to users based on responsibility level.
10. Enable future expansion to more departments and advanced modules.

---

## 4. Application Scope

### 4.1 In Scope – Phase 1

The first version of the application will include:

* User and role management
* Department setup
* Staff/user profile management
* Site/project creation
* Labour/manpower onboarding
* Labour approval workflow
* Project-wise labour assignment
* Daily attendance tracking
* Wage/payment tracking
* Petty expense tracking
* Tools tracking using text-based entry
* Safety equipment tracking using text-based entry
* Material tracking
* Basic location/GPS capture for sites
* Basic reports and dashboards

### 4.2 Future Scope

The system should allow future enhancement for:

* Additional departments
* Advanced inventory management
* Biometric device integration
* Mobile GPS tracking for staff/labour movement
* Payroll automation
* Vendor management
* Client billing
* Document upload
* Site progress photo tracking
* Mobile app / PWA support
* WhatsApp/SMS notifications
* Advanced analytics and reports

---

## 5. User Roles and Access Levels

The application will have role-based access control.

### 5.1 Role Hierarchy

| Level   | Role             | Description                                                                                   |
| ------- | ---------------- | --------------------------------------------------------------------------------------------- |
| Level 0 | Super Admin      | Full system control, global configuration, user management, approvals, and reports            |
| Level 1 | Business Owner   | Business-level access to all departments, sites, manpower, payments, expenses, and reports    |
| Level 2 | Department Head  | Department-level access, approvals, site monitoring, manpower and expense review              |
| Level 3 | Project Manager  | Site/project-level access, manpower onboarding, attendance entry, expenses, resource tracking |
| Level 3 | Project Engineer | Site/project-level access, attendance, site updates, resource and material tracking           |

### 5.2 General Role Access

| Feature                   | Super Admin | Business Owner | Department Head       | Project Manager     | Project Engineer         |
| ------------------------- | ----------- | -------------- | --------------------- | ------------------- | ------------------------ |
| Add/Edit Departments      | Yes         | Yes            | Limited/No            | No                  | No                       |
| Add/Edit Users            | Yes         | Yes            | Department Users Only | No                  | No                       |
| Add New Site              | Yes         | Yes            | Yes                   | Yes                 | Yes                      |
| Approve Labour Onboarding | Yes         | Yes            | Yes                   | No                  | No                       |
| Add Labour/Manpower       | Yes         | Yes            | Yes                   | Yes                 | Yes                      |
| Mark Attendance           | Yes         | Yes            | Yes                   | Yes                 | Yes                      |
| Track Wages               | Yes         | Yes            | Yes                   | Yes                 | View/Update as permitted |
| Track Expenses            | Yes         | Yes            | Yes                   | Yes                 | Yes                      |
| View Reports              | Yes         | Yes            | Department/Site Level | Assigned Site Level | Assigned Site Level      |

Final access control should be confirmed with the client before development.

---

## 6. Key Modules

## 6.1 User Management Module

This module will maintain all internal business users who can log in to the system.

### User Information to Capture

* Name
* Mobile number
* Email ID
* Designation
* Department
* Role/Access Level
* Login username
* Password / authentication details
* Active/Inactive status

### Functional Requirements

* Super Admin or Business Owner can add new system users.
* Users should be assigned a role and department.
* Users should be mapped to one or more sites if required.
* Users should be activated/deactivated.
* User activity should be trackable for important actions.

---

## 6.2 Department Management Module

The first version will support three departments. More departments can be added later.

### Functional Requirements

* Create and manage departments.
* Assign department heads.
* Assign staff/users to departments.
* Link sites/projects to departments if needed.
* Enable department-wise reporting.

---

## 6.3 Site / Project Management Module

Project Manager or Project Engineer will be able to add new construction sites/projects into the system.

### Site Information to Capture

* Site name
* Site description
* Department
* Project type
* Square feet / area
* Site address
* GPS location
* Client name/details
* Start date
* Expected completion date
* Project status
* Assigned Project Manager
* Assigned Project Engineer
* Notes/remarks

### Functional Requirements

* Add new site/project.
* Edit site details.
* Capture GPS location of the site.
* Assign staff to site.
* View active/completed/paused sites.
* Maintain basic site-level summary.
* Link manpower, attendance, expenses, tools, safety equipment, and materials to the site.

---

## 6.4 Manpower / Labour Management Module

This module will maintain labour/manpower records.

### Labour Information to Capture

* Labour name
* Aadhaar number
* Phone number
* Address
* Biometric details
* Labour type/category
* Skill type
* Daily wage rate
* Assigned site/project
* Joining date
* Active/Inactive status
* Approval status

### Functional Requirements

* Project Manager or Project Engineer can add labour/manpower details.
* New labour entry should go for approval.
* Labour can be approved by Level 0, Level 1, or Level 2 users.
* Labour should not be fully active until approved.
* Labour records should be searchable by name, phone number, Aadhaar number, and site.
* Aadhaar number should be validated to avoid duplicate labour records.
* Labour can be assigned to a project/site.
* Labour can be transferred between sites if required.

---

## 6.5 Labour Onboarding Approval Workflow

### Workflow

1. Project Manager/Engineer adds new labour details.
2. System creates an approval request.
3. Level 0, Level 1, or Level 2 user reviews the request.
4. Approver can approve or reject the request.
5. If approved, labour becomes active in the system.
6. If rejected, reason should be recorded.

### Approval Data to Capture

* Requested by
* Labour details
* Request date/time
* Approved/rejected by
* Approval date/time
* Approval status
* Rejection reason, if applicable

---

## 6.6 Daily Attendance Module

This module will track daily attendance of labourers project-wise.

### Attendance Information to Capture

* Date
* Site/project
* Labour name/ID
* Attendance status: Present, Absent, Half Day, Leave
* Check-in time
* Check-out time
* Marked by
* Remarks
* Optional GPS location while marking attendance

### Functional Requirements

* Attendance should be marked daily.
* Attendance should be linked to site/project.
* Project Manager/Engineer can mark attendance for assigned site.
* Department Head, Business Owner, and Super Admin can view attendance reports.
* Attendance data should be used for wage calculation.
* Duplicate attendance for the same labour, site, and date should be prevented.
* Attendance should be editable only by authorised users.

---

## 6.7 Wage and Payment Tracking Module

This module will track wage payable and payment status for labour/manpower.

### Wage Information to Capture

* Labour name/ID
* Site/project
* Wage rate
* Attendance days
* Half days
* Total payable amount
* Advance paid
* Balance payable
* Payment status
* Payment date
* Paid by
* Remarks

### Functional Requirements

* Wage calculation should be based on attendance and wage rate.
* System should show payable amount for each labour.
* Advance payments should be recorded.
* Payment status should be tracked as Pending, Partially Paid, or Paid.
* Payment reports should be available site-wise, labour-wise, and date-wise.
* Business Owner and authorised users should be able to review payment summaries.

---

## 6.8 Petty Expense Tracking Module

This module will track daily or site-level petty expenses.

### Expense Information to Capture

* Expense date
* Site/project
* Expense category
* Amount
* Paid by
* Description
* Bill/receipt upload, future phase
* Approved by, if approval is required
* Remarks

### Functional Requirements

* Project Manager/Engineer can add petty expenses.
* Expenses should be linked to site/project.
* Business Owner and Department Head can review expenses.
* Expense reports should be available date-wise, project-wise, and category-wise.
* Future version may include approval workflow for expenses.

---

## 6.9 Tools Tracking Module

For Phase 1, tools will be tracked using a text box field at project/site level.

### Data to Capture

* Tools available/used at site
* Quantity/details as text
* Remarks

### Functional Requirements

* Project Manager/Engineer can update tool details for each project.
* Tools information should be visible in the site/project details.
* Future version may include structured inventory with issue/return tracking.

---

## 6.10 Safety Equipment Tracking Module

For Phase 1, safety equipment will be tracked using a text box field at project/site level.

### Data to Capture

* Safety equipment available/used at site
* Quantity/details as text
* Remarks

### Functional Requirements

* Project Manager/Engineer can update safety equipment details.
* Equipment information should be linked to the project/site.
* Future version may include structured stock and assignment tracking.

---

## 6.11 Material Tracking Module

The system should track materials provided for each project.

### Material Categories

1. Materials provided by client
2. Materials provided by personal/company

### Material Information to Capture

* Material name
* Material category
* Quantity
* Unit
* Provided by
* Date received/provided
* Site/project
* Remarks

### Functional Requirements

* Add material details against a site/project.
* Separate client-provided and company-provided materials.
* View material summary project-wise.
* Future version may include purchase tracking, stock balance, and consumption tracking.

---

## 6.12 Location Tracking

The system should support basic location tracking.

### Phase 1 Requirement

* Capture GPS location of each site while creating or updating the site.
* Optionally capture GPS location when attendance is marked.

### Future Requirement

* Track real-time or periodic location of Project Engineer/Project Manager.
* Geo-fencing for attendance marking.
* Location history reports.

---

## 6.13 Reports and Dashboard

The application should provide basic dashboards and reports.

### Suggested Dashboard Items

* Total active sites
* Total manpower
* Pending labour approval requests
* Today’s attendance summary
* Site-wise labour count
* Pending wage payments
* Total petty expenses
* Department-wise site summary

### Suggested Reports

* Site-wise manpower report
* Daily attendance report
* Labour-wise attendance report
* Wage payable report
* Payment status report
* Petty expense report
* Material report
* Labour approval report

---

## 7. Suggested Application Workflow

### 7.1 User Setup Workflow

1. Super Admin creates Business Owner / Department Head / Project Manager / Project Engineer users.
2. User is assigned role, department, and access.
3. User logs in and accesses permitted modules.

### 7.2 Site Creation Workflow

1. Project Manager/Engineer adds new site.
2. Enters site description, area, address, GPS location, and client details.
3. Assigns site to department and responsible staff.
4. Site becomes available for manpower, attendance, expense, and material tracking.

### 7.3 Labour Onboarding Workflow

1. Project Manager/Engineer adds labour details.
2. Labour entry goes to approval queue.
3. Super Admin, Business Owner, or Department Head approves/rejects.
4. Approved labour becomes active.
5. Labour can be assigned to project/site.

### 7.4 Attendance Workflow

1. Project Manager/Engineer selects project/site.
2. Selects date.
3. Marks attendance for assigned labourers.
4. System stores attendance.
5. Attendance is used for wage/payment calculation.

### 7.5 Wage Payment Workflow

1. System calculates payable wages based on attendance and wage rate.
2. Authorised user records payment or advance.
3. Payment status is updated.
4. Reports show pending, partial, and completed payments.

### 7.6 Expense Workflow

1. Project Manager/Engineer adds petty expense.
2. Expense is linked to site/project.
3. Department Head/Business Owner reviews expenses.
4. Reports are generated project-wise and date-wise.

---

## 8. High-Level Data Entities

The application may require the following main data tables/entities:

1. Users
2. Roles
3. Departments
4. Sites/Projects
5. Labour/Manpower
6. Labour Approval Requests
7. Labour Site Assignment
8. Daily Attendance
9. Wage Master
10. Wage Payments
11. Petty Expenses
12. Tools Details
13. Safety Equipment Details
14. Materials
15. Clients
16. Audit Logs
17. Notifications, future phase

---

## 9. Non-Functional Requirements

### 9.1 Security

* Role-based access control.
* Secure login.
* Password encryption.
* Aadhaar and personal information should be protected.
* Users should only access permitted departments/sites.

### 9.2 Audit Trail

The system should maintain logs for important activities, such as:

* New labour added
* Labour approved/rejected
* Attendance marked/edited
* Wage payment updated
* Expense added/edited
* Site created/updated

### 9.3 Mobile-Friendly Design

Since project managers and engineers may work from site locations, the application should be mobile-friendly. A responsive web application or PWA can be considered in Phase 1.

### 9.4 Scalability

The system should support future addition of more departments, users, projects, manpower, and modules.

### 9.5 Data Backup

Regular database backup should be planned to avoid loss of business-critical records.

---

## 10. Assumptions

1. Phase 1 will be a customised web application.
2. Mobile-friendly design is required because field users will use it from site locations.
3. Biometric details will be stored as reference information in Phase 1. Actual biometric device integration may be considered in a later phase.
4. Tools and safety equipment will be stored as text entries in Phase 1.
5. Wage calculation logic will be based on attendance and daily wage rate unless the client defines a different rule.
6. Location tracking in Phase 1 will mainly capture site GPS location and optionally attendance marking location.
7. Approval for labour onboarding can be done by Super Admin, Business Owner, or Department Head.

---

## 11. Open Points for Client Confirmation

The following points should be confirmed before final development:

1. What are the three departments required in Phase 1?
2. Should Project Manager and Project Engineer have the same access level?
3. Should labour onboarding approval be mandatory for every labour?
4. Should attendance be marked only once per day or include check-in/check-out?
5. Should attendance require GPS validation?
6. Should wages be calculated daily, weekly, or monthly?
7. Will labour wage rates vary by person, skill, project, or day?
8. Is payment approval required before marking wages as paid?
9. Are petty expenses to be approved before being accepted?
10. Should bills/receipts be uploaded for petty expenses?
11. Is biometric device integration required immediately or later?
12. Should the app support Hindi/Odia language in future?
13. Should the app work offline at site locations with poor internet?
14. Should WhatsApp/SMS notifications be required for approvals or payments?
15. Who will have permission to edit attendance after submission?

---

## 12. Recommended Phase-Wise Development

### Phase 1 – Core MVP

* Login and role management
* Department setup
* User/staff management
* Site/project creation
* Labour onboarding
* Labour approval
* Project-wise labour assignment
* Daily attendance
* Basic wage/payment tracking
* Petty expense tracking
* Material tracking
* Tools and safety equipment text entry
* Basic reports and dashboard

### Phase 2 – Operational Enhancements

* Document upload
* Bill/receipt upload
* Attendance approval
* Expense approval
* GPS-based attendance
* WhatsApp/SMS alerts
* Project progress updates
* Site photo uploads

### Phase 3 – Advanced Modules

* Biometric device integration
* Structured tools and equipment inventory
* Material stock and consumption tracking
* Payroll processing
* Vendor management
* Client billing
* Mobile app
* Advanced analytics

---

## 13. Success Criteria

The application will be considered successful if:

1. The business can maintain all active sites in one system.
2. Labour onboarding and approval can be tracked digitally.
3. Daily attendance can be recorded project-wise.
4. Wage payable and payment status can be reviewed easily.
5. Petty expenses can be tracked against each project.
6. Business owner can view project-wise manpower, expenses, and payment summaries.
7. Manual dependency on notebooks, WhatsApp records, and Excel sheets is reduced.
8. The system can be expanded to include more departments and modules in future.

---

## 14. Summary

The proposed application will act as a central operational system for the builder’s construction business. It will help manage sites, manpower, attendance, wages, petty expenses, materials, tools, and safety equipment with role-based control. The first version should focus on the most important operational needs while keeping the architecture flexible for future enhancements such as biometric integration, GPS tracking, inventory, payroll, and client billing.
