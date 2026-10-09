// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
const storage=vi.hoisted(()=>({getItem:vi.fn(),setItem:vi.fn(),removeItem:vi.fn()}));
vi.mock("../../../shared/storage",()=>({keyValueStorage:storage}));
import { useStoredRecents } from "./use-stored-recents";
const normalize=(value:unknown)=>typeof value==="string"&&value.trim()?value.trim():null;
afterEach(()=>{cleanup();vi.resetAllMocks();});
describe("recent selection persistence",()=>{
  it("hydrates asynchronous storage and deduplicates before persisting updates",async()=>{
    storage.getItem.mockResolvedValue(JSON.stringify(["A","A","B",42,""]));
    const {result}=renderHook(()=>useStoredRecents("icons",3,normalize));
    await waitFor(()=>expect(result.current.recents).toEqual(["A","B"]));
    act(()=>result.current.add("B"));
    await waitFor(()=>expect(storage.setItem).toHaveBeenLastCalledWith("icons",'["B","A"]'));
  });
  it("does not resurrect stale values when cleared during asynchronous hydration",async()=>{
    let resolve!:(value:string)=>void;
    storage.getItem.mockReturnValue(new Promise<string>(done=>{resolve=done}));
    const {result}=renderHook(()=>useStoredRecents("icons",3,normalize));
    await waitFor(()=>expect(storage.getItem).toHaveBeenCalled());
    act(()=>result.current.clear());
    await act(async()=>{resolve('["stale"]')});
    await waitFor(()=>expect(storage.removeItem).toHaveBeenCalledWith("icons"));
    expect(result.current.recents).toEqual([]);
  });
});
