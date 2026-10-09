import test from "node:test";
import assert from "node:assert/strict";
import { calculateMockScore } from "../lib/scoring.mjs";

test("scores correct answers and applies the configured incorrect penalty", () => {
  assert.equal(calculateMockScore({ csCorrect: 30, gsCorrect: 10, csIncorrect: 6, negativeMarking: 1 / 3 }), 38);
});

test("unattempted questions and qualifying language marks do not affect merit score", () => {
  assert.equal(calculateMockScore({ csCorrect: 7, csUnattempted: 20, languageCorrect: 10, languageIncorrect: 2 }), 7);
});

test("uses custom marks per correct and incorrect answer", () => {
  assert.equal(calculateMockScore({ csCorrect: 4, gsCorrect: 1, csIncorrect: 2, correctMark: 2, negativeMarking: 0.5 }), 9);
});
