import { Router } from 'express';
import { getTransactions, createTransaction, deleteTransaction } from '../controllers/transactionController.js';
const router = Router();
router.get('/', getTransactions);
router.post('/', createTransaction);
router.delete('/:id', deleteTransaction);
export default router;
