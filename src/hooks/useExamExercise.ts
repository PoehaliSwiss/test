import { useEffect, useRef } from 'react';
import { useExam } from '../context/ExamContext';

/**
 * Hook for integrating exercise components with ExamContext.
 * Should be called in every exercise component to register and report completion.
 * 
 * @param exerciseId - Unique identifier for this exercise
 * @returns Object with isInExam flag and markComplete function
 */
export function useExamExercise(exerciseId: string) {
    const exam = useExam();
    const hasRegistered = useRef(false);

    // Register exercise with exam context when mounted
    useEffect(() => {
        if (exam && exerciseId && !hasRegistered.current) {
            exam.registerExercise(exerciseId);
            hasRegistered.current = true;
        }
    }, [exam, exerciseId]);

    // Function to mark exercise as complete
    const markComplete = (isCorrect: boolean) => {
        if (exam && exerciseId) {
            exam.markExerciseComplete(exerciseId, isCorrect);
        }
    };

    // Check if exercise is already completed in exam
    const getExamResult = () => {
        if (exam && exerciseId) {
            return exam.getExerciseResult(exerciseId);
        }
        return undefined;
    };

    return {
        isInExam: !!exam,
        isExamActive: exam?.isExamActive ?? false,
        shouldHideControls: exam?.isExamActive ?? false,
        shouldDeferProgress: exam?.isExamActive ?? false, // Don't update sidebar tree during exam
        isExamFinished: exam?.isExamFinished ?? false,
        shouldShowResults: exam?.shouldShowResults ?? false, // Show results after exam ends
        isTimeUp: exam?.isTimeUp ?? false,
        markComplete,
        getExamResult,
    };
}
