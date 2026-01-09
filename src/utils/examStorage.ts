// Exam attempt storage utilities for localStorage

export interface ExamAttempt {
    id: string;
    examId: string;
    timestamp: number;
    duration: number; // actual time spent in seconds
    totalTime: number; // total time limit in seconds
    totalExercises: number;
    completedExercises: number;
    correctExercises: number;
    percentage: number;
    timedOut: boolean;
}

const STORAGE_KEY = 'yazula_exam_attempts';

function generateAttemptId(): string {
    return `attempt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

export function getAllExamAttempts(): ExamAttempt[] {
    try {
        const data = localStorage.getItem(STORAGE_KEY);
        if (!data) return [];
        return JSON.parse(data);
    } catch (error) {
        console.error('Error loading exam attempts:', error);
        return [];
    }
}

export function getExamAttempts(examId: string): ExamAttempt[] {
    const allAttempts = getAllExamAttempts();
    return allAttempts
        .filter(a => a.examId === examId)
        .sort((a, b) => b.timestamp - a.timestamp); // Most recent first
}

export function saveExamAttempt(
    examId: string,
    totalTime: number,
    remainingTime: number,
    totalExercises: number,
    completedExercises: number,
    correctExercises: number,
    timedOut: boolean
): ExamAttempt {
    const duration = totalTime - remainingTime;
    const percentage = totalExercises > 0
        ? Math.round((correctExercises / totalExercises) * 100)
        : 0;

    const attempt: ExamAttempt = {
        id: generateAttemptId(),
        examId,
        timestamp: Date.now(),
        duration,
        totalTime,
        totalExercises,
        completedExercises,
        correctExercises,
        percentage,
        timedOut
    };

    try {
        const attempts = getAllExamAttempts();
        attempts.push(attempt);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(attempts));
    } catch (error) {
        console.error('Error saving exam attempt:', error);
    }

    return attempt;
}

export function clearExamAttempts(examId?: string): void {
    try {
        if (examId) {
            const attempts = getAllExamAttempts().filter(a => a.examId !== examId);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(attempts));
        } else {
            localStorage.removeItem(STORAGE_KEY);
        }
    } catch (error) {
        console.error('Error clearing exam attempts:', error);
    }
}

export function formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function formatTimestamp(timestamp: number): string {
    const date = new Date(timestamp);
    return date.toLocaleString();
}
