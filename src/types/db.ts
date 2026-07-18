// Auto-maintained DB row types — keep in sync with Supabase schema
// Run: supabase gen types typescript --project-id <id> > src/types/db.ts to regenerate

export type Role = 'guardian' | 'learner' | 'tutor' | 'admin';
export type GradeBand = 'junior' | 'senior' | 'all';
export type ClassStatus = 'scheduled' | 'live' | 'completed' | 'cancelled';
export type MaterialType = 'pdf' | 'video' | 'worksheet' | 'notes' | 'exam_paper';
export type Difficulty = 'easy' | 'medium' | 'hard';
export type ProgressStatus = 'new' | 'in_progress' | 'done';
export type AttemptStatus = 'in_progress' | 'completed' | 'abandoned';
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded' | 'overdue' | 'waived';
export type PaymentType = 'tuition' | 'assessment' | 'registration' | 'material' | 'other';
export type PaymentMethod = 'eft' | 'card' | 'cash' | 'payfast' | 'ozow' | 'snapscan';
export type NotificationType = 'class_reminder' | 'payment_due' | 'new_material' | 'quiz_available' | 'announcement' | 'general';
export type AnnouncementType = 'general' | 'event' | 'urgent' | 'payment' | 'exam';
export type ApplicationStatus = 'pending' | 'reviewing' | 'approved' | 'rejected';
export type QuestionType = 'multiple_choice' | 'true_false' | 'short_answer';

export interface Profile {
  id: string;
  role: Role;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  bio: string | null;
  subjects: string[] | null;
  grades: string[] | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Learner {
  id: string;
  profile_id: string | null;
  guardian_id: string;
  full_name: string;
  date_of_birth: string | null;
  grade: string;
  school_name: string | null;
  id_number: string | null;
  medical_notes: string | null;
  is_active: boolean;
  enrolled_at: string;
  created_at: string;
  updated_at: string;
}

export interface Subject {
  id: string;
  name: string;
  code: string | null;
  grade_band: GradeBand;
  description: string | null;
  icon_name: string | null;
  is_active: boolean;
  created_at: string;
}

export interface Class {
  id: string;
  tutor_id: string | null;
  subject_id: string | null;
  title: string;
  description: string | null;
  grade: string;
  grade_band: GradeBand | null;
  room: string;
  scheduled_at: string | null;
  duration_minutes: number;
  max_learners: number | null;
  live: boolean;
  status: ClassStatus;
  recording_url: string | null;
  thumbnail_url: string | null;
  tags: string[];
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // joined fields
  tutor?: Pick<Profile, 'id' | 'full_name' | 'avatar_url'>;
  subject?: Pick<Subject, 'id' | 'name' | 'icon_name'>;
}

export interface ClassEnrolment {
  id: string;
  class_id: string;
  learner_id: string;
  attended: boolean;
  joined_at: string | null;
  enrolled_at: string;
}

export interface EnrolmentApplication {
  id: string;
  email: string;
  guardian_name: string;
  guardian_phone: string;
  guardian_email: string;
  learner_name: string;
  learner_dob: string;
  grade: string;
  subjects: string[];
  birth_cert_url: string | null;
  school_report_url: string | null;
  additional_file_url: string | null;
  popia_consent: boolean;
  status: ApplicationStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  admin_notes: string | null;
  guardian_profile_id: string | null;
  learner_id: string | null;
  submitted_at: string;
  updated_at: string;
}

export interface Material {
  id: string;
  subject_id: string | null;
  created_by: string | null;
  title: string;
  description: string | null;
  grade: string;
  grade_band: GradeBand | null;
  type: MaterialType;
  pages: number;
  file_url: string | null;
  thumbnail_url: string | null;
  external_url: string | null;
  is_published: boolean;
  tags: string[];
  view_count: number;
  created_at: string;
  updated_at: string;
  // joined
  subject?: Pick<Subject, 'id' | 'name' | 'icon_name'>;
}

export interface Quiz {
  id: string;
  subject_id: string | null;
  created_by: string | null;
  title: string;
  description: string | null;
  grade: string;
  grade_band: GradeBand | null;
  questions: number;
  duration_minutes: number;
  pass_score: number;
  difficulty: Difficulty;
  is_published: boolean;
  tags: string[];
  attempt_count: number;
  created_at: string;
  updated_at: string;
  // joined
  subject?: Pick<Subject, 'id' | 'name' | 'icon_name'>;
}

export interface QuizQuestion {
  id: string;
  quiz_id: string;
  question_text: string;
  type: QuestionType;
  options: { label: string; text: string }[] | null;
  correct_answer: string;
  explanation: string | null;
  marks: number;
  sort_order: number;
  created_at: string;
}

export interface UserMaterialProgress {
  id: string;
  profile_id: string;
  material_id: string;
  status: ProgressStatus;
  last_page: number;
  updated_at: string;
}

export interface QuizAttempt {
  id: string;
  profile_id: string;
  quiz_id: string;
  score: number | null;
  passed: boolean | null;
  status: AttemptStatus;
  answers: Record<string, string> | null;
  started_at: string;
  completed_at: string | null;
}

export interface Payment {
  id: string;
  learner_id: string;
  guardian_id: string;
  amount: number;
  currency: string;
  type: PaymentType;
  status: PaymentStatus;
  due_date: string | null;
  paid_at: string | null;
  payment_method: PaymentMethod | null;
  gateway_reference: string | null;
  gateway_payload: Record<string, unknown> | null;
  description: string | null;
  invoice_url: string | null;
  period_month: string | null;
  created_at: string;
  updated_at: string;
}

export interface PaymentPlan {
  id: string;
  learner_id: string;
  guardian_id: string;
  monthly_amount: number;
  billing_day: number;
  start_date: string;
  end_date: string | null;
  is_active: boolean;
  discount_percent: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Announcement {
  id: string;
  created_by: string | null;
  title: string;
  body: string;
  type: AnnouncementType;
  date_label: string | null;
  cta_label: string;
  cta_route: string;
  live_subject: string | null;
  live_time: string | null;
  live_grade: string | null;
  target_grade: string | null;
  target_role: string | null;
  active: boolean;
  published_at: string;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export type MessageSenderRole = 'learner' | 'tutor' | 'admin';

export interface ChatRoom {
  id: string;
  subject_id: string;
  grade: string;
  created_at: string;
  subject?: Pick<Subject, 'id' | 'name' | 'icon_name'>;
}

export interface ChatRoomMessage {
  id: string;
  chat_room_id: string;
  sender_id: string;
  sender_role: MessageSenderRole;
  content: string;
  created_at: string;
  sender?: Pick<Profile, 'id' | 'full_name' | 'avatar_url'>;
}

export interface ChatRoomRead {
  chat_room_id: string;
  profile_id: string;
  last_read_at: string;
}

export interface Notification {
  id: string;
  profile_id: string;
  title: string;
  body: string;
  type: NotificationType;
  read: boolean;
  data: Record<string, unknown> | null;
  created_at: string;
}
