// View-model types for contacts UI

export interface ContactItem {
  id: string;
  firstName: string | null;
  lastName: string | null;
  displayName: string;
  primaryPhone: string | null;
  secondaryPhone: string | null;
  email: string | null;
  companyName: string | null;
  notes: string | null;
  customInstructions: string | null;
  isFavorite: boolean;
  isBlocked: boolean;
  source: string;
  groups: ContactGroupTag[];
  createdAt: string;
}

export interface ContactGroupTag {
  id: string;
  name: string;
  emoji: string;
  color: string;
}

export interface ContactFormData {
  first_name: string;
  last_name: string;
  display_name: string;
  primary_phone_e164: string;
  secondary_phone_e164: string;
  email: string;
  company_name: string;
  notes: string;
  custom_instructions: string;
  is_favorite: boolean;
  is_blocked: boolean;
}
