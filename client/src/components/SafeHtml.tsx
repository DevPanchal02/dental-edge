import React, { forwardRef, useMemo } from 'react';
import parse, { HTMLReactParserOptions } from 'html-react-parser';

interface SafeHtmlProps extends React.HTMLAttributes<HTMLDivElement> {
    html: string;
}

/**
 * Generates a simple hash to force remounts when content changes.
 * This is required because the TextHighlighter directly mutates the DOM,
 * causing React's diff algorithm to crash if we don't provide a fresh tree.
 */
const simpleHash = (str: string) => {
    let hash = 0;
    if (str.length === 0) return hash;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash |= 0; 
    }
    return hash;
};

const SafeHtml = forwardRef<HTMLDivElement, SafeHtmlProps>(({ html, style, className, ...rest }, ref) => {
    const content = html || '';

    // The key ensures the inner content is treated as a fresh tree on update
    const contentKey = useMemo(() => `${content.length}-${simpleHash(content)}`, [content]);
    const options: HTMLReactParserOptions = {};

    // ARCHITECTURE FIX:
    // 1. Outer div: Receives the 'className' (styling/scroll) and 'ref'. It remains STABLE.
    // 2. Inner div: Receives the 'data-' attributes and content. It REMOUNTS on change.
    // This prevents scroll jumping because the scrolling container (outer) is never destroyed.
    
    // We separate the data-* props from the rest to pass to the inner container
    const dataProps = Object.keys(rest).reduce((acc, key) => {
        if (key.startsWith('data-')) {
            acc[key] = rest[key as keyof typeof rest];
        }
        return acc;
    }, {} as Record<string, any>);

    // Props that should stay on the outer container (events, aria, etc)
    const containerProps = Object.keys(rest).reduce((acc, key) => {
        if (!key.startsWith('data-')) {
            acc[key] = rest[key as keyof typeof rest];
        }
        return acc;
    }, {} as Record<string, any>);

    return (
        <div 
            ref={ref} 
            className={className} 
            style={style} 
            {...containerProps}
        >
            <div key={contentKey} {...dataProps}>
                {parse(content, options)}
            </div>
        </div>
    );
});

SafeHtml.displayName = 'SafeHtml';

export default React.memo(SafeHtml);