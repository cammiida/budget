import { InferInsertModel, InferSelectModel, relations } from "drizzle-orm";
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
import { BalanceSchema } from "generated-sources/gocardless";
import { z } from "zod";

export const user = sqliteTable(
  "user",
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

export const userRelations = relations(user, ({ many }) => ({
  banks: many(bank),
  accounts: many(account),
  categories: many(category),
  transactions: many(transaction),
}));

export type User = InferSelectModel<typeof user>;
export type NewUser = InferInsertModel<typeof user>;

export const bank = sqliteTable(
  "bank",
  {
    bankId: text("bank_id").notNull(),
    userId: integer("user_id")
      .references(() => user.id, { onDelete: "cascade" })
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

export const bankRelations = relations(bank, ({ one, many }) => ({
  user: one(user, {
    fields: [bank.userId],
    references: [user.id],
  }),
  accounts: many(account),
  transactions: many(transaction),
}));

export type Bank = InferSelectModel<typeof bank>;
export type NewBank = InferInsertModel<typeof bank>;

export const account = sqliteTable(
  "account",
  {
    accountId: text("account_id").notNull(),
    userId: integer("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
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
      foreignColumns: [bank.userId, bank.bankId],
      name: "bankReference",
    }).onDelete("cascade"),
    pk: primaryKey({
      columns: [account.userId, account.bankId, account.accountId],
    }),
  }),
);

export const accountRelations = relations(account, ({ one, many }) => ({
  bank: one(bank, {
    fields: [account.userId, account.bankId],
    references: [bank.userId, bank.bankId],
  }),
  user: one(user, {
    fields: [account.userId],
    references: [user.id],
  }),
  transactions: many(transaction),
}));

export type Account = InferSelectModel<typeof account>;
export type NewAccount = InferInsertModel<typeof account>;

export const category = sqliteTable(
  "category",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .references(() => user.id, { onDelete: "cascade" })
      .notNull(),
    name: text("name").notNull(),
    color: text("color"),
    keywords: text("keywords", { mode: "json" }).$type<string[]>(),
  },
  (category) => ({
    uniqueOne: uniqueIndex("unique_on").on(category.userId, category.name),
  }),
);

export const categoryRelations = relations(category, ({ one, many }) => ({
  user: one(user, {
    fields: [category.userId],
    references: [user.id],
  }),
  transactions: many(transaction),
}));

export type Category = InferSelectModel<typeof category>;
export type NewCategory = InferInsertModel<typeof category>;

export const createCategory = createInsertSchema(category, {
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

export const transaction = sqliteTable(
  "transaction",
  {
    transactionId: text("transaction_id").notNull(),
    userId: integer("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    bankId: text("bank_id").notNull(),
    accountId: text("account_id").notNull(),
    categoryId: integer("category_id").references(() => category.id, {
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
  },
  (transaction) => ({
    accountReference: foreignKey({
      columns: [transaction.userId, transaction.bankId, transaction.accountId],
      foreignColumns: [account.userId, account.bankId, account.accountId],
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

export const transactionRelations = relations(transaction, ({ one }) => ({
  bank: one(bank, {
    fields: [transaction.userId, transaction.bankId],
    references: [bank.userId, bank.bankId],
  }),
  account: one(account, {
    fields: [transaction.userId, transaction.bankId, transaction.accountId],
    references: [account.userId, account.bankId, account.accountId],
  }),
  category: one(category, {
    fields: [transaction.categoryId, transaction.userId],
    references: [category.id, category.userId],
  }),
  user: one(user, {
    fields: [transaction.userId],
    references: [user.id],
  }),
}));

export type Transaction = InferSelectModel<typeof transaction>;
export type NewTransaction = InferInsertModel<typeof transaction>;
