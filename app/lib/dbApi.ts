import { AppLoadContext } from "@remix-run/cloudflare";
import { and, eq, sql } from "drizzle-orm";
import { DrizzleD1Database } from "drizzle-orm/d1";
import { getDbFromContext } from "./db.service.server";
import {
  Account,
  Bank,
  NewAccount,
  NewBank,
  User,
  account,
  bank as bankTable,
  user,
} from "./schema";
import { ServerArgs } from "./types";

export class DbApi {
  db: DrizzleD1Database;
  context: AppLoadContext;

  private constructor({ context }: { context: AppLoadContext }) {
    this.db = getDbFromContext(context);
    this.context = context;
  }

  static create({ context }: { context: AppLoadContext }) {
    return new DbApi({ context });
  }

  getCurrentUser() {
    const user = this.context.user;
    if (!user) {
      throw new Response("User not found", { status: 401 });
    }

    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return this.db.select().from(user).all();
  }

  async getUserById(id: number): Promise<User | undefined> {
    return this.db.select().from(user).where(eq(user.id, id)).get();
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return this.db.select().from(user).where(eq(user.email, email)).get();
  }

  async getBanks(): Promise<Bank[]> {
    const user = this.getCurrentUser();

    return await this.db
      .select()
      .from(bankTable)
      .where(eq(bankTable.userId, user.id))
      .all();
  }

  async addBank(bank: Omit<NewBank, "userId">): Promise<Bank> {
    const user = this.getCurrentUser();

    return this.db
      .insert(bankTable)
      .values({ ...bank, userId: user.id })
      .onConflictDoUpdate({
        target: [bankTable.userId, bankTable.bankId],
        set: bank,
      })
      .returning()
      .get();
  }

  async removeBank(bankId: string) {
    const user = this.getCurrentUser();

    return this.db
      .delete(bankTable)
      .where(and(eq(bankTable.userId, user.id), eq(bankTable.bankId, bankId)))
      .returning()
      .get();
  }

  async getBank(bankId: string) {
    const user = this.getCurrentUser();

    return this.db
      .select()
      .from(bankTable)
      .where(and(eq(bankTable.userId, user.id), eq(bankTable.bankId, bankId)))
      .get();
  }

  async updateBank(bankId: string, updates: Partial<Bank>) {
    const user = this.getCurrentUser();

    return this.db
      .update(bankTable)
      .set(updates)
      .where(and(eq(bankTable.userId, user.id), eq(bankTable.bankId, bankId)))
      .returning();
  }

  async getAllAccounts(bankId: string) {
    const user = this.getCurrentUser();

    return this.db
      .select()
      .from(account)
      .where(and(eq(account.userId, user.id), eq(account.bankId, bankId)))
      .all();
  }

  async saveAccounts(accounts: NewAccount[]): Promise<Account[]> {
    if (!accounts.length) {
      return [];
    }

    try {
      return await this.db
        .insert(account)
        .values(accounts)
        .onConflictDoUpdate({
          target: [account.userId, account.bankId, account.accountId],
          set: { balances: sql`excluded.balances` },
        })
        .returning();
    } catch (error) {
      console.error(error);
      throw new Response("Unable to save accounts", { status: 500 });
    }
  }
}
