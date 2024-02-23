import { AppLoadContext, redirect } from "@remix-run/cloudflare";
import { and, eq, sql } from "drizzle-orm";
import { DrizzleD1Database } from "drizzle-orm/d1";
import { requireLogin } from "./auth.server";
import { getDbFromContext } from "./db.service.server";
import { Bank, NewBank, User, account, bank, user } from "./schema";
import { ServerArgs } from "./types";

export class DbApi {
  db: DrizzleD1Database;
  context: AppLoadContext;
  request: Request;

  private constructor({ context, request }: ServerArgs) {
    this.db = getDbFromContext(context);
    this.context = context;
    this.request = request;
  }

  getCurrentUser() {
    const user = this.context.session;
    if (!user) {
      throw redirect("/auth/login");
    }
    return user;
  }

  static create(args: ServerArgs) {
    return new DbApi(args);
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
      .from(bank)
      .where(eq(bank.userId, user.id))
      .all();
  }

  async addBank(newBank: Omit<NewBank, "userId">) {
    const user = this.getCurrentUser();

    return this.db
      .insert(bank)
      .values({ ...newBank, userId: user.id })
      .onConflictDoNothing()
      .returning()
      .get();
  }

  async removeBank(bankId: string) {
    const user = this.getCurrentUser();

    return this.db
      .delete(bank)
      .where(and(eq(bank.userId, user.id), eq(bank.bankId, bankId)))
      .returning()
      .get();
  }

  async getBank(bankId: string) {
    const user = this.getCurrentUser();

    return this.db
      .select()
      .from(bank)
      .where(and(eq(bank.userId, user.id), eq(bank.bankId, bankId)))
      .get();
  }

  async getAllAccounts(bankId: string) {
    const user = this.getCurrentUser();

    return this.db
      .select()
      .from(account)
      .where(and(eq(account.userId, user.id), eq(account.bankId, bankId)))
      .all();
  }

  async requireUser() {
    const userSession = await requireLogin({
      request: this.request,
      context: this.context,
    });
    const user = await this.getUserByEmail(userSession.email);

    if (!user) {
      throw redirect("/auth/login");
    }

    return user;
  }
}
