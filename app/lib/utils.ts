import type { SerializeFrom } from "@remix-run/cloudflare";
import { useRouteLoaderData } from "@remix-run/react";
import type { ClassValue } from "clsx";
import { clsx } from "clsx";
import type { TransactionSchema } from "generated-sources/gocardless";
import type { RouteId } from "route-ids";
import { twMerge } from "tailwind-merge";
import { z } from "zod";
import type { NewTransaction } from "./schema";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function transformRemoteTransactions(
  remoteTransactions: {
    accountId: string;
    booked: TransactionSchema[];
    pending?: TransactionSchema[] | undefined;
  }[],
  userId: string,
): NewTransaction[] {
  return remoteTransactions.flatMap(({ pending, booked, accountId }) => {
    const pendingTransactions = (pending ?? []).flatMap((it) =>
      transformRemoteTransaction({
        remote: it,
        status: "pending",
        userId,
        accountId,
      }),
    );

    const bookedTransactions = booked.flatMap((it) =>
      transformRemoteTransaction({
        remote: it,
        status: "booked",
        userId,
        accountId,
      }),
    );
    return [...pendingTransactions, ...bookedTransactions];
  });
}

type TransformRemoteTransactionArgs = {
  remote: TransactionSchema;
  status: "booked" | "pending";
  userId: string;
  accountId: string;
};

export function transformRemoteTransaction(
  args: TransformRemoteTransactionArgs,
): NewTransaction {
  const { remote, status, userId, accountId } = args;

  return {
    userId,
    externalTransactionId:
      remote.transactionId ??
      remote.internalTransactionId ??
      `${accountId} - ${userId}`,
    status,
    accountId,
    amount: remote.transactionAmount.amount,
    currency: remote.transactionAmount.currency,
    bookingDate: remote.bookingDate ? new Date(remote.bookingDate) : null,
    valueDate: remote.valueDate ? new Date(remote.valueDate) : null,
    creditorName: remote.creditorName ?? null,
    debtorName: remote.debtorName ?? null,
    categoryId: null,
    additionalInformation: remote.additionalInformation ?? null,
    debtorBban: remote.debtorAccount?.bban ?? null,
    creditorBban: remote.creditorAccount?.bban ?? null,
    exchangeRate: remote.currencyExchange?.[0]?.exchangeRate ?? null,
    spendingType: null,
    wantOrNeed: null,
  };
}

export function formatDate(dateString: string) {
  const date = new Date(dateString);
  const day = date.getDate().toString().padStart(2, "0");
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  return `${day}.${month}.${date.getFullYear()}`;
}

export function useRouteLoaderDataTyped<T>(routeId: RouteId) {
  return useRouteLoaderData(routeId) as SerializeFrom<T>;
}

/** Converts a plain object's keys into ZodEnum with type safety and autocompletion */
export function getZodEnumFromObjectKeys<
  TI extends Record<string, any>,
  R extends string = TI extends Record<infer R, any> ? R : never,
>(input: TI): z.ZodEnum<[R, ...R[]]> {
  const [firstKey, ...otherKeys] = Object.keys(input) as [R, ...R[]];
  return z.enum([firstKey, ...otherKeys]);
}

export function prettifyAccountName(name: string) {
  const split = name.split(",");
  if (split.length === 1) return name;

  return split.slice(0, -1).join(", ");
}
