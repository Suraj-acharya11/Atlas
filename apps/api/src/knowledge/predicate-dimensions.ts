const PREDICATE_DIMENSIONS: Record<string, string> = {
  prefers_morning: 'study_time_preference',
  prefers_evening: 'study_time_preference',
  underestimates_duration: 'duration_estimation_bias',
  overestimates_duration: 'duration_estimation_bias',
};

export function dimensionForPredicate(predicate: string): string { return PREDICATE_DIMENSIONS[predicate] ?? predicate; }
