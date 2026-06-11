export const SUBJECTS_JUNIOR = [
  'Mathematics',
  'Natural Sciences',
  'English',
  'Social Sciences',
] as const;

export const SUBJECTS_SENIOR = [
  'Mathematics',
  'Mathematical Literacy',
  'Physical Sciences',
  'Life Sciences',
  'Accounting',
  'Business Studies',
  'Geography',
  'History',
  'English',
  'Afrikaans',
] as const;

export const JUNIOR_GRADES = ['Grade 6', 'Grade 7', 'Grade 8', 'Grade 9'];
export const SENIOR_GRADES = ['Grade 10', 'Grade 11', 'Grade 12'];
export const ALL_GRADES = [...JUNIOR_GRADES, ...SENIOR_GRADES];

export function subjectsForGrade(grade: string) {
  if (JUNIOR_GRADES.includes(grade)) return [...SUBJECTS_JUNIOR];
  if (SENIOR_GRADES.includes(grade)) return [...SUBJECTS_SENIOR];
  return [];
}

export const ALL_OFFERED_SUBJECTS = [
  ...new Set([...SUBJECTS_JUNIOR, ...SUBJECTS_SENIOR]),
];
