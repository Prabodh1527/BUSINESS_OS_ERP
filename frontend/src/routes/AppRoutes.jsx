import { Routes, Route, Navigate } from "react-router-dom";
import DashboardLayout from "@/layouts/DashboardLayout";
import { useAuth } from "@/context/AuthContext";

// Auth
import Login from "@/modules/auth/Login";
import Register from "@/modules/auth/Register";
import ForgotPassword from "@/modules/auth/ForgotPassword";
import ResetPassword from "@/modules/auth/ResetPassword";

// Onboarding
import Welcome from "@/modules/onboarding/Welcome";
import BusinessInfo from "@/modules/onboarding/BusinessInfo";
import IndustrySelection from "@/modules/onboarding/IndustrySelection";
import Complete from "@/modules/onboarding/Complete";

// Dashboard
import Dashboard from "@/modules/dashboard/Dashboard";

// CRM
import Customers from "@/modules/crm/Customers";
import AddCustomer from "@/modules/crm/AddCustomer";
import CustomerProfile from "@/modules/crm/CustomerProfile";
import EditCustomer from "@/modules/crm/EditCustomer";

// Appointments
import Appointments from "@/modules/appointments/Appointments";
import Booking from "@/modules/appointments/Booking";
import AppointmentDetails from "@/modules/appointments/AppointmentDetails";
import Calendar from "@/modules/appointments/Calendar";

// Billing
import Invoices from "@/modules/billing/Invoices";
import InvoiceDetails from "@/modules/billing/InvoiceDetails";
import Payments from "@/modules/billing/Payments";
import Expenses from "@/modules/billing/Expenses";
import CreateInvoice from "@/modules/billing/CreateInvoice";

// Inventory
import Inventory from "@/modules/inventory/Inventory";
import Products from "@/modules/inventory/Products";
import PurchaseOrders from "@/modules/inventory/PurchaseOrders";
import Suppliers from "@/modules/inventory/Suppliers";
import CreateProduct from "@/modules/inventory/CreateProduct";

// Employees
import Employees from "@/modules/employees/Employees";
import OwnerEmployeeProfile from "@/modules/employees/EmployeeProfile";
import Attendance from "@/modules/employees/Attendance";
import Leaves from "@/modules/employees/Leaves";
import Payroll from "@/modules/employees/Payroll";
import Tasks from "@/modules/employees/Tasks";

// Employee Portal
import EmployeeDashboard from "@/modules/employee/EmployeeDashboard";
import MySchedule from "@/modules/employee/MySchedule";
import MyAttendance from "@/modules/employee/MyAttendance";
import MyLeaves from "@/modules/employee/MyLeaves";
import MyPayslips from "@/modules/employee/MyPayslips";
import MyTasks from "@/modules/employee/MyTasks";
import EmployeePortalProfile from "@/modules/employee/EmployeeProfile";
import EmployeeSettings from "@/modules/employee/settings/EmployeeSettings";
import EmployeeAIChat from "@/modules/employee/ai/EmployeeAIChat";
import EmployeeNotifications from "@/modules/employee/components/EmployeeNotifications";

// Reports
import Reports from "@/modules/reports/Reports";
import RevenueReport from "@/modules/reports/RevenueReport";
import SalesReport from "@/modules/reports/SalesReport";
import EmployeeReport from "@/modules/reports/EmployeeReport";
import InventoryReport from "@/modules/reports/InventoryReport";

// AI
import AIHome from "@/modules/ai/AIHome";
import AIChat from "@/modules/ai/AIChat";
import BusinessHealth from "@/modules/ai/BusinessHealth";
import Insights from "@/modules/ai/Insights";
import Predictions from "@/modules/ai/Predictions";
import Recommendations from "@/modules/ai/Recommendations";

// Settings
import General from "@/modules/settings/General";
import Business from "@/modules/settings/Business";
import Users from "@/modules/settings/Users";
import Roles from "@/modules/settings/Roles";
import Security from "@/modules/settings/Security";
import AISettings from "@/modules/settings/AISettings";
import Integrations from "@/modules/settings/Integrations";
import Subscription from "@/modules/settings/Subscription";
import Appearance from "@/modules/settings/Appearance";
import Masters from "@/modules/settings/Masters";
import ArchivedEmployees from "@/modules/settings/ArchivedEmployees";

// Notifications
import Notifications from "@/modules/notifications/Notifications";

// Files
import Files from "@/modules/files/Files";

// Public Booking Portal
import PublicBookingPage from "@/modules/public/PublicBookingPage";

