import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';

import RouteMapModal from '@/components/common/RouteMapModal';

export default function LocationMapScreen({ navigation, route }) {
    const address = route?.params?.address || '';
    const customerName = route?.params?.title || route?.params?.customerName || '';

    useEffect(() => {
        if (!address) navigation.goBack();
    }, [address, navigation]);

    return (
        <View style={styles.screen}>
            <RouteMapModal
                visible={Boolean(address)}
                onClose={() => navigation.goBack()}
                address={address}
                customerName={customerName}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: 'transparent' },
});