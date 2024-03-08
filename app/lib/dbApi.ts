import { AppLoadContext } from "@remix-run/cloudflare";
import { SQL, and, eq, inArray, sql } from "drizzle-orm";
import { DrizzleD1Database } from "drizzle-orm/d1";
import { getDbFromContext } from "./db.service.server";
import * as schema from "./schema";
import {
  Account,
  Bank,
  NewAccount,
  NewBank,
  NewCategory,
  NewTransaction,
  Transaction,
  User,
  account,
  bank as bankTable,
  category,
  transaction as transactionTable,
  user,
} from "./schema";

export class DbApi {
  db: DrizzleD1Database<typeof schema>;
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
        set: { ...bank, userId: user.id },
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

  async getAccountsForBanks(bankIds: string[]) {
    const user = this.getCurrentUser();

    return this.db
      .select()
      .from(account)
      .where(and(eq(account.userId, user.id), inArray(account.bankId, bankIds)))
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

  async getCategories() {
    const currentUser = this.getCurrentUser();

    return this.db
      .select()
      .from(category)
      .where(eq(category.userId, currentUser.id))
      .all();
  }

  async createCategory(data: Omit<NewCategory, "userId">) {
    const currentUser = this.getCurrentUser();

    return this.db
      .insert(category)
      .values({ ...data, userId: currentUser.id })
      .onConflictDoNothing()
      .returning()
      .get();
  }

  async deleteCategory(id: number) {
    const currentUser = this.getCurrentUser();

    return this.db
      .delete(category)
      .where(and(eq(category.id, id), eq(category.userId, currentUser.id)))
      .returning()
      .get();
  }

  async getTransactions() {
    const currentUser = this.getCurrentUser();

    return this.db.query.transaction.findMany({
      where: eq(transactionTable.userId, currentUser.id),
      with: { category: true, account: true },
    });
  }

  async saveTransactions(transactions: NewTransaction[]) {
    try {
      return await this.db
        .insert(transactionTable)
        .values(transactions)
        .onConflictDoUpdate({
          target: [
            transactionTable.transactionId,
            transactionTable.accountId,
            transactionTable.userId,
          ],
          set: {
            bankId: sql`excluded.bank_id`,
            categoryId: sql`excluded.category_id`,
            status: sql`excluded.status`,
            bookingDateTime: sql`excluded.booking_date_time`,
            valueDateTime: sql`excluded.value_date_time`,
            amount: sql`excluded.amount`,
            currency: sql`excluded.currency`,
            creditorName: sql`excluded.creditor_name`,
            debtorName: sql`excluded.debtor_name`,
          } satisfies Record<
            keyof Omit<Transaction, "transactionId" | "accountId" | "userId">,
            SQL<Transaction>
          >,
        })
        .returning();
    } catch (error) {
      console.error(error);
      throw new Response("Unable to save transactions", {
        status: 500,
        statusText: JSON.stringify(error),
      });
    }
  }
}
