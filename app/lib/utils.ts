import type { SerializeFrom } from "@remix-run/cloudflare";
import { useRouteLoaderData } from "@remix-run/react";
import type { ClassValue } from "clsx";
import { clsx } from "clsx";
import type { TransactionSchema } from "generated-sources/gocardless";
import type { RouteId } from "route-ids";
import { twMerge } from "tailwind-merge";
import type { Transaction } from "./schema";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function remoteToInternalTransaction({
  remote,
  status,
  userId,
  accountId,
  bankId,
}: {
  remote: TransactionSchema;
  status: "booked" | "pending";
  userId: number;
  accountId: string;
  bankId: string;
}): Transaction {
  return {
    userId,
    bankId,
    transactionId:
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
