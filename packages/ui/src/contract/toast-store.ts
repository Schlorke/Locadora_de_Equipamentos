import type { ReactNode } from "react";
export type ToastKind = "normal" | "success" | "error" | "info" | "warning" | "loading";
export interface ToastAction { label: ReactNode; onClick: () => void }
export interface ToastOptions {
  id?: number | string;
  description?: ReactNode | (() => ReactNode);
  duration?: number;
  action?: ToastAction | ReactNode;
  cancel?: ToastAction | ReactNode;
  onDismiss?: (toast: ToastEntry) => void;
  onAutoClose?: (toast: ToastEntry) => void;
  [option: string]: unknown;
}
export interface ToastEntry extends ToastOptions { id: number | string; title: ReactNode; type: ToastKind }
export function createToastStore() {
  let entries: ToastEntry[] = [];
  let sequence = 0;
  const listeners = new Set<() => void>();
  const timers = new Map<number|string, ReturnType<typeof setTimeout>>();
  const emit = () => listeners.forEach(listener => listener());
  const dismiss = (id?: number|string, auto = false) => {
    const removed = entries.filter(entry => id === undefined || entry.id === id);
    for (const entry of removed) { clearTimeout(timers.get(entry.id)); timers.delete(entry.id); }
    entries = entries.filter(entry => !removed.includes(entry));
    emit();
    for (const entry of removed) (auto ? entry.onAutoClose : entry.onDismiss)?.(entry);
  };
  const publish = (title: ReactNode | (() => ReactNode), options: ToastOptions = {}, type: ToastKind = "normal") => {
    const id = options.id ?? ++sequence;
    const entry: ToastEntry = {...options, id, title: typeof title === "function" ? title() : title, type};
    clearTimeout(timers.get(id));
    timers.delete(id);
    const existing = entries.findIndex(item => item.id === id);
    entries = existing < 0 ? [...entries, entry] : entries.map(item => item.id === id ? entry : item);
    const duration = options.duration ?? (type === "loading" ? Infinity : 4000);
    if (Number.isFinite(duration)) timers.set(id, setTimeout(() => dismiss(id, true), Math.max(0, duration)));
    emit();
    return id;
  };
  const notify = Object.assign(publish, {
    success: (title: ReactNode, options?: ToastOptions) => publish(title, options, "success"),
    error: (title: ReactNode, options?: ToastOptions) => publish(title, options, "error"),
    info: (title: ReactNode, options?: ToastOptions) => publish(title, options, "info"),
    warning: (title: ReactNode, options?: ToastOptions) => publish(title, options, "warning"),
    loading: (title: ReactNode, options?: ToastOptions) => publish(title, options, "loading"),
    message: (title: ReactNode, options?: ToastOptions) => publish(title, options),
    dismiss: (id?: number|string) => dismiss(id),
    promise: <T,>(promise: Promise<T> | (() => Promise<T>), options: ToastOptions & {
      loading?: ReactNode; success?: ReactNode | ((value:T)=>ReactNode); error?: ReactNode | ((error:unknown)=>ReactNode);
    }) => {
      const id = publish(options.loading ?? "", options, "loading");
      const result = Promise.resolve().then(() => typeof promise === "function" ? promise() : promise);
      result.then(value => { const title = typeof options.success === "function" ? options.success(value) : options.success; publish(title, {...options, id}, "success"); },
        error => { const title = typeof options.error === "function" ? options.error(error) : options.error; publish(title, {...options, id}, "error"); });
      return { id, unwrap: () => result };
    },
  });
  return { toast: notify, getSnapshot: () => entries, subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; } };
}
export const nativeToastStore = createToastStore();
