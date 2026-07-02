import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AdminPanelScreen from '@/screens/admin/AdminPanelScreen';
import AdminSectionScreen from '@/screens/admin/AdminSectionScreen';
import AdminUsersScreen from '@/screens/admin/AdminUsersScreen';
import ApprovalPendingUsersScreen from '@/screens/admin/ApprovalPendingUsersScreen';
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
import CompanySettingsScreen from '@/screens/settings/CompanySettingsScreen';
import ReportsScreen from '@/screens/reports/ReportsScreen';
import TechnicianPerformanceDetailScreen from '@/screens/reports/TechnicianPerformanceDetailScreen';
import ServiceDetailScreen from '@/screens/services/ServiceDetailScreen';
import HRDashboardScreen from '@/screens/hr/HRDashboardScreen';
import PayrollCreateScreen from '@/screens/hr/PayrollCreateScreen';
import PayrollDetailScreen from '@/screens/hr/PayrollDetailScreen';
import PayrollTemplatesScreen from '@/screens/hr/PayrollTemplatesScreen';

const Stack = createNativeStackNavigator();

const AdminPanelNavigator = () => {
    return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="AdminPanelHome" component={AdminPanelScreen} />
            <Stack.Screen name="AdminUsers" component={AdminUsersScreen} />
            <Stack.Screen name="AdminPendingUsers" component={ApprovalPendingUsersScreen} />
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
            <Stack.Screen
                name="AdminPayroll"
                component={HRDashboardScreen}
                options={{ animation: 'slide_from_right' }}
            />
            <Stack.Screen
                name="PayrollCreate"
                component={PayrollCreateScreen}
                options={{ animation: 'slide_from_right' }}
            />
            <Stack.Screen
                name="PayrollDetail"
                component={PayrollDetailScreen}
                options={{ animation: 'slide_from_right' }}
            />
            <Stack.Screen
                name="PayrollTemplates"
                component={PayrollTemplatesScreen}
                options={{ animation: 'slide_from_right' }}
            />
            <Stack.Screen name="AdminAccounting" component={AdminSectionScreen} />
            <Stack.Screen name="AdminServices" component={AdminSectionScreen} />
            <Stack.Screen name="AdminNotifications" component={AdminSectionScreen} />
            <Stack.Screen
                name="AdminReports"
                component={ReportsScreen}
                options={{ animation: 'slide_from_right' }}
            />
            <Stack.Screen
                name="TechnicianPerformanceDetail"
                component={TechnicianPerformanceDetailScreen}
                options={{ animation: 'slide_from_right' }}
            />
            <Stack.Screen
                name="ServiceDetail"
                component={ServiceDetailScreen}
                options={{ animation: 'slide_from_right' }}
            />
            <Stack.Screen name="AdminCompanySettings" component={CompanySettingsScreen} options={{ animation: 'slide_from_right' }} />
        </Stack.Navigator>
    );
};

export default AdminPanelNavigator;
