import type { InferModel } from "drizzle-orm";
import {
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

export type User = InferModel<typeof users>;
export type NewUser = InferModel<typeof users, "insert">;
