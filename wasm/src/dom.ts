// wasm/src/dom.ts

type EventListenerMap = {
    [K in keyof HTMLElementEventMap]?: (this: HTMLElement, ev: HTMLElementEventMap[K]) => any;
};

export interface ElementProps {
    id?: string;
    className?: string;
    style?: Partial<CSSStyleDeclaration> | string;
    dataset?: Record<string, string | undefined>;
    on?: EventListenerMap;
    textContent?: string;
    innerHTML?: string;
    value?: string;
    type?: string;
    placeholder?: string;
    disabled?: boolean;
    readOnly?: boolean;
    [key: string]: any;
}

/**
 * A zero-dependency Hyperscript-style DOM builder.
 * Safely constructs reactive nodes, styles, data attributes, and event listeners.
 */
export function h<K extends keyof HTMLElementTagNameMap>(
    tag: K,
    props: ElementProps = {},
    ...children: any[]
): HTMLElementTagNameMap[K] {
    const el = document.createElement(tag);

    for (const [key, value] of Object.entries(props)) {
        if (value === undefined || value === null) continue;

        if (key === 'on' && typeof value === 'object') {
            for (const [eventName, handler] of Object.entries(value)) {
                el.addEventListener(eventName, handler as EventListener);
            }
        } else if (key === 'dataset' && typeof value === 'object') {
            for (const [dKey, dVal] of Object.entries(value)) {
                if (dVal !== undefined) el.dataset[dKey] = String(dVal);
            }
        } else if (key === 'style' && typeof value === 'object') {
            Object.assign(el.style, value);
        } else if (key === 'style' && typeof value === 'string') {
            el.style.cssText = value;
        } else {
            (el as any)[key] = value;
        }
    }

    // Recursively flatten arrays so `[child1, child2]` or `...children` both work
    const flatten = (arr: any[]): any[] => {
        return arr.reduce((acc, val) => Array.isArray(val) ? acc.concat(flatten(val)) : acc.concat(val), []);
    };

    for (const child of flatten(children)) {
        if (child == null) continue;
        if (typeof child === 'string' || typeof child === 'number') {
            el.appendChild(document.createTextNode(String(child)));
        } else if (child instanceof Node) {
            el.appendChild(child);
        }
    }

    return el;
}

