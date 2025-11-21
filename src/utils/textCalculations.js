import { CALCULATIONS } from '../constants/index.js';

export const calculateTextStats = (content) => {
  const wordCount = content.trim().split(/\s+/).filter(Boolean).length;
  const charCount = content.length;
  const tokenCount = Math.ceil(content.length / CALCULATIONS.TOKEN_ESTIMATE_DIVISOR);

  return { wordCount, charCount, tokenCount };
};
