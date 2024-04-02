import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { relations } from "drizzle-orm";
import {
  customType,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import type { SpendingType, WantOrNeed } from "./constants";

export const users = sqliteTable(
  "Users",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => uuidv4()),
    email: text("email").notNull(),
    name: text("name"),
  },
  (user) => ({
    emailIdx: uniqueIndex("emailIdx").on(user.email),
  }),
);

export type User = InferSelectModel<typeof users>;
export type NewUser = InferInsertModel<typeof users>;

export const userRelations = relations(users, ({ many }) => ({
  banks: many(banks),
  accounts: many(accounts),
  categories: many(categories),
  transactions: many(bankTransactions),
}));

export const banks = sqliteTable(
  "Banks",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => uuidv4()),
    externalBankId: text("bank_id").notNull(),
    userId: text("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    name: text("name").notNull(),
    requisitionId: text("requisition_id"),
    logo: text("logo"),
    bic: text("bic"),
  },
  (bank) => ({
    uniqueExternalBank: uniqueIndex("unique_on").on(
      bank.userId,
      bank.externalBankId,
    ),
    uniqueName: uniqueIndex("unique_name").on(bank.userId, bank.name),
  }),
);

export type Bank = InferSelectModel<typeof banks>;
export type NewBank = InferInsertModel<typeof banks>;

export const bankRelations = relations(banks, ({ one, many }) => ({
  user: one(users, {
    fields: [banks.userId],
    references: [users.id],
  }),
  accounts: many(accounts),
  transactions: many(bankTransactions),
}));

type Balance = {
  amount: string;
  currency: string;
};

export const accounts = sqliteTable(
  "Accounts",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => uuidv4()),
    externalAccountId: text("account_id"),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    bankId: text("bank_id")
      .notNull()
      .references(() => banks.id, { onDelete: "cascade" }),
    bban: text("bban"),
    name: text("name").notNull(),
    ownerName: text("owner_name"),
    interimAvailableBalance: text("interim_available_balance", {
      mode: "json",
    }).$type<Balance>(),
    openingBookedBalance: text("opening_booked_balance", {
      mode: "json",
    }).$type<Balance>(),
    expectedBalance: text("expected_balance", {
      mode: "json",
    }).$type<Balance>(),
  },
  (account) => ({
    uniqueName: uniqueIndex("unique_name").on(account.userId, account.name),
    uniqueExternalId: uniqueIndex("unique_external_id").on(
      account.userId,
      account.externalAccountId,
    ),
  }),
);

export type Account = InferSelectModel<typeof accounts>;
export type NewAccount = InferInsertModel<typeof accounts>;

// type AccountColumnName =
//   | "id"
//   | "externalAccountId"
//   | "userId"
//   | "bankId"
//   | "bban"
//   | "name"
//   | "ownerName"
//   | "interimAvailableBalance"
//   | "expectedBalance";

// const accountColumns: Record<AccountColumnName, SQLiteColumnBuilderBase> = {
//   id: text("id")
//     .primaryKey()
//     .$defaultFn(() => uuidv4()),
//   externalAccountId: text("account_id"),
//   userId: text("user_id")
//     .notNull()
//     .references(() => users.id, { onDelete: "cascade" }),
//   bankId: text("bank_id")
//     .notNull()
//     .references(() => banks.id, { onDelete: "cascade" }),
//   bban: text("bban"),
//   name: text("name").notNull(),
//   ownerName: text("owner_name"),
//   interimAvailableBalance: text("interim_available_balance", {
//     mode: "json",
//   }).$type<Balance>(),
//   expectedBalance: text("expected_balance", {
//     mode: "json",
//   }).$type<Balance>(),
// };

// const accountExtraConfig: <
//   TTableName extends string,
//   TColumnsMap extends typeof accountColumns,
// >(
//   self: BuildColumns<TTableName, TColumnsMap, "sqlite">,
// ) => SQLiteTableExtraConfig = (account) => ({
//   uniqueName: uniqueIndex("unique_name").on(account.userId, account.name),
//   uniqueExternalId: uniqueIndex("unique_external_id").on(
//     account.userId,
//     account.externalAccountId,
//   ),
// });

// export const debitAccounts = sqliteTable(
//   "DebitAccounts",
//   {
//     ...accountColumns,
//     openingBookedBalance: text("opening_booked_balance", {
//       mode: "json",
//     }).$type<Balance>(),
//   },
//   accountExtraConfig,
// );

// export const creditAccounts = sqliteTable(
//   "CreditAccounts",
//   {
//     ...accountColumns,
//     nonInvoicedBalance: text("non_invoiced_balance", {
//       mode: "json",
//     }).$type<Balance>(),
//   },
//   accountExtraConfig,
// );

