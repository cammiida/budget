type ObjectValues<T> = T[keyof T];

export const INTENTS = {
  sync: "sync",
  updateCategory: "updateCategory",
  updateSpendingType: "updateSpendingType",
  updateWantOrNeed: "updateWantOrNeed",
} as const;

export type Intent = keyof typeof INTENTS;

export const SPENDING_TYPES = {
  fixed: "Fixed",
  variable: "Variable",
} as const;

export type SpendingType = keyof typeof SPENDING_TYPES;
export type SpendingTypeName = ObjectValues<typeof SPENDING_TYPES>;

export const WANT_OR_NEED = {
  want: "Want",
  need: "Need",
} as const;

export type WantOrNeed = keyof typeof WANT_OR_NEED;
export type WantOrNeedName = ObjectValues<typeof WANT_OR_NEED>;
