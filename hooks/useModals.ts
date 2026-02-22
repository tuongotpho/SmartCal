import { useState, useCallback } from 'react';
import { Task } from '../types';

export function useModals() {
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingTask, setEditingTask] = useState<Task | null>(null);

    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [taskToDeleteId, setTaskToDeleteId] = useState<string | null>(null);

    const [showOnboarding, setShowOnboarding] = useState(() => {
        return localStorage.getItem('hasSeenOnboarding') !== 'true';
    });

    const [isAIOpen, setIsAIOpen] = useState(false);

    const closeOnboarding = useCallback(() => {
        setShowOnboarding(false);
        localStorage.setItem('hasSeenOnboarding', 'true');
    }, []);

    return {
        isSettingsOpen, setIsSettingsOpen,
        isEditModalOpen, setIsEditModalOpen,
        editingTask, setEditingTask,
        isDeleteModalOpen, setIsDeleteModalOpen,
        taskToDeleteId, setTaskToDeleteId,
        showOnboarding, closeOnboarding,
        isAIOpen, setIsAIOpen
    };
}
