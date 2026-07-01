import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AdminPanelScreen from '@/screens/admin/AdminPanelScreen';
import AdminSectionScreen from '@/screens/admin/AdminSectionScreen';
import AdminTechnicianListScreen from '@/screens/technician/AdminTechnicianListScreen';
import TechnicianShiftsScreen from '@/screens/technician/TechnicianShiftsScreen';
import TechnicianPerformanceScreen from '@/screens/technician/TechnicianPerformanceScreen';
import TechnicianLocationsScreen from '@/screens/technician/TechnicianLocationsScreen';
import MapUsageTestScreen from '@/screens/technician/MapUsageTestScreen';
import CustomerListScreen from '@/screens/customers/CustomerListScreen';
import CustomerFormScreen from '@/screens/customers/CustomerFormScreen';
import CustomerDetailScreen from '@/screens/customers/CustomerDetailScreen';
import LocationMapScreen from '@/screens/common/LocationMapScreen';
import ProductListScreen from '@/screens/products/ProductListScreen';
import ProductFormScreen from '@/screens/products/ProductFormScreen';
import ProductDetailScreen from '@/screens/products/ProductDetailScreen';
import InventoryMovementsScreen from '@/screens/products/InventoryMovementsScreen';

const Stack = createNativeStackNavigator();

const AdminPanelNavigator = () => {
    return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="AdminPanelHome" component={AdminPanelScreen} />
            <Stack.Screen name="AdminUsers" component={AdminSectionScreen} />
            <Stack.Screen name="AdminPendingUsers" component={AdminSectionScreen} />
            <Stack.Screen name="AdminRejectedUsers" component={AdminSectionScreen} />
            <Stack.Screen name="AdminTechnicians" component={AdminTechnicianListScreen} />
            <Stack.Screen
                name="AdminTechnicianShifts"
                component={TechnicianShiftsScreen}
                options={{ animation: 'slide_from_right' }}
            />
            <Stack.Screen
                name="AdminTechnicianPerformance"
                component={TechnicianPerformanceScreen}
                options={{ animation: 'slide_from_right' }}
            />
            <Stack.Screen
                name="AdminTechnicianLocations"
                component={TechnicianLocationsScreen}
                options={{ animation: 'slide_from_right' }}
            />
            <Stack.Screen
                name="AdminMapUsageTest"
                component={MapUsageTestScreen}
                options={{ animation: 'slide_from_right' }}
            />
            <Stack.Screen name="AdminTechnicianLeaves" component={AdminSectionScreen} />
            <Stack.Screen
                name="AdminCustomers"
                component={CustomerListScreen}
                options={{ animation: 'slide_from_right' }}
            />
            <Stack.Screen
                name="AdminCustomerForm"
                component={CustomerFormScreen}
                options={{ animation: 'slide_from_right' }}
            />
            <Stack.Screen
                name="AdminCustomerDetail"
                component={CustomerDetailScreen}
                options={{ animation: 'slide_from_right' }}
            />
            <Stack.Screen
                name="LocationMap"
                component={LocationMapScreen}
                options={{ animation: 'slide_from_right' }}
            />
            <Stack.Screen
                name="AdminInventory"
                component={ProductListScreen}
                options={{ animation: 'slide_from_right' }}
            />
            <Stack.Screen
                name="AdminProductForm"
                component={ProductFormScreen}
                options={{ animation: 'slide_from_right' }}
            />
            <Stack.Screen
                name="AdminProductDetail"
                component={ProductDetailScreen}
                options={{ animation: 'slide_from_right' }}
            />
            <Stack.Screen
                name="AdminInventoryMovements"
                component={InventoryMovementsScreen}
                options={{ animation: 'slide_from_right' }}
            />
            <Stack.Screen name="AdminPayroll" component={AdminSectionScreen} />
            <Stack.Screen name="AdminAccounting" component={AdminSectionScreen} />
            <Stack.Screen name="AdminServices" component={AdminSectionScreen} />
            <Stack.Screen name="AdminNotifications" component={AdminSectionScreen} />
            <Stack.Screen name="AdminReports" component={AdminSectionScreen} />
            <Stack.Screen name="AdminCompanySettings" component={AdminSectionScreen} />
        </Stack.Navigator>
    );
};

export default AdminPanelNavigator;