export function calculateMockScore(test) {
  const correctMark = Number(test.correctMark ?? 1);
  const penalty = Number(test.negativeMarking ?? 1 / 3);
  const correct = Number(test.csCorrect ?? 0) + Number(test.gsCorrect ?? 0);
  const incorrect = Number(test.csIncorrect ?? 0) + Number(test.gsIncorrect ?? 0);
  return correct * correctMark - incorrect * penalty;
}
