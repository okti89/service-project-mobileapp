import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import NetInfo from '@react-native-community/netinfo';

const NetworkContext = createContext();

export const NetworkProvider = ({ children }) => {
    const [isConnected, setIsConnected] = useState(true);
    const [isInternetReachable, setIsInternetReachable] = useState(true);
    const [type, setType] = useState(null);
    const lastLogSignatureRef = useRef('');

    useEffect(() => {
        // Subscribe to network state changes
        const unsubscribe = NetInfo.addEventListener(state => {
            setIsConnected(state.isConnected);
            setIsInternetReachable(state.isInternetReachable);
            setType(state.type);

            if (__DEV__) {
                const signature = `${state.isConnected}-${state.isInternetReachable}-${state.type}`;
                if (signature !== lastLogSignatureRef.current) {
                    lastLogSignatureRef.current = signature;
                    console.log('Network State Changed:', {
                        isConnected: state.isConnected,
                        isInternetReachable: state.isInternetReachable,
                        type: state.type
                    });
                }
            }
        });

        // Cleanup subscription on unmount
        return () => unsubscribe();
    }, []);

    return (
        <NetworkContext.Provider value={{ isConnected, isInternetReachable, type }}>
            {children}
        </NetworkContext.Provider>
    );
};

export const useNetwork = () => {
    const context = useContext(NetworkContext);
    if (context === undefined) {
        throw new Error('useNetwork must be used within a NetworkProvider');
    }
    return context;
};
