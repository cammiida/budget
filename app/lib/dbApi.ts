import type { AppLoadContext } from "@remix-run/cloudflare";
import type { SQL } from "drizzle-orm";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { getDbFromContext } from "./db.service.server";
import type {
  Account,
  Bank,
  NewAccount,
  NewBank,
  NewCategory,
  NewTransaction,
  Transaction,
  User,
} from "./schema";
import * as schema from "./schema";

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
    return this.db.select().from(schema.user).all();
  }

  async getUserById(id: number): Promise<User | undefined> {
    return this.db
      .select()
      .from(schema.user)
      .where(eq(schema.user.id, id))
      .get();
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return this.db
      .select()
      .from(schema.user)
      .where(eq(schema.user.email, email))
      .get();
  }

  async getBanks(): Promise<Bank[]> {
    const user = this.getCurrentUser();

    return await this.db
      .select()
      .from(schema.bank)
      .where(eq(schema.bank.userId, user.id))
      .all();
  }

  async addBank(bank: Omit<NewBank, "userId">): Promise<Bank> {
    const user = this.getCurrentUser();

    return this.db
      .insert(schema.bank)
      .values({ ...bank, userId: user.id })
      .onConflictDoUpdate({
        target: [schema.bank.userId, schema.bank.bankId],
        set: { ...bank, userId: user.id },
      })
      .returning()
      .get();
  }

  async removeBank(bankId: string) {
    const user = this.getCurrentUser();

    return this.db
      .delete(schema.bank)
      .where(
        and(eq(schema.bank.userId, user.id), eq(schema.bank.bankId, bankId)),
      )
      .returning()
      .get();
  }

  async getBank(bankId: string) {
    const user = this.getCurrentUser();

    return this.db
      .select()
      .from(schema.bank)
      .where(
        and(eq(schema.bank.userId, user.id), eq(schema.bank.bankId, bankId)),
      )
      .get();
  }

  async updateBank(bankId: string, updates: Partial<Bank>) {
    const user = this.getCurrentUser();

    return this.db
      .update(schema.bank)
      .set(updates)
      .where(
        and(eq(schema.bank.userId, user.id), eq(schema.bank.bankId, bankId)),
      )
      .returning();
  }

  async getAccountsForBanks(bankIds: string[]) {
    const user = this.getCurrentUser();

    return this.db
      .select()
      .from(schema.account)
      .where(
        and(
          eq(schema.account.userId, user.id),
          inArray(schema.account.bankId, bankIds),
        ),
      )
      .all();
  }

  async getAccounts() {
    const user = this.getCurrentUser();

    return this.db
      .select()
      .from(schema.account)
      .where(eq(schema.account.userId, user.id))
      .all();
  }

  async saveAccounts(accounts: NewAccount[]): Promise<Account[]> {
    if (!accounts.length) {
      return [];
    }

    try {
      return await this.db
        .insert(schema.account)
        .values(accounts)
        .onConflictDoUpdate({
          target: [
            schema.account.userId,
            schema.account.bankId,
            schema.account.accountId,
          ],
          set: {
            balances: sql`excluded.balances`,
            bban: sql`excluded.bban`,
            name: sql`excluded.name`,
            ownerName: sql`excluded.owner_name`,
          } satisfies Record<
            keyof Omit<Account, "userId" | "bankId" | "accountId">,
            SQL<Transaction>
          >,
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
      .from(schema.category)
      .where(eq(schema.category.userId, currentUser.id))
      .all();
  }

  async createCategory(data: Omit<NewCategory, "userId">) {
    const currentUser = this.getCurrentUser();

    return this.db
      .insert(schema.category)
      .values({ ...data, userId: currentUser.id })
      .onConflictDoNothing()
      .returning()
      .get();
  }

  async deleteCategory(id: number) {
    const currentUser = this.getCurrentUser();

    return this.db
      .delete(schema.category)
      .where(
        and(
          eq(schema.category.id, id),
          eq(schema.category.userId, currentUser.id),
        ),
      )
      .returning()
      .get();
  }

  async getTransactions() {
    const currentUser = this.getCurrentUser();

    return this.db.query.transaction.findMany({
      where: eq(schema.transaction.userId, currentUser.id),
      with: { category: true, account: true },
    });
  }

  async saveTransactions(
    transactions: NewTransaction[],
  ): Promise<Transaction[]> {
    let savedTransactions: Transaction[] = [];
    const limit = 5;

    for (let start = 0; start < transactions.length; start += limit) {
      const end =
        start + limit > transactions.length
          ? transactions.length
          : start + limit;

      try {
        const slicedResults = await this.db
          .insert(schema.transaction)
          .values(transactions.slice(start, end))
          .onConflictDoNothing({
            target: [
              schema.transaction.transactionId,
              schema.transaction.accountId,
              schema.transaction.userId,
            ],
          })
          .returning();
        savedTransactions = [...savedTransactions, ...slicedResults];
      } catch (error) {
        console.error(error);
        throw new Response("Unable to save transactions", {
          status: 500,
          statusText: JSON.stringify(error),
        });
      }
    }
    return savedTransactions;
  }

  async getLatestTransactionDate() {
    const currentUser = this.getCurrentUser();

    return this.db
      .select({ date: schema.transaction.bookingDate })
      .from(schema.transaction)
      .where(eq(schema.transaction.userId, currentUser.id))
      .orderBy(desc(schema.transaction.bookingDate))
      .get();
  }
}
