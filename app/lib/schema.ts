import { InferInsertModel, InferSelectModel, relations } from "drizzle-orm";
import {
  foreignKey,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { BalanceSchema } from "generated-sources/gocardless";

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
  })
);

export const userRelations = relations(user, ({ many }) => ({
  banks: many(bank),
  accounts: many(account),
  categories: many(category),
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
  })
);

export const bankRelations = relations(bank, ({ one, many }) => ({
  user: one(user, {
    fields: [bank.userId],
    references: [user.id],
  }),
  accounts: many(account),
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
  })
);

export const accountRelations = relations(account, ({ one }) => ({
  bank: one(bank, {
    fields: [account.userId, account.bankId],
    references: [bank.userId, bank.bankId],
  }),
  user: one(user, {
    fields: [account.userId],
    references: [user.id],
  }),
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
  },
  (category) => ({
    uniqueOne: uniqueIndex("unique_on").on(category.userId, category.name),
  })
);

export const categoryRelations = relations(category, ({ one }) => ({
  user: one(user, {
    fields: [category.userId],
    references: [user.id],
  }),
}));

export type Category = InferSelectModel<typeof category>;
export type NewCategory = InferInsertModel<typeof category>;

export const createCategory = createInsertSchema(category);
