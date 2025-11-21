import { CALCULATIONS } from '../constants/index.js';

export interface TextStats {
  wordCount: number;
  charCount: number;
  tokenCount: number;
}

export const calculateTextStats = (content: string): TextStats => {
  const wordCount = content.trim().split(/\s+/).filter(Boolean).length;
  const charCount = content.length;
  const tokenCount = Math.ceil(content.length / CALCULATIONS.TOKEN_ESTIMATE_DIVISOR);

  return { wordCount, charCount, tokenCount };
};
