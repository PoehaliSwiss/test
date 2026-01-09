import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ExamProvider, useExam } from '../../context/ExamContext';
import { saveExamAttempt, getExamAttempts, formatDuration, formatTimestamp, type ExamAttempt } from '../../utils/examStorage';
import { useLocation } from 'react-router-dom';
import { Clock, Play, RotateCcw, CheckCircle, AlertCircle, History, Trophy } from 'lucide-react';
import { clsx } from 'clsx';
import { useProgress } from '../../context/ProgressContext';

interface ExamProps {
    timeLimit: number; // in seconds
    title?: string;
    showExerciseResults?: boolean; // Show correct/incorrect on exercises after exam ends (default true)
    children: React.ReactNode;
}

// Generate a stable exam ID based on path and title
function useExamId(title?: string): string {
    const location = useLocation();
    return useMemo(() => {
        const path = location.pathname;
        const titleSlug = title?.toLowerCase().replace(/\s+/g, '-') || 'exam';
        return `${path}:${titleSlug}`;
    }, [location.pathname, title]);
}

// Timer display component
function ExamTimer() {
    const exam = useExam();
    if (!exam || !exam.isExamActive) return null;

    const { remainingTime, totalTime, isTimeUp, isPaused, completedExercises, totalExercises } = exam;
    const progress = totalTime > 0 ? ((totalTime - remainingTime) / totalTime) * 100 : 0;
    const timeWarning = remainingTime <= 60; // Last minute warning
    const timeCritical = remainingTime <= 30; // Last 30 seconds

    return (
        <div
            className={clsx(
                "fixed top-4 right-4 z-50 bg-white dark:bg-gray-800 rounded-xl shadow-xl border p-4 min-w-[200px]",
                isTimeUp ? "border-red-500" : timeWarning ? "border-yellow-500" : "border-gray-200 dark:border-gray-700"
            )}
        >
            {/* Timer */}
            <div className="flex items-center gap-3 mb-3">
                <div className={clsx(
                    "p-2 rounded-lg",
                    isTimeUp ? "bg-red-100 dark:bg-red-900/30" :
                        timeCritical ? "bg-red-100 dark:bg-red-900/30 animate-pulse" :
                            timeWarning ? "bg-yellow-100 dark:bg-yellow-900/30" :
                                "bg-blue-100 dark:bg-blue-900/30"
                )}>
                    <Clock className={clsx(
                        "w-5 h-5",
                        isTimeUp ? "text-red-600 dark:text-red-400" :
                            timeCritical ? "text-red-600 dark:text-red-400" :
                                timeWarning ? "text-yellow-600 dark:text-yellow-400" :
                                    "text-blue-600 dark:text-blue-400"
                    )} />
                </div>
                <div>
                    <div className={clsx(
                        "text-2xl font-bold tabular-nums",
                        isTimeUp ? "text-red-600 dark:text-red-400" :
                            timeCritical ? "text-red-600 dark:text-red-400" :
                                timeWarning ? "text-yellow-600 dark:text-yellow-400" :
                                    "text-gray-900 dark:text-white"
                    )}>
                        {formatDuration(remainingTime)}
                    </div>
                    {isPaused && (
                        <div className="text-xs text-gray-500">Paused</div>
                    )}
                </div>
            </div>

            {/* Progress bar */}
            <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden mb-3">
                <div
                    className={clsx(
                        "h-full transition-all duration-1000 ease-linear",
                        isTimeUp ? "bg-red-500" :
                            timeCritical ? "bg-red-500" :
                                timeWarning ? "bg-yellow-500" :
                                    "bg-blue-500"
                    )}
                    style={{ width: `${100 - progress}%` }}
                />
            </div>

            {/* Exercise progress */}
            <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Completed:</span>
                <span className="font-medium text-gray-900 dark:text-white">
                    {completedExercises} / {totalExercises}
                </span>
            </div>
        </div>
    );
}

// Results modal component
interface ExamResultsModalProps {
    isOpen: boolean;
    examId: string;
    currentAttempt: {
        total: number;
        completed: number;
        correct: number;
        timedOut: boolean;
        duration: number;
    };
    onContinue: () => void;
    onRestart: () => void;
    onClose: () => void;
}

