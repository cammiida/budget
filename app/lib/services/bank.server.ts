import { AppLoadContext, redirect } from "@remix-run/cloudflare";
import { DbApi } from "../dbApi";
import { GoCardlessApi } from "../gocardless-api.server";

type GetOrAddBankParams = {
  bankId: string;
  context: AppLoadContext;
};

export async function getOrAddBank({ bankId, context }: GetOrAddBankParams) {
  const db = DbApi.create({ context });
  const goCardlessApi = GoCardlessApi.create({ context });
  const user = context.user;
  if (!user) {
    throw redirect("/auth/login");
  }

  const savedBank =
    (await db.getBank(bankId)) ?? (await goCardlessApi.getBank({ bankId }));

  if (!savedBank) {
    throw new Response("Bank not found", { status: 404 });
  }

  await db.addBank(savedBank);

  return savedBank;
}
