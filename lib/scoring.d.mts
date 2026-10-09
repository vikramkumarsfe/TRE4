export type MockScoreInput = {
  csCorrect?: number;
  gsCorrect?: number;
  csIncorrect?: number;
  gsIncorrect?: number;
  correctMark?: number;
  negativeMarking?: number;
  languageCorrect?: number;
  languageIncorrect?: number;
  csUnattempted?: number;
  gsUnattempted?: number;
};
export function calculateMockScore(test: MockScoreInput): number;
