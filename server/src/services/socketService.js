import jwt from 'jsonwebtoken';
export const setupSocketHandlers = (io) => {
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('Authentication required'));
    try { socket.user = jwt.verify(token, process.env.JWT_SECRET); next(); }
    catch { next(new Error('Invalid token')); }
  });
  io.on('connection', (socket) => {
    socket.join(socket.user.id);
    socket.on('disconnect', () => {});
  });
};
