// module.exports = (fn) => {
//     return (req, res, next) => {
//       fn(req, res, next).catch(next);
//     };
//   };

const APIError = require("./APIError");

module.exports = (fn) => (req, res, next) =>
  fn(req, res, next).catch((error) => {
    if (!error.statusCode || error.statusCode >= 500) {
      error = new APIError(error.message, error.statusCode || 500);
    }
    next(error);
  });
