import { describe, expect, it } from "vitest";
import { HomePage } from "./HomePage.web";

describe("HomePage", () => {
  it("exporta a composição da home como função", () => {
    expect(typeof HomePage).toBe("function");
  });
});
