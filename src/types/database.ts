export type Profile = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  created_at: string;
  updated_at: string;
};

export type TransactionType = "expense" | "income";

export type Transaction = {
  id: string;
  user_id: string;
  type: TransactionType;
  date: string;
  amount: number;
  currency: string;
  merchant: string;
  category: string | null;
  notes: string | null;
  receipt_url: string | null;
  group_id: string | null;
  created_at: string;
  updated_at: string;
};

export type Category = {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
};

export type GroupRole = "owner" | "member";

export type Group = {
  id: string;
  name: string;
  invite_code: string;
  created_by: string;
  is_personal: boolean;
  created_at: string;
};

export type GroupMember = {
  id: string;
  group_id: string;
  user_id: string;
  role: GroupRole;
  joined_at: string;
};

export type GroupBudget = {
  id: string;
  group_id: string;
  category: string;
  amount_limit: number;
  currency: string;
  month: number;
  year: number;
  created_at: string;
};