import ProtectedRoute from "./ProtectedRoute";

// ==========================================
// ROOT REDIRECT
// ==========================================

function RootRedirect() {
  const { user } = useAuth();

  const normalizedRole = user?.role?.toUpperCase();

  return (
    <Navigate
      to={
        normalizedRole === "EMPLOYEE"
          ? "/employee/dashboard"
          : "/dashboard"
      }
      replace
    />
  );
}

// ==========================================
// PUBLIC ROUTE GUARD
// ==========================================

function PublicOnlyRoute({ children }) {
  const { isAuthenticated, loading, user } = useAuth();

  if (loading) return null;

  if (isAuthenticated) {
    const onboardingPending =
      localStorage.getItem("business-os-onboarding") === "pending";

    if (
      onboardingPending &&
      user?.role?.toUpperCase() !== "EMPLOYEE"
    ) {
      return <Navigate to="/onboarding" replace />;
    }

    const normalizedRole = user?.role?.toUpperCase();

    return (
      <Navigate
        to={
          normalizedRole === "EMPLOYEE"
            ? "/employee/dashboard"
            : "/dashboard"
        }
        replace
      />
    );
  }

  return children;
}

// ==========================================
// ONBOARDING GUARD
// ==========================================

function OnboardingRoute({ children }) {
  const { isAuthenticated, loading, user } = useAuth();

  if (loading) return null;

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  if (user?.role?.toUpperCase() === "EMPLOYEE") {
    return <Navigate to="/employee/dashboard" replace />;
  }

  return children;
}

// ==========================================
// APP ROUTES
// ==========================================

