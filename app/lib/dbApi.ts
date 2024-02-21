import { AppLoadContext, redirect } from "@remix-run/cloudflare";
import { and, eq } from "drizzle-orm";
import { DrizzleD1Database } from "drizzle-orm/d1";
import { getDbFromContext } from "./db.service.server";
import {
  NewUserBankRelation,
  User,
  users,
  usersBanksRelations,
} from "./schema";
import { ServerArgs } from "./types";
import { requireLogin } from "./auth.server";

export class DbApi {
  db: DrizzleD1Database;
  context: AppLoadContext;
  request: Request;

  private constructor({ context, request }: ServerArgs) {
    this.db = getDbFromContext(context);
    this.context = context;
    this.request = request;
  }

  static create(args: ServerArgs) {
    return new DbApi(args);
  }

  async getAllUsers(): Promise<User[]> {
    return this.db.select().from(users).all();
  }

  async getUserById(id: number): Promise<User | undefined> {
    return this.db.select().from(users).where(eq(users.id, id)).get();
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return this.db.select().from(users).where(eq(users.email, email)).get();
  }

  async getAllUserBankRelations() {
    return this.db.select().from(usersBanksRelations).all();
  }

  async addUserBankRelation(newRelation: Omit<NewUserBankRelation, "userId">) {
    const user = await this.requireUser();

    return this.db
      .insert(usersBanksRelations)
      .values({ ...newRelation, userId: user.id })
      .onConflictDoNothing()
      .returning()
      .get();
  }

  async getAllBanksForUser(): Promise<string[]> {
    const user = await this.requireUser();

    const relations = await this.db
      .select()
      .from(usersBanksRelations)
      .where(eq(usersBanksRelations.userId, user.id))
      .all();
    return relations.map((relation) => relation.bankId);
  }

  async removeBank(bankId: string) {
    const user = await this.requireUser();

    return this.db
      .delete(usersBanksRelations)
      .where(
        and(
          eq(usersBanksRelations.userId, user.id),
          eq(usersBanksRelations.bankId, bankId)
        )
      )
      .returning()
      .get();
  }

  async getBankRelation(bankId: string) {
    const user = await this.requireUser();

    return this.db
      .select()
      .from(usersBanksRelations)
      .where(
        and(
          eq(usersBanksRelations.userId, user.id),
          eq(usersBanksRelations.bankId, bankId)
        )
      )
      .get();
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
