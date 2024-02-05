import { AppLoadContext } from "@remix-run/cloudflare";
import { getDbFromContext } from "./db.service.server";
import { DrizzleD1Database } from "drizzle-orm/d1";
import {
  NewUserBankRelation,
  User,
  users,
  usersBanksRelations,
} from "./schema";
import { eq } from "drizzle-orm";

export class Api {
  db: DrizzleD1Database;

  private constructor(context: AppLoadContext) {
    this.db = getDbFromContext(context);
  }

  static create(context: AppLoadContext) {
    return new Api(context);
  }

  async getAllUsers(): Promise<User[]> {
    return this.db.select().from(users).all();
  }

  async getUserById(id: number): Promise<User> {
    return this.db.select().from(users).where(eq(users.id, id)).get();
  }

  async getUserByEmail(email: string): Promise<User> {
    return this.db.select().from(users).where(eq(users.email, email)).get();
  }

  async getAllUserBankRelations() {
    return this.db.select().from(usersBanksRelations).all();
  }

  async addUserBankRelation(newRelation: NewUserBankRelation) {
    const user = await this.getUserById(newRelation.userId);
    console.log({ foundUser: user });

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
}
