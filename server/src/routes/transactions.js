import { Router } from 'express';
import { getTransactions, createTransaction, deleteTransaction, batchCreateTransactions } from '../controllers/transactionController.js';
const router = Router();
router.get('/', getTransactions);
router.post('/', createTransaction);
router.post('/batch', batchCreateTransactions);
router.delete('/:id', deleteTransaction);
export default router;
