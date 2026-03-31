// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import React from "react";
import App from "../example/App";
import { describe, it, expect } from "vitest";

describe("example app integration", () => {
  it("renders the app and shows current state", () => {
    render(<App />);
    expect(screen.getByText(/Current state:/)).toBeTruthy();
    expect(screen.getByText("idle")).toBeTruthy();
  });
});
