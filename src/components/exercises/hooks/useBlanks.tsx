import React, { useState, useMemo, useCallback } from 'react';

// Helper to extract text from ReactNode, preserving line breaks
export function getTextFromChildren(node: React.ReactNode): string {
    if (typeof node === 'string') return node;
    if (typeof node === 'number') return node.toString();
    if (Array.isArray(node)) {
        return node.map((child, idx) => {
            const text = getTextFromChildren(child);
            // Add newline after block elements in arrays (except last)
            if (React.isValidElement(child)) {
                const type = child.type;
                // Check for block-level elements that should have newlines
                if (type === 'p' || type === 'div' || type === 'li' || type === 'br') {
                    return text + (idx < node.length - 1 ? '\n' : '');
                }
            }
            return text;
        }).join('');
    }
    if (React.isValidElement(node)) {
        const type = node.type;
        // Handle br element
        if (type === 'br') return '\n';

        const props = node.props as { children?: React.ReactNode };
        if (props.children) {
            const content = getTextFromChildren(props.children);
            // Add trailing newline for block elements
            if (type === 'p' || type === 'div') {
                return content + '\n';
            }
            return content;
        }
    }
    return '';
};

// Helper to check if content should be rendered with markdown
export function isMarkdownContent(text: string): boolean {
    // Check for markdown features that require rendering
    const hasBold = text.includes('**');
    const hasItalic = /(?<!\*)\*(?!\*)/.test(text); // Single asterisk not preceded/followed by another
    const hasMultipleLines = text.includes('\n');

    // Check for lists (- item, * item, or 1. item at start of line)
    const hasList = /^\s*[-*]\s+/m.test(text) || /^\s*\d+\.\s+/m.test(text);

    // Check for tables specifically
    const lines = text.split('\n');
    const hasPipes = lines.some(line => line.includes('|'));
    const hasSeparator = lines.some(line => /^\s*\|[\s\-:|]+\|\s*$/.test(line));
    const isTable = hasPipes && hasSeparator;

    return isTable || hasBold || hasItalic || hasMultipleLines || hasList;
}

export interface BlankData {
    answer: string;
    localOptions: string[];
    hint?: string;
}

export interface BlankStatus {
    value: string;
    isCorrect: boolean;
    isWrong: boolean;
    touched: boolean;
    showValidation: boolean;
}

export interface UseBlanksOptions {
    children: React.ReactNode;
    mode?: 'input' | 'drag' | 'picker' | 'type';
    options?: string[]; // Global options
}

