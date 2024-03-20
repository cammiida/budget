import type { LoaderFunctionArgs, SerializeFrom } from "@remix-run/cloudflare";
import { json } from "@remix-run/cloudflare";
import { useLoaderData } from "@remix-run/react";
import type { CurrencyExchangeSchema } from "generated-sources/gocardless";

type Account = {
  id: string;
  balances: {
    balanceAmount: number;
    balanceType: "interimAvailable" | "closingBooked";
    referenceDate: Date;
  }[];
  name: string;
  ownerName: string;
  bban: string;
  bic: string;
};

type Transaction = {
  id: string;
  accountId: string;
  categoryId?: string;
  amount: number;
  bookingDateTime: Date;
  valueDateTime: Date;
  currencyExchange?: Array<CurrencyExchangeSchema>;
  creditorName: string;
  debtorName: string;
};

type Category = {
  id: string;
  name: string;
  budgeted?: number;
  currency: string;
};

type Budget = {
  id: string;
  accountIds: string[];
  categoryIds: string[];
  name: string;
  start: Date;
  end: Date;
};

export async function loader({ request, context }: LoaderFunctionArgs) {
  // TODO: api call to get budget by id or most recent budget if no id is provided

  const categories: Category[] = [
    {
      id: "1",
      name: "Groceries",
      budgeted: 1000,
      currency: "GBP",
    },
    {
      id: "2",
      name: "Rent",
      budgeted: 2000,
      currency: "GBP",
    },
    {
      id: "3",
      name: "Holiday",
      budgeted: 1000,
      currency: "GBP",
    },
    {
      id: "4",
      name: "New Car",
      budgeted: 2000,
      currency: "GBP",
    },
  ];

  const accounts: Account[] = [
    {
      id: "1",
      balances: [
        {
          balanceAmount: 1000,
          balanceType: "interimAvailable",
          referenceDate: new Date(),
        },
      ],
      name: "Current Account",
      ownerName: "Camilla",
      bban: "123456",
      bic: "123456",
    },
    {
      id: "2",
      balances: [
        {
          balanceAmount: 1000,
          balanceType: "interimAvailable",
          referenceDate: new Date(),
        },
      ],
      name: "Savings Account",
      ownerName: "Camilla",
      bban: "123456",
      bic: "123456",
    },
  ];

  const transactions: Transaction[] = [
    {
      id: "0",
      accountId: "1",
      amount: 100,
      bookingDateTime: new Date(),
      valueDateTime: new Date(),
      creditorName: "Tesco",
      debtorName: "Camilla",
    },
    {
      id: "1",
      accountId: "1",
      categoryId: "1",
      amount: 100,
      bookingDateTime: new Date(),
      valueDateTime: new Date(),
      creditorName: "Tesco",
      debtorName: "Camilla",
    },
    {
      id: "2",
      accountId: "1",
      categoryId: "2",
      amount: 100,
      bookingDateTime: new Date(),
      valueDateTime: new Date(),
      creditorName: "Landlord",
      debtorName: "Camilla",
    },
    {
      id: "3",
      accountId: "1",
      categoryId: "2",
      amount: 100,
      bookingDateTime: new Date(),
      valueDateTime: new Date(),
      creditorName: "Landlord",
      debtorName: "Camilla",
    },
    {
      id: "4",
      accountId: "1",
      categoryId: "4",
      amount: 100,
      bookingDateTime: new Date(),
      valueDateTime: new Date(),
      creditorName: "Car Dealer",
      debtorName: "Camilla",
    },
  ];

  const budget: Budget = {
    id: "1",
    name: "My Budget",
    start: new Date(),
    end: new Date(),
    accountIds: accounts.map((a) => a.id),
    categoryIds: categories.map((c) => c.id),
  };

  const {
    uncategorizedTransactions,
    categorizedTransactions,
  }: Record<string, Transaction[]> = {
    uncategorizedTransactions: [],
    categorizedTransactions: [],
  };

  transactions.forEach((transaction) => {
    const matchingCategory = categories.find(
      (category) => category.id === transaction.categoryId,
    );

    if (matchingCategory) {
      categorizedTransactions.push(transaction);
    } else {
      uncategorizedTransactions.push(transaction);
    }
  });

  const categoriesWithTransactions = categories.map((category) => {
    const categoryTransactions = categorizedTransactions.filter(
      (transaction) => transaction.categoryId === category.id,
    );
    return {
      ...category,
      transactions: categoryTransactions,
    };
  });

  return json({
    budget: budget,
    accounts,
    categories: categoriesWithTransactions,
    uncategorizedTransactions,
  });
}

export default function Budget() {
  const { budget, categories, uncategorizedTransactions } =
    useLoaderData<typeof loader>();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl">{budget.name}</h1>
      <p>
        {budget.start.split("T")[0].replaceAll("-", ".")} -{" "}
        {budget.end.split("T")[0].replaceAll("-", ".")}
      </p>
      <ul className="space-y-8 bg-slate-50">
        <li>
          <Category
            category={{
              id: "uncategorized",
              name: "Uncategorized",
              currency: "NOK",
              transactions: uncategorizedTransactions,
            }}
          />
        </li>
        {categories.map((category) => {
          return (
            <li key={category.name} className="p-3">
              <Category category={category} />
            </li>
          );
        })}
      </ul>
    </div>
  );
}

type ClientCategory = SerializeFrom<typeof loader>["categories"][0];
type ClientTransaction = SerializeFrom<Transaction>;

function Category({ category }: { category: ClientCategory }) {
  const spent = category.transactions.reduce(
    (acc, transaction) => acc + transaction.amount,
    0,
  );

  return (
    <div>
      <div className="bold flex w-full justify-between text-lg">
        <h3>{category.name}</h3>
        <p>{category.budgeted} budgeted</p>
        <p>{spent} spent</p>
      </div>
      <ul className="space-y-4 px-8">
        {category.transactions.map((transaction) => {
          return (
            <li
              key={transaction.id}
              className="flex w-full items-end justify-between gap-2"
            >
              <Transaction transaction={transaction} />
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function Transaction({
  transaction,
}: {
  transaction: ClientTransaction;
}) {
  return (
    <>
      <div>
        <small>{transaction.bookingDateTime}</small>
        <p>{transaction.creditorName}</p>
      </div>
      <p>{transaction.amount}</p>
    </>
  );
}
