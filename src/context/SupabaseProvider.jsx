'use client';
import { useEffect, useState, createContext, useContext } from 'react';
import { initSupabase } from '../lib/supabase';

const SupabaseContext = createContext({ ready: false });
export const useSupabase = () => useContext(SupabaseContext);

export default function SupabaseProvider({ children }) {
    const [ready, setReady] = useState(false);

    useEffect(() => {
        initSupabase().then((connected) => {
            if (!connected) {
                console.error('[App] Supabase connection failed — check credentials and network.');
            }
            setReady(true);
        });
    }, []);

    if (!ready) {
        return (
            <SupabaseContext.Provider value={{ ready: false }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100dvh' }}>
                    <div className="spinner" />
                </div>
            </SupabaseContext.Provider>
        );
    }

    return (
        <SupabaseContext.Provider value={{ ready: true }}>
            {children}
        </SupabaseContext.Provider>
    );
}
