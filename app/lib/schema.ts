import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { relations } from "drizzle-orm";
import {
  customType,
  foreignKey,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import type { BalanceSchema } from "generated-sources/gocardless";
import { z } from "zod";
import type { SpendingType, WantOrNeed } from "./constants";

export const users = sqliteTable(
  "Users",
  {
    id: integer("id").primaryKey({
      autoIncrement: true,
    }),
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
    bankId: text("bank_id").notNull(),
    userId: integer("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    name: text("name").notNull(),
    requisitionId: text("requisition_id"),
    logo: text("logo"),
    bic: text("bic"),
  },
  (bank) => ({
    pk: primaryKey({ columns: [bank.bankId, bank.userId] }),
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

export const accounts = sqliteTable(
  "Accounts",
  {
    accountId: text("account_id").notNull(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    bankId: text("bank_id").notNull(),
    bban: text("bban"),
    name: text("name").notNull(),
    ownerName: text("owner_name"),
    balances: text("balances", { mode: "json" })
      .$type<BalanceSchema[]>()
      .notNull(),
  },
  (account) => ({
    bankReference: foreignKey({
      columns: [account.userId, account.bankId],
      foreignColumns: [banks.userId, banks.bankId],
      name: "bankReference",
    }).onDelete("cascade"),
    pk: primaryKey({
      columns: [account.userId, account.bankId, account.accountId],
    }),
  }),
);

export type Account = InferSelectModel<typeof accounts>;
export type NewAccount = InferInsertModel<typeof accounts>;

export const accountRelations = relations(accounts, ({ one, many }) => ({
  bank: one(banks, {
    fields: [accounts.userId, accounts.bankId],
    references: [banks.userId, banks.bankId],
  }),
  user: one(users, {
    fields: [accounts.userId],
    references: [users.id],
  }),
  transactions: many(bankTransactions),
}));

export const categories = sqliteTable(
  "Categories",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    name: text("name").notNull(),
    color: text("color"),
    keywords: text("keywords", { mode: "json" }).$type<string[]>(),
    categoryGroupId: integer("category_group_id")
      .references(() => categoryGroups.id, { onDelete: "cascade" })
      .notNull(),
  },
  (category) => ({
    uniqueOne: uniqueIndex("unique_on").on(category.userId, category.name),
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
  userId: z.number().optional(),
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
    transactionId: text("transaction_id").notNull(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    bankId: text("bank_id").notNull(),
    accountId: text("account_id").notNull(),
    categoryId: integer("category_id").references(() => categories.id, {
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
    accountReference: foreignKey({
      columns: [transaction.userId, transaction.bankId, transaction.accountId],
      foreignColumns: [accounts.userId, accounts.bankId, accounts.accountId],
    }).onDelete("cascade"),
    pk: primaryKey({
      columns: [
        transaction.transactionId,
        transaction.accountId,
        transaction.userId,
      ],
    }),
  }),
);

export type Transaction = InferSelectModel<typeof bankTransactions>;
export type NewTransaction = InferInsertModel<typeof bankTransactions>;

export const transactionRelations = relations(bankTransactions, ({ one }) => ({
  bank: one(banks, {
    fields: [bankTransactions.userId, bankTransactions.bankId],
    references: [banks.userId, banks.bankId],
  }),
  account: one(accounts, {
    fields: [
      bankTransactions.userId,
      bankTransactions.bankId,
      bankTransactions.accountId,
    ],
    references: [accounts.userId, accounts.bankId, accounts.accountId],
  }),
  category: one(categories, {
    fields: [bankTransactions.categoryId, bankTransactions.userId],
    references: [categories.id, categories.userId],
  }),
  user: one(users, {
    fields: [bankTransactions.userId],
    references: [users.id],
  }),
}));

export const budgets = sqliteTable(
  "Budgets",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
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

export const categoryGroups = sqliteTable("CategoryGroups", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("userId")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  budgetId: integer("budgetId")
    .references(() => budgets.id, { onDelete: "cascade" })
    .notNull(),
  name: text("name").notNull(),
});

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
