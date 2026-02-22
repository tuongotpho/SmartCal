import React from 'react';
import AiAssistant from './AiAssistant';
import SettingsModal from './SettingsModal';
import EditTaskModal from './EditTaskModal';
import ConfirmModal from './ConfirmModal';
import ConflictWarningModal from './ConflictWarningModal';
import ReminderModal from './ReminderModal';
import OnboardingModal from './OnboardingModal';
import { Task, TelegramConfig, Tag, AppTheme } from '../types';

interface ModalsContainerProps {
    // AiAssistant
    tasks: Task[];
    isAIOpen: boolean;
    setIsAIOpen: (val: boolean) => void;

    // SettingsModal
    isSettingsOpen: boolean;
    setIsSettingsOpen: (val: boolean) => void;
    telegramConfig: TelegramConfig;
    tags: Tag[];
    onSaveConfig: (cfg: TelegramConfig) => void;
    onSaveTags: (tags: Tag[]) => void;
    handleManualSync: () => void;
    isSyncing: boolean;
    lastSyncTime: string;
    showToast: (msg: string, type: any) => void;
    currentTheme: string;
    setCurrentTheme: (theme: string) => void;
    themes: AppTheme[];
    fcmConfig: any;
    setFcmConfig: (cfg: any) => void;
    userId?: string;
    reminderMinutesBefore: number;
    setReminderMinutesBefore: (mins: number) => void;

    // EditTaskModal
    isEditModalOpen: boolean;
    setIsEditModalOpen: (val: boolean) => void;
    editingTask: Task | null;
    handleRequestAddTask: (t: Task) => Promise<void>;
    handleUpdateTask: (t: Task) => Promise<void>;

    // ConfirmModal
    isDeleteModalOpen: boolean;
    setIsDeleteModalOpen: (val: boolean) => void;
    executeDeleteTask: (id: string) => Promise<void>;
    taskToDeleteId: string | null;

    // ConflictWarningModal
    isConflictModalOpen: boolean;
    setIsConflictModalOpen: (val: boolean) => void;
    saveTaskToDatabase: (t: Task) => Promise<void>;
    proposedTask: Task | null;
    setProposedTask: (t: Task | null) => void;
    pendingConflicts: string[];

    // ReminderModal
    isReminderModalOpen: boolean;
    reminderTask: Task | null;
    handleReminderClose: () => void;
    handleReminderSnooze: (mins: number) => void;
    handleReminderComplete: () => Promise<void>;

    // OnboardingModal
    showOnboarding: boolean;
    user: any;
    closeOnboarding: () => void;
}

const ModalsContainer: React.FC<ModalsContainerProps> = (props) => {
    return (
        <>
            <AiAssistant tasks={props.tasks} externalOpen={props.isAIOpen} onClose={() => props.setIsAIOpen(false)} />

            <SettingsModal
                isOpen={props.isSettingsOpen}
                onClose={() => props.setIsSettingsOpen(false)}
                telegramConfig={props.telegramConfig}
                tags={props.tags}
                onSaveConfig={props.onSaveConfig}
                onSaveTags={props.onSaveTags}
                onManualSync={props.handleManualSync}
                isSyncing={props.isSyncing}
                lastSyncTime={props.lastSyncTime}
                showToast={props.showToast}
                currentTheme={props.currentTheme}
                setCurrentTheme={props.setCurrentTheme}
                themes={props.themes}
                fcmConfig={props.fcmConfig}
                onFCMChange={props.setFcmConfig}
                userId={props.userId}
                reminderMinutesBefore={props.reminderMinutesBefore}
                onReminderMinutesChange={props.setReminderMinutesBefore}
            />

            <EditTaskModal
                isOpen={props.isEditModalOpen}
                onClose={() => props.setIsEditModalOpen(false)}
                task={props.editingTask}
                tags={props.tags}
                onSave={async (t) => {
                    if (t.id === 'temp') await props.handleRequestAddTask(t);
                    else await props.handleUpdateTask(t);
                    props.setIsEditModalOpen(false);
                }}
                showToast={props.showToast}
            />

            <ConfirmModal
                isOpen={props.isDeleteModalOpen}
                onClose={() => props.setIsDeleteModalOpen(false)}
                onConfirm={() => props.executeDeleteTask(props.taskToDeleteId || '')}
                title="Xác nhận"
                message="Bạn có chắc muốn xóa không?"
            />

            <ConflictWarningModal
                isOpen={props.isConflictModalOpen}
                onClose={() => props.setIsConflictModalOpen(false)}
                onConfirm={() => {
                    if (props.proposedTask) {
                        props.saveTaskToDatabase(props.proposedTask);
                        props.setProposedTask(null);
                    }
                }}
                conflicts={props.pendingConflicts}
                taskTitle={props.proposedTask?.title || ""}
            />

            <ReminderModal
                isOpen={props.isReminderModalOpen}
                task={props.reminderTask}
                tags={props.tags}
                onClose={props.handleReminderClose}
                onSnooze={props.handleReminderSnooze}
                onMarkComplete={props.handleReminderComplete}
            />

            <OnboardingModal
                isOpen={props.showOnboarding && !!props.user}
                onClose={props.closeOnboarding}
                onOpenSettings={() => { props.closeOnboarding(); props.setIsSettingsOpen(true); }}
            />
        </>
    );
};

export default ModalsContainer;
