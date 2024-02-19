import { InferInsertModel, InferSelectModel } from "drizzle-orm";
import {
  foreignKey,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const users = sqliteTable(
  "users",
  {
    id: integer("id").primaryKey({
      autoIncrement: true,
    }),
    email: text("email").notNull(),
    avatar: text("avatar"),
    name: text("name"),
  },
  (users) => ({
    emailIdx: uniqueIndex("emailIdx").on(users.email),
  })
);

export type User = InferSelectModel<typeof users>;
export type NewUser = InferInsertModel<typeof users>;

export const usersBanksRelations = sqliteTable(
  "users_banks_relations",
  {
    requisitionId: text("requisition_id").primaryKey().notNull(),
    userId: integer("user_id")
      .references(() => users.id)
      .notNull(),
    bankId: text("bank_id").notNull(),
  },
  (relations) => ({
    userBankIdx: uniqueIndex("userBankIdx").on(
      relations.userId,
      relations.bankId
    ),
  })
);

export type UserBankRelation = InferSelectModel<typeof usersBanksRelations>;
export type NewUserBankRelation = InferInsertModel<typeof usersBanksRelations>;
