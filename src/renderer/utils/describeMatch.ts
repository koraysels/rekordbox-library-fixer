export type MatchTone = 'high' | 'medium' | 'low';

export interface MatchDescription {
  label: string;
  tone: MatchTone;
  /** The tooltip: what the match rests on, and whether to check it. */
  explanation: string;
}

/**
 * What a duplicate set's confidence means, in words. A bare "Medium" said
 * nothing about what was medium or why; this says what the match rests on and
 * how sure it is.
 */
export function describeMatch(confidence: number, matchType: string, filesMissing = false): MatchDescription {
  if (matchType === 'fingerprint') {
    return {
      label: 'Same audio',
      tone: 'high',
      explanation: 'Both files were read and their audio matches. Safe to resolve.',
    };
  }

  const basis = filesMissing
    ? 'The files could not be read, so this match rests on artist, title and length, plus album, bitrate, size and file name where they agree.'
    : 'Matched on track details (artist, title, length) rather than on the audio itself.';

  if (confidence >= 90) {
    return { label: `Very likely the same · ${confidence}%`, tone: 'high', explanation: basis };
  }
  if (confidence >= 70) {
    return {
      label: `Probably the same · ${confidence}%`,
      tone: 'medium',
      explanation: `${basis} Worth a quick check before resolving — a remix or edit can share all of these.`,
    };
  }
  return {
    label: `Unsure · ${confidence}%`,
    tone: 'low',
    explanation: `${basis} Check before resolving: the details only partly agree.`,
  };
}
