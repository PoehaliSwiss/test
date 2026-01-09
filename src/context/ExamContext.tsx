import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import type { ReactNode } from 'react';

export interface ExerciseResult {
    exerciseId: string;
    completed: boolean;
    correct: boolean;
    answeredAt?: number;
}

export interface ExamContextType {
    // State
    isExamActive: boolean;
    isTimeUp: boolean;
    isPaused: boolean;
    isExamFinished: boolean; // True after exam ends (time up or manually finished)
    shouldShowResults: boolean; // Whether to show correct/incorrect after exam
    remainingTime: number; // in seconds
    totalTime: number; // in seconds

    // Exercise tracking
    registerExercise: (exerciseId: string) => void;
    markExerciseComplete: (exerciseId: string, correct: boolean) => void;
    getExerciseResult: (exerciseId: string) => ExerciseResult | undefined;

    // Results
    results: Map<string, ExerciseResult>;
    totalExercises: number;
    completedExercises: number;
    correctExercises: number;

    // Actions
    startExam: () => void;
    pauseExam: () => void;
    resumeExam: () => void;
    finishExam: () => void;
    resetExam: () => void;
}

const ExamContext = createContext<ExamContextType | null>(null);

interface ExamProviderProps {
    children: ReactNode;
    timeLimit: number; // in seconds
    showResults?: boolean; // Whether to show results after exam (default true)
    onComplete?: (results: ExamContextType['results'], stats: { total: number; completed: number; correct: number }) => void;
    onExerciseComplete?: (exerciseId: string) => void; // Called for each correct exercise when exam ends
}

export function ExamProvider({ children, timeLimit, showResults = true, onComplete, onExerciseComplete }: ExamProviderProps) {
    const [isExamActive, setIsExamActive] = useState(false);
    const [isTimeUp, setIsTimeUp] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [isExamFinished, setIsExamFinished] = useState(false);
    const [remainingTime, setRemainingTime] = useState(timeLimit);
    const [results, setResults] = useState<Map<string, ExerciseResult>>(new Map());

    const registeredExercises = useRef<Set<string>>(new Set());
    const timerRef = useRef<number | null>(null);
    const hasCalledOnComplete = useRef(false);

    // Timer logic
    useEffect(() => {
        if (isExamActive && !isPaused && !isTimeUp && remainingTime > 0) {
            timerRef.current = window.setInterval(() => {
                setRemainingTime(prev => {
                    if (prev <= 1) {
                        setIsTimeUp(true);
                        if (timerRef.current) {
                            clearInterval(timerRef.current);
                            timerRef.current = null;
                        }
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        }

        return () => {
            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }
        };
    }, [isExamActive, isPaused, isTimeUp, remainingTime]);

    // Call onComplete only when time is up (user must click Finish button otherwise)
    useEffect(() => {
        if (isTimeUp && isExamActive && !hasCalledOnComplete.current) {
            hasCalledOnComplete.current = true;
            const totalExercises = registeredExercises.current.size;
            const completedExercises = Array.from(results.values()).filter(r => r.completed).length;
            const correctExercises = Array.from(results.values()).filter(r => r.correct).length;

            // Submit progress for correct exercises to the sidebar tree
            if (onExerciseComplete) {
                results.forEach((result) => {
                    if (result.correct) {
                        onExerciseComplete(result.exerciseId);
                    }
                });
            }

            // Mark exam as finished
            setIsExamFinished(true);

            onComplete?.(results, {
                total: totalExercises,
                completed: completedExercises,
                correct: correctExercises
            });
        }
    }, [isTimeUp, results, isExamActive, onComplete, onExerciseComplete]);

    const registerExercise = useCallback((exerciseId: string) => {
        registeredExercises.current.add(exerciseId);
        // Initialize result if not exists
        setResults(prev => {
            if (!prev.has(exerciseId)) {
                const newMap = new Map(prev);
                newMap.set(exerciseId, { exerciseId, completed: false, correct: false });
                return newMap;
            }
            return prev;
        });
    }, []);

    const markExerciseComplete = useCallback((exerciseId: string, correct: boolean) => {
        setResults(prev => {
            const newMap = new Map(prev);
            newMap.set(exerciseId, {
                exerciseId,
                completed: true,
                correct,
                answeredAt: Date.now()
            });
            return newMap;
        });
    }, []);

    const getExerciseResult = useCallback((exerciseId: string) => {
        return results.get(exerciseId);
    }, [results]);

    const startExam = useCallback(() => {
        setIsExamActive(true);
        setIsTimeUp(false);
        setIsPaused(false);
        setRemainingTime(timeLimit);
        hasCalledOnComplete.current = false;
    }, [timeLimit]);

    const pauseExam = useCallback(() => {
        setIsPaused(true);
    }, []);

    const resumeExam = useCallback(() => {
        setIsPaused(false);
    }, []);

    const finishExam = useCallback(() => {
        setIsTimeUp(true);
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
    }, []);

    const resetExam = useCallback(() => {
        setIsExamActive(false);
        setIsTimeUp(false);
        setIsPaused(false);
        setIsExamFinished(false);
        setRemainingTime(timeLimit);
        setResults(new Map());
        registeredExercises.current.clear();
        hasCalledOnComplete.current = false;
    }, [timeLimit]);

    const totalExercises = registeredExercises.current.size;
    const completedExercises = Array.from(results.values()).filter(r => r.completed).length;
    const correctExercises = Array.from(results.values()).filter(r => r.correct).length;

    return (
        <ExamContext.Provider
            value={{
                isExamActive,
                isTimeUp,
                isPaused,
                isExamFinished,
                shouldShowResults: showResults && isExamFinished,
                remainingTime,
                totalTime: timeLimit,
                registerExercise,
                markExerciseComplete,
                getExerciseResult,
                results,
                totalExercises,
                completedExercises,
                correctExercises,
                startExam,
                pauseExam,
                resumeExam,
                finishExam,
                resetExam,
            }}
        >
            {children}
        </ExamContext.Provider>
    );
}

export function useExam(): ExamContextType | null {
    return useContext(ExamContext);
}

export function useExamRequired(): ExamContextType {
    const context = useContext(ExamContext);
    if (!context) {
        throw new Error('useExamRequired must be used within an ExamProvider');
    }
    return context;
}
