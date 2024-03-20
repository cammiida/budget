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
    return this.db.select().from(schema.users).all();
  }

  async getUserById(id: number): Promise<User | undefined> {
    return this.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, id))
      .get();
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return this.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, email))
      .get();
  }

  async getBanks(): Promise<Bank[]> {
    const user = this.getCurrentUser();

    return await this.db
      .select()
      .from(schema.banks)
      .where(eq(schema.banks.userId, user.id))
      .all();
  }

  async addBank(bank: Omit<NewBank, "userId">): Promise<Bank> {
    const user = this.getCurrentUser();

    return this.db
      .insert(schema.banks)
      .values({ ...bank, userId: user.id })
      .onConflictDoUpdate({
        target: [schema.banks.userId, schema.banks.bankId],
        set: { ...bank, userId: user.id },
      })
      .returning()
      .get();
  }

  async removeBank(bankId: string) {
    const user = this.getCurrentUser();

    return this.db
      .delete(schema.banks)
      .where(
        and(eq(schema.banks.userId, user.id), eq(schema.banks.bankId, bankId)),
      )
      .returning()
      .get();
  }

  async getBank(bankId: string) {
    const user = this.getCurrentUser();

    return this.db
      .select()
      .from(schema.banks)
      .where(
        and(eq(schema.banks.userId, user.id), eq(schema.banks.bankId, bankId)),
      )
      .get();
  }

  async updateBank(bankId: string, updates: Partial<Bank>) {
    const user = this.getCurrentUser();

    return this.db
      .update(schema.banks)
      .set(updates)
      .where(
        and(eq(schema.banks.userId, user.id), eq(schema.banks.bankId, bankId)),
      )
      .returning();
  }

  async getAccountsForBanks(bankIds: string[]) {
    const user = this.getCurrentUser();

    return this.db
      .select()
      .from(schema.accounts)
      .where(
        and(
          eq(schema.accounts.userId, user.id),
          inArray(schema.accounts.bankId, bankIds),
        ),
      )
      .all();
  }

  async getAccounts() {
    const user = this.getCurrentUser();

    return this.db
      .select()
      .from(schema.accounts)
      .where(eq(schema.accounts.userId, user.id))
      .all();
  }

  async saveAccounts(accounts: NewAccount[]): Promise<Account[]> {
    if (!accounts.length) {
      return [];
    }

    try {
      return await this.db
        .insert(schema.accounts)
        .values(accounts)
        .onConflictDoUpdate({
          target: [
            schema.accounts.userId,
            schema.accounts.bankId,
            schema.accounts.accountId,
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
      .from(schema.categories)
      .where(eq(schema.categories.userId, currentUser.id))
      .all();
  }

  async createCategory(data: Omit<NewCategory, "userId">) {
    const currentUser = this.getCurrentUser();

    return this.db
      .insert(schema.categories)
      .values({ ...data, userId: currentUser.id })
      .onConflictDoNothing()
      .returning()
      .get();
  }

  async deleteCategory(id: number) {
    const currentUser = this.getCurrentUser();

    return this.db
      .delete(schema.categories)
      .where(
        and(
          eq(schema.categories.id, id),
          eq(schema.categories.userId, currentUser.id),
        ),
      )
      .returning()
      .get();
  }

  async getTransactions() {
    const currentUser = this.getCurrentUser();

    return this.db.query.bankTransactions.findMany({
      where: eq(schema.bankTransactions.userId, currentUser.id),
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
          .insert(schema.bankTransactions)
          .values(transactions.slice(start, end))
          .onConflictDoNothing({
            target: [
              schema.bankTransactions.transactionId,
              schema.bankTransactions.accountId,
              schema.bankTransactions.userId,
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
      .select({ date: schema.bankTransactions.bookingDate })
      .from(schema.bankTransactions)
      .where(eq(schema.bankTransactions.userId, currentUser.id))
      .orderBy(desc(schema.bankTransactions.bookingDate))
      .get();
  }

  async updateTransactionCategories(
    elements: { transactionId: string; categoryId: number | null }[],
  ) {
    const currentUser = this.getCurrentUser();
    return await Promise.all(
      elements.map((it) =>
        this.db
          .update(schema.bankTransactions)
          .set({ categoryId: it.categoryId })
          .where(
            and(
              eq(schema.bankTransactions.transactionId, it.transactionId),
              eq(schema.bankTransactions.userId, currentUser.id),
            ),
          )
          .returning()
          .get(),
      ),
    );
  }
}
