import React, { useState, useEffect } from 'react';
import { Sparkles, Bot, Settings, ArrowRight, CheckCircle2, ChevronRight, ChevronLeft } from 'lucide-react';
import { isTauri } from '../services/firebase';

interface OnboardingModalProps {
    isOpen: boolean;
    onClose: () => void;
    onOpenSettings: () => void;
}

const OnboardingModal: React.FC<OnboardingModalProps> = ({ isOpen, onClose, onOpenSettings }) => {
    const [currentStep, setCurrentStep] = useState(0);

    // Prevent scrolling on body when modal is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'auto';
        }
        return () => {
            document.body.style.overflow = 'auto';
        };
    }, [isOpen]);

    if (!isOpen) return null;

    const handleNext = () => {
        if (currentStep < 3) setCurrentStep(prev => prev + 1);
    };

    const handlePrev = () => {
        if (currentStep > 0) setCurrentStep(prev => prev - 1);
    };

    const steps = [
        {
            id: 0,
            title: "Chào mừng đến với SmartCal Pro! 🎉",
            description: "Trợ lý ảo cá nhân giúp bạn quản lý thời gian và rảnh tay với mọi công việc.",
            content: (
                <div className="flex flex-col items-center justify-center space-y-4 py-4">
                    <div className="w-24 h-24 bg-orange-100 dark:bg-orange-900/30 rounded-2xl flex items-center justify-center rotate-3 shadow-inner">
                        <span className="text-5xl">📅</span>
                    </div>
                    <p className="text-center text-sm text-gray-600 dark:text-gray-300 leading-relaxed px-4">
                        Ứng dụng lịch thông minh đầu tiên tích hợp AI đa nền tảng. Dù bạn dùng Web hay Desktop, dữ liệu luôn được đồng bộ mượt mà.
                    </p>
                </div>
            )
        },
        {
            id: 1,
            title: "Các Tính Năng Ăn Tiền ✨",
            description: "SmartCal giúp bạn làm được những gì?",
            content: (
                <div className="space-y-4 py-2">
                    <div className="flex gap-3 bg-blue-50 dark:bg-blue-900/20 p-3 rounded-xl border border-blue-100 dark:border-blue-800">
                        <Sparkles className="text-blue-500 shrink-0 mt-0.5" size={20} />
                        <div>
                            <h4 className="font-bold text-sm text-gray-800 dark:text-gray-100">Lên lịch thần tốc bằng AI</h4>
                            <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                                Chỉ cần gõ "Chiều mai đi cafe ở Phê La", AI sẽ phân tích ngày/giờ chuẩn xác. Tích hợp sẵn Chatbot AI giải đáp mọi thắc mắc ngay trong app.
                            </p>
                        </div>
                    </div>

                    <div className="flex gap-3 bg-green-50 dark:bg-green-900/20 p-3 rounded-xl border border-green-100 dark:border-green-800">
                        <CheckCircle2 className="text-green-500 shrink-0 mt-0.5" size={20} />
                        <div>
                            <h4 className="font-bold text-sm text-gray-800 dark:text-gray-100">Đồng bộ 100% Google Calendar</h4>
                            <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                                Đồng bộ dữ liệu mượt mà lên tài khoản Google Calendar của bạn.
                            </p>
                        </div>
                    </div>

                    <div className="flex gap-3 bg-orange-50 dark:bg-orange-900/20 p-3 rounded-xl border border-orange-100 dark:border-orange-800">
                        <Bot className="text-orange-500 shrink-0 mt-0.5" size={20} />
                        <div>
                            <h4 className="font-bold text-sm text-gray-800 dark:text-gray-100">Cảnh báo trùng lặp & Offline</h4>
                            <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                                Tự động phản ứng và cảnh báo khi bạn lên 2 việc cùng khung giờ. Vẫn hoạt động trơn tru chỉnh sửa khi rớt mạng.
                            </p>
                        </div>
                    </div>
                </div>
            )
        },
        {
            id: 2,
            title: "Trạm Quản lý Năng suất 🚀",
            description: "Các công cụ chuyên sâu giúp bạn tập trung công việc tối đa:",
            content: (
                <div className="space-y-4 py-2">
                    <div className="flex gap-3 bg-purple-50 dark:bg-purple-900/20 p-3 rounded-xl border border-purple-100 dark:border-purple-800">
                        <Sparkles className="text-purple-500 shrink-0 mt-0.5" size={20} />
                        <div>
                            <h4 className="font-bold text-sm text-gray-800 dark:text-gray-100">Kanban, Focus & Thống kê</h4>
                            <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                                Chuyển đổi góc nhìn thành bảng Kanban, làm việc với Đồng hồ Pomodoro (Focus) và xem biểu đồ Thống kê tiến độ trực quan.
                            </p>
                        </div>
                    </div>

                    <div className="flex gap-3 bg-indigo-50 dark:bg-indigo-900/20 p-3 rounded-xl border border-indigo-100 dark:border-indigo-800">
                        <CheckCircle2 className="text-indigo-500 shrink-0 mt-0.5" size={20} />
                        <div>
                            <h4 className="font-bold text-sm text-gray-800 dark:text-gray-100">Quản lý Thẻ & Nhắc việc chủ động</h4>
                            <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                                Phân loại bằng Tag màu sắc. Tự do cài đặt thời gian báo thức nhắc nhở trước linh hoạt (5 phút, 30 phút, 1 tiếng...).
                            </p>
                        </div>
                    </div>

                    <div className="flex gap-3 bg-rose-50 dark:bg-rose-900/20 p-3 rounded-xl border border-rose-100 dark:border-rose-800">
                        <Bot className="text-rose-500 shrink-0 mt-0.5" size={20} />
                        <div>
                            <h4 className="font-bold text-sm text-gray-800 dark:text-gray-100">AI Báo cáo & Nhắc Telegram</h4>
                            <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                                AI tổng hợp năng suất Tuần/Tháng siêu nhanh. Nhắc việc qua Telegram tự động mỗi ngày đánh bại sự lười biếng.
                            </p>
                        </div>
                    </div>
                </div>
            )
        },
        {
            id: 3,
            title: "Mở khóa Tối đa Sức mạnh ⚙️",
            description: "Để SmartCal thực sự phục vụ bạn hiệu quả, hãy làm 2 điều này trong phần Cài đặt:",
            content: (
                <div className="space-y-4 py-4">
                    <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-orange-100 text-orange-600 dark:bg-orange-900/50 dark:text-orange-400 font-bold text-xs">1</span>
                            <h4 className="font-bold text-sm text-gray-800 dark:text-gray-100">Nhập API Key Gemini (Miễn phí)</h4>
                        </div>
                        <p className="text-xs text-gray-600 dark:text-gray-400 pl-8">
                            Để trợ lý ảo hiểu và lên lịch tự động cho bạn, hãy add Key Gemini. Trải nghiệm sẽ nhanh gấp 10 lần việc tự tick form!
                        </p>
                    </div>

                    <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400 font-bold text-xs">2</span>
                            <h4 className="font-bold text-sm text-gray-800 dark:text-gray-100">Cấu hình Telegram Bot</h4>
                        </div>
                        <p className="text-xs text-gray-600 dark:text-gray-400 pl-8">
                            Nhập mã Chat ID để nhận nhắc nhở công việc 6h sáng hàng ngày mà không lỡ lịch.
                        </p>
                    </div>

                    <button
                        onClick={() => {
                            onClose();
                            onOpenSettings();
                        }}
                        className="w-full flex items-center justify-center gap-2 py-2 mt-2 text-sm text-orange-600 hover:bg-orange-50 dark:hover:bg-gray-800 transition rounded-lg font-medium border border-orange-200 dark:border-gray-700"
                    >
                        <Settings size={16} /> Mở Cài đặt ngay
                    </button>
                </div>
            )
        }
    ];

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-300">
            <div className="bg-white dark:bg-gray-900 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden flex flex-col h-auto max-h-[90vh]">

                {/* Header Progress bar */}
                <div className="flex gap-1 p-4 pb-0">
                    {steps.map((s, idx) => (
                        <div
                            key={s.id}
                            className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${idx <= currentStep ? 'bg-orange-500' : 'bg-gray-200 dark:bg-gray-700'}`}
                        />
                    ))}
                </div>

                {/* Content Slider */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                    <div
                        className="transition-transform duration-300 ease-in-out"
                    >
                        <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-2 leading-tight">
                            {steps[currentStep].title}
                        </h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                            {steps[currentStep].description}
                        </p>
                        <div className="animate-in slide-in-from-right-4 fade-in duration-300" key={currentStep}>
                            {steps[currentStep].content}
                        </div>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="p-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50 flex justify-between items-center">
                    <button
                        onClick={currentStep === 0 ? onClose : handlePrev}
                        className={`px-4 py-2 text-sm font-medium rounded-xl transition ${currentStep === 0 ? 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200' : 'text-gray-600 hover:bg-gray-200 dark:text-gray-300 dark:hover:bg-gray-800'}`}
                    >
                        {currentStep === 0 ? 'Bỏ qua' : 'Quay lại'}
                    </button>

                    <button
                        onClick={currentStep === steps.length - 1 ? onClose : handleNext}
                        className="flex items-center gap-2 px-6 py-2.5 bg-orange-600 hover:bg-orange-700 text-white text-sm font-bold rounded-xl transition-all shadow-md active:scale-95"
                    >
                        {currentStep === steps.length - 1 ? 'Khám Phá! 🚀' : (
                            <>
                                Tiếp tục <ArrowRight size={16} />
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default OnboardingModal;
