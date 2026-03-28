import { CALCULATIONS } from '../constants/index.js';

export interface TextStats {
  wordCount: number;
  charCount: number;
  tokenCount: number;
  readingTime: number;
}

export const calculateTextStats = (content: string): TextStats => {
  const wordCount = content.trim().split(/\s+/).filter(Boolean).length;
  const charCount = content.length;
  const tokenCount = Math.ceil(content.length / CALCULATIONS.TOKEN_ESTIMATE_DIVISOR);
  const readingTime = Math.max(1, Math.round(wordCount / 238));

  return { wordCount, charCount, tokenCount, readingTime };
};
