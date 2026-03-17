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
 * Uses a First Fit Decreasing algorithm for efficient packing.
 */
export function createBatches(accounts: Account[], maxAmount: number = 20000): Batch[] {
  // Sort descending to fit larger amounts first (First Fit Decreasing)
  const sortedAccounts = [...accounts].sort((a, b) => b.amount - a.amount);
  const batches: Batch[] = [];

  for (const account of sortedAccounts) {
    let placed = false;
    // Try to place in an existing batch
    for (const batch of batches) {
      if (batch.totalAmount + account.amount <= maxAmount) {
        batch.accounts.push(account);
        batch.totalAmount += account.amount;
        placed = true;
        break;
      }
    }
    // If it couldn't be placed, create a new batch
    if (!placed) {
      if (account.amount > maxAmount) {
        throw new Error(`Account ${account.accountNo} has amount ${account.amount} which exceeds the maximum batch limit of ${maxAmount}.`);
      }
      batches.push({
        totalAmount: account.amount,
        accounts: [account],
      });
    }
  }

  return batches;
}