export default function AppRoutes() {
  return (
    <Routes>

      {/* ========================================
          AUTH
      ======================================== */}

      <Route
        path="/login"
        element={
          <PublicOnlyRoute>
            <Login />
          </PublicOnlyRoute>
        }
      />

      <Route
        path="/employee/login"
        element={<Navigate to="/login?role=employee" replace />}
      />

      <Route
        path="/login/employee"
        element={<Navigate to="/login?role=employee" replace />}
      />

      <Route
        path="/register"
        element={
          <PublicOnlyRoute>
            <Register />
          </PublicOnlyRoute>
        }
      />

      <Route
        path="/forgot-password"
        element={<ForgotPassword />}
      />

      <Route
        path="/reset-password"
        element={<ResetPassword />}
      />

      {/* ========================================
          PUBLIC CLIENT BOOKING PORTAL
      ======================================== */}
      <Route
        path="/book/:tenantSlug"
        element={<PublicBookingPage />}
      />
      <Route
        path="/book"
        element={<PublicBookingPage />}
      />

      {/* ========================================
          ONBOARDING
      ======================================== */}

      <Route
        path="/onboarding"
        element={
          <OnboardingRoute>
            <Welcome />
          </OnboardingRoute>
        }
      />

      <Route
        path="/onboarding/business"
        element={
          <OnboardingRoute>
            <BusinessInfo />
          </OnboardingRoute>
        }
      />

      <Route
        path="/onboarding/industry"
        element={
          <OnboardingRoute>
            <IndustrySelection />
          </OnboardingRoute>
        }
      />

      <Route
        path="/onboarding/complete"
        element={
          <OnboardingRoute>
            <Complete />
          </OnboardingRoute>
        }
      />

      {/* ========================================
          OWNER / MANAGEMENT
      ======================================== */}

      <Route
        element={
          <ProtectedRoute
            allowedRoles={[
              "OWNER",
              "ADMIN",
              "SUPER_ADMIN",
              "owner",
              "admin",
            ]}
          >
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<RootRedirect />} />

        <Route path="/dashboard" element={<Dashboard />} />

        {/* CRM */}
        <Route path="/crm" element={<Customers />} />
        <Route path="/customers" element={<Navigate to="/crm" replace />} />
        <Route path="/crm/add" element={<AddCustomer />} />
        <Route path="/crm/profile" element={<CustomerProfile />} />
        <Route path="/crm/edit" element={<EditCustomer />} />

        {/* Appointments */}
        <Route path="/appointments" element={<Appointments />} />
        <Route path="/appointments/booking" element={<Booking />} />
        <Route
          path="/appointments/details"
          element={<AppointmentDetails />}
        />
        <Route
          path="/appointments/calendar"
          element={<Calendar />}
        />

        {/* Billing */}
        <Route path="/billing" element={<Navigate to="/billing/invoices" replace />} />
        <Route path="/billing/invoices" element={<Invoices />} />
        <Route path="/billing/create" element={<CreateInvoice />} />
        <Route
          path="/billing/invoice/create"
          element={<CreateInvoice />}
        />
        <Route
          path="/billing/invoice-details"
          element={<InvoiceDetails />}
        />
        <Route path="/billing/payments" element={<Payments />} />
        <Route path="/billing/expenses" element={<Expenses />} />

        {/* Inventory */}
        <Route path="/inventory" element={<Inventory />} />
        <Route
          path="/inventory/products"
          element={<Products />}
        />
        <Route
          path="/inventory/purchase-orders"
          element={<PurchaseOrders />}
        />
        <Route
          path="/inventory/suppliers"
          element={<Suppliers />}
        />
        <Route
          path="/inventory/create"
          element={<CreateProduct />}
        />

        {/* Employees */}
        <Route path="/employees" element={<Employees />} />
        <Route
          path="/employees/profile"
          element={<OwnerEmployeeProfile />}
        />
        <Route
          path="/employees/profile/:id"
          element={<OwnerEmployeeProfile />}
        />
        <Route
          path="/employees/:id"
          element={<OwnerEmployeeProfile />}
        />
        <Route
          path="/employees/attendance"
          element={<Attendance />}
        />
        <Route path="/employees/leaves" element={<Leaves />} />
        <Route path="/employees/payroll" element={<Payroll />} />
        <Route path="/employees/tasks" element={<Tasks />} />

        {/* Reports */}
        <Route path="/reports" element={<Reports />} />
        <Route
          path="/reports/revenue"
          element={<RevenueReport />}
        />
        <Route
          path="/reports/sales"
          element={<SalesReport />}
        />
        <Route
          path="/reports/employees"
          element={<EmployeeReport />}
        />
        <Route
          path="/reports/inventory"
          element={<InventoryReport />}
        />

        {/* AI */}
        <Route path="/ai" element={<AIHome />} />
        <Route path="/ai/chat" element={<AIChat />} />
        <Route path="/ai/health" element={<BusinessHealth />} />
        <Route path="/ai/insights" element={<Insights />} />
        <Route
          path="/ai/predictions"
          element={<Predictions />}
        />
        <Route
          path="/ai/recommendations"
          element={<Recommendations />}
        />

        {/* Settings */}
        <Route path="/settings" element={<General />} />
        <Route
          path="/settings/business"
          element={<Business />}
        />
        <Route path="/settings/users" element={<Users />} />
        <Route path="/settings/roles" element={<Roles />} />
        <Route
          path="/settings/security"
          element={<Security />}
        />
        <Route
          path="/settings/ai"
          element={<AISettings />}
        />
        <Route
          path="/settings/integrations"
          element={<Integrations />}
        />
        <Route
          path="/settings/subscription"
          element={<Subscription />}
        />
        <Route
          path="/settings/appearance"
          element={<Appearance />}
        />
        <Route
          path="/settings/masters"
          element={<Masters />}
        />
        <Route
          path="/settings/archived-employees"
          element={<ArchivedEmployees />}
        />

        {/* General */}
        <Route
          path="/notifications"
          element={<Notifications />}
        />
        <Route path="/files" element={<Files />} />
      </Route>

      {/* ========================================
          EMPLOYEE PORTAL
      ======================================== */}

      <Route
        element={
          <ProtectedRoute
            allowedRoles={["EMPLOYEE", "employee"]}
          >
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route
          path="/employee/dashboard"
          element={<EmployeeDashboard />}
        />
        <Route
          path="/employee/schedule"
          element={<MySchedule />}
        />
        <Route
          path="/employee/attendance"
          element={<MyAttendance />}
        />
        <Route
          path="/employee/leaves"
          element={<MyLeaves />}
        />
        <Route
          path="/employee/payslips"
          element={<MyPayslips />}
        />
        <Route
          path="/employee/tasks"
          element={<MyTasks />}
        />
        <Route
          path="/employee/settings"
          element={<EmployeeSettings />}
        />
        <Route
          path="/employee/profile"
          element={<Navigate to="/employee/settings" replace />}
        />
        <Route
          path="/employee/ai"
          element={<EmployeeAIChat />}
        />
        <Route
          path="/employee/notifications"
          element={<EmployeeNotifications />}
        />
      </Route>

      {/* ========================================
          FALLBACK
      ======================================== */}

      <Route path="*" element={<RootRedirect />} />

    </Routes>
  );
}