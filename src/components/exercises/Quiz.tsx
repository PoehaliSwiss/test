import React, { useState, useEffect, useRef, useMemo, type ReactNode } from 'react';
import { useSettings } from '../../context/SettingsContext';
import { useProgress } from '../../context/ProgressContext';
import { useLocation } from 'react-router-dom';
import { clsx } from 'clsx';
import { Check } from 'lucide-react';
import { generateStableExerciseId } from '../../utils/exerciseId';
import { useExamExercise } from '../../hooks/useExamExercise';

interface QuizProps {
    answer: string; // "1" or "1,3"
    children: ReactNode;
    multiple?: boolean;
    direction?: 'vertical' | 'horizontal';
    mode?: 'normal' | 'compact';
}

export const Quiz: React.FC<QuizProps> = ({ answer, children, multiple = false, direction = 'vertical', mode = 'normal' }) => {
    const [selected, setSelected] = useState<string[]>([]);
    const [submitted, setSubmitted] = useState(false);
    const { markExerciseComplete, isExerciseComplete } = useProgress();
    const location = useLocation();
    const exerciseIdRef = useRef<string>('');
    const [isCompleted, setIsCompleted] = useState(false);

    // Generate stable exercise ID using useMemo for immediate availability
    // Include question text (first text child) along with answer to avoid collisions
    const exerciseId = useMemo(() => {
        // Extract question text from children for unique ID
        const extractText = (node: ReactNode): string => {
            if (typeof node === 'string') return node;
            if (typeof node === 'number') return String(node);
            if (React.isValidElement(node)) {
                const props = node.props as { children?: ReactNode };
                // Skip Option components
                if (node.type === Option ||
                    (node.type as { displayName?: string }).displayName === 'Option') {
                    return '';
                }
                if (props.children) {
                    return React.Children.toArray(props.children).map(extractText).join('');
                }
            }
            return '';
        };
        const questionText = React.Children.toArray(children).map(extractText).join('').slice(0, 100);
        return generateStableExerciseId(location.pathname, 'Quiz', `${answer}:${questionText}`);
    }, [location.pathname, answer, children]);

    useEffect(() => {
        exerciseIdRef.current = exerciseId;
        setIsCompleted(isExerciseComplete(exerciseId));
    }, [exerciseId, isExerciseComplete]);

    // Exam context integration - use useMemo result for immediate registration
    const { markComplete: markExamComplete, shouldHideControls, shouldDeferProgress, shouldShowResults } = useExamExercise(exerciseId);

    const correctAnswers = answer.split(',').map(s => s.trim());
    const isCorrect = submitted &&
        selected.length === correctAnswers.length &&
        selected.every(s => correctAnswers.includes(s));

    const isMultiple = multiple || answer.includes(',');

    // Track last marked correctness to prevent infinite loops
    const lastMarkedCorrectRef = React.useRef<boolean | null>(null);

    // Show results when exam ends (if showResults is enabled)
    useEffect(() => {
        if (shouldShowResults && !submitted) {
            setSubmitted(true);
        }
    }, [shouldShowResults, submitted]);

    const handleSelect = (index: number) => {
        if (submitted) return;
        const val = (index + 1).toString();
        let newSelected: string[];
        if (isMultiple) {
            newSelected = selected.includes(val) ? selected.filter(v => v !== val) : [...selected, val];
        } else {
            newSelected = [val];
        }
        setSelected(newSelected);

        // In exam mode (no Check button), auto-mark as completed when user makes selection
        if (shouldHideControls && newSelected.length > 0) {
            const isCorrectNow = newSelected.length === correctAnswers.length &&
                newSelected.every(s => correctAnswers.includes(s));
            // Only call if correctness changed
            if (lastMarkedCorrectRef.current !== isCorrectNow) {
                lastMarkedCorrectRef.current = isCorrectNow;
                markExamComplete(isCorrectNow);
                // Progress is deferred - will be submitted when exam ends
                if (isCorrectNow) {
                    setIsCompleted(true);
                }
            }
        } else if (newSelected.length === 0) {
            // Reset when selection cleared
            lastMarkedCorrectRef.current = null;
        }
    };

    const handleSubmit = () => {
        setSubmitted(true);

        // Check if correct and mark as complete
        const correctAnswers = answer.split(',').map(s => s.trim());
        const isCorrect = selected.length === correctAnswers.length &&
            selected.every(s => correctAnswers.includes(s));

        if (isCorrect && exerciseIdRef.current) {
            // Only mark progress immediately if NOT in exam mode
            if (!shouldDeferProgress) {
                markExerciseComplete(exerciseIdRef.current, location.pathname);
            }
            markExamComplete(true); // Report to exam context
            setIsCompleted(true);
        } else {
            markExamComplete(false); // Report incorrect to exam context
        }
    };

    const handleReset = () => {
        setSelected([]);
        setSubmitted(false);
    };

    const { showHints } = useSettings();

    const handleShowAnswers = () => {
        setSelected(correctAnswers);
        setSubmitted(true);
    };

    // Recursive function to find options
    const findOptions = (nodes: ReactNode): React.ReactElement[] => {
        let found: React.ReactElement[] = [];
        React.Children.forEach(nodes, (child) => {
            if (!React.isValidElement(child)) return;

            if (child.type === Option ||
                (child.type as any).displayName === 'Option' ||
                (child.type as any).name === 'Option') {
                found.push(child as React.ReactElement);
            } else if ((child as React.ReactElement<{ children?: ReactNode }>).props.children) {
                found = [...found, ...findOptions((child as React.ReactElement<{ children?: ReactNode }>).props.children)];
            }
        });
        return found;
    };

    const options = findOptions(children);

    return (
        <div className="my-6 p-6 border border-gray-200 rounded-xl bg-white shadow-sm dark:bg-gray-800 dark:border-gray-700 relative">
            {isCompleted && !shouldDeferProgress && (
                <div className="absolute -top-3 -right-3 bg-green-500 text-white rounded-full p-2 shadow-lg z-10">
                    <Check size={20} />
                </div>
            )}
            <div className="mb-4 text-lg text-gray-800 dark:text-gray-200">
                {/* We need to filter out Options from children to display the question text */}
                {/* But findOptions recurses. Simple filtering might not be enough if structure is complex. */}
                {/* Actually, the current implementation just renders {children} which includes Options if they are direct children. */}
                {/* But Option returns null, so they don't render. The text content renders. */}
                {children}
            </div>

            {isMultiple && !submitted && (
                <div className="mb-3 text-sm text-blue-600 dark:text-blue-400 font-medium flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Select multiple answers
                </div>
            )}

            <div className={clsx(
                direction === 'vertical' ? "space-y-3" : "flex flex-wrap gap-3"
            )}>
                {options.map((child, idx) => {
                    const isSelected = selected.includes((idx + 1).toString());
                    const isAnswer = correctAnswers.includes((idx + 1).toString());

                    let statusClass = "";
                    if (submitted) {
                        if (isAnswer) statusClass = "bg-green-100 border-green-500 dark:bg-green-900/30 dark:border-green-500";
                        else if (isSelected && !isAnswer) statusClass = "bg-red-100 border-red-500 dark:bg-red-900/30 dark:border-red-500";
                        else statusClass = "opacity-50";
                    } else {
                        statusClass = isSelected
                            ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-400"
                            : "hover:bg-gray-50 dark:hover:bg-gray-700/50 border-gray-200 dark:border-gray-600";
                    }

                    const childProps = (child as React.ReactElement<OptionProps>).props;
                    const { backgroundColor, color } = childProps;

                    // Apply custom styles always if present.
                    // Feedback (selection/correct/incorrect) is handled via borders and opacity.
                    const customStyle = { backgroundColor, color };

                    return (
                        <div
                            key={idx}
                            onClick={() => handleSelect(idx)}
                            style={customStyle}
                            className={clsx(
                                "border-2 rounded-lg cursor-pointer transition-all duration-200 flex items-center gap-3",
                                mode === 'compact' ? "px-3 py-2 text-sm w-fit" : "p-4",
                                statusClass
                            )}
                        >
                            {/* Checkbox/Radio indicator */}
                            <div className={clsx(
                                "flex-shrink-0 w-5 h-5 border-2 flex items-center justify-center transition-colors",
                                isMultiple ? "rounded" : "rounded-full",
                                isSelected
                                    ? "border-blue-500 bg-blue-500 text-white"
                                    : "border-gray-300 dark:border-gray-500"
                            )}>
                                {isSelected && (
                                    isMultiple
                                        ? <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                                        : <div className="w-2 h-2 bg-white rounded-full" />
                                )}
                            </div>
                            <span>{childProps.children}</span>
                        </div>
                    );
                })}
            </div>

            <div className="mt-6 flex gap-4">
                {!shouldHideControls && (
                    <>
                        {!submitted ? (
                            <>
                                <button
                                    onClick={handleSubmit}
                                    disabled={selected.length === 0}
                                    className="px-6 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm border border-transparent"
                                >
                                    Check
                                </button>
                                {showHints && (
                                    <button
                                        onClick={handleShowAnswers}
                                        className="px-4 py-2 text-blue-600 bg-blue-50 border border-blue-200 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800 dark:hover:bg-blue-900/30 rounded-lg transition-colors font-medium"
                                    >
                                        Show answers
                                    </button>
                                )}
                            </>
                        ) : (
                            <>
                                <button
                                    onClick={handleReset}
                                    className="px-6 py-2 bg-gray-200 text-gray-800 rounded-lg font-medium hover:bg-gray-300 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600 transition-colors"
                                >
                                    Try again
                                </button>
                                {showHints && (
                                    <button
                                        onClick={handleShowAnswers}
                                        className="px-4 py-2 text-blue-600 bg-blue-50 border border-blue-200 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800 dark:hover:bg-blue-900/30 rounded-lg transition-colors font-medium"
                                    >
                                        Show answers
                                    </button>
                                )}
                            </>
                        )}

                        {submitted && (
                            <div className={clsx(
                                "px-4 py-2 rounded-lg font-medium",
                                isCorrect ? "text-green-600 bg-green-50 dark:bg-green-900/20 dark:text-green-400" : "text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400"
                            )}>
                                {isCorrect ? "Correct! 🎉" : "Incorrect, please try again"}
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export interface OptionProps {
    children: ReactNode;
    backgroundColor?: string;
    color?: string;
}

export const Option: React.FC<OptionProps> = () => {
    return null;
};
Option.displayName = 'Option';
