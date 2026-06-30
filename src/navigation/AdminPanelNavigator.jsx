import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AdminPanelScreen from '@/screens/admin/AdminPanelScreen';
import AdminSectionScreen from '@/screens/admin/AdminSectionScreen';

const Stack = createNativeStackNavigator();

const AdminPanelNavigator = () => {
    return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="AdminPanelHome" component={AdminPanelScreen} />
            <Stack.Screen name="AdminUsers" component={AdminSectionScreen} />
            <Stack.Screen name="AdminPendingUsers" component={AdminSectionScreen} />
            <Stack.Screen name="AdminRejectedUsers" component={AdminSectionScreen} />
            <Stack.Screen name="AdminTechnicians" component={AdminSectionScreen} />
            <Stack.Screen name="AdminTechnicianLocations" component={AdminSectionScreen} />
            <Stack.Screen name="AdminTechnicianShifts" component={AdminSectionScreen} />
            <Stack.Screen name="AdminTechnicianLeaves" component={AdminSectionScreen} />
            <Stack.Screen name="AdminCustomers" component={AdminSectionScreen} />
            <Stack.Screen name="AdminInventory" component={AdminSectionScreen} />
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