import { InferInsertModel, InferSelectModel } from "drizzle-orm";
import {
  blob,
  foreignKey,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { BalanceSchema } from "generated-sources/gocardless";

export const user = sqliteTable(
  "user",
  {
    id: integer("id").primaryKey({
      autoIncrement: true,
    }),
    email: text("email").notNull(),
    avatar: text("avatar"),
    name: text("name"),
  },
  (user) => ({
    emailIdx: uniqueIndex("emailIdx").on(user.email),
  })
);

export type User = InferSelectModel<typeof user>;
export type NewUser = InferInsertModel<typeof user>;

export const bank = sqliteTable(
  "bank",
  {
    requisitionId: text("requisition_id"),
    userId: integer("user_id")
      .references(() => user.id)
      .notNull(),
    bankId: text("bank_id").notNull(),
    name: text("name").notNull(),
    logo: text("logo"),
    bic: text("bic"),
  },
  (bank) => ({
    id: primaryKey({
      columns: [bank.userId, bank.bankId],
    }),
  })
);

export type Bank = InferSelectModel<typeof bank>;
export type NewBank = InferInsertModel<typeof bank>;

export const account = sqliteTable(
  "account",
  {
    accountId: text("account_id").notNull(),
    userId: integer("user_id").notNull(),
    bankId: text("bank_id").notNull(),
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
    }),
    id: primaryKey({
      columns: [account.userId, account.bankId, account.accountId],
    }),
  })
);

export type Account = InferSelectModel<typeof account>;
export type NewAccount = InferInsertModel<typeof account>;