// export const accountRelations = (
//   accounts: typeof debitAccounts | typeof creditAccounts,
// ) =>
//   relations(accounts, ({ one, many }) => ({
//     bank: one(banks, {
//       fields: [debitAccounts.userId, debitAccounts.bankId],
//       references: [banks.userId, banks.id],
//     }),
//     user: one(users, {
//       fields: [debitAccounts.userId],
//       references: [users.id],
//     }),
//     // transactions: many(bankTransactions),
//   }));

// export const debitAccountRelations = accountRelations(debitAccounts);
// export const creditAccountRelations = accountRelations(creditAccounts);

export const accountRelations = relations(accounts, ({ one }) => ({
  bank: one(banks, {
    fields: [accounts.userId, accounts.bankId],
    references: [banks.userId, banks.id],
  }),
  user: one(users, {
    fields: [accounts.userId],
    references: [users.id],
  }),
}));

export const budgets = sqliteTable(
  "Budgets",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => uuidv4()),
    userId: text("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    name: text("name").notNull(),
  },
  (budget) => ({
    uniqueOn: uniqueIndex("unique_on").on(budget.userId, budget.name),
  }),
);

export const budgetRelations = relations(budgets, ({ one, many }) => ({
  user: one(users, {
    fields: [budgets.userId],
    references: [users.id],
  }),
  categoryGroups: many(categoryGroups),
}));

export const categoryGroups = sqliteTable(
  "CategoryGroups",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => uuidv4()),
    userId: text("userId")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    budgetId: text("budgetId")
      .references(() => budgets.id, { onDelete: "cascade" })
      .notNull(),
    name: text("name").notNull(),
  },
  (categoryGroup) => ({
    uniqueName: uniqueIndex("unique_on").on(
      categoryGroup.userId,
      categoryGroup.name,
    ),
  }),
);

export const categoryGroupRelations = relations(
  categoryGroups,
  ({ one, many }) => ({
    budget: one(budgets, {
      fields: [categoryGroups.budgetId],
      references: [budgets.id],
    }),
    categories: many(categories),
  }),
);

export const categories = sqliteTable(
  "Categories",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => uuidv4()),
    userId: text("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    categoryGroupId: text("category_group_id")
      .references(() => categoryGroups.id, { onDelete: "cascade" })
      .notNull(),
    name: text("name").notNull(),
    color: text("color"),
    keywords: text("keywords", { mode: "json" }).$type<string[]>(),
  },
  (category) => ({
    uniqueName: uniqueIndex("unique_on").on(category.userId, category.name),
  }),
);

export type Category = InferSelectModel<typeof categories>;
export type NewCategory = InferInsertModel<typeof categories>;

export const categoryRelations = relations(categories, ({ one, many }) => ({
  user: one(users, {
    fields: [categories.userId],
    references: [users.id],
  }),
  categoryGroup: one(categoryGroups, {
    fields: [categories.categoryGroupId],
    references: [categoryGroups.id],
  }),
  transactions: many(bankTransactions),
}));

export const createCategory = createInsertSchema(categories, {
  userId: z.string().optional(),
  keywords: z
    .string()
    .transform((arg) => arg.split(","))
    .or(z.array(z.string()))
    .optional(),
});

const timestamp = customType<{
  data: Date;
  driverData: string;
}>({
  dataType() {
    return "timestamp";
  },
  fromDriver(value: string): Date {
    return new Date(value);
  },
  toDriver(value: Date): string {
    return value.toISOString();
  },
});

export const bankTransactions = sqliteTable(
  "BankTransactions",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => uuidv4()),
    externalTransactionId: text("transaction_id"),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accountId: text("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    categoryId: text("category_id").references(() => categories.id, {
      onDelete: "set null",
    }),
    status: text("status").$type<"booked" | "pending">().notNull(),
    bookingDate: timestamp("booking_date"),
    valueDate: timestamp("value_date"),

    amount: text("amount").notNull(),
    currency: text("currency").notNull(),
    exchangeRate: text("exchange_rate"),

    creditorName: text("creditor_name"),
    creditorBban: text("creditor_bban"),

    debtorName: text("debtor_name"),
    debtorBban: text("debtor_bban"),

    additionalInformation: text("additional_information"),
    spendingType: text("spending_type").$type<SpendingType>(),
    wantOrNeed: text("want_or_need").$type<WantOrNeed>(),
  },
  (transaction) => ({
    uniqueExternalId: uniqueIndex("unique_external_id").on(
      transaction.userId,
      transaction.externalTransactionId,
    ),
  }),
);

export type Transaction = InferSelectModel<typeof bankTransactions>;
export type NewTransaction = InferInsertModel<typeof bankTransactions>;

export const transactionRelations = relations(bankTransactions, ({ one }) => ({
  account: one(accounts, {
    fields: [bankTransactions.accountId],
    references: [accounts.id],
  }),
  category: one(categories, {
    fields: [bankTransactions.categoryId],
    references: [categories.id],
  }),
  user: one(users, {
    fields: [bankTransactions.userId],
    references: [users.id],
  }),
}));
