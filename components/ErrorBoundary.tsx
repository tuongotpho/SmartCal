import React, { ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

/**
 * ErrorBoundary component to catch rendering errors and show a fallback UI.
 */
class ErrorBoundary extends React.Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-orange-50 dark:bg-gray-950 p-6">
          <div className="max-w-md w-full bg-white dark:bg-gray-900 p-8 rounded-2xl shadow-xl text-center border border-red-100 dark:border-red-900/30">
            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertTriangle size={32} />
            </div>
            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-2">Đã có lỗi xảy ra!</h2>
            <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">
              Ứng dụng gặp sự cố không mong muốn. Vui lòng thử tải lại trang hoặc liên hệ hỗ trợ nếu lỗi vẫn tiếp diễn.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="w-full flex items-center justify-center gap-2 bg-orange-600 hover:bg-orange-700 text-white font-bold py-3 rounded-xl transition shadow-md"
            >
              <RefreshCw size={18} /> Tải lại ứng dụng
            </button>
          </div>
        </div>
      );
    }

    // Accessing children through the inherited this.props
    return this.props.children;
  }
}

export default ErrorBoundary;