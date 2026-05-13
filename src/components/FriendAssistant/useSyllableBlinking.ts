
import { useState, useEffect } from 'react';

export const useSyllableBlinking = () => {
  const [currentSyllable, setCurrentSyllable] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentSyllable(prev => (prev + 1) % 4);
    }, 1000); // Changed from 500ms to 1000ms (slowed by half)

    return () => clearInterval(interval);
  }, []);

  return { currentSyllable };
};

// Simple syllable estimation function
const estimateSyllables = (text: string): number => {
  if (!text) return 0;
  
  // Remove punctuation and convert to lowercase
  const cleanText = text.toLowerCase().replace(/[^a-z\s]/g, '');
  const words = cleanText.split(/\s+/).filter(word => word.length > 0);
  
  let totalSyllables = 0;
  
  words.forEach(word => {
    // Count vowel groups (rough syllable estimation)
    const vowelMatches = word.match(/[aeiouy]+/g);
    let syllables = vowelMatches ? vowelMatches.length : 1;
    
    // Adjust for silent 'e' at the end
    if (word.endsWith('e') && syllables > 1) {
      syllables--;
    }
    
    // Minimum of 1 syllable per word
    totalSyllables += Math.max(1, syllables);
  });
  
  return totalSyllables;
};
