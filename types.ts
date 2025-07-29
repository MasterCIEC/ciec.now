
import React from 'react';

export enum ViewKey {
  MainMenuView = 'MAIN_MENU_VIEW',
  ScheduleMeeting = 'SCHEDULE_MEETING',
  Participants = 'PARTICIPANTS',
  Companies = 'COMPANIES',
  Agenda = 'AGENDA',
  ManageMeetingCategories = 'MANAGE_MEETING_CATEGORIES',
  ManageEvents = 'MANAGE_EVENTS',
  ManageEventCategories = 'MANAGE_EVENT_CATEGORIES',
}

export interface MenuItem {
  id: string;
  name: string;
  icon: React.FC<React.SVGProps<SVGSVGElement>>;
  viewKey: ViewKey;
  description?: string;
}

export interface MeetingCategory {
  id: string;
  name: string;
}

export interface Company {
  id: string;
  name: string;
  rif: string;
  email: string;
  phone: string;
  address: string;
}

export type ParticipantAffiliationType = 'company' | 'external' | 'independent';

export interface Participant {
  id: string;
  name: string;
  affiliationType: ParticipantAffiliationType;
  companyId?: string | null;
  externalCompanyName?: string | null;
  role: string | null;
  email: string | null;
  phone?: string | null;
}

export interface Meeting {
  id:string;
  subject: string;
  meetingCategoryId: string;
  date: string;
  startTime: string | null;
  endTime?: string;
  location?: string | null;
  externalParticipantsCount?: number;
  description?: string | null;
}

export interface EventCategory {
  id: string;
  name: string;
}

export interface Event {
  id: string;
  subject: string;
  organizerType: 'meeting_category' | 'category'; 
  date: string;
  startTime: string;
  endTime?: string;
  location?: string | null;
  externalParticipantsCount?: number;
  description?: string | null;
  cost?: number;
  investment?: number;
  revenue?: number;
}

// New types for join tables
export interface ParticipantMeetingCategory {
  participant_id: string;
  meeting_category_id: string;
}

export interface MeetingAttendee {
  meeting_id: string;
  participant_id: string;
  attendance_type: 'in_person' | 'online';
}

export interface EventAttendee {
  event_id: string;
  participant_id: string;
  attendance_type: 'in_person' | 'online';
}

export interface EventOrganizingMeetingCategory {
  event_id: string;
  meeting_category_id: string;
}

export interface EventOrganizingCategory {
  event_id: string;
  category_id: string; 
}


// Props for UI components
export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
}

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  prefix?: string;
  containerClassName?: string;
}

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { value: string | number; label: string }[];
}

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}