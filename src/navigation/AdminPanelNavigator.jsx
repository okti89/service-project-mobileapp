import React from "react";
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AdminPanelScreen from "@/screens/admin/AdminPanelScreen";
import AdminUsersScreen from "@/screens/admin/AdminUsersScreen";
import AdminTechniciansScreen from "@/screens/admin/AdminTechniciansScreen";
import AdminCreateUserScreen from "@/screens/admin/AdminCreateUserScreen";
import AdminEditUserScreen from "@/screens/admin/AdminEditUserScreen";
import TechnicianLocationsScreen from "@/screens/technician/TechnicianLocationsScreen";
import TechnicianShiftsScreen from "@/screens/technician/TechnicianShiftsScreen";
import AdminTechnicianLeavesScreen from "@/screens/admin/AdminTechnicianLeavesScreen";
import CustomerListScreen from "@/screens/customers/CustomerListScreen";
import CustomerDetailScreen from "@/screens/customers/CustomerDetailScreen";
import CustomerFormScreen from "@/screens/customers/CustomerFormScreen";
import ProductListScreen from "@/screens/products/ProductListScreen";
import ProductFormScreen from "@/screens/products/ProductFormScreen";
import ProductDetailScreen from "@/screens/products/ProductDetailScreen";
import TechnicianDetailScreen from "@/screens/technician/TechnicianDetailScreen";
import PayrollScreen from "@/screens/hr/PayrollScreen";
import PayrollFormScreen from "@/screens/hr/PayrollFormScreen";
import PayrollDetailScreen from "@/screens/hr/PayrollDetailScreen";
import ServicesScreen from "@/screens/services/ServicesScreen";
import AdminAccountingScreen from "@/screens/admin/AdminAccountingScreen";
import AdminAccountingFormScreen from "@/screens/admin/AdminAccountingFormScreen";
import AdminAccountFormScreen from "@/screens/admin/AdminAccountFormScreen";
import AdminReportsScreen from "@/screens/admin/AdminReportsScreen";
import AdminCompanySettingsScreen from "@/screens/admin/AdminCompanySettingsScreen";
import AdminNotificationsScreen from "@/screens/admin/AdminNotificationsScreen";

const Stack = createNativeStackNavigator();

export default function AdminPanelNavigator() {
    return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="AdminPanelHome" component={AdminPanelScreen} />
            <Stack.Screen name="AdminUsers" component={AdminUsersScreen} />
            <Stack.Screen name="AdminTechnicians" component={AdminTechniciansScreen} />
            <Stack.Screen name="AdminCreateUser" component={AdminCreateUserScreen} />
            <Stack.Screen name="AdminEditUser" component={AdminEditUserScreen} />
            <Stack.Screen name="TechnicianLocations" component={TechnicianLocationsScreen} />
            <Stack.Screen name="TechnicianShifts" component={TechnicianShiftsScreen} />
            <Stack.Screen name="AdminTechnicianLeaves" component={AdminTechnicianLeavesScreen} />
            <Stack.Screen name="AdminCustomers" component={CustomerListScreen} />
            <Stack.Screen name="AdminCustomerDetail" component={CustomerDetailScreen} />
            <Stack.Screen name="AdminCustomerForm" component={CustomerFormScreen} />
            <Stack.Screen name="AdminProducts" component={ProductListScreen} />
            <Stack.Screen name="AdminProductDetail" component={ProductDetailScreen} />
            <Stack.Screen name="AdminProductForm" component={ProductFormScreen} />
            <Stack.Screen name="AdminTechnicianDetail" component={TechnicianDetailScreen} />
            <Stack.Screen name="AdminPayroll" component={PayrollScreen} />
            <Stack.Screen name="AdminPayrollForm" component={PayrollFormScreen} />
            <Stack.Screen name="AdminPayrollDetail" component={PayrollDetailScreen} />
            <Stack.Screen name="AdminAccounting" component={AdminAccountingScreen} />
            <Stack.Screen name="AdminAccountingForm" component={AdminAccountingFormScreen} />
            <Stack.Screen name="AdminAccountForm" component={AdminAccountFormScreen} />
            <Stack.Screen name="AdminReports" component={AdminReportsScreen} />
            <Stack.Screen name="AdminServices" component={ServicesScreen} />
            <Stack.Screen name="AdminCompanySettings" component={AdminCompanySettingsScreen} />
            <Stack.Screen name="AdminNotifications" component={AdminNotificationsScreen} />
            <Stack.Screen name="AdminSendNotification" component={AdminNotificationsScreen} />
        </Stack.Navigator>
    );
}
