import { redirect, type ActionFunctionArgs } from "@remix-run/cloudflare";
import { route } from "routes-gen";
import { DbApi } from "~/lib/dbApi";
import { GoCardlessApi } from "~/lib/gocardless-api.server";

export async function action({ context, request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const bankId = formData.get("bankId")?.toString();

  if (!bankId) {
    throw new Response("Bank ID is required", { status: 400 });
  }

  const dbApi = DbApi.create({ context });
  try {
    // get or add bank
    const bank = await dbApi.getBank(bankId);

    // get existing requisition
    const goCardlessApi = GoCardlessApi.create({ context });
    const existingRequistion = bank?.requisitionId
      ? await goCardlessApi.getRequisition({
          requisitionId: bank.requisitionId,
        })
      : null;

    // if requisition exists and is not expired, return requisition
    if (existingRequistion && existingRequistion.status !== "EX") {
      return redirect(route("/banks/:bankId", { bankId }));
    }

    // else create a new requisition and redirect to bank authorization
    const url = new URL(request.url);

    // So that redirects work for all three variants
    if (url.hostname === "0.0.0.0" || url.hostname === "127.0.0.1") {
      url.hostname = "localhost";
    }

    const newRequisition = await goCardlessApi.createRequisition({
      bankId,
      redirect: `${url.protocol}//${url.host}/api/authenticate-bank/${bankId}`,
    });

    if (!newRequisition.link) {
      throw new Response("Failed to create requisition with link", {
        status: 500,
      });
    }

    return redirect(newRequisition.link);
  } catch (error) {
    console.error("Failed to create requisition", error);
    throw new Response("Failed to create requisition", { status: 500 });
  }
}
