import { prisma } from '../services/db.js';
import { io } from '../index.js';

export const getLoans = async (req, res) => {
  try {
    const loans = await prisma.loan.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' }
    });
    res.json(loans);
  } catch (e) { res.status(500).json({ error: e.message }); }
};

export const createLoan = async (req, res) => {
  try {
    const { name, type, principal, outstanding, emi, interestRate, tenureMonths, startDate } = req.body;
    const loan = await prisma.loan.create({
      data: {
        name, type,
        principal:    parseFloat(principal),
        outstanding:  parseFloat(outstanding),
        emi:          parseFloat(emi),
        interestRate: parseFloat(interestRate),
        tenureMonths: parseInt(tenureMonths),
        startDate:    new Date(startDate),
        userId:       req.user.id
      }
    });
    io.to(req.user.id).emit('loan:created', loan);
    res.status(201).json(loan);
  } catch (e) { res.status(500).json({ error: e.message }); }
};

export const updateLoan = async (req, res) => {
  try {
    const loan = await prisma.loan.update({
      where: { id: req.params.id },
      data: {
        ...req.body,
        outstanding:  req.body.outstanding  ? parseFloat(req.body.outstanding)  : undefined,
        emi:          req.body.emi          ? parseFloat(req.body.emi)          : undefined,
        interestRate: req.body.interestRate ? parseFloat(req.body.interestRate) : undefined,
      }
    });
    io.to(req.user.id).emit('loan:updated', loan);
    res.json(loan);
  } catch (e) { res.status(500).json({ error: e.message }); }
};

export const deleteLoan = async (req, res) => {
  try {
    await prisma.loan.delete({ where: { id: req.params.id } });
    io.to(req.user.id).emit('loan:deleted', req.params.id);
    res.json({ message: 'Deleted' });
  } catch (e) { res.status(500).json({ error: e.message }); }
};