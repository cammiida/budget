import { AppLoadContext, DataFunctionArgs } from "@remix-run/cloudflare";
import { getDbFromContext } from "./db.service.server";
import { DrizzleD1Database } from "drizzle-orm/d1";
import {
  NewUserBankRelation,
  User,
  users,
  usersBanksRelations,
} from "./schema";
import { and, eq } from "drizzle-orm";
import { GoCardlessApi } from "./gocardless-api.server";
import { z } from "zod";

export class DbApi {
  db: DrizzleD1Database;
  context: DataFunctionArgs["context"];
  request: DataFunctionArgs["request"];

  private constructor({
    context,
    request,
  }: Pick<DataFunctionArgs, "context" | "request">) {
    this.db = getDbFromContext(context);
    this.context = context;
    this.request = request;
  }

  static create(args: Pick<DataFunctionArgs, "context" | "request">) {
    return new DbApi(args);
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

  async getRequisition(institutionId: string) {
    const goCardlessApi = await GoCardlessApi.create({
      context: this.context,
      request: this.request,
    });
    const goCardlessSession = await goCardlessApi.authorize();

    const response = await fetch(
      "https://bankaccountdata.gocardless.com/api/v2/requisitions/",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${goCardlessSession.data.goCardless?.access}`,
        },
        body: JSON.stringify({
          redirect: "http://172.24.134.19:8788/api/authenticate-bank",
          institution_id: institutionId,
        }),
      }
    )
      .then((res) => res.json())
      .then((res) => requisitionSchema.parse(res));

    return response;
  }
}

export const requisitionSchema = z.object({ id: z.string(), link: z.string() });
export type Requisition = z.infer<typeof requisitionSchema>;
