import React from "react";
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AdminPanelScreen from "@/screens/admin/AdminPanelScreen";
import AdminUsersScreen from "@/screens/admin/AdminUsersScreen";
import AdminTechniciansScreen from "@/screens/admin/AdminTechniciansScreen";
import AdminCreateUserScreen from "@/screens/admin/AdminCreateUserScreen";
import TechnicianLocationsScreen from "@/screens/technician/TechnicianLocationsScreen";
import TechnicianShiftsScreen from "@/screens/technician/TechnicianShiftsScreen";
import AdminTechnicianLeavesScreen from "@/screens/admin/AdminTechnicianLeavesScreen";
import CustomerListScreen from "@/screens/customers/CustomerListScreen";
import CustomerDetailScreen from "@/screens/customers/CustomerDetailScreen";
import CustomerFormScreen from "@/screens/customers/CustomerFormScreen";
import ProductListScreen from "@/screens/products/ProductListScreen";
import ProductFormScreen from "@/screens/products/ProductFormScreen";

const Stack = createNativeStackNavigator();

export default function AdminPanelNavigator() {
    return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="AdminPanelHome" component={AdminPanelScreen} />
            <Stack.Screen name="AdminUsers" component={AdminUsersScreen} />
            <Stack.Screen name="AdminTechnicians" component={AdminTechniciansScreen} />
            <Stack.Screen name="AdminCreateUser" component={AdminCreateUserScreen} />
            <Stack.Screen name="TechnicianLocations" component={TechnicianLocationsScreen} />
            <Stack.Screen name="TechnicianShifts" component={TechnicianShiftsScreen} />
            <Stack.Screen name="AdminTechnicianLeaves" component={AdminTechnicianLeavesScreen} />
            <Stack.Screen name="AdminCustomers" component={CustomerListScreen} />
            <Stack.Screen name="AdminCustomerDetail" component={CustomerDetailScreen} />
            <Stack.Screen name="AdminCustomerForm" component={CustomerFormScreen} />
            <Stack.Screen name="AdminProducts" component={ProductListScreen} />
            <Stack.Screen name="AdminProductForm" component={ProductFormScreen} />
        </Stack.Navigator>
    );
}
