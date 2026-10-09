import { afterEach, describe, expect, it, vi } from "vitest";
import { createToastStore } from "./toast-store";
afterEach(() => vi.useRealTimers());
describe("native toast lifecycle", () => {
  it("updates a loading notification by id and expires only the result", () => {
    vi.useFakeTimers();
    const store=createToastStore(), onAutoClose=vi.fn();
    const id=store.toast.loading("Emitindo");
    vi.advanceTimersByTime(9000);
    expect(store.getSnapshot()[0]?.type).toBe("loading");
    store.toast.success("Emitido", {id,duration:500,onAutoClose});
    expect(store.getSnapshot()).toHaveLength(1);
    vi.advanceTimersByTime(500);
    expect(store.getSnapshot()).toHaveLength(0);
    expect(onAutoClose).toHaveBeenCalledOnce();
  });
  it("dismisses actions without later auto-close callbacks", () => {
    vi.useFakeTimers();
    const store=createToastStore(), onDismiss=vi.fn(), onAutoClose=vi.fn(), listener=vi.fn();
    const unsubscribe=store.subscribe(listener);
    const id=store.toast.warning("Confirmar", {onDismiss,onAutoClose,duration:100});
    store.toast.dismiss(id); vi.advanceTimersByTime(100);
    expect(onDismiss).toHaveBeenCalledOnce(); expect(onAutoClose).not.toHaveBeenCalled();
    expect(listener).toHaveBeenCalledTimes(2); unsubscribe();
  });
  it("reflects rejected promises as error notifications and preserves rejection for callers", async () => {
    vi.useFakeTimers();
    const store=createToastStore();
    const result=store.toast.promise(Promise.reject(new Error("offline")), {loading:"Enviando",success:"Concluído",error:(error)=>String(error)});
    await expect(result.unwrap()).rejects.toThrow("offline");
    expect(store.getSnapshot()).toEqual([expect.objectContaining({id:result.id,type:"error",title:"Error: offline"})]);
    store.toast.dismiss();
  });
});
