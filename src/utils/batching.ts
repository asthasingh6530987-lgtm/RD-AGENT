export interface Account {
  accountNo: string;
  amount: number;
  accountName?: string;
  monthPaidUpto?: string;
  nextDueDate?: string;
}

export interface Batch {
  totalAmount: number;
  accounts: Account[];
  createdAt?: any; // Using any for Firestore Timestamp
  batchNumber?: number;
}

/**
 * Groups a list of accounts into batches where each batch's total amount
 * does not exceed the maxAmount (default ₹20,000).
 * Sequentially groups accounts, starting a new batch when the limit is reached,
 * to match the AI Lot Grouping behavior.
 */
export function createBatches(accounts: Account[], maxAmount: number = 20000): Batch[] {
  const batches: Batch[] = [];
  let currentBatch: Batch = { totalAmount: 0, accounts: [] };

  for (const account of accounts) {
    if (account.amount >= maxAmount) {
      // If the account itself is greater than or equal to maxAmount, it forms its own batch
      if (currentBatch.accounts.length > 0) {
        batches.push(currentBatch);
        currentBatch = { totalAmount: 0, accounts: [] };
      }
      batches.push({
        totalAmount: account.amount,
        accounts: [account],
      });
    } else if (currentBatch.totalAmount + account.amount <= maxAmount) {
      currentBatch.accounts.push(account);
      currentBatch.totalAmount = Number((currentBatch.totalAmount + account.amount).toFixed(2));
    } else {
      // Exceeds maxAmount, push current batch and start a new one
      if (currentBatch.accounts.length > 0) {
        batches.push(currentBatch);
      }
      currentBatch = {
        totalAmount: account.amount,
        accounts: [account],
      };
    }
  }

  if (currentBatch.accounts.length > 0) {
    batches.push(currentBatch);
  }

  return batches;
}
