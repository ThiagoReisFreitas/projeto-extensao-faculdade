// erro com status HTTP explicito
export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

// wrapper async -> encaminha rejeicao pro middleware de erro
export const ah = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
