import { AppLoadContext } from "@remix-run/cloudflare";
import { DbApi } from "../dbApi";
import { GoCardlessApi } from "../gocardless-api.server";
import { ServerArgs } from "../types";
import { getOrAddBank } from "./bank.server";

type GetOrCreateRequisitionParams = {
  bankId: string;
  context: AppLoadContext;
};

export async function getOrCreateRequisition({
  bankId,
  context,
}: GetOrCreateRequisitionParams) {
  const db = DbApi.create({ context });
  const goCardlessApi = GoCardlessApi.create({ context });

  const bank = await getOrAddBank({ bankId, context });

  let requisition =
    (await goCardlessApi.getRequisition({
      requisitionId: bank.requisitionId ?? "",
    })) ?? (await goCardlessApi.createRequisition(bankId));

  // If the requisition is expired, create a new one
  if (requisition.status === "EX") {
    requisition = await goCardlessApi.createRequisition(bankId);
  }

  db.updateBank(bankId, { requisitionId: requisition.id });

  return requisition;
}
