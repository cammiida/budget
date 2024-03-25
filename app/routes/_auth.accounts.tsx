import { useFetcher, useParams } from "@remix-run/react";
import { RefreshCw } from "lucide-react";
import { route } from "routes-gen";
import ActionHeader from "~/components/ui/action-header";
import { Button } from "~/components/ui/button";

export default function Accounts() {
  const fetcher = useFetcher();
  const params = useParams();
  const isNavigating = fetcher.state !== "idle";

  return (
    <>
      <ActionHeader title="Accounts">
        <fetcher.Form method="POST" action={route("/api/sync-accounts")}>
          <input type="hidden" name="bankId" value={params.bankId} />
          <Button
            variant="outline"
            disabled={isNavigating}
            className="flex gap-2"
          >
            <RefreshCw
              className={`h-4 w-4 ${isNavigating && "animate-spin"}`}
            />
            Sync accounts
          </Button>
        </fetcher.Form>
      </ActionHeader>
      <div className="relative top-16"></div>
    </>
  );
}
