import { LoaderFunctionArgs, redirect } from "@remix-run/cloudflare";
import { ApiError } from "generated-sources/gocardless";
import { DbApi } from "~/lib/dbApi";
import { GoCardlessApi } from "~/lib/gocardless-api.server";

export async function loader({ context, request, params }: LoaderFunctionArgs) {
  const bankId = params.bankId!!;

  const db = DbApi.create({ context });
  const goCardlessApi = GoCardlessApi.create({ context });

  const requisitionId = new URL(request.url).searchParams.get("ref");
  if (!requisitionId) {
    return redirect("/banks");
  }

  try {
    const requisition = await goCardlessApi.getRequisition({ requisitionId });
    if (!requisition) {
      throw redirect("/banks", {
        status: 404,
        statusText: "Requisition not found",
      });
    }

    const bank = await goCardlessApi.getBank({ bankId });
    if (!bank) {
      throw redirect("/banks", {
        status: 404,
        statusText: "Bank not found",
      });
    }

    await db.addBank({ ...bank, requisitionId: requisition.id });
    return redirect("/banks");
  } catch (error) {
    console.error("Failed to get requisition", error);
    if (!(error instanceof ApiError)) {
      throw redirect("/banks");
    }
    throw redirect("/banks", { ...error });
  }
}
