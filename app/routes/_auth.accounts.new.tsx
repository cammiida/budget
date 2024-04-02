import type {
  ActionFunctionArgs,
  LoaderFunctionArgs,
} from "@remix-run/cloudflare";
import {
  Form,
  json,
  redirect,
  useLoaderData,
  useNavigate,
  useSubmit,
} from "@remix-run/react";
import { and, eq } from "drizzle-orm";
import { useRef } from "react";
import { route } from "routes-gen";
import { z } from "zod";
import ClientOnly from "~/components/client-only";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import LinkButton from "~/components/ui/link-button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { requireUser } from "~/lib/auth.server";
import { getDbFromContext } from "~/lib/db.service.server";
import type { NewAccount } from "~/lib/schema";
import { accounts, banks as banksTable } from "~/lib/schema";

const newAccountSchema = z.object({
  type: z.literal("debit").or(z.literal("credit")),
  accountName: z.string(),
  ownerName: z.string(),
  startingBalance: z.string(),
  bankName: z.string(),
});

function toDbAccount(
  data: z.infer<typeof newAccountSchema>,
  userId: string,
  bankId: string,
): NewAccount {
  return {
    userId,
    name: data.accountName,
    ownerName: data.ownerName,
    interimAvailableBalance: { amount: data.startingBalance, currency: "NOK" },
    openingBookedBalance: { amount: data.startingBalance, currency: "NOK" },
    bankId,
  };
}

export async function action({ request, context }: ActionFunctionArgs) {
  const user = requireUser(context);
  const formData = await request.formData();

  const data = newAccountSchema.parse(Object.fromEntries(formData));
  const db = getDbFromContext(context);
  const bank = await db.query.banks.findFirst({
    where: and(
      eq(banksTable.userId, user.id),
      eq(banksTable.name, data.bankName),
    ),
  });
  if (!bank) {
    return json(
      {
        success: false,
        error: "Failed to create account. Bank not found.",
      },
      { status: 404 },
    );
  }

  const transformedData = toDbAccount(data, user.id, bank.id);

  await db.insert(accounts).values(transformedData).execute();

  return redirect(route("/accounts"));
}

export async function loader({ context }: LoaderFunctionArgs) {
  const user = requireUser(context);

  const db = getDbFromContext(context);
  const banks = await db.query.banks.findMany({
    columns: { name: true, logo: true },
    where: eq(banksTable.userId, user.id),
  });

  return json({ banks });
}

export default function NewAccount() {
  const { banks } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const submit = useSubmit();

  function handleClose() {
    navigate(route("/accounts"));
  }

  const formRef = useRef<HTMLFormElement>(null);

  return (
    <ClientOnly>
      {() => (
        <Dialog open onOpenChange={handleClose}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="text-lg">New account</DialogTitle>
            </DialogHeader>
            <Form
              ref={formRef}
              method="POST"
              className="flex h-96 flex-col gap-4"
            >
              <Label>
                Account name
                <Input name="accountName" className="mt-2" />
              </Label>
              <Label>
                Owner name
                <Input name="ownerName" className="mt-2" />
              </Label>
              <Label>
                Starting balance
                <Input name="startingBalance" type="number" className="mt-2" />
              </Label>
              <Label>Bank</Label>
              <Select name="bankName">
                <SelectTrigger>
                  <SelectValue placeholder="Select a bank" />
                </SelectTrigger>
                <SelectContent>
                  {banks.map((bank) => (
                    <SelectItem key={bank.name} value={bank.name}>
                      {bank.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Form>
            <DialogFooter className="sm:justify-start">
              <DialogClose asChild>
                <LinkButton to={route("/accounts")}>Cancel</LinkButton>
              </DialogClose>
              <Button
                type="submit"
                onClick={() =>
                  submit(new FormData(formRef.current ?? undefined), {
                    method: "POST",
                  })
                }
              >
                Add account
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </ClientOnly>
  );
}
