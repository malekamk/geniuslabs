export type ClassItem = {
  id: string;
  title: string;
  subject: string;
  grade: string;
  tutor: string;
  time: string;           // display string derived from scheduled_at
  room: string;
  live: boolean;
  isPast: boolean;        // scheduled_at + 2 hrs has passed
  scheduled_at: string | null;
};

export const classes: ClassItem[] = [];
