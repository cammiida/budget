import { AppLoadContext } from "@remix-run/cloudflare";
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

  async addUserBankRelation(newRelation: NewUserBankRelation) {
    const user = await this.getUserById(newRelation.userId);

    if (!user) {
      throw new Error(`User with id ${newRelation.userId} not found`);
    }

    return this.db
      .insert(usersBanksRelations)
      .values(newRelation)
      .onConflictDoNothing()
      .returning()
      .get();
  }

  async getAllBanksForUser(userId: number): Promise<string[]> {
    const relations = await this.db
      .select()
      .from(usersBanksRelations)
      .where(eq(usersBanksRelations.userId, userId))
      .all();
    return relations.map((relation) => relation.bankId);
  }

  async removeBankForUser(userId: number, bankId: string) {
    return this.db
      .delete(usersBanksRelations)
      .where(
        and(
          eq(usersBanksRelations.userId, userId),
          eq(usersBanksRelations.bankId, bankId)
        )
      )
      .returning()
      .get();
  }

  async getBankRelation(userId: number, bankId: string) {
    return this.db
      .select()
      .from(usersBanksRelations)
      .where(
        and(
          eq(usersBanksRelations.userId, userId),
          eq(usersBanksRelations.bankId, bankId)
        )
      )
      .get();
  }
}