function ExamResultsModal({ isOpen, examId, currentAttempt, onContinue, onRestart, onClose }: ExamResultsModalProps) {
    const [showHistory, setShowHistory] = useState(false);
    const attempts = getExamAttempts(examId);

    if (!isOpen) return null;

    const { total, completed, correct, timedOut, duration } = currentAttempt;
    const percentage = total > 0 ? Math.round((correct / total) * 100) : 0;
    const allCompleted = completed === total;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
                {/* Header */}
                <div className={clsx(
                    "px-6 py-8 text-center",
                    percentage >= 80 ? "bg-gradient-to-br from-green-500 to-emerald-600" :
                        percentage >= 50 ? "bg-gradient-to-br from-yellow-500 to-orange-500" :
                            "bg-gradient-to-br from-red-500 to-rose-600"
                )}>
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-white/20 rounded-full mb-4">
                        {timedOut ? (
                            <AlertCircle className="w-8 h-8 text-white" />
                        ) : percentage >= 80 ? (
                            <Trophy className="w-8 h-8 text-white" />
                        ) : (
                            <CheckCircle className="w-8 h-8 text-white" />
                        )}
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-1">
                        {timedOut ? 'Time\'s Up!' : allCompleted ? 'Exam Complete!' : 'Results'}
                    </h2>
                    <p className="text-white/80">
                        {formatDuration(duration)} spent
                    </p>
                </div>

                {/* Stats */}
                <div className="p-6">
                    <div className="grid grid-cols-3 gap-4 mb-6">
                        <div className="text-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                            <div className="text-2xl font-bold text-gray-900 dark:text-white">{completed}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">of {total}</div>
                            <div className="text-sm text-gray-600 dark:text-gray-300 mt-1">Completed</div>
                        </div>
                        <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-xl">
                            <div className="text-2xl font-bold text-green-600 dark:text-green-400">{correct}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">correct</div>
                            <div className="text-sm text-gray-600 dark:text-gray-300 mt-1">Correct</div>
                        </div>
                        <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{percentage}%</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">score</div>
                            <div className="text-sm text-gray-600 dark:text-gray-300 mt-1">Score</div>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="space-y-3">
                        {!allCompleted && (
                            <button
                                onClick={onContinue}
                                className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium flex items-center justify-center gap-2 transition-colors"
                            >
                                <Play className="w-4 h-4" />
                                Continue Exercises
                            </button>
                        )}
                        <button
                            onClick={onRestart}
                            className="w-full py-3 px-4 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-xl font-medium flex items-center justify-center gap-2 transition-colors"
                        >
                            <RotateCcw className="w-4 h-4" />
                            Start Over
                        </button>
                        <button
                            onClick={onClose}
                            className="w-full py-2 px-4 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white text-sm transition-colors"
                        >
                            Close
                        </button>
                    </div>

                    {/* History toggle */}
                    {attempts.length > 1 && (
                        <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                            <button
                                onClick={() => setShowHistory(!showHistory)}
                                className="w-full flex items-center justify-between text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                            >
                                <span className="flex items-center gap-2">
                                    <History className="w-4 h-4" />
                                    Attempt History ({attempts.length - 1} previous)
                                </span>
                                <span>{showHistory ? '▲' : '▼'}</span>
                            </button>

                            {showHistory && (
                                <div className="mt-4 space-y-2 max-h-48 overflow-y-auto">
                                    {attempts.slice(1).map((attempt, index) => (
                                        <div
                                            key={attempt.id}
                                            className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg text-sm"
                                        >
                                            <div>
                                                <div className="font-medium text-gray-900 dark:text-white">
                                                    Attempt {attempts.length - index - 1}
                                                </div>
                                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                                    {formatTimestamp(attempt.timestamp)}
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className={clsx(
                                                    "font-bold",
                                                    attempt.percentage >= 80 ? "text-green-600 dark:text-green-400" :
                                                        attempt.percentage >= 50 ? "text-yellow-600 dark:text-yellow-400" :
                                                            "text-red-600 dark:text-red-400"
                                                )}>
                                                    {attempt.percentage}%
                                                </div>
                                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                                    {attempt.correctExercises}/{attempt.totalExercises}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// Start screen component
interface ExamStartScreenProps {
    title?: string;
    timeLimit: number;
    previousAttempts: ExamAttempt[];
    onStart: () => void;
}

function ExamStartScreen({ title, timeLimit, previousAttempts, onStart }: ExamStartScreenProps) {
    const bestAttempt = previousAttempts.length > 0
        ? previousAttempts.reduce((best, curr) => curr.percentage > best.percentage ? curr : best)
        : null;

    return (
        <div className="bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-800 dark:to-gray-900 rounded-2xl p-8 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full mb-6">
                <Clock className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            </div>

            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                {title || 'Exam'}
            </h2>

            <p className="text-gray-600 dark:text-gray-400 mb-6">
                You have <span className="font-semibold text-blue-600 dark:text-blue-400">{formatDuration(timeLimit)}</span> to complete the exercises
            </p>

            {bestAttempt && (
                <div className="mb-6 p-4 bg-white dark:bg-gray-700 rounded-xl">
                    <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Best Result</div>
                    <div className="flex items-center justify-center gap-4">
                        <div className={clsx(
                            "text-3xl font-bold",
                            bestAttempt.percentage >= 80 ? "text-green-600 dark:text-green-400" :
                                bestAttempt.percentage >= 50 ? "text-yellow-600 dark:text-yellow-400" :
                                    "text-red-600 dark:text-red-400"
                        )}>
                            {bestAttempt.percentage}%
                        </div>
                        <div className="text-left text-sm text-gray-600 dark:text-gray-400">
                            <div>{bestAttempt.correctExercises} of {bestAttempt.totalExercises} correct</div>
                            <div>in {formatDuration(bestAttempt.duration)}</div>
                        </div>
                    </div>
                </div>
            )}

            <button
                onClick={onStart}
                className="px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium text-lg flex items-center justify-center gap-3 mx-auto transition-colors"
            >
                <Play className="w-5 h-5" />
                Start Exam
            </button>

            {previousAttempts.length > 0 && (
                <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
                    Attempts: {previousAttempts.length}
                </p>
            )}
        </div>
    );
}

// Main Exam wrapper content
function ExamContent({ title, children, onCloseResults }: { title?: string; children: React.ReactNode; onCloseResults: () => void }) {
    const exam = useExam();
    const [showConfirm, setShowConfirm] = useState(false);

    if (!exam) return null;

    const { isExamActive, isTimeUp, totalExercises, completedExercises, finishExam } = exam;

    const handleFinishClick = () => {
        const incomplete = totalExercises - completedExercises;
        if (incomplete > 0) {
            setShowConfirm(true);
        } else {
            finishExam();
        }
    };

    const handleConfirmFinish = () => {
        setShowConfirm(false);
        finishExam();
    };

    return (
        <div className={clsx(
            "relative",
            isTimeUp && "pointer-events-none" // Keep content readable but prevent editing
        )}>
            {isExamActive && (
                <div className="mb-4 px-4 py-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                    <span className="text-sm text-blue-700 dark:text-blue-300 font-medium">
                        📝 {title || 'Exam'} — in progress
                    </span>
                </div>
            )}
            {children}
            {isExamActive && !isTimeUp && (
                <div className="mt-8 text-center">
                    {showConfirm ? (
                        <div className="inline-flex items-center gap-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700 rounded-xl">
                            <span className="text-yellow-800 dark:text-yellow-200 font-medium">
                                {totalExercises - completedExercises} exercise(s) not checked. Finish anyway?
                            </span>
                            <button
                                onClick={handleConfirmFinish}
                                className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg font-medium transition-colors"
                            >
                                Yes, Finish
                            </button>
                            <button
                                onClick={() => setShowConfirm(false)}
                                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-white rounded-lg font-medium transition-colors"
                            >
                                Cancel
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={handleFinishClick}
                            className="px-8 py-3 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-medium transition-colors shadow-md"
                        >
                            Finish Exam
                        </button>
                    )}
                </div>
            )}
            {/* Show Close button when viewing results (exam finished) */}
            {isTimeUp && (
                <div className="mt-8 text-center pointer-events-auto">
                    <button
                        onClick={onCloseResults}
                        className="px-8 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-xl font-medium transition-colors shadow-md"
                    >
                        Close
                    </button>
                </div>
            )}
        </div>
    );
}

// Main Exam component
export function Exam({ timeLimit, title, showExerciseResults = true, children }: ExamProps) {
    const examId = useExamId(title);
    const location = useLocation();
    const { markExerciseComplete } = useProgress();
    const [showResults, setShowResults] = useState(false);
    const [currentAttempt, setCurrentAttempt] = useState<{
        total: number;
        completed: number;
        correct: number;
        timedOut: boolean;
        duration: number;
    } | null>(null);
    const [isStarted, setIsStarted] = useState(false);
    const [previousAttempts, setPreviousAttempts] = useState<ExamAttempt[]>([]);

    // Load previous attempts
    useEffect(() => {
        setPreviousAttempts(getExamAttempts(examId));
    }, [examId]);

    // Callback to submit exercise progress when exam ends
    const handleExerciseComplete = useCallback((exerciseId: string) => {
        markExerciseComplete(exerciseId, location.pathname);
    }, [markExerciseComplete, location.pathname]);

    const handleComplete = useCallback((
        _results: Map<string, { completed: boolean; correct: boolean }>,
        stats: { total: number; completed: number; correct: number }
    ) => {
        const timedOut = stats.completed < stats.total;

        // Save attempt
        saveExamAttempt(
            examId,
            timeLimit,
            0, // remaining time will be calculated from totalTime - duration
            stats.total,
            stats.completed,
            stats.correct,
            timedOut
        );

        setCurrentAttempt({
            ...stats,
            timedOut,
            duration: timeLimit
        });
        setShowResults(true);
        setPreviousAttempts(getExamAttempts(examId));
    }, [examId, timeLimit]);

    const handleStart = useCallback(() => {
        setIsStarted(true);
        setShowResults(false);
        setCurrentAttempt(null);
    }, []);

    const handleContinue = useCallback(() => {
        // Close modal but keep exercises visible with results
        setShowResults(false);
    }, []);

    const handleRestart = useCallback(() => {
        setIsStarted(false);
        setShowResults(false);
        setCurrentAttempt(null);
        // Small delay before allowing restart
        setTimeout(() => {
            setIsStarted(true);
        }, 100);
    }, []);

    const handleClose = useCallback(() => {
        // Close modal and keep exercises visible with results (same as Continue)
        setShowResults(false);
    }, []);

    // Close results view and go back to start screen
    const handleCloseResults = useCallback(() => {
        setIsStarted(false);
        setCurrentAttempt(null);
    }, []);

    if (!isStarted) {
        return (
            <ExamStartScreen
                title={title}
                timeLimit={timeLimit}
                previousAttempts={previousAttempts}
                onStart={handleStart}
            />
        );
    }

    return (
        <ExamProvider timeLimit={timeLimit} showResults={showExerciseResults} onComplete={handleComplete} onExerciseComplete={handleExerciseComplete}>
            <ExamAutoStart>
                <ExamTimer />
                <ExamContent title={title} onCloseResults={handleCloseResults}>
                    {children}
                </ExamContent>
                {currentAttempt && (
                    <ExamResultsModal
                        isOpen={showResults}
                        examId={examId}
                        currentAttempt={currentAttempt}
                        onContinue={handleContinue}
                        onRestart={handleRestart}
                        onClose={handleClose}
                    />
                )}
            </ExamAutoStart>
        </ExamProvider>
    );
}

// Component to auto-start exam when mounted
function ExamAutoStart({ children }: { children: React.ReactNode }) {
    const exam = useExam();

    useEffect(() => {
        if (exam && !exam.isExamActive) {
            exam.startExam();
        }
    }, [exam]);

    return <>{children}</>;
}

// Re-export formatDuration for use in exercises if needed
export { formatDuration } from '../../utils/examStorage';
