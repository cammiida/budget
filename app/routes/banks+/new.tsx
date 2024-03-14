import type {
  ActionFunctionArgs,
  LoaderFunctionArgs,
} from "@remix-run/cloudflare";
import { redirect } from "@remix-run/cloudflare";
import { Form, json, useLoaderData } from "@remix-run/react";
import { Check, ChevronsUpDown } from "lucide-react";
import { useState } from "react";
import { route } from "routes-gen";
import { Button } from "~/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "~/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { requireLogin } from "~/lib/auth.server";
import { DbApi } from "~/lib/dbApi";
import { GoCardlessApi } from "~/lib/gocardless-api.server";
import { cn } from "~/lib/utils";

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

export async function loader({ context, request }: LoaderFunctionArgs) {
  await requireLogin({ context, request });

  const goCardlessApi = GoCardlessApi.create({ context });
  const banks = await goCardlessApi.getAllBanks();

  return json({
    banks: banks.map((bank) => ({
      id: bank.id,
      name: bank.name,
      logo: bank.logo,
    })),
  });
}

export default function NewBank() {
  const { banks } = useLoaderData<typeof loader>();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedBankId, setSelectedBankId] = useState("");

  return (
    <div className="flex w-full flex-col gap-4">
      <h2 className="text-lg">Add a new bank</h2>
      <div className="flex flex-col gap-2">
        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={isOpen}
              className="w-full justify-between"
            >
              {selectedBankId
                ? banks.find((bank) => bank.id === selectedBankId)?.name
                : "Select bank..."}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-full p-0">
            <Command>
              <CommandInput placeholder="Search bank..." />
              <CommandList>
                <CommandEmpty>No bank found.</CommandEmpty>
                <CommandGroup>
                  {banks.map((bank) => (
                    <CommandItem
                      key={bank.id}
                      value={bank.name}
                      onSelect={() => {
                        setSelectedBankId(
                          bank.id === selectedBankId ? "" : bank.id,
                        );
                        setIsOpen(false);
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          selectedBankId === bank.id
                            ? "opacity-100"
                            : "opacity-0",
                        )}
                      />
                      <div className="flex items-center justify-between gap-4">
                        <img
                          className="h-8 w-8 rounded-full"
                          src={bank.logo ?? undefined}
                          alt={bank.name}
                        />
                        <span>{bank.name}</span>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        <Form method="POST" className="self-end">
          <input readOnly hidden name="bankId" value={selectedBankId} />
          <Button type="submit" disabled={!selectedBankId}>
            Submit
          </Button>
        </Form>
      </div>
    </div>
  );
}
