export interface QuestionInteraction {
  question: string;
  answer?: string;
}

export function appendAnswerContext(prompt: string, answer: string): string {
  const trimmedAnswer = answer.trim();
  if (!trimmedAnswer) {
    return prompt;
  }

  return `${prompt}\n\n## 上一轮交互回答\n${trimmedAnswer}`;
}