export const useBlanks = ({ children, options: _options = [] }: UseBlanksOptions) => {
    // 1. Parse text and extract blanks
    const { blanksData } = useMemo(() => {
        const text = getTextFromChildren(children);
        // Parse text to find blanks: [answer] or [answer|opt1|opt2]
        // We need to keep the structure, so we don't just split the text.
        // Actually, for parsing answers, we just need the text.
        // For rendering, we will traverse the React tree.

        const parts = text.split(/(\[.*?\])/g);
        const data: BlankData[] = parts
            .filter(p => p.startsWith('[') && p.endsWith(']'))
            .map(p => {
                const content = p.slice(1, -1); // Remove [ and ]
                const items = content.split('|');
                const answer = items[0];

                let hint: string | undefined;
                const localOptions: string[] = [];

                for (let i = 1; i < items.length; i++) {
                    if (items[i].startsWith('hint:')) {
                        hint = items[i].substring(5);
                    } else {
                        localOptions.push(items[i]);
                    }
                }

                return { answer, localOptions, hint };
            });

        return { blanksData: data };
    }, [children]);

    const answers = useMemo(() => blanksData.map(b => b.answer), [blanksData]);

    // 2. State management
    const [inputs, setInputs] = useState<string[]>(() => new Array(answers.length).fill(''));
    const [touched, setTouched] = useState<boolean[]>(() => new Array(answers.length).fill(false));
    const [blurred, setBlurred] = useState<boolean[]>(() => new Array(answers.length).fill(false));
    const [submitted, setSubmitted] = useState(false);
    const [showAnswers, setShowAnswers] = useState(false);
    const [showHintFor, setShowHintFor] = useState<boolean[]>(() => new Array(answers.length).fill(false));

    const handleInputChange = useCallback((index: number, value: string) => {
        setInputs(prev => {
            const next = [...prev];
            next[index] = value;
            return next;
        });
        setTouched(prev => {
            const next = [...prev];
            next[index] = true;
            return next;
        });
        // Reset blur state on change so partial matches are valid again while typing
        setBlurred(prev => {
            const next = [...prev];
            next[index] = false;
            return next;
        });
    }, []);

    const handleBlur = useCallback((index: number) => {
        setBlurred(prev => {
            const next = [...prev];
            next[index] = true;
            return next;
        });
    }, []);

    const checkAnswers = useCallback(() => {
        setSubmitted(true);
        setShowAnswers(false);
    }, []);

    const reset = useCallback(() => {
        setSubmitted(false);
        setShowAnswers(false);
        setInputs(new Array(answers.length).fill(''));
        setTouched(new Array(answers.length).fill(false));
    }, [answers.length]);

    // Toggle hint visibility for a specific blank
    const toggleHint = useCallback((index: number) => {
        setShowHintFor(prev => {
            const next = [...prev];
            next[index] = !next[index];
            return next;
        });
    }, []);

    // Legacy function name for compatibility - now toggles hint
    const revealAnswer = toggleHint;

    const showAllAnswers = useCallback(() => {
        setInputs([...answers]);
        setSubmitted(true);
        setShowAnswers(true);
    }, [answers]);

    // 3. Recursive Renderer
    const renderContent = useCallback((
        renderBlank: (index: number, data: BlankData, status: BlankStatus) => React.ReactNode
    ) => {
        let blankIndexCounter = 0;

        const processNode = (node: React.ReactNode): React.ReactNode => {
            return React.Children.map(node, (child) => {
                if (typeof child === 'string') {
                    // Split by blanks: [answer]
                    const parts = child.split(/(\[.*?\])/g);
                    return parts.map((part, i) => {
                        if (part.startsWith('[') && part.endsWith(']')) {
                            if (blankIndexCounter >= blanksData.length) return part;

                            const data = blanksData[blankIndexCounter];
                            const index = blankIndexCounter++;

                            const value = inputs[index] || '';
                            const isCorrect = value.trim().toLowerCase() === data.answer.toLowerCase();
                            const showValidation = submitted || (touched[index] && value.trim() !== '');
                            const isPartialMatch = value.trim().length > 0 && data.answer.toLowerCase().startsWith(value.trim().toLowerCase());

                            const status: BlankStatus = {
                                value,
                                isCorrect,
                                isWrong: showValidation && !isCorrect && (submitted || (!isPartialMatch || blurred[index])),
                                touched: touched[index],
                                showValidation
                            };

                            return (
                                <React.Fragment key={`${index}-${i}`}>
                                    {renderBlank(index, data, status)}
                                </React.Fragment>
                            );
                        }
                        return part;
                    });
                }

                if (React.isValidElement(child)) {
                    // Recurse into children
                    const props = child.props as { children?: React.ReactNode };
                    if (props.children) {
                        return React.cloneElement(child, {
                            ...props,
                            children: processNode(props.children)
                        } as any);
                    }
                    return child;
                }

                return child;
            });
        };

        return processNode(children);
    }, [children, blanksData, inputs, submitted, touched]);

    const allCorrect = inputs.every((val, idx) => val.trim().toLowerCase() === answers[idx].toLowerCase());

    return {
        blanksData,
        answers,
        inputs,
        setInputs,
        touched,
        blurred,
        submitted,
        showAnswers,
        showHintFor,
        handleInputChange,
        handleBlur,
        checkAnswers,
        reset,
        revealAnswer,
        toggleHint,
        showAllAnswers,
        renderContent,
        allCorrect,
        setSubmitted
    };
};
