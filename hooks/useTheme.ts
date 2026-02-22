import { useState, useEffect, useCallback } from 'react';
import { AppTheme } from '../types';

export function useTheme(appThemes: AppTheme[]) {
    const [isDarkMode, setIsDarkMode] = useState<boolean>(() => localStorage.getItem('theme') === 'dark');
    const [currentTheme, setCurrentTheme] = useState<string>(() => localStorage.getItem('app_theme') || 'orange');

    useEffect(() => {
        const themeObj = appThemes.find((t) => t.name === currentTheme) || appThemes[0];
        const root = document.documentElement;
        Object.entries(themeObj.colors).forEach(([shade, rgb]) => {
            root.style.setProperty(`--color-primary-${shade}`, rgb);
        });
        localStorage.setItem('app_theme', currentTheme);
    }, [currentTheme, appThemes]);

    useEffect(() => {
        const root = window.document.documentElement;
        if (isDarkMode) root.classList.add('dark');
        else root.classList.remove('dark');
        localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
    }, [isDarkMode]);

    const toggleTheme = useCallback(() => {
        setIsDarkMode((prev) => !prev);
    }, []);

    return {
        isDarkMode,
        toggleTheme,
        currentTheme,
        setCurrentTheme,
    };
}
