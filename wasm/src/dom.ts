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

/**
 * A textarea that grows and shrinks to fit its content on every input event.
 * Consolidates a helper that was previously copy-pasted across four screens.
 */
export function createAutosizingTextarea(props: ElementProps = {}): HTMLTextAreaElement {
    const area = h('textarea', props) as HTMLTextAreaElement;
    const autoResize = () => {
        area.style.height = 'auto';
        area.style.height = `${area.scrollHeight}px`;
    };
    area.addEventListener('input', autoResize);
    setTimeout(autoResize, 0);
    return area;
}

/**
 * Concatenate class names. Falsy entries drop out — pass conditional expressions
 * directly: `cx('base', isActive && 'active', big ? 'big' : 'small')`.
 * Prefer this over string interpolation for classNames — it composes cleanly
 * with the class-based styling in styles.css.
 */
export function cx(...classes: Array<string | false | null | undefined>): string {
    return classes.filter(Boolean).join(' ');
}

/**
 * A transparent-background 🗑️ button. Two visual variants:
 *   'muted'   — neutral gray, for reversible operations (move-to-trash on a tree row)
 *   'danger'  — red, for irreversible operations (delete a vocab term)
 *
 * Callers handle their own event-propagation semantics (e.g. stopPropagation
 * when nested inside a clickable row) — the helper stays out of that.
 */
export function trashButton(props: {
    title: string;
    onClick: (e: MouseEvent) => void;
    variant?: 'muted' | 'danger';
}): HTMLButtonElement {
    return h('button', {
        textContent: '🗑️',
        title: props.title,
        className: cx('k4-trash-btn', props.variant === 'danger' && 'danger'),
        on: { click: props.onClick as EventListener }
    }) as HTMLButtonElement;
}

/**
 * A "+ Add Row" primary button. The label is fixed by intent — callers with a
 * different verb should use a plain h('button', {className: 'k4-btn-primary'}).
 * Optional `style` overlays inline CSS for callers that need spacing tweaks.
 */
export function addRowButton(props: {
    onClick: (e: MouseEvent) => void;
    style?: string;
}): HTMLButtonElement {
    const attrs: ElementProps = {
        textContent: '+ Add Row',
        className: 'k4-btn-primary',
        on: { click: props.onClick as EventListener }
    };
    if (props.style) attrs.style = props.style;
    return h('button', attrs) as HTMLButtonElement;
}

