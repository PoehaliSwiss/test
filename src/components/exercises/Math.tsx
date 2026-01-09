import React from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

interface MathProps {
    /** LaTeX formula string */
    formula: string;
    /** Display mode: true for block (centered), false for inline */
    display?: boolean;
}

export const Math: React.FC<MathProps> = ({ formula, display = false }) => {
    const html = React.useMemo(() => {
        try {
            return katex.renderToString(formula, {
                displayMode: display,
                throwOnError: false,
                errorColor: '#ef4444',
                strict: false
            });
        } catch (error) {
            console.error('KaTeX rendering error:', error);
            return `<span style="color: #ef4444;">${formula}</span>`;
        }
    }, [formula, display]);

    if (display) {
        return (
            <div
                className="my-4 text-center overflow-x-auto"
                dangerouslySetInnerHTML={{ __html: html }}
            />
        );
    }

    return (
        <span
            className="inline-block align-middle"
            dangerouslySetInnerHTML={{ __html: html }}
        />
    );
};
